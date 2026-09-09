import test from 'node:test';
import assert from 'node:assert/strict';
import type { FactionId } from '../game/catalog';
import { newPlayer } from '../game/engine';
import {
  HomeworldCustodyError,
  createHomeworldCustody,
} from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import {
  homeworldMobileStrongholdMovementBlock,
  homeworldMovementForesightBlock,
  homeworldNoFieldMovementBlock,
  homeworldSpiritualAdvisorLimit,
  homeworldSpiritualAdvisorAllowance,
  homeworldSpiritualAdvisorQuote,
} from '../game/homeworld-mobility';

function fixture(faction: FactionId, reserves: number, advanced = true) {
  const players = [
    newPlayer('native', 'Native', faction),
    newPlayer('visitor', 'Visitor', 'guild'),
  ];
  players[0].reserves = reserves;
  if (players[0].elites) players[0].elites.reserves = 0;
  const context = { advanced, players };
  return {
    ...context,
    homeworlds: { custody: createHomeworldCustody(homeworldContext(context)) },
  };
}

const blocks = [
  { faction: 'atreides', threshold: 6, read: homeworldMovementForesightBlock },
  {
    faction: 'ixians',
    threshold: 5,
    read: homeworldMobileStrongholdMovementBlock,
  },
  { faction: 'richese', threshold: 10, read: homeworldNoFieldMovementBlock },
] as const;

void test('native mobility penalties use each printed threshold in Basic and Advanced', () => {
  for (const { faction, threshold, read } of blocks)
    for (const advanced of [false, true])
      for (const reserves of [0, threshold - 1, threshold, 20]) {
        const context = fixture(faction, reserves, advanced);
        assert.equal(
          !!read(context, 'native'),
          reserves < threshold,
          `${faction}/${advanced}/${reserves}`,
        );
        assert.equal(read(context, 'visitor'), null);
        assert.equal(read(context, 'absent'), null);
      }
});

void test('Wallach low prevents both accompaniment destinations; high permits an optional second only at Polar Sink', () => {
  for (const advanced of [false, true])
    for (const reserves of [0, 1, 10, 11, 20]) {
      const context = fixture('beneGesserit', reserves, advanced);
      assert.equal(
        homeworldSpiritualAdvisorLimit(context, 'native', 'polar_sink'),
        reserves >= 11 ? 2 : 0,
      );
      assert.equal(
        homeworldSpiritualAdvisorLimit(context, 'native', 'arrakeen'),
        reserves >= 11 ? 1 : 0,
      );
      assert.equal(
        !!homeworldSpiritualAdvisorQuote(context, 'native', 'polar_sink')
          .blocked,
        reserves < 11,
      );
      assert.equal(
        homeworldSpiritualAdvisorLimit(context, 'visitor', 'polar_sink'),
        0,
      );
      assert.equal(
        homeworldSpiritualAdvisorLimit(context, 'absent', 'polar_sink'),
        0,
      );
    }
});

void test('ordinary single-advisor reserve limits remain unchanged without initialized Homeworld custody', () => {
  for (const reserves of [0, 1, 20])
    for (const homeworlds of [undefined, null, { custody: null }]) {
      const context = { ...fixture('beneGesserit', reserves), homeworlds };
      for (const destination of ['polar_sink', 'arrakeen']) {
        const quote = homeworldSpiritualAdvisorQuote(
          context,
          'native',
          destination,
        );
        assert.equal(quote.maximum, Math.min(1, reserves));
        assert.equal(!!quote.blocked, reserves === 0);
      }
    }
});

void test('denied-action population allowance remains separate from available placement resources', () => {
  const ordinary = { ...fixture('beneGesserit', 0), homeworlds: null };
  assert.equal(
    homeworldSpiritualAdvisorAllowance(ordinary, 'native', 'polar_sink'),
    1,
  );
  assert.equal(
    homeworldSpiritualAdvisorLimit(ordinary, 'native', 'polar_sink'),
    0,
  );
  assert.equal(
    homeworldSpiritualAdvisorAllowance(
      fixture('beneGesserit', 10),
      'native',
      'polar_sink',
    ),
    0,
  );
  assert.equal(
    homeworldSpiritualAdvisorAllowance(
      fixture('beneGesserit', 11),
      'native',
      'polar_sink',
    ),
    2,
  );
});

void test('absent module mobility blocks do not inspect any faction or force state', () => {
  for (const homeworlds of [undefined, null, { custody: null }]) {
    const context = { ...fixture('atreides', 0), homeworlds };
    Object.defineProperty(context, 'players', {
      get() {
        throw new Error('unneeded roster read');
      },
    });
    for (const { read } of blocks) assert.equal(read(context, 'native'), null);
  }
});

