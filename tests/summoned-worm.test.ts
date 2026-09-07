import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  joinGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck, spiceDeck } from '../game/cards';
import { territory, location } from '../game/board';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
const cards = baseDeck();
const karamas = cards.filter((c) => c.effect === 'karama');
const t = 'the_great_flat';
const key = location(t, territory(t).sectors[0]);
const lands = spiceDeck().filter((c) => 'territory' in c);
function fixture() {
  let g = createGame('SUMMON22', newPlayer('f', 'Fremen', 'fremen'));
  joinGame(g, newPlayer('e', 'Emperor', 'emperor'));
  joinGame(g, newPlayer('g', 'Guild', 'guild'));
  g.players.forEach((p) => (p.ready = true));
  g = applyAction(g, 'f', { type: 'start' });
  for (const p of g.players)
    if (p.traitorChoices.length)
      g = applyAction(g, p.id, {
        type: 'traitor',
        leader: p.traitorChoices[0],
      });
  g = applyAction(g, 'f', {
    type: 'fremenSetup',
    placements: { sietch_tabr: 10 },
  });
  g.advanced = true;
  g.phase = 1;
  g.turn = 2;
  g.storm = 18;
  g.spiceDeck = [...lands];
  g.spiceDiscard = [[], []];
  g.players.forEach((p) => {
    p.forces = {};
    p.reserves = 20;
    p.hand = [];
  });
  g.players[0].hand = [karamas[0]];
  g.players[0].forces = { [key]: 4 };
  g.players[0].reserves = 16;
  g.players[0].elites = {
    reserves: 2,
    tanks: 0,
    forces: { [key]: 1 },
    revived: 0,
  };
  g.players[1].forces = { [key]: 5 };
  g.players[1].reserves = 15;
  g.spice[key] = 8;
  return g;
}
const summon = (g: Game, target = t) =>
  applyAction(g, 'f', {
    type: 'card',
    mode: 'special',
    card: karamas[0].id,
    territory: target,
  });
