import type { Game, Player } from './engine';
import { eliteRevivalRemaining, revivalPrevented } from './revival';
import { FACTIONS } from './catalog';
import { nexusCoreProfile } from './faction-module-profile';
import {
  classicNexusModulesProfile,
  pairedNexusModulesProfile,
  singleE1E2NexusProfile,
  mixedE1E2NexusProfile,
  standaloneE3NexusProfile,
  pairedE3NexusProfile,
  mixedE3NexusProfile,
} from './nexus-module-profile';
import {
  classicNexusLeaderSkillsProfile,
  pairedNexusLeaderSkillsProfile,
  singleE1E2NexusLeaderSkillsProfile,
  mixedE1E2NexusLeaderSkillsProfile,
  standaloneE3NexusLeaderSkillsProfile,
  pairedE3NexusLeaderSkillsProfile,
  mixedE3NexusLeaderSkillsProfile,
} from './leader-skill-profile';

export const EMPEROR_NEXUS_REVIVALS = 3;
export type EmperorNexusPools = {
  reserves: number;
  tanks: number;
  eliteReserves: number;
  eliteTanks: number;
  eliteRevived: number;
  revived: number;
  freeForcesRevived: number | null;
  spice: number;
};
type EmperorNexusRevivalIdentity = {
  kind: 'revival';
  event: string;
  owner: string;
  turn: number;
  phase: 4;
  sequence: number;
  faction: Player['faction'];
  advanced: boolean;
  elite: number;
  before: EmperorNexusPools;
  signature: string;
};
/** Old receipts are completed physical evidence, not permission to return again. */
export type NexusEmperorRevival =
  | (EmperorNexusRevivalIdentity & {
      version?: never;
      stage?: never;
      after: EmperorNexusPools;
    })
  | (EmperorNexusRevivalIdentity & { version: 2; amount?: 1 | 2 } & (
      | { stage: 'requested'; after: null }
      | { stage: 'returned' | 'denied'; after: EmperorNexusPools }
    ));
export type NexusEmperorRevivalRequest = Extract<
  NexusEmperorRevival,
  { version: 2; stage: 'requested' }
>;
/** Existing receipts omit the amount and retain their original three-force
 * signature. Only a new short requested return records one or two. */
export function emperorNexusRevivalCount(receipt: NexusEmperorRevival): number {
  return receipt.version === 2 ? receipt.amount ?? EMPEROR_NEXUS_REVIVALS : EMPEROR_NEXUS_REVIVALS;
}
export function emperorNexusPools(p: Player): EmperorNexusPools {
  return {
    reserves: p.reserves,
    tanks: p.tanks,
    eliteReserves: p.elites?.reserves ?? 0,
    eliteTanks: p.elites?.tanks ?? 0,
    eliteRevived: p.elites?.revived ?? 0,
    revived: p.revived,
    freeForcesRevived: p.freeForcesRevived ?? null,
    spice: p.spice,
  };
}
export function emperorNexusEvent(
  turn: number,
  phase: number,
  owner: string,
  sequence: number,
): string {
  return JSON.stringify([
    'nexusEmperorSecretAlly',
    turn,
    phase,
    owner,
    sequence,
  ]);
}
export function emperorNexusSignature(record: object): string {
  return JSON.stringify({ ...record, signature: undefined });
}
export function emperorNexusLegacyRevivalModeSupported(g: Game): boolean {
  return (
    !g.expansions.length &&
    g.players.every((p) =>
      ['atreides', 'harkonnen', 'fremen', 'guild', 'beneGesserit'].includes(
        p.faction,
      ),
    ) &&
    (classicNexusModulesProfile(g) || (!!g.leaderSkills && classicNexusLeaderSkillsProfile(g)) ||
      (!g.homeworlds &&
        (!g.leaderSkills || classicNexusLeaderSkillsProfile(g)) &&
        !g.discoveryEnabled &&
        !g.discoveries &&
        !g.discoveryStash &&
        !g.greatMaker &&
        ((!g.techTokens && !g.strongholdCards) || classicNexusModulesProfile(g) ||
          (!!g.leaderSkills && classicNexusLeaderSkillsProfile(g)))))
  );
}
/** Provisional short-group completion: take three whenever eligible; otherwise
 * take every eligible physical counter, respecting the existing typed cap. */
export function emperorNexusRevivalAmount(
  p: Pick<Player, 'tanks' | 'faction' | 'elites'>,
  advanced: boolean,
): number {
  return Math.min(EMPEROR_NEXUS_REVIVALS,
    p.tanks - (p.elites?.tanks ?? 0) + eliteRevivalRemaining(p, advanced));
}

