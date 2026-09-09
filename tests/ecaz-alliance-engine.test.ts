import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import type { FactionId } from '../game/catalog';
import { createAmbassadors, placeAmbassador } from '../game/ecaz-ambassadors';
import { acquireDuke, createDukeVidal } from '../game/duke-vidal';
import { richeseCards } from '../game/richese-cards';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';

const seat = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const json = (g: Game): Game => JSON.parse(JSON.stringify(g));
function fixture(advanced = false, entrant: FactionId = 'emperor') {
  const g = createGame('ECAZALLY', newPlayer('ec', 'Ecaz', 'ecaz'), advanced, [
    'ecaz',
  ]);
  g.players.push(
    newPlayer('in', 'Entrant', entrant),
    newPlayer('a', 'Other', 'atreides'),
    newPlayer('bg', 'Predictor', 'beneGesserit'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    storm: 18,
    active: 'in',
    order: ['in', 'ec', 'a', 'bg'],
    movementRemaining: ['in', 'ec', 'a', 'bg'],
    deck: baseDeck(),
    dukeVidal: createDukeVidal(),
    ready: [],
  });
  for (const p of g.players)
    Object.assign(p, {
      forces: {},
      reserves: 20,
      tanks: 0,
      spice: 20,
      hand: [],
      traitors: [],
      traitorChoices: [],
    });
  // No reserve advisor option interferes with the tested original shipment.
  seat(g, 'bg').reserves = 0;
  seat(g, 'bg').tanks = 20;
  seat(g, 'bg').prediction = { faction: entrant, turn: 7 };
  const state = createAmbassadors(() => 0);
  const token = state.tokens.find((t) => t.effect === 'ecaz')!;
  g.ecazAmbassadors = placeAmbassador(state, token.id, {
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
function enter(g = fixture()) {
  return applyAction(g, 'in', {
    type: 'ship',
    amount: 2,
    territory: 'arrakeen',
    sector: 10,
  });
}
function proposal(g: Game): Action {
  return {
    type: 'decision',
    event: g.pendingAmbassador!.event,
    trigger: true,
    choice: 'alliance',
    beneficiary: 'ec',
  };
}
function propose(g: Game) {
  return applyAction(g, 'ec', proposal(g));
}
function answer(g: Game, accept: boolean) {
  return applyAction(json(g), 'in', {
    type: 'decision',
    event: g.pendingAmbassador!.event,
    accept,
  });
}
function reject(g: Game, id: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, id, action));
  assert.deepEqual(g, before);
}
function conserved(g: Game) {
  for (const p of g.players)
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, n) => a + n, 0),
      20,
    );
  const cards = [
    ...g.deck,
    ...g.discard,
    ...(g.richeseCache ?? []),
    ...g.players.flatMap((p) => p.hand),
  ].map((c) => c.id);
  assert.equal(new Set(cards).size, cards.length);
}

for (const advanced of [false, true])
  void test(`${advanced ? 'Advanced' : 'Basic'} actual shipment allows bilateral Ecaz alliance and resumes the paid entrant without changing Duke`, () => {
    const initial = fixture(advanced);
    const token = initial.ecazAmbassadors!.tokens.find(
      (t) => t.effect === 'ecaz',
    )!.id;
    const duke = json(initial).dukeVidal;
    const entered = enter(initial);
    assert.equal(entered.decision?.player, 'ec');
    assert.equal(
      viewGame(entered, 'ec').ambassadorEntry!.allianceOffer!.blocked,
      null,
    );
    const before = json(entered);
    const offered = propose(entered);
    assert.deepEqual(entered, before);
    assert.equal(offered.pendingAmbassador?.stage, 'allianceReply');
    assert.equal(offered.pendingAmbassador?.beneficiary, 'in');
    assert.deepEqual(offered.decision, {
      kind: 'ecazAmbassador',
      player: 'in',
    });
    assert.equal(seat(offered, 'ec').ally, null);
    assert.equal(
      offered.ecazAmbassadors!.tokens.find((t) => t.id === token)!.zone,
      'supply',
    );
    assert.deepEqual(
      offered.ecazAmbassadors!.cohort,
      initial.ecazAmbassadors!.cohort,
    );
    const done = answer(normalizeAutomaticGame(json(offered)), true);
    assert.equal(seat(done, 'ec').ally, 'in');
    assert.equal(seat(done, 'in').ally, 'ec');
    assert.equal(seat(done, 'ec').allySinceTurn, 2);
    assert.equal(seat(done, 'in').allySinceTurn, 2);
    assert.deepEqual(done.dukeVidal, duke);
    assert.equal(done.pendingAmbassador, null);
    assert.equal(done.decision, null);
    assert.equal(done.active, 'in');
    assert.equal(done.phase, 5);
    assert.equal(seat(done, 'in').shipped, true);
    assert.equal(seat(done, 'in').spice, 18);
    assert.equal(seat(done, 'in').moved, 0);
    assert.deepEqual(seat(done, 'in').forces, { 'arrakeen:10': 2 });
    assert.deepEqual(normalizeAutomaticGame(json(done)), json(done));
    reject(done, 'in', {
      type: 'decision',
      event: offered.pendingAmbassador!.event,
      accept: true,
    });
    conserved(done);
  });

