import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, normalizeAutomaticGame, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { MoritaniRetention } from '../components/moritani-retention';
import { nexusTraitorFixture, nexusTraitorInventory } from './fixture-nexus-traitors';
import { unitStore } from './fixture-nexus-room-store';
import type { RoomsClock } from '../db/rooms';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game)) as Game;
const seat = (game: Game, id: string) => game.players.find(player => player.id === id)!;

function battle(holdCard: boolean, advanced = false, playedCard = true,
  ids: [string, string, string] = ['p', 'q', 'r'], choamWinner = false) {
  const [winnerId, loserId, observerId] = ids;
  let game = nexusTraitorFixture({ ownerFaction: 'harkonnen', phase: 6, seatIds: ids, advanced });
  const cards = game.nexusCards!.cards!;
  if (holdCard) {
    const index = cards.deck.indexOf('moritani');
    assert.ok(index >= 0);
    const previous = cards.hands[loserId];
    if (previous) cards.deck[index] = previous;
    else cards.deck.splice(index, 1);
    cards.hands[loserId] = 'moritani';
  }
  if (choamWinner) {
    const index = cards.deck.indexOf('choam');
    assert.ok(index >= 0);
    cards.deck[index] = cards.hands[winnerId]!;
    cards.hands[winnerId] = 'choam';
  }
  Object.assign(game, { active: winnerId, order: ids, phase: 6, storm: 18 });
  for (const player of game.players) {
    player.forces = player.id === observerId ? {} : { 'arrakeen:10': 10 };
    player.reserves = player.id === observerId ? 20 : 10;
    player.hand = [];
    player.spice = 20;
  }
  const loser = seat(game, loserId);
  const used = game.deck.splice(game.deck.findIndex(card => card.kind === 'projectile'), 1)[0];
  const unused = game.deck.splice(game.deck.findIndex(card => card.kind === 'worthless'), 1)[0];
  loser.hand.push(used, unused);
  nexusTraitorInventory(game);
  game = applyAction(game, winnerId, { type: 'chooseBattle', territory: 'arrakeen', target: loserId });
  for (let i = 0; i < 30; i++) {
    if (game.response) {
      const responder = game.players.find(player => !game.response!.passed.includes(player.id))!;
      game = applyAction(game, responder.id, { type: 'passResponse' });
    } else if (game.battle?.preLeader && !game.battle.preLeader.closed) {
      const responder = [game.battle.attacker, game.battle.defender]
        .find(id => !game.battle!.preLeader!.ready.includes(id))!;
      game = applyAction(game, responder, { type: 'battlePreparationReady', event: game.battle.event });
    } else if (game.battle?.preparation) {
      game = applyAction(game, game.battle.preparation.owner, { type: 'declineBattlePower' });
    } else if (game.decision?.kind === 'fullPlanOffer') {
      game = applyAction(game, game.decision.player, { type: 'decision', decline: true });
    } else break;
  }
  assert.ok(game.battle);
  const best = seat(game, winnerId).leaders.reduce((a, b) => a.strength > b.strength ? a : b);
  const weakest = seat(game, loserId).leaders.reduce((a, b) => a.strength < b.strength ? a : b);
  game = applyAction(game, winnerId, { type: 'battlePlan', leader: best.id, dial: 6, support: advanced ? 6 : 0 });
  game = applyAction(game, loserId, { type: 'battlePlan', leader: weakest.id, dial: 0, support: 0,
    ...(playedCard ? { weapon: used.id } : {}) });
  for (const id of [winnerId, loserId]) game = applyAction(game, id, { type: 'traitorCall', call: false });
  for (let i = 0; i < 40; i++) {
    if (game.response) {
      const responder = game.players.find(player => !game.response!.passed.includes(player.id))!;
      game = applyAction(game, responder.id, { type: 'passResponse' });
    } else if (game.decision?.kind === 'battleCards') {
      game = applyAction(game, game.decision.player, { type: 'decision', discard: [] });
    } else if (game.decision?.kind === 'battleLosses') {
      game = applyAction(game, game.decision.player, { type: 'decision', choice: 0 });
    } else if (game.decision?.kind === 'captureOffer') {
      game = applyAction(game, game.decision.player, { type: 'decision', accept: false });
    } else break;
  }
  assert.equal(game.lastBattleContext?.winner, winnerId);
  if (playedCard) {
    assert.equal(game.decision?.kind, 'moritaniRetention');
    assert.equal(game.moritaniRetention?.source, 'nexus');
  } else {
    assert.equal(game.moritaniRetention ?? null, null);
    assert.equal(game.decision?.kind, 'nexusChoamInspection');
  }
  return { game, used, unused };
}

