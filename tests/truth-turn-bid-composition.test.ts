import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import { actTruthBid as act, advanceTruthBid as advance, askTruthBid, answerTruthBid,
  declareTruthBid, truthBidClean as clean, truthBidInventory as inventory } from './fixture-truth-bid';
import { bindTruthTurnBid, createTruthTurnBidFixture, finishTruthTurnBidLot,
  purchaseTruthTurnBidLot } from './fixture-truth-turn-bid';

function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game,actor,action)); assert.deepEqual(game,before);
}
/** Fork the genuine public setup before its selected unopened Spice positions,
 * reapply only that original selection, and follow native controls to Charity.
 * No played purse, hand, phase or promise is staged. */
function early(advanced: boolean) {
  const f = createTruthTurnBidFixture({advanced});
  let game = structuredClone(f.afterSetup);
  for (const {position,from,card} of f.spiceOrder) {
    const [selected] = game.spiceDeck.splice(from,1);
    assert.deepEqual(selected,card); game.spiceDeck.splice(position,0,selected);
  }
  game = advance(game,g => g.turn === 1 && g.phase === 2 && clean(g));
  return {f,game};
}
function phaseAsk(game: Game, asker: string, target: string, minimum = 4) {
  return act(game,asker,{type:'truthAsk',question:{kind:'phaseBid',target,turn:game.turn,minimum}});
}
for (const advanced of [false,true]) {
  const mode = advanced ? 'Advanced' : 'Basic';
  for (const answer of ['yes','no'] as const) void test(`${mode} pre-Bidding phase ${answer} binds a real later auction declaration`, () => {
    const {f,game:source} = early(advanced);
    assert.equal(source.phase,2); assert.equal(source.auction,null);
    const bound = bindTruthTurnBid(f,answer,4,source);
    assert.ok(viewGame(bound.game,f.target).phaseBidPromises.some(p => p.minimum === 4 && p.answer === (answer === 'yes')));
    let game = advance(bound.game,g => clean(g) && g.phase === 3 && g.auction?.active === f.target);
    if (answer === 'yes') {
      reject(game,f.target,{type:'passBid'});
      game = act(game,f.target,{type:'bid',amount:4,allyPayment:0});
      assert.ok(viewGame(game,f.target).phaseBidPromises.some(p => p.fulfilled));
    } else {
      reject(game,f.target,{type:'bid',amount:4,allyPayment:0});
      game = act(game,f.target,{type:'bid',amount:1,allyPayment:0});
    }
    assert.deepEqual(inventory(game),f.originalCards);
  });
  void test(`${mode} existing current-lot Yes prevents a contradictory phase-wide No`, () => {
    const f = createTruthTurnBidFixture({advanced});
    let game = declareTruthBid(f,f.game,{copies:2}).game;
    game = askTruthBid(game,f.asker,f.target,4);
    game = answerTruthBid(game,f.target,'yes');
    game = phaseAsk(game,f.asker,f.target,4);
    assert.ok(!viewGame(game,f.target).truthPhaseBidAnswers?.includes('no'));
    reject(game,f.target,{type:'truthAnswer',answer:'no'});
    game = answerTruthBid(game,f.target,'yes');
    game = advance(game,g => clean(g) && g.auction?.active === f.target);
    game = act(game,f.target,{type:'bid',amount:4,allyPayment:0});
    assert.ok(game.bidPromises?.some(p => p.player === f.target && p.fulfilled));
    assert.ok(game.phaseBidPromises?.some(p => p.player === f.target && p.fulfilled));
    assert.deepEqual(inventory(game),f.originalCards);
  });
  void test(`${mode} phase Yes and current-lot No coexist when a real committed sale opens a later lot`, () => {
    const f = createTruthTurnBidFixture({advanced});
    let game = act(f.game,f.asker,{type:'bid',amount:1,allyPayment:0});
    game = act(game,f.opponent,{type:'passBid'});
    assert.equal(game.auction?.active,f.target); assert.equal(game.auction?.bidder,f.asker);
    game = declareTruthBid(f,game,{copies:2}).game;
    game = phaseAsk(game,f.asker,f.target,4);
    game = answerTruthBid(game,f.target,'yes');
    game = askTruthBid(game,f.asker,f.target,4);
    assert.ok(viewGame(game,f.target).truthBidAnswers?.includes('no'));
    game = answerTruthBid(game,f.target,'no');
    reject(game,f.target,{type:'bid',amount:4,allyPayment:0});
    game = act(game,f.target,{type:'passBid'});
    if (game.auction?.index === 0) game = finishTruthTurnBidLot(game);
    assert.equal(game.auction?.index,1);
    game = advance(game,g => clean(g) && g.auction?.active === f.target);
    game = act(game,f.target,{type:'bid',amount:4,allyPayment:0});
    assert.ok(game.phaseBidPromises?.some(p => p.player === f.target && p.fulfilled));
    assert.deepEqual(inventory(game),f.originalCards);
  });
  void test(`${mode} phase Yes keeps its funded bid and cannot rely on a future buyer after everyone passes`, () => {
    const f = createTruthTurnBidFixture({advanced});
    let game = bindTruthTurnBid(f,'yes',4).game;
    reject(game,f.target,{type:'bribe',target:f.asker,amount:7});
    game = act(game,f.target,{type:'bribe',target:f.asker,amount:6});
    assert.equal(game.players.find(p => p.id === f.target)!.spice,4);
    game = act(game,f.asker,{type:'passBid'});
    game = act(game,f.opponent,{type:'passBid'});
    assert.equal(game.auction?.bidder,null); assert.equal(game.auction?.active,f.target);
    reject(game,f.target,{type:'passBid'});
    game = act(game,f.target,{type:'bid',amount:4,allyPayment:0});
    assert.ok(game.phaseBidPromises?.some(p => p.player === f.target && p.fulfilled));
    assert.deepEqual(inventory(game),f.originalCards);
  });
  void test(`${mode} an original phase bid guide is stale after its lot actually retires`, () => {
    const f = createTruthTurnBidFixture({advanced});
    let game = act(f.game,f.asker,{type:'bid',amount:1,allyPayment:0});
    game = act(game,f.opponent,{type:'passBid'});
    game = bindTruthTurnBid(f,'no',4,game).game;
    const guide = viewGame(game,f.target).phaseBidPromiseGuide; assert.ok(guide);
    const packet = structuredClone(guide.action);
    assert.equal(packet.type,'passBid');
    game = act(game,f.target,packet);
    if (game.auction?.index === 0) game = finishTruthTurnBidLot(game);
    assert.equal(game.auction?.index,1);
    game = advance(game,g => clean(g) && g.auction?.active === f.target);
    reject(game,f.target,packet);
    assert.ok(viewGame(game,f.target).phaseBidPromiseGuide);
  });
}

