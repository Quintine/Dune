import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, joinGame, newPlayer, RuleError, viewGame } from '../game/engine';
import type { Action, Game } from '../game/engine';
import { DIFFICULTIES } from '../game/bot-profiles';
import { DUKE_VIDAL_ID } from '../game/duke-vidal';
import { combatArmy } from '../game/combat-location';
import { nativeShipmentSources } from '../game/homeworld-options';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { nexusEcazDukeAction } from '../game/nexus-ecaz-duke-options';
import { discoveryEntryMoveAction } from '../game/discovery-entry-options';
import { ownedTech } from '../game/tech-tokens';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import {
  advanceMixedE3EcazNexus as advance, createMixedE3EcazNexusCoalition as coalition,
  createMixedE3EcazNexusProgramme as programme, createMixedE3EcazNexusSetup as setup,
  mixedE3EcazNexusClean as clean, mixedE3EcazNexusInventory as inventory,
  mixedE3EcazNexusPlayer as player, mixedE3EcazNexusPolicy as policy,
  mixedE3EcazNexusReload as reload, nextMixedE3EcazNexusStep as next,
  quietMixedE3EcazNexusChoice as quiet, quoteMixedE3EcazNexusBattle as quote,
  revealMixedE3EcazNexus as reveal, shipMixedE3EcazNexus as ship,
  stepMixedE3EcazNexus as step,
} from './fixture-mixed-e3-ecaz-nexus';
import type { MixedE3EcazNexusBattle, MixedE3EcazNexusStep } from './fixture-mixed-e3-ecaz-nexus';

function reject(g: Game, actor: string, action: Action): void {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, actor, action), RuleError);
  assert.deepEqual(g, before, 'Rejected physical contributions cannot debit purses, move forces or consume discs');
}
function policies(g: Game, actor: string, effect: (after: Game, action: Action) => void): void {
  for (const difficulty of DIFFICULTIES) {
    const action = policy(g, actor, difficulty)[0]; assert.ok(action, `${difficulty} requires this genuine owned window`);
    const after = step(g, { actor, action }); effect(after, action); inventory(after);
  }
}
/** Test-owned choices, not scheduler defaults. Every casualty/reward boundary
 * is retained for a human using the reusable next-step controller. */
function settlementChoice(g: Game): MixedE3EcazNexusStep | null {
  if (g.response || g.phaseOpening) return null;
  const d = g.decision; if (!d) return null;
  if (d.kind === 'battleLosses') return { actor: d.player, action: { type: 'decision', choice: 0 } };
  if (d.kind === 'battleCards') return { actor: d.player, action: { type: 'decision', discard: [] } };
  if (d.kind === 'techToken') return { actor: d.player, action: { type: 'decision', token: d.choices[0] } };
  if (d.kind === 'faceDance') return { actor: d.player, action: { type: 'decision', reveal: false } };
  if (d.kind === 'leaderSkillVisibility') return { actor: d.player,
    action: { type: 'leaderSkillVisibility', event: d.event, hide: true } };
  if (d.kind === 'ixSubstitution') return { actor: d.player, action: { type: 'decision', decline: true } };
  if (d.kind === 'strongholdCopy') return { actor: d.player,
    action: { type: 'decision', event: d.event, stronghold: d.choices[0] } };
  if (d.kind === 'sukRescue') {
    const maximum = Math.max(...d.options.map(o => o.normal + o.elite));
    const choice = d.options.findIndex(o => o.normal + o.elite === maximum);
    return { actor: d.player, action: { type: 'decision', event: d.event, choice } };
  }
  if (d.kind === 'moritaniRetention') return { actor: d.player, action: { type: 'decision', keep: null,
    ...(d.source === 'nexus' ? { event: d.event } : {}) } };
  return quiet(g);
}
function settle(g: Game, until: (g: Game) => boolean = s => !s.battle && clean(s), exercise = false): Game {
  for (let n = 0; n < 700; n++) {
    if (!g.response && !g.phaseOpening && until(g)) return g;
    const d = !g.response && !g.phaseOpening ? g.decision : null;
    if (exercise && d?.kind === 'battleLosses') policies(g, d.player, (after, action) => {
      const option = d.options[Number(action.choice)], owner = d.forceOwner ?? d.player; assert.ok(option);
      assert.equal(player(after, owner).tanks, player(g, owner).tanks + option.normal + option.elite);
    });
    if (exercise && d?.kind === 'battleCards') policies(g, d.player, (after, action) => {
      for (const id of action.discard as string[]) {
        assert.ok(!player(after, d.player).hand.some(c => c.id === id));
        assert.equal(after.discard.filter(c => c.id === id).length, 1);
      }
    });
    if (exercise && d?.kind === 'techToken') policies(g, d.player, (after, action) => {
      const token = action.token as keyof NonNullable<Game['techTokens']>; assert.ok(d.choices.includes(token));
      assert.equal(after.techTokens![token].owner, d.player);
      assert.equal(player(after, d.player).spice, player(g, d.player).spice);
    });
    const control = next(g) ?? settlementChoice(g); assert.ok(control, `Test owner must choose ${g.decision?.kind}`);
    g = step(g, control);
  }
  throw Error('Original mixed Ecaz aftermath did not reach its physical boundary');
}
function chooseLead(f: MixedE3EcazNexusBattle, lead: string): Game {
  const d = f.game.decision; assert.ok(d?.kind === 'ecazBattleLead');
  const chosen = step(f.game, { actor: f.owner, action: { type: 'decision', event: d.event, lead } });
  return advance(chosen, s => !!s.battle && clean(s) && !s.battle.preparation && s.battle.preLeader?.closed !== false,
    undefined, s => s.decision?.kind === 'leaderSkillVisibility'
      ? { actor: s.decision.player, action: { type: 'leaderSkillVisibility', event: s.decision.event, hide: s.decision.player === f.owner } }
      : quiet(s));
}
/** Highest- or lowest-strength legal commitment for one combatant, chosen by
 * trying the engine's own plan validator. Any pending posture declaration for
 * this seat is answered first, because a skilled disc must be hidden before use. */
