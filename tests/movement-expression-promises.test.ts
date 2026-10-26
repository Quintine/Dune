import assert from 'node:assert/strict';
import test from 'node:test';
import { territory } from '../game/board';
import type { Action, Game } from '../game/engine';
import {
  MOVEMENT_EXPRESSION_MAX_DEPTH, MOVEMENT_EXPRESSION_MAX_LEAVES, MovementExpressionPromiseError,
  evaluateMovementExpression, liveMovementExpressionPromises, movementExpressionTerritories, movementExpressionText,
  parseMovementExpression, parseMovementExpressionClaim, recordMovementExpressionEvent, validateMovementExpressionPromises,
  type MovementExpression, type MovementExpressionProgress, type MovementExpressionPromise,
} from '../game/movement-expression-promises';
import { findMovementCompletion, type MovementPromiseAdapter } from '../game/movement-promise-search';
import type { MovementEvent, MovementPromise } from '../game/movement-promises';

const move = (destination = 'carthag', minimum = 3): MovementExpression => ({ kind: 'move', territory: destination, minimum });
const group = (kind: 'and' | 'or', ...terms: MovementExpression[]): MovementExpression => ({ kind, terms });
const progress = (destination: string, maximum: number): MovementExpressionProgress => [{ territory: destination, maximum }];
const promise = (event = 'event', claim: MovementExpression = move(), extra: Partial<MovementExpressionPromise> = {}): MovementExpressionPromise =>
  ({ event, turn: 2, player: 'mover', asker: 'asker', answer: true, progress: [], claim, ...extra });
const atomic = (destination = 'carthag', minimum = 3, extra: Partial<MovementPromise> = {}): MovementPromise =>
  ({ turn: 2, player: 'mover', asker: 'asker', answer: true, territory: destination, minimum, ...extra });
const seats = ['mover', 'asker', 'other'];

void test('movement expressions parse all sixteen leaves and four nested groups through scalar printed-board rules', () => {
  assert.equal(MOVEMENT_EXPRESSION_MAX_DEPTH, 4); assert.equal(MOVEMENT_EXPRESSION_MAX_LEAVES, 16);
  const sixteen = group('and', ...Array.from({ length: 16 }, (_, index) => move('carthag', index + 1)));
  const parsed = parseMovementExpression(sixteen);
  assert.deepEqual(parsed, sixteen); assert.notEqual(parsed, sixteen);
  if ('terms' in parsed && 'terms' in sixteen) {
    assert.notEqual(parsed.terms, sixteen.terms); assert.notEqual(parsed.terms[0], sixteen.terms[0]);
  }
  const nested = (depth: number): MovementExpression => depth === 0 ? move() : group('or', move('arrakeen'), nested(depth - 1));
  assert.deepEqual(parseMovementExpression(nested(4)), nested(4));
  assert.throws(() => parseMovementExpression(nested(5)), MovementExpressionPromiseError);
  assert.throws(() => parseMovementExpression(group('or', ...Array.from({ length: 17 }, () => move()))), MovementExpressionPromiseError);
  assert.throws(() => parseMovementExpression(group('and',
    group('or', ...Array.from({ length: 9 }, () => move())),
    group('or', ...Array.from({ length: 8 }, () => move())))), MovementExpressionPromiseError);
  assert.deepEqual(parseMovementExpressionClaim({ turn: Number.MAX_SAFE_INTEGER, claim: move('polar_sink', 20) }),
    { turn: Number.MAX_SAFE_INTEGER, claim: move('polar_sink', 20) });
});

