import test from 'node:test';
import assert from 'node:assert/strict';
import { viewGame } from '../game/engine';
import {
  createChoamCharityFundingFixture as fixture,
  actChoamCharityFunding as act,
  choamCharityFundingPlayer as player,
  choamCharityFundingInventory as inventory,
} from './fixture-choam-charity-funding';

for (const advanced of [false, true]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} native CHOAM poverty claim draws from Bank after actual earned-income bribes`, () => {
    for (const choamSpice of [0, 1] as const) {
      const f = fixture({ advanced, choamSpice }), before = structuredClone(f.game);
      const g = act(f.game, f.choam, f.selfClaim);
      assert.equal(player(g, f.choam).spice, 2);
      assert.equal(player(g, f.guild).spice, 0);
      assert.equal(player(g, f.recipient).bribes, 13 - choamSpice);
      assert.equal(viewGame(g, f.choam).charity.payer, null);
      assert.equal(viewGame(g, f.choam).players.find(p => p.id === f.choam)!.charityClaimed, true);
      assert.deepEqual(inventory(g), f.originalInventory);
      assert.deepEqual(f.game, before);
      assert.throws(() => act(g, f.choam, f.selfClaim), /once per turn|fewer than/);
    }
  });
  void test(`${advanced ? 'Advanced' : 'Basic'} native other-faction full claim uses provisional shortfall funding`, () => {
    for (const choamSpice of [0, 1] as const) {
      const f = fixture({ advanced, choamSpice }), before = structuredClone(f.game);
      let g = structuredClone(f.game);
      while (g.charityOrder && g.charityOrder.remaining[0] !== f.guild)
        g = act(g, g.charityOrder.remaining[0], { type: 'ready' });
      g = act(g, f.guild, f.otherClaim);
      assert.equal(player(g, f.choam).spice, 0);
      assert.equal(player(g, f.guild).spice, 2);
      assert.equal(player(g, f.recipient).bribes, 13 - choamSpice);
      assert.deepEqual(g.choamCharity, f.game.choamCharity);
      assert.deepEqual(g.players.map(p => p.forces), f.game.players.map(p => p.forces));
      assert.deepEqual(inventory(g), f.originalInventory);
      assert.deepEqual(f.game, before);
      assert.throws(() => act(g, f.guild, f.otherClaim), /once per turn|fewer than/);
    }
  });
  void test(`${advanced ? 'Advanced' : 'Basic'} each low faction keeps exactly one claim ${advanced ? 'in native player order' : 'in either order'}`, () => {
    const f = fixture({ advanced, choamSpice: 1, guildSpice: 1 });
    for (const order of advanced ? [[f.choam, f.guild]] : [[f.choam, f.guild], [f.guild, f.choam]]) {
      let g = structuredClone(f.game);
      for (const actor of order) {
        while (g.charityOrder && g.charityOrder.remaining[0] !== actor)
          g = act(g, g.charityOrder.remaining[0], { type: 'ready' });
        g = act(g, actor, { type: 'charity' });
      }
      assert.equal(player(g, f.guild).spice, 2);
      assert.equal(player(g, f.choam).spice, order[0] === f.choam ? 1 : 2);
      assert.equal(player(g, f.recipient).bribes, 11);
      for (const actor of order) {
        assert.equal(viewGame(g, actor).players.find(p => p.id === actor)!.charityClaimed, true);
        assert.throws(() => act(g, actor, { type: 'charity' }), /once per turn|fewer than|Charity opportunity/);
      }
      assert.deepEqual(inventory(g), f.originalInventory);
    }
  });
}
