import { FACTIONS, type FactionId } from './catalog';

/** A public offer, bound to both seats' current faction assignments. */
export type FactionSwap = {
  event: string;
  from: string;
  to: string;
  fromFaction: FactionId;
  toFaction: FactionId;
};

export type FactionSwapSeat = { id: string; faction: FactionId };
export type FactionSwapAssignment = { player: string; faction: FactionId };

export class FactionSwapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FactionSwapError';
  }
}

const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const factionId = (value: unknown): value is FactionId =>
  typeof value === 'string' && FACTIONS.some(faction => faction.id === value);
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

function requireSwap(condition: unknown, message: string): asserts condition {
  if (!condition) throw new FactionSwapError(message);
}

function validateRoster(players: readonly FactionSwapSeat[]): void {
  requireSwap(Array.isArray(players) && players.length >= 2 && players.length <= 6 &&
    players.every(player => record(player) && identifier(player.id) && factionId(player.faction)) &&
    new Set(players.map(player => player.id)).size === players.length &&
    new Set(players.map(player => player.faction)).size === players.length,
  'A faction swap needs two through six distinct seats with distinct factions.');
}

/** Offer an exchange without changing the players or their assignments. */
export function createFactionSwap(
  players: readonly FactionSwapSeat[], actor: string, target: string, event: string,
): FactionSwap {
  validateRoster(players);
  requireSwap(identifier(event), 'A faction swap needs a distinct event.');
  requireSwap(identifier(actor) && identifier(target) && actor !== target,
    'A faction swap needs two different players.');
  const from = players.find(player => player.id === actor);
  const to = players.find(player => player.id === target);
  requireSwap(from && to, 'Both players must be seated.');
  return { event, from: from.id, to: to.id, fromFaction: from.faction, toFaction: to.faction };
}

/** A saved offer remains valid only while both seats retain its exact factions. */
export function validateFactionSwap(value: unknown, players: readonly FactionSwapSeat[]): asserts value is FactionSwap {
  validateRoster(players);
  requireSwap(record(value) && Object.keys(value).sort().join(',') === 'event,from,fromFaction,to,toFaction' &&
    identifier(value.event) && identifier(value.from) && identifier(value.to) && value.from !== value.to &&
    factionId(value.fromFaction) && factionId(value.toFaction) && value.fromFaction !== value.toFaction,
  'The saved faction swap is malformed.');
  requireSwap(players.some(player => player.id === value.from && player.faction === value.fromFaction) &&
    players.some(player => player.id === value.to && player.faction === value.toFaction),
  'The faction swap no longer matches the seated players.');
}

/** Only the recipient can accept or reject; the caller applies an acceptance atomically. */
export function answerFactionSwap(
  players: readonly FactionSwapSeat[], offer: unknown, actor: string, accept: boolean,
): { accepted: boolean; assignments: FactionSwapAssignment[] } {
  validateFactionSwap(offer, players);
  requireSwap(actor === offer.to, 'Only the recipient may answer a faction swap.');
  requireSwap(typeof accept === 'boolean', 'A faction swap answer must accept or reject.');
  return {
    accepted: accept,
    assignments: accept ? [
      { player: offer.from, faction: offer.toFaction },
      { player: offer.to, faction: offer.fromFaction },
    ] : [],
  };
}

/** Only the proposer may withdraw an offer. */
export function cancelFactionSwap(players: readonly FactionSwapSeat[], offer: unknown, actor: string): void {
  validateFactionSwap(offer, players);
  requireSwap(actor === offer.from, 'Only the proposer may cancel a faction swap.');
}
