import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { FACTIONS } from '../game/catalog';
import { truthFactAnswer, truthQuestionText, type TruthFact } from '../game/truthtrance';
import { knowledgeFactAnswer, parseKnowledgeFact, truthKnowledgeOf, type KnowledgeFact } from '../game/truthtrance-knowledge';
import { knowledgeGame, knownForecastGame, askKnowledge, rejectKnowledge, knowledgePhysical, knowledgeBotActions } from './truthtrance-knowledge-fixture';

void test('knowledge predicates normalize typed inputs and reject invalid factions, comparisons and printed ranges',()=>{
  for(const faction of FACTIONS) assert.deepEqual(parseKnowledgeFact({kind:'prediction',field:'faction',faction:faction.id,extra:'ignored'}),{kind:'prediction',field:'faction',faction:faction.id});
  for(const [kind,min,max] of [['prediction',1,10],['stormDial',0,20],['stormForecast',1,6]] as const)
    for(const compare of ['eq','gte','lte'] as const) {
      const template={kind,...(kind==='prediction'?{field:'turn'}:{}),compare};
      for(const value of [min,max]) assert.equal((parseKnowledgeFact({...template,value}) as {value:number}).value,value);
      for(const value of [min-1,max+1,1.5,NaN,Infinity,'3',null]) assert.throws(()=>parseKnowledgeFact({...template,value}));
      assert.throws(()=>parseKnowledgeFact({...template,value:min,compare:'gt'}));
    }
  for(const value of [null,[],{}, {kind:'prediction',field:'winner'}, {kind:'prediction',field:'faction',faction:'unknown'}]) assert.throws(()=>parseKnowledgeFact(value));
});

void test('recorded BG prediction answers faction and turn questions without exposing either underlying value',()=>{
  for(const advanced of [false,true])for(const [fact,expected] of [
    [{kind:'prediction',field:'faction',faction:'guild'},'yes'],
    [{kind:'prediction',field:'faction',faction:'atreides'},'no'],
    [{kind:'prediction',field:'turn',compare:'gte',value:7},'yes'],
    [{kind:'prediction',field:'turn',compare:'lte',value:6},'no'],
  ] as const){
    const initial=knowledgeGame(advanced),g=askKnowledge(initial,'b',fact);
    const physical=knowledgePhysical(initial),saved=JSON.parse(JSON.stringify(g));
    for(const p of g.players) assert.deepEqual(viewGame(saved,p.id),viewGame(g,p.id));
    assert.equal(viewGame(g,'b').truthAnswer,expected);assert.equal(viewGame(g,'o').truthAnswer,null);
    const rival=viewGame(g,'a').players.find(p=>p.id==='b')!;assert.equal('prediction' in rival,false);
    rejectKnowledge(g,'b',{type:'truthAnswer',answer:expected==='yes'?'no':'yes'});
    rejectKnowledge(g,'o',{type:'truthAnswer',answer:expected});
    const done=applyAction(saved,'b',{type:'truthAnswer',answer:expected});
    assert.equal(done.truthtrance,null);assert.equal(done.truthHistory!.at(-1)!.answer,expected);
    assert.deepEqual(done.players[1].prediction,initial.players[1].prediction);assert.deepEqual(knowledgePhysical(done),physical);
    assert.equal(done.discard.filter(c=>c.effect==='truthtrance').length,1);
    rejectKnowledge(done,'b',{type:'truthAnswer',answer:expected});
  }
});

void test('a submitted storm dial answers while locked and unpublished, but absent or expired submissions remain unknown',()=>{
  let initial=knowledgeGame();const target=initial.stormDialers.find(id=>id!=='a')!;
  const fact:KnowledgeFact={kind:'stormDial',compare:'eq',value:0};
  const missing=askKnowledge(initial,target,fact);assert.equal(viewGame(missing,target).truthAnswer,'unknown');
  initial=applyAction(initial,target,{type:'stormDial',amount:0});
  const g=askKnowledge(initial,target,fact);assert.equal(viewGame(g,target).truthAnswer,'yes');
  assert.equal(viewGame(g,'a').stormRevealed,null);
  const done=applyAction(g,target,{type:'truthAnswer',answer:'yes'});assert.equal(done.stormDials[target],0);
  assert.deepEqual(knowledgePhysical(done),knowledgePhysical(initial));
  const other=done.stormDialers.find(id=>id!==target)!;
  let progressed=applyAction(done,other,{type:'stormDial',amount:0});
  for(let n=0;progressed.phase===0&&n<20;n++) {
    const candidate=progressed.players.flatMap(p=>knowledgeBotActions(progressed,p.id).map(action=>({id:p.id,action}))).find(c=>c.action.type==='ready'||c.action.type==='passResponse')!;
    assert.ok(candidate);progressed=applyAction(progressed,candidate.id,candidate.action);
  }
  assert.equal(progressed.phase,1);
  assert.equal(truthKnowledgeOf(progressed,progressed.players.find(p=>p.id===target)!).stormDial,null);
});

