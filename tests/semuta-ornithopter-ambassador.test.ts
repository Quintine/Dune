import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createSemutaOrnithopterAmbassadorFixture as fixture,
  actSemutaOrnithopterAmbassador as act,
  semutaOrnithopterAmbassadorPlayer as player,
  semutaOrnithopterAmbassadorInventory as inventory,
  passSemutaOrnithopterAmbassador as pass,
  claimSemutaOrnithopterAmbassador as claim,
  openSemutaOrnithopterAmbassadorGrant as grant,
  type SemutaOrnithopterAmbassadorFixture,
} from './fixture-semuta-ornithopter-ambassador';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action));
  assert.deepEqual(game, before);
}
function movement(game: Game, f: SemutaOrnithopterAmbassadorFixture) {
  assert.equal(player(game, f.entrant).moved, f.mode === 'twoGroups' ? 2 : 1);
  assert.equal(player(game, f.entrant).ornithopterExtraMoves ?? 0, f.mode === 'twoGroups' ? 1 : 0);
  assert.equal(player(game, f.entrant).forces[f.location], 1);
  assert.equal(player(game, f.entrant).forces['habbanya_ridge_flat:17'] ?? 0, 0);
  assert.equal(player(game, f.entrant).forces['habbanya_ridge_flat:18'] ?? 0, f.mode === 'twoGroups' ? 1 : 0);
  assert.equal(game.active, f.entrant); assert.equal(game.ornithopter, null);
  assert.equal(player(game, f.entrant).spice, player(f.game, f.entrant).spice);
  assert.deepEqual(inventory(game), f.originalInventory);
}

for (const mode of ['range3', 'twoGroups'] as const)
  for (const effect of ['choam', 'ixians'] as const)
    for (const firstClaim of [false, true]) void test(
      `native Basic ${mode} retires Ornithopter before ${effect} with ${firstClaim ? 'flight' : 'grant'} recovery`, () => {
        const f = fixture({ mode, effect }), source = structuredClone(f.game);
        const pending = act(source, f.entrant, f.move), first = pending.pendingTreacheryDiscard;
        assert.equal(first?.reaction?.stage, 'offer');
        assert.equal(first.continuation.kind, 'ornithopterDiscard');
        assert.equal(first.batch.cause, 'ornithopter:move');
        assert.deepEqual(first.batch.entries.map(entry => entry.card.id), [f.ornithopter]);
        assert.ok(!pending.pendingAmbassador, 'The original arrival waits for card disposal');
        movement(pending, f); assert.deepEqual(source, f.game);
        let game = firstClaim ? claim(pending, f.claimant, f.ornithopter) : pass(pending);
        assert.equal(game.pendingTreacheryDiscard, null);
        assert.equal(game.pendingAmbassador?.stage, 'offer');
        assert.equal(game.pendingAmbassador.arrivalCause, 'movement');
        movement(game, f);
        rejected(game, f.claimant, { type: 'semutaCommit', event: first.batch.event });
        game = grant(game, f);
        const event = game.pendingAmbassador!.event;
        const cards = player(game, f.beneficiary).hand.slice(0, effect === 'choam' ? 2 : 1).map(card => card.id);
        const beforeIncome = player(game, f.beneficiary).spice;
        const beforeDeck = structuredClone(game.deck), replacement = game.deck[0]; assert.ok(replacement);
        const native = act(game, f.beneficiary, { type: 'decision', event, cards });
        const next = native.pendingTreacheryDiscard;
        assert.equal(next?.reaction?.stage, 'offer'); assert.equal(next.continuation.kind, 'ambassador');
        assert.notEqual(next.batch.event, first.batch.event);
        assert.equal(next.batch.cause, `ambassador:${effect}`);
        assert.deepEqual(next.batch.entries.map(entry => entry.card.id), cards);
        assert.ok(next.batch.entries.every(entry => !entry.publicFace));
        assert.equal(player(native, f.beneficiary).spice, beforeIncome + (effect === 'choam' ? cards.length * 3 : 0));
        assert.deepEqual(native.deck, beforeDeck, 'The replacement draw waits for this second fresh group');
        for (const p of native.players) assert.deepEqual(viewGame(native, p.id).semutaReaction!.candidates, []);
        assert.equal(viewGame(native, f.claimant).semutaReaction!.canCommit, !firstClaim);
        rejected(native, f.claimant, { type: 'semutaCommit', event: first.batch.event });
        game = firstClaim ? pass(native) : claim(native, f.claimant, cards[0]);
        assert.equal(game.pendingTreacheryDiscard, null); assert.equal(game.pendingAmbassador, null);
        assert.equal(player(game, f.beneficiary).spice, beforeIncome + (effect === 'choam' ? cards.length * 3 : 0));
        assert.equal(player(game, f.claimant).hand.some(card => card.id === f.ornithopter), firstClaim);
        assert.equal(player(game, f.claimant).hand.some(card => card.id === cards[0]), !firstClaim);
        assert.equal(game.discard.filter(card => card.id === f.semuta).length, 1);
        assert.equal(game.discard.filter(card => card.id === f.ornithopter).length, Number(!firstClaim));
        if (effect === 'ixians') {
          assert.ok(player(game, f.beneficiary).hand.some(card => card.id === replacement.id));
          assert.deepEqual(game.deck, beforeDeck.slice(1));
        } else assert.deepEqual(game.deck, beforeDeck);
        movement(game, f);
        game = act(game, f.entrant, f.endMovement);
        assert.ok(!game.movementRemaining?.includes(f.entrant));
        assert.deepEqual(inventory(game), f.originalInventory);
      });

