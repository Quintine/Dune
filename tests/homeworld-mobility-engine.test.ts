import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeHomeworldGameForAudit,
  joinGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import {
  homeworldGameIntegrity,
  homeworldContext,
} from '../game/homeworld-game';
import { createHomeworldCustody } from '../game/homeworld-custody';
import { baseDeck, spiceDeck } from '../game/cards';
import { mobileRoutes, MOBILE_LOCATION } from '../game/board';
import {
  createRicheseNoField,
  deployRicheseNoField,
} from '../game/richese-no-field';
import { quoteMovementPhaseStart } from '../game/movement-phase-quote';
import {
  fremenAmbassadorMovement,
  quoteFremenAmbassadorMove,
} from '../game/fremen-ambassador';
import type { FactionId } from '../game/catalog';

const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
/** Genuine audited setup retains every physical card and counter. Later phase
 * positioning and typed reserve-to-board redistribution isolate each threshold. */
function fixture(faction: FactionId, advanced = true) {
  // Richese's full expansion deck remains gated. These narrowly staged module
  // states do not claim a genuine complete Richese setup or release readiness.
  if (faction === 'richese') {
    const g = createGame(
      'HOMEWORLDMOBILITY',
      newPlayer('owner', faction, faction),
      advanced,
      ['choam'],
    );
    joinGame(g, newPlayer('other', 'Atreides', 'atreides'));
    g.homeworlds = { custody: createHomeworldCustody(homeworldContext(g)) };
    Object.assign(g, {
      status: 'playing',
      phase: 5,
      active: 'owner',
      turn: 2,
      decision: null,
      response: null,
      phaseOpening: null,
      ready: [],
      storm: 18,
      movementRemaining: ['owner', 'other'],
      order: ['owner', 'other'],
      deck: baseDeck(),
      spiceDeck: spiceDeck(),
    });
    const p = g.players[0];
    p.spice = 10;
    p.noField = createRicheseNoField([
      'richese-zero',
      'richese-three',
      'richese-five',
    ]);
    p.noFieldEvent = 'initial-richese-marker';
    homeworldGameIntegrity(g);
    return g;
  }
  let g = createGame(
    'HOMEWORLDMOBILITY',
    newPlayer('owner', faction, faction),
    advanced,
    faction === 'ixians' ? ['ix'] : [],
  );
  joinGame(g, newPlayer('other', 'Emperor', 'emperor'));
  g = applyAction(g, 'owner', { type: 'homeworlds', enabled: true });
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  g = initializeHomeworldGameForAudit(g);
  for (let n = 0; g.status === 'setup' && n < 40; n++) {
    let next: Game | undefined;
    for (const p of g.players) {
      const view = viewGame(g, p.id);
      view.players.find((seat) => seat.id === p.id)!.bot = 'Easy';
      const action = botActions(view)[0];
      if (action) {
        next = applyAction(g, p.id, action);
        break;
      }
    }
    assert.ok(next, 'Genuine setup offers an actionable decision.');
    g = next;
  }
  assert.equal(g.status, 'playing');
  for (const p of g.players) g.deck.push(...p.hand.splice(0));
  Object.assign(g, {
    phase: 5,
    phaseOpening: null,
    active: 'owner',
    turn: 2,
    decision: null,
    response: null,
    ready: [],
    storm: 18,
    movementRemaining: ['owner', 'other'],
    order: ['owner', 'other'],
  });
  g.players[0].shipped = false;
  g.players[0].moved = 0;
  homeworldGameIntegrity(g);
  return g;
}
function population(g: Game, reserves: number, source = 'polar_sink:0') {
  const p = g.players[0];
  p.reserves = reserves;
  p.tanks = 0;
  p.forces = { [source]: 20 - reserves };
  if (p.elites) {
    p.elites.reserves = Math.min(reserves, 4);
    p.elites.tanks = 0;
    p.elites.forces = { [source]: 7 - p.elites.reserves };
  }
  homeworldGameIntegrity(g);
}
function reject(g: Game, action: Action, pattern: RegExp) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, 'owner', action), pattern);
  assert.deepEqual(g, before);
}
function hold(g: Game, effect: string) {
  const index = g.deck.findIndex((card) => card.effect === effect);
  assert.ok(index >= 0);
  const [card] = g.deck.splice(index, 1);
  g.players[0].hand.push(card);
  return card;
}
function marker(g: Game) {
  const p = g.players[0],
    token = p.noField!.tokens.find((t) => t.value === 0)!;
  p.noField = deployRicheseNoField(p.noField!, {
    tokenId: token.id,
    controller: p.id,
    location: { territory: 'imperial_basin', sector: 10 },
  });
  return {
    type: 'move',
    forces: {},
    noField: token.id,
    event: p.noFieldEvent,
    territory: 'arrakeen',
    sector: 10,
  } satisfies Action;
}

