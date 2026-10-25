import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlanetologistMovement, planetologistMoveDraft } from '../components/planetologist-movement';
import { PlanetologistMovementAction, planetologistMovementBlocked, type PlanetologistMovementActionProps } from '../components/planetologist-movement-action';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import { botGroundMoveAllowed, groundMoveRouteDistance } from '../game/bot-mobility';
import { splitLocation } from '../game/board';
import { createRicheseNoField, deployRicheseNoField, projectRicheseNoField, type NoFieldValue } from '../game/richese-no-field';

const markerSource = 'wind_pass:14';
const companionSource = 'wind_pass:15';
const secondSource = 'wind_pass_north:17';
const thirdSource = 'false_wall_west:16';

// Controlled entitled projections supplement the separate native gather source.
// No trainer, army, marker or pending receipt is installed in a Game. React
// renders the stateful parent; direct calls enter only the actual submit leaf.
function projected(value: NoFieldValue = 0, advanced = false): GameView {
  const game = createGame('PLANETOLOGISTNOFIELDGATHERCONTROLS', newPlayer('r', 'Richese', 'richese'), advanced, ['choam']);
  joinGame(game, newPlayer('a', 'Atreides', 'atreides'));
  const view = viewGame(game, 'r');
  view.status = 'playing'; view.phase = 5; view.turn = 2; view.storm = 18; view.active = 'r';
  view.order = ['r', 'a']; view.movementRemaining = ['r', 'a'];
  const me = view.players[0];
  me.moved = 0; me.movesAllowed = 1; me.shipped = true;
  me.forces = { [companionSource]: 2, [secondSource]: 3, [thirdSource]: 1 };
  const tokens = createRicheseNoField(['gather-zero', 'gather-three', 'gather-five']);
  const marker = deployRicheseNoField(tokens, {
    tokenId: tokens.tokens.find(token => token.value === value)!.id,
    controller: me.id, location: splitLocation(markerSource),
  });
  const publicMarker = projectRicheseNoField(marker, false);
  me.noField = publicMarker;
  view.richeseNoField = {
    owner: me.id, event: 'controlled-current-gather-event', public: publicMarker, private: marker,
  } as NonNullable<GameView['richeseNoField']>;
  view.leaderSkills = {
    assignments: [{ owner: me.id, controller: me.id, leader: me.leaders[0].id,
      skill: 'planetologist', captured: false, faceUp: true }],
    offer: null, eligibleLeaders: [], battleChoice: null,
  };
  return view;
}
function propsFor(game: GameView, forces: Record<string, number> = { [secondSource]: 1 }): PlanetologistMovementActionProps {
  return { game, mode: 'gather', destination: 'polar_sink', sector: 0, forces, elites: {},
    includeNoField: true, busy: false, reasonId: 'controlled-gather-reason', act() {} };
}
function markup(game: GameView, busy = false) {
  return renderToStaticMarkup(createElement(PlanetologistMovement, { game, destination: 'polar_sink', sector: 0, busy, act() {} }));
}
function button(html: string) {
  const found = html.match(/<button\b(?=[^>]*data-testid="planetologist-move")[^>]*>[\s\S]*?<\/button>/)?.[0];
  assert.ok(found); return found;
}
function click(props: PlanetologistMovementActionProps): Action[] {
  const actions: Action[] = [];
  PlanetologistMovementAction({ ...props, act(action) { actions.push(action); } }).props.onClick();
  return actions;
}
function expected(game: GameView, forces: Record<string, number>): Action {
  return { type: 'move', planetologist: 'gather', forces,
    noField: game.richeseNoField!.private!.deployed!.tokenId, event: game.richeseNoField!.event,
    territory: 'polar_sink', sector: 0 };
}

