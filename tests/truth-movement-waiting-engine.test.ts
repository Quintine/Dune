import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, normalizeAutomaticGame, createGame, joinGame, newPlayer, type Game } from '../game/engine';
import { baseDeck, treacheryDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { TERRITORIES, gameDistance, splitLocation } from '../game/board';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { createTruthMovementWaitingFixture as fixture, actTruthMovementWaiting as act,
  truthMovementWaitingInventory as inventory } from './fixture-truth-movement-waiting';
import { createTruthMovementWaitingBoxFixture as boxFixture } from './fixture-truth-movement-waiting-box';

function ask(game: Game, asker: string, card: string, question: Record<string, unknown>) {
  game = act(game, asker, { type: 'card', card });
  for (const p of game.players) if (!game.truthtrance!.passed.includes(p.id)) game = act(game, p.id, { type: 'truthPass' });
  return act(game, asker, { type: 'truthAsk', question });
}
void test('a genuinely waiting Basic respondent can answer a same-round future ground-movement question', () => {
  const f = fixture({ hajr: false }); const game = ask(f.game, f.asker, f.truth, f.claim);
  assert.ok(viewGame(game, f.target).truthMovementAnswers!.includes('yes'));
});
void test('controlled past BG losses retain an owned future route when accompaniment would consume its last reserve', () => {
  for (const reserves of [1, 2]) {
    // Structural timing/physical-loss fixture; separate public sources prove
    // natural setup. Native faction/leader identities and all twenty counters
    // are retained, with modeled past losses and bank payments explicit here.
    const source = createGame('WAITINGMOVEMENTADVISOR', newPlayer('current', 'Current', 'atreides'), false);
    joinGame(source, newPlayer('waiting', 'Waiting BG', 'beneGesserit'));
    Object.assign(source, { status: 'playing', phase: 5, turn: 2, storm: 18, active: 'current',
      order: ['current', 'waiting'], movementRemaining: ['current', 'waiting'], deck: baseDeck() });
    const current = source.players[0], waiting = source.players[1];
    current.forces = { 'arrakeen:10': 10 }; current.reserves = 10; current.spice = 10;
    waiting.forces = { 'polar_sink:0': 1 }; waiting.reserves = reserves; waiting.tanks = 19 - reserves; waiting.spice = 1;
    const index = source.deck.findIndex(card => card.effect === 'truthtrance'); assert.ok(index >= 0);
    const card = source.deck.splice(index, 1)[0]; current.hand.push(card);
    let game = ask(source, current.id, card.id, { kind: 'movement', target: waiting.id, territory: 'carthag', minimum: 1 });
    game = act(game, waiting.id, { type: 'truthAnswer', answer: 'yes' });
    game = act(game, current.id, { type: 'ship', territory: 'carthag', sector: 11, amount: 1 });
    assert.equal(game.decision?.kind, 'advisor');
    for (const difficulty of DIFFICULTIES) {
      const view = viewGame(game, waiting.id); view.players.find(p => p.id === waiting.id)!.bot = difficulty;
      assert.deepEqual(botActions(view), [{ type: 'decision', accept: false }]);
    }
    if (reserves === 1) {
      const before = structuredClone(game);
      assert.throws(() => act(game, waiting.id, { type: 'decision', accept: true })); assert.deepEqual(game, before);
      game = act(game, waiting.id, { type: 'decision', accept: false });
    } else game = act(game, waiting.id, { type: 'decision', accept: true });
    assert.equal(game.movementPromises![0].released, undefined);
    game = act(game, current.id, { type: 'endMovement' });
    game = act(game, waiting.id, viewGame(game, waiting.id).movementPromisePolicy![0]);
    game = act(game, waiting.id, viewGame(game, waiting.id).movementPromisePolicy![0]);
    assert.equal(game.movementPromises![0].fulfilled, true);
  }
});
function bind(answer = 'yes') {
  const f = fixture({ hajr: false });
  const game = act(ask(f.game, f.asker, f.truth, f.claim), f.target, { type: 'truthAnswer', answer });
  return { f, game };
}
function pass(game: Game) {
  if (game.pendingTreacheryDiscard?.reaction) {
    const event = game.pendingTreacheryDiscard.batch.event;
    for (const p of game.players) game = act(game, p.id, { type: 'semutaPass', event });
  }
  while (game.response) {
    const player = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(player);
    game = act(game, player.id, { type: 'passResponse' });
  }
  return game;
}
function paidWaitingBox() {
  const f = boxFixture(); let game = ask(f.game, f.asker, f.truth, f.claim);
  game = pass(act(game, f.target, { type: 'truthAnswer', answer: 'yes' }));
  game = act(game, f.target, { type: 'card', card: f.box });
  return { f, game };
}
void test('a genuinely waiting owner can finish an ordinary paid Box choice while future movement controls stay unavailable', () => {
  const { f, game: paid } = paidWaitingBox(), before = structuredClone(paid);
  const search = viewGame(paid, f.target).nullentropy!.search!;
  assert.deepEqual(search.cards.map(card => card.id).sort(), [...f.expectedPaidChoices].sort());
  const next = viewGame(paid, f.target).movementPromisePolicy![0];
  assert.equal(next.type, 'decision'); assert.equal(next.event, search.event);
  assert.ok(f.expectedPaidChoices.includes(String(next.card))); assert.deepEqual(paid, before);
  let game = pass(act(paid, f.target, next));
  assert.equal(game.active, f.active); assert.equal(game.pendingNullentropy, null);
  assert.equal(game.players.find(p => p.id === f.target)!.spice, f.balances[f.target] - 2);
  assert.equal(viewGame(game, f.target).movementPromisePolicy, null);
  game = act(game, f.active, f.currentEnd); assert.equal(game.active, f.target);
  game = pass(act(game, f.target, viewGame(game, f.target).movementPromisePolicy![0]));
  game = pass(act(game, f.target, viewGame(game, f.target).movementPromisePolicy![0]));
  assert.equal(game.movementPromises![0].fulfilled, true); assert.deepEqual(inventory(game), f.originalCards);
});
void test('all four minimal profiles select the original paid waiting decision, then wait until their real movement turn', () => {
  const { f, game: paid } = paidWaitingBox();
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(paid, f.target); view.players.find(p => p.id === f.target)!.bot = difficulty;
    const choice = botActions(view)[0]; assert.equal(choice.type, 'decision'); assert.equal(choice.event, paid.pendingNullentropy!.event);
    let game = pass(act(paid, f.target, choice)); assert.equal(viewGame(game, f.target).movementPromisePolicy, null);
    game = act(game, f.active, f.currentEnd);
    let count = 0;
    while (game.phase === 5 && game.active === f.target && count++ < 14) {
      const own = viewGame(game, f.target); own.players.find(p => p.id === f.target)!.bot = difficulty;
      const action = botActions(own)[0]; assert.ok(action); game = pass(act(game, f.target, action));
    }
    assert.ok(count < 14); assert.equal(game.movementPromises![0].fulfilled, true);
    assert.equal(game.players.find(p => p.id === f.target)!.spice, 5); assert.deepEqual(inventory(game), f.originalCards);
  }
});
void test('a controlled original Ornithopter acquisition leaves the foreign flight intact during a waiting-owner forecast', () => {
  const f = boxFixture(), source = structuredClone(f.game);
  const index = source.richeseCache!.findIndex(card => card.effect === 'ornithopter'); assert.ok(index >= 0);
  const card = source.richeseCache!.splice(index, 1)[0]; source.players.find(p => p.id === f.active)!.hand.push(card);
  let game = pass(act(source, f.active, { type: 'ship', territory: 'tueks_sietch', sector: 5, amount: 2 }));
  game = pass(act(game, f.active, { type: 'move', from: 'tueks_sietch:5', territory: 'south_mesa', sector: 5,
    amount: 1, movementCard: card.id, ornithopter: 'twoGroups' }));
  const flight = structuredClone(game.ornithopter); assert.equal(flight?.player, f.active); assert.equal(flight.completed, 1);
  game = ask(game, f.asker, f.truth, f.claim); assert.ok(viewGame(game, f.target).truthMovementAnswers!.includes('yes'));
  const before = structuredClone(game); viewGame(game, f.target); assert.deepEqual(game, before);
  game = pass(act(game, f.target, { type: 'truthAnswer', answer: 'yes' }));
  assert.deepEqual(game.ornithopter, flight); assert.equal(game.discard.filter(c => c.id === card.id).length, 0);
  assert.equal(viewGame(game, f.target).movementPromisePolicy, null);
  game = pass(act(game, f.active, f.currentEnd)); assert.equal(game.active, f.target);
  assert.equal(game.discard.filter(c => c.id === card.id).length, 1);
  game = pass(act(game, f.target, viewGame(game, f.target).movementPromisePolicy![0]));
  game = pass(act(game, f.target, viewGame(game, f.target).movementPromisePolicy![0]));
  assert.equal(game.movementPromises![0].fulfilled, true); assert.deepEqual(inventory(game), f.originalCards);
});
void test('a controlled native Fremen response cannot hide a waiting Box owner spending its last shipment money', () => {
  for (const spice of [2, 3]) {
    const source = createGame('WAITINGBOXFOREIGNMOVE', newPlayer('f', 'Current Fremen', 'fremen'), false, ['choam']);
    joinGame(source, newPlayer('e', 'Waiting Emperor', 'emperor')); joinGame(source, newPlayer('r', 'Richese counter', 'richese'));
    Object.assign(source, { status: 'playing', phase: 5, turn: 2, storm: 18, active: 'f', order: ['f', 'e', 'r'],
      movementRemaining: ['f', 'e', 'r'], deck: treacheryDeck(['choam']), richeseCache: richeseCards() });
    const [fremen, emperor, richese] = source.players;
    fremen.forces = { 'red_chasm:7': 4 }; fremen.reserves = 16; fremen.shipped = true;
    emperor.spice = spice;
    const take = (effect: string, owner: typeof emperor) => {
      const index = source.deck.findIndex(card => card.effect === effect); assert.ok(index >= 0);
      const card = source.deck.splice(index, 1)[0]; owner.hand.push(card); return card.id;
    };
    const truth = take('truthtrance', fremen); take('karama', richese);
    const boxIndex = source.richeseCache!.findIndex(card => card.effect === 'nullentropyBox'); assert.ok(boxIndex >= 0);
    const box = source.richeseCache!.splice(boxIndex, 1)[0]; emperor.hand.push(box);
    const old = source.deck.findIndex(card => card.kind === 'shield'); assert.ok(old >= 0);
    source.discard.push(source.deck.splice(old, 1)[0]);
    // Modeled past payment/discard and conserved cache acquisition. The native
    // movement declaration/response and attempted paid Box are actual actions.
    let game = ask(source, fremen.id, truth, { kind: 'movement', target: emperor.id, territory: 'carthag', minimum: 1 });
    game = act(game, emperor.id, { type: 'truthAnswer', answer: 'yes' });
    const destination = TERRITORIES.flatMap(t => t.sectors.map(sector => ({ territory: t.id, sector }))).find(to =>
      to.sector !== 18 && gameDistance(game, 'red_chasm:7', `${to.territory}:${to.sector}`, key => splitLocation(key).sector === 18) === 2);
    assert.ok(destination);
    game = act(game, fremen.id, { type: 'move', from: 'red_chasm:7', amount: 4, ...destination });
    assert.equal(game.response?.kind, 'fremenMovement'); assert.ok(game.pendingFremenMove);
    const before = structuredClone(game);
    if (spice === 2) {
      assert.throws(() => act(game, emperor.id, { type: 'card', card: box.id })); assert.deepEqual(game, before);
    } else {
      const paid = act(game, emperor.id, { type: 'card', card: box.id });
      const choice = viewGame(paid, emperor.id).movementPromisePolicy![0];
      assert.equal(choice.type, 'decision'); assert.equal(choice.event, paid.pendingNullentropy!.event);
      const restored = act(paid, emperor.id, choice);
      assert.equal(restored.active, fremen.id); assert.equal(restored.response?.kind, 'fremenMovement');
      assert.deepEqual(restored.pendingFremenMove, before.pendingFremenMove);
      assert.equal(restored.players.find(p => p.id === emperor.id)!.spice, 1);
      assert.equal(restored.movementPromises![0].released, undefined);
      assert.equal(viewGame(restored, emperor.id).movementPromisePolicy, null);
    }
  }
});
void test('a genuine waiting Yes survives another player matching and ending, then executes only on its actual turn', () => {
  const { f, game: bound } = bind(); let game = bound;
  assert.equal(viewGame(game, f.target).movementPromisePolicy, null);
  const before = structuredClone(game); assert.throws(() => act(game, f.target, f.shipment)); assert.deepEqual(game, before);
  game = act(game, f.asker, f.currentMove); assert.equal(game.movementPromises![0].fulfilled, undefined);
  assert.equal(game.movementPromises![0].released, undefined); assert.equal(viewGame(game, f.target).movementPromisePolicy, null);
  game = act(game, f.asker, f.currentEnd); assert.equal(game.active, f.target);
  assert.equal(game.movementPromises![0].fulfilled, undefined);
  game = act(game, f.target, viewGame(game, f.target).movementPromisePolicy![0]);
  assert.equal(game.movementPromises![0].fulfilled, undefined);
  game = act(game, f.target, viewGame(game, f.target).movementPromisePolicy![0]);
  assert.equal(game.movementPromises![0].fulfilled, true);
  game = act(game, f.target, { type: 'endMovement' }); assert.deepEqual(inventory(game), f.originalCards);
});
void test('a genuine waiting No ignores another player matching and remains binding until its own actual ending', () => {
  const { f, game: bound } = bind('no'); let game = act(bound, f.asker, f.currentMove);
  assert.equal(game.movementPromises![0].fulfilled, undefined);
  game = act(game, f.asker, f.currentEnd); assert.equal(game.movementPromises![0].fulfilled, undefined);
  game = act(game, f.target, f.shipment);
  assert.throws(() => act(game, f.target, f.move));
  game = act(game, f.target, { type: 'endMovement' }); assert.equal(game.movementPromises![0].fulfilled, true);
});
void test('waiting-owner bribes retain the real later shipment fee while actual opposing loss can release Yes', () => {
  const { f, game } = bind(), before = structuredClone(game);
  assert.equal(viewGame(game, f.target).bribeOptions.targets.find(p => p.id === f.asker)!.maximum, f.balances[f.target] - 1);
  assert.throws(() => act(game, f.target, { type: 'bribe', target: f.asker, amount: f.balances[f.target] }));
  assert.deepEqual(game, before);
  const funded = act(game, f.target, { type: 'bribe', target: f.asker, amount: f.balances[f.target] - 1 });
  assert.equal(funded.movementPromises![0].released, undefined);
  // Controlled conserved opposing-loss edge, not a claimed natural card effect.
  const harmed = structuredClone(funded); harmed.players.find(p => p.id === f.target)!.spice--;
  harmed.players.find(p => p.id === f.asker)!.spice++;
  assert.equal(normalizeAutomaticGame(harmed).movementPromises![0].released, true);
});
void test('a controlled mutual alliance cannot open an Emperor gift that spends the waiting movement route', () => {
  const { f, game: bound } = bind(), game = structuredClone(bound);
  const funded = act(bound, f.target, { type: 'bribe', target: f.asker, amount: f.balances[f.target] - 1 });
  for (const source of [game, funded]) {
    source.players.find(p => p.id === f.target)!.ally = f.asker;
    source.players.find(p => p.id === f.asker)!.ally = f.target;
  }
  const before = structuredClone(funded);
  assert.throws(() => act(funded, f.target, { type: 'emperorGift', amount: 1 })); assert.deepEqual(funded, before);
  const affordable = act(game, f.target, { type: 'emperorGift', amount: 1 });
  assert.equal(affordable.movementPromises![0].released, undefined);
});
void test('all four minimal profiles answer while waiting and finish their actual later turn without premature witness actions', () => {
  const f = fixture({ hajr: false }), asked = ask(f.game, f.asker, f.truth, f.claim);
  for (const difficulty of DIFFICULTIES) {
    let game = asked; const view = viewGame(game, f.target); view.players.find(p => p.id === f.target)!.bot = difficulty;
    const answer = botActions(view)[0]; assert.equal(answer.type, 'truthAnswer');
    game = act(game, f.target, answer); assert.equal(viewGame(game, f.target).movementPromisePolicy, null);
    game = act(game, f.asker, f.currentMove); game = act(game, f.asker, f.currentEnd);
    let count = 0;
    while (game.phase === 5 && game.active === f.target && count++ < 10) {
      const own = viewGame(game, f.target); own.players.find(p => p.id === f.target)!.bot = difficulty;
      const next = botActions(own)[0]; assert.ok(next); game = act(game, f.target, next);
    }
    assert.ok(count < 10); assert.equal(game.movementPromises![0].fulfilled, true);
    assert.deepEqual(inventory(game), f.originalCards);
  }
});
