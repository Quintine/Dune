import {
  MOBILE_LOCATION,
  splitLocation,
  territory,
  validLocation,
} from './board';
import {
  HomeworldCustodyError,
  homeworldForceGroups,
  quoteHomeworldCustody,
  type HomeworldCustody,
  type HomeworldCustodyChange,
  type HomeworldForces,
} from './homeworld-custody';
import { homeworldPopulations } from './homeworld-population';
import type { HomeworldShipmentContext } from './homeworld-shipment';

export type JunctionTransportContext = HomeworldShipmentContext & {
  storm: number;
  board: Record<
    string,
    {
      /** All physical counters, including the elite subset. */
      forces: Record<string, number>;
      eliteForces: Record<string, number>;
      advisors?: Record<string, { lockedTurn?: number }>;
    }
  >;
  /** Ordinary Arrakis pointer, never the mobile interior itself. */
  mobileStronghold?: string | null;
};
export type JunctionTransportIntent = {
  player: string;
  sponsor: string;
  destination: string;
  sources: Record<string, HomeworldForces>;
  rate: 'half' | 'full';
};
export type JunctionTransportSource = {
  key: string;
  before: HomeworldForces;
  after: HomeworldForces;
};
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const whole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
function requireTransport(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new HomeworldCustodyError(message);
}
function canonicalSector(key: string) {
  const { territory: id, sector } = splitLocation(key);
  return key === `${id}:${sector}` && validLocation(id, sector);
}
const eliteLimit = (faction: string) =>
  faction === 'emperor'
    ? 5
    : faction === 'fremen'
      ? 3
      : faction === 'ixians'
        ? 7
        : 0;

/** Native population gate only; retained occupation effects need engine policy. */
export function junctionSponsorEligible(
  context: HomeworldShipmentContext,
  custody: HomeworldCustody,
  sponsor: string,
) {
  const player = context.players.find((p) => p.id === sponsor);
  return (
    player?.faction === 'guild' &&
    homeworldPopulations(context, custody).some(
      (p) =>
        p.location === 'homeworld:guild' &&
        p.native === sponsor &&
        p.side === 'high',
    )
  );
}

/** Physical quote for an already authorized Junction transport offer.
 * Native-high checks use current population only; occupation eligibility,
 * timing, once-per-turn usage, offer identity and payment remain caller duties.
 * Arrakis outputs withdraw sources only: the caller must validate capacity,
 * mobile entry and advisor stance before placing the arrival. Paid transport
 * rejects ordinary storm sectors; the protected mobile interior is sector zero.
 * No concealed force, private hand, other player's board or spice is inspected. */