void test('strict movement parsing checks decisive later subtrees, exact fields and safe one-to-twenty minima', () => {
  const invalid: unknown[] = [null, [], {}, { kind: 'and', terms: [] }, { kind: 'or', terms: [move()] },
    { kind: 'not', terms: [move(), move()] }, { kind: 'move', territory: 'carthag', minimum: 1, progress: 0 },
    { kind: 'and', terms: [move(), move('arrakeen')], branch: 0 },
    ...['', ' carthag', 'homeworld:caladan', 'hidden_mobile_stronghold', 'missing'].map(destination => move(destination)),
    ...[0, -1, 0.5, 21, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, '3'].map(minimum =>
      ({ kind: 'move', territory: 'carthag', minimum }))];
  for (const value of invalid) assert.throws(() => parseMovementExpression(value), MovementExpressionPromiseError);
  const decisive = group('or', move('carthag', 1), move('arrakeen', 0));
  assert.throws(() => evaluateMovementExpression(decisive, progress('carthag', 1)), MovementExpressionPromiseError);
  assert.throws(() => evaluateMovementExpression(group('and', move(), decisive), []), MovementExpressionPromiseError);
  for (const value of [{ turn: 0, claim: move() }, { turn: '2', claim: move() }, { turn: 2, claim: move(), branch: 0 },
    { turn: 2 }, { claim: move() }])
    assert.throws(() => parseMovementExpressionClaim(value), MovementExpressionPromiseError);
});

void test('nested movement text and unique destinations preserve the whole expression', () => {
  const claim = group('and', move('carthag', 3), group('or', move('arrakeen', 2), move('carthag', 6)));
  assert.deepEqual(movementExpressionTerritories(claim), ['carthag', 'arrakeen']);
  assert.equal(evaluateMovementExpression(claim, progress('carthag', 3)), false);
  assert.equal(evaluateMovementExpression(claim, progress('carthag', 6)), true);
  assert.equal(evaluateMovementExpression(claim, [...progress('carthag', 3), ...progress('arrakeen', 2)]), true);
  assert.equal(movementExpressionText(claim),
    '(make a ground movement of at least 3 physical forces to Carthag AND (make a ground movement of at least 2 physical forces to Arrakeen OR make a ground movement of at least 6 physical forces to Carthag))');
});

void test('progress records one actual move maximum and never sums smaller arrivals or marker pieces', () => {
  const original = [promise('largest', move('carthag', 6))];
  let ledger = original;
  for (const amount of [0, 2, 4, 3, 5]) ledger = recordMovementExpressionEvent(ledger, 'mover', 2, { territory: 'carthag', amount });
  assert.deepEqual(ledger[0].progress, progress('carthag', 5)); assert.equal(ledger[0].fulfilled, undefined);
  const bySix = recordMovementExpressionEvent(ledger, 'mover', 2, { territory: 'carthag', amount: 6 });
  assert.equal(bySix[0].fulfilled, true); assert.deepEqual(bySix[0].progress, progress('carthag', 6));
  assert.deepEqual(original[0].progress, []); assert.deepEqual(ledger[0].progress, progress('carthag', 5));
  assert.equal(recordMovementExpressionEvent(original, 'mover', 2, { territory: 'carthag', amount: 0 })[0], original[0]);
  assert.equal(recordMovementExpressionEvent(original, 'mover', 2, { territory: 'hidden_mobile_stronghold', amount: 10 })[0], original[0]);
});

void test('whole Yes keeps alternate OR routes after partial movement and shares a same-destination event across leaves', () => {
  const original = promise('alternate', group('or', move('carthag', 5), move('arrakeen', 3)));
  const partial = recordMovementExpressionEvent([original], 'mover', 2, { territory: 'carthag', amount: 4 });
  assert.equal(partial[0].fulfilled, undefined);
  const alternate = recordMovementExpressionEvent(partial, 'mover', 2, { territory: 'arrakeen', amount: 3 });
  assert.equal(alternate[0].fulfilled, true); assert.equal('branch' in alternate[0], false);
  assert.deepEqual(alternate[0].progress, [...progress('carthag', 4), ...progress('arrakeen', 3)]);
  const same = recordMovementExpressionEvent([promise('shared', group('and', move('carthag', 3), move('carthag', 5)))],
    'mover', 2, { territory: 'carthag', amount: 5 });
  assert.equal(same[0].fulfilled, true); assert.deepEqual(same[0].progress, progress('carthag', 5));
  assert.deepEqual(original.progress, []);
});

