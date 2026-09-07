import type { Game, Player } from './engine';
import { FACTIONS } from './catalog';
import { gameTerritories, validLocation } from './board';
import { fighterCount } from './advisors';
import { presenceAt } from './force-presence';
import {
  settledBoard,
  BoardResolutionError,
  type BoardContext,
  type BoardSeat,
  type AdvisorRelease,
} from './board-resolution-quote';
import { TECH_TOKENS, techStronghold } from './tech-tokens';
import { strongholdProgress, VictoryProgressError } from './victory-progress';
import {
  settleStrongholdCards,
  strongholdControllers,
  type StrongholdState,
} from './stronghold-cards';

export class VictoryQuoteError extends Error {}
function requireVictory(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new VictoryQuoteError(message);
}
const whole = (n: unknown): n is number =>
  Number.isSafeInteger(n) && (n as number) >= 0;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
export type VictoryContext = Omit<BoardContext, 'players'> &
  Pick<
    Game,
    'turn' | 'phase' | 'status' | 'winner' | 'techTokens' | 'strongholdCards'
  > & {
    players: readonly (BoardSeat & Pick<Player, 'prediction'>)[];
  };
export type VictoryQuote = {
  released: AdvisorRelease[];
  winner: string[];
  status: 'playing' | 'finished';
  /** Exact final ownership when settlement is due; null means no settlement. */
  strongholds: StrongholdState | null;
};

/** Internal server quote. Prediction is private input, never a returned field.
 * This preserves the existing victory order, including the distinct final-turn
 * Fremen/Guild fallbacks. It does not advance a turn or settle other phase work. */
