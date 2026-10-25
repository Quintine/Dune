import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { isAdvisor } from '../game/advisors';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createSemutaAdvisorRelocationFixture as fixture, actSemutaAdvisorRelocation as act,
  passSemutaAdvisorRelocation as pass, claimSemutaAdvisorRelocation as claim,
  allowSemutaAdvisorRelocation as allow, finishSemutaAdvisorRelocation as finish,
  semutaAdvisorRelocationPlayer as player, semutaAdvisorRelocationInventory as inventory,
  semutaAdvisorRelocationPhysical as physical, type SemutaAdvisorRelocationFixture,
} from './fixture-semuta-advisor-relocation';

const relocationLogs = (game: Game, f: SemutaAdvisorRelocationFixture) => game.log.filter(row => f.kind === 'ambassador'
  ? row.automatic?.name === 'Fremen Ambassador relocation'
  : row.text.includes('This one-time Discovery entry spends no spice or normal movement.')).length;
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaAdvisorRelocationFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, true); assert.equal(f.setup.semutaPreview, true);
  assert.ok(f.beforeStartingDeal.players.every(player => player.hand.length === 0));
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.ok(f.advisorSetup); assert.ok(f.actions.some(step => step.actor === f.owner && step.action.type === 'predict'));
  assert.equal(f.acquisition.price, 1);
  assert.ok(f.acquisition.steps.some(step => step.actor === f.holder && step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquisition.after, f.holder).spice, 1);
  assert.equal(player(f.acquisition.after, f.richese).spice - player(f.acquisition.before, f.richese).spice, 1);
  if (f.kind === 'ambassador') {
    assert.deepEqual(f.game.players.map(player => player.faction), ['richese', 'choam', 'ecaz', 'beneGesserit', 'atreides']);
    assert.deepEqual(f.setup.expansions, ['choam', 'ecaz']); assert.ok(!f.setup.discoveryEnabled);
    assert.ok(f.packet && f.packetCreation && f.placement && f.trigger && f.originalAmbassador && f.originalAmbassadorToken);
    assert.equal(f.packet.scalars.length, 9);
    assert.deepEqual(f.packetCreation.after.ecazAmbassadors!.cohort.map(id =>
      f.packetCreation!.after.ecazAmbassadors!.tokens.find(token => token.id === id)!.effect), f.packet.supply);
    assert.equal(player(f.afterSetup, f.mover).forces[f.from], 6);
    assert.equal(isAdvisor(player(f.afterSetup, f.owner), f.origin), true);
    assert.equal(player(f.placement.before, f.mover).spice - player(f.placement.after, f.mover).spice, 1);
    assert.equal(f.originalAmbassador.effect, 'fremen'); assert.equal(f.originalAmbassador.beneficiary, f.mover);
    assert.equal(f.originalAmbassador.relocation?.next, 'flip');
    assert.equal(f.originalAmbassadorToken.effect, 'fremen'); assert.equal(f.originalAmbassadorToken.zone, 'used');
    assert.equal(f.originalDiscoveryEntry, null);
  } else {
    assert.deepEqual(f.game.players.map(player => player.faction), ['richese', 'choam', 'beneGesserit', 'atreides', 'emperor']);
    assert.deepEqual(f.setup.expansions, ['choam']); assert.equal(f.setup.discoveryEnabled, true);
    assert.ok(f.configured.discoveryEnabled && f.tokenPlacement && f.intrusion && f.revelation && f.originalDiscoveryEntry);
    assert.equal(isAdvisor(player(f.afterSetup, f.owner), f.origin), false);
    assert.equal(player(f.shipment.before, f.atreides).spice - player(f.intrusion.after, f.atreides).spice, 2);
    assert.equal(isAdvisor(player(f.intrusion.after, f.owner), f.origin), true);
    assert.deepEqual(f.revelation.steps.map(step => step.action), [
      { type: 'discovery', token: f.token, reveal: false }, { type: 'discovery', token: f.token, reveal: true },
    ]);
    assert.equal(f.game.turn, 2); assert.equal(f.game.phase, 0);
    assert.equal(f.originalDiscoveryEntry.stage, 'arrival');
    assert.equal(f.originalDiscoveryEntry.arrival?.owner, f.mover);
    assert.deepEqual(f.originalDiscoveryEntry.arrival?.groups, [{ source: f.from, normal: 1, elite: 0 }]);
    assert.equal(f.originalAmbassador, null); assert.equal(f.originalDiscoveryToken?.status, 'placed');
    assert.equal(f.originalDiscoveryToken?.revealedTurn, f.revelation.after.turn);
  }
  assert.deepEqual(f.relocation.steps, [{ actor: f.mover, action: f.nativeAction }]);
  assert.equal(player(f.game, f.mover).forces[f.from], undefined);
  assert.equal(player(f.game, f.mover).forces[f.to], (player(f.beforeDeclaration, f.mover).forces[f.to] ?? 0) + f.amount);
  assert.deepEqual(f.game.response, f.originalResponse);
  assert.ok(f.originalAutomaticSource.producer === 'specialRelocation');
  assert.equal(f.originalAutomaticSource.relocation.kind, f.kind);
  assert.equal(f.originalAutomaticSource.relocation.player, f.mover);
  assert.equal(f.originalAutomaticSource.relocation.origin, f.origin);
  assert.equal(f.originalAutomaticSource.relocation.destination, f.destination);
  assert.deepEqual(f.originalQueue, [f.originalAutomaticSource]);
  assert.equal(f.originalHeldStance.aloneFlipHold, f.originalAutomaticSource.event);
  assert.equal(isAdvisor(player(f.game, f.owner), f.origin), true);
  assert.equal(relocationLogs(f.game, f) - relocationLogs(f.beforeDeclaration, f), 1);
  assert.deepEqual(physical(f.game), f.originalPhysical);
  assert.equal(f.sourceActionCount, f.actions.length); assert.deepEqual(inventory(f.game), f.originalInventory);
}
function open(f: SemutaAdvisorRelocationFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, 'karamaAdvisorFlipDiscard');
  assert.equal(pending.reaction?.stage, 'offer'); assert.equal(pending.batch.cause, 'karama:advisorFlip');
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, face: entry.publicFace })),
    [{ card: f.cost, by: f.spender, face: true }]);
  if (pending.continuation.kind !== 'karamaAdvisorFlipDiscard') throw Error('Use the original native advisor-flip cost');
  assert.deepEqual(pending.continuation.use.response, f.originalResponse);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.deepEqual(game.pendingAutomaticAdvisorRelocation, f.originalParent);
  assert.deepEqual(game.pendingAutomaticAdvisorFlips, f.originalQueue);
  assert.deepEqual(game.pendingAmbassador ?? null, f.originalAmbassador);
  assert.deepEqual(game.discoveryEntry ?? null, f.originalDiscoveryEntry);
  assert.deepEqual(player(game, f.owner).advisors?.[f.origin], f.originalHeldStance);
  assert.deepEqual(physical(game), f.originalPhysical);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function settled(game: Game, f: SemutaAdvisorRelocationFixture, canceled: boolean) {
  game = finish(game);
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.pendingKarama ?? null, null);
  assert.equal(game.pendingAutomaticAdvisorRelocation, undefined); assert.equal(game.pendingAutomaticAdvisorFlips, undefined);
  assert.equal(game.pendingAmbassador ?? null, null); assert.equal(game.discoveryEntry, undefined);
  assert.equal(game.response?.automaticAdvisorFlip, undefined);
  assert.deepEqual(physical(game), f.originalPhysical);
  assert.equal(isAdvisor(player(game, f.owner), f.origin), canceled);
  if (canceled) assert.deepEqual(player(game, f.owner).advisors?.[f.origin], f.originalHeldStance);
  else assert.equal(player(game, f.owner).advisors?.[f.origin], undefined);
  if (f.kind === 'ambassador')
    assert.deepEqual(game.ecazAmbassadors!.tokens.find(token => token.id === f.token), f.originalAmbassadorToken);
  else {
    assert.deepEqual(game.discoveries!.tokens.find(token => token.id === f.token), f.originalDiscoveryToken);
    assert.deepEqual(game.discoveries!.newlyRevealed, []);
  }
  assert.equal(relocationLogs(game, f), relocationLogs(f.game, f));
  assert.deepEqual(inventory(game), f.originalInventory); return game;
}
function prevented(game: Game, f: SemutaAdvisorRelocationFixture, claimed: boolean) {
  game = settled(game, f, true);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed)); return game;
}

