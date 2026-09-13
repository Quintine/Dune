import type { Card } from './cards';
import { defenseTypes, weaponTypes } from './battle-cards';
import type { LeaderSkillId } from './leader-skill-cards';

export type DirectLeaderSkillId =
  | 'warmaster'
  | 'master-of-assassins'
  | 'swordmaster-of-ginaz'
  | 'killer-medic'
  | 'prana-bindu-adept';

export type BattleLeaderSkill = {
  skill: LeaderSkillId;
  leader: string;
  /** Ordinary assignments are publicly face up until deliberately concealed. */
  faceUp: boolean;
  /** A captured skill grants only its attached leader's lower battle effect. */
  captured: boolean;
};

export type AppliedLeaderSkill = {
  skill: DirectLeaderSkillId;
  amount: 1 | 3;
  mode: 'normal' | 'skilled';
};

export type LeaderSkillBattleBonus = {
  bonus: number;
  applied: AppliedLeaderSkill[];
};

const directSkills = new Set<LeaderSkillId>([
  'warmaster',
  'master-of-assassins',
  'swordmaster-of-ginaz',
  'killer-medic',
  'prana-bindu-adept',
]);

function isDirectSkill(skill: string): skill is DirectLeaderSkillId {
  return directSkills.has(skill as LeaderSkillId);
}

function qualifies(
  skill: DirectLeaderSkillId,
  weapon: Card | undefined,
  defense: Card | undefined,
) {
  if (skill === 'warmaster')
    return [weapon, defense].some((card) => card?.kind === 'worthless');
  if (skill === 'master-of-assassins')
    return weaponTypes(weapon).includes('poison');
  if (skill === 'swordmaster-of-ginaz')
    return weaponTypes(weapon).includes('projectile');
  if (skill === 'killer-medic')
    return defenseTypes(defense).includes('snooper');
  return defenseTypes(defense).includes('shield');
}

/**
 * Quote the five card-role strength families after weapon survival is known.
 * Printed disc strength and bounty remain outside this additive score receipt.
 */
export function leaderSkillBattleBonus(input: {
  assignments: readonly BattleLeaderSkill[];
  /** Cheap Hero substitutes for another leader for normal +1 training only. */
  selectedLeader: { id: string; kind: 'disc' | 'hero' } | undefined;
  weapon: Card | undefined;
  defense: Card | undefined;
  skilledLeaderSurvives: boolean;
}): LeaderSkillBattleBonus {
  if (!input.selectedLeader) return { bonus: 0, applied: [] };
  const applied: AppliedLeaderSkill[] = [];
  for (const assignment of input.assignments) {
    if (!isDirectSkill(assignment.skill)) continue;
    if (!qualifies(assignment.skill, input.weapon, input.defense)) continue;
    if (
      input.selectedLeader.kind === 'disc' &&
      assignment.leader === input.selectedLeader.id &&
      (!assignment.faceUp || assignment.captured) &&
      input.skilledLeaderSurvives
    )
      applied.push({ skill: assignment.skill, amount: 3, mode: 'skilled' });
    else if (
      assignment.leader !== input.selectedLeader.id &&
      assignment.faceUp &&
      !assignment.captured
    )
      applied.push({ skill: assignment.skill, amount: 1, mode: 'normal' });
  }
  return {
    bonus: applied.reduce((sum, receipt) => sum + receipt.amount, 0),
    applied,
  };
}
