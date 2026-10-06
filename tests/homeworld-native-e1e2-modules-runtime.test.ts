import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import type { FactionId } from '../game/catalog';
import { TERRITORIES, territory } from '../game/board';
import { richeseCards } from '../game/richese-cards';
import { nativeShipmentSources } from '../game/homeworld-options';
import { discoveryEntryMoveAction } from '../game/discovery-entry-options';
import { greatMakerRideAction } from '../game/great-maker-options';
import { ownedTech } from '../game/tech-tokens';
import {
  advanceNativeHomeworld as advance, createNativeHomeworldModuleSetup as setup,
  createNativeHomeworldSukProgramme as sukProgramme, createNativeHomeworldDiscoveryProgramme as discoveryProgramme,
  enterNativeHomeworldDiscovery as enter, revealNativeHomeworldDiscovery as reveal,
  invadeNativeHomeworld as invade, nativeHomeworldArmy as army, nativeHomeworldClean as clean,
  nativeHomeworldInventory as inventory, nativeHomeworldLeader as leader, nativeHomeworldMovement as movement,
  nativeHomeworldPlayer as player, openNativeHomeworldBattle as openBattle,
  revealNativeHomeworldPlans as plans, settleNativeHomeworldArrival as arrival,
  type NativeHomeworldModuleOptions,
} from './fixture-homeworld-native-e1e2-modules';

/** Authorized revision PDF21–23 composes variants; exact original native
 * component contracts supply abilities. These programmes choose only fresh
 * undealt lotteries/unplayed Spice order. No force, wallet, hand, owner, phase,
 * signed frame or casualty is staged. Emperor return rulings remain untouched. */
function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function policies(game: Game, actor: string, relevant: (action: Action) => boolean): void {
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, actor); view.players.find(p => p.id === actor)!.bot = difficulty;
    const action = botActions(view).find(relevant); assert.ok(action, `${difficulty} consumes an owned relevant offer`);
    const after = applyAction(structuredClone(game), actor, action);
    if (after.status === 'playing') inventory(after);
  }
}
const e1Rosters: readonly (readonly FactionId[])[] = [
  ['ixians', 'guild'], ['tleilaxu', 'guild'], ['ixians', 'tleilaxu', 'guild', 'fremen'],
];
const e2Rosters: readonly (readonly FactionId[])[] = [
  ['choam', 'guild'], ['richese', 'guild'], ['choam', 'richese', 'guild', 'fremen'],
];

void test('original Basic/Advanced E1/E2 single and paired rosters compose either or both modules without changing selected 47/35 decks or private native inventories', () => {
  for (const advanced of [false, true]) for (const expansions of [['ix'], ['choam']])
    for (const roster of expansions[0] === 'ix' ? e1Rosters : e2Rosters)
      for (const [skills, discovery] of [[true, false], [false, true], [true, true]]) {
        const f = setup({ advanced, expansions, roster, skills, discovery });
        assert.equal(f.afterSetup.leaderSkills?.assignments.length ?? 0, skills ? roster.length : 0);
        assert.equal(f.afterSetup.discoveries?.tokens.length ?? 0, discovery ? 8 : 0);
        for (const p of f.afterSetup.players) {
          assert.equal(p.hand.length, 1);
          assert.equal(viewGame(f.afterSetup, p.id).players.find(q => q.id !== p.id)!.hand, undefined);
        }
        if (roster.includes('tleilaxu')) {
          assert.equal(player(f.afterSetup, 'tleilaxu').faceDancers!.length, 3);
          assert.equal(new Set(player(f.afterSetup, 'tleilaxu').faceDancers!.map(c => c.leader)).size, 3);
        }
        if (roster.includes('richese')) {
          assert.deepEqual(f.afterSetup.richeseCache!.map(c => c.id).sort(), richeseCards().map(c => c.id).sort());
          assert.deepEqual(player(f.afterSetup, 'richese').noField!.tokens.map(t => t.value).sort((a, b) => a - b), [0, 3, 5]);
        }
        if (roster.includes('choam')) assert.equal(player(f.afterSetup, 'choam').leaders.filter(l => l.id === 'choam-auditor').length, advanced ? 1 : 0);
        if (f.offered) policies(f.offered, roster[0], a => a.type === 'leaderSkill');
        inventory(f.afterSetup);
      }
});

