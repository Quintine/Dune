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
import { baseDeck } from '../game/cards';
import { createAuditorLeader } from '../game/choam-auditor';
import type { FactionId } from '../game/catalog';
import { richeseCards } from '../game/richese-cards';

const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
/** Test-only observation of the unchanged production inner dispatcher, before
 * its public wrapper drains automatic continuations. No runtime export or gate
 * is changed, and all resumed actions use the real production exports. */
const observed: {
  applyActionInner?: (g: Game, id: string, a: Action) => Game;
  nullentropyParentSignature?: (
    g: Game,
    resume: NonNullable<Game['pendingNullentropy']>['resume'],
    searchEvent: string,
  ) => string;
} = {};
runInNewContext(
  ts.transpileModule(
    readFileSync(new URL('../game/engine.ts', import.meta.url), 'utf8') +
      '\nexport { applyActionInner, nullentropyParentSignature };\n',
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
type AuditStage = 'payment' | 'response';
/** Explicit resolved-battle fixture, rather than an assertion that this test
 * played a battle: CHOAM's surviving Auditor faced Richese at Arrakeen, used no
 * opposing Treachery cards, and has reached the recorded response/payment stage.
 * The Box activation, paid search, chosen transfer and discard frame are real. */
function auditorFixture(stage: AuditStage) {
  const g = fixture('richese', 6);
  const choam = newPlayer('q', 'CHOAM Auditor owner', 'choam');
  choam.leaders.push(createAuditorLeader());
  choam.leaders.find((l) => l.name === 'Auditor')!.usedAt = 'arrakeen';
  choam.spice = 10;
  g.players[1] = choam;
  const event = `auditor-box-${stage}`;
  g.lastBattle = ['q', 'p'];
  g.lastBattleContext = {
    event,
    turn: g.turn,
    territory: 'arrakeen',
    combatants: ['q', 'p'],
    winner: 'q',
    result: 'normal',
  };
  g.pendingAuditor = {
    event,
    owner: 'q',
    opponent: 'p',
    territory: 'arrakeen',
    turn: g.turn,
    survived: true,
    usedCards: [],
    stage,
  };
  if (stage === 'payment')
    g.decision = { kind: 'choamAuditPayment', player: 'p', event };
  else {
    g.response = { kind: 'choamAudit', owner: 'q', intent: event, passed: [] };
    // Keep the actual cancellation window open after automatic Box recovery.
    hold(g, 'e', 'Karama');
  }
  return g;
}

/** Rebuild the receipt with the production serializer so these cases exercise
 * authoritative Auditor semantics, rather than only stale-signature rejection. */
function signParent(g: Game) {
  const c = receipt(g);
  c.parentSignature = observed.nullentropyParentSignature!(
    g,
    c.resume,
    c.searchEvent,
  );
}
function rejectedParent(g: Game) {
  signParent(g);
  const before = structuredClone(g);
  for (const seat of g.players)
    assert.throws(
      () => viewGame(g, seat.id),
      /Auditor|battle|stale|continuation/i,
    );
  assert.throws(
    () => normalizeAutomaticGame(g),
    /Auditor|battle|stale|continuation/i,
  );
  assert.throws(
    () => applyAction(g, 'p', { type: 'advanceBots' }),
    /Auditor|battle|stale|continuation/i,
  );
  assert.deepEqual(g, before);
}
for (const stage of ['payment', 'response'] as const) {
  void test(`Box ${stage} parent rejects semantically invalid Auditor controls even with a recomputed receipt`, () => {
    const initial = auditorFixture(stage);
    const { pending } = completed(initial);
    const ids = inventory(pending);
    // Establish that the explicitly constructed parent is valid and visible
    // without disclosing the recovered card to the Auditor or observer.
    const selected = receipt(pending).selected.id;
    for (const seat of pending.players) {
      const view = viewGame(pending, seat.id);
      assert.equal(view.auditor?.event, initial.pendingAuditor!.event);
      assert.equal(view.auditorInsight, null);
      assert.equal(Object.hasOwn(view, 'pendingTreacheryDiscard'), false);
      if (seat.id !== 'p')
        assert.equal(JSON.stringify(view).includes(selected), false);
    }
    const done = normalizeAutomaticGame(reload(pending));
    assert.deepEqual(done.decision, initial.decision);
    assert.deepEqual(done.response, initial.response);
    assert.deepEqual(done.pendingAuditor, initial.pendingAuditor);
    assert.deepEqual(done.discard, pending.discard);
    assert.deepEqual(inventory(done), ids);
    assert.equal(player(done, 'p').spice, 8);
    assert.equal(player(done, 'q').spice, 10);
    const changes: ((g: Game) => void)[] = [
      (g) => {
        g.pendingAuditor!.turn--;
      },
      (g) => {
        g.lastBattle = ['q', 'e'];
      },
      (g) => {
        player(g, 'q').faction = 'guild';
      },
      (g) => {
        g.pendingAuditor!.stage = 'offer';
      },
      (g) => {
        const resume = receipt(g).resume;
        if (resume.decision?.kind === 'choamAuditPayment')
          resume.decision.event = 'other-payment';
        else if (resume.response) resume.response.intent = 'other-response';
      },
      (g) => {
        const resume = receipt(g).resume;
        if (resume.decision?.kind === 'choamAuditPayment')
          resume.decision.player = 'q';
        else if (resume.response) resume.response.owner = 'p';
      },
    ];
    for (const change of changes) {
      const bad = reload(pending);
      change(bad);
      rejectedParent(bad);
    }
  });
}
void test('Box Auditor continuation remains bound to its recorded battle even after coordinated receipt edits', () => {
  for (const stage of ['payment', 'response'] as const) {
    const { pending } = completed(auditorFixture(stage));
    for (const change of [
      (g: Game) => {
        g.pendingAuditor!.event = 'forged-audit-event';
        const resume = receipt(g).resume;
        if (resume.decision?.kind === 'choamAuditPayment')
          resume.decision.event = 'forged-audit-event';
        else if (resume.response) resume.response.intent = 'forged-audit-event';
      },
      (g: Game) => {
        g.pendingAuditor!.territory = 'carthag';
      },
      (g: Game) => {
        g.lastBattleContext!.turn--;
      },
      (g: Game) => {
        g.lastBattleContext!.combatants.reverse();
      },
    ]) {
      const bad = reload(pending);
      change(bad);
      rejectedParent(bad);
    }
  }
});

void test('legacy Auditor parents without a battle-context receipt still restore through Box', () => {
  for (const stage of ['payment', 'response'] as const) {
    const initial = auditorFixture(stage);
    delete initial.lastBattleContext;
    const { pending } = completed(initial);
    const done = normalizeAutomaticGame(reload(pending));
    assert.equal(done.lastBattleContext, undefined);
    assert.deepEqual(done.pendingAuditor, initial.pendingAuditor);
    assert.deepEqual(done.decision, initial.decision);
    assert.deepEqual(done.response, initial.response);
    assert.equal(player(done, 'p').spice, 8);
    assert.equal(player(done, 'q').spice, 10);
  }
});
