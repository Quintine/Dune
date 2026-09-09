import { MOBILE_LOCATION, splitLocation, validLocation } from './board';
import {
  HomeworldCustodyError,
  homeworldForceGroups,
  quoteHomeworldCustody,
  type HomeworldCustody,
  type HomeworldForces,
} from './homeworld-custody';
import type { HomeworldShipmentContext } from './homeworld-shipment';

export type GuildHomeworldShipmentContext = HomeworldShipmentContext & {
  storm: number;
  board: Record<
    string,
    { forces: Record<string, number>; eliteForces: Record<string, number> }
  >;
  /** The mobile stronghold's ordinary Arrakis pointer, not its interior. */
  mobileStronghold?: string | null;
};
export type GuildHomeworldShipmentIntent = {
  player: string;
  destination: string;
  sources: Record<string, HomeworldForces>;
};
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const whole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
function requireShipment(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new HomeworldCustodyError(message);
}
function canonicalSector(key: string) {
  const { territory, sector } = splitLocation(key);
  return key === `${territory}:${sector}` && validLocation(territory, sector);
}

/** Guild's own special shipment from one Arrakis territory to a Homeworld.
 * The caller owns timing, payment, alliance funding, responses and arrival
 * effects. No private card, concealed-force value or transport usage is read.
 * The mobile stronghold's interior remains protected when its pointer is in
 * storm. A Homeworld destination never becomes a fabricated Arrakis sector. */
export function quoteGuildHomeworldShipment(
  context: GuildHomeworldShipmentContext,
  custody: HomeworldCustody,
  intent: GuildHomeworldShipmentIntent,
) {
  const worlds = homeworldForceGroups(context, custody);
  requireShipment(
    whole(context.storm) && context.storm <= 18 && record(context.board),
    'Guild shipment needs the current board and storm sector.',
  );
  requireShipment(
    context.players.every(
      (p) =>
        p.ally === null ||
        (typeof p.ally === 'string' &&
          p.ally !== p.id &&
          context.players.some((other) => other.id === p.ally)),
    ),
    'Homeworld shipment needs valid seated alliance identities.',
  );
  requireShipment(
    record(intent) &&
      Object.keys(intent).length === 3 &&
      typeof intent.player === 'string' &&
      typeof intent.destination === 'string' &&
      record(intent.sources),
    'Choose the Guild, a destination Homeworld and typed Arrakis source groups.',
  );
  const player = context.players.find((p) => p.id === intent.player);
  const destination = worlds.find((w) => w.id === intent.destination);
  requireShipment(
    player?.faction === 'guild' && destination,
    'Only the Guild may ship from Arrakis to an active Homeworld.',
  );
  const native = context.players.find((p) => p.id === destination.native)!;
  requireShipment(
    !(player.ally === native.id && native.ally === player.id),
    'You cannot ship to your ally’s Homeworld.',
  );
  const board = Object.hasOwn(context.board, player.id)
    ? context.board[player.id]
    : undefined;
  requireShipment(
    record(board) && record(board.forces) && record(board.eliteForces),
    'Guild shipment needs its current physical board counters.',
  );
  const pointer = context.mobileStronghold;
  requireShipment(
    pointer === undefined ||
      pointer === null ||
      (typeof pointer === 'string' &&
        canonicalSector(pointer) &&
        pointer !== MOBILE_LOCATION),
    'The mobile stronghold needs a canonical Arrakis pointer.',
  );
  for (const [key, amount] of Object.entries(board.forces))
    requireShipment(
      canonicalSector(key) &&
        whole(amount) &&
        amount <= 20 &&
        (key !== MOBILE_LOCATION || !!pointer),
      'Guild shipment needs valid physical force locations and counts.',
    );
  for (const [key, amount] of Object.entries(board.eliteForces))
    requireShipment(
      canonicalSector(key) && whole(amount) && amount === 0,
      'Guild counters cannot acquire special force identities.',
    );
  const boardTotal = Object.values(board.forces).reduce((sum, n) => sum + n, 0);
  const worldTotal = worlds.reduce(
    (sum, w) =>
      sum +
      (w.forces[player.id]?.normal ?? 0) +
      (w.forces[player.id]?.elite ?? 0),
    0,
  );
  requireShipment(
    whole(boardTotal) && boardTotal + worldTotal <= 20,
    'Guild board and Homeworld custody exceed its twenty physical counters.',
  );
  const entries = Object.entries(intent.sources);
  requireShipment(
    entries.length > 0,
    'Choose forces from one Arrakis territory.',
  );
  let origin: string | undefined;
  let amount = 0;
  const boardForces = { ...board.forces };
  const boardEliteForces = { ...board.eliteForces };
  const boardSources: {
    key: string;
    before: HomeworldForces;
    after: HomeworldForces;
  }[] = [];
  for (const [key, selected] of entries) {
    requireShipment(
      canonicalSector(key) && (key !== MOBILE_LOCATION || !!pointer),
      'Choose a canonical, active Arrakis source sector.',
    );
    const source = splitLocation(key);
    requireShipment(source.sector !== context.storm, 'The source is in storm.');
    requireShipment(
      origin === undefined || origin === source.territory,
      'A Guild force group must come from one Arrakis territory.',
    );
    origin = source.territory;
    requireShipment(
      record(selected) &&
        Object.keys(selected).length === 2 &&
        whole(selected.normal) &&
        whole(selected.elite) &&
        selected.normal > 0 &&
        selected.elite === 0 &&
        selected.normal <= 20,
      'Each source needs a positive physical Guild counter group.',
    );
    const before = {
      normal: Object.hasOwn(board.forces, key) ? board.forces[key] : 0,
      elite: 0,
    };
    requireShipment(
      selected.normal <= before.normal,
      'The selected Arrakis sector does not hold those physical counters.',
    );
    const after = { normal: before.normal - selected.normal, elite: 0 };
    amount += selected.normal;
    if (after.normal) boardForces[key] = after.normal;
    else delete boardForces[key];
    delete boardEliteForces[key];
    boardSources.push({ key, before, after });
  }
  requireShipment(
    amount <= 20,
    'A shipment cannot exceed twenty physical counters.',
  );
  const transferred = quoteHomeworldCustody(context, custody, [
    {
      homeworld: destination.id,
      player: player.id,
      withdraw: { normal: 0, elite: 0 },
      deposit: { normal: amount, elite: 0 },
    },
  ]);
  return {
    ...transferred,
    amount,
    elite: 0,
    cost: Math.ceil(amount / 2),
    origin: origin!,
    boardSources,
    boardForces,
    boardEliteForces,
  };
}
