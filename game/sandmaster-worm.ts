import type { Game, GameView } from './engine';
import { splitLocation, validGameLocation } from './board';
import { faction } from './catalog';
import { basicExpansionLeaderSkillsProfile } from './leader-skill-profile';
import { sandmasterLeader, sandmasterModeSupported } from './sandmaster-movement';

export type SandmasterWormCollection = {
  leader: string;
  key: string | null;
  before: number;
  blocked: string | null;
};

/** A worm ride names a destination, not a traversed ground route. */
export function sandmasterWormCollection(
  game: Game | GameView,
  player: string,
  destination: string,
  sector: number,
  decision: Game['decision'] | GameView['decision'] = game.decision,
): SandmasterWormCollection | null {
  const leader = sandmasterLeader(game, player);
  if (!leader || game.phase !== 1 || decision?.kind !== 'wormRide' ||
      decision.player !== player ||
      game.players.find(p => p.id === player)?.faction !== 'fremen') return null;
  const blocked = (reason: string): SandmasterWormCollection =>
    ({ leader, key: null, before: 0, blocked: reason });
  if (!sandmasterModeSupported(game) || game.ecazTreachery ||
      !(basicExpansionLeaderSkillsProfile(game) ||
        game.players.every(p => faction(p.faction).expansion === 'base')))
    return blocked('Sandmaster worm collection with other optional modules is still being integrated.');
  if (destination === decision.territory ||
      !validGameLocation(game, destination, sector) || sector === game.storm)
    return blocked('Choose a different legal destination for the worm ride.');
  const piles = Object.entries(game.spice)
    .filter(([key]) => splitLocation(key).territory === destination);
  if (piles.some(([key, amount]) => {
    const at = splitLocation(key);
    return !validGameLocation(game, at.territory, at.sector) ||
      key !== `${at.territory}:${at.sector}` || !Number.isSafeInteger(amount) || amount < 0;
  })) return blocked('Sandmaster needs a valid destination spice pile.');
  const positive = piles.filter(([, amount]) => amount > 0);
  if (positive.length > 1)
    return blocked('Sandmaster collection among multiple spice piles awaits its allocation ruling.');
  if (!positive.length) return blocked('There is no spice to collect at this destination.');
  const [key, before] = positive[0];
  const spice = game.players.find(p => p.id === player)?.spice;
  if (!Number.isSafeInteger(spice) || !Number.isSafeInteger(spice! + 1))
    return blocked('Sandmaster collection needs a valid spice balance.');
  return { leader, key, before, blocked: null };
}
