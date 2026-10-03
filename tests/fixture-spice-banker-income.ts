import assert from 'node:assert/strict';
import {applyAction,createGame,handLimit,initializeSpiceBankerIncomeGameForAudit,joinGame,newPlayer,viewGame,type Action,type Game} from '../game/engine';
import {botActions} from '../game/bots';
import {TERRITORIES} from '../game/board';
import {LEADER_SKILL_CARDS} from '../game/leader-skill-cards';
import type {FactionId} from '../game/catalog';
import {quoteNormalAuctionNext} from '../game/normal-auction';
import type {BankerIncomeSourceKind} from '../game/spice-banker-income';
import {forceRevivalQuote} from '../game/revival';
import {quoteBattleResolution,type ResolutionCombatant} from '../game/battle-resolution-quote';
import {quoteSpiceCollection} from '../game/board-resolution-quote';
import {leaderSkillStrongholdCount} from '../game/leader-skill-battle-board';
import type {Card} from '../game/cards';

export type SpiceBankerIncomeFixtureOptions = {initial?:Game;advanced?:boolean;kind?:BankerIncomeSourceKind|'cross-shipment'|'return-shipment';ownerIsPayer?:boolean;payerFaction?:FactionId;bankerFaction?:FactionId;stageKarama?:boolean;stageIncomeCounter?:boolean;amount?:number;allySplit?:number;emperor?:boolean;guild?:boolean;seatIds?:string[];trainerSelected?:boolean;trainerDies?:boolean;trainerHidden?:boolean};
export type SpiceBankerIncomeNativeStep = {actor:string;action:Action};
export type SpiceBankerIncomeFixture = {game:Game;beforePayment:Game;actor:string;payer:string;paymentAction:Action;owner:string;leader:string;event:string;kind:NonNullable<SpiceBankerIncomeFixtureOptions['kind']>;amount:number;bankLegs:{payer:string;amount:number}[]};

export function nextSpiceBankerIncomeNativeStep(game:Game):SpiceBankerIncomeNativeStep|null {
  if(game.status==='finished') return null;
  if(game.pendingTreacheryDiscard) return {actor:game.host,action:{type:'advanceBots'}};
  if(game.phaseOpening) return {actor:game.players.find(p=>!game.phaseOpening!.passed.includes(p.id))!.id,action:{type:'ready'}};
  if(game.response) return {actor:game.players.find(p=>!game.response!.passed.includes(p.id))!.id,action:{type:'passResponse'}};
  if(game.decision?.kind==='bureaucratPayment') return {actor:game.decision.player,action:{type:'decision',event:game.decision.event,redirect:false}};
  if(game.decision?.kind==='auctionPayment') return {actor:game.decision.player,action:{type:'decision',karama:false}};
  if(game.decision?.kind==='guildShipment') return {actor:game.decision.player,action:{type:'decision',allow:true}};
  if(game.decision?.kind==='captureOffer') return {actor:game.decision.player,action:{type:'decision',accept:false}};
  if(game.decision?.kind==='leaderSkillVisibility') return {actor:game.decision.player,action:{type:'leaderSkillVisibility',event:game.decision.event,hide:false}};
  if(game.decision?.kind==='mentatQuestion') return {actor:game.decision.player,action:{type:'decision',event:game.decision.event,decline:true}};
  if(game.battle?.preparation) return {actor:game.battle.preparation.owner,action:{type:'declineBattlePower'}};
  if(game.decision?.kind==='fullPlanOffer') return {actor:game.decision.player,action:{type:'decision',decline:true}};
  if(game.status==='playing'&&!game.decision) {
    if(game.phase===0&&game.stormPending===null) return {actor:game.stormDialers.find(id=>game.stormDials[id]===undefined)!,action:{type:'stormDial',amount:game.turn===1?0:1}};
    if(game.phase===3&&game.auction) return {actor:game.auction.active,action:{type:'passBid'}};
    if(game.phase===5) return {actor:game.active!,action:{type:'endMovement'}};
    if(game.battle?.revealed) {
      const voter=viewGame(game,game.host).battle!.traitorVoters.find(id=>game.battle!.traitorCalls[id]===undefined);
      if(voter) return {actor:voter,action:{type:'traitorCall',call:false}};
    }
    if(game.phase!==6||!game.active) {
      const seat=game.players.find(p=>!game.ready.includes(p.id));
      if(seat) return {actor:seat.id,action:{type:'ready'}};
    }
  }
  for(const p of game.players) {
    if(game.decision&&game.decision.player!==p.id) continue;
    const view=viewGame(game,p.id); view.players.find(s=>s.id===p.id)!.bot='Easy';
    const action=botActions(view)[0];
    if(action) return {actor:p.id,action};
  }
  throw new Error(`No native Banker fixture step at ${game.status}/${game.turn}/${game.phase}/${game.decision?.kind}`);
}
function step(game:Game):Game {
  const next=nextSpiceBankerIncomeNativeStep(game);assert.ok(next);
  return applyAction(game,next.actor,next.action);
}
export function advanceSpiceBankerIncomeToMentat(state:Game):Game {
  let game=state;const turn=game.turn;
  for(let i=0;(game.phase!==8||game.phaseOpening)&&game.turn===turn&&game.status==='playing'&&i<1000;i++) game=step(game);
  assert.equal(game.turn,turn);assert.equal(game.phase,8);
  return game;
}