void test('forecast predicates use only actual Fremen knowledge and never reveal a canceled, unknown or other-faction storm card',()=>{
  const initial=knownForecastGame(),value=initial.stormCard!;
  const fact:KnowledgeFact={kind:'stormForecast',compare:'eq',value};
  const g=askKnowledge(initial,'f',fact);assert.equal(viewGame(g,'f').truthAnswer,'yes');
  for(const id of ['a','b','o']) {const v=viewGame(g,id);assert.equal(v.stormForecast,null);assert.equal(v.truthAnswer,null);}
  const done=applyAction(g,'f',{type:'truthAnswer',answer:'yes'});assert.equal(done.stormCard,value);assert.deepEqual(knowledgePhysical(done),knowledgePhysical(initial));
  for(const id of ['a','b','o']) assert.equal(truthKnowledgeOf(initial,initial.players.find(p=>p.id===id)!).stormForecast,null);
  const unknown={...initial,stormCardKnown:false};
  assert.equal(knowledgeFactAnswer(fact,truthKnowledgeOf(unknown,unknown.players[2])),'unknown');
  assert.equal(viewGame(askKnowledge(unknown,'f',fact),'f').truthAnswer,'unknown');
  assert.equal(truthKnowledgeOf({...initial,advanced:false},initial.players[2]).stormForecast,null);
});

void test('compound answers publish only the aggregate and all four bots use the same owner-only truth',()=>{
  const fact:TruthFact={kind:'or',terms:[{kind:'prediction',field:'faction',faction:'guild'},{kind:'prediction',field:'turn',compare:'eq',value:3}]};
  const a=knowledgeGame(),b=structuredClone(a);b.players[1].prediction={faction:'atreides',turn:3};
  const left=askKnowledge(a,'b',fact),right=askKnowledge(b,'b',fact);
  for(const id of ['a','f','o']) assert.deepEqual(viewGame(left,id),viewGame(right,id));
  assert.equal(viewGame(left,'b').truthAnswer,'yes');assert.equal(viewGame(right,'b').truthAnswer,'yes');
  for(const difficulty of DIFFICULTIES) {
    const g=structuredClone(left);g.players[1].bot=difficulty;
    const actions=botActions(viewGame(g,'b'));assert.deepEqual(actions,[{type:'truthAnswer',answer:'yes'}]);
    const done=applyAction(g,'b',actions[0]);assert.equal(done.truthHistory!.at(-1)!.answer,'yes');
  }
  const knowledge=truthKnowledgeOf(a,a.players[1]);
  assert.equal(truthFactAnswer(a.players[1],{kind:'and',terms:[{kind:'stormForecast',compare:'eq',value:1},{kind:'prediction',field:'faction',faction:'atreides'}]},knowledge),'no');
  assert.equal(truthFactAnswer(a.players[1],{kind:'or',terms:[{kind:'stormForecast',compare:'eq',value:1},{kind:'prediction',field:'faction',faction:'atreides'}]},knowledge),'unknown');
});

void test('unknown stored knowledge retains the real card and permits a different question without fabricating a future promise',()=>{
  const initial=knowledgeGame(),g=askKnowledge(initial,'o',{kind:'prediction',field:'turn',compare:'eq',value:7});
  assert.equal(viewGame(g,'o').truthAnswer,'unknown');rejectKnowledge(g,'o',{type:'truthAnswer',answer:'no'});
  const unknown=applyAction(g,'o',{type:'truthAnswer',answer:'unknown'});
  assert.equal(unknown.truthtrance!.stage,'unknown');assert.deepEqual(unknown.players[0].hand,initial.players[0].hand);
  const retry=applyAction(unknown,'a',{type:'truthAsk',question:{kind:'fact',target:'b',fact:{kind:'prediction',field:'turn',compare:'eq',value:7}}});
  const done=applyAction(retry,'b',{type:'truthAnswer',answer:'yes'});assert.equal(done.truthtrance,null);
  assert.deepEqual(knowledgePhysical(done),knowledgePhysical(initial));
  const wording=truthQuestionText({kind:'fact',target:'b',fact:{kind:'prediction',field:'faction',faction:'guild'}},id=>id);
  assert.match(wording,/recorded.*prediction/);assert.doesNotMatch(wording,/will you win|must win/i);
});