function legalPlan(g: Game, actor: string, leader: string, prefer: 'max' | 'min',
  extra: { weapon?: string; defense?: string } = {}): { steps: MixedE3EcazNexusStep[]; action: Action } {
  const steps: MixedE3EcazNexusStep[] = [];
  let base = g;
  for (let n = 0; n < 6; n++) {
    const decision = base.decision;
    if (decision?.kind !== 'leaderSkillVisibility') break;
    const posture: MixedE3EcazNexusStep = { actor: decision.player,
      action: { type: 'leaderSkillVisibility', event: decision.event, hide: decision.player === actor } };
    steps.push(posture); base = step(base, posture);
  }
  const spice = player(base, actor).spice;
  const supports = prefer === 'max' ? Array.from({ length: spice + 1 }, (_, i) => spice - i) : [0];
  const dials = prefer === 'max' ? Array.from({ length: 13 }, (_, i) => 12 - i) : [0];
  const reasons = new Set<string>();
  for (const support of supports) for (const dial of dials) {
    for (const card of [extra, {}]) {
      const action: Action = { type: 'battlePlan', leader, dial, support, ...card };
      try { applyAction(reload(base), actor, action); return { steps: [...steps, { actor, action }], action }; }
      catch (error) { reasons.add(error instanceof Error ? error.message : String(error)); }
    }
  }
  throw Error(`No legal battle plan for ${actor} (spice ${spice}): ${[...reasons].join(' | ')}`);
}
/** The seat's own trained disc first (its skill needs the hidden posture), then
 * the strongest available discs; the first combination the engine accepts wins. */
function legalLeadPlan(g: Game, actor: string, prefer: 'max' | 'min',
  extra: { weapon?: string; defense?: string } = {}): { steps: MixedE3EcazNexusStep[]; action: Action } {
  const trained = new Set((g.leaderSkills?.assignments ?? []).filter(a => a.owner === actor).map(a => a.leader));
  const candidates = player(g, actor).leaders.filter(l => !l.dead && !l.usedAt)
    .sort((a, b) => (Number(trained.has(b.id)) - Number(trained.has(a.id))) || b.strength - a.strength);
  const reasons = new Set<string>();
  for (const leader of candidates) {
    try { return legalPlan(g, actor, leader.id, prefer, extra); }
    catch (error) { reasons.add(error instanceof Error ? error.message : String(error)); }
  }
  throw Error(`No legal battle plan for ${actor}: ${[...reasons].join(' | ')}`);
}
function coalitionPlans(f: MixedE3EcazNexusBattle, g: Game, lead: string): MixedE3EcazNexusStep[] {
  const worthless = player(g, lead).hand.find(c => c.kind === 'worthless');
  const first = legalLeadPlan(g, lead, 'max', worthless ? { defense: worthless.id } : {});
  let after = g; for (const plan of first.steps) after = step(after, plan);
  const second = legalLeadPlan(after, f.opponent, 'min');
  return [...first.steps, ...second.steps];
}
/** The chosen battle plan of one seat inside a scheduled step list. */
function plannedStep(plans: readonly MixedE3EcazNexusStep[], actor: string): Action {
  const step = plans.find(candidate => candidate.actor === actor && candidate.action.type === 'battlePlan');
  assert.ok(step, `${actor} must have a scheduled battle plan`);
  return step.action;
}

void test('minimal original two-seat E3/E1 training and three-seat E3/E2 no-training closing preserve native discs, cache and paid counters', () => {
  const lobby = createGame('MIXEDORIGINAL2', newPlayer('human-ecaz', 'Human Ecaz', 'ecaz'), false, ['ecaz', 'ix']);
  joinGame(lobby, newPlayer('human-tl', 'Human Tleilaxu', 'tleilaxu'));
  const two = setup({ initial: lobby, skills: true, homeworlds: true });
  assert.equal(player(two.afterSetup, two.owner).leaders.length, 5);
  assert.equal(two.afterSetup.leaderSkills!.assignments.length, 2);
  assert.ok(two.afterSetup.leaderSkills!.assignments.every(a => a.leader !== DUKE_VIDAL_ID));
  assert.equal(two.afterSetup.dukeVidal!.controller, null);
  const held = player(two.afterSetup, two.owner).hand.map(c => c.id);
  assert.equal(held.length, 1); inventory(two.afterSetup);
  const supplied = setup({ initial: two.offered, skills: true, homeworlds: true });
  assert.deepEqual(player(supplied.afterSetup, supplied.owner).hand.map(c => c.id), held);
  assert.equal(player(supplied.afterSetup, supplied.owner).reserves, 14);
  assert.equal(Object.values(player(supplied.afterSetup, supplied.owner).forces).reduce((n, f) => n + f, 0), 6);
  const three = programme({ families: ['choam'], roster: ['ecaz', 'richese', 'guild'], advanced: false, skills: false, tech: true });
  assert.equal(three.game.leaderSkills, undefined);
  assert.equal(three.game.richeseCache!.length + three.game.richeseRemoved!.length +
    [...three.game.deck, ...three.game.discard, ...three.game.players.flatMap(p => p.hand)].filter(c => c.id.startsWith('richese-')).length, 10);
  assert.equal(three.game.nexusCards!.cards!.hands[three.owner], 'ecaz');
  assert.equal(player(three.alliance!, three.seats.richese!).ally, three.seats.guild);
  assert.ok(player(three.claim!.after, three.owner).spice < player(three.claim!.before, three.owner).spice);
  inventory(three.game);
});

