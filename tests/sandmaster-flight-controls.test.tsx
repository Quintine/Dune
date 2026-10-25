import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SandmasterMovement, sandmasterMoveDraft } from '../components/sandmaster-movement';
import { SandmasterMovementAction, type SandmasterMovementActionProps, type MovementFlight } from '../components/sandmaster-movement-action';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import { planetologistFlightSelection as movementFlightSelection } from '../game/planetologist-flight';
import { gameTerritories, location, splitLocation } from '../game/board';
import { groundMoveRouteDistance } from '../game/bot-mobility';
import { richeseCards } from '../game/richese-cards';
import { createRicheseNoField, deployRicheseNoField, projectRicheseNoField, type NoFieldValue } from '../game/richese-no-field';
import { sandmasterActionOrder, sandmasterDefaultChoice, sandmasterOrderSources, sandmasterRouteDistance } from '../game/sandmaster-movement';

const source = 'false_wall_west:16', otherSource = 'false_wall_west:17';
const destination = 'wind_pass:16', firstPile = 'wind_pass:15', secondPile = 'wind_pass:16';
const ordinary: Action = { type: 'move', forces: { [source]: 2 }, territory: 'wind_pass', sector: 16 };

// Controlled personalized capabilities supplement the independent native flight
// and Richese marker sources. No trainer/card/token/army/receipt is installed in
// an authoritative Game. React renders the stateful route/pile parent; only the
// hook-free actual submit leaf is entered directly.
function projected(richese = false): GameView {
  const sourceGame = createGame('SANDMASTERFLIGHTCONTROLS', newPlayer('p', 'Pilot', richese ? 'richese' : 'emperor'), false, ['choam']);
  joinGame(sourceGame, newPlayer('a', 'Atreides', 'atreides'));
  const game = viewGame(sourceGame, 'p');
  game.status = 'playing'; game.phase = 5; game.turn = 3; game.storm = 18; game.active = 'p';
  game.order = ['p', 'a']; game.movementRemaining = ['p', 'a'];
  const me = game.players[0];
  me.forces = { [source]: 3, [otherSource]: 2 }; me.moved = 0; me.movesAllowed = 1; me.shipped = true;
  game.spice = { [firstPile]: 4, [secondPile]: 3 };
  game.leaderSkills = { offer: null, eligibleLeaders: [], battleChoice: null,
    assignments: [{ skill: 'sandmaster', owner: me.id, controller: me.id, leader: me.leaders[0].id, captured: false, faceUp: true }] };
  const card = richeseCards().find(candidate => candidate.effect === 'ornithopter'); assert.ok(card);
  game.ornithopter = { card, blocked: null, active: null,
    modes: [{ mode: 'range3', blocked: null }, { mode: 'twoGroups', blocked: null }] };
  return game;
}
function carried(game: GameView) {
  game.discoveryEnabled = true;
  game.discoveries = { blocked: null, canInspect: [], canReveal: [], supplyCount: 0, newlyRevealed: [],
    tokens: [{ id: 'discovery-token-1', type: 'smuggler', face: 'ornithopter', status: 'carried',
      territory: 'funeral_plain', sector: 2, revealedTurn: 1, owner: game.me, acquiredTurn: 1 }] };
  game.discoveryOrnithopter = { token: 'discovery-token-1', acquiredTurn: 1, range: 3, blocked: null };
  return game;
}
function active(game: GameView) {
  const card = game.ornithopter!;
  card.active = { event: 'controlled-sandmaster-flight', mode: 'twoGroups', completed: 1, remaining: 1,
    cohort: { forces: { [otherSource]: 1 }, elites: {} } };
  game.playedOrnithopter = { player: game.me, card: card.card, mode: 'twoGroups', completed: 1 };
  game.players[0].moved = 1;
  return game;
}
function marker(game: GameView, value: NoFieldValue) {
  const tokens = createRicheseNoField(['sand-zero', 'sand-three', 'sand-five']);
  const model = deployRicheseNoField(tokens, { tokenId: tokens.tokens.find(token => token.value === value)!.id,
    controller: game.me, location: splitLocation(source) });
  const publicMarker = projectRicheseNoField(model, false);
  game.players[0].noField = publicMarker;
  game.richeseNoField = { owner: game.me, event: 'controlled-sandmaster-marker', public: publicMarker, private: model } as NonNullable<GameView['richeseNoField']>;
  return game;
}
function markerMove(game: GameView, physical = false): Action {
  return { type: 'move', forces: physical ? { [source]: 2 } : {},
    noField: game.richeseNoField!.private!.deployed!.tokenId, event: game.richeseNoField!.event,
    territory: 'wind_pass', sector: 16 };
}
function propsFor(game: GameView, flight?: MovementFlight, move: Action = ordinary): SandmasterMovementActionProps {
  return { game, move, flight, busy: false, reasonId: 'controlled-sandmaster-reason', act() {} };
}
function click(props: SandmasterMovementActionProps): Action[] {
  const actions: Action[] = [];
  SandmasterMovementAction({ ...props, act(action) { actions.push(action); } }).props.onClick();
  return actions;
}
function markup(game: GameView, move: Action = ordinary, busy = false) {
  return renderToStaticMarkup(createElement(SandmasterMovement, { game, move, busy, act() {} }));
}
function targetAtDistance(game: GameView, distance: number) {
  const found = gameTerritories(game).flatMap(place => place.sectors.map(sector => location(place.id, sector)))
    .find(to => groundMoveRouteDistance(game, game.players[0], source, to) === distance);
  assert.ok(found, `A controlled canonical target at distance ${distance} exists`);
  return splitLocation(found);
}

