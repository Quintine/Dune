import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, joinGame, newPlayer, normalizeAutomaticGame, viewGame, type Game } from '../game/engine';
import type { FactionId } from '../game/catalog';
import { DIFFICULTIES } from '../game/bot-profiles';
import { ownedTech } from '../game/tech-tokens';
import { strongholdControllers } from '../game/stronghold-cards';
import { territory } from '../game/board';
import { quoteNexusSkillsModulesBattle } from './fixture-nexus-skills-modules-battles';
import { quoteStrongholdFactionsBattle } from './fixture-stronghold-factions';
import { assassinationPhysical } from './moritani-assassinate-fixture';
import { holdMoritaniStrongholdsTraitor } from './fixture-moritani-strongholds';
import {
  advanceMoritaniNexusSkillsModules as advance, allowMoritaniNexusSkillsModules as allow,
  assertMoritaniNexusSkillsModulesCustody as custody, cancelMoritaniNexusSkillsModules as cancel,
  completeMoritaniNexusSkillsModulesSetup, createMoritaniNexusSkillsModulesFixture as fixture,
  finishMoritaniNexusSkillsModulesBattle as finishBattle, initializeMoritaniNexusSkillsModulesOffers,
  moritaniNexusSkillsModulesClean as clean, moritaniNexusSkillsModulesPlayer as player,
  moritaniNexusSkillsModulesPolicy as policy, moritaniNexusSkillsModulesRequest as request,
  moritaniNexusSkillsModulesToken as token, nextMoritaniNexusSkillsModulesStep,
  rejectMoritaniNexusSkillsModulesAction as reject, resolveMoritaniNexusSkillsModulesBattle as resolve,
  revealMoritaniNexusSkillsModulesPlans as reveal, stageMoritaniNexusSkillsModulesBattle as stage,
  settleMoritaniNexusSkillsModulesBoundary,
  type MoritaniNexusSkillsModulesOptions,
} from './fixture-moritani-nexus-skills-modules';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game)) as Game;
function physicalPlayers(game: Game) {
  return game.players.map(p => ({ id: p.id, spice: p.spice, forces: p.forces, reserves: p.reserves, tanks: p.tanks, elites: p.elites }));
}
function assassinate(game: Game, card: string | null): Game {
  const d = game.decision;
  if (d?.kind !== 'moritaniAssassinate') throw Error('An original post-loss assassination choice is required');
  return applyAction(game, d.player, { type: 'decision', event: d.event, ...(card === null ? { decline: true } : { card }) });
}
const bands: MoritaniNexusSkillsModulesOptions[] = [
  { rules: 'basic', tech: false, strongholds: false },
  { rules: 'advanced', tech: false, strongholds: false },
  { rules: 'basic', tech: true, strongholds: false },
  { rules: 'advanced', tech: true, strongholds: false },
  { rules: 'advanced', tech: false, strongholds: true },
  { rules: 'advanced', tech: true, strongholds: true },
];

