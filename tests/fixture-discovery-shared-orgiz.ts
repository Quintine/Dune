import assert from 'node:assert/strict';
import {applyAction,type Action,type Game} from '../game/engine';
import {splitLocation,territory} from '../game/board';
import {ORGIZ_PROCESSING_STATION} from '../game/discovery-collection';
import {
  createDiscoveryOccupantsFixture,advanceTestingStationContest,nextTestingStationContestStep,
  type TestingStationContestStep,
} from './fixture-testing-station-contest';

const clean=(game:Game)=>!game.decision&&!game.response&&!game.phaseOpening;

/** Preserve original armies/cards/alliances. Only original unplayed Spice Card
 * order and the actual token lottery are staged by the shared native prefix. */
export function prepareSharedOrgizCollection() {
  const prefix=createDiscoveryOccupantsFixture({location:ORGIZ_PROCESSING_STATION,advanced:true,secondAmount:2});
  const actions:TestingStationContestStep[]=[...prefix.actions];
  let game=advanceTestingStationContest(prefix.game,g=>g.turn===2&&g.phase===5&&g.active==='ecaz'&&clean(g),actions);
  const leave:Action={type:'move',from:`${ORGIZ_PROCESSING_STATION}:0`,
    territory:prefix.parent,sector:prefix.parentSector,amount:2,elite:0};
  actions.push({actor:'ecaz',action:leave});
  game=applyAction(game,'ecaz',leave);
  game=advanceTestingStationContest(game,g=>g.turn===2&&g.phase===8&&clean(g),actions);
  // Two unused printed blows with different sectors guarantee that at least
  // one new deposit is outside the next real Storm. Never edit a storm source.
  let firstSector:number|null=null;
  const blowKeys:string[]=[];
  for(let position=0;position<2;position++) {
    const index=game.spiceDeck.findIndex((card,i)=>i>=position&&'territory' in card&&
      !card.discovery&&territory(card.territory).type==='sand'&&card.sector!==firstSector);
    assert.ok(index>=position,'Original unused ordinary blows must supply the native Collection route.');
    const card=game.spiceDeck.splice(index,1)[0];
    game.spiceDeck.splice(position,0,card);
    if('territory' in card) {
      firstSector=card.sector;
      blowKeys.push(`${card.territory}:${card.sector}`);
    }
  }
  game=advanceTestingStationContest(game,g=>g.turn===3&&g.phase===5&&clean(g),actions);
  const target=Object.entries(game.spice).find(([key,amount])=>blowKeys.includes(key)&&amount>=2&&
    splitLocation(key).sector!==game.storm&&game.players.every(p=>(p.forces[key]??0)===0));
  assert.ok(target,'An actual original blow must supply an empty non-storm shared collection deposit.');
  const destination=splitLocation(target[0]);
  const shipped=new Set<string>();
  let beforeCollection:Game|null=null;
  for(let step=0;step<500&&game.turn===3&&!(game.phase===7&&game.decision?.kind==='ecazSpice');step++) {
    if(game.phase===5&&clean(game)&&game.movementRemaining?.length===1)
      beforeCollection=game;
    let next:TestingStationContestStep|null;
    if(game.turn===3&&game.phase===5&&clean(game)&&game.active&&
      ['ecaz','guild'].includes(game.active)&&!shipped.has(game.active)) {
      const actor=game.active;
      next={actor,action:{type:'ship',territory:destination.territory,sector:destination.sector,
        amount:1,elite:0,allyPayment:0}};
      shipped.add(actor);
    } else next=nextTestingStationContestStep(game);
    assert.ok(next,`Original shared Collection has no continuation: ${JSON.stringify({
      status:game.status,turn:game.turn,phase:game.phase,decision:game.decision,
      active:game.active,shipped:[...shipped],target:target[0],
    })}`);
    actions.push(next);
    game=applyAction(game,next.actor,next.action);
  }
  assert.equal(game.decision?.kind,'ecazSpice',JSON.stringify({
    turn:game.turn,phase:game.phase,shipped:[...shipped],target:target[0],
    spice:beforeCollection?.spice[target[0]],storm:beforeCollection?.storm,
    seats:beforeCollection?.players.map(p=>({id:p.id,ally:p.ally,forces:p.forces[target[0]]})),
    last:actions.slice(-12),
  }));
  assert.equal(game.players.find(p=>p.id==='ecaz')!.forces[`${ORGIZ_PROCESSING_STATION}:0`],undefined);
  assert.equal(game.players.find(p=>p.id==='guild')!.forces[`${ORGIZ_PROCESSING_STATION}:0`],2);
  const pending=game.ecazCollection!.allocation!;
  const lot=pending.lots[pending.index];
  assert.equal(lot.territory,destination.territory);
  assert.ok(lot.amount>=2);
  return {...prefix,game,actions,lot,key:target[0],ecaz:'ecaz',guild:'guild',owner:'guild'};
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
