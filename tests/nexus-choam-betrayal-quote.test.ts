import test from 'node:test';
import assert from 'node:assert/strict';
import type { Card } from '../game/cards';
import type { Game } from '../game/engine';
import {
  nexusChoamBetrayalSignature, quoteNexusChoamBetrayal,
  validateNexusChoamBetrayal, type NexusChoamBetrayal,
} from '../game/nexus-choam-betrayal';
import { nexusTraitorFixture } from './fixture-nexus-traitors';
import { nexusReload } from './fixture-nexus-cards';

function position(phase = 5) {
  const g = nexusTraitorFixture({ ownerFaction: 'atreides', opponentFaction: 'choam', phase });
  const owner = g.players[0].id, target = g.players[1].id;
  const cards = g.nexusCards!.cards!;
  const index = cards.deck.indexOf('choam');
  assert.ok(index >= 0);
  cards.deck[index] = cards.hands[owner]!;
  cards.hands[owner] = 'choam';
  const selected = g.deck.splice(0, 2);
  assert.equal(selected.length, 2);
  g.players[1].hand.push(...selected);
  return { g, owner, target, selected };
}

void test('outside Bidding, a CHOAM Betrayal offer reads neither hidden hand count nor identities', () => {
  const { g, owner, target, selected } = position();
  const offer = quoteNexusChoamBetrayal(g, owner)!;
  assert.deepEqual(offer.target, { id: target, name: g.players[1].name, handSize: null });
  assert.equal(offer.blocked, null);
  assert.deepEqual(JSON.parse(offer.event), ['nexusChoamBetrayal', g.turn, g.phase, owner, target]);
  for (const card of selected) assert.ok(!JSON.stringify(offer).includes(card.id));
  for (const count of [0, 1, 3]) {
    const alternate = nexusReload(g);
    alternate.deck.push(...alternate.players[1].hand.splice(0));
    alternate.players[1].hand.push(...alternate.deck.splice(0, count));
    assert.deepEqual(quoteNexusChoamBetrayal(alternate, owner), offer);
  }
  g.players[1].hand = new Proxy(g.players[1].hand, {
    get() { throw new Error('Private CHOAM hand was read'); },
  });
  assert.deepEqual(quoteNexusChoamBetrayal(g, owner), offer);
  const bidding = position(3);
  assert.equal(quoteNexusChoamBetrayal(bidding.g, bidding.owner)!.target.handSize, 2);
  bidding.g.deck.push(...bidding.g.players[1].hand.splice(0));
  assert.match(quoteNexusChoamBetrayal(bidding.g, bidding.owner)!.blocked!, /no Treachery/);
});

void test('the same clean boundary is available across printed phases, but not through live interactions', () => {
  for (const phase of [0, 2, 5, 7, 8]) {
    const { g, owner } = position(phase);
    assert.equal(quoteNexusChoamBetrayal(g, owner)!.blocked, null);
    assert.match(quoteNexusChoamBetrayal(g, owner, true)!.blocked!, /current interaction/);
  }
  const { g, owner, target } = position();
  for (const change of [
    (copy: Game) => { copy.response = { kind: 'card' } as never; },
    (copy: Game) => { copy.decision = { kind: 'guildTiming' } as never; },
    (copy: Game) => { copy.pendingTreacheryDiscard = { sequence: 1 } as never; },
    (copy: Game) => { copy.nexusCards!.phase = { stage: 'drawing' } as never; },
    (copy: Game) => { copy.battle = { event: 'ongoing' } as never; },
    (copy: Game) => { copy.pendingExchange = { response: null, decision: null }; },
  ]) {
    const copy = nexusReload(g); change(copy);
    assert.match(quoteNexusChoamBetrayal(copy, owner)!.blocked!, /current interaction/);
  }
  const empty = nexusReload(g);
  empty.deck.push(...empty.players[1].hand.splice(0));
  assert.equal(quoteNexusChoamBetrayal(empty, owner)!.blocked, null);
  const allied = nexusReload(g);
  allied.players[0].ally = allied.players[2].id;
  allied.players[2].ally = owner;
  assert.match(quoteNexusChoamBetrayal(allied, owner)!.blocked!, /unallied/);
  assert.equal(quoteNexusChoamBetrayal(g, target), null);
  assert.equal(quoteNexusChoamBetrayal(g, 'foreign'), null);
  const noCard = nexusReload(g);
  noCard.nexusCards!.cards!.hands[owner] = null;
  assert.equal(quoteNexusChoamBetrayal(noCard, owner), null);
  const absent = nexusReload(g);
  absent.players[1].faction = 'guild';
  assert.equal(quoteNexusChoamBetrayal(absent, owner), null);
});

