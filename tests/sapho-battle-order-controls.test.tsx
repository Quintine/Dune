import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, viewGame, type GameView } from '../game/engine';
import { JuiceOfSapho } from '../components/juice-of-sapho';
import { botBattleChoices } from '../game/bot-battle-choices';
import { saphoBattleOrderGame, saphoBattleOrderAction } from './fixture-sapho-battle-order';

const aliases = registerHooks({
  resolve(specifier, context, next) {
    return next(specifier === 'next/image' ? 'vinext/shims/image' : specifier === 'next/link' ? 'vinext/shims/link' : specifier, context);
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
const panel = (game: GameView, busy = false) => renderToStaticMarkup(createElement(JuiceOfSapho, { game, act() {}, busy }));
const table = (game: GameView) => renderToStaticMarkup(createElement(GameTable, { game, send: async () => {}, onExit() {}, busy: false }));

void test('held Sapho exposes the legal battle-order action with its actual timing and limits', () => {
  for (const [holder, mode] of [['c', 'first'], ['a', 'last']] as const) {
    const game = saphoBattleOrderGame({ holder, geometry: 'shared' });
    const view = viewGame(game, holder);
    const html = panel(view);
    assert.match(html, new RegExp(`Choose battles ${mode} and`));
    assert.match(html, /Other players may still choose battles against you/);
    assert.match(html, /not the aggressor or tie advantage/);
    assert.match(html, /Battle aggressor[\s\S]*unfinished/);
    assert.match(panel(view, true), /<button[^>]*disabled=""[^>]*>Choose battles/);
    const observer = game.players.find(player => player.id !== holder)!;
    assert.equal(panel(viewGame(game, observer.id)), '');
  }
});

void test('the actual table offers an earlier physical attacker as the reordered chooser’s opponent', () => {
  const original = saphoBattleOrderGame({ holder: 'c', geometry: 'shared' });
  const game = applyAction(original, 'c', saphoBattleOrderAction(original, 'c', 'first'));
  const view = viewGame(game, 'c');
  const html = table(view);
  const opponent = game.players.find(player => player.id === 'a')!;
  assert.match(html, new RegExp(`Fight ${opponent.name} · Arrakeen`));
  assert.match(html, /Remaining battle-choice order/);
  assert.doesNotMatch(html, /Choose battles first and/);
  const action = botBattleChoices(view).find(candidate => candidate.target === 'a' && candidate.territory === 'arrakeen');
  assert.ok(action);
  const opened = applyAction(game, 'c', action);
  assert.equal(opened.battle?.attacker, 'a');
  assert.equal(opened.battle?.defender, 'c');
});

void test('a held Sapho explains why ordering must wait through the current battle', () => {
  const game = saphoBattleOrderGame({ holder: 'c', geometry: 'shared' });
  const action = botBattleChoices(viewGame(game, game.active!))[0];
  assert.ok(action);
  const opened = applyAction(game, game.active!, action);
  const html = panel(viewGame(opened, 'c'));
  assert.doesNotMatch(html, /Choose battles (first|last) and/);
  assert.match(html, /Finish the current (battle|interaction)/);
});
