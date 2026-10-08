import test from 'node:test';
import assert from 'node:assert/strict';
import type { Game } from '../game/engine';
import { HOMEWORLD_CARDS, type HomeworldId } from '../game/homeworld-cards';
import { homeworldGameIntegrity } from '../game/homeworld-game';
import { HomeworldCustodyError } from '../game/homeworld-custody';
import { occupiedHomeworldSardaukarStatus } from '../game/homeworld-occupied-defenses';
import { quoteStableHomeworldOccupation } from '../game/homeworld-stable-occupation';
import {
  beginHomeworldOccupiedIncome, homeworldOccupiedIncomeOffer, quoteHomeworldOccupiedIncomeChoice,
  type HomeworldOccupiedIncomeState,
} from '../game/homeworld-occupied-income';
import { occupiedIncomeFixture, observeControlledIncomePosition } from './fixture-homeworld-occupied-income';

const printed: Record<HomeworldId, number> = {
  caladan: 2, giedi_prime: 2, southern_hemisphere: 2, junction: 2, wallach_ix: 1,
  kaitain: 2, salusa_secundus: 0, ix: 2, tleilax: 2, tupile: 2, richese: 1, ecaz: 2, grumman: 2,
};

/** Exercise the returned BANK credit legs against real setup wallets. This is
 * the engine consumer contract, not personal-wallet forwarding or bribery. */
function settle(game: Game, state: HomeworldOccupiedIncomeState, ownAmount: number) {
  const row = state.queue[state.cursor];
  const before = structuredClone({ game, state });
  const result = quoteHomeworldOccupiedIncomeChoice(state, game, row.occupier, state.event, row.world, ownAmount);
  assert.deepEqual({ game, state }, before, 'quoting never mutates wallets or the pending receipt');
  for (const credit of result.credits) game.players.find(player => player.id === credit.player)!.spice += credit.amount;
  return result;
}

void test('printed BANK grants preserve all thirteen faces and Basic/Advanced sums, independent of percentage text', () => {
  for (const advanced of [false, true]) {
    let total = 0;
    for (const card of HOMEWORLD_CARDS) {
      if (!advanced && card.id === 'salusa_secundus') continue;
      const { game, world, cards } = occupiedIncomeFixture(card.id, advanced, false);
      const before = structuredClone(game);
      const state = beginHomeworldOccupiedIncome(game, `collection-${card.id}`);
      assert.deepEqual(game, before, 'Collection entry does not mint spice');
      assert.equal(state.queue.length, 1);
      assert.equal(state.queue[0].world, world);
      assert.equal(state.queue[0].card, card.id);
      assert.equal(state.queue[0].spice, printed[card.id]);
      const owner = game.players.find(player => player.id === 'owner')!;
      const balance = owner.spice;
      const result = settle(game, state, printed[card.id]);
      assert.deepEqual(result.credits, printed[card.id] ? [{ player: 'owner', amount: printed[card.id] }] : []);
      assert.equal(owner.spice - balance, printed[card.id]);
      assert.equal(result.state.receipts[0].status, 'settled');
      assert.equal(homeworldOccupiedIncomeOffer(result.state, game, 'owner'), null);
      assert.deepEqual([...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand)].map(card => card.id).sort(), cards);
      homeworldGameIntegrity(game);
      total += owner.spice - balance;
    }
    assert.equal(total, 22);
  }
});

void test('full, partial and zero own splits credit the named reciprocal ally directly from the Bank and conserve total', () => {
  for (const ownAmount of [2, 1, 0]) {
    const { game } = occupiedIncomeFixture();
    const state = beginHomeworldOccupiedIncome(game, 'collection-split');
    const owner = game.players.find(player => player.id === 'owner')!;
    const ally = game.players.find(player => player.id === 'ally')!;
    owner.spice = 0;
    const ownerBefore = owner.spice, allyBefore = ally.spice;
    const offer = homeworldOccupiedIncomeOffer(state, game, owner.id)!;
    assert.equal(offer.ally, ally.id);
    assert.equal(offer.minOwnAmount, 0);
    assert.equal(offer.maxOwnAmount, 2);
    const result = settle(game, state, ownAmount);
    assert.equal(owner.spice - ownerBefore, ownAmount);
    assert.equal(ally.spice - allyBefore, 2 - ownAmount);
    assert.equal(result.credits.reduce((sum, credit) => sum + credit.amount, 0), 2);
    assert.deepEqual(result.state.receipts[0], { world: state.queue[0].world, status: 'settled', ownAmount, credits: result.credits });
  }
});

