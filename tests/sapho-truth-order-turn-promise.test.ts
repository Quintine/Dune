import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Game } from '../game/engine';
import { act, inventory, player, createSaphoTruthOrderFixture,
  passFreshDiscard, truthOrderFrame, finishTruthOrder, finishOriginalTruthQuestions } from './fixture-sapho-truth-order';

/** Declare one original Truth, allowing every other player to pass the original
 * neutral priority. The caller chooses the actual question afterwards. */
function declare(game: Game, actor: string, card: string) {
  game = act(game,actor,{type:'card',card});
  while (game.truthtrance?.stage === 'priority') {
    const seat = game.players.find(row => !game.truthtrance!.passed.includes(row.id)); assert.ok(seat);
    game = act(game,seat.id,{type:'truthPass'});
  }
  assert.equal(game.truthtrance?.stage,'ask');
  return game;
}

void test('Sapho Truth-order disposal cannot consume the last card needed by an earlier Distrans Yes', () => {
  const f = createSaphoTruthOrderFixture({advanced:true,mode:'first'});
  let game = structuredClone(f.before);
  const owner = player(game,f.owner), cache = game.richeseCache;
  assert.ok(cache);
  // Controlled, conserved custody supplement on top of the original public
  // setup and earned Sapho: give the owner the physical cached Distrans, and
  // put any other unneeded held cards in the original deck. The owner retains
  // exactly their real Sapho, original dealt Truth and Distrans. No resources,
  // phases, promises, auction records or extra cards are manufactured.
  const at = cache.findIndex(card => card.effect === 'distrans'); assert.ok(at >= 0);
  const [distrans] = cache.splice(at,1);
  const retained = owner.hand.filter(card => card.id === f.card || card.id === f.truth);
  const returned = owner.hand.filter(card => card.id !== f.card && card.id !== f.truth);
  owner.hand = [...retained,distrans]; game.deck.push(...returned);
  assert.equal(owner.hand.length,3);
  assert.deepEqual(inventory(game),f.originalCards);

  // Ask the earlier obligation through the real Truthtrance engine. At this
  // moment the owner's other physical Truth card can legally be transferred;
  // Sapho is another real alternative, so a Yes has a native completion.
  game = declare(game,f.other,f.otherTruth);
  game = act(game,f.other,{type:'truthAsk',question:{kind:'turnActions',target:f.owner,turn:game.turn,
    mixed:{kind:'action',action:{kind:'cardPlay',effect:'distrans'}}}});
  assert.ok(viewGame(game,f.owner).truthTurnActionAnswers?.includes('yes'));
  game = act(game,f.owner,{type:'truthAnswer',answer:'yes'});
  game = passFreshDiscard(game);
  assert.ok(game.turnActionPromises?.some(row => row.player === f.owner && row.answer && !row.fulfilled && !row.released));
  assert.deepEqual(inventory(game),f.originalCards);
  const quote = viewGame(game,f.owner).distrans;
  assert.ok(quote && !quote.blocked);
  const recipient = quote.choices.find(row => !row.blocked && row.cards.some(card => card.id === f.card));
  assert.ok(recipient,'The original physical Sapho is a legal Distrans transfer');
  let completed = act(structuredClone(game),f.owner,{type:'card',card:distrans.id,
    target:recipient.recipient,give:f.card});
  completed = passFreshDiscard(completed);
  assert.ok(completed.turnActionPromises?.some(row => row.player === f.owner && row.fulfilled),
    'The earlier Yes has an actual legal physical transfer route before reordering');
  assert.deepEqual(inventory(completed),f.originalCards);

  // The previously played original Truth is moved from the discard back to
  // its original holder solely to construct two simultaneous questions.
  // This is a labeled controlled card-custody setup, not a claimed native
  // recovery; physical inventory and the already-bound answer are preserved.
  const atDiscard = game.discard.findIndex(card => card.id === f.otherTruth); assert.ok(atDiscard >= 0);
  const [priorTruth] = game.discard.splice(atDiscard,1);
  player(game,f.other).hand.push(priorTruth);
  assert.deepEqual(inventory(game),f.originalCards);

  // Both original Truth cards now become committed physical questions. The
  // owner's Truth is reserved, leaving Sapho as the only card Distrans can
  // transfer after this window. Reordering by discarding Sapho must not erase
  // the earlier Yes or strand the question queue.
  game = act(game,f.owner,{type:'card',card:f.truth});
  game = act(game,f.other,{type:'card',card:f.otherTruth});
  while (game.truthtrance?.stage === 'priority') {
    const seat = game.players.find(row => !game.truthtrance!.passed.includes(row.id)); assert.ok(seat);
    game = act(game,seat.id,{type:'truthPass'});
  }
  const frame = truthOrderFrame(game), prior = structuredClone(game.turnActionPromises);
  const choices = viewGame(game,f.owner).saphoTruthOrderChoices;
  assert.ok(!choices.some(row => row.card === f.card && row.mode === 'first'),
    'A displayed choice must retain a completion of the earlier Yes');
  const original = structuredClone(game);
  assert.throws(() => act(game,f.owner,{type:'saphoTruthOrder',event:frame.event,revision:frame.revision,
    card:f.card,mode:'first'}));
  assert.deepEqual(game,original,'Rejected action must not mutate the original game');
  assert.deepEqual(game.turnActionPromises,prior);
  assert.ok(player(game,f.owner).hand.some(card => card.id === f.card));
  assert.deepEqual(inventory(game),f.originalCards);

  // Both holders can decline to reorder; resolve both actual queued questions
  // and then complete the preserved earlier promise by transferring Sapho.
  game = finishOriginalTruthQuestions(finishTruthOrder(game));
  assert.equal(game.truthtrance,null);
  assert.ok(game.turnActionPromises?.some(row => row.player === f.owner && row.answer && !row.fulfilled && !row.released));
  const laterQuote = viewGame(game,f.owner).distrans;
  assert.ok(laterQuote && !laterQuote.blocked);
  const laterRecipient = laterQuote.choices.find(row => !row.blocked && row.cards.some(card => card.id === f.card));
  assert.ok(laterRecipient,'The preserved Sapho remains a real legal Distrans transfer');
  game = act(game,f.owner,{type:'card',card:distrans.id,target:laterRecipient.recipient,give:f.card});
  game = passFreshDiscard(game);
  assert.ok(game.turnActionPromises?.some(row => row.player === f.owner && row.fulfilled && !row.released));
  assert.ok(player(game,laterRecipient.recipient).hand.some(card => card.id === f.card));
  assert.deepEqual(inventory(game),f.originalCards);
});
