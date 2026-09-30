import test from 'node:test';
import assert from 'node:assert/strict';
import { baseDeck, ixStandardCards, type Card } from '../game/cards';
import { canUseAsKarama } from '../game/karama';
import { canUseAsKaramaRole } from '../game/shrine';
import {
  activeKullRestrictions,
  distinctKullCounter,
  kullBlocksKarama,
  kullCounterCards,
  kullNativeCostCards,
  validateKullAttemptStamp,
  validateKullPhaseRestrictions,
  type KullAttemptStamp,
  type KullContext,
  type KullPhaseRestriction,
} from '../game/choam-kull';

const context: KullContext = {
  turn: 2,
  phase: 5,
  players: [
    { id: 'choam', faction: 'choam' },
    { id: 'actor', faction: 'beneGesserit' },
    { id: 'third', faction: 'atreides' },
  ],
};

void test('a Kull restriction expires by both turn and phase and follows actor, not beneficiary', () => {
  const restriction = Object.freeze({ player: 'actor', turn: 2, phase: 5 });
  const history = Object.freeze([
    restriction,
    Object.freeze({ player: 'third', turn: 1, phase: 5 }),
  ]);
  validateKullPhaseRestrictions(context, history);
  assert.equal(kullBlocksKarama(history, 2, 5, 'actor'), true);
  assert.equal(kullBlocksKarama(history, 2, 5, 'third'), false);
  assert.equal(kullBlocksKarama(history, 2, 5, 'choam'), false);
  for (const [turn, phase] of [[2, 6], [3, 5], [3, 0]]) {
    assert.equal(kullBlocksKarama(history, turn, phase, 'actor'), false);
    assert.deepEqual(activeKullRestrictions(history, turn, phase), []);
  }
  assert.deepEqual(activeKullRestrictions(history, 2, 5), [restriction]);
  assert.notEqual(activeKullRestrictions(history, 2, 5)[0], restriction);
  assert.equal(kullBlocksKarama(undefined, 2, 5, 'actor'), false);
});

void test('malformed and future restriction history is rejected without repair or input mutation', () => {
  const valid = { player: 'actor', turn: 2, phase: 5 };
  const malformed: unknown[] = [
    null,
    { ...valid, turn: 0 },
    { ...valid, turn: 1.5 },
    { ...valid, turn: Number.MAX_SAFE_INTEGER + 1 },
    { ...valid, turn: 3 },
    { ...valid, phase: -1 },
    { ...valid, phase: 9 },
    { ...valid, phase: 5.5 },
    { ...valid, phase: 6 },
    { ...valid, player: 'foreign' },
    { ...valid, player: '' },
    { ...valid, extra: true },
  ];
  for (const record of malformed) {
    const history = [record];
    const before = structuredClone(history);
    assert.throws(() => validateKullPhaseRestrictions(context, history));
    assert.deepEqual(history, before);
  }
  const duplicate = [valid, { ...valid }];
  const before = structuredClone(duplicate);
  assert.throws(() => validateKullPhaseRestrictions(context, duplicate));
  assert.deepEqual(duplicate, before);
  assert.throws(() => validateKullPhaseRestrictions(context, valid));
  assert.throws(() => validateKullPhaseRestrictions({ ...context, turn: 0 }, []));
  assert.equal(kullBlocksKarama([{ ...valid, phase: 9 }], 2, 9, 'actor'), false);
});

void test('valid expired restrictions stay inert without erasing another player current restriction', () => {
  const history: KullPhaseRestriction[] = [
    { player: 'actor', turn: 1, phase: 8 },
    { player: 'actor', turn: 2, phase: 4 },
    { player: 'third', turn: 2, phase: 5 },
  ];
  const before = structuredClone(history);
  validateKullPhaseRestrictions(context, history);
  assert.equal(kullBlocksKarama(history, 2, 5, 'actor'), false);
  assert.equal(kullBlocksKarama(history, 2, 5, 'third'), true);
  assert.deepEqual(activeKullRestrictions(history, 2, 5), [history[2]]);
  assert.deepEqual(history, before);
});

void test('saved attempts require the current stamp, original seated actors and unique physical identity', () => {
  const physical = baseDeck();
  const card = physical.find(candidate => candidate.effect === 'karama')!;
  const attempt: KullAttemptStamp = {
    event: 'attempt-1', player: 'choam', owner: 'actor', card: card.id,
    turn: 2, phase: 5, stage: 'offer', form: 'printed',
  };
  const patches: Partial<KullAttemptStamp>[] = [
    { event: '' }, { player: 'third' }, { player: 'foreign' },
    { owner: 'choam' }, { owner: 'foreign' }, { card: 'invented' },
    { turn: 1 }, { turn: 3 }, { turn: 0 }, { phase: 4 }, { phase: 6 },
    { phase: 9 }, { stage: 'complete' as never }, { form: 'converted' as never },
  ];
  for (const patch of patches) {
    const invalid = { ...attempt, ...patch };
    const before = structuredClone({ invalid, physical, context });
    assert.throws(() => validateKullAttemptStamp(context, invalid, physical));
    assert.deepEqual({ invalid, physical, context }, before);
  }
  for (const inventory of [physical.filter(candidate => candidate.id !== card.id), [...physical, card]]) {
    const before = structuredClone(inventory);
    assert.throws(() => validateKullAttemptStamp(context, attempt, inventory));
    assert.deepEqual(inventory, before);
  }
  // Validate both live stages after serialization; the exact original stays reserved.
  for (const stage of ['offer', 'counter'] as const) {
    const saved = JSON.parse(JSON.stringify({ ...attempt, stage })) as KullAttemptStamp;
    validateKullAttemptStamp(context, saved, physical);
    assert.equal(distinctKullCounter(saved.card, attempt.card), false);
    assert.equal(distinctKullCounter(physical.find(candidate =>
      candidate.effect === 'karama' && candidate.id !== card.id)!.id, saved.card), true);
  }
  const substitution = physical.find(candidate => candidate.kind === 'worthless')!;
  const bgSaved = { ...attempt, card: substitution.id, form: 'substitution' as const };
  validateKullAttemptStamp(context, bgSaved, physical);
  assert.equal(distinctKullCounter(substitution.id, bgSaved.card), false);
});

