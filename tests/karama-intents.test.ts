import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  prepareSpecialKaramaIntent,
  executeSpecialKaramaIntent,
  type Action,
  type Game,
} from '../game/engine';
import { treacheryDeck } from '../game/cards';
import { mobileRoutes, MOBILE_LOCATION } from '../game/board';
import type { FactionId } from '../game/catalog';

function fixture(faction: FactionId) {
  const g = createGame('INTENT22', newPlayer('p', 'Actor', faction), true, [
    'ix',
    'choam',
  ]);
  g.players.push(
    newPlayer(
      'q',
      'Opponent',
      faction === 'harkonnen' ? 'atreides' : 'harkonnen',
    ),
  );
  g.status = 'playing';
  g.phase = 4;
  g.order = ['p', 'q'];
  g.active = 'p';
  g.deck = treacheryDeck(['ix']);
  for (const p of g.players) {
    p.spice = 20;
    p.traitorChoices = [];
    p.traitors = [];
  }
  hold(g, 'p', 'Karama');
  return g;
}
function hold(g: Game, owner: string, name: string) {
  const index = g.deck.findIndex((card) => card.name === name);
  assert.ok(index >= 0, name);
  const card = g.deck.splice(index, 1)[0];
  g.players.find((p) => p.id === owner)!.hand.push(card);
  return card.id;
}
function action(g: Game, extra: Record<string, unknown> = {}): Action {
  return {
    type: 'card',
    mode: 'special',
    card: g.players[0].hand.find((card) => card.effect === 'karama')!.id,
    ...extra,
  };
}
function emperor() {
  const g = fixture('emperor');
  g.players[0].tanks = 5;
  g.players[0].reserves = 15;
  g.players[0].elites = { tanks: 2, reserves: 3, forces: {}, revived: 0 };
  return g;
}
function guild() {
  const g = fixture('guild');
  g.phase = 5;
  g.active = 'q';
  g.pendingShipment = {
    player: 'q',
    territory: 'arrakeen',
    sector: 10,
    amount: 2,
    elite: 0,
    cost: 2,
    allyPayment: 0,
    advisors: false,
  };
  g.decision = {
    kind: 'guildShipment',
    player: 'p',
    shipper: 'q',
    territory: 'arrakeen',
    sector: 10,
    amount: 2,
  };
  return g;
}
function tleilaxu() {
  const g = fixture('tleilaxu');
  g.pendingRevival = {
    player: 'q',
    kind: 'forces',
    amount: 2,
    elite: 0,
    normalCost: 0,
    cost: 0,
    free: 2,
    checks: [],
  };
  g.decision = {
    kind: 'revivalStop',
    player: 'p',
    recipient: 'q',
    revival: 'forces',
  };
  return g;
}
function atreides() {
  let g = fixture('atreides');
  g.phase = 6;
  g.storm = 18;
  for (const p of g.players) {
    p.forces = { 'arrakeen:10': 2 };
    p.reserves = 18;
  }
  g = applyAction(g, 'p', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'q',
  });
  while (g.response || g.battle?.preparation) {
    if (g.response)
      g = applyAction(
        g,
        g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
        {
          type: 'passResponse',
        },
      );
    else
      g = applyAction(g, g.battle!.preparation!.owner, {
        type: 'declineBattlePower',
      });
  }
  assert.equal(g.decision?.kind, 'fullPlanOffer');
  return g;
}
function examples(): [string, Game, Action][] {
  const e = emperor();
  const leader = emperor();
  leader.players[0].leaders[0].dead = true;
  const c = fixture('choam');
  const cards = [hold(c, 'p', 'Baliset'), hold(c, 'p', 'Snooper')];
  const i = fixture('ixians');
  i.phase = 5;
  i.mobileStronghold = { location: 'polar_sink:0' };
  i.players[0].forces = { [MOBILE_LOCATION]: 1 };
  i.players[0].reserves = 19;
  const f = fixture('fremen');
  f.phase = 1;
  const a = atreides(),
    t = tleilaxu(),
    s = guild();
  const h = fixture('harkonnen');
  h.phase = 3;
  hold(h, 'q', 'Baliset');
  hold(h, 'q', 'Snooper');
  return [
    ['emperorForces', e, action(e, { amount: 3, elite: 1 })],
    [
      'emperorLeader',
      leader,
      action(leader, { leader: leader.players[0].leaders[0].id }),
    ],
    ['choam', c, action(c, { cards })],
    ['ixians', i, action(i, { route: mobileRoutes(i, 2)[0], collect: false })],
    ['fremen', f, action(f, { territory: 'hagga_basin' })],
    ['atreides', a, action(a, { target: 'q' })],
    ['tleilaxu', t, action(t)],
    ['guild', s, action(s)],
    ['harkonnen', h, action(h, { target: 'q', amount: 1 })],
  ];
}

