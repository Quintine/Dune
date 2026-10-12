import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import {
  createSemutaEmperorShareFixture, reactSemutaEmperorShare,
  semutaEmperorPlayer, semutaEmperorSharePhysical, semutaEmperorShareViews,
  type SemutaEmperorShareKind,
} from './fixture-semuta-emperor-share';

for (const kind of ['emperorGift', 'emperorRevival'] as SemutaEmperorShareKind[]) {
  for (const claim of [false, true]) void test(
    `Semuta ${claim ? 'claims' : 'passes'} the printed Karama canceling Emperor ${kind === 'emperorGift' ? 'gift' : 'revival'} before the native cancellation`, () => {
      const f = createSemutaEmperorShareFixture(kind);
      assert.equal(semutaEmperorPlayer(f.game, f.holder).hand.some(card => card.id === f.semuta), true);
      const declared = applyAction(f.game, f.owner, f.declare);
      assert.equal(declared.response?.kind, kind);
      assert.equal(semutaEmperorPlayer(declared, f.owner).spice, semutaEmperorPlayer(f.game, f.owner).spice);
      const pending = applyAction(declared, f.recipient, f.cancel);
      const reaction = pending.pendingTreacheryDiscard!;
      assert.equal(reaction.batch.cause, `karama:${kind}`);
      assert.deepEqual(reaction.batch.entries, [{ card: f.karamaCard, discardedBy: f.recipient, publicFace: true }]);
      assert.equal(reaction.reaction?.stage, 'offer');
      semutaEmperorShareViews(pending);
      const before = semutaEmperorSharePhysical(pending);
      const offer = viewGame(pending, f.holder).semutaReaction!;
      assert.equal(offer.canCommit, true);
      assert.deepEqual(offer.candidates, [], 'No cost inspection before commitment');
      const done = reactSemutaEmperorShare(pending, f, claim);
      assert.equal(done.resolvedTreacheryDiscardSequence, reaction.sequence);
      assert.equal(semutaEmperorPlayer(done, f.holder).hand.some(card => card.id === f.karama), claim);
      assert.equal(semutaEmperorPlayer(done, f.holder).hand.some(card => card.id === SEMUTA_DRUG_ID), !claim);
      assert.equal(done.discard.filter(card => card.id === f.karama).length, Number(!claim));
      assert.equal(done.discard.filter(card => card.id === SEMUTA_DRUG_ID).length, Number(claim));
      // The denied share moves nothing: no spice, forces, revivals or extra-revival ledger.
      assert.deepEqual(semutaEmperorSharePhysical(done), before);
      assert.equal(done.emperorExtra[f.recipient] ?? 0, 0);
      assert.throws(() => applyAction(done, f.recipient, f.cancel));
      assert.throws(() => applyAction(done, f.holder, { type: 'semutaCommit', event: reaction.batch.event }));
      semutaEmperorShareViews(done);
    },
  );
}

void test('the native Emperor share still settles when its cost is declined', () => {
  const f = createSemutaEmperorShareFixture('emperorGift');
  const declared = applyAction(f.game, f.owner, f.declare);
  // The neutral window still requires the Karama holder's own choice.
  const settled = applyAction(declared, f.recipient, { type: 'passResponse' });
  assert.equal(semutaEmperorPlayer(settled, f.owner).spice, semutaEmperorPlayer(f.game, f.owner).spice - 3);
  assert.equal(semutaEmperorPlayer(settled, f.recipient).spice, semutaEmperorPlayer(f.game, f.recipient).spice + 3);
  assert.equal(semutaEmperorPlayer(settled, f.holder).hand.some(card => card.id === SEMUTA_DRUG_ID), true);
});

void test('every legal Semuta profile finishes the printed Emperor-share cancellation cost', () => {
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const f = createSemutaEmperorShareFixture('emperorRevival');
    const pending = applyAction(applyAction(f.game, f.owner, f.declare), f.recipient, f.cancel);
    const own = viewGame(pending, f.holder);
    own.players.find(player => player.id === f.holder)!.bot = difficulty;
    const action = botActions(own)[0];
    assert.ok(action);
    assert.equal(action.type, 'semutaCommit');
    const done = applyAction(pending, f.holder, action);
    assert.equal(semutaEmperorPlayer(done, f.holder).hand.some(card => card.id === f.karama), true);
    assert.equal(done.emperorExtra[f.recipient] ?? 0, 0);
  }
});
