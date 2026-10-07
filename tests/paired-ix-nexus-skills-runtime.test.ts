import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { territory } from '../game/board';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { nexusFaceDancersAction } from '../game/nexus-tleilaxu-options';
import {
  advancePairedIxNexusSkills, beginPairedIxNexusSkillsCunning, choosePairedIxNexusSkillsSecondBattle,
  createPairedIxNexusSkillsFixture, finishPairedIxNexusSkillsBattle, finishPairedIxNexusSkillsTurn,
  pairedIxNexusSkillsPlayer as player, preparePairedIxNexusSkillsBattle, preparePairedIxNexusSkillsExpiryBattle,
  quotePairedIxNexusSkillsBattle, revealPairedIxNexusSkillsBattle, stepPairedIxNexusSkills,
  type PairedIxNexusSkillsFixture, type PairedIxNexusSkillsStep,
} from './fixture-paired-ix-nexus-skills';

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
  const quote = quotePairedIxNexusSkillsBattle(revealed);
  for (const p of revealed.players) {
    const paid = quote.payments.find(r => r.player === p.id)?.ownPayment ?? 0;
    const bounty = quote.bounty?.player === p.id ? quote.bounty.amount : 0;
    assert.equal(player(settled, p.id).spice, p.spice - paid + bounty + city(settled, p.id), p.faction);
  }
  assert.deepEqual(quote.strongholdIncome, [], 'Printed city collection is separate; this profile has no Stronghold Cards');
}
function chooseCyborgLosses(state: Game, f: PairedIxNexusSkillsFixture): Game {
  const losses = finishPairedIxNexusSkillsBattle(state, 'losses');
  assert.equal(losses.decision?.kind, 'battleLosses');
  if (losses.decision?.kind !== 'battleLosses') throw Error('Actual typed casualty choice required');
  const choice = losses.decision.options.findIndex(o => o.normal === 0 && o.elite === 3); assert.ok(choice >= 0);
  assert.equal(player(losses, f.ixians).tanks, player(state, f.ixians).tanks, 'Typed commitment precedes physical Suk settlement');
  return stepPairedIxNexusSkills(losses, { actor: f.ixians, action: { type: 'decision', choice } });
}
function dance(f: PairedIxNexusSkillsFixture, pending: Game): Game {
  assert.equal(pending.decision?.kind, 'faceDance');
  const count = player(pending, f.ixians).forces[f.location]; assert.ok(count >= 2);
  return stepPairedIxNexusSkills(pending, { actor: f.tleilaxu, action: { type: 'decision', reveal: true,
    sources: { [f.replacementSource]: 2, reserves: count - 2 }, sector: territory(f.kind).sectors[0] } });
}

