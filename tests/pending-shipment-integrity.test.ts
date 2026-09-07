import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';

function fixture() {
  let g = createGame('SHIPINTENT', newPlayer('e', 'Emperor', 'emperor'), true);
  g.players.push(
    newPlayer('g', 'Guild', 'guild'),
    newPlayer('a', 'Ally', 'atreides'),
    newPlayer('b', 'Bene Gesserit', 'beneGesserit'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 3,
    active: 'e',
    order: ['e', 'g', 'a', 'b'],
    movementRemaining: ['e', 'g', 'a', 'b'],
    storm: 18,
    deck: baseDeck(),
  });
  for (const p of g.players) {
    p.spice = 20;
    p.forces = {};
    p.reserves = 20;
    p.hand = [];
  }
  g.players[0].elites = { reserves: 5, tanks: 0, revived: 0, forces: {} };
  g.players[0].ally = 'a';
  g.players[2].ally = 'e';
  const i = g.deck.findIndex((c) => c.effect === 'karama');
  g.players[1].hand.push(g.deck.splice(i, 1)[0]);
  g = applyAction(g, 'a', { type: 'pledgeAid', amount: 3 });
  return g;
}
const declaration = {
  type: 'ship',
  territory: 'arrakeen',
  sector: 10,
  amount: 4,
  elite: 2,
  allyPayment: 2,
};
const declare = (g = fixture()) => applyAction(g, 'e', declaration);
const permit = (g: Game, id = 'g') =>
  applyAction(g, id, { type: 'decision', allow: true });
const stop = (g: Game) =>
  applyAction(g, 'g', {
    type: 'card',
    mode: 'special',
    card: g.players[1].hand.find((c) => c.effect === 'karama')!.id,
  });
const pendingRecord = (g: Game) =>
  g.pendingShipment as unknown as Record<string, unknown>;
const decisionRecord = (g: Game) =>
  g.decision as unknown as Record<string, unknown>;
function corrupted(label: string, change: (g: Game) => void, allowActor = 'g') {
  const g = declare();
  change(g);
  const snapshot = structuredClone(g);
  assert.throws(() => permit(g, allowActor), `${label}: allowance must reject`);
  assert.deepEqual(g, snapshot, `${label}: allowance is atomic`);
  assert.throws(
    () => stop(g),
    `${label}: stop must reject before spending a card`,
  );
  assert.deepEqual(g, snapshot, `${label}: rejected stop is atomic`);
}
function inventory(g: Game) {
  for (const p of g.players) {
    assert.equal(
      p.reserves +
        p.tanks +
        Object.values(p.forces).reduce((sum, n) => sum + n, 0),
      20,
    );
    if (p.elites)
      assert.equal(
        p.elites.reserves +
          p.elites.tanks +
          Object.values(p.elites.forces).reduce((sum, n) => sum + n, 0),
        5,
      );
  }
  assert.deepEqual(
    [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]
      .map((c) => c.id)
      .sort(),
    baseDeck()
      .map((c) => c.id)
      .sort(),
  );
}
function finishFollowups(state: Game) {
  let g = state;
  while (g.response) {
    const actor = g.players.find((p) => !g.response!.passed.includes(p.id))!;
    g = applyAction(g, actor.id, { type: 'passResponse' });
  }
  if (g.decision?.kind === 'advisor')
    g = applyAction(g, g.decision.player, { type: 'decision', accept: false });
  return g;
}

void test('new ordinary physical declarations persist their turn without exposing the private intent', () => {
  const initial = fixture(),
    g = declare(initial);
  assert.equal(pendingRecord(g).turn, g.turn);
  assert.equal(g.pendingShipment!.amount, 4);
  assert.equal(g.pendingShipment!.elite, 2);
  assert.equal(g.pendingShipment!.cost, 4);
  assert.equal(g.pendingShipment!.allyPayment, 2);
  assert.deepEqual(g.players, initial.players);
  assert.deepEqual(g.aid, initial.aid);
  for (const p of g.players) {
    const view = viewGame(g, p.id);
    assert.equal('pendingShipment' in view, false);
    assert.equal('allyPayment' in view.decision!, false);
    assert.equal('elite' in view.decision!, false);
  }
});

void test('saved physical shipments reject stale timing and spent shipment opportunities atomically', () => {
  corrupted('wrong phase', (g) => {
    g.phase = 4;
  });
  corrupted('inactive shipper', (g) => {
    g.active = 'a';
  });
  corrupted('spent shipment', (g) => {
    g.players[0].shipped = true;
  });
  corrupted('finished game', (g) => {
    g.status = 'finished';
  });
  for (const turn of [0, 2, 4, 1.5, '3', null])
    corrupted(`invalid declaration turn ${String(turn)}`, (g) => {
      pendingRecord(g).turn = turn;
    });
  corrupted('unknown shipper', (g) => {
    pendingRecord(g).player = 'missing';
  });
});

