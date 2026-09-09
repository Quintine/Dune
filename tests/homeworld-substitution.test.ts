import test from 'node:test';
import assert from 'node:assert/strict';
import {
  quoteHomeworldSubstitution,
  type HomeworldSubstitutionRequest,
} from '../game/homeworld-substitution';
import {
  quoteHomeworldCombatLoss,
  type HomeworldCombatLossContext,
} from '../game/homeworld-combat-loss';
import { createHomeworldCustody } from '../game/homeworld-custody';
import { quoteIxSubstitutionCancellation } from '../game/ix-substitution-cancellation';
import { createGame, newPlayer } from '../game/engine';
import { baseDeck } from '../game/cards';
import { TERRITORIES } from '../game/board';

function fixture(native: boolean, advanced: boolean) {
  const context: HomeworldCombatLossContext = {
    advanced,
    players: [
      {
        id: 'i',
        faction: 'ixians',
        reserves: native ? 10 : 4,
        eliteReserves: native ? 4 : 2,
        tanks: 0,
        eliteTanks: 0,
        battleLosses: 0,
        boardForces: { normal: 7, elite: 3 },
      },
      {
        id: 'a',
        faction: 'atreides',
        reserves: 8,
        eliteReserves: 0,
        tanks: 2,
        eliteTanks: 0,
        battleLosses: 2,
        boardForces: { normal: 10, elite: 0 },
      },
    ],
  };
  const custody = createHomeworldCustody(context);
  if (!native)
    custody.visitors['homeworld:atreides'] = { i: { normal: 4, elite: 2 } };
  const location = native ? 'homeworld:ixians' : 'homeworld:atreides';
  const losses = quoteHomeworldCombatLoss(context, custody, {
    location,
    player: 'i',
    losses: { normal: 2, elite: 2 },
  });
  return {
    context: { advanced, players: losses.players },
    custody: losses.custody,
    location,
  };
}
for (const native of [true, false])
  for (const advanced of [true, false]) {
    void test(`${advanced ? 'Advanced' : 'Basic'} ${native ? 'native' : 'visiting'} Ixian substitution exchanges only exact types at its battle location`, () => {
      const state = fixture(native, advanced);
      const before = structuredClone(state);
      const request = {
        location: state.location,
        player: 'i',
        amount: 2,
        cyborgsLost: 2,
      };
      const q = quoteHomeworldSubstitution(
        state.context,
        state.custody,
        request,
      );
      const own = q.players[0];
      assert.equal(own.tanks, 4);
      assert.equal(own.eliteTanks, 0);
      assert.equal(own.battleLosses, 4);
      assert.equal(own.reserves, state.context.players[0].reserves);
      assert.equal(
        own.eliteReserves,
        state.context.players[0].eliteReserves + (native ? 2 : 0),
      );
      assert.deepEqual(own.boardForces, state.context.players[0].boardForces);
      assert.deepEqual(q.players[1], state.context.players[1]);
      assert.equal(q.receipt.after.normal, q.receipt.before.normal - 2);
      assert.equal(q.receipt.after.elite, q.receipt.before.elite + 2);
      assert.deepEqual(JSON.parse(JSON.stringify(q)), q);
      assert.deepEqual(state, before);
      // Quotes expose detached resource data, including the unchanged opponents.
      own.boardForces.normal = 0;
      q.players[1].boardForces.normal = 0;
      q.receipt.before.normal = 0;
      assert.deepEqual(state, before);
    });
  }

void test('cannot recover older Cyborg deaths, substitute from elsewhere, or exceed this battle allowance', () => {
  const state = fixture(false, true);
  const request = {
    location: state.location,
    player: 'i',
    amount: 1,
    cyborgsLost: 1,
  };
  const invalid: HomeworldSubstitutionRequest[] = [
    { ...request, amount: 2 },
    { ...request, amount: 0 },
    { ...request, amount: -1 },
    { ...request, amount: 0.5 },
    { ...request, cyborgsLost: 0 },
    { ...request, cyborgsLost: 3 },
    { ...request, cyborgsLost: 8 },
    { ...request, cyborgsLost: NaN },
    { ...request, location: 'homeworld:atreides:0' },
    { ...request, location: 'arrakeen:10' },
    { ...request, player: 'a' },
  ];
  for (const input of invalid) {
    const before = structuredClone(state);
    assert.throws(() =>
      quoteHomeworldSubstitution(state.context, state.custody, input),
    );
    assert.deepEqual(state, before);
  }
  // Cyborgs in Tanks are necessary, but the named battle's allowance still caps recovery.
  const q = quoteHomeworldSubstitution(state.context, state.custody, request);
  assert.equal(q.players[0].eliteTanks, 1);
  assert.equal(q.players[0].tanks, 4);
});

