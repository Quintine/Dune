import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game } from '../game/engine';
import { botArrivalBlock } from '../game/bot-arrival';
import { guildTransportQuote } from '../game/transport-quote';
import {
  allowGuildAmbassadorIncomeArrival, cancelGuildAmbassadorIncomeArrival,
  completeGuildAmbassadorIncomeArrival,
  createGuildAmbassadorIncomeArrival, declareGuildAmbassadorIncomeArrival,
  guildAmbassadorIncomeChoice, passNativeGuildTransportPermission,
} from './fixture-guild-ambassador-income-arrival';
import { pairedE3NexusPolicy, pairedE3NexusInventory as guildAmbassadorIncomeInventory,
  pairedE3NexusPlayer as player, pairedE3NexusReload as reload } from './fixture-paired-e3-nexus-modules';

function rejectUnchanged(game: Game, actor: string, action: Parameters<typeof applyAction>[2]) {
  const before = reload(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

for (const trigger of [true, false]) {
  for (const cancelIncome of [false, true]) {
    void test(`native allied Guild cross-transport ${cancelIncome ? 'cancels' : 'allows'} its real income before Ecaz ${trigger ? 'acquires Duke' : 'declines entry'}`, () => {
      const f = createGuildAmbassadorIncomeArrival();
      const start = f.beforeAction, payer = player(start, f.entrant), guild = player(start, f.guild);
      assert.equal(start.turn, 2);
      assert.equal(start.phase, 5);
      assert.equal(start.active, f.entrant);
      assert.equal(payer.shipped, false);
      assert.equal(payer.moved, 0);
      assert.equal(payer.ally, f.guild);
      assert.equal(guild.ally, f.entrant);
      assert.equal(f.beforeAlliance.nexus, true);
      assert.equal(player(f.beforeAlliance, f.entrant).ally, null);
      assert.equal(player(f.alliance, f.entrant).ally, f.guild);
      assert.equal(player(f.purchase.after, f.ecaz).spice, player(f.purchase.before, f.ecaz).spice - 1);
      assert.equal(player(f.placement.after, f.ecaz).spice, player(f.placement.before, f.ecaz).spice - 1);
      assert.ok(player(start, f.ecaz).hand.some(c => c.id === f.karama));
      assert.equal(start.ecazAmbassadors!.tokens.find(t => t.id === f.token)!.zone, 'placed');
      assert.equal(start.ecazAmbassadors!.tokens.find(t => t.id === f.token)!.effect, 'ecaz');
      const view = viewGame(reload(start), f.entrant);
      const quote = guildTransportQuote(view, f.action);
      assert.deepEqual(quote.unavailableReasons, []);
      assert.deepEqual(quote.quote, { cost: 1, normalCost: 1, ownPayment: 1, pledgedPayment: 0 });
      assert.equal(quote.physicalForces, 1);
      assert.equal(botArrivalBlock(view, f.action), null,
        'A future earned receipt is not an already-active arrival response');

      // Permission is a distinct unpaid window; income follows actual allowance.
      const declaration = declareGuildAmbassadorIncomeArrival(f);
      const paid = passNativeGuildTransportPermission(declaration.after).game;
      assert.ok(!paid.pendingGuildTransport);
      assert.equal(paid.response?.kind, 'guildIncome');
      assert.equal(paid.response?.amount, 1);
      assert.equal(paid.response?.owner, f.guild);
      assert.equal(player(paid, f.entrant).spice, payer.spice - 1);
      assert.equal(player(paid, f.guild).spice, guild.spice);
      assert.equal(player(paid, f.entrant).reserves, payer.reserves);
      assert.equal(player(paid, f.entrant).forces[f.source], payer.forces[f.source] - 1);
      assert.equal(player(paid, f.entrant).forces[f.target], (payer.forces[f.target] ?? 0) + 1);
      assert.equal(player(paid, f.entrant).shipped, true);
      assert.equal(player(paid, f.entrant).moved, payer.moved);
      assert.equal(paid.active, f.entrant);
      assert.deepEqual(paid.pendingArrivalReaction?.map(e => ({ entrant: e.entrant, territory: e.territory,
        sector: e.sector, amount: e.amount, cause: e.cause, turn: e.turn, phase: e.phase })),
      [{ entrant: f.entrant, territory: f.destination, sector: f.sector,
        amount: 1, cause: 'guildTransport', turn: start.turn, phase: 5 }]);
      assert.ok(!paid.pendingAmbassador);
      const counter = viewGame(reload(paid), f.ecaz).responseControls;
      assert.ok(counter && !counter.hasPassed && counter.cancelCards.includes(f.karama));
      rejectUnchanged(paid, f.entrant, f.action);
      rejectUnchanged(paid, f.entrant, { type: 'endMovement' });
      guildAmbassadorIncomeInventory(paid);

      const offered = cancelIncome
        ? cancelGuildAmbassadorIncomeArrival(reload(paid), f.ecaz, f.karama).after
        : allowGuildAmbassadorIncomeArrival(reload(paid)).game;
      assert.equal(offered.response, null);
      assert.equal(offered.pendingArrivalReaction, null);
      assert.equal(offered.decision?.kind, 'ecazAmbassador');
      assert.equal(offered.pendingAmbassador?.entrant, f.entrant);
      assert.equal(offered.pendingAmbassador?.token, f.token);
      assert.equal(offered.pendingAmbassador?.territory, f.destination);
      assert.equal(offered.pendingAmbassador?.stage, 'offer');
      assert.equal(player(offered, f.guild).spice, guild.spice + (cancelIncome ? 0 : 1));
      assert.equal(player(offered, f.entrant).spice, payer.spice - 1);
      assert.deepEqual(player(offered, f.entrant).forces, player(paid, f.entrant).forces);
      assert.equal(offered.discard.filter(c => c.id === f.karama).length, cancelIncome ? 1 : 0);
      assert.equal(player(offered, f.ecaz).hand.some(c => c.id === f.karama), !cancelIncome);
      assert.equal(offered.active, f.entrant);
      rejectUnchanged(offered, f.entrant, guildAmbassadorIncomeChoice(offered, trigger).action);
      const completed = completeGuildAmbassadorIncomeArrival(reload(offered), trigger);
      const done = completed.after;
      assert.equal(done.pendingAmbassador, null);
      assert.equal(done.pendingArrivalReaction, null);
      assert.equal(done.response, null);
      assert.equal(done.decision, null);
      assert.equal(done.active, f.entrant);
      assert.equal(done.turn, start.turn);
      assert.equal(done.phase, start.phase);
      assert.equal(player(done, f.entrant).moved, payer.moved);
      assert.equal(player(done, f.entrant).shipped, true);
      assert.deepEqual(player(done, f.entrant).forces, player(paid, f.entrant).forces);
      assert.equal(player(done, f.entrant).reserves, payer.reserves);
      assert.equal(player(done, f.entrant).spice, payer.spice - 1);
      assert.equal(player(done, f.guild).spice, guild.spice + (cancelIncome ? 0 : 1));
      assert.equal(done.ecazAmbassadors!.tokens.find(t => t.id === f.token)!.zone, trigger ? 'supply' : 'placed');
      assert.deepEqual(done.ecazAmbassadors!.cohort, start.ecazAmbassadors!.cohort);
      assert.equal(done.dukeVidal!.controller, trigger ? f.ecaz : start.dukeVidal!.controller);
      if (trigger) assert.equal(done.dukeVidal!.source, 'ecaz');
      assert.deepEqual(done.players.map(p => p.hand), offered.players.map(p => p.hand));
      assert.deepEqual(done.players.map(p => p.leaders), offered.players.map(p => p.leaders));
      assert.deepEqual(done.deck, offered.deck);
      assert.deepEqual(done.discard, offered.discard);
      rejectUnchanged(done, completed.step.actor, completed.step.action);
      rejectUnchanged(done, f.entrant, f.action);
      guildAmbassadorIncomeInventory(done);

      const next = applyAction(reload(done), completed.continuation.actor, completed.continuation.action);
      assert.notEqual(next.active, f.entrant);
      assert.equal(next.pendingAmbassador, null);
      assert.equal(next.pendingArrivalReaction, null);
      assert.deepEqual(player(next, f.entrant).forces, player(done, f.entrant).forces);
      assert.equal(player(next, f.entrant).spice, payer.spice - 1);
      assert.equal(player(next, f.guild).spice, guild.spice + (cancelIncome ? 0 : 1));
      assert.equal(next.discard.filter(c => c.id === f.karama).length, cancelIncome ? 1 : 0);
      guildAmbassadorIncomeInventory(next);
    });
  }
}

void test('actual Ecaz owner-view policies complete the queued native Guild entry without replaying payment or counters', () => {
  const f = createGuildAmbassadorIncomeArrival();
  const paid = passNativeGuildTransportPermission(declareGuildAmbassadorIncomeArrival(f).after).game;
  const offered = allowGuildAmbassadorIncomeArrival(paid).game;
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const action = pairedE3NexusPolicy(reload(offered), f.ecaz, difficulty)[0];
    assert.ok(action, `The actual ${difficulty} Ecaz owner needs a legal response`);
    const done = applyAction(reload(offered), f.ecaz, action);
    assert.equal(done.pendingAmbassador, null);
    assert.equal(done.pendingArrivalReaction, null);
    assert.equal(done.decision, null);
    assert.equal(done.response, null);
    assert.equal(done.active, f.entrant);
    assert.deepEqual(player(done, f.entrant).forces, player(paid, f.entrant).forces);
    assert.equal(player(done, f.entrant).spice, player(paid, f.entrant).spice);
    assert.equal(player(done, f.guild).spice, player(paid, f.guild).spice + 1);
    assert.equal(player(done, f.entrant).moved, player(paid, f.entrant).moved);
    guildAmbassadorIncomeInventory(done);
    const next = applyAction(reload(done), f.entrant, { type: 'endMovement' });
    assert.notEqual(next.active, f.entrant);
    assert.deepEqual(player(next, f.entrant).forces, player(paid, f.entrant).forces);
  }
});
