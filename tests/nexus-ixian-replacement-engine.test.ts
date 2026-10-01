import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { applyAction, createGame, initializeIxianNexusReplacementGameForAudit, joinGame, newPlayer, normalizeAutomaticGame, viewGame, type Action, type Game } from '../game/engine';
import { baseDeck } from '../game/cards';
import { createIxianNexusReplacementFixture, settleIxianReplacementFixture } from './fixture-nexus-ixian-replacement';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game));
const owner = (game: Game,id: string) => game.players.find(p => p.id === id)!;
function inventory(game: Game): void {
  const physical = [...game.players.flatMap(p => p.hand),...game.deck,...game.discard,
    ...(game.auction?.cards.slice(game.auction.index + Number(game.currentAuctionSale?.origin === 'normal')) ?? [])];
  assert.deepEqual(physical.map(c => c.id).sort(),baseDeck().map(c => c.id).sort());
}
function reject(game: Game,id: string,action: Action): void {
  const before = reload(game);
  assert.throws(() => applyAction(game,id,action));
  assert.deepEqual(game,before,'A rejected declaration must spend no Nexus, draw or spice.');
}
/** Captured from genuine six-seat native play: seeded setup, paid auctions,
 * legal battle plans and winner discards. No row inflation or card deletion. */
function depletedNativeParent(): Game {
  const game = normalizeAutomaticGame(JSON.parse(readFileSync(
    new URL('./fixtures/nexus-ixian-native-depleted.json', import.meta.url), 'utf8')));
  assert.equal(game.deck.length, 0);
  assert.equal(game.decision?.kind, 'auctionPayment');
  inventory(game);
  return game;
}