void test('supported original Advanced two-deck native rosters retain Ix-selected deck precedence and optional Tech3+/Stronghold2+ components', () => {
  const rosters: readonly (readonly FactionId[])[] = [
    ['ixians', 'choam', 'guild'], ['tleilaxu', 'richese', 'guild'],
    ['ixians', 'tleilaxu', 'choam', 'richese', 'guild', 'fremen'],
  ];
  for (const roster of rosters) for (const [skills, discovery] of [[true, false], [false, true], [true, true]]) {
    const f = setup({ advanced: true, expansions: ['ix', 'choam'], roster, skills, discovery, tech: true, strongholds: true });
    assert.ok(f.afterSetup.techTokens && f.afterSetup.strongholdCards);
    assert.equal(f.afterSetup.techTokens!.axlotl.owner, roster.includes('tleilaxu') ? 'tleilaxu' : null);
    inventory(f.afterSetup);
  }
});

void test('native and visiting trained/normal Ixian Suk preserve physical saved sources and allow only the real residual Cyborg exchange after rescue', () => {
  for (const advanced of [false, true]) for (const visitor of [false, true]) for (const band of ['normal', 'skilled'] as const) {
    const f = sukProgramme({ advanced, visitor, band, tech: true, strongholds: advanced });
    const revealed = plans(f.game, f.plans);
    let game = advance(revealed, g => g.decision?.kind === (band === 'normal' ? 'ixSubstitution' : 'sukRescue'));
    let before = structuredClone(revealed);
    if (band === 'skilled') {
      const decision = game.decision; assert.ok(decision?.kind === 'sukRescue');
      assert.equal(Math.max(...decision.options.map(o => o.normal + o.elite)), 3);
      assert.deepEqual(army(game, f.owner, f.territory), army(f.game, f.owner, f.territory),
        'Own casualty selection has not transported or killed a counter yet.');
      policies(game, f.owner, a => a.type === 'decision' && a.choice !== undefined);
      const choice = decision.options.findIndex(o => o.normal === 0 && o.elite === 1 && o.kept?.kind === 'elite');
      assert.ok(choice >= 0);
      before = structuredClone(game);
      reject(game, f.opponent, { type: 'decision', event: decision.event, choice });
      reject(game, f.owner, { type: 'decision', event: 'stale-suk', choice });
      reject(game, f.owner, { type: 'decision', event: decision.event, choice,
        destinations: { [f.territory]: { normal: 1, elite: 1 } } });
      game = applyAction(game, f.owner, { type: 'decision', event: decision.event, choice });
      game = advance(game, g => g.decision?.kind === 'ixSubstitution');
    }
    const nativeBefore = army(before, f.owner, 'homeworld:ixians');
    const physical = game.lastBattleContext!.sukRescue!.physical!;
    assert.equal(physical.source, visitor ? 'visitor-homeworld' : 'native-homeworld');
    assert.deepEqual(physical.saved, { normal: 0, elite: 1 });
    assert.deepEqual(physical.tanks, { normal: 0, elite: 2 });
    assert.equal(player(game, f.owner).tanks, player(before, f.owner).tanks + 2);
    assert.equal(player(game, f.owner).elites!.tanks, player(before, f.owner).elites!.tanks + 2);
    if (visitor && band === 'normal') {
      assert.deepEqual(physical.destinations, { 'homeworld:ixians': { normal: 0, elite: 1 } });
      assert.deepEqual(army(game, f.owner, 'homeworld:ixians'), { ...nativeBefore, elite: nativeBefore.elite + 1 });
    } else assert.deepEqual(physical.destinations, {});
    assert.deepEqual(game.pendingIxSubstitution!.losses, { [f.territory]: 2 });
    const substitution = structuredClone(game), beforeArmy = army(game, f.owner, f.territory);
    const action: Action = { type: 'decision', sources: { [f.territory]: 1 }, recover: { [f.territory]: 1 } };
    reject(game, f.owner, { ...action, recover: { [f.territory]: 3 } });
    reject(game, f.owner, { ...action, sources: { reserves: 1 } });
    reject(game, f.owner, { ...action, recover: { 'hidden_mobile_stronghold:0': 1 } });
    policies(game, f.owner, a => a.type === 'decision' && (a.decline === true || a.sources !== undefined));
    game = applyAction(game, f.owner, action);
    game = advance(game, g => !g.pendingIxSubstitution);
    assert.deepEqual(army(game, f.owner, f.territory), { normal: beforeArmy.normal - 1, elite: beforeArmy.elite + 1 });
    assert.equal(player(game, f.owner).tanks, player(substitution, f.owner).tanks);
    assert.equal(player(game, f.owner).elites!.tanks, player(substitution, f.owner).elites!.tanks - 1);
    assert.equal(player(game, f.owner).battleLosses, player(substitution, f.owner).battleLosses);
    assert.equal(player(game, f.owner).spice, player(substitution, f.owner).spice);
    assert.deepEqual(game.players.map(p => [p.id, p.spice]), substitution.players.map(p => [p.id, p.spice]),
      'Substitution creates neither a second support payment nor a bounty for any faction.');
    assert.deepEqual(player(game, f.owner).hand, player(substitution, f.owner).hand);
    assert.deepEqual(game.discard, substitution.discard);
    assert.deepEqual(game.leaderSkills!.assignments, substitution.leaderSkills!.assignments);
    if (visitor) assert.deepEqual(army(game, f.owner, 'homeworld:ixians'), army(substitution, f.owner, 'homeworld:ixians'));
    reject(game, f.owner, action); inventory(game);
    game = advance(game, g => !g.battle && !g.pendingIxSubstitution && !g.decision && !g.response && !g.pendingTreacheryDiscard);
    assert.equal(game.lastBattleContext!.winner, f.owner);
    assert.equal(game.lastBattleContext!.sukRescue!.completed, true);
    assert.equal(game.lastBattleContext!.ixSubstitution!.completed, true);
    assert.ok(ownedTech(game.techTokens!, f.owner).includes('heighliners'));
    inventory(game);
  }
});

