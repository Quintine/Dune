import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { location } from '../game/board';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createSemutaFremenGuildMovementFixture as fixture, actSemutaFremenGuildMovement as act,
  passSemutaFremenGuildMovement as pass, claimSemutaFremenGuildMovement as claim,
  allowSemutaFremenGuildMovement as allow, replaceSemutaFremenMovement as replace,
  semutaFremenGuildMovementInventory as inventory, semutaFremenGuildMovementPlayer as player,
  type SemutaFremenGuildMovementFixture,
} from './fixture-semuta-fremen-guild-movement';

const variants = [
  { kind: 'fremenMovement' as const, advanced: false },
  { kind: 'fremenMovement' as const, advanced: true },
  { kind: 'guildTiming' as const, advanced: true, take: true },
  { kind: 'guildTiming' as const, advanced: true, take: false },
];
const physical = (game: Game) => ({
  players: game.players.map(player => ({ id: player.id, spice: player.spice,
    reserves: player.reserves, tanks: player.tanks, forces: player.forces, elites: player.elites,
    moved: player.moved, shipped: player.shipped, revived: player.revived, ally: player.ally })),
  turn: game.turn, phase: game.phase, storm: game.storm, order: game.order,
  spiceDeck: game.spiceDeck, spiceDiscard: game.spiceDiscard,
});
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
function nativeSource(f: SemutaFremenGuildMovementFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.semutaPreview, true);
  assert.ok(f.beforeStartingDeal.players.every(player => player.hand.length === 0));
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.equal(player(f.afterSetup, f.fremen).forces['sietch_tabr:14'], 10);
  assert.ok(f.actions.some(step => step.actor === f.fremen && step.action.type === 'fremenSetup'));
  assert.equal(f.acquisition.price, 1);
  assert.ok(f.acquisition.steps.some(step => step.actor === f.holder && step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquisition.after, f.holder).spice, 1);
  assert.equal(player(f.acquisition.after, f.richese).spice - player(f.acquisition.before, f.richese).spice, 1);
  assert.ok(player(f.game, f.holder).hand.some(card => card.id === f.semuta));
  assert.ok(player(f.game, f.spender).hand.some(card => card.id === f.cost));
  assert.equal(f.game.phase, 5); assert.equal(f.game.turn, 1);
  assert.equal(f.game.response?.kind, f.kind); assert.equal(f.game.response?.owner, f.owner);
  assert.equal(f.game.phaseOpening ?? null, null); assert.equal(f.game.decision ?? null, null);
  assert.equal(f.sourceActionCount, f.actions.length);
  assert.deepEqual(inventory(f.game), f.originalInventory);
  if (f.kind === 'fremenMovement') {
    assert.ok(f.shipment && f.pending);
    assert.equal(player(f.game, f.owner).shipped, true); assert.equal(player(f.game, f.owner).moved, 0);
    assert.equal(player(f.game, f.owner).forces['the_great_flat:15'], 1);
    assert.equal(player(f.game, f.owner).spice, player(f.shipment.before, f.owner).spice);
    assert.equal(f.pending.turn, f.game.turn); assert.equal(f.pending.move, 0);
    assert.deepEqual(f.pending.order.group, [['sietch_tabr:14', 1]]);
    assert.equal(f.pending.order.elite, 0);
    assert.deepEqual(player(f.game, f.owner), player(f.beforeDeclaration, f.owner));
  } else {
    assert.equal(f.game.response?.take, f.take);
    assert.equal(f.game.active, null);
    assert.equal(f.game.movementRemaining![0] === f.guild, !f.take);
    assert.equal(f.game.guildTimingGranted, false); assert.equal(f.game.guildTimingLocked, false);
    assert.deepEqual(physical(f.game), physical(f.beforeDeclaration));
    if (!f.take) {
      assert.equal(f.game.storm, 7); assert.equal(f.game.playerPositions![f.guild], 3);
      assert.deepEqual(f.actions.filter(step => step.action.type === 'stormDial').map(step => step.action.amount).sort((a,b) => Number(a)-Number(b)), [0, 6]);
      assert.equal(f.actions.filter(step => step.action.type === 'seatPosition').length, 3);
    }
  }
}
function open(f: SemutaFremenGuildMovementFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.reaction?.stage, 'offer');
  assert.equal(pending.continuation.kind, 'karamaMovementDiscard');
  assert.equal(pending.batch.cause, `karama:${f.kind}`);
  assert.deepEqual(pending.batch.entries.map(entry => ({ id: entry.card.id, by: entry.discardedBy, public: entry.publicFace })),
    [{ id: f.cost, by: f.spender, public: true }]);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(game.response ?? null, null);
  if (pending.continuation.kind !== 'karamaMovementDiscard') throw Error('Use the exact native movement-cost continuation');
  assert.equal(pending.continuation.player, f.spender); assert.equal(pending.continuation.card, f.cost);
  assert.equal(pending.continuation.use.kind, 'cancel');
  assert.equal(pending.continuation.use.response.kind, f.kind);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.deepEqual(physical(game), physical(f.game));
  assert.deepEqual(game.movementRemaining, f.originalRemaining); assert.equal(game.active, f.originalActive);
  assert.equal(game.guildTimingGranted, f.game.guildTimingGranted);
  assert.equal(game.guildTimingLocked, f.game.guildTimingLocked);
  assert.deepEqual(game.pendingFremenMove ?? null, f.pending);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(inventory(game), f.originalInventory);
  return game;
}
function prevented(game: Game, f: SemutaFremenGuildMovementFixture, claimed: boolean) {
  assert.equal(game.pendingTreacheryDiscard ?? null, null);
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(game.phaseOpening ?? null, null); assert.equal(game.pendingKarama ?? null, null);
  assert.deepEqual(physical(game), physical(f.game));
  assert.deepEqual(game.movementRemaining, f.originalRemaining);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  if (f.kind === 'fremenMovement') {
    assert.equal(game.pendingFremenMove ?? null, null);
    assert.equal(game.active, f.fremen); assert.equal(player(game, f.fremen).moved, 0);
    assert.deepEqual(player(game, f.fremen).fremenMovementBlocked, { turn: game.turn, move: 0 });
    assert.deepEqual(player(game, f.fremen).forces, player(f.beforeDeclaration, f.fremen).forces);
    reject(game, f.fremen, f.nativeAction);
  } else {
    assert.equal(game.active, f.originalRemaining[0]);
    assert.equal(game.guildTimingLocked, true); assert.equal(game.guildTimingGranted, false);
    assert.ok(game.players.every(player => !player.shipped && player.moved === 0));
  }
  assert.deepEqual(inventory(game), f.originalInventory);
  return game;
}
function finishReplacement(game: Game, f: SemutaFremenGuildMovementFixture) {
  const result = replace(game, f), destination = location(result.replacement.territory as string, result.replacement.sector as number);
  assert.equal(player(result.afterReplacement, f.fremen).moved, 1);
  assert.equal(player(result.afterReplacement, f.fremen).forces['sietch_tabr:14'], player(game, f.fremen).forces['sietch_tabr:14'] - 1);
  assert.equal(player(result.afterReplacement, f.fremen).forces[destination], (player(game, f.fremen).forces[destination] ?? 0) + 1);
  assert.equal(player(result.afterReplacement, f.fremen).spice, player(game, f.fremen).spice);
  assert.equal(player(result.afterReplacement, f.fremen).shipped, true);
  assert.equal(result.end.type, 'endMovement');
  assert.ok(!result.game.movementRemaining!.includes(f.fremen));
  assert.deepEqual(inventory(result.game), f.originalInventory);
}

