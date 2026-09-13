/** A current-turn promise about the player's ordinary physical shipment from reserves. */
export type ShipmentClaim = { territory: string; minimum: number };
/** Software readiness boundary; this is not a printed restriction on Truthtrance. */
export function shipmentPromiseModeSupported(game: {
  advanced: boolean;
  expansions: readonly unknown[];
  players: readonly { faction: string }[];
  techTokens?: unknown;
  strongholdCards?: unknown;
  nexusCards?: unknown;
  homeworlds?: unknown;
}): boolean {
  return (
    !game.expansions.length &&
    (!game.advanced ||
      (!game.players.some((player) => player.faction === 'guild') &&
        !game.techTokens &&
        !game.strongholdCards &&
        !game.nexusCards &&
        !game.homeworlds))
  );
}
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
