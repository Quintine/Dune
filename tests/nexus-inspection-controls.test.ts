import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createGame, newPlayer, viewGame, type GameView, type PlanField } from '../game/engine';
import { baseDeck } from '../game/cards';
import {
  BattlePreparation, NexusInspectionHistory, battlePlanCommitments,
  bindBattlePlanCommitments, battlePreparationField, battleInspectionAnswerAction,
} from '../components/battle-preparation';

const aliases = registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === 'next/image' ? 'vinext/shims/image' : specifier === 'next/link' ? 'vinext/shims/link' : specifier, context);
}, load(url, context, nextLoad) {
  if (!url.endsWith('.module.css')) return nextLoad(url, context);
  // Node has no CSS-module loader. Preserve real selector names for structural
  // rendering; this does not replace any component or claim visual CSS QA.
  const css = readFileSync(new URL(url), 'utf8');
  const classes = Object.fromEntries([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((match) => [match[1], match[1]]));
  return { format: 'module', source: `export default ${JSON.stringify(classes)}`, shortCircuit: true };
} });
const { NexusCards, nexusAtreidesAction } = await import('../components/nexus-cards');
const { GameTable } = await import('../components/game-table');
aliases.deregister();

/** Presentation fixture: full ordinary view plus explicit private projections.
 * Engine/recovery suites separately prove how those projections are earned. */
function fixture(me = 'a'): GameView {
  const g = createGame('NEXUSINSPECTUI', newPlayer('a', 'Atreides', 'atreides'));
  g.players.push(newPlayer('h', 'Harkonnen', 'harkonnen'), newPlayer('e', 'Emperor', 'emperor'));
  Object.assign(g, { status: 'playing', phase: 6, turn: 2, storm: 18, active: 'a', order: ['a', 'h', 'e'] });
  g.deck = baseDeck();
  for (const player of g.players) {
    player.hand = [];
    player.forces = player.id === 'e' ? {} : { 'arrakeen:10': 4 };
    player.reserves = player.id === 'e' ? 20 : 16;
    player.spice = 10;
    player.traitors = [];
  }
  g.battle = { event: 'battle-ui', territory: 'arrakeen', attacker: 'a', defender: 'h',
    prepared: true, plans: {}, revealed: false, traitorCalls: {} };
  const view = viewGame(g, me);
  view.nexusCards = { card: 'atreides', deckCount: 11, discardCount: 0,
    held: { a: true, h: false, e: false }, turn: null, choices: [], waiting: [] };
  view.nexusAtreides = { event: 'battle-ui', mode: 'cunning', fields: ['leader', 'defense', 'dial'], blocked: null };
  view.battle!.ownCommitments = [];
  view.battle!.nexusInsights = [];
  return view;
}
function nexusHtml(view: GameView, busy = false) {
  return renderToStaticMarkup(createElement(NexusCards, { game: view, act() {}, busy }));
}
function tableHtml(view: GameView) {
  return renderToStaticMarkup(createElement(GameTable, { game: view, send: async () => {}, onExit() {}, busy: false }));
}
function inspection(view: GameView, field: PlanField = 'defense') {
  view.battle!.nexusInspection = { event: 'battle-ui', mode: 'cunning', owner: 'a', target: 'h', field, stage: 'answer' };
  view.battle!.preparation = { kind: 'nexusPrescienceAnswer', owner: 'h', beneficiary: 'a' };
}

void test('Cunning offers only projected distinct fields and binds the exact battle event', () => {
  const view = fixture();
  assert.deepEqual(nexusAtreidesAction(view, 'defense'), { type: 'nexusAtreides', event: 'battle-ui', mode: 'cunning', field: 'defense' });
  assert.equal(nexusAtreidesAction(view, 'weapon'), null);
  const html = nexusHtml(view);
  assert.match(html, /Use Cunning: inspect defense/);
  assert.doesNotMatch(html, /Use Cunning: inspect weapon/);
  assert.match(nexusHtml(view, true), /<button[^>]*disabled=""[^>]*>Use Cunning: inspect defense/);
  for (const change of [
    (v: GameView) => { v.nexusAtreides!.event = 'another-battle'; },
    (v: GameView) => { v.nexusAtreides!.blocked = 'Finish the current response.'; },
    (v: GameView) => { v.battle!.submitted.push('a'); },
    (v: GameView) => { v.battle!.revealed = true; },
    (v: GameView) => { v.phase = 5; },
    (v: GameView) => { v.status = 'finished'; },
    (v: GameView) => { v.me = 'h'; },
    (v: GameView) => { v.nexusCards!.card = 'fremen'; },
  ]) {
    const stale = fixture(); change(stale);
    assert.equal(nexusAtreidesAction(stale, 'defense'), null);
  }
});

