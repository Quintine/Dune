import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import {
  acquireDuke, captureDuke, consumeDuke, createDukeVidal, dukeController,
  DUKE_VIDAL_ID, executeCapturedDuke, expireDuke,
} from '../game/duke-vidal';
import { createNexusCards, drawNexusCard } from '../game/nexus-cards';
import { quoteEcazDukeAcquisition } from '../game/ecaz-duke-acquisition';
import { resolveEcazDukeRevival } from '../game/ecaz-duke-revival';
import {
  createNexusEcazDukeReceipt, nexusEcazDukeEvent, nexusEcazDukeModeSupported,
  nexusEcazDukeSignature, quoteNexusEcazDuke, validateNexusEcazDuke,
  type NexusEcazDukeCapturedReceipt,
} from '../game/nexus-ecaz-duke';
import { createNexusDukeDeathFixture } from './fixture-nexus-duke-capture';

/** A small pure-quote fixture; the separate Ghola test uses the genuine setup seam. */
function position(): Game {
  const players = [
    { id: 'e', faction: 'ecaz' as const, ally: null, leaders: [] },
    { id: 'h', faction: 'harkonnen' as const, ally: null, leaders: [] },
    { id: 'g', faction: 'guild' as const, ally: null, leaders: [] },
  ];
  const cards = createNexusCards(players, () => 0.5);
  const index = cards.deck.indexOf('ecaz');
  assert.ok(index >= 0);
  cards.deck.unshift(...cards.deck.splice(index, 1));
  return {
    players, advanced: true, expansions: ['ecaz'],
    nexusCards: { cards: drawNexusCard(cards, 'e', players, () => 0), phase: null },
    status: 'playing', phase: 6, turn: 3, dukeVidal: createDukeVidal(),
  } as unknown as Game;
}

void test('Cunning sees actual capture over its own underlying Ecaz tenure and liberates it for this turn only', () => {
  const g = position();
  const owned = acquireDuke(g.dukeVidal!, 'e', 1, 'ecaz');
  owned.leader.deaths = 2;
  g.dukeVidal = captureDuke(owned, 'h', 'e', 3, 'arrakeen');
  assert.throws(() => quoteEcazDukeAcquisition(g, 'e'));
  const offer = quoteNexusEcazDuke(g, 'e')!;
  assert.equal(offer.blocked, null, 'underlying owner is not the captive effective controller');
  assert.equal(offer.dukeController, 'h', 'original losing controller is entitled to its own capture');
  const receipt = createNexusEcazDukeReceipt(g, 'e');
  validateNexusEcazDuke(g, receipt, 0);
  g.dukeVidal = acquireDuke(g.dukeVidal!, 'e', 3, 'ecazNexus');
  assert.equal(dukeController(g.dukeVidal), 'e');
  assert.equal(g.dukeVidal.source, 'ecazNexus');
  assert.equal(g.dukeVidal.leader.capturedBy, undefined);
  assert.equal(g.dukeVidal.leader.concealed, undefined);
  g.dukeVidal = expireDuke(g.dukeVidal, 3);
  assert.equal(dukeController(g.dukeVidal), null);
  assert.equal(g.dukeVidal.leader.deaths, 2);
  validateNexusEcazDuke(g, receipt, 0);
  // Later death and another turn are not mutations of the historical card play.
  g.dukeVidal.leader.dead = true;
  g.dukeVidal.leader.deaths++;
  g.turn = 4;
  g.phase = 0;
  validateNexusEcazDuke(g, JSON.parse(JSON.stringify(receipt)), 0);
});

void test('the owner-private offer masks a concealed captor unless Ecaz was the actual losing controller', () => {
  const g = position();
  g.dukeVidal = captureDuke(acquireDuke(g.dukeVidal!, 'g', 3, 'ally'), 'h', 'g', 3, 'carthag');
  const offer = quoteNexusEcazDuke(g, 'e')!;
  assert.equal(offer.blocked, null);
  assert.equal(offer.dukeController, 'g');
  assert.equal(offer.event.includes('"h"'), false);
  assert.equal(quoteNexusEcazDuke(g, 'h'), null);
  const record = createNexusEcazDukeReceipt(g, 'e');
  validateNexusEcazDuke(g, record, 0);
  delete g.dukeVidal.leader.concealed;
  assert.equal(quoteNexusEcazDuke(g, 'e')!.dukeController, 'h', 'revealed custody is public');
});

