import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, RuleError, type Action, type Game } from '../game/engine';
import { harassCustody, harassWithdrawGame, takeHarassCard } from './fixture-harass-withdraw';

const cardId = 'ecaz-reinforcements';
function fixture(advanced: boolean): Game {
  const g = harassWithdrawGame({ advanced, factions: ['emperor', 'atreides', 'harkonnen'] });
  takeHarassCard(g, 'a', cardId);
  harassCustody(g);
  return g;
}
function seal(g: Game, slot: 'weapon' | 'defense', own: Partial<Action> = {}, other: Partial<Action> = {}) {
  g = applyAction(g, 'a', {
    type: 'battlePlan', dial: 1, support: g.advanced ? 1 : 0,
    leader: 'emperor-0', weapon: slot === 'weapon' ? cardId : null,
    defense: slot === 'defense' ? cardId : null, ...own,
  });
  return applyAction(g, 'd', {
    type: 'battlePlan', dial: 1, support: g.advanced ? 1 : 0,
    leader: 'atreides-0', weapon: null, defense: null, ...other,
  });
}
function resolve(g: Game, callA = false, callD = false) {
  g = applyAction(g, 'a', { type: 'traitorCall', call: callA });
  const serialized = JSON.parse(JSON.stringify(g)) as Game;
  for (const p of g.players)
    assert.deepEqual(viewGame(serialized, p.id), viewGame(g, p.id));
  const before = JSON.stringify(g);
  const done = applyAction(g, 'd', { type: 'traitorCall', call: callD });
  assert.equal(JSON.stringify(g), before);
  harassCustody(done);
  return done;
}
function reject(g: Game, id: string, action: Action, reason: RegExp) {
  const before = JSON.stringify(g);
  assert.throws(() => applyAction(g, id, action), reason);
  assert.equal(JSON.stringify(g), before);
}

void test('Reinforcements consumes exactly three own normal reserves in either card slot, Basic and Advanced', () => {
  for (const advanced of [false, true]) for (const slot of ['weapon', 'defense'] as const) {
    const start = fixture(advanced);
    const owner = viewGame(start, 'a');
    assert.deepEqual(owner.battle?.reinforcements, { blocked: null, normal: 3, elite: 0 });
    assert.equal(viewGame(start, 'd').battle?.reinforcements, null);
    assert.equal(viewGame(start, 't').battle?.reinforcements, null);
    const privatePlan = applyAction(start, 'a', {
      type: 'battlePlan', dial: 1, support: advanced ? 1 : 0, leader: 'emperor-0',
      weapon: slot === 'weapon' ? cardId : null,
      defense: slot === 'defense' ? cardId : null,
    });
    assert.deepEqual(viewGame(privatePlan, 'd').battle?.plans, {});
    assert.deepEqual(viewGame(privatePlan, 't').battle?.plans, {});
    const sealed = applyAction(privatePlan, 'd', {
      type: 'battlePlan', dial: 1, support: advanced ? 1 : 0,
      leader: 'atreides-0', weapon: null, defense: null,
    });
    const done = resolve(sealed);
    assert.equal(done.battle, null);
    assert.equal(done.players[0].reserves, 12);
    assert.equal(done.players[0].tanks >= 3, true);
    assert.equal(done.players[0].battleLosses >= 3, true);
    assert.equal(done.discard.filter(c => c.id === cardId).length, 1);
    assert.deepEqual(viewGame(JSON.parse(JSON.stringify(done)) as Game, 'a'), viewGame(done, 'a'));
  }
});

void test('paired Ecaz/Moritani battles spend one physical Reinforcements cost without changing the card slot or private plan', () => {
  for (const advanced of [false, true]) for (const owner of ['ecaz', 'moritani'] as const) {
    let g = harassWithdrawGame({ advanced, factions: [owner, owner === 'ecaz' ? 'moritani' : 'ecaz', 'atreides'] });
    takeHarassCard(g, 'a', cardId);
    harassCustody(g);
    assert.deepEqual(viewGame(g, 'a').battle?.reinforcements, { blocked: null, normal: 3, elite: 0 });
    assert.equal(viewGame(g, 'd').battle?.reinforcements, null);
    g = applyAction(JSON.parse(JSON.stringify(g)) as Game, 'a', {
      type: 'battlePlan', dial: 1, support: advanced ? 1 : 0,
      leader: `${owner}-0`, defense: cardId,
    });
    assert.deepEqual(viewGame(g, 'd').battle?.plans, {});
    g = applyAction(g, 'd', {
      type: 'battlePlan', dial: 1, support: advanced ? 1 : 0,
      leader: `${owner === 'ecaz' ? 'moritani' : 'ecaz'}-0`,
    });
    const done = resolve(g);
    assert.equal(done.battle, null);
    assert.equal(done.players[0].reserves, 12);
    assert.equal(done.discard.filter(card => card.id === cardId).length, 1);
    assert.equal(done.log.filter(event => event.text.includes('used Reinforcements: three reserve forces')).length, 1);
  }
});

