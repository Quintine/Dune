import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction, createGame, initializeRicheseBetrayalGameForAudit, joinGame,
  newPlayer, normalizeAutomaticGame, viewGame, type Action, type Game,
} from '../game/engine';
import { validateNexusCards } from '../game/nexus-cards';
import { createRicheseBetrayalFixture } from './fixture-richese-betrayal';

const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const player = (g: Game,id: string) => g.players.find(p => p.id === id)!;
function reject(g: Game,id: string,action: Action) {
  const before = JSON.stringify(g);
  assert.throws(() => applyAction(g,id,action));
  assert.equal(JSON.stringify(g),before);
}
function passes(g: Game): Game {
  const receipt = g.pendingRicheseBetrayal!.receipt;
  for (const id of receipt.required)
    g = applyAction(g,id,{type:'richeseBetrayalPass',event:receipt.event});
  return g;
}
function census(g: Game): string[] {
  return [...g.deck,...g.discard,...(g.richeseCache ?? []),...(g.richeseRemoved ?? []),
    ...g.players.flatMap(p => p.hand),
    ...(g.auction?.cards.slice(g.auction.index + Number(g.currentAuctionSale?.origin === 'normal')) ?? [])]
    .map(c => c.id).sort();
}

void test('Basic and Advanced cache veto spends one Nexus, discards exact target and retires the original lot without any purchase debit', () => {
  for (const advanced of [false,true]) {
    const f = createRicheseBetrayalFixture('purchase',{advanced});
    const before = reload(f.game), receipt = before.pendingRicheseBetrayal!.receipt;
    assert.equal(player(before,f.target).hand.some(c => c.id === f.card),false);
    const done = applyAction(reload(before),f.holder,{type:'richeseBetrayalUse',event:f.event});
    assert.deepEqual(done.players.map(p => p.spice),before.players.map(p => p.spice));
    assert.equal(done.discard.filter(c => c.id === f.card).length,1);
    assert.equal(done.richeseCache!.some(c => c.id === f.card),false);
    assert.equal(player(done,f.target).hand.some(c => c.id === f.card),false);
    assert.equal(done.nexusCards!.cards!.hands[f.holder],null);
    assert.equal(done.nexusCards!.cards!.discard[receipt.nexusDiscardIndex ?? before.nexusCards!.cards!.discard.length],'richese');
    assert.equal(done.richeseBetrayal!.completed[0].stage,'used');
    assert.equal(done.richeseBetrayal!.current,null);
    assert.equal(done.richeseAuction,null);
    assert.equal(done.richeseBidding!.stage,'normal');
    assert.deepEqual(census(done),census(before));
    validateNexusCards(done.nexusCards!.cards!,done.players);
    const normalized = normalizeAutomaticGame(reload(done));
    assert.deepEqual(normalized,done);
    reject(done,f.holder,{type:'richeseBetrayalUse',event:f.event});
  }
});

void test('all acknowledgements resume the original cache purchase exactly once, keeping the Nexus card', () => {
  const f = createRicheseBetrayalFixture('purchase');
  const before = reload(f.game);
  const done = passes(reload(before));
  assert.equal(player(done,f.target).spice,player(before,f.target).spice - 6);
  assert.equal(player(done,f.target).hand.filter(c => c.id === f.card).length,1);
  assert.equal(done.discard.some(c => c.id === f.card),false);
  assert.equal(done.nexusCards!.cards!.hands[f.holder],'richese');
  assert.equal(done.richeseBetrayal!.completed[0].stage,'passed');
  assert.deepEqual(census(done),census(before));
  assert.deepEqual(normalizeAutomaticGame(reload(done)),done);
  reject(done,f.holder,{type:'richeseBetrayalPass',event:f.event});
});

void test('cache and concealed Black Market diversion preserve original ally split, delivery and earned Harkonnen bonus without seller income', () => {
  for (const source of ['cache','blackMarket'] as const) {
    const f = createRicheseBetrayalFixture('sale',{source,allyPayment:2});
    const before = reload(f.game), bonus = before.deck[0].id;
    assert.equal(before.pendingRicheseBetrayal!.receipt.invoice.ownPayment,4);
    assert.equal(before.pendingRicheseBetrayal!.receipt.invoice.donor,f.ally);
    const done = applyAction(reload(before),f.holder,{type:'richeseBetrayalUse',event:f.event});
    assert.equal(player(done,f.buyer).spice,player(before,f.buyer).spice - 4);
    assert.equal(player(done,f.ally!).spice,player(before,f.ally!).spice);
    assert.equal(done.aid[f.ally!].amount,before.aid[f.ally!].amount - 2);
    assert.equal(player(done,f.target).spice,player(before,f.target).spice);
    assert.deepEqual(player(done,f.buyer).hand.map(c => c.id).sort(),[f.card,bonus].sort());
    assert.equal(done.richeseAuction,null);
    assert.equal(done.richeseBidding!.stage,source === 'cache' ? 'normal' : 'declaration');
    assert.equal(done.richeseBidding!.blackMarketSold,source === 'blackMarket');
    assert.deepEqual(census(done),census(before));
    assert.deepEqual(normalizeAutomaticGame(reload(done)),done);
    reject(done,f.holder,{type:'richeseBetrayalUse',event:f.event});
  }
});

