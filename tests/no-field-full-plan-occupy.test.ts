import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game } from '../game/engine';
import { nextOccupyRichese, occupyRicheseSeat } from './fixture-ecaz-occupy-richese';
import {
  noFieldFullPlanOccupyFixture, offerNoFieldFullPlanOccupy, inspectNoFieldFullPlanOccupy,
  finishNoFieldFullPlanOccupy, type NoFieldFullPlanOccupyFixture,
} from './fixture-no-field-full-plan-occupy';

function assertCustody(fixture: NoFieldFullPlanOccupyFixture, game: Game): void {
  const cards = (state: Game) => [...state.deck, ...state.discard,
    ...(state.richeseCache ?? []), ...(state.richeseRemoved ?? []),
    ...state.players.flatMap(player => player.hand)].map(card => card.id).sort();
  assert.deepEqual(cards(game), cards(fixture.initial), 'Every original dealer/cache/removed face retains custody.');
  const traitors = (state: Game) => [...(state.traitorReserve ?? []),
    ...(state.ecazLoyalty?.card ? [state.ecazLoyalty.card] : []),
    ...state.players.flatMap(player => player.traitors)].sort();
  assert.deepEqual(traitors(game), traitors(fixture.afterSetup));
  for (const player of game.players) {
    const counters = [player.reserves, player.tanks, ...Object.values(player.forces)];
    assert.equal(counters.reduce((sum, count) => sum + count, 0), 20,
      `${player.faction} retains twenty counters of its original physical ownership.`);
    assert.ok(counters.every(count => Number.isSafeInteger(count) && count >= 0));
    assert.ok(player.hand.length <= 4);
  }
}

function assertNativeMarker(fixture: NoFieldFullPlanOccupyFixture, game: Game): void {
  const before = occupyRicheseSeat(fixture.prescience, fixture.richese);
  const now = occupyRicheseSeat(game, fixture.richese);
  assert.deepEqual(now.noField, before.noField);
  assert.equal(now.noFieldEvent, before.noFieldEvent);
  assert.equal(now.reserves, before.reserves);
  assert.equal(now.forces[fixture.location] ?? 0, fixture.ordinary);
  assert.equal(now.tanks, before.tanks);
}

function inspectAndSeal(fixture: NoFieldFullPlanOccupyFixture, offered = offerNoFieldFullPlanOccupy(fixture)): Game {
  assert.equal(offered.decision?.kind, 'fullPlanOffer');
  const inspection = inspectNoFieldFullPlanOccupy(fixture, offered);
  assert.equal(occupyRicheseSeat(inspection, fixture.atreides).specialKaramaUsed, true);
  assert.equal(occupyRicheseSeat(inspection, fixture.atreides).hand.some(card => card.id === fixture.inspectionCard), false);
  assert.equal(inspection.discard.filter(card => card.id === fixture.inspectionCard).length, 1);
  assertNativeMarker(fixture, inspection);
  const saved = structuredClone(inspection);
  assert.throws(() => applyAction(inspection, fixture.atreides, fixture.atreidesPlan), /requested by special/);
  assert.deepEqual(inspection, saved, 'The actual selected lead must seal before the inspecting opponent.');
  const first = applyAction(inspection, fixture.owner, fixture.targetPlan);
  assert.equal(first.battle!.revealed, false);
  assert.equal(first.decision, null, 'Reading the plan needs no acknowledgement or fabricated continuation.');
  assertNativeMarker(fixture, first);
  for (const actor of [fixture.ecaz, fixture.richese, fixture.atreides]) {
    const before = occupyRicheseSeat(fixture.prescience, actor);
    const sealed = occupyRicheseSeat(first, actor);
    assert.equal(sealed.spice, before.spice, 'The private read is not a battle payment.');
    assert.equal(sealed.reserves, before.reserves, 'R cannot spend the card holder reserves before the second seal.');
    assert.equal(sealed.tanks, before.tanks);
    assert.deepEqual(sealed.forces, before.forces, 'H cannot return any physical counter before the second seal.');
  }
  const privateView = viewGame(first, fixture.atreides).battle!;
  const insight = privateView.fullPlanInsight!;
  assert.ok(insight);
  assert.equal(insight.target, fixture.owner);
  assert.equal(insight.plan.dial, fixture.fixedEcazDial + fixture.variableDial);
  assert.equal(insight.plan.support, fixture.support);
  assert.equal(insight.plan.leader, fixture.targetPlan.leader);
  assert.equal(insight.plan.weapon, fixture.targetPlan.weapon);
  assert.equal(insight.plan.defense, fixture.targetPlan.defense);
  assert.deepEqual(insight.cards, occupyRicheseSeat(first, fixture.owner).hand.filter(card =>
    [fixture.targetPlan.weapon, fixture.targetPlan.defense].includes(card.id)),
  'The entitlement supplies the actual committed original physical card faces.');
  assert.equal(privateView.plans[fixture.owner], undefined, 'The special read does not turn the seal into an ordinary visible plan.');
  const concealed = occupyRicheseSeat(first, fixture.richese).noField!.deployed!;
  assert.equal(JSON.stringify(insight).includes(concealed.tokenId), false,
    'Complete plan entitlement is not ownership of the physical token identity.');
  for (const player of first.players) if (player.id !== fixture.atreides)
    assert.equal(viewGame(first, player.id).battle!.fullPlanInsight, null);
  assertCustody(fixture, first);
  return first;
}

