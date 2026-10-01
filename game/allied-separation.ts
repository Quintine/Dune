export type AlliedSeparationQuoteContext = Readonly<{
  advanced: boolean;
  turn: number;
  player: string;
  ally: string | null;
  playerAllySinceTurn?: number;
  allySinceTurn?: number;
  remaining: readonly string[];
  territories: readonly Readonly<{
    territory: string;
    polar: boolean;
    ownPresent: boolean;
    allyPresent: boolean;
    ownAdvisors: boolean;
    allyAdvisors: boolean;
    ecazCoexist: boolean;
  }>[];
}>;

/**
 * Quote the ending player's loss territories, not casualties or force custody.
 * The engine supplies canonical presence, advisor stance and Ecaz coexistence.
 * Advanced separates at every player's end; Basic retains its legacy timing.
 */
export function quoteAlliedSeparation(
  context: AlliedSeparationQuoteContext,
): string[] {
  if (!context.ally) return [];
  if (
    !context.advanced &&
    (context.remaining.includes(context.ally) ||
      (context.playerAllySinceTurn === context.turn &&
        context.allySinceTurn === context.turn))
  )
    return [];

  const territories: string[] = [];
  for (const group of context.territories) {
    if (
      group.polar ||
      !group.ownPresent ||
      !group.allyPresent ||
      group.ecazCoexist ||
      (context.advanced && (group.ownAdvisors || group.allyAdvisors))
    )
      continue;
    territories.push(group.territory);
  }
  return territories;
}