void test('all-pass Black Market sale pays original seller and draws one native bonus, never a second debit', () => {
  const f = createRicheseBetrayalFixture('sale',{allyPayment:2});
  const before = reload(f.game), bonus = before.deck[0].id;
  const done = passes(reload(before));
  assert.equal(player(done,f.target).spice,player(before,f.target).spice + 6);
  assert.equal(player(done,f.buyer).spice,player(before,f.buyer).spice - 4);
  assert.equal(player(done,f.ally!).spice,player(before,f.ally!).spice);
  assert.equal(done.aid[f.ally!].amount,before.aid[f.ally!].amount - 2);
  assert.deepEqual(player(done,f.buyer).hand.map(c => c.id).sort(),[f.card,bonus].sort());
  assert.equal(done.nexusCards!.cards!.hands[f.holder],'richese');
  assert.deepEqual(normalizeAutomaticGame(reload(done)),done);
});

void test('public neutral timing is independent of Nexus identity and concealed source remains unentitled', () => {
  const f = createRicheseBetrayalFixture('sale');
  const relevant = reload(f.game), irrelevant = reload(f.game);
  const cards = irrelevant.nexusCards!.cards!, index = cards.deck.indexOf('choam');
  assert.ok(index >= 0);
  cards.deck[index] = 'richese';cards.hands[f.holder] = 'choam';
  for (const p of relevant.players) {
    const a = viewGame(relevant,p.id), b = viewGame(irrelevant,p.id);
    const publicReaction = (v: typeof a) => {
      const r = v.richeseBetrayalReaction!;
      return {event:r.event,kind:r.kind,target:r.target,buyer:r.buyer,source:r.source,price:r.price,canPass:r.canPass,hasPassed:r.hasPassed};
    };
    assert.deepEqual(publicReaction(a),publicReaction(b));
    assert.equal(a.decision,null);assert.equal(a.response,null);
    assert.equal(Object.hasOwn(a,'pendingRicheseBetrayal'),false);
    assert.equal(Object.hasOwn(a,'richeseBetrayal'),false);
    if (p.id !== f.target) {
      assert.equal(a.richeseAuction!.card,null);
      assert.equal(a.richeseAuction!.cardId,null);
      assert.equal(JSON.stringify(a).includes(`"${f.card}"`),false);
    }
  }
  assert.equal(viewGame(relevant,f.holder).richeseBetrayalReaction!.canUse,true);
  assert.equal(viewGame(irrelevant,f.holder).richeseBetrayalReaction!.canUse,false);
  assert.equal(viewGame(relevant,f.other).richeseBetrayalReaction!.canPass,true);
  assert.equal(viewGame(relevant,f.other).richeseBetrayalReaction!.canUse,false);
});

void test('wrong actor/event/payload and all underlying actions reject immutably; pass relinquishes this exact use opportunity', () => {
  const f = createRicheseBetrayalFixture('purchase');
  for (const [id,action] of [
    [f.target,{type:'richeseBetrayalUse',event:f.event}],
    [f.other,{type:'richeseBetrayalUse',event:f.event}],
    [f.holder,{type:'richeseBetrayalUse',event:'stale'}],
    [f.holder,{type:'richeseBetrayalUse',event:f.event,card:f.card}],
    [f.holder,{type:'ready'}],
    [f.holder,{type:'nexusChoamBetrayal'}],
  ] as [string,Action][]) reject(f.game,id,action);
  const passed = applyAction(reload(f.game),f.holder,{type:'richeseBetrayalPass',event:f.event});
  assert.equal(viewGame(passed,f.holder).richeseBetrayalReaction!.hasPassed,true);
  assert.equal(viewGame(passed,f.holder).richeseBetrayalReaction!.canUse,false);
  reject(passed,f.holder,{type:'richeseBetrayalUse',event:f.event});
  assert.deepEqual(normalizeAutomaticGame(reload(passed)),passed);
});

void test('orphaned/corrupt source receipts fail before projection, normalization or payment', () => {
  const f = createRicheseBetrayalFixture('sale');
  const corruptions: ((g: Game) => void)[] = [
    g => {delete g.pendingRicheseBetrayal;},
    g => {delete g.richeseBetrayal;},
    g => {g.richeseBetrayal!.current = null;},
    g => {g.pendingRicheseBetrayal!.quote.amount++;},
    g => {g.pendingRicheseBetrayal!.receipt.invoice.card.name = 'forged face';},
    g => {player(g,f.buyer).spice--;},
    g => {player(g,f.target).hand.splice(0,1);},
  ];
  for (const mutate of corruptions) {
    const bad = reload(f.game);mutate(bad);
    const before = JSON.stringify(bad);
    for (const p of bad.players) assert.throws(() => viewGame(bad,p.id));
    assert.throws(() => normalizeAutomaticGame(bad));
    reject(bad,f.holder,{type:'richeseBetrayalUse',event:f.event});
    assert.equal(JSON.stringify(bad),before);
  }
});

