import type { Card } from './cards';
import type { FactionId } from './catalog';

export type EcazSpecialKaramaPlan = {
  weapon: string | null;
  defense: string | null;
};

/** Store this normalized declaration on the battle, not on a hidden plan. */
export type EcazSpecialKaramaDeclaration = {
  event: string;
  owner: string;
  card: string;
};

export type EcazSpecialKaramaContext = {
  status: string;
  phase: number;
  advanced: boolean;
  owner: {
    id: string;
    faction: FactionId;
    specialKaramaUsed?: boolean;
  };
  /** Authoritative owned, unreserved, actual Karama cards supplied by the engine. */
  cards: readonly Card[];
  battle: {
    event?: string;
    attacker: string;
    defender: string;
    revealed: boolean;
    /** Only this owner's sealed plan; omit/null means it has not been sealed. */
    ownPlan?: EcazSpecialKaramaPlan | null;
    declaration?: EcazSpecialKaramaDeclaration | null;
  } | null;
};

/** Private owner-only projection; it contains no opposing leader or plan data. */
export type EcazSpecialKaramaQuote = {
  event: string | null;
  blocked: string | null;
  cards: readonly Card[];
  declared: boolean;
};

export class EcazSpecialKaramaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EcazSpecialKaramaError';
  }
}

/** Revised Dune Rulebook v2.3, physical p. 30, Ecaz G: neither card slot may be used. */
export function ecazSpecialKaramaPlanAllowed(plan: EcazSpecialKaramaPlan): boolean {
  return plan.weapon === null && plan.defense === null;
}

/**
 * Revised Dune Rulebook v2.3, physical p. 30, Ecaz G allows play before reveal.
 * An unsealed own plan does not block declaration; the engine must enforce the
 * empty-slot commitment when that plan is later sealed or changed. No opponent
 * plan, leader or hidden inspection is an input to eligibility.
 */
export function quoteEcazSpecialKarama(
  context: EcazSpecialKaramaContext,
): EcazSpecialKaramaQuote {
  const { battle, owner } = context;
  const event = battle?.event || null;
  const declared = !!(
    event &&
    battle?.declaration?.event === event &&
    battle.declaration.owner === owner.id
  );
  let blocked: string | null = null;
  if (declared) blocked = 'Your Ecaz special Karama is already declared for this battle.';
  else if (!context.advanced) blocked = 'Special Karama powers require the Advanced game.';
  else if (owner.faction !== 'ecaz') blocked = 'Only native Ecaz may declare this special Karama.';
  else if (context.status !== 'playing' || context.phase !== 6 || !battle || !event)
    blocked = 'Declare this special Karama in your current battle before plans are revealed.';
  else if (battle.attacker !== owner.id && battle.defender !== owner.id)
    blocked = 'You must be a combatant in the current battle.';
  else if (battle.revealed) blocked = 'Battle Plans have already been revealed.';
  else if (owner.specialKaramaUsed) blocked = 'Your special Karama power has already been used this game.';
  else if (battle.ownPlan && !ecazSpecialKaramaPlanAllowed(battle.ownPlan))
    blocked = 'Your sealed Battle Plan must contain neither a weapon nor a defense.';
  else if (context.cards.length === 0) blocked = 'You need an available Karama card.';
  return { event, blocked, cards: context.cards, declared };
}

/** Pure preflight only: resource cost, once-use and delayed execution belong to the engine. */
export function quoteEcazSpecialKaramaDeclaration(
  context: EcazSpecialKaramaContext,
  selection: { event: string; card: string },
): EcazSpecialKaramaDeclaration {
  const quote = quoteEcazSpecialKarama(context);
  if (quote.blocked) throw new EcazSpecialKaramaError(quote.blocked);
  if (!quote.event || selection.event !== quote.event)
    throw new EcazSpecialKaramaError('Choose the exact current battle event for this declaration.');
  if (!quote.cards.some((card) => card.id === selection.card))
    throw new EcazSpecialKaramaError('Choose one of your available Karama cards.');
  return { event: quote.event, owner: context.owner.id, card: selection.card };
}

/**
 * Ecaz G (p. 30) says to add the leader-disc difference to the number dialed.
 * Provisional prototype policy, not a publisher ruling: use the absolute
 * printed/copied disc-value difference as virtual dial strength only. Caller
 * supplies authoritative revealed disc values (including Zoal's copied value),
 * excluding KH, skills and other strength modifiers. Add this result to battle
 * strength, never to physical counters, spice support or dialed casualties.
 * Existing traitor/explosion outcome precedence remains the engine's concern.
 */
export function ecazSpecialKaramaBonus(
  ownDiscValue: number,
  opposingDiscValue: number,
): number {
  return Math.abs(ownDiscValue - opposingDiscValue);
}
