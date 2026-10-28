import {
  battleLeaderStrength,
  isAuditorLeader,
  type Card,
  type Leader,
} from './cards';
import type { FactionId } from './catalog';
import { battleWeaponsExplode } from './battle-cards';
import { validBattleSlotPair } from './battle-card-slots';
import { resolveBattleWeapons } from './effective-weapons';
import {
  casualtyOptions,
  validCombatForces,
  type Casualties,
  type CombatForces,
} from './combat';
import { strongholdBattleEffects } from './stronghold-battle';
import {
  strongholdBattleIncome,
  strongholdSupportCost,
  type StrongholdId,
} from './stronghold-cards';
import {
  canRetainBattleCard,
  type MoritaniRetention,
} from './moritani-retention';
import {
  stoneBurnerComparison,
  stoneBurnerWithdrawalContext,
  stoneBurnerUndialedTotal,
  type StoneBurnerContext,
  type StoneBurnerComparison,
} from './stone-burner';
import { matchingTraitor } from './traitors';
import { battleTieOwner } from './sapho-aggressor';
import { HARASS_WITHDRAW_CARD, isHarassWithdraw, quoteHarassWithdraw, type HarassWithdrawContext, type HarassWithdrawQuote, type HarassWithdrawSelection } from './harass-withdraw';
import { auditCount } from './choam-auditor';
import { sukGraduateSkill, type SukGraduateSkill } from './suk-graduate';
import { validateSpiceBankerSpend } from './spice-banker';
import { isReinforcements, quoteReinforcements, REINFORCEMENTS_CARD } from './reinforcements';
import { rihaniVictorySkill, type RihaniSkill } from './rihani-decipherer';
import { copiedDiplomatDefense, quoteDiplomatDefense, type DiplomatDefenseQuote } from './diplomat-defense';
import {
  quoteHomeworldBattleRules,
  type HomeworldBattleRules,
  type HomeworldExplosionLosses,
} from './homeworld-battle-rules';
import {
  PLANETOLOGIST_BASE_SPECIALS,
  usesPlanetologistBattleSpecial,
  isPlanetologistBattleSpecialCard,
  leaderSkillBattleBonus,
  bureaucratBattlePenalty,
  usesSurvivingSkilledLeader,
  type BattleLeaderSkill,
  type LeaderSkillBattleBonus,
} from './leader-skill-combat';
import { quoteEcazOccupyOutcome, type EcazOccupyBattleProfile } from './ecaz-occupy-battle';
import { ecazSpecialKaramaBonus, ecazSpecialKaramaPlanAllowed } from './ecaz-special-karama';
import type { StoneBurnerAllocationChoice, StoneBurnerAllocationLoss } from './stone-burner-allocation';

export class BattleResolutionQuoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BattleResolutionQuoteError';
  }
}
/** Pure prerequisite only: no combat resources have been applied. The engine
 * owns the private simultaneous commitment protocol and its battle stamp. */
