import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { location, splitLocation } from '../game/board';
import { DIFFICULTIES } from '../game/bot-profiles';
import { botActions } from '../game/bots';
import { discoveryFlightMove } from '../game/discovery-flight-options';
import { quoteDiscoveryFlight, validateDiscoveryFlight } from '../game/discovery-flight';
import {
  quoteSandmasterMovement, sandmasterActionOrder, sandmasterDefaultChoice,
  sandmasterEnteredTerritories, sandmasterLeader, sandmasterRouteDistance,
  validateSandmasterMovement, type SandmasterChoice,
} from '../game/sandmaster-movement';
import {
  actSandmasterDiscoveryFlight as act,
  createSandmasterDiscoveryFlightFixture as fixture,
  finishSandmasterDiscoveryFlight as finish,
  sandmasterDiscoveryFlightInventory as inventory,
  sandmasterDiscoveryFlightPhysical as physical,
  sandmasterDiscoveryFlightPlayer as player,
  type SandmasterDiscoveryFlightFixture as Fixture,
  type SandmasterDiscoveryFlightStep as Step,
} from './fixture-sandmaster-discovery-flight';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function source(f: Fixture) {
  assert.equal(f.initial.status, 'lobby'); assert.equal(f.ready.status, 'lobby'); assert.equal(f.started.status, 'setup');
  assert.equal(f.collection.status, 'playing'); assert.equal(f.collection.turn, 1); assert.equal(f.collection.phase, 7);
  assert.equal(f.game.status, 'playing'); assert.equal(f.game.advanced, f.advanced);
  assert.equal(f.game.turn, 2); assert.equal(f.game.phase, 5); assert.equal(f.game.active, f.actor);
  assert.equal(f.game.phaseOpening ?? null, null); assert.equal(f.game.response ?? null, null); assert.equal(f.game.decision ?? null, null);
  assert.deepEqual(f.game.expansions, []); assert.deepEqual(f.game.players.map(p => p.faction), ['guild', 'emperor', 'harkonnen']);
  assert.ok(f.game.leaderSkills && f.game.discoveryEnabled && f.game.discoveries);
  assert.ok(!f.game.homeworlds && !f.game.nexusCards && !f.game.techTokens && !f.game.strongholdCards && !f.game.ecazTreachery);
  for (const selectedModule of ['leaderSkills', 'discoveries']) assert.ok(f.actions.some(step => step.action.type === 'moduleOption' && step.action.module === selectedModule));
  assert.ok(f.actions.some(step => step.action.type === 'start' && (!f.advanced || step.action.advancedPreview === true)));
  assert.ok(f.actions.some(step => step.actor === f.actor && step.action.type === 'leaderSkill' &&
    step.action.skill === 'sandmaster' && step.action.leader === f.trainer));
  assert.equal(sandmasterLeader(f.game, f.actor), f.trainer);
  assert.equal(f.originalToken.face, 'ornithopter'); assert.equal(f.originalToken.owner, f.actor);
  assert.equal(f.originalToken.status, 'carried'); assert.equal(f.originalToken.acquiredTurn, 1);
  assert.equal(f.originalToken.revealedTurn, 1);
  assert.deepEqual(f.game.discoveries!.tokens.find(token => token.id === f.token), f.originalToken);
  assert.match(viewGame(f.acquired, f.actor).discoveryOrnithopter!.blocked!, /after/);
  assert.equal(viewGame(f.game, f.actor).discoveryOrnithopter!.blocked, null);
  assert.equal(f.beforeBlow.turn, 2); assert.equal(f.beforeBlow.phase, 1); assert.deepEqual(f.beforeBlow.spiceDeck[0], f.blowCard);
  assert.ok(f.game.spiceDiscard.flat().some(card => JSON.stringify(card) === JSON.stringify(f.blowCard)), 'The selected physical Spice Card actually resolved');
  assert.ok(f.game.spice[f.pile] >= f.blowCard.amount, 'The real next-turn blow funds the entered pile');
  assert.equal(f.sourceSpice, f.originalSpice[f.sourcePile] ?? 0);
  assert.equal(player(f.collection, f.actor).forces[f.source], 1);
  assert.equal(f.sourceCount, 2); assert.equal(player(f.game, f.actor).forces[f.source], 2);
  assert.equal(player(f.game, f.actor).forces['tueks_sietch:5'], 5);
  assert.equal(f.shipmentStep.action.type, 'ship'); assert.equal(f.shipmentStep.action.amount, 1);
  assert.equal(player(f.beforeShipment, f.actor).spice - player(f.afterShipment, f.actor).spice, 1);
  assert.equal(player(f.beforeShipment, f.actor).reserves - player(f.afterShipment, f.actor).reserves, 1);
  assert.equal(player(f.game, f.actor).moved, 0); assert.equal(player(f.game, f.actor).shipped, true);
  assert.equal(f.route[0], f.source); assert.equal(f.route.at(-1), f.targetLocation);
  assert.equal(sandmasterRouteDistance(f.game, f.route), 3);
  assert.ok(sandmasterEnteredTerritories(f.routes).includes(splitLocation(f.pile).territory));
  assert.equal(sandmasterEnteredTerritories(f.routes).includes(splitLocation(f.source).territory), false);
  assert.ok(f.choice.collect.includes(f.pile)); assert.equal(f.choice.collect.includes(f.sourcePile), false);
  assert.equal(Object.hasOwn(f.action, 'origins'), false); assert.equal(Object.hasOwn(f.action, 'discoveryFlight'), false);
  assert.equal(f.sourceActionCount, f.actions.length); assert.ok(f.sourceActionCount > 20);
  assert.deepEqual(inventory(f.game), f.originalInventory); assert.equal(f.originalInventory.treachery.length, 33);
  assert.equal(f.originalInventory.skills.length, 14); assert.equal(f.originalInventory.discoveries.length, 8);
}
function moved(f: Fixture, game: Game, action: Action) {
  const before = player(f.game, f.actor), after = player(game, f.actor);
  const forces = action.forces !== undefined ? action.forces as Record<string, number>
    : { [action.from as string]: action.amount as number };
  const expected = { ...before.forces }, destination = location(action.territory as string, action.sector as number);
  for (const [from, amount] of Object.entries(forces)) { expected[from] -= amount; if (!expected[from]) delete expected[from]; }
  expected[destination] = (expected[destination] ?? 0) + Object.values(forces).reduce((sum, amount) => sum + amount, 0);
  const choice = action.sandmaster as SandmasterChoice | undefined, selected = choice?.collect ?? [];
  assert.deepEqual(after.forces, expected); assert.equal(after.moved, before.moved + 1);
  assert.equal(after.shipped, before.shipped); assert.equal(after.reserves, before.reserves); assert.equal(after.tanks, before.tanks);
  assert.equal(after.spice, before.spice + selected.length);
  assert.deepEqual(after.elites, before.elites); assert.deepEqual(after.leaders, before.leaders); assert.deepEqual(after.hand, before.hand);
  assert.deepEqual(game.players.filter(p => p.id !== f.actor), f.game.players.filter(p => p.id !== f.actor));
  const spice = { ...f.originalSpice };
  for (const key of selected) spice[key]--;
  assert.deepEqual(game.spice, spice);
  assert.deepEqual(game.leaderSkills, f.game.leaderSkills); assert.equal(sandmasterLeader(game, f.actor), f.trainer);
  assert.equal(game.discoveries!.tokens.find(token => token.id === f.token)!.status, 'removed');
  assert.equal(game.discoveries!.tokens.find(token => token.id === f.token)!.owner, null);
  assert.equal(game.discoveries!.tokens.find(token => token.id === f.token)!.acquiredTurn, 1);
  assert.equal(viewGame(game, f.actor).discoveryOrnithopter, null);
  assert.deepEqual(game.discoveries!.tokens.filter(token => token.id !== f.token), f.game.discoveries!.tokens.filter(token => token.id !== f.token));
  assert.equal(game.log.slice(f.game.log.length).filter(entry => entry.automatic?.name === 'Sandmaster collection').length, selected.length);
  assert.deepEqual(inventory(game), f.originalInventory);
}

