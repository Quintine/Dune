import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import {
  baseDeck,
  ixBattleCards,
  leaders,
  createAuditorLeader,
  type Card,
  type Leader,
} from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { CHEAP_HERO_TRAITOR } from '../game/traitors';
import {
  createRicheseNoField,
  deployRicheseNoField,
} from '../game/richese-no-field';
import { createGame, newPlayer, applyAction, type Game } from '../game/engine';
import {
  quoteBattleResolution,
  BattleResolutionQuoteError,
  type BattleResolutionInput,
  type ResolutionCombatant,
} from '../game/battle-resolution-quote';
import type { CombatForces } from '../game/combat';
import type { StrongholdId } from '../game/stronghold-cards';
const catalog = () => [...baseDeck(), ...ixBattleCards(), ...richeseCards()];
function input(): BattleResolutionInput {
  const side = (
    id: string,
    faction: 'emperor' | 'guild',
    strength: number,
  ): ResolutionCombatant => {
    const leader = { ...leaders(faction)[0], strength };
    return {
      id,
      faction,
      spice: 10,
      hand: [],
      leader,
      plan: {
        dial: 2,
        support: 2,
        leader: leader.id,
        weapon: null,
        defense: null,
      },
      forces: { normal: 5, elite: 0, eliteStrength: 2, freeSupport: false },
    };
  };
  return {
    advanced: true,
    turn: 2,
    territory: 'arrakeen',
    attacker: side('a', 'emperor', 3),
    defender: side('d', 'guild', 2),
    voters: [
      { id: 'a', beneficiary: 'a', called: false, traitors: [] },
      { id: 'd', beneficiary: 'd', called: false, traitors: [] },
    ],
    participants: [
      { id: 'a', faction: 'emperor' },
      { id: 'd', faction: 'guild' },
    ],
    physicalCards: catalog(),
    pendingAuditorPresent: false,
    pendingRetentionPresent: false,
  };
}
function play(
  g: BattleResolutionInput,
  side: 'attacker' | 'defender',
  slot: 'weapon' | 'defense' | 'leader' | 'lateDefense',
  predicate: (card: Card) => boolean,
) {
  const taken = new Set(
    [...g.attacker.hand, ...g.defender.hand].map((c) => c.id),
  );
  const card = catalog().find((c) => !taken.has(c.id) && predicate(c));
  assert.ok(card);
  g[side].hand = [...g[side].hand, card];
  if (slot === 'lateDefense') g[side].lateDefense = card.id;
  else g[side].plan[slot] = card.id;
  if (slot === 'leader') delete g[side].leader;
  return card;
}
function call(g: BattleResolutionInput, side: 'attacker' | 'defender') {
  const own = g[side],
    other = side === 'attacker' ? g.defender : g.attacker;
  const voter = g.voters.find((v) => v.id === own.id)!;
  voter.called = true;
  voter.traitors = [
    other.hand.some((c) => c.id === other.plan.leader && c.kind === 'hero')
      ? CHEAP_HERO_TRAITOR
      : other.plan.leader!,
  ];
}
function reject(g: BattleResolutionInput, pattern?: RegExp) {
  const before = structuredClone(g);
  assert.throws(
    () => quoteBattleResolution(g),
    pattern ?? BattleResolutionQuoteError,
  );
  assert.deepEqual(g, before);
}
void test('normal quote computes scores, both support splits, bounty and typed winner casualties without mutation', () => {
  const g = input();
  play(g, 'defender', 'weapon', (c) => c.kind === 'worthless');
  const before = structuredClone(g),
    q = quoteBattleResolution(g);
  assert.equal(q.result, 'normal');
  assert.equal(q.winner, 'a');
  assert.deepEqual(q.scores, { attacker: 5, defender: 4 });
  assert.deepEqual(q.leaderDeaths, { attacker: false, defender: false });
  assert.deepEqual(
    q.payments.map((p) => [p.player, p.ownPayment, p.allyPayment]),
    [
      ['a', 2, 0],
      ['d', 2, 0],
    ],
  );
  assert.deepEqual(q.casualties!.options, [
    { normal: 2, elite: 0, paidNormal: 2, paidElite: 0 },
  ]);
  assert.deepEqual(q.destroyedArmies, ['d']);
  assert.equal(q.basicWinnerLosses, null);
  assert.deepEqual(q.discarded, [
    { player: 'd', card: g.defender.plan.weapon },
  ]);
  q.casualties!.forces.normal = 0;
  q.played.defender.length = 0;
  assert.deepEqual(g, before);
});
void test('traitors precede explosion, grant sole-winner support exemption and kill only the losing leader', () => {
  for (const votes of ['attacker', 'defender', 'both'] as const) {
    const g = input();
    play(g, 'attacker', 'weapon', (c) => c.kind === 'lasgun');
    play(g, 'defender', 'defense', (c) => c.kind === 'shield');
    if (votes !== 'defender') call(g, 'attacker');
    if (votes !== 'attacker') call(g, 'defender');
    const q = quoteBattleResolution(g);
    assert.equal(q.explosion, true);
    assert.equal(q.effects, null);
    assert.equal(q.casualties, null);
    assert.equal(q.result, votes === 'both' ? 'mutualTraitors' : 'traitor');
    assert.equal(
      q.winner,
      votes === 'both' ? null : votes === 'attacker' ? 'a' : 'd',
    );
    assert.deepEqual(q.leaderDeaths, {
      attacker: votes !== 'attacker',
      defender: votes !== 'defender',
    });
    assert.equal(
      q.payments.filter((p) => p.freeByTraitor).length,
      votes === 'both' ? 0 : 1,
    );
    assert.equal(
      q.bounty?.amount ?? null,
      votes === 'both' ? null : votes === 'attacker' ? 2 : 3,
    );
  }
});
void test('allied Harkonnen cancellation changes actual result and support obligations; Cheap Hero uses its shared traitor identity', () => {
  const g = input();
  g.participants = [
    ...g.participants,
    { id: 'h', faction: 'harkonnen', ally: 'd' },
  ];
  g.defender.ally = 'h';
  g.voters = [
    ...g.voters,
    {
      id: 'h',
      beneficiary: 'd',
      called: true,
      traitors: [g.attacker.plan.leader!],
    },
  ];
  assert.equal(quoteBattleResolution(g).winner, 'd');
  const canceled = structuredClone(g);
  canceled.voters[2].called = false;
  const q = quoteBattleResolution(canceled);
  assert.equal(q.winner, 'a');
  assert.equal(q.result, 'normal');
  assert.equal(
    q.payments.every((p) => !p.freeByTraitor),
    true,
  );
  g.defender.spice = 0;
  assert.equal(quoteBattleResolution(g).winner, 'd');
  canceled.defender.spice = 0;
  reject(canceled, /funded/);
  const hero = input();
  play(hero, 'defender', 'leader', (c) => c.kind === 'hero');
  call(hero, 'attacker');
  assert.deepEqual(quoteBattleResolution(hero).revelations, [
    { player: 'a', identity: CHEAP_HERO_TRAITOR },
  ]);
  assert.equal(quoteBattleResolution(hero).bounty!.amount, 0);
});
void test('KH prevents an invalid stored true call and adds two only to an unstunned surviving leader', () => {
  const g = input();
  g.defender.plan.kwisatz = true;
  assert.equal(quoteBattleResolution(g).scores!.defender, 6);
  call(g, 'attacker');
  reject(g, /Kwisatz/);
  g.voters[0].called = false;
  play(g, 'attacker', 'weapon', (c) => c.kind === 'artillery');
  const q = quoteBattleResolution(g);
  assert.equal(q.scores!.defender, 2);
  assert.equal(q.bounty, null);
});
void test('Stone validates physical ambiguity and mode before traitors, and uses undialed tokens rather than leader scores', () => {
  const g = input();
  play(g, 'attacker', 'weapon', (c) => c.effect === 'stoneBurner');
  g.attacker.stoneMode = 'ignore';
  g.attacker.plan.dial = g.attacker.plan.support = 4;
  const q = quoteBattleResolution(g);
  assert.equal(q.winner, 'd');
  assert.deepEqual(q.stone, {
    winner: 'defender',
    attacker: [1],
    defender: [3],
  });
  g.attacker.stoneMode = 'kill';
  assert.deepEqual(quoteBattleResolution(g).leaderDeaths, {
    attacker: true,
    defender: true,
  });
  delete g.attacker.stoneMode;
  call(g, 'attacker');
  reject(g, /revealed mode/);
  g.attacker.stoneMode = 'ignore';
  g.attacker.forces = {
    normal: 5,
    elite: 1,
    eliteStrength: 2,
    freeSupport: false,
  };
  g.attacker.plan.dial = 3;
  g.attacker.plan.support = 1;
  g.defender.forces.normal = 3;
  g.defender.plan.dial = 1;
  g.defender.plan.support = 1;
  reject(g, /unresolved physical casualty/);
});
void test('Habbanya selects ordinary and Stone ties; canceled free-support and elite bonuses remain captured in casualty choices', () => {
  const g = input();
  g.defender.leader!.strength = 3;
  g.defender.stronghold = 'habbanya_ridge_sietch';
  assert.equal(quoteBattleResolution(g).winner, 'd');
  play(g, 'attacker', 'weapon', (c) => c.effect === 'stoneBurner');
  g.attacker.stoneMode = 'ignore';
  assert.equal(quoteBattleResolution(g).winner, 'd');
  const canceled = input();
  canceled.attacker.forces = {
    normal: 2,
    elite: 1,
    eliteStrength: 1,
    freeSupport: false,
  };
  canceled.attacker.plan.dial = 1.5;
  canceled.attacker.plan.support = 0;
  const q = quoteBattleResolution(canceled);
  assert.deepEqual(q.casualties!.forces, canceled.attacker.forces);
  assert.deepEqual(q.casualties!.options, [
    { normal: 2, elite: 1, paidNormal: 0, paidElite: 0 },
  ]);
});
void test('funding consumes explicit current escrow and includes Stronghold bank support in CHOAM income without debiting the bank or donor twice', () => {
  const g = input();
  g.participants = [
    ...g.participants,
    { id: 'c', faction: 'choam', ally: 'a' },
  ];
  g.attacker.stronghold = 'arrakeen';
  g.attacker.spice = 0;
  g.attacker.plan.dial = g.attacker.plan.support = 4;
  g.attacker.plan.allyPayment = 2;
  g.attacker.aid = { donor: 'c', amount: 2 };
  g.attacker.ally = 'c';
  const before = structuredClone(g),
    q = quoteBattleResolution(g);
  assert.deepEqual(q.payments[0], {
    player: 'a',
    cost: 2,
    ownPayment: 0,
    allyPayment: 2,
    donor: 'c',
    bankSupport: 2,
    freeByTraitor: false,
  });
  assert.deepEqual(q.choamIncome, { owner: 'c', amount: 2 });
  assert.deepEqual(g, before);
  g.attacker.aid.amount = 1;
  reject(g, /funded/);
  g.attacker.aid.amount = 2;
  g.attacker.plan.allyPayment = 3;
  reject(g, /split/);
});
void test('Carthag, activated Tooth, Artillery and double-traitor Stronghold income retain their existing precedence', () => {
  const g = input();
  g.attacker.stronghold = 'carthag';
  play(g, 'attacker', 'defense', (c) => c.kind === 'shield');
  play(g, 'defender', 'weapon', (c) => c.kind === 'poison');
  assert.equal(quoteBattleResolution(g).leaderDeaths.attacker, false);
  const tooth = input();
  play(tooth, 'attacker', 'weapon', (c) => c.kind === 'poisonTooth');
  tooth.attacker.poisonTooth = false;
  assert.deepEqual(quoteBattleResolution(tooth).leaderDeaths, {
    attacker: false,
    defender: false,
  });
  tooth.attacker.poisonTooth = true;
  assert.deepEqual(quoteBattleResolution(tooth).leaderDeaths, {
    attacker: true,
    defender: true,
  });
  const rich = input();
  rich.attacker.stronghold = 'sietch_tabr';
  rich.defender.stronghold = 'tueks_sietch';
  play(rich, 'defender', 'weapon', (c) => c.kind === 'worthless');
  assert.deepEqual(quoteBattleResolution(rich).strongholdIncome, [
    { player: 'a', amount: 2 },
    { player: 'd', amount: 2 },
  ]);
  call(rich, 'attacker');
  call(rich, 'defender');
  assert.deepEqual(quoteBattleResolution(rich).strongholdIncome, []);
});
void test('Auditor and Moritani receipts are evaluated after leader effects but before any disposal and reject existing active receipts', () => {
  const g = input();
  g.attacker.faction = 'choam';
  g.participants[0].faction = 'choam';
  g.attacker.leader = createAuditorLeader();
  g.attacker.plan.leader = g.attacker.leader.id;
  const late = play(
    g,
    'defender',
    'lateDefense',
    (c) => c.effect === 'portableSnooper',
  );
  const original = play(g, 'defender', 'defense', (c) => c.kind === 'shield');
  const q = quoteBattleResolution(g);
  assert.deepEqual(q.auditor, {
    owner: 'a',
    opponent: 'd',
    territory: 'arrakeen',
    turn: 2,
    survived: true,
    usedCards: [original.id, late.id],
    stage: 'offer',
  });
  const duplicateAuditHand = structuredClone(g);
  const unplayed = catalog().find((c) => c.kind === 'worthless')!;
  duplicateAuditHand.defender.hand = [
    ...duplicateAuditHand.defender.hand,
    unplayed,
    unplayed,
  ];
  reject(duplicateAuditHand, /unique physical cards/);
  g.pendingAuditorPresent = true;
  reject(g, /preceding audit/);
  const r = input();
  r.participants = [
    ...r.participants,
    { id: 'm', faction: 'moritani', ally: 'd' },
  ];
  r.defender.ally = 'm';
  play(r, 'defender', 'weapon', (c) => c.kind === 'projectile');
  play(r, 'attacker', 'defense', (c) => c.kind === 'shield');
  const retention = quoteBattleResolution(r);
  assert.deepEqual(retention.retention!.played, [r.defender.plan.weapon]);
  assert.equal(
    retention.discarded.some((c) => c.player === 'd'),
    false,
  );
  r.pendingRetentionPresent = true;
  reject(r, /previous alliance/);
});
void test('all selected physical roles including reserved late defense require exact global custody; no rejected input is mutated', () => {
  const original = input();
  const late = play(
    original,
    'attacker',
    'lateDefense',
    (c) => c.effect === 'portableSnooper',
  );
  const mutations: ((g: BattleResolutionInput) => void)[] = [
    (g) => {
      g.attacker.hand = [];
    },
    (g) => {
      g.physicalCards = [...g.physicalCards, late];
    },
    (g) => {
      g.attacker.hand = [...g.attacker.hand, late];
    },
    (g) => {
      g.attacker.plan.defense = late.id;
    },
    (g) => {
      g.attacker.plan.leader = 'missing-disc';
    },
    (g) => {
      g.attacker.plan.dial = 100;
    },
    (g) => {
      g.attacker.plan.support = Number.NaN;
    },
    (g) => {
      g.attacker.forces.elite = -1;
    },
    (g) => {
      g.voters[0].called = true;
    },
  ];
  for (const mutate of mutations) {
    const g = structuredClone(original);
    mutate(g);
    reject(g);
  }
});
void test('No-Field guard applies only to actual unsupported destruction targets, including noncombatants during explosion', () => {
  const g = input();
  g.participants = [
    ...g.participants,
    { id: 'r', faction: 'richese', noFieldAtTerritory: true },
  ];
  assert.equal(quoteBattleResolution(g).winner, 'a');
  play(g, 'attacker', 'weapon', (c) => c.kind === 'lasgun');
  play(g, 'defender', 'defense', (c) => c.kind === 'shield');
  reject(g, /concealed No-Field/);
  call(g, 'attacker');
  assert.equal(quoteBattleResolution(g).result, 'traitor');
  g.participants[1].noFieldAtTerritory = true;
  reject(g, /concealed No-Field/);
});
void test('Basic ordinary winner uses immediate dial losses; Basic Ix winner keeps half-strength typed allocations', () => {
  const basic = input();
  basic.advanced = false;
  for (const s of [basic.attacker, basic.defender]) {
    s.forces.freeSupport = true;
    s.plan.support = 0;
  }
  const q = quoteBattleResolution(basic);
  assert.deepEqual(q.payments, []);
  assert.equal(q.basicWinnerLosses, 2);
  assert.equal(q.casualties, null);
  basic.attacker.faction = 'ixians';
  basic.participants[0].faction = 'ixians';
  basic.attacker.forces.normalFixedHalf = true;
  const ix = quoteBattleResolution(basic);
  assert.equal(ix.basicWinnerLosses, null);
  assert.deepEqual(ix.casualties!.options, [
    { normal: 4, elite: 0, paidNormal: 0, paidElite: 0 },
  ]);
});