/** Choose only the typed composition of the current maximal return. */
export function emperorNexusRevivalElites(
  p: Player,
  advanced: boolean,
): number[] {
  const amount = emperorNexusRevivalAmount(p, advanced);
  if (amount <= 0) return [];
  const choices: number[] = [];
  for (let elite = 0; elite <= amount; elite++)
    if (
      elite <= eliteRevivalRemaining(p, advanced) &&
      elite <= (p.elites?.tanks ?? 0) &&
      amount - elite <= p.tanks - (p.elites?.tanks ?? 0)
    )
      choices.push(elite);
  return choices;
}
const poolKeys =
  'eliteReserves,eliteRevived,eliteTanks,freeForcesRevived,reserves,revived,spice,tanks';
const receiptKeys =
  'advanced,after,before,elite,event,faction,kind,owner,phase,sequence,signature,turn';
const receiptV2Keys =
  'advanced,after,before,elite,event,faction,kind,owner,phase,sequence,signature,stage,turn,version';
const receiptV2ShortKeys =
  'advanced,after,amount,before,elite,event,faction,kind,owner,phase,sequence,signature,stage,turn,version';
const whole = (n: unknown): n is number =>
  Number.isSafeInteger(n) && (n as number) >= 0;
function shape(value: unknown, keys: string): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return (prototype === Object.prototype || prototype === null) &&
    Object.keys(value).sort().join(',') === keys;
}
function validPools(pool: EmperorNexusPools): boolean {
  return shape(pool, poolKeys) &&
    Object.entries(pool).every(([key, n]) =>
      (key === 'freeForcesRevived' && n === null) || whole(n)) &&
    pool.eliteReserves <= pool.reserves && pool.eliteTanks <= pool.tanks &&
    pool.reserves + pool.tanks <= 20;
}
function samePools(a: EmperorNexusPools, b: EmperorNexusPools): boolean {
  return Object.keys(b).every(key =>
    a[key as keyof EmperorNexusPools] === b[key as keyof EmperorNexusPools]);
}
function returnedPools(r: NexusEmperorRevival): EmperorNexusPools {
  const amount = emperorNexusRevivalCount(r);
  return {
    ...r.before,
    reserves: r.before.reserves + amount,
    tanks: r.before.tanks - amount,
    eliteReserves: r.before.eliteReserves + r.elite,
    eliteTanks: r.before.eliteTanks - r.elite,
    eliteRevived: r.before.eliteRevived + r.elite,
  };
}
type ReceiptContext = Pick<Game, 'players' | 'turn' | 'advanced' | 'expansions'>;

/** Validate historical evidence only; later ordinary returns and income are not replayed. */
export function validateEmperorNexusRevival(
  g: ReceiptContext,
  r: NexusEmperorRevival,
): void {
  const p = r && g.players.find(p => p.id === r.owner);
  const legacy = shape(r, receiptKeys);
  const short = shape(r, receiptV2ShortKeys);
  const amount = r ? emperorNexusRevivalCount(r) : EMPEROR_NEXUS_REVIVALS;
  if (!p || !(legacy || shape(r, receiptV2Keys) || short) ||
    r.kind !== 'revival' || r.phase !== 4 ||
    typeof r.owner !== 'string' || !r.owner.trim() ||
    !whole(r.turn) || r.turn < 1 || r.turn > g.turn ||
    r.faction !== p.faction || r.advanced !== g.advanced ||
    !whole(r.sequence) || !whole(r.elite) || r.elite > amount ||
    r.event !== emperorNexusEvent(r.turn, 4, r.owner, r.sequence) ||
    r.signature !== emperorNexusSignature(r) || !validPools(r.before) ||
    r.before.tanks < amount ||
    r.elite > r.before.eliteTanks ||
    amount - r.elite > r.before.tanks - r.before.eliteTanks)
    throw new Error('Emperor Nexus revival has lost its exact original physical return or allowance.');
  if (legacy) {
    if (g.expansions.length ||
      g.players.some(seat => !['atreides', 'harkonnen', 'fremen', 'guild', 'beneGesserit'].includes(seat.faction)) ||
      (g.advanced && r.before.eliteRevived + r.elite > 1) ||
      (p.faction !== 'fremen' &&
        (r.elite || r.before.eliteTanks || r.before.eliteReserves)) ||
      !r.after || !validPools(r.after) ||
      JSON.stringify(r.after) !== JSON.stringify(returnedPools(r)))
      throw new Error('Emperor Nexus revival has lost its exact original physical return or allowance.');
    return;
  }
  const typed = p.faction === 'ixians' || p.faction === 'fremen';
  if (r.version !== 2 ||
    (short && r.amount !== 1 && r.amount !== 2) ||
    amount !== emperorNexusRevivalAmount({ faction: r.faction, tanks: r.before.tanks,
      elites: { reserves: r.before.eliteReserves, tanks: r.before.eliteTanks,
        revived: r.before.eliteRevived, forces: {} } }, r.advanced) ||
    g.players.some(seat => seat.faction === 'emperor') ||
    (!typed && (r.elite || r.before.eliteTanks || r.before.eliteReserves || r.before.eliteRevived)) ||
    (typed && r.before.eliteReserves + r.before.eliteTanks > (p.faction === 'ixians' ? 7 : 3)) ||
    (g.advanced && p.faction !== 'ixians' && r.before.eliteRevived + r.elite > 1) ||
    (r.before.freeForcesRevived !== null && r.before.freeForcesRevived > r.before.revived) ||
    (r.stage === 'requested'
      ? r.after !== null
      : !['returned', 'denied'].includes(r.stage) || !r.after || !validPools(r.after) ||
        !samePools(r.after, r.stage === 'returned' ? returnedPools(r) : r.before)))
    throw new Error('Emperor Nexus revival has lost its requested, returned or denied source facts.');
}

