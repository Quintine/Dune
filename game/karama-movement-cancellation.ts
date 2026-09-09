import { validAmbassadorResume } from './ambassador-resume';
import { ambassadorPhaseAllowed } from './ambassador-phase';
import {
  validateGuildAmbassadorArrivalContext,
  GuildAmbassadorContinuationError,
} from './guild-ambassador-continuation';
import type { Game, ResponseWindow } from './engine';
import {
  gameTerritories,
  location,
  mobileRouteDistance,
  splitLocation,
  validLocation,
  MOBILE_STRONGHOLD,
} from './board';
import { presenceAt } from './force-presence';
import { validateAmbassadors } from './ecaz-ambassadors';
import {
  homeworldMobileStrongholdMovementBlock,
  homeworldSpiritualAdvisorLimit,
} from './homeworld-mobility';

export class MovementCancellationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MovementCancellationError';
  }
}
function requireContext(value: unknown, message: string): asserts value {
  if (!value) throw new MovementCancellationError(message);
}
const integer = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
type Move = NonNullable<Game['pendingIxMove']>;
export type MovementCancellationQuote =
  | { kind: 'guildTiming'; active: string }
  | {
      kind: 'ixMovement' | 'fremenMovement';
      player: string;
      turn: number;
      move: number;
    }
  | { kind: 'mobileStronghold'; successor: 'beginStormTurn' }
  | {
      kind: 'advisorFlip';
      successor:
        | 'none'
        | 'advisor'
        | 'advisorBattle'
        | 'movementTurn'
        | 'ambassador';
    };

function sectorKey(g: Game, value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const loc = splitLocation(value);
  return (
    location(loc.territory, loc.sector) === value &&
    validLocation(loc.territory, loc.sector) &&
    gameTerritories(g).some((t) => t.id === loc.territory)
  );
}
function territoryId(g: Game, value: unknown): value is string {
  return (
    typeof value === 'string' && gameTerritories(g).some((t) => t.id === value)
  );
}
function queue(g: Game) {
  const remaining = g.movementRemaining;
  requireContext(
    Array.isArray(remaining) &&
      remaining.length > 0 &&
      new Set(remaining).size === remaining.length &&
      remaining.every(
        (id) => typeof id === 'string' && g.players.some((p) => p.id === id),
      ),
    'The canceled movement timing needs its current remaining player queue.',
  );
  return remaining;
}
function movementDeclaration(
  g: Game,
  response: ResponseWindow,
  move: Move | null | undefined,
) {
  const owner = g.players.find((p) => p.id === response.owner)!;
  requireContext(
    g.phase === 5 &&
      g.active === owner.id &&
      integer(owner.moved) &&
      move &&
      move.player === owner.id &&
      sectorKey(g, location(move.to, move.sector)) &&
      territoryId(g, move.origin) &&
      response.location === location(move.to, move.sector) &&
      response.amount === move.total &&
      integer(move.total) &&
      move.total > 0 &&
      integer(move.elite) &&
      move.elite <= move.total &&
      typeof move.advisors === 'boolean' &&
      typeof move.wantsFighters === 'boolean' &&
      !move.ornithopterRange &&
      Array.isArray(move.group) &&
      record(move.eliteGroup),
    'The canceled movement no longer matches its owner and declaration.',
  );
  requireContext(
    move.group.every(
      (entry) =>
        Array.isArray(entry) &&
        entry.length === 2 &&
        sectorKey(g, entry[0]) &&
        splitLocation(entry[0]).territory === move.origin &&
        integer(entry[1]) &&
        entry[1] > 0,
    ) &&
      new Set(move.group.map(([key]) => key)).size === move.group.length &&
      Object.entries(move.eliteGroup).every(
        ([key, n]) =>
          integer(n) &&
          move.group.some(([source, count]) => source === key && n <= count),
      ) &&
      Object.values(move.eliteGroup).reduce((sum, n) => sum + n, 0) ===
        move.elite &&
      move.group.reduce((sum, [, n]) => sum + n, 0) + (move.noField ? 1 : 0) ===
        move.total,
    'The canceled movement has invalid declared physical groups.',
  );
  if (move.noField)
    requireContext(
      record(move.noField) &&
        typeof move.noField.tokenId === 'string' &&
        !!move.noField.tokenId &&
        typeof move.noField.event === 'string' &&
        !!move.noField.event &&
        sectorKey(g, move.noField.from) &&
        splitLocation(move.noField.from).territory === move.origin,
      'The canceled movement has an invalid declared No-Field marker.',
    );
  // No custody/route trial here: canceled Ix movement only sets a block and
  // keeps its forces in place. Fremen's pre-existing canonical order validator
  // must additionally run in the engine before either form spends its cost.
}

