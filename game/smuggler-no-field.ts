import type { Game, GameView } from './engine';
import { quoteSmugglerShipment } from './smuggler-shipment';

/** The No-Field remains the priced marker; this is one separate physical force. */
export type SmugglerNoFieldCompanion = { leader: string; amount: 1 };

export function smugglerNoFieldModeSupported(g: Game | GameView): boolean {
  return (
    g.expansions.length === 1 &&
    g.expansions[0] === 'choam' &&
    !g.homeworlds &&
    !g.nexusCards &&
    !g.discoveries &&
    !('discoveryEnabled' in g && g.discoveryEnabled) &&
    !g.strongholdCards &&
    !g.techTokens
  );
}

/** Public custody only: the hidden token value never affects this free companion. */
export function quoteSmugglerNoField(
  g: Game | GameView,
  player: string,
  destination: string,
): SmugglerNoFieldCompanion | null {
  const p = g.players.find((p) => p.id === player);
  if (
    !p ||
    p.faction !== 'richese' ||
    p.reserves < 1 ||
    !Number.isSafeInteger(p.reserves) ||
    !smugglerNoFieldModeSupported(g)
  )
    return null;
  // Reuse the normal band's living/native/face-up/whole-territory emptiness checks.
  // Two denotes one priced marker with one free companion, not a reserve withdrawal of two.
  const skill = quoteSmugglerShipment(g, player, destination, 2);
  return skill ? { leader: skill.leader, amount: 1 } : null;
}
