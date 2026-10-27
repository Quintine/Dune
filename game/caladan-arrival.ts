import type { Game } from './engine';
import { location, splitLocation, validLocation } from './board';
import { HomeworldCustodyError } from './homeworld-custody';
import { validateHomeworldVictoryReturn } from './homeworld-victory-return';
import type { FactionId } from './catalog';
import type { SpiritualAdvisorSource } from './spiritual-advisor';
import type { RevivalTerrorPacket } from './revival-terror-entry';

export type CaladanArrivalContext = Pick<Game, 'status' | 'turn' | 'phase' | 'players' |
  'homeworlds' | 'lastBattleContext' | 'homeworldVictoryReinforcement'>;
export type CaladanArrivalDetails = {
  victoryEvent?: string;
  entrant: string;
  territory: string;
  sector: number;
  amount: number;
  elite: number;
  cause: string;
};

/** Validate the committed original addition, not the army after a reaction.
 * Atomics, alliances and other accepted effects may already have changed it. */
export function validateCaladanArrivalSource(g: CaladanArrivalContext, entry: CaladanArrivalDetails): void {
  validateHomeworldVictoryReturn(g);
  const frame = g.homeworldVictoryReinforcement;
  if (g.status !== 'playing' || g.phase !== 6 || !frame || frame.stage !== 'arrival' ||
    frame.turn !== g.turn || frame.phase !== g.phase || entry.victoryEvent !== frame.event ||
    entry.entrant !== frame.player || entry.cause !== 'caladanReinforcement' ||
    entry.amount !== 1 || entry.elite !== 0 || !validLocation(entry.territory, entry.sector) ||
    frame.destination !== location(entry.territory, entry.sector))
    throw new HomeworldCustodyError('The Caladan arrival has lost its original committed victory reinforcement.');
}

export function caladanOwnsTerrorEntry(g: CaladanArrivalContext, entry: CaladanArrivalDetails): boolean {
  try { validateCaladanArrivalSource(g, entry); return true; }
  catch (error) {
    if (error instanceof HomeworldCustodyError) return false;
    throw error;
  }
}

export type CaladanEntryParent = {
  event: string;
  terror: RevivalTerrorPacket;
  spiritual?: SpiritualAdvisorSource;
};
export type CaladanSneakTrigger = Omit<CaladanArrivalDetails, 'victoryEvent'> & {
  victoryEvent?: string;
  caladanArrival?: CaladanEntryParent;
};
/** Engine-only consistency history. No raw Terror signature, candidate list,
 * current force snapshot or private deck is part of this receipt. */
