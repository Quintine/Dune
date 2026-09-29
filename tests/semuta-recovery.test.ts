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

void test('authenticated clean Semuta producers claim once through restart and room CAS', async () => {
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

    const next = structuredClone(done);
    const usedSemuta = take(next, SEMUTA_DRUG_ID);
    const box = take(next, 'richese-nullentropy-box');
    seat(next, ids[0]).hand.push(usedSemuta);
    seat(next, ids[1]).hand.push(box);
    const older = [next.deck.shift(), next.deck.shift()];
    assert.ok(older[0] && older[1]);
    next.discard.push(older[0], older[1]);
    Object.assign(next, { turn: 3, phase: 4, active: null, ready: [], decision: null,
      response: null, phaseOpening: null, stormPending: null });
    next.version = done.version + 1;
    assert.equal(f.sqlite.prepare('UPDATE rooms SET state=?,version=? WHERE code=? AND version=?')
      .run(JSON.stringify(next), next.version, code, done.version).changes, 1);
    const beforeSpice = seat(next, ids[1]).spice;
    const paid = await act(1, { type: 'card', card: box.id });
    assert.ok(paid.pendingNullentropy);
    const selected = paid.discard[0].id;
    const offered = await act(1, { type: 'decision', event: paid.pendingNullentropy.event, card: selected });
    assert.equal(offered.pendingTreacheryDiscard?.reaction?.stage, 'offer');
    assert.equal((await f.restart().readSeatView(code, auths[0])).semutaReaction?.canCommit, true);
    await f.restart().continueRoomAutomatic(code, clock);
    assert.equal((await f.restart().readRoom(code)).version, offered.version);
    const claimedBox = await act(0, { type: 'semutaCommit', event: offered.pendingTreacheryDiscard!.batch.event });
    assert.equal(claimedBox.pendingTreacheryDiscard, null);
    assert.equal(seat(claimedBox, ids[1]).spice, beforeSpice - 2);
    assert.equal(seat(claimedBox, ids[1]).hand.filter(card => card.id === selected).length, 1);
    assert.equal(seat(claimedBox, ids[0]).hand.filter(card => card.id === box.id).length, 1);
    assert.equal(claimedBox.discard.filter(card => card.id === SEMUTA_DRUG_ID).length, 1);
    assert.equal(claimedBox.discard.some(card => card.id === box.id), false);
    const finalCards = [...claimedBox.deck, ...claimedBox.discard, ...claimedBox.richeseCache!,
      ...claimedBox.players.flatMap(p => p.hand)];
    assert.equal(new Set(finalCards.map(card => card.id)).size, finalCards.length);
    assert.deepEqual(f.sqlite.prepare('SELECT * FROM seats').all(), originalSeats);
    for (const auth of auths)
      assert.deepEqual(await f.restart().readSeatView(code, auth), viewGame(claimedBox, auth.playerId));

    const flight = structuredClone(claimedBox);
    const reusableSemuta = take(flight, SEMUTA_DRUG_ID);
    const ornithopter = take(flight, 'richese-ornithopter');
    seat(flight, ids[0]).hand.push(reusableSemuta);
    seat(flight, ids[1]).hand.push(ornithopter);
    const pilot = seat(flight, ids[1]);
    pilot.reserves += Object.values(pilot.forces).reduce((sum, n) => sum + n, 0) - 3;
    pilot.forces = { 'imperial_basin:10': 3 };
    pilot.shipped = true;
    pilot.moved = 0;
    flight.hajr = [];
    Object.assign(flight, { turn: 4, phase: 5, active: ids[1], storm: 18,
      ready: [], decision: null, response: null, phaseOpening: null,
      stormPending: null, movementRemaining: [ids[1], ids[0], ids[2]] });
    flight.version = claimedBox.version + 1;
    assert.equal(f.sqlite.prepare('UPDATE rooms SET state=?,version=? WHERE code=? AND version=?')
      .run(JSON.stringify(flight), flight.version, code, claimedBox.version).changes, 1);
    const moved = await act(1, { type: 'move', movementCard: ornithopter.id,
      ornithopter: 'twoGroups', forces: { 'imperial_basin:10': 1 },
      territory: 'arrakeen', sector: 10 });
    assert.equal(moved.ornithopter?.completed, 1);
    const retired = await act(1, { type: 'endMovement' });
    const flightEvent = retired.pendingTreacheryDiscard?.batch.event;
    assert.equal(retired.pendingTreacheryDiscard?.reaction?.stage, 'offer');
    assert.ok(flightEvent);
    assert.equal(retired.active, ids[1]);
    await f.restart().continueRoomAutomatic(code, clock);
    assert.equal((await f.restart().readRoom(code)).version, retired.version);
    const flightOwner = await f.restart().readSeatView(code, auths[0]);
    const flightObserver = await f.restart().readSeatView(code, auths[2]);
    assert.equal(flightOwner.semutaReaction?.canCommit, true);
    assert.equal(flightObserver.semutaReaction?.canCommit, false);
    const flown = await act(0, { type: 'semutaCommit', event: flightEvent });
    assert.equal(flown.pendingTreacheryDiscard, null);
    assert.equal(flown.active, ids[0]);
    assert.deepEqual(flown.movementRemaining, [ids[0], ids[2]]);
    assert.equal(seat(flown, ids[1]).moved, 1);
    assert.equal(seat(flown, ids[1]).forces['arrakeen:10'], 1);
    assert.equal(seat(flown, ids[0]).hand.filter(card => card.id === ornithopter.id).length, 1);
    assert.equal(flown.discard.filter(card => card.id === SEMUTA_DRUG_ID).length, 1);
    assert.equal(flown.discard.some(card => card.id === ornithopter.id), false);
    assert.deepEqual(f.sqlite.prepare('SELECT * FROM seats').all(), originalSeats);
    for (const auth of auths)
      assert.deepEqual(await f.restart().readSeatView(code, auth), viewGame(flown, auth.playerId));

    const transfer = structuredClone(flown);
    const finalSemuta = take(transfer, SEMUTA_DRUG_ID);
    const distrans = take(transfer, 'richese-distrans');
    transfer.richeseCache!.push(take(transfer, 'richese-nullentropy-box'));
    seat(transfer, ids[0]).hand.push(finalSemuta);
    seat(transfer, ids[1]).hand.push(distrans);
    const given = seat(transfer, ids[1]).hand.find(card => card.id === selected)!;
    assert.ok(given);
    Object.assign(transfer, { turn: 5, phase: 5, active: ids[1], ready: [],
      decision: null, response: null, phaseOpening: null, stormPending: null,
      movementRemaining: [ids[1], ids[0], ids[2]], hajr: [] });
    transfer.version = flown.version + 1;
    assert.equal(f.sqlite.prepare('UPDATE rooms SET state=?,version=? WHERE code=? AND version=?')
      .run(JSON.stringify(transfer), transfer.version, code, flown.version).changes, 1);
    const handed = await act(1, { type: 'card', card: distrans.id,
      target: ids[2], give: given.id });
    assert.equal(handed.pendingTreacheryDiscard?.reaction?.stage, 'offer');
    assert.equal(seat(handed, ids[2]).hand.filter(card => card.id === given.id).length, 1);
    await f.restart().continueRoomAutomatic(code, clock);
    assert.equal((await f.restart().readRoom(code)).version, handed.version);
    const observer = await f.restart().readSeatView(code, auths[0]);
    assert.equal(observer.semutaReaction?.canCommit, true);
    assert.equal(JSON.stringify(observer).includes(given.id), false);
    const final = await act(0, { type: 'semutaCommit',
      event: handed.pendingTreacheryDiscard!.batch.event });
    assert.equal(final.pendingTreacheryDiscard, null);
    assert.equal(seat(final, ids[2]).hand.filter(card => card.id === given.id).length, 1);
    assert.equal(seat(final, ids[0]).hand.filter(card => card.id === distrans.id).length, 1);
    assert.equal(final.discard.filter(card => card.id === SEMUTA_DRUG_ID).length, 1);
    assert.equal(final.discard.some(card => card.id === distrans.id), false);
    assert.deepEqual(f.sqlite.prepare('SELECT * FROM seats').all(), originalSeats);
    for (const auth of auths)
      assert.deepEqual(await f.restart().readSeatView(code, auth), viewGame(final, auth.playerId));

    const finalAnswer = structuredClone(final);
    const lastSemuta = take(finalAnswer, SEMUTA_DRUG_ID);
    finalAnswer.richeseCache!.push(take(finalAnswer, distrans.id));
    seat(finalAnswer, ids[0]).hand.push(lastSemuta);
    const truth = take(finalAnswer, 'truthtrance');
    seat(finalAnswer, ids[1]).hand.push(truth);
    Object.assign(finalAnswer, { turn: 6, phase: 5, active: ids[1], ready: [],
      decision: null, response: null, phaseOpening: null, stormPending: null,
      movementRemaining: [ids[1], ids[0], ids[2]], hajr: [] });
    finalAnswer.version = final.version + 1;
    assert.equal(f.sqlite.prepare('UPDATE rooms SET state=?,version=? WHERE code=? AND version=?')
      .run(JSON.stringify(finalAnswer), finalAnswer.version, code, final.version).changes, 1);
    let question = await act(1, { type: 'card', card: truth.id });
    while (question.truthtrance?.stage === 'priority') {
      const responder = question.players.find(p => !question.truthtrance!.passed.includes(p.id))!;
      question = await act(ids.indexOf(responder.id), { type: 'truthPass' });
    }
    const targetSpice = seat(question, ids[2]).spice;
    question = await act(1, { type: 'truthAsk',
      question: { kind: 'fact', target: ids[2],
        fact: { kind: 'spice', compare: 'eq', value: targetSpice } } });
    const answered = await act(2, { type: 'truthAnswer', answer: 'yes' });
    assert.equal(answered.pendingTreacheryDiscard?.reaction?.stage, 'offer');
    assert.equal(answered.truthHistory?.at(-1)?.answer, 'yes');
    await f.restart().continueRoomAutomatic(code, clock);
    assert.equal((await f.restart().readRoom(code)).version, answered.version);
    assert.equal((await f.restart().readSeatView(code, auths[0])).semutaReaction?.canCommit, true);
    const recovered = await act(0, { type: 'semutaCommit',
      event: answered.pendingTreacheryDiscard!.batch.event });
    assert.equal(recovered.pendingTreacheryDiscard, null);
    assert.equal(recovered.truthtrance, null);
    assert.deepEqual(recovered.truthHistory, answered.truthHistory);
    assert.equal(seat(recovered, ids[0]).hand.filter(card => card.id === truth.id).length, 1);
    assert.equal(recovered.discard.filter(card => card.id === SEMUTA_DRUG_ID).length, 1);
    assert.equal(recovered.discard.some(card => card.id === truth.id), false);
    assert.deepEqual(f.sqlite.prepare('SELECT * FROM seats').all(), originalSeats);
    for (const auth of auths)
      assert.deepEqual(await f.restart().readSeatView(code, auth), viewGame(recovered, auth.playerId));
  } finally { f.sqlite.close(); }
});
