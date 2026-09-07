import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  normalizeAutomaticGame,
  type Game,
  type Action,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import type { FactionId } from '../game/catalog';
import { createAmbassadors, placeAmbassador } from '../game/ecaz-ambassadors';

const p = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function fixture(
  faction: FactionId = 'fremen',
  extra: FactionId[] = [],
  copy = false,
  fifth = false,
  entrantFaction: FactionId = 'emperor',
) {
  const g = createGame('GAMBTEST', newPlayer('ec', 'Ecaz', 'ecaz'), true, [
    'ecaz',
    'choam',
    'ix',
  ]);
  g.players.push(
    newPlayer('in', 'Entrant', entrantFaction),
    newPlayer('a', 'Ally', faction),
    ...extra.map((f) => newPlayer(f, f, f)),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    storm: 18,
    active: 'in',
    deck: baseDeck(),
    discard: [],
    order: g.players.map((p) => p.id),
    movementRemaining: g.players.map((p) => p.id),
  });
  for (const player of g.players)
    Object.assign(player, {
      hand: [],
      forces: {},
      reserves: 20,
      tanks: 0,
      spice: 20,
      traitors: [],
      traitorChoices: [],
      shipped: false,
      moved: 0,
    });
  p(g, 'ec').ally = 'a';
  p(g, 'a').ally = 'ec';
  p(g, 'in').forces = { 'imperial_basin:10': 1 };
  p(g, 'in').reserves = 19;
  p(g, 'in').shipped = true;
  let state = createAmbassadors(() => 0.2);
  const token = state.tokens.find(
    (t) => t.effect === (copy ? 'beneGesserit' : 'guild'),
  )!;
  state.cohort = [
    token.id,
    ...state.tokens
      .filter(
        (t) =>
          t.effect !== 'ecaz' &&
          t.id !== token.id &&
          (!copy || t.effect !== 'guild'),
      )
      .slice(0, 4)
      .map((t) => t.id),
  ];
  for (const t of state.tokens) {
    t.zone =
      t.effect === 'ecaz' || state.cohort.includes(t.id) ? 'supply' : 'pool';
    t.location = null;
    if (fifth && t.id !== token.id && state.cohort.includes(t.id))
      t.zone = 'used';
  }
  state = placeAmbassador(state, token.id, {
    turn: 1,
    availableSpice: 20,
    destination: {
      id: 'arrakeen',
      stronghold: true,
      inStorm: false,
      allowed: true,
    },
  }).state;
  g.ecazAmbassadors = state;
  return g;
}
function hold(g: Game, id: string, name: string) {
  const at = g.deck.findIndex((c) => c.name === name);
  assert.ok(at >= 0, name);
  const card = g.deck.splice(at, 1)[0];
  p(g, id).hand.push(card);
  return card.id;
}
function enter(g: Game) {
  const entered = applyAction(g, 'in', {
    type: 'move',
    forces: { 'imperial_basin:10': 1 },
    territory: 'arrakeen',
    sector: 10,
  });
  assert.equal(entered.pendingAmbassador?.stage, 'offer');
  return entered;
}
function trigger(g: Game, beneficiary = 'a', copy = false) {
  let out = applyAction(g, 'ec', {
    type: 'decision',
    event: g.pendingAmbassador!.event,
    trigger: true,
    beneficiary,
  });
  if (copy)
    out = applyAction(out, beneficiary, {
      type: 'decision',
      event: out.pendingAmbassador!.event,
      effect: 'guild',
    });
  return out;
}
function ship(g: Game, extra: Omit<Action, 'type'>, actor = 'a') {
  return applyAction(g, actor, {
    type: 'decision',
    event: g.pendingAmbassador!.event,
    ...extra,
  });
}

/** Conserved initial position is staged; arrival, token trigger and shipment
 * declaration all use actual public actions. Mutations below model damaged saves. */
