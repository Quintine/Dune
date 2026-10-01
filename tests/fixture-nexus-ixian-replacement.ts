import assert from 'node:assert/strict';
import { applyAction, createGame, initializeIxianNexusReplacementGameForAudit, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import type { Card } from '../game/cards';
import { advanceToNextStorm } from './fixture-advanced-source';

export const IXIAN_REPLACEMENT_FACTIONS = ['atreides', 'emperor', 'guild'] as const;
export type IxianReplacementFixtureOptions = {
  initial?: Game;
  advanced?: boolean;
  karama?: boolean;
  face?: 'ixians' | 'richese';
  seatIds?: string[];
  purchasedKind?: 'worthless' | 'shield';
  endingAuction?: boolean;
  fullHand?: boolean;
  otherDraw?: {player: string; face: 'ixians' | 'richese'};
};
export type IxianReplacementFixture = {
  beforePayment: Game;
  game: Game;
  buyer: string;
  event: string;
  purchased: Card;
  paymentAction: Action;
  beforeSpice: number;
  paidSpice: number;
  emperor: string | null;
  beforeEmperorSpice: number | null;
  nextCard: Card | null;
  auctionIndex: number;
};
export function settleIxianReplacementFixture(state: Game): Game {
  let game = state;
  for (let step = 0; step < 100; step++) {
    if (game.pendingTreacheryDiscard) game = applyAction(game, game.players[0].id, {type:'advanceBots'});
    else if (game.response) game = applyAction(game,
      game.players.find(p => !game.response!.passed.includes(p.id))!.id, {type:'passResponse'});
    else return game;
  }
  throw new Error('The original native auction response did not settle.');
}
function stepNative(game: Game): Game {
  if (game.response || game.pendingTreacheryDiscard) return settleIxianReplacementFixture(game);
  if (game.phaseOpening) return applyAction(game,
    game.players.find(p => !game.phaseOpening!.passed.includes(p.id))!.id, {type:'ready'});
  if (game.status === 'playing' && !game.decision) {
    if (game.phase === 0 && game.stormPending === null) {
      const id = game.stormDialers.find(id => game.stormDials[id] === undefined);
      assert.ok(id, 'The native Storm source must supply the next actual dialer.');
      return applyAction(game,id,{type:'stormDial',amount:game.turn === 1 ? 0 : 1});
    }
    if (game.phase === 3 && game.auction) return applyAction(game,game.auction.active,{type:'passBid'});
    if (game.phase === 5) return applyAction(game,game.active!,{type:'endMovement'});
  }
  for (const p of game.players) {
    const view = viewGame(game,p.id);
    view.players.find(seat => seat.id === p.id)!.bot = 'Easy';
    const actions = botActions(view);
    const action = actions.find(a => a.type === 'ready') ?? actions[0];
    if (action) return applyAction(game,p.id,action);
  }
  throw new Error(`Native Ixian fixture stalled at ${game.status}/${game.turn}/${game.phase}/${game.decision?.kind}`);
}
/** Conserves the original undealt inventory, putting the buyer's printed Karama
 * into the genuine starting deal rather than manufacturing an owned card. */
function orderStartingCards(game: Game,buyer: string): void {
  const pool = [...game.deck];
  const front: Card[] = [];
  for (const p of game.players) {
    const quantity = p.faction === 'harkonnen' ? 2 : 1;
    for (let i = 0; i < quantity; i++) {
      const index = pool.findIndex(c => p.id === buyer && i === 0 ? c.effect === 'karama' : c.effect !== 'karama');
      assert.ok(index >= 0);
      front.push(pool.splice(index,1)[0]);
    }
  }
  game.deck = [...front,...pool];
}
/** Genuine fresh setup, native first turn, printed Nexus drawing and normal
 * winner declaration. The returned parent is before the original payment. */
export function createIxianNexusReplacementFixture(options: IxianReplacementFixtureOptions = {}): IxianReplacementFixture {
  let game: Game;
  if (options.initial) {
    game = structuredClone(options.initial);
    assert.ok(game.status === 'lobby' || (game.status === 'setup' &&
      game.nexusIxianReplacementPreview === true && game.turn === 1 && game.phase === 0 &&
      game.players.every(player => player.hand.length === 0)),
    'Continue only an admitted fresh lobby or its undealt native prototype setup.');
    if (options.advanced !== undefined) assert.equal(game.advanced,options.advanced);
  } else {
    const ids = options.seatIds ?? ['p0','p1','p2'];
    assert.equal(ids.length,3);
    game = createGame('IXIANREPLACE',newPlayer(ids[0],'Atreides','atreides'),options.advanced ?? false,[]);
    joinGame(game,newPlayer(ids[1],'Emperor','emperor'));
    joinGame(game,newPlayer(ids[2],'Guild','guild'));
  }
  const buyer = game.players.find(p => p.faction === 'atreides')?.id ??
    game.players.find(p => p.faction !== 'harkonnen')!.id;
  const face = options.face ?? 'ixians';
  if (options.otherDraw) {
    assert.ok(game.players.some(p => p.id === options.otherDraw!.player));
    assert.notEqual(options.otherDraw.player,buyer);
    assert.notEqual(options.otherDraw.face,face);
  }
  const partners = game.players.filter(p => p.id !== buyer && p.id !== options.otherDraw?.player);
  assert.ok(partners.length >= 2,
    'Native Nexus draws require an alliance between two seats other than the requested recipients.');
  if (game.status === 'lobby') {
    for (const p of game.players) if (!p.ready) game = applyAction(game,p.id,{type:'ready'});
    game.nexusCards ??= {cards:null,phase:null};
    game = initializeIxianNexusReplacementGameForAudit(game);
  }
  orderStartingCards(game,buyer);
  // Prepare the conserved faces before any native Nexus acquisition. Setup
  // initializes an empty Nexus hand; only a qualifying closing Nexus draws.
  const nexus = game.nexusCards!.cards!;
  const faces: typeof nexus.deck = [face,...(options.otherDraw ? [options.otherDraw.face] : [])];
  assert.ok(faces.every(card => nexus.deck.includes(card)));
  nexus.deck = [...faces,...nexus.deck.filter(card => !faces.includes(card))];
  for (let step = 0; game.status === 'setup' && step < 100; step++) game = stepNative(game);
  assert.equal(game.status,'playing');
  // A complete native first turn supplies the next-turn source; no phase/turn
  // assignment or Basic-to-Advanced flag flip is used.
  for (let position = 0; position < 2; position++) {
    const land = game.spiceDeck.findIndex((c,index) => index >= position && 'territory' in c);
    assert.ok(land >= position);
    game.spiceDeck.splice(position,0,game.spiceDeck.splice(land,1)[0]);
  }
  if (options.fullHand) {
    for (let step = 0; step < 1200; step++) {
      if (game.turn === 2 && game.phase === 0 && !game.phaseOpening && !game.response && !game.decision) break;
      if (game.decision?.kind === 'auctionPayment')
        game = applyAction(game,game.decision.player,{type:'decision',karama:false});
      else if (!game.phaseOpening && !game.response && !game.decision && game.phase === 3 &&
        game.auction?.active === buyer && game.auction.bid === 0 &&
        game.players.find(p => p.id === buyer)!.hand.length < 3)
        game = applyAction(game,buyer,{type:'bid',amount:2});
      else game = stepNative(game);
    }
    assert.equal(game.players.find(p => p.id === buyer)!.hand.length,3);
  } else game = advanceToNextStorm(game);
  assert.equal(game.turn,2);
  for (let step = 0; game.phase !== 1 && step < 200; step++) game = stepNative(game);
  const worm = game.spiceDeck.findIndex(c => 'worm' in c && !c.greatMaker && !c.suppressed);
  assert.ok(worm >= 0);
  game.spiceDeck.splice(0,0,game.spiceDeck.splice(worm,1)[0]);
  for (let step = 0; !(game.nexus && !game.spiceWindow && !game.spiceResolution &&
    !game.phaseOpening && !game.response && !game.decision) && step < 200; step++) game = stepNative(game);
  assert.equal(game.phase,1);
  assert.equal(game.nexus,true);
  // The publisher lifecycle grants no card without an alliance. Negotiate it
  // through the actual native actions, leaving every requested recipient free.
  game = applyAction(game,partners[0].id,{type:'alliance',target:partners[1].id});
  game = applyAction(game,partners[1].id,{type:'alliance',target:partners[0].id});
  for (let step = 0; game.nexusCards?.phase?.stage !== 'drawing' && step < 200; step++) game = stepNative(game);
  assert.equal(game.nexusCards?.phase?.stage,'drawing');
  game = applyAction(game,buyer,{type:'nexusCardChoice',turn:game.turn,card:null,choice:'draw',ownRedraws:0});
  assert.equal(game.nexusCards!.cards!.hands[buyer],face);
  for (const id of game.nexusCards!.phase!.eligible) {
    if (game.nexusCards!.phase!.done.includes(id)) continue;
    const other: IxianReplacementFixtureOptions['otherDraw'] | null =
      options.otherDraw?.player === id ? options.otherDraw : null;
    game = applyAction(game,id,{type:'nexusCardChoice',turn:game.turn,card:null,choice:other ? 'draw' : 'keep',ownRedraws:0});
    if (other) assert.equal(game.nexusCards!.cards!.hands[id],other.face);
  }
  // Reorder only the unplayed deck, before native auction allocation.
  const kind = options.purchasedKind ?? 'worthless';
  const wanted = game.deck.findIndex(c => c.kind === kind);
  assert.ok(wanted >= 0);
  const auctionOffset = options.endingAuction ? game.players.filter(p => p.hand.length < (p.faction === 'harkonnen' ? 8 : 4)).length - 1 : 0;
  game.deck.splice(auctionOffset,0,game.deck.splice(wanted,1)[0]);
  for (let step = 0; !(game.decision?.kind === 'auctionPayment' && game.decision.player === buyer) && step < 300; step++) {
    if (game.decision?.kind === 'auctionPayment')
      game = applyAction(game,game.decision.player,{type:'decision',karama:false});
    else if (game.phaseOpening || game.response || game.decision || !game.auction) game = stepNative(game);
    else if (options.endingAuction && game.auction.index < game.auction.cards.length - 1) {
      const active = game.players.find(p => p.id === game.auction!.active)!;
      game = applyAction(game,active.id,active.id !== buyer && active.faction !== 'harkonnen' &&
        game.auction.bid === 0 ? {type:'bid',amount:1} : {type:'passBid'});
    }
    else if (game.auction.active === buyer && game.auction.bid === 0)
      game = applyAction(game,buyer,{type:'bid',amount:2});
    else game = applyAction(game,game.auction.active,{type:'passBid'});
  }
  assert.deepEqual(game.decision,{kind:'auctionPayment',player:buyer});
  assert.equal(game.auction!.bidder,buyer);
  assert.equal(game.auction!.bid,2);
  assert.equal(game.auction!.allyPayment ?? 0,0);
  const beforePayment = structuredClone(game);
  const owner = game.players.find(p => p.id === buyer)!;
  const emperor = game.players.find(p => p.faction === 'emperor')?.id ?? null;
  const beforeEmperorSpice = emperor ? game.players.find(p => p.id === emperor)!.spice : null;
  const beforeSpice = owner.spice;
  const purchased = structuredClone(game.auction!.cards[game.auction!.index]);
  const paymentAction: Action = options.karama
    ? {type:'decision',karama:true,card:owner.hand.find(c => c.effect === 'karama')!.id}
    : {type:'decision',karama:false};
  game = applyAction(game,buyer,paymentAction);
  assert.ok(game.pendingNexusIxianReplacement);
  const event = game.pendingNexusIxianReplacement.event;
  return {beforePayment,game,buyer,event,purchased,paymentAction,beforeSpice,
    paidSpice:game.players.find(p => p.id === buyer)!.spice,emperor,beforeEmperorSpice,
    nextCard:game.deck[0] ? structuredClone(game.deck[0]) : null,auctionIndex:beforePayment.auction!.index};
}
