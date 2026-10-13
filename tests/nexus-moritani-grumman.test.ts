import test from 'node:test';
import assert from 'node:assert/strict';
import { TERRITORIES, MOBILE_STRONGHOLD } from '../game/board';
import {
  createTerrorState,
  placeTerror,
  revealTerror,
  type TerrorState,
} from '../game/moritani-terror';
import {
  createNexusMoritani,
  validateNexusMoritani,
  quoteNexusMoritaniPlacement,
  quoteNexusMoritaniGrummanPlacement,
  type NexusMoritaniContext,
  type NexusMoritaniGrummanSource,
  type NexusMoritaniReceipt,
} from '../game/nexus-moritani';

const context: NexusMoritaniContext = {
  turn: 3,
  players: [
    { id: 'm', faction: 'moritani' },
    { id: 'a', faction: 'atreides' },
  ],
};
const source: NexusMoritaniGrummanSource = {
  source: 'grumman',
  sourceEvent: JSON.stringify(['grummanCollection', 3, 'm']),
  prerequisite: 'arrakeen',
};
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const fresh = () => createTerrorState(() => 0.3);
const eligible = (turn = 1) => {
  const state = fresh();
  return placeTerror(state, state.tokens[0].id, 'arrakeen', turn);
};
const grummanEvent = (receipt: Extract<NexusMoritaniReceipt, { source: 'grumman' }>) =>
  JSON.stringify([
    'nexusMoritaniGrumman',
    receipt.turn,
    receipt.owner,
    receipt.token,
    receipt.territory,
    receipt.sourceEvent,
    receipt.prerequisite,
  ]);

void test('Grumman Cunning receipts bind the native source and ordinary prerequisite to their event and signature', () => {
  const receipt = createNexusMoritani(context, 'm', 'supply-token', 'polar_sink', source);
  assert.equal(receipt.source, 'grumman');
  if (receipt.source !== 'grumman') throw new Error('Expected Grumman receipt');
  assert.equal(receipt.phase, 7);
  assert.equal(receipt.event, grummanEvent(receipt));
  validateNexusMoritani({ ...context, turn: 8 }, clone(receipt));
  assert.notEqual(
    receipt.event,
    createNexusMoritani(context, 'm', 'supply-token', 'polar_sink', {
      ...source,
      sourceEvent: 'another-native-operation',
    }).event,
  );
  assert.notEqual(
    receipt.event,
    createNexusMoritani(context, 'm', 'supply-token', 'polar_sink', {
      ...source,
      prerequisite: 'carthag',
    }).event,
  );
  const edits: ((r: Extract<NexusMoritaniReceipt, { source: 'grumman' }>) => void)[] = [
    (r) => { r.sourceEvent = 'other-source'; },
    (r) => { r.prerequisite = 'carthag'; },
    (r) => { r.sourceEvent = 'other-source'; r.event = grummanEvent(r); },
    (r) => { r.prerequisite = 'carthag'; r.event = grummanEvent(r); },
    (r) => { r.token = 'other-token'; },
    (r) => { r.territory = 'hagga_basin'; },
    (r) => { r.turn = 2; },
    (r) => { r.owner = 'a'; },
    (r) => { Object.assign(r, { source: 'mentat', phase: 8 }); },
    (r) => { Object.assign(r, { phase: 8 }); },
    (r) => { delete (r as Partial<Extract<NexusMoritaniReceipt, { source: 'grumman' }>>).sourceEvent; },
    (r) => { delete (r as Partial<Extract<NexusMoritaniReceipt, { source: 'grumman' }>>).prerequisite; },
    (r) => { r.signature = ''; },
  ];
  for (const edit of edits) {
    const bad: Extract<NexusMoritaniReceipt, { source: 'grumman' }> = clone(receipt);
    edit(bad);
    const before: typeof bad = clone(bad);
    assert.throws(() => validateNexusMoritani(context, bad));
    assert.deepEqual(bad, before);
  }
  assert.throws(() => validateNexusMoritani({ ...context, turn: 2 }, receipt));
  for (const prerequisite of ['polar_sink', MOBILE_STRONGHOLD, 'homeworld:moritani', ''])
    assert.throws(() => createNexusMoritani(context, 'm', 'token', 'polar_sink', {
      ...source,
      prerequisite,
    }));
  assert.throws(() => createNexusMoritani(context, 'm', 'token', 'polar_sink', {
    ...source,
    sourceEvent: '',
  }));
});

void test('Existing Mentat evidence authenticates independently of the new Collection source', () => {
  const legacy: NexusMoritaniReceipt = {
    version: 1,
    event: JSON.stringify(['nexusMoritani', 3, 'm', 'token', 'hagga_basin']),
    source: 'mentat',
    phase: 8,
    turn: 3,
    owner: 'm',
    token: 'token',
    territory: 'hagga_basin',
    roster: [{ id: 'a', faction: 'atreides' }, { id: 'm', faction: 'moritani' }],
    signature: '',
  };
  legacy.signature = JSON.stringify([
    1, legacy.event, 'mentat', 8, 3, 'm', 'token', 'hagga_basin',
    [['a', 'atreides'], ['m', 'moritani']],
  ]);
  validateNexusMoritani(context, legacy);
  const current = createNexusMoritani(context, 'm', 'token', 'hagga_basin');
  assert.equal(current.event, legacy.event);
  assert.equal(current.signature, legacy.signature);
  validateNexusMoritani(context, current);
  assert.throws(() => validateNexusMoritani(context, {
    ...legacy,
    source: 'grumman',
    phase: 7,
    sourceEvent: source.sourceEvent,
    prerequisite: source.prerequisite,
  }));
});