void test('whole No to nested AND allows one conjunct and rejects the actual move completing the whole statement', () => {
  const original = promise('not-all', group('and', move('carthag', 2), group('or', move('arrakeen', 3), move('polar_sink', 4))),
    { answer: false });
  const first = recordMovementExpressionEvent([original], 'mover', 2, { territory: 'carthag', amount: 2 });
  assert.equal(first[0].fulfilled, undefined);
  for (const event of [{ territory: 'arrakeen', amount: 3 }, { territory: 'polar_sink', amount: 4 }])
    assert.throws(() => recordMovementExpressionEvent(first, 'mover', 2, event), MovementExpressionPromiseError);
  const reversed = recordMovementExpressionEvent([original], 'mover', 2, { territory: 'arrakeen', amount: 3 });
  assert.throws(() => recordMovementExpressionEvent(reversed, 'mover', 2, { territory: 'carthag', amount: 2 }), MovementExpressionPromiseError);
  assert.deepEqual(first[0].progress, progress('carthag', 2));
});

void test('whole No to nested OR forbids either completed branch while permitting an incomplete AND branch', () => {
  const original = promise('not-either', group('or', move('carthag', 2), group('and', move('arrakeen', 3), move('polar_sink', 4))),
    { answer: false });
  assert.throws(() => recordMovementExpressionEvent([original], 'mover', 2, { territory: 'carthag', amount: 2 }), MovementExpressionPromiseError);
  const partial = recordMovementExpressionEvent([original], 'mover', 2, { territory: 'arrakeen', amount: 3 });
  assert.doesNotThrow(() => recordMovementExpressionEvent(partial, 'mover', 2, { territory: 'carthag', amount: 1 }));
  assert.throws(() => recordMovementExpressionEvent(partial, 'mover', 2, { territory: 'polar_sink', amount: 4 }), MovementExpressionPromiseError);
});

void test('answer intervals exclude prior movements and retain other-player, old-turn, terminal and nonmatching records', () => {
  const earlier = recordMovementExpressionEvent([promise('earlier')], 'mover', 2, { territory: 'carthag', amount: 3 })[0];
  const later = promise('later');
  const records = [earlier, promise('released', move(), { released: true }), promise('old-turn', move(), { turn: 1 }),
    promise('other', move(), { player: 'other' }), promise('elsewhere', move('arrakeen')), later];
  assert.deepEqual(liveMovementExpressionPromises(records, 'mover', 2), [records[4], later]);
  const next = recordMovementExpressionEvent(records, 'mover', 2, { territory: 'carthag', amount: 2 });
  for (let index = 0; index < 5; index++) assert.equal(next[index], records[index]);
  assert.deepEqual(next[5].progress, progress('carthag', 2)); assert.equal(next[5].fulfilled, undefined);
  assert.deepEqual(later.progress, []);
});

void test('rejected completion cannot partly update another answer or frozen input progress', () => {
  const records = [promise('yes'), promise('no', group('or', move(), move('arrakeen')), { answer: false })];
  const partial = recordMovementExpressionEvent(records, 'mover', 2, { territory: 'carthag', amount: 2 });
  const before = structuredClone(partial);
  partial.forEach(entry => { entry.progress.forEach(Object.freeze); Object.freeze(entry.progress); Object.freeze(entry); });
  Object.freeze(partial);
  assert.throws(() => recordMovementExpressionEvent(partial, 'mover', 2, { territory: 'carthag', amount: 3 }), MovementExpressionPromiseError);
  assert.deepEqual(partial, before); assert.equal(partial[0].fulfilled, undefined);
});

void test('movement progress and events reject unsafe, overflowing, duplicate or extra-key entries', () => {
  const invalid: unknown[] = [null, {}, progress('carthag', -1), progress('carthag', 0.5), progress('carthag', 21),
    progress('carthag', Number.MAX_SAFE_INTEGER + 1), [...progress('carthag', 1), ...progress('carthag', 2)],
    progress('missing', 1), [{ territory: 'carthag', maximum: 1, sum: 1 }]];
  for (const value of invalid)
    assert.throws(() => evaluateMovementExpression(move(), value as MovementExpressionProgress), MovementExpressionPromiseError);
  for (const event of [{ territory: '', amount: 1 }, { territory: ' carthag', amount: 1 },
    { territory: 'carthag', amount: -1 }, { territory: 'carthag', amount: 0.5 }, { territory: 'carthag', amount: 21 },
    { territory: 'carthag', amount: Infinity }, { territory: 'carthag', amount: Number.MAX_SAFE_INTEGER + 1 },
    { territory: 'carthag', amount: 1, marker: 1 }])
    assert.throws(() => recordMovementExpressionEvent([], 'mover', 2, event), MovementExpressionPromiseError);
  assert.throws(() => recordMovementExpressionEvent([promise('foreign-progress', move(), { progress: progress('arrakeen', 1) })],
    'mover', 2, { territory: 'carthag', amount: 1 }), MovementExpressionPromiseError);
});

