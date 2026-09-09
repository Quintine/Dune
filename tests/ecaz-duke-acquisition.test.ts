import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  RuleError,
  type Game,
  type Action,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import {
  createDukeVidal,
  acquireDuke,
  DUKE_VIDAL_ID,
} from '../game/duke-vidal';
import { createAmbassadors, placeAmbassador } from '../game/ecaz-ambassadors';
import {
  quoteEcazDukeAcquisition,
  ecazDukeAcquisitionBlock,
  EcazDukeAcquisitionError,
} from '../game/ecaz-duke-acquisition';
import type { FactionId } from '../game/catalog';
const p = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function fixture(entrant: FactionId = 'emperor', advanced = false) {
  const g = createGame('ECAZDUKE', newPlayer('ec', 'Ecaz', 'ecaz'), advanced, [
    'ecaz',
  ]);
  g.players.push(
    newPlayer('in', 'Entrant', entrant),
    newPlayer('al', 'Ally', 'atreides'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    storm: 18,
    active: 'in',
    order: ['in', 'ec', 'al'],
    movementRemaining: ['in', 'ec', 'al'],
    deck: baseDeck(),
    dukeVidal: createDukeVidal(),
  });
  for (const s of g.players)
    Object.assign(s, {
      forces: {},
      reserves: 20,
      spice: 20,
      hand: [],
      traitors: [],
      traitorChoices: [],
    });
  const inventory = createAmbassadors(() => 0),
    token = inventory.tokens.find((t) => t.effect === 'ecaz')!;
  g.ecazAmbassadors = placeAmbassador(inventory, token.id, {
    turn: 1,
    availableSpice: 20,
    destination: {
      id: 'arrakeen',
      stronghold: true,
      inStorm: false,
      allowed: true,
    },
  }).state;
  return g;
}
const enter = (g = fixture()) =>
  applyAction(g, 'in', {
    type: 'ship',
    territory: 'arrakeen',
    sector: 10,
    amount: 2,
  });
function command(g: Game): Action {
  return {
    type: 'decision',
    event: g.pendingAmbassador!.event,
    trigger: true,
    beneficiary: 'ec',
    choice: 'duke',
  };
}
const acquire = (g: Game) => applyAction(g, 'ec', command(g));
function reject(g: Game, id: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, id, action), RuleError);
  assert.deepEqual(g, before);
}
function responses(g: Game) {
  for (let n = 0; g.response && n < 30; n++)
    g = applyAction(
      g,
      g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
      { type: 'passResponse' },
    );
  assert.equal(g.response, null);
  return g;
}

