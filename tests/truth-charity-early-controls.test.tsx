import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { Children, createElement, isValidElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { viewGame, type Action, type GameView } from '../game/engine';
import { act, askTruthCharityEarly as ask, createTruthCharityEarlyFixture as fixture,
  declareTruthCharityEarly as declare, inventory, player, reachEarlyCharity as reach,
  rejectTruthCharityEarly as reject } from './fixture-truth-charity-early';

const aliases = registerHooks({
  resolve(specifier,context,next) {
    return next(specifier === 'next/image' ? 'vinext/shims/image' : specifier === 'next/link' ? 'vinext/shims/link' : specifier,context);
  },
  load(url,context,next) {
    if (!url.endsWith('.module.css')) return next(url,context);
    const css = readFileSync(new URL(url),'utf8');
    const classes = Object.fromEntries([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(match => [match[1],match[1]]));
    return {format:'module',source:`export default ${JSON.stringify(classes)}`,shortCircuit:true};
  },
});
const {GameTable} = await import('../components/game-table');
const {Truthtrance} = await import('../components/truthtrance');
const {TruthCharityPromise} = await import('../components/truth-charity-promise');
aliases.deregister();
const table = (game: GameView) => renderToStaticMarkup(createElement(GameTable,{game,busy:false,send:async()=>{},onExit(){}}));
const truth = (game: GameView) => renderToStaticMarkup(createElement(Truthtrance,{game,busy:false,act(){}}));

for (const phase of [0,1] as const) {
  void test(`Basic phase ${phase} Truthtrance presents Charity question and private answer controls`, () => {
    const f=fixture(phase), declared=declare(f), asker=viewGame(declared,f.asker);
    assert.ok(asker.truthCharityTargets.includes(f.target));
    assert.match(truth(asker),/<option value="charity">[^<]*[Cc]harity/);
    const asked=ask(f), target=viewGame(asked,f.target);
    assert.equal(target.truthtrance?.question?.kind,'charity');
    assert.ok(target.truthCharityAnswers?.includes('yes'));
    assert.ok(target.truthCharityAnswers?.includes('no'));
    assert.equal(viewGame(asked,f.asker).truthCharityAnswers,null);
    assert.equal(viewGame(asked,f.observer).truthCharityAnswers,null);
    assert.match(truth(target),/Answer Yes/);
    assert.match(truth(target),/Answer No/);
    assert.match(table(target),/Answer Yes/);
    const bound=act(asked,f.target,{type:'truthAnswer',answer:'yes'}), early=viewGame(bound,f.target);
    assert.equal(early.truthCharityGuide,null);
    assert.match(table(early),/[Cc]harity/);
    assert.doesNotMatch(table(early),/data-testid="charity-promise-guide"/);
    assert.deepEqual(inventory(bound),f.originalCards);
  });
}

void test('An early Yes presents the original native guide only when Charity actually opens', () => {
  const f=fixture(1), asked=ask(f);
  const early=act(asked,f.target,{type:'truthAnswer',answer:'yes'});
  assert.equal(viewGame(early,f.target).truthCharityGuide,null);
  const game=reach(early), own=viewGame(game,f.target), sent:Action[]=[];
  assert.ok(own.truthCharityGuide);
  const panel=TruthCharityPromise({game:own,busy:false,send(action){sent.push(action);}});
  assert.ok(panel);
  type GuideProps={'data-testid'?:string;disabled?:boolean;onClick?:()=>void};
  const button=Children.toArray(panel.props.children).find(node =>
    isValidElement<GuideProps>(node) && node.props['data-testid'] === 'charity-promise-guide');
  assert.ok(isValidElement<GuideProps>(button));
  assert.equal(button.props.disabled,false);
  assert.ok(button.props.onClick); button.props.onClick();
  assert.deepEqual(sent,[own.truthCharityGuide.action]);
  let progressed=act(game,f.target,sent[0]);
  if (sent[0].type === 'bribe') {
    const claim=viewGame(progressed,f.target).truthCharityGuide; assert.ok(claim);
    assert.equal(claim.action.type,'charity'); progressed=act(progressed,f.target,claim.action);
  }
  assert.equal(player(progressed,f.target).charityTurn,progressed.turn);
  const no=reach(act(asked,f.target,{type:'truthAnswer',answer:'no'}));
  reject(no,f.target,sent[0]);
  assert.deepEqual(inventory(progressed),f.originalCards);
});
