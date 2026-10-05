import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Game } from '../game/engine';
import { leaders, treacheryDeck } from '../game/cards';
import { DIFFICULTIES } from '../game/bot-profiles';
import type { FactionId } from '../game/catalog';
import { validateDiscoveryState } from '../game/discoveries';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { strongholdControllers } from '../game/stronghold-cards';
import { ownedTech } from '../game/tech-tokens';
import { traitorDeck } from '../game/traitors';
import { quoteStrongholdFactionsBattle } from './fixture-stronghold-factions';
import { holdMoritaniStrongholdsTraitor } from './fixture-moritani-strongholds';
import {
  advanceDiscoveryNativeE3Skills as advance, completeDiscoveryNativeE3SkillsSetup,
  createDiscoveryNativeE3SkillsFixture as fixture, createDiscoveryNativeE3SkillsRevivalFixture,
  discoveryNativeE3SkillsClean as clean, discoveryNativeE3SkillsPlayer as player,
  discoveryNativeE3SkillsPolicy as policy, initializeDiscoveryNativeE3Skills,
  nextDiscoveryNativeE3SkillsStep, resolveDiscoveryNativeE3SkillsBattle,
  finishDiscoveryNativeE3SkillsBattles,
  revealDiscoveryNativeE3SkillsPlans,
  type DiscoveryNativeE3SkillsOptions,
} from './fixture-discovery-native-e3-skills';

function custody(game: Game): void {
  validateLeaderSkills(game.leaderSkills!, game.players); validateDiscoveryState(game.discoveries!);
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.auction?.cards.slice(game.auction.index) ?? [])].map(c => c.id).sort();
  assert.deepEqual(cards, treacheryDeck(['ecaz']).map(c => c.id).sort());
  const skills = [...game.leaderSkills!.deck, ...Object.values(game.leaderSkills!.offers).flatMap(o => o.cards),
    ...game.leaderSkills!.assignments.map(a => a.skill)].sort();
  assert.deepEqual(skills, LEADER_SKILL_CARDS.map(c => c.id).sort());
  const retired = game.moritaniAssassinate?.opportunities.filter(receipt => receipt.stage === 'replaced').map(receipt => receipt.card!) ?? [];
  assert.deepEqual([...game.traitorReserve!, ...game.players.flatMap(p => [...p.traitors, ...p.traitorChoices]), ...retired].sort(),
    traitorDeck(game.players).sort());
  for (const p of game.players) {
    assert.deepEqual(p.leaders.map(l => l.id).sort(), leaders(p.faction).map(l => l.id).sort());
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0), 20);
    if (p.elites) {
      assert.equal(p.elites.reserves + p.elites.tanks + Object.values(p.elites.forces).reduce((a, b) => a + b, 0), p.faction === 'fremen' ? 3 : 5);
      for (const [key, amount] of Object.entries(p.elites.forces)) assert.ok(amount <= (p.forces[key] ?? 0));
    }
  }
}
function assassinate(game: Game, card: string | null): Game {
  const d = game.decision; assert.equal(d?.kind, 'moritaniAssassinate');
  if (d?.kind !== 'moritaniAssassinate') throw Error('Expected actual original nested loss opportunity.');
  return applyAction(structuredClone(game), d.player, { type: 'decision', event: d.event,
    ...(card === null ? { decline: true } : { card }) });
}

