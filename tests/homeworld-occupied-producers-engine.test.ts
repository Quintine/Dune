import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, normalizeAutomaticGame, RuleError, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { freshBiddingGame, biddingPlayer, biddingPhysicalIds, stageBiddingHandSize, stageBiddingKarama } from './fixture-homeworld-occupied-bidding';
import { qualifyDefensePosition, clearDefenseNative, removeDefenseVisitor, recordDefensePosition, assertDefenseInventory } from './fixture-homeworld-occupied-defenses';
import { occupiedIncomeMovementFixture } from './fixture-homeworld-occupied-income';
import { advanceOriginal, buyOriginalNormalLot, cash, freshSouthernProducerGame, freshGuildAdvisorProducerGame } from './fixture-homeworld-occupied-producers';
import { validateAmbassadors } from '../game/ecaz-ambassadors';
import { DIFFICULTIES } from '../game/bot-profiles';
import { nativeShipmentSources } from '../game/homeworld-options';
import { distance } from '../game/board';

function normalBidding(game: Game): Game {
  return advanceOriginal(game, game => game.phase === 3 && !!game.auction && !game.phaseOpening && !game.response && !game.decision);
}

void test('original paid Kaitain invoice conserves cash/cards and immediately allocates its original occupied share after JSON reload', () => {
  let game = freshBiddingGame('emperor', 'harkonnen');
  qualifyDefensePosition(game, 'homeworld:emperor');
  biddingPlayer(game, 'occupier').ally = 'ally';
  biddingPlayer(game, 'ally').ally = 'occupier';
  game = normalBidding(game);
  const original = biddingPhysicalIds(game), before = cash(game), bought = game.auction!.cards[game.auction!.index].id;
  game = buyOriginalNormalLot(game, 'occupier', 5);
  game = advanceOriginal(game, game => game.decision?.kind === 'homeworldOccupiedPercentage');
  assert.equal(game.currentAuctionSale!.winner, 'occupier');
  assert.equal(game.currentAuctionSale!.amount, 5);
  assert.equal(biddingPlayer(game, 'occupier').spice, before.occupier - 5);
  assert.equal(biddingPlayer(game, 'native').spice, before.native + 3);
  assert.ok(biddingPlayer(game, 'occupier').hand.some(card => card.id === bought));
  const offer = viewGame(game, 'occupier').homeworldOccupiedPercentage!;
  assert.equal(offer.amount, 2);
  assert.equal(offer.world, 'homeworld:emperor');
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, 'occupier');
    view.players.find(player => player.id === 'occupier')!.bot = difficulty;
    const choice = botActions(view)[0];
    assert.ok(choice, `${difficulty} can settle the actual original paid source`);
    const result = applyAction(JSON.parse(JSON.stringify(game)), 'occupier', choice);
    assert.equal(result.homeworldOccupiedPercentageLedger!.receipts[0].status, 'settled');
    assert.equal(Object.values(cash(result)).reduce((sum, n) => sum + n, 0), Object.values(before).reduce((sum, n) => sum + n, 0));
    assert.deepEqual(biddingPhysicalIds(result), original);
  }
  const action = { type: 'decision', event: offer.event, ownAmount: 1 };
  for (const [actor, invalid] of [
    ['native', action], ['occupier', { ...action, ownAmount: 3 }],
    ['occupier', { ...action, event: `${offer.event}:stale` }],
  ] as const) {
    const frozen = structuredClone(game);
    assert.throws(() => applyAction(game, actor, invalid), RuleError);
    assert.deepEqual(game, frozen, 'rejection leaves cash, ledger and exact purchase suffix untouched');
  }
  const changed: Game = structuredClone(game);
  changed.currentAuctionSale!.amount++;
  const frozen = structuredClone(changed);
  assert.throws(() => applyAction(changed, 'occupier', action), RuleError);
  assert.deepEqual(changed, frozen);
  game = applyAction(JSON.parse(JSON.stringify(game)), 'occupier', action);
  assert.equal(biddingPlayer(game, 'native').spice, before.native + 3);
  assert.equal(biddingPlayer(game, 'occupier').spice, before.occupier - 4);
  assert.equal(biddingPlayer(game, 'ally').spice, before.ally + 1);
  assert.equal(Object.values(cash(game)).reduce((sum, n) => sum + n, 0), Object.values(before).reduce((sum, n) => sum + n, 0));
  assert.deepEqual(biddingPhysicalIds(game), original);
  assert.equal(game.homeworldOccupiedPercentageLedger!.receipts.filter(row => row.source.kind === 'emperor-treachery').length, 1);
  assert.throws(() => applyAction(game, 'occupier', action), RuleError);
});

