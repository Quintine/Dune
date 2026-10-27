import { nativePromiseScopeSupported, type NativePromiseScope } from './native-promise-scope';
import { FACTIONS } from './catalog';

export type BribeClaim = { turn: number; recipient: string; minimum: number };
export type BribePromise = BribeClaim & {
  event: string;
  player: string;
  asker: string;
  answer: boolean;
  /** Matching ordinary payments after this answer, before their later receipt. */
  progress: number;
  fulfilled?: boolean;
  released?: boolean;
};
type BribePayment = { recipient: string; amount: number };

export class BribePromiseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BribePromiseError';
  }
}

const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const positiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const optionalBoolean = (value: unknown) => value === undefined || typeof value === 'boolean';

export function parseBribeClaim(value: unknown): BribeClaim {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BribePromiseError('Choose a current-turn ordinary bribe question.');
  const input = value as Record<string, unknown>;
  if (!positiveInteger(input.turn) || !identifier(input.recipient) || !positiveInteger(input.minimum))
    throw new BribePromiseError('Choose the current turn, exact recipient and a positive safe whole bribe minimum.');
  return { turn: input.turn, recipient: input.recipient, minimum: input.minimum };
}

/** The ordinary, grouped and mixed bribe families share this admission. The
 * printed Kull extension is deliberately limited to the existing fresh Basic
 * CHOAM, Ixian, Tleilaxu, Ecaz, Moritani and classic roster; other previews keep their own composition boundaries.
 * This quote grants no start permission or future unowned funds. */
export function bribePromiseModeSupported(game: NativePromiseScope & {
  semutaPreview?: unknown; kullPreview?: unknown; nexusKullPreview?: unknown;
  richeseBetrayalPreview?: unknown; guildBetrayalPreview?: unknown;
  nexusIxianReplacementPreview?: unknown; nexusIxianBetrayalPreview?: unknown;
  nexusHarkonnenBetrayalPreview?: unknown; moritaniAssassinatePreview?: unknown;
  mobileStronghold?: unknown;
}): boolean {
  if (!nativePromiseScopeSupported(game) || game.semutaPreview || game.nexusKullPreview ||
      game.richeseBetrayalPreview) return false;
  if (!game.kullPreview) return true;
  return game.kullPreview === true && game.advanced === false && (game.expansions.length === 2 ||
    game.expansions.length === 3 && game.expansions.includes('ecaz')) &&
    game.expansions.includes('choam') && game.expansions.includes('ix') &&
    game.players.some(player => player.faction === 'choam') &&
    new Set(game.players.map(player => player.faction)).size === game.players.length &&
    game.players.every(player => player.faction === 'choam' || player.faction === 'ixians' ||
      player.faction === 'tleilaxu' || game.expansions.includes('ecaz') &&
      (player.faction === 'ecaz' || player.faction === 'moritani') ||
      FACTIONS.some(faction => faction.id === player.faction && faction.expansion === 'base')) &&
    !game.guildBetrayalPreview && !game.nexusIxianReplacementPreview &&
    !game.nexusIxianBetrayalPreview && !game.nexusHarkonnenBetrayalPreview &&
    !game.moritaniAssassinatePreview &&
    (!game.mobileStronghold || game.players.some(player => player.faction === 'ixians'));
}

export function bribeClaimText(claim: BribeClaim, recipientName: (id: string) => string = id => id): string {
  return `pay at least ${claim.minimum} spice to ${recipientName(claim.recipient)} in ordinary bribes from now until this turn ends`;
}

export function liveBribePromises(promises: readonly BribePromise[], player: string, turn: number): BribePromise[] {
  return promises.filter(promise => promise.player === player && promise.turn === turn &&
    !promise.fulfilled && !promise.released);
}

function validateProgress(promise: BribePromise): void {
  parseBribeClaim(promise);
  if (typeof promise.answer !== 'boolean' || !Number.isSafeInteger(promise.progress) || promise.progress < 0 ||
    !optionalBoolean(promise.fulfilled) || !optionalBoolean(promise.released) ||
    (promise.fulfilled && promise.released) ||
    (!promise.answer && promise.progress >= promise.minimum) ||
    (promise.answer && !promise.released && !!promise.fulfilled !== (promise.progress >= promise.minimum)))
    throw new BribePromiseError('The bribe commitment has invalid cumulative answer progress.');
}

/** Provisional cumulative composition: only the actual payer's completed
 * ordinary payments count. Prior payments, card effects, gifts and the later
 * Mentat receipt do not call this function or add progress again. */
export function recordPromisedBribe(promises: readonly BribePromise[], player: string, turn: number,
  payment: BribePayment): BribePromise[] {
  if (!payment || typeof payment !== 'object' || Array.isArray(payment) ||
    !identifier(payment.recipient) || !positiveInteger(payment.amount))
    throw new BribePromiseError('Retain the exact recipient and positive safe whole ordinary bribe payment.');
  const progress = new Map<BribePromise, number>();
  for (const promise of liveBribePromises(promises, player, turn)) {
    if (promise.recipient !== payment.recipient) continue;
    validateProgress(promise);
    const next = promise.progress + payment.amount;
    if (!Number.isSafeInteger(next))
      throw new BribePromiseError('The cumulative bribe amount exceeds the safe integer range.');
    if (!promise.answer && next >= promise.minimum)
      throw new BribePromiseError('This payment conflicts with your cumulative Truthtrance No answer.');
    progress.set(promise, next);
  }
  return promises.map(promise => {
    const next = progress.get(promise);
    return next === undefined ? promise : {
      ...promise, progress: next,
      ...(promise.answer && next >= promise.minimum ? { fulfilled: true } : {}),
    };
  });
}

/** Minimal final additional ordinary payments, grouped by exact recipient.
 * Overlapping Yes answers share the same future payment; different recipients
 * each require their own spice. No caps remain binding after smaller payments. */
export function bribePromiseRequirements(promises: readonly BribePromise[], player: string, turn: number): BribePayment[] | null {
  const live = liveBribePromises(promises, player, turn);
  const required = new Map<string, number>();
  for (const promise of live) {
    validateProgress(promise);
    if (promise.answer)
      required.set(promise.recipient, Math.max(required.get(promise.recipient) ?? 0, promise.minimum - promise.progress));
  }
  for (const promise of live) {
    const amount = required.get(promise.recipient) ?? 0;
    if (!promise.answer && amount >= promise.minimum - promise.progress) return null;
    if (!Number.isSafeInteger(promise.progress + amount)) return null;
  }
  let total = 0;
  const payments: BribePayment[] = [];
  for (const [recipient, amount] of required) {
    total += amount;
    if (!Number.isSafeInteger(total)) return null;
    if (amount > 0) payments.push({ recipient, amount });
  }
  return payments;
}

export function validateBribePromises(promises: readonly BribePromise[], players: readonly string[]): void {
  if (!Array.isArray(promises)) throw new BribePromiseError('The bribe commitment record is invalid.');
  const events = new Set<string>();
  for (const promise of promises) {
    parseBribeClaim(promise);
    if (!identifier(promise.event) || events.has(promise.event) ||
      !identifier(promise.player) || !identifier(promise.asker) ||
      !players.includes(promise.player) || !players.includes(promise.asker) || !players.includes(promise.recipient) ||
      promise.player === promise.asker || promise.player === promise.recipient)
      throw new BribePromiseError('The bribe commitment lost its original event or participants.');
    validateProgress(promise);
    events.add(promise.event);
  }
}
