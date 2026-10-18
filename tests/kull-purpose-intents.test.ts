import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, normalizeAutomaticGame, viewGame, type Game } from '../game/engine';
import { choamKullGame, kullShipmentAttempt, takeKullCard } from './fixture-choam-kull';

const player = (g: Game, id: string) => g.players.find(p => p.id === id)!;
function allowKull(offer: Game): Game {
  let g = applyAction(offer, 'c', {type:'kullDecision', event:offer.pendingKull!.event,
    source:'printed', card:'ix-kull-wahad'});
  for (let step = 0; g.pendingKull && step < 16; step++) {
    const responder = g.players.find(p => {
      const controls = viewGame(g, p.id).responseControls;
      return controls && !controls.hasPassed && controls.cancelCards.length;
    });
    g = responder ? applyAction(g, responder.id, {type:'passResponse'}) : normalizeAutomaticGame(g);
  }
  assert.equal(g.pendingKull, null);
  return g;
}
function normalLot(g: Game) {
  g.phase = 3; g.movementRemaining = [];
  g.auction = {cards:[g.deck.shift()!], index:0, bid:0, bidder:null,
    active:'e', passed:[], opener:0};
}

void test('Advanced Emperor force and leader specials share one effect while ordinary cancellation remains legal', () => {
  const initial = choamKullGame(); initial.phase = 4;
  const emperor = player(initial, 'e'); emperor.tanks = 2; emperor.reserves -= 2;
  const leader = emperor.leaders[0]; leader.dead = true;
  const la = takeKullCard(initial, 'La La La'); player(initial, 'c').hand.push(la);
  const card = emperor.hand[0].id;
  const offer = applyAction(initial, 'e', {type:'card', mode:'special', card, amount:1});
  assert.equal(offer.pendingKull?.purpose, 'special:emperor');
  const stopped = allowKull(offer);
  assert.equal(player(stopped, 'e').specialKaramaUsed, undefined);
  assert.deepEqual(stopped.kullRestrictions, [{player:'e',turn:2,phase:4,purpose:'special:emperor'}]);
  for (const change of [{amount:2}, {leader:leader.id}]) {
    const before = JSON.stringify(stopped);
    assert.throws(() => applyAction(stopped, 'e', {type:'card',mode:'special',card,...change}), /Kull Wahad/);
    assert.equal(JSON.stringify(stopped), before);
  }
  const parent = applyAction(stopped, 'c', {type:'card',mode:'choam',card:la.id,target:'e'});
  assert.ok(viewGame(parent, 'e').responseControls?.cancelCards.includes(card));
  const cancelOffer = applyAction(parent, 'e', {type:'card',mode:'cancel',card});
  assert.equal(cancelOffer.pendingKull?.purpose, 'cancel:choamWorthless:laLaLa');
  const canceled = applyAction(cancelOffer, 'c', {type:'kullDecision',event:cancelOffer.pendingKull!.event,decline:true});
  assert.ok(player(canceled, 'c').hand.some(c => c.id === la.id));
  assert.ok(canceled.choamWorthlessBlocked?.cards.includes(la.id));
  assert.equal(canceled.discard.filter(c => c.id === card).length, 1);
});

void test('Advanced free purchase and winning Karama payment share one effect and do not block a faction special', () => {
  const initial = choamKullGame({opponents:['harkonnen','beneGesserit','emperor']});
  normalLot(initial);
  const card = player(initial, 'e').hand[0].id;
  const offer = applyAction(initial, 'e', {type:'card',mode:'purchase',card});
  assert.equal(offer.pendingKull?.purpose, 'auction-free-purchase');
  const stopped = allowKull(offer);
  assert.throws(() => applyAction(stopped, 'e', {type:'card',mode:'purchase',card}), /Kull Wahad/);
  // Controlled winning-payment state on the same original unresolved physical lot.
  const payment = structuredClone(stopped);
  payment.auction!.bid = 1; payment.auction!.bidder = 'e';
  payment.decision = {kind:'auctionPayment',player:'e'};
  assert.throws(() => applyAction(payment, 'e', {type:'decision',karama:true,card}), /Kull Wahad/);
  assert.ok(player(payment, 'e').hand.some(c => c.id === card));
  const special = applyAction(stopped, 'e', {type:'card',mode:'special',card,target:'b',amount:1});
  assert.equal(special.pendingKull?.purpose, 'special:harkonnen');
  const continued = applyAction(special, 'c', {type:'kullDecision',event:special.pendingKull!.event,decline:true});
  assert.equal(player(continued, 'e').specialKaramaUsed, true);
  assert.equal(continued.discard.filter(c => c.id === card).length, 1);
  // Spending the only original card leaves a forced one-card return; it completes automatically.
  assert.equal(continued.pendingExchange ?? null, null);
  assert.equal(player(continued, 'b').hand.length, 1);
});

void test('Basic attempts and unstamped Advanced attempts retain the original all-purpose phase restriction', () => {
  for (const advanced of [false, true]) {
    const initial = choamKullGame({advanced});
    let offer = applyAction(initial, 'e', kullShipmentAttempt(initial));
    if (advanced) {
      // Exact legacy protocol fixture: old signed JSON omitted this new field.
      offer = structuredClone(offer);
      delete offer.pendingKull!.purpose;
      const signature = JSON.parse(offer.pendingKull!.signature);
      delete signature.purpose;
      offer.pendingKull!.signature = JSON.stringify(signature);
    }
    assert.equal(viewGame(offer, 'c').kullReaction?.scope, 'phase');
    const stopped = allowKull(offer);
    assert.deepEqual(stopped.kullRestrictions, [{player:'e',turn:2,phase:5}]);
    assert.ok(viewGame(stopped, 'e').karamaBlocked);
    assert.deepEqual(viewGame(stopped, 'e').karamaPurposeBlocks, []);
  }
});
