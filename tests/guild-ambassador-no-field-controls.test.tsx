import assert from 'node:assert/strict';
import test from 'node:test';
import { Children, createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AmbassadorNoField,
  AmbassadorNoFieldChoice,
  type AmbassadorNoFieldOffer,
} from '../components/ambassador-no-field';
import { AmbassadorShipment } from '../components/ambassador-shipment';
import type { Action, GameView } from '../game/engine';

const event = 'guild-ambassador-no-field-original';

function option(
  key: string,
  fields: Partial<AmbassadorNoFieldOffer['options'][number]> = {},
): AmbassadorNoFieldOffer['options'][number] {
  return {
    key,
    label: `Concealed No-Field ${key} · Arrakeen sector 10 · free`,
    territory: 'arrakeen',
    sector: 10,
    action: {
      type: 'decision', event, amount: 1, noField: `richese-${key}`,
      territory: 'arrakeen', sector: 10,
    },
    blocked: null,
    ...fields,
  };
}

function offer(stage: AmbassadorNoFieldOffer['stage'] = 'own'): AmbassadorNoFieldOffer {
  return {
    stage,
    policy: 'Provisional Guild Ambassador No-Field policy: a concealed native marker counts as one force and costs no spice. This independent grant does not spend ordinary shipment or movement.',
    options: [0, 3, 5].map((value) => option(String(value))),
  };
}

// These component contracts deliberately use projected offers. The related
// engine source fixtures exercise actual token custody, payment and continuation.
function projected(noField: AmbassadorNoFieldOffer | null = offer()): GameView {
  return {
    me: 'r',
    players: [
      { id: 'r', name: 'Richese', faction: 'richese', reserves: 10 },
      { id: 'e', name: 'Ecaz', faction: 'ecaz', reserves: 10 },
    ],
    decision: { kind: 'ecazAmbassador', player: 'r', event },
    ambassadorEntry: {
      event, stage: 'ship', effect: 'guild', beneficiary: 'r', noField,
      shipment: {
        maximum: 4, eliteReserves: 0,
        destinations: [{ territory: 'arrakeen', sector: 10, maximum: 4, blocked: null }],
      },
    },
  } as unknown as GameView;
}

