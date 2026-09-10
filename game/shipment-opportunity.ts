import type { Game, Player } from './engine';

/** Rule callers validate the saved record before using this allowance. The
 * original shipped flag remains history when Cunning grants another shipment. */
export function shipmentAvailable(
  g: Pick<Game, 'turn' | 'nexusGuildCunningHistory'>,
  p: Pick<Player, 'id' | 'shipped'>,
): boolean {
  const last = g.nexusGuildCunningHistory?.at(-1);
  const active = last && last.receipt.turn === g.turn && last.receipt.owner === p.id &&
    ['pending', 'secondShipment', 'extraMove'].includes(last.stage);
  return active ? last.stage === 'secondShipment' : !p.shipped;
}