/** Controlled supplement only: install the two already-answered, canonical
 * current-lot receipts on the genuine live auction, with its exact original
 * physical lot binding. No card/force/lot is manufactured. */
function stagedLotBounds(game: Game, target: string, asker: string, yesMinimum = 5, noMinimum = 6) {
  assert.ok(game.auction);
  const source = JSON.stringify(['ordinaryBid',game.turn,game.auction.index,game.auction.cards[game.auction.index].id]);
  game.bidPromises = [
    {turn:game.turn,lot:game.auction.index+1,minimum:yesMinimum,event:'controlled-lot-yes',source,player:target,asker,answer:true},
    {turn:game.turn,lot:game.auction.index+1,minimum:noMinimum,event:'controlled-lot-no',source,player:target,asker,answer:false},
  ];
}
function askAs(game: Game, asker: string, card: string, target: string, minimum: number) {
  game = act(game,asker,{type:'card',card});
  for (let count=0; game.truthtrance?.stage === 'priority' && count<game.players.length; count++) {
    const p = game.players.find(seat => !game.truthtrance!.passed.includes(seat.id)); assert.ok(p);
    game = act(game,p.id,{type:'truthPass'});
  }
  assert.equal(game.truthtrance?.stage,'ask');
  return phaseAsk(game,asker,target,minimum);
}

