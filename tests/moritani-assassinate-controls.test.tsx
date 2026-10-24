import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { Children, createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Action, GameView } from '../game/engine';

const aliases = registerHooks({
  resolve(specifier, context, next) {
    return next(specifier === 'next/image' ? 'vinext/shims/image' : specifier, context);
  },
});
const { MoritaniAssassinate, MoritaniAssassinateChoice, MoritaniAssassinateHistory } = await import('../components/moritani-assassinate');

function view(overrides: Record<string, unknown> = {}) {
  return {
    me: 'm',
    players: [
      { id: 'm', name: 'Moritani', faction: 'moritani' },
      { id: 'o', name: 'House Opponent', faction: 'atreides' },
    ],
    response: null,
    truthtrance: null,
    allLeaders: [
      { id: 'atreides-leader-1', name: 'Duke Leto', faction: 'atreides', strength: 5 },
      { id: 'atreides-leader-2', name: 'Thufir Hawat', faction: 'atreides', strength: 3 },
      { id: 'traitor-1', name: 'Duke Leto', faction: 'atreides', strength: 5 },
      { id: 'traitor-2', name: 'Thufir Hawat', faction: 'atreides', strength: 4 },
    ],
    decision: { kind: 'moritaniAssassinate', player: 'm', event: 'assassinate-1' },
    moritaniAssassinate: {
      owner: 'm',
      blocked: null,
      pending: {
        event: 'assassinate-1', opponent: 'o', territory: 'Arrakeen',
        cards: [
          { card: 'traitor-1', name: 'Duke Leto', potentialBounty: 5 },
          { card: 'traitor-2', name: 'Thufir Hawat', potentialBounty: 4 },
        ], blocked: null,
      },
      history: [],
    },
    ...overrides,
  } as unknown as GameView;
}

function markup(game: GameView, busy = false) {
  return renderToStaticMarkup(createElement(MoritaniAssassinate, { game, act() {}, busy }));
}

function click(node: ReactNode, selector: string): boolean {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{
      children?: ReactNode;
      onClick?: () => void;
      'data-testid'?: string;
    }>(child)) continue;
    if (child.props['data-testid'] === selector && child.props.onClick) {
      child.props.onClick();
      return true;
    }
    if (click(child.props.children, selector)) return true;
  }
  return false;
}

function choose(game: GameView, selected = 'traitor-1', busy = false, decline = false): Action[] {
  const actions: Action[] = [];
  const tree = MoritaniAssassinateChoice({
    game, selected, busy, onSelect() {}, act(action) { actions.push(action); },
  });
  click(tree, decline ? 'moritani-assassinate-decline' : 'moritani-assassinate-reveal');
  return actions;
}

void test('owner sees canonical traitor names and printed potential bounties with conditional reward rules', () => {
  const html = markup(view());
  assert.match(html, /Traitor Card to reveal/);
  assert.match(html, /Duke Leto/);
  assert.match(html, /5 spice potential bounty/);
  assert.match(html, /Thufir Hawat · 4 spice potential bounty/);
  assert.match(html, /replaced automatically during Mentat Pause/);
  assert.match(html, /cannot be canceled with Karama/);
  assert.match(html, /potential bounty is the leader’s printed strength/);
  assert.match(html, /awarded only if the target is alive/);
  assert.match(html, /already-dead target remains a legal choice and awards no spice/);
  assert.match(html, /physical Traitor Card makes the actual outcome public/);
  const other = markup(view({ moritaniAssassinate: {
    owner: 'm', blocked: null, pending: {
      event: 'assassinate-1', opponent: 'o', territory: 'Arrakeen',
      cards: [{ card: 'traitor-2', name: 'Thufir Hawat', potentialBounty: 4 }], blocked: null,
    }, history: [],
  } }));
  assert.match(other, /Thufir Hawat · 4 spice potential bounty/);
  assert.match(other, /Printed leader strength: 4/);
  assert.doesNotMatch(other, /dead target · 0 spice|0 spice; target already dead/);
});

void test('real reveal and decline callbacks retain the selected physical card and original event', () => {
  const game = view();
  for (const card of game.moritaniAssassinate!.pending!.cards) {
    assert.deepEqual(choose(game, card.card), [{ type: 'decision', event: 'assassinate-1', card: card.card }]);
  }
  assert.deepEqual(choose(game, 'traitor-2', false, true), [{ type: 'decision', event: 'assassinate-1', decline: true }]);
  assert.deepEqual(choose(game, 'stale-selection'), [{ type: 'decision', event: 'assassinate-1', card: 'traitor-1' }]);
});

