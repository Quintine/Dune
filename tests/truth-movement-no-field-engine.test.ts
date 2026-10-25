import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Game } from '../game/engine';
import { TERRITORIES, gameDistance, splitLocation } from '../game/board';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { askTruthMovementAdvanced as ask } from './fixture-truth-movement-advanced';
import { createTruthMovementNoFieldFixture as fixture, actTruthMovementNoField as act,
  advanceTruthMovementNoField as advance, truthMovementNoFieldClean as clean,
  truthMovementNoFieldPlayer as player, truthMovementNoFieldInventory as inventory } from './fixture-truth-movement-no-field';

for (const advanced of [false, true]) void test(`native ${advanced ? 'Advanced' : 'Basic'} No-Field reveal prepares five physical forces without fulfilling movement early`, () => {
  const f = fixture({ advanced });
  let g = ask(f.game, f.asker, f.truthtrance, f.target, 5, 'arrakeen');
  assert.deepEqual(viewGame(g, f.target).truthMovementAnswers, ['yes', 'no']);
  g = advance(act(g, f.target, { type: 'truthAnswer', answer: 'yes' }), clean);
  const old = structuredClone(player(g, f.target)), reveal = viewGame(g, f.target).movementPromisePolicy?.[0];
  assert.equal(reveal?.type, 'revealNoField');
  g = act(g, f.target, reveal!);
  assert.equal(player(g, f.target).reserves, old.reserves - 5);
  assert.equal(player(g, f.target).noField?.lastShipped, old.noField?.lastShipped);
  assert.equal(player(g, f.target).moved, 0); assert.ok(!g.movementPromises![0].fulfilled);
  const move = viewGame(g, f.target).movementPromisePolicy?.[0]; assert.equal(move?.type, 'move');
  g = act(g, f.target, move!); assert.equal(g.movementPromises![0].fulfilled, true);
  assert.equal(player(g, f.target).forces['arrakeen:10'], 5);
  assert.deepEqual(inventory(g), f.originalCards);
});

for (const advanced of [false, true]) void test(`${advanced ? 'Advanced' : 'Basic'} one-spice native No-Field shipment and reveal supply the promised five-force ground move`, () => {
  const f = fixture({ advanced });
  let g = act(f.beforeShipment, f.target, { type: 'bribe', target: f.asker,
    amount: player(f.beforeShipment, f.target).spice - 1 });
  g = ask(g, f.asker, f.truthtrance, f.target, 5, 'arrakeen');
  assert.ok(viewGame(g, f.target).truthMovementAnswers!.includes('yes'));
  g = advance(act(g, f.target, { type: 'truthAnswer', answer: 'yes' }), clean);
  const shipment = viewGame(g, f.target).movementPromisePolicy?.[0];
  assert.equal(shipment?.type, 'ship'); assert.ok(shipment.noField);
  g = advance(act(g, f.target, shipment), clean);
  assert.ok(!g.movementPromises![0].fulfilled && !g.movementPromises![0].released);
  assert.equal(player(g, f.target).spice, 0); assert.equal(player(g, f.target).reserves, 20);
  g = act(g, f.target, viewGame(g, f.target).movementPromisePolicy![0]);
  assert.ok(!g.movementPromises![0].fulfilled);
  g = act(g, f.target, viewGame(g, f.target).movementPromisePolicy![0]);
  assert.equal(g.movementPromises![0].fulfilled, true); assert.deepEqual(inventory(g), f.originalCards);
});

void test('native zero marker is presence rather than a promised physical force', () => {
  const f = fixture({ value: 0 });
  const g = ask(f.game, f.asker, f.truthtrance, f.target, 1, 'arrakeen');
  assert.deepEqual(viewGame(g, f.target).truthMovementAnswers, ['no']);
});