void test('owned marker controls explain the provisional two-origin gather and ordinary range without hiding the checkbox', () => {
  for (const value of [0, 3, 5] as const) {
    const game = projected(value), before = structuredClone(game);
    const html = markup(game);
    const checkbox = html.match(/<input\b[^>]*type="checkbox"[^>]*>/)?.[0];
    assert.ok(checkbox); assert.doesNotMatch(checkbox, /\sdisabled=/);
    assert.match(html, /Include your concealed No-Field from Wind Pass, sector 14/);
    assert.match(html, /aria-label="Provisional Planetologist No-Field gather"/);
    assert.match(html, /Provisional gather composition: the concealed marker supplies one of exactly two origin territories/);
    assert.match(html, /alone or with physical forces there/);
    assert.match(html, /Select physical forces from one other territory/);
    assert.match(html, /Every origin uses its normal range; gather adds no extra range/);
    assert.match(html, /Its value stays concealed/);
    assert.doesNotMatch(html, /gather-zero|gather-three|gather-five|cannot join gather|Confirm|Acknowledge/);
    assert.deepEqual(game, before);
  }
});

void test('actual gather callbacks accept a marker-only first origin and exact second-origin physical forces including concealed zero', () => {
  for (const advanced of [false, true]) for (const value of [0, 3, 5] as const) {
    const game = projected(value, advanced), before = structuredClone(game);
    assert.equal(game.players[0].forces[markerSource], undefined);
    const forces = { [secondSource]: 2 };
    const draft = planetologistMoveDraft(game, 'gather', 'polar_sink', 0, forces, {}, true);
    assert.equal(draft.blocked, null);
    assert.deepEqual(draft.action, expected(game, forces));
    assert.deepEqual(click(propsFor(game, forces)), [expected(game, forces)]);
    assert.deepEqual(Object.keys(click(propsFor(game, forces))[0]).sort(), ['event', 'forces', 'noField', 'planetologist', 'sector', 'territory', 'type']);
    assert.deepEqual(game, before);
  }
});

void test('same-territory physical companions stay in the marker origin while the second physical origin remains exact', () => {
  const game = projected(5), before = structuredClone(game);
  const forces = { [companionSource]: 2, [secondSource]: 3 };
  assert.deepEqual(click(propsFor(game, forces)), [expected(game, forces)]);
  const withZeroThird = { ...forces, [thirdSource]: 0 };
  assert.deepEqual(click(propsFor(game, withZeroThird)), [expected(game, forces)]);
  const physicalOnly = planetologistMoveDraft(game, 'gather', 'polar_sink', 0, forces, {});
  assert.equal(physicalOnly.blocked, null);
  assert.deepEqual(physicalOnly.action, { type: 'move', planetologist: 'gather', forces, territory: 'polar_sink', sector: 0 });
  assert.deepEqual(click({ ...propsFor(game, forces), includeNoField: false }), [physicalOnly.action]);
  assert.deepEqual(game, before);
});

void test('changing movement modes can retain the same selected marker without altering its event or source', () => {
  const game = projected(), before = structuredClone(game);
  const range = { ...propsFor(game, { [companionSource]: 1 }), mode: 'range' as const };
  const first = click(range);
  assert.equal(first.length, 1);
  const gather = click({ ...range, mode: 'gather', forces: { [companionSource]: 1, [secondSource]: 1 } });
  assert.deepEqual(gather, [expected(game, { [companionSource]: 1, [secondSource]: 1 })]);
  assert.deepEqual(click(range), first);
  assert.equal(gather[0].noField, first[0].noField);
  assert.equal(gather[0].event, first[0].event);
  assert.deepEqual(game, before);
});

void test('gather requires exactly two territories including the marker and rejects missing or third origins', () => {
  const game = projected();
  const invalid: Record<string, number>[] = [{}, { [companionSource]: 1 }, { [secondSource]: 0 },
    { [secondSource]: 1, [thirdSource]: 1 }, { [companionSource]: 1, [secondSource]: 1, [thirdSource]: 1 }];
  for (const forces of invalid) {
    const draft = planetologistMoveDraft(game, 'gather', 'polar_sink', 0, forces, {}, true);
    assert.equal(draft.action, null);
    assert.match(draft.blocked!, /exactly two different territories/);
    assert.deepEqual(click(propsFor(game, forces)), []);
  }
});

