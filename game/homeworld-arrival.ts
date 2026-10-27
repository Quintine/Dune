import type { Game } from './engine';
import { location, splitLocation, validLocation } from './board';
import { HomeworldCustodyError } from './homeworld-custody';
import type { SpiritualAdvisorSource } from './spiritual-advisor';
import { validRevivalTerrorPacket, validateRevivalTerrorPacket, type RevivalTerrorPacket } from './revival-terror-entry';
import { validCaladanEntryParent, validateCaladanTerrorPacket, type CaladanSneakReceipt } from './caladan-arrival';

export type HomeworldAmbassadorArrival = {
  event: string;
  entrant: string;
  destination: string;
  parent?: string;
  spiritual?: SpiritualAdvisorSource;
  terror?: RevivalTerrorPacket;
  completed: boolean;
};
export type HomeworldArrivalFrame = {
  event: string;
  turn: number;
  phase: number;
  player: string;
  stage: 'waiting' | 'choice' | 'arrival' | 'complete';
  signature: string;
  destination?: string;
  ambassadors?: HomeworldAmbassadorArrival[];
  arrivalSignature?: string;
  terrorArrivals?: CaladanSneakReceipt[];
};
export type HomeworldArrivalTag = 'revivalEvent' | 'victoryEvent';
export type HomeworldArrivalContext = Pick<
  Game,
  'turn' | 'phase' | 'players' | 'pendingAmbassador' | 'homeworldVictoryReinforcement'
>;
function fail(): never {
  throw new HomeworldCustodyError(
    'The saved Homeworld arrival has lost its original Ambassador chain or completion proof.',
  );
}
function text(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
function keys(value: unknown, allowed: string[]): boolean {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).every((key) => allowed.includes(key))
  );
}

/** This is the public source of an already committed Spiritual Advisor arrival,
 * not another permission or a reconstruction from current BG reserves. */
function spiritualSource(
  frame: HomeworldArrivalFrame,
  entry: HomeworldAmbassadorArrival,
): SpiritualAdvisorSource {
  const source = entry.spiritual;
  const victory = frame.phase === 6;
  const tag = victory ? 'victoryEvent' : 'revivalEvent';
  if (!source || !keys(source, ['event', 'owner', 'turn', 'phase', 'territory', 'sector', 'amount', tag])) fail();
  const destination = splitLocation(frame.destination!);
  const origin = entry.terror?.territory ?? destination.territory;
  if (
    Object.keys(source).sort().join(',') !== (victory
      ? 'amount,event,owner,phase,sector,territory,turn,victoryEvent'
      : 'amount,event,owner,phase,revivalEvent,sector,territory,turn') ||
    !text(source.event) ||
    !text(source.owner) ||
    source.owner !== entry.entrant ||
    source.owner === frame.player ||
    source[tag] !== frame.event ||
    (victory ? !entry.terror || source.phase !== 6 : frame.phase !== 4 || source.phase !== 4) ||
    source.turn !== frame.turn ||
    !Number.isSafeInteger(source.turn) || source.turn < 1 ||
    !text(source.territory) ||
    !Number.isSafeInteger(source.sector) ||
    !validLocation(source.territory, source.sector) ||
    !validLocation(destination.territory, destination.sector) ||
    (source.territory !== origin && source.territory !== 'polar_sink') ||
    (source.amount !== 1 && source.amount !== 2) ||
    entry.parent !== undefined ||
    entry.destination !== location(source.territory, source.sector)
  ) fail();
  return source;
}

function terrorPacket(source: RevivalTerrorPacket) {
  return [source.event, source.owner, source.territory, source.sector, source.amount, source.elite];
}

/** Sneak Attack is a distinct committed packet, not another disposition of the
 * original revived counters. Its captured Terror witness stays engine-owned. */
function terrorSource(frame: HomeworldArrivalFrame, entry: HomeworldAmbassadorArrival): RevivalTerrorPacket {
  const source = entry.terror;
  const destination = splitLocation(frame.destination!);
  if (!source || !(frame.phase === 6 ? validCaladanEntryParent({ event: frame.event, terror: source }) : validRevivalTerrorPacket(source)) ||
    entry.parent !== undefined ||
    !validLocation(destination.territory, destination.sector) ||
    (entry.spiritual === undefined && (entry.entrant !== source.owner ||
      entry.destination !== location(source.territory, source.sector)))) fail();
  return source!;
}

