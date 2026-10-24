import test from 'node:test';
import assert from 'node:assert/strict';
import { MOBILE_STRONGHOLD as HMS, TERRITORIES } from '../game/board';
import {
  blockAmbassadorPlacement,
  createAmbassadors,
  placeAmbassador,
} from '../game/ecaz-ambassadors';
import {
  ambassadorPlacementDestination,
  ambassadorPlacementDestinations,
  quoteEcazAmbassadorPlacement as quote,
  type AmbassadorPlacementBoard,
} from '../game/ecaz-ambassador-placement';

function fixture(): AmbassadorPlacementBoard {
  return {
    turn: 3,
    storm: 18,
    mobileStronghold: { location: 'polar_sink:0' },
    ecazAmbassadors: createAmbassadors(() => 0),
  };
}
function supply(g: AmbassadorPlacementBoard): string[] {
  return g.ecazAmbassadors!.tokens
    .filter((token) => token.zone === 'supply')
    .map((token) => token.id);
}
function rejectUnchanged(
  g: AmbassadorPlacementBoard,
  token = supply(g)[0],
  to = HMS,
  spice = 10,
  message?: RegExp,
) {
  const before = structuredClone(g), owner = { spice };
  if (message) assert.throws(() => quote(g, owner, token, to), message);
  else assert.throws(() => quote(g, owner, token, to));
  assert.deepEqual(g, before);
  assert.deepEqual(owner, { spice });
}

void test('a placed HMS is a sheltered Ambassador destination even when its pointer is in the storm', () => {
  for (const pointer of ['polar_sink:0', 'arsunt:11']) {
    const g = fixture(), owner = { spice: 1 };
    g.mobileStronghold = { location: pointer };
    g.storm = pointer === 'polar_sink:0' ? 0 : 11;
    const before = structuredClone(g), token = supply(g)[0];
    const destination = ambassadorPlacementDestination(g, HMS);
    assert.deepEqual(destination, {
      id: HMS, stronghold: true, inStorm: false, allowed: true,
    });
    assert.deepEqual(
      ambassadorPlacementDestinations(g).find((candidate) => candidate.id === HMS),
      { id: HMS, name: 'Hidden Mobile Stronghold', sheltered: true },
    );
    const result = quote(g, owner, token, HMS);
    assert.deepEqual(result, placeAmbassador(g.ecazAmbassadors!, token, {
      turn: g.turn, availableSpice: owner.spice, destination,
    }));
    assert.equal(result.cost, 1);
    assert.equal(result.state.tokens.find((candidate) => candidate.id === token)?.location, HMS);
    assert.deepEqual(result.state.placement, { turn: 3, count: 1, blocked: false });
    assert.deepEqual(g, before);
    assert.deepEqual(owner, { spice: 1 });
  }
});

void test('unplaced and malformed HMS pointers never create an Ambassador destination', () => {
  const mobileStates: AmbassadorPlacementBoard['mobileStronghold'][] = [
    undefined,
    null,
    { location: null },
    ...[
      '', 'missing:0', 'arrakeen:10', `${HMS}:0`, 'cistern:0',
      'arsunt:0', 'arsunt:11:1', 'polar_sink:', 'polar_sink:00', 'arsunt:NaN',
    ].map((location) => ({ location })),
  ];
  for (const mobileStronghold of mobileStates) {
    const g = fixture();
    g.mobileStronghold = mobileStronghold;
    assert.deepEqual(ambassadorPlacementDestination(g, HMS), {
      id: HMS, stronghold: false, inStorm: true, allowed: false,
    });
    assert.equal(ambassadorPlacementDestinations(g).some((to) => to.id === HMS), false);
    rejectUnchanged(g, undefined, HMS, 10, /eligible stronghold outside the storm/);
  }
});

