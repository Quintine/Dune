import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { territory } from '../game/board';
import { reserveShipmentCost } from '../game/shipment-price';
import { quoteRicheseHomeworldPair } from '../game/richese-homeworld-shipment';
import { botHomeworldShipmentPaymentAllowed } from '../game/homeworld-payment-options';
import type { RicheseCunningRateSource } from '../game/richese-cunning-rate';
import {
  createRicheseCunningPurchasedRateFixture as fixture,
  actRicheseCunningPurchasedRate as act,
  passRicheseCunningPurchasedRate as pass,
  finishRicheseCunningPurchasedRate as finish,
  commitRicheseCunningPurchasedRate as commit,
  richeseCunningPurchasedRatePlayer as player,
  richeseCunningPurchasedRateInventory as inventory,
  richeseCunningPurchasedRateNexusInventory as nexusInventory,
} from './fixture-richese-cunning-purchased-rate';

function frame(game: Game) {
  const record = game.nexusRicheseCunningHistory?.at(-1); assert.ok(record);
  return JSON.parse(record.frame) as { cost: number; richesePair: { karama?: RicheseCunningRateSource } };
}
function reject(game: Game, actor: string, action: Action, reason?: RegExp) {
  const before = structuredClone(game);
  if (reason) assert.throws(() => applyAction(game, actor, action), reason);
  else assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

for (const advanced of [false, true]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} native three-seat Cunning uses Emperor's actual purchased rate for the combined twelve-unit invoice`, () => {
    const f = fixture({ advanced }), before = structuredClone(player(f.game, f.owner));
    assert.equal(f.guild, null); assert.ok(f.observer);
    assert.equal(player(f.beforePurchase, f.holder).hand.some(card => card.id === f.karama), true);
    assert.deepEqual(f.activation.steps[0], { actor: f.holder, action: f.activationAction });
    assert.equal(f.activationAction.mode, 'shipment'); assert.equal(f.activationAction.target, f.owner);
    assert.deepEqual(f.purchasedRate, { player: f.owner, owner: f.holder, card: f.karama });
    assert.equal(viewGame(f.game, f.owner).nexusRicheseCunning?.blocked, null);
    assert.equal(f.fullCost, 12); assert.equal(f.cost, 6);
    const result = commit(f.game, f), after = player(result.game, f.owner), saved = frame(result.game);
    assert.equal(saved.cost, 6); assert.deepEqual(saved.richesePair.karama, f.purchasedRate);
    assert.equal(Object.hasOwn(saved.richesePair.karama!, 'costClaimed'), false);
    assert.equal(before.spice - after.spice, 6);
    assert.equal(after.reserves, 4); assert.deepEqual(after.forces, { [f.location]: 16 });
    assert.equal(after.shipped, true); assert.equal(after.moved, 0);
    assert.equal(after.noField?.deployed?.tokenId, f.concealedToken);
    assert.equal(result.game.karamaShipping, null);
    assert.equal(result.game.nexusRicheseCunningLast?.stage, 'shipped');
    assert.equal(result.game.nexusCards!.cards!.discard.filter(card => card === 'richese').length, 1);
    assert.equal(result.game.discard.filter(card => card.id === f.karama).length, 1);
    assert.equal(player(result.game, f.holder).hand.some(card => card.id === f.karama), false);
    assert.deepEqual(inventory(result.game), f.originalInventory);
    assert.deepEqual(nexusInventory(result.game), f.originalNexusInventory);
    assert.equal(f.sourceActionCount, f.actions.length);
  });
}

void test('a genuine fourth Guild seat permits the purchased pair but receives none of its bank-paid fee', () => {
  const f = fixture({ advanced: true, guild: true }); assert.ok(f.guild && f.guildKarama && f.guildNexusPass);
  assert.notEqual(f.guildKarama, f.karama);
  assert.deepEqual(f.guildNexusPass.steps[0], { actor: f.guild, action: {
    type: 'nexusCardChoice', turn: 2, card: null, choice: 'keep', ownRedraws: 0,
  } });
  const guildSpice = player(f.game, f.guild).spice;
  const pending = act(f.game, f.owner, f.action);
  assert.equal(pending.response?.kind, 'richeseNoField');
  assert.equal(pending.pendingShipment?.cost, 6);
  assert.deepEqual(pending.pendingShipment?.richesePair?.karama, f.purchasedRate);
  const interception = pass(pending);
  assert.equal(interception.decision?.kind, 'guildShipment'); assert.equal(interception.decision?.player, f.guild);
  const result = finish(act(interception, f.guild, { type: 'decision', allow: true }));
  assert.equal(player(result, f.owner).spice, player(f.game, f.owner).spice - 6);
  assert.equal(player(result, f.guild).spice, guildSpice);
  assert.ok(player(result, f.guild).hand.some(card => card.id === f.guildKarama));
  assert.equal(result.karamaShipping, null);
  assert.equal(result.nexusRicheseCunningLast?.stage, 'shipped');
  assert.notEqual(result.response?.kind, 'guildIncome');
  assert.notEqual(result.response?.kind, 'guildRate');
  assert.deepEqual(inventory(result), f.originalInventory);
  assert.deepEqual(nexusInventory(result), f.originalNexusInventory);
});

