import type { Game } from './engine';
import { location, validLocation } from './board';
import { HomeworldCustodyError } from './homeworld-custody';

export type HomeworldAmbassadorArrival = {
  event: string;
  entrant: string;
  destination: string;
  parent?: string;
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
};
export type HomeworldArrivalTag = 'revivalEvent' | 'victoryEvent';
export type HomeworldArrivalContext = Pick<
  Game,
  'turn' | 'phase' | 'players' | 'pendingAmbassador'
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

/** Arrival provenance is fixed separately from the original revival grant. */
export function homeworldArrivalSignature(
  frame: HomeworldArrivalFrame,
): string {
  if (!text(frame.destination) || !Array.isArray(frame.ambassadors)) fail();
  const seen = new Set<string>();
  for (const [index, entry] of frame.ambassadors.entries()) {
    if (
      !keys(entry, [
        'event',
        'entrant',
        'destination',
        'parent',
        'completed',
      ]) ||
      !text(entry.event) ||
      !text(entry.entrant) ||
      !text(entry.destination) ||
      typeof entry.completed !== 'boolean' ||
      (index < frame.ambassadors.length - 1 && !entry.completed) ||
      seen.has(entry.event) ||
      (index === 0
        ? entry.parent !== undefined ||
          entry.entrant !== frame.player ||
          entry.destination !== frame.destination
        : !text(entry.parent) || !seen.has(entry.parent))
    )
      fail();
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
  const ambassadors = [
    ...frame.ambassadors!,
    {
      event: entry.event,
      entrant: entry.entrant,
      destination: location(entry.territory, entry.sector),
      completed: false,
      ...(parent === undefined ? {} : { parent }),
    },
  ];
  const arrivalSignature = homeworldArrivalSignature({
    ...frame,
    ambassadors,
  });
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
    frame.ambassadors!.some(
      (entry, index) =>
        !g.players.some(
          (seat) =>
            seat.id === entry.entrant &&
            (index === 0 || seat.faction === 'beneGesserit'),
        ),
    )
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