export type CaladanSneakReceipt = {
  version: 1;
  victoryEvent: string;
  turn: number;
  phase: 6;
  token: string;
  trigger: CaladanSneakTrigger;
  packet: RevivalTerrorPacket;
  signature: string;
};
export type CaladanTerrorHistoryContext = {
  turn: number;
  phase: number;
  players: readonly { id: string; faction: FactionId }[];
  victoryPlayer: string;
  terrorArrivals: readonly CaladanSneakReceipt[];
};
type CaladanTerrorEntry = NonNullable<Game['pendingTerrorEntry']> & { caladanArrival?: CaladanEntryParent };
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const count = (value: unknown, maximum = 20): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= maximum;
function exact(value: unknown, names: readonly string[]): value is Record<string, unknown> {
  return record(value) && Object.keys(value).length === names.length && names.every(key => Object.hasOwn(value, key));
}
function fail(): never {
  throw new HomeworldCustodyError('The Caladan Sneak Attack lost its original committed arrival source.');
}
const uuid = (value: unknown): value is string => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
function validPacket(value: unknown): value is RevivalTerrorPacket {
  return exact(value, ['event', 'owner', 'territory', 'sector', 'amount', 'elite']) && uuid(value.event) &&
    text(value.owner) && text(value.territory) && count(value.sector, 18) &&
    validLocation(value.territory, value.sector) && count(value.amount, 5) && value.amount > 0 && value.elite === 0;
}
function validSpiritual(value: unknown, event: string): value is SpiritualAdvisorSource {
  return exact(value, ['event', 'owner', 'turn', 'phase', 'territory', 'sector', 'amount', 'victoryEvent']) &&
    text(value.event) && text(value.owner) && Number.isSafeInteger(value.turn) && (value.turn as number) > 0 &&
    value.phase === 6 && text(value.territory) && count(value.sector, 18) &&
    validLocation(value.territory, value.sector) && (value.amount === 1 || value.amount === 2) && value.victoryEvent === event;
}
export function validCaladanEntryParent(value: unknown): value is CaladanEntryParent {
  return record(value) && exact(value, Object.hasOwn(value, 'spiritual') ? ['event', 'terror', 'spiritual'] : ['event', 'terror']) &&
    text(value.event) && validPacket(value.terror) &&
    (!Object.hasOwn(value, 'spiritual') || validSpiritual(value.spiritual, value.event));
}
function packetTuple(packet: RevivalTerrorPacket) {
  return [packet.event, packet.owner, packet.territory, packet.sector, packet.amount, packet.elite];
}
export function caladanEntryParentTuple(parent: CaladanEntryParent): unknown[] {
  if (!validCaladanEntryParent(parent)) fail();
  const source = parent.spiritual;
  return ['caladanArrival', parent.event, source ? [source.event, source.owner, source.turn, source.phase,
    source.territory, source.sector, source.amount, source.victoryEvent] : null, packetTuple(parent.terror)];
}
function triggerTuple(trigger: CaladanSneakTrigger) {
  return [trigger.entrant, trigger.territory, trigger.sector, trigger.amount, trigger.elite, trigger.cause,
    trigger.victoryEvent ?? null, trigger.caladanArrival ? caladanEntryParentTuple(trigger.caladanArrival) : null];
}
function receiptSignature(receipt: CaladanSneakReceipt): string {
  return JSON.stringify(['caladanSneak', receipt.version, receipt.victoryEvent, receipt.turn, receipt.phase,
    receipt.token, triggerTuple(receipt.trigger), packetTuple(receipt.packet)]);
}
function validTrigger(trigger: unknown): trigger is CaladanSneakTrigger {
  if (!record(trigger)) return false;
  const root = Object.hasOwn(trigger, 'victoryEvent'), child = Object.hasOwn(trigger, 'caladanArrival');
  return root !== child && exact(trigger, ['entrant', 'territory', 'sector', 'amount', 'elite', 'cause',
    root ? 'victoryEvent' : 'caladanArrival']) && text(trigger.entrant) && text(trigger.territory) &&
    count(trigger.sector, 18) && validLocation(trigger.territory, trigger.sector) &&
    count(trigger.amount) && trigger.amount > 0 && count(trigger.elite, trigger.amount) && text(trigger.cause) &&
    (root ? text(trigger.victoryEvent) : validCaladanEntryParent(trigger.caladanArrival));
}
function childMatches(context: CaladanTerrorHistoryContext, parent: CaladanEntryParent, details: CaladanArrivalDetails) {
  if (parent.spiritual) {
    const source = parent.spiritual;
    return context.players.filter(player => player.id === source.owner && player.faction === 'beneGesserit').length === 1 &&
      source.owner !== context.victoryPlayer && source.turn === context.turn && source.phase === context.phase &&
      (source.territory === parent.terror.territory || source.territory === 'polar_sink') &&
      details.entrant === source.owner && details.cause === 'advisor' && details.territory === source.territory &&
      details.sector === source.sector && details.amount === source.amount && details.elite === 0;
  }
  const packet = parent.terror;
  return details.entrant === packet.owner && details.cause === 'shipment' && details.territory === packet.territory &&
    details.sector === packet.sector && details.amount === packet.amount && details.elite === packet.elite;
}

