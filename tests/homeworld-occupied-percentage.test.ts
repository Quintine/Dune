import test from 'node:test';
import assert from 'node:assert/strict';
import type { Game } from '../game/engine';
import { HomeworldCustodyError } from '../game/homeworld-custody';
import { homeworldGameIntegrity } from '../game/homeworld-game';
import {
  allocateOccupiedPercentageReceipt, createOccupiedPercentageState, quoteOccupiedPercentageSource,
  validateOccupiedPercentageState,
  type OccupiedPercentageKind, type OccupiedPercentageQuote, type OccupiedPercentageSource,
  type OccupiedPercentageState,
} from '../game/homeworld-occupied-percentage';
import { occupiedIncomeFixture as originalIncomeFixture, observeControlledIncomePosition } from './fixture-homeworld-occupied-income';
import type { HomeworldId } from '../game/homeworld-cards';

const worlds: Record<OccupiedPercentageKind, HomeworldId> = {
  'emperor-treachery': 'kaitain', 'guild-shipping': 'junction',
  'richese-income': 'richese', 'fremen-collection': 'southern_hemisphere',
};
/** Labelled cash-only fixture redistribution conserves the original setup total
 * and keeps every payer solvent. Physical cards/forces/history remain original. */
function occupiedIncomeFixture(...args: Parameters<typeof originalIncomeFixture>) {
  const fixture = originalIncomeFixture(...args), game = fixture.game;
  const before = game.players.reduce((sum, player) => sum + player.spice, 0);
  const minimum: Record<string, number> = { native: 5, owner: 5, ally: 0, competitor: 11 };
  for (const receiver of game.players) {
    for (const donor of game.players) {
      if (receiver.id === donor.id) continue;
      const transfer = Math.min(Math.max(0, minimum[receiver.id] - receiver.spice),
        Math.max(0, donor.spice - minimum[donor.id]));
      donor.spice -= transfer;
      receiver.spice += transfer;
    }
    assert.ok(receiver.spice >= minimum[receiver.id], 'Original setup cash must fund the labelled source.');
  }
  assert.equal(game.players.reduce((sum, player) => sum + player.spice, 0), before);
  return fixture;
}
function actualSource(kind: OccupiedPercentageKind, amount: number, event = 'actual-source'): OccupiedPercentageSource {
  const base = { event, native: 'native', amount };
  if (kind === 'fremen-collection') return { ...base, kind, collection: {
    id: event, binding: 'completed original Collection credit proof', complete: true,
    collected: [{ id: 'actual-credit', amount }],
  } };
  const payment = { id: event, binding: 'original funded producer receipt', paid: amount,
    contributions: [{ payer: 'competitor', amount }], recipient: 'native' };
  if (kind === 'richese-income') return { ...base, kind, payment: { ...payment, received: amount } };
  return { ...base, kind, payment, nativeIncome: 'received' };
}
function balances(game: Game): Record<string, number> {
  return Object.fromEntries(game.players.map(player => [player.id, player.spice]));
}
/** Exercise exactly the parent's cash contract against real setup wallets:
 * payer debits occur before admission, then native/occupied cash is committed.
 * bankRetained stays in the Bank; quote/allocation never change any wallet. */
function commit(game: Game, quote: OccupiedPercentageQuote, ownAmount = quote.receipt.occupiedAmount) {
  const before = structuredClone({ game, state: quote.state });
  const result = quote.receipt.status === 'pending'
    ? allocateOccupiedPercentageReceipt(quote.state, game, 'owner', quote.receipt.source.event, ownAmount, quote.receipt.source)
    : { ...quote, credits: quote.receipt.credits };
  assert.deepEqual({ game, state: quote.state }, before);
  assert.equal(result.receipt.status, 'settled');
  game.players.find(player => player.id === result.receipt.source.native)!.spice += result.receipt.nativeRetained;
  for (const credit of result.credits) game.players.find(player => player.id === credit.player)!.spice += credit.amount;
  return result;
}

