import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { placeAmbassador } from '../game/ecaz-ambassadors';
import { placeTerror } from '../game/moritani-terror';
import { actBasicSemutaAmbassador, advanceBasicSemutaAmbassador, basicSemutaAmbassadorClean,
  basicSemutaAmbassadorPlayer, type BasicSemutaAmbassadorStep } from './fixture-basic-semuta-ambassador';

export const act = actBasicSemutaAmbassador;
export const player = basicSemutaAmbassadorPlayer;
export const advance = advanceBasicSemutaAmbassador;
export type Native = 'ixians' | 'tleilaxu';
export type First = 'ambassador' | 'terror';

/** A real public five-seat selected-deck Basic start. All actual setup, phase
 * choices and owned shipment are native. At the original first movement turn,
 * two legal marker placements are explicitly controlled on their existing
 * physical tokens; no resource, force, pending reaction or receipt is staged. */
export function createBasicNativeOverlapFixture(native: Native, first: First, entrantKind: 'guild' | 'native' = 'guild') {
  const entrant = entrantKind === 'native' ? native : 'guild';
  let game = createGame('BASICNATIVEOVERLAP',newPlayer('ecaz','Ecaz','ecaz'),false,['ecaz','choam','ix']);
  for (const faction of ['choam',native,'guild','moritani'] as const)
    joinGame(game,newPlayer(faction,faction,faction));
  const actions: BasicSemutaAmbassadorStep[] = [];
  const send = (actor: string, action: Action) => {game=act(game,actor,action,actions);};
  const reach = (until: (g: Game)=>boolean) => {game=advance(game,until,actions);};
  // The real lobby circle choices choose the storm ordering; no saved order is edited.
  send('guild',{type:'seatPosition',position:6});
  if (first === 'terror') send('moritani',{type:'seatPosition',position:4});
  send('ecaz',{type:'seatPosition',position:first === 'ambassador' ? 4 : 5});
  send('choam',{type:'seatPosition',position:1});
  send(native,{type:'seatPosition',position:2});
  for (const seat of game.players) send(seat.id,{type:'ready'});
  const lobby=structuredClone(game);
  send('ecaz',{type:'start'});
  const setup=structuredClone(game);
  assert.equal(game.status,'setup');
  assert.equal(game.advanced,false);
  assert.ok(!game.semutaPreview && !game.kullPreview && !game.nexusCards && !game.leaderSkills && !game.homeworlds);
  reach(g=>g.status==='playing');
  const afterSetup=structuredClone(game);
  assert.ok(game.ecazAmbassadors && game.moritaniTerror);
  // Pick a known ordinary unopened Spice draw; this does not stage its result.
  const spice=game.spiceDeck.findIndex(card=>'territory' in card && !card.discovery);
  assert.ok(spice>=0);
  game.spiceDeck.unshift(game.spiceDeck.splice(spice,1)[0]);
  reach(g=>g.turn===1 && g.phase===5 && g.active===entrant && basicSemutaAmbassadorClean(g));
  assert.equal(game.order.indexOf('ecaz')<game.order.indexOf('moritani'),first==='ambassador');
  const beforeMarkers=structuredClone(game);
  const token=game.ecazAmbassadors!.tokens.find(t=>t.effect==='ecaz' && t.zone==='supply');
  const terror=game.moritaniTerror!.tokens.find(t=>t.kind==='robbery' && t.status==='available');
  assert.ok(token && terror);
  const destination='habbanya_ridge_sietch',sector=17;
  game.ecazAmbassadors=placeAmbassador(game.ecazAmbassadors!,token.id,{
    turn:game.turn,availableSpice:player(game,'ecaz').spice,
    destination:{id:destination,stronghold:true,inStorm:false,allowed:true},
  }).state;
  game.moritaniTerror=placeTerror(game.moritaniTerror!,terror.id,destination,game.turn);
  const source=structuredClone(game);
  const shipment: Action={type:'ship',territory:destination,sector,amount:1,elite:0,allyPayment:0};
  return {game,source,lobby,setup,afterSetup,beforeMarkers,actions,first,native,
    entrant,owner:'ecaz',moritani:'moritani',destination,sector,token:token.id,terror:terror.id,shipment,
    staging:'Actual public lobby, setup and turn-one native controls. Two existing supply tokens are placed by their native pure placement helpers at the clean entrant turn; no receipt, pending action, force, purse, seat or order is staged. One unopened ordinary Spice card is selected.'};
}
