import type { PlanClaim } from './battle-promises';

// Existing structured battle-question limits, shared with authoring controls.
export const BATTLE_CLAIM_MAX_NODES = 16;
export const BATTLE_CLAIM_MAX_DEPTH = 4;
export const BATTLE_CLAIM_MAX_TERMS = 8;
export const BATTLE_CLAIM_INPUT_ERROR =
  'Choose a valid battle-plan condition (at most 16 clauses and four grouping levels).';

export function battleClaimExpressionSize(claim: PlanClaim): { nodes: number; depth: number } {
  if (claim.kind !== 'and' && claim.kind !== 'or') return { nodes: 1, depth: 0 };
  const children = claim.terms.map(battleClaimExpressionSize);
  return { nodes: 1 + children.reduce((sum, child) => sum + child.nodes, 0),
    depth: 1 + Math.max(0, ...children.map(child => child.depth)) };
}

/** Structure only; parsePlanClaim still validates every actual leaf. */
export function battleClaimExpressionError(claim: PlanClaim): string | null {
  const size = battleClaimExpressionSize(claim);
  if (size.nodes > BATTLE_CLAIM_MAX_NODES || size.depth > BATTLE_CLAIM_MAX_DEPTH)
    return BATTLE_CLAIM_INPUT_ERROR;
  const groupError = (node: PlanClaim): string | null => {
    if (node.kind !== 'and' && node.kind !== 'or') return null;
    if (node.terms.length < 2 || node.terms.length > BATTLE_CLAIM_MAX_TERMS)
      return BATTLE_CLAIM_INPUT_ERROR;
    for (const term of node.terms) {
      const error = groupError(term);
      if (error) return error;
    }
    return null;
  };
  return groupError(claim);
}
