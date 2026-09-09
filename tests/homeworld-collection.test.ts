import test from 'node:test';
import assert from 'node:assert/strict';
import { newPlayer } from '../game/engine';
import {
  createHomeworldCustody,
  HomeworldCustodyError,
} from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import {
  lowGrummanRevealBlock,
  quoteGiediCollectionBonus,
  type HomeworldCollectionSource,
} from '../game/homeworld-collection';

function fixture(
  faction: 'harkonnen' | 'moritani',
  reserves: number,
  advanced = true,
) {
  const players = [
    newPlayer('native', 'Native', faction),
    newPlayer('visitor', 'Visitor', 'emperor'),
  ];
  players[0].reserves = reserves;
  for (const player of players) if (player.elites) player.elites.reserves = 0;
  const context = { advanced, players };
  return {
    ...context,
    homeworlds: { custody: createHomeworldCustody(homeworldContext(context)) },
  };
}

void test('Giedi Prime pays once at seven native forces in either mode from actual qualifying collection', () => {
  for (const advanced of [false, true])
    for (const reserves of [0, 6, 7, 20]) {
      const context = fixture('harkonnen', reserves, advanced);
      const sources: HomeworldCollectionSource[] = [
        { kind: 'desert', amount: 1 },
        { kind: 'homeworld', amount: 3 },
        { kind: 'stronghold', amount: 2 },
        { kind: 'technology', amount: 1 },
      ];
      assert.deepEqual(
        quoteGiediCollectionBonus(context, 'native', sources, false),
        {
          player: 'native',
          amount: reserves >= 7 ? 2 : 0,
          qualifying: 4,
        },
      );
      assert.deepEqual(
        quoteGiediCollectionBonus(context, 'native', sources, true),
        {
          player: 'native',
          amount: 0,
          qualifying: 4,
        },
      );
    }
});

void test('stronghold and technology income, held spice and zero collection never qualify for Giedi', () => {
  const context = fixture('harkonnen', 7);
  context.players[0].spice = 1_000;
  for (const sources of [
    [],
    [{ kind: 'desert', amount: 0 }],
    [
      { kind: 'stronghold', amount: 5 },
      { kind: 'technology', amount: 1 },
      { kind: 'homeworld', amount: 0 },
    ],
  ] as HomeworldCollectionSource[][])
    assert.deepEqual(
      quoteGiediCollectionBonus(context, 'native', sources, false),
      {
        player: 'native',
        amount: 0,
        qualifying: 0,
      },
    );
  assert.equal(
    quoteGiediCollectionBonus(
      context,
      'native',
      [{ kind: 'homeworld', amount: 1 }],
      false,
    ).amount,
    2,
  );
});

void test('Giedi eligibility follows current native population and ignores foreign visitors', () => {
  const context = fixture('harkonnen', 6);
  context.players[1].reserves = 0;
  context.homeworlds.custody.visitors['homeworld:harkonnen'] = {
    visitor: { normal: 20, elite: 0 },
  };
  const sources: HomeworldCollectionSource[] = [{ kind: 'desert', amount: 1 }];
  assert.equal(
    quoteGiediCollectionBonus(context, 'native', sources, false).amount,
    0,
  );
  context.players[0].reserves++;
  assert.equal(
    quoteGiediCollectionBonus(context, 'native', sources, false).amount,
    2,
  );
  context.players[0].reserves--;
  assert.equal(
    quoteGiediCollectionBonus(context, 'native', sources, false).amount,
    0,
  );
});

void test('Grumman gates original batches below three only with native population below eight', () => {
  for (const advanced of [false, true])
    for (const reserves of [0, 7, 8, 20])
      for (const entering of [0, 1, 2, 3, 20]) {
        const context = fixture('moritani', reserves, advanced);
        assert.equal(
          !!lowGrummanRevealBlock(context, 'native', entering),
          reserves < 8 && entering < 3,
        );
        assert.equal(lowGrummanRevealBlock(context, 'visitor', entering), null);
        assert.equal(lowGrummanRevealBlock(context, 'absent', entering), null);
      }
});

