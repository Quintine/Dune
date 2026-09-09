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
  initializeHomeworldGameForAudit,
  joinGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { territory, location } from '../game/board';
import { homeworldGameIntegrity } from '../game/homeworld-game';
import type { ShipmentPromise } from '../game/shipment-promises';

const emperor = (g: Game) => g.players.find((p) => p.id === 'e')!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));

// Genuine base setup, including physical dealing and traitor selection. Only
// phase/opportunity positioning below is staged; counters/cards are never minted.
function fixture(advanced = true) {
  let g = createGame(
    'HOMEWORLDACTIONS',
    newPlayer('e', 'Emperor', 'emperor'),
    advanced,
  );
  joinGame(g, newPlayer('a', 'Atreides', 'atreides'));
  g = applyAction(g, 'e', { type: 'homeworlds', enabled: true });
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  g = initializeHomeworldGameForAudit(g);
  while (g.setupStage === 'traitors') {
    const p = g.players.find((seat) => seat.traitorChoices.length)!;
    g = applyAction(g, p.id, { type: 'traitor', leader: p.traitorChoices[0] });
  }
  assert.equal(g.status, 'playing');
  return movement(g);
}
function movement(g: Game) {
  g.phase = 5;
  g.phaseOpening = null;
  g.response = null;
  g.decision = null;
  g.active = 'e';
  g.movementRemaining = ['e', 'a'];
  g.ready = [];
  for (const p of g.players) {
    p.shipped = false;
    p.moved = 0;
  }
  homeworldGameIntegrity(g);
  return g;
}
function action(
  g: Game,
  origin = 'homeworld:emperor',
  normal = 2,
  elite = 0,
): Action {
  return {
    type: 'emperorHomeworldMove',
    event: viewGame(g, 'e').homeworldMove!.event,
    origin,
    normal,
    elite,
  };
}
function rejects(g: Game, actor: string, command: Action, pattern?: RegExp) {
  const before = structuredClone(g);
  if (pattern) assert.throws(() => applyAction(g, actor, command), pattern);
  else assert.throws(() => applyAction(g, actor, command));
  assert.deepEqual(g, before);
}
function assertPrivate(g: Game) {
  for (const p of g.players) {
    const view = viewGame(reload(g), p.id);
    for (const other of view.players.filter((seat) => seat.id !== p.id)) {
      assert.equal(other.hand, undefined);
      assert.equal(other.traitors, undefined);
    }
    if (p.id !== 'e') assert.equal(view.homeworldMove, null);
  }
}
function hold(g: Game, effect: string, player = 'e') {
  const p = g.players.find((seat) => seat.id === player)!;
  const already = p.hand.find((card) => card.effect === effect);
  if (already) return already;
  const source = [
    g.deck,
    ...g.players.filter((seat) => seat !== p).map((seat) => seat.hand),
  ].find((cards) => cards.some((card) => card.effect === effect));
  assert.ok(source, `Physical ${effect} card exists in the dealt game.`);
  const index = source.findIndex((card) => card.effect === effect);
  // The genuine shuffle may deal the desired card to the other player. Swap
  // custody with one of our dealt cards, preserving the deck and hand sizes.
  const [card] = source.splice(index, 1, ...p.hand.splice(0, 1));
  p.hand.push(card);
  return card;
}
function ship(g: Game, extras: Record<string, unknown> = {}): Action {
  return {
    type: 'ship',
    territory: 'false_wall_west',
    sector: territory('false_wall_west').sectors[0],
    amount: 1,
    elite: 0,
    ...extras,
  };
}

void test('held-card fixtures recover a unique card dealt to the opponent without changing physical inventory', () => {
  for (const effect of ['hajr', 'ghola']) {
    const g = fixture();
    const inventory = () =>
      [...g.deck, ...g.players.flatMap((p) => p.hand), ...g.discard].sort(
        (a, b) => a.id.localeCompare(b.id),
      );
    const before = structuredClone(inventory());
    const handSizes = g.players.map((p) => p.hand.length);
    const deckSize = g.deck.length;
    const card = hold(g, effect, 'a');
    assert.equal(
      emperor(g).hand.some((held) => held.id === card.id),
      false,
    );
    assert.equal(hold(g, effect).id, card.id);
    assert.equal(hold(g, effect).id, card.id);
    assert.deepEqual(inventory(), before);
    assert.deepEqual(
      g.players.map((p) => p.hand.length),
      handSizes,
    );
    assert.equal(g.deck.length, deckSize);
    homeworldGameIntegrity(g);
  }
});