void test('authenticated original Moritani/classic Discovery preserves native all14 training before Traitors at Basic/Advanced module seat boundaries', () => {
  const cases: { options: DiscoveryNativeE3SkillsOptions; counts: number[] }[] = [
    { options: { rules: 'basic', tech: false, strongholds: false }, counts: [2, 6] },
    { options: { rules: 'basic', tech: true, strongholds: false }, counts: [3, 6] },
    { options: { rules: 'advanced', tech: false, strongholds: false }, counts: [2, 6] },
    { options: { rules: 'advanced', tech: true, strongholds: false }, counts: [3, 6] },
    { options: { rules: 'advanced', tech: false, strongholds: true }, counts: [2, 6] },
    { options: { rules: 'advanced', tech: true, strongholds: true }, counts: [3, 6] },
  ];
  const factions: FactionId[] = ['moritani', 'guild', 'emperor', 'atreides', 'fremen', 'beneGesserit'];
  for (const { options, counts } of cases) for (const count of counts) {
    const lobby = createGame('AUTHENTICATEDE3SKILLS', newPlayer('original-m', 'Original Moritani', 'moritani'), options.rules === 'advanced', ['ecaz']);
    for (let i = 1; i < count; i++) joinGame(lobby, newPlayer(`original-${i}`, `Original ${factions[i]}`, factions[i]));
    const before = structuredClone(lobby), setup = initializeDiscoveryNativeE3Skills({ ...options, initial: lobby });
    assert.deepEqual(lobby, before);
    assert.deepEqual(setup.players.map(p => ({ id: p.id, name: p.name, faction: p.faction })),
      before.players.map(p => ({ id: p.id, name: p.name, faction: p.faction })));
    assert.ok(setup.players.every(p => p.traitors.length === 0));
    const after = completeDiscoveryNativeE3SkillsSetup(setup), guild = after.players.find(p => p.faction === 'guild')!.id;
    assert.equal(after.leaderSkills!.assignments.find(a => a.owner === guild)!.skill, 'suk-graduate');
    assert.equal(after.players.find(p => p.faction === 'moritani')!.reserves, 14);
    assert.equal(Object.values(after.players.find(p => p.faction === 'moritani')!.forces).reduce((a, b) => a + b, 0), 6);
    assert.equal(!!after.moritaniAssassinate, options.rules === 'advanced');
    if (after.strongholdCards) assert.ok(Object.values(after.strongholdCards.owners).every(owner => owner === null));
    custody(after);
  }
});

void test('printed Discovery reveal, actual first-Storm Tech/END-Mentat claims, free entry and paid nested shipment preserve source positions and native wallets', () => {
  const f = fixture({ tech: true, strongholds: true });
  assert.ok(Object.values(f.setup.techTokens!).every(t => t.owner === null));
  for (const p of f.afterFirstStorm.players) assert.equal(ownedTech(f.afterFirstStorm.techTokens, p.id).length, 1);
  assert.ok(Object.values(f.beforeFirstMentat.strongholdCards!.owners).every(owner => owner === null));
  const claimed = applyAction(structuredClone(f.beforeFirstMentat), f.firstMentatStep.actor, f.firstMentatStep.action);
  assert.deepEqual(claimed.strongholdCards!.owners, strongholdControllers(f.beforeFirstMentat.players, false));
  assert.equal(claimed.strongholdCards!.owners.tueks_sietch, f.moritani);
  const revealedToken = f.afterReveal.discoveries!.tokens.find(t => t.id === f.token)!;
  assert.equal(revealedToken.territory, f.source.split(':')[0]);
  assert.equal(player(f.beforeReveal, f.opponent).forces[f.source], 3);
  assert.equal(player(f.entry.after, f.opponent).forces[f.source] ?? 0, 0);
  assert.equal(player(f.entry.after, f.opponent).forces['cistern:0'], 3);
  assert.equal(player(f.entry.after, f.opponent).spice, player(f.entry.before, f.opponent).spice);
  assert.equal(player(f.entry.after, f.opponent).reserves, player(f.entry.before, f.opponent).reserves);
  assert.equal(player(f.shipment.after, f.moritani).forces['cistern:0'], 1);
  assert.equal(player(f.shipment.after, f.moritani).reserves, player(f.shipment.before, f.moritani).reserves - 1);
  assert.equal(player(f.shipment.after, f.moritani).spice, player(f.shipment.before, f.moritani).spice - 1);
  for (const game of [f.afterSetup, f.afterFirstStorm, f.afterReveal, f.entry.after, f.shipment.after, f.pending]) custody(game);
});

