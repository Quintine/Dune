import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, handLimit, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { semutaEmperorPlayer as player } from './fixture-semuta-emperor-share';
import { reactSemutaHomeworldChoam } from './fixture-semuta-homeworld-choam';
import { withoutSemutaHomeworldChoamMovementHolder } from './fixture-semuta-homeworld-choam-movement';
import {
  createSemutaHomeworldWinnerFixture, disposeSemutaHomeworldWinner,
  finishSemutaHomeworldWinner, semutaHomeworldWinnerResources as resources,
  semutaHomeworldWinnerStock as stock, type SemutaHomeworldWinnerFixture,
} from './fixture-semuta-homeworld-battle-winner';

function assertOriginalBattle(f: SemutaHomeworldWinnerFixture, game: Game) {
  assert.equal(game.turn, 1);
  assert.equal(game.lastBattleContext?.winner, f.winner);
  assert.equal(game.lastBattleContext?.result, 'normal');
  assert.equal(game.lastBattleContext?.territory, 'red_chasm');
  assert.ok(!game.battle, 'The accepted original battle is not reopened');
  assert.equal(player(game, f.winner).forces[f.location], 3);
  assert.equal(player(game, f.winner).reserves, 16);
  assert.equal(player(game, f.winner).tanks, 1);
  assert.equal(player(game, f.winner).battleLosses,
    player(f.beforeBattle, f.winner).battleLosses + 1);
  assert.equal(player(game, f.loser).forces[f.location] ?? 0, 0);
  assert.equal(player(game, f.loser).reserves, 19);
  assert.equal(player(game, f.loser).tanks, 1);
  assert.equal(player(game, f.loser).leaders.find(l => l.id === f.loserLeader)?.dead, true);
  assert.equal(player(f.beforeBattle, f.loser).leaders.find(l => l.id === f.loserLeader)?.dead, false);
  assert.equal(player(game, f.winner).spice,
    player(f.beforeBattle, f.winner).spice - Number(game.advanced) +
      player(f.beforeBattle, f.loser).leaders.find(l => l.id === f.loserLeader)!.strength,
    'Only original supported dial cost and killed-leader income change CHOAM spice');
  assert.equal(player(game, f.loser).spice, player(f.beforeBattle, f.loser).spice,
    'Emperor dials and pays zero; no CHOAM opponent battle income is invented');
  assert.deepEqual(game.homeworlds?.custody, f.shipments[1].after.homeworlds?.custody,
    'Original paid native Homeworld withdrawal remains unchanged by battle cleanup');
  for (const seat of game.players.filter(p => ![f.winner, f.loser].includes(p.id))) {
    const before = player(f.beforeBattle, seat.id);
    assert.deepEqual(seat.forces, before.forces);
    assert.deepEqual(seat.elites, before.elites);
    assert.equal(seat.reserves, before.reserves);
    assert.equal(seat.tanks, before.tanks);
    assert.equal(seat.spice, before.spice);
  }
  assert.deepEqual(stock(game), stock(f.setup));
}

function assertExchange(f: SemutaHomeworldWinnerFixture, pending: Game, game: Game, claim: boolean) {
  assert.ok(!game.pendingTreacheryDiscard);
  assert.deepEqual(resources(game), resources(pending), 'Semuta never repeats accepted combat or casualties');
  assert.deepEqual(game.lastBattleContext, pending.lastBattleContext);
  assert.equal(player(game, f.owner).hand.some(c => c.id === f.card), false);
  assert.equal(player(game, f.owner).hand.some(c => c.id === f.kept), true);
  if (f.kind === 'mandatory')
    assert.equal(player(game, f.owner).hand.some(c => c.id === f.projectile), true);
  assert.equal(player(game, f.holder).hand.filter(c => c.id === f.card).length, Number(claim));
  assert.equal(game.discard.filter(c => c.id === f.card).length, Number(!claim));
  assert.equal(player(game, f.holder).hand.some(c => c.id === SEMUTA_DRUG_ID), !claim);
  assert.equal(game.discard.filter(c => c.id === SEMUTA_DRUG_ID).length, Number(claim));
  assert.equal(game.discard.filter(c => c.id === f.worthless).length, 1,
    'Earlier losing Worthless remains in its original discard, not the later offer');
  for (const seat of game.players) {
    const expected = player(pending, seat.id).hand.map(c => c.id)
      .filter(id => seat.id !== f.holder || !claim || id !== SEMUTA_DRUG_ID);
    if (seat.id === f.holder && claim) expected.push(f.card);
    assert.deepEqual(seat.hand.map(c => c.id).sort(), expected.sort(),
      'Exactly the chosen card exchanges with Semuta; every other physical hand card stays put');
  }
  assertOriginalBattle(f, game);
  assert.equal(game.decision?.kind, f.kind === 'mandatory' ? 'battleCards' : 'choamMarket');
  assert.equal(game.decision?.player, f.owner);
}

