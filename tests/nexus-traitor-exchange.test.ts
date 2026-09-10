import test from 'node:test';
import assert from 'node:assert/strict';
import {
  beginNexusTraitorExchange,
  finishNexusTraitorExchange,
  validateNexusTraitorExchange,
  validateNexusTraitorSnapshot,
  validateNexusTraitorHistory,
  nexusTraitorReturnChoices,
  type NexusTraitorSnapshot,
  type NexusTraitorExchange,
} from '../game/nexus-traitor-exchange';

const universe = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const reload = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function fixture(
  mode: 'cunning' | 'secretAlly' = 'cunning',
  dancer = false,
): NexusTraitorSnapshot {
  return {
    reserve: ['e', 'f', 'g', 'h'],
    players: [
      dancer
        ? {
            id: 'owner',
            faction: 'tleilaxu',
            traitors: [],
            faceDancers: [
              { leader: 'a', revealed: true },
              { leader: 'b', revealed: false },
              { leader: 'c', revealed: true },
            ],
          }
        : {
            id: 'owner',
            faction: mode === 'cunning' ? 'harkonnen' : 'emperor',
            traitors: ['a', 'b', 'c'],
          },
      { id: 'other', faction: 'guild', traitors: ['d'] },
    ],
  };
}
function input(mode: 'cunning' | 'secretAlly' = 'cunning') {
  return { event: 'exchange-1', owner: 'owner', mode, turn: 3, phase: 8 };
}
void test('Cunning draws the original top card before return and shuffles only after choosing from the augmented hand', () => {
  const initial = fixture(),
    before = reload(initial);
  const begun = beginNexusTraitorExchange(initial, universe, input());
  assert.deepEqual(initial, before);
  assert.deepEqual(begun.exchange.before, ['a', 'b', 'c']);
  assert.deepEqual(begun.exchange.drawn, ['e']);
  assert.deepEqual(begun.state.players[0].traitors, ['a', 'b', 'c', 'e']);
  assert.deepEqual(begun.state.reserve, ['f', 'g', 'h']);
  assert.deepEqual(
    nexusTraitorReturnChoices(begun.state, universe, begun.exchange),
    ['a', 'b', 'c', 'e'],
  );
  let calls = 0;
  const done = finishNexusTraitorExchange(
    begun.state,
    universe,
    begun.exchange,
    ['b'],
    () => {
      calls++;
      return 0.999;
    },
  );
  assert.equal(calls, 3);
  assert.deepEqual(done.state.reserve, ['f', 'g', 'h', 'b']);
  assert.deepEqual(done.state.players[0].traitors, ['a', 'c', 'e']);
  assert.deepEqual(done.state.players[1], initial.players[1]);
  assert.deepEqual(begun.state.players[0].traitors, ['a', 'b', 'c', 'e']);
  validateNexusTraitorExchange(
    reload(done.state),
    universe,
    reload(done.exchange),
  );
  validateNexusTraitorHistory(universe, reload(done.exchange));
  assert.throws(() =>
    finishNexusTraitorExchange(
      done.state,
      universe,
      done.exchange,
      ['e'],
      () => 0,
    ),
  );
});
void test('Secret Ally draws both cards first and allows returning either original or newly drawn identities', () => {
  const begun = beginNexusTraitorExchange(
    fixture('secretAlly'),
    universe,
    input('secretAlly'),
  );
  assert.deepEqual(begun.exchange.drawn, ['e', 'f']);
  assert.deepEqual(begun.state.players[0].traitors, ['a', 'b', 'c', 'e', 'f']);
  for (const selected of [
    ['a', 'f'],
    ['e', 'f'],
    ['a', 'b'],
  ]) {
    const done = finishNexusTraitorExchange(
      begun.state,
      universe,
      begun.exchange,
      selected,
      () => 0,
    );
    assert.equal(done.state.players[0].traitors.length, 3);
    assert.deepEqual(done.exchange.returned, selected);
    assert.ok(selected.every((id) => done.state.reserve.includes(id)));
    validateNexusTraitorHistory(universe, done.exchange);
  }
});
void test('Tleilaxu retains original revealed flags and protects those cards while new retained Face Dancers start unrevealed', () => {
  const initial = fixture('secretAlly', true);
  const begun = beginNexusTraitorExchange(
    initial,
    universe,
    input('secretAlly'),
  );
  assert.deepEqual(begun.state.players[0].faceDancers, [
    ...initial.players[0].faceDancers!,
    { leader: 'e', revealed: false },
    { leader: 'f', revealed: false },
  ]);
  assert.deepEqual(
    nexusTraitorReturnChoices(begun.state, universe, begun.exchange),
    ['b', 'e', 'f'],
  );
  assert.throws(() =>
    finishNexusTraitorExchange(
      begun.state,
      universe,
      begun.exchange,
      ['a', 'e'],
      () => {
        throw Error('Invalid selection cannot shuffle');
      },
    ),
  );
  const done = finishNexusTraitorExchange(
    begun.state,
    universe,
    begun.exchange,
    ['b', 'e'],
    () => 0.999,
  );
  assert.deepEqual(done.state.players[0].faceDancers, [
    { leader: 'a', revealed: true },
    { leader: 'c', revealed: true },
    { leader: 'f', revealed: false },
  ]);
  assert.deepEqual(done.state.players[0].traitors, []);
  validateNexusTraitorHistory(universe, reload(done.exchange));
});
void test('revealed Tleilaxu cards stay protected even when all original cards have revealed', () => {
  const initial = fixture('secretAlly', true);
  initial.players[0].faceDancers!.forEach((c) => {
    c.revealed = true;
  });
  const begun = beginNexusTraitorExchange(
    initial,
    universe,
    input('secretAlly'),
  );
  assert.deepEqual(
    nexusTraitorReturnChoices(begun.state, universe, begun.exchange),
    ['e', 'f'],
  );
  const done = finishNexusTraitorExchange(
    begun.state,
    universe,
    begun.exchange,
    ['e', 'f'],
    () => 0.999,
  );
  assert.deepEqual(
    done.state.players[0].faceDancers,
    initial.players[0].faceDancers,
  );
});
void test('insufficient reserve cannot use returns to fund the original draw', () => {
  const state = fixture('secretAlly');
  state.players[1].traitors.push(...state.reserve.splice(0, 3));
  const before = reload(state);
  assert.throws(() =>
    beginNexusTraitorExchange(state, universe, input('secretAlly')),
  );
  assert.deepEqual(state, before);
});
void test('wrong faction modes, malformed metadata and unsupported Betrayal reject before changing custody', () => {
  const state = fixture(),
    before = reload(state);
  for (const change of [
    { mode: 'secretAlly' },
    { mode: 'betrayal' },
    { owner: 'other' },
    { owner: 'missing' },
    { turn: 0 },
    { turn: Infinity },
    { phase: 9 },
    { phase: 1.5 },
    { event: '' },
  ])
    assert.throws(() =>
      beginNexusTraitorExchange(state, universe, {
        ...input(),
        ...change,
      } as ReturnType<typeof input>),
    );
  assert.deepEqual(state, before);
});
void test('invalid exact return counts, duplicates, foreign cards and invalid randomness reject immutable snapshots', () => {
  const begun = beginNexusTraitorExchange(
    fixture('secretAlly'),
    universe,
    input('secretAlly'),
  );
  const before = reload(begun);
  for (const selected of [
    [],
    ['a'],
    ['a', 'a'],
    ['a', 'b', 'c'],
    ['a', 'd'],
    ['a', 'unknown'],
  ])
    assert.throws(() =>
      finishNexusTraitorExchange(
        begun.state,
        universe,
        begun.exchange,
        selected,
        () => {
          throw Error('No RNG on rejected selection');
        },
      ),
    );
  for (const value of [-1, 1, NaN, Infinity])
    assert.throws(() =>
      finishNexusTraitorExchange(
        begun.state,
        universe,
        begun.exchange,
        ['a', 'b'],
        () => value,
      ),
    );
  assert.deepEqual(begun, before);
});
void test('physical census rejects duplicate, missing and unknown cards and conflicting typed hands', () => {
  for (const mutate of [
    (s: NexusTraitorSnapshot) => {
      s.reserve[0] = 'a';
    },
    (s: NexusTraitorSnapshot) => {
      s.reserve.pop();
    },
    (s: NexusTraitorSnapshot) => {
      s.reserve[0] = 'unknown';
    },
    (s: NexusTraitorSnapshot) => {
      s.players[1].id = s.players[0].id;
    },
    (s: NexusTraitorSnapshot) => {
      s.players[0].id = '__proto__';
    },
    (s: NexusTraitorSnapshot) => {
      s.players[0].faceDancers = [];
    },
  ]) {
    const state = fixture();
    mutate(state);
    const before = reload(state);
    assert.throws(() => validateNexusTraitorSnapshot(state, universe));
    assert.deepEqual(state, before);
  }
  const dancer = fixture('secretAlly', true);
  dancer.players[0].traitors = ['a'];
  assert.throws(() => validateNexusTraitorSnapshot(dancer, universe));
  assert.throws(() =>
    validateNexusTraitorSnapshot(fixture(), [...universe, 'a']),
  );
});
void test('pending state binds original reserve order, owner augmented hand and every other player', () => {
  const begun = beginNexusTraitorExchange(fixture(), universe, input());
  for (const mutate of [
    (s: NexusTraitorSnapshot) => {
      s.reserve.reverse();
    },
    (s: NexusTraitorSnapshot) => {
      s.players[0].traitors.reverse();
    },
    (s: NexusTraitorSnapshot) => {
      [s.players[1].traitors[0], s.reserve[0]] = [
        s.reserve[0],
        s.players[1].traitors[0],
      ];
    },
  ]) {
    const state = reload(begun.state);
    mutate(state);
    validateNexusTraitorSnapshot(state, universe);
    assert.throws(() =>
      validateNexusTraitorExchange(state, universe, begun.exchange),
    );
  }
});
void test('signed completed history rejects alteration but remains valid after later legitimate card custody changes', () => {
  const begun = beginNexusTraitorExchange(fixture(), universe, input());
  const done = finishNexusTraitorExchange(
    begun.state,
    universe,
    begun.exchange,
    ['a'],
    () => 0.999,
  );
  for (const mutate of [
    (r: NexusTraitorExchange) => {
      r.stage = 'return';
    },
    (r: NexusTraitorExchange) => {
      r.returned = ['b'];
    },
    (r: NexusTraitorExchange) => {
      r.drawn = ['f'];
    },
    (r: NexusTraitorExchange) => {
      r.before.reverse();
    },
    (r: NexusTraitorExchange) => {
      r.source.reserve.reverse();
    },
    (r: NexusTraitorExchange) => {
      r.settledReserve!.reverse();
    },
    (r: NexusTraitorExchange) => {
      r.turn++;
    },
  ]) {
    const receipt = reload(done.exchange);
    mutate(receipt);
    assert.throws(() => validateNexusTraitorHistory(universe, receipt));
  }
  const later = reload(done.state);
  [later.players[1].traitors[0], later.reserve[0]] = [
    later.reserve[0],
    later.players[1].traitors[0],
  ];
  validateNexusTraitorSnapshot(later, universe);
  validateNexusTraitorHistory(universe, done.exchange);
  assert.throws(() =>
    validateNexusTraitorExchange(later, universe, done.exchange),
  );
});
