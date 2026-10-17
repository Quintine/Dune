import { validCombatForces, type CombatForces } from './combat';
import {
  homeworldForceGroups, type HomeworldCustody, type HomeworldCustodyContext,
  type HomeworldForces,
} from './homeworld-custody';
import {
  NativeReserveError, quoteNativeReserveWithdrawal, type NativeReserveSelections,
} from './homeworld-native-reserves';
import { quoteReinforcements, ReinforcementsError } from './reinforcements';

type Cost = ReturnType<typeof quoteReinforcements>;
function nativeCost(context: HomeworldCustodyContext, actor: string): Cost {
  const seat = context.players.find(player => player.id === actor);
  if (!seat) throw new NativeReserveError('Reinforcements needs its seated native reserve owner.');
  return quoteReinforcements(seat.reserves - seat.eliteReserves, seat.eliteReserves);
}
function sourceOptions(context: HomeworldCustodyContext, custody: HomeworldCustody,
  actor: string, cost: Cost): NativeReserveSelections[] {
  const homes = homeworldForceGroups(context, custody).filter(home => home.native === actor);
  if (homes.length === 1) return [{ [homes[0].id]: { normal: cost.normal, elite: cost.elite } }];
  if (homes.length !== 2) throw new NativeReserveError('Choose the actual native Homeworld reserve sources.');
  const [first, second] = homes;
  const firstPool = first.forces[actor], secondPool = second.forces[actor];
  const options: NativeReserveSelections[] = [];
  // At most six allocations for a three-counter typed cost. Both native World
  // entries remain explicit, including zero, so clients never guess a split.
  for (let normal = Math.max(0, cost.normal - secondPool.normal);
    normal <= Math.min(cost.normal, firstPool.normal); normal++) {
    for (let elite = Math.max(0, cost.elite - secondPool.elite);
      elite <= Math.min(cost.elite, firstPool.elite); elite++) {
      options.push({
        [first.id]: { normal, elite },
        [second.id]: { normal: cost.normal - normal, elite: cost.elite - elite },
      });
    }
  }
  return options;
}

/** Public physical alternatives for the existing normal-first fee. Enumeration
 * does not select a source, move counters or grant permission to play a card. */
export function reinforcementsHomeworldSources(context: HomeworldCustodyContext,
  custody: HomeworldCustody, actor: string): NativeReserveSelections[] {
  return sourceOptions(context, custody, actor, nativeCost(context, actor));
}

/** Exact native withdrawal; the caller commits matching Tanks and observes
 * population only after this whole fee. Ambiguous sources must be declared. */
export function quoteReinforcementsHomeworldCost(context: HomeworldCustodyContext,
  custody: HomeworldCustody, actor: string, selections?: NativeReserveSelections) {
  const cost = nativeCost(context, actor);
  let sources = selections;
  if (sources === undefined) {
    const options = sourceOptions(context, custody, actor, cost);
    if (options.length !== 1)
      throw new NativeReserveError('Choose the Homeworld sources for Reinforcements; more than one allocation is possible.');
    sources = options[0];
  }
  const native = quoteNativeReserveWithdrawal(context, custody, actor,
    { normal: cost.normal, elite: cost.elite }, sources);
  return { ...cost, sources, native };
}

/** On an own World the reserve fee and combat army share physical counters.
 * Reserve the fee first, but retain the original sealed support/strength traits.
 * Provisionally spend ordinary counters without a temporary role first, then
 * remove that role only from converted counters actually used to pay the fee.
 * Foreign-World and Arrakis callers pass no on-location cost. */
export function reinforcementsBattleForces(forces: CombatForces,
  onLocationCost?: HomeworldForces): CombatForces {
  if (!onLocationCost) return forces;
  const { normal, elite } = onLocationCost;
  if (!validCombatForces(forces) || !Number.isSafeInteger(normal) || normal < 0 || !Number.isSafeInteger(elite) || elite < 0 ||
    normal > forces.normal || elite > forces.elite)
    throw new ReinforcementsError('The reserve fee cannot also fund the physical Homeworld dial.');
  if (normal + elite === 0) return forces;
  const remainingNormal = forces.normal - normal;
  return { ...forces, normal: remainingNormal, elite: forces.elite - elite,
    ...(forces.temporaryElite === undefined ? {} : {temporaryElite: Math.min(forces.temporaryElite, remainingNormal)}) };
}