void test('every losing seat receives the same source-bound window, even without the hidden card', () => {
  for (const holdCard of [false, true]) {
    const { game, used, unused } = battle(holdCard);
    const event = game.lastBattleContext!.event;
    assert.equal(viewGame(game, 'q').nexusMoritaniRetention?.canKeep, holdCard);
    assert.equal(viewGame(game, 'p').nexusMoritaniRetention, null);
    assert.equal(viewGame(game, 'r').nexusMoritaniRetention, null);
    const before = reload(game);
    assert.throws(() => applyAction(game, 'p', { type: 'decision', event, keep: used.id }));
    assert.throws(() => applyAction(game, 'q', { type: 'decision', event: 'stale', keep: null }));
    assert.throws(() => applyAction(game, 'q', { type: 'decision', event, keep: unused.id }));
    if (!holdCard) assert.throws(() => applyAction(game, 'q', { type: 'decision', event, keep: used.id }));
    assert.deepEqual(game, before);
    for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
      const view = viewGame(game, 'q');
      view.players.find(player => player.id === 'q')!.bot = difficulty;
      assert.deepEqual(botActions(view)[0], { type: 'decision', event, keep: holdCard ? used.id : null });
    }
    const passed = applyAction(game, 'q', { type: 'decision', event, keep: null });
    assert.equal(passed.discard.filter(card => card.id === used.id).length, 1);
    assert.ok(seat(passed, 'q').hand.some(card => card.id === unused.id));
    assert.equal(passed.nexusCards!.cards!.hands.q, holdCard ? 'moritani' : before.nexusCards!.cards!.hands.q);
    assert.deepEqual(normalizeAutomaticGame(reload(passed)), passed);
    nexusTraitorInventory(passed);
  }
});

void test('a losing holder spends Moritani Nexus to retain one otherwise retainable physical played card', () => {
  for (const advanced of [false, true]) {
    const { game, used, unused } = battle(true, advanced);
    const event = game.lastBattleContext!.event;
    const retained = applyAction(game, 'q', { type: 'decision', event, keep: used.id });
    assert.equal(retained.nexusCards!.cards!.hands.q, null);
    assert.ok(retained.nexusCards!.cards!.discard.includes('moritani'));
    assert.ok(seat(retained, 'q').hand.some(card => card.id === used.id));
    assert.ok(seat(retained, 'q').hand.some(card => card.id === unused.id));
    assert.equal(retained.discard.some(card => card.id === used.id), false);
    assert.equal(retained.lastBattleContext?.nexusMoritaniRetention?.kept, used.id);
    assert.equal(retained.log.filter(entry => entry.text.includes('Moritani Nexus Secret Ally')).length, 1);
    assert.deepEqual(normalizeAutomaticGame(reload(retained)), retained);
    assert.throws(() => applyAction(retained, 'q', { type: 'decision', event, keep: used.id }));
    nexusTraitorInventory(retained);
  }
});

void test('a CHOAM winner cannot inspect the losing card retained with Moritani Nexus', () => {
  const { game, used, unused } = battle(true, false, true, ['p', 'q', 'r'], true);
  const event = game.lastBattleContext!.event;
  const retained = applyAction(game, 'q', { type: 'decision', event, keep: used.id });
  assert.equal(retained.decision?.kind, 'nexusChoamInspection');
  assert.equal(viewGame(retained, 'p').nexusChoamInspection?.canInspect, true);
  const inspected = applyAction(retained, 'p', { type: 'decision', event, inspect: true });
  assert.equal(inspected.nexusChoamInsight?.card.id, unused.id);
  assert.ok(seat(inspected, 'q').hand.some(card => card.id === used.id));
  nexusTraitorInventory(inspected);
});

void test('no publicly eligible played card skips the loser prompt without exposing hidden custody', () => {
  const { game, used } = battle(true, false, false);
  assert.equal(game.lastBattleContext?.nexusMoritaniRetention, undefined);
  assert.equal(viewGame(game, 'q').nexusMoritaniRetention, null);
  const event = game.lastBattleContext!.event;
  assert.throws(() => applyAction(game, 'q', { type: 'decision', event, keep: used.id }));
  const done = applyAction(game, 'p', { type: 'decision', event, inspect: false });
  assert.equal(done.nexusCards!.cards!.hands.q, 'moritani');
  assert.ok(seat(done, 'q').hand.some(card => card.id === used.id));
});