void test('refusal consumes the chosen reusable trigger but does not form an alliance or fall back to Duke acquisition', () => {
  const entered = enter();
  const done = answer(propose(entered), false);
  assert.equal(seat(done, 'ec').ally, null);
  assert.equal(seat(done, 'in').ally, null);
  assert.deepEqual(done.dukeVidal, entered.dukeVidal);
  assert.equal(
    done.ecazAmbassadors!.tokens.find((t) => t.effect === 'ecaz')!.zone,
    'supply',
  );
  assert.equal(done.pendingAmbassador, null);
  assert.equal(done.active, 'in');
  const untouched = applyAction(entered, 'ec', {
    type: 'decision',
    event: entered.pendingAmbassador!.event,
    decline: true,
  });
  assert.equal(
    untouched.ecazAmbassadors!.tokens.find((t) => t.effect === 'ecaz')!.zone,
    'placed',
  );
});

void test('only Ecaz proposes and only the original entrant answers the exact event with a boolean', () => {
  const g = enter();
  reject(g, 'in', proposal(g));
  reject(g, 'ec', { ...proposal(g), event: 'stale' });
  reject(g, 'ec', { ...proposal(g), beneficiary: 'in' });
  const offered = propose(g);
  for (const id of ['ec', 'a', 'bg'])
    reject(offered, id, {
      type: 'decision',
      event: offered.pendingAmbassador!.event,
      accept: true,
    });
  for (const accept of [undefined, 'yes', 1])
    reject(offered, 'in', {
      type: 'decision',
      event: offered.pendingAmbassador!.event,
      accept,
    });
  reject(offered, 'in', { type: 'decision', event: 'stale', accept: true });
  const changed = json(offered);
  changed.turn++;
  reject(changed, 'in', {
    type: 'decision',
    event: offered.pendingAmbassador!.event,
    accept: true,
  });
});

for (const already of ['ec', 'in'])
  void test(`existing ${already === 'ec' ? 'Ecaz' : 'entrant'} alliance cannot be replaced by this Ambassador`, () => {
    const g = fixture();
    seat(g, already).ally = 'a';
    seat(g, 'a').ally = already;
    const entered = enter(g);
    assert.ok(viewGame(entered, 'ec').ambassadorEntry!.allianceOffer!.blocked);
    reject(entered, 'ec', proposal(entered));
    assert.equal(
      entered.ecazAmbassadors!.tokens.find((t) => t.effect === 'ecaz')!.zone,
      'placed',
    );
  });

void test('acceptance clears obsolete offers involving the new pair and leaves unrelated offers and private prediction intact', () => {
  const g = fixture();
  g.allianceOffers = { ec: 'a', a: 'ec', in: 'bg', bg: 'a' };
  g.ready = ['a'];
  const prediction = json(g).players.find((p) => p.id === 'bg')!.prediction;
  const done = answer(propose(enter(g)), true);
  assert.deepEqual(done.allianceOffers, { bg: 'a' });
  assert.deepEqual(done.ready, []);
  assert.deepEqual(seat(done, 'bg').prediction, prediction);
  for (const id of ['ec', 'in', 'a'])
    assert.equal(
      viewGame(done, id).players.find((p) => p.id === 'bg')!.prediction,
      undefined,
    );
});