void test('pending choice labels remain uniform for living, dead, captured, concealed-executed and foreign-Ghola targets', () => {
  const states = [
    { dead: false },
    { dead: true },
    { dead: false, capturedBy: 'h' },
    { dead: false, capturedBy: 'h', concealedExecuted: true },
    { dead: false, gholaBy: 'o' },
  ];
  for (const state of states) {
    const game = view();
    const leader = game.allLeaders.find((candidate) => candidate.id === 'traitor-1')!;
    Object.assign(leader, state);
    // Only the uniform pending projection is a choice source. Even an available
    // public leader record must not supply a private custody-dependent label.
    for (const field of ['dead', 'capturedBy', 'concealedExecuted', 'gholaBy']) {
      Object.defineProperty(leader, field, {
        get() { throw new Error(`Pending choice read target ${field}`); },
      });
    }
    for (const card of game.moritaniAssassinate!.pending!.cards) {
      for (const field of ['dead', 'bounty', 'capturedBy', 'gholaBy']) {
        Object.defineProperty(card, field, {
          get() { throw new Error(`Pending choice read internal ${field}`); },
        });
      }
    }
    const html = markup(game);
    assert.match(html, /Duke Leto · 5 spice potential bounty<\/option>/);
    assert.match(html, /<strong>Duke Leto<\/strong> · 5 spice potential bounty/);
    assert.match(html, /Printed leader strength: 5/);
    assert.doesNotMatch(html, /dead target · 0 spice|0 spice; target already dead|captured|concealed-executed|foreign-Ghola/);
    assert.deepEqual(choose(game), [{ type: 'decision', event: 'assassinate-1', card: 'traitor-1' }]);
  }
});

void test('nonowner, stale, blocked, response and Truthtrance contexts stay guarded', () => {
  assert.equal(markup(view({ me: 'o' })), '');
  assert.equal(markup(view({ decision: { kind: 'moritaniAssassinate', player: 'm', event: 'old' } })), '');
  const blocked = markup(view({ moritaniAssassinate: {
    owner: 'm', blocked: 'No eligible leader remains.', pending: {
      event: 'assassinate-1', opponent: 'o', territory: 'Arrakeen', cards: [], blocked: 'No eligible leader remains.',
    }, history: [],
  } }));
  assert.match(blocked, /No eligible leader remains/);
  assert.match(blocked, />Continue</);
  assert.match(markup(view({ response: { kind: 'test' } })), /disabled=""/);
  assert.match(markup(view({ truthtrance: { stage: 'answer' } })), /disabled=""/);
  assert.deepEqual(choose(view(), 'traitor-1', true), []);
  assert.deepEqual(choose(view(), 'traitor-1', true, true), []);
  for (const game of [
    view({ me: 'o' }),
    view({ decision: { kind: 'moritaniAssassinate', player: 'm', event: 'old' } }),
    view({ response: { kind: 'test' } }),
    view({ truthtrance: { stage: 'answer' } }),
  ]) {
    assert.deepEqual(choose(game), []);
    assert.deepEqual(choose(game, 'traitor-1', false, true), []);
  }
  const noCard = view();
  noCard.moritaniAssassinate!.pending!.cards = [];
  assert.deepEqual(choose(noCard), []);
  assert.deepEqual(choose(noCard, '', false, true), [{ type: 'decision', event: 'assassinate-1', decline: true }]);
  const unavailable = view();
  unavailable.moritaniAssassinate!.pending!.blocked = 'This opportunity has ended.';
  assert.deepEqual(choose(unavailable), []);
  assert.deepEqual(choose(unavailable, '', false, true), [{ type: 'decision', event: 'assassinate-1', decline: true }]);
});

void test('public history shows face-up traitor markers and read-only inspection for every seat', () => {
  const html = renderToStaticMarkup(createElement(MoritaniAssassinateHistory, {
    game: view({
      moritaniAssassinate: {
        owner: 'm', blocked: null, pending: null,
        history: [
          { event: 'old-1', turn: 2, opponent: 'o', faction: 'atreides', territory: 'arrakeen', card: 'atreides-leader-1', bounty: 5, stage: 'revealed' },
          { event: 'old-2', turn: 3, opponent: 'o', faction: 'atreides', territory: 'carthag', card: 'atreides-leader-2', bounty: 3, stage: 'replaced' },
        ],
      },
    }),
  }));
  assert.match(html, /Assassinate Leaders revealed cards/);
  assert.match(html, /Revealed · awaiting replacement/);
  assert.match(html, /Set aside face up · replaced/);
  assert.match(html, /Arrakeen/);
  assert.match(html, /Inspect traitor/);
  assert.doesNotMatch(html, /Decline Assassinate/);
});

aliases.deregister();
