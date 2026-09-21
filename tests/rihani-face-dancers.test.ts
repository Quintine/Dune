import assert from 'node:assert/strict';
import test from 'node:test';
import {
  beginRihani,
  chooseRihaniDraw,
  finishRihani,
  rihaniSignature,
  validateRihani,
  type RihaniReceipt,
} from '../game/rihani-decipherer';
import {
  validateNexusTraitorSnapshot,
  type NexusTraitorSnapshot,
} from '../game/nexus-traitor-exchange';

const universe = Array.from({ length: 10 }, (_, index) => `leader-${index}`);
const random = () => 0.37;
function snapshot(): NexusTraitorSnapshot {
  return {
    reserve: universe.slice(4),
    players: [
      {
        id: 't', faction: 'tleilaxu', traitors: [],
        faceDancers: [
          { leader: universe[0], revealed: false },
          { leader: universe[1], revealed: true },
          { leader: universe[2], revealed: false },
        ],
      },
      { id: 'a', faction: 'atreides', traitors: [universe[3]] },
    ],
  };
}
function begin(normal = true, skilled = true, state = snapshot()) {
  return beginRihani(state, universe, {
    event: 'battle-rihani', turn: 2, owner: 't',
    skill: { leader: 'tleilaxu-0', normal, skilled },
  }, [], random);
}
function restore(receipt: RihaniReceipt): RihaniReceipt {
  return JSON.parse(JSON.stringify(receipt)) as RihaniReceipt;
}
function resigned(receipt: RihaniReceipt, change: (r: RihaniReceipt) => void) {
  const changed = restore(receipt);
  change(changed);
  changed.signature = rihaniSignature(changed);
  return changed;
}
function conserved(receipt: RihaniReceipt) {
  validateRihani(receipt, universe, receipt.state);
  validateNexusTraitorSnapshot(receipt.state, universe);
  assert.deepEqual(receipt.state.players[0].traitors, []);
  assert.deepEqual(receipt.state.players[1], receipt.before.players[1]);
}

void test('native Tleilaxu Rihani inspects first, commits a separate draw and keeps one new unrevealed Face Dancer', () => {
  const original = snapshot(), frozen = structuredClone(original);
  let receipt = begin(true, true, original);
  assert.deepEqual(original, frozen);
  assert.equal(receipt.stage, 'offer');
  assert.equal(receipt.peeked.length, 2);
  assert.equal(new Set(receipt.peeked).size, 2);
  assert.ok(receipt.peeked.every((id) => original.reserve.includes(id)));
  assert.deepEqual(receipt.drawn, []);
  assert.deepEqual(receipt.eligible, [universe[0], universe[2]]);
  assert.deepEqual(receipt.state.players, original.players);
  conserved(receipt);

  receipt = restore(receipt);
  const offered = structuredClone(receipt);
  const pending = chooseRihaniDraw(receipt, universe, receipt.state, true);
  assert.deepEqual(receipt, offered);
  assert.equal(pending.stage, 'return');
  assert.deepEqual(pending.drawn, offered.deckAfterPeek.slice(0, 2));
  assert.deepEqual(pending.state.players[0].faceDancers, [
    ...original.players[0].faceDancers!,
    ...pending.drawn.map((leader) => ({ leader, revealed: false })),
  ]);
  conserved(restore(pending));

  for (const kept of pending.drawn) {
    const restored = restore(pending), frozenPending = structuredClone(restored);
    const done = finishRihani(restored, universe, restored.state, kept, universe[0], random);
    assert.deepEqual(restored, frozenPending);
    assert.equal(done.stage, 'complete');
    assert.equal(done.kept, kept);
    assert.equal(done.given, universe[0]);
    assert.deepEqual(done.state.players[0].faceDancers, [
      ...original.players[0].faceDancers!.slice(1),
      { leader: kept, revealed: false },
    ]);
    assert.ok(done.state.reserve.includes(universe[0]));
    assert.ok(done.state.reserve.includes(pending.drawn.find((id) => id !== kept)!));
    assert.ok(!done.state.reserve.includes(kept));
    conserved(restore(done));
  }
});