export function quoteVictory(g: VictoryContext): VictoryQuote {
  requireVictory(
    (g.status === 'playing' || g.status === 'finished') &&
      whole(g.turn) &&
      g.turn >= 1 &&
      g.turn <= 10 &&
      whole(g.phase) &&
      g.phase <= 8 &&
      typeof g.advanced === 'boolean' &&
      Array.isArray(g.players) &&
      g.players.length > 0 &&
      g.players.every(
        (p) =>
          p &&
          typeof p.id === 'string' &&
          p.id.length > 0 &&
          FACTIONS.some((f) => f.id === p.faction),
      ) &&
      new Set(g.players.map((p) => p.id)).size === g.players.length &&
      new Set(g.players.map((p) => p.faction)).size === g.players.length,
    'Victory needs a current game and distinct seated factions.',
  );
  for (const p of g.players) {
    requireVictory(
      p.ally === null ||
        (typeof p.ally === 'string' &&
          p.ally !== p.id &&
          g.players.some(
            (other) => other.id === p.ally && other.ally === p.id,
          )),
      'Victory needs seated reciprocal alliances.',
    );
    requireVictory(record(p.forces), 'Victory needs physical force groups.');
    if (p.advisors !== undefined)
      requireVictory(
        record(p.advisors) &&
          Object.entries(p.advisors).every(
            ([t, stance]) =>
              gameTerritories(g).some((x) => x.id === t) && record(stance),
          ),
        'Victory needs valid advisor stances.',
      );
    const marker = p.noField?.deployed;
    if (marker)
      requireVictory(
        record(marker.location) &&
          validLocation(marker.location.territory, marker.location.sector),
        'Victory needs a valid deployed No-Field location.',
      );
  }
  requireVictory(
    Array.isArray(g.winner) &&
      new Set(g.winner).size === g.winner.length &&
      g.winner.every((id) => g.players.some((p) => p.id === id)),
    'Victory needs distinct seated winner IDs.',
  );
  if (g.techTokens)
    requireVictory(
      record(g.techTokens) &&
        Object.keys(g.techTokens).length === TECH_TOKENS.length &&
        TECH_TOKENS.every(
          (t) =>
            record(g.techTokens![t.id]) &&
            (g.techTokens![t.id].owner === null ||
              g.players.some((p) => p.id === g.techTokens![t.id].owner)),
        ),
      'Victory needs a complete tech-token ownership map.',
    );
  const bg = g.players.find((p) => p.faction === 'beneGesserit');
  if (bg?.prediction)
    requireVictory(
      whole(bg.prediction.turn) &&
        bg.prediction.turn >= 1 &&
        bg.prediction.turn <= 10 &&
        g.players.some(
          (p) => p.id !== bg.id && p.faction === bg.prediction!.faction,
        ),
      'Victory needs a valid saved Bene Gesserit prediction.',
    );

  let board: ReturnType<typeof settledBoard>;
  let progress: ReturnType<typeof strongholdProgress>['progress'];
  try {
    board = settledBoard(g);
    progress = strongholdProgress(g).progress;
  } catch (error) {
    if (
      error instanceof BoardResolutionError ||
      error instanceof VictoryProgressError
    )
      throw new VictoryQuoteError(error.message);
    throw error;
  }
  const { players, released } = board;
  const player = (id: string) => players.find((p) => p.id === id)!;
  const holds = (ids: string[]) =>
    gameTerritories(g).filter(
      (t) =>
        t.type === 'stronghold' &&
        ids.some((id) => fighterCount(player(id), t.id) > 0) &&
        players.every((p) => ids.includes(p.id) || fighterCount(p, t.id) === 0),
    ).length;
  let winner = [...g.winner];
  const predicted = () =>
    bg?.prediction?.turn === g.turn &&
    winner.some((id) => player(id).faction === bg.prediction!.faction);
  for (const row of progress)
    if (row.qualifies) winner = [...new Set([...winner, ...row.members])];
  if (predicted()) winner = [bg!.id];
  let status = g.status;
  if (!winner.length && g.turn === 10) {
    const fremen = players.find((p) => p.faction === 'fremen');
    const guild = players.find((p) => p.faction === 'guild');
    if (
      fremen &&
      players.every(
        (p) =>
          p.id === fremen.id ||
          (!fighterCount(p, 'sietch_tabr') &&
            !fighterCount(p, 'habbanya_ridge_sietch')),
      ) &&
      players
        .filter((p) =>
          [
            'atreides',
            'harkonnen',
            'emperor',
            ...(g.advanced ? ['richese'] : []),
          ].includes(p.faction),
        )
        .every((p) => !presenceAt(p, 'tueks_sietch'))
    )
      winner = fremen.ally ? [fremen.id, fremen.ally] : [fremen.id];
    else if (guild) winner = guild.ally ? [guild.id, guild.ally] : [guild.id];
    else if (fremen)
      winner = fremen.ally ? [fremen.id, fremen.ally] : [fremen.id];
    else {
      const scores = players.map((p) => ({
        id: p.id,
        holds: holds([p.id]) + techStronghold(g.techTokens, p.id),
      }));
      const most = Math.max(...scores.map((p) => p.holds));
      winner = scores.filter((p) => p.holds === most).map((p) => p.id);
      if (predicted()) winner = [bg!.id];
    }
    status = 'finished';
  }
  if (winner.length) status = 'finished';
  let strongholds: StrongholdState | null = null;
  if (
    status === 'finished' &&
    g.strongholdCards &&
    g.strongholdCards.claimedTurn !== g.turn
  ) {
    requireVictory(
      record(g.strongholdCards.owners) &&
        Object.values(g.strongholdCards.owners).every(
          (id) => id === null || players.some((p) => p.id === id),
        ),
      'Final Stronghold Card owners must be seated.',
    );
    requireVictory(
      g.advanced && g.phase === 8,
      'Stronghold Cards settle at the end of an Advanced turn.',
    );
    try {
      strongholds = settleStrongholdCards(
        g.strongholdCards,
        g.turn,
        strongholdControllers(players, !!g.mobileStronghold?.location),
      );
    } catch (error) {
      throw new VictoryQuoteError((error as Error).message);
    }
  }
  return { released, winner, status, strongholds };
}
