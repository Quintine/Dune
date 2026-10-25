import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { isAdvisor } from '../game/advisors';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createSemutaAdvisorGatherFixture as fixture, actSemutaAdvisorGather as act,
  passSemutaAdvisorGather as pass, claimSemutaAdvisorGather as claim,
  allowSemutaAdvisorGather as allow, finishSemutaAdvisorGather as finish,
  semutaAdvisorGatherPlayer as player, semutaAdvisorGatherInventory as inventory,
  semutaAdvisorGatherPhysical as physical, semutaAdvisorGatherSkillInventory as skills,
  type SemutaAdvisorGatherFixture,
} from './fixture-semuta-advisor-gather';

function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function nativeSource(f: SemutaAdvisorGatherFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, true); assert.equal(f.setup.semutaPreview, true);
  assert.deepEqual(f.setup.expansions, ['choam']); assert.ok(f.setup.leaderSkills);
  assert.ok(f.beforeStartingDeal.players.every(player => player.hand.length === 0));
  assert.deepEqual(f.game.players.map(player => player.faction), ['richese', 'choam', 'beneGesserit', 'atreides', 'emperor']);
  assert.equal(f.skillChoices.length, 5); assert.ok(f.skillOffers && f.advisorSetup);
  assert.ok(f.skillChoices.some(choice => choice.steps.some(step => step.actor === f.owner && step.action.type === 'leaderSkill' &&
    step.action.skill === f.skill && step.action.leader === f.trainer)));
  assert.ok(player(f.afterSetup, f.spender).hand.some(card => card.id === f.cost && card.effect === 'karama'));
  assert.equal(player(f.afterSetup, f.owner).forces[f.location], 1);
  assert.equal(player(f.afterSetup, f.spender).forces[f.location], 10);
  assert.equal(isAdvisor(player(f.afterSetup, f.owner), f.territory), true);
  assert.equal(f.acquisition.price, 1);
  assert.ok(f.acquisition.steps.some(step => step.actor === f.holder && step.action.type === 'richeseBid' && step.action.amount === 1));
  assert.equal(player(f.acquisition.before, f.holder).spice - player(f.acquisition.after, f.holder).spice, 1);
  assert.equal(player(f.acquisition.after, f.richese).spice - player(f.acquisition.before, f.richese).spice, 1);
  assert.deepEqual(f.funding.steps, [{ actor: f.emperor, action: f.fundingAction }]);
  assert.equal(player(f.firstShipment.before, f.owner).spice - player(f.firstShipment.after, f.owner).spice, 4);
  assert.equal(player(f.secondShipment.before, f.owner).spice - player(f.secondShipment.after, f.owner).spice, 2);
  assert.equal(f.game.turn, 2); assert.equal(f.game.phase, 5); assert.equal(f.game.active, f.owner);
  assert.equal(player(f.game, f.owner).shipped, true); assert.equal(player(f.game, f.owner).moved, 0);
  assert.equal(player(f.game, f.owner).forces['imperial_basin:9'], 2);
  assert.equal(player(f.game, f.owner).forces['oh_gap:9'], 1);
  assert.equal(isAdvisor(player(f.game, f.owner), 'imperial_basin'), false);
  assert.equal(isAdvisor(player(f.game, f.owner), 'oh_gap'), false);
  assert.deepEqual(f.declaration.steps, [{ actor: f.owner, action: f.nativeAction }]);
  assert.deepEqual(f.originalParent.receipts.map(source => source.origin), ['imperial_basin', 'oh_gap']);
  assert.equal(f.originalParent.index, f.position === 'first' ? 0 : 1);
  assert.deepEqual(f.originalParent.approved, f.position === 'first' ? [] : [f.firstSource.event]);
  assert.equal(f.originalSource.origin, f.position === 'first' ? 'imperial_basin' : 'oh_gap');
  assert.deepEqual(f.originalParent.receipts[f.originalParent.index], f.originalSource);
  assert.deepEqual(f.game.response, f.originalResponse);
  assert.equal(f.originalResponse.advisorGatherMatchingPosition?.current, f.position === 'first' ? 1 : 2);
  assert.equal(f.originalResponse.advisorGatherMatchingPosition?.total, 2);
  if (f.position === 'second') {
    assert.ok(f.firstAllowance);
    const response = f.firstAllowance.before.response; assert.ok(response);
    const passers = f.firstAllowance.steps.map(step => step.actor);
    assert.ok(passers.length > 0); assert.equal(new Set(passers).size, passers.length);
    assert.ok(passers.every(actor => f.firstAllowance!.before.players.some(player => player.id === actor)));
    assert.ok(f.firstAllowance.steps.every(step => step.action.type === 'passResponse'));
    assert.deepEqual(physical(f.firstAllowance.before), physical(f.firstAllowance.after));
  } else assert.equal(f.firstAllowance, null);
  assert.deepEqual(physical(f.game), f.originalPhysical);
  assert.deepEqual(physical(f.beforeDeclaration), f.originalPhysical);
  assert.equal(f.sourceActionCount, f.actions.length); assert.deepEqual(inventory(f.game), f.originalInventory);
  assert.deepEqual(skills(f.game), f.originalSkillInventory);
}
function open(f: SemutaAdvisorGatherFixture) {
  const game = act(structuredClone(f.game), f.spender, f.action), pending = game.pendingTreacheryDiscard;
  assert.ok(pending); assert.equal(pending.continuation.kind, 'karamaAdvisorFlipDiscard');
  assert.equal(pending.reaction?.stage, 'offer'); assert.equal(pending.batch.cause, 'karama:advisorFlip');
  assert.deepEqual(pending.batch.entries.map(entry => ({ card: entry.card.id, by: entry.discardedBy, face: entry.publicFace })),
    [{ card: f.cost, by: f.spender, face: true }]);
  if (pending.continuation.kind !== 'karamaAdvisorFlipDiscard') throw Error('Use the original native advisor-flip cost');
  assert.deepEqual(pending.continuation.use.response, f.originalResponse);
  assert.deepEqual(pending.continuation.resume.response, f.originalResponse);
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.deepEqual(game.pendingAdvisorGatherMatching, f.originalParent);
  assert.deepEqual(physical(game), f.originalPhysical);
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(game.discard.filter(card => card.id === f.cost).length, 1);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.deepEqual(inventory(game), f.originalInventory); assert.deepEqual(skills(game), f.originalSkillInventory); return game;
}
function prevented(game: Game, f: SemutaAdvisorGatherFixture, claimed: boolean) {
  game = finish(game);
  assert.equal(game.pendingAdvisorGatherMatching, undefined);
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.pendingKarama ?? null, null);
  assert.deepEqual(physical(game), f.originalPhysical);
  assert.deepEqual(game.advisorMatchingDenied, [...f.originalDenials, f.expectedDenial]);
  assert.equal(player(game, f.owner).advisorFlipMovementBlocked, undefined);
  assert.equal(game.log.filter(row => row.automatic?.name === 'Gathered group matching prevented').length,
    f.originalHistory.filter(row => row.automatic?.name === 'Gathered group matching prevented').length + 1);
  reject(game, f.owner, f.nativeAction);
  reject(game, f.owner, { ...f.nativeAction, forces: Object.fromEntries(Object.entries(f.forces).reverse()) });
  reject(game, f.owner, { type: 'move', forces: f.originalSource.group, territory: f.territory, sector: 10 });
  assert.equal(player(game, f.spender).hand.some(card => card.id === f.cost), false);
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.cost).length, Number(claimed));
  assert.equal(game.discard.filter(card => card.id === f.cost).length, Number(!claimed));
  assert.equal(player(game, f.holder).hand.filter(card => card.id === f.semuta).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(claimed));
  assert.deepEqual(inventory(game), f.originalInventory); assert.deepEqual(skills(game), f.originalSkillInventory); return game;
}
function replaceOriginalMove(game: Game, f: SemutaAdvisorGatherFixture) {
  const before = structuredClone(physical(game)), wallet = player(game, f.owner).spice;
  const result = finish(act(game, f.owner, f.replacement));
  assert.equal(player(result, f.owner).moved, 1); assert.equal(player(result, f.owner).shipped, true);
  assert.equal(player(result, f.owner).spice, wallet);
  assert.equal(player(result, f.owner).forces['imperial_basin:9'], 1);
  assert.equal(player(result, f.owner).forces['oh_gap:9'], 2);
  assert.equal(player(result, f.owner).forces[f.location], 1);
  assert.equal(isAdvisor(player(result, f.owner), f.territory), true);
  assert.deepEqual(result.players.filter(player => player.id !== f.owner).map(player =>
    ({ id: player.id, spice: player.spice, forces: player.forces, reserves: player.reserves })),
  before.players.filter(player => player.id !== f.owner).map(player =>
    ({ id: player.id, spice: player.spice, forces: player.forces, reserves: player.reserves })));
  assert.deepEqual(inventory(result), f.originalInventory); assert.deepEqual(skills(result), f.originalSkillInventory); return result;
}

