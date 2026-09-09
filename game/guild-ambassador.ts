import type { Action, Game, Player } from './engine';
import { arrivalAsAdvisor } from './advisors';
import {
  gameTerritories,
  location,
  MOBILE_STRONGHOLD,
  splitLocation,
  validLocation,
} from './board';
import { presenceAt } from './force-presence';
import { territoryEntryBlock } from './occupancy';
import { homeworldSpiritualAdvisorQuote } from './homeworld-mobility';

export class GuildAmbassadorShipmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GuildAmbassadorShipmentError';
  }
}
export type GuildAmbassadorShipment = {
  player: string;
  amount: number;
  elite: number;
  territory: string;
  sector: number;
  advisors: boolean;
  cost: 0;
  allyPayment: 0;
};
export type GuildAmbassadorShipments = {
  maximum: number;
  eliteReserves: number;
  destinations: { territory: string; sector: number; advisors: boolean }[];
};
function requireShipment(value: unknown, message: string): asserts value {
  if (!value) throw new GuildAmbassadorShipmentError(message);
}
function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function usableLocation(g: Game, key: string) {
  const at = splitLocation(key);
  return (
    location(at.territory, at.sector) === key &&
    validLocation(at.territory, at.sector) &&
    (at.territory !== MOBILE_STRONGHOLD || !!g.mobileStronghold?.location)
  );
}
/** Only public board custody and the beneficiary's physical reserves are read.
 * The caller binds the Ambassador, event, actor and continuation timing. */
function beneficiary(g: Game, id: string) {
  requireShipment(
    Array.isArray(g.players) &&
      g.players.length > 0 &&
      new Set(g.players.map((p) => p.id)).size === g.players.length,
    'Shipment requires unique seated players.',
  );
  requireShipment(
    count(g.storm) && g.storm <= 18,
    'The storm sector is invalid.',
  );
  requireShipment(
    !g.mobileStronghold?.location ||
      (usableLocation(g, g.mobileStronghold.location) &&
        splitLocation(g.mobileStronghold.location).territory !==
          MOBILE_STRONGHOLD),
    'The mobile stronghold must point to a board location.',
  );
  for (const p of g.players) {
    requireShipment(
      typeof p.id === 'string' &&
        p.id.length > 0 &&
        (!p.ally ||
          g.players.some((other) => other.id === p.ally && other.id !== p.id)),
      'The player or alliance is invalid.',
    );
    requireShipment(
      record(p.forces) &&
        (!p.elites || (record(p.elites) && record(p.elites.forces))),
      'Shipment requires valid physical force custody.',
    );
    const totals: Record<string, number> = {};
    for (const [key, n] of Object.entries(p.forces)) {
      requireShipment(
        usableLocation(g, key) && count(n),
        'Invalid board force location or quantity.',
      );
      const t = splitLocation(key).territory;
      totals[t] = (totals[t] ?? 0) + n;
      requireShipment(
        count(totals[t]),
        'The territory force quantity is invalid.',
      );
    }
    for (const [key, n] of Object.entries(p.elites?.forces ?? {}))
      requireShipment(
        usableLocation(g, key) && count(n) && n <= (p.forces[key] ?? 0),
        'Elite forces must be part of the physical force inventory.',
      );
    const marker = p.noField?.deployed;
    requireShipment(
      !marker ||
        (usableLocation(
          g,
          location(marker.location.territory, marker.location.sector),
        ) &&
          count((totals[marker.location.territory] ?? 0) + 1)),
      'The concealed marker has an invalid public location.',
    );
    requireShipment(
      !p.advisors || record(p.advisors),
      'The advisor inventory is invalid.',
    );
    for (const [t, stance] of Object.entries(p.advisors ?? {}))
      requireShipment(
        gameTerritories(g).some((candidate) => candidate.id === t) &&
          record(stance) &&
          (stance.lockedTurn === undefined || count(stance.lockedTurn)),
        'The advisor stance is invalid.',
      );
  }
  const p = g.players.find((candidate) => candidate.id === id);
  requireShipment(p, 'The beneficiary is not seated.');
  requireShipment(
    count(p.reserves) &&
      count(p.elites?.reserves ?? 0) &&
      (p.elites?.reserves ?? 0) <= p.reserves,
    'The physical or elite reserves are invalid.',
  );
  return p;
}
function validateDestinationOccupancy(
  g: Game,
  p: Player,
  to: string,
  advisors: boolean,
) {
  try {
    const blocked = territoryEntryBlock(g.players, p.id, to, advisors);
    requireShipment(!blocked, blocked ?? 'This destination cannot be entered.');
  } catch (error) {
    if (error instanceof GuildAmbassadorShipmentError) throw error;
    throw new GuildAmbassadorShipmentError(
      error instanceof Error ? error.message : 'Invalid territory occupancy.',
    );
  }
}
/** E3's independent free reserve shipment. No ordinary shipment turn, funding,
 * faction distance, reserve-region or incoming accompaniment is resolved here.
 * No-Field substitution is deliberately not admitted by this physical quote.
 * E3 Atomics Aftermath also forbids this shipment. The current Game has no
 * Aftermath location state: its eventual producer must supply that public
 * exclusion here before the unfinished Atomics module can be enabled. */