for (const advanced of [false,true]) {
  const mode = advanced ? 'Advanced' : 'Basic';
  void test(`${mode} a new lot Yes cannot erase the funded future needed by an existing phase Yes`, () => {
    const f = createTruthTurnBidFixture({advanced});
    let game = act(f.game,f.asker,{type:'bid',amount:4,allyPayment:0});
    game = act(game,f.opponent,{type:'passBid'});
    assert.equal(game.auction?.active,f.target); assert.ok(game.auction?.cards[1]);
    game = structuredClone(game);
    // Controlled existing answers and wallet: H's real committed4 sale leaves
    // E's six spice for its existing phase Yes6. Current-lot No6 prevents E6;
    // a proposed lot Yes5 would compel a purchase and leave only one spice.
    game.players.find(p => p.id === f.target)!.spice = 6;
    stagedLotBounds(game,f.target,f.asker);
    game.bidPromises = game.bidPromises!.filter(promise => !promise.answer);
    game.phaseBidPromises = [{turn:game.turn,minimum:6,event:'controlled-phase-yes',
      player:f.target,asker:f.asker,answer:true}];
    game = declareTruthBid(f,game).game;
    game = askTruthBid(game,f.asker,f.target,5);
    assert.ok(!viewGame(game,f.target).truthBidAnswers?.includes('yes'));
    reject(game,f.target,{type:'truthAnswer',answer:'yes'});
    game = answerTruthBid(game,f.target,'no');
    assert.deepEqual(inventory(game),f.originalCards);
  });
  void test(`${mode} a live whole-turn No for the last lot excludes the same phase-wide Yes`, () => {
    const f = createTruthTurnBidFixture({advanced}); let game = f.game;
    // Both purchases and the two independent Truth cards are native; no
    // question, wallet or auction state is installed for this source.
    for (let n=0;n<2;n++) game = purchaseTruthTurnBidLot(game,f.opponent).game;
    assert.equal(game.auction?.index,2);
    game = advance(game,g => clean(g) && g.auction?.active === f.target);
    game = declareTruthBid(f,game).game;
    game = act(game,f.asker,{type:'truthAsk',question:{kind:'turnActions',target:f.target,
      turn:game.turn,mixed:{kind:'action',action:{kind:'bid',lot:3,minimum:6}}}});
    assert.ok(viewGame(game,f.target).truthTurnActionAnswers?.includes('no'));
    game = answerTruthBid(game,f.target,'no');
    assert.ok(game.turnActionPromises?.some(p => p.player === f.target && !p.answer && !p.fulfilled && !p.released));
    game = askAs(game,f.asker,f.truths[1],f.target,6);
    assert.ok(!viewGame(game,f.target).truthPhaseBidAnswers?.includes('yes'));
    reject(game,f.target,{type:'truthAnswer',answer:'yes'});
    game = answerTruthBid(game,f.target,'no');
    assert.deepEqual(inventory(game),f.originalCards);
  });
  void test(`${mode} phase Yes cannot ignore a forced current-lot payment that consumes future funding`, () => {
    const f = createTruthTurnBidFixture({advanced});
    let game = act(f.game,f.asker,{type:'bid',amount:1,allyPayment:0});
    game = act(game,f.opponent,{type:'passBid'});
    assert.equal(game.auction?.active,f.target); assert.ok(game.auction?.cards[1]);
    // Explicit controlled wallet/answers; the physical auction and H1 bid are
    // actual native actions. E6 must bid exactly5 under its prior Yes5/No6.
    game = structuredClone(game);
    game.players.find(p => p.id === f.target)!.spice = 6;
    stagedLotBounds(game,f.target,f.asker);
    game = askAs(game,f.asker,f.truth,f.target,6);
    assert.ok(!viewGame(game,f.target).truthPhaseBidAnswers?.includes('yes'));
    reject(game,f.target,{type:'truthAnswer',answer:'yes'});
    game = answerTruthBid(game,f.target,'no');
    assert.deepEqual(inventory(game),f.originalCards);
  });
  void test(`${mode} phase Yes cannot assume Harkonnen will avoid its purchase bonus to make a later slot`, () => {
    const f = createTruthTurnBidFixture({advanced});
    let game = structuredClone(f.game);
    const hark = game.players.find(p => p.id === f.asker)!;
    const atreides = game.players.find(p => p.id === f.opponent)!;
    // Explicit conserved prior-card transfers: Atreides holds the original
    // Truthtrance to ask; Harkonnen has six held cards (two open slots). The
    // original undealt deck retains a possible Harkonnen bonus card.
    const index = hark.hand.findIndex(c => c.id === f.truth); assert.ok(index >= 0);
    atreides.hand.push(hark.hand.splice(index,1)[0]);
    while (hark.hand.length < 6) {
      const from = game.deck.findIndex(c => ['projectile','poison','shield','snooper','worthless'].includes(c.kind));
      assert.ok(from >= 0); hark.hand.push(game.deck.splice(from,1)[0]);
    }
    assert.ok(game.deck.length > 0); assert.equal(hark.hand.length,6);
    game = act(game,f.asker,{type:'passBid'});
    game = act(game,f.opponent,{type:'passBid'});
    game = act(game,f.target,{type:'bid',amount:1,allyPayment:0});
    assert.equal(game.auction?.active,f.asker); assert.ok(game.auction?.cards[1]);
    // Harkonnen has ten spice. Its existing Yes2/No4 permits a bid2,
    // leaving eight spice after payment; capacity alone removes the future.
    assert.equal(game.players.find(p => p.id === f.asker)!.spice,10);
    stagedLotBounds(game,f.asker,f.opponent,2,4);
    game = askAs(game,f.opponent,f.truth,f.asker,4);
    assert.ok(!viewGame(game,f.asker).truthPhaseBidAnswers?.includes('yes'));
    reject(game,f.asker,{type:'truthAnswer',answer:'yes'});
    game = answerTruthBid(game,f.asker,'no');
    assert.deepEqual(inventory(game),f.originalCards);
  });
  void test(`${mode} an opponent's unfunded Karama-only high bid cannot certify a future lot`, () => {
    const f = createTruthTurnBidFixture({advanced});
    let game = structuredClone(f.game);
    // Explicit conserved prior acquisition: Harkonnen holds an undealt real
    // Karama, and can legally declare11 on its actual ten-spice purse. The
    // unrelated bidder's future choice to spend that card is not assumed.
    const from = game.deck.findIndex(c => c.effect === 'karama'); assert.ok(from >= 0);
    game.players.find(p => p.id === f.asker)!.hand.push(game.deck.splice(from,1)[0]);
    game = act(game,f.asker,{type:'bid',amount:11,allyPayment:0});
    game = act(game,f.opponent,{type:'passBid'});
    assert.equal(game.auction?.active,f.target); assert.equal(game.auction?.bidder,f.asker);
    assert.ok(game.auction?.cards[1]);
    game = askAs(game,f.asker,f.truth,f.target,6);
    assert.ok(!viewGame(game,f.target).truthPhaseBidAnswers?.includes('yes'));
    reject(game,f.target,{type:'truthAnswer',answer:'yes'});
    game = answerTruthBid(game,f.target,'no');
    assert.deepEqual(inventory(game),f.originalCards);
  });
}

