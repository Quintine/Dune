import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import type { FactionId } from '../game/catalog';
import { DIFFICULTIES } from '../game/bot-profiles';
import { DUKE_VIDAL_ID } from '../game/duke-vidal';
import { ownedTech } from '../game/tech-tokens';
import {
  initializeDiscoveryStandaloneNexusE3Skills as initialize,
  completeDiscoveryStandaloneNexusE3SkillsSetup as complete,
  createDiscoveryStandaloneNexusE3SkillsFixture as fixture,
  closeDiscoveryStandaloneNexusE3Skills as close,
  enterDiscoveryStandaloneNexusE3Skills as enter,
  cunningDiscoveryStandaloneNexusE3Skills as cunning,
  openDiscoveryStandaloneNexusE3SkillsBattle as open,
  revealDiscoveryStandaloneNexusE3SkillsBattle as reveal,
  settleDiscoveryStandaloneNexusE3SkillsBattle as boundary,
  finishDiscoveryStandaloneNexusE3SkillsBattle as finish,
  advanceDiscoveryStandaloneNexusE3Skills as advance,
  stepDiscoveryStandaloneNexusE3Skills as step,
  discoveryStandaloneNexusE3SkillsPlayer as player,
  discoveryStandaloneNexusE3SkillsPolicy as policy,
  discoveryStandaloneNexusE3SkillsClean as clean,
  assertDiscoveryStandaloneNexusE3SkillsCustody as custody,
  type DiscoveryStandaloneNexusE3SkillsOptions,
} from './fixture-discovery-standalone-nexus-e3-skills';

function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
/** Consume actual physical loss/rescue choices; do not hide the later owner choice. */
function aftermath(state: Game, callers: readonly string[] = []): Game {
  let next = boundary(state, callers);
  for (let count = 0; count < 20 && (next.kind === 'losses' || next.kind === 'rescue'); count++) {
    const d = next.game.decision!;
    if (d.kind === 'battleLosses') next = boundary(step(next.game, { actor: d.player, action: { type: 'decision', choice: 0 } }), callers);
    else if (d.kind === 'sukRescue') {
      const max = Math.max(...d.options.map(o => o.normal + o.elite));
      const choice = d.options.findIndex(o => o.normal + o.elite === max);
      next = boundary(step(next.game, { actor: d.player, action: { type: 'decision', event: d.event, choice } }), callers);
    }
  }
  return next.game;
}

void test('original one-native Basic/Advanced 2–6 setup trains eligible own discs and preserves supplied original hands and offers', () => {
  for (const native of ['ecaz', 'moritani'] as const) for (const rules of ['basic', 'advanced'] as const)
    for (const count of [2, 3, 4, 5, 6]) {
      const factions: FactionId[] = [native, 'guild', 'emperor', 'fremen', 'beneGesserit', rules === 'basic' ? 'harkonnen' : 'atreides'];
      const options: DiscoveryStandaloneNexusE3SkillsOptions = { native, rules, factions: factions.slice(0, count),
        seatIds: factions.slice(0, count).map((f, n) => `${native}-${rules}-${count}-${n}-${f}`),
        tech: count >= 3, strongholds: rules === 'advanced' };
      if (native === 'ecaz' && rules === 'basic' && count % 2) { assert.throws(() => initialize(options)); continue; }
      const offered = advance(initialize(options), g => g.setupStage === 'leaderSkills');
      const owner = offered.players.find(p => p.faction === native)!.id;
      const original = structuredClone(offered), continued = initialize({ initial: offered });
      assert.deepEqual(continued, original);
      const trained = complete(continued, { initial: offered });
      assert.deepEqual(trained.players.map(p => p.id), original.players.map(p => p.id));
      for (const p of original.players) assert.deepEqual(player(trained, p.id).hand, p.hand);
      assert.ok(trained.leaderSkills!.assignments.every(a => original.leaderSkills!.offers[a.owner].cards.includes(a.skill) &&
        player(original, a.owner).leaders.some(l => l.id === a.leader)));
      const assignment = trained.leaderSkills!.assignments.find(a => a.owner === owner)!;
      assert.notEqual(assignment.leader, DUKE_VIDAL_ID);
      if (rules === 'basic') assert.equal(trained.moritaniAssassinate, undefined);
      if (count === 2) {
        const f = fixture({ initial: offered });
        assert.equal(viewGame(f.game, owner).discoveryEntry!.owner, owner);
        if (rules === 'advanced') {
          assert.equal(f.firstMentat.before.strongholdCards!.owners[f.claim], null);
          assert.equal(f.game.strongholdCards!.owners[f.claim], owner);
        }
        assert.throws(() => close(f), /two other real alliance seats/);
      }
      custody(trained);
    }
});

