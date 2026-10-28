import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsxRuntime from 'react/jsx-runtime';
import ts from 'typescript';
import type { Action, GameView } from '../game/engine';
import { createRicheseNoField, deployRicheseNoField } from '../game/richese-no-field';
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
  const custody: HomeworldCustody = { salusa: null, visitors: { 'homeworld:atreides': { r: { normal: 3, elite: 0 } } } };
  const populations = homeworldPopulations(context, custody);
  const marker = deployRicheseNoField(createRicheseNoField(['zero', 'three', 'five']),
    { tokenId: 'five', controller: 'r', location: { homeworld: 'homeworld:atreides' } });
  return {
    me: 'r', active: 'r', advanced: true, status: 'playing', phase: 5,
    homeworldShipment: { event: 'homeworld-event', blocked: null }, aid: { available: 0, pledged: 0 },
    players: context.players.map(p => ({ ...p, name: p.faction, spice: p.id === 'r' ? 6 : undefined,
      shipped: false, elites: { reserves: 0 } })),
    homeworlds: { worlds: homeworldForceGroups(context, custody).map(world => ({ ...world,
      ...populations.find(population => population.location === world.id)! })) },
    richeseNoField: { owner: 'r', event: 'marker-event', private: marker,
      canShip: false, shipBlock: 'Reveal the existing No-Field before shipping another.' },
  } as unknown as GameView;
}

void test('mixed transfer quotes the total, exact source, funding and purchased discount', () => {
  const view = fixture(), before = structuredClone(view);
  const quote = options.richeseHomeworldMarkerChoice(view, 'homeworld:guild', 'five', 0, 'homeworld:atreides', { normal: 3, elite: 0 });
  assert.equal(quote.amount, 4); assert.equal(quote.cost, 4);
  assert.deepEqual(quote.action, { type: 'homeworldShip', event: 'homeworld-event', destination: 'homeworld:guild',
    sources: { 'homeworld:atreides': { normal: 3, elite: 0 } }, noField: 'five', noFieldEvent: 'marker-event',
    allyPayment: 0, noFieldFrom: 'homeworld:atreides' });
  assert.deepEqual(view, before);
  const discounted = { ...view, karamaShipping: { player: 'r' } } as GameView;
  const half = options.richeseHomeworldMarkerChoice(discounted, 'homeworld:guild', 'five', 0,
    'homeworld:atreides', { normal: 2, elite: 0 });
  assert.equal(half.amount, 3); assert.equal(half.cost, 2);
  assert.equal(options.richeseHomeworldMarkerChoice(view, 'homeworld:guild', 'five', 0,
    'homeworld:atreides', { normal: 4, elite: 0 }).action, null);
  assert.equal(options.richeseHomeworldMarkerChoice(view, 'homeworld:guild', 'five', 0,
    'homeworld:atreides', { normal: -1, elite: 0 }).action, null);
  view.players[0].spice = 2;
  assert.equal(options.richeseHomeworldMarkerChoice(view, 'homeworld:guild', 'five', 0,
    'homeworld:atreides', { normal: 2, elite: 0 }).action, null);
});

type Element = ReactElement<{ children?: ReactNode; [key: string]: unknown }>;
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<{ children?: ReactNode; [key: string]: unknown }>(node)) return [];
  return [node, ...elements(node.props.children)];
}

void test('owner control bounds the group and submits selected physical forces with the marker', () => {
  const view = fixture(), sent: Action[] = [], states: unknown[] = [];
  const html = renderToStaticMarkup(createElement(HomeworldNoFieldShipment, { game: view, act() {}, busy: false }));
  assert.match(html, /accompanying No-Field/); assert.match(html, /3.*available/);
  let cursor = 0;
  const exports: { HomeworldNoFieldShipment?: typeof HomeworldNoFieldShipment } = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL('../components/homeworld-shipment.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require(name: string) {
    if (name === 'react/jsx-runtime') return jsxRuntime;
    if (name === 'react') return { useState(initial: unknown) {
      const index = cursor++; if (!(index in states)) states[index] = initial;
      return [states[index], (next: unknown) => { states[index] = next; }];
    } };
    if (name === '@/game/combat') return combat;
    if (name === '@/game/homeworld-shipment-options') return options;
    if (name === './ui/button') return { Button: 'button' };
    if (name === './ui/input') return { Input: 'input' };
    throw Error(`Unexpected import ${name}`);
  } });
  assert.ok(exports.HomeworldNoFieldShipment);
  const render = () => { cursor = 0; return elements(exports.HomeworldNoFieldShipment!({ game: view, busy: false, act: action => sent.push(action) })); };
  const input = render().find(element => element.type === 'input'); assert.ok(input);
  assert.equal(input.props.max, 3);
  (input.props.onChange as (event: unknown) => void)({ target: { value: '2' } });
  const button = render().find(element => element.type === 'button'); assert.ok(button);
  assert.equal(button.props.disabled, false);
  (button.props.onClick as () => void)();
  assert.deepEqual(JSON.parse(JSON.stringify(sent[0])), { type: 'homeworldShip', event: 'homeworld-event',
    destination: 'homeworld:guild', sources: { 'homeworld:atreides': { normal: 2, elite: 0 } },
    noField: 'five', noFieldEvent: 'marker-event', allyPayment: 0, noFieldFrom: 'homeworld:atreides' });
});

void test('minimal bots can propose the current marker with an available physical force', () => {
  const view = fixture();
  for (const level of [0, 1, 2, 3]) {
    const action = options.homeworldShipmentActions(view, level).find(candidate =>
      candidate.noFieldFrom === 'homeworld:atreides' && (candidate.sources as options.HomeworldShipmentSources | undefined)?.['homeworld:atreides']);
    assert.ok(action, `profile ${level} can propose a mixed transfer`);
    assert.deepEqual((action.sources as options.HomeworldShipmentSources | undefined)?.['homeworld:atreides'], { normal: 1, elite: 0 });
  }
});
