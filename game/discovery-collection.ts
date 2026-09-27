import { isAdvisor } from './advisors';
import { gameTerritories, splitLocation, type MobileBoard } from './board';
import type { AdvisorRelease } from './board-resolution-quote';
import type { Player } from './engine';
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

function occupants(
  context: DiscoveryCollectionContext,
  location: string,
  released: readonly AdvisorRelease[],
): DiscoveryCollectionSeat[] {
  if (!gameTerritories(context).some((territory) => territory.id === location))
    return [];
  return context.players.filter(
    (player) => isCollectingFighter(player, location, released) &&
      presenceAt(player, location) > 0,
  );
}

/**
 * Compose sole-occupant Cistern income and a bounded Orgiz transfer over the
 * canonical ordinary collection quote. The ordinary `collected` and `desert`
 * fields remain factual: Cistern is bank income; Orgiz transfers player spice.
 *
 * The publisher does not specify whether a stacked physical pile is one or
 * several blows. One positive collected board deposit is treated as one
 * observable blow. Contested location benefits and unresolved shared lots
 * withhold only their uncertain effect; they never block ordinary collection.
 */
export function quoteDiscoveryCollection(
  context: DiscoveryCollectionContext,
  collection: DiscoveryBaseCollectionQuote,
): DiscoveryCollectionQuote {
  requireCollection(
    record(context) &&
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
  const cistern = occupants(context, CISTERN, collection.released);
  if (cistern.length === 1) {
    const receipt = receipts.find((entry) => entry.player === cistern[0].id)!;
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

  const orgiz = occupants(context, ORGIZ_PROCESSING_STATION, collection.released);
  if (orgiz.length === 1) {
    const owner = orgiz[0];
    const ownerReceipt = receipts.find((entry) => entry.player === owner.id)!;
    for (const key of sourceKeys) {
      if (context.spice[key] <= collection.spice[key]) continue;
      const { territory, sector } = splitLocation(key);
      if (
        collection.shared.some(
          (lot) => lot.amount > 0 && lot.territory === territory,
        )
      ) continue;
      let collector: DiscoveryCollectionSeat | undefined;
      let contested = false;
      for (const player of context.players) {
        if (!isCollectingFighter(player, territory, collection.released)) continue;
        const marker = player.noField?.deployed?.location;
        if (
          (player.forces[key] ?? 0) <= 0 &&
          !(marker?.territory === territory && marker.sector === sector)
        ) continue;
        if (collector) {
          contested = true;
          break;
        }
        collector = player;
      }
      if (contested || !collector || collector.id === owner.id) continue;
      const collectorReceipt = receipts.find(
        (entry) => entry.player === collector.id,
      )!;
      requireCollection(
        collectorReceipt.balance >= 1 &&
          Number.isSafeInteger(ownerReceipt.balance + 1),
        'Orgiz theft would invalidate a player spice balance.',
      );
      collectorReceipt.balance -= 1;
      ownerReceipt.balance += 1;
      effects.push({
        kind: 'orgiz',
        player: owner.id,
        from: collector.id,
        location: key,
        amount: 1,
        source: 'player',
      });
    }
  }

  return { receipts, effects };
}
