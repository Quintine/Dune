import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createGame, newPlayer, viewGame, type GameView } from '../game/engine';
import { baseDeck, ixBattleCards } from '../game/cards';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import { battlePlanCardValue, battlePlanCardOptions, bindBattlePlanCommitments, BattlePreparation } from '../components/battle-preparation';
import { harassWithdrawControlState, HarassWithdrawGuide } from '../components/harass-withdraw';

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

const harass = ecazTreacheryCards().find(card => card.effect === 'harassWithdraw')!;
const projectile = baseDeck().find(card => card.kind === 'projectile')!;

// Rendering fixture only; engine and recovery tests earn these projections.
function fixture(): GameView {
  const g = createGame('ECAZBATTLEUI', newPlayer('a', 'Atreides', 'atreides'));
  g.players.push(newPlayer('h', 'Harkonnen', 'harkonnen'));
  Object.assign(g, { status: 'playing', phase: 6, turn: 2, storm: 18, active: 'a', order: ['a', 'h'] });
  g.deck = baseDeck();
  for (const player of g.players) {
    player.hand = [];
    player.forces = { 'arrakeen:10': 4 };
    player.reserves = 16;
    player.spice = 10;
    player.traitors = [];
  }
  g.battle = { event: 'battle-ecaz-ui', territory: 'arrakeen', attacker: 'a', defender: 'h',
    prepared: true, plans: {}, revealed: false, traitorCalls: {} };
  const view = viewGame(g, 'h');
  view.players[1].hand = [projectile, ...ecazTreacheryCards()];
  view.battle!.harassWithdraw = {
    card: 'ecaz-harass-withdraw', blocked: null,
    forces: { normal: 4, elite: 0, eliteStrength: 1, freeSupport: true },
    locations: { 'arrakeen:10': { normal: 4, elite: 0 } },
  };
  view.battle!.ownCommitments = [{ source: 'native', beneficiary: 'a', target: 'h', field: 'weapon', value: null }];
  return view;
}

void test('a no-category inspection preserves a selected Harass card while binding other committed elements', () => {
  const view = fixture();
  view.battle!.ownCommitments.push({ source: 'nexus', beneficiary: 'a', target: 'h', field: 'dial', value: 2 });
  const action = { type: 'battlePlan', dial: 0, leader: 'harkonnen-0', weapon: harass.id, defense: null };
  assert.equal(battlePlanCardValue(view, 'weapon', harass.id), harass.id);
  assert.deepEqual(bindBattlePlanCommitments(view, action), { ...action, dial: 2 });
  assert.equal(action.dial, 0);
  assert.equal(bindBattlePlanCommitments(view, { ...action, weapon: projectile.id }).weapon, null);
  assert.equal(bindBattlePlanCommitments(view, { ...action, weapon: 'unknown-card' }).weapon, null);
  view.players[1].hand = [{ ...harass, name: 'Forged card' }];
  assert.equal(bindBattlePlanCommitments(view, action).weapon, null);
});

void test('named card inspections still lock their exact physical card, including existing Planetologist behavior', () => {
  const view = fixture();
  const atomics = baseDeck().find(card => card.effect === 'atomics')!;
  view.players[1].hand!.push(atomics);
  for (const card of [projectile, atomics]) {
    view.battle!.ownCommitments[0].value = card.id;
    assert.equal(battlePlanCardValue(view, 'weapon', harass.id), card.id);
    assert.equal(bindBattlePlanCommitments(view, { type: 'battlePlan', weapon: harass.id }).weapon, card.id);
  }
});

void test('the table keeps a no-category slot selectable and offers Harass without unfinished Reinforcements', () => {
  const view = fixture();
  const html = renderToStaticMarkup(createElement(GameTable, { game: view, send: async () => {}, onExit() {}, busy: false }));
  const select = html.match(/<select[^>]*id="battle-weapon"[^>]*>[\s\S]*?<\/select>/)?.[0];
  assert.ok(select);
  assert.doesNotMatch(select, /disabled|ecaz-reinforcements|ecaz-recruits|value="treachery-/);
  assert.match(select, /value="ecaz-harass-withdraw"/);
  assert.match(html, /Harass and Withdraw battle guidance/);
});

void test('the category answer control explains None without exposing a special as a named answer', () => {
  const view = fixture();
  view.battle!.preparation = { kind: 'prescienceAnswer', owner: 'h', beneficiary: 'a' };
  view.battle!.prescience = { player: 'a', field: 'weapon', answered: false };
  const html = renderToStaticMarkup(createElement(BattlePreparation, { game: view, send: async () => {}, busy: false }));
  assert.match(html, /Choose None/);
  assert.doesNotMatch(html, /<option[^>]*value="ecaz-/);
  view.battle!.harassWithdraw = { ...view.battle!.harassWithdraw!, blocked: 'This card combination awaits a ruling.' };
  const blocked = renderToStaticMarkup(createElement(BattlePreparation, { game: view, send: async () => {}, busy: false }));
  assert.doesNotMatch(blocked, /Choose None/);
});

void test('choosing Harass in Defense first excludes a duplicate physical card and Chemistry from Weapon', () => {
  const view = fixture();
  view.battle!.ownCommitments = [];
  const chemistry = ixBattleCards().find(card => card.kind === 'chemistry')!;
  view.players[1].hand!.push(chemistry);
  const choices = battlePlanCardOptions(view, 'weapon', 'harkonnen-0', '', harass.id);
  assert.ok(choices.some(card => card.id === projectile.id));
  assert.ok(!choices.some(card => card.id === harass.id || card.id === chemistry.id));
  assert.ok(battlePlanCardOptions(view, 'weapon', 'harkonnen-0', '', chemistry.id).some(card => card.id === harass.id));
});

void test('the guide uses the physical return quote and gives an actionable reason for unsupported commitments', () => {
  const preview = fixture().battle!.harassWithdraw!;
  const state = harassWithdrawControlState(preview, true, 1, 0);
  assert.deepEqual(state.returned, { normal: 3, elite: 0 });
  const html = renderToStaticMarkup(createElement(HarassWithdrawGuide, { preview, state }));
  assert.match(html, /Return 3 ordinary and 0 elite/);
  assert.match(html, /successful traitor call cancels/);
  assert.equal(harassWithdrawControlState(preview, false, 1, 0).blocked, null);
  assert.ok(harassWithdrawControlState(preview, true, 1.5, 0).blocked);
  const blocked = { ...preview, blocked: 'Finish the unsupported combined module first.' };
  assert.equal(harassWithdrawControlState(blocked, true, 1, 0).blocked, blocked.blocked);
});
