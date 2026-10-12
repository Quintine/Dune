import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BureaucratPayment } from '../components/bureaucrat-payment';
import type { GameView } from '../game/engine';


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

