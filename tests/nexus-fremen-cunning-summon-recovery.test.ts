import assert from 'node:assert/strict';
import test from 'node:test';
import { type Action, type Game, viewGame } from '../game/engine';
import type { RoomsClock } from '../db/rooms';
import { TERRITORIES } from '../game/board';
import { presenceAt } from '../game/force-presence';
import { nexusInventory, nexusReady, nexusTurnTwo, orderNexusSpice } from './fixture-nexus-cards';
import { unitStore } from './fixture-nexus-room-store';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };

async function fixture() {
  const store = unitStore();
  try {
    const made = await store.rooms.createRoom('Summoned Fremen Cunning SQL', 'fremen', true, []);
    const code = made.view.code;
    const tokens = [made.token];
    for (const faction of ['atreides', 'harkonnen'] as const)
      tokens.push((await store.rooms.joinRoom(code, faction, faction)).token!);
    const auths = await Promise.all(tokens.map(token => store.rooms.authenticate(code, token)));
    const ids = auths.map(auth => auth.playerId) as [string, string, string];
    let g = nexusTurnTwo({ seatIds: ids, advanced: true });
    assert.deepEqual(g.expansions, []);
    assert.equal(g.turn, 2);
    assert.equal(g.phase, 1);
    const cards = g.nexusCards!.cards!;
    const index = cards.deck.indexOf('fremen');
    assert.ok(index >= 0);
    cards.hands[ids[0]] = cards.deck.splice(index, 1)[0];
    const sourceSector = g.storm === 14 ? 15 : 14;
    const source = `wind_pass:${sourceSector}`;
    const fremen = g.players[0];
    assert.ok(fremen.elites && fremen.elites.reserves > 0);
    fremen.reserves -= 3;
    fremen.forces[source] = (fremen.forces[source] ?? 0) + 3;
    fremen.elites.reserves--;
    fremen.elites.forces[source] = (fremen.elites.forces[source] ?? 0) + 1;
    orderNexusSpice(g, ['land', 'land']);
    g = nexusReady(g); // A real first blow is in progress, not an invented Nexus window.
    assert.ok(g.spiceWindow && g.spiceSequence);
    const target = TERRITORIES.find(row => row.type === 'sand' &&
      row.id !== g.spiceWindow!.territory && row.id !== 'wind_pass' &&
      g.players.every(player => presenceAt(player, row.id) === 0));
    assert.ok(target);
    const karamaIndex = g.deck.findIndex(card => card.effect === 'karama');
    assert.ok(karamaIndex >= 0);
    const karama = g.deck.splice(karamaIndex, 1)[0];
    g.players[0].hand.push(karama);
    const cancelIndex = g.deck.findIndex(card => card.effect === 'karama');
    assert.ok(cancelIndex >= 0);
    const counterKarama = g.deck.splice(cancelIndex, 1)[0];
    g.players[1].hand.push(counterKarama);
    nexusInventory(g);
    g.code = code;
    g.version = (await store.rooms.readRoom(code)).version;
    store.sqlite.prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(g), g.version, code);
    store.writes.length = 0;
    async function read() { return store.restart().readRoom(code); }
    async function act(seat: number, action: Action) {
      const current = await read();
      await store.restart().act(code, auths[seat], current.version, action, clock);
      return read();
    }
    async function privateSeats(state: Game) {
      for (const [i, token] of tokens.entries()) {
        const rooms = store.restart();
        const auth = await rooms.authenticate(code, token);
        const view = await rooms.readSeatView(code, auth);
        assert.deepEqual(view, viewGame(state, ids[i]));
        assert.equal(view.nexusCards?.card, i === 0 &&
          state.nexusCards!.cards!.hands[ids[0]] === 'fremen' ? 'fremen' : null);
        for (const rival of view.players.filter(player => player.id !== auth.playerId)) {
          assert.equal(rival.hand, undefined);
          assert.equal(rival.traitors, undefined);
        }
      }
    }
    async function passResponses() {
      for (let i = 0; i < 12; i++) {
        const current = await read();
        if (!current.response) return current;
        const owner = current.players.find(player => !current.response!.passed.includes(player.id));
        assert.ok(owner);
        await act(ids.indexOf(owner.id), { type: 'passResponse' });
      }
      assert.fail('Saved summon response did not settle');
    }
    async function readyEveryone() {
      for (let i = 0; i < ids.length; i++) {
        const state = await read();
        const id = ids.find(seat => !state.ready.includes(seat));
        if (!id) return state;
        await act(ids.indexOf(id), { type: 'ready' });
      }
      return read();
    }
    const parent = await act(1, { type: 'ready' });
    assert.deepEqual(parent.ready, [ids[1]]);
    const summoned = await act(0, {
      type: 'card', mode: 'special', card: karama.id, territory: target.id,
    });
    return { ...store, code, ids, auths, source, target: target.id, karama,
      counterKarama, parent, summoned, read, act, privateSeats, passResponses, readyEveryone };
  } catch (error) {
    store.sqlite.close();
    throw error;
  }
}

