import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import {
  createBasicSemutaAmbassadorFixture, actBasicSemutaAmbassador,
  advanceBasicSemutaAmbassador, basicSemutaAmbassadorClean,
  basicSemutaAmbassadorInventory, basicSemutaAmbassadorPlayer,
  type BasicSemutaAmbassadorEffect, type BasicSemutaAmbassadorStep,
} from './fixture-basic-semuta-ambassador';

export const SEMUTA_AMBASSADOR_ORNITHOPTER = 'richese-ornithopter';
export const actSemutaOrnithopterAmbassador = actBasicSemutaAmbassador;
export const semutaOrnithopterAmbassadorPlayer = basicSemutaAmbassadorPlayer;
export const semutaOrnithopterAmbassadorClean = basicSemutaAmbassadorClean;
export type SemutaOrnithopterAmbassadorStep = BasicSemutaAmbassadorStep;

/** A live played flight is physical escrow, not a retired receipt's copy. */
export function semutaOrnithopterAmbassadorInventory(game: Game): string[] {
  const ids = basicSemutaAmbassadorInventory(game);
  if (game.ornithopter) ids.push(game.ornithopter.card.id);
  assert.equal(new Set(ids).size, ids.length, 'Every original physical card has one current location');
  return ids.sort();
}

/** Acknowledge only this current fresh group; never choose an Ambassador grant. */
export function passSemutaOrnithopterAmbassador(source: Game): Game {
  const pending = source.pendingTreacheryDiscard;
  assert.equal(pending?.reaction?.stage, 'offer');
  const event = pending!.batch.event;
  let game = source;
  for (const p of source.players) {
    const reaction = game.pendingTreacheryDiscard?.reaction;
    if (!reaction || reaction.stage !== 'offer') break;
    if (!reaction.passed.includes(p.id))
      game = actSemutaOrnithopterAmbassador(game, p.id, { type: 'semutaPass', event });
  }
  return game;
}

/** Sole-card recovery finishes natively; a real multi-card group needs selection. */
export function claimSemutaOrnithopterAmbassador(source: Game, actor: string, card: string): Game {
  const event = source.pendingTreacheryDiscard!.batch.event;
  let game = actSemutaOrnithopterAmbassador(source, actor, { type: 'semutaCommit', event });
  if (game.pendingTreacheryDiscard?.reaction?.stage === 'select')
    game = actSemutaOrnithopterAmbassador(game, actor, { type: 'semutaSelect', event, card });
  return game;
}

/** Fork the actual pre-shipment source. The shared constructor's subsequent
 * normal-move/trigger branch is not part of this branch's action history. */