for (const position of ['first', 'second'] as const) for (const claimed of [false, true]) void test(
  `Advanced native ${position} gather matching used cancellation cost ${claimed ? 'claim' : 'pass'} preserves both origins and permits one legal replacement`, () => {
    const f = fixture({ position }); nativeSource(f);
    const offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
    const game = prevented(claimed ? claim(offered, f.holder) : pass(offered), f, claimed);
    reject(game, f.holder, { type: 'semutaCommit', event }); reject(game, f.holder, { type: 'semutaPass', event });
    replaceOriginalMove(game, f);
  });

for (const position of ['first', 'second'] as const) void test(
  `Advanced native ${position} gather matching allowance commits the original two-origin packet once after every group approval`, () => {
    const f = fixture({ position }); nativeSource(f);
    const game = allow(structuredClone(f.game));
    assert.equal(game.pendingAdvisorGatherMatching, undefined); assert.equal(player(game, f.owner).moved, 1);
    assert.equal(player(game, f.owner).forces[f.location], 3);
    assert.equal(player(game, f.owner).forces['imperial_basin:9'], 1);
    assert.equal(player(game, f.owner).forces['oh_gap:9'] ?? 0, 0);
    assert.equal(isAdvisor(player(game, f.owner), f.territory), true);
    assert.equal(player(game, f.owner).spice, player(f.game, f.owner).spice);
    assert.equal(player(game, f.owner).shipped, true);
    assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
    assert.ok(player(game, f.holder).hand.some(card => card.id === f.semuta));
    assert.deepEqual(inventory(game), f.originalInventory); assert.deepEqual(skills(game), f.originalSkillInventory);
    const before = structuredClone(game); assert.equal(finish(game), game); assert.deepEqual(game, before);
  });

