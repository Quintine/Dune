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
import { richeseCards } from '../game/richese-cards';
import { createAmbassadors, placeAmbassador } from '../game/ecaz-ambassadors';
import { createAuditorLeader, CHOAM_AUDITOR_ID } from '../game/choam-auditor';

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
const BOX = 'richese-nullentropy-box';
function fixture(faction: FactionId = 'richese', phase = 4) {
  const g = createGame('BOXFRAME', newPlayer('p', 'Searcher', faction), true, [
    'choam',
  ]);
  g.players.push(
    newPlayer('q', 'Guild', 'guild'),
    newPlayer('e', 'Emperor', 'emperor'),
  );
  Object.assign(g, {
    status: 'playing',
    phase,
    turn: 2,
    storm: 18,
    order: ['p', 'q', 'e'],
    active: 'p',
    deck: baseDeck(),
    richeseCache: richeseCards(),
  });
  for (const p of g.players) {
    p.spice = 10;
    p.hand = [];
    p.forces = {};
    p.reserves = 20;
    p.traitors = [];
  }
  hold(g, 'p', 'Nullentropy Box');
  g.discard.push(...g.deck.splice(0, 4));
  return g;
}
function hold(g: Game, id: string, name: string) {
  const source = g.richeseCache!.some((c) => c.name === name)
    ? g.richeseCache!
    : g.deck;
  const index = source.findIndex((c) => c.name === name);
  assert.ok(index >= 0, name);
  const [card] = source.splice(index, 1);
  player(g, id).hand.push(card);
  return card.id;
}
function inventory(g: Game) {
  const ids = [
    ...g.deck,
    ...g.discard,
    ...g.richeseCache!,
    ...g.players.flatMap((p) => p.hand),
  ]
    .map((c) => c.id)
    .sort();
  assert.equal(new Set(ids).size, ids.length);
  return ids;
}
const begin = (g: Game, id = 'p') =>
  applyAction(g, id, { type: 'card', card: BOX });
function selection(g: Game, card = g.discard[0].id): Action {
  return { type: 'decision', event: g.pendingNullentropy!.event, card };
}
function completed(g = fixture()) {
  const paid = begin(g),
    action = selection(paid),
    pending = inner(paid, 'p', action);
  return { initial: g, paid, pending, action };
}
function receipt(g: Game) {
  const c = g.pendingTreacheryDiscard!.continuation;
  if (c.kind !== 'nullentropyDiscard') throw Error('Missing Box discard frame');
  return c;
}
function recover(g: Game) {
  const before = structuredClone(g),
    done = normalizeAutomaticGame(reload(g));
  assert.deepEqual(g, before);
  assert.equal(done.pendingTreacheryDiscard, null);
  // JSON omits absent optional controls; compare their persisted representation.
  assert.deepEqual(reload(normalizeAutomaticGame(reload(done))), reload(done));
  return done;
}

void test('paid many-choice Box commits only its used Box and resumes without another fee, selection or shuffle', (t) => {
  const { initial, paid, pending } = completed(),
    c = receipt(pending),
    batch = pending.pendingTreacheryDiscard!.batch;
  assert.equal(paid.pendingNullentropy!.event, c.searchEvent);
  assert.equal(batch.cause, 'nullentropyBox');
  assert.equal(batch.entries.length, 1);
  assert.deepEqual(
    batch.entries.map((e) => [e.card.id, e.discardedBy, e.publicFace]),
    [[BOX, 'p', true]],
  );
  assert.equal(pending.pendingNullentropy, null);
  assert.equal(pending.decision, null);
  assert.equal(player(pending, 'p').spice, 8);
  assert.equal(player(pending, 'q').spice, 10);
  assert.deepEqual(player(pending, 'p').hand, [c.selected]);
  assert.equal(pending.discard.at(-1)!.id, BOX);
  assert.deepEqual(
    c.finalDiscardIds,
    pending.discard.map((c) => c.id),
  );
  assert.equal(c.finalDiscardSignature, JSON.stringify(pending.discard));
  assert.deepEqual(
    pending.discard
      .slice(0, -1)
      .map((c) => c.id)
      .sort(),
    initial.discard
      .filter((x) => x.id !== c.selected.id)
      .map((x) => x.id)
      .sort(),
  );
  t.mock.method(crypto, 'getRandomValues', () => {
    throw Error('Recovery must not reshuffle');
  });
  const done = recover(pending);
  assert.deepEqual(done.players, pending.players);
  assert.deepEqual(done.discard, pending.discard);
  assert.deepEqual(done.log, pending.log);
  assert.deepEqual(done.deck, pending.deck);
  assert.equal(done.resolvedTreacheryDiscardSequence, 1);
  assert.deepEqual(inventory(done), inventory(initial));
  const replay = reload(done);
  replay.pendingTreacheryDiscard = pending.pendingTreacheryDiscard;
  assert.throws(() => normalizeAutomaticGame(replay));
});

