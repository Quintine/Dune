import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import type { Difficulty } from '../game/bot-profiles';
import { actNoFieldAlliedSeparation as act, createNoFieldAlliedSeparationFixture as fixture,
  noFieldAlliedSeparationInventory as inventory, noFieldAlliedSeparationPlayer as p,
  noFieldAlliedSeparationReload as reload, finishNoFieldAlliedSeparationMovement as finish,
  noFieldAlliedSeparationClean as clean, nextNoFieldAlliedSeparation as next } from './fixture-no-field-allied-separation';

function reject(game: Game, actor: string, action: Action) {
  const before = reload(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function assertDueLoss(f: ReturnType<typeof fixture>, game: Game) {
  const before = p(f.game, f.actor), after = p(game, f.actor), amount = Math.min(f.value, before.reserves);
  assert.equal(after.noField!.deployed, null); assert.notEqual(after.noFieldEvent, f.event);
  assert.deepEqual(after.noField!.tokens, f.marker!.tokens); assert.equal(after.noField!.lastShipped, f.token);
  assert.equal(after.reserves, before.reserves - amount); assert.equal(after.tanks, before.tanks + amount);
  assert.deepEqual(after.forces, {});
  assert.equal(p(game, f.ally).forces['imperial_basin:11'], 2); assert.equal(p(game, f.ally).tanks, 0);
  assert.equal(p(game, f.ally).ally, f.actor); assert.equal(after.ally, f.ally);
  assert.equal((game.movementRemaining ?? []).includes(f.actor), false);
  assert.deepEqual(inventory(game), f.original);
}

void test('genuine protected Basin marker and army form a real next-worm alliance without premature revelation', () => {
  const f = fixture();
  assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
  assert.equal(f.sourceCounts.setup, f.setupActions.length); assert.equal(f.sourceCounts.source, f.sourceActions.length);
  assert.equal(f.sourceCounts.markerShipment, f.markerShipment.steps.length);
  assert.equal(f.sourceCounts.allyShipment, f.allyShipment.steps.length);
  assert.equal(f.sourceCounts.alliance, f.alliance.steps.length);
  assert.deepEqual(f.firstDials.steps.map(step => step.action.amount), [4, 5]);
  assert.equal(p(f.markerShipment.before, f.actor).spice - p(f.markerShipment.after, f.actor).spice, 2);
  assert.equal(p(f.allyShipment.before, f.ally).spice - p(f.allyShipment.after, f.ally).spice, 4);
  assert.deepEqual(f.alliance.steps.map(step => [step.actor, step.action.type, step.action.target]),
    [[f.actor, 'alliance', f.ally], [f.ally, 'alliance', f.actor]]);
  assert.equal(f.alliance.before.turn, 2); assert.equal(f.alliance.before.phase, 1); assert.equal(f.alliance.before.nexus, true);
  assert.equal(viewGame(f.alliance.after, f.actor).advancedAllySeparation, null);
  assert.deepEqual(p(f.game, f.actor).forces, {}); assert.equal(p(f.game, f.actor).noFieldEvent, f.event);
  assert.equal(f.game.active, f.actor);
  assert.deepEqual(viewGame(f.game, f.actor).advancedAllySeparation, { territories: ['Imperial Basin'], noField: true });
  assert.equal(viewGame(f.game, f.ally).advancedAllySeparation, null);
  assert.equal(viewGame(f.game, f.actor).basicAllySeparation, null);
  assert.deepEqual(inventory(f.game), f.original);
});

void test('Advanced due ends reveal zero three and five once and lose only the ending player materialized group', () => {
  for (const value of [0, 3, 5] as const) {
    const f = fixture({ value }); let game = act(reload(f.game), f.actor, f.action);
    assertDueLoss(f, game);
    const revealedEvent = p(game, f.actor).noFieldEvent;
    reject(game, f.actor, f.action);
    assert.equal(viewGame(game, f.actor).advancedAllySeparation, null);
    game = finish(game); assert.equal(game.phase, 7);
    assert.equal(p(game, f.actor).tanks, value); assert.equal(p(game, f.actor).noFieldEvent, revealedEvent);
    assert.equal(p(game, f.ally).forces['imperial_basin:11'], 2);
    assert.deepEqual(inventory(game), f.original);
  }
});

void test('Basic actual new-alliance turn ends preserve the concealed marker and its ally formation grace', () => {
  const f = fixture({ advanced: false, value: 5 }); assert.ok(f.formationEnds);
  const before = f.formationMovement;
  assert.equal(before.turn, 2); assert.equal(before.active, f.ally);
  assert.equal(viewGame(before, f.ally).basicAllySeparation, null);
  assert.equal(viewGame(before, f.actor).basicAllySeparation, null);
  const game = finish(reload(before));
  assert.equal(game.phase, 7); assert.deepEqual(p(game, f.actor).noField, p(before, f.actor).noField);
  assert.equal(p(game, f.actor).noFieldEvent, f.event); assert.equal(p(game, f.actor).tanks, 0);
  assert.equal(p(game, f.ally).forces['imperial_basin:11'], 2); assert.equal(p(game, f.ally).tanks, 0);
  assert.equal(f.formationEnds.after.phase, 7); assert.deepEqual(inventory(game), f.original);
});

void test('Basic later-player deadline follows an actual earlier ally end and then destroys only the due marker group', () => {
  for (const value of [0, 3, 5] as const) {
    const f = fixture({ advanced: false, value });
    assert.equal(f.beforeEarlierEnd.turn, 3); assert.equal(f.beforeEarlierEnd.active, f.ally);
    assert.equal(viewGame(f.beforeEarlierEnd, f.ally).basicAllySeparation, null);
    assert.ok(f.earlierEnds.some(step => step.actor === f.ally && step.action.type === 'endMovement'));
    assert.equal(p(f.game, f.actor).noFieldEvent, f.event); assert.equal(p(f.game, f.ally).forces['imperial_basin:11'], 2);
    assert.equal((f.game.movementRemaining ?? []).includes(f.ally), false);
    assert.deepEqual(viewGame(f.game, f.actor).basicAllySeparation, { territories: ['Imperial Basin'], noField: true });
    assert.equal(viewGame(f.game, f.actor).advancedAllySeparation, null);
    const game = act(reload(f.game), f.actor, f.action); assertDueLoss(f, game);
    assert.equal(viewGame(game, f.actor).basicAllySeparation, null);
  }
});

void test('native voluntary reveal remains an alternative before the same due physical separation without a second reveal', () => {
  const f = fixture({ value: 3 });
  let game = act(reload(f.game), f.actor, { type: 'revealNoField', event: f.event, token: f.token });
  const event = p(game, f.actor).noFieldEvent;
  assert.notEqual(event, f.event); assert.equal(p(game, f.actor).noField!.deployed, null);
  assert.equal(p(game, f.actor).forces['imperial_basin:9'], 3); assert.equal(p(game, f.actor).tanks, 0);
  assert.deepEqual(viewGame(game, f.actor).advancedAllySeparation, { territories: ['Imperial Basin'] });
  game = act(game, f.actor, f.action);
  assertDueLoss(f, game); assert.equal(p(game, f.actor).noFieldEvent, event);
  assert.equal(p(game, f.actor).tanks, 3);
});

void test('all four minimal profiles legally complete the native deadline by departure, revelation or ending', () => {
  const f = fixture({ value: 3 });
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] satisfies Difficulty[]) {
    let game = reload(f.game);
    for (let count = 0; game.phase === 5 && (game.movementRemaining ?? []).includes(f.actor) && count < 60; count++) {
      if (game.active === f.actor && clean(game)) {
        const view = viewGame(game, f.actor); view.players.find(player => player.id === f.actor)!.bot = difficulty;
        const choice = botActions(view)[0]; assert.ok(choice, `${difficulty} has a legal current continuation`);
        game = act(game, f.actor, choice);
      } else {
        const step = next(game); assert.ok(step); game = act(game, step.actor, step.action);
      }
    }
    assert.equal((game.movementRemaining ?? []).includes(f.actor), false,
      `${difficulty} completes instead of stalling on concealed custody`);
    assert.equal(p(game, f.ally).forces['imperial_basin:11'], 2);
    assert.equal(p(game, f.ally).tanks, 0);
    assert.deepEqual(inventory(game), f.original);
    game = finish(game); assert.ok(game.phase === 6 || game.phase === 7);
    assert.equal(p(game, f.ally).forces['imperial_basin:11'], 2);
    assert.deepEqual(inventory(game), f.original);
  }
});
