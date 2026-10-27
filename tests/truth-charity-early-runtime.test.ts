import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { advanceTruthCharityPayments } from './fixture-truth-charity-payments';
import { actTruthtranceChoamPromises as actChoam, advanceTruthtranceChoamPromises as advanceChoam,
  createTruthtranceChoamPromisesFixture as choamFixture, truthtranceChoamPromisesInventory as choamInventory,
  truthtranceChoamPromisesPlayer as choamPlayer } from './fixture-truthtrance-choam-promises';
import { act, askTruthCharityEarly as ask, bindTruthCharityEarly as bind, clean,
  createTruthCharityEarlyFixture as fixture, declareTruthCharityEarly as declare,
  inventory, player, reachEarlyCharity as reach, rejectTruthCharityEarly as reject } from './fixture-truth-charity-early';

for (const phase of [0,1] as const) {
  void test(`Basic phase ${phase} Charity Yes survives native openings and uses its real later claim`, () => {
    const f = fixture(phase), {asked,game:bound} = bind(f,'yes');
    assert.equal(viewGame(asked,f.asker).truthCharityAnswers,null);
    assert.deepEqual(bound.ready,asked.ready,'Answering does not reopen readiness in an earlier phase');
    assert.equal(viewGame(bound,f.target).truthCharityGuide,null);
    assert.ok(viewGame(bound,f.target).truthCharityPromises.some(row => row.answer && !row.fulfilled && !row.released));
    assert.equal(bound.discard.filter(card => card.id === f.truth).length,1);
    const charity = reach(bound);
    assert.equal(charity.phase,2);
    assert.ok(viewGame(charity,f.target).truthCharityPromises.some(row => row.answer && !row.fulfilled && !row.released));
    reject(charity,f.target,{type:'ready'});
    const guide = viewGame(charity,f.target).truthCharityGuide; assert.ok(guide);
    let game = act(charity,f.target,guide.action);
    if (guide.action.type === 'bribe') {
      assert.ok(player(game,f.target).spice < 2);
      const claim = viewGame(game,f.target).truthCharityGuide; assert.ok(claim);
      assert.equal(claim.action.type,'charity');
      game = act(game,f.target,claim.action);
    }
    assert.equal(player(game,f.target).charityTurn,game.turn);
    assert.ok(viewGame(game,f.target).truthCharityPromises.some(row => row.answer && row.fulfilled));
    assert.deepEqual(inventory(game),f.originalCards);
  });

  void test(`Basic phase ${phase} Charity No remains binding until the actual later phase closes`, () => {
    const f = fixture(phase), {asked,game:bound} = bind(f,'no');
    assert.deepEqual(bound.ready,asked.ready);
    assert.equal(viewGame(bound,f.target).truthCharityGuide,null);
    assert.ok(viewGame(bound,f.target).truthCharityPromises.some(row => !row.answer && !row.fulfilled && !row.released));
    let game = reach(bound);
    assert.equal(game.phase,2);
    assert.ok(viewGame(game,f.target).truthCharityPromises.some(row => !row.answer && !row.fulfilled));
    // Earn eligibility by the real ordinary payment, so rejecting a physical
    // claim proves the answered No rather than the ordinary wealth threshold.
    const amount = player(game,f.target).spice - 1;
    assert.ok(amount > 0);
    game = act(game,f.target,{type:'bribe',target:f.asker,amount});
    assert.equal(player(game,f.target).spice,1);
    reject(game,f.target,{type:'charity'});
    game = act(game,f.target,{type:'ready'});
    for (const seat of game.players) if (game.phase === 2 && !game.ready.includes(seat.id))
      game = act(game,seat.id,{type:'ready'});
    assert.notEqual(game.phase,2);
    assert.equal(player(game,f.target).charityTurn,undefined);
    assert.deepEqual(inventory(game),f.originalCards);
  });
}

void test('An earlier-phase Charity answer preserves an actual prior Spice Blow Ready', () => {
  const f = fixture(1);
  const blow = advanceTruthCharityPayments(f.game,g => !!g.spiceWindow && clean(g),[],true);
  const ready = act(blow,f.target,{type:'ready'});
  assert.ok(ready.ready.includes(f.target));
  const {asked,game:bound} = bind(f,'yes',ready);
  assert.ok(asked.ready.includes(f.target));
  assert.deepEqual(bound.ready,asked.ready,'Only the future Charity Ready may be reopened');
  const charity = reach(bound);
  assert.equal(charity.phase,2);
  assert.ok(viewGame(charity,f.target).truthCharityGuide);
});

