import type { Game } from './engine';
import { acquireDuke, releaseCapturedDuke, retireHomeworldDukeTenure, type DukeState } from './duke-vidal';
import { HomeworldCustodyError } from './homeworld-custody';
import { homeworldContext } from './homeworld-game';
import { readHomeworldOccupationSnapshot, homeworldOccupationSnapshotPresence } from './homeworld-occupation-history';
import {
  quoteStableHomeworldOccupation, type StableHomeworldOccupationContext,
} from './homeworld-stable-occupation';

export const HOMEWORLD_ECAZ_DUKE_SOURCE = 'homeworldEcaz' as const;
/** One choice, even after its one battle, departure or an alliance change.
 * This receipt stores no prior controller to restore and grants no revival. */
export type HomeworldEcazDukeReceipt = {
  turn: number;
  qualification: string;
  occupier: string;
  recipient: string;
};
export type HomeworldEcazDukeContext = StableHomeworldOccupationContext & Pick<Game, 'status'> & {
  dukeVidal?: DukeState;
  homeworldEcazDukeGrants?: HomeworldEcazDukeReceipt[];
};
export type HomeworldEcazDukeQuote = {
  event: string | null;
  owner: string | null;
  qualification: string | null;
  recipients: string[];
  /** Printed occupation priority persists after the one-battle grant is used. */
  nativeAcquisitionBlocked: boolean;
  claimed: HomeworldEcazDukeReceipt | null;
  blocked: string | null;
};
export type HomeworldEcazDukeLifecycleQuote = {
  release: boolean;
  owner: string | null;
  reason: 'turnEnded' | 'occupationEnded' | 'occupationChanged' | 'recipientChanged' | 'used' | 'dead' | null;
  blocked: string | null;
};
export class HomeworldEcazDukeError extends HomeworldCustodyError {}
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const unavailable = 'Duke Vidal is unavailable for the occupied Ecaz grant.';
const pendingCustody = 'Occupied Ecaz Duke transfer from captured, concealed or Ghola custody is not yet supported.';
function requireGrant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new HomeworldEcazDukeError(message);
}
export const homeworldEcazDukeEvent = (turn: number, qualification: string, occupier: string) =>
  JSON.stringify(['homeworldEcazDuke', turn, qualification, occupier]);

/** Validate only the small recorded choice against original source identities.
 * Historical recipients need not remain allied today. No receipt or history is
 * synthesized for old games, and no past entitlement is awarded by this read. */
export function validateHomeworldEcazDukeGrants(g: HomeworldEcazDukeContext): void {
  if (g.homeworldEcazDukeGrants === undefined) return;
  requireGrant(Array.isArray(g.homeworldEcazDukeGrants) && Number.isSafeInteger(g.turn) && g.turn >= 1,
    'Occupied Ecaz Duke grants need their original current turn.');
  const native = g.players.find(p => p.faction === 'ecaz');
  const keys = new Set<string>();
  for (const receipt of g.homeworldEcazDukeGrants) {
    requireGrant(receipt && typeof receipt === 'object' && !Array.isArray(receipt) &&
      Object.keys(receipt).sort().join(',') === 'occupier,qualification,recipient,turn' &&
      Number.isSafeInteger(receipt.turn) && receipt.turn >= 1 && receipt.turn <= g.turn &&
      text(receipt.qualification) && text(receipt.occupier) && text(receipt.recipient) &&
      receipt.occupier !== native?.id &&
      g.players.some(p => p.id === receipt.occupier) && g.players.some(p => p.id === receipt.recipient),
    'Occupied Ecaz Duke lost its original choice.');
    const key = JSON.stringify([receipt.turn, receipt.qualification]);
    requireGrant(!keys.has(key), 'Occupied Ecaz cannot choose Duke twice from the same turn and qualification.');
    keys.add(key);
    const source = g.homeworldOccupationHistory?.sources.find(row => row.event === receipt.qualification);
    requireGrant(native && source && source.cause !== 'setup' && source.turn <= receipt.turn,
      'Occupied Ecaz Duke lost its original qualification source.');
    const snapshot = readHomeworldOccupationSnapshot(g.homeworldOccupationHistory!.snapshots[source.snapshot], homeworldContext(g));
    requireGrant(homeworldOccupationSnapshotPresence(snapshot, `homeworld:${native.faction}`).includes(receipt.occupier),
    'Occupied Ecaz Duke qualification does not contain its original occupier.');
  }
}

/** The printed occupied card overrides native Ecaz/Moritani acquisition.
 * Provisional ordinary lifecycle: one recipient choice per turn/qualification,
 * one battle, no same-turn regrant, and no restoration of an earlier holder.
 * The user-selected Ecaz-only revival rule remains entirely separate. */
