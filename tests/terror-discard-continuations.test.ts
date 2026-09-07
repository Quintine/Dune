import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
import {
  applyAction,
  createGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import { botActions, runBots } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { baseDeck } from '../game/cards';
import type { FactionId } from '../game/catalog';
import {
  createTerrorState,
  placeTerror,
  type TerrorKind,
} from '../game/moritani-terror';
import { createRicheseNoField } from '../game/richese-no-field';

const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
/** Test-only observation of the unchanged production inner dispatcher, before
 * its public wrapper drains automatic continuations. No runtime export or gate
 * is changed, and all resumed actions use the real production exports. */
const observed: {
  applyActionInner?: (g: Game, id: string, a: Action) => Game;
  finishResponse?: (g: Game, canceled: boolean) => void;
} = {};
runInNewContext(
  ts.transpileModule(
    readFileSync(new URL('../game/engine.ts', import.meta.url), 'utf8') +
      '\nexport { applyActionInner, finishResponse };\n',
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  {
    exports: observed,
    require: createRequire(new URL('../game/engine.ts', import.meta.url)),
    crypto: webcrypto,
    structuredClone,
    TextEncoder,
    JSON,
  },
);
function inner(g: Game, id: string, a: Action) {
  const before = structuredClone(g);
  const result = reload(observed.applyActionInner!(g, id, a));
  assert.deepEqual(g, before);
  return result;
}
function fixture(
  kind: TerrorKind = 'sabotage',
  entrant: FactionId = 'emperor',
) {
  const g = createGame('TERRORFRAME', newPlayer('m', 'Moritani', 'moritani'));
  g.players.push(
    newPlayer('e', 'Entrant', entrant),
    newPlayer('a', 'Atreides', 'atreides'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    storm: 18,
    active: 'e',
    order: ['e', 'm', 'a'],
    movementRemaining: ['e', 'm', 'a'],
    deck: baseDeck(),
  });
  for (const p of g.players) {
    p.forces = {};
    p.reserves = 20;
    p.spice = 20;
    p.hand = [];
  }
  g.moritaniTerror = createTerrorState(() => 0);
  const token = g.moritaniTerror.tokens.find((t) => t.kind === kind)!;
  g.moritaniTerror = placeTerror(g.moritaniTerror, token.id, 'arrakeen', 1);
  return g;
}
function hold(g: Game, id: string, count: number) {
  player(g, id).hand.push(...g.deck.splice(0, count));
}
function named(g: Game, id: string, name: string) {
  const index = g.deck.findIndex((c) => c.name === name);
  assert.ok(index >= 0, name);
  const [card] = g.deck.splice(index, 1);
  player(g, id).hand.push(card);
  return card.id;
}
const enter = (g: Game) =>
  applyAction(g, 'e', {
    type: 'ship',
    territory: 'arrakeen',
    sector: 10,
    amount: 2,
  });
const decide = (g: Game, a: Omit<Action, 'type'>) =>
  applyAction(g, 'm', { type: 'decision', ...a });
function inventory(g: Game) {
  const cards = [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]
    .map((c) => c.id)
    .sort();
  assert.equal(new Set(cards).size, cards.length);
  for (const p of g.players)
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
  return cards;
}
function continuation(g: Game) {
  const c = g.pendingTreacheryDiscard!.continuation;
  if (c.kind !== 'terrorDiscard')
    throw Error('Missing Terror discard continuation');
  return c;
}
function recover(g: Game) {
  const old = structuredClone(g),
    done = normalizeAutomaticGame(reload(g));
  assert.deepEqual(g, old);
  assert.equal(done.pendingTreacheryDiscard, null);
  assert.deepEqual(normalizeAutomaticGame(reload(done)), done);
  return done;
}
function sabotage(gift = false) {
  const g = fixture();
  hold(g, 'e', 3);
  if (gift) hold(g, 'm', 1);
  const before = enter(g),
    pending = inner(before, 'm', { type: 'decision', reveal: true });
  assert.equal(continuation(pending).source, 'sabotage');
  return { before, pending };
}
function robbery(initialCards = 4, emptyDeck = false) {
  const initial = fixture('robbery');
  hold(initial, 'm', initialCards);
  if (emptyDeck) {
    initial.discard.push(...initial.deck);
    initial.deck = [];
  }
  const before = decide(decide(enter(initial), { reveal: true }), {
    choice: 'card',
  });
  assert.equal(before.pendingTerrorEntry?.stage, 'discard');
  return before;
}

for (const gift of [false, true])
  void test(`Sabotage recovery preserves its one random victim and ${gift ? 'opens the optional gift' : 'finishes without a gift'}`, () => {
    const { before, pending } = sabotage(gift),
      batch = pending.pendingTreacheryDiscard!.batch;
    const c = continuation(pending),
      victim = batch.entries[0].card;
    assert.equal(batch.entries.length, 1);
    assert.equal(batch.cause, 'terror:sabotage');
    assert.equal(batch.entries[0].discardedBy, 'e');
    assert.equal(batch.entries[0].publicFace, false);
    assert.equal(c.entry.stage, 'offer');
    assert.equal(c.discardedHandSize, 3);
    assert.equal(pending.pendingTerrorEntry, null);
    assert.equal(pending.decision, null);
    assert.ok(player(before, 'e').hand.some((card) => card.id === victim.id));
    assert.ok(!player(pending, 'e').hand.some((card) => card.id === victim.id));
    assert.equal(player(pending, 'e').spice, 18);
    assert.equal(player(pending, 'e').reserves, 18);
    const token = pending.moritaniTerror!.tokens.find(
      (t) => t.id === c.entry.token,
    )!;
    assert.equal(token.status, 'removed');
    assert.equal(token.location, null);
    const done = recover(pending);
    assert.deepEqual(done.discard, pending.discard);
    assert.deepEqual(done.deck, pending.deck);
    assert.deepEqual(done.players, pending.players);
    assert.deepEqual(done.moritaniTerror, pending.moritaniTerror);
    assert.deepEqual(done.log, pending.log);
    assert.equal(done.resolvedTreacheryDiscardSequence, 1);
    if (gift) {
      assert.equal(done.pendingTerrorEntry?.stage, 'gift');
      assert.equal(done.decision?.kind, 'moritaniTerror');
      const gifted = player(done, 'm').hand[0].id;
      const result = decide(reload(done), { card: gifted });
      assert.ok(player(result, 'e').hand.some((card) => card.id === gifted));
      assert.equal(result.pendingTerrorEntry, null);
      assert.equal(result.treacheryDiscardSequence, 1);
      assert.deepEqual(result.discard, done.discard);
    } else assert.equal(done.pendingTerrorEntry, null);
    assert.deepEqual(inventory(done), inventory(before));
  });

void test('empty Sabotage does not invent a discard event, while still permitting the optional gift', () => {
  for (const gift of [false, true]) {
    const initial = fixture();
    if (gift) hold(initial, 'm', 1);
    const result = inner(enter(initial), 'm', {
      type: 'decision',
      reveal: true,
    });
    assert.equal(result.pendingTreacheryDiscard ?? null, null);
    assert.equal(result.treacheryDiscardSequence ?? 0, 0);
    assert.equal(result.discard.length, 0);
    assert.equal(
      result.pendingTerrorEntry?.stage ?? null,
      gift ? 'gift' : null,
    );
  }
});

void test('Robbery recovery never redraws or reshuffles when discarding an old or newly drawn card', () => {
  for (const emptyDeck of [false, true])
    for (const drawn of [false, true]) {
      const before = robbery(4, emptyDeck),
        hand = player(before, 'm').hand;
      const card = hand[drawn ? 4 : 0].id,
        pending = inner(before, 'm', { type: 'decision', card });
      assert.equal(continuation(pending).source, 'robberyOverflow');
      assert.equal(continuation(pending).entry.stage, 'discard');
      assert.equal(continuation(pending).discardedHandSize, 5);
      assert.equal(
        pending.pendingTreacheryDiscard!.batch.entries[0].discardedBy,
        'm',
      );
      assert.equal(
        pending.pendingTreacheryDiscard!.batch.entries[0].publicFace,
        false,
      );
      const done = recover(pending);
      assert.deepEqual(done.deck, pending.deck);
      assert.deepEqual(done.discard, pending.discard);
      assert.deepEqual(done.players, pending.players);
      assert.deepEqual(done.log, pending.log);
      assert.equal(player(done, 'm').hand.length, 4);
      assert.equal(done.pendingTerrorEntry, null);
      assert.deepEqual(done, decide(before, { card }));
      assert.deepEqual(inventory(done), inventory(before));
    }
});

void test('exceptional Robbery overflow reopens only the next discard and retires each batch once', () => {
  const before = robbery(5),
    one = inner(before, 'm', {
      type: 'decision',
      card: player(before, 'm').hand[0].id,
    });
  const next = recover(one);
  assert.equal(player(next, 'm').hand.length, 5);
  assert.equal(next.pendingTerrorEntry?.stage, 'discard');
  const two = inner(next, 'm', {
    type: 'decision',
    card: player(next, 'm').hand[0].id,
  });
  assert.equal(two.pendingTreacheryDiscard!.sequence, 2);
  assert.notEqual(
    two.pendingTreacheryDiscard!.batch.event,
    one.pendingTreacheryDiscard!.batch.event,
  );
  const done = recover(two);
  assert.equal(player(done, 'm').hand.length, 4);
  assert.equal(done.pendingTerrorEntry, null);
  assert.equal(done.resolvedTreacheryDiscardSequence, 2);
  assert.deepEqual(done.deck, before.deck);
  const replay = reload(done);
  replay.pendingTreacheryDiscard = one.pendingTreacheryDiscard;
  assert.throws(() => normalizeAutomaticGame(replay));
});

void test('all seats see only the automatic marker and hidden-face changes preserve their projections', () => {
  const rob = robbery(),
    frames = [
      sabotage(true).pending,
      inner(rob, 'm', { type: 'decision', card: player(rob, 'm').hand[0].id }),
    ];
  for (const pending of frames) {
    const alternate = reload(pending),
      entry = alternate.pendingTreacheryDiscard!.batch.entries[0];
    const index = alternate.discard.findIndex((c) => c.id === entry.card.id),
      replacement = alternate.deck[0];
    alternate.deck[0] = alternate.discard[index];
    alternate.discard[index] = replacement;
    entry.card = structuredClone(replacement);
    for (const p of pending.players) {
      const view = viewGame(pending, p.id);
      assert.equal(view.automaticContinuationPending, true);
      assert.equal(view.terrorEntry, null);
      assert.ok(!('pendingTreacheryDiscard' in view));
      assert.ok(!('discard' in view));
      assert.ok(
        !JSON.stringify(view).includes(
          pending.pendingTreacheryDiscard!.batch.entries[0].card.id,
        ),
      );
      assert.deepEqual(viewGame(alternate, p.id), view);
      for (const level of DIFFICULTIES) {
        view.players.find((x) => x.id === p.id)!.bot = level;
        assert.deepEqual(botActions(view), []);
      }
    }
    const done = runBots(reload(pending), 0);
    assert.equal(done.pendingTreacheryDiscard, null);
    assert.deepEqual(
      { ...done, botsPending: undefined },
      { ...recover(pending), botsPending: undefined },
    );
  }
});

void test('Terror frames reject stale stage, removed-token identity, hand counts, overlays and physical custody atomically', () => {
  const before = robbery(),
    frames = [
      sabotage().pending,
      inner(before, 'm', {
        type: 'decision',
        card: player(before, 'm').hand[0].id,
      }),
    ];
  for (const valid of frames) {
    const token = (g: Game) =>
      g.moritaniTerror!.tokens.find(
        (t) => t.id === continuation(g).entry.token,
      )!;
    const mutations: ((g: Game) => void)[] = [
      (g) => {
        g.turn++;
      },
      (g) => {
        g.phase = 4;
      },
      (g) => {
        g.treacheryDiscardSequence!++;
      },
      (g) => {
        g.pendingTreacheryDiscard!.batch.event = 'stale';
      },
      (g) => {
        continuation(g).owner = 'e';
      },
      (g) => {
        continuation(g).entry.entrant = 'm';
      },
      (g) => {
        continuation(g).entry.entrant = 'missing';
      },
      (g) => {
        continuation(g).entry.stage = 'gift';
      },
      (g) => {
        continuation(g).entry.turn--;
      },
      (g) => {
        continuation(g).entry.phase--;
      },
      (g) => {
        continuation(g).entry.territory = 'red_chasm';
      },
      (g) => {
        continuation(g).entry.sector = 1;
      },
      (g) => {
        continuation(g).entry.amount = -1;
      },
      (g) => {
        continuation(g).entry.elite = 3;
      },
      (g) => {
        continuation(g).entry.resume = 'wormRide';
      },
      (g) => {
        continuation(g).discardedHandSize++;
      },
      (g) => {
        continuation(g).discardedHandSize = 0;
      },
      (g) => {
        token(g).status = 'placed';
      },
      (g) => {
        token(g).location = 'arrakeen';
      },
      (g) => {
        token(g).kind = 'assassination';
      },
      (g) => {
        g.moritaniTerror!.tokens.push(structuredClone(token(g)));
      },
      (g) => {
        continuation(g).entry.token = 'missing';
      },
      (g) => {
        g.pendingTerrorEntry = structuredClone(continuation(g).entry);
      },
      (g) => {
        g.pendingTreacheryDiscard!.batch.entries[0].publicFace = true;
      },
      (g) => {
        g.pendingTreacheryDiscard!.batch.entries[0].discardedBy = 'a';
      },
      (g) => {
        g.pendingTreacheryDiscard!.batch.cause = 'terror:wrong';
      },
      (g) => {
        g.deck.push(
          structuredClone(g.pendingTreacheryDiscard!.batch.entries[0].card),
        );
      },
      (g) => {
        g.discard = g.discard.filter(
          (c) => c.id !== g.pendingTreacheryDiscard!.batch.entries[0].card.id,
        );
      },
    ];
    for (const key of [
      'truthtrance',
      'response',
      'decision',
      'pendingNullentropy',
      'pendingRicheseGift',
      'pendingKarama',
    ])
      mutations.push((g) => {
        Object.assign(g, { [key]: {} });
      });
    for (const mutate of mutations) {
      const corrupt = reload(valid);
      mutate(corrupt);
      const old = structuredClone(corrupt);
      assert.throws(() => normalizeAutomaticGame(corrupt));
      assert.throws(() => applyAction(corrupt, 'm', { type: 'advanceBots' }));
      assert.throws(() => viewGame(corrupt, 'm'));
      assert.deepEqual(corrupt, old);
    }
  }
});

function wormEntry(remaining: boolean, truth = false) {
  const g = fixture('robbery', 'fremen');
  Object.assign(g, {
    advanced: true,
    phase: 1,
    nexus: true,
    active: null,
    order: ['e', 'm', 'a'],
  });
  player(g, 'e').forces = {
    'imperial_basin:10': 3,
    ...(remaining ? { 'hagga_basin:11': 1 } : {}),
  };
  player(g, 'e').reserves = remaining ? 16 : 17;
  const karama = named(g, 'e', 'Karama');
  if (truth) named(g, 'm', 'Truthtrance');
  hold(g, 'm', truth ? 3 : 4);
  g.decision = { kind: 'wormRide', player: 'e', territory: 'imperial_basin' };
  g.wormRides = remaining ? ['hagga_basin'] : [];
  const entered = applyAction(g, 'e', {
    type: 'decision',
    accept: true,
    territory: 'arrakeen',
    sector: 10,
    forces: { 'imperial_basin:10': 2 },
  });
  return applyAction(entered, 'e', {
    type: 'card',
    mode: 'special',
    card: karama,
    territory: 'broken_land',
  });
}

for (const remaining of [false, true])
  void test(`Robbery discard restores the summoned Nexus before ${remaining ? 'the remaining worm ride' : 'phase advancement'}`, () => {
    let g = wormEntry(remaining);
    const forces = structuredClone(player(g, 'e').forces);
    assert.equal(g.summonedNexusBeforeRides, true);
    g = decide(decide(g, { reveal: true }), { choice: 'card' });
    const pending = inner(g, 'm', {
      type: 'decision',
      card: player(g, 'm').hand[0].id,
    });
    assert.equal(continuation(pending).entry.resume, 'wormRide');
    const after = recover(pending);
    assert.equal(after.nexus, true);
    assert.equal(after.phase, 1);
    assert.equal(after.summonedNexusBeforeRides, false);
    assert.equal(after.pendingTerrorEntry, null);
    assert.equal(after.decision, null);
    assert.deepEqual(after.ready, []);
    assert.deepEqual(player(after, 'e').forces, forces);
    assert.deepEqual(after.deck, g.deck);
    let result = after;
    for (const p of result.players)
      result = applyAction(result, p.id, { type: 'ready' });
    if (remaining)
      assert.deepEqual(result.decision, {
        kind: 'wormRide',
        player: 'e',
        territory: 'hagga_basin',
      });
    else assert.equal(result.phase, 2);
    assert.deepEqual(player(result, 'e').forces, forces);
    inventory(result);
  });

void test('Truthtrance consumes Robbery overflow with only its own discard event and resumes the deferred Nexus once', () => {
  let g = wormEntry(true, true);
  const truth = player(g, 'm').hand.find((c) => c.effect === 'truthtrance')!.id;
  g = decide(decide(g, { reveal: true }), { choice: 'card' });
  const deck = structuredClone(g.deck),
    forces = structuredClone(player(g, 'e').forces);
  g = applyAction(g, 'm', { type: 'card', card: truth });
  while (g.truthtrance?.stage === 'priority') {
    const id = g.players.find((p) => !g.truthtrance!.passed.includes(p.id))!.id;
    g = applyAction(g, id, { type: 'truthPass' });
  }
  g = applyAction(g, 'm', {
    type: 'truthAsk',
    question: {
      kind: 'fact',
      target: 'a',
      fact: { kind: 'hand', name: 'Shield' },
    },
  });
  g = applyAction(reload(g), 'a', { type: 'truthAnswer', answer: 'no' });
  assert.equal(g.pendingTerrorEntry, null);
  assert.equal(g.decision, null);
  assert.equal(g.truthtrance, null);
  assert.equal(g.treacheryDiscardSequence, 1);
  assert.equal(g.resolvedTreacheryDiscardSequence, 1);
  assert.equal(g.pendingTreacheryDiscard ?? null, null);
  assert.equal(player(g, 'm').hand.length, 4);
  assert.equal(g.nexus, true);
  assert.equal(g.phase, 1);
  assert.deepEqual(g.deck, deck);
  assert.deepEqual(player(g, 'e').forces, forces);
  assert.equal(g.discard.filter((c) => c.id === truth).length, 1);
  assert.deepEqual(normalizeAutomaticGame(reload(g)), reload(g));
  inventory(g);
});

void test('saved Terror origins require the real Fremen worm-ride continuation and reject conflicting active contexts', () => {
  let worm = wormEntry(true);
  worm = decide(decide(worm, { reveal: true }), { choice: 'card' });
  const ridden = inner(worm, 'm', {
    type: 'decision',
    card: player(worm, 'm').hand[0].id,
  });
  const shipped = sabotage().pending;
  assert.equal(continuation(ridden).entry.cause, 'wormRide');
  assert.equal(continuation(ridden).entry.resume, 'wormRide');
  assert.equal(continuation(shipped).entry.cause, 'shipment');
  assert.equal(continuation(shipped).entry.resume, 'none');
  const cases: [Game, (g: Game) => void][] = [
    [
      ridden,
      (g) => {
        continuation(g).entry.resume = 'none';
      },
    ],
    [
      ridden,
      (g) => {
        player(g, 'e').faction = 'emperor';
      },
    ],
    [
      ridden,
      (g) => {
        continuation(g).entry.cause = 'movement';
      },
    ],
    [
      ridden,
      (g) => {
        // Keep the generic frame stamp coherent so the producer's phase binding
        // itself rejects a worm ride transplanted into Shipment & Movement.
        g.phase = 5;
        continuation(g).entry.phase = 5;
        g.pendingTreacheryDiscard!.batch.phase = 5;
        g.pendingTreacheryDiscard!.batch.event = `discard:${g.turn}:5:${g.treacheryDiscardSequence}`;
      },
    ],
    [
      shipped,
      (g) => {
        continuation(g).entry.cause = 'wormRide';
      },
    ],
    [
      shipped,
      (g) => {
        continuation(g).entry.resume = 'wormRide';
      },
    ],
  ];
  for (const source of [ridden, shipped])
    for (const key of ['pendingExchange', 'summonedWorm'])
      cases.push([
        source,
        (g) => {
          Object.assign(g, { [key]: {} });
        },
      ]);
  for (const [source, mutate] of cases) {
    const corrupt = reload(source);
    mutate(corrupt);
    const before = structuredClone(corrupt);
    assert.throws(() => normalizeAutomaticGame(corrupt));
    assert.throws(() => applyAction(corrupt, 'm', { type: 'advanceBots' }));
    assert.throws(() => viewGame(corrupt, 'm'));
    assert.deepEqual(corrupt, before);
  }
  recover(ridden);
  recover(shipped);
});

void test('an actual zero-valued No-Field shipment triggers Sabotage and restores its one-marker arrival receipt', () => {
  const initial = fixture('sabotage', 'richese');
  initial.expansions = ['choam'];
  const richese = player(initial, 'e');
  richese.noField = createRicheseNoField([
    'zero-marker',
    'three-marker',
    'five-marker',
  ]);
  richese.noFieldEvent = 'zero-shipment-event';
  hold(initial, 'e', 2);
  const ids = inventory(initial);
  const entered = applyAction(initial, 'e', {
    type: 'ship',
    noField: 'zero-marker',
    event: richese.noFieldEvent,
    territory: 'arrakeen',
    sector: 10,
  });
  assert.equal(entered.pendingTerrorEntry?.stage, 'offer');
  // The concealed zero marker counts as one arrival, without moving any
  // physical reserve force. The Terror receipt records that public presence.
  assert.equal(entered.pendingTerrorEntry?.amount, 1);
  assert.equal(entered.pendingTerrorEntry?.elite, 0);
  assert.equal(player(entered, 'e').shipped, true);
  assert.equal(player(entered, 'e').spice, 19);
  assert.equal(player(entered, 'e').reserves, 20);
  assert.deepEqual(player(entered, 'e').forces, {});
  assert.ok(player(entered, 'e').noField!.deployed);
  assert.equal(
    player(entered, 'e').noField!.tokens.find((t) => t.id === 'zero-marker')!
      .value,
    0,
  );
  const pending = inner(entered, 'm', { type: 'decision', reveal: true });
  assert.equal(continuation(pending).entry.amount, 1);
  assert.equal(continuation(pending).entry.cause, 'shipment');
  const settled = recover(pending);
  assert.equal(settled.pendingTerrorEntry, null);
  assert.equal(player(settled, 'e').hand.length, 1);
  assert.deepEqual(player(settled, 'e').noField, player(entered, 'e').noField);
  assert.equal(player(settled, 'e').spice, 19);
  assert.equal(player(settled, 'e').reserves, 20);
  assert.deepEqual(player(settled, 'e').forces, {});
  assert.deepEqual(inventory(settled), ids);
  for (const p of settled.players) viewGame(settled, p.id);
});
