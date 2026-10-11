import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { ownedTech } from '../game/tech-tokens';
import {
  allocateSemutaSkillAftermathLosses, assertSemutaSkillAftermathComponents,
  claimSemutaSkillAftermath, createSemutaSkillAftermathFixture, finishSemutaSkillAftermath,
  passSemutaSkillAftermath, reloadSemutaSkillAftermath, semutaSkillAftermathPlayer,
} from './fixture-semuta-skill-aftermath';

const profiles = [
  { name: 'Basic native', advanced: false, tech: false, strongholds: false },
  { name: 'Advanced native', advanced: true, tech: false, strongholds: false },
  { name: 'Advanced original Tech', advanced: true, tech: true, strongholds: false },
  { name: 'Advanced original Strongholds', advanced: true, tech: false, strongholds: true },
];
function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

for (const profile of profiles) for (const claim of [false, true]) {
  void test(`${profile.name}: mandatory loser ${claim ? 'claim' : 'pass'} restores exactly one original typed Suk rescue`, () => {
    const f = createSemutaSkillAftermathFixture(profile);
    let game = reloadSemutaSkillAftermath(f.game);
    const original = semutaSkillAftermathPlayer(f.beforeBattle, f.owner);
    const enemy = semutaSkillAftermathPlayer(f.beforeBattle, f.opponent);
    const event = game.pendingTreacheryDiscard!.batch.event;
    assert.equal(game.pendingTreacheryDiscard!.batch.cause, 'battle:mandatory');
    assert.deepEqual(game.pendingTreacheryDiscard!.batch.entries.map(e => e.card.id), [f.losingCard]);
    assert.equal(game.pendingTreacheryDiscard!.continuation.kind, 'battleResolved');
    assert.equal(game.pendingSukRescue!.losses, null);
    assert.equal(game.lastBattleContext!.sukRescue!.completed, false);
    assert.equal(semutaSkillAftermathPlayer(game, f.owner).forces[f.key], 8, 'Winner casualties await the fresh loser discard reaction');
    assert.equal(semutaSkillAftermathPlayer(game, f.owner).tanks, original.tanks);
    assert.equal(semutaSkillAftermathPlayer(game, f.opponent).forces[f.key] ?? 0, 0);
    assert.equal(semutaSkillAftermathPlayer(game, f.opponent).tanks, enemy.tanks + 8);
    assert.equal(semutaSkillAftermathPlayer(game, f.opponent).leaders.find(l => l.id === f.losingLeader)!.dead, true);
    if (profile.tech) assert.deepEqual(game.techTokens, f.beforeBattle.techTokens, 'Original reward remains after rescue/card cleanup');
    reject(game, f.owner, { type: 'decision', event: game.pendingSukRescue!.event, choice: 0 });
    game = claim ? claimSemutaSkillAftermath(game, f.holder, f.losingCard) : passSemutaSkillAftermath(game);
    reject(game, f.holder, { type: 'semutaCommit', event });
    reject(game, f.holder, { type: 'semutaSelect', event, card: f.losingCard });
    game = allocateSemutaSkillAftermathLosses(reloadSemutaSkillAftermath(game));
    assert.ok(game.decision?.kind === 'sukRescue');
    assert.equal(game.decision.mode, 'skilled');
    assert.equal(semutaSkillAftermathPlayer(game, f.owner).forces[f.key], 8);
    const rescue = game.decision;
    const choice = rescue.options.findIndex(o => o.normal === 3 && o.elite === 0 && o.kept?.kind === 'normal' && o.kept.key === f.key);
    assert.ok(choice >= 0);
    const rescueAction: Action = { type: 'decision', event: rescue.event, choice };
    reject(game, f.opponent, rescueAction);
    reject(game, f.owner, { ...rescueAction, event: `${rescue.event}-stale` });
    game = applyAction(reloadSemutaSkillAftermath(game), f.owner, rescueAction);
    const rescued = semutaSkillAftermathPlayer(game, f.owner);
    assert.equal(rescued.forces[f.key], 5, 'Three ordinary board casualties removed; saved fourth remains');
    if (profile.advanced) assert.equal(rescued.elites!.forces[f.key], 2, 'Neither elite counter was selected as a casualty');
    assert.equal(rescued.reserves, original.reserves + 2);
    assert.equal(rescued.tanks, original.tanks + 1);
    if (profile.advanced) {
      assert.equal(rescued.elites!.reserves, original.elites!.reserves);
      assert.equal(rescued.elites!.tanks, original.elites!.tanks);
    }
    assert.equal(rescued.battleLosses, original.battleLosses + 4);
    assert.equal(game.pendingSukRescue, null);
    assert.equal(game.lastBattleContext!.sukRescue!.completed, true);
    assert.ok(game.decision?.kind === 'battleCards');
    assert.deepEqual([...game.decision.cards].sort(), [f.weapon, f.defense].sort());
    reject(game, f.owner, rescueAction);
    assert.equal(semutaSkillAftermathPlayer(game, f.holder).hand.some(c => c.id === f.losingCard), claim);
    assert.equal(semutaSkillAftermathPlayer(game, f.holder).hand.some(c => c.id === SEMUTA_DRUG_ID), !claim);
    assertSemutaSkillAftermathComponents(game, f.inventory);
    // Original optional winner disposal happens AFTER the skill, using its own receipt.
    game = applyAction(reloadSemutaSkillAftermath(game), f.owner, { type: 'decision', discard: [f.weapon] });
    assert.equal(game.pendingTreacheryDiscard!.continuation.kind, 'battleCleanup');
    assert.equal(game.pendingTreacheryDiscard!.batch.cause, 'battle:winner');
    assert.equal(game.lastBattleContext!.sukRescue!.completed, true);
    const cleanupEvent = game.pendingTreacheryDiscard!.batch.event;
    assert.notEqual(cleanupEvent, event);
    const physicalAfterRescue = structuredClone({ forces: rescued.forces, reserves: rescued.reserves, tanks: rescued.tanks, elites: rescued.elites });
    game = finishSemutaSkillAftermath(reloadSemutaSkillAftermath(game));
    const finished = semutaSkillAftermathPlayer(game, f.owner);
    assert.deepEqual({ forces: finished.forces, reserves: finished.reserves, tanks: finished.tanks, elites: finished.elites }, physicalAfterRescue);
    assert.ok(finished.hand.some(c => c.id === f.defense));
    assert.equal(finished.hand.some(c => c.id === f.weapon), false);
    assert.equal(semutaSkillAftermathPlayer(game, f.holder).hand.some(c => c.id === f.losingCard), claim);
    assert.equal(game.phase, 7);
    if (profile.tech) {
      const won = ownedTech(f.beforeBattle.techTokens, f.opponent)[0];
      assert.ok(won);
      assert.equal(game.techTokens![won].owner, f.owner);
      assert.equal(ownedTech(game.techTokens, f.opponent).length, 0);
    }
    reject(game, f.owner, rescueAction);
    reject(game, f.holder, { type: 'semutaCommit', event: cleanupEvent });
    assertSemutaSkillAftermathComponents(game, f.inventory);
  });
}

