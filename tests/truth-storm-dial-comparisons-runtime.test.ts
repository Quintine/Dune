import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { parseStormDialClaim, stormDialMatches } from '../game/storm-dial-question';
import { turnActionStormDialChoices, type TurnActionBranchLeaf } from '../game/turn-action-promises';
import { advanceTruthMovement, truthMovementInventory } from './fixture-truth-movement';
import { actTruthStormDial as act, askStormDial as ask, createTruthStormDialFixture as fixture,
  declareStormDialQuestion as declare, declareTwoStormDialQuestions as declareTwo } from './fixture-truth-storm-dial';

type Compare = 'eq'|'gte'|'lte';
const source=(turn:number, player:string) => JSON.stringify(['stormDial',turn,player]);
const leaf=(event:string,value:number,compare?:Compare) => ({kind:'action' as const,
  action:{kind:'stormDial' as const,source:event,value,...(compare ? {compare} : {})}});
function reject(game:Game, actor:string, action:Action) {
  const before=structuredClone(game); assert.throws(() => act(game,actor,action)); assert.deepEqual(game,before);
}
function hidden(game:Game, viewer:string) {
  const view=viewGame(game,viewer);
  assert.equal(view.stormRevealed,null); assert.equal('stormDials' in view,false); return view;
}

void test('storm dial predicates parse and compare legal native submissions without changing old exact claims', () => {
  const event=source(1,'atreides');
  const exact={kind:'stormDial' as const,source:event,value:7};
  assert.deepEqual(parseStormDialClaim(exact),exact);
  for (const [compare,yes,no] of [['eq',7,6],['gte',7,6],['lte',7,8]] as const) {
    const claim={...exact,compare};
    assert.equal(parseStormDialClaim(claim).compare,compare);
    assert.equal(stormDialMatches(claim,yes),true); assert.equal(stormDialMatches(claim,no),false);
  }
  assert.equal(stormDialMatches(exact,7),true); assert.equal(stormDialMatches(exact,8),false);
  for (const invalid of [{...exact,compare:'exact'}, {...exact,compare:'GTE'}, {...exact,compare:null},
    {...exact,compare:'gte',secret:true}, {...exact,compare:'lte',value:21}, {...exact,compare:'eq',value:-1}])
    assert.throws(() => parseStormDialClaim(invalid));
  const later={kind:'stormDial' as const,source:source(2,'atreides'),value:3,compare:'lte' as const};
  assert.equal(stormDialMatches(later,1),true); assert.equal(stormDialMatches(later,3),true);
  assert.throws(() => stormDialMatches(later,0)); assert.throws(() => stormDialMatches(later,4));
});

void test('signed thresholds use the exact native range and intersect, including same-boundary equalities', () => {
  const event=source(1,'atreides');
  const signed=(compare:Compare,value:number,answer:boolean) =>
    ({kind:'stormDial' as const,source:event,compare,value,answer});
  const choices=(...entries:TurnActionBranchLeaf[]) => turnActionStormDialChoices(entries,event);
  assert.deepEqual(choices(signed('gte',5,true),signed('lte',9,true)),[5,6,7,8,9]);
  assert.deepEqual(choices(signed('gte',7,true),signed('lte',7,true)),[7]);
  assert.deepEqual(choices(signed('gte',7,true),signed('lte',7,false)),[8,9,10,11,12,13,14,15,16,17,18,19,20]);
  assert.deepEqual(choices(signed('gte',5,true),signed('lte',4,true)),[]);
  assert.deepEqual(choices(signed('gte',0,false)),[]);
  assert.deepEqual(choices(signed('lte',20,false)),[]);
  const next=source(2,'atreides');
  const later=(compare:Compare,value:number,answer:boolean):TurnActionBranchLeaf =>
    ({kind:'stormDial',source:next,compare,value,answer});
  assert.deepEqual(turnActionStormDialChoices([later('gte',2,true),later('lte',2,true)],next),[2]);
  assert.deepEqual(turnActionStormDialChoices([later('gte',1,false)],next),[]);
});

