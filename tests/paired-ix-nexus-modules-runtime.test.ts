import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { MOBILE_STRONGHOLD, territory } from '../game/board';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { nexusFaceDancersAction } from '../game/nexus-tleilaxu-options';
import { ownedTech } from '../game/tech-tokens';
import { strongholdBenefit, strongholdControllers } from '../game/stronghold-cards';
import { quoteStrongholdFactionsBattle } from './fixture-stronghold-factions';
import {
  advancePairedIxNexusModules, choosePairedIxMobileBattle, createPairedIxNexusModulesFixture,
  finishPairedIxNexusModulesBattle, finishPairedIxNexusModulesTurn, pairedIxNexusModulesPlayer as player,
  preparePairedIxExpiryBattle, revealPairedIxNexusModulesBattle, type PairedIxNexusModulesFixture,
  type PairedIxNexusModulesStep,
} from './fixture-paired-ix-nexus-modules';

function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'An illegal consumer action cannot spend the original singleton, forces or spice');
}
function inventory(game: Game) {
  return [...game.deck, ...game.discard, ...(game.ixSetupCards ?? []), ...(game.ixAuction?.cards ?? []),
    ...(game.auction?.cards.slice(game.auction.index) ?? []), ...game.players.flatMap(p => p.hand)].map(c => c.id).sort();
}
function custody(game: Game, original: Game) {
  assert.deepEqual(inventory(game), inventory(original));
  for (const p of game.players) {
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((sum, n) => sum + n, 0), 20, p.faction);
    if (p.elites) {
      const old = player(original, p.id).elites!;
      assert.equal(p.elites.reserves + p.elites.tanks + Object.values(p.elites.forces).reduce((sum, n) => sum + n, 0),
        old.reserves + old.tanks + Object.values(old.forces).reduce((sum, n) => sum + n, 0));
      for (const [key, count] of Object.entries(p.elites.forces)) assert.ok(count <= (p.forces[key] ?? 0));
    }
  }
  const traitors = [...(game.traitorReserve ?? []), ...game.players.flatMap(p => [...p.traitors, ...(p.faceDancers ?? []).map(c => c.leader)])].sort();
  const originalTraitors = [...(original.traitorReserve ?? []), ...original.players.flatMap(p => [...p.traitors, ...(p.faceDancers ?? []).map(c => c.leader)])].sort();
  assert.deepEqual(traitors, originalTraitors);
  assert.equal(new Set(traitors).size, traitors.length);
}
function reward(f: PairedIxNexusModulesFixture, game: Game) {
  assert.equal(game.lastBattleContext!.winner, f.ixians);
  if (f.game.techTokens) {
    const token = ownedTech(f.game.techTokens, f.opponent);
    assert.equal(token.length, 1);
    assert.equal(game.techTokens![token[0]].owner, f.ixians);
    assert.equal(game.techTokens![token[0]].spice, f.game.techTokens![token[0]].spice);
    assert.equal(ownedTech(game.techTokens, f.opponent).length, 0);
  }
}
function money(revealed: Game, settled: Game) {
  const quote = quoteStrongholdFactionsBattle(revealed);
  const collection = settled.phase === 7 && !settled.phaseOpening ? quoteSpiceCollection(settled).receipts : [];
  for (const p of revealed.players) {
    const payment = quote.payments.find(r => r.player === p.id)?.ownPayment ?? 0;
    const income = quote.strongholdIncome.filter(r => r.player === p.id).reduce((sum, r) => sum + r.amount, 0);
    const bounty = quote.bounty?.player === p.id ? quote.bounty.amount : 0;
    const city = collection.filter(r => r.player === p.id).reduce((sum, r) => sum + r.collected + r.strongholds, 0);
    assert.equal(player(settled, p.id).spice, p.spice - payment + income + bounty + city, p.faction);
  }
  return quote;
}
function useSuboids(f: PairedIxNexusModulesFixture): Game {
  const offer = viewGame(f.game, f.ixians).nexusSuboids!.offer!;
  assert.equal(offer.blocked, null);
  reject(f.game, f.tleilaxu, { type: 'nexusSuboids', event: offer.event });
  const game = applyAction(f.game, f.ixians, { type: 'nexusSuboids', event: offer.event });
  assert.equal(game.nexusCards!.cards!.hands[f.ixians], null);
  assert.equal(game.nexusCards!.cards!.discard.filter(face => face === 'ixians').length, 1);
  assert.equal(player(game, f.ixians).spice, player(f.game, f.ixians).spice);
  assert.deepEqual(player(game, f.ixians).forces, player(f.game, f.ixians).forces);
  assert.deepEqual(player(game, f.ixians).elites, player(f.game, f.ixians).elites);
  reject(game, f.ixians, { type: 'nexusSuboids', event: offer.event });
  return game;
}

