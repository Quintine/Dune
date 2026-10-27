import assert from 'node:assert/strict';
import test from 'node:test';
import { protectOrderedOpportunityLast, reorderOrderedOpportunity } from '../game/ordered-opportunity';
import {
  reorderSaphoMovementOrder, saphoMovementOrderEvent, SaphoMovementOrderError,
  type SaphoMovementOrderContext,
} from '../game/sapho-movement-order';

function context(started = false): SaphoMovementOrderContext {
  return {
    queue: {
      event: 'movement:3', eligible: ['done', 'active', 'later', 'holder', 'guild'],
      remaining: ['active', 'later', 'holder', 'guild'], completed: ['done'],
      current: 'active', currentStarted: started, protectedLast: null,
    },
    started: started ? ['done', 'active'] : ['done'],
    guild: { player: 'guild', granted: false, locked: false },
  };
}
function reorder(input: SaphoMovementOrderContext, player: string, mode: 'first' | 'last') {
  return reorderSaphoMovementOrder(input, { event: saphoMovementOrderEvent(input), player, mode });
}
function reject(input: SaphoMovementOrderContext, player: string, mode: 'first' | 'last', event?: string) {
  const before = structuredClone(input);
  assert.throws(() => reorderSaphoMovementOrder(input, {
    event: event ?? saphoMovementOrderEvent(input), player, mode,
  }), SaphoMovementOrderError);
  assert.deepEqual(input, before);
}

void test('clean first and last retain the existing immutable ordered-opportunity semantics', () => {
  for (const mode of ['first', 'last'] as const) {
    const input = context(), before = structuredClone(input);
    const quote = reorder(input, 'holder', mode);
    const expected = mode === 'first'
      ? reorderOrderedOpportunity(input.queue, { event: input.queue.event, player: 'holder', position: 'first' })
      : protectOrderedOpportunityLast(input.queue, { event: input.queue.event, player: 'holder' });
    assert.equal(quote.event, input.queue.event);
    assert.equal(quote.afterCurrent, null);
    assert.deepEqual(quote.next, expected);
    assert.deepEqual(input, before);
    assert.notEqual(quote.next.remaining, input.queue.remaining);
    assert.notEqual(quote.next.eligible, input.queue.eligible);
    assert.notEqual(quote.next.completed, input.queue.completed);
  }
  const ownCleanTurn = reorder(context(), 'active', 'last');
  assert.deepEqual(ownCleanTurn.next.remaining, ['later', 'holder', 'guild', 'active']);
  assert.equal(ownCleanTurn.next.protectedLast, 'active');
});

void test('started-tail first preserves the active combined turn and all other relative positions', () => {
  const input = context(true), before = structuredClone(input);
  const quote = reorder(input, 'holder', 'first');
  assert.equal(quote.afterCurrent, 'active');
  assert.deepEqual(quote.next.remaining, ['active', 'holder', 'later', 'guild']);
  assert.equal(quote.next.current, 'active');
  assert.equal(quote.next.currentStarted, true);
  assert.equal(quote.next.event, 'movement:3');
  assert.notEqual(quote.event, quote.next.event);
  assert.ok(quote.event.startsWith('sapho-after:'));
  assert.deepEqual(input, before);
});

void test('started-tail last includes Guild while retaining the active turn and base protection event', () => {
  const input = context(true), before = structuredClone(input);
  const quote = reorder(input, 'holder', 'last');
  assert.deepEqual(quote.next.remaining, ['active', 'later', 'guild', 'holder']);
  assert.equal(quote.next.current, 'active');
  assert.equal(quote.afterCurrent, 'active');
  assert.equal(quote.next.protectedLast, 'holder');
  assert.equal(quote.next.event, input.queue.event);
  assert.deepEqual(input, before);
  assert.throws(() => saphoMovementOrderEvent({ ...input, queue: quote.next }), SaphoMovementOrderError);
});

void test('an already started actor cannot use either mode to split its combined turn', () => {
  reject(context(true), 'active', 'first');
  reject(context(true), 'active', 'last');
  const anotherStarted = context(true);
  anotherStarted.started = ['active', 'holder'];
  reject(anotherStarted, 'later', 'last', 'movement:3');
  const inconsistentCurrent = context();
  inconsistentCurrent.started = ['active'];
  reject(inconsistentCurrent, 'holder', 'first', 'movement:3');
  const missingCurrent = context(true);
  missingCurrent.started = ['done'];
  reject(missingCurrent, 'holder', 'first', 'movement:3');
});

void test('granted Guild priority blocks clean displacement but a started Guild turn stays first during tail reorder', () => {
  const input = context();
  input.queue = { ...input.queue, remaining: ['guild', 'later', 'holder', 'active'], current: 'guild' };
  input.guild = { player: 'guild', granted: true, locked: false };
  reject(input, 'holder', 'first');
  assert.deepEqual(reorder(input, 'holder', 'last').next.remaining, ['guild', 'later', 'active', 'holder']);
  input.queue = { ...input.queue, currentStarted: true };
  input.started = ['done', 'guild'];
  const before = structuredClone(input), quote = reorder(input, 'holder', 'first');
  assert.deepEqual(quote.next.remaining, ['guild', 'holder', 'later', 'active']);
  assert.equal(quote.next.current, 'guild');
  assert.equal(quote.afterCurrent, 'guild');
  assert.deepEqual(input, before);
});

