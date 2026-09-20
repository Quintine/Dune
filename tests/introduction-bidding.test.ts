import test from 'node:test';
import assert from 'node:assert/strict';
import { introductionBidding } from '../game/introduction-bidding';
import {
  INTRODUCTION_STEPS,
  newIntroduction,
  restoreIntroduction,
} from '../game/introduction';
import { applyAction, createGame, newPlayer } from '../game/engine';
import { baseDeck } from '../game/cards';

void test('bidding practice allows pass/re-entry, pays only the winner and reveals only the buyer card', () => {
  const state = newIntroduction();
  const opening = introductionBidding(state);
  assert.equal(opening.status, 'bidding');
  assert.equal(opening.minimum, 1);
  assert.equal(opening.received, null);
  const reentry = introductionBidding({ ...state, auctionActions: [null] });
  assert.equal(reentry.status, 'bidding');
  assert.equal(reentry.bid, 3);
  assert.equal(reentry.minimum, 4);
  assert.equal(reentry.remaining, 6);
  assert.equal(reentry.received, null);
  const won = introductionBidding({ ...state, auctionActions: [null, 4] });
  assert.equal(won.status, 'sold');
  assert.equal(won.won, true);
  assert.equal(won.remaining, 2);
  assert.equal(won.emperorIncome, 4);
  assert.equal(won.handCount, 4);
  assert.equal(won.received?.kind, 'shield');
  const lost = introductionBidding({ ...state, auctionActions: [null, null] });
  assert.equal(lost.bidder, 'guild');
  assert.equal(lost.remaining, 6);
  assert.equal(lost.handCount, 3);
  assert.equal(lost.received, null);
});

void test('practice enforces hand capacity, all-pass ending, budget and exact replay boundaries', () => {
  const state = newIntroduction();
  const full = introductionBidding({ ...state, auctionHandFull: true });
  assert.equal(full.status, 'sold');
  assert.equal(full.bidder, 'guild');
  assert.ok(full.actions.every((action) => action.actor !== 'you'));
  assert.equal(full.received, null);
  const unbid = introductionBidding({
    ...state,
    auctionScenario: 'all-pass',
    auctionActions: [null],
  });
  assert.equal(unbid.status, 'unbid');
  assert.equal(unbid.remaining, 6);
  assert.equal(unbid.emperorIncome, 0);
  for (const auctionBid of [0, 7])
    assert.equal(introductionBidding({ ...state, auctionBid }).canBid, false);
  for (const patch of [
    { auctionActions: [7] },
    { auctionActions: [1.5] },
    { auctionActions: [null, 3] },
    { auctionActions: [4, 5] },
    { auctionHandFull: true, auctionActions: [null] },
    { auctionScenario: 'invalid' },
    { auctionActions: [] as unknown, auctionBid: 8 },
  ])
    assert.equal(
      restoreIntroduction(JSON.stringify({ ...state, ...patch })),
      null,
    );
});

