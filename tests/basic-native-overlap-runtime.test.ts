import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { act, player, createBasicNativeOverlapFixture, type First, type Native } from './fixture-basic-native-overlap';

function decline(game:Game, owner:First):Game {
  if (owner==='ambassador') {
    const pending=game.pendingAmbassador; assert.ok(pending);
    return act(game,'ecaz',{type:'decision',event:pending.event,decline:true});
  }
  assert.ok(game.pendingTerrorEntry);
  return act(game,'moritani',{type:'decision',decline:true});
}

for (const native of ['ixians','tleilaxu'] as const satisfies readonly Native[])
  for (const first of ['ambassador','terror'] as const satisfies readonly First[]) {
    void test(`Basic ${native} native roster preserves the original shipment through ${first}-first overlapping arrivals`,()=>{
      const f=createBasicNativeOverlapFixture(native,first),initial=f.game;
      const spice=player(initial,f.entrant).spice,reserves=player(initial,f.entrant).reserves;
      const offered=act(initial,f.entrant,f.shipment);
      assert.equal(player(offered,f.entrant).spice,spice-1);
      assert.equal(player(offered,f.entrant).reserves,reserves-1);
      assert.equal(player(offered,f.entrant).forces[`${f.destination}:${f.sector}`],1);
      assert.equal(player(offered,f.entrant).shipped,true);
      assert.equal(offered.pendingArrivalOverlap?.first,first);
      assert.equal(offered.pendingArrivalOverlap?.stage,'first');
      assert.equal(offered.pendingArrivalOverlap?.entrant,f.entrant);
      assert.equal(viewGame(offered,f.entrant).arrivalOverlap?.first,first);
      const other:First=first==='ambassador'?'terror':'ambassador';
      const second=decline(offered,first);
      assert.equal(second.pendingArrivalOverlap?.first,first);
      assert.equal(second.pendingArrivalOverlap?.stage,'second');
      assert.equal(player(second,f.entrant).spice,spice-1);
      assert.equal(player(second,f.entrant).forces[`${f.destination}:${f.sector}`],1);
      const settled=decline(second,other);
      assert.equal(settled.pendingArrivalOverlap,null);
      assert.equal(settled.pendingAmbassador,null);
      assert.equal(settled.pendingTerrorEntry,null);
      assert.equal(player(settled,f.entrant).spice,spice-1);
      assert.equal(player(settled,f.entrant).reserves,reserves-1);
      assert.equal(player(settled,f.entrant).forces[`${f.destination}:${f.sector}`],1);
      assert.equal(settled.ecazAmbassadors?.tokens.find(t=>t.id===f.token)?.zone,'placed');
      assert.equal(settled.moritaniTerror?.tokens.find(t=>t.id===f.terror)?.status,'placed');
    });
  }

void test('all minimal bot profiles can legally handle the first mixed-native overlap decision',()=>{
  const f=createBasicNativeOverlapFixture('ixians','ambassador');
  const offered=act(f.game,f.entrant,f.shipment);
  for(const difficulty of DIFFICULTIES){
    const view=viewGame(offered,'ecaz');
    view.players.find(p=>p.id==='ecaz')!.bot=difficulty;
    const action=botActions(view)[0]; assert.ok(action,difficulty);
    const after=act(offered,'ecaz',action);
    assert.ok(after.pendingArrivalOverlap || after.pendingTerrorEntry || after.pendingAmbassador,
      'The bot choice enters the same real arrival continuation');
  }
});

for (const first of ['ambassador','terror'] as const satisfies readonly First[]) {
  void test(`Basic mixed-native ${first}-first arrival settles Duke acquisition and Robbery once`,()=>{
    const f=createBasicNativeOverlapFixture('tleilaxu',first);
    const guildBefore=player(f.game,f.entrant).spice;
    const moritaniBefore=player(f.game,f.moritani).spice;
    let game=act(f.game,f.entrant,f.shipment);
    const afterInvoice=guildBefore-1, stolen=Math.ceil(afterInvoice/2);
    for(const owner of [first,first==='ambassador'?'terror':'ambassador'] as const){
      if(owner==='ambassador'){
        const entry=game.pendingAmbassador; assert.ok(entry);
        game=act(game,f.owner,{type:'decision',event:entry.event,trigger:true,
          beneficiary:f.owner,choice:'duke'});
        assert.equal(game.dukeVidal?.controller,f.owner);
        assert.equal(game.ecazAmbassadors?.tokens.find(t=>t.id===f.token)?.zone,'supply');
      }else{
        assert.equal(game.pendingTerrorEntry?.stage,'offer');
        game=act(game,f.moritani,{type:'decision',reveal:true});
        assert.equal(game.pendingTerrorEntry?.stage,'robbery');
        game=act(game,f.moritani,{type:'decision',choice:'spice'});
        assert.equal(player(game,f.entrant).spice,afterInvoice-stolen);
        assert.equal(player(game,f.moritani).spice,moritaniBefore+stolen);
      }
    }
    assert.equal(game.pendingArrivalOverlap,null);
    assert.equal(game.moritaniTerror?.tokens.find(t=>t.id===f.terror)?.status,'removed');
    assert.equal(player(game,f.entrant).forces[`${f.destination}:${f.sector}`],1);
    assert.equal(player(game,f.entrant).shipped,true);
  });
}

void test('a real native Tleilaxu shipment triggers both reactions and resumes with physical forces',()=>{
  const f=createBasicNativeOverlapFixture('tleilaxu','terror','native');
  const initial=f.game, before=player(initial,f.entrant).spice;
  let game=act(initial,f.entrant,f.shipment);
  assert.equal(game.pendingArrivalOverlap?.entrant,'tleilaxu');
  assert.equal(game.pendingArrivalOverlap?.first,'terror');
  assert.equal(player(game,f.entrant).spice,before-1);
  assert.equal(player(game,f.entrant).forces[`${f.destination}:${f.sector}`],1);
  game=act(game,f.moritani,{type:'decision',reveal:true});
  assert.equal(game.pendingTerrorEntry?.stage,'robbery');
  game=act(game,f.moritani,{type:'decision',choice:'spice'});
  const pending=game.pendingAmbassador; assert.ok(pending);
  game=act(game,f.owner,{type:'decision',event:pending.event,trigger:true,
    beneficiary:f.owner,choice:'duke'});
  assert.equal(game.dukeVidal?.controller,f.owner);
  assert.equal(game.pendingArrivalOverlap,null);
  assert.equal(player(game,f.entrant).forces[`${f.destination}:${f.sector}`],1);
  assert.equal(player(game,f.entrant).shipped,true);
});