void test('normal Guild Suk resolves physical casualty rescue BEFORE nested after-loss assassination; printed3 bounty and exact skill return never replay support or casualties', () => {
  const f = fixture({ tech: true, strongholds: true }), pending = f.pending;
  assert.equal(pending.lastBattleContext?.winner, f.opponent);
  assert.equal(pending.lastBattleContext?.result, 'normal');
  assert.equal(pending.lastBattleContext?.sukRescue?.completed, true);
  assert.equal(player(pending, f.opponent).tanks, player(f.revealed, f.opponent).tanks + 2);
  assert.equal(player(pending, f.opponent).reserves, player(f.revealed, f.opponent).reserves + 1);
  assert.equal(player(pending, f.opponent).forces[f.location], 3);
  assert.equal(player(pending, f.moritani).tanks, player(f.revealed, f.moritani).tanks + 6);
  assert.equal(player(pending, f.opponent).spice, player(f.revealed, f.opponent).spice - 3);
  assert.equal(player(pending, f.moritani).spice, player(f.revealed, f.moritani).spice - 1);
  assert.equal(viewGame(pending, f.moritani).moritaniAssassinate!.pending!.territory, 'cistern');
  const target = player(pending, f.opponent).leaders.find(l => l.id === f.target)!;
  assert.equal(target.name, 'Master Bewt'); assert.equal(target.strength, 3); assert.notEqual(target.id, f.opponentLeader);
  const originalCounters = pending.players.map(p => ({ id: p.id, forces: p.forces, reserves: p.reserves, tanks: p.tanks }));
  const reserve = [...pending.traitorReserve!], ownTraitors = [...player(pending, f.moritani).traitors];
  let game = assassinate(pending, f.target);
  assert.equal(player(game, f.opponent).leaders.find(l => l.id === f.target)!.dead, true);
  assert.equal(player(game, f.opponent).leaders.find(l => l.id === f.target)!.deaths, target.deaths + 1);
  assert.equal(game.leaderSkills!.assignments.some(a => a.leader === f.target), false);
  assert.equal(game.leaderSkills!.deck.filter(c => c === 'suk-graduate').length, 1);
  assert.equal(player(game, f.moritani).spice, player(pending, f.moritani).spice + target.strength);
  assert.equal(player(game, f.opponent).spice, player(pending, f.opponent).spice);
  assert.deepEqual(game.players.map(p => ({ id: p.id, forces: p.forces, reserves: p.reserves, tanks: p.tanks })), originalCounters);
  assert.deepEqual(game.techTokens, pending.techTokens); assert.deepEqual(game.strongholdCards, pending.strongholdCards);
  assert.equal(game.decision?.kind, 'battleCards'); assert.equal(game.decision?.player, f.opponent);
  game = applyAction(structuredClone(game), f.opponent, { type: 'decision', discard: f.opponentCards });
  game = advance(game, g => !g.battle && clean(g));
  const lost = ownedTech(pending.techTokens, f.moritani)[0]; assert.ok(lost);
  assert.equal(game.techTokens![lost].owner, f.opponent);
  for (const card of [...f.moritaniCards, ...f.opponentCards]) assert.equal(game.discard.filter(c => c.id === card).length, 1);
  game = finishDiscoveryNativeE3SkillsBattles(game);
  game = advance(game, g => g.phase === 8);
  assert.equal(game.moritaniAssassinate!.opportunities.at(-1)!.territory, 'cistern');
  assert.equal(game.moritaniAssassinate!.opportunities.at(-1)!.stage, 'replaced');
  assert.equal(game.moritaniAssassinate!.opportunities.at(-1)!.replacement, reserve[0]);
  assert.deepEqual(game.traitorReserve, reserve.slice(1));
  assert.deepEqual(player(game, f.moritani).traitors, [...ownTraitors.filter(c => c !== f.target), reserve[0]]);
  assert.equal('replacement' in viewGame(game, f.opponent).moritaniAssassinate!.history.at(-1)!, false);
  assert.equal(game.leaderSkills!.deck.filter(c => c === 'suk-graduate').length, 1);
  game = advance(game, g => g.turn === 3 && g.phase === 4 && clean(g));
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, f.opponent, { type: 'reviveLeader', leader: f.target }), /All leaders must die/);
  assert.deepEqual(game, before); custody(game);
});

