import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, normalizeAutomaticGame, viewGame, type Game, type Action } from '../game/engine';
import { sandmasterWormCollection } from '../game/sandmaster-worm';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { sandmasterWormGame, sandmasterRide } from './fixture-sandmaster-worm';

function reject(g: Game, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, 'p', action));
  assert.deepEqual(g, before);
}
function conserved(g: Game) {
  for (const p of g.players) {
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((s, n) => s + n, 0), 20);
    if (p.elites) assert.equal(p.elites.reserves + p.elites.tanks + Object.values(p.elites.forces).reduce((s, n) => s + n, 0), 3);
  }
}
void test('Sandmaster collects once at a worm destination for multiple source sectors and preserves normal movement', () => {
  for (const advanced of [false, true]) {
    const g = sandmasterWormGame(advanced);
    const action = sandmasterRide();
    if (!advanced) delete action.eliteForces;
    const next = applyAction(JSON.parse(JSON.stringify(g)), 'p', action);
    assert.equal(next.players[0].spice, 6);
    assert.equal(next.spice['red_chasm:7'], 1);
    assert.equal(next.spice['wind_pass:14'], 7);
    assert.equal(next.players[0].forces['red_chasm:7'], 4);
    assert.equal(next.players[0].moved, 1);
    if (advanced) assert.equal(next.players[0].elites!.forces['red_chasm:7'], 2);
    assert.equal(next.log.filter(l => l.automatic?.name === 'Sandmaster collection').length, 1);
    conserved(next);
    for (const p of next.players) assert.deepEqual(viewGame(next, p.id), viewGame(JSON.parse(JSON.stringify(next)), p.id));
    assert.equal(viewGame(next, 'h').players[0].spice, undefined);
    reject(next, action);
  }
});
void test('optional decline, legacy actions and absent or ambiguous piles keep ordinary worm riding available', () => {
  for (const amount of [0, 1, 2]) for (const collect of [false, undefined]) {
    const g = sandmasterWormGame();
    g.spice['red_chasm:7'] = amount;
    const action = sandmasterRide(false); delete action.eliteForces;
    if (collect === undefined) delete action.sandmasterCollect;
    const next = applyAction(g, 'p', action);
    assert.equal(next.players[0].spice, 5);
    assert.equal(next.spice['red_chasm:7'], amount);
    assert.equal(next.players[0].forces['red_chasm:7'], 4);
  }
  const empty = sandmasterWormGame(); empty.spice['red_chasm:7'] = 0;
  assert.match(sandmasterWormCollection(empty, 'p', 'red_chasm', 7)!.blocked!, /no spice/);
  reject(empty, sandmasterRide());
  const multiple = sandmasterWormGame();
  multiple.spice = { 'pasty_mesa:5': 2, 'pasty_mesa:6': 3 };
  const ambiguous: Action = { ...sandmasterRide(), territory: 'pasty_mesa', sector: 5 };
  assert.match(sandmasterWormCollection(multiple, 'p', 'pasty_mesa', 5)!.blocked!, /multiple spice piles/);
  reject(multiple, ambiguous);
  delete ambiguous.eliteForces;
  const next = applyAction(multiple, 'p', { ...ambiguous, sandmasterCollect: false });
  assert.equal(next.players[0].spice, 5);
});
void test('failed force selection, storm entry and collecting without a ride cannot debit spice', () => {
  const g = sandmasterWormGame(true);
  for (const action of [
    { ...sandmasterRide(), forces: { 'wind_pass:14': 3 } },
    { ...sandmasterRide(), eliteForces: { 'wind_pass:14': 2, 'wind_pass:15': 1 } },
    { ...sandmasterRide(), forces: {} },
    { ...sandmasterRide(), accept: false },
    { ...sandmasterRide(), sandmasterCollect: 'yes' },
    { ...sandmasterRide(), territory: 'wind_pass', sector: 14 },
  ]) reject(g, action);
  const storm = structuredClone(g); storm.storm = 7; reject(storm, sandmasterRide());
});
void test('Sandmaster requires the owned living native trainer and the supported public mode', () => {
  const view = viewGame(sandmasterWormGame(), 'p');
  for (const mutate of [
    (g: typeof view) => { g.leaderSkills!.assignments.find(a => a.owner === 'p')!.faceUp = false; },
    (g: typeof view) => { g.leaderSkills!.assignments.find(a => a.owner === 'p')!.controller = 'h'; },
    (g: typeof view) => { g.players[0].leaders.find(l => l.id === g.leaderSkills!.assignments.find(a => a.owner === 'p')!.leader)!.dead = true; },
  ]) {
    const bad = structuredClone(view); mutate(bad);
    assert.equal(sandmasterWormCollection(bad, 'p', 'red_chasm', 7), null);
  }
  for (const mutate of [
    (g: typeof view) => { g.ecazTreachery = true; },
    (g: typeof view) => { g.players[1].faction = 'richese'; },
  ]) {
    const unsupported = structuredClone(view); mutate(unsupported);
    assert.match(sandmasterWormCollection(unsupported, 'p', 'red_chasm', 7)!.blocked!, /other optional modules/);
  }
});
void test('collection is committed before an interrupted BG arrival and is not repeated after JSON restoration', () => {
  const g = sandmasterWormGame(true, true);
  g.spice['red_chasm:7'] = 1;
  const pending = applyAction(g, 'p', sandmasterRide());
  assert.equal(pending.decision?.kind, 'intrusion');
  assert.equal(pending.players[0].spice, 6);
  assert.equal(pending.spice['red_chasm:7'], 0);
  const restored = normalizeAutomaticGame(JSON.parse(JSON.stringify(pending)));
  assert.deepEqual(restored, pending);
  const done = applyAction(restored, 'h', { type: 'decision', accept: false });
  assert.equal(done.players[0].spice, 6);
  assert.equal(done.log.filter(l => l.automatic?.name === 'Sandmaster collection').length, 1);
  assert.equal(done.players[0].moved, 1);
  conserved(done);
});
void test('all profiles attach collection to legal rides without changing the existing destination policy', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = sandmasterWormGame(true);
    const view = viewGame(g, 'p'); view.players[0].bot = difficulty;
    const actions = botActions(view);
    const collecting = actions.filter(a => a.sandmasterCollect);
    assert.ok(collecting.length, difficulty);
    for (const action of collecting) {
      const next = applyAction(g, 'p', action);
      assert.equal(next.players[0].spice, 6); conserved(next);
    }
    assert.ok(actions.some(a => a.accept === false));
  }
});
void test('separate queued rides each collect once after the previous arrival finishes', () => {
  let g = sandmasterWormGame(true, true);
  g.wormRides = ['wind_pass'];
  const action = { ...sandmasterRide(), forces: { 'wind_pass:14': 1, 'wind_pass:15': 1 } };
  g = applyAction(g, 'p', action);
  assert.equal(g.players[0].spice, 6);
  g = applyAction(JSON.parse(JSON.stringify(g)), 'h', { type: 'decision', accept: false });
  assert.equal(g.decision?.kind, 'wormRide');
  g = applyAction(g, 'p', { ...action, eliteForces: { 'wind_pass:14': 0, 'wind_pass:15': 0 } });
  assert.equal(g.players[0].spice, 7);
  assert.equal(g.spice['red_chasm:7'], 0);
  g = applyAction(JSON.parse(JSON.stringify(g)), 'h', { type: 'decision', accept: false });
  assert.equal(g.log.filter(l => l.automatic?.name === 'Sandmaster collection').length, 2);
  assert.equal(g.players[0].moved, 1); conserved(g);
});
void test('a genuine special-Karama summoned worm resumes through Nexus and collects only on its accepted ride', () => {
  let g = sandmasterWormGame(true);
  g.decision = null; g.nexus = false;
  const index = g.deck.findIndex(c => c.effect === 'karama'); assert.ok(index >= 0);
  const [card] = g.deck.splice(index, 1); g.players[0].hand.push(card);
  g = applyAction(g, 'p', { type: 'card', card: card.id, mode: 'special', territory: 'wind_pass' });
  while (g.response) g = applyAction(g, g.players.find(p => !g.response!.passed.includes(p.id))!.id, { type: 'passResponse' });
  assert.equal(g.players[0].spice, 5);
  for (const p of g.players) if (!g.ready.includes(p.id)) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.decision?.kind, 'wormRide');
  g = applyAction(JSON.parse(JSON.stringify(g)), 'p', sandmasterRide());
  assert.equal(g.players[0].spice, 6);
  assert.equal(g.players[0].moved, 1); conserved(g);
});
