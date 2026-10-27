import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { viewGame, type Action, type Game, type GameView } from '../game/engine';
import { RicheseBidPromiseGuide } from '../components/richese-bid-promise-panel';
import { act, inventory, createTruthRicheseSilentFixture, askTruthRicheseSilent } from './fixture-truth-richese-silent';

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
const { RicheseAuctionLot } = await import('../components/richese-auctions');
aliases.deregister();

function table(game: GameView) {
  return renderToStaticMarkup(createElement(GameTable, { game, busy: false, send: async () => {}, onExit() {} }));
}
function truth(game: GameView) {
  return renderToStaticMarkup(createElement(Truthtrance, { game, busy: false, act() {} }));
}
function auction(game: GameView) {
  return renderToStaticMarkup(createElement(RicheseAuctionLot, { game, busy: false, act() {} }));
}
function declare(game: Game, asker: string, truthCard: string): Game {
  let current = act(game, asker, { type:'card', card:truthCard });
  for (let count = 0; current.truthtrance?.stage === 'priority' && count < current.players.length; count++) {
    const seat = current.players.find(row => !current.truthtrance!.passed.includes(row.id)); assert.ok(seat);
    current = act(current, seat.id, {type:'truthPass'});
  }
  assert.equal(current.truthtrance?.stage, 'ask');
  return current;
}

for (const advanced of [false, true]) void test(
  `${advanced ? 'Advanced' : 'Basic'} real Silent question, answer and guide connect to the original private auction`, () => {
    // Native public R/A/E setup, originally dealt Truth card and actual Silent
    // cache; the fixture selects unopened deal/Spice positions and lotteries.
    const f = createTruthRicheseSilentFixture(advanced);
    const declared = declare(f.game, f.asker, f.truth);
    const asker = viewGame(declared, f.asker);
    assert.equal(asker.richeseAuction?.method, 'silent');
    assert.ok(asker.truthRicheseBidTargets.includes(f.target));
    assert.match(truth(asker), /<option value="richeseBid">Bind a bid in this Richese lot<\/option>/);
    assert.match(table(asker), /Bind a bid in this Richese lot/);
    // Server rendering does not operate the stateful question selector or
    // browser hydration; submit the original question through the engine.
    const asked = askTruthRicheseSilent(f, 4);
    const respondent = viewGame(asked, f.target);
    assert.equal(respondent.truthtrance?.question?.kind, 'richeseBid');
    assert.ok(respondent.truthRicheseBidAnswers?.includes('yes'));
    assert.ok(respondent.truthRicheseBidAnswers?.includes('no'));
    assert.equal(viewGame(asked, f.asker).truthRicheseBidAnswers, null);
    assert.match(truth(respondent), /Answer Yes/);
    assert.match(truth(respondent), /Answer No/);
    assert.match(table(respondent), /Answer Yes/);
    assert.match(auction(respondent), /Silent auction/);

    for (const answer of ['yes', 'no'] as const) {
      let game = act(asked, f.target, {type:'truthAnswer', answer});
      const own = viewGame(game, f.target), sent: Action[] = [];
      assert.ok(own.richeseBidPromises.some(row => row.player === f.target && row.answer === (answer === 'yes')));
      assert.ok(own.richeseBidPromiseGuide);
      const html = table(own);
      assert.match(html, /Your Silent bid promises/);
      assert.match(html, /data-testid="richese-bid-promise-guide"/);
      if (answer === 'no') assert.match(html, /Submit zero spice while honoring your answer/);
      const button = RicheseBidPromiseGuide({promises:own.richeseBidPromises, guide:own.richeseBidPromiseGuide,
        game:own, busy:false, act(action) { sent.push(action); }});
      assert.ok(button); assert.equal(button.props.disabled, false);
      button.props.onClick();
      assert.deepEqual(sent, [own.richeseBidPromiseGuide.action]);
      assert.equal(sent[0].type, 'richeseBid');
      assert.equal(sent[0].event, f.lot);
      assert.equal(sent[0].amount, answer === 'yes' ? 4 : 0);
      assert.equal(typeof sent[0].richeseBidPromiseId, 'string');
      game = act(game, f.target, sent[0]);
      assert.equal(game.richeseBidPromises!.find(row => row.id === sent[0].richeseBidPromiseId)?.fulfilled, true);
      const submitted = viewGame(game, f.target), observer = viewGame(game, f.owner);
      assert.equal(submitted.richeseAuction?.ownBid, answer === 'yes' ? 4 : 0);
      assert.equal(observer.richeseAuction?.ownBid, null);
      assert.equal(observer.richeseAuction?.revealedBids, null);
      assert.ok(observer.richeseAuction?.submitted.includes(f.target));
      assert.equal(Object.hasOwn(observer.richeseAuction!, 'sealed'), false);
      assert.match(auction(submitted), /Your sealed bid:/);
      assert.doesNotMatch(auction(observer), /Your sealed bid:/);
      assert.doesNotMatch(table(observer), /Your sealed bid:/);
      assert.deepEqual(inventory(game), f.originalCards);
    }
  },
);