for (const variant of variants) for (const claimed of [false, true]) void test(
  `${variant.advanced ? 'Advanced' : 'Basic'} ${variant.kind}${variant.kind === 'guildTiming' ? variant.take ? ' TAKE' : ' WAIT' : ''} printed cost is ${claimed ? 'claimed' : 'passed'} before native prevention`, () => {
    const f = fixture(variant); nativeSource(f);
    const pending = open(f), event = pending.pendingTreacheryDiscard!.batch.event;
    const game = prevented(claimed ? claim(pending, f.holder) : pass(pending), f, claimed);
    reject(game, f.holder, { type: 'semutaCommit', event });
    reject(game, f.holder, { type: 'semutaPass', event });
    if (f.kind === 'fremenMovement') finishReplacement(game, f);
  });

void test('native allowance controls commit the original range-two group or the exact Guild timing once without card costs', () => {
  for (const variant of variants) {
    const f = fixture(variant); nativeSource(f);
    const game = allow(structuredClone(f.game));
    assert.equal(game.pendingTreacheryDiscard ?? null, null);
    assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
    assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
    if (f.kind === 'fremenMovement') {
      const to = location(f.nativeAction.territory as string, f.nativeAction.sector as number);
      assert.equal(game.pendingFremenMove ?? null, null);
      assert.equal(player(game, f.fremen).moved, 1); assert.equal(player(game, f.fremen).shipped, true);
      assert.equal(player(game, f.fremen).forces['sietch_tabr:14'], player(f.game, f.fremen).forces['sietch_tabr:14'] - 1);
      assert.equal(player(game, f.fremen).forces[to], (player(f.game, f.fremen).forces[to] ?? 0) + 1);
      assert.equal(player(game, f.fremen).fremenMovementBlocked ?? null, null);
    } else {
      assert.deepEqual(physical(game), physical(f.game));
      assert.equal(game.guildTimingGranted, true); assert.equal(game.guildTimingLocked, false);
      const expected = f.take ? f.originalRemaining : [...f.originalRemaining.filter(id => id !== f.guild), f.guild];
      assert.deepEqual(game.movementRemaining, expected);
      assert.equal(game.active, f.take ? f.guild : expected[0]);
    }
    assert.deepEqual(inventory(game), f.originalInventory);
  }
});