void test('actual native Karama denial removes only the native Kaitain leg, not the printed occupied allocation', () => {
  let game = freshBiddingGame('emperor', 'harkonnen');
  qualifyDefensePosition(game, 'homeworld:emperor');
  const counter = stageBiddingKarama(game, 'observer');
  game = normalBidding(game);
  const before = cash(game), original = biddingPhysicalIds(game);
  game = buyOriginalNormalLot(game, 'occupier', 5);
  assert.equal(game.response?.kind, 'emperorIncome');
  game = applyAction(game, 'observer', { type: 'card', card: counter.id, mode: 'cancel' });
  game = advanceOriginal(game, game => game.decision?.kind === 'homeworldOccupiedPercentage');
  const offer = viewGame(game, 'occupier').homeworldOccupiedPercentage!;
  game = applyAction(game, 'occupier', { type: 'decision', event: offer.event, ownAmount: 2 });
  assert.equal(biddingPlayer(game, 'native').spice, before.native);
  assert.equal(biddingPlayer(game, 'occupier').spice, before.occupier - 3);
  assert.deepEqual(biddingPhysicalIds(game), original);
  const receipt = game.homeworldOccupiedPercentageLedger!.receipts.find(row => row.source.kind === 'emperor-treachery')!;
  assert.equal(receipt.nativeRetained, 0);
  assert.equal(receipt.occupiedAmount, 2);
  assert.equal(receipt.bankRetained, 3);
});

void test('original Caladan lot inspection shares one actual private face with native plus original occupier, never their ally', () => {
  let game = freshBiddingGame('atreides');
  qualifyDefensePosition(game, 'homeworld:atreides');
  biddingPlayer(game, 'occupier').ally = 'ally';
  biddingPlayer(game, 'ally').ally = 'occupier';
  game = normalBidding(game);
  const actual = game.auction!.cards[game.auction!.index];
  assert.deepEqual(viewGame(game, 'native').auction!.card, actual);
  assert.deepEqual(viewGame(game, 'occupier').auction!.card, actual);
  assert.equal(viewGame(game, 'ally').auction!.card, null);
  assert.equal(viewGame(game, 'observer').auction!.card, null);
  assert.deepEqual(viewGame(JSON.parse(JSON.stringify(game)), 'occupier').auction!.card, actual);
});

void test('original Ix draw has one displaced decision and private native-stock pool, with stale source/actor atomic rejection', () => {
  let game = freshBiddingGame('ixians');
  qualifyDefensePosition(game, 'homeworld:ixians');
  const original = biddingPhysicalIds(game);
  game = advanceOriginal(game, game => game.decision?.kind === 'ixAuction');
  assert.equal(game.phaseOpening, null, 'the original Amal window settles before the displaced Ix action');
  assert.equal(game.decision!.player, 'occupier');
  assert.ok(viewGame(game, 'occupier').ixTechnology!.pool!.length > 1);
  assert.equal(viewGame(game, 'native').ixTechnology!.pool, null);
  assert.equal(viewGame(game, 'observer').ixTechnology, null);
  const returned = game.ixAuction!.cards[0];
  const action = { type: 'decision', card: returned.id, position: 'top' };
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, 'occupier');
    view.players.find(player => player.id === 'occupier')!.bot = difficulty;
    const choice = botActions(view)[0];
    assert.ok(choice);
    const result = applyAction(JSON.parse(JSON.stringify(game)), 'occupier', choice);
    assert.equal(result.ixAuction, null);
    assert.equal(result.auction!.cards.length, game.ixAuction!.cards.length - 1);
    assert.deepEqual(viewGame(result, 'native').ixTechnology!.known, []);
    assert.deepEqual(biddingPhysicalIds(result), original);
  }
  const frozen = structuredClone(game);
  assert.throws(() => applyAction(game, 'native', action), RuleError);
  assert.deepEqual(game, frozen);
  const departed = structuredClone(game);
  removeDefenseVisitor(departed, 'homeworld:ixians');
  recordDefensePosition(departed, 'pending-original-pool-departure');
  const before = structuredClone(departed);
  assert.equal(viewGame(departed, 'occupier').ixTechnology!.pool, null);
  assert.notEqual(viewGame(departed, 'occupier').ixTechnology!.blocked, null);
  assert.equal(viewGame(departed, 'native').ixTechnology!.pool, null, 'a stale source cannot silently reveal the old pool to its native provider');
  assert.throws(() => applyAction(departed, 'occupier', action), RuleError);
  assert.deepEqual(departed, before);
  const rest = game.ixAuction!.cards.slice(1).map(card => card.id).sort();
  game = applyAction(JSON.parse(JSON.stringify(game)), 'occupier', action);
  assert.equal(game.deck[0].id, returned.id);
  assert.deepEqual(game.auction!.cards.map(card => card.id).sort(), rest);
  assert.deepEqual(viewGame(game, 'occupier').ixTechnology!.known.map(card => card.id).sort(), rest);
  assert.deepEqual(viewGame(game, 'native').ixTechnology!.known, []);
  assert.deepEqual(biddingPhysicalIds(game), original);
  assert.throws(() => applyAction(game, 'occupier', action), RuleError);
});

