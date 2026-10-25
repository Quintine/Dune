import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sourceForRicheseCunning, validRicheseCunningRateSource, richeseCunningRateMatches,
  RicheseCunningRateError, type RicheseCunningRateSource, type RicheseCunningRateGrant,
} from '../game/richese-cunning-rate';

const grant = (patch: Partial<RicheseCunningRateGrant> = {}): RicheseCunningRateGrant => ({
  player: 'richese', owner: 'emperor', card: 'original-karama', ...patch,
});

void test('source snapshots clone only the exact origin without changing live cost-claim history', () => {
  const active = Object.freeze(grant({ costClaimed: true })), before = structuredClone(active);
  const source = sourceForRicheseCunning(active, 'richese');
  assert.deepEqual(source, { player: 'richese', owner: 'emperor', card: 'original-karama' });
  assert.notEqual(source, active);
  assert.ok(validRicheseCunningRateSource(source));
  assert.deepEqual(active, before);
  source!.owner = 'changed-snapshot-owner';
  assert.deepEqual(active, before);
});

void test('owner, physical card, beneficiary and lost-grant changes cannot retain a source', () => {
  const source = sourceForRicheseCunning(grant(), 'richese');
  assert.equal(richeseCunningRateMatches(source, grant(), 'richese'), true);
  for (const active of [grant({ owner: 'other-owner' }), grant({ card: 'replacement-karama' }),
    grant({ player: 'other-player' }), null, undefined])
    assert.equal(richeseCunningRateMatches(source, active, 'richese'), false);
  assert.equal(richeseCunningRateMatches(source, grant(), 'other-player'), false);
  const foreign = sourceForRicheseCunning(grant({ player: 'other-player' }), 'other-player');
  assert.equal(richeseCunningRateMatches(foreign, grant({ player: 'other-player' }), 'richese'), false);
});

void test('absent snapshots match only absence of a current grant for that beneficiary', () => {
  assert.equal(sourceForRicheseCunning(null, 'richese'), undefined);
  assert.equal(sourceForRicheseCunning(undefined, 'richese'), undefined);
  const foreign = grant({ player: 'other-player' }), before = structuredClone(foreign);
  assert.equal(sourceForRicheseCunning(foreign, 'richese'), undefined);
  for (const active of [null, undefined, foreign])
    assert.equal(richeseCunningRateMatches(undefined, active, 'richese'), true);
  assert.equal(richeseCunningRateMatches(undefined, grant(), 'richese'), false);
  assert.deepEqual(foreign, before);
});

void test('a later claimed-cost flag leaves origin matching intact and remains sticky on the live grant', () => {
  const active = grant(), source = sourceForRicheseCunning(active, 'richese');
  assert.equal(richeseCunningRateMatches(source, active, 'richese'), true);
  active.costClaimed = true;
  const claimed = structuredClone(active);
  assert.equal(richeseCunningRateMatches(source, active, 'richese'), true);
  assert.deepEqual(sourceForRicheseCunning(active, 'richese'), source);
  assert.deepEqual(active, claimed);
  assert.equal(active.costClaimed, true);
  assert.ok(!Object.hasOwn(source!, 'costClaimed'));
});

void test('serialized legacy grants may omit the original card but cannot silently acquire a replacement origin', () => {
  const active: RicheseCunningRateGrant = { player: 'richese', owner: 'emperor' };
  const source = JSON.parse(JSON.stringify(sourceForRicheseCunning(active, 'richese'))) as RicheseCunningRateSource;
  assert.ok(validRicheseCunningRateSource(source));
  assert.deepEqual(source, active);
  assert.equal(richeseCunningRateMatches(source, { ...active, costClaimed: true }, 'richese'), true);
  assert.equal(richeseCunningRateMatches(source, grant(), 'richese'), false);
  assert.equal(richeseCunningRateMatches(sourceForRicheseCunning(grant(), 'richese'), active, 'richese'), false);
  assert.deepEqual(sourceForRicheseCunning({ ...active, card: undefined }, 'richese'), active);
});

void test('malformed or expanded snapshots reject rather than matching by beneficiary or invoice alone', () => {
  const bad: unknown[] = [null, [], {}, { player: 'richese' }, { owner: 'emperor' },
    { player: '', owner: 'emperor' }, { player: 'richese', owner: ' ' },
    { player: 'richese', owner: 'emperor', card: '' },
    { player: 'richese', owner: 'emperor', card: undefined },
    { ...grant(), costClaimed: true }, { ...grant(), price: 1 }, { ...grant(), discard: [] }];
  for (const source of bad) {
    assert.equal(validRicheseCunningRateSource(source), false);
    assert.equal(richeseCunningRateMatches(source as RicheseCunningRateSource, grant(), 'richese'), false);
  }
  for (const active of [grant({ owner: '' }), grant({ card: ' ' }), grant({ player: '' })]) {
    const before = structuredClone(active);
    assert.throws(() => sourceForRicheseCunning(active, 'richese'), RicheseCunningRateError);
    assert.equal(richeseCunningRateMatches(undefined, active, 'richese'), false);
    assert.deepEqual(active, before);
  }
});
