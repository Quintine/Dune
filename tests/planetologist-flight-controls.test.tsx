import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlanetologistMovement, planetologistMoveDraft } from '../components/planetologist-movement';
import { PlanetologistMovementAction, type PlanetologistMovementActionProps } from '../components/planetologist-movement-action';
import { planetologistFlightSelection, type PlanetologistFlight } from '../game/planetologist-flight';
import { createGame, joinGame, newPlayer, viewGame, type Action, type GameView } from '../game/engine';
import { gameTerritories, location, splitLocation } from '../game/board';
import { groundMoveRouteDistance } from '../game/bot-mobility';
import { richeseCards } from '../game/richese-cards';
import { createRicheseNoField, deployRicheseNoField, projectRicheseNoField } from '../game/richese-no-field';

const near = 'wind_pass:14', other = 'wind_pass_north:17', middle = 'false_wall_west:16';
const target = 'polar_sink:0';

// Controlled owned projections test actual selection/submission callbacks, not
// earned card/token custody or authoritative engine continuation. Independent
// native physical/Discovery sources provide that proof. Stateful UI uses React.
function projected(richese = false): GameView {
  const source = createGame('PLANETOLOGISTFLIGHTCONTROLS', newPlayer('p', 'Pilot', richese ? 'richese' : 'emperor'), false, ['choam']);
  joinGame(source, newPlayer('a', 'Atreides', 'atreides'));
  const game = viewGame(source, 'p');
  game.status = 'playing'; game.phase = 5; game.turn = 3; game.storm = 18; game.active = 'p';
  game.order = ['p', 'a']; game.movementRemaining = ['p', 'a'];
  const me = game.players[0];
  me.forces = { [near]: 2, [other]: 2, [middle]: 2 };
  me.moved = 0; me.movesAllowed = 1; me.shipped = true;
  game.leaderSkills = { offer: null, eligibleLeaders: [], battleChoice: null,
    assignments: [{ skill: 'planetologist', owner: me.id, controller: me.id,
      leader: me.leaders[0].id, captured: false, faceUp: true }] };
  const card = richeseCards().find(candidate => candidate.effect === 'ornithopter'); assert.ok(card);
  game.ornithopter = { card, blocked: null, active: null,
    modes: [{ mode: 'range3', blocked: null }, { mode: 'twoGroups', blocked: null }] };
  return game;
}
function carried(game: GameView) {
  game.discoveries = { blocked: null, canInspect: [], canReveal: [], supplyCount: 0, newlyRevealed: [],
    tokens: [{ id: 'discovery-token-1', type: 'smuggler', face: 'ornithopter', status: 'carried',
      territory: 'funeral_plain', sector: 2, revealedTurn: 1, owner: game.me, acquiredTurn: 1 }],
  } as NonNullable<GameView['discoveries']>;
  game.discoveryOrnithopter = { token: 'discovery-token-1', acquiredTurn: 1, range: 3, blocked: null };
  return game;
}
function active(game: GameView, mode: 'range3' | 'twoGroups' = 'twoGroups') {
  const flight = game.ornithopter!;
  flight.active = { event: 'controlled-active-flight', mode, completed: mode === 'twoGroups' ? 1 : 0, remaining: 1,
    cohort: { forces: { [near]: 1, [other]: 1, [middle]: 1 }, elites: {} } };
  game.playedOrnithopter = { player: game.me, card: flight.card, mode, completed: flight.active.completed };
  game.players[0].moved = mode === 'twoGroups' ? 1 : 0;
  return game;
}
function atDistance(game: GameView, count: number): string {
  const source = gameTerritories(game).flatMap(place => place.sectors.map(sector => location(place.id, sector)))
    .find(from => !['arrakeen', 'carthag', 'false_wall_west'].includes(splitLocation(from).territory) &&
      groundMoveRouteDistance(game, game.players[0], from, target) === count);
  assert.ok(source, `A canonical controlled source at distance ${count} is available`);
  game.players[0].forces[source] = 2;
  return source;
}
function propsFor(game: GameView, flight: PlanetologistFlight = 'range3', forces: Record<string, number> = { [middle]: 1 }): PlanetologistMovementActionProps {
  return { game, mode: 'range', destination: 'polar_sink', sector: 0, forces, elites: {},
    flight, busy: false, act() {} };
}
function click(props: PlanetologistMovementActionProps): Action[] {
  const actions: Action[] = [];
  PlanetologistMovementAction({ ...props, act(action) { actions.push(action); } }).props.onClick();
  return actions;
}
function expected(props: PlanetologistMovementActionProps): Action {
  return { type: 'move', planetologist: props.mode, forces: props.forces,
    ...planetologistFlightSelection(props.game, props.flight).fields, territory: props.destination, sector: props.sector };
}
function markup(game: GameView, busy = false) {
  return renderToStaticMarkup(createElement(PlanetologistMovement, { game, destination: 'polar_sink', sector: 0, busy, act() {} }));
}
function button(props: PlanetologistMovementActionProps) {
  return PlanetologistMovementAction(props);
}

