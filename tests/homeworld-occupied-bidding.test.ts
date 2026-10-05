import test from 'node:test';
import assert from 'node:assert/strict';
import { handLimit, type Game } from '../game/engine';
import type { FactionId } from '../game/catalog';
import { HOMEWORLD_CARDS, type HomeworldId } from '../game/homeworld-cards';
import { HomeworldCustodyError } from '../game/homeworld-custody';
import {
  quoteOccupiedBiddingAuthority, requireOccupiedBiddingController,
  requireOccupiedBiddingBonusRecipient, OccupiedBiddingError,
  type OccupiedBiddingKind,
} from '../game/homeworld-occupied-bidding';
import {
  addDefenseVisitor, assertDefenseInventory, clearDefenseNative,
  qualifyDefensePosition, recordDefensePosition, removeDefenseVisitor,
} from './fixture-homeworld-occupied-defenses';
import {
  biddingPhysicalIds, biddingPlayer, freshBiddingGame, stageBiddingHandSize,
} from './fixture-homeworld-occupied-bidding';

const effects: Record<OccupiedBiddingKind, { native: FactionId; card: HomeworldId }> = {
  atreidesInspection: { native: 'atreides', card: 'caladan' },
  ixAuction: { native: 'ixians', card: 'ix' },
  richeseCache: { native: 'richese', card: 'richese' },
  harkonnenBonus: { native: 'harkonnen', card: 'giedi_prime' },
};

void test('Caladan shares native inspection with exactly the original qualifier, never ally-only borrowing', () => {
  const game = freshBiddingGame('atreides');
  const originalCards = biddingPhysicalIds(game);
  assert.deepEqual(quoteOccupiedBiddingAuthority(game, 'atreidesInspection').inspectionAudience, ['native']);
  qualifyDefensePosition(game, 'homeworld:atreides');
  biddingPlayer(game, 'occupier').ally = 'ally';
  biddingPlayer(game, 'ally').ally = 'occupier';
  const before = structuredClone(game);
  const shared = quoteOccupiedBiddingAuthority(game, 'atreidesInspection');
  assert.equal(shared.provider, 'native', 'native Atreides still produces the original inspection');
  assert.deepEqual(shared.inspectionAudience, ['native', 'occupier']);
  assert.equal(shared.inspectionAudience.includes('ally'), false);
  assert.equal(shared.inspectionAudience.includes('observer'), false);
  assert.deepEqual(shared.bonusRecipients, [], 'sharing an inspection never awards a card');
  assert.equal(requireOccupiedBiddingController(game, 'atreidesInspection', 'native').provider, 'native');
  assert.equal(requireOccupiedBiddingController(game, 'atreidesInspection', 'occupier').provider, 'native');
  assert.throws(() => requireOccupiedBiddingController(game, 'atreidesInspection', 'ally'), HomeworldCustodyError);
  assert.deepEqual(game, before);
  assert.deepEqual(biddingPhysicalIds(game), originalCards);
  const saved: Game = JSON.parse(JSON.stringify(game));
  assert.deepEqual(quoteOccupiedBiddingAuthority(saved, 'atreidesInspection').inspectionAudience, ['native', 'occupier']);
  delete saved.homeworldOccupationPreview;
  assert.deepEqual(quoteOccupiedBiddingAuthority(saved, 'atreidesInspection').inspectionAudience, ['native']);
});

void test('Ix transfers the one actual selection and pool audience, not native setup or a duplicate peek', () => {
  const game = freshBiddingGame('ixians');
  const native = quoteOccupiedBiddingAuthority(game, 'ixAuction');
  assert.equal(native.controller, 'native');
  qualifyDefensePosition(game, 'homeworld:ixians');
  // Labelled conserved original pool: every card leaves its deck once. The
  // known receipt is only an alias; quoting cannot draw or return it again.
  const originalCards = biddingPhysicalIds(game);
  const pool = game.deck.splice(0, 3);
  assert.equal(pool.length, 3);
  game.ixAuction = { count: 2, cards: pool };
  game.ixAuctionKnown = { turn: game.turn, cards: [...pool] };
  biddingPlayer(game, 'occupier').ally = 'ally';
  biddingPlayer(game, 'ally').ally = 'occupier';
  const before = structuredClone(game);
  const occupied = requireOccupiedBiddingController(game, 'ixAuction', 'occupier');
  assert.equal(occupied.provider, 'native');
  assert.deepEqual(occupied.inspectionAudience, ['occupier']);
  assert.equal(occupied.inspectionAudience.includes('native'), false, 'native provider has no second pool inspection');
  assert.equal(occupied.inspectionAudience.includes('ally'), false);
  assert.throws(() => requireOccupiedBiddingController(game, 'ixAuction', 'native'), OccupiedBiddingError);
  assert.throws(() => requireOccupiedBiddingController(game, 'ixAuction', 'ally'), HomeworldCustodyError);
  assert.deepEqual(game, before, 'no source draw, sale-count change, selection, return or shuffle is performed by authority');
  assert.deepEqual(biddingPhysicalIds(game), originalCards);
  const saved: Game = JSON.parse(JSON.stringify(game));
  assert.equal(requireOccupiedBiddingController(saved, 'ixAuction', 'occupier').provider, 'native');
  delete saved.homeworldOccupationPreview;
  assert.equal(requireOccupiedBiddingController(saved, 'ixAuction', 'native').controller, 'native');
  assert.deepEqual(quoteOccupiedBiddingAuthority(saved, 'ixAuction').inspectionAudience, ['native']);
});