void test('source guards reject Advanced Harkonnen, paired/mixed E3, variants, shared Duke and foreign/captured training without consuming offers', () => {
  for (const native of ['ecaz', 'moritani'] as const) {
    for (const other of ['harkonnen', native === 'ecaz' ? 'moritani' : 'ecaz', 'ixians', 'choam', 'richese', 'tleilaxu'] as FactionId[])
      assert.throws(() => initialize({ native, factions: [native, 'guild', other] }));
    assert.throws(() => initialize({ native, rules: 'basic', strongholds: true }));
    const offered = initialize({ native }), owner = offered.players.find(p => p.faction === native)!.id;
    const own = viewGame(offered, owner).leaderSkills!, skill = own.offer!.cards.find(s => !own.unavailableSkills?.[s])!;
    const foreign = offered.players.find(p => p.id !== owner)!.leaders[0].id;
    for (const leader of [DUKE_VIDAL_ID, foreign]) reject(offered, owner,
      { type: 'leaderSkill', event: own.offer!.event, skill, leader });
    const captured = structuredClone(offered), disc = player(captured, owner).leaders.find(l => l.id === own.eligibleLeaders[0].id)!;
    // Rejected counterfactual only: no captured state is accepted as played history.
    disc.capturedBy = offered.players.find(p => p.id !== owner)!.id;
    reject(captured, owner, { type: 'leaderSkill', event: own.offer!.event, skill, leader: disc.id });
    assert.throws(() => initialize({ initial: { ...offered, ecazTreachery: true } }));
    assert.throws(() => initialize({ initial: { ...offered, homeworlds: {} as NonNullable<Game['homeworlds']> } }));
    custody(offered);
  }
});

void test('human lobby/setup actors and first hands survive the actual Discovery reveal and pre-Storm free entry, not a redeal or a paid shipment', () => {
  for (const native of ['ecaz', 'moritani'] as const) {
    const lobby = createGame(`HUMAN-${native}`, newPlayer(`human-${native}`, native, native), true, ['ecaz']);
    joinGame(lobby, newPlayer('human-guild', 'Guild', 'guild')); joinGame(lobby, newPlayer('human-fremen', 'Fremen', 'fremen'));
    const original = structuredClone(lobby), offered = initialize({ initial: lobby }), f = fixture({ initial: offered });
    assert.deepEqual(lobby, original); assert.deepEqual(f.setup, offered);
    assert.equal(f.owner, `human-${native}`); assert.equal(f.opponent, 'human-guild');
    for (const p of offered.players) assert.deepEqual(player(f.game, p.id).hand, p.hand);
    const own = viewGame(f.game, f.owner), source = player(f.game, f.owner).forces[f.source];
    assert.equal(own.discoveryEntry!.owner, f.owner);
    assert.equal(f.firstMentat.before.turn, 1); assert.equal(f.firstMentat.before.phase, 8);
    assert.equal(f.game.turn, 2); assert.equal(f.game.phase, 0);
    reject(f.game, f.opponent, { type: 'decision', event: own.discoveryEntry!.event, accept: false });
    reject(f.firstMentat.before, f.owner, { type: 'nexusCardChoice', turn: 1, card: null, choice: 'draw', ownRedraws: 0 });
    const entered = enter(f), funds = player(f.game, f.owner).spice;
    assert.equal(player(entered, f.owner).forces['cistern:0'], 3);
    assert.equal(player(entered, f.owner).forces[f.source] ?? 0, source - 3);
    assert.equal(player(entered, f.owner).spice, funds);
    assert.equal(player(entered, f.owner).shipped, player(f.game, f.owner).shipped);
    assert.deepEqual(entered.leaderSkills, f.game.leaderSkills); custody(entered);
  }
});

