import { fighterCount } from './advisors';
import { settledBoard, type BoardContext } from './board-resolution-quote';
import { ecazOccupancyIdentity } from './ecaz-occupy';
import { presenceAt } from './force-presence';
import { VictoryProgressError } from './victory-progress';

const PROTECTED_SIETCHES = ['sietch_tabr', 'habbanya_ridge_sietch'] as const;

export type FremenVictoryProgress = {
  player: string;
  members: string[];
  qualifies: boolean;
  sietches: {
    territory: string;
    blockers: string[];
    ecazCooccupation: boolean;
  }[];
  tueksBlockers: string[];
};

/** Public current-board facts for the Fremen final-turn victory condition.
 * Turn timing, prior stronghold winners and the Guild fallback belong to the
 * victory quote. The only Ecaz exception established here is co-occupied
 * Sietch Tabr; the same forces still block Habbanya Ridge Sietch. */
export function fremenSpecialVictory(
  g: BoardContext,
): FremenVictoryProgress | null {
  try {
    const { players } = settledBoard(g);
    if (!players.length)
      throw new VictoryProgressError(
        'Fremen victory progress requires seated players.',
      );

    // Reuse the public occupancy validator for faction uniqueness and exact
    // reciprocal alliances without reading any private player state.
    ecazOccupancyIdentity(players, players[0].id, {
      kind: 'territory',
      id: 'polar_sink',
    });

    const fremen = players.find((player) => player.faction === 'fremen');
    if (!fremen) return null;
    const ally = players.find((player) => player.id === fremen.ally);
    const ecaz = ally?.faction === 'ecaz' ? ally : null;
    const members = g.order.filter(
      (player) => player === fremen.id || player === ally?.id,
    );

    const sietches = PROTECTED_SIETCHES.map((territory) => {
      const ecazCooccupation = !!(
        ecaz &&
        fighterCount(fremen, territory) > 0 &&
        fighterCount(ecaz, territory) > 0
      );
      const blockers = g.order.filter((id) => {
        const player = players.find((candidate) => candidate.id === id)!;
        if (player.id === fremen.id || fighterCount(player, territory) === 0)
          return false;
        return !(
          territory === 'sietch_tabr' &&
          ecazCooccupation &&
          player.id === ecaz!.id
        );
      });
      return { territory, blockers, ecazCooccupation };
    });

    const prohibited = new Set([
      'atreides',
      'harkonnen',
      'emperor',
      ...(g.advanced ? ['richese'] : []),
    ]);
    const tueksBlockers = g.order.filter((id) => {
      const player = players.find((candidate) => candidate.id === id)!;
      return (
        prohibited.has(player.faction) && presenceAt(player, 'tueks_sietch') > 0
      );
    });

    return {
      player: fremen.id,
      members,
      qualifies:
        sietches.every((sietch) => sietch.blockers.length === 0) &&
        tueksBlockers.length === 0,
      sietches,
      tueksBlockers,
    };
  } catch (error) {
    if (error instanceof VictoryProgressError) throw error;
    throw new VictoryProgressError(
      error instanceof Error
        ? error.message
        : 'Invalid public Fremen victory state.',
    );
  }
}
