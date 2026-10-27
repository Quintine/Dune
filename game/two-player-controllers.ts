/** Explicit two-person setup: faction seats remain separate physical players.
 * Controller IDs are their original, independently authenticated first seats;
 * this public mapping is not itself a credential or an alliance. */
export type TwoPlayerController = {
  id: string;
  seats: string[];
};

export type TwoPlayerControllers = {
  version: 1;
  controllers: TwoPlayerController[];
};

export class TwoPlayerControllersError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TwoPlayerControllersError';
  }
}

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.trim() === value;
function requireControllers(condition: unknown, message: string): asserts condition {
  if (!condition) throw new TwoPlayerControllersError(message);
}
function validateSeats(seats: readonly string[]): void {
  requireControllers(Array.isArray(seats) && seats.length <= 4 && seats.every(identifier) &&
    new Set(seats).size === seats.length,
  'The two-person setup needs at most four distinct seated faction IDs.');
}

/** An empty mapping is useful while the lobby is being assembled. It does not
 * authorize any seat; the room layer must authenticate every seat separately. */
export function createTwoPlayerControllers(): TwoPlayerControllers {
  return { version: 1, controllers: [] };
}

/** Validate lobby-stage assignments. Unassigned seated factions are allowed
 * while the lobby is assembled, but every assignment must refer to a distinct
 * current seat. An existing controller's first seat is always its identity. */
export function validateTwoPlayerControllersLobby(
  value: unknown,
  seats: readonly string[],
): asserts value is TwoPlayerControllers {
  validateSeats(seats);
  requireControllers(record(value) && Object.keys(value).sort().join(',') === 'controllers,version' &&
    value.version === 1 && Array.isArray(value.controllers) && value.controllers.length <= 2,
  'The two-person controller mapping is malformed.');
  const identities = new Set<string>();
  const assigned = new Set<string>();
  for (const controller of value.controllers) {
    requireControllers(record(controller) && Object.keys(controller).sort().join(',') === 'id,seats' &&
      identifier(controller.id) && Array.isArray(controller.seats) &&
      controller.seats.length >= 1 && controller.seats.length <= 2 &&
      controller.seats.every(identifier) && controller.seats[0] === controller.id &&
      controller.seats.every(seat => seats.includes(seat)),
    'Each controller must retain its original primary seat and at most one other seated faction.');
    requireControllers(!identities.has(controller.id), 'Each controller must have a distinct primary seat.');
    identities.add(controller.id);
    for (const seat of controller.seats) {
      requireControllers(!assigned.has(seat), 'Each faction seat can belong to only one controller.');
      assigned.add(seat);
    }
  }
}

/** Before play, require exactly two controllers, two factions each, and a
 * complete partition of the four actual faction seats. */
export function validateTwoPlayerControllersComplete(
  value: unknown,
  seats: readonly string[],
): asserts value is TwoPlayerControllers {
  validateTwoPlayerControllersLobby(value, seats);
  requireControllers(seats.length === 4 && value.controllers.length === 2 &&
    value.controllers.every(controller => controller.seats.length === 2),
  'Two-person play needs exactly two controllers with two faction seats each.');
}

/** Add one actual faction to a controller without mutating either input.
 * A new controller can only be created by adding its own original seat first. */
export function addTwoPlayerControlledSeat(
  value: TwoPlayerControllers,
  seats: readonly string[],
  controllerId: string,
  seatId: string,
): TwoPlayerControllers {
  validateTwoPlayerControllersLobby(value, seats);
  requireControllers(identifier(controllerId) && identifier(seatId) && seats.includes(seatId),
    'Choose a currently seated faction and its actual controller.');
  requireControllers(!value.controllers.some(controller => controller.seats.includes(seatId)),
    'This faction seat already belongs to a controller.');
  const next: TwoPlayerControllers = { version: 1, controllers: value.controllers.map(controller =>
    ({ id: controller.id, seats: [...controller.seats] })) };
  const existing = next.controllers.find(controller => controller.id === controllerId);
  if (existing) {
    requireControllers(existing.seats.length < 2, 'A controller already has two faction seats.');
    existing.seats.push(seatId);
  } else {
    requireControllers(next.controllers.length < 2 && controllerId === seatId,
      'Start each new controller with its own distinct primary seat.');
    next.controllers.push({ id: controllerId, seats: [seatId] });
  }
  validateTwoPlayerControllersLobby(next, seats);
  return next;
}

/** Absence means the existing one-faction-per-person game. An explicit mapping
 * must be complete before it can influence a rules calculation. */
export function physicalControllerCount(
  seats: readonly string[],
  value?: TwoPlayerControllers | null,
): number {
  requireControllers(Array.isArray(seats) && seats.length >= 1 && seats.length <= 6 &&
    seats.every(identifier) && new Set(seats).size === seats.length,
  'Count distinct actual faction seats.');
  if (value === undefined || value === null) return seats.length;
  validateTwoPlayerControllersComplete(value, seats);
  return value.controllers.length;
}

/** Source-backed two-player threshold. Allied sides keep their existing
 * four-stronghold target; the caller applies any agreed target increment. */
export function controllerStrongholdTarget(
  seats: readonly string[],
  value: TwoPlayerControllers | null | undefined,
  allied: boolean,
): 3 | 4 {
  requireControllers(typeof allied === 'boolean', 'Identify whether this victory side is allied.');
  const controllers = physicalControllerCount(seats, value);
  return allied || controllers === 2 ? 4 : 3;
}