void test('pure Ecaz acquisition preserves the exact shared physical disc, history and prior use while transferring custody', () => {
  const g = fixture('moritani', true);
  g.dukeVidal = acquireDuke(g.dukeVidal!, 'in', 1, 'moritani');
  g.dukeVidal.leader.deaths = 2;
  g.dukeVidal.leader.usedAt = 'carthag';
  const before = structuredClone(g),
    originalRandom = Math.random;
  let quoted;
  try {
    Math.random = () => {
      throw new Error('acquisition quote must not sample');
    };
    quoted = quoteEcazDukeAcquisition(g, 'ec');
  } finally {
    Math.random = originalRandom;
  }
  assert.deepEqual(quoted, {
    ...g.dukeVidal,
    controller: 'ec',
    acquiredTurn: 2,
    source: 'ecaz',
  });
  assert.deepEqual(quoted.leader, g.dukeVidal.leader);
  assert.deepEqual(g, before);
  quoted.leader.deaths = 99;
  assert.deepEqual(g, before);
  assert.equal(ecazDukeAcquisitionBlock(g, 'ec'), null);
});
void test('pure source/canonical identity/custody checks reject safely, with one generic exceptional-custody reason', () => {
  const base = fixture();
  const reasons = new Set<string | null>();
  for (const change of [
    (g: Game) => {
      delete g.dukeVidal;
    },
    (g: Game) => {
      g.dukeVidal!.leader.dead = true;
    },
    (g: Game) => {
      g.dukeVidal!.leader.capturedBy = 'in';
    },
    (g: Game) => {
      g.dukeVidal!.leader.gholaBy = 'in';
    },
    (g: Game) => {
      g.dukeVidal!.leader.id = 'forged';
    },
    (g: Game) => {
      g.dukeVidal!.leader.strength = 5;
    },
    (g: Game) => {
      g.dukeVidal!.leader.deaths = -1;
    },
    (g: Game) => {
      g.dukeVidal!.controller = 'absent';
    },
    (g: Game) => {
      g.dukeVidal!.acquiredTurn = 3;
    },
  ]) {
    const bad = reload(base);
    change(bad);
    const before = structuredClone(bad);
    assert.throws(
      () => quoteEcazDukeAcquisition(bad, 'ec'),
      EcazDukeAcquisitionError,
    );
    reasons.add(ecazDukeAcquisitionBlock(bad, 'ec'));
    assert.deepEqual(bad, before);
  }
  assert.deepEqual(
    [...reasons],
    ['Duke Vidal is unavailable for this acquisition.'],
  );
  assert.throws(
    () => quoteEcazDukeAcquisition(base, 'in'),
    EcazDukeAcquisitionError,
  );
  base.status = 'setup';
  assert.throws(
    () => quoteEcazDukeAcquisition(base, 'ec'),
    EcazDukeAcquisitionError,
  );
});
void test('same-owner and Advanced Harkonnen cases remain explicitly unfinished without private reason variation', () => {
  const own = fixture();
  own.dukeVidal = acquireDuke(own.dukeVidal!, 'ec', 1, 'ecaz');
  const reason = ecazDukeAcquisitionBlock(own, 'ec');
  assert.match(reason!, /still being implemented/);
  own.dukeVidal.leader.capturedBy = 'in';
  assert.equal(ecazDukeAcquisitionBlock(own, 'ec'), reason);
  const hark = fixture('harkonnen', true);
  const blocked = ecazDukeAcquisitionBlock(hark, 'ec');
  assert.match(blocked!, /Advanced Harkonnen/);
  hark.dukeVidal!.leader.capturedBy = 'in';
  assert.equal(ecazDukeAcquisitionBlock(hark, 'ec'), blocked);
  const basic = fixture('harkonnen', false);
  assert.equal(ecazDukeAcquisitionBlock(basic, 'ec'), null);
});
void test('actual paid shipment to the reusable Ecaz Ambassador acquires once and resumes exact ordinary counters', () => {
  for (const advanced of [false, true]) {
    const initial = fixture('emperor', advanced);
    p(initial, 'ec').ally = 'al';
    p(initial, 'al').ally = 'ec';
    initial.dukeVidal!.leader.deaths = 2;
    const g = enter(initial),
      before = reload(g),
      cohort = [...g.ecazAmbassadors!.cohort];
    assert.deepEqual(viewGame(g, 'ec').ambassadorEntry!.dukeAcquisition, {
      blocked: null,
    });
    assert.equal(viewGame(g, 'in').ambassadorEntry!.dukeAcquisition, null);
    const act = command(g),
      done = applyAction(reload(g), 'ec', act);
    assert.deepEqual(g, before);
    assert.equal(done.pendingAmbassador, null);
    assert.equal(done.decision, null);
    assert.equal(done.dukeVidal!.controller, 'ec');
    assert.equal(done.dukeVidal!.source, 'ecaz');
    assert.equal(done.dukeVidal!.leader.deaths, 2);
    assert.deepEqual(done.ecazAmbassadors!.cohort, cohort);
    assert.deepEqual(
      done.ecazAmbassadors!.tokens.find((t) => t.effect === 'ecaz'),
      {
        id: g.pendingAmbassador!.token,
        effect: 'ecaz',
        zone: 'supply',
        location: null,
      },
    );
    assert.deepEqual(done.players, g.players);
    assert.equal(p(done, 'in').spice, 18);
    assert.equal(p(done, 'in').reserves, 18);
    assert.equal(p(done, 'in').shipped, true);
    assert.equal(p(done, 'in').moved, 0);
    assert.equal(done.active, 'in');
    assert.deepEqual(done.movementRemaining, g.movementRemaining);
    assert.deepEqual(done.deck, g.deck);
    assert.ok(
      done.players.every(
        (p) =>
          !p.leaders.some((l) => l.id === DUKE_VIDAL_ID) &&
          !p.traitors.includes(DUKE_VIDAL_ID),
      ),
    );
    reject(done, 'ec', act);
  }
});
void test('Moritani movement entry transfers its existing Duke to Ecaz without replaying movement', () => {
  const initial = fixture('moritani');
  initial.dukeVidal = acquireDuke(initial.dukeVidal!, 'in', 1, 'moritani');
  p(initial, 'in').forces = { 'imperial_basin:10': 3 };
  p(initial, 'in').reserves = 17;
  p(initial, 'in').shipped = true;
  const g = applyAction(initial, 'in', {
    type: 'move',
    forces: { 'imperial_basin:10': 2 },
    territory: 'arrakeen',
    sector: 10,
    amount: 2,
  });
  assert.equal(g.pendingAmbassador?.entrant, 'in');
  const before = reload(g),
    done = acquire(reload(g));
  assert.equal(done.dukeVidal!.controller, 'ec');
  assert.deepEqual(done.players, before.players);
  assert.equal(p(done, 'in').moved, 1);
  assert.equal(p(done, 'in').forces['arrakeen:10'], 2);
  assert.equal(p(done, 'in').forces['imperial_basin:10'], 1);
  assert.equal(done.active, 'in');
});
void test('explicit Duke choice/owner/event and eligibility are checked before triggering the token', () => {
  const g = enter();
  const action = command(g);
  reject(g, 'in', action);
  reject(g, 'ec', { ...action, event: 'stale' });
  reject(g, 'ec', { ...action, choice: undefined });
  reject(g, 'ec', { ...action, choice: 'loan' });
  const allied = reload(g);
  p(allied, 'ec').ally = 'al';
  p(allied, 'al').ally = 'ec';
  reject(allied, 'ec', { ...action, beneficiary: 'al' });
  for (const mutate of [
    (b: Game) => {
      delete b.dukeVidal;
    },
    (b: Game) => {
      b.dukeVidal!.leader.dead = true;
    },
    (b: Game) => {
      b.dukeVidal!.leader.capturedBy = 'in';
    },
    (b: Game) => {
      b.dukeVidal!.leader.gholaBy = 'in';
    },
    (b: Game) => {
      b.dukeVidal = acquireDuke(b.dukeVidal!, 'ec', 1, 'ecaz');
    },
    (b: Game) => {
      b.advanced = true;
      p(b, 'in').faction = 'harkonnen';
    },
  ]) {
    const bad = reload(g);
    mutate(bad);
    assert.ok(viewGame(bad, 'ec').ambassadorEntry!.dukeAcquisition!.blocked);
    reject(bad, 'ec', action);
    const done = applyAction(bad, 'ec', {
      type: 'decision',
      event: bad.pendingAmbassador!.event,
      decline: true,
    });
    assert.deepEqual(done.dukeVidal, bad.dukeVidal);
    assert.deepEqual(done.ecazAmbassadors, bad.ecazAmbassadors);
    assert.equal(done.pendingAmbassador, null);
  }
});
void test('Ecaz trigger never replenishes or shuffles a completed random cohort and does not disclose private hands', () => {
  const initial = fixture();
  for (const token of initial.ecazAmbassadors!.tokens)
    if (initial.ecazAmbassadors!.cohort.includes(token.id))
      token.zone = token.effect === 'beneGesserit' ? 'removed' : 'used';
  const g = enter(initial),
    cohort = structuredClone(g.ecazAmbassadors!.cohort),
    before = reload(g);
  const perturbed = reload(g);
  p(perturbed, 'in').hand = perturbed.deck.splice(0, 3);
  p(perturbed, 'al').traitors = ['emperor-1'];
  assert.deepEqual(
    viewGame(g, 'ec').ambassadorEntry,
    viewGame(perturbed, 'ec').ambassadorEntry,
  );
  for (const id of ['in', 'al'])
    assert.deepEqual(
      viewGame(g, id).ambassadorEntry,
      viewGame(perturbed, id).ambassadorEntry,
    );
  const done = acquire(g);
  assert.deepEqual(g, before);
  assert.deepEqual(done.ecazAmbassadors!.cohort, cohort);
  assert.deepEqual(
    done.ecazAmbassadors!.tokens.filter((t) => t.effect !== 'ecaz'),
    g.ecazAmbassadors!.tokens.filter((t) => t.effect !== 'ecaz'),
  );
  assert.deepEqual(done.deck, g.deck);
  assert.equal(
    done.log.filter((l) => l.text.includes('drew a new supply')).length,
    g.log.filter((l) => l.text.includes('drew a new supply')).length,
  );
});
void test('actual Fremen worm ride interruption resumes the remaining ride once after Duke acquisition', () => {
  let g = fixture('fremen', true);
  Object.assign(g, {
    phase: 1,
    active: null,
    nexus: false,
    wormRides: ['hagga_basin'],
    decision: { kind: 'wormRide', player: 'in', territory: 'imperial_basin' },
  });
  p(g, 'in').forces = { 'imperial_basin:10': 3, 'hagga_basin:11': 1 };
  p(g, 'in').reserves = 16;
  g = applyAction(g, 'in', {
    type: 'decision',
    accept: true,
    territory: 'arrakeen',
    sector: 10,
    forces: { 'imperial_basin:10': 2 },
  });
  assert.equal(g.pendingAmbassador?.resume, 'wormRide');
  const before = reload(g),
    done = acquire(reload(g));
  assert.equal(done.phase, 1);
  assert.deepEqual(done.decision, {
    kind: 'wormRide',
    player: 'in',
    territory: 'hagga_basin',
  });
  assert.deepEqual(done.players, before.players);
  assert.deepEqual(done.wormRides, []);
  assert.equal(done.dukeVidal!.controller, 'ec');
  reject(done, 'ec', command(before));
});
function completeMovement(g: Game) {
  for (let n = 0; g.phase === 5 && n < 10; n++) {
    assert.ok(g.active);
    g = applyAction(g, g.active, { type: 'endMovement' });
    g = responses(g);
  }
  assert.equal(g.phase, 6);
  return g;
}
void test('an acquired Duke is usable in a genuine following battle, then the same disc is consumed after death', () => {
  const initial = fixture();
  p(initial, 'ec').forces = { 'arrakeen:10': 1 };
  p(initial, 'ec').reserves = 19;
  const at = initial.deck.findIndex((c) => c.kind === 'poison');
  p(initial, 'in').hand = [initial.deck.splice(at, 1)[0]];
  let g = completeMovement(acquire(enter(initial)));
  g = applyAction(g, 'in', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'ec',
  });
  g = responses(g);
  for (let n = 0; g.battle?.preparation && n < 8; n++) {
    g = applyAction(g, g.battle.preparation.owner, {
      type: 'declineBattlePower',
    });
    g = responses(g);
  }
  g = applyAction(g, 'in', {
    type: 'battlePlan',
    dial: 0,
    leader: p(g, 'in').leaders.at(-1)!.id,
    weapon: p(g, 'in').hand[0].id,
  });
  g = applyAction(g, 'ec', {
    type: 'battlePlan',
    dial: 0,
    leader: DUKE_VIDAL_ID,
  });
  assert.equal(g.dukeVidal!.controller, 'ec');
  g = applyAction(g, 'in', { type: 'traitorCall', call: false });
  g = applyAction(g, 'ec', { type: 'traitorCall', call: false });
  assert.equal(g.dukeVidal!.leader.dead, true);
  assert.equal(g.dukeVidal!.leader.deaths, 1);
  assert.equal(g.dukeVidal!.controller, null);
  assert.equal(g.dukeVidal!.leader.id, DUKE_VIDAL_ID);
  assert.equal(p(g, 'in').spice, 24);
  assert.ok(p(g, 'ec').leaders.every((l) => !l.dead));
});
void test('unused source-Ecaz custody persists through a genuine end of turn without manufacturing another disc', () => {
  let g = acquire(enter());
  const original = structuredClone(g.dukeVidal!);
  for (let n = 0; g.turn === 2 && n < 40; n++) {
    g = responses(g);
    if (g.phase === 5) {
      assert.ok(g.active);
      g = applyAction(g, g.active, { type: 'endMovement' });
    } else if (g.decision?.kind === 'ecazPlacement')
      g = applyAction(g, g.decision.player, {
        type: 'decision',
        decline: true,
      });
    else if (g.decision?.kind === 'choamMarket')
      g = applyAction(g, g.decision.player, { type: 'decision', done: true });
    else {
      const next = g.players.find((p) => !g.ready.includes(p.id));
      assert.ok(next);
      g = applyAction(g, next.id, { type: 'ready' });
    }
  }
  assert.equal(g.turn, 3);
  assert.deepEqual(g.dukeVidal, original);
  assert.ok(
    g.players.every((p) => !p.leaders.some((l) => l.id === DUKE_VIDAL_ID)),
  );
});

