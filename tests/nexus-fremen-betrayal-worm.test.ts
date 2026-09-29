import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction, normalizeAutomaticGame, viewGame, type Action, type Game,
} from '../game/engine';
import { botActions, runBots } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  finishNexusSpice, nexusAllow, nexusInventory, nexusPlayer, nexusReady, nexusReload,
} from './fixture-nexus-cards';
import { fremenBetrayalNextWorm as nextWorm, fremenBetrayalWormFixture } from './fixture-nexus-fremen-betrayal';

const fremen = 'f';
const holder = 'h';
function rejected(g: Game, id: string, action: Action, pattern?: RegExp) {
  const before = structuredClone(g);
  if (pattern) assert.throws(() => applyAction(g, id, action), pattern);
  else assert.throws(() => applyAction(g, id, action));
  assert.deepEqual(g, before);
}

for (const advanced of [false, true]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} pre-blow Betrayal prevents native ride but retains worm destruction and Nexus`, () => {
    const { g, play } = fremenBetrayalWormFixture(advanced);
    assert.equal(viewGame(g, holder).nexusFremenBetrayal?.mode, 'worm');
    assert.equal(viewGame(g, fremen).nexusFremenBetrayal, null);
    rejected(g, fremen, play);
    rejected(g, holder, { ...play, event: 'stale' });
    nextWorm(g, 'red_chasm');
    let state = applyAction(nexusReload(g), holder, play);
    assert.equal(state.nexusCards!.cards!.hands[holder], null);
    assert.equal(state.nexusCards!.cards!.discard.filter(card => card === 'fremen').length, 1);
    assert.equal(nexusPlayer(state, fremen).fremenNexusWormBlockedTurn, state.turn);
    assert.equal(viewGame(state, fremen).players.find(p => p.id === fremen)!.fremenNexusWormBlocked, true);
    nexusInventory(state);
    rejected(state, holder, play);
    state = nexusReady(nexusReload(state));
    if (state.response) state = nexusAllow(state);
    assert.equal(state.nexus, true);
    assert.equal(state.nexusCards!.phase!.occurred, true);
    assert.deepEqual(state.wormRides, []);
    assert.notEqual(state.decision?.kind, 'wormRide');
    assert.equal(state.nexusFremenCunningOffer ?? null, null);
    assert.equal(nexusPlayer(state, fremen).forces['red_chasm:7'], 4);
    const restored = normalizeAutomaticGame(nexusReload(state));
    assert.equal(restored.nexusFremenBetrayalHistory?.[0].mode, 'worm');
    assert.equal(nexusPlayer(restored, fremen).fremenNexusWormBlockedTurn, restored.turn);
  });
}

void test('a later empty worm offers no remote Cunning ride while Betrayal is active', () => {
  const { g, play } = fremenBetrayalWormFixture();
  nextWorm(g, 'hagga_basin');
  let state = applyAction(g, holder, play);
  state = nexusReady(state);
  if (state.response) state = nexusAllow(state);
  assert.equal(state.nexus, true);
  assert.equal(state.nexusFremenCunningOffer ?? null, null);
  assert.equal(state.decision?.kind === 'nexusFremenCunningOffer', false);
  assert.deepEqual(state.wormRides, []);
});

void test('an unspent holder cannot retroactively stop a worm after its appearance', () => {
  const { g, play } = fremenBetrayalWormFixture();
  nextWorm(g, 'hagga_basin');
  let state = nexusReady(g);
  if (state.response) state = nexusAllow(state);
  assert.equal(state.nexus, true);
  assert.equal(viewGame(state, holder).nexusFremenBetrayal?.mode, 'worm');
  assert.match(String(viewGame(state, holder).nexusFremenBetrayal?.blocked), /before the first worm/);
  rejected(state, holder, play);
  assert.equal(state.nexusCards!.cards!.hands[holder], 'fremen');
});

void test('post-blow play is too late, and a recycled current-turn card cannot suppress movement again', () => {
  const { g, play } = fremenBetrayalWormFixture();
  nextWorm(g, 'hagga_basin');
  let state = applyAction(g, holder, play);
  state = nexusReady(state);
  if (state.response) state = nexusAllow(state);
  state = finishNexusSpice(state);
  assert.equal(state.nexusCards!.phase!.stage, 'drawing');
  // The physical card may be recycled during this phase's Nexus draw.
  const cards = state.nexusCards!.cards!;
  cards.discard = cards.discard.filter(card => card !== 'fremen');
  cards.deck.push('fremen');
  state = applyAction(state, holder, {
    type: 'nexusCardChoice', turn: state.turn, card: null, choice: 'keep', ownRedraws: 0,
  });
  assert.equal(state.nexusCards!.phase!.stage, 'complete');
  state.phase = 5;
  state.active = fremen;
  state.movementRemaining = [...state.order];
  nexusPlayer(state, fremen).moved = 0;
  const recycled = state.nexusCards!.cards!;
  const old = recycled.hands[holder];
  if (old) recycled.discard.push(old);
  recycled.deck = recycled.deck.filter(card => card !== 'fremen');
  recycled.hands[holder] = 'fremen';
  nexusInventory(state);
  assert.match(String(viewGame(state, holder).nexusFremenBetrayal?.blocked), /already spent/);
  rejected(state, holder, { type: 'nexusFremenBetrayal', event: play.event }, /before|current/);
  assert.equal(viewGame(state, fremen).players.find(p => p.id === fremen)!.fremenNexusWormBlocked, true);
});

void test('all four bot holders act before a Fremen bot readies the first blow', () => {
  for (const difficulty of DIFFICULTIES) {
    const { g, play } = fremenBetrayalWormFixture();
    nexusPlayer(g, holder).bot = difficulty;
    nexusPlayer(g, fremen).bot = difficulty;
    assert.deepEqual(botActions(viewGame(g, holder))[0], play);
    const first = runBots(g, 1);
    assert.equal(first.nexusCards!.cards!.hands[holder], null);
    assert.equal(nexusPlayer(first, fremen).fremenNexusWormBlockedTurn, first.turn);
    assert.equal(first.ready.includes(fremen), false);
  }
});
