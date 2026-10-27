import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { viewGame, type Action, type GameView } from '../game/engine';
import { SaphoTruthOrderPass, SaphoTruthOrderChoiceButton } from '../components/sapho-truth-order';
import { act, inventory, createSaphoTruthAuctionFixture, assertAuctionParent } from './fixture-sapho-truth-auction';
import { passFreshDiscard, finishOriginalTruthQuestions } from './fixture-sapho-truth-order';

const aliases = registerHooks({
  resolve(specifier, context, next) {
    return next(specifier === 'next/image' ? 'vinext/shims/image' : specifier === 'next/link' ? 'vinext/shims/link' : specifier, context);
  },
  load(url, context, next) {
    if (!url.endsWith('.module.css')) return next(url, context);
    const css = readFileSync(new URL(url), 'utf8');
    const classes = Object.fromEntries([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(match => [match[1], match[1]]));
    return {format:'module',source:`export default ${JSON.stringify(classes)}`,shortCircuit:true};
  },
});
const {GameTable} = await import('../components/game-table');
const {Truthtrance} = await import('../components/truthtrance');
aliases.deregister();
const table = (game: GameView) => renderToStaticMarkup(createElement(GameTable,
  {game,busy:false,send:async()=>{},onExit() {}}));
const truth = (game: GameView) => renderToStaticMarkup(createElement(Truthtrance,
  {game,busy:false,act() {}}));

for (const advanced of [false,true]) void test(
  `${advanced ? 'Advanced' : 'Basic'} actual Truth-order controls preserve a standing ordinary bid`, () => {
    // Original public setup, genuinely purchased Sapho, actual ordinary lot
    // and standing bid. A labeled conserved card swap gives its holder an
    // original Truth; this does not claim a native earned Truth acquisition.
    const f = createSaphoTruthAuctionFixture({advanced,standingBid:true,mode:'first'});
    let game = f.game;
    assertAuctionParent(game,f.parent);
    const other = viewGame(game,f.other), frame = other.truthtrance?.order;
    assert.ok(frame); assert.deepEqual(other.saphoTruthOrderChoices,[]);
    assert.match(truth(other),/Continue without changing question order/);
    assert.match(table(other),/Continue without changing question order/);
    assert.doesNotMatch(truth(other),/Use Juice of Sapho to ask/);

    // Invoke the actual rendered leaf callbacks. Server rendering does not
    // exercise a stateful browser, selectors or hydration.
    const sent:Action[] = [];
    const pass = SaphoTruthOrderPass({frame,me:f.other,choices:other.saphoTruthOrderChoices,
      busy:false,act(action) { sent.push(action); }});
    assert.equal(pass.props.disabled,false); pass.props.onClick();
    assert.deepEqual([...sent],[{type:'truthOrderPass',event:frame.event,revision:frame.revision}]);
    game = act(game,f.other,sent.pop()!); assertAuctionParent(game,f.parent);
    const owner = viewGame(game,f.owner), order = owner.truthtrance?.order;
    assert.ok(order); assert.ok(order.passed.includes(f.other));
    const choice = owner.saphoTruthOrderChoices.find(row => row.card === f.card && row.mode === 'first');
    assert.ok(choice); assert.match(truth(owner),/Use Juice of Sapho to ask first/);
    assert.match(table(owner),/Use Juice of Sapho to ask first/);
    const use = SaphoTruthOrderChoiceButton({frame:order,me:f.owner,choices:owner.saphoTruthOrderChoices,
      choice,busy:false,act(action) { sent.push(action); }});
    assert.equal(use.props.disabled,false); use.props.onClick();
    assert.deepEqual([...sent],[{type:'saphoTruthOrder',event:order.event,revision:order.revision,
      card:f.card,mode:'first'}]);
    game = act(game,f.owner,sent.pop()!); assertAuctionParent(game,f.parent);
    // Basic can open the neutral Semuta discard response. Finish real passes
    // before resuming the original questions; the invoice remains committed.
    game = passFreshDiscard(game); assertAuctionParent(game,f.parent);
    assert.equal(game.truthtrance?.stage,'ask');
    assert.equal(game.truthtrance.queue[0].player,f.owner);
    game = finishOriginalTruthQuestions(game);
    assert.equal(game.truthtrance,null); assertAuctionParent(game,f.parent);
    assert.deepEqual(inventory(game),f.originalCards);
    const actor = game.auction!.active, original = structuredClone(game.auction!);
    game = act(game,actor,{type:'passBid'});
    assert.ok(game.auction); assert.equal(game.auction.index,original.index);
    assert.equal(game.auction.cards[original.index].id,original.cards[original.index].id);
    assert.equal(game.auction.bid,original.bid); assert.equal(game.auction.bidder,original.bidder);
    assert.ok(game.auction.passed.includes(actor));
    assert.deepEqual(inventory(game),f.originalCards);
  },
);
