import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  normalizeAutomaticGame,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { discoveryStormActions } from '../game/discovery-storm-options';
import {
  createStormSource,
  discoveryStormOffer,
  discoveryStormSignature,
} from '../game/discovery-storm';
import {
  discoveryStormFixture,
  confirmDiscoveryStorm,
  holdStormCard,
} from './fixture-discovery-storm';

const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function reject(g: Game, owner: string, action: Action) {
  const before = reload(g);
  assert.throws(() => applyAction(g, owner, action));
  assert.deepEqual(g, before);
}
for (const advanced of [false, true])
  for (const delta of [-1, 0, 1]) {
    void test(`Ecological Testing Station changes genuine ${advanced ? 'Advanced card' : 'Basic dial'} movement by ${delta} after the storm window`, () => {
      let g = discoveryStormFixture(advanced);
      assert.equal(g.ecologicalStorm, undefined);
      assert.equal(g.stormMovementSource?.kind, advanced ? 'card' : 'dials');
      g = confirmDiscoveryStorm(g);
      assert.equal(g.decision?.kind, 'ecologicalStorm');
      assert.equal(g.storm, 6);
      assert.deepEqual(normalizeAutomaticGame(reload(g)), g);
      const action = discoveryStormActions(viewGame(g, 'a')).find(
        (a) => a.delta === delta,
      )!;
      const before = reload(g);
      g = applyAction(reload(g), 'a', action);
      assert.deepEqual(
        before.players.map((p) => p.hand),
        g.players.map((p) => p.hand),
      );
      assert.equal(g.storm, 8 + delta);
      assert.equal(g.phase, 1);
      assert.equal(g.ecologicalStorm?.stage, 'complete');
      assert.equal(g.stormMovementSource, undefined);
      assert.equal(g.stormResolution, null);
      assert.deepEqual(normalizeAutomaticGame(reload(g)), g);
      reject(g, 'a', action);
    });
  }
