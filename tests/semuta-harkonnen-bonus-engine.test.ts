import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createSemutaHarkonnenBonusFixture as fixture, actSemutaHarkonnenBonus as act,
  passSemutaHarkonnenBonus as pass, claimSemutaHarkonnenBonus as claim,
  allowSemutaHarkonnenBonus as allow, finishSemutaHarkonnenBonus as finish,
  semutaHarkonnenBonusPlayer as player, semutaHarkonnenBonusInventory as inventory,
  type SemutaHarkonnenBonusFixture,
} from './fixture-semuta-harkonnen-bonus';

const variants = [
  { kind: 'normal' as const, advanced: false },
  { kind: 'normal' as const, advanced: true },
  { kind: 'blackMarket' as const, advanced: true },
  { kind: 'ambassador' as const, advanced: false },
];
const resources = (game: Game) => ({ turn: game.turn, phase: game.phase, storm: game.storm,
  spice: game.spice, spiceDeck: game.spiceDeck, spiceDiscard: game.spiceDiscard,
  players: game.players.map(player => ({ id: player.id, spice: player.spice, bribes: player.bribes,
    forces: player.forces, reserves: player.reserves, tanks: player.tanks, elites: player.elites,
    leaders: player.leaders, ally: player.ally, allySinceTurn: player.allySinceTurn,
    shipped: player.shipped, moved: player.moved, revived: player.revived })) });
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaHarkonnenBonusFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.semutaPreview, true); assert.equal(f.game.advanced, f.advanced);
  assert.ok(f.beforeStartingDeal.players.every(player => player.hand.length === 0));
  assert.equal(player(f.afterSetup, f.owner).hand.length, 2);
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.equal(f.acquisition.price, 1);
  assert.ok(f.acquisition.steps.some(step => step.actor === f.holder && step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquisition.after, f.holder).spice, 1);
  assert.equal(player(f.acquisition.after, f.richese).spice - player(f.acquisition.before, f.richese).spice, 1);
  assert.equal(player(f.purchase.before, f.owner).spice - player(f.game, f.owner).spice, f.paid);
  assert.equal(player(f.game, f.owner).hand.length, player(f.purchase.before, f.owner).hand.length + 1);
  assert.equal(player(f.game, f.owner).hand.filter(card => card.id === f.purchased).length, 1);
  assert.equal(f.game.deck[0].id, f.bonus.id); assert.equal(player(f.game, f.owner).hand.some(card => card.id === f.bonus.id), false);
  assert.notEqual(f.purchased, f.cost); assert.notEqual(f.bonus.id, f.cost);
  assert.ok(player(f.game, f.holder).hand.some(card => card.id === f.semuta));
  assert.ok(player(f.game, f.spender).hand.some(card => card.id === f.cost));
  assert.equal(f.game.response?.kind, 'harkonnenBonus'); assert.equal(f.game.response?.owner, f.owner);
  assert.equal(f.game.decision ?? null, null); assert.equal(f.game.phaseOpening ?? null, null);
  assert.equal(f.game.pendingTreacheryDiscard ?? null, null);
  if (f.kind === 'ambassador') {
    assert.equal(f.game.turn, 1); assert.equal(f.game.phase, 5); assert.equal(f.paid, 3);
    assert.ok(f.packetCreation && f.placements && f.alliance && f.arrival && f.originalEntry);
    assert.equal(f.placements.steps.filter(step => step.actor === f.ecaz && step.action.type === 'decision' &&
      typeof step.action.token === 'string').length, 2);
    assert.ok(f.placements.steps.some(step => step.action.type === 'passResponse'));
    assert.equal(player(f.placements.before, f.ecaz).spice - player(f.placements.after, f.ecaz).spice, 3,
      'Two actually allowed placements charge their successive native prices1+2');
    assert.equal(f.placements.after.ecazAmbassadors?.tokens.find(token => token.effect === 'ecaz')?.location, 'sietch_tabr');
    assert.equal(f.placements.after.ecazAmbassadors?.tokens.find(token => token.effect === 'richese')?.location, 'habbanya_ridge_sietch');
    assert.equal(f.originalSale, null); assert.equal(f.originalAuction, null);
    assert.equal(f.originalEntry.effect, 'richese'); assert.equal(f.originalEntry.entrant, f.spender);
    assert.equal(f.originalEntry.owner, f.ecaz); assert.equal(f.originalEntry.beneficiary, f.owner);
    assert.equal(f.originalEntry.stage, 'bonus');
    assert.deepEqual(f.originalEntry.purchaseReceipt, { buyer: f.owner, card: f.purchased,
      amount: 3, emperor: f.spender, stage: 'bonus' });
    assert.equal(f.game.response?.source, 'ambassador'); assert.equal(f.game.response?.intent, f.originalEntry.event);
    assert.equal(f.game.active, f.spender); assert.equal(player(f.game, f.spender).shipped, true);
    assert.equal(player(f.game, f.spender).moved, 0);
    assert.ok(f.alliance.steps.some(step => step.actor === f.owner && step.action.type === 'ship' && step.action.territory === 'sietch_tabr'));
    assert.ok(f.alliance.steps.some(step => step.actor === f.ecaz && step.action.type === 'decision' && step.action.choice === 'alliance'));
    assert.ok(f.alliance.steps.some(step => step.actor === f.owner && step.action.type === 'decision' && step.action.accept === true));
    assert.equal(player(f.game, f.owner).ally, f.ecaz); assert.equal(player(f.game, f.ecaz).ally, f.owner);
    assert.equal(player(f.game, f.spender).ally, null);
    assert.equal(player(f.game, f.owner).forces['sietch_tabr:14'], 1);
    assert.equal(player(f.game, f.spender).forces['habbanya_ridge_sietch:17'], 1);
    assert.equal(player(f.purchase.before, f.spender).spice + 3, player(f.game, f.spender).spice,
      'The separate original Emperor income has already completed');
  } else {
    assert.equal(f.game.phase, 3); assert.equal(f.paid, 1); assert.equal(f.originalEntry, null);
    assert.ok(f.originalSale); assert.equal(f.originalSale.winner, f.owner);
    assert.equal(f.originalSale.amount, 1); assert.equal(f.originalSale.free, false);
    assert.equal(f.originalSale.origin, f.kind); assert.notEqual(f.game.response?.source, 'ambassador');
    if (f.kind === 'normal') {
      assert.equal(f.game.turn, 1); assert.equal(f.blackMarket, null); assert.ok(f.originalAuction);
      assert.equal(f.originalAuction.index, 0); assert.equal(f.originalAuction.cards[0].id, f.purchased);
      assert.ok(f.purchase.steps.some(step => step.actor === f.owner && step.action.type === 'bid' && step.action.amount === 1));
    } else {
      assert.equal(f.game.turn, 2); assert.equal(f.game.advanced, true); assert.ok(f.blackMarket && f.originalLot);
      assert.equal(f.originalLot.source, 'blackMarket'); assert.equal(f.originalLot.cardId, f.purchased);
      assert.ok(f.blackMarket.steps.some(step => step.actor === f.richese && step.action.type === 'decision' && step.action.card === f.purchased));
      assert.ok(player(f.blackMarket.before, f.richese).hand.some(card => card.id === f.purchased));
      assert.equal(player(f.game, f.richese).hand.some(card => card.id === f.purchased), false);
      assert.ok(f.purchase.steps.some(step => step.actor === f.owner && step.action.type === 'richeseBid' && step.action.amount === 1));
    }
  }
  assert.equal(f.sourceActionCount, f.actions.length); assert.equal(f.originalInventory.length, 45);
  assert.deepEqual(inventory(f.game), f.originalInventory);
}
function open(f: SemutaHarkonnenBonusFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, 'karamaBonusDiscard');
  assert.equal(pending.reaction?.stage, 'offer'); assert.equal(pending.batch.cause, 'karama:harkonnenBonus');
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, face: entry.publicFace })),
    [{ card: f.cost, by: f.spender, face: true }]);
  assert.notEqual(pending.batch.entries[0].card.id, f.purchased);
  if (pending.continuation.kind !== 'karamaBonusDiscard') throw Error('Use the separate original bonus cancellation cost');
  assert.equal(pending.continuation.player, f.spender); assert.equal(pending.continuation.card, f.cost);
  assert.deepEqual(pending.continuation.use.response, f.originalResponse);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.deepEqual(resources(game), resources(f.game));
  assert.deepEqual(game.currentAuctionSale ?? null, f.originalSale);
  assert.deepEqual(game.auction ?? null, f.originalAuction); assert.deepEqual(game.richeseAuction ?? null, f.originalLot);
  assert.deepEqual(game.richeseBidding ?? null, f.originalRound); assert.deepEqual(game.pendingAmbassador ?? null, f.originalEntry);
  assert.deepEqual(game.deck.map(card => card.id), f.originalDeck);
  assert.equal(player(game, f.owner).hand.filter(card => card.id === f.purchased).length, 1);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function originalTail(game: Game, f: SemutaHarkonnenBonusFixture, bonus: boolean) {
  game = finish(game, f.kind);
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.pendingKarama ?? null, null);
  assert.notEqual(game.response?.kind, 'harkonnenBonus');
  assert.deepEqual(resources(game), resources(f.game));
  assert.deepEqual(game.deck.map(card => card.id), bonus ? f.originalDeck.slice(1) : f.originalDeck);
  assert.equal(player(game, f.owner).hand.filter(card => card.id === f.purchased).length, 1);
  assert.equal(player(game, f.owner).hand.length, player(f.game, f.owner).hand.length + Number(bonus));
  assert.equal(player(game, f.owner).hand.filter(card => card.id === f.bonus.id).length, Number(bonus));
  assert.equal(game.discard.some(card => card.id === f.purchased), false);
  if (f.kind === 'normal') {
    assert.equal(game.auction?.index, f.originalAuction!.index + 1);
    assert.deepEqual(game.auction?.cards.map(card => card.id), f.originalAuction!.cards.map(card => card.id));
  } else if (f.kind === 'blackMarket') {
    assert.equal(game.decision?.kind, 'richeseDeclaration'); assert.equal(game.decision?.player, f.richese);
    assert.equal(game.richeseBidding?.blackMarketSold, true);
  } else {
    assert.equal(game.pendingAmbassador ?? null, null); assert.equal(game.active, f.spender);
    assert.deepEqual(game.movementRemaining, f.game.movementRemaining);
    assert.deepEqual(game.ecazAmbassadors, f.game.ecazAmbassadors);
  }
  assert.deepEqual(inventory(game), f.originalInventory);
  const snapshot = structuredClone(game); assert.deepEqual(finish(game, f.kind), snapshot);
  return game;
}
function prevented(game: Game, f: SemutaHarkonnenBonusFixture, claimed: boolean) {
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  return originalTail(game, f, false);
}

