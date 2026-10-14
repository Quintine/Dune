import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction, createGame, newPlayer, normalizeAutomaticGame, viewGame,
  type Action, type Game,
} from '../game/engine';
import { placeTerror } from '../game/moritani-terror';
import { botArrivalBlock } from '../game/bot-arrival';
import { botActions } from '../game/bots';
import { atomicsFixtureGame } from './fixture-moritani-atomics';

const seat = (g: Game, id: string) => g.players.find(p => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const ship: Action = { type: 'ship', territory: 'arrakeen', sector: 10, amount: 2 };
const move: Action = { type: 'move', from: 'imperial_basin:10', territory: 'arrakeen', sector: 10, amount: 2 };
function rejected(g: Game, id: string, action: Action, pattern?: RegExp) {
  const before = structuredClone(g);
  if (pattern) assert.throws(() => applyAction(g, id, action), pattern);
  else assert.throws(() => applyAction(g, id, action));
  assert.deepEqual(g, before);
}
function fixture(advanced = false, ally = true, target = 'arrakeen') {
  const g = createGame('ATOMIC01', newPlayer('m', 'Moritani', 'moritani'), advanced);
  g.players.push(newPlayer('e', 'Emperor', 'emperor'), newPlayer('a', 'Atreides', 'atreides'));
  const { token } = atomicsFixtureGame(g,
    { moritani: 'm', entrant: 'e', ally: 'a' },
    { advanced, allied: ally, target });
  return { g, token };
}

for (const advanced of [false, true]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} Atomics destroys exact groups, discards excess at random and persists Aftermath`, () => {
    const { g, token } = fixture(advanced);
    const before = structuredClone(g);
    const mCards = seat(g, 'm').hand.map(card => card.id);
    const aCards = seat(g, 'a').hand.map(card => card.id);
    let state = applyAction(g, 'e', ship);
    assert.equal(state.pendingTerrorEntry?.stage, 'offer');
    const owner = viewGame(state, 'm');
    assert.equal(owner.terrorEntry?.kind, 'atomics');
    assert.equal(owner.terrorEntry?.canReveal, true);
    assert.equal('kind' in (viewGame(state, 'e').terrorEntry ?? {}), false);
    assert.equal(viewGame(state, 'e').moritaniAtomics, null);
    state = applyAction(reload(state), 'm', { type: 'decision', reveal: true });
    state = normalizeAutomaticGame(reload(state));
    assert.equal(state.moritaniAtomics?.territory, 'arrakeen');
    assert.equal(state.moritaniAtomics?.allyAtActivation, 'a');
    assert.equal(state.moritaniTerror!.tokens.find(row => row.id === token)!.status, 'removed');
    assert.equal(state.pendingTerrorEntry ?? null, null);
    assert.equal(state.pendingTreacheryDiscard ?? null, null);
    assert.equal(seat(state, 'e').forces['arrakeen:10'] ?? 0, 0);
    assert.equal(seat(state, 'm').forces['arrakeen:10'] ?? 0, 0);
    assert.equal(seat(state, 'a').forces['arrakeen:10'] ?? 0, 0);
    assert.equal(seat(state, 'm').forces['carthag:11'], 1);
    assert.equal(seat(state, 'e').tanks, advanced ? 3 : 2);
    assert.equal(seat(state, 'e').elites?.tanks ?? 0, advanced ? 1 : 0);
    assert.equal(seat(state, 'm').tanks, 0);
    assert.equal(seat(state, 'a').tanks, 2);
    for (const id of ['m', 'a']) {
      assert.equal(seat(state, id).hand.length, 3);
      assert.equal(viewGame(state, id).players.find(p => p.id === id)!.handLimit, 3);
      assert.equal(seat(state, id).atomicsHandLimitPenalty, true);
    }
    assert.equal(state.discard.filter(card => mCards.includes(card.id)).length, 1);
    assert.equal(state.discard.filter(card => aCards.includes(card.id)).length, 1);
    assert.equal(before.moritaniAtomics ?? null, null);
    assert.equal(seat(before, 'e').reserves, advanced ? 19 : 20);
    for (const id of ['m', 'e', 'a'])
      assert.equal(viewGame(state, id).moritaniAtomics?.territory, 'arrakeen');
    rejected(state, 'm', { type: 'decision', reveal: true });
  });
}

void test('Aftermath blocks every ordinary shipment, including Fremen reinforcement, but not movement', () => {
  const { g } = fixture(false, false);
  let state = applyAction(g, 'e', ship);
  state = normalizeAutomaticGame(applyAction(state, 'm', { type: 'decision', reveal: true }));
  assert.equal(viewGame(state, 'e').moritaniAtomics?.territory, 'arrakeen');
  state.active = 'a';
  seat(state, 'a').spice = 20;
  rejected(state, 'a', ship, /Atomics Aftermath/);
  assert.match(String(botArrivalBlock(viewGame(state, 'a'), ship)), /Atomics Aftermath/);
  seat(state, 'a').forces = { 'imperial_basin:10': 2 };
  seat(state, 'a').reserves = 18;
  seat(state, 'a').shipped = true;
  const moved = applyAction(reload(state), 'a', move);
  assert.equal(seat(moved, 'a').forces['arrakeen:10'], 2);
  assert.equal(moved.moritaniAtomics?.territory, 'arrakeen');
});

void test('unallied Atomics destroys Moritani forces but reduces only its own hand', () => {
  const { g } = fixture(false, false);
  seat(g, 'a').forces = {};
  seat(g, 'a').reserves = 20;
  seat(g, 'm').forces = { 'arrakeen:10': 1, 'carthag:11': 1 };
  seat(g, 'm').reserves = 18;
  let state = applyAction(g, 'e', ship);
  state = normalizeAutomaticGame(applyAction(state, 'm', { type: 'decision', reveal: true }));
  assert.equal(state.moritaniAtomics?.allyAtActivation, null);
  assert.equal(seat(state, 'm').tanks, 1);
  assert.equal(seat(state, 'm').forces['carthag:11'], 1);
  assert.equal(seat(state, 'm').hand.length, 3);
  assert.equal(seat(state, 'a').atomicsHandLimitPenalty, undefined);
  assert.equal(viewGame(state, 'a').players.find(p => p.id === 'a')!.handLimit, 4);
});

void test('Harkonnen ally loses one of its eight hand slots and one random physical card', () => {
  const g = createGame('ATOMHARK', newPlayer('m', 'Moritani', 'moritani'));
  g.players.push(newPlayer('e', 'Emperor', 'emperor'), newPlayer('a', 'Harkonnen', 'harkonnen'));
  atomicsFixtureGame(g, { moritani: 'm', entrant: 'e', ally: 'a' });
  seat(g, 'a').hand.push(...g.deck.splice(0, 4));
  const before = seat(g, 'a').hand.map(card => card.id);
  let state = applyAction(g, 'e', ship);
  state = normalizeAutomaticGame(applyAction(state, 'm', { type: 'decision', reveal: true }));
  assert.equal(seat(state, 'a').hand.length, 7);
  assert.equal(viewGame(state, 'a').players.find(p => p.id === 'a')!.handLimit, 7);
  assert.equal(state.discard.filter(card => before.includes(card.id)).length, 1);
});

void test('Fremen free reinforcement into Aftermath is rejected without spending its shipment', () => {
  const { g } = fixture(false, false, 'sietch_tabr');
  g.players.push(newPlayer('f', 'Fremen', 'fremen'));
  g.order.push('f');
  g.movementRemaining!.push('f');
  const arrival: Action = { type: 'ship', territory: 'sietch_tabr', sector: 14, amount: 1 };
  let state = applyAction(g, 'e', arrival);
  state = normalizeAutomaticGame(applyAction(state, 'm', { type: 'decision', reveal: true }));
  state.active = 'f';
  seat(state, 'f').spice = 20;
  rejected(state, 'f', arrival, /Atomics Aftermath/);
  assert.match(String(botArrivalBlock(viewGame(state, 'f'), arrival)), /Atomics Aftermath/);
  assert.equal(seat(state, 'f').shipped, false);
});

void test('Sneak Attack remains a free reserve entry into an Atomics Aftermath stronghold', () => {
  const { g } = fixture(false, false);
  let state = applyAction(g, 'e', ship);
  state = normalizeAutomaticGame(applyAction(state, 'm', { type: 'decision', reveal: true }));
  const token = state.moritaniTerror!.tokens.find(row => row.kind === 'sneakAttack')!;
  state.moritaniTerror = placeTerror(state.moritaniTerror!, token.id, 'arrakeen', state.turn);
  seat(state, 'e').forces = { 'imperial_basin:10': 1 };
  seat(state, 'e').reserves--;
  seat(state, 'e').moved = 0;
  state.active = 'e';
  const entered = applyAction(state, 'e', {
    type: 'move', from: 'imperial_basin:10', amount: 1,
    territory: 'arrakeen', sector: 10,
  });
  assert.equal(entered.pendingTerrorEntry?.stage, 'offer');
  const revealed = applyAction(entered, 'm', { type: 'decision', reveal: true });
  assert.equal(revealed.pendingTerrorEntry?.stage, 'sneakAttack');
  const done = applyAction(revealed, 'm', { type: 'decision', amount: 1 });
  assert.equal(seat(done, 'm').forces['arrakeen:10'], 1);
  assert.equal(done.moritaniAtomics?.territory, 'arrakeen');
});

void test('later Moritani alliances preserve the original penalties while forged targets still reject atomically', () => {
  const { g } = fixture(false, true);
  let state = applyAction(g, 'e', ship);
  state = normalizeAutomaticGame(applyAction(state, 'm', { type: 'decision', reveal: true }));
  state.phase = 1;
  state.nexus = true;
  state.spiceWindow = null;
  state.spiceResolution = null;
  const broken = applyAction(state, 'm', { type: 'alliance', target: null });
  assert.equal(seat(broken, 'm').ally, null);
  assert.equal(seat(broken, 'a').ally, null);
  const offered = applyAction(broken, 'm', { type: 'alliance', target: 'e' });
  const accepted = applyAction(offered, 'e', { type: 'alliance', target: 'm' });
  assert.equal(seat(accepted, 'm').ally, 'e');
  assert.equal(seat(accepted, 'e').ally, 'm');
  assert.equal(seat(accepted, 'a').ally, null);
  assert.deepEqual(accepted.moritaniAtomics, state.moritaniAtomics);
  for (const [id, limit] of [['m',3],['a',3],['e',4]] as const)
    assert.equal(viewGame(accepted,id).players.find(p=>p.id===id)!.handLimit,limit);
  for (const mutate of [
    (game: Game) => { delete seat(game, 'a').atomicsHandLimitPenalty; },
    (game: Game) => { game.moritaniAtomics = { ...game.moritaniAtomics!, allyAtActivation: 'e' }; },
    (game: Game) => { game.moritaniTerror!.tokens.find(row => row.kind === 'atomics')!.status = 'placed'; },
  ]) {
    const damaged = reload(state);
    mutate(damaged);
    rejected(damaged, 'e', { type: 'ready' });
  }
});

void test('a later Nexus lets all four legal policies accept Moritani without moving its permanent penalty', () => {
  const { g } = fixture(false, false);
  let state = applyAction(g, 'e', ship);
  state = normalizeAutomaticGame(applyAction(state, 'm', { type: 'decision', reveal: true }));
  state.phase = 1;
  state.nexus = true;
  state.spiceWindow = null;
  state.spiceResolution = null;
  state.ready = [];
  const offered = applyAction(state, 'm', { type: 'alliance', target: 'e' });
  for (const level of ['Easy','Medium','Hard','Brutal'] as const) {
    const view = viewGame(offered, 'e');
    view.players.find(player => player.id === 'e')!.bot = level;
    const action = botActions(view)[0];
    assert.ok(action);
    const accepted = applyAction(offered,'e',action);
    assert.equal(seat(accepted,'e').ally,'m');
    assert.equal(seat(accepted,'m').ally,'e');
    assert.equal(viewGame(accepted,'e').players.find(p=>p.id==='e')!.handLimit,4);
    assert.equal(viewGame(accepted,'m').players.find(p=>p.id==='m')!.handLimit,3);
    assert.equal(viewGame(accepted,'a').players.find(p=>p.id==='a')!.handLimit,4);
  }
});
