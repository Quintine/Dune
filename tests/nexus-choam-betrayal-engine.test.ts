import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, normalizeAutomaticGame, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { drawNexusCard } from '../game/nexus-cards';
import { nexusChoamBetrayalAction } from '../game/nexus-choam-betrayal-options';
import { nexusChoamBetrayalSignature } from '../game/nexus-choam-betrayal';
import { nexusTraitorFixture, nexusTraitorInventory } from './fixture-nexus-traitors';

function position(advanced = false, phase = 2) {
  const g = nexusTraitorFixture({ ownerFaction: 'atreides', opponentFaction: 'choam', advanced, phase });
  const owner = 'p', target = 'q', observer = 'r';
  const cards = g.nexusCards!.cards!;
  const index = cards.deck.indexOf('choam');
  assert.ok(index >= 0);
  cards.deck[index] = cards.hands[owner]!;
  cards.hands[owner] = 'choam';
  const victim = g.players.find(player => player.id === target)!;
  victim.hand.push(...g.deck.splice(0, 3));
  nexusTraitorInventory(g);
  const action = nexusChoamBetrayalAction(viewGame(g, owner));
  assert.ok(action);
  return { g, owner, target, observer, action };
}

function reload(g: Game): Game {
  return JSON.parse(JSON.stringify(g)) as Game;
}

function reject(g: Game, owner: string, action: { type: string; [key: string]: unknown }) {
  const before = reload(g);
  assert.throws(() => applyAction(g, owner, action));
  assert.deepEqual(g, before);
}

void test('CHOAM Betrayal spends one Nexus card and randomly discards one actual held card without spice in Basic and Advanced', () => {
  for (const advanced of [false, true]) {
    const { g, owner, target, observer, action } = position(advanced);
    const before = reload(g);
    const beforeLog = g.log.length;
    const done = applyAction(g, owner, action);
    assert.deepEqual(g, before);
    const victim = done.players.find(player => player.id === target)!;
    const original = before.players.find(player => player.id === target)!;
    const removed = original.hand.filter(card => !victim.hand.some(held => held.id === card.id));
    assert.equal(removed.length, 1);
    assert.deepEqual(victim.hand, original.hand.filter(card => card.id !== removed[0].id));
    assert.equal(done.discard.filter(card => card.id === removed[0].id).length, 1);
    assert.equal(victim.spice, original.spice);
    assert.equal(done.nexusCards!.cards!.hands[owner], null);
    assert.equal(done.nexusCards!.cards!.discard.filter(card => card === 'choam').length, 1);
    assert.equal(done.nexusChoamBetrayals?.at(-1)?.stage, 'complete');
    assert.equal(done.nexusChoamBetrayals?.at(-1)?.card, removed[0].id);
    assert.equal(done.pendingTreacheryDiscard, null);
    assert.equal(done.log.slice(beforeLog).some(row => row.text.includes(removed[0].name)), false);
    assert.equal(viewGame(done, observer).nexusChoamBetrayal, null);
    assert.equal(Object.hasOwn(viewGame(done, observer), 'nexusChoamBetrayals'), false);
    nexusTraitorInventory(done);
    reject(done, owner, action);
    assert.deepEqual(normalizeAutomaticGame(reload(done)), done);
  }
});

void test('CHOAM Betrayal hides non-Bidding hand count; all bot levels take a legal action during public-count Bidding', () => {
  const { g, owner, target, observer } = position();
  const offer = viewGame(g, owner).nexusChoamBetrayal!;
  assert.equal(offer.blocked, null);
  assert.equal(offer.target.id, target);
  assert.equal(offer.target.handSize, null);
  assert.equal(viewGame(g, target).nexusChoamBetrayal, null);
  assert.equal(viewGame(g, observer).nexusChoamBetrayal, null);
  for (const card of g.players.find(player => player.id === target)!.hand)
    assert.equal(JSON.stringify(offer).includes(card.id), false);
  const publicCount = position(false, 3);
  const biddingOffer = viewGame(publicCount.g, owner).nexusChoamBetrayal!;
  assert.equal(biddingOffer.target.handSize, publicCount.g.players.find(player => player.id === target)!.hand.length);
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = viewGame(publicCount.g, owner);
    view.players.find(player => player.id === owner)!.bot = difficulty;
    assert.deepEqual(botActions(view)[0], publicCount.action);
  }
  const botPlayed = applyAction(publicCount.g, owner, publicCount.action);
  assert.equal(botPlayed.nexusChoamBetrayals?.at(-1)?.stage, 'complete');
  nexusTraitorInventory(botPlayed);
});

