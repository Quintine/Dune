import assert from 'node:assert/strict';
import {applyAction,createGame,initializeIxianNexusBetrayalGameForAudit,joinGame,newPlayer,viewGame,type Action,type Game} from '../game/engine';
import {botActions} from '../game/bots';
import type {Card} from '../game/cards';

export type IxianBetrayalFixtureOptions = {initial?:Game;kind?:'bidding'|'technology';advanced?:boolean;face?:'ixians'|'richese';secondFace?:'guild'|'ixians'|'richese';seatIds?:string[];receiverCount?:1|2};
export type IxianBetrayalFixture = {beforeNativeAttempt:Game;actor:string;declarationAction:Action;beforeNativeCounter:Game;game:Game;event:string;provider:string;holder:string;required:string[];kind:'bidding'|'technology';selected:Card|null;nativeCount:number};
export function settleIxianBetrayalNativeCounters(state:Game):Game {
  let game=state;
  for(let i=0;i<100;i++) {
    if(game.pendingNexusIxianBetrayal || !game.response) return game;
    const seat=game.players.find(p=>!game.response!.passed.includes(p.id));
    assert.ok(seat);
    game=applyAction(game,seat.id,{type:'passResponse'});
  }
  throw new Error('The original native counters did not settle.');
}
function nativeStep(game:Game):{actor:string;action:Action} {
  if(game.pendingNexusIxianBetrayal) {
    const frame=game.pendingNexusIxianBetrayal;
    return {actor:frame.required.find(id=>!frame.passed.includes(id))!,action:{type:'nexusIxianBetrayalPass',event:frame.source.event}};
  }
  if(game.nexusCards?.phase?.stage==='drawing') {
    const phase=game.nexusCards.phase;
    const actor=phase.eligible.find(id=>!phase.done.includes(id))!;
    return {actor,action:{type:'nexusCardChoice',turn:phase.turn,card:game.nexusCards.cards!.hands[actor],choice:'keep',ownRedraws:0}};
  }
  if(game.pendingTreacheryDiscard) return {actor:game.players[0].id,action:{type:'advanceBots'}};
  if(game.response) return {actor:game.players.find(p=>!game.response!.passed.includes(p.id))!.id,action:{type:'passResponse'}};
  if(game.phaseOpening) return {actor:game.players.find(p=>!game.phaseOpening!.passed.includes(p.id))!.id,action:{type:'ready'}};
  if(game.decision?.kind==='ixTechnology')
    return {actor:game.decision.player,action:{type:'decision',decline:true}};
  if(game.status==='playing' && !game.decision) {
    if(game.phase===0 && game.stormPending===null) return {actor:game.stormDialers.find(id=>game.stormDials[id]===undefined)!,action:{type:'stormDial',amount:game.turn===1?0:1}};
    if(game.phase===3 && game.auction) return {actor:game.auction.active,action:{type:'passBid'}};
    if(game.phase===5) return {actor:game.active!,action:{type:'endMovement'}};
    if(game.phase!==6 || !game.active) {
      const seat=game.players.find(p=>!game.ready.includes(p.id));
      if(seat) return {actor:seat.id,action:{type:'ready'}};
    }
  }
  for(const p of game.players) {
    if(game.decision&&game.decision.player!==p.id) continue;
    const view=viewGame(game,p.id);
    view.players.find(s=>s.id===p.id)!.bot='Easy';
    const actions=botActions(view);
    const action=actions.find(a=>a.type==='ready')??actions[0];
    if(action) return {actor:p.id,action};
  }
  throw new Error(`No native source action at ${game.status}/${game.turn}/${game.phase}/${game.decision?.kind}`);
}
function step(game:Game):Game {const next=nativeStep(game);return applyAction(game,next.actor,next.action);}
/** Conserved original inventory, genuine setup, full first turn, settled nonholder
 * alliance and actual Nexus draw. No phases, cards, forces or sources are injected. */