for (const advanced of [false, true]) {
  const band = advanced ? 'Advanced preview' : 'Basic';
  void test(`public ${band} Sandmaster uses one acquired Discovery flight to collect real entered-territory spice at fixed three`, () => {
    const f = fixture({ advanced }); source(f);
    rejected(f.game, f.actor, f.ordinary);
    const view = viewGame(f.game, f.actor), quote = discoveryFlightMove(view, f.ordinary);
    assert.equal(quote.blocked, null); assert.deepEqual(quote.action, f.action);
    assert.deepEqual(sandmasterDefaultChoice(view, f.actor, f.action), f.choice);
    const game = act(f.game, f.actor, f.action); moved(f, game, f.action);
    assert.equal(game.spice[f.sourcePile], f.originalSpice[f.sourcePile], 'The actual source-spice quantity stays unchanged');
    assert.equal(game.spice[f.pile], f.originalSpice[f.pile] - 1);
    rejected(game, f.actor, f.action);
    const actions: Step[] = [], done = finish(f, game, actions);
    assert.equal(done.turn, 2); assert.equal(done.phase, 7); assert.equal(player(done, f.actor).moved, 1);
    assert.equal(player(done, f.actor).forces[f.targetLocation], f.sourceCount);
    assert.equal(done.spice[f.sourcePile], f.originalSpice[f.sourcePile]);
    assert.equal(done.discoveries!.tokens.find(token => token.id === f.token)!.status, 'removed');
    assert.ok(actions.some(step => step.actor === f.actor && step.action.type === 'endMovement'));
    assert.deepEqual(inventory(done), f.originalInventory);
  });

  void test(`public ${band} Sandmaster can decline collection while its original Discovery token still funds exactly one movement`, () => {
    const f = fixture({ advanced }); source(f);
    for (const action of [f.declineAction, f.plainAction]) {
      const game = act(f.game, f.actor, action); moved(f, game, action);
      assert.deepEqual(game.spice, f.originalSpice); assert.equal(player(game, f.actor).spice, player(f.game, f.actor).spice);
      const done = finish(f, game); assert.equal(done.turn, 2); assert.equal(done.phase, 7);
      assert.equal(player(done, f.actor).moved, 1); assert.deepEqual(inventory(done), f.originalInventory);
    }
  });
}

