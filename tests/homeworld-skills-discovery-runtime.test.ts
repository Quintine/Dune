import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { DIFFICULTIES } from '../game/bot-profiles';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { gameTerritories, validGameLocation } from '../game/board';
import { discoveryEntryDeclineAction, discoveryEntryMoveAction } from '../game/discovery-entry-options';
import { greatMakerRideAction } from '../game/great-maker-options';
import { homeworldContext } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import type { HomeworldCombatLossContext } from '../game/homeworld-combat-loss';
import { quoteSukPhysicalRescue } from '../game/suk-graduate';
import {
  classicHomeworldSkillsBotOffers, createClassicHomeworldSkillsFixture,
  quoteClassicHomeworldSkillsBattle, revealClassicHomeworldSkillsBattle,
  settleClassicHomeworldSkillsBattle,
} from './fixture-homeworld-classic-skills';
import {
  advanceHomeworldSkillsDiscovery as advance, assertHomeworldSkillsDiscoveryInventory as inventory,
  createHomeworldSkillsDiscoveryBattleFixture as battleFixture, createHomeworldSkillsDiscoveryFixture as fixture,
  createHomeworldSkillsDiscoveryLobby as lobby, createHomeworldSkillsDiscoverySetup as setup,
  homeworldSkillsDiscoveryClean as clean, homeworldSkillsDiscoveryEntryWindow as entryWindow,
  homeworldSkillsDiscoveryMakerWindow as makerWindow, homeworldSkillsDiscoveryPlayer as player,
  homeworldSkillsDiscoveryRescueChoice as rescueChoice, homeworldSkillsDiscoverySplitReturn as splitReturn,
  revealHomeworldSkillsDiscovery as reveal, revealHomeworldSkillsDiscoveryBattle as revealBattle,
  settleHomeworldSkillsDiscoveryBattle as settle,
} from './fixture-homeworld-skills-discovery';

/** Authorized root revision physical PDF21–23: original variants may compose.
 * Programmes select original undealt offers and unplayed Spice/token lotteries;
 * actions alone establish native withdrawals, casualties, reveal, entry and wins.
 * External Emperor split return remains the documented prototype placement
 * interpretation, not the PDF22 revival rule or a publisher allocation ruling. */
function legalPolicies(game: Game, actor: string): void {
  for (const difficulty of DIFFICULTIES) {
    const offers = classicHomeworldSkillsBotOffers(game, actor, difficulty);
    assert.ok(offers.length, `${difficulty} needs an owned original continuation.`);
    inventory(applyAction(structuredClone(game), actor, offers[0]));
  }
}
function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function physicalContext(game: Game): HomeworldCombatLossContext {
  return { advanced: game.advanced, players: game.players.map(p => {
    const total = Object.values(p.forces).reduce((a, b) => a + b, 0);
    const elite = Object.values(p.elites?.forces ?? {}).reduce((a, b) => a + b, 0);
    return { id: p.id, faction: p.faction, reserves: p.reserves, eliteReserves: p.elites?.reserves ?? 0,
      tanks: p.tanks, eliteTanks: p.elites?.tanks ?? 0, battleLosses: p.battleLosses,
      boardForces: { normal: total - elite, elite } };
  }) };
}

void test('original combined Basic/Advanced two-through-six setup deals all14 before faction choices and preserves DS7/8 and original hands', () => {
  for (const advanced of [false, true]) for (const seats of [2, 3, 4, 5, 6] as const) {
    const f = setup({ advanced, seats }), physical = f.offered.leaderSkills!;
    assert.equal(f.afterSetup.players.length, seats);
    assert.deepEqual([...physical.deck, ...Object.values(physical.offers).flatMap(o => o.cards),
      ...physical.assignments.map(a => a.skill)].sort(), LEADER_SKILL_CARDS.map(c => c.id).sort());
    assert.equal(f.offered.setupStage, 'leaderSkills');
    assert.equal(f.offered.players.flatMap(p => p.traitors).length, 0);
    assert.equal(f.afterSetup.leaderSkills!.assignments.length, seats);
    for (const p of f.afterSetup.players) {
      assert.equal(p.hand.length, p.faction === 'harkonnen' ? 2 : 1);
      assert.ok(f.afterSetup.leaderSkills!.assignments.some(a => a.owner === p.id && p.leaders.some(l => l.id === a.leader && !l.dead)));
    }
    for (const p of f.offered.players) legalPolicies(f.offered, p.id);
    inventory(f.offered); inventory(f.afterSetup);
  }
});