void test('sole-choice paid Box emits and drains the same frame within one ordinary card action', () => {
  const initial = fixture();
  initial.deck.push(...initial.discard.splice(1));
  const selected = structuredClone(initial.discard[0]);
  const pending = inner(initial, 'p', { type: 'card', card: BOX });
  assert.equal(receipt(pending).selected.id, selected.id);
  assert.equal(pending.pendingNullentropy, null);
  assert.equal(player(pending, 'p').spice, 8);
  const done = recover(pending),
    ordinary = begin(initial);
  assert.deepEqual(done.players, ordinary.players);
  assert.deepEqual(done.discard, ordinary.discard);
  assert.deepEqual(done.log, ordinary.log);
  assert.equal(ordinary.pendingTreacheryDiscard, null);
  assert.equal(ordinary.decision, null);
  assert.equal(ordinary.resolvedTreacheryDiscardSequence, 1);
  assert.deepEqual(inventory(done), inventory(initial));
});

void test('Box frames expose the used Box but never the privately recovered identity and all profiles wait', () => {
  const { pending } = completed(),
    alternate = reload(pending),
    c = receipt(alternate);
  const recovered = player(alternate, 'p').hand.findIndex(
    (x) => x.id === c.selected.id,
  );
  const substitute = alternate.deck[0];
  alternate.deck[0] = player(alternate, 'p').hand[recovered];
  player(alternate, 'p').hand[recovered] = substitute;
  c.selected = structuredClone(substitute);
  for (const p of pending.players) {
    const view = viewGame(pending, p.id);
    assert.equal(view.automaticContinuationPending, true);
    assert.equal(view.nullentropy, null);
    assert.ok(!('pendingTreacheryDiscard' in view));
    if (p.id !== 'p') {
      assert.ok(!JSON.stringify(view).includes(receipt(pending).selected.id));
      assert.deepEqual(viewGame(alternate, p.id), view);
    }
    for (const level of DIFFICULTIES) {
      view.players.find((x) => x.id === p.id)!.bot = level;
      assert.deepEqual(botActions(view), []);
    }
  }
  const done = runBots(reload(pending), 0);
  assert.deepEqual(
    { ...done, botsPending: undefined },
    { ...recover(pending), botsPending: undefined },
  );
});

void test('Box restores an actual paid shipment income response without repeating transport or income', () => {
  let initial = fixture('richese', 5);
  initial.movementRemaining = [...initial.order];
  hold(initial, 'e', 'Karama');
  initial = applyAction(initial, 'p', {
    type: 'ship',
    amount: 1,
    territory: 'arrakeen',
    sector: 10,
  });
  assert.equal(initial.decision?.kind, 'guildShipment');
  initial = applyAction(initial, 'q', { type: 'decision', allow: true });
  assert.equal(initial.response?.kind, 'guildIncome');
  const { pending } = completed(initial),
    parent = structuredClone(initial.response),
    done = recover(pending);
  assert.equal(pending.response, null);
  assert.deepEqual(receipt(pending).resume.response, parent);
  assert.deepEqual(done.response, parent);
  assert.deepEqual(done.players, pending.players);
  assert.equal(player(done, 'p').spice, 7);
  assert.equal(player(done, 'p').reserves, 19);
  assert.equal(player(done, 'q').spice, 10);
  let result = done;
  while (result.response)
    result = applyAction(
      result,
      result.players.find((p) => !result.response!.passed.includes(p.id))!.id,
      { type: 'passResponse' },
    );
  assert.equal(player(result, 'q').spice, 11);
  assert.equal(player(result, 'p').reserves, 19);
  assert.deepEqual(inventory(result), inventory(initial));
});