void test('movement ledger validation binds events, participants, matching maxima and whole-answer terminal flags', () => {
  const valid = [promise('live', move(), { progress: progress('carthag', 2) }),
    promise('fulfilled', move(), { progress: progress('carthag', 3), fulfilled: true }),
    promise('closed-no', move(), { answer: false, fulfilled: true }), promise('released', move(), { released: true })];
  const before = structuredClone(valid);
  assert.doesNotThrow(() => validateMovementExpressionPromises(valid, seats));
  assert.doesNotThrow(() => validateMovementExpressionPromises(JSON.parse(JSON.stringify(valid)) as MovementExpressionPromise[], seats));
  const base = promise();
  const invalid: unknown[] = [null, {}, [null], [base, { ...base }],
    ...[{ event: '' }, { player: 'absent' }, { asker: 'absent' }, { asker: 'mover' }, { answer: 'yes' },
      { fulfilled: 1 }, { released: 1 }, { fulfilled: true }, { fulfilled: true, released: true },
      { progress: progress('carthag', 3) }, { progress: progress('arrakeen', 1) },
      { answer: false, progress: progress('carthag', 3) }, { answer: false, progress: progress('carthag', 3), released: true },
      { turn: 0 }].map(extra => [{ ...base, ...extra }])];
  for (const value of invalid)
    assert.throws(() => validateMovementExpressionPromises(value as MovementExpressionPromise[], seats), MovementExpressionPromiseError);
  assert.deepEqual(valid, before);
});

/** Structural adapter seam only: native engine entitlement and physical-route
 * proof belongs to its runtime tests. This fixture consumes one real Hajr ID. */
function searchSource(hajr = false): Game {
  return { turn: 2, advanced: false, players: [{ id: 'mover', faction: 'atreides',
    forces: { 'imperial_basin:9': 6 }, moved: 0, shipped: true, reserves: 0, tanks: 0, spice: 0,
    hand: hajr ? [{ id: 'owned-hajr', effect: 'hajr' }] : [] }], discard: [], hajr: [] } as unknown as Game;
}
function searchAdapter(projected: MovementEvent[] = []): MovementPromiseAdapter {
  return {
    allowance: game => game.hajr.includes('mover') ? 2 : 1,
    canFinish: () => true,
    *preparations(game) {
      const player = game.players[0], card = player.hand.find(card => card.effect === 'hajr');
      if (!card || game.hajr.includes(player.id)) return;
      const next = structuredClone(game);
      next.players[0].hand = next.players[0].hand.filter(held => held.id !== card.id);
      next.discard.push(card); next.hajr.push(player.id);
      yield { game: next, actions: [{ type: 'card', card: card.id }] };
    },
    reachable: (_game, _player, origin, destination, sector) => origin !== destination &&
      ['carthag', 'arrakeen'].includes(destination) && sector === territory(destination).sectors[0],
    project(game, _actor, action: Action) {
      const next = structuredClone(game), player = next.players[0];
      const forces = action.forces as Record<string, number>;
      const amount = Object.values(forces).reduce((sum, value) => sum + value, 0);
      for (const [key, count] of Object.entries(forces)) {
        if (count > player.forces[key]) return null;
        player.forces[key] -= count;
        if (player.forces[key] === 0) delete player.forces[key];
      }
      const destination = `${String(action.territory)}:${String(action.sector)}`;
      player.forces[destination] = (player.forces[destination] ?? 0) + amount; player.moved++;
      const event = { territory: String(action.territory), amount }; projected.push(event);
      return { game: next, event };
    },
  };
}

