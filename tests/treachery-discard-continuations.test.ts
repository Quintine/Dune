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
import { richeseCards } from '../game/richese-cards';
import { baseDeck } from '../game/cards';
import { createAmbassadors, placeAmbassador } from '../game/ecaz-ambassadors';

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
function base() {
  const g = createGame('DISCARDFRAME', newPlayer('ec', 'Ecaz', 'ecaz'));
  g.players.push(
    newPlayer('in', 'Entrant', 'emperor'),
    newPlayer('al', 'Ally', 'atreides'),
  );
  Object.assign(g, {
    status: 'playing',
    turn: 2,
    phase: 5,
    storm: 18,
    active: 'in',
    order: ['in', 'ec', 'al'],
    movementRemaining: ['in', 'ec', 'al'],
    deck: baseDeck(),
  });
  for (const p of g.players) {
    p.spice = 20;
    p.traitors = [p.leaders[0].id];
  }
  return g;
}
function ambassador(
  effect: 'ixians' | 'choam',
  copied = false,
  lastCohort = false,
) {
  let g = base();
  const inventory = createAmbassadors(() => 0),
    chosen = inventory.tokens.find(
      (t) => t.effect === (copied ? 'beneGesserit' : effect),
    )!;
  inventory.cohort = [
    chosen,
    ...inventory.tokens.filter(
      (t) =>
        t.effect !== 'ecaz' &&
        t.id !== chosen.id &&
        (!copied || t.effect !== effect),
    ),
  ]
    .slice(0, 5)
    .map((t) => t.id);
  for (const token of inventory.tokens)
    token.zone =
      token.effect === 'ecaz' || inventory.cohort.includes(token.id)
        ? 'supply'
        : 'pool';
  g.ecazAmbassadors = placeAmbassador(inventory, chosen.id, {
    turn: 1,
    availableSpice: 20,
    destination: {
      id: 'arrakeen',
      stronghold: true,
      inStorm: false,
      allowed: true,
    },
  }).state;
  if (lastCohort)
    for (const token of g.ecazAmbassadors!.tokens)
      if (inventory.cohort.includes(token.id) && token.id !== chosen.id)
        token.zone = token.effect === 'beneGesserit' ? 'removed' : 'used';
  player(g, 'ec').hand = g.deck.splice(0, 2);
  g = applyAction(g, 'in', {
    type: 'ship',
    amount: 2,
    territory: 'arrakeen',
    sector: 10,
  });
  g = applyAction(g, 'ec', {
    type: 'decision',
    event: g.pendingAmbassador!.event,
    trigger: true,
    beneficiary: 'ec',
  });
  if (copied) {
    assert.equal(g.pendingAmbassador?.stage, 'copy');
    assert.ok(g.pendingAmbassador!.copyChoices.includes(effect));
    g = applyAction(g, 'ec', {
      type: 'decision',
      event: g.pendingAmbassador!.event,
      effect,
    });
  }
  assert.equal(g.pendingAmbassador?.stage, 'cards');
  const action = {
    type: 'decision',
    event: g.pendingAmbassador!.event,
    cards: player(g, 'ec')
      .hand.slice(0, effect === 'ixians' ? 1 : 2)
      .map((c) => c.id),
  };
  return { g, action };
}
function ambassadorFrame(effect: 'ixians' | 'choam') {
  const { g, action } = ambassador(effect),
    frame = inner(g, 'ec', action);
  assert.ok(frame.pendingTreacheryDiscard);
  return { before: g, action, frame };
}
function ixFrame() {
  let g = createGame(
    'IXDISCARDFRAME',
    newPlayer('i', 'Ixians', 'ixians'),
    false,
    ['ix'],
  );
  g.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('a', 'Atreides', 'atreides'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 3,
    turn: 2,
    storm: 18,
    order: ['i', 'e', 'a'],
    active: 'a',
    deck: baseDeck(),
  });
  for (const p of g.players) {
    p.spice = 20;
    p.traitors = [p.leaders[0].id];
  }
  player(g, 'i').ally = 'a';
  player(g, 'a').ally = 'i';
  const won = g.deck.shift()!;
  g.auction = {
    cards: [won],
    index: 0,
    bid: 2,
    bidder: 'a',
    active: 'a',
    passed: [],
    opener: 0,
  };
  g.decision = { kind: 'auctionPayment', player: 'a' };
  g = applyAction(g, 'a', { type: 'decision', karama: false });
  assert.equal(g.decision?.kind, 'ixAllyCard');
  const paid = reload(g);
  g = inner(g, 'a', { type: 'decision', accept: true });
  for (
    let n = 0;
    n < g.players.length && g.response?.kind === 'ixAllyCard';
    n++
  )
    g = inner(
      g,
      g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
      { type: 'passResponse' },
    );
  assert.equal(g.response?.kind, 'ixAllyCard');
  assert.equal(g.response!.passed.length, g.players.length);
  // The automatic response loop invokes this same function before draining.
  observed.finishResponse!(g, false);
  g = reload(g);
  assert.ok(g.pendingTreacheryDiscard);
  return { paid, frame: g, won };
}
function counts(g: Game) {
  return [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]
    .map((c) => c.id)
    .sort();
}
function atomicReject(g: Game) {
  const before = reload(g);
  assert.throws(() => normalizeAutomaticGame(g));
  assert.deepEqual(g, before);
  assert.throws(() => applyAction(g, g.players[0].id, { type: 'advanceBots' }));
  assert.deepEqual(g, before);
  assert.throws(() => viewGame(g, g.players[0].id));
  assert.deepEqual(g, before);
}

