import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, initializeLeaderSkillsGameForAudit, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { gameDistance, MOBILE_LOCATION, MOBILE_STRONGHOLD, splitLocation, territory as boardTerritory } from '../game/board';
import { FACTIONS } from '../game/catalog';
import { DISCOVERY_SPICE_CARDS } from '../game/discoveries';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { nativeTypedClearBoard, nativeTypedPlace } from './fixture-discovery-native-typed';
import { openSkillsTechBattle } from './fixture-skills-tech-battle';
import {
  advanceDiscoveryNativeE1Skills as advance, assertDiscoveryNativeE1SkillsCustody as custody,
  createDiscoveryNativeE1SkillsBattle as battle, createDiscoveryNativeE1SkillsEntry as entry,
  discoveryNativeE1PlanetologistRoute, discoveryNativeE1SkillsPlayer as player,
  finishDiscoveryNativeE1SkillsBattle as finish, movementDiscoveryNativeE1Skills as movement,
  phaseDiscoveryNativeE1Skills as phase, reloadDiscoveryNativeE1Skills as reload,
  revealDiscoveryNativeE1SkillsBattle as reveal, settleDiscoveryNativeE1Skills as settle,
  stepDiscoveryNativeE1Skills as step,
} from './fixture-discovery-native-e1-skills';

function reject(game: Game, actor: string, action: Action): void {
  const before = reload(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'Invalid native selections cannot partially debit or move physical inventory');
}
function acceptEntry(game: Game, source: string): Action {
  assert.ok(game.decision?.kind === 'discoveryEntry');
  return { type: 'decision', event: game.decision.event, accept: true,
    groups: [{ source, normal: 1, elite: 1 }] };
}

void test('original E1 all14 offers precede native Traitors and preserve first-Storm Tech and real first-Mentat retained cards', () => {
  for (const advanced of [false, true]) for (const tech of [false, true]) {
    const f = entry({ advanced, tech, strongholds: advanced });
    const skills = f.offered.leaderSkills!;
    assert.deepEqual([...skills.deck, ...Object.values(skills.offers).flatMap(o => o.cards)].sort(), LEADER_SKILL_CARDS.map(c => c.id).sort());
    assert.ok(f.offered.players.every(p => !p.traitorChoices.length && !p.traitors.length));
    assert.equal(player(f.offered, f.opponent).faceDancers, undefined);
    assert.equal(f.offered.discoveries!.tokens.length, 8);
    assert.deepEqual(f.offered.spiceDeck.flatMap(c => 'territory' in c && c.discovery ? [c.discovery] : []).sort(),
      DISCOVERY_SPICE_CARDS.map(c => c.discovery).sort());
    assert.equal(f.offered.spiceDeck.filter(c => 'sandtrout' in c && c.sandtrout).length, 1);
    assert.equal(player(f.afterSetup, f.opponent).faceDancers!.length, 3);
    assert.equal(player(f.afterSetup, f.owner).forces[MOBILE_LOCATION], 6);
    assert.equal(player(f.afterSetup, f.owner).elites!.forces[MOBILE_LOCATION], 3);
    for (const p of f.afterSetup.players) assert.equal(p.spice, FACTIONS.find(c => c.id === p.faction)!.spice);
    if (tech) {
      assert.ok(Object.values(f.initial.techTokens!).every(t => t.owner === null));
      assert.equal(f.afterFirstStorm.techTokens!.heighliners.owner, f.owner);
      assert.equal(f.afterFirstStorm.techTokens!.axlotl.owner, f.opponent);
      assert.equal(f.afterFirstStorm.techTokens!.production.owner, f.fremen);
    }
    if (advanced) {
      assert.equal(f.beforeFirstMentat.strongholdCards!.owners.arrakeen, null);
      const claimed = step(f.beforeFirstMentat, f.firstMentatStep);
      assert.equal(claimed.turn, 2);
      assert.equal(claimed.strongholdCards!.owners.arrakeen, f.owner);
      assert.equal(claimed.strongholdCards!.owners[MOBILE_STRONGHOLD], f.owner);
      assert.equal(f.game.strongholdCards!.owners.sietch_tabr, null);
    }
    custody(f.afterSetup); custody(f.game);
  }
});