/** Reuse original fresh roster/module predicates, independently of purchase admission. */
function revivalModeSupported(g: Game): boolean {
  if (nexusCoreProfile(g)) return true;
  if (g.semutaPreview || g.advancedPreview || g.kullPreview || g.nexusKullPreview ||
    g.guildBetrayalPreview || g.richeseBetrayalPreview || g.nexusIxianReplacementPreview ||
    g.nexusIxianBetrayalPreview || g.nexusHarkonnenBetrayalPreview || g.ecazTreachery)
    return false;
  if (g.leaderSkills)
    return classicNexusLeaderSkillsProfile(g) || pairedNexusLeaderSkillsProfile(g) ||
      singleE1E2NexusLeaderSkillsProfile(g) || mixedE1E2NexusLeaderSkillsProfile(g) ||
      standaloneE3NexusLeaderSkillsProfile(g) || pairedE3NexusLeaderSkillsProfile(g) ||
      mixedE3NexusLeaderSkillsProfile(g);
  if (classicNexusModulesProfile(g) || pairedNexusModulesProfile(g) ||
    singleE1E2NexusProfile(g) || mixedE1E2NexusProfile(g) ||
    standaloneE3NexusProfile(g) || pairedE3NexusProfile(g) || mixedE3NexusProfile(g))
    return true;
  // Bare classic and paired E1/E2 Nexus predate the optional-module profiles.
  if (!g.nexusCards || g.techTokens || g.strongholdCards || g.discoveryEnabled ||
    g.discoveries || g.discoveryStash || g.greatMaker ||
    g.players.length < 2 || g.players.length > 6 ||
    new Set(g.players.map(p => p.faction)).size !== g.players.length) return false;
  if (!g.expansions.length)
    return g.players.every(p => FACTIONS.some(f => f.id === p.faction && f.expansion === 'base'));
  if (g.expansions.length !== 1 || !['ix', 'choam'].includes(g.expansions[0])) return false;
  const expansion = g.expansions[0];
  return g.players.every(p => FACTIONS.some(f => f.id === p.faction &&
    (f.expansion === 'base' || f.expansion === expansion))) &&
    g.players.filter(p => FACTIONS.some(f => f.id === p.faction && f.expansion === expansion)).length === 2;
}

/** Provisional composition, not a publisher clarification or numerical user ruling. */
const revivalPolicy =
  'Provisional composed policy: return exactly three additional free physical forces from Tanks whenever three are eligible; otherwise return all one or two eligible forces. Zero cannot spend the card. This short-group policy is not publisher clarification. The return is beyond ordinary force and free-revival allowances. Native typed caps and Tleilaxu prevention still apply; this is not ordinary free-rate revival, so ordinary free blocking (including LaLaLa) and higher or expanded rates do not reprice it. Recruits does not double the grant. Spend the card on declaration; denial returns no forces and grants no revival income or Tech benefit. No leader, missing-native-Emperor payment, extra Karama response or refund is granted. Actual returns continue through native Tleilaxu, Tech and Homeworld handling.';

