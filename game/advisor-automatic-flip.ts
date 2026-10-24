import type { FactionId } from './catalog';
import { gameTerritories, splitLocation, type MobileBoard } from './board';
import { presenceAt, type ForcePresence } from './force-presence';

export type AdvisorStance = {
  lockedTurn?: number;
  aloneFlipHold?: string;
};

export type AutomaticAdvisorTransport = {
  event: string;
  player: string;
  origin: string;
  to: string;
  sector: number;
  amount: number;
  elite: number;
  group: Record<string, number>;
};

export type AutomaticAdvisorFlipSource = {
  event: string;
  owner: string;
  territory: string;
  turn: number;
  phase: number;
  forces: Record<string, number>;
} & (
  | { producer: 'groundMovement'; mover: string; move: number }
  | { producer: 'guildTransport'; transport: AutomaticAdvisorTransport }
);

export type AutomaticAdvisorFlipPlayer = ForcePresence & {
  id: string;
  faction: FactionId;
  advisors?: Readonly<Record<string, AdvisorStance>>;
  moved?: number;
  shipped?: boolean;
  reserves?: number;
};

export type AdvisorSettlementContext = {
  advanced: boolean;
  players: readonly AutomaticAdvisorFlipPlayer[];
};

export type AutomaticAdvisorFlipContext = AdvisorSettlementContext & MobileBoard & {
  status: string;
  turn: number;
  phase: number;
};

export class AutomaticAdvisorFlipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AutomaticAdvisorFlipError';
  }
}

const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const positive = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) > 0;
const nonnegative = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
function requireFlip(value: unknown, message: string): asserts value {
  if (!value) throw new AutomaticAdvisorFlipError(message);
}

function physicalGroup(player: AutomaticAdvisorFlipPlayer, territory: string): Record<string, number> {
  return Object.fromEntries(Object.entries(player.forces).filter(
    ([key, count]) => splitLocation(key).territory === territory && count > 0,
  ));
}

function otherPresence(ctx: AdvisorSettlementContext, player: AutomaticAdvisorFlipPlayer, territory: string) {
  return ctx.players.some((other) => other.id !== player.id && presenceAt(other, territory) > 0);
}

function currentWindow(ctx: AutomaticAdvisorFlipContext) {
  return ctx.advanced === true && ctx.status === 'playing' && ctx.phase === 5 && positive(ctx.turn);
}

/** A supported committed producer opens a response for these current groups.
 * No cards, resources, leaders or hidden marker values determine eligibility. */
export function quoteAutomaticAdvisorFlips(ctx: AutomaticAdvisorFlipContext): {
  player: string;
  territory: string;
  forces: Record<string, number>;
}[] {
  if (!currentWindow(ctx)) return [];
  const flips: { player: string; territory: string; forces: Record<string, number> }[] = [];
  for (const player of ctx.players) {
    if (player.faction !== 'beneGesserit') continue;
    for (const [territory, stance] of Object.entries(player.advisors ?? {})) {
      if (stance.aloneFlipHold !== undefined || otherPresence(ctx, player, territory)) continue;
      const forces = physicalGroup(player, territory);
      if (Object.keys(forces).length) flips.push({ player: player.id, territory, forces });
    }
  }
  return flips;
}

/** Keep a prevented alone occurrence until physical emptiness or foreign entry.
 * With no occurrence hold, retain the legacy automatic conversion, including setup. */
export function advisorStanceAfterSettlement(
  ctx: AdvisorSettlementContext,
  player: AutomaticAdvisorFlipPlayer | string,
  territory: string,
): AdvisorStance | undefined {
  const current = ctx.players.find((candidate) => candidate.id === (typeof player === 'string' ? player : player.id));
  const stance = current?.advisors?.[territory];
  if (!current || current.faction !== 'beneGesserit' || !stance) return undefined;
  if (!ctx.advanced) return { ...stance };
  if (!Object.keys(physicalGroup(current, territory)).length) return undefined;
  if (otherPresence(ctx, current, territory)) {
    const remaining = { ...stance };
    delete remaining.aloneFlipHold;
    return remaining;
  }
  return stance.aloneFlipHold !== undefined ? { ...stance } : undefined;
}

