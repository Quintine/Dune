import {
  usesSurvivingSkilledLeader,
  type BattleLeaderSkill,
} from './leader-skill-combat';

export class SpiceBankerError extends Error {}

/** The same development boundary applies to declarations, saved plans, controls and bots. */
export function spiceBankerModeSupported(game: {
  expansions: readonly string[];
  homeworlds?: unknown;
  nexusCards?: unknown;
  discoveries?: unknown;
  discoveryEnabled?: boolean;
  strongholdCards?: unknown;
  techTokens?: unknown;
}): boolean {
  return (
    !game.expansions.length &&
    !game.homeworlds &&
    !game.nexusCards &&
    !game.discoveries &&
    !game.discoveryEnabled &&
    !game.strongholdCards &&
    !game.techTokens
  );
}

export function spiceBankerBattleMaximum(
  assignments: readonly BattleLeaderSkill[],
  leader: string | null | undefined,
  ownSpice: number,
  ownSupport = 0,
): number {
  if (!usesSurvivingSkilledLeader(assignments, 'spice-banker', leader, true))
    return 0;
  if (
    !Number.isSafeInteger(ownSpice) ||
    !Number.isSafeInteger(ownSupport) ||
    ownSpice < 0 ||
    ownSupport < 0
  )
    return 0;
  return Math.max(0, Math.min(3, ownSpice - ownSupport));
}

/** Banker funds are separate from force support and remain behind the shield until settlement. */
export function validateSpiceBankerSpend(
  assignments: readonly BattleLeaderSkill[],
  leader: string | null | undefined,
  amount: unknown,
  ownSpice: number,
  ownSupport = 0,
): number {
  const spend = amount === undefined ? 0 : amount;
  if (
    typeof spend !== 'number' ||
    !Number.isSafeInteger(spend) ||
    spend < 0 ||
    spend > 3
  )
    throw new SpiceBankerError(
      'Choose zero to decline, or one through three spice for Spice Banker.',
    );
  if (
    spend > spiceBankerBattleMaximum(assignments, leader, ownSpice, ownSupport)
  )
    throw new SpiceBankerError(
      'Spice Banker needs the selected skilled leader and enough own spice after force support.',
    );
  return spend;
}
