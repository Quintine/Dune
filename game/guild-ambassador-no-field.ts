import type { Game, Player } from './engine';
import { arrivalAsAdvisor } from './advisors';
import {
  gameTerritories,
  location,
  MOBILE_STRONGHOLD,
  splitLocation,
  TERRITORIES,
  territory,
  validGameLocation,
} from './board';
import { FACTIONS } from './catalog';
import { presenceAt, type ForcePresence } from './force-presence';
import { territoryEntryBlock } from './occupancy';
import {
  deployRicheseNoField,
  isBoardNoFieldLocation,
  isHomeworldNoFieldLocation,
  revealRicheseNoField,
  shipAlliedRicheseNoField,
  validateRicheseNoField,
} from './richese-no-field';

export class GuildAmbassadorMarkerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GuildAmbassadorMarkerError';
  }
}
export type GuildAmbassadorMarkerSelection = {
  tokenId: string;
  tokenEvent: string;
  territory: string;
  sector: number;
  payer?: string;
  elite?: number;
};
export type GuildAmbassadorMarker = {
  mode: 'own' | 'allied';
  owner: string;
  tokenId: string;
  tokenEvent: string;
  value: 0 | 3 | 5;
  payer: string;
  ownerPayment: number;
  recipientPayment: number;
  stateSignature: string;
};
export type GuildAmbassadorMarkerQuote = {
  player: string;
  amount: number;
  elite: number;
  territory: string;
  sector: number;
  advisors: boolean;
  cost: 0 | 1 | 2;
  allyPayment: 0;
  marker: GuildAmbassadorMarker;
};
type BoardSeat = Pick<Player, 'id' | 'faction' | 'ally' | 'advisors'> & ForcePresence;
type MarkerContext = {
  owner: Player;
  recipient: Player;
  mode: 'own' | 'allied';
  seats: BoardSeat[];
};
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const count = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
function requireMarker(condition: unknown, message: string): asserts condition {
  if (!condition) throw new GuildAmbassadorMarkerError(message);
}
function noFieldRule<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof GuildAmbassadorMarkerError) throw error;
    throw new GuildAmbassadorMarkerError(
      error instanceof Error ? error.message : 'Invalid No-Field custody.',
    );
  }
}
function usableLocation(g: Game, key: string) {
  const at = splitLocation(key);
  return location(at.territory, at.sector) === key &&
    validGameLocation(g, at.territory, at.sector) &&
    (at.territory !== MOBILE_STRONGHOLD || !!g.mobileStronghold?.location);
}
function printedLocation(to: string, sector: number) {
  return TERRITORIES.some((candidate) =>
    candidate.id === to && candidate.sectors.includes(sector));
}

/** Identify only the native owner or the beneficiary's current mutual Richese
 * ally. Inventory, event and physical custody are validated by the quote. */
export function markerOwner(g: Game, beneficiary: string): Player | null {
  const recipient = g.players.find((candidate) => candidate.id === beneficiary);
  if (!recipient) return null;
  if (recipient.faction === 'richese') return recipient;
  return g.players.find((candidate) => candidate.faction === 'richese' &&
    candidate.id === recipient.ally && candidate.ally === recipient.id) ?? null;
}

