import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import {
  createTruthMovementBoxGholaFixture, actTruthMovementGhola,
  advanceTruthMovementGhola, truthMovementGholaClean, truthMovementGholaInventory,
  truthMovementGholaPlayer, type TruthMovementGholaStep,
} from './fixture-truth-movement-ghola';

export const semutaGholaIncomePlayer = truthMovementGholaPlayer;
export const semutaGholaIncomeInventory = truthMovementGholaInventory;
export const semutaGholaIncomeClean = truthMovementGholaClean;
export const actSemutaGholaIncome = actTruthMovementGhola;
export type SemutaGholaIncomeStep = TruthMovementGholaStep;

/** Pass only the current fresh group; do not automatically allow its suspended
 * income or any later response. Every acknowledgement is a real native action. */
export function passSemutaGholaIncome(source: Game): Game {
  const pending = source.pendingTreacheryDiscard;
  assert.equal(pending?.reaction?.stage, 'offer');
  const event = pending!.batch.event;
  let game = source;
  for (const p of source.players) {
    if (!game.pendingTreacheryDiscard?.reaction ||
        game.pendingTreacheryDiscard.reaction.stage !== 'offer') break;
    if (!game.pendingTreacheryDiscard.reaction.passed.includes(p.id))
      game = actSemutaGholaIncome(game, p.id, { type: 'semutaPass', event });
  }
  return game;
}
export function claimSemutaGholaIncome(source: Game, actor: string, card: string): Game {
  const event = source.pendingTreacheryDiscard!.batch.event;
  let game = actSemutaGholaIncome(source, actor, { type: 'semutaCommit', event });
  if (game.pendingTreacheryDiscard?.reaction?.stage === 'select')
    game = actSemutaGholaIncome(game, actor, { type: 'semutaSelect', event, card });
  return game;
}
/** Complete only actual response acknowledgements. Printed cancellation is an
 * explicit caller action, not a fixture-installed denied receipt. */
export function allowSemutaGholaIncome(source: Game): Game {
  let game = source;
  for (let count = 0; game.response && count < game.players.length; count++) {
    const player = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(player);
    game = actSemutaGholaIncome(game, player.id, { type: 'passResponse' });
  }
  assert.equal(game.response, null); return game;
}

/** Genuine native source/casualty/Box acquisition, followed by explicitly
 * controlled conserved Semuta and Karama acquisitions. No response, receipt,
 * force, wallet, phase or finished revival is installed. */
export function createSemutaGholaIncomeFixture(options: { fullHand?: boolean } = {}) {
  const original = createTruthMovementBoxGholaFixture({ tleilaxu: true });
  const owner = original.target, claimant = 'richese', incomeOwner = 'tleilaxu',
    counterOwner = original.asker;
  const actions: SemutaGholaIncomeStep[] = [...original.actions];
  const originalInventory = semutaGholaIncomeInventory(original.game);
  let game = actSemutaGholaIncome(original.game, owner, original.boxStep.action, actions);
  const search = viewGame(game, owner).nullentropy?.search;
  if (search) {
    assert.ok(search.cards.some(card => card.id === original.ghola));
    game = actSemutaGholaIncome(game, owner,
      { type: 'decision', event: search.event, card: original.ghola }, actions);
  }
  // A sole eligible card is acquired automatically by the original Box rule.
  game = advanceTruthMovementGhola(game, semutaGholaIncomeClean, actions);
  assert.ok(semutaGholaIncomePlayer(game, owner).hand.some(card => card.id === original.ghola));
  assert.equal(semutaGholaIncomePlayer(game, owner).spice, 11);
  assert.equal(game.pendingNullentropy, null);
  assert.equal(game.semutaPreview, true);
  assert.deepEqual(semutaGholaIncomeInventory(game), originalInventory);
  const afterBox = structuredClone(game);

  const cacheIndex = game.richeseCache!.findIndex(card => card.id === SEMUTA_DRUG_ID);
  assert.ok(cacheIndex >= 0, 'Acquire the original physical Semuta from its native cache');
  const semuta = game.richeseCache!.splice(cacheIndex, 1)[0];
  semutaGholaIncomePlayer(game, claimant).hand.push(semuta);
  const counterIndex = game.deck.findIndex(card => card.effect === 'karama'); assert.ok(counterIndex >= 0);
  const counter = game.deck.splice(counterIndex, 1)[0];
  semutaGholaIncomePlayer(game, counterOwner).hand.push(counter);
  if (options.fullHand) while (semutaGholaIncomePlayer(game, claimant).hand.length < 4) {
    const index = game.deck.findIndex(card => ['projectile', 'poison', 'shield', 'snooper', 'worthless'].includes(card.kind));
    assert.ok(index >= 0); semutaGholaIncomePlayer(game, claimant).hand.push(game.deck.splice(index, 1)[0]);
  }
  assert.equal(semutaGholaIncomePlayer(game, claimant).hand.length, options.fullHand ? 4 : 1);
  assert.ok(game.players.every(p => p.hand.length <= 4));
  assert.deepEqual(semutaGholaIncomeInventory(game), originalInventory);
  assert.ok(semutaGholaIncomeClean(game));
  const gholaAction: Action = { type: 'card', card: original.ghola, amount: 1, elite: 0 };
  return { game, source: original, afterBox, owner, target: owner, claimant, incomeOwner, counterOwner,
    counter: counter.id, semuta: semuta.id, ghola: original.ghola, gholaAction,
    originalInventory, actions, sourceActionCount: actions.length, fullHand: !!options.fullHand,
    staging: [...original.staging,
      'Actually pay two spice with the original held Box and recover the original publicly spent Ghola; native sole-choice completion or the original private search event owns that acquisition. Finish the Box discard through actual neutral passes before staging any Semuta holder.',
      'At the clean pre-Ghola boundary only, explicitly conserve the original cache Semuta into Richese hand and the original deck Karama into Emperor hand. The latter keeps the real Tleilaxu income response conditional. Optional full-hand cases move three original ordinary deck cards to Richese. No physical card is duplicated and no pending control, income receipt, wallet, army, phase, clock or revived outcome is installed. Future Ghola, Semuta and income actions remain caller choices.'],
  };
}
export type SemutaGholaIncomeFixture = ReturnType<typeof createSemutaGholaIncomeFixture>;