export function quoteGuildAmbassadorShipment(
  g: Game,
  beneficiaryId: string,
  action: Action,
): GuildAmbassadorShipment {
  const p = beneficiary(g, beneficiaryId);
  requireShipment(
    action.noField === undefined && action.alliedNoField === undefined,
    'This quote supports physical reserve forces only, not No-Field substitution.',
  );
  const amount = action.amount;
  requireShipment(
    count(amount) && amount >= 1 && amount <= Math.min(4, p.reserves),
    'Ship between one and four available reserve forces.',
  );
  const eliteReserves = p.elites?.reserves ?? 0;
  const minimum = Math.max(0, amount - (p.reserves - eliteReserves));
  const elite = action.elite === undefined ? minimum : action.elite;
  requireShipment(
    count(elite) &&
      elite >= minimum &&
      elite <= Math.min(amount, eliteReserves),
    'Choose available elites within the physical reserve shipment.',
  );
  const to = action.territory,
    sector = action.sector;
  requireShipment(
    typeof to === 'string' &&
      count(sector) &&
      usableLocation(g, location(to, sector)),
    'Choose a sector of an available board territory.',
  );
  requireShipment(
    sector === 0 || sector !== g.storm,
    'The shipment destination is in storm.',
  );
  requireShipment(
    to !== MOBILE_STRONGHOLD || p.faction === 'ixians',
    'Only Ixians may ship directly into the mobile stronghold.',
  );
  const advisors = arrivalAsAdvisor(g, p, to);
  validateDestinationOccupancy(g, p, to, advisors);
  const target = location(to, sector);
  requireShipment(
    count((p.forces[target] ?? 0) + amount) &&
      count(presenceAt(p, to) + amount) &&
      count((p.elites?.forces[target] ?? 0) + elite),
    'The resulting force quantity is invalid.',
  );
  return {
    player: p.id,
    amount,
    elite,
    territory: to,
    sector,
    advisors,
    cost: 0,
    allyPayment: 0,
  };
}
/** Every listed destination has a one-force legal witness. Final quantities and
 * elite choices are always checked by the quote, never inferred from this list. */
export function guildAmbassadorShipments(
  g: Game,
  beneficiaryId: string,
): GuildAmbassadorShipments {
  const p = beneficiary(g, beneficiaryId);
  const result: GuildAmbassadorShipments = {
    maximum: Math.min(4, p.reserves),
    eliteReserves: p.elites?.reserves ?? 0,
    destinations: [],
  };
  if (!result.maximum) return result;
  for (const t of gameTerritories(g))
    for (const sector of t.sectors) {
      try {
        const quoted = quoteGuildAmbassadorShipment(g, beneficiaryId, {
          type: 'decision',
          amount: 1,
          territory: t.id,
          sector,
        });
        result.destinations.push({
          territory: t.id,
          sector,
          advisors: quoted.advisors,
        });
      } catch (error) {
        if (!(error instanceof GuildAmbassadorShipmentError)) throw error;
      }
    }
  return result;
}

