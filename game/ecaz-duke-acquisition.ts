import type { Game } from './engine';
import type { FactionId } from './catalog';
import { acquireDuke, DUKE_VIDAL_ID, type DukeState } from './duke-vidal';

export type EcazDukeContext = {
  status: Game['status'];
  turn: number;
  advanced: boolean;
  players: readonly { id: string; faction: FactionId }[];
  dukeVidal?: DukeState;
};
type Failure = 'context' | 'custody' | 'table' | 'alreadyControlled';
export class EcazDukeAcquisitionError extends Error {
  constructor(
    message: string,
    readonly reason: Failure = 'custody',
  ) {
    super(message);
    this.name = 'EcazDukeAcquisitionError';
  }
}
function requireDuke(
  condition: unknown,
  message: string,
  reason: Failure = 'custody',
): asserts condition {
  if (!condition) throw new EcazDukeAcquisitionError(message, reason);
}
const whole = (n: unknown): n is number =>
  Number.isSafeInteger(n) && (n as number) >= 0;
const tableBlock =
  'Duke Vidal acquisition with Advanced Harkonnen is still being implemented.';
const alreadyBlock =
  'Acquiring Duke Vidal when Ecaz already controls him is still being implemented.';
const unavailable = 'Duke Vidal is unavailable for this acquisition.';

/** Direct Ecaz self-acquisition only. The caller owns the actual entry event,
 * physical Ambassador and explicit choice; this quote never creates a disc,
 * commits the token, grants an ally loan, or changes leader battle eligibility. */
export function quoteEcazDukeAcquisition(
  g: EcazDukeContext,
  ownerId: string,
): DukeState {
  requireDuke(
    g.status === 'playing' &&
      whole(g.turn) &&
      g.turn > 0 &&
      typeof g.advanced === 'boolean' &&
      Array.isArray(g.players) &&
      new Set(g.players.map((p) => p.id)).size === g.players.length &&
      g.players.filter((p) => p.id === ownerId && p.faction === 'ecaz')
        .length === 1,
    'This acquisition needs the current seated Ecaz owner.',
    'context',
  );
  requireDuke(
    !(g.advanced && g.players.some((p) => p.faction === 'harkonnen')),
    tableBlock,
    'table',
  );
  const duke = g.dukeVidal;
  requireDuke(
    duke &&
      typeof duke === 'object' &&
      !Array.isArray(duke) &&
      duke.leader &&
      typeof duke.leader === 'object' &&
      !Array.isArray(duke.leader) &&
      duke.leader.id === DUKE_VIDAL_ID &&
      duke.leader.faction === 'ecaz' &&
      duke.leader.strength === 6 &&
      typeof duke.leader.name === 'string' &&
      duke.leader.name.length > 0 &&
      typeof duke.leader.dead === 'boolean' &&
      whole(duke.leader.deaths),
    'The shared Duke Vidal disc has invalid physical identity or history.',
  );
  requireDuke(
    !duke.leader.concealed,
    'Duke Vidal cannot be acquired from unresolved concealed custody.',
  );
  // This explicit unfinished case is public controller information. Check it
  // before private capture/ghola details so its projected reason cannot vary
  // with an undisclosed custody marker.
  requireDuke(duke.controller !== ownerId, alreadyBlock, 'alreadyControlled');
  requireDuke(
    duke.controller === null
      ? duke.acquiredTurn === null && duke.source === null
      : g.players.some((p) => p.id === duke.controller) &&
          whole(duke.acquiredTurn) &&
          duke.acquiredTurn > 0 &&
          duke.acquiredTurn <= g.turn &&
          ['ecaz', 'moritani', 'ally'].includes(duke.source!),
    'The shared Duke Vidal disc has invalid current custody.',
  );
  requireDuke(
    !duke.leader.dead && !duke.leader.capturedBy && !duke.leader.gholaBy,
    'Duke Vidal cannot be acquired from dead, captured or ghola custody.',
  );
  // acquireDuke clones every existing leader field, including usedAt and death
  // history; retaining those fields does not permit a second battle use.
  return acquireDuke(duke, ownerId, g.turn, 'ecaz');
}
/** An owner-offer descriptor may be publicly compared. Exceptional custody
 * never produces a distinct reason that discloses a hidden captured/ghola ID. */
export function ecazDukeAcquisitionBlock(
  g: EcazDukeContext,
  ownerId: string,
): string | null {
  try {
    quoteEcazDukeAcquisition(g, ownerId);
    return null;
  } catch (error) {
    if (error instanceof EcazDukeAcquisitionError) {
      if (error.reason === 'table') return tableBlock;
      if (error.reason === 'alreadyControlled') return alreadyBlock;
    }
    return unavailable;
  }
}
