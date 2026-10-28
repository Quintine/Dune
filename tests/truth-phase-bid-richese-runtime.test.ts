import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
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

/** Real Basic Richese/Atreides/Emperor setup and Charity. The fixture orders
 * unopened original cards and Spice cards only: no hands, funds, cache,
 * commitments or phase state are staged. */
function bind(answer: 'yes' | 'no') {
  const f = fixture({ advanced: false });
  const question = { kind: 'phaseBid' as const, target: f.emperor,
    turn: f.earlySource.turn, minimum: 4 };
  const asked = ask(structuredClone(f.earlySource), f, question);
  assert.ok(viewGame(asked, f.emperor).truthPhaseBidAnswers?.includes(answer));
  const answered = act(asked, f.emperor, { type: 'truthAnswer', answer });
  const bound = passTruthRicheseFreshDiscard(answered);
  assert.equal(bound.truthtrance, null);
  assert.equal(bound.discard.filter(card => card.id === f.truth).length, 1);
  assert.ok(bound.phaseBidPromises?.some(row => row.player === f.emperor &&
    row.minimum === 4 && row.answer === (answer === 'yes')));
  assert.deepEqual(inventory(bound), f.originalCards);
  return { f, asked, bound };
}

function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => act(game, actor, action));
  assert.deepEqual(game, before, 'A rejected declaration must not mutate the game');
}

type Method = 'onceAround' | 'silent';
function cacheBidFirst(game: Game, actor: string, method: Method) {
  const options = { position: 'first' as const, method };
  game = advance(game, state => clean(state) && !!state.richeseAuction &&
    state.richeseAuction.source === 'cache' && !state.richeseAuction.outcome, [], options);
  if (method === 'onceAround') game = advance(game, state => clean(state) &&
    state.richeseAuction?.active === actor, [], options);
  const event = game.richeseAuction!.event;
  // This actual special-auction bid is not a phase-wide ordinary bid.
  game = act(game, actor, { type: 'richeseBid', event, amount: 4, allyPayment: 0 });
  const row = game.phaseBidPromises!.find(p => p.player === actor && p.minimum === 4)!;
  assert.ok(!row.fulfilled && !row.released,
    'A cache bid neither fulfills nor contradicts the ordinary-bid question');
  return game;
}

function ordinaryTurn(game: Game, actor: string, position: 'first' | 'last', method: Method) {
  return advance(game, state => clean(state) && !!state.auction &&
    !state.richeseAuction && state.auction.active === actor, [], { position, method });
}

for (const position of ['first', 'last'] as const) for (const method of ['onceAround', 'silent'] as const) {
  for (const answer of ['yes', 'no'] as const) {
    void test(`Basic phase bid ${answer} survives ${position} ${method} Richese cache and governs a real ordinary bid`, () => {
      const { f, bound } = bind(answer);
      const beforeOrdinary = position === 'first' ? cacheBidFirst(bound, f.emperor, method) : bound;
      const current = ordinaryTurn(beforeOrdinary, f.emperor, position, method);
      const promise = current.phaseBidPromises!.find(row => row.player === f.emperor && row.minimum === 4)!;
      assert.ok(promise && !promise.fulfilled && !promise.released);
      if (position === 'first') {
        assert.ok(player(current, f.emperor).hand.some(card => card.id === f.cacheCard));
        assert.equal(player(current, f.emperor).spice, 6);
      }
      let next: Game;
      if (answer === 'yes') {
        const guide = viewGame(current, f.emperor).phaseBidPromiseGuide;
        assert.ok(guide); assert.equal(guide.action.type, 'bid');
        assert.equal(guide.action.amount, 4);
        next = act(current, f.emperor, guide.action);
        assert.ok(next.phaseBidPromises!.some(row => row.player === f.emperor && row.fulfilled));
      } else {
        reject(current, f.emperor, { type: 'bid', amount: 4, allyPayment: 0 });
        next = act(current, f.emperor, { type: 'bid', amount: 3, allyPayment: 0 });
        assert.ok(next.phaseBidPromises!.some(row => row.player === f.emperor &&
          !row.answer && !row.fulfilled && !row.released));
      }
      assert.deepEqual(inventory(next), f.originalCards);
      if (position === 'last') {
        // The ordinary winner's invoice and any remaining auction controls
        // resolve before the original cache offer; do not invent another lot.
        const later = advance(next, state => clean(state) && !!state.richeseAuction &&
          state.richeseAuction.source === 'cache' && !state.richeseAuction.outcome,
        [], { position, method });
        assert.equal(later.richeseAuction!.method, method);
        assert.deepEqual(inventory(later), f.originalCards);
      }
    });
  }
}