void test('actual Ixian Ambassador discard emits a detached private frame and restored replacement draws once', () => {
  const { before, action, frame } = ambassadorFrame('ixians');
  const pending = frame.pendingTreacheryDiscard!,
    replacement = before.deck[0];
  assert.equal(frame.pendingAmbassador, null);
  assert.equal(frame.decision, null);
  assert.equal(pending.sequence, frame.treacheryDiscardSequence);
  assert.equal(
    pending.sequence,
    (frame.resolvedTreacheryDiscardSequence ?? 0) + 1,
  );
  assert.equal(
    pending.batch.event,
    `discard:${frame.turn}:${frame.phase}:${pending.sequence}`,
  );
  assert.equal(pending.batch.cause, 'ambassador:ixians');
  assert.ok(
    pending.batch.entries.every((e) => e.discardedBy === 'ec' && !e.publicFace),
  );
  assert.deepEqual(frame.deck, before.deck);
  assert.equal(player(frame, 'ec').hand.length, 1);
  assert.deepEqual(pending.continuation, {
    kind: 'ambassador',
    entry: before.pendingAmbassador,
  });
  const done = normalizeAutomaticGame(reload(frame));
  assert.equal(done.pendingTreacheryDiscard, null);
  assert.equal(done.resolvedTreacheryDiscardSequence, pending.sequence);
  assert.equal(
    player(done, 'ec').hand.filter((c) => c.id === replacement.id).length,
    1,
  );
  assert.equal(player(done, 'ec').spice, 20);
  assert.deepEqual(counts(done), counts(before));
  assert.deepEqual(
    player(done, 'in'),
    player(frame, 'in'),
    'paid shipment must not replay',
  );
  assert.deepEqual(normalizeAutomaticGame(reload(done)), done);
  assert.deepEqual(
    applyAction(before, 'ec', action),
    done,
    'public wrapper drains the same frame',
  );
});
void test('CHOAM Ambassador bank payout and log are committed before the frame and never paid twice', () => {
  const { before, action, frame } = ambassadorFrame('choam');
  assert.equal(player(frame, 'ec').spice, 26);
  assert.equal(player(frame, 'ec').hand.length, 0);
  assert.equal(frame.pendingTreacheryDiscard!.batch.entries.length, 2);
  const payoutLogs = frame.log.filter(
    (e) => e.automatic?.name === 'CHOAM Ambassador',
  );
  assert.equal(payoutLogs.length, 1);
  const done = normalizeAutomaticGame(reload(frame));
  assert.equal(player(done, 'ec').spice, 26);
  assert.deepEqual(done.deck, before.deck);
  assert.deepEqual(
    done.log.filter((e) => e.automatic?.name === 'CHOAM Ambassador'),
    payoutLogs,
  );
  assert.deepEqual(normalizeAutomaticGame(reload(done)), done);
  assert.deepEqual(applyAction(before, 'ec', action), done);
});
void test('Ixian ally replacement frame preserves its paid sale and draws before Emperor income exactly once', () => {
  const { paid, frame, won } = ixFrame(),
    replacement = paid.deck[0];
  assert.equal(player(frame, 'a').spice, 18);
  assert.equal(player(frame, 'e').spice, 20);
  assert.equal(frame.pendingIxAlly, null);
  assert.equal(frame.pendingTreacheryDiscard!.continuation.kind, 'ixAllyCard');
  assert.deepEqual(frame.currentAuctionSale, paid.currentAuctionSale);
  assert.deepEqual(frame.deck, paid.deck);
  assert.equal(
    player(frame, 'a').hand.some((c) => c.id === won.id),
    false,
  );
  const done = normalizeAutomaticGame(reload(frame));
  assert.equal(
    player(done, 'a').hand.filter((c) => c.id === replacement.id).length,
    1,
  );
  assert.equal(player(done, 'a').spice, 18);
  assert.equal(player(done, 'e').spice, 22);
  assert.equal(done.discard.filter((c) => c.id === won.id).length, 1);
  assert.equal(done.pendingTreacheryDiscard, null);
  assert.deepEqual(normalizeAutomaticGame(reload(done)), done);
});
void test('empty-deck Ix Ambassador resumes a refill once after its fresh discard, without a duplicate physical card', () => {
  const { g, action } = ambassador('ixians');
  // Isolate the real empty-deck continuation: all unused cards already lie in discard.
  g.discard.push(...g.deck.splice(0));
  const frame = inner(g, 'ec', action);
  assert.equal(frame.deck.length, 0);
  const inventory = counts(frame),
    done = normalizeAutomaticGame(reload(frame));
  assert.equal(player(done, 'ec').hand.length, 2);
  assert.deepEqual(counts(done), inventory);
  assert.deepEqual(normalizeAutomaticGame(reload(done)), done);
});
void test('stale sequence, event, turn, phase and physical ownership corruptions reject without mutation', () => {
  const { frame } = ambassadorFrame('ixians');
  const cases: Array<(g: Game) => void> = [
    (g) => {
      g.treacheryDiscardSequence!++;
    },
    (g) => {
      g.resolvedTreacheryDiscardSequence = g.treacheryDiscardSequence;
    },
    (g) => {
      g.pendingTreacheryDiscard!.sequence++;
    },
    (g) => {
      g.pendingTreacheryDiscard!.batch.event = 'old';
    },
    (g) => {
      g.pendingTreacheryDiscard!.batch.turn++;
    },
    (g) => {
      g.pendingTreacheryDiscard!.batch.phase++;
    },
    (g) => {
      g.pendingTreacheryDiscard!.batch.entries[0].discardedBy = 'in';
    },
    (g) => {
      g.pendingTreacheryDiscard!.batch.entries[0].card.name = 'forged';
    },
    (g) => {
      player(g, 'in').hand.push(
        structuredClone(g.pendingTreacheryDiscard!.batch.entries[0].card),
      );
    },
    (g) => {
      g.discard = g.discard.filter(
        (c) => c.id !== g.pendingTreacheryDiscard!.batch.entries[0].card.id,
      );
    },
  ];
  for (const corrupt of cases) {
    const g = reload(frame);
    corrupt(g);
    atomicReject(g);
  }
});
void test('Ix saved sale and auction binding corruption cannot mint a replacement or income', () => {
  const { frame } = ixFrame();
  for (const corrupt of [
    (g: Game) => {
      g.currentAuctionSale!.amount++;
    },
    (g: Game) => {
      g.auction!.index++;
    },
    (g: Game) => {
      const c = g.pendingTreacheryDiscard!.continuation;
      assert.equal(c.kind, 'ixAllyCard');
      if (c.kind === 'ixAllyCard') c.player = 'e';
    },
  ]) {
    const g = reload(frame);
    corrupt(g);
    atomicReject(g);
  }
});
void test('pending receipts and fresh private card faces stay out of every player view', () => {
  for (const frame of [
    ambassadorFrame('ixians').frame,
    ambassadorFrame('choam').frame,
    ixFrame().frame,
  ]) {
    for (const p of frame.players) {
      const view = viewGame(frame, p.id);
      assert.equal('pendingTreacheryDiscard' in view, false);
      assert.equal('treacheryDiscardSequence' in view, false);
      for (const other of view.players.filter((o) => o.id !== p.id))
        assert.equal(other.hand, undefined);
      assert.equal('discard' in view, false);
      assert.equal('deck' in view, false);
    }
  }
});
void test('runBots with zero gameplay steps still drains saved discard continuations exactly once', () => {
  for (const frame of [
    ambassadorFrame('ixians').frame,
    ambassadorFrame('choam').frame,
    ixFrame().frame,
  ]) {
    const expected = normalizeAutomaticGame(reload(frame)),
      actual = runBots(reload(frame), 0);
    assert.equal(actual.pendingTreacheryDiscard, null);
    assert.deepEqual(
      { ...actual, botsPending: undefined },
      { ...expected, botsPending: undefined },
    );
    assert.deepEqual(normalizeAutomaticGame(reload(actual)), actual);
  }
});