void test('saved physical force and elite allocations must remain valid against current typed reserves', () => {
  for (const amount of [0, -1, 1.5, 21, '4', NaN, Infinity])
    corrupted(`amount ${String(amount)}`, (g) => {
      pendingRecord(g).amount = amount;
      decisionRecord(g).amount = amount;
    });
  for (const elite of [-1, 1.5, 5, '2', NaN])
    corrupted(`elite ${String(elite)}`, (g) => {
      pendingRecord(g).elite = elite;
    });
  corrupted('insufficient current reserves', (g) => {
    g.players[0].reserves = 3;
    g.players[0].forces = { 'red_chasm:7': 17 };
    g.players[0].elites!.reserves = 1;
    g.players[0].elites!.forces = { 'red_chasm:7': 4 };
  });
  corrupted('insufficient selected elites', (g) => {
    g.players[0].reserves = 16;
    g.players[0].forces = { 'red_chasm:7': 4 };
    g.players[0].elites!.reserves = 1;
    g.players[0].elites!.forces = { 'red_chasm:7': 4 };
  });
  corrupted('nonelite minimum no longer possible', (g) => {
    g.players[0].reserves = 5;
    g.players[0].forces = { 'red_chasm:7': 15 };
  });
});

void test('saved shipment price and contribution are revalidated without repricing or unaffordable recovery', () => {
  for (const cost of [0, -1, 2, 5, 4.5, '4', NaN])
    corrupted(`cost ${String(cost)}`, (g) => {
      pendingRecord(g).cost = cost;
    });
  for (const share of [-1, 1.5, 4, 5, '2', NaN])
    corrupted(`share ${String(share)}`, (g) => {
      pendingRecord(g).allyPayment = share;
    });
  corrupted('own funds spent', (g) => {
    g.players[0].spice = 1;
  });
  corrupted('pledge reduced', (g) => {
    g.aid.a.amount = 1;
    g.players[2].spice += 2;
  });
  corrupted('pledge recipient changed', (g) => {
    g.aid.a.recipient = 'g';
  });
  corrupted('alliance no longer supplies escrow', (g) => {
    g.players[0].ally = null;
    g.players[2].ally = null;
  });
  corrupted('donor alliance is no longer reciprocal', (g) => {
    g.players[2].ally = null;
  });
  corrupted('donor now allied to another seat', (g) => {
    g.players[2].ally = 'b';
  });
  for (const amount of [3.5, Infinity, NaN, '3'])
    corrupted(`malformed current escrow ${String(amount)}`, (g) => {
      (g.aid.a as unknown as Record<string, unknown>).amount = amount;
    });
  corrupted('new rate benefit changes price', (g) => {
    g.karamaShipping = { player: 'e', owner: 'g' };
  });
  corrupted('new Guild alliance changes price', (g) => {
    g.players[0].ally = 'g';
    g.players[1].ally = 'e';
    g.players[2].ally = null;
    g.aid.g = { recipient: 'e', amount: 3 };
  });
});

void test('saved destination and advisor stance must still permit the declared physical arrival', () => {
  corrupted('storm reached destination', (g) => {
    g.storm = 10;
  });
  for (const sector of [7, -1, 1.5, '10'])
    corrupted(`sector ${String(sector)}`, (g) => {
      pendingRecord(g).sector = sector;
      decisionRecord(g).sector = sector;
    });
  corrupted('unknown destination', (g) => {
    pendingRecord(g).territory = 'missing';
    decisionRecord(g).territory = 'missing';
  });
  corrupted('ally moved into destination', (g) => {
    g.players[2].forces = { 'arrakeen:10': 1 };
    g.players[2].reserves = 19;
  });
  corrupted('stronghold filled', (g) => {
    g.players[1].forces = { 'arrakeen:10': 1 };
    g.players[1].reserves = 19;
    g.players[3].forces = { 'arrakeen:10': 1 };
    g.players[3].reserves = 19;
  });
  for (const advisors of [true, undefined, 'false', 0])
    corrupted(`false advisor flag ${String(advisors)}`, (g) => {
      pendingRecord(g).advisors = advisors;
    });
});

void test('public Guild permission must bind to the saved shipper, destination, amount and actual Guild seat', () => {
  for (const [key, value] of [
    ['shipper', 'a'],
    ['territory', 'carthag'],
    ['sector', 11],
    ['amount', 3],
  ] as const)
    corrupted(`public ${key} mismatch`, (g) => {
      decisionRecord(g)[key] = value;
    });
  corrupted(
    'wrong permission owner',
    (g) => {
      decisionRecord(g).player = 'a';
    },
    'a',
  );
  corrupted('Guild power already used', (g) => {
    g.players[1].specialKaramaUsed = true;
  });
});