void test('choices retain printed storm legality and admit only the placed HMS among dynamic locations', () => {
  const g = fixture();
  g.storm = 11;
  g.mobileStronghold = { location: 'arsunt:11' };
  const before = structuredClone(g), choices = ambassadorPlacementDestinations(g);
  assert.deepEqual(choices, [
    ...TERRITORIES.filter((to) => to.type === 'stronghold' && !to.sectors.includes(g.storm))
      .map(({ id, name }) => ({ id, name, sheltered: false })),
    { id: HMS, name: 'Hidden Mobile Stronghold', sheltered: true },
  ]);
  assert.equal(choices.some((to) => to.id === 'carthag'), false);
  assert.deepEqual(ambassadorPlacementDestination(g, 'carthag'), {
    id: 'carthag', stronghold: true, inStorm: true, allowed: true,
  });
  rejectUnchanged(g, undefined, 'carthag', 10, /eligible stronghold outside the storm/);
  for (const to of ['imperial_basin', 'polar_sink', 'cistern', 'kaitain', 'missing'])
    rejectUnchanged(g, undefined, to, 10, /eligible stronghold outside the storm/);
  assert.deepEqual(g, before);
});

void test('HMS placement shares ordinary one two three fees without requiring Ecaz forces or control', () => {
  const g = fixture(), owner = { spice: 6 }, tokens = supply(g);
  for (const [index, to] of ['arrakeen', HMS, 'carthag'].entries()) {
    const before = structuredClone(g), balance = owner.spice;
    const result = quote(g, owner, tokens[index], to);
    assert.equal(result.cost, index + 1);
    assert.deepEqual(g, before);
    assert.equal(owner.spice, balance);
    g.ecazAmbassadors = result.state;
    owner.spice -= result.cost;
  }
  assert.equal(owner.spice, 0);
  assert.deepEqual(g.ecazAmbassadors!.placement, { turn: 3, count: 3, blocked: false });
  assert.equal(ambassadorPlacementDestinations(g).some((to) => to.id === HMS), false);
  rejectUnchanged(g, tokens[3], 'sietch_tabr', 3, /Not enough spice/);
});

void test('one Ambassador of any effect occupies the HMS and an already placed token cannot relocate', () => {
  const g = fixture(), tokens = supply(g);
  const token = g.ecazAmbassadors!.cohort[0];
  g.ecazAmbassadors = quote(g, { spice: 10 }, token, HMS).state;
  assert.equal(ambassadorPlacementDestinations(g).some((to) => to.id === HMS), false);
  rejectUnchanged(g, tokens.find((id) => id !== token), HMS, 10, /already contains an Ambassador/);
  rejectUnchanged(g, token, 'arrakeen', 10, /placed tokens cannot relocate/);
  g.ecazAmbassadors = quote(g, { spice: 10 }, tokens.find((id) => id !== token)!, 'arrakeen').state;
  assert.equal(ambassadorPlacementDestinations(g).some((to) => to.id === 'arrakeen'), false);
  rejectUnchanged(g, tokens[2], 'arrakeen', 10, /already contains an Ambassador/);
});

void test('HMS quotes preserve Karama placement blocking, prior fees and the next-turn reset', () => {
  const g = fixture(), tokens = supply(g);
  g.ecazAmbassadors = quote(g, { spice: 10 }, tokens[0], 'arrakeen').state;
  g.ecazAmbassadors = blockAmbassadorPlacement(g.ecazAmbassadors, g.turn);
  assert.deepEqual(g.ecazAmbassadors.placement, { turn: 3, count: 1, blocked: true });
  rejectUnchanged(g, tokens[1], HMS, 10, /blocked for this turn/);
  g.turn = 2;
  rejectUnchanged(g, tokens[1], HMS, 10, /current Ambassador placement turn/);
  g.turn = 4;
  const before = structuredClone(g), result = quote(g, { spice: 1 }, tokens[1], HMS);
  assert.equal(result.cost, 1);
  assert.deepEqual(result.state.placement, { turn: 4, count: 1, blocked: false });
  assert.deepEqual(g, before);
});

void test('HMS quotes require the original physical supply and an integer spice balance', () => {
  const g = fixture();
  const pool = g.ecazAmbassadors!.tokens.find((token) => token.zone === 'pool')!;
  rejectUnchanged(g, pool.id, HMS, 10, /from your supply/);
  rejectUnchanged(g, 'missing-token', HMS, 10, /from your supply/);
  for (const spice of [0, -1, 0.5, NaN, Infinity]) rejectUnchanged(g, undefined, HMS, spice);
  const noSupply = fixture();
  noSupply.ecazAmbassadors = undefined;
  rejectUnchanged(noSupply, 'missing-token', HMS, 10, /No Ambassador supply/);
});
