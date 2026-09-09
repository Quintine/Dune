import test from 'node:test';
import assert from 'node:assert/strict';
import { FACTIONS } from '../game/catalog';
import { HOMEWORLD_CARDS, homeworldCard } from '../game/homeworld-cards';

void test('all 13 original worlds map to the 12 factions, with two distinct Emperor cards', () => {
  assert.equal(HOMEWORLD_CARDS.length, 13);
  assert.equal(new Set(HOMEWORLD_CARDS.map((c) => c.id)).size, 13);
  assert.equal(new Set(HOMEWORLD_CARDS.map((c) => c.name)).size, 13);
  for (const faction of FACTIONS) {
    const cards = HOMEWORLD_CARDS.filter((c) => c.faction === faction.id);
    assert.equal(cards.length, faction.id === 'emperor' ? 2 : 1);
  }
  assert.deepEqual(
    HOMEWORLD_CARDS.filter((c) => c.faction === 'emperor').map((c) => c.id),
    ['kaitain', 'salusa_secundus'],
  );
  assert.equal(
    homeworldCard('southern_hemisphere')!.name,
    'Southern Hemisphere',
  );
  assert.equal(homeworldCard('junction')!.faction, 'guild');
  assert.equal(homeworldCard('tupile')!.faction, 'choam');
  assert.equal(homeworldCard('tleilax')!.faction, 'tleilaxu');
  for (const absent of [
    'arrakis',
    'emperor',
    'tleilaxu',
    'unknown',
    '__proto__',
    '',
  ])
    assert.equal(homeworldCard(absent), undefined);
});

void test('printed thresholds cover ordinary reserve counts and preserve the Salusa overlap rather than silently normalizing it', () => {
  const minima: Record<string, number> = {
    caladan: 6,
    giedi_prime: 7,
    southern_hemisphere: 3,
    junction: 5,
    wallach_ix: 11,
    kaitain: 5,
    salusa_secundus: 2,
    ix: 5,
    tleilax: 9,
    tupile: 11,
    richese: 10,
    ecaz: 7,
    grumman: 8,
  };
  for (const card of HOMEWORLD_CARDS) {
    assert.equal(card.high.reserves.min, minima[card.id]);
    assert.equal(card.low.reserves.min, 0);
    if (card.id === 'salusa_secundus') {
      assert.equal(card.reserveType, 'sardaukar');
      assert.deepEqual(card.high.reserves, { min: 2, max: 5 });
      assert.deepEqual(card.low.reserves, { min: 0, max: 2 });
    } else {
      assert.equal(card.reserveType, 'faction');
      assert.equal(card.high.reserves.max, 20);
      assert.equal(card.low.reserves.max + 1, card.high.reserves.min);
    }
  }
});

void test('native battle values retain the face-specific changes and Caladan face precedence over the book example', () => {
  for (const card of HOMEWORLD_CARDS) {
    assert.equal(
      card.high.battleStrength,
      ['wallach_ix', 'salusa_secundus'].includes(card.id) ? 3 : 2,
    );
    assert.equal(card.low.battleStrength, card.id === 'kaitain' ? 3 : 2);
  }
  assert.equal(homeworldCard('caladan')!.high.battleStrength, 2);
});

void test('occupied bank icons remain separate from text-dependent income and Salusa has no automatic low bonuses', () => {
  for (const card of HOMEWORLD_CARDS) {
    assert.equal(
      card.occupied.spiceIcons,
      card.id === 'salusa_secundus'
        ? 0
        : ['wallach_ix', 'richese'].includes(card.id)
          ? 1
          : 2,
    );
    const low = card.low.gameplay.join(' ');
    if (card.id === 'salusa_secundus') {
      assert.doesNotMatch(low, /additional free revival|CHOAM Charity/);
      assert.match(low, /cannot be revived for free/);
    } else {
      assert.match(low, /one additional free revival/);
      assert.match(low, /one extra spice directly from the Spice Bank/);
    }
  }
  for (const id of ['junction', 'kaitain', 'richese', 'southern_hemisphere']) {
    assert.match(
      homeworldCard(id)!.occupied.gameplay.join(' '),
      /half.*rounded down/,
    );
  }
});

void test('the catalog includes all three status sections and preserves the timing, consent and custody clauses that prevent broad effect substitution', () => {
  for (const card of HOMEWORLD_CARDS)
    for (const side of [card.high, card.low, card.occupied]) {
      assert.ok(side.gameplay.length > 0);
      assert.ok(
        side.gameplay.every(
          (text) => typeof text === 'string' && text.trim().length > 0,
        ),
      );
    }
  assert.match(
    homeworldCard('tleilax')!.low.gameplay[0],
    /start the Revival phase/,
  );
  assert.match(
    homeworldCard('junction')!.high.gameplay[0],
    /offer other factions.*their Shipping action/,
  );
  assert.match(
    homeworldCard('caladan')!.high.gameplay[0],
    /already have a force there/,
  );
  assert.match(
    homeworldCard('ecaz')!.high.gameplay[1],
    /at least one stronghold.*two other factions/,
  );
  assert.match(
    homeworldCard('ecaz')!.occupied.gameplay[0],
    /may revive him from the Tanks.*overrides/,
  );
  assert.match(
    homeworldCard('tupile')!.low.gameplay[0],
    /you are on another homeworld or another faction is on Tupile/,
  );
  assert.match(
    homeworldCard('tupile')!.occupied.gameplay[0],
    /no longer occupy.*discard down/,
  );
  assert.match(
    homeworldCard('grumman')!.high.gameplay[0],
    /^During Spice Collection.*then gain 4/,
  );
});

void test('reference definitions are deeply immutable and survive JSON without changing source facts', () => {
  assert.ok(Object.isFrozen(HOMEWORLD_CARDS));
  const before = JSON.stringify(HOMEWORLD_CARDS);
  for (const card of HOMEWORLD_CARDS) {
    assert.ok(Object.isFrozen(card));
    assert.ok(Object.isFrozen(card.occupied));
    assert.ok(Object.isFrozen(card.occupied.gameplay));
    for (const side of [card.high, card.low]) {
      assert.ok(Object.isFrozen(side));
      assert.ok(Object.isFrozen(side.reserves));
      assert.ok(Object.isFrozen(side.gameplay));
    }
    assert.equal(homeworldCard(card.id), card);
  }
  const copy = JSON.parse(before);
  copy[0].high.reserves.min = 99;
  copy[0].occupied.gameplay.push('Not a printed rule');
  assert.equal(JSON.stringify(HOMEWORLD_CARDS), before);
});
