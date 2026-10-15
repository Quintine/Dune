import assert from 'node:assert/strict';
import test from 'node:test';
import { leaders } from '../game/cards';
import { CHOAM_AUDITOR_ID } from '../game/choam-auditor';
import { applyAction, viewGame } from '../game/engine';
import {
  assertMixedE3MoritaniPhysical, mixedE3MoritaniPlayer,
  mixedE3MoritaniTraitorCustody, quoteMixedE3MoritaniBattle,
} from './fixture-mixed-e3-moritani-nexus';
import {
  createMoritaniAuditorWinnerFixture, finishMoritaniAuditorReplacement,
  pendingMoritaniAuditorAssassination, revealMoritaniAuditorTarget, revealMoritaniAuditorWinner,
} from './fixture-moritani-auditor-winner';

void test('an original surviving Auditor2 win opens native CHOAM assassination, printed bounty and distinct original Mentat replacement', () => {
  const f = createMoritaniAuditorWinnerFixture();
  const printedTarget = leaders('choam').find(l => l.id === f.target);
  assert.ok(printedTarget);
  assertMixedE3MoritaniPhysical(f.readyBattle);

  const revealed = revealMoritaniAuditorWinner(f);
  assert.equal(revealed.battle!.plans[f.native].leader, CHOAM_AUDITOR_ID);
  assert.equal(revealed.battle!.plans[f.native].dial, 0);
  assert.equal(quoteMixedE3MoritaniBattle(revealed).winner, f.native);
  const pending = pendingMoritaniAuditorAssassination(f, revealed);
  assert.equal(pending.lastBattleContext!.winner, f.native);
  assert.equal(pending.lastBattleContext!.result, 'normal');
  assert.equal(pending.moritaniAssassinate!.normalTraitorCall, false);
  assert.equal(mixedE3MoritaniPlayer(pending, f.native).leaders.find(l => l.id === CHOAM_AUDITOR_ID)?.dead, false);
  const receipt = pending.moritaniAssassinate!.opportunities.at(-1)!;
  assert.equal(receipt.faction, 'choam');
  assert.equal(receipt.opponent, f.native);
  assert.equal(receipt.opposingLeader, CHOAM_AUDITOR_ID);
  const ownChoice = viewGame(pending, f.moritani).moritaniAssassinate!.pending;
  assert.ok(ownChoice, 'The actual owner receives the real private opportunity.');
  assert.equal(ownChoice.blocked, null);
  assert.deepEqual(ownChoice.cards.map(c => c.card), [f.target]);
  assert.equal(ownChoice.cards[0].bounty, printedTarget.strength);
  assert.deepEqual(viewGame(pending, f.native).moritaniAssassinate!.pending!.cards, []);

  const targetBefore = mixedE3MoritaniPlayer(pending, f.native).leaders.find(l => l.id === f.target)!;
  assert.equal(targetBefore.dead, false);
  const beforeSpice = mixedE3MoritaniPlayer(pending, f.moritani).spice;
  const enemySpice = mixedE3MoritaniPlayer(pending, f.native).spice;
  const reveal = revealMoritaniAuditorTarget(f, pending);
  const killed = mixedE3MoritaniPlayer(reveal.after, f.native).leaders.find(l => l.id === f.target)!;
  assert.equal(killed.dead, true);
  assert.equal(killed.deaths, targetBefore.deaths + 1);
  assert.equal(mixedE3MoritaniPlayer(reveal.after, f.moritani).spice, beforeSpice + printedTarget.strength,
    'The native target pays its printed bounty, not Auditor2.');
  assert.equal(mixedE3MoritaniPlayer(reveal.after, f.native).spice, enemySpice);
  assert.ok(mixedE3MoritaniPlayer(reveal.after, f.moritani).traitors.includes(f.target),
    'The revealed original physical Traitor stays held until Mentat.');

  const nextPhysical = reveal.after.traitorReserve!.find(card => card !== f.target);
  assert.ok(nextPhysical);
  const replaced = finishMoritaniAuditorReplacement(f, reveal.after);
  assert.equal(replaced.phase, 8);
  assert.equal(replaced.turn, pending.turn);
  assert.equal(mixedE3MoritaniPlayer(replaced, f.native).leaders.find(l => l.id === CHOAM_AUDITOR_ID)?.dead, false);
  assert.equal(mixedE3MoritaniPlayer(replaced, f.native).forces[f.location], 1,
    'The genuinely shipped CHOAM force survives the zero-dial win.');
  const completed = replaced.moritaniAssassinate!.opportunities.filter(r => r.event === receipt.event);
  assert.equal(completed.length, 1);
  assert.equal(completed[0].stage, 'replaced');
  assert.equal(completed[0].card, f.target);
  assert.equal(completed[0].bounty, printedTarget.strength);
  assert.equal(completed[0].replacement, nextPhysical);
  assert.notEqual(completed[0].replacement, f.target);
  assert.equal(mixedE3MoritaniPlayer(replaced, f.moritani).traitors.includes(f.target), false);
  assert.ok(mixedE3MoritaniPlayer(replaced, f.moritani).traitors.includes(nextPhysical));
  assert.equal(replaced.traitorReserve!.length, reveal.after.traitorReserve!.length - 1);
  assert.equal(replaced.traitorReserve!.includes(f.target), false);
  assert.deepEqual(mixedE3MoritaniTraitorCustody(replaced), mixedE3MoritaniTraitorCustody(f.afterSetup));
  assertMixedE3MoritaniPhysical(replaced);
});

