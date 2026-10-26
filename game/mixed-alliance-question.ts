import { AlliancePromiseError, parseAllianceClaim } from './alliance-promises';
import type { MixedActionExpression } from './mixed-action-question';

export type AllianceActionClaim = { partner: string };
export type MixedAllianceClaim = { turn: number; mixed: MixedActionExpression<AllianceActionClaim> };

/** One exact final partner only. Turn/source/compiled metadata belong to the
 * outer current-Nexus question or its private answer-time binding. */
export function parseAllianceActionClaim(value: unknown): AllianceActionClaim {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).join(',') !== 'partner')
    throw new AlliancePromiseError('Supply one exact final alliance partner without turn or Nexus metadata.');
  const { partner } = parseAllianceClaim({ turn: 1, partner: (value as Record<string, unknown>).partner });
  return { partner };
}