void test('Richese transfers only original cache choice while native cache custody and seller stay intact', () => {
  const game = freshBiddingGame('richese');
  assert.ok(game.richeseCache!.length > 0, 'original setup supplied real cache cards');
  const originalCards = biddingPhysicalIds(game);
  const originalCache = structuredClone(game.richeseCache);
  qualifyDefensePosition(game, 'homeworld:richese');
  const before = structuredClone(game);
  const authority = requireOccupiedBiddingController(game, 'richeseCache', 'occupier');
  assert.equal(authority.provider, 'native', 'choosing cannot become the sale/payment provider');
  assert.deepEqual(authority.inspectionAudience, ['native', 'occupier'], 'native still knows its original cache');
  assert.equal(authority.inspectionAudience.includes('ally'), false);
  assert.equal(authority.inspectionAudience.includes('observer'), false);
  assert.throws(() => requireOccupiedBiddingController(game, 'richeseCache', 'native'), OccupiedBiddingError);
  assert.throws(() => requireOccupiedBiddingController(game, 'richeseCache', 'observer'), HomeworldCustodyError);
  assert.deepEqual(game.richeseCache, originalCache);
  assert.deepEqual(biddingPhysicalIds(game), originalCards);
  assert.deepEqual(game, before, 'authority never removes/offers a cache card or changes native sale terms');
  const saved: Game = JSON.parse(JSON.stringify(game));
  assert.equal(requireOccupiedBiddingController(saved, 'richeseCache', 'occupier').provider, 'native');
  delete saved.homeworldOccupationPreview;
  assert.equal(requireOccupiedBiddingController(saved, 'richeseCache', 'native').controller, 'native');
});

void test('Giedi checks genuine four/five/eight-card receiver space, independent of the full native buyer', () => {
  const game = freshBiddingGame('harkonnen', 'choam');
  qualifyDefensePosition(game, 'homeworld:harkonnen');
  const originalCards = biddingPhysicalIds(game);
  const native = biddingPlayer(game, 'native');
  const occupier = biddingPlayer(game, 'occupier');
  const ally = biddingPlayer(game, 'ally');
  assert.equal(handLimit(occupier), 4);
  assert.equal(handLimit(ally), 5);
  assert.equal(handLimit(native), 8);
  occupier.ally = 'ally';
  ally.ally = 'occupier';
  stageBiddingHandSize(game, 'native', 8);
  stageBiddingHandSize(game, 'occupier', 3);
  stageBiddingHandSize(game, 'ally', 4);
  const before = structuredClone(game);
  const both = quoteOccupiedBiddingAuthority(game, 'harkonnenBonus');
  assert.equal(both.provider, 'native');
  assert.equal(both.controller, 'occupier');
  assert.deepEqual(both.bonusRecipients, ['occupier', 'ally'], 'two alternatives for the same physical extra card');
  assert.equal(requireOccupiedBiddingBonusRecipient(game, 'ally').provider, 'native');
  assert.throws(() => requireOccupiedBiddingBonusRecipient(game, 'native'), OccupiedBiddingError);
  assert.deepEqual(game, before, 'quoting alternatives never awards either card, let alone two');

  stageBiddingHandSize(game, 'occupier', 4);
  assert.deepEqual(quoteOccupiedBiddingAuthority(game, 'harkonnenBonus').bonusRecipients, ['ally']);
  stageBiddingHandSize(game, 'native', 1);
  assert.deepEqual(quoteOccupiedBiddingAuthority(game, 'harkonnenBonus').bonusRecipients, ['ally'], 'buyer space cannot replace full receiver space');
  stageBiddingHandSize(game, 'ally', 5);
  assert.deepEqual(quoteOccupiedBiddingAuthority(game, 'harkonnenBonus').bonusRecipients, []);
  assert.throws(() => requireOccupiedBiddingBonusRecipient(game, 'ally'), HomeworldCustodyError);

  // An eight-card faction can receive only as the current reciprocal ally,
  // not automatically as native buyer. Requote against that real limit.
  occupier.ally = 'native';
  native.ally = 'occupier';
  stageBiddingHandSize(game, 'native', 7);
  assert.deepEqual(quoteOccupiedBiddingAuthority(game, 'harkonnenBonus').bonusRecipients, ['native']);
  stageBiddingHandSize(game, 'native', 8);
  assert.deepEqual(quoteOccupiedBiddingAuthority(game, 'harkonnenBonus').bonusRecipients, []);
  stageBiddingHandSize(game, 'occupier', 3);
  occupier.atomicsHandLimitPenalty = true;
  assert.equal(handLimit(occupier), 3);
  assert.deepEqual(quoteOccupiedBiddingAuthority(game, 'harkonnenBonus').bonusRecipients, [], 'printed base limit cannot bypass an actual capacity penalty');
  assert.deepEqual(biddingPhysicalIds(game), originalCards);
  assertDefenseInventory(game);
});

