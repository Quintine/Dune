import { isAdvisor } from './advisors';
import { gameTerritories, splitLocation, type MobileBoard } from './board';
import type { AdvisorRelease, CollectionQuote } from './board-resolution-quote';
import type { Player } from './engine';
import type { SpiceAllocationReceipt } from './ecaz-spice-allocation';
import { presenceAt, type ForcePresence } from './force-presence';

export const CISTERN = 'cistern';
export const ORGIZ_PROCESSING_STATION = 'orgiz-processing-station';

export class DiscoveryCollectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscoveryCollectionError';
  }
}

type DiscoveryCollectionSeat = Pick<Player, 'id' | 'faction' | 'advisors'> &
  ForcePresence;

export type DiscoveryCollectionContext = MobileBoard & {
  advanced: boolean;
  order: readonly string[];
  players: readonly DiscoveryCollectionSeat[];
  /** Deposits before ordinary collection. */
  spice: Readonly<Record<string, number>>;
};

export type DiscoveryBaseCollectionReceipt = {
  player: string;
  strongholds: number;
  collected: number;
  desert: number;
  balance: number;
};

export type DiscoveryBaseCollectionQuote = {
  /** Advisor stance changes already established by the ordinary quote. */
  released: readonly AdvisorRelease[];
  /** Deposits remaining after ordinary and shared collection. */
  spice: Readonly<Record<string, number>>;
  receipts: readonly DiscoveryBaseCollectionReceipt[];
  /** Actual positive ordinary source receipts, never inferred from occupancy. */
  deposits: readonly CollectionQuote['deposits'][number][];
  shared: readonly {
    territory: string;
    ecaz: string;
    ally: string;
    amount: number;
  }[];
};

export type CisternCollectionReceipt = {
  kind: 'cistern';
  player: string;
  amount: 2;
  source: 'bank';
};

export type OrgizCollectionReceipt = {
  kind: 'orgiz';
  player: string;
  from: string;
  location: string;
  amount: 1;
  source: 'player';
};

export type DiscoveryCollectionQuote = {
  /** Drop-in replacement for the ordinary collection receipts. */
  receipts: DiscoveryBaseCollectionReceipt[];
  effects: (CisternCollectionReceipt | OrgizCollectionReceipt)[];
};

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const whole = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
function requireCollection(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new DiscoveryCollectionError(message);
}

function isCollectingFighter(
  player: DiscoveryCollectionSeat,
  territory: string,
  released: readonly AdvisorRelease[],
): boolean {
  return !isAdvisor(player, territory) ||
    released.some((entry) => entry.player === player.id && entry.territory === territory);
}

export function discoveryCollectionOccupants(
  context: DiscoveryCollectionContext,
  location: string,
  released: readonly AdvisorRelease[],
): DiscoveryCollectionSeat[] {
  if (!gameTerritories(context).some((territory) => territory.id === location))
    return [];
  return context.players.filter(
    (player) => isCollectingFighter(player, location, released) &&
      presenceAt(player, location) > 0,
  ).sort((left,right) => context.order.indexOf(left.id)-context.order.indexOf(right.id));
}

function transferOrgiz(
  key: string,
  collector: string,
  ownerReceipt: DiscoveryBaseCollectionReceipt,
  receipts: DiscoveryBaseCollectionReceipt[],
  effects: DiscoveryCollectionQuote['effects'],
) {
  if (collector === ownerReceipt.player) return false;
  const collectorReceipt = receipts.find(entry => entry.player === collector)!;
  if (collectorReceipt.balance === 0) return false;
  requireCollection(
    Number.isSafeInteger(ownerReceipt.balance + 1),
    'Orgiz theft would invalidate a player spice balance.',
  );
  collectorReceipt.balance -= 1;
  ownerReceipt.balance += 1;
  effects.push({
    kind: 'orgiz', player: ownerReceipt.player, from: collector,
    location: key, amount: 1, source: 'player',
  });
  return true;
}