void test('actual Emperor transfer preserves native totals, spends one move, seals private cards and rejects a replay after JSON', () => {
  const g = fixture();
  const before = structuredClone(g);
  const command = action(g);
  const next = applyAction(g, 'e', command);
  assert.deepEqual(g, before);
  assert.deepEqual(next.homeworlds!.custody!.salusa, { normal: 2, elite: 5 });
  assert.equal(emperor(next).reserves, emperor(g).reserves);
  assert.deepEqual(emperor(next).elites, emperor(g).elites);
  assert.equal(emperor(next).spice, emperor(g).spice);
  assert.equal(emperor(next).moved, 1);
  assert.equal(emperor(next).shipped, true);
  assert.deepEqual(next.movementRemaining, g.movementRemaining);
  assert.equal(next.active, 'e');
  assert.deepEqual(next.deck, g.deck);
  assert.deepEqual(
    next.players.map((p) => p.hand),
    g.players.map((p) => p.hand),
  );
  homeworldGameIntegrity(next);
  assertPrivate(next);
  rejects(reload(next), 'e', command);
  rejects(g, 'a', command);
  rejects(g, 'e', { ...command, event: 'stale' }, /stale/);
  rejects(g, 'e', { ...command, amount: 2 });
});

void test('a real Hajr grants a second transfer with a fresh event; no extra transfer or Basic transfer is admitted', () => {
  let g = fixture();
  const hajr = hold(g, 'hajr');
  g = applyAction(g, 'e', { type: 'card', card: hajr.id });
  assert.ok(g.hajr.includes('e'));
  const first = action(g);
  g = applyAction(g, 'e', first);
  assert.equal(viewGame(g, 'e').homeworldMove!.remaining, 1);
  rejects(g, 'e', first, /stale/);
  const second = action(g, 'homeworld:emperor:salusa', 1, 2);
  g = applyAction(reload(g), 'e', second);
  assert.deepEqual(g.homeworlds!.custody!.salusa, { normal: 1, elite: 3 });
  assert.equal(emperor(g).moved, 2);
  assert.equal(g.discard.filter((card) => card.id === hajr.id).length, 1);
  rejects(g, 'e', action(g));
  homeworldGameIntegrity(g);
  const basic = fixture(false);
  assert.equal(viewGame(basic, 'e').homeworldMove, null);
  rejects(basic, 'e', { ...first, event: 'basic' });
});

void test('blocking control and stale physical-source mutations cannot spend the Homeworld movement', () => {
  const base = fixture();
  const command = action(base);
  for (const mutate of [
    (g: Game) => {
      g.phaseOpening = { passed: [], initialize: false };
    },
    (g: Game) => {
      g.phase = 4;
    },
    (g: Game) => {
      g.active = 'a';
    },
    (g: Game) => {
      g.homeworlds!.custody!.salusa!.normal = 1;
    },
  ]) {
    const g = reload(base);
    mutate(g);
    rejects(g, 'e', command);
  }
  // A genuine pending phase-opening interaction is visible as a blocked move.
  const blocked = reload(base);
  blocked.phaseOpening = { passed: [], initialize: false };
  assert.match(
    viewGame(blocked, 'e').homeworldMove!.blocked!,
    /current interaction/,
  );
});

void test('a later ordinary shipment requires exact dual-Homeworld sources, debits only those physical counters and cannot repeat', () => {
  let g = fixture();
  g = applyAction(g, 'e', action(g));
  // Position the next unused turn, retaining the actual preceding transfer.
  g = movement(reload(g));
  g.turn++;
  const before = structuredClone(g);
  rejects(g, 'e', ship(g), /Choose.*Homeworld/);
  for (const homeworldSources of [
    { 'homeworld:emperor:salusa': { normal: 2, elite: 0 } },
    { 'homeworld:atreides': { normal: 1, elite: 0 } },
    { 'homeworld:emperor:salusa': { normal: 0, elite: 1 } },
  ])
    rejects(g, 'e', ship(g, { homeworldSources }));
  const command = ship(g, {
    homeworldSources: { 'homeworld:emperor:salusa': { normal: 1, elite: 0 } },
  });
  g = applyAction(g, 'e', command);
  assert.equal(emperor(g).reserves, emperor(before).reserves - 1);
  assert.equal(emperor(g).spice, emperor(before).spice - 2);
  assert.deepEqual(g.homeworlds!.custody!.salusa, { normal: 1, elite: 5 });
  const key = location(
    'false_wall_west',
    territory('false_wall_west').sectors[0],
  );
  assert.equal(emperor(g).forces[key], 1);
  assert.equal(emperor(g).moved, 0);
  homeworldGameIntegrity(g);
  assertPrivate(g);
  rejects(reload(g), 'e', command);
});

