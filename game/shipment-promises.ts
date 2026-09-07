/** A current-turn promise about the player's ordinary physical shipment from reserves. */
export type ShipmentClaim = { territory: string; minimum: number };
export type ShipmentPromise = ShipmentClaim & {
  turn: number;
  player: string;
  asker: string;
  answer: boolean;
  released?: boolean;
  fulfilled?: boolean;
};
export function matchesShipment(
  claim: ShipmentClaim,
  shipment: { territory: string; amount: number } | null,
): boolean {
  return (
    !!shipment &&
    shipment.territory === claim.territory &&
    shipment.amount >= claim.minimum
  );
}
export function liveShipmentPromises(
  promises: readonly ShipmentPromise[],
  player: string,
  turn: number,
): ShipmentPromise[] {
  return promises.filter(
    (p) =>
      p.player === player && p.turn === turn && !p.released && !p.fulfilled,
  );
}