function secondSeal(fixture: NoFieldFullPlanOccupyFixture, first: Game): Game {
  const revealed = applyAction(first, fixture.atreides, fixture.atreidesPlan);
  const original = occupyRicheseSeat(fixture.prescience, fixture.richese);
  const richese = occupyRicheseSeat(revealed, fixture.richese);
  assert.equal(revealed.battle!.revealed, true);
  assert.equal(richese.noField!.deployed, null);
  assert.equal(richese.noField!.lastShipped, original.noField!.deployed!.tokenId);
  assert.deepEqual(richese.noField!.tokens, original.noField!.tokens);
  assert.notEqual(richese.noFieldEvent, original.noFieldEvent);
  assert.equal(richese.forces[fixture.location] ?? 0, fixture.ordinary + fixture.materializes,
    'Both seals add the reserve-capped marker to the original ordinary counters, without replacing them.');
  assert.equal(richese.reserves, original.reserves - fixture.materializes);
  assert.equal(richese.tanks, original.tanks);
  for (const player of revealed.players) assert.equal(viewGame(revealed, player.id).battle!.fullPlanInsight, null);
  const saved = structuredClone(revealed);
  assert.throws(() => applyAction(revealed, fixture.atreides, fixture.atreidesPlan));
  assert.deepEqual(revealed, saved, 'A repeated seal cannot materialize a marker twice.');
  assertCustody(fixture, revealed);
  return revealed;
}

function assertHistory(fixture: NoFieldFullPlanOccupyFixture, revealed: Game, done: Game): void {
  assert.equal(done.battle, null);
  assert.equal(done.decision, null);
  const richese = occupyRicheseSeat(done, fixture.richese);
  assert.equal(richese.noField!.deployed, null);
  assert.equal(richese.noFieldEvent, occupyRicheseSeat(revealed, fixture.richese).noFieldEvent,
    'Payments, losses and aftermath cannot perform another marker reveal.');
  for (const player of done.players) {
    const history = viewGame(done, player.id).players.find(seat => seat.id === fixture.richese)!.noField!;
    assert.equal(history.deployed, null);
    assert.equal(history.lastUsed, fixture.marker);
  }
  assertCustody(fixture, done);
}

function ordinaryDialRemainsBlocked(fixture: NoFieldFullPlanOccupyFixture): void {
  const before = fixture.prescience;
  assert.equal(before.battle!.preparation!.kind, 'prescience');
  const saved = structuredClone(before);
  assert.throws(() => applyAction(before, fixture.atreides, { type: 'prescience', field: 'dial' }), /may not inspect/);
  assert.deepEqual(before, saved);
  assertNativeMarker(fixture, before);
  const profile = viewGame(before, fixture.owner).battle!.ecazOccupy!.profile!;
  assert.equal(profile.forceOwner, fixture.richese,
    'Ordinary dial protection follows physical Richese ownership even when Ecaz forms the plan.');
  assert.equal(profile.fixedEcazDial, 3);
  assert.equal(profile.forces.normal, fixture.ordinary + fixture.materializes);
  assert.equal(profile.maxDial, 3 + fixture.ordinary + fixture.materializes);
  const rival = viewGame(before, fixture.atreides).battle!;
  assert.equal(rival.opponentForces, null);
  assert.equal(rival.ecazOccupy!.profile, null,
    'The distinct complete-plan entitlement does not broaden ordinary concealed force disclosure.');
}

const cityIncome = (game: Game, actor: string, fixture: NoFieldFullPlanOccupyFixture) =>
  (occupyRicheseSeat(game, actor).forces[fixture.location] ?? 0) > 0 ? 2 : 0;

