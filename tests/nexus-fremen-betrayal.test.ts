import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction, normalizeAutomaticGame, viewGame, type Action, type Game,
} from '../game/engine';
import { botActions, runBots } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { nexusInventory, nexusPlayer, nexusReload } from './fixture-nexus-cards';
import {
  fremenBetrayalFixture as setup,
  fremenBetrayalMovement as movement,
} from './fixture-nexus-fremen-betrayal';

const fremen = 'f';
const ally = 'a';
const holder = 'h';

function rejected(g: Game, id: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, id, action));
  assert.deepEqual(g, before);
}

for (const advanced of [false, true]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} spent Betrayal suppresses only the native range through its turn and reload`, () => {
    const { g, play } = setup(advanced);
    assert.equal(viewGame(g, fremen).nexusFremenBetrayal, null);
    assert.equal(viewGame(g, ally).nexusFremenBetrayal, null);
    assert.equal(viewGame(g, holder).nexusCards?.card, 'fremen');
    rejected(g, fremen, play);
    rejected(g, holder, { ...play, event: 'stale' });
    rejected(g, holder, { ...play, target: fremen });
    assert.deepEqual(botActions(viewGame(g, holder))[0], play);
    let state = applyAction(nexusReload(g), holder, play);
    nexusInventory(state);
    assert.equal(state.nexusCards!.cards!.hands[holder], null);
    assert.equal(state.nexusCards!.cards!.discard.filter(card => card === 'fremen').length, 1);
    assert.equal(nexusPlayer(state, fremen).fremenNexusMovementBlockedTurn, state.turn);
    assert.equal(viewGame(state, fremen).players.find(p => p.id === fremen)!.fremenMovementBlocked, true);
    assert.equal(viewGame(state, fremen).players.find(p => p.id === fremen)!.fremenNexusMovementBlocked, true);
    rejected(state, holder, play);
    rejected(state, fremen, movement(2));
    state = applyAction(nexusReload(state), fremen, movement(1));
    assert.equal(state.pendingFremenMove ?? null, null);
    assert.equal(state.response?.kind, undefined);
    assert.equal(nexusPlayer(state, fremen).moved, 1);
    assert.equal(nexusPlayer(state, fremen).fremenNexusMovementBlockedTurn, state.turn);
    const restored = normalizeAutomaticGame(nexusReload(state));
    assert.equal(nexusPlayer(restored, fremen).fremenNexusMovementBlockedTurn, restored.turn);
    assert.deepEqual(restored.nexusFremenBetrayalHistory, state.nexusFremenBetrayalHistory);
  });
}

void test('all four bot holders spend the card before an active Fremen bot moves', () => {
  for (const difficulty of DIFFICULTIES) {
    const { g, play } = setup();
    nexusPlayer(g, holder).bot = difficulty;
    nexusPlayer(g, fremen).bot = difficulty;
    assert.deepEqual(botActions(viewGame(g, holder))[0], play);
    const first = runBots(g, 1);
    assert.equal(first.nexusCards!.cards!.hands[holder], null);
    assert.equal(nexusPlayer(first, fremen).moved, 0);
    assert.equal(nexusPlayer(first, fremen).fremenNexusMovementBlockedTurn, first.turn);
  }
});

void test('independent city ornithopters retain their range despite spent Betrayal', () => {
  const { g, play } = setup();
  const state = applyAction(g, holder, play);
  const f = nexusPlayer(state, fremen);
  f.reserves--;
  f.forces['arrakeen:10'] = 1;
  const moved = applyAction(state, fremen, movement(2));
  assert.equal(moved.pendingFremenMove ?? null, null);
  assert.equal(nexusPlayer(moved, fremen).moved, 1);
  assert.equal(nexusPlayer(moved, fremen).fremenNexusMovementBlockedTurn, moved.turn);
});

void test('turn-scoped suppression expires without returning the physical card', () => {
  const { g, play } = setup();
  const next = nexusReload(applyAction(g, holder, play));
  next.turn++;
  next.active = fremen;
  next.movementRemaining = [...next.order];
  nexusPlayer(next, fremen).moved = 0;
  const view = viewGame(next, fremen);
  assert.equal(view.players.find(p => p.id === fremen)!.fremenNexusMovementBlocked, false);
  assert.equal(view.players.find(p => p.id === fremen)!.fremenMovementBlocked, false);
  const moved = applyAction(next, fremen, movement(2));
  assert.equal(nexusPlayer(moved, fremen).moved, 1);
  assert.equal(moved.nexusCards!.cards!.discard.filter(card => card === 'fremen').length, 1);
});

void test('changed saved turn, target or suppression rejects before advancing movement', () => {
  const { g, play } = setup();
  const played = applyAction(g, holder, play);
  for (const change of [
    (state: Game) => { state.nexusFremenBetrayalHistory![0].target = ally; },
    (state: Game) => { state.nexusFremenBetrayalHistory![0].turn--; },
    (state: Game) => { delete nexusPlayer(state, fremen).fremenNexusMovementBlockedTurn; },
    (state: Game) => { state.nexusCards!.cards!.discard = []; },
  ]) {
    const damaged = nexusReload(played);
    change(damaged);
    rejected(damaged, fremen, movement(1));
  }
});
