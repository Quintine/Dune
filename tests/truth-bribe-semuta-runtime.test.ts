import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Game, type Action } from '../game/engine';
import type { TruthQuestion, TruthAnswer } from '../game/truthtrance';
import { DIFFICULTIES } from '../game/bot-profiles';
import { botActions } from '../game/bots';
import { createTruthSemutaPrebidFixture, declareTruthTransferOrderPlay,
  actTruthTransferOrderPlay as act, truthTransferOrderPlayInventory as inventory,
  truthTransferOrderPlayPlayer as player } from './fixture-truth-transfer-order-play';
import { passFreshDiscard } from './fixture-sapho-truth-order';

/** Native Basic Richese/Guild/Atreides/Emperor game: original Truths are dealt in
 * setup, Guild actually spends Distrans, completes the turn, then purchases
 * the original Semuta from Richese's actual cache for one spice. The fixture
 * selects unopened original deal positions and native lotteries; no card,
 * funds, phase, paid transaction or Semuta holder is installed. */
function source() {
  const f = createTruthSemutaPrebidFixture();
  assert.equal(f.game.advanced,false); assert.equal(f.game.semutaPreview,true);
  assert.ok(player(f.game,f.target).hand.some(card => card.id === f.semuta));
  assert.equal(f.game.truthtrance ?? null,null); assert.equal(f.game.pendingTreacheryDiscard ?? null,null);
  assert.ok(player(f.game,f.target).spice >= 2);
  assert.equal(player(f.game,f.target).ally,null);
  assert.deepEqual(inventory(f.game),f.originalCards);
  return f;
}
type Family = 'bribe' | 'bribeExpression' | 'mixedBribe';
function question(f: ReturnType<typeof source>, family: Family): TruthQuestion {
  const target=f.target, turn=f.game.turn, recipient=f.asker;
  const other = f.game.players.find(row => row.id !== target && row.id !== recipient)!.id;
  if (family === 'bribe') return {kind:'bribe',target,turn,recipient,minimum:2};
  if (family === 'bribeExpression') return {kind:'bribeExpression',target,turn,claim:{kind:'and',terms:[
    {kind:'payment',recipient,minimum:1},{kind:'payment',recipient:other,minimum:1},
  ]}};
  return {kind:'mixedBribe',target,turn,mixed:{kind:'and',terms:[
    {kind:'fact',fact:{kind:'spice',compare:'gte',value:0}},
    {kind:'action',action:{recipient,minimum:2}},
  ]}};
}
function ask(f: ReturnType<typeof source>, family: Family) {
  const declared = declareTruthTransferOrderPlay(f).game;
  return act(declared,f.asker,{type:'truthAsk',question:question(f,family)});
}
function answers(game: Game, target: string, family: Family): TruthAnswer[] | null {
  const view = viewGame(game,target);
  return family === 'bribe' ? view.truthBribeAnswers :
    family === 'bribeExpression' ? view.truthBribeExpressionAnswers : view.truthMixedBribeAnswers;
}
function reject(game: Game, actor: string, action: Action) {
  const before=structuredClone(game); assert.throws(() => act(game,actor,action)); assert.deepEqual(game,before);
}
function receipt(game: Game, family: Family, target: string) {
  const row = family === 'bribe' ? game.bribePromises?.findLast(entry => entry.player === target) :
    family === 'bribeExpression' ? game.bribeExpressionPromises?.findLast(entry => entry.player === target) :
      game.mixedBribeQuestions?.findLast(entry => entry.player === target);
  assert.ok(row); return structuredClone(row);
}

