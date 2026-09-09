import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
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
import { baseDeck } from '../game/cards';
import { createTerrorState, placeTerror } from '../game/moritani-terror';
import { createHomeworldCustody } from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import { quoteGrummanCollectionAction } from '../game/grumman-collection';

const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function entered(victimCard = false) {
  let g = createGame('STACKREVIEW', newPlayer('m', 'Moritani', 'moritani'));
  g.players.push(
    newPlayer('e', 'Entrant', 'emperor'),
    newPlayer('a', 'Observer', 'atreides'),
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
  g.players[1].elites = { reserves: 5, tanks: 0, forces: {}, revived: 0 };
  const initial = createTerrorState(() => 0);
  const robbery = initial.tokens.find((t) => t.kind === 'robbery')!.id;
  const sabotage = initial.tokens.find((t) => t.kind === 'sabotage')!.id;
  g.moritaniTerror = placeTerror(initial, robbery, 'arrakeen', 1);
  g.homeworlds = { custody: createHomeworldCustody(homeworldContext(g)) };
  // Focused phase-five audit setup: the stack itself uses the physical quote;
  // phase-seven creation/once-only award is covered by the collection suites.
  g.moritaniTerror = quoteGrummanCollectionAction(g, 'm', {
    mode: 'add',
    token: sabotage,
    destination: 'arrakeen',
  }).state;
  if (victimCard) g.players[1].hand.push(g.deck.shift()!);
  g = applyAction(g, 'e', {
    type: 'ship',
    territory: 'arrakeen',
    sector: 10,
    amount: 2,
  });
  assert.equal(g.pendingTerrorEntry?.stage, 'select');
  return { g, robbery, sabotage };
}
function rejected(g: Game, action: Action) {
  const before = reload(g);
  assert.throws(() => viewGame(g, 'm'));
  assert.throws(() => normalizeAutomaticGame(g));
  assert.throws(() => applyAction(g, 'm', action));
  assert.deepEqual(g, before);
}

void test('a selected actual stacked entry cannot rewind, delete its selection proof or switch token after JSON recovery', () => {
  const { g: initial, sabotage, robbery } = entered();
  const selected = applyAction(initial, 'm', {
    type: 'decision',
    token: sabotage,
  });
  assert.equal(selected.pendingTerrorEntry?.stage, 'offer');
  assert.equal(selected.pendingTerrorEntry?.token, sabotage);
  assert.deepEqual(normalizeAutomaticGame(reload(selected)), reload(selected));
  assert.equal(viewGame(selected, 'm').terrorEntry?.kind, 'sabotage');
  assert.equal('kind' in viewGame(selected, 'a').terrorEntry!, false);
  assert.equal('candidates' in viewGame(selected, 'a').terrorEntry!, false);
  for (const edit of [
    (g: Game) => {
      g.pendingTerrorEntry!.stage = 'select';
      g.pendingTerrorEntry!.token = g.pendingTerrorEntry!.candidates![0];
      delete g.pendingTerrorEntry!.selectionSignature;
    },
    (g: Game) => {
      delete g.pendingTerrorEntry!.selectionSignature;
    },
    (g: Game) => {
      g.pendingTerrorEntry!.token = robbery;
    },
    (g: Game) => {
      delete g.pendingTerrorEntry!.candidates;
    },
  ]) {
    const g = reload(selected);
    edit(g);
    rejected(g, { type: 'decision', token: robbery });
  }
});

void test('unselected physical stack tokens stay reserved before and after the chosen token is revealed', () => {
  const { g: initial, sabotage, robbery } = entered();
  const selected = applyAction(initial, 'm', {
    type: 'decision',
    token: robbery,
  });
  const revealed = applyAction(reload(selected), 'm', {
    type: 'decision',
    reveal: true,
  });
  assert.equal(revealed.pendingTerrorEntry?.stage, 'robbery');
  assert.equal(
    revealed.moritaniTerror!.tokens.find((t) => t.id === robbery)!.status,
    'removed',
  );
  for (const source of [initial, selected, revealed]) {
    const g = reload(source);
    g.moritaniTerror!.tokens.find((t) => t.id === sabotage)!.location =
      'carthag';
    rejected(g, { type: 'decision', decline: true });
  }
  assert.doesNotThrow(() => viewGame(revealed, 'm'));
});

void test('an actual stacked Sabotage inner-dispatch discard restores its consumed selection while preserving every other token', () => {
  const { g: initial, sabotage, robbery } = entered(true);
  const arrived = applyAction(initial, 'm', {
    type: 'decision',
    token: sabotage,
  });
  const victimCard = arrived.players[1].hand[0].id;
  // Capture the genuine durable batch before the public action wrapper drains
  // it. This verifies saved-continuation restoration, not a claimed HTTP pause.
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
  const pending = reload(
    observed.applyActionInner!(arrived, 'm', {
      type: 'decision',
      reveal: true,
    }),
  );
  const continuation = pending.pendingTreacheryDiscard!.continuation;
  assert.equal(continuation.kind, 'terrorDiscard');
  if (continuation.kind !== 'terrorDiscard')
    throw new Error('Missing actual Terror discard');
  assert.equal(continuation.entry.stage, 'offer');
  assert.equal(continuation.entry.token, sabotage);
  assert.equal(
    pending.moritaniTerror!.tokens.find((t) => t.id === sabotage)!.status,
    'removed',
  );
  assert.doesNotThrow(() => viewGame(pending, 'm'));
  const finished = normalizeAutomaticGame(reload(pending));
  assert.equal(finished.pendingTreacheryDiscard, null);
  assert.equal(finished.pendingTerrorEntry, null);
  assert.equal(
    finished.discard.filter((card) => card.id === victimCard).length,
    1,
  );
  assert.equal(finished.players[1].hand.length, 0);
  assert.equal(
    finished.moritaniTerror!.tokens.find((t) => t.id === robbery)!.location,
    'arrakeen',
  );
  assert.deepEqual(normalizeAutomaticGame(reload(finished)), reload(finished));
  for (const tokenId of [robbery, sabotage]) {
    const corrupted = reload(pending);
    const token = corrupted.moritaniTerror!.tokens.find(
      (t) => t.id === tokenId,
    )!;
    token.status = 'available';
    token.location = null;
    rejected(corrupted, { type: 'advanceBots' });
  }
});
