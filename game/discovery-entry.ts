import type { FactionId } from './catalog';
import { fighterCount } from './advisors';
import {
  isDiscoveryLocationId,
  isDiscoveryTokenId,
  validateDiscoveryState,
  type DiscoveryLocationId,
  type DiscoveryOpaqueTokenId,
  type DiscoveryState,
} from './discoveries';
import { splitLocation, validGameLocation, type MobileBoard } from './board';
import { territoryEntryBlock, type OccupancySeat } from './occupancy';

export class DiscoveryEntryError extends Error {}

function requireEntry(condition: unknown, message: string): asserts condition {
  if (!condition) throw new DiscoveryEntryError(message);
}

const whole = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const identifier = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  !['__proto__', 'prototype', 'constructor'].includes(value);

export type DiscoveryEntrySeat = OccupancySeat & {
  id: string;
  faction: FactionId;
  forces: Record<string, number>;
  elites?: { forces: Record<string, number> };
};

export type DiscoveryEntryContext = Omit<MobileBoard, 'discoveries'> & {
  turn: number;
  storm: number;
  order: readonly string[];
  players: readonly DiscoveryEntrySeat[];
  discoveries: DiscoveryState;
};

export type DiscoveryEntrySource = {
  source: string;
  normal: number;
  elite: number;
};

export type DiscoveryEntryArrival = {
  event: string;
  token: DiscoveryOpaqueTokenId;
  owner: string;
  parent: string;
  destination: DiscoveryLocationId;
  sector: 0;
  destinationBefore: number;
  destinationEliteBefore: number;
  groups: DiscoveryEntrySource[];
  amount: number;
  elite: number;
  signature: string;
};

export type DiscoveryEntryRound = {
  version: 1;
  event: string;
  turn: number;
  tokens: DiscoveryOpaqueTokenId[];
  order: string[];
  cursor: number;
  stage: 'choose' | 'arrival' | 'complete';
  arrival: DiscoveryEntryArrival | null;
  signature: string;
};

export type DiscoveryEntrySelection = {
  groups: readonly DiscoveryEntrySource[];
};

export type DiscoveryEntryOffer = {
  event: string;
  token: DiscoveryOpaqueTokenId;
  owner: string;
  parent: string;
  destination: DiscoveryLocationId;
  sector: 0;
  sources: DiscoveryEntrySource[];
  blocked: string | null;
  arrival: DiscoveryEntryArrival | null;
};

export type DiscoveryEntryArrivalChild = {
  owner: string;
  territory: string;
  sector: number;
  amount: number;
  elite: number;
  discoveryEntry: string;
};

function arrivalPayload(arrival: Omit<DiscoveryEntryArrival, 'signature'>) {
  return [
    arrival.event,
    arrival.token,
    arrival.owner,
    arrival.parent,
    arrival.destination,
    arrival.sector,
    arrival.destinationBefore,
    arrival.destinationEliteBefore,
    arrival.groups.map((group) => [group.source, group.normal, group.elite]),
    arrival.amount,
    arrival.elite,
  ];
}

export function discoveryEntryArrivalSignature(
  arrival: Omit<DiscoveryEntryArrival, 'signature'>,
): string {
  return JSON.stringify(arrivalPayload(arrival));
}

export function discoveryEntrySignature(frame: DiscoveryEntryRound): string {
  return JSON.stringify([
    frame.version,
    frame.event,
    frame.turn,
    frame.tokens,
    frame.order,
    frame.cursor,
    frame.stage,
    frame.arrival,
  ]);
}

function expectedTokens(g: DiscoveryEntryContext) {
  return g.discoveries.newlyRevealed.filter((id) => {
    const token = g.discoveries.tokens.find((candidate) => candidate.id === id);
    return (
      token?.status === 'placed' &&
      token.revealedTurn === g.turn - 1 &&
      isDiscoveryLocationId(token.face)
    );
  });
}

function step(frame: DiscoveryEntryRound) {
  const owner = frame.order[frame.cursor % frame.order.length];
  const token = frame.tokens[Math.floor(frame.cursor / frame.order.length)];
  return { owner, token };
}

function strictSource(value: unknown): value is DiscoveryEntrySource {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const source = value as DiscoveryEntrySource;
  return (
    Object.keys(source).sort().join(',') === 'elite,normal,source' &&
    identifier(source.source) &&
    whole(source.normal) &&
    whole(source.elite) &&
    source.normal + source.elite > 0
  );
}

function validateInventory(discoveries: DiscoveryState) {
  try {
    validateDiscoveryState(discoveries);
  } catch (error) {
    throw new DiscoveryEntryError(
      error instanceof Error ? error.message : 'Invalid Discovery inventory.',
    );
  }
}

