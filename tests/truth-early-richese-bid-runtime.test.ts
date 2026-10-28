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

/** Stop at actual Charity: the existing fixture only orders original unopened
 * cards and Spice Cards; setup, starting hands, funding and phases are real. */
function begin(answer: 'yes' | 'no') {
  const f = fixture({ advanced: false });
  const source = structuredClone(f.earlySource);
  const question = { kind: 'earlyRicheseBid' as const, target: f.emperor,
    turn: source.turn, minimum: 4 };
  const asked = ask(source, f, question);
  assert.ok(viewGame(asked, f.emperor).truthEarlyRicheseBidAnswers?.includes(answer));
  const bound = passTruthRicheseFreshDiscard(act(asked, f.emperor, { type: 'truthAnswer', answer }));
  assert.equal(bound.discard.filter(card => card.id === f.truth).length, 1);
  assert.deepEqual(inventory(bound), f.originalCards);
  return { f, bound, asked };
}

function reachLot(source: Game, method: 'onceAround' | 'silent', position: 'first' | 'last') {
  return advance(source, game => clean(game) && !!game.richeseAuction &&
    game.richeseAuction.source === 'cache' && game.richeseAuction.method === method &&
    !game.richeseAuction.outcome, [], { position, method });
}

function reachTarget(source: Game, target: string, method: 'onceAround' | 'silent') {
  if (method === 'silent') return source;
  return advance(source, game => clean(game) && game.richeseAuction?.active === target);
}

function reject(source: Game, actor: string, action: Action) {
  const before = structuredClone(source);
  assert.throws(() => act(source, actor, action));
  assert.deepEqual(source, before, 'A rejected action leaves the original state intact');
}

for (const method of ['onceAround', 'silent'] as const) {
  for (const position of ['first', 'last'] as const) {
    void test(`Basic early Richese Yes reaches a real ${position} ${method} lot and requires its qualifying bid`, () => {
      const { f, bound } = begin('yes');
      const lot = reachLot(bound, method, position);
      assert.equal(lot.richeseAuction?.source, 'cache');
      const event = lot.richeseAuction!.event, card = lot.richeseAuction!.cardId;
      assert.ok(event);
      let current = reachTarget(lot, f.emperor, method);
      assert.ok(current.richeseBidPromises?.some(row => row.event === event &&
        row.player === f.emperor && row.answer && !row.fulfilled && !row.released));
      reject(current, f.emperor, { type: 'richeseBid', event, amount: method === 'silent' ? 0 : null });
      reject(current, f.emperor, { type: 'richeseBid', event, amount: 3, allyPayment: 0 });
      const guide = viewGame(current, f.emperor).richeseBidPromiseGuide;
      assert.ok(guide); assert.equal(guide.action.type, 'richeseBid');
      assert.equal(guide.action.event, event); assert.equal(guide.action.amount, 4);
      current = act(current, f.emperor, guide.action);
      assert.ok(current.richeseBidPromises?.some(row => row.event === event && row.player === f.emperor && row.fulfilled));
      const won = advance(current, game => player(game, f.emperor).hand.some(item => item.id === card));
      assert.ok(!won.richeseCache?.some(item => item.id === card));
      assert.deepEqual(inventory(won), f.originalCards);
    });

    void test(`Basic early Richese No limits a real ${position} ${method} cache bid`, () => {
      const { f, bound } = begin('no');
      const opened = reachLot(bound, method, position);
      const event = opened.richeseAuction!.event;
      const current = reachTarget(opened, f.emperor, method);
      assert.ok(current.richeseBidPromises?.some(row => row.event === event && row.player === f.emperor && !row.answer));
      reject(current, f.emperor, { type: 'richeseBid', event, amount: 4, allyPayment: 0 });
      const bid = act(current, f.emperor, { type: 'richeseBid', event, amount: 2, allyPayment: 0 });
      assert.ok(bid.richeseBidPromises?.some(row => row.event === event && row.player === f.emperor && row.fulfilled));
      assert.deepEqual(inventory(bid), f.originalCards);
    });
  }
}

void test('all four legal bot profiles answer an early Richese question and follow the actual lot guide', () => {
  const { f, asked } = begin('yes');
  for (const difficulty of DIFFICULTIES) {
    const answerView = viewGame(asked, f.emperor);
    answerView.players.find(row => row.id === f.emperor)!.bot = difficulty;
    const answer = botActions(answerView)[0];
    assert.equal(answer?.type, 'truthAnswer');
    assert.ok(answer.answer === 'yes' || answer.answer === 'no');
    const bound = passTruthRicheseFreshDiscard(act(structuredClone(asked), f.emperor, answer));
    const opened = reachLot(bound, 'silent', 'first');
    const bidView = viewGame(opened, f.emperor);
    bidView.players.find(row => row.id === f.emperor)!.bot = difficulty;
    const guide = bidView.richeseBidPromiseGuide; assert.ok(guide);
    const bid = botActions(bidView)[0]; assert.deepEqual(bid, guide.action);
    const complete = act(opened, f.emperor, bid);
    assert.ok(complete.richeseBidPromises?.some(row => row.player === f.emperor && row.fulfilled));
    assert.deepEqual(inventory(complete), f.originalCards);
  }
});
