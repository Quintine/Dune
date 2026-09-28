import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, normalizeAutomaticGame, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { richeseCards } from '../game/richese-cards';
import { sampleNexusChoamInspection } from '../game/nexus-choam-inspection';
import { NexusChoamInspectionDecision, NexusChoamInspectionInsight } from '../components/nexus-choam-trade';
import { nexusTraitorFixture, nexusTraitorInventory } from './fixture-nexus-traitors';
import { unitStore } from './fixture-nexus-room-store';
import type { RoomsClock } from '../db/rooms';
import { nexusReady } from './fixture-nexus-cards';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game)) as Game;
const seat = (game: Game, id: string) => game.players.find(player => player.id === id)!;

function battle(holdCard: boolean, ids: [string, string, string] = ['p', 'q', 'r'], advanced = false, secondBattle = true) {
  const [ownerId, opponentId, observerId] = ids;
  let game = nexusTraitorFixture({ ownerFaction: 'harkonnen', phase: 6, seatIds: ids, advanced });
  const cards = game.nexusCards!.cards!;
  if (holdCard) {
    const index = cards.deck.indexOf('choam');
    assert.ok(index >= 0);
    cards.deck[index] = cards.hands[ownerId]!;
    cards.hands[ownerId] = 'choam';
  }
  Object.assign(game, { active: ownerId, order: ids, phase: 6, storm: 18 });
  for (const p of game.players) {
    p.forces = p.id === observerId ? {} : secondBattle
      ? { 'arrakeen:10': 10, 'hagga_basin:12': 1 }
      : { 'arrakeen:10': 10 };
    p.reserves = p.id === observerId ? 20 : secondBattle ? 9 : 10;
    p.hand = [];
    p.spice = 20;
  }
  const opponent = seat(game, opponentId);
  const used = game.deck.splice(game.deck.findIndex(card => card.kind === 'projectile'), 1)[0];
  const unused = game.deck.splice(game.deck.findIndex(card => card.kind === 'worthless'), 1)[0];
  opponent.hand.push(used, unused);
  nexusTraitorInventory(game);
  game = applyAction(game, ownerId, { type: 'chooseBattle', territory: 'arrakeen', target: opponentId });
  for (let i = 0; i < 30; i++) {
    if (game.response) {
      const responder = game.players.find(player => !game.response!.passed.includes(player.id))!;
      game = applyAction(game, responder.id, { type: 'passResponse' });
    } else if (game.battle?.preLeader && !game.battle.preLeader.closed) {
      const responder = [game.battle.attacker, game.battle.defender].find(id => !game.battle!.preLeader!.ready.includes(id))!;
      game = applyAction(game, responder, { type: 'battlePreparationReady', event: game.battle.event });
    } else if (game.battle?.preparation) {
      game = applyAction(game, game.battle.preparation.owner, { type: 'declineBattlePower' });
    } else if (game.decision?.kind === 'fullPlanOffer') {
      game = applyAction(game, game.decision.player, { type: 'decision', decline: true });
    } else break;
  }
  assert.ok(game.battle);
  const best = seat(game, ownerId).leaders.reduce((a, b) => a.strength > b.strength ? a : b);
  const weakest = seat(game, opponentId).leaders.reduce((a, b) => a.strength < b.strength ? a : b);
  game = applyAction(game, ownerId, { type: 'battlePlan', leader: best.id, dial: 6, support: advanced ? 6 : 0 });
  game = applyAction(game, opponentId, { type: 'battlePlan', leader: weakest.id, dial: 0, support: 0, weapon: used.id });
  for (const id of [ownerId, opponentId]) game = applyAction(game, id, { type: 'traitorCall', call: false });
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
  assert.equal(game.lastBattleContext?.winner, ownerId);
  return { game, used, unused };
}

void test('all eligible winners receive the same postbattle window, even without the hidden Nexus card', () => {
  for (const holdCard of [false, true]) {
    const { game } = battle(holdCard);
    assert.equal(game.decision?.kind, 'nexusChoamInspection');
    const event = game.lastBattleContext!.event;
    const winner = viewGame(game, 'p');
    assert.equal(winner.nexusChoamInspection?.canInspect, holdCard);
    assert.equal(viewGame(game, 'q').nexusChoamInspection, null);
    assert.equal(viewGame(game, 'r').nexusChoamInspection, null);
    for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
      const botView = viewGame(game, 'p');
      botView.players.find(p => p.id === 'p')!.bot = difficulty;
      assert.deepEqual(botActions(botView)[0], {
        type: 'decision', event, inspect: holdCard,
      });
    }
    const before = reload(game);
    assert.throws(() => applyAction(game, 'q', { type: 'decision', event, inspect: true }));
    assert.deepEqual(game, before);
    const passed = applyAction(game, 'p', { type: 'decision', event, inspect: false });
    assert.notEqual(passed.decision?.kind, 'nexusChoamInspection');
    assert.equal(passed.nexusCards!.cards!.hands.p, holdCard ? 'choam' : before.nexusCards!.cards!.hands.p);
    assert.deepEqual(normalizeAutomaticGame(reload(passed)), passed);
  }
});

