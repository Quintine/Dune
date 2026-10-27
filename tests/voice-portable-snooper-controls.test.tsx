import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsxRuntime from 'react/jsx-runtime';
import ts from 'typescript';
import { BattlePreparation } from '../components/battle-preparation';
import { createGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import * as leaders from '../game/leader-control';
import * as cards from '../game/cards';
import * as battleCards from '../game/battle-cards';
import * as battleSlots from '../game/battle-card-slots';
import * as skills from '../game/leader-skill-combat';
import * as mirror from '../game/mirror-weapon-mode';

type Element = ReactElement<{ children?: ReactNode; [key: string]: unknown }>;
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<{ children?: ReactNode; [key: string]: unknown }>(node)) return [];
  return [node, ...elements(node.props.children)];
}

/** Controlled public view for the actual Voice component. The engine tests
 * exercise the real battle and authority; this is not a browser/hydration test. */
function projection(borrowed = false): GameView {
  const game = createGame('VOICEPORTABLEUI', newPlayer('bg', 'Bene Gesserit', 'beneGesserit'), true, ['choam']);
  game.players.push(newPlayer('e', 'Emperor', 'emperor'));
  Object.assign(game, { status: 'playing', phase: 6, turn: 2, active: 'bg', storm: 18, order: ['bg', 'e'] });
  for (const seat of game.players) {
    seat.forces = { 'arrakeen:10': 2 }; seat.reserves = 18; seat.hand = []; seat.traitors = [];
  }
  game.battle = { event: 'voice-ui-battle', territory: 'arrakeen', attacker: 'bg', defender: 'e',
    prepared: true, plans: {}, revealed: false, traitorCalls: {},
    preparation: { kind: 'voice', owner: 'bg', beneficiary: 'bg' } };
  const view = viewGame(game, 'bg');
  if (borrowed) {
    view.battle!.preparation = { kind: 'nexusVoice', owner: 'bg', beneficiary: 'bg' };
    view.nexusBorrowedVoice = { event: 'borrowed-voice-ui', owner: 'bg', target: 'e', canUse: true, blocked: null,
      choices: battleCards.VOICE_KINDS.flatMap(kind => [{ kind, must: false }, { kind, must: true }]) } as NonNullable<GameView['nexusBorrowedVoice']>;
  }
  return view;
}

/** Re-render with persistent hooks so callbacks come from the real component. */
function controller(game: GameView) {
  const states: unknown[] = [], sent: Action[] = [];
  let cursor = 0;
  const exports: { BattlePreparation?: typeof BattlePreparation } = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL('../components/battle-preparation.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    exports,
    require(name: string) {
      if (name === 'react/jsx-runtime') return jsxRuntime;
      if (name === 'react') return { useState(initial: unknown) {
        const index = cursor++; if (!(index in states)) states[index] = initial;
        return [states[index], (next: unknown) => { states[index] = next; }];
      } };
      if (name === '@/components/ui/button') return { Button: 'button' };
      if (name === '@/components/ui/input') return { Input: 'input' };
      if (name === '@/game/leader-control') return leaders;
      if (name === '@/game/cards') return cards;
      if (name === '@/game/battle-cards') return battleCards;
      if (name === '@/game/battle-card-slots') return battleSlots;
      if (name === '@/game/leader-skill-combat') return skills;
      if (name === '@/game/mirror-weapon-mode') return mirror;
      throw new Error(`Unexpected import ${name}`);
    },
  });
  assert.ok(exports.BattlePreparation);
  const render = () => { cursor = 0; return elements(exports.BattlePreparation!({ game, busy: false,
    send: async action => { sent.push(action); } })); };
  const select = (id: string, value: string) => {
    const node = render().find(element => element.props.id === id); assert.ok(node);
    assert.ok(elements(node).some(option => option.type === 'option' && option.props.value === value));
    (node.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } });
  };
  const requireCard = () => {
    const input = render().find(element => element.type === 'input' && element.props.type === 'checkbox'); assert.ok(input);
    (input.props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked: true } });
  };
  const submit = (label: string) => {
    const button = render().find(element => element.type === 'button' && element.props.children === label); assert.ok(button);
    assert.equal(button.props.disabled, false); (button.props.onClick as () => void)();
  };
  return { render, sent, select, requireCard, submit };
}

void test('ordinary Voice exposes distinct Portable Snooper and poison-defense choices and sends the chosen command', () => {
  const game = projection(), html = renderToStaticMarkup(createElement(BattlePreparation, { game, busy: false, send: async () => {} }));
  assert.match(html, /<option value="portableSnooper">Portable Snooper<\/option>/);
  assert.match(html, /<option value="snooper">Poison defense<\/option>/);
  const ui = controller(game);
  ui.select('voice-kind', 'portableSnooper'); ui.requireCard(); ui.submit('Use the Voice');
  assert.deepEqual(JSON.parse(JSON.stringify(ui.sent)), [{ type: 'voice', kind: 'portableSnooper', must: true }]);
  const ordinary = controller(game); ordinary.select('voice-kind', 'snooper'); ordinary.submit('Use the Voice');
  assert.deepEqual(JSON.parse(JSON.stringify(ordinary.sent)), [{ type: 'voice', kind: 'snooper', must: false }]);
});

void test('controlled borrowed Voice projection offers and sends the same named Portable command', () => {
  const game = projection(true), ui = controller(game);
  ui.select('borrowed-voice-kind', 'portableSnooper'); ui.requireCard(); ui.submit('Spend Nexus · Use the Voice');
  assert.deepEqual(JSON.parse(JSON.stringify(ui.sent)), [{ type: 'nexusBorrowedVoice', event: 'borrowed-voice-ui',
    use: true, kind: 'portableSnooper', must: true }]);
});
