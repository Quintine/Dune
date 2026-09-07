import test from 'node:test';
import assert from 'node:assert/strict';
import { leaders } from '../game/cards';
import { FACTIONS } from '../game/catalog';
import {
  CHEAP_HERO_TRAITOR,
  matchingTraitor,
  traitorDeck,
} from '../game/traitors';

// GF9 CHOAM & Richese printed p. 3; visual provenance in docs/CHOAM_RICHESE_LEADERS.md.
void test('CHOAM ordinary discs match the five printed identities and strengths', () => {
  assert.deepEqual(
    leaders('choam').map(({ id, name, strength }) => ({ id, name, strength })),
    [
      { id: 'choam-0', name: 'Frankos Aru', strength: 4 },
      { id: 'choam-1', name: 'Lady Jalma', strength: 4 },
      { id: 'choam-2', name: 'Rajiv Londine', strength: 3 },
      { id: 'choam-3', name: 'Duke Verdun', strength: 3 },
      { id: 'choam-4', name: 'Viscount Tull', strength: 2 },
    ],
  );
});

void test('Richese ordinary discs preserve printed names instead of narrative faction portraits', () => {
  assert.deepEqual(
    leaders('richese').map(({ id, name, strength }) => ({
      id,
      name,
      strength,
    })),
    [
      { id: 'richese-0', name: 'Ein Calimar', strength: 5 },
      { id: 'richese-1', name: 'Lady Helena', strength: 4 },
      { id: 'richese-2', name: 'Flinto Kinnis', strength: 3 },
      { id: 'richese-3', name: 'Haloa Rund', strength: 2 },
      { id: 'richese-4', name: 'Talis Balt', strength: 2 },
    ],
  );
});

void test('new ordinary factories return fresh native alive discs without sharing battle history', () => {
  for (const faction of ['choam', 'richese'] as const) {
    const first = leaders(faction);
    const fresh = leaders(faction);
    assert.deepEqual(first, fresh);
    assert.notEqual(first, fresh);
    first.forEach((leader, index) => {
      assert.notEqual(leader, fresh[index]);
      assert.equal(leader.faction, faction);
      assert.equal(leader.dead, false);
      assert.equal(leader.deaths, 0);
      assert.equal(leader.capturedBy, undefined);
      assert.equal(leader.gholaBy, undefined);
      leader.dead = true;
      leader.deaths = 2;
      leader.usedAt = 'arrakeen';
      leader.name = 'Changed local copy';
    });
    assert.deepEqual(leaders(faction), fresh);
  }
});

void test('ordinary traitors match physical new leader IDs exactly without adding Auditor or faction portraits', () => {
  const choam = leaders('choam');
  const richese = leaders('richese');
  const deck = traitorDeck([{ leaders: choam }, { leaders: richese }]);
  assert.equal(deck.length, 10);
  assert.equal(new Set(deck).size, 10);
  for (const leader of [...choam, ...richese]) {
    assert.equal(matchingTraitor(deck, leader.id), leader.id);
    assert.equal(matchingTraitor([leader.name], leader.id), undefined);
  }
  assert.deepEqual(
    traitorDeck([{ leaders: choam }]),
    choam.map((l) => l.id),
  );
  assert.deepEqual(
    traitorDeck([{ leaders: choam }, { leaders: richese }], true),
    [...deck, CHEAP_HERO_TRAITOR],
  );
});

void test('twelve ordinary rosters contain sixty unique discs with special and faction-marker identities excluded', () => {
  const all = FACTIONS.flatMap((f) => {
    const roster = leaders(f.id);
    assert.equal(roster.length, 5, f.id);
    assert.deepEqual(
      roster.map((l) => l.id),
      [0, 1, 2, 3, 4].map((i) => `${f.id}-${i}`),
    );
    return roster;
  });
  assert.equal(all.length, 60);
  assert.equal(new Set(all.map((l) => l.id)).size, 60);
  for (const name of [
    'Auditor',
    'Ur-Director Malina Aru',
    'Count Ilban Richese',
    'Duke Prad Vidal',
  ]) {
    assert.equal(
      all.some((l) => l.name === name),
      false,
      name,
    );
  }
});