void test('existing four-argument drafts and actual ordinary callbacks preserve the exact move routes and pile choice', () => {
  const game = projected(), before = structuredClone(game);
  const draft = sandmasterMoveDraft(game, ordinary);
  assert.equal(draft.blocked, null);
  assert.deepEqual(draft.choice?.collect, [firstPile]);
  assert.deepEqual(click(propsFor(game)), [draft.action]);
  assert.deepEqual(draft.action, { ...ordinary, sandmaster: draft.choice });
  assert.deepEqual(game, before);
});

void test('actual range3 two-group and Discovery callbacks carry only the offered flight source and original Sandmaster choice', () => {
  for (const flight of ['range3', 'twoGroups', 'discovery'] as const) {
    const game = flight === 'discovery' ? carried(projected()) : projected(), before = structuredClone(game);
    const draft = sandmasterMoveDraft(game, ordinary, undefined, [], flight);
    assert.equal(draft.blocked, null);
    assert.deepEqual(click(propsFor(game, flight)), [{ ...ordinary,
      ...movementFlightSelection(game, flight).fields, sandmaster: draft.choice }]);
    assert.deepEqual(click({ ...propsFor(game, flight), busy: true }), []);
    assert.deepEqual(game, before);
  }
});

void test('fixed three-territory card and Discovery routes retain the cap while ordinary and two-group flight keep normal range', () => {
  const game = projected(), far = targetAtDistance(game, 3), beyond = targetAtDistance(game, 4);
  const farMove = { ...ordinary, ...far };
  for (const flight of ['ordinary', 'twoGroups'] as const) assert.deepEqual(click(propsFor(game, flight, farMove)), []);
  for (const flight of ['range3', 'discovery'] as const) {
    const view = flight === 'discovery' ? carried(projected()) : projected();
    assert.equal(click(propsFor(view, flight, farMove)).length, 1);
    assert.deepEqual(click(propsFor(view, flight, { ...ordinary, ...beyond })), []);
  }
});

