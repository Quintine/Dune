import assert from 'node:assert/strict';
import {applyAction,createGame,initializeHarkonnenNexusBetrayalGameForAudit,joinGame,newPlayer,viewGame,type Action,type Game} from '../game/engine';
import {botActions} from '../game/bots';
import {TERRITORIES} from '../game/board';

export type HarkonnenBetrayalFixtureOptions = {initial?:Game;advanced?:boolean;remote?:boolean;face?:'harkonnen'|'richese';secondFace?:'harkonnen'|'richese'|'guild';receiverCount?:1|2;seatIds?:string[]};
export type HarkonnenBetrayalFixture = {beforeCall:Game;beforeNativeCounter:Game;game:Game;event:string;provider:string;holder:string;required:string[];beneficiary:string;target:string;identity:string;callAction:Action;advanced:boolean;remote:boolean};
export type HarkonnenBetrayalNativeStep = {actor:string;action:Action};

export function settleHarkonnenBetrayalNativeCounters(state:Game):Game {
  let game=state;
  for(let i=0;i<100;i++) {
    if(game.pendingNexusHarkonnenBetrayal||!game.response) return game;
    const seat=game.players.find(p=>!game.response!.passed.includes(p.id));
    assert.ok(seat);
    game=applyAction(game,seat.id,{type:'passResponse'});
  }
  throw new Error('Original Harkonnen native counters did not settle.');
}
export function nextHarkonnenBetrayalNativeStep(game:Game):HarkonnenBetrayalNativeStep {
  const frame=game.pendingNexusHarkonnenBetrayal;
  if(frame) return {actor:frame.required.find(id=>!frame.passed.includes(id))!,action:{type:'nexusHarkonnenBetrayalPass',event:frame.source.event}};
  if(game.nexusCards?.phase?.stage==='drawing') {
    const phase=game.nexusCards.phase,actor=phase.eligible.find(id=>!phase.done.includes(id))!;
    return {actor,action:{type:'nexusCardChoice',turn:phase.turn,card:game.nexusCards.cards!.hands[actor],choice:'keep',ownRedraws:0}};
  }
  if(game.pendingTreacheryDiscard) return {actor:game.players[0].id,action:{type:'advanceBots'}};
  if(game.response) return {actor:game.players.find(p=>!game.response!.passed.includes(p.id))!.id,action:{type:'passResponse'}};
  if(game.phaseOpening) return {actor:game.players.find(p=>!game.phaseOpening!.passed.includes(p.id))!.id,action:{type:'ready'}};
  if(game.battle?.preparation && ['voice','prescience'].includes(game.battle.preparation.kind))
    return {actor:game.battle.preparation.owner,action:{type:'declineBattlePower'}};
  if(game.decision?.kind==='fullPlanOffer')
    return {actor:game.decision.player,action:{type:'decision',decline:true}};
  if(game.status==='playing'&&!game.decision) {
    if(game.phase===0&&game.stormPending===null) return {actor:game.stormDialers.find(id=>game.stormDials[id]===undefined)!,action:{type:'stormDial',amount:game.turn===1?0:1}};
    if(game.phase===3&&game.auction) return {actor:game.auction.active,action:{type:'passBid'}};
    if(game.phase===5) return {actor:game.active!,action:{type:'endMovement'}};
    if(game.battle?.revealed) {
      const voter=viewGame(game,game.players[0].id).battle!.traitorVoters.find(id=>game.battle!.traitorCalls[id]===undefined);
      if(voter) return {actor:voter,action:{type:'traitorCall',call:false}};
    }
    if(game.phase!==6||!game.active) {
      const seat=game.players.find(p=>!game.ready.includes(p.id));
      if(seat) return {actor:seat.id,action:{type:'ready'}};
    }
  }
  for(const p of game.players) {
    if(game.decision&&game.decision.player!==p.id) continue;
    const view=viewGame(game,p.id);
    view.players.find(s=>s.id===p.id)!.bot='Easy';
    const actions=botActions(view),action=actions.find(a=>a.type==='ready')??actions[0];
    if(action) return {actor:p.id,action};
  }
  throw new Error(`No native Harkonnen fixture step at ${game.status}/${game.turn}/${game.phase}/${game.decision?.kind}`);
}
function step(game:Game):Game {const next=nextHarkonnenBetrayalNativeStep(game);return applyAction(game,next.actor,next.action);}
export function advanceHarkonnenBetrayalToMentat(state:Game):Game {
  let game=state;
  const turn=game.turn;
  assert.ok(!game.pendingNexusHarkonnenBetrayal,'Settle the public acknowledgement before advancing.');
  for(let i=0;game.phase!==8&&game.turn===turn&&game.status==='playing'&&i<500;i++) game=step(game);
  assert.equal(game.turn,turn);assert.equal(game.phase,8);
  assert.equal(game.pendingNexusHarkonnenReplacement,null);
  return game;
}
/** Only original fresh setup randomness is deterministic. No replacement draw or
 * shuffle is mocked, and an already-started setup is never reinitialized. */
