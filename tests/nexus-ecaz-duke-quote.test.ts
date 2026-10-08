import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { acquireDuke, consumeDuke, createDukeVidal, expireDuke } from '../game/duke-vidal';
import { createNexusCards, discardNexusCard } from '../game/nexus-cards';
import {
  createNexusEcazDukeReceipt,
  nexusEcazDukeEvent,
  nexusEcazDukeSignature,
  quoteNexusEcazDuke,
  validateNexusEcazDuke,
  type NexusEcazDukeReceipt,
} from '../game/nexus-ecaz-duke';
import { nexusEcazDukePosition } from './fixture-nexus-ecaz-duke';
import { nexusTraitorInventory } from './fixture-nexus-traitors';

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
  // Completed history does not need the original custody or the spent card to remain current.
  g.dukeVidal = expireDuke(g.dukeVidal!, 3);
  assert.equal(g.dukeVidal.controller, null);
  assert.equal(g.dukeVidal.source, null);
  g.turn = 4;
  g.phase = 1;
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
  assert.equal(receipt.signature, nexusEcazDukeSignature(JSON.parse(JSON.stringify(receipt))));
});

void test('Ecaz Nexus alone revives the set-aside shared Duke and clears only his battle-use stamp', () => {
  for (const advanced of [false, true]) {
    const g = game(advanced);
    const tanked = g.dukeVidal!;
    tanked.leader.dead = true;
    tanked.leader.deaths = 3;
    tanked.leader.usedAt = 'carthag';
    const before = structuredClone(tanked);
    assert.deepEqual(quoteNexusEcazDuke(g, 'ecaz-seat'), {
      event: nexusEcazDukeEvent(3, 6, 'ecaz-seat', 0, null, null),
      blocked: null, dukeController: null,
    });
    for (const source of ['moritani', 'ecaz', 'ally'] as const)
      assert.throws(() => acquireDuke(tanked, 'ecaz-seat', 3, source), /Tanks/);
    const receipt = createNexusEcazDukeReceipt(g, 'ecaz-seat');
    assert.deepEqual(receipt.before, {
      controller: null, acquiredTurn: null, source: null,
      leader: { id: 'duke-vidal', dead: true, capturedBy: null, gholaBy: null },
    });
    assert.deepEqual(receipt.after, {
      controller: 'ecaz-seat', acquiredTurn: 3, source: 'ecazNexus',
    });
    const acquired = acquireDuke(tanked, 'ecaz-seat', 3, 'ecazNexus');
    const expectedLeader = { ...before.leader, dead: false };
    delete expectedLeader.usedAt;
    assert.deepEqual(acquired.leader, expectedLeader);
    assert.deepEqual(tanked, before);
    assert.notEqual(acquired.leader, tanked.leader);
    assert.deepEqual([acquired.controller, acquired.acquiredTurn, acquired.source],
      ['ecaz-seat', 3, 'ecazNexus']);
    g.dukeVidal = expireDuke(acquired, 3);
    g.turn = 4;
    g.phase = 1;
    validateNexusEcazDuke(g, JSON.parse(JSON.stringify(receipt)), 0);
    assert.equal(g.dukeVidal.controller, null);
    assert.equal(g.dukeVidal.leader.dead, false);
    assert.equal(g.dukeVidal.leader.deaths, 3);
    assert.equal(receipt.signature, nexusEcazDukeSignature(receipt));
  }
});

void test('native Basic and Advanced bots can spend actual Ecaz Nexus on a Tanked Duke', () => {
  for (const advanced of [false, true]) {
    for (const profile of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
      const { game: g } = nexusEcazDukePosition(advanced);
      // Explicit conserved Tanks position after genuine setup and physical Nexus draw.
      g.dukeVidal = consumeDuke(g.dukeVidal!);
      g.dukeVidal.leader.dead = true;
      g.dukeVidal.leader.deaths = 2;
      g.dukeVidal.leader.usedAt = 'carthag';
      g.players[0].bot = profile;
      const before = structuredClone(g);
      const view = viewGame(g, 'p');
      assert.equal(view.nexusEcazDuke?.blocked, null);
      assert.equal(viewGame(g, 'q').nexusEcazDuke, null);
      const action = botActions(view)[0];
      assert.deepEqual(action, { type: 'nexusEcazDuke', event: view.nexusEcazDuke!.event });
      const result = applyAction(g, 'p', action);
      assert.deepEqual(g, before);
      assert.equal(result.nexusCards!.cards!.hands.p, null);
      assert.equal(result.nexusCards!.cards!.discard.filter(card => card === 'ecaz').length, 1);
      assert.deepEqual([result.dukeVidal!.controller, result.dukeVidal!.source,
        result.dukeVidal!.acquiredTurn], ['p', 'ecazNexus', result.turn]);
      assert.equal(result.dukeVidal!.leader.id, before.dukeVidal!.leader.id);
      assert.equal(result.dukeVidal!.leader.dead, false);
      assert.equal(result.dukeVidal!.leader.deaths, 2);
      assert.equal(result.dukeVidal!.leader.usedAt, undefined);
      assert.equal(result.nexusEcazDukeHistory![0].before.leader.dead, true);
      assert.deepEqual(result.nexusEcazDukeEvents, [action.event]);
      assert.equal(result.players.flatMap(player => player.leaders)
        .some(leader => leader.id === 'duke-vidal'), false);
      assert.equal(viewGame(result, 'p').players.find(player => player.id === 'p')!.leaders
        .some(leader => leader.id === 'duke-vidal' && !leader.dead && !leader.usedAt), true);
      assert.deepEqual(result.players.map(player => [player.spice, player.reserves, player.leaders]),
        before.players.map(player => [player.spice, player.reserves, player.leaders]));
      nexusTraitorInventory(result);
      assert.throws(() => applyAction(result, 'p', action));
    }
  }
});

