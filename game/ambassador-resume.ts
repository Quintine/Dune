import type { Game } from './engine';
import { validLocation } from './board';

/** Original source witness retained when completed Guild accompaniment opens
 * another Ambassador, so its final suffix can resume the original worm rider. */
export type AmbassadorResumeEntry = {
  event: string;
  entrant: string;
  territory: string;
  sector: number;
  resume: 'none' | 'wormRide';
  wormRider?: string;
  guildAdvisorOrigin?: {
    event: string;
    player: string;
    territory: string;
    sector: number;
  };
};
type ResumeGame = Pick<Game, 'phase' | 'players'>;
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const boardLocation = (name: unknown, sector: unknown): name is string =>
  id(name) &&
  Number.isSafeInteger(sector) &&
  validLocation(name, sector as number);

/** Structural historical provenance only. Does not replay entry, inspect private
 * values, require old alliances/forces, or select a new worm destination. */
export function validAmbassadorResume(
  g: ResumeGame,
  entry: AmbassadorResumeEntry,
): boolean {
  if (!record(entry) || !Array.isArray(g.players)) return false;
  const matches = (player: unknown) =>
    id(player) ? g.players.filter((p) => p.id === player) : [];
  const entrants = matches(entry.entrant);
  if (entrants.length !== 1) return false;
  const entrant = entrants[0];
  const origin = entry.guildAdvisorOrigin;
  if (origin !== undefined) {
    if (
      !record(origin) ||
      entrant.faction !== 'beneGesserit' ||
      !id(entry.event) ||
      !id(origin.event) ||
      origin.event === entry.event ||
      !boardLocation(origin.territory, origin.sector) ||
      !boardLocation(entry.territory, entry.sector) ||
      !(
        entry.territory === origin.territory ||
        (entry.territory === 'polar_sink' && entry.sector === 0)
      )
    )
      return false;
    const shippers = matches(origin.player);
    if (
      shippers.length !== 1 ||
      shippers[0].id === entrant.id ||
      shippers[0].faction === 'beneGesserit' ||
      shippers[0].faction === 'fremen'
    )
      return false;
  }
  if (entry.resume === 'none') return entry.wormRider === undefined;
  if (entry.resume !== 'wormRide' || g.phase !== 1) return false;
  const riders = matches(
    entry.wormRider === undefined ? entrant.id : entry.wormRider,
  );
  if (riders.length !== 1 || riders[0].faction !== 'fremen') return false;
  return (
    riders[0].id === entrant.id ||
    (entrant.faction === 'beneGesserit' &&
      origin !== undefined &&
      id(entry.wormRider))
  );
}
