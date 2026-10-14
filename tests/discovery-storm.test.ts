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
  createDiscoveryStorm,
  createStormSource,
  discoveryStormDistance,
  discoveryStormOffer,
  discoveryStormSignature,
} from '../game/discovery-storm';
import { fighterCount } from '../game/advisors';
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
      g = confirmDiscoveryStorm(reload(g));
      assert.equal(g.ecologicalStorm, undefined);
      assert.equal(g.storm, 6 + amount);
      assert.equal(g.discard.filter((c) => c.id === card.id).length, 1);
    }
});
void test('unoccupied and legacy unknown-source storms continue without inventing entitlement or changing distance', () => {
  for (const mode of ['empty', 'legacy']) {
    let g = discoveryStormFixture();
    if (mode === 'empty') {
      g.players[0].reserves +=
        g.players[0].forces['ecological-testing-station:0'];
      delete g.players[0].forces['ecological-testing-station:0'];
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

const stationKey = 'ecological-testing-station:0';
/** A second distinct non-advisor occupant beside the actual entrant. */
function contest(g: Game, second = 'g'): Game {
  const player = g.players.find((candidate) => candidate.id === second)!;
  player.reserves -= 2;
  player.forces[stationKey] = (player.forces[stationKey] ?? 0) + 2;
  return g;
}
const occupants = (g: Game) =>
  g.order.filter((id) => {
    const player = g.players.find((candidate) => candidate.id === id)!;
    return fighterCount(player, 'ecological-testing-station') > 0;
  });
const control = (g: Game, id: string, delta: number) => {
  const action = discoveryStormActions(viewGame(g, id)).find(
    (candidate) => candidate.delta === delta,
  );
  assert.ok(action, `${id} must receive a legal ${delta} station control.`);
  return action;
};

void test('two original non-advisor occupants each choose once in original storm order with one cumulative traversal', () => {
  let g = confirmDiscoveryStorm(contest(discoveryStormFixture()));
  const before = reload(g);
  const order = occupants(g);
  assert.equal(order.length, 2);
  assert.notEqual(order[0], order[1]);
  assert.equal(g.decision?.kind, 'ecologicalStorm');
  assert.equal(g.decision?.player, order[0]);
  assert.equal(g.ecologicalStorm?.owner, order[0]);
  assert.deepEqual(g.ecologicalStorm?.queue, { order, choices: [] });
  assert.equal(g.storm, 6);
  const event = g.decision!.event;
  assert.equal(viewGame(g, order[0]).ecologicalStorm?.base, 2);
  assert.equal(viewGame(g, order[1]).ecologicalStorm, null);
  assert.deepEqual(discoveryStormActions(viewGame(g, order[1])), []);
  reject(g, order[1], control(g, order[0], 1));
  reject(g, order[0], { ...control(g, order[0], 1), event: `${event}:1` });
  reject(g, order[0], { ...control(g, order[0], 1), distance: 1 });
  for (const delta of [-2, 2, 0.5, NaN])
    reject(g, order[0], { ...control(g, order[0], 0), delta });
  assert.deepEqual(g, before);
  g = applyAction(reload(g), order[0], control(g, order[0], 1));
  assert.equal(g.ecologicalStorm?.stage, 'choose');
  assert.equal(g.ecologicalStorm?.owner, order[1]);
  assert.equal(g.decision?.player, order[1]);
  assert.ok(g.decision?.kind === 'ecologicalStorm');
  assert.equal(g.decision?.event, `${event}:1`);
  assert.equal(discoveryStormDistance(g.ecologicalStorm!), 3);
  assert.equal(g.stormPending, 3);
  assert.equal(g.storm, 6);
  assert.equal(g.phase, 0);
  assert.deepEqual(normalizeAutomaticGame(reload(g)), g);
  reject(g, order[0], control(before, order[0], 1));
  reject(g, order[1], { ...control(g, order[1], 0), event });
  const second = viewGame(g, order[1]).ecologicalStorm!;
  assert.deepEqual(second.options.map((option) => option.distance), [2, 3, 4]);
  assert.equal(viewGame(g, order[0]).ecologicalStorm, null);
  g = applyAction(reload(g), order[1], control(g, order[1], -1));
  assert.equal(g.ecologicalStorm?.stage, 'complete');
  assert.deepEqual(g.ecologicalStorm?.queue?.choices, [
    { owner: order[0], delta: 1 },
    { owner: order[1], delta: -1 },
  ]);
  assert.equal(g.storm, 8);
  assert.equal(g.phase, 1);
  assert.equal(g.stormMovementSource, undefined);
  assert.equal(g.stormResolution, null);
  assert.deepEqual(normalizeAutomaticGame(reload(g)), g);
  reject(g, order[1], { type: 'decision', event: `${event}:1`, delta: 0 });
  reject(g, order[0], { type: 'decision', event, delta: 1 });
});

void test('a contested station shares one cumulative bound: two decreases reach zero and opposite choices cancel', () => {
  let g = contest(discoveryStormFixture());
  g.stormPending = 3;
  g.stormMovementSource = createStormSource(g.turn, 'dials', 3);
  g = confirmDiscoveryStorm(g);
  const order = occupants(g);
  let floored = applyAction(reload(g), order[0], control(g, order[0], -1));
  assert.equal(discoveryStormDistance(floored.ecologicalStorm!), 2);
  assert.deepEqual(
    discoveryStormOffer(floored, floored.ecologicalStorm!)!.options.map(
      (option) => option.distance,
    ),
    [1, 2, 3],
  );
  floored = applyAction(reload(floored), order[1], control(floored, order[1], -1));
  assert.equal(discoveryStormDistance(floored.ecologicalStorm!), 1);
  const single = contest(discoveryStormFixture());
  single.stormPending = 1;
  single.stormMovementSource = createStormSource(single.turn, 'dials', 1);
  let one = confirmDiscoveryStorm(single);
  const oneOrder = occupants(one);
  one = applyAction(reload(one), oneOrder[0], control(one, oneOrder[0], -1));
  assert.deepEqual(
    discoveryStormOffer(one, one.ecologicalStorm!)!.options.map(
      (option) => option.delta,
    ),
    [0, 1],
  );
  reject(one, oneOrder[1], {
    type: 'decision',
    event: one.ecologicalStorm!.event,
    delta: -1,
  });
  one = applyAction(reload(one), oneOrder[1], control(one, oneOrder[1], 0));
  assert.equal(discoveryStormDistance(one.ecologicalStorm!), 0);
  assert.equal(one.storm, 6);
  assert.equal(one.phase, 1);
  const ceiling = contest(discoveryStormFixture());
  ceiling.storm = 6;
  ceiling.stormPending = 40;
  ceiling.stormMovementSource = createStormSource(ceiling.turn, 'dials', 40);
  let high = confirmDiscoveryStorm(ceiling);
  const highOrder = occupants(high);
  assert.deepEqual(
    discoveryStormOffer(high, high.ecologicalStorm!)!.options.map(
      (option) => option.delta,
    ),
    [-1, 0],
  );
  reject(high, highOrder[0], {
    type: 'decision',
    event: high.ecologicalStorm!.event,
    delta: 1,
  });
  high = applyAction(reload(high), highOrder[0], control(high, highOrder[0], -1));
  assert.equal(discoveryStormDistance(high.ecologicalStorm!), 39);
  high = applyAction(reload(high), highOrder[1], control(high, highOrder[1], 1));
  assert.equal(discoveryStormDistance(high.ecologicalStorm!), 40);
  assert.equal(high.storm, ((6 - 1 + 40) % 18) + 1);
});

void test('a lone Bene Gesserit advisor group is not a station occupant and never receives a contested choice', () => {
  const g = contest(discoveryStormFixture());
  const advisor = g.players[1];
  advisor.faction = 'beneGesserit';
  advisor.advisors = { 'ecological-testing-station': {} };
  assert.equal(occupants(g).includes(advisor.id), false);
  assert.deepEqual(occupants(g), [g.players[0].id]);
  const frame = createDiscoveryStorm(g, 'advisor-exclusion');
  assert.equal(frame.queue, undefined);
  assert.equal(frame.owner, g.players[0].id);
  assert.equal(discoveryStormOffer(g, frame)!.owner, g.players[0].id);
});

void test('Weather Control denies every occupant of a contested station', () => {
  for (const advanced of [false, true]) {
    let g = contest(discoveryStormFixture(advanced));
    const card = holdStormCard(g, 'a', 'weather');
    g = applyAction(g, 'g', { type: 'ready' });
    g = applyAction(g, 'a', { type: 'card', card: card.id, amount: 2 });
    assert.equal(g.stormMovementSource?.kind, 'weather');
    assert.equal(discoveryStormActions(viewGame(g, occupants(g)[0])).length, 0);
    g = confirmDiscoveryStorm(reload(g));
    assert.equal(g.ecologicalStorm, undefined);
    assert.equal(g.storm, 8);
  }
});

void test('every AI level submits the second occupant’s remaining cumulative choice', () => {
  const g = confirmDiscoveryStorm(contest(discoveryStormFixture(true)));
  const order = occupants(g);
  const committed = applyAction(
    reload(g),
    order[0],
    control(g, order[0], 0),
  );
  for (const level of DIFFICULTIES) {
    const view = viewGame(committed, order[1]);
    view.players.find((player) => player.id === order[1])!.bot = level;
    const actions = botActions(view);
    assert.ok(actions.length);
    for (const action of actions)
      assert.doesNotThrow(() => applyAction(reload(committed), order[1], action));
  }
  assert.equal(committed.decision?.player, order[1]);
  assert.equal(discoveryStormDistance(committed.ecologicalStorm!), 2);
});
