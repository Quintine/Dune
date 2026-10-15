import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRicheseNoField,
  deployRicheseNoField,
  projectRicheseNoField,
  revealRicheseNoField,
  type NoFieldValue,
  type RicheseNoField,
} from '../game/richese-no-field';
import {
  noFieldValueFactMatches,
  parseNoFieldValueFact,
  type NoFieldValueFact,
} from '../game/truthtrance-no-field-value';

function fact(value: NoFieldValue): NoFieldValueFact {
  return { kind: 'noFieldValue', value };
}

function inventory() {
  return createRicheseNoField(['token-zero', 'token-three', 'token-five']);
}

function deployed(value: NoFieldValue) {
  const state = inventory();
  return deployRicheseNoField(state, {
    tokenId: state.tokens.find((token) => token.value === value)!.id,
    controller: 'richese-player',
    location: { territory: 'arrakeen', sector: 10 },
  });
}

void test('only a deployed physical token answers Yes for its exact printed denomination without altering custody', () => {
  for (const printedValue of [0, 3, 5] as const) {
    const state = deployed(printedValue);
    const before = structuredClone(state);
    assert.equal(
      noFieldValueFactMatches(
        state,
        parseNoFieldValueFact({ kind: 'noFieldValue', value: printedValue }),
      ),
      true,
    );
    assert.equal(
      noFieldValueFactMatches(state, fact(printedValue === 5 ? 3 : 5)),
      false,
    );
    assert.deepEqual(state, before);
  }
});

void test('no inventory or undeployed inventory is No, not a concealed zero', () => {
  const state = inventory();
  assert.equal(noFieldValueFactMatches(undefined, fact(0)), false);
  assert.equal(noFieldValueFactMatches(undefined, fact(5)), false);
  assert.equal(noFieldValueFactMatches(state, fact(0)), false);
  assert.equal(noFieldValueFactMatches(state, fact(3)), false);
  assert.equal(noFieldValueFactMatches(deployed(0), fact(0)), true);
});

void test('printed five is independent of capped or exhausted reserves and revelation ends the fact despite last-use history', () => {
  const state = deployed(5);
  const before = structuredClone(state);
  for (const reserves of [2, 0]) {
    assert.equal(noFieldValueFactMatches(state, fact(5)), true);
    const revealed = revealRicheseNoField(state, {
      tokenId: state.deployed!.tokenId,
      reserves,
      cause: 'voluntary',
    });
    assert.equal(revealed.forces, reserves);
    assert.equal(revealed.value, 5);
    assert.equal(projectRicheseNoField(revealed.state, false).lastUsed, 5);
    assert.equal(noFieldValueFactMatches(revealed.state, fact(5)), false);
    assert.equal(noFieldValueFactMatches(revealed.state, fact(0)), false);
    assert.deepEqual(state, before);
  }
});

void test('observation rejects malformed physical custody instead of treating it as absence', () => {
  const state = deployed(3);
  const malformed: RicheseNoField[] = [
    { ...state, tokens: [] },
    {
      ...state,
      tokens: state.tokens.map((token) => ({ ...token, value: 3 as const })),
    },
    {
      ...state,
      deployed: { ...state.deployed!, tokenId: 'not-a-physical-token' },
    },
    { ...state, lastShipped: 'token-five' },
    {
      ...state,
      deployed: {
        ...state.deployed!,
        location: { territory: 'arrakeen', sector: -1 },
      },
    },
  ];
  for (const invalid of malformed)
    assert.throws(() => noFieldValueFactMatches(invalid, fact(3)));
  assert.throws(() =>
    noFieldValueFactMatches({ ...inventory(), tokens: [] }, fact(0)),
  );
});

void test('question input requires exactly the fact kind and a numeric printed denomination', () => {
  for (const invalid of [
    null,
    [],
    'noFieldValue',
    { kind: 'noFieldValue' },
    { value: 3 },
    { kind: 'forceCount', value: 3 },
    { kind: 'noFieldValue', value: 3, tokenId: 'token-three' },
    { kind: 'noFieldValue', value: 3, reserves: 0 },
  ])
    assert.throws(() => parseNoFieldValueFact(invalid));
  for (const value of ['0', '3', '5', true, false, null, undefined, NaN, Infinity, -1, 1, 3.5])
    assert.throws(() => parseNoFieldValueFact({ kind: 'noFieldValue', value }));
});