void test('original standalone E3 skill-first admission conserves ecaz33/all14/all12 across no-module and selected-module two-to-six-seat bands', () => {
  const factions: FactionId[] = ['moritani', 'guild', 'emperor', 'atreides', 'fremen', 'beneGesserit'];
  for (const options of bands) for (let count = options.tech ? 3 : 2; count <= 6; count++) {
    const lobby = createGame(`MORINEXUSAUTH${count}`, newPlayer('authenticated-m', 'Original Moritani', 'moritani'), options.rules === 'advanced', ['ecaz']);
    for (let i = 1; i < count; i++) joinGame(lobby, newPlayer(`authenticated-${i}`, `Original ${factions[i]}`, factions[i]));
    const before = structuredClone(lobby), offered = initializeMoritaniNexusSkillsModulesOffers({ ...options, initial: lobby });
    assert.deepEqual(lobby, before);
    assert.deepEqual(offered.players.map(p => ({ id: p.id, name: p.name, faction: p.faction })), before.players.map(p => ({ id: p.id, name: p.name, faction: p.faction })));
    assert.equal(offered.setupStage, 'leaderSkills'); assert.ok(offered.players.every(p => p.traitors.length === 0));
    for (const p of offered.players) assert.equal(viewGame(offered, p.id).leaderSkills!.offer!.cards.length, 2);
    assert.equal(!!offered.moritaniAssassinate, options.rules === 'advanced');
    assert.deepEqual(initializeMoritaniNexusSkillsModulesOffers({ ...options, initial: reload(offered) }), offered, 'Undealt original CLI continuation must not replace actual offers');
    const guild = offered.players.find(p => p.faction === 'guild')!.id;
    const unavailable = viewGame(offered, guild).leaderSkills!.offer!.cards.includes('sandmaster') ? 'swordmaster-of-ginaz' : 'sandmaster';
    assert.ok(!viewGame(offered, guild).leaderSkills!.offer!.cards.includes(unavailable));
    assert.throws(() => completeMoritaniNexusSkillsModulesSetup(reload(offered), { guildSkill: unavailable }));
    const setup = completeMoritaniNexusSkillsModulesSetup(offered), moritani = player(setup, 'authenticated-m');
    assert.equal(moritani.reserves, 14); assert.equal(Object.values(moritani.forces).reduce((a, b) => a + b, 0), 6);
    const startingSite = Object.keys(moritani.forces)[0].split(':')[0];
    assert.ok(setup.players.filter(p => p.id !== moritani.id).every(p => !Object.entries(p.forces).some(([key, n]) => n > 0 && key.startsWith(`${startingSite}:`))));
    assert.equal(setup.leaderSkills!.assignments.find(a => a.owner === guild)!.skill, 'suk-graduate');
    assert.equal(!!setup.techTokens, !!options.tech); assert.equal(!!setup.strongholdCards, !!options.strongholds);
    if (setup.strongholdCards) assert.ok(Object.values(setup.strongholdCards.owners).every(owner => owner === null));
    custody(setup);
    if (count === 2) assert.throws(() => fixture({ ...options, initial: reload(lobby) }), /two other original alliance seats/);
  }
});

void test('Basic original Harkonnen remains native while Advanced excludes capture bounds and paired/foreign E3 rosters', () => {
  const basic = initializeMoritaniNexusSkillsModulesOffers({ rules: 'basic', factions: ['moritani', 'guild', 'harkonnen'] });
  const setup = completeMoritaniNexusSkillsModulesSetup(basic);
  assert.equal(player(setup, 'harkonnen').traitors.length, 4); assert.equal(setup.moritaniAssassinate, undefined); custody(setup);
  for (const faction of ['harkonnen', 'ecaz', 'ixians', 'richese', 'tleilaxu', 'choam'] as FactionId[])
    assert.throws(() => initializeMoritaniNexusSkillsModulesOffers({ rules: 'advanced', factions: ['moritani', 'guild', faction] }));
  assert.throws(() => initializeMoritaniNexusSkillsModulesOffers({ rules: 'basic', strongholds: true }));
  assert.throws(() => initializeMoritaniNexusSkillsModulesOffers({ tech: true, factions: ['moritani', 'guild'] }));
  assert.throws(() => initializeMoritaniNexusSkillsModulesOffers({ initial: setup }), /original lobby or undealt/);
});

