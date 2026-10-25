import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { TERRITORIES, gameDistance, splitLocation } from '../game/board';
import { viewGame, type Game } from '../game/engine';
import { createTruthMovementAdvancedFixture, askTruthMovementAdvanced as askAdvancedMovement } from './fixture-truth-movement-advanced';
import { actTruthMovement as act, advanceTruthMovement as advance,
  truthMovementClean as clean, truthMovementPlayer as player,
  truthMovementInventory as inventory } from './fixture-truth-movement';
import { createAdvisorMatchingMoveFixture } from './fixture-advisor-matching-move';

void test('genuine Advanced Yes binds physical movement and preserves immediate Hajr timing', () => {
  const f = createTruthMovementAdvancedFixture();
  assert.throws(() => act(f.game, f.target, { type: 'card', card: f.hajr! }),
    'Advanced Hajr cannot prepare the initial move');
  let g = askAdvancedMovement(f.game, f.asker, f.truthtrance, f.target);
  assert.deepEqual(viewGame(g, f.target).truthMovementAnswers, ['yes', 'no']);
  g = act(g, f.target, { type: 'truthAnswer', answer: 'yes' });
  assert.throws(() => act(g, f.target, { type: 'endMovement' }));
  g = act(g, f.target, { type: 'move', from: 'arrakeen:10', amount: 4,
    territory: 'imperial_basin', sector: 9 });
  g = advance(g, clean);
  assert.ok(!g.movementPromises![0].fulfilled && !g.movementPromises![0].released);
  const next = viewGame(g, f.target).movementPromisePolicy?.[0];
  assert.deepEqual(next, { type: 'card', card: f.hajr });
  g = advance(act(g, f.target, next!), clean);
  g = act(g, f.target, { type: 'move', from: 'arrakeen:10', amount: 6, territory: 'carthag', sector: 11 });
  assert.equal(g.movementPromises![0].fulfilled, true);
  g = act(advance(g, clean), f.target, { type: 'endMovement' });
  assert.equal(player(g, f.target).forces['carthag:11'], 6);
  assert.deepEqual(inventory(g), f.originalCards);
});

void test('Advanced No remains binding through a genuine later Hajr movement', () => {
  const f = createTruthMovementAdvancedFixture();
  let g = askAdvancedMovement(f.game, f.asker, f.truthtrance, f.target);
  g = act(g, f.target, { type: 'truthAnswer', answer: 'no' });
  g = advance(act(g, f.target, { type: 'move', from: 'arrakeen:10', amount: 4,
    territory: 'imperial_basin', sector: 9 }), clean);
  g = advance(act(g, f.target, { type: 'card', card: f.hajr! }), clean);
  const before = structuredClone(g);
  assert.throws(() => act(g, f.target, { type: 'move', from: 'arrakeen:10', amount: 6,
    territory: 'carthag', sector: 11 }));
  assert.deepEqual(g, before);
  g = act(g, f.target, { type: 'endMovement' });
  assert.equal(g.movementPromises![0].fulfilled, true);
  assert.deepEqual(inventory(g), f.originalCards);
});

void test('an Advanced unused shipment prepares a larger ground group without itself fulfilling Yes', () => {
  const f = createTruthMovementAdvancedFixture();
  let g = askAdvancedMovement(f.beforeShipment, f.asker, f.truthtrance, f.target, 11);
  assert.ok(viewGame(g, f.target).truthMovementAnswers!.includes('yes'));
  g = act(g, f.target, { type: 'truthAnswer', answer: 'yes' });
  const shipment = viewGame(g, f.target).movementPromisePolicy?.[0];
  assert.equal(shipment?.type, 'ship');
  g = advance(act(g, f.target, shipment!), clean);
  assert.ok(!g.movementPromises![0].fulfilled);
  const movement = viewGame(g, f.target).movementPromisePolicy?.[0];
  assert.equal(movement?.type, 'move');
  g = act(g, f.target, movement!);
  assert.equal(g.movementPromises![0].fulfilled, true);
});

function fremenRoute(g: Game, actor: string) {
  const owner = player(g, actor);
  const from = Object.keys(owner.forces).find(key => owner.forces[key] >= 3 && (owner.elites?.forces[key] ?? 0) >= 2);
  assert.ok(from);
  const destination = TERRITORIES.filter(t => t.type === 'sand').flatMap(t =>
    t.sectors.filter(sector => sector !== g.storm).map(sector => ({ territory: t.id, sector })))
    .find(to => gameDistance(g, from, `${to.territory}:${to.sector}`,
      point => splitLocation(point).sector !== 0 && splitLocation(point).sector === g.storm) === 2);
  assert.ok(destination);
  return { type: 'move', forces: { [from]: 3 }, eliteForces: { [from]: 2 }, ...destination };
}

