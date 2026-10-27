import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { createAmbassadors, placeAmbassador } from '../game/ecaz-ambassadors';
import { placeTerror } from '../game/moritani-terror';
import { location, territory } from '../game/board';
import { caladanVictoryFixture, holdVictoryCard } from './fixture-caladan-victory';
import {
  actCaladanArrival, caladanArrivalInventory, caladanArrivalPlayer,
  caladanArrivalReload, type CaladanArrivalStep,
} from './fixture-caladan-arrival';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export const actCaladanSneak = actCaladanArrival;
export const caladanSneakPlayer = caladanArrivalPlayer;
export const caladanSneakReload = caladanArrivalReload;
export const caladanSneakInventory = caladanArrivalInventory;
export type CaladanSneakStep = CaladanArrivalStep;

/** Neutral native controls only. All entry decisions and the current original
 * reinforcement remain owned by the caller; no later battle is started. */
export function settleCaladanSneak(game: Game, actions: CaladanSneakStep[] = []): Game {
  let g = game;
  for (let n = 0; n < 120; n++) {
    if (g.homeworldVictoryReinforcement?.stage === 'complete') return g;
    if (g.decision && ['caladanReinforcement','moritaniTerror','ecazAmbassador',
      'intrusion','advisor','arrivalOverlap'].includes(g.decision.kind)) return g;
    if (!g.battle && !g.response && !g.pendingTreacheryDiscard) return g;
    const next = nextStrongholdFactionsNativeStep(g);
    if (!next) return g;
    g = actCaladanSneak(g,next.actor,next.action,actions);
  }
  assert.fail('The bounded Caladan Sneak continuation did not stop.');
}

/** Finish exactly the present preventable layer; a later matching/automatic
 * advisor conversion remains observable instead of being folded into it. */
export function passCaladanSneakResponse(game: Game, actions: CaladanSneakStep[] = []): Game {
  let g = game;
  const signature = (state: Game) => state.response ? JSON.stringify([
    state.response.kind, state.response.spiritualAdvisorSource,
    state.response.automaticAdvisorFlip,
  ]) : null;
  const original = signature(g);
  assert.ok(original);
  for (let n = 0; signature(g) === original && n < 40; n++) {
    const actor = g.players.find(p => !g.response!.passed.includes(p.id));
    assert.ok(actor);
    g = actCaladanSneak(g,actor.id,{type:'passResponse'},actions);
  }
  assert.notEqual(signature(g),original);
  return g;
}

export function allowCaladanSneakResponses(game: Game, actions: CaladanSneakStep[] = []): Game {
  let g = game;
  for (let n = 0; g.response && n < 40; n++) g = passCaladanSneakResponse(g,actions);
  assert.equal(g.response,null);
  return settleCaladanSneak(g,actions);
}