void test('authenticated original lobby and original undealt setup retain actual IDs and authoritative offers', () => {
  const initial = createGame('HUMANE1DISCOVERY', newPlayer('human-ix', 'Human Ix', 'ixians'), true, ['ix']);
  for (const [id, faction] of [['human-tl', 'tleilaxu'], ['human-gu', 'guild'], ['human-fr', 'fremen']] as const)
    joinGame(initial, newPlayer(id, faction, faction));
  const before = reload(initial), f = entry({ initial, tech: true, strongholds: true });
  assert.deepEqual(initial, before);
  assert.deepEqual(f.game.players.map(p => p.id), before.players.map(p => p.id));
  assert.equal(f.owner, 'human-ix');
  const saved = reload(f.offered), resumed = entry({ initial: saved, skill: 'suk-graduate' });
  assert.deepEqual(saved, f.offered);
  assert.deepEqual(resumed.offered.leaderSkills, saved.leaderSkills, 'Never redeal an authenticated offer');
  assert.equal(resumed.trainer, f.trainer);
  custody(resumed.game);
  let randomLobby = reload(initial);
  randomLobby.discoveryEnabled = true;
  randomLobby = applyAction(randomLobby, randomLobby.host, { type: 'techTokens', enabled: true });
  randomLobby = applyAction(randomLobby, randomLobby.host, { type: 'strongholdCards', enabled: true });
  for (const p of randomLobby.players) randomLobby = applyAction(randomLobby, p.id, { type: 'ready' });
  const randomSetup = initializeLeaderSkillsGameForAudit(randomLobby), originalOffers = reload(randomSetup);
  const actual = entry({ initial: randomSetup });
  assert.deepEqual(randomSetup, originalOffers);
  assert.deepEqual(actual.offered.leaderSkills, originalOffers.leaderSkills);
  const entered = applyAction(actual.game, actual.owner, acceptEntry(actual.game, actual.source));
  assert.equal(player(entered, actual.owner).forces['shrine:0'], 2);
  assert.equal(player(entered, actual.owner).elites!.forces['shrine:0'], 1);
  custody(entered);
});

void test('trained original Ix typed free entry moves selected counters once without consuming training, shipment, movement, wallets or Tech', () => {
  for (const advanced of [false, true]) {
    const f = entry({ advanced, tech: true, strongholds: advanced });
    const before = player(f.game, f.owner), action = acceptEntry(f.game, f.source);
    assert.deepEqual(viewGame(f.game, f.owner).discoveryEntry!.sources, [{ source: f.source, normal: 2, elite: 1 }]);
    reject(f.game, f.opponent, action);
    reject(f.game, f.owner, { ...action, groups: [{ source: f.source, normal: 1, elite: 2 }] });
    const arrived = applyAction(reload(f.game), f.owner, action), own = player(arrived, f.owner);
    assert.equal(own.forces['shrine:0'], 2);
    assert.equal(own.elites!.forces['shrine:0'], 1);
    assert.equal(own.forces[f.source], 1);
    assert.equal(own.elites!.forces[f.source] ?? 0, 0);
    assert.equal(own.spice, before.spice);
    assert.equal(own.reserves, before.reserves);
    assert.equal(own.moved, before.moved);
    assert.equal(own.shipped, before.shipped);
    assert.deepEqual(arrived.leaderSkills, f.game.leaderSkills);
    assert.deepEqual(arrived.techTokens, f.game.techTokens);
    assert.equal(arrived.discoveryEntry, undefined);
    reject(arrived, f.owner, action);
    custody(arrived);
  }
});

void test('original paid typed shipment and Planetologist three-territory nested route retain HMS identity and accrue only native Heighliners', () => {
  for (const advanced of [false, true]) {
    const f = entry({ advanced, tech: true, strongholds: advanced, skill: 'planetologist' });
    assert.ok(f.game.decision?.kind === 'discoveryEntry');
    let game = applyAction(f.game, f.owner, { type: 'decision', event: f.game.decision.event, accept: false });
    game = movement(game, f.owner);
    nativeTypedClearBoard(game);
    const route = discoveryNativeE1PlanetologistRoute(game);
    nativeTypedPlace(game, f.owner, route.source, 3, 1);
    assert.equal(gameDistance(game, route.source, 'shrine:0', key => splitLocation(key).sector === game.storm), 3);
    const hms = player(game, f.owner).forces[MOBILE_LOCATION], beforeShip = reload(game);
    game = settle(applyAction(game, f.owner, { type: 'ship', territory: 'shrine', sector: 0, amount: 2, elite: 1 }));
    assert.equal(player(game, f.owner).spice, player(beforeShip, f.owner).spice - 2);
    assert.equal(player(game, f.guild).spice, player(beforeShip, f.guild).spice + 2);
    assert.equal(player(game, f.owner).reserves, player(beforeShip, f.owner).reserves - 2);
    assert.equal(player(game, f.owner).elites!.reserves, player(beforeShip, f.owner).elites!.reserves - 1);
    const moving = reload(game), move: Action = { type: 'move', territory: 'shrine', sector: 0,
      forces: { [route.source]: 2 }, eliteForces: { [route.source]: 1 }, planetologist: 'range' };
    reject(game, f.owner, { ...move, planetologist: undefined });
    game = settle(applyAction(game, f.owner, move));
    assert.equal(player(game, f.owner).forces['shrine:0'], 4);
    assert.equal(player(game, f.owner).elites!.forces['shrine:0'], 2);
    assert.equal(player(game, f.owner).forces[route.source], 2);
    assert.equal(player(game, f.owner).forces[MOBILE_LOCATION], hms);
    assert.equal(player(game, f.owner).spice, player(moving, f.owner).spice);
    assert.equal(player(game, f.owner).moved, 1);
    assert.equal(game.techTokens!.heighliners.spice, 1);
    const wallet = player(game, f.owner).spice;
    game = advance(game, g => g.phase !== 5);
    assert.equal(game.techTokens!.heighliners.spice, 0);
    assert.equal(player(game, f.owner).spice, wallet + 1);
    assert.deepEqual(game.leaderSkills, moving.leaderSkills);
    custody(game);
  }
});

