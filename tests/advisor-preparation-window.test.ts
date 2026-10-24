import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, newPlayer, type Game } from '../game/engine';
import { quoteAdvisorBattleOffer } from '../game/movement-phase-quote';
import {
  AdvisorPreparationError,
  projectAdvisorPreparationWindow,
  quoteAdvisorPreparation,
  quoteAdvisorPreparationWindow,
  validateAdvisorPreparation,
  type AdvisorPreparationSource,
  type AdvisorPreparationWindow,
} from '../game/advisor-preparation-window';

const player = (g: Game, id: string) => g.players.find(seat => seat.id === id)!;
function fixture(): Game {
  const g = createGame('ADVISORWINDOW', newPlayer('b', 'Bene Gesserit', 'beneGesserit'), true);
  g.players.push(newPlayer('a', 'Atreides', 'atreides'), newPlayer('h', 'Harkonnen', 'harkonnen'));
  Object.assign(g, { status: 'playing', phase: 2, turn: 3, storm: 18, order: ['h', 'b', 'a'] });
  for (const p of g.players) p.forces = {};
  player(g, 'b').forces = { 'arrakeen:10': 2, 'carthag:11': 1, 'sietch_tabr:14': 1 };
  player(g, 'b').advisors = { arrakeen: {}, carthag: {}, sietch_tabr: {} };
  player(g, 'a').forces = { 'arrakeen:10': 2, 'carthag:11': 2 };
  g.advisorPreparation = { turn: 3, firstShipment: null, deniedTerritories: [] };
  return g;
}

function blocked(g: Game, owner = 'b') {
  const before = structuredClone(g), quote = quoteAdvisorPreparationWindow(g, owner);
  assert.equal(typeof quote.blocked, 'string');
  assert.deepEqual(quote.territories, []);
  assert.throws(() => quoteAdvisorPreparation(g, owner, 'arrakeen'), AdvisorPreparationError);
  assert.deepEqual(g, before);
}

void test('each phase after Spice Blow through the first-shipment deadline reuses native eligibility and releases', () => {
  for (const phase of [2, 3, 4, 5]) {
    const g = fixture(); g.phase = phase;
    const before = structuredClone(g), native = quoteAdvisorBattleOffer(g);
    assert.deepEqual(quoteAdvisorPreparationWindow(g, 'b'), {
      blocked: null, territories: native.territories, released: native.released,
    });
    assert.deepEqual(quoteAdvisorPreparation(g, 'b', 'arrakeen'), { turn: 3, owner: 'b', territory: 'arrakeen' });
    assert.deepEqual(native.territories, ['arrakeen', 'carthag']);
    assert.deepEqual(native.released, [{ player: 'b', territory: 'sietch_tabr' }]);
    assert.deepEqual(g, before);
  }
});

void test('receipt absence, prior turns and stages outside the native Advanced window cannot infer a clock', () => {
  for (const change of [
    (g: Game) => { delete g.advisorPreparation; },
    (g: Game) => { g.advisorPreparation!.turn--; },
    (g: Game) => { g.advisorPreparation!.turn++; },
    (g: Game) => { g.status = 'lobby'; },
    (g: Game) => { g.advanced = false; },
    (g: Game) => { g.phase = 1; },
    (g: Game) => { g.phase = 6; },
    (g: Game) => { g.phase = 2.5; },
    (g: Game) => { g.turn = 0; },
  ]) {
    const g = fixture(); change(g); blocked(g);
  }
});

void test('each actual shipment producer closes the window without consulting player movement or skip flags', () => {
  const producers: NonNullable<AdvisorPreparationWindow['firstShipment']>['producer'][] = [
    'ordinary', 'guildTransport', 'homeworld', 'junction', 'ambassador', 'sneakAttack',
  ];
  for (const producer of producers) {
    const g = fixture();
    g.advisorPreparation!.firstShipment = { player: 'h', producer };
    blocked(g);
    assert.match(quoteAdvisorPreparationWindow(g, 'b').blocked!, /first shipment/);
  }
  const g = fixture();
  for (const p of g.players) { p.shipped = true; p.moved = 2; }
  assert.equal(quoteAdvisorPreparationWindow(g, 'b').blocked, null);
});

void test('malformed current receipts cannot create or reopen preparation', () => {
  const original = fixture();
  for (const receipt of [
    null, [], {}, { turn: 3, firstShipment: null },
    { turn: 3, firstShipment: null, deniedTerritories: ['arrakeen', 'arrakeen'] },
    { turn: 3, firstShipment: null, deniedTerritories: [''] },
    { turn: 3, firstShipment: undefined, deniedTerritories: [] },
    { turn: 3, firstShipment: { player: 'missing', producer: 'ordinary' }, deniedTerritories: [] },
    { turn: 3, firstShipment: { player: 'h', producer: 'skip' }, deniedTerritories: [] },
  ]) {
    const g = structuredClone(original);
    g.advisorPreparation = receipt as AdvisorPreparationWindow;
    blocked(g);
  }
});