void test('Richese original seller sets terms; displaced chooser selects physical cache card; actual seller net is split without replacing invoice', () => {
  let game = freshBiddingGame('richese');
  qualifyDefensePosition(game, 'homeworld:richese');
  game = advanceOriginal(game, game => game.decision?.kind === 'richeseCacheTerms');
  assert.equal(game.decision!.player, 'native');
  const termsEvent = game.richeseBidding!.event;
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, 'native');
    view.players.find(player => player.id === 'native')!.bot = difficulty;
    const terms = botActions(view)[0];
    assert.ok(terms);
    let result = applyAction(JSON.parse(JSON.stringify(game)), 'native', terms);
    const choiceView = viewGame(result, 'occupier');
    choiceView.players.find(player => player.id === 'occupier')!.bot = difficulty;
    const choice = botActions(choiceView)[0];
    assert.ok(choice);
    result = applyAction(result, 'occupier', choice);
    assert.equal(result.richeseAuction!.owner, 'native');
    assert.equal(result.richeseAuction!.method, result.richeseBidding!.cacheTerms!.method);
    assert.ok(game.richeseCache!.some(card => card.id === result.richeseAuction!.cardId));
    assert.deepEqual(biddingPhysicalIds(result), biddingPhysicalIds(game));
  }
  game = applyAction(game, 'native', { type: 'decision', event: termsEvent, method: 'onceAround', direction: 'clockwise' });
  assert.equal(game.decision?.kind, 'richeseCache');
  assert.equal(game.decision!.player, 'occupier');
  const card = game.richeseCache![0], original = biddingPhysicalIds(game), before = cash(game);
  const event = game.richeseBidding!.event;
  const frozen = structuredClone(game);
  assert.throws(() => applyAction(game, 'native', { type: 'decision', event, card: card.id }), RuleError);
  assert.throws(() => applyAction(game, 'occupier', { type: 'decision', event, card: card.id, method: 'silent' }), RuleError);
  assert.deepEqual(game, frozen);
  game = applyAction(JSON.parse(JSON.stringify(game)), 'occupier', { type: 'decision', event, card: card.id });
  game = advanceOriginal(game, game => !!game.richeseAuction && !game.response && !game.decision);
  assert.equal(game.richeseAuction!.owner, 'native');
  assert.equal(game.richeseAuction!.method, 'onceAround');
  const lotEvent = game.richeseAuction!.event;
  for (let step = 0; !game.currentAuctionSale && step < game.players.length + 1; step++) {
    const active = game.richeseAuction!.active!;
    game = applyAction(game, active, { type: 'richeseBid', event: lotEvent, amount: active === 'occupier' ? 5 : null, allyPayment: 0 });
  }
  assert.equal(game.decision?.kind, 'homeworldOccupiedPercentage');
  assert.equal(game.currentAuctionSale!.seller, 'native');
  assert.equal(game.currentAuctionSale!.winner, 'occupier');
  assert.equal(biddingPlayer(game, 'native').spice, before.native + 3);
  const offer = viewGame(game, 'occupier').homeworldOccupiedPercentage!;
  game = applyAction(game, 'occupier', { type: 'decision', event: offer.event, ownAmount: 2 });
  assert.equal(biddingPlayer(game, 'occupier').spice, before.occupier - 3);
  assert.ok(biddingPlayer(game, 'occupier').hand.some(held => held.id === card.id));
  assert.deepEqual(biddingPhysicalIds(game), original);
});