for (const advanced of [false, true]) for (const band of ['normal', 'skilled'] as const) {
  void test(`original paired E1 ${advanced ? 'Advanced' : 'Basic'} ${band} Warmaster: full unsupported Suboids, real bonus and typed losses`, () => {
    const f = createPairedIxNexusSkillsFixture({ advanced, band, skill: 'warmaster', dial: 3, support: 0 });
    assert.equal(f.beforeFirstMentat.turn, 1); assert.equal(f.afterFirstMentat.turn, 2);
    assert.equal(f.beforeAlliance.nexus, true);
    assert.equal(player(f.afterNexusDraw, f.partners[0]).ally, f.partners[1]);
    assert.equal(player(f.afterNexusDraw, f.ixians).ally, null);
    assert.equal(player(f.afterNexusDraw, f.tleilaxu).ally, null);
    assert.equal(f.afterNexusDraw.nexusCards!.cards!.hands[f.ixians], 'ixians');
    assert.equal(f.afterNexusDraw.nexusCards!.cards!.hands[f.tleilaxu], 'tleilaxu');
    custody(f.afterNexusDraw, f.afterSetup);
    const ready = preparePairedIxNexusSkillsBattle(f), offer = viewGame(ready, f.ixians).nexusSuboids!.offer!;
    reject(ready, f.tleilaxu, { type: 'nexusSuboids', event: offer.event });
    const active = beginPairedIxNexusSkillsCunning(f, ready);
    assert.deepEqual(player(active, f.ixians).forces, player(ready, f.ixians).forces);
    assert.deepEqual(player(active, f.ixians).elites, player(ready, f.ixians).elites);
    assert.equal(player(active, f.ixians).spice, player(ready, f.ixians).spice);
    assert.equal(active.nexusCards!.cards!.hands[f.ixians], null);
    reject(active, f.ixians, { type: 'nexusSuboids', event: offer.event });
    const revealed = revealPairedIxNexusSkillsBattle(f, { state: active });
    const quote = quotePairedIxNexusSkillsBattle(revealed);
    assert.equal(quote.result, 'normal'); assert.equal(quote.winner, f.ixians);
    assert.equal(quote.casualties!.forces.normalFixedHalf, false);
    assert.equal(quote.casualties!.forces.normalFreeSupport, true);
    const side = revealed.battle!.attacker === f.ixians ? 'attacker' : 'defender';
    assert.deepEqual(quote.leaderSkillBonuses[side].applied, [{ skill: 'warmaster', amount: band === 'skilled' ? 3 : 1, mode: band }]);
    assert.equal(quote.leaderStrengths[side], player(revealed, f.ixians).leaders.find(l => l.id === f.planActions[0].action.leader)!.strength);
    assert.ok(quote.casualties!.options.some(o => o.normal === 3 && o.elite === 0));
    if (advanced) {
      const ordinary = quotePairedIxNexusSkillsBattle(revealPairedIxNexusSkillsBattle(f));
      assert.ok(!ordinary.casualties!.options.some(o => o.normal === 3 && o.elite === 0));
      assert.equal(quote.payments.find(r => r.player === f.ixians)!.ownPayment, 0);
      assert.equal(quote.payments.find(r => r.player === f.ixians)!.bankSupport, 0);
    } else assert.deepEqual(quote.payments, []);
    const losses = finishPairedIxNexusSkillsBattle(revealed, 'losses');
    if (losses.decision?.kind !== 'battleLosses') throw Error('Missing actual typed winner casualties');
    const choice = losses.decision.options.findIndex(o => o.normal === 3 && o.elite === 0); assert.ok(choice >= 0);
    const settled = finishPairedIxNexusSkillsBattle(stepPairedIxNexusSkills(losses, { actor: f.ixians, action: { type: 'decision', choice } }));
    assert.equal(player(settled, f.ixians).forces[f.location], 3);
    assert.equal(player(settled, f.ixians).elites!.forces[f.location], 3);
    assert.equal(player(settled, f.ixians).tanks, player(revealed, f.ixians).tanks + 3);
    assert.equal(player(settled, f.ixians).elites!.tanks, player(revealed, f.ixians).elites!.tanks);
    assert.equal(player(settled, f.opponent).tanks, player(revealed, f.opponent).tanks + 6);
    money(revealed, settled); custody(settled, f.afterSetup);
  });

  void test(`original paired E1 ${advanced ? 'Advanced' : 'Basic'} ${band} Suk: physical rescue precedes equal Suboid substitution, paid once`, () => {
    const f = createPairedIxNexusSkillsFixture({ advanced, band, skill: 'suk-graduate' });
    const revealed = revealPairedIxNexusSkillsBattle(f, { cunning: true }), quote = quotePairedIxNexusSkillsBattle(revealed);
    assert.equal(quote.winner, f.ixians); assert.equal(quote.sukGraduate!.mode, band);
    if (advanced) {
      const payment = quote.payments.find(r => r.player === f.ixians)!;
      assert.equal(payment.ownPayment, 1); assert.equal(payment.bankSupport, 0);
    } else assert.deepEqual(quote.payments, []);
    const original = player(revealed, f.ixians);
    let selected = chooseCyborgLosses(revealed, f);
    let event = '', choice = 0;
    if (band === 'skilled') {
      const rescue = finishPairedIxNexusSkillsBattle(selected, 'rescue');
      if (rescue.decision?.kind !== 'sukRescue') throw Error('Missing original skilled Suk rescue');
      assert.equal(player(rescue, f.ixians).tanks, original.tanks, 'No physical losses occur before the skilled rescue choice');
      choice = rescue.decision.options.findIndex(o => o.normal === 0 && o.elite === 1 && o.kept?.kind === 'elite' && o.kept.key === f.location);
      assert.ok(choice >= 0); event = rescue.decision.event;
      selected = stepPairedIxNexusSkills(rescue, { actor: f.ixians, action: { type: 'decision', event, choice } });
    } else {
      assert.equal(selected.lastBattleContext!.sukRescue!.completed, true, 'The sole normal elite rescue is applied automatically');
    }
    const pending = finishPairedIxNexusSkillsBattle(selected, 'substitution');
    assert.equal(pending.decision?.kind, 'ixSubstitution');
    const p = player(pending, f.ixians);
    assert.equal(p.tanks, original.tanks + 2); assert.equal(p.elites!.tanks, original.elites!.tanks + 2);
    // User ruling 7 October 2026: rescued counters still count toward the
    // seven Kwisatz Haderach losses, so the counter gains every dialed casualty.
    assert.equal(p.battleLosses, original.battleLosses + 3);
    assert.equal(p.reserves, original.reserves + (band === 'normal' ? 1 : 0));
    assert.equal(p.elites!.reserves, original.elites!.reserves + (band === 'normal' ? 1 : 0));
    assert.equal(p.forces[f.location], band === 'normal' ? 3 : 4);
    assert.equal(p.elites!.forces[f.location] ?? 0, band === 'normal' ? 0 : 1);
    assert.equal(p.spice, original.spice - (advanced ? 1 : 0));
    reject(pending, f.ixians, { type: 'decision', event, choice });
    reject(pending, f.ixians, { type: 'decision', sources: { [f.location]: 2 }, recover: { [f.location]: 3 } });
    const exchanged = stepPairedIxNexusSkills(pending, { actor: f.ixians, action: { type: 'decision', sources: { [f.location]: 2 }, recover: { [f.location]: 2 } } });
    const settled = finishPairedIxNexusSkillsBattle(exchanged), after = player(settled, f.ixians);
    assert.equal(after.forces[f.location], p.forces[f.location]);
    assert.equal(after.elites!.forces[f.location], band === 'normal' ? 2 : 3);
    assert.equal(after.tanks, p.tanks, 'Equal physical exchange does not count the original Cyborg loss twice');
    assert.equal(after.elites!.tanks, original.elites!.tanks);
    assert.equal(after.battleLosses, p.battleLosses);
    assert.equal(after.reserves, p.reserves); assert.equal(after.elites!.reserves, p.elites!.reserves);
    assert.equal(settled.lastBattleContext!.sukRescue!.completed, true);
    assert.equal(settled.lastBattleContext!.ixSubstitution!.completed, true);
    money(revealed, settled); custody(settled, f.afterSetup);
  });
}

