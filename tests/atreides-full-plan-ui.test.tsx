import assert from 'node:assert/strict';
import test from 'node:test';
import { Children, createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AtreidesFullPlan } from '../components/atreides-full-plan';
import { baseDeck } from '../game/cards';
import {
  createGame,
  newPlayer,
  viewGame,
  type Action,
  type GameView,
} from '../game/engine';

// These client projections contain public battle metadata and actual card IDs.
// The runtime suite owns preparation, physical spending and private inspection.
function projected(): GameView {
  const game = createGame('ATREIDESFULLPLANUI', newPlayer('a', 'Atreides', 'atreides'), true);
  game.players.push(newPlayer('e', 'Emperor', 'emperor'), newPlayer('g', 'Guild', 'guild'));
  Object.assign(game, {
    status: 'playing', phase: 6, turn: 3, order: ['a', 'e', 'g'],
  });
  const cards = baseDeck().filter((card) => card.effect === 'karama').slice(0, 2);
  game.players[0].hand = cards;
  game.deck = baseDeck().filter((card) => !cards.some((held) => held.id === card.id));
  const view = viewGame(game, 'a');
  view.battle = {
    attacker: 'a', defender: 'e', submitted: [], revealed: false,
    noFieldPlayers: [], fullPlan: null,
  } as unknown as NonNullable<GameView['battle']>;
  view.atreidesFullPlan = { blocked: null, targets: ['a', 'e'], cards: cards.map((card) => card.id) };
  return view;
}