void test('Giedi original purchase gives one actual occupied bonus to reciprocal ally even when native buyer fills its hand', () => {
  let game = freshBiddingGame('harkonnen');
  qualifyDefensePosition(game, 'homeworld:harkonnen');
  biddingPlayer(game, 'occupier').ally = 'ally';
  biddingPlayer(game, 'ally').ally = 'occupier';
  stageBiddingHandSize(game, 'native', 7);
  stageBiddingHandSize(game, 'occupier', 4);
  stageBiddingHandSize(game, 'ally', 3);
  game = normalBidding(game);
  // Original Storm/card choices can spend a staged card. Freeze the tested
  // receiving capacities at the settled original purchase boundary.
  stageBiddingHandSize(game, 'native', 7);
  stageBiddingHandSize(game, 'occupier', 4);
  stageBiddingHandSize(game, 'ally', 3);
  const original = biddingPhysicalIds(game), before = cash(game), allyCards = biddingPlayer(game, 'ally').hand.length;
  game = buyOriginalNormalLot(game, 'native', 5);
  game = advanceOriginal(game, game => game.decision?.kind === 'homeworldOccupiedBonus');
  assert.equal(biddingPlayer(game, 'native').hand.length, 8);
  const offer = viewGame(game, 'occupier').homeworldOccupiedBonus!;
  assert.deepEqual(offer.recipients.map(recipient => recipient.player), ['ally']);
  const filled = structuredClone(game);
  stageBiddingHandSize(filled, 'ally', 4);
  const exhaustedStock = filled.deck.length + filled.discard.length;
  const continued = normalizeAutomaticGame(JSON.parse(JSON.stringify(filled)));
  assert.equal(continued.pendingHomeworldOccupiedBonus, null, 'a now-impossible real receiver consumes the original suffix without awarding a card');
  assert.equal(biddingPlayer(continued, 'native').hand.length, 8);
  assert.equal(biddingPlayer(continued, 'occupier').hand.length, 4);
  assert.equal(biddingPlayer(continued, 'ally').hand.length, 4);
  assert.equal(continued.deck.length + continued.discard.length, exhaustedStock);
  assert.deepEqual(biddingPhysicalIds(continued), original);
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, 'occupier');
    view.players.find(player => player.id === 'occupier')!.bot = difficulty;
    const choice = botActions(view)[0];
    assert.ok(choice);
    const result = applyAction(JSON.parse(JSON.stringify(game)), 'occupier', choice);
    assert.equal(biddingPlayer(result, 'ally').hand.length, allyCards + 1);
    assert.equal(biddingPlayer(result, 'native').hand.length, 8);
    assert.equal(biddingPlayer(result, 'occupier').hand.length, 4);
    assert.deepEqual(biddingPhysicalIds(result), original);
  }
  const action = { type: 'decision', event: offer.event, recipient: 'ally' };
  for (const [actor, choice] of [['native', action], ['occupier', { ...action, recipient: 'native' }]] as const) {
    const frozen = structuredClone(game);
    assert.throws(() => applyAction(game, actor, choice), RuleError);
    assert.deepEqual(game, frozen);
  }
  const corrupted = structuredClone(game);
  corrupted.currentAuctionSale!.winner = 'occupier';
  const frozen = structuredClone(corrupted);
  assert.throws(() => applyAction(corrupted, 'occupier', action), RuleError);
  assert.deepEqual(corrupted, frozen);
  game = applyAction(JSON.parse(JSON.stringify(game)), 'occupier', action);
  assert.equal(biddingPlayer(game, 'native').hand.length, 8);
  assert.equal(biddingPlayer(game, 'occupier').hand.length, 4);
  assert.equal(biddingPlayer(game, 'ally').hand.length, allyCards + 1);
  assert.equal(biddingPlayer(game, 'native').spice, before.native - 5);
  assert.deepEqual(biddingPhysicalIds(game), original);
  assert.throws(() => applyAction(game, 'occupier', action), RuleError);
});

void test('Junction original shipment debits payer once, then allocates actual eligible native payment without changing movement', () => {
  let game = occupiedIncomeMovementFixture('junction', true, true).game;
  game = advanceOriginal(game, game => game.phase === 5 && game.active === 'owner' && !game.phaseOpening && !game.response && !game.decision);
  const view = viewGame(game, 'owner');
  view.players.find(seat => seat.id === 'owner')!.bot = 'Easy';
  const shipment = botActions(view).find(action => action.type === 'ship');
  assert.ok(shipment, 'original legal shipment control must offer a native-to-Arrakis purchase');
  const homeworldSources = nativeShipmentSources(view, 3, 0);
  assert.ok(homeworldSources, 'three original normal native reserve counters must be available');
  assert.deepEqual(homeworldSources, { 'homeworld:atreides': { normal: 3, elite: 0 } });
  const before = cash(game), cards = biddingPhysicalIds(game), reserves = biddingPlayer(game, 'owner').reserves;
  assert.ok(typeof shipment.territory === 'string' && typeof shipment.sector === 'number');
  const destination = `${shipment.territory}:${shipment.sector}`;
  const forces = biddingPlayer(game, 'owner').forces[destination] ?? 0;
  const mismatched = structuredClone(game), frozen = structuredClone(mismatched);
  assert.throws(() => applyAction(mismatched, 'owner',
    { ...shipment, amount: 2, elite: 0, allyPayment: 0, homeworldSources }), RuleError);
  assert.deepEqual(mismatched, frozen, 'a changed amount cannot reuse the original three-force source allocation');
  game = applyAction(JSON.parse(JSON.stringify(game)), 'owner',
    { ...shipment, amount: 3, elite: 0, allyPayment: 0, homeworldSources });
  assert.equal(game.decision?.kind, 'guildShipment');
  game = applyAction(game, game.decision!.player, { type: 'decision', allow: true });
  game = advanceOriginal(game, game => game.decision?.kind === 'homeworldOccupiedPercentage');
  const source = game.pendingHomeworldOccupiedPercentage!.source;
  assert.equal(source.kind, 'guild-shipping');
  const native = game.players.find(player => player.id === 'native')!, owner = game.players.find(player => player.id === 'owner')!;
  assert.equal(native.spice - before.native, Math.ceil(source.amount / 2));
  assert.equal(owner.spice - before.owner, -source.amount);
  assert.equal(owner.shipped, true);
  assert.equal(owner.reserves, reserves - 3);
  assert.equal(owner.forces[destination], forces + 3);
  assertDefenseInventory(game);
  const movement = structuredClone(owner.forces), offer = viewGame(game, 'owner').homeworldOccupiedPercentage!;
  game = applyAction(JSON.parse(JSON.stringify(game)), 'owner', { type: 'decision', event: offer.event, ownAmount: 0 });
  assert.deepEqual(game.players.find(player => player.id === 'owner')!.forces, movement);
  assert.equal(game.players.find(player => player.id === 'ally')!.spice - before.ally, Math.floor(source.amount / 2));
  assert.deepEqual(biddingPhysicalIds(game), cards);
});