/**
 * Compose each eligible occupant's Cistern income and original Orgiz transfers
 * over the canonical ordinary quote. Ordinary `collected` and `desert` remain
 * factual: Cistern is bank income; Orgiz transfers available player spice.
 *
 * Owners and actual foreign payers resolve in original storm order. Advanced
 * groups canonical deposits by territory; Basic groups by positive deposit.
 * Shared escrow settles after bilateral allocation, not in this quote.
 */
export function quoteDiscoveryCollection(
  context: DiscoveryCollectionContext,
  collection: DiscoveryBaseCollectionQuote,
): DiscoveryCollectionQuote {
  requireCollection(
    record(context) &&
      typeof context.advanced === 'boolean' &&
      Array.isArray(context.players) &&
      context.players.length > 0 &&
      Array.isArray(context.order) &&
      context.order.length === context.players.length &&
      new Set(context.order).size === context.order.length &&
      context.players.every(
        (player) =>
          record(player) &&
          typeof player.id === 'string' &&
          player.id.length > 0 &&
          record(player.forces) &&
          context.order.includes(player.id),
      ) &&
      new Set(context.players.map((player) => player.id)).size ===
        context.players.length &&
      record(context.spice) &&
      record(collection) &&
      record(collection.spice) &&
      Array.isArray(collection.receipts) &&
      Array.isArray(collection.shared) &&
      Array.isArray(collection.deposits) &&
      Array.isArray(collection.released) &&
      collection.released.every(
        (entry) => record(entry) &&
          typeof entry.player === 'string' &&
          context.order.includes(entry.player) &&
          typeof entry.territory === 'string',
      ),
    'Discovery collection needs the canonical public collection context and quote.',
  );

  const sourceKeys = Object.keys(context.spice).sort();
  const remainingKeys = Object.keys(collection.spice).sort();
  requireCollection(
    sourceKeys.every((key) => Object.hasOwn(collection.spice, key)) &&
      remainingKeys.every(
        (key) =>
          Object.hasOwn(context.spice, key) || collection.spice[key] === 0,
      ) &&
      sourceKeys.every(
        (key) =>
          whole(context.spice[key]) &&
          whole(collection.spice[key]) &&
          collection.spice[key] <= context.spice[key],
      ),
    'Discovery collection needs the ordinary quote’s conserved board deposits.',
  );

  const receipts = collection.receipts.map((receipt) => {
    requireCollection(
      receipt !== null &&
        typeof receipt === 'object' &&
        !Array.isArray(receipt) &&
        typeof receipt.player === 'string' &&
        context.order.includes(receipt.player) &&
        whole(receipt.strongholds) &&
        whole(receipt.collected) &&
        whole(receipt.desert) &&
        receipt.desert <= receipt.collected &&
        whole(receipt.balance),
      'Discovery collection needs one valid ordinary receipt per player.',
    );
    return { ...receipt };
  });
  requireCollection(
    receipts.length === context.order.length &&
      new Set(receipts.map((receipt) => receipt.player)).size ===
        context.order.length &&
      context.order.every((id) =>
        receipts.some((receipt) => receipt.player === id),
      ),
    'Discovery collection receipts must match the complete player order.',
  );
  requireCollection(
    collection.shared.every(
      (lot) =>
        lot !== null &&
        typeof lot === 'object' &&
        !Array.isArray(lot) &&
        typeof lot.territory === 'string' &&
        typeof lot.ecaz === 'string' &&
        typeof lot.ally === 'string' &&
        lot.ecaz !== lot.ally &&
        whole(lot.amount),
    ),
    'Discovery collection needs valid retained shared-spice lots.',
  );
  requireCollection(
    collection.deposits.every(entry => record(entry) &&
      typeof entry.player === 'string' && context.order.includes(entry.player) &&
      typeof entry.location === 'string' && Object.hasOwn(context.spice, entry.location) &&
      whole(entry.amount) && entry.amount > 0 && entry.amount <= context.spice[entry.location]),
    'Discovery collection needs actual positive ordinary deposit receipts.',
  );

  const effects: DiscoveryCollectionQuote['effects'] = [];
  const cistern = discoveryCollectionOccupants(context, CISTERN, collection.released);
  for (const owner of cistern) {
    const receipt = receipts.find((entry) => entry.player === owner.id)!;
    requireCollection(
      Number.isSafeInteger(receipt.balance + 2),
      'Cistern bank income would overflow the spice balance.',
    );
    receipt.balance += 2;
    effects.push({
      kind: 'cistern',
      player: receipt.player,
      amount: 2,
      source: 'bank',
    });
  }

  const orgiz = discoveryCollectionOccupants(context, ORGIZ_PROCESSING_STATION, collection.released);
  if (orgiz.length) {
    const ownerReceipts = orgiz.map(owner => receipts.find(entry => entry.player === owner.id)!);
    const transfers = new Map<string, CollectionQuote['deposits']>();
    for (const deposit of collection.deposits) {
      const event = context.advanced ? splitLocation(deposit.location).territory : deposit.location;
      const candidates = transfers.get(event);
      if (candidates) candidates.push(deposit);
      else transfers.set(event, [deposit]);
    }
    // Preserve original source-key event order, independent of force-map order.
    for (const key of sourceKeys) {
      const event = context.advanced ? splitLocation(key).territory : key;
      const candidates = transfers.get(event);
      if (!candidates) continue;
      transfers.delete(event);
      candidates.sort((left, right) =>
        context.order.indexOf(left.player) - context.order.indexOf(right.player));
      for (const ownerReceipt of ownerReceipts)
        for (const candidate of candidates)
          if (transferOrgiz(candidate.location, candidate.player, ownerReceipt, receipts, effects))
            break;
    }
  }

  return { receipts, effects };
}

