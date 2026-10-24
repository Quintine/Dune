import assert from 'node:assert/strict';
import test from 'node:test';
import { Children, createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TleilaxuSpecialKarama } from '../components/tleilaxu-special-karama';
import { baseDeck } from '../game/cards';
import {
  createGame,
  newPlayer,
  viewGame,
  type Action,
  type GameView,
} from '../game/engine';

// Client projections isolate eligibility controls. The runtime suite covers
// physical Karama spending, original pending returns and prevention duration.
function projected(): GameView {
  const game = createGame('TLEILAXUSPECIALCONTROLS', newPlayer('t', 'Tleilaxu', 'tleilaxu'), true, ['ix']);
  game.players.push(newPlayer('a', 'Ally', 'atreides'), newPlayer('e', 'Ready Emperor', 'emperor'), newPlayer('g', 'Earlier Guild', 'guild'));
  Object.assign(game, { status: 'playing', phase: 4, turn: 3, order: ['t', 'a', 'e', 'g'] });
  game.players[0].ally = 'a';
  game.players[1].ally = 't';
  game.players[2].ready = true;
  game.players[3].revived = 1;
  game.players[3].freeForcesRevived = 1;
  const cards = baseDeck().filter((card) => card.effect === 'karama').slice(0, 2);
  game.players[0].hand = cards;
  game.deck = baseDeck().filter((card) => !cards.some((held) => held.id === card.id));
  const view = viewGame(game, 't');
  view.tleilaxuSpecialKarama = {
    blocked: null, cards: cards.map((card) => card.id), pending: false,
    targets: game.players.map((player) => ({ player: player.id, blocked: null })),
  };
  return view;
}

