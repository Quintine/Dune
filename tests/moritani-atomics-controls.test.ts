import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MoritaniEntry, MoritaniTerrorSupply } from '../components/moritani-terror';
import { TerrorBoardMarkers } from '../components/terror-board-markers';
import { createGame, joinGame, newPlayer, viewGame, type GameView } from '../game/engine';
import { createTerrorState, placeTerror, revealTerror } from '../game/moritani-terror';

function fixture() {
  const game = createGame('ATOMICS-CONTROLS', newPlayer('m', 'Moritani', 'moritani'));
  joinGame(game, newPlayer('a', 'Atreides', 'atreides'));
  joinGame(game, newPlayer('f', 'Fremen', 'fremen'));
  game.players.find((player) => player.id === 'm')!.ally = 'a';
  game.players.find((player) => player.id === 'a')!.ally = 'm';
  game.moritaniTerror = createTerrorState(() => 0);
  const token = game.moritaniTerror.tokens.find((item) => item.kind === 'atomics')!;
  game.moritaniTerror = placeTerror(game.moritaniTerror, token.id, 'arrakeen', 1);
  return { game, token };
}

const supply = (view: GameView) =>
  renderToStaticMarkup(createElement(MoritaniTerrorSupply, { game: view }));
const markers = (view: GameView) =>
  renderToStaticMarkup(createElement('svg', null, createElement(TerrorBoardMarkers, {
    tokens: view.moritaniTerror?.tokens ?? [], atomics: view.moritaniAtomics,
  })));

void test('a placed hidden face stays private; only owner sees the Atomics reveal consequences', () => {
  const { game } = fixture();
  const owner = viewGame(game, 'm');
  owner.decision = { kind: 'moritaniTerror', player: 'm', entrant: 'f', territory: 'arrakeen' };
  owner.terrorEntry = {
    entrant: 'f', territory: 'arrakeen', sector: 10, cause: 'shipment', stage: 'offer',
    kind: 'atomics', canReveal: true, canOfferAlliance: false,
  };
  const offer = renderToStaticMarkup(createElement(MoritaniEntry, { game: owner, busy: false, act() {} }));
  assert.match(offer, /Reveal Atomics/);
  assert.match(offer, /every faction’s forces/);
  assert.match(offer, /including Fremen reinforcements/);
  assert.match(offer, /discards one random card per excess/);
  const rival = viewGame(game, 'f');
  assert.match(supply(rival), /Inspect Hidden Terror/);
  assert.doesNotMatch(supply(rival), /Inspect Atomics|Atomics Aftermath/);
  assert.match(markers(rival), /hidden Terror token in Arrakeen/);
  assert.doesNotMatch(markers(rival), /Atomics Aftermath/);
  assert.equal(renderToStaticMarkup(createElement(MoritaniEntry, { game: rival, busy: false, act() {} })), '');
});

void test('after revelation all seats see persistent Aftermath and its exact shipment and hand-limit consequences', () => {
  const { game, token } = fixture();
  game.moritaniTerror = revealTerror(game.moritaniTerror!, token.id);
  game.moritaniAtomics = { territory: 'arrakeen', turn: 2, moritaniId: 'm',
    allyAtActivation: 'a', alliancePolicy: 'unresolved' };
  game.turn = 2;
  game.players.find((player) => player.id === 'm')!.atomicsHandLimitPenalty = true;
  game.players.find((player) => player.id === 'a')!.atomicsHandLimitPenalty = true;
  for (const id of ['m', 'a', 'f']) {
    const view = viewGame(game, id);
    const notice = supply(view);
    assert.match(notice, /Atomics Aftermath · Arrakeen/);
    assert.match(notice, /From turn 2, no faction may ship forces/);
    assert.match(notice, /including Fremen reinforcements/);
    assert.match(notice, /ordinary movement and Sneak Attack remain possible/);
    assert.match(notice, /Moritani and Atreides/);
    assert.match(notice, /lasting hand-limit reduction of one/);
    const board = markers(view);
    assert.match(board, /Atomics Aftermath in Arrakeen: permanent shipment ban/);
    assert.doesNotMatch(board, /hidden Terror token in Arrakeen/);
  }
});
