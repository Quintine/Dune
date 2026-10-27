import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import {
  actSaphoStartedMovement as act, advanceSaphoStartedMovement as advance,
  createSaphoStartedMovementFixture as fixture, createSaphoStartedSemutaFixture,
  finishSaphoStartedMovement as finish, saphoStartedMovementAction as action,
  saphoStartedMovementClean as clean, saphoStartedMovementPlayer as player,
  saphoStartedMovementInventory as inventory, type SaphoStartedMovementFixture,
} from './fixture-sapho-started-movement';
import { advanceSemutaHomeworldChoam, reactSemutaHomeworldChoam } from './fixture-semuta-homeworld-choam';

const resources = (game: Game) => ({ players: game.players.map(p => ({ id: p.id, spice: p.spice,
  reserves: p.reserves, tanks: p.tanks, forces: p.forces, elites: p.elites,
  shipped: p.shipped, moved: p.moved })), homeworlds: game.homeworlds,
  hajr: game.hajr, karamaShipping: game.karamaShipping, ornithopter: game.ornithopter });
const effectiveQueue = (game: Game) => [game.active!, ...game.movementRemaining!.filter(id => id !== game.active)];
const queuedOption = (game: Game, owner: string, mode: 'first' | 'last') => {
  const option = viewGame(game, owner).saphoOptions.find(option => option.scope === 'movement' && option.mode === mode);
  assert.ok(option); return option as typeof option & { afterCurrent?: string };
};
function reject(game: Game, actor: string, proposed: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, proposed)); assert.deepEqual(game, before);
}
function expectedQueue(game: Game, owner: string, mode: 'first' | 'last') {
  const current = game.active!, tail = effectiveQueue(game).slice(1).filter(id => id !== owner);
  return [current, ...(mode === 'first' ? [owner, ...tail] : [...tail, owner])];
}
function source(f: SaphoStartedMovementFixture) {
  assert.equal(f.game.advanced, f.advanced); assert.equal(f.setup.advanced, f.advanced);
  assert.ok(f.actions.some(step => step.action.type === 'start' && !!step.action.advancedPreview === f.advanced));
  assert.ok(f.beforeStartingDeal.players.every(p => p.hand.length === 0));
  assert.equal(f.beforeStartingDeal.deck[1].id, f.counter);
  assert.ok(player(f.afterSetup, f.canceler).hand.some(card => card.id === f.counter));
  assert.equal(f.acquisition.bid.actor, f.owner); assert.equal(f.acquisition.bid.action.amount, 1);
  assert.equal(player(f.acquisition.before, f.owner).spice - player(f.acquired, f.owner).spice, 1);
  assert.equal(player(f.acquired, 'richese').spice - player(f.acquisition.before, 'richese').spice, 1);
  assert.equal(f.shipment.step.actor, f.current); assert.equal(f.shipment.step.action.amount, 1);
  assert.equal(player(f.beforeShipment, f.current).shipped, false);
  assert.equal(player(f.game, f.current).shipped, true); assert.equal(player(f.game, f.current).moved, 0);
  assert.equal(player(f.game, f.current).forces['polar_sink:0'], 1);
  assert.equal(player(f.beforeShipment, f.current).reserves - player(f.game, f.current).reserves, 1);
  assert.equal(player(f.beforeShipment, f.current).spice - player(f.game, f.current).spice, f.guildTake ? 1 : 2);
  assert.equal(f.game.active, f.current); assert.equal(player(f.game, f.owner).shipped, false);
  assert.equal(player(f.game, f.owner).moved, 0);
  assert.ok(player(f.game, f.owner).hand.some(card => card.id === f.card));
  assert.ok(player(f.game, f.canceler).hand.some(card => card.id === f.counter));
  assert.equal(f.sourceActionCount, f.actions.length); assert.deepEqual(inventory(f.game), f.originalInventory);
}
function ordered(f: SaphoStartedMovementFixture, mode: 'first' | 'last') {
  const option = queuedOption(f.game, f.owner, mode), proposed = action(f.game, mode), before = resources(f.game);
  assert.equal(option.afterCurrent, f.current); assert.equal('afterCurrent' in proposed, false);
  assert.deepEqual(Object.keys(proposed).sort(), ['card', 'event', 'mode', 'scope', 'type']);
  assert.notEqual(option.event, `movement:${f.game.turn}`, 'The started-tail quote binds its current and remaining actors');
  const game = act(structuredClone(f.game), f.owner, proposed);
  assert.deepEqual(game.movementRemaining, expectedQueue(f.game, f.owner, mode));
  assert.equal(game.active, f.current); assert.deepEqual(player(game, f.current), player(f.game, f.current));
  assert.deepEqual(resources(game), before); assert.deepEqual(game.order, f.game.order);
  assert.equal(game.guildTimingGranted, f.game.guildTimingGranted); assert.equal(game.guildTimingLocked, f.game.guildTimingLocked);
  assert.equal(game.decision, null); assert.equal(game.response, null);
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
  assert.equal(player(game, f.owner).hand.some(card => card.id === f.card), false);
  assert.deepEqual(inventory(game), f.originalInventory);
  if (mode === 'last') assert.deepEqual(game.saphoMovementLast, { event: `movement:${game.turn}`, turn: game.turn, player: f.owner });
  else assert.ok(!game.saphoMovementLast);
  return game;
}
function complete(f: SaphoStartedMovementFixture, game: Game, mode: 'first' | 'last', guildTake = false) {
  const result = finish(game, f, { guildTake });
  assert.notEqual(result.game.phase, 5); assert.deepEqual(result.game.movementRemaining, []);
  assert.deepEqual(result.game.order, f.game.order); assert.deepEqual(inventory(result.game), f.originalInventory);
  assert.equal(result.turns[0].actor, f.current); assert.equal(result.turns[0].shipment, null);
  assert.deepEqual(player(result.turns[0].afterShipment, f.current), player(game, f.current));
  assert.equal(result.actions.filter(step => step.action.type === 'endMovement').length, result.turns.length);
  assert.equal(new Set(result.turns.map(turn => turn.actor)).size, result.turns.length);
  assert.deepEqual(result.turns.map(turn => turn.actor).sort(), [...effectiveQueue(f.game)].sort());
  assert.equal(player(result.game, f.current).forces['polar_sink:0'], 1);
  assert.equal(player(result.game, f.current).shipped, true); assert.equal(player(result.game, f.current).moved, 0);
  assert.equal(result.actions.some(step => step.actor === f.current && step.action.type === 'ship'), false);
  assert.equal(result.game.discard.filter(card => card.id === f.card).length, 1);
  const own = result.turns.find(turn => turn.actor === f.owner)!; assert.ok(own.shipment);
  assert.equal(player(own.before, f.owner).spice - player(own.afterShipment, f.owner).spice, 2);
  assert.equal(player(result.game, f.owner).forces['imperial_basin:9'], 1);
  if (!guildTake || f.guildTake || mode === 'last')
    assert.deepEqual(result.turns.map(turn => turn.actor), expectedQueue(f.game, f.owner, mode));
  if (mode === 'last') assert.equal(result.turns.at(-1)!.actor, f.owner);
  return result;
}

