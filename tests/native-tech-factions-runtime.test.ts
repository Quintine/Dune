import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction, createGame, initializeFactionExpansionsGameForAudit,
  initializeStrongholdFactionsGameForAudit, joinGame, newPlayer, viewGame, type Action, type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { territory } from '../game/board';
import type { FactionId } from '../game/catalog';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { createLeaderSkills } from '../game/leader-skills';
import { ownedTech, TECH_TOKENS } from '../game/tech-tokens';
import { presenceAt } from '../game/force-presence';
import { strongholdBenefit, strongholdControllers } from '../game/stronghold-cards';
import { quoteStrongholdFactionsBattle } from './fixture-stronghold-factions';
import {
  advanceNativeTechFactions, createNativeTechFactionsFixture, finishNativeTechFactionsBattle,
  finishNativeTechFactionsTurn, nativeTechFactionsPlayer as player, revealNativeTechFactionsBattle,
  type NativeTechFactionsFixture,
} from './fixture-native-tech-factions';

function lobby(factions: FactionId[], expansions = ['ix'], advanced = true): Game {
  let game = createGame('NATIVETECHBOUNDARY', newPlayer('seat-0', factions[0], factions[0]), advanced, expansions);
  for (let n = 1; n < factions.length; n++) joinGame(game, newPlayer(`seat-${n}`, factions[n], factions[n]));
  game = applyAction(game, game.host, { type: 'techTokens', enabled: true });
  for (const p of game.players) game = applyAction(game, p.id, { type: 'ready' });
  return game;
}
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'Rejected native decisions cannot consume counters, cards, tokens or money');
}
function inventory(game: Game) {
  return [...game.deck, ...game.discard, ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []), ...(game.ixSetupCards ?? []),
    ...(game.ixAuction?.cards ?? []), ...(game.auction?.cards.slice(game.auction.index) ?? []),
    ...game.players.flatMap(p => p.hand)].map(c => c.id).sort();
}
function custody(game: Game, original: Game) {
  assert.deepEqual(inventory(game), inventory(original), 'Every original physical card retains exactly one custody location');
  for (const p of game.players) {
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0), 20, p.faction);
    if (p.elites) {
      const originalElite = player(original, p.id).elites!;
      const total = originalElite.reserves + originalElite.tanks + Object.values(originalElite.forces).reduce((a, b) => a + b, 0);
      assert.equal(p.elites.reserves + p.elites.tanks + Object.values(p.elites.forces).reduce((a, b) => a + b, 0), total);
      for (const [key, n] of Object.entries(p.elites.forces)) assert.ok(n <= (p.forces[key] ?? 0));
    }
  }
}
function money(revealed: Game, resolved: Game) {
  const quote = quoteStrongholdFactionsBattle(revealed);
  const collection = resolved.phase === 7 && !resolved.phaseOpening
    ? quoteSpiceCollection(resolved).receipts : [];
  for (const p of revealed.players) {
    const payment = quote.payments.find(r => r.player === p.id)?.ownPayment ?? 0;
    const stronghold = quote.strongholdIncome.filter(r => r.player === p.id).reduce((a, r) => a + r.amount, 0);
    const bounty = quote.bounty?.player === p.id ? quote.bounty.amount : 0;
    const choam = quote.choamIncome?.owner === p.id ? quote.choamIncome.amount : 0;
    const collected = collection.filter(r => r.player === p.id).reduce((a, r) => a + r.strongholds + r.collected, 0);
    assert.equal(player(resolved, p.id).spice, p.spice - payment + stronghold + bounty + choam + collected, p.faction);
  }
  return quote;
}
function award(fixture: NativeTechFactionsFixture, game: Game) {
  const tokens = ownedTech(fixture.game.techTokens, fixture.opponent);
  assert.equal(tokens.length, 1, 'Actual three-seat first Storm gives the loser one native token');
  assert.equal(game.lastBattleContext!.winner, fixture.owner);
  assert.equal(game.techTokens![tokens[0]].owner, fixture.owner);
  assert.equal(ownedTech(game.techTokens, fixture.owner).length, 2);
  assert.equal(ownedTech(game.techTokens, fixture.opponent).length, 0);
  assert.equal(game.techTokens![tokens[0]].spice, fixture.game.techTokens![tokens[0]].spice, 'Reward changes custody, not bank receipts');
}