/** Arrival provenance is fixed separately from the original revival grant. */
export function homeworldArrivalSignature(
  frame: HomeworldArrivalFrame,
): string {
  if (!text(frame.destination) || !Array.isArray(frame.ambassadors)) fail();
  const seen = new Set<string>();
  const spiritualEvents = new Set<string>();
  const terrorEvents = new Map<string, string>();
  const terrorRoots = new Set<string>();
  let primary = false;
  for (const [index, entry] of frame.ambassadors.entries()) {
    if (
      !keys(entry, [
        'event',
        'entrant',
        'destination',
        'parent',
        'spiritual',
        'terror',
        'completed',
      ]) ||
      !text(entry.event) ||
      !text(entry.entrant) ||
      !text(entry.destination) ||
      typeof entry.completed !== 'boolean' ||
      (index < frame.ambassadors.length - 1 && !entry.completed) ||
      seen.has(entry.event)
    )
      fail();
    if (entry.terror !== undefined) {
      const source = terrorSource(frame, entry), packet = JSON.stringify(terrorPacket(source));
      if (terrorEvents.has(source.event) && terrorEvents.get(source.event) !== packet) fail();
      terrorEvents.set(source.event, packet);
      if (entry.spiritual === undefined) {
        if (terrorRoots.has(source.event)) fail();
        terrorRoots.add(source.event);
      }
    }
    if (entry.spiritual !== undefined) {
      const source = spiritualSource(frame, entry);
      if (spiritualEvents.has(source.event)) fail();
      spiritualEvents.add(source.event);
    } else if (entry.terror !== undefined) {
      // Its separate public packet was checked above; it is not the primary root.
    } else if (entry.parent === undefined) {
      if (primary || entry.entrant !== frame.player || entry.destination !== frame.destination) fail();
      primary = true;
    } else if (index === 0 || !text(entry.parent) || !seen.has(entry.parent)) fail();
    seen.add(entry.event);
  }
  if (frame.destination === 'decline' && frame.ambassadors.length !== 0) fail();
  return JSON.stringify([
    // Preserve the existing persisted signature format; frame.signature binds its source.
    'homeworldRevivalArrival',
    frame.signature,
    frame.destination,
    frame.ambassadors.map((entry) => [
      entry.event,
      entry.entrant,
      entry.destination,
      entry.parent ?? null,
      entry.completed,
      // Legacy rows remain exactly five values. Only a new independent
      // Spiritual root adds its canonical, public placement source.
      ...(entry.spiritual === undefined ? [] : [[
        entry.spiritual.event,
        entry.spiritual.owner,
        entry.spiritual.turn,
        entry.spiritual.phase,
        entry.spiritual.territory,
        entry.spiritual.sector,
        entry.spiritual.amount,
        frame.phase === 6 ? spiritualSource(frame, entry).victoryEvent : spiritualSource(frame, entry).revivalEvent,
      ]]),
      ...(entry.terror === undefined ? [] : [['terror', terrorPacket(entry.terror)]]),
    ]),
  ]);
}

/** Only an actual Ambassador opening may append to this linear arrival chain. */
export function appendHomeworldArrivalAmbassador(
  frame: HomeworldArrivalFrame,
  entry: {
    event: string;
    entrant: string;
    territory: string;
    sector: number;
    turn: number;
    phase: number;
  },
  parent?: string,
  spiritual?: SpiritualAdvisorSource,
  terror?: RevivalTerrorPacket,
): void {
  if (
    frame.stage !== 'arrival' ||
    frame.turn !== entry.turn ||
    frame.phase !== entry.phase ||
    !validLocation(entry.territory, entry.sector) ||
    frame.arrivalSignature !== homeworldArrivalSignature(frame) ||
    (parent !== undefined && parent !== frame.ambassadors!.at(-1)?.event)
  )
    fail();
  const appended: HomeworldAmbassadorArrival = {
    event: entry.event,
    entrant: entry.entrant,
    destination: location(entry.territory, entry.sector),
    completed: false,
    ...(parent === undefined ? {} : { parent }),
    ...(spiritual === undefined ? {} : { spiritual }),
    ...(terror === undefined ? {} : { terror }),
  };
  const ambassadors = [
    ...frame.ambassadors!,
    appended,
  ];
  const arrivalSignature = homeworldArrivalSignature({
    ...frame,
    ambassadors,
  });
  if (spiritual !== undefined) appended.spiritual = structuredClone(spiritual);
  if (terror !== undefined) appended.terror = structuredClone(terror);
  frame.ambassadors = ambassadors;
  frame.arrivalSignature = arrivalSignature;
}