void test('joint search uses an owned Hajr for two distinct AND moves and leaves the original state detached', () => {
  const source = searchSource(true), before = structuredClone(source);
  source.movementExpressionPromises = [promise('two-moves', group('and', move('arrakeen', 3), move('carthag', 3)))];
  const result = findMovementCompletion(source, 'mover', [], searchAdapter());
  assert.ok(result);
  assert.equal(result.actions.filter(action => action.type === 'move').length, 2);
  assert.equal(result.actions.filter(action => action.type === 'card' && action.card === 'owned-hajr').length, 1);
  assert.deepEqual(source.players, before.players); assert.deepEqual(source.discard, before.discard);
  assert.deepEqual(source.movementExpressionPromises[0].progress, []);
  assert.equal(findMovementCompletion(searchSource(), 'mover', [], searchAdapter(), source.movementExpressionPromises), null);
});

void test('joint search retains alternate expression routes under scalar No and shares one move across positive answers', () => {
  const source = searchSource();
  const choice = promise('either', group('or', move('arrakeen', 3), move('carthag', 3)));
  const result = findMovementCompletion(source, 'mover', [atomic('arrakeen', 1, { answer: false }), atomic('carthag', 3)],
    searchAdapter(), [choice]);
  assert.ok(result); assert.equal(result.actions.length, 1); assert.equal(result.actions[0].territory, 'carthag');
  assert.equal(Object.values(result.actions[0].forces as Record<string, number>).reduce((sum, value) => sum + value, 0), 3);
});

void test('joint search rejects whole-No completion before projecting physical pieces and respects earlier progress', () => {
  const projected: MovementEvent[] = [];
  const notBoth = promise('not-both', group('and', move('arrakeen', 3), move('carthag', 3)),
    { answer: false, progress: progress('arrakeen', 3) });
  assert.equal(findMovementCompletion(searchSource(), 'mover', [atomic('carthag', 3)], searchAdapter(projected), [notBoth]), null);
  assert.deepEqual(projected, []);
  const permitted = findMovementCompletion(searchSource(), 'mover', [atomic('carthag', 2)], searchAdapter(), [notBoth]);
  assert.ok(permitted); assert.equal(permitted.actions[0].territory, 'carthag');
  assert.equal(findMovementCompletion(searchSource(), 'mover', [atomic('carthag', 3)], searchAdapter(),
    [promise('neither', group('or', move('arrakeen', 3), move('carthag', 3)), { answer: false })]), null);
});

void test('whole-expression physical bounds retain reachable OR alternatives and previously satisfied larger leaves', () => {
  const source = searchSource();
  const choice = promise('smaller-alternate', group('or', move('arrakeen', 20), move('carthag', 3)));
  const byAlternate = findMovementCompletion(source, 'mover', [], searchAdapter(), [choice]);
  assert.ok(byAlternate); assert.equal(byAlternate.actions[0].territory, 'carthag');
  const partlyDone = promise('larger-earlier', group('and', move('arrakeen', 20), move('carthag', 3)),
    { progress: progress('arrakeen', 20) });
  const remaining = findMovementCompletion(source, 'mover', [], searchAdapter(), [partlyDone]);
  assert.ok(remaining); assert.equal(remaining.actions.length, 1); assert.equal(remaining.actions[0].territory, 'carthag');
  assert.equal(findMovementCompletion(source, 'mover', [], searchAdapter(),
    [promise('impossible', group('or', move('arrakeen', 20), move('carthag', 7)))]), null);
});

void test('explicit empty expression subsets preserve the legacy search contract even when the source has a pending expression', () => {
  const source = searchSource(); source.movementExpressionPromises = [promise('needs-both', group('and', move('arrakeen'), move('carthag')))];
  const result = findMovementCompletion(source, 'mover', [atomic()], {
    ...searchAdapter(),
    project(game, actor, action) {
      assert.deepEqual(game.movementExpressionPromises, []);
      return searchAdapter().project(game, actor, action);
    },
  }, []);
  assert.ok(result); assert.equal(result.actions.length, 1);
});