void test('native Tech seats three through six complete actual Basic/Advanced setup and first Storm with three distinct physical recipients', () => {
  const factions: FactionId[] = ['ixians', 'tleilaxu', 'emperor', 'fremen', 'guild', 'harkonnen'];
  for (const advanced of [false, true]) for (let count = 3; count <= 6; count++) {
    const setup = initializeFactionExpansionsGameForAudit(lobby(factions.slice(0, count), ['ix'], advanced));
    const storm = advanceNativeTechFactions(setup, g => g.status === 'playing' && g.phase === 1 && !g.phaseOpening && !g.response && !g.decision);
    assert.equal(storm.techTokens!.heighliners.owner, storm.players.find(p => p.faction === 'ixians')!.id);
    assert.equal(storm.techTokens!.axlotl.owner, storm.players.find(p => p.faction === 'tleilaxu')!.id);
    const recipients = TECH_TOKENS.map(t => storm.techTokens![t.id].owner);
    assert.equal(new Set(recipients).size, 3);
    assert.ok(recipients.every(id => storm.players.some(p => p.id === id)));
  }
});

void test('native Tech rejects below-three, missing-family, wrong-deck and already-owned inventory without dealing', () => {
  const invalid = [
    lobby(['ixians', 'guild']),
    lobby(['emperor', 'fremen', 'guild']),
    lobby(['ixians', 'emperor', 'guild'], ['choam']),
  ];
  const owned = lobby(['ixians', 'emperor', 'guild']);
  owned.techTokens!.production.owner = owned.host; invalid.push(owned);
  for (const game of invalid) {
    const before = structuredClone(game);
    assert.throws(() => initializeFactionExpansionsGameForAudit(game));
    assert.throws(() => initializeStrongholdFactionsGameForAudit(game));
    assert.deepEqual(game, before);
  }
});

void test('Advanced Stronghold constraint and unrelated modules stay excluded from both native Tech initializers', () => {
  const basic = lobby(['ixians', 'choam', 'guild'], ['ix', 'choam'], false);
  reject(basic, basic.host, { type: 'strongholdCards', enabled: true });
  assert.throws(() => initializeStrongholdFactionsGameForAudit(basic), /Advanced/);
  const overlays: ((g: Game) => void)[] = [
    g => { g.leaderSkills = createLeaderSkills(() => 0.5); },
    g => { g.homeworlds = { custody: null }; },
    g => { g.nexusCards = { cards: null, phase: null }; },
    g => { g.discoveryEnabled = true; },
    g => { g.ecazTreachery = true; },
    g => { g.semutaPreview = true; },
  ];
  for (const overlay of overlays) {
    const game = lobby(['ixians', 'choam', 'guild'], ['ix', 'choam']); overlay(game);
    const before = structuredClone(game);
    assert.throws(() => initializeFactionExpansionsGameForAudit(game));
    assert.throws(() => initializeStrongholdFactionsGameForAudit(game));
    assert.deepEqual(game, before);
  }
});

