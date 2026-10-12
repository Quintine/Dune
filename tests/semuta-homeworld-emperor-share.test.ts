import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, handLimit, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { semutaEmperorPlayer as player } from './fixture-semuta-emperor-share';
import type { SemutaEmperorShareKind } from './fixture-semuta-emperor-share';
import {
  createSemutaHomeworldEmperorShareFixture, disposeSemutaHomeworldEmperorShare,
  finishSemutaHomeworldEmperorShare, reactSemutaHomeworldEmperorShare,
  semutaHomeworldEmperorOrdinaryRevive,
  semutaHomeworldEmperorShareResources as resources,
  semutaHomeworldEmperorShareStock as stock,
  type SemutaHomeworldEmperorShareFixture,
} from './fixture-semuta-homeworld-emperor-share';

const kinds: SemutaEmperorShareKind[] = ['emperorGift', 'emperorRevival'];
const shareOf = (kind: SemutaEmperorShareKind) => kind === 'emperorGift' ? 'gift' : 'revival';
const endPhase = (kind: SemutaEmperorShareKind) => kind === 'emperorGift' ? 3 : 5;

/** The denied share spends the printed Karama once and moves no benefit. */
function assertConsumedDenial(game: Game, f: SemutaHomeworldEmperorShareFixture) {
  assert.equal(game.discard.filter(card => card.id === f.karama).length +
    player(game, f.holder).hand.filter(card => card.id === f.karama).length, 1,
    'The exact spent cost is either still discarded or recovered once');
  assert.equal(player(game, f.canceller).hand.some(card => card.id === f.karama), false);
  assert.equal(game.emperorExtra[f.recipient] ?? 0, 0, 'No extra-revival allowance is granted');
  assert.deepEqual(resources(game), resources(f.beforeBenefit),
    'A denied share changes no wallet, force, Tank, custody or revival ledger');
  assert.equal(game.storm, f.death.storm, 'The original storm history is retained');
  assert.equal(player(game, f.recipient).allySinceTurn, player(f.alliance, f.recipient).allySinceTurn,
    'The original turn-two alliance stamp is retained');
}