/** Record actual completion before removing its live Ambassador control. */
export function completeHomeworldArrivalAmbassador(
  frame: HomeworldArrivalFrame,
  event: string,
): void {
  const current = frame.ambassadors?.at(-1);
  if (
    frame.stage !== 'arrival' ||
    frame.arrivalSignature !== homeworldArrivalSignature(frame) ||
    !current ||
    current.event !== event ||
    current.completed
  )
    fail();
  const ambassadors = frame.ambassadors!.map((record) =>
    record === current ? { ...record, completed: true } : record,
  );
  const arrivalSignature = homeworldArrivalSignature({
    ...frame,
    ambassadors,
  });
  frame.ambassadors = ambassadors;
  frame.arrivalSignature = arrivalSignature;
}

/** Validate only the completed transfer's arrival chain. Original entitlement,
 * winner/revival evidence and their independent obligations stay with callers. */
export function validateHomeworldArrival(
  g: HomeworldArrivalContext,
  frame: HomeworldArrivalFrame,
  tag: HomeworldArrivalTag,
): void {
  if (
    !['revivalEvent', 'victoryEvent'].includes(tag) ||
    !frame ||
    !['arrival', 'complete'].includes(frame.stage) ||
    !text(frame.event) ||
    !text(frame.signature) ||
    !Number.isSafeInteger(frame.turn) ||
    frame.turn < 1 ||
    frame.turn > g.turn ||
    !Number.isSafeInteger(frame.phase) ||
    frame.phase < 0 ||
    frame.phase > 8 ||
    (frame.stage === 'arrival' &&
      (frame.turn !== g.turn || frame.phase !== g.phase)) ||
    frame.arrivalSignature !== homeworldArrivalSignature(frame) ||
    frame.ambassadors!.some((entry) => {
      if (entry.terror !== undefined) {
        if (tag === 'revivalEvent') {
          validateRevivalTerrorPacket({ turn: frame.turn, phase: frame.phase, players: g.players,
            revivalPlayer: frame.player }, entry.terror, frame.destination!, frame.event);
        } else {
          validateCaladanTerrorPacket({ turn: frame.turn, phase: frame.phase, players: g.players,
            victoryPlayer: frame.player, terrorArrivals: frame.terrorArrivals ??
              (g.homeworldVictoryReinforcement?.event === frame.event ? g.homeworldVictoryReinforcement.terrorArrivals : undefined) ?? [] },
          entry.terror, frame.destination!, frame.event);
        }
      }
      if (entry.spiritual !== undefined) {
        const entrants = g.players.filter((seat) => seat.id === entry.entrant);
        const owners = g.players.filter((seat) => seat.id === frame.player);
        return entrants.length !== 1 ||
          entrants[0].faction !== 'beneGesserit' || owners.length !== 1 ||
          (tag === 'victoryEvent'
            ? frame.phase !== 6 || entry.terror === undefined || owners[0].faction !== 'atreides'
            : entry.terror === undefined && owners[0].faction !== 'tleilaxu');
      }
      if (entry.terror !== undefined) {
        return !g.players.some(seat => seat.id === entry.entrant && seat.faction === 'moritani');
      }
      return !g.players.some((seat) => seat.id === entry.entrant &&
        (entry.parent === undefined || seat.faction === 'beneGesserit'));
    })
  )
    fail();
  const unfinished = frame.ambassadors!.find((entry) => !entry.completed);
  const current = g.pendingAmbassador;
  const otherTag = tag === 'revivalEvent' ? 'victoryEvent' : 'revivalEvent';
  if (
    unfinished &&
    (frame.stage !== 'arrival' ||
      !current ||
      current[tag] !== frame.event ||
      current[otherTag] !== undefined ||
      current.event !== unfinished.event ||
      current.entrant !== unfinished.entrant ||
      location(current.territory, current.sector) !== unfinished.destination ||
      current.turn !== frame.turn ||
      current.phase !== frame.phase)
  )
    fail();
  if (
    current &&
    frame.ambassadors!.some(
      (entry) => entry.event === current.event && entry.completed,
    )
  )
    fail();
}