void test('each printed producer conserves odd/even/zero actual sources without touching original payer or physical custody', () => {
  for (const kind of Object.keys(worlds) as OccupiedPercentageKind[]) {
    for (const amount of [0, 1, 5, 8]) {
      const { game, cards } = occupiedIncomeFixture(worlds[kind], false, false);
      const original = actualSource(kind, amount), initial = balances(game);
      if (kind !== 'fremen-collection') game.players.find(player => player.id === 'competitor')!.spice -= amount;
      const paid = structuredClone({ game, original });
      const quote = quoteOccupiedPercentageSource(game, original, createOccupiedPercentageState());
      assert.deepEqual({ game, original }, paid, 'admission never charges a payer again');
      const done = commit(game, quote);
      const after = balances(game);
      assert.equal(after.native - initial.native, Math.ceil(amount / 2));
      assert.equal(after.owner - initial.owner, Math.floor(amount / 2));
      assert.equal(after.ally - initial.ally, 0);
      assert.equal(after.competitor, initial.competitor - (kind === 'fremen-collection' ? 0 : amount));
      assert.equal(done.receipt.nativeRetained + done.credits.reduce((sum, credit) => sum + credit.amount, 0) +
        done.receipt.bankRetained, amount);
      assert.equal(Object.values(after).reduce((sum, cash) => sum + cash, 0) -
        Object.values(initial).reduce((sum, cash) => sum + cash, 0), kind === 'fremen-collection' ? amount : 0);
      assert.deepEqual([...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand)].map(card => card.id).sort(), cards);
      homeworldGameIntegrity(game);
    }
  }
});

void test('Kaitain FAQ actual five-spice occupier purchase is debited once and returns three/two, including immediate ally splits', () => {
  for (const ownAmount of [2, 1, 0]) {
    const { game } = occupiedIncomeFixture('kaitain');
    const original = actualSource('emperor-treachery', 5);
    assert.equal(original.kind, 'emperor-treachery');
    if (original.kind !== 'emperor-treachery') throw new Error('Fixture source kind');
    const source: OccupiedPercentageSource = { ...original,
      payment: { ...original.payment, contributions: [{ payer: 'owner', amount: 5 }] } };
    const before = balances(game);
    game.players.find(player => player.id === 'owner')!.spice -= 5;
    const quote = quoteOccupiedPercentageSource(game, source, createOccupiedPercentageState());
    const done = commit(game, quote, ownAmount), after = balances(game);
    assert.equal(after.native - before.native, 3);
    assert.equal(after.owner - before.owner, -5 + ownAmount);
    assert.equal(after.ally - before.ally, 2 - ownAmount);
    assert.equal(done.credits.reduce((sum, credit) => sum + credit.amount, 0), 2);
    assert.equal(Object.values(after).reduce((sum, cash) => sum + cash, 0), Object.values(before).reduce((sum, cash) => sum + cash, 0));
  }
});

void test('Junction excludes actual Guild funding before rounding; Guild-only payment has no allocation', () => {
  for (const otherAmount of [0, 2, 5]) {
    const { game } = occupiedIncomeFixture('junction', false, false);
    const original = actualSource('guild-shipping', otherAmount);
    if (original.kind !== 'guild-shipping') throw new Error('Fixture source kind');
    const source: OccupiedPercentageSource = { ...original, payment: { ...original.payment, paid: otherAmount + 5,
      contributions: [{ payer: 'native', amount: 5 }, { payer: 'competitor', amount: otherAmount }] } };
    const before = balances(game);
    game.players.find(player => player.id === 'native')!.spice -= 5;
    game.players.find(player => player.id === 'competitor')!.spice -= otherAmount;
    const quote = quoteOccupiedPercentageSource(game, source, createOccupiedPercentageState());
    const done = commit(game, quote), after = balances(game);
    assert.equal(after.native - before.native, -5 + Math.ceil(otherAmount / 2));
    assert.equal(after.owner - before.owner, Math.floor(otherAmount / 2));
    assert.equal(after.competitor, before.competitor - otherAmount);
    assert.equal(Object.values(after).reduce((sum, cash) => sum + cash, 0) - Object.values(before).reduce((sum, cash) => sum + cash, 0), -5);
    if (otherAmount === 0) {
      assert.equal(quote.receipt.status, 'settled');
      assert.deepEqual(done.credits, []);
      assert.throws(() => allocateOccupiedPercentageReceipt(done.state, game, 'owner', source.event, 0, source), HomeworldCustodyError);
    }
  }
});