void test('genuine maximum trained Cyborg rescue opens no exchange for saved casualties and cannot be claimed twice', () => {
  const f = sukProgramme({ advanced: true, visitor: true, band: 'skilled', tech: true });
  let game = advance(plans(f.game, f.plans), g => g.decision?.kind === 'sukRescue');
  const d = game.decision; assert.ok(d?.kind === 'sukRescue');
  const choice = d.options.findIndex(o => o.elite === 3 && o.normal === 0 && o.kept?.kind === 'elite'); assert.ok(choice >= 0);
  const action: Action = { type: 'decision', event: d.event, choice };
  game = applyAction(game, f.owner, action);
  assert.equal(player(game, f.owner).elites!.tanks, 0);
  assert.deepEqual(army(game, f.owner, f.territory), { normal: 4, elite: 1 });
  assert.deepEqual(army(game, f.owner, 'homeworld:ixians'), { normal: 6, elite: 3 });
  reject(game, f.owner, action); inventory(game);
});

void test('native E1/E2 Discovery inspection and later typed parent entry move only original shipped counters without borrowing native reserves', () => {
  for (const advanced of [false, true]) for (const family of ['ix', 'choam']) for (const skills of [false, true]) {
    const options: NativeHomeworldModuleOptions = family === 'ix'
      ? { roster: ['ixians', 'tleilaxu', 'guild', 'fremen'], expansions: ['ix'] }
      : { roster: ['richese', 'choam', 'guild', 'fremen'], expansions: ['choam'], skill: 'planetologist' };
    const f = discoveryProgramme({ ...options, advanced, skills, face: 'cistern', tech: true, strongholds: advanced });
    const key = `${f.parent}:${f.parentSector}`;
    assert.equal(player(f.game, f.owner).forces[key], 2);
    assert.equal(player(f.game, f.owner).reserves, player(f.beforeShipment, f.owner).reserves - 2);
    const unveiled = reveal(f);
    assert.equal(unveiled.discoveries!.tokens.find(t => t.id === f.token)!.revealedTurn, 1);
    assert.equal(player(unveiled, f.owner).forces['cistern:0'] ?? 0, 0, 'Reveal never creates an army.');
    const window = advance(unveiled, g => g.turn === 2 && g.decision?.kind === 'discoveryEntry' && g.decision.player === f.owner);
    policies(window, f.owner, a => a.type === 'decision');
    const view = viewGame(window, f.owner), action = discoveryEntryMoveAction(view, view.discoveryEntry!.sources); assert.ok(action);
    reject(window, f.owner, { ...action, sources: { [`homeworld:${f.owner}`]: { normal: 2, elite: 0 } } });
    const homes = structuredClone(window.homeworlds!.custody), before = structuredClone(player(window, f.owner));
    const after = applyAction(window, f.owner, action);
    assert.equal(player(after, f.owner).forces[key] ?? 0, 0);
    assert.equal(player(after, f.owner).forces['cistern:0'], 2);
    assert.equal(player(after, f.owner).elites?.forces['cistern:0'] ?? 0, family === 'ix' ? 1 : 0);
    assert.deepEqual(after.homeworlds!.custody, homes);
    assert.equal(player(after, f.owner).spice, before.spice);
    assert.equal(player(after, f.owner).moved, before.moved);
    assert.equal(player(after, f.owner).shipped, before.shipped);
    assert.deepEqual(after.leaderSkills, window.leaderSkills); inventory(after);
  }
});