void test('preparing every implemented special Karama is serializable and does not mutate state or draw randomness', (t) => {
  const cases = examples();
  t.mock.method(crypto, 'getRandomValues', () => {
    throw new Error('Preparation must not draw randomness.');
  });
  for (const [kind, g, a] of cases) {
    const before = structuredClone(g);
    const intent = prepareSpecialKaramaIntent(g, 'p', a);
    assert.equal(intent.kind, kind);
    assert.equal(intent.card, a.card);
    assert.equal(intent.owner, 'p');
    assert.deepEqual(JSON.parse(JSON.stringify(intent)), intent);
    assert.deepEqual(g, before, kind);
  }
});

void test('Emperor force revival commits once after serialization and never during preparation', () => {
  const g = emperor();
  const intent = prepareSpecialKaramaIntent(
    g,
    'p',
    action(g, { amount: 3, elite: 1 }),
  );
  assert.equal(g.players[0].tanks, 5);
  assert.equal(g.players[0].specialKaramaUsed, undefined);
  executeSpecialKaramaIntent(g, JSON.parse(JSON.stringify(intent)));
  assert.equal(g.players[0].tanks, 2);
  assert.equal(g.players[0].reserves, 18);
  assert.equal(g.players[0].elites!.revived, 1);
  assert.equal(g.players[0].specialKaramaUsed, true);
  assert.equal(g.discard.filter((c) => c.id === intent.card).length, 1);
  const after = structuredClone(g);
  assert.throws(() => executeSpecialKaramaIntent(g, intent));
  assert.deepEqual(g, after);
});

void test('a delayed intent cannot revive changed resources or a leader now controlled elsewhere', () => {
  for (const leader of [false, true]) {
    const g = emperor();
    g.players[0].leaders[0].dead = true;
    const intent = prepareSpecialKaramaIntent(
      g,
      'p',
      action(
        g,
        leader
          ? { leader: g.players[0].leaders[0].id }
          : { amount: 3, elite: 1 },
      ),
    );
    if (leader) g.players[0].leaders[0].capturedBy = 'q';
    else g.players[0].tanks = 1;
    const before = structuredClone(g);
    assert.throws(() => executeSpecialKaramaIntent(g, intent));
    assert.deepEqual(g, before);
  }
});

void test('every prepared intent rejects a changed phase, turn or missing activation before costs', () => {
  for (const [kind, initial, a] of examples()) {
    const intent = prepareSpecialKaramaIntent(initial, 'p', a);
    for (const change of ['turn', 'phase', 'card'] as const) {
      const g = structuredClone(initial);
      if (change === 'turn') g.turn++;
      else if (change === 'phase') g.phase = (g.phase + 1) % 9;
      else g.players[1].hand.push(g.players[0].hand.splice(0, 1)[0]);
      const before = structuredClone(g);
      assert.throws(
        () => executeSpecialKaramaIntent(g, intent),
        `${kind}: ${change}`,
      );
      assert.deepEqual(g, before, `${kind}: ${change}`);
    }
  }
});

void test('CHOAM prepared selections are detached from the caller and revalidate exact card custody', () => {
  const g = fixture('choam');
  const cards = [hold(g, 'p', 'Baliset')];
  const intent = prepareSpecialKaramaIntent(g, 'p', action(g, { cards }));
  assert.equal(intent.kind, 'choam');
  cards.push(hold(g, 'p', 'Snooper'));
  if (intent.kind !== 'choam') throw new Error('Wrong intent');
  assert.equal(intent.cards.length, 1);
  const index = g.players[0].hand.findIndex(
    (card) => card.id === intent.cards[0],
  );
  g.players[1].hand.push(g.players[0].hand.splice(index, 1)[0]);
  const before = structuredClone(g);
  assert.throws(() => executeSpecialKaramaIntent(g, intent));
  assert.deepEqual(g, before);
});