function stormKilledTransferredSardaukar() {
  let g = fixture();
  g = applyAction(g, 'e', action(g, 'homeworld:emperor:salusa', 0, 1));
  assert.equal(g.homeworlds!.custody!.salusa!.elite, 4);
  g = movement(reload(g));
  g = applyAction(
    g,
    'e',
    ship(g, {
      territory: 'the_great_flat',
      sector: 15,
      elite: 1,
      homeworldSources: { 'homeworld:emperor': { normal: 0, elite: 1 } },
    }),
  );
  assert.equal(g.homeworlds!.custody!.salusa!.elite, 4);
  const sector = 15;
  // Stage only the next Storm opportunity; both casualties and the subsequent
  // revival are produced by actual dispatcher actions.
  g.phase = 0;
  g.active = null;
  g.storm = sector - 1;
  g.stormDialers = ['e', 'a'];
  g.stormDials = {};
  g.stormPending = null;
  g.ready = [];
  g = applyAction(g, 'e', { type: 'stormDial', amount: 1 });
  g = applyAction(g, 'a', { type: 'stormDial', amount: 0 });
  for (const id of ['e', 'a']) g = applyAction(g, id, { type: 'ready' });
  assert.equal(emperor(g).tanks, 1);
  assert.equal(emperor(g).elites!.tanks, 1);
  assert.equal(g.homeworlds!.custody!.salusa!.elite, 4);
  g.phase = 4;
  g.phaseOpening = null;
  g.ready = [];
  return g;
}

void test('a Sardaukar transferred to Kaitain, shipped, and killed by actual storm dials revives on Salusa exactly once', () => {
  let g = stormKilledTransferredSardaukar();
  const before = structuredClone(g);
  g = applyAction(reload(g), 'e', { type: 'revive', amount: 1, elite: 1 });
  assert.equal(emperor(g).tanks, 0);
  assert.equal(emperor(g).elites!.tanks, 0);
  assert.equal(emperor(g).elites!.revived, 1);
  assert.equal(emperor(g).reserves, emperor(before).reserves + 1);
  assert.equal(
    emperor(g).elites!.reserves,
    emperor(before).elites!.reserves + 1,
  );
  assert.equal(g.homeworlds!.custody!.salusa!.elite, 5);
  assert.equal(emperor(g).revived, 1);
  homeworldGameIntegrity(g);
  assertPrivate(g);
  rejects(reload(g), 'e', { type: 'revive', amount: 1, elite: 1 });
});

// Observe the real production dispatcher at its existing saved-frame boundary.
// No production export or mutation is introduced for these recovery assertions.
let privateEngine:
  | {
      applyActionInner: typeof applyAction;
      findShipmentCompletion: (
        g: Game,
        p: Game['players'][number],
        promises: ShipmentPromise[],
      ) => { actions: Action[] } | null;
    }
  | undefined;
function observedEngine() {
  if (!privateEngine) {
    const exports = {};
    runInNewContext(
      ts.transpileModule(
        readFileSync(new URL('../game/engine.ts', import.meta.url), 'utf8') +
          '\nexport { applyActionInner, findShipmentCompletion };\n',
        {
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
          },
        },
      ).outputText,
      {
        exports,
        require: createRequire(new URL('../game/engine.ts', import.meta.url)),
        structuredClone,
        JSON,
        TextEncoder,
        crypto: webcrypto,
      },
    );
    privateEngine = exports as NonNullable<typeof privateEngine>;
  }
  return privateEngine;
}

