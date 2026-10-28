import assert from 'node:assert/strict';
import test from 'node:test';
import { TERRITORIES } from '../game/board';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import {
  advanceSaphoStartedMovement as advance, createSaphoStartedMovementFixture as fixture,
  finishSaphoStartedMovement as finish, saphoStartedMovementClean as clean,
  saphoStartedMovementInventory as inventory, saphoStartedMovementPlayer as player,
  STARTED_MOVEMENT_SAPHO as SAPHO,
} from './fixture-sapho-started-movement';

function sapho(game: Game, owner: string, mode: 'first' | 'last'): Action {
  const option = viewGame(game, owner).saphoOptions.find(row => row.scope === 'movement' && row.mode === mode);
  assert.ok(option, `Sapho ${mode} must be available to the physical holder`);
  return { type: 'card', card: SAPHO, scope: 'movement', event: option.event, mode };
}

for (const startedOpponent of [false, true]) {
  void test(`Basic suspended Sapho holder recovers and replays First behind ${startedOpponent ? 'a started' : 'an unstarted'} current turn`, () => {
    const f = fixture({ ownerBeforeAtreides: true });
    let game = structuredClone(f.game);
    // Only Box ownership is staged: exchange its original unopened cache card
    // for another physical card from the owner's hand, preserving all cards.
    const holder = player(game, f.owner);
    const boxIndex = game.richeseCache!.findIndex(card => card.effect === 'nullentropyBox');
    const exchangeIndex = holder.hand.findIndex(card => card.id !== SAPHO);
    assert.ok(boxIndex >= 0 && exchangeIndex >= 0);
    const [box] = game.richeseCache!.splice(boxIndex, 1);
    game.richeseCache!.push(holder.hand.splice(exchangeIndex, 1)[0]); holder.hand.push(box);
    assert.deepEqual(inventory(game), f.originalInventory);

    // Advance through the original turns, then make the owner's actual paid
    // shipment before suspending that same combined turn to Last.
    game = advance(game, state => clean(state) && state.active === f.owner);
    const beforeShipment = structuredClone(game);
    game = applyAction(game, f.owner, { type: 'ship', territory: 'polar_sink', sector: 0,
      amount: 1, elite: 0, allyPayment: 0 });
    game = advance(game, clean);
    assert.equal(player(game, f.owner).shipped, true);
    assert.equal(player(game, f.owner).reserves, player(beforeShipment, f.owner).reserves - 1);
    assert.equal(player(game, f.owner).spice, player(beforeShipment, f.owner).spice - 2);
    let movedTo: string | undefined;
    if (startedOpponent) {
      for (const territory of TERRITORIES) {
        for (const sector of territory.sectors) {
          try {
            game = applyAction(game, f.owner, { type: 'move', from: 'polar_sink:0', territory: territory.id,
              sector, amount: 1, elite: 0 });
            movedTo = `${territory.id}:${sector}`;
            break;
          } catch { /* Try another destination through the native movement validator. */ }
        }
        if (movedTo) break;
      }
      assert.ok(movedTo, 'The real shipped force must have a legal destination.');
      game = advance(game, clean);
      assert.equal(player(game, f.owner).moved, 1);
    }
    const ownerAfterShipment = structuredClone(player(game, f.owner));
    const remainingBeforeLast = [...game.movementRemaining!];
    game = applyAction(game, f.owner, sapho(game, f.owner, 'last'));
    game = advance(game, clean);
    assert.equal(game.saphoMovementLast?.player, f.owner);
    assert.equal(game.movementRemaining!.at(-1), f.owner);
    assert.notEqual(game.active, f.owner);
    assert.ok(game.discard.some(card => card.id === SAPHO));

    const current = game.active!;
    if (startedOpponent) {
      game = applyAction(game, current, { type: 'ship', territory: 'polar_sink', sector: 0,
        amount: 1, elite: 0, allyPayment: 0 });
      game = advance(game, clean);
      assert.equal(game.active, current);
      assert.equal(player(game, current).shipped, true);
    }
    const currentBeforeReplay = structuredClone(player(game, current));
    const beforeBox = player(game, f.owner).spice;
    game = applyAction(game, f.owner, { type: 'card', card: box.id });
    if (game.pendingNullentropy) game = applyAction(game, f.owner, {
      type: 'decision', event: game.pendingNullentropy.event, card: SAPHO,
    });
    game = advance(game, clean);
    assert.equal(player(game, f.owner).spice, beforeBox - 2);
    assert.ok(player(game, f.owner).hand.some(card => card.id === SAPHO));
    const remainingBeforeReplay = [...game.movementRemaining!];
    game = applyAction(game, f.owner, sapho(game, f.owner, 'first'));
    game = advance(game, clean);
    assert.equal(game.saphoMovementLast, null);
    assert.deepEqual([...game.movementRemaining!].sort(), [...remainingBeforeReplay].sort());
    assert.deepEqual([...game.movementRemaining!].sort(), [...remainingBeforeLast].sort());
    assert.equal(player(game, f.owner).shipped, ownerAfterShipment.shipped);
    assert.equal(player(game, f.owner).moved, ownerAfterShipment.moved);
    assert.equal(player(game, f.owner).reserves, ownerAfterShipment.reserves);
    if (startedOpponent) {
      assert.equal(game.active, current);
      assert.equal(game.movementRemaining![1], f.owner);
      assert.deepEqual(player(game, current), currentBeforeReplay);
      game = applyAction(game, current, { type: 'endMovement' });
      game = advance(game, clean);
    }
    assert.equal(game.active, f.owner);
    const beforeDuplicate = structuredClone(game);
    assert.throws(() => applyAction(game, f.owner, { type: 'ship', territory: 'polar_sink', sector: 0,
      amount: 1, elite: 0, allyPayment: 0 }));
    assert.deepEqual(game, beforeDuplicate);
    assert.equal(player(game, f.owner).shipped, true);
    assert.equal(player(game, f.owner).moved, ownerAfterShipment.moved);
    if (movedTo) {
      assert.equal(player(game, f.owner).forces[movedTo], 1);
      assert.throws(() => applyAction(game, f.owner, { type: 'move', from: movedTo,
        territory: 'polar_sink', sector: 0, amount: 1, elite: 0 }));
      assert.deepEqual(game, beforeDuplicate);
    }
    assert.equal(game.discard.filter(card => card.id === SAPHO).length, 1);
    assert.deepEqual(inventory(game), f.originalInventory);

    // The owner ends the same opportunity once; the remaining original
    // actors also complete once, without synthesizing an extra turn.
    const completed = finish(game, f, { shipFollowing: false });
    assert.equal(completed.turns.filter(turn => turn.actor === f.owner).length, 1);
    assert.equal(completed.turns[0].shipment, null);
    assert.deepEqual(inventory(completed.game), f.originalInventory);
  });
}
