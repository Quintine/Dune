import { TERRITORIES } from './board';
import type { FactionId } from './catalog';
import {
  TERROR_KINDS,
  TERROR_STRONGHOLDS,
  type TerrorState,
} from './moritani-terror';

export type NexusMoritaniContext = {
  turn: number;
  players: readonly { id: string; faction: FactionId }[];
};
type NexusMoritaniEvidence = {
  version: 1;
  event: string;
  turn: number;
  owner: string;
  token: string;
  territory: string;
  roster: { id: string; faction: FactionId }[];
  signature: string;
};
export type NexusMoritaniGrummanSource = {
  source: 'grumman';
  sourceEvent: string;
  prerequisite: string;
};
export type NexusMoritaniReceipt = NexusMoritaniEvidence &
  (
    | { source: 'mentat'; phase: 8 }
    | (NexusMoritaniGrummanSource & { phase: 7 })
  );
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
  const evidence = [
    receipt.version,
    receipt.event,
    receipt.source,
    receipt.phase,
    receipt.turn,
    receipt.owner,
    receipt.token,
    receipt.territory,
    receipt.roster.map((p) => [p.id, p.faction]),
  ];
  if (receipt.source === 'grumman')
    evidence.push(receipt.sourceEvent, receipt.prerequisite);
  return JSON.stringify(evidence);
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
      ...(receipt?.source === 'grumman'
        ? ['sourceEvent', 'prerequisite']
        : []),
    ]) &&
      Object.keys(receipt).length ===
        (receipt.source === 'grumman' ? 12 : 10) &&
      receipt.version === 1 &&
      (receipt.source === 'mentat'
        ? receipt.phase === 8
        : receipt.source === 'grumman' &&
          receipt.phase === 7 &&
          identifier(receipt.sourceEvent) &&
          TERROR_STRONGHOLDS.includes(receipt.prerequisite)) &&
      whole(receipt.turn) &&
      receipt.turn <= context.turn &&
      identifier(receipt.token) &&
      staticTerritory(receipt.territory) &&
      seats.some((p) => p.id === receipt.owner && p.faction === 'moritani') &&
      receipt.event ===
        JSON.stringify(
          receipt.source === 'grumman'
            ? [
                'nexusMoritaniGrumman',
                receipt.turn,
                receipt.owner,
                receipt.token,
                receipt.territory,
                receipt.sourceEvent,
                receipt.prerequisite,
              ]
            : [
                'nexusMoritani',
                receipt.turn,
                receipt.owner,
                receipt.token,
                receipt.territory,
              ],
        ) &&
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
  source?: NexusMoritaniGrummanSource,
): NexusMoritaniReceipt {
  requireMoritani(
    source === undefined ||
      (knownKeys(source, ['source', 'sourceEvent', 'prerequisite']) &&
        Object.keys(source).length === 3 &&
        source.source === 'grumman'),
    'Moritani Nexus needs its original Grumman collection source.',
  );
  const evidence: NexusMoritaniEvidence = {
    version: 1,
    event: JSON.stringify(
      source
        ? [
            'nexusMoritaniGrumman',
            context.turn,
            owner,
            token,
            territory,
            source.sourceEvent,
            source.prerequisite,
          ]
        : ['nexusMoritani', context.turn, owner, token, territory],
    ),
    turn: context.turn,
    owner,
    token,
    territory,
    roster: roster(context),
    signature: '',
  };
  const receipt: NexusMoritaniReceipt = source
    ? { ...evidence, ...source, phase: 7 }
    : { ...evidence, source: 'mentat', phase: 8 };
  receipt.signature = signature(receipt);
  validateNexusMoritani(context, receipt);
  return receipt;
}

function requireSupplyPlacement(
  state: TerrorState,
  tokenId: string,
  territory: string,
): void {
  requireMoritani(
    staticTerritory(territory) &&
      knownKeys(state, ['tokens', 'placementTurn', 'supplyEpoch']) &&
      Array.isArray(state.tokens) &&
      state.tokens.length === TERROR_KINDS.length &&
      (state.placementTurn === undefined || whole(state.placementTurn)) &&
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
    'Moritani Nexus needs six physical Terror tokens and a static Arrakis destination; Hidden Mobile Stronghold and Homeworld placement are excluded.',
  );
  requireMoritani(
    state.tokens.some((t) => t.id === tokenId && t.status === 'available'),
    'Moritani Nexus must place a Terror token from available supply; Cunning cannot enhance relocation.',
  );
}
function placeSupplyToken(
  state: TerrorState,
  tokenId: string,
  territory: string,
): TerrorState {
  return {
    ...state,
    tokens: state.tokens.map((t) =>
      t.id === tokenId
        ? { ...t, status: 'placed', location: territory }
        : { ...t },
    ),
  };
}

/** One earned Mentat supply placement. Static territory validity is intrinsic;
 * the engine separately proves prior Cunning placements in unusual locations. */
export function quoteNexusMoritaniPlacement(
  state: TerrorState,
  tokenId: string,
  territory: string,
  turn: number,
): TerrorState {
  requireSupplyPlacement(state, tokenId, territory);
  requireMoritani(
    whole(turn) &&
      (state.placementTurn === undefined || state.placementTurn < turn),
    'Moritani Nexus needs an unused Mentat placement for this turn.',
  );
  return { ...placeSupplyToken(state, tokenId, territory), placementTurn: turn };
}

/** Broaden an already-available native Grumman addition, not its prerequisite.
 * The engine owns population, Collection timing and source-frame authorization.
 * This separate opportunity never consumes or inspects Mentat timing. */
export function quoteNexusMoritaniGrummanPlacement(
  state: TerrorState,
  tokenId: string,
  territory: string,
  prerequisite: string,
): TerrorState {
  requireSupplyPlacement(state, tokenId, territory);
  requireMoritani(
    TERROR_STRONGHOLDS.includes(prerequisite) &&
      state.tokens.some(
        (token) =>
          token.status === 'placed' && token.location === prerequisite,
      ),
    'Moritani Nexus needs an ordinary Grumman addition at a stronghold already containing Terror.',
  );
  return placeSupplyToken(state, tokenId, territory);
}
