import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PhaseBidClaimFields, phaseBidClaimInputError } from '../components/phase-bid-claim-fields';
import { PhaseBidPromises, PhaseBidPromiseGuideButton } from '../components/phase-bid-promises';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import type { PhaseBidClaim } from '../game/turn-bid-promises';

type ElementProps = { children?: ReactNode; [key: string]: unknown };
function elements(node: ReactNode): ReactElement<ElementProps>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function edit(props: Parameters<typeof PhaseBidClaimFields>[0], minimum: number) {
  const input = elements(PhaseBidClaimFields(props)).find(element =>
    element.props.id === 'truth-phase-bid-minimum' && typeof element.props.onChange === 'function');
  assert.ok(input);
  (input.props.onChange as (event: { currentTarget: { valueAsNumber: number } }) => void)({ currentTarget: { valueAsNumber: minimum } });
}
/** Controlled projections exercise the rendered owned control, not a real question. */
function projected(type: 'bid' | 'passBid' = 'bid'): GameView {
  const source = createGame('TRUTHPHASEBIDCONTROLS', newPlayer('p', 'Respondent', 'emperor'));
  joinGame(source, newPlayer('a', 'Asker', 'atreides'));
  const game = viewGame(source, 'p');
  game.status = 'playing'; game.phase = 3; game.turn = 2;
  game.auction = { bid: 1, bidder: 'a', active: 'p', remaining: 2, inspectionBlocked: null, card: null };
  game.bidPromiseLot = { turn: 2, lot: 1 };
  game.phaseBidPromises = [{ event: 'owned-event', player: 'p', asker: 'a', turn: 2, minimum: 4, answer: type === 'bid' }];
  game.phaseBidPromiseGuide = { action: type === 'bid'
    ? { type: 'bid', amount: 4, allyPayment: 1, phaseBidPromiseEvent: 'owned-event', phaseBidPromiseLot: 1 }
    : { type: 'passBid', phaseBidPromiseEvent: 'owned-event', phaseBidPromiseLot: 1 } };
  return game;
}

void test('phase bid editor preserves the current turn and accepts only whole positive minima', () => {
  const value: PhaseBidClaim = { turn: 2, minimum: 4 }, changes: PhaseBidClaim[] = [];
  const props = { value, onChange(next: PhaseBidClaim) { changes.push(next); } };
  const html = renderToStaticMarkup(createElement(PhaseBidClaimFields, props));
  assert.match(html, /Turn 2/);
  assert.match(html, /before Bidding ends this turn/);
  assert.match(html, /Earlier bids do not count/);
  for (const minimum of [1, 7, Number.MAX_SAFE_INTEGER]) edit(props, minimum);
  assert.deepEqual(changes, [1, 7, Number.MAX_SAFE_INTEGER].map(minimum => ({ ...value, minimum })));
  for (const minimum of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.ok(phaseBidClaimInputError({ ...value, minimum })); edit(props, minimum);
  }
  edit({ ...props, disabled: true }, 8);
  assert.equal(changes.length, 3);
});

void test('phase promises remain visible and do not expose another player’s promises', () => {
  const game = projected();
  game.phaseBidPromises.push(
    { event: 'no', player: 'p', asker: 'a', turn: 2, minimum: 8, answer: false },
    { event: 'done', player: 'p', asker: 'a', turn: 2, minimum: 2, answer: true, fulfilled: true },
    { event: 'released', player: 'p', asker: 'a', turn: 2, minimum: 12, answer: true, released: true },
    { event: 'foreign', player: 'a', asker: 'p', turn: 2, minimum: 99, answer: true },
  );
  game.auction!.active = 'a'; game.phaseBidPromiseGuide = null;
  const before = structuredClone(game);
  const html = renderToStaticMarkup(createElement(PhaseBidPromises, { game, busy: false, send() {} }));
  assert.match(html, /Your Bidding phase promises/);
  assert.match(html, /No forbids qualifying bids through Bidding close/);
  assert.match(html, /Fulfilled: this commitment is complete/);
  assert.match(html, /Released: this commitment is no longer possible/);
  assert.match(html, /Your next bid opportunity is still ahead/);
  assert.doesNotMatch(html, /99 spice|foreign/);
  assert.deepEqual(game, before);
});

void test('the real guide callback preserves its event and rejects stale or busy projections', () => {
  for (const type of ['bid', 'passBid'] as const) {
    const game = projected(type), sent: Action[] = [];
    const props = { game, busy: false, send(action: Action) { sent.push(action); } };
    const button = PhaseBidPromiseGuideButton(props); assert.ok(button);
    button.props.onClick();
    assert.deepEqual(sent, [game.phaseBidPromiseGuide!.action]);
    assert.equal(sent[0], game.phaseBidPromiseGuide!.action);
    const stale = PhaseBidPromiseGuideButton(props); assert.ok(stale);
    game.phaseBidPromises[0].event = 'different-event'; stale.props.onClick();
    assert.equal(sent.length, 1);
  }
  const game = projected(), sent: Action[] = [];
  const props = { game, busy: false, send(action: Action) { sent.push(action); } };
  const button = PhaseBidPromiseGuideButton(props); assert.ok(button);
  props.busy = true; button.props.onClick();
  assert.deepEqual(sent, []);
  props.busy = false;
  const priorLotButton = PhaseBidPromiseGuideButton(props); assert.ok(priorLotButton);
  game.bidPromiseLot = { turn: 2, lot: 2 };
  priorLotButton.props.onClick();
  assert.deepEqual(sent, []);
});
