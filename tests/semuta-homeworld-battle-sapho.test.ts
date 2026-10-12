import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, handLimit, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { reactSemutaHomeworldChoam } from './fixture-semuta-homeworld-choam';
import { semutaEmperorPlayer as player } from './fixture-semuta-emperor-share';
import { withoutSemutaHomeworldChoamMovementHolder } from './fixture-semuta-homeworld-choam-movement';
import {
  createSemutaHomeworldBattleSaphoFixture, disposeSemutaHomeworldBattleSapho,
  finishSemutaHomeworldBattleSapho,
} from './fixture-semuta-homeworld-battle-sapho';

const combos = [
  { scope: 'aggressor', mode: 'first' },
  { scope: 'order', mode: 'first' },
  { scope: 'order', mode: 'last' },
] as const;

/** Only original force, wallet, leader and tank custody — never the committed
 * Sapho card, its discard or the scheduling receipt, which the action changes. */
function custody(game: Game) {
  return game.players.map(seat => ({ id: seat.id, spice: seat.spice, reserves: seat.reserves,
    tanks: seat.tanks, forces: structuredClone(seat.forces), elites: structuredClone(seat.elites),
    leaders: structuredClone(seat.leaders) }));
}

function offerEvent(game: Game): string {
  const pending = game.pendingTreacheryDiscard;
  assert.ok(pending, 'A fresh public disposal offer must be open');
  assert.equal(pending.reaction?.stage, 'offer');
  return pending.batch.event;
}

function passOffer(state: Game): Game {
  let game = state;
  if (!game.pendingTreacheryDiscard) return game;
  const event = offerEvent(game);
  for (const seat of state.players) {
    if (!game.pendingTreacheryDiscard) break;
    const reaction = game.pendingTreacheryDiscard.reaction;
    assert.ok(reaction?.stage === 'offer');
    if (!reaction.passed.includes(seat.id))
      game = applyAction(game, seat.id, { type: 'semutaPass', event });
  }
  return game;
}