for (const advanced of [false,true]) for (const karama of [false,true]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} ${karama ? 'printed Karama' : 'paid'} exact purchased replacement keeps the original ledger and native suffix once`,() => {
    const fixture = createIxianNexusReplacementFixture({advanced,karama});
    const {game,beforePayment,buyer,event,purchased} = fixture;
    assert.equal(owner(game,buyer).spice,fixture.beforeSpice - (karama ? 0 : 2));
    assert.equal(owner(game,fixture.emperor!).spice,fixture.beforeEmperorSpice);
    assert.deepEqual(game.currentAuctionSale,{winner:buyer,amount:2,free:karama,origin:'normal',seller:null});
    assert.deepEqual(owner(game,buyer).hand,[...owner(beforePayment,buyer).hand.filter(c => !karama || c.effect !== 'karama'),purchased]);
    assert.deepEqual(normalizeAutomaticGame(reload(game)),game,'Normalization cannot bypass the neutral owner decision.');
    const pass = settleIxianReplacementFixture(applyAction(reload(game),buyer,{type:'nexusIxianReplacementPass',event}));
    const use = settleIxianReplacementFixture(applyAction(reload(game),buyer,{type:'nexusIxianReplacementUse',event}));
    assert.ok(fixture.nextCard);
    assert.deepEqual(owner(use,buyer).hand,[...owner(beforePayment,buyer).hand.filter(c => !karama || c.effect !== 'karama'),fixture.nextCard]);
    assert.equal(owner(use,buyer).hand.some(c => c.id === purchased.id),false);
    assert.equal(use.discard.some(c => c.id === purchased.id),true);
    assert.equal(use.nexusCards!.cards!.hands[buyer],null);
    assert.equal(use.nexusCards!.cards!.discard.filter(face => face === 'ixians').length,1);
    assert.equal(pass.nexusCards!.cards!.hands[buyer],'ixians');
    assert.equal(owner(pass,buyer).hand.some(c => c.id === purchased.id),true);
    assert.equal(owner(pass,buyer).spice,fixture.paidSpice);
    assert.equal(owner(use,buyer).spice,fixture.paidSpice);
    assert.equal(owner(use,fixture.emperor!).spice,fixture.beforeEmperorSpice! + (karama ? 0 : 2));
    assert.equal(owner(pass,fixture.emperor!).spice,owner(use,fixture.emperor!).spice);
    assert.equal(use.auction?.index,fixture.auctionIndex + 1);
    assert.equal(pass.auction?.index,use.auction?.index);
    assert.equal(use.currentAuctionSale,null);
    assert.equal(use.pendingNexusIxianReplacement,null);
    assert.equal(use.nexusIxianReplacementHistory!.length,1);
    assert.equal(use.nexusIxianReplacementHistory![0].source.card.id,purchased.id);
    assert.deepEqual(use.nexusIxianReplacementHistory![0].replacement,fixture.nextCard);
    const unsold = game.auction!.cards.slice(game.auction!.index + 1);
    assert.ok(unsold.every(c => c.id !== fixture.nextCard!.id),'Replacement comes from the draw deck, never the unsold auction row.');
    inventory(use); inventory(pass);
    const restored = reload(use);
    assert.deepEqual(normalizeAutomaticGame(restored),use);
    reject(restored,buyer,{type:'nexusIxianReplacementUse',event});
    reject(restored,buyer,{type:'nexusIxianReplacementPass',event});
  });
}

void test('normal purchased replacement at a genuine full hand is discard-first and net zero',() => {
  const f = createIxianNexusReplacementFixture({fullHand:true});
  assert.equal(owner(f.beforePayment,f.buyer).hand.length,3);
  assert.equal(owner(f.game,f.buyer).hand.length,4);
  const use = applyAction(f.game,f.buyer,{type:'nexusIxianReplacementUse',event:f.event});
  assert.equal(owner(use,f.buyer).hand.length,4);
  assert.deepEqual(owner(use,f.buyer).hand,[...owner(f.beforePayment,f.buyer).hand,f.nextCard]);
  inventory(use);
});

void test('native depleted purchase can redraw its exact discarded physical card', t => {
  const parent = depletedNativeParent();
  const buyer = parent.decision!.player;
  const purchased = parent.auction!.cards[parent.auction!.index];
  const originalPool = structuredClone(parent.auction!.cards);
  const paid = applyAction(parent, buyer, {type:'decision', karama:false});
  const event = paid.pendingNexusIxianReplacement!.event;
  let first = true;
  t.mock.method(crypto, 'getRandomValues', (values: Uint32Array) => {
    assert.ok(values instanceof Uint32Array);
    values.fill(first ? 0 : 0xffffffff);
    first = false;
    return values;
  });
  const use = applyAction(reload(paid), buyer, {type:'nexusIxianReplacementUse', event});
  assert.deepEqual(owner(use, buyer).hand, owner(paid, buyer).hand);
  assert.equal(use.nexusIxianReplacementHistory!.at(-1)!.replacement?.id, purchased.id);
  assert.equal(use.nexusCards!.cards!.hands[buyer], null);
  assert.equal(use.discard.length, 0);
  assert.equal(use.deck.length, paid.discard.length);
  assert.deepEqual(use.auction!.cards, originalPool, 'native reserved lots stay intact');
  inventory(use);
});

void test('native depleted purchase draws from canonical discard without taking an unsold lot', t => {
  const parent = depletedNativeParent();
  const buyer = parent.decision!.player;
  const expected = parent.discard[0];
  const unsold = parent.auction!.cards.slice(parent.auction!.index + 1).map(card => card.id);
  const paid = applyAction(parent, buyer, {type:'decision', karama:false});
  t.mock.method(crypto, 'getRandomValues', (values: Uint32Array) => {
    assert.ok(values instanceof Uint32Array);
    values.fill(0xffffffff);
    return values;
  });
  const use = applyAction(paid, buyer, {type:'nexusIxianReplacementUse', event:paid.pendingNexusIxianReplacement!.event});
  const drawn = use.nexusIxianReplacementHistory!.at(-1)!.replacement!;
  assert.equal(drawn.id, expected.id);
  assert.equal(unsold.includes(drawn.id), false);
  assert.equal(use.discard.length, 0);
  assert.deepEqual(use.deck.map(card => card.id).sort(),
    [...paid.discard.map(card => card.id), paid.pendingNexusIxianReplacement!.card.id]
      .filter(id => id !== drawn.id).sort());
  inventory(use);
});

void test('Use/Pass accepts only the owned live event, never a held-card selector, replay or priority bypass',() => {
  const f = createIxianNexusReplacementFixture();
  const rival = f.game.players.find(p => p.id !== f.buyer)!.id;
  for (const action of [
    {type:'nexusIxianReplacementUse',event:f.event,card:owner(f.beforePayment,f.buyer).hand[0].id},
    {type:'nexusIxianReplacementPass',event:f.event,accept:true},
    {type:'nexusIxianReplacementUse',event:'old-event'},
    {type:'decision',accept:true}, {type:'ready'}, {type:'passBid'},
    {type:'card',card:owner(f.beforePayment,f.buyer).hand[0].id,mode:'purchase'},
  ]) reject(f.game,f.buyer,action);
  reject(f.game,rival,{type:'nexusIxianReplacementUse',event:f.event});
  reject(f.game,rival,{type:'nexusIxianReplacementPass',event:f.event});
  assert.deepEqual(applyAction(f.game,f.buyer,{type:'advanceBots'}),f.game);
});

void test('first payment, reload and precommit all require the same canonical physical original purchased source',() => {
  const f = createIxianNexusReplacementFixture();
  const wrongDescriptor = reload(f.beforePayment);
  wrongDescriptor.auction!.cards[wrongDescriptor.auction!.index].name = 'Forged purchase';
  reject(wrongDescriptor,f.buyer,f.paymentAction);
  const corruptions: ((g: Game) => void)[] = [
    g => { owner(g,f.buyer).hand = owner(g,f.buyer).hand.filter(c => c.id !== f.purchased.id); },
    g => { g.deck.push({...f.purchased}); },
    g => { owner(g,f.buyer).hand.find(c => c.id === f.purchased.id)!.kind = 'lasgun'; },
    g => { g.currentAuctionSale!.amount++; },
    g => { g.currentAuctionSale!.free = !g.currentAuctionSale!.free; },
    g => { g.currentAuctionSale!.origin = 'cache'; },
    g => { g.auction!.cards[g.auction!.index] = {...g.deck[0]}; },
    g => { g.auction!.index++; },
    g => { g.deck.reverse(); },
    g => { owner(g,f.buyer).spice++; },
    g => { g.pendingNexusIxianReplacement!.parent += 'changed'; },
    g => { g.nexusIxianReplacementCursor!.sequence++; },
    g => { owner(g,f.buyer).faction = 'harkonnen'; },
  ];
  for (const corrupt of corruptions) {
    const saved = reload(f.game);
    corrupt(saved);
    assert.throws(() => viewGame(saved,f.buyer));
    assert.throws(() => normalizeAutomaticGame(saved));
    reject(saved,f.buyer,{type:'nexusIxianReplacementUse',event:f.event});
  }
});

void test('public neutral offer is independent of secret held face and rivals see neither purchase nor eligibility',() => {
  const ix = createIxianNexusReplacementFixture();
  const irrelevant = createIxianNexusReplacementFixture({face:'richese'});
  const rival = ix.game.players.find(p => p.id !== ix.buyer)!.id;
  assert.deepEqual(viewGame(ix.game,rival).nexusIxianReplacement,viewGame(irrelevant.game,rival).nexusIxianReplacement);
  assert.deepEqual(viewGame(ix.game,rival).nexusIxianReplacement,
    {event:ix.event,buyer:ix.buyer,canPass:false,canUse:false,blocked:null,purchased:null});
  assert.equal(viewGame(ix.game,ix.buyer).nexusIxianReplacement!.canUse,true);
  const otherOffer = viewGame(irrelevant.game,irrelevant.buyer).nexusIxianReplacement!;
  assert.equal(otherOffer.canPass,true);
  assert.equal(otherOffer.canUse,false);
  assert.equal(otherOffer.blocked,null);
  reject(irrelevant.game,irrelevant.buyer,{type:'nexusIxianReplacementUse',event:irrelevant.event});
  const pass = applyAction(irrelevant.game,irrelevant.buyer,{type:'nexusIxianReplacementPass',event:irrelevant.event});
  assert.equal(pass.nexusCards!.cards!.hands[irrelevant.buyer],'richese');
  assert.ok(owner(pass,irrelevant.buyer).hand.some(c => c.id === irrelevant.purchased.id));
  const use = applyAction(ix.game,ix.buyer,{type:'nexusIxianReplacementUse',event:ix.event});
  const rivalView = viewGame(use,rival);
  assert.equal(rivalView.nexusIxianReplacement,null);
  assert.equal(rivalView.players.find(p => p.id === ix.buyer)!.hand,undefined);
  assert.equal(JSON.stringify(rivalView).includes(ix.nextCard!.id),false);
  assert.equal(rivalView.decision?.kind === 'nexusIxianReplacement',false);
});

void test('closed histories survive later card transfers and recycling but cannot lose their independent cursor',() => {
  const f = createIxianNexusReplacementFixture();
  let game = settleIxianReplacementFixture(applyAction(f.game,f.buyer,{type:'nexusIxianReplacementUse',event:f.event}));
  const rival = game.players.find(p => p.id !== f.buyer)!.id;
  const replacement = owner(game,f.buyer).hand.find(c => c.id === f.nextCard!.id)!;
  owner(game,f.buyer).hand = owner(game,f.buyer).hand.filter(c => c.id !== replacement.id);
  owner(game,rival).hand.push(replacement);
  game.deck.push(...game.discard.splice(0));
  game = reload(game);
  assert.equal(viewGame(game,f.buyer).nexusIxianReplacement,null);
  inventory(game);
  reject(game,f.buyer,{type:'nexusIxianReplacementUse',event:f.event});
  const dropped = reload(game);
  dropped.nexusIxianReplacementHistory = [];
  assert.throws(() => viewGame(dropped,f.buyer));
  const duplicated = reload(game);
  duplicated.nexusIxianReplacementHistory!.push({...duplicated.nexusIxianReplacementHistory![0]});
  assert.throws(() => normalizeAutomaticGame(duplicated));
});

void test('fresh initializer preserves admitted identities and fences classic-only modules and in-play retrofit',() => {
  let lobby = createGame('SAMEID',newPlayer('host','Atreides','atreides'),true,[]);
  joinGame(lobby,newPlayer('guest','Emperor','emperor'));
  joinGame(lobby,newPlayer('guild','Guild','guild'));
  for (const p of lobby.players) lobby = applyAction(lobby,p.id,{type:'ready'});
  lobby.nexusCards = {cards:null,phase:null};
  const initial = reload(lobby);
  const fixture = createIxianNexusReplacementFixture({initial:lobby});
  assert.equal(fixture.game.code,initial.code);
  assert.equal(fixture.game.advanced,true);
  assert.deepEqual(fixture.game.players.map(p => [p.id,p.name,p.faction]),initial.players.map(p => [p.id,p.name,p.faction]));
  assert.deepEqual(fixture.game.playerPositions,initial.playerPositions);
  assert.deepEqual(lobby,initial);
  assert.throws(() => initializeIxianNexusReplacementGameForAudit(fixture.game));
  const expansion = reload(lobby);
  expansion.expansions = ['ix'];
  assert.throws(() => initializeIxianNexusReplacementGameForAudit(expansion));
  const overlay = reload(lobby);
  overlay.ecazTreachery = true;
  assert.throws(() => initializeIxianNexusReplacementGameForAudit(overlay));
});

for (const karama of [false,true]) void test(`last native normal auction lot ${karama ? 'Karama' : 'paid'} completes once after Use`,() => {
  const f = createIxianNexusReplacementFixture({karama,endingAuction:true});
  assert.equal(f.game.auction!.index,f.game.auction!.cards.length - 1);
  const game = settleIxianReplacementFixture(applyAction(f.game,f.buyer,{type:'nexusIxianReplacementUse',event:f.event}));
  assert.equal(game.auction,null);
  assert.equal(game.currentAuctionSale,null);
  assert.equal(owner(game,f.buyer).spice,f.paidSpice);
  assert.equal(owner(game,f.emperor!).spice,f.beforeEmperorSpice! + (karama ? 0 : 2));
  assert.equal(game.phase,4);
  inventory(game);
});

void test('a later genuine purchase creates a new source while the closed prior event stays unusable',() => {
  const f = createIxianNexusReplacementFixture();
  let game = settleIxianReplacementFixture(applyAction(f.game,f.buyer,{type:'nexusIxianReplacementPass',event:f.event}));
  const firstCard = f.purchased.id;
  for (let step = 0; game.auction!.active !== f.buyer && step < 20; step++)
    game = applyAction(game,game.auction!.active,{type:'passBid'});
  game = applyAction(game,f.buyer,{type:'bid',amount:2});
  for (let step = 0; game.decision?.kind !== 'auctionPayment' && step < 20; step++)
    game = applyAction(game,game.auction!.active,{type:'passBid'});
  const originalBalance = owner(game,f.buyer).spice;
  const secondPurchased = game.auction!.cards[game.auction!.index].id;
  game = applyAction(game,f.buyer,{type:'decision',karama:false});
  const nextEvent = game.pendingNexusIxianReplacement!.event;
  assert.notEqual(nextEvent,f.event);
  assert.equal(game.pendingNexusIxianReplacement!.sequence,1);
  reject(game,f.buyer,{type:'nexusIxianReplacementUse',event:f.event});
  const use = applyAction(game,f.buyer,{type:'nexusIxianReplacementUse',event:nextEvent});
  assert.equal(owner(use,f.buyer).spice,originalBalance - 2);
  assert.ok(owner(use,f.buyer).hand.some(c => c.id === firstCard));
  assert.equal(owner(use,f.buyer).hand.some(c => c.id === secondPurchased),false);
  assert.deepEqual(use.nexusIxianReplacementHistory!.map(r => r.outcome),['pass','use']);
  inventory(use);
});

void test('a genuine Harkonnen buyer holding Ixian Nexus gets native purchase/bonus only, never an unresolved prototype offer',() => {
  const lobby = createGame('HARKBUYER',newPlayer('a','Atreides','atreides'),false,[]);
  joinGame(lobby,newPlayer('e','Emperor','emperor'));
  joinGame(lobby,newPlayer('h','Harkonnen','harkonnen'));
  joinGame(lobby,newPlayer('g','Guild','guild'));
  const f = createIxianNexusReplacementFixture({initial:lobby,face:'richese',otherDraw:{player:'h',face:'ixians'}});
  let game = settleIxianReplacementFixture(applyAction(f.game,f.buyer,{type:'nexusIxianReplacementPass',event:f.event}));
  assert.equal(game.nexusCards!.cards!.hands.h,'ixians');
  for (let step = 0; game.auction!.active !== 'h' && step < 20; step++)
    game = applyAction(game,game.auction!.active,{type:'passBid'});
  const balance = owner(game,'h').spice;
  const purchased = game.auction!.cards[game.auction!.index].id;
  game = applyAction(game,'h',{type:'bid',amount:2});
  for (let step = 0; game.auction?.bidder === 'h' && !game.currentAuctionSale &&
    game.auction.index === f.auctionIndex + 1 && step < 30; step++) {
    if (game.decision?.kind === 'auctionPayment')
      game = applyAction(game,'h',{type:'decision',karama:false});
    else game = applyAction(game,game.auction.active,{type:'passBid'});
  }
  assert.equal(game.pendingNexusIxianReplacement,null);
  assert.equal(viewGame(game,'a').nexusIxianReplacement,null);
  assert.equal(viewGame(game,'h').nexusIxianReplacement,null);
  game = settleIxianReplacementFixture(game);
  assert.equal(owner(game,'h').spice,balance - 2);
  assert.ok(owner(game,'h').hand.some(c => c.id === purchased));
  assert.equal(owner(game,'h').hand.length,4,'The actual native Harkonnen bonus remains active.');
  assert.equal(game.nexusCards!.cards!.hands.h,'ixians');
  assert.equal(game.nexusIxianReplacementHistory!.length,1);
  inventory(game);
});

void test('direct printed Karama acquisition preserves the original zero bid and native free continuation',() => {
  const f = createIxianNexusReplacementFixture();
  let game = settleIxianReplacementFixture(applyAction(f.game,f.buyer,{type:'nexusIxianReplacementPass',event:f.event}));
  assert.equal(game.auction!.bid,0);
  const spice = owner(game,f.buyer).spice;
  const original = {...game.auction!.cards[game.auction!.index]};
  const next = {...game.deck[0]};
  const karama = owner(game,f.buyer).hand.find(c => c.effect === 'karama')!;
  game = applyAction(game,f.buyer,{type:'card',card:karama.id,mode:'purchase'});
  const source = game.pendingNexusIxianReplacement!;
  assert.equal(source.amount,0);
  assert.equal(source.free,true);
  assert.deepEqual(source.card,original);
  const use = settleIxianReplacementFixture(applyAction(game,f.buyer,{type:'nexusIxianReplacementUse',event:source.event}));
  assert.equal(owner(use,f.buyer).spice,spice);
  assert.equal(owner(use,f.buyer).hand.some(c => c.id === original.id),false);
  assert.ok(owner(use,f.buyer).hand.some(c => c.id === next.id));
  assert.equal(use.nexusIxianReplacementHistory![1].source.amount,0);
  inventory(use);
});

void test('nonprinted Bene Gesserit Karama substitution continues native sale without enabling the bounded offer',() => {
  const lobby = createGame('BGCONVERT',newPlayer('b','Bene Gesserit','beneGesserit'),true,[]);
  joinGame(lobby,newPlayer('e','Emperor','emperor'));
  joinGame(lobby,newPlayer('g','Guild','guild'));
  const f = createIxianNexusReplacementFixture({initial:lobby});
  const parent = reload(f.beforePayment);
  const index = parent.deck.findIndex(c => c.kind === 'worthless');
  assert.ok(index >= 0);
  const worthless = parent.deck.splice(index,1)[0];
  owner(parent,f.buyer).hand.push(worthless);
  const balance = owner(parent,f.buyer).spice;
  let game = applyAction(parent,f.buyer,{type:'decision',karama:true,card:worthless.id});
  game = settleIxianReplacementFixture(game);
  assert.equal(game.pendingNexusIxianReplacement,null);
  assert.equal(viewGame(game,f.buyer).nexusIxianReplacement,null);
  assert.equal(game.nexusCards!.cards!.hands[f.buyer],'ixians');
  assert.equal(owner(game,f.buyer).spice,balance);
  assert.ok(owner(game,f.buyer).hand.some(c => c.id === f.purchased.id));
  assert.equal(game.nexusIxianReplacementHistory!.length,0);
  inventory(game);
});
