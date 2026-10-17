import assert from 'node:assert/strict';
import { applyAction, handLimit, type Action, type Game } from '../game/engine';
import type { RicheseAuctionMethod } from '../game/richese-auction';
import {
  allowRicheseBureaucratResponses, createRicheseBureaucratFixture,
  richeseBureaucratCards, richeseBureaucratPlayer,
} from './fixture-bureaucrat-richese-funding';

export type RicheseSelfPurchaseOptions = {
  method?: RicheseAuctionMethod;
  direction?: 'clockwise' | 'counterclockwise';
  price?: number;
  allyPayment?: number;
  emperor?: boolean;
  owner?: 'beneGesserit' | 'atreides' | 'emperor' | 'richese';
  counter?: boolean;
  /** An actual original open Black Market lot; never reflag/redeal played state. */
  initial?: Game;
};
export function createRicheseSelfPurchaseFixture(options: RicheseSelfPurchaseOptions = {}) {
  const method = options.method ?? options.initial?.richeseAuction?.method ?? 'silent';
  let game = options.initial ? structuredClone(options.initial)
    : createRicheseBureaucratFixture({ source: 'blackMarket', pledge: 0,
      method, direction: options.direction, emperor: options.emperor, owner: options.owner }).game;
  game = allowRicheseBureaucratResponses(game);
  assert.equal(game.phase, 3);
  assert.ok(game.richeseAuction && game.richeseAuction.source === 'blackMarket');
  assert.equal(game.richeseAuction.method, method);
  assert.equal(game.richeseAuction.outcome, null);
  assert.equal(game.richeseAuction.acted.length, 0);
  const seller = game.richeseAuction.owner;
  const player = richeseBureaucratPlayer(game, seller);
  assert.equal(player.faction, 'richese');
  const card = game.richeseAuction.cardId;
  assert.equal(player.hand.filter(c => c.id === card).length, 1);
  const trainer = game.leaderSkills?.assignments.find(a => a.skill === 'bureaucrat')?.owner;
  const banker = game.leaderSkills?.assignments.find(a => a.skill === 'spice-banker')?.owner;
  const emperor = game.players.find(p => p.faction === 'emperor')?.id;
  const counterActor = 'beneGesserit';
  let counterCard: string | undefined;
  if (options.counter) {
    const actor = richeseBureaucratPlayer(game, counterActor), held = actor.hand.find(c => c.effect === 'karama');
    if (held) counterCard = held.id;
    else {
      const at = game.deck.findIndex(c => c.effect === 'karama');
      assert.ok(at >= 0 && actor.hand.length > 0);
      const original = actor.hand[0]; actor.hand[0] = game.deck[at]; game.deck[at] = original;
      counterCard = actor.hand[0].id;
    }
  }
  const price = options.price ?? 5, allyPayment = options.allyPayment ?? 0;
  const donor = player.ally;
  const beforePledge = structuredClone(game), actions: { actor: string; action: Action }[] = [];
  if (allyPayment) {
    assert.ok(donor, 'Use the original real worm ally, never unpledged funding');
    const action: Action = { type: 'pledgeAid', amount: allyPayment };
    actions.push({ actor: donor, action }); game = applyAction(game, donor, action);
  }
  const beforeAction = structuredClone(game);
  const action: Action = { type: 'richeseBid', event: game.richeseAuction!.event, amount: price, allyPayment };
  return { game, beforePledge, beforeAction, actions, action, seller, payer: seller, donor,
    method, price, allyPayment, primary: price - allyPayment, card, trainer, banker, emperor,
    counterActor, counterCard, handLimit: handLimit(player),
    originalHand: player.hand.map(c => c.id), physical: richeseBureaucratCards(game) };
}
export type RicheseSelfPurchaseFixture = ReturnType<typeof createRicheseSelfPurchaseFixture>;

/** Real method opportunities only. Once Around needs a positive other bid to
 * reach the seller's final raise; all-zero keeps its original unsold shortcut. */
export function payRicheseSelfPurchase(f: RicheseSelfPurchaseFixture,
  options: { openingBid?: number } = {}): Game {
  let game = f.game;
  const act = (actor: string, action: Action) => {
    f.actions.push({ actor, action }); game = applyAction(game, actor, action);
  };
  if (f.method === 'silent') {
    const order = game.richeseAuction!.order;
    act(f.seller, f.action);
    for (const actor of order) if (actor !== f.seller)
      act(actor, { type: 'richeseBid', event: f.action.event, amount: 0, allyPayment: 0 });
  } else {
    const openingBid = options.openingBid ?? (f.method === 'onceAround' && f.price >= 2 ? 1 : 0);
    let opened = false;
    for (let n = 0; game.richeseAuction && !game.richeseAuction.outcome && n < 80; n++) {
      const actor = game.richeseAuction.active;
      assert.ok(actor, 'The original ordered auction must retain a bidder');
      if (actor === f.seller) {
        act(actor, { ...f.action, amount: f.price > 0 ? f.price : null });
      } else {
        const amount = !opened && openingBid > 0 ? openingBid : null;
        if (amount !== null) opened = true;
        act(actor, { type: 'richeseBid', event: f.action.event, amount, allyPayment: 0 });
      }
    }
  }
  assert.ok(!game.richeseAuction || game.richeseAuction.outcome, 'Complete only original auction opportunities');
  return game;
}
