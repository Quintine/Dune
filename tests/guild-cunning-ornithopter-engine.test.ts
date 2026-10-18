import assert from 'node:assert/strict';
import { test } from 'node:test';
import { viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { nexusGuildCunningAction, nexusGuildMovementAvailable, nexusGuildShipmentAvailable } from '../game/nexus-guild-cunning-options';
import {
  actGuildCunningOrnithopter, advanceGuildCunningOrnithopter, completeGuildCunningOrnithopter, createGuildCunningOrnithopterFixture,
  guildCunningOrnithopterClean,
  guildCunningOrnithopterMove, guildCunningOrnithopterPlayer as player, type GuildCunningOrnithopterFixture,
} from './fixture-guild-cunning-ornithopter';

const own = (game: Game) => viewGame(game, 'guild').players.find(player => player.id === 'guild')!;
const record = (game: Game) => game.nexusGuildCunningHistory!.at(-1)!;
function source(f: GuildCunningOrnithopterFixture) {
  assert.ok(f.actions.some(step => step.action.type === 'moduleOption' && step.action.module === 'nexusCards' && step.action.enabled));
  assert.ok(f.actions.some(step => step.actor === f.owner && step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.ok(f.actions.some(step => step.actor === f.owner && step.action.type === 'bid' && step.action.amount === 1));
  assert.ok(player(f.acquired).hand.some(card => card.id === f.card));
  assert.ok(player(f.acquired).hand.some(card => card.id === f.hajr));
  assert.equal(f.beforeNexusDraw.nexusCards!.cards!.hands.guild, null);
  assert.equal(f.beforeNexusDraw.nexusCards!.cards!.deck[0], 'guild');
  assert.equal(f.afterNexusDraw.nexusCards!.cards!.hands.guild, 'guild');
  assert.equal(player(f.afterNexusDraw).ally ?? null, null);
  assert.equal(player(f.afterNexusDraw, 'richese').ally, 'emperor');
  assert.equal(player(f.afterNexusDraw, 'emperor').ally, 'richese');
  assert.equal(player(f.beforeFirstShipment).spice - player(f.afterFirstShipment).spice, 2);
  assert.equal(player(f.beforeFirstShipment).reserves - player(f.afterFirstShipment).reserves, 2);
  assert.equal(player(f.game).forces[f.source], 2);
  assert.equal(player(f.game).moved, 0);
  assert.equal(player(f.game).shipped, true);
  assert.ok(player(f.game).spice >= 1, 'The original Guild retains funds for the positive second shipment');
  assert.equal(f.sourceActionCount, f.actions.length);
}
function settled(f: GuildCunningOrnithopterFixture, result: ReturnType<typeof completeGuildCunningOrnithopter>, count: number) {
  assert.equal(player(result.completed).moved, count);
  assert.equal(player(result.completed).shipped, true);
  assert.equal(player(result.completed).hajrPlays, 1);
  assert.equal(result.completed.discard.filter(card => card.id === f.hajr).length, 1);
  assert.equal(result.game.discard.filter(card => card.id === f.card).length, 1);
  assert.equal(result.game.ornithopter ?? null, null);
  assert.equal(result.game.nexusCards!.cards!.hands.guild, null);
  assert.equal(result.game.nexusCards!.cards!.discard.filter(card => card === 'guild').length, 1);
  assert.equal(player(result.beforeSecondShipment).spice - player(result.afterSecondShipment).spice, 1);
  assert.equal(player(result.beforeSecondShipment).reserves - player(result.afterSecondShipment).reserves, 1);
  assert.equal(player(result.completed).spice, player(result.afterSecondShipment).spice);
  assert.equal(record(result.game).stage, 'completed');
  assert.equal(record(result.game).shipment!.kind, 'reserve');
  assert.equal(record(result.game).shipment!.stage, 'complete');
  assert.equal(result.actions.at(-1)!.action.type, 'endMovement');
}

void test('genuine Basic Guild Cunning permits both paid physical Ornithopter modes only through its unused Hajr move', () => {
  const f = createGuildCunningOrnithopterFixture();
  source(f);
  for (const mode of ['range3', 'twoGroups'] as const) {
    const result = completeGuildCunningOrnithopter(f, { mode });
    assert.equal(player(result.beforeCunning).moved, 1);
    assert.equal(player(result.beforeCunning).hajrPlays, 1);
    assert.equal(result.declaration.nexus, viewGame(result.beforeCunning, f.owner).nexusGuildCunning!.offer!.event);
    const receipt = record(result.allowed).receipt;
    assert.equal(receipt.version, 3);
    if (receipt.version === 3) assert.deepEqual(receipt.before,
      { shipped: true, moved: 1, hajrPlays: 1, ornithopterExtraMoves: 0 });
    assert.equal(record(result.allowed).stage, 'secondShipment');
    assert.equal(nexusGuildMovementAvailable(viewGame(result.allowed, f.owner)), false);
    assert.equal(nexusGuildShipmentAvailable(viewGame(result.allowed, f.owner)), true);
    assert.equal(nexusGuildMovementAvailable(viewGame(result.afterSecondShipment, f.owner)), true);
    assert.equal(viewGame(result.afterSecondShipment, f.owner).ornithopter!.blocked, null);
    assert.equal(result.moves[1].step.action.from, result.secondSource,
      'The genuine newly shipped counter can take the Hajr-backed card flight');
    if (mode === 'twoGroups') {
      assert.equal(player(result.firstFlightGroup).moved, 2);
      assert.equal(own(result.firstFlightGroup).movesAllowed, 3);
      assert.equal(viewGame(result.firstFlightGroup, f.owner).ornithopter!.active!.remaining, 1);
      assert.equal(nexusGuildMovementAvailable(viewGame(result.firstFlightGroup, f.owner)), true);
      const repeat = guildCunningOrnithopterMove(result.firstFlightGroup, result.firstFlightDestination);
      assert.throws(() => actGuildCunningOrnithopter(result.firstFlightGroup, f.owner, repeat), /cohort|unmoved|original|force/i);
      assert.equal(player(result.completed).ornithopterExtraMoves, 1);
      assert.equal(record(result.completed).movesAfter, 2);
    } else assert.equal(record(result.completed).movesAfter, 1);
    settled(f, result, mode === 'twoGroups' ? 3 : 2);
  }
});

void test('genuine Advanced Guild earns Hajr after its actual move before Cunning and either physical card mode', () => {
  const f = createGuildCunningOrnithopterFixture({ advanced: true });
  source(f);
  for (const mode of ['range3', 'twoGroups'] as const) {
    const result = completeGuildCunningOrnithopter(f, { mode });
    const movement = result.moves[0];
    assert.equal(own(movement.before).hajrPlays, 0);
    assert.equal(own(movement.after).hajrAvailable, true);
    assert.equal(own(result.beforeCunning).hajrPlays, 1);
    assert.equal(own(result.afterSecondShipment).hajrAvailable, false);
    assert.equal(nexusGuildMovementAvailable(viewGame(result.afterSecondShipment, f.owner)), true);
    settled(f, result, mode === 'twoGroups' ? 3 : 2);
  }
});

void test('genuine completed two-group flight before Cunning preserves its earned credit and one unused Hajr move', () => {
  for (const advanced of [false, true]) {
    const f = createGuildCunningOrnithopterFixture({ advanced });
    const result = completeGuildCunningOrnithopter(f, { position: 'before' });
    assert.equal(result.beforeCunning.ornithopter ?? null, null);
    assert.equal(player(result.beforeCunning).moved, 2);
    assert.equal(player(result.beforeCunning).ornithopterExtraMoves, 1);
    const receipt = record(result.allowed).receipt;
    assert.equal(receipt.version, 3);
    if (receipt.version === 3) assert.deepEqual(receipt.before,
      { shipped: true, moved: 2, hajrPlays: 1, ornithopterExtraMoves: 1 });
    assert.equal(viewGame(result.afterSecondShipment, f.owner).nexusGuildCunning!.active!.movesLeft, 1);
    assert.equal(result.moves.at(-1)!.kind, 'post-cunning-hajr');
    assert.equal(result.moves.at(-1)!.step.action.movementCard, undefined);
    assert.equal(result.moves.at(-1)!.step.action.ornithopterEvent, undefined);
    assert.equal(record(result.completed).movesAfter, 1);
    settled(f, result, 3);
  }
});

void test('genuine partial flights end before or after Cunning without earning an abandoned second-group credit', () => {
  const f = createGuildCunningOrnithopterFixture();
  for (const early of ['beforeCunning', 'afterCunning'] as const) {
    const result = completeGuildCunningOrnithopter(f, { early });
    assert.equal(result.firstFlightGroup.ornithopter!.completed, 1);
    assert.equal(result.firstFlightGroup.ornithopter!.mode, 'twoGroups');
    assert.equal(result.finishedFlight, null);
    assert.equal(player(result.game).ornithopterExtraMoves ?? 0, 0);
    assert.equal(result.moves.length, 2);
    if (early === 'beforeCunning') {
      assert.equal(result.beforeCunning.ornithopter!.completed, 1);
      assert.equal(result.allowed.ornithopter ?? null, null);
      const receipt = record(result.allowed).receipt;
      if (receipt.version === 3) assert.equal(receipt.before.ornithopterExtraMoves, 0);
      assert.equal(result.moves.at(-1)!.kind, 'post-cunning-hajr');
    } else assert.equal(result.completed.ornithopter!.completed, 1);
    settled(f, result, 2);
  }
});

void test('all four minimal policies retain legal Hajr-backed card groups during original Guild Cunning', () => {
  const f = createGuildCunningOrnithopterFixture();
  const result = completeGuildCunningOrnithopter(f);
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    for (const game of [result.afterSecondShipment, result.firstFlightGroup]) {
      const view = viewGame(game, f.owner);
      view.players.find(player => player.id === f.owner)!.bot = difficulty;
      const action = botActions(view).find(action => action.type === 'move' &&
        (game.ornithopter ? action.ornithopterEvent === view.ornithopter!.active!.event : action.movementCard === f.card));
      assert.ok(action, `${difficulty} retains a legal physical-card continuation inside the native Cunning grant`);
      const next = actGuildCunningOrnithopter(structuredClone(game), f.owner, action);
      assert.ok(player(next).moved === player(game).moved + 1 || next.response || next.decision);
    }
  }
});

void test('the genuine held physical card cannot restore ordinary movement or a Hajr grant already spent before Cunning', () => {
  const f = createGuildCunningOrnithopterFixture();
  const sample = completeGuildCunningOrnithopter(f);
  for (const spentHajr of [false, true]) {
    let game = structuredClone(f.game);
    const act = (action: Parameters<typeof actGuildCunningOrnithopter>[2]) => {
      game = actGuildCunningOrnithopter(game, f.owner, action);
      game = advanceGuildCunningOrnithopter(game, guildCunningOrnithopterClean);
    };
    if (spentHajr) act({type:'card',card:f.hajr});
    act(guildCunningOrnithopterMove(game, f.source));
    if (spentHajr) act(guildCunningOrnithopterMove(game, f.source));
    const offer = viewGame(game,f.owner).nexusGuildCunning!.offer!;
    const declare = nexusGuildCunningAction(viewGame(game,f.owner), offer.event); assert.ok(declare);
    act(declare);
    act(sample.secondShipment.action);
    assert.equal(own(game).movesAllowed, player(game).moved);
    assert.equal(nexusGuildMovementAvailable(viewGame(game,f.owner)), false);
    assert.match(viewGame(game,f.owner).ornithopter!.blocked!, /unused ordinary or Hajr/);
    const illegal = guildCunningOrnithopterMove(game, sample.secondSource, {mode:'range3',range:3});
    const before = structuredClone(game);
    assert.throws(() => actGuildCunningOrnithopter(game,f.owner,illegal), /movement|move/i);
    assert.deepEqual(game,before);
    assert.ok(player(game).hand.some(card => card.id === f.card));
  }
});