for (const advanced of [false,true]) {
  const mode = advanced ? 'Advanced' : 'Basic';
  void test(`${mode} a phase bid Yes cannot spend the funds required by a live whole-turn bribe`, () => {
    const f = createTruthTurnBidFixture({advanced}); let game = f.game;
    // Actual A1 purchases pay E one spice each; E then really commits a
    // separate bribe2, leaving ten. Both Truth cards and the last lot are
    // original components. No wallet, promise or auction state is staged.
    for (let n=0;n<2;n++) game = purchaseTruthTurnBidLot(game,f.opponent).game;
    assert.equal(game.auction?.index,2);
    game = act(game,f.target,{type:'bribe',target:f.asker,amount:2});
    assert.equal(game.players.find(p => p.id === f.target)!.spice,10);
    game = advance(game,g => clean(g) && g.auction?.active === f.target);
    game = declareTruthBid(f,game).game;
    game = act(game,f.asker,{type:'truthAsk',question:{kind:'turnActions',target:f.target,
      turn:game.turn,mixed:{kind:'action',action:{kind:'payment',recipient:f.asker,minimum:5}}}});
    assert.ok(viewGame(game,f.target).truthTurnActionAnswers?.includes('yes'));
    game = answerTruthBid(game,f.target,'yes');
    const prior = structuredClone(game.turnActionPromises![0]);
    game = askAs(game,f.asker,f.truths[1],f.target,6);
    assert.ok(!viewGame(game,f.target).truthPhaseBidAnswers?.includes('yes'));
    reject(game,f.target,{type:'truthAnswer',answer:'yes'});
    assert.deepEqual(game.turnActionPromises![0],prior);
    game = answerTruthBid(game,f.target,'no');
    assert.deepEqual(game.turnActionPromises![0],prior);
    assert.deepEqual(inventory(game),f.originalCards);
  });
}

