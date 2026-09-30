import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SemutaReaction } from '../components/semuta-reaction';
import type { GameView } from '../game/engine';

const first = { id: 'fresh-projectile-1', name: 'Projectile', kind: 'projectile' as const };
const second = { id: 'fresh-projectile-2', name: 'Projectile', kind: 'projectile' as const };
const event = 'discard-turn-7';

type Reaction = NonNullable<GameView['semutaReaction']>;

function view(reaction: Reaction | null): GameView {
  return { semutaReaction: reaction } as GameView;
}

function offer(overrides: Partial<Reaction> = {}): Reaction {
  return {
    event,
    stage: 'offer',
    passed: false,
    canCommit: false,
    blocked: null,
    candidates: [],
    ...overrides,
  };
}

function markup(reaction: Reaction | null, busy = false) {
  return renderToStaticMarkup(
    createElement(SemutaReaction, { game: view(reaction), act() {}, busy }),
  );
}

void test('all seats see the same fresh-discard event without a card face before commitment', () => {
  const holder = markup(offer({ canCommit: true }));
  const rival = markup(offer());
  assert.match(holder, /Fresh Treachery discard/);
  assert.match(rival, /Fresh Treachery discard/);
  assert.match(holder, /discard-turn-7/);
  assert.match(rival, /discard-turn-7/);
  assert.match(holder, /Commit Semuta Drug/);
  assert.doesNotMatch(rival, /Commit Semuta Drug/);
  assert.match(holder, />Continue<\/button>/);
  assert.match(rival, />Continue<\/button>/);
  for (const html of [holder, rival]) {
    assert.doesNotMatch(html, /Projectile|fresh-projectile|Inspect card|Claim Projectile/);
  }
  assert.equal(markup(null), '');
});

void test('only the claimant sees exact physical candidates after commitment', () => {
  const selecting = offer({ stage: 'select', candidates: [first, second] });
  const holder = markup(selecting);
  const rival = markup(offer({ stage: 'select' }));
  for (const id of [first.id, second.id]) {
    assert.match(holder, new RegExp(id));
    assert.doesNotMatch(rival, new RegExp(id));
  }
  assert.equal((holder.match(/Claim Projectile \(/g) ?? []).length, 2);
  assert.match(holder, /Inspect card/);
  assert.match(holder, /cannot be declined or canceled/);
  assert.doesNotMatch(holder, /Continue|Cancel|Decline/);
  assert.match(rival, /Waiting for the Semuta Drug claim to finish/);
  assert.doesNotMatch(rival, /Projectile|Inspect card|Commit Semuta Drug|>Continue</);
});

void test('passed, blocked, busy and waiting seats hide or disable unavailable controls', () => {
  const passed = offer({ passed: true, canCommit: true });
  assert.match(markup(passed), /You continued/);
  assert.doesNotMatch(markup(passed), /Commit Semuta Drug|>Continue</);
  const blocked = offer({ blocked: 'Reserved for an unfinished transaction.' });
  assert.doesNotMatch(markup(blocked), /Commit Semuta Drug/);
  assert.match(markup(offer({ canCommit: true }), true), /disabled=""[^>]*>Commit Semuta Drug/);
  assert.match(markup(offer(), true), /disabled=""[^>]*>Continue/);
  assert.match(markup(offer({ stage: 'select', candidates: [first, second] }), true),
    /disabled=""[^>]*>Claim Projectile/);
});