void test('Secret Ally follows projected dial access even with a public No-Field; Cunning cannot add an excluded dial', () => {
  const view = fixture();
  view.players[0].faction = 'fremen';
  view.nexusAtreides!.mode = 'secretAlly';
  view.nexusAtreides!.fields = ['leader', 'weapon', 'defense', 'dial'];
  view.battle!.noFieldPlayers = ['h'];
  assert.deepEqual(nexusAtreidesAction(view, 'dial'), { type: 'nexusAtreides', event: 'battle-ui', mode: 'secretAlly', field: 'dial' });
  assert.match(nexusHtml(view), /Use Secret Ally: inspect dial/);
  view.players[0].faction = 'atreides';
  view.nexusAtreides!.mode = 'cunning';
  view.nexusAtreides!.fields = ['leader', 'defense'];
  assert.equal(nexusAtreidesAction(view, 'dial'), null);
});

void test('Betrayal uses a card-bound reaction without inventing a field or bypassing a pending server guard', () => {
  const view = fixture('e');
  view.nexusAtreides!.mode = 'betrayal';
  view.nexusAtreides!.fields = [];
  assert.deepEqual(nexusAtreidesAction(view), { type: 'nexusAtreides', event: 'battle-ui', mode: 'betrayal' });
  assert.equal(nexusAtreidesAction(view, 'dial'), null);
  assert.match(nexusHtml(view), />Use Betrayal</);
  view.nexusAtreides!.blocked = 'Response timing is awaiting a ruling.';
  const html = nexusHtml(view);
  assert.match(html, /Response timing is awaiting a ruling/);
  assert.doesNotMatch(html, />Use Betrayal</);
});

void test('Nexus answer selects its own field, preserving the native action and binding the new event', () => {
  const view = fixture('h');
  inspection(view);
  view.battle!.prescience = { player: 'a', field: 'weapon', answered: true };
  assert.equal(battlePreparationField(view), 'defense');
  assert.deepEqual(battleInspectionAnswerAction(view, ''), { type: 'nexusPrescienceAnswer', event: 'battle-ui', value: null });
  const html = renderToStaticMarkup(createElement(BattlePreparation, { game: view, send: async () => {}, busy: false }));
  assert.match(html, /Reveal your defense/);
  assert.doesNotMatch(html, /Reveal your weapon/);
  view.battle!.nexusInspection!.event = 'old-battle';
  assert.equal(battleInspectionAnswerAction(view, ''), null);
  view.battle!.nexusInspection!.event = 'battle-ui';
  view.battle!.nexusInspection!.target = 'e';
  assert.equal(battleInspectionAnswerAction(view, ''), null);
  view.battle!.nexusInspection!.target = 'h';
  view.battle!.nexusInspection!.field = 'dial';
  assert.deepEqual(battleInspectionAnswerAction(view, '2.5'), { type: 'nexusPrescienceAnswer', event: 'battle-ui', value: 2.5 });
  for (const value of ['', ' ', 'NaN', 'Infinity', '-1', '0.25']) assert.equal(battleInspectionAnswerAction(view, value), null);
  view.battle!.nexusInspection!.stage = 'answered';
  assert.equal(battleInspectionAnswerAction(view, '2'), null);
  view.battle!.preparation!.kind = 'prescienceAnswer';
  assert.equal(battlePreparationField(view), 'weapon');
  assert.deepEqual(battleInspectionAnswerAction(view, 'projectile-1'), { type: 'prescienceAnswer', value: 'projectile-1' });
  view.me = 'e';
  assert.equal(battleInspectionAnswerAction(view, 'projectile-1'), null);
});