for (const cancel of [false, true]) void test(`native Advanced typed Fremen movement ${cancel ? 'prevention releases an impossible Yes' : 'waits for allowance before fulfillment'}`, () => {
  const f = createTruthMovementAdvancedFixture({ targetFaction: 'fremen', hajr: false });
  const move = fremenRoute(f.game, f.target);
  let g = askAdvancedMovement(f.game, f.asker, f.truthtrance, f.target, 3, move.territory);
  g = act(g, f.target, { type: 'truthAnswer', answer: 'yes' });
  const before = structuredClone(player(g, f.target));
  g = act(g, f.target, move);
  assert.equal(g.response?.kind, 'fremenMovement');
  assert.equal(g.movementPromises![0].fulfilled, undefined);
  assert.equal(g.movementPromises![0].released, undefined);
  assert.deepEqual(player(g, f.target).forces, before.forces);
  if (cancel) {
    assert.ok(f.karama);
    g = act(g, f.asker, { type: 'card', card: f.karama, mode: 'cancel' });
    assert.equal(g.movementPromises![0].released, true);
    assert.deepEqual(player(g, f.target).forces, before.forces);
    assert.equal(player(g, f.target).moved, 0);
  } else {
    g = advance(g, clean);
    assert.equal(g.movementPromises![0].fulfilled, true);
    assert.equal(player(g, f.target).elites!.forces[`${move.territory}:${move.sector}`], 2);
    assert.equal(player(g, f.target).forces[`${move.territory}:${move.sector}`], 3);
  }
  assert.deepEqual(inventory(g), f.originalCards);
});

void test('elite combat strength cannot substitute for eleven physical forces in one movement', () => {
  const f = createTruthMovementAdvancedFixture({ targetFaction: 'fremen', hajr: false });
  const move = fremenRoute(f.game, f.target);
  const g = askAdvancedMovement(f.game, f.asker, f.truthtrance, f.target, 11, move.territory);
  assert.deepEqual(viewGame(g, f.target).truthMovementAnswers, ['no']);
});

for (const cancel of [false, true]) void test(`controlled original Truthtrance plus native BG matching ${cancel ? 'prevention retains a legal replacement' : 'allowance fulfills only at transfer'}`, () => {
  const f = createAdvisorMatchingMoveFixture();
  // Only this card acquisition is controlled; setup, original advisors/fighter,
  // paid shipment, Karama and matching declaration come from the native source.
  const source = structuredClone(f.game), at = source.deck.findIndex(c => c.effect === 'truthtrance');
  assert.ok(at >= 0); const truth = source.deck.splice(at, 1)[0];
  player(source, f.emperor).hand.push(truth);
  let g = askAdvancedMovement(source, f.emperor, truth.id, f.bg, 1, f.destination);
  g = act(g, f.bg, { type: 'truthAnswer', answer: 'yes' });
  const forces = structuredClone(player(g, f.bg).forces);
  g = act(g, f.bg, f.action);
  assert.ok(g.response?.advisorMatchingSource);
  assert.deepEqual(player(g, f.bg).forces, forces);
  assert.ok(!g.movementPromises![0].fulfilled && !g.movementPromises![0].released);
  if (cancel) {
    g = act(g, f.holder, { type: 'card', card: f.karama, mode: 'cancel' });
    assert.ok(!g.movementPromises![0].fulfilled && !g.movementPromises![0].released);
    g = act(g, f.bg, f.ordinaryAction);
  } else g = advance(g, clean);
  assert.equal(g.movementPromises![0].fulfilled, true);
  assert.deepEqual(inventory(g), f.originalInventory);
});

function controlledTruth(game: Game, recipient: string) {
  const at = game.deck.findIndex(card => card.effect === 'truthtrance'); assert.ok(at >= 0);
  const card = game.deck.splice(at, 1)[0]; player(game, recipient).hand.push(card); return card.id;
}
const routeDistance = (g: Game, from: string, to: string) => gameDistance(g, from, to,
  point => splitLocation(point).sector !== 0 && splitLocation(point).sector === g.storm);

