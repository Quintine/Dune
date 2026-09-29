import test from 'node:test';
import assert from 'node:assert/strict';
import { startPrototypeRoom } from '../tools/prototype-room';
import { botActions } from '../game/bots';
import { viewGame, type Game, type Action } from '../game/engine';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { unitStore } from './fixture-nexus-room-store';

const clock = { now: () => 10000, sleep: async () => {} };
const seat = (g: Game, id: string) => g.players.find(p => p.id === id)!;
function take(g: Game, identity: string) {
  for (const zone of [g.deck, g.discard, g.richeseCache!, ...g.players.map(p => p.hand)]) {
    const index = zone.findIndex(card => card.id === identity || card.effect === identity);
    if (index >= 0) return zone.splice(index, 1)[0];
  }
  throw new Error('The genuine setup lost a physical card.');
}

void test('authenticated fresh discard survives restart and duplicate Semuta commits transfer one physical card', async () => {
  const f = unitStore();
  try {
    const created = await f.rooms.createRoom('Semuta QA', 'richese', false, ['choam']);
    const code = created.view.code;
    const second = await f.rooms.joinRoom(code, 'Atreides', 'atreides');
    const third = await f.rooms.joinRoom(code, 'Emperor', 'emperor');
    const auths = await Promise.all([created.token!, second.token!, third.token!]
      .map(token => f.restart().authenticate(code, token)));
    const act = async (index: number, action: Action) => {
      const before = await f.restart().readRoom(code);
      await f.restart().act(code, auths[index], before.version, action, clock);
      return f.restart().readRoom(code);
    };
    for (let i = 0; i < auths.length; i++) await act(i, { type: 'ready' });
    let game = await f.restart().readRoom(code);
    startPrototypeRoom(f.sqlite, code, game.version, 'semuta');
    game = await f.restart().readRoom(code);
    for (let step = 0; game.status === 'setup' && step < 80; step++) {
      let moved = false;
      for (let i = 0; i < auths.length; i++) {
        const view = viewGame(game, auths[i].playerId);
        view.players.find(p => p.id === view.me)!.bot = 'Medium';
        const choice = botActions(view)[0];
        if (choice) { game = await act(i, choice); moved = true; break; }
      }
      assert.ok(moved, 'genuine setup must retain a legal choice');
    }
    assert.equal(game.status, 'playing');
    const ids = auths.map(auth => auth.playerId), originalSeats = f.sqlite.prepare('SELECT * FROM seats').all();
    const semuta = take(game, SEMUTA_DRUG_ID), hajr = take(game, 'hajr');
    game.deck.push(...game.players.flatMap(p => p.hand));
    for (const p of game.players) p.hand = [];
    seat(game, ids[0]).hand.push(semuta);
    seat(game, ids[1]).hand.push(hajr);
    Object.assign(game, { turn: 2, phase: 5, active: ids[1], storm: 18, ready: [],
      decision: null, response: null, phaseOpening: null, stormPending: null,
      movementRemaining: [ids[1], ids[0], ids[2]] });
    game.version++;
    assert.equal(f.sqlite.prepare('UPDATE rooms SET state=?,version=? WHERE code=? AND version=?')
      .run(JSON.stringify(game), game.version, code, game.version - 1).changes, 1);
    game = await act(1, { type: 'card', card: hajr.id });
    const event = game.pendingTreacheryDiscard?.batch.event;
    assert.ok(event);
    assert.equal(game.pendingTreacheryDiscard?.reaction?.stage, 'offer');
    const foreign = await f.restart().readSeatView(code, auths[2]);
    const owner = await f.restart().readSeatView(code, auths[0]);
    assert.equal(foreign.semutaReaction?.event, owner.semutaReaction?.event);
    assert.deepEqual(foreign.semutaReaction?.candidates, []);
    assert.deepEqual(owner.semutaReaction?.candidates, []);
    assert.equal(owner.semutaReaction?.canCommit, true);
    await f.restart().continueRoomAutomatic(code, clock);
    assert.equal((await f.restart().readRoom(code)).version, game.version);
    game = await act(1, { type: 'semutaPass', event });
    const version = game.version;
    let arrivals = 0; let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    f.hooks.beforeWrite = async () => { if (++arrivals === 2) release(); await barrier; };
    const results = await Promise.allSettled([
      f.rooms.act(code, auths[0], version, { type: 'semutaCommit', event }, clock),
      f.restart().act(code, auths[0], version, { type: 'semutaCommit', event }, clock),
    ]);
    delete f.hooks.beforeWrite;
    assert.equal(arrivals, 2);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected').length, 1);
    const done = await f.restart().readRoom(code);
    assert.equal(done.version, version + 1);
    assert.equal(done.pendingTreacheryDiscard, null);
    assert.equal(seat(done, ids[0]).hand.filter(card => card.id === hajr.id).length, 1);
    assert.equal(done.discard.filter(card => card.id === semuta.id).length, 1);
    assert.equal(done.discard.some(card => card.id === hajr.id), false);
    assert.equal(done.hajr.filter(id => id === ids[1]).length, 1);
    const cards = [...done.deck, ...done.discard, ...done.richeseCache!, ...done.players.flatMap(p => p.hand)];
    assert.equal(new Set(cards.map(card => card.id)).size, cards.length);
    assert.deepEqual(f.sqlite.prepare('SELECT * FROM seats').all(), originalSeats);
    for (const auth of auths) assert.deepEqual(await f.restart().readSeatView(code, auth), viewGame(done, auth.playerId));
  } finally { f.sqlite.close(); }
});