void test('a different private Ambassador discard face does not change any public or unentitled player projection', () => {
  const { frame } = ambassadorFrame('ixians'),
    changed = reload(frame);
  const entry = changed.pendingTreacheryDiscard!.batch.entries[0];
  const pileIndex = changed.discard.findIndex(
    (card) => card.id === entry.card.id,
  );
  const previous = changed.discard[pileIndex],
    replacement = changed.deck[0];
  changed.discard[pileIndex] = replacement;
  changed.deck[0] = previous;
  entry.card = structuredClone(replacement);
  for (const p of frame.players)
    assert.deepEqual(viewGame(changed, p.id), viewGame(frame, p.id));
});

function blackMarketFrame() {
  let g = createGame(
    'BLACKMARKETFRAME',
    newPlayer('r', 'Richese', 'richese'),
    true,
    ['ix', 'choam'],
  );
  g.players.push(
    newPlayer('i', 'Ixians', 'ixians'),
    newPlayer('a', 'Atreides', 'atreides'),
    newPlayer('e', 'Emperor', 'emperor'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 2,
    turn: 2,
    storm: 18,
    order: ['a', 'i', 'e', 'r'],
    deck: baseDeck(),
    richeseCache: richeseCards(),
    richeseRemoved: [],
  });
  for (const p of g.players) {
    p.spice = 20;
    p.traitors = [p.leaders[0].id];
  }
  player(g, 'i').ally = 'a';
  player(g, 'a').ally = 'i';
  const sold = g.deck.shift()!;
  player(g, 'r').hand.push(sold);
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  if (g.phaseOpening)
    for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.decision?.kind, 'richeseBlackMarket');
  g = applyAction(g, 'r', {
    type: 'decision',
    event: g.richeseBidding!.event,
    card: sold.id,
    method: 'silent',
  });
  for (const id of ['a', 'i', 'e', 'r'])
    g = applyAction(g, id, {
      type: 'richeseBid',
      event: g.richeseAuction!.event,
      amount: id === 'a' ? 3 : 0,
    });
  assert.equal(g.decision?.kind, 'ixAllyCard');
  assert.equal(player(g, 'a').spice, 17);
  assert.equal(player(g, 'r').spice, 20);
  const paid = reload(g);
  g = inner(g, 'a', { type: 'decision', accept: true });
  for (let n = 0; n < g.players.length; n++)
    g = inner(
      g,
      g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
      { type: 'passResponse' },
    );
  observed.finishResponse!(g, false);
  assert.ok(g.pendingTreacheryDiscard);
  return { frame: reload(g), paid, sold };
}

