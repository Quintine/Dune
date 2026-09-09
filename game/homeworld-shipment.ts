import {
  HomeworldCustodyError,
  homeworldForceGroups,
  quoteHomeworldCustody,
  type HomeworldCustody,
  type HomeworldCustodyContext,
  type HomeworldForces,
  type HomeworldReserveSeat,
} from './homeworld-custody';

export type HomeworldShipmentContext = Omit<
  HomeworldCustodyContext,
  'players'
> & {
  players: (HomeworldReserveSeat & { ally: string | null })[];
};
export type HomeworldShipmentIntent = {
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

/** E3 world-to-world transport: use the actual native or foreign source pool.
 * Guild may also return a foreign garrison to its own world; other own-world
 * exceptions need separately established permission. The caller owns timing, usage,
 * funding, bank payment, responses and arrival effects. Guild's E3 half rate
 * applies to its own shipment; an alliance alone does not grant that rate. */
export function quoteHomeworldShipment(
  context: HomeworldShipmentContext,
  custody: HomeworldCustody,
  intent: HomeworldShipmentIntent,
) {
  // Validate the entire public custody before using any selected source.
  const worlds = homeworldForceGroups(context, custody);
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
    'Choose a seated shipper, a destination Homeworld and typed source groups.',
  );
  const player = context.players.find((p) => p.id === intent.player);
  const destination = worlds.find((w) => w.id === intent.destination);
  requireShipment(
    player && destination,
    'Choose an active Homeworld and seated shipper.',
  );
  const native = context.players.find((p) => p.id === destination.native)!;
  requireShipment(
    native.id !== player.id || player.faction === 'guild',
    'Shipment to your own Homeworld needs its specific return permission.',
  );
  requireShipment(
    !(player.ally === native.id && native.ally === player.id),
    'You cannot ship to your ally’s Homeworld.',
  );
  const sources = Object.entries(intent.sources);
  requireShipment(
    sources.length === 1 ||
      (sources.length === 2 &&
        context.advanced &&
        player.faction === 'emperor' &&
        sources.every(([id]) =>
          ['homeworld:emperor', 'homeworld:emperor:salusa'].includes(id),
        )),
    'Use one source Homeworld, or combine Emperor’s own Kaitain and Salusa forces in Advanced play.',
  );
  let normal = 0;
  let elite = 0;
  for (const [id, forces] of sources) {
    requireShipment(
      id !== destination.id && worlds.some((w) => w.id === id),
      'Shipment needs a distinct active source Homeworld.',
    );
    requireShipment(
      record(forces) &&
        Object.keys(forces).length === 2 &&
        whole(forces.normal) &&
        whole(forces.elite) &&
        forces.normal + forces.elite > 0 &&
        forces.normal + forces.elite <= 20,
      'Each source needs a positive physical normal and special counter group.',
    );
    normal += forces.normal;
    elite += forces.elite;
  }
  const amount = normal + elite;
  requireShipment(
    amount > 0 && amount <= 20,
    'A shipment cannot exceed the faction’s twenty physical counters.',
  );
  const transferred = quoteHomeworldCustody(context, custody, [
    ...sources.map(([homeworld, forces]) => ({
      homeworld,
      player: player.id,
      withdraw: { normal: forces.normal, elite: forces.elite },
      deposit: { normal: 0, elite: 0 },
    })),
    {
      homeworld: destination.id,
      player: player.id,
      withdraw: { normal: 0, elite: 0 },
      deposit: { normal, elite },
    },
  ]);
  return {
    ...transferred,
    amount,
    elite,
    cost: player.faction === 'guild' ? Math.ceil(amount / 2) : amount,
    sources: transferred.receipts.filter((r) => r.homeworld !== destination.id),
  };
}
