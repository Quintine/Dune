import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, normalizeAutomaticGame, viewGame, type Action, type Game } from '../game/engine';
import { nexusInventory, nexusReload } from './fixture-nexus-cards';
import { wonEmperorNexusBankAuction } from './fixture-nexus-emperor-purchase';

const owner = 'q';
function reject(g: Game, player: string, action: Action, reason: RegExp) {
  const before = JSON.stringify(g);
  assert.throws(() => applyAction(g, player, action), reason);
  assert.equal(JSON.stringify(g), before);
}

void test('real Basic/Advanced normal auction purchase keeps exactly the personally affordable bid and spends the physical Nexus card', () => {
  for (const advanced of [false, true]) {
    const g = wonEmperorNexusBankAuction(advanced);
    const price = g.auction!.bid;
    const lot = g.auction!.cards[g.auction!.index];
    const before = JSON.stringify(g);
    const ownerView = viewGame(g, owner);
    assert.deepEqual(ownerView.nexusEmperorSecretAlly!.purchase, { blocked: null, price });
    for (const id of ['p', 'r']) {
      assert.equal(viewGame(g, id).nexusEmperorSecretAlly, null);
      assert.equal(JSON.stringify(viewGame(g, id)).includes('nexusEmperorPurchaseHistory'), false);
    }
    const action = { type: 'nexusEmperorPurchase', event: ownerView.nexusEmperorSecretAlly!.event };
    const done = applyAction(g, owner, action);
    assert.equal(JSON.stringify(g), before);
    nexusInventory(done);
    assert.equal(done.players.find(p => p.id === owner)!.spice, g.players.find(p => p.id === owner)!.spice);
    assert.equal(done.players.find(p => p.id === owner)!.hand.filter(card => card.id === lot.id).length, 1);
    assert.equal(done.nexusCards!.cards!.hands[owner], null);
    assert.equal(done.nexusCards!.cards!.discard.filter(card => card === 'emperor').length, 1);
    assert.deepEqual(done.nexusEmperorPurchaseEvents, [action.event]);
    assert.equal(done.nexusEmperorPurchaseHistory?.[0].card, lot.id);
    assert.equal(done.nexusEmperorPurchaseHistory?.[0].price, price);
    assert.equal(done.nexusEmperorPurchaseHistory?.[0].afterSpice, done.nexusEmperorPurchaseHistory?.[0].beforeSpice);
    assert.equal(done.log.filter(entry => entry.text.includes('spent Emperor Nexus Secret Ally after proving')).length, 1);
    for (const p of done.players)
      assert.deepEqual(viewGame(nexusReload(done), p.id), viewGame(done, p.id));
    reject(done, owner, action, /Emperor Nexus|current|payment|card/i);
  }
});

void test('every eligible winner confirms payment regardless of concealed Emperor card ownership', () => {
  const withCard = wonEmperorNexusBankAuction(false);
  const without = nexusReload(withCard);
  without.nexusCards!.cards!.hands[owner] = null;
  without.nexusCards!.cards!.deck.push('emperor');
  const waitingWith = normalizeAutomaticGame(withCard);
  const waitingWithout = normalizeAutomaticGame(without);
  assert.deepEqual(waitingWith.decision, { kind: 'auctionPayment', player: owner });
  assert.deepEqual(waitingWithout.decision, waitingWith.decision);
  assert.equal(viewGame(waitingWithout, owner).nexusEmperorSecretAlly, null);
  const paid = applyAction(waitingWithout, owner, { type: 'decision', karama: false });
  assert.equal(paid.players.find(p => p.id === owner)!.spice,
    without.players.find(p => p.id === owner)!.spice - without.auction!.bid);
  assert.equal(paid.players.find(p => p.id === owner)!.hand.filter(
    card => card.id === without.auction!.cards[without.auction!.index].id).length, 1);
  nexusInventory(paid);
});

