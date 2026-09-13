import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GameView } from '../game/engine';

const aliases = registerHooks({
  resolve(specifier, context, next) {
    return next(specifier === 'next/image' ? 'vinext/shims/image' : specifier, context);
  },
});
const { MoritaniAssassinate, MoritaniAssassinateHistory } = await import('../components/moritani-assassinate');

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
          { card: 'traitor-1', name: 'Duke Leto', bounty: 5, dead: false },
          { card: 'traitor-2', name: 'Thufir Hawat', bounty: 0, dead: true },
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

void test('owner sees public traitor choices, bounty, dead-target legality and rules', () => {
  const html = markup(view());
  assert.match(html, /Traitor Card to reveal/);
  assert.match(html, /Duke Leto/);
  assert.match(html, /5 spice bounty/);
  assert.match(html, /Thufir Hawat · dead target · 0 spice/);
  assert.match(html, /replaced automatically during Mentat Pause/);
  assert.match(html, /cannot be canceled with Karama/);
  const dead = markup(view({ moritaniAssassinate: {
    owner: 'm', blocked: null, pending: {
      event: 'assassinate-1', opponent: 'o', territory: 'Arrakeen',
      cards: [{ card: 'traitor-2', name: 'Thufir Hawat', bounty: 0, dead: true }], blocked: null,
    }, history: [],
  } }));
  assert.match(dead, /0 spice; target already dead/);
  assert.match(dead, /Printed leader strength: 4/);
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