for (const cancel of [false, true]) void test(`native pre-first-shipment advisor preparation ${cancel ? 'prevention releases the blocked route' : 'prepares the promised city-range move'}`, () => {
  const f = createAdvisorMatchingMoveFixture();
  let g = act(f.beforeShipment, f.bg, { type: 'bribe', target: f.emperor,
    amount: player(f.beforeShipment, f.bg).spice });
  assert.equal(g.advisorPreparation?.firstShipment, null, 'A real bribe does not close preparation');
  const truth = controlledTruth(g, f.emperor);
  const to = TERRITORIES.filter(t => t.type === 'sand').flatMap(t => t.sectors.map(sector => ({ territory: t.id, sector })))
    .find(to => to.sector !== g.storm && routeDistance(g, 'arrakeen:10', `${to.territory}:${to.sector}`) === 3);
  assert.ok(to);
  g = askAdvancedMovement(g, f.emperor, truth, f.bg, 1, to.territory);
  assert.ok(viewGame(g, f.bg).truthMovementAnswers!.includes('yes'));
  g = act(g, f.bg, { type: 'truthAnswer', answer: 'yes' });
  const preparation = viewGame(g, f.bg).movementPromisePolicy?.[0];
  assert.deepEqual(preparation, { type: 'prepareAdvisors', territory: 'arrakeen' });
  g = act(g, f.bg, preparation!);
  assert.ok(g.response?.advisorPreparationSource);
  assert.ok(!g.movementPromises![0].fulfilled && !g.movementPromises![0].released);
  if (cancel) {
    g = act(g, f.holder, { type: 'card', card: f.karama, mode: 'cancel' });
    assert.equal(g.movementPromises![0].released, true);
  } else {
    g = advance(g, clean);
    const movement = viewGame(g, f.bg).movementPromisePolicy?.[0]; assert.equal(movement?.type, 'move');
    g = act(g, f.bg, movement!); assert.equal(g.movementPromises![0].fulfilled, true);
  }
  assert.deepEqual(inventory(g), f.originalInventory);
});

void test('controlled advisor arrival flip supplies city range for the subsequent original Hajr', () => {
  const f = createAdvisorMatchingMoveFixture();
  let g = structuredClone(f.game);
  const bg = player(g, f.bg), emperor = player(g, f.emperor);
  // Controlled stance, two real reserve counters and original card custody
  // isolate this two-move search boundary; not an unstaged native source.
  bg.advisors!.imperial_basin = {};
  emperor.reserves -= 2; emperor.forces['carthag:11'] = 1; emperor.forces['imperial_basin:9'] = 1;
  const at = g.deck.findIndex(card => card.effect === 'hajr'); assert.ok(at >= 0);
  const hajr = g.deck.splice(at, 1)[0]; bg.hand.push(hajr);
  const truth = controlledTruth(g, f.emperor);
  const to = TERRITORIES.filter(t => t.type === 'sand').flatMap(t => t.sectors.map(sector => ({ territory: t.id, sector })))
    .find(to => to.sector !== g.storm && routeDistance(g, 'carthag:11', `${to.territory}:${to.sector}`) === 3 &&
      routeDistance(g, 'imperial_basin:9', `${to.territory}:${to.sector}`) > 2 &&
      routeDistance(g, 'arrakeen:10', `${to.territory}:${to.sector}`) > 1);
  assert.ok(to);
  g = askAdvancedMovement(g, f.emperor, truth, f.bg, 1, to.territory);
  assert.ok(viewGame(g, f.bg).truthMovementAnswers!.includes('yes'));
  g = act(g, f.bg, { type: 'truthAnswer', answer: 'yes' });
  const first = viewGame(g, f.bg).movementPromisePolicy?.[0];
  assert.equal(first?.type, 'move'); assert.equal(first.territory, 'carthag'); assert.equal(first.fighters, true);
  g = act(g, f.bg, first);
  assert.equal(g.response?.kind, 'advisorFlip');
  assert.ok(!g.movementPromises![0].fulfilled && !g.movementPromises![0].released);
  g = advance(g, clean);
  assert.deepEqual(viewGame(g, f.bg).movementPromisePolicy?.[0], { type: 'card', card: hajr.id });
  g = advance(act(g, f.bg, { type: 'card', card: hajr.id }), clean);
  g = act(g, f.bg, viewGame(g, f.bg).movementPromisePolicy![0]);
  assert.equal(g.movementPromises![0].fulfilled, true);
  assert.deepEqual(inventory(g), f.originalInventory);
});

void test('all four existing policies answer and complete the genuine Advanced movement question legally', () => {
  const f = createTruthMovementAdvancedFixture();
  const question = askAdvancedMovement(f.game, f.asker, f.truthtrance, f.target);
  for (const difficulty of DIFFICULTIES) {
    let g = question, count = 0;
    while (g.phase === 5 && g.active === f.target && count++ < 20) {
      if (!clean(g) && !g.truthtrance) { g = advance(g, clean); continue; }
      const view = viewGame(g, f.target); view.players.find(p => p.id === f.target)!.bot = difficulty;
      const action = botActions(view)[0]; assert.ok(action);
      g = act(g, f.target, action);
    }
    assert.ok(count < 20); assert.equal(g.movementPromises![0].fulfilled, true);
  }
});