for (const mode of ['range3', 'twoGroups'] as const) void test(
  `native Basic ${mode} with an empty CHOAM grant creates no second discard or payout`, () => {
    const f = fixture({ mode, effect: 'choam' });
    let game = pass(act(f.game, f.entrant, f.move));
    game = grant(game, f);
    const spice = player(game, f.beneficiary).spice, deck = structuredClone(game.deck);
    game = act(game, f.beneficiary, { type: 'decision', event: game.pendingAmbassador!.event, cards: [] });
    assert.ok(!game.pendingTreacheryDiscard); assert.equal(game.pendingAmbassador, null);
    assert.equal(player(game, f.beneficiary).spice, spice); assert.deepEqual(game.deck, deck);
    assert.ok(player(game, f.claimant).hand.some(card => card.id === f.semuta));
    movement(game, f);
  });

void test('an actual BG-copy Ixian Ambassador follows the retired two-group card into one original replacement draw', () => {
  const f = fixture({ mode: 'twoGroups', effect: 'ixians', copied: true });
  let game = pass(act(f.game, f.entrant, f.move)); game = grant(game, f);
  const chosen = player(game, f.beneficiary).hand[0].id, deck = structuredClone(game.deck);
  game = act(game, f.beneficiary, { type: 'decision', event: game.pendingAmbassador!.event, cards: [chosen] });
  assert.equal(game.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  game = claim(game, f.claimant, chosen);
  assert.ok(player(game, f.beneficiary).hand.some(card => card.id === deck[0].id));
  assert.deepEqual(game.deck, deck.slice(1));
  assert.equal(game.ecazAmbassadors!.tokens.find(token => token.id === f.token)!.zone, 'removed');
  movement(game, f);
});

void test('all existing profiles legally answer both native fresh groups without replaying the completed flight', () => {
  const f = fixture({ effect: 'choam', mode: 'twoGroups', copied: true });
  for (const difficulty of DIFFICULTIES) {
    let game = act(f.game, f.entrant, f.move);
    const finish = (source: Game) => {
      let current = source;
      for (let count = 0; current.pendingTreacheryDiscard && count < 16; count++) {
        const reaction = current.pendingTreacheryDiscard.reaction!;
        const actor = reaction.stage === 'select' ? reaction.player
          : current.players.find(p => !reaction.passed.includes(p.id))!.id;
        const view = viewGame(current, actor); view.players.find(p => p.id === actor)!.bot = difficulty;
        const action = botActions(view)[0]; assert.ok(action);
        current = act(current, actor, action);
      }
      assert.equal(current.pendingTreacheryDiscard, null); return current;
    };
    game = finish(game); game = grant(game, f);
    const cards = player(game, f.beneficiary).hand.slice(0, 2).map(card => card.id);
    const spice = player(game, f.beneficiary).spice;
    game = act(game, f.beneficiary, { type: 'decision', event: game.pendingAmbassador!.event, cards });
    game = finish(game);
    assert.equal(player(game, f.beneficiary).spice, spice + 6);
    assert.equal(game.pendingAmbassador, null); movement(game, f);
  }
});
