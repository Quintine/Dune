import assert from 'node:assert/strict';
import { test } from 'node:test';
import { viewGame, type Game } from '../game/engine';
import { fighterCount, isAdvisor } from '../game/advisors';
import { botMovementRange, groundMoveRouteDistance } from '../game/bot-mobility';
import { botActions } from '../game/bots';
import { splitLocation } from '../game/board';
import {
  actOrnithopterAdvisor, completeOrnithopterAdvisors, createOrnithopterAdvisorFixture,
  ornithopterAdvisorMove, ornithopterAdvisorPlayer as player, type OrnithopterAdvisorFixture,
} from './fixture-ornithopter-advisors';

const own = (game: Game) => viewGame(game, 'beneGesserit').players.find(player => player.id === 'beneGesserit')!;
const normalRange = (game: Game) => botMovementRange(viewGame(game, 'beneGesserit'), own(game), 0);
const total = (game: Game) => Object.values(player(game).forces).reduce((sum, count) => sum + count, 0);
function source(f: OrnithopterAdvisorFixture) {
  assert.equal(f.game.advanced, true);
  assert.ok(f.actions.some(step => step.actor === f.owner && step.action.type === 'advisorSetup' && step.action.territory === 'arrakeen'));
  assert.equal(player(f.afterSetup).forces[f.advisorSource], 1);
  assert.equal(isAdvisor(player(f.afterSetup), 'arrakeen'), true);
  assert.equal(player(f.afterSetup, 'atreides').forces[f.advisorSource], 10);
  assert.ok(f.actions.some(step => step.actor === f.owner && step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.ok(player(f.acquired).hand.some(card => card.id === f.card));
  assert.equal(player(f.beforeForeignShipment, 'richese').spice - player(f.afterAccompaniment, 'richese').spice, 1);
  assert.equal(f.beforeAccompaniment.decision?.kind, 'advisor');
  assert.equal(player(f.beforeAccompaniment).reserves - player(f.afterAccompaniment).reserves, 1);
  assert.equal(player(f.beforeAccompaniment).spice, player(f.afterAccompaniment).spice);
  assert.equal(player(f.game).forces[f.advisorSource], 2);
  assert.equal(player(f.game).advisors!.arrakeen.lockedTurn, f.game.turn);
  assert.equal(player(f.beforeReinforcement).spice - player(f.afterReinforcement).spice, f.fighterCity ? 1 : 2);
  assert.equal(player(f.game).forces[f.fighterSource], 1);
  assert.equal(isAdvisor(player(f.game), splitLocation(f.fighterSource).territory), false);
  assert.equal(total(f.game), 3);
  assert.equal(fighterCount(player(f.game), 'arrakeen'), 0);
  assert.equal(normalRange(f.game), f.fighterCity ? 3 : 1);
  assert.equal(f.sourceActionCount, f.actions.length);
  assert.equal(viewGame(f.game, f.owner).ornithopter!.blocked, null);
}
function settled(f: OrnithopterAdvisorFixture, result: ReturnType<typeof completeOrnithopterAdvisors>, count: number) {
  const done = result.completed;
  assert.equal(player(done).moved, count);
  assert.equal(own(done).movesAllowed, count);
  assert.equal(done.ornithopter ?? null, null);
  assert.equal(done.discard.filter(card => card.id === f.card).length, 1);
  assert.equal(player(done).hand.some(card => card.id === f.card), false);
  assert.equal(total(done), total(f.game));
  assert.equal(player(done).spice, player(f.game).spice);
  assert.equal(player(done).reserves, player(f.game).reserves);
  assert.equal(player(done).tanks, player(f.game).tanks);
  assert.equal(result.actions.at(-1)!.action.type, 'endMovement');
}

void test('genuine Advanced advisors use paid physical Ornithopter range three without fighter city access', () => {
  const f = createOrnithopterAdvisorFixture();
  source(f);
  const proposed = ornithopterAdvisorMove(f.game, f.advisorSource, { mode: 'range3', range: 3 });
  const ordinary = { ...proposed };
  delete ordinary.movementCard;
  delete ordinary.ornithopter;
  assert.throws(() => actOrnithopterAdvisor(f.game, f.owner, ordinary), /far|range|route|long|more than/i,
    'Advisors occupying Arrakeen do not supply ordinary three-territory access');
  const result = completeOrnithopterAdvisors(f, 'range3');
  assert.equal(groundMoveRouteDistance(viewGame(f.game, f.owner), own(f.game), f.advisorSource, result.firstDestination), 3);
  assert.equal(isAdvisor(player(result.completed), 'arrakeen'), true);
  assert.equal(player(result.completed).forces[f.advisorSource], 1);
  assert.equal(isAdvisor(player(result.completed), splitLocation(result.firstDestination).territory), false);
  assert.equal(fighterCount(player(result.completed), splitLocation(result.firstDestination).territory), 1,
    'An advisor arriving alone in an empty territory automatically becomes a fighter');
  assert.equal(normalRange(result.completed), 1);
  settled(f, result, 1);
});

void test('genuine Advanced advisor and fighter groups remain distinct within one physical two-group flight', () => {
  const f = createOrnithopterAdvisorFixture();
  source(f);
  const result = completeOrnithopterAdvisors(f);
  assert.equal(result.moves[0].step.action.from, f.advisorSource);
  assert.equal(result.moves[1].step.action.from, f.fighterSource);
  assert.equal(isAdvisor(player(result.moves[0].before), 'arrakeen'), true);
  assert.equal(isAdvisor(player(result.moves[1].before), splitLocation(f.fighterSource).territory), false);
  const active = viewGame(result.first, f.owner).ornithopter!.active!;
  assert.equal(active.completed, 1);
  assert.equal(active.cohort!.forces[f.advisorSource], 1);
  assert.equal(active.cohort!.forces[f.fighterSource], 1);
  assert.equal(active.cohort!.forces[result.firstDestination] ?? 0, 0);
  assert.equal(isAdvisor(player(result.first), splitLocation(result.firstDestination).territory), false);
  const repeated = ornithopterAdvisorMove(result.first, result.firstDestination);
  assert.throws(() => actOrnithopterAdvisor(result.first, f.owner, repeated), /cohort|unmoved|original|force/i,
    'The first advisor group cannot be reused merely because its empty arrival changed its stance');
  assert.equal(result.moves[1].step.action.ornithopterEvent, active.event);
  assert.equal(player(result.completed).forces[f.advisorSource], 1);
  assert.equal(isAdvisor(player(result.completed), 'arrakeen'), true);
  settled(f, result, 2);
});

void test('genuine two-group flight recomputes normal advisor range after the last city fighter leaves', () => {
  const f = createOrnithopterAdvisorFixture({ fighterCity: true });
  source(f);
  const result = completeOrnithopterAdvisors(f);
  assert.equal(result.moves[0].step.action.from, 'carthag:11');
  assert.equal(groundMoveRouteDistance(viewGame(f.game, f.owner), own(f.game), f.fighterSource, result.firstDestination), 3);
  assert.equal(fighterCount(player(result.first), 'carthag'), 0);
  assert.equal(fighterCount(player(result.first), 'arrakeen'), 0);
  assert.equal(player(result.first).forces[f.advisorSource], 2);
  assert.equal(normalRange(result.first), 1);
  const tooFar = ornithopterAdvisorMove(result.first, f.advisorSource, { range: 3 });
  assert.throws(() => actOrnithopterAdvisor(result.first, f.owner, tooFar), /far|range|route|long|more than/i,
    'Two-group mode uses current normal range rather than retaining the first group\'s city access');
  assert.equal(result.moves[1].step.action.from, f.advisorSource);
  assert.equal(result.moves[1].step.action.movementCard, undefined);
  assert.equal(typeof result.moves[1].step.action.ornithopterEvent, 'string');
  assert.equal(normalRange(result.completed), 1);
  settled(f, result, 2);
});

void test('all four minimal policies retain legal original advisor card and unmoved-group continuations', () => {
  const f = createOrnithopterAdvisorFixture();
  const { first } = completeOrnithopterAdvisors(f);
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const startView = viewGame(f.game, f.owner);
    startView.players.find(player => player.id === f.owner)!.bot = difficulty;
    const advisor = botActions(startView).find(action => action.type === 'move' &&
      action.movementCard === f.card && action.from === f.advisorSource);
    assert.ok(advisor, `${difficulty} retains a physical-card move from the actual advisor source`);
    const started = actOrnithopterAdvisor(structuredClone(f.game), f.owner, advisor);
    assert.ok(player(started).moved === 1 || started.response || started.decision);
    const pendingView = viewGame(first, f.owner);
    pendingView.players.find(player => player.id === f.owner)!.bot = difficulty;
    const second = botActions(pendingView).find(action => action.type === 'move' &&
      action.ornithopterEvent === pendingView.ornithopter!.active!.event);
    assert.ok(second, `${difficulty} retains a distinct original second group`);
    const completed = actOrnithopterAdvisor(structuredClone(first), f.owner, second);
    assert.ok(player(completed).moved === 2 || completed.response || completed.decision);
  }
});
