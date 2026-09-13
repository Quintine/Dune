import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { viewGame, type Game } from '../game/engine';
import type * as Rooms from '../db/rooms';
import { unitStore } from './fixture-nexus-room-store';
import { mentatQuestionGame } from './mentat-question-fixture';

const clock: Rooms.RoomsClock = { now: () => 57_000, sleep: async () => {} };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
function snapshot(db: DatabaseSync) {
  return { rooms: db.prepare('SELECT * FROM rooms ORDER BY code').all(), seats: db.prepare('SELECT * FROM seats ORDER BY player_id').all() };
}
function resources(game: Game) {
  return { players: game.players, deck: game.deck, discard: game.discard, skills: game.leaderSkills };
}
async function fixture(t: test.TestContext, advanced = false) {
  const store = unitStore();
  t.after(() => store.sqlite.close());
  const game = mentatQuestionGame({advanced});
  game.version = 51;
  const code = game.code;
  store.sqlite.prepare('INSERT INTO rooms(code,state,version,updated_at) VALUES(?,?,?,?)').run(code, JSON.stringify(game), game.version, 56_000);
  const tokens = Object.fromEntries(game.players.map(player => [player.id, hash(`mentat-test:${player.id}`)]));
  const auths: Record<string, Rooms.SeatAuth> = {};
  for (const player of game.players) {
    store.sqlite.prepare('INSERT INTO seats(token_hash,room_code,player_id) VALUES(?,?,?)').run(hash(tokens[player.id]),code,player.id);
    auths[player.id] = await store.rooms.authenticate(code,tokens[player.id]);
  }
  assert.ok(game.decision?.kind === 'mentatQuestion');
  return {...store, code, tokens, auths, initial:game, event:game.decision.event};
}
async function views(f: Awaited<ReturnType<typeof fixture>>, game: Game) {
  const room = f.restart(), before = snapshot(f.sqlite);
  for (const id of ['a','d','o']) {
    const auth = await room.authenticate(f.code,f.tokens[id]);
    const view = await room.readSeatView(f.code,auth);
    assert.deepEqual(view,viewGame(game,id));
    for (const rival of view.players.filter(player => player.id !== id)) {
      assert.equal(rival.hand,undefined);
      assert.equal(rival.traitors,undefined);
    }
    if (id === 'o') {
      assert.deepEqual(view.mentat!.history,[]);
      assert.deepEqual(view.mentat!.pending?.cards ?? [],[]);
      assert.deepEqual(view.mentat!.pending?.weapons ?? [],[]);
    }
  }
  assert.deepEqual(snapshot(f.sqlite),before);
}

void test('saved Mentat naming and mandatory private disclosure restore without moving cards or starting faction powers early', async t => {
  for (const advanced of [false,true]) {
    const f = await fixture(t,advanced), before = snapshot(f.sqlite), held = structuredClone(resources(f.initial));
    const name = {type:'decision',event:f.event,weapon:'Lasgun'};
    await views(f,f.initial);
    await assert.rejects(f.rooms.act(f.code,f.auths.d,51,name,clock));
    await assert.rejects(f.rooms.act(f.code,f.auths.a,50,name,clock),/table changed/);
    await assert.rejects(f.rooms.act(f.code,f.auths.a,51,{...name,event:'old-event'},clock));
    assert.deepEqual(snapshot(f.sqlite),before);
    assert.equal(f.writes.length,0);
    await f.restart().act(f.code,f.auths.a,51,name,clock);
    const pending = await f.restart().readRoom(f.code);
    assert.equal(pending.version,52);
    assert.ok(pending.decision?.kind === 'mentatQuestion' && pending.decision.stage === 'reveal');
    assert.equal(pending.decision.player,'d');
    assert.equal(pending.battle!.preparation,undefined);
    assert.deepEqual(resources(pending),held);
    assert.equal(viewGame(pending,'a').mentat!.history.length,0);
    await views(f,pending);
    const eligible = viewGame(pending,'d').mentat!.pending!.cards;
    assert.equal(eligible.length,2);
    const card = eligible.find(candidate => candidate.name === 'Snooper')!;
    const show = {type:'decision',event:f.event,card:card.id};
    const reserved = snapshot(f.sqlite);
    await assert.rejects(f.rooms.act(f.code,f.auths.a,52,show,clock));
    await assert.rejects(f.rooms.act(f.code,f.auths.d,52,{...show,card:'not-held'},clock));
    assert.deepEqual(snapshot(f.sqlite),reserved);
    await f.restart().act(f.code,f.auths.d,52,show,clock);
    const answered = await f.restart().readRoom(f.code);
    assert.equal(answered.version,53);
    assert.equal(answered.decision?.kind,'leaderSkillVisibility');
    assert.deepEqual(resources(answered),held);
    assert.equal(viewGame(answered,'a').mentat!.history[0].card.id,card.id);
    assert.equal(viewGame(answered,'d').mentat!.history[0].card.id,card.id);
    assert.deepEqual(viewGame(answered,'o').mentat!.history,[]);
    await views(f,answered);
    const saved = snapshot(f.sqlite);
    await assert.rejects(f.rooms.act(f.code,f.auths.d,52,show,clock),/table changed/);
    await assert.rejects(f.rooms.act(f.code,f.auths.d,53,show,clock));
    assert.deepEqual(snapshot(f.sqlite),saved);
    assert.deepEqual(f.writes.map(write => write.changes),[1,1]);
  }
});

void test('competing private fallback submissions commit one historical observation and retain the same physical hand', async t => {
  const f = await fixture(t), held = structuredClone(resources(f.initial));
  await f.rooms.act(f.code,f.auths.a,51,{type:'decision',event:f.event,weapon:'Lasgun'},clock);
  const pending = await f.rooms.readRoom(f.code);
  const cards = viewGame(pending,'d').mentat!.pending!.cards;
  assert.equal(cards.length,2);
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  let arrivals = 0;
  f.hooks.beforeWrite = async () => { if (++arrivals === 2) release(); await wait; };
  const outcomes = await Promise.allSettled(cards.map(card => f.restart().act(f.code,f.auths.d,52,{type:'decision',event:f.event,card:card.id},clock)));
  delete f.hooks.beforeWrite;
  assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length,1);
  assert.equal(outcomes.filter(outcome => outcome.status === 'rejected').length,1);
  assert.deepEqual(f.writes.slice(1).map(write => write.changes).sort((a,b) => a-b),[0,1]);
  const answered = await f.restart().readRoom(f.code);
  assert.equal(answered.version,53);
  assert.deepEqual(resources(answered),held);
  assert.equal(answered.mentatHistory!.length,1);
  assert.equal(answered.mentatHistoryEvents!.length,1);
  assert.ok(cards.some(card => card.id === viewGame(answered,'a').mentat!.history[0].card.id));
  await views(f,answered);
});