void test('Caladan threshold suppresses the actual phase-start foresight offer and deck refill only below six', () => {
  for (const advanced of [false, true])
    for (const reserves of [5, 6]) {
      const g = fixture('atreides', advanced);
      population(g, reserves);
      const before = reload(g);
      const quote = quoteMovementPhaseStart(g);
      assert.equal(quote.kind, 'initialize');
      if (quote.kind === 'initialize')
        assert.equal(quote.spice.owner, reserves < 6 ? null : 'owner');
      assert.deepEqual(g, before);
      g.spiceDiscard[0].push(...g.spiceDeck.splice(0));
      const empty = quoteMovementPhaseStart(g);
      if (empty.kind === 'initialize')
        assert.equal(empty.spice.refill, reserves >= 6);
    }
});
void test('Atreides retains already learned Movement knowledge after a real shipment lowers Caladan', () => {
  let g = fixture('atreides');
  population(g, 6);
  g.phase = 4;
  g.active = null;
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  g = normalizeAutomaticGame(g);
  assert.equal(g.phase, 5);
  assert.equal(g.spicePeekKnown, true);
  const known = viewGame(g, 'owner').spicePeek;
  assert.ok(known);
  g = applyAction(g, 'owner', {
    type: 'ship',
    territory: 'polar_sink',
    sector: 0,
    amount: 1,
  });
  assert.equal(g.players[0].reserves, 5);
  assert.deepEqual(viewGame(reload(g), 'owner').spicePeek, known);
  assert.equal(viewGame(reload(g), 'other').spicePeek, null);
  homeworldGameIntegrity(g);
});
void test('a low-Caladan phase start grants no foresight and a later population rise creates no late peek', () => {
  let g = fixture('atreides');
  population(g, 5);
  g.phase = 4;
  g.active = null;
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  g = normalizeAutomaticGame(g);
  assert.equal(g.phase, 5);
  assert.equal(g.spicePeekKnown, false);
  assert.equal(viewGame(g, 'owner').spicePeek, null);
  population(g, 6);
  assert.equal(viewGame(reload(g), 'owner').spicePeek, null);
});
void test('low Ix cannot spend a real special Karama to relocate, while high Ix commits once', () => {
  const g = fixture('ixians');
  population(g, 4, MOBILE_LOCATION);
  g.mobileStronghold = { location: 'polar_sink:0' };
  const card = hold(g, 'karama'),
    route = mobileRoutes(g, 2)[0];
  assert.ok(route);
  const action = {
    type: 'card',
    mode: 'special',
    card: card.id,
    route,
    collect: false,
  };
  reject(g, action, /Low-population Ix/);
  population(g, 5, MOBILE_LOCATION);
  const next = applyAction(reload(g), 'owner', action);
  assert.equal(next.mobileStronghold!.location, route.at(-1));
  assert.equal(next.players[0].specialKaramaUsed, true);
  assert.equal(next.discard.filter((c) => c.id === card.id).length, 1);
  assert.equal(next.players[0].moved, 0);
  homeworldGameIntegrity(next);
});
void test('low Ix still moves its physical troops out of a stationary Hidden Mobile Stronghold', () => {
  const g = fixture('ixians');
  population(g, 4, MOBILE_LOCATION);
  g.mobileStronghold = { location: 'polar_sink:0' };
  const next = applyAction(g, 'owner', {
    type: 'move',
    forces: { [MOBILE_LOCATION]: 1 },
    eliteForces: { [MOBILE_LOCATION]: 0 },
    territory: 'polar_sink',
    sector: 0,
  });
  assert.equal(next.players[0].forces['polar_sink:0'], 1);
  assert.deepEqual(next.mobileStronghold, g.mobileStronghold);
  homeworldGameIntegrity(next);
});
void test('low Richese rejects token-only and mixed ordinary movement but allows physical forces beside the stationary marker', () => {
  const g = fixture('richese');
  population(g, 9, 'imperial_basin:10');
  const action = marker(g);
  reject(g, action, /Low-population Richese/);
  reject(
    g,
    { ...action, forces: { 'imperial_basin:10': 1 } },
    /Low-population Richese/,
  );
  const next = applyAction(reload(g), 'owner', {
    type: 'move',
    forces: { 'imperial_basin:10': 1 },
    territory: 'arrakeen',
    sector: 10,
  });
  assert.deepEqual(next.players[0].noField, g.players[0].noField);
  assert.equal(next.players[0].forces['arrakeen:10'], 1);
  homeworldGameIntegrity(next);
});
void test('high Richese moves the same physical token once and never borrows concealed force value', () => {
  const g = fixture('richese');
  population(g, 10, 'imperial_basin:10');
  const action = marker(g);
  const next = applyAction(reload(g), 'owner', action);
  assert.equal(
    next.players[0].noField!.deployed!.location.territory,
    'arrakeen',
  );
  assert.equal(next.players[0].reserves, 10);
  assert.deepEqual(next.players[0].forces, g.players[0].forces);
  assert.notEqual(next.players[0].noFieldEvent, g.players[0].noFieldEvent);
  reject(reload(next), action, /available|stale/);
  homeworldGameIntegrity(next);
});
void test('low Richese may still ship and reveal a No-Field; the penalty applies only to movement', () => {
  let g = fixture('richese');
  population(g, 9);
  const p = g.players[0];
  const token = p.noField!.tokens.find((t) => t.value === 3)!;
  g = applyAction(g, 'owner', {
    type: 'ship',
    noField: token.id,
    event: p.noFieldEvent,
    territory: 'imperial_basin',
    sector: 10,
  });
  assert.equal(g.players[0].reserves, 9);
  g = applyAction(g, 'owner', {
    type: 'revealNoField',
    token: token.id,
    event: g.players[0].noFieldEvent,
  });
  assert.equal(g.players[0].reserves, 6);
  assert.equal(g.players[0].forces['imperial_basin:10'], 3);
  homeworldGameIntegrity(g);
});
void test('Fremen Ambassador quote and public source controls reject only the low Richese marker', () => {
  const g = fixture('richese');
  population(g, 9, 'imperial_basin:10');
  marker(g);
  const p = g.players[0],
    token = p.noField!.deployed!.tokenId;
  const action = {
    type: 'decision',
    forces: {},
    territory: 'arrakeen',
    sector: 10,
    noField: { tokenId: token, event: p.noFieldEvent },
  };
  const before = reload(g);
  assert.throws(
    () => quoteFremenAmbassadorMove(g, 'owner', action),
    /Low-population Richese/,
  );
  assert.equal(
    quoteFremenAmbassadorMove(g, 'owner', {
      ...action,
      noField: undefined,
      forces: { 'imperial_basin:10': 1 },
    }).total,
    1,
  );
  const source = fremenAmbassadorMovement(g, 'owner').sources.find(
    (s) => s.territory === 'imperial_basin',
  )!;
  assert.ok(source.destinations.length);
  assert.equal(source.marker, null);
  assert.deepEqual(g, before);
});
void test('low Richese Hajr extra movement cannot carry the marker', () => {
  const g = fixture('richese');
  population(g, 9, 'imperial_basin:10');
  const action = marker(g);
  const hajr = hold(g, 'hajr');
  const next = applyAction(g, 'owner', { type: 'card', card: hajr.id });
  assert.ok(next.hajr.includes('owner'));
  reject(next, action, /Low-population Richese/);
  assert.equal(next.discard.filter((c) => c.id === hajr.id).length, 1);
});
void test('normalized saved low Caladan foresight response fails without leaking the deck', () => {
  const g = fixture('atreides');
  population(g, 5);
  g.response = { kind: 'atreidesSpice', owner: 'owner', passed: [] };
  const before = reload(g);
  assert.throws(
    () => normalizeAutomaticGame(reload(g)),
    /Caladan|foresight|Homeworld/,
  );
  assert.deepEqual(g, before);
});

