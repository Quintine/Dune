import test from 'node:test';
import assert from 'node:assert/strict';
import { leaders, leaderStrengthLabel } from '../game/cards';
import {
  CHEAP_HERO_TRAITOR,
  matchingTraitor,
  traitorDeck,
} from '../game/traitors';

void test('Ecaz has the five visually verified native leaders with stable unique IDs and exact strengths', () => {
  const roster = leaders('ecaz');
  assert.deepEqual(roster, [
    {
      id: 'ecaz-0',
      name: 'Sanya Ecaz',
      strength: 4,
      faction: 'ecaz',
      dead: false,
      deaths: 0,
    },
    {
      id: 'ecaz-1',
      name: 'Whitmore Bludd',
      strength: 4,
      faction: 'ecaz',
      dead: false,
      deaths: 0,
    },
    {
      id: 'ecaz-2',
      name: 'Ilesa Ecaz',
      strength: 3,
      faction: 'ecaz',
      dead: false,
      deaths: 0,
    },
    {
      id: 'ecaz-3',
      name: 'Rivvy Dinari',
      strength: 3,
      faction: 'ecaz',
      dead: false,
      deaths: 0,
    },
    {
      id: 'ecaz-4',
      name: 'Bindikk Narvi',
      strength: 2,
      faction: 'ecaz',
      dead: false,
      deaths: 0,
    },
  ]);
  assert.equal(new Set(roster.map((leader) => leader.id)).size, 5);
  assert.deepEqual(roster.map(leaderStrengthLabel), ['4', '4', '3', '3', '2']);
});

void test('each Ecaz roster has fresh disc state without changing stable physical identities', () => {
  const first = leaders('ecaz');
  first[0].dead = true;
  first[0].deaths = 1;
  first[1].capturedBy = 'another-seat';
  first[2].usedAt = 'arrakeen';
  first[3].name = 'Changed';
  first[4].strength = 99;
  const second = leaders('ecaz');
  assert.ok(
    second.every(
      (leader) =>
        !leader.dead &&
        leader.deaths === 0 &&
        !leader.capturedBy &&
        !leader.usedAt,
    ),
  );
  assert.equal(second[3].name, 'Rivvy Dinari');
  assert.equal(second[4].strength, 2);
  assert.deepEqual(
    first.map((leader) => leader.id),
    second.map((leader) => leader.id),
  );
});

void test('traitor pools contain only supplied native rosters, with no generic Duke Vidal traitor', () => {
  const ecaz = { leaders: leaders('ecaz') };
  const moritani = { leaders: leaders('moritani') };
  const ecazOnly = traitorDeck([ecaz]);
  assert.deepEqual(ecazOnly, [
    'ecaz-0',
    'ecaz-1',
    'ecaz-2',
    'ecaz-3',
    'ecaz-4',
  ]);
  assert.equal(
    ecazOnly.some((id) => id.startsWith('moritani-')),
    false,
  );
  const paired = traitorDeck([ecaz, moritani]);
  assert.equal(paired.length, 10);
  assert.equal(new Set(paired).size, 10);
  assert.equal(
    [...ecaz.leaders, ...moritani.leaders].some((leader) =>
      /vidal/i.test(leader.name),
    ),
    false,
  );
  for (const unavailable of [
    'ecaz-5',
    'moritani-5',
    'duke-vidal',
    'duke-prad-vidal',
    'atreides-0',
  ])
    assert.equal(matchingTraitor(paired, unavailable), undefined);
  assert.equal(matchingTraitor(paired, 'ecaz-2'), 'ecaz-2');
  assert.deepEqual(traitorDeck([ecaz, moritani], true), [
    ...paired,
    CHEAP_HERO_TRAITOR,
  ]);
});

void test('adding Ecaz leaves the paired Moritani disc identities and values unchanged', () => {
  assert.deepEqual(
    leaders('moritani').map(({ id, name, strength }) => [id, name, strength]),
    [
      ['moritani-0', 'Lupino Ord', 5],
      ['moritani-1', 'Grieu Kronos', 4],
      ['moritani-2', 'Hiih Resser', 4],
      ['moritani-3', 'Trin Kronos', 2],
      ['moritani-4', 'Vando Terboli', 1],
    ],
  );
});
