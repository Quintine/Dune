import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction, createGame, joinGame, newPlayer, normalizeAutomaticGame, viewGame,
  type Action, type Game,
} from '../game/engine';
import { leaders, treacheryDeck } from '../game/cards';
import type { FactionId } from '../game/catalog';
import { DIFFICULTIES } from '../game/bot-profiles';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { STRONGHOLD_CARDS, strongholdControllers } from '../game/stronghold-cards';
import { ownedTech } from '../game/tech-tokens';
import { assassinationPhysical } from './moritani-assassinate-fixture';
import { quoteStrongholdFactionsBattle } from './fixture-stronghold-factions';
import { holdMoritaniStrongholdsTraitor } from './fixture-moritani-strongholds';
import {
  advanceMoritaniSkillsModules as advance, completeMoritaniSkillsModulesSetup,
  createMoritaniSkillsModulesFixture as fixture, initializeMoritaniSkillsModulesOffers,
  moritaniSkillsModulesClean as clean, moritaniSkillsModulesPlayer as player,
  moritaniSkillsModulesPolicy as policy, nextMoritaniSkillsModulesStep,
  rejectMoritaniSkillsModulesAction as reject, resolveMoritaniSkillsModulesBattle,
  revealMoritaniSkillsModulesPlans, stageMoritaniSkillsModulesBattle,
  type MoritaniSkillsModulesOptions,
} from './fixture-moritani-skills-modules';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game)) as Game;
function custody(game: Game) {
  validateLeaderSkills(game.leaderSkills!, game.players);
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.auction?.cards.slice(game.auction.index) ?? [])].map(c => c.id).sort();
  assert.deepEqual(cards, treacheryDeck(['ecaz']).map(c => c.id).sort());
  assert.equal(cards.length, 33);
  const skills = [...game.leaderSkills!.deck, ...Object.values(game.leaderSkills!.offers).flatMap(o => o.cards),
    ...game.leaderSkills!.assignments.map(a => a.skill)].sort();
  assert.deepEqual(skills, LEADER_SKILL_CARDS.map(c => c.id).sort());
  for (const p of game.players) {
    assert.deepEqual(p.leaders.map(l => l.id).sort(), leaders(p.faction).map(l => l.id).sort());
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((sum, n) => sum + n, 0), 20);
    if (p.elites) {
      assert.equal(p.elites.reserves + p.elites.tanks + Object.values(p.elites.forces).reduce((sum, n) => sum + n, 0), p.faction === 'emperor' ? 5 : 3);
      for (const [location, count] of Object.entries(p.elites.forces)) assert.ok(count <= (p.forces[location] ?? 0));
    }
  }
}
function assassinate(game: Game, card: string | null) {
  const d = game.decision; assert.equal(d?.kind, 'moritaniAssassinate');
  if (d?.kind !== 'moritaniAssassinate') throw Error('Expected original loss opportunity');
  return applyAction(game, d.player, { type: 'decision', event: d.event, ...(card === null ? { decline: true } : { card }) });
}
function finishBattle(game: Game) {
  return advance(game, s => !s.battle && clean(s) && !s.pendingTreacheryDiscard);
}