function markup(game: GameView, busy = false) {
  return renderToStaticMarkup(createElement(AmbassadorShipment, {
    game, busy, act() {},
  }));
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

function choose(
  current: AmbassadorNoFieldOffer,
  selectedKey: string,
  busy = false,
  decline = false,
): Action | undefined {
  let action: Action | undefined;
  const tree = AmbassadorNoFieldChoice({
    offer: current, event, selectedKey, busy,
    onSelect() {}, act(value) { action = value; },
  });
  click(tree, decline ? 'ambassador-no-field-decline' : 'ambassador-no-field-submit');
  return action;
}

void test('native marker controls retain the separate physical grant and submit only the complete projected token action', () => {
  const current = offer();
  const html = markup(projected(current));
  assert.match(html, /aria-label="Ambassador No-Field shipment"/);
  assert.match(html, /Provisional Guild Ambassador No-Field policy/);
  assert.match(html, /does not spend ordinary shipment or movement/);
  for (const value of [0, 3, 5]) assert.match(html, new RegExp(`Concealed No-Field ${value}`));
  assert.match(html, /Selected: 4 physical forces, including 0 elites/);
  assert.match(html, /Ship selected forces for free/);
  assert.match(html, /Send no forces/);
  assert.doesNotMatch(html, /No-Field substitution.*unfinished/);
  for (const selected of current.options) {
    const action = choose(current, selected.key);
    assert.deepEqual(action, selected.action);
    assert.equal(action?.amount, 1);
    assert.equal(action?.elite, undefined);
    assert.equal(action?.smuggler, undefined);
    assert.equal(action?.type, 'decision');
  }
});

void test('zero reserves still expose marker destinations without inventing physical forces', () => {
  const game = projected();
  game.players[0].reserves = 0;
  game.ambassadorEntry!.shipment!.maximum = 0;
  game.ambassadorEntry!.shipment!.destinations = [];
  const html = markup(game);
  assert.match(html, /value="arrakeen" selected=""/);
  assert.match(html, /value="arrakeen:10" selected=""/);
  assert.match(html, /Concealed No-Field 0/);
  assert.match(html, /Selected: 0 physical forces, including 0 elites/);
  assert.match(html, /You have no reserve forces available for this shipment/);
  assert.match(html, /Send no forces/);
});

void test('an existing native marker can be revealed without choosing or carrying a destination', () => {
  const current = offer();
  current.options = [option('reveal', {
    label: 'Reveal existing No-Field', territory: undefined, sector: undefined,
    action: { type: 'decision', event, revealNoField: true },
  })];
  const selection = AmbassadorNoField({
    game: projected(current), busy: false, act() {}, destination: 'hagga_basin', sector: 12,
  });
  assert.ok(selection);
  assert.equal(selection.props.offer.options.length, 1);
  assert.deepEqual(choose(current, 'reveal'), current.options[0].action);
});

void test('allied request hides token values and both private decision stages replace the physical form', () => {
  const request = offer('request');
  request.policy = 'Request a whole-grant No-Field substitution from your actual Richese ally. The ally chooses its private marker before you consent.';
  request.options = [option('request-arrakeen', {
    label: 'Ask Richese for a No-Field in Arrakeen sector 10',
    action: { type: 'decision', event, territory: 'arrakeen', sector: 10, requestNoField: true },
  })];
  const requestGame = projected(request);
  requestGame.me = 'e';
  requestGame.decision!.player = 'e';
  requestGame.ambassadorEntry!.beneficiary = 'e';
  const requestHtml = markup(requestGame);
  assert.match(requestHtml, /Request an allied No-Field/);
  assert.match(requestHtml, /Ask Richese for a No-Field in Arrakeen/);
  assert.doesNotMatch(requestHtml, /No-Field [035]/);
  assert.match(requestHtml, /Ship selected forces for free/);
  assert.deepEqual(choose(request, request.options[0].key), request.options[0].action);

  for (const stage of ['supply', 'consent'] as const) {
    const current = offer(stage);
    current.policy = 'The allied marker reveals immediately: 3 reserve forces, capped at four. Mandatory transport fee: 1 spice to the Guild or bank, paid by either ally; this does not spend ordinary shipment or movement.';
    current.options = stage === 'supply'
      ? [0, 3, 5].flatMap((value) => ['r', 'e'].map((payer) => option(`${stage}-${value}-${payer}`, {
          label: `Offer No-Field ${value} · ${Math.min(value, 4)} forces · ${payer === 'r' ? 'Richese' : 'Ecaz'} pays 1 spice`,
          action: { type: 'decision', event, choice: stage, token: `richese-${value}`, payer },
        })))
      : [option(`${stage}-3`, {
          label: 'Accept No-Field 3 · 3 forces · Richese pays 1 spice',
          action: { type: 'decision', event, choice: stage, token: 'richese-3', payer: 'r' },
        })];
    current.decline = { type: 'decision', event, declineNoField: true };
    current.declineLabel = 'Decline and return to the original grant';
    const game = projected(current);
    game.ambassadorEntry!.beneficiary = 'e';
    game.ambassadorEntry!.shipment = null;
    if (stage === 'consent') {
      game.me = 'e';
      game.decision!.player = 'e';
    }
    const html = markup(game);
    assert.match(html, /aria-label="Ambassador No-Field shipment"/);
    assert.match(html, /No-Field 3 · 3 forces · Richese pays 1 spice/);
    if (stage === 'supply') {
      assert.match(html, /No-Field 0 · 0 forces · Ecaz pays 1 spice/);
      assert.match(html, /No-Field 5 · 4 forces · Ecaz pays 1 spice/);
    }
    assert.match(html, /Mandatory transport fee: 1 spice to the Guild or bank/);
    assert.match(html, /Decline and return to the original grant/);
    assert.doesNotMatch(html, /Physical forces to ship|Ship selected forces for free|Send no forces/);
    for (const selected of current.options)
      assert.deepEqual(choose(current, selected.key), selected.action);
    assert.deepEqual(choose(current, '', false, true), current.decline);
  }
});

void test('busy, unselected, blocked and obsolete choices cannot dispatch through their callbacks', () => {
  const current = offer('supply');
  current.options.push(option('blocked', { blocked: 'The payer cannot cover this transport fee.' }));
  current.decline = { type: 'decision', event, declineNoField: true };
  for (const selected of ['', 'obsolete', 'blocked']) assert.equal(choose(current, selected), undefined);
  assert.equal(choose(current, '3', true), undefined);
  assert.equal(choose(current, '', true, true), undefined);
  const html = renderToStaticMarkup(createElement(AmbassadorNoFieldChoice, {
    offer: current, event, selectedKey: '3', onSelect() {}, act() {}, busy: true,
  }));
  assert.equal((html.match(/<button\b[^>]*\sdisabled=""/g) ?? []).length, 2);
  assert.match(html, /The payer cannot cover this transport fee/);
  assert.equal(choose({ ...current, options: [] }, '3'), undefined);
});

void test('fresh event, stage and destination projections reset selection and use only the incoming authoritative action', () => {
  const game = projected();
  const first = AmbassadorNoField({ game, busy: false, act() {}, destination: 'arrakeen', sector: 10 });
  assert.ok(first);
  const next = structuredClone(game);
  next.ambassadorEntry!.event = 'guild-ambassador-no-field-next';
  next.ambassadorEntry!.noField!.options[1].action = { type: 'decision', event: 'guild-ambassador-no-field-next', amount: 1, noField: 'new-3', territory: 'arrakeen', sector: 10 };
  const fresh = AmbassadorNoField({ game: next, busy: false, act() {}, destination: 'arrakeen', sector: 10 });
  assert.ok(fresh);
  assert.notEqual(first.key, fresh.key);
  assert.deepEqual(choose(fresh.props.offer, '3'), next.ambassadorEntry!.noField!.options[1].action);
  next.ambassadorEntry!.noField!.stage = 'supply';
  const stage = AmbassadorNoField({ game: next, busy: false, act() {} });
  assert.ok(stage);
  assert.notEqual(fresh.key, stage.key);
  const otherDestination = AmbassadorNoField({ game, busy: false, act() {}, destination: 'hagga_basin', sector: 12 });
  assert.ok(otherDestination);
  assert.notEqual(first.key, otherDestination.key);
  assert.equal(otherDestination.props.offer.options.length, 0);
  assert.equal(choose(otherDestination.props.offer, '3'), undefined);
});

void test('only the current Ambassador decision actor gets controls, even if an obsolete projection remains', () => {
  const game = projected();
  game.decision!.player = 'e';
  assert.equal(markup(game), '');
  assert.equal(AmbassadorNoField({ game, busy: false, act() {} }), null);
  const ended = projected();
  ended.ambassadorEntry!.stage = 'move';
  assert.equal(markup(ended), '');
  const noOffer = projected(null);
  assert.doesNotMatch(markup(noOffer), /Ambassador No-Field shipment/);
  assert.match(markup(noOffer), /Send no forces/);
});
