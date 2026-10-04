import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { DIFFICULTIES } from '../game/bot-profiles';
import { ownedTech } from '../game/tech-tokens';
import { strongholdBenefit, strongholdControllers } from '../game/stronghold-cards';
import { botActions } from '../game/bots';
import { territory } from '../game/board';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { nexusFaceDancersAction } from '../game/nexus-tleilaxu-options';
import {
  advancePairedIxNexusSkillsModules as advance, beginPairedIxNexusSkillsModulesCunning as cunning,
  createPairedIxNexusSkillsModulesFixture as fixture, finishPairedIxNexusSkillsModulesBattle as finish,
  finishPairedIxNexusSkillsModulesTurn as finishTurn, initializePairedIxNexusSkillsModulesSetup as setup,
  pairedIxNexusSkillsModulesPlayer as player, preparePairedIxNexusSkillsModulesBattle as prepare,
  quotePairedIxNexusSkillsModulesBattle as quoteBattle, revealPairedIxNexusSkillsModulesBattle as reveal,
  stepPairedIxNexusSkillsModules as step, type PairedIxNexusSkillsModulesFixture,
} from './fixture-paired-ix-nexus-skills-modules';

function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'Rejected consumer actions cannot consume physical cards, forces, spice or receipts');
}
function treachery(game: Game): string[] {
  return [...game.deck, ...game.discard, ...(game.ixSetupCards ?? []), ...(game.ixAuction?.cards ?? []),
    ...(game.auction?.cards.slice(game.auction.index + (game.currentAuctionSale ? 1 : 0)) ?? []),
    ...game.players.flatMap(p => p.hand)].map(c => c.id).sort();
}
function custody(game: Game, original: Game): void {
  assert.equal(treachery(game).length, 47);
  assert.deepEqual(treachery(game), treachery(original));
  assert.equal(new Set(treachery(game)).size, 47);
  validateLeaderSkills(game.leaderSkills!, game.players);
  const skills = [...game.leaderSkills!.deck, ...Object.values(game.leaderSkills!.offers).flatMap(o => o.cards),
    ...game.leaderSkills!.assignments.map(a => a.skill)].sort();
  assert.deepEqual(skills, LEADER_SKILL_CARDS.map(c => c.id).sort());
  const nexus = game.nexusCards!.cards!;
  const faces = [...nexus.deck, ...nexus.discard, ...Object.values(nexus.hands).filter((c): c is NonNullable<typeof c> => c !== null)];
  assert.equal(faces.length, 12); assert.equal(new Set(faces).size, 12);
  const stock = (g: Game) => [...(g.traitorReserve ?? []), ...g.players.flatMap(p => [...p.traitors, ...(p.faceDancers ?? []).map(c => c.leader)])].sort();
  assert.deepEqual(stock(game), stock(original)); assert.equal(new Set(stock(game)).size, stock(game).length);
  for (const p of game.players) {
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((sum, n) => sum + n, 0), 20, p.faction);
    if (p.elites) {
      const old = player(original, p.id).elites!;
      assert.equal(p.elites.reserves + p.elites.tanks + Object.values(p.elites.forces).reduce((sum, n) => sum + n, 0),
        old.reserves + old.tanks + Object.values(old.forces).reduce((sum, n) => sum + n, 0));
      for (const [key, n] of Object.entries(p.elites.forces)) assert.ok(n <= (p.forces[key] ?? 0));
    }
  }
}
function city(game: Game, actor: string): number {
  return game.phase === 7 && !game.phaseOpening ? quoteSpiceCollection(game).receipts
    .filter(r => r.player === actor).reduce((sum, r) => sum + r.collected + r.strongholds, 0) : 0;
}
function money(revealed: Game, settled: Game): void {
  const quote = quoteBattle(revealed);
  for (const p of revealed.players) {
    const paid = quote.payments.find(r => r.player === p.id)?.ownPayment ?? 0;
    const bounty = quote.bounty?.player === p.id ? quote.bounty.amount : 0;
    const income = quote.strongholdIncome.filter(r => r.player === p.id).reduce((sum, r) => sum + r.amount, 0);
    assert.equal(player(settled, p.id).spice, p.spice - paid + bounty + income + city(settled, p.id), p.faction);
  }
}
function chooseCyborgLosses(state: Game, f: PairedIxNexusSkillsModulesFixture): Game {
  const losses = finish(state, 'losses');
  assert.equal(losses.decision?.kind, 'battleLosses');
  if (losses.decision?.kind !== 'battleLosses') throw Error('Actual typed casualty choice required');
  const choice = losses.decision.options.findIndex(o => o.normal === 0 && o.elite === 3); assert.ok(choice >= 0);
  assert.equal(player(losses, f.ixians).tanks, player(state, f.ixians).tanks, 'Typed commitment precedes physical Suk settlement');
  return step(losses, { actor: f.ixians, action: { type: 'decision', choice } });
}
function dance(f: PairedIxNexusSkillsModulesFixture, pending: Game): Game {
  assert.equal(pending.decision?.kind, 'faceDance');
  const count = player(pending, f.ixians).forces[f.location]; assert.ok(count >= 2);
  return step(pending, { actor: f.tleilaxu, action: { type: 'decision', reveal: true,
    sources: { [f.replacementSource]: 2, reserves: count - 2 }, sector: territory('sietch_tabr').sectors[0] } });
}