function spiceInventory(state: Game) {
  return [...state.spiceDeck, ...state.spiceDiscard.flat()].map(card => JSON.stringify(card)).sort();
}
function eliteInventory(state: Game) {
  return state.players.map(player => player.elites && (
    player.elites.reserves + player.elites.tanks +
    Object.values(player.elites.forces).reduce((sum, count) => sum + count, 0)
  ));
}

void test('audited summoned empty worm: SQL CAS spends one Nexus card, restarts response and resumes the interrupted blow through a typed remote ride', async () => {
  const f = await fixture();
  try {
    const before = f.summoned;
    assert.equal(before.version, f.parent.version + 1);
    assert.equal(before.players[0].specialKaramaUsed, true);
    assert.equal(before.decision?.kind, 'nexusFremenCunningOffer');
    assert.equal(before.summonedWorm?.territory, f.target);
    assert.ok(before.summonedWorm?.event);
    const occurrence = before.nexusFremenCunningOffer!.occurrence;
    assert.equal(occurrence.origin, 'summoned');
    assert.equal(occurrence.parent, before.summonedWorm.event);
    assert.notEqual(occurrence.event, occurrence.parent);
    assert.equal(occurrence.territory, f.target);
    assert.equal(occurrence.turn, 2);
    assert.equal(occurrence.initiallyEmpty, true);
    assert.deepEqual(before.summonedWorm.resume.spiceWindow, f.parent.spiceWindow);
    assert.deepEqual(before.summonedWorm.resume.spiceSequence, f.parent.spiceSequence);
    assert.deepEqual(before.summonedWorm.resume.spiceResolution, f.parent.spiceResolution);
    assert.deepEqual(before.summonedWorm.resume.ready, f.parent.ready);
    assert.equal(before.discard.filter(card => card.id === f.karama.id).length, 1);
    assert.equal(before.players[0].hand.some(card => card.id === f.karama.id), false);
    assert.deepEqual(spiceInventory(before), spiceInventory(f.parent));
    assert.deepEqual(eliteInventory(before), eliteInventory(f.parent));
    await f.privateSeats(before);
    for (const seat of [1, 2]) {
      const view = await f.restart().readSeatView(f.code, f.auths[seat]);
      assert.equal(view.nexusCards?.card, null);
      assert.equal(view.summonedWorm?.territory, f.target);
      assert.equal('resume' in view.summonedWorm!, false);
      assert.equal('event' in view.summonedWorm!, false);
    }
    f.writes.length = 0;
    let arrivals = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    f.hooks.beforeWrite = async () => { if (++arrivals === 2) release(); await gate; };
    let results: PromiseSettledResult<unknown>[];
    try {
      results = await Promise.allSettled([0, 1].map(() =>
        f.restart().act(f.code, f.auths[0], before.version,
          { type: 'decision', event: occurrence.event, accept: true }, clock)
          .catch(error => { release(); throw error; })));
    } finally { delete f.hooks.beforeWrite; }
    assert.equal(arrivals, 2);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.deepEqual(f.writes.map(write => write.changes).sort((a, b) => a - b), [0, 1]);
    let g = await f.read();
    assert.equal(g.version, before.version + 1);
    assert.equal(g.response?.kind, 'nexusFremenCunning');
    assert.equal(g.response?.intent, occurrence.event);
    assert.equal(g.nexusFremenCunningRides?.length, 1);
    assert.equal(g.nexusFremenCunningRides![0].stage, 'pending');
    assert.deepEqual(g.nexusFremenCunningRides![0].occurrence, occurrence);
    assert.equal(g.nexusCards!.cards!.hands[f.ids[0]], null);
    assert.equal(g.nexusCards!.cards!.discard.filter(card => card === 'fremen').length, 1);
    assert.equal(g.players[0].forces[f.source], before.players[0].forces[f.source]);
    assert.equal(g.players[0].elites!.forces[f.source], before.players[0].elites!.forces[f.source]);
    assert.deepEqual(eliteInventory(g), eliteInventory(f.parent));
    nexusInventory(g);
    await f.privateSeats(g);
    const spent = JSON.stringify(g);
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.equal(JSON.stringify(await f.read()), spent);
    await assert.rejects(f.restart().act(f.code, f.auths[0], before.version,
      { type: 'decision', event: occurrence.event, accept: true }, clock), /table changed/i);
    assert.equal(JSON.stringify(await f.read()), spent);

    g = await f.passResponses();
    assert.equal(g.summonedWorm, null);
    assert.equal(g.nexus, true);
    assert.equal(g.nexusFremenCunningRides?.[0].stage, 'queued');
    const targetName = TERRITORIES.find(row => row.id === f.target)!.name;
    assert.equal(g.log.filter(line => line.text === `Shai-Hulud appeared in ${targetName}.`).length, 1);
    assert.deepEqual(g.spiceWindow, f.parent.spiceWindow);
    assert.deepEqual(g.spiceSequence, f.parent.spiceSequence);
    assert.deepEqual(g.spiceDeck, f.parent.spiceDeck);
    assert.deepEqual(g.spiceDiscard, f.parent.spiceDiscard);
    assert.deepEqual(spiceInventory(g), spiceInventory(f.parent));
    assert.deepEqual(g.wormRides, f.parent.wormRides);
    await f.privateSeats(g);
    g = await f.readyEveryone(); // Close the original blow, opening the summoned Nexus.
    assert.equal(g.spiceWindow, null);
    assert.equal(g.nexus, true);
    g = await f.readyEveryone(); // Close that Nexus before the Cunning remote ride.
    assert.equal(g.decision?.kind, 'nexusFremenCunningRide');
    assert.equal(g.nexusFremenCunningRides?.[0].stage, 'select');
    assert.equal(g.spiceDeck.length, f.parent.spiceDeck.length);
    await f.privateSeats(g);
    const reserves = g.players[0].reserves;
    const eliteReserves = g.players[0].elites!.reserves;
    const polar = g.players[0].forces['polar_sink:0'] ?? 0;
    const polarElite = g.players[0].elites!.forces['polar_sink:0'] ?? 0;
    g = await f.act(0, {
      type: 'decision', event: occurrence.event, accept: true, source: 'wind_pass',
      forces: { [f.source]: { normal: 1, elite: 1 } },
      territory: 'polar_sink', sector: 0,
    });
    assert.equal(g.nexusFremenCunningRides?.[0].stage, 'complete');
    assert.equal(g.players[0].forces[f.source], before.players[0].forces[f.source] - 2);
    assert.equal(g.players[0].elites!.forces[f.source] ?? 0, (before.players[0].elites!.forces[f.source] ?? 0) - 1);
    assert.equal(g.players[0].forces['polar_sink:0'], polar + 2);
    assert.equal(g.players[0].elites!.forces['polar_sink:0'], polarElite + 1);
    assert.equal(g.players[0].reserves, reserves);
    assert.equal(g.players[0].elites!.reserves, eliteReserves);
    assert.equal(g.discard.filter(card => card.id === f.karama.id).length, 1);
    assert.equal(g.nexusCards!.cards!.discard.filter(card => card === 'fremen').length, 1);
    assert.deepEqual(spiceInventory(g), spiceInventory(f.parent));
    assert.deepEqual(eliteInventory(g), eliteInventory(f.parent));
    const nextBlow = f.parent.spiceDeck[0];
    assert.ok('territory' in nextBlow);
    assert.equal(g.spiceWindow?.territory, nextBlow.territory);
    nexusInventory(g);
    await f.privateSeats(g);
    const saved = JSON.stringify(g);
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.equal(JSON.stringify(await f.read()), saved);
  } finally { f.sqlite.close(); }
});

