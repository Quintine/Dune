import assert from 'node:assert/strict';
import test from 'node:test';
import { baseDeck, ixBattleCards, leaders, type Card } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { quoteBattleResolution, type BattleResolutionInput, type ResolutionCombatant } from '../game/battle-resolution-quote';

const cards = () => [...baseDeck(), ...ixBattleCards(), ...richeseCards()];

function alliedBattle(): BattleResolutionInput {
  const side = (id: string, faction: 'emperor' | 'guild', dial: number): ResolutionCombatant => {
    const leader = leaders(faction)[0];
    return { id, faction, spice: 10, hand: [], leader,
      plan: { dial, support: 0, leader: leader.id, weapon: null, defense: null },
      forces: { normal: 5, elite: 0, eliteStrength: 2, freeSupport: false } };
  };
  const attacker = side('winner', 'emperor', 4);
  const defender = side('loser', 'guild', 0);
  defender.ally = 'moritani';
  return { advanced: false, turn: 2, territory: 'arrakeen', attacker, defender,
    voters: [
      { id: 'winner', beneficiary: 'winner', called: false, traitors: [] },
      { id: 'loser', beneficiary: 'loser', called: false, traitors: [] },
    ],
    participants: [
      { id: 'winner', faction: 'emperor' },
      { id: 'loser', faction: 'guild', ally: 'moritani' },
      { id: 'moritani', faction: 'moritani', ally: 'loser' },
    ],
    physicalCards: cards(), pendingAuditorPresent: false, pendingRetentionPresent: false };
}

function play(g: BattleResolutionInput, slot: 'leader' | 'weapon' | 'defense', kind: Card['kind']) {
  const card = cards().find(candidate => candidate.kind === kind &&
    !g.defender.hand.some(existing => existing.id === candidate.id));
  assert.ok(card, `Missing physical ${kind} card`);
  g.defender.hand = [...g.defender.hand, card];
  g.defender.plan[slot] = card.id;
  if (slot === 'leader') delete g.defender.leader;
  return card.id;
}

function callLosingLeader(g: BattleResolutionInput) {
  const voter = g.voters.find(candidate => candidate.id === 'winner')!;
  voter.called = true;
  voter.traitors = [g.defender.plan.leader!];
}

void test('early native Moritani cleanup places the losing Hero in the first discard while preserving its other card', () => {
  const g = alliedBattle();
  const hero = play(g, 'leader', 'hero'), weapon = play(g, 'weapon', 'projectile');
  g.nativeMoritaniEarlyMandatoryDiscard = true;
  const before = structuredClone(g);
  const q = quoteBattleResolution(g);
  assert.equal(q.winner, 'winner');
  assert.deepEqual(q.retention?.played, [weapon]);
  assert.deepEqual(q.retention?.eligible, [weapon]);
  assert.deepEqual(q.discarded, [{ player: 'loser', card: hero }]);
  assert.deepEqual(g, before);
});

void test('legacy/default Moritani cleanup retains its original whole played set until the later choice', () => {
  const g = alliedBattle();
  const hero = play(g, 'leader', 'hero'), weapon = play(g, 'weapon', 'projectile');
  for (const option of [undefined, false]) {
    g.nativeMoritaniEarlyMandatoryDiscard = option;
    const before = structuredClone(g), q = quoteBattleResolution(g);
    assert.equal(q.winner, 'winner');
    assert.deepEqual(new Set(q.retention?.played), new Set([hero, weapon]));
    assert.deepEqual(q.retention?.eligible, [weapon]);
    assert.equal(q.discarded.some(entry => entry.player === 'loser'), false);
    assert.deepEqual(g, before);
  }
});

for (const used of [false, true]) for (const traitor of [false, true]) {
  void test(`early Moritani cleanup ${used ? 'used' : 'unused'} Poison Tooth with ${traitor ? 'a traitor call' : 'normal battle'}`, () => {
    const g = alliedBattle();
    const tooth = play(g, 'weapon', 'poisonTooth'), defense = play(g, 'defense', 'shield');
    g.defender.poisonTooth = used;
    g.nativeMoritaniEarlyMandatoryDiscard = true;
    if (traitor) callLosingLeader(g);
    const before = structuredClone(g), q = quoteBattleResolution(g);
    assert.equal(q.winner, 'winner');
    const mandatory = used && !traitor;
    assert.equal(q.retention!.played.includes(tooth), !mandatory);
    assert.equal(q.retention!.eligible.includes(tooth), !mandatory);
    assert.equal(q.retention!.played.includes(defense), true);
    assert.equal(q.retention!.eligible.includes(defense), true);
    assert.deepEqual(q.discarded.filter(entry => entry.player === 'loser'),
      mandatory ? [{ player: 'loser', card: tooth }] : []);
    assert.deepEqual(g, before);
  });
}

for (const traitor of [false, true]) {
  void test(`early Moritani cleanup Artillery ${traitor ? 'prevented by a traitor call' : 'used in battle'}`, () => {
    const g = alliedBattle();
    const artillery = play(g, 'weapon', 'artillery'), defense = play(g, 'defense', 'shield');
    g.nativeMoritaniEarlyMandatoryDiscard = true;
    if (traitor) callLosingLeader(g);
    const before = structuredClone(g), q = quoteBattleResolution(g);
    assert.equal(q.winner, 'winner');
    assert.equal(q.retention!.played.includes(artillery), traitor);
    assert.equal(q.retention!.eligible.includes(artillery), traitor);
    assert.equal(q.retention!.played.includes(defense), true);
    assert.equal(q.retention!.eligible.includes(defense), true);
    assert.deepEqual(q.discarded.filter(entry => entry.player === 'loser'),
      traitor ? [] : [{ player: 'loser', card: artillery }]);
    assert.deepEqual(g, before);
  });
}
