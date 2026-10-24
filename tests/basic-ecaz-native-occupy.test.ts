import test from 'node:test';
import assert from 'node:assert/strict';
import { viewGame, type Game } from '../game/engine';
import { DIFFICULTIES } from '../game/bot-profiles';
import { treacheryDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { ecazOccupyPlanControl } from '../game/ecaz-occupy-options';
import { occupyRicheseSeat as player } from './fixture-ecaz-occupy-richese';
import { basicEcazNativeFixture, resolveBasicEcazNative } from './fixture-basic-ecaz-native';

const cards = (game: Game) => [...game.deck, ...game.discard, ...(game.ixSetupCards ?? []),
  ...game.players.flatMap(p => p.hand)].map(card => card.id).sort();
const allCards = (game: Game) => [...cards(game), ...(game.richeseCache ?? []).map(card => card.id),
  ...(game.richeseRemoved ?? []).map(card => card.id)].sort();
function conserved(game: Game) {
  for (const p of game.players) {
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((sum, n) => sum + n, 0), 20,
      `${p.faction} retains its original physical counters.`);
    if (p.elites) assert.equal(p.elites.reserves + p.elites.tanks +
      Object.values(p.elites.forces).reduce((sum, n) => sum + n, 0), p.faction === 'ixians' ? 7 : 5);
  }
}
function originalBasic(fixture: ReturnType<typeof basicEcazNativeFixture>) {
  assert.equal(fixture.source.status, 'setup');
  assert.equal(fixture.source.turn, 1);
  assert.equal(fixture.source.advanced, false);
  assert.equal(fixture.afterSetup.advanced, false);
  assert.equal(fixture.afterSetup.status, 'playing');
  assert.deepEqual(cards(fixture.source), treacheryDeck(fixture.source.expansions).map(card => card.id).sort());
  assert.deepEqual(fixture.source.richeseCache, richeseCards());
  const choam = fixture.afterSetup.players.find(p => p.faction === 'choam');
  if (choam) assert.equal(choam.leaders.length, 5, 'Original Basic CHOAM adds no Advanced Auditor disc.');
  assert.ok(fixture.afterSetup.players.every(p => p.leaders.length > 0 &&
    (p.faction === 'tleilaxu' ? p.faceDancers!.length > 0 : p.traitors.length > 0)));
  assert.equal(player(fixture.game, fixture.ecaz).ally, fixture.ally);
  assert.equal(player(fixture.game, fixture.ally).ally, fixture.ecaz);
  assert.ok(fixture.staging.some(line => line.includes('thirty-spice')));
  conserved(fixture.game);
}
function nativeWin(result: ReturnType<typeof resolveBasicEcazNative>) {
  const { fixture, actor, before, game, profile } = result;
  assert.equal(profile.planOwner, actor);
  assert.equal(profile.forceOwner, fixture.ally);
  assert.equal(profile.fixedEcazDial, 3, 'Basic odd-five policy provisionally uses main p8 ceil/floor.');
  assert.equal(profile.maxSupport, 0);
  assert.equal(ecazOccupyPlanControl(viewGame(before, actor), Number(result.plan.dial), 0)?.blocked, null);
  assert.ok(ecazOccupyPlanControl(viewGame(before, actor), Number(result.plan.dial), 1)?.blocked);
  assert.equal(player(game, fixture.ecaz).forces[fixture.location], 2);
  assert.equal(player(game, fixture.ecaz).tanks - player(before, fixture.ecaz).tanks, 3);
  assert.equal(player(game, fixture.opponent).forces[fixture.location] ?? 0, 0);
  assert.equal(player(game, fixture.opponent).tanks - player(before, fixture.opponent).tanks, 8);
  for (const id of [fixture.ecaz, fixture.ally]) assert.equal(player(game, id).spice, player(before, id).spice,
    'Basic support and shared Carthag occupancy produce no Advanced spice debit or city income.');
  assert.equal(game.lastBattleContext?.event, before.battle?.event);
  assert.equal(game.lastBattleContext?.winner, actor);
  assert.equal(game.phase, 7);
  assert.deepEqual(allCards(game), allCards(fixture.source));
  conserved(game);
}

