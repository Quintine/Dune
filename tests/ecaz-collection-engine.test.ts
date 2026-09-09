import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import type { FactionId } from '../game/catalog';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { richeseCards } from '../game/richese-cards';

const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const json = (g: Game): Game => JSON.parse(JSON.stringify(g));

/** Conserved development position: real last movement, skipped empty Battle,
 * collection response, and allocation actions create every pending receipt. */
function fixture(
  advanced = false,
  multiple = false,
  ally: FactionId = 'atreides',
) {
  const g = createGame(
    'ECAZENGINE',
    newPlayer('ec', 'Ecaz', 'ecaz'),
    advanced,
    ['ecaz'],
  );
  g.players.push(
    newPlayer('al', 'Ally', ally),
    newPlayer('en', 'Rival', 'emperor'),
    newPlayer('bg', 'BG', 'beneGesserit'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    storm: 18,
    order: ['ec', 'al', 'en', 'bg'],
    active: 'en',
    movementRemaining: ['en'],
    deck: baseDeck(),
    discard: [],
    ready: [],
    phaseOpening: null,
    spice: { 'wind_pass:14': 5, ...(multiple ? { 'hagga_basin:12': 7 } : {}) },
  });
  for (const [index, p] of g.players.entries())
    Object.assign(p, {
      spice: 10 + index * 10,
      hand: [],
      forces: {},
      reserves: 20,
      tanks: 0,
      traitors: [],
      traitorChoices: [],
      shipped: true,
      moved: 0,
    });
  for (const id of ['ec', 'al']) {
    const p = player(g, id);
    p.forces = {
      'wind_pass:14': 2,
      ...(multiple ? { 'hagga_basin:12': 2 } : {}),
      ...(advanced ? { 'arrakeen:10': 1 } : {}),
    };
    p.reserves = 20 - Object.values(p.forces).reduce((a, n) => a + n, 0);
    p.ally = id === 'ec' ? 'al' : 'ec';
    p.allySinceTurn = 1;
  }
  return g;
}
function hold(g: Game, id: string, name: string) {
  const index = g.deck.findIndex((c) => c.name === name);
  assert.ok(index >= 0, name);
  const c = g.deck.splice(index, 1)[0];
  player(g, id).hand.push(c);
  return c.id;
}
function start(g: Game) {
  const before = json(g);
  let next = applyAction(g, 'en', { type: 'endMovement' });
  assert.deepEqual(g, before);
  // CHOAM's real closing markets precede the collection initializer.
  for (let i = 0; next.decision?.kind === 'choamMarket' && i < 3; i++)
    next = applyAction(next, next.decision.player, {
      type: 'decision',
      done: true,
    });
  assert.equal(next.phase, 7);
  return next;
}
function allow(g: Game) {
  for (let i = 0; g.response && i < 20; i++) {
    const p = g.players.find((p) => !g.response!.passed.includes(p.id))!;
    g = applyAction(json(g), p.id, { type: 'passResponse' });
  }
  assert.equal(g.response, null);
  return g;
}
function command(g: Game, allocation: Record<string, unknown>): Action {
  return { type: 'decision', event: g.ecazCollection!.event, allocation };
}
function choose(g: Game, allocation: Record<string, unknown>) {
  assert.equal(g.decision?.kind, 'ecazSpice');
  return applyAction(json(g), g.decision!.player, command(g, allocation));
}
function finish(g: Game) {
  for (let n = 0; g.decision?.kind === 'ecazSpice' && n < 5; n++)
    g = choose(g, { kind: 'equal' });
  assert.equal(g.ecazCollection?.stage, 'complete');
  assert.equal(g.decision, null);
  return g;
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
    ...g.players.flatMap((p) => p.hand),
  ].map((c) => c.id);
  assert.equal(new Set(cards).size, cards.length);
}
function rejected(g: Game, id: string, action: Action) {
  const before = json(g);
  assert.throws(() => applyAction(g, id, action));
  assert.deepEqual(g, before);
}

for (const advanced of [false, true])
  void test(`${advanced ? 'Advanced' : 'Basic'} last movement enters collection with no automatic-income confirmation or premature shared credit`, () => {
    const original = fixture(advanced, true);
    let g = start(original);
    assert.equal(g.response, null);
    assert.equal(g.decision?.kind, 'ecazSpice');
    assert.equal(g.ecazCollection?.stage, 'allocation');
    assert.equal(g.ecazCollection?.allocation?.lots.length, 2);
    assert.equal(player(g, 'ec').spice, advanced ? 12 : 10);
    assert.equal(player(g, 'al').spice, advanced ? 22 : 20);
    assert.equal(g.spice['wind_pass:14'], 0);
    assert.equal(g.spice['hagga_basin:12'], 0);
    g = finish(g);
    assert.equal(player(g, 'ec').spice, advanced ? 17 : 15);
    assert.equal(player(g, 'al').spice, advanced ? 29 : 27);
    assert.equal(g.ecazCollection!.settled.length, 2);
    conserved(g);
  });

