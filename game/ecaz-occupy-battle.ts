import type { FactionId } from './catalog';
import {
  casualtyOptions,
  maxCombatDial,
  maxCombatSupport,
  validCombatForces,
  type Casualties,
  type CombatForces,
} from './combat';

export class EcazOccupyBattleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EcazOccupyBattleError';
  }
}

/** Native fighter pools for an eligible whole-territory battle. The canonical
 * board quote excludes storm-obstructed armies and advisors before planning. */
export type EcazOccupyBattleSeat = Readonly<{
  id: string;
  faction: FactionId;
  ally?: string | null;
  forces: CombatForces;
  /** Original concealed Richese marker: one battle presence even when the
   * reserve-limited prospective pool is zero. Never ordinary zero fighters. */
  noFieldPresence?: true;
}>;
export type EcazOccupyBattleInput = Readonly<{
  advanced: boolean;
  /** Original battle chooser, before Ecaz selects the coalition's plan actor. */
  battleOrderActor: string;
  ecaz: EcazOccupyBattleSeat;
  ally: EcazOccupyBattleSeat;
  lead: string;
  canceled: boolean;
}>;
export type EcazOccupyBattleProfile = Readonly<{
  advanced: boolean;
  battleOrderActor: string;
  ecaz: string;
  ally: string;
  lead: string;
  planOwner: string;
  payer: string;
  forceOwner: string;
  canceled: boolean;
  ecazForces: CombatForces;
  allyForces: CombatForces;
  allyNoFieldPresence?: true;
  /** Only the variable dial's physical counters, never a merged army. */
  forces: CombatForces;
  fixedEcazDial: number;
  maxDial: number;
  maxSupport: number;
}>;
export type EcazOccupyDialQuote = {
  forceOwner: string;
  payer: string;
  fixedEcazDial: number;
  variableDial: number;
  support: number;
  options: Casualties[];
};
export type EcazOccupyDialOption = {
  dial: number;
  support: number;
  variableDial: number;
};
export type EcazOccupyOutcomeInput = Readonly<{
  result: 'normal' | 'traitor' | 'mutualTraitors' | 'explosion';
  /** Whether this coalition, not necessarily its original slot actor, won. */
  won: boolean;
  dial: number;
  support: number;
}>;
export type EcazOccupyOutcomeQuote = {
  destroyedArmies: string[];
  fixedLosses: { owner: string; normal: number; elite: number }[];
  casualties: {
    owner: string;
    forces: CombatForces;
    dial: number;
    support: number;
    options: Casualties[];
  } | null;
};

function requireBattle(condition: unknown, message: string): asserts condition {
  if (!condition) throw new EcazOccupyBattleError(message);
}
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/** Printed p8: ceil(E/2) free contribution and winning losses. Basic odd counts
 * use this provisionally under the 8 October breadth-first instruction; the
 * conflicting FAQ remains recorded, not silently promoted to a settled ruling. */
export function quoteEcazOccupyBattle(
  input: EcazOccupyBattleInput,
): EcazOccupyBattleProfile {
  const { advanced, ecaz, ally, lead, canceled, battleOrderActor } = input;
  requireBattle(
    typeof advanced === 'boolean',
    'The Occupy profile needs an explicit Basic or Advanced rules band.',
  );
  requireBattle(
    ecaz && ally && text(ecaz.id) && text(ally.id) && ecaz.id !== ally.id &&
      ecaz.faction === 'ecaz' && ally.faction !== 'ecaz' &&
      ecaz.ally === ally.id && ally.ally === ecaz.id,
    'An Occupy battle needs Ecaz and its distinct reciprocal ally.',
  );
  requireBattle(
    validCombatForces(ecaz.forces) && validCombatForces(ally.forces),
    'An Occupy battle needs valid native physical fighter pools.',
  );
  requireBattle(
    ecaz.noFieldPresence === undefined &&
      (ally.noFieldPresence === undefined ||
        ally.noFieldPresence === true && ally.faction === 'richese'),
    'Only an original concealed Richese ally may supply No-Field battle presence.',
  );
  requireBattle(
    ecaz.forces.elite === 0 && !ecaz.forces.temporaryElite &&
      !ecaz.forces.normalFixedHalf && ecaz.forces.normal > 0 &&
      (ally.forces.normal + ally.forces.elite > 0 || ally.noFieldPresence === true),
    'Both Occupy members need storm-connected fighters; Ecaz uses ordinary counters, not advisors or an elite pool.',
  );
  requireBattle(
    lead === ecaz.id || lead === ally.id,
    'The Occupy lead must be Ecaz or its participating ally.',
  );
  requireBattle(
    text(battleOrderActor),
    'The original Occupy battle-order actor must be identified.',
  );
  requireBattle(
    typeof canceled === 'boolean',
    'The Occupy profile needs its pre-plan cancellation state.',
  );
  const forceOwner = canceled ? lead : ally.id;
  const forces = forceOwner === ecaz.id ? ecaz.forces : ally.forces;
  const fixedEcazDial = canceled ? 0 : Math.ceil(ecaz.forces.normal / 2);
  return {
    advanced,
    battleOrderActor,
    ecaz: ecaz.id,
    ally: ally.id,
    lead,
    planOwner: lead,
    payer: lead,
    forceOwner,
    canceled,
    ecazForces: ecaz.forces,
    allyForces: ally.forces,
    ...(ally.noFieldPresence ? { allyNoFieldPresence: true as const } : {}),
    forces,
    fixedEcazDial,
    maxDial: fixedEcazDial + maxCombatDial(forces),
    maxSupport: maxCombatSupport(forces),
  };
}

