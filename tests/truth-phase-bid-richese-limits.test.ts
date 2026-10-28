import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeAutomaticGame, viewGame, type Action, type Game } from '../game/engine';
import {
  actTruthtranceRichesePromises as act,
  advanceTruthtranceRichesePromises as advance,
  askTruthtranceRichesePromises as ask,
  createTruthtranceRichesePromisesFixture as fixture,
  passTruthRicheseFreshDiscard,
  truthtranceRichesePromisesClean as clean,
  truthtranceRichesePromisesInventory as inventory,
  truthtranceRichesePromisesPlayer as player,
} from './fixture-truthtrance-richese-promises';

type Fixture = ReturnType<typeof fixture>;
type Method = 'onceAround' | 'silent';

/** Supplemental setup moves real unopened cards only, retaining all physical
 * card identities; no funds, promise, auction result or board state is staged. */
function fillHand(game: Game, f: Fixture, actor: string, size: number) {
  while (player(game, actor).hand.length < size) {
    const index = game.deck.findIndex(card => card.id !== f.ordinaryLot);
    assert.ok(index >= 0);
    player(game, actor).hand.push(game.deck.splice(index, 1)[0]);
  }
  assert.deepEqual(inventory(game), f.originalCards);
}

function bind(f: Fixture, source: Game) {
  const asked = ask(source, f, { kind: 'phaseBid', target: f.emperor, turn: source.turn, minimum: 4 });
  assert.ok(viewGame(asked, f.emperor).truthPhaseBidAnswers?.includes('yes'));
  const bound = passTruthRicheseFreshDiscard(act(asked, f.emperor, { type: 'truthAnswer', answer: 'yes' }));
  assert.ok(bound.phaseBidPromises?.some(row => row.player === f.emperor && row.answer && !row.released));
  return bound;
}

function cacheTurn(game: Game, target: string, method: Method) {
  const options = { position: 'first' as const, method };
  game = advance(game, state => clean(state) && state.richeseAuction?.source === 'cache' &&
    state.richeseAuction.method === method && !state.richeseAuction.outcome, [], options);
  if (method === 'onceAround') game = advance(game, state => clean(state) &&
    state.richeseAuction?.active === target, [], options);
  return game;
}

function rejects(source: Game, actor: string, action: Action) {
  const before = structuredClone(source);
  assert.throws(() => act(source, actor, action));
  assert.deepEqual(source, before, 'A rejected voluntary bid must not mutate its source');
}

for (const method of ['onceAround', 'silent'] as const) {
  void test(`Basic ${method} cache bid cannot spend the last funds for a phase-wide Yes`, () => {
    const f = fixture({ advanced: false });
    const bound = bind(f, structuredClone(f.earlySource));
    assert.equal(player(bound, f.emperor).spice, 10);
    const current = cacheTurn(bound, f.emperor, method);
    const event = current.richeseAuction!.event;
    rejects(current, f.emperor, { type: 'richeseBid', event, amount: 7, allyPayment: 0 });
    const accepted = act(current, f.emperor, { type: 'richeseBid', event, amount: 6, allyPayment: 0 });
    assert.ok(accepted.phaseBidPromises?.some(row => row.player === f.emperor && row.answer &&
      !row.fulfilled && !row.released));
    assert.deepEqual(inventory(accepted), f.originalCards);
  });

  void test(`Basic ${method} cache bid cannot consume the only hand slot needed for a phase-wide Yes`, () => {
    const f = fixture({ advanced: false });
    const source = structuredClone(f.earlySource);
    fillHand(source, f, f.emperor, 3);
    const bound = bind(f, source);
    const current = cacheTurn(bound, f.emperor, method);
    const event = current.richeseAuction!.event;
    rejects(current, f.emperor, { type: 'richeseBid', event, amount: 1, allyPayment: 0 });
    const passed = act(current, f.emperor, { type: 'richeseBid', event,
      amount: method === 'silent' ? 0 : null });
    assert.ok(passed.phaseBidPromises?.some(row => row.player === f.emperor && row.answer &&
      !row.fulfilled && !row.released));
    assert.deepEqual(inventory(passed), f.originalCards);
  });
}

void test('a full Truthtrance holder creates a real ordinary slot by discarding the answered card', () => {
  const f = fixture({ advanced: false });
  const source = structuredClone(f.earlySource);
  // Immediately before answering only Emperor has an open slot. The definite
  // Truthtrance answer consumes Atreides' real held card, so Atreides also has
  // an open slot before the compulsory cache reduces the ordinary lot count.
  fillHand(source, f, f.asker, 4);
  fillHand(source, f, f.richese, 4);
  assert.equal(player(source, f.emperor).hand.length, 1);
  const bound = bind(f, source);
  assert.equal(player(bound, f.asker).hand.length, 3);
  assert.equal(player(bound, f.richese).hand.length, 4);
  const current = advance(bound, state => clean(state) && !!state.auction &&
    !state.richeseAuction && state.auction.active === f.emperor, [], { position: 'first' });
  assert.equal(current.richeseBidding?.normalCountBeforeCache, 2);
  assert.equal(current.richeseBidding?.normalCount, 1);
  const guide = viewGame(current, f.emperor).phaseBidPromiseGuide; assert.ok(guide);
  assert.equal(guide.action.amount, 4);
  const fulfilled = act(current, f.emperor, guide.action);
  assert.ok(fulfilled.phaseBidPromises?.some(row => row.player === f.emperor && row.fulfilled));
  assert.deepEqual(inventory(fulfilled), f.originalCards);
});

void test('an externally reduced one-eligible-seat state cannot retain a speculative ordinary Yes', () => {
  const f = fixture({ advanced: false });
  const bound = bind(f, structuredClone(f.earlySource));
  const staged = structuredClone(bound);
  // Controlled external capacity loss after the answered Truthtrance: move
  // unopened cards into the other two hands, leaving only Emperor eligible.
  fillHand(staged, f, f.asker, 4);
  fillHand(staged, f, f.richese, 4);
  assert.equal(player(staged, f.emperor).hand.length, 1);
  const settled = normalizeAutomaticGame(staged);
  assert.ok(settled.phaseBidPromises?.some(row => row.player === f.emperor && row.answer && row.released),
    'One eligible seat cannot guarantee an ordinary lot while the cache consumes that opportunity');
  assert.deepEqual(inventory(settled), f.originalCards);
});
