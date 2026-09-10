import type { Game, ResponseWindow } from './engine';
import { TERRITORIES } from './board';
import {
  blockAmbassadorPlacement,
  type AmbassadorState,
} from './ecaz-ambassadors';
import {
  TERROR_KINDS,
  TERROR_STRONGHOLDS,
  type TerrorState,
} from './moritani-terror';
import { DUKE_VIDAL_ID } from './duke-vidal';

export class PlacementCancellationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlacementCancellationError';
  }
}
function requirePlacement(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new PlacementCancellationError(message);
}
const whole = (n: unknown): n is number =>
  Number.isSafeInteger(n) && (n as number) >= 0;
export type PlacementCancellationContext = Pick<
  Game,
  | 'status'
  | 'phase'
  | 'turn'
  | 'players'
  | 'pendingEcazPlacement'
  | 'ecazPlacementTurn'
  | 'ecazAmbassadors'
  | 'pendingMoritaniPlacement'
  | 'moritaniTerror'
  | 'dukeVidal'
  | 'dukeAcquisitionTurn'
  | 'movementRemaining'
>;
export type PlacementCancellationQuote =
  | {
      kind: 'ecazPlacement';
      ambassadors: AmbassadorState;
      completedTurn: number;
      suffix: 'completePhase';
    }
  | {
      kind: 'moritaniPlacement';
      terror: TerrorState;
      suffix: 'finishMoritaniPlacement';
    }
  | { kind: 'moritaniDuke'; suffix: 'nextPhase' };
/** Source and denied receipt only. The engine composes the explicit suffix with
 * movement, victory or phase-boundary quotes; none runs in this function. */
export function quotePlacementCancellation(
  g: PlacementCancellationContext,
  response: Pick<ResponseWindow, 'kind' | 'owner'>,
): PlacementCancellationQuote | null {
  if (
    !['ecazPlacement', 'moritaniPlacement', 'moritaniDuke'].includes(
      response.kind,
    )
  )
    return null;
  const owner = g.players.find((p) => p.id === response.owner);
  requirePlacement(
    g.status === 'playing' &&
      whole(g.turn) &&
      g.turn > 0 &&
      owner &&
      g.players.filter((p) => p.id === response.owner).length === 1 &&
      owner.faction ===
        (response.kind === 'ecazPlacement' ? 'ecaz' : 'moritani'),
    'This placement cancellation has no current faction owner.',
  );
  if (response.kind === 'ecazPlacement') {
    const pending = g.pendingEcazPlacement,
      state = g.ecazAmbassadors;
    requirePlacement(
      g.phase === 4 &&
        pending &&
        pending.turn === g.turn &&
        g.ecazPlacementTurn !== g.turn &&
        state &&
        Array.isArray(state.tokens) &&
        Array.isArray(state.cohort) &&
        state.tokens.filter((t) => t.id === pending.token).length === 1 &&
        TERRITORIES.some(
          (t) => t.id === pending.territory && t.type === 'stronghold',
        ) &&
        whole(pending.cost) &&
        pending.cost > 0,
      'No current physical Ambassador placement is awaiting cancellation.',
    );
    let ambassadors: AmbassadorState;
    try {
      ambassadors = blockAmbassadorPlacement(state, g.turn);
    } catch (error) {
      throw new PlacementCancellationError(
        error instanceof Error
          ? error.message
          : 'Invalid Ambassador inventory.',
      );
    }
    requirePlacement(
      state.placement?.turn !== g.turn || !state.placement.blocked,
      'The current Ambassador placement opportunity is already blocked.',
    );
    requirePlacement(
      pending.cost ===
        (state.placement?.turn === g.turn ? state.placement.count : 0) + 1,
      'The declared Ambassador placement price has no current placement receipt.',
    );
    return {
      kind: 'ecazPlacement',
      ambassadors,
      completedTurn: g.turn,
      suffix: 'completePhase',
    };
  }
  if (response.kind === 'moritaniPlacement') {
    const pending = g.pendingMoritaniPlacement,
      state = g.moritaniTerror;
    requirePlacement(
      g.phase === 8 &&
        pending &&
        pending.turn === g.turn &&
        state &&
        Array.isArray(state.tokens) &&
        (state.placementTurn === undefined ||
          (whole(state.placementTurn) && state.placementTurn < g.turn)) &&
        (state.supplyEpoch === undefined || whole(state.supplyEpoch)) &&
        state.tokens.length === 6 &&
        new Set(state.tokens.map((t) => t.id)).size === 6 &&
        new Set(state.tokens.map((t) => t.kind)).size === 6 &&
        state.tokens.every(
          (t) =>
            typeof t.id === 'string' &&
            !!t.id &&
            TERROR_KINDS.includes(t.kind) &&
            ['available', 'placed', 'removed', 'extortion'].includes(
              t.status,
            ) &&
            (t.status === 'placed'
              ? typeof t.location === 'string' &&
                TERROR_STRONGHOLDS.includes(t.location)
              : t.location === null) &&
            (t.status !== 'extortion' || t.kind === 'extortion'),
        ) &&
        state.tokens.filter((t) => t.id === pending.token).length === 1 &&
        TERROR_STRONGHOLDS.includes(pending.territory),
      'No current physical Terror placement is awaiting cancellation.',
    );
    // Grumman may have created legal stacks earlier. Denial validates physical
    // custody and the pending source receipt, not whether that placement could
    // still succeed: no token moves, even if its source or target has changed.
    return {
      kind: 'moritaniPlacement',
      terror: {
        ...state,
        tokens: state.tokens.map((t) => ({ ...t })),
        placementTurn: g.turn,
      },
      suffix: 'finishMoritaniPlacement',
    };
  }
  const duke = g.dukeVidal;
  requirePlacement(
    g.phase === 5 &&
      g.dukeAcquisitionTurn === g.turn &&
      Array.isArray(g.movementRemaining) &&
      g.movementRemaining.length === 0 &&
      duke &&
      duke.leader &&
      duke.leader.id === DUKE_VIDAL_ID &&
      duke.leader.faction === 'ecaz' &&
      duke.leader.strength === 6 &&
      typeof duke.leader.dead === 'boolean' &&
      whole(duke.leader.deaths) &&
      g.players.every((p) => !p.leaders.some((l) => l.id === DUKE_VIDAL_ID)) &&
      (duke.controller === null
        ? duke.acquiredTurn === null && duke.source === null
        : g.players.some((p) => p.id === duke.controller) &&
          whole(duke.acquiredTurn) &&
          duke.acquiredTurn > 0 &&
          duke.acquiredTurn <= g.turn &&
          ['ecaz', 'moritani', 'ally'].includes(duke.source!)) &&
      [duke.leader.capturedBy, duke.leader.gholaBy].every(
        (id) => id === undefined || g.players.some((p) => p.id === id),
      ),
    'This Duke Vidal denial has no current movement completion or shared-disc custody.',
  );
  return { kind: 'moritaniDuke', suffix: 'nextPhase' };
}