/** Use the second real physical Truth card to ask one whole-turn action after
 * a phase-bid answer. Keep the normal declaration and priority actions. */
function askTurnActionAs(game: Game, asker: string, card: string, target: string,
  action: {kind:'payment';recipient:string;minimum:number} | {kind:'bid';lot:number;minimum:number}) {
  game = act(game,asker,{type:'card',card});
  for (let count=0; game.truthtrance?.stage === 'priority' && count<game.players.length; count++) {
    const p = game.players.find(seat => !game.truthtrance!.passed.includes(seat.id)); assert.ok(p);
    game = act(game,p.id,{type:'truthPass'});
  }
  assert.equal(game.truthtrance?.stage,'ask');
  return act(game,asker,{type:'truthAsk',question:{kind:'turnActions',target,turn:game.turn,
    mixed:{kind:'action',action}}});
}
for (const advanced of [false,true]) {
  const mode = advanced ? 'Advanced' : 'Basic';
  void test(`${mode} an existing phase bid Yes excludes an unfunded later whole-turn bribe Yes`, () => {
    const f = createTruthTurnBidFixture({advanced}); let game = f.game;
    // Real A1 purchases twice give E two income; E's real bribe2 leaves ten.
    // The still-unresolved original last lot and both Truth cards are native.
    for (let n=0;n<2;n++) game = purchaseTruthTurnBidLot(game,f.opponent).game;
    assert.equal(game.auction?.index,2);
    game = act(game,f.target,{type:'bribe',target:f.asker,amount:2});
    assert.equal(game.players.find(p => p.id === f.target)!.spice,10);
    game = advance(game,g => clean(g) && g.auction?.active === f.target);
    game = bindTruthTurnBid(f,'yes',6,game).game;
    const prior = structuredClone(game.phaseBidPromises![0]);
    game = askTurnActionAs(game,f.asker,f.truths[1],f.target,
      {kind:'payment',recipient:f.asker,minimum:5});
    assert.ok(!viewGame(game,f.target).truthTurnActionAnswers?.includes('yes'));
    reject(game,f.target,{type:'truthAnswer',answer:'yes'});
    assert.deepEqual(game.phaseBidPromises![0],prior);
    game = answerTruthBid(game,f.target,'no');
    assert.deepEqual(game.phaseBidPromises![0],prior);
    assert.deepEqual(inventory(game),f.originalCards);
  });
  void test(`${mode} an existing phase bid No excludes a later whole-turn bid Yes on the final lot`, () => {
    const f = createTruthTurnBidFixture({advanced}); let game = f.game;
    // Two actual purchases leave the actual third and last prepared lot.
    for (let n=0;n<2;n++) game = purchaseTruthTurnBidLot(game,f.opponent).game;
    assert.equal(game.auction?.index,2);
    game = advance(game,g => clean(g) && g.auction?.active === f.target);
    game = bindTruthTurnBid(f,'no',6,game).game;
    const prior = structuredClone(game.phaseBidPromises![0]);
    game = askTurnActionAs(game,f.asker,f.truths[1],f.target,
      {kind:'bid',lot:game.auction!.index+1,minimum:6});
    assert.ok(!viewGame(game,f.target).truthTurnActionAnswers?.includes('yes'));
    reject(game,f.target,{type:'truthAnswer',answer:'yes'});
    assert.deepEqual(game.phaseBidPromises![0],prior);
    game = answerTruthBid(game,f.target,'no');
    assert.deepEqual(game.phaseBidPromises![0],prior);
    assert.deepEqual(inventory(game),f.originalCards);
  });
}

