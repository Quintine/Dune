import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MovementPromises } from '../components/movement-promises';
import { MovementExpressionPromiseGuideButton } from '../components/movement-expression-promises';
import { TravelPromiseGuideButton } from '../components/travel-promises';
import { TurnActionGuideButton } from '../components/turn-action-promises';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { viewGame, type Action, type Game, type GameView } from '../game/engine';
import {
  actMovementSector as act, bindMovementSector as bind,
  createTruthMovementSectorFixture as fixture, movementSectorInventory as inventory,
  movementSectorPlayer as player, settleMovementSector as settle,
  type MovementSectorQuestionKind,
} from './fixture-truth-movement-sector';

const kinds: MovementSectorQuestionKind[] = ['movement', 'movementExpression', 'mixedMovement', 'travel', 'turnActions'];
function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
function row(game: Game, kind: MovementSectorQuestionKind, target: string): {
  fulfilled?: boolean; released?: boolean; progress?: { territory: string; maximum: number }[];
  sectorProgress?: { territory: string; sector: number; maximum: number }[];
} {
  const rows = kind === 'movement' ? game.movementPromises : kind === 'movementExpression' || kind === 'mixedMovement'
    ? game.movementExpressionPromises : kind === 'travel' ? game.travelPromises : game.turnActionPromises;
  const found = rows?.find(item => item.player === target); assert.ok(found); return found;
}
function answers(view: GameView, kind: MovementSectorQuestionKind) {
  return kind === 'movement' ? view.truthMovementAnswers : kind === 'movementExpression'
    ? view.truthMovementExpressionAnswers : kind === 'mixedMovement' ? view.truthMixedMovementAnswers
      : kind === 'travel' ? view.truthTravelAnswers : view.truthTurnActionAnswers;
}
function guide(view: GameView, kind: MovementSectorQuestionKind): Action | undefined {
  return kind === 'movement' ? view.movementPromisePolicy?.[0] : kind === 'movementExpression' || kind === 'mixedMovement'
    ? view.movementExpressionPromiseGuide?.action : kind === 'travel'
      ? view.travelPromiseGuide?.action : view.turnActionGuide?.action;
}
function guideMarkup(view: GameView, kind: MovementSectorQuestionKind): string {
  const noop = () => {};
  return kind === 'movement' ? renderToStaticMarkup(createElement(MovementPromises, { game: view, busy: false, act: noop }))
    : kind === 'movementExpression' || kind === 'mixedMovement' ? renderToStaticMarkup(createElement(MovementExpressionPromiseGuideButton, { game: view, busy: false, send: noop }))
      : kind === 'travel' ? renderToStaticMarkup(createElement(TravelPromiseGuideButton, { game: view, busy: false, act: noop }))
        : renderToStaticMarkup(createElement(TurnActionGuideButton, { game: view, busy: false, act: noop }));
}

for (const kind of kinds) void test(`${kind}: native Yes binds one exact ground sector and exposes a legal human/bot guide`, () => {
  const f = fixture(), bound = bind(f, kind, 'yes'); let game = bound.game;
  assert.ok(answers(viewGame(bound.asked, f.target), kind)?.includes('yes'));
  assert.equal(game.discard.filter(card => card.id === f.truth).length, 1);
  rejected(game, f.target, { type: 'endMovement' });
  const view = viewGame(game, f.target), action = guide(view, kind); assert.ok(action);
  assert.equal(action.type, 'move'); assert.equal(action.territory, 'imperial_basin'); assert.equal(action.sector, f.sector);
  assert.match(guideMarkup(view, kind), new RegExp(`sector ${f.sector}`, 'i'));
  for (const difficulty of DIFFICULTIES) {
    const bot = viewGame(game, f.target);
    bot.players.find(entry => entry.id === f.target)!.bot = difficulty;
    assert.deepEqual(botActions(bot)[0], action);
  }
  game = settle(act(game, f.target, action));
  assert.equal(row(game, kind, f.target).fulfilled, true);
  assert.ok((player(game, f.target).forces[`imperial_basin:${f.sector}`] ?? 0) > 0);
  assert.equal(f.forceTotal(game), f.originalForces);
  assert.deepEqual(inventory(game), f.originalCards);
});