for (const [compare,answer,allowed,forbidden] of [
  ['eq','yes',7,6],['eq','no',6,7],
  ['gte','yes',7,6],['gte','no',6,7],
  ['lte','yes',7,8],['lte','no',8,7],
] as const) void test(`native Basic ${answer} to dial ${compare} 7 constrains the actual sealed choice`, () => {
  const f=fixture(), asked=ask(declare(f),f,leaf(f.source,7,compare));
  assert.ok(viewGame(asked,f.target).truthTurnActionAnswers?.includes(answer));
  let game=act(asked,f.target,{type:'truthAnswer',answer});
  assert.equal(game.truthtrance,null); assert.equal(game.stormPending,null);
  reject(game,f.target,{type:'stormDial',amount:forbidden});
  const guide=hidden(game,f.target).turnActionGuide; assert.ok(guide);
  assert.equal(guide.action.type,'stormDial');
  const amount=Number(guide.action.amount);
  assert.equal(stormDialMatches({...leaf(f.source,7,compare).action},amount),answer === 'yes');
  game=act(game,f.target,{type:'stormDial',amount:allowed});
  assert.equal(game.stormDials[f.target],allowed); assert.equal(game.stormPending,null);
  const observer=hidden(game,f.asker); assert.ok(observer.stormSubmitted.includes(f.target));
  assert.ok(game.turnActionPromises?.find(row => row.player === f.target)?.fulfilled);
  game=act(game,f.asker,{type:'stormDial',amount:3});
  assert.equal(game.stormPending,allowed+3);
  assert.deepEqual(viewGame(game,f.asker).stormRevealed,{[f.target]:allowed,[f.asker]:3});
  assert.deepEqual(truthMovementInventory(game),f.base.originalCards);
});

for (const [firstValue,secondValue,legal,rejectedLow,rejectedHigh] of [[5,9,7,4,10],[7,7,7,6,8]] as const)
  void test(`two original Truths intersect dial >=${firstValue} and <=${secondValue} without conflating comparison types`, () => {
    const f=fixture(), queued=declareTwo(f);
    let game=ask(queued.game,f,leaf(f.source,firstValue,'gte'));
    game=act(game,f.target,{type:'truthAnswer',answer:'yes'});
    assert.equal(game.truthtrance?.stage,'ask');
    game=ask(game,f,leaf(f.source,secondValue,'lte'));
    assert.ok(viewGame(game,f.target).truthTurnActionAnswers?.includes('yes'));
    game=act(game,f.target,{type:'truthAnswer',answer:'yes'});
    reject(game,f.target,{type:'stormDial',amount:rejectedLow});
    reject(game,f.target,{type:'stormDial',amount:rejectedHigh});
    const guide=viewGame(game,f.target).turnActionGuide; assert.ok(guide);
    assert.ok(Number(guide.action.amount)>=firstValue && Number(guide.action.amount)<=secondValue);
    game=act(game,f.target,{type:'stormDial',amount:legal});
    assert.equal(game.stormDials[f.target],legal);
    assert.ok(game.turnActionPromises?.filter(row => row.player === f.target).every(row => row.fulfilled));
    assert.equal(game.discard.filter(card => card.id === f.truth || card.id === queued.second).length,2);
    assert.deepEqual(truthMovementInventory(game),f.base.originalCards);
  });

void test('incompatible second threshold Yes is withheld and the earlier accepted answer remains binding', () => {
  const f=fixture(), queued=declareTwo(f);
  let game=ask(queued.game,f,leaf(f.source,5,'gte'));
  game=act(game,f.target,{type:'truthAnswer',answer:'yes'});
  const prior=structuredClone(game.turnActionPromises![0]);
  game=ask(game,f,leaf(f.source,4,'lte'));
  const choices=viewGame(game,f.target).truthTurnActionAnswers;
  assert.ok(choices?.includes('no')); assert.ok(!choices?.includes('yes'));
  reject(game,f.target,{type:'truthAnswer',answer:'yes'});
  game=act(game,f.target,{type:'truthAnswer',answer:'no'});
  assert.deepEqual(game.turnActionPromises![0],prior);
  reject(game,f.target,{type:'stormDial',amount:4});
  game=act(game,f.target,{type:'stormDial',amount:5});
  assert.ok(game.turnActionPromises?.every(row => row.fulfilled));
  assert.deepEqual(truthMovementInventory(game),f.base.originalCards);
});

void test('later Basic storm dials enforce the native 1–3 range and threshold answers', () => {
  const first=fixture();
  let game=act(first.base.game,first.target,{type:'endMovement'});
  game=advanceTruthMovement(game,state => state.turn === 2 && state.phase === 0);
  const later={...first,game,source:source(2,first.target)};
  game=ask(declare(later),later,leaf(later.source,2,'gte'));
  assert.ok(viewGame(game,later.target).truthTurnActionAnswers?.includes('no'));
  game=act(game,later.target,{type:'truthAnswer',answer:'no'});
  reject(game,later.target,{type:'stormDial',amount:0});
  reject(game,later.target,{type:'stormDial',amount:2});
  reject(game,later.target,{type:'stormDial',amount:4});
  game=act(game,later.target,{type:'stormDial',amount:1});
  assert.equal(game.stormDials[later.target],1);
  assert.ok(game.turnActionPromises?.some(row => row.player === later.target && row.fulfilled));
  assert.deepEqual(truthMovementInventory(game),later.base.originalCards);
});

