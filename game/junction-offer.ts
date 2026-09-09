import type { Game } from './engine';
import { homeworldContext } from './homeworld-game';
import { homeworldPopulations } from './homeworld-population';
import { HomeworldCustodyError } from './homeworld-custody';

export type JunctionOffer = {
  event: string;
  turn: number;
  owner: string;
  recipient: string;
  rate: 'half' | 'full';
};

/** A public, optional quote for the recipient's current shipment opportunity.
 * It is not a second action allowance or a durable grant for a later turn. */
export function currentJunctionOffer(g: Game): JunctionOffer | null {
  const offer = g.junctionOffer;
  if (!offer || !junctionSponsor(g) || offer.owner !== junctionSponsor(g) ||
      offer.turn !== g.turn || offer.recipient !== g.active || g.phase !== 5 ||
      g.status !== 'playing' || g.players.find((p) => p.id === offer.recipient)?.shipped)
    return null;
  return offer;
}

export function junctionSponsor(g: Game): string | null {
  if (!g.homeworlds?.custody) return null;
  return homeworldPopulations(homeworldContext(g), g.homeworlds.custody)
    .find((world) => world.card === 'junction' && world.side === 'high')?.native ?? null;
}

/** Only public turn and population data bind the opportunity. Hand changes or
 * the sponsor's private balance cannot reveal themselves through this token. */
export function junctionOfferEvent(g: Game): string {
  return JSON.stringify([g.turn, g.phase, g.active, junctionSponsor(g),
    g.players.find((p) => p.id === g.active)?.shipped ?? null]);
}

export function junctionOfferIntegrity(g: Game): void {
  const offer = g.junctionOffer;
  if (offer == null) return;
  if (typeof offer !== 'object' || Array.isArray(offer) ||
      Object.keys(offer).sort().join(',') !== 'event,owner,rate,recipient,turn' ||
      typeof offer.event !== 'string' || !offer.event.length ||
      !Number.isSafeInteger(offer.turn) || offer.turn < 1 || offer.turn > g.turn ||
      !g.homeworlds?.custody || !g.players.some((p) => p.id === offer.owner && p.faction === 'guild') ||
      offer.owner === offer.recipient || !g.players.some((p) => p.id === offer.recipient) ||
      !['half', 'full'].includes(offer.rate))
    throw new HomeworldCustodyError('The saved Junction offer needs its original Guild, recipient, turn and tariff.');
}
