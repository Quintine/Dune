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
import { baseDeck, spiceDeck, type Card } from '../game/cards';
import { createHomeworldCustody } from '../game/homeworld-custody';
import {
  homeworldContext,
  homeworldGameIntegrity,
} from '../game/homeworld-game';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { createAmbassadors, placeAmbassador } from '../game/ecaz-ambassadors';

const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
/** The CHOAM expansion deck/setup remains gated. These explicit market audit
 * scenarios retain real base-deck card identities and all physical counters;
 * they do not certify complete CHOAM setup or full Homeworld games. */
function fixture(reserves = 11, advanced = true, enabled = true) {
  const g = createGame(
    'TUPILESALES',
    newPlayer('c', 'CHOAM', 'choam'),
    advanced,
    ['choam'],
  );
  g.players.push(
    newPlayer('a', 'Atreides', 'atreides'),
    newPlayer('g', 'Guild', 'guild'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 2,
    turn: 2,
    storm: 18,
    order: ['c', 'a', 'g'],
    deck: baseDeck(),
    spiceDeck: spiceDeck(),
    phaseOpening: null,
    choamCharity: { turn: 2, canceled: false },
  });
  for (const player of g.players)
    Object.assign(player, {
      hand: [],
      spice: 20,
      traitors: [],
      traitorChoices: [],
      reserves: 20,
      forces: {},
      tanks: 0,
    });
  g.players[0].reserves = reserves;
  g.players[0].forces = { 'polar_sink:0': 20 - reserves };
  if (enabled)
    g.homeworlds = { custody: createHomeworldCustody(homeworldContext(g)) };
  homeworldGameIntegrity(g);
  return g;
}
function hold(g: Game, owner: string, predicate: (card: Card) => boolean) {
  const at = g.deck.findIndex(predicate);
  assert.ok(at >= 0);
  const card = g.deck.splice(at, 1)[0];
  g.players.find((p) => p.id === owner)!.hand.push(card);
  return card;
}
function open(g: Game) {
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.decision?.kind, 'choamMarket');
  return g;
}
function sell(g: Game, card: string, witness?: string) {
  return applyAction(g, 'c', {
    type: 'decision',
    mode: 'sell',
    card,
    ...(witness ? { witness } : {}),
  });
}
function allow(g: Game) {
  for (let n = 0; g.response && n < 10; n++) {
    const player = g.players.find((p) => {
      const c = viewGame(g, p.id).responseControls;
      return c && !c.hasPassed && c.cancelCards.length;
    });
    assert.ok(player, 'A real held cancellation card owns this choice.');
    g = applyAction(g, player.id, { type: 'passResponse' });
  }
  assert.equal(g.response, null);
  return g;
}
function inventory(g: Game) {
  homeworldGameIntegrity(g);
  for (const player of g.players)
    assert.equal(
      player.reserves +
        player.tanks +
        Object.values(player.forces).reduce((a, b) => a + b, 0),
      20,
    );
  const ids = [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]
    .map((card) => card.id)
    .sort();
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(
    ids,
    baseDeck()
      .map((card) => card.id)
      .sort(),
  );
}
function reject(g: Game, action: Action) {
  const before = reload(g);
  assert.throws(() => applyAction(g, 'c', action), /Tupile|Worthless/);
  assert.deepEqual(g, before);
}

void test('high Tupile rejects actual ordinary Worthless sales atomically at eleven in both modes', () => {
  for (const advanced of [false, true]) {
    let g = fixture(11, advanced);
    const card = hold(g, 'c', (card) => card.kind === 'worthless');
    g = open(g);
    const view = viewGame(g, 'c');
    assert.ok(view.choamMarket?.worthlessSaleBlocked);
    assert.deepEqual(view.choamMarket?.sales, []);
    assert.deepEqual(viewGame(g, 'a').choamMarket, { owner: 'c' });
    reject(g, { type: 'decision', mode: 'sell', card: card.id });
    inventory(g);
  }
});