for (const [kind,answer,legal,forbidden] of [
  ['and','yes',7,4], ['or','yes',2,7], ['or','no',7,2],
] as const) void test(`one nested ${kind.toUpperCase()} question combines comparator-bearing dial leaves under ${answer}`, () => {
  const f=fixture();
  const mixed=kind === 'and' ? {kind:'and',terms:[leaf(f.source,5,'gte'),leaf(f.source,9,'lte')]} :
    {kind:'or',terms:[leaf(f.source,3,'lte'),leaf(f.source,10,'gte')]};
  const asked=ask(declare(f),f,mixed);
  assert.ok(viewGame(asked,f.target).truthTurnActionAnswers?.includes(answer));
  let game=act(asked,f.target,{type:'truthAnswer',answer});
  reject(game,f.target,{type:'stormDial',amount:forbidden});
  const guide=viewGame(game,f.target).turnActionGuide; assert.ok(guide);
  const quoted=Number(guide.action.amount);
  const whole=kind === 'and' ? quoted >= 5 && quoted <= 9 : quoted <= 3 || quoted >= 10;
  assert.equal(whole,answer === 'yes');
  game=act(game,f.target,{type:'stormDial',amount:legal});
  assert.equal(game.stormDials[f.target],legal); assert.equal(game.stormPending,null);
  assert.ok(game.turnActionPromises?.find(row => row.player === f.target)?.fulfilled);
  assert.deepEqual(truthMovementInventory(game),f.base.originalCards);
});

void test('a JSON-restored legacy dial claim without compare still requires the exact native value', () => {
  const f=fixture(), asked=ask(declare(f),f,leaf(f.source,7));
  let game=act(asked,f.target,{type:'truthAnswer',answer:'yes'});
  const saved=JSON.parse(JSON.stringify(game)) as Game;
  const question=saved.truthHistory?.at(-1)?.question;
  assert.ok(question); assert.equal(question.kind,'turnActions');
  if (question.kind !== 'turnActions' || question.mixed.kind !== 'action' || question.mixed.action.kind !== 'stormDial')
    throw Error('Retain the original legacy storm-dial action in history');
  assert.equal(Object.hasOwn(question.mixed.action,'compare'),false);
  reject(saved,f.target,{type:'stormDial',amount:6});
  reject(saved,f.target,{type:'stormDial',amount:8});
  const guide=viewGame(saved,f.target).turnActionGuide; assert.ok(guide);
  assert.equal(guide.action.amount,7);
  game=act(saved,f.target,guide.action);
  assert.equal(game.stormDials[f.target],7); assert.equal(game.stormPending,null);
  assert.ok(game.turnActionPromises?.find(row => row.player === f.target)?.fulfilled);
  game=act(game,f.asker,{type:'stormDial',amount:3});
  assert.deepEqual(viewGame(game,f.asker).stormRevealed,{[f.target]:7,[f.asker]:3});
  assert.deepEqual(truthMovementInventory(game),f.base.originalCards);
});

for (const compare of ['eq','gte','lte'] as const) void test(
  `all four minimal bot profiles honor a native ${compare} storm-dial answer`, () => {
    const f=fixture(), asked=ask(declare(f),f,leaf(f.source,7,compare));
    for (const difficulty of DIFFICULTIES) {
      const answerView=viewGame(asked,f.target);
      answerView.players.find(row => row.id === f.target)!.bot=difficulty;
      const answer=botActions(answerView)[0]; assert.ok(answer,difficulty);
      assert.equal(answer.type,'truthAnswer'); assert.ok(['yes','no'].includes(String(answer.answer)));
      let game=act(structuredClone(asked),f.target,answer);
      const dialView=hidden(game,f.target);
      dialView.players.find(row => row.id === f.target)!.bot=difficulty;
      const guide=dialView.turnActionGuide; assert.ok(guide,difficulty);
      const chosen=botActions(dialView)[0]; assert.deepEqual(chosen,guide.action);
      assert.equal(stormDialMatches(leaf(f.source,7,compare).action,chosen.amount),answer.answer === 'yes');
      game=act(game,f.target,chosen);
      assert.equal(game.stormDials[f.target],chosen.amount);
      assert.equal(game.stormPending,null);
      assert.ok(game.turnActionPromises?.find(row => row.player === f.target)?.fulfilled);
      assert.deepEqual(truthMovementInventory(game),f.base.originalCards);
    }
  },
);