void test('a paid Nullentropy search suspends and restores the winner window without leaking the hidden card', () => {
  const { game } = battle(true);
  assert.equal(game.decision?.kind, 'nexusChoamInspection');
  game.richeseCache ??= richeseCards();
  const index = game.richeseCache.findIndex(card => card.name === 'Nullentropy Box');
  assert.ok(index >= 0);
  const [box] = game.richeseCache.splice(index, 1);
  seat(game, 'p').hand.push(box);
  game.discard.push(...game.deck.splice(0, 3));
  const pending = applyAction(game, 'p', { type: 'card', card: box.id });
  assert.equal(pending.decision?.kind, 'nullentropy');
  assert.equal(pending.pendingNullentropy?.resume.decision?.kind, 'nexusChoamInspection');
  assert.equal(viewGame(pending, 'p').nexusChoamInspection, null);
  const search = viewGame(pending, 'p').nullentropy?.search;
  assert.ok(search && search.cards.length >= 2);
  const restored = applyAction(pending, 'p', {
    type: 'decision', event: search.event, card: search.cards[0].id,
  });
  assert.equal(restored.decision?.kind, 'nexusChoamInspection');
  assert.equal(viewGame(restored, 'p').nexusChoamInspection?.canInspect, true);
  assert.deepEqual(normalizeAutomaticGame(reload(restored)), reload(restored));
});

void test('Advanced victory resolves its own cleanup before the private CHOAM choice', () => {
  const { game, unused } = battle(true, ['p', 'q', 'r'], true);
  assert.equal(game.decision?.kind, 'nexusChoamInspection');
  assert.equal(viewGame(game, 'p').nexusChoamInspection?.canInspect, true);
  const done = applyAction(game, 'p', {
    type: 'decision', event: game.lastBattleContext!.event, inspect: true,
  });
  assert.equal(viewGame(done, 'p').nexusChoamInsight?.card.id, unused.id);
  assert.deepEqual(normalizeAutomaticGame(reload(done)), done);
});

void test('CHOAM Secret Ally inspects one unused physical opposing card once, privately, after victory', () => {
  const { game, used, unused } = battle(true);
  assert.ok(game.decision?.kind === 'nexusChoamInspection');
  const event = game.decision.event;
  const before = reload(game);
  assert.throws(() => applyAction(game, 'p', { type: 'decision', event: 'stale', inspect: true }));
  assert.throws(() => applyAction(game, 'p', { type: 'decision', event, inspect: true, card: unused.id }));
  assert.deepEqual(game, before);
  const done = applyAction(game, 'p', { type: 'decision', event, inspect: true });
  assert.equal(done.nexusCards!.cards!.hands.p, null);
  assert.ok(done.nexusCards!.cards!.discard.includes('choam'));
  assert.equal(done.nexusChoamInsight?.card.id, unused.id);
  assert.notEqual(done.nexusChoamInsight?.card.id, used.id);
  assert.equal(viewGame(done, 'p').nexusChoamInsight?.card.id, unused.id);
  assert.equal(viewGame(done, 'q').nexusChoamInsight, null);
  assert.equal(viewGame(done, 'r').nexusChoamInsight, null);
  assert.equal(done.log.some(entry => entry.text.includes(unused.name)), false);
  const restored = reload(done);
  assert.deepEqual(normalizeAutomaticGame(restored), done);
  assert.throws(() => applyAction(done, 'p', { type: 'decision', event, inspect: true }));
  nexusTraitorInventory(done);
});

void test('an inspected card expires when the next physical battle begins without blocking play', () => {
  const { game } = battle(true);
  assert.ok(game.decision?.kind === 'nexusChoamInspection');
  const resolved = applyAction(game, 'p', {
    type: 'decision', event: game.decision.event, inspect: true,
  });
  assert.equal(resolved.phase, 6);
  const next = applyAction(resolved, 'p', {
    type: 'chooseBattle', territory: 'hagga_basin', target: 'q',
  });
  assert.equal(next.battle?.territory, 'hagga_basin');
  assert.equal(viewGame(next, 'p').nexusChoamInsight, null);
  assert.deepEqual(normalizeAutomaticGame(reload(next)), next);
});

void test('private inspection snapshot retires on the next natural Storm boundary', () => {
  const { game } = battle(true, ['p', 'q', 'r'], false, false);
  assert.ok(game.decision?.kind === 'nexusChoamInspection');
  const done = applyAction(game, 'p', {
    type: 'decision', event: game.decision.event, inspect: true,
  });
  assert.equal(done.phase, 7);
  assert.ok(done.nexusChoamInsight);
  const collectionDone = nexusReady(done);
  assert.equal(collectionDone.phase, 8);
  const next = nexusReady(collectionDone);
  assert.ok(next.turn > done.turn);
  assert.equal(next.nexusChoamInsight, null);
  assert.equal(next.lastBattleContext?.nexusChoamInspection, undefined);
  assert.deepEqual(normalizeAutomaticGame(reload(next)), next);
});