void test('low Tupile and module-off retain real Worthless sale payment and physical discard after JSON refresh', () => {
  for (const enabled of [false, true])
    for (const advanced of [false, true]) {
      let g = fixture(enabled ? 10 : 11, advanced, enabled);
      const card = hold(g, 'c', (card) => card.kind === 'worthless');
      hold(g, 'a', (card) => card.effect === 'karama');
      g = open(g);
      assert.equal(viewGame(g, 'c').choamMarket?.worthlessSaleBlocked, null);
      assert.ok(
        viewGame(g, 'c').choamMarket?.sales?.some(
          (sale) => sale.card === card.id && sale.price === 2,
        ),
      );
      g = sell(g, card.id);
      assert.equal(g.response?.kind, 'choamSale');
      assert.equal(g.players[0].spice, 20);
      g = allow(reload(g));
      assert.equal(g.players[0].spice, 22);
      assert.equal(g.discard.filter((c) => c.id === card.id).length, 1);
      assert.ok(!g.players[0].hand.some((c) => c.id === card.id));
      assert.deepEqual(normalizeAutomaticGame(reload(g)), g);
      inventory(g);
    }
});

void test('duplicate Worthless price-three path cannot bypass high Tupile', () => {
  let g = fixture();
  const card = hold(g, 'c', (card) => card.kind === 'worthless');
  const witness = hold(g, 'c', (card) => card.kind === 'worthless');
  // Current implemented decks have distinct Worthless names. This narrow
  // legacy/future duplicate validation scenario retains distinct physical IDs.
  witness.name = card.name;
  g = open(g);
  assert.deepEqual(viewGame(g, 'c').choamMarket?.sales, []);
  reject(g, {
    type: 'decision',
    mode: 'sell',
    card: card.id,
    witness: witness.id,
  });
  inventory(g);
});

void test('high Tupile still sells a physical non-Worthless duplicate for three and retains its witness', () => {
  let g = fixture();
  const card = hold(g, 'c', (card) => card.name === 'Snooper');
  const witness = hold(g, 'c', (card) => card.name === 'Snooper');
  g = open(g);
  assert.ok(
    viewGame(g, 'c').choamMarket?.sales?.some(
      (sale) =>
        sale.card === card.id &&
        sale.witness === witness.id &&
        sale.price === 3,
    ),
  );
  g = allow(sell(g, card.id, witness.id));
  assert.equal(g.players[0].spice, 23);
  assert.deepEqual(
    g.players[0].hand.map((c) => c.id),
    [witness.id],
  );
  assert.equal(g.discard.filter((c) => c.id === card.id).length, 1);
  inventory(g);
});

void test('high Tupile retains private allied Worthless trades with real selection and confirmation', () => {
  let g = fixture();
  const card = hold(g, 'c', (card) => card.kind === 'worthless');
  const returned = hold(g, 'a', (card) => card.name === 'Shield');
  g.players[0].ally = 'a';
  g.players[1].ally = 'c';
  g = open(g);
  g = applyAction(g, 'c', { type: 'decision', mode: 'trade', card: card.id });
  assert.deepEqual(viewGame(g, 'g').choamMarket, { owner: 'c' });
  assert.equal(viewGame(g, 'a').choamMarket?.offered?.id, card.id);
  g = applyAction(reload(g), 'a', { type: 'decision', card: returned.id });
  g = applyAction(reload(g), 'c', { type: 'decision', accept: true });
  assert.deepEqual(
    g.players[0].hand.map((c) => c.id),
    [returned.id],
  );
  assert.deepEqual(
    g.players[1].hand.map((c) => c.id),
    [card.id],
  );
  assert.equal(g.players[0].spice, 20);
  inventory(g);
});

void test('high Tupile expressly permits Advanced CHOAM Karama cash-in of a Worthless card', () => {
  let g = fixture();
  const card = hold(g, 'c', (card) => card.kind === 'worthless');
  const karama = hold(g, 'c', (card) => card.effect === 'karama');
  g.phase = 4;
  assert.ok(viewGame(g, 'c').choamCashIn?.cards.some((c) => c.id === card.id));
  g = applyAction(g, 'c', {
    type: 'card',
    mode: 'special',
    card: karama.id,
    cards: [card.id],
  });
  assert.equal(g.players[0].spice, 23);
  assert.equal(g.players[0].specialKaramaUsed, true);
  assert.equal(
    g.discard.filter((c) => [card.id, karama.id].includes(c.id)).length,
    2,
  );
  inventory(g);
});