void test('all fourteen original skills remain physically selectable through combined Emperor offers in both rules modes', () => {
  for (const advanced of [false, true]) for (const card of LEADER_SKILL_CARDS) {
    const f = setup({ advanced, seats: 2, skill: card.id });
    assert.equal(f.afterSetup.leaderSkills!.assignments.find(a => a.owner === 'emperor')!.skill, card.id);
    legalPolicies(f.offered, 'emperor'); inventory(f.afterSetup);
  }
});

void test('real Maker losses precede actual storm-order majority or tie votes and a free typed native-reserve ride without losing training', () => {
  for (const advanced of [false, true]) for (const majority of [false, true]) {
    const f = fixture({ advanced, shipForMaker: true });
    const beforeArmy = player(f.game, f.owner), key = `${f.wormTerritory}:${f.wormSector}`;
    assert.equal(beforeArmy.forces[key], f.amount);
    assert.equal(beforeArmy.elites?.forces[key] ?? 0, f.elite);
    const originalTraining = structuredClone(f.game.leaderSkills!.assignments);
    const originalHomes = structuredClone(f.game.homeworlds!.custody);
    let game = makerWindow(f);
    const devoured = player(game, f.owner);
    assert.equal(game.turn, 2); assert.equal(game.phase, 1);
    assert.equal(game.greatMaker!.territory, f.wormTerritory);
    assert.equal(devoured.forces[key] ?? 0, 0);
    assert.equal(devoured.tanks, beforeArmy.tanks + f.amount);
    assert.equal(devoured.elites?.tanks ?? 0, (beforeArmy.elites?.tanks ?? 0) + f.elite);
    assert.equal(devoured.reserves, beforeArmy.reserves);
    assert.deepEqual(game.homeworlds!.custody, originalHomes);
    assert.deepEqual(game.leaderSkills!.assignments, originalTraining);
    assert.equal(game.discoveries!.tokens.find(t => t.id === f.token)!.revealedTurn, null);
    const order = [...game.order];
    for (const [index, actor] of order.entries()) {
      assert.ok(game.decision?.kind === 'greatMakerVote'); assert.equal(game.decision.player, actor);
      legalPolicies(game, actor);
      const vote: Action = { type: 'decision', event: game.decision.event, yes: index < (majority ? 3 : 2) };
      reject(game, order[(index + 1) % order.length], vote);
      game = applyAction(game, actor, vote);
    }
    assert.equal(game.nexus, majority, 'Three of four opens Nexus; two of four does not.');
    assert.ok(game.decision?.kind === 'greatMakerRide'); assert.equal(game.decision.player, f.fremen);
    legalPolicies(game, f.fremen);
    const view = viewGame(game, f.fremen), target = view.greatMaker!.ride!.destinations.find(d => d.territory === 'polar_sink'); assert.ok(target);
    const before = structuredClone(player(game, f.fremen)), training = structuredClone(game.leaderSkills!.assignments);
    const elite = advanced ? 1 : 0, action = greatMakerRideAction(view, target.territory, target.sector, 2, elite); assert.ok(action);
    reject(game, f.fremen, { ...action, event: 'stale-maker-ride' });
    reject(game, f.fremen, { ...action, territory: 'homeworld:fremen', sector: 0 });
    reject(game, f.fremen, { ...action, elite: 4 });
    game = applyAction(game, f.fremen, action);
    const after = player(game, f.fremen), destination = `${target.territory}:${target.sector}`;
    assert.equal(after.reserves, before.reserves - 2);
    assert.equal(after.elites?.reserves ?? 0, (before.elites?.reserves ?? 0) - elite);
    assert.equal(after.forces[destination], (before.forces[destination] ?? 0) + 2);
    assert.equal(after.elites?.forces[destination] ?? 0, (before.elites?.forces[destination] ?? 0) + elite);
    assert.equal(after.spice, before.spice); assert.equal(after.moved, before.moved); assert.equal(after.shipped, before.shipped);
    const native = homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!).find(h => h.native === f.fremen)!;
    assert.deepEqual(native.forces[f.fremen], { normal: after.reserves - (after.elites?.reserves ?? 0), elite: after.elites?.reserves ?? 0 });
    assert.deepEqual(game.leaderSkills!.assignments, training); inventory(game);
  }
});

