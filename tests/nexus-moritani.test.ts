import test from 'node:test';
import assert from 'node:assert/strict';
import { TERRITORIES, MOBILE_STRONGHOLD } from '../game/board';
import {
  createTerrorState,
  placeTerror,
  type TerrorState,
} from '../game/moritani-terror';
import {
  createNexusMoritani,
  validateNexusMoritani,
  quoteNexusMoritaniPlacement,
  type NexusMoritaniContext,
  type NexusMoritaniReceipt,
} from '../game/nexus-moritani';

const context: NexusMoritaniContext = {
  turn: 3,
  players: [
    { id: 'm', faction: 'moritani' },
    { id: 'a', faction: 'atreides' },
  ],
};
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const fresh = () => createTerrorState(() => 0.3);

void test('Moritani Cunning places one supply token in every static Arrakis territory without mutating the source', () => {
  const state = fresh(),
    before = clone(state),
    id = state.tokens[0].id;
  state.supplyEpoch = 4;
  before.supplyEpoch = 4;
  for (const territory of TERRITORIES) {
    const receipt = createNexusMoritani(context, 'm', id, territory.id);
    validateNexusMoritani(context, clone(receipt));
    const placed = quoteNexusMoritaniPlacement(state, id, territory.id, 3);
    assert.equal(placed.tokens[0].location, territory.id);
    assert.equal(placed.tokens[0].status, 'placed');
    assert.equal(placed.placementTurn, 3);
    assert.equal(placed.supplyEpoch, 4);
    assert.deepEqual(placed.tokens.slice(1), state.tokens.slice(1));
    placed.tokens[1].status = 'removed';
    assert.deepEqual(state, before);
  }
  assert.throws(
    () => placeTerror(state, id, 'polar_sink', 3),
    /ordinary strongholds/,
  );
});

void test('Moritani Cunning stacks physical tokens but cannot reuse the Mentat allowance or enhance a relocation', () => {
  let state = fresh();
  state = quoteNexusMoritaniPlacement(
    state,
    state.tokens[0].id,
    'hagga_basin',
    1,
  );
  state = quoteNexusMoritaniPlacement(
    state,
    state.tokens[1].id,
    'hagga_basin',
    2,
  );
  assert.equal(
    state.tokens.filter((t) => t.location === 'hagga_basin').length,
    2,
  );
  const before = clone(state);
  for (const turn of [1, 2, 0, -1, 2.5, NaN])
    assert.throws(
      () =>
        quoteNexusMoritaniPlacement(
          state,
          state.tokens[2].id,
          'polar_sink',
          turn,
        ),
      /Moritani Nexus/,
    );
  assert.throws(
    () =>
      quoteNexusMoritaniPlacement(state, state.tokens[0].id, 'polar_sink', 3),
    /relocation/,
  );
  assert.deepEqual(state, before);
  // Its custody is ordinary placed custody; a later unenhanced move may leave it.
  const moved = placeTerror(state, state.tokens[0].id, 'carthag', 3);
  assert.equal(moved.tokens[1].location, 'hagga_basin');
  assert.equal(moved.tokens[0].location, 'carthag');
});

void test('Moritani placement rejects invalid physical inventory and excluded destinations without mutations', () => {
  const state = fresh();
  const edits: ((s: TerrorState) => void)[] = [
    (s) => {
      s.tokens.pop();
    },
    (s) => {
      s.tokens[1].id = s.tokens[0].id;
    },
    (s) => {
      s.tokens[1].kind = s.tokens[0].kind;
    },
    (s) => {
      s.tokens[0].status = 'removed';
    },
    (s) => {
      s.tokens[0].location = 'arrakeen';
    },
    (s) => {
      s.tokens[1].status = 'placed';
      s.tokens[1].location = MOBILE_STRONGHOLD;
    },
    (s) => {
      s.tokens[1].status = 'extortion';
      s.tokens[1].kind = 'robbery';
    },
    (s) => {
      s.supplyEpoch = -1;
    },
    (s) => {
      Object.assign(s, { extraToken: true });
    },
  ];
  for (const edit of edits) {
    const bad = clone(state);
    edit(bad);
    const before = clone(bad);
    assert.throws(
      () =>
        quoteNexusMoritaniPlacement(bad, state.tokens[0].id, 'polar_sink', 3),
      /Moritani Nexus/,
    );
    assert.deepEqual(bad, before);
  }
  for (const destination of [
    MOBILE_STRONGHOLD,
    'homeworld:moritani',
    'arrakeen:10',
    '',
    '__proto__',
  ]) {
    assert.throws(
      () =>
        quoteNexusMoritaniPlacement(state, state.tokens[0].id, destination, 3),
      /Moritani Nexus/,
    );
    assert.throws(
      () => createNexusMoritani(context, 'm', state.tokens[0].id, destination),
      /Moritani Nexus/,
    );
  }
});

void test('Moritani historical receipts preserve original identity after later turns without reading hidden custody or alliances', () => {
  const receipt = createNexusMoritani(
    context,
    'm',
    'physical-token',
    'hagga_basin',
  );
  const later = {
    turn: 9,
    players: [...context.players].reverse().map((p) =>
      Object.defineProperties(
        { ...p },
        {
          hand: {
            get() {
              throw new Error('hidden hand read');
            },
          },
          ally: {
            get() {
              throw new Error('later alliance read');
            },
          },
          moritaniTerror: {
            get() {
              throw new Error('later custody read');
            },
          },
        },
      ),
    ),
  };
  validateNexusMoritani(later, clone(receipt));
  assert.equal(
    receipt.event,
    JSON.stringify(['nexusMoritani', 3, 'm', 'physical-token', 'hagga_basin']),
  );
  assert.notEqual(
    receipt.event,
    createNexusMoritani(context, 'm', 'other-token', 'hagga_basin').event,
  );
});

void test('Moritani receipt rejects deleted or changed source evidence and foreign native owners', () => {
  const receipt = createNexusMoritani(
    context,
    'm',
    'physical-token',
    'hagga_basin',
  );
  const edits: ((r: NexusMoritaniReceipt) => void)[] = [
    (r) => {
      r.token = 'other';
    },
    (r) => {
      r.territory = 'polar_sink';
    },
    (r) => {
      r.turn = 4;
    },
    (r) => {
      r.owner = 'a';
    },
    (r) => {
      r.roster.pop();
    },
    (r) => {
      r.signature = '';
    },
    (r) => {
      r.event = 'other';
    },
    (r) => {
      Object.assign(r, { source: 'grumman', phase: 7 });
    },
    (r) => {
      delete (r as Partial<NexusMoritaniReceipt>).source;
    },
    (r) => {
      Object.assign(r, { stage: 'complete' });
    },
  ];
  for (const edit of edits) {
    const bad = clone(receipt);
    edit(bad);
    const before = clone(bad);
    assert.throws(() => validateNexusMoritani(context, bad), /Moritani Nexus/);
    assert.deepEqual(bad, before);
  }
  assert.throws(
    () => validateNexusMoritani({ ...context, turn: 2 }, receipt),
    /Moritani Nexus/,
  );
  assert.throws(
    () => createNexusMoritani(context, 'a', 'token', 'polar_sink'),
    /Moritani Nexus/,
  );
  assert.throws(
    () =>
      createNexusMoritani(
        { ...context, players: [...context.players, context.players[0]] },
        'm',
        'token',
        'polar_sink',
      ),
    /roster/,
  );
});
