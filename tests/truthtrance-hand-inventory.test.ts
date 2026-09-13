import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeck, ixDeck, treacheryDeck } from '../game/cards';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { CARD_CATEGORIES, printedCardCategory } from '../game/card-category';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { richeseCards } from '../game/richese-cards';
import {
  handInventoryFactMatches,
  handInventoryFactText,
  parseHandInventoryFact,
  type HandInventoryFact,
} from '../game/truthtrance-hand-inventory';
import type { TruthFact } from '../game/truthtrance';

const inventoryFact = (
  category: HandInventoryFact['category'],
  compare: HandInventoryFact['compare'],
  value: number,
): HandInventoryFact => ({ kind: 'handInventory', category, compare, value });

void test('the complete implemented catalog has one exhaustive primary printed role, including Ix alternate-slot and canonical Richese edges', () => {
  const catalog = [...baseDeck(), ...ixDeck(), ...richeseCards(), ...ecazTreacheryCards()];
  const before = structuredClone(catalog);
  const counts: Record<HandInventoryFact['category'], number> = {
    all: 60, weapon: 17, defense: 13, worthless: 6, hero: 2, special: 22,
  };
  assert.deepEqual(CARD_CATEGORIES, ['weapon', 'defense', 'worthless', 'hero', 'special']);
  for (const category of CARD_CATEGORIES)
    assert.equal(catalog.filter((card) => printedCardCategory(card) === category).length, counts[category]);

  const category = (name: string) =>
    printedCardCategory(catalog.find((card) => card.name === name)!);
  for (const name of ['Poison Blade', 'Poison Tooth', 'Artillery Strike', 'Weirding Way', 'Stone Burner', 'Mirror Weapon'])
    assert.equal(category(name), 'weapon', name);
  for (const name of ['Shield Snooper', 'Chemistry', 'Portable Snooper'])
    assert.equal(category(name), 'defense', name);
  for (const name of ['Reinforcements', 'Harass & Withdraw'])
    assert.equal(category(name), 'special', `${name} is only eligible for a battle slot`);
  for (const name of ['Stone Burner', 'Mirror Weapon', 'Portable Snooper']) {
    const canonical = richeseCards().find((card) => card.name === name)!;
    assert.equal(printedCardCategory({ ...canonical, id: `forged-${canonical.id}` }), 'special');
  }
  for (const [category, count] of Object.entries(counts) as [
    HandInventoryFact['category'], number,
  ][]) {
    assert.ok(handInventoryFactMatches(catalog, inventoryFact(category, 'eq', count)));
    assert.ok(!handInventoryFactMatches(catalog, inventoryFact(category, 'gte', count + 1)));
    assert.ok(!handInventoryFactMatches(catalog, inventoryFact(category, 'lte', count - 1)));
  }
  assert.ok(handInventoryFactMatches(catalog, inventoryFact('all', 'lte', Number.MAX_SAFE_INTEGER)));
  assert.deepEqual(catalog, before);
});

void test('the parser normalizes records and rejects malformed categories, comparisons, and unsafe counts immutably', () => {
  const valid = {
    kind: 'handInventory',
    category: 'weapon',
    compare: 'gte',
    value: 2,
    privateDetail: 'ignored',
  };
  const before = structuredClone(valid);
  assert.deepEqual(
    parseHandInventoryFact(valid),
    inventoryFact('weapon', 'gte', 2),
  );
  assert.deepEqual(valid, before);

  for (const category of ['weapons', 'Weapon', '', 1, null, undefined])
    assert.throws(
      () => parseHandInventoryFact({ ...valid, category }),
      /known primary card role/,
    );
  for (const compare of ['gt', 'lt', '=', '', 1, null, undefined])
    assert.throws(
      () => parseHandInventoryFact({ ...valid, compare }),
      /Compare held cards/,
    );
  for (const value of [
    -1,
    0.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    '2',
    null,
    undefined,
  ])
    assert.throws(
      () => parseHandInventoryFact({ ...valid, value }),
      /whole card count/,
    );
  assert.throws(
    () => parseHandInventoryFact({ ...valid, kind: 'handCount' }),
    /known primary card role/,
  );
});