/** Scope deterministic entropy to the first real initializer, including CLI admission. */
export function withSpiceBankerIncomeSetupRandomness<T>(initialize:()=>T):T {
  const descriptor=Object.getOwnPropertyDescriptor(crypto,'getRandomValues');
  const index=LEADER_SKILL_CARDS.findIndex(c=>c.id==='spice-banker');let shuffleIndex=LEADER_SKILL_CARDS.length-1;
  crypto.getRandomValues=<V extends ArrayBufferView|null>(array:V):V=>{
    assert.ok(array);const values=new Uint32Array(array.buffer,array.byteOffset,array.byteLength/4);
    for(let i=0;i<values.length;i++) values[i]=shuffleIndex--===index?0:0xffffffff;
    return array;
  };
  try {return initialize();}
  finally {if(descriptor) Object.defineProperty(crypto,'getRandomValues',descriptor);else Reflect.deleteProperty(crypto,'getRandomValues');}
}

/** Only the first fresh native shuffle is deterministic. An admitted setup's
 * existing deck, starting hands and offers are never redealt or reordered. */
function setup(initial:Game):Game {
  let game=structuredClone(initial);
  if(game.status==='lobby') {
    for(const p of game.players) if(!p.ready) game=applyAction(game,p.id,{type:'ready'});
    game=withSpiceBankerIncomeSetupRandomness(()=>initializeSpiceBankerIncomeGameForAudit(game));
  } else assert.ok(game.status==='setup'&&game.spiceBankerIncomePreview&&game.turn===1&&game.phase===0,'Only the original fresh admitted setup can continue.');
  for(let i=0;game.status==='setup'&&i<200;i++) {
    if(game.setupStage==='leaderSkills') {
      const owner=Object.keys(game.leaderSkills!.offers)[0];
      const offer=game.leaderSkills!.offers[owner];
      const view=viewGame(game,owner).leaderSkills!;
      const skill=offer.cards.includes('spice-banker')?'spice-banker':offer.cards.find(c=>!view.unavailableSkills?.[c]);
      assert.ok(skill);assert.ok(view.eligibleLeaders.length);
      game=applyAction(game,owner,{type:'leaderSkill',event:offer.event,skill,leader:view.eligibleLeaders[0].id});
    } else game=step(game);
  }
  assert.equal(game.status,'playing');
  assert.ok(game.leaderSkills!.assignments.some(a=>a.skill==='spice-banker'),'The original native setup has no real Spice Banker offer; fixture prerequisite missing.');
  return game;
}
function phase(game:Game,target:number):Game {
  for(let i=0;(game.phase!==target||game.phaseOpening||game.response||game.decision)&&i<1000;i++) game=step(game);
  assert.equal(game.phase,target);return game;
}

/** Reuse real custody first; any explicit staging transfers the canonical card
 * out of the remaining deck, without duplicating or redealing starting hands. */
function stageHeldCard(game:Game,player:Game['players'][number],matches:(card:Card)=>boolean):Card {
  const held=player.hand.find(matches);
  if(held) return held;
  const index=game.deck.findIndex(matches);assert.ok(index>=0,'No matching real card remains available for conserved staging.');
  const card=game.deck.splice(index,1)[0];player.hand.push(card);return card;
}