void test('original trained Suk settles fixed physical rescue before only genuine Cyborg Tank losses can be substituted inside Shrine', () => {
  for (const advanced of [false, true]) for (const tech of [false, true]) {
    const f = battle({ advanced, tech, strongholds: advanced });
    const revealed = reveal(f), pending = finish(revealed, 'rescue');
    assert.ok(pending.decision?.kind === 'sukRescue');
    const own = player(pending, f.owner);
    assert.deepEqual(pending.pendingSukRescue!.losses, { normal: 4, elite: 2, paidNormal: 0, paidElite: advanced ? 1 : 0 });
    assert.equal(own.tanks, 0);
    assert.equal(own.forces[f.location], 8, 'Counters remain physically committed until the real rescue');
    assert.equal(pending.pendingIxSubstitution, undefined);
    assert.equal(own.spice, player(revealed, f.owner).spice - (advanced ? 1 : 0) +
      player(revealed, f.opponent).leaders.find(l => l.id === f.losingLeader)!.strength,
      'Retained Arrakeen cannot subsidize a nested site');
    const choice = pending.decision.options.findIndex(o => o.normal === 2 && o.elite === 1 && o.kept?.kind === 'normal');
    assert.ok(choice >= 0);
    reject(pending, f.owner, { type: 'decision', sources: { [f.location]: 1 }, recover: { [f.location]: 1 } });
    const rescueAction: Action = { type: 'decision', event: pending.decision.event, choice };
    const rescued = applyAction(reload(pending), f.owner, rescueAction), after = player(rescued, f.owner);
    assert.equal(rescued.decision?.kind, 'ixSubstitution');
    assert.equal(rescued.lastBattleContext!.sukRescue!.completed, true);
    assert.equal(after.forces[f.location], 3);
    assert.equal(after.elites!.forces[f.location] ?? 0, 0);
    assert.equal(after.reserves, own.reserves + 2);
    assert.equal(after.elites!.reserves, own.elites!.reserves + 1);
    assert.equal(after.tanks, 3);
    assert.equal(after.elites!.tanks, 1);
    assert.deepEqual(rescued.pendingIxSubstitution!.losses, { [f.location]: 1 });
    reject(rescued, f.owner, rescueAction);
    reject(rescued, f.owner, { type: 'decision', sources: { [f.location]: 1 }, recover: { [f.replacementSource]: 1 } });
    reject(rescued, f.owner, { type: 'decision', sources: { [f.location]: 2 }, recover: { [f.location]: 2 } });
    const substituted = settle(applyAction(reload(rescued), f.owner, { type: 'decision',
      sources: { [f.location]: 1 }, recover: { [f.location]: 1 } }));
    assert.equal(player(substituted, f.owner).forces[f.location], 3);
    assert.equal(player(substituted, f.owner).elites!.forces[f.location], 1);
    assert.equal(player(substituted, f.owner).tanks, 3);
    assert.equal(player(substituted, f.owner).elites!.tanks, 0);
    assert.equal(player(substituted, f.owner).spice, after.spice);
    assert.equal(substituted.lastBattleContext!.ixSubstitution!.completed, true);
    custody(substituted);
  }
});