void test('the declared connected non-shortest route is submitted unchanged rather than replaced by a shortest route', () => {
  const game = projected(), routes = { [source]: [source, 'wind_pass:17', 'polar_sink:0', destination] };
  const defaults = sandmasterDefaultChoice(game, game.me, { ...ordinary, ...movementFlightSelection(game, 'range3').fields });
  assert.ok(defaults); assert.notDeepEqual(defaults.routes, routes);
  assert.equal(sandmasterRouteDistance(game, routes[source]), 3);
  const actions = click({ ...propsFor(game, 'range3'), routes });
  assert.deepEqual(actions, [{ ...ordinary, ...movementFlightSelection(game, 'range3').fields,
    sandmaster: { routes, collect: [firstPile] } }]);
  assert.deepEqual(click({ ...propsFor(game, 'range3'), routes: { [source]: [source, 'arrakeen:10', destination] } }), []);
});

void test('actual pile choices select one positive sector per entered territory or explicitly decline all peers', () => {
  const game = projected(), routes = { [source]: [source, 'wind_pass:17', destination] };
  for (const [declined, collect] of [[[], [firstPile]], [[firstPile], [secondPile]], [[firstPile, secondPile], []]] as const) {
    assert.deepEqual(click({ ...propsFor(game, 'range3'), routes, declined }), [
      { ...ordinary, ...movementFlightSelection(game, 'range3').fields, sandmaster: { routes, collect: [...collect] } },
    ]);
  }
  const html = markup(game);
  assert.match(html, /Collect 1 spice in Wind Pass, sector 15/);
  assert.match(html, /Collect 1 spice in Wind Pass, sector 16/);
});

void test('active second groups use their current event and remaining original cohort after the ordinary allowance is spent', () => {
  const game = active(projected()), move = { ...ordinary, forces: { [otherSource]: 1 } };
  const draft = sandmasterMoveDraft(game, move);
  assert.equal(draft.blocked, null);
  assert.deepEqual(click(propsFor(game, undefined, move)), [draft.action]);
  assert.equal(draft.action?.ornithopterEvent, 'controlled-sandmaster-flight');
  assert.equal(draft.action?.movementCard, undefined);
  assert.deepEqual(click(propsFor(game, undefined, ordinary)), []);
  assert.deepEqual(click(propsFor(game, 'discovery', move)), []);
  const html = markup(game, move);
  assert.match(html, /1 card movements completed · 1 remaining/);
});

void test('second-group quotas distinguish current physical normal and elite counters from the unmoved cohort', () => {
  const game = active(projected());
  game.players[0].elites = { forces: { [otherSource]: 1 }, reserves: 0, tanks: 0, revived: 0 };
  const move = { ...ordinary, forces: { [otherSource]: 1 }, eliteForces: { [otherSource]: 1 } };
  assert.deepEqual(click(propsFor(game, undefined, move)), []);
  assert.equal(click(propsFor(game, undefined, { ...move, eliteForces: { [otherSource]: 0 } })).length, 1);
  assert.deepEqual(click(propsFor(game, undefined, { ...move, forces: { [otherSource]: 2 } })), []);
});

void test('marker-only zero three and five use one moving source without reading or materializing the denomination', () => {
  for (const value of [0, 3, 5] as const) for (const flight of ['ordinary', 'range3', 'twoGroups', 'discovery'] as const) {
    const game = marker(flight === 'discovery' ? carried(projected(true)) : projected(true), value);
    const move = markerMove(game), before = structuredClone(game);
    const draft = sandmasterMoveDraft(game, move, undefined, [], flight);
    assert.equal(draft.blocked, null);
    assert.deepEqual(Object.keys(draft.choice!.routes), [source]);
    assert.deepEqual(draft.choice!.collect, [firstPile]);
    assert.deepEqual(click(propsFor(game, flight, move)), [draft.action]);
    assert.deepEqual(game, before);
    const html = markup(game, move);
    assert.match(html, /aria-label="Provisional Sandmaster concealed marker"/);
    assert.match(html, /including zero/);
    assert.doesNotMatch(html, /sand-zero|sand-three|sand-five/);
  }
});