void test('Tech custody comes from the first real Storm, Strongholds from END Mentat, and Cunning from the genuine worm/alliance closing draw', () => {
  const f = fixture({ tech: true, strongholds: true });
  assert.ok(Object.values(f.initial.techTokens!).every(t => t.owner === null));
  for (const p of f.afterFirstStorm.players) assert.equal(ownedTech(f.afterFirstStorm.techTokens, p.id).length, 1);
  assert.ok(Object.values(f.initial.strongholdCards!.owners).every(owner => owner === null));
  const claimed = applyAction(reload(f.beforeFirstMentat), f.firstMentatStep.actor, f.firstMentatStep.action);
  assert.equal(claimed.turn, 2);
  assert.deepEqual(claimed.strongholdCards!.owners, strongholdControllers(f.beforeFirstMentat.players, false));
  assert.deepEqual(claimed.strongholdCards, f.afterFirstMentat.strongholdCards);
  let allied = reload(f.beforeAlliance);
  for (const next of f.allianceActions) allied = applyAction(allied, next.actor, next.action);
  assert.equal(player(allied, f.opponent).ally, f.partner); assert.equal(player(allied, f.partner).ally, f.opponent);
  assert.equal(player(allied, f.moritani).ally, null);
  assert.equal(f.beforeClosingDraw.nexusCards!.phase!.stage, 'drawing');
  assert.ok(f.beforeClosingDraw.nexusCards!.phase!.eligible.includes(f.moritani));
  assert.equal(f.beforeClosingDraw.nexusCards!.cards!.hands[f.moritani], null);
  const drawn = applyAction(reload(f.beforeClosingDraw), f.closingDrawStep.actor, f.closingDrawStep.action);
  assert.equal(drawn.nexusCards!.cards!.hands[f.moritani], 'moritani');
  assert.deepEqual(drawn.nexusCards, f.afterClosingDraw.nexusCards);
  reject(drawn, f.moritani, f.closingDrawStep.action);
  for (const g of [f.initial, f.afterSetup, f.afterFirstStorm, f.afterFirstMentat, drawn, f.pending, f.game]) custody(g);
});

void test('genuine Cunning declares only supply into static Arrakis or an existing stack; allowance commits once and cancellation spends the card and attempt without moving a token', () => {
  for (const rules of ['basic', 'advanced'] as const) for (const site of ['red_chasm', 'sihaya_ridge', 'polar_sink', 'arrakeen']) {
    const f = fixture({ rules, stack: true }), original = reload(f.game), action = request(original, f.moritani, 'robbery', site);
    reject(original, f.opponent, action); reject(original, f.moritani, { ...action, nexus: 'stale' });
    reject(original, f.moritani, { ...action, token: token(original, 'sabotage').id });
    for (const bad of ['grumman', 'hidden_mobile_stronghold', 'unknown']) reject(original, f.moritani, { ...action, territory: bad });
    const nativeAttempt = { type: 'decision', token: token(original, 'robbery').id, territory: site };
    reject(original, f.moritani, nativeAttempt);
    const declared = applyAction(reload(original), f.moritani, action);
    assert.equal(declared.response?.kind, 'moritaniPlacement'); assert.deepEqual(declared.moritaniTerror, original.moritaniTerror);
    assert.equal(declared.nexusCards!.cards!.hands[f.moritani], null);
    assert.equal(declared.nexusCards!.cards!.discard.filter(c => c === 'moritani').length, 1);
    const allowed = allow(reload(declared));
    assert.equal(token(allowed, 'robbery').status, 'placed'); assert.equal(token(allowed, 'robbery').location, site);
    assert.equal(allowed.moritaniTerror!.placementTurn, 2); assert.equal(allowed.nexusMoritaniLast!.stage, 'complete');
    assert.deepEqual(allowed.moritaniTerror!.tokens.filter(t => t.kind !== 'robbery'), original.moritaniTerror!.tokens.filter(t => t.kind !== 'robbery'));
    assert.deepEqual(physicalPlayers(allowed), physicalPlayers(original));
    assert.deepEqual(allowed.leaderSkills, original.leaderSkills); assert.deepEqual(allowed.techTokens, original.techTokens); assert.deepEqual(allowed.strongholdCards, original.strongholdCards);
    if (site === 'arrakeen') assert.equal(allowed.moritaniTerror!.tokens.filter(t => t.location === site).length, 2);
    const canceled = cancel(reload(declared), f.opponent, f.karama);
    assert.equal(canceled.nexusMoritaniLast!.stage, 'canceled'); assert.equal(canceled.moritaniTerror!.placementTurn, 2);
    assert.deepEqual(canceled.moritaniTerror!.tokens, original.moritaniTerror!.tokens);
    assert.equal(canceled.nexusCards!.cards!.hands[f.moritani], null);
    assert.equal(canceled.discard.filter(c => c.id === f.karama).length, 1);
    assert.deepEqual(physicalPlayers(canceled), physicalPlayers(original));
    for (const settled of [allowed, canceled]) {
      reject(settled, f.moritani, action); reject(settled, f.moritani, { type: 'decision', token: token(settled, 'extortion').id, territory: 'carthag' });
      assert.deepEqual(normalizeAutomaticGame(reload(settled)), settled); custody(settled);
      for (const p of settled.players.filter(p => p.id !== f.moritani)) {
        assert.equal(viewGame(settled, p.id).nexusMoritani, null);
        assert.equal('nexusMoritaniHistory' in viewGame(settled, p.id), false);
        assert.ok(viewGame(settled, p.id).moritaniTerror!.tokens.filter(t => t.status === 'placed').every(t => !('kind' in t)));
      }
    }
  }
});

