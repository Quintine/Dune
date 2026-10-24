import { DUKE_VIDAL_ID } from './duke-vidal';
import { CHEAP_HERO_TRAITOR } from './traitors';

/** A current unrevealed card identity, never a promise to retain or reveal it. */
export type FaceDancerFact = { kind: 'faceDancer'; leader: string };

/** The caller supplies this game's canonical physical Traitor identities. */
export function parseFaceDancerFact(
  value: unknown,
  allowedIdentities: readonly string[],
): FaceDancerFact {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Choose a current unrevealed Face Dancer identity fact.');
  const input = value as Record<string, unknown>;
  const keys = Reflect.ownKeys(input);
  if (keys.length !== 2 || !keys.includes('kind') || !keys.includes('leader') ||
      input.kind !== 'faceDancer')
    throw new Error('Choose only a current unrevealed Face Dancer identity fact.');
  if (typeof input.leader !== 'string' || !input.leader.trim() ||
      input.leader === DUKE_VIDAL_ID || !allowedIdentities.includes(input.leader))
    throw new Error('Choose a physical Traitor identity in this game for the Face Dancer fact.');
  return { kind: 'faceDancer', leader: input.leader };
}

/** Ordinary Traitor cards and already revealed or returned Face Dancers do not count. */
export function faceDancerFactMatches(
  holder: { faceDancers?: readonly { leader: string; revealed: boolean }[] },
  fact: FaceDancerFact,
): boolean {
  return holder.faceDancers?.some(card => card.leader === fact.leader && card.revealed === false) ?? false;
}

export function faceDancerFactText(
  fact: FaceDancerFact,
  leaderName: (id: string) => string,
): string {
  const name = fact.leader === CHEAP_HERO_TRAITOR ? 'Cheap Hero / Heroine' : leaderName(fact.leader);
  return `you currently hold ${name} as an unrevealed Face Dancer`;
}