function markup(game: GameView, busy = false) {
  return renderToStaticMarkup(createElement(TleilaxuSpecialKarama, { game, busy, act() {} }));
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

function prevent(game: GameView, card: string, target = 'e', busy = false): Action[] {
  const actions: Action[] = [];
  click(TleilaxuSpecialKarama({ game, busy, act(action) { actions.push(action); } }),
    `tleilaxu-special-karama-${card}-${target}`);
  return actions;
}

void test('actual quiet-window buttons include self, ally, ready and prior-return targets using every projected card', () => {
  const game = projected();
  const html = markup(game);
  assert.match(html, /aria-label="Tleilaxu special Karama revival prevention"/);
  assert.match(html, /prevent revival for Tleilaxu/);
  assert.match(html, /prevent revival for Ally/);
  assert.match(html, /prevent revival for Ready Emperor/);
  assert.match(html, /prevent revival for Earlier Guild/);
  assert.equal((html.match(/data-testid="tleilaxu-special-karama-/g) ?? []).length, 8);
  for (const card of game.tleilaxuSpecialKarama!.cards) {
    for (const target of game.tleilaxuSpecialKarama!.targets) {
      assert.deepEqual(prevent(game, card, target.player), [{ type: 'card', mode: 'special', card, target: target.player }]);
    }
  }
  assert.deepEqual(prevent(game, 'stale-card'), []);
  assert.deepEqual(prevent(game, game.tleilaxuSpecialKarama!.cards[0], 'not-a-target'), []);
});

void test('persistent guidance includes current-Revival Ghola, phase expiry and protected Emperor special without reversing completed returns', () => {
  const game = projected();
  for (let render = 0; render < 3; render++) {
    const html = markup(game);
    assert.match(html, /once-per-game special Karama/);
    assert.match(html, /force and leader revivals for the rest of this Revival, including returns from Ghola Treachery/);
    assert.match(html, /yourself or an ally/);
    assert.match(html, /even if the chosen faction is ready or has already completed revivals/);
    assert.match(html, /Completed returns and payments stay unchanged/);
    assert.match(html, /does not remove returned pieces or refund spice/);
    assert.match(html, /Provisional rule: Ghola Treachery is included during the affected Revival/);
    assert.match(html, /prevention expires when the phase ends/);
    assert.match(html, /does not stop Ghola outside Revival/);
    assert.match(html, /Emperor’s native special Karama remains protected by the printed immunity of special Karama powers/);
  }
});

void test('global and per-target projected block reasons remain readable and prevent only the affected actions', () => {
  const game = projected();
  const card = game.tleilaxuSpecialKarama!.cards[0];
  game.tleilaxuSpecialKarama!.targets.find((target) => target.player === 'e')!.blocked = 'This Homeworld revival combination is not yet available.';
  const html = markup(game);
  assert.match(html, /Ready Emperor: This Homeworld revival combination is not yet available/);
  assert.match(html, /aria-describedby="tleilaxu-special-karama-e-unavailable"/);
  assert.deepEqual(prevent(game, card, 'e'), []);
  assert.deepEqual(prevent(game, card, 'a'), [{ type: 'card', mode: 'special', card, target: 'a' }]);
  game.tleilaxuSpecialKarama!.blocked = 'This once-per-game special Karama has already been used.';
  assert.match(markup(game), /once-per-game special Karama has already been used/);
  assert.deepEqual(prevent(game, card, 'a'), []);
});

void test('cardless and targetless projections show useful guidance without inventing actions', () => {
  const game = projected();
  const card = game.tleilaxuSpecialKarama!.cards[0];
  game.tleilaxuSpecialKarama!.cards = [];
  assert.match(markup(game), /No spendable Karama is currently available for this special power/);
  assert.doesNotMatch(markup(game), /data-testid="tleilaxu-special-karama-/);
  assert.deepEqual(prevent(game, card), []);
  game.tleilaxuSpecialKarama!.targets = [];
  assert.match(markup(game), /No faction is currently available for this revival-prevention power/);
});

void test('the owned pending revival-stop uses its original projected recipient without adding a decline or acknowledgement', () => {
  const game = projected();
  const card = game.tleilaxuSpecialKarama!.cards[0];
  game.tleilaxuSpecialKarama!.pending = true;
  game.tleilaxuSpecialKarama!.targets = [{ player: 'e', blocked: null }];
  game.decision = { kind: 'revivalStop', player: 't', recipient: 'e', revival: 'forces' };
  const html = markup(game);
  assert.match(html, /Only the original recipient can be selected during this pending revival/);
  assert.deepEqual(prevent(game, card), [{ type: 'card', mode: 'special', card, target: 'e' }]);
  assert.deepEqual(prevent(game, card, 'a'), []);
  assert.doesNotMatch(html, /Allow this revival|Decline|Acknowledge|Confirm prevention/);
  game.decision = null;
  assert.deepEqual(prevent(game, card), []);
});

void test('busy and other current priorities block actual callbacks while retaining the guide', () => {
  const game = projected();
  const card = game.tleilaxuSpecialKarama!.cards[0];
  assert.deepEqual(prevent(game, card, 'e', true), []);
  assert.equal((markup(game, true).match(/<button(?=[^>]*data-testid="tleilaxu-special-karama-)(?=[^>]*disabled="")[^>]*>/g) ?? []).length, 8);
  for (const field of ['response', 'decision', 'phaseOpening', 'truthtrance', 'nexus'] as const) {
    const changed = structuredClone(game);
    if (field === 'response') changed.response = {} as NonNullable<GameView['response']>;
    if (field === 'decision') changed.decision = { kind: 'revivalStop', player: 'e', recipient: 'e', revival: 'forces' };
    if (field === 'phaseOpening') changed.phaseOpening = {} as NonNullable<GameView['phaseOpening']>;
    if (field === 'truthtrance') changed.truthtrance = {} as NonNullable<GameView['truthtrance']>;
    if (field === 'nexus') changed.nexusTraitors = {
      offer: null, pending: {} as NonNullable<NonNullable<GameView['nexusTraitors']>['pending']>,
    };
    assert.deepEqual(prevent(changed, card), [], field);
    assert.match(markup(changed), /Finish the current response, decision or phase opening/, field);
  }
});

void test('only the native Advanced Tleilaxu owner receives these phase-four controls', () => {
  for (const field of ['projection', 'basic', 'viewer', 'faction', 'phase', 'status'] as const) {
    const game = projected();
    const card = game.tleilaxuSpecialKarama!.cards[0];
    if (field === 'projection') game.tleilaxuSpecialKarama = null;
    if (field === 'basic') game.advanced = false;
    if (field === 'viewer') game.me = 'a';
    if (field === 'faction') game.players[0].faction = 'atreides';
    if (field === 'phase') game.phase = 5;
    if (field === 'status') game.status = 'lobby';
    assert.equal(markup(game), '', field);
    assert.deepEqual(prevent(game, card), [], field);
  }
});

void test('eligibility controls never inspect private hands, Tanks, leader liveness, readiness or revival counters', () => {
  const game = projected();
  const card = game.tleilaxuSpecialKarama!.cards[0];
  for (const player of game.players) {
    for (const field of ['hand', 'spice', 'tanks', 'leaders', 'ready', 'revived', 'freeForcesRevived', 'leaderRevived']) {
      Object.defineProperty(player, field, {
        get() { throw new Error(`Revival-prevention UI read ${player.id} private ${field}`); },
      });
    }
  }
  assert.match(markup(game), /prevent revival for Ready Emperor/);
  assert.deepEqual(prevent(game, card, 't'), [{ type: 'card', mode: 'special', card, target: 't' }]);
  assert.deepEqual(prevent(game, card, 'g'), [{ type: 'card', mode: 'special', card, target: 'g' }]);
});
