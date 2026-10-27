import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame } from '../game/engine';
import { act, player, type First } from './fixture-basic-native-overlap';
import { createGuildOverlapChildFixture } from './fixture-guild-overlap-child';

for (const first of ['ambassador','terror'] as const satisfies readonly First[])
  for (const same of [true,false])
    for (const reveal of [false,true]) {
      void test(`Basic Guild child ${same?'same':'different'} stronghold, ${first} first, child ${reveal?'reveals':'declines'}`,()=>{
        const f=createGuildOverlapChildFixture(first,same), source=f.game;
        const originalSpice=player(source,f.entrant).spice;
        const beneficiary=player(source,f.owner);
        const reserve=beneficiary.reserves,spice=beneficiary.spice;
        let game=act(source,f.entrant,f.shipment);
        assert.equal(game.pendingArrivalOverlap?.first,first);
        const overlapEvent=game.pendingArrivalOverlap!.event;
        assert.equal(player(game,f.entrant).spice,originalSpice-1);
        assert.equal(player(game,f.entrant).forces[`${f.destination}:${f.sector}`],1);
        if(first==='terror') {
          assert.equal(game.pendingTerrorEntry?.entrant,f.entrant);
          game=act(game,f.moritani,{type:'decision',decline:true});
        }
        const entry=game.pendingAmbassador; assert.ok(entry);
        assert.equal(entry.token,f.ambassador);
        const projection=viewGame(game,f.owner).ambassadorEntry; assert.ok(projection);
        game=act(game,f.owner,{type:'decision',event:entry.event,trigger:true,beneficiary:f.owner});
        assert.equal(game.pendingAmbassador?.stage,'ship');
        assert.equal(game.decision?.kind,'ecazAmbassador');
        game=act(game,f.owner,{type:'decision',event:entry.event,amount:1,elite:0,
          territory:f.childDestination,sector:f.childSector});
        assert.equal(player(game,f.owner).reserves,reserve-1);
        assert.equal(player(game,f.owner).forces[`${f.childDestination}:${f.childSector}`],1);
        assert.equal(player(game,f.owner).spice,spice,'The independent Guild shipment is free');
        assert.equal(game.pendingTerrorEntry?.entrant,f.owner);
        assert.equal(game.pendingTerrorEntry?.token,f.childTerror);
        assert.equal(game.pendingTerrorEntry?.resume,'ambassador');
        assert.equal(game.pendingArrivalOverlap?.event,overlapEvent);
        assert.equal(game.pendingArrivalOverlap?.ambassadorEvent,entry.event);
        if(reveal) {
          game=act(game,f.moritani,{type:'decision',reveal:true});
          assert.equal(game.pendingTerrorEntry?.stage,'robbery');
          game=act(game,f.moritani,{type:'decision',choice:'spice'});
          assert.equal(player(game,f.owner).spice,Math.floor(spice/2));
          assert.equal(game.moritaniTerror?.tokens.find(token=>token.id===f.childTerror)?.status,'removed');
        } else game=act(game,f.moritani,{type:'decision',decline:true});
        if(first==='ambassador' && (!same || !reveal)) {
          assert.equal(game.pendingTerrorEntry?.entrant,f.entrant,'The original live token keeps its own prior opportunity');
          assert.equal(game.pendingTerrorEntry?.token,f.originalTerror);
          game=act(game,f.moritani,{type:'decision',decline:true});
        }
        assert.equal(game.pendingArrivalOverlap,null);
        assert.equal(game.pendingAmbassador,null);
        assert.equal(game.pendingTerrorEntry,null);
        assert.equal(game.ecazAmbassadors?.tokens.find(token=>token.id===f.ambassador)?.zone,'used');
        assert.equal(player(game,f.entrant).forces[`${f.destination}:${f.sector}`],1);
        assert.equal(player(game,f.entrant).spice,originalSpice-1);
        assert.equal(player(game,f.owner).forces[`${f.childDestination}:${f.childSector}`],1);
        assert.equal(player(game,f.owner).reserves,reserve-1);
      });
    }
