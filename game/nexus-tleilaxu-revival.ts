import type { Game, Player } from './engine';
import { DUKE_VIDAL_ID } from './duke-vidal';
import { nexusCardMode } from './nexus-cards';
import {
  eliteRevivalRemaining,
  leaderRevivalOptions,
  normalForceRevivalLimit,
} from './revival';

/** The panel's own force group is fixed at five exact counters. */
export const NEXUS_TLEILAXU_FORCE_GROUP_CAP = 5;
/** Every counter of that group, typed or not, costs one bank spice; none is free. */
export const NEXUS_TLEILAXU_FORCE_PRICE = 1;

/**
 * Provisional composed policy, not a publisher or user numerical ruling.
 * `docs/NEXUS_TLEILAXU_RULES.md` leaves three questions open (independent versus
 * ordinary force allowance, waived leader prerequisites, optional leader
 * portion). This module deliberately answers them the conservative way and
 * publishes the answer instead of narrowing the effect silently.
 */
export const NEXUS_TLEILAXU_POLICY =
  'Provisional composed policy. One combined action during a quiet Revival by the unallied actual holder of the Tleilaxu Nexus card in a game where Tleilaxu is absent: exactly one own dead leader (or an eligible Kwisatz Haderach / own shared Duke) returns free and uses the ordinary one-leader slot, and that leader portion is mandatory, so a force-only return is unavailable. The card waives only the unavailable-roster trigger, so repeated-death/face-down cycles, the one-leader slot and every special identity custody rule still gate candidates. Up to five exact physical counters return from the same shared ordinary ceiling, which this grant raises to at least five (earlier ordinary returns count against it, CHOAM\'s larger native ceiling is not reduced, and Recruits never doubles this fixed group); each counter costs one bank spice, typed counters included, and none is free or Cyborg-priced. Zero forces is permitted. Advanced Fedaykin/Sardaukar keep the one-per-turn cap across producers; Ixian Cyborgs have no matching cap. Paid card counters are not free forces.';

export type TleilaxuSecretAllyKind = 'leader' | 'kwisatz' | 'duke';
export type TleilaxuSecretAllyLeader = {
  id: string;
  name: string;
  kind: TleilaxuSecretAllyKind;
  /** True only when the card's waiver, rather than the ordinary roster trigger, offers this candidate. */
  early: boolean;
};
export type TleilaxuSecretAllyOptions = {
  event: string;
  blocked: string | null;
  leaders: TleilaxuSecretAllyLeader[];
  maxForces: number;
  maxElite: number;
  policy: string;
};
export type TleilaxuSecretAllySelection = {
  leader: string;
  amount: number;
  elite: number;
};
export type TleilaxuSecretAllyQuote = {
  leader: string;
  kind: TleilaxuSecretAllyKind;
  amount: number;
  elite: number;
  /** Exact bank spice for this group; the leader adds nothing. */
  cost: number;
  /** Maximum legal counter count for the same state, so callers never guess the bound. */
  limit: number;
};
/** Physical counter bounds of the card group for one holder and state. */
export type TleilaxuSecretAllyForceBounds = {
  /** Ordinary ceiling after this grant's floor of five. */
  ceiling: number;
  normalTanks: number;
  eliteTanks: number;
  /** Typed counters that may return under the one-per-turn cap and physical inventory. */
  eliteRoom: number;
  maxForces: number;
  maxElite: number;
};

export type TleilaxuSecretAllyFailure =
  | 'source'
  | 'timing'
  | 'leader'
  | 'forces'
  | 'price';

export class TleilaxuSecretAllyError extends Error {
  constructor(
    message: string,
    readonly reason: TleilaxuSecretAllyFailure,
  ) {
    super(message);
    this.name = 'TleilaxuSecretAllyError';
  }
}

const leaderBlock =
  'Tleilaxu Secret Ally needs one own dead leader, and zero forces does not replace it.';
const noSource =
  'Only the actual holder of the Tleilaxu Nexus card may use Tleilaxu Secret Ally.';
const whole = (n: unknown): n is number =>
  Number.isSafeInteger(n) && (n as number) >= 0;
/** Cheap Hero/Heroine are Treachery cards, never leader discs in custody. */
const discId = (id: string) => !id.startsWith('treachery-');

export const tleilaxuSecretAllyEvent = (
  g: Pick<Game, 'turn' | 'phase'>,
  p: Pick<Player, 'id'>,
) => JSON.stringify(['nexusTleilaxuSecretAlly', g.turn, g.phase, p.id]);

function heldCard(g: Game, p: Player) {
  return g.nexusCards?.cards?.hands?.[p.id] === 'tleilaxu';
}

