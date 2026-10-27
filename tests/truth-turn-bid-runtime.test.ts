import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { truthBidInventory } from './fixture-truth-bid';
import { actTruthTurnBid as act, advanceTruthTurnBid as advance, bindTruthTurnBid,
  createTruthTurnBidFixture, finishTruthTurnBidLot, purchaseTruthTurnBidLot,
  truthTurnBidClean as clean, truthTurnBidPlayer as player, type TruthTurnBidStep } from './fixture-truth-turn-bid';

function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => act(game,actor,action));
  assert.deepEqual(game,before);
}
function firstContested(game: Game, asker: string, rival: string, target: string, amount: number | null) {
  assert.equal(game.auction?.index,0); assert.equal(game.auction?.active,asker);
  const actions: TruthTurnBidStep[] = [];
  game = act(game,asker,{type:'passBid'},actions);
  assert.equal(game.auction?.active,rival);
  game = act(game,rival,{type:'bid',amount:1,allyPayment:0},actions);
  assert.equal(game.auction?.active,target);
  game = act(game,target,amount === null ? {type:'passBid'} : {type:'bid',amount,allyPayment:0},actions);
  return {game,actions};
}
for (const advanced of [false,true]) {
  const prefix = advanced ? 'Advanced' : 'Basic';
  void test(`${prefix} phase bid Yes survives a real first-lot pass then fulfills on a later accepted bid`, () => {
    const f = createTruthTurnBidFixture({advanced});
    const bound = bindTruthTurnBid(f,'yes',4);
    const first = firstContested(bound.game,f.asker,f.opponent,f.target,null);
    let game = finishTruthTurnBidLot(first.game,first.actions);
    assert.equal(game.auction?.index,1);
    assert.ok(player(game,f.opponent).hand.some(c => c.id === f.lotCards[0]));
    const promise = viewGame(game,f.target).phaseBidPromises.find(p => p.minimum === 4)!;
    assert.ok(promise); assert.equal(promise.fulfilled ?? false,false); assert.equal(promise.released ?? false,false);
    game = advance(game,state => clean(state) && state.auction?.active === f.target);
    for (const difficulty of DIFFICULTIES) {
      const view = viewGame(game,f.target);
      view.players.find(p => p.id === f.target)!.bot = difficulty;
      const action = botActions(view)[0]; assert.ok(action);
      const accepted = act(game,f.target,action);
      assert.ok(accepted,`${difficulty} supplies a legal current action`);
    }
    game = act(game,f.target,{type:'bid',amount:4,allyPayment:0});
    assert.ok(viewGame(game,f.target).phaseBidPromises.some(p => p.minimum === 4 && p.fulfilled));
    assert.deepEqual(truthBidInventory(game),f.originalCards);
  });
  void test(`${prefix} phase bid No forbids qualifying bids across both original lots`, () => {
    const f = createTruthTurnBidFixture({advanced});
    const bound = bindTruthTurnBid(f,'no',4);
    let game = firstContested(bound.game,f.asker,f.opponent,f.target,3).game;
    game = finishTruthTurnBidLot(game);
    assert.equal(game.auction?.index,1);
    assert.ok(player(game,f.target).hand.some(c => c.id === f.lotCards[0]));
    game = advance(game,state => clean(state) && state.auction?.active === f.target);
    assert.ok(viewGame(game,f.target).phaseBidPromises.some(p => p.minimum === 4 && !p.fulfilled && !p.released));
    reject(game,f.target,{type:'bid',amount:4,allyPayment:0});
    game = act(game,f.target,{type:'bid',amount:3,allyPayment:0});
    assert.deepEqual(truthBidInventory(game),f.originalCards);
  });
  void test(`${prefix} a live phase bid Yes cannot be abandoned on the final original lot`, () => {
    const f = createTruthTurnBidFixture({advanced}); let game = f.game;
    for (let n=0;n<2;n++) game = purchaseTruthTurnBidLot(game,f.opponent).game;
    assert.equal(game.auction?.index,2);
    game = advance(game,state => clean(state) && state.auction?.active === f.target);
    game = bindTruthTurnBid(f,'yes',4,game).game;
    reject(game,f.target,{type:'passBid'});
    reject(game,f.target,{type:'bid',amount:3,allyPayment:0});
    game = act(game,f.target,{type:'bid',amount:4,allyPayment:0});
    assert.ok(viewGame(game,f.target).phaseBidPromises.some(p => p.minimum === 4 && p.fulfilled));
    assert.deepEqual(truthBidInventory(game),f.originalCards);
  });
  void test(`${prefix} an actual opposing last-lot raise releases an unaffordable phase bid Yes`, () => {
    const f = createTruthTurnBidFixture({advanced,extraGuild:true}); let game = f.game;
    // Two real E purchases cost him two; a real A purchase pays E one. The
    // original fourth lot remains, E has one hand slot and nine spice, and H
    // has its real ten spice. This is no staged budget or future rival bid.
    for (const buyer of [f.target,f.target,f.opponent]) game = purchaseTruthTurnBidLot(game,buyer).game;
    assert.equal(game.auction?.index,3); assert.equal(player(game,f.target).spice,9);
    game = advance(game,state => clean(state) && state.auction?.active === f.asker);
    assert.ok(!game.auction!.passed.includes(f.target));
    game = bindTruthTurnBid(f,'yes',8,game).game;
    game = act(game,f.asker,{type:'bid',amount:10,allyPayment:0});
    assert.ok(viewGame(game,f.target).phaseBidPromises.some(p => p.minimum === 8 && p.released));
    assert.deepEqual(truthBidInventory(game),f.originalCards);
  });
}
