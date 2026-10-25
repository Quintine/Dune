import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { homeworldGameIntegrity, homeworldTable } from '../game/homeworld-game';
import {
  createRevivalTerrorFixture as fixture,
  actRevivalTerror as act,
  commitRevivalTerror as commit,
  finishRevivalTerror as finish,
  settleRevivalTerror as settle,
  revivalTerrorPlayer as player,
  revivalTerrorInventory as inventory,
  type RevivalTerrorFixture,
} from './fixture-revival-terror';

function entered(f: RevivalTerrorFixture) {
  const game = commit(f.game, f).game;
  assert.equal(game.decision?.kind, 'moritaniTerror'); assert.equal(game.decision?.player, f.owner);
  assert.equal(game.pendingTerrorEntry?.stage, 'offer');
  assert.equal(game.pendingTerrorEntry.entrant, f.entrant); assert.equal(game.pendingTerrorEntry.token, f.token);
  assert.equal(game.pendingTerrorEntry.territory, f.territory); assert.equal(game.pendingTerrorEntry.sector, f.sector);
  assert.equal(game.pendingTerrorEntry.amount, 1); assert.equal(game.pendingTerrorEntry.cause, 'homeworldRevival');
  assert.equal(game.homeworldRevivalReturn?.stage, 'arrival');
  assert.equal(game.homeworldRevivalReturn.event, f.event);
  assert.equal(player(game, f.entrant).forces[f.location], 1); assert.equal(player(game, f.entrant).reserves, 19);
  assert.equal(player(game, f.entrant).spice, player(f.game, f.entrant).spice,
    'Original revival income waits until the entry effects are complete');
  assert.equal(viewGame(game, f.owner).terrorEntry?.canReveal, true);
  return game;
}
function completed(game: Game, f: RevivalTerrorFixture, surviving = 1) {
  assert.equal(game.turn, 2); assert.equal(game.phase, 4);
  assert.ok(!game.pendingTerrorEntry); assert.ok(!game.pendingTreacheryDiscard);
  assert.equal(game.homeworldRevivalReturn?.stage, 'complete');
  assert.equal(game.decision, null); assert.equal(game.response, null);
  const returned = player(game, f.entrant), source = player(f.game, f.entrant);
  assert.equal(returned.reserves, 19); assert.equal(returned.forces[f.location] ?? 0, surviving);
  assert.equal(returned.tanks, 1 - surviving); assert.equal(returned.revived, 1); assert.equal(returned.freeForcesRevived, 1);
  assert.equal(returned.shipped, source.shipped); assert.equal(returned.moved, source.moved);
  for (const p of game.players)
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((sum, amount) => sum + amount, 0), 20);
  assert.deepEqual(inventory(game), f.originalInventory); homeworldGameIntegrity(game);
}