void test('signed sampled-card receipt validates after discard and JSON reload without future hand custody', () => {
  const { g, owner, target, selected } = position();
  const offer = quoteNexusChoamBetrayal(g, owner)!;
  const record: NexusChoamBetrayal = {
    event: offer.event, turn: g.turn, phase: g.phase, owner, target,
    card: selected[0].id, handBefore: 2, stage: 'discard', signature: '',
  };
  record.signature = nexusChoamBetrayalSignature(record);
  const physical = [...g.deck, ...g.players.flatMap(player => player.hand), ...g.discard];
  assert.doesNotThrow(() => validateNexusChoamBetrayal(g, record, physical));
  const spent = nexusReload(g);
  spent.nexusCards!.cards!.hands[owner] = null;
  spent.nexusCards!.cards!.discard.push('choam');
  const discarded = spent.players[1].hand.shift()!;
  spent.discard.push(discarded);
  spent.players[1].hand.push(spent.deck.shift()!);
  const restored = nexusReload(spent), receipt = JSON.parse(JSON.stringify(record)) as NexusChoamBetrayal;
  assert.doesNotThrow(() => validateNexusChoamBetrayal(restored, receipt,
    [...restored.deck, ...restored.discard, ...restored.players.flatMap(player => player.hand)]));
  receipt.stage = 'complete'; receipt.signature = nexusChoamBetrayalSignature(receipt);
  restored.turn++;
  assert.doesNotThrow(() => validateNexusChoamBetrayal(restored, receipt,
    [...restored.deck, ...restored.discard, ...restored.players.flatMap(player => player.hand)]));
  assert.equal(restored.players[1].hand.length, record.handBefore);
});

void test('malformed, stale or forged source/selection receipts cannot become historical evidence', () => {
  const { g, owner, target, selected } = position();
  const event = quoteNexusChoamBetrayal(g, owner)!.event;
  const receipt: NexusChoamBetrayal = {
    event, turn: g.turn, phase: g.phase, owner, target, card: selected[0].id,
    handBefore: 2, stage: 'discard', signature: '',
  };
  receipt.signature = nexusChoamBetrayalSignature(receipt);
  const physical = [...g.deck, ...g.players.flatMap(player => player.hand), ...g.discard];
  const invalid = (patch: Partial<NexusChoamBetrayal>, cards: readonly Card[] = physical) =>
    assert.throws(() => validateNexusChoamBetrayal(g, { ...receipt, ...patch }, cards));
  invalid({ event: 'forged' });
  invalid({ card: selected[1].id });
  invalid({ owner: target });
  invalid({ target: g.players[2].id });
  invalid({ phase: receipt.phase + 1 });
  invalid({ turn: receipt.turn + 1 });
  invalid({ handBefore: 1 });
  invalid({ handBefore: 0 });
  invalid({ handBefore: Number.MAX_SAFE_INTEGER + 1 });
  invalid({ stage: 'pending' as never });
  invalid({ card: 'invented', signature: nexusChoamBetrayalSignature({ ...receipt, card: 'invented' }) });
  invalid({}, physical.filter(card => card.id !== receipt.card));
  invalid({}, [...physical, selected[0]]);
  invalid({ extra: 'hidden' } as never);
  const changedRoster = nexusReload(g);
  changedRoster.players[1].faction = 'guild';
  assert.throws(() => validateNexusChoamBetrayal(changedRoster, receipt, physical));
  const foreignOwner = nexusReload(g);
  foreignOwner.players[0].faction = 'choam';
  assert.throws(() => validateNexusChoamBetrayal(foreignOwner, receipt, physical));
  const future = nexusReload(g);
  future.phase = 2;
  assert.throws(() => validateNexusChoamBetrayal(future, receipt, physical));
});