function reward(f: PairedIxNexusSkillsModulesFixture, game: Game): void {
  assert.equal(game.lastBattleContext!.winner, f.ixians);
  if (!f.game.techTokens) return;
  const tokens = ownedTech(f.game.techTokens, f.opponent); assert.equal(tokens.length, 1);
  assert.equal(game.techTokens![tokens[0]].owner, f.ixians);
  assert.equal(game.techTokens![tokens[0]].spice, f.game.techTokens![tokens[0]].spice);
  assert.equal(ownedTech(game.techTokens, f.opponent).length, 0);
}

const MODES = [
  { advanced: false, tech: true, strongholds: false },
  { advanced: true, tech: true, strongholds: false },
  { advanced: true, tech: false, strongholds: true },
  { advanced: true, tech: true, strongholds: true },
] as const;
for (const mode of MODES) for (const band of ['normal', 'skilled'] as const) {
  const advanced = mode.advanced;
  void test(`paired E1 Skills/modules ${JSON.stringify(mode)} ${band} Warmaster: full unsupported Suboids, real bonus and typed losses`, () => {
    const f = fixture({ ...mode, band, skill: 'warmaster', dial: 3, support: 0 });
    assert.equal(f.beforeFirstMentat.turn, 1); assert.equal(f.afterFirstMentat.turn, 2);
    assert.equal(f.beforeAlliance.nexus, true);
    assert.equal(player(f.afterNexusDraw, f.partners[0]).ally, f.partners[1]);
    assert.equal(player(f.afterNexusDraw, f.ixians).ally, null);
    assert.equal(player(f.afterNexusDraw, f.tleilaxu).ally, null);
    assert.equal(f.afterNexusDraw.nexusCards!.cards!.hands[f.ixians], 'ixians');
    assert.equal(f.afterNexusDraw.nexusCards!.cards!.hands[f.tleilaxu], 'tleilaxu');
    if (mode.strongholds) {
      assert.equal(f.beforeFirstMentat.strongholdCards!.owners.arrakeen, null);
      const claimed = step(f.beforeFirstMentat, f.firstMentatStep);
      assert.equal(claimed.strongholdCards!.owners.arrakeen, f.ixians);
      assert.equal(claimed.turn, 2);
    }
    custody(f.afterNexusDraw, f.afterSetup);
    const ready = prepare(f), offer = viewGame(ready, f.ixians).nexusSuboids!.offer!;
    reject(ready, f.tleilaxu, { type: 'nexusSuboids', event: offer.event });
    const active = cunning(f, ready);
    assert.deepEqual(player(active, f.ixians).forces, player(ready, f.ixians).forces);
    assert.deepEqual(player(active, f.ixians).elites, player(ready, f.ixians).elites);
    assert.equal(player(active, f.ixians).spice, player(ready, f.ixians).spice);
    assert.equal(active.nexusCards!.cards!.hands[f.ixians], null);
    reject(active, f.ixians, { type: 'nexusSuboids', event: offer.event });
    const revealed = reveal(f, { state: active });
    const quote = quoteBattle(revealed);
    assert.equal(quote.result, 'normal'); assert.equal(quote.winner, f.ixians);
    assert.equal(quote.casualties!.forces.normalFixedHalf, false);
    assert.equal(quote.casualties!.forces.normalFreeSupport, true);
    const side = revealed.battle!.attacker === f.ixians ? 'attacker' : 'defender';
    assert.deepEqual(quote.leaderSkillBonuses[side].applied, [{ skill: 'warmaster', amount: band === 'skilled' ? 3 : 1, mode: band }]);
    assert.equal(quote.leaderStrengths[side], player(revealed, f.ixians).leaders.find(l => l.id === f.planActions[0].action.leader)!.strength);
    assert.ok(quote.casualties!.options.some(o => o.normal === 3 && o.elite === 0));
    if (advanced) {
      const ordinary = quoteBattle(reveal(f));
      assert.ok(!ordinary.casualties!.options.some(o => o.normal === 3 && o.elite === 0));
      assert.equal(quote.payments.find(r => r.player === f.ixians)!.ownPayment, 0);
      assert.equal(quote.payments.find(r => r.player === f.ixians)!.bankSupport, 0);
    } else assert.deepEqual(quote.payments, []);
    const losses = finish(revealed, 'losses');
    if (losses.decision?.kind !== 'battleLosses') throw Error('Missing actual typed winner casualties');
    const choice = losses.decision.options.findIndex(o => o.normal === 3 && o.elite === 0); assert.ok(choice >= 0);
    const settled = finish(step(losses, { actor: f.ixians, action: { type: 'decision', choice } }));
    assert.equal(player(settled, f.ixians).forces[f.location], 3);
    assert.equal(player(settled, f.ixians).elites!.forces[f.location], 3);
    assert.equal(player(settled, f.ixians).tanks, player(revealed, f.ixians).tanks + 3);
    assert.equal(player(settled, f.ixians).elites!.tanks, player(revealed, f.ixians).elites!.tanks);
    assert.equal(player(settled, f.opponent).tanks, player(revealed, f.opponent).tanks + 6);
    money(revealed, settled); reward(f, settled); custody(settled, f.afterSetup);
  });

  void test(`paired E1 Skills/modules ${JSON.stringify(mode)} ${band} Suk: physical rescue precedes equal Suboid substitution, paid once`, () => {
    const f = fixture({ ...mode, band, skill: 'suk-graduate' });
    const revealed = reveal(f, { cunning: true }), quote = quoteBattle(revealed);
    assert.equal(quote.winner, f.ixians); assert.equal(quote.sukGraduate!.mode, band);
    if (advanced) {
      const payment = quote.payments.find(r => r.player === f.ixians)!;
      assert.equal(payment.ownPayment, mode.strongholds ? 0 : 1); assert.equal(payment.bankSupport, mode.strongholds ? 1 : 0);
    } else assert.deepEqual(quote.payments, []);
    const original = player(revealed, f.ixians);
    let selected = chooseCyborgLosses(revealed, f);
    let event = '', choice = 0;
    if (band === 'skilled') {
      const rescue = finish(selected, 'rescue');
      if (rescue.decision?.kind !== 'sukRescue') throw Error('Missing original skilled Suk rescue');
      assert.equal(player(rescue, f.ixians).tanks, original.tanks, 'No physical losses occur before the skilled rescue choice');
      choice = rescue.decision.options.findIndex(o => o.normal === 0 && o.elite === 1 && o.kept?.kind === 'elite' && o.kept.key === f.location);
      assert.ok(choice >= 0); event = rescue.decision.event;
      selected = step(rescue, { actor: f.ixians, action: { type: 'decision', event, choice } });
    } else {
      assert.equal(selected.lastBattleContext!.sukRescue!.completed, true, 'The sole normal elite rescue is applied automatically');
    }
    const pending = finish(selected, 'substitution');
    assert.equal(pending.decision?.kind, 'ixSubstitution');
    assert.deepEqual(pending.techTokens, revealed.techTokens, 'Physical rescue/substitution must precede original Tech transfer');
    const p = player(pending, f.ixians);
    assert.equal(p.tanks, original.tanks + 2); assert.equal(p.elites!.tanks, original.elites!.tanks + 2);
    assert.equal(p.battleLosses, original.battleLosses + 2);
    assert.equal(p.reserves, original.reserves + (band === 'normal' ? 1 : 0));
    assert.equal(p.elites!.reserves, original.elites!.reserves + (band === 'normal' ? 1 : 0));
    assert.equal(p.forces[f.location], band === 'normal' ? 3 : 4);
    assert.equal(p.elites!.forces[f.location] ?? 0, band === 'normal' ? 0 : 1);
    assert.equal(p.spice, original.spice - (advanced && !mode.strongholds ? 1 : 0));
    reject(pending, f.ixians, { type: 'decision', event, choice });
    reject(pending, f.ixians, { type: 'decision', sources: { [f.location]: 2 }, recover: { [f.location]: 3 } });
    const exchanged = step(pending, { actor: f.ixians, action: { type: 'decision', sources: { [f.location]: 2 }, recover: { [f.location]: 2 } } });
    const settled = finish(exchanged), after = player(settled, f.ixians);
    assert.equal(after.forces[f.location], p.forces[f.location]);
    assert.equal(after.elites!.forces[f.location], band === 'normal' ? 2 : 3);
    assert.equal(after.tanks, p.tanks, 'Equal physical exchange does not count the original Cyborg loss twice');
    assert.equal(after.elites!.tanks, original.elites!.tanks);
    assert.equal(after.battleLosses, p.battleLosses);
    assert.equal(after.reserves, p.reserves); assert.equal(after.elites!.reserves, p.elites!.reserves);
    assert.equal(settled.lastBattleContext!.sukRescue!.completed, true);
    assert.equal(settled.lastBattleContext!.ixSubstitution!.completed, true);
    money(revealed, settled); reward(f, settled); custody(settled, f.afterSetup);
  });
}

