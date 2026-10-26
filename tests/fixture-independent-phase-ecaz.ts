import assert from 'node:assert/strict';
import { viewGame, type Game } from '../game/engine';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import { HARASS_WITHDRAW_CARD, defaultHarassWithdrawAllocation } from '../game/harass-withdraw';
import { stageEcazOccupyCard } from './fixture-ecaz-occupy';
import {
  createPhaseModuleEcazFixture, actPhaseModuleEcaz as act, advancePhaseModuleEcaz as advance,
  phaseModuleEcazClean as clean, phaseModuleEcazInventory as inventory, quotePhaseModuleEcazBattle,
  type PhaseModuleEcazStep,
} from './fixture-phase-module-ecaz';

/** Controlled physical card/army supplement after real public setup, alliance
 * and earned card. Every original wallet/phase/token owner remains native. */
export function createIndependentPhaseEcazFixture(options: { advanced?: boolean; lead?: 'ecaz' | 'ally' } = {}) {
  const f = createPhaseModuleEcazFixture({ ...options, independent: true });
  const game = structuredClone(f.game);
  stageEcazOccupyCard(game, f.actor, card => card.id === REINFORCEMENTS_CARD);
  stageEcazOccupyCard(game, f.actor, card => card.id === HARASS_WITHDRAW_CARD);
  const planActions = f.planActions.map(step => step.actor === f.actor
    ? { actor: step.actor, action: { ...step.action, weapon: REINFORCEMENTS_CARD, defense: HARASS_WITHDRAW_CARD } } : step);
  assert.deepEqual(inventory(game), f.originalInventory);
  return { ...f, game, rawGame: structuredClone(game), planActions,
    staging: [...f.staging,
      'CONTROLLED conserved original Reinforcements and Harass & Withdraw custody replaces the selected plan slots; the unused Shield remains held. Neither special was acquired through a claimed native purchase. No fee, return, card disposal or token transfer is installed.'] };
}
export type IndependentPhaseEcazFixture = ReturnType<typeof createIndependentPhaseEcazFixture>;

export function resolveIndependentPhaseEcaz(f: IndependentPhaseEcazFixture, state: Game = structuredClone(f.game)) {
  const actions: PhaseModuleEcazStep[] = [];
  let game = state;
  for (const step of f.planActions) game = act(game, step.actor, step.action, actions);
  assert.ok(game.battle?.revealed);
  while (game.decision?.kind === 'harassWithdraw') {
    const decision = game.decision;
    const offer = viewGame(game, decision.player).battle!.harassAllocation; assert.ok(offer);
    const returns = defaultHarassWithdrawAllocation(offer.context, offer.dial, offer.support);
    game = act(game, decision.player, { type: 'decision', event: decision.event, returns }, actions);
  }
  const revealed = structuredClone(game), quote = quotePhaseModuleEcazBattle(game);
  game = advance(game, state => !state.battle && clean(state), actions);
  return { game, revealed, quote, actions };
}