void test('own sealed plan blocks Cunning; active Suboids persist across real battles and expire at the actual next turn', () => {
  const f = createPairedIxNexusSkillsFixture({ skill: 'warmaster', dial: 3, support: 0, secondBattle: true });
  const prepared = preparePairedIxNexusSkillsBattle(f), offer = viewGame(prepared, f.ixians).nexusSuboids!.offer!;
  const sealed = stepPairedIxNexusSkills(prepared, f.planActions[0]);
  reject(sealed, f.ixians, { type: 'nexusSuboids', event: offer.event });
  const settled = finishPairedIxNexusSkillsBattle(revealPairedIxNexusSkillsBattle(f, { cunning: true }));
  const next = choosePairedIxNexusSkillsSecondBattle(f, settled);
  assert.equal(viewGame(next, f.ixians).nexusSuboids!.active, true);
  const unused = (actor: string) => player(next, actor).leaders.find(l => !l.dead && !l.usedAt &&
    !next.leaderSkills!.assignments.some(assignment => assignment.leader === l.id))!;
  const plans: PairedIxNexusSkillsStep[] = [
    { actor: f.ixians, action: { type: 'battlePlan', leader: unused(f.ixians).id, dial: 3, support: 0, weapon: null, defense: null } },
    { actor: f.opponent, action: { type: 'battlePlan', leader: unused(f.opponent).id, dial: 0, support: 0, weapon: null, defense: null } },
  ];
  const second = revealPairedIxNexusSkillsBattle(f, { state: next, plans });
  assert.equal(quotePairedIxNexusSkillsBattle(second).casualties!.forces.normalFreeSupport, true);
  const secondSettled = finishPairedIxNexusSkillsBattle(second), turn = finishPairedIxNexusSkillsTurn(secondSettled);
  assert.equal(viewGame(turn, f.ixians).nexusSuboids!.active, false);
  const expired = preparePairedIxNexusSkillsExpiryBattle(f, turn);
  const leader = player(expired, f.ixians).leaders.find(l => !l.dead &&
    !expired.leaderSkills!.assignments.some(assignment => assignment.leader === l.id))!;
  reject(expired, f.ixians, { type: 'battlePlan', leader: leader.id, dial: 3, support: 0, weapon: null, defense: null });
  const legal = stepPairedIxNexusSkills(expired, { actor: f.ixians, action: { type: 'battlePlan', leader: leader.id, dial: 1.5, support: 0, weapon: null, defense: null } });
  assert.equal(legal.battle!.plans[f.ixians].dial, 1.5); custody(legal, f.afterSetup);
});

