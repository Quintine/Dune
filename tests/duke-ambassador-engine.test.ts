import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { baseDeck } from '../game/cards';
import { createAmbassadors, validateAmbassadors } from '../game/ecaz-ambassadors';
import { createDukeVidal, DUKE_VIDAL_ID } from '../game/duke-vidal';
import { botActions } from '../game/bots';
import { actDukeAmbassador, createDukeAmbassadorFixture } from './fixture-duke-ambassador';

const player = (g: Game, id = 'ecaz') => g.players.find(p => p.id === id)!;
const reject = (g: Game, actor: string, action: Action) => {
  const before = structuredClone(g); assert.throws(() => applyAction(g, actor, action)); assert.deepEqual(g, before);
};
/** Controlled consumer probes. Original-action source proof is separate. */
function fixture({ advanced = false, copied = false, deaths = 1 } = {}) {
  const g = createGame('DUKEAMBPROBE', newPlayer('ecaz', 'Ecaz', 'ecaz'), advanced, ['ecaz']);
  g.players.push(newPlayer('entrant', 'Entrant', 'guild'), newPlayer('ally', 'Ally', 'atreides'));
  Object.assign(g, { status: 'playing', phase: 5, turn: 2, storm: 18,
    active: 'entrant', order: ['entrant', 'ecaz', 'ally'], movementRemaining: ['entrant', 'ecaz', 'ally'], deck: baseDeck() });
  for (const p of g.players) { p.hand = []; p.forces = {}; p.reserves = 20; p.spice = 12; }
  g.dukeVidal = createDukeVidal(); Object.assign(g.dukeVidal.leader, { dead: true, deaths, usedAt: 'imperial_basin' });
  const state = createAmbassadors(() => 0), effect = copied ? 'beneGesserit' : 'tleilaxu';
  const cohort = [effect, ...state.tokens.map(t => t.effect).filter(e => e !== effect && e !== 'ecaz')].slice(0, 5);
  state.cohort = state.tokens.filter(t => cohort.includes(t.effect)).map(t => t.id);
  for (const token of state.tokens) {
    token.zone = token.effect === 'ecaz' || state.cohort.includes(token.id) ? 'supply' : 'pool';
    token.location = null;
  }
  const token = state.tokens.find(t => t.effect === effect)!;
  token.zone = 'placed'; token.location = 'arrakeen'; validateAmbassadors(state);
  g.ecazAmbassadors = state;
  return g;
}
function pass(g: Game) {
  for (let n = 0; g.response && n < 30; n++) {
    const actor = g.players.find(p => !g.response!.passed.includes(p.id))!;
    g = applyAction(g, actor.id, { type: 'passResponse' });
  }
  assert.equal(g.response, null); return g;
}
function offer(source: Game, beneficiary = 'ecaz', copied = false) {
  let g = pass(applyAction(source, 'entrant', { type: 'ship', amount: 1, territory: 'arrakeen', sector: 10 }));
  if (g.decision?.kind === 'guildShipment')
    g = pass(applyAction(g, g.decision.player, { type: 'decision', allow: true }));
  assert.equal(g.pendingAmbassador?.stage, 'offer');
  const event = g.pendingAmbassador!.event;
  g = applyAction(g, 'ecaz', { type: 'decision', event, trigger: true, beneficiary, choice: 'effect' });
  if (copied) {
    assert.equal(g.pendingAmbassador?.stage, 'copy');
    g = applyAction(g, beneficiary, { type: 'decision', event, effect: 'tleilaxu' });
  }
  assert.equal(g.pendingAmbassador?.stage, 'revival'); return g;
}
const balances = (g: Game) => g.players.map(p => ({ id: p.id, spice: p.spice,
  reserves: p.reserves, tanks: p.tanks, forces: p.forces, hand: p.hand,
  revived: p.revived, freeForcesRevived: p.freeForcesRevived, leaderRevived: p.leaderRevived }));
function revive(g: Game) {
  return applyAction(g, 'ecaz', { type: 'decision', event: g.pendingAmbassador!.event, leader: DUKE_VIDAL_ID });
}

