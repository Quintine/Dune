/** A definite answer about claiming charity after the answer in the current
 * Charity phase. Native eligibility and the cause of an opportunity changing
 * remain authoritative in the engine. */
export type CharityPromise = {
  event: string;
  turn: number;
  player: string;
  asker: string;
  answer: boolean;
  fulfilled: boolean;
  released: boolean;
};

export class CharityPromiseError extends Error {}
export type CharityPromiseAnswer = 'yes' | 'no';
export type CharityPromiseChange = 'voluntary' | 'external';

function checkContext(player: string, turn: number): void {
  if (typeof player !== 'string' || !player.trim() || player !== player.trim() ||
      !Number.isSafeInteger(turn) || turn < 1)
    throw new CharityPromiseError('Retain the original player and turn for the Charity answer.');
}

/** Each physical answer owns a distinct stable receipt across continuations. */
export function validateCharityPromises(promises: readonly CharityPromise[]): void {
  if (!Array.isArray(promises)) throw new CharityPromiseError('The Charity answer receipts are invalid.');
  const events = new Set<string>();
  for (const row of promises) {
    if (!row || typeof row.event !== 'string' || !row.event.trim() || row.event !== row.event.trim() ||
        events.has(row.event) || typeof row.player !== 'string' || !row.player.trim() ||
        row.player !== row.player.trim() || typeof row.asker !== 'string' || !row.asker.trim() ||
        row.asker !== row.asker.trim() || row.asker === row.player ||
        !Number.isSafeInteger(row.turn) || row.turn < 1 || typeof row.answer !== 'boolean' ||
        typeof row.fulfilled !== 'boolean' || typeof row.released !== 'boolean' || row.fulfilled && row.released)
      throw new CharityPromiseError('A Charity answer lost its unique event, participants or outcome.');
    events.add(row.event);
  }
}

/** A No remains live through phase close, even if concurrent Basic Ready is
 * later reopened. A Yes completes only when the actual claim is accepted. */
export function liveCharityPromises<T extends CharityPromise>(
  promises: readonly T[], player: string, turn: number,
): T[] {
  checkContext(player, turn);
  validateCharityPromises(promises);
  return promises.filter(row => row.player === player && row.turn === turn && !row.fulfilled && !row.released);
}

/** canClaim is the native, current opportunity, including funding and prior
 * claim rules. It must not be a temporary inability while a response is open. */
export function charityPromiseAnswers(
  promises: readonly CharityPromise[], player: string, turn: number, canClaim: boolean,
): CharityPromiseAnswer[] {
  const live = liveCharityPromises(promises, player, turn);
  return [
    ...(canClaim && !live.some(row => !row.answer) ? ['yes' as const] : []),
    ...(!live.some(row => row.answer) ? ['no' as const] : []),
  ];
}

/** Called only for a definite accepted answer, before the Truth card's actual
 * discard. The engine reopens Basic readiness separately. */
export function bindCharityPromise(
  promises: readonly CharityPromise[], player: string, asker: string, turn: number,
  answer: boolean, canClaim: boolean, event: string = crypto.randomUUID(),
): CharityPromise[] {
  checkContext(asker, turn);
  if (asker === player || typeof answer !== 'boolean' ||
      !charityPromiseAnswers(promises, player, turn, canClaim).includes(answer ? 'yes' : 'no'))
    throw new CharityPromiseError('Choose a Charity answer consistent with the current opportunity and previous answers.');
  const next = [...promises, { event, turn, player, asker, answer, fulfilled: false, released: false }];
  validateCharityPromises(next);
  return next;
}

/** Invoke after native claim validation, before the actual claim settles. */
export function guardCharityClaim<T extends CharityPromise>(
  promises: readonly T[], player: string, turn: number,
): T[] {
  const live = liveCharityPromises(promises, player, turn);
  if (live.some(row => !row.answer))
    throw new CharityPromiseError('Your Truthtrance No prevents claiming Charity this phase.');
  return promises.map(row => live.includes(row) && row.answer ? { ...row, fulfilled: true } : row);
}

/** A reachable affirmative claim must happen before this player confirms Ready. */
export function guardCharityReady(
  promises: readonly CharityPromise[], player: string, turn: number, canClaim: boolean,
): void {
  if (canClaim && liveCharityPromises(promises, player, turn).some(row => row.answer))
    throw new CharityPromiseError('Claim Charity before finishing your Truthtrance Yes.');
}

/** Reconcile only at a stable native boundary. A voluntary change may not
 * sacrifice an attainable Yes; an externally impossible Yes is released. No
 * resolves only when the original phase closes, never merely on Ready. */
export function reconcileCharityPromises<T extends CharityPromise>(
  promises: readonly T[], player: string, turn: number,
  opportunity: { phaseOpen: boolean; canClaim: boolean; change: CharityPromiseChange },
): T[] {
  const live = liveCharityPromises(promises, player, turn);
  if (!opportunity || typeof opportunity.phaseOpen !== 'boolean' ||
      typeof opportunity.canClaim !== 'boolean' ||
      (opportunity.change !== 'voluntary' && opportunity.change !== 'external'))
    throw new CharityPromiseError('Retain the original Charity opportunity and the cause of its change.');
  if ((!opportunity.phaseOpen || !opportunity.canClaim) && live.some(row => row.answer) &&
      opportunity.change === 'voluntary')
    throw new CharityPromiseError('This action would abandon your Truthtrance Charity Yes.');
  return promises.map(row => {
    if (!live.includes(row)) return row;
    if (row.answer && (!opportunity.phaseOpen || !opportunity.canClaim)) return { ...row, released: true };
    if (!row.answer && !opportunity.phaseOpen) return { ...row, fulfilled: true };
    return row;
  });
}
