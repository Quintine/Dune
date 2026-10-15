import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, type Action, type Game } from '../game/engine';
import {
  createSemutaGuildTransport, reactSemutaGuildTransport, type SemutaGuildRoute,
} from './fixture-semuta-guild-transport';

const player = (game: Game) => game.players.find(p => p.id === 'g')!;
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
function costCustody(game: Game, f: ReturnType<typeof createSemutaGuildTransport>, claim: boolean) {
  assert.equal(player(game).hand.some(card => card.id === f.karama), claim);
  assert.equal(player(game).hand.some(card => card.id === f.semuta), !claim);
  assert.equal(game.discard.filter(card => card.id === f.karama).length, claim ? 0 : 1);
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, claim ? 1 : 0);
}
function unpaid(game: Game, before: Game) {
  assert.equal(player(game).spice, player(before).spice);
  assert.equal(player(game).reserves, player(before).reserves);
  assert.deepEqual(player(game).forces, player(before).forces);
  assert.deepEqual(game.homeworlds, before.homeworlds);
  assert.equal(player(game).shipped, false);
  assert.equal(player(game).moved, 0);
}

for (const route of ['reserve', 'cross', 'return', 'world', 'homeworldReturn', 'homeworldForeign'] as SemutaGuildRoute[])
  void test(`Semuta claim or decline preserves original native ${route} full-price delivery`, () => {
    for (const claim of [false, true]) {
      const f = createSemutaGuildTransport({ route });
      let game = applyAction(f.beforeCost, f.spender, f.cancel);
      assert.equal(game.pendingTreacheryDiscard?.batch.cause, 'karama:guildRate');
      unpaid(game, f.beforeAction);
      reject(game, f.guild, f.action);
      const event = game.pendingTreacheryDiscard!.batch.event;
      game = reactSemutaGuildTransport(game, claim);
      const p = player(game), original = player(f.beforeAction);
      assert.equal(p.spice, route === 'reserve' || route === 'cross' ? 0 : 2);
      assert.equal(p.shipped, true);
      assert.equal(p.moved, 0);
      assert.equal(p.reserves, original.reserves +
        (route === 'return' || route === 'homeworldReturn' ? 2 :
          route === 'reserve' || route === 'world' ? -2 : 0));
      assert.equal(p.forces[f.source], original.forces[f.source] -
        (route === 'reserve' || route === 'world' ? 0 : 2));
      if (route === 'reserve' || route === 'cross') assert.equal(p.forces[f.target], 2);
      if (route === 'world' || route === 'homeworldForeign')
        assert.deepEqual(game.homeworlds!.custody!.visitors[f.target][f.guild], { normal: 2, elite: 0 });
      costCustody(game, f, claim);
      reject(game, f.holder, { type: 'semutaCommit', event });
      game = applyAction(game, f.guild, { type: 'endMovement' });
      assert.notEqual(game.active, f.guild);
    }
  });

for (const route of ['cross', 'return', 'homeworldReturn', 'homeworldForeign'] as SemutaGuildRoute[])
  void test(`recovering the cost cannot undo native ${route} permission denial or spend the unused shipment`, () => {
    for (const claim of [false, true]) {
      const f = createSemutaGuildTransport({ route, cancel: 'permission' });
      let game = applyAction(f.beforeCost, f.spender, f.cancel);
      assert.equal(game.pendingTreacheryDiscard?.batch.cause, 'karama:guildTransportPermission');
      unpaid(game, f.beforeAction);
      game = reactSemutaGuildTransport(game, claim);
      unpaid(game, f.beforeAction);
      costCustody(game, f, claim);
      reject(game, f.guild, f.action);
      // The original ordinary native alternative is still legal; recovering
      // the denial cost creates neither permission nor another allowance.
      game = applyAction(game, f.guild, { type: 'ship', territory: 'arrakeen', sector: 10,
        amount: 1, elite: 0, allyPayment: 0 });
      if (game.decision?.kind === 'guildShipment')
        game = applyAction(game, f.guild, { type: 'decision', allow: true });
      assert.equal(player(game).spice, 3);
      assert.equal(player(game).reserves, 14);
      assert.equal(player(game).forces['arrakeen:10'], 1);
      assert.equal(player(game).shipped, true);
      costCustody(game, f, claim);
    }
  });

void test('a Semuta-recovered cancellation cost does not finance the unfunded full-price reserve group', () => {
  for (const claim of [false, true]) {
    const f = createSemutaGuildTransport({ poor: true });
    const canceled = applyAction(f.beforeCost, f.spender, f.cancel);
    unpaid(canceled, f.beforeAction);
    let game = reactSemutaGuildTransport(canceled, claim);
    unpaid(game, f.beforeAction);
    assert.equal(player(game).spice, 2);
    assert.equal(game.pendingShipment, null);
    costCustody(game, f, claim);
    game = applyAction(game, f.guild, { type: 'ship', territory: f.destination,
      sector: f.sector, amount: 1, elite: 0, allyPayment: 0 });
    if (game.decision?.kind === 'guildShipment')
      game = applyAction(game, f.guild, { type: 'decision', allow: true });
    assert.equal(player(game).spice, 0);
    assert.equal(player(game).reserves, 14);
    assert.equal(player(game).forces[f.target], 1);
    costCustody(game, f, claim);
  }
});

void test('Basic native rate cancellation uses the same real Semuta acquisition without inventing Advanced interception', () => {
  const f = createSemutaGuildTransport({ advanced: false });
  let game = applyAction(f.beforeCost, f.spender, f.cancel);
  assert.equal(game.pendingTreacheryDiscard?.batch.cause, 'karama:guildRate');
  unpaid(game, f.beforeAction);
  game = reactSemutaGuildTransport(game, true);
  assert.equal(player(game).spice, 0);
  assert.equal(player(game).reserves, 13);
  assert.equal(player(game).forces[f.target], 2);
  assert.equal(player(game).shipped, true);
  costCustody(game, f, true);
});
