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
import {
  createRicheseNoField,
  deployRicheseNoField,
} from '../game/richese-no-field';
import { createTerrorState, placeTerror } from '../game/moritani-terror';
import { MOBILE_LOCATION, MOBILE_STRONGHOLD } from '../game/board';

const p = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function fixture(
  faction: FactionId = 'fremen',
  extra: FactionId[] = [],
  copy = false,
  fifth = false,
  entrantFaction: FactionId = 'emperor',
) {
  const g = createGame('FAMBTEST', newPlayer('ec', 'Ecaz', 'ecaz'), true, [
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
    (t) => t.effect === (copy ? 'beneGesserit' : 'fremen'),
  )!;
  state.cohort = [
    token.id,
    ...state.tokens
      .filter(
        (t) =>
          t.effect !== 'ecaz' &&
          t.id !== token.id &&
          (!copy || t.effect !== 'fremen'),
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
      effect: 'fremen',
    });
  return out;
}
function move(g: Game, extra: Omit<Action, 'type'>, actor = 'a') {
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
      reserves: p.reserves,
      tanks: p.tanks,
    })),
    ornithopter: g.ornithopter,
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

void test('real entry grants a far, combined-sector typed group without ordinary movement consumption', () => {
  const initial = fixture();
  army(initial, 'a', { 'wind_pass:14': 3, 'wind_pass:15': 2 });
  p(initial, 'a').elites = {
    forces: { 'wind_pass:14': 1, 'wind_pass:15': 1 },
    reserves: 1,
    tanks: 0,
    revived: 0,
  };
  p(initial, 'a').moved = 1;
  p(initial, 'a').shipped = true;
  const g = trigger(enter(initial)),
    before = bookkeeping(g),
    ids = conserve(g),
    event = g.pendingAmbassador!.event;
  assert.equal(g.decision?.player, 'a');
  assert.ok(viewGame(g, 'a').ambassadorEntry?.movement?.sources.length);
  for (const id of ['ec', 'in'])
    assert.equal(viewGame(g, id).ambassadorEntry?.movement, null);
  const action: Action = {
    type: 'decision',
    event,
    forces: { 'wind_pass:14': 2, 'wind_pass:15': 1 },
    eliteForces: { 'wind_pass:14': 1, 'wind_pass:15': 0 },
    territory: 'sietch_tabr',
    sector: 14,
  };
  reject(g, action, 'ec');
  reject(g, { ...action, event: 'stale' });
  reject(g, { ...action, eliteForces: { 'wind_pass:14': 3 } });
  const done = applyAction(reload(g), 'a', action);
  assert.deepEqual(p(done, 'a').forces, {
    'wind_pass:14': 1,
    'wind_pass:15': 1,
    'sietch_tabr:14': 3,
  });
  assert.equal(p(done, 'a').elites!.forces['sietch_tabr:14'], 1);
  assert.equal(p(done, 'a').elites!.forces['wind_pass:15'], 1);
  assert.deepEqual(bookkeeping(done), before);
  assert.deepEqual(conserve(done), ids);
  settled(done);
  reject(done, action);
});
void test('same-territory redistribution permits Ecaz allied occupancy and clear sectors without an entry reaction', () => {
  const initial = fixture('atreides', ['beneGesserit']);
  army(initial, 'a', { 'wind_pass:14': 2, 'wind_pass:15': 1 });
  army(initial, 'ec', { 'wind_pass:14': 1 });
  army(initial, 'beneGesserit', { 'wind_pass:14': 1 });
  initial.storm = 15;
  const g = trigger(enter(initial));
  reject(g, {
    type: 'decision',
    event: g.pendingAmbassador!.event,
    forces: { 'wind_pass:15': 1 },
    territory: 'sietch_tabr',
    sector: 14,
  });
  const done = move(g, {
    forces: { 'wind_pass:14': 1 },
    territory: 'wind_pass',
    sector: 16,
  });
  assert.equal(p(done, 'a').forces['wind_pass:16'], 1);
  assert.equal(p(done, 'a').forces['wind_pass:15'], 1);
  settled(done);
});
void test('a fifth-cohort BG copy replenishes only after the selected relocation and empty armies finish without a new veto', () => {
  const initial = fixture('atreides', [], true, true);
  army(initial, 'a', { 'red_chasm:7': 2 });
  const g = trigger(enter(initial), 'a', true);
  assert.equal(g.pendingAmbassador?.effect, 'fremen');
  const cohort = [...g.ecazAmbassadors!.cohort];
  assert.ok(
    g.ecazAmbassadors!.tokens.some(
      (t) => t.effect === 'beneGesserit' && t.zone === 'removed',
    ),
  );
  const done = move(g, {
    forces: { 'red_chasm:7': 1 },
    territory: 'sietch_tabr',
    sector: 14,
  });
  assert.notDeepEqual(done.ecazAmbassadors!.cohort, cohort);
  settled(done);
  const empty = trigger(enter(fixture('atreides')));
  settled(empty);
  assert.ok(
    empty.ecazAmbassadors!.tokens.some(
      (t) => t.effect === 'fremen' && t.zone === 'used',
    ),
  );
});
void test('marker-only zero and nonzero No-Fields enter the real HMS interior without revealing or moving reserves', () => {
  for (const value of [0, 3, 5] as const) {
    const initial = fixture('richese', ['ixians']);
    initial.mobileStronghold = { location: 'wind_pass:14' };
    p(initial, 'a').noField = deployRicheseNoField(
      createRicheseNoField(['nf0', 'nf3', 'nf5']),
      {
        tokenId: `nf${value}`,
        controller: 'a',
        location: { territory: 'wind_pass', sector: 15 },
      },
    );
    p(initial, 'a').noFieldEvent = 'marker-event';
    const g = trigger(enter(initial));
    const old = reload(g).players.find((p) => p.id === 'a')!;
    const noField = { tokenId: `nf${value}`, event: 'marker-event' };
    reject(g, {
      type: 'decision',
      event: g.pendingAmbassador!.event,
      forces: {},
      noField: { ...noField, event: g.pendingAmbassador!.event },
      territory: MOBILE_STRONGHOLD,
      sector: 0,
    });
    const done = move(reload(g), {
      forces: {},
      noField,
      territory: MOBILE_STRONGHOLD,
      sector: 0,
    });
    assert.deepEqual(p(done, 'a').noField!.deployed!.location, {
      territory: MOBILE_STRONGHOLD,
      sector: 0,
    });
    assert.equal(p(done, 'a').reserves, old.reserves);
    assert.deepEqual(p(done, 'a').forces, {});
    assert.notEqual(p(done, 'a').noFieldEvent, old.noFieldEvent);
    assert.deepEqual(done.mobileStronghold, g.mobileStronghold);
    settled(done);
    assert.equal(Object.keys(p(done, 'ixians').forces).length, 0);
    assert.equal(MOBILE_LOCATION, `${MOBILE_STRONGHOLD}:0`);
  }
});
void test('CHOAM may permit the independent move, or Baliset blocks it and leaves a legal re-selection', () => {
  for (const block of [false, true]) {
    const initial = fixture('atreides', ['choam']);
    army(initial, 'a', { 'red_chasm:7': 3 });
    army(initial, 'choam', { 'sietch_tabr:14': 1 });
    const baliset = hold(initial, 'choam', 'Baliset');
    hold(initial, 'a', 'Karama');
    let g = trigger(enter(initial));
    const before = bookkeeping(g);
    g = move(g, {
      forces: { 'red_chasm:7': 2 },
      territory: 'sietch_tabr',
      sector: 14,
    });
    assert.equal(g.decision?.kind, 'choamMovement');
    assert.equal(g.pendingChoamMove?.source, 'ambassador');
    assert.equal(p(g, 'a').forces['red_chasm:7'], 3);
    if (block) {
      g = applyAction(g, 'choam', {
        type: 'card',
        card: baliset,
        mode: 'choam',
        target: 'a',
        territory: 'sietch_tabr',
      });
      g = allow(reload(g));
      assert.equal(g.pendingAmbassador?.stage, 'move');
      assert.equal(p(g, 'a').forces['red_chasm:7'], 3);
      reject(g, {
        type: 'decision',
        event: g.pendingAmbassador!.event,
        forces: { 'red_chasm:7': 2 },
        territory: 'sietch_tabr',
        sector: 14,
      });
      g = move(g, {
        forces: { 'red_chasm:7': 2 },
        territory: 'wind_pass',
        sector: 14,
      });
      assert.equal(g.discard.filter((c) => c.id === baliset).length, 1);
    } else {
      g = applyAction(reload(g), 'choam', { type: 'decision', decline: true });
      assert.equal(p(g, 'a').forces['sietch_tabr:14'], 2);
    }
    assert.deepEqual(bookkeeping(g), before);
    settled(g);
  }
});
void test('printed cancellation of Baliset restores the declared typed relocation exactly once', () => {
  const initial = fixture('fremen', ['choam']);
  army(initial, 'a', { 'red_chasm:7': 3 });
  p(initial, 'a').elites = {
    forces: { 'red_chasm:7': 2 },
    reserves: 1,
    tanks: 0,
    revived: 0,
  };
  army(initial, 'choam', { 'sietch_tabr:14': 1 });
  const baliset = hold(initial, 'choam', 'Baliset'),
    karama = hold(initial, 'a', 'Karama');
  let g = trigger(enter(initial));
  g = move(g, {
    forces: { 'red_chasm:7': 2 },
    eliteForces: { 'red_chasm:7': 1 },
    territory: 'sietch_tabr',
    sector: 14,
  });
  g = applyAction(g, 'choam', {
    type: 'card',
    card: baliset,
    mode: 'choam',
    target: 'a',
    territory: 'sietch_tabr',
  });
  g = applyAction(reload(g), 'a', {
    type: 'card',
    card: karama,
    mode: 'cancel',
  });
  assert.equal(p(g, 'a').forces['sietch_tabr:14'], 2);
  assert.equal(p(g, 'a').elites!.forces['sietch_tabr:14'], 1);
  assert.equal(p(g, 'a').moved, 0);
  assert.ok(p(g, 'choam').hand.some((c) => c.id === baliset));
  assert.equal(g.discard.filter((c) => c.id === karama).length, 1);
  settled(g);
});
void test('BG Intrusion is a durable child of the relocation and does not resume the entrant prematurely', () => {
  const initial = fixture('atreides', ['beneGesserit']);
  army(initial, 'a', { 'red_chasm:7': 2 });
  army(initial, 'beneGesserit', { 'sietch_tabr:14': 1 });
  hold(initial, 'a', 'Karama');
  let g = trigger(enter(initial));
  const before = bookkeeping(g);
  g = move(g, {
    forces: { 'red_chasm:7': 1 },
    territory: 'sietch_tabr',
    sector: 14,
  });
  assert.equal(g.decision?.kind, 'intrusion');
  assert.equal(g.pendingAmbassador?.stage, 'arrival');
  const event = g.pendingAmbassador!.event;
  reject(g, { type: 'endMovement' }, 'in');
  g = applyAction(reload(g), 'beneGesserit', {
    type: 'decision',
    accept: true,
  });
  assert.equal(g.response?.kind, 'advisorFlip');
  assert.equal(g.pendingAmbassador?.event, event);
  g = allow(reload(g));
  assert.ok(p(g, 'beneGesserit').advisors?.sietch_tabr);
  assert.deepEqual(bookkeeping(g), before);
  settled(g);
});
void test('a separate Terror child can finish after relocation; simultaneous Intrusion plus Terror rejects before transfer', () => {
  for (const simultaneous of [false, true]) {
    const initial = fixture(
      'atreides',
      simultaneous ? ['moritani', 'beneGesserit'] : ['moritani'],
    );
    army(initial, 'a', { 'red_chasm:7': 2 });
    if (simultaneous) army(initial, 'beneGesserit', { 'sietch_tabr:14': 1 });
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
    const g = trigger(enter(initial));
    const action: Action = {
      type: 'decision',
      event: g.pendingAmbassador!.event,
      forces: { 'red_chasm:7': 1 },
      territory: 'sietch_tabr',
      sector: 14,
    };
    if (simultaneous) {
      reject(g, action);
      continue;
    }
    let child = applyAction(g, 'a', action);
    assert.equal(child.pendingTerrorEntry?.cause, 'ambassador');
    assert.equal(child.pendingTerrorEntry?.entrant, 'a');
    assert.equal(child.pendingAmbassador?.stage, 'arrival');
    assert.equal('kind' in viewGame(child, 'a').terrorEntry!, false);
    assert.equal(viewGame(child, 'moritani').terrorEntry?.kind, 'sabotage');
    child = applyAction(reload(child), 'moritani', {
      type: 'decision',
      decline: true,
    });
    assert.equal(child.pendingTerrorEntry, null);
    assert.equal(p(child, 'a').forces['sietch_tabr:14'], 1);
    settled(child);
  }
});

