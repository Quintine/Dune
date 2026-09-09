import test from 'node:test';
import assert from 'node:assert/strict';
import { treacheryDeck, type Card } from '../game/cards';
import { newPlayer } from '../game/engine';
import {
  createHomeworldCustody,
  HomeworldCustodyError,
} from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import {
  highKaitainDiscardsAvailable,
  homeworldCardEconomyPopulation,
  homeworldWorthlessSaleBlock,
  quoteKaitainDiscards,
} from '../game/homeworld-card-economy';

function fixture(
  faction: 'emperor' | 'choam',
  reserves: number,
  advanced = true,
) {
  const players = [
    newPlayer('native', 'Native', faction),
    newPlayer('visitor', 'Visitor', 'guild'),
  ];
  players[0].reserves = reserves;
  if (players[0].elites) players[0].elites.reserves = 0;
  players[0].spice = 8;
  const deck = treacheryDeck();
  players[0].hand = [
    deck.find((card) => card.kind === 'poison')!,
    deck.find((card) => card.kind === 'worthless')!,
    deck.find((card) => card.effect === 'karama')!,
  ];
  assert.ok(players[0].hand.every(Boolean));
  const context = { advanced, players };
  return {
    ...context,
    homeworlds: { custody: createHomeworldCustody(homeworldContext(context)) },
  };
}

void test('Kaitain uses its printed native threshold in Basic and Advanced, independently of affordability', () => {
  for (const advanced of [false, true])
    for (const reserves of [0, 4, 5, 20]) {
      const context = fixture('emperor', reserves, advanced);
      context.players[0].spice = 0;
      assert.equal(
        highKaitainDiscardsAvailable(context, 'native'),
        reserves >= 5,
      );
      assert.equal(highKaitainDiscardsAvailable(context, 'visitor'), false);
      assert.equal(highKaitainDiscardsAvailable(context, 'absent'), false);
      assert.equal(
        homeworldCardEconomyPopulation(context, 'native', 'kaitain')
          ?.population,
        reserves,
      );
    }
});

void test('Salusa normal and Sardaukar counters are excluded from Kaitain while native stars on Kaitain count', () => {
  const context = fixture('emperor', 10);
  context.players[0].elites = { reserves: 5, tanks: 0, forces: {}, revived: 0 };
  context.homeworlds.custody.salusa = { normal: 1, elite: 5 };
  assert.equal(highKaitainDiscardsAvailable(context, 'native'), false);
  assert.equal(
    homeworldCardEconomyPopulation(context, 'native', 'kaitain')?.population,
    4,
  );
  context.homeworlds.custody.salusa.elite = 4;
  assert.equal(
    homeworldCardEconomyPopulation(context, 'native', 'kaitain')?.population,
    5,
  );
  assert.equal(highKaitainDiscardsAvailable(context, 'native'), true);
  context.homeworlds.custody.salusa.normal = 2;
  assert.equal(highKaitainDiscardsAvailable(context, 'native'), false);
});

void test('visitors neither raise native population nor acquire the native card economy effects', () => {
  for (const [faction, reserves] of [
    ['emperor', 4],
    ['choam', 10],
  ] as const) {
    const context = fixture(faction, reserves);
    context.players[1].reserves = 0;
    context.homeworlds.custody.visitors[`homeworld:${faction}`] = {
      visitor: { normal: 20, elite: 0 },
    };
    assert.equal(highKaitainDiscardsAvailable(context, 'native'), false);
    assert.equal(highKaitainDiscardsAvailable(context, 'visitor'), false);
    assert.equal(
      homeworldWorthlessSaleBlock(context, 'native', { kind: 'worthless' }),
      null,
    );
    assert.equal(
      homeworldWorthlessSaleBlock(context, 'visitor', { kind: 'worthless' }),
      null,
    );
  }
});

void test('absent or uninitialized Homeworld custody grants no Kaitain option and leaves ordinary sales alone', () => {
  for (const homeworlds of [undefined, null, { custody: null }]) {
    const context = { ...fixture('emperor', 20), homeworlds };
    assert.equal(highKaitainDiscardsAvailable(context, 'native'), false);
    assert.throws(
      () => quoteKaitainDiscards(context, 'native', []),
      HomeworldCustodyError,
    );
    assert.equal(
      homeworldWorthlessSaleBlock(
        { ...fixture('choam', 20), homeworlds },
        'native',
        { kind: 'worthless' },
      ),
      null,
    );
  }
});

void test('Kaitain selects exact physical cards, preserving order and quoting two held spice apiece', () => {
  const context = fixture('emperor', 5);
  const hand = context.players[0].hand;
  context.players[0].spice = 4;
  const quote = quoteKaitainDiscards(context, 'native', [
    hand[2].id,
    hand[0].id,
  ]);
  assert.equal(quote.cost, 4);
  assert.deepEqual(quote.cards, [hand[2], hand[0]]);
  assert.equal(context.players[0].spice, 4);
  assert.equal(context.players[0].hand.length, 3);
  assert.notEqual(quote.cards[0], hand[2]);
  quote.cards[0].name = 'Mutated result';
  assert.notEqual(hand[2].name, 'Mutated result');
});

void test('optional empty Kaitain selection costs nothing and does not require a card or spice', () => {
  const context = fixture('emperor', 5);
  context.players[0].hand = [];
  context.players[0].spice = 0;
  assert.deepEqual(quoteKaitainDiscards(context, 'native', []), {
    cards: [],
    cost: 0,
  });
});