void test('controlled scarce reserves cap owned reveal preparation without changing printed token value', () => {
  const f = fixture(), source = structuredClone(f.game), own = player(source, f.target);
  // Controlled original reserve-to-Tanks allocation, not a native casualty claim.
  own.tanks += own.reserves - 2; own.reserves = 2;
  const impossible = ask(source, f.asker, f.truthtrance, f.target, 3, 'arrakeen');
  assert.deepEqual(viewGame(impossible, f.target).truthMovementAnswers, ['no']);
  let g = ask(source, f.asker, f.truthtrance, f.target, 2, 'arrakeen');
  g = advance(act(g, f.target, { type: 'truthAnswer', answer: 'yes' }), clean);
  g = act(g, f.target, viewGame(g, f.target).movementPromisePolicy![0]);
  assert.equal(player(g, f.target).reserves, 0); assert.equal(player(g, f.target).forces['imperial_basin:9'], 2);
  g = act(g, f.target, viewGame(g, f.target).movementPromisePolicy![0]);
  assert.equal(g.movementPromises![0].fulfilled, true); assert.deepEqual(inventory(g), f.originalCards);
});

const distance = (g: Game, from: string, to: string) => gameDistance(g, from, to,
  point => splitLocation(point).sector !== 0 && splitLocation(point).sector === g.storm);
function controlledPhysical(g: Game, actor: string, amount: number) {
  const own = player(g, actor); own.reserves -= amount; own.forces['imperial_basin:9'] = amount;
}

for (const advanced of [false, true]) void test(`controlled ${advanced ? 'Advanced' : 'Basic'} zero-marker city positioning prepares physical Hajr movement without counting the marker`, () => {
  const f = fixture({ advanced, value: 0 }); let g = structuredClone(f.game);
  // Original physical reserve counters and original Hajr are conserved controls.
  controlledPhysical(g, f.target, 2);
  const at = g.deck.findIndex(card => card.effect === 'hajr'); assert.ok(at >= 0);
  const hajr = g.deck.splice(at, 1)[0]; player(g, f.target).hand.push(hajr);
  const to = TERRITORIES.filter(t => t.type === 'sand').flatMap(t => t.sectors.map(sector => ({ territory: t.id, sector })))
    .find(to => to.sector !== g.storm && distance(g, 'imperial_basin:9', `${to.territory}:${to.sector}`) === 3);
  assert.ok(to);
  g = ask(g, f.asker, f.truthtrance, f.target, 2, to.territory);
  g = advance(act(g, f.target, { type: 'truthAnswer', answer: 'yes' }), clean);
  const first = viewGame(g, f.target).movementPromisePolicy?.[0];
  assert.equal(first?.type, 'move'); assert.equal(first.noField, f.token); assert.deepEqual(first.forces, {});
  g = advance(act(g, f.target, first), clean);
  assert.ok(!g.movementPromises![0].fulfilled && !g.movementPromises![0].released);
  const play = viewGame(g, f.target).movementPromisePolicy?.[0]; assert.equal(play?.card, hajr.id);
  g = advance(act(g, f.target, play!), clean);
  g = act(g, f.target, viewGame(g, f.target).movementPromisePolicy![0]);
  assert.equal(g.movementPromises![0].fulfilled, true); assert.deepEqual(inventory(g), f.originalCards);
});

void test('a mixed physical-plus-marker move fulfills only its physical quantity', () => {
  const f = fixture({ value: 0 }), source = structuredClone(f.game);
  controlledPhysical(source, f.target, 3);
  const impossible = ask(source, f.asker, f.truthtrance, f.target, 4, 'arrakeen');
  assert.deepEqual(viewGame(impossible, f.target).truthMovementAnswers, ['no']);
  let g = ask(source, f.asker, f.truthtrance, f.target, 3, 'arrakeen');
  g = advance(act(g, f.target, { type: 'truthAnswer', answer: 'yes' }), clean);
  g = act(g, f.target, { type: 'move', forces: { 'imperial_basin:9': 3 },
    noField: f.token, event: player(g, f.target).noFieldEvent, territory: 'arrakeen', sector: 10 });
  assert.equal(g.movementPromises![0].fulfilled, true);
  assert.equal(player(g, f.target).forces['arrakeen:10'], 3);
  assert.equal(player(g, f.target).noField?.deployed?.location.territory, 'arrakeen');
});

