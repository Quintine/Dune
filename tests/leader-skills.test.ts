import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEADER_SKILL_CARDS,
  type LeaderSkillId,
} from '../game/leader-skill-cards';
import {
  LeaderSkillError,
  chooseLeaderSkill,
  createLeaderSkills,
  dealLeaderSkills,
  declineRevivedLeaderSkill,
  drawRevivedLeaderSkills,
  offerRevivedLeaderSkill,
  returnDeadLeaderSkills,
  validateLeaderSkills,
  type LeaderSkillsState,
  type SkillRoster,
} from '../game/leader-skills';

const KEEP_ORDER = () => 0.999999;

function playerIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `player-${index + 1}`);
}

function rosterFor(players: readonly string[]): SkillRoster {
  return players.map((id) => ({
    id,
    leaders: [
      { id: `${id}-leader-1`, dead: false },
      { id: `${id}-leader-2`, dead: false },
    ],
  }));
}

function dealtState(players = ['a', 'b'] as const): LeaderSkillsState {
  return dealLeaderSkills(createLeaderSkills(KEEP_ORDER), players, 'setup-1');
}

function expectImmutableRejection(
  state: LeaderSkillsState,
  action: () => unknown,
  message: RegExp,
): void {
  const snapshot = structuredClone(state);
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof LeaderSkillError);
    assert.match(error.message, message);
    return true;
  });
  assert.deepEqual(state, snapshot);
}

void test('deals every two-card setup hand before any card can return for two through six players', () => {
  const canonical = LEADER_SKILL_CARDS.map((card) => card.id);

  for (let count = 2; count <= 6; count += 1) {
    const players = playerIds(count);
    const pristine = createLeaderSkills(KEEP_ORDER);
    const snapshot = structuredClone(pristine);
    const dealt = dealLeaderSkills(pristine, players, `setup-${count}`);

    assert.deepEqual(pristine, snapshot);
    assert.equal(Object.keys(dealt.offers).length, count);
    assert.equal(dealt.deck.length, 14 - 2 * count);
    assert.deepEqual(dealt.assignments, []);
    assert.deepEqual(
      players.flatMap((player) => dealt.offers[player].cards),
      canonical.slice(0, 2 * count),
    );
    for (const player of players) {
      assert.deepEqual(dealt.offers[player], {
        event: `setup-${count}`,
        cards: canonical.slice(
          players.indexOf(player) * 2,
          players.indexOf(player) * 2 + 2,
        ),
        leader: null,
      });
    }
    validateLeaderSkills(dealt, rosterFor(players));
  }
});

void test('chooses one physical card once, returns the rejected card, and preserves all fourteen cards', () => {
  const before = dealtState();
  const snapshot = structuredClone(before);
  const [kept, returned] = before.offers.a.cards;
  const chosen = chooseLeaderSkill(
    before,
    'a',
    'setup-1',
    kept,
    'a-leader-1',
    ['a-leader-1', 'a-leader-2'],
    KEEP_ORDER,
  );

  assert.deepEqual(before, snapshot);
  assert.deepEqual(chosen.assignments, [
    { owner: 'a', leader: 'a-leader-1', skill: kept },
  ]);
  assert.equal(chosen.offers.a, undefined);
  assert.ok(chosen.deck.includes(returned));
  assert.equal(chosen.deck.includes(kept), false);
  validateLeaderSkills(chosen, rosterFor(['a', 'b']));

  expectImmutableRejection(
    chosen,
    () =>
      chooseLeaderSkill(
        chosen,
        'a',
        'setup-1',
        kept,
        'a-leader-2',
        ['a-leader-2'],
        KEEP_ORDER,
      ),
    /current Leader Skill cards|already has an assigned Leader Skill/,
  );
});

void test('saved custody rejects an offer for an owner who already has an assigned skill', () => {
  const offered = dealtState();
  const assigned = chooseLeaderSkill(
    offered,
    'a',
    'setup-1',
    offered.offers.a.cards[0],
    'a-leader-1',
    ['a-leader-1', 'a-leader-2'],
    KEEP_ORDER,
  );
  const invalid = structuredClone(assigned);
  invalid.offers.a = {
    event: 'impossible-second-offer',
    cards: invalid.deck.splice(0, 2),
    leader: null,
  };
  assert.throws(
    () => validateLeaderSkills(invalid, rosterFor(['a', 'b'])),
    /assignment|offer|original skill/i,
  );
});

