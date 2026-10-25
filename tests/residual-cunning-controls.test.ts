import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ResidualPoison } from '../components/residual-poison';
import { createGame, joinGame, newPlayer, viewGame, type GameView } from '../game/engine';
import { richeseCards } from '../game/richese-cards';

// Controlled availability projections supplement the genuine Residual/Cunning
// source and reconciliation suite. No played battle, answer, victim, card hand
// or pending Game state is installed. The component owns useId and is always
// entered through React's server renderer, never invoked as a plain function.
function projected(): GameView {
  const game = createGame('RESIDUALCUNNINGCONTROLS', newPlayer('a', 'Atreides', 'atreides'), true, ['choam']);
  joinGame(game, newPlayer('e', 'Emperor', 'emperor'));
  joinGame(game, newPlayer('r', 'Richese', 'richese'));
  const view = viewGame(game, 'a'), card = richeseCards().find(card => card.effect === 'residualPoison');
  assert.ok(card);
  view.status = 'playing'; view.phase = 6;
  view.residualPoison = { card, blocked: null, event: 'controlled-residual-pre-leader-event', target: 'e' };
  return view;
}
function markup(game: GameView, busy = false) {
  return renderToStaticMarkup(createElement(ResidualPoison, { game, busy, act() {} }));
}
function playButton(html: string) {
  const button = html.match(/<button\b[^>]*>Play Residual Poison against Emperor<\/button>/)?.[0];
  assert.ok(button, 'The original direct Residual action remains readable'); return button;
}
function priority(html: string) {
  assert.match(html, /aria-label="Provisional inspection priority"/);
  assert.match(html, /keep the original nonleader Atreides answer if it can still be honored on its own/);
  assert.match(html, /Both answers must permit one legal Battle Plan/);
  assert.match(html, /an extra Cunning answer may need to be answered again for the same field after a leader dies/);
  assert.match(html, /If the original answer becomes impossible, answer its original field again first/);
  assert.match(html, /This spends no additional Nexus card and does not redraw the victim/);
}

void test('Residual Poison persistently explains provisional native-first Cunning reconciliation without another choice', () => {
  const game = projected();
  for (let render = 0; render < 3; render++) {
    const html = markup(game); priority(html);
    assert.match(html, /Residual Poison: before choosing leaders/);
    assert.match(html, /leader is randomly sent to the Tanks, with no spice bounty/);
    assert.match(html, /You do not choose the leader/);
    assert.doesNotMatch(html, /Confirm reconciliation|Acknowledge|Choose a victim|Redraw victim|countdown/);
  }
});

void test('a true projected Residual availability remains enabled alongside the Cunning reminder', () => {
  const game = projected(), html = markup(game); priority(html);
  assert.doesNotMatch(playButton(html), /\sdisabled=/);
  assert.doesNotMatch(html, /Cunning.*(?:prevents|forbids) Residual Poison/);
});

void test('busy rendering keeps the inspection priority visible while disabling the original action', () => {
  const html = markup(projected(), true); priority(html);
  assert.match(playButton(html), /disabled=""/);
});

void test('native unavailable reasons remain authoritative and never imply that committed leaders can be poisoned', () => {
  for (const reason of [
    'A battle leader has already been committed.',
    'Finish the current inspection answer before using Residual Poison.',
    'No eligible opposing leader is available.',
  ]) {
    const game = projected(); game.residualPoison!.blocked = reason;
    for (let render = 0; render < 2; render++) {
      const html = markup(game); priority(html);
      assert.ok(html.includes(reason)); assert.match(playButton(html), /disabled=""/);
      assert.match(html, /Residual Poison: before choosing leaders/);
    }
  }
});

void test('missing original event or target still uses the pre-leader fallback rather than enabling the card', () => {
  const event = projected(); event.residualPoison!.event = null;
  const eventHtml = markup(event); priority(eventHtml);
  assert.match(eventHtml, /Use this card against your opponent before battle leaders are chosen/);
  assert.match(playButton(eventHtml), /disabled=""/);
  const target = projected(); target.residualPoison!.target = null;
  const targetHtml = markup(target); priority(targetHtml);
  assert.match(targetHtml, /Play Residual Poison against your battle opponent/);
  assert.match(targetHtml, /disabled=""[^>]*>Play Residual Poison against your battle opponent/);
  const absent = projected(); absent.residualPoison = null;
  assert.equal(markup(absent), '');
});

void test('the general priority reminder reads no hidden opposing hand or private inspection answer', () => {
  const game = projected();
  for (const player of game.players) for (const field of ['hand', 'spice', 'traitors', 'leaders'])
    Object.defineProperty(player, field, { get() { throw Error(`Residual guide read private ${field}`); } });
  Object.defineProperty(game, 'nexusAtreides', { get() { throw Error('Residual guide inspected private Cunning knowledge'); } });
  const html = markup(game); priority(html); assert.doesNotMatch(playButton(html), /\sdisabled=/);
});
