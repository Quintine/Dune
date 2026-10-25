import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Game } from '../game/engine';
import { isAdvisor } from '../game/advisors';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { homeworldGameIntegrity, homeworldTable } from '../game/homeworld-game';
import {
  createRevivalArrivalReactionsFixture as fixture,
  actRevivalArrivalReactions as act,
  openRevivalArrivalReactions as open,
  commitRevivalArrivalReactions as commit,
  passRevivalArrivalReactions as pass,
  finishRevivalArrivalReactions as finish,
  revivalArrivalReactionsPlayer as player,
  revivalArrivalReactionsInventory as inventory,
  type RevivalArrivalReactionsFixture,
} from './fixture-revival-arrival-reactions';

function ownEvent(game: Game, owner: string) {
  const p = player(game, owner);
  return {
    reserves: p.reserves, tanks: p.tanks, forces: structuredClone(p.forces), spice: p.spice,
    shipped: p.shipped, moved: p.moved, revived: p.revived, freeForcesRevived: p.freeForcesRevived,
  };
}
function bgOffer(f: RevivalArrivalReactionsFixture) {
  const returned = open(f.game, f);
  assert.equal(returned.homeworldRevivalReturn?.stage, 'choice');
  assert.equal(returned.decision?.kind, 'homeworldRevivalDeployment');
  assert.equal(returned.homeworldRevivalReturn?.resumeResponse?.kind, 'revivalIncome');
  assert.equal(returned.homeworldRevivalReturn?.resumeResponse?.amount, 1);
  assert.equal(player(returned, f.owner).tanks, 0); assert.equal(player(returned, f.owner).reserves, 20);
  assert.equal(player(returned, f.owner).revived, 1);
  assert.equal(player(returned, f.owner).freeForcesRevived, 1);
  const placed = commit(returned, f).game;
  assert.equal(placed.homeworldRevivalReturn?.event, returned.homeworldRevivalReturn!.event);
  assert.equal(placed.homeworldRevivalReturn?.stage, 'arrival');
  assert.equal(placed.decision?.kind, 'advisor'); assert.equal(placed.decision?.player, f.bg);
  assert.equal(player(placed, f.owner).forces[f.destination], 1);
  assert.equal(player(placed, f.owner).reserves, 19);
  assert.equal(player(placed, f.bg).reserves, player(f.game, f.bg).reserves);
  return { returned, game: placed };
}
function originalAccounting(game: Game, f: RevivalArrivalReactionsFixture) {
  const before = player(f.game, f.owner), after = player(game, f.owner);
  assert.equal(game.turn, 2); assert.equal(game.phase, 4);
  assert.equal(after.spice, before.spice + 1, 'The original free-revival bank income settles once after arrival choices');
  assert.equal(after.shipped, before.shipped); assert.equal(after.moved, before.moved);
  assert.equal(after.tanks, 0); assert.equal(after.revived, 1); assert.equal(after.freeForcesRevived, 1);
  assert.equal(after.reserves, 19); assert.equal(after.forces[f.destination], 1);
  assert.equal(after.reserves + after.tanks + Object.values(after.forces).reduce((sum, amount) => sum + amount, 0), 20);
  assert.equal(game.homeworldRevivalReturn?.stage, 'complete');
  assert.deepEqual(inventory(game), f.originalInventory); homeworldGameIntegrity(game);
}