void test('CHOAM Betrayal rejects forged, stale, foreign and interrupted plays without spending the card', () => {
  const { g, owner, target, observer, action } = position();
  reject(g, target, action);
  reject(g, observer, action);
  reject(g, owner, { ...action, event: 'stale' });
  reject(g, owner, { ...action, card: 'forged' });
  const pending = reload(g);
  pending.decision = { kind: 'choamMarket', player: target };
  assert.ok(viewGame(pending, owner).nexusChoamBetrayal?.blocked);
  reject(pending, owner, action);
  const empty = reload(g);
  empty.deck.push(...empty.players.find(player => player.id === target)!.hand.splice(0));
  assert.equal(viewGame(empty, owner).nexusChoamBetrayal?.blocked, null);
  reject(empty, owner, action);
  assert.equal(g.nexusCards!.cards!.hands[owner], 'choam');
});

void test('a committed random discard resumes exactly once after JSON restore and rejects damaged saved proof', () => {
  const { g, owner, target, action } = position();
  const done = applyAction(g, owner, action);
  const paused = reload(done), record = paused.nexusChoamBetrayals!.at(-1)!;
  record.stage = 'discard'; record.signature = nexusChoamBetrayalSignature(record);
  paused.nexusChoamBetrayalLast = { event: record.event, stage: record.stage };
  const sequence = paused.treacheryDiscardSequence!;
  paused.resolvedTreacheryDiscardSequence = sequence - 1;
  paused.pendingTreacheryDiscard = {
    sequence,
    batch: {
      event: `discard:${paused.turn}:${paused.phase}:${sequence}`,
      turn: paused.turn,
      phase: paused.phase,
      cause: 'nexus:choamBetrayal',
      entries: [{ card: structuredClone(paused.discard.find(card => card.id === record.card)!), discardedBy: target, publicFace: false }],
    },
    continuation: { kind: 'nexusChoamBetrayal', event: record.event, owner, target, card: record.card, handBefore: record.handBefore },
  };
  assert.equal(viewGame(paused, owner).automaticContinuationPending, true);
  assert.deepEqual(normalizeAutomaticGame(reload(paused)), done);
  reject(paused, owner, action);
  for (const damage of [
    (state: Game) => { state.nexusChoamBetrayals![0].card = 'forged'; },
    (state: Game) => { state.pendingTreacheryDiscard!.continuation = { kind: 'nexusChoamBetrayal', event: record.event, owner, target, card: 'forged', handBefore: record.handBefore }; },
    (state: Game) => { state.pendingTreacheryDiscard = null; state.resolvedTreacheryDiscardSequence = sequence; },
  ]) {
    const bad = reload(paused); damage(bad); const before = reload(bad);
    assert.throws(() => viewGame(bad, owner));
    assert.deepEqual(bad, before);
  }
});

void test('a completed Betrayal remains valid when its Nexus discard is recycled by a later draw in the same turn', () => {
  const { g, owner, action } = position(false, 0);
  const done = applyAction(g, owner, action);
  const recycled = reload(done), cards = recycled.nexusCards!.cards!;
  cards.discard.push(...cards.deck.splice(0));
  recycled.nexusCards!.cards = drawNexusCard(cards, owner, recycled.players, () => 0);
  assert.equal(recycled.nexusCards!.cards!.discard.includes('choam'), false);
  nexusTraitorInventory(recycled);
  assert.doesNotThrow(() => viewGame(recycled, owner));
  assert.deepEqual(normalizeAutomaticGame(reload(recycled)), recycled);
});
