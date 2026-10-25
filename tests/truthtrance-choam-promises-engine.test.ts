import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createTruthtranceChoamPromisesFixture as fixture, actTruthtranceChoamPromises as act,
  advanceTruthtranceChoamPromises as advance, allowTruthtranceChoamPromisesIncome as allowIncome,
  finishTruthtranceChoamPromises as finish, truthtranceChoamPromisesPlayer as player,
  truthtranceChoamPromisesInventory as inventory, truthtranceChoamPromisesPhysical as physical,
  type TruthtranceChoamPromisesFixture,
} from './fixture-truthtrance-choam-promises';

const variants = [
  { advanced: false, kind: 'shipment' as const }, { advanced: true, kind: 'shipment' as const },
  { advanced: false, kind: 'movement' as const }, { advanced: true, kind: 'movement' as const },
];
const promise = (game: Game, f: TruthtranceChoamPromisesFixture) =>
  f.kind === 'shipment' ? game.shipmentPromises?.[0] : game.movementPromises?.[0];
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: TruthtranceChoamPromisesFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, f.advanced);
  assert.deepEqual(f.setup.expansions, ['choam']);
  assert.deepEqual(f.game.players.map(player => player.faction), ['atreides', 'choam', 'emperor', 'harkonnen']);
  assert.ok(!f.setup.homeworlds && !f.setup.nexusCards && !f.setup.leaderSkills && !f.setup.techTokens &&
    !f.setup.strongholdCards && !f.setup.discoveryEnabled && !f.setup.ecazTreachery);
  assert.ok(f.actions.some(step => step.action.type === 'start' && (!f.advanced || step.action.advancedPreview === true)));
  assert.ok(f.beforeStartingDeal.players.every(player => player.hand.length === 0));
  assert.deepEqual(f.afterSetup.players.flatMap(player => player.hand.map(card => card.id)), f.deal);
  assert.ok(player(f.afterSetup, f.asker).hand.some(card => card.id === f.card && card.effect === 'truthtrance'));
  assert.ok(player(f.afterSetup, f.counterHolder).hand.some(card => card.id === f.karama && card.effect === 'karama'));
  assert.equal(player(f.afterSetup, f.target).hand.length, 1);
  assert.ok(player(f.afterSetup, f.target).hand.every(card => card.kind === 'projectile' && !card.effect));
  assert.equal(f.game.phase, 0); assert.equal(f.game.turn, 1); assert.equal(f.game.truthtrance ?? null, null);
  assert.equal(player(f.game, f.target).spice, 2); assert.equal(player(f.game, f.target).reserves, 20);
  assert.deepEqual(player(f.game, f.target).forces, {}); assert.equal(player(f.game, f.target).tanks, 0);
  assert.equal(f.game.choamCharity, undefined); assert.equal(f.incomeAmount, 8); assert.equal(f.allowedCash, 10);
  assert.equal(f.originalInventory.length, 35); assert.deepEqual(inventory(f.game), f.originalInventory);
  assert.deepEqual(physical(f.game), f.originalPhysical); assert.equal(f.sourceActionCount, f.actions.length);
}
function asked(f: TruthtranceChoamPromisesFixture) {
  let game = act(structuredClone(f.game), f.declarationStep.actor, f.declarationStep.action);
  game = advance(game, state => state.truthtrance?.stage === 'ask');
  game = act(game, f.askStep.actor, f.askStep.action);
  const answers = f.kind === 'shipment' ? viewGame(game, f.target).truthShipmentAnswers : viewGame(game, f.target).truthMovementAnswers;
  assert.ok(answers?.includes('yes'), 'Native owned opening income supplies an allowed-outcome route');
  assert.ok(answers?.includes('no')); return game;
}
function bound(f: TruthtranceChoamPromisesFixture, answer: 'yes' | 'no' = 'yes') {
  const game = act(asked(f), f.target, { type: 'truthAnswer', answer });
  assert.equal(game.truthtrance ?? null, null); assert.equal(promise(game, f)?.answer, answer === 'yes');
  assert.equal(promise(game, f)?.released, undefined); assert.equal(promise(game, f)?.fulfilled, undefined);
  assert.equal(player(game, f.target).spice, 2); assert.equal(game.choamCharity, undefined);
  assert.deepEqual(physical(game), f.originalPhysical); assert.deepEqual(inventory(game), f.originalInventory);
  const view = viewGame(game, f.target); assert.equal(view.shipmentCompletion, null);
  assert.ok(!(view.movementPromisePolicy ?? []).some(action => action.type === 'ship' || action.type === 'move'));
  reject(game, f.target, f.shipment); reject(game, f.target, f.move); return game;
}
function incomePending(game: Game, f: TruthtranceChoamPromisesFixture) {
  const actions: { actor: string; action: Action }[] = [];
  const before = structuredClone(game);
  game = advance(game, state => state.phase === 2 && state.response?.kind === 'choamCharity', actions);
  assert.equal(game.response?.owner, f.target); assert.equal(player(game, f.target).spice, 2);
  assert.equal(game.choamCharity, undefined); assert.equal(promise(game, f)?.released, undefined);
  assert.ok(viewGame(game, f.counterHolder).responseControls?.cancelCards.includes(f.karama));
  reject(game, f.target, { type: 'ready' }); reject(game, f.target, { type: 'charity' });
  reject(game, f.target, f.shipment); return { game, before, actions };
}

