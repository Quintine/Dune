import test from 'node:test';
import assert from 'node:assert/strict';
import {
  quoteAlliedSeparation,
  type AlliedSeparationQuoteContext,
} from '../game/allied-separation';

type TerritoryFacts = AlliedSeparationQuoteContext['territories'][number];

function group(
  territory: string,
  facts: Partial<Omit<TerritoryFacts, 'territory'>> = {},
): TerritoryFacts {
  return {
    territory,
    polar: false,
    ownPresent: true,
    allyPresent: true,
    ownAdvisors: false,
    allyAdvisors: false,
    ecazCoexist: false,
    ...facts,
  };
}

function context(
  overrides: Partial<AlliedSeparationQuoteContext> = {},
): AlliedSeparationQuoteContext {
  return {
    advanced: true,
    turn: 4,
    player: 'ending',
    ally: 'ally',
    playerAllySinceTurn: 2,
    allySinceTurn: 2,
    remaining: ['ending', 'ally', 'other'],
    territories: [group('arrakeen')],
    ...overrides,
  };
}

void test('Advanced separates on the first, intermediate and last allied ending regardless of alliance age', () => {
  for (const remaining of [
    ['ending', 'ally', 'other'],
    ['ending', 'other'],
    ['ending'],
  ]) {
    for (const timestamps of [
      {},
      { playerAllySinceTurn: 2, allySinceTurn: 2 },
      { playerAllySinceTurn: 4, allySinceTurn: 4 },
      { playerAllySinceTurn: 4, allySinceTurn: 2 },
    ]) {
      assert.deepEqual(
        quoteAlliedSeparation(context({
          playerAllySinceTurn: undefined,
          allySinceTurn: undefined,
          remaining,
          ...timestamps,
        })),
        ['arrakeen'],
      );
    }
  }
});

void test('Basic waits for the ally to finish, then exempts only an alliance recorded new for both players', () => {
  const basic = context({ advanced: false });
  assert.deepEqual(quoteAlliedSeparation(basic), []);

  const afterAlly = { ...basic, remaining: ['ending', 'other'] };
  assert.deepEqual(quoteAlliedSeparation(afterAlly), ['arrakeen']);
  assert.deepEqual(quoteAlliedSeparation({
    ...afterAlly,
    playerAllySinceTurn: 4,
    allySinceTurn: 4,
  }), []);

  for (const timestamps of [
    { playerAllySinceTurn: 4, allySinceTurn: 2 },
    { playerAllySinceTurn: 2, allySinceTurn: 4 },
    { playerAllySinceTurn: undefined, allySinceTurn: undefined },
    { playerAllySinceTurn: 4, allySinceTurn: undefined },
    { playerAllySinceTurn: undefined, allySinceTurn: 4 },
  ]) {
    assert.deepEqual(
      quoteAlliedSeparation({ ...afterAlly, ...timestamps }),
      ['arrakeen'],
    );
  }
});

void test('a Basic same-turn alliance loses its exemption next turn while Advanced separates on both turns', () => {
  const newAlliance = context({
    advanced: false,
    playerAllySinceTurn: 4,
    allySinceTurn: 4,
    remaining: ['ending'],
  });
  assert.deepEqual(quoteAlliedSeparation(newAlliance), []);
  assert.deepEqual(quoteAlliedSeparation({ ...newAlliance, turn: 5 }), ['arrakeen']);
  assert.deepEqual(quoteAlliedSeparation({ ...newAlliance, advanced: true }), ['arrakeen']);
  assert.deepEqual(quoteAlliedSeparation({ ...newAlliance, advanced: true, turn: 5 }), ['arrakeen']);
});

void test('only shared non-exempt territories are quoted, preserving each territory independently', () => {
  const territories = [
    group('arrakeen'),
    group('carthag', { ownPresent: false }),
    group('broken_land', { allyPresent: false }),
    group('polar_sink', { polar: true }),
    group('sietch_tabr', { ecazCoexist: true }),
    group('hagga_basin'),
  ];
  for (const advanced of [false, true]) {
    assert.deepEqual(quoteAlliedSeparation(context({
      advanced,
      remaining: ['ending'],
      territories,
    })), ['arrakeen', 'hagga_basin']);
  }
});

void test('ending without an ally never loses forces even when territory facts show shared presence', () => {
  for (const advanced of [false, true]) {
    assert.deepEqual(quoteAlliedSeparation(context({
      advanced,
      ally: null,
      remaining: ['ending'],
      territories: [group('arrakeen'), group('hagga_basin')],
    })), []);
  }
});

void test('Advanced advisors on either side coexist, but conversion to fighters restores separation', () => {
  for (const stance of ['ownAdvisors', 'allyAdvisors'] as const) {
    const advisors = context({
      territories: [group('arrakeen', { [stance]: true }), group('hagga_basin')],
    });
    assert.deepEqual(quoteAlliedSeparation(advisors), ['hagga_basin']);
    assert.deepEqual(quoteAlliedSeparation({
      ...advisors,
      territories: [group('arrakeen'), group('hagga_basin')],
    }), ['arrakeen', 'hagga_basin']);
  }
  assert.deepEqual(quoteAlliedSeparation(context({
    territories: [group('arrakeen', { ownAdvisors: true, allyAdvisors: true })],
  })), []);
});

void test('advisor facts do not introduce a new exemption into Basic legacy separation', () => {
  for (const stances of [
    { ownAdvisors: true },
    { allyAdvisors: true },
    { ownAdvisors: true, allyAdvisors: true },
  ]) {
    assert.deepEqual(quoteAlliedSeparation(context({
      advanced: false,
      remaining: ['ending'],
      territories: [group('arrakeen', stances)],
    })), ['arrakeen']);
  }
});

void test('loss follows current Ecaz coexistence and presence rather than a previous exemption or quote', () => {
  for (const advanced of [false, true]) {
    const occupation = context({
      advanced,
      remaining: ['ending'],
      territories: [group('arrakeen', { ecazCoexist: true })],
    });
    assert.deepEqual(quoteAlliedSeparation(occupation), []);
    const suppressed = { ...occupation, territories: [group('arrakeen')] };
    assert.deepEqual(quoteAlliedSeparation(suppressed), ['arrakeen']);
    assert.deepEqual(quoteAlliedSeparation({
      ...suppressed,
      territories: [group('arrakeen', { allyPresent: false })],
    }), []);
    assert.deepEqual(quoteAlliedSeparation(occupation), []);
  }
});

void test('quoting frozen canonical facts does not change them or retain a mutable result', () => {
  const input = Object.freeze(context({
    remaining: Object.freeze(['ending', 'ally']),
    territories: Object.freeze([
      Object.freeze(group('arrakeen')),
      Object.freeze(group('carthag', { ownAdvisors: true })),
      Object.freeze(group('polar_sink', { polar: true })),
    ]),
  }));
  const before = structuredClone(input);
  const result = quoteAlliedSeparation(input);
  assert.deepEqual(result, ['arrakeen']);
  result.splice(0, 1, 'carthag');
  assert.deepEqual(quoteAlliedSeparation(input), ['arrakeen']);
  assert.deepEqual(input, before);
});