for (const mode of MODES) void test(`paired E1 Skills/modules ${JSON.stringify(mode)} Face Dance: Suk/card cleanup/rewards finish first; partial Cunning draws before retirement`, () => {
  const f = fixture({ ...mode, program: 'faceDance', skill: 'suk-graduate' });
  f.planActions[1].action.dial = 1;
  f.planActions[1].action.support = mode.advanced ? 1 : 0;
  const revealed = reveal(f, { cunning: true }), quote = quoteBattle(revealed);
  const enemy = player(revealed, f.opponent).leaders.find(l => l.id === f.planActions[1].action.leader)!;
  assert.deepEqual(quote.bounty, { player: f.ixians, amount: enemy.strength });
  const cards = finish(revealed, 'cards');
  assert.equal(cards.decision?.kind, 'battleCards');
  reject(cards, f.tleilaxu, { type: 'decision', reveal: true, sources: { reserves: 1 }, sector: territory('sietch_tabr').sectors[0] });
  assert.equal(cards.lastBattleContext!.sukRescue!.completed, true);
  const defense = f.planActions[0].action.defense as string;
  const cleaned = step(cards, { actor: f.ixians, action: { type: 'decision', discard: [defense] } });
  const rewarded = finish(cleaned, 'tech');
  reward(f, rewarded);
  const pending = finish(rewarded, 'faceDance');
  assert.ok(pending.discard.some(c => c.id === defense));
  assert.equal(player(pending, f.opponent).leaders.find(l => l.id === enemy.id)!.dead, true);
  money(revealed, pending); reward(f, pending);
  assert.ok(!pending.pendingTech, 'Mandatory native Tech reward finishes before matching Face Dance');
  if (mode.strongholds) assert.deepEqual(quote.strongholdIncome, [{ player: f.ixians, amount: 1 }]);
  const winner = structuredClone(player(pending, f.ixians));
  const oldStock = structuredClone(player(pending, f.tleilaxu).faceDancers!);
  assert.ok(oldStock.some(c => c.leader === f.trainer && !c.revealed));
  reject(pending, f.tleilaxu, { type: 'decision', reveal: true, sources: { reserves: winner.forces[f.location] + 1 }, sector: territory('sietch_tabr').sectors[0] });
  const after = dance(f, pending), returned = player(after, f.ixians), replacement = player(after, f.tleilaxu);
  assert.equal(returned.forces[f.location] ?? 0, 0); assert.equal(returned.elites!.forces[f.location] ?? 0, 0);
  assert.equal(returned.reserves, winner.reserves + winner.forces[f.location]);
  assert.equal(returned.elites!.reserves, winner.elites!.reserves + (winner.elites!.forces[f.location] ?? 0));
  assert.equal(returned.tanks, winner.tanks); assert.equal(returned.battleLosses, winner.battleLosses);
  assert.equal(returned.elites!.tanks, winner.elites!.tanks);
  assert.equal(returned.leaders.find(l => l.id === f.trainer)!.deaths, winner.leaders.find(l => l.id === f.trainer)!.deaths + 1);
  assert.equal(returned.leaders.find(l => l.id === f.trainer)!.dead, true);
  assert.equal(after.leaderSkills!.assignments.some(a => a.leader === f.trainer), false);
  assert.equal(after.leaderSkills!.deck.filter(s => s === f.skill).length, 1);
  assert.deepEqual(returned.hand, winner.hand);
  for (const p of pending.players) assert.equal(player(after, p.id).spice, p.spice + city(after, p.id), 'Face Dance grants no extra bounty/support charge');
  assert.equal(replacement.forces[f.location], winner.forces[f.location]);
  assert.equal(replacement.forces[f.replacementSource], 1);
  assert.equal(replacement.reserves, player(pending, f.tleilaxu).reserves - winner.forces[f.location] + 2);
  const revealedStock = replacement.faceDancers!.filter(c => c.revealed); assert.equal(revealedStock.length, 1);
  const untouched = replacement.faceDancers!.filter(c => !c.revealed);
  assert.deepEqual(untouched, oldStock.filter(c => c.leader !== f.trainer));
  assert.deepEqual(after.techTokens, pending.techTokens, 'Replacement cannot confiscate the earned token');
  if (mode.strongholds) {
    assert.equal(strongholdControllers(after.players, true).sietch_tabr, f.tleilaxu);
    assert.equal(strongholdBenefit(after.strongholdCards, f.ixians, 'sietch_tabr'), 'sietch_tabr');
    assert.equal(strongholdBenefit(after.strongholdCards, f.tleilaxu, 'sietch_tabr'), null);
  }
  const view = viewGame(after, f.tleilaxu), offer = view.nexusTleilaxu!.cunning!;
  const action = nexusFaceDancersAction(view, offer.event); assert.ok(action);
  const reserve = [...after.traitorReserve!], allowance = replacement.faceDancerReplacedTurn;
  reject(after, f.tleilaxu, { ...action, leaders: [f.trainer] });
  const replaced = step(after, { actor: f.tleilaxu, action });
  assert.deepEqual(player(replaced, f.tleilaxu).faceDancers!.filter(c => untouched.some(old => old.leader === c.leader)), untouched);
  assert.deepEqual(player(replaced, f.tleilaxu).faceDancers!.filter(c => !untouched.some(old => old.leader === c.leader)), [{ leader: reserve[0], revealed: false }]);
  assert.notEqual(reserve[0], f.trainer);
  assert.deepEqual([...replaced.traitorReserve!].sort(), [...reserve.slice(1), f.trainer].sort());
  assert.equal(player(replaced, f.tleilaxu).faceDancerReplacedTurn, allowance);
  assert.equal(replaced.nexusCards!.cards!.hands[f.tleilaxu], null);
  reject(replaced, f.tleilaxu, action); custody(replaced, f.afterSetup);
  const mentat = advance(replaced, g => g.phase === 8 && !g.phaseOpening && !g.response && !g.decision);
  const ordinary = step(mentat, { actor: f.tleilaxu, action: { type: 'replaceFaceDancer', leader: untouched[0].leader } });
  const done = advance(ordinary, g => !g.response && !g.decision);
  assert.equal(player(done, f.tleilaxu).faceDancerReplacedTurn, done.turn);
  reject(done, f.tleilaxu, { type: 'replaceFaceDancer', leader: player(done, f.tleilaxu).faceDancers![0].leader });
  const turn = finishTurn(done);
  if (mode.strongholds) assert.equal(turn.strongholdCards!.owners.sietch_tabr, f.tleilaxu);
  assert.equal(turn.leaderSkills!.deck.filter(s => s === f.skill).length, 1); custody(turn, f.afterSetup);
});

