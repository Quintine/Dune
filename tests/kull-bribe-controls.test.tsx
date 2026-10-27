import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { viewGame, type Action, type GameView } from '../game/engine';
import { BribePromises, BribePromiseGuideButton } from '../components/bribe-promises';
import { act, createKullBribeFixture as fixture, bind, attempt } from './fixture-kull-bribe';

const aliases = registerHooks({
  resolve(specifier,context,next) {
    return next(specifier === 'next/image' ? 'vinext/shims/image' : specifier === 'next/link' ? 'vinext/shims/link' : specifier,context);
  },
  load(url,context,next) {
    if (!url.endsWith('.module.css')) return next(url,context);
    const css=readFileSync(new URL(url),'utf8');
    const classes=Object.fromEntries([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(match=>[match[1],match[1]]));
    return {format:'module',source:`export default ${JSON.stringify(classes)}`,shortCircuit:true};
  },
});
const {GameTable}=await import('../components/game-table');
aliases.deregister();
const table=(game:GameView)=>renderToStaticMarkup(createElement(GameTable,{game,busy:false,send:async()=>{},onExit(){}}));
const panel=(game:GameView)=>renderToStaticMarkup(createElement(BribePromises,{game,busy:false,send(){}}));

void test('public Kull table renders a private bribe commitment and its real native callback',()=>{
  const f=fixture(), bound=bind(f,f.game,'yes').game, view=viewGame(bound,f.actor), sent:Action[]=[];
  assert.ok(view.bribePromiseGuide); assert.match(panel(view),/Your bribe promises/);
  assert.match(table(view),/data-testid="bribe-promise-guide"/);
  assert.doesNotMatch(panel(viewGame(bound,f.asker)),/Your bribe promises/);
  const button=BribePromiseGuideButton({game:view,busy:false,send(action){sent.push(action);}}); assert.ok(button);
  assert.equal(button.props.disabled,false); button.props.onClick();
  assert.deepEqual(sent,[view.bribePromiseGuide.action]);
  const paid=act(bound,f.actor,sent[0]); assert.ok(paid.bribePromises?.at(-1)?.fulfilled);
  const disabled=BribePromiseGuideButton({game:view,busy:true,send(){assert.fail('Busy guide cannot send');}}); assert.ok(disabled);
  assert.equal(disabled.props.disabled,true); disabled.props.onClick();
});

void test('a pending neutral Kull reaction hides the actual bribe action until it resumes',()=>{
  const f=fixture(), bound=bind(f,f.game,'yes').game;
  let game=act(bound,f.actor,attempt(f));
  const pending=viewGame(game,f.actor); assert.ok(pending.kullReaction);
  assert.equal(pending.bribePromiseGuide,null);
  assert.doesNotMatch(panel(pending),/data-testid="bribe-promise-guide"/);
  assert.equal(BribePromiseGuideButton({game:pending,busy:false,send(){assert.fail('Kull owns the pending response');}}),null);
  const response=viewGame(game,f.reactor).kullReaction; assert.ok(response);
  game=act(game,f.reactor,{type:'kullDecision',event:response.event,decline:true});
  const resumed=viewGame(game,f.actor); assert.ok(resumed.bribePromiseGuide);
  const sent:Action[]=[]; const button=BribePromiseGuideButton({game:resumed,busy:false,send(action){sent.push(action);}}); assert.ok(button);
  button.props.onClick(); assert.deepEqual(sent,[resumed.bribePromiseGuide.action]);
  assert.ok(act(game,f.actor,sent[0]).bribePromises?.at(-1)?.fulfilled);
});