void test('ordinary later relocation remains native-only and does not reuse the historical expanded Cunning placement', () => {
  const f = fixture({ stack: true });
  let game = allow(applyAction(reload(f.game), f.moritani, request(f.game, f.moritani)));
  const placedId = token(game, 'robbery').id;
  game = advance(game, s => s.turn === 3 && s.decision?.kind === 'moritaniPlacement');
  assert.equal(token(game, 'robbery').location, 'red_chasm');
  assert.equal(game.nexusCards!.cards!.hands[f.moritani], null);
  reject(game, f.moritani, { type: 'decision', token: placedId, territory: 'sihaya_ridge' });
  reject(game, f.moritani, { type: 'decision', token: placedId, territory: 'arrakeen' });
  reject(game, f.moritani, { type: 'decision', token: placedId, territory: 'hidden_mobile_stronghold' });
  const before = reload(game);
  game = allow(applyAction(game, f.moritani, { type: 'decision', token: placedId, territory: 'carthag' }));
  assert.equal(token(game, 'robbery').id, placedId); assert.equal(token(game, 'robbery').location, 'carthag');
  assert.equal(game.moritaniTerror!.placementTurn, 3); assert.equal(game.nexusMoritaniLocations?.[placedId], undefined);
  assert.deepEqual(game.nexusMoritaniHistory, before.nexusMoritaniHistory);
  assert.deepEqual(physicalPlayers(game), physicalPlayers(before)); custody(game);
});

