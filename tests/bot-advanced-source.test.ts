import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { splitLocation } from '../game/board';
import { advanceToForecast, createAdvancedSourceFixture, settleAdvancedSourceResponses } from './fixture-advanced-source';

void test('all four policies dial the actual first Storm then confirm the recorded result exactly once', () => {
  for (const profile of DIFFICULTIES) {
    const fixture = createAdvancedSourceFixture({ storm: 'first', fremen: false });
    let game = fixture.game;
    for (const dialer of fixture.game.stormDialers) {
      const own = viewGame(game, dialer);
      own.players.find(player => player.id === dialer)!.bot = profile;
      const actions = botActions(own);
      assert.equal(actions[0]?.type, 'stormDial');
      assert.ok(Number.isInteger(actions[0].amount));
      assert.ok(Number(actions[0].amount) >= 0 && Number(actions[0].amount) <= 20);
      game = applyAction(game, dialer, actions[0]);
      const submitted = viewGame(game, dialer);
      submitted.players.find(player => player.id === dialer)!.bot = profile;
      if (game.stormPending === null) assert.deepEqual(botActions(submitted), []);
    }
    assert.notEqual(game.stormPending, null);
    const actor = game.players[0].id;
    const own = viewGame(game, actor);
    own.players.find(player => player.id === actor)!.bot = profile;
    assert.deepEqual(botActions(own), [{ type: 'ready' }]);
    game = applyAction(game, actor, botActions(own)[0]);
    const confirmed = viewGame(game, actor);
    confirmed.players.find(player => player.id === actor)!.bot = profile;
    assert.deepEqual(botActions(confirmed), []);
  }
});

void test('all four policies confirm subsequent Advanced public cards without a Fremen seat or phantom forecast', () => {
  for (const profile of DIFFICULTIES) {
    const fixture = createAdvancedSourceFixture({ storm: 'next', fremen: false });
    let game = fixture.game;
    assert.deepEqual(game.stormDialers, []);
    assert.ok(Number(game.stormPending) >= 1 && Number(game.stormPending) <= 6);
    const distance = game.stormPending;
    for (const player of fixture.game.players) {
      const own = viewGame(game, player.id);
      own.players.find(seat => seat.id === player.id)!.bot = profile;
      assert.equal(own.stormForecast, null);
      assert.deepEqual(botActions(own), [{ type: 'ready' }]);
      game = applyAction(game, player.id, botActions(own)[0]);
    }
    game = settleAdvancedSourceResponses(game);
    assert.notEqual(game.phase, 0);
    assert.equal(game.storm, ((fixture.game.storm - 1 + Number(distance)) % 18) + 1);
    assert.equal(game.stormCard, null);
  }
});

void test('all four policies finish actual later Basic dial protocols without drawing a card', () => {
  for (const profile of DIFFICULTIES) {
    const fixture = createAdvancedSourceFixture({ advanced: false, storm: 'next', fremen: false });
    let game = fixture.game;
    const amounts: number[] = [];
    for (const dialer of fixture.game.stormDialers) {
      const own = viewGame(game, dialer);
      own.players.find(player => player.id === dialer)!.bot = profile;
      const actions = botActions(own);
      assert.equal(actions[0]?.type, 'stormDial');
      const amount = Number(actions[0].amount);
      assert.ok(Number.isInteger(amount) && amount >= 1 && amount <= 3);
      amounts.push(amount);
      game = applyAction(game, dialer, actions[0]);
    }
    assert.equal(game.stormPending, amounts.reduce((sum, amount) => sum + amount, 0));
    assert.equal(game.stormMovementSource?.kind, 'dials');
    assert.equal(game.stormCard, null);
    const own = viewGame(game, game.players[0].id);
    own.players[0].bot = profile;
    assert.deepEqual(botActions(own), [{ type: 'ready' }]);
    game = applyAction(game, own.me, botActions(own)[0]);
    assert.ok(game.ready.includes(own.me));
  }
});

