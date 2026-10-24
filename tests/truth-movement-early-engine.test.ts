import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { createTruthMovementEarlyFixture as fixture, actTruthMovementEarly as act,
  advanceTruthMovementEarly as advance, truthMovementEarlyClean as clean,
  truthMovementEarlyPlayer as player, truthMovementEarlyInventory as inventory } from './fixture-truth-movement-early';

function asked(options: { phase?: 0 | 1 | 2 | 3 | 4; minimum?: number; territory?: string; control?: (g: Game) => void } = {}) {
  const f = fixture({ phase: options.phase === 0 || options.phase === 1 ? 0 : 2 });
  let game = options.phase !== undefined && ![0, 2].includes(options.phase)
    ? advance(f.game, g => g.phase === options.phase && clean(g)) : f.game;
  options.control?.(game);
  game = act(game, f.asker, f.declarationStep.action);
  game = advance(game, g => g.truthtrance?.stage === 'ask');
  assert.ok(viewGame(game, f.asker).truthMovementTargets.includes(f.target));
  game = act(game, f.asker, { type: 'truthAsk', question: { ...f.claim,
    territory: options.territory ?? f.claim.territory, minimum: options.minimum ?? 8 } });
  return { f, game };
}
function bound(options: Parameters<typeof asked>[0] = {}, answer = 'yes') {
  const { f, game } = asked(options);
  assert.ok(viewGame(game, f.target).truthMovementAnswers!.includes(answer as 'yes' | 'no'));
  return { f, game: act(game, f.target, { type: 'truthAnswer', answer }) };
}
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function giveKarama(game: Game, count = 1) {
  for (let n = 0; n < count; n++) {
    const holder = game.players.find(p => p.id !== 'emperor' && p.hand.some(c => c.effect === 'karama'));
    const cards = holder?.hand ?? game.deck, index = cards.findIndex(c => c.effect === 'karama');
    assert.ok(index >= 0); player(game).hand.push(cards.splice(index, 1)[0]);
  }
}
function allies(game: Game) { player(game).ally = 'harkonnen'; player(game, 'harkonnen').ally = 'emperor'; }

void test('an original Charity movement answer retains its physical source without granting early shipment or movement', () => {
  const { f, game } = bound();
  assert.equal(game.phase, 2); assert.equal(player(game).spice, 10);
  assert.equal(player(game).reserves, 20); assert.deepEqual(player(game).forces, {});
  assert.deepEqual(inventory(game), f.originalCards);
  assert.equal(game.movementPromises![0].released, undefined);
  assert.deepEqual(viewGame(game, f.target).movementPromisePolicy, [{ type: 'ready' }]);
  reject(game, f.target, f.shipment); reject(game, f.target, f.move);
});

void test('the actual winning invoice reserves spice for shipment and only the later ground event fulfills Yes', () => {
  const { f, game: initial } = bound();
  let game = advance(initial, g => g.phase === 3 && clean(g) && g.auction?.active === f.target);
  const purchased = game.auction!.cards[game.auction!.index].id;
  reject(game, f.target, { type: 'bid', amount: 3 });
  game = act(game, f.target, f.bid);
  game = advance(game, g => g.phase === 4 && clean(g));
  assert.equal(player(game).spice, 8); assert.ok(player(game).hand.some(c => c.id === purchased));
  game = advance(game, g => g.phase === 5 && clean(g) && g.active === f.target);
  game = advance(act(game, f.target, f.shipment), clean);
  assert.equal(player(game).spice, 0); assert.equal(player(game).forces['arrakeen:10'], 8);
  assert.equal(game.movementPromises![0].fulfilled, undefined);
  reject(game, f.target, f.endMovement);
  game = advance(act(game, f.target, f.move), clean);
  assert.equal(player(game).forces['carthag:11'], 8); assert.equal(game.movementPromises![0].fulfilled, true);
  game = act(game, f.target, f.endMovement); assert.notEqual(game.active, f.target);
  assert.deepEqual(inventory(game), f.originalCards);
});

void test('original Storm, Spice, Bidding and Revival questions retain the same current-round future movement', () => {
  for (const phase of [0, 1, 3, 4] as const) {
    const { f, game: initial } = bound({ phase });
    assert.equal(initial.phase, phase);
    assert.ok(!viewGame(initial, f.target).movementPromisePolicy?.some(a => ['ship', 'move', 'endMovement'].includes(a.type)));
    let game = advance(initial, g => g.phase === 5 && clean(g) && g.active === f.target);
    assert.equal(game.movementPromises![0].released, undefined);
    game = advance(act(game, f.target, f.shipment), clean);
    assert.equal(game.movementPromises![0].fulfilled, undefined);
    game = advance(act(game, f.target, f.move), clean);
    assert.equal(game.movementPromises![0].fulfilled, true);
    assert.deepEqual(inventory(game), f.originalCards);
  }
});