for (const advanced of [false, true]) for (const mode of ['first', 'last'] as const) {
  void test(`${advanced ? 'Advanced' : 'Basic'} Sapho ${mode} waits behind a genuinely paid current turn and finishes the native queue`, () => {
    const f = fixture({ advanced }); source(f);
    const game = ordered(f, mode), result = complete(f, game, mode);
    if (advanced) {
      assert.equal(f.timing.length, 1); assert.equal(f.timing[0].step.action.take, false);
      assert.ok(result.timing.every(timing => timing.step.action.take === false));
    } else assert.equal(result.timing.length, 0);
  });
}

void test('queued Sapho first leaves an unspent Advanced Guild its actual next-boundary TAKE before the waiting holder', () => {
  const f = fixture({ advanced: true }); source(f);
  const game = ordered(f, 'first'), result = complete(f, game, 'first', true);
  assert.equal(result.timing[0].step.action.take, true);
  assert.equal(result.timing[0].declared.response?.kind, 'guildTiming');
  assert.equal(result.timing[0].after.active, f.guild);
  assert.deepEqual(result.turns.map(turn => turn.actor), [f.current, f.guild, f.owner, 'atreides']);
  assert.ok(result.actions.some(step => step.action.type === 'passResponse'));
  const guild = result.turns.find(turn => turn.actor === f.guild)!; assert.ok(guild.shipment);
  assert.equal(player(guild.before, f.guild).spice - player(guild.afterShipment, f.guild).spice, 1);
});

