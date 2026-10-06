import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { DIFFICULTIES } from '../game/bot-profiles';
import type { HomeworldCombatLossContext } from '../game/homeworld-combat-loss';
import { quoteSukPhysicalRescue } from '../game/suk-graduate';
import { strongholdBenefit } from '../game/stronghold-cards';
import { ownedTech } from '../game/tech-tokens';
import { classicHomeworldSkillsBotOffers } from './fixture-homeworld-classic-skills';
import { homeworldSkillsDiscoveryRescueChoice, homeworldSkillsDiscoverySplitReturn } from './fixture-homeworld-skills-discovery';
import {
  advanceClassicHomeworldNexusSkills as advance,
  assertClassicHomeworldNexusSkillsInventory as inventory,
  classicHomeworldNexusSkillsClean as clean,
  classicHomeworldNexusSkillsPlayer as player,
  classicHomeworldNexusSkillsPool as pool,
  classicHomeworldNexusSkillsRevivalWindow as revivalWindow,
  createClassicHomeworldNexusSkillsFixture as fixture,
  createClassicHomeworldNexusSkillsLobby as lobby,
  revealClassicHomeworldNexusSkillsBattle as reveal,
  settleClassicHomeworldNexusSkillsBattle as settle,
} from './fixture-homeworld-classic-nexus-skills';

/** Root physical PDF21–23 authorizes original variant composition. These are
 * actual original phase programmes, not a configuration matrix. External Suk
 * allocations use the existing placement interpretation; printed normal revival
 * is separately asserted to return Sardaukar to Salusa, never that Suk split. */
