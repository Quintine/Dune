import assert from 'node:assert/strict';
import test from 'node:test';
import { Children, createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AmbassadorBoardMarkers } from '../components/ambassador-board-markers';
import {
  AmbassadorInspector,
  AmbassadorSupply,
  EcazPlacement,
  EcazPlacementChoice,
} from '../components/ecaz-ambassadors';
import { MOBILE_STRONGHOLD, territory } from '../game/board';
import { faction } from '../game/catalog';
import { createAmbassadors, type AmbassadorToken } from '../game/ecaz-ambassadors';
import {
  createGame,
  joinGame,
  newPlayer,
  viewGame,
  type Action,
  type GameView,
} from '../game/engine';

// These projected-state fixtures isolate the client contract. The source suite
// separately starts Ixians/Ecaz and performs actual HMS placement and entry.
function projected(placed = true): GameView {
  const game = createGame('ECAZHMSCONTROLS', newPlayer('e', 'Ecaz', 'ecaz'), false, ['ix', 'ecaz']);
  joinGame(game, newPlayer('i', 'Ixians', 'ixians'));
  Object.assign(game, {
    status: 'playing', phase: 4, turn: 3, storm: 9,
    order: ['e', 'i'], decision: { kind: 'ecazPlacement', player: 'e' },
    mobileStronghold: { location: placed ? 'imperial_basin:9' : null },
    ecazAmbassadors: createAmbassadors(() => 0),
  });
  game.players[0].spice = 6;
  const view = viewGame(game, 'e');
  view.ambassadors!.nextCost = 2;
  return view;
}