void test('normal held Suk physical rescue precedes unused-disc assassination, cleanup and original winner Tech; printed bounty and one private actual Mentat replacement do not replay settlement', () => {
  const f = fixture({ tech: true, strongholds: true, holder: 'moritani' }), pending = f.pending;
  assert.equal(pending.lastBattleContext!.result, 'normal'); assert.equal(pending.lastBattleContext!.winner, f.opponent);
  assert.equal(pending.lastBattleContext!.sukRescue!.completed, true); assert.equal(pending.decision!.kind, 'moritaniAssassinate');
  assert.equal(player(pending, f.opponent).tanks, player(f.revealed, f.opponent).tanks + 2);
  assert.equal(player(pending, f.opponent).reserves, player(f.revealed, f.opponent).reserves + 1);
  assert.equal(player(pending, f.moritani).tanks, player(f.revealed, f.moritani).tanks + 6);
  const target = player(pending, f.opponent).leaders.find(l => l.id === f.target)!;
  assert.equal(target.name, 'Master Bewt'); assert.equal(target.strength, 3); assert.equal(target.dead, false); assert.notEqual(target.id, f.opponentLeader);
  const quoted = quoteStrongholdFactionsBattle(f.revealed);
  assert.deepEqual(quoted.strongholdIncome, [{ player: f.moritani, amount: 4 }]);
  const skilledQuote = quoteNexusSkillsModulesBattle(f.revealed);
  const heldBonus = f.revealed.battle!.attacker === f.moritani ? skilledQuote.leaderSkillBonuses.attacker : skilledQuote.leaderSkillBonuses.defender;
  assert.equal(heldBonus.bonus, 1, 'The unused face-up Warmaster still adds its printed +1 to the other disc using Worthless.');
  assert.ok(heldBonus.applied.some(b => b.skill === 'warmaster' && b.mode === 'normal' && b.amount === 1));
  assert.equal(player(pending, f.moritani).spice, player(f.revealed, f.moritani).spice - 1 + 4);
  assert.equal(player(pending, f.opponent).spice, player(f.revealed, f.opponent).spice - 3);
  const d = pending.decision;
  if (d?.kind !== 'moritaniAssassinate') throw Error('Expected loss choice');
  assert.equal(viewGame(pending, f.moritani).moritaniAssassinate!.pending!.cards.find(c => c.card === target.id)!.bounty, 3);
  const action = { type: 'decision', event: d.event, card: target.id };
  reject(pending, f.opponent, action); reject(pending, f.moritani, { ...action, event: 'stale' });
  reject(pending, f.moritani, { ...action, card: f.opponentLeader });
  const inventory = assassinationPhysical(pending), reserve = [...pending.traitorReserve!], traitors = [...player(pending, f.moritani).traitors];
  const retained = pending.leaderSkills!.assignments.filter(a => a.leader !== target.id);
  let game = assassinate(reload(pending), target.id);
  assert.equal(player(game, f.opponent).leaders.find(l => l.id === target.id)!.dead, true);
  assert.equal(player(game, f.opponent).leaders.find(l => l.id === target.id)!.deaths, target.deaths + 1);
  assert.deepEqual(game.leaderSkills!.assignments, retained); assert.equal(game.leaderSkills!.deck.filter(c => c === 'suk-graduate').length, 1);
  assert.equal(player(game, f.moritani).spice, player(pending, f.moritani).spice + 3);
  assert.equal(player(game, f.opponent).spice, player(pending, f.opponent).spice);
  assert.deepEqual(game.players.map(p => ({ id: p.id, forces: p.forces, reserves: p.reserves, tanks: p.tanks })), pending.players.map(p => ({ id: p.id, forces: p.forces, reserves: p.reserves, tanks: p.tanks })));
  assert.deepEqual(game.strongholdCards, pending.strongholdCards); assert.deepEqual(game.techTokens, pending.techTokens);
  assert.equal(game.nexusCards!.cards!.hands[f.moritani], 'moritani');
  assert.equal(game.decision?.kind, 'battleCards'); assert.equal(game.decision?.player, f.opponent);
  const cleanupBoundary = settleMoritaniNexusSkillsModulesBoundary(game, f.moritani);
  assert.equal(cleanupBoundary.kind, 'cards');
  assert.deepEqual(cleanupBoundary.game.techTokens, pending.techTokens, 'A human card decision must precede winner Tech custody');
  game = applyAction(game, f.opponent, { type: 'decision', discard: f.opponentCards });
  game = finishBattle(game);
  for (const card of [...f.moritaniCards, ...f.opponentCards]) assert.equal(game.discard.filter(c => c.id === card).length, 1);
  const captured = ownedTech(pending.techTokens, f.moritani)[0]; assert.ok(captured);
  assert.equal(game.techTokens![captured].owner, f.opponent);
  for (const held of ownedTech(pending.techTokens, f.opponent)) assert.equal(game.techTokens![held].owner, f.opponent);
  assert.equal(game.strongholdCards!.owners.tueks_sietch, f.moritani, 'Battle control cannot preempt END Mentat card custody');
  game = advance(game, s => s.decision?.kind === 'moritaniPlacement');
  const receipt = game.moritaniAssassinate!.opportunities.at(-1)!;
  assert.equal(receipt.stage, 'replaced'); assert.equal(receipt.replacement, reserve[0]);
  assert.deepEqual(game.traitorReserve, reserve.slice(1));
  assert.deepEqual(player(game, f.moritani).traitors, [...traitors.filter(c => c !== target.id), reserve[0]]);
  assert.deepEqual(assassinationPhysical(game), inventory);
  assert.equal('replacement' in viewGame(game, f.opponent).moritaniAssassinate!.history.at(-1)!, false);
  assert.equal('traitors' in viewGame(game, f.opponent).players.find(p => p.id === f.moritani)!, false);
  assert.equal(game.leaderSkills!.offers[f.opponent], undefined, 'Original replacement Traitor is not foreign replacement training');
  reject(game, f.moritani, action); custody(game);
  const placed = allow(applyAction(game, f.moritani, request(game, f.moritani)));
  game = advance(placed, s => s.turn === 3 && s.phase === 4 && clean(s));
  assert.equal(game.traitorReserve!.length, reserve.length - 1);
  assert.equal(game.moritaniAssassinate!.opportunities.length, 1);
  reject(game, f.opponent, { type: 'reviveLeader', leader: target.id }); custody(game);
});