void test('ordinary selection and six/seven-argument drafts retain the original physical action without flight fields', () => {
  const game = projected(), before = structuredClone(game);
  assert.deepEqual(planetologistFlightSelection(game), { fields: {}, blocked: null });
  const ordinary = { type: 'move', planetologist: 'range', forces: { [middle]: 1 }, territory: 'polar_sink', sector: 0 };
  assert.deepEqual(planetologistMoveDraft(game, 'range', 'polar_sink', 0, { [middle]: 1 }, {}).action, ordinary);
  assert.deepEqual(planetologistMoveDraft(game, 'range', 'polar_sink', 0, { [middle]: 1 }, {}, false).action, ordinary);
  assert.deepEqual(click(propsFor(game, 'ordinary')), [ordinary]);
  assert.deepEqual(game, before);
});

void test('first physical selections reuse the offered card and exact printed mode with fixed three only for range3', () => {
  const game = projected();
  assert.deepEqual(planetologistFlightSelection(game, 'range3'), {
    fields: { movementCard: game.ornithopter!.card.id, ornithopter: 'range3' }, rangeOverride: 3, blocked: null,
  });
  assert.deepEqual(planetologistFlightSelection(game, 'twoGroups'), {
    fields: { movementCard: game.ornithopter!.card.id, ornithopter: 'twoGroups' }, blocked: null,
  });
});

void test('Discovery selection reuses the owned carried token and acquisition history without another flight source', () => {
  const game = carried(projected());
  assert.deepEqual(planetologistFlightSelection(game, 'discovery'), {
    fields: { discoveryOrnithopter: 'discovery-token-1' }, rangeOverride: 3, blocked: null,
  });
  const props = propsFor(game, 'discovery');
  assert.deepEqual(click(props), [expected(props)]);
  assert.equal('movementCard' in click(props)[0], false);
  assert.equal('ornithopterEvent' in click(props)[0], false);
});

void test('fixed physical and Discovery flight allow range or two-origin gather with each origin up to three', () => {
  for (const flight of ['range3', 'discovery'] as const) for (const mode of ['range', 'gather'] as const) {
    const game = flight === 'discovery' ? carried(projected()) : projected();
    const far = atDistance(game, 3), before = structuredClone(game);
    const forces = mode === 'range' ? { [far]: 1 } : { [far]: 1, [middle]: 2 };
    const props = { ...propsFor(game, flight, forces), mode };
    assert.equal(planetologistMoveDraft(game, mode, 'polar_sink', 0, forces, {}, false, flight).blocked, null);
    assert.deepEqual(click(props), [expected(props)]);
    assert.equal(button({ ...props, busy: true }).props.disabled, true);
    assert.deepEqual(click({ ...props, busy: true }), []);
    assert.deepEqual(game, before);
  }
});

void test('fixed three cannot become four for either Planetologist alternative or flight source', () => {
  for (const flight of ['range3', 'discovery'] as const) for (const mode of ['range', 'gather'] as const) {
    const game = flight === 'discovery' ? carried(projected()) : projected();
    const distant = atDistance(game, 4);
    const forces = mode === 'range' ? { [distant]: 1 } : { [distant]: 1, [near]: 1 };
    assert.deepEqual(click({ ...propsFor(game, flight, forces), mode }), []);
  }
});

void test('two-group card flight keeps boosted range separate from gather normal range and uses one card movement per gather', () => {
  const game = projected(), far = atDistance(game, 3);
  assert.deepEqual(click(propsFor(game, 'twoGroups')), [expected(propsFor(game, 'twoGroups'))]);
  const gather = { ...propsFor(game, 'twoGroups', { [near]: 1, [other]: 1 }), mode: 'gather' as const };
  assert.deepEqual(click(gather), [expected(gather)]);
  assert.deepEqual(click({ ...gather, forces: { [near]: 1, [middle]: 1 } }), []);
  assert.deepEqual(click(propsFor(game, 'twoGroups', { [far]: 1 })), []);
  assert.equal(gather.game.players[0].moved, 0, 'Quoting/submitting to a collector does not manufacture a card movement');
});