function finishOnce(f: SemutaHomeworldWinnerFixture, state: Game) {
  const expected = resources(state), context = structuredClone(state.lastBattleContext);
  const collection = quoteSpiceCollection(state);
  assert.equal(collection.receipts.find(receipt => receipt.player === f.owner)!.desert, 6,
    'Three surviving ordinary counters collect six from the original eight-spice blow');
  for (const receipt of collection.receipts)
    expected.players.find(p => p.id === receipt.player)!.spice = receipt.balance;
  const game = finishSemutaHomeworldWinner(state);
  assert.equal(game.phase, 7);
  assert.equal(game.turn, 1);
  assert.ok(!game.decision && !game.response && !game.pendingTreacheryDiscard);
  assert.deepEqual(resources(game), expected,
    'Original Collection credits its board once; battle casualties and death income do not repeat');
  assert.deepEqual(game.spice, collection.spice);
  assert.deepEqual(game.lastBattleContext, context);
  assert.throws(() => applyAction(game, f.owner, { type: 'decision', done: true }),
    'The original native CHOAM market cannot close twice');
  return game;
}

for (const advanced of [false, true]) for (const kind of ['mandatory', 'selected'] as const) {
  const label = `${advanced ? 'Advanced' : 'Basic'} paid Homeworld winner ${kind}`;
  for (const claim of [false, true]) void test(`${label}: ${claim ? 'claim' : 'all-pass'} exact fresh card before one native cleanup`, () => {
    const f = createSemutaHomeworldWinnerFixture(kind, advanced);
    for (const shipment of f.shipments) {
      assert.equal(shipment.action.type, 'ship');
      assert.equal(player(shipment.after, shipment.actor).spice,
        player(shipment.before, shipment.actor).spice - (shipment.actor === f.loser ? 2 : 8));
      assert.equal(player(shipment.after, shipment.actor).reserves,
        player(shipment.before, shipment.actor).reserves - (shipment.actor === f.loser ? 1 : 4));
      assert.deepEqual(player(shipment.after, shipment.actor).elites, player(shipment.before, shipment.actor).elites,
        'These quotes ship ordinary native counters, not Sardaukar');
    }
    const pending = disposeSemutaHomeworldWinner(f);
    const event = pending.pendingTreacheryDiscard!.batch.event;
    assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
    assert.deepEqual(pending.pendingTreacheryDiscard?.batch.entries.map(e => e.card.id), [f.card]);
    assert.equal(pending.discard.filter(c => c.id === f.card).length, 1);
    assert.equal(viewGame(pending, f.holder).semutaReaction?.canCommit, true);
    assertOriginalBattle(f, pending);
    assert.throws(() => applyAction(pending, f.actor, f.action), 'Accepted original disposal cannot replay');
    assert.throws(() => applyAction(pending, f.owner, { type: 'decision', discard: [] }));
    assert.throws(() => applyAction(pending, f.loser, { type: 'ready' }));
    assert.throws(() => applyAction(pending, f.loser, { type: 'semutaCommit', event }));
    assert.throws(() => applyAction(pending, f.holder, { type: 'semutaCommit', event: `${event}-retired` }));
    const acknowledged = applyAction(pending, f.loser, { type: 'semutaPass', event });
    assert.deepEqual(resources(acknowledged), resources(pending));
    assert.equal(viewGame(acknowledged, f.holder).semutaReaction?.canCommit, true,
      'A nonholder acknowledgement does not advance cleanup or close holder entitlement');
    assert.throws(() => applyAction(acknowledged, f.loser, { type: 'semutaPass', event }));
    assert.throws(() => applyAction(acknowledged, f.loser, { type: 'semutaCommit', event }));
    const done = claim
      ? applyAction(acknowledged, f.holder, { type: 'semutaCommit', event })
      : reactSemutaHomeworldChoam(structuredClone(pending), f.holder, false);
    assertExchange(f, pending, done, claim);
    for (const action of [{ type: 'semutaCommit', event }, { type: 'semutaPass', event },
      { type: 'semutaSelect', event, card: f.card }])
      assert.throws(() => applyAction(done, f.holder, action));
    const collected = finishOnce(f, done);
    assert.equal(player(collected, f.owner).hand.some(c => c.id === f.kept), true);
    assert.throws(() => applyAction(collected, f.holder, { type: 'semutaCommit', event }));
  });

  void test(`${label}: full native Richese hand exchanges atomically and entitlement stays private`, () => {
    const f = createSemutaHomeworldWinnerFixture(kind, advanced, true);
    assert.equal(player(f.game, f.holder).hand.length, 4);
    assert.equal(player(f.game, f.holder).hand.length, handLimit(player(f.game, f.holder)));
    const absent = withoutSemutaHomeworldChoamMovementHolder(f.game, f.holder);
    const pending = disposeSemutaHomeworldWinner(f);
    const neutral = disposeSemutaHomeworldWinner(f, absent);
    assert.equal(viewGame(pending, f.holder).semutaReaction?.canCommit, true);
    assert.equal(viewGame(neutral, f.holder).semutaReaction?.canCommit, false);
    for (const seat of pending.players.filter(p => p.id !== f.holder)) {
      assert.deepEqual(JSON.parse(JSON.stringify(viewGame(pending, seat.id))),
        JSON.parse(JSON.stringify(viewGame(neutral, seat.id))),
        'Nonholders cannot infer the private Semuta entitlement from consumer views');
      assert.equal(viewGame(pending, seat.id).semutaReaction?.canCommit, false);
    }
    const claimed = reactSemutaHomeworldChoam(pending, f.holder, true);
    assertExchange(f, pending, claimed, true);
    assert.equal(player(claimed, f.holder).hand.length, 4);
    const passed = reactSemutaHomeworldChoam(neutral, f.holder, false);
    assert.deepEqual(resources(claimed), resources(passed));
    finishOnce(f, claimed);
    finishOnce(f, passed);
  });

  void test(`${label}: original selected multi-card batch requires a private exact one-card commitment`, () => {
    const f = createSemutaHomeworldWinnerFixture(kind, advanced, true);
    let originalCleanup = f.game;
    if (kind === 'mandatory') {
      const mandatory = disposeSemutaHomeworldWinner(f);
      originalCleanup = reactSemutaHomeworldChoam(mandatory, f.holder, false);
    }
    assert.equal(originalCleanup.decision?.kind, 'battleCards');
    const pending = applyAction(originalCleanup, f.owner,
      { type: 'decision', discard: [f.projectile, f.kept] });
    const event = pending.pendingTreacheryDiscard!.batch.event;
    assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
    assert.deepEqual(viewGame(pending, f.holder).semutaReaction?.candidates, []);
    assert.equal(player(pending, f.owner).hand.some(c => c.id === f.projectile || c.id === f.kept), false);
    assert.throws(() => applyAction(pending, f.holder, { type: 'semutaSelect', event, card: f.projectile }));
    const committed = applyAction(pending, f.holder, { type: 'semutaCommit', event });
    assert.equal(committed.pendingTreacheryDiscard?.reaction?.stage, 'select');
    assert.deepEqual(viewGame(committed, f.holder).semutaReaction?.candidates.map(c => c.id).sort(),
      [f.projectile, f.kept].sort());
    for (const seat of committed.players.filter(p => p.id !== f.holder)) {
      assert.deepEqual(viewGame(committed, seat.id).semutaReaction?.candidates, []);
      assert.throws(() => applyAction(committed, seat.id, { type: 'semutaSelect', event, card: f.projectile }));
    }
    assert.throws(() => applyAction(committed, f.holder, { type: 'semutaPass', event }));
    assert.throws(() => applyAction(committed, f.holder, { type: 'semutaCommit', event }));
    assert.throws(() => applyAction(committed, f.holder, { type: 'semutaSelect', event, card: f.worthless }));
    assert.deepEqual(resources(committed), resources(pending));
    for (const chosen of [f.projectile, f.kept]) {
      const done = applyAction(structuredClone(committed), f.holder, { type: 'semutaSelect', event, card: chosen });
      const other = chosen === f.projectile ? f.kept : f.projectile;
      assert.equal(player(done, f.holder).hand.filter(c => c.id === chosen).length, 1);
      assert.equal(player(done, f.holder).hand.length, 4);
      assert.equal(done.discard.filter(c => c.id === chosen).length, 0);
      assert.equal(done.discard.filter(c => c.id === other).length, 1);
      assert.equal(done.discard.filter(c => c.id === SEMUTA_DRUG_ID).length, 1);
      assert.equal(done.discard.filter(c => c.id === f.worthless).length, 1);
      if (kind === 'mandatory') assert.equal(done.discard.filter(c => c.id === f.card).length, 1);
      assert.deepEqual(resources(done), resources(pending));
      assert.deepEqual(stock(done), stock(f.setup));
      const remaining = player(pending, f.holder).hand.map(c => c.id).filter(id => id !== SEMUTA_DRUG_ID);
      assert.deepEqual(player(done, f.holder).hand.map(c => c.id).sort(), [...remaining, chosen].sort());
      assert.throws(() => applyAction(done, f.holder, { type: 'semutaSelect', event, card: other }));
      finishOnce(f, done);
    }
  });

  for (const difficulty of DIFFICULTIES) void test(`${difficulty}: legal minimum ${label} consumer and native continuation`, () => {
    const f = createSemutaHomeworldWinnerFixture(kind, advanced);
    const pending = disposeSemutaHomeworldWinner(f);
    const own = viewGame(pending, f.holder);
    own.players.find(p => p.id === f.holder)!.bot = difficulty;
    const action = botActions(own)[0];
    assert.ok(action);
    assert.ok(action.type === 'semutaCommit' || action.type === 'semutaPass');
    let game = applyAction(pending, f.holder, action);
    if (game.pendingTreacheryDiscard) {
      const event = game.pendingTreacheryDiscard.batch.event;
      for (const seat of game.players) {
        if (!game.pendingTreacheryDiscard) break;
        const reaction = game.pendingTreacheryDiscard.reaction;
        assert.ok(reaction?.stage === 'offer');
        if (!reaction.passed.includes(seat.id))
          game = applyAction(game, seat.id, { type: 'semutaPass', event });
      }
    }
    assertExchange(f, pending, game, action.type === 'semutaCommit');
    finishOnce(f, game);
  });
}