void test('rejects the wrong owner, event, physical card, or leader without changing custody', () => {
  const state = dealtState();
  const card = state.offers.a.cards[0];
  const unofferedCard = state.deck[0];

  const attempts: [() => unknown, RegExp][] = [
    [
      () =>
        chooseLeaderSkill(
          state,
          'intruder',
          'setup-1',
          card,
          'a-leader-1',
          ['a-leader-1'],
          KEEP_ORDER,
        ),
      /current Leader Skill cards/,
    ],
    [
      () =>
        chooseLeaderSkill(
          state,
          'a',
          'stale-event',
          card,
          'a-leader-1',
          ['a-leader-1'],
          KEEP_ORDER,
        ),
      /current Leader Skill cards/,
    ],
    [
      () =>
        chooseLeaderSkill(
          state,
          'a',
          'setup-1',
          unofferedCard,
          'a-leader-1',
          ['a-leader-1'],
          KEEP_ORDER,
        ),
      /current Leader Skill cards/,
    ],
    [
      () =>
        chooseLeaderSkill(
          state,
          'a',
          'setup-1',
          card,
          'a-captured-or-dead-leader',
          ['a-leader-1'],
          KEEP_ORDER,
        ),
      /eligible living leader/,
    ],
  ];

  for (const [action, message] of attempts)
    expectImmutableRejection(state, action, message);

  expectImmutableRejection(
    state,
    () =>
      chooseLeaderSkill(
        state,
        'a',
        'setup-1',
        card,
        'a-leader-1',
        ['a-leader-1'],
        () => Number.NaN,
      ),
    /Invalid skill shuffle/,
  );
});

void test('setup input rejection leaves the pristine physical inventory untouched', () => {
  const state = createLeaderSkills(KEEP_ORDER);
  const attempts: [readonly string[], string][] = [
    [['a'], 'setup'],
    [['a', 'b', 'c', 'd', 'e', 'f', 'g'], 'setup'],
    [['a', 'a'], 'setup'],
    [['a', 'b'], ''],
  ];

  for (const [players, event] of attempts)
    expectImmutableRejection(
      state,
      () => dealLeaderSkills(state, players, event),
      /two through six distinct skill recipients/,
    );
});

void test('death returns a skill exactly once while a living captured leader keeps it attached', () => {
  const offered = dealtState();
  const skill = offered.offers.a.cards[0];
  const assigned = chooseLeaderSkill(
    offered,
    'a',
    'setup-1',
    skill,
    'a-leader-1',
    ['a-leader-1'],
    KEEP_ORDER,
  );
  const capturedRoster: SkillRoster = [
    {
      id: 'a',
      leaders: [
        { id: 'a-leader-1', dead: false, capturedBy: 'b' },
        { id: 'a-leader-2', dead: false },
      ],
    },
    ...rosterFor(['b']),
  ];

  const captured = returnDeadLeaderSkills(assigned, capturedRoster, KEEP_ORDER);
  assert.equal(captured.state, assigned);
  assert.deepEqual(captured.returned, []);
  assert.deepEqual(captured.state.assignments, assigned.assignments);
  assert.equal(
    offerRevivedLeaderSkill(assigned, 'a', 'a-leader-2', 'revival-blocked'),
    assigned,
  );

  const deathRoster: SkillRoster = [
    {
      id: 'a',
      leaders: [
        { id: 'a-leader-1', dead: true, capturedBy: 'b' },
        { id: 'a-leader-2', dead: false },
      ],
    },
    ...rosterFor(['b']),
  ];
  const assignedSnapshot = structuredClone(assigned);
  const death = returnDeadLeaderSkills(assigned, deathRoster, KEEP_ORDER);
  assert.deepEqual(assigned, assignedSnapshot);
  assert.deepEqual(death.returned, [
    { owner: 'a', leader: 'a-leader-1', skill },
  ]);
  assert.deepEqual(death.state.assignments, []);
  assert.ok(death.state.deck.includes(skill));

  let secondShuffleCalls = 0;
  const repeated = returnDeadLeaderSkills(death.state, deathRoster, () => {
    secondShuffleCalls += 1;
    return 0;
  });
  assert.equal(repeated.state, death.state);
  assert.deepEqual(repeated.returned, []);
  assert.equal(secondShuffleCalls, 0);
  validateLeaderSkills(death.state, capturedRoster);
});

