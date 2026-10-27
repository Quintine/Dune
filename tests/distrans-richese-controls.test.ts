import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DistransTransferAction, type DistransTransferActionProps } from '../components/distrans-transfer-action';
import { viewGame, type Action, type GameView } from '../game/engine';
import { actDistransPrebid, distransPrebidInventory, distransPrebidPlayer } from './fixture-distrans-prebid';
import { createDistransRichesePrebidFixture } from './fixture-distrans-richese-prebid';

const aliases = registerHooks({
  resolve(specifier, context, next) {
    return next(specifier === 'next/image' ? 'vinext/shims/image' : specifier, context);
  },
});
const { Distrans } = await import('../components/distrans');
aliases.deregister();

function markup(game: GameView) {
  return renderToStaticMarkup(createElement(Distrans, { game, busy: false, act() {} }));
}
function transferButton(html: string) {
  const button = html.match(/<button\b(?=[^>]*data-testid="distrans-transfer")[^>]*>[\s\S]*?<\/button>/)?.[0];
  assert.ok(button, 'The projected transfer action is present');
  return button;
}

for (const advanced of [false, true]) for (const method of ['onceAround', 'silent'] as const) {
  void test(`${advanced ? 'Advanced' : 'Basic'} ${method} native unopened lot projects and executes the Distrans control`, () => {
    const f = createDistransRichesePrebidFixture({ advanced, method });
    const before = structuredClone(f.game), view = viewGame(f.game, f.holder), quote = view.distrans;
    assert.ok(quote);
    assert.equal(quote.blocked, null);
    const choice = quote.choices.find(candidate => candidate.recipient === f.recipient);
    assert.ok(choice);
    assert.equal(choice.blocked, null);
    const given = choice.cards.find(card => card.id === f.give);
    assert.ok(given);
    const html = markup(view);
    assert.doesNotMatch(transferButton(html), /\sdisabled=/);
    assert.match(html, /ordinary, Once Around or normal Black Market lot/);
    assert.match(html, /first sealed submission in a Silent lot/);

    // Stateful selectors render above; exercise the real action leaf with the
    // exact entitled recipient/card choice from the native engine projection.
    const actions: Action[] = [];
    const props: DistransTransferActionProps = {
      card: quote.card,
      recipient: { id: choice.recipient, name: view.players.find(player => player.id === choice.recipient)?.name },
      given, reason: null, reasonId: 'native-richese-reason', busy: false,
      act(action) { actions.push(action); },
    };
    const button = DistransTransferAction(props);
    button.props.onClick();
    assert.deepEqual(actions, [f.action]);
    const after = actDistransPrebid(f.game, f.holder, actions[0]);
    assert.deepEqual(f.game, before);
    assert.ok(!distransPrebidPlayer(after, f.holder).hand.some(card => card.id === f.give || card.id === f.card));
    assert.equal(distransPrebidPlayer(after, f.recipient).hand.filter(card => card.id === f.give).length, 1);
    assert.equal(after.discard.filter(card => card.id === f.card).length, 1);
    assert.deepEqual(distransPrebidInventory(after), f.originalInventory);
    assert.equal(after.richeseAuction?.event, before.richeseAuction?.event);
    assert.equal(after.richeseAuction?.method, method);

    const lot = before.richeseAuction!;
    const actor = method === 'onceAround' ? lot.active! :
      lot.order.find(id => lot.eligible.includes(id) && !Object.hasOwn(lot.sealed, id))!;
    const started = actDistransPrebid(before, actor, { type: 'richeseBid', event: lot.event,
      amount: method === 'onceAround' ? null : 0, allyPayment: 0 });
    const blocked = viewGame(started, f.holder);
    assert.ok(blocked.distrans?.blocked);
    assert.match(transferButton(markup(blocked)), /\sdisabled=/);
  });
}
