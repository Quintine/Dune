import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  RicheseNoFieldControls,
  SmugglerNoFieldChoice,
} from '../components/richese-no-field';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { applyAction, viewGame, type Game } from '../game/engine';
import { presenceAt } from '../game/force-presence';
import {
  smugglerNoFieldAction,
  smugglerNoFieldGame,
} from './smuggler-no-field-fixture';

function markup(game: Game, viewer = 'r', destination = 'arrakeen') {
  return renderToStaticMarkup(
    createElement(RicheseNoFieldControls, {
      game: viewGame(game, viewer),
      act() {},
      busy: false,
      destination,
      sector: destination === 'arrakeen' ? 10 : 9,
      allyPayment: '',
    }),
  );
}

void test('the private No-Field panel offers an unchecked free real-force companion without changing the marker price', () => {
  const html = markup(smugglerNoFieldGame());
  assert.match(html, /Private No-Field inventory/);
  for (const value of [0, 3, 5])
    assert.match(html, new RegExp(`No-Field ${value}`));
  assert.match(
    html,
    /Use Smuggler to add 1 real reserve force at no added cost/,
  );
  assert.doesNotMatch(html, /type="checkbox" checked=""/);
  assert.match(
    html,
    /No-Field token still uses the normal one-force shipment price/,
  );
  assert.match(html, /Ship concealed No-Field [035] · 1 spice/);
  assert.match(
    html,
    /Smuggler companion is a separate real force that leaves reserves immediately/,
  );

  const optedIn = renderToStaticMarkup(
    createElement(SmugglerNoFieldChoice, {
      quote: { leader: 'richese-0', amount: 1 },
      use: true,
      busy: false,
      onChange() {},
    }),
  );
  assert.match(optedIn, /type="checkbox" checked=""/);
  assert.match(optedIn, /hidden forces remain in reserves until revelation/);
  assert.match(markup(smugglerNoFieldGame(true)), /Use Smuggler/);
});

void test('the companion choice follows empty-territory and real-reserve gates and remains owner-private', () => {
  const occupied = smugglerNoFieldGame();
  occupied.players.find((player) => player.id === 'h')!.forces = {
    'arrakeen:9': 1,
  };
  occupied.players.find((player) => player.id === 'h')!.reserves = 19;
  assert.doesNotMatch(markup(occupied), /Use Smuggler/);

  const emptyReserves = smugglerNoFieldGame();
  emptyReserves.players.find((player) => player.id === 'r')!.reserves = 0;
  assert.doesNotMatch(markup(emptyReserves), /Use Smuggler/);

  const privateGame = smugglerNoFieldGame();
  assert.equal(markup(privateGame, 'h'), '');
  assert.equal(viewGame(privateGame, 'h').richeseNoField!.private, null);
  assert.doesNotMatch(markup(privateGame, 'h'), /No-Field [035]/);
});

void test('all four bot profiles add the legal companion to owned No-Field shipments', () => {
  for (const advanced of [false, true])
    for (const difficulty of DIFFICULTIES) {
      const game = smugglerNoFieldGame(advanced);
      const view = viewGame(game, 'r');
      view.players.find((player) => player.id === 'r')!.bot = difficulty;
      const noFieldActions = botActions(view).filter(
        (action) => action.type === 'ship' && action.noField,
      );
      const candidates = noFieldActions.filter(
        (action) => action.smuggler === true,
      );
      assert.ok(
        candidates.length,
        `${advanced ? 'Advanced' : 'Basic'} ${difficulty} omitted the companion`,
      );
      assert.ok(
        noFieldActions.every((action) => action.smuggler === true),
        `${advanced ? 'Advanced' : 'Basic'} ${difficulty} left a legal owned No-Field candidate unaugmented`,
      );
      const destination = String(candidates[0].territory);
      let settled = applyAction(game, 'r', candidates[0]);
      if (settled.decision?.kind === 'guildShipment')
        settled = applyAction(settled, settled.decision.player, {
          type: 'decision',
          allow: true,
        });
      assert.equal(settled.players[0].reserves, 19);
      assert.equal(presenceAt(settled.players[0], destination), 2);
    }
});

void test('all profiles reveal a zero No-Field before moving when its real companion is alongside it', () => {
  for (const difficulty of DIFFICULTIES) {
    let game = smugglerNoFieldGame();
    game = applyAction(game, 'r', smugglerNoFieldAction(game, 0, true));
    game.active = 'r';
    const view = viewGame(game, 'r');
    view.players.find((player) => player.id === 'r')!.bot = difficulty;
    const reveal = botActions(view)[0];
    assert.equal(reveal.type, 'revealNoField', difficulty);
    game = applyAction(game, 'r', reveal);
    assert.equal(game.players[0].noField!.deployed, null);
    assert.equal(game.players[0].reserves, 19);
    assert.equal(presenceAt(game.players[0], 'arrakeen'), 1);
  }
});
