import assert from 'node:assert/strict';
import test from 'node:test';
import { quoteHomeworldBattles, homeworldCombatArmy, homeworldCombatLocation,
  type HomeworldCombatContext } from '../game/homeworld-combat';
import { createHomeworldCustody, type HomeworldCustody } from '../game/homeworld-custody';
import { homeworldNoFieldPresence, quoteHomeworldBattlesWithNoField,
  type PublicHomeworldNoField } from '../game/richese-homeworld-marker-combat';

function fixture(): { context: HomeworldCombatContext; custody: HomeworldCustody; marker: PublicHomeworldNoField } {
  const context: HomeworldCombatContext = {
    advanced: true,
    order: ['r', 'e', 'a'],
    players: [
      { id: 'e', faction: 'emperor', reserves: 6, eliteReserves: 2, ally: null },
      { id: 'a', faction: 'atreides', reserves: 5, eliteReserves: 0, ally: null },
      { id: 'r', faction: 'richese', reserves: 7, eliteReserves: 0, ally: null },
    ],
  };
  return { context, custody: createHomeworldCustody(context),
    marker: { controller: 'r', location: { homeworld: 'homeworld:emperor' } } };
}

void test('a public marker alone adds Richese as a Homeworld combatant without creating a counter', () => {
  const { context, custody, marker } = fixture();
  const beforeContext = structuredClone(context), beforeCustody = structuredClone(custody);
  assert.deepEqual(quoteHomeworldBattles(context, custody), []);
  assert.deepEqual(homeworldNoFieldPresence(context, custody, marker), {
    controller: 'r', homeworld: 'homeworld:emperor', effectiveForces: 1,
  });
  assert.deepEqual(quoteHomeworldBattlesWithNoField(context, custody, marker), [
    { territory: 'homeworld:emperor', attacker: 'r', defender: 'e' },
  ]);
  assert.equal(homeworldCombatLocation(context, custody, marker.location.homeworld).population, 4);
  assert.deepEqual(homeworldCombatArmy(context, custody, marker.location.homeworld, 'r'),
    { player: 'r', normal: 0, elite: 0, native: false, nativeBattleStrength: 0 });
  assert.deepEqual(context, beforeContext); assert.deepEqual(custody, beforeCustody);
});

void test('a marker and existing Richese garrison do not duplicate battles or physical forces', () => {
  const { context, custody, marker } = fixture();
  custody.visitors['homeworld:emperor'] = { r: { normal: 2, elite: 0 }, a: { normal: 1, elite: 0 } };
  const before = structuredClone(custody), native = quoteHomeworldBattles(context, custody);
  assert.deepEqual(quoteHomeworldBattlesWithNoField(context, custody, marker), native);
  assert.equal(native.filter(pair => pair.attacker === 'r' && pair.defender === 'e').length, 1);
  assert.deepEqual(homeworldCombatArmy(context, custody, marker.location.homeworld, 'r'),
    { player: 'r', normal: 2, elite: 0, native: false, nativeBattleStrength: 0 });
  assert.deepEqual(custody, before);
});

void test('zero native forces are not invented and a foreign army may oppose the marker', () => {
  const { context, custody, marker } = fixture();
  const emperor = context.players.find(player => player.id === 'e')!;
  emperor.reserves = 0; emperor.eliteReserves = 0;
  custody.salusa = { normal: 0, elite: 0 };
  custody.visitors['homeworld:emperor'] = { a: { normal: 1, elite: 0 } };
  assert.deepEqual(quoteHomeworldBattlesWithNoField(context, custody, marker), [
    { territory: 'homeworld:emperor', attacker: 'r', defender: 'a' },
  ]);
});

void test('allies do not become opponents and public pairing is independent of the hidden value', () => {
  const { context, custody, marker } = fixture();
  context.players.find(player => player.id === 'r')!.ally = 'a';
  context.players.find(player => player.id === 'a')!.ally = 'r';
  custody.visitors['homeworld:emperor'] = { a: { normal: 1, elite: 0 } };
  const expected = [
    { territory: 'homeworld:emperor', attacker: 'r', defender: 'e' },
    { territory: 'homeworld:emperor', attacker: 'e', defender: 'a' },
  ];
  for (const value of [0, 3, 5]) {
    // Extra private fields must never influence this public quote.
    const specimen = { ...marker, tokenId: `hidden-${value}`, value };
    assert.deepEqual(quoteHomeworldBattlesWithNoField(context, custody, specimen), expected);
  }
});

void test('a marker needs its seated Richese controller and a foreign active Homeworld', () => {
  const { context, custody, marker } = fixture();
  assert.deepEqual(quoteHomeworldBattlesWithNoField(context, custody, null), quoteHomeworldBattles(context, custody));
  assert.throws(() => homeworldNoFieldPresence(context, custody, { ...marker, controller: 'e' }), /Richese/);
  assert.throws(() => homeworldNoFieldPresence(context, custody, { ...marker, controller: 'missing' }), /Richese/);
  assert.throws(() => homeworldNoFieldPresence(context, custody,
    { ...marker, location: { homeworld: 'homeworld:richese' } }), /own Homeworld/);
  assert.throws(() => homeworldNoFieldPresence(context, custody,
    { ...marker, location: { homeworld: 'homeworld:fremen' } }), /canonical Homeworld/);
});
