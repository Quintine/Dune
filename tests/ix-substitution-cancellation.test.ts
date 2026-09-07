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
import { TERRITORIES } from '../game/board';
import { quoteIxSubstitutionCancellation } from '../game/ix-substitution-cancellation';

function passAll(state: Game) {
  let g = state;
  for (let n = 0; g.response && n < 20; n++) {
    const p = g.players.find((p) => !g.response!.passed.includes(p.id));
    assert.ok(p);
    g = applyAction(g, p.id, { type: 'passResponse' });
  }
  assert.equal(g.response, null);
  return g;
}
function actual(cards = true, advanced = true) {
  let g = createGame('IXCANCELQA', newPlayer('i', 'Ix', 'ixians'), advanced);
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('b', 'BG', 'beneGesserit'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 6,
    turn: 2,
    active: 'i',
    order: ['i', 'e', 'b'],
    storm: 18,
    phaseOpening: null,
    deck: baseDeck(),
    discard: [],
  });
  for (const p of g.players) {
    p.hand = [];
    p.traitors = [];
    p.forces = p.id === 'b' ? {} : { 'arrakeen:10': 8 };
    p.reserves = p.id === 'b' ? 20 : 12;
    p.spice = 20;
  }
  g.players[0].elites = {
    reserves: 5,
    tanks: 0,
    forces: { 'arrakeen:10': 2 },
    revived: 0,
  };
  g.players[1].elites = undefined;
  const take = (player: number, pred: (c: Game['deck'][number]) => boolean) => {
    const index = g.deck.findIndex(pred);
    assert.ok(index >= 0);
    const card = g.deck.splice(index, 1)[0];
    g.players[player].hand.push(card);
    return card;
  };
  const printed = take(1, (c) => c.effect === 'karama');
  const bg = take(2, (c) => c.kind === 'worthless');
  const shield = cards ? take(0, (c) => c.kind === 'shield') : undefined;
  g = passAll(
    applyAction(g, 'i', {
      type: 'chooseBattle',
      territory: 'arrakeen',
      target: 'e',
    }),
  );
  g = applyAction(g, 'i', {
    type: 'battlePlan',
    leader: 'ixians-1',
    dial: 6,
    support: advanced ? 2 : 0,
    defense: shield?.id,
  });
  g = applyAction(g, 'e', { type: 'battlePlan', leader: 'emperor-4', dial: 0 });
  g = applyAction(g, 'i', { type: 'traitorCall', call: false });
  g = applyAction(g, 'e', { type: 'traitorCall', call: false });
  if (g.decision?.kind === 'battleLosses') {
    const choice = g.decision.options.findIndex(
      (c) => c.normal === 4 && c.elite === 2,
    );
    assert.ok(choice >= 0);
    g = applyAction(g, 'i', { type: 'decision', choice });
  }
  assert.equal(g.decision?.kind, 'ixSubstitution');
  g = applyAction(g, 'i', {
    type: 'decision',
    sources: { 'arrakeen:10': 1 },
    recover: { 'arrakeen:10': 1 },
  });
  assert.equal(g.response?.kind, 'ixSubstitution');
  return { g, printed, bg, shield };
}
function quote(g: Game) {
  return quoteIxSubstitutionCancellation(
    {
      ...g,
      territories: TERRITORIES,
      physicalCards: [
        ...g.players.flatMap((p) => p.hand),
        ...g.deck,
        ...g.discard,
      ],
    },
    g.response!,
  );
}
for (const form of ['printed', 'bg'] as const) {
  void test(`actual ${form} denied substitution preserves casualties and opens the winner's remaining card choice`, () => {
    const f = actual();
    let g = f.g;
    const material = g.players.map((p) => [
      p.forces,
      p.tanks,
      p.elites,
      p.spice,
      p.battleLosses,
    ]);
    const actor = form === 'printed' ? 'e' : 'b';
    g = applyAction(g, actor, {
      type: 'card',
      card: f[form].id,
      mode: 'cancel',
    });
    g = passAll(JSON.parse(JSON.stringify(g)) as Game);
    assert.equal(g.pendingIxSubstitution, null);
    assert.deepEqual(
      g.players.map((p) => [
        p.forces,
        p.tanks,
        p.elites,
        p.spice,
        p.battleLosses,
      ]),
      material,
    );
    assert.deepEqual(g.decision, {
      kind: 'battleCards',
      player: 'i',
      territory: 'arrakeen',
      cards: [f.shield!.id],
    });
    assert.equal(g.discard.filter((c) => c.id === f[form].id).length, 1);
    assert.equal(viewGame(g, 'b').players[0].hand, undefined);
    g = applyAction(g, 'i', { type: 'decision', discard: [] });
    assert.equal(g.phase, 7);
  });
  void test(`malformed ${form} substitution sources and winner cleanup reject before paying Karama`, (t) => {
    const f = actual();
    const rng = t.mock.method(Math, 'random', () => {
      throw Error('No random');
    });
    const uuid = t.mock.method(crypto, 'randomUUID', () => {
      throw Error('No events');
    });
    const mutations: ((g: Game) => void)[] = [
      (g) => {
        g.pendingIxSubstitution!.player = 'e';
      },
      (g) => {
        g.pendingIxSubstitution!.territory = 'carthag';
      },
      (g) => {
        g.pendingIxSubstitution!.sources = { 'arrakeen:11': 1 };
      },
      (g) => {
        g.pendingIxSubstitution!.recover = { 'arrakeen:10': 3 };
      },
      (g) => {
        g.pendingIxSubstitution!.sources = { 'arrakeen:10': 0 };
      },
      (g) => {
        g.pendingIxSubstitution!.cards = ['absent'];
      },
      (g) => {
        g.pendingIxSubstitution!.cards.push(f.shield!.id);
      },
      (g) => {
        g.lastBattleContext!.winner = 'e';
      },
      (g) => {
        g.lastBattle = ['i', 'missing'];
      },
    ];
    for (const mutate of mutations) {
      const g = structuredClone(f.g);
      mutate(g);
      const before = structuredClone(g);
      assert.throws(() =>
        applyAction(g, form === 'printed' ? 'e' : 'b', {
          type: 'card',
          card: f[form].id,
          mode: 'cancel',
        }),
      );
      assert.deepEqual(g, before);
    }
    assert.equal(rng.mock.callCount(), 0);
    assert.equal(uuid.mock.callCount(), 0);
  });
}
void test('a canceled exchange does not require suboids, cyborg tanks, or spice that the denied exchange would consume', () => {
  const f = actual();
  const g = f.g;
  g.players[0].forces = {};
  g.players[0].elites!.tanks = 0;
  g.players[0].tanks = 0;
  g.players[0].spice = 0;
  const before = structuredClone(g);
  const q = quote(g);
  assert.equal(q?.decision?.kind, 'battleCards');
  assert.deepEqual(g, before);
  const done = applyAction(g, 'e', {
    type: 'card',
    card: f.printed.id,
    mode: 'cancel',
  });
  assert.deepEqual(done.players[0].forces, {});
  assert.equal(done.players[0].tanks, 0);
});
void test('empty winner-card cleanup validates its immediate aftermath before a new BG cost', () => {
  const f = actual(false);
  const bad = structuredClone(f.g);
  bad.pendingCapture = { player: 'i', loser: 'absent', territory: 'arrakeen' };
  const before = structuredClone(bad);
  assert.throws(() =>
    applyAction(bad, 'b', { type: 'card', card: f.bg.id, mode: 'cancel' }),
  );
  assert.deepEqual(bad, before);
  const good = applyAction(f.g, 'e', {
    type: 'card',
    card: f.printed.id,
    mode: 'cancel',
  });
  assert.equal(good.pendingIxSubstitution, null);
  assert.equal(good.phase, 7);
});
void test('legacy Basic substitution receipts retain declared battle identities without allocating a replacement event', (t) => {
  const f = actual(true, false);
  delete f.g.lastBattleContext;
  const before = structuredClone(f.g);
  const uuid = t.mock.method(crypto, 'randomUUID', () => {
    throw Error('No events');
  });
  assert.equal(quote(f.g)?.context.kind, 'legacy');
  assert.deepEqual(f.g, before);
  const done = applyAction(f.g, 'e', {
    type: 'card',
    card: f.printed.id,
    mode: 'cancel',
  });
  assert.equal(done.decision?.kind, 'battleCards');
  assert.equal(uuid.mock.callCount(), 0);
});
void test('paid BG substitution cancellation rejects a damaged cleanup on recovery without spending a second card', () => {
  const f = actual();
  const paid = applyAction(f.g, 'b', {
    type: 'card',
    card: f.bg.id,
    mode: 'cancel',
  });
  assert.equal(paid.response?.kind, 'worthlessKarama');
  const bad = JSON.parse(JSON.stringify(paid)) as Game;
  bad.lastBattleContext!.winner = 'e';
  const before = structuredClone(bad);
  assert.throws(() => applyAction(bad, 'e', { type: 'passResponse' }));
  assert.deepEqual(bad, before);
  assert.equal(bad.discard.filter((c) => c.id === f.bg.id).length, 1);
  const done = passAll(JSON.parse(JSON.stringify(paid)) as Game);
  assert.equal(done.decision?.kind, 'battleCards');
  assert.equal(done.discard.filter((c) => c.id === f.bg.id).length, 1);
});
void test('paid BG cancellation with no retained winner cards continues through cleanup exactly once after reload', () => {
  const f = actual(false);
  const paid = applyAction(f.g, 'b', {
    type: 'card',
    card: f.bg.id,
    mode: 'cancel',
  });
  assert.equal(paid.response?.kind, 'worthlessKarama');
  const done = passAll(JSON.parse(JSON.stringify(paid)) as Game);
  assert.equal(done.phase, 7);
  assert.equal(done.pendingIxSubstitution, null);
  assert.equal(done.players[0].elites!.tanks, 2);
  assert.equal(done.players[0].tanks, 6);
  assert.equal(done.players[0].forces['arrakeen:10'], 2);
  assert.equal(done.discard.filter((c) => c.id === f.bg.id).length, 1);
  const before = structuredClone(done);
  assert.throws(() => applyAction(done, 'e', { type: 'passResponse' }));
  assert.deepEqual(done, before);
});
