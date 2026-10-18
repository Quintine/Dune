import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OrnithopterMovement } from '../components/ornithopter-movement';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import { richeseCards } from '../game/richese-cards';
import { botMovementRange } from '../game/bot-mobility';

const firstSource = 'arrakeen:10', secondSource = 'carthag:11';
const move = (from = firstSource, amount = 1): Action => ({
  type: 'move', from, amount, elite: 0, territory: 'polar_sink', sector: 0,
});

/** Controlled personalized UI projection, not an earned game history or native
 * runtime proof. Genuine acquisition, advisor entry/flip and movement are
 * verified by the separate original-action integration fixtures. */
function controlledView(active = false): GameView {
  const source = createGame('ORNITHOPTERADVISORUI', newPlayer('bg', 'Bene Gesserit', 'beneGesserit'), true, ['choam']);
  joinGame(source, newPlayer('emperor', 'Emperor', 'emperor'));
  const game = viewGame(source, 'bg'), card = richeseCards().find(card => card.effect === 'ornithopter'); assert.ok(card);
  game.status = 'playing'; game.phase = 5; game.turn = 2; game.active = 'bg'; game.storm = 18;
  const own = game.players.find(player => player.id === 'bg')!;
  own.forces = { [firstSource]: 2, [secondSource]: 2 };
  own.advisors = { arrakeen: {}, carthag: {} };
  game.players.find(player => player.id === 'emperor')!.forces = { [firstSource]: 1, [secondSource]: 1 };
  game.ornithopter = { card, blocked: null,
    modes: [{ mode: 'range3', blocked: null }, { mode: 'twoGroups', blocked: null }],
    active: active ? { event: 'original-flight-event', mode: 'twoGroups', completed: 1, remaining: 1,
      cohort: { forces: { [secondSource]: 2 }, elites: {} } } : null };
  return game;
}
function markup(game: GameView, draft: Action | null = move(), busy = false, unavailableReason?: string): string {
  return renderToStaticMarkup(createElement(OrnithopterMovement, {
    game, move: draft, busy, unavailableReason,
    act() { assert.fail('Static controls must not submit a movement or start a countdown'); },
  }));
}
function movementButton(html: string): string {
  const button = /<button\b[^>]*>(?:Play Ornithopter and move selected group|Move next selected group)<\/button>/.exec(html);
  assert.ok(button, html); return button[0];
}

void test('initial Advanced advisor controls offer both printed modes with persistent guidance and an enabled selected group', () => {
  const html = markup(controlledView());
  assert.match(html, /Use Ornithopter for this movement/);
  assert.match(html, /<option[^>]*value="range3"[^>]*>One group, up to three territories/);
  assert.match(html, /<option[^>]*value="twoGroups"[^>]*>Two different groups, normal movement/);
  assert.doesNotMatch(html, /awaits.*ruling|advisor use.*unavailable/i);
  assert.doesNotMatch(movementButton(html), /\sdisabled=/);
  assert.match(html, /<p class="notice" id="[^"]+-advisor-guidance">Advanced Bene Gesserit advisors can use both card modes/);
  assert.match(html, /one-group mode independently gives range three/);
  assert.match(html, /Two-group mode uses your current normal range and different original forces/);
  assert.match(html, /Normal entry and advisor conversion still apply/);
  assert.match(movementButton(html), /aria-describedby="[^"]+-advisor-guidance"/);
});

void test('the active two-group advisor control retains the original distinct unmoved cohort', () => {
  const html = markup(controlledView(true), move(secondSource, 2));
  assert.match(html, /Ornithopter movement in progress/);
  assert.match(html, /1 group moved · 1 remaining/);
  assert.match(html, /The next group must use different original forces/);
  assert.match(html, /Original unmoved forces available for selection/);
  assert.match(html, /Carthag, sector 11: 2 forces/);
  assert.doesNotMatch(movementButton(html), /\sdisabled=/);
  assert.match(html, /Advanced Bene Gesserit advisors can use both card modes/);
});

void test('busy and unavailable advisor movement remain disabled with a readable explanation', () => {
  assert.match(movementButton(markup(controlledView(), move(), true)), /\sdisabled=""/);
  const unavailable = markup(controlledView(), move(), false, 'The original territory entry is blocked.');
  assert.match(unavailable, /The original territory entry is blocked/);
  assert.match(movementButton(unavailable), /\sdisabled=""/);
  assert.match(movementButton(unavailable), /aria-describedby="[^"]+-advisor-guidance [^"]+-reason"/);
  const blocked = controlledView(); blocked.ornithopter!.blocked = 'Finish the original response first.';
  assert.match(markup(blocked), /Finish the original response first/);
  assert.match(movementButton(markup(blocked)), /\sdisabled=""/);
  assert.match(movementButton(markup(controlledView(), null)), /\sdisabled=""/);
});

void test('already moved and stale physical advisor cohorts cannot be submitted again', () => {
  const reused = markup(controlledView(true), move(firstSource));
  assert.match(reused, /Choose forces that have not moved with this card. The first group cannot move again/);
  assert.match(movementButton(reused), /\sdisabled=""/);
  const stale = controlledView(true);
  stale.players.find(player => player.id === 'bg')!.forces[secondSource] = 0;
  const lost = markup(stale, move(secondSource, 2));
  assert.match(lost, /selected force counts are no longer available/i);
  assert.match(movementButton(lost), /\sdisabled=""/);
});

void test('advisors alone in either city grant no city range even while the independent card control is available', () => {
  const game = controlledView(), own = game.players.find(player => player.id === 'bg')!;
  assert.equal(botMovementRange(game, own, 0), 1);
  const html = markup(game);
  assert.match(html, /Advisors in Arrakeen or Carthag do not grant the city’s movement range/);
  assert.doesNotMatch(movementButton(html), /\sdisabled=/);
  own.advisors = {};
  assert.equal(botMovementRange(game, own, 0), 3, 'The native public range helper still distinguishes city fighters');
});

void test('Advanced BG guidance does not appear for Basic or another faction, and absent offers stay absent', () => {
  const basic = controlledView(); basic.advanced = false;
  assert.doesNotMatch(markup(basic), /Advanced Bene Gesserit advisors/);
  const other = controlledView(); other.players.find(player => player.id === 'bg')!.faction = 'emperor';
  assert.doesNotMatch(markup(other), /Advanced Bene Gesserit advisors/);
  const absent = controlledView(); absent.ornithopter = null;
  assert.equal(markup(absent), '');
});
