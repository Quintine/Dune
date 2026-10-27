import { nexusGuildShipmentAvailable } from './nexus-guild-cunning-options';
import { nexusGuildSecretAllyCanAct } from './nexus-guild-secret-ally-options';
import type { Action, GameView } from './engine';
import { splitLocation, validGameLocation } from './board';
import { botEntryAllowed, guildTransportCost } from './bot-mobility';
import { shipmentPaymentBounds } from './shipment-price';
import { quoteAdvisorTransportMatching, AdvisorTransportMatchingError } from './advisor-transport-matching';
import { guildNoFieldSelection } from './guild-no-field-selection';

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
  if (g.guildTransportCanceled && !nexusAllowed)
    unavailableReasons.push('Karama prevents native Guild cross/return transport for this shipment opportunity.');
  const fromReserves = action.from === 'reserves';
  const namesNoField = action.noField !== undefined;
  const noField = namesNoField ? guildNoFieldSelection(g, action) : null;
  let total = 0;
  let origin = noField?.location.territory;
  const matchingGroup:Record<string,number>={};
  let validForces = !namesNoField || !!noField;
  if (namesNoField && !noField)
    unavailableReasons.push('Choose your currently deployed No-Field and its current owner event.');
  if (namesNoField && (fromReserves || !action.forces ||
      typeof action.forces !== 'object' || Array.isArray(action.forces))) {
    validForces = false;
    unavailableReasons.push('Select the concealed No-Field from its board location with a physical force group, which may be empty.');
  }
  if (noField && !fromReserves) {
    if (!validGameLocation(g, noField.location.territory, noField.location.sector)) {
      validForces = false;
      unavailableReasons.push('The current No-Field source location is unavailable.');
    }
    if (noField.location.sector === g.storm)
      unavailableReasons.push('The selected No-Field source sector is in the storm.');
  }
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
  if (fromReserves) {
    if (nexus)
      unavailableReasons.push(
        'Use the paid reserve shipment selector for Guild Secret Ally.',
      );
    if (p.faction !== 'fremen')
      unavailableReasons.push(
        'Only allied Fremen may cross-ship southern reserves.',
      );
    if (!namesNoField)
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
      if (!validGameLocation(g, source.territory, source.sector)) {
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
      matchingGroup[key]=count;
      if (origin && origin !== source.territory) {
        validForces = false;
        unavailableReasons.push('Select forces from one territory.');
      }
      origin = source.territory;
      if (source.sector === g.storm)
        unavailableReasons.push('A selected source sector is in the storm.');
    }
  }
  if (total > 20) validForces = false;
  if (!validForces || (!total && !noField))
    unavailableReasons.push(
      fromReserves
        ? 'Choose a whole number of available southern reserves and a valid elite allocation.'
        : namesNoField
          ? 'Choose one current concealed marker and zero to twenty available physical forces from its territory.'
          : 'Choose available physical forces and a valid elite allocation from one territory.',
    );
  const to =
    typeof action.territory === 'string' ? action.territory : 'reserves';
  const sector = action.sector ?? 0;
  const noFieldWorld = !!noField && !!g.homeworlds?.worlds?.some(world => world.id === to);
  const validDestination =
    !noFieldWorld &&
    (action.territory == null || typeof action.territory === 'string') &&
    typeof sector === 'number' &&
    Number.isInteger(sector) &&
    sector >= 0 &&
    sector <= 18 &&
    (to === 'reserves' || validGameLocation(g, to, sector));
  if (to === 'reserves' && p.faction !== 'guild' && !nexusAllowed)
    unavailableReasons.push('Only the Guild may return forces to reserves.');
  if (!validDestination)
    unavailableReasons.push(noFieldWorld
      ? 'A concealed No-Field may cross to an Arrakis location or return behind your shield, not enter a Homeworld.'
      : 'Choose a sector belonging to the destination.');
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
  const billable = total + (noField ? 1 : 0);
  const cost =
    validForces && billable > 0 && validDestination
      ? guildTransportCost(
          to,
          billable,
          nexusAllowed || g.karamaShipping?.player === g.me || !g.guildRateCanceled,
        )
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
  if(g.advisorTransportMatchingDenied?.length&&origin&&!fromReserves){
    try{
      quoteAdvisorTransportMatching({...g,worlds:g.homeworlds?.worlds??undefined,
        advisorTransportMatchingOpportunity:g.advisorTransportMatchingScopes?.[nexus?'secret':'guild']},
        {producer:'guild',owner:p.id,origin,destination:to,sector:Number(action.sector??0),
          advisors:!!p.advisors?.[to],group:matchingGroup});
    }catch(error){if(!(error instanceof AdvisorTransportMatchingError))throw error;unavailableReasons.push(error.message);}
  }
  return {
    physicalForces: validForces && (total > 0 || noField) ? total : undefined,
    ...(noField ? { noField: true as const } : {}),
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