void test('inventory question text identifies current custody, the comparator, and primary-role semantics', () => {
  assert.equal(
    handInventoryFactText(inventoryFact('all', 'eq', 1)),
    'you currently hold exactly 1 card in your hand',
  );
  assert.equal(
    handInventoryFactText(inventoryFact('weapon', 'gte', 2)),
    'you currently hold at least 2 cards whose primary role is a weapon',
  );
  assert.equal(
    handInventoryFactText(inventoryFact('special', 'lte', 0)),
    'you currently hold at most 0 Special cards without a primary battle role',
  );
});

function takeDeck(g: Game, id: string, name: string) {
  const index = g.deck.findIndex((card) => card.name === name);
  assert.ok(index >= 0, name);
  g.players
    .find((player) => player.id === id)!
    .hand.push(g.deck.splice(index, 1)[0]);
}

function takeRichese(g: Game, id: string, name: string) {
  const index = g.richeseCache!.findIndex((card) => card.name === name);
  assert.ok(index >= 0, name);
  g.players
    .find((player) => player.id === id)!
    .hand.push(g.richeseCache!.splice(index, 1)[0]);
}

function fixture() {
  const g = createGame('INVTRUTH', newPlayer('a', 'Asker', 'atreides'), false, [
    'ix',
    'choam',
  ]);
  g.players.push(
    newPlayer('r', 'Target', 'richese'),
    newPlayer('h', 'Observer', 'harkonnen'),
  );
  Object.assign(g, {
    status: 'playing',
    turn: 2,
    phase: 4,
    order: ['h', 'r', 'a'],
    deck: treacheryDeck(['ix']),
    richeseCache: richeseCards(),
  });
  for (const player of g.players) {
    player.spice = 20;
    player.traitors = [player.leaders[0].id];
  }
  const selected = new Set(g.players.flatMap((player) => player.traitors));
  g.traitorReserve = g.players
    .flatMap((player) => player.leaders.map((leader) => leader.id))
    .filter((id) => !selected.has(id));

  takeDeck(g, 'a', 'Truthtrance');
  takeDeck(g, 'a', 'Shield');
  takeDeck(g, 'h', 'Truthtrance');
  takeDeck(g, 'h', 'Snooper');
  for (const name of ['Poison Blade', 'Chemistry', 'Cheap Hero', 'Harvester'])
    takeDeck(g, 'r', name);
  return g;
}

function declare(state: Game, id = 'a') {
  const player = state.players.find((candidate) => candidate.id === id)!;
  return applyAction(state, id, {
    type: 'card',
    card: player.hand.find((card) => card.effect === 'truthtrance')!.id,
  });
}

function finishPriority(state: Game) {
  let g = state;
  while (g.truthtrance?.stage === 'priority') {
    const player = g.players.find(
      (candidate) => !g.truthtrance!.passed.includes(candidate.id),
    )!;
    g = applyAction(g, player.id, { type: 'truthPass' });
  }
  assert.equal(g.truthtrance?.stage, 'ask');
  return g;
}

function pending(state: Game, fact: TruthFact, asker = 'a', target = 'r') {
  return applyAction(finishPriority(declare(state, asker)), asker, {
    type: 'truthAsk',
    question: { kind: 'fact', target, fact },
  });
}

function rejectUnchanged(g: Game, id: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, id, action));
  assert.deepEqual(g, before);
}

function physicalCardIds(g: Game) {
  return [
    ...g.deck,
    ...g.discard,
    ...(g.richeseCache ?? []),
    ...g.players.flatMap((player) => player.hand),
  ]
    .map((card) => card.id)
    .sort();
}

