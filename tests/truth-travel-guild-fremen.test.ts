import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { baseDeck } from '../game/cards';

/** Controlled native state, conserving the original two physical Truths. This
 * isolates the printed Fremen/Guild transport rule; no setup/earned-alliance
 * history is claimed by this fixture. */
function controlled(paidByAlly = false) {
  const game = createGame('TRAVELGUILDFREMEN', newPlayer('a', 'Asker', 'harkonnen'), false);
  game.players.push(newPlayer('p', 'Fremen', 'fremen'), newPlayer('g', 'Guild', 'guild'));
  Object.assign(game, { status: 'playing', phase: 5, turn: 2, storm: 18, active: 'p',
    order: ['p', 'a', 'g'], movementRemaining: ['p', 'a', 'g'], deck: baseDeck(), discard: [] });
  for (const player of game.players) {
    player.hand = []; player.forces = {}; player.reserves = 20; player.spice = 10; player.traitorChoices = [];
  }
  game.players[1].ally = 'g'; game.players[2].ally = 'p'; game.players[1].spice = paidByAlly ? 0 : 3;
  const truths = game.deck.filter(card => card.effect === 'truthtrance'); assert.equal(truths.length, 2);
  game.deck = game.deck.filter(card => card.effect !== 'truthtrance'); game.players[0].hand = truths;
  const inventory = (g: Game) => [...g.deck, ...g.discard, ...g.players.flatMap(player => player.hand)].map(card => card.id).sort();
  const original = inventory(game);
  return { game: paidByAlly ? applyAction(game, 'g', { type: 'pledgeAid', amount: 3 }) : game,
    truths: truths.map(card => card.id), inventory, original };
}
const ship = (minimum: number) => ({ kind: 'action' as const, action: { kind: 'ship' as const, territory: 'carthag', minimum } });
const move = { kind: 'action' as const, action: { kind: 'move' as const, territory: 'imperial_basin', minimum: 6 } };
function asked(game: Game, card: string, question: unknown) {
  game = applyAction(game, 'a', { type: 'card', card });
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id)); assert.ok(actor);
    game = applyAction(game, actor.id, { type: 'truthPass' });
  }
  return applyAction(game, 'a', { type: 'truthAsk', question });
}
void test('controlled Guild-allied Fremen travel uses the paid reserve transport outside ordinary reinforcement radius and then moves the physical group', () => {
  for (const paidByAlly of [false, true]) {
    const f = controlled(paidByAlly); let game = asked(f.game, f.truths[0], {
      kind: 'travel', target: 'p', turn: 2, mixed: { kind: 'and', terms: [ship(6), move] },
    });
    assert.ok(viewGame(game, 'p').truthTravelAnswers?.includes('yes'));
    game = applyAction(game, 'p', { type: 'truthAnswer', answer: 'yes' });
    const before = structuredClone(game);
    assert.throws(() => applyAction(game, 'p', { type: 'ship', territory: 'carthag', sector: 11, amount: 6 }));
    assert.deepEqual(game, before);
    const guide = viewGame(game, 'p').travelPromiseGuide; assert.ok(guide);
    assert.equal(guide.action.type, 'guildShip'); assert.equal(guide.action.from, 'reserves');
    assert.equal(guide.action.territory, 'carthag'); assert.equal(guide.action.amount, 6);
    assert.equal(guide.action.allyPayment, paidByAlly ? 3 : 0);
    game = applyAction(game, 'p', guide.action);
    assert.equal(game.players[1].spice, 0); assert.equal(game.players[1].reserves, 14);
    if (paidByAlly) assert.equal(game.aid.g.amount, 0);
    assert.equal(viewGame(game, 'p').travelPromises[0].fulfilled, false);
    assert.deepEqual(game.travelPromises![0].progress, []);
    const moving = viewGame(game, 'p').travelPromiseGuide; assert.ok(moving); assert.equal(moving.action.type, 'move');
    game = applyAction(game, 'p', moving.action);
    assert.equal(viewGame(game, 'p').travelPromises[0].fulfilled, true);
    assert.equal(Object.entries(game.players[1].forces).filter(([key]) => key.startsWith('imperial_basin:')).reduce((sum, [, count]) => sum + count, 0), 6);
    assert.deepEqual(f.inventory(game), f.original);
  }
});
void test('controlled earlier travel No retains the legal Guild-allied Fremen route for a later scalar shipment Yes', () => {
  const f = controlled(); let game = asked(f.game, f.truths[0], { kind: 'travel', target: 'p', turn: 2, mixed: ship(7) });
  game = applyAction(game, 'p', { type: 'truthAnswer', answer: 'no' });
  game = asked(game, f.truths[1], { kind: 'shipment', target: 'p', territory: 'carthag', minimum: 6 });
  assert.ok(viewGame(game, 'p').truthShipmentAnswers?.includes('yes'));
  game = applyAction(game, 'p', { type: 'truthAnswer', answer: 'yes' });
  const action: Action = { type: 'guildShip', from: 'reserves', territory: 'carthag', sector: 11, amount: 6 };
  game = applyAction(game, 'p', action); assert.equal(game.shipmentPromises?.[0].fulfilled, true);
  assert.equal(viewGame(game, 'p').travelPromises[0].fulfilled, false);
  game = applyAction(game, 'p', { type: 'endMovement' });
  assert.equal(viewGame(game, 'p').travelPromises[0].fulfilled, true); assert.deepEqual(f.inventory(game), f.original);
});
void test('controlled Fremen cannot use a free ordinary price to fund paid Guild transport', () => {
  const f = controlled(); f.game.players[1].spice = 2;
  const game = asked(f.game, f.truths[0], { kind: 'travel', target: 'p', turn: 2, mixed: ship(6) });
  assert.deepEqual(viewGame(game, 'p').truthTravelAnswers, ['no']);
});