void test('an actual Black Market sale resumes Ix replacement before seller income and never pays Emperor', () => {
  const { frame, paid, sold } = blackMarketFrame(),
    replacement = paid.deck[0];
  assert.equal(frame.currentAuctionSale!.origin, 'blackMarket');
  assert.equal(
    frame.pendingTreacheryDiscard!.batch.entries[0].publicFace,
    false,
  );
  assert.equal(player(frame, 'r').spice, 20);
  assert.equal(player(frame, 'e').spice, 20);
  const done = normalizeAutomaticGame(reload(frame));
  assert.equal(player(done, 'r').spice, 23);
  assert.equal(player(done, 'a').spice, 17);
  assert.equal(player(done, 'e').spice, 20);
  assert.ok(player(done, 'a').hand.some((c) => c.id === replacement.id));
  assert.equal(done.discard.filter((c) => c.id === sold.id).length, 1);
  assert.equal(done.decision?.kind, 'richeseDeclaration');
  assert.equal(done.richeseAuction, null);
  assert.deepEqual(normalizeAutomaticGame(reload(done)), done);
  const live = applyAction(paid, 'a', { type: 'decision', accept: true });
  assert.ok(live.richeseBidding!.event);
  assert.notEqual(live.richeseBidding!.event, paid.richeseBidding!.event);
  // Independent continuations create independent UUIDs for the next declaration.
  assert.deepEqual(
    {
      ...live,
      richeseBidding: {
        ...live.richeseBidding,
        event: done.richeseBidding!.event,
      },
    },
    done,
  );
});