void test('earned Tuek Worthless benefits remain source-local: retained card pays in Tuek, never in the separately revealed Cistern', () => {
  for (const battle of ['nested', 'tueks_sietch'] as const) {
    const f = fixture({ strongholds: true, battle });
    assert.equal(f.revealed.strongholdCards!.owners.tueks_sietch, f.moritani);
    assert.deepEqual(quoteStrongholdFactionsBattle(f.revealed).strongholdIncome,
      battle === 'nested' ? [] : [{ player: f.moritani, amount: 4 }]);
    assert.equal(player(f.pending, f.moritani).spice, player(f.revealed, f.moritani).spice - 1 + (battle === 'nested' ? 0 : 4));
    assert.equal(player(f.pending, f.opponent).tanks, 2);
    assert.equal(f.pending.lastBattleContext?.winner, f.opponent);
    custody(f.pending);
  }
});

void test('Basic Discovery keeps normal Suk and optional original Tech capture without Advanced support, Strongholds or assassination', () => {
  for (const tech of [false, true]) {
    const f = fixture({ rules: 'basic', tech, strongholds: false });
    assert.equal(f.pending.lastBattleContext?.winner, f.opponent);
    assert.equal(f.pending.lastBattleContext?.sukRescue?.completed, true);
    assert.equal(player(f.pending, f.opponent).tanks, 2); assert.equal(player(f.pending, f.moritani).tanks, 6);
    assert.equal(player(f.pending, f.opponent).spice, player(f.revealed, f.opponent).spice);
    assert.equal(player(f.pending, f.moritani).spice, player(f.revealed, f.moritani).spice);
    assert.equal(f.pending.moritaniAssassinate, undefined); assert.ok(!f.pending.strongholdCards);
    assert.equal(f.pending.leaderSkills!.assignments.find(a => a.leader === f.target)!.skill, 'suk-graduate');
    if (tech) {
      const lost = ownedTech(f.revealed.techTokens, f.moritani)[0]; assert.ok(lost);
      assert.equal(f.pending.techTokens![lost].owner, f.opponent);
    }
    custody(f.pending);
  }
});