for (const kind of kinds) void test(`${kind}: native No blocks only the named sector`, () => {
  const f = fixture(); let game = bind(f, kind, 'no').game;
  rejected(game, f.target, f.move(f.sector));
  game = settle(act(game, f.target, f.move(f.alternative)));
  assert.equal(player(game, f.target).forces[`imperial_basin:${f.alternative}`], 1);
  assert.notEqual(row(game, kind, f.target).fulfilled, true);
  game = settle(act(game, f.target, { type: 'endMovement' }));
  assert.equal(row(game, kind, f.target).fulfilled, true);
  assert.equal(f.forceTotal(game), f.originalForces);
  assert.deepEqual(inventory(game), f.originalCards);
});

for (const kind of kinds) void test(`${kind}: a different first sector preserves Yes only while actual Hajr remains available`, () => {
  const f = fixture(); assert.ok(f.hajr); let game = bind(f, kind, 'yes').game;
  game = settle(act(game, f.target, f.move(f.alternative)));
  assert.notEqual(row(game, kind, f.target).fulfilled, true);
  rejected(game, f.target, { type: 'endMovement' });
  game = settle(act(game, f.target, { type: 'card', card: f.hajr }));
  game = settle(act(game, f.target, f.move(f.sector)));
  assert.equal(row(game, kind, f.target).fulfilled, true);
  assert.equal(player(game, f.target).forces[`imperial_basin:${f.sector}`], 1);
  assert.equal(player(game, f.target).forces[`imperial_basin:${f.alternative}`], 1);
  assert.equal(game.discard.filter(card => card.id === f.hajr).length, 1);
  assert.equal(f.forceTotal(game), f.originalForces);
  assert.deepEqual(inventory(game), f.originalCards);
});

for (const kind of ['movementExpression', 'mixedMovement', 'travel', 'turnActions'] as const)
  void test(`${kind}: two exact-sector conditions use separate native group maxima`, () => {
    const f = fixture(); assert.ok(f.hajr); let game = bind(f, kind, 'yes', true).game;
    game = settle(act(game, f.target, f.move(f.sector, 2)));
    assert.notEqual(row(game, kind, f.target).fulfilled, true);
    assert.deepEqual(row(game, kind, f.target).progress, [{ territory: 'imperial_basin', maximum: 2 }]);
    game = settle(act(game, f.target, { type: 'card', card: f.hajr }));
    game = settle(act(game, f.target, f.move(f.alternative)));
    assert.equal(row(game, kind, f.target).fulfilled, true);
    assert.deepEqual(row(game, kind, f.target).progress, [{ territory: 'imperial_basin', maximum: 2 }]);
    assert.deepEqual(row(game, kind, f.target).sectorProgress, [
      { territory: 'imperial_basin', sector: f.sector, maximum: 2 },
      { territory: 'imperial_basin', sector: f.alternative, maximum: 1 },
    ]);
    assert.equal(f.forceTotal(game), f.originalForces);
    assert.deepEqual(inventory(game), f.originalCards);
  });

void test('invalid movement sector cannot consume the declared physical Truthtrance', () => {
  const f = fixture(), declared = bind(f, 'movement', 'yes');
  // Reopen only the actual original declaration returned by the fixture; no state is installed.
  rejected(declared.declared, f.asker, { type: 'truthAsk', question: {
    kind: 'movement', target: f.target, territory: 'imperial_basin', sector: 0, minimum: 1,
  } });
  assert.ok(player(declared.declared, f.asker).hand.some(card => card.id === f.truth));
});
