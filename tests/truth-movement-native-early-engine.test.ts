import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { createTruthMovementNativeEarlyFixture as fixture, actTruthMovementNativeEarly as act,
  advanceTruthMovementNativeEarly as advance, truthMovementNativeEarlyClean as clean,
  truthMovementNativeEarlyPlayer as player, truthMovementNativeEarlyInventory as inventory,
  type TruthMovementNativeEarlyFixture as Fixture } from './fixture-truth-movement-native-early';

const owner = (game: Game) => player(game, 'emperor');

function ask(f: Fixture, source = f.game, question: Record<string, unknown> = f.claim) {
  let game = act(source, f.asker, f.declarationStep.action);
  while (game.truthtrance?.stage === 'priority') {
    const owner = game.players.find(p => !game.truthtrance!.passed.includes(p.id)); assert.ok(owner);
    game = act(game, owner.id, { type: 'truthPass' });
  }
  assert.ok(viewGame(game, f.asker).truthMovementTargets.includes(f.target));
  return act(game, f.asker, { type: 'truthAsk', question });
}
function bound(f = fixture(), source = f.game, question: Record<string, unknown> = f.claim) {
  const game = ask(f, source, question);
  assert.ok(viewGame(game, f.target).truthMovementAnswers!.includes('yes'));
  return advance(act(game, f.target, { type: 'truthAnswer', answer: 'yes' }), clean);
}
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}

void test('fresh Basic E1, E2 and E3 Charity sources can bind later physical movement without granting an early move', () => {
  for (const roster of ['richese-choam', 'ecaz-moritani', 'ixians-tleilaxu'] as const) {
    const f = fixture({ roster }), game = bound(f);
    assert.equal(game.phase, 2); assert.equal(owner(game).spice, 10);
    assert.deepEqual(owner(game).forces, {}); assert.equal(owner(game).reserves, 20);
    assert.deepEqual(inventory(game), f.originalCards);
    assert.deepEqual(viewGame(game, f.target).movementPromisePolicy, [{ type: 'ready' }]);
    reject(game, f.target, f.shipment); reject(game, f.target, f.move);
  }
});

void test('a question after a native standing or sealed bid prices its own split before offering Yes', () => {
  for (const method of ['onceAround', 'silent'] as const) for (const minimum of [8, 9]) {
    const f = fixture(), auction = { method };
    let game = advance(f.game, g => g.phase === 3 && clean(g) && !!g.richeseAuction &&
      (method === 'silent' ? !Object.hasOwn(g.richeseAuction.sealed, f.target) : g.richeseAuction.active === f.target), [], auction);
    game = act(game, f.target, { type: 'richeseBid', event: game.richeseAuction!.event, amount: 2, allyPayment: 0 });
    game = ask(f, game, { ...f.claim, minimum });
    assert.equal(viewGame(game, f.target).truthMovementAnswers!.includes('yes'), minimum === 8);
    assert.equal(owner(game).spice, 10, 'A quote does not pay its current invoice');
    assert.equal(game.richeseFunding?.[f.target].amount, 2);
  }
});

void test('controlled Silent ally funding keeps the full pledge locked and resolves only the actual winning donor cost', () => {
  for (const loses of [false, true]) for (const allyPayment of [1, 3]) {
    const f = fixture(), source = structuredClone(f.game), auction = { method: 'silent' as const };
    owner(source).ally = 'choam'; player(source, 'choam').ally = f.target;
    let game = advance(bound(f, source), g => g.phase === 3 && clean(g) && !!g.richeseAuction && !g.richeseAuction.outcome, [], auction);
    game = act(game, f.target, { type: 'pledgeAid', amount: 8 });
    const event = game.richeseAuction!.event;
    game = act(game, 'choam', { type: 'richeseBid', event, amount: 3, allyPayment });
    assert.equal(game.movementPromises![0].released, undefined);
    reject(game, f.target, { type: 'pledgeAid', amount: 7 });
    const zero = { type: 'richeseBid', event, amount: 0, allyPayment: 0 };
    assert.deepEqual(viewGame(game, f.target).movementPromisePolicy, [zero]);
    game = act(game, f.target, zero);
    assert.equal(game.movementPromises![0].released, undefined);
    game = act(game, 'richese', { type: 'richeseBid', event, amount: loses ? 4 : 0, allyPayment: 0 });
    game = advance(game, g => g.phase === 4 && clean(g), [], auction);
    assert.equal(owner(game).spice, loses ? 14 : 10 - allyPayment);
    assert.equal(game.movementPromises![0].released, !loses && allyPayment === 3 ? true : undefined);
  }
});