void test('original standalone Moritani retains native offers and authenticated roster across Basic Tech and Advanced module seat boundaries', () => {
  const cases: { options: MoritaniSkillsModulesOptions; counts: number[] }[] = [
    { options: { rules: 'basic', tech: true, strongholds: false }, counts: [3, 4, 5, 6] },
    { options: { rules: 'advanced', tech: true, strongholds: false }, counts: [3, 4, 5, 6] },
    { options: { rules: 'advanced', tech: false, strongholds: true }, counts: [2, 3, 4, 5, 6] },
    { options: { rules: 'advanced', tech: true, strongholds: true }, counts: [3, 4, 5, 6] },
  ];
  const factions: FactionId[] = ['moritani', 'guild', 'emperor', 'atreides', 'fremen', 'beneGesserit'];
  for (const { options, counts } of cases) for (const count of counts) {
    const lobby = createGame(`AUTHMORISKILLS${count}`, newPlayer('authenticated-m', 'Original Moritani', 'moritani'), options.rules === 'advanced', ['ecaz']);
    for (let i = 1; i < count; i++) joinGame(lobby, newPlayer(`authenticated-${i}`, `Original ${factions[i]}`, factions[i]));
    const before = structuredClone(lobby), offered = initializeMoritaniSkillsModulesOffers({ ...options, initial: lobby });
    assert.deepEqual(lobby, before);
    assert.deepEqual(offered.players.map(p => ({ id: p.id, name: p.name, faction: p.faction })), before.players.map(p => ({ id: p.id, name: p.name, faction: p.faction })));
    assert.equal(offered.setupStage, 'leaderSkills');
    assert.deepEqual(offered.players.map(p => p.traitors), before.players.map(() => []));
    const guild = offered.players.find(p => p.faction === 'guild')!.id;
    assert.ok(viewGame(offered, guild).leaderSkills!.offer!.cards.includes('suk-graduate'));
    for (const p of offered.players) assert.equal(viewGame(offered, p.id).leaderSkills!.offer!.cards.length, 2);
    if (offered.strongholdCards) assert.ok(Object.values(offered.strongholdCards.owners).every(owner => owner === null));
    assert.equal(!!offered.moritaniAssassinate, options.rules === 'advanced');
    const saved = initializeMoritaniSkillsModulesOffers({ ...options, initial: reload(offered) });
    assert.deepEqual(saved, offered, 'An original skill setup is continued, not redealt');
    const setup = completeMoritaniSkillsModulesSetup(offered);
    assert.equal(setup.players.find(p => p.faction === 'moritani')!.reserves, 14);
    const moritani = setup.players.find(p => p.faction === 'moritani')!;
    const placement = Object.entries(moritani.forces);
    assert.equal(placement.length, 1);
    assert.equal(placement[0][1], 6, 'Native setup places its six original counters together.');
    const start = placement[0][0].split(':')[0];
    assert.ok(setup.players.filter(p => p.id !== moritani.id).every(p =>
      !Object.entries(p.forces).some(([key, count]) => count > 0 && key.startsWith(`${start}:`))),
    'Original setup must leave other fighters and advisors outside the Moritani starting territory.');
    const assigned = setup.leaderSkills!.assignments.find(a => a.owner === guild)!;
    assert.equal(assigned.skill, 'suk-graduate');
    assert.equal(player(setup, guild).leaders.find(l => l.id === assigned.leader)!.name, 'Master Bewt');
    custody(setup);
  }
});

void test('actual first Storm assigns Tech, a real native shipment pays phase-end income, and END Mentat alone claims the original Stronghold cards', () => {
  const f = fixture();
  assert.ok(Object.values(f.initial.techTokens!).every(token => token.owner === null));
  assert.ok(Object.values(f.afterFirstStorm.techTokens!).every(token => token.owner !== null));
  for (const p of f.afterFirstStorm.players) assert.equal(ownedTech(f.afterFirstStorm.techTokens, p.id).length, 1);
  const shipping = advance(applyAction(reload(f.beforeShipment), f.shipmentStep.actor, f.shipmentStep.action),
    s => s.phase === 5 && clean(s) && !s.pendingShipment);
  assert.deepEqual(shipping.techTokens, f.afterShipment.techTokens);
  const token = f.afterShipment.techTokens!.heighliners;
  assert.equal(token.triggeredTurn, 2); assert.equal(token.spice, 1);
  assert.equal(player(shipping, f.moritani).reserves, player(f.beforeShipment, f.moritani).reserves - 1);
  assert.equal(player(shipping, f.moritani).forces[`${String(f.shipmentStep.action.territory)}:${String(f.shipmentStep.action.sector)}`], 1);
  assert.equal(f.afterMovement.techTokens!.heighliners.spice, 0);
  for (const p of shipping.players) assert.equal(player(f.afterMovement, p.id).spice, p.spice + (p.id === token.owner ? 1 : 0), 'Exactly the printed token holder collects at the real phase boundary');
  assert.equal(f.initial.strongholdCards!.claimedTurn, 0);
  assert.ok(Object.values(f.initial.strongholdCards!.owners).every(owner => owner === null));
  const claimed = applyAction(reload(f.beforeFirstMentat), f.firstMentatStep.actor, f.firstMentatStep.action);
  assert.equal(claimed.turn, 2);
  assert.deepEqual(claimed.strongholdCards!.owners, strongholdControllers(f.beforeFirstMentat.players, false));
  assert.deepEqual(claimed.strongholdCards, f.afterFirstMentat.strongholdCards);
  assert.equal(claimed.strongholdCards!.owners.tueks_sietch, f.opponent);
  assert.deepEqual(Object.keys(claimed.strongholdCards!.owners), STRONGHOLD_CARDS.map(c => c.id));
  for (const g of [f.afterSetup, f.afterFirstStorm, f.afterFirstMentat, f.afterShipment, f.pending]) custody(g);
});