for (const profile of profiles) for (const claim of [false, true]) {
  void test(`${profile.name}: loser ${claim ? 'claim' : 'pass'} restores Rihani ${claim ? 'exchange' : 'decline'} before compulsory winning Artillery disposal`, () => {
    const f = createSemutaSkillAftermathFixture({ ...profile, skill: 'rihani-decipherer' });
    let game = reloadSemutaSkillAftermath(f.game);
    const ownerBefore = semutaSkillAftermathPlayer(f.beforeBattle, f.owner);
    const event = game.pendingTreacheryDiscard!.batch.event;
    assert.equal(game.pendingTreacheryDiscard!.continuation.kind, 'battleResolved');
    assert.deepEqual(game.pendingTreacheryDiscard!.batch.entries.map(e => e.card.id), [f.losingCard]);
    assert.equal(game.lastBattleContext!.rihani!.completed, false);
    assert.deepEqual(game.pendingWinnerDiscards!.cards, [f.weapon]);
    assert.ok(semutaSkillAftermathPlayer(game, f.owner).hand.some(c => c.id === f.weapon), 'Winning compulsory Artillery is not an invented pre-skill target');
    assert.equal(game.rihaniHistory?.length ?? 0, 0);
    assert.equal(game.discard.some(c => c.id === f.weapon), false);
    const initialTraitors = [...semutaSkillAftermathPlayer(game, f.owner).traitors];
    game = claim ? claimSemutaSkillAftermath(game, f.holder, f.losingCard) : passSemutaSkillAftermath(game);
    game = allocateSemutaSkillAftermathLosses(reloadSemutaSkillAftermath(game));
    assert.ok(game.decision?.kind === 'rihani' && game.decision.stage === 'offer');
    assert.equal(game.pendingTreacheryDiscard, null, 'Traitor drawing is not a Treachery discard reaction');
    assert.equal(semutaSkillAftermathPlayer(game, f.owner).forces[f.key], 4);
    if (profile.advanced) assert.equal(semutaSkillAftermathPlayer(game, f.owner).elites!.forces[f.key], 2);
    assert.equal(semutaSkillAftermathPlayer(game, f.owner).tanks, ownerBefore.tanks + 4);
    assert.equal(semutaSkillAftermathPlayer(game, f.owner).reserves, ownerBefore.reserves);
    assert.ok(semutaSkillAftermathPlayer(game, f.owner).leaders.find(l => l.id === f.trainer && !l.dead));
    const rihaniEvent = game.decision.event;
    const drawAction: Action = { type: 'decision', event: rihaniEvent, draw: claim };
    reject(game, f.opponent, drawAction);
    reject(game, f.holder, { type: 'semutaCommit', event });
    reject(game, f.holder, { type: 'semutaSelect', event, card: f.weapon });
    game = applyAction(reloadSemutaSkillAftermath(game), f.owner, drawAction);
    let exchangeAction: Action | undefined;
    let kept: string | undefined, given: string | undefined, unkept: string | undefined;
    if (claim) {
      assert.ok(game.decision?.kind === 'rihani' && game.decision.stage === 'return');
      const receipt = game.rihaniHistory![0];
      assert.equal(receipt.drawn.length, 2);
      assert.deepEqual(semutaSkillAftermathPlayer(game, f.owner).traitors, [...initialTraitors, ...receipt.drawn]);
      assert.equal(game.pendingTreacheryDiscard, null);
      assert.equal(game.pendingWinnerDiscards!.cards[0], f.weapon);
      kept = receipt.drawn[0]; unkept = receipt.drawn[1]; given = receipt.eligible[0];
      exchangeAction = { type: 'decision', event: rihaniEvent, cards: [kept, given] };
      reject(game, f.owner, drawAction);
      reject(game, f.owner, { type: 'decision', event: rihaniEvent, cards: [given, kept] });
      game = applyAction(reloadSemutaSkillAftermath(game), f.owner, exchangeAction);
      assert.deepEqual(semutaSkillAftermathPlayer(game, f.owner).traitors, [...initialTraitors.filter(id => id !== given), kept]);
      assert.ok(game.traitorReserve!.includes(given) && game.traitorReserve!.includes(unkept));
      assert.equal(game.traitorReserve!.includes(kept), false);
    } else {
      assert.deepEqual(semutaSkillAftermathPlayer(game, f.owner).traitors, initialTraitors);
      assert.deepEqual(game.rihaniHistory![0].drawn, []);
      assert.equal(game.rihaniHistory![0].given, null);
    }
    assert.equal(game.lastBattleContext!.rihani!.completed, true);
    assert.equal(game.rihaniHistory!.length, 1);
    assert.equal(game.rihaniHistory![0].stage, 'complete');
    assert.equal(game.pendingWinnerDiscards, null);
    assert.equal(game.pendingTreacheryDiscard!.continuation.kind, 'winnerMandatoryDiscard');
    assert.equal(game.pendingTreacheryDiscard!.batch.cause, 'battle:winnerMandatory');
    assert.deepEqual(game.pendingTreacheryDiscard!.batch.entries.map(e => e.card.id), [f.weapon]);
    assert.ok(game.pendingTreacheryDiscard!.batch.entries.every(e => e.card.kind === 'artillery'), 'No Traitor or Face Dancer is a Treachery discard target');
    const compulsoryEvent = game.pendingTreacheryDiscard!.batch.event;
    reject(game, f.owner, drawAction);
    if (exchangeAction) reject(game, f.owner, exchangeAction);
    game = passSemutaSkillAftermath(reloadSemutaSkillAftermath(game));
    assert.ok(game.decision?.kind === 'battleCards');
    assert.deepEqual(game.decision.cards, [f.defense]);
    const cleanup = applyAction(reloadSemutaSkillAftermath(game), f.owner, { type: 'decision', discard: [f.defense] });
    assert.equal(cleanup.pendingTreacheryDiscard!.continuation.kind, 'battleCleanup');
    game = finishSemutaSkillAftermath(reloadSemutaSkillAftermath(cleanup));
    assert.equal(game.rihaniHistory!.length, 1);
    assert.equal(game.phase, 7);
    assert.equal(semutaSkillAftermathPlayer(game, f.holder).hand.some(c => c.id === f.losingCard), claim);
    if (claim) {
      assert.equal(game.rihaniHistory![0].kept, kept);
      assert.equal(game.rihaniHistory![0].given, given);
      assert.ok(semutaSkillAftermathPlayer(game, f.owner).traitors.includes(kept!));
      assert.ok(game.traitorReserve!.includes(given!) && game.traitorReserve!.includes(unkept!));
    }
    reject(game, f.holder, { type: 'semutaCommit', event: compulsoryEvent });
    reject(game, f.owner, drawAction);
    assertSemutaSkillAftermathComponents(game, f.inventory);
  });
}

