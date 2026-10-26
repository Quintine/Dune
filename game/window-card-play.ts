import { harvesterAvailable } from './cards';

export const WINDOW_CARD_EFFECTS = ['weather', 'atomics', 'harvester', 'karamaAuction', 'karamaShipment', 'thumper'] as const;
export type WindowCardEffect = typeof WINDOW_CARD_EFFECTS[number];
export function windowCardNativeEffect(effect: WindowCardEffect): 'weather' | 'atomics' | 'harvester' | 'karama' | 'thumper' {
  return effect === 'karamaAuction' || effect === 'karamaShipment' ? 'karama' : effect;
}
export type KaramaShipmentOpportunity = { effect: 'karamaShipment'; source: string; turn: number; recipient: string };
export type KaramaShipmentSource = { turn: number; recipient: string; kind: 'original' } |
  { turn: number; recipient: string; kind: 'cunning'; event: string };
export type WindowCardOpportunity = { effect: Exclude<WindowCardEffect, 'karamaShipment'>; source: string; turn: number } |
  KaramaShipmentOpportunity;
export type WindowCardGame = {
  status: string;
  phase: number;
  turn: number;
  shieldWallDestroyed: boolean;
  stormCardWindowOpen?: boolean;
  stormResolution?: unknown;
  thumperWindowOpen?: boolean;
  spiceSequence?: unknown;
  spiceResolution?: unknown;
  nexus?: unknown;
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
  active?: string | null;
  movementRemaining?: readonly string[] | null;
  players?: readonly { id: string; shipped?: boolean }[];
  karamaShipping?: { player: string } | null;
  nexusGuildCunningHistory?: readonly { receipt: { turn: number; owner: string; event: string }; stage: string }[];
  /** Public projection contains no physical cards or private funding. */
  karamaShipmentWindows?: readonly KaramaShipmentOpportunity[];
};

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const whole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** Source decoding remains available after the actual grant closes its window. */
export function parseKaramaShipmentSource(source: unknown): KaramaShipmentSource | null {
  if (!identifier(source)) return null;
  let tuple: unknown;
  try { tuple = JSON.parse(source); } catch { return null; }
  if (!Array.isArray(tuple) || tuple[0] !== 'karamaShipment' || !whole(tuple[1]) || tuple[1] < 1 ||
    !identifier(tuple[2]) || JSON.stringify(tuple) !== source) return null;
  if (tuple.length === 4 && tuple[3] === 'original') return { turn: tuple[1], recipient: tuple[2], kind: 'original' };
  return tuple.length === 5 && tuple[3] === 'cunning' && identifier(tuple[4])
    ? { turn: tuple[1], recipient: tuple[2], kind: 'cunning', event: tuple[4] } : null;
}

/** Every still-unused original entitlement remains bound through other actors'
 * turns. A declared Cunning continuation permanently retires its original one. */