for (const mode of [
  { advanced: false, tech: true, strongholds: false },
  { advanced: true, tech: true, strongholds: false },
  { advanced: true, tech: false, strongholds: true },
  { advanced: true, tech: true, strongholds: true },
]) void test(`paired E1 ${JSON.stringify(mode)}: original Nx Cunning, exact cyborg losses, equal substitution and held-site support`, () => {
  const f = createPairedIxNexusModulesFixture(mode);
  assert.equal(f.afterNexusDraw.nexusCards!.cards!.hands[f.ixians], 'ixians');
  assert.equal(f.afterNexusDraw.nexusCards!.cards!.hands[f.tleilaxu], 'tleilaxu');
  assert.equal(player(f.afterNexusDraw, f.partners[0]).ally, f.partners[1]);
  assert.equal(player(f.afterNexusDraw, f.ixians).ally, null);
  if (mode.strongholds) {
    assert.equal(f.afterFirstMentat.strongholdCards!.owners.arrakeen, f.ixians);
    assert.equal(f.afterFirstMentat.strongholdCards!.owners[MOBILE_STRONGHOLD], f.ixians);
  }
  const game = useSuboids(f);
  const revealed = revealPairedIxNexusModulesBattle(game, f.planActions);
  const quote = quoteStrongholdFactionsBattle(revealed);
  assert.equal(quote.winner, f.ixians);
  assert.equal(quote.casualties!.forces.normalFixedHalf, false);
  assert.equal(quote.casualties!.forces.normalFreeSupport, true);
  const payment = quote.payments.find(r => r.player === f.ixians)!;
  if (mode.advanced) {
    assert.equal(payment.bankSupport, mode.strongholds ? 1 : 0);
    assert.equal(payment.ownPayment, mode.strongholds ? 0 : 1);
  } else {
    assert.deepEqual(quote.payments, [], 'Basic battles create no spice-support payment receipts');
  }
  let losses = advancePairedIxNexusModules(revealed, g => g.decision?.kind === 'battleLosses' || g.decision?.kind === 'ixSubstitution');
  if (losses.decision?.kind === 'battleLosses') {
    const choice = losses.decision.options.findIndex(o => o.normal === 0 && o.elite === 3);
    assert.ok(choice >= 0, 'The actual committed dial can lose exactly the three original cyborgs');
    losses = applyAction(losses, f.ixians, { type: 'decision', choice });
  }
  const pending = advancePairedIxNexusModules(losses, g => g.decision?.kind === 'ixSubstitution');
  assert.equal(player(pending, f.ixians).forces[f.location], 3);
  assert.equal(player(pending, f.ixians).elites!.forces[f.location] ?? 0, 0);
  assert.equal(player(pending, f.ixians).tanks, player(revealed, f.ixians).tanks + 3);
  assert.equal(player(pending, f.ixians).elites!.tanks, 3);
  assert.equal(player(pending, f.ixians).spice, player(revealed, f.ixians).spice - (mode.advanced ? payment.ownPayment : 0));
  assert.deepEqual(pending.techTokens, revealed.techTokens, 'Native substitution precedes the actual loser Tech award');
  reject(pending, f.ixians, { type: 'decision', sources: { [f.location]: 3 }, recover: { [f.location]: 4 } });
  const exchanged = applyAction(pending, f.ixians, { type: 'decision', sources: { [f.location]: 3 }, recover: { [f.location]: 3 } });
  const settled = finishPairedIxNexusModulesBattle(exchanged);
  assert.equal(player(settled, f.ixians).forces[f.location], 3);
  assert.equal(player(settled, f.ixians).elites!.forces[f.location], 3);
  assert.equal(player(settled, f.ixians).tanks, player(revealed, f.ixians).tanks + 3);
  assert.equal(player(settled, f.ixians).elites!.tanks, 0);
  assert.equal(player(settled, f.opponent).tanks, player(revealed, f.opponent).tanks + 6);
  money(revealed, settled); reward(f, settled); custody(settled, f.afterSetup);

  // A second real battle in the original turn uses the spent card's effect.
  const mobile = choosePairedIxMobileBattle(settled, f.ixians, f.opponent);
  assert.equal(viewGame(mobile, f.ixians).nexusSuboids!.active, true);
  if (mode.strongholds) assert.equal(viewGame(mobile, f.ixians).battle!.strongholdEffects[f.ixians], 'arrakeen');
  const leader = player(mobile, f.ixians).leaders.filter(l => !l.dead && !l.usedAt).sort((a, b) => b.strength - a.strength)[0];
  const enemy = player(mobile, f.opponent).leaders.filter(l => !l.dead && !l.usedAt).sort((a, b) => a.strength - b.strength)[0];
  const plans: PairedIxNexusModulesStep[] = [
    { actor: f.ixians, action: { type: 'battlePlan', dial: 3, support: mode.advanced ? 1 : 0, leader: leader.id, weapon: null, defense: null } },
    { actor: f.opponent, action: { type: 'battlePlan', dial: 0, support: 0, leader: enemy.id, weapon: null, defense: null } },
  ];
  const second = revealPairedIxNexusModulesBattle(mobile, plans), secondQuote = quoteStrongholdFactionsBattle(second);
  assert.equal(secondQuote.casualties!.forces.normalFixedHalf, false);
  assert.equal(secondQuote.casualties!.forces.normalFreeSupport, true);
  if (mode.advanced) {
    const own = secondQuote.payments.find(r => r.player === f.ixians)!;
    assert.equal(own.bankSupport, mode.strongholds ? 1 : 0);
    assert.equal(own.ownPayment, mode.strongholds ? 0 : 1);
  } else assert.deepEqual(secondQuote.payments, []);
  let secondLosses = advancePairedIxNexusModules(second, g => g.decision?.kind === 'battleLosses' || g.decision?.kind === 'ixSubstitution');
  if (secondLosses.decision?.kind === 'battleLosses') {
    const choice = secondLosses.decision.options.findIndex(o => o.normal === 1 && o.elite === 1);
    assert.ok(choice >= 0);
    secondLosses = applyAction(secondLosses, f.ixians, { type: 'decision', choice });
  }
  const secondSettled = finishPairedIxNexusModulesBattle(secondLosses);
  money(second, secondSettled); custody(secondSettled, f.afterSetup);
  const nextTurn = finishPairedIxNexusModulesTurn(secondSettled);
  assert.equal(viewGame(nextTurn, f.ixians).nexusSuboids!.active, false);
  const expired = preparePairedIxExpiryBattle(nextTurn, f.ixians, f.tleilaxu);
  const expiredLeader = player(expired, f.ixians).leaders.find(l => !l.dead)!;
  reject(expired, f.ixians, { type: 'battlePlan', dial: 3, support: 0, leader: expiredLeader.id, weapon: null, defense: null });
  const sealed = applyAction(expired, f.ixians, { type: 'battlePlan', dial: 1.5, support: 0, leader: expiredLeader.id, weapon: null, defense: null });
  assert.equal(sealed.battle!.plans[f.ixians].dial, 1.5);
  custody(sealed, f.afterSetup);
});