function allow(state: Game) {
  let g = state;
  while (g.response)
    g = applyAction(
      g,
      g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
      { type: 'passResponse' },
    );
  return g;
}
function ready(state: Game) {
  let g = state;
  for (const p of state.players)
    if (!g.ready.includes(p.id)) g = applyAction(g, p.id, { type: 'ready' });
  return g;
}
function finish(state: Game) {
  let g = allow(state);
  g = ready(g);
  while (g.decision?.kind === 'wormRide')
    g = applyAction(g, 'f', { type: 'decision', accept: false });
  return g;
}
void test('special worm devours forces and spice, preserves Fremen elites and pauses before changing either spice pile', () => {
  const before = fixture();
  before.players[2].hand = [karamas[1]];
  let g = summon(before);
  assert.equal(g.response?.kind, 'wormSurvival');
  assert.equal(g.players[0].specialKaramaUsed, true);
  assert.equal(g.players[1].tanks, 0);
  g = allow(g);
  assert.equal(g.players[1].tanks, 5);
  assert.equal(g.players[0].forces[key], 4);
  assert.equal(g.players[0].elites?.forces[key], 1);
  assert.equal(g.spice[key], undefined);
  assert.equal(g.nexus, false);
  assert.equal(g.summonedBeforeBlow, true);
  assert.deepEqual(g.spiceDeck, before.spiceDeck);
  assert.deepEqual(g.spiceDiscard, before.spiceDiscard);
  assert.deepEqual(g.wormRides, [t]);
  assert.equal(g.discard.filter((c) => c.id === karamas[0].id).length, 1);
  assert.deepEqual(before.players[1].forces, { [key]: 5 });
});
void test('before-draw summon defers Nexus until the first blow is accepted, then rides precede the second blow', () => {
  const before = fixture();
  before.ready = ['e'];
  let g = allow(summon(before));
  assert.equal(g.summonedWorm, null);
  assert.equal(g.nexus, false);
  assert.deepEqual(g.ready, []);
  assert.throws(
    () => applyAction(g, 'f', { type: 'alliance', target: 'e' }),
    /Nexus/,
  );
  g = ready(g);
  assert.deepEqual(g.spiceWindow, { ...lands[0], harvested: false });
  assert.equal(g.nexus, true);
  g = ready(g);
  assert.equal(g.spiceWindow, null);
  assert.equal(g.decision, null);
  g = ready(g);
  assert.equal(g.decision?.kind, 'wormRide');
  g = applyAction(g, 'f', {
    type: 'decision',
    accept: true,
    territory: 'polar_sink',
    sector: 0,
    forces: { [key]: 3 },
    eliteForces: { [key]: 1 },
  });
  assert.equal(g.players[0].forces['polar_sink:0'], 3);
  assert.equal(g.players[0].elites?.forces['polar_sink:0'], 1);
  assert.deepEqual(g.spiceWindow, { ...lands[1], harvested: false });
  g = ready(g);
  assert.equal(g.phase, 2);
});
void test('normal Karama can cancel Fremen survival without canceling the special summon or Nexus', () => {
  const before = fixture();
  before.players[2].hand = [karamas[1]];
  let g = summon(before);
  g = applyAction(g, 'g', {
    type: 'card',
    mode: 'cancel',
    card: karamas[1].id,
  });
  assert.equal(g.players[0].tanks, 4);
  assert.equal(g.players[0].elites?.tanks, 1);
  assert.equal(g.players[1].tanks, 5);
  assert.equal(g.nexus, false);
  assert.equal(g.summonedBeforeBlow, true);
  assert.deepEqual(g.wormRides, []);
  g = ready(g);
  assert.equal(g.summonedWorm, null);
  assert.equal(g.phase, 1);
});
void test('ally protection and Fremen survival retain separate cancellation windows', () => {
  const before = fixture();
  before.players[2].hand = [karamas[1]];
  before.players[0].ally = 'e';
  before.players[1].ally = 'f';
  let g = summon(before);
  assert.equal(g.decision?.kind, 'wormProtection');
  g = applyAction(g, 'f', { type: 'decision', accept: true });
  assert.equal(g.response?.kind, 'wormAllyProtection');
  const protectedGame = allow(g);
  assert.equal(protectedGame.players[1].forces[key], 5);
  g = applyAction(g, 'g', {
    type: 'card',
    mode: 'cancel',
    card: karamas[1].id,
  });
  assert.equal(g.response, null); // No cancellation card remains for the separate survival power.
  g = allow(g);
  assert.equal(g.players[1].tanks, 5);
  assert.equal(g.players[0].tanks, 0);
});
void test('summoning during an open Nexus merges its ride and clears old confirmations without creating another spice draw', () => {
  const before = fixture();
  before.nexus = true;
  before.ready = ['e'];
  before.spiceSequence = { pile: 1, skipped: [] };
  before.wormRides = ['red_chasm'];
  const g = allow(summon(before));
  assert.equal(g.summonedWorm, null);
  assert.equal(g.nexus, true);
  assert.deepEqual(g.ready, []);
  assert.deepEqual(g.wormRides, ['red_chasm', t]);
  assert.deepEqual(g.spiceSequence, before.spiceSequence);
  assert.deepEqual(g.spiceDeck, before.spiceDeck);
});
void test('an interrupted fresh blow and its pile position persist, but devoured spice cannot be harvested afterward', () => {
  const before = fixture();
  const blow = lands.find((c) => c.territory === t)!;
  before.spiceWindow = { ...blow, harvested: false };
  before.spiceSequence = { pile: 1, skipped: [] };
  before.players[1].hand = [cards.find((c) => c.effect === 'harvester')!];
  const g = allow(JSON.parse(JSON.stringify(summon(before))));
  assert.equal(g.spiceSequence?.pile, 1);
  assert.equal(g.spiceWindow?.harvested, true);
  assert.equal(g.spiceWindow?.territory, t);
  assert.throws(
    () => applyAction(g, 'e', { type: 'card', card: g.players[1].hand[0].id }),
    /immediately after a spice blow/,
  );
});
void test('suspended responses preserve passes and private fields without projection leakage', () => {
  const before = fixture();
  before.players[2].hand = [karamas[1]];
  before.response = {
    kind: 'wormSurvival',
    owner: 'f',
    location: 'red_chasm',
    passed: ['e'],
  };
  before.spiceSequence = { pile: 0, skipped: [] };
  before.spiceResolution = { skipped: [] };
  before.nexus = true;
  const pending = summon(before);
  const view = viewGame(pending, 'e');
  assert.deepEqual(view.summonedWorm, { territory: t });
  assert.equal('resume' in view.summonedWorm!, false);
  let g = pending;
  while (g.summonedWorm)
    g = applyAction(
      g,
      g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
      { type: 'passResponse' },
    );
  assert.deepEqual(g.response, before.response);
  assert.deepEqual(g.spiceResolution, before.spiceResolution);
  assert.deepEqual(g.spiceSequence, before.spiceSequence);
  assert.equal(g.nexus, true);
});
void test('the called worm can interrupt a pending additional-worm choice without consuming a draw or its placement allowance', () => {
  const before = fixture();
  before.decision = { kind: 'wormPlacement', player: 'f' };
  before.spiceResolution = { skipped: [] };
  before.spiceSequence = { pile: 1, skipped: [] };
  before.nexus = true;
  before.wormPlacementCanceledTurn = before.turn;
  const g = allow(summon(before));
  assert.deepEqual(g.decision, before.decision);
  assert.deepEqual(g.spiceDeck, before.spiceDeck);
  assert.equal(g.wormPlacementCanceledTurn, before.turn);
});
void test('invalid territory, phase, basic mode and repeated special use are atomic', () => {
  const before = fixture();
  for (const target of ['arrakeen', 'polar_sink', 'unknown'])
    assert.throws(() => summon(before, target), /sand territory/);
  const wrong = structuredClone(before);
  wrong.phase = 5;
  assert.throws(() => summon(wrong), /Spice Blow/);
  wrong.phase = 1;
  wrong.advanced = false;
  assert.throws(() => summon(wrong), /advanced game/);
  assert.equal(before.players[0].hand[0].id, karamas[0].id);
  const g = finish(summon(before));
  g.turn++;
  g.players[0].hand = [karamas[0]];
  assert.throws(() => summon(g), /already been used/);
});
void test('first-turn special summons are not discarded as first-turn drawn worm cards', () => {
  const before = fixture();
  before.turn = 1;
  const g = allow(summon(before));
  assert.equal(g.players[1].tanks, 5);
  assert.equal(g.summonedBeforeBlow, true);
  assert.deepEqual(g.spiceDeck, before.spiceDeck);
});
void test('all AI difficulties use public sand-territory threats and can continue the summoned-worm sequence', () => {
  for (const difficulty of DIFFICULTIES) {
    const before = fixture();
    before.players[0].bot = difficulty;
    const action = botActions(viewGame(before, 'f'))[0];
    assert.equal(action.mode, 'special');
    assert.equal(action.territory, t);
    const g = applyAction(before, 'f', action);
    assert.equal(g.response, null);
    assert.equal(g.summonedWorm, null);
    assert.equal(g.players[1].tanks, 5);
    assert.equal(g.players[0].tanks, 0);
    const other = structuredClone(before);
    other.players[1].hand = cards.slice(0, 4);
    other.spiceDeck.reverse();
    assert.deepEqual(botActions(viewGame(other, 'f'))[0], action);
  }
});
void test('a summon while a ride is awaiting input reopens Nexus before preserving both ride opportunities', () => {
  const before = fixture();
  before.nexus = true;
  before.spiceSequence = { pile: 1, skipped: [] };
  before.decision = { kind: 'wormRide', player: 'f', territory: t };
  before.ready = before.players.map((p) => p.id);
  let g = allow(summon(before));
  assert.equal(g.decision, null);
  assert.equal(g.nexus, true);
  assert.deepEqual(g.ready, []);
  assert.deepEqual(g.wormRides, [t, t]);
  g = ready(g);
  g = applyAction(g, 'f', {
    type: 'decision',
    accept: true,
    territory: 'polar_sink',
    sector: 0,
    forces: { [key]: 2 },
    eliteForces: { [key]: 1 },
  });
  assert.equal(g.decision?.kind, 'wormRide');
  assert.equal(g.players[0].forces[key], 2);
  g = applyAction(g, 'f', { type: 'decision', accept: false });
  assert.equal(g.phase, 2);
});
void test('summoning during a ride intrusion resolves that decision before reopening Nexus and offering the new ride', () => {
  const before = fixture();
  const bg = newPlayer('b', 'Bene Gesserit', 'beneGesserit');
  bg.forces = { 'carthag:11': 1 };
  before.players[0].forces['carthag:11'] = 1;
  before.players[0].reserves--;
  bg.reserves = 19;
  before.players.push(bg);
  before.order.push('b');
  before.nexus = true;
  before.spiceSequence = { pile: 1, skipped: [] };
  before.decision = {
    kind: 'intrusion',
    player: 'b',
    territory: 'carthag',
    wormRide: true,
  };
  let g = allow(summon(before));
  assert.equal(g.decision?.kind, 'intrusion');
  assert.equal(g.summonedNexusBeforeRides, true);
  g = applyAction(g, 'b', { type: 'decision', accept: false });
  assert.equal(g.decision, null);
  assert.equal(g.nexus, true);
  assert.equal(g.summonedNexusBeforeRides, false);
  assert.deepEqual(g.ready, []);
  g = ready(g);
  assert.equal(g.decision?.kind, 'wormRide');
});
void test('a suspended Worthless conversion and its original worm response are restored together and remain private', () => {
  const before = fixture();
  before.players[2].hand = [karamas[1]];
  const bg = newPlayer('b', 'Bene Gesserit', 'beneGesserit');
  const worthless = cards.find((c) => c.kind === 'worthless')!;
  bg.hand = [worthless];
  before.players.push(bg);
  before.order.push('b');
  before.response = {
    kind: 'wormSurvival',
    owner: 'f',
    location: 'red_chasm',
    passed: ['e'],
  };
  before.spiceResolution = { skipped: [] };
  before.spiceSequence = { pile: 0, skipped: [] };
  before.nexus = true;
  const converting = applyAction(before, 'b', {
    type: 'card',
    mode: 'cancel',
    card: worthless.id,
  });
  let g = summon(converting);
  assert.equal(g.pendingKarama, null);
  assert.equal('resume' in viewGame(g, 'e').summonedWorm!, false);
  while (g.summonedWorm)
    g = applyAction(
      g,
      g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
      { type: 'passResponse' },
    );
  assert.deepEqual(g.response, converting.response);
  assert.deepEqual(g.pendingKarama, converting.pendingKarama);
  assert.equal('pendingKarama' in viewGame(g, 'e'), false);
});
