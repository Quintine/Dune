import assert from 'node:assert/strict';
import test from 'node:test';
import type { Game } from '../game/engine';
import { acquireDuke, createDukeVidal, expireDuke } from '../game/duke-vidal';
import { createNexusCards, discardNexusCard } from '../game/nexus-cards';
import {
  createNexusEcazDukeReceipt,
  nexusEcazDukeEvent,
  nexusEcazDukeSignature,
  quoteNexusEcazDuke,
  validateNexusEcazDuke,
  type NexusEcazDukeReceipt,
} from '../game/nexus-ecaz-duke';

function game(advanced = false): Game {
  const players = [
    { id: 'ecaz-seat', faction: 'ecaz' as const, ally: null },
    { id: 'moritani-seat', faction: 'moritani' as const, ally: null },
    { id: 'atreides-seat', faction: 'atreides' as const, ally: null },
  ];
  const cards = createNexusCards(players, () => 0.5);
  cards.deck.splice(cards.deck.indexOf('ecaz'), 1);
  cards.hands['ecaz-seat'] = 'ecaz';
  return {
    players, advanced, expansions: [], nexusCards: { cards, phase: null },
    status: 'playing', phase: 6, turn: 3, dukeVidal: createDukeVidal(),
  } as unknown as Game;
}

void test('native physical Ecaz Cunning overrides Moritani at a quiet Battle boundary', () => {
  const g = game(true);
  g.dukeVidal = acquireDuke(g.dukeVidal!, 'moritani-seat', 3, 'moritani');
  const offer = quoteNexusEcazDuke(g, 'ecaz-seat');
  assert.deepEqual(offer, {
    event: nexusEcazDukeEvent(3, 6, 'ecaz-seat', 0, 'moritani-seat', 3),
    blocked: null, dukeController: 'moritani-seat',
  });
  assert.equal(quoteNexusEcazDuke(g, 'moritani-seat'), null);
  const record = createNexusEcazDukeReceipt(g, 'ecaz-seat');
  assert.equal(record.before.source, 'moritani');
  assert.deepEqual(record.after, {
    controller: 'ecaz-seat', acquiredTurn: 3, source: 'ecazNexus',
  });
  g.dukeVidal = acquireDuke(g.dukeVidal!, 'ecaz-seat', g.turn, 'ecazNexus');
  g.nexusCards!.cards = discardNexusCard(g.nexusCards!.cards!, 'ecaz-seat', g.players);
  g.nexusEcazDukeHistory = [record];
  g.nexusEcazDukeEvents = [record.event];
  assert.equal(g.nexusCards!.cards!.hands['ecaz-seat'], null);
  assert.deepEqual(JSON.parse(JSON.stringify(record)), record);
  assert.equal(nexusEcazDukeSignature(JSON.parse(JSON.stringify(record))), record.signature);
  assert.doesNotThrow(() => validateNexusEcazDuke(g, JSON.parse(JSON.stringify(record)), 0));
  // Completed history does not need the original custody or the spent card to remain current.
  g.dukeVidal = expireDuke(g.dukeVidal!, 3);
  assert.equal(g.dukeVidal.controller, null);
  assert.equal(g.dukeVidal.source, null);
  g.turn = 4;
  g.phase = 1;
  assert.doesNotThrow(() => validateNexusEcazDuke(g, record, 0));
});

void test('unclaimed Duke creates a null-safe public event and historical receipt', () => {
  const g = game();
  const offer = quoteNexusEcazDuke(g, 'ecaz-seat');
  assert.deepEqual(offer, {
    event: nexusEcazDukeEvent(3, 6, 'ecaz-seat', 0, null, null),
    blocked: null, dukeController: null,
  });
  const receipt = createNexusEcazDukeReceipt(g, 'ecaz-seat');
  assert.deepEqual(receipt.before, {
    controller: null, acquiredTurn: null, source: null,
    leader: { id: 'duke-vidal', dead: false, capturedBy: null, gholaBy: null },
  });
  assert.doesNotThrow(() => validateNexusEcazDuke(g, receipt, 0));
  assert.equal(receipt.signature, nexusEcazDukeSignature(JSON.parse(JSON.stringify(receipt))));
});

void test('ordinary Ecaz Ambassador custody survives end turn; Nexus custody does not', () => {
  const g = game();
  const ordinary = acquireDuke(g.dukeVidal!, 'ecaz-seat', 3, 'ecaz');
  assert.equal(expireDuke(ordinary, 3).controller, 'ecaz-seat');
  assert.equal(expireDuke(ordinary, 4).source, 'ecaz');
  assert.equal(quoteNexusEcazDuke({ ...g, dukeVidal: ordinary }, 'ecaz-seat')?.blocked,
    'Ecaz already controls Duke Vidal.');
  const moritani = acquireDuke(ordinary, 'moritani-seat', 3, 'moritani');
  const nexus = acquireDuke(moritani, 'ecaz-seat', 3, 'ecazNexus');
  assert.equal(expireDuke(nexus, 2).source, 'ecazNexus');
  assert.equal(expireDuke(nexus, 3).controller, null);
  for (const property of ['dead', 'capturedBy', 'gholaBy'] as const) {
    const unavailable = structuredClone(nexus);
    if (property === 'dead') unavailable.leader.dead = true;
    else unavailable.leader[property] = 'moritani-seat';
    assert.throws(() => acquireDuke(unavailable, 'ecaz-seat', 3, 'ecazNexus'));
    assert.match(quoteNexusEcazDuke({ ...g, dukeVidal: unavailable }, 'ecaz-seat')!.blocked!,
      /living, uncaptured, non-Ghola/);
  }
});