export class StoneBurnerAllocationRequiredError extends BattleResolutionQuoteError {
  readonly choices: readonly StoneBurnerAllocationChoice[];
  readonly losses: Readonly<Record<string, readonly StoneBurnerAllocationLoss[]>>;
  constructor(choices: readonly StoneBurnerAllocationChoice[],
    losses: Readonly<Record<string, readonly StoneBurnerAllocationLoss[]>> = {}) {
    super('Stone Burner requires private undialed physical totals before determining this battle winner.');
    this.name = 'StoneBurnerAllocationRequiredError';
    this.choices = choices.map(choice => ({ ...choice, totals: [...choice.totals] }));
    this.losses = Object.fromEntries(Object.entries(losses).map(([player, options]) => [player,
      options.map(option => ({ undialed: option.undialed, losses: { ...option.losses } }))]));
  }
}
export type ResolutionPlan = {
  bankerSpice?: number;
  planetologistSpecial?: true;
  dial: number;
  support: number;
  allyPayment?: number;
  leader: string | null;
  weapon: string | null;
  defense: string | null;
  kwisatz?: boolean;
};
export type ResolutionParticipant = {
  id: string;
  faction: FactionId;
  ally?: string | null;
  /** A marker still concealed in this battle territory; other territories do not count. */
  noFieldAtTerritory?: boolean;
};
export type ResolutionCombatant = ResolutionParticipant & {
  /** Own typed reserves before card costs. The caller excludes an on-World fee
   * from the native combat pool/rules while retaining original combat traits. */
  reinforcementsReserves?: { normal: number; elite: number };
  harassWithdraw?: HarassWithdrawContext;
  harassSelection?: HarassWithdrawSelection;
  diplomatDefense?: Pick<DiplomatDefenseQuote, 'leader' | 'source' | 'kind'> & {
    card: string;
    /** Authoritative current battle opted into used-defense contexts. */
    contextual?: true;
  };
  spice: number;
  hand: readonly Card[];
  plan: ResolutionPlan;
  /** Resolve controlled/captured/shared leader custody in the engine adapter. */
  leader?: Leader;
  /** Capture canceled elite/Fremen bonuses before clearing the live battle. */
  forces: CombatForces;
  stronghold?: StrongholdId | null;
  lateDefense?: string;
  poisonTooth?: boolean;
  stoneMode?: 'kill' | 'ignore';
  /** Current authorized assignments only; captured assignments grant no normal band. */
  leaderSkills?: readonly BattleLeaderSkill[];
  /** Public distinct occupation, including contested strongholds but excluding advisors. */
  occupiedStrongholds?: number;
  /** The current aidFor result: this escrow has already left the donor's balance. */
  aid?: { donor: string; amount: number };
  /** Revealed Ecaz declaration; virtual dial strength never changes physical commitments. */
  ecazSpecialKarama?: true;
};
export type BattleResolutionInput = {
  /** New battle protocol: physical undialed totals, keyed by the stable side
   * player, without preselecting the winner's later typed casualty tuple. */
  stoneAllocations?: Readonly<Record<string, number>>;
  ecazOccupy?: EcazOccupyBattleProfile;
  /** Stable physical slots remain unchanged when Sapho changes aggressor. */
  aggressor?: string;
  advanced: boolean;
  /** Preserve physical counter choices in Basic Homeworlds without granting Advanced strength. */
  typedCasualties?: boolean;
  turn: number;
  territory: string;
  /** Off-planet rules are explicit; a Homeworld is never a stronghold terrain. */
  homeworld?: HomeworldBattleRules;
  attacker: ResolutionCombatant;
  defender: ResolutionCombatant;
  /** Exact traitorVoters order, with the canceled allied call substituted false. */
  voters: readonly {
    id: string;
    beneficiary: string;
    called: boolean;
    traitors: readonly string[];
  }[];
  participants: readonly ResolutionParticipant[];
  /** Live physical zones only, excluding historical receipts and knowledge aliases. */
  physicalCards: readonly { id: string }[];
  pendingAuditorPresent: boolean;
  pendingRetentionPresent: boolean;
  /** Selected Basic Semuta serialization: dispose mandatory loser cards before
   * reserving the eligible native Moritani ally-retention choices. */
  nativeMoritaniEarlyMandatoryDiscard?: boolean;
  /** Open the same loser window regardless of private Moritani Nexus custody. */
  nexusMoritani?: boolean;
};
export type BattleSupportPayment = {
  player: string;
  cost: number;
  ownPayment: number;
  allyPayment: number;
  donor: string | null;
  bankSupport: number;
  freeByTraitor: boolean;
};
export type BattleResolutionQuote = {
  fixedLosses?: { owner: string; normal: number; elite: number }[];
  /** Reserve-to-Tanks costs apply to every revealed outcome, including traitors and explosions. */
  reinforcements?: { player: string; card: typeof REINFORCEMENTS_CARD; normal: number; elite: number }[];
  harassWithdraw?: (HarassWithdrawQuote & { player: string; card: typeof HARASS_WITHDRAW_CARD })[];
  result: 'normal' | 'traitor' | 'mutualTraitors' | 'explosion';
  winner: string | null;
  attackerTraitor: boolean;
  defenderTraitor: boolean;
  revelations: { player: string; identity: string }[];
  leaderStrengths: { attacker: number; defender: number };
  leaderSkillBonuses: {
    attacker: LeaderSkillBattleBonus;
    defender: LeaderSkillBattleBonus;
  };
  leaderDeaths: { attacker: boolean; defender: boolean };
  scores: { attacker: number; defender: number } | null;
  stone: StoneBurnerComparison | null;
  effects: ReturnType<typeof strongholdBattleEffects> | null;
  explosion: boolean;
  payments: BattleSupportPayment[];
  spiceBankerPayments?: { player: string; amount: number; waivedByTraitor: boolean }[];
  choamIncome: { owner: string; amount: number } | null;
  bounty: { player: string; amount: number } | null;
  strongholdIncome: { player: string; amount: number }[];
  /** Includes noncombatants only for an actual non-traitor explosion. */
  destroyedArmies: string[];
  /** Native Lasgun/Shield losses replace destruction, including when the
   * native is a noncombatant at an invaders' battle. Commit one chosen option. */
  homeworldExplosion?: HomeworldExplosionLosses;
  /** Basic ordinary winners lose their dial immediately; Advanced/Ix defer typed losses. */
  basicWinnerLosses: number | null;
  leaderSkillPenalties?: { attacker: number; defender: number };
  sukGraduate?: SukGraduateSkill;
  rihani?: RihaniSkill;
  sandmaster?: string;
  casualties: {
    owner?: string;
    /** A selected Stone total constrains the later variable physical losses,
     * after any fixed Ecaz contribution and actual withdrawal. */
    physicalLossCount?: number;
    /** The returned Harass complement fixes all remaining physical fighters. */
    fullyCommitted?: true;
    forces: CombatForces;
    dial: number;
    support: number;
    options: Casualties[];
  } | null;
  played: { attacker: string[]; defender: string[] };
  discarded: { player: string; card: string }[];
  winnerCards: string[];
  retention: MoritaniRetention | null;
  /** Event allocation and mutable audit lifecycle belong to the live caller. */
  auditor: {
    owner: string;
    opponent: string;
    territory: string;
    turn: number;
    survived: boolean;
    usedCards: string[];
    stage: 'offer';
  } | null;
};
function requireQuote(condition: unknown, message: string): asserts condition {
  if (!condition) throw new BattleResolutionQuoteError(message);
}
/** Shared pure validation accepts partial commitments while gathering choices.
 * The resolution itself requires every originally ambiguous side to commit. */
