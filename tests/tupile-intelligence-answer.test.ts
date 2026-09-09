import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeck, ixDeck, type Card } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import { quoteTupileIntelligenceAnswer as answer } from '../game/tupile-intelligence-answer';

const inventory = () => [
  ...baseDeck(),
  ...ixDeck(),
  ...richeseCards(),
  ...ecazTreacheryCards(),
];
const card = (id: string) => inventory().find((c) => c.id === id)!;

void test('every registered physical Treachery card has its printed primary category, independently of activation', () => {
  const weapons = new Set([
    ...Array.from({ length: 9 }, (_, n) => `treachery-${n}`),
    'ix-poison-tooth',
    'ix-artillery',
    'ix-poison-blade',
    'ix-weirding-way',
    'ix-hunter-seeker',
    'ix-basilia-weapon',
    'richese-stone-burner',
    'richese-mirror-weapon',
  ]);
  const defenses = new Set([
    ...Array.from({ length: 8 }, (_, n) => `treachery-${n + 9}`),
    'ix-shield-snooper',
    'ix-chemistry',
    'ix-shield',
    'ix-snooper',
    'richese-portable-snooper',
  ]);
  const cards = inventory();
  assert.equal(cards.length, 60);
  assert.equal(new Set(cards.map((c) => c.id)).size, 60);
  for (const c of cards) {
    assert.deepEqual(
      answer([c], 7, 'weapons'),
      { spice: 7, count: Number(weapons.has(c.id)) },
      c.id,
    );
    assert.deepEqual(
      answer([c], 7, 'defenses'),
      { spice: 7, count: Number(defenses.has(c.id)) },
      c.id,
    );
  }
  assert.deepEqual(answer(cards, 0, 'weapons'), { spice: 0, count: 17 });
  assert.deepEqual(answer(cards, 0, 'defenses'), { spice: 0, count: 13 });
});

void test('hybrids count once in their default printed category, while slot-compatible noncombat cards count neither', () => {
  const hybrids = [
    'ix-poison-blade',
    'ix-shield-snooper',
    'ix-weirding-way',
    'ix-chemistry',
  ].map(card);
  assert.deepEqual(answer(hybrids, 2, 'weapons'), { spice: 2, count: 2 });
  assert.deepEqual(answer(hybrids, 2, 'defenses'), { spice: 2, count: 2 });
  const neither = inventory().filter(
    (c) =>
      c.kind === 'worthless' || c.kind === 'hero' || c.id.startsWith('ecaz-'),
  );
  assert.equal(neither.length, 11);
  assert.equal(answer(neither, 4, 'weapons').count, 0);
  assert.equal(answer(neither, 4, 'defenses').count, 0);
  for (const c of hybrids)
    Object.defineProperty(c, 'battleRole', {
      get() {
        throw new Error('Held count must not inspect a committed battle role');
      },
    });
  assert.equal(answer(hybrids, 2, 'weapons').count, 2);
});

void test('Richese transport specials use canonical physical printed categories, not name or effect guesses', () => {
  const cards = richeseCards();
  assert.ok(cards.every((c) => c.kind === 'special'));
  assert.equal(answer(cards, 3, 'weapons').count, 2);
  assert.equal(answer(cards, 3, 'defenses').count, 1);
  assert.equal(
    answer([card('richese-residual-poison')], 3, 'weapons').count,
    0,
  );
  for (const forged of [
    { ...card('richese-residual-poison'), effect: 'stoneBurner' },
    { ...card('richese-stone-burner'), id: 'forged-weapon' },
    { ...card('richese-mirror-weapon'), kind: 'poison' },
    { ...card('richese-portable-snooper'), name: 'Snooper' },
  ])
    assert.throws(() => answer([forged as Card], 3, 'weapons'));
});

void test('same-name physical copies count separately; duplicate IDs and invented leader-skill cards reject', () => {
  const shields = inventory().filter((c) => c.name === 'Shield');
  const sparse: Card[] = [];
  sparse.length = 2;
  assert.equal(answer(shields, 0, 'defenses').count, 5);
  for (const invalid of [
    [shields[0], shields[0]],
    [shields[0], { ...shields[0] }],
    [
      {
        id: 'leader-skill-master-of-assassins',
        name: 'Master of Assassins',
        kind: 'poison',
      },
    ],
    [{ ...card('treachery-0'), id: 'treachery-999' }],
    [null],
    sparse,
  ])
    assert.throws(() => answer(invalid as Card[], 0, 'weapons'));
});

void test('zero and safe balances are truthful, malformed requests reject without partial private answers or mutation', () => {
  const hand = [card('treachery-0')];
  assert.deepEqual(answer([], 0, 'defenses'), { spice: 0, count: 0 });
  assert.deepEqual(answer(hand, Number.MAX_SAFE_INTEGER, 'weapons'), {
    spice: Number.MAX_SAFE_INTEGER,
    count: 1,
  });
  for (const spice of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => answer(hand, spice, 'weapons'));
  for (const category of ['both', 'weapon', null, 1])
    assert.throws(() => answer(hand, 0, category as 'weapons'));
  const corrupt = [
    hand[0],
    { ...card('richese-stone-burner'), name: 'Private corrupt face' },
  ];
  const before = JSON.stringify(corrupt);
  assert.throws(
    () => answer(corrupt, 109, 'weapons'),
    (error: Error) => {
      assert.doesNotMatch(
        error.message,
        /treachery|richese|109|Private corrupt face/,
      );
      return true;
    },
  );
  assert.equal(JSON.stringify(corrupt), before);
});

void test('the answer is a detached two-number snapshot across hand changes, JSON restore and frozen inputs', () => {
  const hand = [card('treachery-0'), card('treachery-9')];
  const receipt = answer(hand, 12, 'weapons');
  assert.deepEqual(Object.keys(receipt).sort(), ['count', 'spice']);
  assert.deepEqual(JSON.parse(JSON.stringify(receipt)), {
    spice: 12,
    count: 1,
  });
  hand.splice(0, 1);
  assert.equal(answer(hand, 1, 'weapons').count, 0);
  assert.deepEqual(receipt, { spice: 12, count: 1 });
  Object.freeze(hand[0]);
  Object.freeze(hand);
  assert.deepEqual(answer(hand, 1, 'defenses'), { spice: 1, count: 1 });
});

void test('the documented legacy Ellaca Drug name is recognized without changing its saved identity or the distinct Ix weapon', () => {
  const legacy = { ...card('treachery-7'), name: 'Basilia Weapon' };
  const hand = [legacy, card('ix-basilia-weapon')];
  const before = JSON.stringify(hand);
  assert.equal(answer(hand, 6, 'weapons').count, 2);
  assert.equal(JSON.stringify(hand), before);
  assert.throws(() => answer([{ ...legacy, kind: 'shield' }], 6, 'defenses'));
});