for (const advanced of [false, true]) void test(`${advanced ? 'Advanced' : 'Basic'} original losing, mandatory winning and selected cleanup are distinct fresh events`, () => {
  const f = createSemutaHomeworldWinnerFixture('mandatory', advanced);
  let game = applyAction(f.game, f.actor, f.action);
  const losingEvent = game.pendingTreacheryDiscard!.batch.event;
  assert.deepEqual(game.pendingTreacheryDiscard?.batch.entries.map(e => e.card.id), [f.worthless]);
  assert.equal(player(game, f.owner).hand.some(c => c.id === f.card), true,
    'Mandatory winner Hero is still physically reserved through the earlier losing offer');
  assert.equal(player(game, f.owner).forces[f.location], 4, 'Winner casualties follow the first offer');
  assert.equal(player(game, f.owner).tanks, 0);
  assert.equal(player(game, f.holder).hand.some(c => c.id === SEMUTA_DRUG_ID), true);
  game = reactSemutaHomeworldChoam(game, f.holder, false);
  const mandatoryEvent = game.pendingTreacheryDiscard!.batch.event;
  assert.notEqual(mandatoryEvent, losingEvent);
  assert.deepEqual(game.pendingTreacheryDiscard?.batch.entries.map(e => e.card.id), [f.card]);
  assertOriginalBattle(f, game);
  assert.throws(() => applyAction(game, f.holder, { type: 'semutaCommit', event: losingEvent }));
  assert.throws(() => applyAction(game, f.loser, { type: 'semutaPass', event: losingEvent }));
  game = reactSemutaHomeworldChoam(game, f.holder, false);
  assert.equal(game.decision?.kind, 'battleCards');
  assert.equal(game.decision?.player, f.owner);
  assert.throws(() => applyAction(game, f.loser, { type: 'decision', discard: [f.projectile] }));
  game = applyAction(game, f.owner, { type: 'decision', discard: [f.projectile] });
  const selectedEvent = game.pendingTreacheryDiscard!.batch.event;
  assert.notEqual(selectedEvent, losingEvent);
  assert.notEqual(selectedEvent, mandatoryEvent);
  assert.deepEqual(game.pendingTreacheryDiscard?.batch.entries.map(e => e.card.id), [f.projectile]);
  assert.throws(() => applyAction(game, f.holder, { type: 'semutaCommit', event: mandatoryEvent }));
  const before = resources(game);
  game = reactSemutaHomeworldChoam(game, f.holder, true);
  assert.deepEqual(resources(game), before);
  assert.equal(player(game, f.holder).hand.filter(c => c.id === f.projectile).length, 1);
  assert.equal(game.discard.filter(c => c.id === f.card).length, 1);
  assert.equal(game.discard.filter(c => c.id === f.worthless).length, 1);
  assert.equal(player(game, f.owner).hand.some(c => c.id === f.kept), true);
  finishOnce(f, game);
});