void test('every offered opening choice and re-entry agrees with actual engine bids, payment and custody', () => {
  let samples = 0;
  for (const auctionScenario of ['contest', 'all-pass'] as const)
    for (const auctionHandFull of [false, true])
      for (const first of [null, 1, 2, 3, 4, 5, 6])
        for (const second of [undefined, null, 4, 5, 6]) {
          if (auctionHandFull && (first !== null || second !== undefined))
            continue;
          const state = {
            ...newIntroduction(),
            auctionScenario,
            auctionHandFull,
            auctionActions: auctionHandFull
              ? []
              : second === undefined
                ? [first]
                : [first, second],
          };
          let expected;
          try {
            expected = introductionBidding(state);
          } catch {
            continue;
          }
          const game = createGame(
            'LEARNBID',
            newPlayer('you', 'You', 'fremen'),
          );
          game.players.push(
            newPlayer('emperor', 'Emperor', 'emperor'),
            newPlayer('guild', 'Guild', 'guild'),
          );
          const soldCard = baseDeck().find((card) => card.kind === 'shield')!;
          const handPool = baseDeck().filter(
              (card) => card.id !== soldCard.id && card.effect !== 'karama',
          );
          let offset = 0;
          for (const player of game.players) {
            const count = player.id === 'you' && auctionHandFull ? 4 : 3;
            player.hand = handPool.slice(offset, offset + count);
            offset += count;
            player.spice = player.id === 'you' ? 6 : 4;
          }
          const held = new Set(
            game.players.flatMap((player) =>
              player.hand.map((card) => card.id),
            ),
          );
          game.deck = baseDeck().filter(
            (card) => card.id !== soldCard.id && !held.has(card.id),
          );
          Object.assign(game, {
            status: 'playing',
            phase: 3,
            turn: 2,
            phaseOpening: null,
            order: ['you', 'emperor', 'guild'],
            active: auctionHandFull ? 'emperor' : 'you',
            auction: {
              cards: [soldCard],
              index: 0,
              opener: 0,
              active: auctionHandFull ? 'emperor' : 'you',
              bid: 0,
              bidder: null,
              passed: [],
            },
          });
          let result = game;
          for (const action of expected.actions) {
            const input = result;
            const before = structuredClone(result);
            result = applyAction(
              result,
              action.actor,
              action.amount === null
                ? { type: 'passBid' }
                : { type: 'bid', amount: action.amount },
            );
            assert.deepEqual(input, before);
          }
          const own = result.players[0];
          assert.equal(own.spice, expected.remaining);
          assert.equal(own.hand.length, expected.handCount);
          assert.equal(
            own.hand.some((card) => card.id === soldCard.id),
            expected.won,
          );
          assert.equal(
            result.players[1].spice,
            4 + expected.emperorIncome - expected.bankIncome,
          );
          if (expected.status === 'bidding') {
            assert.equal(result.auction!.active, 'you');
            assert.equal(result.auction!.bid, expected.bid);
            assert.equal(result.auction!.bidder, expected.bidder);
          } else {
            assert.equal(result.auction, null);
            if (expected.status === 'sold')
              assert.ok(
                result.players
                  .find((player) => player.id === expected.bidder)!
                  .hand.some((card) => card.id === soldCard.id),
              );
            else assert.equal(result.deck[0].id, soldCard.id);
          }
          const zones = [
            ...result.deck,
            ...result.discard,
            ...result.players.flatMap((player) => player.hand),
            ...(result.auction?.cards.slice(result.auction.index) ?? []),
          ];
          assert.equal(
            zones.filter((card) => card.id === soldCard.id).length,
            1,
          );
          samples++;
        }
  assert.ok(samples > 20);
});

void test('all seven v2 lessons keep their identity and prior decisions when bidding is inserted', () => {
  const titles = [
    'Your place at the table',
    'Ship within your budget',
    'Move across the board',
    'Seal a battle plan',
    'Reveal a Traitor',
    'Collect the spice',
    'Join a table',
  ];
  for (const [step, title] of titles.entries()) {
    const old = {
      ...newIntroduction(),
      version: 2,
      step,
      shipped: true,
      revealed: true,
      moved: true,
      moveCity: true,
      traitorStage: 'resolved',
      traitorCall: true,
      auctionActions: [999],
      auctionHandFull: 'ignored',
      unrelated: 'removed',
    };
    const result = restoreIntroduction(JSON.stringify(old))!;
    assert.equal(result.version, 3);
    assert.equal(INTRODUCTION_STEPS[result.step].title, title);
    assert.equal(result.shipped, true);
    assert.equal(result.revealed, true);
    assert.equal(result.moved, true);
    assert.equal(result.traitorCall, true);
    assert.deepEqual(result.auctionActions, []);
    assert.equal(result.auctionHandFull, false);
    assert.equal(Object.hasOwn(result, 'unrelated'), false);
  }
  assert.equal(
    restoreIntroduction(
      JSON.stringify({ ...newIntroduction(), version: 2, step: 7 }),
    ),
    null,
  );
  for (const auctionActions of [[], [null], [null, 4], [null, null]] as Array<
    Array<number | null>
  >) {
    const current = { ...newIntroduction(), step: 1, auctionActions };
    const restored = restoreIntroduction(JSON.stringify(current));
    assert.deepEqual(restored, current);
    assert.deepEqual(
      introductionBidding(restored!),
      introductionBidding(current),
    );
  }
});