void test('controlled original Karama prevents a native No-Field preparation before payment and releases its now impossible promise', () => {
  const f = fixture(), source = structuredClone(f.beforeShipment);
  const at = source.deck.findIndex(card => card.effect === 'karama'); assert.ok(at >= 0);
  const karama = source.deck.splice(at, 1)[0]; player(source, f.asker).hand.push(karama);
  let g = act(source, f.target, { type: 'bribe', target: f.asker, amount: player(source, f.target).spice - 1 });
  g = ask(g, f.asker, f.truthtrance, f.target, 5, 'arrakeen');
  g = advance(act(g, f.target, { type: 'truthAnswer', answer: 'yes' }), clean);
  const before = structuredClone(player(g, f.target)), shipment = viewGame(g, f.target).movementPromisePolicy?.[0];
  assert.ok(shipment?.noField);
  g = act(g, f.target, shipment);
  assert.equal(g.response?.kind, 'richeseNoField');
  assert.deepEqual(player(g, f.target).noField, before.noField);
  assert.equal(player(g, f.target).spice, before.spice);
  assert.ok(!g.movementPromises![0].fulfilled && !g.movementPromises![0].released);
  g = act(g, f.asker, { type: 'card', card: karama.id, mode: 'cancel' });
  assert.equal(player(g, f.target).shipped, false); assert.equal(player(g, f.target).spice, before.spice);
  // The original Karama disposal must finish its native Semuta offer before
  // the deferred prevention and impossibility release actually settle.
  if (g.pendingTreacheryDiscard) assert.equal(g.movementPromises![0].released, undefined);
  g = advance(g, clean);
  assert.equal(player(g, f.target).shipped, false); assert.equal(player(g, f.target).spice, before.spice);
  assert.equal(g.movementPromises![0].released, true); assert.deepEqual(inventory(g), f.originalCards);
});

void test('controlled earlier Basic boundary cannot voluntarily reveal away the only city-range completion', () => {
  const f = fixture({ value: 0 }); let g = structuredClone(f.game);
  controlledPhysical(g, f.target, 2);
  g = advance(act(g, f.target, f.markerMove), clean);
  g = act(g, f.target, { type: 'bribe', target: f.asker, amount: player(g, f.target).spice });
  // Explicit earlier-phase boundary, not a claimed native second-round trace.
  g.phase = 4; g.ready = [];
  const to = TERRITORIES.filter(t => t.type === 'sand').flatMap(t => t.sectors.map(sector => ({ territory: t.id, sector })))
    .find(to => to.sector !== g.storm && distance(g, 'imperial_basin:9', `${to.territory}:${to.sector}`) === 3);
  assert.ok(to);
  g = ask(g, f.asker, f.truthtrance, f.target, 2, to.territory);
  assert.ok(viewGame(g, f.target).truthMovementAnswers!.includes('yes'));
  g = advance(act(g, f.target, { type: 'truthAnswer', answer: 'yes' }), clean);
  const before = structuredClone(g), own = player(g, f.target);
  assert.throws(() => act(g, f.target, { type: 'revealNoField', token: own.noField!.deployed!.tokenId,
    event: own.noFieldEvent }));
  assert.deepEqual(g, before);
});

void test('all existing profiles use the actual owned reveal then physical move legally', () => {
  const f = fixture({ advanced: true });
  const question = ask(f.game, f.asker, f.truthtrance, f.target, 5, 'arrakeen');
  for (const difficulty of DIFFICULTIES) {
    let g = question, count = 0;
    while (g.phase === 5 && g.active === f.target && count++ < 20) {
      if (!clean(g) && !g.truthtrance) { g = advance(g, clean); continue; }
      const view = viewGame(g, f.target); view.players.find(p => p.id === f.target)!.bot = difficulty;
      const action = botActions(view)[0]; assert.ok(action); g = act(g, f.target, action);
    }
    assert.ok(count < 20); assert.equal(g.movementPromises![0].fulfilled, true);
  }
});
