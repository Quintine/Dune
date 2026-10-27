import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { viewGame, type Action, type GameView } from '../game/engine';
import { PhaseBidPromiseGuideButton } from '../components/phase-bid-promises';
import { actTruthTurnBid, advanceTruthTurnBid, bindTruthTurnBid,
  createTruthTurnBidFixture, truthTurnBidClean } from './fixture-truth-turn-bid';
import { truthBidInventory } from './fixture-truth-bid';

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

function table(game: GameView) {
  return renderToStaticMarkup(createElement(GameTable, { game, busy: false, send: async () => {}, onExit() {} }));
}
function truth(game: GameView) {
  return renderToStaticMarkup(createElement(Truthtrance, { game, busy: false, act() {} }));
}

for (const advanced of [false, true]) void test(
  `${advanced ? 'Advanced' : 'Basic'} actual phase-bid question, private answer and current owned guide connect to the original table`, () => {
    // Genuine original public setup/card deal and actual question/answer; the
    // selected unopened deck/Spice positions are documented by the source fixture.
    const f = createTruthTurnBidFixture({ advanced }), b = bindTruthTurnBid(f, 'yes');
    const asker = viewGame(b.declared.game, f.asker);
    assert.ok(asker.truthPhaseBidTargets.includes(f.target));
    const authored = truth(asker);
    assert.match(authored, /<option value="phaseBid">Bind a bid this Bidding phase<\/option>/);
    assert.match(table(asker), /Bind a bid this Bidding phase/);
    // Server rendering does not operate the stateful question selector; the
    // fixture's actual native question is submitted by its engine action.
    const respondent = viewGame(b.asked, f.target);
    assert.deepEqual(respondent.truthtrance?.question, f.phaseQuestion);
    assert.ok(respondent.truthPhaseBidAnswers?.includes('yes'));
    assert.ok(respondent.truthPhaseBidAnswers?.includes('no'));
    assert.equal(viewGame(b.asked, f.asker).truthPhaseBidAnswers, null);
    const answers = truth(respondent);
    assert.match(answers, /Answer Yes/);
    assert.match(answers, /Answer No/);
    assert.match(table(respondent), /Answer Yes/);
    let game = advanceTruthTurnBid(b.game,
      state => truthTurnBidClean(state) && state.phase === 3 && state.auction?.active === f.target);
    const own = viewGame(game, f.target), sent: Action[] = [];
    assert.ok(own.phaseBidPromises.some(promise => promise.player === f.target && promise.answer));
    assert.ok(own.phaseBidPromiseGuide);
    const html = table(own);
    assert.match(html, /Your Bidding phase promises/);
    assert.match(html, /data-testid="phase-bid-promise-guide"/);
    const button = PhaseBidPromiseGuideButton({ game: own, busy: false, send(action) { sent.push(action); } });
    assert.ok(button);
    assert.equal(button.props.disabled, false);
    button.props.onClick();
    assert.deepEqual(sent, [own.phaseBidPromiseGuide.action]);
    assert.equal(typeof sent[0].phaseBidPromiseEvent, 'string');
    assert.equal(sent[0].phaseBidPromiseLot, own.bidPromiseLot!.lot);
    game = actTruthTurnBid(game, f.target, sent[0]);
    assert.equal(game.phaseBidPromises!.find(promise => promise.event === sent[0].phaseBidPromiseEvent)?.fulfilled, true);
    assert.deepEqual(truthBidInventory(game), f.originalInventory);
  },
);
