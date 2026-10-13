import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { TERRITORIES, location, splitLocation } from '../game/board';
import { fighterCount } from '../game/advisors';
import {
  quoteSandmasterMovement, sandmasterActionOrder, sandmasterDefaultChoice,
  sandmasterEnteredTerritories, sandmasterShortestRoute, type SandmasterChoice,
} from '../game/sandmaster-movement';
import { createBetrayalSandmasterRoute, sandmasterTrainer } from './fixture-betrayal-sandmaster-route';

function unchanged(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

void test('native Guild Betrayal Sandmaster debits its printed pile once and retains ordinary movement', () => {
  const f = createBetrayalSandmasterRoute();
  const before = sandmasterTrainer(f.game);
  const assignment = f.game.leaderSkills!.assignments.find(skill => skill.owner === before.id)!;
  assert.equal(assignment.skill, 'sandmaster');
  assert.ok(before.leaders.some(leader => leader.id === assignment.leader && !leader.dead));
  assert.ok(f.betrayalPasses > 0);
  const quote = quoteSandmasterMovement(f.game, before.id, f.order, f.choice);
  assert.equal(quote.leader, assignment.leader);
  assert.deepEqual(quote.piles, [{ key: f.printedPile, before: f.printedAmount }]);
  assert.deepEqual(sandmasterEnteredTerritories(quote.routes), [splitLocation(f.printedPile).territory]);

  const ordinary = applyAction(f.game, before.id, f.ordinary);
  const accepted = applyAction(JSON.parse(JSON.stringify(f.game)) as Game, before.id, f.action);
  assert.equal(sandmasterTrainer(accepted).spice, before.spice + 1);
  assert.deepEqual(accepted.spice, { ...f.game.spice, [f.printedPile]: f.printedAmount - 1 });
  assert.deepEqual(sandmasterTrainer(accepted).forces, sandmasterTrainer(ordinary).forces);
  assert.equal(sandmasterTrainer(accepted).forces[f.printedPile], 1);
  assert.equal(sandmasterTrainer(accepted).reserves, before.reserves);
  assert.equal(sandmasterTrainer(accepted).moved, before.moved + 1);
  assert.equal(sandmasterTrainer(accepted).moved, sandmasterTrainer(ordinary).moved);
  assert.equal(fighterCount(sandmasterTrainer(accepted), splitLocation(f.printedPile).territory), 1);
  for (const player of f.game.players.filter(player => player.id !== before.id))
    assert.equal(accepted.players.find(seat => seat.id === player.id)!.spice, player.spice);
  unchanged(accepted, before.id, f.action);

  const declined = applyAction(f.game, before.id, { ...f.ordinary, sandmaster: { ...f.choice, collect: [] } });
  assert.deepEqual(declined.spice, ordinary.spice);
  assert.equal(sandmasterTrainer(declined).spice, sandmasterTrainer(ordinary).spice);
  assert.deepEqual(sandmasterTrainer(declined).forces, sandmasterTrainer(ordinary).forces);
  assert.equal(sandmasterTrainer(declined).moved, sandmasterTrainer(ordinary).moved);
  const continued = applyAction(accepted, before.id, { type: 'endMovement' });
  const originalContinuation = applyAction(ordinary, before.id, { type: 'endMovement' });
  assert.equal(continued.phase, originalContinuation.phase);
  assert.equal(continued.active, originalContinuation.active);
  // endMovement may advance straight through empty Battle to native Collection.
  // Compare with the same original continuation, not with its pre-collection pile.
  assert.equal(sandmasterTrainer(continued).spice, sandmasterTrainer(originalContinuation).spice + 1);
  assert.equal(continued.spice[f.printedPile], originalContinuation.spice[f.printedPile] - 1);
});

void test('native Sandmaster rejects wrong actor, duplicate, invalid and abandoned requests immutably', () => {
  const f = createBetrayalSandmasterRoute();
  unchanged(f.game, 'holder', f.action);
  unchanged(f.game, 'trainer', { ...f.action, sandmaster: { ...f.choice, collect: [f.printedPile, f.printedPile] } });
  unchanged(f.game, 'trainer', { ...f.action, sandmaster: { ...f.choice, routes: {} } });
  unchanged(f.game, 'trainer', { ...f.action, sandmaster: { ...f.choice, collect: ['polar_sink:0'] } });
  const abandoned = applyAction(f.game, 'trainer', { type: 'endMovement' });
  assert.equal(abandoned.spice[f.printedPile], f.printedAmount);
  assert.equal(sandmasterTrainer(abandoned).spice, sandmasterTrainer(f.game).spice);
  assert.deepEqual(sandmasterTrainer(abandoned).forces, sandmasterTrainer(f.game).forces);
  unchanged(abandoned, 'trainer', f.action);
});

void test('a native empty destination offers no Sandmaster pile and keeps the free ground move unchanged', () => {
  const f = createBetrayalSandmasterRoute();
  const empty = TERRITORIES.flatMap(territory => territory.sectors.map(sector => location(territory.id, sector)))
    .find(key => splitLocation(key).territory !== 'polar_sink' &&
      !Object.entries(f.game.spice).some(([pile, amount]) => amount > 0 &&
        splitLocation(pile).territory === splitLocation(key).territory) &&
      sandmasterShortestRoute(f.game, 'trainer', 'polar_sink:0', key, 1));
  assert.ok(empty);
  const destination = splitLocation(empty);
  const action: Action = { ...f.ordinary, territory: destination.territory, sector: destination.sector };
  const choice = sandmasterDefaultChoice(viewGame(f.game, 'trainer'), 'trainer', action);
  assert.ok(choice);
  assert.deepEqual(choice.collect, []);
  const order = sandmasterActionOrder(viewGame(f.game, 'trainer'), 'trainer', action);
  assert.ok(order);
  assert.deepEqual(quoteSandmasterMovement(f.game, 'trainer', order, choice).piles, []);
  const next = applyAction(f.game, 'trainer', { ...action, sandmaster: choice });
  assert.deepEqual(next.spice, f.game.spice);
  assert.equal(sandmasterTrainer(next).spice, sandmasterTrainer(f.game).spice);
  assert.equal(sandmasterTrainer(next).forces[empty], 1);
  assert.equal(sandmasterTrainer(next).moved, sandmasterTrainer(f.game).moved + 1);
  unchanged(f.game, 'trainer', { ...action, sandmaster: { ...choice, collect: [empty] } });
});

void test('all four minimal bot policies propose an actual native collecting Sandmaster move', () => {
  const f = createBetrayalSandmasterRoute();
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = viewGame(f.game, 'trainer');
    view.players.find(player => player.id === 'trainer')!.autopilot = difficulty;
    const action = botActions(view).find(candidate => candidate.type === 'move' && candidate.sandmaster);
    assert.ok(action, difficulty);
    const choice = action.sandmaster as SandmasterChoice;
    assert.ok(choice.collect.length > 0, difficulty);
    const order = sandmasterActionOrder(view, 'trainer', action);
    assert.ok(order, difficulty);
    const quote = quoteSandmasterMovement(f.game, 'trainer', order, choice);
    const next = applyAction(f.game, 'trainer', action);
    assert.equal(sandmasterTrainer(next).spice, sandmasterTrainer(f.game).spice + quote.collect.length, difficulty);
    for (const pile of quote.piles) assert.equal(next.spice[pile.key], pile.before - 1, difficulty);
    assert.equal(sandmasterTrainer(next).moved, sandmasterTrainer(f.game).moved + 1, difficulty);
  }
});