void test('Maker losses, all votes, typed reserve ride, settled alliances and both Advanced piles precede the only native closing draw', () => {
  for (const native of ['ecaz', 'moritani'] as const) {
    const f = fixture({ native, tech: true, strongholds: true }), closing = close(f);
    assert.equal(player(closing.vote, f.owner).tanks, player(closing.entered, f.owner).tanks + 6);
    assert.equal(player(closing.vote, f.owner).forces[f.wormSource] ?? 0, 0);
    assert.equal(player(closing.vote, f.owner).forces['cistern:0'], 3);
    assert.equal(closing.vote.nexusCards!.cards!.hands[f.owner], null);
    reject(closing.vote, f.owner, closing.draw.step.action);
    const ride = closing.ride; assert.ok(ride && f.fremen);
    const rider = player(ride.before, f.fremen);
    assert.equal(player(ride.after, f.fremen).reserves, rider.reserves - 2);
    assert.equal(player(ride.after, f.fremen).elites!.reserves, rider.elites!.reserves - 1);
    assert.equal(player(ride.after, f.fremen).forces['polar_sink:0'], 2);
    assert.equal(player(ride.after, f.fremen).elites!.forces['polar_sink:0'], 1);
    assert.equal(player(ride.after, f.fremen).spice, rider.spice);
    assert.equal(closing.draw.before.phase, 1); assert.equal(closing.draw.before.spiceWindow, null);
    assert.equal(closing.draw.before.spiceResolution, null); assert.equal(closing.draw.before.nexus, false);
    assert.equal(player(closing.alliance, f.owner).ally, null);
    assert.equal(player(closing.alliance, f.opponent).ally, f.fremen);
    assert.equal(closing.draw.after.nexusCards!.cards!.hands[f.owner], native);
    assert.equal(closing.draw.after.nexusCards!.cards!.deck.includes(native), false);
    reject(closing.draw.after, f.owner, closing.draw.step.action);
    assert.equal(f.firstMentat.before.strongholdCards!.owners[f.claim], null);
    assert.equal(f.firstMentat.after.strongholdCards!.owners[f.claim], f.owner);
    assert.equal(ownedTech(f.afterFirstStorm.techTokens, f.owner).length, 1);
    custody(closing.game);
  }
});

void test('borrowed Emperor free-return remains source guarded for either native even with real Maker casualties and an actually drawn card', () => {
  for (const native of ['ecaz', 'moritani'] as const) {
    const f = fixture({ native }), closing = close(f, 'emperor');
    const revival = advance(closing.game, g => g.phase === 4 && clean(g));
    assert.equal(player(revival, f.owner).tanks, 6);
    const offer = viewGame(revival, f.owner).nexusEmperorSecretAlly; assert.ok(offer && offer.revival.blocked);
    const action: Action = { type: 'nexusEmperorRevive', event: offer.event, elite: 0 };
    reject(revival, f.owner, action);
    assert.equal(revival.nexusCards!.cards!.hands[f.owner], 'emperor');
    assert.equal(player(revival, f.owner).freeForcesRevived, 0);
    custody(revival);
  }
});