function validateTransportSource(
  ctx: AutomaticAdvisorFlipContext,
  source: Extract<AutomaticAdvisorFlipSource, { producer: 'guildTransport' }>,
) {
  const transport = source.transport;
  requireFlip(record(transport) &&
    Object.keys(transport).sort().join(',') === 'amount,elite,event,group,origin,player,sector,to' &&
    identifier(transport.event) && identifier(transport.player) && identifier(transport.origin) &&
    identifier(transport.to) && nonnegative(transport.sector) && transport.sector <= 18 &&
    positive(transport.amount) && nonnegative(transport.elite) && transport.elite <= transport.amount &&
    record(transport.group) && Object.values(transport.group).every(positive) &&
    Object.values(transport.group).reduce((total, count) => total + count, 0) === transport.amount,
  'Automatic advisor conversion lost its exact committed Guild transport metadata.');
  const places = gameTerritories(ctx);
  const origin = places.find((place) => place.id === transport.origin);
  const destination = places.find((place) => place.id === transport.to);
  requireFlip(origin && (transport.to === 'reserves' ||
    (destination && destination.sectors.includes(transport.sector))) &&
    Object.keys(transport.group).every((key) => {
      const point = splitLocation(key);
      return key === `${point.territory}:${point.sector}` && point.territory === transport.origin &&
        origin.sectors.includes(point.sector);
    }) && (source.territory === transport.origin ||
      (transport.to !== 'reserves' && source.territory === transport.to)),
  'Automatic advisor conversion must belong to the original transport origin or destination.');
  const actors = ctx.players.filter((player) => player.id === transport.player);
  const actor = actors[0];
  requireFlip(actors.length === 1 && actor.shipped === true,
    'Automatic advisor conversion lost its completed native transport slot.');
  const deposited = transport.to === 'reserves'
    ? actor.reserves : actor.forces[`${transport.to}:${transport.sector}`];
  requireFlip(nonnegative(deposited) && deposited >= transport.amount,
    'Automatic advisor conversion lost the original transported physical counters.');
}

/** Validate the same committed producer and exact held group before either response outcome. */
export function validateAutomaticAdvisorFlip(
  ctx: AutomaticAdvisorFlipContext,
  source: AutomaticAdvisorFlipSource,
): void {
  requireFlip(record(source) &&
    ((source.producer === 'groundMovement' && identifier(source.mover) &&
      Object.keys(source).sort().join(',') === 'event,forces,move,mover,owner,phase,producer,territory,turn') ||
      (source.producer === 'guildTransport' &&
        Object.keys(source).sort().join(',') === 'event,forces,owner,phase,producer,territory,transport,turn')) &&
    identifier(source.event) && identifier(source.owner) && identifier(source.territory) &&
    positive(source.turn) && source.turn === ctx.turn && source.phase === 5 &&
    currentWindow(ctx) && source.phase === ctx.phase,
  'Automatic advisor conversion lost its original current-turn ground movement or Guild transport.');
  const owners = ctx.players.filter((player) => player.id === source.owner);
  const owner = owners[0];
  requireFlip(owners.length === 1 && owner?.faction === 'beneGesserit' &&
    owner.advisors?.[source.territory]?.aloneFlipHold === source.event,
  'Automatic advisor conversion needs its original native owner and held occurrence.');
  requireFlip(!otherPresence(ctx, owner, source.territory),
    'Automatic advisor conversion requires the original group to remain alone.');
  if (source.producer === 'groundMovement') {
    const movers = ctx.players.filter((player) => player.id === source.mover);
    requireFlip(movers.length === 1 && positive(source.move) && movers[0].moved === source.move,
      'Automatic advisor conversion lost its original completed movement.');
  } else validateTransportSource(ctx, source);
  const forces = physicalGroup(owner, source.territory);
  requireFlip(record(source.forces) && Object.keys(forces).length > 0 &&
    Object.values(forces).every(positive) && Object.values(source.forces).every(positive) &&
    Object.keys(forces).sort().join(',') === Object.keys(source.forces).sort().join(',') &&
    Object.entries(forces).every(([key, count]) => source.forces[key] === count),
  'Automatic advisor conversion needs the same complete physical advisor group.');
}
