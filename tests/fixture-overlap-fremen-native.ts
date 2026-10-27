import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { placeAmbassador, validateAmbassadors } from '../game/ecaz-ambassadors';
import { placeTerror } from '../game/moritani-terror';
import { fremenAmbassadorMovement } from '../game/fremen-ambassador';
import { act, player, createBasicNativeOverlapFixture, type First } from './fixture-basic-native-overlap';
import { advanceBasicSemutaAmbassador, basicSemutaAmbassadorClean } from './fixture-basic-semuta-ambassador';

export { act, player };

/** Public Basic native setup and actual Guild shipment. The Fremen cohort and
 * two original physical tokens are selected and placed in controlled setup;
 * the second token is explicitly staged because two placements cannot occur
 * during one real turn. All later moves, payments and reactions are native. */
function createWithBg(first: First) {
  let game = createGame('OVERLAPFREMENBG',newPlayer('ecaz','Ecaz','ecaz'),false,['ecaz','choam','ix']);
  // Arrange five occupied circles while the sixth is still free, then join
  // Guild in the remaining circle. Public seat selection never swaps seats.
  for (const faction of ['choam','tleilaxu','beneGesserit','moritani'] as const)
    joinGame(game,newPlayer(faction,faction,faction));
  for (const [actor,position] of [['ecaz',6],['choam',1],['tleilaxu',2],['beneGesserit',3]] as const)
    game = act(game,actor,{type:'seatPosition',position});
  if (first === 'terror') game = act(game,'moritani',{type:'seatPosition',position:4});
  game = act(game,'ecaz',{type:'seatPosition',position:first === 'ambassador' ? 4 : 5});
  joinGame(game,newPlayer('guild','guild','guild'));
  for (const p of game.players) game = act(game,p.id,{type:'ready'});
  game = act(game,'ecaz',{type:'start'});
  game = advanceBasicSemutaAmbassador(game, g => g.status === 'playing');
  const draw = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery); assert.ok(draw >= 0);
  game.spiceDeck.unshift(game.spiceDeck.splice(draw,1)[0]);
  game = advanceBasicSemutaAmbassador(game, g => g.turn === 1 && g.phase === 5 &&
    g.active === 'guild' && basicSemutaAmbassadorClean(g));
  assert.equal(game.order.indexOf('ecaz') < game.order.indexOf('moritani'),first === 'ambassador');
  return { beforeMarkers:structuredClone(game), entrant:'guild', destination:'habbanya_ridge_sietch', sector:17,
    shipment:{type:'ship',territory:'habbanya_ridge_sietch',sector:17,amount:1,elite:0,allyPayment:0} as Action };
}
export function createFremenOverlapFixture(first: First, otherTerror = false, withBG = false) {
  const f = withBG ? createWithBg(first) : createBasicNativeOverlapFixture('tleilaxu', first);
  const game = structuredClone(f.beforeMarkers);
  const ambassadors = game.ecazAmbassadors!;
  const fremen = ambassadors.tokens.find(token => token.effect === 'fremen'); assert.ok(fremen);
  if (fremen.zone === 'pool') {
    const index = ambassadors.cohort.findIndex(id => ambassadors.tokens.some(token => token.id === id && token.zone === 'supply'));
    assert.ok(index >= 0);
    const old = ambassadors.tokens.find(token => token.id === ambassadors.cohort[index])!;
    old.zone = 'pool'; fremen.zone = 'supply'; ambassadors.cohort[index] = fremen.id;
  }
  assert.equal(fremen.zone, 'supply');
  validateAmbassadors(ambassadors);
  game.ecazAmbassadors = placeAmbassador(ambassadors, fremen.id, {
    turn: game.turn, availableSpice: player(game, 'ecaz').spice,
    destination: { id: f.destination, stronghold: true, inStorm: false, allowed: true },
  }).state;
  const terror = game.moritaniTerror!.tokens.find(token => token.kind === 'robbery' && token.status === 'available');
  assert.ok(terror);
  game.moritaniTerror = placeTerror(game.moritaniTerror!, terror.id, f.destination, game.turn);
  const options = fremenAmbassadorMovement(game, 'ecaz').sources.flatMap(source =>
    source.destinations.filter(destination => source.territory !== destination.territory &&
      source.sectors.some(sector => sector.forces > 0)).map(destination => ({ source, destination })));
  const alternate = options.find(option => option.destination.territory !== f.destination &&
    ['arrakeen','carthag','sietch_tabr','habbanya_ridge_sietch','tuek_sietch'].includes(option.destination.territory));
  assert.ok(alternate, 'A real Ecaz group can enter a second ordinary stronghold');
  let childTerror: string | undefined;
  if (otherTerror) {
    const token = game.moritaniTerror.tokens.find(row => row.kind === (withBG ? 'sneakAttack' : 'extortion') && row.status === 'available');
    assert.ok(token);
    // Controlled additional original token placement. It preserves the native
    // inventory and current placement-turn history; no force or spice is added.
    token.status = 'placed'; token.location = alternate.destination.territory;
    childTerror = token.id;
  }
  return { ...f, game, fremen: fremen.id, terror: terror.id, alternate, childTerror,
    staging: 'Public native setup and shipment; selected Fremen cohort and original Terror placements are controlled. An optional second physical Terror placement is staged without changing force or spice.' };
}

export function triggerFremen(game: Game): Game {
  const entry = game.pendingAmbassador; assert.ok(entry && entry.stage === 'offer');
  const next = act(game, 'ecaz', { type: 'decision', event: entry.event, trigger: true, beneficiary: 'ecaz' });
  assert.equal(next.pendingAmbassador?.effect, 'fremen');
  assert.equal(next.pendingAmbassador?.stage, 'move');
  return next;
}

export function relocate(game: Game, territory: string, sector: number): Game {
  const sources = fremenAmbassadorMovement(game, 'ecaz').sources;
  const source = sources.find(row => row.territory !== territory && row.sectors.some(s => s.forces > 0) &&
    row.destinations.some(d => d.territory === territory && d.sector === sector));
  assert.ok(source, `A native Ecaz group can reach ${territory}:${sector}`);
  const position = source.sectors.find(row => row.forces > 0); assert.ok(position);
  const action: Action = { type: 'decision', event: game.pendingAmbassador!.event,
    forces: { [position.key]: 1 }, territory, sector };
  return act(game, 'ecaz', action);
}
