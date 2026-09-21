import { FACTIONS } from './catalog';
import { basicMoritaniLeaderSkillsProfile, ordinaryLeaderSkillModeSupported, type LeaderSkillProfile } from './leader-skill-profile';
import type { Card, Leader } from './cards';
import { splitLocation, validGameLocation } from './board';
import { leaderSkillBattleBonus, usesSurvivingSkilledLeader, type BattleLeaderSkill } from './leader-skill-combat';

export type SmugglerBattleReceipt = {
  event: string; turn: number; territory: string; player: string; leader: string;
  frame: string; strength: number; key: string | null; before: number; amount: number;
  stage: 'pending' | 'collected' | 'void'; signature: string;
};
export function smugglerBattleModeSupported(g: LeaderSkillProfile & { players: readonly { faction: string }[] }) {
  return ordinaryLeaderSkillModeSupported(g) &&
    (basicMoritaniLeaderSkillsProfile(g) || g.players.every(p => FACTIONS.some(f => f.id === p.faction && f.expansion === 'base')));
}
export type SmugglerBattlePlan = {
  assignments: readonly BattleLeaderSkill[];
  leader?: Pick<Leader, 'id' | 'strength'>;
  weapon?: Card; defense?: Card; kwisatz?: boolean;
};
export function smugglerBattlePlanBlock(plan: SmugglerBattlePlan, supported: boolean,
  pile?: { territory: string; spice: Readonly<Record<string, number>> }): string | null {
  if (!usesSurvivingSkilledLeader(plan.assignments, 'smuggler', plan.leader?.id, true)) return null;
  if (!supported) return 'Smuggler battle collection with expansion factions or other optional modules is still being integrated.';
  if (plan.kwisatz || leaderSkillBattleBonus({ assignments: plan.assignments,
    selectedLeader: { id: plan.leader!.id, kind: 'disc' }, weapon: plan.weapon,
    defense: plan.defense, skilledLeaderSurvives: true }).bonus)
    return 'Smuggler collection with modified leader strength awaits its ruling. Choose an unmodified plan or another leader.';
  if (pile) {
    try { smugglerBattlePile(pile.territory, pile.spice); }
    catch (error) { return error instanceof Error ? error.message : 'Smuggler spice is unavailable.'; }
  }
  return null;
}
export function smugglerBattleSignature(receipt: SmugglerBattleReceipt): string {
  return JSON.stringify({ ...receipt, signature: undefined });
}
export function smugglerBattlePile(territory: string, spice: Readonly<Record<string, number>>) {
  const piles = Object.entries(spice).filter(([key]) => splitLocation(key).territory === territory);
  for (const [key, amount] of piles) {
    const at = splitLocation(key);
    if (!validGameLocation({}, at.territory, at.sector) || key !== `${at.territory}:${at.sector}` ||
      !Number.isSafeInteger(amount) || amount < 0) throw new Error('Smuggler needs a valid spice pile.');
  }
  const positive = piles.filter(([, amount]) => amount > 0);
  if (positive.length > 1) throw new Error('Smuggler collection among multiple spice piles awaits its allocation ruling.');
  return positive.length ? { key: positive[0][0], before: positive[0][1] } : { key: null, before: 0 };
}
export function createSmugglerBattle(input: {
  event: string; turn: number; territory: string; player: string; frame: string;
  plan: SmugglerBattlePlan; supported: boolean; spice: Readonly<Record<string, number>>;
}): SmugglerBattleReceipt | null {
  if (!usesSurvivingSkilledLeader(input.plan.assignments, 'smuggler', input.plan.leader?.id, true)) return null;
  const blocked = smugglerBattlePlanBlock(input.plan, input.supported);
  if (blocked) throw new Error(blocked);
  const strength = input.plan.leader!.strength;
  if (!input.event || !input.player || !Number.isSafeInteger(input.turn) || input.turn < 1 ||
    !Number.isSafeInteger(strength) || strength < 0) throw new Error('Smuggler needs the current battle and an unmodified leader.');
  const pile = smugglerBattlePile(input.territory, input.spice);
  const receipt: SmugglerBattleReceipt = { event: input.event, turn: input.turn,
    territory: input.territory, player: input.player, leader: input.plan.leader!.id,
    frame: input.frame, strength, ...pile, amount: Math.min(strength, pile.before), stage: 'pending', signature: '' };
  receipt.signature = smugglerBattleSignature(receipt);
  return receipt;
}
/** Survival controls both winning and losing leaders; this is not bank/player income. */
export function settleSmugglerBattle(receipt: SmugglerBattleReceipt, survives: boolean, spice: Readonly<Record<string, number>>) {
  if (receipt.stage !== 'pending' || receipt.signature !== smugglerBattleSignature(receipt) ||
    receipt.amount !== Math.min(receipt.strength, receipt.before) ||
    JSON.stringify(smugglerBattlePile(receipt.territory, spice)) !== JSON.stringify({ key: receipt.key, before: receipt.before }))
    throw new Error('The saved Smuggler collection changed its reveal-time spice or receipt.');
  const amount = survives ? receipt.amount : 0;
  const settled: SmugglerBattleReceipt = { ...receipt, stage: survives ? 'collected' : 'void', signature: '' };
  settled.signature = smugglerBattleSignature(settled);
  return { receipt: settled, amount, spice: receipt.key ? { ...spice, [receipt.key]: receipt.before - amount } : { ...spice } };
}
