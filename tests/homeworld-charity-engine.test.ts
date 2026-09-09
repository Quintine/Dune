import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeHomeworldGameForAudit,
  joinGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { homeworldGameIntegrity } from '../game/homeworld-game';
import { richeseCards } from '../game/richese-cards';

const seat = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function setup(advanced = true, ix = false) {
  let g = createGame(
    'HOMECHARITYENGINE',
    newPlayer('a', 'Atreides', 'atreides'),
    advanced,
    ix ? ['ix', 'choam'] : ['choam'],
  );
  joinGame(g, newPlayer('b', 'Bene Gesserit', 'beneGesserit'));
  joinGame(g, newPlayer('c', 'CHOAM', 'choam'));
  // Audit CHOAM's faction with only the implemented physical base/Ix deck.
  // The lobby roster is final before any setup pieces or history are created.
  g.expansions = ix ? ['ix'] : [];
  g = applyAction(g, 'a', { type: 'homeworlds', enabled: true });
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  g = initializeHomeworldGameForAudit(g);
  for (let i = 0; g.status === 'setup' && i < 30; i++) {
    let next: Game | undefined;
    for (const p of g.players) {
      const view = viewGame(g, p.id);
      view.players.find((owner) => owner.id === p.id)!.bot = 'Easy';
      const [command] = botActions(view);
      if (!command) continue;
      next = applyAction(g, p.id, command);
      break;
    }
    assert.ok(next, 'Genuine setup must have a legal next action.');
    g = reload(next);
  }
  assert.equal(g.status, 'playing');
  // Keep all physical cards, while isolating explicit cancellation holders.
  for (const p of g.players) g.deck.push(...p.hand.splice(0));
  g.phase = 2;
  g.phaseOpening = null;
  g.response = null;
  g.decision = null;
  g.ready = [];
  low(g, 'a', 5);
  low(g, 'b', 10);
  return g;
}
function low(g: Game, id: string, reserves: number) {
  const p = seat(g, id);
  const departing = p.reserves - reserves;
  assert.ok(departing >= 0);
  p.reserves = reserves;
  p.forces['imperial_basin:10'] =
    (p.forces['imperial_basin:10'] ?? 0) + departing;
  homeworldGameIntegrity(g);
}
function choam(g: Game) {
  // Faction identity and both histories originate in genuine setup. Stage only
  // the phase's existing payer balance/settlement, preserving physical custody.
  const p = seat(g, 'c');
  assert.equal(p.faction, 'choam');
  p.spice = 12;
  g.choamCharity = { turn: g.turn, canceled: false };
  homeworldGameIntegrity(g);
  return g;
}
function holdKarama(g: Game, id = 'a') {
  const index = g.deck.findIndex((card) => card.effect === 'karama');
  assert.ok(index >= 0);
  const [card] = g.deck.splice(index, 1);
  seat(g, id).hand.push(card);
  return card;
}
function allow(state: Game) {
  let g = state;
  for (let i = 0; g.response && i < 10; i++) {
    const p = g.players.find((p) => !g.response!.passed.includes(p.id))!;
    assert.ok(p);
    g = applyAction(g, p.id, { type: 'passResponse' });
  }
  assert.equal(g.response, null);
  return g;
}
function rejects(g: Game, id: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, id, action));
  assert.deepEqual(g, before);
}
function privacy(g: Game) {
  for (const p of g.players) {
    const view = viewGame(reload(g), p.id);
    for (const other of view.players.filter((other) => other.id !== p.id)) {
      assert.equal(other.hand, undefined);
      assert.equal(other.traitors, undefined);
      assert.equal(other.prediction, undefined);
    }
  }
}

void test('actual poor claims collect a bank low bonus while CHOAM pays only ordinary need, including supported Ix deck setup', () => {
  for (const ix of [false, true])
    for (const spice of [0, 1]) {
      let g = choam(setup(false, ix));
      seat(g, 'a').spice = spice;
      const before = structuredClone(g);
      const view = viewGame(g, 'a');
      assert.equal(view.charity.amount, 3 - spice);
      g = applyAction(g, 'a', { type: 'charity' });
      assert.equal(seat(g, 'a').spice, 3);
      assert.equal(seat(g, 'c').spice, 12 - (2 - spice));
      assert.equal(seat(g, 'a').charityTurn, g.turn);
      assert.deepEqual(
        g.players.map((p) => p.forces),
        before.players.map((p) => p.forces),
      );
      assert.deepEqual(g.homeworlds, before.homeworlds);
      assert.deepEqual(g.deck, before.deck);
      privacy(g);
      const saved = reload(g);
      assert.deepEqual(reload(normalizeAutomaticGame(saved)), saved);
      rejects(saved, 'a', { type: 'charity' });
    }
});

