import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeck, leaders } from '../game/cards';
import {
  quoteBattleResolution,
  type BattleResolutionInput,
  type ResolutionCombatant,
} from '../game/battle-resolution-quote';

function fixture(): BattleResolutionInput {
  const side = (
    id: string,
    faction: 'atreides' | 'guild',
  ): ResolutionCombatant => ({
    id,
    faction,
    spice: 10,
    hand: [],
    plan: {
      dial: id === 'a' ? 1 : 0,
      support: 0,
      leader: null,
      weapon: null,
      defense: null,
    },
    forces: { normal: 5, elite: 0, eliteStrength: 1, freeSupport: true },
  });
  return {
    advanced: false,
    turn: 2,
    territory: 'homeworld:guild',
    homeworld: {
      native: 'd',
      card: 'junction',
      side: 'high',
      nativeForces: { normal: 5, elite: 0 },
    },
    attacker: side('a', 'atreides'),
    defender: side('d', 'guild'),
    voters: [{ id: 'd', beneficiary: 'd', called: false, traitors: [] }],
    participants: [
      { id: 'a', faction: 'atreides' },
      { id: 'd', faction: 'guild' },
    ],
    physicalCards: baseDeck(),
    pendingAuditorPresent: false,
    pendingRetentionPresent: false,
  };
}
function explosion(input: BattleResolutionInput) {
  const cards = baseDeck();
  const laser = cards.find((c) => c.kind === 'lasgun')!;
  const shield = cards.find((c) => c.kind === 'shield')!;
  input.attacker.hand = [...input.attacker.hand, laser];
  input.attacker.plan.weapon = laser.id;
  input.defender.hand = [...input.defender.hand, shield];
  input.defender.plan.defense = shield.id;
}
function rejects(input: BattleResolutionInput) {
  const before = structuredClone(input);
  assert.throws(() => quoteBattleResolution(input));
  assert.deepEqual(input, before);
}

void test('the native printed bonus changes the battle result without adding dial casualties or invading strength', () => {
  const input = fixture(),
    before = structuredClone(input);
  const result = quoteBattleResolution(input);
  assert.equal(result.winner, 'd');
  assert.deepEqual(result.scores, { attacker: 1, defender: 2 });
  assert.deepEqual(result.destroyedArmies, ['a']);
  assert.equal(result.basicWinnerLosses, null);
  assert.deepEqual(result.casualties!.options, [
    { normal: 0, elite: 0, paidNormal: 0, paidElite: 0 },
  ]);
  assert.deepEqual(input, before);
  const ordinary = structuredClone(input);
  delete ordinary.homeworld;
  ordinary.territory = 'arrakeen';
  ordinary.voters = [
    { id: 'a', beneficiary: 'a', called: false, traitors: [] },
    ...ordinary.voters,
  ];
  assert.equal(quoteBattleResolution(ordinary).winner, 'a');
});

void test('Caladan uses the verified card value and the native bonus follows either battle role', () => {
  const input = fixture();
  input.territory = 'homeworld:atreides';
  input.homeworld = {
    native: 'a',
    card: 'caladan',
    side: 'high',
    nativeForces: { normal: 6, elite: 0 },
  };
  input.attacker.forces.normal = 6;
  input.voters = [{ id: 'a', beneficiary: 'a', called: false, traitors: [] }];
  const result = quoteBattleResolution(input);
  assert.deepEqual(result.scores, { attacker: 3, defender: 0 });
  assert.equal(result.winner, 'a');
  assert.equal(result.casualties!.dial, 1);
});

void test('only a native combatant has a traitor vote; an invader or remote allied Harkonnen cannot call', () => {
  const input = fixture();
  const leader = leaders('atreides')[0];
  input.attacker.leader = leader;
  input.attacker.plan.leader = leader.id;
  input.voters[0].called = true;
  input.voters[0].traitors = [leader.id];
  const result = quoteBattleResolution(input);
  assert.equal(result.result, 'traitor');
  assert.equal(result.winner, 'd');
  assert.equal(result.homeworldExplosion, undefined);
  const invader = structuredClone(input);
  invader.voters = [
    ...invader.voters,
    { id: 'a', beneficiary: 'a', called: false, traitors: [] },
  ];
  rejects(invader);
  const ally = structuredClone(input);
  ally.participants = [
    ...ally.participants,
    { id: 'h', faction: 'harkonnen', ally: 'd' },
  ];
  ally.voters = [
    ...ally.voters,
    { id: 'h', beneficiary: 'd', called: false, traitors: [] },
  ];
  rejects(ally);
});