for (const advanced of [false, true]) {
  const mode = advanced ? 'Advanced' : 'Basic';

  void test(`${mode} native revived entry permits Moritani to decline its genuinely Mentat-placed Terror`, () => {
    const f = fixture({ advanced });
    assert.deepEqual(f.game.expansions, ['ix', 'ecaz']); assert.ok(f.game.homeworlds);
    assert.equal(f.originalInventory.length, 47); assert.equal(f.sourceActionCount, f.actions.length);
    assert.equal(player(f.afterSetup, f.entrant).reserves, 20);
    assert.equal(player(f.beforeRequest, f.entrant).tanks, 1);
    assert.equal(player(f.beforeRequest, f.entrant).reserves, 19);
    assert.equal(f.beforePlacement.turn, 1); assert.equal(f.beforePlacement.phase, 8);
    assert.equal(f.beforePlacement.decision?.kind, 'moritaniPlacement');
    assert.deepEqual(f.placement.steps[0], { actor: f.owner, action: f.placementAction });
    assert.equal(player(f.shipment.before, f.entrant).spice - player(f.shipment.after, f.entrant).spice, 2);
    assert.equal(player(f.storm.after, f.entrant).tanks, 1); assert.equal(f.storm.after.storm, 13);
    assert.equal(player(f.game, f.entrant).tanks, 0); assert.equal(player(f.game, f.entrant).reserves, 20);
    assert.equal(homeworldTable(f.game)!.find(home => home.native === f.entrant)!.side, 'high');
    assert.equal(homeworldTable(f.game)!.find(home => home.native === f.owner)!.side, 'high');
    const done = finish(act(entered(f), f.owner, f.declineAction));
    assert.equal(done.moritaniTerror!.tokens.find(token => token.id === f.token)!.status, 'placed');
    assert.equal(player(done, f.entrant).spice, player(f.game, f.entrant).spice + 1);
    assert.ok(player(done, f.holder).hand.some(card => card.id === f.karama)); completed(done, f);
  });

  void test(`${mode} native revival Robbery resolves either original spice theft or top-card draw before free-revival income`, () => {
    const f = fixture({ advanced, kind: 'robbery' });
    for (const choice of ['spice', 'card']) {
      const offered = entered(f), cash = player(offered, f.entrant).spice;
      const moritaniCash = player(offered, f.owner).spice, deckTop = offered.deck[0].id;
      const revealed = act(offered, f.owner, f.revealAction);
      assert.equal(revealed.pendingTerrorEntry?.stage, 'robbery');
      assert.equal(revealed.homeworldRevivalReturn?.stage, 'arrival');
      const done = finish(act(revealed, f.owner, { type: 'decision', choice }));
      assert.equal(player(done, f.entrant).spice, cash - (choice === 'spice' ? Math.ceil(cash / 2) : 0) + 1);
      assert.equal(player(done, f.owner).spice, moritaniCash + (choice === 'spice' ? Math.ceil(cash / 2) : 0));
      assert.equal(player(done, f.owner).hand.some(card => card.id === deckTop), choice === 'card');
      assert.equal(done.deck.length, offered.deck.length - Number(choice === 'card'));
      assert.equal(done.moritaniTerror!.tokens.find(token => token.id === f.token)!.status, 'removed');
      completed(done, f);
    }
  });

  void test(`${mode} native revival Sabotage completes its actual discard and optional original-card gift`, () => {
    const f = fixture({ advanced, kind: 'sabotage' });
    for (const give of [false, true]) {
      const offered = entered(f), cash = player(offered, f.entrant).spice;
      const pending = settle(act(offered, f.owner, f.revealAction));
      assert.equal(pending.pendingTerrorEntry?.stage, 'gift');
      assert.equal(pending.homeworldRevivalReturn?.stage, 'arrival');
      assert.equal(player(pending, f.entrant).spice, cash);
      assert.equal(pending.discard.filter(card => card.id === f.karama).length, 1);
      const done = finish(act(pending, f.owner, give
        ? { type: 'decision', card: f.gift } : f.declineAction));
      assert.equal(player(done, f.entrant).hand.some(card => card.id === f.gift), give);
      assert.equal(player(done, f.owner).hand.some(card => card.id === f.gift), !give);
      assert.equal(player(done, f.entrant).spice, cash + 1);
      assert.equal(done.moritaniTerror!.tokens.find(token => token.id === f.token)!.status, 'removed');
      completed(done, f);
    }
  });

  void test(`${mode} native revival Assassination uses its real living-disc lottery and original bounty`, () => {
    const f = fixture({ advanced, kind: 'assassination' }), offered = entered(f);
    const before = structuredClone(player(offered, f.entrant).leaders), ownerCash = player(offered, f.owner).spice;
    const done = finish(act(offered, f.owner, f.revealAction));
    const killed = player(done, f.entrant).leaders.filter(leader => leader.dead && !before.find(old => old.id === leader.id)!.dead);
    assert.equal(killed.length, 1);
    assert.equal(killed[0].deaths, before.find(leader => leader.id === killed[0].id)!.deaths + 1);
    assert.equal(player(done, f.owner).spice, ownerCash + (killed[0].id === 'tleilaxu-0' ? 3 : killed[0].strength));
    assert.equal(player(done, f.entrant).spice, player(offered, f.entrant).spice + 1);
    assert.equal(done.moritaniTerror!.tokens.find(token => token.id === f.token)!.status, 'removed'); completed(done, f);
  });

  void test(`${mode} native revival Extortion reserves its original bank five without prematurely paying it`, () => {
    const f = fixture({ advanced, kind: 'extortion' }), offered = entered(f), before = player(offered, f.owner).spice;
    const done = finish(act(offered, f.owner, f.revealAction));
    assert.equal(done.moritaniExtortion?.stage, 'reserved');
    assert.deepEqual(done.moritaniExtortion?.bank, { reserved: 5, collected: 0 });
    assert.equal(done.moritaniExtortion?.owner, f.owner); assert.equal(done.moritaniExtortion?.token, f.token);
    assert.equal(player(done, f.owner).spice, before);
    assert.equal(player(done, f.entrant).spice, player(offered, f.entrant).spice + 1);
    assert.equal(done.moritaniTerror!.tokens.find(token => token.id === f.token)!.status, 'extortion'); completed(done, f);
  });

  void test(`${mode} native revival Sneak Attack moves an actual Moritani reserve counter without another shipment fee`, () => {
    const f = fixture({ advanced, kind: 'sneakAttack' }), offered = entered(f), before = structuredClone(player(offered, f.owner));
    const pending = act(offered, f.owner, f.revealAction);
    assert.equal(pending.pendingTerrorEntry?.stage, 'sneakAttack');
    const done = finish(act(pending, f.owner, { type: 'decision', amount: 1, sector: f.sector }));
    assert.equal(player(done, f.owner).reserves, before.reserves - 1);
    assert.equal(player(done, f.owner).forces[f.location], 1); assert.equal(player(done, f.owner).spice, before.spice);
    assert.equal(player(done, f.owner).shipped, before.shipped); assert.equal(player(done, f.owner).moved, before.moved);
    assert.equal(done.moritaniTerror!.tokens.find(token => token.id === f.token)!.status, 'removed'); completed(done, f);
  });

  void test(`${mode} native revival Atomics destroys the already revived entrant and finishes the original return`, () => {
    const f = fixture({ advanced, kind: 'atomics' }), offered = entered(f);
    const done = finish(act(offered, f.owner, f.revealAction));
    assert.equal(done.moritaniAtomics?.territory, f.territory);
    assert.equal(done.moritaniAtomics?.turn, 2); assert.equal(done.moritaniAtomics?.moritaniId, f.owner);
    assert.equal(player(done, f.owner).atomicsHandLimitPenalty, true);
    assert.equal(player(done, f.entrant).spice, player(offered, f.entrant).spice + 1);
    assert.equal(done.moritaniTerror!.tokens.find(token => token.id === f.token)!.status, 'removed'); completed(done, f, 0);
  });

  void test(`${mode} all four minimal policies complete legal native revival Terror choices`, () => {
    const f = fixture({ advanced });
    for (const difficulty of DIFFICULTIES) {
      let game = entered(f);
      for (let count = 0; count < 100 && (game.homeworldRevivalReturn?.stage !== 'complete' || game.response || game.decision); count++) {
        let next;
        for (const seat of game.players) {
          const own = viewGame(game, seat.id); own.players.find(player => player.id === seat.id)!.bot = difficulty;
          const action = botActions(own)[0];
          if (action) { next = { actor: seat.id, action }; break; }
        }
        assert.ok(next, `${difficulty} must retain a legal current Terror/response action`);
        game = act(game, next.actor, next.action);
      }
      completed(game, f);
    }
  });
}

void test('native original Tleilaxu Karama can cancel Enemy of My Enemy while keeping the revived entry committed', () => {
  const f = fixture(), offered = entered(f), pending = act(offered, f.owner, { type: 'decision', alliance: true });
  assert.equal(pending.response?.kind, 'moritaniAlliance');
  const prevented = act(pending, f.holder, f.cancelAction);
  assert.equal(prevented.pendingTerrorEntry?.stage, 'offer'); assert.equal(prevented.decision?.player, f.owner);
  assert.equal(player(prevented, f.entrant).ally, null); assert.equal(player(prevented, f.owner).ally, null);
  assert.equal(player(prevented, f.entrant).forces[f.location], 1);
  assert.equal(prevented.homeworldRevivalReturn?.stage, 'arrival');
  const done = finish(act(prevented, f.owner, f.declineAction));
  assert.equal(done.discard.filter(card => card.id === f.karama).length, 1);
  assert.equal(player(done, f.entrant).spice, player(offered, f.entrant).spice + 1); completed(done, f);
});
