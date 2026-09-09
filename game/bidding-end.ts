import type { Game } from './engine';

export type BiddingEnd = {
  event: string;
  turn: number;
  owners: string[];
  ready: string[];
};

export function biddingEndQuiet(g: Game): boolean {
  return !!g.biddingEnd && !g.decision && !g.response && !g.truthtrance &&
    !g.phaseOpening && !g.pendingTreacheryDiscard && !g.pendingNullentropy &&
    !g.pendingKarama && !g.pendingRicheseGift && !g.pendingExchange &&
    !g.pendingRichesePurchaseIncome && !g.pendingChoamMarketGhola &&
    !g.choamMarket?.sale && !g.choamMarket?.trade;
}

/** Bidding hand counts are public. Never inspect private card identities or
 * spice to decide whether to skip an owner's opportunity. */
export function biddingEndPubliclyEmpty(g: Game, id: string): boolean {
  const owner = g.players.find((p) => p.id === id)!;
  return owner.hand.length === 0 && g.players.every((p) => p.id === id ||
    (p.hand.length < 2 && !(p.faction === 'richese' && p.ally === id &&
      owner.ally === p.id && p.hand.length > 0)));
}

export function biddingEndError(g: Game): string | null {
  const end = g.biddingEnd;
  if (!end) return null;
  const emperor = g.players.find((p) => p.faction === 'emperor');
  const choam = g.players.find((p) => p.faction === 'choam');
  const owners = [emperor?.id, choam?.id].filter((id): id is string => !!id);
  if (g.status !== 'playing' || g.phase !== 3 || end.turn !== g.turn ||
      !g.homeworlds?.custody || !emperor ||
      typeof end.event !== 'string' || !end.event ||
      JSON.stringify(end.owners) !== JSON.stringify(owners) ||
      !Array.isArray(end.ready) || new Set(end.ready).size !== end.ready.length ||
      end.ready.some((id) => !owners.includes(id)) ||
      !!g.auction || !!g.richeseAuction || !!g.currentAuctionSale ||
      (choam ? g.choamMarket?.owner !== choam.id || g.choamMarket.resume !== 'phase'
        : !!g.choamMarket))
    return 'The saved end-of-Bidding opportunity no longer matches its owners or completed auctions.';
  return null;
}
