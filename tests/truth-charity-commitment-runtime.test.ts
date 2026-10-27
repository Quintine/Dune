import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { charityQuote } from '../game/charity';
import { declareTruthCharityPayments } from './fixture-truth-charity-payments';
import { viewGame } from '../game/engine';
import { act, askTruthCharityCommitment as ask, bindTruthCharityCommitment as bind,
  createTruthCharityCommitmentFixture as fixture, inventory, player, rejectTruthCharityCommitment as reject } from './fixture-truth-charity-commitment';

void test('Basic eligible Charity Yes reopens ready and requires one actual native claim', () => {
  const f = fixture();
  const source = act(f.game, f.target, { type: 'ready' });
  assert.ok(source.ready.includes(f.target));
  const { asked, game: bound } = bind(f, 'yes', source);
  assert.equal(viewGame(asked, f.asker).truthCharityAnswers, null);
  assert.ok(!bound.ready.includes(f.target));
  assert.equal(bound.discard.filter(card => card.id === f.truth).length, 1);
  assert.equal(player(bound, f.target).charityTurn, undefined);
  reject(bound, f.target, { type: 'ready' });
  const guide = viewGame(bound, f.target).truthCharityGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'charity');
  const claimed = act(bound, f.target, guide.action);
  assert.equal(player(claimed, f.target).charityTurn, claimed.turn);
  assert.equal(player(claimed, f.target).spice, 2);
  assert.equal(charityQuote(claimed, player(claimed, f.target)).total, 0);
  reject(claimed, f.target, { type: 'charity' });
  const ready = act(claimed, f.target, { type: 'ready' });
  assert.ok(ready.ready.includes(f.target));
  assert.deepEqual(inventory(ready), f.originalCards);
});