void test('each origin keeps ordinary range and a distance-two marker receives no gather range bonus', () => {
  const game = projected(), me = game.players[0];
  for (const source of [markerSource, secondSource]) {
    assert.equal(groundMoveRouteDistance(game, me, source, 'polar_sink:0'), 1);
    assert.equal(botGroundMoveAllowed(game, me, source, 'polar_sink:0', 0, 'gather'), true);
  }
  assert.equal(groundMoveRouteDistance(game, me, thirdSource, 'polar_sink:0'), 2);
  assert.equal(botGroundMoveAllowed(game, me, thirdSource, 'polar_sink:0', 0, 'range'), true);
  assert.equal(botGroundMoveAllowed(game, me, thirdSource, 'polar_sink:0', 0, 'gather'), false);
  assert.deepEqual(click(propsFor(game, { [thirdSource]: 1 })), []);
  game.richeseNoField!.private!.deployed!.location = splitLocation(thirdSource);
  game.richeseNoField!.public.deployed!.location = splitLocation(thirdSource);
  const gather = planetologistMoveDraft(game, 'gather', 'polar_sink', 0, { [secondSource]: 1 }, {}, true);
  assert.match(gather.blocked!, /normal range/);
  assert.deepEqual(click(propsFor(game)), []);
  assert.equal(click({ ...propsFor(game, {}), mode: 'range' }).length, 1);
});

void test('whole available force counts exact locations and selected elite counts guard gather submission', () => {
  const game = projected();
  const invalid: unknown[] = [null, undefined, [], { [secondSource]: -1 }, { [secondSource]: 0.5 },
    { [secondSource]: Number.NaN }, { [secondSource]: Infinity }, { [secondSource]: '1' }, { [secondSource]: 4 },
    { 'wind_pass_north:17:extra': 1 }, { 'wind_pass_north:16': 1 }, { 'homeworld:richese': 1 }];
  for (const forces of invalid)
    assert.deepEqual(click({ ...propsFor(game), forces: forces as Record<string, number> }), []);
  assert.deepEqual(click({ ...propsFor(game), elites: { [secondSource]: 1 } }), []);
  for (const sector of [-1, 1, 0.5, Number.NaN])
    assert.deepEqual(click({ ...propsFor(game), sector }), []);
  const storm = projected(); storm.storm = 14;
  assert.deepEqual(click(propsFor(storm)), []);
});

void test('empty optional reason cannot bypass phase response automatic ownership or remaining-movement guards', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.phase = 6; },
    game => { game.active = 'a'; },
    game => { game.response = {} as NonNullable<GameView['response']>; },
    game => { game.decision = { kind: 'mobileStronghold', player: 'a', placement: false }; },
    game => { game.phaseOpening = { passed: [] }; },
    game => { game.truthtrance = {} as NonNullable<GameView['truthtrance']>; },
    game => { game.automaticContinuationPending = true; },
    game => { game.players[0].autopilot = 'Easy'; },
    game => { game.players[0].moved = 1; },
    game => { game.ornithopter = { active: { event: 'controlled-flight' } } as NonNullable<GameView['ornithopter']>; },
  ];
  for (const change of changes) {
    const game = projected(); change(game);
    const props = { ...propsFor(game), unavailableReason: '' };
    const draft = planetologistMoveDraft(game, props.mode, props.destination, props.sector, props.forces, props.elites, true);
    assert.ok(planetologistMovementBlocked(game, draft, ''));
    assert.deepEqual(click(props), []);
    assert.match(button(renderToStaticMarkup(createElement(PlanetologistMovementAction, props))), /\sdisabled=/);
  }
  const game = projected();
  assert.deepEqual(click({ ...propsFor(game), unavailableReason: '' }), [expected(game, { [secondSource]: 1 })]);
  assert.deepEqual(click({ ...propsFor(game), busy: true }), []);
  assert.deepEqual(click({ ...propsFor(game), unavailableReason: 'Complete the promised shipment before moving.' }), []);
});