void test('all-three-family six-native original setup and real alliance closing retain all14, native20, separate Duke and original rewards', () => {
  const f = programme({ families: ['ix', 'choam'], roster: ['ecaz', 'moritani', 'ixians', 'tleilaxu', 'choam', 'richese'],
    advanced: true, skills: true, homeworlds: true, tech: true, strongholds: true });
  assert.equal(f.afterSetup.leaderSkills!.assignments.length, 6);
  assert.equal(f.afterSetup.dukeVidal!.leader.id, DUKE_VIDAL_ID);
  assert.equal(player(f.afterSetup, f.owner).leaders.length, 5);
  assert.ok(f.afterSetup.ecazOccupyPreview && f.afterSetup.moritaniAssassinatePreview);
  assert.equal(player(f.afterSetup, f.seats.tleilaxu!).faceDancers!.length, 3);
  assert.equal(f.afterSetup.richeseCache!.length, 10);
  assert.ok(f.ixOffer); assert.ok(player(f.ixOffer.after, f.seats.ixians!).hand.some(c => c.id === f.ixOffer!.step.action.card));
  assert.equal(f.game.nexusCards!.cards!.hands[f.owner], 'ecaz');
  assert.equal(player(f.alliance!, f.seats.choam!).ally, f.seats.richese);
  assert.equal(f.firstMentat!.after.strongholdCards!.owners.sietch_tabr, f.owner);
  assert.equal(player(f.claim!.after, f.owner).reserves, player(f.claim!.before, f.owner).reserves - 1);
  inventory(f.game);
});

for (const advanced of [false, true]) void test(`${advanced ? 'Advanced selected Warmaster/HW/Tech/held Tabr' : 'Basic even-FORCE/no-Skills'} native mixed Ecaz coalition keeps its chosen lead, labelled support and physical payer/casualty ownership`, () => {
  const f = coalition({ advanced, skills: advanced, homeworlds: advanced, tech: true, strongholds: advanced });
  const d = f.game.decision; assert.ok(d?.kind === 'ecazBattleLead'); assert.equal(next(f.game), null);
  reject(f.game, f.ally, { type: 'decision', event: d.event, lead: f.owner });
  reject(f.game, f.owner, { type: 'decision', event: d.event, lead: f.opponent });
  for (const t of f.arrivals) {
    const count = Number(t.step.action.amount), actor = t.step.actor;
    assert.equal(player(t.after, actor).reserves, player(t.before, actor).reserves - count);
    assert.equal(player(t.after, actor).forces[f.location], (player(t.before, actor).forces[f.location] ?? 0) + count);
    assert.ok(player(t.after, actor).spice < player(t.before, actor).spice);
  }
  policies(f.game, f.owner, (after, action) => {
    assert.ok([f.owner, f.ally].includes(String(action.lead)));
    assert.equal(player(after, f.owner).spice, player(f.game, f.owner).spice);
    assert.equal(player(after, f.ally).spice, player(f.game, f.ally).spice);
  });
  for (const lead of [f.owner, f.ally]) {
    const plansWindow = chooseLead(f, lead), plans = coalitionPlans(f, plansWindow, lead);
    if (advanced) {
      const used = plannedStep(plans, lead).leader;
      const trainedDisc = !!plansWindow.leaderSkills?.assignments.some(a => a.owner === lead && a.leader === used);
      assert.equal(plansWindow.battle!.leaderSkillHidden?.[lead] ?? false, trainedDisc,
        'A skilled disc is hidden exactly when the plan uses it');
    }
    policies(plansWindow, lead, (offered) => {
      assert.equal(player(offered, lead).spice, player(plansWindow, lead).spice, 'A sealed dial does not prepay support');
      const revealed = reveal(offered, plans.filter(plan => plan.actor === f.opponent)), q = quote(revealed), finished = settle(revealed);
      assert.equal(finished.lastBattleContext!.winner, q.winner);
      for (const payment of q.payments) {
        const heldIncome = q.strongholdIncome.filter(r => r.player === payment.player).reduce((n, r) => n + r.amount, 0);
        const collection = finished.phase === 7 ? quoteSpiceCollection(finished).receipts.find(r => r.player === payment.player)?.strongholds ?? 0 : 0;
        const income = (q.bounty?.player === payment.player ? q.bounty.amount : 0) +
          (q.choamIncome?.owner === payment.player ? q.choamIncome.amount : 0);
        assert.equal(player(finished, payment.player).spice, player(revealed, payment.player).spice - payment.ownPayment + heldIncome + collection + income);
      }
      inventory(finished);
    });
    const revealed = reveal(plansWindow, plans), q = quote(revealed), side = revealed.battle!.attacker === lead ? 'attacker' : 'defender';
    assert.equal(q.winner, lead);
    assert.deepEqual((q.fixedLosses ?? []).map(loss => loss.owner), [f.owner],
      'Only Ecaz’s printed fixed dial produces the coalition’s fixed losses.');
    assert.equal(q.casualties!.owner, f.ally);
    assert.equal(q.payments.find(p => p.player === lead)?.ownPayment ?? 0,
      advanced ? Number(plannedStep(plans, lead).support) : 0,
      'The chosen variable support is funded by its own payer; Basic has no support');
    assert.equal(q.leaderSkillBonuses[side].applied.some(a => a.skill === 'warmaster'), advanced && lead === f.owner);
    assert.ok(q.strongholdIncome.every(income => income.player === f.owner),
      'Only the Ecaz holder can receive the held Tabr income; an ally lead never borrows it');
    const done = settle(revealed, undefined, true), lostToken = ownedTech(revealed.techTokens, f.opponent)[0]; assert.ok(lostToken);
    assert.equal(done.techTokens![lostToken].owner, lead);
    const ecazFixed = (q.fixedLosses ?? []).reduce((n, loss) => n + loss.normal + loss.elite, 0);
    assert.equal(player(done, f.owner).tanks - player(plansWindow, f.owner).tanks, ecazFixed);
    assert.equal(player(done, f.ally).tanks - player(plansWindow, f.ally).tanks, 4);
    assert.equal(player(done, f.opponent).tanks - player(plansWindow, f.opponent).tanks, 8);
    inventory(done);
  }
});

