import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createGame, newPlayer, type Game } from '../game/engine';
import {
  introductionCharity,
  introductionRevival,
  RESOURCE_DEFAULTS,
  type IntroductionResourceChoice,
} from '../game/introduction-resources';
import { newRevivalRules } from '../game/revival';

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const choice = (
  overrides: Partial<IntroductionResourceChoice> = {},
): IntroductionResourceChoice => ({
  ...copy(RESOURCE_DEFAULTS),
  ...overrides,
  revivalActions: copy(overrides.revivalActions ?? []),
});

function actualState(input: IntroductionResourceChoice, phase: 2 | 4): Game {
  const game = createGame(
    'RESOURCEPRACTICE',
    newPlayer('practice', 'Practice', input.revivalFaction),
  );
  Object.assign(game, {
    status: 'playing',
    phase,
    turn: 1,
    response: null,
    decision: null,
    revivalRules: newRevivalRules(),
    freeRevival: [],
    revivalPrevention: undefined,
    homeworlds: undefined,
    recruits: undefined,
  });
  const player = game.players[0];
  Object.assign(player, {
    spice: phase === 2 ? input.charitySpice : input.revivalSpice,
    tanks: 5,
    reserves: 15,
    forces: {},
    revived: 0,
    freeForcesRevived: 0,
    leaderRevived: false,
    revivalCycle: 0,
  });
  player.leaders.forEach((leader, index) => {
    leader.dead = input.revivalRoster !== 'survivor' || index < 4;
    leader.deaths =
      input.revivalRoster === 'survivor' && index === 4
        ? 0
        : input.revivalRoster === 'repeat' && index === 0
          ? 2
          : 1;
  });
  return game;
}

function actualRevival(input: IntroductionResourceChoice) {
  let game = actualState(input, 4);
  for (const action of input.revivalActions)
    game =
      action.kind === 'forces'
        ? applyAction(game, 'practice', {
            type: 'revive',
            amount: action.amount,
          })
        : applyAction(game, 'practice', {
            type: 'reviveLeader',
            leader: game.players[0].leaders[action.leader].id,
          });
  return game;
}

void test('defaults and charity claims match actual eligibility and one-time payment', () => {
  assert.deepEqual(RESOURCE_DEFAULTS, {
    charitySpice: 0,
    charityClaimed: false,
    revivalFaction: 'atreides',
    revivalSpice: 6,
    revivalAmount: 3,
    revivalLeader: 0,
    revivalRoster: 'all-dead',
    revivalActions: [],
  });
  for (const charitySpice of [0, 1, 2, 3]) {
    const input = choice({ charitySpice });
    const offered = introductionCharity(input);
    assert.equal(offered.canClaim, charitySpice < 2);
    assert.equal(offered.amount, Math.max(0, 2 - charitySpice));
    if (charitySpice < 2) {
      const actual = applyAction(actualState(input, 2), 'practice', {
        type: 'charity',
      });
      const restored = introductionCharity({ ...input, charityClaimed: true });
      assert.equal(restored.spice, actual.players[0].spice);
      assert.equal(restored.canClaim, false);
    } else {
      const before = actualState(input, 2);
      assert.throws(
        () => applyAction(before, 'practice', { type: 'charity' }),
        /Charity/,
      );
      assert.throws(
        () => introductionCharity({ ...input, charityClaimed: true }),
        /ineligible charity claim/,
      );
    }
  }
});

void test('all three faction force rates and costs replay to actual engine resources and counters', () => {
  for (const [revivalFaction, freeRate] of [
    ['atreides', 2],
    ['emperor', 1],
    ['fremen', 3],
  ] as const) {
    const draft = choice({ revivalFaction, revivalAmount: 3 });
    const offered = introductionRevival(draft);
    assert.equal(offered.freeRate, freeRate);
    const input = choice({
      revivalFaction,
      revivalAmount: 3,
      revivalActions: [{ kind: 'forces', amount: 3 }],
    });
    const model = introductionRevival(input);
    const actual = actualRevival(input).players[0];
    assert.deepEqual(
      {
        spice: model.spice,
        tanks: model.tanks,
        reserves: model.reserves,
        revived: model.revived,
        free: model.freeRate - model.freeRemaining,
      },
      {
        spice: actual.spice,
        tanks: actual.tanks,
        reserves: actual.reserves,
        revived: actual.revived,
        free: actual.freeForcesRevived,
      },
    );
    assert.equal(model.tanks + model.reserves, 20);
    assert.equal(model.remaining, 0);
  }
});

