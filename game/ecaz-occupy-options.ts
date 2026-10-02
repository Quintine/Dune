import type { Action, GameView } from './engine';
import {
  ecazOccupyDialOptions,
  quoteEcazOccupyDial,
  type EcazOccupyBattleProfile,
} from './ecaz-occupy-battle';

/** The selected lead plans and pays; the profile's force owner need not be that lead. */
export function ecazOccupyOwnProfile(game: GameView): EcazOccupyBattleProfile | null {
  const battle = game.battle;
  const occupy = battle?.ecazOccupy;
  const profile = occupy?.profile;
  return battle && occupy?.event === battle.event && profile?.planOwner === game.me
    ? profile : null;
}

export function ecazOccupyLeadOptions(game: GameView) {
  const decision = game.decision;
  const battle = game.battle;
  if (decision?.kind !== 'ecazBattleLead' || !battle?.ecazOccupy ||
    decision.event !== battle.event || decision.event !== battle.ecazOccupy.event) return [];
  const blocked = game.status !== 'playing' || game.phase !== 6
    ? 'This battle is not awaiting a lead choice.'
    : decision.player !== game.me ? 'Only Ecaz chooses the lead.' : null;
  return decision.choices.map((lead) => ({
    lead,
    label: game.players.find((player) => player.id === lead)?.name ?? lead,
    blocked,
    action: { type: 'decision', event: decision.event, lead },
  }));
}

function supportBudget(game: GameView, profile: EcazOccupyBattleProfile) {
  const personalSpice = game.players.find((player) => player.id === game.me)?.spice ?? 0;
  const bankSupport = game.battle?.strongholdEffects[profile.payer] === 'arrakeen' ? 2 : 0;
  return {
    personalSpice,
    maximum: Math.min(profile.maxSupport, personalSpice + game.aid.available + bankSupport),
  };
}

/** Only the lead's own projected funds enter affordability; never the other ally's spice. */
export function ecazOccupyDialChoices(game: GameView) {
  const profile = ecazOccupyOwnProfile(game);
  return profile ? ecazOccupyDialOptions(profile, supportBudget(game, profile).maximum) : [];
}

/** Numeric editor constraints and an explanation for an unsealable physical dial. */
export function ecazOccupyPlanControl(game: GameView, dial: number, support: number) {
  const profile = ecazOccupyOwnProfile(game);
  if (!profile) return null;
  const budget = supportBudget(game, profile);
  let blocked: string | null = null;
  let variableDial: number | null = null;
  try {
    const quote = quoteEcazOccupyDial(profile, dial, support);
    variableDial = quote.variableDial;
    if (support > budget.maximum) blocked = 'The selected lead cannot afford this spice support.';
  } catch (error) {
    blocked = error instanceof Error ? error.message : 'Choose a legal total dial and spice support.';
  }
  return {
    profile,
    minimum: profile.fixedEcazDial,
    maximum: profile.maxDial,
    step: 0.5,
    supportMaximum: budget.maximum,
    personalSpice: budget.personalSpice,
    fixedEcazDial: profile.fixedEcazDial,
    variableDial,
    blocked,
  };
}

/**
 * All four native policies share this legality adapter. Native candidate plans already
 * use the selected lead's leaders/cards and TOTAL dials; no new strategy is introduced.
 * It also serves prescience candidate generation before the ordinary plan editor opens.
 */
export function ecazOccupyPolicyActions(game: GameView, nativeCandidates: Action[] = []): Action[] {
  if (game.decision?.kind === 'ecazBattleLead') {
    return ecazOccupyLeadOptions(game).filter((option) => !option.blocked).map((option) => option.action);
  }
  if (!ecazOccupyOwnProfile(game)) return nativeCandidates;
  return nativeCandidates.filter((action) => action.type !== 'battlePlan' ||
    !ecazOccupyPlanControl(game, Number(action.dial), Number(action.support ?? 0))?.blocked);
}
