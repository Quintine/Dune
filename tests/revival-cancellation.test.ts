import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  joinGame,
  newPlayer,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { newRevivalRules } from '../game/revival';
import {
  quoteRevivalCancellation,
  RevivalCancellationError,
} from '../game/revival-cancellation';

const p = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function fixture() {
  const g = createGame(
    'REVIVALCANCEL',
    newPlayer('c', 'CHOAM', 'choam'),
    true,
    ['choam', 'ix'],
  );
  for (const [id, faction] of [
    ['t', 'tleilaxu'],
    ['e', 'emperor'],
    ['b', 'beneGesserit'],
    ['a', 'atreides'],
    ['i', 'ixians'],
  ] as const)
    joinGame(g, newPlayer(id, faction, faction));
  Object.assign(g, {
    status: 'playing',
    phase: 4,
    turn: 2,
    deck: baseDeck(),
    revivalRules: newRevivalRules(),
    order: g.players.map((p) => p.id),
  });
  for (const player of g.players) {
    player.hand = [];
    player.spice = 20;
    player.forces = {};
    player.tanks = 10;
    player.reserves = 10;
  }
  // This scenario has already used Tleilaxu's separate once-per-game stop;
  // ordinary revival benefit responses below are still real declarations.
  p(g, 't').specialKaramaUsed = true;
  for (const [id, effect] of [
    ['e', 'karama'],
    ['b', 'worthless'],
  ] as const) {
    const index = g.deck.findIndex((c) =>
      effect === 'karama' ? c.effect === effect : c.kind === effect,
    );
    p(g, id).hand.push(g.deck.splice(index, 1)[0]);
  }
  return g;
}
function discount(g: Game, target: string) {
  p(g, 't').ally = target;
  p(g, target).ally = 't';
  return applyAction(g, 't', { type: 'tleilaxuAllyDiscount' });
}
type Case =
  | 'choam'
  | 'oversized'
  | 'limit'
  | 'discount'
  | 'early'
  | 'foreign'
  | 'ix'
  | 'negotiated'
  | 'kwisatz'
  | 'native';
function opportunityRaw(kind: Case) {
  let g = fixture();
  if (kind === 'choam' || kind === 'oversized')
    return applyAction(g, 'c', {
      type: 'revive',
      amount: kind === 'choam' ? 3 : 5,
    });
  if (kind === 'limit') {
    g = applyAction(g, 't', { type: 'tleilaxuRevivalLimit', target: 'a' });
    return applyAction(g, 'a', { type: 'revive', amount: 5 });
  }
  if (kind === 'discount')
    return applyAction(g, 't', { type: 'revive', amount: 3 });
  if (kind === 'early') {
    p(g, 't').leaders[0].dead = true;
    p(g, 't').leaders[0].deaths = 1;
    return applyAction(g, 't', {
      type: 'reviveLeader',
      leader: p(g, 't').leaders[0].id,
    });
  }
  if (kind === 'foreign') {
    p(g, 't').leaders[0].dead = true;
    p(g, 't').leaders[0].deaths = 1;
    p(g, 'a').leaders[0].dead = true;
    p(g, 'a').leaders[0].deaths = 1;
    return applyAction(g, 't', {
      type: 'reviveForeignGhola',
      leader: p(g, 'a').leaders[0].id,
    });
  }
  if (kind === 'ix') {
    p(g, 'i').elites = { tanks: 1, reserves: 3, forces: {}, revived: 0 };
    g = discount(g, 'i');
    return applyAction(g, 'i', {
      type: 'revive',
      amount: 2,
      elite: 1,
      freeElite: 0,
    });
  }
  if (kind === 'negotiated') {
    p(g, 'a').leaders[0].dead = true;
    p(g, 'a').leaders[0].deaths = 1;
    g = applyAction(g, 'a', {
      type: 'requestLeaderRevival',
      leader: p(g, 'a').leaders[0].id,
    });
    g = applyAction(g, 't', {
      type: 'quoteLeaderRevival',
      target: 'a',
      amount: 17,
    });
    return applyAction(g, 'a', { type: 'acceptLeaderRevival' });
  }
  p(g, 'a').leaders.forEach((l) => {
    l.dead = true;
    l.deaths = 1;
  });
  g = discount(g, 'a');
  if (kind === 'kwisatz') {
    p(g, 'a').kwisatz = { dead: true, revivalCycle: 1 };
    return applyAction(g, 'a', { type: 'reviveKwisatz' });
  }
  return applyAction(g, 'a', {
    type: 'reviveLeader',
    leader: p(g, 'a').leaders[0].id,
  });
}
function opportunity(kind: Case) {
  let g = opportunityRaw(kind);
  if (g.decision?.kind === 'choamFreeRevival')
    g = applyAction(g, g.decision.player, { type: 'decision', decline: true });
  return g;
}
function quote(g: Game) {
  assert.ok(g.response);
  assert.ok(g.pendingRevival);
  return quoteRevivalCancellation(g, g.response);
}
function cancel(g: Game, form: 'printed' | 'worthless') {
  const actor = form === 'printed' ? 'e' : 'b';
  const card = p(g, actor).hand[0].id;
  const before = structuredClone(g);
  let done = applyAction(g, actor, { type: 'card', card, mode: 'cancel' });
  assert.deepEqual(g, before);
  if (form === 'worthless') {
    assert.equal(done.response?.kind, 'worthlessKarama');
    while (done.response?.kind === 'worthlessKarama') {
      const next = done.players.find(
        (p) => !done.response!.passed.includes(p.id),
      );
      assert.ok(next);
      done = applyAction(done, next.id, { type: 'passResponse' });
    }
  }
  assert.equal(done.discard.filter((c) => c.id === card).length, 1);
  return done;
}

