import type { Action, GameView } from './engine';
import { arrivalAsAdvisor } from './advisors';
import { splitLocation, territory, validLocation } from './board';
import {
  MovementArrivalError,
  quoteCompletedMovementArrival,
  type CompletedMovementArrivalInput,
} from './karama-movement-preflight';
import {
  guildShipmentIncome,
  reserveShipmentCost,
  shipmentPaymentBounds,
} from './shipment-price';
import { quoteSmugglerShipment } from './smuggler-shipment';

/**
 * Known arrival support for ordinary owner-view candidates, not a complete
 * action validator. Homeworld, explicit Nexus and special movement routes keep
 * their own adapters and fallbacks. No hidden Terror face or rival hand enters
 * this quote, and unexpected failures are never treated as rejected candidates.
 */
export function botArrivalBlock(g: GameView, action: Action): string | null {
  if (
    g.status !== 'playing' ||
    g.phase !== 5 ||
    g.active !== g.me ||
    !['ship', 'move'].includes(action.type) ||
    g.homeworlds ||
    action.nexus !== undefined ||
    action.source !== undefined ||
    action.homeworldSources !== undefined ||
    typeof action.territory !== 'string' ||
    typeof action.sector !== 'number' ||
    !validLocation(action.territory, action.sector)
  )
    return null;
  const me = g.players.find((p) => p.id === g.me);
  if (!me) return null;
  const to = action.territory;
  const controls = {
    response: !!g.response,
    decision: !!g.decision,
    pendingTerror: !!g.terrorEntry,
    pendingAmbassador: !!g.ambassadorEntry,
    paidBox: g.decision?.kind === 'nullentropy',
  };
  let order: CompletedMovementArrivalInput['order'];
  if (action.type === 'ship') {
    const amount = action.noField === undefined ? action.amount : 1;
    if (
      typeof amount !== 'number' ||
      !Number.isSafeInteger(amount) ||
      amount < 1 ||
      (action.noField !== undefined && me.faction !== 'richese')
    )
      return null;
    const guild = g.players.find((p) => p.faction === 'guild');
    const halfRate =
      me.faction === 'guild' ||
      guild?.id === me.ally ||
      g.karamaShipping?.player === me.id;
    // A No-Field's concealed value and optional companion never change its price.
    const smuggler =
      action.noField === undefined && action.smuggler === true
        ? quoteSmugglerShipment(g, me.id, to, amount)
        : null;
    const cost = reserveShipmentCost(
      { faction: me.faction, halfRate },
      territory(to).type,
      amount - (smuggler ? 1 : 0),
    );
    const bounds = shipmentPaymentBounds(cost, me.spice ?? 0, g.aid.available);
    const allyPayment = action.allyPayment ?? bounds.minimum;
    if (
      typeof allyPayment !== 'number' ||
      !Number.isSafeInteger(allyPayment) ||
      allyPayment < bounds.minimum ||
      allyPayment > bounds.maximum
    )
      return null;
    const income = guildShipmentIncome({
      guild: guild?.id,
      shipper: me.id,
      ally: me.ally,
      cost,
      allyPayment,
      bankOnly: g.karamaShipping?.player === me.id,
    });
    const bg = g.players.find((p) => p.faction === 'beneGesserit');
    // Without Homeworlds, a positive public reserve pool grants accompaniment.
    const accompaniment =
      me.faction !== 'fremen' && !!bg && bg.id !== me.id && bg.reserves > 0;
    controls.response ||=
      income > 0 ||
      (g.advanced && me.faction === 'fremen' && action.sector === g.storm);
    controls.decision ||= accompaniment;
    order = {
      player: me.id,
      origin: 'reserves',
      to,
      advisors: arrivalAsAdvisor(g, me, to),
      wantsFighters: false,
    };
  } else {
    if (
      g.ornithopter?.active ||
      [
        'movementCard',
        'ornithopter',
        'ornithopterEvent',
        'planetologist',
        'sandmaster',
        'discoveryOrnithopter',
        'discoveryFlight',
        'origins',
      ].some((key) => action[key] !== undefined)
    )
      return null;
    let entries: [string, unknown][];
    if (action.forces !== undefined) {
      if (
        !action.forces ||
        typeof action.forces !== 'object' ||
        Array.isArray(action.forces)
      )
        return null;
      entries = Object.entries(action.forces);
    } else {
      if (typeof action.from !== 'string') return null;
      entries = [[action.from, action.amount]];
    }
    const origins = new Set<string>();
    if (action.noField !== undefined) {
      const marker = me.noField?.deployed;
      if (me.faction !== 'richese' || !marker) return null;
      origins.add(marker.location.territory);
    }
    for (const [key, count] of entries) {
      if (
        typeof count !== 'number' ||
        !Number.isSafeInteger(count) ||
        count < 0
      )
        return null;
      if (!count) continue;
      const source = splitLocation(key);
      if (!validLocation(source.territory, source.sector)) return null;
      origins.add(source.territory);
    }
    if (origins.size !== 1) return null;
    const origin = [...origins][0];
    const advisors = arrivalAsAdvisor(g, me, to, origin);
    order = {
      player: me.id,
      origin,
      origins: [...origins],
      to,
      advisors,
      wantsFighters: advisors && action.fighters === true,
    };
  }
  try {
    quoteCompletedMovementArrival({
      advanced: g.advanced,
      players: g.players,
      order,
      ambassadors: (g.ambassadors?.tokens ?? []).map(
        ({ zone, location, effect }) => ({ zone, location, effect }),
      ),
      terror: (g.moritaniTerror?.tokens ?? []).map(({ status, location }) => ({
        status,
        location,
      })),
      controls,
      flight: null,
    });
    return null;
  } catch (error) {
    if (error instanceof MovementArrivalError) return error.message;
    throw error;
  }
}