void test('a same-sector marker and physical group share one route and collect once for the entered territory', () => {
  const game = marker(projected(true), 5), move = markerMove(game, true);
  const draft = sandmasterMoveDraft(game, move, undefined, [], 'range3');
  const order = sandmasterActionOrder(game, game.me, draft.action!);
  assert.ok(order);
  assert.deepEqual(sandmasterOrderSources(order), [source]);
  assert.deepEqual(Object.keys(draft.choice!.routes), [source]);
  assert.deepEqual(draft.choice!.collect, [firstPile]);
  assert.deepEqual(click(propsFor(game, 'range3', move)), [draft.action]);
  assert.equal((markup(game, move).match(/<legend>False Wall West, sector 16 route<\/legend>/g) ?? []).length, 1);
  const separate = { ...markerMove(game), forces: { [otherSource]: 1 } };
  const twoRoutes = sandmasterMoveDraft(game, separate, undefined, [], 'range3');
  assert.equal(Object.keys(twoRoutes.choice!.routes).length, 2);
  assert.deepEqual(twoRoutes.choice!.collect, [firstPile]);
  assert.deepEqual(click(propsFor(game, 'range3', separate)), [twoRoutes.action]);
});

void test('a marker in the active frame must remain an original unmoved cohort member', () => {
  const game = active(marker(projected(true), 0)), move = markerMove(game);
  assert.deepEqual(click(propsFor(game, undefined, move)), []);
  game.ornithopter!.active!.cohort!.noField = { tokenId: 'sand-zero', event: game.richeseNoField!.event, from: source };
  assert.equal(click(propsFor(game, undefined, move)).length, 1);
  game.ornithopter!.active!.cohort!.noField!.event = 'old-marker-event';
  assert.deepEqual(click(propsFor(game, undefined, move)), []);
});

void test('stale card token active event selected source trainer or selected pile invalidates an already-rendered callback', () => {
  const checks: { flight: MovementFlight; change: (game: GameView) => void }[] = [
    { flight: 'range3', change: game => { game.ornithopter!.card = { ...game.ornithopter!.card, id: 'different-card' }; } },
    { flight: 'discovery', change: game => { game.discoveries!.tokens[0].id = 'discovery-token-2'; game.discoveryOrnithopter!.token = 'discovery-token-2'; } },
    { flight: 'range3', change: game => { game.players[0].forces[source] = 0; } },
    { flight: 'range3', change: game => { game.leaderSkills!.assignments[0].leader = game.players[0].leaders[1].id; } },
    { flight: 'range3', change: game => { game.spice[firstPile] = 2; } },
    { flight: 'range3', change: game => { game.spice[firstPile] = 0; } },
  ];
  for (const { flight, change } of checks) {
    const game = flight === 'discovery' ? carried(projected()) : projected(), actions: Action[] = [];
    const leaf = SandmasterMovementAction({ ...propsFor(game, flight), act(action) { actions.push(action); } });
    assert.equal(leaf.props.disabled, false);
    change(game); leaf.props.onClick(); assert.deepEqual(actions, []);
  }
  const game = active(projected()), actions: Action[] = [];
  const leaf = SandmasterMovementAction({ ...propsFor(game, undefined, { ...ordinary, forces: { [otherSource]: 1 } }), act(action) { actions.push(action); } });
  game.ornithopter!.active!.event = 'changed-flight-event'; leaf.props.onClick(); assert.deepEqual(actions, []);
});

