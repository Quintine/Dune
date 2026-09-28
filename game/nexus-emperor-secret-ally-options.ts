import type { Action, GameView } from './engine';

/** Bind the current private offer without inspecting another player's cards. */
export function nexusEmperorRevivalAction(
  game: GameView,
  elite: number,
): Action | null {
  const offer = game.nexusEmperorSecretAlly;
  const owner = game.players.find((player) => player.id === game.me);
  if (
    !offer ||
    !owner ||
    owner.ally ||
    game.nexusCards?.card !== 'emperor' ||
    game.players.some((player) => player.faction === 'emperor') ||
    game.status !== 'playing' ||
    game.phase !== 4 ||
    game.response ||
    game.decision ||
    game.truthtrance ||
    game.phaseOpening ||
    game.automaticContinuationPending ||
    game.nexusCards.waiting.length ||
    game.nexusTraitors?.pending ||
    offer.revival.blocked ||
    !Number.isSafeInteger(elite) ||
    !offer.revival.eliteOptions.includes(elite)
  )
    return null;
  return { type: 'nexusEmperorRevive', event: offer.event, elite };
}

/** Spend the physical card only at the owner's completed, personally funded auction payment. */
export function nexusEmperorPurchaseAction(game: GameView): Action | null {
  const offer = game.nexusEmperorSecretAlly;
  const purchase = offer?.purchase;
  const owner = game.players.find((player) => player.id === game.me);
  if (
    !offer ||
    !purchase ||
    purchase.blocked ||
    !owner ||
    owner.ally ||
    game.nexusCards?.card !== 'emperor' ||
    game.players.some((player) => player.faction === 'emperor') ||
    game.status !== 'playing' ||
    game.phase !== 3 ||
    game.decision?.kind !== 'auctionPayment' ||
    game.decision.player !== game.me ||
    game.response ||
    game.truthtrance ||
    game.phaseOpening ||
    game.automaticContinuationPending ||
    game.nexusCards.waiting.length ||
    game.nexusTraitors?.pending ||
    !Number.isSafeInteger(purchase.price) ||
    purchase.price < 1 ||
    !game.auction ||
    game.auction.bidder !== game.me ||
    game.auction.bid !== purchase.price ||
    (game.auction.allyPayment ?? 0) !== 0 ||
    (owner.spice ?? 0) < purchase.price
  )
    return null;
  return { type: 'nexusEmperorPurchase', event: offer.event };
}
