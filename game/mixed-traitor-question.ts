import type { CompiledMixedAction, MixedActionExpression } from './mixed-action-question';
import { TraitorDecisionError } from './traitor-decision-promises';

export const MIXED_TRAITOR_MAX_LEAVES = 16;
export const MIXED_TRAITOR_MAX_DEPTH = 4;
export type TraitorActionClaim = { call: boolean };
export type MixedTraitorClaim = {
  battle: string;
  territory: string;
  mixed: MixedActionExpression<TraitorActionClaim>;
};

/** One original native declaration; source and frozen metadata stay outside. */
export function parseTraitorActionClaim(value: unknown): TraitorActionClaim {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    Object.keys(value).join(',') !== 'call' || typeof (value as Record<string, unknown>).call !== 'boolean')
    throw new TraitorDecisionError('Supply one Reveal or Decline condition without battle metadata or groups.');
  return { call: (value as TraitorActionClaim).call };
}

type TraitorOutcomes = { decline: boolean; reveal: boolean };
function declarationOutcomes(node: CompiledMixedAction<TraitorActionClaim>): TraitorOutcomes {
  if (node.kind === 'constant') return { decline: node.value, reveal: node.value };
  if (node.kind === 'action') {
    const { call } = parseTraitorActionClaim(node.action);
    return { decline: !call, reveal: call };
  }
  // Evaluate every child before combining, including correlated opposite calls.
  const terms = node.terms.map(declarationOutcomes);
  return node.kind === 'and'
    ? { decline: terms.every(term => term.decline), reveal: terms.every(term => term.reveal) }
    : { decline: terms.some(term => term.decline), reveal: terms.some(term => term.reveal) };
}

/** Exact logical residual over both declarations. The caller intersects a forced
 * choice with native eligibility; current inability to Reveal must not erase a
 * forced Decline that remains binding after a later matching Traitor draw. */
export function mixedTraitorRequirement(
  node: CompiledMixedAction<TraitorActionClaim>,
  answer: boolean,
): { possible: false } | { possible: true; call: boolean | null } {
  if (typeof answer !== 'boolean') throw new TraitorDecisionError('Choose a definite mixed Traitor answer.');
  const outcomes = declarationOutcomes(node);
  const decline = outcomes.decline === answer, reveal = outcomes.reveal === answer;
  if (!decline && !reveal) return { possible: false };
  return { possible: true, call: decline && reveal ? null : reveal };
}
