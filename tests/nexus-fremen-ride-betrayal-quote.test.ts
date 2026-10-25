import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, joinGame, newPlayer, type Game } from '../game/engine';
import { createNexusCards, discardNexusCard, validateNexusCards } from '../game/nexus-cards';
import type { FactionId } from '../game/catalog';
import { greatMakerSignature } from '../game/great-maker';
import { quoteFremenCunningRide } from '../game/nexus-fremen-cunning';
import {
  createFremenRideBetrayal as create, fremenRideBetrayalCurrentOwner as owner,
  passFremenRideBetrayal as pass, useFremenRideBetrayal as use,
  validateFremenRideBetrayal as validate, FremenRideBetrayalError,
  type FremenRideBetrayalFrame as Frame, type FremenRideBetrayalParent as Parent,
} from '../game/nexus-fremen-ride-betrayal';

const EVENT = '4b673e18-f130-4133-b93d-f044ecae3370';
const nativeParent: Parent = { kind: 'wormRide', player: 'fremen', territory: 'hagga_basin' };
/** Explicitly controlled pure producer inputs, not a native acquisition or
 * appearance programme. The real twelve singleton cards are conserved. */
function position(advanced = false): Game {
  const g = createGame('FREMENRIDEQUOTES', newPlayer('fremen', 'Fremen', 'fremen'), advanced);
  for (const faction of ['atreides', 'emperor', 'guild'] as const) joinGame(g, newPlayer(faction, faction, faction));
  g.status = 'playing'; g.turn = 2; g.phase = 1; g.storm = 1;
  g.order = ['emperor', 'fremen', 'atreides', 'guild'];
  g.nexusCards = { cards: createNexusCards(g.players, () => 0.9), phase: null };
  g.players.find(p => p.id === 'fremen')!.forces = { 'hagga_basin:13': 2 };
  g.players.find(p => p.id === 'fremen')!.reserves = 18;
  g.spice = { 'oh_gap:10': 6 }; g.wormRides = ['false_wall_south'];
  g.decision = structuredClone(nativeParent);
  give(g, 'emperor', 'fremen'); give(g, 'atreides', 'richese');
  return g;
}
function give(g: Game, actor: string, face: FactionId) {
  const cards = g.nexusCards!.cards!;
  const old = cards.hands[actor]; if (old) cards.deck.push(old);
  const index = cards.deck.indexOf(face); assert.ok(index >= 0, 'Only a real singleton Nexus card can move to this pure hand');
  cards.deck.splice(index, 1); cards.hands[actor] = face; validateNexusCards(cards, g.players);
}
function wrapper(g: Game, frame: Frame) {
  const actor = owner(frame); assert.ok(actor);
  g.decision = { kind: 'nexusFremenRideBetrayal', player: actor, event: frame.event };
}
function open(g: Game, parent: Parent = nativeParent): Frame {
  g.decision = structuredClone(parent);
  const frame = create(g, parent, EVENT); assert.ok(frame); return frame;
}
function maker(g: Game): Parent {
  g.greatMaker = { arrival: null, event: 'original-maker-encounter', turn: g.turn, pile: 0, index: 0,
    territory: null, stage: 'ride', order: [...g.order],
    votes: g.order.map(player => ({ player, yes: true })), ridesBefore: [], signature: '' };
  g.greatMaker.signature = greatMakerSignature(g.greatMaker);
  return { kind: 'greatMakerRide', player: 'fremen', event: g.greatMaker.event };
}
function resign(frame: Frame): void {
  frame.signature = JSON.stringify(['nexusFremenRideBetrayal', frame.event, frame.turn,
    [frame.source.kind, frame.source.player, frame.source.kind === 'wormRide' ? frame.source.territory : frame.source.event],
    frame.stage, frame.order, frame.passed, frame.usedBy]);
}