void test('all four profiles answer and follow a phase-bid guide after a native Richese cache auction', () => {
  const { f, asked } = bind('yes');
  for (const difficulty of DIFFICULTIES) {
    const answerView = viewGame(asked, f.emperor);
    answerView.players.find(row => row.id === f.emperor)!.bot = difficulty;
    const answer = botActions(answerView)[0];
    assert.equal(answer?.type, 'truthAnswer');
    assert.ok(answer.answer === 'yes' || answer.answer === 'no');
    const bound = passTruthRicheseFreshDiscard(act(structuredClone(asked), f.emperor, answer));
    const current = ordinaryTurn(bound, f.emperor, 'first', 'silent');
    const view = viewGame(current, f.emperor);
    view.players.find(row => row.id === f.emperor)!.bot = difficulty;
    const guide = view.phaseBidPromiseGuide;
    assert.ok(guide, 'The active seat has an actual legal phase-bid guide');
    const action = botActions(view)[0];
    assert.deepEqual(action, guide.action);
    const done = act(current, f.emperor, action);
    assert.deepEqual(inventory(done), f.originalCards);
  }
});

void test('an externally canceled cache preserves a pre-Bidding ordinary phase Yes', () => {
  const f = fixture({ advanced: false });
  const source = structuredClone(f.earlySource);
  // Controlled physical supplement: move one actual unopened Karama into
  // Atreides' hand for the real cache-cancellation response. All cards remain.
  const index = source.deck.findIndex(card => card.effect === 'karama'); assert.ok(index >= 0);
  const card = source.deck.splice(index, 1)[0];
  player(source, f.asker).hand.push(card);
  assert.deepEqual(inventory(source), f.originalCards);
  const asked = ask(source, f, { kind: 'phaseBid', target: f.emperor, turn: source.turn, minimum: 4 });
  assert.ok(viewGame(asked, f.emperor).truthPhaseBidAnswers?.includes('yes'));
  const bound = passTruthRicheseFreshDiscard(act(asked, f.emperor, { type: 'truthAnswer', answer: 'yes' }));
  const declaration = advance(bound, state => state.decision?.kind === 'richeseDeclaration');
  const opened = act(declaration, f.richese, { type: 'decision',
    event: declaration.richeseBidding!.event, position: 'first' });
  assert.equal(opened.response?.kind, 'richeseAuction');
  const canceled = passTruthRicheseFreshDiscard(act(opened, f.asker, { type: 'card', card: card.id, mode: 'cancel' }));
  assert.equal(canceled.richeseBidding?.cacheCanceled, true);
  assert.ok(canceled.phaseBidPromises?.some(row => row.player === f.emperor &&
    row.answer && !row.fulfilled && !row.released));
  const current = ordinaryTurn(canceled, f.emperor, 'first', 'onceAround');
  const guide = viewGame(current, f.emperor).phaseBidPromiseGuide; assert.ok(guide);
  assert.equal(guide.action.amount, 4);
  const done = act(current, f.emperor, guide.action);
  assert.ok(done.phaseBidPromises?.some(row => row.player === f.emperor && row.fulfilled));
  assert.deepEqual(inventory(done), f.originalCards);
});