void test('selected-disc-only empty menu can decline without removing Suk or drawing a replacement, while every component band preserves the original loss aftermath', () => {
  for (const options of bands) {
    const f = fixture(options), pending = f.pending;
    assert.equal(pending.lastBattleContext!.winner, f.opponent); assert.equal(pending.lastBattleContext!.result, 'normal');
    assert.equal(pending.lastBattleContext!.sukRescue!.completed, true);
    assert.equal(player(pending, f.opponent).tanks, 2); assert.equal(player(pending, f.moritani).tanks, 6);
    assert.equal(!!pending.techTokens, !!options.tech); assert.equal(!!pending.strongholdCards, !!options.strongholds);
    if (options.rules === 'basic') {
      assert.equal(pending.moritaniAssassinate, undefined);
      assert.equal(player(pending, f.opponent).spice, player(f.revealed, f.opponent).spice);
      assert.equal(player(pending, f.moritani).spice, player(f.revealed, f.moritani).spice);
      reject(pending, f.moritani, { type: 'decision', event: 'not-earned', card: f.target });
      assert.ok(pending.leaderSkills!.assignments.some(a => a.leader === f.target && a.skill === 'suk-graduate'));
      if (options.tech) {
        const lost = ownedTech(f.revealed.techTokens, f.moritani)[0]; assert.ok(lost); assert.equal(pending.techTokens![lost].owner, f.opponent);
      }
    } else {
      assert.equal(pending.decision!.kind, 'moritaniAssassinate');
      let game = assassinate(reload(pending), f.target); game = finishBattle(game);
      game = advance(game, s => s.decision?.kind === 'moritaniPlacement');
      assert.equal(game.moritaniAssassinate!.opportunities.at(-1)!.stage, 'replaced');
      assert.equal(game.leaderSkills!.deck.filter(c => c === 'suk-graduate').length, 1);
      if (options.tech) {
        const lost = ownedTech(pending.techTokens, f.moritani)[0]; assert.ok(lost); assert.equal(game.techTokens![lost].owner, f.opponent);
      }
      custody(game);
    }
    custody(pending);
  }
  const f = fixture(); let empty = reload(f.plans);
  holdMoritaniStrongholdsTraitor(empty, f.moritani, f.opponentLeader);
  empty = resolve(reveal(empty, f.planActions), f.moritani);
  assert.deepEqual(viewGame(empty, f.moritani).moritaniAssassinate!.pending!.cards, []);
  const reserve = [...empty.traitorReserve!], skills = structuredClone(empty.leaderSkills);
  const d = empty.decision;
  if (d?.kind !== 'moritaniAssassinate') throw Error('Expected empty unused-leader menu');
  reject(empty, f.moritani, { type: 'decision', event: d.event, card: f.opponentLeader });
  const declined = advance(finishBattle(assassinate(empty, null)), s => s.decision?.kind === 'moritaniPlacement');
  assert.equal(declined.moritaniAssassinate!.opportunities.at(-1)!.stage, 'declined');
  assert.deepEqual(declined.traitorReserve, reserve); assert.deepEqual(declined.leaderSkills, skills); custody(declined);
});