void test('foreign armies never raise native population or transfer its mobility penalties to visitors', () => {
  for (const { faction, threshold, read } of blocks) {
    const context = fixture(faction, threshold - 1);
    context.players[1].reserves = 0;
    context.homeworlds.custody.visitors[`homeworld:${faction}`] = {
      visitor: { normal: 20, elite: 0 },
    };
    assert.ok(read(context, 'native'));
    assert.equal(read(context, 'visitor'), null);
  }
  const context = fixture('beneGesserit', 10);
  context.players[1].reserves = 0;
  context.homeworlds.custody.visitors['homeworld:beneGesserit'] = {
    visitor: { normal: 20, elite: 0 },
  };
  assert.equal(
    homeworldSpiritualAdvisorLimit(context, 'native', 'polar_sink'),
    0,
  );
});

void test('population changes are read at the current opportunity rather than cached from phase opening', () => {
  const context = fixture('beneGesserit', 11);
  assert.equal(
    homeworldSpiritualAdvisorLimit(context, 'native', 'polar_sink'),
    2,
  );
  context.players[0].reserves -= 1;
  assert.equal(
    homeworldSpiritualAdvisorLimit(context, 'native', 'polar_sink'),
    0,
  );
  context.players[0].reserves += 1;
  assert.equal(
    homeworldSpiritualAdvisorLimit(context, 'native', 'polar_sink'),
    2,
  );
  for (const { faction, threshold, read } of blocks) {
    const moving = fixture(faction, threshold);
    assert.equal(read(moving, 'native'), null);
    moving.players[0].reserves--;
    assert.ok(read(moving, 'native'));
    moving.players[0].reserves++;
    assert.equal(read(moving, 'native'), null);
  }
});

void test('native Ix population includes both physical normal and Cyborg counters', () => {
  const context = fixture('ixians', 5);
  context.players[0].elites = { reserves: 3, tanks: 0, forces: {}, revived: 0 };
  assert.equal(homeworldMobileStrongholdMovementBlock(context, 'native'), null);
  context.players[0].reserves = 4;
  assert.ok(homeworldMobileStrongholdMovementBlock(context, 'native'));
});

void test('typed Salusa allocation stays separate and never grants another faction mobility advantages', () => {
  const context = fixture('emperor', 8);
  context.players[0].elites = { reserves: 2, tanks: 0, forces: {}, revived: 0 };
  context.homeworlds.custody.salusa = { normal: 3, elite: 2 };
  for (const { read } of blocks) assert.equal(read(context, 'native'), null);
  assert.equal(
    homeworldSpiritualAdvisorLimit(context, 'native', 'polar_sink'),
    0,
  );
  context.homeworlds.custody.salusa = { normal: 3, elite: 1 };
  for (const { read } of blocks) assert.equal(read(context, 'native'), null);
});

void test('mobility quotes survive JSON restoration, never mutate inputs and read no private cards or deck knowledge', () => {
  for (const faction of [
    'atreides',
    'beneGesserit',
    'ixians',
    'richese',
  ] as const) {
    const context = fixture(faction, 11);
    const before = JSON.stringify(context);
    const restored = JSON.parse(before) as typeof context;
    const expected = blocks.map(({ read }) => read(restored, 'native'));
    const advisors = homeworldSpiritualAdvisorQuote(
      restored,
      'native',
      'polar_sink',
    );
    for (const player of context.players) {
      for (const name of [
        'hand',
        'traitors',
        'prediction',
        'knownTraitors',
        'faceDancers',
        'spice',
      ])
        Object.defineProperty(player, name, {
          get() {
            throw new Error(`private ${name}`);
          },
        });
      Object.freeze(player.elites);
      Object.freeze(player);
    }
    Object.freeze(context.players);
    Object.freeze(context.homeworlds.custody.visitors);
    Object.freeze(context.homeworlds.custody);
    Object.freeze(context.homeworlds);
    Object.freeze(context);
    assert.deepEqual(
      blocks.map(({ read }) => read(context, 'native')),
      expected,
    );
    assert.deepEqual(
      homeworldSpiritualAdvisorQuote(context, 'native', 'polar_sink'),
      advisors,
    );
    assert.equal(JSON.stringify(restored), before);
  }
});

void test('malformed physical custody rejects instead of treating a corrupt world as high population', () => {
  const context = fixture('ixians', 5);
  context.homeworlds.custody.visitors['homeworld:ixians'] = {
    visitor: { normal: 1, elite: 1 },
  };
  const before = structuredClone(context);
  assert.throws(
    () => homeworldMobileStrongholdMovementBlock(context, 'native'),
    HomeworldCustodyError,
  );
  assert.deepEqual(context, before);
});