void test('co-present Ecaz card armies outside the opted-in Advanced profile remain unsupported', () => {
  const g = harassWithdrawGame({ advanced: true, factions: ['moritani', 'atreides', 'ecaz'] });
  g.players[0].ally = 't';
  g.players[2].ally = 'a';
  g.players[2].forces = { 'arrakeen:10': 1 };
  g.players[2].reserves = 19;
  takeHarassCard(g, 'a', cardId);
  harassCustody(g);
  assert.throws(() => applyAction(g, 'a', {
    type: 'battlePlan', dial: 1, support: 1, leader: 'moritani-0', weapon: cardId,
  }), RuleError);
});

void test('opposing physical Harass plan resolves with Reinforcements instead of trapping both revealed plans', () => {
  for (const advanced of [false, true]) {
    const g = fixture(advanced);
    takeHarassCard(g, 'd', 'ecaz-harass-withdraw');
    const sealed = seal(g, 'weapon', {}, { defense: 'ecaz-harass-withdraw' });
    const done = resolve(sealed);
    assert.equal(done.battle, null);
    assert.equal(done.players[0].reserves, 12);
    assert.equal(done.discard.filter(c => c.id === cardId).length, 1);
    assert.equal(done.discard.filter(c => c.id === 'ecaz-harass-withdraw').length, 1);
    assert.equal(done.log.filter(e => e.text.includes('used Reinforcements: three reserve forces')).length, 1);
    assert.equal(done.log.filter(e => e.text.includes('used Harass & Withdraw')).length, 1);
  }
});

void test('Reinforcements normal-first cost preserves elite subpool and is paid on a traitor outcome', () => {
  let g = fixture(true);
  const p = g.players[0];
  p.reserves = 3;
  p.tanks = 12;
  p.elites!.reserves = 2;
  p.elites!.tanks = 3;
  harassCustody(g);
  assert.deepEqual(viewGame(g, 'a').battle?.reinforcements, { blocked: null, normal: 1, elite: 2 });
  // Give Atreides the Emperor's selected leader as a real traitor, preserving the deck's identities.
  const target = 'emperor-0';
  const old = g.players[1].traitors[0];
  const pools = [g.traitorReserve!, ...g.players.map(player => player.traitors)];
  const source = pools.find(pool => pool.includes(target))!;
  source[source.indexOf(target)] = old;
  g.players[1].traitors[0] = target;
  g = seal(g, 'defense');
  const done = resolve(g, false, true);
  assert.equal(done.lastBattleContext?.result, 'traitor');
  assert.equal(done.players[0].reserves, 0);
  assert.equal(done.players[0].elites!.reserves, 0);
  assert.equal(done.players[0].elites!.tanks, 5);
  assert.equal(done.discard.filter(c => c.id === cardId).length, 1);
});

void test('insufficient reserves, unsupported module, and a paired special reject without mutating the original game', () => {
  const g = fixture(true);
  const p = g.players[0];
  p.reserves = 2;
  p.tanks = 13;
  p.elites!.reserves = 2;
  p.elites!.tanks = 3;
  harassCustody(g);
  assert.match(viewGame(g, 'a').battle!.reinforcements!.blocked!, /three physical forces/);
  reject(g, 'a', { type: 'battlePlan', dial: 1, leader: 'emperor-0', weapon: cardId }, /three own forces/);
  p.reserves = 15;
  p.tanks = 0;
  p.elites!.reserves = 5;
  p.elites!.tanks = 0;
  reject(g, 'a', { type: 'battlePlan', dial: 1, leader: 'emperor-0', weapon: cardId,
    defense: 'ecaz-harass-withdraw' }, /cannot share/);
  g.sandtrout = {} as Game['sandtrout'];
  assert.throws(() => applyAction(g, 'a',
    { type: 'battlePlan', dial: 1, leader: 'emperor-0', weapon: cardId }), RuleError);
});

void test('other expansion factions remain ineligible for the paired Ecaz card prototype', () => {
  for (const owner of ['ixians', 'choam'] as const) {
    const g = harassWithdrawGame({ advanced: true, factions: [owner, 'atreides', 'harkonnen'] });
    takeHarassCard(g, 'a', cardId);
    assert.throws(() => applyAction(g, 'a', {
      type: 'battlePlan', dial: 0, support: 0, leader: `${owner}-0`, weapon: cardId,
    }), RuleError);
  }
});
