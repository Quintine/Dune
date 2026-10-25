import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { presenceAt } from '../game/force-presence';
import { reserveShipmentCost } from '../game/shipment-price';
import { territory } from '../game/board';
import { quoteRicheseHomeworldForces } from '../game/richese-homeworld-shipment';
import {
  createRicheseHomeworldShipmentFixture as fixture,
  actRicheseHomeworldShipment as act,
  commitRicheseHomeworldShipment as commit,
  revealRicheseHomeworldShipment as reveal,
  finishRicheseHomeworldShipment as finish,
  richeseHomeworldShipmentPlayer as player,
  richeseHomeworldShipmentPopulation as population,
  richeseHomeworldShipmentInventory as inventory,
} from './fixture-richese-homeworld-shipment';

function reject(game: Game, actor: string, action: Action, reason?: RegExp) {
  const before = structuredClone(game);
  if (reason) assert.throws(() => applyAction(game, actor, action), reason);
  else assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

for (const advanced of [false, true]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} native HIGH Richese commits eleven paid reserves and one concealed marker, then may reveal after crossing LOW`, () => {
    const f = fixture({ advanced }), before = structuredClone(player(f.game, f.owner));
    assert.equal(f.game.turn, 2); assert.equal(f.game.phase, 5); assert.equal(f.game.active, f.owner);
    assert.equal(f.funding.length, 1);
    assert.deepEqual(f.funding[0].steps, [{ actor: f.holder, action: { type: 'bribe', target: f.owner, amount: 7 } }]);
    assert.equal(before.spice, 12); assert.equal(before.bribes, 0); assert.equal(before.reserves, 20);
    assert.equal(before.shipped, false); assert.equal(before.moved, 0);
    assert.equal(population(f.game, f.owner).side, 'high');
    assert.equal(viewGame(f.game, f.owner).richeseNoField?.homeworldForcesEnabled, true);
    assert.deepEqual(quoteRicheseHomeworldForces({ enabled: true, reserves: before.reserves, amount: f.companions }),
      { paid: 11, physical: 11, priced: 12 });
    const action: Action = advanced ? { ...f.action, amount: 1 } : f.action;
    const result = commit(f.game, f, action), requested = player(result.requested, f.owner), after = player(result.game, f.owner);
    assert.equal(result.requested.response?.kind, 'richeseNoField');
    assert.equal(result.requested.pendingShipment?.noFieldReserves, 11);
    assert.equal(result.requested.pendingShipment?.cost, 12);
    assert.ok(result.requested.pendingShipment?.noFieldSkillProof);
    assert.equal(requested.reserves, before.reserves); assert.equal(requested.spice, before.spice);
    assert.equal(requested.shipped, false); assert.deepEqual(requested.forces, {});
    assert.deepEqual(requested.noField, before.noField); assert.equal(requested.noFieldEvent, before.noFieldEvent);
    assert.equal(after.reserves, 9); assert.deepEqual(after.forces, { [f.location]: 11 });
    assert.equal(after.spice, 0); assert.equal(after.shipped, true); assert.equal(after.moved, 0);
    assert.equal(after.noField?.deployed?.tokenId, f.token);
    assert.deepEqual(after.noField?.deployed?.location, { territory: f.territory, sector: f.sector });
    assert.equal(after.noField?.lastShipped, f.token);
    assert.notEqual(after.noFieldEvent, before.noFieldEvent);
    assert.equal(presenceAt(after, f.territory), 12, 'The marker counts once beside eleven physical counters');
    assert.equal(population(result.game, f.owner).side, 'low');
    assert.equal(viewGame(result.game, f.owner).richeseNoField?.homeworldForcesEnabled, false);
    const opponent = viewGame(result.game, f.holder);
    assert.equal(opponent.richeseNoField?.private, null);
    assert.equal(opponent.richeseNoField?.public.deployed?.effectiveForces, 1);
    assert.equal(opponent.richeseNoField?.public.lastUsed, null);
    assert.ok(player(result.game, f.holder).hand.some(card => card.id === f.karama));
    assert.deepEqual(inventory(result.game), f.originalInventory);
    const revealed = reveal(result.game, f), done = player(revealed.game, f.owner);
    assert.equal(done.noField?.deployed, null); assert.equal(done.noField?.lastShipped, f.token);
    assert.equal(done.reserves, 4); assert.deepEqual(done.forces, { [f.location]: 16 });
    assert.equal(done.spice, after.spice); assert.equal(done.moved, 0); assert.equal(done.shipped, true);
    reject(revealed.game, f.owner, revealed.action, /No concealed/);
    assert.deepEqual(inventory(revealed.game), f.originalInventory);
    assert.equal(f.sourceActionCount, f.actions.length);
  });
}

void test('the original single-marker omission still pays one without withdrawing HIGH physical reserves', () => {
  const f = fixture(), before = structuredClone(player(f.game, f.owner));
  const action: Action = { type: 'ship', noField: f.token, event: f.event,
    territory: f.territory, sector: f.sector, allyPayment: 0 };
  const result = commit(f.game, f, action), after = player(result.game, f.owner);
  assert.equal(result.requested.pendingShipment?.noFieldReserves, undefined);
  assert.equal(after.spice, before.spice - 1);
  assert.equal(after.reserves, 20); assert.deepEqual(after.forces, {});
  assert.equal(after.noField?.deployed?.tokenId, f.token);
  assert.equal(presenceAt(after, f.territory), 1);
  assert.equal(population(result.game, f.owner).side, 'high');
  assert.deepEqual(inventory(result.game), f.originalInventory);
});

void test('sixteen genuine paid companions leave only four native reserves for a printed five marker to reveal', () => {
  const f = fixture({ companions: 16 }), before = structuredClone(player(f.game, f.owner));
  assert.equal(f.game.turn, 3);
  assert.deepEqual(f.funding.map(record => record.steps[0].action.amount), [10, 2]);
  assert.ok(f.actions.some(step => step.actor === f.holder && step.action.type === 'charity'));
  assert.equal(before.spice, 17); assert.equal(before.reserves, 20);
  const result = commit(f.game, f), after = player(result.game, f.owner);
  assert.equal(after.reserves, 4); assert.deepEqual(after.forces, { [f.location]: 16 });
  assert.equal(before.spice - after.spice, 17);
  assert.equal(after.noField?.deployed?.tokenId, f.token);
  const revealed = reveal(result.game, f), done = player(revealed.game, f.owner);
  assert.equal(done.reserves, 0); assert.deepEqual(done.forces, { [f.location]: 20 });
  assert.equal(done.tanks, 0); assert.equal(done.noField?.deployed, null);
  assert.equal(done.noField?.lastShipped, f.token);
  assert.deepEqual(inventory(revealed.game), f.originalInventory);
});

void test('the genuinely dealt opposing Karama prevents the entire unpaid mixed declaration and preserves ordinary replacement shipment', () => {
  const f = fixture(), before = structuredClone(player(f.game, f.owner));
  const pending = act(f.game, f.owner, f.action);
  assert.equal(pending.response?.kind, 'richeseNoField');
  assert.equal(pending.pendingShipment?.noFieldReserves, 11);
  const prevented = finish(act(pending, f.holder, f.cancel)), after = player(prevented, f.owner);
  assert.equal(after.reserves, before.reserves); assert.equal(after.spice, before.spice);
  assert.deepEqual(after.forces, before.forces); assert.deepEqual(after.noField, before.noField);
  assert.equal(after.noFieldEvent, before.noFieldEvent);
  assert.equal(after.shipped, false); assert.equal(after.moved, 0);
  assert.equal(prevented.pendingShipment ?? null, null);
  assert.equal(prevented.discard.filter(card => card.id === f.karama).length, 1);
  reject(prevented, f.owner, f.action, /prevented No-Field/);
  const replaced = finish(act(prevented, f.owner, f.replacement)), replacement = player(replaced, f.owner);
  assert.equal(replacement.reserves, before.reserves - 1);
  assert.deepEqual(replacement.forces, { [f.location]: 1 });
  assert.equal(replacement.spice, before.spice - 1);
  assert.equal(replacement.shipped, true); assert.equal(replacement.moved, 0);
  assert.deepEqual(replacement.noField, before.noField);
  assert.deepEqual(inventory(replaced), f.originalInventory);
});

void test('mixed payloads preserve the one-marker amount and require positive available physical reserves', () => {
  const f = fixture();
  reject(f.game, f.owner, { ...f.action, amount: 2 }, /one No-Field/);
  reject(f.game, f.owner, { ...f.action, noFieldReserves: 0 });
  reject(f.game, f.owner, { ...f.action, noFieldReserves: 21 });
  reject(f.game, f.owner, { ...f.replacement, noFieldReserves: 1 });
  assert.deepEqual(inventory(f.game), f.originalInventory);
});

void test('all four existing profiles propose a legal positive companion shipment through the native response and payment', () => {
  const f = fixture();
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(f.game, f.owner); view.players.find(player => player.id === f.owner)!.bot = difficulty;
    const action = botActions(view).find(action => action.type === 'ship' && action.noField &&
      typeof action.noFieldReserves === 'number' && action.noFieldReserves > 0);
    assert.ok(action, `${difficulty} retains a minimal positive HIGH companion path`);
    const companions = Number(action.noFieldReserves);
    const priced = 1 + companions;
    const expectedCost = reserveShipmentCost({ faction: 'richese', halfRate: false },
      territory(String(action.territory)).type, priced);
    const result = commit(structuredClone(f.game), f, action), after = player(result.game, f.owner);
    assert.equal(after.reserves, 20 - companions);
    assert.equal(Object.values(after.forces).reduce((total, count) => total + count, 0), companions);
    assert.equal(after.spice, player(f.game, f.owner).spice - expectedCost);
    assert.equal(after.shipped, true); assert.equal(after.moved, 0);
    assert.ok(after.noField?.deployed);
    assert.deepEqual(inventory(result.game), f.originalInventory);
  }
});