for (const advanced of [false, true]) {
  const label = advanced ? 'Advanced' : 'Basic';
  for (const kind of kinds) {
    void test(`${label} Homeworld: original Emperor ${shareOf(kind)} declaration accepts the real Atreides Karama cost`, () => {
      const f = createSemutaHomeworldEmperorShareFixture(kind, advanced);
      assert.deepEqual(resources(f.game), resources(f.beforeBenefit),
        'Declaring the share spends nothing before the printed cancellation');
      assert.deepEqual(stock(f.game), stock(f.setup));
      assert.equal(f.game.turn, 2);
      assert.equal(f.game.phase, kind === 'emperorGift' ? 2 : 4);
      assert.equal(f.beforeWeather.storm, 1);
      assert.equal(f.weather.stormMovementSource?.kind, 'weather');
      assert.equal(f.weather.stormMovementSource?.distance, 6);
      assert.equal(f.game.storm, 7);
      assert.equal(player(f.paidShipment, f.recipient).spice, player(f.beforeShipment, f.recipient).spice - 6);
      assert.equal(player(f.paidShipment, f.recipient).forces['red_chasm:7'], 3);
      assert.equal(player(f.death, f.recipient).forces['red_chasm:7'] ?? 0, 0);
      assert.equal(player(f.death, f.recipient).tanks, 3);
      assert.equal(player(f.death, f.recipient).forces['arrakeen:10'], 10);
      assert.equal(f.worm.nexus, true);
      assert.equal(player(f.alliance, f.owner).ally, f.recipient);
      assert.equal(player(f.alliance, f.recipient).ally, f.owner);
      assert.equal(Boolean(f.game.nexus), false, 'The original worm Nexus has resolved');
      assert.equal(f.game.response?.kind, kind);
      assert.equal(f.game.response?.owner, f.owner);
      assert.equal(f.game.response?.recipient, f.recipient);
      assert.equal(f.game.response?.amount, kind === 'emperorGift' ? 3 : 2);
      assert.deepEqual(viewGame(f.game, f.canceller).responseControls?.cancelCards, [f.karama],
        'The allied recipient holds the exact original printed cancellation');
      for (const seat of f.game.players.filter(seat => seat.id !== f.canceller))
        assert.equal(viewGame(f.game, seat.id).responseControls?.cancelCards.length ?? 0, 0,
          'No other original seat can spend the allied printed cancellation');
      assert.equal(player(f.game, f.owner).spice, 10);

      const receipt = disposeSemutaHomeworldEmperorShare(f);
      const pending = receipt.pendingTreacheryDiscard!;
      assert.equal(pending.continuation.kind, 'karamaEmperorShareDiscard');
      assert.equal(pending.batch.cause, `karama:${kind}`);
      assert.deepEqual(pending.batch.entries,
        [{ card: f.karamaCard, discardedBy: f.canceller, publicFace: true }]);
      assert.equal(pending.reaction?.stage, 'offer');
      assert.equal(receipt.response, null);
      assert.equal(receipt.decision, null);
      assert.equal(viewGame(receipt, f.holder).semutaReaction?.canCommit, true);
      for (const seat of receipt.players.filter(seat => seat.id !== f.holder))
        assert.equal(viewGame(receipt, seat.id).semutaReaction?.canCommit, false,
          'Only the original Semuta holder receives the neutral offer');
      assertConsumedDenial(receipt, f);
    });

    for (const claim of [false, true]) void test(`${label} Homeworld: Semuta ${claim ? 'claim' : 'pass'} decides the spent Karama and denies the ${shareOf(kind)}`, () => {
      const f = createSemutaHomeworldEmperorShareFixture(kind, advanced);
      const receipt = disposeSemutaHomeworldEmperorShare(f);
      const sequence = receipt.pendingTreacheryDiscard!.sequence;
      const event = receipt.pendingTreacheryDiscard!.batch.event;
      assert.deepEqual(resources(receipt), resources(f.beforeBenefit));
      const done = reactSemutaHomeworldEmperorShare(receipt, f.holder, claim);
      assert.equal(done.resolvedTreacheryDiscardSequence, sequence);
      assert.equal(done.pendingTreacheryDiscard, null);
      assert.equal(player(done, f.holder).hand.some(card => card.id === f.karama), claim);
      assert.equal(done.discard.filter(card => card.id === f.karama).length, Number(!claim));
      assert.equal(player(done, f.holder).hand.some(card => card.id === SEMUTA_DRUG_ID), !claim);
      assert.equal(done.discard.filter(card => card.id === SEMUTA_DRUG_ID).length, Number(claim));
      assertConsumedDenial(done, f);
      assert.equal(player(done, f.owner).spice, player(f.beforeBenefit, f.owner).spice);
      assert.equal(player(done, f.recipient).spice, player(f.beforeBenefit, f.recipient).spice);
      assert.equal(player(done, f.recipient).forces['arrakeen:10'], 10);
      assert.equal(player(done, f.recipient).forces['red_chasm:7'] ?? 0, 0);
      assert.equal(player(done, f.recipient).tanks, 3);
      assert.throws(() => applyAction(done, f.holder, { type: 'semutaCommit', event }));
      assert.throws(() => applyAction(done, f.canceller, f.cancel),
        'The spent printed Karama cannot cancel again');
      assert.throws(() => applyAction(done, f.holder, { type: 'alliance', target: f.owner }),
        'No second alliance is offered outside the original worm Nexus');
      assert.deepEqual(stock(done), stock(f.setup));
      const finished = finishSemutaHomeworldEmperorShare(structuredClone(done), f);
      assert.equal(finished.turn, 2);
      assert.equal(finished.phase, endPhase(kind));
      assert.equal(finished.storm, 7);
      assert.equal(player(finished, f.recipient).forces['arrakeen:10'], 10);
      assert.equal(player(finished, f.recipient).forces['red_chasm:7'] ?? 0, 0);
      assert.equal(player(finished, f.holder).hand.some(card => card.id === SEMUTA_DRUG_ID), !claim);
      assert.deepEqual(stock(finished), stock(f.setup));
      if (kind === 'emperorRevival') {
        const legal = semutaHomeworldEmperorOrdinaryRevive(done, f.recipient);
        assert.equal(legal, 3);
        assert.equal(player(finished, f.recipient).revived, 3,
          'All three real storm casualties return through ordinary revival');
        assert.equal(player(finished, f.recipient).freeForcesRevived, 2,
          'Only the printed two ordinary free returns are granted');
      }
    });
  }

  void test(`${label} Homeworld: the paid Emperor share still settles natively when the allied cancellation is declined`, () => {
    for (const kind of kinds) {
      const f = createSemutaHomeworldEmperorShareFixture(kind, advanced);
      const before = player(f.game, f.owner).spice;
      const settled = applyAction(f.game, f.canceller, { type: 'passResponse' });
      if (kind === 'emperorGift') {
        assert.equal(player(settled, f.owner).spice, before - 3);
        assert.equal(player(settled, f.recipient).spice, player(f.game, f.recipient).spice + 3);
      } else {
        assert.equal(settled.phase, 4);
        assert.equal(settled.emperorExtra[f.recipient] ?? 0, 2,
          'The accepted extra revival really grants its two-revival allowance');
      }
      assert.equal(player(settled, f.holder).hand.some(card => card.id === SEMUTA_DRUG_ID), true);
      assert.equal(player(settled, f.recipient).forces['arrakeen:10'], 10);
      assert.equal(settled.storm, 7);
      const finished = finishSemutaHomeworldEmperorShare(settled, f);
      assert.equal(finished.turn, 2);
      assert.equal(finished.phase, endPhase(kind));
      if (kind === 'emperorRevival')
        assert.equal(player(finished, f.recipient).revived,
          semutaHomeworldEmperorOrdinaryRevive(settled, f.recipient),
          'Only the ordinary return the remaining Tanks and allowance permit happens');
    }
  });

  for (const kind of kinds) void test(`${label} Homeworld: full Richese hand still exchanges the Karama privately and finishes the original ${shareOf(kind)} step`, () => {
    const f = createSemutaHomeworldEmperorShareFixture(kind, advanced, true);
    assert.equal(player(f.game, f.holder).hand.length, handLimit(player(f.game, f.holder)));
    const receipt = disposeSemutaHomeworldEmperorShare(f);
    assert.deepEqual(viewGame(f.game, f.canceller).responseControls?.cancelCards, [f.karama],
      'The allied recipient keeps its exact printed cancellation with a full holder hand');
    assert.equal(viewGame(receipt, f.holder).semutaReaction?.canCommit, true);
    const claimed = reactSemutaHomeworldEmperorShare(receipt, f.holder, true);
    assert.equal(player(claimed, f.holder).hand.length, handLimit(player(claimed, f.holder)));
    assert.equal(player(claimed, f.holder).hand.filter(card => card.id === f.karama).length, 1);
    assert.equal(player(claimed, f.holder).hand.some(card => card.id === SEMUTA_DRUG_ID), false);
    assert.equal(claimed.discard.filter(card => card.id === SEMUTA_DRUG_ID).length, 1);
    assertConsumedDenial(claimed, f);
    assert.equal(finishSemutaHomeworldEmperorShare(claimed, f).phase, endPhase(kind));
  });

  void test(`${label} Homeworld: every minimal bot profile legally finishes the spent Karama receipt`, () => {
    for (const difficulty of DIFFICULTIES) {
      const f = createSemutaHomeworldEmperorShareFixture('emperorRevival', advanced);
      const receipt = disposeSemutaHomeworldEmperorShare(f);
      const own = viewGame(structuredClone(receipt), f.holder);
      own.players.find(seat => seat.id === f.holder)!.bot = difficulty;
      const action = botActions(own)[0];
      assert.ok(action, `${difficulty} has an entitled receipt action`);
      assert.ok(['semutaCommit', 'semutaPass'].includes(action.type));
      let game: Game = structuredClone(receipt);
      game = applyAction(game, f.holder, action);
      while (game.pendingTreacheryDiscard?.reaction?.stage === 'offer') {
        const pending = game.pendingTreacheryDiscard, reaction = pending.reaction;
        if (reaction?.stage !== 'offer') throw Error('Missing neutral discard offer');
        game = applyAction(game, game.players.find(seat => !reaction.passed.includes(seat.id))!.id,
          { type: 'semutaPass', event: pending.batch.event });
      }
      assert.equal(game.pendingTreacheryDiscard, null);
      assertConsumedDenial(game, f);
      assert.equal(player(game, f.recipient).tanks, 3);
      assert.equal(player(game, f.recipient).forces['arrakeen:10'], 10);
      const finished = finishSemutaHomeworldEmperorShare(game, f);
      assert.equal(finished.phase, 5);
      const legal = semutaHomeworldEmperorOrdinaryRevive(game, f.recipient);
      assert.equal(legal, 3);
      assert.equal(player(finished, f.recipient).revived, 3,
        'The three ordinary returns remain legal after the denied extra revival');
      assert.equal(player(finished, f.recipient).freeForcesRevived, 2);
      assert.equal(finished.emperorExtra[f.recipient] ?? 0, 0);
    }
  });
}