export function quoteJunctionTransport(
  context: JunctionTransportContext,
  custody: HomeworldCustody,
  intent: JunctionTransportIntent,
) {
  const worlds = homeworldForceGroups(context, custody);
  requireTransport(
    whole(context.storm) && context.storm <= 18 && record(context.board),
    'Junction transport needs the current public board and storm.',
  );
  requireTransport(
    context.players.every(
      (p) =>
        p.ally === null ||
        (typeof p.ally === 'string' &&
          p.ally !== p.id &&
          context.players.some((other) => other.id === p.ally)),
    ),
    'Junction transport needs valid seated alliance identities.',
  );
  requireTransport(
    record(intent) &&
      Object.keys(intent).length === 5 &&
      typeof intent.player === 'string' &&
      typeof intent.sponsor === 'string' &&
      typeof intent.destination === 'string' &&
      record(intent.sources) &&
      (intent.rate === 'half' || intent.rate === 'full'),
    'Choose a recipient, Guild sponsor, destination, typed sources and transport rate.',
  );
  const player = context.players.find((p) => p.id === intent.player);
  const sponsor = context.players.find((p) => p.id === intent.sponsor);
  requireTransport(
    player && sponsor?.faction === 'guild' && player.id !== sponsor.id,
    'Junction transport must be granted by the seated Guild to another faction.',
  );
  requireTransport(
    junctionSponsorEligible(context, custody, sponsor.id),
    'Junction transport requires its current native high population.',
  );
  const pointer = context.mobileStronghold;
  requireTransport(
    pointer === undefined ||
      pointer === null ||
      (typeof pointer === 'string' &&
        canonicalSector(pointer) &&
        pointer !== MOBILE_LOCATION),
    'The mobile stronghold needs a canonical Arrakis pointer.',
  );
  const destinationWorld = worlds.find((w) => w.id === intent.destination);
  requireTransport(
    destinationWorld ||
      (canonicalSector(intent.destination) &&
        (intent.destination !== MOBILE_LOCATION || !!pointer)),
    'Choose an active Homeworld or canonical Arrakis destination.',
  );
  const destinationKind = destinationWorld
    ? ('homeworld' as const)
    : ('arrakis' as const);
  if (!destinationWorld) {
    const sector = splitLocation(intent.destination).sector;
    requireTransport(
      sector === 0 || sector !== context.storm,
      'The destination is in storm.',
    );
  }
  if (destinationWorld) {
    const native = context.players.find(
      (p) => p.id === destinationWorld.native,
    )!;
    requireTransport(
      !(player.ally === native.id && native.ally === player.id),
      'You cannot ship to your ally’s Homeworld.',
    );
  }
  const board = Object.hasOwn(context.board, player.id)
    ? context.board[player.id]
    : undefined;
  requireTransport(
    record(board) && record(board.forces) && record(board.eliteForces),
    'Junction transport needs the recipient’s current physical board counters.',
  );
  let boardTotal = 0;
  let boardElite = 0;
  for (const [key, count] of Object.entries(board.forces)) {
    requireTransport(
      canonicalSector(key) &&
        whole(count) &&
        count <= 20 &&
        (key !== MOBILE_LOCATION || !!pointer),
      'Junction transport needs canonical physical board counts.',
    );
    boardTotal += count;
  }
  for (const [key, count] of Object.entries(board.eliteForces)) {
    requireTransport(
      canonicalSector(key) &&
        whole(count) &&
        count <= (Object.hasOwn(board.forces, key) ? board.forces[key] : 0),
      'Special counters must be a subset of the physical force group.',
    );
    boardElite += count;
  }
  const worldTotals = worlds.reduce(
    (sum, w) => {
      const group = w.forces[player.id];
      return {
        total: sum.total + (group?.normal ?? 0) + (group?.elite ?? 0),
        elite: sum.elite + (group?.elite ?? 0),
      };
    },
    { total: 0, elite: 0 },
  );
  requireTransport(
    boardTotal + worldTotals.total <= 20 &&
      boardElite + worldTotals.elite <= eliteLimit(player.faction),
    'Board and Homeworld custody exceed the faction’s physical counter supply.',
  );
  const entries = Object.entries(intent.sources);
  requireTransport(
    entries.length > 0,
    'Choose a positive physical source group.',
  );
  const originWorld = worlds.find((w) => w.id === entries[0][0]);
  const originKind = originWorld
    ? ('homeworld' as const)
    : ('arrakis' as const);
  if (originWorld)
    requireTransport(
      entries.length === 1 ||
        (entries.length === 2 &&
          context.advanced &&
          player.faction === 'emperor' &&
          entries.every(([key]) =>
            ['homeworld:emperor', 'homeworld:emperor:salusa'].includes(key),
          )),
      'Use one source Homeworld, or combine Emperor’s native Kaitain and Salusa groups.',
    );
  const boardForces = { ...board.forces };
  const boardEliteForces = { ...board.eliteForces };
  const changes: HomeworldCustodyChange[] = [];
  const sources: JunctionTransportSource[] = [];
  let origin: string | undefined;
  let normal = 0;
  let elite = 0;
  for (const [key, selected] of entries) {
    requireTransport(
      record(selected) &&
        Object.keys(selected).length === 2 &&
        whole(selected.normal) &&
        whole(selected.elite) &&
        selected.normal + selected.elite > 0 &&
        selected.normal + selected.elite <= 20,
      'Each source needs positive typed physical normal and special counters.',
    );
    normal += selected.normal;
    elite += selected.elite;
    if (originWorld) {
      requireTransport(
        worlds.some((w) => w.id === key) && key !== intent.destination,
        'Transport needs a distinct active source Homeworld.',
      );
      changes.push({
        homeworld: key,
        player: player.id,
        withdraw: { ...selected },
        deposit: { normal: 0, elite: 0 },
      });
      origin ??= key;
    } else {
      requireTransport(
        canonicalSector(key) && (key !== MOBILE_LOCATION || !!pointer),
        'Choose a canonical, active Arrakis source sector.',
      );
      const source = splitLocation(key);
      requireTransport(
        source.sector === 0 || source.sector !== context.storm,
        'The source is in storm.',
      );
      requireTransport(
        origin === undefined || origin === source.territory,
        'A transport group must come from one Arrakis territory.',
      );
      origin = source.territory;
      requireTransport(
        !destinationWorld ||
          player.faction !== 'beneGesserit' ||
          !board.advisors?.[source.territory],
        'Bene Gesserit advisors cannot ship to a Homeworld.',
      );
      const total = Object.hasOwn(board.forces, key) ? board.forces[key] : 0;
      const special = Object.hasOwn(board.eliteForces, key)
        ? board.eliteForces[key]
        : 0;
      const before = { normal: total - special, elite: special };
      requireTransport(
        selected.normal <= before.normal && selected.elite <= before.elite,
        'The selected Arrakis sector does not hold those typed physical counters.',
      );
      const after = {
        normal: before.normal - selected.normal,
        elite: before.elite - selected.elite,
      };
      if (after.normal + after.elite)
        boardForces[key] = after.normal + after.elite;
      else delete boardForces[key];
      if (after.elite) boardEliteForces[key] = after.elite;
      else delete boardEliteForces[key];
      sources.push({ key, before, after });
    }
  }
  const amount = normal + elite;
  requireTransport(
    amount <= 20,
    'A transport cannot exceed twenty physical counters.',
  );
  if (!destinationWorld && !originWorld)
    requireTransport(
      splitLocation(intent.destination).territory !== origin,
      'Cross transport needs a different destination territory.',
    );
  if (destinationWorld)
    changes.push({
      homeworld: destinationWorld.id,
      player: player.id,
      withdraw: { normal: 0, elite: 0 },
      deposit: { normal, elite },
    });
  const transferred = quoteHomeworldCustody(context, custody, changes);
  if (originWorld)
    sources.push(
      ...transferred.receipts
        .filter((r) => r.homeworld !== intent.destination)
        .map((r) => ({
          key: r.homeworld,
          before: { ...r.before },
          after: { ...r.after },
        })),
    );
  const fullCost =
    destinationWorld ||
    territory(splitLocation(intent.destination).territory).type === 'stronghold'
      ? amount
      : amount * 2;
  return {
    ...transferred,
    boardForces,
    boardEliteForces,
    sources,
    origin: origin!,
    originKind,
    destinationKind,
    amount,
    elite,
    cost: intent.rate === 'half' ? Math.ceil(fullCost / 2) : fullCost,
  };
}