function validatePacketHistory(context: CaladanTerrorHistoryContext, packet: RevivalTerrorPacket,
  destination: string, victoryEvent: string, seen: Set<string>): void {
  if (!validPacket(packet) || seen.size > 16 || seen.has(packet.event) || context.phase !== 6 ||
      !Number.isSafeInteger(context.turn) || context.turn < 1 || !Array.isArray(context.terrorArrivals) ||
      context.players.filter(player => player.id === context.victoryPlayer && player.faction === 'atreides').length !== 1 ||
      context.players.filter(player => player.id === packet.owner && player.faction === 'moritani').length !== 1) fail();
  const point = splitLocation(destination);
  if (!text(victoryEvent) || destination !== location(point.territory, point.sector) ||
      !validLocation(point.territory, point.sector)) fail();
  const matches = context.terrorArrivals.filter(receipt => record(receipt) && record(receipt.packet) && receipt.packet.event === packet.event);
  if (matches.length !== 1) fail();
  const receipt = matches[0];
  if (!exact(receipt, ['version', 'victoryEvent', 'turn', 'phase', 'token', 'trigger', 'packet', 'signature']) ||
      receipt.version !== 1 || receipt.victoryEvent !== victoryEvent || receipt.turn !== context.turn || receipt.phase !== 6 ||
      !text(receipt.token) || !validTrigger(receipt.trigger) || !validPacket(receipt.packet) ||
      JSON.stringify(packetTuple(receipt.packet)) !== JSON.stringify(packetTuple(packet)) ||
      receipt.signature !== receiptSignature(receipt as CaladanSneakReceipt) || receipt.trigger.territory !== packet.territory ||
      receipt.trigger.sector !== packet.sector) fail();
  seen.add(packet.event);
  const trigger = receipt.trigger;
  if (trigger.victoryEvent !== undefined) {
    if (trigger.victoryEvent !== victoryEvent || trigger.entrant !== context.victoryPlayer ||
        trigger.territory !== point.territory || trigger.sector !== point.sector ||
        trigger.amount !== 1 || trigger.elite !== 0 || trigger.cause !== 'caladanReinforcement') fail();
  } else {
    const parent = trigger.caladanArrival!;
    if (parent.event !== victoryEvent || !childMatches(context, parent, trigger)) fail();
    validatePacketHistory(context, parent.terror, destination, victoryEvent, seen);
  }
}

/** Resolve an opaque public packet through original sanitized engine history;
 * no current reserves, inhabitants or removed-token custody are re-read. */
export function validateCaladanTerrorPacket(context: CaladanTerrorHistoryContext, packet: RevivalTerrorPacket,
  destination: string, victoryEvent: string): void {
  validatePacketHistory(context, packet, destination, victoryEvent, new Set());
}

export function validateCaladanSneakHistory(g: Pick<Game, 'turn' | 'players' | 'homeworldVictoryReinforcement'>): void {
  const frame = g.homeworldVictoryReinforcement;
  if (frame?.terrorArrivals === undefined) return;
  if (!Array.isArray(frame.terrorArrivals) || frame.turn > g.turn || frame.phase !== 6 ||
      !['arrival', 'complete'].includes(frame.stage) || !text(frame.destination) || frame.destination === 'decline') fail();
  const seen = new Set<string>();
  const context: CaladanTerrorHistoryContext = { turn: frame.turn, phase: frame.phase, players: g.players,
    victoryPlayer: frame.player, terrorArrivals: frame.terrorArrivals };
  for (const receipt of frame.terrorArrivals) {
    if (!record(receipt) || !validPacket(receipt.packet) || seen.has(receipt.packet.event)) fail();
    seen.add(receipt.packet.event);
    validateCaladanTerrorPacket(context, receipt.packet, frame.destination, frame.event);
  }
}

/** A new entry belongs to the committed Sneak packet, optionally followed by
 * its own actual Spiritual packet; the original Caladan force is not reused. */