for (const advanced of [false, true]) {
  const mode = advanced ? 'Advanced' : 'Basic';

  void test(`${mode} genuine High Tleilax revival arrival opens BG Spiritual choice and decline finishes the original free return`, () => {
    const f = fixture({ advanced });
    assert.deepEqual(f.game.expansions, ['ix']); assert.ok(f.game.homeworlds);
    assert.equal(f.originalInventory.length, 47); assert.equal(f.sourceActionCount, f.actions.length);
    assert.equal(player(f.afterSetup, f.owner).reserves, 20);
    assert.equal(player(f.afterSetup, f.owner).tanks, 0);
    assert.equal(player(f.shipment.after, f.owner).forces[f.casualtyLocation], 1);
    assert.equal(player(f.beforeShipment, f.owner).spice - player(f.shipment.after, f.owner).spice, 2);
    assert.equal(f.beforeStormMovement.storm, advanced ? 12 : 11);
    assert.equal(f.beforeStormMovement.stormPending, advanced ? 1 : 2);
    assert.equal(f.storm.after.storm, 13);
    assert.equal(player(f.storm.after, f.owner).tanks, 1);
    assert.equal(player(f.game, f.owner).tanks, 1); assert.equal(player(f.game, f.owner).revived, 0);
    assert.equal(player(f.game, f.owner).reserves, 19); assert.equal(player(f.game, f.bg).reserves, 19);
    assert.ok(homeworldTable(f.game)!.filter(home => home.native === f.owner || home.native === f.bg)
      .every(home => home.side === 'high'));
    const { game } = bgOffer(f), before = ownEvent(game, f.owner);
    const done = finish(act(game, f.bg, f.declineAction));
    assert.deepEqual(ownEvent(done, f.owner), { ...before, spice: before.spice + 1 });
    assert.equal(player(done, f.bg).reserves, 19); assert.equal(player(done, f.bg).forces['polar_sink:0'], 1);
    assert.ok(player(done, f.holder).hand.some(card => card.id === f.karama));
    originalAccounting(done, f);
  });

  void test(`${mode} genuine revival-triggered BG can send one or High Wallach two to Polar without a second revival or shipment fee`, () => {
    const f = fixture({ advanced }), { game } = bgOffer(f);
    for (const amount of [1, 2]) {
      const before = ownEvent(game, f.owner), bgBefore = ownEvent(game, f.bg);
      const declared = act(game, f.bg, amount === 1 ? f.sinkAction : f.highSinkAction);
      assert.equal(declared.response?.kind, 'advisor'); assert.equal(declared.response?.owner, f.bg);
      assert.equal(player(declared, f.bg).reserves, bgBefore.reserves);
      assert.deepEqual(ownEvent(declared, f.owner), before);
      const done = finish(pass(declared));
      assert.deepEqual(ownEvent(done, f.owner), { ...before, spice: before.spice + 1 });
      assert.equal(player(done, f.bg).reserves, bgBefore.reserves - amount);
      assert.equal(player(done, f.bg).forces['polar_sink:0'], 1 + amount);
      assert.equal(player(done, f.bg).spice, bgBefore.spice);
      assert.equal(player(done, f.bg).shipped, bgBefore.shipped);
      assert.equal(player(done, f.bg).moved, bgBefore.moved);
      assert.equal(player(done, f.bg).revived, bgBefore.revived);
      assert.ok(player(done, f.holder).hand.some(card => card.id === f.karama));
      originalAccounting(done, f);
    }
  });

  void test(`${mode} original Tleilaxu Karama independently cancels BG accompaniment after the revived force is already placed`, () => {
    const f = fixture({ advanced }), { game } = bgOffer(f);
    const before = ownEvent(game, f.owner), bgBefore = ownEvent(game, f.bg);
    const declared = act(game, f.bg, f.highSinkAction);
    assert.equal(declared.response?.kind, 'advisor');
    const done = finish(act(declared, f.holder, f.cancelAction));
    assert.deepEqual(ownEvent(done, f.owner), { ...before, spice: before.spice + 1 }); assert.deepEqual(ownEvent(done, f.bg), bgBefore);
    assert.equal(done.discard.filter(card => card.id === f.karama).length, 1);
    assert.equal(player(done, f.holder).hand.some(card => card.id === f.karama), false);
    originalAccounting(done, f);
  });

  void test(`${mode} all four minimal BG policies and original Karama responders act legally on the revival arrival`, () => {
    const f = fixture({ advanced }), { game } = bgOffer(f);
    for (const difficulty of DIFFICULTIES) {
      const own = viewGame(game, f.bg); own.players.find(seat => seat.id === f.bg)!.bot = difficulty;
      const actions = botActions(own); assert.ok(actions.length, difficulty);
      const declared = act(game, f.bg, actions[0]);
      if (declared.response) {
        const counter = viewGame(declared, f.holder);
        counter.players.find(seat => seat.id === f.holder)!.bot = difficulty;
        const replies = botActions(counter); assert.ok(replies.length, difficulty);
        assert.doesNotThrow(() => act(declared, f.holder, replies[0]), difficulty);
      }
      const done = finish(pass(declared)); originalAccounting(done, f);
      assert.deepEqual(inventory(done), f.originalInventory);
    }
  });
}