for (const family of ['bribe','bribeExpression','mixedBribe'] as const)
  for (const answer of ['yes','no'] as const) for (const claim of [false,true]) {
    void test(`Basic native Semuta ${claim ? 'claim' : 'pass'} preserves ${family} ${answer} and its real payment`, () => {
      const f=source(), before=structuredClone(f.game), asked=ask(f,family);
      assert.ok(answers(asked,f.target,family)?.includes(answer));
      assert.equal(viewGame(asked,f.asker).truthBribeAnswers,null);
      let game=act(asked,f.target,{type:'truthAnswer',answer});
      const pending=game.pendingTreacheryDiscard; assert.ok(pending?.reaction);
      assert.equal(pending.continuation.kind,'truthtranceDiscard');
      assert.equal(pending.batch.cause,'truthtrance');
      assert.deepEqual(pending.batch.entries.map(entry => [entry.card.id,entry.discardedBy,entry.publicFace]),
        [[f.truths[0],f.asker,true]]);
      assert.equal(game.truthHistory?.at(-1)?.answer,answer);
      const savedReceipt=receipt(game,family,f.target), savedHistory=structuredClone(game.truthHistory);
      assert.ok(viewGame(game,f.target).semutaReaction?.canCommit);
      if (claim) game=act(game,f.target,{type:'semutaCommit',event:pending.batch.event});
      else game=passFreshDiscard(game);
      assert.equal(game.pendingTreacheryDiscard,null); assert.equal(game.truthtrance,null);
      assert.deepEqual(receipt(game,family,f.target),savedReceipt);
      assert.deepEqual(game.truthHistory,savedHistory);
      assert.equal(player(game,f.target).hand.some(card => card.id === f.truths[0]),claim);
      assert.equal(player(game,f.target).hand.some(card => card.id === f.semuta),!claim);
      assert.equal(game.discard.some(card => card.id === f.truths[0]),!claim);
      assert.equal(game.discard.some(card => card.id === f.semuta),claim);
      assert.equal(game.auction?.index,before.auction?.index); assert.equal(game.auction?.bid,before.auction?.bid);
      assert.deepEqual(inventory(game),f.originalCards);
      const payerBefore=player(game,f.target).spice, recipientBefore=player(game,f.asker).bribes;
      const other=game.players.find(row => row.id !== f.target && row.id !== f.asker)!.id;
      if (answer === 'yes' && family === 'bribeExpression') {
        game=act(game,f.target,{type:'bribe',target:f.asker,amount:1});
        assert.ok(!game.bribeExpressionPromises?.at(-1)?.fulfilled);
        game=act(game,f.target,{type:'bribe',target:other,amount:1});
        assert.equal(game.bribeExpressionPromises?.at(-1)?.fulfilled,true);
      } else if (answer === 'yes') {
        game=act(game,f.target,{type:'bribe',target:f.asker,amount:2});
        assert.equal((family === 'bribe' ? game.bribePromises?.at(-1) : game.bribeExpressionPromises?.at(-1))?.fulfilled,true);
      } else if (family === 'bribeExpression') {
        game=act(game,f.target,{type:'bribe',target:f.asker,amount:1});
        reject(game,f.target,{type:'bribe',target:other,amount:1});
      } else {
        reject(game,f.target,{type:'bribe',target:f.asker,amount:2});
        game=act(game,f.target,{type:'bribe',target:f.asker,amount:1});
      }
      assert.equal(player(game,f.target).spice,payerBefore - (answer === 'yes' ? 2 : 1));
      assert.equal(player(game,f.asker).bribes,recipientBefore + (answer === 'yes' && family !== 'bribeExpression' ? 2 : 1));
      assert.deepEqual(inventory(game),f.originalCards);
    });
  }

void test('Basic native Semuta bribe question has a legal bot answer and continuation for every profile', () => {
  const f=source(), asked=ask(f,'bribe');
  for (const difficulty of DIFFICULTIES) {
    const view=viewGame(asked,f.target);
    view.players.find(row => row.id === f.target)!.bot=difficulty;
    const action=botActions(view)[0]; assert.ok(action,difficulty); assert.equal(action.type,'truthAnswer');
    assert.ok(['yes','no'].includes(String(action.answer)));
    let game=act(structuredClone(asked),f.target,action);
    assert.ok(game.pendingTreacheryDiscard?.reaction); game=passFreshDiscard(game);
    const result=receipt(game,'bribe',f.target);
    assert.equal(result.answer,action.answer === 'yes');
    if (action.answer === 'yes') {
      const own=viewGame(game,f.target); own.players.find(row => row.id === f.target)!.bot=difficulty;
      const guide=own.bribePromiseGuide; assert.ok(guide);
      const next=botActions(own)[0]; assert.deepEqual(next,guide.action);
      game=act(game,f.target,next); assert.equal(game.bribePromises?.at(-1)?.fulfilled,true);
    }
    assert.deepEqual(inventory(game),f.originalCards);
  }
});