function validateReserves(p: Player) {
  requireMarker(count(p.reserves) && count(p.elites?.reserves ?? 0) &&
    (p.elites?.reserves ?? 0) <= p.reserves,
  'The physical or elite reserves are invalid.');
}
function context(g: Game, beneficiary: string): MarkerContext {
  requireMarker(Array.isArray(g.players) && g.players.length > 0 &&
    g.players.every((p) => record(p) && text(p.id) &&
      FACTIONS.some((faction) => faction.id === p.faction)) &&
    new Set(g.players.map((p) => p.id)).size === g.players.length &&
    new Set(g.players.map((p) => p.faction)).size === g.players.length,
  'The No-Field shipment requires unique valid seated identities and factions.');
  requireMarker(count(g.storm) && g.storm <= 18,
    'The storm sector is invalid.');
  if (g.mobileStronghold?.location) {
    const pointer = splitLocation(g.mobileStronghold.location);
    requireMarker(usableLocation(g, g.mobileStronghold.location) &&
      printedLocation(pointer.territory, pointer.sector),
    'The mobile stronghold must point to a printed board location.');
  }
  const seats: BoardSeat[] = [];
  for (const p of g.players) {
    requireMarker(p.ally === null || p.ally === undefined ||
      (text(p.ally) && g.players.some((other) => other.id === p.ally &&
        other.id !== p.id && other.ally === p.id)),
    'The shipment requires current mutual seated alliances.');
    requireMarker(record(p.forces) && (!p.elites ||
      (record(p.elites) && record(p.elites.forces))),
    'The board force custody is invalid.');
    const totals: Record<string, number> = {};
    for (const [key, amount] of Object.entries(p.forces)) {
      requireMarker(usableLocation(g, key) && count(amount),
        'Invalid board force location or quantity.');
      const to = splitLocation(key).territory;
      totals[to] = (totals[to] ?? 0) + amount;
      requireMarker(count(totals[to]), 'The territory force quantity is invalid.');
    }
    for (const [key, amount] of Object.entries(p.elites?.forces ?? {}))
      requireMarker(usableLocation(g, key) && count(amount) &&
        amount <= (p.forces[key] ?? 0),
      'Elite forces must be part of the physical force inventory.');
    const deployed = p.noField?.deployed;
    requireMarker(!p.noField || p.faction === 'richese',
      'Only Richese may hold a No-Field inventory.');
    requireMarker(deployed === undefined || deployed === null ||
      (record(deployed) && record(deployed.location) &&
        (isHomeworldNoFieldLocation(deployed.location) ||
         isBoardNoFieldLocation(deployed.location) && text(deployed.location.territory) &&
         count(deployed.location.sector) && usableLocation(g, location(deployed.location.territory,
          deployed.location.sector)) && count((totals[deployed.location.territory] ?? 0) + 1))),
    'The concealed marker has an invalid public location.');
    requireMarker(!p.advisors || record(p.advisors),
      'The advisor inventory is invalid.');
    for (const [to, stance] of Object.entries(p.advisors ?? {}))
      requireMarker(gameTerritories(g).some((candidate) => candidate.id === to) &&
        record(stance) && (stance.lockedTurn === undefined || count(stance.lockedTurn)),
      'The advisor stance is invalid.');
    // Copy public custody explicitly: no hands, balances or opponent token
    // denominations are needed to forecast the compulsory prior reveal.
    seats.push({
      id: p.id,
      faction: p.faction,
      ally: p.ally,
      forces: { ...p.forces },
      advisors: p.advisors,
      noField: deployed ? { deployed: {
        location: { ...deployed.location },
      } } : undefined,
    });
  }
  const recipient = g.players.find((p) => p.id === beneficiary);
  const owner = markerOwner(g, beneficiary);
  requireMarker(recipient && owner,
    'Choose Richese or its current mutual ally for the No-Field shipment.');
  requireMarker(owner.noField && text(owner.noFieldEvent),
    'The No-Field inventory and selection event must be initialized.');
  noFieldRule(() => validateRicheseNoField(owner.noField!));
  requireMarker(!owner.noField.deployed ||
    owner.noField.deployed.controller === owner.id,
  'The existing concealed marker must be controlled by its Richese owner.');
  validateReserves(owner);
  validateReserves(recipient);
  const mode = owner.id === recipient.id ? 'own' : 'allied';
  requireMarker(mode === 'own' || recipient.faction !== 'fremen',
    'Fremen reserves are on the planet; allied No-Field shipment needs off-planet reserves.');
  return { owner, recipient, mode, seats };
}

function forecastPriorReveal(c: MarkerContext) {
  if (c.mode === 'own') {
    requireMarker(!c.owner.noField!.deployed,
      'Reveal the existing No-Field explicitly before using this grant.');
    return c.owner.noField!;
  }
  const previous = c.owner.noField!;
  if (!previous.deployed) return previous;
  requireMarker(isBoardNoFieldLocation(previous.deployed.location),
    'Reveal the existing Homeworld No-Field before using this board shipment.');
  const revealed = noFieldRule(() => revealRicheseNoField(previous, {
    tokenId: previous.deployed!.tokenId,
    reserves: c.owner.reserves,
    cause: 'beforeAlly',
  }));
  const owner = c.seats.find((seat) => seat.id === c.owner.id)!;
  requireMarker(isBoardNoFieldLocation(revealed.location), 'The original marker must be on Arrakis.');
  const key = location(revealed.location.territory, revealed.location.sector);
  const total = (owner.forces[key] ?? 0) + revealed.forces;
  requireMarker(count(total), 'The prior reveal produces an invalid force quantity.');
  if (revealed.forces) owner.forces = { ...owner.forces, [key]: total };
  owner.noField = undefined;
  requireMarker(count(presenceAt(owner, revealed.location.territory)),
    'The prior reveal produces an invalid territory force quantity.');
  return revealed.state;
}
function destination(g: Game, c: MarkerContext, to: string, sector: number) {
  requireMarker(text(to) && count(sector) && printedLocation(to, sector) &&
    to !== MOBILE_STRONGHOLD,
  'Choose a printed planet territory and sector for the No-Field shipment.');
  requireMarker(sector === 0 || sector !== g.storm,
    'The shipment destination is in storm.');
  const recipient = c.seats.find((seat) => seat.id === c.recipient.id)!;
  const advisors = arrivalAsAdvisor({ advanced: g.advanced, players: c.seats },
    recipient, to);
  const blocked = noFieldRule(() => territoryEntryBlock(c.seats, recipient.id,
    to, advisors));
  requireMarker(!blocked, blocked ?? 'This destination cannot be entered.');
  requireMarker(c.mode !== 'own' || count(presenceAt(recipient, to) + 1),
    'The resulting marker presence is invalid.');
  return advisors;
}

/** Whole-grant provisional composition: native Richese substitutes one hidden
 * marker for the free grant. An allied marker reveals immediately and must
 * materialize at most four actual recipient counters. Its compulsory printed
 * one/two-spice fee remains payable; the grant adds no other counters or rate.
 * The caller binds the live Ambassador, parent event, consent, prevention and
 * uncommitted budgets. Nothing here moves tokens, forces, cards or spice. */
