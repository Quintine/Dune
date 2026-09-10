import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import {
  applyAction,
  normalizeAutomaticGame,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import {
  nexusMoritaniFixture,
  nexusMoritaniToken,
  nexusMoritaniRequest,
  nexusMoritaniAllow,
  nexusMoritaniReload,
  nexusMoritaniArrival,
  holdNexusMoritaniCard,
} from './fixture-nexus-moritani';

function rejectCorruption(g: Game) {
  const before = nexusMoritaniReload(g);
  for (const p of g.players) assert.throws(() => viewGame(g, p.id));
  assert.throws(() => normalizeAutomaticGame(g));
  assert.throws(() => applyAction(g, g.players[0].id, { type: 'advanceBots' }));
  assert.deepEqual(g, before);
}
function placed(kind: 'robbery' | 'sabotage' = 'robbery') {
  const f = nexusMoritaniFixture();
  holdNexusMoritaniCard(f.g, f.target, 'shield');
  const g = nexusMoritaniAllow(
    applyAction(f.g, f.owner, nexusMoritaniRequest(f, kind)),
  );
  return { f, g };
}

void test('completed placement binds its physical face, and ordinary later relocation retires its live Cunning location', () => {
  const { f, g: initial } = placed();
  const swapped = nexusMoritaniReload(initial);
  const first = nexusMoritaniToken(swapped, 'robbery'),
    other = nexusMoritaniToken(swapped, 'sabotage');
  [first.kind, other.kind] = [other.kind, first.kind];
  rejectCorruption(swapped);
  let g = nexusMoritaniArrival(initial, 'red_chasm');
  g = applyAction(g, f.owner, { type: 'decision', decline: true });
  while (g.phase === 5) g = applyAction(g, g.active!, { type: 'endMovement' });
  assert.equal(g.phase, 7);
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.decision?.kind, 'moritaniPlacement');
  const id = nexusMoritaniToken(g, 'robbery').id;
  g = nexusMoritaniAllow(
    applyAction(g, f.owner, {
      type: 'decision',
      token: id,
      territory: 'carthag',
    }),
  );
  assert.equal(nexusMoritaniToken(g, 'robbery').location, 'carthag');
  assert.equal(g.nexusMoritaniLocations?.[id], undefined);
  for (const p of g.players) assert.doesNotThrow(() => viewGame(g, p.id));
  const stale = nexusMoritaniReload(g);
  nexusMoritaniToken(stale, 'robbery').location = 'red_chasm';
  rejectCorruption(stale);
});

void test('a genuine Cunning arrival cannot downgrade to legacy by deleting only its original arrival signature', () => {
  const { g } = placed();
  const arrived = nexusMoritaniArrival(g, 'red_chasm');
  assert.ok(arrived.pendingTerrorEntry?.nexusPlacements);
  assert.equal(arrived.pendingTerrorEntry.candidates, undefined);
  for (const mode of ['signature', 'count', 'both'] as const) {
    const bad = nexusMoritaniReload(arrived);
    delete bad.pendingTerrorEntry!.entrySignature;
    if (mode === 'count') bad.pendingTerrorEntry!.amount = 100;
    if (mode === 'both') delete bad.pendingTerrorEntry!.nexusPlacements;
    rejectCorruption(bad);
  }
});