/** Independent native quotes for these classic support battles. Collection is
 * quoted on the resolved physical board, with its pre-collection spice restored,
 * so ordinary stronghold/desert income is not mistaken for a smaller debit. */
export function quoteSpiceBankerIncomeBattleEconomics(before:Game,paid:Game) {
  const battle=before.battle;assert.ok(battle?.revealed);
  const combatant=(id:string,opponentId:string):ResolutionCombatant=>{
    const player=before.players.find(p=>p.id===id)!;
    const opponent=before.players.find(p=>p.id===opponentId)!;
    const groups=Object.entries(player.forces).filter(([key])=>key.startsWith(`${battle.territory}:`));
    const elite=groups.reduce((sum,[key])=>sum+(player.elites?.forces[key]??0),0);
    return {
      id,faction:player.faction,ally:player.ally,spice:player.spice,hand:player.hand,
      plan:battle.plans[id],leader:player.leaders.find(l=>l.id===battle.plans[id].leader),
      leaderSkills:before.leaderSkills!.assignments.filter(a=>{
        const trainer=before.players.find(p=>p.id===a.owner)!.leaders.find(l=>l.id===a.leader)!;
        return (trainer.capturedBy??a.owner)===id;
      }).map(a=>({skill:a.skill,leader:a.leader,faceUp:a.owner===id&&!battle.leaderSkillHidden?.[id],captured:a.owner!==id})),
      occupiedStrongholds:leaderSkillStrongholdCount(before,player),
      forces:{normal:groups.reduce((sum,[,amount])=>sum+amount,0)-elite,elite,normalFixedHalf:false,
        eliteStrength:!before.advanced||battle.eliteBlocked?.includes(id)||(player.faction==='emperor'&&opponent.faction==='fremen')?1:2,
        freeSupport:!before.advanced||(player.faction==='fremen'&&!battle.fremenSupportBlocked)},
    };
  };
  const resolution=quoteBattleResolution({
    advanced:before.advanced,turn:before.turn,territory:battle.territory,
    attacker:combatant(battle.attacker,battle.defender),defender:combatant(battle.defender,battle.attacker),
    voters:viewGame(before,before.host).battle!.traitorVoters.map(id=>({
      id,beneficiary:[battle.attacker,battle.defender].includes(id)?id:before.players.find(p=>p.id===id)!.ally!,
      called:battle.traitorCalls[id]??false,traitors:before.players.find(p=>p.id===id)!.traitors,
    })),
    participants:before.players,
    physicalCards:[...before.deck,...before.discard,...before.players.flatMap(p=>p.hand)],
    pendingAuditorPresent:false,pendingRetentionPresent:false,
  });
  const spice={...before.spice};
  const smuggler=paid.lastBattleContext?.smugglerCollection;
  if(smuggler?.key&&smuggler.stage==='collected') spice[smuggler.key]=smuggler.before-smuggler.amount;
  const sandmaster=paid.lastBattleContext?.sandmaster;
  if(sandmaster) spice[sandmaster.key]=sandmaster.after;
  const nativeCollection=paid.phase===7?quoteSpiceCollection({...paid,spice,players:paid.players.map(p=>({...p,spice:0}))}).receipts:[];
  return {resolution,nativeCollection};
}
/** Genuine setup and native phase transitions; only the conserved source force,
 * casualty and funding position is staged. Every debit/effect uses its native action. */