void test('Giedi recipient acceptance rechecks reciprocal alliance changes and retains native legacy behavior', () => {
  const game = freshBiddingGame('harkonnen', 'choam');
  qualifyDefensePosition(game, 'homeworld:harkonnen');
  const occupier = biddingPlayer(game, 'occupier');
  stageBiddingHandSize(game, 'occupier', 4);
  stageBiddingHandSize(game, 'ally', 4);
  stageBiddingHandSize(game, 'observer', 3);
  occupier.ally = 'ally';
  assert.deepEqual(quoteOccupiedBiddingAuthority(game, 'harkonnenBonus').bonusRecipients, [], 'one-way alliance confers no card');
  biddingPlayer(game, 'ally').ally = 'occupier';
  assert.equal(requireOccupiedBiddingBonusRecipient(game, 'ally').controller, 'occupier');
  occupier.ally = 'observer';
  assert.throws(() => requireOccupiedBiddingBonusRecipient(game, 'ally'), OccupiedBiddingError);
  assert.throws(() => requireOccupiedBiddingBonusRecipient(game, 'observer'), OccupiedBiddingError);
  biddingPlayer(game, 'observer').ally = 'occupier';
  assert.deepEqual(quoteOccupiedBiddingAuthority(game, 'harkonnenBonus').bonusRecipients, ['observer']);
  const saved: Game = JSON.parse(JSON.stringify(game));
  assert.equal(requireOccupiedBiddingBonusRecipient(saved, 'observer').provider, 'native');
  delete saved.homeworldOccupationPreview;
  assert.deepEqual(quoteOccupiedBiddingAuthority(saved, 'harkonnenBonus').bonusRecipients, ['native']);
  stageBiddingHandSize(saved, 'native', 8);
  assert.deepEqual(quoteOccupiedBiddingAuthority(saved, 'harkonnenBonus').bonusRecipients, []);
});

void test('Giedi uses original discard refill stock without ever drawing a physical card during a quote', () => {
  const game = freshBiddingGame('harkonnen');
  qualifyDefensePosition(game, 'homeworld:harkonnen');
  const originalCards = biddingPhysicalIds(game);
  // Conserved exhausted-deck position: the original discarded stock is the
  // only possible refill, not a cache/hand/knowledge receipt treated as supply.
  game.discard.push(...game.deck.splice(0));
  assert.equal(game.deck.length, 0);
  assert.ok(game.discard.length > 0);
  const before = structuredClone(game);
  const authority = requireOccupiedBiddingBonusRecipient(game, 'occupier');
  assert.equal(authority.bonusStockAvailable, true);
  assert.deepEqual(authority.bonusRecipients, ['occupier']);
  assert.deepEqual(game, before);
  assert.deepEqual(biddingPhysicalIds(game), originalCards);
});

