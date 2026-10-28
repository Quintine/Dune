import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsxRuntime from 'react/jsx-runtime';
import ts from 'typescript';
import type { Action, GameView } from '../game/engine';
import { createRicheseNoField } from '../game/richese-no-field';
import { homeworldForceGroups, type HomeworldCustody } from '../game/homeworld-custody';
import { homeworldPopulations } from '../game/homeworld-population';
import * as combat from '../game/combat';
import * as options from '../game/homeworld-shipment-options';
import { HomeworldNoFieldShipment } from '../components/homeworld-shipment';

function fixture(): GameView {
  const context = { advanced: true, players: [
    { id: 'r', faction: 'richese' as const, reserves: 12, eliteReserves: 0, ally: null as string | null },
    { id: 'a', faction: 'atreides' as const, reserves: 15, eliteReserves: 0, ally: null as string | null },
    { id: 'g', faction: 'guild' as const, reserves: 20, eliteReserves: 0, ally: null as string | null },
  ] };
  const custody: HomeworldCustody = { salusa: null, visitors: {} };
  const populations = homeworldPopulations(context, custody);
  return {
    me: 'r', active: 'r', advanced: true, status: 'playing', phase: 5,
    homeworldShipment: { event: 'homeworld-event', blocked: null },
    aid: { available: 0, pledged: 0 },
    players: context.players.map(p => ({ ...p, name: p.faction, spice: p.id === 'r' ? 4 : undefined,
      shipped: false, elites: { reserves: 0 } })),
    homeworlds: { worlds: homeworldForceGroups(context, custody).map(world => ({ ...world,
      ...populations.find(population => population.location === world.id)! })) },
    richeseNoField: { owner: 'r', event: 'marker-event', private: createRicheseNoField(['zero', 'three', 'five']),
      canShip: true, shipBlock: null },
  } as unknown as GameView;
}

void test('private marker quote emits the native shipment action without withdrawing counters', () => {
  const view = fixture(), before = structuredClone(view);
  for (const tokenId of ['zero', 'three', 'five']) {
    const quote = options.richeseHomeworldMarkerChoice(view, 'homeworld:atreides', tokenId);
    assert.equal(quote.cost, 1); assert.equal(quote.ownPayment, 1);
    assert.deepEqual(quote.action, { type: 'homeworldShip', event: 'homeworld-event', destination: 'homeworld:atreides',
      sources: {}, noField: tokenId, noFieldEvent: 'marker-event', allyPayment: 0 });
  }
  assert.deepEqual(view, before);
});

void test('marker quote respects eligibility, payment, privacy and current action windows', () => {
  const view = fixture(), info = view.richeseNoField!;
  assert.equal(options.richeseHomeworldMarkerChoice(view, 'homeworld:richese', 'zero').action, null);
  assert.equal(options.richeseHomeworldMarkerChoice(view, 'homeworld:unknown', 'zero').action, null);
  assert.equal(options.richeseHomeworldMarkerChoice(view, 'homeworld:atreides', 'missing').action, null);
  info.private!.lastShipped = 'zero';
  assert.equal(options.richeseHomeworldMarkerChoice(view, 'homeworld:atreides', 'zero').action, null);
  info.private!.lastShipped = null;
  view.players[0].spice = 0;
  assert.equal(options.richeseHomeworldMarkerChoice(view, 'homeworld:atreides', 'three').action, null);
  view.players[0].ally = 'g'; view.players[2].ally = 'r'; view.aid.available = 1;
  assert.equal(options.richeseHomeworldMarkerChoice(view, 'homeworld:guild', 'three', 1).action, null);
  assert.equal(options.richeseHomeworldMarkerChoice(view, 'homeworld:atreides', 'three', 1).action?.allyPayment, 1);
  for (const contribution of [-1, 0.5, 2, NaN])
    assert.equal(options.richeseHomeworldMarkerChoice(view, 'homeworld:atreides', 'three', contribution).action, null);
  for (const patch of [
    { phase: 6 }, { active: 'a' }, { status: 'finished' },
    { roomControl: { paused: true } }, { homeworldShipment: { event: 'homeworld-event', blocked: 'Wait.' } },
    { richeseNoField: { ...info, owner: 'a', private: null } },
  ]) assert.equal(options.richeseHomeworldMarkerChoice({ ...view, ...patch } as GameView,
    'homeworld:atreides', 'three', 1).action, null);
});

