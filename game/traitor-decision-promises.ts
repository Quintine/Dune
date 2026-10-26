export type TraitorDecisionContext = {
  turn: number;
  battle: string;
  player: string;
  beneficiary: string;
  target: string;
  leader: string | null;
  canReveal: boolean;
  submitted?: boolean;
};

/** Public source of the original declaration, separate from its later effect. */
export type TraitorDecisionPromise = Omit<TraitorDecisionContext, 'canReveal' | 'submitted'> & {
  asker: string;
  answer: boolean;
  /** Link to the owner's mixed-question record; pure declaration receipts omit it. */
  event?: string;
  fulfilled?: boolean;
  released?: boolean;
};

export class TraitorDecisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TraitorDecisionError';
  }
}

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const turnNumber = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) > 0;
const optionalBoolean = (value: unknown) => value === undefined || typeof value === 'boolean';
function requireDecision(value: unknown, message: string): asserts value {
  if (!value) throw new TraitorDecisionError(message);
}

/** Reject private card/eligibility fields rather than retaining them in history. */
export function validateTraitorDecisionPromise(value: unknown): value is TraitorDecisionPromise {
  if (!record(value)) return false;
  const required = ['answer', 'asker', 'battle', 'beneficiary', 'leader', 'player', 'target', 'turn'];
  if (!required.every(key => Object.hasOwn(value, key)) ||
    Object.keys(value).some(key => !required.includes(key) && key !== 'event' && key !== 'fulfilled' && key !== 'released')) return false;
  return turnNumber(value.turn) && identifier(value.battle) && identifier(value.player) &&
    identifier(value.beneficiary) && identifier(value.target) &&
    (value.leader === null || identifier(value.leader)) && identifier(value.asker) &&
    typeof value.answer === 'boolean' && (!Object.hasOwn(value, 'event') || identifier(value.event)) &&
    optionalBoolean(value.fulfilled) && optionalBoolean(value.released);
}

function validateContext(context: TraitorDecisionContext) {
  requireDecision(record(context) && turnNumber(context.turn) && identifier(context.battle) &&
    identifier(context.player) && identifier(context.beneficiary) && identifier(context.target) &&
    (context.leader === null || identifier(context.leader)) && typeof context.canReveal === 'boolean' &&
    optionalBoolean(context.submitted),
  'Retain the current public Traitor decision source and native eligibility.');
}

function validatePromises(promises: readonly TraitorDecisionPromise[]) {
  requireDecision(Array.isArray(promises) && promises.every(validateTraitorDecisionPromise),
    'The Traitor decision promise has an invalid public source.');
}

function liveSource(context: TraitorDecisionContext, promise: TraitorDecisionPromise) {
  return !promise.fulfilled && !promise.released && promise.turn === context.turn &&
    promise.battle === context.battle && promise.player === context.player &&
    promise.beneficiary === context.beneficiary && promise.target === context.target && promise.leader === context.leader;
}

/** Current-turn decision composition. Native voters, matching physical cards,
 * ally benefit and Kwisatz Haderach eligibility remain the caller's authority. */
export function traitorDecisionChoices(
  context: TraitorDecisionContext,
  promises: readonly TraitorDecisionPromise[],
): boolean[] {
  validateContext(context);
  validatePromises(promises);
  if (context.submitted !== undefined) return [];
  const baseline = context.canReveal ? [false, true] : [false];
  return baseline.filter(choice => promises.every(promise =>
    !liveSource(context, promise) || promise.answer === choice));
}

export function bindTraitorDecisionPromise(
  context: TraitorDecisionContext,
  promises: readonly TraitorDecisionPromise[],
  asker: string,
  answer: boolean,
  event?: string,
): TraitorDecisionPromise[] {
  requireDecision(identifier(asker) && typeof answer === 'boolean' && (event === undefined || identifier(event)),
    'Choose a definite Traitor decision answer, its asker and an optional public event.');
  requireDecision(traitorDecisionChoices(context, promises).includes(answer),
    'This answer has no compatible current Traitor declaration.');
  return [...promises.map(promise => ({ ...promise })), {
    turn: context.turn, battle: context.battle, player: context.player,
    beneficiary: context.beneficiary, target: context.target, leader: context.leader, asker, answer,
    ...(event === undefined ? {} : { event }),
  }];
}

/** Call before assigning the actual declaration. A later prevented effect does
 * not retract a declaration or undo its fulfilled promise. */
export function settleTraitorDecisionPromises(
  context: TraitorDecisionContext,
  promises: readonly TraitorDecisionPromise[],
  call: boolean,
): TraitorDecisionPromise[] {
  requireDecision(typeof call === 'boolean', 'Declare whether to reveal your Traitor.');
  requireDecision(traitorDecisionChoices(context, promises).includes(call),
    'This Traitor declaration would break an accepted answer or its current opportunity.');
  return promises.map(promise => liveSource(context, promise)
    ? { ...promise, fulfilled: true } : { ...promise });
}

/** Only native loss of the still-current Yes capability releases it. Source
 * mismatch and original producer integrity remain with the battle engine. */
export function reconcileTraitorDecisionPromises(
  context: TraitorDecisionContext,
  promises: readonly TraitorDecisionPromise[],
): TraitorDecisionPromise[] {
  validateContext(context);
  validatePromises(promises);
  return promises.map(promise => !context.canReveal && promise.answer && liveSource(context, promise)
    ? { ...promise, released: true } : { ...promise });
}