export function validateStoneBurnerAllocationSelections(
  choices: readonly StoneBurnerAllocationChoice[],
  selections: Readonly<Record<string, number>> | undefined,
  complete = false,
): Readonly<Record<string, number>> {
  requireQuote(selections === undefined || (!!selections && typeof selections === 'object' &&
    !Array.isArray(selections) && [Object.prototype, null].includes(Object.getPrototypeOf(selections))),
  'Stone Burner allocations must identify original side players and legal physical totals.');
  const selected = selections ?? {};
  requireQuote(Object.entries(selected).every(([player, total]) => {
    const choice = choices.find(choice => choice.player === player);
    return choice && Number.isSafeInteger(total) && choice.totals.includes(total);
  }), 'Stone Burner allocations must identify original side players and legal physical totals.');
  if (complete && !choices.every(choice => Object.hasOwn(selected, choice.player)))
    throw new StoneBurnerAllocationRequiredError(choices);
  return selected;
}
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const whole = (value: number) => Number.isSafeInteger(value) && value >= 0;
function validateCombatant(
  side: ResolutionCombatant,
  physical: readonly { id: string }[],
) {
  const f = side.forces,
    p = side.plan;
  requireQuote(
    id(side.id) &&
      Array.isArray(side.hand) &&
      p &&
      f &&
      whole(side.spice) &&
      validCombatForces(f) &&
      Number.isFinite(p.dial) &&
      p.dial >= 0 &&
      Number.isSafeInteger(p.dial * 2) &&
      whole(p.support) &&
      whole(p.allyPayment ?? 0),
    'The revealed battle needs valid force, dial and payment quantities.',
  );
  try {
    validateSpiceBankerSpend(side.leaderSkills ?? [], side.leader && !side.leader.dead ? side.leader.id : undefined,
      p.bankerSpice, side.spice, strongholdSupportCost(side.stronghold, p.support) - (p.allyPayment ?? 0));
  } catch (error) {
    throw new BattleResolutionQuoteError(error instanceof Error ? error.message : 'Invalid Spice Banker commitment.');
  }
  requireQuote(p.planetologistSpecial === undefined || (p.planetologistSpecial === true &&
    usesPlanetologistBattleSpecial({ assignments: side.leaderSkills ?? [],
      selectedLeader: p.leader, card: side.hand.find(card => card.id === p.weapon), planetologistSpecial: true })),
  'The alternate Special role needs the actual Planetologist weapon substitution.');
  const selected = [p.weapon, p.defense, p.leader, side.lateDefense].filter(
    (value): value is string => value != null,
  );
  requireQuote(
    selected.every(id) && new Set(selected).size === selected.length,
    'The revealed battle roles must use distinct physical cards or leaders.',
  );
  const played: string[] = [];
  for (const selectedId of selected) {
    const held = side.hand.filter((card) => card.id === selectedId);
    if (selectedId === p.leader && side.leader?.id === selectedId) {
      requireQuote(
        held.length === 0,
        'A leader disc cannot also be a physical treachery card.',
      );
      continue;
    }
    requireQuote(
      held.length === 1 &&
        physical.filter((card) => card.id === selectedId).length === 1,
      'Played battle cards must remain available with unique physical custody.',
    );
    played.push(selectedId);
  }
  requireQuote(
    !side.leader ||
      (side.leader.id === p.leader && Number.isFinite(side.leader.strength)),
    'The controlled leader must match the revealed plan.',
  );
  const selectedPlanetologistCards = [
    p.weapon,
    p.defense,
    p.leader,
    side.lateDefense,
  ].filter(
    (selectedId): selectedId is string =>
      !!selectedId &&
      (PLANETOLOGIST_BASE_SPECIALS.some((card) => card.id === selectedId) ||
        selectedId === 'ecaz-recruits' || (p.planetologistSpecial === true && selectedId === p.weapon)),
  );
  requireQuote(
    selectedPlanetologistCards.every((selectedId) => {
      const selectedCard = side.hand.find((card) => card.id === selectedId);
      return (
        selectedId === p.weapon &&
        side.leader?.id === p.leader &&
        !side.leader.dead &&
        isPlanetologistBattleSpecialCard(selectedCard) &&
        usesPlanetologistBattleSpecial({
          assignments: side.leaderSkills ?? [],
          selectedLeader: p.leader,
          card: selectedCard,
          planetologistSpecial: p.planetologistSpecial,
        })
      );
    }),
    'A green Special may replace only the assigned Planetologist leader’s weapon.',
  );
  return played;
}
/**
 * The calculations and rejection prerequisites of the existing resolveBattle.
 * No state, card, leader, escrow, random stream or event is changed. Callers
 * resolve current custody/force modifiers first and commit this quote once.
 * Later capture/technology/Face Dance/phase continuations remain engine work.
 */
