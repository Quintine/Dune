import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { TERRITORIES } from '../game/board';
import {
  actSaphoStartedMovement as act,
  advanceSaphoStartedMovement as advance,
  createSaphoStartedMovementFixture as fixture,
  saphoStartedMovementAction as saphoAction,
  saphoStartedMovementClean as clean,
  saphoStartedMovementInventory as inventory,
  saphoStartedMovementPlayer as player,
} from './fixture-sapho-started-movement';

function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

/** Original Advanced setup and paid Sapho purchase, followed by actual prior
 * turns and an Emperor shipment. Inherited fixture selects only unopened
 * starting deal/spice positions and scalar lotteries; no played state is set. */
function source() {
  const f = fixture({ advanced: true });
  let game = advance(structuredClone(f.game), state =>
    state.phase === 5 && clean(state) && state.active === f.owner);
  assert.ok(game.movementRemaining?.some(id => id !== f.owner));
  assert.equal(player(game, f.owner).shipped, false);
  const prior = saphoAction(game, 'last', f.owner);
  const beforeShipment = structuredClone(game);
  const declared = act(game, f.owner, {
    type: 'ship', territory: 'polar_sink', sector: 0, amount: 1, elite: 0, allyPayment: 0,
  });
  game = advance(declared, clean);
  assert.equal(game.active, f.owner);
  assert.equal(player(game, f.owner).shipped, true);
  assert.equal(player(game, f.owner).moved, 0);
  assert.equal(player(beforeShipment, f.owner).reserves - player(game, f.owner).reserves, 1);
  assert.equal(player(beforeShipment, f.owner).spice - player(game, f.owner).spice, 2);
  assert.equal(player(game, f.owner).forces['polar_sink:0'], 1);
  assert.deepEqual(inventory(game), f.originalInventory);
  return { f, game, prior, declared };
}

void test('Advanced Sapho suspends a genuinely paid shipment and resumes the same owner after Guild', () => {
  const { f, game: original, prior } = source();
  const option = viewGame(original, f.owner).saphoOptions.find(row => row.scope === 'movement' && row.mode === 'last');
  assert.ok(option && option.scope === 'movement' && option.resumeOwn);
  assert.notEqual(option.event, prior.event);
  reject(original, f.owner, prior);
  const before = structuredClone(player(original, f.owner));
  let game = advance(act(original, f.owner, saphoAction(original, 'last', f.owner)), clean);
  assert.equal(game.active, f.guild);
  assert.equal(game.saphoMovementLast?.player, f.owner);
  assert.equal(player(game, f.owner).spice, before.spice);
  assert.equal(player(game, f.owner).reserves, before.reserves);
  assert.deepEqual(player(game, f.owner).forces, before.forces);
  assert.equal(player(game, f.owner).shipped, true);
  assert.equal(player(game, f.owner).moved, 0);
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
  assert.deepEqual(inventory(game), f.originalInventory);

  game = advance(game, state => state.phase === 5 && clean(state) && state.active === f.owner);
  assert.equal(player(game, f.owner).shipped, true);
  assert.equal(player(game, f.owner).moved, 0);
  reject(game, f.owner, { type: 'ship', territory: 'polar_sink', sector: 0, amount: 1, elite: 0, allyPayment: 0 });
  game = act(game, f.owner, { type: 'endMovement' });
  assert.notEqual(game.phase, 5);
  assert.deepEqual(inventory(game), f.originalInventory);
});

void test('Advanced own-last waits for the real shipment response before allowing suspension', () => {
  const { f, prior, declared } = source();
  assert.ok(!clean(declared));
  assert.equal(viewGame(declared, f.owner).saphoOptions.some(row => row.scope === 'movement'), false);
  reject(declared, f.owner, prior);
  assert.ok(player(declared, f.owner).hand.some(card => card.id === f.card));
  assert.deepEqual(inventory(declared), f.originalInventory);
});

