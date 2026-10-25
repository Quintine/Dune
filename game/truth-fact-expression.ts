import type { TruthFact } from './truthtrance';

// Existing parser limits. These bound structured input; they are not printed
// restrictions on which game-related yes/no questions may be asked.
export const TRUTH_FACT_MAX_NODES = 16;
export const TRUTH_FACT_MAX_DEPTH = 4;
export const TRUTH_FACT_MAX_TERMS = 8;
export const TRUTH_FACT_SIZE_ERROR =
  'Truthtrance supports at most 16 clauses and four levels of grouping.';
export const TRUTH_FACT_GROUP_ERROR =
  'Combine two to eight fact clauses with AND or OR.';

export function truthFactExpressionSize(fact: TruthFact): { nodes: number; depth: number } {
  if (fact.kind !== 'and' && fact.kind !== 'or') return { nodes: 1, depth: 0 };
  const children = fact.terms.map(truthFactExpressionSize);
  return {
    nodes: 1 + children.reduce((sum, child) => sum + child.nodes, 0),
    depth: 1 + Math.max(0, ...children.map(child => child.depth)),
  };
}

/** Structural input feedback; leaf eligibility remains with the existing
 * entitled field validators and the authoritative question parser. */
export function truthFactExpressionError(fact: TruthFact): string | null {
  const size = truthFactExpressionSize(fact);
  if (size.nodes > TRUTH_FACT_MAX_NODES || size.depth > TRUTH_FACT_MAX_DEPTH)
    return TRUTH_FACT_SIZE_ERROR;
  const groupError = (node: TruthFact): string | null => {
    if (node.kind !== 'and' && node.kind !== 'or') return null;
    if (node.terms.length < 2 || node.terms.length > TRUTH_FACT_MAX_TERMS)
      return TRUTH_FACT_GROUP_ERROR;
    for (const term of node.terms) {
      const error = groupError(term);
      if (error) return error;
    }
    return null;
  };
  return groupError(fact);
}
