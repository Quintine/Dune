import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
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

function bind(f: ReturnType<typeof fixture>, source: Game, target: string, minimum = 4) {
  const asked = ask(source, f, { kind: 'earlyRicheseBid', target, turn: source.turn, minimum });
  assert.ok(viewGame(asked, target).truthEarlyRicheseBidAnswers?.includes('yes'));
  return passTruthRicheseFreshDiscard(act(asked, target, { type: 'truthAnswer', answer: 'yes' }));
}

function rejects(source: Game, actor: string, action: Action) {
  const before = structuredClone(source);
  assert.throws(() => act(source, actor, action));
  assert.deepEqual(source, before, 'A rejected action must leave its input unchanged');
}

function onceAround(source: Game) {
  return advance(source, game => clean(game) && game.richeseAuction?.source === 'cache' &&
    game.richeseAuction.method === 'onceAround' && !game.richeseAuction.outcome,
  [], { position: 'first', method: 'onceAround' });
}

void test('an early funded Yes rejects an otherwise legal bribe that spends its last bid funds', () => {
  const f = fixture({ advanced: false });
  const bound = bind(f, structuredClone(f.earlySource), f.emperor);
  assert.equal(player(bound, f.emperor).spice, 10);
  rejects(bound, f.emperor, { type: 'bribe', target: f.asker, amount: 7 });
  const affordable = act(bound, f.emperor, { type: 'bribe', target: f.asker, amount: 6 });
  assert.equal(player(affordable, f.emperor).spice, 4);
  assert.ok(affordable.earlyRicheseBidPromises?.some(row => row.player === f.emperor &&
    row.answer && !row.boundEvent && !row.released));
  assert.deepEqual(inventory(affordable), f.originalCards);
});

void test('a voluntary ordinary bid cannot eliminate the last cache hand slot for a waiting Yes', () => {
  const f = fixture({ advanced: false });
  const staged = structuredClone(f.earlySource);
  // Controlled physical supplement: transfer two original unopened ordinary
  // cards to Emperor before the question, preserving every card and position.
  for (let count = 0; count < 2; count++) {
    const index = staged.deck.findIndex(card => card.id !== f.ordinaryLot);
    assert.ok(index >= 0);
    player(staged, f.emperor).hand.push(staged.deck.splice(index, 1)[0]);
  }
  assert.equal(player(staged, f.emperor).hand.length, 3);
  assert.deepEqual(inventory(staged), f.originalCards);
  const bound = bind(f, staged, f.emperor);
  const current = advance(bound, game => clean(game) && game.phase === 3 &&
    game.auction?.active === f.emperor, [], { position: 'last' });
  rejects(current, f.emperor, { type: 'bid', amount: 1, allyPayment: 0 });
  assert.ok(current.earlyRicheseBidPromises?.some(row => row.player === f.emperor && !row.released));
  assert.deepEqual(inventory(current), f.originalCards);
});

void test('an external printed Karama canceling the cache releases the waiting Yes', () => {
  const f = fixture({ advanced: false });
  const staged = structuredClone(f.earlySource);
  // Controlled physical supplement: the actual printed Karama moves from the
  // unopened main deck to Atreides before the original Truthtrance is played.
  const index = staged.deck.findIndex(card => card.effect === 'karama'); assert.ok(index >= 0);
  const card = staged.deck.splice(index, 1)[0];
  player(staged, f.asker).hand.push(card);
  assert.deepEqual(inventory(staged), f.originalCards);
  const bound = bind(f, staged, f.emperor);
  const declaration = advance(bound, game => game.decision?.kind === 'richeseDeclaration');
  const opened = act(declaration, f.richese, { type: 'decision', event: declaration.richeseBidding!.event, position: 'first' });
  assert.equal(opened.response?.kind, 'richeseAuction');
  let canceled = act(opened, f.asker, { type: 'card', card: card.id, mode: 'cancel' });
  canceled = passTruthRicheseFreshDiscard(canceled);
  assert.equal(canceled.richeseBidding?.cacheCanceled, true);
  assert.ok(canceled.earlyRicheseBidPromises?.some(row => row.player === f.emperor && row.released));
  assert.deepEqual(inventory(canceled), f.originalCards);
});

void test('a waiting Richese owner may honor a Yes when a rival starts the Once Around lot', () => {
  const f = fixture({ advanced: false });
  const bound = bind(f, structuredClone(f.earlySource), f.richese);
  let game = onceAround(bound);
  const event = game.richeseAuction!.event;
  assert.ok(game.richeseBidPromises?.some(row => row.event === event && row.player === f.richese &&
    row.answer && !row.released));
  const first = game.richeseAuction!.active; assert.ok(first && first !== f.richese);
  game = act(game, first, { type: 'richeseBid', event, amount: 1, allyPayment: 0 });
  while (game.richeseAuction?.active && game.richeseAuction.active !== f.richese) {
    const actor = game.richeseAuction.active;
    game = act(game, actor, { type: 'richeseBid', event, amount: null });
  }
  assert.equal(game.richeseAuction?.active, f.richese);
  rejects(game, f.richese, { type: 'richeseBid', event, amount: null });
  const guide = viewGame(game, f.richese).richeseBidPromiseGuide; assert.ok(guide);
  assert.equal(guide.action.amount, 4);
  const bid = act(game, f.richese, guide.action);
  assert.ok(bid.richeseBidPromises?.some(row => row.event === event && row.player === f.richese && row.fulfilled));
  assert.deepEqual(inventory(bid), f.originalCards);
});

void test('a waiting Richese owner is released when all rivals pass the Once Around lot', () => {
  const f = fixture({ advanced: false });
  const bound = bind(f, structuredClone(f.earlySource), f.richese);
  const opened = onceAround(bound), event = opened.richeseAuction!.event;
  const closed = advance(opened, game => !!game.richeseBidPromises?.some(row =>
    row.event === event && row.player === f.richese && row.released));
  assert.deepEqual(inventory(closed), f.originalCards);
});
