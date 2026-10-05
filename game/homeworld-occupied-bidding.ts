import type { FactionId } from './catalog';
import { handLimit, type Game } from './engine';
import type { HomeworldId } from './homeworld-cards';
import { HomeworldCustodyError } from './homeworld-custody';
import { quoteStableHomeworldOccupation } from './homeworld-stable-occupation';

export type OccupiedBiddingKind =
  | 'atreidesInspection'
  | 'ixAuction'
  | 'richeseCache'
  | 'harkonnenBonus';
export type OccupiedBiddingAuthority = {
  kind: OccupiedBiddingKind;
  source: 'auctionLot' | 'ixAuctionPool' | 'richeseCache' | 'treacheryStock';
  /** Original native power provider, not a substitute buyer, seller or payer. */
  provider: string | null;
  controller: string | null;
  inspectionAudience: string[];
  /** Alternatives for ONE existing purchase bonus, never one card per player. */
  bonusRecipients: string[];
  bonusStockAvailable: boolean | null;
  occupied: boolean;
  blocked: string | null;
};

export class OccupiedBiddingError extends HomeworldCustodyError {}

const sources: Record<OccupiedBiddingKind, {
  card: HomeworldId;
  faction: FactionId;
  source: OccupiedBiddingAuthority['source'];
}> = {
  atreidesInspection: { card: 'caladan', faction: 'atreides', source: 'auctionLot' },
  ixAuction: { card: 'ix', faction: 'ixians', source: 'ixAuctionPool' },
  richeseCache: { card: 'richese', faction: 'richese', source: 'richeseCache' },
  harkonnenBonus: { card: 'giedi_prime', faction: 'harkonnen', source: 'treacheryStock' },
};

/** Authority for an ORIGINAL native Bidding effect only. Its producer still
 * validates the invoice/lot/window and physical card custody. This pure quote
 * neither initiates another inspection/draw nor confers captured Nexus powers.
 * Sources: original Caladan, Ix, Richese and Giedi Prime occupied card faces;
 * HOMEWORLD_OCCUPATION_RULES7–33,35–56 through the shared stable-source gate. */
export function quoteOccupiedBiddingAuthority(
  game: Game,
  kind: OccupiedBiddingKind,
): OccupiedBiddingAuthority {
  const rule = sources[kind];
  if (!rule) throw new OccupiedBiddingError('Unknown original Homeworld Bidding effect.');
  const native = game.players.find(player => player.faction === rule.faction);
  const bonusStockAvailable = kind === 'harkonnenBonus'
    ? game.deck.length > 0 || game.discard.length > 0 : null;
  const quote: OccupiedBiddingAuthority = {
    kind, source: rule.source, provider: native?.id ?? null, controller: null,
    inspectionAudience: [], bonusRecipients: [], bonusStockAvailable,
    occupied: false, blocked: null,
  };
  if (!native) return quote;
  const occupation = quoteStableHomeworldOccupation(game, rule.card);
  if (occupation.blocked) return { ...quote, blocked: occupation.blocked };
  const entitlement = occupation.entitlement;
  quote.occupied = entitlement !== null;
  quote.controller = entitlement?.occupier ?? native.id;
  switch (kind) {
    case 'atreidesInspection':
      // SHARES: native inspection survives. No borrowing by the occupier's ally.
      quote.controller = native.id;
      quote.inspectionAudience = entitlement ? [native.id, entitlement.occupier] : [native.id];
      break;
    case 'ixAuction':
      // CONTROLS: the actual drawn pool/selection has one decision owner and
      // audience, not an extra native peek. Setup/Technology are separate powers.
      quote.inspectionAudience = [quote.controller];
      break;
    case 'richeseCache':
      // CHOOSES: only this cache-card choice changes owner. The original cache
      // remains native custody/knowledge; declaration, Black Market, unbid-card
      // disposal, seller/payment and special-lot substitution do not transfer.
      quote.inspectionAudience = entitlement ? [native.id, entitlement.occupier] : [native.id];
      break;
    case 'harkonnenBonus': {
      // The printed condition is the RECEIVER's real hand space, not the
      // native buyer's post-purchase space. The same draw uses deck/discard;
      // cards in cache, a pending pool or other hands are not drawable stock.
      const candidates = entitlement
        ? [entitlement.occupier, ...(entitlement.ally ? [entitlement.ally] : [])]
        : [native.id];
      if (bonusStockAvailable) quote.bonusRecipients = candidates.filter(id => {
        const recipient = game.players.find(player => player.id === id);
        return recipient !== undefined && recipient.hand.length < handLimit(recipient);
      });
      break;
    }
  }
  return quote;
}

/** Validate the decision actor without replacing the original source provider. */
export function requireOccupiedBiddingController(
  game: Game,
  kind: OccupiedBiddingKind,
  player: string,
): OccupiedBiddingAuthority {
  const quote = quoteOccupiedBiddingAuthority(game, kind);
  if (quote.blocked) throw new OccupiedBiddingError(quote.blocked);
  if (kind === 'atreidesInspection'
    ? !quote.inspectionAudience.includes(player)
    : quote.controller !== player)
    throw new OccupiedBiddingError('This player does not control the original Bidding effect.');
  return quote;
}

/** Requote at acceptance: alliances, genuine hand space and draw stock can
 * change while the original purchase continuation is awaiting its recipient. */
export function requireOccupiedBiddingBonusRecipient(
  game: Game,
  recipient: string,
): OccupiedBiddingAuthority {
  const quote = quoteOccupiedBiddingAuthority(game, 'harkonnenBonus');
  if (quote.blocked) throw new OccupiedBiddingError(quote.blocked);
  if (!quote.bonusRecipients.includes(recipient))
    throw new OccupiedBiddingError('This player cannot receive the original purchase bonus.');
  return quote;
}