export function createIxianNexusBetrayalFixture(options:IxianBetrayalFixtureOptions={}):IxianBetrayalFixture {
  const kind=options.kind??'bidding', face=options.face??'ixians';
  let game:Game;
  if(options.initial) {
    game=structuredClone(options.initial);
    assert.ok(game.status==='lobby'||(game.status==='setup'&&game.nexusIxianBetrayalPreview&&game.turn===1&&game.phase===0&&game.players.every(p=>p.hand.length===0)),'Only an admitted fresh undealt profile may continue.');
    if(options.advanced!==undefined) assert.equal(game.advanced,options.advanced);
  } else {
    const ids=options.seatIds??(options.receiverCount===2?['p0','p1','p2','p3']:['p0','p1','p2']);
    game=createGame('IXIANBETRAYAL',newPlayer(ids[0],'Atreides','atreides'),options.advanced??kind==='technology',['ix']);
    joinGame(game,newPlayer(ids[1],'Ixians','ixians'));
    joinGame(game,newPlayer(ids[2],'Guild','guild'));
    if(ids.length>3) joinGame(game,newPlayer(ids[3],'Emperor','emperor'));
  }
  if(kind==='technology') assert.equal(game.advanced,true);
  const provider=game.players.find(p=>p.faction==='ixians')!.id;
  const holder=game.players.find(p=>p.faction==='atreides')?.id??game.players.find(p=>p.id!==provider)!.id;
  const second=options.receiverCount===2?game.players.find(p=>p.id!==holder&&p.id!==provider)!.id:null;
  const partners=game.players.filter(p=>p.id!==holder&&p.id!==second);
  assert.ok(partners.length>=2,'Original Nexus draw needs two nonreceiver allies.');
  if(game.status==='lobby') {
    for(const p of game.players) if(!p.ready) game=applyAction(game,p.id,{type:'ready'});
    game.nexusCards??={cards:null,phase:null};
    game=initializeIxianNexusBetrayalGameForAudit(game);
  }
  // A native Ix setup chooses from conserved faces. Printed-counter profiles
  // reserve a Karama in the shuffled non-Ix deal; Advanced BG-counter profiles
  // give every non-Ix seat an original worthless card for its real conversion.
  const karam=game.deck.filter(c=>c.effect==='karama');
  assert.ok(karam.length>=2);
  const other=game.deck.filter(c=>c.effect!=='karama');
  if(game.advanced&&game.players.some(p=>p.faction==='beneGesserit')) {
    const worthless=other.filter(c=>c.kind==='worthless');
    const ixCard=karam[0];
    assert.ok(worthless.length>=game.players.length-1);
    const dealt=[ixCard,...worthless.slice(0,game.players.length-1)];
    game.deck=[...dealt,...game.deck.filter(c=>!dealt.includes(c))];
  } else {
    game.deck=[karam[0],...other.slice(0,game.players.length-1),karam[1],...other.slice(game.players.length-1),...karam.slice(2)];
  }
  const nx=game.nexusCards!.cards!, faces:typeof nx.deck=[face,...(second?[options.secondFace??(face==='ixians'?'richese':'ixians')]:[])];
  assert.equal(new Set(faces).size,faces.length,'Only distinct conserved singleton Nexus faces may be ordered.');
  nx.deck=[...faces,...nx.deck.filter(c=>!faces.includes(c))];
  for(let i=0;game.status==='setup'&&i<150;i++) {
    if(game.decision?.kind==='ixSetup') {
      const bgCounter=game.advanced&&game.players.some(p=>p.faction==='beneGesserit');
      const card=game.ixSetupCards!.find(c=>bgCounter?c.effect==='karama':c.effect!=='karama')!;
      game=applyAction(game,provider,{type:'decision',card:card.id});
    } else game=step(game);
  }
  assert.equal(game.status,'playing');
  for(let pos=0;pos<2;pos++) {
    const index=game.spiceDeck.findIndex((c,i)=>i>=pos&&'territory'in c);
    assert.ok(index>=pos);game.spiceDeck.splice(pos,0,game.spiceDeck.splice(index,1)[0]);
  }
  for(let i=0;!(game.turn===2&&game.phase===0&&!game.phaseOpening&&!game.response&&!game.decision)&&i<1500;i++) game=step(game);
  assert.equal(game.turn,2);
  for(let i=0;game.phase!==1&&i<200;i++) game=step(game);
  const worm=game.spiceDeck.findIndex(c=>'worm'in c&&!c.greatMaker&&!c.suppressed);
  assert.ok(worm>=0);game.spiceDeck.splice(0,0,game.spiceDeck.splice(worm,1)[0]);
  for(let i=0;!(game.nexus&&!game.spiceWindow&&!game.spiceResolution&&!game.phaseOpening&&!game.response&&!game.decision)&&i<200;i++) game=step(game);
  assert.equal(game.nexus,true);
  game=applyAction(game,partners[0].id,{type:'alliance',target:partners[1].id});
  game=applyAction(game,partners[1].id,{type:'alliance',target:partners[0].id});
  for(let i=0;game.nexusCards?.phase?.stage!=='drawing'&&i<200;i++) game=step(game);
  assert.equal(game.nexusCards!.phase!.stage,'drawing');
  game=applyAction(game,holder,{type:'nexusCardChoice',turn:game.turn,card:null,choice:'draw',ownRedraws:0});
  if(second) game=applyAction(game,second,{type:'nexusCardChoice',turn:game.turn,card:null,choice:'draw',ownRedraws:0});
  while(game.nexusCards!.phase!.stage==='drawing') game=step(game);
  assert.equal(game.nexusCards!.phase!.stage,'complete');
  assert.equal(game.nexusCards!.cards!.hands[holder],face);
  let beforeNativeAttempt:Game|undefined, declarationAction:Action|undefined, actor:string|undefined;
  for(let i=0;i<400;i++) {
    if(kind==='technology'&&game.decision?.kind==='ixTechnology') {
      beforeNativeAttempt=structuredClone(game);actor=provider;
      declarationAction={type:'decision',card:game.players.find(p=>p.id===provider)!.hand[0].id};
      game=applyAction(game,actor,declarationAction);break;
    }
    const next=nativeStep(game),before=structuredClone(game);
    game=applyAction(game,next.actor,next.action);
    if(kind==='bidding'&&game.response?.kind==='ixAuction') {beforeNativeAttempt=before;actor=next.actor;declarationAction=next.action;break;}
  }
  assert.ok(beforeNativeAttempt&&declarationAction&&actor);
  assert.equal(game.response?.kind,kind==='bidding'?'ixAuction':'ixTechnology');
  const beforeNativeCounter=structuredClone(game),nativeCount=game.ixAuction?.count??game.auction!.cards.length;
  const selected=kind==='technology'?structuredClone(game.players.find(p=>p.id===provider)!.hand.find(c=>c.id===game.pendingIxTechnology!.card)!):null;
  game=settleIxianBetrayalNativeCounters(game);
  const frame=game.pendingNexusIxianBetrayal;assert.ok(frame);
  return {beforeNativeAttempt,actor,declarationAction,beforeNativeCounter,game,event:frame.source.event,provider,holder,required:[...frame.required],kind,selected,nativeCount};
}