for (const variant of variants) void test(
  `${variant.advanced ? 'Advanced' : 'Basic'} native CHOAM ${variant.kind} promise awaits real opening income then completes its funded native route`, () => {
    const f = fixture(variant); nativeSource(f);
    const pending = incomePending(bound(f), f), originalResponse = structuredClone(pending.game.response);
    assert.equal(promise(pending.game, f)?.fulfilled, undefined);
    const incomeActions: { actor: string; action: Action }[] = [];
    const allowed = allowIncome(pending.game, incomeActions);
    assert.equal(player(allowed, f.target).spice, 10);
    assert.deepEqual(allowed.choamCharity, { turn: 1, canceled: false });
    assert.equal(originalResponse?.kind, 'choamCharity'); assert.ok(incomeActions.some(step => step.action.type === 'passResponse'));
    assert.equal(promise(allowed, f)?.released, undefined);
    reject(allowed, f.target, f.blockedBribe);
    const completed = finish(f, allowed);
    reject(completed.beforeBid, f.target, f.blockedBid);
    assert.equal(completed.afterShipment.choamCharity?.canceled, false);
    assert.equal(player(completed.delivered, f.target).forces[f.location], f.minimum);
    assert.equal(promise(completed.delivered, f)?.fulfilled, true);
    assert.equal(promise(completed.delivered, f)?.released, undefined);
    if (f.kind === 'shipment') {
      assert.equal(completed.purchase, null); assert.equal(completed.move, null);
      assert.equal(player(completed.delivered, f.target).spice, 0);
      assert.equal(player(completed.delivered, f.target).reserves, 10);
      assert.equal(player(completed.delivered, f.target).moved, 0);
    } else {
      assert.ok(completed.purchase && completed.move);
      assert.equal(player(completed.purchase.after, f.target).spice, 8);
      assert.ok(player(completed.purchase.after, f.target).hand.some(card => card.id === f.purchaseCard));
      assert.equal(player(completed.afterShipment, f.target).forces['arrakeen:10'], 6);
      assert.equal(promise(completed.afterShipment, f)?.fulfilled, undefined, 'The reserve shipment is not the promised ground event');
      assert.equal(player(completed.delivered, f.target).forces['arrakeen:10'] ?? 0, 0);
      assert.equal(player(completed.delivered, f.target).reserves, 14);
      assert.equal(player(completed.delivered, f.target).spice, 2);
      assert.equal(player(completed.delivered, f.target).moved, 1);
    }
    assert.equal(player(completed.delivered, f.target).shipped, true);
    assert.ok(player(completed.delivered, f.counterHolder).hand.some(card => card.id === f.karama));
    assert.equal(completed.delivered.discard.filter(card => card.id === f.card).length, 1);
    assert.deepEqual(inventory(completed.game), f.originalInventory);
  });