export function quoteBattleResolution(
  input: BattleResolutionInput,
): BattleResolutionQuote {
  try {
    return calculate(input);
  } catch (error) {
    if (error instanceof BattleResolutionQuoteError) throw error;
    if (error instanceof Error)
      throw new BattleResolutionQuoteError(error.message);
    throw error;
  }
}
function calculate(input: BattleResolutionInput): BattleResolutionQuote {
  const a = input.attacker,
    d = input.defender;
  requireQuote(
    typeof input.advanced === 'boolean' &&
      whole(input.turn) &&
      input.turn > 0 &&
      id(input.territory) &&
      Array.isArray(input.participants) &&
      Array.isArray(input.physicalCards) &&
      input.participants.every((p) => id(p.id)) &&
      new Set(input.participants.map((p) => p.id)).size ===
        input.participants.length &&
      a.id !== d.id &&
      [a, d].every((s) =>
        input.participants.some(
          (p) => p.id === s.id && p.faction === s.faction,
        ),
      ),
    'The battle resolution needs two distinct seated combatants and its current territory.',
  );
  const played = {
    attacker: validateCombatant(a, input.physicalCards),
    defender: validateCombatant(d, input.physicalCards),
  };
  requireQuote(
    !!input.homeworld === input.territory.startsWith('homeworld:'),
    'A Homeworld battle must carry its explicit native location rules.',
  );
  const homeworld = input.homeworld
    ? quoteHomeworldBattleRules(
        input.territory,
        input.participants,
        input.homeworld,
      )
    : null;
  if (homeworld) {
    requireQuote(
      input.advanced || input.homeworld!.card !== 'salusa_secundus',
      'Salusa Secundus is used only in Advanced Homeworld games.',
    );
    requireQuote(
      !a.stronghold && !d.stronghold &&
        !input.participants.some((p) => p.noFieldAtTerritory),
      'Homeworld combat does not inherit stronghold effects or unresolved concealed No-Field combat.',
    );
    const native = [a, d].find((side) => side.id === homeworld.native);
    requireQuote(
      !native ||
        (native.forces.normal === input.homeworld!.nativeForces.normal &&
          native.forces.elite === input.homeworld!.nativeForces.elite),
      'The native battle army must match its Homeworld custody.',
    );
  }
  const card = (
    side: ResolutionCombatant,
    selected: string | null | undefined,
  ) => side.hand.find((c) => c.id === selected);
  const aw = card(a, a.plan.weapon),
    dw = card(d, d.plan.weapon),
    ad = card(a, a.lateDefense ?? a.plan.defense),
    dd = card(d, d.lateDefense ?? d.plan.defense);
  const effectiveDefense = (side: ResolutionCombatant, other: ResolutionCombatant, defense: Card | undefined) => {
    const copy = side.diplomatDefense;
    if (copy === undefined) return defense;
    const quote = quoteDiplomatDefense({ assignments: side.leaderSkills ?? [], selectedLeader: side.plan.leader,
      weapon: card(side, side.plan.weapon), defense: card(side, side.plan.defense),
      opposingDefense: card(other, copy?.contextual ? other.lateDefense ?? other.plan.defense : other.plan.defense),
      opposingWeapon: card(other, other.plan.weapon),
      expandedDefenses: true });
    requireQuote(copy && quote && !side.lateDefense &&
      (copy.contextual || (!other.lateDefense && !side.stronghold && !other.stronghold && !input.homeworld)) &&
      copy.leader === quote.leader && copy.source === quote.source && copy.kind === quote.kind && quote.cards.includes(copy.card),
      'The copied Diplomat defense lost its native trainer, committed Worthless or opposing printed defense.');
    return copiedDiplomatDefense(quote, copy.card);
  };
  const effectiveAd = effectiveDefense(a, d, ad), effectiveDd = effectiveDefense(d, a, dd);
  const weapons = resolveBattleWeapons({
    attacker: { weapon: aw, defense: effectiveAd },
    defender: { weapon: dw, defense: effectiveDd },
  });
  requireQuote(!weapons.error, weapons.error ?? 'The revealed weapons are invalid.');
  const hasStone = weapons.attacker.kind === 'stoneBurner' || weapons.defender.kind === 'stoneBurner';
  const withdrawals = new Map<string, HarassWithdrawQuote>();
  const reinforcements: NonNullable<BattleResolutionQuote['reinforcements']> = [];
  for (const side of [a, d]) {
    const slots = [card(side, side.plan.weapon), card(side, side.plan.defense)];
    const planetologistWeapon = usesPlanetologistBattleSpecial({
      assignments: side.leaderSkills ?? [], selectedLeader: side.plan.leader,
      card: slots[0], planetologistSpecial: side.plan.planetologistSpecial,
    });
    const selectedIds = [side.plan.weapon, side.plan.defense, side.plan.leader, side.lateDefense];
    requireQuote(selectedIds.every((selectedId) =>
      selectedId !== REINFORCEMENTS_CARD || slots.some(c => c?.id === selectedId && isReinforcements(c))),
    'Reinforcements must be a canonical physical card in exactly one battle-card slot.');
    const selected = slots.filter((selectedCard, slot) =>
      isReinforcements(selectedCard) && !(slot === 0 && planetologistWeapon));
    requireQuote(selected.length <= 1 && (selected.length === 0) === (side.reinforcementsReserves === undefined),
      'Reinforcements requires its own reserve counts exactly when selected.');
    if (selected.length) {
      requireQuote(validBattleSlotPair(slots[0], slots[1], planetologistWeapon) &&
        !(side === d && reinforcements.length),
      'Reinforcements needs a unique physical card and valid weapon and defense slot pair.');
      const reserves = side.reinforcementsReserves!;
      requireQuote(!!reserves && typeof reserves === 'object' && !Array.isArray(reserves),
        'Reinforcements needs own typed reserves.');
      const cost = quoteReinforcements(reserves.normal, reserves.elite);
      reinforcements.push({ player: side.id, card: REINFORCEMENTS_CARD, normal: cost.normal, elite: cost.elite });
    }
    const harass = slots.some((selectedCard, slot) =>
      isHarassWithdraw(selectedCard) && !(slot === 0 && planetologistWeapon));
    requireQuote((!side.harassWithdraw && side.harassSelection === undefined) || harass, 'The withdrawal context requires the physical Harass & Withdraw card.');
    if (harass) {
      requireQuote(validBattleSlotPair(slots[0], slots[1], planetologistWeapon),
        'The Harass & Withdraw plan has an invalid weapon and defense pair.');
      requireQuote(side.harassWithdraw,
        'Harass & Withdraw needs its supported physical context.');
      requireQuote(!homeworld || homeworld.native !== side.id,
        'Harass & Withdraw cannot be used on your own Homeworld.');
      const profile = input.ecazOccupy?.lead === side.id ? input.ecazOccupy : undefined;
      const normalization = side.harassWithdraw.occupy;
      if (profile) {
        const ownForces = side.id === profile.ecaz ? profile.ecazForces : profile.allyForces;
        requireQuote(normalization &&
          normalization.cardUser === side.id && normalization.ecaz === profile.ecaz &&
          normalization.ally === profile.ally && normalization.canceled === profile.canceled &&
          normalization.fixedEcazDial === profile.fixedEcazDial &&
          JSON.stringify(normalization.variableForces) === JSON.stringify(profile.forces) &&
          JSON.stringify(side.forces) === JSON.stringify(profile.forces) &&
          JSON.stringify(side.harassWithdraw.forces) === JSON.stringify(ownForces),
        'The Occupy withdrawal context must identify the card user’s own counters and the original mandatory Ecaz commitment.');
      } else {
        requireQuote(!normalization &&
          JSON.stringify(side.harassWithdraw.forces) === JSON.stringify(side.forces),
        'The withdrawal context must match the current battle force roles.');
      }
      withdrawals.set(side.id, quoteHarassWithdraw(side.harassWithdraw, side.plan.dial, side.plan.support, side.harassSelection));
    }
  }
  requireQuote(
    Array.isArray(input.voters) &&
      new Set(input.voters.map((v) => v.id)).size === input.voters.length &&
      [a, d].filter((s) => !homeworld || s.id === homeworld.native).every((s) =>
        input.voters.some((v) => v.id === s.id && v.beneficiary === s.id),
      ) &&
      (!homeworld || input.voters.every((v) =>
        v.id === homeworld.native && v.beneficiary === homeworld.native,
      )),
    'The battle needs its complete distinct traitor voters.',
  );
  const revelations: BattleResolutionQuote['revelations'] = [];
  for (const voter of input.voters) {
    requireQuote(
      typeof voter.called === 'boolean' &&
        Array.isArray(voter.traitors) &&
        input.participants.some((p) => p.id === voter.id) &&
        [a.id, d.id].includes(voter.beneficiary),
      'The saved traitor voter or beneficiary is invalid.',
    );
    if (!voter.called) continue;
    const target = voter.beneficiary === a.id ? d : a;
    const identity = matchingTraitor(
      voter.traitors,
      target.plan.leader,
      card(target, target.plan.leader),
    );
    requireQuote(
      identity && !target.plan.kwisatz,
      'The called traitor must match the opposing leader without Kwisatz Haderach protection.',
    );
    revelations.push({ player: voter.id, identity });
  }
  const ac = input.voters.some(
      (v) => v.called && !d.plan.kwisatz && v.beneficiary === a.id,
    ),
    dc = input.voters.some(
      (v) => v.called && !a.plan.kwisatz && v.beneficiary === d.id,
    );
  const payments: BattleSupportPayment[] = [];
  const harassWithdraw = [a, d].flatMap(side => {
    const withdrawal = withdrawals.get(side.id);
    // An opposing successful traitor cancels this effect, including mutual calls.
    return withdrawal && !(side === a ? dc : ac)
      ? [{ ...withdrawal, player: side.id, card: HARASS_WITHDRAW_CARD }] : [];
  });
  const tie = battleTieOwner(a.id, d.id, input.aggressor ?? a.id,
    [a, d].filter(side => side.stronghold === 'habbanya_ridge_sietch').map(side => side.id)) === a.id
    ? 'attacker' : 'defender';
  const stoneOccupy = hasStone && input.ecazOccupy ? {
    fixedEcazDial: input.ecazOccupy.fixedEcazDial,
    ecazUndialed: input.ecazOccupy.canceled ? 0 : Math.floor(input.ecazOccupy.ecazForces.normal / 2),
  } : undefined;
  let stoneContext: StoneBurnerContext | undefined = stoneOccupy ? {
    attacker: input.ecazOccupy!.lead === a.id ? stoneOccupy : undefined,
    defender: input.ecazOccupy!.lead === d.id ? stoneOccupy : undefined,
  } : undefined;
  if (hasStone)
    for (const side of [a, d])
      if (harassWithdraw.some(withdrawal => withdrawal.player === side.id))
        stoneContext = stoneBurnerWithdrawalContext(
          stoneContext, side === a ? 'attacker' : 'defender', side.harassWithdraw?.occupy,
        );
  let stone = hasStone
    ? stoneBurnerComparison(
        a.forces,
        a.plan.dial,
        a.plan.support,
        d.forces,
        d.plan.dial,
        d.plan.support,
        tie,
        stoneContext,
      )
    : null;
  const explosion = battleWeaponsExplode(aw, ad, dw, dd);
  const allocationChoices: StoneBurnerAllocationChoice[] = stone && !stone.winner && !ac && !dc && !explosion
    ? ([['attacker', a], ['defender', d]] as const).flatMap(([slot, side]) => stone![slot].length > 1 ? [{
      player: side.id,
      owner: input.ecazOccupy && !input.ecazOccupy.canceled && input.ecazOccupy.lead === side.id
        ? input.ecazOccupy.forceOwner : side.id,
      totals: [...stone![slot]],
    }] : []) : [];
  const stoneAllocationLosses = Object.fromEntries(allocationChoices.map(choice => {
    const side = choice.player === a.id ? a : d, context = stoneContext?.[side === a ? 'attacker' : 'defender'];
    const withdrawal = harassWithdraw.find(withdrawal => withdrawal.player === choice.owner);
    const options = casualtyOptions(side.forces, side.plan.dial - (context?.fixedEcazDial ?? 0), side.plan.support)
      .filter(loss => !withdrawal || loss.normal === withdrawal.remaining.normal && loss.elite === withdrawal.remaining.elite)
      .map(losses => ({ undialed: stoneBurnerUndialedTotal(side.forces, losses, context), losses }));
    return [choice.player, options];
  }));
  const stoneAllocations = validateStoneBurnerAllocationSelections(allocationChoices, input.stoneAllocations);
  if (!allocationChoices.every(choice => Object.hasOwn(stoneAllocations, choice.player)))
    throw new StoneBurnerAllocationRequiredError(allocationChoices, stoneAllocationLosses);
  if (stone && allocationChoices.length) {
    const attacker = Object.hasOwn(stoneAllocations, a.id) ? [stoneAllocations[a.id]] : stone.attacker;
    const defender = Object.hasOwn(stoneAllocations, d.id) ? [stoneAllocations[d.id]] : stone.defender;
    requireQuote(attacker.length === 1 && defender.length === 1,
      'Complete both original Stone Burner physical allocations before resolving battle.');
    stone = { attacker, defender, winner: attacker[0] > defender[0] ||
      attacker[0] === defender[0] && tie === 'attacker' ? 'attacker' : 'defender' };
  }
  if (stone) {
    requireQuote(
      stone.attacker.length > 0 && stone.defender.length > 0 &&
        (!!stone.winner || ac || dc || explosion),
      'Stone Burner has an unresolved physical casualty allocation. No battle resources were spent.',
    );
    for (const [side, weapon] of [
      [a, weapons.attacker],
      [d, weapons.defender],
    ] as const)
      requireQuote(
        weapon.kind !== 'stoneBurner' ||
          ['kill', 'ignore'].includes(side.stoneMode ?? ''),
        'Choose Stone Burner’s revealed mode before resolving battle.',
      );
  }
  const spiceBankerPayments = [a, d].filter(side => (side.plan.bankerSpice ?? 0) > 0).map(side => {
    const waivedByTraitor = side === a ? ac && !dc : dc && !ac;
    return { player: side.id, amount: waivedByTraitor ? 0 : side.plan.bankerSpice!, waivedByTraitor };
  });
  const credits = new Map<string, number>();
  if (input.advanced)
    for (const [side, free] of [
      [a, ac && !dc],
      [d, dc && !ac],
    ] as const) {
      if (free) {
        payments.push({
          player: side.id,
          cost: 0,
          ownPayment: 0,
          allyPayment: 0,
          donor: null,
          bankSupport: 0,
          freeByTraitor: true,
        });
        continue;
      }
      const cost = strongholdSupportCost(side.stronghold, side.plan.support),
        allyPayment = side.plan.allyPayment ?? 0;
      requireQuote(
        allyPayment <= cost &&
          (!side.aid || (id(side.aid.donor) && whole(side.aid.amount))),
        'The revealed battle support split is invalid.',
      );
      const available = side.aid
        ? (credits.get(side.aid.donor) ?? side.aid.amount)
        : 0;
      requireQuote(
        side.spice >= cost - allyPayment && available >= allyPayment,
        'The payment is no longer funded.',
      );
      if (side.aid) credits.set(side.aid.donor, available - allyPayment);
      payments.push({
        player: side.id,
        cost,
        ownPayment: cost - allyPayment,
        allyPayment,
        donor: allyPayment ? side.aid!.donor : null,
        bankSupport: side.plan.support - cost,
        freeByTraitor: false,
      });
    }
  const choam = input.participants.find((p) => p.faction === 'choam');
  // Preserve existing source-backed income, including Stronghold bank support;
  // CHOAM's prepaid ally contribution is excluded from this receipt. The
  // adopted Advanced source rounds once after totaling the eligible support.
  const choamAmount =
    input.advanced && choam && !ac && !dc
      ? Math.floor(
          [a, d].reduce(
            (sum, s) =>
              sum +
              (s.id === choam.id
                ? 0
                : s.plan.support - (s.plan.allyPayment ?? 0)),
            0,
          ) / 2,
        )
      : 0;
  const result =
    ac && dc
      ? 'mutualTraitors'
      : ac || dc
        ? 'traitor'
        : explosion
          ? 'explosion'
          : 'normal';
  const strengths = {
    attacker: battleLeaderStrength(a.leader, d.leader),
    defender: battleLeaderStrength(d.leader, a.leader),
  };
  for (const side of [a, d])
    requireQuote(!side.ecazSpecialKarama ||
      (input.advanced && side.faction === 'ecaz' && ecazSpecialKaramaPlanAllowed(side.plan)),
      'Ecaz special Karama requires its native unarmed Advanced plan.');
  let winner: ResolutionCombatant | null = null;
  let effects: BattleResolutionQuote['effects'] = null;
  let scores: BattleResolutionQuote['scores'] = null;
  let deaths = { attacker: false, defender: false };
  let bounty: BattleResolutionQuote['bounty'] = null;
  let leaderSkillPenalties: BattleResolutionQuote['leaderSkillPenalties'];
  let leaderSkillBonuses: BattleResolutionQuote['leaderSkillBonuses'] = {
    attacker: { bonus: 0, applied: [] },
    defender: { bonus: 0, applied: [] },
  };
  if (result === 'mutualTraitors' || result === 'explosion')
    deaths = { attacker: true, defender: true };
  else if (result === 'traitor') {
    winner = ac ? a : d;
    deaths = { attacker: dc, defender: ac };
    bounty = {
      player: winner.id,
      amount: ac ? strengths.defender : strengths.attacker,
    };
  } else {
    effects = strongholdBattleEffects(
      aw,
      effectiveAd,
      dw,
      effectiveDd,
      a.poisonTooth,
      d.poisonTooth,
      a.stronghold,
      d.stronghold,
    );
    const stoneKills = !!stone && [a.stoneMode, d.stoneMode].includes('kill');
    deaths = {
      attacker: effects.attackerDead || stoneKills,
      defender: effects.defenderDead || stoneKills,
    };
    const selectedLeader = (side: ResolutionCombatant) =>
      side.leader
        ? { id: side.leader.id, kind: 'disc' as const }
        : card(side, side.plan.leader)?.kind === 'hero'
          ? { id: side.plan.leader!, kind: 'hero' as const }
          : undefined;
    leaderSkillBonuses = {
      attacker: leaderSkillBattleBonus({
        assignments: a.leaderSkills ?? [],
        selectedLeader: selectedLeader(a),
        weapon: aw,
        defense: ad,
        effectiveDefense: effectiveAd,
        skilledLeaderSurvives: !deaths.attacker,
        bankerSpice: a.plan.bankerSpice,
        planetologistSpecial: a.plan.planetologistSpecial,
      }),
      defender: leaderSkillBattleBonus({
        assignments: d.leaderSkills ?? [],
        selectedLeader: selectedLeader(d),
        weapon: dw,
        defense: dd,
        effectiveDefense: effectiveDd,
        skilledLeaderSurvives: !deaths.defender,
        bankerSpice: d.plan.bankerSpice,
        planetologistSpecial: d.plan.planetologistSpecial,
      }),
    };
    const attackerPenalty = bureaucratBattlePenalty(d.leaderSkills ?? [], d.leader?.id,
      !deaths.defender, a.occupiedStrongholds);
    const defenderPenalty = bureaucratBattlePenalty(a.leaderSkills ?? [], a.leader?.id,
      !deaths.attacker, d.occupiedStrongholds);
    if (attackerPenalty || defenderPenalty)
      leaderSkillPenalties = { attacker: attackerPenalty, defender: defenderPenalty };
    scores = {
      attacker:
        a.plan.dial - attackerPenalty +
        (a.ecazSpecialKarama ? ecazSpecialKaramaBonus(strengths.attacker, strengths.defender) : 0) +
        (!stone && reinforcements[0]?.player === a.id ? 2 : 0) +
        (a.id === homeworld?.native ? homeworld.strength : 0) +
        (deaths.attacker || effects.stunned
          ? 0
          : strengths.attacker +
            leaderSkillBonuses.attacker.bonus +
            (a.plan.kwisatz ? 2 : 0)),
      defender:
        d.plan.dial - defenderPenalty +
        (d.ecazSpecialKarama ? ecazSpecialKaramaBonus(strengths.defender, strengths.attacker) : 0) +
        (!stone && reinforcements[0]?.player === d.id ? 2 : 0) +
        (d.id === homeworld?.native ? homeworld.strength : 0) +
        (deaths.defender || effects.stunned
          ? 0
          : strengths.defender +
            leaderSkillBonuses.defender.bonus +
            (d.plan.kwisatz ? 2 : 0)),
    };
    winner = stone
      ? stone.winner === 'attacker'
        ? a
        : d
      : scores.attacker > scores.defender ||
          (scores.attacker === scores.defender && tie === 'attacker')
        ? a
        : d;
    if (!effects.noBounty)
      bounty = {
        player: winner.id,
        amount:
          (deaths.attacker ? strengths.attacker : 0) +
          (deaths.defender ? strengths.defender : 0),
      };
  }
  let destroyedArmies =
    result === 'explosion'
      ? input.participants.filter((p) => p.id !== homeworld?.native).map((p) => p.id)
      : winner
        ? [winner.id === a.id ? d.id : a.id]
        : [a.id, d.id];
  requireQuote(
    !input.participants.some(
      (p) => destroyedArmies.includes(p.id) && p.noFieldAtTerritory,
    ),
    'This removal of a concealed No-Field awaits its specific reveal and casualty rules.',
  );
  let casualties: BattleResolutionQuote['casualties'] = null;
  let basicWinnerLosses: number | null = null;
  const sukGraduate = winner && result === 'normal' && winner.plan.dial > 0
    ? sukGraduateSkill(winner.leaderSkills ?? [], winner.leader,
        !(winner === a ? deaths.attacker : deaths.defender))
    : null;
  const rihani = winner ? rihaniVictorySkill(winner.leaderSkills ?? [], winner.leader?.id,
    !(winner === a ? deaths.attacker : deaths.defender)) : null;
  const sandmaster = winner && usesSurvivingSkilledLeader(winner.leaderSkills ?? [], 'sandmaster', winner.leader?.id,
    !(winner === a ? deaths.attacker : deaths.defender)) ? winner.leader!.id : null;
  if (winner && result === 'normal' && winner.id !== input.ecazOccupy?.lead) {
    if (
      input.advanced ||
      input.typedCasualties ||
      sukGraduate ||
      homeworld ||
      winner.faction === 'ixians'
    ) {
      const withdrawal = harassWithdraw.find(entry => entry.player === winner.id);
      // Withdrawal already identifies every undialed counter. Do not choose a
      // smaller physical commitment a second time after returning its complement.
      const options = casualtyOptions(
        withdrawal?.remaining ?? winner.forces,
        winner.plan.dial,
        winner.plan.support,
      ).filter(option => !withdrawal ||
        option.normal === withdrawal.remaining.normal && option.elite === withdrawal.remaining.elite);
      requireQuote(
        options.length > 0,
        'No valid casualty choice remains for this battle.',
      );
      casualties = {
        forces: { ...(harassWithdraw.find(entry => entry.player === winner.id)?.remaining ?? winner.forces) },
        dial: winner.plan.dial,
        support: winner.plan.support,
        options,
        ...(withdrawal ? { fullyCommitted: true as const } : {}),
      };
    } else {
      requireQuote(
        !input.participants.some(
          (p) => p.id === winner.id && p.noFieldAtTerritory,
        ),
        'This removal of a concealed No-Field awaits its specific reveal and casualty rules.',
      );
      basicWinnerLosses = winner.plan.dial;
    }
  }
  const occupyOutcome = input.ecazOccupy ? quoteEcazOccupyOutcome(input.ecazOccupy, {
    result, won: winner?.id === input.ecazOccupy.lead,
    dial: (a.id === input.ecazOccupy.lead ? a : d).plan.dial,
    support: (a.id === input.ecazOccupy.lead ? a : d).plan.support,
  }) : null;
  if (occupyOutcome) {
    const profile = input.ecazOccupy!;
    destroyedArmies = [...new Set([
      ...destroyedArmies.filter(owner => owner !== profile.ecaz && owner !== profile.ally),
      ...occupyOutcome.destroyedArmies,
    ])];
    if (winner?.id === profile.lead) {
      casualties = occupyOutcome.casualties;
      // The outcome already holds the original fixed Ecaz commitment. Only a
      // withdrawal by the variable army's owner can constrain its typed losses.
      const withdrawal = harassWithdraw.find(entry => entry.player === casualties?.owner);
      if (casualties && withdrawal) {
        const options = casualties.options.filter(option =>
          option.normal === withdrawal.remaining.normal && option.elite === withdrawal.remaining.elite);
        requireQuote(options.length > 0, 'The Occupy winner lost its selected physical Harass commitment.');
        casualties = { ...casualties, forces: withdrawal.remaining, options, fullyCommitted: true };
      }
    }
  }
  if (winner && result === 'normal' && casualties && Object.hasOwn(stoneAllocations, winner.id)) {
    const options = casualties.options.filter(option => stoneBurnerUndialedTotal(winner.forces, option,
      stoneContext?.[winner === a ? 'attacker' : 'defender']) === stoneAllocations[winner.id]);
    requireQuote(options.length > 0, 'The Stone Burner winner must retain a typed casualty allocation matching its committed physical total.');
    const physicalLossCount = options[0].normal + options[0].elite;
    requireQuote(options.every(option => option.normal + option.elite === physicalLossCount),
      'The selected Stone Burner total must retain one variable physical loss count.');
    casualties = { ...casualties, options, physicalLossCount };
  }
  const strongholdIncome =
    result === 'mutualTraitors'
      ? []
      : [a, d].flatMap((s) => {
          const other = s === a ? d : a;
          const count = [s.plan.weapon, s.plan.defense].filter(
            (selected) => card(s, selected)?.kind === 'worthless',
          ).length;
          const amount = strongholdBattleIncome(
            s.stronghold,
            winner?.id === s.id,
            other.plan.dial,
            count,
          );
          return amount ? [{ player: s.id, amount }] : [];
        });
  let auditor: BattleResolutionQuote['auditor'] = null;
  const auditing = input.advanced
    ? [a, d].find(
        (s) => s.faction === 'choam' && s.leader && isAuditorLeader(s.leader),
      )
    : undefined;
  if (auditing) {
    requireQuote(
      !input.pendingAuditorPresent,
      'Finish the preceding audit before another battle.',
    );
    const other = auditing === a ? d : a;
    auditor = {
      owner: auditing.id,
      opponent: other.id,
      territory: input.territory,
      turn: input.turn,
      survived:
        !auditing.leader!.dead &&
        !(auditing === a ? deaths.attacker : deaths.defender),
      usedCards: [...(other === a ? played.attacker : played.defender)],
      stage: 'offer',
    };
    // Used cards are excluded regardless of later retention/disposal; validate
    // the same private candidate pool now, without sampling an audited card.
    auditCount(other.hand, auditor.usedCards, auditor.survived);
  }
  let retention: MoritaniRetention | null = null;
  const mandatoryPlanetologistDiscard = (
    side: ResolutionCombatant,
    selected: string,
  ) =>
    selected === side.plan.weapon &&
    usesPlanetologistBattleSpecial({
      assignments: side.leaderSkills ?? [],
      selectedLeader: side.plan.leader,
      card: card(side, selected),
      planetologistSpecial: side.plan.planetologistSpecial,
    });
  // The explicit after-use instruction also applies to a successful own traitor
  // call, using the same specificity inference as Planetologist's discard.
  const mandatorySkillDiscard = (side: ResolutionCombatant, selected: string) =>
    mandatoryPlanetologistDiscard(side, selected) || side.diplomatDefense?.card === selected ||
    isHarassWithdraw(card(side, selected)) || isReinforcements(card(side, selected));
  const moritani = input.participants.find((p) => p.faction === 'moritani');
  if (winner && (moritani || input.nexusMoritani)) {
    const loser = winner === a ? d : a,
      loserPlayed = loser === a ? played.attacker : played.defender;
    const retainablePlayed = loserPlayed.filter(
      (selected) =>
        !mandatorySkillDiscard(loser, selected) &&
        (!input.nativeMoritaniEarlyMandatoryDiscard || !moritani ||
          canRetainBattleCard(
            card(loser, selected)!,
            ac || dc,
            !!loser.poisonTooth,
          )),
    );
    const eligible = retainablePlayed.filter((selected) =>
      canRetainBattleCard(card(loser, selected)!, ac || dc, !!loser.poisonTooth));
    if (
      moritani &&
      loser.id !== moritani.id &&
      loser.ally === moritani.id &&
      moritani.ally === loser.id &&
      eligible.length
    ) {
      requireQuote(
        !input.pendingRetentionPresent,
        'Finish the previous alliance card cleanup first.',
      );
      retention = {
        owner: moritani.id,
        player: loser.id,
        territory: input.territory,
        turn: input.turn,
        played: [...retainablePlayed],
        eligible,
        stage: 'choose',
      };
    } else if (!moritani && input.nexusMoritani && eligible.length) {
      requireQuote(
        !input.pendingRetentionPresent,
        'Finish the previous battle card cleanup first.',
      );
      retention = {
        owner: loser.id,
        player: loser.id,
        territory: input.territory,
        turn: input.turn,
        played: [...retainablePlayed],
        eligible,
        source: 'nexus',
        stage: 'choose',
      };
    }
  }
  const discarded = [a, d].flatMap((s) =>
    (s === a ? played.attacker : played.defender)
      .filter(
        (selected) =>
          !(
            retention?.player === s.id &&
            retention.played.includes(selected) &&
            !mandatorySkillDiscard(s, selected)
          ) &&
          (mandatorySkillDiscard(s, selected) ||
            winner !== s ||
            !canRetainBattleCard(
              card(s, selected)!,
              ac || dc,
              !!s.poisonTooth,
            )),
      )
      .map((selected) => ({ player: s.id, card: selected })),
  );
  const winnerCards = winner
    ? [...(winner === a ? played.attacker : played.defender)].filter(
        (selected) =>
          !discarded.some(
            (entry) => entry.player === winner.id && entry.card === selected,
          ),
      )
    : [];
  return {
    ...(harassWithdraw.length ? { harassWithdraw } : {}),
    ...(reinforcements.length ? { reinforcements } : {}),
    ...(occupyOutcome ? { fixedLosses: occupyOutcome.fixedLosses } : {}),
    result,
    winner: winner?.id ?? null,
    attackerTraitor: ac,
    defenderTraitor: dc,
    revelations,
    leaderStrengths: strengths,
    leaderSkillBonuses,
    leaderDeaths: deaths,
    scores,
    stone,
    effects,
    explosion,
    payments,
    ...(spiceBankerPayments.length ? { spiceBankerPayments } : {}),
    choamIncome:
      choam && choamAmount > 0
        ? { owner: choam.id, amount: choamAmount }
        : null,
    bounty,
    strongholdIncome,
    destroyedArmies,
    ...(result === 'explosion' && homeworld
      ? { homeworldExplosion: homeworld.explosion }
      : {}),
    basicWinnerLosses,
    ...(leaderSkillPenalties ? { leaderSkillPenalties } : {}),
    ...(sukGraduate ? { sukGraduate } : {}),
    ...(rihani ? { rihani } : {}),
    ...(sandmaster ? { sandmaster } : {}),
    casualties,
    played,
    discarded,
    winnerCards,
    retention,
    auditor,
  };
}