void test('native Sandmaster Discovery declarations reject same-turn, stale token, foreign caller, route and collection errors immutably', () => {
  const f = fixture(); source(f);
  const sameTurn = discoveryFlightMove(viewGame(f.acquired, f.actor), f.action);
  assert.equal(sameTurn.action, null); assert.match(sameTurn.blocked!, /after/);
  rejected(f.acquired, f.actor, f.action); rejected(f.game, f.observer, f.action); rejected(f.game, f.opponent, f.action);
  for (const action of [
    { ...f.action, discoveryOrnithopter: 'discovery-token-99' },
    { ...f.action, amount: f.sourceCount + 1 },
    { ...f.action, sandmaster: { ...f.choice, collect: [...f.choice.collect, f.sourcePile] } },
    { ...f.action, sandmaster: { ...f.choice, collect: [...f.choice.collect, f.pile] } },
    { ...f.action, sandmaster: { ...f.choice, collect: ['not_a_spice_territory:0'] } },
    { ...f.action, sandmaster: { ...f.choice, routes: { [f.source]: [f.source, f.targetLocation] } } },
    { ...f.action, sandmaster: { ...f.choice, routes: {} } },
    { ...f.action, discoveryFlight: { token: f.token } },
    { ...f.action, origins: [splitLocation(f.source).territory] },
  ]) rejected(f.game, f.actor, action);
  assert.deepEqual(physical(f.game), f.originalPhysical); assert.deepEqual(f.game.spice, f.originalSpice);
  assert.deepEqual(f.game.discoveries!.tokens.find(token => token.id === f.token), f.originalToken);
});