void test('the active own frame resolves ordinary to its exact event and permits remaining card movement after ordinary allowance is spent', () => {
  const game = active(projected()), before = structuredClone(game);
  const quote = planetologistFlightSelection(game);
  assert.deepEqual(quote, { fields: { ornithopterEvent: 'controlled-active-flight' }, cohort: game.ornithopter!.active!.cohort, blocked: null });
  for (const flight of ['ordinary', 'twoGroups'] as const) {
    const props = { ...propsFor(game, flight, { [near]: 1, [other]: 1 }), mode: 'gather' as const };
    assert.equal(button(props).props.disabled, false);
    assert.deepEqual(click(props), [expected(props)]);
    assert.equal('movementCard' in click(props)[0], false);
  }
  assert.deepEqual(click(propsFor(game, 'range3')), []);
  assert.deepEqual(game, before);
  assert.deepEqual(click(propsFor(carried(structuredClone(game)), 'discovery')), []);
});

void test('active cohort validation includes every gathered source and exact original normal/elite quotas', () => {
  const game = active(projected());
  const gather = { ...propsFor(game, 'twoGroups', { [near]: 2, [other]: 1 }), mode: 'gather' as const };
  assert.deepEqual(click(gather), []);
  game.players[0].elites = { forces: { [near]: 1 }, reserves: 0, tanks: 0, revived: 0 };
  const typed = { ...propsFor(game, 'twoGroups', { [near]: 1 }), elites: { [near]: 1 } };
  assert.deepEqual(click(typed), []);
  assert.deepEqual(click({ ...typed, elites: { [near]: 0 } }), [
    { type: 'move', planetologist: 'range', forces: { [near]: 1 }, eliteForces: { [near]: 0 },
      ornithopterEvent: 'controlled-active-flight', territory: 'polar_sink', sector: 0 },
  ]);
  game.ornithopter!.active!.cohort!.elites[near] = 1;
  assert.equal(click(typed).length, 1);
});

void test('the selected concealed zero marker must be an original unmoved member of an active physical cohort', () => {
  const game = active(projected(true));
  const tokens = createRicheseNoField(['flight-zero', 'flight-three', 'flight-five']);
  const model = deployRicheseNoField(tokens, { tokenId: 'flight-zero', controller: game.me, location: splitLocation(near) });
  const publicMarker = projectRicheseNoField(model, false);
  game.players[0].noField = publicMarker;
  game.richeseNoField = { owner: game.me, event: 'controlled-marker-event', public: publicMarker, private: model } as NonNullable<GameView['richeseNoField']>;
  const props = { ...propsFor(game, 'twoGroups', { [other]: 1 }), mode: 'gather' as const, includeNoField: true };
  assert.deepEqual(click(props), []);
  game.ornithopter!.active!.cohort!.noField = { tokenId: 'flight-zero', event: 'controlled-marker-event', from: near };
  const before = structuredClone(game);
  assert.deepEqual(click(props), [{ ...expected(props), noField: 'flight-zero', event: 'controlled-marker-event' }]);
  assert.deepEqual(game, before);
  game.ornithopter!.active!.cohort!.noField!.event = 'old-marker-event';
  assert.deepEqual(click(props), []);
});

void test('malformed completed stale foreign and missing-cohort active frames expose no flight selection', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.playedOrnithopter!.player = 'a'; },
    game => { game.playedOrnithopter!.card = { ...game.ornithopter!.card, id: 'stale-card' }; },
    game => { game.ornithopter!.active!.event = ''; },
    game => { game.ornithopter!.active!.remaining = 0; },
    game => { game.ornithopter!.active!.completed = 0.5; },
    game => { game.ornithopter!.modes = []; },
    game => { delete game.ornithopter!.active!.cohort; },
    game => { game.ornithopter!.active!.cohort!.forces[near] = -1; },
    game => { game.ornithopter!.active!.cohort!.elites[near] = 2; },
  ];
  for (const change of changes) {
    const game = active(projected()); change(game);
    assert.ok(planetologistFlightSelection(game).blocked);
    assert.deepEqual(click(propsFor(game, 'ordinary', { [near]: 1 })), []);
  }
});

