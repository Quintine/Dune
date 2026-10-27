import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import type { TruthQuestion } from '../game/truthtrance';
import { actKullPurpose, advanceKullPurpose, kullPurposeClean, kullPurposePlayer, type KullPurposeStep } from './fixture-kull-purpose';
import { publicKullInventory } from './fixture-public-choam-kull';

export const act = actKullPurpose;
export const advance = advanceKullPurpose;
export const clean = kullPurposeClean;
export const player = kullPurposePlayer;
export const inventory = publicKullInventory;
export type KullBribeKind = 'bribe' | 'bribeExpression' | 'mixedBribe';

/** Public Basic opt-in, original unopened Treachery cards and a safe unopened
 * Spice position. All subsequent setup and phase movement uses native actions.
 * Cards are selected before the initial deal, not granted from a playing hand. */
export function createKullBribeFixture() {
  let game = createGame('KULLBRIBE',newPlayer('choam','CHOAM','choam'),false,['choam','ix']);
  for (const id of ['emperor','guild','harkonnen'] as const) joinGame(game,newPlayer(id,id,id));
  const actions: KullPurposeStep[] = [];
  const send = (actor:string,action:Action) => {game = act(game,actor,action,actions);};
  const reach = (until:(g:Game)=>boolean) => {game = advance(game,until,actions);};
  send('choam',{type:'moduleOption',module:'kullPreview',enabled:true});
  for (const seat of game.players) send(seat.id,{type:'ready'});
  const lobby = structuredClone(game);
  send('choam',{type:'start'});
  const setup = structuredClone(game);
  assert.equal(game.kullPreview,true); assert.equal(game.status,'setup');
  assert.ok(game.players.every(seat => seat.hand.length === 0));
  const originalCards = game.deck.map(card=>card.id).sort(), selected:Game['deck']=[];
  for (const kind of ['kull','karama','truth','karama'] as const) {
    const i = game.deck.findIndex(card => kind === 'kull' ? card.id === 'ix-kull-wahad' :
      kind === 'truth' ? card.effect === 'truthtrance' : card.effect === 'karama');
    assert.ok(i >= 0); selected.push(game.deck.splice(i,1)[0]);
  }
  game.deck.unshift(...selected);
  const beforeDeal = structuredClone(game);
  reach(g=>g.status === 'playing');
  const afterSetup = structuredClone(game), [kull,karama,truth,counter]=selected.map(card=>card.id);
  for (const [seat,card] of [['choam',kull],['emperor',karama],['guild',truth],['harkonnen',counter]] as const)
    assert.ok(player(game,seat).hand.some(held=>held.id === card),`${seat} received the selected original card`);
  assert.deepEqual(inventory(game),originalCards);
  const i = game.spiceDeck.findIndex(card=>'territory' in card && !card.discovery); assert.ok(i >= 0);
  game.spiceDeck.unshift(game.spiceDeck.splice(i,1)[0]);
  reach(g=>g.phase <= 1 && clean(g));
  const early = structuredClone(game);
  reach(g=>g.phase === 2 && clean(g) && g.choamCharity?.turn === g.turn);
  const charity = structuredClone(game);
  assert.equal(player(game,'emperor').spice,10);
  reach(g=>g.phase === 5 && g.active === 'emperor' && clean(g));
  assert.deepEqual(inventory(game),originalCards);
  return {game, early, charity, lobby, setup, beforeDeal, afterSetup, originalCards, actions,
    kull,karama,truth,counter,actor:'emperor',asker:'guild',reactor:'choam',counterOwner:'harkonnen',recipient:'guild',
    staging:'Selected original unopened Kull, two Karama and Truth cards plus one safe unopened Spice position; all subsequent setup and progression use real actions.'};
}
export type KullBribeFixture = ReturnType<typeof createKullBribeFixture>;
export function question(f:KullBribeFixture,kind:KullBribeKind,minimum:number,game:Game):TruthQuestion {
  if (kind === 'bribe') return {kind,target:f.actor,turn:game.turn,recipient:f.recipient,minimum};
  const leaf = {kind:'payment' as const,recipient:f.recipient,minimum};
  if (kind === 'bribeExpression') return {kind,target:f.actor,turn:game.turn,claim:leaf};
  return {kind,target:f.actor,turn:game.turn,mixed:{kind:'and',terms:[
    {kind:'fact',fact:{kind:'spice',compare:'eq',value:player(game,f.actor).spice}},
    {kind:'action',action:{recipient:f.recipient,minimum}},
  ]}};
}
export function ask(f:KullBribeFixture,game:Game,kind:KullBribeKind='bribe',minimum=3):Game {
  game = act(game,f.asker,{type:'card',card:f.truth});
  for (let count=0;game.truthtrance?.stage === 'priority' && count<game.players.length;count++) {
    const seat = game.players.find(row=>!game.truthtrance!.passed.includes(row.id)); assert.ok(seat);
    game=act(game,seat.id,{type:'truthPass'});
  }
  assert.equal(game.truthtrance?.stage,'ask');
  return act(game,f.asker,{type:'truthAsk',question:question(f,kind,minimum,game)});
}
export function answer(f:KullBribeFixture,game:Game,value:'yes'|'no'):Game {
  return act(game,f.actor,{type:'truthAnswer',answer:value});
}
export function bind(f:KullBribeFixture,game:Game,value:'yes'|'no'='yes',kind:KullBribeKind='bribe',minimum=3) {
  const asked = ask(f,game,kind,minimum), bound = answer(f,asked,value);
  return {asked,game:bound};
}
export const attempt = (f:KullBribeFixture):Action => ({type:'card',mode:'shipment',card:f.karama,target:f.actor});
export function reject(game:Game,actor:string,action:Action) {
  const before=structuredClone(game); assert.throws(()=>act(game,actor,action)); assert.deepEqual(game,before);
}