void test('controlled preopening non-CHOAM Charity forecasts wait for the real allowed or canceled payer receipt', () => {
  for (const canceled of [false, true]) {
    const f = fixture(), source = structuredClone(f.afterSetup), p = owner(source);
    // Explicit prior losses/wallet and conserved original Karama acquisition.
    // Only the original unopened ordinary Spice card is selected; no CHOAM
    // result, receipt or future income is installed by this controlled source.
    p.spice = 0; p.reserves = 0; p.tanks = 3; p.forces = { 'carthag:11': 17 };
    const index = source.spiceDeck.findIndex(card => JSON.stringify(card) === JSON.stringify(f.spiceOrder[0].card));
    assert.ok(index >= 0); source.spiceDeck.unshift(source.spiceDeck.splice(index, 1)[0]);
    const from = source.deck.findIndex(card => card.effect === 'karama'); assert.ok(from >= 0);
    const karama = source.deck.splice(from, 1)[0]; player(source, 'richese').hand.push(karama);
    let game = bound(f, source, { ...f.claim, minimum: 1 });
    assert.equal(owner(game).spice, 0); assert.equal(game.choamCharity, undefined);
    game = advance(game, g => g.response?.kind === 'choamCharity');
    if (canceled) game = act(game, 'richese', { type: 'card', card: karama.id, mode: 'cancel' });
    game = advance(game, g => g.phase === 2 && clean(g));
    assert.equal(game.choamCharity?.canceled, canceled);
    assert.deepEqual(viewGame(game, f.target).movementPromisePolicy, [{ type: 'charity' }]);
    const before = player(game, 'choam').spice;
    game = act(game, f.target, { type: 'charity' });
    assert.equal(owner(game).spice, 2); assert.equal(player(game, 'choam').spice, before - (canceled ? 0 : 2));
    game = advance(game, g => g.phase === 4 && clean(g));
    game = act(game, f.target, { type: 'revive', amount: 1 });
    game = advance(game, g => g.phase === 5 && clean(g) && g.active === f.target);
    for (let count = 0; !game.movementPromises![0].fulfilled && count < 4; count++) {
      const action = viewGame(game, f.target).movementPromisePolicy![0]; assert.ok(action);
      game = advance(act(game, f.target, action), clean);
    }
    assert.equal(game.movementPromises![0].fulfilled, true);
    assert.equal(game.movementPromises![0].released, undefined); assert.deepEqual(inventory(game), f.originalCards);
  }
});

void test('actual first/last Once Around and Silent cache invoices preserve only the affordable later eight-force route', () => {
  for (const position of ['first', 'last'] as const) for (const method of ['onceAround', 'silent'] as const) {
    const f = fixture(), auction = { position, method, card: 'richese-nullentropy-box' };
    let game = advance(bound(f), g => g.phase === 3 && clean(g) && !!g.richeseAuction &&
      !g.richeseAuction.outcome && (method === 'silent' ? !Object.hasOwn(g.richeseAuction.sealed, f.target)
        : g.richeseAuction.active === f.target), [], auction);
    const event = game.richeseAuction!.event;
    reject(game, f.target, { type: 'richeseBid', event, amount: 3, allyPayment: 0 });
    game = act(game, f.target, { type: 'richeseBid', event, amount: 2, allyPayment: 0 });
    assert.equal(game.movementPromises![0].released, undefined);
    game = advance(game, g => g.phase === 4 && clean(g), [], auction);
    assert.equal(owner(game).spice, 8); assert.ok(owner(game).hand.some(card => card.id === auction.card));
    game = advance(game, g => g.phase === 5 && clean(g) && g.active === f.target, [], auction);
    game = advance(act(game, f.target, f.shipment), clean, [], auction);
    assert.equal(owner(game).spice, 0); assert.equal(game.movementPromises![0].fulfilled, undefined);
    game = advance(act(game, f.target, f.move), clean, [], auction);
    assert.equal(game.movementPromises![0].fulfilled, true);
    game = act(game, f.target, f.endMovement);
    assert.deepEqual(inventory(game), f.originalCards);
  }
});