void test('every simultaneous own commitment overrides plan submission, including zero and None, without affecting unrelated fields', () => {
  const view = fixture('h');
  view.battle!.ownCommitments = [
    { source: 'native', beneficiary: 'a', target: 'h', field: 'dial', value: 0 },
    { source: 'nexus', beneficiary: 'a', target: 'h', field: 'defense', value: null },
  ];
  const plan = { type: 'battlePlan', dial: 4, defense: 'snooper', leader: 'harkonnen-0', weapon: 'projectile-1', support: 3 };
  const before = JSON.stringify(view);
  assert.deepEqual(Object.keys(battlePlanCommitments(view)).sort(), ['defense', 'dial']);
  assert.deepEqual(bindBattlePlanCommitments(view, plan), { ...plan, dial: 0, defense: null });
  assert.equal(plan.dial, 4);
  assert.equal(JSON.stringify(view), before);
  view.me = 'a';
  assert.deepEqual(bindBattlePlanCommitments(view, plan), plan);
  view.battle!.ownCommitments = [];
  assert.deepEqual(battlePlanCommitments(view), {});
});

void test('the actual battle table locks each native-plus-Nexus field pair to the same values used by submission', () => {
  for (const fields of [['dial', 'defense'], ['leader', 'weapon']] as const) {
    const view = fixture('h');
    view.nexusAtreides = null;
    view.nexusCards = null;
    const values = { dial: 0, defense: null, leader: view.players.find((p) => p.id === 'h')!.leaders[0].id, weapon: null };
    view.battle!.ownCommitments = fields.map((field, index) => ({ source: index ? 'nexus' : 'native', beneficiary: 'a', target: 'h', field, value: values[field] }));
    const html = tableHtml(view);
    for (const field of fields) {
      const id = field === 'dial' ? 'forces-dialed' : `battle-${field}`;
      const control = html.match(new RegExp(`<[^>]+id="${id}"[^>]*>`))?.[0];
      assert.ok(control, `${field} control is visible`);
      assert.match(control, /disabled=""|aria-disabled="true"/);
      if (field === 'dial') assert.match(control, /value="0"/);
      else {
        const select = html.match(new RegExp(`<select[^>]+id="${id}"[^>]*>[\\s\\S]*?</select>`))?.[0];
        assert.ok(select);
        assert.match(select, new RegExp(`<option[^>]+value="${values[field] ?? ''}"[^>]+selected=""`));
      }
    }
    for (const field of ['leader', 'weapon', 'defense'] as const) if (!(fields as readonly string[]).includes(field)) {
      const control = html.match(new RegExp(`<select[^>]+id="battle-${field}"[^>]*>`))?.[0];
      assert.ok(control);
      assert.doesNotMatch(control, /disabled=""/);
    }
    const action = bindBattlePlanCommitments(view, { type: 'battlePlan', dial: 4, leader: 'wrong', weapon: 'wrong', defense: 'wrong' });
    for (const field of fields) assert.equal(action[field], values[field]);
  }
});

void test('private Nexus history distinguishes superseded answers and remains visible after the card was spent', () => {
  const view = fixture();
  inspection(view);
  view.battle!.nexusInspection!.stage = 'answered';
  view.nexusCards!.card = null;
  view.nexusAtreides = null;
  view.battle!.nexusInsights = [
    { field: 'defense', value: 'old-defense', label: 'Old defense', active: false },
    { field: 'defense', value: null, label: 'None', active: true },
  ];
  const render = () => renderToStaticMarkup(createElement(NexusInspectionHistory, { game: view }));
  assert.match(render(), /Previous answer: defense = Old defense/);
  assert.match(render(), /No longer binding/);
  assert.match(render(), /Current answer: defense = None/);
  view.me = 'h';
  assert.match(render(), /Your committed element: defense = None/);
  view.me = 'e';
  assert.equal(render(), '');
});

void test('Nexus controls and commitment binding never read opponent hands, plans or unprojected inspection history', () => {
  const view = fixture();
  const expected = nexusHtml(view);
  for (const player of view.players) for (const field of ['hand', 'spice', 'traitors'])
    Object.defineProperty(player, field, { get() { throw new Error(`Private ${field}`); } });
  for (const field of ['plans', 'cards']) Object.defineProperty(view.battle!, field, { get() { throw new Error(`Hidden ${field}`); } });
  for (const field of ['deck', 'discard', 'hands']) Object.defineProperty(view, field, { get() { throw new Error(`Source ${field}`); } });
  assert.equal(nexusHtml(view), expected);
  assert.ok(nexusAtreidesAction(view, 'defense'));
  assert.deepEqual(battlePlanCommitments(view), {});
  assert.deepEqual(bindBattlePlanCommitments(view, { type: 'battlePlan', dial: 0 }), { type: 'battlePlan', dial: 0 });
});