void test('Guild cancelling the original No-Field retains Emperor’s grant for an ordinary bank-rate replacement', () => {
  const f = fixture({ advanced: true, guild: true }); assert.ok(f.guild && f.guildCancel);
  const before = structuredClone(player(f.game, f.owner)), guildSpice = player(f.game, f.guild).spice;
  const pending = act(f.game, f.owner, f.action);
  const stopped = finish(act(pending, f.guild, f.guildCancel)), after = player(stopped, f.owner);
  assert.equal(after.spice, before.spice); assert.equal(after.reserves, before.reserves);
  assert.deepEqual(after.forces, before.forces); assert.deepEqual(after.noField, before.noField);
  assert.equal(after.shipped, false); assert.equal(after.moved, 0);
  assert.deepEqual(stopped.karamaShipping, f.purchasedRate);
  assert.equal(stopped.nexusRicheseCunningLast?.stage, 'stopped');
  assert.equal(stopped.nexusCards!.cards!.hands[f.owner], null);
  assert.equal(stopped.nexusCards!.cards!.discard.filter(card => card === 'richese').length, 1);
  assert.equal(stopped.discard.filter(card => card.id === f.karama).length, 1);
  const replaced = finish(act(stopped, f.owner, f.replacement));
  assert.equal(player(replaced, f.owner).spice, before.spice - 1);
  assert.equal(player(replaced, f.owner).reserves, 19);
  assert.deepEqual(player(replaced, f.owner).forces, { [f.location]: 1 });
  assert.equal(player(replaced, f.guild).spice, guildSpice);
  assert.equal(replaced.karamaShipping, null);
  assert.equal(replaced.discard.filter(card => card.id === f.karama).length, 1);
  assert.deepEqual(inventory(replaced), f.originalInventory);
  assert.deepEqual(nexusInventory(replaced), f.originalNexusInventory);
});

void test('native Guild special prevention consumes the pair opportunity and refunds only the unclaimed original activation card', () => {
  const f = fixture({ advanced: true, guild: true }); assert.ok(f.guild && f.guildStop && f.guildKarama);
  const before = structuredClone(player(f.game, f.owner));
  const interception = pass(act(f.game, f.owner, f.action));
  assert.equal(interception.decision?.kind, 'guildShipment');
  const stopped = finish(act(interception, f.guild, f.guildStop)), after = player(stopped, f.owner);
  assert.equal(after.spice, before.spice); assert.equal(after.reserves, before.reserves);
  assert.deepEqual(after.forces, before.forces); assert.deepEqual(after.noField, before.noField);
  assert.equal(after.shipped, true); assert.equal(after.moved, 0);
  assert.equal(stopped.karamaShipping, null); assert.equal(stopped.pendingShipment ?? null, null);
  assert.equal(stopped.nexusRicheseCunningLast?.stage, 'stopped');
  assert.equal(stopped.nexusCards!.cards!.discard.filter(card => card === 'richese').length, 1);
  assert.ok(player(stopped, f.holder).hand.some(card => card.id === f.karama));
  assert.equal(stopped.discard.filter(card => card.id === f.karama).length, 0);
  assert.equal(stopped.discard.filter(card => card.id === f.guildKarama).length, 1);
  assert.equal(player(stopped, f.guild).specialKaramaUsed, true);
  assert.deepEqual(inventory(stopped), f.originalInventory);
  assert.deepEqual(nexusInventory(stopped), f.originalNexusInventory);
});

void test('one paid companion and legacy zero-companion city pairs each cost one and still route the purchased fee to Bank', () => {
  for (const companions of [0, 1]) {
    const f = fixture({ companions, guild: true }); assert.ok(f.guild);
    const guildSpice = player(f.game, f.guild).spice;
    assert.equal(f.cost, 1);
    const result = commit(f.game, f), saved = frame(result.game), after = player(result.game, f.owner);
    assert.deepEqual(saved.richesePair.karama, f.purchasedRate);
    assert.equal(saved.cost, 1);
    assert.equal(player(f.game, f.owner).spice - after.spice, 1);
    assert.equal(after.reserves, 20 - (companions + 5));
    assert.deepEqual(after.forces, { [f.location]: companions + 5 });
    assert.equal(player(result.game, f.guild).spice, guildSpice);
    assert.equal(result.game.karamaShipping, null);
    assert.deepEqual(inventory(result.game), f.originalInventory);
    assert.deepEqual(nexusInventory(result.game), f.originalNexusInventory);
  }
});

