import { isAdvisor } from './advisors';
import { gameTerritories, splitLocation, type MobileBoard } from './board';
import type { AdvisorRelease } from './board-resolution-quote';
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

/** Public effective presence only; an ambiguous source cannot identify a payer. */
function collectorAt(
  context: DiscoveryCollectionContext,
  key: string,
  released: readonly AdvisorRelease[],
): DiscoveryCollectionSeat | undefined {
  const { territory, sector } = splitLocation(key);
  let collector: DiscoveryCollectionSeat | undefined;
  for (const player of context.players) {
    if (!isCollectingFighter(player, territory, released)) continue;
    const marker = player.noField?.deployed?.location;
    if (
      (player.forces[key] ?? 0) <= 0 &&
      !(marker?.territory === territory && marker.sector === sector)
    ) continue;
    if (collector) return undefined;
    collector = player;
  }
  return collector;
}

function transferOrgiz(
  key: string,
  collector: DiscoveryCollectionSeat | undefined,
  ownerReceipt: DiscoveryBaseCollectionReceipt,
  receipts: DiscoveryBaseCollectionReceipt[],
  effects: DiscoveryCollectionQuote['effects'],
) {
  if (!collector || collector.id === ownerReceipt.player) return false;
  const collectorReceipt = receipts.find(entry => entry.player === collector.id)!;
  if (collectorReceipt.balance === 0) return false;
  requireCollection(
    Number.isSafeInteger(ownerReceipt.balance + 1),
    'Orgiz theft would invalidate a player spice balance.',
  );
  collectorReceipt.balance -= 1;
  ownerReceipt.balance += 1;
  effects.push({
    kind: 'orgiz', player: ownerReceipt.player, from: collector.id,
    location: key, amount: 1, source: 'player',
  });
  return true;
}

/**
 * Compose each eligible occupant's Cistern income and original Orgiz transfers
 * over the canonical ordinary quote. Ordinary `collected` and `desert` remain
 * factual: Cistern is bank income; Orgiz transfers available player spice.
 *
 * Owners resolve in original storm order. Advanced chooses one actual foreign
 * collector per territory in storm order; Basic retains the provisional
 * positive-deposit trigger. Ambiguous collected sectors withhold the territory
 * effect. Shared lots settle after bilateral allocation, not in this quote.
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
    const transfers = context.advanced
      ? new Map<string, {
        collectors: { location: string; collector: DiscoveryCollectionSeat }[];
        ambiguous: boolean;
      }>()
      : undefined;
    for (const key of sourceKeys) {
      if (context.spice[key] <= collection.spice[key]) continue;
      const { territory } = splitLocation(key);
      if (
        collection.shared.some(
          (lot) => lot.amount > 0 && lot.territory === territory,
        )
      ) continue;
      const collector = collectorAt(context, key, collection.released);
      if (!transfers) {
        for (const ownerReceipt of ownerReceipts)
          transferOrgiz(key, collector, ownerReceipt, receipts, effects);
        continue;
      }
      let pending = transfers.get(territory);
      if (!pending) {
        pending = { collectors: [], ambiguous: false };
        transfers.set(territory, pending);
      }
      if (!collector) pending.ambiguous = true;
      else if (!pending.collectors.some(entry => entry.collector.id === collector.id))
        pending.collectors.push({ location: key, collector });
    }
    if (transfers)
      for (const pending of transfers.values()) {
        if (pending.ambiguous) continue;
        pending.collectors.sort((left, right) =>
          context.order.indexOf(left.collector.id) - context.order.indexOf(right.collector.id));
        for (const ownerReceipt of ownerReceipts)
          for (const candidate of pending.collectors)
            if (transferOrgiz(candidate.location, candidate.collector, ownerReceipt, receipts, effects))
              break;
      }
  }

  return { receipts, effects };
}

const SHARED_COLLECTION_RELEASES: readonly AdvisorRelease[] = [];

/** Advanced's one-territory event waits for the original bilateral allocation.
 * Charge the first actual positive foreign recipient (Ecaz, then ally), never
 * a guessed share, the owner itself, a city award or unavailable spice. */
export function quoteAdvancedSharedOrgiz(
  context: DiscoveryCollectionContext,
  allocation: SpiceAllocationReceipt,
  balances: Readonly<Record<string,number>>,
): OrgizCollectionReceipt[] {
  requireCollection(context.advanced && allocation.ecaz !== allocation.ally &&
    context.order.includes(allocation.ecaz) && context.order.includes(allocation.ally) &&
    whole(allocation.ecazAmount) && whole(allocation.allyAmount) &&
    record(balances) && context.order.every(id => whole(balances[id])),
    'Shared Orgiz needs the actual Advanced territory allocation and available balances.');
  const owners = discoveryCollectionOccupants(context,ORGIZ_PROCESSING_STATION,SHARED_COLLECTION_RELEASES);
  const effects: OrgizCollectionReceipt[] = [];
  let ecazDebited=0, allyDebited=0;
  for (const owner of owners) {
    let payer: string;
    if (owner.id !== allocation.ecaz && allocation.ecazAmount > 0 &&
        balances[allocation.ecaz] > ecazDebited) {
      payer=allocation.ecaz; ecazDebited++;
    } else if (owner.id !== allocation.ally && allocation.allyAmount > 0 &&
        balances[allocation.ally] > allyDebited) {
      payer=allocation.ally; allyDebited++;
    } else continue;
    requireCollection(Number.isSafeInteger(balances[owner.id]+1),
      'Shared Orgiz income would overflow the spice balance.');
    effects.push({kind:'orgiz',player:owner.id,from:payer,location:allocation.territory,
      amount:1,source:'player'});
  }
  return effects;
}