void test('Basic odd mixed Occupy admits the paid three-force contribution with provisional ceiling losses and floor survivors', () => {
  const f = coalition({ advanced: false, skills: false, tech: true }, 'ixians', 3);
  assert.equal(player(f.beforeBattle, f.owner).forces[f.location], 3);
  for (const arrival of f.arrivals) {
    const count = Number(arrival.step.action.amount), actor = arrival.step.actor;
    assert.equal(player(arrival.after, actor).reserves, player(arrival.before, actor).reserves - count);
    assert.equal(player(arrival.after, actor).forces[f.location], (player(arrival.before, actor).forces[f.location] ?? 0) + count);
    assert.ok(player(arrival.after, actor).spice < player(arrival.before, actor).spice);
  }
  const admitted = step(f.beforeBattle, f.choice);
  assert.ok(admitted.battle);
  assert.equal(admitted.decision?.kind, 'ecazBattleLead');
  inventory(admitted);
  for (const lead of [f.owner, f.ally]) {
    const ready = chooseLead({ ...f, game: admitted }, lead);
    const profile = viewGame(ready, lead).battle!.ecazOccupy!.profile!;
    assert.equal(profile.ecazForces.normal, 3);
    assert.equal(profile.fixedEcazDial, Math.ceil(3 / 2));
    assert.equal(profile.planOwner, lead);
    assert.equal(profile.payer, lead);
    assert.equal(profile.forceOwner, f.ally);
    const revealed = reveal(ready, coalitionPlans(f, ready, lead)), q = quote(revealed), done = settle(revealed);
    assert.equal(q.winner, lead);
    assert.equal(done.lastBattleContext!.winner, lead);
    assert.deepEqual(q.fixedLosses, [{ owner: f.owner, normal: Math.ceil(3 / 2), elite: 0 }]);
    assert.equal(q.casualties!.owner, f.ally);
    assert.deepEqual(q.casualties!.options, [{ normal: 4, elite: 0, paidNormal: 0, paidElite: 0 }]);
    assert.ok(q.payments.every(payment => payment.ownPayment === 0));
    assert.deepEqual(q.strongholdIncome, []);
    for (const payment of q.payments) {
      const collection = done.phase === 7 ? quoteSpiceCollection(done).receipts.find(r => r.player === payment.player)?.strongholds ?? 0 : 0;
      assert.equal(player(done, payment.player).spice, player(revealed, payment.player).spice + collection);
    }
    assert.equal(player(done, f.owner).tanks - player(ready, f.owner).tanks, Math.ceil(3 / 2));
    assert.equal(player(done, f.owner).forces[f.location], Math.floor(3 / 2));
    assert.equal(player(done, f.ally).tanks - player(ready, f.ally).tanks, 4);
    assert.equal(player(done, f.ally).forces[f.location] ?? 0, 0);
    assert.equal(player(done, f.opponent).tanks - player(ready, f.opponent).tanks, 8);
    const token = ownedTech(ready.techTokens, f.opponent)[0]; assert.ok(token);
    assert.equal(done.techTokens![token].owner, lead);
    for (const owner of [f.owner, f.ally])
      for (const retained of ownedTech(ready.techTokens, owner))
        assert.equal(done.techTokens![retained].owner, owner, 'Only the loser’s Tech transfers.');
    inventory(done);
  }
});

void test('E3/E2 classic-led coalition never borrows the hidden native Warmaster or Ecaz-held battle income', () => {
  const f = coalition({ families: ['choam'], roster: ['ecaz', 'choam', 'guild', 'emperor'],
    advanced: true, skills: true, homeworlds: true, tech: true, strongholds: true }, 'emperor');
  const plansWindow = chooseLead(f, f.ally), revealed = reveal(plansWindow, coalitionPlans(f, plansWindow, f.ally));
  const q = quote(revealed), side = revealed.battle!.attacker === f.ally ? 'attacker' : 'defender';
  assert.equal(q.winner, f.ally);
  assert.ok(!q.leaderSkillBonuses[side].applied.some(a => a.skill === 'warmaster'));
  assert.deepEqual(q.strongholdIncome, []);
  const done = settle(revealed);
  assert.equal(player(done, f.owner).spice, player(plansWindow, f.owner).spice);
  assert.equal(done.techTokens![ownedTech(revealed.techTokens, f.opponent)[0]].owner, f.ally);
  inventory(done);
});