void test('Box restores a suspended phase opening without initializing or replaying passes', () => {
  const initial = fixture('richese', 5);
  initial.phaseOpening = { passed: ['p'], initialize: false };
  const { pending } = completed(initial);
  assert.equal(pending.phaseOpening, null);
  const done = recover(pending);
  assert.deepEqual(done.phaseOpening, initial.phaseOpening);
  assert.deepEqual(done.players, pending.players);
  assert.deepEqual(done.log, pending.log);
});

void test('unreserved Box recovery preserves an actual Richese gift response and its separate card', () => {
  let initial = fixture();
  player(initial, 'p').ally = 'q';
  player(initial, 'q').ally = 'p';
  const gift = hold(initial, 'p', 'Distrans');
  hold(initial, 'e', 'Karama');
  initial = applyAction(initial, 'p', { type: 'richeseGift', card: gift });
  assert.equal(initial.response?.kind, 'richeseGift');
  const { pending } = completed(initial),
    parent = reload(initial).pendingRicheseGift;
  const done = recover(pending);
  assert.deepEqual(done.pendingRicheseGift, parent);
  assert.deepEqual(done.response, initial.response);
  assert.ok(player(done, 'p').hand.some((c) => c.id === gift));
  let result = done;
  while (result.response)
    result = applyAction(
      result,
      result.players.find((p) => !result.response!.passed.includes(p.id))!.id,
      { type: 'passResponse' },
    );
  assert.ok(player(result, 'q').hand.some((c) => c.id === gift));
  assert.ok(!player(result, 'p').hand.some((c) => c.id === gift));
  assert.equal(result.pendingRicheseGift, null);
  assert.deepEqual(inventory(result), inventory(initial));
});

void test('Box suspends a genuine BG Worthless conversion without treating its previous discard as fresh', () => {
  let initial = fixture('beneGesserit', 5);
  initial.active = 'q';
  const worthless = initial.deck.find((c) => c.kind === 'worthless')!;
  initial.deck.splice(
    initial.deck.findIndex((c) => c.id === worthless.id),
    1,
  );
  player(initial, 'p').hand.push(worthless);
  hold(initial, 'e', 'Karama');
  initial = applyAction(initial, 'p', {
    type: 'card',
    card: worthless.id,
    mode: 'shipment',
    target: 'q',
  });
  assert.equal(initial.response?.kind, 'worthlessKarama');
  assert.ok(initial.pendingKarama);
  const { pending } = completed(initial),
    done = recover(pending);
  assert.deepEqual(done.pendingKarama, initial.pendingKarama);
  assert.deepEqual(done.response, initial.response);
  assert.deepEqual(
    pending.pendingTreacheryDiscard!.batch.entries.map((e) => e.card.id),
    [BOX],
  );
  assert.ok(pending.discard.some((c) => c.id === worthless.id));
  let result = done;
  while (result.response)
    result = applyAction(
      result,
      result.players.find((p) => !result.response!.passed.includes(p.id))!.id,
      { type: 'passResponse' },
    );
  assert.deepEqual(result.karamaShipping, {
    owner: 'p',
    player: 'q',
    card: worthless.id,
  });
  assert.equal(result.pendingKarama, null);
  assert.deepEqual(inventory(result), inventory(initial));
});

