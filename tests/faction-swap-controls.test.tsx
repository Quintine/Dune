import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FactionSwap } from '../components/faction-swap';
import type { Action, GameView } from '../game/engine';

type Element = ReactElement<{ children?: ReactNode; [key: string]: unknown }>;
const elements = (node: ReactNode): Element[] => {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<{ children?: ReactNode; [key: string]: unknown }>(node)) return [];
  return [node, ...elements(node.props.children)];
};
const base = {
  status: 'lobby', me: 'a', factionDraft: null, factionSwap: null,
  players: [
    { id: 'a', name: 'Alice', faction: 'atreides' },
    { id: 'b', name: 'Basil', faction: 'harkonnen' },
    { id: 'c', name: 'Chani', faction: 'fremen' },
    { id: 'd', name: 'Computer', faction: 'guild', bot: 'Medium' },
  ],
} as unknown as GameView;
const swap = { event: 'swap-1', from: 'a', to: 'b', fromFaction: 'atreides', toFaction: 'harkonnen' };
const send = async (_action: Action) => {};
const render = (game: GameView, busy = false) => renderToStaticMarkup(createElement(FactionSwap, { game, send, busy }));
const controls = (game: GameView, sendAction = send, busy = false) =>
  elements(FactionSwap({ game, send: sendAction, busy })).filter((element) => typeof element.props.onClick === 'function');
const click = (nodes: Element[], label: string) => {
  const button = nodes.find((node) => node.props.children === label);
  assert.ok(button, `Expected action ${label}`);
  (button.props.onClick as () => void)();
};

void test('offers target other human seats and require the recipient to accept', () => {
  const calls: Action[] = [];
  const nodes = controls(base, async (action) => { calls.push(action); });
  assert.deepEqual(nodes.map((node) => node.props.children), [
    'Offer swap to Basil (Harkonnen)', 'Offer swap to Chani (Fremen)',
  ]);
  assert.match(render(base), /other player must accept/);
  assert.match(render(base), /AI seats cannot receive swap offers/);
  assert.doesNotMatch(render({ ...base, status: 'playing' }), /Swap factions/);
  click(nodes, 'Offer swap to Basil (Harkonnen)');
  assert.deepEqual(calls, [{ type: 'factionSwapOffer', target: 'b' }]);
});

void test('offers are unavailable during a draft or while busy', () => {
  const draft = { event: 'draft-1', order: [], picks: [] };
  const inDraft = { ...base, factionDraft: draft } as unknown as GameView;
  assert.match(render(inDraft), /Finish or cancel the faction draft/);
  for (const node of [...controls(inDraft), ...controls(base, send, true)]) assert.equal(node.props.disabled, true);
  const alone = { ...base, players: [base.players[0], base.players[3]] };
  assert.match(render(alone), /second human seat/);
  assert.equal(controls(alone).length, 0);
});

void test('the pending offer is visible to everyone, with consent and cancellation limited to each party', () => {
  const calls: Action[] = [];
  const record = async (action: Action) => { calls.push(action); };
  const pending = { ...base, factionSwap: swap } as unknown as GameView;
  for (const me of ['a', 'b', 'c']) {
    const html = render({ ...pending, me });
    assert.match(html, /Alice offers to exchange Atreides with Basil&#x27;s Harkonnen/);
    assert.match(html, /change only if Basil accepts/);
  }
  const sender = controls(pending, record);
  const recipient = controls({ ...pending, me: 'b' }, record);
  assert.deepEqual(sender.map((node) => node.props.children), ['Cancel swap offer']);
  assert.deepEqual(recipient.map((node) => node.props.children), ['Accept swap', 'Decline swap']);
  assert.equal(controls({ ...pending, me: 'c' }, record).length, 0);
  click(sender, 'Cancel swap offer');
  click(recipient, 'Accept swap');
  click(recipient, 'Decline swap');
  assert.deepEqual(calls, [
    { type: 'factionSwapCancel', event: 'swap-1' },
    { type: 'factionSwapRespond', event: 'swap-1', accept: true },
    { type: 'factionSwapRespond', event: 'swap-1', accept: false },
  ]);
  for (const node of controls({ ...pending, me: 'b' }, record, true)) assert.equal(node.props.disabled, true);
});
