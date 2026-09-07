import type { Game } from './engine';
import {
  settledBoard,
  type AdvisorRelease,
  type BoardContext,
} from './board-resolution-quote';
import { ecazOccupancyIdentity } from './ecaz-occupy';
import { gameTerritories } from './board';
import { fighterCount } from './advisors';
import { TECH_TOKENS } from './tech-tokens';

export type StrongholdProgress = {
  player: string;
  members: string[];
  strongholds: string[];
  techStronghold: boolean;
  target: 3 | 4;
  jointlyOccupied: string[];
  occupyTarget: 3 | null;
  qualifies: boolean;
};
export class VictoryProgressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VictoryProgressError';
  }
}
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
function requireProgress(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new VictoryProgressError(message);
}

/** Public prospective stronghold victory only. No prediction, special endgame
 * victory, combat resolution, resource mutation or Stronghold Card ownership is
 * considered. Mandatory advisor releases are returned for the caller to commit. */
export function strongholdProgress(
  g: BoardContext & Pick<Game, 'techTokens'>,
): { released: AdvisorRelease[]; progress: StrongholdProgress[] } {
  try {
    requireProgress(
      record(g) &&
        typeof g.advanced === 'boolean' &&
        Array.isArray(g.players) &&
        g.players.length > 0 &&
        g.players.every((p) => record(p) && record(p.forces)),
      'Victory progress requires a valid public board and seated players.',
    );
    // This validates every ID, faction and reciprocal alliance, even where no
    // stronghold has a force. It does not merge ordinary allies for occupancy.
    ecazOccupancyIdentity(g.players, g.players[0].id, {
      kind: 'territory',
      id: 'polar_sink',
    });
    const boardTerritories = gameTerritories(g);
    for (const p of g.players)
      if (p.advisors !== undefined)
        requireProgress(
          record(p.advisors) &&
            Object.entries(p.advisors).every(
              ([id, stance]) =>
                boardTerritories.some((t) => t.id === id) && record(stance),
            ),
          'Victory progress requires valid advisor stances.',
        );
    const { players, released } = settledBoard(g);
    const tech = g.techTokens;
    if (tech !== undefined && tech !== null) {
      requireProgress(
        record(tech) &&
          Object.keys(tech).length === TECH_TOKENS.length &&
          TECH_TOKENS.every(
            ({ id }) =>
              record(tech[id]) &&
              (tech[id].owner === null ||
                players.some((p) => p.id === tech[id].owner)),
          ),
        'Victory progress requires the complete technology token ownership map.',
      );
    }
    const sites = boardTerritories.filter((t) => t.type === 'stronghold');
    const progress = g.order.map((id) => {
      const p = players.find((p) => p.id === id)!;
      const members = g.order.filter(
        (member) => member === id || member === p.ally,
      );
      const partner = players.find((other) => other.id === p.ally);
      const ecazPair =
        !!partner && (p.faction === 'ecaz' || partner.faction === 'ecaz');
      const strongholds = sites
        .filter((t) => {
          const occupants = players.filter(
            (other) => fighterCount(other, t.id) > 0,
          );
          return (
            occupants.length > 0 &&
            occupants.every((other) => members.includes(other.id))
          );
        })
        .map((t) => t.id);
      const jointlyOccupied = ecazPair
        ? strongholds.filter((t) =>
            members.every(
              (member) =>
                fighterCount(
                  players.find((p) => p.id === member)!,
                  t,
                ) > 0,
            ),
          )
        : [];
      const techStronghold =
        !!tech &&
        members.some((member) =>
          TECH_TOKENS.every(({ id }) => tech[id].owner === member),
        );
      const target: 3 | 4 = partner || players.length === 2 ? 4 : 3;
      return {
        player: id,
        members,
        strongholds,
        techStronghold,
        target,
        jointlyOccupied,
        occupyTarget: ecazPair ? (3 as const) : null,
        qualifies:
          strongholds.length + Number(techStronghold) >= target ||
          jointlyOccupied.length >= 3,
      };
    });
    return { released, progress };
  } catch (error) {
    if (error instanceof VictoryProgressError) throw error;
    throw new VictoryProgressError(
      error instanceof Error ? error.message : 'Invalid public victory state.',
    );
  }
}