void test('native Caladan cancellation keeps its actual face hidden from native while the separate printed occupier inspection settles', () => {
  let game = freshBiddingGame('atreides');
  qualifyDefensePosition(game, 'homeworld:atreides');
  const counter = stageBiddingKarama(game, 'observer');
  game = advanceOriginal(game, game => game.response?.kind === 'atreidesAuction');
  const actual = game.auction!.cards[game.auction!.index], original = biddingPhysicalIds(game);
  assert.equal(viewGame(game, 'native').auction!.card, null);
  assert.equal(viewGame(game, 'occupier').auction!.card, null, 'printed sharing does not inspect before the original opportunity resolves');
  game = applyAction(game, 'observer', { type: 'card', card: counter.id, mode: 'cancel' });
  game = advanceOriginal(game, game => !game.response && !game.decision);
  assert.equal(game.auction!.peekKnown, false);
  assert.equal(viewGame(game, 'native').auction!.card, null);
  assert.deepEqual(viewGame(game, 'occupier').auction!.card, actual);
  assert.equal(viewGame(game, 'ally').auction!.card, null);
  assert.equal(viewGame(game, 'observer').auction!.card, null);
  assert.deepEqual(biddingPhysicalIds(game), original);
});

void test('Southern aggregates actual desert, completed shared legs and a Fremen occupied-bank award once; redistribution triggers actual Giedi hook only once', () => {
  let game = freshSouthernProducerGame();
  game = advanceOriginal(game, game => game.phase === 5 && !game.phaseOpening && !game.response && !game.decision);
  // Labelled conserved position: original Arrakis counters return to their own
  // reserves before being placed, with starred identities kept in their subset.
  for (const player of game.players) {
    player.reserves += Object.values(player.forces).reduce((sum, n) => sum + n, 0);
    player.forces = {};
    if (player.elites) {
      player.elites.reserves += Object.values(player.elites.forces).reduce((sum, n) => sum + n, 0);
      player.elites.forces = {};
    }
  }
  const native = biddingPlayer(game, 'native'), ecaz = biddingPlayer(game, 'ecaz');
  assert.ok(native.reserves - native.elites!.reserves >= 4);
  native.reserves -= 4;
  native.forces = { 'hagga_basin:12': 2, 'red_chasm:7': 1 };
  clearDefenseNative(game, 'homeworld:atreides');
  game.homeworlds!.custody!.visitors['homeworld:atreides'] = { native: { normal: 1, elite: 0 } };
  ecaz.reserves--;
  ecaz.forces['hagga_basin:12'] = 1;
  native.ally = ecaz.id; ecaz.ally = native.id;
  biddingPlayer(game, 'occupier').ally = 'ally';
  biddingPlayer(game, 'ally').ally = 'occupier';
  game.spice['hagga_basin:12'] = 5;
  game.spice['red_chasm:7'] = 4;
  qualifyDefensePosition(game, 'homeworld:fremen');
  assertDefenseInventory(game);
  const original = biddingPhysicalIds(game), before = cash(game);
  const tanks = game.players.map(player => [player.id, player.tanks, player.elites?.tanks ?? 0]);
  let bankLeg = '';
  for (let step = 0; game.decision?.kind !== 'homeworldOccupiedPercentage' && step < 500; step++) {
    if (game.phase === 5 && !game.response && !game.decision && !game.phaseOpening)
      game = applyAction(game, game.active!, { type: 'endMovement' });
    else if (game.decision?.kind === 'ecazSpice')
      game = applyAction(game, game.decision.player, { type: 'decision', event: game.ecazCollection!.event, allocation: { kind: 'equal' } });
    else if (game.decision?.kind === 'homeworldOccupiedIncome') {
      const offer = viewGame(game, game.decision.player).homeworldOccupiedIncome!;
      if (offer.world === 'homeworld:atreides') {
        assert.equal(offer.amount, 2);
        assert.equal(offer.owner, 'native');
        bankLeg = `${offer.event}:${offer.world}:${offer.owner}`;
      }
      game = applyAction(game, game.decision.player, { type: 'decision', event: offer.event, world: offer.world, ownAmount: offer.amount });
    } else {
      const prior = game;
      game = advanceOriginal(game, next => next !== prior);
    }
  }
  assert.equal(game.decision?.kind, 'homeworldOccupiedPercentage');
  const source = game.pendingHomeworldOccupiedPercentage!.source;
  assert.equal(source.kind, 'fremen-collection');
  if (source.kind !== 'fremen-collection') throw new RuleError('Expected original Collection source');
  assert.equal(source.amount, 7, 'two printed desert spice, three actual shared spice and two actual Caladan bank spice aggregate before rounding');
  assert.ok(bankLeg, 'the actual native Caladan bank allocation must have completed');
  assert.deepEqual(source.collection.collected, [
    { id: 'ordinary:native', amount: 2 },
    { id: 'shared:hagga_basin:native', amount: 3 },
    { id: bankLeg, amount: 2 },
  ]);
  assert.equal(game.spice['red_chasm:7'], 2, 'one normal desert force collects two, without Arrakeen/Carthag rate three');
  assert.equal(game.spice['hagga_basin:12'], 0);
  assert.equal(game.ecazCollection!.stage, 'complete');
  assert.equal(game.ecazCollection!.settled[0].ecazAmount, 2);
  assert.equal(game.ecazCollection!.settled[0].allyAmount, 3);
  assert.equal(biddingPlayer(game, 'native').spice - before.native, 4, 'native keeps half of already credited actual Collection, not another credit');
  assert.ok(game.giediCollection, 'original occupied bank Collection already exercised high Giedi once');
  const offer = viewGame(game, 'occupier').homeworldOccupiedPercentage!;
  game = applyAction(JSON.parse(JSON.stringify(game)), 'occupier', { type: 'decision', event: offer.event, ownAmount: 2 });
  assert.equal(biddingPlayer(game, 'native').spice - before.native, 4);
  assert.equal(biddingPlayer(game, 'occupier').spice - before.occupier, 6, 'two bank icons, one two-spice Giedi hook and two occupied percentage spice');
  assert.equal(biddingPlayer(game, 'ally').spice - before.ally, 1);
  assert.equal(Object.values(cash(game)).reduce((sum, amount) => sum + amount, 0) -
    Object.values(before).reduce((sum, amount) => sum + amount, 0), 13,
  'seven physical desert spice plus four printed bank icons and one two-spice Giedi award enter wallets once');
  assert.equal(game.homeworldOccupiedPercentageLedger!.receipts.filter(row => row.source.kind === 'fremen-collection').length, 1);
  assert.deepEqual(biddingPhysicalIds(game), original);
  assert.deepEqual(game.players.map(player => [player.id, player.tanks, player.elites?.tanks ?? 0]), tanks);
  assertDefenseInventory(game);
});

