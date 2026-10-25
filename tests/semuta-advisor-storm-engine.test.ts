import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { fighterCount, isAdvisor } from '../game/advisors';
import {
  createSemutaAdvisorStormFixture as fixture, actSemutaAdvisorStorm as act,
  passSemutaAdvisorStorm as pass, claimSemutaAdvisorStorm as claim,
  allowSemutaAdvisorStorm as allow, finishSemutaAdvisorStorm as finish,
  semutaAdvisorStormPlayer as player, semutaAdvisorStormInventory as inventory,
  semutaAdvisorStormPhysical as physical, type SemutaAdvisorStormFixture,
} from './fixture-semuta-advisor-storm';

const variants = [{ continues: false }, { continues: true }];
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaAdvisorStormFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, true); assert.equal(f.setup.semutaPreview, true);
  assert.deepEqual(f.setup.expansions, ['choam']); assert.ok(f.beforeStartingDeal.players.every(p => p.hand.length === 0));
  assert.deepEqual(f.game.players.map(p => p.faction), ['richese', 'choam', 'beneGesserit', 'atreides', 'emperor']);
  assert.deepEqual(f.afterSetup.players.flatMap(p => p.hand.map(card => card.id)), f.deal);
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.ok(f.setupChoices.steps.some(step => step.actor === f.owner && step.action.type === 'advisorSetup' &&
    step.action.territory === f.territory && step.action.sector === 10));
  assert.equal(player(f.afterSetup, f.owner).forces[f.location], 1);
  assert.equal(isAdvisor(player(f.afterSetup, f.owner), f.territory), false,
    'The empty native setup placement actually starts as a fighter');
  assert.deepEqual(f.firstStormDials.map(step => step.action.amount), [2, 3]);
  assert.equal(f.firstStorm.before.storm, 1); assert.equal(f.firstStorm.after.storm, 6);
  assert.equal(f.acquisition.bid.actor, f.holder); assert.equal(f.acquisition.bid.action.amount, 1);
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquisition.after, f.holder).spice, 1);
  assert.equal(player(f.acquisition.after, f.richese).spice - player(f.acquisition.before, f.richese).spice, 1);
  assert.deepEqual(f.shipment.steps[0], { actor: f.outsider,
    action: { type: 'ship', territory: f.territory, sector: 9, amount: 1, elite: 0, allyPayment: 0 } });
  assert.equal(player(f.shipment.before, f.outsider).spice - player(f.shipment.after, f.outsider).spice, 2);
  assert.equal(player(f.shipment.before, f.outsider).reserves - player(f.shipment.after, f.outsider).reserves, 1);
  assert.equal(f.intrusion.before.decision?.kind, 'intrusion');
  assert.deepEqual(f.intrusion.steps[0], { actor: f.owner, action: { type: 'decision', accept: true } });
  assert.equal(f.intrusionResponse.kind, 'advisorFlip'); assert.equal(f.intrusionResponse.advisors, true);
  assert.ok(f.intrusion.steps.some(step => step.action.type === 'passResponse'));
  assert.equal(isAdvisor(player(f.intrusion.after, f.owner), f.territory), true);
  assert.equal(player(f.intrusion.after, f.owner).forces[f.location], 1);
  assert.equal(player(f.intrusion.after, f.outsider).forces[f.outsiderLocation], 1);
  assert.equal(f.mentatClose.steps.length, 1); assert.equal(f.mentatClose.steps[0].action.type, 'ready');
  assert.equal(f.mentatClose.after.decision?.kind, 'choamMarket');
  assert.equal(f.closingMarket.after.decision?.kind, 'choamMentat');
  assert.deepEqual(f.stormDraw.steps, [{ actor: f.holder, action: { type: 'decision', done: true } }]);
  assert.deepEqual(f.originalStormCards, [1, 2, 3, 4, 5, 6]);
  assert.equal(f.stormCardOrder[0], f.distance); assert.deepEqual([...f.stormCardOrder].sort((a, b) => a - b), f.originalStormCards);
  assert.equal(f.stormCardScalars.length, 5); assert.equal(f.stormDraw.after.stormPending, f.distance);
  assert.equal(f.stormDraw.after.turn, 2); assert.equal(f.stormDraw.after.phase, 0);
  assert.equal(f.stormSource?.kind, 'card'); assert.equal(f.stormCardLog.component?.distance, f.distance);
  assert.equal(f.stormReadiness.steps.length, f.game.players.length - 1);
  assert.deepEqual(f.storm.steps, [{ actor: f.triggerActor, action: f.triggerAction }]);
  assert.equal(f.storm.before.stormResolution, null); assert.equal(f.game.storm, f.from);
  assert.equal(f.game.turn, 2); assert.equal(f.game.phase, 0);
  assert.equal(f.originalAutomaticSource.producer, 'storm');
  assert.deepEqual(Object.keys(f.originalAutomaticSource.storm).sort((a, b) => a.localeCompare(b)), ['distance', 'event', 'from', 'sector', 'traversed']);
  assert.equal(f.originalAutomaticSource.storm.from, 6); assert.equal(f.originalAutomaticSource.storm.distance, f.distance);
  assert.equal(f.originalAutomaticSource.storm.traversed, 3); assert.equal(f.originalAutomaticSource.storm.sector, 9);
  assert.deepEqual(f.originalAutomaticSource.forces, { [f.location]: 1 });
  assert.deepEqual(f.originalQueue, [f.originalAutomaticSource]);
  assert.equal(f.originalParent.ready, true); assert.deepEqual(f.originalParent.receipt, f.originalAutomaticSource.storm);
  assert.equal(f.originalParent.cursor, JSON.stringify([f.originalCursor, f.originalStormMovementSource ?? null]));
  assert.equal(player(f.game, f.outsider).forces[f.outsiderLocation] ?? 0, 0);
  assert.equal(player(f.game, f.outsider).tanks, player(f.storm.before, f.outsider).tanks + 1);
  assert.equal(player(f.game, f.outsider).battleLosses, player(f.storm.before, f.outsider).battleLosses);
  assert.equal(player(f.game, f.owner).forces[f.location], 1);
  assert.equal(player(f.game, f.owner).tanks, player(f.storm.before, f.owner).tanks);
  assert.equal(fighterCount(player(f.game, f.owner), f.territory), 0);
  assert.equal(player(f.game, f.owner).advisors?.[f.territory]?.aloneFlipHold, f.originalAutomaticSource.event);
  assert.equal(f.originalInventory.length, 45); assert.deepEqual(inventory(f.game), f.originalInventory);
  assert.equal(f.sourceActionCount, f.actions.length);
}
function open(f: SemutaAdvisorStormFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, 'karamaAdvisorFlipDiscard');
  if (pending.continuation.kind !== 'karamaAdvisorFlipDiscard') throw Error('Use the native current-sector conversion cost');
  assert.equal(pending.batch.cause, 'karama:advisorFlip'); assert.equal(pending.reaction?.stage, 'offer');
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, face: entry.publicFace })),
    [{ card: f.cost, by: f.spender, face: true }]);
  assert.deepEqual(pending.continuation.use.response, f.originalResponse);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.deepEqual(game.pendingAutomaticAdvisorStorm, f.originalParent);
  assert.deepEqual(game.pendingAutomaticAdvisorFlips, f.originalQueue);
  assert.deepEqual(game.stormResolution, f.originalCursor); assert.deepEqual(game.stormMovementSource, f.originalStormMovementSource);
  assert.deepEqual(game.stormDials, f.originalStormDials); assert.deepEqual(game.ready, f.originalReady);
  assert.deepEqual(game.deck, f.originalDeck); assert.deepEqual(game.spiceDeck, f.originalSpiceDeck);
  assert.deepEqual(game.spiceDiscard, f.originalSpiceDiscard); assert.deepEqual(physical(game), f.originalPhysical);
  assert.deepEqual(player(game, f.owner).advisors, f.originalStance);
  assert.equal(game.phase, 0); assert.equal(game.storm, 6); assert.equal(game.stormResolution?.traversed, 3);
  assert.equal(player(game, f.owner).forces[f.location], 1, 'Future sector10 casualties wait through the fresh cost');
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function finished(state: Game, f: SemutaAdvisorStormFixture, prevented: boolean) {
  const steps: { actor: string; action: Action }[] = [], game = finish(state, steps);
  assert.equal(game.phase, 1); assert.equal(game.turn, 2); assert.equal(game.storm, f.continues ? 10 : 9);
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.pendingAutomaticAdvisorStorm, undefined);
  assert.equal(game.pendingAutomaticAdvisorFlips, undefined); assert.equal(game.stormResolution, null);
  assert.equal(game.stormMovementSource, undefined); assert.equal(game.stormPending, null);
  assert.equal(player(game, f.outsider).forces[f.outsiderLocation] ?? 0, 0);
  assert.equal(player(game, f.outsider).tanks, player(f.storm.before, f.outsider).tanks + 1,
    'The completed sector9 casualty is never applied twice');
  assert.equal(player(game, f.outsider).forces['arrakeen:10'], 10);
  assert.equal(player(game, f.owner).forces[f.location] ?? 0, f.continues ? 0 : 1);
  assert.equal(player(game, f.owner).tanks, player(f.storm.before, f.owner).tanks + Number(f.continues));
  assert.equal(isAdvisor(player(game, f.owner), f.territory), !f.continues && prevented);
  assert.equal(fighterCount(player(game, f.owner), f.territory), !f.continues && !prevented ? 1 : 0);
  if (prevented && !f.continues) assert.equal(player(game, f.owner).advisors?.[f.territory]?.aloneFlipHold, f.originalAutomaticSource.event);
  else assert.equal(player(game, f.owner).advisors?.[f.territory], undefined);
  for (const p of game.players.filter(p => ![f.owner, f.outsider].includes(p.id)))
    assert.deepEqual(physical(game).players.find(row => row.id === p.id), f.originalPhysical.players.find(row => row.id === p.id));
  assert.deepEqual(game.deck, f.originalDeck); assert.deepEqual(game.spiceDeck, f.originalSpiceDeck);
  assert.deepEqual(game.spiceDiscard, f.originalSpiceDiscard, 'No subsequent Spice reveal is consumed by this continuation');
  assert.deepEqual(game.stormDials, {}); assert.deepEqual(game.ready, []);
  const log = game.log.slice(f.game.log.length), finalText = `Storm moved ${f.distance} sectors to sector ${f.continues ? 10 : 9}.`;
  assert.equal(log.filter(row => row.text === finalText).length, 1);
  const conversion = log.findIndex(row => row.text === `${player(game, f.owner).name} changed all forces in Oh Gap to fighters.`);
  assert.equal(conversion >= 0, !prevented);
  if (!prevented) assert.ok(conversion < log.findIndex(row => row.text === finalText),
    'Allowance converts before the actual remaining traversal completes');
  assert.ok(steps.every(step => !['card', 'ship', 'move', 'stormDial'].includes(step.action.type)));
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function canceled(state: Game, f: SemutaAdvisorStormFixture, claimed: boolean) {
  const game = finished(state, f, true);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  reject(game, f.spender, f.action); return game;
}