void test('normal Traitor declaration forfeits Advanced assassination for the rest of the original game, including a later real normal loss', () => {
  const f = fixture({ tech: true, strongholds: true, normalCall: true });
  assert.equal(f.pending.lastBattleContext!.result, 'traitor'); assert.equal(f.pending.lastBattleContext!.winner, f.moritani);
  assert.equal(f.pending.moritaniAssassinate!.normalTraitorCall, true);
  assert.equal(f.pending.moritaniAssassinateCallEvents!.length, 1); assert.deepEqual(f.pending.moritaniAssassinate!.opportunities, []);
  let game = advance(reload(f.game), s => s.turn === 3 && s.phase === 5 && clean(s));
  stage(game, f.moritani, f.opponent); holdMoritaniStrongholdsTraitor(game, f.moritani, f.target);
  const assigned = new Set(game.leaderSkills!.assignments.map(a => a.leader));
  const winner = player(game, f.opponent).leaders.filter(l => !l.dead && !assigned.has(l.id)).sort((a, b) => b.strength - a.strength)[0];
  const loser = player(game, f.moritani).leaders.filter(l => !l.dead && !assigned.has(l.id)).sort((a, b) => a.strength - b.strength)[0];
  assert.ok(winner && loser);
  game = advance(game, s => s.phase === 6 && clean(s));
  const actor = game.active!;
  game = applyAction(game, actor, { type: 'chooseBattle', territory: 'tueks_sietch', target: actor === f.moritani ? f.opponent : f.moritani });
  game = advance(game, s => !!s.battle && !s.battle.revealed && !nextMoritaniNexusSkillsModulesStep(s));
  game = reveal(game, [
    { actor: f.moritani, action: { type: 'battlePlan', leader: loser.id, dial: 0, support: 0 } },
    { actor: f.opponent, action: { type: 'battlePlan', leader: winner.id, dial: 3, support: 3 } },
  ]);
  game = finishBattle(resolve(game, f.moritani));
  assert.equal(game.lastBattleContext!.result, 'normal'); assert.equal(game.lastBattleContext!.winner, f.opponent);
  assert.equal(game.moritaniAssassinate!.normalTraitorCall, true); assert.equal(game.moritaniAssassinateCallEvents!.length, 1);
  assert.deepEqual(game.moritaniAssassinate!.opportunities, []);
  assert.equal(player(game, f.opponent).leaders.find(l => l.id === f.target)!.dead, false); custody(game);
});

void test('Basic Cunning placement leads to genuine later legal Terror on a real shipment without granting Advanced assassination', () => {
  const f = fixture({ rules: 'basic' });
  let game = allow(applyAction(reload(f.game), f.moritani, request(f.game, f.moritani, 'robbery', 'red_chasm')));
  game = advance(game, s => s.turn === 3 && s.phase === 5 && s.active === f.opponent && clean(s));
  const sector = territorySector(game, 'red_chasm');
  game = applyAction(game, f.opponent, { type: 'ship', territory: 'red_chasm', sector, amount: 3 });
  game = allow(game);
  assert.equal(game.pendingTerrorEntry!.stage, 'offer'); assert.equal(viewGame(game, f.moritani).terrorEntry!.kind, 'robbery');
  assert.equal(viewGame(game, f.opponent).terrorEntry!.kind, undefined);
  const before = reload(game);
  game = applyAction(game, f.moritani, { type: 'decision', reveal: true });
  game = applyAction(game, f.moritani, { type: 'decision', choice: 'spice' });
  const taken = Math.ceil(player(before, f.opponent).spice / 2);
  assert.equal(player(game, f.moritani).spice, player(before, f.moritani).spice + taken);
  assert.equal(player(game, f.opponent).spice, player(before, f.opponent).spice - taken);
  assert.equal(token(game, 'robbery').status, 'removed'); assert.equal(game.pendingTerrorEntry, null);
  assert.equal(player(game, f.opponent).forces[`red_chasm:${sector}`], 3);
  assert.equal(game.moritaniAssassinate, undefined); reject(game, f.moritani, { type: 'decision', reveal: true }); custody(game);
});