void test('a dead or previously controlled Duke cannot gate the no-loan alliance or be moved by it', () => {
  for (const dead of [false, true]) {
    const g = fixture(true);
    g.dukeVidal = acquireDuke(g.dukeVidal!, 'a', 1, 'moritani');
    if (dead) {
      g.dukeVidal.leader.dead = true;
      g.dukeVidal.leader.deaths = 1;
    }
    const duke = json(g).dukeVidal;
    const entered = enter(g);
    assert.equal(
      viewGame(entered, 'ec').ambassadorEntry!.allianceOffer!.blocked,
      null,
    );
    const done = answer(propose(entered), true);
    assert.deepEqual(done.dukeVidal, duke);
  }
  const g = fixture(true);
  g.players[2] = newPlayer('a', 'Harkonnen', 'harkonnen');
  const entered = enter(g);
  assert.ok(viewGame(entered, 'ec').ambassadorEntry!.dukeAcquisition!.blocked);
  assert.equal(
    viewGame(entered, 'ec').ambassadorEntry!.allianceOffer!.blocked,
    null,
  );
  assert.equal(seat(answer(propose(entered), true), 'ec').ally, 'in');
});

void test('changing BG private prediction and unrelated private hands does not change the public alliance offer', () => {
  const g = enter();
  const changed = json(g);
  seat(changed, 'bg').prediction = { faction: 'atreides', turn: 9 };
  const card = changed.deck.splice(0, 1)[0];
  seat(changed, 'a').hand.push(card);
  assert.deepEqual(viewGame(g, 'ec'), viewGame(changed, 'ec'));
  const offered = propose(g);
  assert.equal(viewGame(offered, 'a').ambassadorEntry!.allianceOffer, null);
  assert.deepEqual(viewGame(offered, 'a').decision, {
    kind: 'ecazAmbassador',
    player: 'in',
  });
});

for (const accept of [false, true])
  void test(`actual worm ride resumes its next ride once after alliance ${accept ? 'acceptance' : 'refusal'}`, () => {
    const g = fixture(true, 'fremen');
    Object.assign(g, {
      phase: 1,
      active: null,
      nexus: false,
      wormRides: ['hagga_basin'],
      decision: { kind: 'wormRide', player: 'in', territory: 'imperial_basin' },
    });
    seat(g, 'in').forces = { 'imperial_basin:10': 3, 'hagga_basin:11': 1 };
    seat(g, 'in').reserves = 16;
    const arrived = applyAction(g, 'in', {
      type: 'decision',
      accept: true,
      territory: 'arrakeen',
      sector: 10,
      forces: { 'imperial_basin:10': 2 },
    });
    assert.equal(arrived.pendingAmbassador!.resume, 'wormRide');
    const done = answer(propose(arrived), accept);
    assert.equal(done.phase, 1);
    assert.deepEqual(done.decision, {
      kind: 'wormRide',
      player: 'in',
      territory: 'hagga_basin',
    });
    assert.deepEqual(done.wormRides, []);
    assert.deepEqual(seat(done, 'in').forces, seat(arrived, 'in').forces);
    assert.equal(seat(done, 'in').ally, accept ? 'ec' : null);
    conserved(done);
  });

void test('a genuine paid Box suspends the entrant reply and restores it after JSON without repeating the token trigger', () => {
  const g = fixture();
  g.richeseCache = richeseCards();
  const at = g.richeseCache.findIndex((c) => c.effect === 'nullentropyBox');
  const box = g.richeseCache.splice(at, 1)[0];
  seat(g, 'in').hand.push(box);
  for (const name of ['Shield', 'Maula Pistol']) {
    const i = g.deck.findIndex((c) => c.name === name);
    g.discard.push(g.deck.splice(i, 1)[0]);
  }
  const offered = propose(enter(g));
  let saved = applyAction(offered, 'in', { type: 'card', card: box.id });
  assert.equal(saved.decision?.kind, 'nullentropy');
  assert.equal(saved.pendingNullentropy!.resume.decision?.player, 'in');
  assert.deepEqual(saved.pendingAmbassador, offered.pendingAmbassador);
  saved = normalizeAutomaticGame(json(saved));
  saved = applyAction(saved, 'in', {
    type: 'decision',
    event: saved.pendingNullentropy!.event,
    card: saved.discard[0].id,
  });
  assert.equal(saved.decision?.kind, 'ecazAmbassador');
  const done = answer(saved, true);
  assert.equal(seat(done, 'in').spice, 16);
  assert.equal(done.discard.filter((c) => c.id === box.id).length, 1);
  assert.deepEqual(done.ecazAmbassadors, offered.ecazAmbassadors);
  conserved(done);
});

for (const level of DIFFICULTIES)
  void test(`${level} proposes from the authoritative offer and accepts its owned reply legally`, () => {
    const g = enter();
    const owner = viewGame(g, 'ec');
    owner.players.find((p) => p.id === 'ec')!.bot = level;
    const action = botActions(owner)[0];
    assert.equal(action.choice, 'alliance');
    const offered = applyAction(g, 'ec', action);
    const entrant = viewGame(offered, 'in');
    entrant.players.find((p) => p.id === 'in')!.bot = level;
    const reply = botActions(entrant)[0];
    assert.equal(reply.accept, true);
    const done = applyAction(offered, 'in', reply);
    assert.equal(seat(done, 'ec').ally, 'in');
    assert.equal(done.pendingAmbassador, null);
  });

