import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import {
  createOriginalSemutaSpecialGuild, createControlledSemutaSpecial,
  reactSemutaSpecial, type ControlledSemutaSpecialKind,
} from './fixture-semuta-special-karama';

const player = (game: Game, actor: string) => game.players.find(p => p.id === actor)!;
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
function exactCost(game: Game, id: string) {
  assert.equal(game.discard.filter(c => c.id === id).length + game.deck.filter(c => c.id === id).length +
    game.players.reduce((sum, p) => sum + p.hand.filter(c => c.id === id).length, 0), 1);
}

for (const homeworlds of [false, true])
  void test(`original ${homeworlds ? 'Homeworld' : 'reserve'} Guild stop waits for cost recovery and then prevents the same unpaid shipment`, () => {
    for (const claim of [false, true]) {
      const f = createOriginalSemutaSpecialGuild(homeworlds);
      let game = applyAction(f.beforeCost, f.owner, f.action);
      assert.equal(game.pendingTreacheryDiscard?.batch.cause,
        homeworlds ? 'specialKarama:guildHomeworld' : 'specialKarama:guild');
      assert.equal(player(game, f.shipper).shipped, false);
      assert.equal(player(game, f.shipper).spice, 9);
      assert.equal(player(game, f.shipper).reserves, 10);
      assert.equal(player(game, f.owner).specialKaramaUsed, undefined);
      reject(game, f.shipper, { type: 'endMovement' });
      game = reactSemutaSpecial(game, f.holder, claim);
      assert.equal(player(game, f.shipper).shipped, true);
      assert.equal(player(game, f.shipper).spice, 9);
      assert.equal(player(game, f.shipper).reserves, 10);
      assert.equal(player(game, f.shipper).moved, 0);
      assert.equal(player(game, f.owner).specialKaramaUsed, true);
      assert.equal(player(game, f.holder).hand.some(c => c.id === f.karama), claim);
      assert.equal(game.discard.filter(c => c.id === f.semuta).length, claim ? 1 : 0);
      if (homeworlds) assert.equal(game.homeworlds!.custody!.visitors[f.target]?.[f.shipper], undefined);
      else assert.equal(player(game, f.shipper).forces[f.target] ?? 0, 0);
      exactCost(game, f.karama);
      reject(game, f.owner, f.action);
      game = applyAction(game, f.shipper, { type: 'endMovement' });
      assert.notEqual(game.active, f.shipper);
    }
  });