for (const advanced of [false, true]) void test(`controlled ${advanced ? 'Advanced' : 'Basic'} Ambassador returns the actual Duke alive and set aside without price or ordinary allowance`, () => {
  const g = offer(fixture({ advanced })), before = structuredClone(g), own = viewGame(g, 'ecaz').ambassadorEntry!.revival!;
  assert.ok(own.leaders.some(l => l.id === DUKE_VIDAL_ID));
  assert.equal(own.maximum, 0); assert.equal(viewGame(g, 'entrant').ambassadorEntry!.revival, null);
  const result = revive(g);
  assert.deepEqual(balances(result), balances(before));
  assert.equal(result.dukeVidal!.leader.id, DUKE_VIDAL_ID); assert.equal(result.dukeVidal!.leader.strength, 6);
  assert.equal(result.dukeVidal!.leader.dead, false); assert.equal(result.dukeVidal!.leader.deaths, 1);
  assert.equal(result.dukeVidal!.leader.usedAt, undefined); assert.equal(result.dukeVidal!.controller, null);
  assert.equal(result.dukeVidal!.source, null); assert.equal(result.dukeVidal!.acquiredTurn, null);
  assert.ok(result.players.every(p => !p.leaders.some(l => l.id === DUKE_VIDAL_ID)));
  assert.equal(player(result).leaders.length, 5); assert.ok(!result.pendingRevival);
  assert.equal(result.pendingAmbassador, null); assert.equal(result.active, 'entrant');
  assert.equal(player(result, 'entrant').forces['arrakeen:10'], 1);
  assert.ok(result.log.some(l => /living shared disc is set aside, unclaimed/.test(l.text)));
  reject(result, 'ecaz', { type: 'decision', event: before.pendingAmbassador!.event, leader: DUKE_VIDAL_ID });
  const ended = applyAction(result, 'entrant', { type: 'endMovement' });
  assert.equal(ended.movementRemaining?.includes('entrant') ?? false, false);
});

void test('controlled copied Tleilaxu grant keeps Duke identity and the Ecaz-only beneficiary rule', () => {
  const copied = offer(fixture({ copied: true }), 'ecaz', true);
  assert.equal(revive(copied).dukeVidal!.leader.dead, false);
  const source = fixture(); player(source).ally = 'ally'; player(source, 'ally').ally = 'ecaz';
  const allied = offer(source, 'ally');
  assert.equal(viewGame(allied, 'ally').ambassadorEntry!.revival!.leaders.some(l => l.id === DUKE_VIDAL_ID), false);
  reject(allied, 'ally', { type: 'decision', event: allied.pendingAmbassador!.event, leader: DUKE_VIDAL_ID });
  const declined = applyAction(allied, 'ally', { type: 'decision', event: allied.pendingAmbassador!.event, decline: true });
  assert.equal(declined.dukeVidal!.leader.dead, true); assert.equal(declined.pendingAmbassador, null);
});

void test('controlled independent Duke return preserves repeated history and a satisfied native cohort opening', () => {
  const source = fixture({ deaths: 3 }); player(source).leaderRevived = true;
  for (const leader of player(source).leaders.slice(0, 4)) Object.assign(leader, { dead: true, deaths: 1 });
  const g = offer(source), before = structuredClone(g), done = revive(g);
  assert.equal(done.dukeVidal!.leader.deaths, 3); assert.equal(done.dukeVidal!.leader.dead, false);
  assert.equal(player(done).leaderRevived, true); assert.deepEqual(balances(done), balances(before));
  assert.equal(player(done).ecazRevivalCohort?.cycle, 1);
  assert.deepEqual(player(done).ecazRevivalCohort?.returned, []);
  assert.equal(player(done).leaders.filter(l => l.dead).length, 4);
});

void test('controlled Duke grant uses the current event and cannot also return forces or act for another beneficiary', () => {
  const g = offer(fixture()), event = g.pendingAmbassador!.event;
  reject(g, 'ecaz', { type: 'decision', event: 'old-event', leader: DUKE_VIDAL_ID });
  reject(g, 'entrant', { type: 'decision', event, leader: DUKE_VIDAL_ID });
  reject(g, 'ecaz', { type: 'decision', event, leader: DUKE_VIDAL_ID, forces: 1 });
  const declined = applyAction(g, 'ecaz', { type: 'decision', event, decline: true });
  assert.equal(declined.dukeVidal!.leader.dead, true); assert.equal(declined.pendingAmbassador, null);
});

