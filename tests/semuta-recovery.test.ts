import test from 'node:test';
import assert from 'node:assert/strict';
import { startPrototypeRoom } from '../tools/prototype-room';
import { botActions } from '../game/bots';
import { viewGame, type Game, type Action } from '../game/engine';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { spiceDeck } from '../game/cards';
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
    assert.equal(observer.players.find(p => p.id === ids[2])?.hand, undefined);
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

    const ordered = structuredClone(recovered);
    const again = take(ordered, SEMUTA_DRUG_ID);
    ordered.deck.push(take(ordered, truth.id));
    seat(ordered, ids[0]).hand.push(again);
    const sapho = take(ordered, 'richese-juice-of-sapho');
    seat(ordered, ids[2]).hand.push(sapho);
    for (const p of ordered.players) { p.moved = 0; p.shipped = false; }
    Object.assign(ordered, { turn: 7, phase: 5, active: ids[1], ready: [],
      decision: null, response: null, phaseOpening: null, stormPending: null,
      movementRemaining: [ids[1], ids[0], ids[2]], hajr: [] });
    ordered.version = recovered.version + 1;
    assert.equal(f.sqlite.prepare('UPDATE rooms SET state=?,version=? WHERE code=? AND version=?')
      .run(JSON.stringify(ordered), ordered.version, code, recovered.version).changes, 1);
    const reordered = await act(2, { type: 'card', card: sapho.id, scope: 'movement',
      mode: 'first', event: `movement:${ordered.turn}` });
    assert.equal(reordered.pendingTreacheryDiscard?.reaction?.stage, 'offer');
    assert.deepEqual(reordered.movementRemaining, [ids[2], ids[1], ids[0]]);
    assert.equal(reordered.active, ids[1]);
    await f.restart().continueRoomAutomatic(code, clock);
    assert.equal((await f.restart().readRoom(code)).version, reordered.version);
    assert.equal((await f.restart().readSeatView(code, auths[0])).semutaReaction?.canCommit, true);
    const reorderedClaim = await act(0, { type: 'semutaCommit',
      event: reordered.pendingTreacheryDiscard!.batch.event });
    assert.equal(reorderedClaim.pendingTreacheryDiscard, null);
    assert.equal(reorderedClaim.active, ids[2]);
    assert.deepEqual(reorderedClaim.movementRemaining, [ids[2], ids[1], ids[0]]);
    assert.equal(seat(reorderedClaim, ids[0]).hand.filter(card => card.id === sapho.id).length, 1);
    assert.equal(reorderedClaim.discard.filter(card => card.id === SEMUTA_DRUG_ID).length, 1);
    assert.equal(reorderedClaim.discard.some(card => card.id === sapho.id), false);
    assert.deepEqual(f.sqlite.prepare('SELECT * FROM seats').all(), originalSeats);
    for (const auth of auths)
      assert.deepEqual(await f.restart().readSeatView(code, auth), viewGame(reorderedClaim, auth.playerId));

    const arrival = structuredClone(reorderedClaim);
    const arrivalSemuta = take(arrival, SEMUTA_DRUG_ID);
    const finalFlight = take(arrival, 'richese-ornithopter');
    seat(arrival, ids[0]).hand.push(arrivalSemuta);
    seat(arrival, ids[1]).hand.push(finalFlight);
    const mover = seat(arrival, ids[1]);
    mover.reserves += Object.values(mover.forces).reduce((sum, n) => sum + n, 0) - 3;
    mover.forces = { 'imperial_basin:10': 3 };
    mover.moved = 0;
    mover.shipped = true;
    Object.assign(arrival, { turn: 8, phase: 5, active: ids[1], storm: 18,
      ready: [], decision: null, response: null, phaseOpening: null,
      stormPending: null, movementRemaining: [ids[1], ids[0], ids[2]], hajr: [] });
    arrival.version = reorderedClaim.version + 1;
    assert.equal(f.sqlite.prepare('UPDATE rooms SET state=?,version=? WHERE code=? AND version=?')
      .run(JSON.stringify(arrival), arrival.version, code, reorderedClaim.version).changes, 1);
    const arrived = await act(1, { type: 'move', movementCard: finalFlight.id,
      ornithopter: 'range3', forces: { 'imperial_basin:10': 1 },
      territory: 'hagga_basin', sector: 12 });
    assert.equal(arrived.pendingTreacheryDiscard?.reaction?.stage, 'offer');
    assert.equal(seat(arrived, ids[1]).forces['hagga_basin:12'], 1);
    await f.restart().continueRoomAutomatic(code, clock);
    assert.equal((await f.restart().readRoom(code)).version, arrived.version);
    assert.equal((await f.restart().readSeatView(code, auths[0])).semutaReaction?.canCommit, true);
    const finalArrival = await act(0, { type: 'semutaCommit',
      event: arrived.pendingTreacheryDiscard!.batch.event });
    assert.equal(finalArrival.pendingTreacheryDiscard, null);
    assert.equal(finalArrival.active, ids[1]);
    assert.equal(seat(finalArrival, ids[1]).moved, 1);
    assert.equal(seat(finalArrival, ids[1]).forces['hagga_basin:12'], 1);
    assert.equal(seat(finalArrival, ids[0]).hand.filter(card => card.id === finalFlight.id).length, 1);
    assert.equal(finalArrival.discard.filter(card => card.id === SEMUTA_DRUG_ID).length, 1);
    assert.equal(finalArrival.discard.some(card => card.id === finalFlight.id), false);
    assert.deepEqual(f.sqlite.prepare('SELECT * FROM seats').all(), originalSeats);
    for (const auth of auths)
      assert.deepEqual(await f.restart().readSeatView(code, auth), viewGame(finalArrival, auth.playerId));

    const battleStart = structuredClone(finalArrival);
    const battleSemuta = take(battleStart, SEMUTA_DRUG_ID);
    battleStart.richeseCache!.push(take(battleStart, sapho.id));
    seat(battleStart, ids[0]).hand.push(battleSemuta);
    const weapon = battleStart.deck.splice(
      battleStart.deck.findIndex(card => card.kind === 'projectile'), 1)[0];
    const shield = battleStart.deck.splice(
      battleStart.deck.findIndex(card => card.kind === 'shield'), 1)[0];
    const defense = battleStart.deck.splice(
      battleStart.deck.findIndex(card => card.kind === 'snooper'), 1)[0];
    assert.ok(weapon && shield && defense);
    seat(battleStart, ids[1]).hand.push(weapon, shield);
    seat(battleStart, ids[2]).hand.push(defense);
    for (const id of [ids[1], ids[2]]) {
      const p = seat(battleStart, id);
      p.reserves += Object.values(p.forces).reduce((sum, n) => sum + n, 0) - 5;
      p.forces = { 'arrakeen:10': 5 };
      for (const leader of p.leaders) leader.strength = 0;
    }
    Object.assign(battleStart, { turn: 9, phase: 6, active: ids[1], order: [ids[1], ids[2], ids[0]],
      ready: [], decision: null, response: null, phaseOpening: null, stormPending: null });
    battleStart.version = finalArrival.version + 1;
    assert.equal(f.sqlite.prepare('UPDATE rooms SET state=?,version=? WHERE code=? AND version=?')
      .run(JSON.stringify(battleStart), battleStart.version, code, finalArrival.version).changes, 1);
    let duel = await act(1, { type: 'chooseBattle', territory: 'arrakeen', target: ids[2] });
    for (let step = 0; step < 40; step++) {
      if (duel.response) {
        const p = duel.players.find(p => !duel.response!.passed.includes(p.id))!;
        duel = await act(ids.indexOf(p.id), { type: 'passResponse' });
      } else if (duel.battle?.preparation)
        duel = await act(ids.indexOf(duel.battle.preparation.owner), { type: 'declineBattlePower' });
      else break;
    }
    if (duel.battle?.preLeader && !duel.battle.preLeader.closed)
      for (const index of [1, 2])
        duel = await act(index, { type: 'battlePreparationReady', event: duel.battle!.preLeader!.event });
    duel = await act(1, { type: 'battlePlan', dial: 2, support: 2,
      leader: seat(duel, ids[1]).leaders[0].id,
      weapon: weapon.id, defense: shield.id });
    duel = await act(2, { type: 'battlePlan', dial: 0, support: 0,
      leader: seat(duel, ids[2]).leaders[0].id, defense: defense.id });
    duel = await act(1, { type: 'traitorCall', call: false });
    duel = await act(2, { type: 'traitorCall', call: false });
    assert.equal(duel.pendingTreacheryDiscard?.continuation.kind, 'battleResolved');
    assert.equal(duel.pendingTreacheryDiscard?.reaction?.stage, 'offer');
    const mandatoryEvent = duel.pendingTreacheryDiscard!.batch.event;
    for (const index of [2, 1, 0])
      duel = await act(index, { type: 'semutaPass', event: mandatoryEvent });
    assert.equal(duel.decision?.kind, 'battleCards');
    const chosen = await act(1, { type: 'decision', discard: [weapon.id, shield.id] });
    assert.equal(chosen.pendingTreacheryDiscard?.batch.cause, 'battle:winner');
    assert.equal(chosen.pendingTreacheryDiscard?.reaction?.stage, 'offer');
    await f.restart().continueRoomAutomatic(code, clock);
    assert.equal((await f.restart().readRoom(code)).version, chosen.version);
    assert.equal((await f.restart().readSeatView(code, auths[0])).semutaReaction?.canCommit, true);
    const committed = await act(0, { type: 'semutaCommit',
      event: chosen.pendingTreacheryDiscard!.batch.event });
    assert.equal(committed.pendingTreacheryDiscard?.reaction?.stage, 'select');
    await f.restart().continueRoomAutomatic(code, clock);
    assert.equal((await f.restart().readRoom(code)).version, committed.version);
    const ownerSelection = await f.restart().readSeatView(code, auths[0]);
    const rivalSelection = await f.restart().readSeatView(code, auths[2]);
    assert.deepEqual(ownerSelection.semutaReaction?.candidates.map(card => card.id),
      [weapon.id, shield.id]);
    assert.deepEqual(rivalSelection.semutaReaction?.candidates, []);
    const battleClaim = await act(0, { type: 'semutaSelect',
      event: chosen.pendingTreacheryDiscard!.batch.event, card: shield.id });
    assert.equal(battleClaim.pendingTreacheryDiscard, null);
    assert.equal(seat(battleClaim, ids[0]).hand.filter(card => card.id === shield.id).length, 1);
    assert.equal(battleClaim.discard.filter(card => card.id === SEMUTA_DRUG_ID).length, 1);
    assert.equal(battleClaim.discard.filter(card => card.id === weapon.id).length, 1);
    assert.equal(battleClaim.discard.some(card => card.id === shield.id), false);
    assert.deepEqual(f.sqlite.prepare('SELECT * FROM seats').all(), originalSeats);
    for (const auth of auths)
      assert.deepEqual(await f.restart().readSeatView(code, auth), viewGame(battleClaim, auth.playerId));

    const mandatoryStart = structuredClone(battleClaim);
    const heroSemuta = take(mandatoryStart, SEMUTA_DRUG_ID);
    mandatoryStart.deck.push(take(mandatoryStart, shield.id));
    seat(mandatoryStart, ids[0]).hand.push(heroSemuta);
    const hero = mandatoryStart.deck.splice(
      mandatoryStart.deck.findIndex(card => card.kind === 'hero'), 1)[0];
    const nextWeapon = mandatoryStart.deck.splice(
      mandatoryStart.deck.findIndex(card => card.kind === 'projectile'), 1)[0];
    const nextDefense = mandatoryStart.deck.splice(
      mandatoryStart.deck.findIndex(card => card.kind === 'snooper'), 1)[0];
    assert.ok(hero && nextWeapon && nextDefense);
    seat(mandatoryStart, ids[1]).hand.push(hero, nextWeapon);
    seat(mandatoryStart, ids[2]).hand.push(nextDefense);
    for (const id of [ids[1], ids[2]]) {
      const p = seat(mandatoryStart, id);
      p.reserves += Object.values(p.forces).reduce((sum, n) => sum + n, 0) - 5;
      p.forces = { 'arrakeen:10': 5 };
      for (const leader of p.leaders) leader.strength = 0;
    }
    Object.assign(mandatoryStart, { turn: 10, phase: 6, active: ids[1],
      order: [ids[1], ids[2], ids[0]], ready: [],
      decision: null, response: null, phaseOpening: null, stormPending: null,
      lastBattle: [], lastBattleContext: null });
    mandatoryStart.version = battleClaim.version + 1;
    assert.equal(f.sqlite.prepare('UPDATE rooms SET state=?,version=? WHERE code=? AND version=?')
      .run(JSON.stringify(mandatoryStart), mandatoryStart.version, code, battleClaim.version).changes, 1);
    let mandatoryBattle = await act(1, { type: 'chooseBattle', territory: 'arrakeen', target: ids[2] });
    for (let step = 0; step < 40; step++) {
      if (mandatoryBattle.response) {
        const p = mandatoryBattle.players.find(p => !mandatoryBattle.response!.passed.includes(p.id))!;
        mandatoryBattle = await act(ids.indexOf(p.id), { type: 'passResponse' });
      } else if (mandatoryBattle.battle?.preparation)
        mandatoryBattle = await act(ids.indexOf(mandatoryBattle.battle.preparation.owner),
          { type: 'declineBattlePower' });
      else break;
    }
    if (mandatoryBattle.battle?.preLeader && !mandatoryBattle.battle.preLeader.closed)
      for (const index of [1, 2])
        mandatoryBattle = await act(index, {
          type: 'battlePreparationReady', event: mandatoryBattle.battle!.preLeader!.event,
        });
    mandatoryBattle = await act(1, { type: 'battlePlan', dial: 2, support: 2,
      leader: hero.id, weapon: nextWeapon.id });
    mandatoryBattle = await act(2, { type: 'battlePlan', dial: 0, support: 0,
      leader: seat(mandatoryBattle, ids[2]).leaders.find(leader => !leader.dead)!.id,
      defense: nextDefense.id });
    mandatoryBattle = await act(1, { type: 'traitorCall', call: false });
    const heroOffer = await act(2, { type: 'traitorCall', call: false });
    assert.equal(heroOffer.pendingTreacheryDiscard?.continuation.kind, 'winnerMandatoryDiscard');
    assert.equal(heroOffer.pendingTreacheryDiscard?.reaction?.stage, 'offer');
    assert.equal(heroOffer.discard.filter(card => card.id === hero.id).length, 1);
    await f.restart().continueRoomAutomatic(code, clock);
    assert.equal((await f.restart().readRoom(code)).version, heroOffer.version);
    assert.equal((await f.restart().readSeatView(code, auths[0])).semutaReaction?.canCommit, true);
    const heroClaim = await act(0, { type: 'semutaCommit',
      event: heroOffer.pendingTreacheryDiscard!.batch.event });
    assert.equal(heroClaim.pendingTreacheryDiscard, null);
    assert.equal(heroClaim.decision?.kind, 'battleCards');
    assert.equal(seat(heroClaim, ids[1]).hand.some(card => card.id === nextWeapon.id), true);
    assert.equal(seat(heroClaim, ids[0]).hand.filter(card => card.id === hero.id).length, 1);
    assert.equal(heroClaim.discard.filter(card => card.id === SEMUTA_DRUG_ID).length, 1);
    assert.equal(heroClaim.discard.some(card => card.id === hero.id), false);
    assert.deepEqual(f.sqlite.prepare('SELECT * FROM seats').all(), originalSeats);
    for (const auth of auths)
      assert.deepEqual(await f.restart().readSeatView(code, auth), viewGame(heroClaim, auth.playerId));
    let optional = await act(1, { type: 'decision', discard: [nextWeapon.id] });
    assert.equal(optional.pendingTreacheryDiscard?.batch.cause, 'battle:winner');
    assert.equal(optional.pendingTreacheryDiscard?.reaction?.stage, 'offer');
    const optionalEvent = optional.pendingTreacheryDiscard!.batch.event;
    for (const index of [2, 0, 1])
      optional = await act(index, { type: 'semutaPass', event: optionalEvent });
    assert.equal(optional.pendingTreacheryDiscard, null);
    assert.equal(optional.discard.filter(card => card.id === nextWeapon.id).length, 1);
    assert.equal(optional.discard.filter(card => card.id === SEMUTA_DRUG_ID).length, 1);
    assert.equal(seat(optional, ids[0]).hand.filter(card => card.id === hero.id).length, 1);

    const mutual = structuredClone(optional);
    const mutualSemuta = take(mutual, SEMUTA_DRUG_ID);
    mutual.deck.push(take(mutual, hero.id));
    seat(mutual, ids[0]).hand.push(mutualSemuta);
    const mixedShield = mutual.deck.splice(
      mutual.deck.findIndex(card => card.kind === 'shield'), 1)[0];
    const mixedSnooper = mutual.deck.splice(
      mutual.deck.findIndex(card => card.kind === 'snooper'), 1)[0];
    assert.ok(mixedShield && mixedSnooper);
    const attacker = seat(mutual, ids[1]), defender = seat(mutual, ids[2]);
    attacker.hand.push(mixedShield);
    defender.hand.push(mixedSnooper);
    for (const p of [attacker, defender]) {
      p.reserves += Object.values(p.forces).reduce((sum, n) => sum + n, 0) - 5;
      p.forces = { 'arrakeen:10': 5 };
      for (const leader of p.leaders) leader.strength = 0;
    }
    const attackerLeader = attacker.leaders.find(leader => !leader.dead)!;
    const defenderLeader = defender.leaders.find(leader => !leader.dead)!;
    attacker.traitors = [defenderLeader.id];
    defender.traitors = [attackerLeader.id];
    Object.assign(mutual, { turn: 11, phase: 6, active: ids[1],
      order: [ids[1], ids[2], ids[0]], ready: [],
      decision: null, response: null, phaseOpening: null, stormPending: null,
      lastBattle: [], lastBattleContext: null });
    mutual.version = optional.version + 1;
    assert.equal(f.sqlite.prepare('UPDATE rooms SET state=?,version=? WHERE code=? AND version=?')
      .run(JSON.stringify(mutual), mutual.version, code, optional.version).changes, 1);
    let mutualBattle = await act(1, { type: 'chooseBattle', territory: 'arrakeen', target: ids[2] });
    for (let step = 0; step < 40; step++) {
      if (mutualBattle.response) {
        const p = mutualBattle.players.find(p => !mutualBattle.response!.passed.includes(p.id))!;
        mutualBattle = await act(ids.indexOf(p.id), { type: 'passResponse' });
      } else if (mutualBattle.battle?.preparation)
        mutualBattle = await act(ids.indexOf(mutualBattle.battle.preparation.owner),
          { type: 'declineBattlePower' });
      else break;
    }
    if (mutualBattle.battle?.preLeader && !mutualBattle.battle.preLeader.closed)
      for (const index of [1, 2])
        mutualBattle = await act(index, {
          type: 'battlePreparationReady', event: mutualBattle.battle!.preLeader!.event,
        });
    mutualBattle = await act(1, { type: 'battlePlan', dial: 2, support: 2,
      leader: attackerLeader.id, defense: mixedShield.id });
    mutualBattle = await act(2, { type: 'battlePlan', dial: 0, support: 0,
      leader: defenderLeader.id, defense: mixedSnooper.id });
    mutualBattle = await act(1, { type: 'traitorCall', call: true });
    const mixedOffer = await act(2, { type: 'traitorCall', call: true });
    assert.equal(mixedOffer.pendingTreacheryDiscard?.continuation.kind, 'battleResolved');
    assert.equal(mixedOffer.pendingTreacheryDiscard?.reaction?.stage, 'offer');
    assert.deepEqual(mixedOffer.pendingTreacheryDiscard?.batch.entries.map(entry => [
      entry.card.id, entry.discardedBy,
    ]), [[mixedShield.id, ids[1]], [mixedSnooper.id, ids[2]]]);
    await f.restart().continueRoomAutomatic(code, clock);
    assert.equal((await f.restart().readRoom(code)).version, mixedOffer.version);
    const mixedEvent = mixedOffer.pendingTreacheryDiscard!.batch.event;
    const mixedCommit = await act(0, { type: 'semutaCommit', event: mixedEvent });
    assert.equal(mixedCommit.pendingTreacheryDiscard?.reaction?.stage, 'select');
    assert.deepEqual((await f.restart().readSeatView(code, auths[0])).semutaReaction?.candidates.map(card => card.id),
      [mixedShield.id, mixedSnooper.id]);
    assert.deepEqual((await f.restart().readSeatView(code, auths[1])).semutaReaction?.candidates, []);
    const mixedClaim = await act(0, { type: 'semutaSelect', event: mixedEvent, card: mixedSnooper.id });
    assert.equal(mixedClaim.pendingTreacheryDiscard, null);
    assert.equal(mixedClaim.lastBattleContext?.winner, null);
    assert.equal(seat(mixedClaim, ids[0]).hand.filter(card => card.id === mixedSnooper.id).length, 1);
    assert.equal(mixedClaim.discard.filter(card => card.id === mixedShield.id).length, 1);
    assert.equal(mixedClaim.discard.filter(card => card.id === SEMUTA_DRUG_ID).length, 1);
    assert.deepEqual(f.sqlite.prepare('SELECT * FROM seats').all(), originalSeats);
    for (const auth of auths)
      assert.deepEqual(await f.restart().readSeatView(code, auth), viewGame(mixedClaim, auth.playerId));
  } finally { f.sqlite.close(); }
});

