import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chooseFaction, createFactionDraft, currentFactionDrafter,
  FactionDraftError, validateFactionDraft,
} from '../game/faction-draft';
import type { FactionId } from '../game/catalog';

const seats = ['human', 'opponent', 'bot'];
const eligible: FactionId[] = ['atreides', 'harkonnen', 'guild', 'fremen'];

void test('prediction numbers determine descending public draft order without changing inputs', () => {
  const numbers = [3, 10, 6];
  const draft = createFactionDraft(seats, numbers, 'draft:one');
  assert.deepEqual(draft, { event: 'draft:one', order: [
    { player: 'opponent', card: 10 }, { player: 'bot', card: 6 }, { player: 'human', card: 3 },
  ], picks: [] });
  assert.deepEqual(seats, ['human', 'opponent', 'bot']);
  assert.deepEqual(numbers, [3, 10, 6]);
  validateFactionDraft(JSON.parse(JSON.stringify(draft)), seats, eligible);
  assert.equal(currentFactionDrafter(draft), 'opponent');
});

void test('each seated player chooses one distinct enabled faction in actual prediction-card order', () => {
  const initial = createFactionDraft(seats, [3, 10, 6], 'draft:one');
  const first = chooseFaction(initial, seats, eligible, 'opponent', 'guild');
  assert.deepEqual(initial.picks, []);
  assert.deepEqual(first.picks, [{ player: 'opponent', faction: 'guild' }]);
  assert.notEqual(first.order, initial.order);
  assert.notEqual(first.order[0], initial.order[0]);
  assert.equal(currentFactionDrafter(first), 'bot');
  const second = chooseFaction(first, seats, eligible, 'bot', 'fremen');
  const final = chooseFaction(second, seats, eligible, 'human', 'atreides');
  validateFactionDraft(final, seats, eligible);
  assert.equal(currentFactionDrafter(final), null);
  assert.deepEqual(final.picks.map(pick => pick.faction), ['guild', 'fremen', 'atreides']);
  assert.throws(() => chooseFaction(final, seats, eligible, 'human', 'harkonnen'), FactionDraftError);
  assert.deepEqual(first.picks, [{ player: 'opponent', faction: 'guild' }]);
});

void test('wrong actor, occupied and disabled faction choices reject without mutating accepted state', () => {
  const initial = createFactionDraft(seats, [3, 10, 6], 'draft:one');
  const draft = chooseFaction(initial, seats, eligible, 'opponent', 'guild');
  const before = structuredClone(draft);
  assert.throws(() => chooseFaction(draft, seats, eligible, 'human', 'atreides'), FactionDraftError);
  assert.throws(() => chooseFaction(draft, seats, eligible, 'bot', 'guild'), FactionDraftError);
  assert.throws(() => chooseFaction(draft, seats, eligible, 'bot', 'ixians'), FactionDraftError);
  assert.throws(() => chooseFaction(draft, seats, eligible, 'bot', 'nonexistent' as FactionId), FactionDraftError);
  assert.deepEqual(draft, before);
});

void test('invalid deals reject duplicate seats, repeated numbers and noncanonical ranges', () => {
  for (const [roster, numbers, event] of [
    [['a'], [1], 'e'], [['a', 'a'], [1, 2], 'e'], [['a', ' b'], [1, 2], 'e'],
    [['a', 'b'], [1, 1], 'e'], [['a', 'b'], [0, 2], 'e'],
    [['a', 'b'], [1, 11], 'e'], [['a', 'b'], [1, 2.5], 'e'],
    [['a', 'b'], [1], 'e'], [['a', 'b'], [1, 2], ''],
  ] as [string[], number[], string][]) {
    assert.throws(() => createFactionDraft(roster, numbers, event), FactionDraftError);
  }
  assert.throws(() => createFactionDraft(['a', 'b', 'c', 'd', 'e', 'f', 'g'], [1, 2, 3, 4, 5, 6, 7], 'e'), FactionDraftError);
});

void test('saved draft rejects changed roster, ordering, cards, picks and enabled faction pool', () => {
  const draft = createFactionDraft(seats, [3, 10, 6], 'draft:one');
  const one = chooseFaction(draft, seats, eligible, 'opponent', 'guild');
  for (const bad of [
    { ...draft, extra: true },
    { ...draft, order: [draft.order[1], draft.order[0], draft.order[2]] },
    { ...draft, order: [{ player: 'opponent', card: 10 }, { player: 'bot', card: 10 }, draft.order[2]] },
    { ...draft, order: [{ player: 'opponent', card: 10 }, { player: 'foreign', card: 6 }, draft.order[2]] },
    { ...draft, picks: [{ player: 'bot', faction: 'guild' }] },
    { ...draft, picks: [{ player: 'opponent', faction: 'ixians' }] },
    { ...one, picks: [...one.picks, { player: 'bot', faction: 'guild' }] },
    { ...one, picks: [...one.picks, { player: 'bot', faction: 'fremen', leaked: true }] },
  ]) assert.throws(() => validateFactionDraft(bad, seats, eligible), FactionDraftError);
  assert.throws(() => validateFactionDraft(one, ['opponent', 'bot', 'else'], eligible), FactionDraftError);
  assert.throws(() => validateFactionDraft(one, seats, ['atreides', 'harkonnen']), FactionDraftError);
  assert.throws(() => validateFactionDraft(one, seats, ['atreides', 'guild', 'guild']), FactionDraftError);
  assert.throws(() => validateFactionDraft(one, seats, ['atreides', 'harkonnen', 'fremen']), FactionDraftError);
});