export function createCaladanSneakFixture(options: {
  advanced?: boolean; bg?: 'none'|'away'|'advisors';
  ambassador?: 'first'|'second'; polarAlone?: boolean;
} = {}) {
  const advanced = options.advanced ?? true, bg = options.bg ?? 'away';
  let game = caladanVictoryFixture({advanced,extraSeats:[
    {id:'m',faction:'moritani'},
    ...(options.ambassador ? [{id:'ec',faction:'ecaz'} as const] : []),
    ...(bg !== 'none' ? [{id:'bg',faction:'beneGesserit'} as const] : []),
  ]});
  // Explicit controlled source seam: the original Homeworld preview setup is
  // genuine, while these later positions/purses/card custody and token placement
  // are conserved scenario inputs, not an acquisition or movement history.
  game.expansions.push('ecaz');
  for (const id of ['a','g']) {
    const p = caladanSneakPlayer(game,id);
    delete p.forces['hagga_basin:12']; p.forces['arrakeen:10'] = 3;
  }
  const a = caladanSneakPlayer(game,'a'), guild = caladanSneakPlayer(game,'g');
  if (options.polarAlone) {
    a.forces['hagga_basin:12'] = a.forces['polar_sink:0'];
    delete a.forces['polar_sink:0'];
  }
  if (bg !== 'none') {
    const p = caladanSneakPlayer(game,'bg');
    Object.assign(p,{reserves:19,forces:bg === 'advisors' ? {'arrakeen:10':1} : {'sietch_tabr:14':1},
      advisors:advanced && bg === 'advisors' ? {arrakeen:{}} : {}});
  }
  const token = game.moritaniTerror!.tokens.find(t => t.kind === 'sneakAttack')!.id;
  game.moritaniTerror = placeTerror(game.moritaniTerror!,token,'arrakeen',1);
  let ambassadorToken: string | undefined;
  if (options.ambassador) {
    game.ecazAmbassadors = createAmbassadors(() => 0);
    const original = game.ecazAmbassadors.tokens.find(t => t.zone === 'supply')!;
    ambassadorToken = original.id;
    game.ecazAmbassadors = placeAmbassador(game.ecazAmbassadors,original.id,{turn:1,availableSpice:20,
      destination:{id:'arrakeen',stronghold:true,inStorm:false,allowed:true}}).state;
    game.order = options.ambassador === 'first' ? ['a','g','ec','m'] : ['a','g','m','ec'];
    if (bg !== 'none') game.order.push('bg');
  }
  const karama = holdVictoryCard(game,'g','karama');
  // Keep another real controlled contest so entry assertions exclude unrelated
  // automatic Collection income after this one battle finishes.
  const contest = location('shield_wall',territory('shield_wall').sectors[0]);
  const donor = options.polarAlone ? 'hagga_basin:12' : 'polar_sink:0';
  a.forces[donor]--; a.forces[contest] = 1;
  guild.reserves--; guild.forces[contest] = 1;
  caladanSneakInventory(game);
  const source = caladanSneakReload(game), sourceActions: CaladanSneakStep[] = [];
  game = actCaladanSneak(game,'a',{type:'chooseBattle',territory:'arrakeen',target:'g'},sourceActions);
  game = settleCaladanSneak(game,sourceActions);
  assert.ok(game.battle && !game.battle.preparation && !game.decision && !game.response);
  const aLeader = caladanSneakPlayer(game,'a').leaders.reduce((best,l) => l.strength > best.strength ? l : best);
  const gLeader = caladanSneakPlayer(game,'g').leaders.reduce((best,l) => l.strength < best.strength ? l : best);
  game = actCaladanSneak(game,'a',{type:'battlePlan',leader:aLeader.id,dial:1,support:advanced ? 1 : 0},sourceActions);
  game = actCaladanSneak(game,'g',{type:'battlePlan',leader:gLeader.id,dial:0,support:0},sourceActions);
  game = settleCaladanSneak(game,sourceActions);
  assert.equal(game.decision?.kind,'caladanReinforcement');
  assert.equal(caladanSneakPlayer(game,'a').forces['arrakeen:10'],2);
  const event = game.homeworldVictoryReinforcement!.event;
  caladanSneakInventory(game);
  return {game,source,sourceActions,actions:[...sourceActions],sourceCount:sourceActions.length,
    disclosure:'Controlled Homeworld preview initializer and conserved later phase/positions/purses/cards/original token supply and placement; only recorded battle/arrival actions are native chronology, with no installed victory or child receipt.',
    advanced,bg,ambassador:options.ambassador,token,ambassadorToken,karama,event,
    territory:'arrakeen',destination:'arrakeen:10',
    action:{type:'decision',event,destination:'arrakeen:10',amount:1} as Action,
    offer:viewGame(game,'a').caladanReinforcement!};
}

export type CaladanSneakFixture = ReturnType<typeof createCaladanSneakFixture>;

/** Reach the original revealed Sneak amount choice through actual decisions.
 * If Ambassador was first, its actual decline leaves the original token in
 * place so the later Moritani group can legitimately offer it again. */
export function openCaladanSneak(f: CaladanSneakFixture): CaladanSneakFixture {
  const actions = [...f.sourceActions];
  let game = actCaladanSneak(caladanSneakReload(f.game),'a',f.action,actions);
  assert.equal(game.pendingSpiritualAdvisor,undefined,'A direct Caladan addition creates no free-shipment source.');
  if (game.pendingAmbassador) {
    assert.equal(game.pendingAmbassador.entrant,'a');
    game = actCaladanSneak(game,'ec',{type:'decision',event:game.pendingAmbassador.event,decline:true},actions);
  }
  assert.equal(game.pendingTerrorEntry?.stage,'offer');
  assert.equal(game.pendingTerrorEntry?.victoryEvent,f.event);
  game = actCaladanSneak(game,'m',{type:'decision',reveal:true},actions);
  assert.equal(game.pendingTerrorEntry?.stage,'sneakAttack');
  return {...f,game,actions};
}

export function commitCaladanSneak(f: CaladanSneakFixture, amount: 0|1 = 1): CaladanSneakFixture {
  const opened = openCaladanSneak(f), actions = [...opened.actions];
  const game = actCaladanSneak(opened.game,'m',{type:'decision',amount},actions);
  caladanSneakInventory(game);
  return {...opened,game,actions};
}