export function createSpiceBankerIncomeFixture(options:SpiceBankerIncomeFixtureOptions={}):SpiceBankerIncomeFixture {
  const kind=options.kind??'auction';let game:Game;
  if(options.initial) game=structuredClone(options.initial);
  else {
    const ids=options.seatIds??['p0','p1','p2','p3'];
    const bankerFaction=options.bankerFaction??'atreides';
    const payerFaction=options.payerFaction??(bankerFaction==='harkonnen'?'atreides':'harkonnen');
    game=createGame('BANKERINCOME',newPlayer(ids[0],'Banker',bankerFaction),options.advanced??false);
    if(payerFaction!==bankerFaction) joinGame(game,newPlayer(ids[1],'Payer',payerFaction));
    if((options.emperor||kind==='emperor-extra-revival')&&!game.players.some(p=>p.faction==='emperor')) joinGame(game,newPlayer(ids[game.players.length],'Emperor','emperor'));
    if((options.guild||kind==='cross-shipment'||kind==='return-shipment')&&!game.players.some(p=>p.faction==='guild')) joinGame(game,newPlayer(ids[game.players.length],'Guild','guild'));
    if(options.allySplit&&!game.players.some(p=>p.faction==='emperor'||p.faction==='guild')) joinGame(game,newPlayer(ids[game.players.length],'Donor','beneGesserit'));
    if(game.players.length===1) {
      const opponentFaction=bankerFaction==='harkonnen'?'atreides':'harkonnen';
      joinGame(game,newPlayer(ids[1],'Opponent',opponentFaction));
    }
  }
  game=setup(game);
  const assignment=game.leaderSkills!.assignments.find(a=>a.skill==='spice-banker')!;
  const owner=assignment.owner,leader=assignment.leader;
  let actor=options.payerFaction?game.players.find(p=>p.faction===options.payerFaction)!.id:
    options.ownerIsPayer?owner:game.players.find(p=>p.id!==owner&&p.faction==='harkonnen')?.id??game.players.find(p=>p.id!==owner)!.id;
  if(kind==='kh-revival') actor=game.players.find(p=>p.faction==='atreides')!.id;
  let paymentActor:string|undefined;
  let paymentAction:Action|undefined;let amount=options.amount??4;
  const split=options.allySplit??0;
  if(kind==='auction') {
    game=phase(game,3);
    assert.ok(game.auction);
    const payer=game.players.find(p=>p.id===actor)!;
    if(options.stageKarama) stageHeldCard(game,payer,c=>c.effect==='karama');
    if(options.stageIncomeCounter) stageHeldCard(game,game.players.find(p=>p.id===owner)!,c=>c.effect==='karama');
    for(let i=0;game.auction!.active!==actor&&i<10;i++) game=applyAction(game,game.auction!.active,{type:'passBid'});
    if(split) {
      const donor=game.players.find(p=>p.id!==actor&&p.id!==owner)!;const payer=game.players.find(p=>p.id===actor)!;
      payer.ally=donor.id;donor.ally=actor;game=applyAction(game,donor.id,{type:'pledgeAid',amount:split});
    }
    game=applyAction(game,actor,{type:'bid',amount,allyPayment:split});
    for(let i=0;i<10;i++) {
      const auction=game.auction!;
      const next=quoteNormalAuctionNext({...auction,order:game.order,
        eligible:game.players.filter(p=>p.hand.length<handLimit(p)).map(p=>p.id),
        passed:[...auction.passed,auction.active]});
      if(next.kind==='payment') {
        if(options.stageKarama) {
          game=applyAction(game,auction.active,{type:'passBid'});
          assert.equal(game.decision?.kind,'auctionPayment');
          paymentAction={type:'decision',karama:false};
        } else {
          paymentActor=auction.active;paymentAction={type:'passBid'};
        }
        break;
      }
      game=applyAction(game,auction.active,{type:'passBid'});
    }
    assert.ok(paymentAction,'The original winning lot must reach its native payment step.');
  } else if(kind==='force-revival'||kind==='leader-revival'||kind==='kh-revival'||kind==='emperor-extra-revival') {
    if(kind==='leader-revival'||kind==='kh-revival') {
      if(kind==='kh-revival') {
        assert.ok(game.advanced);assert.equal(game.players.find(p=>p.id===actor)!.faction,'atreides');
        // Seven actual native force casualties unlock KH before its later battle.
        game=stageSpiceBankerIncomeTrainerBattle(game,{trainerOwner:actor,forceCasualties:7});
      }
      game=stageSpiceBankerIncomeTrainerBattle(game,{trainerOwner:actor,death:true,kwisatz:kind==='kh-revival'});
      game=advanceSpiceBankerIncomeToMentat(game);
    }
    game=phase(game,4);const payer=game.players.find(p=>p.id===actor)!;
    if(kind==='force-revival') {
      payer.reserves-=3;payer.tanks+=3;paymentAction={type:'revive',amount:3};amount=forceRevivalQuote(game,payer,3).cost;
    } else if(kind==='leader-revival') {
      const target=payer.leaders.find(l=>l.strength===(options.amount??4))!;assert.ok(target,'No native leader at requested price.');
      assert.ok(payer.leaders.every(l=>l.dead));
      paymentAction={type:'reviveLeader',leader:target.id};amount=target.strength;
    } else if(kind==='kh-revival') {
      assert.equal(payer.faction,'atreides');assert.ok(game.advanced);
      assert.ok(payer.leaders.every(l=>l.dead));assert.equal(payer.kwisatz?.dead,true);
      paymentAction={type:'reviveKwisatz'};amount=2;
    } else {
      const emperor=game.players.find(p=>p.faction==='emperor')!;const recipient=game.players.find(p=>p.id!==emperor.id&&p.id!==owner)!;
      emperor.ally=recipient.id;recipient.ally=emperor.id;recipient.reserves-=2;recipient.tanks+=2;
      actor=emperor.id;paymentAction={type:'emperorRevival',amount:2};amount=4;
    }
  } else if(kind==='shipment'||kind==='cross-shipment'||kind==='return-shipment') {
    game=phase(game,5);
    if(kind!=='shipment') actor=game.players.find(p=>p.faction==='guild')!.id;
    for(let i=0;game.active!==actor&&i<10;i++) game=applyAction(game,game.active!,{type:'endMovement'});
    let payer=game.players.find(p=>p.id===actor)!;
    if(options.stageIncomeCounter) stageHeldCard(game,game.players.find(p=>p.id===owner)!,c=>c.effect==='karama');
    const destination=TERRITORIES.find(t=>t.type==='stronghold'&&!t.sectors.includes(game.storm)&&game.players.every(p=>!Object.keys(p.forces).some(k=>k.startsWith(`${t.id}:`))))!;
    assert.ok(destination);
    if(split) {const donor=game.players.find(p=>p.id!==actor&&p.id!==owner)!;payer.ally=donor.id;donor.ally=actor;game=applyAction(game,donor.id,{type:'pledgeAid',amount:split});payer=game.players.find(p=>p.id===actor)!;}
    if(kind==='shipment') paymentAction={type:'ship',territory:destination.id,sector:destination.sectors[0],amount:payer.faction==='guild'?amount*2:amount,allyPayment:split};
    else {
      const origin=TERRITORIES.find(t=>t.type==='sand'&&!t.sectors.includes(game.storm))!;
      payer.reserves-=amount*2;payer.forces[`${origin.id}:${origin.sectors[0]}`]=(payer.forces[`${origin.id}:${origin.sectors[0]}`]??0)+amount*2;
      paymentAction={type:'guildShip',forces:{[`${origin.id}:${origin.sectors[0]}`]:amount*2},territory:kind==='return-shipment'?'reserves':destination.id,sector:destination.sectors[0],allyPayment:split};
    }
  } else {
    assert.ok(game.advanced,'Paid support requires Advanced combat.');game=phase(game,5);
    const territory=TERRITORIES.find(t=>t.type==='sand'&&!t.sectors.includes(game.storm)&&game.players.every(p=>!Object.keys(p.forces).some(k=>k.startsWith(`${t.id}:`))))!;
    for(const id of [owner,actor]) {const p=game.players.find(p=>p.id===id)!;p.reserves-=4;p.forces[`${territory.id}:${territory.sectors[0]}`]=4;}
    let weapon:string|undefined;
    if(options.trainerDies) {
      weapon=stageHeldCard(game,game.players.find(p=>p.id===actor)!,c=>c.kind==='projectile').id;
    }
    while(game.phase===5) game=step(game);
    game=applyAction(game,game.active!,{type:'chooseBattle',territory:territory.id,target:game.active===owner?actor:owner});
    for(let i=0;(game.response||game.decision||game.battle?.preparation)&&i<100;i++) {
      if(game.decision?.kind==='leaderSkillVisibility'&&game.decision.player===owner&&(options.trainerSelected||options.trainerHidden))
        game=applyAction(game,owner,{type:'leaderSkillVisibility',event:game.decision.event,hide:true});
      else game=step(game);
    }
    for(const id of [game.battle!.attacker,game.battle!.defender]) {
      const p=game.players.find(p=>p.id===id)!;
      const nativeTrainer=game.leaderSkills!.assignments.find(a=>a.owner===id)?.leader;
      game=applyAction(game,id,{type:'battlePlan',
        leader:id===owner&&options.trainerSelected?leader:p.leaders.find(l=>l.id!==nativeTrainer&&!l.dead)!.id,
        dial:id===actor?amount:0,support:id===actor?amount:0,...(id===actor&&weapon?{weapon}:{}),
      });
    }
    for(let i=0;(game.response||game.decision)&&i<100;i++) game=step(game);
    game=applyAction(game,owner,{type:'traitorCall',call:false});paymentAction={type:'traitorCall',call:false};
  }
  assert.ok(paymentAction);
  const bankLegs=[{payer:actor,amount:amount-split},...(split?[{payer:game.players.find(p=>p.id===actor)!.ally!,amount:split}]:[])];
  return {game,beforePayment:structuredClone(game),actor:paymentActor??actor,payer:actor,paymentAction,owner,leader,event:game.battle?.event??game.code,kind,amount,bankLegs};
}

