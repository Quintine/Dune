import type { Action, GameView } from './engine';
import { gameTerritories, MOBILE_STRONGHOLD } from './board';
import { quoteNexusRicheseShipment } from './nexus-richese';

export function nexusRicheseCanAct(g: GameView): boolean {
  const me = g.players.find((p) => p.id === g.me);
  if (
    !me ||
    me.ally ||
    g.nexusCards?.card !== 'richese' ||
    g.players.some((p) => p.faction === 'richese')
  )
    return false;
  const offer = g.nexusRichese;
  return !!(
    offer &&
    !offer.blocked &&
    offer.event === JSON.stringify(['nexusRichese', g.turn, g.me]) &&
    g.status === 'playing' &&
    g.phase === 5 &&
    g.active === g.me &&
    !me.shipped &&
    !g.response &&
    !g.decision &&
    !g.truthtrance &&
    !g.phaseOpening &&
    !g.automaticContinuationPending &&
    !g.nexusCards.waiting.length &&
    !g.nexusTraitors?.pending
  );
}

/** Price only the authorized reserve shipment; physical arrival stays unchanged. */
export function nexusRicheseQuote(
  g: GameView,
  territory: string,
  amount: number,
) {
  if (!nexusRicheseCanAct(g)) return null;
  const me = g.players.find((p) => p.id === g.me)!;
  const destination = gameTerritories(g).find((t) => t.id === territory);
  if (
    !destination ||
    (territory === MOBILE_STRONGHOLD && me.faction !== 'ixians') ||
    !Number.isSafeInteger(amount) ||
    amount < 1 ||
    amount > Math.min(5, me.reserves, g.nexusRichese!.maxForces)
  )
    return null;
  return quoteNexusRicheseShipment(
    {
      faction: me.faction,
      halfRate: me.faction === 'guild' || g.karamaShipping?.player === g.me,
    },
    destination.type,
    amount,
  );
}

export function nexusRicheseAction(
  g: GameView,
  event: string,
  shipment: Action,
): Action | null {
  if (
    !nexusRicheseCanAct(g) ||
    event !== g.nexusRichese!.event ||
    shipment.type !== 'ship' ||
    Object.keys(shipment).some(
      (key) =>
        ![
          'type',
          'territory',
          'sector',
          'amount',
          'elite',
          'homeworldSources',
          'allyPayment',
        ].includes(key),
    ) ||
    !nexusRicheseQuote(g, String(shipment.territory), Number(shipment.amount))
  )
    return null;
  return { ...shipment, nexus: event };
}
