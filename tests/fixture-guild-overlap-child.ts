import assert from 'node:assert/strict';
import { placeAmbassador } from '../game/ecaz-ambassadors';
import { guildAmbassadorShipments } from '../game/guild-ambassador';
import { placeTerror } from '../game/moritani-terror';
import { createBasicNativeOverlapFixture, player, type First } from './fixture-basic-native-overlap';

/** Real public Basic setup and native Tleilaxu's real turn from the shared
 * fixture. Controlled supplements select Guild as one original Ambassador in
 * the five-token cohort and legally place it at the original destination.
 * For distinct destinations an additional original Terror token is placed by
 * a controlled custody-preserving edit (not a claim of natural Mentat history).
 * No purse, forces, phase, player order, pending decision or receipt is staged. */
export function createGuildOverlapChildFixture(first: First, same: boolean) {
  const f = createBasicNativeOverlapFixture('tleilaxu', first, 'native');
  const game = structuredClone(f.beforeMarkers);
  const state = game.ecazAmbassadors!;
  const guild = state.tokens.find(token => token.effect === 'guild'); assert.ok(guild);
  if (guild.zone === 'pool') {
    const replaced = state.tokens.find(token => token.zone === 'supply' && token.effect !== 'ecaz');
    assert.ok(replaced);
    const index = state.cohort.indexOf(replaced.id); assert.ok(index >= 0);
    state.cohort[index] = guild.id; replaced.zone = 'pool'; guild.zone = 'supply';
  }
  assert.equal(guild.zone, 'supply');
  game.ecazAmbassadors = placeAmbassador(state, guild.id, {
    turn:game.turn, availableSpice:player(game,'ecaz').spice,
    destination:{id:f.destination,stronghold:true,inStorm:false,allowed:true},
  }).state;
  const choices = guildAmbassadorShipments(game, 'ecaz').destinations;
  const separate = choices.find(choice => choice.territory !== f.destination &&
    ['arrakeen','carthag','sietch_tabr','tueks_sietch'].includes(choice.territory));
  const target = same ? choices.find(choice => choice.territory === f.destination && choice.sector === f.sector) : separate;
  assert.ok(target, 'The free shipment must have an available selected stronghold destination');
  const terror = game.moritaniTerror!;
  const original = terror.tokens.find(token => token.kind === (same ? 'robbery' : 'sabotage')); assert.ok(original);
  game.moritaniTerror = placeTerror(terror, original.id, f.destination, game.turn);
  let child = original;
  if (!same) {
    const second = game.moritaniTerror.tokens.find(token => token.kind === 'robbery'); assert.ok(second);
    second.status = 'placed'; second.location = target.territory; child = second;
  }
  return { ...f, game, ambassador:guild.id, originalTerror:original.id,
    childTerror:child.id, childDestination:target.territory, childSector:target.sector,
    staging:'Public native setup and actual Tleilaxu shipment. Original Guild token/cohort and Terror placements are controlled; the distinct child Terror is a physical token placed without staging a Mentat turn.' };
}