void test('a restored Harkonnen bonus may refill after Box retirement without repeating the Box transaction', () => {
  const initial = fixture('richese', 3);
  player(initial, 'q').faction = 'harkonnen';
  const purchased = initial.deck.shift()!;
  player(initial, 'q').hand.push(purchased);
  initial.auction = {
    cards: [purchased],
    index: 0,
    bid: 2,
    bidder: 'q',
    active: 'q',
    passed: [],
    opener: 0,
  };
  initial.currentAuctionSale = {
    winner: 'q',
    amount: 2,
    free: false,
    origin: 'normal',
    seller: null,
  };
  initial.response = { kind: 'harkonnenBonus', owner: 'q', passed: [] };
  initial.discard.push(...initial.deck);
  initial.deck = [];
  const { pending } = completed(initial);
  assert.equal(player(pending, 'q').hand.length, 1);
  assert.equal(pending.deck.length, 0);
  assert.equal(pending.discard.at(-1)!.id, BOX);
  const done = recover(pending);
  assert.equal(player(done, 'q').hand.length, 2);
  assert.equal(player(done, 'p').hand.length, 1);
  assert.equal(player(done, 'p').spice, 8);
  assert.equal(done.resolvedTreacheryDiscardSequence, 1);
  assert.equal(
    done.log.filter((e) => e.automatic?.name === 'Nullentropy Box').length,
    1,
  );
  assert.deepEqual(inventory(done), inventory(initial));
});

void test('Box discard frames reject corrupted final pile, recovered custody, event and suspended controls atomically', () => {
  const { pending } = completed();
  const mutations: ((g: Game) => void)[] = [
    (g) => {
      g.turn++;
    },
    (g) => {
      g.phase = 5;
    },
    (g) => {
      g.treacheryDiscardSequence!++;
    },
    (g) => {
      g.pendingTreacheryDiscard!.batch.cause = 'wrong';
    },
    (g) => {
      g.pendingTreacheryDiscard!.batch.entries[0].publicFace = false;
    },
    (g) => {
      g.pendingTreacheryDiscard!.batch.entries[0].discardedBy = 'q';
    },
    (g) => {
      receipt(g).player = 'q';
    },
    (g) => {
      receipt(g).searchEvent = '';
    },
    (g) => {
      receipt(g).searchEvent = 'different-paid-search';
    },
    (g) => {
      receipt(g).parentSignature = 'different-parent';
    },
    (g) => {
      receipt(g).box = 'wrong';
    },
    (g) => {
      receipt(g).selected.name = 'forged';
    },
    (g) => {
      receipt(g).selected = structuredClone(g.discard.at(-1)!);
    },
    (g) => {
      g.deck.push(structuredClone(receipt(g).selected));
    },
    (g) => {
      player(g, 'p').hand = [];
    },
    (g) => {
      g.discard.reverse();
    },
    (g) => {
      g.discard[0].name = 'forged';
    },
    (g) => {
      receipt(g).finalDiscardIds.reverse();
    },
    (g) => {
      receipt(g).finalDiscardSignature = 'wrong';
    },
    (g) => {
      g.deck.push(structuredClone(g.discard.at(-1)!));
    },
    (g) => {
      receipt(g).resume.decision = { kind: 'nullentropy', player: 'q' };
    },
    (g) => {
      receipt(g).resume.response = {
        kind: 'guildIncome',
        owner: 'missing',
        passed: [],
        amount: 3,
      };
    },
    (g) => {
      receipt(g).resume.phaseOpening = {
        passed: ['missing'],
        initialize: false,
      };
    },
  ];
  for (const key of [
    'pendingNullentropy',
    'response',
    'decision',
    'phaseOpening',
    'pendingKarama',
    'truthtrance',
  ])
    mutations.push((g) => {
      Object.assign(g, { [key]: {} });
    });
  for (const mutate of mutations) {
    const corrupt = reload(pending);
    mutate(corrupt);
    const before = structuredClone(corrupt);
    assert.throws(() => normalizeAutomaticGame(corrupt));
    assert.throws(() => applyAction(corrupt, 'p', { type: 'advanceBots' }));
    assert.throws(() => viewGame(corrupt, 'p'));
    assert.deepEqual(corrupt, before);
  }
});