void test('zero shared spice leaves ordinary collection automatic without a no-choice allocation', () => {
  const original = fixture(true);
  original.spice = {};
  const g = start(original);
  assert.equal(g.response, null);
  assert.equal(g.decision, null);
  assert.equal(g.ecazCollection?.stage, 'complete');
  assert.equal(player(g, 'ec').spice, 12);
  assert.equal(player(g, 'al').spice, 22);
});

void test('real proposals and counteroffers remain private to the allies until one agreed receipt is paid', () => {
  const base = start(fixture());
  const left = choose(base, { kind: 'propose', ecazShare: 1 });
  const right = choose(base, { kind: 'propose', ecazShare: 4 });
  for (const id of ['en', 'bg']) {
    assert.deepEqual(viewGame(left, id), viewGame(right, id));
    assert.equal(viewGame(left, id).ecazSpice?.allocation, null);
  }
  assert.equal(viewGame(left, 'al').ecazSpice!.allocation!.offer!.ecazShare, 1);
  const counter = choose(left, { kind: 'propose', ecazShare: 3 });
  assert.equal(counter.decision?.player, 'ec');
  assert.equal(player(counter, 'ec').spice, 10);
  assert.equal(player(counter, 'al').spice, 20);
  rejected(counter, 'al', command(counter, { kind: 'accept' }));
  const done = choose(counter, { kind: 'accept' });
  assert.equal(player(done, 'ec').spice, 13);
  assert.equal(player(done, 'al').spice, 22);
  assert.equal(done.ecazCollection!.settled[0].method, 'agreement');
});

void test('genuine CHOAM cash-in during shared escrow changes its private balance without losing the negotiated collection parent', () => {
  const initial = fixture(true, false, 'choam');
  const activation = hold(initial, 'al', 'Karama');
  const card = hold(initial, 'al', 'Baliset');
  let g = allow(start(initial));
  g = choose(g, { kind: 'propose', ecazShare: 1 });
  const pending = json(g).ecazCollection;
  const oldBalance = player(g, 'al').spice;
  const changed = applyAction(g, 'al', {
    type: 'card',
    mode: 'special',
    card: activation,
    cards: [card],
  });
  assert.equal(player(changed, 'al').spice, oldBalance + 3);
  assert.deepEqual(changed.ecazCollection, pending);
  assert.equal(changed.decision?.kind, 'ecazSpice');
  const done = choose(normalizeAutomaticGame(json(changed)), {
    kind: 'accept',
  });
  assert.equal(player(done, 'al').spice, oldBalance + 7);
  assert.equal(player(done, 'ec').spice, 13);
  assert.equal(
    done.discard.filter((c) => c.id === activation || c.id === card).length,
    2,
  );
  conserved(done);
});

void test('saved private balance perturbations preserve rival projection and credits use current balances', () => {
  const g = choose(start(fixture()), { kind: 'propose', ecazShare: 2 });
  const changed = json(g);
  player(changed, 'ec').spice += 100;
  player(changed, 'al').spice += 200;
  assert.deepEqual(viewGame(changed, 'en'), viewGame(g, 'en'));
  const done = choose(normalizeAutomaticGame(changed), { kind: 'accept' });
  assert.equal(player(done, 'ec').spice, 112);
  assert.equal(player(done, 'al').spice, 223);
});

void test('stale event and wrong player commands reject without consuming the current shared lot', () => {
  const g = start(fixture());
  rejected(g, 'ec', { ...command(g, { kind: 'equal' }), event: 'old-event' });
  rejected(g, 'al', command(g, { kind: 'equal' }));
  rejected(g, 'ec', command(g, { kind: 'propose', ecazShare: 6 }));
  rejected(g, 'ec', { type: 'ready' });
});