void test('concealed custody always projects one unavailable descriptor regardless of private live fields', () => {
  const entered = enter();
  entered.dukeVidal!.leader.concealed = {
    captor: 'in',
    controller: 'ec',
    dead: false,
    deaths: 0,
  };
  const descriptors: ({ blocked: string | null } | null)[] = [];
  for (const captured of [false, true])
    for (const dead of [false, true]) {
      const g = reload(entered);
      g.dukeVidal!.leader.dead = dead;
      if (captured) g.dukeVidal!.leader.capturedBy = 'in';
      else delete g.dukeVidal!.leader.capturedBy;
      descriptors.push(viewGame(g, 'ec').ambassadorEntry!.dukeAcquisition);
      assert.equal(
        ecazDukeAcquisitionBlock(g, 'ec'),
        'Duke Vidal is unavailable for this acquisition.',
      );
      reject(g, 'ec', command(g));
    }
  assert.ok(
    descriptors.every(
      (value) => JSON.stringify(value) === JSON.stringify(descriptors[0]),
    ),
  );
  assert.deepEqual(descriptors[0], {
    blocked: 'Duke Vidal is unavailable for this acquisition.',
  });
});

void test('duplicated shared Duke in a native roster is uniformly unavailable and cannot commit the token', () => {
  const g = enter();
  p(g, 'al').leaders.push(structuredClone(g.dukeVidal!.leader));
  assert.deepEqual(viewGame(g, 'ec').ambassadorEntry!.dukeAcquisition, {
    blocked: 'Duke Vidal is unavailable for this acquisition.',
  });
  reject(g, 'ec', command(g));
});
void test('later qualifying Moritani acquisition takes the same Ecaz-held disc through actual end-of-movement', () => {
  const initial = fixture('moritani');
  for (const id of ['in', 'al']) {
    p(initial, id).forces = { 'carthag:11': 2, 'sietch_tabr:14': 2 };
    p(initial, id).reserves = 16;
  }
  const gained = acquire(enter(initial));
  assert.equal(gained.dukeVidal!.source, 'ecaz');
  const done = completeMovement(gained);
  assert.equal(done.dukeVidal!.controller, 'in');
  assert.equal(done.dukeVidal!.source, 'moritani');
  assert.equal(done.dukeVidal!.leader.id, DUKE_VIDAL_ID);
  assert.equal(done.dukeVidal!.leader.deaths, 0);
  assert.equal(done.dukeAcquisitionTurn, 2);
  assert.equal(done.phase, 6);
});