for (const variant of variants) for (const claimed of [false, true]) void test(
  `Advanced native ${variant.continues ? 'continuing' : 'ending'} Storm advisor conversion cost Semuta ${claimed ? 'claim' : 'pass'} holds sector9 then resumes only the remaining traversal`, () => {
    const f = fixture(variant); nativeSource(f); const offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    const game = canceled(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
    reject(game, f.holder, { type: 'semutaCommit', event }); reject(game, f.holder, { type: 'semutaPass', event });
  },
);

void test('native Storm conversion allowance converts the real peaceful group before ending or continuing into its actual next-sector casualty', () => {
  for (const variant of variants) {
    const f = fixture(variant); nativeSource(f); const game = finished(allow(structuredClone(f.game)), f, false);
    assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
    assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
  }
});

void test('fresh Storm conversion cost rejects stale and underlying controls with the exact current-sector parent and surviving advisor still held', () => {
  for (const variant of variants) {
    const f = fixture(variant), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
    reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
    reject(game, f.spender, { type: 'semutaCommit', event }); reject(game, f.spender, f.action);
    reject(game, f.owner, { type: 'passResponse' }); reject(game, f.triggerActor, f.triggerAction);
    reject(game, f.owner, { type: 'prepareAdvisors', territory: f.territory });
    reject(game, f.outsider, { type: 'move', from: f.outsiderLocation, amount: 1, territory: 'imperial_basin', sector: 9 });
    assert.deepEqual(game.pendingAutomaticAdvisorStorm, f.originalParent);
    assert.deepEqual(game.stormResolution, f.originalCursor); assert.deepEqual(physical(game), f.originalPhysical);
    assert.equal(player(game, f.owner).forces[f.location], 1);
    canceled(pass(game), f, false);
  }
});

void test('all four minimal profiles legally answer native ending and continuing Storm conversion used costs', () => {
  for (const variant of variants) {
    const f = fixture(variant), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    for (const difficulty of DIFFICULTIES) {
      const own = viewGame(offered, f.holder); own.players.find(p => p.id === f.holder)!.bot = difficulty;
      const before = structuredClone(own), action = botActions(own)[0]; assert.ok(action, difficulty);
      assert.deepEqual(own, before); assert.ok(action.type === 'semutaPass' || action.type === 'semutaCommit');
      assert.equal(action.event, event);
      let game = act(structuredClone(offered), f.holder, action);
      const claimed = action.type === 'semutaCommit';
      if (game.pendingTreacheryDiscard?.reaction?.stage === 'select') {
        const selecting = viewGame(game, f.holder); selecting.players.find(p => p.id === f.holder)!.bot = difficulty;
        const selected = botActions(selecting)[0]; assert.ok(selected);
        assert.equal(selected.type, 'semutaSelect'); assert.equal(selected.card, f.cost);
        game = act(game, f.holder, selected);
      } else if (game.pendingTreacheryDiscard) game = pass(game);
      canceled(game, f, claimed);
    }
  }
});