void test('saved alliance replies reject missing events, corrupted token custody and changed entrant bindings before any answer', () => {
  const offered = propose(enter());
  const changes: [string, (g: Game) => void][] = [
    [
      'empty event',
      (g) => {
        g.pendingAmbassador!.event = '';
      },
    ],
    [
      'missing event',
      (g) => {
        Reflect.deleteProperty(g.pendingAmbassador!, 'event');
      },
    ],
    [
      'missing entry',
      (g) => {
        g.pendingAmbassador = null;
      },
    ],
    [
      'missing decision',
      (g) => {
        g.decision = null;
      },
    ],
    [
      'foreign decision owner',
      (g) => {
        g.decision!.player = 'a';
      },
    ],
    [
      'changed entrant',
      (g) => {
        g.pendingAmbassador!.entrant = 'a';
      },
    ],
    [
      'foreign Ecaz owner',
      (g) => {
        g.pendingAmbassador!.owner = 'a';
      },
    ],
    [
      'missing token',
      (g) => {
        g.pendingAmbassador!.token = 'missing';
      },
    ],
    [
      'returned token replaced on board',
      (g) => {
        const token = g.ecazAmbassadors!.tokens.find(
          (t) => t.effect === 'ecaz',
        )!;
        token.zone = 'placed';
        token.location = 'arrakeen';
      },
    ],
    [
      'returned token retains location',
      (g) => {
        g.ecazAmbassadors!.tokens.find((t) => t.effect === 'ecaz')!.location =
          'arrakeen';
      },
    ],
    [
      'foreign token effect',
      (g) => {
        g.ecazAmbassadors!.tokens.find((t) => t.effect === 'ecaz')!.effect =
          'guild';
      },
    ],
    [
      'crossed phase-five worm continuation',
      (g) => {
        g.pendingAmbassador!.resume = 'wormRide';
      },
    ],
  ];
  for (const [name, change] of changes) {
    const malformed = json(offered);
    change(malformed);
    const before = structuredClone(malformed);
    assert.throws(() => normalizeAutomaticGame(malformed), name);
    assert.deepEqual(
      malformed,
      before,
      `${name}: normalization must not mutate`,
    );
    reject(malformed, 'in', {
      type: 'decision',
      event: offered.pendingAmbassador!.event,
      accept: true,
    });
  }
});

void test('a real Box-suspended alliance reply cannot outlive its entry or restore a different entrant', () => {
  const g = fixture();
  g.richeseCache = richeseCards();
  const at = g.richeseCache.findIndex((c) => c.effect === 'nullentropyBox');
  const box = g.richeseCache.splice(at, 1)[0];
  seat(g, 'in').hand.push(box);
  for (const name of ['Shield', 'Maula Pistol']) {
    const index = g.deck.findIndex((c) => c.name === name);
    g.discard.push(g.deck.splice(index, 1)[0]);
  }
  const saved = applyAction(propose(enter(g)), 'in', {
    type: 'card',
    card: box.id,
  });
  assert.equal(
    saved.pendingNullentropy!.resume.decision!.kind,
    'ecazAmbassador',
  );
  assert.deepEqual(normalizeAutomaticGame(json(saved)), json(saved));
  const changes: [string, (g: Game) => void][] = [
    [
      'missing suspended parent',
      (g) => {
        g.pendingAmbassador = null;
      },
    ],
    [
      'missing suspended event',
      (g) => {
        Reflect.deleteProperty(g.pendingAmbassador!, 'event');
      },
    ],
    [
      'missing suspended decision',
      (g) => {
        g.pendingNullentropy!.resume.decision = null;
      },
    ],
    [
      'foreign suspended decision owner',
      (g) => {
        g.pendingNullentropy!.resume.decision!.player = 'a';
      },
    ],
  ];
  for (const [name, change] of changes) {
    const malformed = json(saved);
    change(malformed);
    const before = structuredClone(malformed);
    assert.throws(() => normalizeAutomaticGame(malformed), name);
    assert.deepEqual(malformed, before);
    reject(malformed, 'in', {
      type: 'decision',
      event: saved.pendingNullentropy!.event,
      card: saved.discard[0].id,
    });
  }
});
