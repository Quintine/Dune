import assert from 'node:assert/strict';
import test from 'node:test';
import type { DatabaseSync } from 'node:sqlite';
import { unitStore } from './fixture-nexus-room-store';
import { startPrototypeRoom } from '../tools/prototype-room';
import { assertTleilaxuSkillsCustody } from './tleilaxu-skills-fixture';
import type { Action } from '../game/engine';

void test('authenticated restart and concurrent Tleilaxu setup choices retain one skill and three private Face Dancers', async () => {
  const f = unitStore();
  const db: DatabaseSync = f.sqlite;
  const clock = { now: () => 10000, sleep: async () => {} };
  try {
    const created = await f.rooms.createRoom('Tleilaxu', 'tleilaxu', false, ['ix']);
    const code = created.view.code;
    const joined = await f.rooms.joinRoom(code, 'Atreides', 'atreides');
    const auths = await Promise.all([created.token!, joined.token!].map(token => f.restart().authenticate(code, token)));
    const act = async (index: number, action: Action) => {
      const before = await f.restart().readRoom(code);
      await f.restart().act(code, auths[index], before.version, action, clock);
      return f.restart().readRoom(code);
    };
    await act(0, { type: 'ready' }); await act(1, { type: 'ready' });
    const ready = await f.restart().readRoom(code);
    const seats = db.prepare('SELECT * FROM seats').all();
    startPrototypeRoom(db, code, ready.version, 'leader-skills');
    const initial = await f.restart().readRoom(code);
    assertTleilaxuSkillsCustody(initial);
    for (const auth of auths) {
      const view = await f.restart().readSeatView(code, auth);
      assert.deepEqual(view.leaderSkills!.offer, initial.leaderSkills!.offers[auth.playerId]);
      assert.equal('offers' in view.leaderSkills!, false);
      assert.equal('deck' in view.leaderSkills!, false);
    }
    const offer = initial.leaderSkills!.offers[auths[0].playerId];
    const choice = { type: 'leaderSkill', event: offer.event, skill: offer.cards[0], leader: 'tleilaxu-0' };
    let arrivals = 0; let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    f.hooks.beforeWrite = async () => { if (++arrivals === 2) release(); await barrier; };
    const results = await Promise.allSettled([
      f.rooms.act(code, auths[0], initial.version, choice, clock),
      f.restart().act(code, auths[0], initial.version, choice, clock),
    ]);
    delete f.hooks.beforeWrite;
    assert.equal(arrivals, 2);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.filter(r => r.status === 'rejected').length, 1);
    let game = await f.restart().readRoom(code);
    assert.equal(game.version, initial.version + 1);
    assert.equal(game.leaderSkills!.assignments.filter(a => a.owner === auths[0].playerId).length, 1);
    assert.equal(game.leaderSkills!.deck.filter(s => s === offer.cards[1]).length, 1);
    const other = game.leaderSkills!.offers[auths[1].playerId];
    game = await act(1, { type: 'leaderSkill', event: other.event, skill: other.cards[0], leader: 'atreides-0' });
    game = await act(1, { type: 'traitor', leader: game.players.find(p => p.id === auths[1].playerId)!.traitorChoices[0] });
    assert.equal(game.status, 'playing');
    assert.equal(game.players.find(p => p.id === auths[0].playerId)!.faceDancers!.length, 3);
    const own = await f.restart().readSeatView(code, auths[0]);
    const otherView = await f.restart().readSeatView(code, auths[1]);
    assert.equal(own.players.find(p => p.id === auths[0].playerId)!.faceDancers!.length, 3);
    assert.equal(otherView.players.find(p => p.id === auths[0].playerId)!.faceDancers, undefined);
    assertTleilaxuSkillsCustody(game);
    assert.deepEqual(db.prepare('SELECT * FROM seats').all(), seats);
    for (const auth of auths) {
      const view = await f.restart().readSeatView(code, auth);
      assert.equal(view.leaderSkills!.assignments.length, 2);
      assert.equal(view.leaderSkills!.offer, null);
    }
  } finally { db.close(); }
});
