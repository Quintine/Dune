import assert from 'node:assert/strict';
import test from 'node:test';
import { AlliancePromiseError } from '../game/alliance-promises';
import { parseAllianceActionClaim, type AllianceActionClaim, type MixedAllianceClaim } from '../game/mixed-alliance-question';
import { compileMixedActionExpression, parseMixedActionExpression } from '../game/mixed-action-question';
import type { TruthFact } from '../game/truthtrance';

void test('mixed alliance action leaves retain one exact partner without adding turn or private Nexus bindings', () => {
  const input = Object.freeze({ partner: 'exact-partner-id' });
  const parsed = parseAllianceActionClaim(input);
  assert.deepEqual(parsed, input); assert.notEqual(parsed, input);
  assert.deepEqual(parseAllianceActionClaim({ partner: 'asker-can-be-the-partner' }), { partner: 'asker-can-be-the-partner' });
});

void test('mixed alliance action leaves reject metadata, frozen values, groups and missing or inexact identities', () => {
  const invalid: unknown[] = [null, undefined, [], 'partner-a', {}, { partner: '' }, { partner: ' ' },
    { partner: ' partner-a' }, { partner: 'partner-a ' }, { partner: 2 }, { partner: null },
    { partner: 'partner-a', turn: 1 }, { partner: 'partner-a', source: 'private' },
    { partner: 'partner-a', event: 'private' }, { partner: 'partner-a', answer: true },
    { partner: 'partner-a', fulfilled: false }, { kind: 'partner', partner: 'partner-a' },
    { kind: 'or', terms: [{ partner: 'partner-a' }, { partner: 'partner-b' }] }];
  for (const value of invalid) assert.throws(() => parseAllianceActionClaim(value), AlliancePromiseError);
});

void test('shared mixed parsing rejects a malformed late alliance leaf before a decisive fact can hide it', () => {
  const fact: TruthFact = { kind: 'spice', compare: 'gte', value: 10 };
  const parseFact = (): TruthFact => fact;
  const input = { kind: 'or', terms: [{ kind: 'fact', fact },
    { kind: 'action', action: { partner: 'partner-a' } }, { kind: 'action', action: { partner: 'partner-b', turn: 1 } }] };
  assert.throws(() => parseMixedActionExpression(input, parseFact, parseAllianceActionClaim), AlliancePromiseError);
  const valid = { kind: 'and', terms: [{ kind: 'fact', fact }, { kind: 'or', terms: [
    { kind: 'action', action: { partner: 'partner-a' } }, { kind: 'action', action: { partner: 'partner-b' } }] }] };
  const parsed = parseMixedActionExpression(valid, parseFact, parseAllianceActionClaim);
  assert.deepEqual(parsed, valid);
  assert.deepEqual(compileMixedActionExpression(parsed, () => 'yes', true), valid.terms[1]);
});

void test('frozen current facts reduce only the residual final-partner expression and preserve raw mixed text', () => {
  const question: MixedAllianceClaim = { turn: 2, mixed: { kind: 'or', terms: [
    { kind: 'fact', fact: { kind: 'spice', compare: 'gte', value: 10 } },
    { kind: 'and', terms: [{ kind: 'action', action: { partner: 'partner-a' } },
      { kind: 'action', action: { partner: 'partner-b' } }] },
  ] } };
  const before = structuredClone(question);
  assert.deepEqual(compileMixedActionExpression<AllianceActionClaim>(question.mixed, () => 'yes', true),
    { kind: 'constant', value: true });
  assert.deepEqual(compileMixedActionExpression(question.mixed, () => 'no', false),
    { kind: 'and', terms: [{ kind: 'action', action: { partner: 'partner-a' } },
      { kind: 'action', action: { partner: 'partner-b' } }] });
  assert.deepEqual(question, before);
});
