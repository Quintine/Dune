import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { discoveryStormActions } from '../game/discovery-storm-options';
import { discoveryStormDistance, discoveryStormOffer } from '../game/discovery-storm';
import { fighterCount } from '../game/advisors';
import { stormSectorAfter } from '../game/disaster-rules';
import {
  advanceTestingStationContest,
  createTestingStationContestFixture,
  holdTestingStationStormCard,
  testingStationOccupants,
  testingStationStormOrder,
} from './fixture-testing-station-contest';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game));
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
/** Normalization must accept the signed queue and stay stable afterwards. */
function normalized(game: Game): Game {
  const once = normalizeAutomaticGame(reload(game));
  assert.deepEqual(normalizeAutomaticGame(reload(once)), once);
  return once;
}
const controls = (game: Game, actor: string) =>
  discoveryStormActions(viewGame(game, actor));
const chosen = (game: Game, actor: string, delta: number) => {
  const action = controls(game, actor).find((candidate) => candidate.delta === delta);
  assert.ok(action, `${actor} must receive the real ${delta} station control.`);
  return action;
};
const at = (game: Game, actor: string) =>
  game.players.find((player) => player.id === actor)!;

void test('two real occupants of the revealed station each choose once in original storm order through the ordinary controls', () => {
  const fixture = createTestingStationContestFixture();
  const g = fixture.game,
    source = g.stormMovementSource!;
  assert.equal(g.status, 'playing');
  assert.equal(g.turn, 3);
  assert.equal(g.phase, 0);
  assert.notEqual(source.kind, 'weather');
  assert.equal(source.turn, 3);
  assert.equal(source.distance, g.stormPending);
  assert.deepEqual(fixture.source, {
    turn: source.turn,
    kind: source.kind,
    distance: source.distance,
  });
  const token = g.discoveries!.tokens.find(
    (candidate) => candidate.id === fixture.token,
  )!;
  assert.equal(token.face, 'ecological-testing-station');
  assert.equal(token.status, 'placed');
  assert.equal(token.revealedTurn, 1);
  assert.deepEqual([token.territory, token.sector], [fixture.parent, fixture.parentSector]);
  assert.deepEqual(testingStationOccupants(g), fixture.order);
  assert.deepEqual(fixture.order, testingStationStormOrder(g, fixture.order));
  assert.equal(fixture.order.length, 2);
  for (const id of fixture.order)
    assert.ok(fighterCount(at(g, id), 'ecological-testing-station') > 0);
  assert.equal(g.decision!.player, fixture.owner);
  assert.equal(g.ecologicalStorm!.queue!.order.join(','), fixture.order.join(','));
  assert.deepEqual(g.ecologicalStorm!.queue!.choices, []);
  // Privacy: only the current occupant receives the projected offer.
  assert.equal(viewGame(g, fixture.owner).ecologicalStorm!.owner, fixture.owner);
  assert.equal(viewGame(g, fixture.second).ecologicalStorm, null);
  assert.deepEqual(controls(g, fixture.second), []);
  for (const player of g.players)
    if (!fixture.order.includes(player.id))
      assert.equal(viewGame(g, player.id).ecologicalStorm, null);
  const pending = normalized(g);
  assert.deepEqual(pending.ecologicalStorm?.queue?.order, fixture.order);
  assert.equal(pending.decision?.player, fixture.owner);

  const afterFirst = applyAction(reload(g), fixture.owner, chosen(g, fixture.owner, 1));
  assert.equal(afterFirst.ecologicalStorm!.stage, 'choose');
  assert.equal(afterFirst.decision!.player, fixture.second);
  assert.ok(afterFirst.decision?.kind === 'ecologicalStorm');
  assert.equal(afterFirst.decision!.event, `${fixture.event}:1`);
  assert.equal(afterFirst.ecologicalStorm!.owner, fixture.second);
  assert.deepEqual(afterFirst.ecologicalStorm!.queue!.choices, [
    { owner: fixture.owner, delta: 1 },
  ]);
  assert.equal(discoveryStormDistance(afterFirst.ecologicalStorm!), source.distance + 1);
  assert.equal(afterFirst.stormPending, source.distance + 1);
  assert.equal(afterFirst.storm, g.storm);
  assert.equal(afterFirst.phase, 0);
  assert.equal(afterFirst.stormResolution, null);
  const queued = normalized(afterFirst);
  assert.equal(queued.ecologicalStorm?.owner, fixture.second);
  assert.equal(queued.stormPending, source.distance + 1);

  const done = applyAction(reload(afterFirst), fixture.second, chosen(afterFirst, fixture.second, -1));
  assert.equal(done.ecologicalStorm!.stage, 'complete');
  assert.deepEqual(done.ecologicalStorm!.queue!.choices, [
    { owner: fixture.owner, delta: 1 },
    { owner: fixture.second, delta: -1 },
  ]);
  assert.equal(discoveryStormDistance(done.ecologicalStorm!), source.distance);
  assert.equal(done.storm, stormSectorAfter(g.storm, source.distance));
  assert.equal(done.phase, 1);
  assert.equal(done.stormMovementSource, undefined);
  assert.equal(done.stormResolution, null);
  const settled = normalized(done);
  assert.equal(settled.ecologicalStorm?.stage, 'complete');
  assert.equal(settled.storm, stormSectorAfter(g.storm, source.distance));
  // The committed queue cannot be replayed by either original occupant.
  reject(done, fixture.owner, chosen(g, fixture.owner, 1));
  reject(done, fixture.second, chosen(afterFirst, fixture.second, -1));
});

