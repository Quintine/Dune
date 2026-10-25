import type { Game } from './engine';
import { gameTerritories, location, splitLocation, validLocation } from './board';
import { HomeworldCustodyError } from './homeworld-custody';
import { validateHomeworldRevivalReturn } from './homeworld-revival-return';
import type { SpiritualAdvisorSource } from './spiritual-advisor';

export type RevivalTerrorPacket = {
  event: string;
  owner: string;
  territory: string;
  sector: number;
  amount: number;
  elite: number;
};
export type RevivalEntryParent = {
  event: string;
  spiritual?: SpiritualAdvisorSource;
  terror?: RevivalTerrorPacket;
};
type TerrorEntry = NonNullable<Game['pendingTerrorEntry']>;
export type RevivalArrivalDetails = Pick<TerrorEntry, 'entrant' | 'territory' | 'sector' | 'amount' | 'elite' | 'cause'>;
export type RevivalArrivalContext = Pick<Game, 'status' | 'turn' | 'phase' | 'players' |
  'homeworldRevivalReturn' | 'homeworldRevivalProgress' | 'homeworlds' |
  'pendingAmbassador' | 'pendingTreacheryDiscard' | 'mobileStronghold' | 'discoveries'>;
type HistoricalContext = Pick<Game, 'turn' | 'phase'> & {
  players: readonly Pick<Game['players'][number], 'id' | 'faction'>[];
  revivalPlayer: string;
};

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const count = (value: unknown, maximum = 20): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= maximum;
function exact(value: unknown, names: readonly string[]): value is Record<string, unknown> {
  return record(value) && Object.keys(value).length === names.length && names.every(key => Object.hasOwn(value, key));
}
function fail(): never {
  throw new HomeworldCustodyError('The revival entry lost its original returned group or committed child source.');
}
function capturedTerror(event: unknown): unknown[] | null {
  if (!text(event)) return null;
  try {
    const value: unknown = JSON.parse(event);
    if (!Array.isArray(value) || value.length < 11 ||
      !(text(value[0]) || Array.isArray(value[0]) && value[0][0] === 'stack' &&
        Array.isArray(value[0][1]) && value[0][1].length >= 2 && value[0][1].every(text) &&
        (value[0][2] === null || text(value[0][2]))) ||
      !text(value[1]) || !text(value[2]) || !count(value[3], 18) ||
      !validLocation(value[2], value[3]) || !count(value[4]) || !count(value[5], value[4]) ||
      !text(value[6]) || !Number.isSafeInteger(value[7]) || value[7] < 1 ||
      !count(value[8], 8) || !['none', 'wormRide', 'ambassador'].includes(value[9]) ||
      !(value[10] === null || text(value[10]))) return null;
    return value;
  } catch { return null; }
}

/** Nonrecursive historical syntax, usable by the original Ambassador history. */
export function validRevivalTerrorPacket(value: unknown): value is RevivalTerrorPacket {
  return exact(value, ['event', 'owner', 'territory', 'sector', 'amount', 'elite']) &&
    capturedTerror(value.event) !== null && text(value.owner) && text(value.territory) &&
    count(value.sector, 18) && validLocation(value.territory, value.sector) &&
    count(value.amount, 5) && value.amount > 0 && value.elite === 0;
}

function capturedParent(value: unknown): RevivalEntryParent | null {
  if (!Array.isArray(value) || value.length !== 4 || value[0] !== 'revivalArrival' || !text(value[1])) return null;
  const spiritual = value[2], terror = value[3];
  if (spiritual !== null && (!Array.isArray(spiritual) || spiritual.length !== 8) ||
    terror !== null && (!Array.isArray(terror) || terror.length !== 6)) return null;
  const parent = { event: value[1],
    ...(spiritual === null ? {} : { spiritual: { event: spiritual[0], owner: spiritual[1], turn: spiritual[2],
      phase: spiritual[3], territory: spiritual[4], sector: spiritual[5], amount: spiritual[6], revivalEvent: spiritual[7] } }),
    ...(terror === null ? {} : { terror: { event: terror[0], owner: terror[1], territory: terror[2],
      sector: terror[3], amount: terror[4], elite: terror[5] } }),
  };
  return validRevivalEntryParent(parent) ? parent : null;
}

/** Validate the captured original clock/territory without asking the original
 * Terror action to exist again or requiring its later victims to survive. */
export function validateRevivalTerrorPacket(
  context: HistoricalContext,
  packet: RevivalTerrorPacket,
  destination: string,
  revivalEvent: string,
  depth = 0,
): void {
  if (depth > 16 || !validRevivalTerrorPacket(packet) || !text(destination) || !text(revivalEvent) ||
    !context.players.some(player => player.id === context.revivalPlayer && ['fremen', 'tleilaxu'].includes(player.faction))) fail();
  const point = splitLocation(destination), original = capturedTerror(packet.event)!;
  const parent = capturedParent(original.at(-1));
  if (destination !== location(point.territory, point.sector) || !validLocation(point.territory, point.sector) ||
    !parent || parent.event !== revivalEvent || original[2] !== packet.territory || original[3] !== packet.sector ||
    original[7] !== context.turn || original[8] !== context.phase ||
    context.players.filter(player => player.id === packet.owner && player.faction === 'moritani').length !== 1 ||
    !context.players.some(player => player.id === original[1] && player.faction !== 'moritani')) fail();
  if (parent.terror) validateRevivalTerrorPacket(context, parent.terror, destination, revivalEvent, depth + 1);
  if (parent.spiritual) {
    const source = parent.spiritual, origin = parent.terror?.territory ?? point.territory;
    if ((!parent.terror && !context.players.some(player => player.id === context.revivalPlayer && player.faction === 'tleilaxu')) ||
      source.turn !== context.turn || source.phase !== context.phase ||
      context.players.filter(player => player.id === source.owner && player.faction === 'beneGesserit').length !== 1 ||
      (source.territory !== origin && source.territory !== 'polar_sink') ||
      original[1] !== source.owner || original[2] !== source.territory || original[3] !== source.sector ||
      original[4] !== source.amount || original[5] !== 0 || original[6] !== 'advisor') fail();
  } else if (parent.terror || original[1] !== context.revivalPlayer || original[2] !== point.territory || original[3] !== point.sector ||
    original[6] !== 'homeworldRevival') fail();
}