void test('revival asks whether to draw before the private preview and requires a keep after drawing', () => {
  const initial = createLeaderSkills(KEEP_ORDER);
  const originalDeck = [...initial.deck];
  const offered = offerRevivedLeaderSkill(
    initial,
    'a',
    'a-leader-1',
    'revival-1',
  );

  assert.deepEqual(initial.deck, originalDeck);
  assert.deepEqual(offered.offers.a, {
    event: 'revival-1',
    cards: [],
    leader: 'a-leader-1',
  });
  assert.deepEqual(offered.deck, originalDeck);

  const declined = declineRevivedLeaderSkill(offered, 'a', 'revival-1');
  assert.equal(declined.offers.a, undefined);
  assert.deepEqual(declined.deck, originalDeck);

  const redrawnOffer = offerRevivedLeaderSkill(
    declined,
    'a',
    'a-leader-1',
    'revival-2',
  );
  const preview = drawRevivedLeaderSkills(redrawnOffer, 'a', 'revival-2');
  assert.deepEqual(preview.offers.a.cards, originalDeck.slice(0, 2));
  assert.deepEqual(preview.deck, originalDeck.slice(2));

  expectImmutableRejection(
    preview,
    () => declineRevivedLeaderSkill(preview, 'a', 'revival-2'),
    /undrawn revival skill offer/,
  );
  expectImmutableRejection(
    preview,
    () =>
      chooseLeaderSkill(
        preview,
        'a',
        'revival-2',
        preview.offers.a.cards[0],
        'a-leader-2',
        ['a-leader-1', 'a-leader-2'],
        KEEP_ORDER,
      ),
    /eligible living leader/,
  );

  const kept = chooseLeaderSkill(
    preview,
    'a',
    'revival-2',
    preview.offers.a.cards[0],
    'a-leader-1',
    ['a-leader-1'],
    KEEP_ORDER,
  );
  assert.equal(kept.offers.a, undefined);
  assert.deepEqual(kept.assignments, [
    { owner: 'a', leader: 'a-leader-1', skill: originalDeck[0] },
  ]);
  validateLeaderSkills(kept, rosterFor(['a']));
});

void test('saved-state validation rejects duplicate inventory and wrong attachment without mutation', () => {
  const roster = rosterFor(['a', 'b']);
  const state = dealtState();

  const duplicate = structuredClone(state);
  duplicate.deck[duplicate.deck.length - 1] = duplicate.deck[0];
  const duplicateSnapshot = structuredClone(duplicate);
  assert.throws(
    () => validateLeaderSkills(duplicate, roster),
    /preserve all fourteen physical cards exactly once/,
  );
  assert.deepEqual(duplicate, duplicateSnapshot);

  const card = state.offers.a.cards[0];
  const assigned = chooseLeaderSkill(
    state,
    'a',
    'setup-1',
    card,
    'a-leader-1',
    ['a-leader-1'],
    KEEP_ORDER,
  );
  const wrongOwner = structuredClone(assigned);
  wrongOwner.assignments[0].owner = 'b';
  const wrongOwnerSnapshot = structuredClone(wrongOwner);
  assert.throws(
    () => validateLeaderSkills(wrongOwner, roster),
    /original leader/,
  );
  assert.deepEqual(wrongOwner, wrongOwnerSnapshot);
});

void test('canonical physical inventory is unchanged when initial shuffling rejects a bad roll', () => {
  const canonical: LeaderSkillId[] = LEADER_SKILL_CARDS.map((card) => card.id);
  assert.throws(() => createLeaderSkills(() => 1), /Invalid skill shuffle/);
  assert.deepEqual(
    LEADER_SKILL_CARDS.map((card) => card.id),
    canonical,
  );
});