for (const skills of [false, true]) void test(`${skills ? 'all14' : 'no-Skills'} original all-three-family paid foreign arrival → quiet living Duke Cunning → source-local end-turn expiry`, () => {
  const f = programme({ families: ['ix', 'choam'], roster: ['ecaz', 'ixians', 'choam', 'guild', 'emperor'],
    skills, advanced: true, homeworlds: true, tech: true, strongholds: true });
  let g = advance(f.game, s => s.phase === 5 && s.active === f.owner && clean(s), undefined, quiet);
  const t = ship(g, f.owner, 'homeworld:emperor', 1);
  const sources = nativeShipmentSources(viewGame(t.before, f.owner), 1, 0); assert.ok(sources);
  const invoice = homeworldShipmentChoice(viewGame(t.before, f.owner), 'homeworld:emperor',
    Object.fromEntries(Object.entries(sources).filter(([, v]) => v.normal + v.elite > 0)));
  assert.equal(player(t.after, f.owner).spice, player(t.before, f.owner).spice - invoice.cost);
  assert.equal(combatArmy(t.after, f.owner, 'homeworld:emperor').normal, 1);
  assert.equal(combatArmy(t.after, f.seats.emperor!, 'homeworld:emperor').normal,
    combatArmy(t.before, f.seats.emperor!, 'homeworld:emperor').normal);
  g = advance(t.after, s => s.phase === 6 && clean(s) && !s.battle, undefined, quiet);
  const action = nexusEcazDukeAction(viewGame(g, f.owner)); assert.ok(action);
  const trainer = g.leaderSkills?.assignments.find(a => a.owner === f.owner), purse = player(g, f.owner).spice;
  policies(g, f.owner, after => {
    assert.equal(after.nexusCards!.cards!.hands[f.owner], null);
    assert.equal(after.nexusCards!.cards!.discard.filter(c => c === 'ecaz').length, 1);
    assert.equal(after.dukeVidal!.controller, f.owner); assert.equal(after.dukeVidal!.source, 'ecazNexus');
    assert.equal(player(after, f.owner).spice, purse);
  });
  reject(g, f.seats.choam!, action);
  const spent = step(g, { actor: f.owner, action }); reject(spent, f.owner, action);
  // The original emperor-native battle is resolved rather than skipped or rewritten.
  let opened = advance(spent, s => s.phase === 6 && clean(s) && !!s.active, undefined, quiet);
  const menu = viewGame(opened, opened.active!).battleChoices.find(c => c.territory === 'homeworld:emperor'); assert.ok(menu);
  opened = step(opened, { actor: menu.chooser, action: { type: 'chooseBattle', territory: menu.territory,
    target: menu.attacker === menu.chooser ? menu.defender : menu.attacker } });
  const plansWindow = advance(opened, s => !!s.battle && clean(s) && !s.battle.preparation && s.battle.preLeader?.closed !== false, undefined, quiet);
  assert.ok(!plansWindow.battle!.ecazOccupy, 'Foreign native home never inherits Arrakis Occupy');
  const ownerDisc = player(plansWindow, f.owner).leaders.filter(l => !l.dead && l.id !== trainer?.leader).sort((a, b) => a.strength - b.strength)[0];
  const nativeDisc = player(plansWindow, f.seats.emperor!).leaders.filter(l => !l.dead &&
    !plansWindow.leaderSkills?.assignments.some(a => a.leader === l.id)).sort((a, b) => b.strength - a.strength)[0];
  const revealed = reveal(plansWindow, [{ actor: f.owner, action: { type: 'battlePlan', leader: ownerDisc.id, dial: 0, support: 0 } },
    { actor: f.seats.emperor!, action: { type: 'battlePlan', leader: nativeDisc.id, dial: 2, support: 2 } }]);
  const q = quote(revealed); assert.equal(q.winner, f.seats.emperor);
  assert.equal(q.payments.find(p => p.player === f.seats.emperor)!.ownPayment, 2);
  const done = settle(revealed), later = advance(done, s => s.turn === 3 && s.phase === 1 && clean(s), undefined, quiet);
  assert.equal(later.dukeVidal!.controller, null); assert.equal(later.dukeVidal!.source, null);
  assert.equal(later.dukeVidal!.leader.dead, false);
  if (trainer) assert.ok(later.leaderSkills!.assignments.some(a => a.owner === trainer.owner && a.leader === trainer.leader && a.skill === trainer.skill),
    'Temporary Duke expiry never retires the ordinary native trainer');
  inventory(later);
});

void test('original E3/E1 Discovery uses its actual random face, typed arrival, all Maker votes and ride before both-pile alliance-change closing draw', () => {
  const f = programme({ roster: ['ecaz', 'ixians', 'guild', 'fremen'], advanced: true, skills: true,
    discovery: true, homeworlds: true, tech: true, strongholds: true });
  assert.ok(f.firstArrival && f.reveal && f.vote && f.ride && f.alliance && f.drawing);
  const token = f.reveal.before.discoveries!.tokens.find(t => t.id === f.reveal!.step.action.token)!;
  assert.equal(f.reveal.after.discoveries!.tokens.find(t => t.id === token.id)!.face, token.face);
  assert.equal(player(f.firstArrival.after, f.owner).reserves, player(f.firstArrival.before, f.owner).reserves - 2);
  assert.ok(player(f.firstArrival.after, f.owner).spice < player(f.firstArrival.before, f.owner).spice);
  assert.equal(f.votes.length, 4);
  for (const vote of f.votes) policies(vote.before, vote.step.actor, after => {
    assert.equal(player(after, vote.step.actor).spice, player(vote.before, vote.step.actor).spice);
    assert.deepEqual(combatArmy(after, f.owner, 'gara_kulon'), combatArmy(vote.before, f.owner, 'gara_kulon'));
  });
  assert.equal(f.ride.step.actor, f.seats.fremen);
  assert.equal(player(f.ride.after, f.seats.fremen!).forces['polar_sink:0'],
    (player(f.ride.before, f.seats.fremen!).forces['polar_sink:0'] ?? 0) + 2);
  assert.equal(player(f.ride.after, f.seats.fremen!).elites!.forces['polar_sink:0'],
    (player(f.ride.before, f.seats.fremen!).elites!.forces['polar_sink:0'] ?? 0) + 1);
  if (f.entry) {
    const own = viewGame(f.entry.before, f.owner), typed = discoveryEntryMoveAction(own, own.discoveryEntry!.sources); assert.ok(typed);
    policies(f.entry.before, f.owner, after => {
      assert.equal(player(after, f.owner).spice, player(f.entry!.before, f.owner).spice);
      assert.equal(player(after, f.owner).reserves, player(f.entry!.before, f.owner).reserves);
    });
    // The engine transfers the signed arrival into the revealed face's own
    // sector-0 group (`place(p, arrival.destination, 0, …)`); the destination is
    // the token face verbatim, never a renamed territory.
    const arrived = player(f.entry.after, f.owner).forces[`${token.face}:0`];
    assert.equal(arrived, 2, 'The entered forces land under the revealed face key');
    assert.equal((player(f.entry.before, f.owner).forces[`${token.face}:0`] ?? 0) + 2, arrived,
      'The entry conserves the moving forces at the exact face key');
    assert.equal(player(f.entry.after, f.owner).forces[`${token.face}:0`],
      player(f.entry.before, f.owner).forces[`gara_kulon:8`] ?? 0,
      'The same two forces leave their Discovery arrival sector');
    assert.ok(!f.entry.after.pendingAmbassador && !f.entry.after.pendingTerrorEntry);
  }
  assert.ok(f.drawing.spiceDiscard[0].some(c => 'territory' in c && c.territory === 'rock_outcroppings'));
  assert.ok(f.drawing.spiceDiscard[1].some(c => 'territory' in c && c.territory === 'oh_gap'));
  assert.equal(player(f.alliance, f.seats.guild!).ally, f.seats.fremen);
  policies(f.draws[0].before, f.owner, after => {
    assert.equal(after.nexusCards!.cards!.hands[f.owner], 'ecaz');
    assert.ok(!after.nexusCards!.cards!.deck.includes('ecaz'));
  });
  inventory(f.game);
});