for (const position of ['first', 'second'] as const) void test(
  `fresh ${position} gather matching costs reject stale and underlying controls while original approvals stay parked`, () => {
    const f = fixture({ position }), game = open(f), event = game.pendingTreacheryDiscard!.batch.event;
    reject(game, f.holder, { type: 'semutaCommit', event: `${event}:stale` });
    reject(game, f.spender, { type: 'semutaCommit', event });
    reject(game, f.spender, f.action); reject(game, f.owner, { type: 'passResponse' });
    reject(game, f.owner, f.nativeAction); reject(game, f.owner, f.replacement);
    reject(game, f.owner, { type: 'endMovement' });
    assert.deepEqual(game.pendingAdvisorGatherMatching, f.originalParent);
    assert.deepEqual(physical(game), f.originalPhysical); prevented(pass(game), f, false);
  });

void test('unearned gather approval or changed original signature rejects before cost and before a fresh Semuta answer', () => {
  const f = fixture({ position: 'second' });
  for (const change of ['signature', 'approval'] as const) {
    const game = structuredClone(f.game); assert.ok(game.pendingAdvisorGatherMatching);
    if (change === 'signature') game.pendingAdvisorGatherMatching.signature += ':changed';
    else game.pendingAdvisorGatherMatching.approved[0] = 'unearned';
    reject(game, f.spender, f.action);
    assert.ok(player(game, f.spender).hand.some(card => card.id === f.cost));
  }
  const offered = open(f); assert.ok(offered.pendingAdvisorGatherMatching);
  offered.pendingAdvisorGatherMatching.approved[0] = 'unearned';
  reject(offered, f.holder, { type: 'semutaCommit', event: offered.pendingTreacheryDiscard!.batch.event });
});

void test('all four minimal policies answer both actual native gather matching costs legally', () => {
  for (const position of ['first', 'second'] as const) {
    const f = fixture({ position }), offered = open(f), event = offered.pendingTreacheryDiscard!.batch.event;
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
      replaceOriginalMove(prevented(game, f, claimed), f);
    }
  }
});