void test('held Arrakeen and original HMS copy subsidize the payer, not the supported Suk casualty commitment', () => {
  const f = fixture({ tech: true, strongholds: true, mobileBattle: true });
  const copy = advance(f.game, g => g.decision?.kind === 'strongholdCopy');
  assert.equal(copy.decision?.kind, 'strongholdCopy');
  reject(copy, f.ixians, f.planActions[0].action);
  const prepared = prepare(f, copy);
  assert.equal(viewGame(prepared, f.opponent).battle!.strongholdEffects[f.ixians], 'arrakeen');
  const revealed = reveal(f, { state: prepared, cunning: true }), quote = quoteBattle(revealed);
  assert.equal(quote.payments.find(p => p.player === f.ixians)!.ownPayment, 0);
  assert.equal(quote.payments.find(p => p.player === f.ixians)!.bankSupport, 1);
  const rescue = finish(chooseCyborgLosses(revealed, f), 'rescue');
  if (rescue.decision?.kind !== 'sukRescue') throw Error('Original copy-funded Suk rescue is required');
  assert.deepEqual(rescue.pendingSukRescue!.losses, { normal: 0, elite: 3, paidNormal: 0, paidElite: 1 });
  assert.equal(player(rescue, f.ixians).tanks, player(revealed, f.ixians).tanks);
  const settled = finish(rescue);
  money(revealed, settled); reward(f, settled); custody(settled, f.afterSetup);
});

