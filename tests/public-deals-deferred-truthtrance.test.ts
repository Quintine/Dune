import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import {
  actMentatBribe as act, askMentatBribe as ask,
  createMentatBribeFixture as fixture, declareMentatBribe as declare,
  mentatBribeInventory as inventory, mentatBribePlayer as player,
} from './fixture-mentat-bribes';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => act(game, actor, action));
  assert.deepEqual(game, before, 'A rejected answer or action must not mutate the source.');
}
function offer(game: Game, asker: string, target: string, amount: number) {
  game = act(game, asker, { type: 'dealOffer', target, terms: 'A payment before this turn ends.',
    payment: { kind: 'deferredBribe', payer: target, recipient: asker, amount, dueTurn: game.turn } });
  const id = game.deals!.at(-1)!.id;
  return { game: act(game, target, { type: 'dealRespond', deal: id, accept: true }), id };
}
function openQuestion(f: ReturnType<typeof fixture>, game: Game, minimum: number) {
  const opened = declare(f, game);
  return ask(opened.game, f.asker, f.target, f.asker, minimum);
}

/** Genuine Basic H/A/E turn-one Mentat; the fixture preorders unopened cards,
 * not an already-dealt hand, purse, promise, battle, or phase. */
void test('a matching Truthtrance Yes remains legal and a conflicting No is not offered', () => {
  const f = fixture(), agreed = offer(f.game, f.asker, f.target, 3);
  const asked = openQuestion(f, agreed.game, 3);
  const options = viewGame(asked, f.target).truthBribeAnswers;
  assert.ok(options);
  assert.ok(options.includes('yes'));
  assert.ok(!options.includes('no'), 'A no answer cannot contradict the earlier accepted exact payment.');
  rejected(asked, f.target, { type: 'truthAnswer', answer: 'no' });
  let game = act(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
  assert.ok(game.bribePromises?.some(row => row.player === f.target && row.recipient === f.asker && row.answer && !row.fulfilled));
  game = act(game, f.target, { type: 'dealPay', deal: agreed.id });
  assert.equal(game.deals!.find(row => row.id === agreed.id)!.paymentStatus, 'paid');
  assert.ok(game.bribePromises?.some(row => row.player === f.target && row.recipient === f.asker && row.fulfilled));
  assert.equal(player(game, f.target).spice, 7);
  assert.equal(player(game, f.asker).bribes, 3);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('one payment can satisfy a Truthtrance minimum but cannot satisfy two distinct deals', () => {
  const f = fixture(), first = offer(f.game, f.asker, f.target, 3);
  const second = offer(first.game, f.asker, f.target, 3);
  const asked = openQuestion(f, second.game, 3);
  assert.ok(viewGame(asked, f.target).truthBribeAnswers?.includes('yes'));
  let game = act(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
  game = act(game, f.target, { type: 'dealPay', deal: first.id });
  assert.ok(game.bribePromises?.some(row => row.player === f.target && row.recipient === f.asker && row.fulfilled));
  assert.equal(game.deals!.find(row => row.id === first.id)!.paymentStatus, 'paid');
  assert.equal(game.deals!.find(row => row.id === second.id)!.paymentStatus, 'pending');
  rejected(game, f.target, { type: 'ready' });
  game = act(game, f.target, { type: 'dealPay', deal: second.id });
  assert.equal(game.deals!.find(row => row.id === second.id)!.paymentStatus, 'paid');
  assert.equal(player(game, f.target).spice, 4);
  assert.equal(player(game, f.asker).bribes, 6);
  assert.deepEqual(inventory(game), f.originalCards);
});