void test('all four AI profiles use filtered high-Tupile sale choices and execute a legal action', () => {
  for (const difficulty of DIFFICULTIES) {
    let g = fixture();
    const worthless = hold(g, 'c', (card) => card.kind === 'worthless');
    hold(g, 'c', (card) => card.name === 'Snooper');
    hold(g, 'c', (card) => card.name === 'Snooper');
    g = open(g);
    const view = viewGame(g, 'c');
    view.players.find((p) => p.id === 'c')!.bot = difficulty;
    const actions = botActions(view);
    assert.ok(actions.length);
    assert.ok(
      !actions.some(
        (a) =>
          a.type === 'decision' && a.mode === 'sell' && a.card === worthless.id,
      ),
    );
    const next = applyAction(reload(g), 'c', actions[0]);
    assert.ok(next.players[0].hand.some((card) => card.id === worthless.id));
    inventory(next);
  }
});

void test('Ghola crossing to high Tupile during the saved sale response abandons payment and preserves the sale card', () => {
  for (const cancel of [false, true]) {
    let g = fixture(10);
    g.players[0].forces['polar_sink:0']--;
    g.players[0].tanks = 1;
    const card = hold(g, 'c', (card) => card.kind === 'worthless');
    const ghola = hold(g, 'c', (card) => card.effect === 'ghola');
    const karama = hold(g, 'a', (card) => card.effect === 'karama');
    g = sell(open(g), card.id);
    assert.equal(g.response?.kind, 'choamSale');
    g = applyAction(reload(g), 'c', {
      type: 'card',
      card: ghola.id,
      amount: 1,
      elite: 0,
    });
    g = normalizeAutomaticGame(reload(g));
    assert.equal(g.players[0].reserves, 11);
    assert.equal(g.response?.kind, 'choamSale');
    assert.ok(viewGame(g, 'c').choamMarket?.worthlessSaleBlocked);
    g = cancel
      ? applyAction(reload(g), 'a', {
          type: 'card',
          mode: 'cancel',
          card: karama.id,
        })
      : allow(reload(g));
    assert.equal(g.players[0].spice, 20);
    assert.ok(g.players[0].hand.some((c) => c.id === card.id));
    assert.equal(g.discard.filter((c) => c.id === card.id).length, 0);
    assert.equal(g.discard.filter((c) => c.id === ghola.id).length, 1);
    assert.equal(
      g.discard.filter((c) => c.id === karama.id).length,
      cancel ? 1 : 0,
    );
    assert.equal(g.response, null);
    assert.equal(g.decision?.kind, 'choamMarket');
    assert.deepEqual(normalizeAutomaticGame(reload(g)), g);
    inventory(g);
  }
});

/** Actual territory entry and Ecaz's owned beneficiary choice exercise the
 * Ambassador path independently of ordinary end-of-phase market sales. */
function ambassadorScenario(
  effect: 'choam' | 'ixians',
  reserves = 11,
  beneficiary: 'c' | 'ec' = 'c',
  onlyWorthless = false,
) {
  let g = fixture(reserves);
  g.players[2] = newPlayer('ec', 'Ecaz', 'ecaz');
  g.players[2].spice = 20;
  g.players[0].ally = 'ec';
  g.players[2].ally = 'c';
  Object.assign(g, {
    phase: 5,
    active: 'a',
    order: ['a', 'ec', 'c'],
    movementRemaining: ['a', 'ec', 'c'],
  });
  g.homeworlds = { custody: createHomeworldCustody(homeworldContext(g)) };
  const worthless = hold(g, beneficiary, (card) => card.kind === 'worthless');
  const ordinary = onlyWorthless
    ? null
    : hold(g, beneficiary, (card) => card.name === 'Shield');
  const state = createAmbassadors(() => 0);
  const chosen = state.tokens.find((token) => token.effect === effect)!;
  state.cohort = [
    chosen,
    ...state.tokens.filter((token) => !['ecaz', effect].includes(token.effect)),
  ]
    .slice(0, 5)
    .map((token) => token.id);
  for (const token of state.tokens) {
    token.zone =
      token.effect === 'ecaz' || state.cohort.includes(token.id)
        ? 'supply'
        : 'pool';
    token.location = null;
  }
  g.ecazAmbassadors = placeAmbassador(state, chosen.id, {
    turn: 1,
    availableSpice: 20,
    destination: {
      id: 'arrakeen',
      stronghold: true,
      inStorm: false,
      allowed: true,
    },
  }).state;
  g = applyAction(g, 'a', {
    type: 'ship',
    territory: 'arrakeen',
    sector: 10,
    amount: 2,
  });
  assert.equal(g.pendingAmbassador?.stage, 'offer');
  g = applyAction(reload(g), 'ec', {
    type: 'decision',
    event: g.pendingAmbassador!.event,
    trigger: true,
    beneficiary,
  });
  return { g, worthless, ordinary };
}

