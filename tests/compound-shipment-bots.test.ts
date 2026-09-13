import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { compoundShipmentGame, askCompoundShipment, compoundShipmentCustody } from './fixture-compound-shipment';
import { matchesShipment } from '../game/shipment-promises';

function pending(advanced: boolean) {
  const g = compoundShipmentGame(advanced);
  Object.assign(g.players[0], { reserves: 10, forces: { 'carthag:11': 10 }, spice: 4 });
  return askCompoundShipment(g, { op: 'or', terms: [
    { territory: 'carthag', minimum: 20 }, { territory: 'arrakeen', minimum: 4 },
  ] });
}
void test('all four profiles answer and complete the later OR branch when the first branch is impossible', () => {
  for (const advanced of [false, true]) for (const level of DIFFICULTIES) {
    let g = pending(advanced);
    g.players[0].bot = level;
    const answer = botActions(viewGame(g, 'p'))[0];
    assert.deepEqual(answer, { type: 'truthAnswer', answer: 'yes' });
    g = applyAction(g, 'p', answer);
    const candidates = botActions(viewGame(g, 'p'));
    const ship = candidates.find(action => action.type === 'ship');
    assert.ok(ship, `${level} must retain an executable completion beyond its strategic shortlist`);
    for (const action of candidates) assert.doesNotThrow(() => applyAction(g, 'p', action));
    const next = applyAction(g, 'p', ship);
    assert.equal(next.players[0].spice, 0);
    assert.equal(next.players[0].reserves, 6);
    const promise = next.shipmentPromises?.[0];
    assert.ok(promise);
    assert.equal(promise.fulfilled, true);
    assert.equal(matchesShipment(promise, { territory: 'arrakeen', amount: 4 }), true);
    compoundShipmentCustody(next);
    for (const player of next.players)
      assert.deepEqual(JSON.parse(JSON.stringify(viewGame(next, player.id))),
        JSON.parse(JSON.stringify(viewGame(JSON.parse(JSON.stringify(next)) as Game, player.id))));
  }
});

void test('impossible different-destination AND never makes an AI publish Yes', () => {
  for (const level of DIFFICULTIES) {
    const g = askCompoundShipment(compoundShipmentGame(), { op: 'and', terms: [
      { territory: 'carthag', minimum: 1 }, { territory: 'arrakeen', minimum: 1 },
    ] });
    g.players[0].bot = level;
    assert.deepEqual(botActions(viewGame(g, 'p'))[0], { type: 'truthAnswer', answer: 'no' });
  }
});

void test('compound answer ranking does not inspect rival private fields or mutate its supplied view', () => {
  const g = pending(true);
  g.players[0].bot = 'Hard';
  const original = viewGame(g, 'p');
  const expected = botActions(original);
  const view = viewGame(g, 'p');
  for (const rival of view.players.filter(player => player.id !== 'p'))
    for (const field of ['hand', 'spice', 'traitors', 'faceDancers'])
      Object.defineProperty(rival, field, { get() { throw new Error(`Unentitled ${field} access`); } });
  assert.deepEqual(botActions(view), expected);
  assert.deepEqual(viewGame(g, 'p'), original);
});
