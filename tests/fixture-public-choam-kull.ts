import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { actKullPurpose, advanceKullPurpose, kullPurposeClean, kullPurposePlayer, type KullPurposeStep } from './fixture-kull-purpose';

export const act = actKullPurpose;
export const advance = advanceKullPurpose;
export const clean = kullPurposeClean;
export const player = kullPurposePlayer;

/** Treachery cards in the physical zones exercised by this native programme. */
export function publicKullInventory(g: Game): string[] {
  const cards = [...g.deck, ...g.discard, ...g.players.flatMap(p => p.hand),
    ...(g.auction?.cards.slice(g.auction.index) ?? []), ...(g.richeseCache ?? [])].map(card => card.id).sort();
  assert.equal(new Set(cards).size, cards.length, 'Every Treachery card is in one physical zone');
  return cards;
}

/** Normal public Basic CHOAM/Emperor/Guild lobby. The host really starts, then
 * we select only an unopened original starting deal and unopened Spice prefix.
 * Everything after that uses native setup, auction and movement actions. */
export function createPublicChoamKullFixture() {
  let game = createGame('PUBLICKULL', newPlayer('choam', 'CHOAM', 'choam'), false, ['choam', 'ix']);
  for (const faction of ['emperor', 'guild'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const actions: KullPurposeStep[] = [];
  const send = (actor: string, action: Action) => { game = act(game,actor,action,actions); };
  const reach = (predicate: (g: Game) => boolean) => { game = advance(game,predicate,actions); };
  send(game.host,{type:'moduleOption',module:'kullPreview',enabled:true});
  for (const p of game.players) send(p.id,{type:'ready'});
  const lobby = structuredClone(game);
  send(game.host,{type:'start'});
  const setup = structuredClone(game);
  assert.equal(game.status,'setup');
  assert.equal(game.kullPreview,true,'The public host opt-in enables printed Kull in the supported Basic profile');
  assert.ok(game.players.every(p => p.hand.length === 0));
  const originalCards = game.deck.map(card => card.id).sort();
  const selected: Game['deck'] = [];
  for (const name of ['kull','karama','karama']) {
    const i = game.deck.findIndex(card => name === 'kull' ? card.id === 'ix-kull-wahad' : card.effect === 'karama');
    assert.ok(i >= 0); selected.push(game.deck.splice(i,1)[0]);
  }
  const unopenedDeal = selected.map((card,index) => ({player:game.players[index].id,card:card.id}));
  game.deck.unshift(...selected);
  const beforeDeal = structuredClone(game);
  reach(g => g.status === 'playing');
  const afterSetup = structuredClone(game);
  const [kull,karama,counter] = selected.map(card => card.id);
  assert.ok(player(game,'choam').hand.some(card => card.id === kull));
  assert.ok(player(game,'emperor').hand.some(card => card.id === karama));
  assert.ok(player(game,'guild').hand.some(card => card.id === counter));
  assert.deepEqual(publicKullInventory(game),originalCards);
  const i = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery); assert.ok(i >= 0);
  game.spiceDeck.unshift(game.spiceDeck.splice(i,1)[0]);
  reach(g => g.phase === 3 && !!g.auction && g.auction.active === 'emperor' && clean(g));
  const auction = structuredClone(game);
  assert.deepEqual(publicKullInventory(auction),originalCards);
  reach(g => g.phase === 5 && g.active === 'choam' && clean(g));
  send('choam',{type:'endMovement'});
  reach(g => g.phase === 5 && g.active === 'emperor' && clean(g));
  assert.deepEqual(publicKullInventory(game),originalCards);
  return {game,lobby,setup,beforeDeal,afterSetup,auction,actions,originalCards,unopenedDeal,
    kull,karama,counter,actor:'emperor',reactor:'choam',counterOwner:'guild',
    staging:'Selected only original unopened starting cards and a safe unopened Spice prefix; all setup, auction passes and turn changes use real native actions.'};
}
export type PublicChoamKullFixture = ReturnType<typeof createPublicChoamKullFixture>;
export const publicKullAttempt = (f: PublicChoamKullFixture): Action =>
  ({type:'card',mode:'shipment',card:f.karama,target:f.actor});