void test('own sealed plan cannot consume Cunning and four legal policies preserve actual paid plans, typed rescue and Face Dance sources', () => {
  const f = fixture({ tech: true, strongholds: true, program: 'faceDance' });
  const prepared = prepare(f), offer = viewGame(prepared, f.ixians).nexusSuboids!.offer!;
  const sealed = step(prepared, f.planActions[0]);
  reject(sealed, f.ixians, { type: 'nexusSuboids', event: offer.event });
  const revealed = reveal(f, { cunning: true });
  const rescue = finish(chooseCyborgLosses(revealed, f), 'rescue');
  if (rescue.decision?.kind !== 'sukRescue') throw Error('Original typed policy rescue is required');
  const face = finish(revealed, 'faceDance');
  for (const difficulty of DIFFICULTIES) {
    const opening = viewGame(prepared, f.ixians); opening.players.find(p => p.id === f.ixians)!.bot = difficulty;
    const cunningAction = botActions(opening).find(a => a.type === 'nexusSuboids'); assert.ok(cunningAction);
    const active = advance(step(prepared, { actor: f.ixians, action: cunningAction }), g => !g.response && !g.decision && !g.phaseOpening);
    const own = viewGame(active, f.ixians); own.players.find(p => p.id === f.ixians)!.bot = difficulty;
    const plan = botActions(own).find(a => a.type === 'battlePlan'); assert.ok(plan);
    const committed = step(active, { actor: f.ixians, action: plan });
    assert.ok(committed.battle!.plans[f.ixians]);
    assert.equal(player(committed, f.ixians).spice, player(active, f.ixians).spice);
    const rescueView = viewGame(rescue, f.ixians); rescueView.players.find(p => p.id === f.ixians)!.bot = difficulty;
    const rescueAction = botActions(rescueView).find(a => a.type === 'decision'); assert.ok(rescueAction);
    const saved = step(rescue, { actor: f.ixians, action: rescueAction });
    assert.equal(player(saved, f.ixians).tanks, player(revealed, f.ixians).tanks);
    assert.equal(player(saved, f.ixians).forces[f.location], 4);
    custody(finish(saved), f.afterSetup);
    const view = viewGame(face, f.tleilaxu); view.players.find(p => p.id === f.tleilaxu)!.bot = difficulty;
    const action = botActions(view).find(a => a.type === 'decision'); assert.ok(action && action.reveal === true);
    const after = step(face, { actor: f.tleilaxu, action });
    assert.equal(player(after, f.ixians).forces[f.location] ?? 0, 0);
    assert.ok(player(after, f.tleilaxu).forces[f.location] > 0);
    assert.equal(after.leaderSkills!.assignments.some(a => a.leader === f.trainer), false);
    assert.deepEqual(after.techTokens, face.techTokens); custody(after, f.afterSetup);
  }
});