void test('mixed force and leader history pays each quote once and preserves physical leaders', () => {
  const input = choice({
    revivalActions: [
      { kind: 'forces', amount: 1 },
      { kind: 'leader', leader: 2 },
      { kind: 'forces', amount: 2 },
    ],
  });
  const before = copy(input);
  const model = introductionRevival(input);
  const actual = actualRevival(input).players[0];
  assert.deepEqual(input, before);
  assert.deepEqual(
    {
      spice: model.spice,
      tanks: model.tanks,
      reserves: model.reserves,
      revived: model.revived,
      leaderRevived: model.leaderRevived,
      leaders: model.leaders.map(({ id, dead, deaths }) => ({
        id,
        dead,
        deaths,
      })),
    },
    {
      spice: actual.spice,
      tanks: actual.tanks,
      reserves: actual.reserves,
      revived: actual.revived,
      leaderRevived: actual.leaderRevived,
      leaders: actual.leaders.map(({ id, dead, deaths }) => ({
        id,
        dead,
        deaths,
      })),
    },
  );
  assert.equal(model.spice, 0);
  assert.equal(model.transcript.length, 3);
  assert.equal(model.canReviveForces, false);
  assert.equal(model.canReviveLeader, false);
  assert.equal(model.tanks + model.reserves, 20);
});

void test('survivor and repeat rosters expose the same unavailable leaders as real actions', () => {
  for (const [revivalRoster, revivalLeader] of [
    ['survivor', 0],
    ['repeat', 0],
  ] as const) {
    const input = choice({ revivalRoster, revivalLeader });
    const model = introductionRevival(input);
    assert.equal(model.canReviveLeader, false);
    assert.match(
      model.leaderReason!,
      revivalRoster === 'survivor' ? /All five leaders/ : /repeat-death leader/,
    );
    const actual = actualState(input, 4);
    const before = structuredClone(actual);
    assert.throws(
      () =>
        applyAction(actual, 'practice', {
          type: 'reviveLeader',
          leader: actual.players[0].leaders[revivalLeader].id,
        }),
      /All leaders must die|unavailable/,
    );
    assert.deepEqual(actual, before);
    assert.throws(
      () =>
        introductionRevival({
          ...input,
          revivalActions: [{ kind: 'leader', leader: revivalLeader }],
        }),
      /unavailable in this revival cycle/,
    );
  }
  const available = introductionRevival(
    choice({ revivalRoster: 'repeat', revivalLeader: 1 }),
  );
  assert.equal(available.canReviveLeader, true);
});

void test('JSON-restored history is deterministic and malformed or impossible histories reject', () => {
  const input = choice({
    revivalFaction: 'emperor',
    revivalSpice: 8,
    revivalAmount: 2,
    revivalLeader: 3,
    revivalActions: [
      { kind: 'forces', amount: 1 },
      { kind: 'leader', leader: 3 },
    ],
  });
  const restored = JSON.parse(
    JSON.stringify(input),
  ) as IntroductionResourceChoice;
  assert.deepEqual(introductionCharity(restored), introductionCharity(input));
  assert.deepEqual(introductionRevival(restored), introductionRevival(input));
  const output = introductionRevival(restored);
  output.leaders[0].dead = false;
  assert.deepEqual(restored, input);

  const invalid = [
    {
      ...input,
      revivalActions: [{ kind: 'forces', amount: 1, extra: true }],
    },
    {
      ...input,
      revivalActions: [
        { kind: 'forces', amount: 1 },
        { kind: 'forces', amount: 1 },
        { kind: 'forces', amount: 1 },
        { kind: 'forces', amount: 1 },
      ],
    },
    {
      ...input,
      revivalSpice: 0,
      revivalActions: [{ kind: 'leader', leader: 0 }],
    },
    {
      ...input,
      revivalActions: [
        { kind: 'forces', amount: 2 },
        { kind: 'forces', amount: 2 },
      ],
    },
  ];
  for (const state of invalid)
    assert.throws(() =>
      introductionRevival(state as IntroductionResourceChoice),
    );
});
