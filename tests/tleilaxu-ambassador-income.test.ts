import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAmbassadorRevivalReceipt,
  validateAmbassadorRevivalReceipt,
  AmbassadorRevivalIncomeError,
  type AmbassadorRevivalSource,
  type AmbassadorRevivalReturn,
  type AmbassadorRevivalReceipt,
} from '../game/tleilaxu-ambassador-income';

const source = (): AmbassadorRevivalSource => ({
  event: 'original-ambassador-event', owner: 'ecaz', entrant: 'guild', token: 'ambassador-tleilaxu',
  territory: 'arrakeen', sector: 10, turn: 3, phase: 5, beneficiary: 'atreides', incomeOwner: 'tleilaxu',
});
const forces = (): AmbassadorRevivalReturn => ({ kind: 'forces', amount: 3, elite: 1 });

// Pure committed-return witnesses, not earned game histories or live custody
// checks. Native Ambassador and the original free-income ledger stay engine-owned.
void test('positive force, leader and KH returns produce detached one-spice Ambassador receipts', () => {
  for (const returned of [forces(), { kind: 'leader', leader: 'duke-vidal', deaths: 2 },
    { kind: 'kwisatz', cycle: 1 }] as AmbassadorRevivalReturn[]) {
    const originalSource = source(), before = structuredClone({ source: originalSource, returned });
    Object.freeze(originalSource); Object.freeze(returned);
    const receipt = createAmbassadorRevivalReceipt(originalSource, returned);
    assert.equal(receipt.version, 1);
    assert.equal(receipt.amount, 1);
    assert.deepEqual(receipt.source, originalSource);
    assert.deepEqual(receipt.returned, returned);
    assert.notEqual(receipt.source, originalSource);
    assert.notEqual(receipt.returned, returned);
    validateAmbassadorRevivalReceipt(originalSource, JSON.parse(JSON.stringify(receipt)));
    assert.deepEqual({ source: originalSource, returned }, before);
    receipt.source.territory = 'carthag';
    assert.equal(originalSource.territory, 'arrakeen');
    if (receipt.returned.kind === 'forces') receipt.returned.amount = 4;
    else if (receipt.returned.kind === 'leader') receipt.returned.deaths = 3;
    else receipt.returned.cycle = 2;
    assert.deepEqual(returned, before.returned);
  }
});

void test('receipt binding is deterministic across equivalent public source property insertion orders', () => {
  const original = source(), reordered = Object.fromEntries(Object.entries(original).reverse()) as AmbassadorRevivalSource;
  const first = createAmbassadorRevivalReceipt(original, forces());
  const second = createAmbassadorRevivalReceipt(reordered, forces());
  assert.equal(first.signature, second.signature);
  validateAmbassadorRevivalReceipt(original, second);
  validateAmbassadorRevivalReceipt(reordered, first);
  const firstPhase = { ...original, phase: 0, sector: 1, turn: 1 };
  validateAmbassadorRevivalReceipt(firstPhase, createAmbassadorRevivalReceipt(firstPhase, { kind: 'forces', amount: 1, elite: 0 }));
  const finalSector = { ...original, sector: 18, phase: Number.MAX_SAFE_INTEGER };
  validateAmbassadorRevivalReceipt(finalSector, createAmbassadorRevivalReceipt(finalSector, { kind: 'forces', amount: 4, elite: 4 }));
});

void test('a separately valid receipt from another source cannot settle this original Ambassador income', () => {
  const original = source();
  const changes: Partial<AmbassadorRevivalSource>[] = [
    { event: 'another-event' }, { owner: 'another-owner' }, { entrant: 'another-entrant' },
    { token: 'copied-ambassador' }, { territory: 'carthag' }, { sector: 11 },
    { turn: 4 }, { phase: 1 }, { beneficiary: 'another-beneficiary' }, { incomeOwner: 'another-income-owner' },
  ];
  for (const change of changes) {
    const changed = { ...original, ...change }, receipt = createAmbassadorRevivalReceipt(changed, forces());
    validateAmbassadorRevivalReceipt(changed, receipt);
    assert.throws(() => validateAmbassadorRevivalReceipt(original, receipt), AmbassadorRevivalIncomeError);
  }
});