for (const allyFaction of ['ixians', 'choam', 'richese'] as const)
  for (const lead of ['ecaz', 'ally'] as const)
    void test(`Public Basic native ${allyFaction} coalition with ${lead} lead resolves free actual-owner losses`, () => {
      const fixture = basicEcazNativeFixture({ allyFaction,
        opponentFaction: allyFaction === 'ixians' ? 'choam' : 'guild' });
      originalBasic(fixture);
      if (allyFaction === 'ixians') assert.deepEqual(fixture.source.players.map(p => p.faction),
        ['ecaz', 'ixians', 'choam', 'richese', 'moritani', 'tleilaxu']);
      const result = resolveBasicEcazNative(fixture, lead);
      nativeWin(result);
      const loss = allyFaction === 'ixians' ? 4 : 2;
      assert.equal(player(result.game, fixture.ally).forces[fixture.location] ?? 0, 4 - loss);
      assert.equal(player(result.game, fixture.ally).tanks - player(result.before, fixture.ally).tanks, loss);
      assert.equal(result.profile.forces.normalFixedHalf, allyFaction === 'ixians');
    });

for (const lead of ['ecaz', 'ally'] as const)
  void test(`Public Basic mixed Ix with ${lead} lead owns its actual typed choice and Suboid substitution`, () => {
    const fixture = basicEcazNativeFixture({ allyFaction: 'ixians', opponentFaction: 'choam', mixedIxians: true });
    originalBasic(fixture);
    const result = resolveBasicEcazNative(fixture, lead, { losses: { normal: 0, elite: 1 }, substitute: true });
    nativeWin(result);
    assert.ok(result.typedDecision?.decision?.kind === 'battleLosses');
    const decision = result.typedDecision.decision;
    assert.equal(decision.player, result.actor);
    assert.equal(decision.forceOwner, fixture.ally);
    assert.ok(decision.options.some(loss => loss.normal === 4 && loss.elite === 0));
    assert.ok(decision.options.some(loss => loss.normal === 0 && loss.elite === 1));
    assert.ok(result.afterLosses && result.substitutionDecision && result.afterSubstitution);
    assert.equal(player(result.afterLosses, fixture.ally).elites!.forces[fixture.location], 1);
    assert.equal(player(result.afterLosses, fixture.ally).elites!.tanks - player(result.before, fixture.ally).elites!.tanks, 1);
    assert.equal(result.substitutionDecision.decision?.player, fixture.ally);
    assert.equal(player(result.afterSubstitution, fixture.ally).elites!.forces[fixture.location], 2);
    assert.equal(player(result.game, fixture.ally).elites!.tanks, player(result.before, fixture.ally).elites!.tanks);
    assert.equal(player(result.game, fixture.ally).forces[fixture.location], 7);
    assert.equal(player(result.game, fixture.ally).tanks - player(result.before, fixture.ally).tanks, 1,
      'The actual surviving Suboid funds the recovered Cyborg without consuming Ecaz counters.');
  });

for (const marker of [0, 3] as const) for (const lead of ['ecaz', 'ally'] as const)
  void test(`Public Basic concealed Richese ${marker} with ${lead} lead materializes only after both real seals`, () => {
    const fixture = basicEcazNativeFixture({ marker, richeseReserves: 2 });
    originalBasic(fixture);
    const result = resolveBasicEcazNative(fixture, lead);
    nativeWin(result);
    assert.ok(player(result.before, fixture.richese).noField!.deployed);
    assert.deepEqual(player(result.firstSeal, fixture.richese).noField!.deployed,
      player(result.before, fixture.richese).noField!.deployed);
    assert.equal(player(result.firstSeal, fixture.richese).reserves, player(result.before, fixture.richese).reserves);
    assert.equal(player(result.revealed, fixture.richese).noField!.deployed, null);
    const materialized = Math.min(marker, 2);
    assert.equal(player(result.before, fixture.richese).reserves - player(result.revealed, fixture.richese).reserves,
      materialized);
    assert.equal(player(result.revealed, fixture.richese).forces[fixture.location] ?? 0, materialized);
    assert.equal(player(result.game, fixture.richese).tanks - player(result.before, fixture.richese).tanks, materialized);
    assert.equal(player(result.game, fixture.richese).forces[fixture.location] ?? 0, 0);
    assert.equal(result.profile.allyNoFieldPresence, true, 'A native zero marker remains real coalition presence.');
  });