void test('corrupt saved turn, event shape, roster, source or orphaned allocation rejects in action and normalization', () => {
  const base = start(fixture());
  const corruptions: ((g: Game) => void)[] = [
    (g) => {
      g.ecazCollection!.turn--;
    },
    (g) => {
      g.ecazCollection!.event = '';
    },
    (g) => {
      player(g, 'al').ally = null;
    },
    (g) => {
      player(g, 'al').faction = 'emperor';
    },
    (g) => {
      g.ecazCollection!.sourceSpice['wind_pass:14']++;
    },
    (g) => {
      g.decision = null;
    },
    (g) => {
      g.decision = { kind: 'ecazSpice', player: 'en' };
    },
  ];
  for (const corrupt of corruptions) {
    const g = json(base);
    corrupt(g);
    const before = json(g);
    assert.throws(() => normalizeAutomaticGame(g));
    assert.deepEqual(g, before);
    rejected(g, 'ec', command(g, { kind: 'equal' }));
  }
});

void test('an orphaned ecazSpice decision cannot survive automatic recovery without its collection event', () => {
  const base = start(fixture());
  for (const completed of [false, true]) {
    const g = json(base);
    const action = command(g, { kind: 'equal' });
    if (completed) {
      g.ecazCollection!.stage = 'complete';
      g.ecazCollection!.allocation = null;
    } else delete g.ecazCollection;
    rejected(g, 'ec', action);
    assert.throws(() => normalizeAutomaticGame(g));
  }
});

function assertOrphanRejected(base: Game) {
  for (const completed of [false, true]) {
    const g = json(base);
    if (completed) {
      g.ecazCollection!.stage = 'complete';
      g.ecazCollection!.allocation = null;
    } else delete g.ecazCollection;
    const before = json(g);
    assert.throws(() => normalizeAutomaticGame(g));
    assert.deepEqual(g, before);
    rejected(g, 'ec', { type: 'advanceBots' });
  }
}

for (const converted of [false, true])
  void test(`orphaned ${converted ? 'paid BG conversion' : 'unpaid Collection'} response rejects missing or falsely completed collection events`, () => {
    const initial = fixture(true);
    hold(initial, 'ec', 'Karama');
    const card = hold(
      initial,
      converted ? 'bg' : 'en',
      converted ? 'Baliset' : 'Karama',
    );
    let g = start(initial);
    assert.equal(g.response?.kind, 'ecazCollection');
    if (converted) {
      g = applyAction(g, 'bg', { type: 'card', card, mode: 'cancel' });
      assert.equal(g.response?.kind, 'worthlessKarama');
    }
    assertOrphanRejected(g);
    const valid = allow(normalizeAutomaticGame(json(g)));
    assert.equal(valid.ecazCollection?.stage, 'allocation');
    assert.equal(valid.ecazCollection?.canceled, converted);
  });

for (const parent of ['allocation', 'response', 'conversion'] as const)
  void test(`paid Box suspension retains the ${parent} collection parent and rejects orphaned saved controls`, () => {
    const initial = fixture(parent !== 'allocation');
    initial.richeseCache = richeseCards();
    const index = initial.richeseCache.findIndex(
      (c) => c.effect === 'nullentropyBox',
    );
    assert.ok(index >= 0);
    const box = initial.richeseCache.splice(index, 1)[0];
    player(initial, 'al').hand.push(box);
    for (const name of ['Shield', 'Maula Pistol']) {
      const at = initial.deck.findIndex((c) => c.name === name);
      assert.ok(at >= 0);
      initial.discard.push(initial.deck.splice(at, 1)[0]);
    }
    if (parent !== 'allocation')
      hold(initial, parent === 'response' ? 'en' : 'ec', 'Karama');
    const cancel =
      parent === 'conversion' ? hold(initial, 'bg', 'Baliset') : null;
    let g = start(initial);
    if (parent === 'response') assert.equal(g.response?.kind, 'ecazCollection');
    if (cancel) {
      g = applyAction(g, 'bg', { type: 'card', card: cancel, mode: 'cancel' });
      assert.equal(g.response?.kind, 'worthlessKarama');
    }
    const pending = json(g).ecazCollection;
    const originalResponse = json(g).response;
    g = applyAction(g, 'al', { type: 'card', card: box.id });
    assert.equal(g.decision?.kind, 'nullentropy');
    assert.equal(g.response, null);
    assert.deepEqual(g.ecazCollection, pending);
    if (parent === 'allocation')
      assert.equal(g.pendingNullentropy!.resume.decision?.kind, 'ecazSpice');
    else
      assert.deepEqual(g.pendingNullentropy!.resume.response, originalResponse);
    assert.deepEqual(normalizeAutomaticGame(json(g)), json(g));
    assertOrphanRejected(g);
    const picked = g.discard.find((c) => c.name === 'Shield')!.id;
    g = applyAction(json(g), 'al', {
      type: 'decision',
      event: g.pendingNullentropy!.event,
      card: picked,
    });
    assert.equal(g.pendingNullentropy, null);
    g = allow(g);
    assert.equal(g.decision?.kind, 'ecazSpice');
    assert.equal(g.ecazCollection?.event, pending!.event);
    assert.equal(g.ecazCollection?.canceled, parent === 'conversion');
    const done = finish(g);
    assert.equal(done.discard.filter((c) => c.id === box.id).length, 1);
    assert.equal(
      player(done, 'al').hand.filter((c) => c.id === picked).length,
      1,
    );
  });