void test('Advanced own-last preserves a completed ground movement without granting another', () => {
  const { f, game: original } = source();
  let moved: Game | undefined;
  let destination: string | undefined;
  for (const place of TERRITORIES) {
    for (const sector of place.sectors) {
      try {
        moved = act(original, f.owner, { type: 'move', from: 'polar_sink:0', territory: place.id,
          sector, amount: 1, elite: 0 });
        destination = `${place.id}:${sector}`;
        break;
      } catch { /* Find a real legal destination using the native validator. */ }
    }
    if (moved) break;
  }
  assert.ok(moved && destination);
  let game = advance(moved, clean);
  assert.equal(player(game, f.owner).moved, 1);
  game = advance(act(game, f.owner, saphoAction(game, 'last', f.owner)), clean);
  game = advance(game, state => state.phase === 5 && clean(state) && state.active === f.owner);
  assert.equal(player(game, f.owner).moved, 1);
  assert.equal(player(game, f.owner).forces[destination], 1);
  reject(game, f.owner, { type: 'move', from: destination, territory: 'polar_sink', sector: 0, amount: 1, elite: 0 });
  game = act(game, f.owner, { type: 'endMovement' });
  assert.notEqual(game.phase, 5);
  assert.deepEqual(inventory(game), f.originalInventory);
});

void test('all four minimal profiles can select an actual Advanced own-last opportunity', () => {
  const { f, game } = source();
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, f.owner);
    view.players.find(seat => seat.id === f.owner)!.bot = difficulty;
    const action = botActions(view).find(candidate => candidate.type === 'card' && candidate.card === f.card &&
      candidate.scope === 'movement' && candidate.mode === 'last');
    assert.ok(action, `${difficulty} proposes the native suspension`);
    const next = advance(act(structuredClone(game), f.owner, action), clean);
    assert.notEqual(next.active, f.owner);
    assert.equal(player(next, f.owner).shipped, true);
    assert.deepEqual(inventory(next), f.originalInventory);
  }
});

for (const take of [false, true]) void test(
  `Advanced Guild ${take ? 'TAKE' : 'WAIT'} after an early own-last suspension preserves the protected tail`, () => {
    const f = fixture({ advanced: true });
    const game = structuredClone(f.game);
    // Controlled supplemental custody: the original purchased Sapho changes
    // hands to the actual paid current actor. No card or resource is minted.
    const owner = player(game, f.owner), current = player(game, f.current);
    const index = owner.hand.findIndex(card => card.id === f.card);
    assert.ok(index >= 0);
    current.hand.push(...owner.hand.splice(index, 1));
    assert.deepEqual(inventory(game), f.originalInventory);
    const before = structuredClone(current);
    const option = viewGame(game, f.current).saphoOptions.find(row => row.scope === 'movement' && row.mode === 'last');
    assert.ok(option && option.scope === 'movement' && option.resumeOwn);
    const suspended = act(game, f.current, { type: 'card', card: f.card, scope: 'movement', mode: 'last', event: option.event });
    assert.equal(suspended.saphoMovementLast?.player, f.current);
    assert.equal(player(suspended, f.current).shipped, true);
    assert.equal(player(suspended, f.current).spice, before.spice);
    assert.equal(suspended.decision?.kind, 'guildTiming');
    const declared = act(suspended, f.guild, { type: 'decision', take });
    const after = advance(declared, clean);
    if (take) assert.equal(after.active, f.guild);
    else assert.notEqual(after.active, f.guild);
    assert.equal(after.movementRemaining?.at(-1), f.current);
    const returned = advance(after, state => state.phase === 5 && clean(state) && state.active === f.current);
    assert.equal(player(returned, f.current).shipped, true);
    assert.equal(player(returned, f.current).spice, before.spice);
    reject(returned, f.current, { type: 'ship', territory: 'polar_sink', sector: 0, amount: 1, elite: 0, allyPayment: 0 });
    const done = act(returned, f.current, { type: 'endMovement' });
    assert.notEqual(done.phase, 5);
    assert.deepEqual(inventory(done), f.originalInventory);
  },
);
