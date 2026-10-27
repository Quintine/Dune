import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { viewGame, type Action, type Game, type GameView } from '../game/engine';
import { SaphoTruthOrderPass, SaphoTruthOrderChoiceButton } from '../components/sapho-truth-order';
import { act, inventory, player, createSaphoTruthRicheseFixture, assertRicheseParent } from './fixture-sapho-truth-richese';
import { passFreshDiscard, finishOriginalTruthQuestions } from './fixture-sapho-truth-order';

const aliases = registerHooks({
  resolve(specifier, context, next) {
    return next(specifier === 'next/image' ? 'vinext/shims/image' : specifier === 'next/link' ? 'vinext/shims/link' : specifier, context);
  },
  load(url, context, next) {
    if (!url.endsWith('.module.css')) return next(url, context);
    const css = readFileSync(new URL(url), 'utf8');
    const classes = Object.fromEntries([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(match => [match[1], match[1]]));
    return {format:'module', source:`export default ${JSON.stringify(classes)}`, shortCircuit:true};
  },
});
const { GameTable } = await import('../components/game-table');
const { Truthtrance } = await import('../components/truthtrance');
aliases.deregister();
const table = (game: GameView) => renderToStaticMarkup(createElement(GameTable,
  {game,busy:false,send:async()=>{},onExit() {}}));
const truth = (game: GameView) => renderToStaticMarkup(createElement(Truthtrance,
  {game,busy:false,act() {}}));

/** Never project another player's sealed amount or the collective results
 * before every eligible player submits. Public submitted identities remain. */
function checkSilentPrivacy(game: Game, observer: string) {
  const lot = game.richeseAuction; assert.ok(lot); assert.equal(lot.method,'silent');
  const view = viewGame(game,observer).richeseAuction; assert.ok(view);
  assert.equal(view.revealedBids,null);
  if (!Object.hasOwn(lot.sealed,observer)) assert.equal(view.ownBid,null);
  for (const other of Object.keys(lot.sealed).filter(id => id !== observer))
    assert.ok(view.submitted.includes(other));
}

for (const method of ['onceAround','silent'] as const) void test(
  `Basic ${method} actual Truth-order controls preserve the Richese lot and Semuta continuation`, () => {
    // Genuine public R/A/E setup and a real native Richese cache lot. The
    // fixture explicitly stages conserved original Sapho/Truth/Semuta card
    // custody; it does not claim those card acquisitions were earned.
    const f = createSaphoTruthRicheseFixture({advanced:false,method,semuta:true,standingBid:true});
    let game = f.game;
    assertRicheseParent(game,f.parent);
    if (method === 'silent') checkSilentPrivacy(game,f.other);
    const other = viewGame(game,f.other), frame = other.truthtrance?.order;
    assert.ok(frame); assert.deepEqual(other.saphoTruthOrderChoices,[]);
    assert.match(truth(other),/Continue without changing question order/);
    assert.match(table(other),/Continue without changing question order/);
    assert.doesNotMatch(truth(other),/Use Juice of Sapho to ask/);
    assert.doesNotMatch(truth(other),new RegExp(f.card));

    // Render real table controls, then invoke their actual hook-free leaf
    // callbacks. Server rendering does not operate a browser or hydration.
    const sent: Action[] = [];
    const pass = SaphoTruthOrderPass({frame,me:f.other,choices:other.saphoTruthOrderChoices,
      busy:false,act(action) {sent.push(action);}});
    assert.equal(pass.props.disabled,false); pass.props.onClick();
    assert.deepEqual([...sent],[{type:'truthOrderPass',event:frame.event,revision:frame.revision}]);
    game = act(game,f.other,sent.pop()!); assertRicheseParent(game,f.parent);

    const own = viewGame(game,f.owner), current = own.truthtrance?.order;
    assert.ok(current); assert.ok(current.passed.includes(f.other));
    const choice = own.saphoTruthOrderChoices.find(row => row.card === f.card && row.mode === f.mode);
    assert.ok(choice); assert.match(truth(own),new RegExp(`Use Juice of Sapho to ask ${f.mode}`));
    assert.match(table(own),new RegExp(`Use Juice of Sapho to ask ${f.mode}`));
    const use = SaphoTruthOrderChoiceButton({frame:current,me:f.owner,choices:own.saphoTruthOrderChoices,
      choice,busy:false,act(action) {sent.push(action);}});
    assert.equal(use.props.disabled,false); use.props.onClick();
    assert.deepEqual([...sent],[{type:'saphoTruthOrder',event:current.event,revision:current.revision,
      card:f.card,mode:f.mode}]);
    game = act(game,f.owner,sent.pop()!); assertRicheseParent(game,f.parent);
    assert.ok(game.pendingTreacheryDiscard?.reaction,'The fresh Sapho discard opens neutral Semuta');
    if (method === 'silent') checkSilentPrivacy(game,f.other);

    if (method === 'silent') {
      const event = game.pendingTreacheryDiscard.batch.event;
      assert.equal(viewGame(game,f.semutaHolder).semutaReaction?.canCommit,true);
      game = act(game,f.semutaHolder,{type:'semutaCommit',event});
      assert.ok(player(game,f.semutaHolder).hand.some(card => card.id === f.card));
      assert.ok(game.discard.some(card => card.id === f.semuta));
    } else game = passFreshDiscard(game);
    assertRicheseParent(game,f.parent);
    assert.equal(game.truthtrance?.stage,'ask');
    if (method === 'silent') checkSilentPrivacy(game,f.other);
    assert.deepEqual(inventory(game),f.originalCards);
    game = finishOriginalTruthQuestions(game);
    assert.equal(game.truthtrance,null); assertRicheseParent(game,f.parent);
    if (method === 'silent') checkSilentPrivacy(game,f.other);
    assert.deepEqual(inventory(game),f.originalCards);
    const resumed = game.richeseAuction; assert.ok(resumed);
    const bidder = method === 'silent'
      ? resumed.eligible.find(id => !Object.hasOwn(resumed.sealed,id))
      : resumed.active;
    assert.ok(bidder);
    game = act(game,bidder,{type:'richeseBid',event:resumed.event,
      amount:method === 'silent' ? 0 : null,allyPayment:0});
    assert.deepEqual(inventory(game),f.originalCards);
  },
);