/** Conserved trainer battle, resolved through native casualty, death, skill-return
 * and capture actions. The optional trainerOwner selects an existing assignment;
 * no assigned trainer or earned-currency record is directly edited. */
export function stageSpiceBankerIncomeTrainerBattle(state:Game,options:{death?:boolean;capture?:boolean;reassignToOpponent?:boolean;trainerOwner?:string;forceCasualties?:number;kwisatz?:boolean}={}):Game {
  let game=phase(structuredClone(state),5);
  const assignment=game.leaderSkills!.assignments.find(a=>options.trainerOwner?a.owner===options.trainerOwner:a.skill==='spice-banker')!;assert.ok(assignment);
  const owner=game.players.find(p=>p.id===assignment.owner)!;
  const enemy=game.players.find(p=>p.faction==='harkonnen'&&p.id!==owner.id)??game.players.find(p=>p.id!==owner.id)!;
  const enemyTrainer=game.leaderSkills!.assignments.find(a=>a.owner===enemy.id)?.leader;
  if(options.reassignToOpponent) {assert.ok(options.death);assert.ok(enemyTrainer);}
  if(options.capture) {assert.ok(game.advanced);assert.equal(enemy.faction,'harkonnen');}
  const territory=TERRITORIES.find(t=>t.type==='sand'&&!t.sectors.includes(game.storm)&&game.players.every(p=>!Object.keys(p.forces).some(k=>k.startsWith(`${t.id}:`))))!;
  for(const p of [owner,enemy]) {
    const amount=p.id===owner.id?(options.forceCasualties??2):2;
    assert.ok(p.reserves>=amount);p.reserves-=amount;p.forces[`${territory.id}:${territory.sectors[0]}`]=amount;
  }
  let weapon:string|undefined;
  if(options.death||options.capture||options.forceCasualties) {
    weapon=stageHeldCard(game,enemy,c=>options.kwisatz?c.kind==='lasgun':c.kind==='projectile').id;
  }
  let ownerWeapon:string|undefined;
  if(options.reassignToOpponent) {
    ownerWeapon=stageHeldCard(game,owner,c=>c.kind==='projectile').id;
    for(const l of enemy.leaders) if(l.id!==enemyTrainer) {l.dead=true;l.deaths=1;}
  }
  let ownerDefense:string|undefined;
  if(options.kwisatz) {
    assert.ok(game.advanced&&owner.faction==='atreides'&&owner.battleLosses>=7);
    ownerDefense=stageHeldCard(game,owner,c=>c.kind==='shield').id;
  }
  const sacrificial=owner.leaders.find(l=>l.id!==assignment.leader&&!l.dead)!;
  for(const l of owner.leaders) if(l.id!==assignment.leader&&
    (options.death||(options.capture&&l.id!==sacrificial.id))) {l.dead=true;l.deaths=1;}
  while(game.phase===5) game=step(game);
  const chooser=game.active!;assert.ok([owner.id,enemy.id].includes(chooser));
  game=applyAction(game,chooser,{type:'chooseBattle',territory:territory.id,target:chooser===owner.id?enemy.id:owner.id});
  for(let i=0;(game.response||game.decision||game.battle?.preparation)&&i<100;i++) {
    if(game.decision?.kind==='leaderSkillVisibility'&&
      (game.decision.player===owner.id||(options.reassignToOpponent&&game.decision.player===enemy.id)))
      game=applyAction(game,game.decision.player,{type:'leaderSkillVisibility',event:game.decision.event,hide:!!options.death});
    else game=step(game);
  }
  for(const id of [game.battle!.attacker,game.battle!.defender]) {
    const p=game.players.find(p=>p.id===id)!;
    game=applyAction(game,id,{type:'battlePlan',dial:0,support:0,
      leader:id===owner.id?(options.death?assignment.leader:sacrificial.id):
        options.reassignToOpponent?enemyTrainer:p.leaders.find(l=>!l.dead&&l.id!==game.leaderSkills!.assignments.find(a=>a.owner===id)?.leader)!.id,
      ...(id===enemy.id&&weapon?{weapon}:{}),...(id===owner.id&&ownerWeapon?{weapon:ownerWeapon}:{}),
      ...(id===owner.id&&ownerDefense?{defense:ownerDefense,kwisatz:true}:{}),
    });
  }
  for(let i=0;game.battle&&i<100;i++) {
    const next=nextSpiceBankerIncomeNativeStep(game);assert.ok(next);
    const finalCall=options.death&&next.action.type==='traitorCall'&&
      viewGame(game,game.host).battle!.traitorVoters.every(id=>id===next.actor||game.battle!.traitorCalls[id]!==undefined);
    if(finalCall) {
      const descriptor=Object.getOwnPropertyDescriptor(crypto,'getRandomValues');
      const returned=options.reassignToOpponent?2:1;
      const size=game.leaderSkills!.deck.length+returned;let roll=0;
      crypto.getRandomValues=<T extends ArrayBufferView|null>(array:T):T=>{
        assert.ok(array);const values=new Uint32Array(array.buffer,array.byteOffset,array.byteLength/4);
        for(let j=0;j<values.length;j++) values[j]=roll++===0?0:
          options.reassignToOpponent&&roll===2?Math.ceil(0x100000000/(size-1)):0xffffffff;
        return array;
      };
      try {game=applyAction(game,next.actor,next.action);}
      finally {if(descriptor) Object.defineProperty(crypto,'getRandomValues',descriptor);else Reflect.deleteProperty(crypto,'getRandomValues');}
    } else game=applyAction(game,next.actor,next.action);
  }
  if(options.capture) {
    for(let i=0;(game.response||game.decision)&&i<100;i++) {
      if(game.decision?.kind==='captureOffer') game=applyAction(game,enemy.id,{type:'decision',accept:true});
      else if(game.decision?.kind==='capturedLeader') {
        assert.equal(game.players.find(p=>p.id===owner.id)!.leaders.find(l=>l.id===assignment.leader)!.capturedBy,enemy.id);
        game=applyAction(game,enemy.id,{type:'decision',mode:'keep'});break;
      } else game=step(game);
    }
  }
  if(options.death) assert.equal(game.players.find(p=>p.id===owner.id)!.leaders.find(l=>l.id===assignment.leader)!.dead,true);
  if(options.forceCasualties) assert.ok(game.players.find(p=>p.id===owner.id)!.battleLosses>=options.forceCasualties);
  if(options.kwisatz) assert.equal(game.players.find(p=>p.id===owner.id)!.kwisatz?.dead,true);
  return game;
}