function legalPolicies(game: Game, actor: string): void {
  for (const difficulty of DIFFICULTIES) {
    const actions = classicHomeworldSkillsBotOffers(game, actor, difficulty);
    assert.ok(actions.length, `${difficulty} needs a real owned continuation.`);
    inventory(applyAction(structuredClone(game), actor, actions[0]));
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
/** Original loser played-card cleanup must already be committed before the
 * winner is asked to choose Tech. No synthetic winner receipt is introduced. */
function finishWinnerTech(state: Game): Game {
  if (state.decision?.kind !== 'techToken') { inventory(state); return state; }
  const decision = state.decision, before = structuredClone(state.techTokens);
  legalPolicies(state, decision.player);
  assert.equal(state.battle, null, 'Original battle disposal precedes the reward choice.');
  assert.equal(state.pendingSukRescue ?? null, null);
  assert.equal(state.pendingWinnerDiscards ?? null, null);
  for (const entry of state.lastBattleContext!.mandatoryDiscard?.entries ?? [])
    assert.ok(state.discard.some(card => card.id === entry.card), 'Original played-card cleanup precedes mandatory winner Tech.');
  const token = decision.choices[0], action: Action = { type: 'decision', token };
  reject(state, decision.loser, action);
  reject(state, decision.player, { type: 'decision', decline: true });
  const done = settle(applyAction(JSON.parse(JSON.stringify(state)), decision.player, action));
  assert.equal(done.techTokens![token].owner, decision.player);
  for (const [id, old] of Object.entries(before!)) if (id !== token)
    assert.deepEqual(done.techTokens![id as keyof NonNullable<typeof before>], old);
  inventory(done); return done;
}

void test('genuine worm/alliance closing draw precedes a paid native withdrawal, local support and one original Shipping-end industry payment', () => {
  const original = lobby({ advanced: true, discovery: true, tech: true, strongholds: true });
  const f = fixture({ initial: original, kind: 'visitor-suk' });
  assert.equal(player(f.beforeClosingDraw, f.owner).ally, null);
  legalPolicies(f.beforeClosingDraw, f.owner);
  reject(f.beforeClosingDraw, f.beforeClosingDraw.players.find(p => p.ally)!.id, f.closingDraw.action);
  reject(f.beforeClosingDraw, f.owner, { ...f.closingDraw.action, turn: f.beforeClosingDraw.turn - 1 });
  assert.equal(f.beforeClosingDraw.nexusCards!.cards!.hands[f.owner], null);
  assert.equal(f.afterClosingDraw.nexusCards!.cards!.hands[f.owner], 'fremen');
  assert.ok(!f.afterClosingDraw.nexusCards!.cards!.deck.includes('fremen'));
  assert.equal(f.afterClosingDraw.nexusCards!.cards!.discard.filter(card => card === 'fremen').length, 0);
  legalPolicies(f.beforeShipment, f.owner);
  const before = player(f.beforeShipment, f.owner), after = player(f.afterShipment, f.owner);
  assert.equal(after.reserves, before.reserves - 4);
  assert.equal(after.elites!.reserves, before.elites!.reserves - 1);
  assert.equal(after.spice, before.spice - 4, 'One original Homeworld invasion invoice, not Arrakis or doubled payment.');
  assert.deepEqual(pool(f.afterShipment, f.owner, f.territory), { normal: 3, elite: 1 });
  assert.deepEqual(pool(f.beforeShipment, f.owner, 'homeworld:emperor'), {
    normal: pool(f.afterShipment, f.owner, 'homeworld:emperor').normal + 3, elite: 0,
  });
  assert.equal(pool(f.afterShipment, f.owner, 'homeworld:emperor:salusa').elite,
    pool(f.beforeShipment, f.owner, 'homeworld:emperor:salusa').elite - 1);
  const token = f.beforeShippingEnd.techTokens!.heighliners;
  assert.equal(token.spice, 1); assert.equal(token.triggeredTurn, 2);
  legalPolicies(f.beforeShippingEnd, f.shippingEnd.actor);
  assert.equal(player(f.afterShippingEnd, token.owner!).spice, player(f.beforeShippingEnd, token.owner!).spice + token.spice);
  assert.equal(f.afterShippingEnd.techTokens!.heighliners.spice, 0);
  assert.equal(f.afterShippingEnd.techTokens!.axlotl.spice, 0);
  assert.equal(f.afterShippingEnd.techTokens!.production.spice, 0);
  assert.equal(f.game.strongholdCards!.owners.tueks_sietch, f.opponent, 'Original Guild board occupation earned the retained public card at first Mentat.');
  assert.equal(strongholdBenefit(f.game.strongholdCards, f.opponent, f.territory), null, 'Held Tuek support is source-local, not a benefit on Guild Homeworld.');
  for (const actor of [f.owner, f.opponent]) legalPolicies(f.game, actor);
  const changed = { ...f, plans: f.plans.map(step => step.actor === f.opponent
    ? { actor: step.actor, action: { ...step.action, dial: 2, support: 1 } } : step) };
  const revealed = reveal(changed), pending = settle(revealed, 'suk');
  assert.equal(player(pending, f.owner).spice, player(f.game, f.owner).spice - 2,
    'The invading army pays its actual support before Suk rescue.');
  assert.equal(player(pending, f.opponent).spice, player(f.game, f.opponent).spice - 1,
    'The free native battle-strength bonus does not waive ordinary support or borrow the held Tuek subsidy.');
  inventory(pending);
});

for (const kind of ['native-suk', 'visitor-suk'] as const) {
  void test(`Advanced original ${kind} saves its actual typed source under HW/Nexus/DS/Tech/Stronghold composition`, () => {
    const f = fixture({ advanced: true, discovery: true, tech: true, strongholds: true, kind });
    const revealed = reveal(f), pending = settle(revealed, 'suk');
    assert.deepEqual(pending.techTokens, revealed.techTokens, 'Real winner Tech ownership cannot move ahead of the owned Suk cleanup.');
    reject(f.game, f.owner, { type: 'battlePlan', leader: f.trainer,
      dial: kind === 'native-suk' ? 12 : 8, support: 0 });
    assert.ok(pending.decision?.kind === 'sukRescue');
    const decision = pending.decision, receipt = pending.pendingSukRescue!;
    const choice = homeworldSkillsDiscoveryRescueChoice(pending, kind === 'native-suk' ? 'elite' : 'normal');
    const option = decision.options[choice], destinations = homeworldSkillsDiscoverySplitReturn(pending, choice);
    assert.equal(receipt.territory, f.territory); assert.equal(receipt.skill.mode, 'skilled');
    assert.equal(receipt.pool.length, 1); assert.equal(receipt.pool[0].key, f.territory);
    assert.equal(option.normal + option.elite, 3);
    const physical = quoteSukPhysicalRescue(physicalContext(pending), pending.homeworlds!.custody!, {
      player: f.owner, territory: f.territory, skill: receipt.skill, pool: receipt.pool,
      losses: receipt.losses!, option, destinations,
    });
    assert.equal(physical.receipt.source, kind === 'native-suk' ? 'native-homeworld' : 'visitor-homeworld');
    legalPolicies(pending, f.owner);
    const action: Action = { type: 'decision', event: decision.event, choice, ...(destinations ? { destinations } : {}) };
    reject(pending, f.opponent, action);
    reject(pending, f.owner, { ...action, event: 'stale-physical-rescue' });
    reject(pending, f.owner, { ...action, destinations: { 'homeworld:guild': { normal: 1, elite: 1 } } });
    if (kind === 'native-suk') {
      assert.equal(decision.reserveHomes, undefined);
      assert.equal(receipt.losses!.normal, 0); assert.equal(receipt.losses!.elite, 3);
      reject(pending, f.owner, { ...action, destinations: { 'homeworld:emperor': { normal: 0, elite: 3 } } });
    } else {
      assert.equal(receipt.losses!.normal, 2); assert.equal(receipt.losses!.elite, 1);
      assert.deepEqual(destinations, { 'homeworld:emperor': { normal: 0, elite: 1 }, 'homeworld:emperor:salusa': { normal: 1, elite: 0 } });
      reject(pending, f.owner, { type: 'decision', event: decision.event, choice });
      reject(pending, f.owner, { ...action, destinations: { 'homeworld:emperor': { normal: 0, elite: 1 } } });
    }
    const resolved = settle(applyAction(JSON.parse(JSON.stringify(pending)), f.owner, action));
    assert.deepEqual(resolved.homeworlds!.custody, physical.custody);
    assert.equal(player(resolved, f.owner).reserves, physical.players.find(p => p.id === f.owner)!.reserves);
    assert.equal(player(resolved, f.owner).elites!.reserves, physical.players.find(p => p.id === f.owner)!.eliteReserves);
    assert.equal(player(resolved, f.owner).tanks - player(pending, f.owner).tanks,
      receipt.losses!.normal + receipt.losses!.elite - option.normal - option.elite);
    assert.equal(resolved.pendingSukRescue ?? null, null);
    assert.equal(player(resolved, f.owner).leaders.find(l => l.id === f.trainer)!.dead, false);
    assert.ok(resolved.leaderSkills!.assignments.some(a => a.owner === f.owner && a.leader === f.trainer && a.skill === 'suk-graduate'));
    if (kind === 'native-suk') assert.deepEqual(resolved.homeworlds!.custody!.salusa, pending.homeworlds!.custody!.salusa,
      'Saved native Sardaukar remain at the exact native Salusa source, with no internal move.');
    else assert.deepEqual(pool(resolved, f.owner, f.territory), { normal: 2, elite: 0 });
    const done = finishWinnerTech(resolved);
    for (const token of ownedTech(revealed.techTokens, f.opponent))
      assert.equal(done.techTokens![token].owner, f.owner, 'Original losing-owner Tech transfers only after real rescue and card cleanup.');
    assert.equal(done.lastBattleContext!.winner, f.owner); inventory(done);
  });
}

for (const advanced of [false, true]) {
  void test(`${advanced ? 'Advanced typed' : 'Basic ordinary'} real zero-save Suk losses fund exact-three Fremen Nexus return at the next actual Revival`, () => {
    const f = fixture({ advanced, discovery: advanced, tech: true, strongholds: advanced });
    const pending = settle(reveal(f), 'suk'); assert.ok(pending.decision?.kind === 'sukRescue');
    const choice = pending.decision.options.findIndex(option => !option.normal && !option.elite && !option.kept);
    assert.ok(choice >= 0, 'The skilled original human option may genuinely decline all rescue.');
    legalPolicies(pending, f.owner);
    const done = finishWinnerTech(settle(applyAction(pending, f.owner, { type: 'decision', event: pending.decision.event, choice })));
    assert.equal(player(done, f.owner).tanks, advanced ? 3 : 4);
    assert.equal(player(done, f.owner).elites?.tanks ?? 0, advanced ? 1 : 0);
    assert.equal(done.nexusCards!.cards!.hands[f.owner], 'fremen', 'Battle rescue never spends the unrelated physically held Nexus singleton.');
    const window = revivalWindow(done, f.actions, f.staging), offer = viewGame(window, f.owner).nexusFremenRevival!;
    assert.equal(offer.blocked, null); assert.ok(offer.eliteOptions.includes(advanced ? 1 : 0));
    legalPolicies(window, f.owner);
    const action: Action = { type: 'nexusFremenRevive', event: offer.event, elite: advanced ? 1 : 0 };
    reject(window, f.opponent, action);
    reject(window, f.owner, { ...action, event: 'stale-free-three' });
    reject(window, f.owner, { ...action, elite: 2 });
    const before = structuredClone(player(window, f.owner));
    const kaitain = pool(window, f.owner, 'homeworld:emperor');
    const salusa = advanced ? pool(window, f.owner, 'homeworld:emperor:salusa') : null;
    const paid = applyAction(JSON.parse(JSON.stringify(window)), f.owner, action), after = player(paid, f.owner);
    assert.equal(after.spice, before.spice, 'Free-three is not charged as paid revival or external Suk placement.');
    assert.equal(after.tanks, before.tanks - 3); assert.equal(after.reserves, before.reserves + 3);
    assert.equal(after.revived, 3); assert.equal(after.freeForcesRevived, 3);
    assert.deepEqual(pool(paid, f.owner, 'homeworld:emperor'), { normal: kaitain.normal + (advanced ? 2 : 3), elite: kaitain.elite });
    if (advanced) {
      assert.deepEqual(pool(paid, f.owner, 'homeworld:emperor:salusa'), { normal: salusa!.normal, elite: salusa!.elite + 1 });
      assert.equal(after.elites!.tanks, before.elites!.tanks - 1);
      assert.equal(after.elites!.reserves, before.elites!.reserves + 1);
      assert.equal(after.elites!.revived, 1);
    }
    assert.equal(paid.nexusCards!.cards!.hands[f.owner], null);
    assert.equal(paid.nexusCards!.cards!.discard.filter(card => card === 'fremen').length, 1);
    reject(paid, f.owner, action);
    reject(paid, f.owner, { type: 'revive', amount: 1, elite: 0 });
    const token = paid.techTokens!.axlotl, holder = token.owner!;
    assert.equal(token.spice, ownedTech(paid.techTokens, holder).length);
    const end = advance(paid, g => g.phase === 4 && clean(g) && g.ready.length === g.players.length - 1);
    const actor = end.players.find(p => !end.ready.includes(p.id))!.id;
    legalPolicies(end, actor);
    const ended = applyAction(end, actor, { type: 'ready' });
    assert.equal(player(ended, holder).spice, player(end, holder).spice + token.spice);
    assert.equal(ended.techTokens!.axlotl.spice, 0); inventory(ended);
  });
}

void test('real lethal visitor battle returns the trained public Skill once before any original winner Tech reward', () => {
  const f = fixture({ advanced: true, discovery: true, tech: true, strongholds: true, kind: 'visitor-death' });
  const weapon = f.plans.find(step => step.actor === f.opponent)!.action.weapon as string;
  const resolved = settle(reveal(f));
  assert.equal(player(resolved, f.owner).leaders.find(l => l.id === f.trainer)!.dead, true);
  assert.ok(!resolved.leaderSkills!.assignments.some(a => a.leader === f.trainer));
  assert.equal(resolved.leaderSkills!.deck.filter(skill => skill === 'mentat').length, 1);
  assert.equal(player(resolved, f.owner).tanks, 4);
  assert.deepEqual(pool(resolved, f.owner, f.territory), { normal: 0, elite: 0 });
  const done = finishWinnerTech(resolved);
  for (const token of ownedTech(f.game.techTokens, f.owner))
    assert.equal(done.techTokens![token].owner, f.opponent, 'Killed trained disc and losing army settle before the original winner reward.');
  assert.equal(done.lastBattleContext!.winner, f.opponent);
  assert.ok(player(done, f.opponent).hand.some(card => card.id === weapon), 'Original winner may keep the genuinely played projectile through ordinary cleanup.');
  const later = advance(done, g => g.turn > done.turn);
  assert.equal(later.leaderSkills!.deck.filter(skill => skill === 'mentat').length, 1);
  inventory(later);
});
