import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction, viewGame, type Game} from '../game/engine';
import {splitLocation, territory} from '../game/board';
import {stormCardDistance} from '../game/storm-cards';
import {createAdvancedSourceFixture, advanceToForecast, advanceToNextStorm, settleAdvancedSourceResponses} from './fixture-advanced-source';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game)) as Game;
function confirmStorm(state: Game): Game {
  let game = state;
  for (const player of state.players) game = applyAction(game, player.id, {type: 'ready'});
  return game;
}
function receiptFaces(game: Game): number[] {
  return game.log.flatMap(entry => {
    const face = stormCardDistance(entry.component);
    return face === null ? [] : [face];
  });
}
function group(game: Game, id: string, where: string[]) {
  const player = game.players.find(p => p.id === id)!;
  const amount = Object.entries(player.forces).filter(([key]) => where.includes(splitLocation(key).territory))
    .reduce((sum, [, n]) => sum + n, 0);
  const elite = Object.entries(player.elites?.forces ?? {}).filter(([key]) => where.includes(splitLocation(key).territory))
    .reduce((sum, [, n]) => sum + n, 0);
  return {amount, elite, tanks: player.tanks, eliteTanks: player.elites?.tanks ?? 0};
}

function custody(game: Game, id: string) {
  const player = game.players.find(p => p.id === id)!;
  return {forces: player.forces, reserves: player.reserves, tanks: player.tanks,
    elites: player.elites ?? null, advisors: player.advisors ?? null,
    noField: player.noField ?? null, hand: player.hand};
}

void test('actual first Advanced storm keeps two native 0..20 wheels and commits once', () => {
  let {game} = createAdvancedSourceFixture();
  assert.equal(game.turn, 1);
  assert.equal(game.stormDialers.length, 2);
  assert.equal(game.stormPending, null);
  const [first, second] = game.stormDialers;
  game = applyAction(game, first, {type: 'stormDial', amount: 20});
  const checkpoint = JSON.stringify(game);
  assert.throws(() => applyAction(game, first, {type: 'stormDial', amount: 0}), /locked/);
  assert.equal(JSON.stringify(game), checkpoint);
  game = applyAction(reload(game), second, {type: 'stormDial', amount: 20});
  assert.equal(game.stormPending, 40);
  assert.equal(game.stormMovementSource?.kind, 'dials');
  game = confirmStorm(game);
  assert.equal(game.phase, 1);
  assert.equal(game.storm, 5);
  assert.equal(game.stormMovementSource, undefined);
  assert.deepEqual(receiptFaces(game), []);
});

void test('every subsequent Advanced opening uses one canonical public card without granting a Fremen forecast', () => {
  let {game} = createAdvancedSourceFixture({storm: 'next'});
  assert.equal(game.turn, 2);
  assert.deepEqual(game.stormDialers, []);
  const face = game.stormPending!;
  assert.ok(face >= 1 && face <= 6);
  assert.equal(game.stormMovementSource?.kind, 'card');
  assert.deepEqual(receiptFaces(game), [face]);
  const before = JSON.stringify(game);
  for (const p of game.players) {
    const view = viewGame(game, p.id);
    assert.equal(view.stormForecast, null);
    assert.equal(view.stormPending, face);
    assert.equal(view.stormRevealed, null);
  }
  assert.equal(JSON.stringify(game), before);
  const first = game.players[0].id;
  assert.throws(() => applyAction(game, first, {type: 'stormDial', amount: 1}), /not dialing/);
  game = applyAction(reload(game), first, {type: 'ready'});
  const savedSource = game.stormMovementSource;
  assert.deepEqual(receiptFaces(game), [face]);
  for (const p of game.players.slice(1)) game = applyAction(game, p.id, {type: 'ready'});
  assert.equal(game.phase, 1);
  assert.equal(game.storm, 1 + face);
  assert.deepEqual(receiptFaces(game), [face]);
  assert.equal(savedSource?.distance, face);
  game = advanceToNextStorm(game);
  assert.equal(game.turn, 3);
  assert.deepEqual(game.stormDialers, []);
  assert.equal(receiptFaces(game).length, 2);
});

