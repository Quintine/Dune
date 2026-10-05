import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, normalizeAutomaticGame, RuleError, viewGame, handLimit, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { occupiedTupileFixture, freshTupileFixture, tupilePlayer, removeTupileForces, recordTupilePosition, restoreTupileNative, addTupileForces, TUPILE_WORLD } from './fixture-homeworld-occupied-tupile';
import { biddingPhysicalIds, stageBiddingHandSize } from './fixture-homeworld-occupied-bidding';
import { assertDefenseInventory, clearDefenseNative } from './fixture-homeworld-occupied-defenses';
import { advanceOriginal, buyOriginalNormalLot, cash } from './fixture-homeworld-occupied-producers';
import { DIFFICULTIES } from '../game/bot-profiles';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';

function cleanupFixture() {
  let game = normalizeAutomaticGame(occupiedTupileFixture(true, true).game);
  assert.equal(handLimit(tupilePlayer(game, 'occupier')), 5);
  assert.equal(handLimit(tupilePlayer(game, 'ally')), 9);
  stageBiddingHandSize(game, 'occupier', 5);
  stageBiddingHandSize(game, 'ally', 9);
  const before = cash(game), cards = biddingPhysicalIds(game), phase = game.phase;
  removeTupileForces(game, 'occupier');
  recordTupilePosition(game, 'runtime-last-original-force-left');
  game = normalizeAutomaticGame(JSON.parse(JSON.stringify(game)));
  return { game, before, cards, phase };
}

void test('original Tupile holders discard their own actual excess once after departure, with private choices and all four legal policies', () => {
  const fixture = cleanupFixture();
  let game = fixture.game;
  const completed: string[] = [];
  for (let step = 0; game.decision?.kind === 'homeworldTupileCleanup' && step < 3; step++) {
    const actor = game.decision.player, offer = viewGame(game, actor).homeworldTupileCleanup!;
    assert.equal(offer.excess, 1);
    assert.equal(offer.limit, actor === 'occupier' ? 4 : 8);
    assert.equal(viewGame(game, 'native').homeworldTupileCleanup, null);
    const input = structuredClone(game);
    const action = { type: 'decision', event: offer.event, cards: [offer.eligibleCards[0]] };
    assert.throws(() => applyAction(game, 'native', action), RuleError);
    assert.throws(() => applyAction(game, actor, { ...action, event: `${offer.event}:stale` }), RuleError);
    assert.throws(() => applyAction(game, actor, { ...action, cards: [] }), RuleError);
    assert.throws(() => applyAction(game, actor, { ...action, cards: [action.cards[0], action.cards[0]] }), RuleError);
    assert.deepEqual(game, input);
    for (const difficulty of DIFFICULTIES) {
      const view = viewGame(game, actor);
      view.players.find(player => player.id === actor)!.bot = difficulty;
      const choice = botActions(view)[0];
      assert.ok(choice);
      const result = applyAction(JSON.parse(JSON.stringify(game)), actor, choice);
      assert.equal(tupilePlayer(result, actor).hand.length, offer.limit);
      assert.deepEqual(biddingPhysicalIds(result), fixture.cards);
      assert.deepEqual(cash(result), fixture.before);
    }
    game = applyAction(JSON.parse(JSON.stringify(game)), actor, action);
    assert.ok(game.discard.some(card => card.id === action.cards[0]));
    assert.equal(tupilePlayer(game, actor).hand.length, offer.limit);
    assert.throws(() => applyAction(game, actor, action), RuleError);
    completed.push(actor);
  }
  assert.deepEqual(completed.sort(), ['ally', 'occupier']);
  assert.equal(game.pendingHomeworldTupileCleanup, null);
  assert.equal(game.phase, fixture.phase);
  assert.equal(handLimit(tupilePlayer(game, 'occupier')), 4);
  assert.equal(handLimit(tupilePlayer(game, 'ally')), 8);
  assert.deepEqual(cash(game), fixture.before);
  assert.deepEqual(biddingPhysicalIds(game), fixture.cards);
  assertDefenseInventory(game);
});

