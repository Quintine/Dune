import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createGame, initializeSemutaGameForAudit, joinGame, newPlayer, normalizeAutomaticGame, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';

const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const player = (g: Game, id: string) => g.players.find(p => p.id === id)!;
function take(g: Game, id: string) {
  const zones = [g.deck, g.discard, g.richeseCache!, ...g.players.map(p => p.hand)];
  for (const zone of zones) {
    const index = zone.findIndex(card => card.id === id || card.effect === id);
    if (index >= 0) return zone.splice(index, 1)[0];
  }
  throw new Error(`Missing physical ${id}`);
}
function inventory(g: Game) {
  const ids = [...g.deck, ...g.discard, ...g.richeseCache!, ...g.players.flatMap(p => p.hand)].map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length);
  return ids;
}
function fixture() {
  let g = createGame('SEMUTAQ2', newPlayer('r', 'Richese', 'richese'), false, ['choam']);
  joinGame(g, newPlayer('a', 'Atreides', 'atreides'));
  joinGame(g, newPlayer('e', 'Emperor', 'emperor'));
  for (const p of g.players) { p.bot = 'Medium'; p.ready = true; }
  g = initializeSemutaGameForAudit(g);
  for (let step = 0; g.status === 'setup' && step < 80; step++) {
    let next: Game | undefined;
    for (const p of g.players) {
      const action = botActions(viewGame(g, p.id))[0];
      if (action) { next = applyAction(g, p.id, action); break; }
    }
    assert.ok(next, 'genuine setup must have a legal AI choice');
    g = next;
  }
  assert.equal(g.status, 'playing');
  const semuta = take(g, SEMUTA_DRUG_ID), hajr = take(g, 'hajr');
  g.deck.push(...g.players.flatMap(p => p.hand));
  for (const p of g.players) p.hand = [];
  player(g, 'r').hand.push(semuta);
  player(g, 'a').hand.push(hajr);
  Object.assign(g, { turn: 2, phase: 5, active: 'a', storm: 18, ready: [], decision: null,
    response: null, phaseOpening: null, stormPending: null, movementRemaining: ['a', 'r', 'e'] });
  return { g, semuta, hajr };
}

void test('a clean public discard offers every seat the same event, then a committed sole Semuta claim resumes once across JSON', () => {
  const { g, semuta, hajr } = fixture();
  const original = inventory(g);
  const pending = applyAction(g, 'a', { type: 'card', card: hajr.id });
  const event = pending.pendingTreacheryDiscard?.batch.event;
  assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.ok(event);
  const from = viewGame(pending, 'a').semutaReaction!, to = viewGame(pending, 'r').semutaReaction!;
  assert.equal(from.event, to.event);
  assert.equal(from.canCommit, false);
  assert.equal(to.canCommit, true);
  assert.deepEqual(from.candidates, []);
  assert.deepEqual(to.candidates, []);
  assert.equal(viewGame(pending, 'e').semutaReaction?.event, event);
  assert.deepEqual(normalizeAutomaticGame(reload(pending)), reload(pending));
  assert.throws(() => applyAction(pending, 'a', { type: 'move', from: 'imperial_basin:10', amount: 1,
    territory: 'arrakeen', sector: 10 }));
  const before = JSON.stringify(pending);
  assert.throws(() => applyAction(pending, 'a', { type: 'semutaCommit', event }));
  assert.throws(() => applyAction(pending, 'r', { type: 'semutaSelect', event, card: hajr.id }));
  assert.equal(JSON.stringify(pending), before);
  const passed = applyAction(reload(pending), 'a', { type: 'semutaPass', event });
  assert.equal(viewGame(passed, 'a').semutaReaction?.passed, true);
  assert.equal(viewGame(passed, 'r').semutaReaction?.passed, false);
  assert.deepEqual(normalizeAutomaticGame(reload(passed)), reload(passed));
  const botChoice = botActions(viewGame(passed, 'r'))[0];
  assert.ok(botChoice);
  const claimed = applyAction(reload(passed), 'r', botChoice);
  assert.equal(claimed.pendingTreacheryDiscard, null);
  assert.equal(claimed.resolvedTreacheryDiscardSequence, claimed.treacheryDiscardSequence);
  assert.equal(player(claimed, 'r').hand.filter(card => card.id === hajr.id).length, 1);
  assert.equal(player(claimed, 'r').hand.some(card => card.id === semuta.id), false);
  assert.equal(claimed.discard.filter(card => card.id === semuta.id).length, 1);
  assert.equal(claimed.discard.some(card => card.id === hajr.id), false);
  assert.equal(claimed.hajr.filter(id => id === 'a').length, 1);
  assert.deepEqual(inventory(claimed), original);
  for (const p of claimed.players)
    assert.deepEqual(viewGame(reload(claimed), p.id), viewGame(claimed, p.id));
  assert.deepEqual(normalizeAutomaticGame(reload(claimed)), reload(claimed));
  assert.throws(() => applyAction(claimed, 'r', { type: 'semutaCommit', event }));
});

