import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, handLimit, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { residualPoisonCandidates, residualPoisonDeath } from '../game/residual-poison';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { semutaEmperorPlayer as player } from './fixture-semuta-emperor-share';
import { reactSemutaHomeworldChoam } from './fixture-semuta-homeworld-choam';
import { withoutSemutaHomeworldChoamMovementHolder } from './fixture-semuta-homeworld-choam-movement';
import { semutaHomeworldWinnerResources as resources, semutaHomeworldWinnerStock as stock } from './fixture-semuta-homeworld-battle-winner';
import { createSemutaHomeworldResidualPoisonFixture, disposeSemutaHomeworldResidualPoison,
  finishSemutaHomeworldResidualPoison, type SemutaHomeworldResidualPoisonFixture } from './fixture-semuta-homeworld-residual-poison';

function rejectUnchanged(game: Game, actor: string, action: Action) {
  const before = JSON.stringify(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.equal(JSON.stringify(game), before, 'Rejected actions preserve the original physical game');
}

function assertNativePoison(f: SemutaHomeworldResidualPoisonFixture, game: Game, before = f.game) {
  const prior = player(before, f.target).leaders;
  const changed = player(game, f.target).leaders.filter(l =>
    JSON.stringify(l) !== JSON.stringify(prior.find(old => old.id === l.id)));
  assert.equal(changed.length, 1, 'Exactly one original Emperor disc changes at the Poison cost boundary');
  const victim = changed[0];
  assert.ok(residualPoisonCandidates(prior, 'red_chasm').some(l => l.id === victim.id));
  assert.deepEqual(victim, residualPoisonDeath(prior.find(l => l.id === victim.id)!));
  const expected = resources(before);
  expected.players.find(p => p.id === f.target)!.leaders = prior.map(l =>
    l.id === victim.id ? residualPoisonDeath(l) : l);
  assert.deepEqual(resources(game), expected,
    'Poison awards no spice, loses no counters, and leaves every other leader/custody/resource unchanged');
  assert.equal(player(game, f.owner).forces[f.location], 4);
  assert.equal(player(game, f.target).forces[f.location], 1);
  assert.equal(player(game, f.owner).hand.some(c => c.id === f.card), false);
  assert.equal(game.discard.filter(c => c.id === f.card).length, 1);
  assert.equal(game.battle?.event, f.event);
  assert.deepEqual(game.battle?.plans, {});
  assert.deepEqual(stock(game), stock(f.setup));
  return victim.id;
}

function assertExchange(f: SemutaHomeworldResidualPoisonFixture, pending: Game, game: Game,
  claim: boolean, holderHasSemuta = true) {
  assert.ok(!game.pendingTreacheryDiscard);
  assert.deepEqual(resources(game), resources(pending), 'Resume neither redraws nor repeats the committed native death');
  assert.deepEqual(game.battle, pending.battle, 'The original shared preparation event and readiness resume unchanged');
  assert.equal(player(game, f.holder).hand.filter(c => c.id === f.card).length, Number(claim));
  assert.equal(game.discard.filter(c => c.id === f.card).length, Number(!claim));
  if (holderHasSemuta) {
    assert.equal(game.discard.filter(c => c.id === SEMUTA_DRUG_ID).length, Number(claim));
    assert.equal(player(game, f.holder).hand.some(c => c.id === SEMUTA_DRUG_ID), !claim);
  } else
    assert.equal(player(game, f.holder).hand.some(c => c.id === SEMUTA_DRUG_ID), false,
      'The absent-holder fork never returns the Semuta Drug to this seat');
  for (const seat of game.players) {
    const expected = player(pending, seat.id).hand.map(c => c.id)
      .filter(id => seat.id !== f.holder || !claim || id !== SEMUTA_DRUG_ID);
    if (seat.id === f.holder && claim) expected.push(f.card);
    assert.deepEqual(seat.hand.map(c => c.id).sort(), expected.sort());
    assert.ok(seat.hand.length <= handLimit(seat));
  }
  assert.deepEqual(stock(game), stock(f.setup));
}

function finishOnce(f: SemutaHomeworldResidualPoisonFixture, state: Game, victim: string) {
  const acceptedVictim = structuredClone(player(state, f.target).leaders.find(l => l.id === victim));
  const finished = finishSemutaHomeworldResidualPoison(f, state);
  const { beforePlans, afterBattle, beforeCollection, game } = finished;
  assert.equal(beforePlans.battle?.event, f.event);
  assert.equal(beforePlans.battle?.preLeader?.closed, true);
  assert.deepEqual(beforePlans.battle?.preLeader?.ready.slice().sort(), [f.owner, f.target].sort());
  assert.notEqual(finished.loserLeader, victim, 'Future native plans select a currently living Emperor disc, never the random victim');
  assert.equal(player(beforePlans, f.target).leaders.find(l => l.id === finished.loserLeader)?.dead, false);
  assert.equal(afterBattle.lastBattleContext?.winner, f.owner);
  assert.equal(afterBattle.lastBattleContext?.result, 'normal');
  assert.equal(afterBattle.lastBattleContext?.territory, 'red_chasm');
  assert.ok(!afterBattle.battle);
  assert.equal(player(afterBattle, f.owner).forces[f.location], 3);
  assert.equal(player(afterBattle, f.owner).reserves, 16);
  assert.equal(player(afterBattle, f.owner).tanks, player(beforePlans, f.owner).tanks + 1);
  assert.equal(player(afterBattle, f.owner).battleLosses, player(beforePlans, f.owner).battleLosses + 1);
  assert.equal(player(afterBattle, f.target).forces[f.location] ?? 0, 0);
  assert.equal(player(afterBattle, f.target).reserves, 19);
  assert.equal(player(afterBattle, f.target).tanks, player(beforePlans, f.target).tanks + 1);
  const combatLeader = player(beforePlans, f.target).leaders.find(l => l.id === finished.loserLeader)!;
  assert.equal(player(afterBattle, f.target).leaders.find(l => l.id === combatLeader.id)?.dead, true);
  assert.equal(player(afterBattle, f.target).leaders.find(l => l.id === combatLeader.id)?.deaths, combatLeader.deaths + 1);
  assert.deepEqual(player(afterBattle, f.target).leaders.find(l => l.id === victim), acceptedVictim);
  assert.equal(player(afterBattle, f.owner).spice,
    player(beforePlans, f.owner).spice - Number(game.advanced) + combatLeader.strength,
    'Only actual supported dial cost and the distinct killed combat leader produce battle spice');
  assert.equal(player(afterBattle, f.target).spice, player(beforePlans, f.target).spice);
  assert.deepEqual(afterBattle.homeworlds?.custody, f.shipments[1].after.homeworlds?.custody);
  const collection = quoteSpiceCollection(beforeCollection), expected = resources(beforeCollection);
  assert.equal(collection.receipts.find(r => r.player === f.owner)?.desert, 6,
    'Three surviving counters collect six from the original eight-spice Red Chasm blow');
  for (const receipt of collection.receipts) expected.players.find(p => p.id === receipt.player)!.spice = receipt.balance;
  assert.deepEqual(resources(game), expected, 'Native Collection credits legitimate board/stronghold income once');
  assert.deepEqual(game.spice, collection.spice);
  assert.deepEqual(game.lastBattleContext, afterBattle.lastBattleContext);
  assert.deepEqual(player(game, f.target).leaders.find(l => l.id === victim), acceptedVictim);
  assert.deepEqual(stock(game), stock(f.setup));
  assert.equal(game.phase, 7);
  assert.equal(game.turn, 1);
  assert.ok(!game.response && !game.decision && !game.pendingTreacheryDiscard);
  rejectUnchanged(game, f.owner, { type: 'decision', done: true });
}

for (const advanced of [false, true]) {
  const label = `${advanced ? 'Advanced' : 'Basic'} paid Homeworld Residual Poison`;
  for (const full of [false, true]) for (const claim of [false, true])
    void test(`${label}: ${full ? 'full four-card' : 'thin'} hand ${claim ? 'claim' : 'all-pass'} preserves native death and future battle`, () => {
      const f = createSemutaHomeworldResidualPoisonFixture(advanced, full);
      assert.equal(f.chooser, f.target);
      assert.equal(viewGame(f.game, f.owner).residualPoison?.blocked, null);
      assert.equal(viewGame(f.game, f.owner).residualPoison?.target, f.target);
      assert.equal(player(f.game, f.holder).hand.length === 4, full);
      for (const shipment of f.shipments) {
        const amount = shipment.actor === f.target ? 1 : 4;
        assert.equal(player(shipment.after, shipment.actor).spice, player(shipment.before, shipment.actor).spice - 2 * amount);
        assert.equal(player(shipment.after, shipment.actor).reserves, player(shipment.before, shipment.actor).reserves - amount);
        assert.equal(player(shipment.after, shipment.actor).forces[f.location], amount);
        assert.deepEqual(player(shipment.after, shipment.actor).elites, player(shipment.before, shipment.actor).elites);
      }
      rejectUnchanged(f.game, f.holder, f.action);
      rejectUnchanged(f.game, f.owner, { ...f.action, target: f.holder });
      rejectUnchanged(f.game, f.owner, { ...f.action, event: `${f.event}-stale` });
      rejectUnchanged(f.beforeBattle, f.owner, f.action);
      const pending = disposeSemutaHomeworldResidualPoison(f);
      const victim = assertNativePoison(f, pending);
      const event = pending.pendingTreacheryDiscard!.batch.event;
      assert.equal(pending.pendingTreacheryDiscard?.continuation.kind, 'residualPoisonDiscard');
      assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
      assert.deepEqual(pending.pendingTreacheryDiscard?.batch.entries.map(e => e.card.id), [f.card]);
      assert.equal(viewGame(pending, f.holder).semutaReaction?.canCommit, true);
      rejectUnchanged(pending, f.owner, f.action);
      rejectUnchanged(pending, f.target, { type: 'battlePreparationReady', event: f.event });
      rejectUnchanged(pending, f.target, { type: 'semutaCommit', event });
      rejectUnchanged(pending, f.holder, { type: 'semutaCommit', event: `${event}-stale` });
      rejectUnchanged(pending, f.holder, { type: 'semutaSelect', event, card: f.shield });
      const acknowledged = applyAction(pending, f.target, { type: 'semutaPass', event });
      assert.deepEqual(resources(acknowledged), resources(pending));
      rejectUnchanged(acknowledged, f.target, { type: 'semutaPass', event });
      const done = reactSemutaHomeworldChoam(JSON.parse(JSON.stringify(pending)) as Game, f.holder, claim);
      assertExchange(f, pending, done, claim);
      assert.deepEqual(player(done, f.target).leaders.find(l => l.id === victim), player(pending, f.target).leaders.find(l => l.id === victim));
      rejectUnchanged(done, f.holder, { type: 'semutaCommit', event });
      rejectUnchanged(done, f.holder, { type: 'semutaPass', event });
      rejectUnchanged(done, f.holder, { type: 'semutaSelect', event, card: f.card });
      rejectUnchanged(done, f.target, { type: 'battlePreparationReady', event: `${f.event}-stale` });
      const ready = applyAction(done, f.target, { type: 'battlePreparationReady', event: f.event });
      assert.deepEqual(ready.battle?.preLeader?.ready, [f.target]);
      assert.deepEqual(resources(ready), resources(done));
      finishOnce(f, ready, victim);
    });

  void test(`${label}: full-hand entitlement is private and absent-holder pass changes no death or resource`, () => {
    const f = createSemutaHomeworldResidualPoisonFixture(advanced, true);
    const absent = withoutSemutaHomeworldChoamMovementHolder(f.game, f.holder);
    const pending = disposeSemutaHomeworldResidualPoison(f);
    const neutral = disposeSemutaHomeworldResidualPoison(f, absent);
    assert.equal(viewGame(pending, f.holder).semutaReaction?.canCommit, true);
    assert.equal(viewGame(neutral, f.holder).semutaReaction?.canCommit, false);
    for (const seat of pending.players.filter(p => p.id !== f.holder)) {
      assert.deepEqual(JSON.parse(JSON.stringify(viewGame(f.game, seat.id))),
        JSON.parse(JSON.stringify(viewGame(absent, seat.id))),
        'The conserved private Semuta position is invisible to other seats');
      // Native programs can select different victims. Compare neutral offer
      // entitlement separately from its opaque event.
      const { event: _heldEvent, ...heldOffer } = viewGame(pending, seat.id).semutaReaction!;
      const { event: _absentEvent, ...absentOffer } = viewGame(neutral, seat.id).semutaReaction!;
      assert.equal(heldOffer.canCommit, false);
      assert.deepEqual(heldOffer, absentOffer);
    }
    const victim = assertNativePoison(f, neutral, absent);
    const done = reactSemutaHomeworldChoam(JSON.parse(JSON.stringify(neutral)) as Game, f.holder, false);
    assertExchange(f, neutral, done, false, false);
    finishOnce(f, done, victim);
  });

  void test(`${label}: actual opponent readiness survives the Poison Semuta response`, () => {
    const f = createSemutaHomeworldResidualPoisonFixture(advanced);
    const ready = applyAction(f.game, f.target, { type: 'battlePreparationReady', event: f.event });
    assert.deepEqual(ready.battle?.preLeader?.ready, [f.target]);
    assert.equal(viewGame(ready, f.owner).residualPoison?.blocked, null);
    const pending = disposeSemutaHomeworldResidualPoison(f, ready);
    const victim = assertNativePoison(f, pending, ready);
    assert.ok(pending.pendingTreacheryDiscard);
    assert.ok(viewGame(pending, f.holder).semutaReaction);
    const done = reactSemutaHomeworldChoam(pending, f.holder, false);
    assert.ok(!done.pendingTreacheryDiscard);
    assert.deepEqual(done.battle?.preLeader?.ready, [f.target]);
    finishOnce(f, done, victim);
  });

  for (const difficulty of DIFFICULTIES) void test(`${difficulty}: legal minimum ${label} consumer and original future plans`, () => {
    const f = createSemutaHomeworldResidualPoisonFixture(advanced);
    const pending = disposeSemutaHomeworldResidualPoison(f);
    const victim = assertNativePoison(f, pending);
    let game = pending;
    const own = viewGame(game, f.holder);
    own.players.find(p => p.id === f.holder)!.bot = difficulty;
    const action = botActions(own)[0];
    assert.ok(action && (action.type === 'semutaCommit' || action.type === 'semutaPass'));
    game = applyAction(game, f.holder, action);
    for (const seat of pending.players) {
      if (!game.pendingTreacheryDiscard) break;
      const view = viewGame(game, seat.id);
      if (!view.semutaReaction || view.semutaReaction.passed) continue;
      view.players.find(p => p.id === seat.id)!.bot = difficulty;
      const pass = botActions(view)[0];
      assert.equal(pass?.type, 'semutaPass');
      game = applyAction(game, seat.id, pass);
    }
    assertExchange(f, pending, game, action.type === 'semutaCommit');
    finishOnce(f, game, victim);
  });
}