export function quoteGuildAmbassadorMarker(
  g: Game,
  beneficiary: string,
  selection: GuildAmbassadorMarkerSelection,
  checkFunds = true,
): GuildAmbassadorMarkerQuote {
  requireMarker(record(selection) && text(selection.tokenId) &&
    text(selection.tokenEvent) && text(selection.territory) &&
    count(selection.sector) &&
    (selection.payer === undefined || text(selection.payer)) &&
    (selection.elite === undefined || count(selection.elite)),
  'Choose a valid No-Field token, selection event, destination and force type.');
  const c = context(g, beneficiary), { owner, recipient, mode } = c;
  requireMarker(selection.tokenEvent === owner.noFieldEvent,
    'The No-Field selection event is stale.');
  const previous = forecastPriorReveal(c);
  const deployment = {
    tokenId: selection.tokenId,
    controller: recipient.id,
    location: { territory: selection.territory, sector: selection.sector },
  };
  let amount: number;
  let value: 0 | 3 | 5;
  if (mode === 'own') {
    noFieldRule(() => deployRicheseNoField(previous, deployment));
    value = previous.tokens.find((token) => token.id === selection.tokenId)!.value;
    amount = 1;
  } else {
    const revealed = noFieldRule(() => shipAlliedRicheseNoField(previous,
      deployment, recipient.reserves));
    amount = revealed.forces;
    value = revealed.value;
    requireMarker(amount <= 4,
      'The allied No-Field must materialize at most four available reserve forces.');
  }
  const advisors = destination(g, c, selection.territory, selection.sector);
  const eliteReserves = recipient.elites?.reserves ?? 0;
  const minimum = mode === 'own' ? 0 :
    Math.max(0, amount - (recipient.reserves - eliteReserves));
  const elite = selection.elite ?? minimum;
  requireMarker(count(elite) && (mode === 'own' ? elite === 0 :
    elite >= minimum && elite <= Math.min(amount, eliteReserves)),
  'Choose available elites within the materialized allied forces; native markers contain no elites.');
  const at = location(selection.territory, selection.sector);
  const boardRecipient = c.seats.find((seat) => seat.id === recipient.id)!;
  requireMarker(count((boardRecipient.forces[at] ?? 0) + amount) &&
    count(presenceAt(boardRecipient, selection.territory) + amount) &&
    count((recipient.elites?.forces[at] ?? 0) + elite),
  'The resulting force quantity is invalid.');
  const cost: 0 | 1 | 2 = mode === 'own' ? 0 :
    territory(selection.territory).type === 'stronghold' ? 1 : 2;
  const payer = selection.payer ?? owner.id;
  requireMarker(mode === 'own' ? payer === owner.id :
    payer === owner.id || payer === recipient.id || payer === 'both',
  'Choose Richese, the recipient, or an equal split as the transport payer.');
  requireMarker(payer !== 'both' || cost === 2,
    'An equal split requires the two-spice transport fee.');
  const ownerPayment = payer === owner.id ? cost : payer === 'both' ? 1 : 0;
  const recipientPayment = cost - ownerPayment;
  if (ownerPayment)
    requireMarker(count(owner.spice) && owner.spice >= ownerPayment,
      'Richese needs enough spice for its transport payment.');
  if (checkFunds && recipientPayment)
    requireMarker(count(recipient.spice) && recipient.spice >= recipientPayment,
      'The recipient needs enough spice for its transport payment.');
  return {
    player: recipient.id,
    amount,
    elite,
    territory: selection.territory,
    sector: selection.sector,
    advisors,
    cost,
    allyPayment: 0,
    marker: {
      mode,
      owner: owner.id,
      tokenId: selection.tokenId,
      tokenEvent: selection.tokenEvent,
      value,
      payer,
      ownerPayment,
      recipientPayment,
      stateSignature: JSON.stringify({
        owner: { id: owner.id, noField: owner.noField, event: owner.noFieldEvent,
          reserves: owner.reserves, elites: owner.elites?.reserves ?? 0 },
        recipient: { id: recipient.id, reserves: recipient.reserves,
          elites: recipient.elites?.reserves ?? 0 },
        storm: g.storm,
        advanced: g.advanced,
        seats: c.seats,
      }),
    },
  };
}

/** Destination choices use public board legality and the required old-marker
 * reveal, independently of token denomination, physical reserves and funding.
 * The final quote always checks the selected token's actual grant amount. */
export function markerDestinations(g: Game, beneficiary: string):
  { territory: string; sector: number; advisors: boolean }[] {
  const c = context(g, beneficiary);
  forecastPriorReveal(c);
  const result: { territory: string; sector: number; advisors: boolean }[] = [];
  for (const t of TERRITORIES)
    for (const sector of t.sectors) {
      try {
        result.push({ territory: t.id, sector,
          advisors: destination(g, c, t.id, sector) });
      } catch (error) {
        if (!(error instanceof GuildAmbassadorMarkerError)) throw error;
      }
    }
  return result;
}