for (const advanced of [false, true]) for (const combo of combos) {
  const label = `${advanced ? 'Advanced' : 'Basic'} Homeworld Sapho ${combo.scope} ${combo.mode}`;

  void test(`${label}: actual paid prefix disposes the exact card and commits its real effect`, () => {
    const f = createSemutaHomeworldBattleSaphoFixture(combo.scope, combo.mode, advanced);
    for (const shipment of f.shipments) {
      const amount = shipment.actor === f.choam ? 4 : 1;
      const price = shipment.actor === f.holder ? 1 : 2 * amount;
      const destination = shipment.actor === f.holder ? 'arrakeen:10' : f.location;
      assert.equal(player(shipment.after, shipment.actor).spice,
        player(shipment.before, shipment.actor).spice - price);
      assert.equal(player(shipment.after, shipment.actor).reserves,
        player(shipment.before, shipment.actor).reserves - amount);
      assert.equal(player(shipment.after, shipment.actor).forces[destination], amount);
      assert.deepEqual(player(shipment.after, shipment.actor).elites,
        player(shipment.before, shipment.actor).elites);
    }
    const pending = disposeSemutaHomeworldBattleSapho(f);
    assert.equal(player(pending, f.owner).hand.some(card => card.id === f.card), false);
    assert.equal(pending.discard.filter(card => card.id === f.card).length, 1);
    assert.deepEqual(pending.order, f.game.order, 'Physical storm order is never rewritten');
    assert.deepEqual(custody(pending), custody(f.game), 'No paid prefix, leader or casualty moves');
    if (f.scope === 'aggressor') {
      assert.equal(pending.battle!.saphoAggressor!.uses.at(-1)!.player, f.owner);
      assert.deepEqual(pending.battleOrder, f.game.battleOrder,
        'Early aggression preserves original remaining chooser state');
    } else {
      assert.ok(!pending.battle, 'A completed prefix does not create the next battle');
      assert.equal(pending.battleOrder!.uses.length, 1);
      assert.equal(pending.battleOrder!.uses[0].mode, f.mode);
      assert.equal(pending.battleOrder!.uses[0].player, f.owner);
      assert.deepEqual([...pending.battleOrder!.priority].sort(), [...pending.order].sort());
      assert.equal(player(pending, f.holder).tanks, 1, 'The original losing prefix force stays destroyed');
      assert.equal(player(pending, f.holder).forces['arrakeen:10'] ?? 0, 0);
      assert.equal(player(pending, f.atreides).forces['arrakeen:10'], 10, 'Atreides keeps its untouched ten');
      assert.equal(player(pending, f.atreides).reserves, player(f.completedPrefix!.before, f.atreides).reserves);
      assert.equal(pending.lastBattleContext?.event, f.completedPrefix!.event);
      assert.equal(pending.lastBattleContext?.winner, f.atreides);
      assert.equal(pending.lastBattleContext?.territory, 'arrakeen');
    }
    assert.deepEqual(pending.pendingTreacheryDiscard!.batch.entries.map(entry => entry.card.id), [f.card]);
    assert.deepEqual(pending.pendingTreacheryDiscard!.batch.entries[0].publicFace, true);
  });

  void test(`${label}: the open offer exchanges exactly the physical card or stays with Semuta`, () => {
    const f = createSemutaHomeworldBattleSaphoFixture(combo.scope, combo.mode, advanced);
    const pending = disposeSemutaHomeworldBattleSapho(f), event = offerEvent(pending);
    assert.equal(viewGame(pending, f.holder).semutaReaction?.canCommit, true);
    for (const seat of pending.players.filter(seat => seat.id !== f.holder))
      assert.equal(viewGame(pending, seat.id).semutaReaction?.canCommit, false);
    assert.throws(() => applyAction(pending, f.actor, f.action), 'The accepted disposal cannot replay');
    assert.throws(() => applyAction(pending, f.holder,
      { type: 'semutaCommit', event: `${event}-retired` }), 'A stale offer event is rejected');
    assert.throws(() => applyAction(pending, f.choam, { type: 'ready' }));
    const claimed = reactSemutaHomeworldChoam(structuredClone(pending), f.holder, true);
    const passed = reactSemutaHomeworldChoam(structuredClone(pending), f.holder, false);
    for (const done of [claimed, passed]) {
      assert.equal(done.pendingTreacheryDiscard, null);
      assert.deepEqual(custody(done), custody(pending), 'Semuta never repeats the paid prefix or casualties');
      assert.deepEqual(done.lastBattleContext, pending.lastBattleContext);
      assert.deepEqual(done.order, pending.order);
    }
    assert.equal(player(claimed, f.holder).hand.filter(card => card.id === f.card).length, 1);
    assert.equal(claimed.discard.filter(card => card.id === f.card).length, 0);
    assert.equal(claimed.discard.filter(card => card.id === SEMUTA_DRUG_ID).length, 1);
    assert.equal(player(passed, f.holder).hand.some(card => card.id === SEMUTA_DRUG_ID), true);
    assert.equal(player(passed, f.holder).hand.some(card => card.id === f.card), false);
    assert.equal(passed.discard.filter(card => card.id === f.card).length, 1);
    for (const done of [claimed, passed])
      assert.throws(() => applyAction(done, f.holder, { type: 'semutaCommit', event }));
  });

  void test(`${label}: a full native hand exchanges atomically and entitlement stays private`, () => {
    const f = createSemutaHomeworldBattleSaphoFixture(combo.scope, combo.mode, advanced, true);
    assert.equal(player(f.game, f.holder).hand.length, handLimit(player(f.game, f.holder)));
    const absent = withoutSemutaHomeworldChoamMovementHolder(f.game, f.holder);
    const pending = disposeSemutaHomeworldBattleSapho(f);
    const neutral = disposeSemutaHomeworldBattleSapho(f, absent);
    assert.equal(viewGame(pending, f.holder).semutaReaction?.canCommit, true);
    assert.equal(viewGame(neutral, f.holder).semutaReaction?.canCommit, false);
    assert.throws(() => applyAction(neutral, f.holder,
      { type: 'semutaCommit', event: neutral.pendingTreacheryDiscard!.batch.event }));
    for (const seat of pending.players.filter(seat => seat.id !== f.holder))
      assert.deepEqual(JSON.parse(JSON.stringify(viewGame(pending, seat.id))),
        JSON.parse(JSON.stringify(viewGame(neutral, seat.id))),
        'Nonholders cannot infer the private entitlement from consumer views');
    const claimed = reactSemutaHomeworldChoam(pending, f.holder, true);
    assert.equal(player(claimed, f.holder).hand.length, handLimit(player(claimed, f.holder)));
    assert.equal(player(claimed, f.holder).hand.some(card => card.id === f.card), true);
    assert.equal(player(claimed, f.holder).hand.some(card => card.id === SEMUTA_DRUG_ID), false);
    assert.deepEqual(custody(claimed), custody(pending));
  });

  void test(`${label}: the real next chooser finishes one battle and one native Collection`, () => {
    const f = createSemutaHomeworldBattleSaphoFixture(combo.scope, combo.mode, advanced);
    const done = passOffer(disposeSemutaHomeworldBattleSapho(f));
    assert.deepEqual(done.order, f.game.order);
    const result = finishSemutaHomeworldBattleSapho(done, f);
    assert.equal(result.game.turn, 1);
    assert.equal(result.game.phase, 7);
    assert.ok(!result.game.battle && !result.game.decision && !result.game.response &&
      !result.game.pendingTreacheryDiscard);
    assert.deepEqual(result.game.order, f.game.order, 'The finished phase keeps its physical circle');
    assert.equal(result.game.lastBattleContext?.result, 'normal');
    assert.equal(result.game.lastBattleContext?.territory, 'red_chasm');
    if (f.scope === 'aggressor') {
      assert.equal(result.attacker, f.emperor);
      assert.equal(result.defender, f.choam);
      assert.equal(result.game.lastBattleContext?.winner, f.owner, 'The recorded aggressor takes the tie');
    } else {
      assert.equal(result.attacker, f.emperor);
      assert.equal(result.defender, f.choam);
      assert.equal(result.target, result.attacker, 'The chooser names the actual opposing physical slot');
      assert.equal(result.game.lastBattleContext?.winner, f.emperor);
      if (combo.mode === 'first')
        assert.equal(result.chooser, f.owner, 'The first position makes the physical defender C the chooser');
      else {
        assert.equal(result.chooser, f.choam, 'A last position immunizes nobody from the current chooser');
        assert.equal(done.battleOrder!.priority.at(-1), f.owner,
          'The Emperor really holds the accepted last chooser position');
      }
    }
    const victor = f.scope === 'aggressor' ? f.owner : f.emperor;
    const loser = f.scope === 'aggressor' ? f.emperor : f.choam;
    const committed = player(done, loser).forces['red_chasm:7'] ?? 0;
    const survivors = player(result.game, victor).forces['red_chasm:7'] ?? 0;
    assert.equal(survivors, player(done, victor).forces['red_chasm:7'],
      'The winner keeps exactly its untouched committed force');
    assert.equal(player(result.game, loser).forces['red_chasm:7'] ?? 0, 0);
    assert.equal(player(result.game, loser).tanks, player(done, loser).tanks + committed,
      'Battle casualties destroy the loser force once');
    assert.equal(player(result.game, victor).tanks, player(done, victor).tanks);
    assert.equal(result.game.spice['red_chasm:7'], 8 - 2 * survivors,
      'The original eight-spice blow is drained exactly once by its surviving force');
    assert.equal(player(result.game, victor).spice, player(done, victor).spice + 2 * survivors,
      'Only the survivor collection credits the winner; no phase or receipt repeats');
    for (const seat of result.game.players.filter(seat => seat.id !== victor))
      assert.equal(seat.forces['red_chasm:7'] ?? 0, 0);
    assert.throws(() => applyAction(result.game, f.choam, { type: 'endMovement' }));
  });

  void test(`${label}: only legacy, stale or readiness-closed Sapho controls survive untouched`, () => {
    const f = createSemutaHomeworldBattleSaphoFixture(combo.scope, combo.mode, advanced);
    const scope = f.scope === 'aggressor' ? 'battleAggressor' : 'battleOrder';
    assert.equal(viewGame(f.game, f.owner).saphoOptions.find(option => option.scope === scope)?.mode,
      f.scope === 'aggressor' ? 'aggressor' : f.mode);
    const spent = applyAction(f.game, f.actor, f.action);
    assert.deepEqual(viewGame(spent, f.owner).saphoOptions, [], 'One card cannot be spent twice');
    assert.throws(() => applyAction(spent, f.actor, f.action));
    assert.throws(() => applyAction(f.game, f.actor, { ...f.action, event: 'expired' }));
    const wrong = f.scope === 'aggressor' ? 'last' : f.mode === 'first' ? 'last' : 'first';
    assert.throws(() => applyAction(f.game, f.owner, { ...f.action, mode: wrong }),
      'Only the one legal position at this boundary is accepted');
    if (f.scope === 'aggressor')
      assert.deepEqual(viewGame(applyAction(f.game, f.owner,
        { type: 'battlePreparationReady', event: f.game.battle!.event }), f.owner).saphoOptions, [],
      'The owner\'s own readiness closes the early pre-plan aggressor window');
    const other = f.game.players.find(seat => ![f.owner, f.holder].includes(seat.id))!.id;
    assert.throws(() => applyAction(f.game, other, f.action));
  });

  void test(`${label}: every minimal bot profile plays the real producer then the native battle`, () => {
    for (const difficulty of DIFFICULTIES) {
      const f = createSemutaHomeworldBattleSaphoFixture(combo.scope, combo.mode, advanced);
      const own = viewGame(structuredClone(f.game), f.owner);
      own.players.find(seat => seat.id === f.owner)!.bot = difficulty;
      const action = botActions(own).find(proposal => proposal.card === f.card);
      assert.ok(action, `${difficulty}: the owner keeps a real Sapho action`);
      assert.equal(action.scope, f.scope === 'aggressor' ? 'battleAggressor' : 'battleOrder');
      let game = applyAction(f.game, f.owner, action);
      game = passOffer(game);
      assert.ok(!game.pendingTreacheryDiscard);
      const result = finishSemutaHomeworldBattleSapho(game, f);
      assert.equal(result.game.phase, 7, `${difficulty}: the real continuation reaches Collection`);
      assert.equal(result.game.turn, 1);
    }
  });
}