void test('original Richese Ambassador purchase displaces one real Giedi bonus, while full-hand failed acquisition creates no bonus', () => {
  for (const nativeHand of [7, 8]) {
    let game = freshBiddingGame('harkonnen', 'ecaz');
    qualifyDefensePosition(game, 'homeworld:harkonnen');
    game = advanceOriginal(game, game => game.phase === 5 && game.active === 'occupier' &&
      !game.response && !game.decision && !game.phaseOpening);
    // Controlled conserved marker position, not a fabricated purchase. Every
    // original token identity remains; exchanging two cohort positions only
    // arranges which original marker the forthcoming real entry will meet.
    const state = game.ecazAmbassadors!, marker = state.tokens.find(token => token.effect === 'richese')!;
    if (!state.cohort.includes(marker.id)) {
      const displaced = state.tokens.find(token => token.id === state.cohort[0])!;
      state.cohort[0] = marker.id;
      displaced.zone = 'pool'; displaced.location = null;
    }
    for (const token of state.tokens) if (token.location === 'arrakeen') {
      token.location = null; token.zone = 'supply';
    }
    marker.zone = 'placed'; marker.location = 'arrakeen';
    validateAmbassadors(state);
    // Restore a quiet original-stock position before the native entry producer.
    for (const player of game.players) {
      player.reserves += Object.values(player.forces).reduce((sum, n) => sum + n, 0);
      player.forces = {};
      if (player.elites) {
        player.elites.reserves += Object.values(player.elites.forces).reduce((sum, n) => sum + n, 0);
        player.elites.forces = {};
      }
    }
    biddingPlayer(game, 'native').ally = 'ally';
    biddingPlayer(game, 'ally').ally = 'native';
    const mover = biddingPlayer(game, 'occupier');
    assert.ok(mover.reserves > 0);
    mover.reserves--;
    mover.forces['imperial_basin:10'] = 1;
    assert.equal(distance('imperial_basin:10', 'arrakeen:10'), 1);
    recordDefensePosition(game, 'conserved-original-ambassador-adjacent-movement-position');
    assertDefenseInventory(game);
    stageBiddingHandSize(game, 'native', nativeHand);
    stageBiddingHandSize(game, 'occupier', 2);
    const buyer = biddingPlayer(game, 'native');
    if (buyer.spice < 3) {
      const donor = game.players.find(player => player.id !== buyer.id && player.spice >= 3)!;
      const amount = 3 - buyer.spice;
      donor.spice -= amount; buyer.spice += amount;
    }
    const original = biddingPhysicalIds(game);
    const entryCash = cash(game), tanks = game.players.map(player => [player.id, player.tanks, player.elites?.tanks ?? 0]);
    game = applyAction(game, 'occupier',
      { type: 'move', from: 'imperial_basin:10', territory: 'arrakeen', sector: 10, amount: 1, elite: 0 });
    game = advanceOriginal(game, game => game.pendingAmbassador?.stage === 'offer');
    assert.deepEqual(cash(game), entryCash, 'original clean movement creates no paid Guild income response');
    assert.equal(game.response, null);
    assert.equal(biddingPlayer(game, 'occupier').forces['imperial_basin:10'] ?? 0, 0);
    assert.equal(biddingPlayer(game, 'occupier').forces['arrakeen:10'], 1);
    assertDefenseInventory(game);
    const before = cash(game), stock = game.deck.length + game.discard.length;
    const entry = game.pendingAmbassador!.event;
    game = applyAction(game, 'ally', { type: 'decision', event: entry, trigger: true, beneficiary: 'native' });
    if (nativeHand === 8) {
      assert.equal(game.pendingHomeworldOccupiedBonus, null);
      assert.equal(biddingPlayer(game, 'native').spice, before.native);
      assert.equal(game.deck.length + game.discard.length, stock);
      assert.equal(biddingPlayer(game, 'native').hand.length, 8);
      assert.equal(game.pendingAmbassador, null);
      assert.equal(biddingPlayer(game, 'occupier').hand.length, 2);
    } else {
      assert.equal(game.decision?.kind, 'homeworldOccupiedBonus');
      assert.equal(game.pendingAmbassador!.purchaseReceipt!.buyer, 'native');
      assert.equal(biddingPlayer(game, 'native').spice, before.native - 3);
      assert.equal(biddingPlayer(game, 'native').hand.length, 8);
      const offer = viewGame(game, 'occupier').homeworldOccupiedBonus!;
      assert.deepEqual(offer.recipients.map(recipient => recipient.player), ['occupier']);
      game = applyAction(JSON.parse(JSON.stringify(game)), 'occupier',
        { type: 'decision', event: offer.event, recipient: 'occupier' });
      assert.equal(biddingPlayer(game, 'occupier').hand.length, 3);
      assert.equal(biddingPlayer(game, 'native').hand.length, 8);
      assert.equal(game.deck.length + game.discard.length, stock - 2, 'one paid acquisition and exactly one physical bonus');
      assert.equal(game.pendingAmbassador, null);
    }
    assert.deepEqual(biddingPhysicalIds(game), original);
    assert.deepEqual(game.players.map(player => [player.id, player.tanks, player.elites?.tanks ?? 0]), tanks);
    assertDefenseInventory(game);
  }
});