void test('native paired Cunning requires an own unsealed plan and grants full unsupported Suboid casualties, not force manufacture', () => {
  const f = createPairedIxNexusModulesFixture({ advanced: true, strongholds: false });
  const offer = viewGame(f.game, f.ixians).nexusSuboids!.offer!;
  const sealed = applyAction(f.game, f.ixians, f.planActions[0].action);
  reject(sealed, f.ixians, { type: 'nexusSuboids', event: offer.event });
  const plans = structuredClone(f.planActions);
  plans[0].action.dial = 3; plans[0].action.support = 0;
  const empowered = revealPairedIxNexusModulesBattle(useSuboids(f), plans);
  const ordinary = revealPairedIxNexusModulesBattle(f.game, plans);
  const full = quoteStrongholdFactionsBattle(empowered), half = quoteStrongholdFactionsBattle(ordinary);
  assert.ok(full.casualties!.options.some(o => o.normal === 3 && o.elite === 0));
  assert.ok(!half.casualties!.options.some(o => o.normal === 3 && o.elite === 0));
  assert.equal(full.payments.find(r => r.player === f.ixians)!.ownPayment, 0);
  assert.deepEqual(player(empowered, f.ixians).forces, player(ordinary, f.ixians).forces);
  assert.deepEqual(player(empowered, f.ixians).elites, player(ordinary, f.ixians).elites);
  const losses = advancePairedIxNexusModules(empowered, g => g.decision?.kind === 'battleLosses');
  assert.equal(losses.decision!.kind, 'battleLosses');
  if (losses.decision?.kind !== 'battleLosses') throw Error('Missing native Suboid casualty decision');
  const choice = losses.decision.options.findIndex(o => o.normal === 3 && o.elite === 0);
  assert.ok(choice >= 0);
  const paid = applyAction(losses, f.ixians, { type: 'decision', choice });
  const settled = finishPairedIxNexusModulesBattle(paid);
  assert.equal(player(settled, f.ixians).forces[f.location], 3);
  assert.equal(player(settled, f.ixians).elites!.forces[f.location], 3);
  assert.equal(player(settled, f.ixians).tanks, player(empowered, f.ixians).tanks + 3);
  assert.equal(player(settled, f.ixians).elites!.tanks, player(empowered, f.ixians).elites!.tanks);
  money(empowered, settled); reward(f, settled); custody(settled, f.afterSetup);
});

