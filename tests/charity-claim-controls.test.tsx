import assert from 'node:assert/strict';
import test from 'node:test';
import { Children, createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CharityClaim } from '../components/charity-claim';
import {
  createGame,
  newPlayer,
  viewGame,
  type Action,
  type GameView,
} from '../game/engine';
import type { FactionId } from '../game/catalog';

// The client consumes entitlement and funding projections. Source tests cover
// the actual CHOAM debit and provisional bank shortfall without private shares.
function projected({
  advanced = false,
  faction = 'emperor',
  spice = 0,
}: {
  advanced?: boolean;
  faction?: FactionId;
  spice?: number;
} = {}): GameView {
  const game = createGame('CHARITYCONTROLS', newPlayer('p', 'Claimant', faction), advanced, ['choam']);
  game.players.push(newPlayer('other', 'Other', faction === 'choam' ? 'emperor' : 'choam'));
  Object.assign(game, {
    status: 'playing', phase: 2, turn: 3, order: ['p', 'other'],
    choamCharity: { turn: 3, canceled: false },
  });
  game.players[0].spice = spice;
  const view = viewGame(game, 'p');
  view.charityOrder = null;
  view.charity.orderBlocked = null;
  return view;
}

function ordered(remaining = ['p', 'other'], order = ['p', 'other']): GameView {
  const game = projected({ advanced: true, spice: 1 });
  game.charityOrder = { version: 1, turn: game.turn, order, remaining };
  game.charity.orderBlocked = remaining[0] === 'p' ? null : 'Wait for the current Charity turn.';
  return game;
}

function markup(game: GameView, busy = false) {
  return renderToStaticMarkup(createElement(CharityClaim, { game, busy, act() {} }));
}

