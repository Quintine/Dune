import test from 'node:test';
import assert from 'node:assert/strict';
import {
  casualtyOptions,
  validCombatForces,
  type CombatForces,
} from '../game/combat';
import {
  stoneBurnerComparison,
  stoneBurnerPlanBlock,
} from '../game/stone-burner';
import {
  quoteBattleResolution,
  type BattleResolutionInput,
} from '../game/battle-resolution-quote';
import { leaders } from '../game/cards';

const ix = (patch: Partial<CombatForces> = {}): CombatForces => ({
  normal: 2,
  elite: 1,
  eliteStrength: 2,
  freeSupport: false,
  normalFixedHalf: true,
  normalFreeSupport: true,
  ...patch,
});
void test('full-strength Suboids cost no support while Advanced Cyborgs retain their separate paid and unpaid strength', () => {
  assert.deepEqual(casualtyOptions(ix({ normal: 1 }), 3, 1), [
    { normal: 1, elite: 1, paidNormal: 0, paidElite: 1 },
  ]);
  assert.deepEqual(casualtyOptions(ix({ normal: 1 }), 3, 0), []);
  assert.deepEqual(casualtyOptions(ix({ normal: 1 }), 2, 0), [
    { normal: 1, elite: 1, paidNormal: 0, paidElite: 0 },
  ]);
  assert.deepEqual(casualtyOptions(ix({ normal: 2, elite: 0 }), 2, 0), [
    { normal: 2, elite: 0, paidNormal: 0, paidElite: 0 },
  ]);
  assert.deepEqual(casualtyOptions(ix({ normal: 2, elite: 0 }), 2, 1), []);
  assert.deepEqual(casualtyOptions(ix({ normal: 1 }), 3, 2), []);
});
void test('Basic free support and explicit elite exemption remain independent from the normal exemption', () => {
  const basic = ix({ normal: 1, freeSupport: true });
  assert.deepEqual(casualtyOptions(basic, 3, 0), [
    { normal: 1, elite: 1, paidNormal: 0, paidElite: 0 },
  ]);
  assert.deepEqual(
    casualtyOptions({ ...basic, normalFreeSupport: false }, 2.5, 0),
    [{ normal: 1, elite: 1, paidNormal: 0, paidElite: 0 }],
  );
  assert.deepEqual(
    casualtyOptions({ ...basic, normalFreeSupport: false }, 3, 0),
    [],
  );
  assert.deepEqual(
    casualtyOptions(ix({ normal: 1, eliteFreeSupport: true }), 3, 0),
    [{ normal: 1, elite: 1, paidNormal: 0, paidElite: 0 }],
  );
  assert.deepEqual(
    casualtyOptions(ix({ normal: 1, eliteFreeSupport: true }), 3, 1),
    [],
  );
});
void test('normal-free-support solver matches independent per-counter assignments for every small mixed pool', () => {
  for (const normal of [0, 1, 2, 3])
    for (const elite of [0, 1, 2])
      for (const eliteStrength of [1, 2] as const)
        for (const eliteFreeSupport of [false, true]) {
          const expected = new Map<string, Set<string>>();
          // Each normal token is either retained or lost at full strength for no cost.
          for (let mask = 0; mask < 2 ** normal; mask++)
            for (let code = 0; code < 3 ** elite; code++) {
              let half = 0,
                paid = 0,
                n = 0,
                e = 0,
                remainder = code,
                valid = true;
              for (let i = 0; i < normal; i++)
                if (mask & (1 << i)) {
                  half += 2;
                  n++;
                }
              for (let i = 0; i < elite; i++) {
                const choice = remainder % 3;
                remainder = Math.floor(remainder / 3);
                if (!choice) continue;
                e++;
                if (eliteFreeSupport) {
                  if (choice === 2) {
                    valid = false;
                    break;
                  }
                  half += eliteStrength * 2;
                } else {
                  half += eliteStrength * choice;
                  if (choice === 2) paid++;
                }
              }
              if (!valid) continue;
              const key = `${half}:${paid}`;
              if (!expected.has(key)) expected.set(key, new Set());
              expected.get(key)!.add(`${n}:${e}`);
            }
          const pool = ix({ normal, elite, eliteStrength, eliteFreeSupport });
          for (
            let half = 0;
            half <= normal * 2 + elite * eliteStrength * 2;
            half++
          )
            for (let support = 0; support <= elite + 1; support++) {
              const actual = casualtyOptions(pool, half / 2, support);
              assert.deepEqual(
                new Set(actual.map((o) => `${o.normal}:${o.elite}`)),
                expected.get(`${half}:${support}`) ?? new Set(),
                `${normal}/${elite}/${eliteStrength}/${eliteFreeSupport}/${half}/${support}`,
              );
              assert.ok(
                actual.every(
                  (o) => o.paidNormal === 0 && o.paidElite === support,
                ),
              );
            }
        }
});
void test('Stone Burner compares actual survivors with the new normal strength and caches both profiles distinctly', () => {
  const defender: CombatForces = {
    normal: 1,
    elite: 0,
    eliteStrength: 1,
    freeSupport: true,
  };
  assert.deepEqual(stoneBurnerComparison(ix(), 2, 0, defender, 0, 0), {
    winner: 'attacker',
    attacker: [1],
    defender: [1],
  });
  assert.deepEqual(
    stoneBurnerComparison(
      ix({ normalFreeSupport: false }),
      2,
      0,
      defender,
      0,
      0,
    ),
    { winner: 'defender', attacker: [0], defender: [1] },
  );
  const own = { ...defender, normal: 2 };
  for (let repeat = 0; repeat < 2; repeat++) {
    assert.match(
      stoneBurnerPlanBlock(
        own,
        1,
        0,
        ix({ normalFreeSupport: false }),
        'attacker',
      )!,
      /different legal force allocations/,
    );
    assert.equal(stoneBurnerPlanBlock(own, 1, 0, ix(), 'attacker'), null);
  }
});
function resolution(advanced = true): BattleResolutionInput {
  const a = [...leaders('ixians')].sort((x, y) => y.strength - x.strength)[0];
  const d = [...leaders('guild')].sort((x, y) => x.strength - y.strength)[0];
  return {
    advanced,
    turn: 2,
    territory: 'pasty_mesa',
    attacker: {
      id: 'i',
      faction: 'ixians',
      spice: 3,
      hand: [],
      leader: a,
      forces: ix({ normal: 1, freeSupport: !advanced }),
      plan: {
        dial: 3,
        support: advanced ? 1 : 0,
        leader: a.id,
        weapon: null,
        defense: null,
      },
    },
    defender: {
      id: 'g',
      faction: 'guild',
      spice: 0,
      hand: [],
      leader: d,
      forces: { normal: 1, elite: 0, eliteStrength: 1, freeSupport: !advanced },
      plan: { dial: 0, support: 0, leader: d.id, weapon: null, defense: null },
    },
    voters: [
      { id: 'i', beneficiary: 'i', called: false, traitors: [] },
      { id: 'g', beneficiary: 'g', called: false, traitors: [] },
    ],
    participants: [
      { id: 'i', faction: 'ixians' },
      { id: 'g', faction: 'guild' },
    ],
    physicalCards: [],
    pendingAuditorPresent: false,
    pendingRetentionPresent: false,
  };
}
void test('battle resolution charges only the Cyborg and preserves the typed force profile in winner casualties', () => {
  for (const advanced of [false, true]) {
    const input = resolution(advanced),
      before = structuredClone(input),
      q = quoteBattleResolution(input);
    assert.equal(q.winner, 'i');
    assert.equal(
      q.payments.find((p) => p.player === 'i')?.cost ?? 0,
      advanced ? 1 : 0,
    );
    assert.equal(q.casualties!.forces.normalFreeSupport, true);
    assert.deepEqual(q.casualties!.options, [
      { normal: 1, elite: 1, paidNormal: 0, paidElite: advanced ? 1 : 0 },
    ]);
    assert.deepEqual(input, before);
  }
});
void test('malformed normal exemption flags reject in combat, Stone Burner and resolution without mutation', () => {
  for (const flag of ['yes', 1, null]) {
    const malformed = { ...ix(), normalFreeSupport: flag } as unknown as CombatForces;
    assert.equal(validCombatForces(malformed), false);
    assert.deepEqual(casualtyOptions(malformed, 3, 1), []);
    assert.match(
      stoneBurnerPlanBlock(malformed, 3, 1, ix(), 'attacker')!,
      /valid supported physical/,
    );
    const input = resolution();
    input.attacker.forces = malformed;
    const before = structuredClone(input);
    assert.throws(() => quoteBattleResolution(input), /valid force/);
    assert.deepEqual(input, before);
  }
});