export type SpiceBankerIncomeReassignmentFixture = {
  beforeRevival:Game;game:Game;actor:string;leader:string;originalOwner:string;revivalAction:Action;
};
/** Real original payment -> mutual skilled deaths -> native Mentat -> next-turn
 * normal revival. The two-card offer is drawn only by its original native action. */
export function createSpiceBankerIncomeReassignmentFixture(state:Game):SpiceBankerIncomeReassignmentFixture {
  const originalOwner=state.leaderSkills!.assignments.find(a=>a.skill==='spice-banker')!.owner;
  const actor=state.players.find(p=>p.faction==='harkonnen'&&p.id!==originalOwner)!.id;
  const leader=state.leaderSkills!.assignments.find(a=>a.owner===actor)!.leader;
  let game=stageSpiceBankerIncomeTrainerBattle(state,{death:true,reassignToOpponent:true});
  game=advanceSpiceBankerIncomeToMentat(game);
  game=phase(game,4);
  const trainer=game.players.find(p=>p.id===actor)!.leaders.find(l=>l.id===leader)!;
  assert.ok(trainer.dead&&game.players.find(p=>p.id===actor)!.spice>=trainer.strength);
  assert.ok(game.leaderSkills!.deck.slice(0,2).includes('spice-banker'),'The actual singleton return shuffle must supply the native two-card offer.');
  const revivalAction:Action={type:'reviveLeader',leader};
  return {beforeRevival:structuredClone(game),game,actor,leader,originalOwner,revivalAction};
}