void test('Guild unresolved two odd contributions remain blocked, while a conserved even/odd original payment is reachable', () => {
  const { game } = occupiedIncomeFixture('junction', false, false);
  const original = actualSource('guild-shipping', 4);
  if (original.kind !== 'guild-shipping') throw new Error('Fixture source kind');
  const twoOdd: OccupiedPercentageSource = { ...original, payment: { ...original.payment,
    contributions: [{ payer: 'owner', amount: 1 }, { payer: 'competitor', amount: 3 }] } };
  const before = structuredClone(game);
  assert.throws(() => quoteOccupiedPercentageSource(game, twoOdd, createOccupiedPercentageState()), HomeworldCustodyError);
  assert.deepEqual(game, before);
  const supported: OccupiedPercentageSource = { ...original, amount: 5, payment: { ...original.payment, paid: 5,
    contributions: [{ payer: 'owner', amount: 2 }, { payer: 'competitor', amount: 3 }] } };
  const initial = balances(game);
  game.players.find(player => player.id === 'owner')!.spice -= 2;
  game.players.find(player => player.id === 'competitor')!.spice -= 3;
  commit(game, quoteOccupiedPercentageSource(game, supported, createOccupiedPercentageState()));
  const after = balances(game);
  assert.equal(after.native - initial.native, 3);
  assert.equal(after.owner - initial.owner, 0);
  assert.equal(after.competitor - initial.competitor, -3);
});

void test('Richese splits only actual native net received income, not gross sale or money routed elsewhere', () => {
  const { game } = occupiedIncomeFixture('richese', false, false);
  const original = actualSource('richese-income', 7);
  if (original.kind !== 'richese-income') throw new Error('Fixture source kind');
  const source: OccupiedPercentageSource = { ...original, payment: { ...original.payment, paid: 10,
    contributions: [{ payer: 'competitor', amount: 10 }], received: 7 } };
  const before = balances(game);
  game.players.find(player => player.id === 'competitor')!.spice -= 10;
  // The original producer, not this percentage helper, routed the other three.
  game.players.find(player => player.id === 'ally')!.spice += 3;
  commit(game, quoteOccupiedPercentageSource(game, source, createOccupiedPercentageState()));
  const after = balances(game);
  assert.equal(after.native - before.native, 4);
  assert.equal(after.owner - before.owner, 3);
  assert.equal(after.ally - before.ally, 3);
  assert.equal(after.competitor - before.competitor, -10);
  assert.equal(Object.values(after).reduce((sum, cash) => sum + cash, 0), Object.values(before).reduce((sum, cash) => sum + cash, 0));
  for (const wrong of [
    { ...source, amount: 10 },
    { ...source, payment: { ...source.payment, recipient: 'owner' } },
    { ...source, payment: { ...source.payment, received: 11 } },
  ]) assert.throws(() => quoteOccupiedPercentageSource(game, wrong, createOccupiedPercentageState()), HomeworldCustodyError);
});

void test('Southern Hemisphere rounds the completed actual Collection total once, not odd piles independently', () => {
  const { game } = occupiedIncomeFixture('southern_hemisphere');
  const source: OccupiedPercentageSource = { kind: 'fremen-collection', native: 'native', event: 'collection-total', amount: 5,
    collection: { id: 'collection-total', binding: 'all settled native Collection legs', complete: true,
      collected: [{ id: 'first-pile', amount: 1 }, { id: 'shared-allocation', amount: 1 }, { id: 'last-credit', amount: 3 }] } };
  const before = balances(game);
  const quote = quoteOccupiedPercentageSource(game, source, createOccupiedPercentageState());
  const done = commit(game, quote, 1), after = balances(game);
  assert.equal(after.native - before.native, 3);
  assert.equal(after.owner - before.owner, 1);
  assert.equal(after.ally - before.ally, 1);
  assert.equal(Object.values(after).reduce((sum, cash) => sum + cash, 0) - Object.values(before).reduce((sum, cash) => sum + cash, 0), 5);
  const another = actualSource('fremen-collection', 3, 'another-pile-event');
  assert.throws(() => quoteOccupiedPercentageSource(game, another, done.state), HomeworldCustodyError);
  const wrongTotal = { ...source, amount: 3 };
  assert.throws(() => quoteOccupiedPercentageSource(game, wrongTotal, createOccupiedPercentageState()), HomeworldCustodyError);
  const unfinished = { ...source, collection: { ...source.collection, complete: false } } as unknown as OccupiedPercentageSource;
  assert.throws(() => quoteOccupiedPercentageSource(game, unfinished, createOccupiedPercentageState()), HomeworldCustodyError);
});

