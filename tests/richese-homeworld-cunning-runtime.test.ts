import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { presenceAt } from '../game/force-presence';
import { territory } from '../game/board';
import { reserveShipmentCost } from '../game/shipment-price';
import { quoteRicheseHomeworldPair } from '../game/richese-homeworld-shipment';
import { botHomeworldShipmentPaymentAllowed } from '../game/homeworld-payment-options';
import {
  createRicheseHomeworldCunningFixture as fixture,
  actRicheseHomeworldCunning as act,
  commitRicheseHomeworldCunning as commit,
  revealRicheseHomeworldCunning as reveal,
  finishRicheseHomeworldCunning as finish,
  richeseHomeworldCunningPlayer as player,
  richeseHomeworldCunningInventory as inventory,
  richeseHomeworldCunningNexusInventory as nexusInventory,
  richeseHomeworldCunningPopulation as population,
} from './fixture-richese-homeworld-cunning';

for (const advanced of [false, true]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} native HIGH Cunning pays for eleven companions before its immediate five and retains a concealed three`, () => {
    const f = fixture({ advanced }); assert.ok(f.observer && f.nexusAlliance && f.nexusDraw);
    const before = structuredClone(player(f.game, f.owner));
    assert.equal(f.game.turn, 2); assert.equal(f.game.active, f.owner);
    assert.equal(player(f.game, f.holder).ally, f.observer);
    assert.equal(player(f.game, f.observer).ally, f.holder);
    assert.equal(before.ally, null); assert.equal(before.reserves, 20); assert.equal(before.spice, 12);
    assert.equal(f.game.nexusCards!.cards!.hands[f.owner], 'richese');
    assert.equal(f.nexusDraw.steps[0].action.type, 'nexusCardChoice');
    assert.equal(f.nexusDraw.steps[0].action.choice, 'draw');
    assert.equal(viewGame(f.game, f.owner).richeseNoField?.homeworldForcesEnabled, true);
    assert.deepEqual(f.pairQuote, { paid: 11, physical: 16, priced: 12, revealed: 5 });
    const action: Action = f.action;
    const result = commit(f.game, f, action), requested = player(result.requested, f.owner), after = player(result.game, f.owner);
    assert.equal(result.requested.response?.kind, 'richeseNoField');
    assert.equal(result.requested.pendingShipment?.amount, 1);
    assert.equal(result.requested.pendingShipment?.noFieldReserves, 11);
    assert.equal(result.requested.pendingShipment?.richesePair?.revealedTokenId, f.revealedToken);
    assert.equal(result.requested.pendingShipment?.noFieldSkillProof, undefined, 'The original pair frame owns its optional physical group');
    assert.equal(result.requested.pendingShipment?.cost, 12);
    assert.equal(requested.reserves, 20); assert.deepEqual(requested.forces, {}); assert.equal(requested.spice, 12);
    assert.deepEqual(requested.noField, before.noField); assert.equal(requested.shipped, false);
    assert.equal(result.requested.nexusCards!.cards!.hands[f.owner], null);
    assert.equal(result.requested.nexusCards!.cards!.discard.filter(card => card === 'richese').length, 1);
    assert.equal(result.requested.nexusRicheseCunningLast?.stage, 'pending');
    assert.equal(after.reserves, 4); assert.deepEqual(after.forces, { [f.location]: 16 });
    assert.equal(after.spice, 0); assert.equal(after.shipped, true); assert.equal(after.moved, 0);
    assert.equal(after.noField?.deployed?.tokenId, f.concealedToken);
    assert.equal(after.noField?.lastShipped, f.concealedToken);
    assert.equal(presenceAt(after, f.territory), 17);
    assert.equal(population(result.game).side, 'low');
    assert.equal(result.game.nexusRicheseCunningLast?.stage, 'shipped');
    assert.equal(result.game.nexusRicheseCunningHistory?.length, 1);
    const frame = JSON.parse(result.game.nexusRicheseCunningHistory![0].frame) as { noFieldReserves?: number };
    assert.equal(frame.noFieldReserves, 11);
    assert.equal(viewGame(result.game, f.holder).richeseNoField?.private, null);
    assert.equal(viewGame(result.game, f.holder).richeseNoField?.public.lastUsed, null);
    assert.ok(player(result.game, f.holder).hand.some(card => card.id === f.karama));
    const revealed = reveal(result.game, f), done = player(revealed.game, f.owner);
    assert.equal(done.reserves, 1); assert.deepEqual(done.forces, { [f.location]: 19 });
    assert.equal(done.noField?.deployed, null); assert.equal(done.noField?.lastShipped, f.concealedToken);
    assert.equal(done.spice, 0); assert.equal(done.moved, 0);
    assert.deepEqual(inventory(revealed.game), f.originalInventory);
    assert.deepEqual(nexusInventory(revealed.game), f.originalNexusInventory);
    assert.equal(f.sourceActionCount, f.actions.length);
  });
}

void test('sixteen genuine paid companions reserve stock before the immediate five; the concealed three later reveals zero', () => {
  const f = fixture({ companions: 16 });
  assert.equal(f.game.turn, 3);
  assert.deepEqual(f.funding.map(record => record.steps[0].action.amount), [10, 2]);
  assert.equal(player(f.game, f.owner).reserves, 20);
  assert.equal(player(f.game, f.owner).spice, 17);
  assert.deepEqual(f.pairQuote, { paid: 16, physical: 20, priced: 17, revealed: 4 });
  const result = commit(f.game, f), after = player(result.game, f.owner);
  assert.equal(after.spice, 0); assert.equal(after.reserves, 0);
  assert.deepEqual(after.forces, { [f.location]: 20 }); assert.equal(after.tanks, 0);
  assert.equal(after.noField?.deployed?.tokenId, f.concealedToken);
  const revealed = reveal(result.game, f), done = player(revealed.game, f.owner);
  assert.equal(done.reserves, 0); assert.deepEqual(done.forces, after.forces);
  assert.equal(done.noField?.deployed, null); assert.equal(done.noField?.lastShipped, f.concealedToken);
  assert.equal(done.spice, 0); assert.equal(done.tanks, 0);
  assert.equal(revealed.game.nexusCards!.cards!.discard.filter(card => card === 'richese').length, 1);
  assert.deepEqual(inventory(revealed.game), f.originalInventory);
  assert.deepEqual(nexusInventory(revealed.game), f.originalNexusInventory);
});

void test('the original Emperor Karama prevents the whole unpaid pair and paid group while its declared Nexus stays spent', () => {
  const f = fixture(), before = structuredClone(player(f.game, f.owner));
  const pending = act(f.game, f.owner, f.action);
  assert.equal(pending.response?.kind, 'richeseNoField');
  assert.equal(pending.nexusCards!.cards!.hands[f.owner], null);
  const stopped = finish(act(pending, f.holder, f.cancel)), after = player(stopped, f.owner);
  assert.equal(after.reserves, before.reserves); assert.deepEqual(after.forces, before.forces);
  assert.equal(after.spice, before.spice); assert.equal(after.shipped, false); assert.equal(after.moved, 0);
  assert.deepEqual(after.noField, before.noField); assert.equal(after.noFieldEvent, before.noFieldEvent);
  assert.equal(stopped.pendingShipment ?? null, null);
  assert.equal(stopped.nexusRicheseCunningLast?.stage, 'stopped');
  assert.equal(stopped.nexusCards!.cards!.hands[f.owner], null);
  assert.equal(stopped.nexusCards!.cards!.discard.filter(card => card === 'richese').length, 1);
  assert.equal(stopped.discard.filter(card => card.id === f.karama).length, 1);
  assert.equal(viewGame(stopped, f.owner).nexusRicheseCunning, null);
  const replacement = finish(act(stopped, f.owner, f.replacement)), replaced = player(replacement, f.owner);
  assert.equal(replaced.reserves, 19); assert.deepEqual(replaced.forces, { [f.location]: 1 });
  assert.equal(replaced.spice, before.spice - 1); assert.equal(replaced.shipped, true);
  assert.deepEqual(replaced.noField, before.noField);
  assert.deepEqual(inventory(replacement), f.originalInventory);
  assert.deepEqual(nexusInventory(replacement), f.originalNexusInventory);
});

void test('omitting the new reserve count preserves an original native pair priced as one with only its immediate token materialized', () => {
  const f = fixture();
  const legacy: Action = { type: 'ship', noField: f.concealedToken, event: f.event, revealedToken: f.revealedToken,
    nexus: f.nexusEvent, territory: f.territory, sector: f.sector, allyPayment: 0 };
  const result = commit(f.game, f, legacy), after = player(result.game, f.owner);
  assert.equal(result.requested.pendingShipment?.noFieldReserves, undefined);
  assert.equal(result.requested.pendingShipment?.noFieldSkillProof, undefined);
  assert.equal(result.requested.pendingShipment?.cost, 1);
  assert.equal(after.spice, player(f.game, f.owner).spice - 1);
  assert.equal(after.reserves, 15); assert.deepEqual(after.forces, { [f.location]: 5 });
  assert.equal(after.noField?.deployed?.tokenId, f.concealedToken);
  assert.equal(after.noField?.lastShipped, f.concealedToken);
  assert.equal(result.game.nexusRicheseCunningLast?.stage, 'shipped');
  assert.equal(result.game.nexusCards!.cards!.discard.filter(card => card === 'richese').length, 1);
  assert.deepEqual(inventory(result.game), f.originalInventory);
  assert.deepEqual(nexusInventory(result.game), f.originalNexusInventory);
});

void test('all four existing profiles retain a legal positive paid-group pair from the original Cunning offer', () => {
  const f = fixture();
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(f.game, f.owner); view.players.find(player => player.id === f.owner)!.bot = difficulty;
    const action = botActions(view).find(action => action.type === 'ship' && action.revealedToken &&
      action.nexus === f.nexusEvent && typeof action.noFieldReserves === 'number' && action.noFieldReserves > 0);
    assert.ok(action, `${difficulty} has a minimal positive paid Cunning companion path`);
    const token = player(f.game, f.owner).noField!.tokens.find(token => token.id === action.revealedToken); assert.ok(token);
    const quote = quoteRicheseHomeworldPair({ enabled: true, reserves: 20, amount: Number(action.noFieldReserves), revealedValue: token.value });
    const price = reserveShipmentCost({ faction: 'richese', halfRate: false }, territory(String(action.territory)).type, quote.priced);
    const result = commit(structuredClone(f.game), f, action), after = player(result.game, f.owner);
    assert.equal(after.reserves, 20 - quote.physical);
    assert.equal(Object.values(after.forces).reduce((total, count) => total + count, 0), quote.physical);
    assert.equal(after.spice, player(f.game, f.owner).spice - price);
    assert.equal(after.noField?.deployed?.tokenId, action.noField);
    assert.equal(after.shipped, true); assert.equal(after.moved, 0);
    assert.equal(result.game.nexusCards!.cards!.discard.filter(card => card === 'richese').length, 1);
    assert.equal(result.game.nexusRicheseCunningLast?.stage, 'shipped');
    assert.deepEqual(inventory(result.game), f.originalInventory);
    assert.deepEqual(nexusInventory(result.game), f.originalNexusInventory);
  }
});

void test('the shared AI payment guard admits the actual funded pair and rejects an unfunded paid group', () => {
  const f = fixture(), view = viewGame(f.game, f.owner), before = structuredClone(view);
  assert.equal(botHomeworldShipmentPaymentAllowed(view, f.action), true);
  assert.equal(botHomeworldShipmentPaymentAllowed(view, { ...f.action, noFieldReserves: 16 }), false,
    'Twenty available counters cannot fund a seventeen-spice invoice from the actual twelve-spice wallet');
  assert.deepEqual(view, before);
});
