import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlanetologistMovement, planetologistMoveDraft } from '../components/planetologist-movement';
import { PlanetologistMovementAction, planetologistNoFieldMarker, type PlanetologistMovementActionProps } from '../components/planetologist-movement-action';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import { botGroundMoveAllowed, groundMoveRouteDistance } from '../game/bot-mobility';
import { gameTerritories, location, splitLocation } from '../game/board';
import { createRicheseNoField, deployRicheseNoField, projectRicheseNoField, type NoFieldValue } from '../game/richese-no-field';

const source = 'false_wall_west:16';
const sameOrigin = 'false_wall_west:17';
const destination = 'polar_sink';

// Controlled personalized projections supplement the independent native trained
// Richese source. No skill, token, army or pending receipt is installed in an
// authoritative Game. React renders the stateful parent; only the hook-free
// actual submit leaf is invoked directly.
function projected(value: NoFieldValue = 0, physical = false, advanced = false): GameView {
  const game = createGame('PLANETOLOGISTNOFIELDCONTROLS', newPlayer('r', 'Richese', 'richese'), advanced, ['choam']);
  joinGame(game, newPlayer('a', 'Atreides', 'atreides'));
  const view = viewGame(game, 'r');
  view.status = 'playing'; view.phase = 5; view.turn = 2; view.storm = 18; view.active = 'r';
  view.order = ['r', 'a']; view.movementRemaining = ['r', 'a'];
  const me = view.players.find(player => player.id === 'r')!;
  me.moved = 0; me.movesAllowed = 1; me.shipped = true;
  me.forces = physical ? { [source]: 2, [sameOrigin]: 2 } : {};
  const tokens = createRicheseNoField(['controlled-zero', 'controlled-three', 'controlled-five']);
  const marker = deployRicheseNoField(tokens, {
    tokenId: tokens.tokens.find(token => token.value === value)!.id,
    controller: me.id, location: splitLocation(source),
  });
  const publicMarker = projectRicheseNoField(marker, false);
  me.noField = publicMarker;
  view.richeseNoField = {
    owner: me.id, event: 'controlled-current-no-field-event', public: publicMarker, private: marker,
  } as NonNullable<GameView['richeseNoField']>;
  view.leaderSkills = {
    assignments: [{ owner: me.id, controller: me.id, leader: me.leaders[0].id,
      skill: 'planetologist', captured: false, faceUp: true }],
    offer: null, eligibleLeaders: [], battleChoice: null,
  };
  return view;
}
function propsFor(game: GameView, forces: Record<string, number> = {}): PlanetologistMovementActionProps {
  return { game, mode: 'range', destination, sector: 0, forces, elites: {}, includeNoField: true,
    busy: false, reasonId: 'controlled-planetologist-reason', act() {} };
}
function markup(game: GameView, busy = false) {
  return renderToStaticMarkup(createElement(PlanetologistMovement, { game, destination, sector: 0, busy, act() {} }));
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
function expected(game: GameView, forces: Record<string, number> = {}): Action {
  return { type: 'move', planetologist: 'range', forces,
    noField: game.richeseNoField!.private!.deployed!.tokenId, event: game.richeseNoField!.event,
    territory: destination, sector: 0 };
}

void test('the owned marker has a usable checkbox origin and persistent provisional one-force range guidance', () => {
  for (const advanced of [false, true]) {
    const game = projected(0, false, advanced), before = structuredClone(game);
    for (let render = 0; render < 3; render++) {
      const html = markup(game);
      assert.match(html, /<input\b[^>]*type="checkbox"/);
      assert.match(html, /Include your concealed No-Field from False Wall West, sector 16/);
      assert.match(html, /aria-label="Provisional Planetologist No-Field range"/);
      assert.match(html, /concealed marker moves as one force with Planetologist’s extra range, up to three territories/);
      assert.match(html, /Move it alone or with physical forces from its own territory/);
      assert.match(html, /value stays concealed/);
      assert.match(html, /No direct joint FAQ settles this combination/);
      assert.match(html, /No physical board forces are available to move/);
      assert.match(html, /Only one flight source may be used for each movement/);
      assert.doesNotMatch(html, /controlled-zero|controlled-three|controlled-five|Confirm|Acknowledge|countdown/);
    }
    assert.deepEqual(game, before);
  }
});

void test('marker-only extra range emits the exact existing callback payload and keeps every hidden value concealed', () => {
  for (const value of [0, 3, 5] as const) {
    const game = projected(value), before = structuredClone(game), me = game.players[0];
    assert.equal(groundMoveRouteDistance(game, me, source, 'polar_sink:0'), 2);
    assert.equal(botGroundMoveAllowed(game, me, source, 'polar_sink:0', 0), false);
    assert.equal(botGroundMoveAllowed(game, me, source, 'polar_sink:0', 0, 'range'), true);
    const draft = planetologistMoveDraft(game, 'range', destination, 0, {}, {}, true);
    assert.equal(draft.blocked, null);
    assert.deepEqual(draft.action, expected(game));
    assert.deepEqual(click(propsFor(game)), [expected(game)]);
    assert.deepEqual(Object.keys(click(propsFor(game))[0]).sort(), ['event', 'forces', 'noField', 'planetologist', 'sector', 'territory', 'type']);
    assert.deepEqual(game, before);
    assert.equal(game.richeseNoField!.private!.deployed!.tokenId, before.richeseNoField!.private!.deployed!.tokenId);
  }
});

void test('positive physical groups share the marker territory and preserve exact same-origin sector counts', () => {
  const game = projected(5, true), before = structuredClone(game);
  const selections: Record<string, number>[] = [{ [source]: 1 }, { [sameOrigin]: 2 }, { [source]: 2, [sameOrigin]: 1 }];
  for (const forces of selections) {
    const draft = planetologistMoveDraft(game, 'range', destination, 0, forces, {}, true);
    assert.equal(draft.blocked, null);
    assert.deepEqual(draft.action, expected(game, forces));
    assert.deepEqual(click(propsFor(game, forces)), [expected(game, forces)]);
  }
  const html = markup(game);
  assert.match(html, /False Wall West, sector 16 · 2 forces/);
  assert.match(html, /False Wall West, sector 17 · 2 forces/);
  assert.deepEqual(game, before);
});

void test('the existing six-argument draft keeps physical movement separate from optional marker selection', () => {
  const game = projected(0, true);
  const action = { type: 'move', planetologist: 'range', forces: { [source]: 2 }, territory: destination, sector: 0 };
  assert.deepEqual(planetologistMoveDraft(game, 'range', destination, 0, { [source]: 2 }, {}).action, action);
  assert.deepEqual(click({ ...propsFor(game, { [source]: 2 }), includeNoField: false }), [action]);
  assert.equal(planetologistMoveDraft(game, 'range', destination, 0, {}, {}).action, null);
  assert.deepEqual(click({ ...propsFor(game), includeNoField: false }), []);
});

void test('marker gather requires two origins and ordinary range while extra range excludes a second territory', () => {
  const game = projected(0, true);
  game.players[0].forces['wind_pass:14'] = 2;
  for (const props of [
    { ...propsFor(game), mode: 'gather' as const },
    { ...propsFor(game, { [source]: 1, 'wind_pass:14': 1 }), mode: 'gather' as const },
    propsFor(game, { 'wind_pass:14': 1 }),
    propsFor(game, { [source]: 1, 'wind_pass:14': 1 }),
  ]) {
    assert.deepEqual(click(props), []);
    assert.match(button(renderToStaticMarkup(createElement(PlanetologistMovementAction, props))), /\sdisabled=/);
  }
  assert.match(planetologistMoveDraft(game, 'gather', destination, 0, {}, {}, true).blocked!, /exactly two different territories/);
});

void test('exact source and destination sectors and valid whole available counts guard actual submission', () => {
  const game = projected(0, true);
  const invalid: unknown[] = [null, undefined, [], { [source]: -1 }, { [source]: 0.5 }, { [source]: Number.NaN },
    { [source]: Infinity }, { [source]: Number.MAX_SAFE_INTEGER + 1 }, { [source]: '1' }, { [source]: 3 },
    { 'false_wall_west:16:extra': 1 }, { 'false_wall_west:15': 1 }, { 'homeworld:richese': 1 }];
  for (const forces of invalid)
    assert.deepEqual(click({ ...propsFor(game), forces: forces as Record<string, number> }), []);
  for (const sector of [-1, 1, 0.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    assert.deepEqual(click({ ...propsFor(game), sector }), []);
  for (const invalidDestination of ['unknown', 'homeworld:richese', 'hidden_mobile_stronghold'])
    assert.deepEqual(click({ ...propsFor(game), destination: invalidDestination, sector: 0 }), []);
});

void test('unreachable and storm-blocked routes remain unavailable with the boosted marker range', () => {
  const game = projected();
  const distant = gameTerritories(game).flatMap(place => place.sectors.map(sector => location(place.id, sector)))
    .find(target => Number.isFinite(groundMoveRouteDistance(game, game.players[0], source, target)) &&
      groundMoveRouteDistance(game, game.players[0], source, target) > 2);
  assert.ok(distant, 'The controlled board has a destination beyond extra range');
  assert.deepEqual(click({ ...propsFor(game), ...splitLocation(distant) }), []);
  const storm = projected(); storm.storm = 16;
  assert.deepEqual(click(propsFor(storm)), []);
  const stormDestination = projected(); stormDestination.storm = 14;
  assert.deepEqual(click({ ...propsFor(stormDestination), destination: 'wind_pass', sector: 14 }), []);
});

void test('the current Homeworld marker movement refusal remains authoritative without blocking physical-only movement', () => {
  const game = projected(0, true), reason = 'The occupied Homeworld currently prevents No-Field movement.';
  game.homeworldMobility.noFieldMovementBlocked = reason;
  const html = markup(game);
  assert.ok(html.includes(reason));
  assert.match(html, /<input\b[^>]*type="checkbox"[^>]*disabled=/);
  assert.deepEqual(click(propsFor(game)), []);
  assert.deepEqual(click({ ...propsFor(game, { [source]: 1 }), includeNoField: false }), [
    { type: 'move', planetologist: 'range', forces: { [source]: 1 }, territory: destination, sector: 0 },
  ]);
});

void test('foreign missing stale and malformed marker projections cannot select a private identity', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.richeseNoField = null; },
    game => { game.richeseNoField!.private = null; },
    game => { game.richeseNoField!.owner = 'a'; },
    game => { game.richeseNoField!.private!.deployed = null; },
    game => { game.richeseNoField!.private!.deployed!.controller = 'a'; },
    game => { game.richeseNoField!.private!.lastShipped = 'stale-token'; },
    game => { game.richeseNoField!.private!.tokens = []; },
    game => { game.richeseNoField!.event = ''; },
    game => { game.richeseNoField!.public.deployed!.location = { territory: 'wind_pass', sector: 14 }; },
    game => { game.richeseNoField!.private!.deployed!.location = { territory: 'false_wall_west', sector: 15 }; },
  ];
  for (const change of changes) {
    const game = projected(); change(game);
    assert.equal(planetologistNoFieldMarker(game), null);
    assert.deepEqual(click(propsFor(game)), []);
    assert.doesNotMatch(markup(game), /type="checkbox"|Provisional Planetologist No-Field range/);
  }
});

