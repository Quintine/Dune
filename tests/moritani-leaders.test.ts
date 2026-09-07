import test from 'node:test';
import assert from 'node:assert/strict';
import { leaders, leaderStrengthLabel } from '../game/cards';
import type { FactionId } from '../game/catalog';
import {
  CHEAP_HERO_TRAITOR,
  matchingTraitor,
  traitorDeck,
} from '../game/traitors';

void test('Moritani has exactly the five visually verified ordinary leaders with stable physical IDs', () => {
  assert.deepEqual(leaders('moritani'), [
    {
      id: 'moritani-0',
      name: 'Lupino Ord',
      strength: 5,
      faction: 'moritani',
      dead: false,
      deaths: 0,
    },
    {
      id: 'moritani-1',
      name: 'Grieu Kronos',
      strength: 4,
      faction: 'moritani',
      dead: false,
      deaths: 0,
    },
    {
      id: 'moritani-2',
      name: 'Hiih Resser',
      strength: 4,
      faction: 'moritani',
      dead: false,
      deaths: 0,
    },
    {
      id: 'moritani-3',
      name: 'Trin Kronos',
      strength: 2,
      faction: 'moritani',
      dead: false,
      deaths: 0,
    },
    {
      id: 'moritani-4',
      name: 'Vando Terboli',
      strength: 1,
      faction: 'moritani',
      dead: false,
      deaths: 0,
    },
  ]);
  const cards = leaders('moritani');
  assert.equal(new Set(cards.map((leader) => leader.id)).size, 5);
  assert.deepEqual(cards.map(leaderStrengthLabel), ['5', '4', '4', '2', '1']);
  cards[0].dead = true;
  cards[0].strength = 99;
  assert.equal(leaders('moritani')[0].dead, false);
  assert.equal(leaders('moritani')[0].strength, 5);
});

void test('ordinary traitor inventories include Moritani only when supplied and never invent a Duke Vidal identity', () => {
  const atreides = { leaders: leaders('atreides') };
  const moritani = { leaders: leaders('moritani') };
  const baseOnly = traitorDeck([atreides]);
  const combined = traitorDeck([atreides, moritani]);
  assert.equal(baseOnly.length, 5);
  assert.equal(combined.length, 10);
  assert.equal(new Set(combined).size, 10);
  assert.ok(baseOnly.every((id) => id.startsWith('atreides-')));
  assert.deepEqual(
    combined.slice(5),
    moritani.leaders.map((leader) => leader.id),
  );
  assert.equal(
    moritani.leaders.some((leader) => /vidal/i.test(leader.name)),
    false,
  );
  assert.equal(combined.includes('moritani-5'), false);
  assert.equal(matchingTraitor(combined, 'duke-vidal'), undefined);
  assert.equal(matchingTraitor(combined, 'duke-prad-vidal'), undefined);
  assert.equal(matchingTraitor(combined, 'moritani-2'), 'moritani-2');
  assert.equal(combined.includes(CHEAP_HERO_TRAITOR), false);
  assert.deepEqual(traitorDeck([atreides, moritani], true), [
    ...combined,
    CHEAP_HERO_TRAITOR,
  ]);
});

// Regression fixtures for the existing base/Ix factory; this test is not a new source audit.
const existingRosters: Partial<Record<FactionId, [string, number][]>> = {
  atreides: [
    ['Thufir Hawat', 5],
    ['Lady Jessica', 5],
    ['Gurney Halleck', 4],
    ['Duncan Idaho', 2],
    ['Dr. Yueh', 1],
  ],
  harkonnen: [
    ['Feyd-Rautha', 6],
    ['Beast Rabban', 4],
    ['Piter de Vries', 3],
    ['Captain Iakin Nefud', 2],
    ['Umman Kudu', 1],
  ],
  emperor: [
    ['Hasimir Fenring', 6],
    ['Captain Aramsham', 5],
    ['Caid', 3],
    ['Burseg', 3],
    ['Bashar', 2],
  ],
  fremen: [
    ['Stilgar', 7],
    ['Chani', 6],
    ['Otheym', 5],
    ['Shadout Mapes', 3],
    ['Jamis', 2],
  ],
  guild: [
    ['Staban Tuek', 5],
    ['Master Bewt', 3],
    ['Esmar Tuek', 3],
    ['Soo-Soo Sook', 2],
    ['Guild Representative', 1],
  ],
  beneGesserit: [
    ['Alia', 5],
    ['Wanna Marcus', 5],
    ['Princess Irulan', 5],
    ['Reverend Mother Ramallo', 5],
    ['Margot Lady Fenring', 5],
  ],
  ixians: [
    ['Dominic Vernius', 4],
    ['C’tair Pilru', 5],
    ['Tessia Vernius', 5],
    ['Kailea Vernius', 2],
    ['Cammar Pilru', 1],
  ],
  tleilaxu: [
    ['Zoal', 3],
    ['Hidar Fen Ajidica', 4],
    ['Master Zaaf', 3],
    ['Wykk', 2],
    ['Blin', 1],
  ],
};
void test('base and Ix leader names, values, stable IDs and initial state remain unchanged', () => {
  const allIds = leaders('moritani').map((leader) => leader.id);
  for (const faction of Object.keys(existingRosters) as FactionId[]) {
    const roster = leaders(faction);
    assert.deepEqual(
      roster.map((leader) => [leader.name, leader.strength]),
      existingRosters[faction],
      faction,
    );
    assert.deepEqual(
      roster.map((leader) => leader.id),
      Array.from({ length: 5 }, (_, index) => `${faction}-${index}`),
    );
    assert.ok(
      roster.every(
        (leader) =>
          leader.faction === faction && !leader.dead && leader.deaths === 0,
      ),
    );
    allIds.push(...roster.map((leader) => leader.id));
  }
  assert.equal(new Set(allIds).size, 45);
  assert.equal(leaderStrengthLabel(leaders('tleilaxu')[0]), 'X');
});