void test('initializer admits only explicit fresh CHOAM/Richese Nexus composition and does not bypass public starts', () => {
  function lobby() {
    let g = createGame('RICHESEADMISSION',newPlayer('r','Richese','richese'),false,['choam']);
    joinGame(g,newPlayer('c','CHOAM','choam'));
    g.nexusCards = {cards:null,phase:null};
    for (const p of g.players) g = applyAction(g,p.id,{type:'ready'});
    return g;
  }
  for (const mutate of [
    (g: Game) => {g.nexusCards = undefined;},
    (g: Game) => {g.expansions.push('ix');},
    (g: Game) => {g.sandtrout = true;},
    (g: Game) => {g.kullPreview = true;},
    (g: Game) => {g.semutaPreview = true;},
    (g: Game) => {g.players[1].faction = 'ixians';},
  ]) {
    const bad = lobby();mutate(bad);
    const before = JSON.stringify(bad);
    assert.throws(() => initializeRicheseBetrayalGameForAudit(bad));
    assert.equal(JSON.stringify(bad),before);
  }
  const fresh = lobby(), initialized = initializeRicheseBetrayalGameForAudit(fresh);
  assert.equal(initialized.richeseBetrayalPreview,true);
  assert.deepEqual(initialized.richeseBetrayal,{sequence:0,current:null,completed:[]});
  reject(fresh,'r',{type:'start'});
});

void test('diversion keeps native bonus cancellation and paid-sale ownership through JSON restore without replaying payment', () => {
  const f = createRicheseBetrayalFixture('sale',{bonusCounter:true});
  const before = reload(f.game);
  const paid = applyAction(reload(before),f.holder,{type:'richeseBetrayalUse',event:f.event});
  assert.equal(paid.response?.kind,'harkonnenBonus');
  assert.equal(paid.currentAuctionSale!.recipient,'bank');
  assert.equal(player(paid,f.target).spice,player(before,f.target).spice);
  assert.equal(player(paid,f.buyer).spice,player(before,f.buyer).spice - 6);
  assert.deepEqual(player(paid,f.buyer).hand.map(c => c.id),[f.card]);
  assert.equal(viewGame(paid,f.other).richeseBetrayalReaction,null);
  assert.deepEqual(normalizeAutomaticGame(reload(paid)),paid);
  for (const mutate of [
    (g: Game) => {g.currentAuctionSale = null;},
    (g: Game) => {delete g.currentAuctionSale!.recipient;},
    (g: Game) => {g.response = null;},
  ]) {
    const bad = reload(paid);mutate(bad);
    for (const p of bad.players) assert.throws(() => viewGame(bad,p.id));
    assert.throws(() => normalizeAutomaticGame(bad));
    reject(bad,f.other,{type:'card',card:f.counterCard!,mode:'cancel'});
  }
  const done = applyAction(reload(paid),f.other,{type:'card',card:f.counterCard!,mode:'cancel'});
  assert.equal(done.richeseAuction,null);
  assert.equal(done.richeseBidding!.stage,'declaration');
  assert.equal(player(done,f.target).spice,player(before,f.target).spice);
  assert.equal(player(done,f.buyer).spice,player(before,f.buyer).spice - 6);
  assert.deepEqual(player(done,f.buyer).hand.map(c => c.id),[f.card]);
  assert.equal(done.discard.filter(c => c.id === f.counterCard).length,1);
  assert.equal(done.richeseBetrayal!.completed.length,1);
  assert.deepEqual(census(done),census(before));
});

void test('Richese can fund its buyer from escrow with no unpledged spice, with or without diversion', () => {
  for (const source of ['cache','blackMarket'] as const) for (const use of [false,true]) {
    const f = createRicheseBetrayalFixture('sale',{source,allyPayment:2,allyIsSeller:true,allySpice:2});
    assert.equal(player(f.game,f.target).spice,0);
    assert.equal(f.game.aid[f.target].amount,2);
    const done = use ? applyAction(reload(f.game),f.holder,{type:'richeseBetrayalUse',event:f.event}) : passes(reload(f.game));
    assert.equal(player(done,f.buyer).spice,player(f.game,f.buyer).spice - 4);
    assert.equal(player(done,f.target).spice,use ? 0 : 6);
    assert.equal(done.aid[f.target].amount,0);
    assert.deepEqual(census(done),census(f.game));
    assert.deepEqual(normalizeAutomaticGame(reload(done)),done);
  }
});

void test('an exhausted cache rejects a Black Market closing bid before saving an unfinishable Harkonnen acknowledgement', () => {
  let before: Game | null = null, serialized = '';
  assert.throws(() => createRicheseBetrayalFixture('sale',{source:'blackMarket',beforeFinalBid(g) {
    (g.richeseRemoved ??= []).push(...g.richeseCache!.splice(0));
    before = g;serialized = JSON.stringify(g);
  }}), /cache/i);
  assert.ok(before);
  assert.equal(JSON.stringify(before),serialized);
  assert.equal((before as Game).pendingRicheseBetrayal,null);
  assert.equal((before as Game).richeseBetrayal!.current,null);
  assert.equal((before as Game).richeseAuction!.outcome,null);
});