void test('Kaitain cannot spend hoped-for discard income or play Karama for a free discard', () => {
  const context = fixture('emperor', 5);
  const before = JSON.stringify(context);
  for (const spice of [0, 1, 3]) {
    context.players[0].spice = spice;
    assert.throws(
      () =>
        quoteKaitainDiscards(
          context,
          'native',
          context.players[0].hand.slice(0, 2).map((card) => card.id),
        ),
      /already held/,
    );
  }
  context.players[0].spice = 8;
  assert.equal(JSON.stringify(context), before);
  const karama = context.players[0].hand.find(
    (card) => card.effect === 'karama',
  )!;
  assert.equal(quoteKaitainDiscards(context, 'native', [karama.id]).cost, 2);
});

void test('invalid, duplicated, missing and stale card selections reject without changing custody', () => {
  const context = fixture('emperor', 5);
  const id = context.players[0].hand[0].id;
  for (const selection of [
    undefined,
    null,
    id,
    {},
    [id, id],
    [id, 'missing'],
    [0],
    [''],
    [null],
  ]) {
    const before = JSON.stringify(context);
    assert.throws(
      () => quoteKaitainDiscards(context, 'native', selection),
      HomeworldCustodyError,
    );
    assert.equal(JSON.stringify(context), before);
  }
  context.players[0].hand.shift();
  assert.throws(
    () => quoteKaitainDiscards(context, 'native', [id]),
    /still be in/,
  );
  context.players[0].hand.push({ ...context.players[0].hand[0] });
  assert.throws(
    () => quoteKaitainDiscards(context, 'native', []),
    /unique physical/,
  );
});

void test('invalid own spice and corrupted typed custody fail closed', () => {
  for (const spice of [-1, 1.5, NaN, Infinity]) {
    const context = fixture('emperor', 5);
    context.players[0].spice = spice;
    assert.throws(
      () => quoteKaitainDiscards(context, 'native', []),
      HomeworldCustodyError,
    );
  }
  const context = fixture('emperor', 5);
  context.homeworlds.custody.salusa = { normal: 0, elite: 1 };
  assert.throws(
    () => quoteKaitainDiscards(context, 'native', []),
    HomeworldCustodyError,
  );
});

void test('Tupile prevents Worthless sales at eleven native forces in both modes, regardless of duplicate witness', () => {
  for (const advanced of [false, true])
    for (const reserves of [0, 10, 11, 20]) {
      const context = fixture('choam', reserves, advanced);
      const worthless = context.players[0].hand.find(
        (card) => card.kind === 'worthless',
      )!;
      context.players[0].hand.push({ ...worthless, id: 'duplicate-witness' });
      assert.equal(
        !!homeworldWorthlessSaleBlock(context, 'native', worthless),
        reserves >= 11,
      );
      for (const kind of ['poison', 'projectile', 'shield', 'special'] as const)
        assert.equal(
          homeworldWorthlessSaleBlock(context, 'native', { kind }),
          null,
        );
      assert.equal(
        homeworldWorthlessSaleBlock(context, 'absent', worthless),
        null,
      );
    }
});

void test('population is recomputed after a departure or revival rather than cached at phase opening', () => {
  const emperor = fixture('emperor', 5);
  assert.equal(highKaitainDiscardsAvailable(emperor, 'native'), true);
  emperor.players[0].reserves--;
  assert.throws(
    () => quoteKaitainDiscards(emperor, 'native', []),
    /high-population/,
  );
  emperor.players[0].reserves++;
  assert.deepEqual(quoteKaitainDiscards(emperor, 'native', []), {
    cards: [],
    cost: 0,
  });
  const choam = fixture('choam', 11);
  assert.ok(
    homeworldWorthlessSaleBlock(choam, 'native', { kind: 'worthless' }),
  );
  choam.players[0].reserves--;
  assert.equal(
    homeworldWorthlessSaleBlock(choam, 'native', { kind: 'worthless' }),
    null,
  );
});

void test('quotes survive JSON and frozen inputs without reading opponent cards, secrets or held spice', () => {
  const context = fixture('emperor', 5);
  const ids = context.players[0].hand.map((card) => card.id);
  const restored = JSON.parse(JSON.stringify(context)) as typeof context;
  const expected = quoteKaitainDiscards(restored, 'native', ids);
  for (const player of context.players) {
    for (const field of [
      'traitors',
      'prediction',
      'knownTraitors',
      'faceDancers',
      ...(player.id === 'visitor' ? ['hand', 'spice'] : []),
    ])
      Object.defineProperty(player, field, {
        get() {
          throw new Error(`private ${field}`);
        },
      });
    Object.freeze(player.elites);
    Object.freeze(player);
  }
  for (const card of context.players[0].hand) Object.freeze(card);
  Object.freeze(context.players[0].hand);
  Object.freeze(context.players);
  Object.freeze(context.homeworlds.custody.salusa);
  Object.freeze(context.homeworlds.custody.visitors);
  Object.freeze(context.homeworlds.custody);
  Object.freeze(context);
  assert.deepEqual(quoteKaitainDiscards(context, 'native', ids), expected);
  const choam = fixture('choam', 11);
  for (const player of choam.players)
    for (const field of ['hand', 'spice'])
      Object.defineProperty(player, field, {
        get() {
          throw new Error(`private ${field}`);
        },
      });
  assert.ok(
    homeworldWorthlessSaleBlock(choam, 'native', { kind: 'worthless' } as Card),
  );
});