void test('BG copied Ixian and CHOAM effects preserve their discard batches and replenish the final cohort only once', () => {
  for (const effect of ['ixians', 'choam'] as const)
    for (const copied of [false, true]) {
      const { g, action } = ambassador(effect, copied, true),
        oldCohort = [...g.ecazAmbassadors!.cohort],
        frame = inner(g, 'ec', action);
      assert.deepEqual(frame.ecazAmbassadors!.cohort, oldCohort);
      assert.equal(
        frame.log.filter((e) =>
          e.text.startsWith('All five random Ambassadors'),
        ).length,
        0,
      );
      const entry = frame.pendingTreacheryDiscard!.continuation;
      assert.equal(entry.kind, 'ambassador');
      if (entry.kind !== 'ambassador') throw Error('Unexpected frame');
      assert.equal(entry.entry.effect, effect);
      if (copied) {
        assert.ok(entry.entry.copyChoices.includes(effect));
        assert.equal(
          frame.ecazAmbassadors!.tokens.find((t) => t.id === entry.entry.token)!
            .zone,
          'removed',
        );
      }
      assert.equal(
        frame.pendingTreacheryDiscard!.batch.entries.length,
        effect === 'ixians' ? 1 : 2,
      );
      const replacement = frame.deck[0],
        done = normalizeAutomaticGame(reload(frame));
      assert.equal(player(done, 'ec').spice, effect === 'choam' ? 26 : 20);
      assert.equal(player(done, 'ec').hand.length, effect === 'ixians' ? 2 : 0);
      if (effect === 'ixians')
        assert.ok(player(done, 'ec').hand.some((c) => c.id === replacement.id));
      assert.equal(
        done.ecazAmbassadors!.tokens.filter(
          (t) => t.zone === 'supply' && t.effect !== 'ecaz',
        ).length,
        5,
      );
      assert.equal(
        done.log.filter((e) => e.text.startsWith('All five random Ambassadors'))
          .length,
        1,
      );
      if (copied)
        assert.equal(
          done.ecazAmbassadors!.tokens.find((t) => t.id === entry.entry.token)!
            .zone,
          'removed',
        );
      assert.deepEqual(normalizeAutomaticGame(reload(done)), done);
    }
});

void test('matching corrupted sale snapshots still fail their independent paid-auction and alliance bindings', () => {
  const normal = ixFrame().frame,
    black = blackMarketFrame().frame;
  const cases: Array<[Game, (g: Game) => void]> = [
    [
      normal,
      (g) => {
        g.currentAuctionSale!.amount++;
        const c = g.pendingTreacheryDiscard!.continuation;
        if (c.kind === 'ixAllyCard')
          c.sale.amount = g.currentAuctionSale!.amount;
      },
    ],
    [
      normal,
      (g) => {
        g.currentAuctionSale!.amount = -1;
        const c = g.pendingTreacheryDiscard!.continuation;
        if (c.kind === 'ixAllyCard') c.sale.amount = -1;
      },
    ],
    [
      normal,
      (g) => {
        player(g, 'i').ally = null;
      },
    ],
    [
      normal,
      (g) => {
        player(g, 'a').ally = null;
      },
    ],
    [
      normal,
      (g) => {
        g.currentAuctionSale!.origin = 'cache';
        const c = g.pendingTreacheryDiscard!.continuation;
        if (c.kind === 'ixAllyCard') c.sale.origin = 'cache';
      },
    ],
    [
      normal,
      (g) => {
        Object.assign(g.currentAuctionSale!, { free: 'true' });
        const c = g.pendingTreacheryDiscard!.continuation;
        if (c.kind === 'ixAllyCard') {
          Object.assign(c.sale, { free: 'true' });
          Object.assign(c, { free: 'true' });
        }
      },
    ],
    [
      black,
      (g) => {
        g.currentAuctionSale!.free = true;
        const c = g.pendingTreacheryDiscard!.continuation;
        if (c.kind === 'ixAllyCard') {
          c.sale.free = true;
          c.free = true;
        }
      },
    ],
    [
      black,
      (g) => {
        g.currentAuctionSale!.amount++;
        const c = g.pendingTreacheryDiscard!.continuation;
        if (c.kind === 'ixAllyCard')
          c.sale.amount = g.currentAuctionSale!.amount;
      },
    ],
    [
      black,
      (g) => {
        g.richeseAuction!.outcome = { kind: 'unbid' };
      },
    ],
    [
      black,
      (g) => {
        g.richeseAuction!.outcome = { kind: 'sold', winner: 'e', amount: 3 };
      },
    ],
    [
      black,
      (g) => {
        g.currentAuctionSale!.seller = 'a';
        const c = g.pendingTreacheryDiscard!.continuation;
        if (c.kind === 'ixAllyCard') c.sale.seller = 'a';
      },
    ],
  ];
  for (const [source, corrupt] of cases) {
    const g = reload(source);
    corrupt(g);
    atomicReject(g);
  }
});