void test('native CHOAM low intelligence returns after the Advanced original departure without clearing prior usage or granting a new occupier', () => {
  let game = normalizeAutomaticGame(occupiedTupileFixture(true, false).game);
  assert.equal(viewGame(game, 'native').tupileIntelligence!.targets.find(row => row.player === 'occupier')!.blocked === null, false);
  removeTupileForces(game, 'occupier');
  restoreTupileNative(game, 1);
  addTupileForces(game, 'fremen');
  recordTupilePosition(game, 'runtime-native-and-unqualified-foreign-contact');
  game = normalizeAutomaticGame(game);
  assert.equal(viewGame(game, 'native').tupileIntelligence!.targets.find(row => row.player === 'fremen')!.blocked, null);
  const original = biddingPhysicalIds(game), before = cash(game);
  game = applyAction(game, 'native', { type: 'tupileIntelligence', target: 'fremen', category: 'weapons' });
  assert.equal(game.tupileIntelligence!.receipts.at(-1)!.spice, before.fremen);
  const frozen = structuredClone(game);
  assert.throws(() => applyAction(game, 'native', { type: 'tupileIntelligence', target: 'fremen', category: 'defenses' }), RuleError);
  assert.deepEqual(game, frozen);
  assert.deepEqual(cash(game), before);
  assert.deepEqual(biddingPhysicalIds(game), original);
  assert.equal(handLimit(tupilePlayer(game, 'fremen')), 4);
});

void test('the actual native Harkonnen auction admits its ninth card under the proved allied Tupile slot and draws no tenth bonus', () => {
  let game = freshTupileFixture(true).game;
  game = advanceOriginal(game, game => game.phase === 2 && !game.phaseOpening && !game.response && !game.decision);
  clearDefenseNative(game, TUPILE_WORLD);
  tupilePlayer(game, 'occupier').ally = 'ally';
  tupilePlayer(game, 'ally').ally = 'occupier';
  addTupileForces(game, 'occupier');
  recordTupilePosition(game, 'runtime-after-original-high-charity-sole-arrival');
  game = normalizeAutomaticGame(game);
  stageBiddingHandSize(game, 'ally', 8);
  game = advanceOriginal(game, game => game.phase === 3 && !!game.auction && !game.phaseOpening && !game.response && !game.decision);
  stageBiddingHandSize(game, 'ally', 8);
  const original = biddingPhysicalIds(game), before = cash(game), card = game.auction!.cards[game.auction!.index].id;
  assert.equal(viewGame(game, 'ally').players.find(player => player.id === 'ally')!.handLimit, 9);
  game = buyOriginalNormalLot(game, 'ally', 5);
  game = advanceOriginal(game, game => !game.currentAuctionSale && !game.response && !game.decision);
  assert.equal(tupilePlayer(game, 'ally').hand.length, 9);
  assert.ok(tupilePlayer(game, 'ally').hand.some(held => held.id === card));
  assert.equal(tupilePlayer(game, 'ally').spice, before.ally - 5);
  assert.deepEqual(biddingPhysicalIds(game), original);
  assertDefenseInventory(game);
});

void test('older occupation profiles gain no new slot and an unbacked saved flag cannot authorize a larger hand', () => {
  const game: Game = occupiedTupileFixture(true, true).game;
  delete game.homeworldTupilePreview;
  delete game.homeworldTupileState;
  delete game.pendingHomeworldTupileCleanup;
  const original = biddingPhysicalIds(game), before = cash(game);
  const old = normalizeAutomaticGame(game);
  assert.equal(viewGame(old, 'occupier').players.find(player => player.id === 'occupier')!.handLimit, 4);
  assert.equal(viewGame(old, 'ally').players.find(player => player.id === 'ally')!.handLimit, 8);
  const forged = structuredClone(old);
  tupilePlayer(forged, 'occupier').tupileHandSlot = true;
  const frozen = structuredClone(forged);
  assert.throws(() => viewGame(forged, 'occupier'), RuleError);
  assert.deepEqual(forged, frozen);
  assert.deepEqual(biddingPhysicalIds(old), original);
  assert.deepEqual(cash(old), before);
});

