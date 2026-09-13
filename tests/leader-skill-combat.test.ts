import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeck, ixBattleCards, leaders, type Card } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { CHEAP_HERO_TRAITOR } from '../game/traitors';
import {
  leaderSkillBattleBonus,
  type BattleLeaderSkill,
  type DirectLeaderSkillId,
} from '../game/leader-skill-combat';
import {
  quoteBattleResolution,
  type BattleResolutionInput,
  type ResolutionCombatant,
} from '../game/battle-resolution-quote';

const catalog = () => [...baseDeck(), ...ixBattleCards(), ...richeseCards()];
function one(predicate: (card: Card) => boolean) {
  const card = catalog().find(predicate);
  assert.ok(card);
  return card;
}
const selected = { id: 'selected-disc', kind: 'disc' as const };
const assignment = (
  skill: DirectLeaderSkillId,
  leader = selected.id,
  faceUp = false,
  captured = false,
): BattleLeaderSkill => ({ skill, leader, faceUp, captured });

void test('all five direct families use the physical selected card role for normal +1 or skilled +3 without +4', () => {
  const cases: [DirectLeaderSkillId, Card | undefined, Card | undefined][] = [
    ['warmaster', one((card) => card.kind === 'worthless'), undefined],
    [
      'master-of-assassins',
      one((card) => card.kind === 'chemistry'),
      undefined,
    ],
    [
      'swordmaster-of-ginaz',
      one((card) => card.kind === 'weirdingWay'),
      undefined,
    ],
    ['killer-medic', undefined, one((card) => card.kind === 'chemistry')],
    [
      'prana-bindu-adept',
      undefined,
      one((card) => card.kind === 'weirdingWay'),
    ],
  ];
  for (const [skill, weapon, defense] of cases) {
    assert.deepEqual(
      leaderSkillBattleBonus({
        assignments: [assignment(skill)],
        selectedLeader: selected,
        weapon,
        defense,
        skilledLeaderSurvives: true,
      }),
      { bonus: 3, applied: [{ skill, amount: 3, mode: 'skilled' }] },
    );
    assert.deepEqual(
      leaderSkillBattleBonus({
        assignments: [assignment(skill, 'trainer', true)],
        selectedLeader: selected,
        weapon,
        defense,
        skilledLeaderSurvives: true,
      }),
      { bonus: 1, applied: [{ skill, amount: 1, mode: 'normal' }] },
    );
  }
});

void test('dead, bluffed, face-up selected and captured assignments preserve their distinct effect bands', () => {
  const weapon = one((card) => card.kind === 'projectile');
  const quote = (skill: BattleLeaderSkill, survives = true) =>
    leaderSkillBattleBonus({
      assignments: [skill],
      selectedLeader: selected,
      weapon,
      defense: undefined,
      skilledLeaderSurvives: survives,
    });
  assert.equal(quote(assignment('swordmaster-of-ginaz'), false).bonus, 0);
  assert.equal(
    quote(assignment('swordmaster-of-ginaz', 'trainer', false)).bonus,
    0,
    'A concealed bluff supplies neither effect band.',
  );
  assert.equal(
    quote(assignment('swordmaster-of-ginaz', selected.id, true)).bonus,
    0,
    'A still-public skilled disc cannot receive its lower battle effect.',
  );
  assert.equal(
    quote(assignment('swordmaster-of-ginaz', 'trainer', true, true)).bonus,
    0,
    'A captured assignment cannot train another leader.',
  );
  assert.equal(
    quote(assignment('swordmaster-of-ginaz', selected.id, false, true)).bonus,
    3,
    'A surviving captured skilled leader retains only its lower effect.',
  );
  assert.equal(
    leaderSkillBattleBonus({
      assignments: [assignment('swordmaster-of-ginaz', 'trainer', true)],
      selectedLeader: { id: 'cheap-hero', kind: 'hero' },
      weapon,
      defense: undefined,
      skilledLeaderSurvives: true,
    }).bonus,
    1,
    'Cheap Hero substitutes for another leader for the public normal band.',
  );
  assert.equal(
    leaderSkillBattleBonus({
      assignments: [assignment('swordmaster-of-ginaz', 'trainer', true)],
      selectedLeader: undefined,
      weapon,
      defense: undefined,
      skilledLeaderSurvives: true,
    }).bonus,
    0,
  );
});