void test('Advanced genuine revived Tleilaxu arrival permits one advisor to accompany into its original Carthag destination', () => {
  const f = fixture(), { game } = bgOffer(f), before = ownEvent(game, f.owner);
  const done = finish(pass(act(game, f.bg, f.accompanyAction)));
  assert.deepEqual(ownEvent(done, f.owner), { ...before, spice: before.spice + 1 });
  assert.equal(player(done, f.bg).reserves, 18);
  assert.equal(player(done, f.bg).forces[f.destination], 1);
  assert.equal(isAdvisor(player(done, f.bg), f.territory), true);
  assert.equal(player(done, f.bg).forces['polar_sink:0'], 1);
  assert.ok(player(done, f.holder).hand.some(card => card.id === f.karama));
  originalAccounting(done, f);
});

void test('Advanced actual BG resident fighters receive Intrusion before the revived arrival Spiritual followup', () => {
  const f = fixture({ resident: true }); assert.ok(f.residentShipment);
  assert.equal(player(f.residentShipment.before, f.bg).spice - player(f.residentShipment.after, f.bg).spice, 1);
  assert.equal(player(f.game, f.bg).reserves, 18); assert.equal(isAdvisor(player(f.game, f.bg), f.territory), false);
  const returned = open(f.game, f), placed = commit(returned, f).game;
  assert.equal(placed.decision?.kind, 'intrusion'); assert.equal(placed.decision?.player, f.bg);
  assert.equal(player(placed, f.owner).forces[f.destination], 1);
  const before = ownEvent(placed, f.owner);
  const converting = act(placed, f.bg, { type: 'decision', accept: true });
  assert.equal(converting.response?.kind, 'advisorFlip'); assert.equal(converting.response?.advisors, true);
  const offered = pass(converting);
  assert.equal(isAdvisor(player(offered, f.bg), f.territory), true);
  assert.equal(offered.decision?.kind, 'advisor'); assert.equal(offered.decision?.player, f.bg);
  const done = finish(pass(act(offered, f.bg, f.accompanyAction)));
  assert.deepEqual(ownEvent(done, f.owner), { ...before, spice: before.spice + 1 });
  assert.equal(player(done, f.bg).forces[f.destination], 2);
  assert.equal(player(done, f.bg).reserves, 17); assert.equal(isAdvisor(player(done, f.bg), f.territory), true);
  originalAccounting(done, f);
});

void test('Advanced original Karama can prevent Intrusion conversion while the revived force and later decline remain committed', () => {
  const f = fixture({ resident: true }), returned = open(f.game, f), placed = commit(returned, f).game;
  assert.equal(placed.decision?.kind, 'intrusion');
  const before = ownEvent(placed, f.owner), bgBefore = ownEvent(placed, f.bg);
  const converting = act(placed, f.bg, { type: 'decision', accept: true });
  assert.equal(converting.response?.kind, 'advisorFlip');
  const offered = act(converting, f.holder, f.cancelAction);
  assert.equal(offered.decision?.kind, 'advisor'); assert.equal(isAdvisor(player(offered, f.bg), f.territory), false);
  const done = finish(act(offered, f.bg, f.declineAction));
  assert.deepEqual(ownEvent(done, f.owner), { ...before, spice: before.spice + 1 }); assert.deepEqual(ownEvent(done, f.bg), bgBefore);
  assert.equal(done.discard.filter(card => card.id === f.karama).length, 1);
  originalAccounting(done, f);
});
