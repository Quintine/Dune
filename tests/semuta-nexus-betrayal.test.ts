import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import {
  commitSemutaNexusBetrayal, createSemutaNexusBetrayalFixture,
  nextSemutaNexusBetrayalStep, reactSemutaNexusBetrayal,
  semutaNexusBetrayalInventory, semutaNexusBetrayalPlayer,
} from './fixture-semuta-nexus-betrayal';

for (const advanced of [false, true]) {
  for (const claim of [false, true]) void test(
    `${advanced ? 'Advanced' : 'Basic'} Semuta ${claim ? 'claims' : 'passes'} the committed random CHOAM Betrayal discard before its receipt completes`, () => {
      const f = createSemutaNexusBetrayalFixture({ advanced });
      assert.equal(f.setup.status, 'setup');
      assert.ok(Object.values(f.setup.nexusCards!.cards!.hands).every(card => card === null));
      assert.equal(f.drawBefore.phase, 1);
      assert.equal(f.drawBefore.turn, 2);
      assert.equal(f.drawBefore.nexusCards!.phase!.occurred, true);
      assert.equal(f.drawBefore.nexusCards!.phase!.stage, 'drawing');
      assert.equal(semutaNexusBetrayalPlayer(f.drawBefore, f.owner).ally, f.target);
      assert.equal(semutaNexusBetrayalPlayer(f.drawBefore, f.target).ally, f.owner);
      assert.ok(!semutaNexusBetrayalPlayer(f.drawBefore, f.spender).ally);
      assert.equal(f.drawAfter.nexusCards!.phase!.stage, 'complete');
      assert.ok(f.drawAfter.nexusCards!.cards!.hands[f.spender]);
      assert.equal(f.drawAfter.nexusCards!.cards!.deck.length, 10);
      assert.equal(viewGame(f.game, f.spender).nexusChoamBetrayal!.target.id, f.target);
      assert.equal(viewGame(f.game, f.spender).nexusChoamBetrayal!.blocked, null);
      const wallets = f.game.players.map(p => p.spice);
      const targetBefore = structuredClone(semutaNexusBetrayalPlayer(f.game, f.target).hand);
      const logStart = f.game.log.length;
      const pending = commitSemutaNexusBetrayal(f);
      const batch = pending.pendingTreacheryDiscard!.batch;
      const receipt = pending.nexusChoamBetrayals!.at(-1)!;
      const fresh = targetBefore.filter(card => !semutaNexusBetrayalPlayer(pending, f.target).hand.some(c => c.id === card.id));
      assert.equal(fresh.length, 1, 'The server must randomly remove exactly one actual held card');
      assert.deepEqual(semutaNexusBetrayalPlayer(pending, f.target).hand,
        targetBefore.filter(card => card.id !== fresh[0].id));
      assert.equal(batch.cause, 'nexus:choamBetrayal');
      assert.deepEqual(batch.entries, [{ card: fresh[0], discardedBy: f.target, publicFace: false }]);
      assert.equal(pending.pendingTreacheryDiscard!.reaction?.stage, 'offer');
      assert.equal(receipt.stage, 'discard');
      assert.equal(receipt.card, fresh[0].id);
      assert.equal(pending.discard.filter(c => c.id === fresh[0].id).length, 1);
      assert.equal(pending.nexusCards!.cards!.hands[f.spender], null);
      assert.equal(pending.nexusCards!.cards!.discard.filter(c => c === 'choam').length, 1);
      assert.deepEqual(pending.players.map(p => p.spice), wallets, 'Random discard gives no compensation');
      const offer = viewGame(pending, f.owner).semutaReaction!;
      assert.equal(offer.canCommit, true, 'Semuta may recover another player’s card even from its own ally');
      assert.deepEqual(offer.candidates, [], 'The discard offer precedes any committed inspection');
      assert.equal(pending.log.slice(logStart).some(row => row.text.includes(fresh[0].name)), false);
      const done = reactSemutaNexusBetrayal(pending, f, claim);
      assert.equal(done.pendingTreacheryDiscard, null);
      assert.equal(done.resolvedTreacheryDiscardSequence, pending.pendingTreacheryDiscard!.sequence);
      assert.equal(done.nexusChoamBetrayals!.length, 1);
      assert.equal(done.nexusChoamBetrayals![0].stage, 'complete');
      assert.equal(done.nexusChoamBetrayals![0].card, fresh[0].id, 'The original random identity remains committed');
      assert.equal(semutaNexusBetrayalPlayer(done, f.owner).hand.filter(c => c.id === fresh[0].id).length, Number(claim));
      assert.equal(semutaNexusBetrayalPlayer(done, f.owner).hand.some(c => c.id === f.semuta), !claim);
      assert.equal(done.discard.filter(c => c.id === fresh[0].id).length, Number(!claim));
      assert.equal(done.discard.filter(c => c.id === f.semuta).length, Number(claim));
      assert.deepEqual(semutaNexusBetrayalPlayer(done, f.target).hand,
        semutaNexusBetrayalPlayer(pending, f.target).hand, 'Reaction cannot resample or repeat the discard');
      assert.deepEqual(done.players.map(p => p.spice), wallets);
      assert.equal(done.nexusCards!.cards!.discard.filter(c => c === 'choam').length, 1);
      assert.deepEqual(semutaNexusBetrayalInventory(done), f.cards);
      assert.equal(viewGame(done, f.owner).semutaReaction, null);
      assert.equal(viewGame(done, f.spender).nexusChoamBetrayal, null);
      assert.throws(() => applyAction(done, f.spender, f.action));
      assert.throws(() => applyAction(done, f.owner, { type: 'semutaCommit', event: batch.event }));
      const next = nextSemutaNexusBetrayalStep(done);
      assert.equal(next.action.type, 'ready', 'The original Charity acknowledgement is available after retirement');
      const resumed = applyAction(done, next.actor, next.action);
      assert.ok(resumed.ready.includes(next.actor));
      assert.equal(resumed.nexusChoamBetrayals!.length, 1);
      assert.equal(resumed.nexusChoamBetrayals![0].stage, 'complete');
      assert.deepEqual(semutaNexusBetrayalPlayer(resumed, f.target).hand,
        semutaNexusBetrayalPlayer(done, f.target).hand);
      assert.deepEqual(semutaNexusBetrayalInventory(resumed), f.cards);
    },
  );

  void test(`${advanced ? 'Advanced' : 'Basic'} full-hand Semuta exchanges the exact random Betrayal discard without overflow or payment`, () => {
    const f = createSemutaNexusBetrayalFixture({ advanced, fullHand: true });
    assert.equal(semutaNexusBetrayalPlayer(f.game, f.owner).hand.length, 4);
    const pending = commitSemutaNexusBetrayal(f), fresh = pending.pendingTreacheryDiscard!.batch.entries[0].card;
    assert.equal(viewGame(pending, f.owner).semutaReaction!.canCommit, true);
    const done = reactSemutaNexusBetrayal(pending, f, true);
    assert.equal(semutaNexusBetrayalPlayer(done, f.owner).hand.length, 4);
    assert.ok(semutaNexusBetrayalPlayer(done, f.owner).hand.some(c => c.id === fresh.id));
    assert.ok(!semutaNexusBetrayalPlayer(done, f.owner).hand.some(c => c.id === f.semuta));
    assert.equal(done.decision, null);
    assert.deepEqual(done.players.map(p => p.spice), pending.players.map(p => p.spice));
    assert.deepEqual(semutaNexusBetrayalInventory(done), f.cards);
  });
}

