import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GameView } from '../game/engine';
import {
  nexusChoamBetrayalAction,
  nexusChoamBetrayalBotActions,
} from '../game/nexus-choam-betrayal-options';

const aliases = registerHooks({
  resolve(specifier, context, next) {
    return next(specifier === 'next/image' ? 'vinext/shims/image' : specifier === 'next/link' ? 'vinext/shims/link' : specifier, context);
  },
});
// Register the Next alias hook before loading the component under test.
const { NexusChoamBetrayal } = await import('../components/nexus-choam-betrayal');

function ownerView(overrides: Record<string, unknown> = {}): GameView {
  return {
    me: 'owner',
    players: [
      { id: 'owner', name: 'House Rival', faction: 'atreides', ally: null, bot: 'Easy' },
      { id: 'choam', name: 'CHOAM', faction: 'choam', ally: null },
      { id: 'observer', name: 'Observer', faction: 'guild', ally: null },
    ],
    status: 'playing',
    phase: 3,
    automaticContinuationPending: false,
    nexusCards: { card: 'choam' },
    nexusChoamBetrayal: {
      event: '["nexusChoamBetrayal",1,3,"owner","choam"]',
      blocked: null,
      target: { id: 'choam', name: 'CHOAM', handSize: 3 },
    },
    ...overrides,
  } as unknown as GameView;
}

function markup(game: GameView, busy = false): string {
  return renderToStaticMarkup(createElement(NexusChoamBetrayal, { game, act() {}, busy }));
}

void test('unallied CHOAM card owner offers one server-random discard action at every bot profile', () => {
  for (const profile of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = ownerView();
    view.players[0].bot = profile;
    const action = { type: 'nexusChoamBetrayal', event: view.nexusChoamBetrayal!.event };
    assert.deepEqual(nexusChoamBetrayalAction(view), action);
    assert.deepEqual(nexusChoamBetrayalBotActions(view), [action]);
  }
  const projected = ownerView();
  Object.defineProperty(projected.players[1], 'hand', {
    get() { throw new Error('Rival hand identity read'); },
  });
  const html = markup(projected);
  assert.match(html, /CHOAM Nexus Betrayal/);
  assert.match(html, /CHOAM discard one/);
  assert.match(html, /CHOAM holds 3 cards during Bidding/);
  assert.match(html, /uniformly random/);
  assert.match(html, /CHOAM receives no spice/);
  assert.match(html, /Spend CHOAM Nexus for random discard/);
  assert.doesNotMatch(html, /disabled=""/);
});

void test('blocked and busy private offers explain the restriction and disable the action', () => {
  const blocked = ownerView({ nexusChoamBetrayal: {
    event: 'offer', blocked: 'Finish the current response first.',
    target: { id: 'choam', name: 'CHOAM', handSize: 1 },
  } });
  assert.equal(nexusChoamBetrayalAction(blocked), null);
  assert.deepEqual(nexusChoamBetrayalBotActions(blocked), []);
  assert.match(markup(blocked), /Finish the current response first/);
  assert.match(markup(blocked), /CHOAM holds 1 card during Bidding/);
  assert.match(markup(blocked), /disabled=""[^>]*>Spend CHOAM Nexus/);
  assert.match(markup(ownerView(), true), /disabled=""[^>]*>Spend CHOAM Nexus/);
  for (const changes of [
    { status: 'finished' },
    { automaticContinuationPending: true },
    { nexusCards: { card: null } },
    { players: [
      { id: 'owner', faction: 'atreides', ally: 'observer' },
      { id: 'choam', faction: 'choam', ally: null },
    ] },
  ]) {
    const view = ownerView(changes);
    assert.equal(nexusChoamBetrayalAction(view), null);
    assert.deepEqual(nexusChoamBetrayalBotActions(view), []);
  }
  assert.match(markup(ownerView({ automaticContinuationPending: true })), /disabled=""[^>]*>Spend CHOAM Nexus/);
  const concealed = ownerView({
    phase: 2,
    nexusChoamBetrayal: {
      event: '["nexusChoamBetrayal",1,2,"owner","choam"]',
      blocked: null,
      target: { id: 'choam', name: 'CHOAM', handSize: null },
    },
  });
  assert.ok(nexusChoamBetrayalAction(concealed));
  assert.deepEqual(nexusChoamBetrayalBotActions(concealed), []);
  assert.doesNotMatch(markup(concealed), /holds [0-9]+ cards/);
});

void test('nonowner projection exposes neither the offer nor the rival hand or target control', () => {
  const observer = ownerView({
    me: 'observer',
    nexusCards: { card: null },
    nexusChoamBetrayal: null,
  });
  Object.defineProperty(observer.players[1], 'hand', {
    get() { throw new Error('Opponent hand read'); },
  });
  assert.equal(nexusChoamBetrayalAction(observer), null);
  assert.deepEqual(nexusChoamBetrayalBotActions(observer), []);
  assert.equal(markup(observer), '');
  assert.equal(markup(ownerView({ nexusChoamBetrayal: null })), '');
  assert.equal(markup(ownerView({ nexusCards: { card: null } })), '');
});

aliases.deregister();
