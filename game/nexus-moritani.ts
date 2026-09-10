import { TERRITORIES } from './board';
import type { FactionId } from './catalog';
import { TERROR_KINDS, type TerrorState } from './moritani-terror';

export type NexusMoritaniContext = {
  turn: number;
  players: readonly { id: string; faction: FactionId }[];
};
export type NexusMoritaniReceipt = {
  version: 1;
  event: string;
  source: 'mentat';
  phase: 8;
  turn: number;
  owner: string;
  token: string;
  territory: string;
  roster: { id: string; faction: FactionId }[];
  signature: string;
};
function requireMoritani(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function identifier(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    !['__proto__', 'constructor', 'prototype'].includes(value)
  );
}
function whole(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
function staticTerritory(value: unknown): value is string {
  return typeof value === 'string' && TERRITORIES.some((t) => t.id === value);
}
function knownKeys(value: unknown, allowed: string[]): boolean {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value)) &&
    Object.keys(value).every((key) => allowed.includes(key))
  );
}
function roster(context: NexusMoritaniContext) {
  requireMoritani(
    whole(context.turn) &&
      Array.isArray(context.players) &&
      context.players.length > 0 &&
      context.players.every(
        (p) => p && identifier(p.id) && identifier(p.faction),
      ) &&
      new Set(context.players.map((p) => p.id)).size ===
        context.players.length &&
      new Set(context.players.map((p) => p.faction)).size ===
        context.players.length,
    'Moritani Nexus needs its original faction roster and turn.',
  );
  return context.players
    .map(({ id, faction }) => ({ id, faction }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
function signature(receipt: NexusMoritaniReceipt): string {
  return JSON.stringify([
    receipt.version,
    receipt.event,
    receipt.source,
    receipt.phase,
    receipt.turn,
    receipt.owner,
    receipt.token,
    receipt.territory,
    receipt.roster.map((p) => [p.id, p.faction]),
  ]);
}
/** Historical evidence does not infer authorization from current token custody.
 * The engine owns live placement eligibility, cancellation and progress binding. */
export function validateNexusMoritani(
  context: NexusMoritaniContext,
  receipt: NexusMoritaniReceipt,
): void {
  const seats = roster(context);
  requireMoritani(
    knownKeys(receipt, [
      'version',
      'event',
      'source',
      'phase',
      'turn',
      'owner',
      'token',
      'territory',
      'roster',
      'signature',
    ]) &&
      Object.keys(receipt).length === 10 &&
      receipt.version === 1 &&
      receipt.source === 'mentat' &&
      receipt.phase === 8 &&
      whole(receipt.turn) &&
      receipt.turn <= context.turn &&
      identifier(receipt.token) &&
      staticTerritory(receipt.territory) &&
      seats.some((p) => p.id === receipt.owner && p.faction === 'moritani') &&
      receipt.event ===
        JSON.stringify([
          'nexusMoritani',
          receipt.turn,
          receipt.owner,
          receipt.token,
          receipt.territory,
        ]) &&
      JSON.stringify(receipt.roster) === JSON.stringify(seats) &&
      receipt.signature === signature(receipt),
    'Moritani Nexus has lost its original placement, timing or owner.',
  );
}
export function createNexusMoritani(
  context: NexusMoritaniContext,
  owner: string,
  token: string,
  territory: string,
): NexusMoritaniReceipt {
  const receipt: NexusMoritaniReceipt = {
    version: 1,
    event: JSON.stringify([
      'nexusMoritani',
      context.turn,
      owner,
      token,
      territory,
    ]),
    source: 'mentat',
    phase: 8,
    turn: context.turn,
    owner,
    token,
    territory,
    roster: roster(context),
    signature: '',
  };
  receipt.signature = signature(receipt);
  validateNexusMoritani(context, receipt);
  return receipt;
}

/** One earned Mentat supply placement. Static territory validity is intrinsic;
 * the engine separately proves prior Cunning placements in unusual locations. */
export function quoteNexusMoritaniPlacement(
  state: TerrorState,
  tokenId: string,
  territory: string,
  turn: number,
): TerrorState {
  requireMoritani(
    whole(turn) &&
      staticTerritory(territory) &&
      knownKeys(state, ['tokens', 'placementTurn', 'supplyEpoch']) &&
      Array.isArray(state.tokens) &&
      state.tokens.length === TERROR_KINDS.length &&
      (state.placementTurn === undefined ||
        (whole(state.placementTurn) && state.placementTurn < turn)) &&
      (state.supplyEpoch === undefined ||
        (Number.isSafeInteger(state.supplyEpoch) && state.supplyEpoch >= 0)) &&
      new Set(state.tokens.map((t) => t?.id)).size === TERROR_KINDS.length &&
      new Set(state.tokens.map((t) => t?.kind)).size === TERROR_KINDS.length &&
      state.tokens.every(
        (t) =>
          knownKeys(t, ['id', 'kind', 'location', 'status']) &&
          identifier(t.id) &&
          TERROR_KINDS.includes(t.kind) &&
          ['available', 'placed', 'removed', 'extortion'].includes(t.status) &&
          (t.status === 'placed'
            ? staticTerritory(t.location)
            : t.location === null) &&
          (t.status !== 'extortion' || t.kind === 'extortion'),
      ),
    'Moritani Nexus needs six physical Terror tokens, a static Arrakis destination and an unused Mentat placement.',
  );
  requireMoritani(
    state.tokens.some((t) => t.id === tokenId && t.status === 'available'),
    'Moritani Nexus must place a Terror token from available supply; enhanced relocation is unresolved.',
  );
  return {
    ...state,
    tokens: state.tokens.map((t) =>
      t.id === tokenId
        ? { ...t, status: 'placed', location: territory }
        : { ...t },
    ),
    placementTurn: turn,
  };
}
