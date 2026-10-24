import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game } from '../game/engine';
import { createTruthtranceEarlyShipmentFixture, actTruthtranceEarlyShipment as act,
  advanceTruthtranceEarlyShipment as advance, truthtranceEarlyShipmentClean as clean } from './fixture-truthtrance-early-shipment';
import { botActions } from '../game/bots';

function bound(control?: (game: Game) => void, minimum = 8, phase = 2) {
  const f = createTruthtranceEarlyShipmentFixture();
  const initial = phase === 2 ? f.game : advance(f.game, g => g.phase === phase && clean(g));
  control?.(initial);
  let game = act(initial, f.declarationStep.actor, f.declarationStep.action);
  while (game.truthtrance?.stage === 'priority')
    game = act(game, game.players.find(p => !game.truthtrance!.passed.includes(p.id))!.id, { type: 'truthPass' });
  assert.ok(viewGame(game, f.asker).truthShipmentTargets.includes(f.target));
  game = act(game, f.askStep.actor, { ...f.askStep.action, question: { ...f.question, minimum } });
  assert.ok(viewGame(game, f.target).truthShipmentAnswers!.includes('yes'));
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  return { f, game };
}
const reject = (g: Game, actor: string, action: Parameters<typeof applyAction>[2]) => {
  const before = structuredClone(g); assert.throws(() => applyAction(g, actor, action)); assert.deepEqual(g, before);
};
const player = (g: Game, id = 'emperor') => g.players.find(p => p.id === id)!;
function giveKarama(g: Game, count = 1) {
  const own = player(g);
  for (let n = 0; n < count; n++) {
    const holder = g.players.find(p => p.id !== own.id && p.hand.some(c => c.effect === 'karama'));
    if (holder) own.hand.push(holder.hand.splice(holder.hand.findIndex(c => c.effect === 'karama'), 1)[0]);
    else {
      const index = g.deck.findIndex(c => c.effect === 'karama'); assert.ok(index >= 0);
      own.hand.push(g.deck.splice(index, 1)[0]);
    }
  }
}
function allies(g: Game) {
  player(g).ally = 'harkonnen'; player(g, 'harkonnen').ally = 'emperor';
}

void test('an original Basic Charity question binds the later eight-force shipment without granting an early action', () => {
  const { f, game } = bound();
  assert.equal(game.phase, 2); assert.equal(game.shipmentPromises!.length, 1);
  assert.equal(game.shipmentPromises![0].player, f.target);
  assert.equal(game.shipmentPromises![0].released, undefined);
  assert.equal(viewGame(game, f.target).shipmentCompletion, null);
  reject(game, f.target, { type: 'ship', territory: 'carthag', sector: 11, amount: 8 });
});

void test('a pre-Bidding commitment reserves the winning invoice before payment and fulfills after the real purchase', () => {
  const { f, game: initial } = bound();
  let game = advance(initial, g => g.phase === 3 && clean(g) && g.auction?.active === f.target);
  const initialCard = game.auction!.cards[game.auction!.index].id;
  reject(game, f.target, { type: 'bid', amount: 3 });
  game = act(game, f.target, { type: 'bid', amount: 2 });
  assert.equal(game.shipmentPromises![0].released, undefined);
  game = advance(game, g => g.phase === 4 && clean(g));
  assert.equal(game.players.find(p => p.id === f.target)!.spice, 8);
  assert.ok(game.players.find(p => p.id === f.target)!.hand.some(c => c.id === initialCard));
  game = advance(game, g => g.phase === 5 && clean(g) && g.active === f.target);
  const shipment = viewGame(game, f.target).shipmentCompletion!.actions.at(-1)!;
  assert.equal(shipment.type, 'ship'); assert.equal(shipment.amount, 8);
  game = act(game, f.target, shipment);
  while (game.response) game = act(game, game.players.find(p => !game.response!.passed.includes(p.id))!.id, { type: 'passResponse' });
  assert.equal(game.shipmentPromises![0].fulfilled, true);
  assert.equal(game.players.find(p => p.id === f.target)!.spice, 0);
  assert.equal(game.players.find(p => p.id === f.target)!.forces['carthag:11'], 8);
});

