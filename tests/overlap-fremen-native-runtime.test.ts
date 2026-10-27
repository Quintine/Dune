import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { act, player, createFremenOverlapFixture, triggerFremen, relocate } from './fixture-overlap-fremen-native';
import type { First } from './fixture-basic-native-overlap';

function entered(first: First, otherTerror = false, withBG = false) {
  const f = createFremenOverlapFixture(first, otherTerror, withBG);
  const spice = player(f.game, f.entrant).spice;
  let game = act(f.game, f.entrant, f.shipment);
  assert.equal(player(game, f.entrant).spice, spice - 1);
  // A real Bene Gesserit seat may accompany the original shipment before
  // the queued Ambassador/Terror entry is opened.
  if (game.decision?.kind === 'advisor')
    game = act(game, 'beneGesserit', { type: 'decision', accept: false });
  assert.equal(game.pendingArrivalOverlap?.first, first);
  if (first === 'terror') {
    assert.equal(game.pendingTerrorEntry?.entrant, f.entrant);
    game = act(game, 'moritani', { type: 'decision', decline: true });
  }
  assert.equal(game.pendingAmbassador?.token, f.fremen);
  assert.equal(viewGame(game, 'ecaz').ambassadorEntry?.beneficiaries[0].blocked, null);
  game = triggerFremen(game);
  return { f, game, spice };
}
function decline(game: Game) { return act(game, 'moritani', { type: 'decision', decline: true }); }
function rob(game: Game) {
  game = act(game, 'moritani', { type: 'decision', reveal: true });
  assert.equal(game.pendingTerrorEntry?.stage, 'robbery');
  return act(game, 'moritani', { type: 'decision', choice: 'spice' });
}

void test('Ambassador-first child decline preserves the original Terror opportunity', () => {
  const { f, game: open, spice } = entered('ambassador');
  let game = relocate(open, f.destination, f.sector);
  assert.equal(game.pendingTerrorEntry?.cause, 'ambassador');
  assert.equal(game.pendingTerrorEntry?.entrant, 'ecaz');
  assert.equal(game.pendingTerrorEntry?.token, f.terror);
  game = decline(game);
  assert.equal(game.pendingArrivalOverlap?.stage, 'second');
  assert.equal(game.pendingTerrorEntry?.cause, 'shipment');
  assert.equal(game.pendingTerrorEntry?.entrant, f.entrant);
  assert.equal(game.pendingTerrorEntry?.token, f.terror);
  game = decline(game);
  assert.equal(game.pendingArrivalOverlap, null);
  assert.equal(game.pendingAmbassador, null);
  assert.equal(game.pendingTerrorEntry, null);
  assert.equal(player(game, f.entrant).spice, spice - 1);
  assert.equal(player(game, f.entrant).forces[`${f.destination}:${f.sector}`], 1);
  assert.equal(player(game, 'ecaz').forces[`${f.destination}:${f.sector}`], 1);
  assert.equal(game.moritaniTerror!.tokens.find(t => t.id === f.terror)?.status, 'placed');
});

void test('Ambassador-first child reveal consumes the shared token without replaying the original entry', () => {
  const { f, game: open, spice } = entered('ambassador');
  let game = relocate(open, f.destination, f.sector);
  assert.equal(game.pendingTerrorEntry?.entrant, 'ecaz');
  game = rob(game);
  assert.equal(game.moritaniTerror!.tokens.find(t => t.id === f.terror)?.status, 'removed');
  assert.equal(game.pendingArrivalOverlap, null);
  assert.equal(game.pendingAmbassador, null);
  assert.equal(game.pendingTerrorEntry, null);
  assert.equal(player(game, f.entrant).spice, spice - 1);
  assert.equal(player(game, f.entrant).forces[`${f.destination}:${f.sector}`], 1);
  assert.equal(player(game, 'ecaz').forces[`${f.destination}:${f.sector}`], 1);
});

void test('Terror-first original decline keeps the token available for a Fremen child entry', () => {
  const { f, game: open } = entered('terror');
  let game = relocate(open, f.destination, f.sector);
  assert.equal(game.pendingTerrorEntry?.cause, 'ambassador');
  assert.equal(game.pendingTerrorEntry?.entrant, 'ecaz');
  assert.equal(game.pendingTerrorEntry?.token, f.terror);
  game = rob(game);
  assert.equal(game.moritaniTerror!.tokens.find(t => t.id === f.terror)?.status, 'removed');
  assert.equal(game.pendingArrivalOverlap, null);
  assert.equal(game.pendingAmbassador, null);
  assert.equal(game.pendingTerrorEntry, null);
  assert.equal(player(game, f.entrant).forces[`${f.destination}:${f.sector}`], 1);
  assert.equal(player(game, 'ecaz').forces[`${f.destination}:${f.sector}`], 1);
});