void test('native forecast remains private and the held physical face is the next actual reveal, including cancellation', () => {
  for (const cancel of [false, true]) {
    const fixture = createAdvancedSourceFixture({fremen: true, karama: true});
    let game = advanceToForecast(fixture.game);
    const fremen = game.players.find(p => p.faction === 'fremen')!;
    const face = game.stormCard!;
    const counter = game.players.find(p => p.faction !== 'fremen' && p.hand.some(c => c.effect === 'karama'))!;
    assert.ok(counter, 'the native deal supplies a genuine counter even when it will pass');
    const card = counter.hand.find(c => c.effect === 'karama')!;
    assert.equal(game.response?.kind, 'stormPeek');
    assert.ok(viewGame(game, counter.id).responseControls?.cancelCards.includes(card.id));
    const forces = structuredClone(game.players.map(p => ({id: p.id, custody: custody(game, p.id)})));
    assert.equal(viewGame(game, fremen.id).stormForecast, null);
    if (cancel) {
      game = applyAction(game, counter.id, {type: 'card', card: card.id, mode: 'cancel'});
    } else game = settleAdvancedSourceResponses(game);
    for (const before of forces) {
      const after = custody(game, before.id);
      assert.deepEqual({...after, hand: undefined}, {...before.custody, hand: undefined});
    }
    assert.equal(game.players.find(p => p.id === counter.id)!.hand.some(c => c.id === card.id), !cancel);
    assert.equal(game.discard.filter(c => c.id === card.id).length, cancel ? 1 : 0);
    for (const p of game.players)
      assert.equal(viewGame(game, p.id).stormForecast, !cancel && p.id === fremen.id ? face : null);
    assert.equal(game.stormCard, face);
    assert.deepEqual(receiptFaces(game), []);
    game = advanceToNextStorm(reload(game));
    assert.equal(game.stormPending, face);
    assert.deepEqual(receiptFaces(game), [face]);
    assert.equal(game.stormCard, null);
  }
  const automatic = createAdvancedSourceFixture({fremen: true, karama: false});
  let game = advanceToForecast(automatic.game);
  assert.equal(game.response, null, 'a native forecast without an eligible counter resolves automatically');
  assert.ok(game.stormCardKnown);
  const face = game.stormCard!;
  assert.ok(face >= 1 && face <= 6);
  for (const player of game.players) {
    assert.equal(player.hand.some(card => card.effect === 'karama'), false);
    assert.equal(viewGame(game, player.id).stormForecast, player.faction === 'fremen' ? face : null);
  }
  assert.deepEqual(receiptFaces(game), []);
  game = advanceToNextStorm(reload(game));
  assert.equal(game.stormPending, face);
  assert.deepEqual(receiptFaces(game), [face]);
  assert.equal(game.stormCard, null);
});

void test('Basic next-turn wheels retain their native 1..3 bounds and never become the Advanced Deck', () => {
  let {game} = createAdvancedSourceFixture({advanced: false, storm: 'next'});
  assert.equal(game.stormDialers.length, 2);
  assert.equal(game.stormPending, null);
  assert.equal(game.stormCard, null);
  const before = JSON.stringify(game);
  assert.throws(() => applyAction(game, game.stormDialers[0], {type: 'stormDial', amount: 0}), /Storm dial/);
  assert.equal(JSON.stringify(game), before);
  for (const id of game.stormDialers) game = applyAction(game, id, {type: 'stormDial', amount: 3});
  assert.equal(game.stormPending, 6);
  assert.equal(game.stormMovementSource?.kind, 'dials');
  assert.deepEqual(receiptFaces(game), []);
});

void test('corrupt or orphaned card source cannot mutate a saved native pending Storm', () => {
  const original = createAdvancedSourceFixture({storm: 'next'}).game;
  for (const corrupt of [
    (game: Game) => {game.stormMovementSource!.signature = 'foreign';},
    (game: Game) => {delete game.stormMovementSource;},
    (game: Game) => {game.stormPending = game.stormPending === 6 ? 5 : 6;},
    (game: Game) => {game.stormMovementSource!.turn++;},
  ]) {
    const game = reload(original);
    corrupt(game);
    const before = JSON.stringify(game);
    assert.throws(() => viewGame(game, game.players[0].id), /source|storm/i);
    assert.throws(() => applyAction(game, game.players[0].id, {type: 'ready'}), /source|storm/i);
    assert.equal(JSON.stringify(game), before);
  }
});

