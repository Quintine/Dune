import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame } from '../game/engine';
import { ownedTech, TECH_TOKENS } from '../game/tech-tokens';
import { STRONGHOLD_CARDS } from '../game/stronghold-cards';
import {
  actAssassinateTarget as act, advanceAssassinateTarget as advance,
  assassinateTargetInventory as inventory, assassinateTargetPlayer as player,
  assassinateTargetTraitors as traitors, createMoritaniAssassinateTargetFixture as fixture,
  finishMoritaniAssassinateTarget as finish, type AssassinateTargetStep,
} from './fixture-moritani-assassinate-target';

const cases = [
  { label: 'Tech', techTokens: true, strongholds: false, execute: false },
  { label: 'Strongholds', techTokens: false, strongholds: true, execute: false },
  { label: 'Tech and Strongholds', techTokens: true, strongholds: true, execute: false },
  { label: 'Tech and Strongholds with actual Execute', techTokens: true, strongholds: true, execute: true },
] as const;

for (const selected of cases) {
  void test(`native Advanced Harkonnen/Moritani ${selected.label} keeps original capture, assassination and phase-module rewards`, () => {
    const f = fixture(selected);
    assert.equal(f.initial.status, 'lobby');
    assert.equal(!!f.initial.techTokens, false); assert.equal(!!f.initial.strongholdCards, false);
    assert.equal(f.moduleSelections.length, Number(selected.techTokens) + Number(selected.strongholds));
    for (const selection of f.moduleSelections) {
      assert.equal(selection.before.status, 'lobby'); assert.equal(selection.after.status, 'lobby');
      assert.ok(selection.before.players.every(seat => !seat.hand.length && !seat.ready));
      assert.equal(selection.steps.length, 1); assert.equal(selection.steps[0].actor, f.initial.host);
      assert.ok(['techTokens', 'strongholdCards'].includes(selection.steps[0].action.type));
      assert.equal(selection.steps[0].action.enabled, true);
    }
    assert.ok(f.actions.some(step => step.action.type === 'start' && step.action.advancedPreview === true));
    assert.equal(f.setup.status, 'setup'); assert.ok(f.setup.moritaniAssassinate);
    assert.deepEqual(f.setup.players.map(seat => seat.faction), ['harkonnen', 'emperor', 'moritani']);
    assert.equal(!!f.setup.techTokens, selected.techTokens);
    assert.equal(!!f.setup.strongholdCards, selected.strongholds);
    assert.ok(!f.game.homeworlds && !f.game.leaderSkills && !f.game.nexusCards &&
      !f.game.discoveryEnabled && !f.game.semutaPreview && !f.game.ecazTreachery);
    assert.equal(f.originalInventory.length, 33);
    assert.deepEqual(inventory(f.game), f.originalInventory); assert.deepEqual(traitors(f.game), f.originalTraitors);
    assert.equal(f.sourceActionCount, f.actions.length);

    assert.equal(f.shipment.steps[0].actor, f.opponent);
    assert.equal(f.shipment.steps[0].action.type, 'ship');
    assert.equal(player(f.shipment.before, f.opponent).spice - player(f.shipment.after, f.opponent).spice, 2);
    assert.equal(player(f.movement.after, f.opponent).forces['carthag:11'], 1);
    assert.equal(player(f.movement.after, f.opponent).forces['imperial_basin:11'], 1);
    assert.equal(f.beforeCaptureChoice.decision?.kind, 'capturedLeader');
    assert.ok(f.capture.steps.some(step => step.action.type === 'decision' && step.action.accept === true));
    assert.equal(f.captureChoiceStep.action.mode, selected.execute ? 'execute' : 'keep');
    const captured = player(f.afterCapture, f.opponent).leaders.find(disc => disc.id === f.target)!;
    assert.ok(captured.concealed);
    assert.equal(captured.dead, selected.execute);
    assert.equal(captured.capturedBy, selected.execute ? undefined : f.captor);

    const emperorToken = selected.techTokens ? ownedTech(f.beforeFirstBattle.techTokens, f.opponent) : [];
    const moritaniToken = selected.techTokens ? ownedTech(f.beforeSecondBattle.techTokens, f.owner) : [];
    if (selected.techTokens) {
      assert.equal(emperorToken.length, 1); assert.equal(moritaniToken.length, 1);
      assert.equal(new Set(TECH_TOKENS.map(token => f.beforeFirstBattle.techTokens![token.id].owner)).size, 3,
        'The real first Storm assigns one original token to each original seat');
      assert.equal(f.afterCapture.techTokens![emperorToken[0]].owner, f.captor,
        'The first real Harkonnen win earns the Emperor token through original cleanup');
      assert.equal(f.game.techTokens![moritaniToken[0]].owner, f.owner,
        'The later winner reward waits for this actual assassination opportunity');
    }
    if (selected.strongholds) {
      assert.equal(f.setup.strongholdCards?.claimedTurn, 0);
      assert.equal(Object.keys(f.setup.strongholdCards!.owners).length, STRONGHOLD_CARDS.length);
      assert.ok(Object.values(f.game.strongholdCards!.owners).every(owner => owner === null),
        'No Stronghold advantage is assigned before the first actual END Mentat');
    }

    const pending = viewGame(f.game, f.owner).moritaniAssassinate?.pending; assert.ok(pending);
    assert.ok(pending.cards.some(choice => choice.card === f.target));
    assert.equal(f.receipt.opposingLeader, 'emperor-0'); assert.notEqual(f.target, f.receipt.opposingLeader);
    const targetBefore = structuredClone(player(f.game, f.opponent).leaders.find(disc => disc.id === f.target)!);
    const money = player(f.game, f.owner).spice;
    let game = act(f.game, f.owner, f.reveal);
    const killed = player(game, f.opponent).leaders.find(disc => disc.id === f.target)!;
    assert.equal(killed.dead, true);
    assert.equal(killed.deaths, targetBefore.deaths + Number(!selected.execute));
    assert.equal(killed.capturedBy, undefined); assert.equal(killed.concealed, undefined);
    assert.equal(killed.faction, 'emperor'); assert.equal(killed.strength, targetBefore.strength);
    assert.equal(killed.controller, targetBefore.controller); assert.equal(killed.gholaBy, targetBefore.gholaBy);
    assert.equal(player(game, f.owner).spice, money + (selected.execute ? 0 : f.potentialBounty));
    assert.equal(game.moritaniAssassinate!.opportunities.at(-1)!.bounty, selected.execute ? 0 : f.potentialBounty);

    const continuation: AssassinateTargetStep[] = [];
    game = finish(game, f, continuation);
    const receipt = game.moritaniAssassinate!.opportunities.find(r => r.event === f.event)!;
    assert.equal(receipt.stage, 'replaced'); assert.ok(receipt.replacement && receipt.replacement !== f.target);
    assert.equal(player(game, f.owner).traitors.includes(f.target), false);
    assert.ok(player(game, f.owner).traitors.includes(receipt.replacement));
    assert.deepEqual(traitors(game), f.originalTraitors); assert.deepEqual(inventory(game), f.originalInventory);
    if (selected.techTokens) {
      assert.equal(game.techTokens![emperorToken[0]].owner, f.captor);
      assert.equal(game.techTokens![moritaniToken[0]].owner, f.opponent,
        'The surviving native Emperor winner receives the original Moritani token once');
      assert.equal(ownedTech(game.techTokens, f.captor).length, 2);
      assert.equal(ownedTech(game.techTokens, f.opponent).length, 1);
      assert.equal(ownedTech(game.techTokens, f.owner).length, 0);
    }
    game = advance(game, state => state.turn === 2 && state.phase === 0, continuation);
    if (selected.strongholds) {
      assert.equal(game.strongholdCards!.claimedTurn, 1);
      assert.equal(game.strongholdCards!.owners.carthag, f.captor,
        'The actual first END Mentat awards the city still physically held after the native capture');
      assert.ok(Object.entries(game.strongholdCards!.owners).every(([id, owner]) => id === 'carthag' || owner === null));
    }
    assert.ok(continuation.some(step => step.action.type === 'ready'));
    assert.deepEqual(inventory(game), f.originalInventory); assert.deepEqual(traitors(game), f.originalTraitors);
    const finalTarget = player(game, f.opponent).leaders.find(disc => disc.id === f.target)!;
    assert.equal(finalTarget.deaths, killed.deaths);
    assert.equal(finalTarget.capturedBy, undefined); assert.equal(finalTarget.concealed, undefined);
  });
}
