import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TraitorDecisionError,
  bindTraitorDecisionPromise,
  reconcileTraitorDecisionPromises,
  settleTraitorDecisionPromises,
  traitorDecisionChoices,
  validateTraitorDecisionPromise,
  type TraitorDecisionContext,
  type TraitorDecisionPromise,
} from '../game/traitor-decision-promises';

function context(overrides: Partial<TraitorDecisionContext> = {}): TraitorDecisionContext {
  return {
    turn: 4, battle: 'original-public-battle', player: 'harkonnen',
    beneficiary: 'atreides', target: 'emperor', leader: 'aramsham',
    canReveal: true, ...overrides,
  };
}

function promise(overrides: Partial<TraitorDecisionPromise> = {}): TraitorDecisionPromise {
  return {
    turn: 4, battle: 'original-public-battle', player: 'harkonnen',
    beneficiary: 'atreides', target: 'emperor', leader: 'aramsham',
    asker: 'beneGesserit', answer: true, ...overrides,
  };
}

void test('native eligibility supplies ordered declaration choices and a submitted decision has none', () => {
  assert.deepEqual(traitorDecisionChoices(context(), []), [false, true]);
  assert.deepEqual(traitorDecisionChoices(context({ canReveal: false }), []), [false]);
  assert.deepEqual(traitorDecisionChoices(context({ leader: null, canReveal: false }), []), [false]);
  for (const canReveal of [false, true]) {
    assert.deepEqual(traitorDecisionChoices(context({ canReveal, submitted: true }), []), []);
  }
  assert.deepEqual(traitorDecisionChoices(context({ submitted: false }), []), []);
});

void test('compatible definite answers bind independently while contradiction and impossible Yes reject without mutation', () => {
  const ctx = context();
  const first = bindTraitorDecisionPromise(ctx, [], 'beneGesserit', true);
  const before = structuredClone({ ctx, first });
  const second = bindTraitorDecisionPromise(ctx, first, 'fremen', true);
  assert.deepEqual(second, [promise(), promise({ asker: 'fremen' })]);
  assert.deepEqual(traitorDecisionChoices(ctx, second), [true]);
  assert.deepEqual({ ctx, first }, before);
  assert.notEqual(second, first);
  assert.notEqual(second[0], first[0]);
  assert.throws(() => bindTraitorDecisionPromise(ctx, first, 'fremen', false), TraitorDecisionError);
  assert.deepEqual({ ctx, first }, before);
  const no = bindTraitorDecisionPromise(context({ canReveal: false }), [], 'beneGesserit', false);
  assert.deepEqual(traitorDecisionChoices(context(), no), [false]);
  assert.throws(() => bindTraitorDecisionPromise(context({ canReveal: false }), [], 'fremen', true), TraitorDecisionError);
  assert.throws(() => bindTraitorDecisionPromise(context({ submitted: true }), [], 'fremen', false), TraitorDecisionError);
});

void test('only the complete original public source constrains a current declaration', () => {
  const changes: Partial<TraitorDecisionPromise>[] = [
    { turn: 3 }, { battle: 'other-battle' }, { player: 'other-voter' },
    { beneficiary: 'other-beneficiary' }, { target: 'other-target' }, { leader: 'other-leader' },
    { leader: null }, { fulfilled: true }, { released: true },
  ];
  for (const change of changes) {
    const ledger = [promise(change)];
    const before = structuredClone(ledger);
    assert.deepEqual(traitorDecisionChoices(context(), ledger), [false, true]);
    assert.deepEqual(reconcileTraitorDecisionPromises(context({ canReveal: false }), ledger), ledger);
    assert.deepEqual(ledger, before);
  }
  assert.deepEqual(traitorDecisionChoices(context(), [promise(), promise({ asker: 'fremen', answer: false })]), []);
});

