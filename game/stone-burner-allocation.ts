import {
  quoteBattleResolution,
  StoneBurnerAllocationRequiredError,
  validateStoneBurnerAllocationSelections,
  type BattleResolutionInput,
} from './battle-resolution-quote';
import type { Casualties } from './combat';

export type StoneBurnerAllocationChoice = Readonly<{
  /** Stable battle side key; may differ from the physical variable owner. */
  player: string;
  owner: string;
  totals: readonly number[];
}>;
export type StoneBurnerAllocationQuote = Readonly<{
  choices: readonly StoneBurnerAllocationChoice[];
}>;
/** Calculator-owned native variable options before either side is destroyed. */
export type StoneBurnerAllocationLoss = Readonly<{ undialed: number; losses: Casualties }>;
export { validateStoneBurnerAllocationSelections } from './battle-resolution-quote';

/** Ask only for an actual unresolved Stone outcome after original effective
 * weapons, successful traitors and withdrawals. A minimum legal completion is
 * used solely to run the same remaining validation; no outcome is selected or
 * returned by this quote and no state, resource or random stream is changed.
 * Return the original full roster even with partial/full valid commitments so
 * the caller can retain sealed simultaneous information until all are ready. */
function allocationPrerequisite(input: BattleResolutionInput): StoneBurnerAllocationRequiredError | null {
  try {
    quoteBattleResolution({ ...input, stoneAllocations: undefined });
  } catch (error) {
    if (!(error instanceof StoneBurnerAllocationRequiredError)) throw error;
    const selected = validateStoneBurnerAllocationSelections(error.choices, input.stoneAllocations);
    const completion = Object.fromEntries(error.choices.map(choice => [choice.player,
      Object.hasOwn(selected, choice.player) ? selected[choice.player] : choice.totals[0]]));
    // Reuse native funding, outcome, Occupy and physical custody validation.
    quoteBattleResolution({ ...input, stoneAllocations: completion });
    return error;
  }
  validateStoneBurnerAllocationSelections([], input.stoneAllocations);
  return null;
}
export function quoteStoneBurnerAllocations(input: BattleResolutionInput): StoneBurnerAllocationQuote | null {
  const prerequisite = allocationPrerequisite(input);
  return prerequisite ? { choices: prerequisite.choices.map(choice => ({ ...choice, totals: [...choice.totals] })) } : null;
}

/** Stable side key, including a coalition lead, selects the same original
 * variable loss options used by Stone. Fixed Ecaz and withdrawn complements
 * are already represented by the calculator's authoritative physical total. */
export function stoneBurnerCommittedLosses(input: BattleResolutionInput, player: string): readonly Casualties[] | null {
  if (!input.stoneAllocations || !Object.hasOwn(input.stoneAllocations, player)) return null;
  const prerequisite = allocationPrerequisite(input);
  return prerequisite!.losses[player]
    .filter(option => option.undialed === input.stoneAllocations![player])
    .map(option => ({ ...option.losses }));
}