void test('a prior normal purchase cannot authorize spending Emperor Nexus on a later lot or revised bid', () => {
  let g = wonEmperorNexusBankAuction(false);
  const first = { type: 'nexusEmperorPurchase', event: viewGame(g, owner).nexusEmperorSecretAlly!.event };
  const revised = nexusReload(g);
  revised.auction!.bid++;
  assert.notEqual(viewGame(revised, owner).nexusEmperorSecretAlly!.event, first.event);
  reject(revised, owner, first, /current Emperor Nexus/i);
  g = applyAction(g, owner, { type: 'decision', karama: false });
  for (let i = 0; g.decision?.kind !== 'auctionPayment' && i < 20; i++) {
    if (g.auction?.active === owner && !g.auction.bid)
      g = applyAction(g, owner, { type: 'bid', amount: 2 });
    else if (g.auction)
      g = applyAction(g, g.auction.active, { type: 'passBid' });
  }
  assert.equal(g.auction?.index, 1);
  assert.equal(g.decision?.player, owner);
  assert.notEqual(viewGame(g, owner).nexusEmperorSecretAlly!.event, first.event);
  reject(g, owner, first, /current Emperor Nexus/i);
  const second = { type: 'nexusEmperorPurchase', event: viewGame(g, owner).nexusEmperorSecretAlly!.event };
  const done = applyAction(g, owner, second);
  assert.equal(done.nexusEmperorPurchaseHistory?.[0].auctionIndex, 1);
});

void test('invalid normal-lot custody and full winning hand cannot spend the physical Nexus card', () => {
  const g = wonEmperorNexusBankAuction(false);
  const action = { type: 'nexusEmperorPurchase', event: viewGame(g, owner).nexusEmperorSecretAlly!.event };
  const duplicate = nexusReload(g);
  duplicate.deck.push(structuredClone(g.auction!.cards[g.auction!.index]));
  assert.match(viewGame(duplicate, owner).nexusEmperorSecretAlly!.purchase!.blocked!, /conflicting physical custody/);
  reject(duplicate, owner, action, /conflicting physical custody/);
  const full = nexusReload(g);
  full.players.find(p => p.id === owner)!.hand.push(...full.deck.splice(0, 4));
  assert.match(viewGame(full, owner).nexusEmperorSecretAlly!.purchase!.blocked!, /room for the committed/);
  reject(full, owner, action, /room for the committed/);
});

void test('stale, foreign, malformed, underfunded and ally-funded purchase attempts reject before card or auction mutation', () => {
  const g = wonEmperorNexusBankAuction(false);
  const action = { type: 'nexusEmperorPurchase', event: viewGame(g, owner).nexusEmperorSecretAlly!.event };
  reject(g, 'p', action, /Emperor Nexus|current|payment/i);
  reject(g, owner, { ...action, event: 'stale' }, /current|payment/i);
  reject(g, owner, { ...action, price: 0 }, /current|payment/i);
  const underfunded = nexusReload(g);
  underfunded.players.find(p => p.id === owner)!.spice = g.auction!.bid - 1;
  assert.match(viewGame(underfunded, owner).nexusEmperorSecretAlly!.purchase!.blocked!, /own spice/);
  reject(underfunded, owner, action, /own spice/);
  const allyFunded = nexusReload(g);
  allyFunded.auction!.allyPayment = 1;
  assert.match(viewGame(allyFunded, owner).nexusEmperorSecretAlly!.purchase!.blocked!, /own spice/);
  reject(allyFunded, owner, action, /own spice/);
});

void test('signed historical purchase rejects a changed price, lot, proof or missing independent-use marker after JSON restore', () => {
  const g = wonEmperorNexusBankAuction(true);
  const action = { type: 'nexusEmperorPurchase', event: viewGame(g, owner).nexusEmperorSecretAlly!.event };
  const done = applyAction(g, owner, action);
  for (const tamper of [
    (copy: Game) => { copy.nexusEmperorPurchaseHistory![0].price++; },
    (copy: Game) => { copy.nexusEmperorPurchaseHistory![0].card = 'forged-lot'; },
    (copy: Game) => { copy.nexusEmperorPurchaseHistory![0].afterSpice--; },
    (copy: Game) => { delete copy.nexusEmperorPurchaseEvents; },
    (copy: Game) => { copy.nexusEmperorPurchaseEvents!.push(action.event); },
  ]) {
    const copy = nexusReload(done);
    tamper(copy);
    const before = JSON.stringify(copy);
    assert.throws(() => viewGame(copy, owner), /Emperor Nexus purchase/);
    assert.equal(JSON.stringify(copy), before);
  }
});