// Observation-only exports appended to the unchanged production source. This
// supplies the same private normalization adapter and resolver to a comparison;
// no test export or bypass is added to production.
const observed = {} as {
  resolveBattle: (g: Game) => void;
  combatForces: (
    g: Game,
    p: Game['players'][number],
    t: string,
    other: Game['players'][number],
  ) => CombatForces;
  controlledLeaders: (g: Game, p: Game['players'][number]) => Leader[];
  strongholdEffect: (g: Game, id: string) => StrongholdId | null;
  aidFor: (
    g: Game,
    p: Game['players'][number],
  ) => { amount: number } | undefined;
};
runInNewContext(
  ts.transpileModule(
    readFileSync(new URL('../game/engine.ts', import.meta.url), 'utf8') +
      '\nexport { resolveBattle, combatForces, controlledLeaders, strongholdEffect, aidFor };',
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
function productionBattle() {
  let g = createGame('QUOTE', newPlayer('a', 'Attacker', 'emperor'), true);
  g.players.push(newPlayer('d', 'Defender', 'guild'));
  Object.assign(g, {
    status: 'playing',
    phase: 6,
    turn: 2,
    storm: 18,
    active: 'a',
    order: ['a', 'd'],
    deck: catalog(),
    response: null,
    decision: null,
    phaseOpening: null,
  });
  for (const p of g.players) {
    p.spice = 20;
    p.forces = { 'arrakeen:10': 5 };
    p.reserves = 15;
    p.hand = [];
    p.traitors = [];
  }
  for (const [index, kind] of [
    [0, 'projectile'],
    [1, 'worthless'],
  ] as const) {
    const at = g.deck.findIndex((c) => c.kind === kind);
    g.players[index].hand.push(g.deck.splice(at, 1)[0]);
  }
  g = applyAction(g, 'a', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'd',
  });
  while (g.response)
    g = applyAction(
      g,
      g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
      { type: 'passResponse' },
    );
  for (let i = 0; g.battle?.preparation && i < 20; i++) {
    g = applyAction(g, g.battle.preparation.owner, {
      type: 'declineBattlePower',
    });
    while (g.response)
      g = applyAction(
        g,
        g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
        { type: 'passResponse' },
      );
  }
  for (const [index, dial] of [
    [0, 3],
    [1, 1],
  ] as const)
    g = applyAction(g, g.players[index].id, {
      type: 'battlePlan',
      dial,
      support: dial,
      leader: g.players[index].leaders[0].id,
      weapon: g.players[index].hand[0].id,
    });
  assert.equal(g.battle!.revealed, true);
  // Snapshot of the complete choices immediately before resolveBattle; no
  // resources or physical cards are changed between quote and real resolver.
  g.battle!.traitorCalls = { a: false, d: false };
  return g;
}
function normalize(g: Game): BattleResolutionInput {
  const b = g.battle!;
  const side = (id: string, otherId: string): ResolutionCombatant => {
    const p = g.players.find((s) => s.id === id)!,
      other = g.players.find((s) => s.id === otherId)!;
    const aid = observed.aidFor(g, p);
    return {
      id,
      faction: p.faction,
      ally: p.ally,
      spice: p.spice,
      hand: p.hand,
      plan: b.plans[id],
      leader: observed
        .controlledLeaders(g, p)
        .find((l) => l.id === b.plans[id].leader),
      forces: observed.combatForces(g, p, b.territory, other),
      stronghold: observed.strongholdEffect(g, id),
      ...(aid ? { aid: { donor: p.ally!, amount: aid.amount } } : {}),
      lateDefense: b.lateDefense?.[id],
      stoneMode: b.stoneBurner?.[id],
      poisonTooth: b.poisonTooth?.[id],
    };
  };
  return {
    advanced: g.advanced,
    turn: g.turn,
    territory: b.territory,
    attacker: side(b.attacker, b.defender),
    defender: side(b.defender, b.attacker),
    voters: [b.attacker, b.defender].map((id) => ({
      id,
      beneficiary: id,
      called: !!b.traitorCalls[id],
      traitors: g.players.find((p) => p.id === id)!.traitors,
    })),
    participants: g.players.map((p) => ({
      id: p.id,
      faction: p.faction,
      ally: p.ally,
      noFieldAtTerritory:
        p.noField?.deployed?.location.territory === b.territory,
    })),
    physicalCards: [
      ...g.deck,
      ...g.discard,
      ...g.players.flatMap((p) => p.hand),
    ],
    pendingAuditorPresent: !!g.pendingAuditor,
    pendingRetentionPresent: !!g.moritaniRetention,
  };
}
void test('a genuine revealed production battle consumes the same score, losses, funding, bounty and mandatory card quote', () => {
  const g = productionBattle(),
    before = structuredClone(g),
    normalized = normalize(g),
    q = quoteBattleResolution(normalized);
  const actual = structuredClone(g);
  observed.resolveBattle(actual);
  assert.deepEqual(g, before);
  assert.equal(actual.lastBattleContext!.winner, q.winner);
  assert.equal(actual.lastBattleContext!.result, q.result);
  for (const [index, label] of [
    [0, 'attacker'],
    [1, 'defender'],
  ] as const) {
    const p = actual.players[index],
      previous = before.players[index];
    const payment =
      q.payments.find((pay) => pay.player === p.id)?.ownPayment ?? 0;
    const bounty = q.bounty?.player === p.id ? q.bounty.amount : 0;
    assert.equal(p.spice, previous.spice - payment + bounty);
    assert.equal(
      p.leaders.find((l) => l.id === normalized[label].leader!.id)!.dead,
      q.leaderDeaths[label],
    );
  }
  assert.equal(
    actual.pendingTreacheryDiscard!.continuation.kind,
    'battleResolved',
  );
  const frame = actual.pendingTreacheryDiscard!.continuation;
  if (frame.kind === 'battleResolved') {
    assert.deepEqual(frame.casualties, q.casualties);
    assert.deepEqual(frame.cards, q.winnerCards);
  }
  assert.deepEqual(
    actual.pendingTreacheryDiscard!.batch.entries.map((e) => ({
      player: e.discardedBy,
      card: e.card.id,
    })),
    q.discarded,
  );
});
void test('repeated quote calls allocate no UUID, consume no RNG and keep input and output independent', (t) => {
  const g = input(),
    before = structuredClone(g);
  const random = t.mock.method(crypto, 'getRandomValues', () => {
    throw Error('No random selection during a quote');
  });
  const uuid = t.mock.method(crypto, 'randomUUID', () => {
    throw Error('No event allocation during a quote');
  });
  const first = quoteBattleResolution(g);
  for (let i = 0; i < 20; i++)
    assert.deepEqual(quoteBattleResolution(g), first);
  assert.deepEqual(g, before);
  assert.equal(random.mock.callCount(), 0);
  assert.equal(uuid.mock.callCount(), 0);
});

/** Every response here follows real chooseBattle/plans/traitorCall actions.
 * Only the initial bounded board position is staged; cards have one live owner. */
function alliedCallFixture(
  variant: 'ordinary' | 'auditor' | 'retention' | 'explosion' = 'ordinary',
  partial = false,
) {
  let g = createGame(
    'HARKQUOTE',
    newPlayer('a', 'Attacker', variant === 'auditor' ? 'choam' : 'guild'),
    true,
    ['choam', 'ecaz'],
  );
  g.players.push(
    newPlayer('d', 'Defender', 'emperor'),
    newPlayer('h', 'Harkonnen', 'harkonnen'),
    newPlayer('b', 'BG', 'beneGesserit'),
  );
  if (variant === 'retention')
    g.players.push(newPlayer('m', 'Moritani', 'moritani'));
  if (variant === 'explosion')
    g.players.push(newPlayer('r', 'Richese', 'richese'));
  Object.assign(g, {
    status: 'playing',
    phase: 6,
    turn: 2,
    storm: 18,
    active: 'a',
    order: g.players.map((p) => p.id),
    deck: catalog(),
    response: null,
    decision: null,
    phaseOpening: null,
  });
  for (const p of g.players) {
    p.hand = [];
    p.spice = 20;
    p.forces = ['a', 'd'].includes(p.id) ? { 'false_wall_south:4': 5 } : {};
    p.reserves = ['a', 'd'].includes(p.id) ? 15 : 20;
    p.traitors = [];
    for (const l of p.leaders) l.strength = 0;
  }
  const seat = (id: string) => g.players.find((p) => p.id === id)!;
  seat('d').ally = 'h';
  seat('h').ally = 'd';
  seat('d').elites = {
    reserves: 4,
    tanks: 0,
    forces: { 'false_wall_south:4': 1 },
    revived: 0,
  };
  if (variant === 'retention') {
    seat('a').ally = 'm';
    seat('m').ally = 'a';
  }
  if (variant === 'auditor') seat('a').leaders.push(createAuditorLeader());
  function hold(id: string, predicate: (c: Card) => boolean) {
    const at = g.deck.findIndex(predicate);
    assert.ok(at >= 0);
    const card = g.deck.splice(at, 1)[0];
    seat(id).hand.push(card);
    return card;
  }
  const worthless = hold('b', (c) => c.kind === 'worthless');
  const printed = hold('b', (c) => c.effect === 'karama');
  hold('h', (c) => c.effect === 'karama');
  const aCard = hold('a', (c) =>
    variant === 'explosion' ? c.kind === 'lasgun' : c.kind === 'shield',
  );
  const dCard = hold('d', (c) =>
    variant === 'explosion' ? c.kind === 'shield' : c.kind === 'worthless',
  );
  const leader =
    variant === 'auditor'
      ? seat('a').leaders.find((l) => l.id === 'choam-auditor')!.id
      : seat('a').leaders[0].id;
  if (variant === 'auditor') {
    seat('d').ally = null;
    seat('a').ally = 'h';
    seat('h').ally = 'a';
    seat('h').traitors = [seat('d').leaders[0].id];
  } else seat('h').traitors = [leader];
  const allow = () => {
    for (let i = 0; g.response && i < 30; i++)
      g = applyAction(
        g,
        g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
        { type: 'passResponse' },
      );
    assert.equal(g.response, null);
  };
  g = applyAction(g, 'a', {
    type: 'chooseBattle',
    territory: 'false_wall_south',
    target: 'd',
  });
  allow();
  for (let i = 0; g.battle?.preparation && i < 20; i++) {
    g = applyAction(g, g.battle.preparation.owner, {
      type: 'declineBattlePower',
    });
    allow();
  }
  if (g.battle?.preLeader && !g.battle.preLeader.closed)
    for (const id of ['a', 'd'])
      g = applyAction(g, id, {
        type: 'battlePreparationReady',
        event: g.battle!.preLeader!.event,
      });
  g = applyAction(g, 'a', {
    type: 'battlePlan',
    dial: variant === 'retention' ? 1 : 3,
    support: variant === 'retention' ? 1 : 3,
    leader,
    ...(variant === 'explosion' ? { weapon: aCard.id } : { defense: aCard.id }),
  });
  g = applyAction(g, 'd', {
    type: 'battlePlan',
    dial: variant === 'retention' ? 3 : 1,
    support: variant === 'retention' ? 3 : 1,
    leader: seat('d').leaders[0].id,
    ...(variant === 'explosion' ? { defense: dCard.id } : { weapon: dCard.id }),
  });
  g = applyAction(g, 'a', { type: 'traitorCall', call: false });
  if (!partial) g = applyAction(g, 'd', { type: 'traitorCall', call: false });
  g = applyAction(g, 'h', { type: 'traitorCall', call: true });
  assert.equal(g.response?.kind, 'harkonnenTraitor');
  return { g, worthless, printed };
}
function allowConversion(g: Game) {
  for (let i = 0; g.response?.kind === 'worthlessKarama' && i < 20; i++)
    g = applyAction(
      g,
      g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
      { type: 'passResponse' },
    );
  return g;
}
void test('real printed and BG allied-traitor cancellation use the same current support, typed losses and played cards', () => {
  for (const form of ['printed', 'worthless'] as const) {
    const f = alliedCallFixture();
    const before = structuredClone(f.g);
    let done = applyAction(f.g, 'b', {
      type: 'card',
      card: f[form].id,
      mode: 'cancel',
    });
    assert.deepEqual(f.g, before);
    if (form === 'worthless') {
      assert.equal(done.response?.kind, 'worthlessKarama');
      assert.equal(done.battle!.traitorCalls.h, true);
      done = allowConversion(JSON.parse(JSON.stringify(done)));
    }
    assert.equal(done.lastBattleContext!.result, 'normal');
    assert.equal(done.lastBattleContext!.winner, 'a');
    assert.deepEqual(
      done.players.slice(0, 2).map((p) => p.spice),
      [17, 19],
    );
    assert.equal(done.players[0].tanks, 3);
    assert.equal(done.players[1].tanks, 5);
    assert.equal(done.players[1].elites!.tanks, 1);
    assert.equal(done.discard.filter((c) => c.id === f[form].id).length, 1);
    assert.deepEqual(done.players[2].revealedTraitors ?? [], []);
    assert.equal(done.players[0].hand.length, 1);
    assert.equal(done.players[1].hand.length, 0);
  }
});
void test('partial traitor voters allow either cancellation form without resolving or spending battle support early', () => {
  for (const form of ['printed', 'worthless'] as const) {
    const f = alliedCallFixture('ordinary', true);
    let g = applyAction(f.g, 'b', {
      type: 'card',
      card: f[form].id,
      mode: 'cancel',
    });
    if (form === 'worthless') g = allowConversion(g);
    assert.ok(g.battle);
    assert.equal(g.battle.traitorCalls.h, false);
    assert.equal(g.battle.traitorCalls.d, undefined);
    assert.deepEqual(
      g.players.slice(0, 2).map((p) => [p.spice, p.tanks]),
      [
        [20, 0],
        [20, 0],
      ],
    );
    g = applyAction(g, 'd', { type: 'traitorCall', call: false });
    assert.equal(g.lastBattleContext!.winner, 'a');
  }
});
void test('actual allied-traitor cost rejects changed card custody, funding and typed casualty commitments without any randomness', (t) => {
  const f = alliedCallFixture();
  const mutations: ((g: Game) => void)[] = [
    (g) => {
      g.deck.push(g.players[1].hand.pop()!);
    },
    (g) => {
      g.deck.push(structuredClone(g.players[1].hand[0]));
    },
    (g) => {
      g.players[1].spice = 0;
    },
    (g) => {
      g.battle!.plans.a.dial = 20;
    },
  ];
  const random = t.mock.method(crypto, 'getRandomValues', () => {
    throw Error('Pre-cost validation must not draw');
  });
  const uuid = t.mock.method(crypto, 'randomUUID', () => {
    throw Error('Pre-cost validation must not create events');
  });
  for (const mutate of mutations)
    for (const form of ['printed', 'worthless'] as const) {
      const g = structuredClone(f.g);
      mutate(g);
      const before = structuredClone(g);
      assert.throws(
        () =>
          applyAction(g, 'b', {
            type: 'card',
            card: f[form].id,
            mode: 'cancel',
          }),
        /custody|available|funded|casualty/,
      );
      assert.deepEqual(g, before);
      assert.equal(
        g.players[3].hand.some((c) => c.id === f[form].id),
        true,
      );
    }
  assert.equal(random.mock.callCount(), 0);
  assert.equal(uuid.mock.callCount(), 0);
});
void test('final BG allowance rechecks live funding and physical custody without a second cost or partial battle effects', () => {
  const f = alliedCallFixture();
  const paid = applyAction(f.g, 'b', {
    type: 'card',
    card: f.worthless.id,
    mode: 'cancel',
  });
  for (const mutate of [
    (g: Game) => {
      g.players[1].spice = 0;
    },
    (g: Game) => {
      g.deck.push(g.players[1].hand.pop()!);
    },
    (g: Game) => {
      g.deck.push(structuredClone(g.players[1].hand[0]));
    },
  ]) {
    const g = structuredClone(paid);
    mutate(g);
    const before = structuredClone(g);
    assert.throws(() => allowConversion(g), /funded|custody|available/);
    assert.deepEqual(g, before);
    assert.equal(g.discard.filter((c) => c.id === f.worthless.id).length, 1);
    assert.equal(g.battle!.traitorCalls.h, true);
    assert.equal(g.players[0].tanks, 0);
  }
});
void test('per-location elite corruption cannot be hidden by a valid aggregate force pool before BG cost', () => {
  const f = alliedCallFixture();
  const g = structuredClone(f.g);
  g.players[1].forces = { 'false_wall_south:4': 1, 'false_wall_south:5': 4 };
  g.players[1].elites!.forces = { 'false_wall_south:4': 2 };
  const before = structuredClone(g);
  assert.throws(
    () =>
      applyAction(g, 'b', {
        type: 'card',
        card: f.worthless.id,
        mode: 'cancel',
      }),
    /casualt|elite|physical/i,
  );
  assert.deepEqual(g, before);
});
void test('actual canceled battle cannot overwrite a preceding Auditor or Moritani receipt before cost or at final BG allowance', () => {
  for (const variant of ['auditor', 'retention'] as const) {
    const completedFixture = alliedCallFixture(variant);
    const completed = allowConversion(
      applyAction(completedFixture.g, 'b', {
        type: 'card',
        card: completedFixture.worthless.id,
        mode: 'cancel',
      }),
    );
    const prior =
      variant === 'auditor'
        ? completed.pendingAuditor
        : completed.moritaniRetention;
    assert.ok(prior, `Genuine completed ${variant} receipt`);
    for (const final of [false, true]) {
      const f = alliedCallFixture(variant);
      const source = final
        ? applyAction(f.g, 'b', {
            type: 'card',
            card: f.worthless.id,
            mode: 'cancel',
          })
        : f.g;
      const bad = structuredClone(source);
      if (variant === 'auditor')
        bad.pendingAuditor = structuredClone(prior) as Game['pendingAuditor'];
      else
        bad.moritaniRetention = structuredClone(
          prior,
        ) as Game['moritaniRetention'];
      const before = structuredClone(bad);
      assert.throws(
        () =>
          final
            ? allowConversion(bad)
            : applyAction(bad, 'b', {
                type: 'card',
                card: f.worthless.id,
                mode: 'cancel',
              }),
        /audit|alliance|cleanup/i,
      );
      assert.deepEqual(bad, before);
      assert.equal(
        bad.discard.filter((c) => c.id === f.worthless.id).length,
        final ? 1 : 0,
      );
    }
  }
});
void test('per-location and safe-counter removal checks cover both combatants before cost and final allowance', () => {
  const mutations: ((g: Game) => void)[] = [
    (g) => {
      g.players[1].forces = {
        'false_wall_south:4': 1,
        'false_wall_south:5': 4,
      };
      g.players[1].elites!.forces = { 'false_wall_south:4': 2 };
    },
    (g) => {
      g.players[1].forces = {
        'false_wall_south:4': -1,
        'false_wall_south:5': 6,
      };
      g.players[1].elites!.forces = { 'false_wall_south:5': 1 };
    },
    (g) => {
      g.players[0].forces = {
        'false_wall_south:4': -1,
        'false_wall_south:5': 6,
      };
    },
    (g) => {
      g.players[1].tanks = Number.MAX_SAFE_INTEGER;
    },
    (g) => {
      g.players[0].battleLosses = Number.MAX_SAFE_INTEGER;
    },
    (g) => {
      g.players[1].elites!.tanks = 1;
    },
  ];
  const f = alliedCallFixture(),
    paid = applyAction(f.g, 'b', {
      type: 'card',
      card: f.worthless.id,
      mode: 'cancel',
    });
  for (const final of [false, true])
    for (const mutate of mutations) {
      const bad = structuredClone(final ? paid : f.g);
      mutate(bad);
      const before = structuredClone(bad);
      assert.throws(
        () =>
          final
            ? allowConversion(bad)
            : applyAction(bad, 'b', {
                type: 'card',
                card: f.worthless.id,
                mode: 'cancel',
              }),
        /forces|casualt|counter|tank/i,
      );
      assert.deepEqual(bad, before);
      assert.equal(
        bad.discard.filter((c) => c.id === f.worthless.id).length,
        final ? 1 : 0,
      );
    }
});
void test('canceling an allied traitor into a real explosion checks uninvolved forces and concealed No-Fields before cost and final allowance', (t) => {
  const f = alliedCallFixture('explosion');
  const paid = applyAction(f.g, 'b', {
    type: 'card',
    card: f.worthless.id,
    mode: 'cancel',
  });
  const mutations: ((g: Game) => void)[] = [
    (g) => {
      const r = g.players.find((p) => p.id === 'r')!;
      r.forces = { 'false_wall_south:4': -1, 'false_wall_south:5': 1 };
    },
    (g) => {
      const r = g.players.find((p) => p.id === 'r')!;
      r.forces = { 'false_wall_south:4': 1 };
      r.tanks = Number.MAX_SAFE_INTEGER;
    },
    (g) => {
      const r = g.players.find((p) => p.id === 'r')!;
      r.noField = deployRicheseNoField(
        createRicheseNoField(['zero', 'three', 'five']),
        {
          tokenId: 'three',
          controller: 'r',
          location: { territory: 'false_wall_south', sector: 5 },
        },
      );
      r.noFieldEvent = 'restored-marker-event';
    },
  ];
  const random = t.mock.method(crypto, 'getRandomValues', () => {
    throw Error('No preflight randomness');
  });
  const uuid = t.mock.method(crypto, 'randomUUID', () => {
    throw Error('No preflight event allocation');
  });
  for (const final of [false, true])
    for (const mutate of mutations) {
      const bad = structuredClone(final ? paid : f.g);
      mutate(bad);
      const before = structuredClone(bad);
      assert.throws(
        () =>
          final
            ? allowConversion(bad)
            : applyAction(bad, 'b', {
                type: 'card',
                card: f.worthless.id,
                mode: 'cancel',
              }),
        /forces|casualt|counter|tank|No-Field/i,
      );
      assert.deepEqual(bad, before);
      assert.equal(
        bad.discard.filter((c) => c.id === f.worthless.id).length,
        final ? 1 : 0,
      );
    }
  assert.equal(random.mock.callCount(), 0);
  assert.equal(uuid.mock.callCount(), 0);
});