void test('Basic Charity No prohibits the claim through ready and normal phase close', () => {
  const f = fixture(); const source = act(f.game, f.target, { type: 'ready' });
  const { game: bound } = bind(f, 'no', source);
  assert.ok(!bound.ready.includes(f.target));
  reject(bound, f.target, { type: 'charity' });
  let game = act(bound, f.target, { type: 'ready' });
  assert.ok(game.ready.includes(f.target));
  reject(game, f.target, { type: 'charity' });
  // A second actual Truthtrance answer reopens concurrent Basic readiness.
  // The first No must still forbid claiming through the same Charity phase.
  game = bind(f, 'no', game, 1).game;
  assert.ok(!game.ready.includes(f.target));
  reject(game, f.target, { type: 'charity' });
  game = act(game, f.target, { type: 'ready' });
  for (const p of game.players) if (!game.ready.includes(p.id) && game.phase === 2)
    game = act(game, p.id, { type: 'ready' });
  assert.notEqual(game.phase, 2);
  assert.equal(player(game, f.target).charityTurn, undefined);
  assert.equal(player(game, f.target).spice, 1);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('Basic stale Charity questions and wrong answerers cannot change the native phase', () => {
  const f = fixture();
  const declared = declareTruthCharityPayments(f).game;
  reject(declared, f.asker, { type: 'truthAsk', question: { ...f.charityQuestion, turn: f.game.turn + 1 } });
  const asked = ask(f);
  reject(asked, f.asker, { type: 'truthAnswer', answer: 'yes' });
  assert.deepEqual(inventory(asked), f.originalCards);
});

void test('Basic all four minimal bot profiles answer and use an allowed Charity continuation', () => {
  const f = fixture(); const asked = ask(f);
  for (const difficulty of DIFFICULTIES) {
    const answerView = viewGame(asked, f.target);
    answerView.players.find(row => row.id === f.target)!.bot = difficulty;
    const answer = botActions(answerView)[0]; assert.ok(answer, difficulty);
    assert.equal(answer.type, 'truthAnswer');
    assert.ok(answerView.truthCharityAnswers?.includes(answer.answer as 'yes' | 'no'));
    const bound = act(structuredClone(asked), f.target, answer);
    if (answer.answer === 'yes') {
      const own = viewGame(bound, f.target); own.players.find(row => row.id === f.target)!.bot = difficulty;
      assert.ok(own.truthCharityGuide);
      const choice = botActions(own)[0]; assert.deepEqual(choice, own.truthCharityGuide.action);
      const after = act(bound, f.target, choice);
      assert.equal(player(after, f.target).charityTurn, after.turn);
      assert.deepEqual(inventory(after), f.originalCards);
    } else {
      reject(bound, f.target, { type: 'charity' });
      const own = viewGame(bound, f.target); own.players.find(row => row.id === f.target)!.bot = difficulty;
      const choice = botActions(own)[0]; assert.ok(choice, difficulty);
      const after = act(bound, f.target, choice);
      assert.deepEqual(inventory(after), f.originalCards);
    }
  }
});

void test('Basic Charity Yes at five spice guides an actual bribe and claim; its guide cannot replay against No', () => {
  const f = fixture();
  // This is the actual pre-bribe native source, with five spendable spice.
  assert.equal(player(f.unprepared, f.target).spice, 5);
  const asked = ask(f, f.unprepared);
  assert.ok(viewGame(asked, f.target).truthCharityAnswers?.includes('yes'));
  const yes = act(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
  reject(yes, f.target, { type: 'ready' });
  const bribe = viewGame(yes, f.target).truthCharityGuide; assert.ok(bribe);
  assert.equal(bribe.action.type, 'bribe');
  assert.ok(typeof bribe.action.amount === 'number' && bribe.action.amount >= 4);
  const paid = act(yes, f.target, bribe.action);
  assert.ok(player(paid, f.target).spice < 2);
  assert.ok(viewGame(paid, f.target).truthCharityPromises.some(row => row.answer && !row.fulfilled && !row.released));
  reject(paid, f.target, bribe.action);
  const claim = viewGame(paid, f.target).truthCharityGuide; assert.ok(claim);
  assert.equal(claim.action.type, 'charity');
  const claimed = act(paid, f.target, claim.action);
  assert.equal(player(claimed, f.target).charityTurn, claimed.turn);
  assert.ok(viewGame(claimed, f.target).truthCharityPromises.some(row => row.answer && row.fulfilled));
  assert.deepEqual(inventory(claimed), f.originalCards);

  // The same actual question has a separate valid No continuation; a normal
  // bribe remains legal here, so rejecting the old Yes packet requires its
  // original guide identity, not simply a no-bribes rule.
  const no = act(asked, f.target, { type: 'truthAnswer', answer: 'no' });
  reject(no, f.target, bribe.action);
  const ordinaryBribe = act(no, f.target, { type: 'bribe', target: f.asker, amount: 1 });
  assert.equal(player(ordinaryBribe, f.target).spice, 4);
  assert.deepEqual(inventory(ordinaryBribe), f.originalCards);
});

void test('A controlled external spice gain retains Charity Yes while an actual bribe route remains', () => {
  const f = fixture(); const bound = bind(f, 'yes').game;
  assert.equal(player(bound, f.target).spice, 1);
  // Controlled supplement: transfer three actual spice between two seated
  // wallets, representing an external gain. The native fixture makes Emperor
  // the respondent, so it cannot receive its own allied Emperor gift. No card,
  // phase, readiness or promise is manufactured; the sum stays unchanged.
  const changed = structuredClone(bound);
  const donor = changed.players.find(p => p.id !== f.target && p.spice >= 3); assert.ok(donor);
  const total = changed.players.reduce((sum, p) => sum + p.spice, 0);
  donor.spice -= 3; player(changed, f.target).spice += 3;
  assert.equal(changed.players.reduce((sum, p) => sum + p.spice, 0), total);
  const observer = changed.players.find(p => p.id !== f.target && !changed.ready.includes(p.id)); assert.ok(observer);
  const reconciled = act(changed, observer.id, { type: 'ready' });
  assert.equal(player(reconciled, f.target).spice, 4);
  assert.ok(viewGame(reconciled, f.target).truthCharityPromises.some(row => row.answer && !row.fulfilled && !row.released));
  reject(reconciled, f.target, { type: 'ready' });
  const bribe = viewGame(reconciled, f.target).truthCharityGuide; assert.ok(bribe);
  assert.equal(bribe.action.type, 'bribe');
  const paid = act(reconciled, f.target, bribe.action);
  assert.ok(player(paid, f.target).spice < 2);
  const claim = viewGame(paid, f.target).truthCharityGuide; assert.ok(claim);
  assert.equal(claim.action.type, 'charity');
  const completed = act(paid, f.target, claim.action);
  assert.equal(player(completed, f.target).charityTurn, completed.turn);
  assert.deepEqual(inventory(completed), f.originalCards);
});
