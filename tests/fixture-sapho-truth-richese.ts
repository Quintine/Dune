import assert from 'node:assert/strict';
import { type Game } from '../game/engine';
import { createTruthRicheseBidFixture } from './fixture-truth-richese-bid';
import { createTruthRicheseSilentFixture } from './fixture-truth-richese-silent';
import { act, inventory, player } from './fixture-truth-richese-bid';
import { truthOrderFrame } from './fixture-sapho-truth-order';

export { act, inventory, player };

/** Native public R/A/E setup and actual started first cache lot. Controlled,
 * conserved custody supplements: swap the original cached Sapho for Emperor's
 * dealt card; move an undealt original Truth to his vacant hand slot; optionally
 * swap original cached Semuta for Richese's dealt card. None is represented as
 * an earned purchase. The other actual dealt Truth, lot and funds stay native. */
export function createSaphoTruthRicheseFixture(options: {
  advanced?: boolean; method?: 'onceAround' | 'silent'; semuta?: boolean; standingBid?: boolean;
} = {}) {
  const advanced = options.advanced ?? false, method = options.method ?? 'onceAround';
  const source = method === 'silent' ? createTruthRicheseSilentFixture(advanced) : createTruthRicheseBidFixture(advanced);
  let game = structuredClone(source.game);
  const owner = source.target, other = source.asker, semutaHolder = source.owner, lot = source.lot;
  const cache = game.richeseCache!;
  const saphoAt = cache.findIndex(card => card.effect === 'juiceOfSapho');
  assert.ok(saphoAt >= 0, 'The original cache must contain Sapho');
  const receiver = player(game,owner);
  assert.ok(receiver.hand.length);
  const [sapho] = cache.splice(saphoAt,1), [exchange] = receiver.hand.splice(0,1);
  receiver.hand.push(sapho); cache.push(exchange);
  const truthAt = game.deck.findIndex(card => card.effect === 'truthtrance');
  assert.ok(truthAt >= 0, 'A second original Truth is available in the undealt deck');
  const [truth] = game.deck.splice(truthAt,1); receiver.hand.push(truth);
  let semuta: string | null = null;
  if (options.semuta) {
    const at = cache.findIndex(card => card.effect === 'semutaDrug'); assert.ok(at >= 0);
    const claimant = player(game,semutaHolder); assert.ok(claimant.hand.length);
    const [drug] = cache.splice(at,1), [held] = claimant.hand.splice(0,1);
    claimant.hand.push(drug); cache.push(held); semuta = drug.id;
  }
  assert.deepEqual(inventory(game),source.originalCards);
  if (options.standingBid) {
    const bidder = method === 'silent' ? semutaHolder : game.richeseAuction!.active!;
    game = act(game,bidder,{type:'richeseBid',event:lot,amount:1,allyPayment:0});
    assert.ok(game.richeseAuction && !game.richeseAuction.outcome);
  }
  const mode = game.order.indexOf(owner) > game.order.indexOf(other) ? 'first' as const : 'last' as const;
  const parent = {
    turn:game.turn, phase:game.phase, active:game.active, order:structuredClone(game.order),
    auction:structuredClone(game.richeseAuction), funding:structuredClone(game.richeseFunding),
    bidding:structuredClone(game.richeseBidding), aid:structuredClone(game.aid),
    offered:structuredClone(game.richeseOfferedCard),
    players:game.players.map(row => ({id:row.id,spice:row.spice,reserves:row.reserves,tanks:row.tanks})),
  };
  const beforeTruth = structuredClone(game);
  for (const [actor,card] of [[owner,truth.id],[other,source.truth]] as const)
    game = act(game,actor,{type:'card',card});
  while (game.truthtrance?.stage === 'priority') {
    const next = game.players.find(row => !game.truthtrance!.passed.includes(row.id)); assert.ok(next);
    game = act(game,next.id,{type:'truthPass'});
  }
  assert.deepEqual([...truthOrderFrame(game).holders].sort(),[owner,other].sort());
  assertRicheseParent(game,parent);
  return {game,source,advanced,method,owner,other,semutaHolder,card:sapho.id,semuta,truth:truth.id,
    otherTruth:source.truth,lot,mode,parent,beforeTruth,originalCards:source.originalCards,
    disclosure:'Actual public setup and native cache lot; labelled conserved cache/hand swaps and undealt Truth placement.'};
}
export type SaphoTruthRicheseFixture = ReturnType<typeof createSaphoTruthRicheseFixture>;
export function assertRicheseParent(game: Game, parent: SaphoTruthRicheseFixture['parent']) {
  assert.equal(game.turn,parent.turn); assert.equal(game.phase,parent.phase); assert.equal(game.active,parent.active);
  assert.deepEqual(game.order,parent.order); assert.deepEqual(game.richeseAuction,parent.auction);
  assert.deepEqual(game.richeseFunding,parent.funding); assert.deepEqual(game.richeseBidding,parent.bidding);
  assert.deepEqual(game.aid,parent.aid); assert.deepEqual(game.richeseOfferedCard,parent.offered);
  assert.deepEqual(game.players.map(row => ({id:row.id,spice:row.spice,reserves:row.reserves,tanks:row.tanks})),parent.players);
}
