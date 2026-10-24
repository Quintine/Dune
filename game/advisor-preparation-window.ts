import type { Game } from './engine';
import type { AdvisorRelease } from './board-resolution-quote';
import { quoteAdvisorBattleOffer } from './movement-phase-quote';

export type AdvisorPreparationWindow = {
  turn: number;
  firstShipment: null | {
    player: string;
    producer: 'ordinary' | 'guildTransport' | 'homeworld' | 'junction' | 'ambassador' | 'sneakAttack';
  };
  deniedTerritories: string[];
};

export type AdvisorPreparationSource = {
  turn: number;
  owner: string;
  territory: string;
};

export type AdvisorPreparationContext = Pick<
  Game,
  | 'status'
  | 'phase'
  | 'turn'
  | 'advanced'
  | 'order'
  | 'players'
  | 'storm'
  | 'mobileStronghold'
  | 'homeworlds'
  | 'advisorPreparation'
>;

export class AdvisorPreparationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdvisorPreparationError';
  }
}

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const count = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const producers = ['ordinary', 'guildTransport', 'homeworld', 'junction', 'ambassador', 'sneakAttack'];
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

function windowBlock(g: AdvisorPreparationContext, owner: string): string | null {
  if (g.status !== 'playing' || g.advanced !== true ||
      !count(g.turn) || g.turn < 1 || !count(g.phase) || g.phase < 2 || g.phase > 5)
    return 'Prepare native advisors after Spice Blow and Nexus, before the first shipment.';
  if (!id(owner) || !Array.isArray(g.players) ||
      g.players.filter(player => player.id === owner && player.faction === 'beneGesserit').length !== 1 ||
      g.players.filter(player => player.id === owner).length !== 1 ||
      g.players.filter(player => player.faction === 'beneGesserit').length !== 1)
    return 'Advisor preparation needs the current native Bene Gesserit owner.';
  const window = g.advisorPreparation;
  if (window === undefined)
    return 'The current advisor-preparation window has not opened.';
  if (!record(window) || !count(window.turn) || window.turn < 1 ||
      window.turn !== g.turn || !Array.isArray(window.deniedTerritories) ||
      window.deniedTerritories.some(territory => !id(territory)) ||
      new Set(window.deniedTerritories).size !== window.deniedTerritories.length)
    return 'The advisor-preparation window has no valid current-turn receipt.';
  if (window.firstShipment !== null) {
    const shipment = window.firstShipment;
    if (!record(shipment) || !id(shipment.player) ||
        g.players.filter(player => player.id === shipment.player).length !== 1 ||
        !producers.includes(shipment.producer))
      return 'The advisor-preparation window has an invalid shipment receipt.';
    return 'The first shipment has closed advisor preparation for this turn.';
  }
  return null;
}

/** Source p28 G's clock wraps the existing native public-board eligibility.
 * The caller owns live priority, receipt opening/closure and stance mutation.
 * An absent receipt never infers a clock from movement or shipment flags. */
export function quoteAdvisorPreparationWindow(
  g: AdvisorPreparationContext,
  owner: string,
): { blocked: string | null; territories: string[]; released: AdvisorRelease[] } {
  const blocked = windowBlock(g, owner);
  if (blocked) return { blocked, territories: [], released: [] };
  try {
    const offer = quoteAdvisorBattleOffer(g);
    const territories = offer.territories.filter(
      territory => !g.advisorPreparation!.deniedTerritories.includes(territory),
    );
    return {
      blocked: territories.length ? null : 'No eligible advisors can prepare for battle now.' +
        (g.advisorPreparation!.deniedTerritories.length ? ' Earlier Karama prevention still applies to its territory.' : ''),
      territories,
      released: offer.released,
    };
  } catch (error) {
    return {
      blocked: error instanceof Error ? error.message : 'The advisor-preparation board is invalid.',
      territories: [],
      released: [],
    };
  }
}

export function quoteAdvisorPreparation(
  g: AdvisorPreparationContext,
  owner: string,
  territory: string,
): AdvisorPreparationSource {
  const quote = quoteAdvisorPreparationWindow(g, owner);
  if (quote.blocked) throw new AdvisorPreparationError(quote.blocked);
  if (!id(territory) || !quote.territories.includes(territory))
    throw new AdvisorPreparationError('These advisors cannot prepare for battle in the current window.');
  return { turn: g.turn, owner, territory };
}

/** Recheck the same current-turn whole-territory declaration before cost or
 * either outcome; no board, denial or original shipment record is changed. */
export function validateAdvisorPreparation(
  g: AdvisorPreparationContext,
  source: AdvisorPreparationSource,
): void {
  if (!record(source) || Object.keys(source).sort().join(',') !== 'owner,territory,turn' ||
      !count(source.turn) || source.turn !== g.turn || !id(source.owner) || !id(source.territory))
    throw new AdvisorPreparationError('Advisor preparation has lost its original source.');
  quoteAdvisorPreparation(g, source.owner, source.territory);
}

/** Native owner-only choices, with no force counts, cards, wallet or receipt
 * payload. Opponents use the original public response when one is declared. */
export function projectAdvisorPreparationWindow(
  g: AdvisorPreparationContext,
  owner: string,
): { blocked: string | null; territories: string[] } | null {
  if (g.advanced !== true || !id(owner) || !Array.isArray(g.players) ||
      g.players.filter(player => player.id === owner && player.faction === 'beneGesserit').length !== 1 ||
      g.players.filter(player => player.id === owner).length !== 1)
    return null;
  const { blocked, territories } = quoteAdvisorPreparationWindow(g, owner);
  return { blocked, territories };
}