void test('green original Ix Planetologist waits through native substitution then disposes exactly once before optional winner cleanup and Tech', () => {
  for (const advanced of [false, true]) {
    const f = battle({ advanced, tech: true, strongholds: advanced, skill: 'planetologist' });
    const pending = finish(reveal(f), 'substitution');
    assert.equal(pending.decision?.kind, 'ixSubstitution');
    assert.ok(player(pending, f.owner).hand.some(c => c.id === f.weapon));
    assert.ok(pending.pendingWinnerDiscards!.cards.includes(f.weapon));
    assert.equal(pending.techTokens!.axlotl.owner, f.opponent);
    const cards = finish(applyAction(reload(pending), f.owner, { type: 'decision', decline: true }), 'cards');
    assert.equal(cards.decision?.kind, 'battleCards');
    assert.equal(cards.discard.filter(c => c.id === f.weapon).length, 1);
    assert.equal(player(cards, f.owner).hand.some(c => c.id === f.weapon), false);
    assert.equal(cards.lastBattleContext!.winnerDiscards!.completed, true);
    assert.equal(player(cards, f.owner).forces[f.location], 2);
    assert.equal(player(cards, f.owner).tanks, 6);
    reject(cards, f.owner, { type: 'decision', discard: [f.weapon] });
    const face = finish(applyAction(cards, f.owner, { type: 'decision', discard: [f.defense] }), 'faceDance');
    assert.equal(face.techTokens!.axlotl.owner, f.owner);
    assert.equal(face.discard.filter(c => c.id === f.weapon).length, 1);
    assert.equal(face.discard.filter(c => c.id === f.defense).length, 1);
    assert.equal(face.discard.filter(c => c.id === f.losingCard).length, 1);
    assert.equal(face.decision?.kind, 'faceDance');
    custody(face);
  }
});

void test('matching native Face Dance kills the original trainer after rescue/cards/Tech, returns training once and retains native replacement eligibility', () => {
  for (const advanced of [false, true]) {
    const f = battle({ advanced, tech: true, strongholds: advanced });
    const cards = finish(reveal(f), 'cards');
    assert.equal(cards.decision?.kind, 'battleCards');
    const face = finish(applyAction(cards, f.owner, { type: 'decision', discard: [f.defense] }), 'faceDance');
    assert.equal(face.lastBattleContext!.winner, f.owner);
    assert.equal(face.techTokens!.axlotl.owner, f.owner);
    assert.ok(player(face, f.owner).hand.some(c => c.id === f.weapon));
    const own = player(face, f.owner), dancer = player(face, f.opponent);
    const action: Action = { type: 'decision', reveal: true, sector: 0,
      sources: { reserves: 1, [f.replacementSource]: 2 } };
    reject(face, f.opponent, { ...action, sector: 1 });
    const danced = applyAction(reload(face), f.opponent, action);
    assert.equal(player(danced, f.owner).leaders.find(l => l.id === f.trainer)!.dead, true);
    assert.equal(danced.leaderSkills!.assignments.some(a => a.leader === f.trainer), false);
    assert.equal(danced.leaderSkills!.deck.filter(s => s === f.skill).length, 1);
    assert.equal(player(danced, f.owner).reserves, own.reserves + 3);
    assert.equal(player(danced, f.owner).forces[f.location] ?? 0, 0);
    assert.equal(player(danced, f.opponent).forces[f.location], 3);
    assert.equal(player(danced, f.opponent).forces[f.replacementSource], 1);
    assert.equal(player(danced, f.opponent).reserves, dancer.reserves - 1);
    for (const p of face.players) assert.equal(player(danced, p.id).spice, p.spice, 'No second death bounty, subsidy or support debit');
    assert.deepEqual(danced.techTokens, face.techTokens);
    assert.deepEqual(player(danced, f.owner).hand, own.hand);
    reject(danced, f.opponent, action);
    const mentat = phase(danced, 8), stock = player(mentat, f.opponent).faceDancers!;
    const revealedDancer = stock.find(c => c.leader === f.trainer); assert.ok(revealedDancer?.revealed);
    reject(mentat, f.opponent, { type: 'replaceFaceDancer', leader: f.trainer });
    const untouched = stock.find(c => !c.revealed); assert.ok(untouched);
    const stockBefore = stock.map(c => ({ ...c }));
    const replaced = settle(applyAction(mentat, f.opponent, { type: 'replaceFaceDancer', leader: untouched.leader }));
    assert.equal(player(replaced, f.opponent).faceDancerReplacedTurn, replaced.turn);
    assert.deepEqual(player(replaced, f.opponent).faceDancers!.filter(c => c.leader === f.trainer), [revealedDancer]);
    for (const c of stockBefore.filter(c => c.leader !== untouched.leader))
      assert.ok(player(replaced, f.opponent).faceDancers!.some(n => n.leader === c.leader && n.revealed === c.revealed));
    reject(replaced, f.opponent, { type: 'replaceFaceDancer', leader: player(replaced, f.opponent).faceDancers!.find(c => !c.revealed)!.leader });
    custody(replaced);
    if (!advanced) {
      const revival = advance(replaced, g => g.turn === 3 && g.phase === 4 && !g.phaseOpening && !g.response && !g.decision);
      assert.equal(player(revival, f.owner).leaders.find(l => l.id === f.trainer)!.dead, true);
      reject(revival, f.opponent, { type: 'reviveForeignGhola', leader: f.trainer });
      assert.equal(revival.leaderSkills!.assignments.some(a => a.leader === f.trainer), false,
        'Basic native Tleilaxu cannot turn a matching dead trainer into a foreign skill carrier');
      custody(revival);
    }
  }
});

