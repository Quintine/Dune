import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
import {
  createGame,
  newPlayer,
  joinGame,
  applyAction,
  RuleError,
  type Game,
  type Action,
} from '../game/engine';
import { baseDeck, createAuditorLeader } from '../game/cards';
import { newRevivalRules } from '../game/revival';
import { createTechTokens } from '../game/tech-tokens';
import { quoteRevivalResume, RevivalResumeError } from '../game/revival-resume';

const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));
/** Observe genuine declarations immediately before beginRevival's ordinary
 * CHOAM/stop dispatch. The production module and public start gates are unchanged. */
const engineURL = new URL('../game/engine.ts', import.meta.url);
const source = readFileSync(engineURL, 'utf8');
const entry = 'function beginRevival(g: Game, revival: PendingRevival) {';
assert.equal(source.split(entry).length, 2);
const observed: {
  applyAction: typeof applyAction;
  RuleError: typeof RuleError;
  captures: Game[];
  finishRevival: (g: Game) => void;
  offerRevivalStop: (g: Game) => void;
} = {} as never;
let randomCalls = 0;
runInNewContext(
  ts.transpileModule(
    'const captures: Game[] = [];\n' +
      source.replace(
        entry,
        entry +
          '\ncaptures.push(structuredClone({...g, pendingRevival: revival}));',
      ) +
      '\nexport { captures, finishRevival, offerRevivalStop };',
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  {
    exports: observed,
    require: createRequire(engineURL),
    structuredClone,
    TextEncoder,
    JSON,
    crypto: {
      ...webcrypto,
      randomUUID: () => {
        randomCalls++;
        return webcrypto.randomUUID();
      },
    },
    Math: Object.assign(Object.create(Math), {
      random: () => {
        randomCalls++;
        return 0.25;
      },
    }),
  },
);
function fixture(advanced = true) {
  const g = createGame(
    'REVIVALRESUME',
    newPlayer('c', 'CHOAM', 'choam'),
    advanced,
    ['choam', 'ix'],
  );
  for (const [id, faction] of [
    ['e', 'emperor'],
    ['t', 'tleilaxu'],
    ['a', 'atreides'],
    ['b', 'beneGesserit'],
    ['i', 'ixians'],
  ] as const)
    joinGame(g, newPlayer(id, faction, faction));
  Object.assign(g, {
    status: 'playing',
    phase: 4,
    turn: 2,
    order: g.players.map((p) => p.id),
    deck: baseDeck(),
    revivalRules: newRevivalRules(),
  });
  for (const p of g.players)
    Object.assign(p, {
      hand: [],
      spice: 40,
      tanks: 10,
      reserves: 10,
      forces: {},
    });
  for (const [id, kind] of [
    ['e', 'karama'],
    ['b', 'worthless'],
  ] as const) {
    const index = g.deck.findIndex((card) =>
      kind === 'karama' ? card.effect === kind : card.kind === kind,
    );
    player(g, id).hand.push(g.deck.splice(index, 1)[0]);
  }
  return g;
}
const act = (g: Game, id: string, action: Action) =>
  observed.applyAction(g, id, action);
function allow(g: Game) {
  for (let n = 0; n < 40 && (g.decision || g.response); n++) {
    if (g.decision) {
      assert.ok(['choamFreeRevival', 'revivalStop'].includes(g.decision.kind));
      g = act(g, g.decision.player, { type: 'decision', decline: true });
    } else {
      const id = g.players.find((p) => !g.response!.passed.includes(p.id))!.id;
      g = act(g, id, { type: 'passResponse' });
    }
  }
  assert.equal(g.pendingRevival, null);
  return g;
}
type Case =
  | 'forces'
  | 'limitDiscount'
  | 'choam'
  | 'ix'
  | 'early'
  | 'foreign'
  | 'native'
  | 'kwisatz'
  | 'negotiated'
  | 'buyback'
  | 'auditor'
  | 'extra';
function declaration(kind: Case, advanced = true) {
  let g = fixture(advanced);
  observed.captures.length = 0;
  if (kind === 'limitDiscount' || kind === 'ix') {
    const id = kind === 'ix' ? 'i' : 'a';
    player(g, 't').ally = id;
    player(g, id).ally = 't';
    g = act(g, 't', { type: 'tleilaxuAllyDiscount' });
    if (kind === 'limitDiscount')
      g = act(g, 't', { type: 'tleilaxuRevivalLimit', target: id });
    else
      player(g, id).elites = { tanks: 2, reserves: 2, forces: {}, revived: 0 };
    g = act(g, id, {
      type: 'revive',
      amount: kind === 'ix' ? 2 : 5,
      ...(kind === 'ix' ? { elite: 1, freeElite: 0 } : {}),
    });
  } else if (kind === 'forces' || kind === 'choam') {
    g = act(g, kind === 'choam' ? 'c' : 'e', { type: 'revive', amount: 3 });
  } else if (kind === 'extra') {
    player(g, 'e').ally = 'a';
    player(g, 'a').ally = 'e';
    g = act(g, 'e', { type: 'emperorRevival', amount: 2 });
    while (!observed.captures.length) {
      assert.equal(g.response?.kind, 'emperorRevival');
      g = act(
        g,
        g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
        { type: 'passResponse' },
      );
    }
  } else if (kind === 'early' || kind === 'foreign') {
    player(g, 't').leaders[0].dead = true;
    player(g, 't').leaders[0].deaths = 1;
    player(g, 'a').leaders[0].dead = true;
    player(g, 'a').leaders[0].deaths = 1;
    g = act(g, 't', {
      type: kind === 'early' ? 'reviveLeader' : 'reviveForeignGhola',
      leader: player(g, kind === 'early' ? 't' : 'a').leaders[0].id,
    });
  } else if (kind === 'negotiated' || kind === 'buyback') {
    const leader = player(g, 'a').leaders[0];
    leader.dead = true;
    leader.deaths = 1;
    if (kind === 'buyback') leader.gholaBy = 't';
    g = act(g, 'a', { type: 'requestLeaderRevival', leader: leader.id });
    g = act(g, 't', { type: 'quoteLeaderRevival', target: 'a', amount: 17 });
    g = act(g, 'a', { type: 'acceptLeaderRevival' });
  } else if (kind === 'auditor') {
    const leader = createAuditorLeader();
    leader.dead = true;
    leader.deaths = 1;
    player(g, 'c').leaders.push(leader);
    g = act(g, 'c', { type: 'reviveLeader', leader: leader.id });
  } else {
    player(g, 'a').leaders.forEach((l) => {
      l.dead = true;
      l.deaths = 1;
    });
    if (kind === 'kwisatz')
      player(g, 'a').kwisatz = { dead: true, revivalCycle: 1 };
    g = act(g, 'a', {
      type: kind === 'kwisatz' ? 'reviveKwisatz' : 'reviveLeader',
      ...(kind === 'native' ? { leader: player(g, 'a').leaders[0].id } : {}),
    });
  }
  assert.equal(observed.captures.length, 1);
  return { g, captured: json(observed.captures[0]) };
}
function finishState(captured: Game) {
  const state = json(captured);
  state.decision = null;
  state.response = null;
  return state;
}

void test('unchanged mixed free/paid revival reaches the real stop decision before any queued or paid work', () => {
  const { g, captured } = declaration('forces');
  const before = json(captured),
    rng = randomCalls;
  const quote = quoteRevivalResume(captured, 'stop');
  assert.equal(quote.outcome, 'decision');
  assert.deepEqual(quote.nextDecision, {
    kind: 'revivalStop',
    player: 't',
    recipient: 'e',
    revival: 'forces',
  });
  assert.deepEqual(quote.pending, {
    player: 'e',
    kind: 'forces',
    amount: 3,
    elite: 0,
    free: 1,
    cost: 4,
    normalCost: 4,
    checks: [],
  });
  assert.equal(quote.nextResponse, undefined);
  assert.equal(randomCalls, rng);
  assert.deepEqual(captured, before);
  quote.pending.checks.push('revivalDiscount');
  assert.deepEqual(captured, before);
  const done = allow(g);
  assert.equal(player(done, 'e').tanks, 7);
  assert.equal(player(done, 'e').reserves, 13);
  assert.equal(player(done, 'e').spice, 36);
  assert.equal(player(done, 't').spice, 45);
  assert.equal(done.revivalFreeIncome?.e, 2);
});
void test('initial ordered limit then discount queue remains frozen, including its agreed half price', () => {
  const { g, captured } = declaration('limitDiscount');
  assert.deepEqual(captured.pendingRevival?.checks, [
    'revivalLimit',
    'revivalDiscount',
  ]);
  assert.equal(quoteRevivalResume(captured, 'stop').outcome, 'decision');
  const quote = quoteRevivalResume(captured, 'finish');
  assert.equal(quote.outcome, 'response');
  assert.deepEqual(quote.nextResponse, {
    kind: 'revivalLimit',
    owner: 't',
    recipient: 'a',
    passed: [],
  });
  assert.deepEqual(quote.pending, captured.pendingRevival);
  const after = allow(g);
  assert.equal(player(after, 'a').revived, 5);
  assert.equal(player(after, 'a').spice, 40 - captured.pendingRevival!.cost);
});
void test('Basic skips the Advanced stop while finish explicitly bypasses it without changing a hand-dependent offer', () => {
  const { captured } = declaration('forces', false);
  const basic = quoteRevivalResume(captured, 'stop');
  assert.equal(basic.outcome, 'revive');
  captured.advanced = true;
  const choice = quoteRevivalResume(captured, 'stop');
  assert.equal(choice.outcome, 'decision');
  for (const p of captured.players) p.hand = [];
  assert.deepEqual(quoteRevivalResume(captured, 'stop'), choice);
  assert.equal(quoteRevivalResume(captured, 'finish').outcome, 'revive');
  player(captured, 't').specialKaramaUsed = true;
  assert.equal(quoteRevivalResume(captured, 'stop').outcome, 'revive');
});
void test('all real leader, foreign, negotiated, Auditor, and Emperor-extra producers keep their source and frozen price', () => {
  for (const kind of [
    'early',
    'foreign',
    'native',
    'kwisatz',
    'negotiated',
    'buyback',
    'auditor',
    'extra',
  ] as const) {
    const { g, captured } = declaration(kind);
    const before = json(captured),
      quote = quoteRevivalResume(captured, 'finish');
    assert.deepEqual(quote.pending, captured.pendingRevival, kind);
    assert.deepEqual(captured, before, kind);
    const after = allow(g),
      pending = captured.pendingRevival!;
    if (kind === 'extra') {
      assert.equal(after.emperorExtra.a, 2);
      assert.equal(player(after, 'a').revived, 0);
      assert.equal(player(after, 'e').spice, 36);
      assert.equal(player(after, 't').spice, 44);
      assert.equal(quote.nextResponse?.recipient, 'e');
    } else if (kind === 'kwisatz') {
      assert.equal(player(after, 'a').kwisatz?.dead, false);
      assert.equal(player(after, 'a').kwisatz?.revivalCycle, 2);
    } else {
      const leader = after.players
        .flatMap((p) => p.leaders)
        .find((l) => l.id === pending.leader)!;
      assert.equal(leader.dead, false, kind);
      assert.equal(leader.gholaBy, kind === 'foreign' ? 't' : undefined, kind);
    }
  }
});
void test('Ix free cyborg allocation remains the actual selected frozen quote', () => {
  const { g, captured } = declaration('ix');
  const pending = captured.pendingRevival!;
  assert.equal(pending.free, 1);
  assert.equal(pending.normalCost, 3);
  assert.equal(pending.cost, 2);
  assert.deepEqual(quoteRevivalResume(captured, 'finish').pending, pending);
  const after = allow(g);
  assert.equal(player(after, 'i').elites?.tanks, 1);
  assert.equal(player(after, 'i').elites?.reserves, 3);
  assert.equal(player(after, 'i').spice, 38);
});
void test('unfunded and Fremen allowance abandonment precede physical custody and never produce income', () => {
  const { captured } = declaration('forces');
  player(captured, 'e').spice = 0;
  player(captured, 'e').tanks = 0;
  const q = quoteRevivalResume(captured, 'finish');
  assert.equal(q.outcome, 'unfunded');
  assert.equal(q.nextResponse, undefined);
  const real = finishState(captured);
  observed.finishRevival(real);
  assert.equal(real.pendingRevival, null);
  assert.equal(player(real, 'e').tanks, 0);
  const fremen = json(captured);
  player(fremen, 'e').faction = 'fremen';
  fremen.players = fremen.players.filter((p) => p.id !== 't');
  player(fremen, 'e').tanks = 10;
  player(fremen, 'e').revived = 3;
  assert.equal(quoteRevivalResume(fremen, 'finish').outcome, 'fremenLimit');
  const actual = finishState(fremen);
  observed.finishRevival(actual);
  assert.equal(actual.pendingRevival, null);
  assert.equal(player(actual, 'e').tanks, 10);
});
void test('safe exact Axlotl income and once-per-turn free-income receipts are quoted only at actual commit', () => {
  const { captured } = declaration('forces');
  captured.techTokens = createTechTokens(captured.players);
  captured.techTokens.heighliners.owner = 't';
  const q = quoteRevivalResume(captured, 'finish');
  assert.deepEqual(q.techIncome, {
    id: 'axlotl',
    owner: 't',
    spice: 2,
    triggeredTurn: 2,
  });
  assert.deepEqual(q.freeIncome, { player: 'e', turn: 2 });
  assert.deepEqual(q.nextResponse, {
    kind: 'revivalIncome',
    owner: 't',
    recipient: 'e',
    amount: 5,
    passed: [],
  });
  const real = finishState(captured);
  observed.finishRevival(real);
  assert.equal(real.techTokens!.axlotl.spice, 2);
  assert.equal(real.techTokens!.axlotl.triggeredTurn, 2);
  assert.deepEqual(json(real.response), q.nextResponse);
  assert.equal(quoteRevivalResume(captured, 'stop').techIncome, undefined);
  captured.revivalFreeIncome = { e: 2 };
  captured.techTokens.axlotl.triggeredTurn = 2;
  const repeated = quoteRevivalResume(captured, 'finish');
  assert.equal(repeated.techIncome, undefined);
  assert.equal(repeated.nextResponse?.amount, 4);
});
void test('corrupted source, ordered checks, physical custody and counter overflow reject without mutation', () => {
  const { captured } = declaration('forces');
  const cases: [string, (g: Game) => void][] = [
    [
      'phase',
      (g) => {
        g.phase = 5;
      },
    ],
    [
      'turn',
      (g) => {
        g.turn = NaN;
      },
    ],
    [
      'missing request',
      (g) => {
        g.pendingRevival = null;
      },
    ],
    [
      'target',
      (g) => {
        g.pendingRevival!.player = 'absent';
      },
    ],
    [
      'checks',
      (g) => {
        g.pendingRevival!.checks = null as never;
      },
    ],
    [
      'reversed checks',
      (g) => {
        g.pendingRevival!.checks = ['revivalDiscount', 'revivalLimit'];
      },
    ],
    [
      'duplicate checks',
      (g) => {
        g.pendingRevival!.checks = ['revivalDiscount', 'revivalDiscount'];
      },
    ],
    [
      'wrong check kind',
      (g) => {
        g.pendingRevival!.checks = ['foreignGhola'];
      },
    ],
    [
      'missing check owner',
      (g) => {
        g.players = g.players.filter((p) => p.id !== 't');
        g.pendingRevival!.checks = ['revivalDiscount'];
      },
    ],
    [
      'amount',
      (g) => {
        g.pendingRevival!.amount = 99;
      },
    ],
    [
      'within-tanks amount changed without repricing',
      (g) => {
        g.pendingRevival!.amount = 4;
      },
    ],
    [
      'negative cost',
      (g) => {
        g.pendingRevival!.cost = -1;
      },
    ],
    [
      'unsupported force rate',
      (g) => {
        g.pendingRevival!.cost = 0;
      },
    ],
    [
      'wrong payer',
      (g) => {
        g.pendingRevival!.payer = 'c';
      },
    ],
    [
      'missing typed tanks',
      (g) => {
        g.pendingRevival!.elite = 1;
      },
    ],
    [
      'elite custody',
      (g) => {
        player(g, 'e').elites = {
          tanks: 9,
          reserves: 0,
          forces: {},
          revived: 0,
        };
      },
    ],
    [
      'reserve overflow',
      (g) => {
        player(g, 'e').reserves = Number.MAX_SAFE_INTEGER;
      },
    ],
    [
      'quota overflow',
      (g) => {
        player(g, 'e').revived = Number.MAX_SAFE_INTEGER;
      },
    ],
    [
      'free counter',
      (g) => {
        player(g, 'e').freeForcesRevived = -1;
      },
    ],
  ];
  for (const [label, mutate] of cases) {
    const bad = json(captured);
    mutate(bad);
    const before = structuredClone(bad);
    assert.throws(
      () => quoteRevivalResume(bad, 'finish'),
      RevivalResumeError,
      label,
    );
    assert.deepEqual(bad, before, label);
  }
});
void test('Axlotl and immediate income corruption rejects but genuine earlier decision remains a boundary', () => {
  const { captured } = declaration('forces');
  captured.techTokens = createTechTokens(captured.players);
  for (const mutate of [
    (g: Game) => {
      g.techTokens!.axlotl.owner = 'absent';
    },
    (g: Game) => {
      g.techTokens!.heighliners = null as never;
    },
    (g: Game) => {
      g.techTokens!.axlotl.spice = -1;
    },
    (g: Game) => {
      g.revivalFreeIncome = { e: -1 };
    },
  ]) {
    const bad = json(captured);
    mutate(bad);
    const before = structuredClone(bad);
    assert.equal(quoteRevivalResume(bad, 'stop').outcome, 'decision');
    assert.throws(() => quoteRevivalResume(bad, 'finish'), RevivalResumeError);
    assert.deepEqual(bad, before);
  }
});
void test('legacy unknown free usage remains unknown; impossible leader/Emperor custody rejects', () => {
  const { captured } = declaration('forces');
  player(captured, 'e').revived = 1;
  delete player(captured, 'e').freeForcesRevived;
  assert.equal(quoteRevivalResume(captured, 'finish').outcome, 'revive');
  const state = finishState(captured);
  observed.finishRevival(state);
  assert.equal(player(state, 'e').freeForcesRevived, undefined);
  for (const kind of ['native', 'kwisatz', 'foreign', 'extra'] as const) {
    const { captured: bad } = declaration(kind);
    if (kind === 'native') player(bad, 'a').leaders[0].capturedBy = 'e';
    if (kind === 'kwisatz') player(bad, 'a').kwisatz!.dead = false;
    if (kind === 'foreign') player(bad, 't').leaders[0].dead = false;
    if (kind === 'extra') bad.emperorExtra.a = Number.MAX_SAFE_INTEGER;
    assert.throws(
      () => quoteRevivalResume(bad, 'finish'),
      RevivalResumeError,
      kind,
    );
  }
});

void test('actual printed and BG cancellation of reactive La La La reject corrupted unchanged revival before cost', () => {
  for (const form of ['printed', 'converted'] as const) {
    let g = fixture();
    const i = g.deck.findIndex((c) => c.name === 'La La La');
    assert.ok(i >= 0);
    const card = g.deck.splice(i, 1)[0];
    player(g, 'c').hand.push(card);
    g = act(g, 'e', { type: 'revive', amount: 3 });
    assert.equal(g.decision?.kind, 'choamFreeRevival');
    g = act(g, 'c', { type: 'card', card: card.id, mode: 'choam' });
    assert.equal(g.response?.kind, 'choamWorthless');
    const actor = form === 'printed' ? 'e' : 'b';
    const cost = player(g, actor).hand.find((c) =>
      form === 'printed' ? c.effect === 'karama' : c.kind === 'worthless',
    )!;
    for (const mutate of [
      (bad: Game) => {
        bad.pendingRevival!.cost = 0;
      },
      (bad: Game) => {
        bad.pendingRevival!.amount = 4;
      },
      (bad: Game) => {
        bad.pendingRevival!.checks = null as never;
      },
      (bad: Game) => {
        player(bad, 'e').elites = {
          tanks: 9,
          reserves: 0,
          forces: {},
          revived: 0,
        };
      },
    ]) {
      const bad = json(g);
      mutate(bad);
      const before = structuredClone(bad),
        rng = randomCalls;
      assert.throws(
        () => act(bad, actor, { type: 'card', mode: 'cancel', card: cost.id }),
        observed.RuleError,
      );
      assert.deepEqual(bad, before);
      assert.equal(randomCalls, rng);
    }
    const paid = act(g, actor, { type: 'card', mode: 'cancel', card: cost.id });
    const done = allow(paid);
    assert.equal(done.discard.filter((c) => c.id === cost.id).length, 1);
    assert.equal(player(done, 'e').revived, 3);
    assert.equal(player(done, 'e').spice, 36);
    assert.equal(player(done, 't').spice, 45);
  }
});