void test('quiet native Ecaz Cunning acquires the living unclaimed or set-aside dead Duke separately from training, and rejects exceptional custody or an already-open battle', () => {
  const f = fixture({ native: 'ecaz' }), closing = close(f), acquired = cunning(f, closing.game);
  assert.equal(acquired.before.status, 'playing');
  assert.equal(acquired.before.turn, closing.game.turn);
  assert.equal(acquired.before.phase, 6);
  assert.equal(acquired.before.battle, null);
  assert.ok(viewGame(acquired.before, f.owner).battleChoices.length > 0,
    'Physical opponents keep the original Battle chooser open before quiet Cunning.');
  assert.equal(acquired.before.dukeVidal!.controller, null);
  assert.equal(acquired.after.dukeVidal!.controller, f.owner);
  assert.equal(acquired.after.dukeVidal!.leader.dead, false);
  assert.equal(acquired.after.nexusCards!.cards!.hands[f.owner], null);
  assert.deepEqual(acquired.after.leaderSkills, acquired.before.leaderSkills);
  assert.ok(acquired.after.leaderSkills!.assignments.every(a => a.leader !== DUKE_VIDAL_ID));
  const tanks = structuredClone(acquired.before);
  tanks.dukeVidal!.leader = { ...tanks.dukeVidal!.leader, dead: true, deaths: 2, usedAt: 'cistern' };
  const beforeRevival = structuredClone(tanks), revived = step(tanks, acquired.step);
  assert.deepEqual(tanks, beforeRevival);
  assert.deepEqual(revived.dukeVidal, {
    ...beforeRevival.dukeVidal!,
    controller: f.owner, acquiredTurn: revived.turn, source: 'ecazNexus',
    leader: { ...acquired.before.dukeVidal!.leader, dead: false, deaths: 2 },
  });
  assert.equal(revived.dukeVidal!.leader.usedAt, undefined);
  assert.equal(revived.nexusCards!.cards!.hands[f.owner], null);
  assert.equal(revived.nexusCards!.cards!.discard.filter(c => c === 'ecaz').length,
    beforeRevival.nexusCards!.cards!.discard.filter(c => c === 'ecaz').length + 1);
  assert.equal(revived.nexusEcazDukeHistory!.length, (beforeRevival.nexusEcazDukeHistory?.length ?? 0) + 1);
  assert.deepEqual(revived.leaderSkills, beforeRevival.leaderSkills);
  custody(revived);
  for (const property of ['controller', 'acquiredTurn', 'source'] as const) {
    const input = structuredClone(tanks);
    if (property === 'controller') input.dukeVidal!.controller = f.opponent;
    else if (property === 'acquiredTurn') input.dukeVidal!.acquiredTurn = input.turn;
    else input.dukeVidal!.source = 'ecazNexus';
    reject(input, f.owner, acquired.step.action);
  }
  for (const property of ['capturedBy', 'gholaBy', 'usedAt'] as const) {
    const input = structuredClone(acquired.before);
    if (property === 'usedAt') input.dukeVidal!.leader.usedAt = 'cistern';
    else input.dukeVidal!.leader[property] = f.opponent;
    reject(input, f.owner, acquired.step.action);
  }
  const battle = open(f, closing.game);
  reject(battle.game, f.owner, acquired.step.action);
  const revealed = reveal(battle), cleanup = aftermath(revealed);
  assert.equal(cleanup.decision?.kind, 'battleCards'); assert.equal(cleanup.decision!.player, f.owner);
  assert.equal(player(cleanup, f.owner).forces[battle.location], 5);
  assert.equal(player(cleanup, f.opponent).forces[battle.location] ?? 0, 0);
  assert.equal(player(cleanup, f.opponent).tanks, player(revealed, f.opponent).tanks + 6);
  assert.equal(cleanup.dukeVidal!.controller, f.owner, 'The actual native trained disc was used; the separate Duke was not set aside.');
  const done = finish(step(cleanup, { actor: f.owner, action: { type: 'decision', discard: [] } }));
  assert.equal(player(done, f.owner).hand.some(c => c.id === battle.card), true);
  assert.equal(player(done, f.owner).leaders.find(l => l.id === f.leader)!.usedAt, 'cistern');
  custody(done);
});

void test('mandatory selected-lead Occupy stays a real battle with owner-labelled commitments, native skill custody, payments, cleanup and Tech', () => {
  for (const lead of ['native', 'ally'] as const) {
    const f = fixture({ native: 'ecaz', factions: ['ecaz', 'guild', 'emperor'], tech: true, strongholds: true }), closing = close(f);
    const acquired = cunning(f, closing.game), battle = open(f, acquired.after, { occupy: true, lead });
    const choice = battle.leadChoice; assert.ok(choice);
    assert.equal(choice.before.status, 'playing');
    assert.equal(choice.before.turn, acquired.after.turn + 1);
    assert.equal(choice.before.decision!.kind, 'ecazBattleLead'); assert.equal(choice.before.decision!.player, f.owner);
    reject(choice.before, f.opponent, choice.step.action);
    reject(choice.before, f.owner, { ...choice.step.action, lead: f.opponent });
    assert.equal(battle.game.battle!.ecazOccupy!.lead, battle.actor);
    assert.equal(battle.game.battle!.plans[battle.actor], undefined);
    assert.notEqual(battle.leader, DUKE_VIDAL_ID);
    if (lead === 'ally') reject(battle.game, battle.actor, { ...battle.plans[0].action, leader: f.leader });
    const assignments = structuredClone(battle.game.leaderSkills!.assignments), revealed = reveal(battle);
    const cleanup = aftermath(revealed);
    assert.equal(cleanup.decision?.kind, 'battleCards'); assert.equal(cleanup.decision!.player, battle.actor);
    assert.equal(player(cleanup, f.owner).forces[battle.location], 1);
    assert.equal(player(cleanup, f.owner).tanks, player(revealed, f.owner).tanks + 2);
    const ally = player(revealed, f.owner).ally!;
    assert.equal(player(cleanup, ally).forces[battle.location], 5);
    assert.equal(player(cleanup, ally).tanks, player(revealed, ally).tanks + 1);
    assert.equal(player(cleanup, f.opponent).tanks, player(revealed, f.opponent).tanks + 6);
    assert.equal(player(cleanup, battle.actor).spice, player(revealed, battle.actor).spice - 1);
    const companion = battle.actor === f.owner ? ally : f.owner;
    assert.equal(player(cleanup, companion).spice, player(revealed, companion).spice);
    assert.equal(player(cleanup, f.opponent).spice, player(revealed, f.opponent).spice - 1);
    assert.deepEqual(cleanup.techTokens, revealed.techTokens, 'Actual winner card custody precedes optional winner Tech.');
    const done = finish(step(cleanup, { actor: battle.actor, action: { type: 'decision', discard: [battle.card] } }));
    assert.equal(done.discard.filter(c => c.id === battle.card).length, 1);
    assert.equal(player(done, battle.actor).hand.some(c => c.id === battle.card), false);
    assert.deepEqual(done.leaderSkills!.assignments.map(a => ({ owner: a.owner, leader: a.leader, skill: a.skill })),
      assignments.map(a => ({ owner: a.owner, leader: a.leader, skill: a.skill })));
    for (const token of ownedTech(revealed.techTokens, f.opponent)) assert.equal(done.techTokens![token].owner, battle.actor);
    assert.equal(done.strongholdCards!.owners.arrakeen, f.owner);
    custody(done);
  }
});