function battle(): BattleResolutionInput {
  const side = (
    id: string,
    faction: 'emperor' | 'guild',
    strength: number,
  ): ResolutionCombatant => {
    const leader = { ...leaders(faction)[0], strength };
    return {
      id,
      faction,
      spice: 10,
      hand: [],
      leader,
      plan: {
        dial: 2,
        support: 0,
        leader: leader.id,
        weapon: null,
        defense: null,
      },
      forces: {
        normal: 5,
        elite: 0,
        eliteStrength: 2,
        freeSupport: false,
      },
    };
  };
  return {
    advanced: false,
    turn: 2,
    territory: 'arrakeen',
    attacker: side('a', 'emperor', 3),
    defender: side('d', 'guild', 2),
    voters: [
      { id: 'a', beneficiary: 'a', called: false, traitors: [] },
      { id: 'd', beneficiary: 'd', called: false, traitors: [] },
    ],
    participants: [
      { id: 'a', faction: 'emperor' },
      { id: 'd', faction: 'guild' },
    ],
    physicalCards: catalog(),
    pendingAuditorPresent: false,
    pendingRetentionPresent: false,
  };
}
function play(
  input: BattleResolutionInput,
  side: 'attacker' | 'defender',
  slot: 'leader' | 'weapon' | 'defense' | 'lateDefense',
  predicate: (card: Card) => boolean,
) {
  const card = one(predicate);
  input[side].hand = [...input[side].hand, card];
  if (slot === 'lateDefense') input[side].lateDefense = card.id;
  else input[side].plan[slot] = card.id;
  if (slot === 'leader') delete input[side].leader;
  return card;
}

void test('battle quote adds only surviving skill receipts to scores while preserving printed strength and bounty', () => {
  const input = battle();
  const worthless = play(
    input,
    'attacker',
    'weapon',
    (card) => card.kind === 'worthless',
  );
  input.attacker.leaderSkills = [
    assignment('warmaster', input.attacker.leader!.id),
  ];
  const before = structuredClone(input);
  const quote = quoteBattleResolution(input);
  assert.deepEqual(quote.leaderStrengths, { attacker: 3, defender: 2 });
  assert.deepEqual(quote.leaderSkillBonuses.attacker, {
    bonus: 3,
    applied: [{ skill: 'warmaster', amount: 3, mode: 'skilled' }],
  });
  assert.deepEqual(quote.scores, { attacker: 8, defender: 4 });
  assert.deepEqual(input, before);

  const killed = structuredClone(input);
  play(killed, 'defender', 'weapon', (card) => card.kind === 'poison');
  const resolved = quoteBattleResolution(killed);
  assert.equal(resolved.winner, 'd');
  assert.equal(resolved.leaderSkillBonuses.attacker.bonus, 0);
  assert.equal(resolved.scores!.attacker, 2);
  assert.equal(resolved.bounty!.amount, 3);
  assert.equal(killed.attacker.plan.weapon, worthless.id);
});

void test('a supplemental physical defense activates its matching surviving skill role', () => {
  const input = battle();
  const snooper = play(
    input,
    'attacker',
    'lateDefense',
    (card) => card.kind === 'snooper',
  );
  input.attacker.leaderSkills = [
    assignment('killer-medic', input.attacker.leader!.id),
  ];
  const quote = quoteBattleResolution(input);
  assert.equal(input.attacker.plan.defense, null);
  assert.equal(input.attacker.lateDefense, snooper.id);
  assert.deepEqual(quote.leaderSkillBonuses.attacker, {
    bonus: 3,
    applied: [{ skill: 'killer-medic', amount: 3, mode: 'skilled' }],
  });
  assert.deepEqual(quote.scores, { attacker: 8, defender: 4 });
});

void test('normal training follows a Cheap Hero substitution but traitor precedence suppresses skill scoring', () => {
  const input = battle();
  const hero = play(
    input,
    'attacker',
    'leader',
    (card) => card.kind === 'hero',
  );
  play(input, 'attacker', 'weapon', (card) => card.kind === 'projectile');
  input.attacker.leaderSkills = [
    assignment('swordmaster-of-ginaz', 'public-trainer', true),
  ];
  let quote = quoteBattleResolution(input);
  assert.equal(quote.leaderStrengths.attacker, 0);
  assert.equal(quote.leaderSkillBonuses.attacker.bonus, 1);
  assert.equal(quote.scores!.attacker, 3);

  input.voters = [
    input.voters[0],
    {
      id: 'd',
      beneficiary: 'd',
      called: true,
      traitors: [CHEAP_HERO_TRAITOR],
    },
  ];
  quote = quoteBattleResolution(input);
  assert.equal(quote.result, 'traitor');
  assert.equal(quote.winner, 'd');
  assert.equal(quote.scores, null);
  assert.equal(quote.leaderSkillBonuses.attacker.bonus, 0);
  assert.equal(quote.bounty!.amount, 0);
  assert.equal(hero.kind, 'hero');
});

void test('Stone Burner comparison remains independent of a surviving skilled bonus', () => {
  const input = battle();
  input.attacker.forces.freeSupport = true;
  input.defender.forces.freeSupport = true;
  input.attacker.plan.dial = 4;
  input.defender.plan.dial = 1;
  play(input, 'attacker', 'weapon', (card) => card.effect === 'stoneBurner');
  play(input, 'attacker', 'defense', (card) => card.kind === 'snooper');
  input.attacker.stoneMode = 'ignore';
  input.attacker.leaderSkills = [
    assignment('killer-medic', input.attacker.leader!.id),
  ];
  const quote = quoteBattleResolution(input);
  assert.equal(quote.result, 'normal');
  assert.equal(quote.leaderSkillBonuses.attacker.bonus, 3);
  assert.deepEqual(quote.scores, { attacker: 10, defender: 3 });
  assert.equal(quote.stone?.winner, 'defender');
  assert.equal(quote.winner, 'd');
});
