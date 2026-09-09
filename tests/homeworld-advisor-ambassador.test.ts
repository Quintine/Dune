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
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { createAmbassadors, placeAmbassador } from '../game/ecaz-ambassadors';
import {
  quoteGuildAmbassadorAdvisor,
  quoteGuildAmbassadorShipment,
} from '../game/guild-ambassador';
import { validateGuildAmbassadorArrivalContext } from '../game/guild-ambassador-continuation';
import { homeworldGameIntegrity } from '../game/homeworld-game';

const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const bg = (g: Game) => g.players.find((p) => p.id === 'b')!;
const ec = (g: Game) => g.players.find((p) => p.id === 'e')!;

/** Genuine setup/decks; a conserved phase-five board and one legal Ambassador
 * placement position the interaction without staging a pending decision. */
function fixture(advanced = true, reserves = 11) {
  let g = createGame(
    'HOMEADVISORAMB',
    newPlayer('e', 'Ecaz', 'ecaz'),
    advanced,
  );
  joinGame(g, newPlayer('a', 'Atreides', 'atreides'));
  joinGame(g, newPlayer('b', 'Bene Gesserit', 'beneGesserit'));
  g = applyAction(g, 'e', { type: 'homeworlds', enabled: true });
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  g = initializeHomeworldGameForAudit(g);
  for (let step = 0; g.status === 'setup' && step < 40; step++) {
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
    assert.ok(next);
    g = next;
  }
  assert.equal(g.status, 'playing');
  Object.assign(g, {
    phase: 5,
    phaseOpening: null,
    response: null,
    decision: null,
    active: 'a',
    order: ['a', 'e', 'b'],
    movementRemaining: ['a', 'e', 'b'],
    storm: 18,
    ready: [],
  });
  for (const p of g.players) {
    g.deck.push(...p.hand.splice(0));
    p.forces = { 'polar_sink:0': 20 - p.reserves };
    delete p.advisors;
    p.shipped = false;
    p.moved = 0;
  }
  const entrant = g.players.find((p) => p.id === 'a')!;
  entrant.forces = { 'polar_sink:0': 9, 'imperial_basin:10': 1 };
  entrant.shipped = true;
  bg(g).reserves = reserves;
  bg(g).forces = { 'polar_sink:0': 20 - reserves };
  const state = createAmbassadors(() => 0.2);
  const guild = state.tokens.find((t) => t.effect === 'guild')!;
  state.cohort = [
    guild.id,
    ...state.tokens
      .filter((t) => t.effect !== 'ecaz' && t.id !== guild.id)
      .slice(0, 4)
      .map((t) => t.id),
  ];
  for (const token of state.tokens) {
    token.zone =
      token.effect === 'ecaz' || state.cohort.includes(token.id)
        ? 'supply'
        : 'pool';
    token.location = null;
  }
  g.ecazAmbassadors = placeAmbassador(state, guild.id, {
    turn: g.turn,
    availableSpice: ec(g).spice,
    destination: {
      id: 'arrakeen',
      stronghold: true,
      inStorm: false,
      allowed: true,
    },
  }).state;
  homeworldGameIntegrity(g);
  return g;
}

function arrive(g: Game) {
  g = applyAction(g, 'a', {
    type: 'move',
    forces: { 'imperial_basin:10': 1 },
    territory: 'arrakeen',
    sector: 10,
  });
  assert.equal(g.pendingAmbassador?.stage, 'offer');
  g = applyAction(g, 'e', {
    type: 'decision',
    event: g.pendingAmbassador!.event,
    trigger: true,
    beneficiary: 'e',
  });
  assert.equal(g.pendingAmbassador?.stage, 'ship');
  return applyAction(g, 'e', {
    type: 'decision',
    event: g.pendingAmbassador!.event,
    amount: 2,
    territory: 'hagga_basin',
    sector: 12,
  });
}
function shipment(g: Game) {
  return quoteGuildAmbassadorShipment(g, 'e', {
    type: 'decision',
    amount: 2,
    territory: 'hagga_basin',
    sector: 12,
  });
}
function assertConserved(g: Game) {
  homeworldGameIntegrity(g);
  for (const p of g.players)
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
}
function allow(g: Game) {
  for (let i = 0; g.response && i < 20; i++) {
    const p = g.players.find((p) => !g.response!.passed.includes(p.id));
    assert.ok(p);
    g = applyAction(reload(g), p.id, { type: 'passResponse' });
  }
  assert.equal(g.response, null);
  return g;
}