void test('all four minimal legal policies commit actual Cunning and post-loss choices without duplicating custody, rescue, bounty or replacement', () => {
  const f = fixture({ tech: true, strongholds: true, stack: true });
  const basic = fixture({ rules: 'basic', stack: true });
  for (const source of [f, basic]) {
    const enemy = player(source.game, source.opponent), key = `red_chasm:${territorySector(source.game, 'red_chasm')}`;
    assert.ok(enemy.reserves > 0);
    enemy.reserves--;
    enemy.forces[key] = (enemy.forces[key] ?? 0) + 1;
    source.staging.push('Conserved one original Guild reserve counter at Red Chasm as a useful non-stronghold Cunning policy target; not played movement.');
  }
  let empty = reload(f.plans);
  holdMoritaniStrongholdsTraitor(empty, f.moritani, f.opponentLeader);
  empty = resolve(reveal(empty, f.planActions), f.moritani);
  for (const difficulty of DIFFICULTIES) {
    const action = policy(reload(f.game), f.moritani, difficulty)[0]; assert.ok(action, difficulty);
    const placed = allow(applyAction(reload(f.game), f.moritani, action));
    assert.equal(placed.nexusCards!.cards!.hands[f.moritani], null);
    assert.equal(placed.moritaniTerror!.placementTurn, 2); assert.equal(placed.nexusMoritaniLast!.stage, 'complete');
    assert.equal(placed.moritaniTerror!.tokens.filter(t => t.status === 'placed').length, 2);
    assert.deepEqual(physicalPlayers(placed), physicalPlayers(f.game)); custody(placed);
    const basicAction = policy(reload(basic.game), basic.moritani, difficulty)[0]; assert.ok(basicAction, difficulty);
    const basicPlaced = allow(applyAction(reload(basic.game), basic.moritani, basicAction));
    assert.equal(basicPlaced.nexusCards!.cards!.hands[basic.moritani], null);
    assert.equal(basicPlaced.moritaniTerror!.placementTurn, 2); assert.equal(basicPlaced.moritaniAssassinate, undefined);
    assert.deepEqual(physicalPlayers(basicPlaced), physicalPlayers(basic.game)); custody(basicPlaced);
    const lossChoice = policy(reload(f.pending), f.moritani, difficulty)[0]; assert.ok(lossChoice, difficulty);
    let game = applyAction(reload(f.pending), f.moritani, lossChoice);
    assert.equal(game.moritaniAssassinate!.opportunities.at(-1)!.stage, 'revealed');
    assert.equal(game.moritaniAssassinate!.opportunities.at(-1)!.card, f.target);
    assert.equal(player(game, f.opponent).leaders.find(l => l.id === f.target)!.dead, true);
    assert.equal(player(game, f.moritani).spice, player(f.pending, f.moritani).spice + 3);
    game = finishBattle(game); game = advance(game, s => s.decision?.kind === 'moritaniPlacement');
    assert.equal(game.moritaniAssassinate!.opportunities.at(-1)!.stage, 'replaced');
    assert.equal(player(game, f.opponent).tanks, 2); assert.equal(player(game, f.moritani).tanks, 6);
    assert.equal(game.leaderSkills!.deck.filter(c => c === 'suk-graduate').length, 1); custody(game);
    const decline = policy(reload(empty), f.moritani, difficulty)[0]; assert.ok(decline, difficulty);
    const declined = applyAction(reload(empty), f.moritani, decline);
    assert.equal(declined.moritaniAssassinate!.opportunities.at(-1)!.stage, 'declined');
    assert.deepEqual(declined.leaderSkills, empty.leaderSkills);
    assert.deepEqual(declined.traitorReserve, empty.traitorReserve);
    assert.equal(player(declined, f.moritani).spice, player(empty, f.moritani).spice); custody(finishBattle(declined));
  }
});

function territorySector(game: Game, id: string): number {
  // Only physical board sectors are chosen; the original Storm is never edited.
  const site = territory(id);
  const sector = site.sectors.find(s => s !== game.storm); assert.ok(sector !== undefined); return sector;
}
