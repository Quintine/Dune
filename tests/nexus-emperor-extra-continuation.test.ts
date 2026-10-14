import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  joinGame,
  newPlayer,
  type Game,
  type Player,
} from '../game/engine';
import {
  createNexusCards,
  discardNexusCard,
  drawNexusCard,
} from '../game/nexus-cards';
import { createTechTokens } from '../game/tech-tokens';
import {
  createEmperorNexusRevival,
  emperorNexusEvent,
  emperorNexusSignature,
  settleEmperorNexusRevival,
  type NexusEmperorRevival,
  type NexusEmperorRevivalRequest,
} from '../game/nexus-emperor-secret-ally';
import { newRevivalRules, type PendingRevival } from '../game/revival';
import { quoteRevivalResume, RevivalResumeError } from '../game/revival-resume';
import {
  continuationCustody,
  quoteRevivalCancellation,
  RevivalCancellationError,
} from '../game/revival-cancellation';
import {
  createHomeworldCustody,
  type HomeworldCustody,
} from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import {
  quoteHomeworldRevivalDeployment,
  type HomeworldRevivalDeploymentGroup,
  type HomeworldRevivalDeploymentSource,
} from '../game/homeworld-revival-deployment';
import {
  makeHomeworldRevivalProgress,
  makeHomeworldRevivalReturn,
  validateHomeworldRevivalReturn,
} from '../game/homeworld-revival-return';

const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** Resolved-facts unit context, not a native gameplay chronology. Nexus custody
 * still uses the original inventory/draw/discard APIs and the real source receipt. */
function fixture(
  options: { advanced?: boolean; tleilaxu?: boolean; consumed?: boolean; declared?: boolean; ordinaryUsed?: number } = {},
) {
  const advanced = options.advanced ?? false;
  const g = createGame(
    'NEXUSEMPEROREXTRA',
    newPlayer('p', 'Fremen', 'fremen'),
    advanced,
    options.tleilaxu ? ['ix'] : [],
  );
  joinGame(g, newPlayer('a', 'Atreides', 'atreides'));
  joinGame(g, newPlayer('h', 'Harkonnen', 'harkonnen'));
  if (options.tleilaxu) joinGame(g, newPlayer('t', 'Tleilaxu', 'tleilaxu'));
  Object.assign(g, {
    status: 'playing',
    phase: 4,
    turn: 2,
    order: g.players.map((p) => p.id),
    revivalRules: newRevivalRules(),
    freeRevival: [],
  });
  for (const p of g.players)
    Object.assign(p, { hand: [], spice: 40, tanks: 10, reserves: 10, forces: {} });
  player(g, 'p').revived = options.ordinaryUsed ?? 0;
  player(g, 'p').freeForcesRevived = options.ordinaryUsed ?? 0;
  let cards = createNexusCards(g.players, () => 0.5);
  cards.deck = ['emperor', ...cards.deck.filter((card) => card !== 'emperor')];
  cards = drawNexusCard(cards, 'p', g.players, () => 0);
  g.nexusCards = { cards, phase: null };
  const receipt = createEmperorNexusRevival(g, 'p', 0);
  if (options.declared !== false) {
    g.nexusEmperorSecretHistory = [receipt];
    g.nexusEmperorSecretEvents = [receipt.event];
    if (options.consumed !== false)
      g.nexusCards.cards = discardNexusCard(g.nexusCards.cards!, 'p', g.players);
  }
  return { g, receipt };
}
function pending(receipt: NexusEmperorRevivalRequest): PendingRevival {
  return {
    player: 'p',
    kind: 'forces',
    amount: 3,
    elite: receipt.elite,
    free: 3,
    cost: 0,
    normalCost: 0,
    checks: [],
    nexusEmperorEvent: receipt.event,
  };
}