void test('a genuinely taken and paid Advanced Guild turn stays whole while Sapho first changes only its waiting tail', () => {
  const f = fixture({ advanced: true, guildTake: true }); source(f);
  assert.equal(f.current, f.guild); assert.equal(f.game.guildTimingGranted, true);
  assert.equal(f.timing[0].declared.response?.kind, 'guildTiming');
  const result = complete(f, ordered(f, 'first'), 'first');
  assert.deepEqual(result.turns.map(turn => turn.actor), [f.guild, f.owner, 'richese', 'atreides']);
  assert.equal(result.turns[0].shipment, null);
});

for (const advanced of [false, true]) {
  const label = advanced ? 'Advanced' : 'Basic';
  void test(`${label} queued Sapho event expires when the actual current turn ends with the physical card retained`, () => {
    const f = fixture({ advanced }), proposed = action(f.game, 'first');
    let game = act(structuredClone(f.game), f.current, { type: 'endMovement' });
    game = advance(game, clean);
    assert.notEqual(game.active, f.current);
    assert.notEqual(queuedOption(game, f.owner, 'first').event, proposed.event);
    reject(game, f.owner, proposed);
    assert.ok(player(game, f.owner).hand.some(card => card.id === f.card));
    assert.deepEqual(inventory(game), f.originalInventory);
  });

  if (advanced) void test(`${label} an actual active Sapho holder may pause its own paid combined turn for last`, () => {
    const f = fixture({ advanced });
    let game = advance(structuredClone(f.game), state => clean(state) && state.active === f.owner);
    const proposed = action(game, 'last');
    game = act(game, f.owner, { type: 'ship', territory: 'polar_sink', sector: 0, amount: 1, elite: 0, allyPayment: 0 });
    game = advance(game, clean);
    assert.equal(game.active, f.owner); assert.equal(player(game, f.owner).shipped, true);
    reject(game, f.owner, proposed);
    const option = viewGame(game, f.owner).saphoOptions.find(option => option.scope === 'movement' && option.mode === 'last');
    assert.ok(option && option.scope === 'movement' && option.resumeOwn);
    const before = structuredClone(player(game, f.owner));
    game = act(game, f.owner, { type: 'card', card: f.card, scope: 'movement', mode: 'last', event: option.event });
    assert.deepEqual(game.movementRemaining?.at(-1), f.owner);
    assert.equal(player(game, f.owner).shipped, before.shipped);
    assert.equal(player(game, f.owner).reserves, before.reserves);
    assert.equal(player(game, f.owner).spice, before.spice);
    assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
  });
}

void test('already first and last waiting positions cannot spend Sapho through no-op or projected-only action fields', () => {
  const f = fixture();
  let first = act(structuredClone(f.game), f.current, { type: 'endMovement' });
  first = advance(first, clean); assert.equal(first.active, 'atreides');
  first = act(first, 'atreides', { type: 'ship', territory: 'polar_sink', sector: 0, amount: 1, elite: 0, allyPayment: 0 });
  first = advance(first, clean);
  const lastOption = queuedOption(first, f.owner, 'last');
  assert.equal(viewGame(first, f.owner).saphoOptions.some(option => option.scope === 'movement' && option.mode === 'first'), false);
  reject(first, f.owner, { type: 'card', card: f.card, scope: 'movement', mode: 'first', event: lastOption.event });
  const g = fixture({ advanced: true, guildTake: true }), firstOption = queuedOption(g.game, g.owner, 'first');
  assert.equal(viewGame(g.game, g.owner).saphoOptions.some(option => option.scope === 'movement' && option.mode === 'last'), false);
  reject(g.game, g.owner, { type: 'card', card: g.card, scope: 'movement', mode: 'last', event: firstOption.event });
  reject(f.game, f.owner, { ...action(f.game, 'first'), afterCurrent: f.current });
  assert.ok(player(f.game, f.owner).hand.some(card => card.id === f.card));
});

