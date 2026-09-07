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
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
function fixture(allied = true) {
  const g = createGame('CFORCES2', newPlayer('c', 'CHOAM', 'choam'), true, [
    'choam',
  ]);
  g.players.push(
    newPlayer('g', 'Guild', 'guild'),
    newPlayer('e', 'Emperor', 'emperor'),
  );
  g.status = 'playing';
  g.phase = 6;
  g.storm = 18;
  g.active = 'g';
  g.order = ['g', 'e', 'c'];
  g.deck = baseDeck();
  for (const p of g.players) {
    p.spice = 10;
    p.traitorChoices = [];
    p.traitors = [];
    p.hand = [];
    p.forces = p.id === 'c' ? {} : { 'red_chasm:7': 8 };
    p.reserves = p.id === 'c' ? 20 : 12;
    for (const l of p.leaders) l.strength = 0;
  }
  if (allied) {
    g.players[0].ally = 'g';
    g.players[1].ally = 'c';
  }
  return g;
}
const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const send = (g: Game, id: string, a: Action) => applyAction(g, id, a);
function contest(g: Game, id = 'e') {
  hold(g, id, 'Karama');
  return g;
}
function allow(state: Game) {
  let g = state;
  for (let n = 0; g.response && n < 30; n++)
    g = send(
      g,
      g.players.find(
        (p) =>
          !viewGame(g, p.id).responseControls?.hasPassed &&
          !!viewGame(g, p.id).responseControls?.cancelCards.length,
      )!.id,
      {
        type: 'passResponse',
      },
    );
  assert.equal(g.response, null);
  return g;
}
function start(state = fixture(), amount = 0) {
  let g = send(state, 'g', {
    type: 'chooseBattle',
    territory: 'red_chasm',
    target: 'e',
  });
  if (g.decision?.kind === 'choamBattleFunding')
    g = send(g, 'c', { type: 'decision', amount });
  return allow(g);
}
function plan(
  g: Game,
  id: string,
  support: number,
  extra: Record<string, unknown> = {},
) {
  return send(g, id, {
    type: 'battlePlan',
    dial: support,
    support,
    leader: player(g, id).leaders[0]?.id ?? null,
    ...extra,
  });
}
function settle(state: Game, call: string[] = []) {
  let g = state;
  for (const id of ['g', 'e'])
    if (g.battle)
      g = send(g, id, { type: 'traitorCall', call: call.includes(id) });
  for (
    let n = 0;
    g.decision &&
    ['battleLosses', 'battleCards'].includes(g.decision.kind) &&
    n < 8;
    n++
  ) {
    const d = g.decision;
    g = send(
      g,
      d.player,
      d.kind === 'battleLosses'
        ? { type: 'decision', choice: 0 }
        : { type: 'decision', discard: [] },
    );
  }
  return g;
}
function hold(g: Game, id: string, name: string) {
  const i = g.deck.findIndex((c) => c.name === name);
  assert.ok(i >= 0);
  const card = g.deck.splice(i, 1)[0];
  player(g, id).hand.push(card);
  return card.id;
}
void test('CHOAM explicitly funds its ally before battle preparation; unrelated battles have no funding decision', () => {
  let g = send(contest(fixture()), 'g', {
    type: 'chooseBattle',
    territory: 'red_chasm',
    target: 'e',
  });
  assert.equal(g.decision?.kind, 'choamBattleFunding');
  assert.throws(
    () => send(g, 'g', { type: 'decision', amount: 3 }),
    /pending decision/,
  );
  assert.throws(() => plan(g, 'g', 3), /pending decision/);
  g = send(g, 'c', { type: 'decision', amount: 4 });
  assert.equal(player(g, 'c').spice, 6);
  assert.equal(g.response?.kind, 'choamBattleAid');
  assert.equal(start(fixture(false)).decision, null);
});
void test('only advanced CHOAM may pledge during Battle, with mutual alliance and atomic affordable amounts', () => {
  const g = fixture();
  const snapshot = structuredClone(g);
  for (const amount of [-1, 11, 1.5, '2'])
    assert.throws(() => send(g, 'c', { type: 'pledgeAid', amount }), RuleError);
  assert.throws(
    () => send(g, 'g', { type: 'pledgeAid', amount: 2 }),
    RuleError,
  );
  assert.deepEqual(g, snapshot);
  g.advanced = false;
  assert.throws(
    () => send(g, 'c', { type: 'pledgeAid', amount: 2 }),
    RuleError,
  );
  g.advanced = true;
  player(g, 'g').ally = null;
  assert.throws(
    () => send(g, 'c', { type: 'pledgeAid', amount: 2 }),
    RuleError,
  );
});
void test('a sealed plan combines real own spice and reserved CHOAM spice, then locks only its declared shares', () => {
  const initial = contest(fixture());
  player(initial, 'g').spice = 2;
  let g = start(initial, 4);
  g = plan(g, 'g', 5);
  assert.equal(g.battle!.plans.g.allyPayment, 3);
  assert.equal(player(g, 'g').spice, 2);
  assert.equal(g.aid.c.amount, 4);
  assert.throws(
    () => send(g, 'c', { type: 'pledgeAid', amount: 2 }),
    RuleError,
  );
  assert.throws(
    () => send(g, 'g', { type: 'bribe', target: 'e', amount: 1 }),
    RuleError,
  );
  g = send(g, 'c', { type: 'pledgeAid', amount: 3 });
  assert.equal(player(g, 'c').spice, 7);
  g = settle(plan(g, 'e', 3));
  assert.equal(player(g, 'g').spice, 0);
  assert.equal(g.aid.c.amount, 0);
  assert.equal(player(g, 'e').spice, 7);
  assert.equal(g.response?.kind, 'choamBattleIncome');
  assert.equal(g.response.amount, 2);
  assert.equal(player(g, 'c').spice, 7);
  g = allow(g);
  assert.equal(player(g, 'c').spice, 9);
});
void test('the ally can choose CHOAM to pay despite having its own spice; forged or unfunded shares fail', () => {
  const g = start(fixture(), 4);
  assert.throws(() => plan(g, 'g', 3, { allyPayment: 4 }), RuleError);
  assert.throws(() => plan(g, 'e', 3, { allyPayment: 1 }), RuleError);
  assert.throws(() => plan(g, 'g', 3, { allyPayment: -1 }), RuleError);
  const result = settle(plan(plan(g, 'g', 3, { allyPayment: 3 }), 'e', 2));
  assert.equal(player(result, 'g').spice, 10);
  assert.equal(result.aid.c.amount, 1);
  assert.equal(result.response, null);
  assert.equal(player(result, 'c').spice, 7); // Six after funding, plus one from opponent; no self rebate.
});
void test('income rounds down each other player payment and is collected only once after combat choices', () => {
  let g = settle(plan(plan(start(fixture(false)), 'g', 3), 'e', 3));
  assert.equal(g.response, null);
  assert.equal(player(g, 'c').spice, 12); // No cancellation choice: income settles immediately.
  g = allow(g);
  assert.equal(player(g, 'c').spice, 12);
  assert.equal(g.pendingChoamBattleIncome, null);
  assert.equal(g.decision?.kind, 'choamMarket');
  g = send(g, 'c', { type: 'decision', done: true });
  assert.equal(player(g, 'c').spice, 12);
});
void test('Karama redirects just this battle income to the bank without refunding force payments', () => {
  const initial = fixture(false);
  const card = hold(initial, 'e', 'Karama');
  let g = settle(plan(plan(start(initial), 'g', 4), 'e', 2));
  g = send(g, 'e', { type: 'card', card, mode: 'cancel' });
  assert.equal(player(g, 'c').spice, 10);
  assert.equal(player(g, 'g').spice, 6);
  assert.equal(player(g, 'e').spice, 8);
  assert.equal(g.pendingChoamBattleIncome, null);
  assert.equal(g.decision?.kind, 'choamMarket');
  assert.equal(
    g.discard.some((c) => c.id === card),
    true,
  );
});
void test('canceling CHOAM allied funding leaves escrow intact but makes the ally plan with its own wealth', () => {
  const initial = fixture();
  player(initial, 'g').spice = 0;
  const card = hold(initial, 'e', 'Karama');
  let g = send(initial, 'g', {
    type: 'chooseBattle',
    territory: 'red_chasm',
    target: 'e',
  });
  g = send(g, 'c', { type: 'decision', amount: 4 });
  g = send(g, 'e', { type: 'card', card, mode: 'cancel' });
  assert.equal(g.battle?.choamAidBlocked, true);
  assert.equal(g.aid.c.amount, 4);
  assert.equal(viewGame(g, 'g').aid.available, 0);
  assert.throws(() => plan(g, 'g', 1), RuleError);
  g = send(g, 'c', { type: 'pledgeAid', amount: 5 });
  assert.throws(() => plan(g, 'g', 1), RuleError);
  g = settle(plan(plan(g, 'g', 0, { dial: 4 }), 'e', 2));
  g = allow(g);
  g = send(g, 'c', { type: 'decision', done: true });
  assert.deepEqual(g.aid, {});
  assert.equal(player(g, 'c').spice, 11);
});
void test('traitor victory preserves the winning side support and all CHOAM income is suppressed', () => {
  const initial = fixture();
  player(initial, 'g').spice = 0;
  player(initial, 'g').traitors = [player(initial, 'e').leaders[0].id];
  let g = start(initial, 4);
  g = settle(plan(plan(g, 'g', 3), 'e', 3), ['g']);
  assert.equal(player(g, 'g').spice, 0);
  assert.equal(g.aid.c.amount, 4);
  assert.equal(player(g, 'e').spice, 7);
  assert.equal(player(g, 'c').spice, 6);
  assert.equal(g.pendingChoamBattleIncome ?? null, null);
  g = send(g, 'c', { type: 'decision', done: true });
  assert.equal(player(g, 'c').spice, 10);
});
void test('mutual traitors still consume both support payments but give no CHOAM income', () => {
  const initial = fixture(false);
  player(initial, 'g').traitors = [player(initial, 'e').leaders[0].id];
  player(initial, 'e').traitors = [player(initial, 'g').leaders[0].id];
  const g = settle(plan(plan(start(initial), 'g', 3), 'e', 3), ['g', 'e']);
  assert.equal(player(g, 'g').spice, 7);
  assert.equal(player(g, 'e').spice, 7);
  assert.equal(player(g, 'c').spice, 10);
  assert.equal(g.response, null);
});
void test('CHOAM own support goes entirely to the bank; only its opponent contributes income', () => {
  let g = fixture(false);
  player(g, 'c').forces = { 'red_chasm:7': 8 };
  player(g, 'c').reserves = 12;
  player(g, 'g').forces = {};
  g.active = 'c';
  g.order = ['c', 'e', 'g'];
  g = send(g, 'c', {
    type: 'chooseBattle',
    territory: 'red_chasm',
    target: 'e',
  });
  g = allow(g);
  g = plan(plan(g, 'c', 4), 'e', 3);
  g = send(g, 'c', { type: 'traitorCall', call: false });
  g = send(g, 'e', { type: 'traitorCall', call: false });
  assert.equal(player(g, 'c').forces['red_chasm:7'], 4);
  assert.equal(player(g, 'c').tanks, 4);
  assert.equal(g.response, null);
  g = allow(g);
  assert.equal(player(g, 'c').spice, 7);
});
void test('no income response occurs for basic combat or payments too small to produce income', () => {
  let g = fixture(false);
  g.advanced = false;
  g = settle(plan(plan(start(g), 'g', 3), 'e', 2));
  assert.equal(g.response, null);
  assert.equal(player(g, 'c').spice, 10);
  g = settle(plan(plan(start(fixture(false)), 'g', 1), 'e', 1));
  assert.equal(g.response, null);
});
void test('private projections and reconnects retain reserved funding without revealing an ally plan or spice', () => {
  const initial = fixture();
  player(initial, 'g').spice = 1;
  const g = plan(start(initial, 4), 'g', 4);
  const own = viewGame(g, 'g'),
    donor = viewGame(g, 'c'),
    observer = viewGame(g, 'e');
  assert.equal(own.aid.available, 4);
  assert.equal(donor.aid.pledged, 4);
  assert.equal(observer.aid.available, 0);
  assert.equal(donor.players.find((p) => p.id === 'g')!.spice, undefined);
  assert.equal(donor.battle?.plans.g, undefined);
  assert.equal(observer.battle?.plans.g, undefined);
  assert.deepEqual(viewGame(JSON.parse(JSON.stringify(g)), 'g'), own);
  const waiting = settle(plan(g, 'e', 2));
  assert.deepEqual(allow(JSON.parse(JSON.stringify(waiting))), allow(waiting));
});
void test('all AI levels allocate allied support, use funded legal plans and finish income responses', () => {
  for (const difficulty of DIFFICULTIES) {
    let g = fixture();
    for (const p of g.players) p.bot = difficulty;
    player(g, 'g').spice = 0;
    g = send(g, 'g', {
      type: 'chooseBattle',
      territory: 'red_chasm',
      target: 'e',
    });
    const funding = botActions(viewGame(g, 'c'))[0];
    assert.equal(funding.type, 'decision');
    assert.ok(Number(funding.amount) > 0);
    g = send(g, 'c', funding);
    g = allow(g);
    const actions = botActions(viewGame(g, 'g'));
    assert.ok(actions.some((a) => a.type === 'battlePlan'));
    const legal = actions.find((a) => {
      try {
        send(g, 'g', a);
        return true;
      } catch {
        return false;
      }
    });
    assert.ok(legal);
    g = send(g, 'g', legal);
    assert.ok((g.battle?.plans.g.support ?? 0) <= g.aid.c.amount);
    g = settle(plan(g, 'e', 3));
    if (g.response) {
      const action = botActions(viewGame(g, 'c'))[0];
      assert.equal(action.type, 'passResponse');
    }
  }
});
void test('a binding supported-dial promise is feasible through existing CHOAM funding and protects its own share', () => {
  const initial = fixture();
  player(initial, 'g').spice = 1;
  let g = start(initial, 4);
  g.battle!.truthPromises = [
    {
      player: 'g',
      asker: 'e',
      claim: { kind: 'support', compare: 'gte', value: 5 },
      answer: true,
    },
  ];
  const completion = viewGame(g, 'g').battle!.compliantPlan;
  assert.ok(completion);
  assert.equal(completion.allyPayment, 4);
  g = send(g, 'g', { type: 'battlePlan', ...completion });
  assert.throws(
    () => send(g, 'c', { type: 'pledgeAid', amount: 3 }),
    RuleError,
  );
});
void test('canceling allied aid affects one battle; the same unspent pledge can fund a later territory', () => {
  const initial = fixture();
  for (const id of ['g', 'e']) {
    player(initial, id).forces['rock_outcroppings:13'] = 3;
    player(initial, id).reserves -= 3;
  }
  const card = hold(initial, 'e', 'Karama');
  let g = send(initial, 'g', {
    type: 'chooseBattle',
    territory: 'red_chasm',
    target: 'e',
  });
  g = send(g, 'c', { type: 'decision', amount: 4 });
  g = send(g, 'e', { type: 'card', card, mode: 'cancel' });
  g = settle(plan(plan(g, 'g', 1), 'e', 1));
  assert.equal(g.active, 'g');
  assert.equal(g.aid.c.amount, 4);
  g = send(g, 'g', {
    type: 'chooseBattle',
    territory: 'rock_outcroppings',
    target: 'e',
  });
  g = send(g, 'c', { type: 'decision', amount: 4 });
  g = allow(g);
  assert.equal(g.battle?.choamAidBlocked, false);
  assert.equal(viewGame(g, 'g').aid.available, 4);
  const leader = player(g, 'g').leaders.find((l) => !l.usedAt)!.id;
  g = plan(g, 'g', 3, { allyPayment: 3, leader });
  assert.equal(g.battle!.plans.g.allyPayment, 3);
});
void test('lasgun–shield explosion still pays support and CHOAM income when no traitor is revealed', () => {
  const initial = fixture(false);
  const weapon = hold(initial, 'g', 'Lasgun');
  const defense = hold(initial, 'e', 'Shield');
  let g = start(initial);
  g = plan(g, 'g', 4, { weapon });
  g = plan(g, 'e', 2, { defense });
  g = settle(g);
  assert.equal(g.response, null);
  assert.equal(player(g, 'c').spice, 13);
  assert.equal(player(g, 'g').tanks, 8);
  assert.equal(player(g, 'e').tanks, 8);
  g = allow(g);
  assert.equal(player(g, 'c').spice, 13);
});
void test('free Fremen support produces no income, while its paying opponent does', () => {
  const initial = fixture(false);
  const fremen = newPlayer('g', 'Fremen', 'fremen');
  Object.assign(fremen, {
    forces: { 'red_chasm:7': 8 },
    reserves: 12,
    spice: 0,
    traitorChoices: [],
    traitors: [],
  });
  for (const l of fremen.leaders) l.strength = 0;
  initial.players[1] = fremen;
  const g = settle(plan(plan(start(initial), 'g', 0, { dial: 5 }), 'e', 3));
  assert.equal(g.response, null);
  assert.equal(player(g, 'c').spice, 11);
  assert.equal(player(g, 'g').spice, 0);
});
void test('Bene Gesserit Worthless Karama cancellation preserves the pending income through its counter-window', () => {
  const initial = fixture(false);
  const bg = newPlayer('b', 'Bene Gesserit', 'beneGesserit');
  initial.players.push(bg);
  initial.order.push('b');
  const worthless = hold(initial, 'b', 'Baliset');
  contest(initial);
  let g = settle(plan(plan(start(initial), 'g', 4), 'e', 2));
  g = send(g, 'b', { type: 'card', card: worthless, mode: 'cancel' });
  assert.equal(g.response?.kind, 'worthlessKarama');
  assert.equal(g.pendingChoamBattleIncome?.amount, 3);
  g = allow(JSON.parse(JSON.stringify(g)));
  assert.equal(player(g, 'c').spice, 10);
  assert.equal(g.pendingChoamBattleIncome, null);
});
void test('full-plan prescience offer survives the CHOAM funding decision and cancellation sequence', () => {
  const initial = fixture();
  initial.players.push(newPlayer('a', 'Atreides', 'atreides'));
  initial.order.push('a');
  let g = send(initial, 'g', {
    type: 'chooseBattle',
    territory: 'red_chasm',
    target: 'e',
  });
  assert.equal(g.decision?.kind, 'choamBattleFunding');
  g = send(g, 'c', { type: 'decision', amount: 3 });
  assert.equal(g.decision?.kind, 'fullPlanOffer');
  g = allow(g);
  assert.equal(g.decision?.kind, 'fullPlanOffer');
  assert.equal(g.decision.player, 'a');
  g = send(g, 'a', { type: 'decision', decline: true });
  assert.equal(g.decision, null);
  assert.equal(g.aid.c.amount, 3);
  g = plan(g, 'g', 3, { allyPayment: 3 });
  assert.equal(g.battle!.plans.g.allyPayment, 3);
});
void test('each AI level fulfills a five-spice support promise using its CHOAM pledge and no own spice', () => {
  for (const difficulty of DIFFICULTIES) {
    const initial = fixture();
    player(initial, 'g').spice = 0;
    player(initial, 'g').bot = difficulty;
    let g = start(initial, 5);
    g.battle!.truthPromises = [
      {
        player: 'g',
        asker: 'e',
        claim: { kind: 'support', compare: 'eq', value: 5 },
        answer: true,
      },
    ];
    const actions = botActions(viewGame(g, 'g'));
    let result: Game | undefined;
    for (const action of actions) {
      try {
        result = send(g, 'g', action);
        break;
      } catch {
        /* Candidate must pass the authoritative validator. */
      }
    }
    assert.ok(result, difficulty);
    g = result;
    assert.equal(g.battle!.plans.g.support, 5);
    assert.equal(g.battle!.plans.g.allyPayment, 5);
  }
});
