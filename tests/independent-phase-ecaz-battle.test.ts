import assert from 'node:assert/strict';
import test from 'node:test';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import { HARASS_WITHDRAW_CARD } from '../game/harass-withdraw';
import { ownedTech } from '../game/tech-tokens';
import { viewGame } from '../game/engine';
import { phaseModuleEcazInventory as inventory, phaseModuleEcazPlayer as player } from './fixture-phase-module-ecaz';
import { createIndependentPhaseEcazFixture as fixture, resolveIndependentPhaseEcaz as resolve } from './fixture-independent-phase-ecaz';

for (const advanced of [false, true]) for (const lead of ['ecaz', 'ally'] as const)
  void test(`mixed independent ${advanced ? 'Advanced Stronghold+Tech' : 'Basic Tech'} ${lead} coalition pays physical fees and withdraws only the card user before winner Tech`, () => {
    const f = fixture({ advanced, lead }), before = structuredClone(f.game);
    assert.equal(before.ecazTreachery, true); assert.equal(f.originalInventory.length, 50);
    assert.deepEqual(before.expansions, ['ix', 'choam', 'ecaz']);
    const own = viewGame(before, f.actor).battle!;
    assert.equal(own.reinforcements?.blocked, null); assert.equal(own.harassWithdraw?.blocked, null);
    const { game, quote, actions } = resolve(f);
    assert.deepEqual(f.game, before);
    const nonLead = f.actor === f.ecaz ? f.ally : f.ecaz;
    assert.equal(quote.winner, f.actor); assert.equal(game.lastBattleContext!.winner, f.actor);
    assert.deepEqual(quote.reinforcements, [{ player: f.actor, card: REINFORCEMENTS_CARD, normal: 3, elite: 0 }]);
    const returned = lead === 'ecaz' ? { normal: 2, elite: 0 } : { normal: 2, elite: 3 };
    const withdrawal = quote.harassWithdraw!.find(entry => entry.player === f.actor)!;
    assert.deepEqual(withdrawal.returned, returned);
    assert.equal(quote.harassWithdraw!.length, 1);
    assert.deepEqual(quote.fixedLosses, [{ owner: f.ecaz, normal: advanced ? 3 : 2, elite: 0 }]);
    assert.equal(quote.casualties!.owner, f.ally);
    assert.deepEqual(quote.casualties!.options, [{ normal: 1, elite: 0, paidNormal: 0, paidElite: 0 }]);
    assert.equal(player(game, f.actor).reserves, player(before, f.actor).reserves - 3 + returned.normal + returned.elite);
    assert.equal(player(game, nonLead).reserves, player(before, nonLead).reserves);
    assert.equal(player(game, f.ecaz).tanks - player(before, f.ecaz).tanks, (advanced ? 3 : 2) + (lead === 'ecaz' ? 3 : 0));
    assert.equal(player(game, f.ally).tanks - player(before, f.ally).tanks, 1 + (lead === 'ally' ? 3 : 0));
    assert.equal(player(game, f.ally).elites!.tanks, player(before, f.ally).elites!.tanks);
    assert.equal(player(game, f.ecaz).forces[f.location] ?? 0, lead === 'ecaz' ? 0 : 2);
    assert.equal(player(game, f.ally).forces[f.location] ?? 0, lead === 'ally' ? 0 : 5);
    assert.equal(player(game, f.ally).elites!.forces[f.location] ?? 0, lead === 'ally' ? 0 : 3);
    assert.equal(game.techTokens![f.enemyToken].owner, f.actor);
    assert.equal(ownedTech(game.techTokens, f.actor).length, 2); assert.equal(ownedTech(game.techTokens, nonLead).length, 1);
    const reward = advanced && lead === 'ecaz' ? 1 : 0;
    assert.deepEqual(quote.strongholdIncome, reward ? [{ player: f.actor, amount: reward }] : []);
    for (const seat of before.players)
      assert.equal(player(game, seat.id).spice, seat.spice + (seat.id === f.actor ? reward : 0));
    for (const id of ['heighliners', 'axlotl', 'production'] as const) {
      assert.equal(game.techTokens![id].spice, before.techTokens![id].spice);
      assert.equal(game.techTokens![id].triggeredTurn, before.techTokens![id].triggeredTurn,
        'Reserve fees and Harass returns do not trigger shipment or free-revival income');
    }
    for (const card of [REINFORCEMENTS_CARD, HARASS_WITHDRAW_CARD])
      assert.equal(game.discard.filter(discarded => discarded.id === card).length, 1);
    assert.ok(actions.some(step => step.action.type === 'traitorCall' && step.action.call === false));
    assert.deepEqual(inventory(game), f.originalInventory);
  });