function validateArrivalShape(
  frame: DiscoveryEntryRound,
  arrival: DiscoveryEntryArrival,
) {
  const current = step(frame);
  requireEntry(
    !!arrival &&
      typeof arrival === 'object' &&
      !Array.isArray(arrival) &&
      Object.keys(arrival).sort().join(',') ===
        'amount,destination,destinationBefore,destinationEliteBefore,elite,event,groups,owner,parent,sector,signature,token' &&
      arrival.event === `${frame.event}:${frame.cursor}` &&
      arrival.token === current.token &&
      arrival.owner === current.owner &&
      identifier(arrival.parent) &&
      isDiscoveryLocationId(arrival.destination) &&
      arrival.sector === 0 &&
      whole(arrival.destinationBefore) &&
      whole(arrival.destinationEliteBefore) &&
      arrival.destinationEliteBefore <= arrival.destinationBefore &&
      Array.isArray(arrival.groups) &&
      arrival.groups.length > 0 &&
      arrival.groups.every(strictSource) &&
      arrival.groups.every(
        (group, index) =>
          index === 0 ||
          arrival.groups[index - 1].source.localeCompare(group.source) < 0,
      ) &&
      whole(arrival.amount) &&
      arrival.amount > 0 &&
      whole(arrival.elite) &&
      arrival.elite <= arrival.amount &&
      arrival.amount ===
        arrival.groups.reduce(
          (sum, group) => sum + group.normal + group.elite,
          0,
        ) &&
      arrival.elite ===
        arrival.groups.reduce((sum, group) => sum + group.elite, 0) &&
      arrival.signature === discoveryEntryArrivalSignature(arrival),
    'The Discovery entry has lost its exact signed arrival.',
  );
}

export function validateDiscoveryEntryRound(
  g: DiscoveryEntryContext,
  frame: DiscoveryEntryRound,
): void {
  validateInventory(g.discoveries);
  requireEntry(
    whole(g.turn) &&
      g.turn >= 2 &&
      whole(g.storm) &&
      g.storm <= 18 &&
      Array.isArray(g.order) &&
      g.order.length > 0 &&
      new Set(g.order).size === g.order.length &&
      Array.isArray(g.players) &&
      g.players.length === g.order.length &&
      new Set(g.players.map((player) => player.id)).size === g.players.length &&
      g.order.every((id) => g.players.some((player) => player.id === id)),
    'Discovery entry needs the current turn, storm order, and seated players.',
  );
  requireEntry(
    !!frame &&
      typeof frame === 'object' &&
      !Array.isArray(frame) &&
      Object.keys(frame).sort().join(',') ===
        'arrival,cursor,event,order,signature,stage,tokens,turn,version' &&
      frame.version === 1 &&
      identifier(frame.event) &&
      frame.turn === g.turn &&
      Array.isArray(frame.tokens) &&
      frame.tokens.every(isDiscoveryTokenId) &&
      new Set(frame.tokens).size === frame.tokens.length &&
      JSON.stringify(frame.tokens) === JSON.stringify(expectedTokens(g)) &&
      Array.isArray(frame.order) &&
      JSON.stringify(frame.order) === JSON.stringify(g.order) &&
      whole(frame.cursor) &&
      frame.cursor <= frame.tokens.length * frame.order.length &&
      ['choose', 'arrival', 'complete'].includes(frame.stage) &&
      frame.signature === discoveryEntrySignature(frame),
    'The Discovery entry round has lost its original token and player order.',
  );
  const complete = frame.cursor === frame.tokens.length * frame.order.length;
  requireEntry(
    (frame.stage === 'complete') === complete &&
      (frame.stage === 'arrival') === (frame.arrival !== null) &&
      (frame.stage !== 'complete' || frame.arrival === null),
    'The Discovery entry cursor and pending arrival disagree.',
  );
  if (frame.arrival) {
    validateArrivalShape(frame, frame.arrival);
    const token = g.discoveries.tokens.find(
      (candidate) => candidate.id === frame.arrival!.token,
    )!;
    const validSources = frame.arrival.groups.every((group) => {
      const source = splitLocation(group.source);
      return (
        group.source === `${source.territory}:${source.sector}` &&
        source.territory === frame.arrival!.parent &&
        source.sector !== g.storm &&
        validGameLocation(g, source.territory, source.sector)
      );
    });
    requireEntry(
      token.territory === frame.arrival.parent &&
        token.face === frame.arrival.destination &&
        validGameLocation(g, frame.arrival.destination, 0) &&
        validSources,
      'The Discovery entry arrival has lost its revealed destination.',
    );
  }
}