void test('original native Discovery Great Maker votes precede a free typed Fremen reserve ride with original Homeworld custody', () => {
  for (const advanced of [false, true]) {
    const f = discoveryProgramme({ advanced, maker: true, face: 'cistern', tech: true });
    let game = advance(f.game, g => g.decision?.kind === 'greatMakerVote');
    for (const actor of game.order) {
      assert.ok(game.decision?.kind === 'greatMakerVote'); assert.equal(game.decision.player, actor);
      policies(game, actor, a => a.type === 'decision');
      game = applyAction(game, actor, { type: 'decision', event: game.decision.event, yes: false });
    }
    assert.ok(game.decision?.kind === 'greatMakerRide'); assert.equal(game.decision.player, 'fremen');
    const view = viewGame(game, 'fremen'), destination = view.greatMaker!.ride!.destinations.find(d => d.territory === 'polar_sink'); assert.ok(destination);
    policies(game, 'fremen', a => a.type === 'decision');
    const elite = advanced ? 1 : 0, action = greatMakerRideAction(view, destination.territory, destination.sector, 2, elite); assert.ok(action);
    reject(game, 'fremen', { ...action, territory: 'homeworld:ixians', sector: 0 });
    const before = structuredClone(player(game, 'fremen')), training = structuredClone(game.leaderSkills);
    game = applyAction(game, 'fremen', action);
    assert.equal(player(game, 'fremen').reserves, before.reserves - 2);
    assert.equal(player(game, 'fremen').elites!.reserves, before.elites!.reserves - elite);
    assert.equal(player(game, 'fremen').forces['polar_sink:0'], (before.forces['polar_sink:0'] ?? 0) + 2);
    assert.equal(player(game, 'fremen').spice, before.spice);
    assert.deepEqual(game.leaderSkills, training); inventory(game);
  }
});

void test('original Richese marker retains its signed token, charges one invoice and materializes only real native reserves at a revealed nested Discovery', () => {
  for (const advanced of [false, true]) {
    const f = discoveryProgramme({ advanced, expansions: ['choam'], roster: ['richese', 'choam', 'guild', 'fremen'],
      collector: 'guild', skill: 'planetologist', face: 'shrine', tech: true, strongholds: advanced });
    const entered = enter(f);
    let game = movement(entered, 'richese', 2);
    const p = player(game, 'richese'), marker = p.noField!.tokens.find(t => t.value === 5)!;
    const before = structuredClone(game), invoice: Action = { type: 'ship', territory: 'shrine', sector: 0,
      noField: marker.id, event: p.noFieldEvent, allyPayment: 0 };
    reject(game, 'richese', { ...invoice, event: 'stale-marker' });
    game = arrival(applyAction(game, 'richese', invoice));
    assert.equal(player(game, 'richese').reserves, player(before, 'richese').reserves);
    assert.equal(player(game, 'richese').forces['shrine:0'] ?? 0, 0);
    assert.equal(player(game, 'richese').noField!.deployed!.tokenId, marker.id);
    assert.equal(player(before, 'richese').spice - player(game, 'richese').spice, 1);
    assert.equal(player(game, 'guild').spice - player(before, 'guild').spice, 1);
    reject(game, 'richese', invoice);
    const deployed = structuredClone(game), event = player(game, 'richese').noFieldEvent;
    game = applyAction(game, 'richese', { type: 'revealNoField', token: marker.id, event });
    assert.equal(player(game, 'richese').forces['shrine:0'], 5);
    assert.equal(player(game, 'richese').reserves, player(deployed, 'richese').reserves - 5);
    assert.equal(player(game, 'richese').spice, player(deployed, 'richese').spice);
    assert.equal(player(game, 'guild').spice, player(deployed, 'guild').spice);
    assert.equal(player(game, 'richese').noField!.lastShipped, marker.id);
    assert.equal(player(game, 'richese').noField!.deployed, null);
    inventory(game);
  }
});