const orders = combos.filter(combo => combo.scope === 'order');
for (const advanced of [false, true]) for (const combo of orders) {
  const label = `${advanced ? 'Advanced' : 'Basic'} Homeworld Sapho order ${combo.mode}`;
  void test(`${label}: finite remaining queue and the exact accepted position, no extra battle`, () => {
    const f = createSemutaHomeworldBattleSaphoFixture(combo.scope, combo.mode, advanced);
    const pending = disposeSemutaHomeworldBattleSapho(f);
    const order = pending.battleOrder!;
    const priority = order.priority;
    assert.equal(new Set(priority).size, pending.order.length);
    assert.deepEqual([...priority].sort(), [...pending.order].sort());
    if (combo.mode === 'first') assert.equal(priority.indexOf(f.owner), 0);
    else assert.equal(priority.indexOf(f.owner), priority.length - 1);
    const view = viewGame(pending, f.owner).battleOrder;
    assert.ok(view);
    assert.deepEqual(view.remaining, [f.choam, f.emperor],
      'Only the two remaining physical combatants retain one chooser opportunity');
    assert.equal(view.uses.length, 1);
    assert.ok(!pending.battle);
    assert.deepEqual(pending.order, f.game.order);
  });
}

for (const advanced of [false, true]) void test(`${advanced ? 'Advanced' : 'Basic'} early aggressor retains the opponent's completed readiness through Semuta`, () => {
  const f = createSemutaHomeworldBattleSaphoFixture('aggressor', 'first', advanced, true);
  const event = f.game.battle!.event!;
  const ready = applyAction(f.game, f.emperor, { type: 'battlePreparationReady', event });
  const pending = disposeSemutaHomeworldBattleSapho(f, ready);
  assert.equal(pending.pendingTreacheryDiscard?.continuation.kind, 'saphoAggressorDiscard');
  const done = reactSemutaHomeworldChoam(pending, f.holder, true);
  assert.deepEqual(done.battle!.preLeader!.ready, [f.emperor]);
  assert.deepEqual(custody(done), custody(ready));
  assert.equal(done.battle!.attacker, f.emperor);
  assert.equal(done.battle!.defender, f.choam);
  assert.equal(done.battle!.chooser, f.emperor);
  assert.equal(done.battle!.saphoAggressor!.uses.at(-1)!.player, f.choam);
  const prepared = applyAction(done, f.choam, { type: 'battlePreparationReady', event });
  assert.equal(prepared.battle!.preLeader!.closed, true);
  const result = finishSemutaHomeworldBattleSapho(prepared, f);
  assert.equal(result.game.lastBattleContext!.winner, f.choam);
  assert.equal(player(result.game, f.choam).forces[f.location], 4);
  assert.equal(player(result.game, f.emperor).tanks, 1);
  assert.equal(result.game.phase, 7);
});
