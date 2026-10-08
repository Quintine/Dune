import { FACTIONS } from './catalog';
import { nativeExpansionLeaderSkillsProfile, ordinaryLeaderSkillModeSupported, type LeaderSkillProfile } from './leader-skill-profile';
import type { Card, Leader } from './cards';
import { splitLocation, validGameLocation } from './board';
import { leaderSkillBattleBonus, usesSurvivingSkilledLeader, type BattleLeaderSkill } from './leader-skill-combat';

export type SmugglerBattleReceipt = {
  event: string; turn: number; territory: string; player: string; leader: string;
  frame: string; strength: number; key: string | null; before: number; amount: number;
  piles?: Record<string, number>; allocations?: Record<string, number>;
  stage: 'pending' | 'collected' | 'void'; signature: string;
};
export type SmugglerBattleCollectionOffer = {
  event: string; player: string; territory: string; amount: number; piles: Record<string, number>;
};

/** Minimal legal participation; strategy must not invent hidden pile information. */
export function defaultSmugglerBattleAllocation(piles: Readonly<Record<string, number>>, amount: number) {
  const allocations: Record<string, number> = {};
  let remaining = amount;
  for (const key of Object.keys(piles).sort()) {
    const collected = Math.min(remaining, piles[key]);
    if (collected > 0) allocations[key] = collected;
    remaining -= collected;
    if (!remaining) break;
  }
  return allocations;
}
export function smugglerBattleModeSupported(g: LeaderSkillProfile & { players: readonly { faction: string }[] }) {
  return ordinaryLeaderSkillModeSupported(g) &&
    (nativeExpansionLeaderSkillsProfile(g) || g.players.every(p => FACTIONS.some(f => f.id === p.faction && f.expansion === 'base')));
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
export function smugglerBattlePile(territory: string, spice: Readonly<Record<string, number>>): {
  key: string | null; before: number; piles?: Record<string, number>;
} {
  const piles = Object.entries(spice).filter(([key]) => splitLocation(key).territory === territory);
  for (const [key, amount] of piles) {
    const at = splitLocation(key);
    if (!validGameLocation({}, at.territory, at.sector) || key !== `${at.territory}:${at.sector}` ||
      !Number.isSafeInteger(amount) || amount < 0) throw new Error('Smuggler needs a valid spice pile.');
  }
  const positive = piles.filter(([, amount]) => amount > 0).sort(([a], [b]) => a.localeCompare(b));
  const before = positive.reduce((total, [, amount]) => total + amount, 0);
  if (!Number.isSafeInteger(before)) throw new Error('Smuggler needs a safe aggregate spice amount.');
  return positive.length > 1 ? { key: null, before, piles: Object.fromEntries(positive) } :
    positive.length ? { key: positive[0][0], before } : { key: null, before: 0 };
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
function recordedPiles(receipt: SmugglerBattleReceipt): Record<string, number> {
  return receipt.piles ?? (receipt.key ? { [receipt.key]: receipt.before } : {});
}
function validateSmugglerBattleReceipt(receipt: SmugglerBattleReceipt) {
  if (receipt.stage !== 'pending' || receipt.signature !== smugglerBattleSignature(receipt) ||
    !Number.isSafeInteger(receipt.strength) || receipt.strength < 0 ||
    !Number.isSafeInteger(receipt.before) || receipt.before < 0 ||
    receipt.amount !== Math.min(receipt.strength, receipt.before))
    throw new Error('The saved Smuggler collection changed its reveal-time spice or receipt.');
  const snapshot = smugglerBattlePile(receipt.territory, recordedPiles(receipt));
  if (snapshot.key !== receipt.key || snapshot.before !== receipt.before ||
    (!!snapshot.piles !== !!receipt.piles) ||
    (receipt.piles && Object.keys(receipt.piles).length !== Object.keys(snapshot.piles!).length))
    throw new Error('The saved Smuggler collection changed its reveal-time spice or receipt.');
  if (receipt.allocations !== undefined) normalizeSmugglerBattleAllocation(receipt, receipt.allocations);
}
function normalizeSmugglerBattleAllocation(receipt: SmugglerBattleReceipt,
  allocations: Record<string, number>): Record<string, number> {
  if (!allocations || typeof allocations !== 'object' || Array.isArray(allocations))
    throw new Error('Choose a Smuggler allocation among the revealed spice piles.');
  const piles = recordedPiles(receipt);
  let total = 0;
  for (const [key, amount] of Object.entries(allocations)) {
    if (!Object.prototype.hasOwnProperty.call(piles, key) || piles[key] <= 0 ||
      !Number.isSafeInteger(amount) || amount < 0 || amount > piles[key])
      throw new Error('Smuggler allocation must use whole spice within each revealed positive pile.');
    total += amount;
  }
  if (total !== receipt.amount) throw new Error('Smuggler allocation must collect the exact pending amount.');
  return Object.fromEntries(Object.entries(allocations).filter(([, amount]) => amount > 0)
    .sort(([a], [b]) => a.localeCompare(b)));
}
/** Only a surviving leader's partial collection from multiple piles needs an owner choice. */
export function smugglerBattleAllocationRequired(receipt: SmugglerBattleReceipt, survives: boolean): boolean {
  return survives && receipt.stage === 'pending' && receipt.allocations === undefined &&
    Object.keys(recordedPiles(receipt)).length > 1 && receipt.amount > 0 && receipt.amount < receipt.before;
}
export function chooseSmugglerBattleAllocation(receipt: SmugglerBattleReceipt,
  allocations: Record<string, number>): SmugglerBattleReceipt {
  validateSmugglerBattleReceipt(receipt);
  const chosen: SmugglerBattleReceipt = { ...receipt,
    ...(receipt.piles ? { piles: { ...receipt.piles } } : {}),
    allocations: normalizeSmugglerBattleAllocation(receipt, allocations), signature: '' };
  chosen.signature = smugglerBattleSignature(chosen);
  return chosen;
}
/** Survival controls both winning and losing leaders; this is not bank/player income. */
export function settleSmugglerBattle(receipt: SmugglerBattleReceipt, survives: boolean, spice: Readonly<Record<string, number>>) {
  validateSmugglerBattleReceipt(receipt);
  const snapshot = smugglerBattlePile(receipt.territory, spice);
  const expected = smugglerBattlePile(receipt.territory, recordedPiles(receipt));
  if (JSON.stringify(snapshot) !== JSON.stringify(expected))
    throw new Error('The saved Smuggler collection changed its reveal-time spice or receipt.');
  if (smugglerBattleAllocationRequired(receipt, survives))
    throw new Error('Choose the Smuggler collection sectors before settling the surviving leader.');
  const amount = survives ? receipt.amount : 0;
  const allocations = !survives || !amount ? {} : receipt.allocations ??
    (receipt.key ? { [receipt.key]: amount } : recordedPiles(receipt));
  const remaining = { ...spice };
  for (const [key, collected] of Object.entries(allocations)) remaining[key] -= collected;
  const settled: SmugglerBattleReceipt = { ...receipt, stage: survives ? 'collected' : 'void', signature: '' };
  settled.signature = smugglerBattleSignature(settled);
  return { receipt: settled, amount, spice: remaining };
}