void test('Advanced Moritani after-loss assassination kills the actual unused trained disc, pays printed bounty, returns its skill and replaces only the private Traitor at actual Mentat', () => {
  const f = fixture({ native: 'moritani', tech: true, strongholds: true }), closing = close(f), battle = open(f, closing.game);
  assert.ok(f.target);
  assert.ok(player(f.trained, f.owner).traitors.includes(f.target));
  assert.ok(f.actions.some(s => s.actor === f.owner && s.action.type === 'traitor' && s.action.leader === f.target),
    'The trained enemy disc is selected through the original pending Traitor offer.');
  const revealed = reveal(battle), pending = aftermath(revealed);
  assert.equal(pending.decision?.kind, 'moritaniAssassinate'); assert.equal(pending.decision!.player, f.owner);
  assert.equal(player(pending, f.owner).tanks, player(revealed, f.owner).tanks + 6);
  const target = player(pending, f.opponent).leaders.find(l => l.id === f.target)!;
  const originalSkill = pending.leaderSkills!.assignments.find(a => a.leader === target.id)!.skill;
  assert.equal(target.dead, false); assert.equal(target.usedAt, undefined);
  const decision = pending.decision; assert.ok(decision?.kind === 'moritaniAssassinate');
  const action: Action = { type: 'decision', event: decision.event, card: target.id };
  reject(pending, f.opponent, action); reject(pending, f.owner, { ...action, card: battle.enemyLeader });
  const reserve = [...pending.traitorReserve!], held = [...player(pending, f.owner).traitors];
  const quote = viewGame(pending, f.owner).moritaniAssassinate!.pending!.cards.find(c => c.card === target.id)!;
  assert.equal(quote.bounty, 3);
  const killed = step(pending, { actor: f.owner, action });
  assert.equal(player(killed, f.opponent).leaders.find(l => l.id === target.id)!.dead, true);
  assert.equal(player(killed, f.opponent).leaders.find(l => l.id === target.id)!.deaths, target.deaths + 1);
  assert.equal(player(killed, f.owner).spice, player(pending, f.owner).spice + 3);
  assert.equal(killed.leaderSkills!.assignments.some(a => a.leader === target.id), false);
  assert.equal(killed.leaderSkills!.deck.filter(s => s === originalSkill).length, 1);
  assert.equal(killed.decision?.kind, 'battleCards'); assert.equal(killed.decision!.player, f.opponent);
  assert.deepEqual(killed.techTokens, pending.techTokens);
  let done = finish(step(killed, { actor: f.opponent, action: { type: 'decision', discard: [battle.enemyCard!] } }));
  for (const card of [battle.card, battle.enemyCard!]) assert.equal(done.discard.filter(c => c.id === card).length, 1);
  for (const token of ownedTech(revealed.techTokens, f.owner)) assert.equal(done.techTokens![token].owner, f.opponent);
  done = advance(done, g => g.decision?.kind === 'moritaniPlacement');
  assert.deepEqual(done.traitorReserve, reserve.slice(1));
  assert.deepEqual(player(done, f.owner).traitors, [...held.filter(c => c !== target.id), reserve[0]]);
  assert.equal('replacement' in viewGame(done, f.opponent).moritaniAssassinate!.history.at(-1)!, false);
  assert.equal(done.leaderSkills!.offers[f.opponent], undefined);
  reject(done, f.owner, action);
  const placed = cunning(f, done);
  assert.equal(placed.after.nexusCards!.cards!.hands[f.owner], null);
  assert.equal(placed.after.moritaniTerror!.tokens.find(t => t.kind === 'robbery')!.location, 'red_chasm');
  assert.deepEqual(placed.after.leaderSkills, done.leaderSkills);
  custody(placed.after);
});

