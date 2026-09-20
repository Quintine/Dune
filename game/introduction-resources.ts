import { faction } from './catalog';
import { charityQuote } from './charity';
import { leaders, type Leader } from './cards';
import {
  forceRevivalQuote,
  forceRevivalRemaining,
  freeRevivalRate,
  freeRevivalRemaining,
  leaderRevivalOptions,
  newRevivalRules,
} from './revival';

export type IntroductionResourceChoice = {
  charitySpice: number;
  charityClaimed: boolean;
  revivalFaction: 'atreides' | 'emperor' | 'fremen';
  revivalSpice: number;
  revivalAmount: number;
  revivalLeader: number;
  revivalRoster: 'all-dead' | 'survivor' | 'repeat';
  revivalActions: Array<
    { kind: 'forces'; amount: number } | { kind: 'leader'; leader: number }
  >;
};

export const RESOURCE_DEFAULTS: IntroductionResourceChoice = {
  charitySpice: 0,
  charityClaimed: false,
  revivalFaction: 'atreides',
  revivalSpice: 6,
  revivalAmount: 3,
  revivalLeader: 0,
  revivalRoster: 'all-dead',
  revivalActions: [],
};

const exactKeys = (value: object, keys: readonly string[]) =>
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const integer = (value: unknown, minimum: number, maximum: number) =>
  typeof value === 'number' &&
  Number.isSafeInteger(value) &&
  value >= minimum &&
  value <= maximum;
function requireResource(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}
function validateChoice(value: IntroductionResourceChoice) {
  requireResource(
    !!value && typeof value === 'object' && !Array.isArray(value),
    'The resource-practice state has invalid fields.',
  );
  requireResource(
    integer(value.charitySpice, 0, 3) &&
      typeof value.charityClaimed === 'boolean',
    'Choose zero through three charity spice and a valid claim state.',
  );
  requireResource(
    ['atreides', 'emperor', 'fremen'].includes(value.revivalFaction) &&
      integer(value.revivalSpice, 0, 10) &&
      integer(value.revivalAmount, 1, 4) &&
      integer(value.revivalLeader, 0, 4) &&
      ['all-dead', 'survivor', 'repeat'].includes(value.revivalRoster) &&
      Array.isArray(value.revivalActions) &&
      value.revivalActions.length <= 4,
    'The revival-practice draft is invalid.',
  );
  let forceActions = 0;
  let leaderActions = 0;
  for (const action of value.revivalActions) {
    requireResource(
      !!action && typeof action === 'object' && !Array.isArray(action),
      'A revival-practice action is invalid.',
    );
    if (action.kind === 'forces') {
      forceActions++;
      requireResource(
        exactKeys(action, ['amount', 'kind']) && integer(action.amount, 1, 4),
        'A force revival needs only an integer amount from one through four.',
      );
    } else if (action.kind === 'leader') {
      leaderActions++;
      requireResource(
        exactKeys(action, ['kind', 'leader']) && integer(action.leader, 0, 4),
        'A leader revival needs only a leader index from zero through four.',
      );
    } else throw new Error('Choose a force or leader revival action.');
  }
  requireResource(
    forceActions <= 3 && leaderActions <= 1,
    'Practice allows at most three force requests and one leader request.',
  );
}

export function introductionCharity(choice: IntroductionResourceChoice) {
  validateChoice(choice);
  const player = {
    id: 'practice',
    faction: 'atreides' as const,
    spice: choice.charitySpice,
  };
  const quote = charityQuote(
    {
      advanced: false,
      turn: 1,
      inflation: undefined,
      players: [],
      homeworlds: undefined,
    },
    player,
  );
  requireResource(
    !choice.charityClaimed || quote.total > 0,
    'An ineligible charity claim cannot be restored.',
  );
  const canClaim = !choice.charityClaimed && quote.total > 0;
  return {
    amount: quote.total,
    spice: choice.charitySpice + (choice.charityClaimed ? quote.total : 0),
    canClaim,
    reason: choice.charityClaimed
      ? 'Charity has already been claimed.'
      : canClaim
        ? null
        : 'Charity requires fewer than two spice.',
  };
}

function practiceLeaders(choice: IntroductionResourceChoice): Leader[] {
  return leaders(choice.revivalFaction).map((leader, index) => ({
    ...leader,
    dead: choice.revivalRoster !== 'survivor' || index < 4,
    deaths:
      choice.revivalRoster === 'survivor' && index === 4
        ? 0
        : choice.revivalRoster === 'repeat' && index === 0
          ? 2
          : 1,
  }));
}