void test('actual paid foreign Tupile return queues both normal-limit cleanups and preserves original remaining movement without repeating forces or price', () => {
  let game = freshTupileFixture(true).game;
  game = advanceOriginal(game, game => game.phase === 2 && !game.phaseOpening && !game.response && !game.decision);
  clearDefenseNative(game, TUPILE_WORLD);
  tupilePlayer(game, 'occupier').ally = 'ally'; tupilePlayer(game, 'ally').ally = 'occupier';
  addTupileForces(game, 'occupier');
  recordTupilePosition(game, 'runtime-original-charity-before-real-return');
  game = normalizeAutomaticGame(game);
  for (let step = 0; !(game.phase === 5 && game.active === 'occupier' && !game.phaseOpening && !game.response && !game.decision) && step < 500; step++) {
    let choice: { player: string; action: Action } | undefined;
    if (game.phaseOpening) {
      const player = game.players.find(player => !game.phaseOpening!.passed.includes(player.id));
      if (player) choice = { player: player.id, action: { type: 'ready' } };
    } else if (game.response) {
      const player = game.players.find(player => !game.response!.passed.includes(player.id));
      if (player) choice = { player: player.id, action: { type: 'passResponse' } };
    } else if (game.decision?.kind === 'guildTiming')
      choice = { player: game.decision.player, action: { type: 'decision', take: true } };
    else if (game.phase === 3 && game.auction && !game.decision)
      choice = { player: game.auction.active, action: { type: 'passBid' } };
    else if (game.phase === 4 && !game.decision) {
      const player = game.players.find(player => !game.ready.includes(player.id));
      if (player) choice = { player: player.id, action: { type: 'ready' } };
    } else if (game.phase === 5 && game.active && !game.decision)
      choice = { player: game.active, action: { type: 'endMovement' } };
    if (!choice) for (const player of game.players) {
      const view = viewGame(game, player.id); view.players.find(seat => seat.id === player.id)!.bot = 'Easy';
      const action = view.biddingEnd && !view.biddingEnd.ready.includes(player.id)
        ? { type: 'biddingEnd', event: view.biddingEnd.event, mode: 'ready' } : botActions(view)[0];
      if (action) { choice = { player: player.id, action }; break; }
    }
    assert.ok(choice);
    game = applyAction(game, choice.player, choice.action);
  }
  assert.equal(game.phase, 5); assert.equal(game.active, 'occupier');
  stageBiddingHandSize(game, 'occupier', 5); stageBiddingHandSize(game, 'ally', 9);
  const cards = biddingPhysicalIds(game), before = cash(game), reserves = tupilePlayer(game, 'occupier').reserves;
  const quote = homeworldShipmentChoice(viewGame(game, 'occupier'), 'homeworld:guild',
    { [TUPILE_WORLD]: { normal: 1, elite: 0 } });
  assert.equal(quote.blocked, null); assert.equal(quote.cost, 1); assert.ok(quote.action);
  game = applyAction(JSON.parse(JSON.stringify(game)), 'occupier', quote.action);
  for (let step = 0; game.decision?.kind !== 'homeworldTupileCleanup' && step < 40; step++) {
    if (game.response) {
      const player = game.players.find(player => !game.response!.passed.includes(player.id))!;
      game = applyAction(game, player.id, { type: 'passResponse' });
    } else if (game.decision?.kind === 'homeworldShipmentGuild')
      game = applyAction(game, game.decision.player, { type: 'decision', allow: true, event: game.decision.event });
    else game = normalizeAutomaticGame(game);
  }
  assert.equal(game.decision?.kind, 'homeworldTupileCleanup');
  for (let step = 0; game.decision?.kind === 'homeworldTupileCleanup' && step < 3; step++) {
    const player = game.decision.player, offer = viewGame(game, player).homeworldTupileCleanup!;
    game = applyAction(JSON.parse(JSON.stringify(game)), player,
      { type: 'decision', event: offer.event, cards: offer.eligibleCards.slice(0, offer.excess) });
  }
  assert.equal(game.phase, 5); assert.equal(game.active, 'occupier');
  assert.equal(tupilePlayer(game, 'occupier').shipped, true);
  assert.equal(tupilePlayer(game, 'occupier').reserves, reserves + 1);
  assert.equal(game.homeworlds!.custody!.visitors[TUPILE_WORLD], undefined);
  assert.equal(tupilePlayer(game, 'occupier').spice, before.occupier - 1);
  assert.equal(tupilePlayer(game, 'occupier').hand.length, 4);
  assert.equal(tupilePlayer(game, 'ally').hand.length, 8);
  assert.deepEqual(biddingPhysicalIds(game), cards); assertDefenseInventory(game);
  const frozen = structuredClone(game);
  assert.throws(() => applyAction(game, 'occupier', quote.action!), RuleError);
  assert.deepEqual(game, frozen);
});