void test('normal Traitor call forfeits Advanced assassination; Basic losses never grant its power, while original Cunning remains available', () => {
  const advanced = fixture({ native: 'moritani' }), closing = close(advanced);
  const called = open(advanced, closing.game, { normalCall: true }), revealed = reveal(called);
  assert.ok(player(advanced.trained, advanced.owner).traitors.includes(called.enemyLeader));
  assert.equal(called.enemyLeader, advanced.target);
  let done = aftermath(revealed, [advanced.owner]);
  assert.notEqual(done.decision?.kind, 'moritaniAssassinate');
  done = finish(done);
  assert.equal(player(done, advanced.opponent).leaders.find(l => l.id === called.enemyLeader)!.dead, true);
  const held = [...player(done, advanced.owner).traitors], reserve = [...done.traitorReserve!];
  done = advance(done, g => g.decision?.kind === 'moritaniPlacement');
  assert.deepEqual(player(done, advanced.owner).traitors, held); assert.deepEqual(done.traitorReserve, reserve);
  custody(done);
  const basic = fixture({ native: 'moritani', rules: 'basic', tech: true }), basicClose = close(basic);
  const battle = open(basic, basicClose.game), basicReveal = reveal(battle), loss = aftermath(basicReveal);
  assert.equal(loss.moritaniAssassinate, undefined);
  assert.equal(player(loss, basic.owner).spice, player(basicReveal, basic.owner).spice);
  reject(loss, basic.owner, { type: 'decision', event: 'not-earned', card: basic.target });
  assert.equal(player(loss, basic.opponent).leaders.find(l => l.id === basic.target)!.dead, false);
  const finished = finish(loss), placed = cunning(basic, finished);
  assert.equal(placed.after.nexusCards!.cards!.hands[basic.owner], null);
  assert.equal(placed.after.moritaniTerror!.tokens.find(t => t.kind === 'robbery')!.location, 'red_chasm');
  assert.equal(placed.after.moritaniAssassinate, undefined); custody(placed.after);
});

void test('all four minimal policies act for the eligible native Cunning/assassination and cleanup owner with physical consumer outcomes', () => {
  const ecaz = fixture({ native: 'ecaz' }), ecazClosing = close(ecaz), ecazCunning = cunning(ecaz, ecazClosing.game);
  const moritani = fixture({ native: 'moritani', tech: true }), moritaniClosing = close(moritani);
  const battle = open(moritani, moritaniClosing.game), pending = aftermath(reveal(battle));
  assert.equal(pending.decision?.kind, 'moritaniAssassinate');
  for (const difficulty of DIFFICULTIES) {
    const ecazAction = policy(ecazCunning.before, ecaz.owner, difficulty)[0]; assert.ok(ecazAction);
    const acquired = step(structuredClone(ecazCunning.before), { actor: ecaz.owner, action: ecazAction });
    assert.equal(acquired.dukeVidal!.controller, ecaz.owner); assert.equal(acquired.nexusCards!.cards!.hands[ecaz.owner], null);
    assert.deepEqual(acquired.leaderSkills, ecazCunning.before.leaderSkills);
    const action = policy(pending, pending.decision!.player, difficulty)[0]; assert.ok(action);
    let game = step(structuredClone(pending), { actor: pending.decision!.player, action });
    assert.equal(player(game, moritani.opponent).leaders.find(l => l.id === moritani.target)!.dead, true);
    assert.equal(player(game, moritani.owner).spice, player(pending, moritani.owner).spice + 3);
    assert.equal(game.decision?.kind, 'battleCards');
    const cleanupActor = game.decision!.player, cleanup = policy(game, cleanupActor, difficulty)[0]; assert.ok(cleanup);
    game = finish(step(game, { actor: cleanupActor, action: cleanup }));
    assert.equal(game.battle, null); assert.equal(player(game, moritani.owner).hand.some(c => c.id === battle.card), false);
    game = advance(game, g => g.decision?.kind === 'moritaniPlacement');
    assert.equal(player(game, moritani.owner).traitors.includes(moritani.target!), false);
    assert.equal(game.leaderSkills!.assignments.some(a => a.leader === moritani.target), false);
    custody(game);
  }
});
