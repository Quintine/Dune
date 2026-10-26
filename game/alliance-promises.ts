import { nativePromiseScopeSupported, type NativePromiseScope } from './native-promise-scope';
import { NexusAllianceError, quoteNexusAlliance } from './nexus-alliance';

export type AllianceClaim = { turn: number; partner: string };
export type AllianceOpportunity = { turn: number; source: string };
export type AlliancePromise = AllianceClaim & {
  event: string;
  /** Internal binding to the original Nexus interval, not public question text. */
  source: string;
  player: string;
  asker: string;
  answer: boolean;
  fulfilled?: boolean;
  released?: boolean;
};
type AllianceContext = {
  players: readonly { id: string; ally: string | null }[];
  offers: Readonly<Record<string, string>>;
};
type AllianceAction = { type: 'alliance'; target: string | null };

export class AlliancePromiseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AlliancePromiseError';
  }
}

const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const optionalBoolean = (value: unknown) => value === undefined || typeof value === 'boolean';

export function parseAllianceClaim(value: unknown): AllianceClaim {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new AlliancePromiseError('Choose a final-alliance question for the current Nexus.');
  const input = value as Record<string, unknown>;
  if (typeof input.turn !== 'number' || !Number.isSafeInteger(input.turn) || input.turn < 1 || !identifier(input.partner))
    throw new AlliancePromiseError('Choose the current turn and exact alliance partner.');
  return { turn: input.turn, partner: input.partner };
}

/** This is the original bare native context. An ordinary worm Nexus does not
 * require selecting the optional Nexus Cards module or change a start gate. */
export function alliancePromiseModeSupported(game: NativePromiseScope & {
  semutaPreview?: unknown; kullPreview?: unknown; nexusKullPreview?: unknown;
  richeseBetrayalPreview?: unknown;
}): boolean {
  return nativePromiseScopeSupported(game) && !game.semutaPreview && !game.kullPreview &&
    !game.nexusKullPreview && !game.richeseBetrayalPreview;
}

export function allianceClaimText(claim: AllianceClaim, partnerName: (id: string) => string = id => id): string {
  return `be allied with ${partnerName(claim.partner)} when this Nexus ends`;
}

export function liveAlliancePromises(promises: readonly AlliancePromise[], player: string,
  opportunity: AllianceOpportunity): AlliancePromise[] {
  return promises.filter(promise => promise.player === player && promise.turn === opportunity.turn &&
    promise.source === opportunity.source && !promise.fulfilled && !promise.released);
}

export function alliancePromiseRequirements(promises: readonly AlliancePromise[], player: string,
  opportunity: AllianceOpportunity): { partner: string | null; forbidden: string[] } | null {
  let partner: string | null = null;
  const forbidden = new Set<string>();
  for (const promise of liveAlliancePromises(promises, player, opportunity)) {
    if (promise.answer) {
      if (partner !== null && partner !== promise.partner) return null;
      partner = promise.partner;
    } else forbidden.add(promise.partner);
  }
  return partner !== null && forbidden.has(partner) ? null : { partner, forbidden: [...forbidden] };
}

/** This describes final membership only. Temporary proposals or membership do
 * not settle a No; the engine owns the actual Nexus closing event. */
export function alliancePromisesMatch(promises: readonly AlliancePromise[], player: string,
  opportunity: AllianceOpportunity, ally: string | null): boolean {
  return liveAlliancePromises(promises, player, opportunity)
    .every(promise => (ally === promise.partner) === promise.answer);
}

/** Provisional owned-action witness. Never propose on another player's behalf
 * or assume a later acceptance, departure or renewed offer. */
export function findAlliancePromisePlan(promises: readonly AlliancePromise[], player: string,
  opportunity: AllianceOpportunity, context: AllianceContext): AllianceAction[] | null {
  const requirements = alliancePromiseRequirements(promises, player, opportunity);
  if (!requirements) return null;
  let players = context.players.map(seat => ({ ...seat }));
  let offers = { ...context.offers };
  const owner = players.find(seat => seat.id === player);
  if (!owner) return null;
  if (alliancePromisesMatch(promises, player, opportunity, owner.ally)) return [];
  const actions: AllianceAction[] = [];
  const quote = (target: string | null) => {
    const result = quoteNexusAlliance({ players, offers, actor: player, target });
    players = players.map(seat => ({ ...seat, ally: result.allies[seat.id] }));
    offers = result.offers;
    actions.push({ type: 'alliance', target });
  };
  try {
    if (requirements.partner === null) {
      if (owner.ally !== null && requirements.forbidden.includes(owner.ally)) quote(null);
    } else {
      const desired = players.find(seat => seat.id === requirements.partner);
      if (!desired || desired.ally !== null || offers[desired.id] !== player) return null;
      if (owner.ally !== null) quote(null);
      // Breaking the owner's old pair may change offers. Use only consent
      // retained by the canonical quote, not the original copied proposal.
      if (offers[desired.id] !== player) return null;
      quote(desired.id);
    }
  } catch (error) {
    if (error instanceof NexusAllianceError) return null;
    throw error;
  }
  return alliancePromisesMatch(promises, player, opportunity, players.find(seat => seat.id === player)!.ally)
    ? actions : null;
}

export function validateAlliancePromises(promises: readonly AlliancePromise[], players: readonly string[]): void {
  if (!Array.isArray(promises)) throw new AlliancePromiseError('The alliance commitment record is invalid.');
  const events = new Set<string>();
  for (const promise of promises) {
    parseAllianceClaim(promise);
    if (!identifier(promise.event) || events.has(promise.event) || !identifier(promise.source) ||
      !identifier(promise.player) || !identifier(promise.asker) ||
      !players.includes(promise.player) || !players.includes(promise.asker) || !players.includes(promise.partner) ||
      promise.player === promise.asker || promise.player === promise.partner || typeof promise.answer !== 'boolean' ||
      !optionalBoolean(promise.fulfilled) || !optionalBoolean(promise.released) || promise.fulfilled && promise.released)
      throw new AlliancePromiseError('The alliance commitment lost its Nexus source, event or participants.');
    events.add(promise.event);
  }
}