void test('native Karama does not cancel printed occupied percentage receipts or manufacture native/bank cash', () => {
  for (const kind of ['emperor-treachery', 'guild-shipping'] as const) {
    const { game } = occupiedIncomeFixture(worlds[kind], false, false);
    const original = actualSource(kind, 5);
    if (original.kind !== 'emperor-treachery' && original.kind !== 'guild-shipping') throw new Error('Fixture source kind');
    const source: OccupiedPercentageSource = { ...original, nativeIncome: 'karama-canceled' };
    const before = balances(game);
    game.players.find(player => player.id === 'competitor')!.spice -= 5;
    const done = commit(game, quoteOccupiedPercentageSource(game, source, createOccupiedPercentageState()));
    const after = balances(game);
    assert.equal(after.native - before.native, 0);
    assert.equal(after.owner - before.owner, 2);
    assert.equal(after.competitor - before.competitor, -5);
    assert.equal(done.receipt.bankRetained, 3);
    assert.equal(Object.values(after).reduce((sum, cash) => sum + cash, 0) - Object.values(before).reduce((sum, cash) => sum + cash, 0), -3);
  }
});

void test('outside the original fresh occupation profile physical-low Kaitain/Junction keep their existing bank remainder', () => {
  for (const kind of ['emperor-treachery', 'guild-shipping'] as const) {
    const { game } = occupiedIncomeFixture(worlds[kind]);
    delete game.homeworldOccupationPreview;
    const source = actualSource(kind, 5), before = balances(game);
    game.players.find(player => player.id === 'competitor')!.spice -= 5;
    const quote = quoteOccupiedPercentageSource(game, source, createOccupiedPercentageState());
    assert.equal(quote.receipt.status, 'settled');
    const done = commit(game, quote), after = balances(game);
    assert.equal(after.native - before.native, 3);
    assert.equal(after.owner - before.owner, 0);
    assert.equal(after.ally - before.ally, 0);
    assert.equal(done.receipt.bankRetained, 2);
    assert.equal(Object.values(after).reduce((sum, cash) => sum + cash, 0) - Object.values(before).reduce((sum, cash) => sum + cash, 0), -2);
  }
});

void test('JSON pending and completed ledger preserve source/beneficiary and reject re-admission, replay and changed provenance', () => {
  const { game } = occupiedIncomeFixture('richese');
  const source = actualSource('richese-income', 11), initial = balances(game);
  game.players.find(player => player.id === 'competitor')!.spice -= 11;
  const quote = quoteOccupiedPercentageSource(game, source, createOccupiedPercentageState());
  const resumedGame: Game = JSON.parse(JSON.stringify(game));
  const pending: OccupiedPercentageState = JSON.parse(JSON.stringify(quote.state));
  const before = structuredClone({ game: resumedGame, state: pending });
  assert.throws(() => quoteOccupiedPercentageSource(resumedGame, source, pending), HomeworldCustodyError);
  assert.throws(() => allocateOccupiedPercentageReceipt(pending, resumedGame, 'owner', source.event, 3,
    { ...source, event: 'different-source' }), HomeworldCustodyError);
  if (source.kind !== 'richese-income') throw new Error('Fixture source kind');
  for (const changed of [
    { ...source, payment: { ...source.payment, binding: 'different original lot' } },
    { ...source, payment: { ...source.payment, contributions: [{ payer: 'owner', amount: 11 }] } },
    { ...source, amount: 9, payment: { ...source.payment, received: 9 } },
  ]) assert.throws(() => allocateOccupiedPercentageReceipt(pending, resumedGame, 'owner', source.event, 3, changed), HomeworldCustodyError);
  assert.deepEqual({ game: resumedGame, state: pending }, before);
  const done = commit(resumedGame, { receipt: pending.receipts[0], state: pending }, 3);
  const after = balances(resumedGame);
  assert.equal(after.native - initial.native, 6);
  assert.equal(after.owner - initial.owner, 3);
  assert.equal(after.ally - initial.ally, 2);
  const settled: OccupiedPercentageState = JSON.parse(JSON.stringify(done.state));
  validateOccupiedPercentageState(settled, resumedGame);
  const stableCash = balances(resumedGame);
  assert.throws(() => allocateOccupiedPercentageReceipt(settled, resumedGame, 'owner', source.event, 3, source), HomeworldCustodyError);
  assert.throws(() => quoteOccupiedPercentageSource(resumedGame, { ...source, event: 'new-event-same-payment' }, settled), HomeworldCustodyError);
  assert.deepEqual(balances(resumedGame), stableCash);
  const tampered: OccupiedPercentageState = { ...done.state, receipts: done.state.receipts.map((row, i) =>
    i === 0 ? { ...row, nativeRetained: row.nativeRetained + 1 } : row) };
  assert.throws(() => validateOccupiedPercentageState(tampered, resumedGame), HomeworldCustodyError);
});