void test('real repeated original Richese marker shipments cap the final printed five at the four physical reserves left, never inventing a fifth counter', () => {
  let game = setup({ advanced: true, skills: false, expansions: ['choam'], roster: ['richese', 'choam', 'guild'] }).afterSetup;
  for (const [index, value] of [5, 3, 5, 3, 5].entries()) {
    game = movement(game, 'richese', index + 1);
    const t = ['sietch_tabr', 'habbanya_ridge_sietch'].map(id => territory(id))
      .find(candidate => !candidate.sectors.includes(game.storm)); assert.ok(t);
    const sector = t.sectors[0];
    const before = structuredClone(player(game, 'richese')), token = before.noField!.tokens.find(t => t.value === value)!;
    game = arrival(applyAction(game, 'richese', { type: 'ship', territory: t.id, sector,
      noField: token.id, event: before.noFieldEvent, allyPayment: 0 }));
    const deployed = structuredClone(player(game, 'richese'));
    game = applyAction(game, 'richese', { type: 'revealNoField', token: token.id, event: deployed.noFieldEvent });
    const physical = Math.min(value, before.reserves);
    assert.equal(player(game, 'richese').forces[`${t.id}:${sector}`], (before.forces[`${t.id}:${sector}`] ?? 0) + physical);
    assert.equal(player(game, 'richese').reserves, before.reserves - physical);
    assert.equal(player(game, 'richese').spice, deployed.spice);
    if (index === 4) { assert.equal(physical, 4); assert.equal(player(game, 'richese').reserves, 0); }
    inventory(game);
  }
});

void test('real CHOAM low-home shipment and Advanced paid battle support charge once without bypassing original income or reserve pools', () => {
  const f = setup({ advanced: true, expansions: ['choam'], roster: ['choam', 'richese', 'guild', 'fremen'],
    skill: 'smuggler', tech: true, strongholds: true });
  let game = advance(f.afterSetup, g => g.turn === 1 && g.phase === 5 && clean(g));
  const destination = TERRITORIES.find(t => t.type === 'stronghold' && t.id !== 'tueks_sietch' &&
    !t.sectors.includes(game.storm) && t.id !== 'sietch_tabr'); assert.ok(destination);
  const remaining = new Set(['choam', 'guild']);
  while (remaining.size) {
    game = advance(game, g => g.turn === 1 && g.phase === 5 && clean(g) && remaining.has(g.active!));
    const actor = game.active!, amount = actor === 'choam' ? 10 : 2;
    const before = structuredClone(game), sources = nativeShipmentSources(viewGame(game, actor), amount, 0); assert.ok(sources);
    game = arrival(applyAction(game, actor, { type: 'ship', territory: destination.id, sector: destination.sectors[0],
      amount, elite: 0, allyPayment: 0, homeworldSources: sources }));
    if (actor === 'choam') {
      assert.equal(player(game, actor).reserves, 10);
      assert.equal(player(before, actor).spice - player(game, actor).spice, 10);
      assert.equal(player(game, 'guild').spice - player(before, 'guild').spice, 10);
      assert.deepEqual(army(game, actor, 'homeworld:choam'), { normal: 10, elite: 0 });
    }
    remaining.delete(actor);
    if (remaining.size) game = applyAction(game, actor, { type: 'endMovement' });
  }
  game = openBattle(game, 'choam', 'guild', destination.id, '');
  const beforePlans = structuredClone(game);
  game = plans(game, [{ actor: 'choam', action: { type: 'battlePlan', leader: leader(game, 'choam', true), dial: 1, support: 1 } },
    { actor: 'guild', action: { type: 'battlePlan', leader: leader(game, 'guild'), dial: 0, support: 0 } }]);
  game = advance(game, g => !g.battle && clean(g) && !g.pendingTreacheryDiscard);
  assert.equal(game.lastBattleContext!.winner, 'choam');
  assert.equal(player(game, 'choam').tanks, player(beforePlans, 'choam').tanks + 1);
  assert.equal(player(game, 'choam').forces[`${destination.id}:${destination.sectors[0]}`], 9);
  assert.equal(player(game, 'choam').leaders.some(l => l.id === 'choam-auditor'), true);
  inventory(game);
});