void test('no ally permits only the full printed award; malformed amounts and actions reject without changing anything', () => {
  const { game, world } = occupiedIncomeFixture('caladan', false, false);
  const state = beginHomeworldOccupiedIncome(game, 'collection-bounds');
  const offer = homeworldOccupiedIncomeOffer(state, game, 'owner')!;
  assert.equal(offer.ally, null);
  assert.equal(offer.minOwnAmount, 2);
  assert.equal(homeworldOccupiedIncomeOffer(state, game, 'native'), null);
  const before = structuredClone({ game, state });
  for (const amount of [0, 1, -1, 3, 0.5, NaN, Infinity])
    assert.throws(() => quoteHomeworldOccupiedIncomeChoice(state, game, 'owner', state.event, world, amount), HomeworldCustodyError);
  for (const [actor, event, target] of [
    ['ally', state.event, world], ['native', state.event, world], ['owner', 'stale-event', world],
    ['owner', state.event, 'homeworld:guild'],
  ]) assert.throws(() => quoteHomeworldOccupiedIncomeChoice(state, game, actor, event, target, 2), HomeworldCustodyError);
  assert.deepEqual({ game, state }, before);
  assert.deepEqual(settle(game, state, 2).credits, [{ player: 'owner', amount: 2 }]);
});

void test('allied integer bounds, nonreciprocal alliance and alliance changes cannot reroute a frozen receipt', () => {
  const { game, world } = occupiedIncomeFixture();
  const state = beginHomeworldOccupiedIncome(game, 'collection-reciprocal');
  for (const amount of [-1, 3, 1.5, NaN])
    assert.throws(() => quoteHomeworldOccupiedIncomeChoice(state, game, 'owner', state.event, world, amount), HomeworldCustodyError);
  game.players.find(player => player.id === 'ally')!.ally = null;
  assert.notEqual(homeworldOccupiedIncomeOffer(state, game, 'owner')!.blocked, null);
  assert.throws(() => quoteHomeworldOccupiedIncomeChoice(state, game, 'owner', state.event, world, 2), HomeworldCustodyError);
  const unreciprocated = beginHomeworldOccupiedIncome(game, 'collection-nonreciprocal');
  assert.equal(unreciprocated.queue[0].ally, null);
  assert.throws(() => quoteHomeworldOccupiedIncomeChoice(unreciprocated, game, 'owner', unreciprocated.event, world, 0), HomeworldCustodyError);
});

void test('Emperor worlds stay distinct; JSON continuation retains exact settled and pending receipts including zero Salusa', () => {
  const { game, world } = occupiedIncomeFixture('kaitain', true);
  const owner = game.players.find(player => player.id === 'owner')!;
  const secondary = 'homeworld:emperor:salusa';
  game.homeworlds!.custody!.visitors[secondary] = { owner: { normal: 1, elite: 0 } };
  owner.reserves--;
  observeControlledIncomePosition(game, 'controlled-separate-salusa');
  const state = beginHomeworldOccupiedIncome(game, 'collection-emperor');
  assert.deepEqual(state.queue.map(row => [row.world, row.card, row.spice]), [[world, 'kaitain', 2], [secondary, 'salusa_secundus', 0]]);
  const first = settle(game, state, 1);
  const resumedGame: Game = JSON.parse(JSON.stringify(game));
  const resumed: HomeworldOccupiedIncomeState = JSON.parse(JSON.stringify(first.state));
  assert.deepEqual(resumed.receipts, [
    { world, status: 'settled', ownAmount: 1, credits: [{ player: 'owner', amount: 1 }, { player: 'ally', amount: 1 }] },
    { world: secondary, status: 'pending' },
  ]);
  assert.throws(() => quoteHomeworldOccupiedIncomeChoice(resumed, resumedGame, 'owner', resumed.event, world, 1), HomeworldCustodyError);
  assert.equal(homeworldOccupiedIncomeOffer(resumed, resumedGame, 'owner')!.amount, 0);
  const done = settle(resumedGame, resumed, 0);
  assert.deepEqual(done.credits, []);
  assert.deepEqual(done.state.receipts[0], first.state.receipts[0]);
  assert.deepEqual(done.state.receipts[1], { world: secondary, status: 'settled', ownAmount: 0, credits: [] });
  assert.throws(() => quoteHomeworldOccupiedIncomeChoice(done.state, resumedGame, 'owner', resumed.event, secondary, 0), HomeworldCustodyError);
  const corrupted: HomeworldOccupiedIncomeState = JSON.parse(JSON.stringify(first.state));
  corrupted.receipts[0] = { world, status: 'settled', ownAmount: 2, credits: [{ player: 'owner', amount: 2 }] };
  assert.throws(() => homeworldOccupiedIncomeOffer(corrupted, game, 'owner'), HomeworldCustodyError);
  resumedGame.turn++;
  assert.throws(() => homeworldOccupiedIncomeOffer(resumed, resumedGame, 'owner'), HomeworldCustodyError);
});

