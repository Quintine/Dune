import {
  BATTLE_CLAIM_MAX_DEPTH, BATTLE_CLAIM_MAX_NODES, BATTLE_CLAIM_MAX_TERMS,
} from './battle-claim-expression';
import { parsePlanClaim, PlanClaimError, type PlanClaim } from './battle-promises';
import type { MixedActionExpression } from './mixed-action-question';

export const MIXED_BATTLE_MAX_NODES = BATTLE_CLAIM_MAX_NODES;
export const MIXED_BATTLE_MAX_TERMS = BATTLE_CLAIM_MAX_TERMS;
export const MIXED_BATTLE_MAX_DEPTH = BATTLE_CLAIM_MAX_DEPTH;
export const MIXED_BATTLE_MAX_LEAVES = BATTLE_CLAIM_MAX_NODES;

export type MixedBattleActionClaim = Exclude<PlanClaim, { kind: 'and' | 'or' }>;
export type MixedBattleClaim = {
  battle: string | null;
  territory: string;
  mixed: MixedActionExpression<MixedBattleActionClaim>;
};

/** One native plan leaf only; mixed groups share the outer logical budget. */
export function parseBattleActionClaim(
  value: unknown,
  leaders: readonly string[],
): MixedBattleActionClaim {
  const fail = (): never => {
    throw new PlanClaimError('Supply one original battle-plan condition without metadata or groups.');
  };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  const node = value as Record<string, unknown>;
  const keys = node.kind === 'dial' || node.kind === 'support' ? 'compare,kind,value'
    : node.kind === 'weapon' || node.kind === 'defense' ? 'kind,name'
      : node.kind === 'leader' ? 'kind,leader'
        : node.kind === 'kwisatz' ? 'kind,use' : null;
  if (keys === null || Object.keys(node).sort().join(',') !== keys) return fail();
  const action = parsePlanClaim(node, [...leaders]);
  if (action.kind === 'dial' || action.kind === 'support' || action.kind === 'weapon' ||
    action.kind === 'defense' || action.kind === 'leader' || action.kind === 'kwisatz') return action;
  return fail();
}