void test('the exact fresh movement cost rejects underlying declarations and stale reactions without repeating physical settlement', () => {
  for (const variant of variants) {
    const f = fixture(variant), pending = open(f), event = pending.pendingTreacheryDiscard!.batch.event;
    reject(pending, f.spender, f.action);
    reject(pending, f.owner, f.nativeAction);
    reject(pending, f.owner, { type: 'passResponse' });
    const game = prevented(claim(pending, f.holder), f, true);
    reject(game, f.holder, { type: 'semutaCommit', event });
    reject(game, f.holder, { type: 'semutaPass', event });
  }
});

void test('all four minimal policies answer every original Fremen/Guild movement-cost source legally', () => {
  for (const variant of variants) {
    const f = fixture(variant), pending = open(f), event = pending.pendingTreacheryDiscard!.batch.event;
    for (const difficulty of DIFFICULTIES) {
      const own = viewGame(pending, f.holder); own.players.find(player => player.id === f.holder)!.bot = difficulty;
      const before = structuredClone(own), action = botActions(own)[0]; assert.ok(action, difficulty);
      assert.deepEqual(own, before);
      assert.ok(action.type === 'semutaCommit' || action.type === 'semutaPass'); assert.equal(action.event, event);
      let game = act(structuredClone(pending), f.holder, action);
      const claimed = action.type === 'semutaCommit';
      if (game.pendingTreacheryDiscard?.reaction?.stage === 'select') {
        const selecting = viewGame(game, f.holder); selecting.players.find(player => player.id === f.holder)!.bot = difficulty;
        const selected = botActions(selecting)[0]; assert.ok(selected);
        assert.equal(selected.type, 'semutaSelect'); assert.equal(selected.card, f.cost);
        game = act(game, f.holder, selected);
      } else if (game.pendingTreacheryDiscard) game = pass(game);
      prevented(game, f, claimed);
    }
  }
});