void test('preview disabled never provides bank entitlement; repeated offer reads cannot pay or advance a receipt', () => {
  const { game } = occupiedIncomeFixture();
  const state = beginHomeworldOccupiedIncome(game, 'collection-read');
  const before = structuredClone({ game, state });
  for (let i = 0; i < 5; i++) assert.equal(homeworldOccupiedIncomeOffer(state, game, 'owner')!.amount, 2);
  assert.deepEqual({ game, state }, before);
  delete game.homeworldOccupationPreview;
  assert.equal(beginHomeworldOccupiedIncome(game, 'collection-disabled').queue.length, 0);
  assert.notEqual(homeworldOccupiedIncomeOffer(state, game, 'owner')!.blocked, null);
});

void test('Basic current-sole control drops on departure and resumes for the returned qualifier without rerouting its frozen receipt', () => {
  const { game, world } = occupiedIncomeFixture();
  const state = beginHomeworldOccupiedIncome(game, 'collection-departure');
  const owner = game.players.find(player => player.id === 'owner')!;
  delete game.homeworlds!.custody!.visitors[world];
  owner.reserves++;
  observeControlledIncomePosition(game, 'controlled-departure');
  assert.equal(beginHomeworldOccupiedIncome(game, 'collection-departed').queue.length, 0);
  const before = structuredClone({ game, state });
  assert.notEqual(homeworldOccupiedIncomeOffer(state, game, 'owner')!.blocked, null);
  assert.throws(() => quoteHomeworldOccupiedIncomeChoice(state, game, 'owner', state.event, world, 2), HomeworldCustodyError);
  assert.deepEqual({ game, state }, before);
  game.homeworlds!.custody!.visitors[world] = { owner: { normal: 1, elite: 0 } };
  owner.reserves--;
  observeControlledIncomePosition(game, 'controlled-return');
  const fresh = beginHomeworldOccupiedIncome(game, 'collection-returned');
  assert.equal(fresh.queue.length, 1);
  assert.equal(fresh.queue[0].occupier, 'owner');
  assert.equal(fresh.queue[0].qualification, state.queue[0].qualification, 'the same observed source resumes; no new epoch is invented');
  assert.deepEqual(settle(game, state, 2).credits, [{ player: 'owner', amount: 2 }]);
});

void test('Basic contested foreign presence removes current-sole control while a frozen receipt stays unreroutable', () => {
  const { game, world } = occupiedIncomeFixture();
  const state = beginHomeworldOccupiedIncome(game, 'collection-contested');
  const custody = game.homeworlds!.custody!;
  const competitor = game.players.find(player => player.id === 'competitor')!;
  custody.visitors[world].competitor = { normal: 1, elite: 0 };
  competitor.reserves--;
  observeControlledIncomePosition(game, 'controlled-competing-arrival');
  assert.equal(beginHomeworldOccupiedIncome(game, 'collection-contested-fresh').queue.length, 0);
  const before = structuredClone({ game, state });
  assert.notEqual(homeworldOccupiedIncomeOffer(state, game, 'owner')!.blocked, null);
  assert.throws(() => quoteHomeworldOccupiedIncomeChoice(state, game, 'owner', state.event, world, 1), HomeworldCustodyError);
  assert.deepEqual({ game, state }, before);
  delete custody.visitors[world].competitor;
  competitor.reserves++;
  observeControlledIncomePosition(game, 'controlled-contest-cleared');
  assert.deepEqual(settle(game, state, 1).credits, [{ player: 'owner', amount: 1 }, { player: 'ally', amount: 1 }]);
});

void test('Basic native repopulation removes current-sole control without erasing history or a frozen receipt guard', () => {
  const { game, world } = occupiedIncomeFixture();
  const state = beginHomeworldOccupiedIncome(game, 'collection-native-restored');
  const qualifications = structuredClone(game.homeworldOccupationHistory!.qualifications);
  const native = game.players.find(player => player.id === 'native')!;
  native.reserves = 6;
  native.tanks -= 6;
  observeControlledIncomePosition(game, 'controlled-native-repopulation');
  assert.deepEqual(game.homeworldOccupationHistory!.qualifications, qualifications);
  assert.equal(beginHomeworldOccupiedIncome(game, 'collection-restored-native-fresh').queue.length, 0);
  const before = structuredClone({ game, state });
  assert.notEqual(homeworldOccupiedIncomeOffer(state, game, 'owner')!.blocked, null);
  assert.throws(() => quoteHomeworldOccupiedIncomeChoice(state, game, 'owner', state.event, world, 2), HomeworldCustodyError);
  assert.deepEqual({ game, state }, before);
});

