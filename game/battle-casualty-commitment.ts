import { casualtyOptions, type CombatForces } from './combat';

/** Printed physical commitments survive later card disposal and native aftercare. */
export type BattleCasualtyConstraint = {
  fullyCommitted?: true;
  physicalLossCount?: number;
};

export function casualtyConstraintFields(constraint: BattleCasualtyConstraint) {
  return {
    ...(constraint.fullyCommitted ? {fullyCommitted:true as const} : {}),
    ...(constraint.physicalLossCount !== undefined ? {physicalLossCount:constraint.physicalLossCount} : {}),
  };
}

export function committedCasualtyOptions(forces: CombatForces, dial: number, support: number,
  constraint: BattleCasualtyConstraint = {}) {
  const {fullyCommitted, physicalLossCount} = constraint;
  if ((fullyCommitted !== undefined && fullyCommitted !== true) ||
    (physicalLossCount !== undefined && (!Number.isSafeInteger(physicalLossCount) ||
      physicalLossCount < 0 || physicalLossCount > forces.normal + forces.elite))) return [];
  return casualtyOptions(forces, dial, support).filter(option =>
    (!fullyCommitted || option.normal === forces.normal && option.elite === forces.elite) &&
    (physicalLossCount === undefined || option.normal + option.elite === physicalLossCount));
}