void test('actual inspection/reveal and later entry move only real parent forces, retaining native custody, training and normal movement allowances', () => {
  for (const advanced of [false, true]) {
    const f = fixture({ advanced }), revealed = reveal(f);
    assert.equal(validGameLocation(f.game, f.face, 0), false);
    assert.equal(validGameLocation(revealed, f.face, 0), true);
    assert.equal(revealed.discoveries!.tokens.find(t => t.id === f.token)!.revealedTurn, 1);
    assert.equal(player(revealed, f.owner).forces[`${f.face}:0`] ?? 0, 0, 'Reveal itself is not physical entry.');
    const game = entryWindow(f), view = viewGame(game, f.owner), sources = view.discoveryEntry!.sources;
    assert.equal(game.turn, 2); assert.equal(game.phase, 0);
    assert.deepEqual(sources, [{ source: `${f.parent}:${f.parentSector}`, normal: f.amount - f.elite, elite: f.elite }]);
    legalPolicies(game, f.owner);
    const action = discoveryEntryMoveAction(view, sources), decline = discoveryEntryDeclineAction(view); assert.ok(action && decline);
    const before = structuredClone(player(game, f.owner)), custody = structuredClone(game.homeworlds!.custody), training = structuredClone(game.leaderSkills!.assignments);
    assert.deepEqual(player(applyAction(structuredClone(game), f.owner, decline), f.owner).forces, before.forces);
    reject(game, f.owner, { ...action, event: 'stale-discovery-entry' });
    reject(game, f.fremen, action);
    for (const source of ['homeworld:emperor', 'homeworld:emperor:salusa', `${f.face}:0`]) {
      const groups = [{ source, normal: 1, elite: 0 }];
      assert.equal(discoveryEntryMoveAction(view, groups), null); reject(game, f.owner, { ...action, groups });
    }
    const entered = applyAction(JSON.parse(JSON.stringify(game)), f.owner, action), after = player(entered, f.owner);
    assert.equal(after.forces[`${f.face}:0`], f.amount); assert.equal(after.elites?.forces[`${f.face}:0`] ?? 0, f.elite);
    assert.equal(after.forces[`${f.parent}:${f.parentSector}`] ?? 0, 0);
    assert.deepEqual(entered.homeworlds!.custody, custody); assert.deepEqual(entered.leaderSkills!.assignments, training);
    assert.equal(after.reserves, before.reserves); assert.equal(after.elites?.reserves, before.elites?.reserves);
    assert.equal(after.spice, before.spice); assert.equal(after.moved, before.moved); assert.equal(after.shipped, before.shipped);
    assert.ok(gameTerritories(entered).every(t => !t.id.startsWith('homeworld:'))); inventory(entered);
  }
});

