import assert from 'node:assert/strict';
import {applyAction,type Action,type Game} from '../game/engine';
import {splitLocation} from '../game/board';
import {quoteSpiceCollection} from '../game/board-resolution-quote';
import {CISTERN,ORGIZ_PROCESSING_STATION} from '../game/discovery-collection';
import {
  createDiscoveryOccupantsFixture,advanceTestingStationContest,
  type TestingStationContestStep,
} from './fixture-testing-station-contest';

const clean = (game:Game) => !game.decision && !game.response && !game.phaseOpening;

/** Original location entry and alliance are shared with the Station proof.
 * Orgiz adds a real opposing reserve shipment to an actual positive deposit. */
export function createOccupiedDiscoveryCollectionFixture(
  location:typeof CISTERN|typeof ORGIZ_PROCESSING_STATION,
  advanced=false,
) {
  const fixture=createDiscoveryOccupantsFixture({location,advanced,adjacentBlow:location===ORGIZ_PROCESSING_STATION});
  const actions:TestingStationContestStep[]=[...fixture.actions];
  let game=fixture.game;
  let collector:string|null=null,deposit:string|null=null;
  if(location===ORGIZ_PROCESSING_STATION) {
    game=advanceTestingStationContest(game,g=>g.turn===2&&g.phase===5&&
      g.active==='emperor'&&clean(g),actions);
    const candidate=Object.entries(game.spice).find(([key,amount])=>amount>=2&&
      splitLocation(key).sector!==game.storm&&game.players.every(p=>(p.forces[key]??0)===0));
    assert.ok(candidate,'An original printed blow must supply an empty non-storm deposit.');
    deposit=candidate[0];
    collector='emperor';
    const {territory,sector}=splitLocation(deposit);
    const shipment:Action={type:'ship',territory,sector,amount:2,elite:0,allyPayment:0};
    game=applyAction(game,collector,shipment);
    actions.push({actor:collector,action:shipment});
    game=advanceTestingStationContest(game,clean,actions);
    assert.equal(game.players.find(p=>p.id===collector)!.forces[deposit],2);
  }
  game=advanceTestingStationContest(game,g=>g.phase===5&&g.active!==null&&
    (g.movementRemaining?.length??0)===1&&clean(g),actions);
  const original=quoteSpiceCollection(game);
  const finalAction:TestingStationContestStep={actor:game.active!,action:{type:'endMovement'}};
  return {...fixture,game,actions,collector,deposit,original,finalAction};
}