void test('Basic current-sole control transfers to a newly observed sole faction and never rewrites earlier history', () => {
  const { game, world } = occupiedIncomeFixture();
  const owner = game.players.find(player => player.id === 'owner')!;
  const competitor = game.players.find(player => player.id === 'competitor')!;
  const original = structuredClone(game.homeworldOccupationHistory!.qualifications);
  const custody = game.homeworlds!.custody!;
  delete custody.visitors[world];
  owner.reserves++;
  observeControlledIncomePosition(game, 'controlled-transfer-out');
  assert.equal(beginHomeworldOccupiedIncome(game, 'collection-no-controller').queue.length, 0);
  custody.visitors[world] = { competitor: { normal: 1, elite: 0 } };
  competitor.reserves--;
  assert.equal(
    quoteStableHomeworldOccupation(game, 'caladan').blocked,
    'The original Basic sole-occupation change must be observed before its benefit settles.',
    'a physical write without its semantic observation grants nothing',
  );
  observeControlledIncomePosition(game, 'controlled-transfer-in');
  const state = beginHomeworldOccupiedIncome(game, 'collection-new-controller');
  assert.equal(state.queue.length, 1);
  assert.equal(state.queue[0].occupier, 'competitor');
  assert.deepEqual(game.homeworldOccupationHistory!.qualifications.slice(0, original.length), original);
});

void test('Advanced contested zero-icon Salusa retains its original strength penalty without blocking Kaitain income', () => {
  const { game } = occupiedIncomeFixture('kaitain', true, false);
  const secondary = 'homeworld:emperor:salusa';
  const owner = game.players.find(p => p.id === 'owner')!;
  owner.reserves--;
  game.homeworlds!.custody!.visitors[secondary] = { owner: { normal: 1, elite: 0 } };
  observeControlledIncomePosition(game, 'controlled-secondary-sole-arrival');
  game.players.find(p => p.id === 'competitor')!.reserves--;
  game.homeworlds!.custody!.visitors[secondary].competitor = { normal: 1, elite: 0 };
  observeControlledIncomePosition(game, 'controlled-secondary-contested');
  assert.deepEqual(occupiedHomeworldSardaukarStatus(game), { suppressed: true, blocked: null });
  const before = owner.spice;
  const pending = beginHomeworldOccupiedIncome(game, 'collection-positive-primary-zero-secondary');
  const result = settle(game, pending, 2);
  assert.equal(owner.spice - before, 2);
  const zero = settle(game, result.state, 0);
  assert.equal(zero.state.cursor, zero.state.queue.length);
  assert.equal(owner.spice - before, 2);
  assert.deepEqual(occupiedHomeworldSardaukarStatus(game), { suppressed: true, blocked: null });
});

void test('Advanced bank owner survives native return, foreign contest and turn change but expires at its last departure', () => {
  const { game, world } = occupiedIncomeFixture('caladan', true, false);
  const owner = game.players.find(player => player.id === 'owner')!;
  const native = game.players.find(player => player.id === 'native')!;
  const competitor = game.players.find(player => player.id === 'competitor')!;
  const initial = beginHomeworldOccupiedIncome(game, 'advanced-original-collection');
  const qualification = initial.queue[0].qualification;
  native.tanks -= 6;
  native.reserves += 6;
  game.homeworlds!.custody!.visitors[world].competitor = { normal: 1, elite: 0 };
  competitor.reserves--;
  observeControlledIncomePosition(game, 'advanced-native-high-and-foreign-contest');
  assert.equal(homeworldOccupiedIncomeOffer(initial, game, owner.id)!.blocked, null);
  const before = owner.spice;
  settle(game, initial, 2);
  assert.equal(owner.spice - before, 2);
  game.turn++;
  observeControlledIncomePosition(game, 'advanced-next-turn-original-owner-remains');
  const retained = beginHomeworldOccupiedIncome(game, 'advanced-next-collection');
  assert.equal(retained.queue[0].occupier, owner.id);
  assert.equal(retained.queue[0].qualification, qualification);
  delete game.homeworlds!.custody!.visitors[world].owner;
  owner.reserves++;
  observeControlledIncomePosition(game, 'advanced-last-original-force-left');
  assert.equal(beginHomeworldOccupiedIncome(game, 'advanced-no-sole-successor').queue.length, 0);
  assert.throws(() => quoteHomeworldOccupiedIncomeChoice(retained, game, owner.id, retained.event, world, 2), HomeworldCustodyError);
  native.tanks += native.reserves;
  native.reserves = 0;
  observeControlledIncomePosition(game, 'advanced-successor-alone');
  const replacement = beginHomeworldOccupiedIncome(game, 'advanced-successor-collection');
  assert.equal(replacement.queue[0].occupier, competitor.id);
  assert.notEqual(replacement.queue[0].qualification, qualification);
  const successorBalance = competitor.spice;
  settle(game, replacement, 2);
  assert.equal(competitor.spice - successorBalance, 2);
  assert.equal(owner.spice - before, 2);
  homeworldGameIntegrity(game);
});