// One zero, one full positive and one capped positive marker, with both actual
// selected faction leads. The capped Ecaz case also distinguishes paid strength
// from unsupported physical losses without creating a cross-product of options.
for (const lead of ['ecaz', 'ally'] as const)
  for (const [marker, reserves] of [[0, 0], [3, 6], [5, 2]] as const)
    void test(`Private complete coalition plan: mixed marker ${marker}, reserves ${reserves}, ${lead} lead`, () => {
      const unsupported = lead === 'ecaz' && marker === 5;
      const fixture = noFieldFullPlanOccupyFixture({ lead, marker, richeseReserves: reserves,
        ...(unsupported ? { variableDial: 2, support: 0 } : {}) });
      ordinaryDialRemainsBlocked(fixture);
      const first = inspectAndSeal(fixture);
      assert.equal(viewGame(first, fixture.atreides).battle!.opponentForces, null);
      assert.equal(viewGame(first, fixture.atreides).battle!.ecazOccupy!.profile, null);
      const revealed = secondSeal(fixture, first);
      const done = finishNoFieldFullPlanOccupy(fixture, revealed);
      assert.equal(done.lastBattleContext!.result, 'normal');
      assert.equal(done.lastBattleContext!.winner, fixture.owner);
      const losses = unsupported ? fixture.variableDial * 2 : fixture.variableDial;
      assert.equal(occupyRicheseSeat(done, fixture.richese).forces[fixture.location] ?? 0,
        fixture.ordinary + fixture.materializes - losses);
      assert.equal(occupyRicheseSeat(done, fixture.richese).tanks - occupyRicheseSeat(fixture.prescience, fixture.richese).tanks, losses);
      assert.equal(occupyRicheseSeat(done, fixture.richese).reserves, reserves - fixture.materializes);
      assert.equal(occupyRicheseSeat(done, fixture.ecaz).forces[fixture.location], 2);
      assert.equal(occupyRicheseSeat(done, fixture.ecaz).tanks - occupyRicheseSeat(fixture.prescience, fixture.ecaz).tanks, 3);
      assert.equal(occupyRicheseSeat(done, fixture.owner).spice,
        occupyRicheseSeat(fixture.prescience, fixture.owner).spice - fixture.support + cityIncome(done, fixture.owner, fixture));
      const nonLead = fixture.owner === fixture.ecaz ? fixture.richese : fixture.ecaz;
      assert.equal(occupyRicheseSeat(done, nonLead).spice,
        occupyRicheseSeat(fixture.prescience, nonLead).spice + cityIncome(done, nonLead, fixture));
      assert.equal(occupyRicheseSeat(done, fixture.atreides).forces[fixture.location] ?? 0, 0);
      assert.equal(occupyRicheseSeat(done, fixture.atreides).tanks - occupyRicheseSeat(fixture.prescience, fixture.atreides).tanks, 8);
      assertHistory(fixture, revealed, done);
    });

for (const [lead, marker, reserves] of [['ecaz', 0, 0], ['ally', 5, 2]] as const)
  void test(`Marker-only ${lead} coalition still permits a private full plan, including marker ${marker}`, () => {
    const fixture = noFieldFullPlanOccupyFixture({ lead, marker, richeseReserves: reserves, ordinary: 0 });
    ordinaryDialRemainsBlocked(fixture);
    const revealed = secondSeal(fixture, inspectAndSeal(fixture));
    const done = finishNoFieldFullPlanOccupy(fixture, revealed);
    assert.equal(done.lastBattleContext!.winner, fixture.owner);
    assert.equal(occupyRicheseSeat(done, fixture.richese).tanks - occupyRicheseSeat(fixture.prescience, fixture.richese).tanks,
      fixture.variableDial);
    assert.equal(occupyRicheseSeat(done, fixture.ecaz).forces[fixture.location], 2);
    assertHistory(fixture, revealed, done);
  });