export function quoteHomeworldEcazDuke(g: HomeworldEcazDukeContext): HomeworldEcazDukeQuote {
  const none: HomeworldEcazDukeQuote = { event: null, owner: null, qualification: null,
    recipients: [], nativeAcquisitionBlocked: false, claimed: null, blocked: null };
  if (g.status !== 'playing' || !g.homeworldOccupationPreview || !g.players.some(p => p.faction === 'ecaz')) return none;
  requireGrant(Number.isSafeInteger(g.turn) && g.turn >= 1, 'Occupied Ecaz Duke needs the current positive turn.');
  const occupation = quoteStableHomeworldOccupation(g, 'ecaz');
  if (occupation.blocked) return { ...none, blocked: occupation.blocked };
  validateHomeworldEcazDukeGrants(g);
  const source = occupation.entitlement;
  if (!source) return none;
  const recipients = [source.occupier, ...(source.ally ? [source.ally] : [])];
  const claimed = g.homeworldEcazDukeGrants?.find(receipt =>
    receipt.turn === g.turn && receipt.qualification === source.qualification) ?? null;
  const quote: HomeworldEcazDukeQuote = {
    event: homeworldEcazDukeEvent(g.turn, source.qualification, source.occupier),
    owner: source.occupier, qualification: source.qualification, recipients,
    nativeAcquisitionBlocked: true, claimed: claimed ? { ...claimed } : null, blocked: null,
  };
  if (claimed) return { ...quote, blocked: 'Occupied Ecaz already chose its Duke recipient for this turn and qualification.' };
  const duke = g.dukeVidal;
  if (!duke) return { ...quote, blocked: unavailable };
  if (duke.leader.capturedBy || duke.leader.gholaBy || duke.leader.concealed || duke.captureVisibility)
    return { ...quote, blocked: pendingCustody };
  if (duke.leader.dead) return { ...quote, blocked: 'Occupied Ecaz grants no revival; only Ecaz may revive Duke Vidal.' };
  if (duke.leader.usedAt) return { ...quote, blocked: 'Duke Vidal has already been used in battle this turn.' };
  try {
    // Reuse the original living ordinary-disc/underlay validation. This quote
    // neither commits the provisional ally source nor changes the live disc.
    acquireDuke(duke, source.occupier, g.turn, 'ally');
  } catch {
    return { ...quote, blocked: unavailable };
  }
  return quote;
}

export function createHomeworldEcazDukeReceipt(g: HomeworldEcazDukeContext, actor: string,
  event: string, recipient: string): HomeworldEcazDukeReceipt {
  const quote = quoteHomeworldEcazDuke(g);
  requireGrant(quote.event && quote.qualification && quote.owner === actor && quote.event === event &&
    !quote.blocked && quote.recipients.includes(recipient),
  quote.blocked ?? 'Choose the current occupied Ecaz Duke recipient from the original offer.');
  return { turn: g.turn, qualification: quote.qualification, occupier: actor, recipient };
}

/** The original public tenure can outlive actual secret execution. Only its
 * public snapshot and qualification decide when that tenure ends. */
function homeworldDukeLifecycle(g: HomeworldEcazDukeContext, custodyBlocked: boolean): HomeworldEcazDukeLifecycleQuote {
  const none: HomeworldEcazDukeLifecycleQuote = { release: false, owner: null, reason: null, blocked: null };
  const duke = g.dukeVidal;
  if (!duke) return none;
  const tenure = duke.source === HOMEWORLD_ECAZ_DUKE_SOURCE ? duke :
    duke.captureVisibility?.source === HOMEWORLD_ECAZ_DUKE_SOURCE ? duke.captureVisibility : null;
  if (!tenure) return none;
  validateHomeworldEcazDukeGrants(g);
  const receipt = g.homeworldEcazDukeGrants?.findLast(receipt =>
    receipt.turn === tenure.acquiredTurn && receipt.recipient === tenure.controller);
  requireGrant(receipt && tenure.controller, 'The active occupied Ecaz Duke lost its original grant.');
  const own = { ...none, owner: tenure.controller };
  const release = (reason: NonNullable<HomeworldEcazDukeLifecycleQuote['reason']>): HomeworldEcazDukeLifecycleQuote =>
    ({ ...own, release: true, reason });
  const visibleLeader = duke.leader.concealed ?? duke.leader;
  if (visibleLeader.dead) return release('dead');
  if (visibleLeader.usedAt) return release('used');
  if (tenure.acquiredTurn !== g.turn) return release('turnEnded');
  const occupation = quoteStableHomeworldOccupation(g, 'ecaz');
  if (occupation.blocked) return { ...own, blocked: occupation.blocked };
  const source = occupation.entitlement;
  if (!source) return release('occupationEnded');
  if (source.qualification !== receipt.qualification || source.occupier !== receipt.occupier)
    return release('occupationChanged');
  if (tenure.controller !== source.occupier && tenure.controller !== source.ally) return release('recipientChanged');
  if (custodyBlocked && (duke.leader.capturedBy || duke.leader.gholaBy || duke.leader.concealed || duke.captureVisibility))
    return { ...own, blocked: pendingCustody };
  return own;
}

/** Call after original battle/arrival parents. Release retires only the lease;
 * it never frees a captured disc or changes a concealed public snapshot. */
export function quoteHomeworldEcazDukeLifecycle(g: HomeworldEcazDukeContext): HomeworldEcazDukeLifecycleQuote {
  return homeworldDukeLifecycle(g, true);
}

/** Recheck the original lease at the actual captive return, even when the
 * ordinary settled-boundary reconciliation is still waiting on its parent. */
export function releaseCapturedHomeworldDuke(g: HomeworldEcazDukeContext,
  captor: string, turn = g.turn): DukeState {
  requireGrant(g.dukeVidal, 'Choose the original captured Duke Vidal.');
  const current = turn === g.turn ? g : { ...g, turn };
  const lifecycle = homeworldDukeLifecycle(current, false);
  requireGrant(!lifecycle.blocked, lifecycle.blocked ?? 'Occupied Ecaz Duke lost its current qualification.');
  const state = lifecycle.release ? retireHomeworldDukeTenure(g.dukeVidal, turn) : g.dukeVidal;
  return releaseCapturedDuke(state, captor, turn);
}