for (const kind of [
  'choam',
  'oversized',
  'limit',
  'discount',
  'early',
  'foreign',
  'ix',
  'negotiated',
  'kwisatz',
  'native',
] as const)
  void test(`pure cancellation quote matches the actual ${kind} declaration without resources, RNG or private-hand reads`, (t) => {
    const g = opportunity(kind);
    const before = structuredClone(g);
    const random = t.mock.method(crypto, 'getRandomValues', () => {
      throw Error('Pure revival quote drew randomness.');
    });
    const uuid = t.mock.method(crypto, 'randomUUID', () => {
      throw Error('Pure revival quote created an event.');
    });
    const result = quote(g);
    assert.deepEqual(quote(g), result);
    assert.deepEqual(g, before);
    assert.equal(
      result.outcome,
      ['oversized', 'limit', 'early', 'foreign', 'negotiated'].includes(kind)
        ? 'abandoned'
        : 'revive',
    );
    if (kind === 'ix') {
      assert.equal(g.pendingRevival!.normalCost, 3);
      assert.equal(
        result.pending!.cost,
        3,
        'preserve the selected paid cyborg / free suboid allocation',
      );
      assert.equal(result.pending!.elite, 1);
    }
    if (kind === 'negotiated') assert.equal(g.pendingRevival!.normalCost, 17);
    if (kind === 'kwisatz') assert.equal(result.pending!.cost, 2);
    if (kind === 'choam') assert.equal(result.pending!.cost, 6);
    result.rules.expanded.push('test-only');
    if (result.pending) result.pending.checks.push('earlyRevival');
    assert.deepEqual(g, before, 'returned evidence is detached');
    for (const player of g.players)
      Object.defineProperty(player, 'hand', {
        get() {
          throw Error('Private hand read by quote.');
        },
      });
    assert.doesNotThrow(() => quote(g));
    assert.equal(random.mock.callCount(), 0);
    assert.equal(uuid.mock.callCount(), 0);
  });

for (const form of ['printed', 'worthless'] as const)
  for (const kind of [
    'choam',
    'limit',
    'early',
    'foreign',
    'ix',
    'negotiated',
    'kwisatz',
    'native',
  ] as const)
    void test(`${form} cancellation applies the ${kind} quote once through the actual response`, () => {
      const g = opportunity(kind),
        result = quote(g),
        target = g.pendingRevival!.player;
      const initial = p(g, target),
        spent = initial.spice;
      const done = cancel(reload(g), form);
      assert.deepEqual(done.revivalRules, result.rules);
      assert.equal(done.pendingRevival, null);
      if (result.outcome === 'abandoned') {
        assert.equal(p(done, target).spice, spent);
        assert.deepEqual(p(done, target).leaders, initial.leaders);
        assert.equal(p(done, target).tanks, initial.tanks);
      } else {
        assert.equal(p(done, target).spice, spent - result.pending!.cost);
        if (result.pending!.kind === 'forces') {
          assert.equal(
            p(done, target).tanks,
            initial.tanks - result.pending!.amount!,
          );
          assert.equal(
            p(done, target).reserves,
            initial.reserves + result.pending!.amount!,
          );
        } else if (kind === 'kwisatz')
          assert.equal(p(done, target).kwisatz!.dead, false);
        else
          assert.equal(
            p(done, target).leaders.find(
              (l) => l.id === result.pending!.leader,
            )!.dead,
            false,
          );
      }
    });

