import assert from 'node:assert/strict';
import { applyAction, type Action, type Game } from '../game/engine';
import {
  initializePairedChoamNexusSkills, completePairedChoamSkillsSetup,
  nextPairedChoamSkillsStep, type PairedChoamNexusSkillsOptions,
} from './fixture-paired-choam-nexus-skills';

export type BureaucratPairedFundingStep = {actor:string;action:Action};
const clean = (game:Game) => !game.phaseOpening && !game.response && !game.decision;

/** Original six-seat paired E2 setup; native CHOAM Bureaucrat, actual H/F
 * bribe and worm alliance. Never replace armies, wallets or phase state. */
export function createBureaucratPairedFundingSetup(advanced=false) {
  const options:PairedChoamNexusSkillsOptions = {advanced,
    factions:['choam','richese','harkonnen','fremen','emperor','guild'],
    seatIds:['b','r','p','f','e','g'],choamSkill:'bureaucrat'};
  const actions:BureaucratPairedFundingStep[] = [];
  const staging:string[] = [];
  let game = completePairedChoamSkillsSetup(initializePairedChoamNexusSkills(options),options,actions);
  const setup = structuredClone(game);
  assert.ok(game.leaderSkills!.assignments.some(a=>a.owner==='b'&&a.skill==='bureaucrat'));
  const act = (actor:string,action:Action) => {
    actions.push({actor,action});
    game = applyAction(game,actor,action);
  };
  const advance = (until:(state:Game)=>boolean) => {
    game = advanceBureaucratPairedFunding(game,until,actions);
  };
  const orderSpice = (kinds:('land'|'worm')[]) => {
    for (const [position,kind] of kinds.entries()) {
      const index = game.spiceDeck.findIndex((card,i)=>i>=position&&
        (kind==='land'?'territory' in card:'worm' in card));
      assert.ok(index>=position);
      game.spiceDeck.splice(position,0,game.spiceDeck.splice(index,1)[0]);
    }
    staging.push('Reorder only original still-unplayed Spice Cards.');
  };
  orderSpice(['land','land']);
  advance(state=>state.phase===5&&state.active==='p'&&clean(state));
  const beforeBribe = structuredClone(game);
  act('p',{type:'bribe',target:'f',amount:3});
  const bribe = structuredClone(game);
  assert.equal(game.players.find(p=>p.id==='f')!.bribes,3);
  advance(state=>state.turn===2&&state.phase===1&&clean(state));
  const afterFirstMentat = structuredClone(game);
  assert.equal(game.players.find(p=>p.id==='f')!.spice,6);
  orderSpice(['worm','land','land']);
  advance(state=>!!state.nexus&&!state.spiceWindow&&!state.spiceResolution&&clean(state));
  const worm = structuredClone(game);
  act('p',{type:'alliance',target:'f'});
  act('f',{type:'alliance',target:'p'});
  const alliance = structuredClone(game);
  advance(state=>state.turn===2&&state.phase===3);
  return {game,setup,beforeBribe,bribe,afterFirstMentat,worm,alliance,
    payer:'p',donor:'f',trainer:'b',richese:'r',guild:'g',emperor:'e',actions,staging};
}

export function advanceBureaucratPairedFunding(state:Game,until:(game:Game)=>boolean,
  actions?:BureaucratPairedFundingStep[]):Game {
  let game = state;
  for (let n=0;!until(game)&&n<1800;n++) {
    assert.notEqual(game.status,'finished');
    const next = nextPairedChoamSkillsStep(game);
    assert.ok(next,'Original paired E2 controls must reach the payment boundary');
    actions?.push(next);
    game = applyAction(game,next.actor,next.action);
  }
  assert.ok(until(game));
  return game;
}