void test('every legal policy retains a real end action when finishing destroys its own allied group', () => {
  for (const profile of DIFFICULTIES) {
    const fixture = createAdvancedSourceFixture({ alliance: 'newThisTurn' });
    const own = viewGame(fixture.game, fixture.actor);
    own.players.find(player => player.id === fixture.actor)!.bot = profile;
    assert.ok(own.advancedAllySeparation?.territories.length);
    const end = botActions(own).find(action => action.type === 'endMovement');
    assert.ok(end, `${profile} must not deadlock on a mandatory consequence`);
    const before = fixture.game.players.find(player => player.id === fixture.actor)!;
    const allyBefore = fixture.game.players.find(player => player.id === fixture.ally)!;
    const losses = Object.entries(before.forces).filter(([key]) => fixture.lossTerritories.includes(splitLocation(key).territory))
      .reduce((sum, [, amount]) => sum + amount, 0);
    const eliteLosses = Object.entries(before.elites?.forces ?? {}).filter(([key]) => fixture.lossTerritories.includes(splitLocation(key).territory))
      .reduce((sum, [, amount]) => sum + amount, 0);
    const result = applyAction(fixture.game, fixture.actor, end);
    const after = result.players.find(player => player.id === fixture.actor)!;
    assert.equal(after.tanks, before.tanks + losses);
    assert.equal(after.elites?.tanks ?? 0, (before.elites?.tanks ?? 0) + eliteLosses);
    assert.equal(after.reserves, before.reserves);
    assert.equal(after.elites?.reserves, before.elites?.reserves);
    assert.deepEqual(after.hand, before.hand);
    for (const id of fixture.lossTerritories) {
      assert.equal(Object.entries(after.forces).filter(([key]) => key.startsWith(`${id}:`)).reduce((sum, [, amount]) => sum + amount, 0), 0);
    }
    assert.deepEqual(result.players.find(player => player.id === fixture.ally)!.forces, allyBefore.forces);
    const allyAfter = result.players.find(player => player.id === fixture.ally)!;
    assert.equal(allyAfter.reserves, allyBefore.reserves);
    assert.equal(allyAfter.tanks, allyBefore.tanks);
    assert.deepEqual(allyAfter.elites, allyBefore.elites);
    assert.deepEqual(allyAfter.advisors, allyBefore.advisors);
    assert.deepEqual(allyAfter.hand, allyBefore.hand);
    assert.notEqual(result.active, fixture.actor);
    assert.equal(viewGame(result, fixture.actor).advancedAllySeparation, null);
  }
});

void test('all four policies can finish with mandatory losses after their actual ordinary movement is exhausted', () => {
  for (const profile of DIFFICULTIES) {
    const fixture = createAdvancedSourceFixture({ alliance: 'newThisTurn' });
    const own = viewGame(fixture.game, fixture.actor);
    const actor = own.players.find(player => player.id === fixture.actor)!;
    actor.bot = profile;
    const move = botActions(own).find(action => action.type === 'move' &&
      typeof action.from === 'string' && fixture.lossTerritories.includes(splitLocation(action.from).territory) &&
      (actor.forces[String(action.from)] ?? 0) > 1);
    assert.ok(move, `${profile} has an actual legal movement from its shared group`);
    const game = settleAdvancedSourceResponses(applyAction(fixture.game, fixture.actor,
      { ...move, amount: 1, elite: 0 }));
    const exhausted = viewGame(game, fixture.actor);
    const afterMove = exhausted.players.find(player => player.id === fixture.actor)!;
    afterMove.bot = profile;
    assert.equal(afterMove.moved, afterMove.movesAllowed);
    assert.ok(exhausted.advancedAllySeparation?.territories.length);
    const end = botActions(exhausted).find(action => action.type === 'endMovement');
    assert.ok(end, `${profile} retains forced legal end instead of an invalid-movement loop`);
    const finished = applyAction(game, fixture.actor, end);
    assert.ok(finished.players.find(player => player.id === fixture.actor)!.tanks > afterMove.tanks);
    assert.notEqual(finished.active, fixture.actor);
  }
});

void test('native higher-priority forecast response cannot fall through to Storm confirmation or movement for any profile', () => {
  for (const profile of DIFFICULTIES) {
    const fixture = createAdvancedSourceFixture({ storm: 'first', fremen: true, karama: true });
    const pending = advanceToForecast(fixture.game);
    assert.equal(pending.response?.kind, 'stormPeek');
    const counter = pending.players.find(player => player.faction !== 'fremen' && player.hand.some(card => card.effect === 'karama'));
    assert.ok(counter, 'the native deal supplies a genuinely eligible forecast counter');
    const card = counter.hand.find(card => card.effect === 'karama')!;
    assert.ok(viewGame(pending, counter.id).responseControls?.cancelCards.includes(card.id));
    const forces = pending.players.map(player => ({id: player.id, forces: player.forces,
      reserves: player.reserves, tanks: player.tanks, elites: player.elites ?? null, advisors: player.advisors ?? null}));
    for (const player of pending.players) {
      const own = viewGame(pending, player.id);
      own.players.find(seat => seat.id === player.id)!.bot = profile;
      assert.equal(own.stormForecast, null);
      for (const action of botActions(own)) {
        assert.ok(action.type === 'passResponse' || (action.type === 'card' && action.mode === 'cancel'));
        const result = applyAction(pending, player.id, action);
        assert.equal(result.phase, pending.phase);
        assert.equal(result.storm, pending.storm);
        assert.deepEqual(result.players.map(player => ({id: player.id, forces: player.forces,
          reserves: player.reserves, tanks: player.tanks, elites: player.elites ?? null, advisors: player.advisors ?? null})), forces);
        for (const seat of result.players) {
          const before = pending.players.find(before => before.id === seat.id)!;
          assert.deepEqual(seat.hand, before.hand.filter(held =>
            !(action.type === 'card' && seat.id === player.id && held.id === action.card)));
        }
        if (action.type === 'card') assert.equal(result.discard.filter(discarded => discarded.id === action.card).length, 1);
        else assert.deepEqual(result.discard, pending.discard);
      }
    }
  }
});