void test('CHOAM rebuilding an expanded discounted request returns its next response before checking affordability', () => {
  let g = fixture();
  g = applyAction(g, 't', { type: 'tleilaxuRevivalLimit', target: 'c' });
  g = discount(g, 'c');
  g = applyAction(g, 'c', { type: 'revive', amount: 5 });
  p(g, 'c').spice = 0;
  const result = quote(g);
  assert.equal(result.outcome, 'response');
  assert.deepEqual(result.pending!.checks, ['revivalLimit', 'revivalDiscount']);
  assert.deepEqual(result.nextResponse, {
    kind: 'revivalLimit',
    owner: 't',
    recipient: 'c',
  });
  assert.equal(result.pending!.normalCost, 10);
  assert.equal(result.pending!.cost, 5);
});

for (const form of ['printed', 'worthless'] as const)
  void test(`${form} canceled discount accepts insufficient spice as no revival, not rejected Karama`, () => {
    const g = opportunity('discount');
    p(g, 't').spice = 1;
    assert.equal(quote(g).outcome, 'unfunded');
    const before = structuredClone(p(g, 't'));
    const done = cancel(g, form);
    assert.equal(p(done, 't').spice, 1);
    assert.equal(p(done, 't').tanks, before.tanks);
    assert.equal(p(done, 't').reserves, before.reserves);
    assert.equal(done.pendingRevival, null);
  });

const corruptions: [string, (g: Game) => void][] = [
  [
    'empty payer',
    (g) => {
      g.pendingRevival!.payer = '';
    },
  ],
  [
    'unknown payer',
    (g) => {
      g.pendingRevival!.payer = 'unseated';
    },
  ],
  [
    'invalid extra flag',
    (g) => {
      g.pendingRevival!.emperorExtra = 'yes' as unknown as boolean;
    },
  ],
  [
    'wrong phase',
    (g) => {
      g.phase = 5;
    },
  ],
  [
    'wrong owner',
    (g) => {
      g.response!.owner = 'a';
    },
  ],
  [
    'wrong recipient',
    (g) => {
      g.response!.recipient = 'a';
    },
  ],
  [
    'unknown remaining check',
    (g) => {
      g.pendingRevival!.checks = ['unknown' as 'revivalDiscount'];
    },
  ],
  [
    'negative cost',
    (g) => {
      g.pendingRevival!.normalCost = -1;
    },
  ],
  [
    'missing tanks',
    (g) => {
      p(g, 't').reserves += p(g, 't').tanks;
      p(g, 't').tanks = 0;
    },
  ],
  [
    'negative force count',
    (g) => {
      g.pendingRevival!.amount = -1;
    },
  ],
  [
    'wrong request kind',
    (g) => {
      g.pendingRevival!.kind = 'kwisatz';
    },
  ],
];
for (const [name, corrupt] of corruptions)
  void test(`malformed ${name} rejects pure revival cancellation without changing state`, () => {
    const g = opportunity('discount');
    corrupt(g);
    const before = structuredClone(g);
    assert.throws(() => quote(g), RevivalCancellationError);
    assert.deepEqual(g, before);
  });

for (const kind of ['native', 'foreign', 'kwisatz'] as const)
  void test(`a continuing ${kind} request cannot revive an absent, live or captured piece`, () => {
    let original = opportunity(kind);
    if (kind === 'foreign') {
      // Allow only the foreign-ghola permission to reach its real discount.
      while (original.response?.kind === 'foreignGhola') {
        const next = original.players.find(
          (p) => !original.response!.passed.includes(p.id),
        )!;
        original = applyAction(original, next.id, { type: 'passResponse' });
      }
    }
    for (const change of ['live', 'missing', 'captured'] as const) {
      if (kind === 'kwisatz' && change === 'captured') continue;
      const g = reload(original),
        target = p(g, g.pendingRevival!.player);
      if (kind === 'kwisatz') {
        if (change === 'missing') delete target.kwisatz;
        else target.kwisatz!.dead = false;
      } else {
        const owner = g.players.find((p) =>
          p.leaders.some((l) => l.id === g.pendingRevival!.leader),
        )!;
        const index = owner.leaders.findIndex(
          (l) => l.id === g.pendingRevival!.leader,
        );
        if (change === 'missing') owner.leaders.splice(index, 1);
        else if (change === 'live') owner.leaders[index].dead = false;
        else owner.leaders[index].capturedBy = 'e';
      }
      const before = structuredClone(g);
      assert.throws(() => quote(g), RevivalCancellationError);
      assert.deepEqual(g, before);
    }
  });