void test('foreign marker ownership current marker event and current token custody guard actual callbacks', () => {
  for (const change of [
    (game: GameView) => { game.richeseNoField!.owner = 'a'; },
    (game: GameView) => { game.richeseNoField!.event = 'new-marker-event'; },
    (game: GameView) => { game.richeseNoField!.private!.deployed = null; },
    (game: GameView) => { game.richeseNoField!.private!.deployed!.controller = 'a'; },
  ]) {
    const game = marker(projected(true), 0), move = markerMove(game); change(game);
    assert.deepEqual(click(propsFor(game, 'range3', move)), []);
  }
  const game = marker(projected(true), 0), actions: Action[] = [];
  const leaf = SandmasterMovementAction({ ...propsFor(game, 'range3', markerMove(game)),
    act(action) { actions.push(action); } });
  assert.equal(leaf.props.disabled, false);
  game.richeseNoField!.event = 'changed-marker-event';
  leaf.props.onClick(); assert.deepEqual(actions, []);
});

void test('empty optional notices cannot bypass current ownership phase response automatic trainer or allowance guards', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.phase = 6; }, game => { game.active = 'a'; },
    game => { game.response = {} as NonNullable<GameView['response']>; },
    game => { game.decision = { kind: 'mobileStronghold', player: 'a', placement: false }; },
    game => { game.truthtrance = {} as NonNullable<GameView['truthtrance']>; },
    game => { game.automaticContinuationPending = true; }, game => { game.players[0].autopilot = 'Easy'; },
    game => { game.players[0].moved = 1; }, game => { game.players[0].leaders[0].dead = true; },
    game => { game.me = 'a'; },
  ];
  for (const change of changes) {
    const game = projected(); change(game);
    assert.deepEqual(click({ ...propsFor(game, 'range3'), unavailableReason: '' }), []);
  }
  const game = projected();
  assert.deepEqual(click({ ...propsFor(game, 'range3'), busy: true }), []);
  assert.deepEqual(click({ ...propsFor(game, 'range3'), unavailableReason: 'Finish the promised shipment first.' }), []);
  assert.deepEqual(click(propsFor(game, 'range3', { ...ordinary, planetologist: 'range' })), []);
});

void test('the form retains all transport choices when the ordinary route is too long and explains provisional exact-route collection', () => {
  const game = carried(projected()), far = { ...ordinary, ...targetAtDistance(game, 3) };
  const html = markup(game, far);
  assert.match(html, /Sandmaster movement/);
  assert.match(html, /Movement transport/);
  for (const choice of ['ordinary', 'range3', 'twoGroups', 'discovery']) assert.match(html, new RegExp(`<option value="${choice}"`));
  assert.match(html, /aria-label="Provisional Sandmaster flight composition"/);
  assert.match(html, /fixed-range card and Discovery flight allow routes up to three territories/);
  assert.match(html, /Each two-group card movement keeps normal range and uses different original forces/);
  assert.match(html, /Only one flight source may be used; Planetologist remains separate/);
  assert.match(markup(projected()), /Provisional multi-pile policy/);
});

void test('marker routes and actual callbacks never read hidden denominations raw marker events or rival private inventories', () => {
  const game = marker(projected(true), 0), move = markerMove(game);
  for (const token of game.richeseNoField!.private!.tokens)
    Object.defineProperty(token, 'value', { get() { throw Error('Sandmaster controls read hidden denomination'); } });
  for (const player of game.players) for (const field of ['hand', 'traitors', 'faceDancers', 'spice', 'reserves', 'noFieldEvent'])
    Object.defineProperty(player, field, { get() { throw Error(`Sandmaster controls read unrelated ${player.id}.${field}`); } });
  assert.equal(click(propsFor(game, 'range3', move)).length, 1);
  assert.match(markup(game, move), /Provisional Sandmaster concealed marker/);
  const rival = marker(projected(true), 3), rivalMove = markerMove(rival); rival.richeseNoField!.owner = 'a';
  Object.defineProperty(rival.richeseNoField!, 'private', { get() { throw Error('Sandmaster controls read foreign marker identity'); } });
  assert.deepEqual(click(propsFor(rival, 'range3', rivalMove)), []);
});