for (const lead of ['ecaz', 'ally'] as const)
  void test(`Distinct real CHOAM prevention leaves ${lead}'s own plan inspectable with native later marker reveal`, () => {
    const fixture = noFieldFullPlanOccupyFixture({ lead, marker: 5, richeseReserves: 2, prevented: true });
    assert.notEqual(fixture.preventionCard, fixture.inspectionCard);
    assert.equal(fixture.prescience.discard.filter(card => card.id === fixture.preventionCard).length, 1);
    assert.equal(occupyRicheseSeat(fixture.prescience, fixture.atreides).hand.some(card => card.id === fixture.inspectionCard), true);
    const profile = viewGame(fixture.prescience, fixture.owner).battle!.ecazOccupy!.profile!;
    assert.equal(profile.canceled, true);
    assert.equal(profile.forceOwner, fixture.owner);
    assert.equal(profile.fixedEcazDial, 0);
    assert.equal(profile.forces.normal, lead === 'ecaz' ? 5 : 4);
    assert.equal(profile.maxDial, lead === 'ecaz' ? 5 : 4);
    let offered: Game;
    if (lead === 'ecaz') {
      let asked = applyAction(fixture.prescience, fixture.atreides, { type: 'prescience', field: 'dial' });
      assert.equal(asked.battle!.preparation!.owner, fixture.ecaz);
      assertNativeMarker(fixture, asked);
      while (asked.response) asked = nextOccupyRichese(asked);
      const answered = applyAction(asked, fixture.ecaz, { type: 'prescienceAnswer', value: fixture.targetPlan.dial! });
      assert.equal(viewGame(answered, fixture.atreides).battle!.insight!.value, fixture.targetPlan.dial);
      assertNativeMarker(fixture, answered);
      offered = answered;
    } else {
      assert.throws(() => applyAction(fixture.prescience, fixture.atreides, { type: 'prescience', field: 'dial' }), /may not inspect/);
      offered = offerNoFieldFullPlanOccupy(fixture);
    }
    const revealed = secondSeal(fixture, inspectAndSeal(fixture, offered));
    const done = finishNoFieldFullPlanOccupy(fixture, revealed);
    assert.equal(done.lastBattleContext!.winner, fixture.owner);
    const ecazLoss = lead === 'ecaz' ? fixture.variableDial : 0;
    const richeseLoss = lead === 'ally' ? fixture.variableDial : 0;
    assert.equal(occupyRicheseSeat(done, fixture.ecaz).forces[fixture.location] ?? 0, 5 - ecazLoss);
    assert.equal(occupyRicheseSeat(done, fixture.richese).forces[fixture.location] ?? 0, 4 - richeseLoss);
    assert.equal(occupyRicheseSeat(done, fixture.ecaz).tanks - occupyRicheseSeat(fixture.prescience, fixture.ecaz).tanks, ecazLoss);
    assert.equal(occupyRicheseSeat(done, fixture.richese).tanks - occupyRicheseSeat(fixture.prescience, fixture.richese).tanks, richeseLoss);
    assert.equal(occupyRicheseSeat(done, fixture.owner).spice,
      occupyRicheseSeat(fixture.prescience, fixture.owner).spice - fixture.support + cityIncome(done, fixture.owner, fixture));
    assertHistory(fixture, revealed, done);
  });

for (const [lead, opposingTraitor] of [['ally', false], ['ecaz', true]] as const)
  void test(`Inspected actual ${lead}-held H/R ${opposingTraitor ? 'is canceled by a real opposing Traitor' : 'settles its original owner returns and costs'}`, () => {
    const fixture = noFieldFullPlanOccupyFixture({ lead, utilities: true, opposingTraitor });
    ordinaryDialRemainsBlocked(fixture);
    const revealed = secondSeal(fixture, inspectAndSeal(fixture));
    const done = finishNoFieldFullPlanOccupy(fixture, revealed);
    assert.equal(done.lastBattleContext!.result, opposingTraitor ? 'traitor' : 'normal');
    assert.equal(done.lastBattleContext!.winner, opposingTraitor ? fixture.atreides : fixture.owner);
    for (const card of ['ecaz-reinforcements', 'ecaz-harass-withdraw'])
      assert.equal(done.discard.filter(face => face.id === card).length, 1);
    for (const actor of [fixture.ecaz, fixture.richese]) {
      const before = occupyRicheseSeat(fixture.prescience, actor);
      const after = occupyRicheseSeat(done, actor);
      const materialized = actor === fixture.richese ? fixture.materializes : 0;
      const reserveCost = actor === fixture.owner ? 3 : 0;
      const returned = !opposingTraitor && actor === fixture.owner ? 2 : 0;
      assert.equal(after.reserves, before.reserves - materialized - reserveCost + returned,
        'R spends the card holder reserves; an opposing real Traitor cancels every H return.');
      const losses = opposingTraitor ? actor === fixture.ecaz ? 5 : fixture.ordinary + materialized
        : actor === fixture.ecaz ? 3 : fixture.variableDial;
      assert.equal(after.tanks - before.tanks, losses + reserveCost);
      const remaining = opposingTraitor || actor === fixture.owner ? 0 : 2;
      assert.equal(after.forces[fixture.location] ?? 0, remaining);
    }
    if (opposingTraitor) {
      const committedLeader = fixture.targetPlan.leader;
      assert.ok(typeof committedLeader === 'string');
      assert.ok(occupyRicheseSeat(fixture.prescience, fixture.atreides).traitors.includes(committedLeader));
      assert.equal(occupyRicheseSeat(done, fixture.owner).leaders.find(face => face.id === committedLeader)!.dead, true);
    } else assert.equal(occupyRicheseSeat(done, fixture.owner).spice,
      occupyRicheseSeat(fixture.prescience, fixture.owner).spice - fixture.support);
    assertHistory(fixture, revealed, done);
  });
