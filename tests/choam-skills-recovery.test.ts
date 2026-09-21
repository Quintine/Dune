import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import type { DatabaseSync } from 'node:sqlite';
import type { Action } from '../game/engine';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { startPrototypeRoom } from '../tools/prototype-room';
import { unitStore } from './fixture-nexus-room-store';
import { assertChoamSkillsCustody as custody } from './choam-skills-fixture';
import { stagedMarketGhola } from './choam-skills-ghola-fixture';

void test('authenticated CHOAM setup and market-Ghola replacement commit once across concurrent restarted writes', async () => {
  const f = unitStore(), db: DatabaseSync = f.sqlite;
  const clock = { now: () => 10000, sleep: async () => {} };
  try {
    const created = await f.rooms.createRoom('CHOAM', 'choam', false, ['choam']);
    const code = created.view.code;
    const others = [await f.rooms.joinRoom(code, 'Atreides', 'atreides'), await f.rooms.joinRoom(code, 'Emperor', 'emperor')];
    const auths = await Promise.all([created.token!, ...others.map(p => p.token!)].map(token => f.restart().authenticate(code, token)));
    const act = async (index: number, action: Action) => {
      const before = await f.restart().readRoom(code);
      await f.restart().act(code, auths[index], before.version, action, clock);
      return f.restart().readRoom(code);
    };
    const concurrent = async (action: Action) => {
      const before = await f.restart().readRoom(code);
      let arrivals = 0; let release!: () => void;
      const barrier = new Promise<void>(resolve => { release = resolve; });
      f.hooks.beforeWrite = async () => { if (++arrivals === 2) release(); await barrier; };
      const results = await Promise.allSettled([
        f.rooms.act(code, auths[0], before.version, action, clock),
        f.restart().act(code, auths[0], before.version, action, clock),
      ]);
      delete f.hooks.beforeWrite;
      assert.equal(arrivals, 2);
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal(results.filter(r => r.status === 'rejected').length, 1);
      const after = await f.restart().readRoom(code);
      assert.equal(after.version, before.version + 1);
      custody(after);
      return after;
    };
    for (let i = 0; i < auths.length; i++) await act(i, { type: 'ready' });
    const ready = await f.restart().readRoom(code), seats = db.prepare('SELECT * FROM seats').all();
    let cursor = LEADER_SKILL_CARDS.length - 1;
    const target = LEADER_SKILL_CARDS.findIndex(c => c.id === 'warmaster');
    mock.method(crypto, 'getRandomValues', (array: Uint32Array) => {
      array[0] = cursor-- === target ? 0 : 0xffffffff; return array;
    });
    try { startPrototypeRoom(db, code, ready.version, 'leader-skills'); }
    finally { mock.restoreAll(); }
    let game = await f.restart().readRoom(code);
    const own = auths[0].playerId, offer = game.leaderSkills!.offers[own];
    assert.ok(offer.cards.includes('warmaster')); custody(game);
    game = await concurrent({ type: 'leaderSkill', event: offer.event, skill: 'warmaster', leader: 'choam-0' });
    for (const i of [1, 2]) {
      const p = game.players.find(p => p.id === auths[i].playerId)!, next = game.leaderSkills!.offers[p.id];
      game = await act(i, { type: 'leaderSkill', event: next.event, skill: next.cards[0], leader: p.leaders[0].id });
    }
    for (let i = 0; i < auths.length; i++)
      game = await act(i, { type: 'traitor', leader: game.players.find(p => p.id === auths[i].playerId)!.traitorChoices[0] });
    assert.equal(game.status, 'playing'); custody(game);

    // Preserve authenticated seats; only this disposable fixture's game is staged.
    const prepared = stagedMarketGhola(game), originalResponse = structuredClone(prepared.game.response);
    prepared.game.version = game.version + 1;
    assert.equal(db.prepare('UPDATE rooms SET state=?,version=? WHERE code=? AND version=?')
      .run(JSON.stringify(prepared.game), prepared.game.version, code, game.version).changes, 1);
    const money = prepared.game.players.find(p => p.id === own)!.spice;
    game = await act(0, { type: 'card', card: prepared.ghola, leader: prepared.leader });
    assert.equal(game.response, null); assert.equal(game.decision?.kind, 'leaderSkillRevival');
    const revival = game.leaderSkills!.offers[own];
    assert.deepEqual(revival.cards, []);
    for (const i of [1, 2]) {
      const view = await f.restart().readSeatView(code, auths[i]);
      assert.equal(view.leaderSkills!.offer, null);
      assert.equal('pendingChoamMarketGhola' in view, false);
    }
    game = await act(0, { type: 'leaderSkill', event: revival.event, mode: 'draw' });
    const drawn = game.leaderSkills!.offers[own].cards;
    assert.equal(drawn.length, 2); assert.equal(game.response, null);
    assert.equal((await f.restart().readSeatView(code, auths[1])).leaderSkills!.offer, null);
    game = await concurrent({ type: 'leaderSkill', event: revival.event, skill: drawn[0], leader: prepared.leader });
    assert.deepEqual(game.response, originalResponse);
    assert.equal(game.pendingChoamMarketGhola, null);
    assert.equal(game.leaderSkills!.assignments.filter(a => a.owner === own).length, 1);
    assert.equal(game.discard.filter(c => c.id === prepared.ghola).length, 1);
    game = await act(2, { type: 'card', card: prepared.karama, mode: 'cancel' });
    for (let step = 0; game.response && step < 10; step++) {
      const i = auths.findIndex(a => !game.response!.passed.includes(a.playerId));
      assert.ok(i >= 0); game = await act(i, { type: 'passResponse' });
    }
    assert.equal(game.response, null);
    const owner = game.players.find(p => p.id === own)!;
    assert.equal(owner.spice, money);
    assert.ok(owner.hand.some(c => c.id === prepared.sale));
    assert.equal(owner.leaders.find(l => l.id === prepared.leader)!.dead, false);
    assert.equal(game.discard.filter(c => c.id === prepared.ghola).length, 1);
    custody(game);
    assert.deepEqual(db.prepare('SELECT * FROM seats').all(), seats);
  } finally { mock.restoreAll(); db.close(); }
});
