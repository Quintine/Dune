import { nexusGuildShipmentAvailable } from './nexus-guild-cunning-options';
import { nexusGuildSecretAllyCanAct } from './nexus-guild-secret-ally-options';
import type { Action, GameView } from './engine';
import { splitLocation, validLocation } from './board';
import { botEntryAllowed, guildTransportCost } from './bot-mobility';
import { shipmentPaymentBounds } from './shipment-price';

/** Preview the submitted Guild transport using only this seat's entitled view.
 * The authoritative action still revalidates the selection when it arrives.
 */
export function guildTransportQuote(g: GameView, action: Action) {
  const p = g.players.find((seat) => seat.id === g.me)!;
  const unavailableReasons: string[] = [];
  const nexus = action.nexus !== undefined;
  const nexusAllowed =
    nexus &&
    nexusGuildSecretAllyCanAct(g) &&
    action.nexus === g.nexusGuildSecretAlly?.event;
  if (nexus && !nexusAllowed)
    unavailableReasons.push('Choose a current Guild Secret Ally offer.');
  const fromReserves = action.from === 'reserves';
  let total = 0;
  let origin: string | undefined;
  let validForces = true;
  const unitSelection = (
    value: unknown,
    available: number,
    eliteAvailable: number,
    selectedElite: unknown,
  ) => {
    if (
      typeof value !== 'number' ||
      !Number.isSafeInteger(value) ||
      value < 0 ||
      value > available
    ) {
      validForces = false;
      return;
    }
    if (!value) return;
    total += value;
    const minimum = Math.max(0, value - (available - eliteAvailable));
    const maximum = Math.min(value, eliteAvailable);
    const elite = selectedElite ?? minimum;
    if (
      typeof elite !== 'number' ||
      !Number.isSafeInteger(elite) ||
      elite < minimum ||
      elite > maximum
    ) {
      validForces = false;
      unavailableReasons.push(
        `Choose ${minimum} to ${maximum} elite forces for each selected source group.`,
      );
    }
  };
  if (action.noField !== undefined)
    unavailableReasons.push(
      'Guild transport of a concealed No-Field is unavailable. Reveal the marker first or use its movement action.',
    );
  if (fromReserves) {
    if (nexus)
      unavailableReasons.push(
        'Use the paid reserve shipment selector for Guild Secret Ally.',
      );
    if (p.faction !== 'fremen')
      unavailableReasons.push(
        'Only allied Fremen may cross-ship southern reserves.',
      );
    unitSelection(
      action.amount,
      p.reserves,
      p.elites?.reserves ?? 0,
      action.elite,
    );
  } else {
    const combined = action.forces !== undefined;
    const entries = combined
      ? action.forces &&
        typeof action.forces === 'object' &&
        !Array.isArray(action.forces)
        ? Object.entries(action.forces)
        : []
      : typeof action.from === 'string' && action.from
        ? [[action.from, action.amount] as const]
        : [];
    for (const [key, count] of entries) {
      const source = splitLocation(key);
      if (!validLocation(source.territory, source.sector)) {
        validForces = false;
        continue;
      }
      unitSelection(
        count,
        p.forces[key] ?? 0,
        p.elites?.forces[key] ?? 0,
        combined
          ? (action.eliteForces as Record<string, unknown> | undefined)?.[key]
          : action.elite,
      );
      if (typeof count !== 'number' || count <= 0) continue;
      if (origin && origin !== source.territory) {
        validForces = false;
        unavailableReasons.push('Select forces from one territory.');
      }
      origin = source.territory;
      if (source.sector === g.storm)
        unavailableReasons.push('A selected source sector is in the storm.');
    }
  }
  if (!validForces || !total)
    unavailableReasons.push(
      fromReserves
        ? 'Choose a whole number of available southern reserves and a valid elite allocation.'
        : 'Choose available physical forces and a valid elite allocation from one territory.',
    );
  const to =
    typeof action.territory === 'string' ? action.territory : 'reserves';
  const sector = action.sector ?? 0;
  const validDestination =
    (action.territory == null || typeof action.territory === 'string') &&
    typeof sector === 'number' &&
    Number.isInteger(sector) &&
    sector >= 0 &&
    sector <= 18 &&
    (to === 'reserves' || validLocation(to, sector));
  if (to === 'reserves' && p.faction !== 'guild' && !nexusAllowed)
    unavailableReasons.push('Only the Guild may return forces to reserves.');
  if (to === 'reserves' && nexus && g.homeworlds?.worlds?.length)
    unavailableReasons.push(
      'Guild Secret Ally return to native Homeworld reserves awaits a ruling.',
    );
  if (!validDestination)
    unavailableReasons.push('Choose a sector belonging to the destination.');
  else if (
    to !== 'reserves' &&
    !botEntryAllowed(g, p, to, sector as number, 'guildShip', origin)
  )
    unavailableReasons.push(
      'This destination is unavailable because of the storm, allied forces, stronghold capacity, or your advisor restrictions.',
    );
  if (!fromReserves && to !== 'reserves' && to === origin)
    unavailableReasons.push(
      'Guild cross-shipment must enter another territory.',
    );
  if (
    g.phase !== 5 ||
    g.active !== p.id ||
    !nexusGuildShipmentAvailable(g) ||
    !(
      nexusAllowed ||
      p.faction === 'guild' ||
      g.players.some((seat) => seat.id === p.ally && seat.faction === 'guild')
    )
  )
    unavailableReasons.push(
      'Guild transport requires your unused shipment opportunity.',
    );
  const cost =
    validForces && total > 0 && validDestination
      ? guildTransportCost(to, total)
      : null;
  const ownSpice = p.spice ?? 0;
  const pledgedSpice = g.aid.available;
  const { minimum } = shipmentPaymentBounds(cost ?? 0, ownSpice, pledgedSpice);
  const share = action.allyPayment ?? minimum;
  const validShare =
    cost !== null &&
    typeof share === 'number' &&
    Number.isSafeInteger(share) &&
    share >= 0 &&
    share <= cost;
  if (cost !== null) {
    if (!validShare)
      unavailableReasons.push(
        `Ally payment must be a whole number from 0 to ${cost}.`,
      );
    else {
      if (share > pledgedSpice)
        unavailableReasons.push(
          `Only ${pledgedSpice} pledged ally spice is available.`,
        );
      if (cost - share > ownSpice)
        unavailableReasons.push(
          'Your spice does not cover your selected share. Adjust the ally payment or transport fewer forces.',
        );
    }
  }
  return {
    physicalForces: validForces && total > 0 ? total : undefined,
    quote: validShare
      ? {
          cost,
          normalCost: cost,
          ownPayment: cost - share,
          pledgedPayment: share,
        }
      : null,
    funding: { ownSpice, pledgedSpice },
    unavailableReasons: [...new Set(unavailableReasons)],
  };
}