void test('the requested source quotes the original stop and finish continuations without repricing', () => {
  const advanced = fixture({ advanced: true, tleilaxu: true });
  advanced.g.techTokens = createTechTokens(advanced.g.players);
  const stop = json(advanced.g);
  const stopQuote = quoteRevivalResume(
    { ...advanced.g, pendingRevival: pending(advanced.receipt) },
    'stop',
  );
  assert.equal(stopQuote.outcome, 'decision');
  assert.deepEqual(json(advanced.g), stop, 'quoting changes nothing');

  const finishQuote = quoteRevivalResume(
    { ...advanced.g, pendingRevival: pending(advanced.receipt) },
    'finish',
  );
  assert.equal(finishQuote.outcome, 'revive');
  assert.deepEqual(finishQuote.freeIncome, { player: 'p', turn: 2 });
  assert.deepEqual(finishQuote.techIncome, {
    id: 'axlotl',
    owner: 't',
    spice: 1,
    triggeredTurn: 2,
  });
  assert.deepEqual(finishQuote.nextResponse, {
    kind: 'revivalIncome',
    owner: 't',
    recipient: 'p',
    amount: 1,
    passed: [],
  });
  // The fixed grant is exactly three free counters at no ordinary cost.
  assert.equal(finishQuote.pending.amount, 3);
  assert.equal(finishQuote.pending.free, 3);
  assert.equal(finishQuote.pending.cost, 0);
  assert.equal(finishQuote.pending.normalCost, 0);
});

void test('ordinary caps, blocks and Recruits state never block or reprice the independent three', () => {
  const { g, receipt } = fixture({ ordinaryUsed: 20 });
  const state = structuredClone({
    p: player(g, 'p'),
    spice: player(g, 'p').spice,
  });
  Object.assign(g, {
    revivalRules: {
      ...newRevivalRules(),
      limitBlocked: true,
      freeBlocked: ['p'],
    },
    freeRevival: ['p'],
    recruits: { turn: g.turn, player: 'p', card: 'ecaz-recruits' },
    emperorExtra: { p: 0 },
  });
  const before = json(g);
  const quote = quoteRevivalResume({ ...g, pendingRevival: pending(receipt) }, 'finish');
  assert.equal(quote.outcome, 'revive');
  assert.deepEqual(json(g), before, 'no counter, wallet or rule state moves');
  assert.equal(player(g, 'p').revived, 20);
  assert.equal(player(g, 'p').freeForcesRevived, 20);
  assert.equal(g.emperorExtra!.p, 0, 'the native Emperor-extra allowance is untouched');
  assert.equal(player(g, 'p').spice, state.spice, 'no ordinary price is charged');
  assert.equal(player(g, 'p').tanks, 10, 'the physical Tanks move only on the real return');
  continuationCustody({ ...g, pendingRevival: null }, player(g, 'p'), pending(receipt));
});

void test('native physical and typed caps still apply to the extra return', () => {
  const { g, receipt } = fixture();
  const p = player(g, 'p');
  p.elites = { reserves: 5, tanks: 2, forces: {}, revived: 0 };
  p.tanks = 4;
  const extra = { ...pending(receipt), elite: 3 };
  assert.throws(
    () => continuationCustody({ ...g, pendingRevival: null }, p, extra),
    /ordinary and elite revival groups/,
  );
  p.tanks = 2;
  assert.throws(
    () => continuationCustody({ ...g, pendingRevival: null }, p, pending(receipt)),
    /no longer in the tanks/,
  );
});

