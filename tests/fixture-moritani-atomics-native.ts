import assert from 'node:assert/strict';
import {
  applyAction,createGame,initializeFactionExpansionsGameForAudit,joinGame,newPlayer,
  type Action,type Game,
} from '../game/engine';
import {nextSpiceBankerIncomeNativeStep,type SpiceBankerIncomeNativeStep} from './fixture-spice-banker-income';

const clean=(game:Game)=>!game.phaseOpening&&!game.response&&!game.decision;

/** Genuine printed setup, Terror placement, worm alliance, paid entry and
 * detonation. Only original unplayed Spice Card order is controlled. */
export function createNativeAtomicsAllianceFixture(advanced=false,allied=true,
  options:{laterAllianceToken?:boolean}={}) {
  let game=createGame('NATIVEATOMICS',newPlayer('m','Moritani','moritani'),advanced,['ecaz']);
  for(const [id,faction] of [['a','atreides'],['e','emperor'],['f','fremen']] as const)
    joinGame(game,newPlayer(id,id,faction));
  for(const p of game.players)if(!p.ready)game=applyAction(game,p.id,{type:'ready'});
  const initial=structuredClone(game);
  game=initializeFactionExpansionsGameForAudit(game);
  const actions:SpiceBankerIncomeNativeStep[]=[];
  const step=(actor:string,action:Action)=>{
    game=applyAction(game,actor,action);actions.push({actor,action});
  };
  const advance=(stop:(game:Game)=>boolean)=>{
    for(let i=0;i<1000&&!stop(game);i++) {
      let next:SpiceBankerIncomeNativeStep|null;
      if(game.decision?.kind==='moritaniSetup')
        next={actor:'m',action:{type:'decision',territory:'carthag',sector:11}};
      else if(game.decision?.kind==='moritaniPlacement')
        next={actor:'m',action:{type:'decision',decline:true}};
      else next=nextSpiceBankerIncomeNativeStep(game);
      assert.ok(next,'A native Atomics control must retain legal continuation.');
      step(next.actor,next.action);
    }
    assert.ok(stop(game),`Native Atomics did not reach its control: ${game.status}/${game.turn}/${game.phase}/${game.decision?.kind}`);
  };
  const front=(position:number,predicate:(card:Game['spiceDeck'][number])=>boolean)=>{
    const index=game.spiceDeck.findIndex((card,i)=>i>=position&&predicate(card));
    assert.ok(index>=position,'The original unplayed card must remain in its deck.');
    game.spiceDeck.splice(position,0,game.spiceDeck.splice(index,1)[0]);
  };
  advance(g=>g.status==='playing');
  assert.equal(game.players.find(p=>p.id==='m')!.forces['carthag:11'],6);
  const ordinaryBlows=advanced?2:1;
  for(let i=0;i<ordinaryBlows;i++)front(i,c=>'territory' in c&&!c.discovery&&c.territory!=='sietch_tabr');
  front(ordinaryBlows,c=>'worm' in c&&!c.greatMaker);
  // Keep the two following original blows ordinary, and reserve a second real
  // worm for the later Nexus rather than relying on a random chain of worms.
  for(let i=ordinaryBlows+1;i<=ordinaryBlows+2;i++)
    front(i,c=>'territory' in c&&!c.discovery&&c.territory!=='sietch_tabr');
  front(ordinaryBlows+3,c=>'worm' in c&&!c.greatMaker);
  advance(g=>g.turn===1&&g.decision?.kind==='moritaniPlacement');
  const token=game.moritaniTerror!.tokens.find(t=>t.kind==='atomics'&&t.status==='available')!;
  assert.ok(token);
  step('m',{type:'decision',token:token.id,territory:'carthag'});
  advance(g=>g.turn===2&&g.phase===1&&g.nexus&&clean(g)&&!g.spiceWindow&&!g.spiceResolution);
  if(allied) {
    step('m',{type:'alliance',target:'a'});
    step('a',{type:'alliance',target:'m'});
  }
  advance(g=>g.turn===2&&g.phase===5&&g.active==='e'&&clean(g));
  step('e',{type:'ship',territory:'carthag',sector:11,amount:1,elite:0,allyPayment:0});
  assert.equal(game.decision?.kind,'moritaniTerror');
  step('m',{type:'decision',reveal:true});
  let laterToken:string|null=null;
  if(options.laterAllianceToken) {
    advance(g=>g.turn===2&&g.decision?.kind==='moritaniPlacement');
    const robbery=game.moritaniTerror!.tokens.find(t=>t.kind==='robbery'&&t.status==='available')!;
    assert.ok(robbery);
    laterToken=robbery.id;
    step('m',{type:'decision',token:robbery.id,territory:'arrakeen'});
  }
  advance(g=>g.turn===2&&g.phase===8&&clean(g));
  front(0,c=>'worm' in c&&!c.greatMaker);
  advance(g=>g.turn===3&&g.phase===1&&g.nexus&&clean(g)&&!g.spiceWindow&&!g.spiceResolution);
  assert.equal(game.moritaniAtomics!.allyAtActivation,allied?'a':null);
  assert.equal(game.players.find(p=>p.id==='m')!.tanks,6);
  return {initial,game,actions,token:token.id,laterToken,allied,advanced};
}

export function advanceNativeAtomicsFixture(initial:Game,stop:(game:Game)=>boolean) {
  let game=initial;
  for(let i=0;i<1000&&!stop(game);i++) {
    const next=nextSpiceBankerIncomeNativeStep(game);
    assert.ok(next,'The original post-Atomics phase must have a legal continuation.');
    game=applyAction(game,next.actor,next.action);
  }
  assert.ok(stop(game));
  return game;
}