for (const claim of [false,true]) void test(
  `Basic Semuta ${claim ? 'claim' : 'pass'} resumes a JSON-round-tripped constant mixed bribe answer`, () => {
    const f=source(), declared=declareTruthTransferOrderPlay(f).game;
    // The current known fact is true, so the OR is true independently of the
    // future payment. No residual bribe-expression obligation is created.
    const mixed = {kind:'or' as const,terms:[
      {kind:'fact' as const,fact:{kind:'spice' as const,compare:'gte' as const,value:0}},
      {kind:'action' as const,action:{recipient:f.asker,minimum:2}},
    ]};
    const asked=act(declared,f.asker,{type:'truthAsk',question:{kind:'mixedBribe',
      target:f.target,turn:f.game.turn,mixed}});
    assert.deepEqual(viewGame(asked,f.target).truthMixedBribeAnswers,['yes']);
    const pending=act(asked,f.target,{type:'truthAnswer',answer:'yes'});
    const stored=receipt(pending,'mixedBribe',f.target);
    assert.ok('binding' in stored); assert.equal(stored.binding,false);
    assert.equal(pending.bribeExpressionPromises?.length ?? 0,0);
    assert.ok(pending.pendingTreacheryDiscard?.reaction);
    const history=structuredClone(pending.truthHistory), event=pending.pendingTreacheryDiscard!.batch.event;
    let game=JSON.parse(JSON.stringify(pending)) as Game;
    if (claim) game=act(game,f.target,{type:'semutaCommit',event});
    else game=passFreshDiscard(game);
    assert.equal(game.pendingTreacheryDiscard,null); assert.equal(game.truthtrance,null);
    assert.deepEqual(receipt(game,'mixedBribe',f.target),stored);
    assert.deepEqual(game.truthHistory,history);
    assert.equal(player(game,f.target).hand.some(card => card.id === f.truths[0]),claim);
    assert.equal(game.discard.some(card => card.id === f.truths[0]),!claim);
    assert.deepEqual(inventory(game),f.originalCards);
    // A constant answer imposes no residual limit on a later legal payment.
    const before=player(game,f.target).spice;
    game=act(game,f.target,{type:'bribe',target:f.asker,amount:1});
    assert.equal(player(game,f.target).spice,before - 1);
    assert.deepEqual(inventory(game),f.originalCards);
  },
);

void test('A tampered mixed bribe binding cannot resume its original Semuta discard continuation', () => {
  const f=source(), declared=declareTruthTransferOrderPlay(f).game;
  const asked=act(declared,f.asker,{type:'truthAsk',question:{kind:'mixedBribe',
    target:f.target,turn:f.game.turn,mixed:{kind:'or',terms:[
      {kind:'fact',fact:{kind:'spice',compare:'gte',value:0}},
      {kind:'action',action:{recipient:f.asker,minimum:2}},
    ]}}});
  const pending=act(asked,f.target,{type:'truthAnswer',answer:'yes'});
  const event=pending.pendingTreacheryDiscard!.batch.event;
  const tampered=JSON.parse(JSON.stringify(pending)) as Game;
  const continuation=tampered.pendingTreacheryDiscard!.continuation;
  assert.equal(continuation.kind,'truthtranceDiscard');
  if (continuation.kind !== 'truthtranceDiscard') throw Error('Expected original Truth discard');
  assert.ok(continuation.bribeBinding); assert.equal(continuation.bribeBinding.kind,'mixedBribe');
  continuation.bribeBinding.value.answer=false;
  reject(tampered,f.target,{type:'semutaCommit',event});
  // Mutating the live ledger rather than the receipt must also reject.
  const altered=JSON.parse(JSON.stringify(pending)) as Game;
  assert.ok(altered.mixedBribeQuestions?.length);
  altered.mixedBribeQuestions!.at(-1)!.answer=false;
  reject(altered,f.target,{type:'semutaCommit',event});
  assert.deepEqual(inventory(pending),f.originalCards);
});