void test('controlled early resources include owned Charity and normal Revival, reopen readiness and forbid skipping required preparation', () => {
  const { f, game: initial } = bound(g => {
    const p = g.players.find(p => p.id === 'emperor')!;
    p.spice = 0; p.reserves = 0; p.tanks = 3; p.forces = { 'polar_sink:0': 17 };
    g.ready = [p.id];
  }, 1);
  let game = initial;
  assert.equal(game.ready.includes(f.target), false);
  assert.deepEqual(viewGame(game, f.target).shipmentPreparation?.actions, [{ type: 'charity' }]);
  reject(game, f.target, { type: 'ready' });
  game = act(game, f.target, { type: 'charity' });
  game = advance(game, g => g.phase === 4 && clean(g));
  assert.equal(viewGame(game, f.target).shipmentPreparation?.actions[0].type, 'revive');
  reject(game, f.target, { type: 'ready' });
  reject(game, f.target, { type: 'revive', amount: 2 });
  game = act(game, f.target, { type: 'revive', amount: 1 });
  assert.equal(game.shipmentPromises![0].released, undefined);
  assert.equal(game.players.find(p => p.id === f.target)!.reserves, 1);
  assert.equal(viewGame(game, f.target).shipmentPreparation, null);
  game = advance(game, g => g.phase === 5 && clean(g) && g.active === f.target);
  assert.ok(viewGame(game, f.target).shipmentCompletion);
});

void test('all existing profiles retain minimal legal participation during early Bidding', () => {
  const { f, game: boundGame } = bound();
  const game = advance(boundGame, g => g.phase === 3 && clean(g) && g.auction?.active === f.target);
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = viewGame(game, f.target); view.players.find(p => p.id === f.target)!.bot = difficulty;
    const action = botActions(view)[0]; assert.equal(action.type, 'passBid');
    const done = applyAction(game, f.target, action);
    assert.equal(done.shipmentPromises![0].released, undefined);
  }
});

void test('a controlled retained Karama pays the actual winning invoice without spending the reserved shipping spice', () => {
  const { f, game: initial } = bound(g => giveKarama(g));
  let game = advance(initial, g => g.phase === 3 && clean(g) && g.auction?.active === f.target);
  const card = player(game).hand.find(c => c.effect === 'karama')!.id;
  game = act(game, f.target, { type: 'bid', amount: 7 });
  game = advance(game, g => g.decision?.kind === 'auctionPayment' && g.decision.player === f.target);
  assert.equal(viewGame(game, f.target).shipmentCompletion, null);
  reject(game, f.target, { type: 'decision', karama: false });
  assert.deepEqual(viewGame(game, f.target).shipmentPromisePolicy, [{ type: 'decision', karama: true, card }]);
  game = act(game, f.target, { type: 'decision', karama: true, card });
  game = advance(game, g => g.phase === 4 && clean(g));
  assert.equal(player(game).spice, 10);
  assert.equal(game.discard.filter(c => c.id === card).length, 1);
  assert.equal(game.shipmentPromises![0].released, undefined);
});

void test('controlled auction and shipping discounts need distinct physical Karamas', () => {
  for (const count of [1, 2]) {
    const { f, game: initial } = bound(g => { player(g).spice = 4; giveKarama(g, count); });
    let game = advance(initial, g => g.phase === 3 && clean(g) && g.auction?.active === f.target);
    if (count === 1) reject(game, f.target, { type: 'bid', amount: 1 });
    else {
      game = act(game, f.target, { type: 'bid', amount: 1 });
      game = advance(game, g => g.decision?.kind === 'auctionPayment' && g.decision.player === f.target);
      const policy = viewGame(game, f.target).shipmentPromisePolicy!;
      assert.equal(policy[0].karama, true);
      game = act(game, f.target, policy[0]);
      game = advance(game, g => g.phase === 5 && clean(g) && g.active === f.target);
      assert.equal(player(game).hand.filter(c => c.effect === 'karama').length, 1);
      const price = viewGame(game, f.target).shipmentCompletion!.actions[0];
      assert.equal(price.type, 'card'); assert.notEqual(price.card, policy[0].card);
    }
  }
});