void test('all four original minimal policies produce real typed entry and capped trained rescue outcomes rather than action-list echoes', () => {
  const f = entry({ advanced: true, tech: true, strongholds: true });
  const b = battle({ advanced: true, tech: true, strongholds: true }), pending = finish(reveal(b), 'rescue');
  assert.ok(pending.decision?.kind === 'sukRescue');
  assert.equal(DIFFICULTIES.length, 4);
  for (const difficulty of DIFFICULTIES) {
    const entryView = viewGame(f.game, f.owner); entryView.players.find(p => p.id === f.owner)!.bot = difficulty;
    const entryAction = botActions(entryView)[0]; assert.ok(entryAction);
    const entered = applyAction(reload(f.game), f.owner, entryAction), before = player(f.game, f.owner), own = player(entered, f.owner);
    assert.equal(entered.discoveryEntry, undefined);
    const arrived = own.forces['shrine:0'] ?? 0;
    assert.equal((own.forces[f.source] ?? 0) + arrived, before.forces[f.source]);
    assert.equal((own.elites!.forces[f.source] ?? 0) + (own.elites!.forces['shrine:0'] ?? 0), 1);
    assert.equal(own.spice, before.spice);
    assert.equal(own.moved, before.moved);
    assert.equal(own.shipped, before.shipped);
    const rescueView = viewGame(pending, b.owner); rescueView.players.find(p => p.id === b.owner)!.bot = difficulty;
    const rescueAction = botActions(rescueView)[0]; assert.ok(rescueAction);
    const rescued = applyAction(reload(pending), b.owner, rescueAction);
    assert.equal(rescued.pendingSukRescue, null);
    assert.equal(rescued.lastBattleContext!.sukRescue!.completed, true);
    assert.equal(player(rescued, b.owner).tanks, 3, `${difficulty}: exactly three of six committed casualties are saved`);
    assert.equal(player(rescued, b.owner).forces[b.location], 3, `${difficulty}: exactly one rescue is kept in the original nested sector`);
    assert.equal(player(rescued, b.owner).reserves, player(pending, b.owner).reserves + 2);
    assert.equal(player(rescued, b.owner).spice, player(pending, b.owner).spice);
    const completed = finish(rescued);
    assert.equal(completed.lastBattleContext!.winner, b.owner);
    assert.equal(player(completed, b.opponent).tanks, 8);
    assert.equal(completed.techTokens!.axlotl.owner, b.owner);
    custody(entered); custody(completed);
  }
});

void test('hidden native Smuggler policy seals a real legal trainer plan in Discovery without applying full-state mode rules to a private player view', () => {
  const f = entry({ advanced: true, tech: true, strongholds: true, skill: 'smuggler' });
  let game = movement(f.game, f.owner);
  nativeTypedClearBoard(game);
  for (const seat of game.players) { game.deck.push(...seat.hand); seat.hand = []; }
  const territory = 'habbanya_ridge_sietch', key = `${territory}:${boardTerritory(territory).sectors[0]}`;
  nativeTypedPlace(game, f.owner, key, 3);
  nativeTypedPlace(game, f.opponent, key, 3);
  game = openSkillsTechBattle(phase(game, 6), f.owner, f.opponent, territory, true);
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, f.owner);
    view.players.find(p => p.id === f.owner)!.bot = difficulty;
    const plan = botActions(view).find(action => action.type === 'battlePlan' && action.leader === f.trainer);
    assert.ok(plan, `${difficulty} must retain the actually available hidden trainer as a legal plan candidate.`);
    const committed = applyAction(reload(game), f.owner, plan);
    assert.equal(committed.battle!.plans[f.owner].leader, f.trainer);
    assert.equal(player(committed, f.owner).forces[key], 3);
    assert.equal(player(committed, f.owner).spice, player(game, f.owner).spice,
      'A sealed first plan does not debit support or collect unearned Smuggler spice.');
  }
});