export function createDiscoveryEntryRound(
  g: DiscoveryEntryContext,
  event: string,
): DiscoveryEntryRound {
  validateInventory(g.discoveries);
  requireEntry(identifier(event), 'Discovery entry needs a stable event ID.');
  requireEntry(
    whole(g.turn) &&
      g.turn >= 2 &&
      Array.isArray(g.order) &&
      g.order.length > 0,
    'Discovery entry starts on the turn after a location was revealed.',
  );
  const tokens = [...expectedTokens(g)];
  const frame: DiscoveryEntryRound = {
    version: 1,
    event,
    turn: g.turn,
    tokens,
    order: [...g.order],
    cursor: 0,
    stage: tokens.length ? 'choose' : 'complete',
    arrival: null,
    signature: '',
  };
  frame.signature = discoveryEntrySignature(frame);
  validateDiscoveryEntryRound(g, frame);
  return frame;
}

function sourceOffer(
  g: DiscoveryEntryContext,
  player: DiscoveryEntrySeat,
  parent: string,
): DiscoveryEntrySource[] {
  if (fighterCount(player, parent) === 0) return [];
  const sources: DiscoveryEntrySource[] = [];
  for (const [source, total] of Object.entries(player.forces)) {
    const location = splitLocation(source);
    if (
      location.territory !== parent ||
      source !== `${location.territory}:${location.sector}` ||
      location.sector === g.storm ||
      !validGameLocation(g, location.territory, location.sector)
    )
      continue;
    const elite = player.elites?.forces[source] ?? 0;
    requireEntry(
      whole(total) && whole(elite) && elite <= total,
      'Discovery entry needs valid ordinary and elite source custody.',
    );
    if (total > 0) sources.push({ source, normal: total - elite, elite });
  }
  return sources.sort((a, b) => a.source.localeCompare(b.source));
}

function currentOffer(g: DiscoveryEntryContext, frame: DiscoveryEntryRound) {
  const current = step(frame);
  const player = g.players.find((candidate) => candidate.id === current.owner)!;
  const token = g.discoveries.tokens.find(
    (candidate) => candidate.id === current.token,
  )!;
  requireEntry(
    token.status === 'placed' &&
      token.revealedTurn === g.turn - 1 &&
      token.territory !== null &&
      isDiscoveryLocationId(token.face) &&
      validGameLocation(g, token.face, 0),
    'The Discovery entry step has lost its newly revealed location.',
  );
  return {
    current,
    player,
    token,
    parent: token.territory,
    destination: token.face,
  } as {
    current: typeof current;
    player: DiscoveryEntrySeat;
    token: typeof token;
    parent: string;
    destination: DiscoveryLocationId;
  };
}

export function quoteDiscoveryEntry(
  g: DiscoveryEntryContext,
  frame: DiscoveryEntryRound,
  owner: string,
  selection?: DiscoveryEntrySelection,
): DiscoveryEntryOffer {
  validateDiscoveryEntryRound(g, frame);
  requireEntry(
    frame.stage === 'choose',
    'No Discovery entry choice is pending.',
  );
  const { current, player, token, parent, destination } = currentOffer(
    g,
    frame,
  );
  requireEntry(
    owner === current.owner,
    'This Discovery entry belongs to another player.',
  );
  const sources = sourceOffer(g, player, parent);
  let blocked: string | null = null;
  try {
    blocked = territoryEntryBlock(g.players, owner, destination);
  } catch (error) {
    throw new DiscoveryEntryError(
      error instanceof Error ? error.message : 'Invalid Discovery occupancy.',
    );
  }
  if (!blocked && !sources.length)
    blocked =
      'No non-advisor forces outside the storm can enter this location.';
  const base = {
    event: frame.event,
    token: token.id,
    owner,
    parent,
    destination,
    sector: 0 as const,
    sources,
    blocked,
  };
  if (!selection) return { ...base, arrival: null };
  requireEntry(!blocked, blocked ?? 'This Discovery entry is unavailable.');
  requireEntry(
    selection &&
      typeof selection === 'object' &&
      !Array.isArray(selection) &&
      Object.keys(selection).join(',') === 'groups' &&
      Array.isArray(selection.groups) &&
      selection.groups.length > 0 &&
      selection.groups.every(strictSource),
    'Choose explicit positive ordinary and elite source groups.',
  );
  const groups = selection.groups
    .map((group) => ({ ...group }))
    .sort((a, b) => a.source.localeCompare(b.source));
  requireEntry(
    new Set(groups.map((group) => group.source)).size === groups.length,
    'Choose each Discovery entry source at most once.',
  );
  for (const group of groups) {
    const available = sources.find((source) => source.source === group.source);
    requireEntry(
      available &&
        group.normal <= available.normal &&
        group.elite <= available.elite,
      'Discovery entry groups must remain within their typed source custody.',
    );
  }
  const destinationKey = `${destination}:0`;
  const destinationBefore = player.forces[destinationKey] ?? 0;
  const destinationEliteBefore = player.elites?.forces[destinationKey] ?? 0;
  requireEntry(
    whole(destinationBefore) &&
      whole(destinationEliteBefore) &&
      destinationEliteBefore <= destinationBefore,
    'Discovery entry needs valid pre-arrival destination custody.',
  );
  const unsigned: Omit<DiscoveryEntryArrival, 'signature'> = {
    event: `${frame.event}:${frame.cursor}`,
    token: token.id,
    owner,
    parent,
    destination,
    sector: 0,
    destinationBefore,
    destinationEliteBefore,
    groups,
    amount: groups.reduce((sum, group) => sum + group.normal + group.elite, 0),
    elite: groups.reduce((sum, group) => sum + group.elite, 0),
  };
  const arrival: DiscoveryEntryArrival = {
    ...unsigned,
    signature: discoveryEntryArrivalSignature(unsigned),
  };
  return { ...base, arrival };
}