void test('neutral Semuta passes do not reveal hidden possession and resume a declined effect exactly once', () => {
  const { g, semuta, hajr } = fixture();
  const without = reload(g);
  player(without, 'r').hand = [];
  without.richeseCache!.push(semuta);
  player(without, 'r').hand.push(take(without, 'richese-distrans'));
  const held = applyAction(g, 'a', { type: 'card', card: hajr.id });
  const absent = applyAction(without, 'a', { type: 'card', card: hajr.id });
  const event = held.pendingTreacheryDiscard!.batch.event;
  assert.equal(absent.pendingTreacheryDiscard!.batch.event, event);
  for (const id of ['a', 'e'])
    assert.deepEqual(viewGame(held, id), viewGame(absent, id));
  assert.equal(viewGame(absent, 'r').semutaReaction?.canCommit, false);
  assert.deepEqual(normalizeAutomaticGame(reload(absent)), reload(absent));
  let declined = reload(held);
  for (const id of ['e', 'r', 'a']) {
    declined = applyAction(declined, id, { type: 'semutaPass', event });
    assert.deepEqual(inventory(declined), inventory(held));
  }
  assert.equal(declined.pendingTreacheryDiscard, null);
  assert.equal(declined.hajr.filter(id => id === 'a').length, 1);
  assert.equal(declined.discard.filter(card => card.id === hajr.id).length, 1);
  assert.equal(player(declined, 'r').hand.some(card => card.id === semuta.id), true);
  assert.deepEqual(normalizeAutomaticGame(reload(declined)), reload(declined));
});

void test('the provisional free-slot guard is private and never spends a full-hand Semuta', () => {
  const { g, semuta, hajr } = fixture();
  for (let n = 0; n < 3; n++) player(g, 'r').hand.push(g.deck.shift()!);
  const pending = applyAction(g, 'a', { type: 'card', card: hajr.id });
  const event = pending.pendingTreacheryDiscard!.batch.event;
  const richese = viewGame(pending, 'r').semutaReaction!;
  assert.equal(richese.canCommit, false);
  assert.match(richese.blocked ?? '', /free hand slot/);
  assert.equal(viewGame(pending, 'a').semutaReaction?.blocked, null);
  const before = JSON.stringify(pending);
  assert.throws(() => applyAction(pending, 'r', { type: 'semutaCommit', event }));
  assert.equal(JSON.stringify(pending), before);
  assert.equal(player(pending, 'r').hand.some(card => card.id === semuta.id), true);
});