const SHARED_COLLECTION_RELEASES: readonly AdvisorRelease[] = [];

/** Shared collection waits for its original bilateral allocation. Advanced
 * charges once per territory; Basic retains one event per positive deposit.
 * Only actual positive foreign recipients qualify; current purses cannot owe. */
export function quoteSharedOrgiz(
  context: DiscoveryCollectionContext,
  allocation: SpiceAllocationReceipt,
  balances: Readonly<Record<string,number>>,
  originalSpice: Readonly<Record<string,number>>,
): OrgizCollectionReceipt[] {
  requireCollection(typeof context.advanced === 'boolean' && allocation.ecaz !== allocation.ally &&
    context.order.includes(allocation.ecaz) && context.order.includes(allocation.ally) &&
    whole(allocation.ecazAmount) && whole(allocation.allyAmount) &&
    record(balances) && context.order.every(id => whole(balances[id])) &&
    record(originalSpice) && Object.entries(originalSpice).every(([key,amount]) =>
      whole(amount) && whole(context.spice[key]) && context.spice[key] <= amount),
    'Shared Orgiz needs its actual allocation, original board deposits and available balances.');
  const owners = discoveryCollectionOccupants(context,ORGIZ_PROCESSING_STATION,SHARED_COLLECTION_RELEASES);
  if (!owners.length) return [];
  const locations = context.advanced ? [allocation.territory] : Object.keys(originalSpice)
    .filter(key => splitLocation(key).territory === allocation.territory &&
      originalSpice[key] > context.spice[key]).sort();
  requireCollection(locations.length > 0,
    'Shared Orgiz must retain the original positive Collection source.');
  const effects: OrgizCollectionReceipt[] = [];
  const available = {...balances};
  for (const location of locations)
    for (const owner of owners) {
      let payer: string;
      if (owner.id !== allocation.ecaz && allocation.ecazAmount > 0 &&
          available[allocation.ecaz] > 0)
        payer = allocation.ecaz;
      else if (owner.id !== allocation.ally && allocation.allyAmount > 0 &&
          available[allocation.ally] > 0)
        payer = allocation.ally;
      else continue;
      requireCollection(Number.isSafeInteger(available[owner.id]+1),
        'Shared Orgiz income would overflow the spice balance.');
      available[payer]--;
      available[owner.id]++;
      effects.push({kind:'orgiz',player:owner.id,from:payer,location,
        amount:1,source:'player'});
    }
  return effects;
}