void test('a released witness captive stays unavailable while used but can be liberated after the original turn stamp clears', () => {
  const g = position();
  const used = acquireDuke(g.dukeVidal!, 'g', 3, 'ally');
  used.leader.usedAt = 'arrakeen';
  used.leader.deaths = 3;
  g.dukeVidal = captureDuke(consumeDuke(used), 'h', 'g', 3, 'arrakeen', {
    deaths: 3, usedAt: 'arrakeen',
  });
  assert.notEqual(quoteNexusEcazDuke(g, 'e')!.blocked, null);
  assert.throws(() => createNexusEcazDukeReceipt(g, 'e'));
  g.turn = 4;
  delete g.dukeVidal.leader.usedAt;
  const receipt = createNexusEcazDukeReceipt(g, 'e');
  validateNexusEcazDuke(g, receipt, 0);
  const liberated = acquireDuke(g.dukeVidal, 'e', 4, 'ecazNexus');
  assert.equal(dukeController(liberated), 'e');
  assert.equal(liberated.leader.deaths, 3);
  assert.equal(liberated.leader.usedAt, undefined);
  assert.equal(dukeController(expireDuke(liberated, 4)), null);
});

void test('captured v2 receipts reject impossible custody and return transitions even after a fresh signature', () => {
  const g = position();
  g.dukeVidal = captureDuke(acquireDuke(g.dukeVidal!, 'g', 3, 'ally'), 'h', 'g', 3, 'carthag');
  const receipt = createNexusEcazDukeReceipt(g, 'e');
  assert.ok('version' in receipt);
  const mutations: ((saved: NexusEcazDukeCapturedReceipt) => void)[] = [
    saved => { saved.before.leader.capturedBy = 'g'; },
    saved => { saved.before.leader.concealed!.controller = 'h'; },
    saved => { saved.before.leader.concealed!.deaths++; },
    saved => { saved.before.source = 'ecazNexus'; },
    saved => { saved.before.acquiredTurn = 4; },
    saved => { saved.after.leader.deaths++; },
    saved => { saved.after.controller = 'h'; },
    saved => { Object.assign(saved.after.leader, { capturedBy: 'h' }); },
    saved => { Object.assign(saved.before.leader, { gholaBy: 'g' }); },
    saved => { Object.assign(saved.before.leader.concealed!, { extra: 1 }); },
    saved => { Object.assign(saved, { version: 3 }); },
  ];
  for (const mutate of mutations) {
    const saved = structuredClone(receipt);
    mutate(saved);
    saved.signature = nexusEcazDukeSignature(saved);
    assert.throws(() => validateNexusEcazDuke(g, saved, 0));
  }
  const downgraded = structuredClone(receipt) as unknown as Record<string, unknown>;
  delete downgraded.version;
  assert.throws(() => validateNexusEcazDuke(g, downgraded as never, 0));
  g.dukeVidal.leader.gholaBy = 'g';
  assert.notEqual(quoteNexusEcazDuke(g, 'e')!.blocked, null);
  assert.throws(() => createNexusEcazDukeReceipt(g, 'e'));
});


void test('a privately executed return remains a Tanks resurrection with the unchanged old receipt schema', () => {
  const g = position();
  const captured = captureDuke(acquireDuke(g.dukeVidal!, 'g', 3, 'ally'), 'h', 'g', 3, 'arrakeen');
  g.dukeVidal = captured;
  const priorOffer = quoteNexusEcazDuke(g, 'e')!;
  g.dukeVidal = executeCapturedDuke(captured, 'h', 3);
  const offer = quoteNexusEcazDuke(g, 'e')!;
  assert.equal(offer.blocked, null);
  assert.equal(offer.dukeController, 'g', 'private execution still masks the underlying public snapshot');
  assert.equal(offer.event, priorOffer.event, 'private execution does not change an unrelated owner action token');
  const receipt = createNexusEcazDukeReceipt(g, 'e');
  assert.equal(receipt.event, nexusEcazDukeEvent(3, 6, 'e', 0, null, null),
    'private history still binds actual Tanks custody rather than projected prior tenure');
  validateNexusEcazDuke(g, receipt, 0);
  g.dukeVidal = acquireDuke(g.dukeVidal, 'e', 3, 'ecazNexus');
  assert.equal(g.dukeVidal.leader.dead, false);
  assert.equal(g.dukeVidal.leader.deaths, 2);
  assert.equal(g.dukeVidal.leader.concealed, undefined);
  assert.equal(g.dukeVidal.captureVisibility, undefined);
  validateNexusEcazDuke(g, receipt, 0);
});

