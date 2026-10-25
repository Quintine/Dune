import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import {
  createSemutaRicheseGiftKaramaFixture, actSemutaRicheseGiftKarama as act,
  claimSemutaRicheseGiftKarama as claim, passSemutaRicheseGiftKarama as pass,
  finishSemutaRicheseGiftKarama as finish, advanceSemutaRicheseGiftKarama as advance,
  semutaRicheseGiftKaramaClean as clean, semutaRicheseGiftKaramaInventory as inventory,
  semutaRicheseGiftKaramaPlayer as player,
} from './fixture-semuta-richese-gift-karama';

const resources = (game: Game) => ({
  players: game.players.map(player => ({ id: player.id, spice: player.spice,
    reserves: player.reserves, tanks: player.tanks, forces: player.forces, elites: player.elites,
    moved: player.moved, shipped: player.shipped, revived: player.revived, ally: player.ally })),
  order: game.order, active: game.active, ready: game.ready,
  turn: game.turn, phase: game.phase, movementRemaining: game.movementRemaining,
});
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

/** Fork the inherited fixture's actual beforeGift snapshot. Its original paid
 * Semuta1/Distrans1 acquisitions and native alliance are retained; only the
 * final Distrans gift action is replaced by a real Semuta gift declaration.
 * No played hand, resource, clock, parent or pending receipt is installed. */
function source(options: { advanced?: boolean; parent?: 'quiet' | 'emperorIncome' } = {}) {
  const inherited = createSemutaRicheseGiftKaramaFixture(options);
  const prefixLength = inherited.actions.length - inherited.giftDeclaration.steps.length;
  assert.equal(inherited.giftDeclaration.steps.length, 1);
  assert.deepEqual(inherited.actions.slice(prefixLength), inherited.giftDeclaration.steps);
  assert.deepEqual(inherited.giftDeclaration.before, inherited.beforeGift);
  const actions = structuredClone(inherited.actions.slice(0, prefixLength));
  const beforeGift = structuredClone(inherited.beforeGift);
  assert.ok(player(beforeGift, inherited.donor).hand.some(card => card.id === inherited.semuta));
  assert.ok(player(beforeGift, inherited.donor).hand.some(card => card.id === inherited.gift));
  assert.equal(player(beforeGift, inherited.donor).ally, inherited.recipient);
  assert.equal(player(beforeGift, inherited.recipient).ally, inherited.donor);
  assert.ok(viewGame(beforeGift, inherited.donor).richeseGift?.cards.some(card => card.id === inherited.semuta));
  const giftAction: Action = { type: 'richeseGift', card: inherited.semuta };
  const game = act(beforeGift, inherited.donor, giftAction, actions);
  assert.deepEqual(actions.at(-1), { actor: inherited.donor, action: giftAction });
  assert.equal(actions.length, prefixLength + 1);
  assert.equal(game.response?.kind, 'richeseGift');
  assert.equal(game.pendingRicheseGift?.intent.cardId, inherited.semuta);
  assert.deepEqual(game.pendingRicheseGift!.resume, inherited.originalParent);
  assert.deepEqual(inventory(game), inherited.originalInventory);
  return { ...inherited, game, beforeGift, actions, sourceActionCount: actions.length,
    giftAction, selectedGift: inherited.semuta, unusedDistrans: inherited.gift };
}
type Source = ReturnType<typeof source>;