void test('A late compulsory Artillery claim cannot precede or replay the original Rihani exchange', () => {
  const f = createSemutaSkillAftermathFixture({ advanced: true, skill: 'rihani-decipherer' });
  let game = allocateSemutaSkillAftermathLosses(passSemutaSkillAftermath(reloadSemutaSkillAftermath(f.game)));
  assert.ok(game.decision?.kind === 'rihani');
  const event = game.decision.event;
  game = applyAction(reloadSemutaSkillAftermath(game), f.owner, { type: 'decision', event, draw: true });
  const receipt = game.rihaniHistory![0], kept = receipt.drawn[0], given = receipt.eligible[0];
  const exchange: Action = { type: 'decision', event, cards: [kept, given] };
  game = applyAction(reloadSemutaSkillAftermath(game), f.owner, exchange);
  assert.equal(game.pendingTreacheryDiscard!.continuation.kind, 'winnerMandatoryDiscard');
  const compulsoryEvent = game.pendingTreacheryDiscard!.batch.event;
  const skillReceipt = structuredClone(game.rihaniHistory), forces = structuredClone(semutaSkillAftermathPlayer(game, f.owner).forces);
  game = claimSemutaSkillAftermath(reloadSemutaSkillAftermath(game), f.holder, f.weapon);
  assert.ok(game.decision?.kind === 'battleCards');
  assert.deepEqual(game.rihaniHistory, skillReceipt);
  assert.deepEqual(semutaSkillAftermathPlayer(game, f.owner).forces, forces);
  assert.ok(semutaSkillAftermathPlayer(game, f.holder).hand.some(c => c.id === f.weapon));
  assert.ok(semutaSkillAftermathPlayer(game, f.owner).traitors.includes(kept));
  reject(game, f.owner, exchange);
  reject(game, f.holder, { type: 'semutaCommit', event: compulsoryEvent });
  game = applyAction(reloadSemutaSkillAftermath(game), f.owner, { type: 'decision', discard: [] });
  game = finishSemutaSkillAftermath(game);
  assert.ok(semutaSkillAftermathPlayer(game, f.owner).hand.some(c => c.id === f.defense));
  assert.ok(semutaSkillAftermathPlayer(game, f.holder).hand.some(c => c.id === f.weapon));
  assert.deepEqual(game.rihaniHistory, skillReceipt);
  assertSemutaSkillAftermathComponents(game, f.inventory);
  // Projection at the completed JSON boundary exercises canonical skill receipts.
  for (const player of game.players) viewGame(reloadSemutaSkillAftermath(game), player.id);
});
