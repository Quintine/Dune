import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cardPresentation,
  richeseCardActionBlock,
} from '../game/card-presentation';
import { baseDeck, ixDeck, treacheryDeck, type Card } from '../game/cards';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import { RICHESE_CARD_DEFINITIONS, richeseCards } from '../game/richese-cards';
import { RULE_TOPICS, RULE_CHECKLIST_AREAS } from '../game/reference';

void test('every Richese physical card presents its complete guide and actual printed category without changing its runtime kind', () => {
  for (const definition of RICHESE_CARD_DEFINITIONS) {
    const supplied = { ...definition.card };
    const original = structuredClone(supplied);
    const presentation = cardPresentation(supplied);
    assert.deepEqual(supplied, original);
    assert.equal(presentation.category, definition.printedType);
    assert.equal(presentation.guidance, definition.summary);
    assert.deepEqual(presentation.gameplay, definition.gameplay);
    assert.equal(
      presentation.role,
      definition.behavior.battleCategory === 'weapon'
        ? 'weapon'
        : definition.behavior.battleCategory === 'poison-defense'
          ? 'defense'
          : 'utility',
    );
    assert.match(
      presentation.availability!,
      definition.card.effect === 'stoneBurner'
        ? /Combined allocation timing and Ix timing remain guarded/
        : /effect integration and verification are incomplete/,
    );
    assert.deepEqual(
      presentation.topics.map((topic) => topic.id),
      [
        definition.card.effect === 'juiceOfSapho'
          ? 'juice-of-sapho'
          : definition.card.effect === 'stoneBurner'
            ? 'stone-burner'
            : definition.card.effect === 'portableSnooper'
              ? 'portable-snooper'
              : 'richese-cards',
      ],
    );
    assert.equal(supplied.kind, 'special');
  }
});

void test('presentation does not export source-verification metadata or unverified interaction guesses', () => {
  for (const definition of RICHESE_CARD_DEFINITIONS) {
    const presentation = cardPresentation(definition.card);
    assert.deepEqual(Object.keys(presentation).sort(), [
      'availability',
      'category',
      'gameplay',
      'guidance',
      'role',
      'topics',
    ]);
    const serialized = JSON.stringify(presentation);
    for (const note of definition.verification.unresolved)
      assert.equal(serialized.includes(note), false);
    for (const metadata of [
      'physical-faces-verified',
      'original-paraphrase-of-physical-faces',
      'combinedInteractions',
      'https://cdn.anyfinder',
    ])
      assert.equal(serialized.includes(metadata), false);
  }
});

void test('missing, altered and merely similar Richese identities receive no canonical full guide', () => {
  for (const card of richeseCards()) {
    const impostors: Card[] = [
      { ...card, id: 'other-card' },
      { ...card, name: 'Other name' },
      { ...card, kind: 'poison' },
      { ...card, effect: 'unknown-effect' },
      { ...card, effect: undefined },
      { ...card, id: card.id.toUpperCase() },
    ];
    for (const impostor of impostors) {
      const result = cardPresentation(impostor);
      assert.equal(result.gameplay, undefined);
      assert.equal(result.availability, undefined);
      assert.equal(
        result.topics.some((topic) => topic.id === 'richese-cards'),
        false,
      );
    }
  }
});