void test('the same native two-occupant proof holds for the Advanced revealed Storm Card source', () => {
  const fixture = createTestingStationContestFixture({ advanced: true });
  const g = fixture.game;
  assert.equal(g.stormMovementSource?.kind, 'card');
  assert.equal(fixture.source.kind, 'card');
  assert.equal(fixture.source.turn, 3);
  assert.equal(g.stormPending, fixture.source.distance);
  assert.deepEqual(testingStationOccupants(g), fixture.order);
  assert.deepEqual(fixture.order, testingStationStormOrder(g, fixture.order));
  assert.equal(g.ecologicalStorm!.queue!.order.join(','), fixture.order.join(','));
  assert.equal(g.ecologicalStorm!.base, fixture.source.distance);
  assert.equal(viewGame(g, fixture.second).ecologicalStorm, null);
  const first = applyAction(reload(g), fixture.owner, chosen(g, fixture.owner, 1));
  assert.equal(first.storm, g.storm);
  assert.equal(first.phase, 0);
  assert.equal(first.decision!.player, fixture.second);
  assert.equal(first.stormPending, fixture.source.distance + 1);
  const done = applyAction(reload(first), fixture.second, chosen(first, fixture.second, -1));
  assert.equal(done.ecologicalStorm!.stage, 'complete');
  assert.equal(done.storm, stormSectorAfter(g.storm, fixture.source.distance));
  assert.equal(done.phase, 1);
});


void test('one shared cumulative bound: two real decreases reach zero while opposite choices cancel to the ordinary distance', () => {
  const fixture = createTestingStationContestFixture();
  const base = fixture.game,
    [first, second] = fixture.order,
    pending = base.stormPending!;
  const decrease = applyAction(reload(base), first, chosen(base, first, -1));
  assert.equal(discoveryStormDistance(decrease.ecologicalStorm!), pending - 1);
  const remaining = controls(decrease, second)
    .map((action) => action.delta as number)
    .sort((a, b) => a - b);
  assert.deepEqual(remaining, pending - 1 > 0 ? [-1, 0, 1] : [0, 1]);
  const floor = applyAction(
    reload(decrease),
    second,
    chosen(decrease, second, pending - 1 > 0 ? -1 : 0),
  );
  assert.equal(
    discoveryStormDistance(floor.ecologicalStorm!),
    Math.max(0, pending - 2),
  );
  assert.equal(floor.storm, stormSectorAfter(base.storm, Math.max(0, pending - 2)));
  assert.equal(floor.phase, 1);
  if (pending - 1 === 0) {
    reject(decrease, second, { type: 'decision', event: decrease.ecologicalStorm!.event, delta: -1 });
    assert.deepEqual(
      discoveryStormOffer(decrease, decrease.ecologicalStorm!)!.options.map(
        (option) => option.distance,
      ),
      [0, 1],
    );
  }
  const up = applyAction(reload(base), first, chosen(base, first, 1));
  const cancel = applyAction(
    reload(up),
    second,
    chosen(up, second, -1),
  );
  assert.equal(discoveryStormDistance(cancel.ecologicalStorm!), pending);
  assert.equal(cancel.storm, stormSectorAfter(base.storm, pending));
});

void test('wrong owner, stale event, injected fields and replayed choices fail closed on the signed queue', () => {
  const fixture = createTestingStationContestFixture();
  const base = fixture.game,
    [first, second] = fixture.order;
  const firstAction = chosen(base, first, 1);
  reject(base, second, firstAction);
  reject(base, first, { ...firstAction, event: `${fixture.event}:1` });
  reject(base, first, { ...firstAction, distance: 1 });
  for (const delta of [-2, 2, 0.5, NaN]) reject(base, first, { ...firstAction, delta });
  const committed = applyAction(reload(base), first, firstAction);
  reject(committed, first, firstAction);
  reject(committed, second, firstAction);
  const secondAction = chosen(committed, second, 0);
  reject(committed, first, secondAction);
  const done = applyAction(reload(committed), second, secondAction);
  assert.equal(done.ecologicalStorm!.stage, 'complete');
  reject(done, second, secondAction);
});

void test('a real Weather Control play replaces the ordinary source and denies both occupants any station change', () => {
  const fixture = createTestingStationContestFixture();
  const [first] = fixture.order,
    before = fixture.beforeStorm;
  assert.equal(before.stormPending, null);
  let g = structuredClone(before);
  const holder = g.players.find((player) => player.id !== first)!.id;
  const card = holdTestingStationStormCard(g, first, 'weather');
  g = advanceTestingStationContest(
    g,
    (state) =>
      state.phase === 0 &&
      state.stormPending !== null &&
      state.stormMovementSource?.kind === 'dials',
  );
  // One ordinary ready opens the storm-card window; only the real card play follows.
  g = applyAction(g, holder, { type: 'ready' });
  g = applyAction(g, first, { type: 'card', card: card.id, amount: 2 });
  assert.equal(g.stormMovementSource?.kind, 'weather');
  assert.equal(g.stormPending, 2);
  assert.equal(
    viewGame(g, first).ecologicalStorm,
    null,
    'Weather Control must deny the current occupant its station choice.',
  );
  assert.equal(viewGame(g,fixture.second).ecologicalStorm,null);
  g = advanceTestingStationContest(g, (state) => state.phase === 1);
  assert.equal(g.storm, stormSectorAfter(before.storm, 2));
  assert.equal(g.decision, null);
  assert.equal(fighterCount(at(g, fixture.second), 'ecological-testing-station'),
    fighterCount(at(before, fixture.second), 'ecological-testing-station'));
  assert.equal(g.discard.filter((candidate) => candidate.id === card.id).length, 1);
});
