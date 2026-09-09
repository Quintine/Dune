import test from 'node:test';
import assert from 'node:assert/strict';
import {
  quoteBattleBoard,
  quoteSpiceCollection,
  quoteBattleBoardContinuation,
  quoteBattlePhaseAdvance,
  BoardResolutionError,
} from '../game/board-resolution-quote';
import {
  createGame,
  newPlayer,
  applyAction,
  battles,
  type Game,
} from '../game/engine';
const fixture = () => {
  const g = createGame(
    'BOARDQUOTE',
    newPlayer('a', 'Atreides', 'atreides'),
    true,
  );
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('b', 'BG', 'beneGesserit'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 6,
    turn: 2,
    storm: 18,
    order: ['a', 'e', 'b'],
    active: 'a',
    phaseOpening: null,
  });
  for (const p of g.players)
    Object.assign(p, {
      hand: [],
      traitors: [],
      traitorChoices: [],
      forces: {},
      reserves: 20,
      spice: 10,
    });
  return g;
};
void test('battle quote settles only abandoned advisor stances without mutating or reading private hands', () => {
  const g = fixture();
  g.players[2].forces = { 'red_chasm:7': 2, 'arrakeen:10': 1 };
  g.players[2].advisors = { red_chasm: {}, arrakeen: {}, carthag: {} };
  g.players[0].forces = { 'arrakeen:10': 1 };
  const before = structuredClone(g);
  const q = quoteBattleBoard(g);
  assert.deepEqual(q.released, [
    { player: 'b', territory: 'red_chasm' },
    { player: 'b', territory: 'carthag' },
  ]);
  assert.deepEqual(q.battles, []);
  assert.deepEqual(g, before);
  for (const p of g.players)
    for (const key of ['hand', 'traitors', 'spice', 'leaders'])
      Object.defineProperty(p, key, {
        get() {
          throw Error('Private data read');
        },
      });
  assert.deepEqual(quoteBattleBoard(g), q);
});
void test('actual battles applies the quoted advisor releases once and preserves occupied advisors', () => {
  const g = fixture();
  g.players[2].forces = { 'red_chasm:7': 2 };
  g.players[2].advisors = { red_chasm: {}, arrakeen: {} };
  const q = quoteBattleBoard(g);
  assert.deepEqual(battles(g), q.battles);
  assert.deepEqual(g.players[2].advisors, {});
  assert.deepEqual(battles(g), []);
});
void test('battle order excludes allies, polar sink and storm-separated forces, including empty saved location keys', () => {
  const g = fixture();
  g.storm = 6;
  g.players[0].forces = {
    'the_minor_erg:5': 2,
    'the_minor_erg:7': 0,
    'polar_sink:0': 2,
  };
  g.players[1].forces = { 'the_minor_erg:7': 2, 'polar_sink:0': 2 };
  assert.deepEqual(quoteBattleBoard(g).battles, []);
  g.storm = 18;
  assert.deepEqual(quoteBattleBoard(g).battles, [
    { territory: 'the_minor_erg', attacker: 'a', defender: 'e' },
  ]);
  g.players[0].ally = 'e';
  g.players[1].ally = 'a';
  assert.deepEqual(quoteBattleBoard(g).battles, []);
});
void test('the moving stronghold uses its pointer sector for storm obstruction and the declared player order', () => {
  const g = fixture();
  g.mobileStronghold = { location: 'red_chasm:7' };
  g.players[0].forces = { 'hidden_mobile_stronghold:0': 1 };
  g.players[1].forces = { 'hidden_mobile_stronghold:0': 2 };
  g.order = ['e', 'a', 'b'];
  assert.deepEqual(quoteBattleBoard(g).battles, [
    { territory: 'hidden_mobile_stronghold', attacker: 'e', defender: 'a' },
  ]);
  g.storm = 7;
  assert.deepEqual(quoteBattleBoard(g).battles, []);
});
void test('collection uses storm order and shared remaining spice, with city rate and Advanced income separated', () => {
  const g = fixture();
  g.players[0].forces = { 'arrakeen:10': 1, 'red_chasm:7': 2 };
  g.players[1].forces = { 'red_chasm:7': 2 };
  g.spice = { 'red_chasm:7': 9 };
  const before = structuredClone(g),
    q = quoteSpiceCollection(g);
  assert.deepEqual(q.receipts, [
    { player: 'a', strongholds: 2, collected: 6, desert: 6, balance: 18 },
    { player: 'e', strongholds: 0, collected: 3, desert: 3, balance: 13 },
    { player: 'b', strongholds: 0, collected: 0, desert: 0, balance: 10 },
  ]);
  assert.equal(q.spice['red_chasm:7'], 0);
  assert.deepEqual(g, before);
  g.order = ['e', 'a', 'b'];
  assert.deepEqual(
    quoteSpiceCollection(g).receipts.map((r) => r.collected),
    [4, 5, 0],
  );
});
void test('collection counts a concealed marker as one without inspecting its secret token or reserve value', () => {
  const g = fixture();
  g.players[0] = newPlayer('a', 'Richese', 'richese');
  g.players[0].spice = 10;
  g.players[0].noField = {
    deployed: { location: { territory: 'red_chasm', sector: 7 } },
  } as NonNullable<Game['players'][number]['noField']>;
  Object.defineProperty(g.players[0].noField, 'tokens', {
    get() {
      throw Error('Hidden tokens read');
    },
  });
  Object.defineProperty(g.players[0], 'reserves', {
    get() {
      throw Error('Private reserves read');
    },
  });
  g.spice = { 'red_chasm:7': 5 };
  assert.equal(quoteSpiceCollection(g).receipts[0].collected, 2);
});
void test('Ixian cyborgs collect three each while suboids use the current ordinary rate', () => {
  const g = fixture();
  g.players[0] = newPlayer('a', 'Ix', 'ixians');
  Object.assign(g.players[0], {
    spice: 10,
    forces: { 'red_chasm:7': 3 },
    elites: { forces: { 'red_chasm:7': 1 }, reserves: 3, tanks: 0, revived: 0 },
  });
  g.spice = { 'red_chasm:7': 10 };
  assert.equal(quoteSpiceCollection(g).receipts[0].collected, 7);
  g.players[0].forces['arrakeen:10'] = 1;
  assert.equal(quoteSpiceCollection(g).receipts[0].collected, 9);
});
void test('occupied advisors cannot collect, while automatic solo fighters can and storm losses collect nothing', () => {
  const g = fixture();
  g.players[2].forces = { 'red_chasm:7': 2, 'arrakeen:10': 1 };
  g.players[2].advisors = { red_chasm: {}, arrakeen: {} };
  g.players[0].forces = { 'arrakeen:10': 1 };
  g.spice = { 'red_chasm:7': 9, 'arrakeen:10': 5 };
  const q = quoteSpiceCollection(g);
  assert.equal(q.receipts[2].collected, 4);
  assert.equal(q.receipts[2].strongholds, 0);
  g.storm = 7;
  assert.equal(quoteSpiceCollection(g).receipts[2].collected, 0);
});
void test('malformed board and collection arithmetic reject without any state mutation', () => {
  const base = fixture();
  base.players[0].forces = { 'red_chasm:7': 2 };
  base.spice = { 'red_chasm:7': 5 };
  for (const corrupt of [
    (g: Game) => {
      g.order = ['a', 'a', 'b'];
    },
    (g: Game) => {
      g.players[0].forces = { 'red_chasm:8': 2 };
    },
    (g: Game) => {
      g.players[0].forces['red_chasm:7'] = -1;
    },
    (g: Game) => {
      g.spice['red_chasm:7'] = -1;
    },
    (g: Game) => {
      g.players[0].spice = Number.MAX_SAFE_INTEGER;
    },
  ]) {
    const g = structuredClone(base);
    corrupt(g);
    const before = structuredClone(g);
    assert.throws(() => quoteSpiceCollection(g), BoardResolutionError);
    assert.deepEqual(g, before);
  }
});
void test('actual phase advancement consumes the collection quote once and restores across JSON', () => {
  let g = fixture();
  g.advanced = false;
  g.phase = 5;
  g.active = 'b';
  g.movementRemaining = ['b'];
  for (const p of g.players) {
    p.shipped = true;
    p.moved = 1;
  }
  g.players[0].forces = { 'arrakeen:10': 1, 'red_chasm:7': 2 };
  g.spice = { 'red_chasm:7': 8 };
  const q = quoteSpiceCollection(g);
  g = applyAction(g, 'b', { type: 'endMovement' });
  assert.equal(g.phase, 7);
  assert.deepEqual(g.spice, q.spice);
  assert.deepEqual(
    g.players.map((p) => p.spice),
    q.receipts.map((r) => r.balance),
  );
  const saved = JSON.parse(JSON.stringify(g));
  assert.deepEqual(
    saved.players.map((p: { spice: number }) => p.spice),
    q.receipts.map((r) => r.balance),
  );
  assert.equal(
    saved.log.filter((l: { text: string }) =>
      l.text.includes('collected 6 spice'),
    ).length,
    1,
  );
});
void test('repeated board and collection quotes perform no random draw or event allocation', (t) => {
  const g = fixture(),
    before = structuredClone(g);
  const random = t.mock.method(crypto, 'getRandomValues', () => {
    throw Error('RNG');
  });
  const uuid = t.mock.method(crypto, 'randomUUID', () => {
    throw Error('event');
  });
  for (let i = 0; i < 10; i++) {
    quoteBattleBoard(g);
    quoteSpiceCollection(g);
  }
  assert.deepEqual(g, before);
  assert.equal(random.mock.callCount(), 0);
  assert.equal(uuid.mock.callCount(), 0);
});

