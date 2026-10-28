import type { Game, Player } from './engine';
import { victoryFinalTurn, VictoryCalendarError } from './victory-calendar';
import { FACTIONS } from './catalog';
import { gameTerritories, validLocation } from './board';
import { fighterCount } from './advisors';
import { fremenSpecialVictory } from './fremen-victory';
import {
  settledBoard,
  BoardResolutionError,
  type BoardContext,
  type BoardSeat,
  type AdvisorRelease,
} from './board-resolution-quote';
import { TECH_TOKENS, techStronghold } from './tech-tokens';
import {
  countsForStrongholdVictory,
  strongholdProgress,
  VictoryProgressError,
} from './victory-progress';
import {
  settleStrongholdCards,
  strongholdControllers,
  type StrongholdState,
} from './stronghold-cards';
import { ecazHomeworldVictoryProgress, type EcazHomeworldVictoryContext, type EcazHomeworldVictoryProgress } from './ecaz-homeworld-victory';
import type { TwoPlayerControllers } from './two-player-controllers';
import { isHomeworldNoFieldLocation } from './richese-no-field';

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
    'turn' | 'phase' | 'status' | 'winner' | 'techTokens' | 'strongholdCards' | 'victoryExtraStrongholds' | 'victoryFinalTurn'
  > & {
    players: readonly (BoardSeat & Pick<Player, 'prediction'>)[];
    twoPlayerControllers?: TwoPlayerControllers;
  };
export type VictoryQuote = {
  released: AdvisorRelease[];
  winner: string[];
  status: 'playing' | 'finished';
  /** Exact final ownership when settlement is due; null means no settlement. */
  strongholds: StrongholdState | null;
  /** Qualifying printed source before any private BG prediction replacement. */
  ecazHomeworld: EcazHomeworldVictoryProgress | null;
};

/** Internal server quote. Prediction is private input, never a returned field.
 * This preserves the existing victory order, including the distinct final-turn
 * Fremen/Guild fallbacks. It does not advance a turn or settle other phase work. */
export function quoteVictory(g: VictoryContext, ecazContext?: EcazHomeworldVictoryContext): VictoryQuote {
  let finalTurn: number;
  try { finalTurn = victoryFinalTurn(g); }
  catch (error) {
    if (error instanceof VictoryCalendarError) throw new VictoryQuoteError(error.message);
    throw error;
  }
  requireVictory(
    (g.status === 'playing' || g.status === 'finished') &&
      whole(g.turn) &&
      g.turn >= 1 &&
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
          (isHomeworldNoFieldLocation(marker.location) || validLocation(marker.location.territory, marker.location.sector)),
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
        countsForStrongholdVictory(t.id) &&
        ids.some((id) => fighterCount(player(id), t.id) > 0) &&
        players.every((p) => ids.includes(p.id) || fighterCount(p, t.id) === 0),
    ).length;
  let ecazHomeworld: EcazHomeworldVictoryProgress | null = null;
  if (ecazContext) {
    const context = ecazContext;
    requireVictory(context.homeworldEcazVictoryPreview === true && context.turn === g.turn &&
      context.advanced === g.advanced && context.storm === g.storm && context.players === g.players &&
      context.order === g.order && context.mobileStronghold === g.mobileStronghold &&
      context.discoveries === g.discoveries,
    'The Ecaz Homeworld source must belong to this original victory board.');
    try {
      const row = ecazHomeworldVictoryProgress(context);
      requireVictory(!row?.blocked || !row.high || !row.jointStrongholds.length,
        row?.blocked ?? 'The Ecaz Homeworld victory source is unresolved.');
      if (row?.qualifies) ecazHomeworld = row;
    } catch (error) {
      if (error instanceof VictoryProgressError) throw new VictoryQuoteError(error.message);
      throw error;
    }
  }
  let winner = [...g.winner];
  const predicted = () =>
    bg?.prediction?.turn === g.turn &&
    winner.some((id) => player(id).faction === bg.prediction!.faction);
  const qualifying = progress.filter((row) => row.qualifies);
  // The authorized Advanced rules first compare the holdings of qualifying
  // unallied players; their general shared-win rule covers ties and any
  // competition that includes a qualifying alliance. A complete Tech set is
  // the same additional stronghold used in the ordinary victory threshold.
  // Keep existing settled winners and the separate Homeworld victory source
  // intact rather than retroactively ranking a recorded result.
  const rankSolo = g.advanced && winner.length === 0 && !ecazHomeworld &&
    qualifying.length > 1 && qualifying.every((row) => row.members.length === 1);
  const most = rankSolo
    ? Math.max(...qualifying.map((row) => row.strongholds.length + Number(row.techStronghold)))
    : null;
  for (const row of qualifying)
    if (most === null || row.strongholds.length + Number(row.techStronghold) === most)
      winner = [...new Set([...winner, ...row.members])];
  if (ecazHomeworld) winner = [...new Set([...winner, ...ecazHomeworld.members])];
  if (predicted()) winner = [bg!.id];
  let status = g.status;
  if (!winner.length && g.turn === finalTurn) {
    const fremen = players.find((p) => p.faction === 'fremen');
    const guild = players.find((p) => p.faction === 'guild');
    if (fremen && fremenSpecialVictory(g)?.qualifies)
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
  return { released, winner, status, strongholds, ecazHomeworld };
}