for (const strongholds of [false, true]) void test(`${strongholds ? 'Advanced Stronghold+Tech' : 'Advanced Tech'} Ix: actual support, cyborg casualties, equal physical substitution and original loser token reward`, () => {
  const fixture = createNativeTechFactionsFixture({ strongholds });
  const revealed = revealNativeTechFactionsBattle(fixture), quote = quoteStrongholdFactionsBattle(revealed);
  assert.equal(quote.winner, fixture.owner);
  assert.equal(quote.casualties!.forces.normalFixedHalf, true);
  assert.ok(quote.casualties!.options.every(o => o.normal === 0 && o.elite === 3));
  const payment = quote.payments.find(p => p.player === fixture.owner)!;
  assert.equal(payment.bankSupport, strongholds ? 2 : 0);
  assert.equal(payment.ownPayment, strongholds ? 1 : 3);
  const pending = advanceNativeTechFactions(revealed, g => g.decision?.kind === 'ixSubstitution');
  assert.equal(player(pending, fixture.owner).tanks, 3);
  assert.equal(player(pending, fixture.owner).elites!.tanks, 3);
  assert.equal(player(pending, fixture.owner).forces[fixture.location], 3);
  assert.equal(player(pending, fixture.owner).elites!.forces[fixture.location] ?? 0, 0);
  assert.equal(player(pending, fixture.owner).spice, player(revealed, fixture.owner).spice - payment.ownPayment);
  assert.deepEqual(ownedTech(pending.techTokens, fixture.opponent), ownedTech(revealed.techTokens, fixture.opponent), 'Substitution precedes original Tech award');
  reject(pending, fixture.owner, { type: 'decision', sources: { [fixture.location]: 3 }, recover: { [fixture.location]: 4 } });
  reject(pending, fixture.opponent, { type: 'decision', sources: { [fixture.location]: 3 }, recover: { [fixture.location]: 3 } });
  const exchanged = applyAction(pending, fixture.owner, { type: 'decision', sources: { [fixture.location]: 3 }, recover: { [fixture.location]: 3 } });
  const resolved = finishNativeTechFactionsBattle(exchanged);
  assert.equal(player(resolved, fixture.owner).forces[fixture.location], 3);
  assert.equal(player(resolved, fixture.owner).elites!.forces[fixture.location], 3);
  assert.equal(player(resolved, fixture.owner).tanks, 3, 'Three sacrificed suboids replace three recovered cyborgs, not extra counters');
  assert.equal(player(resolved, fixture.owner).elites!.tanks, 0);
  assert.equal(player(resolved, fixture.opponent).tanks, 6);
  money(revealed, resolved); award(fixture, resolved); custody(resolved, fixture.initial);
  if (strongholds) {
    assert.equal(fixture.afterFirstMentat!.strongholdCards!.owners.arrakeen, fixture.owner);
    assert.equal(resolved.strongholdCards!.owners.arrakeen, fixture.owner);
    const mentat = finishNativeTechFactionsTurn(resolved);
    assert.equal(mentat.strongholdCards!.owners.arrakeen, fixture.owner);
    custody(mentat, fixture.initial);
  }
});

void test('CHOAM Stronghold+Tech: own paid support is debited, only opponent bank support earns CHOAM income, and the winner gets the original token', () => {
  const fixture = createNativeTechFactionsFixture({ ownerFaction: 'choam' });
  const revealed = revealNativeTechFactionsBattle(fixture), resolved = finishNativeTechFactionsBattle(revealed);
  const quote = money(revealed, resolved), payment = quote.payments.find(p => p.player === fixture.owner)!;
  assert.equal(payment.cost, 1); assert.equal(payment.bankSupport, 2); assert.equal(payment.ownPayment, 1);
  assert.deepEqual(quote.choamIncome, { owner: fixture.owner, amount: 1 });
  assert.equal(quote.payments.find(p => p.player === fixture.opponent)!.ownPayment, 2);
  assert.equal(player(resolved, fixture.owner).tanks, 3);
  assert.equal(player(resolved, fixture.owner).forces[fixture.location], 3);
  award(fixture, resolved); custody(resolved, fixture.initial);
  assert.equal(finishNativeTechFactionsTurn(resolved).strongholdCards!.owners.arrakeen, fixture.owner);
});