void test('force types, leader identity and preserved death or KH cycle values remain bound after commitment', () => {
  const original = source();
  const changedForces = createAmbassadorRevivalReceipt(original, forces());
  assert.ok(changedForces.returned.kind === 'forces');
  changedForces.returned.elite = 0;
  assert.throws(() => validateAmbassadorRevivalReceipt(original, changedForces), /committed return/);
  for (const returned of [
    { kind: 'forces', amount: 4, elite: 1 },
    { kind: 'leader', leader: 'ecaz-0', deaths: 1 },
    { kind: 'leader', leader: 'duke-vidal', deaths: 3 },
    { kind: 'kwisatz', cycle: 2 },
  ] as AmbassadorRevivalReturn[]) {
    const initial: AmbassadorRevivalReturn = returned.kind === 'forces' ? forces() :
      returned.kind === 'leader' ? { kind: 'leader', leader: 'duke-vidal', deaths: 2 } : { kind: 'kwisatz', cycle: 1 };
    const receipt = createAmbassadorRevivalReceipt(original, initial);
    receipt.returned = returned;
    assert.throws(() => validateAmbassadorRevivalReceipt(original, receipt), /committed return/);
  }
});

void test('malformed public sources and zero, excessive or untyped returns cannot create income receipts', () => {
  const original = source();
  for (const invalid of [
    { ...original, event: '' }, { ...original, owner: ' ' }, { ...original, entrant: 1 },
    { ...original, token: undefined }, { ...original, territory: '' }, { ...original, beneficiary: '' },
    { ...original, incomeOwner: '' }, { ...original, sector: 0 }, { ...original, sector: 19 },
    { ...original, sector: 1.5 }, { ...original, turn: 0 }, { ...original, turn: NaN },
    { ...original, phase: -1 }, { ...original, phase: 0.5 }, { ...original, phase: Infinity },
    { ...original, phase: Number.MAX_SAFE_INTEGER + 1 }, { ...original, wallet: 1 },
  ]) assert.throws(() => createAmbassadorRevivalReceipt(invalid as AmbassadorRevivalSource, forces()), AmbassadorRevivalIncomeError);
  for (const invalid of [
    { kind: 'forces', amount: 0, elite: 0 }, { kind: 'forces', amount: 5, elite: 0 },
    { kind: 'forces', amount: 1.5, elite: 0 }, { kind: 'forces', amount: 3, elite: -1 },
    { kind: 'forces', amount: 3, elite: 4 }, { kind: 'forces', amount: 3, elite: 0.5 },
    { kind: 'forces', amount: 3 }, { kind: 'forces', amount: 3, elite: 0, cost: 0 },
    { kind: 'leader', leader: '', deaths: 1 }, { kind: 'leader', leader: 'ecaz-0', deaths: 0 },
    { kind: 'leader', leader: 'ecaz-0', deaths: Number.MAX_SAFE_INTEGER + 1 },
    { kind: 'kwisatz', cycle: 0 }, { kind: 'kwisatz', cycle: NaN }, { kind: 'kwisatz', cycle: 1.5 },
    { kind: 'unknown', amount: 1 },
  ]) assert.throws(() => createAmbassadorRevivalReceipt(original, invalid as AmbassadorRevivalReturn), AmbassadorRevivalIncomeError);
});

void test('receipt reward, source shape, format version and signature cannot be changed into another bank award', () => {
  const original = source(), receipt = createAmbassadorRevivalReceipt(original, forces());
  for (const changed of [
    { ...receipt, version: 2 }, { ...receipt, amount: 0 }, { ...receipt, amount: 2 },
    { ...receipt, signature: '' }, { ...receipt, extra: true },
    { ...receipt, source: { ...receipt.source, hiddenBalance: 5 } },
    { ...receipt, returned: { kind: 'forces', amount: 0, elite: 0 } },
  ]) assert.throws(() => validateAmbassadorRevivalReceipt(original, changed as AmbassadorRevivalReceipt), AmbassadorRevivalIncomeError);
  const before = structuredClone(receipt);
  validateAmbassadorRevivalReceipt(original, receipt);
  assert.deepEqual(receipt, before);
});
