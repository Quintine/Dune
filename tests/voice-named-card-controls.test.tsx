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

/** Controlled public battle projection; engine tests exercise actual combat. */
function projection(advanced: boolean, borrowed = false): GameView {
  const game = createGame('VOICENAMEUI', newPlayer('bg', 'Bene Gesserit', 'beneGesserit'), advanced);
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
      choices: battleCards.voiceChoices(advanced).flatMap(kind => [{ kind, must: false }, { kind, must: true }]) } as NonNullable<GameView['nexusBorrowedVoice']>;
  }
  return view;
}

/** Execute real event handlers with persistent hooks; no browser is implied. */
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
  return { render, sent };
}

void test('named ordinary battle cards appear only in Advanced Voice choices', () => {
  const render = (advanced: boolean) => renderToStaticMarkup(createElement(BattlePreparation, {
    game: projection(advanced), busy: false, send: async () => {},
  }));
  assert.match(render(true), /value="named:Maula Pistol"/);
  assert.match(render(true), />Maula Pistol \(specific card\)</);
  assert.match(render(true), /value="projectile"/);
  assert.doesNotMatch(render(false), /value="named:Maula Pistol"/);
  assert.match(render(false), /value="projectile"/);
});

void test('native and borrowed Voice send the chosen exact card name and honor offered choices', () => {
  for (const borrowed of [false, true]) {
    const ui = controller(projection(true, borrowed));
    const select = ui.render().find(element => element.props.id === (borrowed ? 'borrowed-voice-kind' : 'voice-kind'))!;
    assert.ok(elements(select).some(option => option.type === 'option' && option.props.value === 'named:Maula Pistol'));
    (select.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'named:Maula Pistol' } });
    const checkbox = ui.render().find(element => element.type === 'input' && element.props.type === 'checkbox')!;
    (checkbox.props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked: true } });
    const button = ui.render().find(element => element.type === 'button' && element.props.children === (borrowed ? 'Spend Nexus · Use the Voice' : 'Use the Voice'))!;
    assert.equal(button.props.disabled, false);
    (button.props.onClick as () => void)();
    const expected = borrowed ? { type: 'nexusBorrowedVoice', event: 'borrowed-voice-ui', use: true, kind: 'named:Maula Pistol', must: true }
      : { type: 'voice', kind: 'named:Maula Pistol', must: true };
    assert.deepEqual(JSON.parse(JSON.stringify(ui.sent)), [expected]);
  }
});