void test('the normal face-up unused Guild Suk rescues one first; original held Master Bewt assassination returns Suk and printed3 once without replaying winner income or casualties', () => {
  const f = fixture(), pending = f.pending;
  assert.equal(pending.lastBattleContext?.result, 'normal'); assert.equal(pending.lastBattleContext?.winner, f.opponent);
  assert.equal(pending.decision?.kind, 'moritaniAssassinate');
  assert.equal(pending.lastBattleContext?.sukRescue?.completed, true);
  const target = player(pending, f.opponent).leaders.find(l => l.id === f.target)!;
  assert.equal(target.name, 'Master Bewt'); assert.equal(target.strength, 3); assert.equal(target.dead, false);
  assert.notEqual(target.id, f.opponentLeader);
  assert.equal(player(pending, f.opponent).tanks, player(f.revealed, f.opponent).tanks + 2, 'Guild dial3 loses only two counters to Tanks after normal rescue1');
  assert.equal(player(pending, f.opponent).reserves, player(f.revealed, f.opponent).reserves + 1);
  assert.equal(Object.values(player(pending, f.opponent).forces).reduce((sum, n) => sum + n, 0), 3);
  assert.equal(player(pending, f.moritani).tanks, player(f.revealed, f.moritani).tanks + 6);
  assert.deepEqual(quoteStrongholdFactionsBattle(f.revealed).strongholdIncome, [{ player: f.opponent, amount: 2 }]);
  const moriBalance = player(f.revealed, f.moritani).spice - 1;
  const winnerBalance = player(f.revealed, f.opponent).spice - 3 + 2;
  assert.equal(player(pending, f.moritani).spice, moriBalance);
  assert.equal(player(pending, f.opponent).spice, winnerBalance);
  const originalForces = pending.players.map(p => ({ id: p.id, forces: p.forces, reserves: p.reserves, tanks: p.tanks, elites: p.elites }));
  const retained = structuredClone(pending.leaderSkills!.assignments.filter(a => a.leader !== f.target));
  const reserve = [...pending.traitorReserve!], traitors = [...player(pending, f.moritani).traitors];
  const inventory = assassinationPhysical(pending);
  const d = pending.decision;
  if (d?.kind !== 'moritaniAssassinate') throw Error('Expected original loss choice');
  const action: Action = { type: 'decision', event: d.event, card: f.target };
  const privateMenu = viewGame(pending, f.moritani).moritaniAssassinate!.pending!.cards;
  assert.equal(privateMenu.find(c => c.card === f.target)!.bounty, 3);
  assert.equal(privateMenu.some(c => c.card === f.opponentLeader), false);
  reject(pending, f.opponent, action); reject(pending, f.moritani, { ...action, event: `${d.event}:stale` });
  reject(pending, f.moritani, { ...action, card: f.opponentLeader });
  let game = applyAction(reload(pending), f.moritani, action);
  assert.equal(player(game, f.opponent).leaders.find(l => l.id === f.target)!.dead, true);
  assert.equal(player(game, f.opponent).leaders.find(l => l.id === f.target)!.deaths, target.deaths + 1);
  assert.equal(game.moritaniAssassinate!.opportunities.at(-1)!.bounty, 3);
  assert.deepEqual(game.leaderSkills!.assignments, retained);
  assert.equal(game.leaderSkills!.deck.filter(c => c === 'suk-graduate').length, 1);
  assert.equal(player(game, f.moritani).spice, moriBalance + 3); assert.equal(player(game, f.opponent).spice, winnerBalance);
  assert.deepEqual(game.players.map(p => ({ id: p.id, forces: p.forces, reserves: p.reserves, tanks: p.tanks, elites: p.elites })), originalForces);
  assert.deepEqual(game.strongholdCards, pending.strongholdCards);
  assert.deepEqual(game.techTokens, pending.techTokens, 'Assassination does not replay or undo original phase income');
  assert.equal(game.decision?.kind, 'battleCards'); assert.equal(game.decision?.player, f.opponent);
  reject(game, f.moritani, action);
  game = applyAction(reload(game), f.opponent, { type: 'decision', discard: f.opponentCards });
  game = finishBattle(game);
  for (const card of [...f.moritaniCards, ...f.opponentCards]) assert.equal(game.discard.filter(c => c.id === card).length, 1);
  const lostTech = ownedTech(pending.techTokens, f.moritani)[0]; assert.ok(lostTech);
  assert.equal(game.techTokens![lostTech].owner, f.opponent, 'Winner captures one real defeated-faction token only after original winner cleanup');
  for (const token of ownedTech(pending.techTokens, f.opponent)) assert.equal(game.techTokens![token].owner, f.opponent, 'Original winning Tech custody is retained alongside the captured token');
  const afterBattleForces = game.players.map(p => ({ id: p.id, forces: p.forces, reserves: p.reserves, tanks: p.tanks }));
  assert.deepEqual(afterBattleForces, pending.players.map(p => ({ id: p.id, forces: p.forces, reserves: p.reserves, tanks: p.tanks })));
  game = advance(reload(game), s => s.phase === 8);
  const receipt = game.moritaniAssassinate!.opportunities.at(-1)!;
  assert.equal(receipt.stage, 'replaced'); assert.equal(receipt.replacement, reserve[0]);
  assert.deepEqual(game.traitorReserve, reserve.slice(1));
  assert.deepEqual(player(game, f.moritani).traitors, [...traitors.filter(c => c !== f.target), reserve[0]]);
  const collected = quoteSpiceCollection(pending).receipts.find(r => r.player === f.opponent)!;
  assert.equal(player(game, f.moritani).spice, moriBalance + 3);
  assert.equal(player(game, f.opponent).spice, winnerBalance + collected.strongholds + collected.collected,
    'Ordinary Collection remains separate from original battle income and assassination bounty.');
  assert.equal('replacement' in viewGame(game, f.opponent).moritaniAssassinate!.history.at(-1)!, false);
  assert.equal('traitors' in viewGame(game, f.opponent).players.find(p => p.id === f.moritani)!, false);
  assert.equal(game.leaderSkills!.deck.filter(c => c === 'suk-graduate').length, 1);
  assert.deepEqual(assassinationPhysical(game), inventory);
  assert.deepEqual(normalizeAutomaticGame(reload(game)), game);
  reject(game, f.moritani, action); custody(game);
  game = advance(game, s => s.turn === 3 && s.phase === 4 && clean(s));
  assert.equal(game.traitorReserve!.length, reserve.length - 1, 'The next real END Mentat does not replace a second time');
  reject(game, f.opponent, { type: 'reviveLeader', leader: f.target });
  assert.equal(player(game, f.opponent).leaders.filter(l => l.dead).length, 1);
  assert.equal(game.leaderSkills!.offers[f.opponent], undefined, 'One original death must not bypass the native all-five-disc revival prerequisite or grant training');
  custody(game);
});