void test('valid current and legacy JSON continuations spend physical forces, elites and escrow exactly once', () => {
  for (const legacy of [false, true]) {
    const pending = declare();
    if (legacy) delete pendingRecord(pending).turn;
    const restored = JSON.parse(JSON.stringify(pending)) as Game;
    for (const p of pending.players)
      assert.deepEqual(viewGame(restored, p.id), viewGame(pending, p.id));
    const allowed = permit(restored);
    assert.equal(allowed.pendingShipment, null);
    assert.equal(allowed.players[0].reserves, 16);
    assert.equal(allowed.players[0].forces['arrakeen:10'], 4);
    assert.equal(allowed.players[0].elites!.reserves, 3);
    assert.equal(allowed.players[0].elites!.forces['arrakeen:10'], 2);
    assert.equal(allowed.players[0].spice, 18);
    assert.equal(allowed.players[2].spice, 17);
    assert.equal(allowed.aid.a.amount, 1);
    assert.equal(allowed.players[0].shipped, true);
    assert.throws(() => permit(allowed));
    const complete = finishFollowups(JSON.parse(JSON.stringify(allowed)));
    assert.equal(complete.players[1].spice, 24);
    assert.equal(complete.decision, null);
    inventory(complete);
    assert.throws(() => applyAction(complete, 'e', declaration));
  }
});

void test('valid stopped physical shipments preserve the established no-payment outcome after JSON restore', () => {
  for (const legacy of [false, true]) {
    const pending = declare();
    if (legacy) delete pendingRecord(pending).turn;
    const done = stop(JSON.parse(JSON.stringify(pending)));
    assert.equal(done.players[0].reserves, 20);
    assert.equal(done.players[0].elites!.reserves, 5);
    assert.equal(done.players[0].spice, 20);
    assert.equal(done.players[0].shipped, true);
    assert.deepEqual(done.aid, pending.aid);
    assert.equal(done.players[1].specialKaramaUsed, true);
    assert.equal(done.pendingShipment, null);
    assert.equal(done.decision, null);
    assert.equal(done.discard.filter((c) => c.effect === 'karama').length, 1);
    assert.throws(() => stop(done));
    inventory(done);
  }
});

void test('a real advisor shipment retains its stance and rejects a saved stance made obsolete before commitment', () => {
  const initial = fixture();
  initial.players[0].faction = 'beneGesserit';
  initial.players[0].elites = undefined;
  initial.players[3].faction = 'emperor';
  initial.players[3].elites = { reserves: 5, tanks: 0, revived: 0, forces: {} };
  initial.players[0].forces = { 'arrakeen:10': 1 };
  initial.players[0].reserves = 19;
  initial.players[0].advisors = { arrakeen: {} };
  initial.players[1].forces = { 'arrakeen:10': 1 };
  initial.players[1].reserves = 19;
  const pending = applyAction(initial, 'e', { ...declaration, elite: 0 });
  assert.equal(pending.pendingShipment!.advisors, true);
  const allowed = finishFollowups(permit(JSON.parse(JSON.stringify(pending))));
  assert.deepEqual(allowed.players[0].advisors, { arrakeen: {} });
  assert.equal(allowed.players[0].forces['arrakeen:10'], 5);
  inventory(allowed);
  const stale = structuredClone(pending);
  stale.players[1].forces = {};
  stale.players[1].reserves = 20;
  const snapshot = structuredClone(stale);
  assert.throws(() => permit(stale));
  assert.throws(() => stop(stale));
  assert.deepEqual(stale, snapshot);
});

void test('a current shipment-rate card survives JSON continuation but a removed benefit invalidates its saved price', () => {
  let initial = fixture();
  const index = initial.deck.findIndex((c) => c.effect === 'karama');
  const card = initial.deck.splice(index, 1)[0];
  initial.players[0].hand.push(card);
  initial = applyAction(initial, 'e', {
    type: 'card',
    mode: 'shipment',
    card: card.id,
  });
  const pending = applyAction(initial, 'e', { ...declaration, allyPayment: 1 });
  assert.equal(pending.pendingShipment!.cost, 2);
  const allowed = finishFollowups(permit(JSON.parse(JSON.stringify(pending))));
  assert.equal(allowed.players[0].spice, 19);
  assert.equal(allowed.aid.a.amount, 2);
  assert.equal(allowed.players[1].spice, 20);
  assert.equal(allowed.karamaShipping, null);
  assert.equal(allowed.discard.filter((c) => c.id === card.id).length, 1);
  inventory(allowed);
  const stale = structuredClone(pending);
  stale.karamaShipping = null;
  const snapshot = structuredClone(stale);
  assert.throws(() => permit(stale));
  assert.throws(() => stop(stale));
  assert.deepEqual(stale, snapshot);
});