void test('wrong actor/event/turn and invalid splits cannot consume a pending percentage receipt', () => {
  for (const allied of [false, true]) {
    const { game } = occupiedIncomeFixture('kaitain', false, allied);
    const source = actualSource('emperor-treachery', 9);
    const quote = quoteOccupiedPercentageSource(game, source, createOccupiedPercentageState());
    const before = structuredClone({ game, state: quote.state });
    for (const actor of ['native', 'ally', 'competitor'])
      assert.throws(() => allocateOccupiedPercentageReceipt(quote.state, game, actor, source.event, 4, source), HomeworldCustodyError);
    assert.throws(() => allocateOccupiedPercentageReceipt(quote.state, game, 'owner', 'stale-event', 4, source), HomeworldCustodyError);
    for (const amount of [-1, 5, 1.5, NaN, Infinity, ...(allied ? [] : [0, 3])])
      assert.throws(() => allocateOccupiedPercentageReceipt(quote.state, game, 'owner', source.event, amount, source), HomeworldCustodyError);
    assert.deepEqual({ game, state: quote.state }, before);
    const stale = structuredClone(game);
    stale.turn++;
    assert.throws(() => allocateOccupiedPercentageReceipt(quote.state, stale, 'owner', source.event, 4, source), HomeworldCustodyError);
    const initial = balances(game);
    commit(game, quote, 4);
    assert.equal(balances(game).owner - initial.owner, 4);
    assert.equal(balances(game).native - initial.native, 5);
  }
});

void test('changed reciprocal alliance, contest or native repopulation cannot replace the original frozen recipient', () => {
  for (const change of ['alliance', 'competitor', 'repopulation'] as const) {
    const { game, world } = occupiedIncomeFixture('richese');
    const source = actualSource('richese-income', 7);
    const quote = quoteOccupiedPercentageSource(game, source, createOccupiedPercentageState());
    if (change === 'alliance') game.players.find(player => player.id === 'ally')!.ally = null;
    else if (change === 'competitor') {
      game.homeworlds!.custody!.visitors[world].competitor = { normal: 1, elite: 0 };
      game.players.find(player => player.id === 'competitor')!.reserves--;
      observeControlledIncomePosition(game, 'labelled-second-foreign-garrison');
    } else {
      const native = game.players.find(player => player.id === 'native')!;
      native.reserves = 10;
      native.tanks -= 10;
      observeControlledIncomePosition(game, 'labelled-native-high-restored');
    }
    const before = structuredClone({ game, state: quote.state });
    assert.throws(() => allocateOccupiedPercentageReceipt(quote.state, game, 'owner', source.event, 2, source), HomeworldCustodyError);
    assert.deepEqual({ game, state: quote.state }, before);
    if (change !== 'alliance') {
      const unknown = quoteOccupiedPercentageSource(game, { ...source, event: 'blocked-new-actual-source' }, createOccupiedPercentageState());
      assert.equal(unknown.receipt.status, 'settled', 'no current-sole controller means no occupied share, not an ambiguous source');
      assert.equal(unknown.receipt.entitlement, null);
      assert.deepEqual(unknown.receipt.credits, []);
      assert.deepEqual(balances(game), balances(before.game));
      assert.throws(() => allocateOccupiedPercentageReceipt(unknown.state, game, 'competitor', unknown.receipt.source.event, 3,
        unknown.receipt.source), HomeworldCustodyError);
    }
    homeworldGameIntegrity(game);
  }
});