export type AmbassadorRelocationContext = Pick<
  Game,
  | 'status'
  | 'turn'
  | 'phase'
  | 'players'
  | 'pendingAmbassador'
  | 'ecazAmbassadors'
  | 'homeworlds'
  | 'homeworldRevivalReturn'
  | 'homeworldRevivalProgress'
  | 'homeworldVictoryReinforcement'
  | 'lastBattleContext'
>;

/** Historical receipt only: a child may already have changed alliances, forces
 * or marker custody. Never re-run the relocation or require surviving units. */
export function validateAmbassadorRelocationContext(
  g: AmbassadorRelocationContext,
  event: unknown,
  next: 'intrusion' | 'terror' | 'finish',
) {
  const entry = g.pendingAmbassador;
  const order = entry?.relocation?.order;
  requireContext(
    g.status === 'playing' &&
      integer(g.turn) &&
      g.turn > 0 &&
      ambassadorPhaseAllowed(g) &&
      Array.isArray(g.players) &&
      new Set(g.players.map((p) => p.id)).size === g.players.length &&
      entry &&
      entry.stage === 'arrival' &&
      entry.effect === 'fremen' &&
      entry.turn === g.turn &&
      entry.phase === g.phase &&
      typeof event === 'string' &&
      event.length > 0 &&
      entry.event === event &&
      ['intrusion', 'terror', 'finish'].includes(next) &&
      entry.relocation?.next === next &&
      order &&
      g.players.filter((p) => p.faction === 'ecaz').length === 1 &&
      g.players.find((p) => p.id === entry.owner)?.faction === 'ecaz' &&
      g.players.some((p) => p.id === entry.entrant) &&
      g.players.some((p) => p.id === entry.beneficiary) &&
      entry.entrant !== entry.owner &&
      entry.entrant !== entry.beneficiary &&
      order.player === entry.beneficiary &&
      validLocation(entry.territory, entry.sector) &&
      validAmbassadorResume(g, entry),
    'The canceled arrival has no matching completed Ambassador relocation.',
  );
  requireContext(g.ecazAmbassadors, 'The arrival has no Ambassador inventory.');
  try {
    validateAmbassadors(g.ecazAmbassadors);
  } catch {
    throw new MovementCancellationError(
      'The arrival has invalid Ambassador token custody.',
    );
  }
  const token = g.ecazAmbassadors.tokens.find((t) => t.id === entry.token);
  requireContext(
    token &&
      g.players.find((p) => p.id === entry.entrant)?.faction !== token.effect &&
      ((token.effect === 'fremen' && token.zone === 'used') ||
        (token.effect === 'beneGesserit' &&
          token.zone === 'removed' &&
          Array.isArray(entry.copyChoices) &&
          entry.copyChoices.includes('fremen'))),
    'The arrival does not belong to its consumed Fremen Ambassador effect.',
  );
  const key = (value: unknown): value is string => {
    if (typeof value !== 'string') return false;
    const source = splitLocation(value);
    return (
      location(source.territory, source.sector) === value &&
      validLocation(source.territory, source.sector)
    );
  };
  requireContext(
    typeof order.origin === 'string' &&
      typeof order.to === 'string' &&
      integer(order.sector) &&
      validLocation(order.to, order.sector) &&
      integer(order.total) &&
      order.total > 0 &&
      integer(order.elite) &&
      order.elite <= order.total &&
      typeof order.advisors === 'boolean' &&
      typeof order.wantsFighters === 'boolean' &&
      (!order.wantsFighters || order.advisors) &&
      (order.lockedTurn === undefined || integer(order.lockedTurn)) &&
      Array.isArray(order.group) &&
      record(order.eliteGroup) &&
      order.group.every(
        (part) =>
          Array.isArray(part) &&
          part.length === 2 &&
          key(part[0]) &&
          splitLocation(part[0]).territory === order.origin &&
          part[0] !== location(order.to, order.sector) &&
          integer(part[1]) &&
          part[1] > 0,
      ) &&
      new Set(order.group.map(([source]) => source)).size ===
        order.group.length &&
      Object.entries(order.eliteGroup).every(
        ([source, n]) =>
          integer(n) &&
          order.group.some(([k, amount]) => source === k && n <= amount),
      ) &&
      Object.values(order.eliteGroup).reduce((sum, n) => sum + n, 0) ===
        order.elite &&
      order.group.reduce((sum, [, n]) => sum + n, 0) +
        (order.noField ? 1 : 0) ===
        order.total,
    'The completed Ambassador relocation has invalid typed force groups.',
  );
  if (order.noField)
    requireContext(
      record(order.noField) &&
        g.players.find((p) => p.id === order.player)?.faction === 'richese' &&
        typeof order.noField.tokenId === 'string' &&
        !!order.noField.tokenId &&
        typeof order.noField.event === 'string' &&
        !!order.noField.event &&
        key(order.noField.from) &&
        splitLocation(order.noField.from).territory === order.origin &&
        order.noField.from !== location(order.to, order.sector),
      'The completed Ambassador relocation has an invalid historical marker.',
    );
  return order;
}

