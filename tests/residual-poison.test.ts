import test from 'node:test';
import assert from 'node:assert/strict';
import { FACTIONS } from '../game/catalog';
import { leaders, type Leader } from '../game/cards';
import { createDukeVidal } from '../game/duke-vidal';
import {
  residualPoisonCandidates,
  residualPoisonDeath,
} from '../game/residual-poison';

void test('all twelve canonical rosters contribute five independent equally weighted physical discs', () => {
  assert.equal(FACTIONS.length, 12);
  for (const faction of FACTIONS) {
    const roster = leaders(faction.id);
    const before = structuredClone(roster);
    const pool = residualPoisonCandidates(roster, 'arrakeen');
    assert.equal(pool.length, 5, faction.id);
    assert.equal(new Set(pool.map((leader) => leader.id)).size, 5);
    assert.deepEqual(pool, roster);
    assert.notEqual(pool, roster);
    for (let i = 0; i < pool.length; i++) assert.notEqual(pool[i], roster[i]);
    pool[0].dead = true;
    assert.deepEqual(roster, before);
  }
});

void test('dead and elsewhere-used leaders are excluded while same-territory reuse remains eligible', () => {
  const roster = leaders('atreides');
  roster[0].dead = true;
  roster[0].deaths = 1;
  roster[1].usedAt = 'carthag';
  roster[2].usedAt = 'arrakeen';
  assert.deepEqual(
    residualPoisonCandidates(roster, 'arrakeen').map((leader) => leader.id),
    roster.slice(2).map((leader) => leader.id),
  );
  assert.deepEqual(residualPoisonCandidates([], 'arrakeen'), []);
  assert.deepEqual(
    residualPoisonCandidates(roster.slice(0, 2), 'arrakeen'),
    [],
  );
});

void test('already-controlled foreign ghola, captive, Duke and Zoal retain one entry each', () => {
  const ghola = { ...leaders('fremen')[0], gholaBy: 't' };
  const captive = {
    ...leaders('emperor')[0],
    capturedBy: 'h',
    concealed: {
      captor: 'h',
      controller: 'e',
      dead: false,
      deaths: 0,
    },
  };
  const duke = { ...createDukeVidal().leader, controller: 'm' };
  const zoal = leaders('tleilaxu').find((leader) => leader.name === 'Zoal')!;
  assert.ok(zoal);
  const input = [ghola, captive, duke, zoal];
  const pool = residualPoisonCandidates(input, 'arrakeen');
  assert.deepEqual(pool, input);
  assert.equal(pool.length, 4);
  assert.equal(pool.filter((leader) => leader.id === zoal.id).length, 1);
  assert.notEqual(pool[1].concealed, captive.concealed);
  pool[1].concealed!.deaths = 9;
  assert.equal(captive.concealed.deaths, 0);
});

void test('death is immutable and changes only alive state, death count and current territory use', () => {
  const input: Leader = {
    ...createDukeVidal().leader,
    controller: 'm',
    capturedBy: 'h',
    gholaBy: 't',
    deaths: 3,
    usedAt: 'arrakeen',
    concealed: {
      captor: 'h',
      controller: 't',
      dead: false,
      deaths: 2,
      usedAt: 'carthag',
    },
  };
  const before = structuredClone(input);
  const dead = residualPoisonDeath(input);
  const expected = { ...before, dead: true, deaths: 4 };
  delete expected.usedAt;
  assert.deepEqual(dead, expected);
  assert.deepEqual(input, before);
  assert.notEqual(dead.concealed, input.concealed);
  assert.throws(() => residualPoisonDeath(dead), /already in the Tanks/);
});

void test('JSON-restored candidates and deaths preserve physical identity and independent history', () => {
  const input = leaders('richese');
  input[1].usedAt = 'arrakeen';
  input[2].dead = true;
  input[2].deaths = 2;
  const restored: Leader[] = JSON.parse(JSON.stringify(input));
  const pool = residualPoisonCandidates(restored, 'arrakeen');
  const result = residualPoisonDeath(pool[1]);
  assert.equal(result.id, restored[1].id);
  assert.equal(result.deaths, 1);
  assert.equal('usedAt' in result, false);
  assert.deepEqual(restored, input);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
});

void test('duplicate physical IDs reject even if the duplicate would be ineligible', () => {
  const leader = leaders('guild')[0];
  for (const duplicate of [
    leader,
    { ...leader, dead: true, deaths: 1 },
    { ...leader, usedAt: 'carthag' },
  ])
    assert.throws(
      () => residualPoisonCandidates([leader, duplicate], 'arrakeen'),
      /duplicate physical/,
    );
});

void test('malformed restored counts, sparse pools and death overflow reject without partial results', () => {
  const base = leaders('choam')[0];
  for (const field of ['deaths', 'strength'] as const)
    for (const invalid of [
      -1,
      0.5,
      NaN,
      Infinity,
      Number.MAX_SAFE_INTEGER + 1,
      '1',
      null,
    ]) {
      const malformed = { ...base, [field]: invalid } as Leader;
      assert.throws(
        () => residualPoisonCandidates([malformed], 'arrakeen'),
        /valid physical/,
      );
      assert.throws(() => residualPoisonDeath(malformed), /valid physical/);
    }
  for (const patch of [{ id: '' }, { dead: 0 }, { usedAt: '' }, { name: null }])
    assert.throws(
      () =>
        residualPoisonCandidates([{ ...base, ...patch } as Leader], 'arrakeen'),
      /valid physical/,
    );
  const sparse: Leader[] = [];
  sparse.length = 2;
  assert.throws(
    () => residualPoisonCandidates(sparse, 'arrakeen'),
    /valid physical/,
  );
  assert.throws(
    () => residualPoisonCandidates(null as unknown as Leader[], 'arrakeen'),
    /leader pool/,
  );
  assert.throws(
    () => residualPoisonCandidates([base], ' '),
    /battle territory/,
  );
  assert.throws(
    () => residualPoisonDeath({ ...base, deaths: Number.MAX_SAFE_INTEGER }),
    /overflow/,
  );
  assert.throws(
    () =>
      residualPoisonCandidates(
        [{ ...base, concealed: { captor: 'h', dead: false, deaths: -1 } }],
        'arrakeen',
      ),
    /concealed leader history/,
  );
});