void test('Box preserves a real Harkonnen hand-exchange return decision without resampling the opposing hand', () => {
  let initial = fixture('harkonnen', 3);
  const karama = hold(initial, 'p', 'Karama');
  player(initial, 'q').hand.push(...initial.deck.splice(0, 2));
  initial = applyAction(initial, 'p', {
    type: 'card',
    mode: 'special',
    card: karama,
    target: 'q',
    amount: 1,
  });
  assert.equal(initial.decision?.kind, 'handExchange');
  assert.ok(initial.pendingExchange);
  const { pending } = completed(initial),
    done = recover(pending);
  assert.deepEqual(done.decision, initial.decision);
  assert.deepEqual(done.pendingExchange, reload(initial).pendingExchange);
  assert.deepEqual(done.players, pending.players);
  assert.deepEqual(done.deck, pending.deck);
  const returned = receipt(pending).selected.id;
  const result = applyAction(done, 'p', {
    type: 'decision',
    returnCards: [returned],
  });
  assert.equal(result.pendingExchange, null);
  assert.ok(player(result, 'q').hand.some((c) => c.id === returned));
  assert.equal(result.treacheryDiscardSequence, 1);
  assert.deepEqual(inventory(result), inventory(initial));
});

void test('Box preserves a real paid Ixian ally replacement opportunity and does not repay its auction', () => {
  let initial = fixture('atreides', 3);
  initial.players[1] = newPlayer('q', 'Ixians', 'ixians');
  player(initial, 'q').spice = 10;
  player(initial, 'p').ally = 'q';
  player(initial, 'q').ally = 'p';
  const purchased = initial.deck.shift()!;
  initial.auction = {
    cards: [purchased],
    index: 0,
    bid: 2,
    bidder: 'p',
    active: 'p',
    passed: [],
    opener: 0,
  };
  initial.decision = { kind: 'auctionPayment', player: 'p' };
  initial = applyAction(initial, 'p', { type: 'decision', karama: false });
  assert.equal(initial.decision?.kind, 'ixAllyCard');
  const { pending } = completed(initial),
    done = recover(pending);
  assert.deepEqual(done.decision, initial.decision);
  assert.deepEqual(done.pendingIxAlly, initial.pendingIxAlly);
  assert.deepEqual(done.currentAuctionSale, initial.currentAuctionSale);
  assert.equal(player(done, 'p').spice, 6);
  assert.equal(player(done, 'e').spice, 10);
  const result = applyAction(done, 'p', { type: 'decision', accept: true });
  assert.equal(result.pendingIxAlly, null);
  assert.equal(player(result, 'e').spice, 12);
  assert.ok(result.discard.some((c) => c.id === purchased.id));
  assert.equal(result.resolvedTreacheryDiscardSequence, 2);
  assert.deepEqual(inventory(result), inventory(initial));
});

void test('Box preserves a real Ixian Ambassador card choice, then its own later discard continues once', () => {
  let initial = fixture('ecaz', 5);
  initial.players[1] = newPlayer('q', 'Observer', 'atreides');
  initial.active = 'e';
  initial.movementRemaining = ['e', 'p', 'q'];
  let ambassadors = createAmbassadors(() => 0);
  const chosen = ambassadors.tokens.find((t) => t.effect === 'ixians')!;
  ambassadors.cohort = [
    chosen,
    ...ambassadors.tokens.filter(
      (t) => t.effect !== 'ecaz' && t.id !== chosen.id,
    ),
  ]
    .slice(0, 5)
    .map((t) => t.id);
  for (const token of ambassadors.tokens)
    token.zone =
      token.effect === 'ecaz' || ambassadors.cohort.includes(token.id)
        ? 'supply'
        : 'pool';
  ambassadors = placeAmbassador(ambassadors, chosen.id, {
    turn: 1,
    availableSpice: 20,
    destination: {
      id: 'arrakeen',
      stronghold: true,
      inStorm: false,
      allowed: true,
    },
  }).state;
  initial.ecazAmbassadors = ambassadors;
  initial = applyAction(initial, 'e', {
    type: 'ship',
    amount: 1,
    territory: 'arrakeen',
    sector: 10,
  });
  initial = applyAction(initial, 'p', {
    type: 'decision',
    event: initial.pendingAmbassador!.event,
    trigger: true,
    beneficiary: 'p',
  });
  assert.equal(initial.pendingAmbassador?.stage, 'cards');
  const { pending } = completed(initial),
    done = recover(pending);
  assert.deepEqual(done.pendingAmbassador, reload(initial).pendingAmbassador);
  assert.deepEqual(done.decision, initial.decision);
  assert.deepEqual(done.ecazAmbassadors, initial.ecazAmbassadors);
  const selected = receipt(pending).selected.id;
  const result = applyAction(done, 'p', {
    type: 'decision',
    event: done.pendingAmbassador!.event,
    cards: [selected],
  });
  assert.equal(result.pendingAmbassador, null);
  assert.equal(result.resolvedTreacheryDiscardSequence, 2);
  assert.equal(player(result, 'p').hand.length, 1);
  assert.equal(player(result, 'e').reserves, 19);
  assert.deepEqual(inventory(result), inventory(initial));
});

