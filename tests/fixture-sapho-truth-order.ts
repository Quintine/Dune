import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { actSaphoStartedMovement as act, createSaphoStartedMovementFixture,
  saphoStartedMovementInventory as inventory, saphoStartedMovementPlayer as player } from './fixture-sapho-started-movement';

export { act, inventory, player };
export type OrderFrame = {event:string;holders:string[];passed:string[];revision:number};
export function truthOrderFrame(game: Game): OrderFrame {
  assert.equal(game.truthtrance?.stage, 'order');
  const frame = (game.truthtrance as typeof game.truthtrance & {order?:OrderFrame}).order;
  assert.ok(frame); return frame;
}

/** Original public R/A/E/G Basic or Advanced setup, selected unopened original
 * Truth deals and a genuinely purchased Sapho. Controlled supplemental card
 * custody: exchange one actually dealt Truth with Emperor's other physical
 * starting card so the genuine Sapho owner also holds a Truthtrance. This is
 * explicitly not a claimed native Truth acquisition. Every physical card,
 * hand count, purse, force, turn, phase and original started parent is retained.
 * The remaining Truth stays with its original recipient. */
export function createSaphoTruthOrderFixture(options: {advanced?:boolean; mode?:'first'|'last'; withoutSapho?:boolean} = {}) {
  const advanced = options.advanced ?? false, mode = options.mode ?? 'first';
  const source = createSaphoStartedMovementFixture({advanced,truthFor:['richese','guild']});
  let game = structuredClone(source.game);
  const owner = source.owner;
  // The original physical order is Richese, Atreides, Emperor, Guild. Taking
  // Guild's Truth makes Emperor last; taking Richese's makes Emperor first.
  const donor = mode === 'first' ? 'guild' : 'richese';
  const other = mode === 'first' ? 'richese' : 'guild';
  assert.ok(game.order.indexOf(other) !== game.order.indexOf(owner));
  const from = player(game,donor), receiver = player(game,owner);
  const truthAt = from.hand.findIndex(card => card.effect === 'truthtrance'); assert.ok(truthAt >= 0);
  const otherAt = receiver.hand.findIndex(card => card.id !== source.card && card.effect !== 'truthtrance'); assert.ok(otherAt >= 0);
  const [truth] = from.hand.splice(truthAt,1), [exchange] = receiver.hand.splice(otherAt,1);
  from.hand.push(exchange); receiver.hand.push(truth);
  const remainingTruth = player(game,other).hand.find(card => card.effect === 'truthtrance'); assert.ok(remainingTruth);
  assert.ok(receiver.hand.some(card => card.id === source.card));
  if (options.withoutSapho) {
    // Controlled card custody before either declaration: exchange the genuine
    // Sapho with another actual cache card. This tests creation of the public
    // window without inspecting whether anybody owns the card.
    const at = receiver.hand.findIndex(card => card.id === source.card), cache = game.richeseCache;
    assert.ok(at >= 0 && cache?.length);
    const [sapho] = receiver.hand.splice(at,1), replacement = cache.shift()!;
    receiver.hand.push(replacement); cache.push(sapho);
  }
  assert.deepEqual(inventory(game),source.originalInventory);
  const before = structuredClone(game), order = [...game.order], parent = {
    phase:game.phase, turn:game.turn, active:game.active,
    movementRemaining:structuredClone(game.movementRemaining),
    players:game.players.map(row => ({id:row.id,spice:row.spice,reserves:row.reserves,tanks:row.tanks,
      shipped:row.shipped,moved:row.moved,forces:structuredClone(row.forces)})),
  };
  // Submit in reverse of physical storm order to demonstrate that network
  // arrival is not the question order. Both declarations are real actions.
  for (const actor of [owner,other]) {
    const card = player(game,actor).hand.find(row => row.effect === 'truthtrance'); assert.ok(card);
    game = act(game,actor,{type:'card',card:card.id});
  }
  while (game.truthtrance?.stage === 'priority') {
    const seat = game.players.find(row => !game.truthtrance!.passed.includes(row.id)); assert.ok(seat);
    game = act(game,seat.id,{type:'truthPass'});
  }
  const frame = truthOrderFrame(game);
  assert.deepEqual([...frame.holders].sort(),[owner,other].sort());
  assert.deepEqual(game.order,order);
  assert.deepEqual(inventory(game),source.originalInventory);
  const queue = game.truthtrance!.queue.map(row => row.player);
  assert.equal(mode === 'first' ? queue.at(-1) : queue[0],owner,
    `The actual pending group must offer a non-no-op ${mode} choice`);
  return {game,source,before,advanced,mode,owner,other,donor,truth:truth.id,
    otherTruth:remainingTruth.id,card:source.card,originalCards:source.originalInventory,order,parent,
    disclosure:'Actual public setup, paid original Sapho acquisition and started movement; one labelled conserved card swap places an original dealt Truth in the Sapho owner hand.'};
}
export type SaphoTruthOrderFixture = ReturnType<typeof createSaphoTruthOrderFixture>;
export function passTruthOrder(game: Game, actor: string): Game {
  const frame = truthOrderFrame(game);
  return act(game,actor,{type:'truthOrderPass',event:frame.event,revision:frame.revision});
}
export function playSaphoTruthOrder(game: Game, actor: string, card: string, mode:'first'|'last'): Game {
  const frame = truthOrderFrame(game);
  return act(game,actor,{type:'saphoTruthOrder',event:frame.event,revision:frame.revision,card,mode});
}
export function finishTruthOrder(state: Game): Game {
  let game = state;
  while (game.truthtrance?.stage === 'order') {
    const frame = truthOrderFrame(game), next = frame.holders.find(holder => !frame.passed.includes(holder));
    assert.ok(next); game = passTruthOrder(game,next);
  }
  assert.equal(game.truthtrance?.stage,'ask'); return game;
}
/** Public fresh-discard offers are intentionally possession-independent: even
 * a table with no held Semuta must pass its neutral reaction window. */
