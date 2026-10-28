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
  const custody: HomeworldCustody = { salusa: null, visitors: {} };
  const populations = homeworldPopulations(context, custody);
  const marker = deployRicheseNoField(createRicheseNoField(['zero', 'three', 'five']),
    { tokenId: 'five', controller: 'r', location: { homeworld: 'homeworld:atreides' } });
  return {
    me: 'r', active: 'r', advanced: true, status: 'playing', phase: 5,
    homeworldShipment: { event: 'homeworld-event', blocked: null }, aid: { available: 0, pledged: 0 },
    players: context.players.map(p => ({ ...p, name: p.faction, spice: p.id === 'r' ? 4 : undefined,
      shipped: false, elites: { reserves: 0 } })),
    homeworlds: { worlds: homeworldForceGroups(context, custody).map(world => ({ ...world,
      ...populations.find(population => population.location === world.id)! })) },
    richeseNoField: { owner: 'r', event: 'marker-event', private: marker,
      canShip: false, shipBlock: 'Reveal the existing No-Field before shipping another.' },
  } as unknown as GameView;
}

void test('the owner receives the actual transfer packet although another deployment is blocked', () => {
  const view = fixture(), before = structuredClone(view);
  const quote = options.richeseHomeworldMarkerChoice(view, 'homeworld:guild', 'five', 0, 'homeworld:atreides');
  assert.equal(quote.cost, 1); assert.equal(quote.ownPayment, 1);
  assert.deepEqual(quote.action, { type: 'homeworldShip', event: 'homeworld-event', destination: 'homeworld:guild',
    sources: {}, noField: 'five', noFieldEvent: 'marker-event', allyPayment: 0, noFieldFrom: 'homeworld:atreides' });
  assert.deepEqual(view, before);
});

void test('transfer quote enforces current custody, active timing, destination and funding', () => {
  const view = fixture();
  assert.equal(options.richeseHomeworldMarkerChoice(view, 'homeworld:atreides', 'five', 0, 'homeworld:atreides').action, null);
  assert.equal(options.richeseHomeworldMarkerChoice(view, 'homeworld:richese', 'five', 0, 'homeworld:atreides').action, null);
  assert.equal(options.richeseHomeworldMarkerChoice(view, 'homeworld:guild', 'three', 0, 'homeworld:atreides').action, null);
  assert.equal(options.richeseHomeworldMarkerChoice(view, 'homeworld:guild', 'five', 0, 'homeworld:unknown').action, null);
  for (const patch of [
    { phase: 6 }, { active: 'a' }, { status: 'finished' }, { roomControl: { paused: true } },
    { homeworldShipment: { event: 'homeworld-event', blocked: 'Wait.' } },
    { richeseNoField: { ...view.richeseNoField!, owner: 'a', private: null } }, { leaderSkills: {} },
  ]) assert.equal(options.richeseHomeworldMarkerChoice({ ...view, ...patch } as GameView,
    'homeworld:guild', 'five', 0, 'homeworld:atreides').action, null);
  view.players[0].spice = 0;
  assert.equal(options.richeseHomeworldMarkerChoice(view, 'homeworld:guild', 'five', 0, 'homeworld:atreides').action, null);
});

void test('owner sees the current marker and different destination; all minimal bot levels can offer transfer', () => {
  const view = fixture();
  const html = renderToStaticMarkup(createElement(HomeworldNoFieldShipment, { game: view, act() {}, busy: false }));
  assert.match(html, /from Caladan/); assert.match(html, /No-Field 5/);
  assert.doesNotMatch(html, /No-Field 0|No-Field 3/);
  const foreign = { ...view, me: 'a', richeseNoField: { ...view.richeseNoField!, private: null } } as GameView;
  assert.equal(renderToStaticMarkup(createElement(HomeworldNoFieldShipment, { game: foreign, act() {}, busy: false })), '');
  for (const level of [0, 1, 2, 3]) {
    const action = options.homeworldShipmentActions(view, level).find(candidate => candidate.noFieldFrom !== undefined);
    assert.ok(action, `profile ${level} can transport the actual marker`);
    assert.equal(action.noFieldFrom, 'homeworld:atreides'); assert.equal(action.noField, 'five');
    assert.equal(action.destination, 'homeworld:guild');
  }
});

type Element = ReactElement<{ children?: ReactNode; [key: string]: unknown }>;
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<{ children?: ReactNode; [key: string]: unknown }>(node)) return [];
  return [node, ...elements(node.props.children)];
}

void test('the mounted control submits the current token and source through the normal button', () => {
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
      throw Error(`Unexpected import ${name}`);
    },
  });
  assert.ok(exports.HomeworldNoFieldShipment);
  cursor = 0;
  const nodes = elements(exports.HomeworldNoFieldShipment({ game: view, busy: false, act: action => sent.push(action) }));
  const button = nodes.find(element => element.type === 'button'); assert.ok(button);
  assert.equal(button.props.disabled, false);
  (button.props.onClick as () => void)();
  assert.deepEqual(JSON.parse(JSON.stringify(sent[0])), { type: 'homeworldShip', event: 'homeworld-event',
    destination: 'homeworld:guild', sources: {}, noField: 'five', noFieldEvent: 'marker-event', allyPayment: 0, noFieldFrom: 'homeworld:atreides' });
});