/** Quiet Revival: no other interaction, reaction or pending revival owns the board. */
function interrupted(g: Game) {
  return !!(
    g.response ||
    g.decision ||
    g.phaseOpening ||
    g.pendingRevival ||
    g.pendingKarama ||
    g.pendingTreacheryDiscard ||
    g.pendingNullentropy ||
    g.pendingExchange ||
    g.pendingRicheseGift ||
    g.pendingAmbassador ||
    g.pendingCapture ||
    g.battle ||
    g.nexusTraitorPending ||
    g.nexusTraitorParent ||
    g.nexusCards?.phase?.stage === 'drawing' ||
    (g.homeworldRevivalReturn && g.homeworldRevivalReturn.stage !== 'complete')
  );
}

/** Actual held card, printed mode, unallied actor and quiet Revival only.
 * A projected offer is not authority: validate the physical held card again. */
function sourceState(
  g: Game,
  p: Player,
): { reason: TleilaxuSecretAllyFailure; message: string } | null {
  if (!heldCard(g, p)) return { reason: 'source', message: noSource };
  if (p.ally)
    return { reason: 'source', message: 'An allied player cannot use a Nexus card.' };
  let mode: string;
  try {
    mode = nexusCardMode(
      'tleilaxu',
      p.faction,
      g.players.map((seat) => seat.faction),
    );
  } catch {
    return { reason: 'source', message: 'The Nexus custody does not describe this table.' };
  }
  if (mode !== 'secretAlly')
    return {
      reason: 'source',
      message:
        'Tleilaxu Secret Ally needs Tleilaxu absent from the seated roster and a non-Tleilaxu holder.',
    };
  if (g.status !== 'playing')
    return { reason: 'timing', message: 'Nexus effects belong to the started game.' };
  if (g.phase !== 4)
    return { reason: 'timing', message: 'Use Tleilaxu Secret Ally during Revival.' };
  if (interrupted(g))
    return {
      reason: 'timing',
      message: 'Finish the current interaction before using Tleilaxu Secret Ally.',
    };
  return null;
}

export function tleilaxuSecretAllyBlock(g: Game, p: Player): string | null {
  return sourceState(g, p)?.message ?? null;
}

/** An own physical disc, one of the only three leader identities this grant may return. */
function ownDisc(p: Player, id: string) {
  const leader = p.leaders.find((candidate) => candidate.id === id);
  return !!leader &&
    discId(leader.id) &&
    leader.faction === p.faction &&
    leader.dead === true &&
    !leader.capturedBy &&
    !leader.gholaBy;
}

/**
 * Canonical ordinary/Duke/Kwisatz eligibility plus the card's single waiver.
 * The waiver is expressed by pretending the ordinary cycle is open at level one;
 * repeated-death matching, the ordinary one-leader slot, the Auditor's own
 * special projection, Duke custody and every other eligibility rule stay the
 * canonical ones. Nothing here is written back: the caller must never store the
 * synthetic cycle, or an early grant would open later ordinary returns.
 */
function leaderCandidates(
  g: Game,
  p: Player,
): { leaders: TleilaxuSecretAllyLeader[]; dukeBlocked: string | null; cycleBlock: string | null } {
  const canonical = leaderRevivalOptions(g, p);
  const waived = leaderRevivalOptions(g, {
    ...p,
    revivalCycle: Math.max(1, p.revivalCycle),
  });
  const canonicalIds = new Set(canonical.leaders.map((option) => option.id));
  const blockedEarly = (id: string) =>
    !!g.revivalRules?.earlyBlocked?.includes(`${p.id}:${id}`);
  const leaders: TleilaxuSecretAllyLeader[] = [];
  const seen = new Set<string>();
  const push = (id: string, name: string, early: boolean) => {
    if (seen.has(id) || (early && blockedEarly(id))) return;
    // The shared Duke is not an own disc: its control/custody was already
    // resolved by the canonical Ecaz quote, so only own discs are re-checked.
    if (id !== DUKE_VIDAL_ID && !ownDisc(p, id)) return;
    seen.add(id);
    leaders.push({
      id,
      name,
      kind: id === DUKE_VIDAL_ID ? 'duke' : 'leader',
      early,
    });
  };
  for (const option of canonical.leaders)
    push(option.id, option.name, !canonicalIds.has(option.id));
  for (const option of waived.leaders)
    push(option.id, option.name, !canonicalIds.has(option.id));
  if (canonical.kwisatz || waived.kwisatz) {
    const early = !canonical.kwisatz && !blockedEarly('kwisatz');
    if (early || canonical.kwisatz)
      leaders.push({ id: 'kwisatz', name: 'Kwisatz Haderach', kind: 'kwisatz', early });
  }
  return {
    leaders,
    dukeBlocked: canonical.dukeBlocked,
    cycleBlock: canonical.cycleBlock,
  };
}