function validSpiritual(value: unknown, event: string): value is SpiritualAdvisorSource {
  return exact(value, ['event', 'owner', 'turn', 'phase', 'territory', 'sector', 'amount', 'revivalEvent']) &&
    text(value.event) && text(value.owner) && Number.isSafeInteger(value.turn) && (value.turn as number) > 0 &&
    value.phase === 4 && text(value.territory) && count(value.sector, 18) &&
    validLocation(value.territory, value.sector) && (value.amount === 1 || value.amount === 2) && value.revivalEvent === event;
}

/** Basic public metadata shape only. Current original-return validation belongs
 * to the entry caller; recorded history can use this without recursion. */
export function validRevivalEntryParent(value: unknown): value is RevivalEntryParent {
  return record(value) && Object.hasOwn(value, 'event') && text(value.event) &&
    Object.keys(value).every(key => ['event', 'spiritual', 'terror'].includes(key)) &&
    (!Object.hasOwn(value, 'spiritual') || validSpiritual(value.spiritual, value.event)) &&
    (!Object.hasOwn(value, 'terror') || validRevivalTerrorPacket(value.terror));
}

/** Conditional public signature suffix; old entries never acquire these bytes. */
export function revivalEntryParentTuple(parent: RevivalEntryParent): unknown[] {
  if (!validRevivalEntryParent(parent)) fail();
  const source = parent.spiritual, terror = parent.terror;
  return ['revivalArrival', parent.event,
    source ? [source.event, source.owner, source.turn, source.phase, source.territory, source.sector, source.amount, source.revivalEvent] : null,
    terror ? [terror.event, terror.owner, terror.territory, terror.sector, terror.amount, terror.elite] : null];
}

/** The public packet is historical. Accepted Terror may already have changed
 * pieces, alliances or optional powers; do not re-run a live shipment quote. */
export function validateRevivalArrivalSource(g: RevivalArrivalContext, parent: RevivalEntryParent, details: RevivalArrivalDetails): void {
  if (!validRevivalEntryParent(parent)) fail();
  const frame = g.homeworldRevivalReturn;
  if (g.status !== 'playing' || !frame || frame.stage !== 'arrival' || frame.event !== parent.event ||
    frame.turn !== g.turn || frame.phase !== g.phase || !text(frame.destination)) fail();
  const continuation = g.pendingTreacheryDiscard?.continuation;
  const context = !g.pendingAmbassador && continuation?.kind === 'ambassador'
    ? { ...g, pendingAmbassador: continuation.entry } : g;
  validateHomeworldRevivalReturn(context, frame);
  const original = splitLocation(frame.destination);
  if (frame.destination !== location(original.territory, original.sector) ||
    !gameTerritories(g).some(place => place.id === original.territory && place.sectors.includes(original.sector)) ||
    !gameTerritories(g).some(place => place.id === details.territory && place.sectors.includes(details.sector)) ||
    !count(details.amount) || details.amount < 1 || !count(details.elite, details.amount)) fail();
  if (parent.terror) validateRevivalTerrorPacket({ ...g, revivalPlayer: frame.player }, parent.terror, frame.destination, frame.event);
  if (parent.spiritual) {
    const source = parent.spiritual;
    const origin = parent.terror?.territory ?? original.territory;
    if ((!parent.terror && !g.players.some(player => player.id === frame.player && player.faction === 'tleilaxu')) ||
      g.players.filter(player => player.id === source.owner && player.faction === 'beneGesserit').length !== 1 ||
      source.turn !== g.turn || source.phase !== g.phase || source.owner === frame.player ||
      (source.territory !== origin && source.territory !== 'polar_sink') ||
      details.entrant !== source.owner || details.cause !== 'advisor' || details.territory !== source.territory ||
      details.sector !== source.sector || details.amount !== source.amount || details.elite !== 0) fail();
  } else if (parent.terror) {
    const packet = parent.terror;
    if (details.entrant !== packet.owner || details.cause !== 'shipment' || details.territory !== packet.territory ||
      details.sector !== packet.sector || details.amount !== packet.amount || details.elite !== packet.elite) fail();
  } else if (details.entrant !== frame.player || details.cause !== 'homeworldRevival' ||
    details.territory !== original.territory || details.sector !== original.sector ||
    details.amount !== frame.quote.normal + frame.quote.elite || details.elite !== frame.quote.elite) fail();
}

export function validateRevivalTerrorEntry(g: RevivalArrivalContext, entry: TerrorEntry): void {
  const parent = entry.revivalArrival;
  if (parent === undefined) return;
  if (entry.turn !== g.turn || entry.phase !== g.phase) fail();
  validateRevivalArrivalSource(g, parent, entry);
}

export function revivalOwnsTerrorEntry(g: RevivalArrivalContext, entry: TerrorEntry): boolean {
  if (entry.revivalArrival === undefined) return false;
  validateRevivalTerrorEntry(g, entry);
  return true;
}
