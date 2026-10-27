import assert from 'node:assert/strict';
import { type Game } from '../game/engine';
import { createSaphoStartedMovementFixture, advanceSaphoStartedMovement,
  saphoStartedMovementClean } from './fixture-sapho-started-movement';
import { act, inventory, player, truthOrderFrame } from './fixture-sapho-truth-order';

export { act, inventory, player };

/** Genuine public R/A/E/G setup and original cache1 Sapho purchase. Continue
 * that acquired snapshot through native actions to a quiet original ordinary
 * auction. Controlled supplemental custody swaps one actually dealt Truth
 * with Emperor's other held original card so the Sapho owner is a holder.
 * No purse, force, phase, auction, receipt or physical card is installed. */
export function createSaphoTruthAuctionFixture(options: {
  advanced?:boolean; standingBid?:boolean; mode?:'first'|'last';
} = {}) {
  const advanced = options.advanced ?? false, standingBid = options.standingBid ?? false, mode = options.mode ?? 'first';
  const source = createSaphoStartedMovementFixture({advanced,truthFor:['richese','guild']});
  let game = advanceSaphoStartedMovement(structuredClone(source.acquired), state =>
    state.phase === 3 && !!state.auction && saphoStartedMovementClean(state));
  assert.ok(game.auction); assert.equal(game.auction.bid,0); assert.equal(game.auction.bidder,null);
  if (standingBid) {
    const actor = game.auction.active;
    game = act(game,actor,{type:'bid',amount:1,allyPayment:0});
    assert.equal(game.auction?.bid,1); assert.equal(game.auction?.bidder,actor);
    assert.ok(saphoStartedMovementClean(game));
  }
  const owner = source.owner;
  const possible = (['richese','guild'] as const).filter(id => mode === 'first'
    ? game.order.indexOf(id) < game.order.indexOf(owner)
    : game.order.indexOf(id) > game.order.indexOf(owner));
  assert.ok(possible.length,`Original public storm order needs a holder on the ${mode} side of Emperor`);
  const other = possible[0], donor = other === 'richese' ? 'guild' : 'richese';
  const from = player(game,donor), receiver = player(game,owner);
  const truthAt = from.hand.findIndex(card => card.effect === 'truthtrance'); assert.ok(truthAt >= 0);
  const exchangeAt = receiver.hand.findIndex(card => card.id !== source.card && card.effect !== 'truthtrance'); assert.ok(exchangeAt >= 0);
  const [truth] = from.hand.splice(truthAt,1), [exchange] = receiver.hand.splice(exchangeAt,1);
  from.hand.push(exchange); receiver.hand.push(truth);
  const otherTruth = player(game,other).hand.find(card => card.effect === 'truthtrance'); assert.ok(otherTruth);
  assert.ok(receiver.hand.some(card => card.id === source.card));
  assert.deepEqual(inventory(game),source.originalInventory);
  const parent = {auction:structuredClone(game.auction), aid:structuredClone(game.aid),
    turn:game.turn, phase:game.phase, active:game.active, order:[...game.order],
    players:game.players.map(row => ({id:row.id,spice:row.spice,reserves:row.reserves,tanks:row.tanks}))};
  const beforeTruth = structuredClone(game);
  for (const actor of [owner,other]) {
    const card = player(game,actor).hand.find(row => row.effect === 'truthtrance'); assert.ok(card);
    game = act(game,actor,{type:'card',card:card.id});
  }
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(row => !game.truthtrance!.passed.includes(row.id)); assert.ok(actor);
    game = act(game,actor.id,{type:'truthPass'});
  }
  const frame = truthOrderFrame(game);
  assert.deepEqual([...frame.holders].sort(),[owner,other].sort());
  assert.deepEqual(game.auction,parent.auction); assert.deepEqual(game.aid,parent.aid);
  const queue = game.truthtrance!.queue.map(row => row.player);
  assert.equal(mode === 'first' ? queue.at(-1) : queue[0],owner);
  assert.deepEqual(inventory(game),source.originalInventory);
  return {game,source,beforeTruth,advanced,standingBid,mode,owner,other,donor,card:source.card,
    truth:truth.id,otherTruth:otherTruth.id,parent,originalCards:source.originalInventory,
    disclosure:'Original public setup, real cache Sapho purchase and ordinary lot; one labelled original dealt Truth↔held card swap.'};
}
export type SaphoTruthAuctionFixture = ReturnType<typeof createSaphoTruthAuctionFixture>;
/** Keep the actual ordinary lot and winning invoice intact while the overlay is live. */
export function assertAuctionParent(game: Game, parent: SaphoTruthAuctionFixture['parent']) {
  assert.equal(game.turn,parent.turn); assert.equal(game.phase,parent.phase); assert.equal(game.active,parent.active);
  assert.deepEqual(game.order,parent.order); assert.deepEqual(game.auction,parent.auction); assert.deepEqual(game.aid,parent.aid);
  assert.deepEqual(game.players.map(row => ({id:row.id,spice:row.spice,reserves:row.reserves,tanks:row.tanks})),parent.players);
}