void test('losing Moritani retains printed Tuek Worthless income and one real support debit even after Guild rescue, assassination, card cleanup and Tech transfer', () => {
  const f = fixture({ holder: 'moritani' });
  assert.deepEqual(quoteStrongholdFactionsBattle(f.revealed).strongholdIncome, [{ player: f.moritani, amount: 4 }]);
  const own = player(f.revealed, f.moritani).spice - 1 + 4;
  const enemy = player(f.revealed, f.opponent).spice - 3;
  assert.equal(player(f.pending, f.moritani).spice, own); assert.equal(player(f.pending, f.opponent).spice, enemy);
  assert.equal(f.pending.lastBattleContext?.sukRescue?.completed, true);
  let game = assassinate(reload(f.pending), f.target);
  game = finishBattle(game);
  game = advance(game, s => s.phase === 8);
  const collected = quoteSpiceCollection(f.pending).receipts.find(r => r.player === f.opponent)!;
  assert.equal(player(game, f.moritani).spice, own + 3);
  assert.equal(player(game, f.opponent).spice, enemy + collected.strongholds + collected.collected);
  assert.equal(player(game, f.moritani).tanks, 6); assert.equal(player(game, f.opponent).tanks, 2);
  assert.equal(player(game, f.moritani).leaders.find(l => l.id === f.moritaniLeader)!.dead, false);
  for (const card of f.moritaniCards) assert.equal(game.discard.filter(c => c.id === card).length, 1);
  assert.equal(game.strongholdCards!.owners.tueks_sietch, f.moritani);
  assert.equal(strongholdControllers(game.players, false).tueks_sietch, f.opponent);
  custody(game);
});