export function karamaShipmentOpportunities(game: WindowCardGame): KaramaShipmentOpportunity[] {
  if (game.status !== 'playing' || game.phase !== 5 || !whole(game.turn) || game.turn < 1 ||
    !Array.isArray(game.players) || !game.players.length ||
    !game.players.every(player => object(player) && identifier(player.id)) ||
    !Array.isArray(game.movementRemaining)) return [];
  const players = game.players, seated = new Set(players.map(player => player.id));
  const remaining = game.movementRemaining;
  if (seated.size !== players.length || !remaining.every(recipient => identifier(recipient) && seated.has(recipient)) ||
    new Set(remaining).size !== remaining.length ||
    game.active != null && (!identifier(game.active) || !remaining.includes(game.active))) return [];
  const grant = game.karamaShipping;
  if (grant != null && (!object(grant) || !identifier(grant.player) || !seated.has(grant.player))) return [];
  if ('karamaShipmentWindows' in game) {
    if (!Array.isArray(game.karamaShipmentWindows)) return [];
    const sources = new Set<string>(), recipients = new Set<string>(), result: KaramaShipmentOpportunity[] = [];
    for (const window of game.karamaShipmentWindows) {
      if (!object(window) || Object.keys(window).sort().join(',') !== 'effect,recipient,source,turn' ||
        window.effect !== 'karamaShipment' || window.turn !== game.turn || !identifier(window.recipient) ||
        !remaining.includes(window.recipient) || grant?.player === window.recipient ||
        !identifier(window.source) || sources.has(window.source) || recipients.has(window.recipient)) return [];
      const parsed = parseKaramaShipmentSource(window.source);
      if (!parsed || parsed.turn !== game.turn || parsed.recipient !== window.recipient ||
        parsed.kind === 'cunning' && window.recipient !== game.active) return [];
      sources.add(window.source); recipients.add(window.recipient);
      result.push({ effect: 'karamaShipment', turn: game.turn, source: window.source, recipient: window.recipient });
    }
    return result;
  }
  if (!players.every(player => typeof player.shipped === 'boolean')) return [];
  const history = game.nexusGuildCunningHistory;
  if (history !== undefined && (!Array.isArray(history) || !history.every(record => object(record) && object(record.receipt) &&
    whole(record.receipt.turn) && record.receipt.turn > 0 && record.receipt.turn <= game.turn &&
    identifier(record.receipt.owner) && seated.has(record.receipt.owner) && identifier(record.receipt.event) &&
    typeof record.stage === 'string' && ['pending', 'secondShipment', 'extraMove', 'completed', 'canceled'].includes(record.stage)) ||
    new Set(history.map(record => record.receipt.event)).size !== history.length)) return [];
  const current = history?.at(-1);
  return remaining.flatMap(recipient => {
    if (grant?.player === recipient) return [];
    const cunning = history?.some(record => record.receipt.turn === game.turn && record.receipt.owner === recipient);
    if (cunning) {
      if (!current || current.receipt.turn !== game.turn || current.receipt.owner !== recipient ||
        current.stage !== 'secondShipment' || game.active !== recipient) return [];
      return [{ effect: 'karamaShipment' as const, turn: game.turn, recipient,
        source: JSON.stringify(['karamaShipment', game.turn, recipient, 'cunning', current.receipt.event]) }];
    }
    return players.find(player => player.id === recipient)!.shipped ? [] : [{ effect: 'karamaShipment' as const,
      turn: game.turn, recipient, source: JSON.stringify(['karamaShipment', game.turn, recipient, 'original']) }];
  });
}

/** Original global window only. Temporary modal priority, actual card custody,
 * force conditions and chosen effect parameters remain native engine rules. */
function globalWindowCardOpportunity(game: WindowCardGame, effect: WindowCardEffect): WindowCardOpportunity | null {
  if (game.status !== 'playing' || !whole(game.turn) || game.turn < 1) return null;
  if (effect === 'thumper') {
    if (game.phase !== 1 || game.thumperWindowOpen !== undefined && typeof game.thumperWindowOpen !== 'boolean' ||
      game.thumperWindowOpen === false || game.thumperWindowOpen === undefined &&
      (game.spiceSequence || game.spiceResolution || game.spiceWindow || game.nexus)) return null;
    return { effect, source: `first-spice-reveal:${game.turn}`, turn: game.turn };
  }
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

/** New shipment questions use the current recipient. Accepted rows can instead
 * retain an exact original source while a different recipient is active. */
export function windowCardOpportunity(game: WindowCardGame, effect: WindowCardEffect,
  source?: string): WindowCardOpportunity | null {
  if (effect === 'karamaShipment') return karamaShipmentOpportunities(game).find(window =>
    source === undefined ? window.recipient === game.active : window.source === source) ?? null;
  const window = globalWindowCardOpportunity(game, effect);
  return window && (source === undefined || window.source === source) ? window : null;
}