void test('a saved neutral reaction cannot be deleted to auto-retire the fresh discard', () => {
  const { g, hajr } = fixture();
  const pending = applyAction(g, 'a', { type: 'card', card: hajr.id });
  const corrupt = reload(pending);
  delete corrupt.pendingTreacheryDiscard!.reaction;
  const before = JSON.stringify(corrupt);
  assert.throws(() => viewGame(corrupt, 'r'));
  assert.throws(() => normalizeAutomaticGame(corrupt));
  assert.throws(() => applyAction(corrupt, 'a', { type: 'advanceBots' }));
  assert.equal(JSON.stringify(corrupt), before);
});

void test('duplicate physical Semuta custody cannot survive projection or commit', () => {
  const { g, semuta, hajr } = fixture();
  const pending = applyAction(g, 'a', { type: 'card', card: hajr.id });
  const corrupt = reload(pending);
  corrupt.richeseCache!.push(structuredClone(semuta));
  const before = JSON.stringify(corrupt);
  assert.throws(() => viewGame(corrupt, 'r'));
  assert.throws(() => applyAction(corrupt, 'r', {
    type: 'semutaCommit', event: corrupt.pendingTreacheryDiscard!.batch.event,
  }));
  assert.equal(JSON.stringify(corrupt), before);
});

void test('an impossible saved all-passed offer rejects instead of waiting forever', () => {
  const { g, hajr } = fixture();
  const pending = applyAction(g, 'a', { type: 'card', card: hajr.id });
  const corrupt = reload(pending);
  const reaction = corrupt.pendingTreacheryDiscard!.reaction;
  assert.equal(reaction?.stage, 'offer');
  if (reaction?.stage !== 'offer') return;
  reaction.passed = corrupt.players.map(player => player.id);
  const before = JSON.stringify(corrupt);
  assert.throws(() => viewGame(corrupt, 'r'));
  assert.throws(() => normalizeAutomaticGame(corrupt));
  assert.equal(JSON.stringify(corrupt), before);
});

void test('a completed paid Box discard can be claimed before resumption without repeating its search', () => {
  const { g, semuta, hajr } = fixture();
  player(g, 'a').hand = [];
  g.deck.push(hajr);
  const box = take(g, 'richese-nullentropy-box');
  player(g, 'a').hand.push(box);
  g.discard.push(g.deck.shift()!, g.deck.shift()!);
  g.phase = 4;
  g.active = null;
  const original = inventory(g);
  const spice = player(g, 'a').spice;
  const paid = applyAction(g, 'a', { type: 'card', card: box.id });
  assert.ok(paid.pendingNullentropy);
  assert.equal(player(paid, 'a').spice, spice - 2);
  const target = paid.discard[0].id;
  const pending = applyAction(paid, 'a', {
    type: 'decision', event: paid.pendingNullentropy.event, card: target,
  });
  assert.equal(pending.pendingTreacheryDiscard?.continuation.kind, 'nullentropyDiscard');
  assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  const event = pending.pendingTreacheryDiscard!.batch.event;
  const shuffled = pending.discard.filter(card => card.id !== box.id).map(card => card.id);
  assert.equal(viewGame(pending, 'r').semutaReaction?.canCommit, true);
  assert.equal(viewGame(pending, 'a').semutaReaction?.canCommit, false);
  assert.deepEqual(viewGame(pending, 'r').semutaReaction?.candidates, []);
  assert.deepEqual(normalizeAutomaticGame(reload(pending)), reload(pending));
  let declined = reload(pending);
  for (const id of ['r', 'e', 'a']) declined = applyAction(declined, id, { type: 'semutaPass', event });
  assert.equal(declined.pendingTreacheryDiscard, null);
  assert.deepEqual(declined.discard, pending.discard);
  assert.equal(player(declined, 'a').spice, spice - 2);
  assert.equal(player(declined, 'a').hand.filter(card => card.id === target).length, 1);
  assert.deepEqual(inventory(declined), original);
  const claimed = applyAction(reload(pending), 'r', { type: 'semutaCommit', event });
  assert.equal(claimed.pendingTreacheryDiscard, null);
  assert.equal(player(claimed, 'a').spice, spice - 2);
  assert.equal(player(claimed, 'a').hand.filter(card => card.id === target).length, 1);
  assert.equal(player(claimed, 'r').hand.filter(card => card.id === box.id).length, 1);
  assert.equal(claimed.discard.filter(card => card.id === semuta.id).length, 1);
  assert.deepEqual(claimed.discard.filter(card => card.id !== semuta.id).map(card => card.id), shuffled);
  assert.deepEqual(inventory(claimed), original);
  for (const p of claimed.players)
    assert.deepEqual(viewGame(reload(claimed), p.id), viewGame(claimed, p.id));
  assert.deepEqual(normalizeAutomaticGame(reload(claimed)), reload(claimed));
});