export function createSemutaOrnithopterAmbassadorFixture(options: {
  effect: BasicSemutaAmbassadorEffect;
  mode?: 'range3' | 'twoGroups';
  copied?: boolean;
}) {
  const mode = options.mode ?? 'range3', effect = options.effect, copied = options.copied ?? false;
  const original = createBasicSemutaAmbassadorFixture({ effect, copied,
    arrival: 'movement', cacheCard: 'ornithopter' });
  const prefixEnd = original.actions.findIndex(step => step.actor === original.entrant && step.action.type === 'ship');
  assert.ok(prefixEnd >= 0, 'The inherited prefix ends before its first actual Guild shipment');
  const prefixActions = structuredClone(original.actions.slice(0, prefixEnd));
  const branchActions: SemutaOrnithopterAmbassadorStep[] = [];
  let game = structuredClone(original.beforeArrival);
  const originalInventory = semutaOrnithopterAmbassadorInventory(game);
  const claimant = 'richese', entrant = original.entrant;
  const index = game.richeseCache!.findIndex(card => card.id === SEMUTA_DRUG_ID);
  assert.ok(index >= 0);
  basicSemutaAmbassadorPlayer(game, claimant).hand.push(game.richeseCache!.splice(index, 1)[0]);
  assert.ok(game.players.every(p => p.hand.length <= 4));
  const beforeShipment = structuredClone(game);
  const shipment: SemutaOrnithopterAmbassadorStep = { actor: entrant,
    action: { ...original.shipment.step.action, amount: mode === 'twoGroups' ? 2 : 1 } };
  game = actSemutaOrnithopterAmbassador(game, shipment.actor, shipment.action, branchActions);
  game = advanceBasicSemutaAmbassador(game, basicSemutaAmbassadorClean, branchActions);
  const afterShipment = structuredClone(game);
  assert.equal(basicSemutaAmbassadorPlayer(game, entrant).shipped, true);
  let firstMove: SemutaOrnithopterAmbassadorStep | null = null;
  if (mode === 'twoGroups') {
    firstMove = { actor: entrant, action: { type: 'move', from: 'habbanya_ridge_flat:17',
      amount: 1, territory: 'habbanya_ridge_flat', sector: 18,
      movementCard: SEMUTA_AMBASSADOR_ORNITHOPTER, ornithopter: 'twoGroups' } };
    game = actSemutaOrnithopterAmbassador(game, entrant, firstMove.action, branchActions);
    game = advanceBasicSemutaAmbassador(game, basicSemutaAmbassadorClean, branchActions);
    assert.equal(game.ornithopter?.completed, 1);
    assert.equal(basicSemutaAmbassadorPlayer(game, entrant).moved, 1);
    assert.equal(basicSemutaAmbassadorPlayer(game, entrant).forces['habbanya_ridge_flat:18'], 1);
  }
  const move: Action = { ...original.arrival.step.action,
    ...(mode === 'range3' ? { movementCard: SEMUTA_AMBASSADOR_ORNITHOPTER, ornithopter: 'range3' }
      : { ornithopterEvent: game.ornithopter!.event }) };
  assert.equal(basicSemutaAmbassadorPlayer(game, entrant).forces['habbanya_ridge_flat:17'], 1);
  assert.ok(!game.pendingAmbassador);
  assert.ok(basicSemutaAmbassadorClean(game));
  assert.deepEqual(semutaOrnithopterAmbassadorInventory(game), originalInventory);
  return { game, original, prefixActions, branchActions,
    actions: [...prefixActions, ...branchActions], sourceActionCount: prefixActions.length + branchActions.length,
    sourcePrefixActionCount: prefixActions.length, branchActionCount: branchActions.length,
    beforeShipment, shipment, afterShipment, firstMove, move, mode, effect, copied,
    owner: original.owner, beneficiary: original.beneficiary, entrant, claimant,
    ornithopter: SEMUTA_AMBASSADOR_ORNITHOPTER, semuta: SEMUTA_DRUG_ID,
    token: original.token, territory: original.territory, sector: original.sector,
    location: original.location, originalInventory,
    endMovement: { type: 'endMovement' } satisfies Action,
    staging: [
      'Reuse only the genuine public Basic Ecaz/CHOAM/Richese/Guild prefix before Guild shipment: original selected deal/Spice positions and scalar Ambassador packet, paid canonical Ornithopter cache purchase1, normal Ecaz purchase1 and actual placement1. The constructor’s later ordinary-movement/trigger branch is not replayed or counted in this branch.',
      'At that clean boundary, move only the original cache Semuta to Richese hand as an explicitly conserved prior acquisition. No card copy, wallet, force, phase, alliance, token, pending reaction or receipt is installed.',
      mode === 'twoGroups'
        ? 'Actually ship two Guild reserves, play the paid original Ornithopter and move one original counter from Habbanya Ridge Flat17 to its printed sector18. The first group has no new-territory arrival. Its original flight event binds the remaining final group to Habbanya Sietch17; that final move remains a caller action.'
        : 'Actually ship one Guild reserve to Habbanya Ridge Flat17. The paid original range-three Ornithopter move into the real Ambassador at Habbanya Sietch17 remains a caller action.',
    ],
  };
}
export type SemutaOrnithopterAmbassadorFixture = ReturnType<typeof createSemutaOrnithopterAmbassadorFixture>;

/** The first discarded card has already retired before this actual entry opens. */
export function openSemutaOrnithopterAmbassadorGrant(
  source: Game, fixture: Pick<SemutaOrnithopterAmbassadorFixture,
    'owner' | 'beneficiary' | 'effect' | 'copied' | 'entrant' | 'token'>,
  actions: SemutaOrnithopterAmbassadorStep[] = [],
): Game {
  let game = source;
  assert.equal(game.pendingAmbassador?.stage, 'offer');
  assert.equal(game.pendingAmbassador.arrivalCause, 'movement');
  assert.equal(game.pendingAmbassador.entrant, fixture.entrant);
  assert.equal(game.pendingAmbassador.token, fixture.token);
  const event = game.pendingAmbassador.event;
  game = actSemutaOrnithopterAmbassador(game, fixture.owner,
    { type: 'decision', event, trigger: true, beneficiary: fixture.beneficiary, choice: 'effect' }, actions);
  if (fixture.copied) {
    assert.equal(game.pendingAmbassador?.stage, 'copy');
    assert.ok(game.pendingAmbassador.copyChoices.includes(fixture.effect));
    game = actSemutaOrnithopterAmbassador(game, fixture.beneficiary,
      { type: 'decision', event, effect: fixture.effect }, actions);
  }
  assert.equal(game.pendingAmbassador?.stage, 'cards');
  assert.equal(game.pendingAmbassador.effect, fixture.effect);
  assert.equal(game.pendingAmbassador.arrivalCause, 'movement');
  assert.equal(viewGame(game, fixture.beneficiary).decision?.kind, 'ecazAmbassador');
  return game;
}