function setup(game:Game):Game {
  const original=Object.getOwnPropertyDescriptor(crypto,'getRandomValues');
  let seed=142;
  crypto.getRandomValues=<T extends ArrayBufferView | null>(array:T):T=>{
    assert.ok(array);
    const bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);
    for(let i=0;i<bytes.length;i++) {seed=(Math.imul(seed,1664525)+1013904223)>>>0;bytes[i]=seed>>>24;}
    return array;
  };
  try {
    if(game.status==='lobby') {
      for(const p of game.players) if(!p.ready) game=applyAction(game,p.id,{type:'ready'});
      game.nexusCards??={cards:null,phase:null};
      game=initializeHarkonnenNexusBetrayalGameForAudit(game);
      // Conserved starting-deal ordering ensures a real printed counter; BG
      // instead receives an actual Worthless Card for native Advanced conversion.
      const bg=game.advanced&&game.players.find(p=>p.faction==='beneGesserit');
      const originals=[...game.deck],first=originals.find(c=>bg?c.kind==='worthless':c.effect==='karama')!;
      assert.ok(first);
      const counterSeat=bg?bg.id:game.players.find(p=>p.faction!=='harkonnen')!.id;
      const seen=new Set<string>();
      const deal=game.players.flatMap(p=>Array.from({length:p.faction==='harkonnen'?2:1},(_,i)=>{
        const card=p.id===counterSeat&&i===0?first:
          originals.find(c=>c.id!==first.id&&!seen.has(c.id)&&c.kind==='worthless')??
          originals.find(c=>c.id!==first.id&&!seen.has(c.id))!;
        seen.add(card.id);return card;
      }));
      game.deck=[...deal,...originals.filter(c=>!seen.has(c.id))];
    }
    for(let i=0;game.status==='setup'&&i<150;i++) game=step(game);
    assert.equal(game.status,'playing');
    return game;
  } finally {
    if(original) Object.defineProperty(crypto,'getRandomValues',original);
    else Reflect.deleteProperty(crypto,'getRandomValues');
  }
}
/** Genuine setup, ordinary first turn, real second-turn Nexus/alliance and closing
 * draw. Only a conserved two-force battle is staged during native Movement;
 * its selection, sealed plans, call, counters and all continuation are native. */