for (const advanced of [false, true]) void test(`original paired ${advanced ? 'Advanced' : 'Basic'} Face Dance: Suk/card cleanup/rewards finish first; partial Cunning draws before retirement`, () => {
  const f = createPairedIxNexusSkillsFixture({ advanced, program: 'faceDance', skill: 'suk-graduate' });
  const revealed = revealPairedIxNexusSkillsBattle(f, { cunning: true }), quote = quotePairedIxNexusSkillsBattle(revealed);
  const enemy = player(revealed, f.opponent).leaders.find(l => l.id === f.planActions[1].action.leader)!;
  assert.deepEqual(quote.bounty, { player: f.ixians, amount: enemy.strength });
  const cards = finishPairedIxNexusSkillsBattle(revealed, 'cards');
  assert.equal(cards.decision?.kind, 'battleCards');
  assert.equal(cards.lastBattleContext!.sukRescue!.completed, true);
  const defense = f.planActions[0].action.defense as string;
  const cleaned = stepPairedIxNexusSkills(cards, { actor: f.ixians, action: { type: 'decision', discard: [defense] } });
  const pending = finishPairedIxNexusSkillsBattle(cleaned, 'faceDance');
  assert.ok(pending.discard.some(c => c.id === defense));
  assert.equal(player(pending, f.opponent).leaders.find(l => l.id === enemy.id)!.dead, true);
  money(revealed, pending);
  const winner = structuredClone(player(pending, f.ixians));
  const oldStock = structuredClone(player(pending, f.tleilaxu).faceDancers!);
  assert.ok(oldStock.some(c => c.leader === f.trainer && !c.revealed));
  reject(pending, f.tleilaxu, { type: 'decision', reveal: true, sources: { reserves: winner.forces[f.location] + 1 }, sector: territory(f.kind).sectors[0] });
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
  const view = viewGame(after, f.tleilaxu), offer = view.nexusTleilaxu!.cunning!;
  const action = nexusFaceDancersAction(view, offer.event); assert.ok(action);
  const reserve = [...after.traitorReserve!], allowance = replacement.faceDancerReplacedTurn;
  reject(after, f.tleilaxu, { ...action, leaders: [f.trainer] });
  const replaced = stepPairedIxNexusSkills(after, { actor: f.tleilaxu, action });
  assert.deepEqual(player(replaced, f.tleilaxu).faceDancers!.filter(c => untouched.some(old => old.leader === c.leader)), untouched);
  assert.deepEqual(player(replaced, f.tleilaxu).faceDancers!.filter(c => !untouched.some(old => old.leader === c.leader)), [{ leader: reserve[0], revealed: false }]);
  assert.notEqual(reserve[0], f.trainer);
  assert.deepEqual([...replaced.traitorReserve!].sort(), [...reserve.slice(1), f.trainer].sort());
  assert.equal(player(replaced, f.tleilaxu).faceDancerReplacedTurn, allowance);
  assert.equal(replaced.nexusCards!.cards!.hands[f.tleilaxu], null);
  reject(replaced, f.tleilaxu, action); custody(replaced, f.afterSetup);
  const mentat = advancePairedIxNexusSkills(replaced, g => g.phase === 8 && !g.phaseOpening && !g.response && !g.decision);
  const ordinary = stepPairedIxNexusSkills(mentat, { actor: f.tleilaxu, action: { type: 'replaceFaceDancer', leader: untouched[0].leader } });
  const done = advancePairedIxNexusSkills(ordinary, g => !g.response && !g.decision);
  assert.equal(player(done, f.tleilaxu).faceDancerReplacedTurn, done.turn);
  reject(done, f.tleilaxu, { type: 'replaceFaceDancer', leader: player(done, f.tleilaxu).faceDancers![0].leader });
  const turn = finishPairedIxNexusSkillsTurn(done);
  assert.equal(turn.leaderSkills!.deck.filter(s => s === f.skill).length, 1); custody(turn, f.afterSetup);
  if (advanced) {
    const revival = advancePairedIxNexusSkills(turn, g => g.phase === 4 && !g.phaseOpening && !g.response && !g.decision);
    reject(revival, f.tleilaxu, { type: 'reviveForeignGhola', leader: enemy.id });
    assert.equal(player(revival, f.opponent).leaders.find(l => l.id === enemy.id)!.gholaBy, undefined,
      'An actual dead foreign disc does not bypass the native five-living-leader ghola limit');
  }
});