void test('Ambassador quote applies high Wallach one-or-two Polar Sink and one-only Advanced alternative without mutation', () => {
  for (const advanced of [false, true]) {
    const g = fixture(advanced);
    const order = shipment(g);
    const before = reload(g);
    for (const amount of [1, 2] as const)
      assert.equal(
        quoteGuildAmbassadorAdvisor(g, 'b', order, {
          type: 'decision',
          amount,
        }).amount,
        amount,
      );
    assert.equal(
      quoteGuildAmbassadorAdvisor(g, 'b', order, { type: 'decision' }).amount,
      1,
    );
    if (advanced) {
      assert.equal(
        quoteGuildAmbassadorAdvisor(g, 'b', order, {
          type: 'decision',
          accompany: true,
        }).amount,
        1,
      );
      assert.throws(
        () =>
          quoteGuildAmbassadorAdvisor(g, 'b', order, {
            type: 'decision',
            accompany: true,
            amount: 2,
          }),
        /two requires/,
      );
    }
    for (const amount of [0, 3, 1.5, '2', null])
      assert.throws(() =>
        quoteGuildAmbassadorAdvisor(g, 'b', order, {
          type: 'decision',
          amount,
        }),
      );
    assert.deepEqual(g, before);
  }
});

void test('low Wallach suppresses all free Ambassador accompaniment while preserving direct shipment joining existing advisors', () => {
  const g = fixture(true, 10);
  const order = shipment(g);
  for (const accompany of [false, true])
    assert.throws(
      () =>
        quoteGuildAmbassadorAdvisor(g, 'b', order, {
          type: 'decision',
          accompany,
        }),
      /Low-population Wallach/,
    );
  bg(g).forces = { 'hagga_basin:12': 10 };
  bg(g).advisors = { hagga_basin: {} };
  ec(g).forces['hagga_basin:12'] = 1;
  ec(g).reserves--;
  const direct = quoteGuildAmbassadorShipment(g, 'b', {
    type: 'decision',
    amount: 2,
    territory: 'hagga_basin',
    sector: 12,
  });
  assert.equal(direct.advisors, true);
  assert.equal(direct.amount, 2);
});

void test('actual Basic and Advanced Ambassador shipments send one batch of two from 11 to 9 and restore the original entrant', () => {
  for (const advanced of [false, true]) {
    let g = arrive(fixture(advanced));
    assert.equal(g.decision?.kind, 'advisor');
    const source = structuredClone(g.pendingAmbassador!.shipmentReceipt!.order);
    const balances = g.players.map((p) => p.spice);
    const command = {
      type: 'decision',
      accept: true,
      amount: 2,
      accompany: false,
    };
    g = applyAction(reload(g), 'b', command);
    g = allow(g);
    assert.equal(bg(g).reserves, 9);
    assert.equal(bg(g).forces['polar_sink:0'], 11);
    assert.equal(ec(g).forces['hagga_basin:12'], source.amount);
    assert.deepEqual(
      g.players.map((p) => p.spice),
      balances,
    );
    assert.equal(g.pendingAmbassador, null);
    assert.equal(g.decision, null);
    assert.equal(g.active, 'a');
    assert.equal(g.players.find((p) => p.id === 'a')!.moved, 1);
    assert.equal(ec(g).shipped, false);
    assert.equal(bg(g).shipped, false);
    assertConserved(g);
    assert.deepEqual(normalizeAutomaticGame(reload(g)), reload(g));
    const before = reload(g);
    assert.throws(() => applyAction(g, 'b', command));
    assert.deepEqual(g, before);
  }
});

