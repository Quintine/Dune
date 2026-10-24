import assert from 'node:assert/strict';
import test from 'node:test';
import { leaders } from '../game/cards';
import { applyAction, viewGame } from '../game/engine';
import {
  moritaniAssassinateChoices, moritaniAssassinateTrigger, quoteMoritaniAssassinate,
} from '../game/moritani-assassinate';
import { CHEAP_HERO_TRAITOR } from '../game/traitors';
import {
  advanceMixedE3Moritani, assertMixedE3MoritaniPhysical, assertMixedE3MoritaniRejects,
  mixedE3MoritaniClean, mixedE3MoritaniPlayer, mixedE3MoritaniTraitorCustody,
  quoteMixedE3MoritaniBattle,
} from './fixture-mixed-e3-moritani-nexus';
import {
  createMoritaniHeroReplacementFixture, finishMoritaniHeroReplacement, moritaniHeroTargetAction,
} from './fixture-moritani-hero-replacement';


void test('original native Ixians loss pays the held native target bounty and Mentat privately draws the one physical Hero without reviving its retired victim', () => {
  const f = createMoritaniHeroReplacementFixture();
  const target = leaders('ixians').find(leader => leader.id === f.target)!;
  assert.ok(target);
  assert.equal(f.afterSetup.traitorReserve![0], CHEAP_HERO_TRAITOR);
  assert.equal(mixedE3MoritaniTraitorCustody(f.afterSetup).filter(card => card === CHEAP_HERO_TRAITOR).length, 1);
  assertMixedE3MoritaniPhysical(f.afterSetup);

  const arrival = f.battle.arrival!;
  const beforeShipment = mixedE3MoritaniPlayer(arrival.before, f.native);
  const afterShipment = mixedE3MoritaniPlayer(f.battle.arrangements, f.native);
  assert.equal(beforeShipment.reserves - afterShipment.reserves, 1);
  assert.equal((afterShipment.forces[f.location] ?? 0) - (beforeShipment.forces[f.location] ?? 0), 1);
  assert.equal(beforeShipment.spice - afterShipment.spice, 1);
  assert.equal(quoteMixedE3MoritaniBattle(f.battle.revealed).winner, f.native);
  assert.notEqual(f.battle.enemyLeader, f.target);
  assert.equal(f.pending.lastBattleContext!.result, 'normal');
  assert.equal(f.pending.lastBattleContext!.winner, f.native);
  const pendingReceipt = f.pending.moritaniAssassinate!.opportunities.at(-1)!;
  assert.equal(pendingReceipt.faction, 'ixians');
  assert.equal(pendingReceipt.opposingLeader, f.battle.enemyLeader);
  const ownerChoice = viewGame(f.pending, f.moritani).moritaniAssassinate!.pending!;
  assert.deepEqual(ownerChoice.cards.map(card => ({ card: card.card, bounty: card.potentialBounty })),
    [{ card: f.target, bounty: target.strength }]);
  assert.deepEqual(viewGame(f.pending, f.native).moritaniAssassinate!.pending!.cards, []);
  assert.equal(mixedE3MoritaniPlayer(f.revealed, f.moritani).spice,
    mixedE3MoritaniPlayer(f.pending, f.moritani).spice + target.strength);
  assert.equal(mixedE3MoritaniPlayer(f.revealed, f.native).spice,
    mixedE3MoritaniPlayer(f.pending, f.native).spice);
  const killed = mixedE3MoritaniPlayer(f.revealed, f.native).leaders.find(leader => leader.id === f.target)!;
  assert.equal(killed.dead, true);
  assert.equal(killed.deaths,
    mixedE3MoritaniPlayer(f.pending, f.native).leaders.find(leader => leader.id === f.target)!.deaths + 1);
  assert.ok(mixedE3MoritaniPlayer(f.preMentat, f.moritani).traitors.includes(f.target),
    'The revealed victim stays physically held and reserved until original Mentat.');
  assert.equal(f.preMentat.traitorReserve![0], CHEAP_HERO_TRAITOR);
  assertMixedE3MoritaniPhysical(f.preMentat);

  const replaced = finishMoritaniHeroReplacement(f);
  assert.equal(replaced.phase, 8);
  assert.equal(replaced.turn, f.preMentat.turn);
  const receipt = replaced.moritaniAssassinate!.opportunities.at(-1)!;
  assert.equal(receipt.stage, 'replaced');
  assert.equal(receipt.event, pendingReceipt.event);
  assert.equal(receipt.card, f.target);
  assert.equal(receipt.replacement, CHEAP_HERO_TRAITOR);
  assert.equal(receipt.bounty, target.strength);
  assert.deepEqual(replaced.traitorReserve, f.preMentat.traitorReserve!.slice(1));
  const hand = mixedE3MoritaniPlayer(replaced, f.moritani).traitors;
  assert.equal(hand.filter(card => card === CHEAP_HERO_TRAITOR).length, 1);
  assert.equal(hand.includes(f.target), false);
  assert.equal(replaced.traitorReserve!.includes(f.target), false);
  assert.equal(replaced.players.some(player => player.traitors.includes(f.target) ||
    player.traitorChoices.includes(f.target) || player.faceDancers?.some(card => card.leader === f.target)), false);
  assert.deepEqual(mixedE3MoritaniTraitorCustody(replaced), mixedE3MoritaniTraitorCustody(f.afterSetup));
  assertMixedE3MoritaniPhysical(replaced);
  for (const player of replaced.players) {
    const publicHistory = viewGame(replaced, player.id).moritaniAssassinate!.history.at(-1)!;
    assert.equal(publicHistory.card, f.target);
    assert.equal(publicHistory.stage, 'replaced');
    assert.equal(Object.hasOwn(publicHistory, 'replacement'), false);
  }
  const ownerView = viewGame(replaced, f.moritani);
  assert.ok(ownerView.players.find(player => player.id === f.moritani)!.traitors?.includes(CHEAP_HERO_TRAITOR));
  const rivalView = viewGame(replaced, f.native);
  assert.equal(rivalView.players.find(player => player.id === f.moritani)!.traitors, undefined);

  const beforeReplay = structuredClone(replaced);
  assert.throws(() => applyAction(replaced, f.moritani, moritaniHeroTargetAction(f, f.pending)));
  assert.deepEqual(replaced, beforeReplay);
  const nextTurn = advanceMixedE3Moritani(replaced,
    state => state.turn === replaced.turn + 1 && state.phase === 1 && mixedE3MoritaniClean(state), f.actions);
  assert.deepEqual(nextTurn.moritaniAssassinate!.opportunities, replaced.moritaniAssassinate!.opportunities);
  assert.deepEqual(nextTurn.traitorReserve, replaced.traitorReserve);
  assert.deepEqual(mixedE3MoritaniPlayer(nextTurn, f.moritani).traitors, hand);
  assert.equal(mixedE3MoritaniPlayer(nextTurn, f.native).leaders.find(leader => leader.id === f.target)!.dead, true);
  assertMixedE3MoritaniPhysical(nextTurn);
});

