import assert from 'node:assert/strict';
import test from 'node:test';
import { quoteSukRescue, sukRescueOptions } from '../game/suk-graduate';
import { sukRescueLabel } from '../components/suk-graduate';

void test('Ixian Suk rescue explicitly commits ambiguous cyborg reserve origins before substitution', () => {
  const pool = [{ key: 'wind_pass:14', normal: 2, elite: 1 }, { key: 'wind_pass:15', normal: 2, elite: 2 }];
  const losses = { normal: 2, elite: 3, paidNormal: 2, paidElite: 3 };
  const skill = { leader: 'ixians-0', mode: 'skilled' as const };
  const options = sukRescueOptions(skill, pool, losses, true);
  const choices = options.filter(o => o.normal === 1 && o.elite === 1 && o.kept?.kind === 'normal');
  assert.equal(choices.length, 2);
  assert.deepEqual(choices.map(o => quoteSukRescue(skill, pool, losses, o, true).eliteTanks), [
    { 'wind_pass:14': 1, 'wind_pass:15': 1 }, { 'wind_pass:15': 2 },
  ]);
  assert.match(sukRescueLabel(choices[0]), /cyborgs: 1 from sector 15/);
  assert.match(sukRescueLabel(choices[1]), /cyborgs: 1 from sector 14/);
  assert.throws(() => quoteSukRescue(skill, pool, losses, { ...choices[0], eliteReserves: { 'wind_pass:14': 2 } }, true));
  for (const option of options) {
    const q = quoteSukRescue(skill, pool, losses, JSON.parse(JSON.stringify(option)), true);
    assert.equal(Object.values(q.eliteTanks!).reduce((a, b) => a + b, 0), q.tanks.elite);
    for (const group of q.removed) assert.ok((q.eliteTanks![group.key] ?? 0) <= group.elite);
    assert.equal(q.tanks.elite + q.reserves.elite + (option.kept?.kind === 'elite' ? 1 : 0), 3);
  }
  const legacy = sukRescueOptions(skill, pool, losses);
  assert.ok(legacy.every(o => o.eliteReserves === undefined));
  assert.ok(legacy.every(o => quoteSukRescue(skill, pool, losses, o).eliteTanks === undefined));
});

void test('normal Suk rescue distinguishes both lost-cyborg origins and single-origin choices remain compact', () => {
  const skill = { leader: 'ixians-0', mode: 'normal' as const };
  const losses = { normal: 0, elite: 2, paidNormal: 0, paidElite: 2 };
  const pool = [{ key: 'wind_pass:14', normal: 0, elite: 1 }, { key: 'wind_pass:15', normal: 0, elite: 1 }];
  const options = sukRescueOptions(skill, pool, losses, true);
  assert.equal(options.length, 2);
  assert.ok(options.every(o => !o.kept && o.eliteReserves));
  assert.deepEqual(options.map(o => quoteSukRescue(skill, pool, losses, o, true).eliteTanks), [{ 'wind_pass:14': 1 }, { 'wind_pass:15': 1 }]);
  const unique = sukRescueOptions(skill, [{ key: 'wind_pass:14', normal: 0, elite: 2 }], losses, true);
  assert.deepEqual(unique, [{ normal: 0, elite: 1, kept: null }]);
  assert.deepEqual(quoteSukRescue(skill, [{ key: 'wind_pass:14', normal: 0, elite: 2 }], losses, unique[0], true).eliteTanks, { 'wind_pass:14': 1 });
});
