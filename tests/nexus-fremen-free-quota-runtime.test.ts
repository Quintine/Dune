import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { forceRevivalQuote } from '../game/revival';
import { nexusTleilaxuSecretAllyPlayer as player } from './fixture-nexus-tleilaxu-secret-ally';
import {
  advanceNexusFremenFreeQuota, assertNexusFremenFreeQuotaInventory,
  createNexusFremenFreeQuotaFixture, nexusFremenFreeQuotaQuiet,
} from './fixture-nexus-fremen-free-quota';

function rejected(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'Refusal preserves physical custody, ledgers, banks and pending frames');
}

for (const advanced of [false, true]) {
  for (const tleilaxu of [false, true]) {
    const profile = `${advanced ? 'Advanced' : 'Basic'} ${tleilaxu ? 'native Tleilaxu/Ix' : 'classic'}`;

    void test(`${profile}: activation grants quota, then original one-plus-two requests return three free counters`, () => {
      const f = createNexusFremenFreeQuotaFixture({ advanced, tleilaxu });
      const before = player(f.game, f.owner);
      const offer = viewGame(f.game, f.owner).nexusFremenRevival;
      assert.ok(offer);
      assert.equal(offer.blocked, null);
      assert.equal(offer.quota, 3);
      assert.equal(offer.freeRemaining, 3);
      assert.equal(offer.maxForces, 3);
      assert.equal(offer.ordinaryRemaining, 3);
      for (const other of f.game.players.filter(p => p.id !== f.owner))
        assert.equal(viewGame(f.game, other.id).nexusFremenRevival, null);

      let game = applyAction(f.game, f.owner, { type: 'nexusFremenRevival', event: offer.event });
      assert.deepEqual(game.players, f.game.players, 'Enabling the quota returns no counters, leaders or spice');
      assert.equal(game.turn, f.game.turn);
      assert.equal(game.phase, 4);
      assert.ok(nexusFremenFreeQuotaQuiet(game), 'Activation starts no substitute revival or income pipeline');
      assert.equal(game.nexusCards!.cards!.hands[f.owner], null);
      assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'fremen').length, 1);
      assert.equal(viewGame(game, f.owner).nexusFremenRevival, null);
      assert.equal(viewGame(game, f.owner).revival.freeRemaining, 3);
      assert.equal(viewGame(game, f.owner).revival.forcesRemaining, 3);
      const receipt = game.nexusFremenRevivalHistory!.at(-1)!;
      assert.equal(receipt.version, 2);
      assert.equal(receipt.revivedAtUse, 0);
      assert.equal(receipt.freeAtUse, 0);
      assert.equal(receipt.policy, 'ordinary-free-quota-three');
      assert.equal(receipt.legacyReturn, undefined, 'New activation does not manufacture an old physical transfer');
      rejected(game, f.owner, { type: 'nexusFremenRevival', event: offer.event });

      const incomeBefore = player(game, f.scenario.partner).spice;
      game = applyAction(game, f.owner, { type: 'revive', amount: 1, elite: 0 });
      game = advanceNexusFremenFreeQuota(game, state => state.turn === 2 && state.phase === 4 && nexusFremenFreeQuotaQuiet(state));
      assert.equal(player(game, f.owner).tanks, before.tanks - 1);
      assert.equal(player(game, f.owner).reserves, before.reserves + 1);
      assert.equal(player(game, f.owner).revived, 1);
      assert.equal(player(game, f.owner).freeForcesRevived, 1);
      assert.equal(player(game, f.owner).spice, before.spice);
      assert.equal(viewGame(game, f.owner).revival.freeRemaining, 2);
      assert.equal(player(game, f.scenario.partner).spice, incomeBefore + (tleilaxu ? 1 : 0));
      if (tleilaxu) assert.equal(game.revivalFreeIncome?.[f.owner], game.turn);

      game = applyAction(game, f.owner, { type: 'revive', amount: 2, elite: 0 });
      game = advanceNexusFremenFreeQuota(game, state => state.turn === 2 && state.phase === 4 && nexusFremenFreeQuotaQuiet(state));
      const holder = player(game, f.owner);
      assert.equal(holder.tanks, before.tanks - 3);
      assert.equal(holder.reserves, before.reserves + 3);
      assert.equal(holder.revived, 3);
      assert.equal(holder.freeForcesRevived, 3);
      assert.equal(holder.spice, before.spice);
      assert.deepEqual(holder.leaders, before.leaders, 'No extra leader revival is granted');
      assert.equal(viewGame(game, f.owner).revival.freeRemaining, 0);
      assert.equal(viewGame(game, f.owner).revival.forcesRemaining, 0);
      assert.equal(player(game, f.scenario.partner).spice, incomeBefore + (tleilaxu ? 1 : 0),
        'The real native free-revival income occurs once, not once per request or on card activation');
      rejected(game, f.owner, { type: 'revive', amount: 1, elite: 0 });
      assertNexusFremenFreeQuotaInventory(game);
    });

    void test(`${profile}: prior ordinary free use counts and late activation permits only the ordinary remainder`, () => {
      const f = createNexusFremenFreeQuotaFixture({ advanced, tleilaxu });
      const before = player(f.game, f.owner);
      let game = applyAction(f.game, f.owner, { type: 'revive', amount: 2, elite: 0 });
      game = advanceNexusFremenFreeQuota(game, state => state.turn === 2 && state.phase === 4 && nexusFremenFreeQuotaQuiet(state));
      assert.equal(player(game, f.owner).revived, 2);
      assert.equal(player(game, f.owner).freeForcesRevived, 2);
      const offer = viewGame(game, f.owner).nexusFremenRevival;
      assert.ok(offer);
      assert.equal(offer.blocked, null);
      assert.equal(offer.freeRemaining, 1);
      assert.equal(offer.maxForces, 1);
      assert.equal(offer.ordinaryRemaining, 1);
      const atUse = structuredClone(player(game, f.owner));
      game = applyAction(game, f.owner, { type: 'nexusFremenRevival', event: offer.event });
      assert.deepEqual(player(game, f.owner), atUse);
      assert.equal(game.nexusFremenRevivalHistory!.at(-1)!.revivedAtUse, 2);
      assert.equal(game.nexusFremenRevivalHistory!.at(-1)!.freeAtUse, 2);
      rejected(game, f.owner, { type: 'revive', amount: 2, elite: 0 });
      game = applyAction(game, f.owner, { type: 'revive', amount: 1, elite: 0 });
      game = advanceNexusFremenFreeQuota(game, state => state.turn === 2 && state.phase === 4 && nexusFremenFreeQuotaQuiet(state));
      assert.equal(player(game, f.owner).tanks, before.tanks - 3);
      assert.equal(player(game, f.owner).reserves, before.reserves + 3);
      assert.equal(player(game, f.owner).spice, before.spice);
      assert.equal(player(game, f.owner).freeForcesRevived, 3);
      assert.equal(viewGame(game, f.owner).revival.forcesRemaining, 0);
      assertNexusFremenFreeQuotaInventory(game);
    });

    void test(`${profile}: wrong actor, stale event, payload keys and removed transfer action cannot spend the singleton`, () => {
      const f = createNexusFremenFreeQuotaFixture({ advanced, tleilaxu });
      for (const actor of [f.scenario.opponent, f.scenario.partner])
        rejected(f.game, actor, { type: 'nexusFremenRevival', event: f.scenario.event });
      rejected(f.game, f.owner, { type: 'nexusFremenRevival', event: 'stale' });
      rejected(f.game, f.owner, { type: 'nexusFremenRevival', event: f.scenario.event, amount: 3 });
      rejected(f.game, f.owner, { type: 'nexusFremenRevival', event: f.scenario.event, elite: 0 });
      rejected(f.game, f.owner, { type: 'nexusFremenRevive', event: f.scenario.event, elite: 0 });
      const next = advanceNexusFremenFreeQuota(f.game,
        state => state.turn === 3 && state.phase === 4 && nexusFremenFreeQuotaQuiet(state));
      assert.equal(next.nexusCards!.cards!.hands[f.owner], 'fremen');
      assert.equal(player(next, f.owner).tanks, 8);
      const offer = viewGame(next, f.owner).nexusFremenRevival;
      assert.ok(offer);
      assert.equal(offer.blocked, null);
      assert.notEqual(offer.event, f.scenario.event);
      rejected(next, f.owner, { type: 'nexusFremenRevival', event: f.scenario.event });
      let returned = applyAction(next, f.owner, { type: 'nexusFremenRevival', event: offer.event });
      returned = applyAction(returned, f.owner, { type: 'revive', amount: 1, elite: 0 });
      returned = advanceNexusFremenFreeQuota(returned,
        state => state.turn === 3 && state.phase === 4 && nexusFremenFreeQuotaQuiet(state));
      assert.equal(player(returned, f.owner).tanks, 7);
      assert.equal(player(returned, f.owner).freeForcesRevived, 1);
      assertNexusFremenFreeQuotaInventory(returned);
    });

    void test(`${profile}: an unused portion expires at real phase end and does not become next-turn free quota`, () => {
      const f = createNexusFremenFreeQuotaFixture({ advanced, tleilaxu });
      let game = applyAction(f.game, f.owner, { type: 'nexusFremenRevival', event: f.scenario.event });
      game = applyAction(game, f.owner, { type: 'revive', amount: 1, elite: 0 });
      game = advanceNexusFremenFreeQuota(game, state => state.turn === 2 && state.phase === 4 && nexusFremenFreeQuotaQuiet(state));
      const phaseEnd = advanceNexusFremenFreeQuota(game,
        state => state.turn === 2 && state.phase === 5 && nexusFremenFreeQuotaQuiet(state));
      rejected(phaseEnd, f.owner, { type: 'revive', amount: 1, elite: 0 });
      rejected(phaseEnd, f.owner, { type: 'nexusFremenRevival', event: f.scenario.event });
      const next = advanceNexusFremenFreeQuota(phaseEnd,
        state => state.turn === 3 && state.phase === 4 && nexusFremenFreeQuotaQuiet(state));
      const holder = player(next, f.owner);
      assert.equal(holder.tanks, 7);
      assert.equal(holder.revived, 0);
      assert.equal(holder.freeForcesRevived, 0);
      assert.equal(viewGame(next, f.owner).nexusFremenRevival, null);
      assert.equal(viewGame(next, f.owner).revival.freeRemaining, 2, 'Only the native Atreides rate survives');
      assert.equal(viewGame(next, f.owner).revival.forcesRemaining, 3);
      assert.equal(forceRevivalQuote(next, holder, 3).free, 2);
      const price = forceRevivalQuote(next, holder, 3).cost;
      assert.ok(price > 0);
      let returned = applyAction(next, f.owner, { type: 'revive', amount: 3, elite: 0 });
      returned = advanceNexusFremenFreeQuota(returned,
        state => state.turn === 3 && state.phase === 4 && nexusFremenFreeQuotaQuiet(state));
      assert.equal(player(returned, f.owner).tanks, 4);
      assert.equal(player(returned, f.owner).freeForcesRevived, 2);
      assert.equal(player(returned, f.owner).spice, holder.spice - price);
      assert.equal(returned.nexusCards!.cards!.discard.filter(card => card === 'fremen').length, 1);
      assertNexusFremenFreeQuotaInventory(returned);
    });

    void test(`${profile}: the original AI can enable the quota and use its ordinary revival action`, () => {
      const f = createNexusFremenFreeQuotaFixture({ advanced, tleilaxu });
      const view = viewGame(f.game, f.owner);
      view.players.find(p => p.id === f.owner)!.bot = 'Easy';
      const enable = botActions(view).find(action => action.type === 'nexusFremenRevival');
      assert.ok(enable, 'The owner AI has a legal activation, not a direct-transfer action');
      let game = applyAction(f.game, f.owner, enable);
      const enabled = viewGame(game, f.owner);
      enabled.players.find(p => p.id === f.owner)!.bot = 'Easy';
      const ordinary = botActions(enabled).find(action => action.type === 'revive');
      assert.ok(ordinary);
      game = applyAction(game, f.owner, ordinary);
      game = advanceNexusFremenFreeQuota(game,
        state => state.turn === 2 && state.phase === 4 && nexusFremenFreeQuotaQuiet(state));
      assert.equal(player(game, f.owner).tanks, 8 - player(game, f.owner).revived);
      assert.ok(player(game, f.owner).revived > 0);
      assert.equal(player(game, f.owner).freeForcesRevived, player(game, f.owner).revived);
      assert.equal(player(game, f.owner).spice, player(f.game, f.owner).spice);
      assertNexusFremenFreeQuotaInventory(game);
    });
  }

  void test(`${advanced ? 'Advanced' : 'Basic'} native Tleilaxu: prior paid returns keep their price and consume the native expanded allowance`, () => {
    const f = createNexusFremenFreeQuotaFixture({ advanced, tleilaxu: true });
    let game = applyAction(f.game, f.scenario.partner, { type: 'tleilaxuRevivalLimit', target: f.owner });
    game = advanceNexusFremenFreeQuota(game, state => state.turn === 2 && state.phase === 4 && nexusFremenFreeQuotaQuiet(state));
    assert.equal(viewGame(game, f.owner).revival.forcesRemaining, 5);
    const before = structuredClone(player(game, f.owner));
    const priorPrice = forceRevivalQuote(game, before, 3).cost;
    assert.ok(priorPrice > 0);
    game = applyAction(game, f.owner, { type: 'revive', amount: 3, elite: 0 });
    game = advanceNexusFremenFreeQuota(game, state => state.turn === 2 && state.phase === 4 && nexusFremenFreeQuotaQuiet(state));
    assert.equal(player(game, f.owner).revived, 3);
    assert.equal(player(game, f.owner).freeForcesRevived, 2);
    assert.equal(player(game, f.owner).spice, before.spice - priorPrice);
    const offer = viewGame(game, f.owner).nexusFremenRevival;
    assert.ok(offer);
    assert.equal(offer.blocked, null);
    assert.equal(offer.freeRemaining, 1);
    assert.equal(offer.maxForces, 1);
    assert.equal(offer.ordinaryRemaining, 2);
    const atUse = structuredClone(player(game, f.owner));
    game = applyAction(game, f.owner, { type: 'nexusFremenRevival', event: offer.event });
    assert.deepEqual(player(game, f.owner), atUse, 'No refund or paid-to-free reclassification occurs at activation');
    assert.equal(game.nexusFremenRevivalHistory!.at(-1)!.revivedAtUse, 3);
    assert.equal(game.nexusFremenRevivalHistory!.at(-1)!.freeAtUse, 2);
    assert.equal(viewGame(game, f.owner).revival.forcesRemaining, 2, 'The native five-return permission survives without expansion');
    const afterPrice = forceRevivalQuote(game, player(game, f.owner), 2).cost;
    assert.ok(afterPrice > 0, 'Only one of the remaining two is free');
    rejected(game, f.owner, { type: 'revive', amount: 3, elite: 0 });
    game = applyAction(game, f.owner, { type: 'revive', amount: 2, elite: 0 });
    game = advanceNexusFremenFreeQuota(game, state => state.turn === 2 && state.phase === 4 && nexusFremenFreeQuotaQuiet(state));
    assert.equal(player(game, f.owner).revived, 5);
    assert.equal(player(game, f.owner).freeForcesRevived, 3, 'Actual free use is three, not five reclassified returns');
    assert.equal(player(game, f.owner).tanks, before.tanks - 5);
    assert.equal(player(game, f.owner).reserves, before.reserves + 5);
    assert.equal(player(game, f.owner).spice, before.spice - priorPrice - afterPrice);
    rejected(game, f.owner, { type: 'revive', amount: 1, elite: 0 });
    assertNexusFremenFreeQuotaInventory(game);
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} classic: a fully consumed ordinary allowance cannot discard the card uselessly`, () => {
    const f = createNexusFremenFreeQuotaFixture({ advanced });
    let game = applyAction(f.game, f.owner, { type: 'revive', amount: 3, elite: 0 });
    game = advanceNexusFremenFreeQuota(game, state => state.turn === 2 && state.phase === 4 && nexusFremenFreeQuotaQuiet(state));
    const offer = viewGame(game, f.owner).nexusFremenRevival;
    assert.ok(offer);
    assert.ok(offer.blocked);
    assert.equal(offer.maxForces, 0);
    rejected(game, f.owner, { type: 'nexusFremenRevival', event: offer.event });
    assert.equal(game.nexusCards!.cards!.hands[f.owner], 'fremen');
    assert.equal(player(game, f.owner).freeForcesRevived, 2, 'The prior paid counter remains paid');
    assertNexusFremenFreeQuotaInventory(game);
  });
}