void test('selected winning disc is not an assassination target, and declining a real empty native menu neither kills Suk nor schedules replacement', () => {
  const f = fixture();
  let game = reload(f.game);
  holdMoritaniStrongholdsTraitor(game, f.moritani, f.opponentLeader);
  game = revealMoritaniSkillsModulesPlans(game, f.planActions);
  game = resolveMoritaniSkillsModulesBattle(game, f.moritani);
  assert.equal(game.lastBattleContext?.winner, f.opponent);
  assert.deepEqual(viewGame(game, f.moritani).moritaniAssassinate!.pending!.cards, []);
  const d = game.decision;
  if (d?.kind !== 'moritaniAssassinate') throw Error('Expected original empty loss choice');
  reject(game, f.moritani, { type: 'decision', event: d.event, card: f.opponentLeader });
  const skills = structuredClone(game.leaderSkills), reserve = [...game.traitorReserve!];
  const balance = player(game, f.moritani).spice;
  game = finishBattle(assassinate(game, null));
  game = advance(game, s => s.phase === 8);
  assert.equal(game.moritaniAssassinate!.opportunities.at(-1)!.stage, 'declined');
  assert.deepEqual(game.leaderSkills, skills); assert.deepEqual(game.traitorReserve, reserve);
  assert.equal(player(game, f.moritani).spice, balance);
  assert.equal(player(game, f.opponent).leaders.find(l => l.id === f.target)!.dead, false);
  assert.equal(player(game, f.opponent).leaders.find(l => l.id === f.opponentLeader)!.dead, false);
  custody(game);
});

void test('a real normal Traitor reveal keeps the original entire-game forfeiture across a native turn, not merely the first modules battle', () => {
  const f = fixture({ normalCall: true });
  assert.equal(f.pending.lastBattleContext?.result, 'traitor');
  assert.equal(f.pending.lastBattleContext?.winner, f.moritani);
  assert.equal(f.pending.moritaniAssassinate!.normalTraitorCall, true);
  assert.equal(f.pending.moritaniAssassinateCallEvents!.length, 1);
  assert.deepEqual(f.pending.moritaniAssassinate!.opportunities, []);
  assert.equal(player(f.pending, f.opponent).leaders.find(l => l.id === f.opponentLeader)!.dead, true);
  let game = advance(f.pending, s => s.turn === 3 && s.phase === 5 && clean(s));
  stageMoritaniSkillsModulesBattle(game, f.moritani, f.opponent);
  holdMoritaniStrongholdsTraitor(game, f.moritani, f.target);
  const trained = new Set(game.leaderSkills!.assignments.map(a => a.leader));
  const winner = player(game, f.opponent).leaders.filter(l => !l.dead && !trained.has(l.id)).sort((a, b) => b.strength - a.strength)[0];
  const loser = player(game, f.moritani).leaders.filter(l => !l.dead && !trained.has(l.id)).sort((a, b) => a.strength - b.strength)[0];
  assert.ok(winner && loser);
  game = advance(game, s => s.phase === 6 && clean(s));
  const actor = game.active!;
  game = applyAction(game, actor, { type: 'chooseBattle', territory: 'tueks_sietch', target: actor === f.moritani ? f.opponent : f.moritani });
  game = advance(game, s => !!s.battle && !s.battle.revealed && !nextMoritaniSkillsModulesStep(s));
  game = revealMoritaniSkillsModulesPlans(game, [
    { actor: f.moritani, action: { type: 'battlePlan', leader: loser.id, dial: 0, support: 0 } },
    { actor: f.opponent, action: { type: 'battlePlan', leader: winner.id, dial: 3, support: 3 } },
  ]);
  game = finishBattle(resolveMoritaniSkillsModulesBattle(game, f.moritani));
  assert.equal(game.lastBattleContext?.result, 'normal'); assert.equal(game.lastBattleContext?.winner, f.opponent);
  assert.equal(game.moritaniAssassinate!.normalTraitorCall, true);
  assert.equal(game.moritaniAssassinateCallEvents!.length, 1);
  assert.deepEqual(game.moritaniAssassinate!.opportunities, []);
  assert.equal(player(game, f.opponent).leaders.find(l => l.id === f.target)!.dead, false);
  custody(game);
});