void test('controlled native-trainer, live-pile and pending-quote supplements retain the original Discovery-bound Sandmaster order', () => {
  const f = fixture(); source(f); const view = viewGame(f.game, f.actor);
  const order = sandmasterActionOrder(view, f.actor, f.action); assert.ok(order);
  assert.deepEqual(order.flight, { kind: 'discovery', token: f.token, acquiredTurn: 1 });
  const receipt = quoteSandmasterMovement(f.game, f.actor, order, f.choice);
  validateSandmasterMovement(f.game, f.actor, order, receipt);
  // CONTROLLED helper supplements: the positive empty-rock chronology has no
  // native opposing response. These do not claim a played death, capture,
  // pile debit or pending engine frame in that chronology.
  const changedPile = structuredClone(f.game); changedPile.spice[f.pile]--;
  assert.throws(() => validateSandmasterMovement(changedPile, f.actor, order, receipt));
  // CONTROLLED positive-source exclusion only: the native source may be empty.
  // This does not claim that another native Spice blow or Collection left spice.
  const positiveSource = structuredClone(f.game);
  positiveSource.spice[f.sourcePile] = (positiveSource.spice[f.sourcePile] ?? 0) + 1;
  rejected(positiveSource, f.actor, { ...f.action,
    sandmaster: { ...f.choice, collect: [...f.choice.collect, f.sourcePile] } });
  const changedOrder = structuredClone(order); changedOrder.group[0][1]--;
  assert.throws(() => validateSandmasterMovement(f.game, f.actor, changedOrder, receipt));
  const noFlight = structuredClone(order); delete noFlight.flight;
  assert.throws(() => validateSandmasterMovement(f.game, f.actor, noFlight, receipt));
  for (const flight of [
    { kind: 'discovery' as const, token: 'discovery-token-99', acquiredTurn: 1 },
    { kind: 'discovery' as const, token: f.token, acquiredTurn: 2 },
    { kind: 'physical' as const, card: 'foreign-card', mode: 'range3' as const, completed: 0 },
  ]) assert.throws(() => validateSandmasterMovement(f.game, f.actor, { ...order, flight }, receipt));
  assert.throws(() => validateSandmasterMovement(f.game, f.actor, order, { ...receipt, move: receipt.move + 1 }));
  assert.throws(() => validateSandmasterMovement(f.game, f.actor, order, { ...receipt, leader: 'foreign-trainer' }));
  for (const state of ['dead', 'captured'] as const) {
    const controlled = structuredClone(f.game), trainer = player(controlled, f.actor).leaders.find(disc => disc.id === f.trainer)!;
    if (state === 'dead') trainer.dead = true; else trainer.capturedBy = f.observer;
    assert.equal(sandmasterLeader(controlled, f.actor), null);
    rejected(controlled, f.actor, f.action);
    assert.throws(() => validateSandmasterMovement(controlled, f.actor, order, receipt));
  }
  const exhausted = structuredClone(f.game); exhausted.spice[f.pile] = 0;
  rejected(exhausted, f.actor, f.action);
  const movement = { ...order, player: f.actor, total: f.sourceCount, advisors: false, wantsFighters: false };
  const flight = quoteDiscoveryFlight(f.game, f.token, movement);
  validateDiscoveryFlight(f.game, flight, movement);
  for (const state of ['removed', 'foreign', 'sameTurn'] as const) {
    const controlled = structuredClone(f.game), token = controlled.discoveries!.tokens.find(token => token.id === f.token)!;
    if (state === 'removed') { token.status = 'removed'; token.owner = null; }
    else if (state === 'foreign') token.owner = f.observer;
    else { token.acquiredTurn = controlled.turn; token.revealedTurn = controlled.turn; }
    assert.throws(() => validateDiscoveryFlight(controlled, flight, movement));
  }
  const movedSource = structuredClone(f.game); player(movedSource, f.actor).forces[f.source]--;
  player(movedSource, f.actor).tanks++;
  rejected(movedSource, f.actor, f.action);
  assert.deepEqual(physical(f.game), f.originalPhysical); assert.deepEqual(inventory(f.game), f.originalInventory);
});

void test('all four minimal profiles offer an owned Discovery movement with legal real-pile Sandmaster collection', () => {
  for (const advanced of [false, true]) {
    const f = fixture({ advanced }); source(f);
    for (const difficulty of DIFFICULTIES) {
      const view = viewGame(f.game, f.actor); view.players.find(p => p.id === f.actor)!.bot = difficulty;
      const action = botActions(view).find(action => action.type === 'move' && action.discoveryOrnithopter === f.token &&
        (action.sandmaster as SandmasterChoice | undefined)?.collect.length);
      assert.ok(action, `${difficulty} offers an owned Discovery/Sandmaster route through actual positive spice`);
      assert.equal(Object.hasOwn(action, 'discoveryFlight'), false);
      const game = act(f.game, f.actor, action); moved(f, game, action);
      assert.equal(player(game, f.actor).moved, 1);
    }
  }
});