void test('Basic current-sole departure then return resumes the same observed source instead of a new epoch', () => {
  const { game, world } = occupiedIncomeFixture('richese');
  const source = actualSource('richese-income', 7);
  const quote = quoteOccupiedPercentageSource(game, source, createOccupiedPercentageState());
  const owner = game.players.find(player => player.id === 'owner')!;
  delete game.homeworlds!.custody!.visitors[world];
  owner.reserves++;
  observeControlledIncomePosition(game, 'labelled-original-owner-departure');
  const departed = quoteOccupiedPercentageSource(game, { ...source, event: 'departed-source' }, createOccupiedPercentageState());
  assert.equal(departed.receipt.status, 'settled', 'an empty world earns no occupied share rather than an ambiguous block');
  assert.equal(departed.receipt.entitlement, null);
  assert.deepEqual(departed.receipt.credits, []);
  assert.throws(() => allocateOccupiedPercentageReceipt(quote.state, game, 'owner', source.event, 2, source), HomeworldCustodyError);
  game.homeworlds!.custody!.visitors[world] = { owner: { normal: 1, elite: 0 } };
  owner.reserves--;
  observeControlledIncomePosition(game, 'labelled-original-owner-return');
  const resumed = allocateOccupiedPercentageReceipt(quote.state, game, 'owner', source.event, 2, source);
  assert.equal(resumed.receipt.status, 'settled');
  assert.equal(resumed.receipt.entitlement!.qualification, quote.receipt.entitlement!.qualification);
  assert.equal(resumed.receipt.entitlement!.occupier, 'owner');
  homeworldGameIntegrity(game);
});

void test('zero-share unknown entitlement completes through JSON without selecting a replacement or needing allocation', () => {
  const { game, world } = occupiedIncomeFixture('southern_hemisphere');
  game.homeworlds!.custody!.visitors[world].competitor = { normal: 1, elite: 0 };
  game.players.find(player => player.id === 'competitor')!.reserves--;
  observeControlledIncomePosition(game, 'labelled-zero-contested-world');
  for (const amount of [0, 1]) {
    const source = actualSource('fremen-collection', amount), before = balances(game);
    const quote = quoteOccupiedPercentageSource(game, source, createOccupiedPercentageState());
    const saved: OccupiedPercentageState = JSON.parse(JSON.stringify(quote.state));
    validateOccupiedPercentageState(saved, game);
    assert.equal(saved.receipts[0].status, 'settled');
    assert.equal(saved.receipts[0].entitlement, null);
    commit(game, { receipt: saved.receipts[0], state: saved });
    const after = balances(game);
    assert.equal(after.native - before.native, amount);
    assert.equal(after.owner - before.owner, 0);
    assert.equal(after.ally - before.ally, 0);
    assert.equal(after.competitor - before.competitor, 0);
    assert.throws(() => allocateOccupiedPercentageReceipt(saved, game, 'owner', source.event, 0, source), HomeworldCustodyError);
    assert.throws(() => quoteOccupiedPercentageSource(game, source, saved), HomeworldCustodyError);
  }
});

void test('malformed or unbacked paid provenance cannot manufacture a percentage source, including safe-integer limits', () => {
  const { game } = occupiedIncomeFixture('kaitain');
  const original = actualSource('emperor-treachery', 5);
  if (original.kind !== 'emperor-treachery') throw new Error('Fixture source kind');
  const state = createOccupiedPercentageState(), before = structuredClone({ game, state });
  const malformed: OccupiedPercentageSource[] = [
    ...[-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1].map(amount => ({ ...original, amount })),
    { ...original, native: 'owner' },
    { ...original, payment: { ...original.payment, recipient: 'owner' } },
    { ...original, payment: { ...original.payment, paid: 6 } },
    { ...original, payment: { ...original.payment, binding: '' } },
    { ...original, payment: { ...original.payment, contributions: [{ payer: 'missing-player', amount: 5 }] } },
    { ...original, payment: { ...original.payment, contributions: [{ payer: 'competitor', amount: 2 }, { payer: 'competitor', amount: 3 }] } },
    { ...original, payment: { ...original.payment, paid: Number.MAX_SAFE_INTEGER,
      contributions: [{ payer: 'owner', amount: Number.MAX_SAFE_INTEGER }, { payer: 'competitor', amount: 1 }] } },
  ];
  for (const source of malformed)
    assert.throws(() => quoteOccupiedPercentageSource(game, source, state), HomeworldCustodyError);
  assert.deepEqual({ game, state }, before);
  const initial = balances(game);
  game.players.find(player => player.id === 'competitor')!.spice -= 5;
  commit(game, quoteOccupiedPercentageSource(game, original, state), 1);
  const after = balances(game);
  assert.equal(after.native - initial.native, 3);
  assert.equal(after.owner - initial.owner, 1);
  assert.equal(after.ally - initial.ally, 1);
  assert.equal(after.competitor - initial.competitor, -5);
});