void test('a retired Ornithopter can be claimed after one flight group without replaying movement', () => {
  const { g, semuta, hajr } = fixture();
  player(g, 'a').hand = [];
  g.deck.push(hajr);
  const ornithopter = take(g, 'richese-ornithopter');
  player(g, 'a').hand.push(ornithopter);
  player(g, 'a').forces = { 'imperial_basin:10': 3 };
  player(g, 'a').reserves = 17;
  player(g, 'a').shipped = true;
  const original = inventory(g);
  const first = applyAction(g, 'a', {
    type: 'move', movementCard: ornithopter.id, ornithopter: 'twoGroups',
    forces: { 'imperial_basin:10': 1 }, territory: 'arrakeen', sector: 10,
  });
  assert.equal(first.ornithopter?.completed, 1);
  assert.equal(first.discard.some(card => card.id === ornithopter.id), false);
  const pending = applyAction(first, 'a', { type: 'endMovement' });
  assert.equal(pending.ornithopter, null);
  assert.equal(pending.pendingTreacheryDiscard?.continuation.kind, 'ornithopterDiscard');
  assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.equal(pending.discard.filter(card => card.id === ornithopter.id).length, 1);
  assert.equal(pending.active, 'a');
  assert.deepEqual(pending.movementRemaining, ['a', 'r', 'e']);
  const event = pending.pendingTreacheryDiscard!.batch.event;
  assert.equal(viewGame(pending, 'r').semutaReaction?.canCommit, true);
  assert.equal(viewGame(pending, 'a').semutaReaction?.canCommit, false);
  assert.deepEqual(normalizeAutomaticGame(reload(pending)), reload(pending));
  let declined = reload(pending);
  for (const id of ['e', 'a', 'r'])
    declined = applyAction(declined, id, { type: 'semutaPass', event });
  assert.equal(declined.pendingTreacheryDiscard, null);
  assert.equal(declined.active, 'r');
  assert.deepEqual(declined.movementRemaining, ['r', 'e']);
  assert.equal(declined.discard.filter(card => card.id === ornithopter.id).length, 1);
  const claimed = applyAction(reload(pending), 'r', botActions(viewGame(pending, 'r'))[0]!);
  assert.equal(claimed.pendingTreacheryDiscard, null);
  assert.equal(claimed.active, 'r');
  assert.deepEqual(claimed.movementRemaining, ['r', 'e']);
  assert.equal(player(claimed, 'a').moved, 1);
  assert.equal(player(claimed, 'a').forces['arrakeen:10'], 1);
  assert.equal(player(claimed, 'a').forces['imperial_basin:10'], 2);
  assert.equal(player(claimed, 'r').hand.filter(card => card.id === ornithopter.id).length, 1);
  assert.equal(claimed.discard.filter(card => card.id === semuta.id).length, 1);
  assert.equal(claimed.discard.some(card => card.id === ornithopter.id), false);
  assert.deepEqual(inventory(claimed), original);
  for (const p of claimed.players)
    assert.deepEqual(viewGame(reload(claimed), p.id), viewGame(claimed, p.id));
  assert.deepEqual(normalizeAutomaticGame(reload(claimed)), reload(claimed));
  assert.throws(() => applyAction(claimed, 'r', { type: 'semutaCommit', event }));
});