void test('wealthy Advanced BG waits for actual held Karama response and pays neither portion when the claim is canceled', () => {
  for (const canceled of [false, true]) {
    let g = choam(setup());
    seat(g, 'b').spice = 12;
    const card = holdKarama(g);
    g = applyAction(g, 'b', { type: 'charity' });
    assert.equal(g.response?.kind, 'bgCharity');
    assert.equal(g.response?.amount, 3);
    assert.equal(g.response?.charityHomeworld, 1);
    assert.equal(seat(g, 'b').spice, 12);
    assert.equal(seat(g, 'c').spice, 12);
    privacy(g);
    g = canceled
      ? applyAction(reload(g), 'a', {
          type: 'card',
          card: card.id,
          mode: 'cancel',
        })
      : allow(reload(g));
    assert.equal(seat(g, 'b').spice, canceled ? 12 : 15);
    assert.equal(seat(g, 'c').spice, canceled ? 12 : 10);
    assert.equal(
      g.discard.filter((c) => c.id === card.id).length,
      canceled ? 1 : 0,
    );
    assert.equal(seat(g, 'b').charityTurn, g.turn);
    rejects(reload(g), 'b', { type: 'charity' });
    const saved = reload(g);
    assert.deepEqual(reload(normalizeAutomaticGame(saved)), saved);
  }
});

void test('Inflation doubles the ordinary and bank portions after placement and canceled charity offers no payable claim', () => {
  for (const bg of [false, true]) {
    let g = choam(setup());
    const id = bg ? 'b' : 'a';
    seat(g, id).spice = bg ? 9 : 1;
    g.turn = 2;
    g.choamCharity!.turn = 2;
    g.inflation = {
      side: 'double',
      placedTurn: 1,
      updatedTurn: 1,
      flipped: false,
    };
    holdKarama(g);
    g = applyAction(g, id, { type: 'charity' });
    if (bg) {
      assert.equal(g.response?.charityHomeworld, 2);
      assert.equal(g.response?.amount, 6);
      g = allow(reload(g));
    }
    assert.equal(seat(g, id).spice, bg ? 15 : 5);
    assert.equal(seat(g, 'c').spice, bg ? 8 : 10);
    const cancel = choam(setup());
    cancel.turn = 2;
    cancel.choamCharity!.turn = 2;
    cancel.inflation = { ...g.inflation!, side: 'cancel' };
    seat(cancel, id).spice = bg ? 9 : 1;
    assert.equal(viewGame(cancel, id).charity.amount, 0);
    rejects(cancel, id, { type: 'charity' });
  }
});

void test('actual cancellation of CHOAM phase-opening income makes both ordinary charity and the low bonus bank-paid', () => {
  let g = choam(setup());
  g.phase = 1;
  g.nexus = true;
  g.choamCharity = undefined;
  seat(g, 'a').spice = 0;
  const card = holdKarama(g);
  const originalPayer = seat(g, 'c').spice;
  for (const id of ['a', 'b', 'c']) g = applyAction(g, id, { type: 'ready' });
  while (g.decision?.kind === 'choamMarket')
    g = applyAction(g, 'c', { type: 'decision', done: true });
  assert.equal(g.phase, 2);
  assert.equal(g.response?.kind, 'choamCharity');
  g = applyAction(reload(g), 'a', {
    type: 'card',
    card: card.id,
    mode: 'cancel',
  });
  assert.deepEqual(g.choamCharity, { turn: g.turn, canceled: true });
  assert.equal(seat(g, 'c').spice, originalPayer);
  assert.equal(viewGame(g, 'a').charity.payer, null);
  g = applyAction(g, 'a', { type: 'charity' });
  assert.equal(seat(g, 'a').spice, 3);
  assert.equal(seat(g, 'c').spice, originalPayer);
  rejects(reload(g), 'a', { type: 'charity' });
});

void test('the bank bonus never creates ordinary eligibility or makes CHOAM fund more than its exact ordinary portion', () => {
  let g = choam(setup(false));
  seat(g, 'a').spice = 2;
  seat(g, 'b').spice = 9;
  rejects(g, 'a', { type: 'charity' });
  rejects(g, 'b', { type: 'charity' });
  seat(g, 'a').spice = 1;
  seat(g, 'c').spice = 0;
  rejects(g, 'a', { type: 'charity' });
  seat(g, 'c').spice = 1;
  g = applyAction(g, 'a', { type: 'charity' });
  assert.equal(seat(g, 'a').spice, 3);
  assert.equal(seat(g, 'c').spice, 0);
});

