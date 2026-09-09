import type { Decision, Game, ResponseWindow } from './engine';
import type { PendingRevival } from './revival';
import { forceRevivalRemaining, freeRevivalRemaining } from './revival';
import {
  continuationCustody,
  RevivalCancellationError,
} from './revival-cancellation';
import { isAuditorLeader } from './choam-auditor';
import { controlsLeader } from './leader-control';
import { TECH_TOKENS, ownedTech } from './tech-tokens';
import { tleilaxuHomeworldFreeIncomeBlocked } from './homeworld-benefits';

export type RevivalResumeContext = Pick<
  Game,
  | 'status'
  | 'phase'
  | 'turn'
  | 'advanced'
  | 'homeworlds'
  | 'homeworldRevival'
  | 'players'
  | 'pendingRevival'
  | 'revivalRules'
  | 'freeRevival'
  | 'emperorExtra'
  | 'techTokens'
  | 'revivalFreeIncome'
  | 'dukeVidal'
  | 'revivalRequests'
>;
export type RevivalResumeQuote = {
  /** The frozen request, including the unshifted remaining check queue. */
  pending: PendingRevival;
  outcome: 'decision' | 'response' | 'unfunded' | 'fremenLimit' | 'revive';
  nextDecision?: Extract<Decision, { kind: 'revivalStop' }>;
  nextResponse?: ResponseWindow;
  techIncome?: {
    id: 'axlotl';
    owner: string;
    spice: number;
    triggeredTurn: number;
  };
  freeIncome?: { player: string; turn: number };
};
export class RevivalResumeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RevivalResumeError';
  }
}
function requireResume(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RevivalResumeError(message);
}
const count = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

/** Only the next deterministic continuation is quoted. A genuine stop decision
 * or benefit response is a boundary, even when the outer automatic-response
 * loop could later allow it. No benefit is canceled, repriced, or reoffered. */
