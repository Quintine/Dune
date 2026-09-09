import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeck, ixDeck, type Card } from '../game/cards';
import { newPlayer } from '../game/engine';
import { createHomeworldCustody } from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import { RICHESE_CARD_DEFINITIONS } from '../game/richese-cards';
import { resolveBattleWeapons } from '../game/effective-weapons';
import {
  EcazPoisonIncomeError,
  quoteEcazPoisonIncome,
  type EcazPoisonDiscard,
} from '../game/ecaz-poison-income';

function fixture(reserves = 7, advanced = false) {
  const players = [
    newPlayer('ecaz', 'Ecaz', 'ecaz'),
    newPlayer('emperor', 'Emperor', 'emperor'),
  ];
  players[0].reserves = reserves;
  const context = { advanced, players };
  return {
    ...context,
    homeworlds: { custody: createHomeworldCustody(homeworldContext(context)) },
  };
}
const ordinary = [...baseDeck(), ...ixDeck()];
const find = (kind: Card['kind']) =>
  ordinary.find((card) => card.kind === kind)!;
const poison = find('poison');

void test('every printed ordinary poison, Poison Blade and Tooth pays once per physical discard', () => {
  const cards = ordinary.filter((card) =>
    ['poison', 'poisonBlade', 'poisonTooth'].includes(card.kind),
  );
  assert.equal(cards.length, 7);
  for (const advanced of [false, true]) {
    const context = fixture(7, advanced);
    assert.deepEqual(
      quoteEcazPoisonIncome(
        context,
        cards.map((card) => ({ card })),
      ),
      {
        player: 'ecaz',
        amount: 21,
        count: 7,
      },
    );
    for (const card of cards)
      assert.deepEqual(
        quoteEcazPoisonIncome(context, [{ card, battleSlot: 'weapon' }]),
        {
          player: 'ecaz',
          amount: 3,
          count: 1,
        },
      );
  }
});

void test('Chemistry earns only for its actual poison weapon role, not its potential role', () => {
  const card = find('chemistry');
  for (const battleSlot of [undefined, 'defense', 'leader'] as const)
    assert.equal(
      quoteEcazPoisonIncome(fixture(), [{ card, battleSlot }]),
      null,
    );
  assert.deepEqual(
    quoteEcazPoisonIncome(fixture(), [{ card, battleSlot: 'weapon' }]),
    {
      player: 'ecaz',
      amount: 3,
      count: 1,
    },
  );
});

void test('defenses, projectiles, laser, Artillery and named Richese specials pay no poison income', () => {
  const cards = [
    ...ordinary.filter(
      (card) =>
        !['poison', 'poisonBlade', 'poisonTooth', 'chemistry'].includes(
          card.kind,
        ),
    ),
    ...RICHESE_CARD_DEFINITIONS.map((definition) => definition.card),
  ];
  for (const card of cards)
    assert.equal(quoteEcazPoisonIncome(fixture(), [{ card }]), null, card.name);
  const residual = RICHESE_CARD_DEFINITIONS.find(
    (d) => d.card.effect === 'residualPoison',
  )!.card;
  assert.equal(
    quoteEcazPoisonIncome(fixture(), [
      { card: { ...residual, kind: 'poison' } },
    ]),
    null,
  );
});

void test('the exact current native threshold controls receipt in both game modes', () => {
  for (const advanced of [false, true])
    for (const reserves of [0, 6, 7, 20])
      assert.equal(
        quoteEcazPoisonIncome(fixture(reserves, advanced), [{ card: poison }])
          ?.amount ?? 0,
        reserves >= 7 ? 3 : 0,
      );
  for (const homeworlds of [undefined, null, { custody: null }])
    assert.equal(
      quoteEcazPoisonIncome({ ...fixture(), homeworlds }, [{ card: poison }]),
      null,
    );
});

void test('foreign presence supplies no native population and receives no award', () => {
  const context = fixture(6);
  context.players[1].reserves -= 3;
  context.homeworlds.custody.visitors['homeworld:ecaz'] = {
    emperor: { normal: 3, elite: 0 },
  };
  assert.equal(quoteEcazPoisonIncome(context, [{ card: poison }]), null);
});

void test('quotation reads no hands, spice, battle plans or card-owner identity and survives JSON', () => {
  const context = fixture();
  const restored = JSON.parse(JSON.stringify(context)) as typeof context;
  const before = JSON.stringify(restored);
  for (const player of context.players) {
    Object.defineProperty(player, 'hand', {
      get: () => {
        throw new Error('private hand read');
      },
    });
    Object.defineProperty(player, 'spice', {
      get: () => {
        throw new Error('private spice read');
      },
    });
  }
  const entries = Object.freeze([
    Object.freeze({ card: Object.freeze({ ...poison }) }),
  ]);
  assert.deepEqual(
    quoteEcazPoisonIncome(context, entries),
    quoteEcazPoisonIncome(restored, entries),
  );
  assert.equal(JSON.stringify(restored), before);
});

void test('duplicate physical discards and malformed slots reject without mutation', () => {
  const context = fixture();
  const before = JSON.stringify(context);
  for (const entries of [
    [{ card: poison }, { card: poison }],
    [{ card: poison, battleSlot: 'possible-weapon' }],
    [{ card: { ...poison, id: '' } }],
  ])
    assert.throws(
      () => quoteEcazPoisonIncome(context, entries as EcazPoisonDiscard[]),
      EcazPoisonIncomeError,
    );
  assert.equal(JSON.stringify(context), before);
  assert.equal(quoteEcazPoisonIncome(context, []), null);
});

void test('Mirror disposal uses the retained actual copied weapon, not a guessed physical kind', () => {
  const card = RICHESE_CARD_DEFINITIONS.find(
    (d) => d.card.effect === 'mirrorWeapon',
  )!.card;
  assert.equal(quoteEcazPoisonIncome(fixture(), [{ card }]), null);
  assert.throws(
    () => quoteEcazPoisonIncome(fixture(), [{ card, battleSlot: 'weapon' }]),
    /retained validated/,
  );
  assert.equal(
    quoteEcazPoisonIncome(fixture(6), [{ card, battleSlot: 'weapon' }]),
    null,
  );
  for (const kind of [
    'poison',
    'poisonBlade',
    'poisonTooth',
    'chemistry',
    'lasgun',
    'artillery',
    'projectile',
  ] as const) {
    const resolved = resolveBattleWeapons({
      attacker: { weapon: card },
      defender: { weapon: find(kind), defense: find('snooper') },
    });
    assert.equal(resolved.error, null);
    assert.equal(
      quoteEcazPoisonIncome(fixture(), [
        { card, battleSlot: 'weapon', effectiveWeapon: resolved.attacker },
      ])?.amount ?? 0,
      ['poison', 'poisonBlade', 'poisonTooth', 'chemistry'].includes(kind)
        ? 3
        : 0,
      kind,
    );
  }
  const empty = resolveBattleWeapons({
    attacker: { weapon: card },
    defender: {},
  }).attacker;
  assert.equal(
    quoteEcazPoisonIncome(fixture(), [
      { card, battleSlot: 'weapon', effectiveWeapon: empty },
    ]),
    null,
  );
  assert.throws(
    () =>
      quoteEcazPoisonIncome(fixture(), [
        {
          card,
          battleSlot: 'weapon',
          effectiveWeapon: { ...empty, physicalId: 'another' },
        },
      ]),
    EcazPoisonIncomeError,
  );
});
