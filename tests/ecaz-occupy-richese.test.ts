import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game } from '../game/engine';
import { treacheryDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { quoteEcazOccupyBattle, quoteEcazOccupyDial, type EcazOccupyBattleInput } from '../game/ecaz-occupy-battle';
import { ecazOccupyRicheseFixture, occupyRicheseSeat, openOccupyRichese,
  nextOccupyRichese, finishOccupyRichese, type EcazOccupyRicheseFixture } from './fixture-ecaz-occupy-richese';
import { stageEcazOccupyCard } from './fixture-ecaz-occupy';

function conserve(game: Game): void {
  for (const player of game.players) {
    assert.equal(player.reserves + player.tanks + Object.values(player.forces).reduce((sum, n) => sum + n, 0), 20,
      `${player.faction} counters retain their original physical owner.`);
    if (player.elites) assert.equal(player.elites.reserves + player.elites.tanks +
      Object.values(player.elites.forces).reduce((sum, n) => sum + n, 0), player.faction === 'ixians' ? 7 : 5);
  }
}
function resolve(fixture: EcazOccupyRicheseFixture, lead: 'ecaz' | 'ally', cancel = false) {
  const actor = lead === 'ecaz' ? fixture.ecaz : fixture.ally;
  let game = openOccupyRichese(fixture, lead, cancel);
  const before = structuredClone(game);
  const profile = viewGame(game, actor).battle!.ecazOccupy!.profile!;
  const variable = Math.min(2, profile.maxDial - profile.fixedEcazDial);
  const support = profile.forces.normalFixedHalf ? 0 : variable;
  const leader = occupyRicheseSeat(game, actor).leaders.filter(l => !l.dead && !l.usedAt)
    .sort((a, b) => b.strength - a.strength)[0];
  const enemyLeader = occupyRicheseSeat(game, fixture.opponent).leaders.filter(l => !l.dead && !l.usedAt)
    .sort((a, b) => a.strength - b.strength)[0];
  assert.ok(leader && enemyLeader);
  const concealed = structuredClone(occupyRicheseSeat(game, fixture.richese).noField!.deployed);
  game = applyAction(game, actor, { type: 'battlePlan', dial: profile.fixedEcazDial + variable, support, leader: leader.id });
  assert.equal(game.battle!.plans[actor].leader, leader.id, 'The selected faction commits its real native leader.');
  assert.equal(game.battle!.revealed, false);
  assert.deepEqual(occupyRicheseSeat(game, fixture.richese).noField!.deployed, concealed,
    'The first sealed plan cannot reveal its physical partner marker.');
  assert.equal(occupyRicheseSeat(game, fixture.richese).reserves, occupyRicheseSeat(before, fixture.richese).reserves);
  assert.equal(viewGame(game, fixture.opponent).battle!.plans[actor], undefined);
  game = applyAction(game, fixture.opponent, { type: 'battlePlan', dial: 0, support: 0, leader: enemyLeader.id });
  assert.equal(game.battle!.revealed, true);
  assert.equal(game.battle!.plans[actor].leader, leader.id);
  const revealed = structuredClone(game);
  if (fixture.materialized !== null) {
    assert.equal(occupyRicheseSeat(game, fixture.richese).noField!.deployed, null);
    assert.equal(occupyRicheseSeat(before, fixture.richese).reserves - occupyRicheseSeat(game, fixture.richese).reserves,
      fixture.materialized, 'Both sealed plans materialize only available owner reserves, once.');
    assert.equal(occupyRicheseSeat(game, fixture.richese).forces[fixture.location] ?? 0, fixture.materialized);
  }
  game = finishOccupyRichese(game);
  assert.equal(game.battle, null);
  assert.equal(game.decision, null);
  assert.equal(game.lastBattleContext!.result, 'normal');
  assert.equal(game.lastBattleContext!.winner, actor);
  assert.equal(occupyRicheseSeat(game, actor).leaders.find(l => l.id === leader.id)!.usedAt, fixture.territory);
  assert.ok(game.phase >= 7, 'The mandatory coalition battle proceeds to actual collection.');
  conserve(game);
  return { game, before, revealed, actor, profile, variable, support };
}

const cityIncome = (game: Game, actor: string, location: string) =>
  (occupyRicheseSeat(game, actor).forces[location] ?? 0) > 0 ? 2 : 0;
for (const lead of ['ecaz', 'ally'] as const) void test(`Six-native Richese-present Carthag: Ecaz+Ix vs CHOAM with ${lead} lead resolves`, () => {
  const fixture = ecazOccupyRicheseFixture({ allyFaction: 'ixians', opponentFaction: 'choam', omitPreview: true });
  assert.deepEqual(fixture.initial.players.map(p => p.faction), ['ecaz', 'ixians', 'choam', 'richese', 'moritani', 'tleilaxu']);
  assert.equal(fixture.initial.status, 'setup');
  assert.deepEqual(fixture.initial.richeseCache, richeseCards(), 'The fresh initializer creates the canonical native cache.');
  assert.deepEqual([...fixture.initial.deck, ...(fixture.initial.ixSetupCards ?? []), ...fixture.initial.players.flatMap(p => p.hand)]
    .map(c => c.id).sort(), treacheryDeck(fixture.initial.expansions).map(c => c.id).sort());
  assert.ok(fixture.afterSetup.players.every(p => p.leaders.length > 0 &&
    (p.faction === 'tleilaxu' ? p.faceDancers!.length > 0 : p.traitors.length > 0)));
  assert.equal(fixture.beforeBattle.ecazOccupyPreview, undefined);
  const { game, before, actor } = resolve(fixture, lead);
  assert.equal(occupyRicheseSeat(game, fixture.ecaz).forces[fixture.location], 2);
  assert.equal(occupyRicheseSeat(game, fixture.ecaz).tanks - occupyRicheseSeat(before, fixture.ecaz).tanks, 3);
  assert.equal(occupyRicheseSeat(game, fixture.ally).forces[fixture.location] ?? 0, 0,
    'Four unsupported original Suboids contribute two strength and all four are lost.');
  assert.equal(occupyRicheseSeat(game, fixture.ally).tanks - occupyRicheseSeat(before, fixture.ally).tanks, 4);
  assert.equal(occupyRicheseSeat(game, actor).spice,
    occupyRicheseSeat(before, actor).spice + cityIncome(game, actor, fixture.location));
  assert.equal(occupyRicheseSeat(game, fixture.opponent).tanks - occupyRicheseSeat(before, fixture.opponent).tanks, 8);
});

for (const lead of ['ecaz', 'ally'] as const) for (const cancel of [false, true])
  void test(`Ordinary Richese variable pool, ${lead} lead, Occupy ${cancel ? 'prevented' : 'active'} preserves native owners`, () => {
    const fixture = ecazOccupyRicheseFixture();
    const { game, before, actor } = resolve(fixture, lead, cancel);
    const ecazLoss = cancel ? lead === 'ecaz' ? 2 : 0 : 3;
    const allyLoss = cancel && lead === 'ecaz' ? 0 : 2;
    assert.equal(occupyRicheseSeat(game, fixture.ecaz).forces[fixture.location], 5 - ecazLoss);
    assert.equal(occupyRicheseSeat(game, fixture.ecaz).tanks - occupyRicheseSeat(before, fixture.ecaz).tanks, ecazLoss);
    assert.equal(occupyRicheseSeat(game, fixture.ally).forces[fixture.location], 4 - allyLoss);
    assert.equal(occupyRicheseSeat(game, fixture.ally).tanks - occupyRicheseSeat(before, fixture.ally).tanks, allyLoss);
    assert.equal(occupyRicheseSeat(before, actor).spice - occupyRicheseSeat(game, actor).spice,
      2 - cityIncome(game, actor, fixture.location));
    const nonLead = actor === fixture.ecaz ? fixture.ally : fixture.ecaz;
    assert.equal(occupyRicheseSeat(game, nonLead).spice,
      occupyRicheseSeat(before, nonLead).spice + cityIncome(game, nonLead, fixture.location));
    assert.equal(occupyRicheseSeat(game, fixture.opponent).forces[fixture.location] ?? 0, 0);
    assert.equal(occupyRicheseSeat(game, fixture.opponent).tanks - occupyRicheseSeat(before, fixture.opponent).tanks, 8);
  });

for (const role of ['ally', 'opponent'] as const) for (const marker of [0, 3, 5] as const)
  for (const reserves of [0, 2, 20]) for (const lead of ['ecaz', 'ally'] as const)
    void test(`Concealed Richese ${role} ${marker}, reserves ${reserves}, ${lead} lead resolves only after both seals`, () => {
      const fixture = ecazOccupyRicheseFixture({ allyFaction: role === 'ally' ? 'richese' : 'guild',
        opponentFaction: role === 'opponent' ? 'richese' : 'guild', marker, richeseReserves: reserves });
      conserve(fixture.game);
      const prepared = openOccupyRichese(fixture, lead);
      const actor = lead === 'ecaz' ? fixture.ecaz : fixture.ally;
      const rival = role === 'ally' ? fixture.opponent : actor;
      assert.equal(viewGame(prepared, rival).battle!.opponentForces, null,
        'The rival cannot receive a prospective denomination through its opponent pool.');
      if (role === 'ally') {
        assert.equal(viewGame(prepared, fixture.opponent).battle!.ecazOccupy!.profile, null,
          'Rival max dial and physical ally counters must not disclose the marker.');
        assert.equal(viewGame(prepared, actor).battle!.ownForces!.normal, Math.min(marker, reserves));
      }
      const { game, before, actor: selected, support } = resolve(fixture, lead);
      const materialized = Math.min(marker, reserves);
      const richeseLoss = role === 'opponent' ? materialized : Math.min(2, materialized);
      assert.equal(occupyRicheseSeat(game, fixture.richese).forces[fixture.location] ?? 0, materialized - richeseLoss);
      assert.equal(occupyRicheseSeat(game, fixture.richese).tanks - occupyRicheseSeat(before, fixture.richese).tanks, richeseLoss);
      assert.equal(occupyRicheseSeat(game, fixture.richese).reserves, reserves - materialized);
      assert.equal(occupyRicheseSeat(game, fixture.ecaz).forces[fixture.location], 2);
      assert.equal(occupyRicheseSeat(game, fixture.ecaz).tanks - occupyRicheseSeat(before, fixture.ecaz).tanks, 3);
      assert.equal(occupyRicheseSeat(before, selected).spice - occupyRicheseSeat(game, selected).spice,
        support - cityIncome(game, selected, fixture.location));
      assert.equal(occupyRicheseSeat(game, fixture.opponent).forces[fixture.location] ?? 0, 0);
      assert.equal(occupyRicheseSeat(game, fixture.opponent).tanks - occupyRicheseSeat(before, fixture.opponent).tanks,
        role === 'opponent' ? materialized : 8);
    });

void test('Original concealed Richese presence permits a zero prospective pool, never an ordinary empty ally', () => {
  const forces = { normal: 0, elite: 0, eliteStrength: 2 as const, freeSupport: false };
  const input: EcazOccupyBattleInput = { advanced: true, battleOrderActor: 'ecaz', lead: 'ecaz', canceled: false,
    ecaz: { id: 'ecaz', faction: 'ecaz', ally: 'richese', forces: { ...forces, normal: 5 } },
    ally: { id: 'richese', faction: 'richese', ally: 'ecaz', forces } };
  const saved = structuredClone(input);
  assert.throws(() => quoteEcazOccupyBattle(input), /storm-connected fighters/);
  const profile = quoteEcazOccupyBattle({ ...input, ally: { ...input.ally, noFieldPresence: true } });
  assert.equal(profile.maxDial, 3);
  assert.equal(profile.maxSupport, 0);
  assert.deepEqual(quoteEcazOccupyDial(profile, 3, 0).options, [{ normal: 0, elite: 0, paidNormal: 0, paidElite: 0 }]);
  assert.throws(() => quoteEcazOccupyBattle({ ...input, ally: { ...input.ally, faction: 'guild', noFieldPresence: true } }),
    /Only an original concealed Richese ally/);
  assert.deepEqual(input, saved);
});

for (const role of ['ally', 'opponent'] as const) void test(`Combined Occupy ordinary-plus-marker ${role} battle is rejected immutably`, () => {
  const fixture = ecazOccupyRicheseFixture({ allyFaction: role === 'ally' ? 'richese' : 'guild',
    opponentFaction: role === 'opponent' ? 'richese' : 'guild', marker: 5,
    richeseReserves: 2, mixedRicheseForces: 1 });
  const game = fixture.beforeBattle;
  const saved = structuredClone(game);
  const choice = viewGame(game, game.active!).battleChoices.find(b => b.territory === fixture.territory)!;
  assert.throws(() => applyAction(game, choice.chooser, { type: 'chooseBattle', territory: fixture.territory,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker }),
    { message: 'Combined Occupy No-Field battle dialing awaits a ruling. Ordinary mixed battles use the visible provisional pool.' });
  assert.deepEqual(game, saved);
});

for (const lead of ['ecaz', 'ally'] as const) void test(`Atreides cannot inspect concealed partner's ${lead} plan dial or whole plan`, () => {
  const fixture = ecazOccupyRicheseFixture({ opponentFaction: 'atreides', marker: 5, richeseReserves: 2 });
  const actor = lead === 'ecaz' ? fixture.ecaz : fixture.ally;
  assert.ok(fixture.game.decision?.kind === 'ecazBattleLead');
  const event = fixture.game.decision.event;
  let game = applyAction(fixture.game, fixture.ecaz, { type: 'decision', event, lead: actor });
  for (let attempt = 0; attempt < 100 && game.battle?.preparation?.kind !== 'prescience'; attempt++)
    game = nextOccupyRichese(game);
  assert.equal(game.battle!.preparation!.kind, 'prescience');
  let saved = structuredClone(game);
  // A random response window can still be open here; settle it before the
  // inspection attempt so the rejection is the inspection authority itself.
  for (let i = 0; game.response && i < 6; i++) {
    const responder = game.players.find(p => !game.response!.passed.includes(p.id));
    assert.ok(responder, 'The open response window keeps a legal responder.');
    game = applyAction(game, responder!.id, { type: 'passResponse' });
  }
  saved = structuredClone(game);
  assert.throws(() => applyAction(game, fixture.opponent, { type: 'prescience', field: 'dial' }), /may not inspect/);
  assert.deepEqual(game, saved);
  game = applyAction(game, fixture.opponent, { type: 'declineBattlePower' });
  for (let attempt = 0; attempt < 100 && game.decision?.kind !== 'fullPlanOffer'; attempt++) game = nextOccupyRichese(game);
  assert.equal(game.decision!.kind, 'fullPlanOffer');
  const karama = occupyRicheseSeat(game, fixture.opponent).hand.find(c => c.effect === 'karama')!;
  saved = structuredClone(game);
  assert.throws(() => applyAction(game, fixture.opponent, { type: 'card', mode: 'special', card: karama.id, target: actor }),
    /Whole-plan special prescience against a No-Field/);
  assert.deepEqual(game, saved);
  assert.ok(occupyRicheseSeat(game, fixture.richese).noField!.deployed);
});

for (const marker of [0, 5] as const) for (const lead of ['ecaz', 'ally'] as const)
  void test(`Prevented Occupy with marker ${marker} retains ${lead}'s own pool and original physical reveal`, () => {
    const fixture = ecazOccupyRicheseFixture({ marker, richeseReserves: 2 });
    const { game, before, actor, support } = resolve(fixture, lead, true);
    const materialized = Math.min(marker, 2);
    const ecazLoss = lead === 'ecaz' ? 2 : 0;
    const richeseLoss = lead === 'ally' ? materialized : 0;
    assert.equal(occupyRicheseSeat(game, fixture.ecaz).forces[fixture.location], 5 - ecazLoss);
    assert.equal(occupyRicheseSeat(game, fixture.ecaz).tanks - occupyRicheseSeat(before, fixture.ecaz).tanks, ecazLoss);
    assert.equal(occupyRicheseSeat(game, fixture.richese).forces[fixture.location] ?? 0, materialized - richeseLoss);
    assert.equal(occupyRicheseSeat(game, fixture.richese).tanks - occupyRicheseSeat(before, fixture.richese).tanks, richeseLoss);
    assert.equal(occupyRicheseSeat(before, actor).spice - occupyRicheseSeat(game, actor).spice,
      support - cityIncome(game, actor, fixture.location));
  });

void test('Prevented Occupy makes selected Ecaz own dial and whole plan inspectable without revealing Richese', () => {
  const fixture = ecazOccupyRicheseFixture({ opponentFaction: 'atreides', marker: 5, richeseReserves: 2 });
  const counter = 'choam';
  const karama = stageEcazOccupyCard(fixture.game, counter, card => card.effect === 'karama');
  assert.ok(fixture.game.decision?.kind === 'ecazBattleLead');
  const event = fixture.game.decision.event;
  let game = applyAction(fixture.game, fixture.ecaz, { type: 'decision', event, lead: fixture.ecaz });
  game = applyAction(game, counter, { type: 'card', mode: 'cancel', card: karama });
  for (let attempt = 0; attempt < 100 && game.battle?.preparation?.kind !== 'prescience'; attempt++)
    game = nextOccupyRichese(game);
  assert.equal(game.battle!.preparation!.kind, 'prescience');
  const ownProfile = viewGame(game, fixture.ecaz).battle!.ecazOccupy!.profile!;
  assert.equal(ownProfile.forceOwner, fixture.ecaz);
  assert.equal(ownProfile.forces.normal, 5);
  const asked = applyAction(game, fixture.opponent, { type: 'prescience', field: 'dial' });
  assert.equal(asked.battle!.prescience!.field, 'dial');
  assert.equal(asked.battle!.preparation!.owner, fixture.ecaz);
  assert.ok(occupyRicheseSeat(asked, fixture.richese).noField!.deployed);
  game = applyAction(game, fixture.opponent, { type: 'declineBattlePower' });
  for (let attempt = 0; attempt < 100 && game.decision?.kind !== 'fullPlanOffer'; attempt++) game = nextOccupyRichese(game);
  assert.equal(game.decision!.kind, 'fullPlanOffer');
  const inspectionCard = occupyRicheseSeat(game, fixture.opponent).hand.find(c => c.effect === 'karama')!;
  game = applyAction(game, fixture.opponent, { type: 'card', mode: 'special', card: inspectionCard.id, target: fixture.ecaz });
  assert.deepEqual(game.battle!.fullPlan, { owner: fixture.opponent, target: fixture.ecaz });
  assert.ok(occupyRicheseSeat(game, fixture.richese).noField!.deployed);
});
