import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, handLimit, normalizeAutomaticGame, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { reactSemutaHomeworldChoam } from './fixture-semuta-homeworld-choam';
import { splitLocation } from '../game/board';
import { semutaEmperorPlayer as player } from './fixture-semuta-emperor-share';
import { semutaHomeworldChoamMovementResources as resources,
  semutaHomeworldChoamMovementStock as stock,
  withoutSemutaHomeworldChoamMovementHolder } from './fixture-semuta-homeworld-choam-movement';
import { createSemutaHomeworldChoamStormFixture, disposeSemutaHomeworldChoamStorm,
  finishSemutaHomeworldChoamStorm, type SemutaHomeworldChoamStormFixture } from './fixture-semuta-homeworld-choam-storm';

/** Sectors that the fixture's actual Weather dial really traverses this turn. */
function stormCrossedSectors(fixture: SemutaHomeworldChoamStormFixture): number[] {
  return Array.from({ length: fixture.weatherAmount },
    (_, step) => (fixture.beforeWeather.storm + step) % 18 + 1);
}

function assertConservedCounters(game: Game, original: Game) {
  for (const seat of game.players) {
    const before = player(original, seat.id);
    assert.equal(seat.reserves + seat.tanks + Object.values(seat.forces).reduce((sum, amount) => sum + amount, 0),
      before.reserves + before.tanks + Object.values(before.forces).reduce((sum, amount) => sum + amount, 0));
    assert.ok(Object.values(seat.forces).every(amount => amount > 0));
    if (seat.elites && before.elites) {
      assert.equal(seat.elites.reserves + seat.elites.tanks + Object.values(seat.elites.forces).reduce((sum, amount) => sum + amount, 0),
        before.elites.reserves + before.elites.tanks + Object.values(before.elites.forces).reduce((sum, amount) => sum + amount, 0));
      for (const [key, amount] of Object.entries(seat.elites.forces))
        assert.ok(amount >= 0 && amount <= (seat.forces[key] ?? 0));
    }
  }
  assert.deepEqual(game.homeworlds?.custody, original.homeworlds?.custody);
}