void test('high native Tupile blocks Worthless CHOAM Ambassador bank income while allowing an ordinary card payout', () => {
  const { g: opened, worthless, ordinary } = ambassadorScenario('choam');
  let g = opened;
  assert.ok(ordinary);
  assert.equal(g.pendingAmbassador?.stage, 'cards');
  const controls = viewGame(g, 'c').ambassadorEntry!.cards;
  assert.match(
    controls.find((card) => card.card === worthless.id)!.blocked!,
    /Tupile/,
  );
  assert.equal(
    controls.find((card) => card.card === ordinary.id)!.blocked,
    null,
  );
  assert.deepEqual(viewGame(g, 'a').ambassadorEntry!.cards, []);
  assert.deepEqual(viewGame(g, 'ec').ambassadorEntry!.cards, []);
  reject(g, {
    type: 'decision',
    event: g.pendingAmbassador!.event,
    cards: [worthless.id],
  });
  reject(g, {
    type: 'decision',
    event: g.pendingAmbassador!.event,
    cards: [ordinary.id, worthless.id],
  });
  g = applyAction(reload(g), 'c', {
    type: 'decision',
    event: g.pendingAmbassador!.event,
    cards: [ordinary.id],
  });
  assert.equal(g.players[0].spice, 23);
  assert.ok(g.players[0].hand.some((card) => card.id === worthless.id));
  assert.equal(g.discard.filter((card) => card.id === ordinary.id).length, 1);
  assert.equal(g.pendingAmbassador, null);
  inventory(g);
});

void test('high Tupile still permits an Ixian Ambassador Worthless discard for a replacement card', () => {
  const { g: initial, worthless } = ambassadorScenario('ixians', 11, 'c', true);
  let g = initial;
  assert.equal(
    viewGame(g, 'c').ambassadorEntry!.cards.find(
      (card) => card.card === worthless.id,
    )?.blocked,
    null,
  );
  const next = g.deck[0].id;
  g = applyAction(reload(g), 'c', {
    type: 'decision',
    event: g.pendingAmbassador!.event,
    cards: [worthless.id],
  });
  assert.equal(g.players[0].spice, 20);
  assert.deepEqual(
    g.players[0].hand.map((card) => card.id),
    [next],
  );
  assert.equal(g.discard.filter((card) => card.id === worthless.id).length, 1);
  assert.equal(g.pendingAmbassador, null);
  inventory(g);
});

void test('CHOAM Ambassador Worthless income remains available at low Tupile and for a different beneficiary faction', () => {
  for (const [reserves, beneficiary] of [
    [10, 'c'],
    [11, 'ec'],
  ] as const) {
    const { g: initial, worthless } = ambassadorScenario(
      'choam',
      reserves,
      beneficiary,
      true,
    );
    let g = initial;
    assert.equal(g.pendingAmbassador?.stage, 'cards');
    assert.equal(
      viewGame(g, beneficiary).ambassadorEntry!.cards.find(
        (card) => card.card === worthless.id,
      )?.blocked,
      null,
    );
    g = applyAction(reload(g), beneficiary, {
      type: 'decision',
      event: g.pendingAmbassador!.event,
      cards: [worthless.id],
    });
    assert.equal(
      g.players.find((player) => player.id === beneficiary)!.spice,
      23,
    );
    assert.equal(
      g.discard.filter((card) => card.id === worthless.id).length,
      1,
    );
    assert.equal(g.pendingAmbassador, null);
    inventory(g);
  }
});