void test('first-card mode blocks and current carried-token ownership acquisition and removal remain authoritative', () => {
  const blocked = projected(); blocked.ornithopter!.modes[0].blocked = 'This card mode is unavailable.';
  assert.equal(planetologistFlightSelection(blocked, 'range3').blocked, 'This card mode is unavailable.');
  assert.deepEqual(click(propsFor(blocked)), []);
  blocked.ornithopter = null; assert.ok(planetologistFlightSelection(blocked, 'twoGroups').blocked);
  const changes: ((game: GameView) => void)[] = [
    game => { game.discoveryOrnithopter = null; },
    game => { game.discoveryOrnithopter!.blocked = 'Finish the current response.'; },
    game => { game.discoveries!.tokens[0].owner = 'a'; },
    game => { game.discoveries!.tokens[0].status = 'removed'; },
    game => { game.discoveries!.tokens[0].acquiredTurn = 3; game.discoveryOrnithopter!.acquiredTurn = 3; },
    game => { game.discoveries!.tokens[0].revealedTurn = 2; },
    game => { game.discoveries!.tokens.push({ ...game.discoveries!.tokens[0], id: 'discovery-token-2' }); },
  ];
  for (const change of changes) {
    const game = carried(projected()); change(game);
    assert.ok(planetologistFlightSelection(game, 'discovery').blocked);
    assert.deepEqual(click(propsFor(game, 'discovery')), []);
  }
});

void test('actual callbacks do not silently substitute a newly selected card event or Discovery token', () => {
  for (const flight of ['range3', 'twoGroups', 'discovery'] as const) {
    const game = flight === 'discovery' ? carried(projected()) : flight === 'twoGroups' ? active(projected()) : projected();
    const actions: Action[] = [];
    const props = propsFor(game, flight, { [near]: 1 });
    const leaf = PlanetologistMovementAction({ ...props, act(action) { actions.push(action); } });
    assert.equal(leaf.props.disabled, false);
    if (flight === 'range3') game.ornithopter!.card = { ...game.ornithopter!.card, id: 'another-card' };
    else if (flight === 'twoGroups') game.ornithopter!.active!.event = 'new-flight-event';
    else {
      game.discoveries!.tokens[0].id = 'discovery-token-2';
      game.discoveryOrnithopter!.token = 'discovery-token-2';
    }
    leaf.props.onClick(); assert.deepEqual(actions, []);
  }
});

void test('current phase response automatic player allowance and trainer guards still protect every actual flight callback', () => {
  const changes: ((game: GameView) => void)[] = [
    game => { game.phase = 6; }, game => { game.active = 'a'; },
    game => { game.response = {} as NonNullable<GameView['response']>; },
    game => { game.automaticContinuationPending = true; }, game => { game.players[0].autopilot = 'Easy'; },
    game => { game.players[0].moved = 1; }, game => { game.players[0].leaders[0].dead = true; },
  ];
  for (const flight of ['range3', 'twoGroups', 'discovery'] as const) for (const change of changes) {
    const game = flight === 'discovery' ? carried(projected()) : projected(); change(game);
    const props = { ...propsFor(game, flight), unavailableReason: '' };
    assert.deepEqual(click(props), []);
    assert.equal(button(props).props.disabled, true);
  }
});

void test('the parent exposes all transport choices persistent provisional counting and original second-movement controls', () => {
  const game = carried(projected());
  const html = markup(game);
  for (const value of ['ordinary', 'range3', 'twoGroups', 'discovery']) assert.match(html, new RegExp(`<option value="${value}"`));
  assert.match(html, /Movement transport/);
  assert.match(html, /aria-label="Provisional Planetologist flight composition"/);
  assert.match(html, /fixed-range Ornithopter and Discovery flight stay at three territories for either skill choice/);
  assert.match(html, /A gather counts as one card movement/);
  assert.match(html, /different original forces/);
  const second = markup(active(projected()));
  assert.match(second, /1 card movements completed · 1 remaining/);
  assert.match(second, /Select original unmoved forces below/);
  assert.match(second, /Wind Pass, sector 14 · 1 forces/);
  assert.doesNotMatch(second, /Wind Pass, sector 14 · 2 forces/);
});

void test('selection and actual flight callbacks use projected capabilities without private hands reserves or opponent inventories', () => {
  for (const flight of ['range3', 'twoGroups', 'discovery'] as const) {
    const game = flight === 'discovery' ? carried(projected()) : projected();
    for (const player of game.players) for (const field of ['hand', 'traitors', 'faceDancers', 'spice', 'reserves'])
      Object.defineProperty(player, field, { get() { throw Error(`Flight controls read unrelated ${player.id}.${field}`); } });
    const props = propsFor(game, flight);
    assert.deepEqual(click(props), [expected(props)]);
    assert.match(markup(game), /Provisional Planetologist flight composition/);
  }
});
