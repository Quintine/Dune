import assert from 'node:assert/strict';
import test from 'node:test';
import type { Card } from '../game/cards';
import type { FreshDiscardBatch } from '../game/semuta-drug';
import {
  recordMovementDiscardKnowledge, knownMovementDiscards, recordMovementBoxKnowledge,
  recordMovementClaimKnowledge, clearMovementDiscardKnowledge,
  type MovementDiscardKnowledge,
} from '../game/movement-discard-knowledge';

const seats = ['owner', 'rival', 'observer'];
const hajr: Card = { id: 'physical-hajr', kind: 'special', name: 'Hajr', effect: 'hajr' };
const ghola: Card = { id: 'physical-ghola', kind: 'special', name: 'Tleilaxu Ghola', effect: 'ghola' };
const ornithopter: Card = { id: 'richese-ornithopter', kind: 'special', name: 'Ornithopter', effect: 'ornithopter' };
const kulon: Card = { id: 'physical-kulon', kind: 'worthless', name: 'Kulon' };
const shield: Card = { id: 'physical-shield', kind: 'shield', name: 'Shield' };
const entry = (card: Card, discardedBy = 'owner', publicFace = false): FreshDiscardBatch['entries'][number] =>
  ({ card, discardedBy, publicFace });

void test('Ghola force preparation uses only actually observed public, private or paid Box faces', () => {
  const privateKnowledge = recordMovementDiscardKnowledge(undefined, seats, [entry(ghola)]);
  assert.deepEqual(knownMovementDiscards(privateKnowledge, 'owner', [ghola]), [ghola]);
  assert.deepEqual(knownMovementDiscards(privateKnowledge, 'rival', [ghola]), []);
  const publicKnowledge = recordMovementDiscardKnowledge(privateKnowledge, seats, [entry(ghola, 'owner', true)]);
  for (const player of seats) assert.deepEqual(knownMovementDiscards(publicKnowledge, player, [ghola]), [ghola]);
  const paidKnowledge = recordMovementBoxKnowledge(publicKnowledge, seats, 'rival', [ghola, shield]);
  assert.deepEqual(knownMovementDiscards(paidKnowledge, 'rival', [ghola, shield]), [ghola]);
  assert.deepEqual(knownMovementDiscards(paidKnowledge, 'owner', [ghola]), []);
  assert.deepEqual(knownMovementDiscards(paidKnowledge, 'rival', []), []);
});

void test('a public relevant disposal is remembered by all seats without creating unrelated face knowledge', () => {
  const entries = [entry(hajr, 'rival', true), entry(shield, 'rival', true)];
  const before = structuredClone(entries);
  const result = recordMovementDiscardKnowledge(undefined, seats, entries);
  assert.deepEqual(result, { observer: [hajr.id], owner: [hajr.id], rival: [hajr.id] });
  for (const player of seats) assert.deepEqual(knownMovementDiscards(result, player, [shield, hajr]), [hajr]);
  assert.deepEqual(entries, before);
});

void test('a private disposal teaches only its holder and an unknown relevant face cannot leak through lookup', () => {
  const result = recordMovementDiscardKnowledge(undefined, seats, [entry(hajr), entry(kulon, 'rival')]);
  assert.deepEqual(result, { owner: [hajr.id], rival: [kulon.id] });
  assert.deepEqual(knownMovementDiscards(result, 'owner', [hajr, kulon, ornithopter]), [hajr]);
  assert.deepEqual(knownMovementDiscards(result, 'observer', [hajr, kulon, ornithopter]), []);
});

void test('canonical relevance excludes an Ornithopter lookalike, unrelated Worthless and absent state', () => {
  const fake = { ...ornithopter, id: 'different-ornithopter' };
  const otherWorthless: Card = { id: 'other-worthless', name: 'Baliset', kind: 'worthless' };
  assert.equal(recordMovementDiscardKnowledge(undefined, seats, [entry(fake, 'owner', true), entry(otherWorthless), entry(shield)]), undefined);
  assert.equal(recordMovementDiscardKnowledge(undefined, seats, []), undefined);
  assert.deepEqual(knownMovementDiscards(undefined, 'owner', [hajr, ornithopter, kulon]), []);
  assert.deepEqual(recordMovementDiscardKnowledge(undefined, seats, [entry(ornithopter), entry(kulon)]),
    { owner: [kulon.id, ornithopter.id].sort() });
});