function nextStorm(state: Game) {
  let g = state;
  g.phase = 8;
  g.active = null;
  for (let step = 0; step < 2; step++)
    for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.phase, 0);
  return g;
}
void test('the real Storm phase skips low Ix relocation and offers it again at five native forces', () => {
  for (const reserves of [4, 5]) {
    const g = fixture('ixians');
    population(g, reserves, MOBILE_LOCATION);
    g.mobileStronghold = { location: 'polar_sink:0' };
    const next = nextStorm(g);
    assert.equal(
      next.decision?.kind ?? null,
      reserves < 5 ? null : 'mobileStronghold',
    );
    assert.deepEqual(next.mobileStronghold, g.mobileStronghold);
    homeworldGameIntegrity(next);
  }
});
void test('a saved normal HMS relocation cannot execute or consume cancellation after native Ix becomes low', () => {
  let g = fixture('ixians');
  population(g, 5, MOBILE_LOCATION);
  g.mobileStronghold = { location: 'polar_sink:0' };
  const card = hold(g, 'karama');
  g.players[1].hand.push(...g.players[0].hand.splice(0));
  g = nextStorm(g);
  const route = mobileRoutes(g, 3)[0];
  assert.ok(route);
  g = applyAction(g, 'owner', { type: 'decision', route, collect: false });
  assert.equal(g.response?.kind, 'mobileStronghold');
  assert.ok(g.pendingMobileMove);
  population(g, 4, MOBILE_LOCATION);
  reject(g, { type: 'passResponse' }, /Low-population Ix/);
  assert.throws(
    () =>
      applyAction(g, 'other', { type: 'card', card: card.id, mode: 'cancel' }),
    /Low-population Ix/,
  );
  assert.throws(() => normalizeAutomaticGame(reload(g)), /Low-population Ix/);
});
void test('initial HMS placement remains legal at low Ix because placement is not relocation', () => {
  let g = fixture('ixians');
  population(g, 4, MOBILE_LOCATION);
  g.phase = 0;
  g.turn = 1;
  g.active = null;
  g.mobileStronghold = { location: null };
  g.decision = { kind: 'mobileStronghold', player: 'owner', placement: true };
  g = applyAction(g, 'owner', { type: 'decision', location: 'polar_sink:0' });
  assert.equal(g.mobileStronghold!.location, 'polar_sink:0');
  assert.equal(g.phase, 1);
  homeworldGameIntegrity(g);
});