void test('ordinary Guild timing flags and Basic null timing retain their own later native opportunities', () => {
  const input = context(), before = structuredClone(input);
  assert.deepEqual(reorder(input, 'holder', 'first').next.remaining, ['holder', 'active', 'later', 'guild']);
  assert.deepEqual(input.guild, { player: 'guild', granted: false, locked: false });
  assert.deepEqual(input, before);
  const basic = { ...context(), guild: null };
  assert.deepEqual(reorder(basic, 'holder', 'last').next.remaining, ['active', 'later', 'guild', 'holder']);
  const locked = context();
  locked.queue = { ...locked.queue, remaining: ['guild', 'later', 'holder', 'active'], current: 'guild' };
  locked.guild = { player: 'guild', granted: true, locked: true };
  assert.equal(reorder(locked, 'holder', 'first').next.current, 'holder');
});

void test('an Advanced started actor can suspend its own turn to last without consuming Guild timing', () => {
  for (const guildState of [
    { player: 'guild', granted: false, locked: false },
    { player: 'guild', granted: true, locked: false },
    { player: 'guild', granted: false, locked: true },
  ]) {
    const input = { ...context(true), allowStartedLast: true, guild: guildState };
    const before = structuredClone(input);
    const quote = reorder(input, 'active', 'last');
    assert.equal(quote.suspended, 'active');
    assert.equal(quote.afterCurrent, null);
    assert.deepEqual(quote.next.remaining, ['later', 'holder', 'guild', 'active']);
    assert.deepEqual(quote.next.completed, ['done']);
    assert.equal(quote.next.current, 'later');
    assert.equal(quote.next.currentStarted, false);
    assert.equal(quote.next.protectedLast, 'active');
    assert.equal(quote.next.event, input.queue.event);
    assert.deepEqual(input, before);
    reject(input, 'active', 'first');
    reject(input, 'active', 'last', input.queue.event);
  }
});

void test('a started Guild can voluntarily move its granted turn last without creating another opportunity', () => {
  const input = context(true);
  input.queue = { ...input.queue, remaining: ['guild', 'active', 'later', 'holder'], current: 'guild' };
  input.started = ['done', 'guild'];
  input.guild = { player: 'guild', granted: true, locked: false };
  input.allowStartedLast = true;
  const before = structuredClone(input);
  const quote = reorder(input, 'guild', 'last');
  assert.equal(quote.suspended, 'guild');
  assert.deepEqual(quote.next.remaining, ['active', 'later', 'holder', 'guild']);
  assert.equal(quote.next.protectedLast, 'guild');
  assert.deepEqual(input, before);

  const alreadyLast: SaphoMovementOrderContext = {
    ...input,
    queue: { ...input.queue, remaining: ['guild'], completed: ['done', 'active', 'later', 'holder'] },
  };
  reject(alreadyLast, 'guild', 'last');
  const protectedLast: SaphoMovementOrderContext = {
    ...input, queue: { ...input.queue, protectedLast: 'holder' },
  };
  reject(protectedLast, 'guild', 'last', 'movement:3');
});

void test('started event binds the base phase, active actor and complete public tail with encoded identities', () => {
  const input = context(true), event = saphoMovementOrderEvent(input);
  assert.equal(saphoMovementOrderEvent(structuredClone(input)), event);
  assert.equal(saphoMovementOrderEvent({ ...input, started: ['active'] }), event);
  reject(input, 'holder', 'first', input.queue.event);
  const reordered = context(true);
  reordered.queue = { ...reordered.queue, remaining: ['active', 'later', 'guild', 'holder'] };
  reject(reordered, 'holder', 'first', event);
  const nextPhase = context(true);
  nextPhase.queue = { ...nextPhase.queue, event: 'movement:4' };
  reject(nextPhase, 'holder', 'first', event);
  const differentCurrent = context(true);
  differentCurrent.queue = { ...differentCurrent.queue, remaining: ['later', 'active', 'holder', 'guild'], current: 'later' };
  differentCurrent.started = ['later'];
  reject(differentCurrent, 'holder', 'last', event);
  const encoded = context(true);
  const rename = (id: string) => id === 'active' ? 'actor:/"[]' : id;
  encoded.queue = { ...encoded.queue, eligible: encoded.queue.eligible.map(rename),
    remaining: encoded.queue.remaining.map(rename), current: rename('active') };
  encoded.started = [rename('active')];
  assert.notEqual(saphoMovementOrderEvent(encoded), event);
  assert.ok(saphoMovementOrderEvent(encoded).includes('%22'));
});

void test('no-op, completed, foreign, protected and malformed requests cannot consume Sapho', () => {
  reject(context(), 'active', 'first');
  reject(context(), 'guild', 'last');
  reject(context(true), 'later', 'first');
  reject(context(true), 'guild', 'last');
  reject(context(), 'done', 'last');
  reject(context(), 'foreign', 'first');
  const protectedLast = context();
  protectedLast.queue = { ...protectedLast.queue, protectedLast: 'guild' };
  reject(protectedLast, 'holder', 'first', 'movement:3');
  const unknownStarted = context();
  unknownStarted.started = ['foreign'];
  reject(unknownStarted, 'holder', 'first', 'movement:3');
  const duplicateStarted = context(true);
  duplicateStarted.started = ['active', 'active'];
  reject(duplicateStarted, 'holder', 'last', 'movement:3');
  const malformed = context();
  malformed.queue = { ...malformed.queue, current: 'holder' };
  reject(malformed, 'holder', 'first', 'movement:3');
  const finished = context();
  finished.queue = { ...finished.queue, remaining: [], completed: finished.queue.eligible, current: null };
  reject(finished, 'holder', 'first', 'movement:3');
});