void test('canceled summoned Cunning still resolves the physical worm and resumes the saved original blow', async () => {
  const f = await fixture();
  try {
    const occurrence = f.summoned.nexusFremenCunningOffer!.occurrence;
    await f.act(0, { type: 'decision', event: occurrence.event, accept: true });
    const pending = await f.read();
    assert.equal(pending.response?.kind, 'nexusFremenCunning');
    assert.equal(pending.version, f.summoned.version + 1);
    let g = await f.act(1, { type: 'card', card: f.counterKarama.id, mode: 'cancel' });
    assert.equal(g.version, pending.version + 1);
    assert.equal(g.response, null);
    assert.equal(g.summonedWorm, null);
    assert.equal(g.nexusFremenCunningRides?.[0].stage, 'complete');
    assert.equal(g.players[0].forces[f.source], f.parent.players[0].forces[f.source]);
    assert.equal(g.players[0].elites!.forces[f.source], f.parent.players[0].elites!.forces[f.source]);
    assert.deepEqual(g.spiceWindow, f.parent.spiceWindow);
    assert.deepEqual(g.spiceSequence, f.parent.spiceSequence);
    assert.deepEqual(spiceInventory(g), spiceInventory(f.parent));
    assert.deepEqual(eliteInventory(g), eliteInventory(f.parent));
    assert.equal(g.discard.filter(card => card.id === f.karama.id).length, 1);
    assert.equal(g.discard.filter(card => card.id === f.counterKarama.id).length, 1);
    assert.equal(g.nexusCards!.cards!.discard.filter(card => card === 'fremen').length, 1);
    nexusInventory(g);
    await f.privateSeats(g);
    g = await f.readyEveryone();
    assert.equal(g.nexus, true);
    g = await f.readyEveryone();
    assert.notEqual(g.decision?.kind, 'nexusFremenCunningRide');
    assert.equal(g.nexusFremenCunningRides?.[0].stage, 'complete');
    assert.equal(g.players[0].forces[f.source], f.parent.players[0].forces[f.source]);
    assert.deepEqual(spiceInventory(g), spiceInventory(f.parent));
    assert.equal(g.log.filter(line => line.text ===
      `Shai-Hulud appeared in ${TERRITORIES.find(row => row.id === f.target)!.name}.`).length, 1);
    await f.privateSeats(g);
    const saved = JSON.stringify(g);
    await f.restart().continueRoomAutomatic(f.code, clock);
    assert.equal(JSON.stringify(await f.read()), saved);
  } finally { f.sqlite.close(); }
});