for (const advanced of [false, true]) {
  const band = advanced ? 'Advanced' : 'Basic';
  void test(`${band} before-ride Betrayal uses public Nexus backs and original storm order without moving anything`, () => {
    const g = position(advanced), before = structuredClone(g), frame = open(g);
    assert.deepEqual(frame.order, ['emperor', 'atreides']); assert.deepEqual(frame.passed, []);
    assert.equal(owner(frame), 'emperor'); assert.equal(frame.stage, 'choose'); assert.equal(frame.usedBy, null);
    assert.deepEqual(frame.source, nativeParent); assert.equal(frame.event, EVENT); validate(g, frame);
    assert.deepEqual(g, before); assert.notStrictEqual(frame.source, g.decision);
    const hidden = structuredClone(g);
    give(hidden, 'emperor', 'ixians'); give(hidden, 'atreides', 'harkonnen');
    const other = create(hidden, nativeParent, EVENT); assert.deepEqual(other, frame, 'Different hidden faces cannot change the public pause');
    give(hidden, 'guild', 'fremen');
    assert.deepEqual(create(hidden, nativeParent, EVENT)!.order, ['emperor', 'atreides', 'guild']);
  });

  void test(`${band} every original acknowledgement passes once and returns the exact source decision`, () => {
    const g = position(advanced); let frame = open(g); const before = structuredClone(g);
    wrapper(g, frame); validate(g, frame);
    frame = pass(g, frame, 'emperor', EVENT); assert.equal(owner(frame), 'atreides');
    assert.deepEqual(frame.passed, ['emperor']); wrapper(g, frame); validate(g, frame);
    frame = pass(g, frame, 'atreides', EVENT);
    assert.equal(frame.stage, 'complete'); assert.equal(owner(frame), null); assert.equal(frame.usedBy, null);
    assert.deepEqual(frame.passed, frame.order); assert.deepEqual(frame.source, before.decision);
    g.decision = structuredClone(frame.source); validate(g, frame);
    assert.deepEqual(g, before, 'All-pass bookkeeping does not replay payment, spice, destruction or a ride');
    assert.throws(() => pass(g, frame, 'atreides', EVENT), FremenRideBetrayalError);
    const saved: Frame = JSON.parse(JSON.stringify(frame)); validate(g, saved); assert.deepEqual(saved.source, nativeParent);
  });

  void test(`${band} a current responder completes Use before the engine spends its actual Fremen card`, () => {
    const g = position(advanced), frame = open(g); wrapper(g, frame);
    const before = structuredClone(g), used = use(g, frame, 'emperor', EVENT);
    assert.equal(used.stage, 'complete'); assert.equal(used.usedBy, 'emperor'); assert.deepEqual(used.passed, []);
    assert.equal(owner(used), null); assert.deepEqual(g, before, 'The pure wrapper spends no card and changes no physical state');
    assert.equal(g.nexusCards!.cards!.hands.emperor, 'fremen');
    g.nexusCards!.cards = discardNexusCard(g.nexusCards!.cards!, 'emperor', g.players);
    g.players.find(p => p.id === 'fremen')!.fremenNexusWormBlockedTurn = g.turn;
    g.decision = null; g.wormRides = []; validate(g, used);
    assert.equal(g.nexusCards!.cards!.discard.filter(card => card === 'fremen').length, 1);
    assert.throws(() => use(g, used, 'emperor', EVENT), FremenRideBetrayalError);
  });
}

void test('only unallied non-Fremen seats with a publicly present Nexus back participate', () => {
  const g = position(); give(g, 'guild', 'ecaz');
  g.players.find(p => p.id === 'emperor')!.ally = 'guild';
  g.players.find(p => p.id === 'guild')!.ally = 'emperor';
  assert.deepEqual(open(g).order, ['atreides']);
  const none = position();
  none.nexusCards!.cards = discardNexusCard(none.nexusCards!.cards!, 'atreides', none.players);
  // Fremen can hold an irrelevant physical card, but is not a Betrayal responder.
  give(none, 'fremen', 'tleilaxu');
  none.nexusCards!.cards!.deck.push(none.nexusCards!.cards!.hands.emperor!);
  none.nexusCards!.cards!.hands.emperor = null;
  validateNexusCards(none.nexusCards!.cards!, none.players);
  assert.equal(create(none, nativeParent, EVENT), null);
});

void test('public Fremen discard, an earlier prevention marker or unsupported profile creates no pointless pause', () => {
  const discarded = position();
  discarded.nexusCards!.cards = discardNexusCard(discarded.nexusCards!.cards!, 'emperor', discarded.players);
  assert.equal(create(discarded, nativeParent, EVENT), null);
  const blocked = position(); blocked.players.find(p => p.id === 'fremen')!.fremenNexusWormBlockedTurn = blocked.turn;
  assert.equal(create(blocked, nativeParent, EVENT), null);
  const wrongPhase = position(); wrongPhase.phase = 5; assert.equal(create(wrongPhase, nativeParent, EVENT), null);
  const unsupported = position(); unsupported.strongholdCards = { owners: {
    arrakeen: null, carthag: null, habbanya_ridge_sietch: null, sietch_tabr: null, tueks_sietch: null,
    hidden_mobile_stronghold: null,
  }, claimedTurn: 0 };
  assert.equal(create(unsupported, nativeParent, EVENT), null, 'Basic Strongholds are outside the existing native profile');
});

void test('current actor, exact event, ordered prefix and published wrapper identity remain authoritative', () => {
  const g = position(), frame = open(g); wrapper(g, frame); const before = structuredClone(g);
  assert.throws(() => pass(g, frame, 'atreides', EVENT), FremenRideBetrayalError);
  assert.throws(() => use(g, frame, 'fremen', EVENT), FremenRideBetrayalError);
  assert.throws(() => pass(g, frame, 'emperor', 'stale-event'), FremenRideBetrayalError);
  const advanced = pass(g, frame, 'emperor', EVENT);
  assert.throws(() => validate(g, advanced), FremenRideBetrayalError, 'Old wrapper owner cannot own the next acknowledgement');
  wrapper(g, advanced); validate(g, advanced);
  const wrong = structuredClone(frame); wrong.passed = ['atreides']; resign(wrong);
  assert.throws(() => validate(g, wrong), FremenRideBetrayalError);
  assert.deepEqual(g.players, before.players); assert.deepEqual(g.nexusCards, before.nexusCards);
});