void test('Richese Stronghold+Tech: real one-spice marker shipment and post-plan five-force materialization retain Habbanya and award the loser token', () => {
  const fixture = createNativeTechFactionsFixture({ family: 'richese' });
  const shipped = player(fixture.afterShipment!, fixture.owner), payer = player(fixture.beforeShipment!, fixture.owner);
  assert.equal(shipped.spice, payer.spice - 1); assert.equal(shipped.reserves, payer.reserves);
  assert.equal(presenceAt(shipped, fixture.kind), 1);
  assert.equal(fixture.afterFirstMentat!.strongholdCards!.owners[fixture.kind], fixture.owner);
  const sealed = applyAction(fixture.game, fixture.owner, fixture.planActions[0].action);
  assert.ok(player(sealed, fixture.owner).noField!.deployed);
  assert.equal(player(sealed, fixture.owner).forces[fixture.location], undefined);
  const revealed = revealNativeTechFactionsBattle(fixture);
  assert.equal(player(revealed, fixture.owner).noField!.deployed, null);
  assert.equal(player(revealed, fixture.owner).forces[fixture.location], 5);
  const resolved = finishNativeTechFactionsBattle(revealed), quote = money(revealed, resolved);
  assert.equal(quote.payments.find(p => p.player === fixture.owner)!.ownPayment, 1);
  assert.equal(player(resolved, fixture.owner).tanks, 1);
  assert.equal(player(resolved, fixture.owner).forces[fixture.location], 4);
  assert.equal(player(resolved, fixture.opponent).tanks, 6);
  award(fixture, resolved); custody(resolved, fixture.initial);
  assert.equal(finishNativeTechFactionsTurn(resolved).strongholdCards!.owners[fixture.kind], fixture.owner);
});

void test('Richese Stronghold+Tech: actual unbid cache Stone, legal materialized battle and kill/ignore outcomes retain the original typed reward', () => {
  const fixture = createNativeTechFactionsFixture({ family: 'richese', stone: true });
  assert.ok(fixture.acquisition!.before.richeseCache!.some(c => c.id === 'richese-stone-burner'));
  assert.ok(player(fixture.acquisition!.after, fixture.owner).hand.some(c => c.id === 'richese-stone-burner'));
  assert.equal(fixture.acquisition!.after.richeseCache!.some(c => c.id === 'richese-stone-burner'), false);
  for (const mode of ['kill', 'ignore'] as const) {
    const revealed = revealNativeTechFactionsBattle(fixture);
    assert.equal(revealed.decision?.kind, 'stoneBurner');
    const chosen = applyAction(revealed, fixture.owner, { type: 'decision', event: revealed.battle!.event, mode });
    const resolved = finishNativeTechFactionsBattle(chosen), quote = money(chosen, resolved);
    assert.equal(quote.winner, fixture.owner);
    assert.equal(player(resolved, fixture.owner).forces[fixture.location], 4);
    assert.equal(player(resolved, fixture.owner).tanks, 2);
    assert.equal(player(resolved, fixture.opponent).tanks, 6);
    assert.ok(player(resolved, fixture.owner).hand.some(c => c.id === 'richese-stone-burner'));
    for (const plan of fixture.planActions) assert.equal(player(resolved, plan.actor).leaders.find(l => l.id === plan.action.leader)!.dead, mode === 'kill');
    award(fixture, resolved); custody(resolved, fixture.initial);
  }
});