void test('all four minimal legal policies reach real reveal or empty-menu decline outcomes without changing native skill, income or casualty custody twice', () => {
  const f = fixture();
  let empty = reload(f.game);
  holdMoritaniStrongholdsTraitor(empty, f.moritani, f.opponentLeader);
  empty = revealMoritaniSkillsModulesPlans(empty, f.planActions);
  empty = resolveMoritaniSkillsModulesBattle(empty, f.moritani);
  for (const difficulty of DIFFICULTIES) {
    const action = policy(reload(f.pending), f.moritani, difficulty)[0]; assert.ok(action, difficulty);
    let game = applyAction(reload(f.pending), f.moritani, action);
    assert.equal(game.moritaniAssassinate!.opportunities.at(-1)!.stage, 'revealed');
    assert.equal(game.moritaniAssassinate!.opportunities.at(-1)!.card, f.target);
    assert.equal(player(game, f.opponent).leaders.find(l => l.id === f.target)!.dead, true);
    assert.equal(player(game, f.moritani).spice, player(f.pending, f.moritani).spice + 3);
    assert.equal(player(game, f.opponent).spice, player(f.pending, f.opponent).spice);
    assert.equal(game.leaderSkills!.deck.filter(c => c === 'suk-graduate').length, 1);
    game = finishBattle(game);
    assert.equal(player(game, f.opponent).tanks, 2); assert.equal(player(game, f.moritani).tanks, 6);
    custody(game);
    const decline = policy(reload(empty), f.moritani, difficulty)[0]; assert.ok(decline, difficulty);
    const declined = applyAction(reload(empty), f.moritani, decline);
    assert.equal(declined.moritaniAssassinate!.opportunities.at(-1)!.stage, 'declined');
    assert.equal(player(declined, f.opponent).leaders.find(l => l.id === f.target)!.dead, false);
    assert.deepEqual(declined.leaderSkills, empty.leaderSkills);
    assert.equal(player(declined, f.moritani).spice, player(empty, f.moritani).spice);
    custody(finishBattle(declined));
  }
});

void test('Basic Tech keeps original normal Suk and token capture without Advanced assassination, while each single Advanced module preserves the real loss aftermath', () => {
  const basic = fixture({ rules: 'basic', strongholds: false });
  assert.equal(basic.pending.lastBattleContext?.result, 'normal');
  assert.equal(basic.pending.lastBattleContext?.winner, basic.opponent);
  assert.equal(basic.pending.moritaniAssassinate, undefined);
  assert.ok(!basic.pending.strongholdCards);
  assert.equal(basic.pending.lastBattleContext?.sukRescue?.completed, true);
  assert.equal(player(basic.pending, basic.opponent).tanks, 2);
  assert.equal(player(basic.pending, basic.moritani).tanks, 6);
  assert.equal(player(basic.pending, basic.opponent).spice, player(basic.revealed, basic.opponent).spice, 'Basic dials do not acquire an Advanced support debit');
  assert.equal(player(basic.pending, basic.moritani).spice, player(basic.revealed, basic.moritani).spice);
  const lost = ownedTech(basic.revealed.techTokens, basic.moritani)[0]; assert.ok(lost);
  assert.equal(basic.pending.techTokens![lost].owner, basic.opponent);
  assert.equal(basic.pending.leaderSkills!.assignments.some(a => a.leader === basic.target && a.skill === 'suk-graduate'), true);
  custody(basic.pending);
  for (const tech of [false, true]) {
    const f = fixture({ rules: 'advanced', tech, strongholds: !tech });
    assert.equal(f.pending.lastBattleContext?.winner, f.opponent);
    assert.equal(f.pending.decision?.kind, 'moritaniAssassinate');
    assert.equal(f.pending.lastBattleContext?.sukRescue?.completed, true);
    assert.equal(player(f.pending, f.opponent).tanks, 2);
    const balance = player(f.pending, f.moritani).spice;
    let game = finishBattle(assassinate(reload(f.pending), f.target));
    game = advance(game, s => s.phase === 8);
    assert.equal(player(game, f.moritani).spice, balance + 3);
    assert.equal(game.moritaniAssassinate!.opportunities.at(-1)!.stage, 'replaced');
    assert.equal(game.leaderSkills!.deck.filter(c => c === 'suk-graduate').length, 1);
    if (tech) {
      const captured = ownedTech(f.pending.techTokens, f.moritani)[0]; assert.ok(captured);
      assert.equal(game.techTokens![captured].owner, f.opponent);
      assert.ok(!game.strongholdCards);
    } else {
      assert.ok(!game.techTokens);
      assert.equal(game.strongholdCards!.owners.tueks_sietch, f.opponent);
      assert.equal(player(f.pending, f.opponent).spice, player(f.revealed, f.opponent).spice - 3 + 2);
    }
    custody(game);
  }
});