void test('original authenticated saved hands/offers survive module continuation; absent skill and foreign disc are rejected', () => {
  const lobby = createGame('PAIREDIXSKILLSMODULESAUTH', newPlayer('http-ix', 'Ix', 'ixians'), true, ['ix']);
  for (const [id, faction] of [['http-tl', 'tleilaxu'], ['http-guild', 'guild'], ['http-emperor', 'emperor']] as const)
    joinGame(lobby, newPlayer(id, faction, faction));
  const fresh = fixture({ initial: lobby, tech: true, strongholds: true, skill: 'suk-graduate' });
  const saved = structuredClone(fresh.offered), offer = saved.leaderSkills!.offers[fresh.ixians];
  reject(saved, fresh.ixians, { type: 'leaderSkill', event: offer.event, skill: 'suk-graduate', leader: player(saved, fresh.opponent).leaders[0].id });
  const unavailable = LEADER_SKILL_CARDS.find(c => !offer.cards.includes(c.id))!.id;
  assert.throws(() => fixture({ initial: saved, skill: unavailable }));
  const continued = fixture({ initial: saved, skill: 'suk-graduate' });
  assert.deepEqual(continued.initial, saved);
  assert.deepEqual(continued.afterSetup.players.map(p => [p.id, p.hand]), saved.players.map(p => [p.id, p.hand]));
  assert.deepEqual(continued.offered.leaderSkills!.offers, saved.leaderSkills!.offers);
  const ready = prepare(continued), offer2 = viewGame(ready, 'http-ix').nexusSuboids!.offer!;
  reject(ready, 'http-tl', { type: 'nexusSuboids', event: offer2.event });
  const active = cunning(continued, ready);
  assert.equal(active.nexusSuboidLast!.owner, 'http-ix');
  custody(active, continued.afterSetup);
});

void test('two native seats may initialize Strongholds/Skills but an unallied closing draw cannot be fabricated', () => {
  const lobby = createGame('PAIREDIXTWO', newPlayer('ix', 'Ix', 'ixians'), true, ['ix']);
  joinGame(lobby, newPlayer('tl', 'Tleilaxu', 'tleilaxu'));
  const original = setup({ initial: lobby, tech: false, strongholds: true, skill: 'suk-graduate' });
  const storm = advance(original.game, g => g.phase === 1 && !g.phaseOpening && !g.response && !g.decision);
  assert.equal(storm.turn, 1);
  assert.ok(Object.values(storm.nexusCards!.cards!.hands).every(c => c === null));
  reject(storm, 'ix', { type: 'nexusCardChoice', turn: 1, card: null, choice: 'draw', ownRedraws: 0 });
  assert.throws(() => fixture({ initial: original.offered }), /Two classics/);
});