export function validateCaladanChildArrival(g: CaladanArrivalContext, parent: CaladanEntryParent,
  details: CaladanArrivalDetails): void {
  validateHomeworldVictoryReturn(g);
  const frame = g.homeworldVictoryReinforcement;
  if (!validCaladanEntryParent(parent) || g.status !== 'playing' || g.phase !== 6 || !frame || frame.stage !== 'arrival' ||
      frame.turn !== g.turn || parent.event !== frame.event || !text(frame.destination) ||
      details.victoryEvent !== undefined || !count(details.amount) || details.amount < 1 || !count(details.elite, details.amount)) fail();
  const context: CaladanTerrorHistoryContext = { turn: frame.turn, phase: frame.phase, players: g.players,
    victoryPlayer: frame.player, terrorArrivals: frame.terrorArrivals ?? [] };
  validateCaladanTerrorPacket(context, parent.terror, frame.destination, parent.event);
  if (!childMatches(context, parent, details)) fail();
}

function sanitizedTrigger(entry: CaladanTerrorEntry): CaladanSneakTrigger {
  const trigger: CaladanSneakTrigger = { entrant: entry.entrant, territory: entry.territory, sector: entry.sector,
    amount: entry.amount, elite: entry.elite, cause: entry.cause,
    ...(entry.victoryEvent === undefined ? {} : { victoryEvent: entry.victoryEvent }),
    ...(entry.caladanArrival === undefined ? {} : { caladanArrival: structuredClone(entry.caladanArrival) }) };
  if (!validTrigger(trigger)) fail();
  return trigger;
}

/** Quote before native debit; the engine appends the receipt only after the
 * actual positive transfer, then queues this packet behind the original overlap. */
export function createCaladanSneakReceipt(g: Game, entry: CaladanTerrorEntry, owner: string, amount: number,
  eventUUID: string): { packet: RevivalTerrorPacket; receipt: CaladanSneakReceipt } {
  const pending = g.pendingTerrorEntry as CaladanTerrorEntry | null | undefined;
  const token = g.moritaniTerror?.tokens.find(candidate => candidate.id === entry.token);
  if (g.status !== 'playing' || g.phase !== 6 || !pending || pending.stage !== 'sneakAttack' ||
      entry.stage !== 'sneakAttack' || pending.token !== entry.token || entry.turn !== g.turn || entry.phase !== 6 ||
      pending.turn !== g.turn || pending.phase !== 6 || entry.revivalArrival !== undefined ||
      (g.decision && (g.decision.kind !== 'moritaniTerror' || g.decision.player !== owner)) ||
      g.players.filter(player => player.id === owner && player.faction === 'moritani').length !== 1 ||
      !token || token.kind !== 'sneakAttack' || token.status !== 'removed' || token.location !== null ||
      !count(amount, 5) || amount < 1 || !uuid(eventUUID)) fail();
  const trigger = sanitizedTrigger(entry);
  if (JSON.stringify(triggerTuple(trigger)) !== JSON.stringify(triggerTuple(sanitizedTrigger(pending)))) fail();
  if (entry.victoryEvent !== undefined) validateCaladanArrivalSource(g, entry);
  else if (entry.caladanArrival) validateCaladanChildArrival(g, entry.caladanArrival, entry);
  else fail();
  const frame = g.homeworldVictoryReinforcement!;
  validateCaladanSneakHistory(g);
  if (frame.terrorArrivals?.some(receipt => receipt.packet.event === eventUUID)) fail();
  const packet: RevivalTerrorPacket = { event: eventUUID, owner, territory: entry.territory,
    sector: entry.sector, amount, elite: 0 };
  const receipt: CaladanSneakReceipt = { version: 1, victoryEvent: frame.event, turn: g.turn, phase: 6,
    token: token.id, trigger, packet: { ...packet }, signature: '' };
  receipt.signature = receiptSignature(receipt);
  return { packet, receipt };
}
