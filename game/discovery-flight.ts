import {
  consumeOrnithopter,
  isDiscoveryTokenId,
  validateDiscoveryState,
  type DiscoveryOpaqueTokenId,
  type DiscoveryState,
  type ProjectedDiscoveryToken,
} from './discoveries';
import type { MovementMarker } from './ornithopter';

export class DiscoveryFlightError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscoveryFlightError';
  }
}

/** Structural subset of an ordinary canonical MovementOrder, never an action. */
export type DiscoveryFlightMovement = {
  source?: string;
  player: string;
  group: readonly (readonly [string, number])[];
  eliteGroup: Readonly<Record<string, number>>;
  elite: number;
  origin: string;
  total: number;
  to: string;
  sector: number;
  advisors: boolean;
  wantsFighters: boolean;
  lockedTurn?: number;
  noField?: MovementMarker;
};

/** Kept on the pending order until that one group actually moves. No token is
 * consumed by creating this receipt or by an opposing response. */
export type DiscoveryFlightReceipt = {
  token: DiscoveryOpaqueTokenId;
  player: string;
  turn: number;
  move: number;
  acquiredTurn: number;
  selection: string;
};

type Player = { id: string; moved: number };
type Context = {
  status: string;
  turn: number;
  phase: number;
  active: string | null;
  players: readonly Player[];
};
export type DiscoveryFlightContext = Context & {
  discoveries?: DiscoveryState | null;
};
export type DiscoveryFlightOfferContext = Context & {
  discoveries?: {
    tokens: readonly Pick<ProjectedDiscoveryToken,
      'id' | 'face' | 'status' | 'owner' | 'acquiredTurn' | 'revealedTurn'>[];
  } | null;
};

const integer = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const name = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
function requireFlight(value: unknown, message: string): asserts value {
  if (!value) throw new DiscoveryFlightError(message);
}
function validSource(value: unknown, origin: string): value is string {
  if (typeof value !== 'string') return false;
  const prefix = `${origin}:`, sector = Number(value.slice(prefix.length));
  return value.startsWith(prefix) && integer(sector) && sector <= 18 && value === `${prefix}${sector}`;
}

/** Fixed whitelist: a stored receipt or the separate Treachery flight fields
 * cannot recursively enter this signature. Entry and route legality stay with
 * the canonical movement quote, including publicly revealed board locations. */
function selection(move: DiscoveryFlightMovement): string {
  requireFlight(record(move) && move.source === undefined && name(move.player) && name(move.origin) &&
    name(move.to) && integer(move.sector) && move.sector <= 18 &&
    typeof move.advisors === 'boolean' && typeof move.wantsFighters === 'boolean' &&
    (!move.wantsFighters || move.advisors) &&
    (move.lockedTurn === undefined || integer(move.lockedTurn)) &&
    Array.isArray(move.group) && record(move.eliteGroup),
  'Bind the Discovery Ornithopter to an ordinary declared movement group.');
  const group = move.group;
  requireFlight(group.every(part => Array.isArray(part) && part.length === 2 &&
    validSource(part[0], move.origin) && integer(part[1]) && part[1] > 0) &&
    new Set(group.map(([key]) => key)).size === group.length,
  'The Discovery flight has invalid or repeated source forces.');
  requireFlight(Object.entries(move.eliteGroup).every(([key, count]) => integer(count) &&
    group.some(([source, total]) => source === key && count <= total)),
  'The Discovery flight has invalid typed forces.');
  const total = group.reduce((sum, [, amount]) => sum + amount, 0);
  const elite = Object.values(move.eliteGroup).reduce((sum, amount) => sum + amount, 0);
  requireFlight(integer(total) && integer(elite) && integer(move.total) && move.total > 0 &&
    move.total === total + Number(!!move.noField) && integer(move.elite) && move.elite === elite,
  'The Discovery flight must retain its exact physical force count.');
  if (move.noField) requireFlight(record(move.noField) &&
    name(move.noField.tokenId) && name(move.noField.event) && validSource(move.noField.from, move.origin),
  'The Discovery flight has lost its selected No-Field marker.');
  const destination = `${move.to}:${move.sector}`;
  requireFlight(group.every(([key]) => key !== destination) && move.noField?.from !== destination,
    'The Discovery flight must move its selected group to a different location.');
  return JSON.stringify([
    move.player, move.origin,
    [...group].sort(([a], [b]) => a.localeCompare(b)).map(([key, amount]) =>
      [key, amount, move.eliteGroup[key] ?? 0]),
    move.elite, move.total, move.to, move.sector, move.advisors, move.wantsFighters,
    move.lockedTurn ?? null,
    move.noField ? [move.noField.tokenId, move.noField.event, move.noField.from] : null,
  ]);
}

