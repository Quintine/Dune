import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BureaucratPayment } from '../components/bureaucrat-payment';
import type { GameView } from '../game/engine';

const aliases = registerHooks({
  resolve(specifier, context, next) {
    return next(
      specifier === 'next/image' ? 'vinext/shims/image' : specifier,
      context,
    );
  },
});

function view(overrides: Record<string, unknown> = {}) {
  return {
    me: 'payer',
    players: [
      { id: 'owner', name: 'House Owner' },
      { id: 'payer', name: 'House Payer' },
      { id: 'payee', name: 'House Payee' },
    ],
    decision: {
      kind: 'bureaucratPayment',
      player: 'owner',
      event: 'bureaucrat-1',
    },
    bureaucrat: {
      pending: {
        event: 'bureaucrat-1',
        owner: 'owner',
        payer: 'payer',
        payee: 'payee',
        amount: 5,
        kind: 'auction',
        redirect: 2,
      },
      usedThisPhase: false,
    },
    ...overrides,
  } as unknown as GameView;
}

function markup(game: GameView, busy = false) {
  return renderToStaticMarkup(
    createElement(BureaucratPayment, { game, act() {}, busy }),
  );
}

void test('owned matching Bureaucrat decision shows both payment costs and public names', () => {
  const html = markup(view({ me: 'owner' }));
  assert.match(html, /payment from House Payer to House Payee is 5 spice/);
  assert.match(html, /House Payee receives 3 spice/);
  assert.match(html, /Bank receives 2/);
  assert.match(html, /still pays the full amount/);
  assert.match(html, /Redirect 2 spice to the Bank/);
  assert.match(html, /Allow full 5-spice payment/);
});

void test('non-owner and stale decisions render no Bureaucrat controls', () => {
  assert.equal(markup(view()), '');
  assert.equal(
    markup(view({ me: 'owner', decision: { kind: 'bureaucratPayment', player: 'owner', event: 'old' } })),
    '',
  );
});

void test('busy Bureaucrat controls are disabled', () => {
  const html = markup(view({ me: 'owner' }), true);
  assert.ok((html.match(/disabled=""/g) ?? []).length >= 2);
});

void test('bribe redirection keeps the remaining payment unavailable until Mentat', () => {
  const game = view({ me: 'owner' });
  game.bureaucrat.pending!.kind = 'bribe';
  const html = markup(game);
  assert.match(html, /recipient keeps this spice in front of their shield until the next Mentat Pause/);
  assert.match(html, /cannot be spent before then/);
  assert.match(html, /House Payee receives 3 spice/);
});

aliases.deregister();