void test('the public collection and ten full card topics are searchable, linked and identify implemented handlers', () => {
  const ids = new Set(RULE_TOPICS.map((topic) => topic.id));
  assert.equal(ids.size, RULE_TOPICS.length);
  const hub = RULE_TOPICS.find((topic) => topic.id === 'richese-cards')!;
  assert.deepEqual(
    hub.checklist!.map((item) => item.area),
    [...RULE_CHECKLIST_AREAS],
  );
  assert.equal(hub.coverage, 'Partial');
  assert.equal(
    hub.checklist!.find((item) => item.area === 'AI')!.status,
    'Partial',
  );
  assert.match(
    hub.steps.join(' '),
    /not the contents of any player’s current cache or hand/,
  );
  assert.match(
    hub.steps.join(' '),
    /Mirror Weapon and Semuta Drug remain unfinished/,
  );
  assert.match(hub.steps.join(' '), /Discard contents remain private/);
  for (const definition of RICHESE_CARD_DEFINITIONS) {
    const id = `card-${definition.card.id}`;
    const topic = RULE_TOPICS.find((candidate) => candidate.id === id)!;
    assert.ok(hub.related!.includes(id));
    assert.equal(topic.coverage, 'Partial');
    assert.ok(topic.summary.includes(definition.printedType));
    assert.deepEqual(topic.steps.slice(0, -1), definition.gameplay);
    assert.match(
      topic.steps.at(-1)!,
      definition.card.effect === 'juiceOfSapho'
        ? /Juice of Sapho panel/
        : definition.card.effect === 'karama'
          ? /existing generic handler/
          : definition.card.effect === 'distrans'
            ? /Distrans transfer panel/
            : definition.card.effect === 'nullentropyBox'
              ? /Nullentropy Box panel/
              : definition.card.effect === 'ornithopter'
                ? /Ornithopter movement controls/
                : definition.card.effect === 'residualPoison'
                  ? /Residual Poison panel/
                  : definition.card.effect === 'portableSnooper'
                    ? /Portable Snooper/
                    : definition.card.effect === 'stoneBurner'
                      ? /Stone Burner/
                      : /actions are not enabled/,
    );
    for (const related of topic.related!) assert.ok(ids.has(related));
    assert.doesNotMatch(JSON.stringify(topic), /https?:\/\//);
  }
  for (const id of ['implementation-checklist', 'choam-modules'])
    assert.ok(
      RULE_TOPICS.find((topic) => topic.id === id)!.related!.includes(
        'richese-cards',
      ),
    );
});

void test('base, Ix and Ecaz presentations and deck activation are unchanged', () => {
  for (const card of [...baseDeck(), ...ixDeck()]) {
    const presentation = cardPresentation(card);
    assert.equal(presentation.availability, undefined);
    assert.equal(presentation.gameplay, undefined);
    assert.equal(
      presentation.topics.some((topic) => topic.id === 'richese-cards'),
      false,
    );
  }
  for (const card of ecazTreacheryCards()) {
    const presentation = cardPresentation(card);
    assert.equal(presentation.category, 'Special treachery');
    assert.ok(presentation.gameplay!.length >= 4);
    assert.equal(presentation.availability, undefined);
    assert.deepEqual(presentation.topics, []);
  }
  assert.equal(treacheryDeck().length, 33);
  assert.equal(treacheryDeck(['ix']).length, 47);
  assert.throws(() => treacheryDeck(['choam']), /not implemented/);
  assert.throws(() => treacheryDeck(['richese']), /not implemented/);
});

void test('unsupported canonical Richese effects have an explicit action block while Karama and unrelated cards retain their validators', () => {
  for (const card of richeseCards()) {
    if (card.effect === 'karama')
      assert.equal(richeseCardActionBlock(card), null);
    else if (card.effect === 'portableSnooper')
      assert.match(richeseCardActionBlock(card)!, /late-defense panel/);
    else if (card.effect === 'stoneBurner')
      assert.match(richeseCardActionBlock(card)!, /battle weapon slot/);
    else if (card.effect === 'residualPoison')
      assert.match(richeseCardActionBlock(card)!, /Residual Poison panel/);
    else if (card.effect === 'ornithopter')
      assert.match(
        richeseCardActionBlock(card)!,
        /Ornithopter movement controls/,
      );
    else if (card.effect === 'nullentropyBox')
      assert.match(richeseCardActionBlock(card)!, /Nullentropy Box panel/);
    else if (card.effect === 'distrans')
      assert.match(richeseCardActionBlock(card)!, /Distrans transfer panel/);
    else if (card.effect === 'juiceOfSapho')
      assert.match(richeseCardActionBlock(card)!, /Juice of Sapho panel/);
    else
      assert.match(
        richeseCardActionBlock(card)!,
        /effect is not implemented yet/,
      );
    assert.equal(
      richeseCardActionBlock({ ...card, id: 'another-physical-card' }),
      null,
    );
    assert.equal(
      richeseCardActionBlock({ ...card, name: 'Another name' }),
      null,
    );
    assert.equal(richeseCardActionBlock({ ...card, kind: 'worthless' }), null);
    assert.equal(
      richeseCardActionBlock({ ...card, effect: 'another-effect' }),
      null,
    );
  }
  for (const card of [...baseDeck(), ...ixDeck(), ...ecazTreacheryCards()])
    assert.equal(richeseCardActionBlock(card), null);
});