void test('Guild and Tleilaxu intentions bind the actual declaration, not just its owner', () => {
  for (const g of [guild(), tleilaxu()]) {
    const intent = prepareSpecialKaramaIntent(g, 'p', action(g));
    if (g.pendingShipment) g.pendingShipment.amount++;
    if (g.pendingRevival) g.pendingRevival.amount!++;
    const before = structuredClone(g);
    assert.throws(() => executeSpecialKaramaIntent(g, intent));
    assert.deepEqual(g, before);
  }
});

void test('Harkonnen preparation does not expose or select unseen cards; only commitment draws them', (t) => {
  const g = fixture('harkonnen');
  g.phase = 3;
  const foreign = [hold(g, 'q', 'Baliset'), hold(g, 'q', 'Snooper')];
  const intent = prepareSpecialKaramaIntent(
    g,
    'p',
    action(g, { target: 'q', amount: 1 }),
  );
  assert.ok(foreign.every((id) => !JSON.stringify(intent).includes(id)));
  const draw = t.mock.method(crypto, 'getRandomValues');
  executeSpecialKaramaIntent(g, intent);
  assert.ok(draw.mock.callCount() > 0);
  assert.equal(g.players[1].hand.length, 1);
  assert.equal(g.players[0].hand.length, 1);
  assert.equal(g.decision?.kind, 'handExchange');
});

void test('a failure while committing a random special effect cannot publish partial public action state', (t) => {
  const g = fixture('harkonnen');
  g.phase = 3;
  hold(g, 'q', 'Baliset');
  hold(g, 'q', 'Snooper');
  const a = action(g, { target: 'q', amount: 1 });
  const before = structuredClone(g);
  t.mock.method(crypto, 'getRandomValues', () => {
    throw new Error('Injected random source failure');
  });
  assert.throws(() => applyAction(g, 'p', a), /Injected random/);
  assert.deepEqual(g, before);
});

const pauseWindows: [string, (g: Game) => void][] = [
  [
    'phase opening',
    (g) => {
      g.phaseOpening = { passed: [], initialize: false };
    },
  ],
  [
    'market',
    (g) => {
      g.choamMarket = { owner: 'q', resume: 'phase', blocked: [] };
    },
  ],
  [
    'revival',
    (g) => {
      g.pendingRevival = {
        player: 'q',
        kind: 'forces',
        amount: 1,
        normalCost: 0,
        cost: 0,
        free: 1,
        checks: [],
      };
    },
  ],
  [
    'Truthtrance',
    (g) => {
      g.truthtrance = {
        stage: 'priority',
        queue: [],
        passed: [],
        question: null,
      };
    },
  ],
];

void test('delayed execution respects newly opened table-wide windows just like the public dispatcher', () => {
  for (const [name, pause] of pauseWindows) {
    const g = emperor();
    const a = action(g, { amount: 3, elite: 1 });
    const intent = prepareSpecialKaramaIntent(g, 'p', a);
    pause(g);
    const before = structuredClone(g);
    assert.throws(() => applyAction(g, 'p', a), name);
    assert.throws(() => prepareSpecialKaramaIntent(g, 'p', a), name);
    assert.throws(() => executeSpecialKaramaIntent(g, intent), name);
    assert.deepEqual(g, before, name);
  }
});

void test('CHOAM retains its existing cash-in priority exceptions, but waits for Truthtrance', () => {
  for (const [name, pause] of pauseWindows) {
    const g = fixture('choam');
    const a = action(g, { cards: [hold(g, 'p', 'Baliset')] });
    const intent = prepareSpecialKaramaIntent(g, 'p', a);
    pause(g);
    if (name === 'Truthtrance') {
      const before = structuredClone(g);
      assert.throws(() => executeSpecialKaramaIntent(g, intent));
      assert.deepEqual(g, before);
    } else {
      const publicResult = applyAction(g, 'p', a);
      executeSpecialKaramaIntent(g, intent);
      assert.equal(g.players[0].spice, publicResult.players[0].spice, name);
      assert.equal(g.players[0].specialKaramaUsed, true, name);
    }
  }
});