void test('controlled Bidding escrow retains a promise through an unresolved ally bid and releases only its settled shortfall', () => {
  for (const canceled of [false, true]) {
    const { f, game: initial } = bound(allies);
    let game = advance(initial, g => g.phase === 3 && clean(g) && g.auction?.active === f.target);
    game = act(game, f.target, { type: 'pledgeAid', amount: 8 });
    assert.equal(player(game).spice, 2);
    assert.equal(game.shipmentPromises![0].released, undefined);
    game = advance(game, g => g.phase === 3 && clean(g) && g.auction?.active === 'harkonnen');
    game = act(game, 'harkonnen', { type: 'bid', amount: 3, allyPayment: 3 });
    assert.equal(game.shipmentPromises![0].released, undefined);
    game = advance(game, g => g.response?.kind === 'emperorIncome');
    assert.equal(game.shipmentPromises![0].released, undefined);
    if (canceled) game = act(game, 'harkonnen', { type: 'card',
      card: player(game, 'harkonnen').hand.find(c => c.effect === 'karama')!.id, mode: 'cancel' });
    game = advance(game, g => g.phase === 4 && clean(g));
    assert.equal(player(game).spice, canceled ? 7 : 10);
    assert.equal(game.shipmentPromises![0].released, canceled ? true : undefined);
  }
});

void test('controlled incoming Bidding aid expires before shipment and cannot fund an early Yes', () => {
  const f = createTruthtranceEarlyShipmentFixture();
  let game = advance(f.game, g => g.phase === 3 && clean(g));
  allies(game); player(game).spice = 0;
  game = act(game, 'harkonnen', { type: 'pledgeAid', amount: 8 });
  game = act(game, f.asker, f.declarationStep.action);
  game = advance(game, g => g.truthtrance?.stage === 'ask');
  game = act(game, f.asker, { ...f.askStep.action, question: { ...f.question, minimum: 1 } });
  assert.equal(viewGame(game, f.target).truthShipmentAnswers!.includes('yes'), false);
  assert.ok(viewGame(game, f.target).truthShipmentAnswers!.includes('no'));
});

void test('controlled extra ally revival cannot defer a voluntary promise-breaking cost to another responder', () => {
  const { f, game: initial } = bound(g => {
    allies(g); const ally = player(g, 'harkonnen'); ally.reserves--; ally.tanks++;
  }, 10);
  const game = advance(initial, g => g.phase === 4 && clean(g));
  reject(game, f.target, { type: 'emperorRevival', amount: 1 });
});

void test('a controlled Revival answer reopens Ready and uses only the remaining current ordinary quota', () => {
  const { f, game: initial } = bound(g => {
    const p = player(g); p.spice = 1; p.reserves = 0; p.tanks = 3; p.forces = { 'polar_sink:0': 17 };
    g.ready = [p.id];
  }, 1, 4);
  assert.equal(initial.ready.includes(f.target), false);
  assert.deepEqual(viewGame(initial, f.target).shipmentPreparation?.actions, [{ type: 'revive', amount: 1 }]);
  reject(initial, f.target, { type: 'ready' });
  let game = act(initial, f.target, { type: 'revive', amount: 1 });
  game = advance(game, g => g.phase === 5 && clean(g) && g.active === f.target);
  game = act(game, f.target, viewGame(game, f.target).shipmentCompletion!.actions[0]);
  game = advance(game, clean);
  assert.equal(game.shipmentPromises![0].fulfilled, true);
  assert.equal(player(game).spice, 0);
});

void test('a controlled No answer retains the native legal Karama overbid payment for every existing profile', () => {
  const f = createTruthtranceEarlyShipmentFixture();
  giveKarama(f.game);
  let game = act(f.game, f.asker, f.declarationStep.action);
  game = advance(game, g => g.truthtrance?.stage === 'ask');
  game = act(game, f.asker, f.askStep.action);
  game = act(game, f.target, { type: 'truthAnswer', answer: 'no' });
  game = advance(game, g => g.phase === 3 && clean(g) && g.auction?.active === f.target);
  game = act(game, f.target, { type: 'bid', amount: 11 });
  game = advance(game, g => g.decision?.kind === 'auctionPayment' && g.decision.player === f.target);
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = viewGame(game, f.target); view.players.find(p => p.id === f.target)!.bot = difficulty;
    const action = botActions(view)[0];
    assert.equal(action.karama, true);
    assert.doesNotThrow(() => applyAction(game, f.target, action));
  }
});