void test('creation and active validation bind the actual ordinary source after it has left the pending ride queue', () => {
  const g = position(); assert.equal(g.wormRides.includes('hagga_basin'), false);
  const frame = open(g); wrapper(g, frame); validate(g, frame);
  const foreign = structuredClone(g); foreign.decision = { ...nativeParent, player: 'atreides' };
  assert.throws(() => create(foreign, foreign.decision as Parent, EVENT), FremenRideBetrayalError);
  const empty = structuredClone(g); empty.players.find(p => p.id === 'fremen')!.forces = {};
  assert.throws(() => validate(empty, frame), FremenRideBetrayalError);
  const storm = structuredClone(g); storm.storm = 13; assert.throws(() => validate(storm, frame), FremenRideBetrayalError);
  const cleared = structuredClone(g); cleared.decision = null;
  assert.throws(() => validate(cleared, frame), FremenRideBetrayalError);
  const other = structuredClone(frame); other.source = { ...nativeParent, territory: 'oh_gap' };
  assert.throws(() => validate(g, other), FremenRideBetrayalError);
});

void test('an actual Great Maker ride frame retains its event, native reserve source and completed votes', () => {
  const g = position(true), parent = maker(g), frame = open(g, parent), before = structuredClone(g.greatMaker);
  wrapper(g, frame); validate(g, frame);
  const passed = pass(g, frame, 'emperor', EVENT); wrapper(g, passed);
  const completed = pass(g, passed, 'atreides', EVENT);
  assert.deepEqual(completed.source, parent); assert.deepEqual(g.greatMaker, before);
  const stale = structuredClone(g); stale.greatMaker!.stage = 'complete';
  assert.throws(() => validate(stale, passed), FremenRideBetrayalError);
  const other = structuredClone(g); other.greatMaker!.event = 'different-maker';
  assert.throws(() => validate(other, passed), FremenRideBetrayalError);
  const empty = structuredClone(g); empty.players.find(p => p.id === 'fremen')!.reserves = 0;
  assert.throws(() => validate(empty, passed), FremenRideBetrayalError);
});

void test('valid pending Cunning already exposes the sole Fremen card in discard and skips the neutral window', () => {
  const g = position();
  // Conserved pure producer input: its original Cunning cost is already spent,
  // so no opposing seat can simultaneously hold a second Fremen card.
  give(g, 'emperor', 'ecaz'); give(g, 'fremen', 'fremen');
  g.nexusCards!.cards = discardNexusCard(g.nexusCards!.cards!, 'fremen', g.players);
  const occurrence = { event: 'original-cunning-appearance', turn: g.turn, territory: 'oh_gap',
    origin: 'natural' as const, pile: 0 as const, initiallyEmpty: true };
  const authorization = { event: occurrence.event, turn: g.turn, owner: 'fremen' };
  g.nexusFremenCunningRides = [{ occurrence, authorization, stage: 'select' }];
  const parent: Parent = { kind: 'nexusFremenCunningRide', player: 'fremen', event: occurrence.event };
  g.decision = parent;
  assert.ok(quoteFremenCunningRide(g, 'fremen', occurrence, authorization));
  assert.equal(create(g, parent, EVENT), null); validateNexusCards(g.nexusCards!.cards!, g.players);
  assert.equal(g.nexusCards!.cards!.discard.filter(card => card === 'fremen').length, 1);
});

void test('changed public order, lost Nexus back, alliance or turn cannot continue an old active acknowledgement', () => {
  const g = position(), frame = open(g); wrapper(g, frame);
  const reordered = structuredClone(g); reordered.order.reverse();
  assert.throws(() => validate(reordered, frame), FremenRideBetrayalError);
  const absent = structuredClone(g);
  absent.nexusCards!.cards = discardNexusCard(absent.nexusCards!.cards!, 'atreides', absent.players);
  assert.throws(() => validate(absent, frame), FremenRideBetrayalError);
  const allied = structuredClone(g); allied.players.find(p => p.id === 'atreides')!.ally = 'guild';
  allied.players.find(p => p.id === 'guild')!.ally = 'atreides';
  assert.throws(() => validate(allied, frame), FremenRideBetrayalError);
  const later = structuredClone(g); later.turn++; assert.throws(() => validate(later, frame), FremenRideBetrayalError);
});

void test('signed completed progress is detached from later native physical continuation', () => {
  const g = position(), frame = open(g); wrapper(g, frame);
  const completed = use(g, frame, 'emperor', EVENT), saved: Frame = JSON.parse(JSON.stringify(completed));
  g.nexusCards!.cards = discardNexusCard(g.nexusCards!.cards!, 'emperor', g.players);
  g.decision = null; g.phase = 2; g.wormRides = []; g.turn++;
  validate(g, saved); assert.equal(owner(saved), null); assert.deepEqual(saved.source, nativeParent);
  const changed = structuredClone(saved); changed.source = { ...nativeParent, territory: 'oh_gap' };
  assert.throws(() => validate(g, changed), FremenRideBetrayalError);
});
