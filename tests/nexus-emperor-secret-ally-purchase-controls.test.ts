import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NexusEmperorSecretAlly } from '../components/nexus-emperor-secret-ally';
import { botActions } from '../game/bots';
import { applyAction, viewGame, type GameView } from '../game/engine';
import { nexusEmperorPurchaseAction } from '../game/nexus-emperor-secret-ally-options';
import { wonEmperorNexusBankAuction } from './fixture-nexus-emperor-purchase';

const owner = 'q';
const html = (view: GameView, busy = false) =>
  renderToStaticMarkup(createElement(NexusEmperorSecretAlly, { game: view, act() {}, busy }));

for (const advanced of [false, true])
  void test(`${advanced ? 'Advanced' : 'Basic'} owner sees a private bank-paid choice and every bot profile can keep its own funded bid`, () => {
    const g = wonEmperorNexusBankAuction(advanced);
    const v = viewGame(g, owner);
    assert.equal(v.nexusEmperorSecretAlly?.purchase?.blocked, null);
    assert.equal(v.nexusEmperorSecretAlly?.purchase?.price, 2);
    assert.deepEqual(nexusEmperorPurchaseAction(v), {
      type: 'nexusEmperorPurchase', event: v.nexusEmperorSecretAlly!.event,
    });
    const text = html(v);
    assert.match(text, /final bid is 2 spice/);
    assert.match(text, /all 2 spice.*own supply without ally aid/);
    assert.match(text, /keep that spice instead of paying the bank/);
    assert.doesNotMatch(text, /disabled=""/);
    assert.match(html(v, true), /disabled=""/);
    assert.equal(text.includes(g.auction!.cards[g.auction!.index].name), false);
    for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
      const ownView = viewGame(g, owner);
      ownView.players.find((player) => player.id === owner)!.bot = difficulty;
      const [action] = botActions(ownView);
      assert.deepEqual(action, nexusEmperorPurchaseAction(ownView));
      const after = applyAction(g, owner, action);
      assert.equal(after.players.find((player) => player.id === owner)!.spice, g.players.find((player) => player.id === owner)!.spice);
      assert.ok(after.players.find((player) => player.id === owner)!.hand.some((card) => card.id === g.auction!.cards[g.auction!.index].id));
      assert.equal(after.nexusCards!.cards!.hands[owner], null);
    }
  });

void test('blocked, underfunded, interrupted and foreign owners have no purchase control or bot candidate', () => {
  const g = wonEmperorNexusBankAuction(false);
  for (const id of ['p', 'r']) {
    const v = viewGame(g, id);
    assert.equal(v.nexusEmperorSecretAlly, null);
    assert.equal(nexusEmperorPurchaseAction(v), null);
    assert.equal(html(v), '');
    assert.ok(!botActions(v).some((action) => action.type === 'nexusEmperorPurchase'));
  }
  const owned = viewGame(g, owner);
  const blocked = structuredClone(owned);
  blocked.nexusEmperorSecretAlly!.purchase!.blocked = 'Finish this payment first.';
  assert.equal(nexusEmperorPurchaseAction(blocked), null);
  assert.match(html(blocked), /Finish this payment first/);
  assert.match(html(blocked), /disabled=""/);
  const underfunded = structuredClone(owned);
  underfunded.players.find((player) => player.id === owner)!.spice = 1;
  assert.equal(nexusEmperorPurchaseAction(underfunded), null);
  assert.match(html(underfunded), /disabled=""/);
  assert.match(html(underfunded), /need 2 spice in your own supply/);
  const interrupted = structuredClone(owned);
  interrupted.automaticContinuationPending = true;
  assert.equal(nexusEmperorPurchaseAction(interrupted), null);
  assert.match(html(interrupted), /disabled=""/);
  const foreignDecision = structuredClone(owned);
  foreignDecision.decision = { kind: 'auctionPayment', player: 'r' };
  assert.equal(nexusEmperorPurchaseAction(foreignDecision), null);
  assert.equal(html(foreignDecision), '');
});