void test('living already-used Duke cannot gain a new battle use from Ecaz Cunning', () => {
  const g = game();
  g.dukeVidal!.leader.usedAt = 'carthag';
  g.dukeVidal!.leader.deaths = 2;
  const before = structuredClone(g.dukeVidal);
  assert.match(quoteNexusEcazDuke(g, 'ecaz-seat')!.blocked!, /already been used/);
  assert.throws(() => createNexusEcazDukeReceipt(g, 'ecaz-seat'), /already been used/);
  assert.throws(() => acquireDuke(g.dukeVidal!, 'ecaz-seat', 3, 'ecazNexus'), /already been used/);
  assert.deepEqual(g.dukeVidal, before);
  const ordinary = acquireDuke(g.dukeVidal!, 'moritani-seat', 3, 'moritani');
  assert.deepEqual(ordinary.leader, before!.leader);
});

void test('Tanked acquisition requires set-aside custody and never bypasses capture or Ghola', () => {
  const g = game();
  g.dukeVidal!.leader.dead = true;
  g.dukeVidal!.leader.deaths = 1;
  for (const change of [
    { controller: 'moritani-seat' },
    { acquiredTurn: 2 },
    { source: 'moritani' as const },
  ]) {
    const duke = { ...g.dukeVidal!, ...change };
    const before = structuredClone(duke);
    assert.match(quoteNexusEcazDuke({ ...g, dukeVidal: duke }, 'ecaz-seat')!.blocked!, /set aside/);
    assert.throws(() => acquireDuke(duke, 'ecaz-seat', 3, 'ecazNexus'), /set aside/);
    assert.deepEqual(duke, before);
  }
  for (const dead of [false, true]) {
    for (const custody of ['capturedBy', 'gholaBy'] as const) {
      const duke = structuredClone(g.dukeVidal!);
      duke.leader.dead = dead;
      duke.leader[custody] = 'moritani-seat';
      const before = structuredClone(duke);
      assert.match(quoteNexusEcazDuke({ ...g, dukeVidal: duke }, 'ecaz-seat')!.blocked!,
        /uncaptured, non-Ghola/);
      for (const source of ['moritani', 'ecaz', 'ecazNexus', 'ally'] as const)
        assert.throws(() => acquireDuke(duke, 'ecaz-seat', 3, source));
      assert.deepEqual(duke, before);
    }
  }
});

void test('dead receipts retain the old signature shape and reject non-set-aside Tanks history', () => {
  const g = game();
  g.dukeVidal!.leader.dead = true;
  g.dukeVidal!.leader.deaths = 2;
  const original = createNexusEcazDukeReceipt(g, 'ecaz-seat');
  validateNexusEcazDuke(g, original, 0);
  assert.equal(original.signature, nexusEcazDukeSignature(JSON.parse(JSON.stringify(original))));
  for (const change of [
    { controller: 'moritani-seat', acquiredTurn: 3, source: 'moritani' as const },
    { acquiredTurn: 2 },
    { source: 'ecaz' as const },
  ]) {
    const damaged = structuredClone(original);
    Object.assign(damaged.before, change);
    damaged.event = nexusEcazDukeEvent(damaged.turn, damaged.phase, damaged.owner,
      damaged.sequence, damaged.before.controller, damaged.before.acquiredTurn);
    damaged.signature = nexusEcazDukeSignature(damaged);
    assert.throws(() => validateNexusEcazDuke(g, damaged, 0));
  }
  const damaged = structuredClone(original);
  damaged.before.leader.dead = 'true' as never;
  damaged.signature = nexusEcazDukeSignature(damaged);
  assert.throws(() => validateNexusEcazDuke(g, damaged, 0));
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
  for (const property of ['capturedBy', 'gholaBy'] as const) {
    const unavailable = structuredClone(nexus);
    unavailable.leader[property] = 'moritani-seat';
    assert.throws(() => acquireDuke(unavailable, 'ecaz-seat', 3, 'ecazNexus'));
    assert.match(quoteNexusEcazDuke({ ...g, dukeVidal: unavailable }, 'ecaz-seat')!.blocked!,
      /uncaptured, non-Ghola/);
  }
});

void test('native owner sees explicit blocks; no card identity leaks to other seats', () => {
  const g = game();
  assert.equal(quoteNexusEcazDuke(g, 'moritani-seat'), null);
  assert.match(quoteNexusEcazDuke({ ...g, phase: 5 }, 'ecaz-seat')!.blocked!, /Battle phase/);
  assert.match(quoteNexusEcazDuke({ ...g, battle: {} as Game['battle'] }, 'ecaz-seat')!.blocked!,
    /current interaction/);
  assert.match(quoteNexusEcazDuke(g, 'ecaz-seat', true)!.blocked!, /current interaction/);
  const harkonnen = {
    ...g, advanced: true,
    players: [...g.players.slice(0, 2),
      { ...g.players[2], faction: 'harkonnen' as const }],
  };
  assert.match(quoteNexusEcazDuke(harkonnen, 'ecaz-seat')!.blocked!,
    /Advanced Harkonnen/);
  assert.equal(quoteNexusEcazDuke({ ...harkonnen, advanced: false }, 'ecaz-seat')!.blocked,
    null);
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
  invalid(record => { record.before.leader.dead = true; });
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