void test('validates every physical pool and does not temporarily overflow cumulative battle loss history', () => {
  const state = fixture(true, true);
  state.context.players[0].battleLosses = Number.MAX_SAFE_INTEGER;
  const request = {
    location: state.location,
    player: 'i',
    amount: 2,
    cyborgsLost: 2,
  };
  assert.equal(
    quoteHomeworldSubstitution(state.context, state.custody, request).players[0]
      .battleLosses,
    Number.MAX_SAFE_INTEGER,
  );
  const corrupt = structuredClone(state);
  corrupt.context.players[1].boardForces.normal++;
  const before = structuredClone(corrupt);
  assert.throws(() =>
    quoteHomeworldSubstitution(corrupt.context, corrupt.custody, request),
  );
  assert.deepEqual(corrupt, before);
  const noHistory = structuredClone(state);
  noHistory.context.players[0].battleLosses = 1;
  assert.throws(() =>
    quoteHomeworldSubstitution(noHistory.context, noHistory.custody, request),
  );
});

function cancellation() {
  const g = createGame('IXHOMEQUOTE', newPlayer('i', 'Ixians', 'ixians'), true);
  g.players.push(newPlayer('a', 'Atreides', 'atreides'));
  const card = baseDeck().find((card) => card.kind === 'shield')!;
  g.players[0].hand = [card];
  Object.assign(g, {
    status: 'playing',
    phase: 6,
    turn: 2,
    battle: null,
    lastBattle: ['i', 'a'],
    lastBattleContext: {
      event: 'ix-home',
      turn: 2,
      territory: 'homeworld:atreides',
      combatants: ['i', 'a'],
      winner: 'i',
      result: 'normal',
    },
    pendingIxSubstitution: {
      player: 'i',
      territory: 'homeworld:atreides',
      losses: { 'homeworld:atreides': 2 },
      sources: { 'homeworld:atreides': 1 },
      recover: { 'homeworld:atreides': 1 },
      cards: [card.id],
      homeworld: {
        pool: { normal: 2, elite: 0 },
        cyborgsLost: 2,
        eliteTanks: 2,
        normalTanks: 2,
        battleLosses: 4,
      },
    },
  });
  return {
    ...g,
    territories: TERRITORIES,
    physicalCards: [card],
    combatLocations: [{ id: 'homeworld:atreides', kind: 'homeworld' as const }],
  };
}

void test('Homeworld Karama cancellation retains the canonical location and detached winner-card cleanup', () => {
  const state = JSON.parse(JSON.stringify(cancellation())) as ReturnType<
    typeof cancellation
  >;
  const before = structuredClone(state);
  const q = quoteIxSubstitutionCancellation(state, {
    kind: 'ixSubstitution',
    owner: 'i',
    passed: [],
  });
  assert.equal(q?.territory, 'homeworld:atreides');
  assert.equal(q?.context.kind, 'existing');
  assert.deepEqual(q?.decision, {
    kind: 'battleCards',
    player: 'i',
    territory: 'homeworld:atreides',
    cards: state.pendingIxSubstitution!.cards,
  });
  q!.decision!.cards.push('detached');
  assert.deepEqual(state, before);
});

void test('Homeworld cancellation rejects fabricated sectors, other homes, mismatched history and unregistered worlds', () => {
  const mutations: ((state: ReturnType<typeof cancellation>) => void)[] = [
    (g) => {
      g.pendingIxSubstitution!.sources = { 'homeworld:atreides:0': 1 };
    },
    (g) => {
      g.pendingIxSubstitution!.recover = { 'homeworld:ixians': 1 };
    },
    (g) => {
      g.pendingIxSubstitution!.losses = { 'homeworld:atreides:0': 2 };
    },
    (g) => {
      g.pendingIxSubstitution!.sources = {
        'homeworld:atreides': 1,
        'homeworld:ixians': 1,
      };
    },
    (g) => {
      g.pendingIxSubstitution!.recover = { 'homeworld:atreides': 3 };
      g.pendingIxSubstitution!.sources = { 'homeworld:atreides': 3 };
    },
    (g) => {
      g.lastBattleContext!.territory = 'homeworld:ixians';
    },
    (g) => {
      g.combatLocations = [];
    },
  ];
  for (const mutate of mutations) {
    const state = cancellation();
    mutate(state);
    const before = structuredClone(state);
    assert.throws(() =>
      quoteIxSubstitutionCancellation(state, {
        kind: 'ixSubstitution',
        owner: 'i',
        passed: [],
      }),
    );
    assert.deepEqual(state, before);
  }
});

void test('ordinary cancellation retains Arrakis sector validation and never accepts a bare territory as a force key', () => {
  const state = cancellation();
  state.combatLocations = [];
  state.lastBattleContext!.territory = 'arrakeen';
  state.pendingIxSubstitution = {
    player: 'i',
    territory: 'arrakeen',
    cards: state.pendingIxSubstitution!.cards,
    losses: { 'arrakeen:10': 2 },
    sources: { 'arrakeen:10': 1 },
    recover: { 'arrakeen:10': 1 },
  };
  const quote = () =>
    quoteIxSubstitutionCancellation(state, {
      kind: 'ixSubstitution',
      owner: 'i',
      passed: [],
    });
  assert.equal(quote()?.territory, 'arrakeen');
  for (const key of [
    'arrakeen',
    'arrakeen:0',
    'arrakeen:11',
    'homeworld:atreides',
  ]) {
    state.pendingIxSubstitution.sources = { [key]: 1 };
    const before = structuredClone(state);
    assert.throws(quote);
    assert.deepEqual(state, before);
  }
});