void test('Truthtrance preserves the original pending Cunning placement and its cancellation response', () => {
  const f = nexusMoritaniFixture();
  const truth = holdNexusMoritaniCard(f.g, f.observer, 'truthtrance');
  let g = applyAction(f.g, f.owner, nexusMoritaniRequest(f));
  const response = structuredClone(g.response),
    history = structuredClone(g.nexusMoritaniHistory);
  g = applyAction(g, f.observer, { type: 'card', card: truth.id });
  while (g.truthtrance?.stage === 'priority')
    g = applyAction(
      g,
      g.players.find((p) => !g.truthtrance!.passed.includes(p.id))!.id,
      { type: 'truthPass' },
    );
  g = applyAction(g, f.observer, {
    type: 'truthAsk',
    question: {
      kind: 'fact',
      target: f.owner,
      fact: { kind: 'hand', name: 'Shield' },
    },
  });
  g = applyAction(nexusMoritaniReload(g), f.owner, {
    type: 'truthAnswer',
    answer: 'no',
  });
  assert.deepEqual(g.response, response);
  assert.deepEqual(g.nexusMoritaniHistory, history);
  g = nexusMoritaniAllow(g);
  assert.equal(nexusMoritaniToken(g, 'robbery').location, 'red_chasm');
  assert.equal(g.discard.filter((c) => c.id === truth.id).length, 1);
});

void test('a live Cunning placement rejects missing parent response, pending marker or changed original supply', () => {
  const f = nexusMoritaniFixture();
  const declared = applyAction(f.g, f.owner, nexusMoritaniRequest(f));
  for (const edit of [
    (g: Game) => {
      g.response = null;
    },
    (g: Game) => {
      delete g.pendingMoritaniPlacement!.nexusEvent;
    },
    (g: Game) => {
      delete g.nexusMoritaniLast;
    },
    (g: Game) => {
      delete g.nexusMoritaniHistory;
    },
    (g: Game) => {
      nexusMoritaniToken(g, 'sabotage').status = 'removed';
    },
  ]) {
    const bad = nexusMoritaniReload(declared);
    edit(bad);
    rejectCorruption(bad);
  }
});

void test('a genuine non-stronghold Sabotage discard retains its original placement proof after revelation and restores exactly once', () => {
  const { f, g } = placed('sabotage');
  const arrived = nexusMoritaniArrival(g, 'red_chasm');
  const originalHandCount = arrived.players.find((p) => p.id === f.target)!.hand
    .length;
  const observed: {
    applyActionInner?: (g: Game, id: string, action: Action) => Game;
  } = {};
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL('../game/engine.ts', import.meta.url), 'utf8') +
        '\nexport { applyActionInner };\n',
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
      crypto,
      structuredClone,
      TextEncoder,
      JSON,
    },
  );
  const pending = nexusMoritaniReload(
    observed.applyActionInner!(arrived, f.owner, {
      type: 'decision',
      reveal: true,
    }),
  );
  const continuation = pending.pendingTreacheryDiscard!.continuation;
  assert.equal(continuation.kind, 'terrorDiscard');
  if (continuation.kind !== 'terrorDiscard')
    throw new Error('Missing genuine Sabotage discard');
  assert.ok(continuation.entry.nexusPlacements);
  assert.equal(nexusMoritaniToken(pending, 'sabotage').status, 'removed');
  for (const p of pending.players)
    assert.doesNotThrow(() => viewGame(pending, p.id));
  const finished = normalizeAutomaticGame(nexusMoritaniReload(pending));
  assert.equal(finished.pendingTreacheryDiscard, null);
  assert.deepEqual(finished.discard, pending.discard);
  assert.equal(finished.discard.length, 1);
  assert.equal(
    finished.players.find((p) => p.id === f.target)!.hand.length,
    originalHandCount - 1,
  );
  assert.deepEqual(
    normalizeAutomaticGame(nexusMoritaniReload(finished)),
    nexusMoritaniReload(finished),
  );
  for (const edit of [
    (bad: Game) => {
      delete bad.nexusMoritaniHistory;
    },
    (bad: Game) => {
      const child = bad.pendingTreacheryDiscard!.continuation;
      if (child.kind === 'terrorDiscard') delete child.entry.nexusPlacements;
    },
    (bad: Game) => {
      const child = bad.pendingTreacheryDiscard!.continuation;
      if (child.kind === 'terrorDiscard')
        child.entry.nexusPlacements![child.entry.token] = 'different-placement';
    },
  ]) {
    const bad = nexusMoritaniReload(pending);
    edit(bad);
    rejectCorruption(bad);
  }
});