void test('CHOAM Ambassador with only blocked high-Tupile Worthless cards finishes automatically without a choice or income', () => {
  const { g, worthless } = ambassadorScenario('choam', 11, 'c', true);
  assert.equal(g.pendingAmbassador, null);
  assert.equal(g.decision, null);
  assert.equal(g.players[0].spice, 20);
  assert.ok(g.players[0].hand.some((card) => card.id === worthless.id));
  assert.deepEqual(normalizeAutomaticGame(reload(g)), g);
  inventory(g);
});

void test('saved Ghola market parent binds the completed physical card and actor during later income', () => {
  let g = fixture(10);
  g.players[2] = newPlayer('t', 'Tleilaxu', 'tleilaxu');
  g.players[2].spice = 20;
  g.order = ['c', 'a', 't'];
  g.homeworlds = { custody: createHomeworldCustody(homeworldContext(g)) };
  g.players[0].forces['polar_sink:0']--;
  g.players[0].tanks = 1;
  const sale = hold(g, 'c', (card) => card.kind === 'worthless');
  const ghola = hold(g, 'c', (card) => card.effect === 'ghola');
  hold(g, 'a', (card) => card.effect === 'karama');
  g = sell(open(g), sale.id);
  g = applyAction(reload(g), 'c', {
    type: 'card',
    card: ghola.id,
    amount: 1,
    elite: 0,
  });
  assert.ok(g.pendingChoamMarketGhola);
  assert.equal(g.pendingTreacheryDiscard, null);
  assert.ok(
    g.response,
    'The live Tleilaxu income response retains the original market parent.',
  );
  for (const mutate of [
    (saved: Game) => {
      saved.pendingChoamMarketGhola!.card = sale.id;
    },
    (saved: Game) => {
      saved.pendingChoamMarketGhola!.player = 'a';
    },
  ]) {
    const broken = reload(g);
    mutate(broken);
    const before = reload(broken);
    assert.throws(() => viewGame(broken, 'c'), /Ghola|market|sale/i);
    assert.throws(() => normalizeAutomaticGame(broken), /Ghola|market|sale/i);
    assert.deepEqual(broken, before);
  }
});

void test('all four AI profiles can play their owned Ghola during another faction’s pending sale and preserve that sale', () => {
  for (const difficulty of DIFFICULTIES) {
    let g = fixture(10);
    const actor = g.players[1];
    Object.assign(actor, {
      reserves: 5,
      tanks: 5,
      forces: { 'imperial_basin:10': 10 },
    });
    const sale = hold(g, 'c', (card) => card.kind === 'worthless');
    const ghola = hold(g, 'a', (card) => card.effect === 'ghola');
    const cancel = hold(g, 'g', (card) => card.effect === 'karama');
    g = sell(open(g), sale.id);
    const response = reload(g).response;
    assert.equal(response?.kind, 'choamSale');
    const view = viewGame(g, 'a');
    assert.ok(view.ghola.available);
    view.players.find((p) => p.id === 'a')!.bot = difficulty;
    const action = botActions(view).find(
      (action) => action.type === 'card' && action.card === ghola.id,
    );
    assert.ok(
      action,
      `${difficulty} should find a legal five-force Ghola revival during the sale.`,
    );
    g = applyAction(reload(g), 'a', action);
    assert.equal(g.players[1].reserves, 10);
    assert.equal(g.players[1].tanks, 0);
    assert.equal(g.discard.filter((card) => card.id === ghola.id).length, 1);
    assert.deepEqual(g.response, response);
    assert.equal(g.players[0].spice, 20);
    assert.ok(g.players[0].hand.some((card) => card.id === sale.id));
    assert.ok(g.players[2].hand.some((card) => card.id === cancel.id));
    g = allow(reload(g));
    assert.equal(g.players[0].spice, 22);
    assert.equal(g.discard.filter((card) => card.id === sale.id).length, 1);
    inventory(g);
  }
});