const needPreparation = (g: Game) => {
  const p = player(g); p.spice = 0; p.reserves = 0; p.tanks = 3; p.forces = { 'carthag:11': 17 };
  g.ready = [p.id];
};
void test('controlled Charity and Revival needs reopen readiness and cannot be skipped or spent on an excess revival', () => {
  const { f, game: initial } = bound({ control: needPreparation, minimum: 1 });
  let game = initial;
  assert.equal(game.ready.includes(f.target), false);
  assert.deepEqual(viewGame(game, f.target).movementPromisePolicy, [{ type: 'charity' }]);
  reject(game, f.target, { type: 'ready' });
  game = act(game, f.target, { type: 'charity' });
  game = advance(game, g => g.phase === 4 && clean(g));
  assert.deepEqual(viewGame(game, f.target).movementPromisePolicy, [{ type: 'revive', amount: 1 }]);
  reject(game, f.target, { type: 'ready' }); reject(game, f.target, { type: 'revive', amount: 2 });
  game = act(game, f.target, { type: 'revive', amount: 1 });
  assert.equal(player(game).reserves, 1); assert.equal(game.movementPromises![0].released, undefined);
  game = advance(game, g => g.phase === 5 && clean(g) && g.active === f.target);
  for (let count = 0; !game.movementPromises![0].fulfilled && count < 4; count++) {
    const action = viewGame(game, f.target).movementPromisePolicy![0]; assert.ok(action);
    game = advance(act(game, f.target, action), clean);
  }
  assert.equal(game.movementPromises![0].fulfilled, true);
});

void test('a controlled already-Ready Revival respondent can answer and use only its current remaining preparation', () => {
  const { f, game: initial } = bound({ phase: 4, minimum: 1, control: g => {
    needPreparation(g); player(g).spice = 1;
  } });
  assert.equal(initial.ready.includes(f.target), false);
  assert.deepEqual(viewGame(initial, f.target).movementPromisePolicy, [{ type: 'revive', amount: 1 }]);
  reject(initial, f.target, { type: 'ready' });
  const game = act(initial, f.target, { type: 'revive', amount: 1 });
  assert.deepEqual(viewGame(game, f.target).movementPromisePolicy, [{ type: 'ready' }]);
});

void test('controlled physical Karamas price the actual invoice separately from later shipment', () => {
  for (const count of [1, 2]) {
    const { f, game: initial } = bound({ control: g => { player(g).spice = 4; giveKarama(g, count); } });
    let game = advance(initial, g => g.phase === 3 && clean(g) && g.auction?.active === f.target);
    if (count === 1) { reject(game, f.target, { type: 'bid', amount: 1 }); continue; }
    game = act(game, f.target, { type: 'bid', amount: 1 });
    game = advance(game, g => g.decision?.kind === 'auctionPayment' && g.decision.player === f.target);
    reject(game, f.target, { type: 'decision', karama: false });
    const payment = viewGame(game, f.target).movementPromisePolicy![0];
    assert.equal(payment.karama, true);
    game = act(game, f.target, payment);
    game = advance(game, g => g.phase === 5 && clean(g) && g.active === f.target);
    const price = viewGame(game, f.target).movementPromisePolicy![0];
    assert.equal(price.type, 'card'); assert.notEqual(price.card, payment.card);
    assert.equal(player(game).hand.filter(c => c.effect === 'karama').length, 1);
    game = advance(act(game, f.target, price), clean);
    assert.equal(game.karamaShipping?.player, f.target);
    game = advance(act(game, f.target, f.shipment), clean);
    assert.equal(player(game).spice, 0); assert.equal(game.karamaShipping, null);
    assert.equal(game.movementPromises![0].fulfilled, undefined);
    game = advance(act(game, f.target, f.move), clean);
    assert.equal(game.movementPromises![0].fulfilled, true);
    assert.deepEqual(inventory(game), f.originalCards);
  }
});

void test('controlled ally escrow waits for actual income or cancellation before releasing a movement shortfall', () => {
  for (const canceled of [false, true]) {
    const { f, game: initial } = bound({ control: allies, territory: 'imperial_basin' });
    let game = advance(initial, g => g.phase === 3 && clean(g) && g.auction?.active === f.target);
    game = act(game, f.target, { type: 'pledgeAid', amount: 8 });
    assert.equal(game.movementPromises![0].released, undefined);
    game = advance(game, g => g.phase === 3 && clean(g) && g.auction?.active === 'harkonnen');
    game = act(game, 'harkonnen', { type: 'bid', amount: 3, allyPayment: 3 });
    assert.equal(game.movementPromises![0].released, undefined);
    game = advance(game, g => g.response?.kind === 'emperorIncome');
    assert.equal(game.movementPromises![0].released, undefined);
    if (canceled) game = act(game, 'harkonnen', { type: 'card',
      card: player(game, 'harkonnen').hand.find(c => c.effect === 'karama')!.id, mode: 'cancel' });
    game = advance(game, g => g.phase === 4 && clean(g));
    assert.equal(player(game).spice, canceled ? 7 : 10);
    assert.equal(game.movementPromises![0].released, canceled ? true : undefined);
  }
});