void test('a different surviving CHOAM disc permits the actual Auditor Traitor target for printed two and original replacement', () => {
  const f = createMoritaniAuditorWinnerFixture({ auditorTarget: true });
  const pending = pendingMoritaniAuditorAssassination(f);
  const own = viewGame(pending, f.moritani).moritaniAssassinate!.pending!;
  assert.deepEqual(own.cards.map(c => ({ card: c.card, bounty: c.bounty })), [
    { card: CHOAM_AUDITOR_ID, bounty: 2 },
  ]);
  const beforeSpice = mixedE3MoritaniPlayer(pending, f.moritani).spice;
  const reveal = revealMoritaniAuditorTarget(f, pending);
  const auditor = mixedE3MoritaniPlayer(reveal.after, f.native).leaders.find(l => l.id === CHOAM_AUDITOR_ID)!;
  assert.equal(auditor.dead, true);
  assert.equal(auditor.deaths, 1);
  assert.equal(mixedE3MoritaniPlayer(reveal.after, f.moritani).spice, beforeSpice + 2);
  const replaced = finishMoritaniAuditorReplacement(f, reveal.after);
  const receipt = replaced.moritaniAssassinate!.opportunities.at(-1)!;
  assert.equal(receipt.card, CHOAM_AUDITOR_ID);
  assert.equal(receipt.stage, 'replaced');
  assert.notEqual(receipt.replacement, CHOAM_AUDITOR_ID);
  assert.ok(mixedE3MoritaniPlayer(replaced, f.moritani).traitors.includes(receipt.replacement!));
  assertMixedE3MoritaniPhysical(replaced);
});

void test('the actual played Auditor is excluded from its own held assassination card without suppressing the private opportunity', () => {
  const f = createMoritaniAuditorWinnerFixture({ auditorTarget: true });
  f.plans[1].action = { type: 'battlePlan', leader: CHOAM_AUDITOR_ID, dial: 0, support: 0 };
  const pending = pendingMoritaniAuditorAssassination(f);
  const own = viewGame(pending, f.moritani).moritaniAssassinate!.pending!;
  assert.deepEqual(own.cards, []);
  const before = structuredClone(pending);
  assert.throws(() => applyAction(pending, f.moritani,
    { type: 'decision', event: own.event, card: CHOAM_AUDITOR_ID }));
  assert.deepEqual(pending, before);
  const beforeSpice = mixedE3MoritaniPlayer(pending, f.moritani).spice;
  const declined = applyAction(pending, f.moritani, { type: 'decision', event: own.event, decline: true });
  assert.equal(mixedE3MoritaniPlayer(declined, f.native).leaders.find(l => l.id === CHOAM_AUDITOR_ID)!.dead, false);
  assert.equal(mixedE3MoritaniPlayer(declined, f.moritani).spice, beforeSpice);
  assert.ok(mixedE3MoritaniPlayer(declined, f.moritani).traitors.includes(CHOAM_AUDITOR_ID));
  assert.equal(declined.moritaniAssassinate!.opportunities.at(-1)!.stage, 'declined');
  assertMixedE3MoritaniPhysical(declined);
});