void test('original Tleilaxu native death returns training once, real revival offers native discs only, and actual foreign ghola pays without moving the physical owner', () => {
  for (const nativeTrainer of [false, true]) {
    const f = setup({ advanced: true, expansions: ['ix'], roster: ['tleilaxu', 'guild', 'fremen'],
      skill: 'prana-bindu-adept', startingKinds: ['projectile', 'projectile', 'worthless'], tech: true });
    let game = movement(f.afterSetup, 'guild');
    game = invade(game, 'guild', 'homeworld:tleilaxu', 3);
    game = openBattle(game, 'tleilaxu', 'guild', 'homeworld:tleilaxu', nativeTrainer ? 'tleilaxu' : '');
    const trained = game.leaderSkills!.assignments.find(a => a.owner === 'tleilaxu')!;
    const own = nativeTrainer ? trained.leader : leader(game, 'tleilaxu', true), foreign = leader(game, 'guild');
    const ownWeapon = player(game, 'tleilaxu').hand.find(c => c.kind === 'projectile')!.id;
    const foreignWeapon = player(game, 'guild').hand.find(c => c.kind === 'projectile')!.id;
    game = plans(game, [{ actor: 'tleilaxu', action: { type: 'battlePlan', leader: own, dial: 1, support: 1, weapon: ownWeapon } },
      { actor: 'guild', action: { type: 'battlePlan', leader: foreign, dial: 0, support: 0, weapon: foreignWeapon } }]);
    game = advance(game, g => !g.battle && clean(g) && !g.pendingTreacheryDiscard);
    assert.equal(player(game, 'tleilaxu').leaders.find(l => l.id === own)!.dead, true);
    assert.equal(player(game, 'guild').leaders.find(l => l.id === foreign)!.dead, true);
    assert.equal(game.leaderSkills!.assignments.some(a => a.leader === trained.leader), !nativeTrainer);
    game = advance(game, g => g.turn === 2 && g.phase === 4 && clean(g));
    if (nativeTrainer) {
      const before = structuredClone(player(game, 'tleilaxu'));
      game = applyAction(game, 'tleilaxu', { type: 'reviveLeader', leader: own });
      game = advance(game, g => !!g.leaderSkills!.offers.tleilaxu && !g.response);
      assert.equal(player(game, 'tleilaxu').leaders.find(l => l.id === own)!.dead, false);
      assert.ok(player(game, 'tleilaxu').spice < before.spice);
      policies(game, 'tleilaxu', a => a.type === 'leaderSkill');
      assert.ok(viewGame(game, 'tleilaxu').leaderSkills!.eligibleLeaders.some(l => l.id === own));
    } else {
      const before = structuredClone(game);
      reject(game, 'guild', { type: 'reviveForeignGhola', leader: foreign });
      game = applyAction(game, 'tleilaxu', { type: 'reviveForeignGhola', leader: foreign });
      game = advance(game, g => !g.pendingRevival && !g.response && !g.decision);
      const ghola = player(game, 'guild').leaders.find(l => l.id === foreign)!;
      assert.equal(ghola.dead, false); assert.equal(ghola.gholaBy, 'tleilaxu');
      assert.equal(player(game, 'tleilaxu').leaders.some(l => l.id === foreign), false);
      assert.ok(player(game, 'tleilaxu').spice < player(before, 'tleilaxu').spice);
      assert.deepEqual(game.leaderSkills, before.leaderSkills);
      assert.ok(!viewGame(game, 'tleilaxu').leaderSkills!.eligibleLeaders.some(l => l.id === foreign));
      assert.deepEqual(game.homeworlds!.custody, before.homeworlds!.custody);
    }
    inventory(game);
  }
});

void test('actual native Homeworld forbids a visiting Tleilaxu Face Dance even with the genuinely drawn matching trainer identity', () => {
  const f = sukProgramme({ advanced: true, visitor: false, band: 'skilled', tech: true });
  assert.ok(player(f.afterSetup, 'tleilaxu').faceDancers!.some(c => c.leader === f.trainer && !c.revealed));
  let game = advance(plans(f.game, f.plans), g => g.decision?.kind === 'sukRescue');
  const d = game.decision; assert.ok(d?.kind === 'sukRescue');
  game = applyAction(game, f.owner, { type: 'decision', event: d.event, choice: 0 });
  game = advance(game, g => !g.battle && clean(g) && g.phase === 7);
  assert.notEqual(game.decision?.kind, 'faceDance');
  assert.equal(player(game, 'tleilaxu').faceDancers!.find(c => c.leader === f.trainer)!.revealed, false);
  const protectedArmy = army(game, f.owner, f.territory);
  reject(game, 'tleilaxu', { type: 'decision', reveal: true, sources: { reserves: 1 }, sector: 0 });
  assert.equal(player(game, f.owner).leaders.find(l => l.id === f.trainer)!.dead, false);
  assert.deepEqual(army(game, f.owner, f.territory), protectedArmy);
  inventory(game);
});

