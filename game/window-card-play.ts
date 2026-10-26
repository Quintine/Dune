import { harvesterAvailable } from './cards';

export const WINDOW_CARD_EFFECTS = ['weather', 'atomics', 'harvester', 'karamaAuction'] as const;
export type WindowCardEffect = typeof WINDOW_CARD_EFFECTS[number];
export function windowCardNativeEffect(effect: WindowCardEffect): 'weather' | 'atomics' | 'harvester' | 'karama' {
  return effect === 'karamaAuction' ? 'karama' : effect;
}
export type WindowCardOpportunity = { effect: WindowCardEffect; source: string; turn: number };
export type WindowCardGame = {
  status: string;
  phase: number;
  turn: number;
  shieldWallDestroyed: boolean;
  stormCardWindowOpen?: boolean;
  stormResolution?: unknown;
  spiceWindow?: {
    event?: string;
    territory: string;
    sector: number;
    harvested: boolean;
    harvesters?: number;
    harvesterClosed?: boolean;
  } | null;
  response?: unknown;
  decision?: unknown;
  phaseOpening?: unknown;
  truthtrance?: unknown;
  /** Engine rows retain the physical array/index; public views expose only the lot. */
  auction?: unknown;
  bidPromiseLot?: { turn: number; lot: number } | null;
  richeseAuction?: unknown;
  currentAuctionSale?: unknown;
  ixAuction?: unknown;
};

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const whole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** Original global window only. Temporary modal priority, actual card custody,
 * force conditions and chosen effect parameters remain native engine rules. */
export function windowCardOpportunity(game: WindowCardGame, effect: WindowCardEffect): WindowCardOpportunity | null {
  if (game.status !== 'playing' || !whole(game.turn) || game.turn < 1) return null;
  if (effect === 'karamaAuction') {
    if (game.phase !== 3 || game.richeseAuction != null || game.currentAuctionSale != null || game.ixAuction != null ||
      !object(game.auction)) return null;
    const auction = game.auction;
    let lot: number | undefined;
    if ('index' in auction || 'cards' in auction) {
      if (!whole(auction.index) || !Array.isArray(auction.cards) || auction.index >= auction.cards.length ||
        !object(auction.cards[auction.index])) return null;
      lot = auction.index + 1;
      if (!Number.isSafeInteger(lot)) return null;
    }
    if ('bidPromiseLot' in game) {
      const publicLot = game.bidPromiseLot;
      if (!object(publicLot) || Object.keys(publicLot).sort().join(',') !== 'lot,turn' ||
        publicLot.turn !== game.turn || !whole(publicLot.lot) || publicLot.lot < 1 ||
        lot !== undefined && lot !== publicLot.lot) return null;
      lot = publicLot.lot;
    }
    if (lot === undefined) return null;
    return { effect, source: `ordinary-auction:${game.turn}:${lot}`, turn: game.turn };
  }
  if (effect === 'weather' || effect === 'atomics') {
    if (game.phase !== 0 || game.stormResolution || game.stormCardWindowOpen === false ||
      game.stormCardWindowOpen !== undefined && typeof game.stormCardWindowOpen !== 'boolean' ||
      effect === 'atomics' && game.shieldWallDestroyed !== false) return null;
    return { effect, source: `storm:${game.turn}`, turn: game.turn };
  }
  if (effect !== 'harvester' || game.phase !== 1) return null;
  const blow = game.spiceWindow;
  if (!blow || !identifier(blow.territory) || !whole(blow.sector) || typeof blow.harvested !== 'boolean' ||
    blow.harvesters !== undefined && !whole(blow.harvesters) ||
    blow.harvesterClosed !== undefined && typeof blow.harvesterClosed !== 'boolean' || !harvesterAvailable(blow)) return null;
  if (blow.event !== undefined && !identifier(blow.event)) return null;
  return { effect, source: blow.event ?? `legacy-spice-blow:${game.turn}:${blow.territory}:${blow.sector}`, turn: game.turn };
}
