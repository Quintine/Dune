import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import { baseDeck } from '../game/cards';
import { MoritaniEntry, SabotageGiftDiscardButton } from '../components/moritani-terror';

/** UI-only projection; the runtime suite owns the real physical arrival. */
function projected(viewer: 'entrant' | 'moritani'): GameView {
  const game = createGame('GIFTCONTROLS', newPlayer('moritani', 'Moritani', 'moritani'), false, ['ecaz']);
  joinGame(game, newPlayer('entrant', 'Entrant', 'emperor'));
  const view = viewGame(game, viewer);
  view.status = 'playing';
  view.phase = 5;
  view.decision = { kind: 'moritaniTerror', player: 'entrant', entrant: 'entrant', territory: 'arrakeen' };
  view.terrorEntry = { entrant: 'entrant', territory: 'arrakeen', sector: 9,
    cause: 'movement', stage: 'giftDiscard' } as unknown as GameView['terrorEntry'];
  const own = view.players.find(player => player.id === viewer)!;
  own.hand = baseDeck().slice(0, 2);
  return view;
}

void test('only the recipient sees their own cards and the provisional overflow choice', () => {
  const entrant = projected('entrant');
  const hand = entrant.players.find(player => player.id === 'entrant')!.hand!;
  const html = renderToStaticMarkup(createElement(MoritaniEntry, { game: entrant, busy: false, act() {} }));
  assert.match(html, /Sabotage gift · discard a card/);
  assert.match(html, /including the card you just received/);
  assert.match(html, /provisional interpretation/);
  for (const card of hand) {
    assert.ok(html.includes(card.name));
    assert.ok(html.includes(card.id));
  }
  const other = projected('moritani');
  assert.equal(renderToStaticMarkup(createElement(MoritaniEntry, { game: other, busy: false, act() {} })), '');
});

void test('the recipient button submits only a chosen physical card and respects busy state', () => {
  const actions: Action[] = [];
  const submit = (action: Action) => { actions.push(action); };
  SabotageGiftDiscardButton({ card: 'received-card', act: submit, disabled: false }).props.onClick();
  assert.deepEqual(actions, [{ type: 'decision', card: 'received-card' }]);
  SabotageGiftDiscardButton({ card: 'received-card', act: submit, disabled: true }).props.onClick();
  SabotageGiftDiscardButton({ card: null, act: submit, disabled: false }).props.onClick();
  assert.equal(actions.length, 1);
  const html = renderToStaticMarkup(createElement(MoritaniEntry, { game: projected('entrant'), busy: true, act() {} }));
  assert.match(html, /disabled=""[^>]*>Discard selected card/);
});