void test('Tleilaxu Rihani normal-only inspection, lower-only exchange and pre-draw decline preserve their distinct bands', () => {
  const normal = begin(true, false);
  assert.equal(normal.stage, 'complete');
  assert.equal(normal.peeked.length, 2);
  assert.deepEqual(normal.drawn, []);
  assert.deepEqual(normal.state.players, normal.before.players);
  conserved(normal);

  const lower = begin(false, true);
  assert.equal(lower.stage, 'offer');
  assert.deepEqual(lower.peeked, []);
  assert.deepEqual(lower.state.reserve, lower.before.reserve);
  const drawn = chooseRihaniDraw(lower, universe, lower.state, true);
  const complete = finishRihani(drawn, universe, drawn.state, drawn.drawn[0], universe[2], random);
  conserved(complete);

  const both = begin();
  const declined = chooseRihaniDraw(restore(both), universe, both.state, false);
  assert.equal(declined.stage, 'complete');
  assert.deepEqual(declined.state, both.state);
  assert.deepEqual(declined.peeked, both.peeked);
  assert.deepEqual(declined.drawn, []);
  conserved(restore(declined));
  assert.throws(() => chooseRihaniDraw(declined, universe, declined.state, true), /already been answered/);
});

void test('Rihani cannot replace a revealed Face Dancer or return both newly drawn cards', () => {
  const offer = begin();
  const drawn = chooseRihaniDraw(offer, universe, offer.state, true);
  for (const given of [universe[1], ...drawn.drawn]) {
    const before = structuredClone(drawn);
    assert.throws(() => finishRihani(drawn, universe, drawn.state, drawn.drawn[0], given, random), /unused Traitor/);
    assert.deepEqual(drawn, before);
  }
  const allRevealed = snapshot();
  allRevealed.players[0].faceDancers!.forEach((card) => { card.revealed = true; });
  const noExchange = begin(true, true, allRevealed);
  assert.deepEqual(noExchange.eligible, []);
  assert.equal(noExchange.stage, 'complete');
  assert.equal(noExchange.peeked.length, 2);
  assert.deepEqual(noExchange.state.players, allRevealed.players);
  conserved(noExchange);
});

void test('Rihani rejects status changes in old, drawn and retained Face Dancers even with a recomputed signature', () => {
  const offer = begin();
  const drawn = chooseRihaniDraw(offer, universe, offer.state, true);
  const complete = finishRihani(drawn, universe, drawn.state, drawn.drawn[0], universe[0], random);
  const invalid = [
    resigned(offer, (r) => { r.state.players[0].faceDancers![1].revealed = false; }),
    resigned(drawn, (r) => { r.state.players[0].faceDancers![0].revealed = true; }),
    resigned(drawn, (r) => { r.state.players[0].faceDancers![3].revealed = true; }),
    resigned(complete, (r) => { r.state.players[0].faceDancers![0].revealed = false; }),
    resigned(complete, (r) => { r.state.players[0].faceDancers![2].revealed = true; }),
    resigned(drawn, (r) => { r.eligible.push(universe[1]); }),
  ];
  for (const receipt of invalid) assert.throws(() => validateRihani(receipt, universe), /custody|drawn cards|returned card|unused cards/);

  const changedCurrent = structuredClone(drawn.state);
  changedCurrent.players[0].faceDancers![1].revealed = false;
  assert.throws(() => finishRihani(drawn, universe, changedCurrent, drawn.drawn[0], universe[0], random), /current Traitor custody/);
  const duplicate = resigned(drawn, (r) => { r.state.reserve.push(r.drawn[0]); });
  assert.throws(() => validateRihani(duplicate, universe), /census/);
});

void test('ordinary Rihani receipts retain the existing used-Traitor exclusion and JSON transition', () => {
  const state = snapshot();
  state.players[0] = { id: 't', faction: 'harkonnen', traitors: universe.slice(0, 3) };
  const offer = beginRihani(state, universe, {
    event: 'legacy-rihani', turn: 1, owner: 't',
    skill: { leader: 'harkonnen-0', normal: true, skilled: true },
  }, [universe[1]], random);
  assert.deepEqual(offer.eligible, [universe[0], universe[2]]);
  const drawn = chooseRihaniDraw(restore(offer), universe, offer.state, true);
  assert.deepEqual(drawn.state.players[0].traitors, [...universe.slice(0, 3), ...drawn.drawn]);
  const done = finishRihani(restore(drawn), universe, drawn.state, drawn.drawn[1], universe[0], random);
  assert.deepEqual(done.state.players[0].traitors, [universe[1], universe[2], drawn.drawn[1]]);
  assert.equal(Object.hasOwn(done.state.players[0], 'faceDancers'), false);
  validateRihani(restore(done), universe, done.state);
});