void test('native Ecaz winner cleanup/Tech precedes an original Face Dance reveal without moving either seat’s training card', () => {
  const f = coalition({ roster: ['ecaz', 'tleilaxu', 'guild', 'emperor'], advanced: true, skills: true,
    homeworlds: true, tech: true, strongholds: true }, 'emperor');
  const tl = f.seats.tleilaxu!, trainer = f.trainers[f.owner];
  assert.ok(player(f.afterSetup, tl).faceDancers!.some(c => !c.revealed));
  const plansWindow = chooseLead(f, f.owner), held = player(plansWindow, f.owner).hand.find(c => c.kind === 'worthless'); assert.ok(held);
  // The Face Dance always targets the winner's own winning disc, so keep that
  // disc untrained: otherwise a genuine reveal would legitimately retire the
  // seat's training card and this case could not assert a stationary card.
  const trained = new Set((plansWindow.leaderSkills?.assignments ?? []).filter(a => a.owner === f.owner).map(a => a.leader));
  const winnerDisc = player(plansWindow, f.owner).leaders.filter(l => !l.dead && !l.usedAt && !trained.has(l.id))
    .sort((a, b) => b.strength - a.strength)[0]; assert.ok(winnerDisc, 'The winner needs an untrained disc for the Face Dance');
  const first = legalPlan(plansWindow, f.owner, winnerDisc.id, 'max', { defense: held.id });
  let afterWinner = plansWindow; for (const plan of first.steps) afterWinner = step(afterWinner, plan);
  const second = legalLeadPlan(afterWinner, f.opponent, 'min');
  const plans = [...first.steps, ...second.steps];
  const plan = plans.find(candidate => candidate.actor === f.owner && candidate.action.type === 'battlePlan');
  assert.ok(plan); plan.action.defense = held.id;
  const revealed = reveal(plansWindow, plans), q = quote(revealed); assert.equal(q.winner, f.owner);
  const lostTokens = ownedTech(revealed.techTokens, f.opponent);
  const dance = settle(revealed, s => s.decision?.kind === 'faceDance', true);
  assert.equal(dance.battle, null, 'Original battle cleanup is complete before Face Dance');
  for (const token of lostTokens) assert.equal(dance.techTokens![token].owner, f.owner);
  const decision = dance.decision; assert.ok(decision?.kind === 'faceDance');
  assert.equal(decision.player, tl); assert.equal(decision.winner, f.owner);
  const identity = decision.identity;
  const dancerCard = identity ? player(dance, tl).faceDancers!.find(dancer => dancer.leader === identity && !dancer.revealed) : undefined;
  const survivor = combatArmy(dance, f.owner, f.location.split(':')[0]);
  const nativeTraining = dance.leaderSkills!.assignments.find(a => a.owner === tl)!;
  policies(dance, tl, (after, action) => {
    const replaced = !!action.reveal;
    if (replaced) {
      const count = Object.values((action.sources ?? {}) as Record<string, number>).reduce((n, f) => n + f, 0);
      assert.equal(player(after, f.owner).leaders.find(l => l.id === identity)!.dead, true);
      assert.equal(player(after, tl).faceDancers!.find(dancer => dancer.leader === identity)!.revealed, true);
      assert.deepEqual(combatArmy(after, f.owner, f.location.split(':')[0]), { normal: 0, elite: 0 });
      assert.equal(combatArmy(after, tl, f.location.split(':')[0]).normal, count);
    } else {
      assert.deepEqual(combatArmy(after, f.owner, f.location.split(':')[0]), survivor);
    }
    assert.ok(after.leaderSkills!.assignments.some(a => a.owner === tl && a.leader === nativeTraining.leader && a.skill === nativeTraining.skill));
    assert.ok(after.leaderSkills!.assignments.some(a => a.owner === f.owner && a.leader === trainer && a.skill === 'warmaster'),
      'Neither seat’s training card moves through an original Face Dance');
    for (const token of lostTokens) assert.equal(after.techTokens![token].owner, f.owner);
  });
  assert.ok(player(dance, f.owner).hand.some(c => c.id === held.id), 'Kept winner card remains owned until its actual cleanup choice');
  if (dancerCard) {
    const replaced = step(dance, { actor: tl, action: { type: 'decision', reveal: true, sources: { reserves: 1 }, sector: 14 } });
    assert.equal(player(replaced, f.owner).leaders.find(l => l.id === identity)!.dead, true);
    assert.equal(combatArmy(replaced, tl, f.location.split(':')[0]).normal, 1);
    assert.ok(!player(replaced, tl).faceDancers!.some(dancer => dancer.leader === identity && !dancer.revealed));
    assert.equal(player(replaced, tl).spice, player(dance, tl).spice);
    inventory(replaced);
  } else {
    assert.ok(!identity || !player(dance, tl).faceDancers!.some(dancer => dancer.leader === identity && !dancer.revealed),
      'A reveal is offered only for a held unrevealed Face Dancer');
    const declined = step(dance, { actor: tl, action: { type: 'decision', reveal: false } });
    assert.deepEqual(combatArmy(declined, f.owner, f.location.split(':')[0]), survivor);
    assert.ok(declined.leaderSkills!.assignments.some(a => a.owner === f.owner && a.leader === trainer));
    inventory(declined);
  }
});