/**
 * Shared ordinary ceiling raised to at least five, minus earlier ordinary
 * returns, restricted to the exact physical typed counters in Tanks and to the
 * Advanced one-per-turn typed cap. Force and elite maxima are always jointly
 * attainable, so a caller may use both at once.
 */
export function tleilaxuSecretAllyForceBounds(
  g: Game,
  p: Player,
): TleilaxuSecretAllyForceBounds {
  const ceiling = Math.max(
    normalForceRevivalLimit(g, p),
    NEXUS_TLEILAXU_FORCE_GROUP_CAP,
  );
  const tanks = Math.max(0, p.tanks);
  const eliteTanks = Math.max(0, p.elites?.tanks ?? 0);
  const normalTanks = Math.max(0, tanks - eliteTanks);
  const eliteRoom = Math.min(eliteTanks, eliteRevivalRemaining(p, g.advanced));
  const maxForces = Math.min(
    NEXUS_TLEILAXU_FORCE_GROUP_CAP,
    Math.max(0, ceiling - p.revived),
    normalTanks + eliteRoom,
  );
  return {
    ceiling,
    normalTanks,
    eliteTanks,
    eliteRoom,
    maxForces,
    maxElite: Math.min(maxForces, eliteRoom),
  };
}

/** Owner-only projection input; blocked reasons name the real current limitation. */
export function tleilaxuSecretAllyOptions(
  g: Game,
  p: Player,
): TleilaxuSecretAllyOptions {
  const event = tleilaxuSecretAllyEvent(g, p);
  const blocked = tleilaxuSecretAllyBlock(g, p);
  if (blocked)
    return {
      event,
      blocked,
      leaders: [],
      maxForces: 0,
      maxElite: 0,
      policy: NEXUS_TLEILAXU_POLICY,
    };
  const bounds = tleilaxuSecretAllyForceBounds(g, p);
  const { leaders, dukeBlocked, cycleBlock } = leaderCandidates(g, p);
  return {
    event,
    blocked: leaders.length
      ? null
      : dukeBlocked ?? cycleBlock ?? leaderBlock,
    leaders,
    maxForces: bounds.maxForces,
    maxElite: bounds.maxElite,
    policy: NEXUS_TLEILAXU_POLICY,
  };
}

/**
 * Pure quote, no mutation, no randomness, no stored offer. Throws when the
 * physical card, actor, phase, quiet window, leader identity, exact typed group
 * or bank spice cannot support the selection, so a committed action always has
 * a legal quote. `limit` repeats the maximum legal amount for the same state.
 */
export function quoteTleilaxuSecretAlly(
  g: Game,
  p: Player,
  selection: TleilaxuSecretAllySelection,
): TleilaxuSecretAllyQuote {
  const source = sourceState(g, p);
  if (source) throw new TleilaxuSecretAllyError(source.message, source.reason);
  const { leaders, dukeBlocked, cycleBlock } = leaderCandidates(g, p);
  const chosen = leaders.find((leader) => leader.id === selection?.leader);
  if (!chosen)
    throw new TleilaxuSecretAllyError(
      leaders.length ? 'Choose one offered own leader.' : dukeBlocked ?? cycleBlock ?? leaderBlock,
      'leader',
    );
  const amount = selection.amount;
  const elite = selection.elite;
  const bounds = tleilaxuSecretAllyForceBounds(g, p);
  if (!whole(amount) || !whole(elite) || elite > amount)
    throw new TleilaxuSecretAllyError(
      'The card group needs a whole normal/typed counter split.',
      'forces',
    );
  if (
    amount > bounds.maxForces ||
    elite > bounds.eliteRoom ||
    amount - elite > bounds.normalTanks
  )
    throw new TleilaxuSecretAllyError(
      `The card group must fit ${bounds.maxForces} physical counters (at most ${bounds.maxElite} typed) from the shared ordinary ceiling of ${bounds.ceiling}.`,
      'forces',
    );
  const cost = amount * NEXUS_TLEILAXU_FORCE_PRICE;
  if (cost > p.spice)
    throw new TleilaxuSecretAllyError(
      'Not enough spice for one bank spice per returned counter.',
      'price',
    );
  return {
    leader: chosen.id,
    kind: chosen.kind,
    amount,
    elite,
    cost,
    limit: bounds.maxForces,
  };
}