void test('real declaration, priority, question, and answer use only current hand custody and discard Truthtrance once', () => {
  const cases: [HandInventoryFact, 'yes' | 'no'][] = [
    [inventoryFact('all', 'eq', 4), 'yes'],
    [inventoryFact('weapon', 'eq', 1), 'yes'],
    [inventoryFact('defense', 'gte', 2), 'no'],
    [inventoryFact('worthless', 'eq', 0), 'yes'],
    [inventoryFact('hero', 'gte', 2), 'no'],
    [inventoryFact('special', 'eq', 1), 'yes'],
  ];
  for (const [fact, expected] of cases) {
    const initial = fixture();
    const targetHand = structuredClone(initial.players[1].hand);
    const g = pending(initial, fact);
    assert.equal(viewGame(g, 'r').truthAnswer, expected);
    const done = applyAction(g, 'r', {
      type: 'truthAnswer',
      answer: expected,
    });
    assert.equal(done.truthtrance, null);
    assert.deepEqual(done.truthHistory!.at(-1), {
      turn: 2,
      phase: 4,
      asker: 'a',
      question: { kind: 'fact', target: 'r', fact },
      answer: expected,
    });
    assert.deepEqual(done.players[1].hand, targetHand);
    assert.equal(
      done.discard.filter((card) => card.effect === 'truthtrance').length,
      1,
    );
  }
  const g = pending(fixture(), inventoryFact('weapon', 'eq', 1));
  rejectUnchanged(g, 'r', { type: 'truthAnswer', answer: 'no' });
  rejectUnchanged(g, 'r', { type: 'truthAnswer', answer: 'unknown' });
  rejectUnchanged(g, 'h', { type: 'truthAnswer', answer: 'yes' });
});

void test('malformed inventory leaves reject atomically even behind an already-true OR clause', () => {
  const g = finishPriority(declare(fixture()));
  const valid = inventoryFact('weapon', 'gte', 1);
  const invalid = [
    { ...valid, category: 'weapons' },
    { ...valid, category: 'Weapon' },
    { ...valid, category: null },
    { ...valid, compare: 'gt' },
    { ...valid, value: -1 },
    { ...valid, value: 1.5 },
    { ...valid, value: Number.MAX_SAFE_INTEGER + 1 },
    { ...valid, value: '3' },
  ];
  for (const leaf of invalid)
    rejectUnchanged(g, 'a', {
      type: 'truthAsk',
      question: {
        kind: 'fact',
        target: 'r',
        fact: {
          kind: 'or',
          terms: [inventoryFact('all', 'gte', 0), leaf],
        },
      },
    });
  assert.equal(g.truthtrance?.stage, 'ask');
  assert.equal(g.truthtrance.question, null);
  assert.equal(g.discard.length, 0);
});

void test('combined inventory facts preserve unknown semantics and disclose only the aggregate boolean', () => {
  const initial = fixture();
  initial.players[1].traitorChoices = ['atreides-1'];
  initial.traitorReserve = initial.traitorReserve!.filter(
    (id) => id !== 'atreides-1',
  );
  const unknown: TruthFact = { kind: 'traitor', leader: 'atreides-1' };
  const scenarios: [TruthFact, 'yes' | 'no' | 'unknown'][] = [
    [
      { kind: 'and', terms: [inventoryFact('weapon', 'eq', 1), unknown] },
      'unknown',
    ],
    [{ kind: 'and', terms: [inventoryFact('weapon', 'eq', 2), unknown] }, 'no'],
    [
      { kind: 'or', terms: [inventoryFact('defense', 'eq', 1), unknown] },
      'yes',
    ],
    [
      { kind: 'or', terms: [inventoryFact('defense', 'eq', 2), unknown] },
      'unknown',
    ],
  ];
  for (const [fact, expected] of scenarios) {
    const g = pending(initial, fact);
    assert.equal(viewGame(g, 'r').truthAnswer, expected);
    for (const id of ['a', 'h']) {
      const view = viewGame(g, id);
      assert.equal(view.truthAnswer, null);
      assert.equal(
        view.players.find((player) => player.id === 'r')!.hand,
        undefined,
      );
      assert.equal(
        view.players.find((player) => player.id === 'r')!.traitorChoices,
        undefined,
      );
      for (const card of g.players[1].hand)
        assert.equal(JSON.stringify(view).includes(card.id), false);
    }
    const done = applyAction(g, 'r', {
      type: 'truthAnswer',
      answer: expected,
    });
    assert.equal(done.truthHistory!.at(-1)!.answer, expected);
  }
});

