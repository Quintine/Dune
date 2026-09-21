import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, initializeBaseGameForAudit, type Action, type Game } from '../game/engine';
import { unitStore } from './fixture-nexus-room-store';
import { sampleInventory, verifySampleCustody } from '../tools/sample-custody';

const clock = { now: () => 30000, sleep: async () => {} };
const player = (game: Game, id: string) => game.players.find(p => p.id === id)!;

void test('authenticated forced exchange races once and restores the same owner-only inspection without redrawing cards', async t => {
  const f = unitStore();
  try {
    const made = await f.rooms.createRoom('Harkonnen inspection', 'harkonnen', true, []);
    const code = made.view.code;
    const joined = [await f.rooms.joinRoom(code, 'Exchange target', 'guild'), await f.rooms.joinRoom(code, 'Observer', 'emperor')];
    const auths = await Promise.all([made.token!, ...joined.map(p => p.token!)].map(token => f.restart().authenticate(code, token)));
    const act = async (index: number, action: Action) => {
      const before = await f.restart().readRoom(code);
      await f.restart().act(code, auths[index], before.version, action, clock);
      return f.restart().readRoom(code);
    };
    for (let i = 0; i < auths.length; i++) await act(i, { type: 'ready' });
    let game = await f.restart().readRoom(code);
    const seedVersion = game.version;
    // The audit seam runs genuine Advanced setup; no public start gate is changed.
    game = initializeBaseGameForAudit(game);
    game.version = seedVersion + 1;
    assert.equal(f.sqlite.prepare('UPDATE rooms SET state=?,version=? WHERE code=? AND version=?')
      .run(JSON.stringify(game), game.version, code, seedVersion).changes, 1);
    for (let i = 0; i < auths.length; i++) {
      const choices = player(game, auths[i].playerId).traitorChoices;
      if (choices.length) game = await act(i, { type: 'traitor', leader: choices[0] });
    }
    assert.equal(game.status, 'playing');
    const inventory = sampleInventory(game), seats = f.sqlite.prepare('SELECT * FROM seats').all();
    const owner = auths[0].playerId, target = auths[1].playerId;
    for (const p of game.players) { game.deck.push(...p.hand); p.hand = []; }
    const give = (id: string, effect: string) => {
      const at = game.deck.findIndex(card => card.effect === effect || card.kind === effect); assert.ok(at >= 0);
      const card = game.deck.splice(at, 1)[0]; player(game, id).hand.push(card); return card.id;
    };
    const karama = give(owner, 'karama');
    give(target, 'shield'); give(target, 'snooper'); give(target, 'projectile'); give(target, 'poison');
    Object.assign(game, {
      phase: 3, phaseOpening: null, active: target, ready: [], response: null, decision: null,
      auction: { cards: game.deck.splice(0, 1), index: 0, bid: 0, bidder: null, active: target, passed: [], opener: 0 },
    });
    verifySampleCustody(game, inventory);
    const stagedVersion = game.version; game.version++;
    assert.equal(f.sqlite.prepare('UPDATE rooms SET state=?,version=? WHERE code=? AND version=?')
      .run(JSON.stringify(game), game.version, code, stagedVersion).changes, 1);
    const targetCards = structuredClone(player(game, target).hand), parentAuction = structuredClone(game.auction);
    const version = game.version;
    const action: Action = { type: 'card', card: karama, mode: 'special', target, amount: 4 };
    const before = f.sqlite.prepare('SELECT state,version FROM rooms').all();
    await assert.rejects(f.restart().act(code, auths[2], version, action, clock));
    assert.deepEqual(f.sqlite.prepare('SELECT state,version FROM rooms').all(), before);
    let arrivals = 0; let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    f.hooks.beforeWrite = async () => { if (++arrivals === 2) release(); await barrier; };
    const results = await Promise.allSettled([
      f.rooms.act(code, auths[0], version, action, clock),
      f.restart().act(code, auths[0], version, action, clock),
    ]);
    delete f.hooks.beforeWrite;
    assert.equal(arrivals, 2);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected').length, 1);
    game = await f.restart().readRoom(code);
    assert.equal(game.version, version + 1);
    assert.equal(game.decision, null); assert.equal(game.pendingExchange, null);
    assert.equal(player(game, owner).hand.length, 0);
    assert.equal(player(game, owner).specialKaramaUsed, true);
    assert.equal(game.discard.filter(card => card.id === karama).length, 1);
    assert.deepEqual(player(game, target).hand.map(card => card.id).sort(), targetCards.map(card => card.id).sort());
    assert.deepEqual(game.auction, parentAuction);
    const inspection = structuredClone(game.harkonnenExchangeInspection);
    assert.ok(inspection); assert.equal(inspection.kind, 'draw'); assert.equal(inspection.owner, owner);
    const { signature, ...visibleInspection } = inspection;
    assert.equal(typeof signature, 'string'); assert.ok(signature.length);
    assert.deepEqual(inspection.cards.map(card => card.id).sort(), targetCards.map(card => card.id).sort());
    const committed = f.sqlite.prepare('SELECT state,version FROM rooms').all();
    for (let i = 0; i < auths.length; i++) {
      const view = await f.restart().readSeatView(code, auths[i]);
      assert.deepEqual(view.harkonnenExchangeInspection, i === 0 ? visibleInspection : null);
      if (view.harkonnenExchangeInspection) assert.equal('signature' in view.harkonnenExchangeInspection, false);
      assert.equal('pendingExchange' in view, false);
      for (const other of view.players.filter(p => p.id !== auths[i].playerId)) assert.equal(other.hand, undefined);
    }
    await assert.rejects(f.restart().act(code, auths[0], version, action, clock));
    await assert.rejects(f.restart().act(code, auths[0], game.version, { type: 'decision', returnCards: inspection.cards.map(card => card.id) }, clock));
    assert.deepEqual(f.sqlite.prepare('SELECT state,version FROM rooms').all(), committed);
    assert.deepEqual(f.sqlite.prepare('SELECT * FROM seats').all(), seats);
    verifySampleCustody(game, inventory);

    // Independent legacy scenario in the same disposable store: a real exchange
    // loses its extra choice before a worker restart, predating inspection records.
    let legacy = JSON.parse(before[0].state as string) as Game;
    const extra = legacy.deck.shift()!;
    player(legacy, owner).hand.push(extra);
    legacy = applyAction(legacy, owner, action);
    assert.equal(legacy.decision?.kind, 'handExchange');
    assert.equal(f.rooms.needsAutomaticRoomRecovery(legacy), true);
    legacy.version = game.version + 1;
    assert.equal(f.sqlite.prepare('UPDATE rooms SET state=?,version=? WHERE code=? AND version=?')
      .run(JSON.stringify(legacy), legacy.version, code, game.version).changes, 1);
    const optional = f.sqlite.prepare('SELECT state,version FROM rooms').all();
    await f.restart().continueRoomAutomatic(code, clock);
    assert.deepEqual(f.sqlite.prepare('SELECT state,version FROM rooms').all(), optional,
      'A genuine return choice remains waiting without a write.');
    player(legacy, owner).hand = player(legacy, owner).hand.filter(card => card.id !== extra.id);
    legacy.deck.push(extra);
    delete legacy.harkonnenExchangeInspection;
    const legacyCards = structuredClone(player(legacy, owner).hand);
    const optionalVersion = legacy.version; legacy.version++;
    assert.equal(f.sqlite.prepare('UPDATE rooms SET state=?,version=? WHERE code=? AND version=?')
      .run(JSON.stringify(legacy), legacy.version, code, optionalVersion).changes, 1);
    const noDraw = t.mock.method(globalThis.crypto, 'getRandomValues', () => { throw new Error('Legacy recovery must not draw again.'); });
    arrivals = 0;
    const recoveryBarrier = new Promise<void>(resolve => { release = resolve; });
    f.hooks.beforeWrite = async () => { if (++arrivals === 2) release(); await recoveryBarrier; };
    await Promise.all([f.rooms.continueRoomAutomatic(code, clock), f.restart().continueRoomAutomatic(code, clock)]);
    delete f.hooks.beforeWrite; noDraw.mock.restore();
    assert.equal(arrivals, 2);
    const restored = await f.restart().readRoom(code);
    assert.equal(restored.version, legacy.version + 1);
    assert.equal(restored.decision, null); assert.equal(restored.pendingExchange, null);
    assert.equal(restored.harkonnenExchangeInspection?.kind, 'return');
    assert.deepEqual(restored.harkonnenExchangeInspection?.cards, legacyCards);
    assert.equal(restored.discard.filter(card => card.id === karama).length, 1);
    for (let i = 0; i < auths.length; i++) {
      const view = await f.restart().readSeatView(code, auths[i]);
      if (i === 0) { assert.equal(view.harkonnenExchangeInspection?.kind, 'return'); assert.deepEqual(view.harkonnenExchangeInspection?.cards, legacyCards); }
      else assert.equal(view.harkonnenExchangeInspection, null);
    }
    const recovered = f.sqlite.prepare('SELECT state,version FROM rooms').all();
    await f.restart().continueRoomAutomatic(code, clock);
    assert.deepEqual(f.sqlite.prepare('SELECT state,version FROM rooms').all(), recovered);
    assert.deepEqual(f.sqlite.prepare('SELECT * FROM seats').all(), seats);
    verifySampleCustody(restored, inventory);
  } finally { f.sqlite.close(); }
});