void test('all four minimal profiles use actual projected queued Sapho choices without sending afterCurrent', () => {
  for (const advanced of [false, true]) {
    const f = fixture({ advanced });
    for (const difficulty of DIFFICULTIES) {
      const own = viewGame(f.game, f.owner); own.players.find(p => p.id === f.owner)!.bot = difficulty;
      const proposed = botActions(own).find(proposed => proposed.type === 'card' && proposed.card === f.card && proposed.scope === 'movement');
      assert.ok(proposed, `${difficulty} answers the real queued opportunity`);
      assert.equal('afterCurrent' in proposed, false);
      const option = own.saphoOptions.find(option => option.event === proposed.event && option.mode === proposed.mode);
      assert.ok(option); assert.equal((option as typeof option & { afterCurrent?: string }).afterCurrent, f.current);
      const game = act(structuredClone(f.game), f.owner, proposed);
      assert.equal(game.active, f.current); assert.deepEqual(resources(game), resources(f.game));
      assert.deepEqual(inventory(game), f.originalInventory);
      assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
    }
  }
});

for (const claim of [false, true]) void test(
  `labelled conserved-custody Homeworld supplement: Semuta ${claim ? 'claim' : 'pass'} resumes queued LAST behind an actual paid current shipment`, () => {
    const f = createSaphoStartedSemutaFixture(true), before = resources(f.game), queue = expectedQueue(f.game, f.owner, 'last');
    assert.equal(f.nativeAcquisition, false); assert.ok(f.staging.some(line => line.includes('CONTROLLED')));
    assert.equal(queuedOption(f.game, f.owner, 'last').afterCurrent, f.current);
    const offered = act(structuredClone(f.game), f.owner, f.action);
    assert.ok(offered.pendingTreacheryDiscard); assert.equal(offered.active, f.current);
    assert.deepEqual(offered.movementRemaining, queue); assert.deepEqual(resources(offered), before);
    assert.equal(viewGame(offered, f.holder).semutaReaction?.canCommit, true);
    reject(offered, f.current, { type: 'endMovement' });
    const event = offered.pendingTreacheryDiscard.batch.event;
    const resumed = reactSemutaHomeworldChoam(offered, f.holder, claim);
    assert.ok(!resumed.pendingTreacheryDiscard); assert.equal(resumed.active, f.current);
    assert.deepEqual(resumed.movementRemaining, queue); assert.deepEqual(resources(resumed), before);
    assert.deepEqual(inventory(resumed), f.originalInventory);
    assert.equal(player(resumed, f.holder).hand.filter(card => card.id === f.card).length, Number(claim));
    assert.equal(resumed.discard.filter(card => card.id === SEMUTA_DRUG_ID).length, Number(claim));
    assert.deepEqual(resumed.saphoMovementLast, { event: `movement:${resumed.turn}`, turn: resumed.turn, player: f.owner });
    reject(resumed, f.holder, { type: 'semutaCommit', event });
    const actions: { actor: string; action: Action }[] = [];
    const done = advanceSemutaHomeworldChoam(resumed, state => state.phase > 5 && clean(state), actions);
    assert.equal(actions.some(step => step.actor === f.current && step.action.type === 'ship'), false);
    assert.equal(actions.filter(step => step.actor === f.current && step.action.type === 'endMovement').length, 1);
    assert.equal(player(done, f.current).forces['polar_sink:0'], 1);
    assert.deepEqual(inventory(done), f.originalInventory);
  },
);
