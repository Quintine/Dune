import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { baseDeck, leaders, createAuditorLeader } from '../game/cards';
import { createTechTokens } from '../game/tech-tokens';
import {
  quoteBattleAftermath,
  BattleAftermathQuoteError,
  type BattleAftermathInput,
} from '../game/battle-aftermath-quote';
import { applyAction, createGame, newPlayer, type Game } from '../game/engine';
function fixture(): BattleAftermathInput {
  const cards = baseDeck(),
    held = (kind: string) => cards.find((c) => c.kind === kind)!;
  const players = [
    {
      id: 'a',
      faction: 'harkonnen' as const,
      hand: [held('worthless')],
      leaders: leaders('harkonnen'),
    },
    {
      id: 'd',
      faction: 'choam' as const,
      hand: [held('shield'), held('snooper')],
      leaders: [...leaders('choam'), createAuditorLeader()],
    },
    {
      id: 'm',
      faction: 'moritani' as const,
      hand: [],
      leaders: leaders('moritani'),
    },
    {
      id: 't',
      faction: 'tleilaxu' as const,
      hand: [],
      leaders: leaders('tleilaxu'),
    },
  ];
  const techTokens = createTechTokens();
  techTokens.axlotl.owner = 'd';
  return {
    status: 'playing',
    phase: 6,
    turn: 2,
    advanced: true,
    battlePresent: false,
    lastBattle: ['a', 'd'],
    territoryIds: ['arrakeen', 'carthag'],
    context: {
      event: 'resolved',
      turn: 2,
      territory: 'arrakeen',
      combatants: ['a', 'd'],
      winner: 'a',
      result: 'normal',
    },
    players,
    leaderIds: players.flatMap((p) => p.leaders.map((l) => l.id)),
    physicalCards: cards,
    techTokens,
    pending: {
      retention: {
        owner: 'm',
        player: 'd',
        turn: 2,
        territory: 'arrakeen',
        stage: 'choose',
        played: players[1].hand.map((c) => c.id),
        eligible: players[1].hand.map((c) => c.id),
      },
      income: { owner: 'd', amount: 1 },
      tech: { player: 'a', loser: 'd', choices: ['axlotl'] },
      capture: { player: 'a', loser: 'd', territory: 'arrakeen' },
      auditor: {
        owner: 'd',
        opponent: 'a',
        territory: 'arrakeen',
        event: 'resolved',
        turn: 2,
        stage: 'offer',
        survived: true,
        usedCards: [],
      },
      faceDance: {
        player: 't',
        winner: 'a',
        territory: 'arrakeen',
        leader: players[0].leaders[0].id,
        identity: players[0].leaders[0].id,
      },
    },
  };
}
function withoutBefore(
  g: BattleAftermathInput,
  slot: keyof BattleAftermathInput['pending'],
) {
  for (const key of [
    'retention',
    'income',
    'tech',
    'capture',
    'auditor',
    'faceDance',
  ] as const) {
    if (key === slot) break;
    delete g.pending[key];
  }
  return g;
}
function reject(g: BattleAftermathInput, pattern?: RegExp) {
  const before = structuredClone(g);
  assert.throws(
    () => quoteBattleAftermath(g),
    pattern ?? BattleAftermathQuoteError,
  );
  assert.deepEqual(g, before);
}
void test('the existing aftermath priority stops at each next real decision without inspecting later choices', () => {
  for (const [slot, expected] of [
    ['retention', 'moritaniRetention'],
    ['income', 'choamBattleIncome'],
    ['tech', 'techToken'],
    ['capture', 'captureOffer'],
    ['auditor', 'choamAudit'],
    ['faceDance', 'faceDance'],
  ] as const) {
    const g = withoutBefore(fixture(), slot);
    if (slot === 'tech') {
      g.techTokens!.production.owner = 'd';
      g.pending.tech = {
        player: 'a',
        loser: 'd',
        choices: ['axlotl', 'production'],
      };
    }
    const before = structuredClone(g),
      q = quoteBattleAftermath(g);
    assert.equal(q.next.kind, expected);
    assert.deepEqual(q.steps, []);
    assert.deepEqual(g, before);
    if (slot !== 'faceDance') {
      g.pending.faceDance = { invalidFutureChoice: true };
      assert.equal(quoteBattleAftermath(g).next.kind, expected);
    }
  }
});
void test('one token transfers automatically before capture; multiple tokens require a real choice and preserve their order', () => {
  const g = withoutBefore(fixture(), 'tech'),
    before = structuredClone(g);
  assert.deepEqual(quoteBattleAftermath(g).steps, [
    { kind: 'transferTech', id: 'axlotl', from: 'd', to: 'a' },
  ]);
  assert.equal(quoteBattleAftermath(g).next.kind, 'captureOffer');
  assert.deepEqual(g, before);
  g.techTokens!.production.owner = 'd';
  g.pending.tech = {
    player: 'a',
    loser: 'd',
    choices: ['production', 'axlotl'],
  };
  const q = quoteBattleAftermath(g);
  assert.deepEqual(q.steps, []);
  assert.deepEqual(q.next, {
    kind: 'techToken',
    player: 'a',
    loser: 'd',
    choices: ['production', 'axlotl'],
  });
});
void test('empty Auditor clearing follows a sole token transfer and stops at Face Dance without sampling', () => {
  const g = withoutBefore(fixture(), 'tech');
  delete g.pending.capture;
  (g.pending.auditor as { usedCards: string[] }).usedCards =
    g.players[0].hand.map((c) => c.id);
  const before = structuredClone(g),
    q = quoteBattleAftermath(g);
  assert.deepEqual(q.steps, [
    { kind: 'transferTech', id: 'axlotl', from: 'd', to: 'a' },
    { kind: 'emptyAuditor', event: 'resolved' },
  ]);
  assert.equal(q.next.kind, 'faceDance');
  assert.deepEqual(g, before);
  delete g.pending.faceDance;
  assert.equal(quoteBattleAftermath(g).next.kind, 'board');
});
void test('legacy saves bind only available facts, including technology without territory and mutual-death audit without winner', () => {
  const empty = fixture();
  delete empty.context;
  empty.pending = {};
  assert.deepEqual(quoteBattleAftermath(empty), {
    context: { kind: 'legacy', turn: 2, combatants: ['a', 'd'] },
    steps: [],
    next: { kind: 'board' },
  });
  const tech = withoutBefore(fixture(), 'tech');
  delete tech.context;
  delete tech.pending.capture;
  delete tech.pending.auditor;
  delete tech.pending.faceDance;
  assert.deepEqual(quoteBattleAftermath(tech).context, {
    kind: 'legacy',
    turn: 2,
    combatants: ['a', 'd'],
    winner: 'a',
  });
  const audit = withoutBefore(fixture(), 'auditor');
  delete audit.context;
  delete audit.pending.faceDance;
  audit.legacy = { winner: null };
  assert.deepEqual(quoteBattleAftermath(audit).context, {
    kind: 'legacy',
    turn: 2,
    combatants: ['a', 'd'],
    winner: null,
    territory: 'arrakeen',
  });
  assert.equal(quoteBattleAftermath(audit).next.kind, 'choamAudit');
  const retained = fixture();
  delete retained.context;
  assert.deepEqual(quoteBattleAftermath(retained).context, {
    kind: 'legacy',
    turn: 2,
    combatants: ['a', 'd'],
    winner: 'a',
    territory: 'arrakeen',
  });
});
void test('modern receipts bind turn, territory, ordered combatants, winner and semantic result', () => {
  for (const mutate of [
    (g: BattleAftermathInput) => {
      g.turn++;
    },
    (g: BattleAftermathInput) => {
      g.phase = 5;
    },
    (g: BattleAftermathInput) => {
      g.battlePresent = true;
    },
    (g: BattleAftermathInput) => {
      g.lastBattle = ['d', 'a'];
    },
    (g: BattleAftermathInput) => {
      (g.context as Record<string, unknown>).winner = 'd';
    },
    (g: BattleAftermathInput) => {
      (g.context as Record<string, unknown>).territory = 'carthag';
    },
    (g: BattleAftermathInput) => {
      (g.context as Record<string, unknown>).result = 'explosion';
    },
    (g: BattleAftermathInput) => {
      (g.context as Record<string, unknown>).event = '';
    },
  ]) {
    const g = fixture();
    mutate(g);
    reject(g);
  }
  for (const context of [false, [], {}, 'invalid']) {
    const g = fixture();
    g.context = context;
    reject(g);
  }
});
void test('Moritani receipt validates exact owner, loser, stage and unique physically held played/eligible cards', () => {
  const mutations = [
    { owner: 'a' },
    { player: 'a' },
    { turn: 1 },
    { stage: 'response' },
    { played: [] },
    { eligible: ['missing'] },
    { played: ['x', 'x'] },
  ];
  for (const mutation of mutations) {
    const g = fixture();
    Object.assign(g.pending.retention as object, mutation);
    reject(g);
  }
  const missing = fixture();
  missing.players[1].hand = [];
  reject(missing, /custody/);
  const duplicate = fixture();
  duplicate.physicalCards = [
    ...duplicate.physicalCards,
    duplicate.players[1].hand[0],
  ];
  reject(duplicate, /custody/);
});
void test('technology rejects empty, duplicated, foreign or transferred tokens before any automatic step', () => {
  for (const choices of [
    [],
    ['axlotl', 'axlotl'],
    ['missing'],
    ['production'],
  ]) {
    const g = withoutBefore(fixture(), 'tech');
    g.pending.tech = { player: 'a', loser: 'd', choices };
    reject(g);
  }
  const moved = withoutBefore(fixture(), 'tech');
  moved.techTokens!.axlotl.owner = 'a';
  reject(moved);
  const omitted = withoutBefore(fixture(), 'tech');
  omitted.techTokens!.production.owner = 'd';
  reject(omitted);
  const missing = withoutBefore(fixture(), 'tech');
  missing.techTokens = null;
  reject(missing);
  const invalid = withoutBefore(fixture(), 'tech');
  invalid.techTokens!.axlotl.spice = Number.NaN;
  reject(invalid);
});
void test('canceled income quotes zero payment and then its sole technology transfer before capture', () => {
  const g = withoutBefore(fixture(), 'income');
  g.cancel = { kind: 'choamBattleIncome', owner: 'd' };
  const before = structuredClone(g),
    q = quoteBattleAftermath(g);
  assert.deepEqual(q.steps, [
    { kind: 'cancel', slot: 'income' },
    { kind: 'transferTech', id: 'axlotl', from: 'd', to: 'a' },
  ]);
  assert.equal(q.next.kind, 'captureOffer');
  assert.deepEqual(g, before);
  g.cancel.owner = 'a';
  reject(g, /owner/);
});
void test('canceled capture does not demand a random candidate and progresses to the actual current audit count', () => {
  const g = withoutBefore(fixture(), 'capture');
  g.cancel = { kind: 'capture', owner: 'a' };
  // No capturable foreign leader is needed to skip the random capture branch.
  g.players[1].leaders = [createAuditorLeader()];
  const q = quoteBattleAftermath(g);
  assert.deepEqual(q.steps, [{ kind: 'cancel', slot: 'capture' }]);
  assert.deepEqual(q.next, {
    kind: 'choamAudit',
    player: 'd',
    event: 'resolved',
    count: 1,
  });
});
void test('canceled Auditor requires its response identity and validates hand candidates without charging or inspecting', () => {
  const g = withoutBefore(fixture(), 'auditor');
  Object.assign(g.pending.auditor as object, { stage: 'response' });
  g.cancel = { kind: 'choamAudit', owner: 'd', intent: 'resolved' };
  const before = structuredClone(g),
    q = quoteBattleAftermath(g);
  assert.deepEqual(q.steps, [{ kind: 'cancel', slot: 'auditor' }]);
  assert.equal(q.next.kind, 'faceDance');
  assert.deepEqual(g, before);
  g.cancel.intent = 'other';
  reject(g, /stale/);
  g.cancel.intent = 'resolved';
  g.players[0].hand = [...g.players[0].hand, ...g.players[0].hand];
  reject(g, /unique physical cards/);
});
void test('impossible earlier obligations cannot be skipped by a currently canceled aftermath response', () => {
  for (const cancel of [
    { kind: 'capture', owner: 'a' },
    { kind: 'choamBattleIncome', owner: 'd' },
    { kind: 'choamAudit', owner: 'd', intent: 'resolved' },
  ] as const) {
    const g = fixture();
    g.cancel = cancel;
    reject(g, /preceding|earlier/);
  }
  const g = withoutBefore(fixture(), 'auditor');
  g.cancel = { kind: 'choamAudit', owner: 'd', intent: 'resolved' };
  reject(g, /stage/);
});
void test('Face Dance retains the winning disc identity after custody changes, and accepts a null or physical hero identity only correctly', () => {
  const g = withoutBefore(fixture(), 'faceDance');
  const captured = g.players[0].leaders[0].id;
  g.players[0].leaders = []; // Actual native/shared registry independently retains its ID.
  assert.equal(quoteBattleAftermath(g).next.kind, 'faceDance');
  g.pending.faceDance = {
    player: 't',
    winner: 'a',
    leader: null,
    identity: null,
    territory: 'arrakeen',
  };
  assert.equal(quoteBattleAftermath(g).next.kind, 'faceDance');
  const hero = baseDeck().find((c) => c.kind === 'hero')!;
  Object.assign(g.pending.faceDance as object, {
    leader: hero.id,
    identity: 'cheap-hero-traitor',
  });
  assert.equal(quoteBattleAftermath(g).next.kind, 'faceDance');
  Object.assign(g.pending.faceDance as object, { identity: captured });
  reject(g, /hero/);
});
void test('all quote outputs are detached and repeated evaluation has no RNG, UUID, state changes or private inspection', (t) => {
  const g = withoutBefore(fixture(), 'tech');
  delete g.pending.capture;
  (g.pending.auditor as { usedCards: string[] }).usedCards =
    g.players[0].hand.map((c) => c.id);
  const before = structuredClone(g),
    first = quoteBattleAftermath(g);
  const random = t.mock.method(crypto, 'getRandomValues', () => {
    throw Error('No random draw');
  });
  const uuid = t.mock.method(crypto, 'randomUUID', () => {
    throw Error('No event');
  });
  for (let i = 0; i < 20; i++) assert.deepEqual(quoteBattleAftermath(g), first);
  first.steps.length = 0;
  if (first.context.kind === 'modern')
    first.context.receipt.combatants.reverse();
  assert.deepEqual(g, before);
  assert.equal(random.mock.callCount(), 0);
  assert.equal(uuid.mock.callCount(), 0);
});