void test('settlement validates before the actual assignment and fulfills either matching declaration exactly once', () => {
  for (const call of [false, true]) {
    const ctx = context();
    const ledger = [
      promise({ answer: call }), promise({ answer: call, asker: 'fremen' }),
      promise({ battle: 'older-battle', answer: !call }),
      promise({ beneficiary: 'other-beneficiary', answer: !call }),
      promise({ released: true, answer: !call }), promise({ fulfilled: true, answer: !call }),
    ];
    const before = structuredClone({ ctx, ledger });
    assert.throws(() => settleTraitorDecisionPromises(ctx, ledger, !call), TraitorDecisionError);
    assert.deepEqual({ ctx, ledger }, before);
    const settled = settleTraitorDecisionPromises(ctx, ledger, call);
    assert.equal(settled[0].fulfilled, true);
    assert.equal(settled[1].fulfilled, true);
    assert.deepEqual(settled.slice(2), ledger.slice(2));
    assert.deepEqual({ ctx, ledger }, before);
    assert.equal(ctx.submitted, undefined, 'The caller still owns actual declaration assignment');
    assert.throws(() => settleTraitorDecisionPromises({ ...ctx, submitted: true }, settled, call), TraitorDecisionError);
  }
  assert.throws(() => settleTraitorDecisionPromises(context({ canReveal: false }), [], true), TraitorDecisionError);
  assert.deepEqual(settleTraitorDecisionPromises(context({ canReveal: false }), [promise({ answer: false })], false),
    [promise({ answer: false, fulfilled: true })]);
});

void test('native impossibility releases only a current live Yes and keeps No, historical sources and fulfilled decisions', () => {
  const ctx = context({ canReveal: false });
  const ledger = [
    promise(), promise({ answer: false, asker: 'fremen' }),
    promise({ battle: 'another-original-source' }),
    promise({ fulfilled: true }), promise({ released: true }),
  ];
  const before = structuredClone({ ctx, ledger });
  assert.deepEqual(traitorDecisionChoices(ctx, ledger), []);
  const reconciled = reconcileTraitorDecisionPromises(ctx, ledger);
  assert.deepEqual(reconciled, [promise({ released: true }), ...ledger.slice(1)]);
  assert.deepEqual(traitorDecisionChoices(ctx, reconciled), [false]);
  assert.deepEqual(reconcileTraitorDecisionPromises(ctx, reconciled), reconciled);
  assert.deepEqual(reconcileTraitorDecisionPromises(context(), ledger), ledger);
  assert.deepEqual({ ctx, ledger }, before);
});

void test('an accepted declaration remains fulfilled if its later Traitor effect is prevented', () => {
  const accepted = bindTraitorDecisionPromise(context(), [], 'beneGesserit', true);
  const declared = settleTraitorDecisionPromises(context(), accepted, true);
  const before = structuredClone(declared);
  const afterPrevention = reconcileTraitorDecisionPromises(
    context({ canReveal: false, submitted: true }), declared,
  );
  assert.equal(afterPrevention[0].answer, true);
  assert.equal(afterPrevention[0].fulfilled, true);
  assert.equal(afterPrevention[0].released, undefined);
  assert.deepEqual(afterPrevention, before);
  assert.deepEqual(traitorDecisionChoices(context({ canReveal: false, submitted: true }), afterPrevention), []);
  assert.deepEqual(accepted, [promise()]);
});

