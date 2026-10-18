export type BattleOutcomeIdentity = {
  event: string;
  attacker: string;
  defender: string;
  turn: number;
};
export type BattleOutcomeWindow = {
  version: 1;
  event: string;
  battle: string;
  turn: number;
  attacker: string;
  defender: string;
  revision: number;
  ready: string[];
  closed: boolean;
};
export class BattleOutcomeWindowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BattleOutcomeWindowError';
  }
}
function requireWindow(value: unknown, message: string): asserts value {
  if (!value) throw new BattleOutcomeWindowError(message);
}
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const count = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const exact = (value: unknown, keys: string): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value)) &&
  Object.keys(value).sort().join(',') === keys;
function validateIdentity(identity: BattleOutcomeIdentity): void {
  requireWindow(
    exact(identity, 'attacker,defender,event,turn') && identifier(identity.event) &&
      identifier(identity.attacker) && identifier(identity.defender) &&
      identity.attacker !== identity.defender && count(identity.turn) && identity.turn > 0,
    'The final battle window needs its original battle, turn and distinct combatants.',
  );
}
const windowEvent = (identity: BattleOutcomeIdentity, revision: number): string =>
  `battleOutcome:${JSON.stringify([identity.event, identity.turn, revision])}`;

/** Public identities and acknowledgements only; no outcome or held-card query. */
export function createBattleOutcomeWindow(
  identity: BattleOutcomeIdentity,
  revision: number,
): BattleOutcomeWindow {
  validateIdentity(identity);
  requireWindow(count(revision), 'The final battle window needs a safe nonnegative revision.');
  return {
    version: 1, event: windowEvent(identity, revision), battle: identity.event,
    turn: identity.turn, attacker: identity.attacker, defender: identity.defender,
    revision, ready: [], closed: false,
  };
}

export function validateBattleOutcomeWindow(
  state: BattleOutcomeWindow,
  identity: BattleOutcomeIdentity,
  revision: number,
): void {
  validateIdentity(identity);
  requireWindow(
    count(revision) &&
      exact(state, 'attacker,battle,closed,defender,event,ready,revision,turn,version') &&
      state.version === 1 && state.battle === identity.event && state.turn === identity.turn &&
      state.attacker === identity.attacker && state.defender === identity.defender &&
      state.revision === revision && state.event === windowEvent(identity, revision),
    'The final battle window has changed its original battle, combatants or revision.',
  );
  requireWindow(
    Array.isArray(state.ready) &&
      state.ready.every(player => player === identity.attacker || player === identity.defender) &&
      new Set(state.ready).size === state.ready.length &&
      typeof state.closed === 'boolean' && state.closed === (state.ready.length === 2),
    'The final battle window needs distinct combatant acknowledgements and a matching closed status.',
  );
}

export function readyBattleOutcomeWindow(
  state: BattleOutcomeWindow,
  identity: BattleOutcomeIdentity,
  revision: number,
  player: string,
  event: string,
): BattleOutcomeWindow {
  validateBattleOutcomeWindow(state, identity, revision);
  requireWindow(!state.closed, 'The final battle window is already closed.');
  requireWindow(event === state.event, 'This final battle window event has expired.');
  requireWindow(
    player === identity.attacker || player === identity.defender,
    'Only a combatant can finish final battle actions.',
  );
  requireWindow(!state.ready.includes(player), 'This combatant already finished final battle actions.');
  const ready = [...state.ready, player];
  return { ...state, ready, closed: ready.length === 2 };
}

/** A public Sapho use creates a fresh shared opportunity before resolution. */
export function reviseBattleOutcomeWindow(
  state: BattleOutcomeWindow,
  identity: BattleOutcomeIdentity,
  previousRevision: number,
  nextRevision: number,
): BattleOutcomeWindow {
  validateBattleOutcomeWindow(state, identity, previousRevision);
  requireWindow(!state.closed, 'The final battle window is already closed.');
  requireWindow(
    count(nextRevision) && nextRevision === previousRevision + 1,
    'A final battle window revision must advance exactly once.',
  );
  return createBattleOutcomeWindow(identity, nextRevision);
}