void test('wrong Ambassador token, copy permission, beneficiary, location or resume cannot finish a saved effect', () => {
  const original = ambassadorFrame('ixians').frame;
  const { g: copyBefore, action } = ambassador('choam', true),
    copied = inner(copyBefore, 'ec', action);
  const cases: Array<[Game, (g: Game) => void]> = [
    [
      original,
      (g) => {
        const c = g.pendingTreacheryDiscard!.continuation;
        if (c.kind === 'ambassador') {
          c.entry.effect = 'choam';
          g.pendingTreacheryDiscard!.batch.cause = 'ambassador:choam';
        }
      },
    ],
    [
      original,
      (g) => {
        const c = g.pendingTreacheryDiscard!.continuation;
        if (c.kind === 'ambassador')
          g.ecazAmbassadors!.tokens.find((t) => t.id === c.entry.token)!.zone =
            'supply';
      },
    ],
    [
      original,
      (g) => {
        const c = g.pendingTreacheryDiscard!.continuation;
        if (c.kind === 'ambassador') c.entry.resume = 'wormRide';
      },
    ],
    [
      original,
      (g) => {
        const c = g.pendingTreacheryDiscard!.continuation;
        if (c.kind === 'ambassador') c.entry.territory = 'polar_sink';
      },
    ],
    [
      original,
      (g) => {
        const c = g.pendingTreacheryDiscard!.continuation;
        if (c.kind === 'ambassador') c.entry.sector = 18;
      },
    ],
    [
      original,
      (g) => {
        const c = g.pendingTreacheryDiscard!.continuation;
        if (c.kind === 'ambassador') {
          c.entry.beneficiary = 'al';
          for (const e of g.pendingTreacheryDiscard!.batch.entries)
            e.discardedBy = 'al';
        }
      },
    ],
    [
      copied,
      (g) => {
        const c = g.pendingTreacheryDiscard!.continuation;
        if (c.kind === 'ambassador') c.entry.copyChoices = [];
      },
    ],
    [
      copied,
      (g) => {
        const c = g.pendingTreacheryDiscard!.continuation;
        if (c.kind === 'ambassador')
          g.ecazAmbassadors!.tokens.find((t) => t.id === c.entry.token)!.zone =
            'used';
      },
    ],
  ];
  for (const [source, corrupt] of cases) {
    const g = reload(source);
    corrupt(g);
    atomicReject(g);
  }
});

void test('impossible pending overlays are rejected and every profile waits for the automatic continuation marker', () => {
  const sources = [
    ambassadorFrame('ixians').frame,
    ixFrame().frame,
    blackMarketFrame().frame,
  ];
  for (const source of sources) {
    for (const key of [
      'response',
      'decision',
      'truthtrance',
      'phaseOpening',
      'pendingRicheseGift',
      'pendingKarama',
      'pendingNullentropy',
      'pendingAmbassador',
      'pendingIxAlly',
    ]) {
      const g = reload(source);
      Object.assign(g, { [key]: {} });
      atomicReject(g);
    }
    for (const level of DIFFICULTIES)
      for (const p of source.players) {
        const view = viewGame(source, p.id);
        view.players.find((x) => x.id === p.id)!.bot = level;
        assert.equal(view.automaticContinuationPending, true);
        assert.deepEqual(botActions(view), []);
      }
    const done = normalizeAutomaticGame(reload(source));
    for (const p of done.players)
      assert.equal(viewGame(done, p.id).automaticContinuationPending, false);
  }
});
