import assert from 'node:assert/strict';
import test from 'node:test';
import type { DatabaseSync } from 'node:sqlite';
import { unitStore } from './fixture-nexus-room-store';
import { startPrototypeRoom } from '../tools/prototype-room';
import type { Action } from '../game/engine';

void test('authenticated concurrent Ixian starting-card choice survives restart into private skill and Traitor setup', async () => {
  const f = unitStore();
  const db: DatabaseSync = f.sqlite;
  const clock = { now: () => 10000, sleep: async () => {} };
  try {
    const created = await f.rooms.createRoom('Ixians', 'ixians', false, ['ix']);
    const code = created.view.code;
    const joined = await f.rooms.joinRoom(code, 'Tleilaxu', 'tleilaxu');
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
    assert.equal(initial.decision?.kind, 'ixSetup');
    assert.equal(initial.ixSetupCards!.length, 2);
    const other = await f.restart().readSeatView(code, auths[1]);
    assert.equal(other.ixTechnology, null);
    const choice = { type: 'decision', card: initial.ixSetupCards![0].id };
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
    assert.equal(game.ixSetupCards, null);
    assert.equal(game.setupStage, 'leaderSkills');
    assert.ok(game.players.every(p => p.hand.length === 1 && p.traitorChoices.length === 0));
    for (const [index, auth] of auths.entries()) {
      const offer = game.leaderSkills!.offers[auth.playerId];
      const own = await f.restart().readSeatView(code, auth);
      assert.deepEqual(own.leaderSkills!.offer, offer);
      assert.equal('offers' in own.leaderSkills!, false);
      assert.equal('deck' in own.leaderSkills!, false);
      const p = game.players.find(p => p.id === auth.playerId)!;
      game = await act(index, { type: 'leaderSkill', event: offer.event, skill: offer.cards[0], leader: p.leaders[0].id });
    }
    assert.equal(game.setupStage, 'traitors');
    const ix = game.players.find(p => p.faction === 'ixians')!;
    game = await act(0, { type: 'traitor', leader: ix.traitorChoices[0] });
    assert.equal(game.status, 'playing');
    assert.equal(game.players.find(p => p.faction === 'tleilaxu')!.faceDancers!.length, 3);
    const skills = [...game.leaderSkills!.deck, ...game.leaderSkills!.assignments.map(a => a.skill)];
    assert.equal(skills.length, 14); assert.equal(new Set(skills).size, 14);
    const cards = [...game.deck, ...game.players.flatMap(p => p.hand)].map(c => c.id);
    assert.equal(cards.length, 47); assert.equal(new Set(cards).size, 47);
    const cyborgs = game.players.find(p => p.faction === 'ixians')!.elites!;
    assert.equal(cyborgs.reserves + cyborgs.tanks + Object.values(cyborgs.forces).reduce((a, b) => a + b, 0), 7);
    assert.deepEqual(db.prepare('SELECT * FROM seats').all(), seats);
  } finally { db.close(); }
});
