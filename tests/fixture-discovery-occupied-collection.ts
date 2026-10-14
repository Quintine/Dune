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
  const fixture=createDiscoveryOccupantsFixture({location,advanced});
  const actions:TestingStationContestStep[]=[...fixture.actions];
  let game=fixture.game;
  let collector:string|null=null,deposit:string|null=null;
  if(location===ORGIZ_PROCESSING_STATION) {
    game=advanceTestingStationContest(game,g=>g.phase===5&&g.turn<=4&&g.active!==null&&
      (g.movementRemaining?.length??0)===1&&clean(g)&&
      Object.entries(g.spice).some(([key,amount])=>amount>0&&
        key!==`${ORGIZ_PROCESSING_STATION}:0`),actions);
    const shipActor=game.active;
    assert.ok(shipActor,'A real movement window must have an active seat.');
    const candidates=Object.entries(game.spice)
      .filter(([key,amount])=>amount>0&&key!==`${ORGIZ_PROCESSING_STATION}:0`)
      .sort((left,right)=>right[1]-left[1]);
    assert.ok(candidates.length,'A real blow must supply a positive desert deposit.');
    let shipped:Game|null=null,shippedDeposit:string|null=null;
    for(const [key] of candidates) {
      const {territory,sector}=splitLocation(key);
      const shipment:Action={type:'ship',territory,sector,amount:2,elite:0,allyPayment:0};
      try {
        const next=applyAction(game,shipActor,shipment);
        actions.push({actor:shipActor,action:shipment});
        shipped=advanceTestingStationContest(next,clean,actions);
        shippedDeposit=key;
        break;
      } catch { continue; }
    }
    assert.ok(shipped&&shippedDeposit,'A real paid shipment must reach one actual positive deposit.');
    collector=shipActor; deposit=shippedDeposit;
    game=shipped;
    assert.equal(game.players.find(p=>p.id===collector)!.forces[deposit],2);
  }
  game=advanceTestingStationContest(game,g=>g.phase===5&&g.active!==null&&
    (g.movementRemaining?.length??0)===1&&clean(g),actions);
  const original=quoteSpiceCollection(game);
  const finalAction:TestingStationContestStep={actor:game.active!,action:{type:'endMovement'}};
  return {...fixture,game,actions,collector,deposit,original,finalAction};
}