for (const advanced of [false, true]) {
  const label = `${advanced ? 'Advanced' : 'Basic'} Homeworld Jubba`;
  for (const claim of [false, true]) void test(`${label}: Semuta ${claim ? 'claim' : 'pass'} protects the genuinely shipped original counter and resumes one Weather storm`, () => {
    const f = createSemutaHomeworldChoamStormFixture(advanced);
    const inventory = stock(f.game), paid = resources(f.game);
    assert.equal(f.afterShipment.turn, 1);
    assert.equal(f.afterShipment.phase, 5);
    assert.equal(player(f.afterShipment, f.owner).spice, player(f.beforeShipment, f.owner).spice - 2);
    assert.equal(player(f.afterShipment, f.owner).reserves, player(f.beforeShipment, f.owner).reserves - 1);
    assert.equal(player(f.afterShipment, f.owner).forces[f.origin], 1);
    assert.equal(player(f.game, f.owner).reserves, player(f.afterShipment, f.owner).reserves);
    assert.equal(f.beforeWeather.turn, 2);
    assert.equal(f.beforeWeather.phase, 0);
    assert.equal(f.beforeWeather.storm, 1);
    assert.notEqual(f.weatherOwner, f.owner);
    assert.equal(player(f.beforeWeather, f.weatherOwner).hand.filter(card => card.id === f.weatherCard).length, 1);
    assert.equal(player(f.afterWeather, f.weatherOwner).hand.some(card => card.id === f.weatherCard), false);
    assert.equal(f.afterWeather.stormPending, f.weatherAmount);
    assert.equal(f.game.stormMovementSource?.kind, 'weather');
    assert.equal(f.game.stormMovementSource?.distance, f.weatherAmount);
    assert.equal(f.game.discard.filter(card => card.id === f.weatherCard).length, 1);
    assert.equal(player(f.game, f.holder).hand.some(card => card.id === SEMUTA_DRUG_ID), true,
      'The ordinary Weather receipt was passed natively, not claimed');
    assert.equal(f.game.decision?.kind, 'choamStorm');
    if (f.game.decision?.kind !== 'choamStorm') throw Error('Missing original Storm protection decision');
    assert.equal(f.game.decision.player, f.owner);
    assert.throws(() => applyAction(f.game, f.weatherOwner, f.action),
      'Another original seat cannot protect itself using CHOAM’s printed card');
    assert.throws(() => applyAction(f.game, f.owner, { ...f.action, territory: 'arrakeen' }),
      'The original foreign Atreides territory is not a CHOAM protection target');
    assert.throws(() => applyAction(f.game, f.owner, { ...f.action, target: f.weatherOwner }),
      'The real CHOAM decision cannot redirect protection to a foreign faction');
    assert.deepEqual(stock(f.game), stock(f.setup));
    assertConservedCounters(f.game, f.setup);

    const declared = applyAction(f.game, f.owner, f.action);
    assert.equal(declared.response?.kind, 'choamWorthless');
    assert.equal(declared.pendingTreacheryDiscard, null, 'Jubba cannot be disposed before original Karama passes');
    assert.equal(player(declared, f.owner).hand.some(card => card.id === f.card), true);
    const offered = disposeSemutaHomeworldChoamStorm(f);
    assert.equal(offered.pendingTreacheryDiscard?.continuation.kind, 'choamJubbaDiscard');
    assert.equal(viewGame(offered, f.holder).semutaReaction?.canCommit, true);
    assert.equal(offered.storm, f.game.storm);
    assert.equal(offered.stormResolution?.distance, f.weatherAmount);
    assert.deepEqual(offered.stormResolution?.choamProtected ?? [], []);
    assert.deepEqual(resources(offered), paid);
    assert.deepEqual(stock(offered), inventory);
    assert.equal(offered.discard.filter(card => card.id === f.card).length, 1);
    assert.equal(player(offered, f.owner).hand.some(card => card.id === f.card), false);
    assert.deepEqual(normalizeAutomaticGame(structuredClone(offered)), offered);
    const event = offered.pendingTreacheryDiscard!.batch.event;
    assert.throws(() => applyAction(offered, f.owner, { type: 'decision', decline: true }));
    assert.throws(() => applyAction(offered, f.owner, f.action));
    assert.throws(() => applyAction(offered, f.holder, { type: 'semutaCommit', event: `${event}:stale` }));

    const resumed = reactSemutaHomeworldChoam(structuredClone(offered), f.holder, claim);
    assert.equal(resumed.pendingTreacheryDiscard, null);
    assert.equal(resumed.stormResolution, null);
    assert.equal(resumed.storm, 7);
    assert.equal(resumed.decision?.kind, 'choamMarket');
    assert.equal(resumed.turn, 2);
    assert.equal(player(resumed, f.owner).forces[f.origin], 1);
    assert.equal(player(resumed, f.owner).tanks, 0);
    assert.deepEqual(resources(resumed).players, paid.players,
      'Protection moves no counter, pays no new cost and does not repeat the shipment');
    const protectedSpice = Object.fromEntries(Object.entries(f.game.spice)
      .filter(([key]) => !stormCrossedSectors(f).includes(splitLocation(key).sector)));
    assert.deepEqual(resumed.spice, protectedSpice,
      'The original storm destroys spice only in the sectors it crosses');
    assert.equal(player(resumed, f.holder).hand.filter(card => card.id === f.card).length, claim ? 1 : 0);
    assert.equal(resumed.discard.filter(card => card.id === f.card).length, claim ? 0 : 1);
    assert.equal(resumed.discard.filter(card => card.id === SEMUTA_DRUG_ID).length, claim ? 1 : 0);
    assert.equal(player(resumed, f.holder).hand.some(card => card.id === SEMUTA_DRUG_ID), !claim);
    assert.equal(resumed.discard.filter(card => card.id === f.weatherCard).length, 1);
    assert.equal(player(resumed, f.owner).hand.filter(card => card.id === f.retainedKulon).length, 1);
    assert.deepEqual(stock(resumed), inventory);
    assertConservedCounters(resumed, f.setup);
    assert.throws(() => applyAction(resumed, f.holder, { type: 'semutaCommit', event }));
    assert.throws(() => applyAction(resumed, f.holder, { type: 'semutaPass', event }));
    assert.throws(() => applyAction(resumed, f.owner, f.action));
    assert.throws(() => applyAction(resumed, f.holder, f.action));
    const completed = finishSemutaHomeworldChoamStorm(resumed);
    assert.equal(completed.turn, 2);
    assert.equal(completed.phase, 1);
    assert.equal(completed.storm, 7);
    assert.equal(player(completed, f.owner).forces[f.origin], 1);
    assert.equal(player(completed, f.owner).reserves, player(f.game, f.owner).reserves);
    assert.equal(player(completed, f.owner).spice, player(f.game, f.owner).spice);
    assert.deepEqual(stock(completed), inventory);
    assertConservedCounters(completed, f.setup);
  });

  void test(`${label}: full-hand singleton exchange keeps entitlement private and rejects replayed receipt controls`, () => {
    const f = createSemutaHomeworldChoamStormFixture(advanced, true);
    assert.equal(player(f.game, f.holder).hand.length, handLimit(player(f.game, f.holder)));
    const offered = disposeSemutaHomeworldChoamStorm(f);
    const absent = withoutSemutaHomeworldChoamMovementHolder(f.game, f.holder);
    const neutral = disposeSemutaHomeworldChoamStorm(f, absent);
    assert.equal(viewGame(offered, f.holder).semutaReaction?.canCommit, true);
    assert.equal(viewGame(neutral, f.holder).semutaReaction?.canCommit, false);
    const event = offered.pendingTreacheryDiscard!.batch.event;
    for (const seat of offered.players.filter(seat => seat.id !== f.holder)) {
      assert.deepEqual(viewGame(offered, seat.id), viewGame(neutral, seat.id));
      assert.equal(viewGame(offered, seat.id).semutaReaction?.canCommit, false);
      assert.throws(() => applyAction(offered, seat.id, { type: 'semutaCommit', event }));
    }
    assert.throws(() => applyAction(offered, 'outside-seat', { type: 'semutaPass', event }));
    const passed = applyAction(offered, f.owner, { type: 'semutaPass', event });
    assert.throws(() => applyAction(passed, f.owner, { type: 'semutaPass', event }));
    assert.equal(passed.storm, 1);
    assert.equal(player(passed, f.owner).forces[f.origin], 1);
    const claimed = reactSemutaHomeworldChoam(offered, f.holder, true);
    assert.equal(player(claimed, f.holder).hand.length, handLimit(player(claimed, f.holder)));
    assert.equal(player(claimed, f.holder).hand.filter(card => card.id === f.card).length, 1);
    assert.equal(player(claimed, f.holder).hand.some(card => card.id === SEMUTA_DRUG_ID), false);
    assert.deepEqual(stock(claimed), stock(f.game));
    assertConservedCounters(claimed, f.setup);
    assert.equal(player(finishSemutaHomeworldChoamStorm(claimed), f.owner).forces[f.origin], 1);
  });

  void test(`${label}: all four minimal bot profiles legally claim or pass and finish the original Weather storm`, () => {
    const f = createSemutaHomeworldChoamStormFixture(advanced);
    const offered = disposeSemutaHomeworldChoamStorm(f);
    for (const difficulty of DIFFICULTIES) {
      let game: Game = structuredClone(offered);
      const own = viewGame(game, f.holder);
      own.players.find(seat => seat.id === f.holder)!.bot = difficulty;
      const action = botActions(own)[0];
      assert.ok(action, `${difficulty} has an entitled receipt action`);
      assert.ok(['semutaCommit', 'semutaPass'].includes(action.type));
      game = applyAction(game, f.holder, action);
      while (game.pendingTreacheryDiscard?.reaction?.stage === 'offer') {
        const pending = game.pendingTreacheryDiscard, reaction = pending.reaction;
        if (reaction?.stage !== 'offer') throw Error('Missing neutral discard offer');
        const actor = game.players.find(seat => !reaction.passed.includes(seat.id))!;
        game = applyAction(game, actor.id, { type: 'semutaPass', event: pending.batch.event });
      }
      assert.equal(game.pendingTreacheryDiscard, null);
      assert.equal(game.storm, 7);
      assert.equal(player(game, f.owner).forces[f.origin], 1);
      assert.equal(player(game, f.holder).hand.some(card => card.id === f.card), action.type === 'semutaCommit');
      assert.deepEqual(resources(game).players, resources(f.game).players);
      const botSpice = Object.fromEntries(Object.entries(f.game.spice)
        .filter(([key]) => !stormCrossedSectors(f).includes(splitLocation(key).sector)));
      assert.deepEqual(game.spice, botSpice);
      assert.deepEqual(stock(game), stock(f.game));
      assertConservedCounters(game, f.setup);
      const completed = finishSemutaHomeworldChoamStorm(game);
      assert.equal(completed.phase, 1);
      assert.equal(player(completed, f.owner).forces[f.origin], 1);
    }
  });

  void test(`${label}: native decline leaves Jubba undisposed and the single unprotected original counter dies once`, () => {
    const f = createSemutaHomeworldChoamStormFixture(advanced);
    const declined = applyAction(f.game, f.owner, { type: 'decision', decline: true });
    assert.equal(declined.pendingTreacheryDiscard, null);
    assert.equal(declined.storm, 7);
    assert.equal(declined.stormResolution, null);
    assert.equal(declined.decision?.kind, 'choamMarket');
    assert.equal(player(declined, f.owner).forces[f.origin] ?? 0, 0);
    assert.equal(player(declined, f.owner).tanks, 1);
    assert.equal(player(declined, f.owner).reserves, player(f.game, f.owner).reserves);
    assert.equal(player(declined, f.owner).spice, player(f.game, f.owner).spice);
    assert.equal(player(declined, f.owner).hand.filter(card => card.id === f.card).length, 1);
    assert.equal(declined.discard.filter(card => card.id === f.card).length, 0);
    assert.equal(player(declined, f.holder).hand.some(card => card.id === SEMUTA_DRUG_ID), true);
    assert.equal(player(declined, f.owner).hand.filter(card => card.id === f.retainedKulon).length, 1);
    assert.deepEqual(stock(declined), stock(f.game));
    assertConservedCounters(declined, f.setup);
    assert.throws(() => applyAction(declined, f.owner, { type: 'decision', decline: true }));
    assert.throws(() => applyAction(declined, f.owner, f.action));
    assert.equal(finishSemutaHomeworldChoamStorm(declined).phase, 1);
  });

  for (const claim of [false, true]) void test(`${label}: real Karama cancellation Semuta ${claim ? 'claim' : 'pass'} decides the physical Karama while Jubba stays and the counter dies unprotected`, () => {
    const f = createSemutaHomeworldChoamStormFixture(advanced);
    const inventory = stock(f.game), paid = resources(f.game);
    const karama = player(f.game, f.canceller).hand.find(card => card.name === 'Karama');
    assert.ok(karama);
    const declared = applyAction(f.game, f.owner, f.action);
    assert.equal(declared.response?.kind, 'choamWorthless');
    const cancelled = applyAction(declared, f.canceller, { type: 'card', mode: 'cancel', card: karama.id });
    assert.equal(cancelled.response, null);
    assert.equal(cancelled.pendingTreacheryDiscard?.continuation.kind, 'karamaChoamWorthlessDiscard');
    assert.equal(cancelled.decision, null);
    assert.equal(cancelled.storm, f.game.storm);
    assert.equal(player(cancelled, f.owner).forces[f.origin], 1);
    assert.equal(player(cancelled, f.owner).tanks, 0);
    assert.equal(player(cancelled, f.owner).hand.filter(card => card.id === f.card).length, 1,
      'A cancelled declaration never disposes the retained Jubba');
    assert.equal(viewGame(cancelled, f.holder).semutaReaction?.canCommit, true);
    const event = cancelled.pendingTreacheryDiscard!.batch.event;
    for (const seat of cancelled.players.filter(seat => seat.id !== f.holder))
      assert.throws(() => applyAction(cancelled, seat.id, { type: 'semutaCommit', event }));
    assert.throws(() => applyAction(cancelled, f.canceller, f.action),
      'Jubba cannot be declared again during the Karama receipt');
    assert.throws(() => applyAction(cancelled, f.canceller, { type: 'decision', decline: true }));
    assert.equal(cancelled.pendingTreacheryDiscard?.reaction?.stage, 'offer');

    const resumed = reactSemutaHomeworldChoam(structuredClone(cancelled), f.holder, claim);
    assert.equal(resumed.pendingTreacheryDiscard, null);
    assert.equal(resumed.decision?.kind, 'choamStorm', 'The safe original protection decision is reoffered');
    assert.equal(player(resumed, f.owner).forces[f.origin], 1);
    assert.equal(player(resumed, f.owner).hand.filter(card => card.id === f.card).length, 1);
    assert.equal(resumed.discard.filter(card => card.id === f.card).length, 0);
    assert.equal(player(resumed, f.holder).hand.filter(card => card.id === karama.id).length, claim ? 1 : 0);
    assert.equal(resumed.discard.filter(card => card.id === karama.id).length, claim ? 0 : 1);
    assert.equal(player(resumed, f.holder).hand.some(card => card.id === SEMUTA_DRUG_ID), !claim);
    assert.equal(resumed.discard.filter(card => card.id === SEMUTA_DRUG_ID).length, claim ? 1 : 0);
    assert.deepEqual(stock(resumed), inventory);
    assert.throws(() => applyAction(resumed, f.holder, { type: 'semutaCommit', event }));

    const resolved = applyAction(resumed, f.owner, { type: 'decision', decline: true });
    assert.equal(resolved.storm, 7);
    assert.equal(resolved.stormResolution, null);
    assert.equal(resolved.decision?.kind, 'choamMarket');
    assert.equal(player(resolved, f.owner).forces[f.origin] ?? 0, 0, 'Only the threatened original counter is lost');
    assert.equal(player(resolved, f.owner).tanks, 1);
    assert.equal(player(resolved, f.owner).reserves, player(f.game, f.owner).reserves);
    assert.equal(player(resolved, f.owner).spice, player(f.game, f.owner).spice);
    assert.equal(player(resolved, f.owner).hand.filter(card => card.id === f.card).length, 1);
    assert.equal(player(resolved, f.owner).hand.filter(card => card.id === f.retainedKulon).length, 1);
    assert.equal(player(resolved, f.holder).hand.filter(card => card.id === karama.id).length, claim ? 1 : 0);
    assert.deepEqual(resources(resolved).players, paid.players.map(seat => seat.id === f.owner
      ? { ...seat, forces: {}, tanks: 1 }
      : seat), 'Only the genuinely threatened original counter becomes a Tank');
    const crossedSpice = Object.fromEntries(Object.entries(f.game.spice)
      .filter(([key]) => !stormCrossedSectors(f).includes(splitLocation(key).sector)));
    assert.deepEqual(resolved.spice, crossedSpice);
    assert.deepEqual(stock(resolved), inventory);
    assertConservedCounters(resolved, f.setup);
    assert.throws(() => applyAction(resolved, f.owner, { type: 'decision', decline: true }));
    assert.throws(() => applyAction(resolved, f.canceller, { type: 'card', mode: 'cancel', card: karama.id }));
    const completed = finishSemutaHomeworldChoamStorm(resolved);
    assert.equal(completed.phase, 1);
    assert.equal(completed.turn, 2);
    assert.equal(player(completed, f.owner).forces[f.origin] ?? 0, 0);
    assert.equal(player(completed, f.owner).tanks, 1);
    assert.deepEqual(stock(completed), inventory);
    assertConservedCounters(completed, f.setup);
  });
}
