import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { viewGame, type Action, type GameView } from '../game/engine';
import { SaphoTruthOrderPass, SaphoTruthOrderChoiceButton } from '../components/sapho-truth-order';
import { act, inventory, createSaphoTruthOrderFixture, passFreshDiscard,
  finishOriginalTruthQuestions } from './fixture-sapho-truth-order';

const aliases = registerHooks({
  resolve(specifier, context, next) {
    return next(specifier === 'next/image' ? 'vinext/shims/image' : specifier === 'next/link' ? 'vinext/shims/link' : specifier, context);
  },
  load(url, context, next) {
    if (!url.endsWith('.module.css')) return next(url, context);
    const css = readFileSync(new URL(url), 'utf8');
    const classes = Object.fromEntries([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(match => [match[1], match[1]]));
    return { format: 'module', source: `export default ${JSON.stringify(classes)}`, shortCircuit: true };
  },
});
const { GameTable } = await import('../components/game-table');
const { Truthtrance } = await import('../components/truthtrance');
aliases.deregister();

const table = (game: GameView) => renderToStaticMarkup(createElement(GameTable, {
  game, busy: false, send: async () => {}, onExit() {},
}));
const truth = (game: GameView) => renderToStaticMarkup(createElement(Truthtrance, {
  game, busy: false, act() {},
}));

for (const advanced of [false, true]) void test(
  `${advanced ? 'Advanced' : 'Basic'} queued holders see and use actual Truth-order controls`, () => {
    // Native public setup, a genuinely purchased Sapho and an original started
    // movement parent. One labeled, physical-card-conserving swap places an
    // already-dealt Truth card into the Sapho owner's hand; see the fixture.
    const f = createSaphoTruthOrderFixture({advanced,mode:'first'});
    let game = f.game;
    const otherView = viewGame(game,f.other), otherFrame = otherView.truthtrance?.order;
    assert.ok(otherFrame); assert.deepEqual(otherView.saphoTruthOrderChoices,[]);
    assert.match(truth(otherView),/Continue without changing question order/);
    assert.match(table(otherView),/Continue without changing question order/);
    assert.doesNotMatch(truth(otherView),/Use Juice of Sapho to ask/);
    assert.doesNotMatch(truth(otherView),new RegExp(f.card));

    // Invoke the actual hook-free leaf callbacks rendered by Truthtrance; SSR
    // does not operate a browser, hydration or interactive selectors.
    const sent: Action[] = [];
    const pass = SaphoTruthOrderPass({frame:otherFrame,me:f.other,choices:otherView.saphoTruthOrderChoices,
      busy:false,act(action) { sent.push(action); }});
    assert.equal(pass.props.disabled,false); pass.props.onClick();
    assert.deepEqual([...sent],[{type:'truthOrderPass',event:otherFrame.event,revision:otherFrame.revision}]);
    game = act(game,f.other,sent.pop()!);

    const ownerView = viewGame(game,f.owner), ownerFrame = ownerView.truthtrance?.order;
    assert.ok(ownerFrame); assert.ok(ownerFrame.passed.includes(f.other));
    const choice = ownerView.saphoTruthOrderChoices.find(row => row.card === f.card && row.mode === 'first');
    assert.ok(choice);
    assert.match(truth(ownerView),/Use Juice of Sapho to ask first/);
    assert.match(table(ownerView),/Use Juice of Sapho to ask first/);
    const button = SaphoTruthOrderChoiceButton({frame:ownerFrame,me:f.owner,choices:ownerView.saphoTruthOrderChoices,
      choice,busy:false,act(action) { sent.push(action); }});
    assert.equal(button.props.disabled,false); button.props.onClick();
    assert.deepEqual([...sent],[{type:'saphoTruthOrder',event:ownerFrame.event,revision:ownerFrame.revision,
      card:f.card,mode:'first'}]);
    game = act(game,f.owner,sent.pop()!);
    // Basic's supported Semuta profile can open a neutral reaction; actually
    // pass it before observing the restored first original Truth question.
    game = passFreshDiscard(game);
    assert.equal(game.truthtrance?.stage,'ask');
    assert.equal(game.truthtrance.queue[0].player,f.owner);
    assert.deepEqual(game.order,f.order);
    assert.deepEqual(inventory(game),f.originalCards);
    game = finishOriginalTruthQuestions(game);
    assert.equal(game.truthtrance,null);
    assert.equal(game.active,f.parent.active);
    assert.equal(game.phase,f.parent.phase);
    assert.deepEqual(inventory(game),f.originalCards);
  },
);