void test('the canonical Hero replacement remains a Traitor identity, never a physical battle disc or native-faction assassination target', () => {
  const f = createMoritaniHeroReplacementFixture();
  for (const actor of [f.moritani, f.native])
    assertMixedE3MoritaniRejects(structuredClone(f.battle.arrangements), actor,
      { type: 'battlePlan', leader: CHEAP_HERO_TRAITOR, dial: 0, support: 0 });
  const replaced = finishMoritaniHeroReplacement(f);
  assert.equal(replaced.players.flatMap(player => player.leaders).some(leader => leader.id === CHEAP_HERO_TRAITOR), false);
  assert.equal(viewGame(replaced, f.moritani).allLeaders.some(leader => leader.id === CHEAP_HERO_TRAITOR), false);

  // Pure identity guard with the ACTUALLY DRAWN private hand and the original
  // choice receipt: no game/hand/phase is staged to manufacture another battle.
  const state = f.pending.moritaniAssassinate!;
  const receipt = state.opportunities.at(-1)!;
  const context = { state, receipt, held: mixedE3MoritaniPlayer(replaced, f.moritani).traitors,
    normallyRevealed: [], leaders: mixedE3MoritaniPlayer(f.pending, f.native).leaders };
  assert.deepEqual(moritaniAssassinateChoices(context).cards, []);
  assert.throws(() => quoteMoritaniAssassinate(context, CHEAP_HERO_TRAITOR));
  assert.equal(moritaniAssassinateTrigger({ advanced: true, owner: f.moritani,
    ownerFaction: 'moritani', opponent: f.native, faction: 'ixians', event: receipt.event,
    turn: receipt.turn, territory: receipt.territory, opposingLeader: CHEAP_HERO_TRAITOR,
    opposingLeaderSurvived: true, normalBattle: true, lostBattle: true, traitorCalled: false }), false);
  assert.ok(mixedE3MoritaniPlayer(replaced, f.moritani).traitors.includes(CHEAP_HERO_TRAITOR));
  assertMixedE3MoritaniPhysical(replaced);
});