for (const kind of ['emperorForces', 'emperorLeader', 'choam', 'richese', 'ixians',
  'tleilaxu', 'fremen', 'atreides', 'harkonnen'] as ControlledSemutaSpecialKind[])
  void test(`controlled native ${kind} preserves its own cost/effect order across Semuta claim or decline`, () => {
    for (const claim of [false, true]) {
      const f = createControlledSemutaSpecial(kind);
      const before = structuredClone(f.beforeCost);
      let game = applyAction(f.beforeCost, f.owner, f.action);
      assert.equal(game.pendingTreacheryDiscard?.batch.cause, `specialKarama:${kind}`);
      if (kind === 'emperorForces') {
        assert.equal(player(game, f.owner).reserves, 19);
        assert.equal(player(game, f.owner).tanks, 1);
        assert.equal(player(game, f.owner).specialKaramaUsed, true);
      } else if (kind === 'emperorLeader') {
        assert.equal(player(game, f.owner).leaders[0].dead, false);
        assert.equal(player(game, f.owner).specialKaramaUsed, true);
      } else {
        assert.equal(player(game, f.owner).specialKaramaUsed, undefined);
        assert.equal(player(game, f.owner).spice, player(before, f.owner).spice);
        assert.equal(player(game, f.owner).reserves, player(before, f.owner).reserves);
      }
      if (kind === 'richese') {
        assert.ok(game.richeseCache!.some(c => c.id === f.acquired));
        assert.equal(player(game, f.owner).hand.some(c => c.id === f.acquired), false);
      }
      if (kind === 'fremen') assert.equal(player(game, f.holder).tanks, 0);
      game = reactSemutaSpecial(game, f.holder, claim);
      if (kind === 'choam') {
        assert.equal(player(game, f.owner).spice, 26);
        assert.equal(game.pendingTreacheryDiscard?.batch.cause, 'specialKarama:choamCashout');
        game = reactSemutaSpecial(game, f.holder, !claim, !claim ? f.selected[0] : undefined);
        assert.equal(player(game, f.owner).spice, 26);
        if (!claim) assert.ok(player(game, f.holder).hand.some(c => c.id === f.selected[0]));
      } else if (kind === 'emperorForces') {
        assert.equal(player(game, f.owner).reserves, 19);
        assert.equal(player(game, f.owner).tanks, 1);
        assert.equal(player(game, f.owner).elites!.revived, 0);
      } else if (kind === 'emperorLeader') {
        assert.equal(player(game, f.owner).leaders[0].dead, false);
      } else if (kind === 'richese') {
        assert.equal(player(game, f.owner).spice, 17);
        assert.equal(player(game, f.owner).hand.filter(c => c.id === f.acquired).length, 1);
        assert.equal(game.richeseCache!.some(c => c.id === f.acquired), false);
      } else if (kind === 'ixians') {
        assert.equal(game.mobileStronghold!.location, (f.action.route as string[]).at(-1));
        assert.equal(player(game, f.owner).reserves, 19);
        assert.equal(player(game, f.owner).moved, 0);
      } else if (kind === 'tleilaxu') {
        assert.equal(game.revivalPrevention!.player, f.holder);
        assert.equal(player(game, f.holder).tanks, 2);
        assert.equal(player(game, f.holder).reserves, 18);
        reject(game, f.holder, { type: 'revive', amount: 2, elite: 0 });
      } else if (kind === 'fremen') {
        assert.equal(player(game, f.holder).tanks, 2);
        assert.equal(player(game, f.holder).forces[f.target!] ?? 0, 0);
        assert.equal(player(game, f.owner).shipped, false);
      } else if (kind === 'atreides') {
        assert.deepEqual(game.battle!.fullPlan, { owner: f.owner, target: f.holder });
        assert.equal(player(game, f.owner).forces['arrakeen:10'], 2);
        assert.equal(player(game, f.holder).forces['arrakeen:10'], 2);
      } else {
        assert.equal(game.decision?.kind, 'handExchange');
        assert.equal(player(game, f.owner).hand.length, 2);
        const returned = f.selected[0];
        game = applyAction(game, f.owner, { type: 'decision', returnCards: [returned] });
        assert.equal(player(game, f.owner).hand.length, 1);
        assert.equal(player(game, f.holder).hand.length, 2);
      }
      assert.equal(player(game, f.owner).specialKaramaUsed, true);
      exactCost(game, f.karama);
      reject(game, f.owner, f.action);
    }
  });

void test('CHOAM cashout is a separate private simultaneous batch with one earned credit and only fresh selectable cards', () => {
  const f = createControlledSemutaSpecial('choam');
  let game = reactSemutaSpecial(applyAction(f.beforeCost, f.owner, f.action), f.holder, false);
  assert.equal(player(game, f.owner).spice, 26);
  const event = game.pendingTreacheryDiscard!.batch.event;
  for (const seat of game.players)
    assert.deepEqual(viewGame(game, seat.id).semutaReaction!.candidates, []);
  game = applyAction(game, f.holder, { type: 'semutaCommit', event });
  assert.deepEqual(new Set(viewGame(game, f.holder).semutaReaction!.candidates.map(c => c.id)), new Set(f.selected));
  reject(game, f.holder, { type: 'semutaSelect', event, card: f.karama });
  const chosen = f.selected[1];
  game = applyAction(game, f.holder, { type: 'semutaSelect', event, card: chosen });
  assert.equal(player(game, f.owner).spice, 26);
  assert.ok(player(game, f.holder).hand.some(c => c.id === chosen));
  assert.ok(game.discard.some(c => c.id === f.selected[0]));
  assert.equal(game.discard.filter(c => c.id === f.karama).length, 1);
  assert.equal(game.discard.filter(c => c.id === f.semuta).length, 1);
});

void test('a malformed saved native intent cannot spend a second effect or reward through a fresh-card claim', () => {
  const f = createOriginalSemutaSpecialGuild();
  const game = applyAction(f.beforeCost, f.owner, f.action);
  const event = game.pendingTreacheryDiscard!.batch.event;
  reject(game, f.owner, { type: 'semutaCommit', event });
  const changed = structuredClone(game);
  const continuation = changed.pendingTreacheryDiscard!.continuation;
  assert.ok(continuation?.kind === 'specialKaramaDiscard');
  continuation.intent.turn++;
  reject(changed, f.holder, { type: 'semutaCommit', event });
  const done = reactSemutaSpecial(game, f.holder, true);
  assert.equal(player(done, f.shipper).spice, 9);
  assert.equal(player(done, f.shipper).shipped, true);
});