for (const variant of variants) void test(
  `${variant.advanced ? 'Advanced' : 'Basic'} native CHOAM ${variant.kind} opening cancellation spends the real Karama and releases only the unfunded obligation`, () => {
    const f = fixture(variant); nativeSource(f); const pending = incomePending(bound(f), f);
    const game = act(pending.game, f.counterHolder, f.cancelIncome);
    assert.equal(game.response ?? null, null); assert.equal(game.pendingTreacheryDiscard ?? null, null);
    assert.deepEqual(game.choamCharity, { turn: 1, canceled: true });
    assert.equal(player(game, f.target).spice, 2); assert.equal(player(game, f.target).reserves, 20);
    assert.deepEqual(player(game, f.target).forces, {});
    assert.equal(promise(game, f)?.released, true); assert.equal(promise(game, f)?.fulfilled, undefined);
    assert.equal(player(game, f.counterHolder).hand.some(card => card.id === f.karama), false);
    assert.equal(game.discard.filter(card => card.id === f.karama).length, 1);
    reject(game, f.counterHolder, f.cancelIncome); reject(game, f.target, { type: 'passResponse' });
    assert.deepEqual(inventory(game), f.originalInventory);
  });

for (const variant of variants) void test(
  `${variant.advanced ? 'Advanced' : 'Basic'} native CHOAM ${variant.kind} No retains a real smaller alternative without reserving Yes funds`, () => {
    const f = fixture(variant), pending = incomePending(bound(f, 'no'), f), allowed = allowIncome(pending.game);
    const spent = act(structuredClone(allowed), f.target, { type: 'bribe', target: f.asker, amount: 1 });
    assert.equal(player(spent, f.target).spice, 9); assert.equal(promise(spent, f)?.released, undefined);
    const completed = finish(f, allowed, { answer: 'no' });
    assert.equal(player(completed.delivered, f.target).forces[f.location], f.minimum - 1);
    assert.equal(promise(completed.delivered, f)?.released, undefined);
    if (f.kind === 'shipment') {
      assert.equal(promise(completed.delivered, f)?.fulfilled, true);
      assert.equal(player(completed.delivered, f.target).spice, 1); assert.equal(completed.turnEnd, null);
    } else {
      assert.equal(promise(completed.delivered, f)?.fulfilled, undefined, 'A later move could still match until this actual turn ends');
      assert.equal(player(completed.delivered, f.target).forces['arrakeen:10'], 1);
      assert.ok(completed.turnEnd);
      assert.deepEqual(completed.turnEnd.steps, [{ actor: f.target, action: { type: 'endMovement' } }]);
      assert.equal(promise(completed.finished, f)?.fulfilled, true);
      assert.ok(!completed.finished.movementRemaining?.includes(f.target));
      assert.deepEqual(player(completed.finished, f.target).forces, player(completed.delivered, f.target).forces);
      assert.equal(player(completed.finished, f.target).spice, player(completed.delivered, f.target).spice);
      assert.equal(player(completed.finished, f.target).reserves, player(completed.delivered, f.target).reserves);
    }
    assert.deepEqual(inventory(completed.game), f.originalInventory);
  });

void test('native CHOAM promise questions reject foreign and underlying replies while raw cash stays uncredited', () => {
  for (const kind of ['shipment', 'movement'] as const) {
    const f = fixture({ advanced: true, kind }), game = asked(f);
    reject(game, f.asker, { type: 'truthAnswer', answer: 'yes' });
    reject(game, f.target, { type: 'ready' }); reject(game, f.target, f.shipment);
    reject(game, f.asker, f.askStep.action);
    assert.equal(player(game, f.target).spice, 2); assert.equal(game.choamCharity, undefined);
    const answered = act(game, f.target, { type: 'truthAnswer', answer: 'yes' });
    reject(answered, f.target, { type: 'truthAnswer', answer: 'yes' });
    const pending = incomePending(answered, f);
    assert.equal(player(pending.game, f.target).spice, 2); assert.equal(promise(pending.game, f)?.released, undefined);
  }
});

void test('all four minimal policies preserve native CHOAM promise funding during actual Bidding', () => {
  for (const variant of variants) {
    const f = fixture(variant), pending = incomePending(bound(f), f), allowed = allowIncome(pending.game);
    const game = advance(allowed, state => state.phase === 3 && !state.response && !state.phaseOpening &&
      !state.decision && state.auction?.active === f.target);
    for (const difficulty of DIFFICULTIES) {
      const view = viewGame(game, f.target); view.players.find(player => player.id === f.target)!.bot = difficulty;
      const before = structuredClone(view), action = botActions(view)[0]; assert.ok(action, difficulty);
      assert.deepEqual(view, before);
      const done = act(structuredClone(game), f.target, action);
      assert.equal(promise(done, f)?.released, undefined);
      assert.ok(player(done, f.target).spice >= (f.kind === 'shipment' ? 10 : 6));
      assert.deepEqual(inventory(done), f.originalInventory);
    }
  }
});
