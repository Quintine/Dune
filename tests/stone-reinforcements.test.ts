import assert from 'node:assert/strict';
import test from 'node:test';
import {viewGame, type Game} from '../game/engine';
import {holdOccupyCardsTraitor} from './fixture-ecaz-occupy-cards';
import {
  STONE_CARD, MIRROR_CARD, stoneHarassOccupyFixture, stoneHarassPlayer,
  takeStoneHarassCard, sealStoneHarassPlans, finishStoneHarassBattle, traitorIdentities,
} from './fixture-stone-harass';

const reinforcement = 'ecaz-reinforcements';
function prepare({lead = 'ecaz', holder = 'lead', mirror = false, opponentForces = 6,
  variableDial = 1}: {lead?: 'ecaz' | 'ally'; holder?: 'lead' | 'opponent'; mirror?: boolean;
    opponentForces?: number; variableDial?: number} = {}) {
  const source = stoneHarassOccupyFixture({lead, harass: false,
    stone: mirror ? 'opponent' : 'harass', mirror, variableDial,
    support: variableDial, ecazForces: 5, allyForces: 4, opponentForces});
  const owner = holder === 'lead' ? source.lead : source.opponent;
  takeStoneHarassCard(source.game, owner, reinforcement);
  const plan = source.plans.find(step => step.actor === owner)!.action;
  if (plan.weapon) plan.defense = reinforcement;
  else plan.weapon = reinforcement;
  return {source, owner};
}
const count = (game: Game, id: string) => game.discard.filter(card => card.id === id).length;
const has = (game: Game, owner: string, id: string) => stoneHarassPlayer(game, owner).hand.some(card => card.id === id);

void test('same-plan Stone and Reinforcements pay only the actual fixed or variable card user without adding physical strength', () => {
  for (const lead of ['ecaz', 'ally'] as const) for (const winning of [false, true]) {
    const {source, owner} = prepare({lead, opponentForces: winning ? 4 : 6});
    const before = structuredClone(source.game);
    const done = finishStoneHarassBattle(sealStoneHarassPlans(source), {mode: 'ignore'});
    assert.equal(done.lastBattleContext?.winner, winning ? source.lead : source.opponent,
      'the five undialed coalition counters beat four but lose to six; Reinforcements adds no tokens');
    const delta = (id: string, field: 'reserves' | 'tanks') =>
      stoneHarassPlayer(done, id)[field] - stoneHarassPlayer(before, id)[field];
    assert.equal(delta(owner, 'reserves'), -3);
    assert.equal(delta(owner === source.ecaz ? source.ally : source.ecaz, 'reserves'), 0);
    assert.equal(delta(source.ecaz, 'tanks'), winning ? lead === 'ecaz' ? 6 : 3 : lead === 'ecaz' ? 8 : 5);
    assert.equal(delta(source.ally, 'tanks'), winning ? lead === 'ally' ? 4 : 1 : lead === 'ally' ? 7 : 4);
    assert.equal(stoneHarassPlayer(done, source.ecaz).forces[source.location] ?? 0, winning ? 2 : 0);
    assert.equal(stoneHarassPlayer(done, source.ally).forces[source.location] ?? 0, winning ? 3 : 0);
    assert.equal(count(done, reinforcement), 1);
    assert.equal(has(done, source.lead, STONE_CARD), winning);
    assert.equal(count(done, STONE_CARD), winning ? 0 : 1);
    assert.equal(done.battle, null);
  }
});

void test('opposing Reinforcements cannot turn a five-token army into seven and still pays its original elite reserve cost', () => {
  for (const lead of ['ecaz', 'ally'] as const) {
    const {source, owner} = prepare({lead, holder: 'opponent', variableDial: 0, opponentForces: 5});
    const player = stoneHarassPlayer(source.game, owner);
    player.reserves = 3; player.tanks = 12;
    player.elites!.reserves = 1; player.elites!.tanks = 4;
    const cost = viewGame(source.game, owner).battle!.reinforcements!;
    assert.equal(cost.normal, 2); assert.equal(cost.elite, 1);
    const done = finishStoneHarassBattle(sealStoneHarassPlans(source), {mode: 'ignore'});
    assert.equal(done.lastBattleContext?.winner, source.lead, 'six physical undialed counters beat five');
    assert.equal(stoneHarassPlayer(done, owner).reserves, 0);
    assert.equal(stoneHarassPlayer(done, owner).tanks, 20);
    assert.equal(stoneHarassPlayer(done, owner).elites!.tanks, 5);
    assert.equal(count(done, reinforcement), 1);
    assert.equal(has(done, source.lead, STONE_CARD), true);
  }
});

void test('the independent copied Stone mode preserves Mirror custody and the reserve fee', () => {
  for (const lead of ['ecaz', 'ally'] as const) {
    const {source, owner} = prepare({lead, mirror: true, variableDial: 0, opponentForces: 5});
    const beforeReserves = stoneHarassPlayer(source.game, owner).reserves;
    const done = finishStoneHarassBattle(sealStoneHarassPlans(source),
      {modes: {[source.lead]: 'kill', [source.opponent]: 'ignore'}});
    assert.equal(done.lastBattleContext?.winner, source.lead);
    assert.equal(stoneHarassPlayer(done, owner).reserves, beforeReserves - 3);
    assert.equal(has(done, source.lead, MIRROR_CARD), true);
    assert.equal(count(done, MIRROR_CARD), 0);
    assert.equal(count(done, STONE_CARD), 1);
    assert.equal(count(done, reinforcement), 1);
    for (const actor of [source.lead, source.opponent])
      assert.equal(stoneHarassPlayer(done, actor).leaders.find(leader => leader.id === source.leaders[actor])!.dead, true);
  }
});

void test('opposing successful Traitor overrides Stone kill but does not waive the Reinforcements reserve cost', () => {
  for (const lead of ['ecaz', 'ally'] as const) {
    const {source, owner} = prepare({lead, opponentForces: 4});
    const physical = traitorIdentities(source.game);
    const leader = stoneHarassPlayer(source.game, source.lead).leaders.find(leader =>
      !leader.dead && !leader.usedAt && physical.has(leader.id))!;
    assert.ok(leader);
    source.plans.find(step => step.actor === source.lead)!.action.leader = leader.id;
    holdOccupyCardsTraitor(source.game, source.opponent, leader.id);
    const before = stoneHarassPlayer(source.game, owner).reserves;
    const done = finishStoneHarassBattle(sealStoneHarassPlans(source), {mode: 'kill', traitors: [source.opponent]});
    assert.equal(done.lastBattleContext?.result, 'traitor');
    assert.equal(done.lastBattleContext?.winner, source.opponent);
    assert.equal(stoneHarassPlayer(done, owner).reserves, before - 3);
    assert.equal(stoneHarassPlayer(done, source.opponent).leaders.find(candidate =>
      candidate.id === source.leaders[source.opponent])!.dead, false, 'the defeated Stone attack cannot kill the winning caller’s leader');
    assert.equal(count(done, reinforcement), 1);
    assert.equal(count(done, STONE_CARD), 1);
  }
});