void test('native Kull costs require canonical identity and unique actual custody, not a matching label', () => {
  const physical = [...baseDeck(), ...ixStandardCards()];
  const kull = physical.find(card => card.id === 'ix-kull-wahad')!;
  const another = physical.find(card => card.kind === 'worthless' && card.id !== kull.id)!;
  const held = Object.freeze([Object.freeze(kull), Object.freeze(another)]);
  const before = structuredClone({ held, physical });
  assert.deepEqual(kullNativeCostCards(held, physical).map(card => card.id), [kull.id]);
  assert.deepEqual(kullNativeCostCards([another], physical), []);
  assert.deepEqual(kullNativeCostCards(held, physical, [kull.id]), []);
  assert.deepEqual(kullNativeCostCards(held, physical.filter(card => card.id !== kull.id)), []);
  assert.deepEqual(kullNativeCostCards(held, [...physical, { ...kull }]), []);
  assert.deepEqual(kullNativeCostCards([kull, { ...kull }], physical), []);
  for (const fake of [
    { ...another, name: kull.name },
    { ...kull, kind: 'special' as const },
    { ...kull, name: 'different' },
    { ...kull, effect: 'karama' },
  ]) {
    assert.deepEqual(kullNativeCostCards([fake], physical), []);
  }
  assert.deepEqual({ held, physical }, before);
});

void test('distinct counters honor effective BG and revealed Shrine eligibility without reusing the original', () => {
  const physical = baseDeck();
  const karamas = physical.filter(card => card.effect === 'karama');
  const worthless = physical.find(card => card.kind === 'worthless')!;
  const truthtrance = physical.find(card => card.effect === 'truthtrance')!;
  const held = [karamas[0], karamas[1], worthless, truthtrance];
  const before = structuredClone({ held, physical });
  assert.deepEqual(kullCounterCards(held, physical, karamas[0].id,
    card => canUseAsKarama(false, 'atreides', card)).map(card => card.id), [karamas[1].id]);
  assert.deepEqual(kullCounterCards(held, physical, worthless.id,
    card => canUseAsKarama(true, 'beneGesserit', card)).map(card => card.id),
  [karamas[0].id, karamas[1].id]);
  assert.deepEqual(kullCounterCards(held, physical, karamas[0].id,
    card => canUseAsKarama(true, 'beneGesserit', card)).map(card => card.id),
  [karamas[1].id, worthless.id]);
  const shrine = {
    advanced: true,
    discoveries: { tokens: [{ face: 'shrine', status: 'placed', revealedTurn: 2 }] },
  };
  const actor = { id: 'third', faction: 'atreides' as const, forces: { 'shrine:0': 1 } };
  assert.deepEqual(kullCounterCards(held, physical, karamas[0].id,
    card => canUseAsKaramaRole(shrine, actor, card)).map(card => card.id),
  [karamas[1].id, truthtrance.id]);
  assert.deepEqual(kullCounterCards(held, physical, karamas[0].id,
    card => canUseAsKaramaRole(shrine, { ...actor, forces: {} }, card)).map(card => card.id),
  [karamas[1].id]);
  const block = [{ player: actor.id, turn: 2, phase: 5 }];
  assert.deepEqual(kullCounterCards(held, physical, karamas[0].id,
    card => !kullBlocksKarama(block, 2, 5, actor.id) && canUseAsKaramaRole(shrine, actor, card)), []);
  assert.deepEqual({ held, physical }, before);
});

void test('counter rejection checks exact physical custody before invoking effective eligibility', () => {
  const physical = baseDeck();
  const original = physical.find(card => card.effect === 'karama')!;
  const distinct = physical.find(card => card.effect === 'karama' && card.id !== original.id)!;
  const forged: Card = { ...distinct, kind: 'worthless', effect: undefined };
  let eligibilityCalls = 0;
  const eligible = (card: Card) => { eligibilityCalls++; return card.effect === 'karama'; };
  assert.deepEqual(kullCounterCards([original], physical, original.id, eligible), []);
  assert.deepEqual(kullCounterCards([forged], physical, original.id, eligible), []);
  assert.deepEqual(kullCounterCards([distinct, distinct], physical, original.id, eligible), []);
  assert.deepEqual(kullCounterCards([distinct], [...physical, distinct], original.id, eligible), []);
  assert.deepEqual(kullCounterCards([distinct], physical, original.id, eligible, [distinct.id]), []);
  assert.equal(eligibilityCalls, 0);
  assert.deepEqual(kullCounterCards([distinct], physical, original.id, eligible).map(card => card.id), [distinct.id]);
  assert.equal(eligibilityCalls, 1);
  assert.equal(distinctKullCounter('', original.id), false);
  assert.equal(distinctKullCounter(distinct.id, ''), false);
});