void test('genuine Shrine armies retain earned Stronghold ownership and complete original card cleanup and Tech reward before a matching Face Dance', () => {
  const f = discoveryProgramme({ advanced: true, face: 'shrine', tech: true, strongholds: true });
  let game = movement(enter(f), 'tleilaxu', 2);
  const sources = nativeShipmentSources(viewGame(game, 'tleilaxu'), 2, 0); assert.ok(sources);
  game = arrival(applyAction(game, 'tleilaxu', { type: 'ship', territory: 'shrine', sector: 0,
    amount: 2, elite: 0, allyPayment: 0, homeworldSources: sources }));
  game = openBattle(game, 'ixians', 'tleilaxu', 'shrine');
  const trainer = game.leaderSkills!.assignments.find(a => a.owner === 'ixians')!.leader;
  assert.ok(player(game, 'tleilaxu').faceDancers!.some(c => c.leader === trainer && !c.revealed));
  assert.equal(game.strongholdCards!.owners.hidden_mobile_stronghold, 'ixians');
  const weapon = player(game, 'ixians').hand.find(c => c.kind === 'worthless')!.id;
  game = plans(game, [{ actor: 'ixians', action: { type: 'battlePlan', leader: trainer, dial: 0, support: 0, weapon } },
    { actor: 'tleilaxu', action: { type: 'battlePlan', leader: leader(game, 'tleilaxu'), dial: 0, support: 0 } }]);
  game = advance(game, g => g.decision?.kind === 'battleCards');
  assert.equal(game.techTokens!.axlotl.owner, 'tleilaxu', 'The actual card cleanup still precedes the reward.');
  policies(game, 'ixians', a => a.type === 'decision' && a.discard !== undefined);
  game = applyAction(game, 'ixians', { type: 'decision', discard: [] });
  game = advance(game, g => g.decision?.kind === 'faceDance');
  assert.equal(game.techTokens!.axlotl.owner, 'ixians');
  const before = structuredClone(game), prior = structuredClone(player(game, 'ixians'));
  const action: Action = { type: 'decision', reveal: true, sources: { reserves: 1 }, sector: 0 };
  reject(game, 'ixians', action);
  reject(game, 'tleilaxu', { ...action, sources: { reserves: 3 } });
  policies(game, 'tleilaxu', a => a.type === 'decision' && a.reveal !== undefined);
  game = applyAction(game, 'tleilaxu', action);
  assert.equal(player(game, 'ixians').forces['shrine:0'] ?? 0, 0);
  assert.equal(player(game, 'ixians').reserves, prior.reserves + 2);
  assert.equal(player(game, 'ixians').elites!.reserves, prior.elites!.reserves + 1);
  assert.equal(player(game, 'tleilaxu').forces['shrine:0'], 1);
  assert.equal(player(game, 'tleilaxu').reserves, player(before, 'tleilaxu').reserves - 1);
  assert.equal(player(game, 'ixians').leaders.find(l => l.id === trainer)!.dead, true);
  assert.equal(game.leaderSkills!.assignments.some(a => a.leader === trainer), false);
  assert.equal(game.leaderSkills!.deck.filter(id => id === 'suk-graduate').length, 1);
  assert.deepEqual(game.techTokens, before.techTokens);
  assert.deepEqual(player(game, 'ixians').hand, prior.hand);
  assert.equal(player(game, 'ixians').spice, prior.spice);
  assert.equal(player(game, 'ixians').tanks, prior.tanks);
  assert.equal(player(game, 'tleilaxu').spice, player(before, 'tleilaxu').spice);
  assert.equal(player(game, 'tleilaxu').faceDancers!.find(c => c.leader === trainer)!.revealed, true);
  inventory(game);
});