void test('CONTROLLED claimed-cost metadata preserves the actual rate identity but prevents another activation-card refund', () => {
  const f = fixture({ advanced: true, guild: true, costClaimed: true }); assert.ok(f.guild && f.guildStop && f.guildKarama);
  assert.equal(f.controlledCostClaimed, true); assert.equal(f.game.karamaShipping?.costClaimed, true);
  assert.ok(f.staging.some(line => line.startsWith('CONTROLLED SUPPLEMENT:')));
  const pending = act(f.game, f.owner, f.action);
  assert.equal(pending.pendingShipment?.cost, 6);
  assert.deepEqual(pending.pendingShipment?.richesePair?.karama,
    { player: f.owner, owner: f.holder, card: f.karama });
  const interception = pass(pending); assert.equal(interception.decision?.kind, 'guildShipment');
  const stopped = finish(act(interception, f.guild, f.guildStop));
  assert.equal(player(stopped, f.owner).reserves, 20);
  assert.deepEqual(player(stopped, f.owner).forces, {});
  assert.equal(player(stopped, f.holder).hand.some(card => card.id === f.karama), false);
  assert.equal(stopped.discard.filter(card => card.id === f.karama).length, 1);
  assert.equal(stopped.discard.filter(card => card.id === f.guildKarama).length, 1);
  assert.equal(stopped.karamaShipping, null);
  assert.deepEqual(inventory(stopped), f.originalInventory);
});

void test('CONTROLLED pending-origin changes reject even when the city invoice remains one spice', () => {
  const f = fixture({ companions: 0, guild: true }); assert.ok(f.guild && f.guildKarama);
  const pending = act(f.game, f.owner, f.action);
  assert.equal(pending.response?.kind, 'richeseNoField'); assert.equal(pending.pendingShipment?.cost, 1);
  for (const changed of [null, { ...f.purchasedRate, owner: f.guild }, { ...f.purchasedRate, card: f.guildKarama }]) {
    // CONTROLLED metadata edit to an actually declared native pending pair;
    // no card, force, phase or original fixture source is constructed here.
    const controlled = structuredClone(pending); controlled.karamaShipping = changed;
    reject(controlled, f.owner, { type: 'passResponse' });
  }
  const legacy: Action = { type: 'ship', noField: f.concealedToken, event: f.event,
    revealedToken: f.revealedToken, nexus: f.nexusEvent, territory: f.territory, sector: f.sector, allyPayment: 0 };
  const originallyFullPrice = act(f.beforePurchase, f.owner, legacy);
  assert.equal(originallyFullPrice.pendingShipment?.cost, 1);
  assert.equal(originallyFullPrice.pendingShipment?.richesePair?.karama, undefined);
  // CONTROLLED later card-omitted legacy grant. The pair itself was genuinely
  // declared without a purchase; no physical card moves or gets duplicated.
  const later = structuredClone(originallyFullPrice);
  later.karamaShipping = { player: f.owner, owner: f.holder };
  reject(later, f.owner, { type: 'passResponse' }, /original purchased Karama rate source/);
});

void test('the shared payment filter accepts a real sixteen-companion group affordable only under its purchased rate', () => {
  const f = fixture(), action = { ...f.action, noFieldReserves: 16 };
  assert.equal(player(f.game, f.owner).spice, 12);
  assert.equal(botHomeworldShipmentPaymentAllowed(viewGame(f.game, f.owner), action), true);
  assert.equal(botHomeworldShipmentPaymentAllowed(viewGame(f.beforePurchase, f.owner), action), false);
  const result = commit(f.game, f, action);
  assert.equal(player(result.game, f.owner).spice, 3);
  assert.equal(player(result.game, f.owner).reserves, 0);
  assert.deepEqual(player(result.game, f.owner).forces, { [f.location]: 20 });
  assert.equal(result.game.karamaShipping, null);
});

void test('all four existing profiles retain legal positive Cunning pair choices under the actual purchased rate', () => {
  const f = fixture();
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(f.game, f.owner); view.players.find(player => player.id === f.owner)!.bot = difficulty;
    const action = botActions(view).find(action => action.type === 'ship' && action.revealedToken &&
      action.nexus === f.nexusEvent && typeof action.noFieldReserves === 'number' && action.noFieldReserves > 0);
    assert.ok(action, `${difficulty} proposes a legal positive paid-group pair using the original purchased grant`);
    const revealed = player(f.game, f.owner).noField!.tokens.find(token => token.id === action.revealedToken); assert.ok(revealed);
    const quote = quoteRicheseHomeworldPair({ enabled: true, reserves: 20,
      amount: Number(action.noFieldReserves), revealedValue: revealed.value });
    const cost = reserveShipmentCost({ faction: 'richese', halfRate: true }, territory(String(action.territory)).type, quote.priced);
    const result = commit(structuredClone(f.game), f, action);
    assert.equal(player(result.game, f.owner).spice, player(f.game, f.owner).spice - cost);
    assert.equal(player(result.game, f.owner).reserves, 20 - quote.physical);
    assert.equal(result.game.karamaShipping, null);
    assert.equal(result.game.nexusRicheseCunningLast?.stage, 'shipped');
    assert.deepEqual(inventory(result.game), f.originalInventory);
    assert.deepEqual(nexusInventory(result.game), f.originalNexusInventory);
  }
});