for (const stage of ['response', 'payment'] as const)
  void test(`Box restores the ${stage} of an Auditor created by an actual completed battle`, () => {
    let initial = fixture('richese', 6);
    initial.players[1] = newPlayer('q', 'CHOAM', 'choam');
    player(initial, 'q').spice = 10;
    player(initial, 'q').leaders.push(createAuditorLeader());
    for (const id of ['p', 'q']) {
      player(initial, id).forces = { 'arrakeen:10': 4 };
      player(initial, id).reserves = 16;
    }
    if (stage === 'response') hold(initial, 'e', 'Karama');
    initial = applyAction(initial, 'p', {
      type: 'chooseBattle',
      territory: 'arrakeen',
      target: 'q',
    });
    for (let i = 0; i < 30; i++) {
      if (initial.response) {
        initial = applyAction(
          initial,
          initial.players.find((p) => !initial.response!.passed.includes(p.id))!
            .id,
          { type: 'passResponse' },
        );
        continue;
      }
      const b = initial.battle!;
      if (b.preLeader && !b.preLeader.closed) {
        const id = [b.attacker, b.defender].find(
          (id) => !b.preLeader!.ready.includes(id),
        )!;
        initial = applyAction(initial, id, {
          type: 'battlePreparationReady',
          event: b.event,
        });
      } else if (b.preparation)
        initial = applyAction(initial, b.preparation.owner, {
          type: 'declineBattlePower',
        });
      else break;
    }
    initial = applyAction(initial, 'p', {
      type: 'battlePlan',
      leader: player(initial, 'p').leaders[0].id,
      dial: 0,
      support: 0,
    });
    initial = applyAction(initial, 'q', {
      type: 'battlePlan',
      leader: CHOAM_AUDITOR_ID,
      dial: 4,
      support: 4,
    });
    initial = applyAction(initial, 'p', { type: 'traitorCall', call: false });
    initial = applyAction(initial, 'q', { type: 'traitorCall', call: false });
    assert.equal(initial.decision?.kind, 'choamAudit');
    initial = applyAction(initial, 'q', {
      type: 'decision',
      event: initial.pendingAuditor!.event,
      audit: true,
    });
    assert.equal(initial.pendingAuditor?.stage, stage);
    const { pending } = completed(initial),
      done = recover(pending);
    assert.deepEqual(done.pendingAuditor, initial.pendingAuditor);
    assert.deepEqual(done.response, initial.response);
    assert.deepEqual(done.decision, initial.decision);
    assert.deepEqual(done.players, pending.players);
    assert.deepEqual(inventory(done), inventory(initial));
    for (const id of ['p', 'q', 'e']) viewGame(pending, id);
    let result = done;
    while (result.response)
      result = applyAction(
        result,
        result.players.find((p) => !result.response!.passed.includes(p.id))!.id,
        { type: 'passResponse' },
      );
    assert.equal(result.decision?.kind, 'choamAuditPayment');
    result = applyAction(result, 'p', {
      type: 'decision',
      event: result.pendingAuditor!.event,
      pay: false,
    });
    assert.equal(result.pendingAuditor, null);
    assert.equal(
      result.auditorInsight?.cards[0].id,
      receipt(pending).selected.id,
    );
    assert.equal(
      result.log.filter((e) => e.automatic?.name === 'Nullentropy Box').length,
      1,
    );
  });