function currentPlayer(context: Context, player: string): Player {
  const owner = context.players.find(candidate => candidate.id === player);
  requireFlight(context.status === 'playing' && context.phase === 5 && context.active === player &&
    integer(context.turn) && context.turn > 0 && owner && integer(owner.moved),
  'Use the Discovery Ornithopter during its owner’s current movement turn.');
  return owner;
}
function inventory(context: DiscoveryFlightContext): DiscoveryState {
  requireFlight(context.discoveries, 'No physical Discovery token inventory is available.');
  try { validateDiscoveryState(context.discoveries); }
  catch (error) {
    throw new DiscoveryFlightError(error instanceof Error ? error.message : 'Invalid Discovery token custody.');
  }
  return context.discoveries;
}
function carriedToken(context: DiscoveryFlightContext, token: unknown, player: string) {
  const state = inventory(context);
  requireFlight(isDiscoveryTokenId(token), 'Choose the physical Discovery Ornithopter token.');
  const held = state.tokens.find(candidate => candidate.id === token);
  requireFlight(held?.face === 'ornithopter' && held.status === 'carried' && held.owner === player,
    'That player does not carry this Discovery Ornithopter.');
  requireFlight(integer(held.acquiredTurn) && held.acquiredTurn > 0 && held.acquiredTurn < context.turn,
    'The Discovery Ornithopter may be used only on a turn after it was acquired.');
  return held;
}

/** Projected eligibility only. The engine still supplies ordinary movement
 * allowances and interaction locks, and quotes the selected route separately. */
export function discoveryFlightOffer(
  context: DiscoveryFlightOfferContext,
  owner: string,
  options: { movesAllowed?: number; blocked?: string | null } = {},
): { token: DiscoveryOpaqueTokenId; acquiredTurn: number; range: 3; blocked: string | null } | null {
  const player = context.players.find(player => player.id === owner);
  const tokens = context.discoveries?.tokens.filter(token =>
    token.face === 'ornithopter' && token.status === 'carried' && token.owner === owner) ?? [];
  if (!player || tokens.length !== 1 || !isDiscoveryTokenId(tokens[0].id) ||
    !integer(tokens[0].acquiredTurn) || tokens[0].acquiredTurn < 1 ||
    tokens[0].revealedTurn !== tokens[0].acquiredTurn) return null;
  const token = tokens[0];
  const blocked = !integer(context.turn) || context.turn < 1 || !integer(player.moved)
    ? 'The current movement turn is unavailable.'
    : token.acquiredTurn! >= context.turn
      ? 'Use this token on a turn after it was acquired.'
      : context.status !== 'playing' || context.phase !== 5 || context.active !== owner
        ? 'Use this token during your own Shipment and Movement turn.'
        : options.blocked ?? (options.movesAllowed !== undefined &&
          (!integer(options.movesAllowed) || player.moved >= options.movesAllowed)
          ? 'No ordinary movement action remains.' : null);
  return { token: token.id, acquiredTurn: token.acquiredTurn!, range: 3, blocked };
}

/** Creates an unspent selection. Run the normal movement/arrival quote before
 * publishing it; this never grants another movement action or spends the token. */
export function quoteDiscoveryFlight(
  context: DiscoveryFlightContext,
  token: unknown,
  move: DiscoveryFlightMovement,
): DiscoveryFlightReceipt {
  const player = currentPlayer(context, move.player);
  const held = carriedToken(context, token, player.id);
  return {
    token: held.id, player: player.id, turn: context.turn, move: player.moved,
    acquiredTurn: held.acquiredTurn!, selection: selection(move),
  };
}

function validateReceipt(context: DiscoveryFlightContext, receipt: DiscoveryFlightReceipt,
  move: DiscoveryFlightMovement, completed: boolean) {
  requireFlight(record(receipt) && Object.keys(receipt).sort().join(',') ===
    'acquiredTurn,move,player,selection,token,turn' && isDiscoveryTokenId(receipt.token) &&
    name(receipt.player) && integer(receipt.turn) && receipt.turn > 0 &&
    integer(receipt.move) && integer(receipt.acquiredTurn) && receipt.acquiredTurn > 0 &&
    typeof receipt.selection === 'string', 'The saved Discovery flight receipt is invalid.');
  const player = currentPlayer(context, receipt.player);
  requireFlight(receipt.player === move.player && receipt.turn === context.turn &&
    player.moved === receipt.move + Number(completed) && receipt.selection === selection(move),
  'The Discovery flight no longer matches its original turn, movement or selected group.');
  const token = carriedToken(context, receipt.token, receipt.player);
  requireFlight(token.acquiredTurn === receipt.acquiredTurn,
    'The Discovery flight no longer matches its token’s acquisition.');
}

/** Recheck the same owned group after a pending response or saved continuation.
 * Response controls themselves are not a reason to invalidate the receipt. */
export function validateDiscoveryFlight(context: DiscoveryFlightContext,
  receipt: DiscoveryFlightReceipt, move: DiscoveryFlightMovement): void {
  validateReceipt(context, receipt, move, false);
}

/** Call only after the canonical group physically moves and its movement count
 * advances once, before post-arrival effects. Return a new inventory for the
 * engine's atomic working copy; rejected or abandoned movement never calls this. */
export function completeDiscoveryFlight(context: DiscoveryFlightContext,
  receipt: DiscoveryFlightReceipt, move: DiscoveryFlightMovement): DiscoveryState {
  validateReceipt(context, receipt, move, true);
  return consumeOrnithopter(context.discoveries!, receipt.player);
}