// These malformed saved snapshots cannot be produced by the declaration API.
// They exercise the pre-cost boundary, including the initial BG conversion.
for (const form of ['printed', 'worthless'] as const)
  for (const [name, corrupt] of corruptions)
    void test(`${form} rejects saved ${name} before consuming Karama or opening conversion`, (t) => {
      const g = opportunity('discount');
      corrupt(g);
      const before = structuredClone(g),
        actor = form === 'printed' ? 'e' : 'b';
      const random = t.mock.method(crypto, 'getRandomValues', () => {
        throw Error('Rejected cancellation drew randomness.');
      });
      const uuid = t.mock.method(crypto, 'randomUUID', () => {
        throw Error('Rejected cancellation created an event.');
      });
      assert.throws(() =>
        applyAction(g, actor, {
          type: 'card',
          card: p(g, actor).hand[0].id,
          mode: 'cancel',
        }),
      );
      assert.deepEqual(g, before);
      assert.equal(random.mock.callCount(), 0);
      assert.equal(uuid.mock.callCount(), 0);
    });

for (const field of [
  'reserves',
  'revived',
  'freeForcesRevived',
  'eliteReserves',
  'eliteRevived',
] as const)
  for (const form of ['printed', 'worthless'] as const)
    void test(`${form} rejects continuing revival ${field} overflow before cost`, () => {
      const g = opportunity(field.startsWith('elite') ? 'ix' : 'discount');
      const target = p(g, g.pendingRevival!.player);
      if (field === 'eliteReserves')
        target.elites!.reserves = Number.MAX_SAFE_INTEGER;
      else if (field === 'eliteRevived')
        target.elites!.revived = Number.MAX_SAFE_INTEGER;
      else target[field] = Number.MAX_SAFE_INTEGER;
      const before = structuredClone(g),
        actor = form === 'printed' ? 'e' : 'b';
      assert.throws(() => quote(g), RevivalCancellationError);
      assert.throws(() =>
        applyAction(g, actor, {
          type: 'card',
          card: p(g, actor).hand[0].id,
          mode: 'cancel',
        }),
      );
      assert.deepEqual(g, before);
    });

for (const form of ['printed', 'worthless'] as const)
  void test(`${form} cancellation preserves the accepted Fremen allowance fizzle`, () => {
    let g = fixture();
    const index = g.players.findIndex((p) => p.id === 'i');
    g.players[index] = newPlayer('i', 'Fremen', 'fremen');
    Object.assign(p(g, 'i'), {
      spice: 20,
      tanks: 10,
      reserves: 10,
      revived: 3,
    });
    g = applyAction(g, 't', { type: 'tleilaxuRevivalLimit', target: 'i' });
    g = discount(g, 'i');
    g = applyAction(g, 'i', { type: 'revive', amount: 2 });
    while (g.response?.kind === 'revivalLimit') {
      const next = g.players.find((p) => !g.response!.passed.includes(p.id))!;
      g = applyAction(g, next.id, { type: 'passResponse' });
    }
    assert.equal(g.response?.kind, 'revivalDiscount');
    // A saved request whose allowance changed before cancellation: existing
    // finishRevival deliberately abandons this order rather than charging it.
    g.revivalRules!.limitBlocked = true;
    assert.equal(quote(g).outcome, 'fremenLimit');
    const before = structuredClone(p(g, 'i'));
    const done = cancel(g, form);
    assert.equal(done.pendingRevival, null);
    assert.deepEqual(p(done, 'i'), before);
  });

for (const form of ['printed', 'worthless'] as const)
  void test(`${form} rejects a saved continuing Kwisatz cycle overflow before cost`, () => {
    const g = opportunity('kwisatz');
    p(g, 'a').kwisatz!.revivalCycle = Number.MAX_SAFE_INTEGER;
    const before = structuredClone(g),
      actor = form === 'printed' ? 'e' : 'b';
    assert.throws(() => quote(g), RevivalCancellationError);
    assert.throws(() =>
      applyAction(g, actor, {
        type: 'card',
        card: p(g, actor).hand[0].id,
        mode: 'cancel',
      }),
    );
    assert.deepEqual(g, before);
  });