function markup(game: GameView, busy = false) {
  return renderToStaticMarkup(createElement(AtreidesFullPlan, { game, busy, act() {} }));
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

function inspect(game: GameView, card: string, target = 'e', busy = false): Action[] {
  const actions: Action[] = [];
  click(AtreidesFullPlan({ game, busy, act(action) { actions.push(action); } }),
    `atreides-full-plan-${card}-${target}`);
  return actions;
}

void test('the actual full-plan buttons use every projected physical card and target with the original special action', () => {
  const game = projected();
  assert.equal(game.atreidesFullPlan!.cards.length, 2);
  const html = markup(game);
  assert.match(html, /aria-label="Atreides full Battle Plan inspection"/);
  assert.match(html, /Spend Karama · inspect Atreides/);
  assert.match(html, /Spend Karama · inspect Emperor/);
  assert.equal((html.match(/data-testid="atreides-full-plan-/g) ?? []).length, 4);
  for (const card of game.atreidesFullPlan!.cards) {
    for (const target of game.atreidesFullPlan!.targets) {
      assert.deepEqual(inspect(game, card, target), [{ type: 'card', mode: 'special', card, target }]);
    }
  }
  assert.deepEqual(inspect(game, 'stale-card'), []);
  assert.deepEqual(inspect(game, game.atreidesFullPlan!.cards[0], 'g'), []);
});

void test('initial-offer and later quiet controls both allow the same card action without owning a decline or pause', () => {
  const game = projected();
  const card = game.atreidesFullPlan!.cards[0];
  game.decision = { kind: 'fullPlanOffer', player: 'a' };
  assert.deepEqual(inspect(game, card), [{ type: 'card', mode: 'special', card, target: 'e' }]);
  game.decision = null;
  const html = markup(game);
  assert.deepEqual(inspect(game, card), [{ type: 'card', mode: 'special', card, target: 'e' }]);
  assert.match(html, /after battle preparation and before public plan revelation/);
  assert.match(html, /including when zero or one plan is sealed/);
  assert.match(html, /Leaving this power unused now keeps the opportunity open until public revelation/);
  assert.match(html, /Battle plan submission continues normally/);
  assert.doesNotMatch(html, /Keep special power for later|Confirm inspection|Acknowledge inspection/);
});

void test('public submitted status keeps both targets available and explains the original own sealed plan', () => {
  const game = projected();
  const card = game.atreidesFullPlan!.cards[0];
  assert.match(markup(game), /0 of 2 plans sealed/);
  game.battle!.submitted = ['e'];
  assert.match(markup(game), /1 of 2 plans sealed/);
  assert.match(markup(game), /inspect Emperor · sealed plan/);
  assert.doesNotMatch(markup(game), /Your original sealed plan stays fixed/);
  assert.deepEqual(inspect(game, card, 'e'), [{ type: 'card', mode: 'special', card, target: 'e' }]);
  game.battle!.submitted = ['a'];
  const html = markup(game);
  assert.match(html, /Your original sealed plan stays fixed/);
  assert.match(html, /Plans reveal as soon as the other combatant seals/);
  assert.match(html, /this power does not unlock either plan/);
  assert.deepEqual(inspect(game, card, 'a'), [{ type: 'card', mode: 'special', card, target: 'a' }]);
  assert.deepEqual(inspect(game, card, 'e'), [{ type: 'card', mode: 'special', card, target: 'e' }]);
});

void test('blocked reasons and cardless guidance remain readable without generating replacement actions', () => {
  const game = projected();
  const card = game.atreidesFullPlan!.cards[0];
  game.atreidesFullPlan!.blocked = 'Finish the current battle preparation before inspecting a full plan.';
  for (let render = 0; render < 3; render++) {
    const html = markup(game);
    assert.match(html, /Finish the current battle preparation before inspecting a full plan/);
    assert.match(html, /aria-describedby="atreides-full-plan-unavailable"/);
    assert.deepEqual(inspect(game, card), []);
  }
  game.atreidesFullPlan!.blocked = null;
  game.atreidesFullPlan!.cards = [];
  const cardless = markup(game);
  assert.match(cardless, /No spendable Karama is currently available for this special power/);
  assert.doesNotMatch(cardless, /data-testid="atreides-full-plan-/);
  assert.deepEqual(inspect(game, card), []);
  game.atreidesFullPlan!.targets = [];
  assert.match(markup(game), /No combatant is currently available for full-plan inspection/);
});

void test('busy, other priorities and public revelation prevent the actual special-card callbacks', () => {
  const game = projected();
  const card = game.atreidesFullPlan!.cards[0];
  assert.deepEqual(inspect(game, card, 'e', true), []);
  assert.equal((markup(game, true).match(/<button(?=[^>]*data-testid="atreides-full-plan-)(?=[^>]*disabled="")[^>]*>/g) ?? []).length, 4);
  for (const field of ['response', 'decision', 'phaseOpening', 'truthtrance', 'nexus', 'revealed'] as const) {
    const changed = structuredClone(game);
    if (field === 'response') changed.response = {} as NonNullable<GameView['response']>;
    if (field === 'decision') changed.decision = { kind: 'fullPlanOffer', player: 'e' };
    if (field === 'phaseOpening') changed.phaseOpening = {} as NonNullable<GameView['phaseOpening']>;
    if (field === 'truthtrance') changed.truthtrance = {} as NonNullable<GameView['truthtrance']>;
    if (field === 'nexus') changed.nexusTraitors = {
      offer: null, pending: {} as NonNullable<NonNullable<GameView['nexusTraitors']>['pending']>,
    };
    if (field === 'revealed') changed.battle!.revealed = true;
    assert.deepEqual(inspect(changed, card), [], field);
  }
});

void test('the component honors the owner-only native Advanced battle projection', () => {
  for (const field of ['projection', 'basic', 'viewer', 'faction', 'phase', 'battle', 'status'] as const) {
    const game = projected();
    const card = game.atreidesFullPlan!.cards[0];
    if (field === 'projection') game.atreidesFullPlan = null;
    if (field === 'basic') game.advanced = false;
    if (field === 'viewer') game.me = 'e';
    if (field === 'faction') game.players[0].faction = 'emperor';
    if (field === 'phase') game.phase = 5;
    if (field === 'battle') game.battle = null;
    if (field === 'status') game.status = 'lobby';
    assert.equal(markup(game), '', field);
    assert.deepEqual(inspect(game, card), [], field);
  }
});

void test('No-Field special-power guidance remains inline and never reads private plans, hands or wallets', () => {
  const game = projected();
  const card = game.atreidesFullPlan!.cards[0];
  game.battle!.noFieldPlayers = ['e'];
  Object.defineProperty(game.battle, 'plans', {
    get() { throw new Error('Full-plan controls read private plans'); },
  });
  for (const player of game.players) {
    for (const field of ['hand', 'spice', 'forces', 'noField']) {
      Object.defineProperty(player, field, {
        get() { throw new Error(`Full-plan controls read ${player.id} private ${field}`); },
      });
    }
  }
  const html = markup(game);
  assert.match(html, /Provisional power distinction: special Karama reads the complete committed No-Field plan, including dial and support/);
  assert.match(html, /Ordinary Prescience still cannot request its dial/);
  assert.match(html, /private read does not reveal or materialize the marker before both plans seal/);
  assert.match(html, /Existing sealed plans cannot change/);
  assert.deepEqual(inspect(game, card), [{ type: 'card', mode: 'special', card, target: 'e' }]);
});