for (const advanced of [false, true]) void test(`${advanced ? 'Advanced selected Warmaster/HW/Tech/held Tabr' : 'Basic even-FORCE/no-Skills'} native mixed Ecaz coalition keeps its chosen lead, labelled support and physical payer/casualty ownership`, () => {
  const f = coalition({ roster: ['ecaz', 'tleilaxu', 'guild', 'emperor'], advanced, skills: advanced,
    homeworlds: advanced, tech: true, strongholds: advanced }, 'tleilaxu');
  const d = f.game.decision; assert.ok(d?.kind === 'ecazBattleLead');
  assert.equal(next(f.game), null, 'The coalition lead is always an owner decision.');
  reject(f.game, f.ally, { type: 'decision', event: d.event, lead: f.owner });
  reject(f.game, f.owner, { type: 'decision', event: d.event, lead: f.opponent });
  for (const arrival of f.arrivals) {
    const count = Number(arrival.step.action.amount), actor = arrival.step.actor;
    assert.equal(player(arrival.after, actor).reserves, player(arrival.before, actor).reserves - count);
    assert.equal(player(arrival.after, actor).forces[f.location],
      (player(arrival.before, actor).forces[f.location] ?? 0) + count);
    assert.ok(player(arrival.after, actor).spice < player(arrival.before, actor).spice);
  }
  for (const lead of [f.owner, f.ally]) {
    const plansWindow = chooseLead(f, lead), plans = coalitionPlans(f, plansWindow, lead);
    policies(plansWindow, lead, (offered) => {
      assert.equal(player(offered, lead).spice, player(plansWindow, lead).spice,
        'A sealed dial does not prepay support');
      const revealed = reveal(offered, [plans[1]]), finished = settle(revealed);
      assert.equal(finished.lastBattleContext!.winner, quote(revealed).winner);
      inventory(finished);
    });
    const revealed = reveal(plansWindow, plans), q = quote(revealed);
    const side = revealed.battle!.attacker === lead ? 'attacker' : 'defender';
    const leadPlan = plannedStep(plans, lead);
    assert.equal(q.winner, lead);
    assert.deepEqual((q.fixedLosses ?? []).map(loss => loss.owner), [f.owner],
      'Only Ecaz’s printed fixed dial produces the coalition’s fixed losses.');
    assert.equal(q.casualties!.owner, f.ally);
    assert.equal(q.payments.find(payment => payment.player === lead)?.ownPayment ?? 0,
      advanced ? Number(leadPlan.support) : 0,
      'The chosen variable support is funded by its own payer; Basic has no support');
    assert.equal(q.leaderSkillBonuses[side].applied.some(applied => applied.skill === 'warmaster'),
      advanced && lead === f.owner);
    assert.equal(q.scores![side], Number(leadPlan.dial) + q.leaderStrengths[side] + q.leaderSkillBonuses[side].bonus,
      'An Arrakis coalition cannot borrow either participating faction’s native Homeworld strength');
    assert.ok(q.strongholdIncome.every(income => income.player === f.owner),
      'Only the Ecaz holder can receive the held Tabr income; an ally lead never borrows it');
    const done = settle(revealed, undefined, true);
    const lostToken = ownedTech(revealed.techTokens, f.opponent)[0]; assert.ok(lostToken);
    assert.equal(done.techTokens![lostToken].owner, lead);
    const committed = (owner: string) => player(plansWindow, owner).forces[f.location] ?? 0;
    assert.equal(player(done, f.opponent).tanks - player(plansWindow, f.opponent).tanks, committed(f.opponent),
      'The losing side loses every committed counter');
    const winnerTanks = [f.owner, f.ally]
      .reduce((n, owner) => n + (player(done, owner).tanks - player(plansWindow, owner).tanks), 0);
    assert.ok(winnerTanks >= 1 && winnerTanks <= committed(f.owner) + committed(f.ally),
      'The winning coalition loses only its own dialed counters');
    inventory(done);
  }
});

