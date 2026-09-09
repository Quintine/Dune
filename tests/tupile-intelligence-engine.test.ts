import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, normalizeAutomaticGame, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import {
  holdTupileCard, positionTupileContact, tupileIntelligenceFixture,
  tupileInventory, tupilePlayer, tupileReject, tupileReload,
} from './fixture-tupile-intelligence';

const request = (category = 'weapons', target = 'a') => ({ type: 'tupileIntelligence', target, category });
function heldAnswer(g: Game): void {
  for (const kind of ['projectile', 'shield', 'worthless', 'ghola']) holdTupileCard(g, 'a', kind);
  tupilePlayer(g, 'a').spice = 13;
}

void test('actual Tupile contact grants one private snapshot off turn, without a response or material cost', () => {
  for (const advanced of [false, true]) {
    const g = tupileIntelligenceFixture({ advanced });
    heldAnswer(g);
    g.active = 'h';
    const before = tupileReload(g);
    const next = applyAction(g, 'c', request());
    assert.deepEqual(g, before);
    const receipt = viewGame(next, 'c').tupileIntelligence!.receipts[0];
    assert.deepEqual({ ...receipt, event: 'event' }, {
      event: 'event', target: 'a', faction: 'atreides', category: 'weapons', spice: 13, count: 1, turn: 2, phase: 5,
    });
    assert.deepEqual(next.players, before.players);
    assert.deepEqual(next.homeworlds, before.homeworlds);
    assert.equal(next.active, 'h');
    assert.equal(next.response, null);
    assert.equal(next.decision, null);
    assert.equal(next.tupileIntelligence!.receipts.length, 1);
    assert.deepEqual(next.homeworldOccupationHistory!.qualifications, []);
    tupileInventory(next);
  }
});

void test('all seat views keep the unchosen count and private receipt out of opponents and public logs', () => {
  const g = tupileIntelligenceFixture();
  heldAnswer(g);
  const next = applyAction(g, 'c', request('defenses'));
  const receipt = next.tupileIntelligence!.receipts[0];
  for (const id of ['c', 'a', 'h']) {
    const view = viewGame(next, id);
    assert.deepEqual(Object.keys(view.tupileIntelligence?.receipts[0] ?? {}).sort(), id === 'c'
      ? ['category', 'count', 'event', 'faction', 'phase', 'spice', 'target', 'turn'] : []);
    if (id !== 'c') {
      assert.equal(view.tupileIntelligence, null);
      assert.equal(JSON.stringify(view).includes(receipt.event), false);
      assert.equal(JSON.stringify(view).includes(receipt.signature), false);
    }
    for (const other of view.players.filter((p) => p.id !== id)) assert.equal(other.hand, undefined);
  }
  const publicLog = JSON.stringify(next.log.slice(g.log.length));
  assert.match(publicLog, /Tupile intelligence/);
  assert.doesNotMatch(publicLog, /13|defenses|weapons|"count"|"spice"/);
});

void test('a foreign arrival on garrisoned Tupile grants contact independently for each opposing faction', () => {
  let g = tupileIntelligenceFixture({ contact: false });
  for (const [id, faction] of [['a', 'atreides'], ['h', 'harkonnen']]) {
    g.active = id;
    g = applyAction(g, id, {
      type: 'homeworldShip', event: viewGame(g, id).homeworldShipment!.event,
      destination: 'homeworld:choam', sources: { [`homeworld:${faction}`]: { normal: 1, elite: 0 } },
    });
    assert.deepEqual(g.homeworldOccupationHistory!.qualifications, []);
    const target = viewGame(g, 'c').tupileIntelligence!.targets.find((seat) => seat.player === id)!;
    assert.deepEqual(target.contact, ['homeworld:choam']);
    assert.equal(target.blocked, null);
    g = applyAction(g, 'c', request('defenses', id));
  }
  assert.deepEqual(g.tupileIntelligence!.receipts.map((receipt) => receipt.faction), ['atreides', 'harkonnen']);
  assert.equal(tupilePlayer(g, 'c').reserves, 10);
  tupileInventory(g);
});

void test('the lifetime faction use survives category changes, later phases, departure and reentry', () => {
  let g = applyAction(tupileIntelligenceFixture(), 'c', request());
  for (const category of ['weapons', 'defenses']) tupileReject(g, 'c', request(category), /already been used/);
  positionTupileContact(g, false);
  g.turn = 3;
  g.phase = 2;
  positionTupileContact(g, true);
  g = tupileReload(g);
  assert.equal(viewGame(g, 'c').tupileIntelligence!.receipts.length, 1);
  tupileReject(g, 'c', request('defenses'), /already been used/);
  assert.deepEqual(normalizeAutomaticGame(g).tupileIntelligence, g.tupileIntelligence);
  tupileInventory(g);
});