void test('Tleilaxu Stronghold+Tech: original Ix bounty/cards/token settle before actual Face Dance; replacement returns surviving subtypes without transferring rewards', () => {
  const fixture = createNativeTechFactionsFixture({ family: 'tleilaxu' });
  const revealed = revealNativeTechFactionsBattle(fixture);
  const faceDance = advanceNativeTechFactions(revealed, g => g.decision?.kind === 'faceDance');
  const quote = money(revealed, faceDance);
  assert.deepEqual(quote.strongholdIncome, [{ player: fixture.owner, amount: 1 }]);
  assert.equal(quote.bounty!.player, fixture.owner);
  award(fixture, faceDance);
  const winner = player(faceDance, fixture.owner), tleilaxu = faceDance.decision!.player;
  const original = player(revealed, fixture.owner), losses = quote.casualties!.options[0];
  assert.equal(winner.tanks, original.tanks + losses.normal + losses.elite);
  assert.equal(winner.elites!.tanks, original.elites!.tanks + losses.elite);
  for (const id of [fixture.planActions[0].action.weapon, fixture.planActions[0].action.defense]) assert.ok(winner.hand.some(c => c.id === id));
  const remaining = winner.forces[fixture.location], elite = winner.elites!.forces[fixture.location] ?? 0;
  const board = `arrakeen:${territory('arrakeen').sectors[0]}`;
  reject(faceDance, tleilaxu, { type: 'decision', reveal: true, sources: { reserves: remaining + 1 }, sector: territory(fixture.kind).sectors[0] });
  const after = applyAction(faceDance, tleilaxu, { type: 'decision', reveal: true, sources: { [board]: 2, reserves: remaining - 2 }, sector: territory(fixture.kind).sectors[0] });
  const returned = player(after, fixture.owner), replacement = player(after, tleilaxu);
  assert.equal(returned.forces[fixture.location] ?? 0, 0);
  assert.equal(returned.elites!.forces[fixture.location] ?? 0, 0);
  assert.equal(returned.reserves, winner.reserves + remaining);
  assert.equal(returned.elites!.reserves, winner.elites!.reserves + elite);
  assert.equal(returned.tanks, winner.tanks); assert.equal(returned.elites!.tanks, winner.elites!.tanks);
  assert.equal(returned.spice, winner.spice); assert.deepEqual(returned.hand, winner.hand);
  assert.deepEqual(after.techTokens, faceDance.techTokens, 'A later replacement never claws back or redirects original winner Tech');
  assert.equal(replacement.forces[fixture.location], remaining); assert.equal(replacement.forces[board], 1);
  assert.equal(replacement.reserves, player(faceDance, tleilaxu).reserves - remaining + 2);
  assert.equal(strongholdControllers(after.players, true)[fixture.kind], tleilaxu);
  assert.equal(strongholdBenefit(after.strongholdCards, fixture.owner, fixture.kind), fixture.kind);
  assert.equal(strongholdBenefit(after.strongholdCards, tleilaxu, fixture.kind), null);
  assert.equal(returned.leaders.find(l => l.id === fixture.planActions[0].action.leader)!.dead, true);
  custody(after, fixture.initial);
  const mentat = finishNativeTechFactionsTurn(after);
  assert.equal(mentat.strongholdCards!.owners[fixture.kind], tleilaxu);
  assert.deepEqual(mentat.techTokens, after.techTokens);
  custody(mentat, fixture.initial);
});

void test('representative native bot continues the genuine Stronghold+Tech Face Dance with legal physical sources', () => {
  const fixture = createNativeTechFactionsFixture({ family: 'tleilaxu' });
  const game = advanceNativeTechFactions(revealNativeTechFactionsBattle(fixture), g => g.decision?.kind === 'faceDance');
  const actor = game.decision!.player, view = viewGame(game, actor);
  view.players.find(p => p.id === actor)!.bot = 'Easy';
  const action = botActions(view).find(a => a.type === 'decision'); assert.ok(action);
  assert.equal(action.reveal, true);
  const after = applyAction(game, actor, action);
  assert.equal(player(after, fixture.owner).forces[fixture.location] ?? 0, 0);
  assert.equal(player(after, actor).forces[fixture.location], player(game, fixture.owner).forces[fixture.location]);
  assert.deepEqual(after.techTokens, game.techTokens);
  custody(after, fixture.initial);
});