void test('an authenticated Ix-deck Thumper pause retains the undrawn blow through restart', async () => {
  const f = unitStore();
  try {
    const created = await f.rooms.createRoom('Semuta Thumper QA', 'richese', false, ['choam', 'ix']);
    const code = created.view.code;
    const second = await f.rooms.joinRoom(code, 'Atreides', 'atreides');
    const third = await f.rooms.joinRoom(code, 'Emperor', 'emperor');
    const auths = await Promise.all([created.token!, second.token!, third.token!]
      .map(token => f.restart().authenticate(code, token)));
    const ids = auths.map(auth => auth.playerId);
    const act = async (index: number, action: Action) => {
      const before = await f.restart().readRoom(code);
      await f.restart().act(code, auths[index], before.version, action, clock);
      return f.restart().readRoom(code);
    };
    for (let index = 0; index < auths.length; index++) await act(index, { type: 'ready' });
    let game = await f.restart().readRoom(code);
    startPrototypeRoom(f.sqlite, code, game.version, 'semuta');
    game = await f.restart().readRoom(code);
    for (let step = 0; game.status === 'setup' && step < 80; step++) {
      let moved = false;
      for (let index = 0; index < auths.length; index++) {
        const view = viewGame(game, ids[index]);
        view.players.find(p => p.id === view.me)!.bot = 'Medium';
        const choice = botActions(view)[0];
        if (choice) { game = await act(index, choice); moved = true; break; }
      }
      assert.ok(moved, 'genuine Ix-deck setup needs a legal AI choice');
    }
    assert.equal(game.status, 'playing');
    const originalSeats = f.sqlite.prepare('SELECT * FROM seats').all();
    const semuta = take(game, SEMUTA_DRUG_ID), thumper = take(game, 'thumper');
    game.deck.push(...game.players.flatMap(p => p.hand));
    for (const p of game.players) p.hand = [];
    seat(game, ids[0]).hand.push(semuta);
    seat(game, ids[1]).hand.push(thumper);
    const lands = spiceDeck().filter(card => 'territory' in card);
    const prior = lands[0], next = lands[1];
    if (!('territory' in prior) || !('territory' in next))
      throw Error('Missing real spice territories');
    seat(game, ids[2]).forces = { [`${prior.territory}:${prior.sector}`]: 3 };
    seat(game, ids[2]).reserves = 17;
    Object.assign(game, { turn: 2, phase: 1, active: null, ready: [],
      decision: null, response: null, phaseOpening: null,
      spiceWindow: null, spiceResolution: null, spiceSequence: null, nexus: false,
      spice: { [`${prior.territory}:${prior.sector}`]: 8 },
      spiceDiscard: [[prior], []], spiceDeck: [next, ...spiceDeck().filter(card => 'worm' in card)] });
    const beforeDeck = structuredClone(game.spiceDeck);
    game.version++;
    assert.equal(f.sqlite.prepare('UPDATE rooms SET state=?,version=? WHERE code=? AND version=?')
      .run(JSON.stringify(game), game.version, code, game.version - 1).changes, 1);
    const pending = await act(1, { type: 'card', card: thumper.id });
    assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
    assert.deepEqual(pending.spiceDeck, beforeDeck);
    assert.equal(seat(pending, ids[2]).tanks, 0);
    await f.restart().continueRoomAutomatic(code, clock);
    assert.equal((await f.restart().readRoom(code)).version, pending.version);
    const holder = await f.restart().readSeatView(code, auths[0]);
    const rival = await f.restart().readSeatView(code, auths[2]);
    assert.equal(holder.semutaReaction?.canCommit, true);
    assert.equal(rival.semutaReaction?.canCommit, false);
    const claimed = await act(0, { type: 'semutaCommit',
      event: pending.pendingTreacheryDiscard!.batch.event });
    assert.equal(claimed.pendingTreacheryDiscard, null);
    assert.equal(seat(claimed, ids[2]).tanks, 3);
    assert.equal(claimed.spiceWindow?.territory, next.territory);
    assert.equal(claimed.spiceDeck.length, beforeDeck.length - 1);
    assert.equal(seat(claimed, ids[0]).hand.filter(card => card.id === thumper.id).length, 1);
    assert.equal(claimed.discard.filter(card => card.id === SEMUTA_DRUG_ID).length, 1);
    assert.equal(claimed.discard.some(card => card.id === thumper.id), false);
    assert.deepEqual(f.sqlite.prepare('SELECT * FROM seats').all(), originalSeats);
    for (const auth of auths)
      assert.deepEqual(await f.restart().readSeatView(code, auth), viewGame(claimed, auth.playerId));

    const bidding = structuredClone(claimed);
    const again = take(bidding, SEMUTA_DRUG_ID);
    bidding.deck.push(take(bidding, thumper.id));
    seat(bidding, ids[0]).hand.push(again);
    const amal = take(bidding, 'amal');
    seat(bidding, ids[1]).hand.push(amal);
    seat(bidding, ids[0]).spice = 11;
    seat(bidding, ids[1]).spice = 9;
    seat(bidding, ids[2]).spice = 7;
    Object.assign(bidding, { turn: 3, phase: 2, active: null, ready: [],
      decision: null, response: null, phaseOpening: null, auction: null,
      spiceWindow: null, spiceResolution: null, spiceSequence: null, nexus: false });
    bidding.version = claimed.version + 1;
    assert.equal(f.sqlite.prepare('UPDATE rooms SET state=?,version=? WHERE code=? AND version=?')
      .run(JSON.stringify(bidding), bidding.version, code, claimed.version).changes, 1);
    for (let index = 0; index < auths.length; index++)
      await act(index, { type: 'ready' });
    const opening = await f.restart().readRoom(code);
    assert.equal(opening.phase, 3);
    assert.ok(opening.phaseOpening);
    assert.deepEqual((await act(2, { type: 'ready' })).phaseOpening?.passed, [ids[2]]);
    const deckBefore = structuredClone(opening.deck);
    const offeredAmal = await act(1, { type: 'card', card: amal.id });
    assert.equal(offeredAmal.pendingTreacheryDiscard?.reaction?.stage, 'offer');
    assert.deepEqual(offeredAmal.players.map(p => p.spice), [5, 4, 3]);
    assert.deepEqual(offeredAmal.deck, deckBefore);
    assert.equal(offeredAmal.phaseOpening, null);
    await f.restart().continueRoomAutomatic(code, clock);
    assert.equal((await f.restart().readRoom(code)).version, offeredAmal.version);
    assert.equal((await f.restart().readSeatView(code, auths[0])).semutaReaction?.canCommit, true);
    const recoveredAmal = await act(0, { type: 'semutaCommit',
      event: offeredAmal.pendingTreacheryDiscard!.batch.event });
    assert.equal(recoveredAmal.pendingTreacheryDiscard, null);
    assert.deepEqual(recoveredAmal.phaseOpening?.passed, []);
    assert.deepEqual(recoveredAmal.players.map(p => p.spice), [5, 4, 3]);
    assert.equal(seat(recoveredAmal, ids[0]).hand.filter(card => card.id === amal.id).length, 1);
    assert.equal(recoveredAmal.discard.filter(card => card.id === SEMUTA_DRUG_ID).length, 1);
    for (let index = 0; index < auths.length; index++)
      await act(index, { type: 'ready' });
    const resumedAmal = await f.restart().readRoom(code);
    assert.equal(resumedAmal.phaseOpening, null);
    assert.equal(resumedAmal.richeseBidding?.turn, resumedAmal.turn);
    assert.deepEqual(resumedAmal.players.map(p => p.spice), [5, 4, 3]);
    assert.deepEqual(f.sqlite.prepare('SELECT * FROM seats').all(), originalSeats);
    for (const auth of auths)
      assert.deepEqual(await f.restart().readSeatView(code, auth), viewGame(resumedAmal, auth.playerId));
  } finally { f.sqlite.close(); }
});