void test('an explosion destroys invaders but limits typed native losses to the printed strength independently of dial', () => {
  const input = fixture();
  input.advanced = true;
  input.territory = 'homeworld:emperor';
  input.defender.faction = 'emperor';
  input.participants[1].faction = 'emperor';
  input.defender.forces = {
    normal: 4,
    elite: 1,
    eliteStrength: 2,
    freeSupport: false,
  };
  input.homeworld = {
    native: 'd',
    card: 'kaitain',
    side: 'high',
    nativeForces: { normal: 4, elite: 1 },
  };
  explosion(input);
  const before = structuredClone(input),
    result = quoteBattleResolution(input);
  assert.equal(result.result, 'explosion');
  assert.equal(result.winner, null);
  assert.deepEqual(result.leaderDeaths, { attacker: true, defender: true });
  assert.deepEqual(result.destroyedArmies, ['a']);
  assert.deepEqual(result.homeworldExplosion, {
    player: 'd',
    amount: 2,
    options: [
      { normal: 2, elite: 0 },
      { normal: 1, elite: 1 },
    ],
  });
  assert.deepEqual(input, before);
});

void test('two foreigners get no native strength or traitor votes and explosion still preserves the noncombatant native remainder', () => {
  const input = fixture();
  input.territory = 'homeworld:harkonnen';
  input.participants = [
    ...input.participants,
    { id: 'native', faction: 'harkonnen' },
  ];
  input.homeworld = {
    native: 'native',
    card: 'giedi_prime',
    side: 'high',
    nativeForces: { normal: 7, elite: 0 },
  };
  input.voters = [];
  assert.deepEqual(quoteBattleResolution(input).scores, {
    attacker: 1,
    defender: 0,
  });
  explosion(input);
  const result = quoteBattleResolution(input);
  assert.deepEqual(result.destroyedArmies, ['a', 'd']);
  assert.deepEqual(result.homeworldExplosion, {
    player: 'native',
    amount: 2,
    options: [{ normal: 2, elite: 0 }],
  });
});

void test('native explosion loss is capped by the actual army, including an empty native pool', () => {
  for (const normal of [0, 1]) {
    const input = fixture();
    input.participants = [
      ...input.participants,
      { id: 'native', faction: 'harkonnen' },
    ];
    input.territory = 'homeworld:harkonnen';
    input.homeworld = {
      native: 'native',
      card: 'giedi_prime',
      side: 'low',
      nativeForces: { normal, elite: 0 },
    };
    input.voters = [];
    explosion(input);
    assert.deepEqual(quoteBattleResolution(input).homeworldExplosion, {
      player: 'native',
      amount: normal,
      options: [{ normal, elite: 0 }],
    });
  }
});

void test('mismatched native, card, location, army and Arrakis-only effects reject without mutation', () => {
  const edits: ((input: BattleResolutionInput) => void)[] = [
    (i) => {
      delete i.homeworld;
    },
    (i) => {
      i.territory = 'arrakeen';
    },
    (i) => {
      i.homeworld!.native = 'missing';
    },
    (i) => {
      i.homeworld!.card = 'caladan';
    },
    (i) => {
      i.homeworld!.nativeForces.normal = 4;
    },
    (i) => {
      i.homeworld!.nativeForces.normal = -1;
    },
    (i) => {
      i.defender.stronghold = 'arrakeen';
    },
    (i) => {
      i.participants[0].noFieldAtTerritory = true;
    },
    (i) => {
      i.voters = [];
    },
  ];
  for (const edit of edits) {
    const input = fixture();
    edit(input);
    rejects(input);
  }
});