void test('a separate child Terror resolves before the still-eligible original Terror', () => {
  const { f, game: open } = entered('ambassador', true);
  const at = f.alternate.destination;
  let game = relocate(open, at.territory, at.sector);
  assert.equal(game.pendingTerrorEntry?.entrant, 'ecaz');
  assert.equal(game.pendingTerrorEntry?.token, f.childTerror);
  game = act(game, 'moritani', { type: 'decision', reveal: true });
  assert.equal(game.moritaniTerror!.tokens.find(t => t.id === f.childTerror)?.status, 'extortion');
  assert.equal(game.pendingTerrorEntry?.entrant, f.entrant);
  assert.equal(game.pendingTerrorEntry?.token, f.terror);
  game = decline(game);
  assert.equal(game.pendingArrivalOverlap, null);
  assert.equal(player(game, 'ecaz').forces[`${at.territory}:${at.sector}`], 1);
  assert.equal(player(game, f.entrant).forces[`${f.destination}:${f.sector}`], 1);
});

void test('Terror-first original reveal leaves no token for the subsequent same-stronghold child', () => {
  const f = createFremenOverlapFixture('terror');
  let game = act(f.game, f.entrant, f.shipment);
  assert.equal(game.pendingTerrorEntry?.entrant, f.entrant);
  game = rob(game);
  assert.equal(game.moritaniTerror!.tokens.find(t => t.id === f.terror)?.status, 'removed');
  assert.equal(game.pendingAmbassador?.token, f.fremen);
  game = triggerFremen(game);
  game = relocate(game, f.destination, f.sector);
  assert.equal(game.pendingArrivalOverlap, null);
  assert.equal(game.pendingAmbassador, null);
  assert.equal(game.pendingTerrorEntry, null);
  assert.equal(player(game, f.entrant).forces[`${f.destination}:${f.sector}`], 1);
  assert.equal(player(game, 'ecaz').forces[`${f.destination}:${f.sector}`], 1);
});

void test('a child Sneak Attack queues its Bene Gesserit accompaniment after the original Terror', () => {
  const { f, game: open } = entered('ambassador', true, true);
  const at = f.alternate.destination;
  const moritaniReserves = player(open, 'moritani').reserves;
  let game = relocate(open, at.territory, at.sector);
  assert.equal(game.pendingTerrorEntry?.token, f.childTerror);
  game = act(game, 'moritani', { type: 'decision', reveal: true });
  assert.equal(game.pendingTerrorEntry?.stage, 'sneakAttack');
  game = act(game, 'moritani', { type: 'decision', amount: 1 });
  assert.equal(player(game, 'moritani').reserves, moritaniReserves - 1);
  assert.equal(player(game, 'moritani').forces[`${at.territory}:${at.sector}`], 1);
  assert.equal(game.pendingArrivalOverlap?.stage, 'second');
  assert.equal(game.pendingTerrorEntry?.token, f.terror);
  assert.equal(game.pendingTerrorEntry?.entrant, f.entrant);
  assert.equal(game.decision?.kind, 'moritaniTerror', 'The original Terror controls cannot be overwritten');
  game = decline(game);
  assert.equal(game.pendingArrivalOverlap, null);
  assert.equal(game.decision?.kind, 'advisor');
  assert.equal(game.decision?.player, 'beneGesserit');
  game = act(game, 'beneGesserit', { type: 'decision', accept: false });
  assert.equal(game.pendingArrivalOverlap, null);
  assert.equal(game.pendingTerrorEntry, null);
  assert.equal(player(game, f.entrant).forces[`${f.destination}:${f.sector}`], 1);
  assert.equal(player(game, 'moritani').forces[`${at.territory}:${at.sector}`], 1);
});

void test('all minimal bot profiles choose a legal Fremen Ambassador action in the overlap', () => {
  const f = createFremenOverlapFixture('ambassador');
  const offered = act(f.game, f.entrant, f.shipment);
  assert.equal(offered.pendingAmbassador?.stage, 'offer');
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(offered, 'ecaz');
    view.players.find(p => p.id === 'ecaz')!.bot = difficulty;
    const action = botActions(view)[0]; assert.ok(action, difficulty);
    let game = act(offered, 'ecaz', action);
    if (game.pendingAmbassador?.stage === 'move') {
      game = relocate(game, f.destination, f.sector);
      assert.equal(game.pendingTerrorEntry?.cause, 'ambassador');
      game = decline(game);
    }
    assert.equal(game.pendingArrivalOverlap?.stage, 'second');
    assert.equal(game.pendingTerrorEntry?.entrant, f.entrant);
    game = decline(game);
    assert.equal(game.pendingArrivalOverlap, null);
    assert.equal(player(game, f.entrant).forces[`${f.destination}:${f.sector}`], 1);
  }
});