for (const kind of ['ambassador', 'discovery'] as const) for (const claimed of [false, true]) void test(
  `Advanced native ${kind} relocation advisor conversion used cancellation cost ${claimed ? 'claim' : 'pass'} retains the completed transfer and resumes its original child once`, () => {
    const f = fixture({ kind }); nativeSource(f);
    const offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    const game = prevented(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
    reject(game, f.holder, { type: 'semutaCommit', event }); reject(game, f.holder, { type: 'semutaPass', event });
    const before = structuredClone(game); assert.equal(finish(game), game); assert.deepEqual(game, before);
  });

for (const kind of ['ambassador', 'discovery'] as const) void test(
  `Advanced native ${kind} relocation advisor conversion allowance flips only the stranded group after the original transfer`, () => {
    const f = fixture({ kind }); nativeSource(f);
    const game = settled(allow(structuredClone(f.game)), f, false);
    assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
    assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
  });

for (const kind of ['ambassador', 'discovery'] as const) void test(
  `fresh ${kind} relocation conversion costs reject stale and underlying controls while the original child stays parked`, () => {
    const f = fixture({ kind }), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
    reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
    reject(game, f.spender, { type: 'semutaCommit', event });
    reject(game, f.spender, f.action); reject(game, f.owner, { type: 'passResponse' });
    reject(game, f.mover, f.nativeAction);
    assert.deepEqual(game.pendingAutomaticAdvisorRelocation, f.originalParent);
    assert.deepEqual(game.pendingAmbassador ?? null, f.originalAmbassador);
    assert.deepEqual(game.discoveryEntry ?? null, f.originalDiscoveryEntry);
    assert.deepEqual(physical(game), f.originalPhysical); prevented(pass(game), f, false);
  });

void test('changed original relocation evidence rejects before cost and before a fresh Semuta answer', () => {
  for (const kind of ['ambassador', 'discovery'] as const) {
    const f = fixture({ kind }), beforeCost = structuredClone(f.game);
    assert.ok(beforeCost.pendingAutomaticAdvisorRelocation);
    beforeCost.pendingAutomaticAdvisorRelocation.signature = 'different-original-relocation';
    reject(beforeCost, f.spender, f.action);
    assert.ok(player(beforeCost, f.spender).hand.some(card => card.id === f.cost));
    assert.equal(beforeCost.discard.some(card => card.id === f.cost), false);
    const afterCost = open(f); assert.ok(afterCost.pendingAutomaticAdvisorRelocation);
    afterCost.pendingAutomaticAdvisorRelocation.signature = 'different-original-relocation';
    reject(afterCost, f.holder, { type: 'semutaCommit', event: afterCost.pendingTreacheryDiscard!.batch.event });
  }
});

void test('all four minimal policies answer both actual native relocation conversion costs legally', () => {
  for (const kind of ['ambassador', 'discovery'] as const) {
    const f = fixture({ kind }), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    for (const difficulty of DIFFICULTIES) {
      const own = viewGame(offered, f.holder); own.players.find(player => player.id === f.holder)!.bot = difficulty;
      const before = structuredClone(own), action = botActions(own)[0]; assert.ok(action, difficulty);
      assert.deepEqual(own, before);
      assert.ok(action.type === 'semutaCommit' || action.type === 'semutaPass'); assert.equal(action.event, event);
      let game = act(structuredClone(offered), f.holder, action);
      const claimed = action.type === 'semutaCommit';
      if (game.pendingTreacheryDiscard?.reaction?.stage === 'select') {
        const choosing = viewGame(game, f.holder); choosing.players.find(player => player.id === f.holder)!.bot = difficulty;
        const selected = botActions(choosing)[0]; assert.ok(selected);
        assert.equal(selected.type, 'semutaSelect'); assert.equal(selected.card, f.cost);
        game = act(game, f.holder, selected);
      } else if (game.pendingTreacheryDiscard) game = pass(game);
      prevented(game, f, claimed);
    }
  }
});
