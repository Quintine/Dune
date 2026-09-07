import type { Game, Player, ResponseWindow } from './engine';
import { MOBILE_STRONGHOLD, validLocation } from './board';
import { validateRicheseNoField } from './richese-no-field';

export class NoFieldCancellationError extends Error {}
export type NoFieldCancellationContext = Pick<
  Game,
  | 'status'
  | 'phase'
  | 'turn'
  | 'active'
  | 'pendingShipment'
  | 'richeseAllyOffer'
  | 'richeseAllyOpportunity'
  | 'richeseAllyBlocked'
> & {
  players: readonly Pick<
    Player,
    | 'id'
    | 'faction'
    | 'ally'
    | 'shipped'
    | 'noField'
    | 'noFieldEvent'
    | 'noFieldBlockedTurn'
  >[];
};
export type NoFieldCancellation =
  | { kind: 'own'; player: string; blockedTurn: number; pendingShipment: null }
  | {
      kind: 'allied';
      owner: string;
      player: string;
      blocked: { turn: number; recipient: string };
      pendingShipment: null;
    };
function requireDeclaration(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new NoFieldCancellationError(message);
}
const identity = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const whole = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

/** Quote only the denied declaration. Cancellation neither ships nor reveals:
 * no rate, balance, reserves, route, capacity or repeat-token availability is read.
 * The token's private identity is consumed as evidence, never returned. */
export function quoteNoFieldCancellation(
  g: NoFieldCancellationContext,
  response: ResponseWindow,
): NoFieldCancellation {
  const shipment = g.pendingShipment;
  const owner = g.players.find((p) => p.id === response.owner);
  const controller = g.players.find((p) => p.id === shipment?.player);
  requireDeclaration(
    response.kind === 'richeseNoField' &&
      g.status === 'playing' &&
      g.phase === 5 &&
      whole(g.turn) &&
      g.turn > 0 &&
      owner?.faction === 'richese' &&
      controller &&
      g.active === controller.id &&
      !controller.shipped &&
      shipment &&
      (shipment.turn === undefined || shipment.turn === g.turn),
    'The canceled No-Field needs its original unused shipment opportunity.',
  );
  requireDeclaration(
    !!shipment.noField !== !!shipment.alliedNoField,
    'The canceled No-Field needs exactly one own or allied declaration.',
  );
  requireDeclaration(
    shipment.territory !== MOBILE_STRONGHOLD &&
      validLocation(shipment.territory, shipment.sector) &&
      whole(shipment.amount) &&
      shipment.amount <= 5 &&
      whole(shipment.elite) &&
      shipment.elite <= shipment.amount &&
      typeof shipment.advisors === 'boolean',
    'The canceled No-Field needs a valid declared destination and force type.',
  );
  requireDeclaration(
    owner.noField && identity(owner.noFieldEvent),
    'The canceled No-Field needs its physical token inventory and selection event.',
  );
  try {
    validateRicheseNoField(owner.noField);
  } catch (error) {
    throw new NoFieldCancellationError(
      error instanceof Error ? error.message : 'Invalid No-Field inventory.',
    );
  }
  const own = shipment.noField;
  if (own) {
    requireDeclaration(
      controller.id === owner.id &&
        shipment.amount === 1 &&
        shipment.elite === 0 &&
        identity(own.tokenId) &&
        own.event === owner.noFieldEvent &&
        owner.noField.tokens.some((token) => token.id === own.tokenId) &&
        owner.noFieldBlockedTurn !== g.turn,
      'The canceled own No-Field declaration is stale or already blocked.',
    );
    return {
      kind: 'own',
      player: owner.id,
      blockedTurn: g.turn,
      pendingShipment: null,
    };
  }
  const offer = shipment.alliedNoField!;
  requireDeclaration(
    controller.id !== owner.id &&
      offer.owner === owner.id &&
      offer.recipient === controller.id &&
      owner.ally === controller.id &&
      controller.ally === owner.id &&
      identity(offer.event) &&
      identity(offer.tokenId) &&
      offer.tokenEvent === owner.noFieldEvent &&
      owner.noField.tokens.some((token) => token.id === offer.tokenId) &&
      offer.territory === shipment.territory &&
      offer.sector === shipment.sector &&
      [owner.id, controller.id, 'both'].includes(offer.payer) &&
      g.richeseAllyOpportunity?.turn === g.turn &&
      g.richeseAllyOpportunity.recipient === controller.id &&
      !g.richeseAllyOffer &&
      !(
        g.richeseAllyBlocked?.turn === g.turn &&
        g.richeseAllyBlocked.recipient === controller.id
      ),
    'The canceled allied No-Field needs its accepted token offer and recipient.',
  );
  return {
    kind: 'allied',
    owner: owner.id,
    player: controller.id,
    blocked: { turn: g.turn, recipient: controller.id },
    pendingShipment: null,
  };
}
