import type { Game, ResponseWindow, Player } from './engine';
import { isAuditorLeader } from './choam-auditor';
import { controlsLeader } from './leader-control';
import {
  eliteRevivalRemaining,
  forceRevivalLimit,
  forceRevivalQuote,
  forceRevivalRemaining,
  newRevivalRules,
  type RevivalRules,
} from './revival';

type Pending = NonNullable<Game['pendingRevival']>;
export type RevivalCancellationKind =
  | 'choamRevival'
  | 'revivalLimit'
  | 'revivalDiscount'
  | 'earlyRevival'
  | 'foreignGhola';
export type RevivalCancellationContext = Pick<
  Game,
  | 'status'
  | 'phase'
  | 'turn'
  | 'advanced'
  | 'players'
  | 'revivalRules'
  | 'freeRevival'
  | 'pendingRevival'
  | 'emperorExtra'
>;
export type RevivalCancellationQuote = {
  rules: RevivalRules;
  pending: Pending | null;
  outcome: 'abandoned' | 'response' | 'unfunded' | 'fremenLimit' | 'revive';
  nextResponse?: {
    kind: RevivalCancellationKind;
    owner: string;
    recipient: string;
  };
  block?: {
    kind: 'earlyRevival' | 'foreignGhola';
    player: string;
    leader: string;
  };
};
export class RevivalCancellationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RevivalCancellationError';
  }
}
function requireRevival(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new RevivalCancellationError(message);
}
const nonnegative = (n: unknown): n is number =>
  Number.isSafeInteger(n) && (n as number) >= 0;

export function continuationCustody(
  g: RevivalCancellationContext,
  p: Player,
  pending: Pending,
) {
  if (pending.kind === 'forces') {
    const n = pending.amount!,
      elite = pending.elite ?? 0;
    requireRevival(
      nonnegative(p.tanks) && nonnegative(p.reserves) && n <= p.tanks,
      'The pending revival forces are no longer in the tanks.',
    );
    requireRevival(
      nonnegative(p.reserves + n) &&
        nonnegative(p.revived) &&
        (pending.emperorExtra
          ? nonnegative(g.emperorExtra[p.id] ?? 0) &&
            nonnegative((g.emperorExtra[p.id] ?? 0) + n)
          : nonnegative(p.revived + n) &&
            ((p.freeForcesRevived === undefined && p.revived !== 0) ||
              (nonnegative(p.freeForcesRevived ?? 0) &&
                nonnegative((p.freeForcesRevived ?? 0) + pending.free)))),
      'The pending revival would overflow its force or revival counters.',
    );
    if (p.elites)
      requireRevival(
        nonnegative(p.elites.reserves) &&
          p.elites.reserves <= p.reserves &&
          nonnegative(p.elites.revived) &&
          nonnegative(p.elites.reserves + elite) &&
          nonnegative(p.elites.revived + elite),
        'The pending revival would overflow its elite counters.',
      );
    const eliteTanks = p.elites?.tanks ?? 0;
    requireRevival(
      nonnegative(eliteTanks) &&
        eliteTanks <= p.tanks &&
        elite <= eliteTanks &&
        n - elite <= p.tanks - eliteTanks &&
        elite <= eliteRevivalRemaining(p),
      'The pending ordinary and elite revival groups no longer match their tanks.',
    );
    return;
  }
  if (pending.kind === 'kwisatz') {
    requireRevival(g.advanced, 'Kwisatz revival requires Advanced rules.');
    requireRevival(
      p.faction === 'atreides' &&
        p.kwisatz?.dead &&
        !p.leaderRevived &&
        nonnegative(p.revivalCycle) &&
        nonnegative(p.kwisatz.revivalCycle ?? 1) &&
        nonnegative(Math.max(p.revivalCycle, p.kwisatz.revivalCycle ?? 1) + 1),
      'The pending Kwisatz Haderach is no longer available for revival.',
    );
    return;
  }
  const matches = g.players
    .flatMap((owner) => owner.leaders.map((leader) => ({ owner, leader })))
    .filter(({ leader }) => leader.id === pending.leader);
  requireRevival(
    matches.length === 1,
    'The pending revival needs one physical leader.',
  );
  const { owner, leader } = matches[0];
  requireRevival(
    leader.dead && !leader.capturedBy,
    'The pending leader is no longer available in the tanks.',
  );
  if (pending.kind === 'foreignGhola') {
    requireRevival(
      p.faction === 'tleilaxu' &&
        leader.faction !== p.faction &&
        !isAuditorLeader(leader),
      'The pending foreign ghola has invalid leader custody.',
    );
    requireRevival(
      g.players
        .flatMap((seat) => seat.leaders)
        .filter((l) => controlsLeader(p, l) && !l.dead).length < 5,
      'Foreign gholas may fill the active leader pool only up to five.',
    );
  } else {
    requireRevival(
      owner.id === p.id &&
        !leader.gholaBy &&
        (!p.leaderRevived || p.faction === 'tleilaxu'),
      'The pending native leader is no longer available to this faction.',
    );
  }
}