void test('normal-band Face Dance selects a genuine matching untrained disc and cannot return its living trainer skill', () => {
  const f = createPairedIxNexusSkillsFixture({ program: 'faceDance', band: 'normal', skill: 'warmaster' });
  const selected = f.planActions[0].action.leader as string;
  assert.notEqual(selected, f.trainer);
  const original = structuredClone(player(f.afterSetup, f.tleilaxu).faceDancers!);
  assert.ok(original.some(c => c.leader === selected && !c.revealed));
  const revealed = revealPairedIxNexusSkillsBattle(f, { cunning: true });
  const quote = quotePairedIxNexusSkillsBattle(revealed);
  const side = revealed.battle!.attacker === f.ixians ? 'attacker' : 'defender';
  assert.deepEqual(quote.leaderSkillBonuses[side].applied, [{ skill: 'warmaster', amount: 1, mode: 'normal' }]);
  const pending = finishPairedIxNexusSkillsBattle(revealed, 'faceDance');
  assert.deepEqual(player(pending, f.tleilaxu).faceDancers, original);
  const after = dance(f, pending);
  assert.equal(player(after, f.ixians).leaders.find(l => l.id === selected)!.dead, true);
  assert.equal(player(after, f.ixians).leaders.find(l => l.id === f.trainer)!.dead, false);
  assert.deepEqual(after.leaderSkills!.assignments.find(a => a.owner === f.ixians),
    pending.leaderSkills!.assignments.find(a => a.owner === f.ixians));
  assert.equal(after.leaderSkills!.deck.includes('warmaster'), false);
  custody(after, f.afterSetup);
});

void test('native bot Face Dance uses original physical reserve/board sources after genuine skilled winner aftermath', () => {
  const f = createPairedIxNexusSkillsFixture({ program: 'faceDance', skill: 'suk-graduate' });
  const pending = finishPairedIxNexusSkillsBattle(revealPairedIxNexusSkillsBattle(f, { cunning: true }), 'faceDance');
  const view = viewGame(pending, f.tleilaxu); view.players.find(p => p.id === f.tleilaxu)!.bot = 'Easy';
  const action = botActions(view).find(a => a.type === 'decision'); assert.ok(action); assert.equal(action.reveal, true);
  const after = stepPairedIxNexusSkills(pending, { actor: f.tleilaxu, action });
  assert.equal(player(after, f.ixians).forces[f.location] ?? 0, 0);
  assert.equal(player(after, f.tleilaxu).forces[f.location], player(pending, f.ixians).forces[f.location]);
  assert.equal(after.leaderSkills!.assignments.some(a => a.leader === f.trainer), false);
  custody(after, f.afterSetup);
});

void test('authenticated original starting hands/offers continue without redeal; foreign leader assignment and absent requested skill are rejected', () => {
  const lobby = createGame('PAIREDIXSKILLSAUTH', newPlayer('http-ix', 'Ix', 'ixians'), true, ['ix']);
  for (const [id, faction] of [['http-tl', 'tleilaxu'], ['http-guild', 'guild'], ['http-emperor', 'emperor']] as const)
    joinGame(lobby, newPlayer(id, faction, faction));
  const fresh = createPairedIxNexusSkillsFixture({ initial: lobby, skill: 'warmaster' });
  const saved = structuredClone(fresh.offered), owner = player(saved, fresh.ixians);
  assert.ok(owner.hand.length > 0); assert.ok(Object.keys(saved.leaderSkills!.offers).length > 0);
  const offer = saved.leaderSkills!.offers[fresh.ixians], foreign = player(saved, fresh.opponent).leaders[0];
  reject(saved, fresh.ixians, { type: 'leaderSkill', event: offer.event, skill: 'warmaster', leader: foreign.id });
  const unavailable = LEADER_SKILL_CARDS.find(c => !offer.cards.includes(c.id))!.id;
  assert.throws(() => createPairedIxNexusSkillsFixture({ initial: saved, skill: unavailable }));
  const continued = createPairedIxNexusSkillsFixture({ initial: saved, skill: 'warmaster' });
  assert.deepEqual(continued.initial, saved);
  assert.deepEqual(continued.afterSetup.players.map(p => [p.id, p.hand]), saved.players.map(p => [p.id, p.hand]));
  assert.deepEqual(continued.offered.leaderSkills!.offers, saved.leaderSkills!.offers);
  assert.equal(continued.ixians, 'http-ix'); assert.equal(continued.tleilaxu, 'http-tl');
  assert.equal(continued.afterNexusDraw.nexusCards!.cards!.hands['http-ix'], 'ixians');
  assert.equal(continued.afterNexusDraw.nexusCards!.cards!.hands['http-tl'], 'tleilaxu');
  custody(continued.afterNexusDraw, continued.afterSetup);
});
