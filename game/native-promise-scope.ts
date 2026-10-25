import { FACTIONS } from './catalog';

export type NativePromiseScope = {
  advanced: boolean;
  expansions: readonly unknown[];
  players: readonly { faction: string }[];
  homeworlds?: unknown;
  nexusCards?: unknown;
  leaderSkills?: unknown;
  techTokens?: unknown;
  strongholdCards?: unknown;
  discoveryEnabled?: unknown;
  discoveries?: unknown;
  discoveryStash?: unknown;
  greatMaker?: unknown;
  ecazTreachery?: unknown;
};

/** Registered native factions with their selected decks. Optional modules
 * keep their separate promise envelopes; this never opens a game-start gate. */
export function nativePromiseScopeSupported(g: NativePromiseScope): boolean {
  return typeof g.advanced === 'boolean' && g.players.length >= 2 && g.players.length <= 6 &&
    g.expansions.every(id => typeof id === 'string' && ['ix','choam','ecaz'].includes(id)) &&
    new Set(g.expansions).size === g.expansions.length &&
    g.players.every(p => {
      const family = FACTIONS.find(f => f.id === p.faction)?.expansion;
      return family === 'base' || !!family && g.expansions.includes(family);
    }) && !g.homeworlds && !g.nexusCards && !g.leaderSkills && !g.techTokens &&
    !g.strongholdCards && !g.discoveryEnabled && !g.discoveries && !g.discoveryStash &&
    !g.greatMaker && !g.ecazTreachery;
}