void test('JSON reload retains the historical answer when the target spends spice and exchanges held cards', () => {
  let g = tupileIntelligenceFixture();
  heldAnswer(g);
  g = applyAction(g, 'c', request());
  const answer = structuredClone(viewGame(g, 'c').tupileIntelligence!.receipts);
  const target = tupilePlayer(g, 'a');
  target.spice = 0;
  g.deck.push(...target.hand.splice(0));
  holdTupileCard(g, 'a', 'shield');
  positionTupileContact(g, false);
  g = normalizeAutomaticGame(tupileReload(g));
  assert.deepEqual(viewGame(g, 'c').tupileIntelligence!.receipts, answer);
  assert.equal(target.hand.length, 1);
  tupileInventory(g);
});

void test('current population, contact, pending timing and malformed requests reject without changing the game', () => {
  const g = tupileIntelligenceFixture();
  const high = tupileReload(g);
  tupilePlayer(high, 'c').reserves += 2;
  tupilePlayer(high, 'c').forces['polar_sink:0'] -= 2;
  tupileReject(high, 'c', request(), /at most ten/);
  const absent = tupileReload(g);
  positionTupileContact(absent, false);
  tupileReject(absent, 'c', request(), /must be on/);
  const opening = tupileReload(g);
  opening.phaseOpening = { passed: [], initialize: false };
  assert.match(viewGame(opening, 'c').tupileIntelligence!.blocked!, /Finish/);
  tupileReject(opening, 'c', request(), /Finish/);
  tupileReject(g, 'a', request(), /Only CHOAM/);
  for (const action of [request('both'), request('weapons', 'c'), request('weapons', 'missing'), { ...request(), count: 0 }, { ...request(), spice: 0 }])
    tupileReject(g, 'c', action);
  assert.deepEqual(g.tupileIntelligence!.receipts, []);
});

void test('deleted receipts or mismatched initialized history reject projection, normalization and actions immutably', () => {
  const original = applyAction(tupileIntelligenceFixture(), 'c', request());
  const corruptions: ((g: Game) => void)[] = [
    (g) => { g.tupileIntelligence!.receipts = []; },
    (g) => { g.tupileIntelligence!.receipts[0].count++; },
    (g) => { g.tupileIntelligence!.receipts[0].category = 'defenses'; },
    (g) => { delete g.tupileIntelligence; },
    (g) => { delete g.homeworldOccupationHistory; },
    (g) => { delete g.homeworlds!.historyVersion; },
  ];
  for (const corrupt of corruptions) {
    const broken = tupileReload(original);
    corrupt(broken);
    const before = tupileReload(broken);
    for (const id of ['c', 'a', 'h']) assert.throws(() => viewGame(broken, id), /ledger|history|observation/i);
    assert.throws(() => normalizeAutomaticGame(broken), /ledger|history|observation/i);
    tupileReject(broken, 'c', request('defenses'), /ledger|history|observation/i);
    assert.deepEqual(broken, before);
  }
});

void test('legacy saves with no initialized history remain readable but cannot invent a fresh intelligence allowance', () => {
  const g = tupileIntelligenceFixture();
  delete g.homeworlds!.historyVersion;
  delete g.homeworldOccupationHistory;
  delete g.tupileIntelligence;
  const before = tupileReload(g);
  for (const id of ['c', 'a', 'h']) {
    const view = viewGame(g, id);
    if (id === 'c') {
      assert.match(view.tupileIntelligence!.blocked!, /lacks the original/);
      assert.deepEqual(view.tupileIntelligence!.receipts, []);
    } else assert.equal(view.tupileIntelligence, null);
  }
  tupileReject(g, 'c', request(), /lacks the original/);
  const normalized = normalizeAutomaticGame(g);
  assert.equal(normalized.tupileIntelligence, undefined);
  assert.equal(normalized.homeworldOccupationHistory, undefined);
  assert.deepEqual(g, before);
});

void test('every real bot profile emits a legal owned request and stops after using that faction', () => {
  for (const profile of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const g = tupileIntelligenceFixture();
    g.active = 'a';
    tupilePlayer(g, 'c').bot = profile;
    const actions = botActions(viewGame(g, 'c'));
    assert.deepEqual(actions, [request()]);
    const next = applyAction(g, 'c', actions[0]);
    assert.equal(next.tupileIntelligence!.receipts.length, 1);
    assert.equal(botActions(viewGame(next, 'c')).some((action) => action.type === 'tupileIntelligence'), false);
  }
});
