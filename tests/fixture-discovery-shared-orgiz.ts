import assert from 'node:assert/strict';
import {applyAction,type Action,type Game} from '../game/engine';
import {splitLocation,territory} from '../game/board';
import {ORGIZ_PROCESSING_STATION} from '../game/discovery-collection';
import {quoteSpiceCollection} from '../game/board-resolution-quote';
import {
  createDiscoveryOccupantsFixture,advanceTestingStationContest,nextTestingStationContestStep,
  type TestingStationContestStep,
} from './fixture-testing-station-contest';

const clean=(game:Game)=>!game.decision&&!game.response&&!game.phaseOpening;

/** Original setup/forces/cards/alliances. Only unplayed card order, the actual
 * token lottery and face1 at its real turn-two forecast shuffle are selected. */
function prepareOrgizCollectors(advanced:boolean,terrainType:'sand'|'rock',exhaustFirst=false) {
  const prefix=createDiscoveryOccupantsFixture({location:ORGIZ_PROCESSING_STATION,
    advanced,secondAmount:2,ordinaryBlowTerrain:'sand',forecastOne:true});
  const actions:TestingStationContestStep[]=[...prefix.actions];
  let game=advanceTestingStationContest(prefix.game,g=>g.turn===2&&g.phase===5&&g.active==='ecaz'&&clean(g),actions);
  const leave:Action={type:'move',from:`${ORGIZ_PROCESSING_STATION}:0`,
    territory:prefix.parent,sector:prefix.parentSector,amount:2,elite:0};
  actions.push({actor:'ecaz',action:leave});
  game=applyAction(game,'ecaz',leave);
  game=advanceTestingStationContest(game,g=>g.turn===3&&g.phase===0&&
    g.stormPending!==null&&clean(g),actions);
  const incomingStorm=(game.storm+game.stormPending!)%18;
  const blowKeys:string[]=[];
  for(let position=0;position<2;position++) {
    const wanted=position===0?terrainType:'sand';
    const index=game.spiceDeck.findIndex((card,i)=>i>=position&&'territory' in card&&
      !card.discovery&&territory(card.territory).type===wanted&&
      card.territory!==prefix.parent&&card.sector!==incomingStorm);
    assert.ok(index>=position,'Original unused blows must supply the native Collection route.');
    const card=game.spiceDeck.splice(index,1)[0];
    game.spiceDeck.splice(position,0,card);
    if('territory' in card)blowKeys.push(`${card.territory}:${card.sector}`);
  }
  game=advanceTestingStationContest(game,g=>g.turn===3&&g.phase===5&&clean(g),actions);
  assert.equal(game.storm,incomingStorm);
  const key=blowKeys[0];
  const amount=game.spice[key];
  assert.ok(amount>=4&&game.players.every(p=>(p.forces[key]??0)===0));
  const destination=splitLocation(key);
  const first=game.order.find(id=>id==='ecaz'||id==='guild')!;
  const shipped=new Set<string>();
  for(let step=0;step<500&&game.turn===3;step++) {
    if(game.phase===5&&clean(game)&&game.movementRemaining?.length===1&&shipped.size===2)break;
    let next:TestingStationContestStep|null;
    if(game.phase===5&&clean(game)&&game.active&&
      ['ecaz','guild'].includes(game.active)&&!shipped.has(game.active)) {
      const actor=game.active;
      next={actor,action:{type:'ship',territory:destination.territory,sector:destination.sector,
        amount:exhaustFirst&&actor===first?Math.ceil(amount/2):1,elite:0,allyPayment:0}};
      shipped.add(actor);
    } else next=nextTestingStationContestStep(game);
    assert.ok(next,'Original collector route must retain a legal continuation.');
    actions.push(next);
    game=applyAction(game,next.actor,next.action);
  }
  assert.equal(game.phase,5);
  assert.equal(game.movementRemaining?.length,1);
  assert.equal(shipped.size,2);
  assert.equal(game.players.find(p=>p.id==='ecaz')!.forces[`${ORGIZ_PROCESSING_STATION}:0`],undefined);
  assert.equal(game.players.find(p=>p.id==='guild')!.forces[`${ORGIZ_PROCESSING_STATION}:0`],2);
  const ordinary=quoteSpiceCollection(game);
  const finalAction:TestingStationContestStep={actor:game.active!,action:{type:'endMovement'}};
  return {...prefix,game,actions,ordinary,finalAction,key,amount,first,
    ecaz:'ecaz',guild:'guild',owner:'guild'};
}

/** Desert collectors enter the original shared allocation before any credit. */
export function prepareSharedOrgizCollection(advanced=true) {
  const position=prepareOrgizCollectors(advanced,'sand');
  const game=applyAction(position.game,position.finalAction.actor,position.finalAction.action);
  assert.equal(game.decision?.kind,'ecazSpice');
  const pending=game.ecazCollection!.allocation!;
  const lot=pending.lots[pending.index];
  assert.equal(lot.territory,splitLocation(position.key).territory);
  assert.equal(lot.amount,4);
  return {...position,game,lot,actions:[...position.actions,position.finalAction]};
}

/** Rock retains ordinary Collection: two allies may be present, but only
 * actual positive source receipts can fund an Orgiz transfer. */
export function prepareOrdinaryPairedOrgizCollection(advanced=false,exhaustFirst=false) {
  const position=prepareOrgizCollectors(advanced,'rock',exhaustFirst);
  assert.deepEqual(position.ordinary.shared,[]);
  return position;
}

export function settleSharedOrgiz(
  position:ReturnType<typeof prepareSharedOrgizCollection>,
  choice:{kind:'propose';ecazShare:number}|{kind:'equal'}={kind:'equal'},
) {
  let game=position.game;
  const event=game.ecazCollection!.event;
  const steps:TestingStationContestStep[]=[];
  while(game.decision?.kind==='ecazSpice'&&steps.length<20) {
    const actor=game.decision.player;
    const allocation=actor===position.ecaz?choice:{kind:'accept' as const};
    const action:Action={type:'decision',event,allocation};
    steps.push({actor,action});
    game=applyAction(game,actor,action);
  }
  assert.equal(game.decision,null);
  return {game,steps,event,receipt:game.ecazCollection!.settled.at(-1)!};
}
