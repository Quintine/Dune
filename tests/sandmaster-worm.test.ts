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
void test('optional decline and legacy actions keep ordinary worm riding available with or without spice', () => {
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
});
void test('a selected destination pile supplies only one spice in Basic and Advanced worm rides', () => {
  for (const advanced of [false, true]) for (const key of ['pasty_mesa:5', 'pasty_mesa:6']) {
    const g = sandmasterWormGame(advanced);
    g.spice = { 'wind_pass:14': 7, 'pasty_mesa:5': 2, 'pasty_mesa:6': 3 };
    const action: Action = { ...sandmasterRide(), territory: 'pasty_mesa', sector: 5, sandmasterPile: key };
    if (!advanced) delete action.eliteForces;
    const next = applyAction(JSON.parse(JSON.stringify(g)), 'p', action);
    assert.equal(next.players[0].spice, 6);
    assert.equal(next.spice[key], g.spice[key] - 1);
    const other = key === 'pasty_mesa:5' ? 'pasty_mesa:6' : 'pasty_mesa:5';
    assert.equal(next.spice[other], g.spice[other]);
    assert.equal(next.spice['wind_pass:14'], 7);
    assert.equal(next.players[0].forces['pasty_mesa:5'], 4);
    if (advanced) assert.equal(next.players[0].elites!.forces['pasty_mesa:5'], 2);
    assert.equal(next.players[0].moved, 1);
    assert.equal(next.log.filter(l => l.automatic?.name === 'Sandmaster collection').length, 1);
    conserved(next);
  }
});
void test('ambiguous collection needs an exact positive destination pile, but decline still rides', () => {
  const g = sandmasterWormGame();
  g.spice = { 'wind_pass:14': 7, 'pasty_mesa:5': 2, 'pasty_mesa:6': 3 };
  const action: Action = { ...sandmasterRide(), territory: 'pasty_mesa', sector: 5 };
  delete action.eliteForces;
  reject(g, action);
  for (const key of ['wind_pass:14', 'pasty_mesa:9', '', 6])
    reject(g, { ...action, sandmasterPile: key });
  const emptied = structuredClone(g); emptied.spice['pasty_mesa:6'] = 0;
  reject(emptied, { ...action, sandmasterPile: 'pasty_mesa:6' });
  const next = applyAction(g, 'p', { ...action, sandmasterCollect: false });
  assert.equal(next.players[0].spice, 5);
  assert.deepEqual(next.spice, g.spice);
  assert.equal(next.players[0].forces['pasty_mesa:5'], 4);
  conserved(next);
});
void test('destination quoting requires current native ride ownership and phase even with a selected pile', () => {
  const g = sandmasterWormGame();
  g.spice = { 'pasty_mesa:5': 2, 'pasty_mesa:6': 3 };
  assert.equal(sandmasterWormCollection(g, 'p', 'pasty_mesa', 5, null, 'pasty_mesa:6'), null);
  assert.equal(sandmasterWormCollection(g, 'p', 'pasty_mesa', 5,
    { kind: 'wormRide', player: 'h', territory: 'wind_pass' }, 'pasty_mesa:6'), null);
  const wrongPhase = structuredClone(g); wrongPhase.phase = 5;
  assert.equal(sandmasterWormCollection(wrongPhase, 'p', 'pasty_mesa', 5, g.decision, 'pasty_mesa:6'), null);
  const nonNative = structuredClone(g); nonNative.players[0].faction = 'guild';
  assert.equal(sandmasterWormCollection(nonNative, 'p', 'pasty_mesa', 5, g.decision, 'pasty_mesa:6'), null);
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
    (g: typeof view) => { g.players[0].leaders.find(l => l.id === g.leaderSkills!.assignments.find(a => a.owner === 'p')!.leader)!.capturedBy = 'h'; },
    (g: typeof view) => { g.players[0].leaders.find(l => l.id === g.leaderSkills!.assignments.find(a => a.owner === 'p')!.leader)!.gholaBy = 'h'; },
  ]) {
    const bad = structuredClone(view); mutate(bad);
    assert.equal(sandmasterWormCollection(bad, 'p', 'red_chasm', 7), null);
  }
  for (const mutate of [
    (g: typeof view) => { g.ecazTreachery = true; },
    (g: typeof view) => { g.players[1].faction = 'richese'; },
  ]) {
    const unsupported = structuredClone(view); mutate(unsupported);
    const quote = sandmasterWormCollection(unsupported, 'p', 'red_chasm', 7)!;
    assert.ok(quote.blocked);
    assert.deepEqual(quote.piles, []);
  }
});
void test('collection is committed before an interrupted BG arrival and is not repeated after JSON restoration', () => {
  for (const multiple of [false, true]) {
    const g = sandmasterWormGame(true, true);
    const action = sandmasterRide();
    if (multiple) {
      g.spice = { 'wind_pass:14': 7, 'pasty_mesa:5': 3, 'pasty_mesa:6': 1 };
      g.players[1].forces = { 'pasty_mesa:5': 1 };
      Object.assign(action, { territory: 'pasty_mesa', sector: 5, sandmasterPile: 'pasty_mesa:6' });
    } else g.spice['red_chasm:7'] = 1;
    const key = multiple ? 'pasty_mesa:6' : 'red_chasm:7';
    const pending = applyAction(g, 'p', action);
    assert.equal(pending.decision?.kind, 'intrusion');
    assert.equal(pending.players[0].spice, 6);
    assert.equal(pending.spice[key], 0);
    if (multiple) assert.equal(pending.spice['pasty_mesa:5'], 3);
    const restored = normalizeAutomaticGame(JSON.parse(JSON.stringify(pending)));
    assert.deepEqual(restored, pending);
    const done = applyAction(restored, 'h', { type: 'decision', accept: false });
    assert.equal(done.players[0].spice, 6);
    assert.equal(done.spice[key], 0);
    if (multiple) assert.equal(done.spice['pasty_mesa:5'], 3);
    assert.equal(done.log.filter(l => l.automatic?.name === 'Sandmaster collection').length, 1);
    assert.equal(done.players[0].moved, 1);
    conserved(done);
  }
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
