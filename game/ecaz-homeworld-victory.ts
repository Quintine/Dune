import type { BoardContext, BoardSeat } from './board-resolution-quote';
import type { FactionId } from './catalog';
import type { Game } from './engine';
import { HOMEWORLD_CARDS } from './homeworld-cards';
import { homeworldForceGroups } from './homeworld-custody';
import { homeworldPopulations } from './homeworld-population';
import { validateHomeworldOccupationHistory } from './homeworld-occupation-history';
import {
  quoteStableHomeworldOccupation,
  type StableHomeworldOccupationContext,
} from './homeworld-stable-occupation';
import { strongholdProgress, VictoryProgressError } from './victory-progress';

export type EcazHomeworldVictoryContext = Omit<BoardContext, 'players'> &
  Pick<Game, 'turn' | 'homeworlds' | 'homeworldOccupationHistory' | 'homeworldOccupationPreview'> & {
    homeworldEcazVictoryPreview?: true;
    players: readonly (BoardSeat & {
      reserves: number;
      elites?: { reserves: number } | null;
    })[];
  };
export type EcazHomeworldVictoryProgress = {
  owner: string;
  members: string[];
  population: number;
  minimum: number;
  high: boolean;
  jointStrongholds: string[];
  foreignHomeworlds: {
    world: string;
    card: string;
    native: string;
    faction: FactionId;
    holder: string;
  }[];
  distinctNativeFactions: FactionId[];
  qualifies: boolean;
  blocked: string | null;
};

/** Printed High Ecaz victory, separate from ordinary points and occupied Duke
 * benefits. Foreign holdings require the existing original source authority AND
 * the entitled holder's current physical presence; a departed garrison is never
 * a victory holding. Advanced p.22 retained occupation is otherwise respected.
 * This returns public facts only, never an income receipt or a winning action. */
export function ecazHomeworldVictoryProgress(
  g: EcazHomeworldVictoryContext,
): EcazHomeworldVictoryProgress | null {
  // Original BoardContext callers are not opted in and need no reserve data.
  if (g.homeworldEcazVictoryPreview === undefined) return null;
  try {
    if (g.homeworldEcazVictoryPreview !== true || g.homeworldOccupationPreview !== true)
      throw new VictoryProgressError('Ecaz Homeworld victory requires the fresh occupation preview.');
    if (!Number.isSafeInteger(g.turn) || g.turn < 1)
      throw new VictoryProgressError('Ecaz Homeworld victory requires the current positive turn.');
    const board: BoardContext = {
      advanced: g.advanced,
      ecazOccupyPreview: g.ecazOccupyPreview,
      storm: g.storm,
      order: g.order,
      players: g.players,
      mobileStronghold: g.mobileStronghold,
      discoveries: g.discoveries,
    };
    // This owns alliance validation, advisor settling, public No-Field presence,
    // storm/contested stronghold and HMS semantics. Tech sets are not joint sites.
    const ordinary = strongholdProgress(board).progress;
    const ecaz = g.players.find(player => player.faction === 'ecaz');
    if (!ecaz)
      throw new VictoryProgressError('Fresh Ecaz Homeworld victory requires native Ecaz.');
    const state = g.homeworlds;
    if (!state || typeof state !== 'object' || Array.isArray(state) ||
        Object.keys(state).some(key => !['custody', 'historyVersion'].includes(key)) ||
        (state.historyVersion !== undefined && state.historyVersion !== 1) || !state.custody)
      throw new VictoryProgressError('Ecaz Homeworld victory requires valid native Homeworld custody.');
    const context = {
      advanced: g.advanced,
      players: g.players.map(player => ({
        id: player.id, faction: player.faction, reserves: player.reserves,
        eliteReserves: player.elites?.reserves ?? 0,
      })),
    };
    const worlds = homeworldForceGroups(context, state.custody);
    const history = g.homeworldOccupationHistory;
    const originalHistory = state.historyVersion === 1 && history !== undefined;
    if (originalHistory) validateHomeworldOccupationHistory(history, context, g.turn);
    const population = homeworldPopulations(context, state.custody)
      .find(home => home.native === ecaz.id && home.card === 'ecaz')!;
    const minimum = HOMEWORLD_CARDS.find(card => card.id === 'ecaz')!.high.reserves.min;
    const progress = ordinary.find(row => row.player === ecaz.id)!;
    const members = progress.members;
    const foreignHomeworlds: EcazHomeworldVictoryProgress['foreignHomeworlds'] = [];
    const possible = new Set<FactionId>();
    const blockers: string[] = [];
    // The stable authority's legacy Game signature is broader than its actual
    // public inputs. Project explicitly rather than passing private Player data.
    const publicOccupation = {
      advanced: g.advanced, turn: g.turn, homeworlds: state,
      homeworldOccupationPreview: g.homeworldOccupationPreview,
      homeworldOccupationHistory: g.homeworldOccupationHistory,
      players: g.players.map(player => ({
        id: player.id, faction: player.faction, ally: player.ally,
        reserves: player.reserves,
        elites: player.elites ? { reserves: player.elites.reserves } : undefined,
      })),
    } as StableHomeworldOccupationContext;
    for (const world of worlds) {
      // Ecaz and its ally's own native worlds are not "other factions".
      if (members.includes(world.native)) continue;
      const faction = context.players.find(player => player.id === world.native)!.faction;
      const card = HOMEWORLD_CARDS.find(card => world.secondary
        ? card.id === 'salusa_secundus'
        : card.faction === faction && card.id !== 'salusa_secundus')!;
      const quote = originalHistory
        ? quoteStableHomeworldOccupation(publicOccupation, card.id)
        : { entitlement: null, blocked: 'Ecaz Homeworld holdings require the original fresh occupation history.' };
      const alliancePresent = members.some(member => {
        const forces = world.forces[member];
        return forces && forces.normal + forces.elite > 0;
      });
      if (quote.blocked) {
        // Pending facts can block a possible win, but cannot manufacture a
        // holding; unrelated occupiers and empty departed worlds cannot block it.
        if (alliancePresent) {
          possible.add(faction);
          blockers.push(quote.blocked);
        }
        continue;
      }
      const holding = quote.entitlement;
      if (!holding || !members.includes(holding.occupier)) continue;
      const present = world.forces[holding.occupier];
      if (!present || present.normal + present.elite === 0) continue;
      foreignHomeworlds.push({
        world: world.id, card: card.id, native: world.native,
        faction, holder: holding.occupier,
      });
      possible.add(faction);
    }
    const distinctNativeFactions = [...new Set(foreignHomeworlds.map(home => home.faction))];
    const high = population.side === 'high';
    const jointStrongholds = progress.jointlyOccupied;
    const blocked = blockers.length > 0 && possible.size >= 2 && distinctNativeFactions.length < 2
      ? blockers[0] : null;
    return {
      owner: ecaz.id, members: [...members], population: population.population,
      minimum, high, jointStrongholds: [...jointStrongholds], foreignHomeworlds,
      distinctNativeFactions,
      qualifies: high && jointStrongholds.length > 0 && distinctNativeFactions.length >= 2,
      blocked,
    };
  } catch (error) {
    if (error instanceof VictoryProgressError) throw error;
    throw new VictoryProgressError(error instanceof Error ? error.message : 'Invalid public Ecaz Homeworld victory state.');
  }
}