for (const [kind, rule] of Object.entries(effects) as [OccupiedBiddingKind, { native: FactionId; card: HomeworldId }][]) {
  void test(`${rule.card}: Basic retains publisher turn-boundary qualification rather than a current garrison shortcut`, () => {
    const game = freshBiddingGame(rule.native, 'emperor', false);
    const world = `homeworld:${rule.native}`;
    const high = HOMEWORLD_CARDS.find(card => card.id === rule.card)!.high.reserves.min;
    const native = biddingPlayer(game, 'native');
    const originalCards = biddingPhysicalIds(game);
    clearDefenseNative(game, world);
    native.tanks -= high - 1;
    native.reserves += high - 1;
    addDefenseVisitor(game, world);
    recordDefensePosition(game, 'native-below-high-with-original-foreign-visitor');
    assert.equal(quoteOccupiedBiddingAuthority(game, kind).occupied, false, 'a foreign visitor alongside native forces has no sole-source qualification');
    recordDefensePosition(game, 'original-turn-end-qualifies-foreign-group', 'turnEnd');
    const authority = quoteOccupiedBiddingAuthority(game, kind);
    assert.equal(authority.occupied, true);
    assert.equal(authority.controller, kind === 'atreidesInspection' ? 'native' : 'occupier');
    assert.equal(authority.provider, 'native');
    assert.equal(authority.blocked, null);
    assert.deepEqual(biddingPhysicalIds(game), originalCards);
    assertDefenseInventory(game);
  });

  void test(`${rule.card}: Basic pending lifecycle and missing historical sources fail closed`, () => {
    const qualified = freshBiddingGame(rule.native, 'emperor', false);
    const world = `homeworld:${rule.native}`;
    qualifyDefensePosition(qualified, world);
    const high = HOMEWORLD_CARDS.find(card => card.id === rule.card)!.high.reserves.min;
    for (const mode of ['departure', 'competition', 'replacement', 'repopulation', 'expired', 'missing-history'] as const) {
      const game = structuredClone(qualified);
      if (mode === 'departure') {
        removeDefenseVisitor(game, world);
        recordDefensePosition(game, 'original-qualifier-left');
        addDefenseVisitor(game, world);
        recordDefensePosition(game, 'same-qualifier-returned-with-no-invented-expiry-rule');
      } else if (mode === 'competition') {
        addDefenseVisitor(game, world, 'observer');
        recordDefensePosition(game, 'second-original-foreign-group-arrived');
        removeDefenseVisitor(game, world, 'observer');
        recordDefensePosition(game, 'contest-cleared-with-history-retained');
      } else if (mode === 'replacement') {
        removeDefenseVisitor(game, world);
        recordDefensePosition(game, 'original-qualifier-departed-before-turnover');
        addDefenseVisitor(game, world, 'observer');
        recordDefensePosition(game, 'different-original-sole-qualifier-arrived');
      } else if (mode === 'repopulation') {
        const native = biddingPlayer(game, 'native');
        native.tanks -= high;
        native.reserves += high;
        recordDefensePosition(game, 'native-original-high-threshold-restored');
        clearDefenseNative(game, world);
        recordDefensePosition(game, 'native-fell-low-after-restoration');
      } else if (mode === 'expired') {
        game.turn++;
      } else delete game.homeworldOccupationHistory;
      const before = structuredClone(game);
      const blocked = quoteOccupiedBiddingAuthority(game, kind);
      assert.notEqual(blocked.blocked, null);
      assert.equal(blocked.provider, 'native', 'source provider is not reassigned even when effect must wait');
      assert.equal(blocked.controller, null);
      assert.deepEqual(blocked.inspectionAudience, [], 'uncertain history never leaks an original private pool/card');
      assert.deepEqual(blocked.bonusRecipients, []);
      assert.throws(() => requireOccupiedBiddingController(game, kind, 'native'), HomeworldCustodyError);
      assert.throws(() => requireOccupiedBiddingController(game, kind, 'occupier'), HomeworldCustodyError);
      if (kind === 'harkonnenBonus')
        assert.throws(() => requireOccupiedBiddingBonusRecipient(game, 'occupier'), HomeworldCustodyError);
      assert.deepEqual(game, before);
      assertDefenseInventory(game);
      const saved: Game = JSON.parse(JSON.stringify(game));
      assert.equal(quoteOccupiedBiddingAuthority(saved, kind).controller, null);
      assert.notEqual(quoteOccupiedBiddingAuthority(saved, kind).blocked, null);
      delete saved.homeworldOccupationPreview;
      const legacy = quoteOccupiedBiddingAuthority(saved, kind);
      assert.equal(legacy.controller, 'native');
      assert.equal(legacy.blocked, null, 'outside fresh preview does not convert or gate native saved-game rules');
    }
  });
}

void test('tampered original qualification evidence is a custody-domain error, never private permission', () => {
  const game = freshBiddingGame('ixians');
  qualifyDefensePosition(game, 'homeworld:ixians');
  game.homeworldOccupationHistory!.qualifications[0].player = 'observer';
  const before = structuredClone(game);
  assert.throws(() => quoteOccupiedBiddingAuthority(game, 'ixAuction'), HomeworldCustodyError);
  assert.deepEqual(game, before);
});
