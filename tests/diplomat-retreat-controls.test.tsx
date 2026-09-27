import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DiplomatRetreat } from '../components/diplomat-retreat';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { viewGame, type GameView } from '../game/engine';
import { diplomatDefenseGame } from './diplomat-defense-fixture';

function offeredView(viewer = 'a'): GameView {
  const view = viewGame(diplomatDefenseGame(), viewer);
  view.decision = {
    kind: 'diplomatRetreat', player: 'a', event: 'retreat-event',
    destinations: [
      { location: 'imperial_basin:9', choices: [
        { normal: 1, elite: 0 },
        { normal: 2, elite: 1 },
        { normal: 1, elite: 2 },
      ] },
      { location: 'hagga_basin:12', choices: [
        { normal: 0, elite: 1 },
        { normal: 1, elite: 1 },
      ] },
    ],
  };
  return view;
}

void test('only the deciding player can select every offered destination and physical count or decline', () => {
  const view = offeredView();
  const markup = (game: GameView, busy = false) => renderToStaticMarkup(
    createElement(DiplomatRetreat, { game, act() {}, busy }),
  );
  const html = markup(view);
  assert.match(html, /aria-label="Diplomat retreat choice"/);
  assert.match(html, /Imperial Basin · sector 9/);
  assert.match(html, /Hagga Basin · sector 12/);
  assert.match(html, /2 ordinary · 1 elite/);
  assert.match(html, /1 ordinary · 2 elite/);
  assert.doesNotMatch(html, /0 ordinary · 1 elite/);
  assert.match(html, /Retreat to Imperial Basin · sector 9/);
  assert.match(html, /Decline Diplomat retreat/);
  assert.equal(markup(offeredView('d')), '');
  assert.equal((markup(view, true).match(/disabled=""/g) ?? []).length, 6);
  if (view.decision?.kind !== 'diplomatRetreat') throw new Error('Expected Diplomat retreat');
  view.decision.destinations.reverse();
  const alternate = markup(view);
  assert.match(alternate, /0 ordinary · 1 elite/);
  assert.doesNotMatch(alternate, /2 ordinary · 1 elite/);
  view.decision.destinations = [];
  assert.match(markup(view), /No legal retreat destination and force combination/);
  assert.doesNotMatch(markup(view), /Retreat to Imperial Basin/);
  assert.match(markup(view), /Decline Diplomat retreat/);
});

void test('all bot profiles select the first destination and largest legal physical count, or decline if none', () => {
  for (const difficulty of DIFFICULTIES) {
    const view = offeredView();
    view.players.find((player) => player.id === view.me)!.bot = difficulty;
    assert.deepEqual(botActions(view)[0], {
      type: 'decision', event: 'retreat-event',
      destination: 'imperial_basin:9', normal: 2, elite: 1,
    });
    if (view.decision?.kind !== 'diplomatRetreat') throw new Error('Expected Diplomat retreat');
    view.decision.destinations = [];
    assert.deepEqual(botActions(view)[0], {
      type: 'decision', event: 'retreat-event',
      destination: null, normal: 0, elite: 0,
    });
    const observer = offeredView('d');
    observer.players.find((player) => player.id === observer.me)!.bot = difficulty;
    assert.deepEqual(botActions(observer), []);
  }
});