void test('native owner sees explicit blocks; no card identity leaks to other seats', () => {
  const g = game();
  assert.equal(quoteNexusEcazDuke(g, 'moritani-seat'), null);
  assert.match(quoteNexusEcazDuke({ ...g, phase: 5 }, 'ecaz-seat')!.blocked!, /Battle phase/);
  assert.match(quoteNexusEcazDuke({ ...g, battle: {} as Game['battle'] }, 'ecaz-seat')!.blocked!,
    /current interaction/);
  assert.match(quoteNexusEcazDuke(g, 'ecaz-seat', true)!.blocked!, /current interaction/);
  assert.match(quoteNexusEcazDuke({ ...g, homeworlds: { custody: null } }, 'ecaz-seat')!.blocked!,
    /Nexus alone/);
  assert.match(quoteNexusEcazDuke({ ...g, players: g.players.slice(0, 2) }, 'ecaz-seat')!.blocked!,
    /paired Ecaz and Moritani/);
  assert.match(quoteNexusEcazDuke({
    ...g, players: [...g.players, { ...g.players[2], id: 'ixians-seat', faction: 'ixians' }],
  }, 'ecaz-seat')!.blocked!, /Nexus alone/);
  const harkonnen = {
    ...g, advanced: true,
    players: [...g.players.slice(0, 2),
      { ...g.players[2], faction: 'harkonnen' as const }],
  };
  assert.match(quoteNexusEcazDuke(harkonnen, 'ecaz-seat')!.blocked!,
    /Advanced Harkonnen/);
  assert.equal(quoteNexusEcazDuke({ ...harkonnen, advanced: false }, 'ecaz-seat')!.blocked,
    null);
  assert.match(quoteNexusEcazDuke({ ...g, sandtrout: true }, 'ecaz-seat')!.blocked!,
    /Nexus alone/);
  const allied = structuredClone(g);
  allied.players[0].ally = allied.players[1].id;
  assert.match(quoteNexusEcazDuke(allied, 'ecaz-seat')!.blocked!, /unallied/);
});

void test('damaged and re-signed impossible history cannot forge the original Duke or seated mode', () => {
  const g = game();
  g.dukeVidal = acquireDuke(g.dukeVidal!, 'moritani-seat', 3, 'moritani');
  const original = createNexusEcazDukeReceipt(g, 'ecaz-seat');
  const invalid = (change: (record: NexusEcazDukeReceipt) => void) => {
    const record = structuredClone(original);
    change(record);
    assert.throws(() => validateNexusEcazDuke(g, record, 0));
    record.signature = nexusEcazDukeSignature(record);
    assert.throws(() => validateNexusEcazDuke(g, record, 0));
  };
  invalid(record => { record.before.leader.dead = true as never; });
  invalid(record => { record.before.leader.capturedBy = 'moritani-seat' as never; });
  invalid(record => { record.before.leader.gholaBy = 'ecaz-seat' as never; });
  invalid(record => { record.before.controller = 'outsider'; });
  invalid(record => { record.before.acquiredTurn = 4; });
  invalid(record => { record.before.acquiredTurn = 2; });
  invalid(record => { record.before.source = null; });
  invalid(record => { record.before.source = 'ecaz'; });
  invalid(record => {
    record.before.acquiredTurn = 2;
    record.event = nexusEcazDukeEvent(3, 6, 'ecaz-seat', 0, 'moritani-seat', 2);
  });
  invalid(record => { record.after.controller = 'moritani-seat'; });
  invalid(record => { record.after.source = 'ecaz' as never; });
  invalid(record => { record.after.acquiredTurn = 2; });
  invalid(record => { record.owner = 'moritani-seat'; });
  invalid(record => { record.mode = 'betrayal' as never; });
  invalid(record => { record.roster = ['ecaz', 'ecaz']; });
  invalid(record => { record.advanced = true; });
  invalid(record => { record.turn = 4; });
  invalid(record => { record.phase = 5 as never; });
  invalid(record => { record.sequence = 1; });
  invalid(record => { record.event = nexusEcazDukeEvent(3, 6, 'ecaz-seat', 0, null, null); });
  invalid(record => { (record as NexusEcazDukeReceipt & { extra: boolean }).extra = true; });
  invalid(record => { record.before = { ...record.before, leader: { ...record.before.leader, id: 'other' as never } }; });
  assert.throws(() => validateNexusEcazDuke(g, null as never, 0));
  assert.throws(() => validateNexusEcazDuke({ ...g, phase: 5 }, original, 0));
  assert.throws(() => validateNexusEcazDuke({ ...g, nexusCards: null }, original, 0));
});
