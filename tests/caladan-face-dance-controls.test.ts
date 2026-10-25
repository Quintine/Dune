import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CaladanReinforcement } from '../components/caladan-reinforcement';
import { createGame, joinGame, newPlayer, viewGame, type GameView } from '../game/engine';
import {
  caladanReinforcementActions, caladanReinforcementCanAct, caladanReinforcementChoice,
} from '../game/caladan-reinforcement-options';

// Controlled public offer projections supplement genuine Caladan/Face Dance
// source tests. No victorious army, reserve, dancer identity or pending Game
// receipt is installed. The stateful component is entered only through React.
function projected(): GameView {
  const game = createGame('CALADANFACEDANCECONTROLS', newPlayer('a', 'Atreides', 'atreides'), true, ['ix']);
  joinGame(game, newPlayer('e', 'Emperor', 'emperor'));
  joinGame(game, newPlayer('t', 'Tleilaxu', 'tleilaxu'));
  const view = viewGame(game, 'a'); view.status = 'playing'; view.phase = 6;
  view.decision = { kind: 'caladanReinforcement', player: 'a', event: 'controlled-original-caladan-event' };
  view.caladanReinforcement = {
    event: 'controlled-original-caladan-event', player: 'a', territory: 'hagga_basin', amount: 1, blocked: null,
    destinations: [
      { id: 'hagga_basin:10', name: 'Hagga Basin · sector 10', sector: 10, blocked: 'Storm entry is unavailable.' },
      { id: 'hagga_basin:12', name: 'Hagga Basin · sector 12', sector: 12, blocked: null },
      { id: 'hagga_basin:13', name: 'Hagga Basin · sector 13', sector: 13, blocked: null },
    ],
  };
  return view;
}
function markup(game: GameView, busy = false) {
  return renderToStaticMarkup(createElement(CaladanReinforcement, { game, busy, act() {} }));
}
function button(html: string, label: string) {
  const found = html.match(new RegExp(`<button\\b[^>]*>${label}<\\/button>`))?.[0];
  assert.ok(found, label); return found;
}
function order(html: string) {
  assert.match(html, /aria-label="Provisional Face Dance order"/);
  assert.match(html, /this optional force joins the original victorious army before any later Face Dance/);
  assert.match(html, /If replacement occurs, it returns with the surviving army and counts toward the current replacement limit/);
  assert.match(html, /does not create another victory or grant another Caladan reinforcement/);
}

void test('Caladan persistently explains the provisional reinforcement-before-Face-Dance order', () => {
  const game = projected();
  for (let render = 0; render < 3; render++) {
    const html = markup(game); order(html);
    assert.match(html, /Add one reserve force at the battle location, or leave it in reserves/);
    assert.doesNotMatch(html, /holds the winning identity|will reveal a Face Dancer|Confirm|Acknowledge|countdown/);
  }
});

void test('the original pure action helper retains the exact event destination and fixed one-force amount', () => {
  const game = projected(), before = structuredClone(game);
  assert.equal(caladanReinforcementCanAct(game), true);
  for (const destination of ['hagga_basin:12', 'hagga_basin:13']) {
    assert.deepEqual(caladanReinforcementChoice(game, destination), {
      blocked: null, action: { type: 'decision', event: 'controlled-original-caladan-event', destination, amount: 1 },
    });
  }
  assert.equal(caladanReinforcementChoice(game, 'invented_destination').action, null);
  const html = markup(game); order(html);
  assert.doesNotMatch(button(html, 'Add one reserve force'), /\sdisabled=/);
  assert.doesNotMatch(button(html, 'Leave in reserves'), /\sdisabled=/);
  assert.doesNotMatch(html, /type="number"|type="range"/);
  assert.deepEqual(game, before);
});

void test('busy rendering disables both original choices while preserving the persistent order explanation', () => {
  const html = markup(projected(), true); order(html);
  assert.match(button(html, 'Add one reserve force'), /\sdisabled=""/);
  assert.match(button(html, 'Leave in reserves'), /\sdisabled=""/);
  assert.match(html, /<select\b[^>]*\sdisabled=/);
});

void test('separate destination blocks remain authoritative without removing the original decline', () => {
  const game = projected();
  game.caladanReinforcement!.destinations[1].blocked = 'A separate arrival rule still blocks sector 12.';
  game.caladanReinforcement!.destinations[2].blocked = 'A separate arrival rule still blocks sector 13.';
  assert.equal(caladanReinforcementChoice(game, 'hagga_basin:10').blocked, 'Storm entry is unavailable.');
  assert.equal(caladanReinforcementChoice(game, 'hagga_basin:12').action, null);
  assert.deepEqual(caladanReinforcementActions(game), [{ type: 'decision', event: 'controlled-original-caladan-event', decline: true }]);
  const html = markup(game); order(html);
  assert.match(html, /Storm entry is unavailable/);
  assert.match(html, /A separate arrival rule still blocks sector 12/);
  assert.match(html, /A separate arrival rule still blocks sector 13/);
  assert.match(html, /No legal reinforcement destination/);
  assert.match(button(html, 'Add one reserve force'), /\sdisabled=/);
  assert.doesNotMatch(button(html, 'Leave in reserves'), /\sdisabled=/);
});

void test('an independently blocked offer is still declinable and never promises that Face Dance makes its destination legal', () => {
  const game = projected(); game.caladanReinforcement!.blocked = 'This destination requires a separate arrival ruling.';
  for (let render = 0; render < 2; render++) {
    const html = markup(game); order(html);
    assert.match(html, /This destination requires a separate arrival ruling/);
    assert.match(button(html, 'Add one reserve force'), /\sdisabled=/);
    assert.doesNotMatch(button(html, 'Leave in reserves'), /\sdisabled=/);
  }
  assert.equal(caladanReinforcementChoice(game, 'hagga_basin:12').action, null);
  assert.deepEqual(caladanReinforcementActions(game), [{ type: 'decision', event: 'controlled-original-caladan-event', decline: true }]);
});

void test('foreign stale and absent offers retain their existing control boundaries', () => {
  const foreign = projected(); foreign.me = 'e'; assert.equal(markup(foreign), '');
  const absent = projected(); absent.caladanReinforcement = null; assert.equal(markup(absent), '');
  const noDecision = projected(); noDecision.decision = null; assert.equal(markup(noDecision), '');
  const stale = projected(); stale.decision = { kind: 'caladanReinforcement', player: 'a', event: 'old-event' };
  assert.equal(caladanReinforcementCanAct(stale), false); assert.equal(caladanReinforcementChoice(stale, 'hagga_basin:12').action, null);
  const html = markup(stale); order(html);
  assert.match(button(html, 'Add one reserve force'), /\sdisabled=/);
  assert.match(button(html, 'Leave in reserves'), /\sdisabled=/);
});

void test('the general owned offer explanation never reads a private Face Dancer identity or opposing hand', () => {
  const game = projected();
  for (const player of game.players) for (const field of ['faceDancers', 'traitors', 'hand', 'spice'])
    Object.defineProperty(player, field, { get() { throw Error(`Caladan guide read private ${field}`); } });
  const html = markup(game); order(html);
  assert.doesNotMatch(button(html, 'Add one reserve force'), /\sdisabled=/);
});