export function createHarkonnenNexusBetrayalFixture(options:HarkonnenBetrayalFixtureOptions={}):HarkonnenBetrayalFixture {
  const remote=options.remote??false,face=options.face??'harkonnen';
  let game:Game;
  if(options.initial) {
    game=structuredClone(options.initial);
    assert.ok(game.status==='lobby'||(game.status==='setup'&&game.nexusHarkonnenBetrayalPreview&&game.turn===1&&game.phase===0&&game.players.every(p=>p.hand.length===0)),'Only a fresh lobby or admitted undealt setup can continue.');
    if(options.advanced!==undefined) assert.equal(game.advanced,options.advanced);
  } else {
    const ids=options.seatIds??(options.receiverCount===2?['p0','p1','p2','p3']:['p0','p1','p2']);
    game=createGame('HARKONNENBETRAYAL',newPlayer(ids[0],'Atreides','atreides'),options.advanced??false);
    joinGame(game,newPlayer(ids[1],'Harkonnen','harkonnen'));
    joinGame(game,newPlayer(ids[2],'Guild','guild'));
    if(ids.length>3) joinGame(game,newPlayer(ids[3],'Emperor','emperor'));
  }
  game=setup(game);
  const provider=game.players.find(p=>p.faction==='harkonnen')!.id,owner=game.players.find(p=>p.id===provider)!;
  const targetPlayer=game.players.find(p=>p.id!==provider&&p.leaders.some(l=>owner.traitors.includes(l.id)));
  assert.ok(targetPlayer,'The preserved real setup has no opposing native leader in the Harkonnen hand.');
  const target=targetPlayer.id,holder=target;
  const identity=targetPlayer.leaders.find(l=>owner.traitors.includes(l.id))!.id;
  const second=options.receiverCount===2?game.players.find(p=>p.id!==provider&&p.id!==holder)!.id:null;
  const partners=game.players.filter(p=>p.id!==holder&&p.id!==second);
  assert.ok(partners.length>=2,'A real settled alliance needs two nonreceiver seats.');
  const partner=partners.find(p=>p.id!==provider)!;
  const beneficiary=remote?partner.id:provider;
  const nx=game.nexusCards!.cards!,faces:typeof nx.deck=[face,...(second?[options.secondFace??(face==='harkonnen'?'richese':'harkonnen')]:[])];
  assert.equal(new Set(faces).size,faces.length,'Each actual Nexus face remains a physical singleton.');
  nx.deck=[...faces,...nx.deck.filter(c=>!faces.includes(c))];
  for(let pos=0;pos<2;pos++) {const index=game.spiceDeck.findIndex((c,i)=>i>=pos&&'territory'in c);assert.ok(index>=pos);game.spiceDeck.splice(pos,0,game.spiceDeck.splice(index,1)[0]);}
  for(let i=0;!(game.turn===2&&game.phase===0&&!game.response&&!game.decision)&&i<1500;i++) game=step(game);
  assert.equal(game.turn,2);
  while(game.phase!==1) game=step(game);
  const worm=game.spiceDeck.findIndex(c=>'worm'in c&&!c.greatMaker&&!c.suppressed);assert.ok(worm>=0);
  game.spiceDeck.unshift(game.spiceDeck.splice(worm,1)[0]);
  for(let i=0;!(game.nexus&&!game.spiceWindow&&!game.spiceResolution&&!game.response&&!game.decision)&&i<200;i++) game=step(game);
  assert.equal(game.nexus,true);
  game=applyAction(game,provider,{type:'alliance',target:partner.id});
  game=applyAction(game,partner.id,{type:'alliance',target:provider});
  for(let i=0;game.nexusCards?.phase?.stage!=='drawing'&&i<200;i++) game=step(game);
  assert.equal(game.nexusCards!.phase!.stage,'drawing');
  game=applyAction(game,holder,{type:'nexusCardChoice',turn:game.turn,card:null,choice:'draw',ownRedraws:0});
  if(second) game=applyAction(game,second,{type:'nexusCardChoice',turn:game.turn,card:null,choice:'draw',ownRedraws:0});
  while(game.nexusCards!.phase!.stage==='drawing') game=step(game);
  assert.equal(game.nexusCards!.cards!.hands[holder],face);
  for(let i=0;game.phase!==5&&i<300;i++) game=step(game);
  assert.equal(game.phase,5);
  const territory=TERRITORIES.find(t=>t.type==='sand'&&!t.sectors.includes(game.storm)&&game.players.every(p=>!Object.keys(p.forces).some(key=>key.startsWith(`${t.id}:`))))!;
  assert.ok(territory);
  for(const id of [beneficiary,target]) {const p=game.players.find(s=>s.id===id)!;assert.ok(p.reserves>0);p.reserves--;p.forces[`${territory.id}:${territory.sectors[0]}`]=1;}
  while(game.phase===5) game=step(game);
  assert.equal(game.phase,6);
  const chooser=game.active!;assert.ok([beneficiary,target].includes(chooser));
  game=applyAction(game,chooser,{type:'chooseBattle',territory:territory.id,target:chooser===target?beneficiary:target});
  for(let i=0;(game.response||game.decision||game.battle?.preparation||(game.battle?.preLeader&&!game.battle.preLeader.closed))&&i<100;i++) game=step(game);
  for(const id of [game.battle!.attacker,game.battle!.defender]) {
    const p=game.players.find(s=>s.id===id)!;
    game=applyAction(game,id,{type:'battlePlan',dial:0,leader:id===target?identity:p.leaders.find(l=>!l.dead&&!l.usedAt)!.id});
  }
  assert.equal(game.battle!.revealed,true);
  for(let i=0;(game.response||game.decision)&&i<50;i++) game=step(game);
  const beforeCall=structuredClone(game),callAction:Action={type:'traitorCall',call:true};
  game=applyAction(game,provider,callAction);
  const beforeNativeCounter=structuredClone(game);
  game=settleHarkonnenBetrayalNativeCounters(game);
  const frame=game.pendingNexusHarkonnenBetrayal;assert.ok(frame);
  return {beforeCall,beforeNativeCounter,game,event:frame.source.event,provider,holder,required:[...frame.required],beneficiary,target,identity,callAction,advanced:game.advanced,remote};
}