export type GuildAmbassadorAdvisor = {
  player: string;
  territory: string;
  sector: number;
  amount: 1 | 2;
  elite: 0;
  advisors: boolean;
};

/** Quote the separate BG reserve arrival after this completed shipment. The
 * caller binds the parent event and stage; primary forces and alliances may
 * already have changed through Terror. No payment, placement or RNG occurs. */
export function quoteGuildAmbassadorAdvisor(
  g: Game,
  bgId: string,
  shipment: GuildAmbassadorShipment,
  action: Action,
): GuildAmbassadorAdvisor {
  const bg = beneficiary(g, bgId);
  const shipper = g.players.find((p) => p.id === shipment?.player);
  requireShipment(
    bg.faction === 'beneGesserit' &&
      g.players.filter((p) => p.faction === 'beneGesserit').length === 1 &&
      shipper &&
      shipper.id !== bg.id &&
      shipper.faction !== 'fremen' &&
      record(shipment) &&
      count(shipment.amount) &&
      shipment.amount >= 1 &&
      shipment.amount <= 4 &&
      count(shipment.elite) &&
      shipment.elite <= shipment.amount &&
      shipment.cost === 0 &&
      shipment.allyPayment === 0 &&
      typeof shipment.advisors === 'boolean' &&
      typeof shipment.territory === 'string' &&
      count(shipment.sector) &&
      validLocation(shipment.territory, shipment.sector) &&
      !Object.hasOwn(shipment, 'noField') &&
      !Object.hasOwn(shipment, 'alliedNoField'),
    'BG accompaniment needs the completed physical Guild Ambassador shipment by another off-planet faction.',
  );
  requireShipment(
    bg.reserves - (bg.elites?.reserves ?? 0) >= 1,
    'No ordinary Bene Gesserit reserve force remains for accompaniment.',
  );
  requireShipment(
    (action.accompany === undefined || typeof action.accompany === 'boolean') &&
      (action.sector === undefined ||
        (count(action.sector) && action.sector <= 18)),
    'Choose a valid accompaniment option and sector.',
  );
  const accompanying = action.accompany === true && g.advanced;
  const to = accompanying ? shipment.territory : 'polar_sink';
  const sector = accompanying
    ? action.sector === undefined
      ? shipment.sector
      : (action.sector as number)
    : 0;
  const allowance = homeworldSpiritualAdvisorQuote(g, bg.id, to);
  requireShipment(
    !allowance.blocked,
    allowance.blocked ?? 'Accompaniment is unavailable.',
  );
  const amount = action.amount === undefined ? 1 : action.amount;
  requireShipment(
    (amount === 1 || amount === 2) &&
      amount <= allowance.maximum &&
      amount <= bg.reserves - (bg.elites?.reserves ?? 0),
    'Choose an available spiritual-advisor amount; two requires high-population Wallach IX and Polar Sink.',
  );
  requireShipment(
    (action.territory === undefined || action.territory === to) &&
      (action.elite === undefined || action.elite === 0) &&
      action.noField === undefined &&
      action.alliedNoField === undefined &&
      usableLocation(g, location(to, sector)) &&
      (sector === 0 || sector !== g.storm),
    'Accompaniment sends ordinary forces only to the shipment territory or Polar Sink, outside storm.',
  );
  // E1 p.10 FAQ explicitly allows BG to accompany Ixians into the HMS. This
  // grants no independent BG direct shipment or relocation of the stronghold.
  requireShipment(
    to !== MOBILE_STRONGHOLD || (accompanying && shipper.faction === 'ixians'),
    'Accompany only an Ixian shipment into the mobile stronghold.',
  );
  const advisors = arrivalAsAdvisor(g, bg, to, undefined, accompanying);
  validateDestinationOccupancy(g, bg, to, advisors);
  requireShipment(
    count((bg.forces[location(to, sector)] ?? 0) + amount) &&
      count(presenceAt(bg, to) + amount),
    'The resulting Bene Gesserit force quantity is invalid.',
  );
  return {
    player: bg.id,
    territory: to,
    sector,
    amount,
    elite: 0,
    advisors,
  };
}
