/** Already-authorized private projection, never an authoritative game or player. */
export type KwisatzDisplayState = Readonly<{
  active: boolean;
  dead: boolean;
  losses: number;
  usedAt?: string;
}>;

export type KwisatzBattleContext = Readonly<{
  territory: string;
  blocked: boolean;
}>;

/** Explanatory text only. The server continues to validate every battle plan. */
export function kwisatzAvailability(
  state: KwisatzDisplayState,
  battle?: KwisatzBattleContext,
): string {
  if (state.dead) return 'In the Tleilaxu Tanks. Revive before using in battle.';
  if (!state.active) return 'Not yet available. Atreides must lose seven forces in battle.';
  if (battle?.blocked) return 'Karama prevents the bonus and traitor protection in this battle.';
  if (state.usedAt && battle && state.usedAt !== battle.territory)
    return 'Already used in another territory this turn.';
  if (state.usedAt)
    return 'May be used again in the same territory this turn.';
  return 'Awakened. May accompany a leader or Cheap Hero in battle.';
}

export const KWISATZ_RULES = [
  'In the Advanced game, count Atreides forces lost in battles. After seven losses, Kwisatz Haderach becomes available for later battles. Storm and worm losses do not count.',
  'Include the counter with a leader or Cheap Hero in a sealed battle plan. It adds two to the leader’s strength only if that leader or hero survives. The accompanying leader or hero cannot turn traitor.',
  'Use it in only one territory per turn; it may join more than one battle in that territory. It cannot fight without an accompanying leader or hero.',
  'An ordinary companion death removes the bonus but does not kill Kwisatz Haderach or add two to the leader’s death bounty. A played Kwisatz Haderach dies only when a lasgun–shield explosion actually resolves; a successful traitor result takes precedence.',
  'Revive it separately from its accompanying leader. Normal revival costs two spice before discounts, requires the permitted Atreides leader revival cycle and uses the normal leader allowance. Ghola can revive it without that allowance and permits use in another territory that turn.',
  'Stone Burner and Artillery can suppress its strength contribution in their battle comparisons. Traitor protection does not prevent a Face Dancer replacement.',
  'A Karama cancellation removes both its extra strength and its traitor protection for that battle. Inspecting this component does not commit a battle plan.',
] as const;