void test('station choice is private to its current sole fighter occupant; wrong owner, stale event and injected distance are immutable rejections', () => {
  const g = confirmDiscoveryStorm(discoveryStormFixture()),
    before = reload(g);
  assert.equal(viewGame(g, 'g').ecologicalStorm, null);
  assert.deepEqual(discoveryStormActions(viewGame(g, 'g')), []);
  const v = viewGame(g, 'a'),
    action = discoveryStormActions(v)[0];
  v.ecologicalStorm!.options[0].distance = 999;
  assert.deepEqual(g, before);
  reject(g, 'g', action);
  reject(g, 'a', { ...action, event: 'stale' });
  for (const delta of [-2, 2, 0.5, NaN]) reject(g, 'a', { ...action, delta });
  reject(g, 'a', { ...action, distance: 10 });
  reject(g, 'a', { type: 'ready' });
});
void test('all four AI levels select a legal owned station choice', () => {
  const g = confirmDiscoveryStorm(discoveryStormFixture(true));
  for (const level of DIFFICULTIES) {
    const v = viewGame(g, 'a');
    v.players[0].bot = level;
    const actions = botActions(v);
    assert.ok(actions.length);
    for (const action of actions)
      assert.doesNotThrow(() => applyAction(g, 'a', action));
  }
});
void test('Weather Control replaces natural provenance and bypasses the station, including zero movement', () => {
  for (const advanced of [false, true])
    for (const amount of [0, 3]) {
      let g = discoveryStormFixture(advanced);
      const card = holdStormCard(g, 'a', 'weather');
      g = applyAction(g, 'g', { type: 'ready' });
      g = applyAction(g, 'a', { type: 'card', card: card.id, amount });
      assert.equal(g.stormMovementSource?.kind, 'weather');
      assert.deepEqual(g.ready, []);
      assert.match(discoveryStormOffer(g)!.blocked!, /Weather Control/);
      g = confirmDiscoveryStorm(reload(g));
      assert.equal(g.ecologicalStorm, undefined);
      assert.equal(g.storm, 6 + amount);
      assert.equal(g.discard.filter((c) => c.id === card.id).length, 1);
    }
});
void test('unoccupied, contested and legacy unknown-source storms continue without inventing entitlement or changing distance', () => {
  for (const mode of ['empty', 'contested', 'legacy']) {
    let g = discoveryStormFixture();
    if (mode === 'empty') {
      g.players[0].reserves +=
        g.players[0].forces['ecological-testing-station:0'];
      delete g.players[0].forces['ecological-testing-station:0'];
    }
    if (mode === 'contested') {
      g.players[1].reserves--;
      g.players[1].forces['ecological-testing-station:0'] = 1;
    }
    if (mode === 'legacy') delete g.stormMovementSource;
    g = confirmDiscoveryStorm(g);
    assert.equal(g.ecologicalStorm, undefined);
    assert.equal(g.storm, 8);
  }
});
void test('station can reduce a one-sector natural storm to zero and never offers a negative distance', () => {
  let g = discoveryStormFixture(true);
  g.stormPending = 1;
  g.stormMovementSource = createStormSource(g.turn, 'card', 1);
  g = confirmDiscoveryStorm(g);
  g = applyAction(g, 'a', {
    type: 'decision',
    event: g.ecologicalStorm!.event,
    delta: -1,
  });
  assert.equal(g.storm, 6);
  assert.equal(g.phase, 1);
  const source = discoveryStormFixture();
  source.stormPending = 0;
  source.stormMovementSource = createStormSource(source.turn, 'dials', 0);
  assert.deepEqual(
    discoveryStormOffer(source)!.options.map((o) => o.delta),
    [0, 1],
  );
});
void test('orphaned station choices, rewritten Weather sources and mismatched traversal receipts fail closed on reads and normalization', () => {
  const original = confirmDiscoveryStorm(discoveryStormFixture());
  for (const mutate of [
    (g: Game) => {
      delete g.ecologicalStorm;
    },
    (g: Game) => {
      g.decision = null;
    },
    (g: Game) => {
      g.ecologicalStorm!.owner = 'g';
      g.ecologicalStorm!.signature = discoveryStormSignature(
        g.ecologicalStorm!,
      );
    },
    (g: Game) => {
      g.stormMovementSource = createStormSource(g.turn, 'weather', 2);
    },
    (g: Game) => {
      g.stormPending = 3;
    },
  ]) {
    const g = reload(original);
    mutate(g);
    const before = reload(g);
    assert.throws(() => viewGame(g, 'a'));
    assert.throws(() => normalizeAutomaticGame(g));
    assert.deepEqual(g, before);
  }
});
void test('adjusted Advanced storm retains its receipt through Fremen protection and typed loss continuation', () => {
  let g = discoveryStormFixture(true);
  const f = g.players[2];
  f.reserves -= 3;
  f.forces['red_chasm:7'] = 3;
  f.elites!.reserves--;
  f.elites!.forces['red_chasm:7'] = 1;
  holdStormCard(g, 'g', 'karama');
  g = confirmDiscoveryStorm(g);
  g = applyAction(g, 'a', {
    type: 'decision',
    event: g.ecologicalStorm!.event,
    delta: 1,
  });
  assert.equal(g.response?.kind, 'stormProtection');
  assert.equal(g.ecologicalStorm!.stage, 'traversal');
  assert.equal(g.stormResolution!.discoveryStorm, g.ecologicalStorm!.signature);
  assert.deepEqual(normalizeAutomaticGame(reload(g)), g);
  const corrupt = reload(g);
  delete corrupt.stormResolution!.discoveryStorm;
  assert.throws(() => viewGame(corrupt, 'f'));
  for (let step = 0; g.response?.kind === 'stormProtection'; step++) {
    assert.ok(step < 10);
    const owner = g.players.find((p) => !g.response!.passed.includes(p.id))!.id;
    g = applyAction(reload(g), owner, { type: 'passResponse' });
  }
  assert.equal(g.decision?.kind, 'stormLosses');
  g = applyAction(reload(g), 'f', { type: 'decision', elite: 1 });
  assert.equal(g.players[2].forces['red_chasm:7'], 1);
  assert.equal(g.players[2].elites!.forces['red_chasm:7'] ?? 0, 0);
  assert.equal(g.ecologicalStorm?.stage, 'complete');
  assert.equal(g.storm, 9);
});