void test('busy phase ownership current responses automatic action and movement allowance guard the real callback', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.status = 'lobby'; },
    game => { game.phase = 6; },
    game => { game.active = 'a'; },
    game => { game.players[0].moved = 1; },
    game => { game.players[0].movesAllowed = 0; },
    game => { game.players[0].autopilot = 'Easy'; },
    game => { game.automaticContinuationPending = true; },
    game => { game.response = {} as NonNullable<GameView['response']>; },
    game => { game.decision = { kind: 'mobileStronghold', player: 'a', placement: false }; },
    game => { game.phaseOpening = { passed: [] }; },
    game => { game.truthtrance = {} as NonNullable<GameView['truthtrance']>; },
    game => { game.nexusTraitors = {
      offer: null, pending: {} as NonNullable<NonNullable<GameView['nexusTraitors']>['pending']>,
    }; },
    game => { game.ornithopter = { active: { event: 'controlled-flight' } } as NonNullable<GameView['ornithopter']>; },
  ];
  for (const change of changes) {
    const game = projected(); change(game);
    assert.deepEqual(click(propsFor(game)), []);
    assert.match(button(renderToStaticMarkup(createElement(PlanetologistMovementAction, propsFor(game)))), /\sdisabled=/);
  }
  const game = projected();
  assert.deepEqual(click({ ...propsFor(game), busy: true }), []);
  assert.deepEqual(click({ ...propsFor(game), unavailableReason: 'Complete the promised shipment before moving.' }), []);
  assert.match(button(markup(game, true)), /\sdisabled=/);
});

