import type { Card } from './cards';
import {
  defenseTypes,
  isDefenseCard,
  validBattleCardPair,
  weaponTypes,
} from './battle-cards';
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
  skill: DirectLeaderSkillId | 'planetologist' | 'mentat' | 'spice-banker';
  amount: 1 | 2 | 3;
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

/**
 * Canonical GF9 base-deck green Special cards. Persisted IDs distinguish these
 * physical components from expansion cards sharing the engine's broad
 * `special` bucket. Cheap Hero and Cheap Heroine occupy the leader slot and
 * are deliberately absent.
 */
export const PLANETOLOGIST_BASE_SPECIALS = [
  { id: 'treachery-24', name: 'Family Atomics', effect: 'atomics' },
  { id: 'treachery-25', name: 'Weather Control', effect: 'weather' },
  { id: 'treachery-26', name: 'Hajr', effect: 'hajr' },
  { id: 'treachery-27', name: 'Tleilaxu Ghola', effect: 'ghola' },
  { id: 'treachery-28', name: 'Harvester', effect: 'harvester' },
  { id: 'treachery-29', name: 'Karama', effect: 'karama' },
  { id: 'treachery-30', name: 'Karama', effect: 'karama' },
  { id: 'treachery-31', name: 'Truthtrance', effect: 'truthtrance' },
  { id: 'treachery-32', name: 'Truthtrance', effect: 'truthtrance' },
] as const;

const planetologistBaseSpecialById = new Map<
  string,
  (typeof PLANETOLOGIST_BASE_SPECIALS)[number]
>(
  PLANETOLOGIST_BASE_SPECIALS.map((card) => [card.id, card]),
);

/** Shared engine/UI/bot eligibility: exact printed base component, no native use. */
export function isPlanetologistBattleSpecialCard(
  card: Pick<Card, 'id' | 'name' | 'kind' | 'effect'> | undefined,
): boolean {
  if (!card || card.kind !== 'special') return false;
  const canonical = planetologistBaseSpecialById.get(card.id);
  return (
    canonical?.name === card.name &&
    canonical.effect === card.effect
  );
}

/** The substitute role belongs only to the actual assigned leader in battle. */
export function canUsePlanetologistBattleSpecial(input: {
  assignments: readonly BattleLeaderSkill[];
  selectedLeader: string | null | undefined;
  card: Pick<Card, 'id' | 'name' | 'kind' | 'effect'> | undefined;
}): boolean {
  return (
    isPlanetologistBattleSpecialCard(input.card) &&
    !!input.selectedLeader &&
    input.assignments.some(
      (assignment) =>
        assignment.skill === 'planetologist' &&
        assignment.leader === input.selectedLeader &&
        (!assignment.faceUp || assignment.captured),
    )
  );
}

/** Planetologist fills the slot without becoming an actual Weapon card. */
export function validLeaderSkillBattleCardPair(
  weapon: Card | undefined,
  defense: Card | undefined,
  planetologistWeapon: boolean,
): boolean {
  if (!planetologistWeapon) return validBattleCardPair(weapon, defense);
  return (
    (!defense || isDefenseCard(defense)) &&
    defense?.kind !== 'weirdingWay'
  );
}

function isDirectSkill(skill: string): skill is DirectLeaderSkillId {
  return directSkills.has(skill as LeaderSkillId);
}

/** A captive grants only this actual disc's lower effect, never a normal effect. */
export function usesSurvivingSkilledLeader(
  assignments: readonly BattleLeaderSkill[],
  skill: LeaderSkillId,
  leader: string | undefined | null,
  survives: boolean,
): boolean {
  return survives && !!leader && assignments.some((a) =>
    a.skill === skill && a.leader === leader && (!a.faceUp || a.captured));
}

/** Bureaucrat changes the opponent's total, not either leader disc or bounty. */
export function bureaucratBattlePenalty(
  assignments: readonly BattleLeaderSkill[],
  leader: string | undefined | null,
  survives: boolean,
  opponentStrongholds: number | undefined,
): number {
  if (!usesSurvivingSkilledLeader(assignments, 'bureaucrat', leader, survives)) return 0;
  if (opponentStrongholds === undefined || !Number.isSafeInteger(opponentStrongholds) || opponentStrongholds < 0)
    throw new Error('Bureaucrat needs a valid occupied stronghold count.');
  return opponentStrongholds;
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
  bankerSpice?: number;
}): LeaderSkillBattleBonus {
  if (!input.selectedLeader) return { bonus: 0, applied: [] };
  const applied: AppliedLeaderSkill[] = [];
  if (input.bankerSpice && Number.isSafeInteger(input.bankerSpice) && input.bankerSpice >= 1 && input.bankerSpice <= 3 &&
    input.selectedLeader.kind === 'disc' && usesSurvivingSkilledLeader(input.assignments, 'spice-banker', input.selectedLeader.id, input.skilledLeaderSurvives))
    applied.push({ skill: 'spice-banker', amount: input.bankerSpice as 1 | 2 | 3, mode: 'skilled' });
  if (input.selectedLeader.kind === 'disc' && usesSurvivingSkilledLeader(
    input.assignments, 'mentat', input.selectedLeader.id, input.skilledLeaderSurvives,
  )) applied.push({ skill: 'mentat', amount: 2, mode: 'skilled' });
  if (
    input.selectedLeader.kind === 'disc' &&
    input.skilledLeaderSurvives &&
    canUsePlanetologistBattleSpecial({
      assignments: input.assignments,
      selectedLeader: input.selectedLeader.id,
      card: input.weapon,
    })
  )
    applied.push({
      skill: 'planetologist',
      amount: 2,
      mode: 'skilled',
    });
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