export function passFreshDiscard(state: Game): Game {
  let game = state;
  for (let count = 0; game.pendingTreacheryDiscard?.reaction?.stage === 'offer' && count < game.players.length; count++) {
    const pending = game.pendingTreacheryDiscard, reaction = pending.reaction!;
    assert.equal(reaction.stage,'offer');
    if (reaction.stage !== 'offer') throw new Error('The Semuta response must remain an offer.');
    const actor = game.players.find(row => !reaction.passed.includes(row.id)); assert.ok(actor);
    game = act(game,actor.id,{type:'semutaPass',event:pending.batch.event});
  }
  assert.ok(!game.pendingTreacheryDiscard?.reaction || game.pendingTreacheryDiscard.reaction.stage !== 'offer');
  return game;
}
export function finishOriginalTruthQuestions(state: Game): Game {
  let game = state;
  while (game.truthtrance) {
    assert.equal(game.truthtrance.stage,'ask');
    const asker = game.truthtrance.queue[0].player;
    const target = game.players.find(row => row.id !== asker)!.id;
    game = act(game,asker,{type:'truthAsk',question:{kind:'fact',target,
      fact:{kind:'spice',compare:'gte',value:0}}});
    assert.equal(game.truthtrance?.stage,'answer');
    game = act(game,target,{type:'truthAnswer',answer:'yes'});
    // If another player holds Semuta, the real completed Truth discard can
    // open its own fresh reaction; pass it rather than bypassing custody.
    game = passFreshDiscard(game);
  }
  return game;
}
export function rejectSaphoTruthOrder(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => act(game,actor,action));
  assert.deepEqual(game,before,'Rejected ordering action must not mutate its input');
}
export function ownOrderChoices(game: Game, actor: string) {
  return viewGame(game,actor).saphoTruthOrderChoices;
}
