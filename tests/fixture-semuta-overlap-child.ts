import assert from 'node:assert/strict';
import type { Action, Game } from '../game/engine';
import { validateAmbassadors } from '../game/ecaz-ambassadors';
import { fremenAmbassadorMovement } from '../game/fremen-ambassador';
import { actSemutaArrivalOverlap as act, createSemutaArrivalOverlapFixture,
  inventory, player } from './fixture-semuta-arrival-overlap';

export { act, inventory, player };

/** Native Basic public setup, original paid Semuta auction and a real turn-one
 * Terror placement come from the shared fixture. At the clean turn-two source,
 * swap the placed original CHOAM Ambassador with the original Fremen Ambassador
 * already in the same cohort. The physical tokens and paid location remain;
 * this supplement is controlled, not a played Fremen placement. The inherited
 * paid Semuta is also transferred to Richese as the shared fixture documents. */
export function createSemutaOverlapChildFixture() {
  const f = createSemutaArrivalOverlapFixture({ effect: 'choam', first: 'ambassador', terror: 'sabotage' });
  const game = structuredClone(f.game), ambassadors = game.ecazAmbassadors!;
  const existing = ambassadors.tokens.find(token => token.id === f.token);
  const fremen = ambassadors.tokens.find(token => token.effect === 'fremen');
  assert.ok(existing && fremen);
  assert.equal(existing.zone, 'placed');
  assert.equal(existing.location, f.territory);
  assert.equal(fremen.zone, 'supply');
  assert.ok(ambassadors.cohort.includes(fremen.id));
  existing.zone = 'supply'; existing.location = null;
  fremen.zone = 'placed'; fremen.location = f.territory;
  validateAmbassadors(ambassadors);
  assert.ok(player(game, f.owner).hand.length > 0, 'The physical child entrant can suffer Sabotage');
  assert.ok(player(game, f.claimant).hand.some(card => card.id === f.semuta));
  assert.deepEqual(inventory(game), f.originalInventory);
  return { ...f, game, fremenToken: fremen.id,
    staging: [...f.staging, 'At the clean turn-two source, swap the placed original CHOAM Ambassador with the original Fremen cohort token. Both retain native custody; no force, wallet, turn or response is installed.'] };
}
export type SemutaOverlapChildFixture = ReturnType<typeof createSemutaOverlapChildFixture>;

/** The real paid Guild arrival opens both original opportunities; the Fremen
 * Ambassador then moves one existing Ecaz force into that same stronghold. */
export function openSemutaOverlapChild(f: SemutaOverlapChildFixture): Game {
  let game = act(f.game, f.arrivalStep.actor, f.arrivalStep.action);
  assert.equal(game.pendingArrivalOverlap?.first, 'ambassador');
  const entry = game.pendingAmbassador; assert.ok(entry && entry.stage === 'offer');
  assert.equal(entry.token, f.fremenToken);
  game = act(game, f.owner, { type: 'decision', event: entry.event, trigger: true, beneficiary: f.owner });
  assert.equal(game.pendingAmbassador?.effect, 'fremen');
  assert.equal(game.pendingAmbassador?.stage, 'move');
  const sources = fremenAmbassadorMovement(game, f.owner).sources;
  const source = sources.find(row => row.territory !== f.territory && row.sectors.some(sector => sector.forces > 0) &&
    row.destinations.some(destination => destination.territory === f.territory && destination.sector === f.sector));
  assert.ok(source);
  const sector = source.sectors.find(row => row.forces > 0); assert.ok(sector);
  const action: Action = { type: 'decision', event: entry.event, forces: { [sector.key]: 1 },
    territory: f.territory, sector: f.sector };
  game = act(game, f.owner, action);
  assert.equal(game.pendingTerrorEntry?.cause, 'ambassador');
  assert.equal(game.pendingTerrorEntry?.entrant, f.owner);
  assert.equal(game.pendingTerrorEntry?.token, f.terrorToken);
  return game;
}
