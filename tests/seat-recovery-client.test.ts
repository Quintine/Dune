import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRecoveryAttempt,
  createRecoveryKit,
  parseRecoveryKit,
  serializeRecoveryKit,
} from '../lib/seat-recovery';

const playerId = '93c66e7c-2d3b-4845-aedf-5d1f06cf3371';
const fixture = () => ({
  format: 'dune-seat-recovery',
  version: 1,
  roomCode: 'ABCD2345',
  playerId,
  recoverySecret: 'a1'.repeat(32),
});

void test('generated recovery kit has a 256-bit lowercase hexadecimal secret and round-trips through copy text', () => {
  const first = createRecoveryKit('ABCD2345', playerId);
  const second = createRecoveryKit('ABCD2345', playerId);
  assert.match(first.recoverySecret, /^[0-9a-f]{64}$/);
  assert.notEqual(first.recoverySecret, second.recoverySecret);
  assert.deepEqual(parseRecoveryKit(serializeRecoveryKit(first)), first);
  assert.equal(Object.isFrozen(first), true);
  assert.deepEqual(Object.keys(first).sort(), [
    'format',
    'playerId',
    'recoverySecret',
    'roomCode',
    'version',
  ]);
});

void test('pretty and single-line pasted kits identify exactly the same private seat', () => {
  const kit = fixture();
  assert.deepEqual(
    parseRecoveryKit(JSON.stringify(kit)),
    parseRecoveryKit(`  ${JSON.stringify(kit, null, 2)}\n`),
  );
});

void test('malformed, truncated, oversized and unsupported kits are rejected without echoing their secrets', () => {
  const bad = [
    '',
    '{',
    '[]',
    'null',
    JSON.stringify('not a kit'),
    JSON.stringify({ ...fixture(), format: 'unrelated' }),
    JSON.stringify({ ...fixture(), version: 2 }),
    JSON.stringify({
      ...fixture(),
      recoverySecret: 'private-secret-not-to-echo',
    }),
    JSON.stringify({ ...fixture(), newSessionToken: 'b2'.repeat(32) }),
    'x'.repeat(4097),
  ];
  for (const text of bad)
    assert.throws(
      () => parseRecoveryKit(text),
      (error: unknown) =>
        error instanceof Error &&
        !error.message.includes('private-secret-not-to-echo'),
    );
});

void test('kit validation forbids URLs, noncanonical identifiers and malformed keys', () => {
  for (const roomCode of [
    '../rooms',
    'abcd2345',
    'ABCD2340',
    'ABCD23456',
    'https://example.test',
  ])
    assert.throws(() =>
      parseRecoveryKit(JSON.stringify({ ...fixture(), roomCode })),
    );
  for (const id of [
    '',
    'player-one',
    `${playerId}?secret=x`,
    playerId.toUpperCase(),
  ])
    assert.throws(() =>
      parseRecoveryKit(JSON.stringify({ ...fixture(), playerId: id })),
    );
  for (const recoverySecret of [
    'a'.repeat(63),
    'a'.repeat(65),
    'A'.repeat(64),
    'z'.repeat(64),
  ])
    assert.throws(() =>
      parseRecoveryKit(JSON.stringify({ ...fixture(), recoverySecret })),
    );
  assert.throws(() => createRecoveryKit('../rooms', playerId));
});

void test('an explicit recovery attempt has fresh secure credentials and an immutable exact retry payload', () => {
  const kit = parseRecoveryKit(JSON.stringify(fixture()));
  const attempt = createRecoveryAttempt(kit);
  const sentBody = JSON.stringify(attempt);
  assert.equal(attempt.type, 'recoverSeat');
  assert.equal(attempt.playerId, kit.playerId);
  assert.equal(attempt.recoverySecret, kit.recoverySecret);
  assert.match(
    attempt.operationId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  assert.match(attempt.newSessionToken, /^[0-9a-f]{64}$/);
  assert.notEqual(attempt.newSessionToken, kit.recoverySecret);
  assert.equal(Object.isFrozen(attempt), true);
  assert.throws(
    () => Object.assign(attempt, { operationId: 'changed' }),
    TypeError,
  );
  assert.equal(
    JSON.stringify(attempt),
    sentBody,
    'retrying the retained attempt produces an identical request',
  );
  const newAttempt = createRecoveryAttempt(kit);
  assert.notEqual(newAttempt.operationId, attempt.operationId);
  assert.notEqual(newAttempt.newSessionToken, attempt.newSessionToken);
  assert.equal(newAttempt.recoverySecret, attempt.recoverySecret);
});