void test('paired native Face Dance preserves original winner rewards, cards and Tech, then claims Stronghold at actual END Mentat; partial-stock Cunning draws before retiring originals', () => {
  const f = createPairedIxNexusModulesFixture({ program: 'faceDance', advanced: true, tech: true, strongholds: true });
  const revealed = revealPairedIxNexusModulesBattle(f.game, f.planActions);
  const pending = advancePairedIxNexusModules(revealed, g => g.decision?.kind === 'faceDance');
  const quote = money(revealed, pending);
  assert.deepEqual(quote.strongholdIncome, [{ player: f.ixians, amount: 1 }]);
  assert.equal(quote.bounty!.player, f.ixians);
  reward(f, pending);
  const winner = player(pending, f.ixians), survivorCount = winner.forces[f.location];
  const elite = winner.elites!.forces[f.location] ?? 0;
  for (const id of [f.planActions[0].action.weapon, f.planActions[0].action.defense]) assert.ok(winner.hand.some(c => c.id === id));
  const dancerBefore = structuredClone(player(pending, f.tleilaxu).faceDancers!);
  assert.ok(dancerBefore.every(c => !c.revealed));
  reject(pending, f.tleilaxu, { type: 'decision', reveal: true, sources: { reserves: survivorCount + 1 }, sector: territory(f.kind).sectors[0] });
  const after = applyAction(pending, f.tleilaxu, { type: 'decision', reveal: true, sources: { [f.replacementSource]: 2, reserves: survivorCount - 2 }, sector: territory(f.kind).sectors[0] });
  const returned = player(after, f.ixians), replacement = player(after, f.tleilaxu);
  assert.equal(returned.forces[f.location] ?? 0, 0);
  assert.equal(returned.elites!.forces[f.location] ?? 0, 0);
  assert.equal(returned.reserves, winner.reserves + survivorCount);
  assert.equal(returned.elites!.reserves, winner.elites!.reserves + elite);
  assert.equal(returned.tanks, winner.tanks); assert.equal(returned.elites!.tanks, winner.elites!.tanks);
  assert.equal(returned.spice, winner.spice); assert.deepEqual(returned.hand, winner.hand);
  assert.deepEqual(after.techTokens, pending.techTokens);
  assert.equal(replacement.forces[f.location], survivorCount);
  assert.equal(replacement.forces[f.replacementSource], 1);
  assert.equal(replacement.reserves, player(pending, f.tleilaxu).reserves - survivorCount + 2);
  assert.equal(strongholdControllers(after.players, true)[f.kind], f.tleilaxu);
  assert.equal(strongholdBenefit(after.strongholdCards, f.ixians, f.kind), f.kind);
  assert.equal(strongholdBenefit(after.strongholdCards, f.tleilaxu, f.kind), null);
  assert.equal(returned.leaders.find(l => l.id === f.planActions[0].action.leader)!.dead, true);
  const revealedStock = replacement.faceDancers!.filter(c => c.revealed);
  assert.equal(revealedStock.length, 1, 'Partial stock comes only from the actual successful Face Dance');
  const untouched = replacement.faceDancers!.filter(c => !c.revealed);
  assert.deepEqual(untouched, dancerBefore.filter(c => c.leader !== revealedStock[0].leader));
  const beforeDraw = [...after.traitorReserve!], allowance = replacement.faceDancerReplacedTurn;
  const view = viewGame(after, f.tleilaxu), offer = view.nexusTleilaxu!.cunning!;
  const action = nexusFaceDancersAction(view, offer.event); assert.ok(action);
  reject(after, f.tleilaxu, { ...action, leaders: [revealedStock[0].leader] });
  const replaced = applyAction(after, f.tleilaxu, action);
  const finalStock = player(replaced, f.tleilaxu).faceDancers!;
  assert.deepEqual(finalStock.filter(c => untouched.some(old => old.leader === c.leader)), untouched);
  assert.deepEqual(finalStock.filter(c => !untouched.some(old => old.leader === c.leader)), [{ leader: beforeDraw[0], revealed: false }]);
  assert.ok(!revealedStock.some(c => c.leader === beforeDraw[0]), 'Set-aside originals cannot be their own immediate draw');
  assert.deepEqual([...replaced.traitorReserve!].sort(), [...beforeDraw.slice(1), revealedStock[0].leader].sort());
  assert.equal(player(replaced, f.tleilaxu).faceDancerReplacedTurn, allowance);
  assert.equal(replaced.nexusCards!.cards!.hands[f.tleilaxu], null);
  assert.equal(replaced.nexusCards!.cards!.discard.filter(face => face === 'tleilaxu').length, 1);
  assert.deepEqual(replaced.techTokens, after.techTokens);
  reject(replaced, f.tleilaxu, action);
  custody(replaced, f.afterSetup);
  const mentat = advancePairedIxNexusModules(replaced, g => g.phase === 8 && !g.phaseOpening && !g.response && !g.decision);
  const ordinary = applyAction(mentat, f.tleilaxu, { type: 'replaceFaceDancer', leader: untouched[0].leader });
  const settled = advancePairedIxNexusModules(ordinary, g => !g.response && !g.decision);
  assert.equal(player(settled, f.tleilaxu).faceDancerReplacedTurn, settled.turn);
  reject(settled, f.tleilaxu, { type: 'replaceFaceDancer', leader: player(settled, f.tleilaxu).faceDancers![0].leader });
  const claimed = finishPairedIxNexusModulesTurn(settled);
  assert.equal(claimed.strongholdCards!.owners[f.kind], f.tleilaxu);
  assert.deepEqual(claimed.techTokens, after.techTokens);
  custody(claimed, f.afterSetup);
});