/** Pure prediction of the existing canceled-revival branches. No resource,
 * leader, rule, response, or random state is changed. The returned pending
 * keeps its remaining checks unshifted for exactly one real finishRevival. */
export function quoteRevivalCancellation(
  g: RevivalCancellationContext,
  response: Pick<ResponseWindow, 'kind' | 'owner' | 'recipient'>,
): RevivalCancellationQuote {
  const original = g.pendingRevival;
  const p = g.players.find((p) => p.id === original?.player);
  const owner = g.players.find((p) => p.id === response.owner);
  requireRevival(
    g.status === 'playing' &&
      g.phase === 4 &&
      Number.isSafeInteger(g.turn) &&
      g.turn >= 1 &&
      original &&
      p &&
      owner &&
      response.recipient === p.id &&
      [
        'choamRevival',
        'revivalLimit',
        'revivalDiscount',
        'earlyRevival',
        'foreignGhola',
      ].includes(response.kind),
    'This revival cancellation no longer matches its current owner and recipient.',
  );
  const kind = response.kind as RevivalCancellationKind;
  requireRevival(
    kind === 'choamRevival'
      ? owner.id === p.id && p.faction === 'choam' && original.kind === 'forces'
      : owner.faction === 'tleilaxu',
    'This faction does not own the pending revival benefit.',
  );
  requireRevival(
    ['forces', 'leader', 'kwisatz', 'foreignGhola'].includes(original.kind) &&
      nonnegative(original.cost) &&
      nonnegative(original.normalCost) &&
      original.cost <= original.normalCost &&
      nonnegative(original.free) &&
      Array.isArray(original.checks) &&
      original.checks.length <= 1 &&
      original.checks.every((check) => check === 'revivalDiscount') &&
      (kind !== 'revivalDiscount' || original.checks.length === 0) &&
      (original.payer === undefined ||
        (typeof original.payer === 'string' &&
          original.payer.length > 0 &&
          g.players.some((seat) => seat.id === original.payer))) &&
      (original.emperorExtra === undefined ||
        typeof original.emperorExtra === 'boolean'),
    'The pending revival has invalid costs or remaining benefit checks.',
  );
  requireRevival(
    (kind !== 'revivalLimit' || original.kind === 'forces') &&
      (kind !== 'earlyRevival' ||
        original.kind === 'leader' ||
        original.kind === 'kwisatz') &&
      (kind !== 'foreignGhola' || original.kind === 'foreignGhola') &&
      (original.kind !== 'foreignGhola' || p.faction === 'tleilaxu'),
    'The canceled benefit does not belong to this revival kind.',
  );
  if (original.kind === 'forces') {
    requireRevival(
      nonnegative(original.amount) &&
        original.amount > 0 &&
        nonnegative(original.elite ?? 0) &&
        (original.elite ?? 0) <= original.amount &&
        original.free <= original.amount &&
        !original.leader &&
        nonnegative(p.revived),
      'The pending force revival has invalid physical counts.',
    );
  } else {
    requireRevival(
      original.free === 0 &&
        original.amount === undefined &&
        original.elite === undefined &&
        (original.kind === 'kwisatz'
          ? original.leader === undefined || original.leader === 'kwisatz'
          : typeof original.leader === 'string' && !!original.leader),
      'The pending leader revival has invalid identity or force fields.',
    );
    if (original.kind === 'kwisatz') {
      requireRevival(
        g.advanced && p.faction === 'atreides' && !!p.kwisatz,
        'The pending Kwisatz Haderach belongs to no valid revival pool.',
      );
    } else {
      const matches = g.players
        .flatMap((seat) => seat.leaders.map((leader) => ({ seat, leader })))
        .filter(({ leader }) => leader.id === original.leader);
      requireRevival(
        matches.length === 1 &&
          (original.kind === 'leader'
            ? matches[0].seat.id === p.id
            : g.advanced &&
              matches[0].leader.faction !== p.faction &&
              !isAuditorLeader(matches[0].leader)),
        'The pending revival needs its original physical leader pool.',
      );
    }
  }
  const rules = { ...newRevivalRules(), ...g.revivalRules };
  requireRevival(
    Array.isArray(rules.expanded) &&
      Array.isArray(rules.earlyBlocked) &&
      (rules.freeBlocked === undefined || Array.isArray(rules.freeBlocked)),
    'The pending revival rule context is invalid.',
  );
  rules.expanded = [...rules.expanded];
  rules.earlyBlocked = [...rules.earlyBlocked];
  if (rules.freeBlocked) rules.freeBlocked = [...rules.freeBlocked];
  const pending: Pending = { ...original, checks: [...original.checks] };
  const context = { ...g, revivalRules: rules };
  if (kind === 'revivalLimit') {
    rules.limitBlocked = true;
    rules.expanded = [];
    return { rules, pending: null, outcome: 'abandoned' };
  }
  if (kind === 'earlyRevival' || kind === 'foreignGhola') {
    const leader = pending.leader ?? 'kwisatz';
    if (kind === 'earlyRevival') rules.earlyBlocked.push(`${p.id}:${leader}`);
    return {
      rules,
      pending: null,
      outcome: 'abandoned',
      block: { kind, player: p.id, leader },
    };
  }
  if (kind === 'choamRevival') {
    rules.choamBlocked = true;
    if (p.revived + pending.amount! > forceRevivalLimit(context, p))
      return { rules, pending: null, outcome: 'abandoned' };
    Object.assign(pending, forceRevivalQuote(context, p, pending.amount!));
    pending.checks = [];
    if (p.revived + pending.amount! > 3) pending.checks.push('revivalLimit');
    if (pending.cost < pending.normalCost)
      pending.checks.push('revivalDiscount');
  } else {
    if (p.faction === 'tleilaxu') rules.fullPrice = true;
    else {
      rules.allyDiscount = null;
      rules.discountBlocked = true;
    }
    pending.cost =
      pending.kind === 'forces' &&
      p.faction === 'choam' &&
      !pending.emperorExtra
        ? forceRevivalQuote(context, p, pending.amount!, pending.elite).cost
        : pending.normalCost;
  }
  const check = pending.checks[0];
  if (!check) {
    if (
      pending.kind === 'forces' &&
      !pending.emperorExtra &&
      p.faction === 'fremen' &&
      pending.amount! > forceRevivalRemaining(context, p)
    )
      return { rules, pending, outcome: 'fremenLimit' };
    const payer = g.players.find(
      (seat) => seat.id === (pending.payer ?? p.id),
    )!;
    requireRevival(
      nonnegative(payer.spice),
      'The revival payer has an invalid spice balance.',
    );
    if (payer.spice < pending.cost)
      return { rules, pending, outcome: 'unfunded' };
  }
  continuationCustody(g, p, pending);
  if (check) {
    const nextOwner =
      check === 'choamRevival'
        ? p
        : g.players.find((seat) => seat.faction === 'tleilaxu');
    requireRevival(
      nextOwner,
      'The remaining revival benefit has no faction owner.',
    );
    return {
      rules,
      pending,
      outcome: 'response',
      nextResponse: { kind: check, owner: nextOwner.id, recipient: p.id },
    };
  }
  return { rules, pending, outcome: 'revive' };
}