function click(node: ReactNode, selector = 'charity-claim-submit'): boolean {
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

function claim(game: GameView, busy = false): Action[] {
  const actions: Action[] = [];
  click(CharityClaim({ game, busy, act(action) { actions.push(action); } }));
  return actions;
}

function finish(game: GameView, busy = false): Action[] {
  const actions: Action[] = [];
  click(CharityClaim({ game, busy, act(action) { actions.push(action); } }), 'charity-turn-finish');
  return actions;
}

void test('the actual charity control submits one ordinary claim action from its current entitlement', () => {
  const game = projected({ spice: 1 });
  assert.match(markup(game), /If you have fewer than two spice, claim charity once to reach two/);
  assert.match(markup(game), /Claim 1 charity spice/);
  assert.deepEqual(claim(game), [{ type: 'charity' }]);
});

void test('stamped current Charity controls submit exact claim and finish packets without changing funding guidance', () => {
  const game = ordered(), html = markup(game);
  assert.match(html, /First Player counterclockwise, one player at a time/);
  assert.match(html, /It is your Charity turn/); assert.match(html, /Finish Charity turn/);
  assert.match(html, /CHOAM pays as much of the ordinary claim as it can/);
  assert.deepEqual(claim(game), [{ type: 'charity' }]);
  assert.deepEqual(finish(game), [{ type: 'ready' }]);
  game.players[0].charityClaimed = true; game.charity.amount = 0;
  assert.deepEqual(claim(game), []); assert.deepEqual(finish(game), [{ type: 'ready' }]);
});

void test('waiting and completed Charity turns show public names and cannot claim or finish', () => {
  const waiting = ordered(['other', 'p'], ['other', 'p']);
  const complete = ordered(['other']);
  for (const game of [waiting, complete]) {
    Object.defineProperty(game.players[1], 'spice', { get() { throw Error('Turn status cannot inspect a rival wallet'); } });
    assert.match(markup(game), /Waiting for Other to finish Charity/);
    assert.deepEqual(claim(game), []); assert.deepEqual(finish(game), []);
  }
  assert.match(markup(waiting), /Your turn comes later in the public order/);
  assert.match(markup(complete), /Your Charity turn is complete/);
  const ended = ordered([]); assert.match(markup(ended), /All Charity turns are complete/);
  assert.deepEqual(finish(ended), []);
});

void test('stamped Charity claim and finish retain native pending-income and modal priority', () => {
  for (const change of [
    (game: GameView) => { game.charity.incomePending = true; },
    (game: GameView) => { game.response = { kind: 'bgCharity', owner: 'other', passed: [], amount: 2 }; },
    (game: GameView) => { game.decision = { kind: 'auctionPayment', player: 'p' }; },
    (game: GameView) => { game.phaseOpening = { passed: [] }; },
    (game: GameView) => { game.truthtrance = {} as NonNullable<GameView['truthtrance']>; },
    (game: GameView) => { game.nexusTraitors = { offer: null, pending: {} as NonNullable<NonNullable<GameView['nexusTraitors']>['pending']> }; },
    (game: GameView) => { game.automaticContinuationPending = true; },
  ]) {
    const game = ordered(); change(game); assert.deepEqual(claim(game), []); assert.deepEqual(finish(game), []);
  }
  const game = ordered(); assert.deepEqual(claim(game, true), []); assert.deepEqual(finish(game, true), []);
  assert.match(markup(game, true), /data-testid="charity-turn-finish"[^>]*disabled/);
});

void test('Basic and unstamped Advanced Charity keep their existing claim control without a new finish action', () => {
  for (const advanced of [false, true]) {
    const game = projected({ advanced });
    assert.deepEqual(claim(game), [{ type: 'charity' }]); assert.deepEqual(finish(game), []);
    assert.doesNotMatch(markup(game), /charity-turn-finish|charity-turn-status|First Player counterclockwise/);
  }
});

void test('busy, pending income, a completed claim and zero entitlement block the actual callback', () => {
  const game = projected();
  assert.deepEqual(claim(game, true), []);
  assert.match(markup(game, true), /<button\b[^>]*\sdisabled=""/);
  for (const field of ['incomePending', 'charityClaimed', 'amount'] as const) {
    const changed = structuredClone(game);
    if (field === 'incomePending') changed.charity.incomePending = true;
    if (field === 'charityClaimed') changed.players[0].charityClaimed = true;
    if (field === 'amount') changed.charity.amount = 0;
    assert.deepEqual(claim(changed), [], field);
    assert.match(markup(changed), /<button\b[^>]*\sdisabled=""/, field);
  }
  const noClaim = projected({ spice: 2 });
  assert.equal(noClaim.charity.amount, 0);
  assert.deepEqual(claim(noClaim), []);
  assert.match(markup(noClaim), />Claim charity<svg/);
});

void test('charity controls preserve the existing Truthtrance and Nexus pending blocks and phase boundary', () => {
  const game = projected();
  const truthtrance = structuredClone(game);
  truthtrance.truthtrance = {} as NonNullable<GameView['truthtrance']>;
  assert.deepEqual(claim(truthtrance), []);
  const nexus = structuredClone(game);
  nexus.nexusTraitors = {
    offer: null,
    pending: {} as NonNullable<NonNullable<GameView['nexusTraitors']>['pending']>,
  };
  assert.deepEqual(claim(nexus), []);
  for (const field of ['phase', 'status', 'viewer'] as const) {
    const changed = structuredClone(game);
    if (field === 'phase') changed.phase = 3;
    if (field === 'status') changed.status = 'lobby';
    if (field === 'viewer') changed.me = 'missing';
    assert.equal(markup(changed), '', field);
    assert.deepEqual(claim(changed), [], field);
  }
});

void test('Basic and Advanced Bene Gesserit retain their separate eligibility and Karama guidance', () => {
  const basicPoor = projected({ faction: 'beneGesserit', spice: 1 });
  assert.equal(basicPoor.charity.amount, 1);
  assert.match(markup(basicPoor), /fewer than two spice/);
  assert.doesNotMatch(markup(basicPoor), /cancel the faction benefit with Karama/);
  assert.deepEqual(claim(basicPoor), [{ type: 'charity' }]);
  const basicRich = projected({ faction: 'beneGesserit', spice: 7 });
  assert.equal(basicRich.charity.amount, 0);
  assert.deepEqual(claim(basicRich), []);
  const advanced = projected({ advanced: true, faction: 'beneGesserit', spice: 7 });
  assert.equal(advanced.charity.amount, 2);
  assert.match(markup(advanced), /Receive two spice once per turn/);
  assert.match(markup(advanced), /opponents may cancel the faction benefit with Karama/);
  assert.match(markup(advanced), /Claim 2 charity spice/);
  assert.deepEqual(claim(advanced), [{ type: 'charity' }]);
});

void test('CHOAM poverty itself projects a normal bank claim without a self-funded payment explanation', () => {
  const game = projected({ faction: 'choam', spice: 0 });
  assert.equal(game.charity.payer, null);
  assert.equal(game.charity.amount, 2);
  const html = markup(game);
  assert.match(html, /Charity is paid by the Spice Bank/);
  assert.doesNotMatch(html, /CHOAM pays as much|This funding rule is provisional/);
  assert.deepEqual(claim(game), [{ type: 'charity' }]);
});

void test('Homeworld bank bonuses and Inflation guidance persist with their projected doubled amounts', () => {
  const game = projected();
  game.charity.homeworld = 1;
  game.charity.amount = 3;
  assert.match(markup(game), /Low Homeworld population adds 1 spice directly from the bank/);
  assert.match(markup(game), /Claim 3 charity spice/);
  game.charity.multiplier = 2;
  game.charity.ordinary = 4;
  game.charity.homeworld = 2;
  game.charity.amount = 6;
  const doubled = markup(game);
  assert.match(doubled, /Inflation doubles the amount of charity you receive/);
  assert.match(doubled, /Ordinary eligibility still requires fewer than two spice/);
  assert.match(doubled, /advanced Bene Gesserit receives four regardless of wealth/);
  assert.match(doubled, /Low Homeworld population adds 2 spice directly from the bank after Inflation doubles the bonus/);
  assert.match(doubled, /Claim 6 charity spice/);
  game.charity.multiplier = 0;
  game.charity.ordinary = 0;
  game.charity.homeworld = 0;
  game.charity.amount = 0;
  assert.match(markup(game), /Inflation cancels charity for every faction this turn/);
  assert.deepEqual(claim(game), []);
});

void test('active CHOAM payer guidance always states the provisional bank fallback without reading rival wallets', () => {
  const game = projected();
  const rival = game.players.find((player) => player.id === game.charity.payer)!;
  Object.defineProperty(rival, 'spice', {
    get() { throw new Error('Charity guidance read rival spice'); },
  });
  const guidance = 'CHOAM pays as much of the ordinary claim as it can; the Spice Bank supplies any shortfall. This funding rule is provisional.';
  for (let render = 0; render < 3; render++) {
    const html = markup(game);
    assert.ok(html.includes(guidance));
    assert.match(html, /The ordinary claim is 2 spice/);
    assert.doesNotMatch(html, /remaining spice|current balance|bank supplies [0-9]/i);
  }
  assert.deepEqual(claim(game), [{ type: 'charity' }]);
  game.charity.payer = null;
  assert.match(markup(game), /Charity is paid by the Spice Bank/);
  assert.ok(!markup(game).includes(guidance));
});