void test('malformed, stale, foreign, missing, unconsumed and outside-request sources are rejected immutably', () => {
  const base = fixture();
  const state = json(base.g);
  const cases: ((g: Game, receipt: NexusEmperorRevivalRequest) => PendingRevival)[] = [
    (g, receipt) => ({ ...pending(receipt), amount: 2 }),
    (g, receipt) => ({ ...pending(receipt), free: 2 }),
    (g, receipt) => ({ ...pending(receipt), elite: 1 }),
    (g, receipt) => ({ ...pending(receipt), cost: 1 }),
    (g, receipt) => ({ ...pending(receipt), player: 'a' }),
    (g, receipt) => ({ ...pending(receipt), payer: 'a' }),
    (g, receipt) => ({ ...pending(receipt), emperorExtra: true }),
    (g, receipt) => ({ ...pending(receipt), nexusEmperorEvent: receipt.event + 'x' }),
    (g) => {
      g.nexusEmperorSecretHistory = undefined;
      g.nexusEmperorSecretEvents = undefined;
      return pending(base.receipt);
    },
    (g) => {
      g.nexusEmperorSecretHistory![0].signature += 'x';
      return pending(base.receipt);
    },
    (g) => {
      g.nexusEmperorSecretHistory![0].sequence = 1;
      return pending(base.receipt);
    },
    (g) => {
      g.nexusEmperorSecretHistory![0].elite = 1;
      return pending(base.receipt);
    },
    (g) => {
      player(g, 'a').ally = 'p';
      player(g, 'p').ally = 'a';
      return pending(base.receipt);
    },
    (g) => {
      player(g, 'p').tanks = 9;
      return pending(base.receipt);
    },
    (g) => {
      player(g, 'h').faction = 'emperor';
      return pending(base.receipt);
    },
  ];
  for (const build of cases) {
    const g = json(base.g);
    const request = build(g, json(base.receipt));
    const snapshot = json(g);
    assert.throws(
      () => quoteRevivalResume({ ...g, pendingRevival: request }, 'finish'),
      RevivalResumeError,
    );
    assert.deepEqual(json(g), snapshot, 'a rejected source mutates nothing');
  }
  const unconsumed = fixture({ consumed: false });
  assert.throws(
    () =>
      quoteRevivalResume(
        { ...unconsumed.g, pendingRevival: pending(unconsumed.receipt) },
        'finish',
      ),
    /consumed physical card/,
  );
  const stale: NexusEmperorRevivalRequest = {
    ...json(base.receipt),
    turn: 1,
    event: emperorNexusEvent(1, 4, 'p', 0),
    signature: '',
  };
  stale.signature = emperorNexusSignature(stale);
  const staleGame = json(base.g);
  staleGame.nexusEmperorSecretHistory = [stale];
  staleGame.nexusEmperorSecretEvents = [stale.event];
  assert.throws(
    () =>
      quoteRevivalResume(
        { ...staleGame, pendingRevival: pending(stale) },
        'finish',
      ),
    RevivalResumeError,
  );
  assert.deepEqual(json(base.g), state, 'the fixture survives every rejected read');
});

void test('a settled returned or denied source no longer authorizes another pending revival', () => {
  const returned = fixture();
  const p = player(returned.g, 'p');
  p.tanks -= 3;
  p.reserves += 3;
  returned.g.nexusEmperorSecretHistory![0] = settleEmperorNexusRevival(
    returned.g,
    json(returned.g.nexusEmperorSecretHistory![0]),
    'returned',
  );
  assert.throws(
    () =>
      quoteRevivalResume(
        { ...returned.g, pendingRevival: pending(returned.receipt) },
        'finish',
      ),
    RevivalResumeError,
  );
  const denied = fixture();
  denied.g.nexusEmperorSecretHistory![0] = settleEmperorNexusRevival(
    denied.g,
    json(denied.g.nexusEmperorSecretHistory![0]),
    'denied',
  );
  assert.throws(
    () =>
      quoteRevivalResume(
        { ...denied.g, pendingRevival: pending(denied.receipt) },
        'finish',
      ),
    RevivalResumeError,
  );
});

void test('ordinary benefit cancellations do not reach the independent extra source', () => {
  const { g, receipt } = fixture({ advanced: true, tleilaxu: true });
  for (const kind of ['revivalLimit', 'revivalDiscount'] as const) {
    const request = pending(receipt);
    const snapshot = json(g);
    assert.throws(
      () =>
        quoteRevivalCancellation(
          { ...g, pendingRevival: request },
          { kind, owner: 't', recipient: 'p' },
        ),
      RevivalCancellationError,
    );
    assert.deepEqual(json(g), snapshot);
  }
});

void test('ordinary free and paid requests keep their original continuation', () => {
  const { g } = fixture({ declared: false });
  const ordinary: PendingRevival = {
    player: 'p',
    kind: 'forces',
    amount: 3,
    elite: 0,
    free: 3,
    cost: 0,
    normalCost: 0,
    checks: [],
  };
  assert.equal(
    quoteRevivalResume({ ...g, pendingRevival: ordinary }, 'finish').outcome,
    'revive',
  );
  player(g, 'p').tanks = 2;
  assert.equal(
    quoteRevivalResume({ ...g, pendingRevival: ordinary }, 'finish').outcome,
    'fremenLimit',
  );
});