// Observation-only private export; no production test seam or mutation bypass.
const observed = {} as {
  applyActionInner: (
    g: Game,
    player: string,
    action: Parameters<typeof applyAction>[2],
  ) => Game;
  finishBattle: (g: Game) => void;
  validateKaramaUse: (
    g: Game,
    player: Game['players'][number],
    use: { kind: 'cancel'; response: NonNullable<Game['response']> },
    card: Game['deck'][number],
  ) => void;
};
runInNewContext(
  ts.transpileModule(
    readFileSync(new URL('../game/engine.ts', import.meta.url), 'utf8') +
      '\nexport { applyActionInner, finishBattle, validateKaramaUse };',
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
function actualResolvedBattle() {
  let g = createGame(
    'AFTERMATH',
    newPlayer('a', 'Harkonnen', 'harkonnen'),
    true,
    ['choam'],
  );
  g.players.push(
    newPlayer('d', 'CHOAM', 'choam'),
    newPlayer('t', 'Tleilaxu', 'tleilaxu'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 6,
    turn: 2,
    storm: 18,
    active: 'a',
    order: ['a', 'd', 't'],
    deck: baseDeck(),
    response: null,
    decision: null,
    phaseOpening: null,
    techTokens: createTechTokens(),
  });
  g.techTokens!.production.owner = 'd';
  for (const p of g.players) {
    p.hand = [];
    p.traitors = [];
    p.spice = 20;
    p.forces = p.id === 't' ? {} : { 'false_wall_south:4': 5 };
    p.reserves = p.id === 't' ? 20 : 15;
    for (const l of p.leaders) l.strength = 0;
  }
  g.players[1].leaders.push(createAuditorLeader());
  function hold(index: number, kind: string) {
    const at = g.deck.findIndex((c) => c.kind === kind);
    assert.ok(at >= 0);
    const card = g.deck.splice(at, 1)[0];
    g.players[index].hand.push(card);
    return card;
  }
  const defense = hold(0, 'shield');
  hold(0, 'worthless');
  const enemy = hold(1, 'worthless');
  g = applyAction(g, 'a', {
    type: 'chooseBattle',
    territory: 'false_wall_south',
    target: 'd',
  });
  for (let i = 0; g.response && i < 20; i++)
    g = applyAction(
      g,
      g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
      { type: 'passResponse' },
    );
  g = applyAction(g, 'a', {
    type: 'battlePlan',
    dial: 3,
    support: 3,
    leader: g.players[0].leaders[0].id,
    defense: defense.id,
  });
  g = applyAction(g, 'd', {
    type: 'battlePlan',
    dial: 0,
    support: 0,
    leader: 'choam-auditor',
    weapon: enemy.id,
  });
  g = applyAction(g, 'a', { type: 'traitorCall', call: false });
  g = applyAction(g, 'd', { type: 'traitorCall', call: false });
  assert.equal(g.decision?.kind, 'battleCards');
  assert.ok(
    g.pendingCapture &&
      g.pendingAuditor &&
      g.pendingTech &&
      g.pendingChoamBattleIncome &&
      g.pendingFaceDance,
  );
  return g;
}
function normalize(g: Game): BattleAftermathInput {
  return {
    status: g.status,
    phase: g.phase,
    turn: g.turn,
    advanced: g.advanced,
    battlePresent: !!g.battle,
    lastBattle: g.lastBattle,
    territoryIds: ['false_wall_south'],
    context: g.lastBattleContext,
    players: g.players.map((p) => ({
      id: p.id,
      faction: p.faction,
      hand: p.hand,
      leaders: p.leaders,
    })),
    leaderIds: g.players.flatMap((p) => p.leaders.map((l) => l.id)),
    physicalCards: [
      ...g.deck,
      ...g.discard,
      ...g.players.flatMap((p) => p.hand),
    ],
    techTokens: g.techTokens,
    pending: {
      retention: g.moritaniRetention,
      income: g.pendingChoamBattleIncome,
      tech: g.pendingTech,
      capture: g.pendingCapture,
      auditor: g.pendingAuditor,
      faceDance: g.pendingFaceDance,
    },
  };
}
void test('a real completed battle and winner cleanup produce the same CHOAM response; cancellation predicts the sole token transfer and next capture offer', () => {
  const g = actualResolvedBattle(),
    before = structuredClone(g),
    q = quoteBattleAftermath(normalize(g));
  assert.deepEqual(q.next, {
    kind: 'choamBattleIncome',
    owner: 'd',
    amount: 1,
  });
  const after = observed.applyActionInner(g, 'a', {
    type: 'decision',
    discard: [],
  });
  assert.deepEqual(g, before);
  assert.equal(after.response!.kind, q.next.kind);
  assert.equal(after.pendingTech!.choices.length, 1);
  const cancelInput = normalize(after);
  cancelInput.cancel = { kind: 'choamBattleIncome', owner: 'd' };
  const predicted = quoteBattleAftermath(cancelInput);
  assert.deepEqual(predicted.steps, [
    { kind: 'cancel', slot: 'income' },
    { kind: 'transferTech', id: 'production', from: 'd', to: 'a' },
  ]);
  assert.equal(predicted.next.kind, 'captureOffer');
  // Commit only the selected canceled receipt for the observation; the quoted
  // compulsory suffix is then executed by unchanged private finishBattle.
  const continued = structuredClone(after);
  continued.pendingChoamBattleIncome = null;
  continued.response = null;
  observed.finishBattle(continued);
  assert.equal(continued.techTokens!.production.owner, 'a');
  assert.equal(continued.pendingTech, null);
  assert.deepEqual(
    JSON.parse(JSON.stringify(continued.decision)),
    predicted.next,
  );
  assert.equal(continued.players[1].spice, after.players[1].spice);
  assert.ok(continued.pendingAuditor && continued.pendingFaceDance);
});

/** Real income response with BG's one unplayed Worthless card as the sole
 * eligible Auditor candidate. Its retained Shield is a used-card exclusion. */
function lastAuditCandidateIncome(form: 'worthless' | 'printed' = 'worthless') {
  let g = createGame('AUDITCOST', newPlayer('b', 'BG', 'beneGesserit'), true, [
    'choam',
  ]);
  g.players.push(
    newPlayer('c', 'CHOAM', 'choam'),
    newPlayer('e', 'Emperor', 'emperor'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 6,
    turn: 2,
    storm: 18,
    active: 'b',
    order: ['b', 'c', 'e'],
    deck: baseDeck(),
    response: null,
    decision: null,
    phaseOpening: null,
  });
  for (const p of g.players) {
    p.hand = [];
    p.spice = 20;
    p.traitors = [];
    p.forces = p.id === 'e' ? {} : { 'false_wall_south:4': 5 };
    p.reserves = p.id === 'e' ? 20 : 15;
    for (const l of p.leaders) l.strength = 0;
  }
  g.players[1].leaders.push(createAuditorLeader());
  function hold(index: number, kind: string, effect?: string) {
    const at = g.deck.findIndex(
      (c) => c.kind === kind && (!effect || c.effect === effect),
    );
    assert.ok(at >= 0);
    const card = g.deck.splice(at, 1)[0];
    g.players[index].hand.push(card);
    return card;
  }
  const shield = hold(0, 'shield'),
    cost =
      form === 'printed' ? hold(0, 'special', 'karama') : hold(0, 'worthless'),
    loserCard = hold(1, 'worthless');
  hold(2, 'special', 'karama');
  const allow = () => {
    for (let i = 0; g.response && i < 30; i++)
      g = applyAction(
        g,
        g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
        { type: 'passResponse' },
      );
    assert.equal(g.response, null);
  };
  g = applyAction(g, 'b', {
    type: 'chooseBattle',
    territory: 'false_wall_south',
    target: 'c',
  });
  allow();
  for (let i = 0; g.battle?.preparation && i < 20; i++) {
    g = applyAction(g, g.battle.preparation.owner, {
      type: 'declineBattlePower',
    });
    allow();
  }
  g = applyAction(g, 'b', {
    type: 'battlePlan',
    dial: 3,
    support: 3,
    leader: g.players[0].leaders[0].id,
    defense: shield.id,
  });
  g = applyAction(g, 'c', {
    type: 'battlePlan',
    dial: 0,
    support: 0,
    leader: 'choam-auditor',
    weapon: loserCard.id,
  });
  g = applyAction(g, 'b', { type: 'traitorCall', call: false });
  g = applyAction(g, 'c', { type: 'traitorCall', call: false });
  assert.equal(g.decision?.kind, 'battleCards');
  g = applyAction(g, 'b', { type: 'decision', discard: [] });
  assert.equal(g.response?.kind, 'choamBattleIncome');
  assert.deepEqual(g.pendingAuditor!.usedCards, [shield.id]);
  assert.deepEqual(
    g.players[0].hand.map((c) => c.id).sort(),
    [shield.id, cost.id].sort(),
  );
  return { g, cost, shield };
}
for (const form of ['worthless', 'printed'] as const) {
  void test(`${form} cancellation spending the final Auditor candidate validates the newly reachable board before its first cost`, (t) => {
    const f = lastAuditCandidateIncome(form),
      bad = structuredClone(f.g);
    bad.players[2].forces = { 'red_chasm:999': 1 };
    bad.players[2].reserves = 19;
    const before = structuredClone(bad);
    const random = t.mock.method(crypto, 'getRandomValues', () => {
      throw Error('No random draw');
    });
    const uuid = t.mock.method(crypto, 'randomUUID', () => {
      throw Error('No event');
    });
    // Observe the actual unchanged pre-cost validator, separately from the
    // public dispatcher's clone atomicity, for both printed and converted use.
    assert.throws(
      () =>
        observed.validateKaramaUse(
          bad,
          bad.players[0],
          { kind: 'cancel', response: bad.response! },
          f.cost,
        ),
      /board|location/i,
    );
    assert.throws(
      () =>
        applyAction(bad, 'b', {
          type: 'card',
          card: f.cost.id,
          mode: 'cancel',
        }),
      /board|location/i,
    );
    assert.deepEqual(bad, before);
    assert.equal(
      bad.discard.some((c) => c.id === f.cost.id),
      false,
    );
    assert.equal(random.mock.callCount(), 0);
    assert.equal(uuid.mock.callCount(), 0);
  });
  void test(`${form} cancellation spends once and skips an empty Auditor without inspecting the used retained Shield`, () => {
    const f = lastAuditCandidateIncome(form),
      before = structuredClone(f.g);
    let g = applyAction(f.g, 'b', {
      type: 'card',
      card: f.cost.id,
      mode: 'cancel',
    });
    assert.deepEqual(f.g, before);
    if (form === 'worthless') assert.equal(g.response?.kind, 'worthlessKarama');
    g = JSON.parse(JSON.stringify(g)) as Game;
    for (let i = 0; g.response && i < 20; i++) {
      const p = g.players.find((p) => !g.response!.passed.includes(p.id));
      assert.ok(p);
      g = applyAction(g, p.id, { type: 'passResponse' });
    }
    assert.equal(g.response, null);
    assert.equal(g.pendingAuditor, null);
    assert.equal(g.auditorInsight ?? null, null);
    assert.equal(g.discard.filter((c) => c.id === f.cost.id).length, 1);
    assert.deepEqual(
      g.players[0].hand.map((c) => c.id),
      [f.shield.id],
    );
    assert.equal(
      g.log.filter((e) => e.text.includes('no eligible opposing hand cards'))
        .length,
      1,
    );
    assert.deepEqual(
      g.players.map((p) => p.spice),
      [17, 20, 20],
    );
    assert.equal(g.decision?.kind, 'choamMarket');
  });
}
void test('cost projection removes only the held card, preserves global physical custody and validates its selected owner', () => {
  const g = withoutBefore(fixture(), 'income');
  delete g.pending.tech;
  delete g.pending.capture;
  delete g.pending.faceDance;
  g.cancel = { kind: 'choamBattleIncome', owner: 'd' };
  const card = g.players[0].hand[0].id,
    spending = { player: 'a', card },
    before = structuredClone(g);
  assert.equal(quoteBattleAftermath(g).next.kind, 'choamAudit');
  assert.deepEqual(quoteBattleAftermath(g, spending).steps, [
    { kind: 'cancel', slot: 'income' },
    { kind: 'emptyAuditor', event: 'resolved' },
  ]);
  assert.equal(quoteBattleAftermath(g, spending).next.kind, 'board');
  assert.deepEqual(g, before);
  (g.pending.auditor as { usedCards: string[] }).usedCards = [card];
  // A used card retains its physical identity after hand -> discard migration.
  assert.equal(quoteBattleAftermath(g, spending).next.kind, 'board');
  for (const invalid of [
    { player: 'missing', card },
    { player: 'd', card },
    { player: 'a', card: 'missing' },
  ])
    assert.throws(() => quoteBattleAftermath(g, invalid), /custody/);
  for (const duplicate of [false, true]) {
    const bad = structuredClone(g);
    bad.physicalCards = duplicate
      ? [...bad.physicalCards, g.players[0].hand[0]]
      : bad.physicalCards.filter((c) => c.id !== card);
    assert.throws(
      () => quoteBattleAftermath(bad, spending),
      BattleAftermathQuoteError,
    );
  }
});
void test('post-cost projection still stops at a genuine capture or Face Dance choice before later work', () => {
  const g = withoutBefore(fixture(), 'income');
  delete g.pending.tech;
  g.cancel = { kind: 'choamBattleIncome', owner: 'd' };
  const spending = { player: 'a', card: g.players[0].hand[0].id };
  g.pending.auditor = { malformed: 'later choice' };
  assert.equal(quoteBattleAftermath(g, spending).next.kind, 'captureOffer');
  delete g.pending.capture;
  g.pending.auditor = fixture().pending.auditor;
  assert.equal(quoteBattleAftermath(g, spending).next.kind, 'faceDance');
});