for (const skilled of [false, true]) void test(`original Ecaz native ${skilled ? 'hidden trained' : 'unused face-up normal'} Suk saves only the actual winning dialed casualties at the same home`, () => {
  const f = programme({ roster: ['ecaz', 'ixians', 'guild', 'emperor'], advanced: true, skills: true,
    skill: 'suk-graduate', homeworlds: true, tech: true, strongholds: true });
  const ix = f.seats.ixians!;
  let g = advance(f.game, s => s.phase === 5 && s.active === ix && clean(s), undefined, quiet);
  const arrival = ship(g, ix, 'homeworld:ecaz', 2, undefined, 1); g = arrival.after;
  assert.deepEqual(combatArmy(g, ix, 'homeworld:ecaz'), { normal: 1, elite: 1 });
  g = advance(g, s => s.phase === 6 && clean(s), undefined, quiet);
  const menu = viewGame(g, g.active!).battleChoices.find(c => c.territory === 'homeworld:ecaz'); assert.ok(menu);
  g = step(g, { actor: menu.chooser, action: { type: 'chooseBattle', territory: menu.territory,
    target: menu.attacker === menu.chooser ? menu.defender : menu.attacker } });
  const plansWindow = advance(g, s => !!s.battle && clean(s) && !s.battle.preparation && s.battle.preLeader?.closed !== false,
    undefined, s => s.decision?.kind === 'leaderSkillVisibility'
      ? { actor: s.decision.player, action: { type: 'leaderSkillVisibility', event: s.decision.event,
        hide: s.decision.player === f.owner && skilled } } : quiet(s));
  const trainer = f.trainers[f.owner];
  const nativeDisc = skilled ? player(plansWindow, f.owner).leaders.find(l => l.id === trainer)!
    : player(plansWindow, f.owner).leaders.filter(l => !l.dead && l.id !== trainer).sort((a, b) => b.strength - a.strength)[0];
  const visitorDisc = player(plansWindow, ix).leaders.filter(l => !l.dead &&
    !plansWindow.leaderSkills!.assignments.some(a => a.leader === l.id)).sort((a, b) => a.strength - b.strength)[0];
  const ownerPlan = legalPlan(plansWindow, f.owner, nativeDisc.id, 'max');
  let afterOwner = plansWindow; for (const plan of ownerPlan.steps) afterOwner = step(afterOwner, plan);
  const visitorPlan = legalPlan(afterOwner, ix, visitorDisc.id, 'max');
  const revealed = reveal(plansWindow, [...ownerPlan.steps, ...visitorPlan.steps]), q = quote(revealed);
  assert.equal(q.winner, f.owner);
  assert.equal(q.payments.find(payment => payment.player === f.owner)?.ownPayment ?? 0, Number(ownerPlan.action.support),
    'Native free strength does not fund dialed support');
  assert.equal(q.sukGraduate?.mode, skilled ? 'skilled' : 'normal',
    'Only the hidden trained disc rescues in the skilled band; the unused face-up disc stays ordinary');
  // The winner's own dialed casualties are the only counters a Suk may save.
  const losses = q.casualties!.options[0]!;
  const lossTotal = losses.normal + losses.elite;
  assert.ok(lossTotal >= 1, 'The winner must have real dialed casualties for the rescue window.');
  // The hidden trained disc exposes an owner rescue decision. The unused
  // face-up disc has exactly one legal rescue, which the engine applies itself,
  // so the boundary is either that decision or the settled post-rescue state.
  const rescue = settle(revealed, s => s.decision?.kind === 'sukRescue' || (!s.battle && clean(s)));
  const d = rescue.decision;
  assert.equal(player(rescue, f.owner).spice, player(revealed, f.owner).spice - Number(ownerPlan.action.support));
  assert.equal(combatArmy(rescue, ix, 'homeworld:ecaz').normal + combatArmy(rescue, ix, 'homeworld:ecaz').elite, 0);
  assert.equal(player(rescue, ix).tanks, player(revealed, ix).tanks + 2,
    'Both shipped visitor counters are real Tanks losses');
  const homeArmy = combatArmy(revealed, f.owner, 'homeworld:ecaz').normal;
  const maximum = d?.kind === 'sukRescue'
    ? Math.max(...d.options.map(option => option.normal + option.elite))
    : 1;
  if (d?.kind === 'sukRescue') {
    assert.equal(d.player, f.owner);
    assert.equal(next(rescue), null, 'The rescue is an owner decision.');
    assert.ok(maximum <= 3, 'The selected hidden band saves up to three counters');
    assert.ok(d.options.some(option => option.kept), 'A skilled rescue keeps one physical counter in its sector');
    const choice = d.options.findIndex(option => option.normal + option.elite === maximum);
    const action: Action = { type: 'decision', event: d.event, choice };
    reject(rescue, ix, action);
    policies(rescue, f.owner, (after, proposal) => {
      const saved = d.options[Number(proposal.choice)]; assert.ok(saved);
      const savedTotal = saved.normal + saved.elite;
      assert.equal(player(after, f.owner).tanks, player(revealed, f.owner).tanks + lossTotal - savedTotal,
        'Only the unrescued dialed casualties reach the winner’s Tanks');
      assert.equal(combatArmy(after, f.owner, 'homeworld:ecaz').normal, homeArmy - lossTotal + savedTotal,
        'The saved counters stay at the same home');
      assert.equal(player(after, f.owner).spice, player(rescue, f.owner).spice);
      assert.equal(player(after, ix).tanks, player(rescue, ix).tanks, 'Loser never receives the winner-only rescue');
    });
    const settled = step(rescue, { actor: f.owner, action }), done = settle(settled, s => !s.battle && clean(s));
    assert.equal(player(done, f.owner).tanks, player(revealed, f.owner).tanks + lossTotal - maximum,
      'Exactly the unrescued dialed counters reach the winner’s Tanks');
    assert.equal(combatArmy(done, f.owner, 'homeworld:ecaz').normal, homeArmy - lossTotal + maximum,
      'The saved counters stay at the same home');
    assert.equal(player(done, ix).tanks, player(rescue, ix).tanks, 'Loser never receives the winner-only rescue');
    inventory(done);
  } else {
    assert.equal(maximum, 1, 'The unused face-up band saves exactly one counter');
    assert.equal(player(rescue, f.owner).tanks, player(revealed, f.owner).tanks + lossTotal - 1,
      'Exactly the unrescued dialed counters reach the winner’s Tanks');
    assert.equal(combatArmy(rescue, f.owner, 'homeworld:ecaz').normal, homeArmy - lossTotal + 1,
      'The single saved counter stays at the same home');
    inventory(rescue);
  }
});