void test('actual Ghola retirement binds Homeworld allocation, restores JSON once, and rejects a same-total Salusa rewrite', () => {
  const g = stormKilledTransferredSardaukar();
  const ghola = hold(g, 'ghola');
  const command: Action = { type: 'card', card: ghola.id, amount: 1, elite: 1 };
  const before = structuredClone(g);
  const frame = reload(observedEngine().applyActionInner(g, 'e', command));
  assert.deepEqual(g, before);
  assert.equal(
    frame.pendingTreacheryDiscard?.continuation.kind,
    'ordinaryCardDiscard',
  );
  const receipt = frame.pendingTreacheryDiscard!.continuation;
  assert.equal(
    receipt.kind === 'ordinaryCardDiscard' && receipt.effect,
    'ghola',
  );
  assert.equal(emperor(frame).tanks, 0);
  assert.equal(emperor(frame).elites!.tanks, 0);
  assert.equal(emperor(frame).elites!.revived, 1);
  assert.equal(frame.homeworlds!.custody!.salusa!.elite, 5);
  assert.equal(frame.discard.filter((c) => c.id === ghola.id).length, 1);
  const paused = structuredClone(frame);
  for (const id of ['e', 'a']) {
    const view = viewGame(reload(frame), id);
    assert.equal(view.automaticContinuationPending, true);
    assert.equal('pendingTreacheryDiscard' in view, false);
    assert.equal(view.shipmentCompletion, null);
  }
  assert.deepEqual(frame, paused);
  const done = normalizeAutomaticGame(reload(frame));
  assert.equal(done.pendingTreacheryDiscard, null);
  assert.deepEqual(done.homeworlds, frame.homeworlds);
  assert.deepEqual(done.players, frame.players);
  assert.deepEqual(done.log, frame.log);
  assert.deepEqual(done.deck, frame.deck);
  assert.deepEqual(done.discard, frame.discard);
  assert.deepEqual(reload(normalizeAutomaticGame(reload(done))), reload(done));
  assert.deepEqual(reload(applyAction(g, 'e', command)), reload(done));
  rejects(done, 'e', command);
  const corrupt = reload(frame);
  // A physically valid inter-world reassignment preserves every aggregate count
  // but contradicts the already committed Ghola receipt.
  corrupt.homeworlds!.custody!.salusa!.elite--;
  homeworldGameIntegrity(corrupt);
  assert.deepEqual(corrupt.players, frame.players);
  const corruptBefore = structuredClone(corrupt);
  assert.throws(() => viewGame(corrupt, 'e'));
  assert.throws(() => normalizeAutomaticGame(corrupt));
  rejects(corrupt, 'e', { type: 'ready' });
  assert.deepEqual(corrupt, corruptBefore);
});

void test('shipment completion emits an executable mixed-Homeworld source witness without enabling Advanced Truthtrance promises', () => {
  let g = fixture();
  g = applyAction(g, 'e', action(g, 'homeworld:emperor', 14, 0));
  g = movement(reload(g));
  const promises: ShipmentPromise[] = [
    {
      turn: g.turn,
      player: 'e',
      asker: 'a',
      territory: 'carthag',
      minimum: 2,
      answer: true,
    },
  ];
  const before = structuredClone(g);
  const proof = observedEngine().findShipmentCompletion(
    g,
    emperor(g),
    promises,
  );
  assert.ok(proof);
  assert.deepEqual(
    observedEngine().findShipmentCompletion(reload(g), emperor(g), promises),
    proof,
  );
  assert.deepEqual(g, before);
  assert.equal(proof.actions.length, 1);
  assert.deepEqual(proof.actions[0].homeworldSources, {
    'homeworld:emperor': { normal: 1, elite: 0 },
    'homeworld:emperor:salusa': { normal: 1, elite: 0 },
  });
  const moved = applyAction(g, 'e', proof.actions[0]);
  assert.equal(emperor(moved).reserves, emperor(g).reserves - 2);
  assert.equal(moved.homeworlds!.custody!.salusa!.normal, 13);
  homeworldGameIntegrity(moved);
  // The witness is private-helper readiness only. The real declaration keeps
  // its deliberate Basic-only promise gate; no synthetic live promise is saved.
  const card = hold(g, 'truthtrance', 'a');
  g = applyAction(g, 'a', { type: 'card', card: card.id });
  g = applyAction(g, 'e', { type: 'truthPass' });
  rejects(
    g,
    'a',
    {
      type: 'truthAsk',
      question: {
        kind: 'shipment',
        target: 'e',
        territory: 'carthag',
        minimum: 2,
      },
    },
    /Basic/,
  );
});
