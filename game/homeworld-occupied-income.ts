import { HOMEWORLD_CARDS, homeworldCard, type HomeworldId } from './homeworld-cards';
import { HomeworldCustodyError } from './homeworld-custody';
import {
  quoteStableHomeworldOccupation,
  type StableHomeworldOccupationContext,
  type StableHomeworldOccupier,
} from './homeworld-stable-occupation';

export type HomeworldOccupiedIncomeCredit = { player: string; amount: number };
export type HomeworldOccupiedIncomeReceipt =
  | { world: string; status: 'pending' }
  | { world: string; status: 'settled'; ownAmount: number; credits: HomeworldOccupiedIncomeCredit[] };
export type HomeworldOccupiedIncomeState = {
  version: 1;
  event: string;
  turn: number;
  /** Frozen at Collection entry: neither current armies nor a new alliance may replace a recipient. */
  queue: readonly Readonly<StableHomeworldOccupier>[];
  cursor: number;
  receipts: HomeworldOccupiedIncomeReceipt[];
  signature: string;
};
export type HomeworldOccupiedIncomeOffer = {
  event: string;
  turn: number;
  world: string;
  card: HomeworldId;
  name: string;
  owner: string;
  ownerName: string;
  ally: string | null;
  allyName: string | null;
  amount: number;
  minOwnAmount: number;
  maxOwnAmount: number;
  blocked: string | null;
};

const whole = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
function requireIncome(condition: unknown, message: string): asserts condition {
  if (!condition) throw new HomeworldCustodyError(`Occupied Homeworld Collection: ${message}`);
}
function keys(value: unknown, expected: string[]): boolean {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
}
function identity(row: StableHomeworldOccupier) {
  return [row.world, row.card, row.native, row.occupier, row.ally, row.qualification, row.turn, row.spice];
}
function allocation(row: StableHomeworldOccupier, ownAmount: number): HomeworldOccupiedIncomeCredit[] {
  const credits: HomeworldOccupiedIncomeCredit[] = [];
  if (ownAmount > 0) credits.push({ player: row.occupier, amount: ownAmount });
  if (row.ally && ownAmount < row.spice) credits.push({ player: row.ally, amount: row.spice - ownAmount });
  return credits;
}
function signature(state: HomeworldOccupiedIncomeState): string {
  return JSON.stringify([state.version, state.event, state.turn, state.queue.map(identity), state.cursor,
    state.receipts.map(receipt => receipt.status === 'pending'
      ? [receipt.world, receipt.status]
      : [receipt.world, receipt.status, receipt.ownAmount, receipt.credits.map(credit => [credit.player, credit.amount])])]);
}
/** Historical receipt validation does not re-award or reinterpret its old entitlement. */
export function validateHomeworldOccupiedIncomeState(
  state: HomeworldOccupiedIncomeState, game: StableHomeworldOccupationContext, turn: number,
): void {
  requireIncome(keys(state, ['version', 'event', 'turn', 'queue', 'cursor', 'receipts', 'signature']) &&
    state.version === 1 && text(state.event) && whole(state.turn) && state.turn > 0 && state.turn === turn &&
    Array.isArray(state.queue) && whole(state.cursor) && state.cursor <= state.queue.length &&
    Array.isArray(state.receipts) && state.receipts.length === state.queue.length && typeof state.signature === 'string',
  'invalid or stale saved event, turn, queue or receipts.');
  const seen = new Set<string>();
  for (let index = 0; index < state.queue.length; index++) {
    const row = state.queue[index], receipt = state.receipts[index];
    const card = row && homeworldCard(row.card);
    requireIncome(keys(row, ['world', 'card', 'native', 'occupier', 'ally', 'qualification', 'turn', 'spice']) &&
      card && text(row.world) && text(row.qualification) && row.turn === state.turn &&
      row.spice === card.occupied.spiceIcons && !seen.has(row.world) &&
      game.players.some(player => player.id === row.native && player.faction === card.faction) &&
      game.players.some(player => player.id === row.occupier && player.id !== row.native) &&
      row.world === (card.id === 'salusa_secundus' ? 'homeworld:emperor:salusa' : `homeworld:${card.faction}`) &&
      (card.id !== 'salusa_secundus' || game.advanced) &&
      (row.ally === null || game.players.some(player => player.id === row.ally && player.id !== row.occupier)),
    'invalid frozen world entitlement.');
    seen.add(row.world);
    requireIncome(receipt && receipt.world === row.world, 'receipt lost its original world.');
    if (index >= state.cursor) {
      requireIncome(keys(receipt, ['world', 'status']) && receipt.status === 'pending', 'pending receipt/cursor mismatch.');
    } else {
      requireIncome(keys(receipt, ['world', 'status', 'ownAmount', 'credits']) && receipt.status === 'settled',
        'settled receipt/cursor mismatch.');
      requireIncome(whole(receipt.ownAmount) && receipt.ownAmount <= row.spice &&
        (row.ally !== null || receipt.ownAmount === row.spice) && Array.isArray(receipt.credits), 'invalid settled split.');
      const expected = allocation(row, receipt.ownAmount);
      requireIncome(receipt.credits.length === expected.length && receipt.credits.every((credit, i) =>
        keys(credit, ['player', 'amount']) && credit.player === expected[i].player && credit.amount === expected[i].amount),
      'settled credits do not conserve the printed bank award.');
    }
  }
  requireIncome(state.signature === signature(state), 'saved income signature changed.');
}
function currentBlock(row: StableHomeworldOccupier, game: StableHomeworldOccupationContext): string | null {
  const current = quoteStableHomeworldOccupation(game, row.card);
  if (current.blocked) return current.blocked;
  if (!current.entitlement || JSON.stringify(identity(current.entitlement)) !== JSON.stringify(identity(row)))
    return 'The original occupied Homeworld entitlement or reciprocal ally changed before settlement.';
  return null;
}

