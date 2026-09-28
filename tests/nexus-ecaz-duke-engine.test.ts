import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, normalizeAutomaticGame, viewGame, type Game } from '../game/engine';
import { acquireDuke } from '../game/duke-vidal';
import { drawNexusCard } from '../game/nexus-cards';
import { nexusEcazDukePosition as position } from './fixture-nexus-ecaz-duke';
import { nexusTraitorFixture, nexusTraitorInventory } from './fixture-nexus-traitors';
import { nexusReady } from './fixture-nexus-cards';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game)) as Game;

function reject(game: Game, id: string, action: { type: string; event: string }) {
  const before = reload(game);
  assert.throws(() => applyAction(game, id, action));
  assert.deepEqual(game, before);
}

void test('Ecaz Cunning physically overrides Moritani Duke custody and expires without duplicating the disc', () => {
  for (const advanced of [false, true]) {
    const { game, action } = position(advanced);
    assert.equal(viewGame(game, 'q').nexusEcazDuke, null);
    assert.equal(viewGame(game, 'r').nexusEcazDuke, null);
    const result = applyAction(game, 'p', action);
    assert.equal(result.nexusCards!.cards!.hands.p, null);
    assert.equal(result.nexusCards!.cards!.discard.filter(card => card === 'ecaz').length, 1);
    assert.equal(result.dukeVidal!.controller, 'p');
    assert.equal(result.dukeVidal!.source, 'ecazNexus');
    assert.equal(result.players.flatMap(player => player.leaders).some(leader => leader.id === 'duke-vidal'), false);
    assert.equal(viewGame(result, 'p').players.find(player => player.id === 'p')!.leaders
      .some(leader => leader.id === 'duke-vidal'), true);
    assert.equal(viewGame(result, 'q').players.find(player => player.id === 'q')!.leaders
      .some(leader => leader.id === 'duke-vidal'), false);
    assert.equal(viewGame(result, 'q').nexusEcazDuke, null);
    assert.deepEqual(normalizeAutomaticGame(reload(result)), result);
    nexusTraitorInventory(result);
    const turnEnd = reload(result);
    Object.assign(turnEnd, { phase: 8, ready: [], active: null, decision: null,
      response: null, phaseOpening: null, battle: null });
    const next = nexusReady(turnEnd);
    assert.equal(next.turn, result.turn + 1);
    assert.equal(next.dukeVidal!.controller, null);
    assert.equal(next.dukeVidal!.leader.id, 'duke-vidal');
    assert.equal(viewGame(next, 'p').nexusEcazDuke, null);
    nexusTraitorInventory(next);
    reject(result, 'p', action);
    reject(game, 'q', action);
  }
});

void test('a stale offer, busy table, dead, captured or Ghola Duke cannot spend Ecaz Cunning', () => {
  const { game, action } = position();
  const changed = reload(game);
  changed.dukeVidal = acquireDuke(changed.dukeVidal!, 'r', changed.turn, 'ecaz');
  reject(changed, 'p', action);
  for (const field of ['dead', 'capturedBy', 'gholaBy'] as const) {
    const blocked = reload(game);
    if (field === 'dead') blocked.dukeVidal!.leader.dead = true;
    else blocked.dukeVidal!.leader[field] = 'q';
    assert.notEqual(viewGame(blocked, 'p').nexusEcazDuke?.blocked, null);
    reject(blocked, 'p', action);
  }
  const busy = reload(game);
  busy.decision = { kind: 'wormRide', player: 'q' } as Game['decision'];
  assert.notEqual(viewGame(busy, 'p').nexusEcazDuke?.blocked, null);
  reject(busy, 'p', action);
});

void test('Advanced Harkonnen battle lock rejects native Cunning before spending its card', () => {
  const game = nexusTraitorFixture({ ownerFaction: 'ecaz', opponentFaction: 'moritani',
    observerFaction: 'harkonnen', advanced: true, phase: 6 });
  const cards = game.nexusCards!.cards!;
  const old = cards.hands.p!;
  cards.hands.p = null;
  cards.deck.push(old);
  const index = cards.deck.indexOf('ecaz');
  assert.ok(index >= 0);
  cards.deck.unshift(...cards.deck.splice(index, 1));
  game.nexusCards!.cards = drawNexusCard(cards, 'p', game.players, () => 0);
  game.dukeVidal = acquireDuke(game.dukeVidal!, 'q', game.turn, 'moritani');
  const offer = viewGame(game, 'p').nexusEcazDuke!;
  assert.match(offer.blocked!, /Advanced Harkonnen/);
  reject(game, 'p', { type: 'nexusEcazDuke', event: offer.event });
  assert.equal(game.nexusCards!.cards!.hands.p, 'ecaz');
});

void test('saved Ecaz Duke receipts detect changed historical ownership, event and missing physical spend', () => {
  const { game, action } = position();
  const result = applyAction(game, 'p', action);
  const ownership = reload(result);
  ownership.nexusEcazDukeHistory![0].after.controller = 'q';
  assert.throws(() => normalizeAutomaticGame(ownership), /Ecaz Nexus/);
  const marker = reload(result);
  marker.nexusEcazDukeEvents![0] = 'changed';
  assert.throws(() => viewGame(marker, 'p'), /Ecaz Nexus/);
  const card = reload(result);
  card.nexusCards!.cards!.discard.splice(card.nexusCards!.cards!.discard.indexOf('ecaz'), 1);
  card.nexusCards!.cards!.deck.push('ecaz');
  assert.throws(() => normalizeAutomaticGame(card), /Ecaz Nexus/);
});
