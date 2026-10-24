import { gameTerritories, splitLocation, type MobileBoard } from './board';
import type { FactionId } from './catalog';
import { presenceAt, type ForcePresence } from './force-presence';

export type SpiritualAdvisorSource = {
  event: string;
  owner: string;
  turn: number;
  phase: number;
  territory: string;
  sector: number;
  amount: number;
};

export type SpiritualAdvisorPlayer = ForcePresence & {
  id: string;
  faction: FactionId;
  advisors?: Readonly<Record<string, unknown>>;
};

export type SpiritualAdvisorBoardContext = {
  advanced: boolean;
  players: readonly SpiritualAdvisorPlayer[];
};

export type SpiritualAdvisorContext = SpiritualAdvisorBoardContext & MobileBoard & {
  status: string;
  turn: number;
  phase: number;
};

export type SpiritualAdvisorTarget = string | { territory: string; sector?: number };

export class SpiritualAdvisorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpiritualAdvisorError';
  }
}

const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const positive = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) > 0;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
function requireSpiritual(value: unknown, message: string): asserts value {
  if (!value) throw new SpiritualAdvisorError(message);
}

function nativeOwner(ctx: SpiritualAdvisorBoardContext, owner: string) {
  const players = ctx.players.filter((player) => player.id === owner);
  return players.length === 1 && players[0].faction === 'beneGesserit' ? players[0] : undefined;
}

function territoryId(target: SpiritualAdvisorTarget) {
  return typeof target === 'string' ? target : target.territory;
}

function hasResidents(player: SpiritualAdvisorPlayer, territory: string) {
  return Object.entries(player.forces).some(([key, count]) =>
    splitLocation(key).territory === territory && count > 0);
}

/** Physical28's Advanced Spiritual exception does not change ordinary arrival.
 * Polar Sink retains the selected provisional fallback, even with BG fighters. */
export function spiritualAdvisorTargetBlock(
  ctx: SpiritualAdvisorBoardContext,
  owner: string,
  target: SpiritualAdvisorTarget,
): string | null {
  if (!ctx.advanced) return null;
  const player = nativeOwner(ctx, owner);
  if (!player) return 'Spiritual Advisors need the current native Bene Gesserit owner.';
  const territory = territoryId(target);
  if (territory === 'polar_sink') return null;
  return hasResidents(player, territory) && !player.advisors?.[territory]
    ? 'Advanced Spiritual Advisors cannot accompany into a non-Polar territory containing your fighters; choose the Polar Sink or decline. Intrusion that already made them advisors removes this block.'
    : null;
}

/** Describe the incoming advisor group; target and resource permission remain
 * separate. No resident group or prior continuously-alone hold is changed. */
export function spiritualAdvisorArrival(
  ctx: SpiritualAdvisorBoardContext,
  owner: string,
  target: SpiritualAdvisorTarget,
): { advisors: boolean; matching: boolean; alone: boolean } {
  if (!ctx.advanced) return { advisors: false, matching: false, alone: false };
  const player = nativeOwner(ctx, owner);
  requireSpiritual(player, 'Spiritual Advisors need the current native Bene Gesserit owner.');
  const territory = territoryId(target);
  const matching = hasResidents(player, territory) && !player.advisors?.[territory];
  return {
    advisors: !matching,
    matching,
    alone: !ctx.players.some((other) => other.id !== owner && presenceAt(other, territory) > 0),
  };
}

/** Original foreign-shipment event and packet bind a prevented matching retry.
 * Destination sector does not create another use of the same opportunity. */
export function spiritualAdvisorMatchingKey(source: SpiritualAdvisorSource): string {
  return JSON.stringify([
    'spiritualAdvisorMatching', source.event, source.owner, source.turn, source.territory, source.amount,
  ]);
}

/** Public receipt only. Native resource entitlement and target permissions are
 * checked by the original shipment parent, before any physical placement. */
export function validateSpiritualAdvisorSource(ctx: SpiritualAdvisorContext, source: SpiritualAdvisorSource): void {
  requireSpiritual(record(source) &&
    Object.keys(source).sort().join(',') === 'amount,event,owner,phase,sector,territory,turn' &&
    identifier(source.event) && identifier(source.owner) && positive(source.turn) && source.turn === ctx.turn &&
    source.phase === ctx.phase && [1, 3, 5, 8].includes(source.phase) && ctx.status === 'playing' &&
    identifier(source.territory) && Number.isSafeInteger(source.sector) && source.sector >= 0 &&
    (source.amount === 1 || source.amount === 2),
  'Spiritual Advisors lost their exact current-turn public shipment source.');
  requireSpiritual(nativeOwner(ctx, source.owner), 'Spiritual Advisors lost their current native Bene Gesserit owner.');
  requireSpiritual(gameTerritories(ctx).some((place) =>
    place.id === source.territory && place.sectors.includes(source.sector)),
  'Spiritual Advisors need their current board destination and sector.');
}