void test('Grumman ignores visitors and existing destination forces rather than adding them to entering count', () => {
  const context = fixture('moritani', 7);
  context.players[1].reserves = 0;
  context.homeworlds.custody.visitors['homeworld:moritani'] = {
    visitor: { normal: 20, elite: 0 },
  };
  context.players[0].forces = { 'arrakeen:10': 6 };
  assert.ok(lowGrummanRevealBlock(context, 'native', 2));
  assert.equal(lowGrummanRevealBlock(context, 'native', 3), null);
  context.players[0].reserves++;
  assert.equal(lowGrummanRevealBlock(context, 'native', 2), null);
});

void test('absent and uninitialized Homeworld module grants neither Giedi income nor Grumman restriction', () => {
  for (const homeworlds of [undefined, null, { custody: null }]) {
    assert.equal(
      quoteGiediCollectionBonus(
        { ...fixture('harkonnen', 20), homeworlds },
        'native',
        [{ kind: 'desert', amount: 2 }],
        false,
      ).amount,
      0,
    );
    assert.equal(
      lowGrummanRevealBlock(
        { ...fixture('moritani', 0), homeworlds },
        'native',
        1,
      ),
      null,
    );
  }
});

void test('invalid collection receipts, owners, completion flag and entering counts reject immutably', () => {
  const context = fixture('harkonnen', 7);
  for (const sources of [
    undefined,
    null,
    {},
    Array(1),
    [null],
    [{ kind: 'unknown', amount: 1 }],
    [{ kind: 'desert', amount: -1 }],
    [{ kind: 'desert', amount: 0.5 }],
    [{ kind: 'desert', amount: NaN }],
    [{ kind: 'desert', amount: Infinity }],
    [{ kind: 'desert', amount: '1' }],
    [
      { kind: 'desert', amount: Number.MAX_SAFE_INTEGER },
      { kind: 'technology', amount: 1 },
    ],
  ]) {
    const before = JSON.stringify(context);
    assert.throws(
      () =>
        quoteGiediCollectionBonus(
          context,
          'native',
          sources as HomeworldCollectionSource[],
          false,
        ),
      HomeworldCustodyError,
    );
    assert.equal(JSON.stringify(context), before);
  }
  for (const owner of ['visitor', 'absent'])
    assert.throws(
      () => quoteGiediCollectionBonus(context, owner, [], false),
      HomeworldCustodyError,
    );
  for (const flag of [undefined, null, 0, 'false'])
    assert.throws(
      () =>
        quoteGiediCollectionBonus(
          context,
          'native',
          [],
          flag as unknown as boolean,
        ),
      HomeworldCustodyError,
    );
  for (const entering of [
    -1,
    0.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    const before = JSON.stringify(context);
    assert.throws(
      () => lowGrummanRevealBlock(context, 'native', entering),
      HomeworldCustodyError,
    );
    assert.equal(JSON.stringify(context), before);
  }
});

void test('quotes survive JSON and frozen inputs without reading any player private fields', () => {
  for (const faction of ['harkonnen', 'moritani'] as const) {
    const context = fixture(faction, 7);
    const restored = JSON.parse(JSON.stringify(context)) as typeof context;
    const sources: HomeworldCollectionSource[] = [
      { kind: 'desert', amount: Number.MAX_SAFE_INTEGER },
    ];
    const quote = (input: typeof context) =>
      faction === 'harkonnen'
        ? quoteGiediCollectionBonus(input, 'native', sources, false)
        : lowGrummanRevealBlock(input, 'native', 2);
    const expected = quote(restored);
    for (const player of context.players) {
      for (const field of [
        'spice',
        'hand',
        'traitors',
        'prediction',
        'faceDancers',
        'noField',
        'forces',
      ])
        Object.defineProperty(player, field, {
          get() {
            throw new Error(`private ${field}`);
          },
        });
      Object.freeze(player.elites);
      Object.freeze(player);
    }
    Object.freeze(context.players);
    Object.freeze(context.homeworlds.custody.salusa);
    Object.freeze(context.homeworlds.custody.visitors);
    Object.freeze(context.homeworlds.custody);
    Object.freeze(context.homeworlds);
    Object.freeze(context);
    Object.freeze(sources[0]);
    Object.freeze(sources);
    assert.deepEqual(quote(context), expected);
  }
});