type HomeworldFixture = {
  advanced: boolean;
  players: Player[];
  homeworlds: { custody: HomeworldCustody };
};
function homeworldFixture(
  faction: 'fremen' | 'tleilaxu',
  reserves: number,
): HomeworldFixture {
  const players = [
    newPlayer('p', 'Native', faction),
    newPlayer('v', 'Visitor', 'harkonnen'),
  ];
  players[0].reserves = reserves;
  if (faction === 'fremen')
    players[0].elites = { reserves: 0, tanks: 3, forces: {}, revived: 0 };
  const context = { advanced: true, players };
  return {
    ...context,
    homeworlds: { custody: createHomeworldCustody(homeworldContext(context)) },
  };
}
function deposited(
  before: HomeworldFixture,
  group: HomeworldRevivalDeploymentGroup,
) {
  const after = structuredClone(before);
  after.players[0].reserves += group.amount;
  if (after.players[0].elites) after.players[0].elites.reserves += group.elite;
  if (after.homeworlds.custody.salusa)
    after.homeworlds.custody.salusa.elite += group.elite;
  return after;
}

void test('the typed Homeworld source accepts the canonical exact-three free group for Fremen', () => {
  const sources: HomeworldRevivalDeploymentSource[] = [
    'normal',
    'emperorExtra',
    'ghola',
    'nexusTleilaxu',
    'nexusEmperor',
  ];
  for (const source of sources) {
    const before = homeworldFixture('fremen', 3);
    before.players[0].elites!.reserves = 1;
    const group = {
      amount: 3,
      elite: 2,
      free: source === 'normal' || source === 'nexusEmperor' ? 3 : 0,
    };
    const after = deposited(before, group);
    assert.deepEqual(
      quoteHomeworldRevivalDeployment(before, after, 'p', source, group),
      {
        kind: 'fedaykin',
        normal: 0,
        elite: 2,
        beforePopulation: 3,
        afterPopulation: 6,
        blocked: null,
      },
      source,
    );
  }
  // Tleilax free-revival deployment is still ordinary Free Revival only: the
  // independent zero-spice source never fabricates a Tleilaxu free return.
  for (const source of ['nexusEmperor', 'emperorExtra', 'ghola'] as const) {
    const before = homeworldFixture('tleilaxu', 9);
    const group = {
      amount: 3,
      elite: 0,
      free: source === 'nexusEmperor' ? 3 : 0,
    };
    assert.equal(
      quoteHomeworldRevivalDeployment(
        before,
        deposited(before, group),
        'p',
        source,
        group,
      ),
      null,
      source,
    );
  }
});

void test('the Homeworld source rejects any non-canonical group and a mismatched frame immutably', () => {
  const before = homeworldFixture('fremen', 3);
  before.players[0].elites!.reserves = 1;
  const group = { amount: 3, elite: 2, free: 3 };
  const after = deposited(before, group);
  const snapshot = structuredClone({ before, after });
  for (const bad of [
    { ...group, free: 2 },
    { ...group, free: 0 },
    { ...group, amount: 2 },
  ]) {
    assert.throws(() =>
      quoteHomeworldRevivalDeployment(
        before,
        deposited(before, bad),
        'p',
        'nexusEmperor',
        bad,
      ),
    );
  }
  assert.deepEqual({ before, after }, snapshot);

  const quote = quoteHomeworldRevivalDeployment(
    before,
    after,
    'p',
    'nexusEmperor',
    group,
  )!;
  const original = {
    event: 'nx-emperor-return',
    turn: 2,
    phase: 4,
    player: 'p',
    source: 'nexusEmperor' as const,
    group,
    quote,
  };
  const frame = makeHomeworldRevivalReturn(original);
  const g = {
    ...after,
    turn: 2,
    phase: 4,
    homeworldRevivalProgress: makeHomeworldRevivalProgress(frame),
  };
  validateHomeworldRevivalReturn(g, frame);
  validateHomeworldRevivalReturn(g, json(frame));
  for (const bad of [
    { ...group, free: 2 },
    { ...group, amount: 4 },
  ]) {
    const tampered = { ...json(frame), group: bad } as typeof frame;
    assert.throws(() => validateHomeworldRevivalReturn(g, tampered));
  }
  assert.throws(() =>
    makeHomeworldRevivalReturn({
      ...original,
      group: { amount: 3, elite: 0, free: 2 },
    }),
  );
});

void test('the stored extra receipt round-trips as strict requested evidence', () => {
  const { g, receipt } = fixture();
  const copy = json(receipt) as NexusEmperorRevival;
  assert.deepEqual(copy, receipt);
  assert.equal(copy.version, 2);
  assert.equal(copy.stage, 'requested');
  assert.equal(copy.after, null);
  assert.equal(copy.signature, emperorNexusSignature(copy));
  assert.equal(g.nexusEmperorSecretEvents![0], receipt.event);
});
