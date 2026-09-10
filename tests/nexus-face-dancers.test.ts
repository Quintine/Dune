import test from 'node:test';
import assert from 'node:assert/strict';
import { leaders } from '../game/cards';
import { traitorDeck } from '../game/traitors';
import {
  validateNexusTraitorSnapshot,
  type NexusTraitorSnapshot,
} from '../game/nexus-traitor-exchange';
import {
  replaceNexusFaceDancers,
  validateNexusFaceDancerHistory,
  type NexusFaceDancerReceipt,
} from '../game/nexus-face-dancers';

const universe = traitorDeck(
  ['tleilaxu', 'harkonnen', 'guild'].map((f) => ({
    leaders: leaders(f as 'tleilaxu' | 'harkonnen' | 'guild'),
  })),
  true,
);
const event = { event: 'tleilaxu-nexus-1', owner: 't', turn: 3, phase: 6 };
const reload = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function fixture(revealed = [true, false, true]): NexusTraitorSnapshot {
  return {
    reserve: universe.slice(5),
    players: [
      {
        id: 't',
        faction: 'tleilaxu',
        traitors: [],
        faceDancers: universe
          .slice(0, 3)
          .map((leader, i) => ({ leader, revealed: revealed[i] })),
      },
      { id: 'h', faction: 'harkonnen', traitors: [universe[3]] },
      { id: 'g', faction: 'guild', traitors: [universe[4]] },
    ],
  };
}
void test('one, two or three revealed Face Dancers are replaced as a whole batch before their cards return to the reserve', () => {
  for (const count of [1, 2, 3]) {
    const state = fixture([0, 1, 2].map((i) => i < count)),
      before = reload(state);
    const result = replaceNexusFaceDancers(state, universe, event, () => 0.999);
    assert.deepEqual(state, before);
    assert.deepEqual(result.receipt.replaced, universe.slice(0, count));
    assert.deepEqual(result.receipt.drawn, state.reserve.slice(0, count));
    assert.deepEqual(result.state.reserve, [
      ...state.reserve.slice(count),
      ...universe.slice(0, count),
    ]);
    assert.deepEqual(result.state.players[0].faceDancers, [
      ...state.players[0].faceDancers!.filter((c) => !c.revealed),
      ...state.reserve
        .slice(0, count)
        .map((leader) => ({ leader, revealed: false })),
    ]);
    assert.deepEqual(result.state.players.slice(1), state.players.slice(1));
    assert.equal(
      result.state.players[0].faceDancers!.some((c) =>
        result.receipt.replaced.includes(c.leader),
      ),
      false,
    );
    validateNexusTraitorSnapshot(result.state, universe);
  }
});
void test('replacement order preserves unrevealed originals and never offers a subset or returning new cards', () => {
  const state = fixture([true, false, true]);
  const result = replaceNexusFaceDancers(state, universe, event, () => 0);
  assert.deepEqual(
    result.state.players[0].faceDancers![0],
    state.players[0].faceDancers![1],
  );
  assert.equal(result.state.players[0].faceDancers!.length, 3);
  assert.equal(
    result.state.players[0].faceDancers!.every((c) => c.revealed === false),
    true,
  );
  assert.equal(result.receipt.stage, 'complete');
  assert.throws(() =>
    replaceNexusFaceDancers(
      state,
      universe,
      { ...event, cards: [universe[0]] } as typeof event,
      () => 0,
    ),
  );
  assert.throws(() =>
    replaceNexusFaceDancers(
      result.state,
      universe,
      { ...event, event: 'new-event' },
      () => {
        throw Error('No revealed cards must not shuffle');
      },
    ),
  );
});
void test('zero revealed, undersized reserve and wrong faction reject before randomness or mutation', () => {
  const zero = fixture([false, false, false]);
  const short = fixture();
  short.players[1].traitors.push(...short.reserve.splice(1));
  for (const [state, input] of [
    [zero, event],
    [short, event],
    [fixture(), { ...event, owner: 'h' }],
    [fixture(), { ...event, owner: 'missing' }],
  ] as Array<[NexusTraitorSnapshot, typeof event]>) {
    const before = reload(state);
    let calls = 0;
    assert.throws(() =>
      replaceNexusFaceDancers(state, universe, input, () => {
        calls++;
        return 0;
      }),
    );
    assert.equal(calls, 0);
    assert.deepEqual(state, before);
  }
});
void test('even an exactly sized reserve draws entirely before set-aside cards are shuffled', () => {
  const state = fixture();
  state.players[1].traitors.push(...state.reserve.splice(2));
  const drawn = [...state.reserve];
  const result = replaceNexusFaceDancers(state, universe, event, () => 0);
  assert.deepEqual(result.receipt.drawn, drawn);
  assert.deepEqual(
    [...result.state.reserve].sort(),
    [universe[0], universe[2]].sort(),
  );
  assert.deepEqual(
    result.state.players[0].faceDancers!.slice(1).map((c) => c.leader),
    drawn,
  );
  validateNexusFaceDancerHistory(universe, result.receipt);
});
void test('validated injected randomness shuffles only the remaining reserve and old revealed identities', () => {
  const state = fixture(),
    before = reload(state);
  let calls = 0;
  const result = replaceNexusFaceDancers(state, universe, event, () => {
    calls++;
    return 0;
  });
  assert.equal(calls, state.reserve.length - 1);
  assert.deepEqual(
    [...result.state.reserve].sort(),
    [...state.reserve.slice(2), universe[0], universe[2]].sort(),
  );
  assert.deepEqual(
    result,
    replaceNexusFaceDancers(state, universe, event, () => 0),
  );
  for (const invalid of [-1, 1, NaN, Infinity])
    assert.throws(() =>
      replaceNexusFaceDancers(state, universe, event, () => invalid),
    );
  assert.deepEqual(state, before);
});
void test('history validates JSON independently of later legitimate live custody and output mutations do not alias the receipt', () => {
  const result = replaceNexusFaceDancers(
    fixture(),
    universe,
    event,
    () => 0.999,
  );
  const original = reload(result.receipt);
  validateNexusFaceDancerHistory(universe, reload(result.receipt));
  result.state.players[0].faceDancers![0].revealed = true;
  [result.state.players[1].traitors[0], result.state.reserve[0]] = [
    result.state.reserve[0],
    result.state.players[1].traitors[0],
  ];
  validateNexusTraitorSnapshot(result.state, universe);
  validateNexusFaceDancerHistory(universe, result.receipt);
  assert.deepEqual(result.receipt, original);
});
void test('changed whole-batch history, source statuses, original draw order and settled reserve are detected', () => {
  const receipt = replaceNexusFaceDancers(
    fixture(),
    universe,
    event,
    () => 0.999,
  ).receipt;
  for (const mutate of [
    (r: NexusFaceDancerReceipt) => {
      r.replaced.pop();
    },
    (r: NexusFaceDancerReceipt) => {
      r.replaced.reverse();
    },
    (r: NexusFaceDancerReceipt) => {
      r.drawn.reverse();
    },
    (r: NexusFaceDancerReceipt) => {
      r.source.players[0].faceDancers![0].revealed = false;
    },
    (r: NexusFaceDancerReceipt) => {
      r.source.reserve.reverse();
    },
    (r: NexusFaceDancerReceipt) => {
      r.settledReserve.reverse();
    },
    (r: NexusFaceDancerReceipt) => {
      r.event = 'other';
    },
    (r: NexusFaceDancerReceipt) => {
      r.turn++;
    },
    (r: NexusFaceDancerReceipt) => {
      r.phase++;
    },
    (r: NexusFaceDancerReceipt) => {
      delete (r as Partial<NexusFaceDancerReceipt>).source;
    },
    (r: NexusFaceDancerReceipt) => {
      Object.assign(r, { selected: [] });
    },
  ]) {
    const corrupt = reload(receipt);
    mutate(corrupt);
    const before = reload(corrupt);
    assert.throws(() => validateNexusFaceDancerHistory(universe, corrupt));
    assert.deepEqual(corrupt, before);
  }
});
void test('corrupt physical census and invalid event metadata reject without invoking shuffle', () => {
  for (const mutate of [
    (s: NexusTraitorSnapshot) => {
      s.reserve[0] = s.players[0].faceDancers![0].leader;
    },
    (s: NexusTraitorSnapshot) => {
      s.players[0].traitors = [universe[0]];
    },
    (s: NexusTraitorSnapshot) => {
      s.players[0].faceDancers!.pop();
    },
    (s: NexusTraitorSnapshot) => {
      s.players[1].id = '__proto__';
    },
  ]) {
    const state = fixture();
    mutate(state);
    assert.throws(() =>
      replaceNexusFaceDancers(state, universe, event, () => {
        throw Error('Corrupt census must not shuffle');
      }),
    );
  }
  for (const change of [
    { event: '' },
    { turn: 0 },
    { turn: Infinity },
    { phase: -1 },
    { phase: 9 },
    { phase: 1.5 },
  ])
    assert.throws(() =>
      replaceNexusFaceDancers(
        fixture(),
        universe,
        { ...event, ...change },
        () => {
          throw Error('Invalid event must not shuffle');
        },
      ),
    );
});