void test('actual low Wallach Ambassador shipment continues automatically without unavailable advisor input', () => {
  const g = arrive(fixture(true, 10));
  assert.equal(g.pendingAmbassador, null);
  assert.equal(g.decision, null);
  assert.equal(bg(g).reserves, 10);
  assert.equal(ec(g).forces['hagga_basin:12'], 2);
  assert.equal(g.active, 'a');
  assertConserved(g);
});

void test('restored Ambassador choice rechecks Wallach population and does not replay the committed shipment', () => {
  const g = arrive(fixture());
  assert.equal(g.decision?.kind, 'advisor');
  bg(g).reserves--;
  bg(g).forces['polar_sink:0']++;
  assertConserved(g);
  const before = reload(g);
  assert.throws(
    () =>
      applyAction(g, 'b', {
        type: 'decision',
        accept: true,
        amount: 2,
        accompany: false,
      }),
    /Low-population Wallach/,
  );
  assert.deepEqual(g, before);
});

void test('historical two-advisor receipt survives threshold crossing but rejects non-Sink or module-off fabrication', () => {
  const g = arrive(fixture());
  const entry = g.pendingAmbassador!;
  bg(g).reserves -= 2;
  bg(g).forces['polar_sink:0'] += 2;
  entry.shipmentReceipt!.next = 'finish';
  entry.shipmentReceipt!.advisorArrival = {
    player: 'b',
    territory: 'polar_sink',
    sector: 0,
    amount: 2,
    elite: 0,
  };
  const quote = (state: Game) =>
    validateGuildAmbassadorArrivalContext(state, entry.event, 'finish');
  assert.equal(quote(reload(g)).advisorArrival!.amount, 2);
  for (const mutate of [
    (state: Game) => {
      delete state.homeworlds;
    },
    (state: Game) => {
      Object.assign(state.pendingAmbassador!.shipmentReceipt!.advisorArrival!, {
        territory: 'hagga_basin',
        sector: 12,
      });
    },
    (state: Game) => {
      Object.assign(state.pendingAmbassador!.shipmentReceipt!.advisorArrival!, {
        amount: 3,
      });
    },
  ]) {
    const bad = reload(g);
    mutate(bad);
    const before = reload(bad);
    assert.throws(() => quote(bad));
    assert.deepEqual(bad, before);
  }
});

void test('a real ordinary Karama cancels the entire two-advisor grant but never reverts its Ambassador parent shipment', () => {
  let g = fixture();
  const index = g.deck.findIndex((card) => card.effect === 'karama');
  assert.ok(index >= 0);
  const [karama] = g.deck.splice(index, 1);
  ec(g).hand.push(karama);
  g = arrive(g);
  const reserves = ec(g).reserves;
  g = applyAction(reload(g), 'b', {
    type: 'decision',
    accept: true,
    amount: 2,
    accompany: false,
  });
  assert.equal(g.response?.kind, 'advisor');
  assert.equal(g.response?.amount, 2);
  assert.equal(bg(g).reserves, 11);
  g = applyAction(reload(g), 'e', {
    type: 'card',
    mode: 'cancel',
    card: karama.id,
  });
  assert.equal(bg(g).reserves, 11);
  assert.equal(bg(g).forces['polar_sink:0'], 9);
  assert.equal(ec(g).reserves, reserves);
  assert.equal(ec(g).forces['hagga_basin:12'], 2);
  assert.equal(g.discard.filter((card) => card.id === karama.id).length, 1);
  assert.equal(g.pendingAmbassador, null);
  assert.equal(g.active, 'a');
  assertConserved(g);
});

void test('Ambassador high-Wallach choices from every AI difficulty execute from their projected private seat', () => {
  const g = arrive(fixture());
  for (const level of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = viewGame(reload(g), 'b');
    view.players.find((p) => p.id === 'b')!.bot = level;
    const before = structuredClone(view);
    const actions = botActions(view);
    assert.ok(actions.length > 0);
    assert.deepEqual(view, before);
    for (const action of actions) {
      const next = applyAction(reload(g), 'b', action);
      assertConserved(next);
      for (const other of view.players.filter((p) => p.id !== 'b')) {
        assert.equal(other.hand, undefined);
        assert.equal(other.traitors, undefined);
      }
    }
  }
});