void test('phase-one advisor relocation permits a native flip and resumes the next genuine worm ride only after the response', () => {
  for (const cancel of [false, true]) {
    const initial = fixture(
      'beneGesserit',
      ['atreides'],
      true,
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
    army(initial, 'a', { 'red_chasm:7': 2 });
    army(initial, 'atreides', { 'red_chasm:7': 1, 'sietch_tabr:14': 1 });
    p(initial, 'a').advisors = { red_chasm: {} };
    const karama = hold(initial, 'ec', 'Karama');
    let g = applyAction(initial, 'in', {
      type: 'decision',
      accept: true,
      territory: 'arrakeen',
      sector: 10,
      forces: { 'imperial_basin:10': 1 },
    });
    if (g.response) g = allow(g);
    assert.equal(g.pendingAmbassador?.resume, 'wormRide');
    g = trigger(g, 'a', true);
    const event = g.pendingAmbassador!.event;
    g = move(g, {
      forces: { 'red_chasm:7': 1 },
      territory: 'sietch_tabr',
      sector: 14,
      fighters: true,
    });
    assert.equal(g.response?.kind, 'advisorFlip');
    assert.equal(g.response?.advisorResume, 'ambassador');
    assert.equal(g.pendingAmbassador?.event, event);
    assert.ok(p(g, 'a').advisors?.sietch_tabr);
    assert.deepEqual(g.wormRides, ['hagga_basin']);
    g = cancel
      ? applyAction(reload(g), 'ec', {
          type: 'card',
          card: karama,
          mode: 'cancel',
        })
      : allow(reload(g));
    assert.equal(!!p(g, 'a').advisors?.sietch_tabr, cancel);
    assert.equal(g.pendingAmbassador, null);
    assert.deepEqual(g.decision, {
      kind: 'wormRide',
      player: 'in',
      territory: 'hagga_basin',
    });
    assert.deepEqual(g.wormRides, []);
    assert.equal(p(g, 'a').moved, 0);
    assert.equal(p(g, 'in').forces['arrakeen:10'], 1);
    conserve(g);
    assert.deepEqual(normalizeAutomaticGame(reload(g)), reload(g));
  }
});
void test('Sabotage revealed after relocation discards once and restores the Ambassador only after its optional gift', () => {
  const initial = fixture('atreides', ['moritani']);
  army(initial, 'a', { 'red_chasm:7': 2 });
  initial.moritaniTerror = createTerrorState(() => 0);
  const terror = initial.moritaniTerror.tokens.find(
    (t) => t.kind === 'sabotage',
  )!;
  initial.moritaniTerror = placeTerror(
    initial.moritaniTerror,
    terror.id,
    'sietch_tabr',
    1,
  );
  const victim = hold(initial, 'a', 'Shield'),
    gift = hold(initial, 'moritani', 'Snooper');
  const ids = conserve(initial);
  let g = trigger(enter(initial));
  const event = g.pendingAmbassador!.event;
  g = move(g, {
    forces: { 'red_chasm:7': 1 },
    territory: 'sietch_tabr',
    sector: 14,
  });
  g = applyAction(g, 'moritani', { type: 'decision', reveal: true });
  assert.equal(g.pendingTerrorEntry?.stage, 'gift');
  assert.equal(g.pendingAmbassador?.event, event);
  assert.equal(g.discard.filter((c) => c.id === victim).length, 1);
  for (const viewer of ['ec', 'in'])
    assert.ok(!JSON.stringify(viewGame(g, viewer).log).includes(victim));
  const saved = reload(g);
  reject(g, { type: 'decision', reveal: true }, 'moritani');
  g = applyAction(saved, 'moritani', { type: 'decision', card: gift });
  assert.ok(p(g, 'a').hand.some((c) => c.id === gift));
  assert.equal(g.pendingTerrorEntry, null);
  assert.equal(g.discard.filter((c) => c.id === victim).length, 1);
  assert.equal(p(g, 'a').forces['sietch_tabr:14'], 1);
  assert.deepEqual(conserve(g), ids);
  settled(g);
});

void test('the original entrants played two-group Ornithopter retains exact unmoved cohort through an ally relocation', () => {
  const initial = fixture('atreides');
  army(initial, 'a', { 'red_chasm:7': 2 });
  army(initial, 'in', { 'imperial_basin:10': 2 });
  initial.richeseCache = richeseCards();
  const index = initial.richeseCache.findIndex(
    (c) => c.effect === 'ornithopter',
  );
  const card = initial.richeseCache.splice(index, 1)[0];
  assert.ok(card);
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
  assert.equal(g.pendingAmbassador?.stage, 'offer');
  assert.equal(g.ornithopter?.completed, 1);
  const flight = reload(g).ornithopter!;
  g = trigger(g);
  g = move(reload(g), {
    forces: { 'red_chasm:7': 1 },
    territory: 'sietch_tabr',
    sector: 14,
  });
  assert.deepEqual(g.ornithopter, flight);
  assert.equal(g.pendingAmbassador, null);
  assert.equal(p(g, 'in').moved, 1);
  assert.equal(p(g, 'a').moved, 0);
  g = applyAction(reload(g), 'in', {
    type: 'move',
    forces: { 'imperial_basin:10': 1 },
    territory: 'arrakeen',
    sector: 10,
    ornithopterEvent: flight.event,
  });
  assert.equal(g.ornithopter, null);
  assert.equal(p(g, 'in').moved, 2);
  assert.equal(p(g, 'in').forces['arrakeen:10'], 2);
  assert.equal(g.discard.filter((c) => c.id === card.id).length, 1);
  assert.deepEqual(conserve(g), ids);
  settled(g);
});
void test('a summoned worm removing the last legal group completes the already committed relocation and defers remaining rides to Nexus', () => {
  const initial = fixture('atreides', [], true, false, 'fremen');
  Object.assign(initial, {
    phase: 1,
    active: null,
    nexus: false,
    wormRides: ['hagga_basin'],
    decision: { kind: 'wormRide', player: 'in', territory: 'imperial_basin' },
  });
  army(initial, 'in', { 'imperial_basin:10': 2, 'hagga_basin:12': 1 });
  army(initial, 'a', { 'red_chasm:7': 2 });
  const karama = hold(initial, 'in', 'Karama');
  let g = applyAction(initial, 'in', {
    type: 'decision',
    accept: true,
    territory: 'arrakeen',
    sector: 10,
    forces: { 'imperial_basin:10': 1 },
  });
  g = trigger(g, 'a', true);
  assert.equal(g.pendingAmbassador?.stage, 'move');
  assert.ok(viewGame(g, 'a').ambassadorEntry?.movement?.sources.length);
  g = applyAction(reload(g), 'in', {
    type: 'card',
    card: karama,
    mode: 'special',
    territory: 'red_chasm',
  });
  assert.equal(g.summonedWorm, null);
  assert.equal(p(g, 'a').tanks, 2);
  assert.equal(p(g, 'a').forces['red_chasm:7'] ?? 0, 0);
  assert.equal(p(g, 'a').moved, 0);
  assert.equal(g.pendingAmbassador, null);
  assert.equal(g.decision, null);
  assert.equal(g.nexus, true);
  assert.deepEqual(g.wormRides, ['hagga_basin']);
  assert.equal(g.discard.filter((c) => c.id === karama).length, 1);
  assert.equal(p(g, 'in').specialKaramaUsed, true);
  conserve(g);
  assert.deepEqual(normalizeAutomaticGame(reload(g)), reload(g));
});

void test('Ecaz Occupy permits its unlocked BG ally to choose fighters beside Ecaz while accompaniment locks remain enforced', () => {
  for (const locked of [false, true]) {
    const initial = fixture('beneGesserit', ['atreides']);
    army(initial, 'a', { 'red_chasm:7': 2 });
    army(initial, 'ec', { 'red_chasm:7': 1, 'sietch_tabr:14': 1 });
    army(initial, 'atreides', { 'sietch_tabr:14': 1 });
    p(initial, 'a').advisors = {
      red_chasm: locked ? { lockedTurn: initial.turn } : {},
    };
    hold(initial, 'in', 'Karama');
    const g = trigger(enter(initial));
    const action: Action = {
      type: 'decision',
      event: g.pendingAmbassador!.event,
      forces: { 'red_chasm:7': 1 },
      territory: 'sietch_tabr',
      sector: 14,
      fighters: true,
    };
    if (locked) {
      reject(g, action);
      const advisors = move(g, { ...action, fighters: false });
      assert.ok(p(advisors, 'a').advisors?.sietch_tabr);
      assert.equal(
        p(advisors, 'a').advisors!.sietch_tabr.lockedTurn,
        initial.turn,
      );
      settled(advisors);
      continue;
    }
    let done = applyAction(reload(g), 'a', action);
    assert.equal(done.response?.kind, 'advisorFlip');
    done = allow(reload(done));
    assert.equal(p(done, 'a').advisors?.sietch_tabr, undefined);
    assert.equal(p(done, 'a').forces['sietch_tabr:14'], 1);
    assert.equal(p(done, 'ec').forces['sietch_tabr:14'], 1);
    assert.equal(p(done, 'atreides').forces['sietch_tabr:14'], 1);
    settled(done);
  }
});