void test('original trained Richese ordinary arrival retains one nested invoice and original marker custody', () => {
  const f = discoveryProgramme({ advanced: true, expansions: ['choam'], roster: ['richese', 'choam', 'guild', 'fremen'],
    collector: 'richese', face: 'cistern', skill: 'planetologist', tech: true, strongholds: true });
  let game = movement(enter(f), 'richese', 2);
  const before = structuredClone(game), sources = nativeShipmentSources(viewGame(game, 'richese'), 1, 0); assert.ok(sources);
  assert.equal(player(game, 'richese').forces['cistern:0'], 2);
  const action: Action = { type: 'ship', territory: 'cistern', sector: 0, amount: 1, elite: 0,
    allyPayment: 0, homeworldSources: sources };
  game = arrival(applyAction(game, 'richese', action));
  assert.equal(player(game, 'richese').forces['cistern:0'], 3);
  assert.equal(player(game, 'richese').reserves, player(before, 'richese').reserves - 1);
  assert.equal(player(game, 'richese').spice, player(before, 'richese').spice - 1);
  assert.equal(player(game, 'guild').spice, player(before, 'guild').spice + 1);
  assert.equal(player(game, 'richese').noField!.deployed, null);
  assert.deepEqual(player(game, 'richese').noField!.tokens, player(before, 'richese').noField!.tokens);
  reject(game, 'richese', action); inventory(game);
});

void test('actually earned Arrakeen support subsidy applies only at its held source, not a low native CHOAM Homeworld battle', () => {
  const balanceChanges: number[] = [];
  for (const nativeBattle of [false, true]) {
    const f = setup({ advanced: true, expansions: ['choam'], roster: ['choam', 'richese', 'guild', 'fremen'],
      skill: 'smuggler', tech: true, strongholds: true });
    let game = movement(f.afterSetup, 'choam');
    const sources = nativeShipmentSources(viewGame(game, 'choam'), 8, 0); assert.ok(sources);
    game = arrival(applyAction(game, 'choam', { type: 'ship', territory: 'arrakeen', sector: 10,
      amount: 8, elite: 0, smuggler: true, allyPayment: 0, homeworldSources: sources }));
    assert.equal(game.strongholdCards!.owners.arrakeen, null);
    game = advance(game, g => g.turn === 2 && g.phase === 5 && clean(g));
    assert.equal(game.strongholdCards!.owners.arrakeen, 'choam');
    assert.equal(game.strongholdCards!.claimedTurn, 1, 'Only original end-Mentat claims the physical card.');
    const destination = nativeBattle ? 'homeworld:choam' : 'arrakeen';
    const remaining = new Set(['choam', 'guild']);
    while (remaining.size) {
      game = advance(game, g => g.turn === 2 && g.phase === 5 && clean(g) && remaining.has(g.active!));
      const actor = game.active!;
      if (actor === 'choam') {
        const outward = nativeShipmentSources(viewGame(game, actor), 3, 0); assert.ok(outward);
        game = arrival(applyAction(game, actor, { type: 'ship', territory: 'carthag', sector: 11,
          amount: 3, elite: 0, smuggler: true, allyPayment: 0, homeworldSources: outward }));
        assert.equal(player(game, actor).reserves, 9);
      } else if (nativeBattle) game = invade(game, actor, destination, 2);
      else {
        const enemy = nativeShipmentSources(viewGame(game, actor), 2, 0); assert.ok(enemy);
        game = arrival(applyAction(game, actor, { type: 'ship', territory: destination, sector: 10,
          amount: 2, elite: 0, allyPayment: 0, homeworldSources: enemy }));
      }
      remaining.delete(actor);
      if (remaining.size) game = applyAction(game, actor, { type: 'endMovement' });
    }
    game = openBattle(game, 'choam', 'guild', destination, '');
    const before = structuredClone(game);
    game = plans(game, [{ actor: 'choam', action: { type: 'battlePlan', leader: leader(game, 'choam', true), dial: 1, support: 1 } },
      { actor: 'guild', action: { type: 'battlePlan', leader: leader(game, 'guild'), dial: 0, support: 0 } }]);
    game = advance(game, g => !g.battle && clean(g) && !g.pendingTreacheryDiscard);
    assert.equal(game.lastBattleContext!.winner, 'choam');
    balanceChanges.push(player(game, 'choam').spice - player(before, 'choam').spice);
    assert.equal(player(game, 'choam').tanks, player(before, 'choam').tanks + 1);
    assert.equal(game.strongholdCards!.owners.arrakeen, 'choam');
    assert.equal(player(game, 'choam').forces['arrakeen:10'], nativeBattle ? 8 : 7);
    inventory(game);
  }
  assert.equal(balanceChanges[0] - balanceChanges[1], 1, 'Only the held Arrakeen source subsidizes support; identical later stronghold income is independent.');
});
