import { parseRevivalExpression, RevivalExpressionPromiseError, type RevivalExpressionLeaf } from './revival-expression-promises';
import type { MixedActionExpression } from './mixed-action-question';

export type RevivalActionClaim = RevivalExpressionLeaf;
export type MixedRevivalClaim = { turn: number; mixed: MixedActionExpression<RevivalActionClaim> };

/** Only one exact native force or personal-leader leaf belongs in an action.
 * Mixed groups use the outer shared grammar and budget instead. */
export function parseRevivalActionClaim(value: unknown): RevivalActionClaim {
  const action = parseRevivalExpression(value);
  if (action.kind === 'forces' || action.kind === 'leader') return action;
  throw new RevivalExpressionPromiseError('Supply one ordinary force or named-leader return condition.');
}