/** The public dial includes Ecaz's mandatory increment. Support and typed
 * casualties belong only to the native variable pool; fixed strength neither
 * spends spice nor creates a CHOAM support payment. Funding is checked by the
 * caller against the selected payer's existing native funding permissions. */
export function quoteEcazOccupyDial(
  profile: EcazOccupyBattleProfile,
  dial: number,
  support: number,
): EcazOccupyDialQuote {
  requireBattle(
    Number.isFinite(dial) && Number.isSafeInteger(dial * 2) &&
      dial >= profile.fixedEcazDial && dial <= profile.maxDial,
    `The Occupy dial must include ${profile.fixedEcazDial} fixed Ecaz strength and fit the ${profile.forceOwner} fighter pool.`,
  );
  requireBattle(
    Number.isSafeInteger(support) && support >= 0 && support <= profile.maxSupport,
    `The Occupy support must fit the native ${profile.forceOwner} support rules; the fixed Ecaz contribution is free.`,
  );
  const variableDial = dial - profile.fixedEcazDial;
  const options = casualtyOptions(profile.forces, variableDial, support);
  requireBattle(
    options.length > 0,
    `The Occupy dial and support do not match a legal physical commitment by ${profile.forceOwner}.`,
  );
  return {
    forceOwner: profile.forceOwner,
    payer: profile.payer,
    fixedEcazDial: profile.fixedEcazDial,
    variableDial,
    support,
    options,
  };
}

/** Legal physical commitments, limited by the selected lead's available
 * support funding. Native payment permissions remain the caller's concern. */
export function ecazOccupyDialOptions(
  profile: EcazOccupyBattleProfile,
  availableSupport: number,
): EcazOccupyDialOption[] {
  requireBattle(
    Number.isSafeInteger(availableSupport) && availableSupport >= 0,
    'Available Occupy support must be a nonnegative whole spice amount.',
  );
  const options: EcazOccupyDialOption[] = [];
  const maximumSupport = Math.min(availableSupport, profile.maxSupport);
  for (let halfDial = profile.fixedEcazDial * 2;
    halfDial <= profile.maxDial * 2; halfDial++) {
    const dial = halfDial / 2;
    const variableDial = dial - profile.fixedEcazDial;
    for (let support = 0; support <= maximumSupport; support++) {
      if (casualtyOptions(profile.forces, variableDial, support).length > 0)
        options.push({ dial, support, variableDial });
    }
  }
  return options;
}

/** Force settlement only: leader deaths, cards, payments and bounty remain
 * native battle outcomes. Karama's canceled winner keeps the other member's
 * undialed army; canceled losing-side destruction follows the general rule. */
export function quoteEcazOccupyOutcome(
  profile: EcazOccupyBattleProfile,
  input: EcazOccupyOutcomeInput,
): EcazOccupyOutcomeQuote {
  requireBattle(
    ['normal', 'traitor', 'mutualTraitors', 'explosion'].includes(input.result) &&
      typeof input.won === 'boolean',
    'The Occupy aftermath needs an actual native battle result and winning side.',
  );
  requireBattle(
    !input.won || input.result === 'normal' || input.result === 'traitor',
    'Mutual traitors and explosions have no Occupy winner.',
  );
  const dial = quoteEcazOccupyDial(profile, input.dial, input.support);
  if (!input.won)
    return {
      destroyedArmies: [profile.ecaz, profile.ally],
      fixedLosses: [],
      casualties: null,
    };
  if (input.result === 'traitor')
    return { destroyedArmies: [], fixedLosses: [], casualties: null };
  return {
    destroyedArmies: [],
    fixedLosses: profile.canceled ? [] : [{
      owner: profile.ecaz,
      normal: profile.fixedEcazDial,
      elite: 0,
    }],
    casualties: {
      owner: profile.forceOwner,
      forces: profile.forces,
      dial: dial.variableDial,
      support: dial.support,
      options: dial.options,
    },
  };
}
