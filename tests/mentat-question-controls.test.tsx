import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MentatHistory, MentatQuestion } from '../components/mentat-question';
import type { GameView } from '../game/engine';

const aliases = registerHooks({
  resolve(specifier, context, next) {
    return next(
      specifier === 'next/image' ? 'vinext/shims/image' : specifier,
      context,
    );
  },
});

const card = { id: 'p1', name: 'Projectile', kind: 'projectile' as const };
const otherCard = { id: 'w1', name: 'Worthless', kind: 'worthless' as const };

function view(overrides: Record<string, unknown> = {}) {
  return {
    me: 'a',
    players: [
      { id: 'a', name: 'House A' },
      { id: 'b', name: 'House B' },
    ],
    decision: {
      kind: 'mentatQuestion',
      player: 'a',
      event: 'mentat-1',
      owner: 'a',
      target: 'b',
      stage: 'name',
      weapon: null,
    },
    mentat: {
      pending: {
        event: 'mentat-1',
        owner: 'a',
        target: 'b',
        player: 'a',
        stage: 'name',
        weapon: null,
        weapons: ['Projectile', 'Poison'],
        cards: [],
        blocked: null,
      },
      history: [],
    },
    ...overrides,
  } as unknown as GameView;
}

function markup(game: GameView, busy = false) {
  return renderToStaticMarkup(
    createElement(MentatQuestion, { game, act() {}, busy }),
  );
}

void test('Mentat owner sees naming controls and blocked empty-hand decline', () => {
  const html = markup(view());
  assert.match(html, /aria-label="Weapon to name for Mentat"/);
  assert.match(html, /Decline Mentat question/);
  const blocked = markup(
    view({
      mentat: {
        pending: {
          event: 'mentat-1', owner: 'a', target: 'b', player: 'a', stage: 'name',
          weapon: null, weapons: [], cards: [], blocked: 'Opponent has no card to show.',
        }, history: [],
      },
    }),
  );
  assert.match(blocked, /Opponent has no card to show/);
  assert.doesNotMatch(blocked, /Choose a weapon/);
});

void test('fallback cards are visible only to entitled target and inspectable', () => {
  const target = view({
    me: 'b',
    decision: {
      kind: 'mentatQuestion', player: 'b', event: 'mentat-1', owner: 'a', target: 'b',
      stage: 'reveal', weapon: 'Projectile',
    },
    mentat: {
      pending: {
        event: 'mentat-1', owner: 'a', target: 'b', player: 'b', stage: 'reveal',
        weapon: 'Projectile', weapons: [], cards: [card, otherCard], blocked: null,
      }, history: [],
    },
  });
  const html = markup(target);
  assert.match(html, /Show Projectile privately/);
  assert.match(html, /Show Worthless privately/);
  assert.match(html, /Inspect card/);
  const spectator = view({
    decision: {
      kind: 'mentatQuestion', player: 'b', event: 'mentat-1', owner: 'a', target: 'b',
      stage: 'reveal', weapon: 'Projectile',
    },
    mentat: {
      pending: {
        event: 'mentat-1', owner: 'a', target: 'b', player: 'b', stage: 'reveal',
        weapon: 'Projectile', weapons: [], cards: [card, otherCard], blocked: null,
      }, history: [],
    },
  });
  assert.equal(markup(spectator), '');
});

void test('exact-match reveal keeps the private stage and offers the named card once', () => {
  const html = markup(view({
    me: 'b',
    decision: {
      kind: 'mentatQuestion', player: 'b', event: 'mentat-1', owner: 'a', target: 'b',
      stage: 'reveal', weapon: 'Projectile',
    },
    mentat: {
      pending: {
        event: 'mentat-1', owner: 'a', target: 'b', player: 'b', stage: 'reveal',
        weapon: 'Projectile', weapons: [], cards: [card], blocked: null,
      }, history: [],
    },
  }));
  assert.match(html, /Mentat card shown privately/);
  assert.match(html, /Show the named card privately/);
  assert.equal((html.match(/Show Projectile privately/g) ?? []).length, 1);
  assert.doesNotMatch(html, /disabled=""/);
});

void test('history is read-only and busy controls are disabled', () => {
  const pending = markup(view(), true);
  assert.match(pending, /disabled=""/);
  const history = renderToStaticMarkup(
    createElement(MentatHistory, {
      game: view({
        mentat: {
          pending: null,
          history: [{
            event: 'old', battle: 'b', turn: 4, territory: 'arrakeen', owner: 'a',
            target: 'b', leader: 'l', weapon: 'Projectile', card,
          }],
        },
      }),
    }),
  );
  assert.match(history, /Your Mentat observations/);
  assert.match(history, /Later hand changes can make an observation stale/);
  assert.match(history, /Inspect card/);
  assert.doesNotMatch(history, /Show .* privately/);
});

aliases.deregister();