void test('Public Basic Ecaz-led Ix total dial keeps a legal half-step from its native Suboid owner', () => {
  const fixture = basicEcazNativeFixture({ allyFaction: 'ixians', opponentFaction: 'choam' });
  const result = resolveBasicEcazNative(fixture, 'ecaz', { variableDial: 0.5 });
  nativeWin(result);
  assert.equal(result.plan.dial, 3.5);
  assert.equal(result.profile.forces.normalFixedHalf, true);
  assert.equal(player(result.game, fixture.ally).forces[fixture.location], 3);
  assert.equal(player(result.game, fixture.ally).tanks - player(result.before, fixture.ally).tanks, 1);
});

void test('Public Basic canceled Ecaz-led mixed Ix uses only its own free ordinary pool', () => {
  const fixture = basicEcazNativeFixture({ allyFaction: 'ixians', opponentFaction: 'choam', mixedIxians: true });
  const result = resolveBasicEcazNative(fixture, 'ecaz', { canceled: true });
  assert.equal(result.profile.canceled, true);
  assert.equal(result.profile.fixedEcazDial, 0);
  assert.equal(result.profile.forceOwner, fixture.ecaz);
  assert.equal(result.profile.forces.normalFixedHalf, false);
  assert.equal(result.profile.maxSupport, 0);
  assert.equal(result.plan.dial, 2);
  assert.equal(player(result.game, fixture.ecaz).forces[fixture.location], 3);
  assert.equal(player(result.game, fixture.ecaz).tanks - player(result.before, fixture.ecaz).tanks, 2);
  assert.deepEqual(player(result.game, fixture.ally).forces, player(result.before, fixture.ally).forces);
  assert.deepEqual(player(result.game, fixture.ally).elites, player(result.before, fixture.ally).elites);
  assert.equal(player(result.game, fixture.ally).tanks, player(result.before, fixture.ally).tanks);
  assert.equal(player(result.game, fixture.ecaz).spice, player(result.before, fixture.ecaz).spice);
  assert.equal(player(result.game, fixture.ally).spice, player(result.before, fixture.ally).spice);
  assert.equal(result.substitutionDecision, null);
  assert.equal(result.game.phase, 7);
  conserved(result.game);
});

for (const lead of ['ecaz', 'ally'] as const)
  void test(`Public Basic mixed Richese ordinary2 plus marker5 with ${lead} lead retains separate materialization and losses`, () => {
    const fixture = basicEcazNativeFixture({ marker: 5, richeseReserves: 2, mixedRicheseForces: 2 });
    originalBasic(fixture);
    const result = resolveBasicEcazNative(fixture, lead);
    nativeWin(result);
    assert.equal(player(result.before, fixture.richese).forces[fixture.location], 2);
    assert.equal(player(result.firstSeal, fixture.richese).forces[fixture.location], 2);
    assert.equal(player(result.firstSeal, fixture.richese).reserves, 2);
    assert.ok(player(result.firstSeal, fixture.richese).noField!.deployed);
    assert.equal(player(result.revealed, fixture.richese).noField!.deployed, null);
    assert.equal(player(result.revealed, fixture.richese).reserves, 0);
    assert.equal(player(result.revealed, fixture.richese).forces[fixture.location], 4,
      'Two original ordinary counters and two reserve-limited marker counters materialize at the real second seal.');
    assert.equal(result.profile.forces.normal, 4);
    assert.equal(player(result.game, fixture.richese).forces[fixture.location], 2);
    assert.equal(player(result.game, fixture.richese).tanks - player(result.before, fixture.richese).tanks, 2,
      'The variable dial loses two physical Richese counters independently of the three fixed Ecaz casualties.');
  });

void test('All four Basic policies select and seal a legal changed native coalition position through ordinary continuation', () => {
  const fixture = basicEcazNativeFixture({ allyFaction: 'ixians', opponentFaction: 'choam', mixedIxians: true });
  for (const [index, difficulty] of DIFFICULTIES.entries()) {
    const lead = index % 2 === 0 ? 'ecaz' : 'ally';
    const result = resolveBasicEcazNative(fixture, lead,
      { difficulty, losses: { normal: 0, elite: 1 }, substitute: true });
    nativeWin(result);
    assert.equal(result.selectedLead.lead, result.actor);
    assert.equal(result.plan.type, 'battlePlan');
    assert.equal(Number(result.plan.support ?? 0), 0);
    assert.ok(result.actions.some(step => step.action.type === 'battlePlan' && step.actor === result.actor));
    assert.ok(result.actions.some(step => step.action.type === 'decision' && step.action.sources));
  }
});