function pendingShipment() {
  const initial = fixture('atreides', ['guild']);
  const karama = hold(initial, 'guild', 'Karama');
  const g = ship(trigger(enter(initial)), {
    amount: 2,
    territory: 'sietch_tabr',
    sector: 14,
  });
  assert.equal(g.decision?.kind, 'guildShipment');
  return { g, karama };
}
function rejectEveryBoundary(g: Game) {
  const before = reload(g);
  assert.throws(() => viewGame(g, 'a'));
  assert.throws(() => normalizeAutomaticGame(g));
  assert.throws(() =>
    applyAction(g, 'a', { type: 'setAutopilot', difficulty: 'Easy' }),
  );
  assert.deepEqual(reload(g), before);
}
void test('a real pending Guild Ambassador shipment rejects damaged event, missing physical declaration and missing controller before read or writes', () => {
  const { g, karama } = pendingShipment();
  const mutations: ((s: Game) => void)[] = [
    (s) => {
      s.pendingShipment!.ambassadorEvent = 'different-source';
    },
    (s) => {
      s.pendingShipment = null;
    },
    (s) => {
      s.decision = null;
    },
    (s) => {
      s.pendingAmbassador = null;
    },
  ];
  for (const mutate of mutations) {
    const damaged = reload(g);
    mutate(damaged);
    rejectEveryBoundary(damaged);
    assert.throws(() =>
      applyAction(damaged, 'guild', { type: 'decision', allow: true }),
    );
    assert.throws(() =>
      applyAction(damaged, 'guild', {
        type: 'card',
        mode: 'special',
        card: karama,
      }),
    );
    assert.equal(p(damaged, 'a').reserves, 20);
    assert.ok(p(damaged, 'guild').hand.some((c) => c.id === karama));
  }
});
void test('a genuine paid Box search suspends the Guild choice, preserves private custody and restores a single free shipment', () => {
  const { g: original } = pendingShipment();
  original.richeseCache = richeseCards();
  const index = original.richeseCache.findIndex(
    (c) => c.effect === 'nullentropyBox',
  );
  const box = original.richeseCache.splice(index, 1)[0];
  p(original, 'a').hand.push(box);
  original.discard.push(...original.deck.splice(0, 4));
  const source = structuredClone(original.pendingShipment!);
  let g = applyAction(original, 'a', { type: 'card', card: box.id });
  assert.ok(g.pendingNullentropy);
  assert.equal(g.pendingNullentropy.resume.decision?.kind, 'guildShipment');
  assert.equal(p(g, 'a').reserves, 20);
  const paidSpice = p(g, 'a').spice;
  const selected = g.discard[0].id;
  assert.deepEqual(normalizeAutomaticGame(reload(g)), reload(g));
  for (const player of g.players) {
    const v = viewGame(reload(g), player.id);
    for (const other of v.players)
      if (other.id !== player.id) assert.equal(other.hand, undefined);
  }
  const damaged = reload(g);
  damaged.pendingShipment!.ambassadorEvent = 'stale-suspended-source';
  rejectEveryBoundary(damaged);
  g = applyAction(reload(g), 'a', {
    type: 'decision',
    event: g.pendingNullentropy.event,
    card: selected,
  });
  assert.equal(g.pendingNullentropy, null);
  assert.equal(g.decision?.kind, 'guildShipment');
  assert.deepEqual(g.pendingShipment, source);
  assert.equal(p(g, 'a').spice, paidSpice);
  assert.equal(p(g, 'a').hand.filter((c) => c.id === selected).length, 1);
  g = applyAction(reload(g), 'guild', { type: 'decision', allow: true });
  assert.equal(g.pendingAmbassador, null);
  assert.equal(g.pendingShipment, null);
  assert.equal(p(g, 'a').reserves, 18);
  assert.equal(p(g, 'a').forces['sietch_tabr:14'], 2);
  assert.equal(p(g, 'a').shipped, false);
  assert.equal(p(g, 'a').moved, 0);
  assert.equal(g.discard.filter((c) => c.id === box.id).length, 1);
  assert.equal(p(g, 'a').spice, paidSpice);
  assert.deepEqual(normalizeAutomaticGame(reload(g)), reload(g));
});

void test('a real phase-one summon restores the Guild advisor response and its later cancellation resumes the original worm queue', () => {
  const initial = fixture('atreides', ['beneGesserit'], false, false, 'fremen');
  Object.assign(initial, {
    phase: 1,
    active: null,
    nexus: false,
    // A real pending ride still belongs to the current spice pass.
    spiceSequence: { pile: 1, skipped: [] },
    wormRides: ['hagga_basin'],
    decision: { kind: 'wormRide', player: 'in', territory: 'imperial_basin' },
  });
  p(initial, 'in').forces = { 'imperial_basin:10': 2, 'hagga_basin:12': 1 };
  p(initial, 'in').reserves = 17;
  const summon = hold(initial, 'in', 'Karama');
  const cancel = hold(initial, 'ec', 'Karama');
  let g = applyAction(initial, 'in', {
    type: 'decision',
    accept: true,
    forces: { 'imperial_basin:10': 1 },
    territory: 'arrakeen',
    sector: 10,
  });
  g = ship(trigger(g), { amount: 2, territory: 'wind_pass', sector: 14 });
  g = applyAction(g, 'beneGesserit', {
    type: 'decision',
    accept: true,
    accompany: true,
    sector: 15,
  });
  const parent = structuredClone(g.pendingAmbassador);
  const response = structuredClone(g.response);
  g = applyAction(reload(g), 'in', {
    type: 'card',
    mode: 'special',
    card: summon,
    territory: 'red_chasm',
  });
  assert.equal(g.summonedWorm, null);
  assert.deepEqual(g.pendingAmbassador, parent);
  assert.deepEqual(g.response, response);
  assert.deepEqual(g.wormRides, ['hagga_basin']);
  assert.equal(p(g, 'a').reserves, 18);
  assert.equal(p(g, 'beneGesserit').reserves, 20);
  assert.deepEqual(normalizeAutomaticGame(reload(g)), reload(g));
  for (const player of g.players)
    assert.doesNotThrow(() => viewGame(reload(g), player.id));
  g = applyAction(reload(g), 'ec', {
    type: 'card',
    mode: 'cancel',
    card: cancel,
  });
  assert.equal(g.pendingAmbassador, null);
  assert.equal(g.response, null);
  assert.equal(g.decision, null);
  assert.equal(g.nexus, true);
  assert.deepEqual(g.wormRides, ['hagga_basin']);
  for (const player of g.players)
    g = applyAction(g, player.id, { type: 'ready' });
  assert.deepEqual(g.decision, {
    kind: 'wormRide',
    player: 'in',
    territory: 'hagga_basin',
  });
  assert.deepEqual(g.wormRides, []);
  assert.equal(p(g, 'a').forces['wind_pass:14'], 2);
  assert.equal(p(g, 'beneGesserit').reserves, 20);
  assert.equal(p(g, 'a').shipped, false);
  assert.equal(p(g, 'a').moved, 0);
  assert.equal(g.discard.filter((c) => c.id === summon).length, 1);
  assert.equal(g.discard.filter((c) => c.id === cancel).length, 1);
});
