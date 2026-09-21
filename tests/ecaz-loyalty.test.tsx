import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { leaders } from '../game/cards';
import { chooseEcazLoyalty, withoutEcazLoyalty } from '../game/ecaz-loyalty';
import { createGame, newPlayer, applyAction, viewGame, normalizeAutomaticGame } from '../game/engine';

const aliases = registerHooks({ resolve(specifier, context, next) { return next(specifier === 'next/link' ? 'vinext/shims/link' : specifier === 'next/image' ? 'vinext/shims/image' : specifier, context); } });
const { EcazLoyaltyCard } = await import('../components/ecaz-loyalty');
aliases.deregister();

void test('Loyalty selects each native Ecaz physical card and excludes it without changing the supplied inventory', () => {
  const native = leaders('ecaz').map(leader => leader.id);
  const deck = Object.freeze([...native, ...leaders('harkonnen').map(leader => leader.id)]);
  const selected = native.map((_, index) => chooseEcazLoyalty(deck, (index + .5) / native.length));
  assert.deepEqual(selected, native);
  for (const card of selected) {
    const remaining = withoutEcazLoyalty(deck, { player: 'e', card });
    assert.equal(remaining.length, deck.length - 1);
    assert.ok(!remaining.includes(card));
    assert.deepEqual([...remaining, card].sort(), [...deck].sort());
  }
  assert.throws(() => chooseEcazLoyalty(deck.slice(1), .5), /intact/);
  assert.throws(() => chooseEcazLoyalty([...deck, native[0]], .5), /intact/);
  for (const roll of [-.01, 1, NaN, Infinity]) assert.throws(() => chooseEcazLoyalty(deck, roll), /valid random/);
});

void test('a copied or invalid set-aside card fails before actions, normalization or projection mutate the state', () => {
  const game = createGame('LOYALBAD', newPlayer('e', 'Ecaz', 'ecaz'), true);
  game.status = 'playing';
  game.ecazLoyalty = { player: 'e', card: leaders('ecaz')[0].id };
  for (const corrupt of [
    () => { game.players[0].traitors.push(game.ecazLoyalty!.card!); },
    () => { game.ecazLoyalty!.card = 'duke-vidal'; },
    () => { game.ecazLoyalty!.card = null; },
  ]) {
    const saved = structuredClone(game);
    corrupt();
    const before = JSON.stringify(game);
    for (const operation of [() => applyAction(game, 'e', { type: 'ready' }), () => normalizeAutomaticGame(game), () => viewGame(game, 'e')]) {
      assert.throws(operation, /Loyalty/);
      assert.equal(JSON.stringify(game), before);
    }
    Object.assign(game, saved);
  }
});

void test('the public Loyalty panel shows only the supplied identity with an inspector and no acknowledgement', () => {
  assert.equal(renderToStaticMarkup(createElement(EcazLoyaltyCard, { loyalty: null })), '');
  for (const leader of leaders('ecaz')) {
    const html = renderToStaticMarkup(createElement(EcazLoyaltyCard, { loyalty: { player: 'e', card: leader.id } }));
    assert.match(html, /Ecaz Loyalty card/);
    assert.ok(html.includes(`Inspect traitor: ${leader.name}`));
    assert.match(html, /cannot be drawn as a Traitor or Face Dancer/);
    assert.match(html, /href="\/rules\?topic=ecaz-loyalty#ecaz-loyalty"/);
    assert.doesNotMatch(html, /Acknowledge|Confirm|Accept|Pass this/);
    for (const other of leaders('ecaz').filter(candidate => candidate.id !== leader.id)) assert.ok(!html.includes(other.name));
  }
});