void test('CHOAM Betrayal rejects a client-picked card, and its pending Semuta reaction blocks original phase actions until resolved', () => {
  const f = createSemutaNexusBetrayalFixture();
  assert.throws(() => applyAction(f.game, f.spender, { ...f.action, card: f.targetCards[0].id }));
  assert.equal(f.game.nexusCards!.cards!.hands[f.spender], 'choam');
  assert.deepEqual(semutaNexusBetrayalPlayer(f.game, f.target).hand, f.targetCards);
  const pending = commitSemutaNexusBetrayal(f), event = pending.pendingTreacheryDiscard!.batch.event;
  assert.throws(() => applyAction(pending, f.spender, { type: 'ready' }));
  assert.throws(() => applyAction(pending, f.owner, { type: 'semutaSelect', event, card: f.targetCards[0].id }));
  assert.equal(pending.nexusChoamBetrayals![0].stage, 'discard');
  const done = reactSemutaNexusBetrayal(pending, f, false);
  assert.equal(done.nexusChoamBetrayals![0].stage, 'complete');
  assert.deepEqual(semutaNexusBetrayalInventory(done), f.cards);
});

void test('existing minimal bot reactions settle the random Betrayal claim and neutral passes through the original receipt', () => {
  const f = createSemutaNexusBetrayalFixture();
  const pending = commitSemutaNexusBetrayal(f), fresh = pending.pendingTreacheryDiscard!.batch.entries[0].card.id;
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const own = viewGame(pending, f.owner);
    own.players.find(p => p.id === f.owner)!.bot = difficulty;
    const action = botActions(own)[0];
    assert.ok(action);
    assert.equal(action.type, 'semutaCommit');
    const claimed = applyAction(pending, f.owner, action);
    assert.ok(semutaNexusBetrayalPlayer(claimed, f.owner).hand.some(c => c.id === fresh));
    assert.equal(claimed.nexusChoamBetrayals![0].stage, 'complete');
    assert.deepEqual(semutaNexusBetrayalInventory(claimed), f.cards);
  }
  let passed: Game = pending;
  for (const seat of pending.players) {
    const own = viewGame(passed, seat.id);
    own.players.find(p => p.id === seat.id)!.bot = 'Easy';
    const action = seat.id === f.owner
      ? { type: 'semutaPass', event: passed.pendingTreacheryDiscard!.batch.event }
      : botActions(own)[0];
    assert.ok(action);
    assert.equal(action.type, 'semutaPass');
    passed = applyAction(passed, seat.id, action);
  }
  assert.equal(passed.nexusChoamBetrayals![0].stage, 'complete');
  assert.equal(passed.discard.filter(c => c.id === fresh).length, 1);
  assert.deepEqual(semutaNexusBetrayalInventory(passed), f.cards);
});

for (const options of [
  { advanced: false, tech: true },
  { advanced: true, tech: true, strongholds: true, skills: true },
]) void test(`Semuta random Betrayal remains playable with original ${options.skills ? 'Advanced Skills/Tech/Strongholds' : 'Basic Tech'} setup`, () => {
  const f = createSemutaNexusBetrayalFixture(options);
  assert.ok(Object.values(f.game.techTokens!).every(token => f.game.players.some(p => p.id === token.owner)));
  const pending = commitSemutaNexusBetrayal(f), fresh = pending.pendingTreacheryDiscard!.batch.entries[0].card.id;
  const done = reactSemutaNexusBetrayal(pending, f, true);
  assert.ok(semutaNexusBetrayalPlayer(done, f.owner).hand.some(c => c.id === fresh));
  assert.equal(done.nexusChoamBetrayals![0].stage, 'complete');
  assert.deepEqual(semutaNexusBetrayalInventory(done), f.cards);
});