void test('Advanced Harkonnen admission is only the existing standalone no-Skills profile, not a broader Duke exception', () => {
  const g = position();
  assert.equal(nexusEcazDukeModeSupported(g), true);
  assert.equal(quoteEcazDukeAcquisition(g, 'e').source, 'ecaz');
  g.dukeVidal!.leader.dead = true;
  g.dukeVidal!.leader.deaths = 1;
  assert.equal(resolveEcazDukeRevival(g, 'e').player, 'e');
  assert.throws(() => resolveEcazDukeRevival(g, 'h'));
  for (const change of [
    (saved: Game) => { saved.leaderSkills = {} as Game['leaderSkills']; },
    (saved: Game) => { saved.players[2].faction = 'moritani'; },
  ]) {
    const excluded = structuredClone(g);
    change(excluded);
    assert.equal(nexusEcazDukeModeSupported(excluded), false);
    assert.notEqual(quoteNexusEcazDuke(excluded, 'e')!.blocked, null);
    assert.throws(() => resolveEcazDukeRevival(excluded, 'e'));
    excluded.dukeVidal!.leader.dead = false;
    assert.throws(() => quoteEcazDukeAcquisition(excluded, 'e'));
  }
  for (const phase of [4, 5, 7]) {
    const outside = position();
    outside.phase = phase;
    assert.notEqual(quoteNexusEcazDuke(outside, 'e')!.blocked, null);
  }
});

void test('the actual Ecaz Ghola Treachery return sets the shared disc aside before a separate Cunning acquisition', () => {
  const death = createNexusDukeDeathFixture({
    deal: faction => faction === 'ecaz' ? ['ghola']
      : faction === 'harkonnen' ? ['worthless', 'poison'] : ['worthless'],
  });
  let g = death.window;
  const owner = death.owner;
  assert.equal(g.dukeVidal!.leader.dead, true);
  const deaths = g.dukeVidal!.leader.deaths;
  const ghola = g.players.find(player => player.id === owner)!.hand
    .find(card => card.effect === 'ghola')!;
  assert.ok(ghola, 'Ecaz retains the original setup-dealt physical Ghola through the real battle death');
  const beforeSpice = g.players.find(player => player.id === owner)!.spice;
  const beforeSlot = g.players.find(player => player.id === owner)!.leaderRevived;
  const rosters = g.players.map(player => player.leaders.map(leader => leader.id));
  const forces = structuredClone(g.players.map(player => ({
    reserves: player.reserves, tanks: player.tanks, forces: player.forces, elites: player.elites,
  })));
  g = applyAction(g, owner, { type: 'card', card: ghola.id, leader: DUKE_VIDAL_ID });
  for (let step = 0; g.response && step < g.players.length; step++) {
    const responder = g.players.find(player => !g.response!.passed.includes(player.id))!;
    g = applyAction(g, responder.id, { type: 'passResponse' });
  }
  assert.equal(g.response, null);
  assert.equal(g.dukeVidal!.leader.dead, false);
  assert.equal(g.dukeVidal!.leader.deaths, deaths);
  assert.equal(g.dukeVidal!.leader.gholaBy, undefined);
  assert.equal(g.dukeVidal!.leader.usedAt, undefined, 'the real Ghola effect clears prior battle use');
  assert.equal(dukeController(g.dukeVidal!), null, 'Ghola grants no fabricated active native Ecaz control');
  assert.equal(g.discard.filter(card => card.id === ghola.id).length, 1);
  const offer = viewGame(g, owner).nexusEcazDuke!;
  assert.equal(offer.blocked, null);
  const revivedSlot = g.players.find(player => player.id === owner)!.leaderRevived;
  assert.equal(revivedSlot, beforeSlot, 'Ghola does not spend the normal leader revival allowance');
  const returned = g;
  g = applyAction(g, owner, { type: 'nexusEcazDuke', event: offer.event });
  assert.equal(dukeController(g.dukeVidal!), owner);
  assert.equal(g.dukeVidal!.source, 'ecazNexus');
  assert.equal(g.dukeVidal!.leader.deaths, deaths);
  assert.equal(g.dukeVidal!.leader.gholaBy, undefined);
  assert.equal(g.players.find(player => player.id === owner)!.leaderRevived, revivedSlot);
  assert.equal(g.players.find(player => player.id === owner)!.spice, beforeSpice);
  assert.deepEqual(g.players.map(player => player.leaders.map(leader => leader.id)), rosters);
  assert.deepEqual(g.players.map(player => ({
    reserves: player.reserves, tanks: player.tanks, forces: player.forces, elites: player.elites,
  })), forces);
  assert.equal(returned.nexusCards!.cards!.hands[owner], 'ecaz');
  assert.equal(g.nexusCards!.cards!.hands[owner], null);
  assert.equal(g.nexusCards!.cards!.discard.filter(card => card === 'ecaz').length, 1);
  const receipt = g.nexusEcazDukeHistory!.at(-1)!;
  assert.equal('version' in receipt, false, 'ordinary Ecaz Ghola return is not a foreign-Ghola or captive producer');
  validateNexusEcazDuke(g, receipt, g.nexusEcazDukeHistory!.length - 1);
});
