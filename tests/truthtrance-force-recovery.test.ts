import assert from 'node:assert/strict';
import test from 'node:test';
import type { DatabaseSync } from 'node:sqlite';
import type { Action, Game } from '../game/engine';
import { unitStore } from './fixture-nexus-room-store';
import { sampleInventory, verifySampleCustody } from '../tools/sample-custody';

const clock = { now: () => 29000, sleep: async () => {} };
const rows = (db: DatabaseSync) => db.prepare('SELECT state,version FROM rooms').all();

void test('authenticated force-and-hand fact restores privately and concurrent truthful answers retire one card once', async () => {
  const f = unitStore();
  try {
    const made = await f.rooms.createRoom('Force question', 'atreides', false, []);
    const code = made.view.code;
    const joined = [await f.rooms.joinRoom(code, 'Force target', 'emperor'), await f.rooms.joinRoom(code, 'Observer', 'guild')];
    const auths = await Promise.all([made.token!, ...joined.map(p => p.token!)].map(token => f.restart().authenticate(code, token)));
    const act = async (index: number, action: Action) => {
      const before = await f.restart().readRoom(code);
      await f.restart().act(code, auths[index], before.version, action, clock);
      return f.restart().readRoom(code);
    };
    for (let i = 0; i < auths.length; i++) await act(i, { type: 'ready' });
    let game = await act(0, { type: 'start' });
    for (let i = 0; i < auths.length; i++)
      game = await act(i, { type: 'traitor', leader: game.players.find(p => p.id === auths[i].playerId)!.traitorChoices[0] });
    assert.equal(game.status, 'playing');
    const inventory = sampleInventory(game), seats = f.sqlite.prepare('SELECT * FROM seats').all();
    const asker = auths[0].playerId, target = auths[1].playerId;
    const own = (g: Game, id: string) => g.players.find(p => p.id === id)!;
    // Conserved fixture positions and physical cards, only in disposable SQLite.
    Object.assign(own(game, target), { reserves: 14, tanks: 2, forces: { 'carthag:11': 4 } });
    const give = (id: string, name: string) => {
      const groups = [game.deck, ...game.players.map(p => p.hand)];
      const source = groups.find(cards => cards.some(card => card.name === name))!;
      const card = source.splice(source.findIndex(card => card.name === name), 1)[0];
      own(game, id).hand.push(card); return card.id;
    };
    const truth = give(asker, 'Truthtrance'); give(target, 'Shield');
    verifySampleCustody(game, inventory);
    const oldVersion = game.version; game.version++;
    assert.equal(f.sqlite.prepare('UPDATE rooms SET state=?,version=? WHERE code=? AND version=?')
      .run(JSON.stringify(game), game.version, code, oldVersion).changes, 1);
    const parent = { phase: game.phase, decision: game.decision, response: game.response, stormDials: game.stormDials };
    game = await act(0, { type: 'card', card: truth });
    while (game.truthtrance?.stage === 'priority') {
      const index = auths.findIndex(auth => !game.truthtrance!.passed.includes(auth.playerId));
      assert.ok(index >= 0); game = await act(index, { type: 'truthPass' });
    }
    game = await act(0, { type: 'truthAsk', question: { kind: 'fact', target, fact: {
      kind: 'and', terms: [
        { kind: 'forceCount', zone: { kind: 'reserves' }, counter: 'total', compare: 'eq', value: 14 },
        { kind: 'hand', name: 'Shield' },
      ],
    } } });
    assert.equal((await f.restart().readSeatView(code, auths[1])).truthAnswer, 'yes');
    for (const index of [0, 2]) {
      const view = await f.restart().readSeatView(code, auths[index]);
      assert.equal(view.truthAnswer, null);
      assert.equal(view.players.find(p => p.id === target)!.hand, undefined);
    }
    const persisted = rows(f.sqlite), version = game.version;
    for (const [index, answer] of [[0, 'yes'], [1, 'no'], [1, 'unknown']] as const) {
      await assert.rejects(f.restart().act(code, auths[index], version, { type: 'truthAnswer', answer }, clock));
      assert.deepEqual(rows(f.sqlite), persisted);
    }
    let arrivals = 0; let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    f.hooks.beforeWrite = async () => { if (++arrivals === 2) release(); await barrier; };
    const results = await Promise.allSettled([
      f.rooms.act(code, auths[1], version, { type: 'truthAnswer', answer: 'yes' }, clock),
      f.restart().act(code, auths[1], version, { type: 'truthAnswer', answer: 'yes' }, clock),
    ]);
    delete f.hooks.beforeWrite;
    assert.equal(arrivals, 2); assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.filter(r => r.status === 'rejected').length, 1);
    game = await f.restart().readRoom(code);
    assert.equal(game.version, version + 1); assert.equal(game.truthtrance, null);
    assert.equal(game.truthHistory?.length, 1); assert.equal(game.truthHistory![0].answer, 'yes');
    assert.equal(game.discard.filter(card => card.id === truth).length, 1);
    assert.deepEqual({ phase: game.phase, decision: game.decision, response: game.response, stormDials: game.stormDials }, parent);
    assert.equal(own(game, target).reserves, 14); assert.equal(own(game, target).tanks, 2);
    assert.deepEqual(own(game, target).forces, { 'carthag:11': 4 });
    verifySampleCustody(game, inventory);
    assert.deepEqual(f.sqlite.prepare('SELECT * FROM seats').all(), seats);
    const completed = rows(f.sqlite);
    await assert.rejects(f.restart().act(code, auths[1], version, { type: 'truthAnswer', answer: 'yes' }, clock));
    assert.deepEqual(rows(f.sqlite), completed);
  } finally { f.sqlite.close(); }
});