/** Printed BANK icons only, including Basic and zero-icon Salusa. Percentage
 * payment/Collection receipts are separate sources. No read, begin or quote
 * changes wallets. The engine persists one queue per turn and atomically applies
 * the returned credits with its next state. Sources: HOMEWORLD_OCCUPATION_RULES
 * 7–33,35–56; HOMEWORLD_RULES83–105; the original thirteen occupied card faces. */
export function beginHomeworldOccupiedIncome(
  game: StableHomeworldOccupationContext,
  event: string,
): HomeworldOccupiedIncomeState {
  requireIncome(text(event) && whole(game.turn) && game.turn > 0, 'a Collection event and turn are required.');
  const queue: StableHomeworldOccupier[] = [];
  for (const card of HOMEWORLD_CARDS) {
    const quote = quoteStableHomeworldOccupation(game, card.id);
    if (card.occupied.spiceIcons > 0)
      requireIncome(!quote.blocked, quote.blocked ?? 'ambiguous occupied world.');
    if (quote.entitlement) queue.push(Object.freeze({ ...quote.entitlement }));
  }
  const state: HomeworldOccupiedIncomeState = { version: 1, event, turn: game.turn, queue: Object.freeze(queue), cursor: 0,
    receipts: queue.map(row => ({ world: row.world, status: 'pending' })), signature: '' };
  state.signature = signature(state);
  return state;
}

/** A public offer is a read-only projection, never a bank award or Karama window. */
export function homeworldOccupiedIncomeOffer(
  state: HomeworldOccupiedIncomeState,
  game: StableHomeworldOccupationContext,
  actor: string,
): HomeworldOccupiedIncomeOffer | null {
  validateHomeworldOccupiedIncomeState(state, game, game.turn);
  const row = state.queue[state.cursor];
  if (!row || row.occupier !== actor) return null;
  return { event: state.event, turn: state.turn, world: row.world, card: row.card,
    name: homeworldCard(row.card)!.name, owner: row.occupier,
    ownerName: game.players.find(player => player.id === row.occupier)!.name,
    ally: row.ally, allyName: row.ally ? game.players.find(player => player.id === row.ally)!.name : null,
    amount: row.spice, minOwnAmount: row.ally ? 0 : row.spice, maxOwnAmount: row.spice,
    blocked: currentBlock(row, game) };
}

export function quoteHomeworldOccupiedIncomeChoice(
  state: HomeworldOccupiedIncomeState,
  game: StableHomeworldOccupationContext,
  actor: string,
  event: string,
  world: string,
  ownAmount: number,
): { state: HomeworldOccupiedIncomeState; credits: HomeworldOccupiedIncomeCredit[] } {
  validateHomeworldOccupiedIncomeState(state, game, game.turn);
  const row = state.queue[state.cursor];
  requireIncome(row && event === state.event && world === row.world && actor === row.occupier,
    'wrong owner, stale event/world, or already settled receipt.');
  const blocked = currentBlock(row, game);
  requireIncome(!blocked, blocked ?? 'occupied entitlement changed.');
  requireIncome(whole(ownAmount) && ownAmount <= row.spice && (row.ally !== null || ownAmount === row.spice),
    'keep an integer from zero through the printed award; without an ally keep the full award.');
  const credits = allocation(row, ownAmount);
  const next: HomeworldOccupiedIncomeState = { ...state, cursor: state.cursor + 1,
    receipts: state.receipts.map((receipt, index) => index === state.cursor
      ? { world: row.world, status: 'settled', ownAmount, credits: credits.map(credit => ({ ...credit })) }
      : receipt.status === 'settled' ? { ...receipt, credits: receipt.credits.map(credit => ({ ...credit })) } : { ...receipt }),
    signature: '' };
  next.signature = signature(next);
  return { state: next, credits };
}