void test('loser controls expose no concealed Nexus eligibility to a rival', () => {
  const { game, used, unused } = battle(true);
  const owner = viewGame(game, 'q');
  const markup = renderToStaticMarkup(createElement(MoritaniRetention, {
    game: owner, busy: false, act() {},
  }));
  assert.match(markup, /Spend Moritani Nexus/);
  assert.match(markup, /Continue without retention/);
  assert.ok(markup.includes(used.name));
  assert.equal(markup.includes(unused.name), false);
  assert.equal(renderToStaticMarkup(createElement(MoritaniRetention, {
    game: viewGame(game, 'p'), busy: false, act() {},
  })), '');
  const without = renderToStaticMarkup(createElement(MoritaniRetention, {
    game: viewGame(battle(false).game, 'q'), busy: false, act() {},
  }));
  assert.equal(without.includes('Spend Moritani Nexus · retain selected card'), true);
  assert.match(without, /disabled=""/);
});

void test('the losing choice renders a public Homeworld battle name without an Arrakis lookup', () => {
  const { game } = battle(true);
  const view = viewGame(game, 'q');
  assert.equal(view.decision?.kind, 'moritaniRetention');
  if (view.decision?.kind !== 'moritaniRetention') return;
  view.decision.territory = 'homeworld:atreides';
  view.combatLocations.push({ id: 'homeworld:atreides', name: 'Caladan', kind: 'homeworld' });
  const markup = renderToStaticMarkup(createElement(MoritaniRetention, {
    game: view, busy: false, act() {},
  }));
  assert.match(markup, /You lost the battle in Caladan/);
  assert.match(markup, /Spend Moritani Nexus/);
});

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };
void test('competing saved loser choices commit one physical spend and restore each private seat', async () => {
  const store = unitStore();
  try {
    const made = await store.rooms.createRoom('Moritani Nexus retention SQL', 'harkonnen', false, []);
    const code = made.view.code;
    const tokens = [made.token];
    for (const faction of ['guild', 'fremen'] as const)
      tokens.push((await store.rooms.joinRoom(code, faction, faction)).token!);
    const auths = await Promise.all(tokens.map(token => store.rooms.authenticate(code, token)));
    const ids = auths.map(auth => auth.playerId) as [string, string, string];
    const { game, used } = battle(true, false, true, ids);
    game.code = code;
    game.version = (await store.rooms.readRoom(code)).version;
    store.sqlite.prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(game), game.version, code);
    const seats = store.sqlite.prepare('SELECT * FROM seats ORDER BY player_id').all();
    const action = { type: 'decision', event: game.lastBattleContext!.event, keep: used.id };
    let arrivals = 0, release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    store.hooks.beforeWrite = async () => { if (++arrivals === 2) release(); await gate; };
    const timer = setTimeout(release, 2000);
    let results: PromiseSettledResult<unknown>[];
    try {
      results = await Promise.allSettled([
        store.restart().act(code, auths[1], game.version, action, clock),
        store.restart().act(code, auths[1], game.version, action, clock),
      ]);
    } finally { clearTimeout(timer); delete store.hooks.beforeWrite; }
    assert.equal(arrivals, 2);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const done = await store.restart().readRoom(code);
    assert.equal(done.version, game.version + 1);
    assert.equal(done.nexusCards!.cards!.hands[ids[1]], null);
    assert.equal(done.nexusCards!.cards!.discard.filter(card => card === 'moritani').length, 1);
    assert.ok(seat(done, ids[1]).hand.some(card => card.id === used.id));
    assert.equal(done.log.filter(entry => entry.text.includes('Moritani Nexus Secret Ally')).length, 1);
    const settled = JSON.stringify(done);
    await assert.rejects(store.restart().act(code, auths[1], done.version, action, clock));
    assert.equal(JSON.stringify(await store.restart().readRoom(code)), settled);
    for (const [index, token] of tokens.entries()) {
      const auth = await store.restart().authenticate(code, token);
      assert.deepEqual(await store.restart().readSeatView(code, auth), viewGame(done, ids[index]));
      assert.equal((await store.restart().readSeatView(code, auth)).nexusMoritaniRetention, null);
    }
    assert.deepEqual(store.sqlite.prepare('SELECT * FROM seats ORDER BY player_id').all(), seats);
    nexusTraitorInventory(done);
  } finally { store.sqlite.close(); }
});
