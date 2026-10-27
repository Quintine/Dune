import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createGame, newPlayer, viewGame, type Game } from '../game/engine';
import { baseDeck } from '../game/cards';

const aliases = registerHooks({
  resolve(specifier, context, next) {
    return next(specifier === 'next/image' ? 'vinext/shims/image' :
      specifier === 'next/link' ? 'vinext/shims/link' : specifier, context);
  },
  load(url, context, next) {
    if (!url.endsWith('.module.css')) return next(url, context);
    const css = readFileSync(new URL(url), 'utf8');
    const classes = Object.fromEntries([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(match => [match[1], match[1]]));
    return { format: 'module', source: `export default ${JSON.stringify(classes)}`, shortCircuit: true };
  },
});
const { GameTable } = await import('../components/game-table');
aliases.deregister();

/** Controlled projection of a live Advanced Revival turn; runtime tests own
 * the actual force deaths, physical revival, and later ordinary allowance. */
function game(tanks: number, eliteTanks: number, alreadyRevived: number): Game {
  const game = createGame('EMPERORREVIVALUI', newPlayer('emperor', 'Emperor', 'emperor'), true);
  game.players.push(newPlayer('atreides', 'Atreides', 'atreides'));
  Object.assign(game, { status: 'playing', phase: 4, turn: 2, order: ['emperor', 'atreides'], active: 'emperor' });
  const emperor = game.players[0];
  emperor.tanks = tanks;
  emperor.reserves = 20 - tanks;
  emperor.elites = { tanks: eliteTanks, reserves: 5 - eliteTanks, forces: {}, revived: alreadyRevived };
  const deck = baseDeck();
  const index = deck.findIndex(card => card.effect === 'karama');
  assert.ok(index >= 0);
  emperor.hand = [deck.splice(index, 1)[0]];
  game.deck = deck;
  return game;
}

function markup(state: Game, seat = 'emperor') {
  return renderToStaticMarkup(createElement(GameTable, { game: viewGame(state, seat), busy: false,
    send: async () => {}, onExit() {} }));
}
function specialControls(html: string) {
  const start = html.indexOf('Once per game: revive up to three forces');
  assert.ok(start >= 0, 'The Emperor owns a visible special Karama control');
  const end = html.indexOf('Use special Karama · forces', start);
  assert.ok(end > start);
  return html.slice(start, end + 'Use special Karama · forces'.length + 50);
}
function eliteInput(html: string): string {
  const input = html.match(/Sardaukar to revive\s*(<input\b[^>]*>)/)?.[1];
  assert.ok(input, 'The actual Sardaukar selector is visible');
  return input;
}

void test('Emperor special UI includes available Sardaukar despite an already used ordinary starred allowance', () => {
  const html = specialControls(markup(game(3, 3, 1)));
  assert.match(html, /ordinary revival allowances, including the normal\s*one-Sardaukar limit/);
  assert.match(html, /Forces to revive\s*<input\b[^>]*max="3"/);
  const input = eliteInput(html);
  assert.match(input, /\bmin="1"/);
  assert.match(input, /\bmax="1"/);
  assert.match(input, /\bvalue="0"/);
  assert.match(html, /disabled=""[^>]*>Use special Karama · forces/,
    'The initial zero-elite selection is invalid when only Sardaukar are available');
});

void test('special UI respects physical stocks and does not expose another player’s hand controls', () => {
  const mixed = specialControls(markup(game(3, 2, 1)));
  const mixedInput = eliteInput(mixed);
  assert.match(mixedInput, /\bmin="0"/);
  assert.match(mixedInput, /\bmax="1"/);
  assert.doesNotMatch(mixed, /disabled=""[^>]*>Use special Karama · forces/);
  const noElites = eliteInput(specialControls(markup(game(2, 0, 1))));
  assert.match(noElites, /\bmax="0"/);
  assert.doesNotMatch(markup(game(3, 3, 1), 'atreides'), /Use special Karama · forces/);
});