void test('representative native bot Face Dance consumes only actual paired reserve/board sources', () => {
  const f = createPairedIxNexusModulesFixture({ program: 'faceDance' });
  const pending = advancePairedIxNexusModules(revealPairedIxNexusModulesBattle(f.game, f.planActions), g => g.decision?.kind === 'faceDance');
  const view = viewGame(pending, f.tleilaxu);
  view.players.find(p => p.id === f.tleilaxu)!.bot = 'Easy';
  const action = botActions(view).find(a => a.type === 'decision'); assert.ok(action);
  assert.equal(action.reveal, true);
  const after = applyAction(pending, f.tleilaxu, action);
  assert.equal(player(after, f.ixians).forces[f.location] ?? 0, 0);
  assert.equal(player(after, f.tleilaxu).forces[f.location], player(pending, f.ixians).forces[f.location]);
  assert.deepEqual(after.techTokens, pending.techTokens);
  custody(after, f.afterSetup);
});

void test('original authenticated lobby and undealt CLI setup continue to actor-bound real Nexus Cunning without redealing', () => {
  const lobby = createGame('PAIREDIXAUTH', newPlayer('authenticated-ix', 'Ix', 'ixians'), true, ['ix']);
  for (const [id, faction] of [['authenticated-tl', 'tleilaxu'], ['authenticated-guild', 'guild'], ['authenticated-emperor', 'emperor']] as const)
    joinGame(lobby, newPlayer(id, faction, faction));
  const first = createPairedIxNexusModulesFixture({ initial: lobby, tech: true, strongholds: false });
  const continued = createPairedIxNexusModulesFixture({ initial: first.initial });
  assert.deepEqual(player(continued.afterSetup, first.ixians).hand, player(first.afterSetup, first.ixians).hand,
    'The original Ix setup offer and actual first deal are continued, not replaced');
  const empowered = useSuboids(continued);
  const revealed = revealPairedIxNexusModulesBattle(empowered, continued.planActions);
  assert.equal(quoteStrongholdFactionsBattle(revealed).winner, 'authenticated-ix');
  assert.equal(revealed.nexusSuboidHistory![0].owner, 'authenticated-ix');
  assert.equal(player(revealed, 'authenticated-tl').ally, null);
  custody(revealed, continued.afterSetup);
});