export function quoteRevivalResume(
  g: RevivalResumeContext,
  stage: 'stop' | 'finish',
): RevivalResumeQuote {
  const original = g.pendingRevival;
  requireResume(
    (stage === 'stop' || stage === 'finish') &&
      g.status === 'playing' &&
      g.phase === 4 &&
      count(g.turn) &&
      g.turn > 0 &&
      original &&
      typeof original === 'object' &&
      !Array.isArray(original) &&
      Array.isArray(g.players) &&
      new Set(g.players.map((p) => p.id)).size === g.players.length,
    'The pending revival has no current Revival-phase context.',
  );
  const p = g.players.find((p) => p.id === original.player);
  const tleilaxu = g.players.find((p) => p.faction === 'tleilaxu');
  const payer = g.players.find(
    (p) => p.id === (original.payer ?? original.player),
  );
  requireResume(
    p &&
      payer &&
      ['forces', 'leader', 'kwisatz', 'foreignGhola'].includes(original.kind) &&
      count(original.cost) &&
      count(original.normalCost) &&
      original.cost <= original.normalCost &&
      count(original.free) &&
      (original.emperorExtra === undefined ||
        typeof original.emperorExtra === 'boolean') &&
      (original.payer === undefined || typeof original.payer === 'string'),
    'The pending revival has invalid ownership, kind, or frozen costs.',
  );
  requireResume(
    original.emperorExtra
      ? original.kind === 'forces' &&
          payer.faction === 'emperor' &&
          payer.id !== p.id &&
          original.free === 0 &&
          original.cost === original.normalCost
      : original.payer === undefined,
    'The pending revival has an invalid Emperor funding source.',
  );
  if (original.kind === 'forces') {
    requireResume(
      count(original.amount) &&
        original.amount > 0 &&
        count(original.elite ?? 0) &&
        (original.elite ?? 0) <= original.amount &&
        original.free <= original.amount &&
        original.leader === undefined &&
        count(p.revived),
      'The pending force revival has invalid physical counts.',
    );
    const paid = original.amount - original.free;
    // Supported pending-revival overlays cannot move native forces or consume
    // ordinary revival usage. Validate the accepted group's free allocation
    // before settlement crosses a population threshold. A later independent
    // request gets the rate at its own declaration.
    if (g.homeworlds && !original.emperorExtra)
      requireResume(
        original.free ===
          Math.min(original.amount, freeRevivalRemaining(g, p)),
        'The saved Homeworld revival free allocation does not match its current eligible group.',
      );
    const elite = original.elite ?? 0;
    const freeCyborgs = paid * 2 + elite - original.normalCost;
    requireResume(
      count(paid * 2) &&
        (p.faction === 'ixians'
          ? count(freeCyborgs) &&
            freeCyborgs >=
              Math.max(0, original.free - (original.amount - elite)) &&
            freeCyborgs <= Math.min(original.free, elite)
          : original.normalCost === paid * 2),
      'The frozen normal revival price does not match its paid physical forces.',
    );
    const prices = [original.normalCost, Math.ceil(original.normalCost / 2)];
    if (p.faction === 'choam' && !original.emperorExtra)
      prices.push(paid, Math.ceil(paid / 2));
    requireResume(
      prices.includes(original.cost),
      'The frozen revival charge does not match a supported force-revival rate.',
    );
  } else {
    requireResume(
      original.free === 0 &&
        original.amount === undefined &&
        original.elite === undefined &&
        !original.emperorExtra &&
        (original.kind === 'kwisatz'
          ? g.advanced &&
            p.faction === 'atreides' &&
            !!p.kwisatz &&
            (original.leader === undefined || original.leader === 'kwisatz')
          : typeof original.leader === 'string' && original.leader.length > 0),
      'The pending leader revival has invalid identity or force fields.',
    );
  }
  const allowed: PendingRevival['checks'] =
    original.kind === 'forces'
      ? [
          p.faction === 'choam' ? 'choamRevival' : 'revivalLimit',
          'revivalDiscount',
        ]
      : [
          original.kind === 'foreignGhola' ? 'foreignGhola' : 'earlyRevival',
          'revivalDiscount',
        ];
  // CHOAM can also use the ordinary expanded limit after its own benefit was
  // canceled. This is a real finishRevival producer, not a new price calculation.
  if (
    original.kind === 'forces' &&
    p.faction === 'choam' &&
    original.checks?.[0] === 'revivalLimit'
  )
    allowed[0] = 'revivalLimit';
  requireResume(
    Array.isArray(original.checks) &&
      original.checks.length <= 2 &&
      original.checks.every(
        (check, index) =>
          allowed.includes(check) &&
          (index === 0 ||
            allowed.indexOf(check) >
              allowed.indexOf(original.checks[index - 1])),
      ) &&
      (!original.emperorExtra || original.checks.length === 0) &&
      original.checks.every((check) => check === 'choamRevival' || !!tleilaxu),
    'The pending revival has invalid ordered benefit checks or no benefit owner.',
  );
  if (original.kind === 'foreignGhola')
    requireResume(
      g.advanced && p.faction === 'tleilaxu',
      'Foreign ghola revival requires Advanced Tleilaxu.',
    );
  const pending: PendingRevival = { ...original, checks: [...original.checks] };
  const quote: RevivalResumeQuote = { pending, outcome: 'revive' };
  const stop =
    stage === 'stop' &&
    g.advanced &&
    tleilaxu &&
    !tleilaxu.specialKaramaUsed &&
    tleilaxu.id !== p.id;
  const check = pending.checks[0];

  // These are existing noncommitting fizzle branches. Do not require the
  // denied forces/leader or destination capacity to complete an unfunded request.
  if (!stop && !check) {
    if (
      pending.kind === 'forces' &&
      !pending.emperorExtra &&
      p.faction === 'fremen'
    ) {
      requireResume(
        Array.isArray(g.freeRevival) &&
          count(p.tanks) &&
          (!g.revivalRules ||
            (Array.isArray(g.revivalRules.expanded) &&
              (g.revivalRules.freeBlocked === undefined ||
                Array.isArray(g.revivalRules.freeBlocked)))),
        'The pending Fremen revival has invalid current allowance context.',
      );
      if (pending.amount! > forceRevivalRemaining(g, p))
        return { ...quote, outcome: 'fremenLimit' };
    }
    requireResume(
      count(payer.spice),
      'The revival payer has an invalid spice balance.',
    );
    if (payer.spice < pending.cost) return { ...quote, outcome: 'unfunded' };
  }

  if (pending.kind === 'forces' || pending.kind === 'kwisatz') {
    requireResume(
      !pending.emperorExtra ||
        (g.emperorExtra && typeof g.emperorExtra === 'object'),
      'The Emperor extra-revival counters are unavailable.',
    );
    try {
      continuationCustody(g, p, pending);
    } catch (error) {
      if (error instanceof RevivalCancellationError)
        throw new RevivalResumeError(error.message);
      throw error;
    }
  } else {
    const matches = g.players
      .flatMap((owner) => owner.leaders.map((leader) => ({ owner, leader })))
      .filter(({ leader }) => leader.id === pending.leader);
    requireResume(
      matches.length === 1 &&
        matches[0].leader.dead &&
        !matches[0].leader.capturedBy,
      'The pending revival needs one dead, uncaptured physical leader.',
    );
    const { owner, leader } = matches[0];
    if (pending.kind === 'foreignGhola') {
      const living =
        g.players
          .flatMap((seat) => seat.leaders)
          .filter((leader) => controlsLeader(p, leader) && !leader.dead)
          .length +
        (g.dukeVidal?.controller === p.id &&
        !g.dukeVidal.leader.dead &&
        !g.dukeVidal.leader.capturedBy &&
        !g.dukeVidal.leader.gholaBy &&
        !(g.advanced && g.players.some((seat) => seat.faction === 'harkonnen'))
          ? 1
          : 0);
      requireResume(
        leader.faction !== p.faction && !isAuditorLeader(leader) && living < 5,
        'The pending foreign ghola has invalid leader identity or active pool capacity.',
      );
    } else {
      // A negotiated native buyback may still carry the Tleilaxu ghola marker.
      // The original approved request survives while benefit checks are answered.
      const request = g.revivalRequests?.[p.id];
      const buyback =
        !!tleilaxu &&
        leader.gholaBy === tleilaxu.id &&
        request?.leader === leader.id &&
        request.price === pending.cost &&
        !request.declined;
      requireResume(
        owner.id === p.id &&
          (!leader.gholaBy || buyback) &&
          (!p.leaderRevived || p.faction === 'tleilaxu'),
        'The pending native leader no longer belongs to this revival request.',
      );
    }
  }
  if (stop)
    return {
      ...quote,
      outcome: 'decision',
      nextDecision: {
        kind: 'revivalStop',
        player: tleilaxu.id,
        recipient: p.id,
        revival: pending.kind === 'forces' ? 'forces' : 'leader',
      },
    };
  if (check)
    return {
      ...quote,
      outcome: 'response',
      nextResponse: {
        kind: check,
        owner: check === 'choamRevival' ? p.id : tleilaxu!.id,
        recipient: p.id,
        passed: [],
      },
    };
  if (
    pending.kind === 'forces' &&
    pending.free > 0 &&
    g.techTokens &&
    p.faction !== 'tleilaxu'
  ) {
    const token = g.techTokens.axlotl;
    requireResume(
      token && typeof token === 'object',
      'Axlotl Tanks technology state is unavailable.',
    );
    if (token.owner && token.triggeredTurn !== g.turn) {
      requireResume(
        g.players.some((p) => p.id === token.owner) &&
          count(token.spice) &&
          (token.triggeredTurn === undefined || count(token.triggeredTurn)) &&
          TECH_TOKENS.every((definition) => {
            const entry = g.techTokens![definition.id];
            return (
              !!entry &&
              (entry.owner === null ||
                g.players.some((p) => p.id === entry.owner))
            );
          }),
        'Axlotl Tanks technology income has invalid token custody.',
      );
      quote.techIncome = {
        id: 'axlotl',
        owner: token.owner,
        spice: ownedTech(g.techTokens, token.owner).length,
        triggeredTurn: g.turn,
      };
    }
  }
  if (tleilaxu) {
    const lastFree = g.revivalFreeIncome?.[payer.id];
    requireResume(
      lastFree === undefined || count(lastFree),
      'The revival free-income receipt is invalid.',
    );
    const free = pending.free > 0;
    const reward =
      free &&
      lastFree !== g.turn &&
      !(payer.id !== tleilaxu.id && tleilaxuHomeworldFreeIncomeBlocked(g));
    if (free) quote.freeIncome = { player: payer.id, turn: g.turn };
    const amount =
      (payer.id === tleilaxu.id ? 0 : pending.cost) + (reward ? 1 : 0);
    requireResume(
      count(amount),
      'The resulting revival income exceeds a safe spice amount.',
    );
    if (amount)
      quote.nextResponse = {
        kind: 'revivalIncome',
        owner: tleilaxu.id,
        recipient: payer.id,
        amount,
        passed: [],
      };
  }
  return quote;
}