void test('only the owner sees the provisional marker controls and private token values', () => {
  const view = fixture();
  const owner = renderToStaticMarkup(createElement(HomeworldNoFieldShipment, { game: view, act() {}, busy: false }));
  assert.match(owner, /Provisional Homeworld rule/);
  assert.match(owner, /No-Field 0/); assert.match(owner, /No-Field 3/); assert.match(owner, /No-Field 5/);
  assert.match(owner, /one spice total/);
  const other = { ...view, me: 'a', richeseNoField: { ...view.richeseNoField!, private: null } } as GameView;
  assert.equal(renderToStaticMarkup(createElement(HomeworldNoFieldShipment, { game: other, act() {}, busy: false })), '');
});

void test('all existing bot profiles can offer a legal marker when physical reserves are empty', () => {
  const view = fixture();
  view.players[0].reserves = 0;
  const own = view.homeworlds!.worlds!.find(world => world.id === 'homeworld:richese')!;
  own.forces.r.normal = 0;
  for (const level of [0, 1, 2, 3]) {
    const action = options.homeworldShipmentActions(view, level).find(candidate => candidate.noField !== undefined);
    assert.ok(action, `profile ${level} can offer its physical marker`);
    assert.deepEqual(action, options.richeseHomeworldMarkerChoice(view, String(action.destination),
      String(action.noField), Number(action.allyPayment)).action);
  }
});

void test('optional modules block the marker quote and all bot marker candidates', () => {
  const view = fixture();
  for (const patch of [
    { nexusCards: { waiting: [] } }, { leaderSkills: {} }, { discoveryEnabled: true },
    { discoveries: {} }, { techTokens: {} }, { strongholdCards: {} },
  ]) {
    const withModule = { ...view, ...patch } as GameView;
    const quote = options.richeseHomeworldMarkerChoice(withModule, 'homeworld:atreides', 'three');
    assert.equal(quote.action, null);
    assert.match(quote.blocked ?? '', /without optional modules/);
    for (const level of [0, 1, 2, 3])
      assert.equal(options.homeworldShipmentActions(withModule, level)
        .some(candidate => candidate.noField !== undefined), false);
  }
});

type Element = ReactElement<{ children?: ReactNode; [key: string]: unknown }>;
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<{ children?: ReactNode; [key: string]: unknown }>(node)) return [];
  return [node, ...elements(node.props.children)];
}

void test('the actual marker controls submit the selected private token and destination', () => {
  const view = fixture(), sent: Action[] = [], states: unknown[] = [];
  let cursor = 0;
  const exports: { HomeworldNoFieldShipment?: typeof HomeworldNoFieldShipment } = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL('../components/homeworld-shipment.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    exports,
    require(name: string) {
      if (name === 'react/jsx-runtime') return jsxRuntime;
      if (name === 'react') return { useState(initial: unknown) {
        const index = cursor++; if (!(index in states)) states[index] = initial;
        return [states[index], (next: unknown) => { states[index] = next; }];
      } };
      if (name === '@/game/combat') return combat;
      if (name === '@/game/homeworld-shipment-options') return options;
      if (name === './ui/button') return { Button: 'button' };
      if (name === './ui/input') return { Input: 'input' };
      throw new Error(`Unexpected import ${name}`);
    },
  });
  assert.ok(exports.HomeworldNoFieldShipment);
  const render = () => { cursor = 0; return elements(exports.HomeworldNoFieldShipment!({ game: view, busy: false,
    act: action => sent.push(action) })); };
  const select = (label: string, value: string) => {
    const node = render().find(element => element.type === 'select' && element.props['aria-label'] === label);
    assert.ok(node); (node.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } });
  };
  select('No-Field destination Homeworld', 'homeworld:guild');
  select('Private No-Field token', 'five');
  const button = render().find(element => element.type === 'button');
  assert.ok(button); assert.equal(button.props.disabled, false);
  (button.props.onClick as () => void)();
  assert.deepEqual(JSON.parse(JSON.stringify(sent[0])), { type: 'homeworldShip', event: 'homeworld-event',
    destination: 'homeworld:guild', sources: {}, noField: 'five', noFieldEvent: 'marker-event', allyPayment: 0 });
});