void test('controlled all-No answers leave native Karama overbid payment available to every existing profile', () => {
  const { f, game: initial } = bound({ control: g => giveKarama(g) }, 'no');
  let game = advance(initial, g => g.phase === 3 && clean(g) && g.auction?.active === f.target);
  game = act(game, f.target, { type: 'bid', amount: 11 });
  game = advance(game, g => g.decision?.kind === 'auctionPayment' && g.decision.player === f.target);
  assert.equal(viewGame(game, f.target).movementPromisePolicy, null);
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, f.target); view.players.find(p => p.id === f.target)!.bot = difficulty;
    const action = botActions(view)[0]; assert.equal(action.karama, true);
    assert.doesNotThrow(() => applyAction(game, f.target, action));
  }
});

void test('a controlled last Storm Ready resolves forced losses instead of rejecting its owner or preserving a false route', () => {
  const { f, game: initial } = bound({ phase: 0, territory: 'arrakeen', control: g => {
    const p = player(g); p.spice = 0; p.reserves = 0; p.tanks = 12; p.forces = { 'oh_gap:11': 8 };
    g.storm = 9;
  } });
  let game = initial;
  for (const [index, actor] of game.stormDialers.entries()) game = act(game, actor, { type: 'stormDial', amount: index === 0 ? 2 : 0 });
  assert.equal(game.stormPending, 2);
  for (const p of game.players) if (p.id !== f.target) game = act(game, p.id, { type: 'ready' });
  assert.equal(game.movementPromises![0].released, undefined);
  game = act(game, f.target, { type: 'ready' });
  assert.equal(player(game).forces['oh_gap:11'] ?? 0, 0); assert.equal(player(game).tanks, 20);
  assert.equal(game.movementPromises![0].released, true);
});

function secondQuestion(game: Game, question: Record<string, unknown>): Game {
  // Controlled acquisition of another conserved original Truthtrance, without
  // staging an answer, future card, board, balance or movement allowance.
  const index = game.deck.findIndex(card => card.effect === 'truthtrance'); assert.ok(index >= 0);
  const card = game.deck.splice(index, 1)[0]; player(game, 'atreides').hand.push(card);
  game = act(game, 'atreides', { type: 'card', card: card.id });
  game = advance(game, g => g.truthtrance?.stage === 'ask');
  return act(game, 'atreides', { type: 'truthAsk', question });
}
void test('controlled prior Ornithopter credit expires at the real movement boundary and cannot supply a second promised move', () => {
  const { f, game: initial } = bound({ phase: 4, minimum: 2, control: g => {
    const p = player(g); p.spice = 0; p.reserves = 0; p.tanks = 18;
    p.forces = { 'arrakeen:10': 2 }; p.ornithopterExtraMoves = 1;
  } });
  let game = secondQuestion(initial, { kind: 'movement', target: f.target, territory: 'arrakeen', minimum: 2 });
  assert.equal(viewGame(game, f.target).truthMovementAnswers!.includes('yes'), false);
  game = act(game, f.target, { type: 'truthAnswer', answer: 'no' });
  game = advance(game, g => g.phase === 5 && clean(g) && g.active === f.target);
  assert.equal(player(game).ornithopterExtraMoves, undefined);
  game = advance(act(game, f.target, { ...f.move, amount: 2 }), clean);
  game = act(game, f.target, f.endMovement);
  assert.ok(game.movementPromises!.every(promise => promise.fulfilled));
});

void test('a controlled second original question keeps an early shipment Yes in the combined movement witness', () => {
  const f = fixture();
  let game = act(f.game, f.asker, f.declarationStep.action);
  game = advance(game, g => g.truthtrance?.stage === 'ask');
  game = act(game, f.asker, { type: 'truthAsk', question: { ...f.claim, kind: 'shipment' } });
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' });
  game = secondQuestion(game, f.claim);
  assert.equal(viewGame(game, f.target).truthMovementAnswers!.includes('yes'), false);
  assert.ok(viewGame(game, f.target).truthMovementAnswers!.includes('no'));
  game = act(game, f.target, { type: 'truthAnswer', answer: 'no' });
  assert.equal(game.shipmentPromises![0].released, undefined);
  game = advance(game, g => g.phase === 5 && clean(g) && g.active === f.target);
  const policy = viewGame(game, f.target).movementPromisePolicy![0]; assert.equal(policy.type, 'ship');
  assert.equal(policy.territory, 'carthag');
  game = advance(act(game, f.target, policy), clean);
  assert.equal(game.shipmentPromises![0].fulfilled, true);
  game = act(game, f.target, f.endMovement);
  assert.equal(game.movementPromises![0].fulfilled, true);
});