void test('settled allocation ledger prevents index rewind or advance from duplicating or skipping an escrow payout', () => {
  const g = choose(start(fixture(false, true)), { kind: 'equal' });
  assert.equal(g.ecazCollection!.allocation!.index, 1);
  assert.equal(g.ecazCollection!.settled.length, 1);
  const changes: ((g: Game) => void)[] = [
    (g) => {
      g.ecazCollection!.allocation!.index = 0;
    },
    (g) => {
      g.ecazCollection!.allocation!.index = 2;
    },
    (g) => {
      g.ecazCollection!.settled = [];
    },
    (g) => {
      g.ecazCollection!.settled[0].ecazAmount++;
    },
    (g) => {
      g.ecazCollection!.settled[0].territory = 'red_chasm';
    },
  ];
  for (const change of changes) {
    const bad = json(g);
    change(bad);
    assert.throws(() => normalizeAutomaticGame(bad));
    rejected(bad, 'ec', command(bad, { kind: 'equal' }));
  }
  const done = finish(normalizeAutomaticGame(json(g)));
  assert.equal(player(done, 'ec').spice, 15);
  assert.equal(player(done, 'al').spice, 27);
});

for (const level of DIFFICULTIES)
  for (const offered of [false, true])
    void test(`${level} ${offered ? 'accepts a fair proposal' : 'chooses the equal split'} then allows normal phase advancement`, () => {
      let g = start(fixture());
      if (offered) g = choose(g, { kind: 'propose', ecazShare: 2 });
      const id = g.decision!.player;
      const view = viewGame(g, id);
      view.players.find((p) => p.id === id)!.bot = level;
      const before = structuredClone(view);
      const actions = botActions(view);
      assert.deepEqual(view, before);
      assert.deepEqual(actions[0].allocation, {
        kind: offered ? 'accept' : 'equal',
      });
      g = applyAction(g, id, actions[0]);
      assert.equal(g.ecazCollection!.stage, 'complete');
      assert.equal(player(g, 'ec').spice, 12);
      assert.equal(player(g, 'al').spice, 23);
      for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
      assert.equal(g.phase, 8);
      assert.equal(g.decision, null);
    });

for (const converted of [false, true])
  void test(`real ${converted ? 'BG-converted' : 'printed'} cancellation denies only Ecaz's bank income before the same multi-lot allocation`, () => {
    const initial = fixture(true, true);
    const actor = converted ? 'bg' : 'en';
    const card = hold(initial, actor, converted ? 'Baliset' : 'Karama');
    if (converted) hold(initial, 'ec', 'Karama');
    let g = start(initial);
    assert.equal(g.response?.kind, 'ecazCollection');
    assert.equal(player(g, 'ec').spice, 10);
    assert.equal(g.spice['wind_pass:14'], 5);
    g = applyAction(g, actor, { type: 'card', card, mode: 'cancel' });
    if (converted) assert.equal(g.response?.kind, 'worthlessKarama');
    g = allow(g);
    assert.equal(g.ecazCollection?.canceled, true);
    assert.equal(player(g, 'ec').spice, 10);
    assert.equal(player(g, 'al').spice, 22);
    g = finish(g);
    assert.equal(player(g, 'ec').spice, 15);
    assert.equal(player(g, 'al').spice, 29);
    assert.equal(g.discard.filter((c) => c.id === card).length, 1);
    assert.equal(g.ecazCollection!.settled.length, 2);
    conserved(g);
  });

void test('completed collection survives repeated JSON normalization without replay, while stale gameplay cannot reopen it', () => {
  const pending = start(fixture(true, true));
  const old = command(pending, { kind: 'equal' });
  const done = finish(pending);
  const again = normalizeAutomaticGame(normalizeAutomaticGame(json(done)));
  assert.deepEqual(again, done);
  rejected(again, 'ec', old);
  assert.equal(
    again.log.filter((l) => l.text.includes('shared collection: Ecaz received'))
      .length,
    2,
  );
});