void test('controlled Duke return requires a separate original Ambassador acquisition before Ecaz controls him', () => {
  const source = fixture(), token = source.ecazAmbassadors!.tokens.find(t => t.effect === 'ecaz')!;
  token.zone = 'placed'; token.location = 'carthag'; validateAmbassadors(source.ecazAmbassadors!);
  const revived = revive(offer(source)); assert.equal(revived.dukeVidal!.controller, null);
  let arrived = pass(applyAction(revived, 'entrant', { type: 'move', from: 'arrakeen:10', amount: 1, territory: 'carthag', sector: 11 }));
  assert.equal(arrived.pendingAmbassador?.token, token.id); assert.equal(arrived.pendingAmbassador?.stage, 'offer');
  const event = arrived.pendingAmbassador!.event;
  arrived = applyAction(arrived, 'ecaz', { type: 'decision', event, trigger: true, beneficiary: 'ecaz', choice: 'duke' });
  assert.equal(arrived.dukeVidal!.controller, 'ecaz'); assert.equal(arrived.dukeVidal!.source, 'ecaz');
  assert.equal(arrived.dukeVidal!.leader.dead, false); assert.equal(arrived.dukeVidal!.leader.deaths, 1);
  assert.ok(arrived.players.every(p => !p.leaders.some(l => l.id === DUKE_VIDAL_ID)));
});

void test('all four existing profiles choose a legal sole Duke return and resume the original entrant', () => {
  const source = offer(fixture());
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = viewGame(source, 'ecaz'); view.players.find(p => p.id === 'ecaz')!.bot = difficulty;
    const action = botActions(view)[0]; assert.equal(action.leader, DUKE_VIDAL_ID);
    const done = applyAction(source, 'ecaz', action);
    assert.equal(done.dukeVidal!.leader.dead, false); assert.equal(done.dukeVidal!.controller, null);
    assert.equal(done.active, 'entrant'); assert.equal(done.pendingAmbassador, null);
  }
});

for (const copied of [false, true]) void test(`genuine Basic ${copied ? 'copied' : 'native'} Ambassador revives the original battle-killed Duke and resumes paid Guild entry`, () => {
  const f = createDukeAmbassadorFixture({ copied }), g = f.game;
  assert.equal(g.advanced, false); assert.deepEqual(g.expansions, ['ecaz']);
  assert.ok(f.actions.some(step => step.action.type === 'start'));
  assert.ok(f.beforeStartingDeal.players.every(p => p.hand.length === 0));
  assert.deepEqual(f.beforeStartingDeal.deck.slice(0, 4).map(c => c.id), f.deal);
  assert.equal(f.acquisition.after.dukeVidal!.controller, f.owner);
  assert.equal(f.afterDeath.dukeVidal!.leader.dead, true);
  assert.equal(f.afterDeath.dukeVidal!.leader.deaths, 1);
  assert.equal(player(g).tanks, 0); assert.ok(player(g).leaders.every(l => !l.dead));
  assert.deepEqual(viewGame(g, f.owner).ambassadorEntry!.revival!.leaders.map(l => l.id), [DUKE_VIDAL_ID]);
  assert.equal(viewGame(g, f.entrant).ambassadorEntry!.revival, null);
  const done = actDukeAmbassador(g, f.owner, { type: 'decision', event: f.event, leader: DUKE_VIDAL_ID });
  assert.deepEqual(balances(done), balances(g));
  assert.equal(done.dukeVidal!.leader.dead, false); assert.equal(done.dukeVidal!.leader.deaths, 1);
  assert.equal(done.dukeVidal!.controller, null); assert.equal(done.pendingAmbassador, null);
  assert.equal(done.active, f.entrant); assert.equal(player(done, f.entrant).forces[f.location], 1);
  assert.deepEqual([...done.deck, ...done.discard, ...done.players.flatMap(p => p.hand)].map(c => c.id).sort(), f.originalTreachery);
  const finished = actDukeAmbassador(done, f.entrantContinuation.actor, f.entrantContinuation.action);
  assert.equal(finished.movementRemaining?.includes(f.entrant) ?? false, false);
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = viewGame(g, f.owner); view.players.find(p => p.id === f.owner)!.bot = difficulty;
    const action = botActions(view)[0]; assert.equal(action.leader, DUKE_VIDAL_ID);
    const revived = actDukeAmbassador(g, f.owner, action);
    assert.equal(revived.dukeVidal!.leader.dead, false); assert.equal(revived.dukeVidal!.controller, null);
    assert.equal(revived.pendingAmbassador, null); assert.deepEqual(balances(revived), balances(g));
  }
});
