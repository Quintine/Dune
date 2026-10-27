import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { viewGame, type Action, type GameView } from '../game/engine';
import { RicheseBidPromiseGuide } from '../components/richese-bid-promise-panel';
import { act, inventory, createTruthRicheseBidFixture, declareTruthRicheseBid,
  askTruthRicheseBid } from './fixture-truth-richese-bid';

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

for (const advanced of [false, true]) void test(
  `${advanced ? 'Advanced' : 'Basic'} real Once Around question, answers and guide connect to the original Richese table`, () => {
    // Original public R/A/E setup, actual dealt Truth and native cache lot.
    // The fixture selects only unopened original deal/Spice positions and scalar lotteries.
    const f = createTruthRicheseBidFixture(advanced);
    const source = act(f.game, f.asker, { type: 'richeseBid', event: f.lot, amount: null });
    assert.equal(source.richeseAuction?.active, f.target);
    const declared = declareTruthRicheseBid(f, source);
    const asker = viewGame(declared, f.asker);
    assert.ok(asker.truthRicheseBidTargets.includes(f.target));
    assert.match(truth(asker), /<option value="richeseBid">Bind a bid in this Richese lot<\/option>/);
    assert.match(table(asker), /Bind a bid in this Richese lot/);
    // Server rendering does not operate the stateful question selector; the
    // original question is submitted through the real engine fixture.
    const asked = askTruthRicheseBid(f, f.target, 4, source);
    const respondent = viewGame(asked, f.target);
    assert.equal(respondent.truthtrance?.question?.kind, 'richeseBid');
    assert.ok(respondent.truthRicheseBidAnswers?.includes('yes'));
    assert.ok(respondent.truthRicheseBidAnswers?.includes('no'));
    assert.equal(viewGame(asked, f.asker).truthRicheseBidAnswers, null);
    assert.match(truth(respondent), /Answer Yes/);
    assert.match(truth(respondent), /Answer No/);
    assert.match(table(respondent), /Answer Yes/);
    assert.match(auction(respondent), /Richese auction/);

    for (const answer of ['yes', 'no'] as const) {
      let game = act(asked, f.target, { type: 'truthAnswer', answer });
      const own = viewGame(game, f.target), sent: Action[] = [];
      assert.ok(own.richeseBidPromises.some(promise => promise.player === f.target && promise.answer === (answer === 'yes')));
      assert.ok(own.richeseBidPromiseGuide);
      const html = table(own);
      assert.match(html, /Your Once Around bid promises/);
      assert.match(html, /data-testid="richese-bid-promise-guide"/);
      assert.match(auction(own), /Richese auction/);
      const button = RicheseBidPromiseGuide({ promises: own.richeseBidPromises, guide: own.richeseBidPromiseGuide,
        game: own, busy: false, act(action) { sent.push(action); } });
      assert.ok(button); assert.equal(button.props.disabled, false);
      button.props.onClick();
      assert.deepEqual(sent, [own.richeseBidPromiseGuide.action]);
      assert.equal(sent[0].type, 'richeseBid');
      assert.equal(sent[0].event, f.lot);
      assert.equal(typeof sent[0].richeseBidPromiseId, 'string');
      game = act(game, f.target, sent[0]);
      assert.equal(game.richeseBidPromises!.find(promise => promise.id === sent[0].richeseBidPromiseId)?.fulfilled, true);
      assert.deepEqual(inventory(game), f.originalCards);
    }
  },
);