void test('promise validation accepts only the bounded public source and typed flags, including a null leader', () => {
  assert.equal(validateTraitorDecisionPromise(promise()), true);
  assert.equal(validateTraitorDecisionPromise(promise({ leader: null, answer: false })), true);
  assert.equal(validateTraitorDecisionPromise(promise({ fulfilled: false, released: false })), true);
  assert.equal(validateTraitorDecisionPromise(promise({ fulfilled: true })), true);
  assert.equal(validateTraitorDecisionPromise(promise({ released: true })), true);
  for (const invalid of [
    null, [], 'promise', 4, {}, { ...promise(), turn: 0 }, { ...promise(), turn: 1.5 },
    { ...promise(), turn: Number.MAX_SAFE_INTEGER + 1 }, { ...promise(), battle: '' },
    { ...promise(), player: ' ' }, { ...promise(), beneficiary: null }, { ...promise(), target: 4 },
    { ...promise(), leader: '' }, { ...promise(), asker: '' }, { ...promise(), answer: 'yes' },
    { ...promise(), fulfilled: 1 }, { ...promise(), released: 'false' },
    { ...promise(), canReveal: true }, { ...promise(), submitted: false },
    { ...promise(), card: 'private-card' }, { ...promise(), hand: [] },
  ]) {
    assert.equal(validateTraitorDecisionPromise(invalid), false);
  }
  for (const key of ['turn', 'battle', 'player', 'beneficiary', 'target', 'leader', 'asker', 'answer']) {
    const missing = { ...promise() } as Record<string, unknown>;
    delete missing[key];
    assert.equal(validateTraitorDecisionPromise(missing), false, key);
  }
});

void test('operational guards reject malformed contexts or ledger values with the named error and unchanged input', () => {
  for (const malformed of [
    null, [], { ...context(), turn: 0 }, { ...context(), battle: '' },
    { ...context(), canReveal: 'yes' }, { ...context(), submitted: 1 },
    { ...context(), leader: undefined },
  ]) {
    const ctx = malformed as unknown as TraitorDecisionContext;
    assert.throws(() => traitorDecisionChoices(ctx, []), (error: unknown) =>
      error instanceof TraitorDecisionError && error.name === 'TraitorDecisionError');
  }
  const ledger = [{ ...promise(), privateCard: 'secret' }] as unknown as TraitorDecisionPromise[];
  const before = structuredClone(ledger);
  for (const operation of [
    () => traitorDecisionChoices(context(), ledger),
    () => bindTraitorDecisionPromise(context(), ledger, 'fremen', true),
    () => settleTraitorDecisionPromises(context(), ledger, true),
    () => reconcileTraitorDecisionPromises(context({ canReveal: false }), ledger),
  ]) assert.throws(operation, TraitorDecisionError);
  assert.deepEqual(ledger, before);
  assert.throws(() => bindTraitorDecisionPromise(context(), [], '', true), TraitorDecisionError);
  assert.throws(() => bindTraitorDecisionPromise(context(), [], 'fremen', 'yes' as unknown as boolean), TraitorDecisionError);
  assert.throws(() => settleTraitorDecisionPromises(context(), [], 1 as unknown as boolean), TraitorDecisionError);
});

void test('binding copies only the original public decision fields and never reads private native matching or power data', () => {
  const ctx = context();
  for (const field of ['card', 'hand', 'traitors', 'kh', 'leaders', 'faction', 'ally', 'nativeContext', 'response']) {
    Object.defineProperty(ctx, field, {
      enumerable: true,
      get() { throw new Error(`Pure Traitor decision read private native ${field}`); },
    });
  }
  const bound = bindTraitorDecisionPromise(ctx, [], 'beneGesserit', true);
  assert.deepEqual(bound, [promise()]);
  assert.deepEqual(Object.keys(bound[0]).sort(), [
    'answer', 'asker', 'battle', 'beneficiary', 'leader', 'player', 'target', 'turn',
  ]);
  assert.deepEqual(traitorDecisionChoices(ctx, bound), [true]);
  assert.equal(settleTraitorDecisionPromises(ctx, bound, true)[0].fulfilled, true);
  assert.equal(reconcileTraitorDecisionPromises(ctx, bound)[0].released, undefined);
  const privateReceipt = promise();
  Object.defineProperty(privateReceipt, 'card', {
    enumerable: true, get() { throw new Error('Validation inspected private card payload'); },
  });
  assert.equal(validateTraitorDecisionPromise(privateReceipt), false);
});