void test('Grumman Cunning broadens an available ordinary addition to every printed static territory, including empty desert and stacks', () => {
  const state = eligible();
  const before = clone(state);
  const id = state.tokens[1].id;
  for (const territory of TERRITORIES) {
    const placed = quoteNexusMoritaniGrummanPlacement(state, id, territory.id, 'arrakeen');
    assert.equal(placed.tokens[1].status, 'placed');
    assert.equal(placed.tokens[1].location, territory.id);
    assert.equal(placed.placementTurn, state.placementTurn);
    assert.deepEqual(placed.tokens.filter((token) => token.id !== id), state.tokens.filter((token) => token.id !== id));
    if (territory.id === 'arrakeen')
      assert.equal(placed.tokens.filter((token) => token.location === 'arrakeen').length, 2);
  }
  assert.deepEqual(state, before);
  const desert = quoteNexusMoritaniGrummanPlacement(state, id, 'hagga_basin', 'arrakeen');
  const stacked = quoteNexusMoritaniGrummanPlacement(desert, desert.tokens[2].id, 'hagga_basin', 'arrakeen');
  assert.equal(stacked.tokens.filter((token) => token.location === 'hagga_basin').length, 2);
});

void test('Grumman Cunning requires an actually eligible ordinary stronghold before broadening the destination', () => {
  const empty = fresh();
  const desertOnly = quoteNexusMoritaniPlacement(empty, empty.tokens[0].id, 'hagga_basin', 1);
  const ordinary = eligible();
  for (const [state, prerequisite] of [
    [empty, 'arrakeen'],
    [desertOnly, 'arrakeen'],
    [desertOnly, 'hagga_basin'],
    [ordinary, 'carthag'],
    [ordinary, MOBILE_STRONGHOLD],
    [ordinary, 'homeworld:moritani'],
  ] as const) {
    const before = clone(state);
    assert.throws(() => quoteNexusMoritaniGrummanPlacement(state, state.tokens[1].id, 'polar_sink', prerequisite));
    assert.deepEqual(state, before);
  }
});

void test('Grumman Cunning cannot create supply, reuse revealed tokens or enhance relocation, and rejects excluded destinations', () => {
  const state = eligible();
  const revealed = revealTerror(state, state.tokens[0].id);
  for (const [stock, id] of [
    [state, 'invented-token'],
    [state, state.tokens[0].id],
    [revealed, revealed.tokens[0].id],
  ] as const) {
    const before = clone(stock);
    assert.throws(() => quoteNexusMoritaniGrummanPlacement(stock, id, 'polar_sink', 'arrakeen'));
    assert.deepEqual(stock, before);
  }
  for (const territory of [MOBILE_STRONGHOLD, 'homeworld:moritani', 'arrakeen:10', '', '__proto__']) {
    assert.throws(() => quoteNexusMoritaniGrummanPlacement(state, state.tokens[1].id, territory, 'arrakeen'));
    assert.throws(() => createNexusMoritani(context, 'm', state.tokens[1].id, territory, source));
  }
  const edits: ((stock: TerrorState) => void)[] = [
    (stock) => { stock.tokens.pop(); },
    (stock) => { stock.tokens[2].id = stock.tokens[1].id; },
    (stock) => { stock.tokens[2].kind = stock.tokens[1].kind; },
    (stock) => { stock.tokens[1].location = 'arrakeen'; },
    (stock) => { stock.supplyEpoch = -1; },
  ];
  for (const edit of edits) {
    const bad = clone(state);
    edit(bad);
    const before = clone(bad);
    assert.throws(() => quoteNexusMoritaniGrummanPlacement(bad, state.tokens[1].id, 'polar_sink', 'arrakeen'));
    assert.deepEqual(bad, before);
  }
});

void test('Grumman Cunning preserves the physical faces, other placements, supply epoch and independent Mentat allowance', () => {
  let state = eligible();
  state = quoteNexusMoritaniPlacement(state, state.tokens[1].id, 'hagga_basin', 2);
  state.supplyEpoch = 4;
  const before = clone(state);
  const placed = quoteNexusMoritaniGrummanPlacement(state, state.tokens[2].id, 'polar_sink', 'arrakeen');
  assert.deepEqual(placed.tokens.map(({ id, kind }) => ({ id, kind })), state.tokens.map(({ id, kind }) => ({ id, kind })));
  assert.deepEqual(placed.tokens.filter((token) => token.id !== state.tokens[2].id), state.tokens.filter((token) => token.id !== state.tokens[2].id));
  assert.equal(placed.supplyEpoch, 4);
  assert.equal(placed.placementTurn, 2);
  const mentat = quoteNexusMoritaniPlacement(placed, placed.tokens[3].id, 'carthag', 3);
  assert.equal(mentat.placementTurn, 3);
  assert.equal(mentat.tokens[2].location, 'polar_sink');
  placed.tokens[0].location = 'carthag';
  placed.tokens[4].status = 'removed';
  assert.deepEqual(state, before);

  const alreadySpent = eligible(3);
  const collection = quoteNexusMoritaniGrummanPlacement(alreadySpent, alreadySpent.tokens[1].id, 'hagga_basin', 'arrakeen');
  assert.equal(collection.placementTurn, 3);
  assert.throws(() => quoteNexusMoritaniPlacement(collection, collection.tokens[2].id, 'carthag', 3));
});
