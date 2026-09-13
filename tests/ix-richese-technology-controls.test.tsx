import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IxRicheseTechnology } from '../components/ix-richese-technology';
import { RicheseAuctionDecision } from '../components/richese-auctions';
import {
  applyAction,
  createGame,
  initializeFactionExpansionsGameForAudit,
  joinGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';

function until(state: Game, kind: string) {
  let game = state;
  for (let step = 0; step < 100; step++) {
    if (game.decision?.kind === kind) return game;
    let next: Game | undefined;
    for (const player of game.players) {
      const action = botActions(viewGame(game, player.id))[0];
      if (action) {
        next = applyAction(game, player.id, action);
        break;
      }
    }
    assert.ok(next, `No action before ${kind}`);
    game = next;
  }
  throw new Error(`Did not reach ${kind}`);
}

function offer(source: 'cache' | 'blackMarket') {
  let game = createGame(
    'IXRICHUI',
    newPlayer('r', 'Richese', 'richese'),
    true,
    ['ix', 'choam'],
  );
  joinGame(game, newPlayer('i', 'Ixians', 'ixians'));
  joinGame(game, newPlayer('a', 'Atreides', 'atreides'));
  for (const player of game.players) {
    player.ready = true;
    player.bot = 'Medium';
  }
  game = until(
    initializeFactionExpansionsGameForAudit(game),
    'richeseBlackMarket',
  );
  if (source === 'cache') {
    game = applyAction(game, 'r', {
      type: 'decision',
      event: game.richeseBidding!.event,
      decline: true,
    });
    game = applyAction(game, 'r', {
      type: 'decision',
      event: game.richeseBidding!.event,
      position: 'first',
    });
    game = until(game, 'richeseCache');
  }
  const markup = renderToStaticMarkup(
    createElement(RicheseAuctionDecision, {
      game: viewGame(game, 'r'),
      act() {},
      busy: false,
    }),
  );
  assert.match(markup, /Offer (?:cache|Black Market) card/);
  assert.doesNotMatch(markup, /<button[^>]*\sdisabled=""[^>]*>Offer /);
  const card =
    source === 'cache' ? game.richeseCache![0] : game.players[0].hand[0];
  game = applyAction(game, 'r', {
    type: 'decision',
    event: game.richeseBidding!.event,
    card: card.id,
    method: 'silent',
    ...(source === 'blackMarket' ? { claim: 'Private card claim' } : {}),
  });
  assert.equal(game.decision?.kind, 'ixRicheseTechnology');
  return { game, card };
}

function render(game: Game, viewer = 'i', busy = false) {
  return renderToStaticMarkup(
    createElement(IxRicheseTechnology, {
      game: viewGame(game, viewer),
      act() {},
      busy,
    }),
  );
}

void test('Ixian special-lot decline is owned, available after reload and disabled during submission', () => {
  for (const source of ['cache', 'blackMarket'] as const) {
    const { game, card } = offer(source);
    const restored = JSON.parse(JSON.stringify(game)) as Game;
    const html = render(restored);
    assert.match(html, /Decline Technology for this lot/);
    assert.match(html, /once-per-round Technology use available/);
    assert.match(html, /custody/);
    assert.doesNotMatch(html, new RegExp(card.id));
    if (source === 'blackMarket') assert.ok(!html.includes(card.name));
    assert.equal(render(restored, 'r'), '');
    assert.equal(render(restored, 'a'), '');
    assert.match(render(restored, 'i', true), /<button[^>]*\sdisabled=""/);
    const completed = applyAction(restored, 'i', {
      type: 'decision',
      event: viewGame(restored, 'i').ixRicheseTechnology!.event,
      decline: true,
    });
    assert.equal(render(completed), '');
    assert.equal(completed.ixTechnologyTurn, game.ixTechnologyTurn);
    assert.equal(completed.richeseAuction?.cardId, card.id);
  }
});

void test('all four AI levels decline only this lot using the private owner view', () => {
  for (const source of ['cache', 'blackMarket'] as const) {
    const { game, card } = offer(source);
    for (const difficulty of DIFFICULTIES) {
      const view = viewGame(game, 'i');
      view.players.find((player) => player.id === 'i')!.bot = difficulty;
      const actions = botActions(view);
      assert.deepEqual(actions, [
        {
          type: 'decision',
          event: view.ixRicheseTechnology!.event,
          decline: true,
        },
      ]);
      const result = applyAction(game, 'i', actions[0]);
      assert.equal(result.richeseAuction?.cardId, card.id);
      assert.equal(result.ixTechnologyTurn, game.ixTechnologyTurn);
    }
  }
});
