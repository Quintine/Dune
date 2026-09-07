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
import {
  createAmbassadors,
  placeAmbassador,
  validateAmbassadors,
} from '../game/ecaz-ambassadors';
import { createTerrorState, placeTerror } from '../game/moritani-terror';
import { MOBILE_LOCATION, MOBILE_STRONGHOLD } from '../game/board';
import { createTechTokens } from '../game/tech-tokens';

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
function army(g: Game, id: string, forces: Record<string, number>) {
  p(g, id).forces = forces;
  p(g, id).reserves =
    20 - p(g, id).tanks - Object.values(forces).reduce((a, b) => a + b, 0);
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
function bookkeeping(g: Game) {
  return {
    turn: g.turn,
    phase: g.phase,
    active: g.active,
    queue: g.movementRemaining,
    players: g.players.map((p) => ({
      id: p.id,
      shipped: p.shipped,
      moved: p.moved,
      spice: p.spice,
      tanks: p.tanks,
    })),
    ornithopter: g.ornithopter,
    aid: g.aid,
    karamaShipping: g.karamaShipping,
    hajr: g.hajr,
    guildTimingGranted: g.guildTimingGranted,
    guildTimingLocked: g.guildTimingLocked,
  };
}
function conserve(g: Game) {
  validateAmbassadors(g.ecazAmbassadors!);
  for (const player of g.players)
    assert.equal(
      player.reserves +
        player.tanks +
        Object.values(player.forces).reduce((a, b) => a + b, 0),
      20,
      player.id,
    );
  const ids = [
    ...g.deck,
    ...g.discard,
    ...(g.richeseCache ?? []),
    ...(g.ornithopter ? [g.ornithopter.card] : []),
    ...g.players.flatMap((p) => p.hand),
  ].map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  return ids.sort();
}
function reject(g: Game, action: Action, actor = 'a') {
  const before = reload(g);
  assert.throws(() => applyAction(g, actor, action));
  assert.deepEqual(reload(g), before);
}
function allow(g: Game) {
  for (let i = 0; g.response && i < 30; i++) {
    const actor = g.players.find((p) => !g.response!.passed.includes(p.id));
    assert.ok(actor);
    g = applyAction(g, actor.id, { type: 'passResponse' });
  }
  assert.equal(g.response, null);
  return g;
}
function settled(g: Game) {
  assert.equal(g.pendingAmbassador, null);
  assert.equal(g.decision, null);
  assert.deepEqual(normalizeAutomaticGame(reload(g)), reload(g));
  conserve(g);
}

void test('actual Guild Ambassador ships one through four free physical forces for Ecaz or its ally without spending ordinary allowances', () => {
  for (const beneficiary of ['ec', 'a'])
    for (const amount of [1, 4]) {
      const initial = fixture('atreides');
      p(initial, beneficiary).moved = 1;
      p(initial, beneficiary).shipped = true;
      p(initial, beneficiary).spice = 0;
      initial.hajr = [beneficiary];
      let g = trigger(enter(initial), beneficiary);
      assert.equal(g.pendingAmbassador?.stage, 'ship');
      const before = bookkeeping(g),
        ids = conserve(g),
        event = g.pendingAmbassador!.event;
      const action: Action = {
        type: 'decision',
        event,
        amount,
        territory: 'sietch_tabr',
        sector: 14,
      };
      reject(g, action, 'in');
      reject(g, { ...action, event: 'stale' }, beneficiary);
      reject(g, { ...action, amount: 5 }, beneficiary);
      g = applyAction(reload(g), beneficiary, action);
      assert.equal(p(g, beneficiary).reserves, 20 - amount);
      assert.equal(p(g, beneficiary).forces['sietch_tabr:14'], amount);
      assert.deepEqual(bookkeeping(g), before);
      assert.deepEqual(conserve(g), ids);
      settled(g);
      reject(g, action, beneficiary);
    }
});
void test('typed reserve shipment uses physical totals and the minimum necessary elite allocation', () => {
  for (const explicit of [false, true]) {
    const initial = fixture('ixians');
    army(initial, 'a', { 'red_chasm:7': 16 });
    p(initial, 'a').elites = {
      reserves: 3,
      tanks: 0,
      revived: 0,
      forces: { 'red_chasm:7': 4 },
    };
    const g = trigger(enter(initial));
    const before = bookkeeping(g);
    reject(g, {
      type: 'decision',
      event: g.pendingAmbassador!.event,
      amount: 3,
      elite: 1,
      territory: 'sietch_tabr',
      sector: 14,
    });
    const done = ship(g, {
      amount: 3,
      ...(explicit ? { elite: 3 } : {}),
      territory: 'sietch_tabr',
      sector: 14,
    });
    assert.equal(p(done, 'a').reserves, 1);
    assert.equal(p(done, 'a').elites!.reserves, explicit ? 0 : 1);
    assert.equal(p(done, 'a').forces['sietch_tabr:14'], 3);
    assert.equal(
      p(done, 'a').elites!.forces['sietch_tabr:14'],
      explicit ? 3 : 2,
    );
    assert.deepEqual(bookkeeping(done), before);
    settled(done);
  }
});
void test('zero is an explicit no-arrival choice and an empty reserve automatically completes the committed trigger', () => {
  for (const empty of [false, true]) {
    const initial = fixture('atreides', [], true, true);
    if (empty) {
      p(initial, 'a').reserves = 0;
      p(initial, 'a').tanks = 20;
    }
    let g = trigger(enter(initial), 'a', true);
    const cohort = [...initial.ecazAmbassadors!.cohort];
    if (!empty) {
      assert.equal(g.pendingAmbassador?.stage, 'ship');
      g = ship(g, { amount: 0 });
    }
    assert.notDeepEqual(g.ecazAmbassadors!.cohort, cohort);
    assert.deepEqual(p(g, 'a').forces, {});
    assert.equal(p(g, 'a').moved, 0);
    assert.equal(p(g, 'a').shipped, false);
    assert.equal(g.pendingShipment ?? null, null);
    settled(g);
  }
});
void test('storm and unavailable No-Field payloads reject before reserves move, while reciprocal Ecaz occupancy is legal', () => {
  const initial = fixture('atreides');
  initial.storm = 14;
  army(initial, 'ec', { 'wind_pass:15': 1 });
  const g = trigger(enter(initial));
  const base: Action = {
    type: 'decision',
    event: g.pendingAmbassador!.event,
    amount: 2,
    territory: 'sietch_tabr',
    sector: 14,
  };
  reject(g, base);
  for (const field of ['noField', 'alliedNoField'])
    reject(g, {
      ...base,
      territory: 'wind_pass',
      sector: 15,
      [field]: 'opaque-token',
    });
  const done = ship(g, { amount: 2, territory: 'wind_pass', sector: 15 });
  assert.equal(p(done, 'a').forces['wind_pass:15'], 2);
  assert.equal(p(done, 'ec').forces['wind_pass:15'], 1);
  settled(done);
});
void test('Ixians can receive their Guild Ambassador reserve shipment inside the actual mobile stronghold; others cannot', () => {
  for (const faction of ['ixians', 'atreides'] as const) {
    const initial = fixture(faction, faction === 'ixians' ? [] : ['ixians']);
    initial.mobileStronghold = { location: 'wind_pass:14' };
    initial.storm = 14;
    const g = trigger(enter(initial));
    const action: Action = {
      type: 'decision',
      event: g.pendingAmbassador!.event,
      amount: 2,
      territory: MOBILE_STRONGHOLD,
      sector: 0,
    };
    if (faction !== 'ixians') {
      reject(g, action);
      continue;
    }
    const done = applyAction(reload(g), 'a', action);
    assert.equal(p(done, 'a').forces[MOBILE_LOCATION], 2);
    assert.deepEqual(done.mobileStronghold, g.mobileStronghold);
    settled(done);
  }
});
void test('Fremen reserve shipment reaches beyond native range without Guild income, BG accompaniment or off-planet tech income', () => {
  const initial = fixture('fremen', ['guild', 'beneGesserit', 'ixians']);
  initial.techTokens = createTechTokens(initial.players);
  const g = trigger(enter(initial)),
    before = bookkeeping(g);
  const done = ship(g, { amount: 4, territory: 'sietch_tabr', sector: 14 });
  assert.equal(p(done, 'a').forces['sietch_tabr:14'], 4);
  assert.equal(p(done, 'beneGesserit').reserves, 20);
  assert.deepEqual(done.techTokens, g.techTokens);
  assert.deepEqual(bookkeeping(done), before);
  settled(done);
});
void test('Guild special stop is a phase-five independent decision and preserves reserves, escrow and ordinary movement on stop or allowance', () => {
  for (const stop of [false, true]) {
    const initial = fixture('atreides', ['guild']);
    const karama = hold(initial, 'guild', 'Karama');
    initial.aid.ec = { recipient: 'a', amount: 3 };
    p(initial, 'ec').spice = 17;
    let g = trigger(enter(initial));
    const before = bookkeeping(g);
    g = ship(g, { amount: 3, territory: 'sietch_tabr', sector: 14 });
    assert.equal(g.decision?.kind, 'guildShipment');
    assert.equal(g.pendingShipment?.source, 'ambassador');
    assert.equal(g.pendingShipment?.cost, 0);
    assert.equal(g.pendingShipment?.allyPayment, 0);
    assert.equal(p(g, 'a').reserves, 20);
    g = stop
      ? applyAction(reload(g), 'guild', {
          type: 'card',
          mode: 'special',
          card: karama,
        })
      : applyAction(reload(g), 'guild', { type: 'decision', allow: true });
    assert.equal(p(g, 'a').reserves, stop ? 20 : 17);
    assert.equal(p(g, 'a').forces['sietch_tabr:14'] ?? 0, stop ? 0 : 3);
    assert.equal(!!p(g, 'guild').specialKaramaUsed, stop);
    assert.equal(g.discard.filter((c) => c.id === karama).length, stop ? 1 : 0);
    assert.deepEqual(bookkeeping(g), before);
    settled(g);
  }
});
void test('the original entrants active Ornithopter cohort survives a BG-copy Guild shipment before the second group moves', () => {
  const initial = fixture('atreides', [], true);
  army(initial, 'in', { 'imperial_basin:10': 2 });
  initial.richeseCache = richeseCards();
  const at = initial.richeseCache.findIndex((c) => c.effect === 'ornithopter'),
    card = initial.richeseCache.splice(at, 1)[0];
  p(initial, 'in').hand.push(card);
  const ids = conserve(initial);
  let g = applyAction(initial, 'in', {
    type: 'move',
    forces: { 'imperial_basin:10': 1 },
    territory: 'arrakeen',
    sector: 10,
    movementCard: card.id,
    ornithopter: 'twoGroups',
  });
  const flight = reload(g).ornithopter!;
  g = trigger(g, 'a', true);
  g = ship(g, { amount: 2, territory: 'sietch_tabr', sector: 14 });
  assert.deepEqual(g.ornithopter, flight);
  assert.equal(p(g, 'a').moved, 0);
  assert.equal(p(g, 'in').moved, 1);
  g = applyAction(reload(g), 'in', {
    type: 'move',
    forces: { 'imperial_basin:10': 1 },
    territory: 'arrakeen',
    sector: 10,
    ornithopterEvent: flight.event,
  });
  assert.equal(g.ornithopter, null);
  assert.equal(p(g, 'in').moved, 2);
  assert.equal(g.discard.filter((c) => c.id === card.id).length, 1);
  assert.deepEqual(conserve(g), ids);
  settled(g);
});

void test('BG accompaniment may be declined, canceled or accepted without replaying the already committed Guild Ambassador shipment', () => {
  for (const outcome of ['decline', 'cancel', 'allow'] as const) {
    const initial = fixture('atreides', ['beneGesserit']);
    const karama = hold(initial, 'ec', 'Karama');
    let g = trigger(enter(initial));
    const event = g.pendingAmbassador!.event;
    g = ship(g, { amount: 2, territory: 'wind_pass', sector: 14 });
    assert.equal(g.decision?.kind, 'advisor');
    assert.equal(g.pendingAmbassador?.event, event);
    assert.equal(p(g, 'a').reserves, 18);
    assert.equal(p(g, 'beneGesserit').reserves, 20);
    if (outcome === 'decline')
      g = applyAction(reload(g), 'beneGesserit', {
        type: 'decision',
        accept: false,
      });
    else {
      g = applyAction(reload(g), 'beneGesserit', {
        type: 'decision',
        accept: true,
        accompany: true,
        sector: 15,
      });
      assert.equal(g.response?.kind, 'advisor');
      assert.equal(p(g, 'beneGesserit').reserves, 20);
      g =
        outcome === 'cancel'
          ? applyAction(reload(g), 'ec', {
              type: 'card',
              mode: 'cancel',
              card: karama,
            })
          : allow(reload(g));
    }
    assert.equal(p(g, 'a').reserves, 18);
    assert.equal(p(g, 'a').forces['wind_pass:14'], 2);
    assert.equal(p(g, 'a').shipped, false);
    assert.equal(p(g, 'beneGesserit').reserves, outcome === 'allow' ? 19 : 20);
    assert.equal(
      p(g, 'beneGesserit').forces['wind_pass:15'] ?? 0,
      outcome === 'allow' ? 1 : 0,
    );
    if (outcome === 'allow')
      assert.equal(p(g, 'beneGesserit').advisors?.wind_pass.lockedTurn, g.turn);
    settled(g);
  }
});
void test('Intrusion resolves before the independent accompanying advisor choice with decline and Karama cancellation continuations', () => {
  for (const outcome of ['decline', 'cancel', 'allow'] as const) {
    const initial = fixture('atreides', ['beneGesserit']);
    army(initial, 'beneGesserit', { 'sietch_tabr:14': 1 });
    const karama = hold(initial, 'ec', 'Karama');
    let g = trigger(enter(initial));
    g = ship(g, { amount: 2, territory: 'sietch_tabr', sector: 14 });
    assert.equal(g.decision?.kind, 'intrusion');
    assert.equal(g.pendingAmbassador?.stage, 'arrival');
    g = applyAction(reload(g), 'beneGesserit', {
      type: 'decision',
      accept: outcome !== 'decline',
    });
    if (outcome !== 'decline') {
      assert.equal(g.response?.kind, 'advisorFlip');
      g =
        outcome === 'cancel'
          ? applyAction(reload(g), 'ec', {
              type: 'card',
              card: karama,
              mode: 'cancel',
            })
          : allow(reload(g));
    }
    assert.equal(g.decision?.kind, 'advisor');
    assert.equal(
      !!p(g, 'beneGesserit').advisors?.sietch_tabr,
      outcome === 'allow',
    );
    g = applyAction(reload(g), 'beneGesserit', {
      type: 'decision',
      accept: true,
      accompany: outcome === 'allow',
    });
    g = allow(g);
    assert.equal(p(g, 'beneGesserit').reserves, 18);
    assert.equal(p(g, 'a').reserves, 18);
    assert.equal(p(g, 'a').forces['sietch_tabr:14'], 2);
    assert.equal(
      p(g, 'beneGesserit').forces[
        outcome === 'allow' ? 'sietch_tabr:14' : 'polar_sink:0'
      ],
      outcome === 'allow' ? 2 : 1,
    );
    settled(g);
  }
});
void test('Ixian Guild Ambassador shipment permits the explicitly allowed BG accompaniment into mobile sector zero', () => {
  const initial = fixture('ixians', ['beneGesserit']);
  initial.mobileStronghold = { location: 'wind_pass:14' };
  initial.storm = 14;
  hold(initial, 'ec', 'Karama');
  let g = trigger(enter(initial));
  g = ship(g, { amount: 3, territory: MOBILE_STRONGHOLD, sector: 0 });
  assert.equal(g.decision?.kind, 'advisor');
  g = applyAction(reload(g), 'beneGesserit', {
    type: 'decision',
    accept: true,
    accompany: true,
    sector: 0,
  });
  g = allow(reload(g));
  assert.equal(p(g, 'a').forces[MOBILE_LOCATION], 3);
  assert.equal(p(g, 'beneGesserit').forces[MOBILE_LOCATION], 1);
  assert.equal(
    p(g, 'beneGesserit').advisors?.[MOBILE_STRONGHOLD].lockedTurn,
    g.turn,
  );
  assert.deepEqual(g.mobileStronghold, initial.mobileStronghold);
  settled(g);
});
void test('phase-one Guild shipment and BG accompaniment finish before resuming the remaining Fremen worm ride with no Guild stop', () => {
  const initial = fixture(
    'atreides',
    ['guild', 'beneGesserit'],
    false,
    false,
    'fremen',
  );
  Object.assign(initial, {
    phase: 1,
    active: null,
    nexus: false,
    wormRides: ['hagga_basin'],
    decision: { kind: 'wormRide', player: 'in', territory: 'imperial_basin' },
  });
  army(initial, 'in', { 'imperial_basin:10': 2, 'hagga_basin:12': 1 });
  const card = hold(initial, 'guild', 'Karama');
  let g = applyAction(initial, 'in', {
    type: 'decision',
    accept: true,
    forces: { 'imperial_basin:10': 1 },
    territory: 'arrakeen',
    sector: 10,
  });
  assert.equal(g.pendingAmbassador?.resume, 'wormRide');
  g = trigger(g);
  g = ship(g, { amount: 4, territory: 'wind_pass', sector: 14 });
  assert.equal(g.decision?.kind, 'advisor');
  assert.equal(p(g, 'a').reserves, 16);
  reject(g, { type: 'card', card, mode: 'special' }, 'guild');
  g = applyAction(reload(g), 'beneGesserit', {
    type: 'decision',
    accept: true,
    accompany: true,
    sector: 15,
  });
  assert.equal(g.response?.kind, 'advisor');
  assert.ok(g.pendingAmbassador);
  g = allow(reload(g));
  assert.equal(g.pendingAmbassador, null);
  assert.deepEqual(g.decision, {
    kind: 'wormRide',
    player: 'in',
    territory: 'hagga_basin',
  });
  assert.deepEqual(g.wormRides, []);
  assert.equal(p(g, 'beneGesserit').forces['wind_pass:15'], 1);
  assert.ok(p(g, 'guild').hand.some((c) => c.id === card));
  assert.equal(p(g, 'a').moved, 0);
  assert.equal(p(g, 'a').shipped, false);
  conserve(g);
  assert.deepEqual(normalizeAutomaticGame(reload(g)), reload(g));
});
void test('a Terror token can react separately to the primary shipment and its later accompanying advisor', () => {
  const initial = fixture('atreides', ['moritani', 'beneGesserit']);
  initial.moritaniTerror = createTerrorState(() => 0);
  const token = initial.moritaniTerror.tokens.find(
    (t) => t.kind === 'sabotage',
  )!;
  initial.moritaniTerror = placeTerror(
    initial.moritaniTerror,
    token.id,
    'sietch_tabr',
    1,
  );
  hold(initial, 'ec', 'Karama');
  let g = trigger(enter(initial));
  const event = g.pendingAmbassador!.event;
  g = ship(g, { amount: 2, territory: 'sietch_tabr', sector: 14 });
  assert.equal(g.pendingTerrorEntry?.entrant, 'a');
  assert.equal(g.pendingAmbassador?.event, event);
  assert.equal(viewGame(g, 'moritani').terrorEntry?.kind, 'sabotage');
  assert.equal('kind' in viewGame(g, 'a').terrorEntry!, false);
  g = applyAction(reload(g), 'moritani', { type: 'decision', decline: true });
  assert.equal(g.decision?.kind, 'advisor');
  g = applyAction(reload(g), 'beneGesserit', {
    type: 'decision',
    accept: true,
    accompany: true,
  });
  g = allow(reload(g));
  assert.equal(g.pendingTerrorEntry?.entrant, 'beneGesserit');
  assert.equal(g.pendingAmbassador?.event, event);
  assert.equal(p(g, 'beneGesserit').reserves, 19);
  g = applyAction(reload(g), 'moritani', { type: 'decision', decline: true });
  assert.equal(g.pendingTerrorEntry, null);
  assert.equal(p(g, 'a').forces['sietch_tabr:14'], 2);
  assert.equal(p(g, 'beneGesserit').forces['sietch_tabr:14'], 1);
  settled(g);
});

void test('private Guild hands cannot change the public stop window and only the beneficiary receives shipment choices', () => {
  const initial = fixture('atreides', ['guild']);
  const withCard = reload(initial);
  hold(withCard, 'guild', 'Karama');
  const offered = trigger(enter(withCard)),
    empty = trigger(enter(initial));
  assert.ok(
    viewGame(offered, 'a').ambassadorEntry?.shipment?.destinations.length,
  );
  for (const id of ['ec', 'in', 'guild']) {
    assert.equal(viewGame(offered, id).ambassadorEntry?.shipment, null);
    assert.equal('pendingAmbassador' in viewGame(offered, id), false);
    assert.equal('pendingShipment' in viewGame(offered, id), false);
  }
  assert.deepEqual(
    viewGame(offered, 'a').ambassadorEntry,
    viewGame(empty, 'a').ambassadorEntry,
  );
  const pending = ship(offered, {
      amount: 2,
      territory: 'sietch_tabr',
      sector: 14,
    }),
    noCard = ship(empty, { amount: 2, territory: 'sietch_tabr', sector: 14 });
  assert.deepEqual(pending.decision, noCard.decision);
  assert.deepEqual(
    viewGame(pending, 'a').decision,
    viewGame(noCard, 'a').decision,
  );
  assert.equal(
    viewGame(pending, 'a').players.find((p) => p.id === 'guild')!.hand,
    undefined,
  );
  assert.equal(p(pending, 'a').reserves, 20);
  const snapshot = reload(pending);
  for (const viewer of pending.players) viewGame(pending, viewer.id);
  assert.deepEqual(reload(pending), snapshot);
});
void test('a saved accompanying advisor choice remains bound to the completed Guild shipment event and beneficiary', () => {
  let g = trigger(enter(fixture('atreides', ['beneGesserit'])));
  g = ship(g, { amount: 2, territory: 'sietch_tabr', sector: 14 });
  assert.equal(g.decision?.kind, 'advisor');
  for (const corrupt of [
    (state: Game) => {
      state.pendingAmbassador!.event = 'other-event';
    },
    (state: Game) => {
      state.pendingAmbassador!.shipmentReceipt!.order.player = 'ec';
    },
    (state: Game) => {
      state.pendingAmbassador!.shipmentReceipt!.order.cost = 1 as 0;
    },
  ]) {
    const bad = reload(g);
    corrupt(bad);
    const before = reload(bad);
    assert.throws(() => viewGame(bad, 'beneGesserit'));
    assert.throws(() => normalizeAutomaticGame(bad));
    assert.throws(() =>
      applyAction(bad, 'beneGesserit', { type: 'decision', accept: false }),
    );
    assert.deepEqual(reload(bad), before);
  }
  const done = applyAction(reload(g), 'beneGesserit', {
    type: 'decision',
    accept: false,
  });
  assert.equal(p(done, 'a').forces['sietch_tabr:14'], 2);
  assert.equal(p(done, 'a').reserves, 18);
  settled(done);
});

void test('free off-planet shipment accrues Heighliner income once, with Guild-only shipment waiting for successful BG accompaniment', () => {
  for (const faction of ['atreides', 'guild'] as const) {
    const initial = fixture(faction, ['ixians', 'beneGesserit']);
    initial.techTokens = createTechTokens(initial.players);
    hold(initial, 'ec', 'Karama');
    let g = trigger(enter(initial));
    g = ship(g, { amount: 2, territory: 'wind_pass', sector: 14 });
    if (g.decision?.kind === 'guildShipment')
      g = applyAction(g, 'a', { type: 'decision', allow: true });
    assert.equal(g.decision?.kind, 'advisor');
    assert.equal(g.techTokens!.heighliners.spice, faction === 'guild' ? 0 : 1);
    assert.equal(p(g, 'ixians').spice, 20);
    g = applyAction(reload(g), 'beneGesserit', {
      type: 'decision',
      accept: true,
      accompany: true,
      sector: 15,
    });
    g = allow(reload(g));
    assert.equal(g.techTokens!.heighliners.spice, 1);
    assert.equal(g.techTokens!.heighliners.triggeredTurn, g.turn);
    assert.equal(p(g, 'ixians').spice, 20);
    assert.equal(p(g, 'a').spice, 20);
    settled(g);
  }
});

void test('accompanying BG fighters trigger a second Ambassador and preserve the original phase-five or worm continuation until that child completes', () => {
  for (const phase of [5, 1] as const) {
    const initial = fixture(
      'atreides',
      ['beneGesserit'],
      false,
      false,
      phase === 1 ? 'fremen' : 'emperor',
    );
    army(initial, 'beneGesserit', { 'sietch_tabr:14': 1 });
    army(initial, 'ec', { 'red_chasm:7': 1 });
    hold(initial, 'ec', 'Karama');
    const state = initial.ecazAmbassadors!,
      second = state.tokens.find((t) => t.effect === 'fremen')!;
    if (!state.cohort.includes(second.id)) {
      const displaced = state.tokens.find((t) => t.id === state.cohort.at(-1))!;
      displaced.zone = 'pool';
      state.cohort[state.cohort.length - 1] = second.id;
      second.zone = 'supply';
    }
    initial.ecazAmbassadors = placeAmbassador(state, second.id, {
      turn: 1,
      availableSpice: 20,
      destination: {
        id: 'sietch_tabr',
        stronghold: true,
        inStorm: false,
        allowed: true,
      },
    }).state;
    let g: Game;
    if (phase === 1) {
      Object.assign(initial, {
        phase: 1,
        active: null,
        nexus: false,
        wormRides: ['hagga_basin'],
        decision: {
          kind: 'wormRide',
          player: 'in',
          territory: 'imperial_basin',
        },
      });
      army(initial, 'in', { 'imperial_basin:10': 2, 'hagga_basin:12': 1 });
      g = applyAction(initial, 'in', {
        type: 'decision',
        accept: true,
        forces: { 'imperial_basin:10': 1 },
        territory: 'arrakeen',
        sector: 10,
      });
    } else g = enter(initial);
    const parentEvent = g.pendingAmbassador!.event;
    g = trigger(g);
    g = ship(g, { amount: 2, territory: 'sietch_tabr', sector: 14 });
    assert.equal(g.decision?.kind, 'intrusion');
    g = applyAction(reload(g), 'beneGesserit', {
      type: 'decision',
      accept: false,
    });
    assert.equal(g.decision?.kind, 'advisor');
    g = applyAction(reload(g), 'beneGesserit', {
      type: 'decision',
      accept: true,
      accompany: true,
    });
    assert.equal(g.response?.kind, 'advisor');
    assert.equal(g.pendingAmbassador?.event, parentEvent);
    g = allow(reload(g));
    assert.equal(g.pendingAmbassador?.stage, 'offer');
    assert.equal(g.pendingAmbassador?.token, second.id);
    assert.equal(g.pendingAmbassador?.entrant, 'beneGesserit');
    assert.notEqual(g.pendingAmbassador?.event, parentEvent);
    assert.equal(p(g, 'beneGesserit').advisors?.sietch_tabr, undefined);
    assert.equal(p(g, 'beneGesserit').forces['sietch_tabr:14'], 2);
    assert.equal(p(g, 'a').forces['sietch_tabr:14'], 2);
    assert.equal(g.decision?.kind, 'ecazAmbassador');
    if (phase === 1) assert.deepEqual(g.wormRides, ['hagga_basin']);
    g = trigger(reload(g), 'ec');
    assert.equal(g.pendingAmbassador?.stage, 'move');
    g = applyAction(g, 'ec', {
      type: 'decision',
      event: g.pendingAmbassador!.event,
      forces: { 'red_chasm:7': 1 },
      territory: 'carthag',
      sector: 11,
    });
    assert.equal(g.pendingAmbassador, null);
    assert.equal(p(g, 'ec').forces['carthag:11'], 1);
    assert.equal(p(g, 'ec').moved, 0);
    assert.equal(p(g, 'a').moved, 0);
    assert.equal(p(g, 'a').reserves, 18);
    assert.equal(p(g, 'beneGesserit').reserves, 18);
    assert.equal(
      g.ecazAmbassadors!.tokens.find((t) => t.effect === 'guild')!.zone,
      'used',
    );
    assert.equal(
      g.ecazAmbassadors!.tokens.find((t) => t.effect === 'fremen')!.zone,
      'used',
    );
    if (phase === 1) {
      assert.deepEqual(g.decision, {
        kind: 'wormRide',
        player: 'in',
        territory: 'hagga_basin',
      });
      assert.deepEqual(g.wormRides, []);
      conserve(g);
    } else settled(g);
  }
});
