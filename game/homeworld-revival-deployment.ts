import type { Game } from './engine';
import {
  homeworldForceGroups,
  HomeworldCustodyError,
  type HomeworldCustody,
  type HomeworldCustodyContext,
} from './homeworld-custody';
import { homeworldContext } from './homeworld-game';
import { quoteNativeRevivalDeposit } from './homeworld-native-reserves';
import { homeworldPopulations } from './homeworld-population';

export type HomeworldRevivalDeploymentContext = Pick<
  Game,
  'advanced' | 'players' | 'homeworlds'
>;
export type HomeworldRevivalDeploymentSource =
  | 'normal'
  | 'emperorExtra'
  | 'ghola';
export type HomeworldRevivalDeploymentGroup = {
  amount: number;
  elite: number;
  free: number;
};
export type HomeworldRevivalDeploymentQuote = {
  kind: 'fedaykin' | 'tleilax';
  normal: number;
  elite: number;
  beforePopulation: number;
  afterPopulation: number;
  blocked: string | null;
};

function physicalWorlds(
  context: HomeworldCustodyContext,
  custody: HomeworldCustody,
) {
  return homeworldForceGroups(context, custody)
    .map((home) => ({
      id: home.id,
      native: home.native,
      forces: Object.entries(home.forces)
        .filter(([, forces]) => forces.normal + forces.elite > 0)
        .map(([player, forces]) => [player, forces.normal, forces.elite])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Quote the eligible subset of one actual typed native revival deposit.
 * Timing, destinations, splitting and durable completion belong to the caller.
 * A newly attained high threshold remains an explicit unresolved boundary. */
export function quoteHomeworldRevivalDeployment(
  before: HomeworldRevivalDeploymentContext,
  after: HomeworldRevivalDeploymentContext,
  player: string,
  source: HomeworldRevivalDeploymentSource,
  group: HomeworldRevivalDeploymentGroup,
): HomeworldRevivalDeploymentQuote | null {
  if (
    !['normal', 'emperorExtra', 'ghola'].includes(source) ||
    !group ||
    typeof group !== 'object' ||
    Array.isArray(group) ||
    !Number.isSafeInteger(group.amount) ||
    group.amount <= 0 ||
    group.amount > 20 ||
    !Number.isSafeInteger(group.elite) ||
    group.elite < 0 ||
    group.elite > group.amount ||
    !Number.isSafeInteger(group.free) ||
    group.free < 0 ||
    group.free > group.amount
  )
    throw new HomeworldCustodyError(
      'Revival deployment needs a valid source and exact newly returned physical group.',
    );
  if (!before.homeworlds?.custody && !after.homeworlds?.custody) return null;
  if (
    !before.homeworlds?.custody ||
    !after.homeworlds?.custody ||
    before.advanced !== after.advanced
  )
    throw new HomeworldCustodyError(
      'The Homeworld module cannot change during a revival deposit.',
    );
  const beforeContext = homeworldContext(before);
  const afterContext = homeworldContext(after);
  const expected = quoteNativeRevivalDeposit(
    beforeContext,
    before.homeworlds.custody,
    player,
    { normal: group.amount - group.elite, elite: group.elite },
  );
  if (
    JSON.stringify(
      physicalWorlds(
        { ...beforeContext, players: expected.players },
        expected.state,
      ),
    ) !== JSON.stringify(physicalWorlds(afterContext, after.homeworlds.custody))
  )
    throw new HomeworldCustodyError(
      'The revival deployment does not match its original typed native reserve deposit.',
    );
  const owner = beforeContext.players.find((seat) => seat.id === player)!;
  const kind =
    owner.faction === 'fremen' && group.elite > 0
      ? 'fedaykin'
      : owner.faction === 'tleilaxu' && source === 'normal' && group.free > 0
        ? 'tleilax'
        : null;
  if (!kind) return null;
  const card = kind === 'fedaykin' ? 'southern_hemisphere' : 'tleilax';
  const prior = homeworldPopulations(
    beforeContext,
    before.homeworlds.custody,
  ).find((home) => home.native === player && home.card === card)!;
  const current = homeworldPopulations(
    afterContext,
    after.homeworlds.custody,
  ).find((home) => home.native === player && home.card === card)!;
  if (current.side !== 'high') return null;
  return {
    kind,
    normal: kind === 'tleilax' ? group.free : 0,
    elite: kind === 'fedaykin' ? group.elite : 0,
    beforePopulation: prior.population,
    afterPopulation: current.population,
    blocked:
      prior.side === 'low'
        ? 'Revival deployment when this return first reaches the high Homeworld threshold awaits a timing ruling.'
        : null,
  };
}
