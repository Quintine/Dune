import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, viewGame } from '../game/engine';
import type { Game, GameView } from '../game/engine';
import { botActions } from '../game/bots';
import { battlePlanCardOptions } from '../components/battle-preparation';
import { harassWithdrawGame, takeHarassCard } from './fixture-harass-withdraw';

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
// GameTable loads framework aliases and CSS modules; install test hooks before importing it.
const { GameTable } = await import('../components/game-table');
aliases.deregister();

const cardId = 'ecaz-reinforcements';

function battle(advanced = false): Game {
  const game = harassWithdrawGame({ advanced, factions: ['emperor', 'atreides', 'harkonnen'] });
  takeHarassCard(game, 'a', cardId);
  return game;
}

function selections(view: GameView, leader = 'emperor-0') {
  return (['weapon', 'defense'] as const).map(slot =>
    battlePlanCardOptions(view, slot, leader, '', '').some(card => card.id === cardId));
}

function selector(html: string, slot: 'weapon' | 'defense') {
  const select = html.match(new RegExp(`<select[^>]*id="battle-${slot}"[^>]*>[\\s\\S]*?<\\/select>`))?.[0];
  assert.ok(select, `Missing ${slot} selection`);
  return select;
}

void test('a held Reinforcements card with an owner offer is selectable in either physical slot, but never appears in another player’s view', () => {
  const game = battle();
  const owner = viewGame(game, 'a');
  assert.deepEqual(owner.battle?.reinforcements, { blocked: null, normal: 3, elite: 0 });
  assert.deepEqual(selections(owner), [true, true]);
  const html = renderToStaticMarkup(createElement(GameTable, { game: owner, send: async () => {}, onExit() {}, busy: false }));
  for (const slot of ['weapon', 'defense'] as const)
    assert.match(selector(html, slot), /value="ecaz-reinforcements"/);

  const opponent = viewGame(game, 'd');
  assert.equal(opponent.battle?.reinforcements, null);
  assert.ok(!opponent.players.find(player => player.id === 'a')?.hand?.some(card => card.id === cardId));
  assert.deepEqual(selections(opponent), [false, false]);
  const opponentHtml = renderToStaticMarkup(createElement(GameTable, { game: opponent, send: async () => {}, onExit() {}, busy: false }));
  assert.doesNotMatch(opponentHtml, /value="ecaz-reinforcements"/);
});

void test('paired Ecaz/Moritani holders have private two-slot controls and legal AI plans', () => {
  for (const advanced of [false, true]) for (const owner of ['ecaz', 'moritani'] as const) {
    const game = harassWithdrawGame({ advanced, factions: [owner, owner === 'ecaz' ? 'moritani' : 'ecaz', 'atreides'] });
    takeHarassCard(game, 'a', cardId);
    const view = viewGame(game, 'a');
    assert.deepEqual(selections(view, `${owner}-0`), [true, true]);
    const html = renderToStaticMarkup(createElement(GameTable, { game: view, send: async () => {}, onExit() {}, busy: false }));
    assert.match(selector(html, 'weapon'), /value="ecaz-reinforcements"/);
    assert.match(selector(html, 'defense'), /value="ecaz-reinforcements"/);
    const opponent = viewGame(game, 'd');
    assert.equal(opponent.battle?.reinforcements, null);
    assert.ok(!opponent.players.find(player => player.id === 'a')?.hand?.some(card => card.id === cardId));
    for (const profile of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
      view.players.find(player => player.id === 'a')!.bot = profile;
      const choice = botActions(view).find(action =>
        action.type === 'battlePlan' && (action.weapon === cardId || action.defense === cardId));
      assert.ok(choice, `${owner} ${profile} ${advanced ? 'Advanced' : 'Basic'}`);
      assert.ok(applyAction(game, 'a', choice).battle?.plans.a);
    }
  }
});

void test('a no-category inspection permits a held Reinforcements card but a second slot cannot reuse it', () => {
  const view = viewGame(battle(), 'a');
  view.battle!.ownCommitments = [{ source: 'native', beneficiary: 'd', target: 'a', field: 'weapon', value: null }];
  assert.ok(battlePlanCardOptions(view, 'weapon', 'emperor-0', '', '').some(card => card.id === cardId));
  assert.ok(!battlePlanCardOptions(view, 'weapon', 'emperor-0', '', cardId).some(card => card.id === cardId));
  view.battle!.ownCommitments[0].value = 'ecaz-harass-withdraw';
  assert.ok(!battlePlanCardOptions(view, 'weapon', 'emperor-0', '', '').some(card => card.id === cardId));
});

void test('blocked, absent, or unheld owner offers cannot make Reinforcements selectable', () => {
  const view = viewGame(battle(), 'a');
  assert.ok(view.battle?.reinforcements);
  const offer = view.battle.reinforcements;
  for (const blockedOffer of [{ ...offer, blocked: 'Unsupported battle combination.' }, null]) {
    view.battle.reinforcements = blockedOffer;
    assert.deepEqual(selections(view), [false, false]);
    const html = renderToStaticMarkup(createElement(GameTable, { game: view, send: async () => {}, onExit() {}, busy: false }));
    for (const slot of ['weapon', 'defense'] as const)
      assert.doesNotMatch(selector(html, slot), /value="ecaz-reinforcements"/);
  }
  view.battle.reinforcements = offer;
  view.players.find(player => player.id === 'a')!.hand = view.players.find(player => player.id === 'a')!.hand!.filter(card => card.id !== cardId);
  assert.deepEqual(selections(view), [false, false]);
});

void test('bot candidates using Reinforcements in both slots seal as legal Basic and Advanced plans; absent or blocked offers retain legal alternatives', () => {
  for (const advanced of [false, true]) {
    const game = battle(advanced);
    const view = viewGame(game, 'a');
    view.players.find(player => player.id === 'a')!.bot = 'Medium';
    const actions = botActions(view).filter(action => action.type === 'battlePlan');
    for (const slot of ['weapon', 'defense'] as const) {
      const other = slot === 'weapon' ? 'defense' : 'weapon';
      const plan = actions.find(action => action[slot] === cardId && !action[other]);
      assert.ok(plan, `Missing ${advanced ? 'Advanced' : 'Basic'} ${slot} Reinforcements candidate`);
      const sealed = applyAction(game, 'a', plan);
      assert.equal(sealed.battle?.plans.a?.[slot], cardId);
    }
    for (const offer of [null, { ...view.battle!.reinforcements!, blocked: 'Unsupported battle combination.' }]) {
      view.battle!.reinforcements = offer;
      const fallback = botActions(view);
      const ordinaryPlan = fallback.find(action => action.type === 'battlePlan' && action.weapon !== cardId && action.defense !== cardId);
      assert.ok(ordinaryPlan);
      assert.ok(fallback.every(action => action.weapon !== cardId && action.defense !== cardId));
      assert.ok(applyAction(game, 'a', ordinaryPlan).battle?.plans.a);
    }
  }
});