void test('only the unique native Bene Gesserit owner receives preparation choices', () => {
  const g = fixture();
  for (const owner of ['a', 'h', 'missing', '']) {
    blocked(g, owner);
    assert.equal(projectAdvisorPreparationWindow(g, owner), null);
  }
  const duplicate = fixture();
  duplicate.players.push(structuredClone(player(duplicate, 'b')));
  blocked(duplicate);
  assert.equal(projectAdvisorPreparationWindow(duplicate, 'b'), null);
});

void test('a denied territory stays unavailable without suppressing another native preparation opportunity', () => {
  const g = fixture();
  g.advisorPreparation!.deniedTerritories = ['arrakeen'];
  const before = structuredClone(g), quote = quoteAdvisorPreparationWindow(g, 'b');
  assert.equal(quote.blocked, null);
  assert.deepEqual(quote.territories, ['carthag']);
  assert.throws(() => quoteAdvisorPreparation(g, 'b', 'arrakeen'), AdvisorPreparationError);
  assert.deepEqual(quoteAdvisorPreparation(g, 'b', 'carthag'), { turn: 3, owner: 'b', territory: 'carthag' });
  assert.deepEqual(g, before);
  g.advisorPreparation!.deniedTerritories.push('carthag');
  blocked(g);
});

void test('storm, allied presence and fresh-advisor locks retain the native quote’s exclusions', () => {
  for (const change of [
    (g: Game) => { g.storm = 10; },
    (g: Game) => { player(g, 'b').advisors!.arrakeen = { lockedTurn: g.turn }; },
    (g: Game) => {
      player(g, 'b').ally = 'h'; player(g, 'h').ally = 'b';
      player(g, 'h').forces = { 'arrakeen:10': 1 };
    },
  ]) {
    const g = fixture(); change(g);
    const before = structuredClone(g), native = quoteAdvisorBattleOffer(g);
    assert.deepEqual(quoteAdvisorPreparationWindow(g, 'b'), {
      blocked: null, territories: ['carthag'], released: native.released,
    });
    assert.throws(() => quoteAdvisorPreparation(g, 'b', 'arrakeen'), AdvisorPreparationError);
    assert.deepEqual(g, before);
  }
});

void test('source validation binds the original owner, territory, turn and still-current board eligibility', () => {
  const original = fixture(), source = quoteAdvisorPreparation(original, 'b', 'arrakeen');
  validateAdvisorPreparation(original, source);
  for (const change of [
    (g: Game) => { g.turn++; },
    (g: Game) => { g.advisorPreparation!.firstShipment = { player: 'a', producer: 'ordinary' }; },
    (g: Game) => { g.advisorPreparation!.deniedTerritories.push('arrakeen'); },
    (g: Game) => { g.storm = 10; },
    (g: Game) => { delete player(g, 'b').advisors!.arrakeen; },
    (g: Game) => { player(g, 'a').forces = { 'carthag:11': 2 }; },
  ]) {
    const g = structuredClone(original); change(g);
    const before = structuredClone(g);
    assert.throws(() => validateAdvisorPreparation(g, source), AdvisorPreparationError);
    assert.deepEqual(g, before);
  }
  assert.throws(() => validateAdvisorPreparation(original, { ...source, owner: 'a' }), AdvisorPreparationError);
  assert.throws(() => validateAdvisorPreparation(original, { ...source, territory: 'sietch_tabr' }), AdvisorPreparationError);
});

void test('malformed declarations fail with the focused error before any mutation', () => {
  const g = fixture(), source = quoteAdvisorPreparation(g, 'b', 'arrakeen'), before = structuredClone(g);
  for (const malformed of [
    null, [], {}, { ...source, turn: -1 }, { ...source, owner: '' },
    { ...source, territory: '' }, { ...source, amount: 1 },
  ]) assert.throws(() => validateAdvisorPreparation(g, malformed as AdvisorPreparationSource), AdvisorPreparationError);
  assert.deepEqual(g, before);
});

void test('public-board failures stay in the focused quote without returning partial choices', () => {
  const g = fixture(); g.order = ['b', 'b', 'h'];
  blocked(g);
  const malformed = fixture();
  player(malformed, 'b').advisors!.arrakeen = { lockedTurn: -1 };
  blocked(malformed);
});

void test('the pure source quote does not gate its own response on live priority or reset an invoice', () => {
  const g = fixture(), source = quoteAdvisorPreparation(g, 'b', 'arrakeen');
  g.response = { kind: 'advisorFlip', owner: 'b', location: 'arrakeen', advisors: false, passed: [] };
  const before = structuredClone(g);
  validateAdvisorPreparation(g, source);
  assert.deepEqual(g, before);
});

void test('owner projection contains no counts, private resources, receipt payload or unrelated seat choices', () => {
  const g = fixture();
  for (const p of g.players)
    for (const key of ['spice', 'tanks', 'hand', 'leaders'] as const)
      Object.defineProperty(p, key, { get() { throw new Error(`Preparation read private ${key}`); } });
  assert.deepEqual(projectAdvisorPreparationWindow(g, 'b'), {
    blocked: null, territories: ['arrakeen', 'carthag'],
  });
  assert.deepEqual(Object.keys(projectAdvisorPreparationWindow(g, 'b')!).sort(), ['blocked', 'territories']);
  assert.equal(projectAdvisorPreparationWindow(g, 'a'), null);
  g.advanced = false;
  assert.equal(projectAdvisorPreparationWindow(g, 'b'), null);
});