function open(f: Source) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, 'karamaRicheseGiftDiscard');
  assert.equal(pending.reaction?.stage, 'offer');
  assert.deepEqual(pending.batch.entries.map(entry => ({ id: entry.card.id, by: entry.discardedBy, public: entry.publicFace })),
    [{ id: f.cost, by: f.spender, public: true }]);
  assert.equal(game.pendingRicheseGift?.intent.cardId, f.semuta);
  assert.deepEqual(game.pendingRicheseGift!.resume, f.originalParent);
  assert.ok(player(game, f.donor).hand.some(card => card.id === f.semuta));
  assert.ok(player(game, f.donor).hand.some(card => card.id === f.unusedDistrans));
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true,
    'Only this already prevented gift reservation must release the actual Semuta role');
  assert.equal(game.richeseGiftBlocked?.cards.includes(f.semuta) ?? false, false);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.deepEqual(resources(game), resources(f.game));
  assert.deepEqual(inventory(game), f.originalInventory);
  return game;
}
function settled(state: Game, f: Source, claimed: boolean) {
  const game = finish(state);
  assert.ok(!game.pendingTreacheryDiscard); assert.ok(!game.pendingRicheseGift);
  assert.deepEqual(resources(game), resources(f.game));
  assert.deepEqual(inventory(game), f.originalInventory);
  assert.equal(player(game, f.recipient).hand.some(card => card.id === f.semuta), false);
  assert.equal(player(game, f.donor).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.donor).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.donor).hand.filter(card => card.id === f.unusedDistrans).length, 1);
  assert.equal(player(game, f.recipient).hand.some(card => card.id === f.unusedDistrans), false);
  assert.deepEqual(game.richeseGiftBlocked, { turn: f.game.turn, phase: f.game.phase, cards: [f.semuta] });
  assert.deepEqual(game.response, f.originalParent.response);
  assert.deepEqual(game.decision, f.originalParent.decision);
  assert.deepEqual(game.phaseOpening, f.originalParent.phaseOpening);
  assert.deepEqual(game.pendingKarama, f.originalParent.pendingKarama);
  assert.ok(player(game, f.observer).hand.some(card => card.id === f.parentCounter));
  reject(game, f.donor, f.giftAction);
  return game;
}

for (const advanced of [false, true]) for (const parent of ['quiet', 'emperorIncome'] as const) for (const claimed of [false, true]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} prevented Semuta gift ${claimed ? 'spends that reserved Semuta to claim' : 'passes'} its cost with ${parent} parent`, () => {
    const f = source({ advanced, parent });
    assert.equal(f.semutaPurchase.price, 1); assert.equal(f.giftPurchase.price, 1);
    assert.ok(f.semutaPurchase.steps.some(step => step.actor === f.donor && step.action.type === 'richeseBid' && step.action.amount === 1));
    assert.ok(f.giftPurchase.steps.some(step => step.actor === f.donor && step.action.type === 'richeseBid' && step.action.amount === 1));
    assert.equal(f.holder, f.donor);
    const pending = open(f), event = pending.pendingTreacheryDiscard!.batch.event;
    const game = settled(claimed ? claim(pending, f.holder) : pass(pending), f, claimed);
    reject(game, f.holder, { type: 'semutaCommit', event });
    reject(game, f.holder, { type: 'semutaPass', event });
    if (parent === 'emperorIncome') {
      assert.equal(game.response?.kind, 'emperorIncome');
      const before = player(game, f.recipient).spice;
      const remaining = advance(game, clean);
      assert.equal(player(remaining, f.recipient).spice, before + 1,
        'The one original cache-purchase income resumes once after gift prevention and Semuta settlement');
      assert.ok(!remaining.pendingRicheseGift); assert.ok(!remaining.pendingTreacheryDiscard);
      assert.deepEqual(remaining.richeseGiftBlocked, game.richeseGiftBlocked);
      assert.equal(player(remaining, f.recipient).hand.some(card => card.id === f.semuta), false);
      assert.ok(player(remaining, f.donor).hand.some(card => card.id === f.unusedDistrans));
      assert.deepEqual(inventory(remaining), f.originalInventory);
    }
  });
}

void test('the prevented selected-Semuta reservation permits only its actual cost reaction and rejects stale replay', () => {
  const f = source({ advanced: true, parent: 'emperorIncome' });
  const pending = open(f), event = pending.pendingTreacheryDiscard!.batch.event;
  reject(pending, f.spender, f.action);
  reject(pending, f.donor, f.giftAction);
  reject(pending, f.recipient, { type: 'passResponse' });
  reject(pending, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
  const game = settled(claim(pending, f.holder), f, true);
  reject(game, f.holder, { type: 'semutaCommit', event });
  assert.deepEqual(game.richeseGiftBlocked!.cards, [f.semuta]);
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, 1);
  assert.equal(player(game, f.donor).hand.filter(card => card.id === f.cost).length, 1);
});
