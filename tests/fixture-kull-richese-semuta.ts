import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { actKullPurpose, kullPurposeClean, kullPurposePlayer, nextKullPurposeStep,
  type KullPurposeStep } from './fixture-kull-purpose';

export const act = actKullPurpose;
export const player = kullPurposePlayer;
export const clean = kullPurposeClean;

/** Includes both decks and all visible physical card zones used here. */
export function inventory(game: Game): string[] {
  const cards = [...game.deck, ...game.discard, ...(game.richeseCache ?? []),
    ...(game.richeseRemoved ?? []), ...game.players.flatMap(p => p.hand),
    ...(game.auction?.cards.slice(game.auction.index) ?? [])].map(card => card.id).sort();
  assert.equal(new Set(cards).size,cards.length,'Each original Treachery card occupies one physical zone');
  return cards;
}

/** Native choices only. The original Richese cache auction is deliberately
 * Silent: Richese pays one, every other eligible player submits zero. */
function next(game: Game): KullPurposeStep | null {
  const pending = game.pendingTreacheryDiscard, reaction = pending?.reaction;
  if (pending && reaction?.stage === 'offer') {
    const actor = game.players.find(p => !reaction.passed.includes(p.id)); assert.ok(actor);
    return {actor:actor.id,action:{type:'semutaPass',event:pending.batch.event}};
  }
  if (!game.phaseOpening && !game.response && game.decision?.kind === 'richeseCache')
    return {actor:game.decision.player,action:{type:'decision',event:game.richeseBidding!.event,
      card:SEMUTA_DRUG_ID,method:'silent'}};
  const lot = game.richeseAuction;
  if (lot && !lot.outcome && !game.phaseOpening && !game.response && !game.decision) {
    assert.equal(lot.method,'silent');
    const actor = lot.eligible.find(id => !Object.hasOwn(lot.sealed,id)); assert.ok(actor);
    return {actor,action:{type:'richeseBid',event:lot.event,amount:actor === 'richese' ? 1 : 0,allyPayment:0}};
  }
  return nextKullPurposeStep(game);
}
export function advance(game: Game, until: (state: Game) => boolean, actions: KullPurposeStep[] = []): Game {
  for (let count=0;count<1800;count++) {
    if (until(game)) return game;
    assert.notEqual(game.status,'finished','Original Kull/Semuta programme ended before its requested window');
    const step=next(game); assert.ok(step,'Resolve the current native choice before continuing');
    game=act(game,step.actor,step.action,actions);
  }
  throw Error('Original Kull/Semuta programme did not reach the requested window');
}

/** Public Basic opt-in. Original card order and a safe unopened Spice position
 * are selected before use; Richese actually buys Semuta in its native auction.
 * No played hand, spice, board force, pending event or phase is installed. */
export function createKullRicheseSemutaFixture() {
  let game=createGame('KULLSEMUTA',newPlayer('choam','CHOAM','choam'),false,['choam','ix']);
  for (const id of ['richese','emperor','harkonnen'] as const) joinGame(game,newPlayer(id,id,id));
  const actions:KullPurposeStep[]=[];
  const send=(actor:string,action:Action)=>{game=act(game,actor,action,actions);};
  const reach=(until:(state:Game)=>boolean)=>{game=advance(game,until,actions);};
  send('choam',{type:'moduleOption',module:'kullPreview',enabled:true});
  for (const p of game.players) send(p.id,{type:'ready'});
  const lobby=structuredClone(game);
  send('choam',{type:'start'});
  assert.equal(game.status,'setup');
  assert.equal(game.kullPreview,true);
  assert.equal(game.semutaPreview,true,'Native Richese must retain its Semuta discard opportunity');
  assert.ok(game.players.every(p=>p.hand.length===0));
  const originalCards=inventory(game), selected:Game['deck']=[];
  for (const kind of ['kull','filler','karama','karama'] as const) {
    const index=game.deck.findIndex(card=>kind==='kull' ? card.id==='ix-kull-wahad' :
      kind==='karama' ? card.effect==='karama' : card.kind==='worthless' && card.id!=='ix-kull-wahad');
    assert.ok(index>=0,`Missing unopened ${kind}`); selected.push(game.deck.splice(index,1)[0]);
  }
  game.deck.unshift(...selected);
  reach(state=>state.status==='playing');
  const [kull,,karama,counter]=selected.map(card=>card.id);
  assert.ok(player(game,'choam').hand.some(card=>card.id===kull));
  assert.ok(player(game,'emperor').hand.some(card=>card.id===karama));
  assert.ok(player(game,'harkonnen').hand.some(card=>card.id===counter));
  assert.ok(game.richeseCache?.some(card=>card.id===SEMUTA_DRUG_ID));
  assert.deepEqual(inventory(game),originalCards);
  const index=game.spiceDeck.findIndex(card=>'territory' in card && !card.discovery);
  assert.ok(index>=0); game.spiceDeck.unshift(game.spiceDeck.splice(index,1)[0]);
  reach(state=>player(state,'richese').hand.some(card=>card.id===SEMUTA_DRUG_ID) && clean(state));
  const acquired=structuredClone(game);
  assert.ok(actions.some(step=>step.actor==='richese' && step.action.type==='richeseBid' && step.action.amount===1));
  reach(state=>state.phase===5 && state.active==='emperor' && clean(state));
  assert.deepEqual(inventory(game),originalCards);
  return {game,lobby,acquired,actions,originalCards,kull,karama,counter,semuta:SEMUTA_DRUG_ID,
    actor:'emperor',reactor:'choam',counterOwner:'harkonnen',holder:'richese'};
}
export type KullRicheseSemutaFixture=ReturnType<typeof createKullRicheseSemutaFixture>;
export const attempt=(f:KullRicheseSemutaFixture):Action=>
  ({type:'card',mode:'shipment',card:f.karama,target:f.actor});