function nextFrame(frame: DiscoveryEntryRound): DiscoveryEntryRound {
  const cursor = frame.cursor + 1;
  const complete = cursor === frame.tokens.length * frame.order.length;
  const next: DiscoveryEntryRound = {
    ...frame,
    tokens: [...frame.tokens],
    order: [...frame.order],
    cursor,
    stage: complete ? 'complete' : 'choose',
    arrival: null,
    signature: '',
  };
  next.signature = discoveryEntrySignature(next);
  return next;
}

/** Decline or auto-skip the current optional entry step. */
export function advanceDiscoveryEntry(
  g: DiscoveryEntryContext,
  frame: DiscoveryEntryRound,
  owner: string,
): DiscoveryEntryRound {
  validateDiscoveryEntryRound(g, frame);
  requireEntry(
    frame.stage === 'choose' && step(frame).owner === owner,
    'Only the current player may decline this Discovery entry.',
  );
  const next = nextFrame(frame);
  validateDiscoveryEntryRound(g, next);
  return next;
}

/** Sign an accepted source selection before the caller moves physical forces. */
export function beginDiscoveryEntryArrival(
  g: DiscoveryEntryContext,
  frame: DiscoveryEntryRound,
  owner: string,
  selection: DiscoveryEntrySelection,
): DiscoveryEntryRound {
  const quote = quoteDiscoveryEntry(g, frame, owner, selection);
  requireEntry(quote.arrival, 'Choose forces for this Discovery entry.');
  const next: DiscoveryEntryRound = {
    ...frame,
    tokens: [...frame.tokens],
    order: [...frame.order],
    stage: 'arrival',
    arrival: {
      ...quote.arrival,
      groups: quote.arrival.groups.map((group) => ({ ...group })),
    },
    signature: '',
  };
  next.signature = discoveryEntrySignature(next);
  validateDiscoveryEntryRound(g, next);
  return next;
}

/** Bind an intrusion, advisor or other arrival child to the signed transfer. */
export function validateDiscoveryEntryArrivalChild(
  frame: DiscoveryEntryRound,
  child: DiscoveryEntryArrivalChild,
): void {
  const arrival = frame.arrival;
  requireEntry(
    frame.stage === 'arrival' &&
      arrival &&
      child &&
      typeof child === 'object' &&
      !Array.isArray(child) &&
      Object.keys(child).sort().join(',') ===
        'amount,discoveryEntry,elite,owner,sector,territory' &&
      child.owner === arrival.owner &&
      child.territory === arrival.destination &&
      child.sector === arrival.sector &&
      child.amount === arrival.amount &&
      child.elite === arrival.elite &&
      child.discoveryEntry === arrival.signature,
    'The Discovery interaction has lost its exact signed arrival.',
  );
}

/** Advance after the engine has transferred the signed groups and settled entry reactions. */
export function finishDiscoveryEntryArrival(
  g: DiscoveryEntryContext,
  frame: DiscoveryEntryRound,
): DiscoveryEntryRound {
  validateDiscoveryEntryRound(g, frame);
  requireEntry(frame.stage === 'arrival', 'No Discovery arrival is pending.');
  const next = nextFrame(frame);
  validateDiscoveryEntryRound(g, next);
  return next;
}