for (const advanced of [false, true]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} actual trained Suk nested win has no native bonus and returns only typed rescued pieces to real homes`, () => {
    const f = battleFixture({ advanced });
    const owner = f.owner, opponent = f.opponent!;
    const reinforcedBefore = player(f.beforeReinforcement, owner), reinforcedAfter = player(f.afterReinforcement, owner), reinforcement = advanced ? 2 : 3;
    assert.equal(reinforcedAfter.spice, reinforcedBefore.spice - reinforcement, 'One spice per real nested reinforcement, not a Homeworld invasion price.');
    assert.equal(reinforcedAfter.reserves, reinforcedBefore.reserves - reinforcement);
    assert.equal(reinforcedAfter.forces[`${f.face}:0`], 5);
    assert.equal(player(f.game, opponent).forces[`${f.face}:0`], 2);
    for (const actor of [owner, opponent]) legalPolicies(f.game, actor);
    const revealed = revealBattle(f), quote = quoteClassicHomeworldSkillsBattle(revealed), own = revealed.battle!.attacker === owner ? 'attacker' : 'defender';
    assert.equal(quote.winner, owner);
    assert.equal(quote.scores![own], 4 + player(revealed, owner).leaders.find(l => l.id === f.trainer)!.strength);
    assert.equal(quote.leaderSkillBonuses[own].bonus, 0, 'Suk rescue is not native Homeworld strength or a battle-strength skill.');
    assert.deepEqual(viewGame(revealed, owner).battle!.traitorVoters.sort(), [owner, opponent].sort(), 'Nested Arrakis battle retains both ordinary traitor-call owners.');
    const pending = settle(revealed, 'suk'); assert.ok(pending.decision?.kind === 'sukRescue');
    const receipt = pending.pendingSukRescue!, choice = rescueChoice(pending), option = pending.decision.options[choice], destinations = splitReturn(pending, choice);
    assert.equal(receipt.territory, f.face); assert.equal(receipt.skill.mode, 'skilled');
    assert.deepEqual(receipt.pool, [{ key: `${f.face}:0`, normal: advanced ? 4 : 5, elite: advanced ? 1 : 0 }]);
    assert.equal(receipt.losses!.normal, advanced ? 2 : 4); assert.equal(receipt.losses!.elite, advanced ? 1 : 0);
    assert.equal(option.normal + option.elite, 3); assert.deepEqual(option.kept, { key: `${f.face}:0`, kind: 'normal' });
    legalPolicies(pending, owner);
    const action: Action = { type: 'decision', event: pending.decision.event, choice, ...(destinations ? { destinations } : {}) };
    reject(pending, owner, { ...action, event: 'stale-suk-rescue' });
    reject(pending, opponent, action);
    reject(pending, owner, { ...action, destinations: { [`${f.face}:0`]: { normal: 2, elite: 0 } } });
    reject(pending, owner, { ...action, destinations: { 'homeworld:guild': { normal: 2, elite: 0 } } });
    if (advanced) {
      assert.equal(pending.decision.reserveHomes?.length, 2);
      assert.deepEqual(destinations, { 'homeworld:emperor': { normal: 0, elite: 1 }, 'homeworld:emperor:salusa': { normal: 1, elite: 0 } });
      reject(pending, owner, { type: 'decision', event: pending.decision.event, choice });
      reject(pending, owner, { ...action, destinations: { 'homeworld:emperor': { normal: 1, elite: 0 } } });
      reject(pending, owner, { ...action, destinations: { 'homeworld:emperor': { normal: 0, elite: 2 }, 'homeworld:emperor:salusa': { normal: 0, elite: 0 } } });
    }
    const physical = quoteSukPhysicalRescue(physicalContext(pending), pending.homeworlds!.custody!, {
      player: owner, territory: f.face, skill: receipt.skill, pool: receipt.pool, losses: receipt.losses!, option, destinations,
    });
    assert.equal(physical.receipt.source, 'arrakis');
    const before = structuredClone(player(pending, owner)), homeBefore = homeworldForceGroups(homeworldContext(pending), pending.homeworlds!.custody!);
    const done = settle(applyAction(JSON.parse(JSON.stringify(pending)), owner, action)), after = player(done, owner);
    assert.equal(done.lastBattleContext!.winner, owner);
    assert.equal(after.forces[`${f.face}:0`], advanced ? 3 : 2, 'Only undialed pieces plus the one physically kept ordinary counter remain.');
    assert.equal(after.elites?.forces[`${f.face}:0`] ?? 0, 0);
    assert.equal(after.reserves, before.reserves + 2); assert.equal(after.elites?.reserves ?? 0, (before.elites?.reserves ?? 0) + (advanced ? 1 : 0));
    assert.equal(after.tanks, before.tanks + (advanced ? 0 : 1));
    assert.equal(before.spice, reinforcedAfter.spice - (advanced ? 2 : 0), 'Actual support is paid before rescue and independent Collection.');
    assert.equal(player(done, opponent).forces[`${f.face}:0`] ?? 0, 0);
    assert.equal(player(done, opponent).tanks, player(f.game, opponent).tanks + 2);
    assert.deepEqual(done.homeworlds!.custody, physical.custody);
    const homeAfter = homeworldForceGroups(homeworldContext(done), done.homeworlds!.custody!);
    if (advanced) for (const home of homeBefore.filter(h => h.native === owner)) {
      const afterHome = homeAfter.find(h => h.id === home.id)!, returned = destinations![home.id];
      assert.equal(afterHome.forces[owner].normal, home.forces[owner].normal + returned.normal);
      assert.equal(afterHome.forces[owner].elite, home.forces[owner].elite + returned.elite);
    }
    assert.equal(player(done, owner).leaders.find(l => l.id === f.trainer)!.dead, false);
    assert.ok(done.leaderSkills!.assignments.some(a => a.owner === owner && a.leader === f.trainer && a.skill === 'suk-graduate'));
    assert.equal(done.pendingSukRescue ?? null, null); inventory(done);
    const later = advance(done, g => g.phase === 7 && clean(g));
    assert.equal(player(later, owner).spice, before.spice + 2, 'The surviving nested army receives printed Cistern income, not a support refund.');
    assert.equal(player(later, owner).forces[`${f.face}:0`], after.forces[`${f.face}:0`]); inventory(later);
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} original native and visitor Homeworld Suk rescues still use their proper physical pools with Discovery retained`, () => {
    for (const kind of ['native-suk', 'visitor-suk'] as const) {
      const initial = lobby({ advanced, roster: ['emperor', 'guild', 'atreides', 'harkonnen'] });
      const f = createClassicHomeworldSkillsFixture({ initial, advanced, kind }), pending = settleClassicHomeworldSkillsBattle(revealClassicHomeworldSkillsBattle(f), 'suk');
      assert.ok(pending.decision?.kind === 'sukRescue');
      const choice = rescueChoice(pending, kind === 'native-suk' && advanced ? 'elite' : 'normal'), option = pending.decision.options[choice], receipt = pending.pendingSukRescue!;
      const destinations = splitReturn(pending, choice);
      if (kind === 'native-suk') {
        assert.equal(pending.decision.reserveHomes, undefined);
        reject(pending, f.owner, { type: 'decision', event: pending.decision.event, choice, destinations: { 'homeworld:emperor': { normal: 1, elite: 0 } } });
      }
      const physical = quoteSukPhysicalRescue(physicalContext(pending), pending.homeworlds!.custody!, {
        player: f.owner, territory: f.territory, skill: receipt.skill, pool: receipt.pool, losses: receipt.losses!, option, destinations,
      });
      assert.equal(physical.receipt.source, kind === 'native-suk' ? 'native-homeworld' : 'visitor-homeworld');
      legalPolicies(pending, f.owner);
      const done = settleClassicHomeworldSkillsBattle(applyAction(pending, f.owner,
        { type: 'decision', event: pending.decision.event, choice, ...(destinations ? { destinations } : {}) }));
      assert.deepEqual(done.homeworlds!.custody, physical.custody);
      if (kind === 'native-suk' && advanced) assert.deepEqual(done.homeworlds!.custody!.salusa, pending.homeworlds!.custody!.salusa, 'Saved native Sardaukar never leave their original Salusa pool.');
      assert.ok(done.leaderSkills!.assignments.some(a => a.leader === f.trainer && a.skill === 'suk-graduate'));
      inventory(done);
    }
  });
}
