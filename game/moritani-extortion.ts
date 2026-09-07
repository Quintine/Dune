/** Isolated Extortion ledger; authorization and Mentat scheduling belong to the engine.
 * Source: docs/MORITANI_EXTORTION_RULES.md. No placement-relative priority is encoded.
 */
export type ExtortionPlayer = { id: string; spice: number };
export type ExtortionContext = {
  turn: number;
  phase: number;
  players: readonly ExtortionPlayer[];
};
export type ExtortionState = {
  owner: string;
  token: string;
  turn: number;
  bank: { reserved: 0 | 5; collected: 0 | 5 };
  queue: string[];
  cursor: number;
  stage: 'reserved' | 'payment' | 'settled';
  payer: string | null;
};
export type ExtortionTransfer =
  | { from: 'reservedBank'; to: string; amount: 5 }
  | { from: 'player'; player: string; to: string; amount: 3 };
export type ExtortionResult = {
  state: ExtortionState;
  transfer: ExtortionTransfer | null;
  /** null: still pending; false: first payment prevents recovery; true: return token. */
  recover: boolean | null;
};

function requireValid(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function contextPlayers(context: ExtortionContext) {
  requireValid(
    Number.isSafeInteger(context.turn) && context.turn > 0,
    'Extortion requires a positive turn.',
  );
  requireValid(
    Number.isSafeInteger(context.phase) &&
      context.phase >= 0 &&
      context.phase <= 9,
    'Extortion requires a valid current phase.',
  );
  const players = new Map<string, ExtortionPlayer>();
  for (const player of context.players) {
    requireValid(
      typeof player.id === 'string' &&
        player.id.length > 0 &&
        !players.has(player.id),
      'Extortion player identities must be unique and nonempty.',
    );
    requireValid(
      Number.isSafeInteger(player.spice) && player.spice >= 0,
      'Extortion requires current nonnegative integer spice balances.',
    );
    players.set(player.id, player);
  }
  return players;
}
function validate(state: ExtortionState, context: ExtortionContext) {
  const players = contextPlayers(context);
  requireValid(
    players.has(state.owner),
    'Extortion owner must still be present.',
  );
  requireValid(
    typeof state.token === 'string' && state.token.length > 0,
    'Extortion requires its revealed token identity.',
  );
  requireValid(
    state.turn === context.turn,
    'This Extortion obligation belongs to another turn.',
  );
  requireValid(
    Number.isSafeInteger(state.cursor) &&
      state.cursor >= 0 &&
      state.cursor <= state.queue.length,
    'Invalid Extortion payment cursor.',
  );
  requireValid(
    new Set(state.queue).size === state.queue.length &&
      state.queue.every((id) => id !== state.owner && players.has(id)),
    'Invalid Extortion payer queue.',
  );
  if (state.stage === 'reserved') {
    requireValid(
      state.bank.reserved === 5 &&
        state.bank.collected === 0 &&
        state.queue.length === 0 &&
        state.cursor === 0 &&
        state.payer === null,
      'Invalid uncollected Extortion reserve.',
    );
  } else {
    requireValid(
      state.stage === 'payment' || state.stage === 'settled',
      'Invalid Extortion stage.',
    );
    requireValid(
      state.bank.reserved === 0 && state.bank.collected === 5,
      'Extortion payment requires its bank award to be collected.',
    );
    requireValid(
      state.queue.length === players.size - 1,
      'Extortion payer membership changed.',
    );
    if (state.stage === 'payment')
      requireValid(
        state.payer === null && state.cursor < state.queue.length,
        'Invalid pending Extortion payment.',
      );
    else
      requireValid(
        state.payer === null
          ? state.cursor === state.queue.length
          : state.cursor > 0 && state.queue[state.cursor - 1] === state.payer,
        'Invalid completed Extortion payment.',
      );
  }
  return players;
}
function clone(state: ExtortionState): ExtortionState {
  return {
    owner: state.owner,
    token: state.token,
    turn: state.turn,
    bank: { ...state.bank },
    queue: [...state.queue],
    cursor: state.cursor,
    stage: state.stage,
    payer: state.payer,
  };
}

/** Reserve five bank spice without crediting any player's spendable balance.
 * The caller must enforce one obligation per revealed token and authorize revelation.
 */
export function reserveExtortion(
  input: { owner: string; token: string; turn: number },
  context: ExtortionContext,
): ExtortionResult {
  const state: ExtortionState = {
    ...input,
    bank: { reserved: 5, collected: 0 },
    queue: [],
    cursor: 0,
    stage: 'reserved',
    payer: null,
  };
  validate(state, context);
  return { state, transfer: null, recover: null };
}

/** Collect before approaching payers, at a caller-selected Mentat continuation.
 * The queue includes allies and insolvent players. "Pays you" is composed as another
 * player's transfer: self-payment is excluded, not claimed as an explicit printed rule.
 */
export function collectExtortion(
  state: ExtortionState,
  context: ExtortionContext & { stormOrder: readonly string[] },
): ExtortionResult {
  const players = validate(state, context);
  requireValid(context.phase === 8, 'Collect Extortion during Mentat Pause.');
  requireValid(
    state.stage === 'reserved',
    'Extortion bank spice has already been collected.',
  );
  requireValid(
    context.stormOrder.length === players.size &&
      new Set(context.stormOrder).size === players.size &&
      context.stormOrder.every((id) => players.has(id)),
    'Storm order must contain every current player exactly once.',
  );
  requireValid(
    players.get(state.owner)!.spice <= Number.MAX_SAFE_INTEGER - 5,
    'Extortion collection would overflow the owner balance.',
  );
  const next = clone(state);
  next.bank = { reserved: 0, collected: 5 };
  next.queue = context.stormOrder.filter((id) => id !== state.owner);
  next.stage = next.queue.length ? 'payment' : 'settled';
  return {
    state: next,
    transfer: { from: 'reservedBank', to: state.owner, amount: 5 },
    recover: next.stage === 'settled' ? true : null,
  };
}

/** Apply returned state and transfer atomically. Never replay a transfer independently.
 * Balances are checked at the choice, allowing permitted intervening income to fund it.
 */
export function answerExtortion(
  state: ExtortionState,
  playerId: string,
  pay: boolean,
  context: ExtortionContext,
): ExtortionResult {
  const players = validate(state, context);
  requireValid(context.phase === 8, 'Answer Extortion during Mentat Pause.');
  requireValid(
    state.stage === 'payment',
    'There is no pending Extortion payment.',
  );
  requireValid(
    state.queue[state.cursor] === playerId,
    'Wait for your Extortion turn in storm order.',
  );
  requireValid(
    typeof pay === 'boolean',
    'Choose whether to pay exactly three spice.',
  );
  if (pay) {
    requireValid(
      players.get(playerId)!.spice >= 3,
      'Extortion payment requires three available spice.',
    );
    requireValid(
      players.get(state.owner)!.spice <= Number.MAX_SAFE_INTEGER - 3,
      'Extortion payment would overflow the owner balance.',
    );
  }
  const next = clone(state);
  next.cursor++;
  if (pay) {
    next.payer = playerId;
    next.stage = 'settled';
  } else if (next.cursor === next.queue.length) next.stage = 'settled';
  return {
    state: next,
    transfer: pay
      ? { from: 'player', player: playerId, to: state.owner, amount: 3 }
      : null,
    recover: next.stage === 'settled' ? !pay : null,
  };
}