for (const advanced of [false,true]) {
  const mode = advanced ? 'Advanced' : 'Basic';
  void test(`${mode} an offered independent bribe Yes can be accepted before Bidding alongside a funded phase bid Yes`, () => {
    const {f,game:source} = early(advanced);
    // Genuine Charity source: E has ten spice; original H/A/E setup and the
    // two actual Truth cards are retained. The two requirements cost nine.
    assert.equal(source.phase,2);
    assert.equal(source.players.find(p => p.id === f.target)!.spice,10);
    let game = bindTruthTurnBid(f,'yes',6,source).game;
    const phasePromise = structuredClone(game.phaseBidPromises![0]);
    game = act(game,f.asker,{type:'card',card:f.truths[1]});
    for (let count=0; game.truthtrance?.stage === 'priority' && count<game.players.length; count++) {
      const p = game.players.find(seat => !game.truthtrance!.passed.includes(seat.id)); assert.ok(p);
      game = act(game,p.id,{type:'truthPass'});
    }
    assert.equal(game.truthtrance?.stage,'ask');
    game = act(game,f.asker,{type:'truthAsk',question:{kind:'bribe',target:f.target,
      turn:game.turn,recipient:f.asker,minimum:3}});
    assert.ok(viewGame(game,f.target).truthBribeAnswers?.includes('yes'));
    game = answerTruthBid(game,f.target,'yes');
    assert.equal(game.truthtrance,null);
    assert.deepEqual(game.phaseBidPromises![0],phasePromise);
    assert.ok(game.bribePromises?.some(p => p.player === f.target && p.recipient === f.asker && p.answer));
    game = act(game,f.target,{type:'bribe',target:f.asker,amount:3});
    assert.equal(game.players.find(p => p.id === f.target)!.spice,7);
    assert.ok(game.bribePromises?.some(p => p.player === f.target && p.fulfilled));
    game = advance(game,g => clean(g) && g.phase === 3 && g.auction?.active === f.target);
    game = act(game,f.target,{type:'bid',amount:6,allyPayment:0});
    assert.ok(game.phaseBidPromises?.some(p => p.player === f.target && p.fulfilled));
    assert.deepEqual(inventory(game),f.originalCards);
  });
}

for (const advanced of [false,true]) {
  const mode = advanced ? 'Advanced' : 'Basic';
  void test(`${mode} an underfunded independent bribe Yes is unavailable before Bidding while phase bid Yes survives`, () => {
    const {f,game:source} = early(advanced);
    assert.equal(source.phase,2);
    assert.equal(source.players.find(p => p.id === f.target)!.spice,10);
    let game = bindTruthTurnBid(f,'yes',6,source).game;
    const phasePromise = structuredClone(game.phaseBidPromises![0]);
    game = act(game,f.asker,{type:'card',card:f.truths[1]});
    for (let count=0; game.truthtrance?.stage === 'priority' && count<game.players.length; count++) {
      const p = game.players.find(seat => !game.truthtrance!.passed.includes(seat.id)); assert.ok(p);
      game = act(game,p.id,{type:'truthPass'});
    }
    assert.equal(game.truthtrance?.stage,'ask');
    game = act(game,f.asker,{type:'truthAsk',question:{kind:'bribe',target:f.target,
      turn:game.turn,recipient:f.asker,minimum:5}});
    assert.ok(!viewGame(game,f.target).truthBribeAnswers?.includes('yes'));
    assert.ok(viewGame(game,f.target).truthBribeAnswers?.includes('no'));
    reject(game,f.target,{type:'truthAnswer',answer:'yes'});
    assert.deepEqual(game.phaseBidPromises![0],phasePromise);
    game = answerTruthBid(game,f.target,'no');
    assert.equal(game.truthtrance,null);
    assert.deepEqual(game.phaseBidPromises![0],phasePromise);
    game = advance(game,g => clean(g) && g.phase === 3 && g.auction?.active === f.target);
    game = act(game,f.target,{type:'bid',amount:6,allyPayment:0});
    assert.ok(game.phaseBidPromises?.some(p => p.player === f.target && p.fulfilled));
    assert.deepEqual(inventory(game),f.originalCards);
  });
}