void test('current trainer and owned current marker remain required for gather', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.leaderSkills = null; },
    game => { game.players[0].leaders[0].dead = true; },
    game => { game.players[0].leaders[0].capturedBy = 'a'; },
    game => { game.leaderSkills!.assignments[0].controller = 'a'; },
    game => { game.richeseNoField!.private = null; },
    game => { game.richeseNoField!.owner = 'a'; },
    game => { game.richeseNoField!.private!.deployed!.controller = 'a'; },
    game => { game.richeseNoField!.private!.lastShipped = 'stale-token'; },
    game => { game.me = 'a'; },
  ];
  for (const change of changes) {
    const game = projected(); change(game);
    assert.deepEqual(click(propsFor(game)), []);
  }
});

void test('stale marker events sources trainers and current force availability guard the already-rendered callback', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.richeseNoField!.event = 'new-gather-event'; },
    game => {
      game.richeseNoField!.private!.deployed!.tokenId = 'gather-three';
      game.richeseNoField!.private!.lastShipped = 'gather-three';
    },
    game => {
      game.richeseNoField!.private!.deployed!.location = splitLocation(companionSource);
      game.richeseNoField!.public.deployed!.location = splitLocation(companionSource);
    },
    game => { game.players[0].leaders[0].dead = true; },
    game => { game.players[0].forces[secondSource] = 0; },
    game => { game.automaticContinuationPending = true; },
  ];
  for (const change of changes) {
    const game = projected(), actions: Action[] = [];
    const leaf = PlanetologistMovementAction({ ...propsFor(game), act(action) { actions.push(action); } });
    assert.equal(leaf.props.disabled, false);
    change(game); leaf.props.onClick();
    assert.deepEqual(actions, []);
  }
});

void test('Homeworld marker movement denial remains independent of ordinary physical gather', () => {
  const game = projected(), reason = 'The occupied Homeworld currently prevents No-Field movement.';
  game.homeworldMobility.noFieldMovementBlocked = reason;
  const draft = planetologistMoveDraft(game, 'gather', 'polar_sink', 0, { [secondSource]: 1 }, {}, true);
  assert.equal(draft.blocked, reason);
  assert.deepEqual(click(propsFor(game)), []);
  const forces = { [companionSource]: 1, [secondSource]: 1 };
  assert.deepEqual(click({ ...propsFor(game, forces), includeNoField: false }), [
    { type: 'move', planetologist: 'gather', forces, territory: 'polar_sink', sector: 0 },
  ]);
});

void test('gather controls never inspect denominations rival hands raw token events or reserve counts', () => {
  const game = projected();
  for (const token of game.richeseNoField!.private!.tokens)
    Object.defineProperty(token, 'value', { get() { throw Error('Gather read a concealed denomination'); } });
  for (const player of game.players) for (const field of ['hand', 'traitors', 'faceDancers', 'spice', 'reserves', 'noFieldEvent'])
    Object.defineProperty(player, field, { get() { throw Error(`Gather read unrelated ${player.id}.${field}`); } });
  assert.match(markup(game), /Provisional Planetologist No-Field gather/);
  assert.deepEqual(click(propsFor(game)), [expected(game, { [secondSource]: 1 })]);
  const rival = projected(); rival.richeseNoField!.owner = 'a';
  Object.defineProperty(rival.richeseNoField!, 'private', { get() { throw Error('Gather read a foreign token identity'); } });
  assert.deepEqual(click(propsFor(rival)), []);
});