void test('native Richese compulsory-cache Karama cancellation restores one ordinary lot without changing cache or wallets', () => {
  let game = freshBiddingGame('richese');
  qualifyDefensePosition(game, 'homeworld:richese');
  const counter = stageBiddingKarama(game, 'observer');
  game = advanceOriginal(game, game => game.response?.kind === 'richeseAuction' && !game.phaseOpening);
  assert.equal(game.response!.owner, 'native');
  const cache = game.richeseCache!.map(card => card.id), original = biddingPhysicalIds(game), before = cash(game);
  const receipts = game.homeworldOccupiedPercentageLedger!.receipts.length;
  const action = { type: 'card', card: counter.id, mode: 'cancel' };
  for (const state of [game, JSON.parse(JSON.stringify(game)) as Game]) {
    const canceled = applyAction(state, 'observer', action);
    assert.equal(canceled.phase, 3);
    assert.equal(canceled.richeseAuction, null, 'the compulsory cache lot does not run after cancellation');
    assert.ok(canceled.auction && canceled.auction.cards.length > 0, 'one ordinary lot is restored');
    assert.deepEqual(canceled.richeseCache!.map(card => card.id), cache, 'the physical cache is untouched');
    assert.deepEqual(cash(canceled), before, 'the cancellation itself costs no spice');
    assert.equal(biddingPlayer(canceled, 'observer').hand.some(card => card.id === counter.id), false, 'the Karama leaves its hand');
    assert.equal(canceled.discard.filter(card => card.id === counter.id).length, 1, 'exactly one physical Karama is consumed');
    assert.equal(canceled.pendingHomeworldOccupiedPercentage, null);
    assert.equal(canceled.pendingHomeworldOccupiedBonus, null);
    assert.equal(canceled.homeworldOccupiedPercentageLedger!.receipts.length, receipts);
    assert.deepEqual(biddingPhysicalIds(canceled), original);
    assertDefenseInventory(canceled);
  }
});