void test('winner controls and snapshot inspector reveal no rival card or concealed Nexus eligibility', () => {
  const { game, unused } = battle(true);
  const owner = viewGame(game, 'p'), opponent = viewGame(game, 'q');
  const controls = renderToStaticMarkup(createElement(NexusChoamInspectionDecision, {
    game: owner, busy: false, act() {},
  }));
  assert.match(controls, /Spend CHOAM Nexus/);
  assert.match(controls, /Continue without inspection/);
  assert.equal(controls.includes(unused.name), false);
  assert.equal(renderToStaticMarkup(createElement(NexusChoamInspectionDecision, {
    game: opponent, busy: false, act() {},
  })), '');
  assert.match(renderToStaticMarkup(createElement(NexusChoamInspectionDecision, {
    game: owner, busy: true, act() {},
  })), /disabled=""/);
  assert.equal(renderToStaticMarkup(createElement(NexusChoamInspectionDecision, {
    game: viewGame(battle(false).game, 'p'), busy: false, act() {},
  })).includes('Spend CHOAM Nexus · inspect one card'), false);

  const event = owner.nexusChoamInspection!.event;
  const done = applyAction(game, 'p', { type: 'decision', event, inspect: true });
  const privateMarkup = renderToStaticMarkup(createElement(NexusChoamInspectionInsight, {
    game: viewGame(done, 'p'),
  }));
  assert.match(privateMarkup, /Your CHOAM Nexus inspection/);
  assert.ok(privateMarkup.includes(unused.name));
  assert.equal(renderToStaticMarkup(createElement(NexusChoamInspectionInsight, {
    game: viewGame(done, 'q'),
  })), '');
});

void test('one-card CHOAM sampler excludes used IDs and selects uniformly among remaining physical cards', () => {
  const { game, used, unused } = battle(true);
  const other = game.deck.find(card => card.id !== used.id && card.id !== unused.id)!;
  const hand = [used, unused, other];
  assert.equal(sampleNexusChoamInspection(hand, [used.id], () => 0).id, unused.id);
  assert.equal(sampleNexusChoamInspection(hand, [used.id], () => 0.999).id, other.id);
  assert.equal(hand.length, 3);
  assert.throws(() => sampleNexusChoamInspection(hand, [used.id], () => 1));
  assert.throws(() => sampleNexusChoamInspection([used], [used.id], () => 0));
});

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };
void test('competing saved victory inspections commit one physical Nexus spend and restore private evidence', async () => {
  const store = unitStore();
  try {
    const made = await store.rooms.createRoom('CHOAM inspection SQL', 'harkonnen', false, []);
    const code = made.view.code;
    const tokens = [made.token];
    for (const faction of ['guild', 'fremen'] as const)
      tokens.push((await store.rooms.joinRoom(code, faction, faction)).token!);
    const auths = await Promise.all(tokens.map(token => store.rooms.authenticate(code, token)));
    const ids = auths.map(auth => auth.playerId) as [string, string, string];
    const { game, unused } = battle(true, ids);
    game.code = code;
    game.version = (await store.rooms.readRoom(code)).version;
    store.sqlite.prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(game), game.version, code);
    const seats = store.sqlite.prepare('SELECT * FROM seats ORDER BY player_id').all();
    const action = { type: 'decision', event: game.lastBattleContext!.event, inspect: true };
    let arrivals = 0, release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    store.hooks.beforeWrite = async () => { if (++arrivals === 2) release(); await gate; };
    const timer = setTimeout(release, 2000);
    let results: PromiseSettledResult<unknown>[];
    try {
      results = await Promise.allSettled([
        store.restart().act(code, auths[0], game.version, action, clock),
        store.restart().act(code, auths[0], game.version, action, clock),
      ]);
    } finally { clearTimeout(timer); delete store.hooks.beforeWrite; }
    assert.equal(arrivals, 2);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const done = await store.restart().readRoom(code);
    assert.equal(done.version, game.version + 1);
    assert.equal(done.nexusCards!.cards!.hands[ids[0]], null);
    assert.equal(done.nexusCards!.cards!.discard.filter(card => card === 'choam').length, 1);
    assert.equal(done.nexusChoamInsight?.card.id, unused.id);
    assert.equal(done.log.filter(entry => entry.automatic?.name === 'CHOAM Nexus inspection').length, 1);
    const settled = JSON.stringify(done);
    await assert.rejects(store.restart().act(code, auths[0], done.version, action, clock));
    assert.equal(JSON.stringify(await store.restart().readRoom(code)), settled);
    for (const [index, token] of tokens.entries()) {
      const auth = await store.restart().authenticate(code, token);
      assert.deepEqual(await store.restart().readSeatView(code, auth), viewGame(done, ids[index]));
      assert.equal((await store.restart().readSeatView(code, auth)).nexusChoamInsight?.card.id,
        index === 0 ? unused.id : undefined);
    }
    assert.deepEqual(store.sqlite.prepare('SELECT * FROM seats ORDER BY player_id').all(), seats);
    nexusTraitorInventory(done);
  } finally { store.sqlite.close(); }
});