export function quoteEmperorNexusRevival(g: Game, owner: string): {
  event: string;
  amount: number;
  blocked: string | null;
  eliteOptions: number[];
  policy: string;
} {
  const p = g.players.find(p => p.id === owner);
  const event = emperorNexusEvent(g.turn, g.phase, owner, g.nexusEmperorSecretHistory?.length ?? 0);
  const amount = p ? emperorNexusRevivalAmount(p, g.advanced) : 0;
  const eliteOptions = p ? emperorNexusRevivalElites(p, g.advanced) : [];
  let blocked: string | null = null;
  if (!p || g.nexusCards?.cards?.hands[owner] !== 'emperor')
    blocked = 'Only the actual holder of the Emperor Nexus card may use this revival.';
  else if (g.players.some(p => p.faction === 'emperor'))
    blocked = 'Emperor Secret Ally requires the native Emperor absent from the roster.';
  else if (p.ally) blocked = 'Emperor Nexus Secret Ally requires an unallied holder.';
  else if (!revivalModeSupported(g))
    blocked = 'Emperor Nexus revival requires an original supported Nexus roster and module profile.';
  else if (g.status !== 'playing' || g.phase !== 4)
    blocked = 'Use the additional Emperor Nexus return during Revival.';
  else if (g.response || g.decision || g.truthtrance || g.phaseOpening ||
    g.pendingRevival || g.pendingKarama || g.pendingTreacheryDiscard ||
    g.pendingNullentropy || g.pendingExchange || g.pendingRicheseGift ||
    g.pendingRichesePurchaseIncome || g.pendingAmbassador || g.pendingCapture ||
    g.battle || g.nexusTraitorPending || g.nexusTraitorParent ||
    g.nexusCards?.phase?.stage === 'drawing' ||
    (g.homeworldRevivalReturn && g.homeworldRevivalReturn.stage !== 'complete'))
    blocked = 'Finish the current interaction before using Emperor Nexus revival.';
  else if (revivalPrevented(g, owner))
    blocked = 'Native Tleilaxu prevention blocks this revival.';
  else if (!eliteOptions.length)
    blocked = 'Emperor Nexus needs at least one eligible force in Tanks.';
  return { event, amount, blocked, eliteOptions, policy: revivalPolicy };
}

/** Pure declaration receipt: the engine commits card custody and the original pending revival. */
export function createEmperorNexusRevival(
  g: Game,
  owner: string,
  elite: number,
): NexusEmperorRevivalRequest {
  const quote = quoteEmperorNexusRevival(g, owner);
  if (quote.blocked || !quote.eliteOptions.includes(elite))
    throw new Error(quote.blocked ?? 'Choose an eligible typed group for the current additional return.');
  const p = g.players.find(p => p.id === owner)!;
  const r: NexusEmperorRevivalRequest = {
    kind: 'revival', version: 2, event: quote.event, owner, turn: g.turn, phase: 4,
    sequence: g.nexusEmperorSecretHistory?.length ?? 0,
    faction: p.faction, advanced: g.advanced, elite,
    ...(quote.amount === 1 || quote.amount === 2 ? { amount: quote.amount } : {}),
    before: emperorNexusPools(p), after: null, stage: 'requested', signature: '',
  };
  r.signature = emperorNexusSignature(r);
  validateEmperorNexusRevival(g, r);
  return r;
}

/** Capture the actual physical finish before native income or Homeworld deployment. */
export function settleEmperorNexusRevival(
  g: Game,
  receipt: NexusEmperorRevival,
  outcome: 'returned' | 'denied',
): Extract<NexusEmperorRevival, { version: 2; stage: 'returned' | 'denied' }> {
  validateEmperorNexusRevival(g, receipt);
  const saved = g.nexusEmperorSecretHistory?.[receipt.sequence];
  const p = g.players.find(p => p.id === receipt.owner)!;
  if (receipt.version !== 2 || receipt.stage !== 'requested' ||
    !['returned', 'denied'].includes(outcome) ||
    receipt.turn !== g.turn || g.phase !== 4 || g.status !== 'playing' || p.ally ||
    !saved || saved.signature !== receipt.signature ||
    emperorNexusSignature(saved) !== receipt.signature ||
    g.nexusEmperorSecretEvents?.[receipt.sequence] !== receipt.event ||
    g.nexusEmperorSecretHistory?.length !== receipt.sequence + 1 ||
    g.nexusCards?.cards?.hands[receipt.owner] !== null ||
    g.nexusCards.cards.discard.filter(card => card === 'emperor').length !== 1)
    throw new Error('Emperor Nexus settlement needs the original committed requested source.');
  const result = {
    ...receipt, stage: outcome, after: emperorNexusPools(p), signature: '',
  };
  result.signature = emperorNexusSignature(result);
  validateEmperorNexusRevival(g, result);
  return result;
}