function markup(game: GameView, busy = false) {
  return renderToStaticMarkup(createElement(EcazPlacement, {
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
  game: GameView,
  selectedToken = game.ambassadors!.tokens.find((token) => token.zone === 'supply')!.id,
  selectedTerritory = MOBILE_STRONGHOLD,
  busy = false,
  finish = false,
): Action | undefined {
  let action: Action | undefined;
  const tree = EcazPlacementChoice({
    game, busy, id: 'ecaz-placement-test', selectedToken, selectedTerritory,
    onSelectToken() {}, onSelectTerritory() {},
    act(value) { action = value; },
  });
  click(tree, finish ? 'ecaz-ambassador-placement-finish' : 'ecaz-ambassador-placement-submit');
  return action;
}

void test('placement offers a projected placed HMS as sheltered even when its attached sector is in the storm', () => {
  const view = projected();
  assert.ok(view.ambassadors!.destinations.some((destination) =>
    destination.id === MOBILE_STRONGHOLD && destination.sheltered,
  ));
  const html = markup(view);
  assert.match(html, /value="hidden_mobile_stronghold">Hidden Mobile Stronghold · sheltered from the storm<\/option>/);
  assert.match(html, /Next placement: <strong>2 spice<\/strong>/);
  assert.match(html, /Your available spice: 6/);
  assert.match(html, /Finish Ambassador placement/);
  assert.doesNotMatch(markup(projected(false)), /value="hidden_mobile_stronghold"/);
});

void test('placement consumes only authoritative available destinations and never reconstructs missing strongholds', () => {
  const view = projected();
  view.ambassadors!.destinations = view.ambassadors!.destinations.filter(
    (destination) => destination.id === MOBILE_STRONGHOLD,
  );
  const html = markup(view);
  assert.match(html, /value="hidden_mobile_stronghold"/);
  assert.doesNotMatch(html, /<option[^>]*value="(?:arrakeen|carthag)"/);
  view.ambassadors!.destinations = [];
  assert.doesNotMatch(markup(view), /value="hidden_mobile_stronghold"/);
  assert.match(markup(view), /No stronghold is currently available for an Ambassador/);
  assert.equal(choose(view), undefined);
});

void test('actual placement callback preserves the projected HMS and supply token with the current price', () => {
  const view = projected();
  const token = view.ambassadors!.tokens.find((candidate) => candidate.zone === 'supply')!;
  assert.deepEqual(choose(view, token.id), {
    type: 'decision', token: token.id, territory: MOBILE_STRONGHOLD,
  });
  const selected = renderToStaticMarkup(createElement(EcazPlacementChoice, {
    game: view, busy: false, id: 'selected', selectedToken: token.id,
    selectedTerritory: MOBILE_STRONGHOLD, onSelectToken() {},
    onSelectTerritory() {}, act() {},
  }));
  assert.match(selected, /value="hidden_mobile_stronghold" selected=""/);
  assert.match(selected, /Place Ambassador · 2 spice/);
  assert.deepEqual(choose(view, token.id, MOBILE_STRONGHOLD, false, true), {
    type: 'decision', decline: true,
  });
});

void test('busy, blocked, insufficient spice, stale choices and unavailable supply never dispatch placement', () => {
  const view = projected();
  const token = view.ambassadors!.tokens.find((candidate) => candidate.zone === 'supply')!.id;
  assert.equal(choose(view, token, MOBILE_STRONGHOLD, true), undefined);
  assert.equal(choose(view, token, MOBILE_STRONGHOLD, true, true), undefined);
  assert.equal(choose(view, ''), undefined);
  assert.equal(choose(view, 'stale-token'), undefined);
  assert.equal(choose(view, token, ''), undefined);
  assert.equal(choose(view, token, 'stale-destination'), undefined);
  for (const field of ['blocked', 'spice', 'supply', 'destination'] as const) {
    const changed = structuredClone(view);
    if (field === 'blocked') changed.ambassadors!.blocked = true;
    if (field === 'spice') changed.players[0].spice = 1;
    if (field === 'supply') changed.ambassadors!.tokens.find((candidate) => candidate.id === token)!.zone = 'used';
    if (field === 'destination') changed.ambassadors!.destinations = [];
    assert.equal(choose(changed, token), undefined, field);
    assert.deepEqual(choose(changed, token, MOBILE_STRONGHOLD, false, true), {
      type: 'decision', decline: true,
    }, field);
  }
  const poor = structuredClone(view);
  poor.players[0].spice = 1;
  assert.match(markup(poor), /You need 1 more spice for this placement/);
  assert.equal((markup(view, true).match(/<(?:select|button)\b[^>]*\sdisabled=""/g) ?? []).length, 4);
});

void test('placement controls retain their actual Ecaz actor and pending decision boundary', () => {
  for (const field of ['viewer', 'actor', 'decision', 'ambassadors'] as const) {
    const view = projected();
    const token = view.ambassadors!.tokens.find((candidate) => candidate.zone === 'supply')!.id;
    if (field === 'viewer') view.me = 'i';
    if (field === 'actor') view.decision!.player = 'i';
    if (field === 'decision') view.decision = null;
    if (field === 'ambassadors') view.ambassadors = null;
    assert.equal(markup(view), '', field);
    assert.equal(choose(view, token), undefined, field);
  }
});

void test('public token inspection names an HMS-attached Ambassador and remains read-only for every viewer', () => {
  const token: AmbassadorToken = {
    id: 'ambassador-emperor', effect: 'emperor', zone: 'placed', location: MOBILE_STRONGHOLD,
  };
  const html = renderToStaticMarkup(createElement(AmbassadorInspector, { token }));
  assert.match(html, /Inspect Emperor Ambassador: Placed in Hidden Mobile Stronghold/);
  assert.match(html, /Placed in Hidden Mobile Stronghold/);
  assert.doesNotMatch(html, /Placed in a stronghold/);
  for (const viewer of ['e', 'i']) {
    const view = projected();
    view.me = viewer;
    view.ambassadors!.tokens = [token];
    const supply = renderToStaticMarkup(createElement(AmbassadorSupply, { game: view }));
    assert.match(supply, /Placed in Hidden Mobile Stronghold/);
    assert.doesNotMatch(supply, /Place Ambassador ·|Finish Ambassador placement/);
  }
});

void test('public map marks all placed faction faces at their actual territory, including the static HMS box', () => {
  const tokens: AmbassadorToken[] = [
    { id: 'ambassador-emperor', effect: 'emperor', zone: 'placed', location: MOBILE_STRONGHOLD },
    { id: 'ambassador-atreides', effect: 'atreides', zone: 'placed', location: 'arrakeen' },
    { id: 'ambassador-harkonnen', effect: 'harkonnen', zone: 'placed', location: 'carthag' },
    { id: 'ambassador-ecaz', effect: 'ecaz', zone: 'supply', location: null },
    { id: 'ambassador-guild', effect: 'guild', zone: 'pool', location: null },
    { id: 'ambassador-richese', effect: 'richese', zone: 'used', location: null },
    { id: 'ambassador-beneGesserit', effect: 'beneGesserit', zone: 'removed', location: null },
  ];
  const html = renderToStaticMarkup(createElement('svg', null,
    createElement(AmbassadorBoardMarkers, { tokens }),
  ));
  assert.equal((html.match(/<g /g) ?? []).length, 3);
  for (const token of tokens.filter((candidate) => candidate.zone === 'placed')) {
    const identity = faction(token.effect);
    const place = territory(token.location!);
    const label = `${identity.name} Ambassador in ${place.name}`;
    assert.ok(html.includes(`aria-label="${label}"`));
    assert.ok(html.includes(`<title>${label}</title>`));
    assert.ok(html.includes(`stroke="${identity.color}"`));
    assert.ok(html.includes(`>${identity.sigil}</text>`));
  }
  const hms = territory(MOBILE_STRONGHOLD);
  assert.ok(html.includes(`translate(${hms.center[0] + 65},${hms.center[1] + 24})`));
  const arrakeen = territory('arrakeen');
  assert.ok(html.includes(`translate(${arrakeen.center[0] - 22},${arrakeen.center[1] - 59})`));
  assert.doesNotMatch(html, /Ecaz Ambassador|Spacing Guild Ambassador|Richese Ambassador|Bene Gesserit Ambassador|supply|pool|used|removed/);
  assert.equal((html.match(/>Amb<\/text>/g) ?? []).length, 3);
  assert.equal(renderToStaticMarkup(createElement(AmbassadorBoardMarkers, { tokens: [] })), '');
});