void test('Earlier-phase stale turns and foreign answers reject without changes', () => {
  const f = fixture(1), declared = declare(f);
  reject(declared,f.asker,{type:'truthAsk',question:{...f.charityQuestion,turn:f.game.turn+1}});
  const asked = ask(f);
  reject(asked,f.asker,{type:'truthAnswer',answer:'yes'});
  assert.deepEqual(inventory(asked),f.originalCards);
});

void test('All four bots answer early and follow the later native Charity guide', () => {
  const f = fixture(1), asked = ask(f);
  for (const difficulty of DIFFICULTIES) {
    const projected = viewGame(asked,f.target);
    projected.players.find(row => row.id === f.target)!.bot = difficulty;
    const answer = botActions(projected)[0]; assert.ok(answer,difficulty);
    assert.equal(answer.type,'truthAnswer');
    assert.ok(projected.truthCharityAnswers?.includes(answer.answer as 'yes'|'no'));
    let game = act(structuredClone(asked),f.target,answer);
    assert.equal(viewGame(game,f.target).truthCharityGuide,null);
    game = reach(game);
    const own = viewGame(game,f.target); own.players.find(row => row.id === f.target)!.bot = difficulty;
    if (answer.answer === 'yes') {
      assert.ok(own.truthCharityGuide);
      assert.deepEqual(botActions(own)[0],own.truthCharityGuide.action);
      game = act(game,f.target,own.truthCharityGuide.action);
      const claim = viewGame(game,f.target).truthCharityGuide;
      if (claim) game = act(game,f.target,claim.action);
      assert.equal(player(game,f.target).charityTurn,game.turn);
    } else {
      const action = botActions(own)[0]; assert.ok(action,difficulty);
      game = act(game,f.target,action);
    }
    assert.deepEqual(inventory(game),f.originalCards);
  }
});

void test('An early CHOAM Charity question does not invent an unanswered opening income', () => {
  // Original native Basic four-seat CHOAM setup and unopened physical deals;
  // CHOAM's earned opening is deliberately not allowed, canceled or credited.
  const f=choamFixture(), source=structuredClone(f.game);
  assert.equal(source.phase,0); assert.equal(source.choamCharity,undefined);
  assert.equal(choamPlayer(source,f.target).spice,f.rawCash);
  let game=actChoam(source,f.asker,{type:'card',card:f.truth});
  while (game.truthtrance?.stage === 'priority') {
    const actor=game.players.find(row => !game.truthtrance!.passed.includes(row.id)); assert.ok(actor);
    game=actChoam(game,actor.id,{type:'truthPass'});
  }
  assert.equal(game.truthtrance?.stage,'ask');
  game=actChoam(game,f.asker,{type:'truthAsk',question:{kind:'charity',target:f.target,turn:game.turn}});
  const own=viewGame(game,f.target);
  assert.ok(own.truthCharityAnswers?.includes('no'));
  assert.ok(!own.truthCharityAnswers?.includes('yes'),'A not-yet-resolved CHOAM opening is not guaranteed income');
  assert.equal(viewGame(game,f.asker).truthCharityAnswers,null);
  assert.equal(choamPlayer(game,f.target).spice,f.rawCash);
  assert.equal(game.choamCharity,undefined);
  const before=structuredClone(game);
  assert.throws(() => actChoam(game,f.target,{type:'truthAnswer',answer:'yes'}));
  assert.deepEqual(game,before);
  game=actChoam(game,f.target,{type:'truthAnswer',answer:'no'});
  assert.equal(choamPlayer(game,f.target).spice,f.rawCash);
  assert.equal(game.choamCharity,undefined);
  assert.ok(viewGame(game,f.target).truthCharityPromises.some(row => !row.answer && !row.fulfilled && !row.released));
  const opening=advanceChoam(game,state => state.response?.kind === 'choamCharity');
  assert.equal(opening.response?.kind,'choamCharity');
  assert.equal(opening.response.owner,f.target);
  assert.equal(opening.choamCharity,undefined);
  assert.equal(choamPlayer(opening,f.target).spice,f.rawCash);
  assert.deepEqual(choamInventory(opening),f.originalInventory);
});