function swapHeldCard(
  g: Game,
  playerId: string,
  heldName: string,
  deckName: string,
) {
  const player = g.players.find((candidate) => candidate.id === playerId)!;
  const held = player.hand.findIndex((card) => card.name === heldName);
  const deck = g.deck.findIndex((card) => card.name === deckName);
  assert.ok(held >= 0, heldName);
  assert.ok(deck >= 0, deckName);
  const [replacement] = g.deck.splice(deck, 1);
  g.deck.push(player.hand.splice(held, 1, replacement)[0]);
}

void test('equivalent hidden inventories yield the same outsider projection and all four bot profiles return only the legal boolean', () => {
  for (const difficulty of DIFFICULTIES)
    for (const fact of [
      inventoryFact('all', 'eq', 4),
      inventoryFact('weapon', 'gte', 1),
      inventoryFact('defense', 'lte', 0),
      inventoryFact('special', 'eq', 1),
    ]) {
      const first = fixture();
      first.players[1].bot = difficulty;
      const second = structuredClone(first);
      swapHeldCard(second, 'r', 'Poison Blade', 'Poison Tooth');
      swapHeldCard(second, 'h', 'Snooper', 'Gom Jabbar');

      const worlds = [pending(first, fact), pending(second, fact)];
      assert.deepEqual(viewGame(worlds[0], 'a'), viewGame(worlds[1], 'a'));
      const expected = handInventoryFactMatches(worlds[0].players[1].hand, fact)
        ? 'yes'
        : 'no';
      for (const world of worlds) {
        const targetView = viewGame(world, 'r');
        const snapshot = structuredClone(targetView);
        assert.equal(targetView.truthAnswer, expected);
        assert.deepEqual(botActions(targetView), [
          { type: 'truthAnswer', answer: expected },
        ]);
        assert.deepEqual(targetView, snapshot);
        assert.deepEqual(botActions(viewGame(world, 'h')), []);
        const done = applyAction(world, 'r', botActions(targetView)[0]);
        assert.equal(done.truthHistory!.at(-1)!.answer, expected);
      }
    }
});

void test('a JSON-restored answer records the old fact while a later legal Richese gift changes the next current answer', () => {
  const initial = fixture();
  for (const name of ['Cheap Hero', 'Harvester']) {
    const index = initial.players[1].hand.findIndex(
      (card) => card.name === name,
    );
    assert.ok(index >= 0);
    initial.deck.push(initial.players[1].hand.splice(index, 1)[0]);
  }
  takeRichese(initial, 'r', 'Stone Burner');
  const stone = initial.players[1].hand.find(
    (card) => card.name === 'Stone Burner',
  )!;
  const ids = physicalCardIds(initial);
  let g = pending(initial, inventoryFact('weapon', 'eq', 2));
  g = applyAction(JSON.parse(JSON.stringify(g)) as Game, 'r', {
    type: 'truthAnswer',
    answer: 'yes',
  });
  assert.equal(g.truthHistory!.at(-1)!.answer, 'yes');

  g.players[1].ally = 'h';
  g.players[2].ally = 'r';
  g = applyAction(g, 'r', { type: 'richeseGift', card: stone.id });
  assert.equal(
    g.players[1].hand.some((card) => card.id === stone.id),
    false,
  );
  assert.equal(
    g.players[2].hand.some((card) => card.id === stone.id),
    true,
  );

  g = pending(g, inventoryFact('weapon', 'eq', 1), 'h', 'r');
  assert.equal(viewGame(g, 'r').truthAnswer, 'yes');
  const done = applyAction(JSON.parse(JSON.stringify(g)) as Game, 'r', {
    type: 'truthAnswer',
    answer: 'yes',
  });
  assert.deepEqual(
    done.truthHistory!.map((record) => record.answer),
    ['yes', 'yes'],
  );
  assert.deepEqual(physicalCardIds(done), ids);
  assert.equal(
    done.discard.filter((card) => card.effect === 'truthtrance').length,
    2,
  );
});