/** Pure cancellation prerequisites, never a movement or random-effect preview.
 * A null result explicitly leaves advisor worm-ride/phase-ending continuations
 * outside this bounded proof. Future advisor decisions are not pre-accepted. */
export function quoteMovementCancellation(
  g: Game,
  response: ResponseWindow,
): MovementCancellationQuote | null {
  if (
    ![
      'guildTiming',
      'mobileStronghold',
      'ixMovement',
      'fremenMovement',
      'advisorFlip',
    ].includes(response.kind)
  )
    return null;
  requireContext(
    g.status === 'playing' &&
      integer(g.turn) &&
      g.turn > 0 &&
      Array.isArray(g.players),
    'This movement cancellation has no current game context.',
  );
  const owner = g.players.find((p) => p.id === response.owner);
  requireContext(owner, 'This movement cancellation has no seated owner.');
  if (response.kind === 'guildTiming') {
    const remaining = queue(g);
    requireContext(
      g.advanced &&
        g.phase === 5 &&
        owner.faction === 'guild' &&
        g.active === null &&
        !g.guildTimingLocked &&
        !g.guildTimingGranted &&
        remaining.includes(owner.id) &&
        typeof response.take === 'boolean' &&
        response.take !== (remaining[0] === owner.id) &&
        owner.id !== g.saphoMovementLast?.player &&
        remaining.some(
          (id) => id !== owner.id && id !== g.saphoMovementLast?.player,
        ),
      'This Guild timing cancellation no longer matches its pending out-of-order choice.',
    );
    return { kind: 'guildTiming', active: remaining[0] };
  }
  if (response.kind === 'ixMovement' || response.kind === 'fremenMovement') {
    requireContext(
      owner.faction === (response.kind === 'ixMovement' ? 'ixians' : 'fremen'),
      'This faction does not own the canceled movement advantage.',
    );
    const pending = g.pendingFremenMove;
    const move =
      response.kind === 'ixMovement' ? g.pendingIxMove : pending?.order;
    movementDeclaration(g, response, move);
    if (response.kind === 'ixMovement')
      requireContext(
        move!.elite > 0 && response.elite === move!.elite,
        'The canceled cyborg movement does not match its declared elite group.',
      );
    else
      requireContext(
        pending && pending.turn === g.turn && pending.move === owner.moved,
        'This Fremen movement cancellation no longer matches its turn and move.',
      );
    return {
      kind: response.kind,
      player: owner.id,
      turn: g.turn,
      move: owner.moved,
    };
  }
  if (response.kind === 'mobileStronghold') {
    const blocked = homeworldMobileStrongholdMovementBlock(g, owner.id);
    requireContext(!blocked, blocked ?? 'This stronghold cannot move.');
    const pending = g.pendingMobileMove;
    requireContext(
      g.phase === 0 &&
        g.turn > 1 &&
        owner.faction === 'ixians' &&
        pending &&
        pending.player === owner.id &&
        typeof pending.collect === 'boolean' &&
        Array.isArray(pending.route) &&
        pending.route.length > 1 &&
        pending.route.every((key) => sectorKey(g, key)) &&
        pending.route[0] === g.mobileStronghold?.location &&
        response.location === pending.route.at(-1) &&
        mobileRouteDistance(pending.route) <= 3 &&
        gameTerritories(g).find(
          (t) => t.id === splitLocation(pending.route.at(-1)!).territory,
        )?.type !== 'stronghold' &&
        presenceAt(owner, MOBILE_STRONGHOLD) > 0,
      'This canceled mobile stronghold move has no matching original route and owner.',
    );
    // beginStormTurn clears per-turn uses and reads the old battle dialers. A
    // missing Fremen storm card deliberately remains the real future shuffle.
    requireContext(
      Array.isArray(g.lastBattle) &&
        g.lastBattle.every((id) => g.players.some((p) => p.id === id)) &&
        (g.stormCard == null ||
          (integer(g.stormCard) && g.stormCard >= 1 && g.stormCard <= 6)) &&
        g.players.every(
          (p) =>
            Array.isArray(p.leaders) &&
            p.leaders.every(
              (l) =>
                record(l) && (l.concealed === undefined || record(l.concealed)),
            ) &&
            (!p.elites || record(p.elites)) &&
            (!p.kwisatz || record(p.kwisatz)),
        ) &&
        (!g.dukeVidal || record(g.dukeVidal.leader)),
      'The canceled mobile move cannot safely begin its pending storm turn.',
    );
    return { kind: 'mobileStronghold', successor: 'beginStormTurn' };
  }
  requireContext(
    g.advanced &&
      owner.faction === 'beneGesserit' &&
      territoryId(g, response.location) &&
      typeof response.advisors === 'boolean' &&
      (response.advisorResume === undefined ||
        response.advisorResume === 'declaration' ||
        response.advisorResume === 'wormRide' ||
        response.advisorResume === 'ambassador'),
    'This advisor cancellation has no valid owner, territory or continuation.',
  );
  if (response.advisorResume === 'ambassador') {
    if (g.pendingAmbassador?.effect === 'guild') {
      try {
        const { order } = validateGuildAmbassadorArrivalContext(
          g,
          response.advisorAmbassadorEvent,
          'terror',
        );
        requireContext(
          response.advisors === true &&
            owner.id !== order.player &&
            response.location === order.territory &&
            response.advisorFollowup === undefined &&
            response.advisorRemaining === undefined,
          'The canceled Intrusion does not match its Guild Ambassador shipment.',
        );
      } catch (error) {
        if (error instanceof GuildAmbassadorContinuationError)
          throw new MovementCancellationError(error.message);
        throw error;
      }
      return { kind: 'advisorFlip', successor: 'ambassador' };
    }
    const order = validateAmbassadorRelocationContext(
      g,
      response.advisorAmbassadorEvent,
      response.advisors ? 'terror' : 'intrusion',
    );
    requireContext(
      response.location === order.to &&
        order.origin !== order.to &&
        response.advisorFollowup === undefined &&
        response.advisorRemaining === undefined &&
        (response.advisors
          ? owner.id !== order.player
          : owner.id === order.player && order.advisors && order.wantsFighters),
      'The canceled advisor change does not match its Ambassador arrival.',
    );
    return { kind: 'advisorFlip', successor: 'ambassador' };
  }
  requireContext(
    response.advisorAmbassadorEvent === undefined,
    'Only an Ambassador arrival may carry its event.',
  );
  if (response.advisorResume === 'wormRide') return null;
  requireContext(
    g.phase === 5,
    'This advisor cancellation is outside its shipment and movement phase.',
  );
  if (response.advisorFollowup) {
    requireContext(
      response.advisorResume === undefined &&
        response.advisors &&
        record(response.advisorFollowup) &&
        typeof response.advisorFollowup.shipment === 'string' &&
        g.players.some((p) => p.id === response.advisorFollowup!.shipment) &&
        sectorKey(g, response.advisorFollowup.destination) &&
        integer(owner.reserves),
      'The canceled advisor change has an invalid accompanying-shipment continuation.',
    );
    return {
      kind: 'advisorFlip',
      successor:
        homeworldSpiritualAdvisorLimit(g, owner.id, 'polar_sink') > 0
          ? 'advisor'
          : 'none',
    };
  }
  if (response.advisorResume === 'declaration') {
    requireContext(
      !response.advisors &&
        Array.isArray(response.advisorRemaining) &&
        new Set(response.advisorRemaining).size ===
          response.advisorRemaining.length &&
        response.advisorRemaining.every(
          (t) => territoryId(g, t) && t !== response.location,
        ),
      'The canceled advisor declaration has an invalid remaining territory list.',
    );
    if (response.advisorRemaining.length)
      return { kind: 'advisorFlip', successor: 'advisorBattle' };
    // An empty queue can enter battle/phase completion; do not claim that wider
    // chain here. Ordinary phase-opening advisor declarations have a queue.
    if (Array.isArray(g.movementRemaining) && !g.movementRemaining.length)
      return null;
    queue(g);
    return { kind: 'advisorFlip', successor: 'movementTurn' };
  }
  requireContext(
    response.advisorRemaining === undefined,
    'A direct advisor change has no remaining declaration list.',
  );
  return { kind: 'advisorFlip', successor: 'none' };
}