void test('occupied Guild receipt preserves the original concurrent BG accompaniment until after its percentage choice', () => {
  let game = freshGuildAdvisorProducerGame();
  qualifyDefensePosition(game, 'homeworld:guild');
  game = advanceOriginal(game, game => game.phase === 5 && !game.phaseOpening && !game.response && !game.decision);
  // Labelled conserved quiet board; no original force or wallet is minted.
  for (const player of game.players) {
    player.reserves += Object.values(player.forces).reduce((sum, amount) => sum + amount, 0);
    player.forces = {};
    if (player.elites) {
      player.elites.reserves += Object.values(player.elites.forces).reduce((sum, amount) => sum + amount, 0);
      player.elites.forces = {};
    }
  }
  const buyer = biddingPlayer(game, 'buyer'), totalCash = Object.values(cash(game)).reduce((sum, amount) => sum + amount, 0);
  for (const donor of game.players) {
    if (donor.id === buyer.id || buyer.spice >= 6) continue;
    const amount = Math.min(donor.spice, 6 - buyer.spice);
    donor.spice -= amount; buyer.spice += amount;
  }
  assert.ok(buyer.spice >= 6);
  assert.equal(Object.values(cash(game)).reduce((sum, amount) => sum + amount, 0), totalCash);
  recordDefensePosition(game, 'quiet-original-guild-advisor-source');
  for (let step = 0; game.active !== 'buyer' && step < 80; step++) {
    if (!game.phaseOpening && !game.response && !game.decision && game.active)
      game = applyAction(game, game.active, { type: 'endMovement' });
    else { const before = game; game = advanceOriginal(game, next => next !== before); }
  }
  assert.equal(game.active, 'buyer');
  stageBiddingKarama(game, 'observer');
  const before = cash(game), cards = biddingPhysicalIds(game);
  game = applyAction(game, 'buyer', { type: 'ship', territory: 'hagga_basin', sector: 12,
    amount: 3, elite: 0, allyPayment: 0, homeworldSources: nativeShipmentSources(viewGame(game, 'buyer'), 3, 0) });
  assert.equal(game.decision?.kind, 'guildShipment');
  game = applyAction(game, game.decision!.player, { type: 'decision', allow: true });
  assert.equal(game.response?.kind, 'guildIncome');
  assert.equal(game.decision?.kind, 'advisor');
  game = advanceOriginal(game, game => game.decision?.kind === 'homeworldOccupiedPercentage');
  const offer = viewGame(game, 'occupier').homeworldOccupiedPercentage!;
  assert.equal(offer.amount, 3);
  game = applyAction(JSON.parse(JSON.stringify(game)), 'occupier',
    { type: 'decision', event: offer.event, ownAmount: 3 });
  assert.equal(game.decision?.kind, 'advisor');
  assert.equal(game.decision!.player, 'observer');
  const reserves = biddingPlayer(game, 'observer').reserves;
  game = applyAction(game, 'observer', { type: 'decision', accept: true, accompany: true, amount: 1 });
  game = advanceOriginal(game, game => !game.response && !game.decision);
  assert.equal(biddingPlayer(game, 'observer').reserves, reserves - 1);
  assert.equal(biddingPlayer(game, 'observer').forces['hagga_basin:12'], 1);
  assert.equal(biddingPlayer(game, 'buyer').forces['hagga_basin:12'], 3);
  assert.equal(biddingPlayer(game, 'buyer').spice, before.buyer - 6);
  assert.equal(biddingPlayer(game, 'native').spice, before.native + 3);
  assert.equal(biddingPlayer(game, 'occupier').spice, before.occupier + 3);
  assert.equal(biddingPlayer(game, 'observer').spice, before.observer);
  assert.deepEqual(biddingPhysicalIds(game), cards);
  assertDefenseInventory(game);
});