export function introductionRevival(choice: IntroductionResourceChoice) {
  validateChoice(choice);
  const context = {
    advanced: false,
    phase: 4,
    turn: 1,
    players: [],
    homeworlds: undefined,
    revivalRules: newRevivalRules(),
    freeRevival: [],
    recruits: undefined,
    revivalPrevention: undefined,
  };
  const player = {
    id: 'practice',
    faction: choice.revivalFaction,
    spice: choice.revivalSpice,
    tanks: 5,
    reserves: 15,
    revived: 0,
    freeForcesRevived: 0,
    leaders: practiceLeaders(choice),
    leaderRevived: false,
    revivalCycle: 0,
    kwisatz: undefined,
  };
  const transcript: string[] = [];

  for (const action of choice.revivalActions) {
    if (action.kind === 'forces') {
      const remaining = forceRevivalRemaining(context, player);
      requireResource(
        integer(action.amount, 1, remaining),
        'That saved force revival exceeds the remaining normal allowance.',
      );
      const quote = forceRevivalQuote(context, player, action.amount);
      requireResource(
        quote.cost <= player.spice,
        'That saved force revival is no longer affordable.',
      );
      player.spice -= quote.cost;
      player.tanks -= action.amount;
      player.reserves += action.amount;
      player.revived += action.amount;
      player.freeForcesRevived += quote.free;
      transcript.push(
        `Revived ${action.amount} ${action.amount === 1 ? 'force' : 'forces'}: ${quote.free} free, ${quote.cost} spice.`,
      );
      continue;
    }

    const options = leaderRevivalOptions(context, player);
    player.revivalCycle = options.cycle;
    const leader = player.leaders[action.leader];
    const option = options.leaders.find((entry) => entry.id === leader.id);
    requireResource(
      !player.leaderRevived && leader.dead && option && !option.early,
      'That saved leader revival is unavailable in this revival cycle.',
    );
    requireResource(
      option.cost <= player.spice,
      'That saved leader revival is no longer affordable.',
    );
    player.spice -= option.cost;
    leader.dead = false;
    player.leaderRevived = true;
    transcript.push(`Revived ${leader.name} for ${option.cost} spice.`);
  }

  const freeRate = freeRevivalRate(context, player);
  const remaining = forceRevivalRemaining(context, player);
  const freeRemaining = freeRevivalRemaining(context, player);
  const forceQuote = forceRevivalQuote(context, player, choice.revivalAmount);
  const canReviveForces =
    choice.revivalAmount <= remaining && forceQuote.cost <= player.spice;
  const forceReason =
    choice.revivalAmount > remaining
      ? remaining
        ? `Only ${remaining} normal force ${remaining === 1 ? 'revival remains' : 'revivals remain'}.`
        : 'The normal force-revival allowance is exhausted.'
      : forceQuote.cost > player.spice
        ? 'There is not enough spice for that force revival.'
        : null;

  const leaderOptions = leaderRevivalOptions(context, player);
  const selectedLeader = player.leaders[choice.revivalLeader];
  const selectedOption = leaderOptions.leaders.find(
    (entry) => entry.id === selectedLeader.id,
  );
  const leaderCost = selectedOption?.cost ?? selectedLeader.strength;
  const canReviveLeader =
    !player.leaderRevived &&
    selectedLeader.dead &&
    !!selectedOption &&
    !selectedOption.early &&
    selectedOption.affordable;
  const leaderReason = player.leaderRevived
    ? 'The one normal leader revival has already been used.'
    : !selectedLeader.dead
      ? 'That leader is not in the tanks.'
      : leaderOptions.cycle === 0
        ? 'All five leaders must enter the tanks before the first normal leader revival.'
        : selectedLeader.deaths > leaderOptions.cycle
          ? "A repeat-death leader must wait for the other leaders' revival cycle."
          : !selectedOption || selectedOption.early
            ? 'That leader is unavailable in the current revival cycle.'
            : !selectedOption.affordable
              ? 'There is not enough spice to revive that leader.'
              : null;

  return {
    factionName: faction(choice.revivalFaction).name,
    freeRate,
    remaining,
    freeRemaining,
    spice: player.spice,
    tanks: player.tanks,
    reserves: player.reserves,
    revived: player.revived,
    forceCost: forceQuote.cost,
    forceFree: forceQuote.free,
    canReviveForces,
    forceReason,
    leaders: structuredClone(player.leaders),
    leaderRevived: player.leaderRevived,
    leaderCost,
    canReviveLeader,
    leaderReason,
    transcript,
  };
}