void test('battle completion quotes refunds before collection without mutating escrow', () => {
  const g = fixture();
  g.players[0].forces = { 'arrakeen:10': 1, 'red_chasm:7': 2 };
  g.spice = { 'red_chasm:7': 8 };
  g.aid = { a: { recipient: 'b', amount: 4 } };
  const before = structuredClone(g);
  const q = quoteBattleBoardContinuation(g);
  assert.deepEqual(q.board.battles, []);
  assert.deepEqual(q.phase?.refunds, [{ player: 'a', amount: 4, balance: 14 }]);
  assert.equal(q.phase?.collection?.receipts[0].balance, 22);
  assert.deepEqual(g, before);
});
void test('remaining battles, CHOAM market and Ix opening stop at their decision boundaries', () => {
  const g = fixture();
  g.players[0].forces = { 'arrakeen:10': 1 };
  g.players[1].forces = { 'arrakeen:10': 1 };
  g.aid = { missing: { recipient: 'a', amount: 1 } };
  assert.equal(quoteBattleBoardContinuation(g).phase, null);
  g.players[1].forces = {};
  g.players[1].faction = 'choam';
  assert.equal(quoteBattleBoardContinuation(g).phase, null);
  assert.throws(() => quoteBattlePhaseAdvance(g), BoardResolutionError);
  g.aid = {};
  g.expansions = ['ix'];
  g.spice = { invalid: -1 };
  assert.equal(quoteBattlePhaseAdvance(g).collection, null);
  g.expansions = [];
  assert.throws(() => quoteBattlePhaseAdvance(g), BoardResolutionError);
});
void test('invalid aid or refund plus collection overflow rejects before automatic effects', () => {
  for (const corrupt of [
    (g: Game) => {
      g.aid = { missing: { recipient: 'a', amount: 1 } };
    },
    (g: Game) => {
      g.aid = { a: { recipient: 'b', amount: -1 } };
    },
    (g: Game) => {
      g.players[0].spice = Number.MAX_SAFE_INTEGER;
      g.aid = { a: { recipient: 'b', amount: 1 } };
    },
    (g: Game) => {
      g.players[0].spice = Number.MAX_SAFE_INTEGER - 2;
      g.aid = { a: { recipient: 'b', amount: 1 } };
      g.players[0].forces = { 'arrakeen:10': 1 };
    },
  ]) {
    const g = fixture();
    corrupt(g);
    const before = structuredClone(g);
    assert.throws(() => quoteBattleBoardContinuation(g), BoardResolutionError);
    assert.deepEqual(g, before);
  }
});