void test('a normal native Traitor reveal forfeits assassination for the entire game, including a later real nested loss', () => {
  const f = fixture({ normalCall: true });
  assert.equal(f.pending.lastBattleContext?.result, 'traitor');
  assert.equal(f.pending.lastBattleContext?.winner, f.moritani);
  assert.equal(f.pending.moritaniAssassinate!.normalTraitorCall, true);
  assert.equal(player(f.pending, f.opponent).leaders.find(l => l.id === f.opponentLeader)!.dead, true);
  let game = advance(finishDiscoveryNativeE3SkillsBattles(structuredClone(f.pending)), g => g.turn === 3 && g.phase === 5 && clean(g));
  for (const p of game.players) {
    p.reserves += Object.values(p.forces).reduce((a, b) => a + b, 0); p.forces = {};
    if (p.elites) { p.elites.reserves += Object.values(p.elites.forces).reduce((a, b) => a + b, 0); p.elites.forces = {}; }
    if (p.advisors) p.advisors = {};
  }
  for (const actor of [f.moritani, f.opponent]) { const p = player(game, actor); p.reserves -= 4; p.forces['cistern:0'] = 4; }
  holdMoritaniStrongholdsTraitor(game, f.moritani, f.target);
  const trained = new Set(game.leaderSkills!.assignments.map(a => a.leader));
  const own = player(game, f.moritani).leaders.filter(l => !l.dead && !trained.has(l.id)).sort((a, b) => a.strength - b.strength)[0];
  const enemy = player(game, f.opponent).leaders.filter(l => !l.dead && !trained.has(l.id)).sort((a, b) => b.strength - a.strength)[0];
  assert.ok(own && enemy);
  game = advance(game, g => g.phase === 6 && clean(g)); const actor = game.active!;
  game = applyAction(game, actor, { type: 'chooseBattle', territory: 'cistern', target: actor === f.moritani ? f.opponent : f.moritani });
  game = advance(game, g => !!g.battle && !g.battle.revealed && !nextDiscoveryNativeE3SkillsStep(g));
  game = revealDiscoveryNativeE3SkillsPlans(game, [
    { actor: f.moritani, action: { type: 'battlePlan', leader: own.id, dial: 0, support: 0 } },
    { actor: f.opponent, action: { type: 'battlePlan', leader: enemy.id, dial: 0, support: 0 } },
  ]);
  game = resolveDiscoveryNativeE3SkillsBattle(game, f.moritani);
  assert.equal(game.lastBattleContext?.result, 'normal'); assert.equal(game.lastBattleContext?.winner, f.opponent);
  assert.equal(game.moritaniAssassinate!.normalTraitorCall, true);
  assert.equal(game.moritaniAssassinateCallEvents!.length, 1);
  assert.deepEqual(game.moritaniAssassinate!.opportunities, []);
  assert.equal(player(game, f.opponent).leaders.find(l => l.id === f.target)!.dead, false); custody(game);
});

void test('four minimal policies actually kill the eligible trained disc or decline the real used-disc-only menu; neither branch replays native resources', () => {
  const f = fixture({ tech: true, strongholds: true });
  let empty = structuredClone(f.game);
  holdMoritaniStrongholdsTraitor(empty, f.moritani, f.opponentLeader);
  empty = resolveDiscoveryNativeE3SkillsBattle(revealDiscoveryNativeE3SkillsPlans(empty, f.plans), f.moritani);
  assert.deepEqual(viewGame(empty, f.moritani).moritaniAssassinate!.pending!.cards, []);
  for (const difficulty of DIFFICULTIES) {
    const action = policy(structuredClone(f.pending), f.moritani, difficulty)[0]; assert.ok(action, difficulty);
    let game = applyAction(structuredClone(f.pending), f.moritani, action);
    assert.equal(game.moritaniAssassinate!.opportunities.at(-1)!.stage, 'revealed');
    assert.equal(game.moritaniAssassinate!.opportunities.at(-1)!.card, f.target);
    assert.equal(player(game, f.opponent).leaders.find(l => l.id === f.target)!.dead, true);
    assert.equal(player(game, f.moritani).spice, player(f.pending, f.moritani).spice + 3);
    assert.equal(game.leaderSkills!.deck.filter(c => c === 'suk-graduate').length, 1);
    game = advance(game, g => !g.battle && clean(g));
    assert.equal(player(game, f.opponent).tanks, 2); assert.equal(player(game, f.moritani).tanks, 6); custody(game);
    const decline = policy(structuredClone(empty), f.moritani, difficulty)[0]; assert.ok(decline, difficulty);
    const declined = applyAction(structuredClone(empty), f.moritani, decline);
    assert.equal(declined.moritaniAssassinate!.opportunities.at(-1)!.stage, 'declined');
    assert.deepEqual(declined.leaderSkills, empty.leaderSkills);
    assert.equal(player(declined, f.moritani).spice, player(empty, f.moritani).spice);
    assert.equal(player(declined, f.opponent).leaders.find(l => l.id === f.target)!.dead, false);
    custody(advance(declined, g => !g.battle && clean(g)));
  }
});