void test('native current-phase minimal policies pass an owned Once Around bid or submit Silent zero with the real event', () => {
  for (const method of ['onceAround', 'silent'] as const) {
    const f = fixture(), auction = { method };
    const game = advance(bound(f), g => g.phase === 3 && clean(g) && !!g.richeseAuction &&
      (method === 'silent' ? !Object.hasOwn(g.richeseAuction.sealed, f.target) : g.richeseAuction.active === f.target), [], auction);
    const expected = { type: 'richeseBid', event: game.richeseAuction!.event,
      amount: method === 'silent' ? 0 : null, allyPayment: 0 };
    assert.deepEqual(viewGame(game, f.target).movementPromisePolicy, [expected]);
    for (const difficulty of DIFFICULTIES) {
      const view = viewGame(game, f.target); view.players.find(p => p.id === f.target)!.bot = difficulty;
      assert.deepEqual(botActions(view), [expected]);
      const next = act(game, f.target, expected);
      assert.equal(next.movementPromises![0].released, undefined);
      assert.deepEqual(viewGame(next, f.target).movementPromisePolicy, []);
    }
  }
});

void test('original E1 and E3 early answers survive their native controls and fulfill only on the actual ground event', () => {
  for (const roster of ['ixians-tleilaxu', 'ecaz-moritani'] as const) {
    const f = fixture({ roster });
    let game = advance(bound(f), g => g.phase === 5 && clean(g) && g.active === f.target);
    assert.equal(game.movementPromises![0].released, undefined);
    game = advance(act(game, f.target, f.shipment), clean);
    assert.equal(game.movementPromises![0].fulfilled, undefined);
    game = advance(act(game, f.target, f.move), clean);
    assert.equal(game.movementPromises![0].fulfilled, true);
    game = act(game, f.target, f.endMovement); assert.deepEqual(inventory(game), f.originalCards);
  }
});

void test('controlled CHOAM denial retains the real pending revival and releases only an unaffordable later route', () => {
  for (const spice of [1, 3]) {
    const f = fixture(), source = advance(f.game, g => g.phase === 4 && clean(g));
    const p = owner(source); p.spice = spice; p.reserves = 0; p.tanks = 3; p.forces = { 'carthag:11': 17 };
    const index = source.deck.findIndex(card => card.name === 'La La La'); assert.ok(index >= 0);
    const card = source.deck.splice(index, 1)[0]; player(source, 'choam').hand.push(card);
    let game = bound(f, source, { ...f.claim, minimum: 1 });
    game = act(game, f.target, { type: 'revive', amount: 1 });
    assert.equal(game.decision?.kind, 'choamFreeRevival');
    assert.equal(owner(game).reserves, 0); assert.equal(owner(game).spice, spice);
    assert.equal(game.movementPromises![0].released, undefined);
    game = act(game, 'choam', { type: 'card', card: card.id, mode: 'choam' });
    game = advance(game, clean);
    assert.equal(owner(game).reserves, 0); assert.equal(owner(game).spice, spice);
    assert.equal(game.movementPromises![0].released, spice === 1 ? true : undefined);
    if (spice === 3) {
      game = advance(act(game, f.target, { type: 'revive', amount: 1 }), clean);
      assert.equal(owner(game).spice, 1); assert.equal(owner(game).reserves, 1);
      game = advance(game, g => g.phase === 5 && clean(g) && g.active === f.target);
      for (let count = 0; !game.movementPromises![0].fulfilled && count < 4; count++)
        game = advance(act(game, f.target, viewGame(game, f.target).movementPromisePolicy![0]), clean);
      assert.equal(game.movementPromises![0].fulfilled, true);
    }
    assert.deepEqual(inventory(game), f.originalCards);
  }
});