for (const variant of variants) for (const claimed of [false, true]) void test(
  `${variant.advanced ? 'Advanced' : 'Basic'} native ${variant.kind} Harkonnen bonus cost ${claimed ? 'claim' : 'pass'} preserves the paid acquisition and resumes its original tail once`, () => {
    const f = fixture(variant); nativeSource(f);
    const offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    const game = prevented(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
    reject(game, f.holder, { type: 'semutaCommit', event }); reject(game, f.holder, { type: 'semutaPass', event });
    reject(game, f.spender, f.action);
  });

void test('native normal, Black Market and Ambassador bonus allowances draw exactly the original next card after payment', () => {
  for (const variant of variants) {
    const f = fixture(variant); nativeSource(f);
    const game = originalTail(allow(structuredClone(f.game)), f, true);
    assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
    assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
  }
});

void test('fresh bonus costs reject stale, foreign and underlying actions without redrawing, refunding or retiring the source early', () => {
  for (const variant of variants) {
    const f = fixture(variant), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
    reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
    reject(game, f.spender, { type: 'semutaCommit', event });
    reject(game, f.spender, f.action); reject(game, f.owner, { type: 'passResponse' });
    reject(game, f.kind === 'ambassador' ? f.ecaz : f.owner, f.nativeAction);
    assert.deepEqual(game.pendingAmbassador ?? null, f.originalEntry);
    assert.deepEqual(game.currentAuctionSale ?? null, f.originalSale);
    assert.deepEqual(game.deck.map(card => card.id), f.originalDeck);
    prevented(pass(game), f, false);
  }
});

void test('all four minimal policies answer every original paid Harkonnen bonus cancellation source legally', () => {
  for (const variant of variants) {
    const f = fixture(variant), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    for (const difficulty of DIFFICULTIES) {
      const own = viewGame(offered, f.holder); own.players.find(player => player.id === f.holder)!.bot = difficulty;
      const before = structuredClone(own), action = botActions(own)[0]; assert.ok(action, difficulty);
      assert.deepEqual(own, before);
      assert.ok(action.type === 'semutaCommit' || action.type === 'semutaPass'); assert.equal(action.event, event);
      let game = act(structuredClone(offered), f.holder, action);
      const claimed = action.type === 'semutaCommit';
      if (game.pendingTreacheryDiscard?.reaction?.stage === 'select') {
        const choosing = viewGame(game, f.holder); choosing.players.find(player => player.id === f.holder)!.bot = difficulty;
        const selected = botActions(choosing)[0]; assert.ok(selected);
        assert.equal(selected.type, 'semutaSelect'); assert.equal(selected.card, f.cost);
        game = act(game, f.holder, selected);
      } else if (game.pendingTreacheryDiscard) game = pass(game);
      prevented(game, f, claimed);
    }
  }
});