void test('five actual original battles open native own revival; one real printed fee supplies private optional replacement without staged deaths or clocks', () => {
  const f = createDiscoveryNativeE3SkillsRevivalFixture();
  const assignment = f.beforeDeaths.leaderSkills!.assignments.find(a => a.owner === f.moritani)!;
  assert.equal(new Set(f.deaths.map(d => d.leader)).size, 5);
  assert.equal(new Set(f.deaths.map(d => d.winnerLeader)).size, 5);
  assert.equal(new Set(f.deaths.map(d => d.territory)).size, 5);
  for (const [index, death] of f.deaths.entries()) {
    assert.equal(player(death.after, f.moritani).leaders.filter(l => l.dead).length, index + 1);
    assert.equal(player(death.after, f.moritani).leaders.find(l => l.id === death.leader)!.deaths,
      player(death.before, f.moritani).leaders.find(l => l.id === death.leader)!.deaths + 1);
    assert.equal(death.after.lastBattleContext?.winner, f.opponent);
    assert.equal(player(death.after, f.opponent).hand.filter(c => c.id === f.weapon).length, 1);
    assert.equal(death.after.discard.some(c => c.id === f.weapon), false);
    assert.equal(player(death.after, f.moritani).tanks, player(death.before, f.moritani).tanks + 1);
    assert.equal(player(death.after, f.opponent).tanks, player(death.before, f.opponent).tanks);
    custody(death.after);
  }
  assert.equal(f.revivalWindow.leaderSkills!.assignments.some(a => a.owner === f.moritani), false);
  assert.equal(f.revivalWindow.leaderSkills!.deck.filter(c => c === assignment.skill).length, 1);
  const printed = player(f.revivalWindow, f.moritani).leaders.find(l => l.id === f.leader)!.strength;
  assert.equal(player(f.offered, f.moritani).spice, player(f.revivalWindow, f.moritani).spice - printed);
  assert.equal(player(f.offered, f.moritani).leaders.find(l => l.id === f.leader)!.dead, false);
  assert.equal(player(f.offered, f.moritani).leaders.filter(l => l.dead).length, 4);
  const event = f.offered.leaderSkills!.offers[f.moritani].event;
  assert.deepEqual(viewGame(f.offered, f.moritani).leaderSkills!.offer!.cards, []);
  assert.equal(viewGame(f.offered, f.opponent).leaderSkills!.offer, null);
  const declined = applyAction(structuredClone(f.offered), f.moritani, { type: 'leaderSkill', event, mode: 'decline' });
  assert.equal(declined.leaderSkills!.offers[f.moritani], undefined);
  assert.equal(declined.leaderSkills!.assignments.some(a => a.owner === f.moritani), false);
  assert.equal(player(declined, f.moritani).spice, player(f.offered, f.moritani).spice); custody(declined);
  const drawn = applyAction(structuredClone(f.offered), f.moritani, { type: 'leaderSkill', event, mode: 'draw' });
  const offer = viewGame(drawn, f.moritani).leaderSkills!.offer!;
  assert.equal(offer.cards.length, 2); assert.equal(viewGame(drawn, f.opponent).leaderSkills!.offer, null);
  const own = viewGame(drawn, f.moritani).leaderSkills!;
  const skill = offer.cards.find(c => !own.unavailableSkills?.[c]); assert.ok(skill);
  const selected = applyAction(drawn, f.moritani, { type: 'leaderSkill', event, skill, leader: f.leader });
  assert.deepEqual(selected.leaderSkills!.assignments.find(a => a.owner === f.moritani), { owner: f.moritani, skill, leader: f.leader });
  assert.equal(selected.leaderSkills!.offers[f.moritani], undefined);
  assert.equal(player(selected, f.moritani).spice, player(f.offered, f.moritani).spice);
  assert.equal(selected.players.some(p => p.leaders.some(l => l.capturedBy || l.gholaBy)), false);
  custody(selected);
});