void test('Advanced ends own exact normal and elite custody now, even with the new ally still to act', () => {
  for (const alliance of ['firstEnding', 'laterEnding'] as const) {
    const fixture = createAdvancedSourceFixture({alliance});
    const {actor, ally, lossTerritories} = fixture;
    let game = fixture.game;
    assert.ok(game.movementRemaining!.includes(ally!));
    assert.equal(game.players.find(p => p.id === actor)!.allySinceTurn, game.turn);
    assert.equal(game.players.find(p => p.id === ally)!.allySinceTurn, game.turn);
    if (alliance === 'laterEnding') assert.ok(game.order.indexOf(actor) > 0);
    const own = group(game, actor, lossTerritories);
    assert.equal(own.amount, 2);
    assert.equal(own.elite, 1);
    const ownCustody = structuredClone(custody(game, actor));
    const other = structuredClone(custody(game, ally!));
    const immutable = JSON.stringify(game);
    assert.deepEqual(viewGame(game, actor).advancedAllySeparation,
      {territories: lossTerritories.map(id => territory(id).name)});
    assert.equal(viewGame(game, ally!).advancedAllySeparation, null);
    assert.equal(JSON.stringify(game), immutable);
    game = applyAction(reload(game), actor, {type: 'endMovement'});
    const after = group(game, actor, lossTerritories);
    assert.deepEqual(after, {amount: 0, elite: 0, tanks: own.tanks + own.amount, eliteTanks: own.eliteTanks + own.elite});
    const endedCustody = custody(game, actor);
    assert.equal(endedCustody.reserves, ownCustody.reserves);
    assert.equal(endedCustody.elites?.reserves, ownCustody.elites?.reserves);
    assert.deepEqual(endedCustody.advisors, ownCustody.advisors);
    assert.deepEqual(endedCustody.noField, ownCustody.noField);
    assert.deepEqual(endedCustody.hand, ownCustody.hand);
    assert.deepEqual(custody(game, ally!), other);
    assert.ok(!game.movementRemaining?.includes(actor));
    const committed = JSON.stringify(game);
    assert.throws(() => applyAction(game, actor, {type: 'endMovement'}), /movement turn/);
    assert.equal(JSON.stringify(game), committed);
  }
});

void test('Basic preserves newly allied overlap and only the later old ally loses its own group', () => {
  const fresh = createAdvancedSourceFixture({advanced: false, alliance: 'newThisTurn'});
  const before = structuredClone(custody(fresh.game, fresh.actor));
  const after = applyAction(fresh.game, fresh.actor, {type: 'endMovement'});
  assert.deepEqual(custody(after, fresh.actor), before);
  assert.equal(viewGame(fresh.game, fresh.actor).advancedAllySeparation, null);
  const old = createAdvancedSourceFixture({advanced: false, alliance: 'laterEnding'});
  assert.equal(old.turn, 3);
  assert.ok(!old.game.movementRemaining?.includes(old.ally!));
  const own = group(old.game, old.actor, old.lossTerritories);
  const ally = structuredClone(custody(old.game, old.ally!));
  const ended = applyAction(old.game, old.actor, {type: 'endMovement'});
  assert.equal(group(ended, old.actor, old.lossTerritories).tanks, own.tanks + own.amount);
  assert.equal(group(ended, old.actor, old.lossTerritories).amount, 0);
  assert.deepEqual(custody(ended, old.ally!), ally);
});

void test('native advisor stance exempts both directions; Ecaz and Polar custody also survives end', () => {
  for (const alliance of ['ownAdvisors', 'allyAdvisors', 'ecaz', 'polar'] as const) {
    const fixture = createAdvancedSourceFixture({alliance});
    const {game, actor, ally} = fixture;
    const where = alliance === 'ecaz' ? ['imperial_basin'] : alliance === 'polar' ? ['polar_sink'] : ['arrakeen'];
    const own = group(game, actor, where);
    assert.ok(own.amount > 0);
    assert.ok(group(game, ally!, where).amount > 0);
    assert.equal(viewGame(game, actor).advancedAllySeparation, null);
    const ownCustody = structuredClone(custody(game, actor));
    const other = structuredClone(custody(game, ally!));
    const ended = applyAction(game, actor, {type: 'endMovement'});
    assert.deepEqual(group(ended, actor, where), own);
    assert.deepEqual(custody(ended, actor), ownCustody);
    assert.deepEqual(custody(ended, ally!), other);
  }
});

void test('actual dealt Hajr retires once and the final native end still applies exactly one owned loss', () => {
  const fixture = createAdvancedSourceFixture({alliance: 'firstEnding', hajr: true});
  let game = fixture.game;
  const actor = fixture.actor;
  const card = game.players.find(p => p.id === actor)!.hand.find(c => c.effect === 'hajr')!;
  const own = group(game, actor, fixture.lossTerritories);
  game = applyAction(game, actor, {type: 'card', card: card.id});
  assert.deepEqual(group(game, actor, fixture.lossTerritories), own);
  assert.equal(game.discard.filter(c => c.id === card.id).length, 1);
  assert.ok(game.hajr.includes(actor));
  game = applyAction(reload(game), actor, {type: 'endMovement'});
  assert.equal(group(game, actor, fixture.lossTerritories).tanks, own.tanks + own.amount);
  assert.equal(game.discard.filter(c => c.id === card.id).length, 1);
});