void test('a forged saved BG bank split or total is rejected unchanged before allowance and Karama card spend', () => {
  let g = choam(setup());
  seat(g, 'b').spice = 12;
  const card = holdKarama(g);
  g = applyAction(g, 'b', { type: 'charity' });
  for (const edit of [
    (state: Game) => {
      state.response!.charityHomeworld = 99;
    },
    (state: Game) => {
      state.response!.charityHomeworld = 0;
    },
    (state: Game) => {
      state.response!.amount = 99;
    },
  ]) {
    const corrupt = reload(g);
    edit(corrupt);
    rejects(corrupt, 'a', { type: 'passResponse' });
    rejects(corrupt, 'a', { type: 'card', card: card.id, mode: 'cancel' });
    const before = structuredClone(corrupt);
    assert.throws(() => normalizeAutomaticGame(corrupt));
    assert.throws(() => viewGame(corrupt, 'b'));
    assert.deepEqual(corrupt, before);
  }
});

void test('a paid Nullentropy search preserves the actual BG charity split and rejects forged saved parents before selection', () => {
  let g = choam(setup());
  seat(g, 'a').spice = 10;
  seat(g, 'b').spice = 12;
  holdKarama(g);
  // Canonical Richese component seam, matching the existing Box engine tests.
  // This does not certify Richese setup: stage its complete separate cache,
  // then relocate its unique Box and two genuinely dealt base cards.
  g.richeseCache = richeseCards();
  const boxIndex = g.richeseCache.findIndex(
    (card) => card.effect === 'nullentropyBox',
  );
  assert.ok(boxIndex >= 0);
  const [box] = g.richeseCache.splice(boxIndex, 1);
  seat(g, 'a').hand.push(box);
  for (const name of ['Shield', 'Maula Pistol']) {
    const index = g.deck.findIndex((card) => card.name === name);
    assert.ok(index >= 0);
    g.discard.push(...g.deck.splice(index, 1));
  }
  const inventory = (state: Game) =>
    [
      ...state.deck,
      ...state.discard,
      ...state.richeseCache!,
      ...state.players.flatMap((p) => p.hand),
    ].sort((a, b) => a.id.localeCompare(b.id));
  const cardsBefore = structuredClone(inventory(g));
  const forcesBefore = structuredClone(g.players.map((p) => p.forces));
  g = applyAction(g, 'b', { type: 'charity' });
  assert.equal(g.response?.kind, 'bgCharity');
  assert.equal(g.response.amount, 3);
  assert.equal(g.response.charityHomeworld, 1);
  const parent = structuredClone(g.response);
  g = applyAction(reload(g), 'a', { type: 'card', card: box.id });
  assert.equal(g.decision?.kind, 'nullentropy');
  assert.equal(g.response, null);
  assert.deepEqual(g.pendingNullentropy!.resume.response, parent);
  assert.equal(seat(g, 'a').spice, 8);
  assert.equal(seat(g, 'b').spice, 12);
  assert.equal(seat(g, 'c').spice, 12);
  privacy(g);
  const selected = g.discard[0].id;
  const command: Action = {
    type: 'decision',
    event: g.pendingNullentropy!.event,
    card: selected,
  };
  for (const patch of [
    { amount: 9 },
    { charityHomeworld: 7 },
    { amount: 9, charityHomeworld: 7 },
  ]) {
    const corrupt = reload(g);
    Object.assign(corrupt.pendingNullentropy!.resume.response!, patch);
    const before = structuredClone(corrupt);
    for (const p of corrupt.players)
      assert.throws(() => viewGame(corrupt, p.id));
    assert.throws(() => normalizeAutomaticGame(corrupt));
    rejects(corrupt, 'a', command);
    assert.deepEqual(corrupt, before);
  }
  const saved = reload(g);
  assert.deepEqual(reload(normalizeAutomaticGame(saved)), saved);
  g = applyAction(saved, 'a', command);
  assert.equal(g.pendingNullentropy, null);
  assert.deepEqual(g.response, parent);
  assert.equal(seat(g, 'a').spice, 8);
  assert.equal(seat(g, 'b').spice, 12);
  assert.equal(seat(g, 'c').spice, 12);
  assert.equal(g.discard.at(-1)?.id, box.id);
  assert.equal(
    seat(g, 'a').hand.filter((card) => card.id === selected).length,
    1,
  );
  g = allow(reload(g));
  assert.equal(seat(g, 'b').spice, 15);
  assert.equal(seat(g, 'c').spice, 10);
  assert.equal(seat(g, 'a').spice, 8);
  assert.deepEqual(inventory(g), cardsBefore);
  assert.deepEqual(
    g.players.map((p) => p.forces),
    forcesBefore,
  );
  assert.deepEqual(reload(normalizeAutomaticGame(reload(g))), reload(g));
  rejects(reload(g), 'a', command);
  rejects(reload(g), 'b', { type: 'charity' });
  homeworldGameIntegrity(g);
});