void test('missing dead captured or foreign-skilled leaders cannot submit or expose marker controls', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.leaderSkills = null; },
    game => { game.leaderSkills!.assignments[0].owner = 'a'; },
    game => { game.players[0].leaders[0].dead = true; },
    game => { game.players[0].leaders[0].capturedBy = 'a'; },
    game => { game.leaderSkills!.assignments[0].controller = 'a'; },
    game => { game.leaderSkills!.assignments[0].faceUp = false; },
    game => { game.me = 'a'; },
  ];
  for (const change of changes) {
    const game = projected(); change(game);
    assert.equal(markup(game), '');
    assert.deepEqual(click(propsFor(game)), []);
  }
});

void test('a callback from an old marker event location or response never sends a newly substituted selection', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.richeseNoField!.event = 'new-event'; },
    game => {
      game.richeseNoField!.private!.deployed!.tokenId = 'controlled-three';
      game.richeseNoField!.private!.lastShipped = 'controlled-three';
    },
    game => {
      game.richeseNoField!.private!.deployed!.location = { territory: 'false_wall_west', sector: 17 };
      game.richeseNoField!.public.deployed!.location = { territory: 'false_wall_west', sector: 17 };
    },
    game => { game.decision = { kind: 'mobileStronghold', player: 'a', placement: false }; },
    game => { game.players[0].moved = 1; },
  ];
  for (const change of changes) {
    const game = projected(), actions: Action[] = [];
    const leaf = PlanetologistMovementAction({ ...propsFor(game), act(action) { actions.push(action); } });
    assert.equal(leaf.props.disabled, false);
    change(game); leaf.props.onClick();
    assert.deepEqual(actions, []);
  }
});

void test('owner controls and actual submissions never inspect hidden denomination or rival inventories', () => {
  const game = projected();
  for (const token of game.richeseNoField!.private!.tokens)
    Object.defineProperty(token, 'value', { get() { throw Error('Movement read a concealed denomination'); } });
  for (const player of game.players) for (const field of ['hand', 'traitors', 'faceDancers', 'spice', 'reserves'])
    Object.defineProperty(player, field, { get() { throw Error(`Movement read unrelated private ${player.id}.${field}`); } });
  Object.defineProperty(game.players[0], 'noFieldEvent', { get() { throw Error('Movement read raw player custody event'); } });
  const html = markup(game);
  assert.match(html, /Provisional Planetologist No-Field range/);
  assert.deepEqual(click(propsFor(game)), [expected(game)]);
  const rival = projected(); rival.me = 'a';
  Object.defineProperty(rival.richeseNoField!, 'private', { get() { throw Error('Rival read private No-Field identity'); } });
  assert.equal(markup(rival), '');
  assert.deepEqual(click(propsFor(rival)), []);
});