void test('a paid private Box invalidates other memories and grants only its owner the actual remaining faces', () => {
  const state: MovementDiscardKnowledge = { owner: [hajr.id], rival: [hajr.id, ornithopter.id], observer: [kulon.id] };
  const before = structuredClone(state), pile = [shield, ornithopter, kulon], originalPile = structuredClone(pile);
  const result = recordMovementBoxKnowledge(state, seats, 'owner', pile);
  assert.deepEqual(result, { owner: [kulon.id, ornithopter.id].sort() });
  assert.deepEqual(knownMovementDiscards(result, 'owner', pile), [ornithopter, kulon]);
  assert.deepEqual(knownMovementDiscards(result, 'rival', pile), []);
  assert.equal(recordMovementBoxKnowledge(state, seats, 'owner', [shield]), undefined);
  assert.deepEqual(state, before); assert.deepEqual(pile, originalPile);
});

void test('a private mixed claim removes ambiguous fresh memories while preserving identities outside that batch', () => {
  const state: MovementDiscardKnowledge = {
    owner: [hajr.id, ornithopter.id], rival: [hajr.id, ornithopter.id], observer: [kulon.id, ornithopter.id],
  };
  const before = structuredClone(state), entries = [entry(hajr, 'rival'), entry(kulon, 'observer')];
  const originalEntries = structuredClone(entries);
  const result = recordMovementClaimKnowledge(state, seats, 'owner', entries, hajr.id);
  assert.deepEqual(result, {
    observer: [ornithopter.id], owner: [kulon.id, ornithopter.id].sort(), rival: [ornithopter.id],
  });
  assert.deepEqual(knownMovementDiscards(result, 'owner', [ornithopter, kulon]), [ornithopter, kulon]);
  assert.deepEqual(knownMovementDiscards(result, 'observer', [ornithopter, kulon]), [ornithopter]);
  assert.deepEqual(state, before); assert.deepEqual(entries, originalEntries);
});

void test('a full discard reshuffle clears preparation knowledge without mutating the former record', () => {
  const state = { owner: [hajr.id], rival: [ornithopter.id] }, before = structuredClone(state);
  assert.equal(clearMovementDiscardKnowledge(state), undefined);
  assert.equal(clearMovementDiscardKnowledge(undefined), undefined);
  assert.deepEqual(state, before);
});

void test('lookup filters stale identities, preserves physical pile order and returns independent card faces', () => {
  const state = { owner: [hajr.id, 'removed-card', kulon.id, shield.id] };
  const pile = [kulon, shield, hajr], before = structuredClone(pile);
  const faces = knownMovementDiscards(state, 'owner', pile);
  assert.deepEqual(faces, [kulon, hajr]);
  faces[0].name = 'changed'; faces.push(ornithopter);
  assert.deepEqual(pile, before);
  assert.deepEqual(state.owner, [hajr.id, 'removed-card', kulon.id, shield.id]);
});

void test('repeated observations use deterministic unique identities and do not alias original state arrays', () => {
  const state = { owner: [hajr.id, hajr.id] }, before = structuredClone(state);
  const events = [entry(ornithopter, 'owner', true), entry(kulon), entry(hajr)];
  const first = recordMovementDiscardKnowledge(state, seats, events)!;
  const second = recordMovementDiscardKnowledge(first, [...seats].reverse(), [...events].reverse())!;
  assert.deepEqual(first, second); assert.deepEqual(state, before);
  second.owner.push('new-id');
  assert.deepEqual(first.owner, [hajr.id, kulon.id, ornithopter.id].sort());
});
