import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FactionAllocation } from '../components/faction-allocation';
import type { Action, GameView } from '../game/engine';

type Element = ReactElement<{ children?: ReactNode; [key: string]: unknown }>;
const elements = (node: ReactNode): Element[] => {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<{ children?: ReactNode; [key: string]: unknown }>(node)) return [];
  return [node, ...elements(node.props.children)];
};
const base = {
  status: 'lobby', host: 'a', me: 'a', expansions: [], factionDraft: null,
  players: [
    { id: 'a', name: 'Alice', faction: 'atreides', ready: true },
    { id: 'b', name: 'Basil', faction: 'harkonnen', ready: false },
    { id: 'c', name: 'Computer', faction: 'guild', bot: 'Medium', ready: true },
  ],
} as unknown as GameView;
const draft = {
  event: 'draft-event-1',
  order: [{ player: 'b', card: 9 }, { player: 'a', card: 6 }, { player: 'c', card: 2 }],
  picks: [{ player: 'b', faction: 'atreides' }],
};
const send = async (_action: Action) => {};
const render = (game: GameView, busy = false) =>
  renderToStaticMarkup(createElement(FactionAllocation, { game, send, busy }));

void test('host sees both allocation methods and readiness/commit semantics', () => {
  const html = render(base);
  assert.match(html, /Deal random factions/);
  assert.match(html, /Draft factions by prediction card/);
  assert.match(html, /only after everyone has picked/);
  assert.match(html, /clears human readiness/);
  assert.doesNotMatch(render({ ...base, me: 'b' }), /Deal random factions|Draft factions by prediction card/);
  assert.doesNotMatch(render({ ...base, status: 'playing' }), /Faction allocation/);
  assert.match(render({ ...base, players: base.players.slice(0, 1) }), /At least two faction seats/);
});

void test('draft shows public numbered order and only unpicked enabled factions to the active player', () => {
  const active = { ...base, factionDraft: draft } as unknown as GameView;
  const html = render(active);
  assert.match(html, /Basil · prediction 9: Atreides/);
  assert.match(html, /Alice · prediction 6: choosing now/);
  assert.match(html, /Computer \(AI\) · prediction 2: waiting/);
  assert.match(html, /Choose your faction/);
  assert.match(html, />Harkonnen<\/button>/);
  assert.doesNotMatch(html, />Atreides<\/button>|>Ixians<\/button>/);
  const expanded = render({ ...active, expansions: ['ix'] });
  assert.match(expanded, />Ixians<\/button>/);
  const waiting = render({ ...active, me: 'b' });
  assert.match(waiting, /Waiting for Alice to choose a faction/);
  assert.doesNotMatch(waiting, /Choose your faction|Cancel faction draft/);
});

void test('allocation controls send the exact owner-initiated actions and draft event', () => {
  const calls: Action[] = [];
  const sendAction = async (action: Action) => { calls.push(action); };
  const initial = elements(FactionAllocation({ game: base, send: sendAction, busy: false }));
  const click = (nodes: Element[], text: string) => {
    const button = nodes.find((node) => node.props.children === text && typeof node.props.onClick === 'function');
    assert.ok(button, `Expected action ${text}`);
    (button.props.onClick as () => void)();
  };
  click(initial, 'Deal random factions');
  click(initial, 'Draft factions by prediction card');
  const inDraft = elements(FactionAllocation({ game: { ...base, factionDraft: draft } as unknown as GameView, send: sendAction, busy: false }));
  click(inDraft, 'Harkonnen');
  click(inDraft, 'Cancel faction draft');
  assert.deepEqual(calls, [
    { type: 'factionAllocation', mode: 'random' },
    { type: 'factionAllocation', mode: 'draft' },
    { type: 'factionDraftPick', event: 'draft-event-1', faction: 'harkonnen' },
    { type: 'factionDraftCancel', event: 'draft-event-1' },
  ]);
});

void test('busy draft disables selection and a bot turn explains automatic progress', () => {
  const game = { ...base, factionDraft: { ...draft, picks: [
    { player: 'b', faction: 'atreides' }, { player: 'a', faction: 'emperor' },
  ] } } as unknown as GameView;
  assert.match(render(game), /Waiting for Computer \(AI\).*AI will choose automatically/);
  const nodes = elements(FactionAllocation({ game: { ...base, factionDraft: draft } as unknown as GameView, send, busy: true }));
  for (const button of nodes.filter((node) => typeof node.props.onClick === 'function'))
    assert.equal(button.props.disabled, true);
});
