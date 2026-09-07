import {
  battleLeaderStrength,
  isAuditorLeader,
  type Card,
  type Leader,
} from './cards';
import type { FactionId } from './catalog';
import { battleWeaponsExplode, isStoneBurner } from './battle-cards';
import { casualtyOptions, type Casualties, type CombatForces } from './combat';
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
  type StoneBurnerComparison,
} from './stone-burner';
import { matchingTraitor } from './traitors';
import { auditCount } from './choam-auditor';

export class BattleResolutionQuoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BattleResolutionQuoteError';
  }
}
export type ResolutionPlan = {
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
  /** The current aidFor result: this escrow has already left the donor's balance. */
  aid?: { donor: string; amount: number };
};
export type BattleResolutionInput = {
  advanced: boolean;
  turn: number;
  territory: string;
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
  result: 'normal' | 'traitor' | 'mutualTraitors' | 'explosion';
  winner: string | null;
  attackerTraitor: boolean;
  defenderTraitor: boolean;
  revelations: { player: string; identity: string }[];
  leaderStrengths: { attacker: number; defender: number };
  leaderDeaths: { attacker: boolean; defender: boolean };
  scores: { attacker: number; defender: number } | null;
  stone: StoneBurnerComparison | null;
  effects: ReturnType<typeof strongholdBattleEffects> | null;
  explosion: boolean;
  payments: BattleSupportPayment[];
  choamIncome: { owner: string; amount: number } | null;
  bounty: { player: string; amount: number } | null;
  strongholdIncome: { player: string; amount: number }[];
  /** Includes noncombatants only for an actual non-traitor explosion. */
  destroyedArmies: string[];
  /** Basic ordinary winners lose their dial immediately; Advanced/Ix defer typed losses. */
  basicWinnerLosses: number | null;
  casualties: {
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
      whole(f.normal) &&
      whole(f.elite) &&
      f.normal + f.elite <= 20 &&
      (f.eliteStrength === 1 || f.eliteStrength === 2) &&
      typeof f.freeSupport === 'boolean' &&
      (f.normalFixedHalf === undefined ||
        typeof f.normalFixedHalf === 'boolean') &&
      Number.isFinite(p.dial) &&
      p.dial >= 0 &&
      Number.isSafeInteger(p.dial * 2) &&
      whole(p.support) &&
      whole(p.allyPayment ?? 0),
    'The revealed battle needs valid force, dial and payment quantities.',
  );
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
  const card = (
    side: ResolutionCombatant,
    selected: string | null | undefined,
  ) => side.hand.find((c) => c.id === selected);
  const aw = card(a, a.plan.weapon),
    dw = card(d, d.plan.weapon),
    ad = card(a, a.lateDefense ?? a.plan.defense),
    dd = card(d, d.lateDefense ?? d.plan.defense);
  const tie =
    d.stronghold === 'habbanya_ridge_sietch' ? 'defender' : 'attacker';
  const stone =
    isStoneBurner(aw) || isStoneBurner(dw)
      ? stoneBurnerComparison(
          a.forces,
          a.plan.dial,
          a.plan.support,
          d.forces,
          d.plan.dial,
          d.plan.support,
          tie,
        )
      : null;
  if (stone) {
    requireQuote(
      !!stone.winner,
      'Stone Burner has an unresolved physical casualty allocation. No battle resources were spent.',
    );
    for (const [side, weapon] of [
      [a, aw],
      [d, dw],
    ] as const)
      requireQuote(
        !isStoneBurner(weapon) ||
          ['kill', 'ignore'].includes(side.stoneMode ?? ''),
        'Choose Stone Burner’s revealed mode before resolving battle.',
      );
  }
  requireQuote(
    Array.isArray(input.voters) &&
      new Set(input.voters.map((v) => v.id)).size === input.voters.length &&
      [a, d].every((s) =>
        input.voters.some((v) => v.id === s.id && v.beneficiary === s.id),
      ),
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
  // CHOAM's prepaid ally contribution is excluded from this receipt.
  const choamAmount =
    input.advanced && choam && !ac && !dc
      ? [a, d].reduce(
          (sum, s) =>
            sum +
            (s.id === choam.id
              ? 0
              : Math.floor((s.plan.support - (s.plan.allyPayment ?? 0)) / 2)),
          0,
        )
      : 0;
  const explosion = battleWeaponsExplode(aw, ad, dw, dd);
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
  let winner: ResolutionCombatant | null = null;
  let effects: BattleResolutionQuote['effects'] = null;
  let scores: BattleResolutionQuote['scores'] = null;
  let deaths = { attacker: false, defender: false };
  let bounty: BattleResolutionQuote['bounty'] = null;
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
      ad,
      dw,
      dd,
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
    scores = {
      attacker:
        a.plan.dial +
        (deaths.attacker || effects.stunned
          ? 0
          : strengths.attacker + (a.plan.kwisatz ? 2 : 0)),
      defender:
        d.plan.dial +
        (deaths.defender || effects.stunned
          ? 0
          : strengths.defender + (d.plan.kwisatz ? 2 : 0)),
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
  const destroyedArmies =
    result === 'explosion'
      ? input.participants.map((p) => p.id)
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
  if (winner && result === 'normal') {
    if (input.advanced || winner.faction === 'ixians') {
      const options = casualtyOptions(
        winner.forces,
        winner.plan.dial,
        winner.plan.support,
      );
      requireQuote(
        options.length > 0,
        'No valid casualty choice remains for this battle.',
      );
      casualties = {
        forces: { ...winner.forces },
        dial: winner.plan.dial,
        support: winner.plan.support,
        options,
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
  const moritani = input.participants.find((p) => p.faction === 'moritani');
  if (winner && moritani) {
    const loser = winner === a ? d : a,
      loserPlayed = loser === a ? played.attacker : played.defender;
    const eligible = loserPlayed.filter((selected) =>
      canRetainBattleCard(
        card(loser, selected)!,
        ac || dc,
        !!loser.poisonTooth,
      ),
    );
    if (
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
        played: [...loserPlayed],
        eligible,
        stage: 'choose',
      };
    }
  }
  const discarded = [a, d].flatMap((s) =>
    (s === a ? played.attacker : played.defender)
      .filter(
        (selected) =>
          !(
            retention?.player === s.id && retention.played.includes(selected)
          ) &&
          (winner !== s ||
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
    result,
    winner: winner?.id ?? null,
    attackerTraitor: ac,
    defenderTraitor: dc,
    revelations,
    leaderStrengths: strengths,
    leaderDeaths: deaths,
    scores,
    stone,
    effects,
    explosion,
    payments,
    choamIncome:
      choam && choamAmount > 0
        ? { owner: choam.id, amount: choamAmount }
        : null,
    bounty,
    strongholdIncome,
    destroyedArmies,
    basicWinnerLosses,
    casualties,
    played,
    discarded,
    winnerCards,
    retention,
    auditor,
  };
}
