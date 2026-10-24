import assert from 'node:assert/strict';
import test from 'node:test';
import { Children, createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdvisorPreparation } from '../components/advisor-preparation';
import {
  createGame,
  newPlayer,
  viewGame,
  type Action,
  type GameView,
} from '../game/engine';

// Client-only public projections isolate persistent controls. The source suite
// exercises actual advisor groups, window closure and Karama continuations.
function projected(): GameView {
  const game = createGame('ADVISORPREPARATIONCONTROLS', newPlayer('b', 'Bene Gesserit', 'beneGesserit'), true);
  game.players.push(newPlayer('a', 'Atreides', 'atreides'));
  Object.assign(game, {
    status: 'playing', phase: 2, turn: 3, order: ['b', 'a'],
  });
  const view = viewGame(game, 'b');
  view.advisorPreparation = { blocked: null, territories: ['arrakeen', 'carthag'] };
  return view;
}

function markup(game: GameView, busy = false) {
  return renderToStaticMarkup(createElement(AdvisorPreparation, {
    game, busy, act() {},
  }));
}

function click(node: ReactNode, place: string): boolean {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{
      children?: ReactNode;
      onClick?: () => void;
      'data-testid'?: string;
    }>(child)) continue;
    if (child.props['data-testid'] === `advisor-preparation-${place}` && child.props.onClick) {
      child.props.onClick();
      return true;
    }
    if (click(child.props.children, place)) return true;
  }
  return false;
}

function prepare(game: GameView, place = 'arrakeen', busy = false): Action[] {
  const actions: Action[] = [];
  click(AdvisorPreparation({ game, busy, act(action) { actions.push(action); } }), place);
  return actions;
}

void test('the native Advanced owner can prepare each projected territory with its exact original action', () => {
  const game = projected();
  const html = markup(game);
  assert.match(html, /aria-label="Bene Gesserit advisor preparation"/);
  assert.match(html, /Prepare advisors · Arrakeen/);
  assert.match(html, /Prepare advisors · Carthag/);
  assert.doesNotMatch(html, /disabled=""/);
  assert.deepEqual(prepare(game), [{ type: 'prepareAdvisors', territory: 'arrakeen' }]);
  assert.deepEqual(prepare(game, 'carthag'), [{ type: 'prepareAdvisors', territory: 'carthag' }]);
  assert.deepEqual(prepare(game, 'sietch_tabr'), []);
});

void test('the persistent guide names the printed window and keeps native choices and independent flips separate', () => {
  const html = markup(projected());
  assert.match(html, /After Spice Blow and any Nexus/);
  assert.match(html, /until the first actual shipment has occurred/);
  assert.match(html, /Charity, Bidding, Revival and the opening of Shipment and Movement/);
  assert.match(html, /turn all your advisors there into fighters, across every sector/);
  assert.match(html, /Storm, ordinary allied occupation and fresh-advisor restrictions\s*still apply/);
  assert.match(html, /Provisional Karama policy: a canceled preparation blocks that territory until this window ends/);
  assert.match(html, /Other eligible territories remain available/);
  assert.match(html, /Intrusion, Nexus conversion and automatic advisor flips remain independent/);
  assert.match(html, /ordinary advisor chooser during Shipment and Movement remains available/);
  assert.match(html, /Declining that choice does not close this preparation window/);
});

void test('busy, Truthtrance and pending Nexus block the actual buttons without removing their guide', () => {
  const game = projected();
  assert.deepEqual(prepare(game, 'arrakeen', true), []);
  assert.equal((markup(game, true).match(/<button\b[^>]*\sdisabled=""/g) ?? []).length, 2);
  const truthtrance = structuredClone(game);
  truthtrance.truthtrance = {} as NonNullable<GameView['truthtrance']>;
  assert.deepEqual(prepare(truthtrance), []);
  const nexus = structuredClone(game);
  nexus.nexusTraitors = {
    offer: null,
    pending: {} as NonNullable<NonNullable<GameView['nexusTraitors']>['pending']>,
  };
  assert.deepEqual(prepare(nexus), []);
  assert.match(markup(nexus), /Provisional Karama policy/);
});

void test('current response, decision and phase-opening priority defensively prevent preparation', () => {
  for (const field of ['response', 'decision', 'phaseOpening'] as const) {
    const game = projected();
    if (field === 'response') game.response = {} as NonNullable<GameView['response']>;
    if (field === 'decision') game.decision = {} as NonNullable<GameView['decision']>;
    if (field === 'phaseOpening') game.phaseOpening = {} as NonNullable<GameView['phaseOpening']>;
    assert.deepEqual(prepare(game), [], field);
    const html = markup(game);
    assert.equal((html.match(/<button\b[^>]*\sdisabled=""/g) ?? []).length, 2, field);
    assert.match(html, /Finish the current response, decision or phase opening before preparing advisors/, field);
  }
});

void test('projected blocks remain readable and authoritative across renders while unavailable territories never gain buttons', () => {
  const game = projected();
  game.advisorPreparation!.blocked = 'Finish the pending revival before preparing advisors.';
  for (let render = 0; render < 3; render++) {
    const html = markup(game);
    assert.match(html, /Finish the pending revival before preparing advisors/);
    assert.match(html, /aria-describedby="advisor-preparation-unavailable"/);
    assert.match(html, /Provisional Karama policy/);
    assert.deepEqual(prepare(game), []);
  }
  game.advisorPreparation = { blocked: null, territories: [] };
  assert.match(markup(game), /No advisor territory is currently eligible for preparation/);
  assert.doesNotMatch(markup(game), /<button\b/);
  assert.deepEqual(prepare(game), []);
});

void test('only the native Advanced owner sees an open phase-two-through-five preparation descriptor', () => {
  for (const phase of [2, 3, 4, 5]) {
    const game = projected();
    game.phase = phase;
    assert.match(markup(game), /Prepare advisors for battle/);
    assert.deepEqual(prepare(game), [{ type: 'prepareAdvisors', territory: 'arrakeen' }]);
  }
  for (const field of ['basic', 'viewer', 'faction', 'before', 'after', 'closed', 'status'] as const) {
    const game = projected();
    if (field === 'basic') game.advanced = false;
    if (field === 'viewer') game.me = 'a';
    if (field === 'faction') game.players[0].faction = 'atreides';
    if (field === 'before') game.phase = 1;
    if (field === 'after') game.phase = 6;
    if (field === 'closed') game.advisorPreparation = null;
    if (field === 'status') game.status = 'lobby';
    assert.equal(markup(game), '', field);
    assert.deepEqual(prepare(game), [], field);
  }
});

void test('preparation controls never inspect either seat’s private wallets, cards or force counts', () => {
  const game = projected();
  for (const player of game.players) {
    for (const field of ['spice', 'hand', 'forces', 'elites', 'advisors', 'tanks']) {
      Object.defineProperty(player, field, {
        get() { throw new Error(`Preparation read ${player.id} private ${field}`); },
      });
    }
  }
  assert.match(markup(game), /Prepare advisors · Arrakeen/);
  assert.deepEqual(prepare(game), [{ type: 'prepareAdvisors', territory: 'arrakeen' }]);
});
