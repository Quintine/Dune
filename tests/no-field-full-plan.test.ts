import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import {
  applyNoFieldFullPlanStep, createNoFieldFullPlanFixture, finishNoFieldFullPlanBattle,
  noFieldFullPlanPlayer, type NoFieldFullPlanFixture, type NoFieldFullPlanOptions,
} from './fixture-no-field-full-plan';

function rejectedUnchanged(game: Game, actor: string, action: Action, reason?: RegExp) {
  const before = structuredClone(game);
  if (reason) assert.throws(() => applyAction(game, actor, action), reason);
  else assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
function assertCustody(fixture: NoFieldFullPlanFixture, game: Game) {
  const cards = (state: Game) => [
    ...state.deck, ...state.discard, ...(state.richeseCache ?? []), ...(state.richeseRemoved ?? []),
    ...state.players.flatMap(p => p.hand),
  ].map(c => c.id).sort();
  const actual = cards(game);
  assert.equal(actual.length, new Set(actual).size);
  assert.deepEqual(actual, cards(fixture.afterSetup));
  const traitors = (state: Game) => [
    ...(state.traitorReserve ?? []), ...state.players.flatMap(p => p.traitors),
  ].sort();
  assert.deepEqual(traitors(game), traitors(fixture.afterSetup));
  for (const player of game.players) {
    assert.ok(player.hand.length <= 4);
    const counters = [player.reserves, player.tanks, ...Object.values(player.forces)];
    assert.equal(counters.reduce((sum, n) => sum + n, 0), 20);
    assert.ok(counters.every(n => Number.isSafeInteger(n) && n >= 0));
  }
}
function assertStillConcealed(fixture: NoFieldFullPlanFixture, game: Game) {
  const original = noFieldFullPlanPlayer(fixture.game, fixture.owner);
  const current = noFieldFullPlanPlayer(game, fixture.owner);
  assert.deepEqual(current.noField, original.noField);
  assert.equal(current.noFieldEvent, original.noFieldEvent);
  assert.equal(current.reserves, original.reserves);
  assert.deepEqual(current.forces, original.forces);
  assert.equal(current.spice, original.spice);
  for (const actor of [fixture.atreides, fixture.observer]) {
    const visible = viewGame(game, actor).players.find(p => p.id === fixture.owner)!;
    assert.ok(visible.noField?.deployed);
    assert.equal(visible.noField.lastUsed, null);
    assert.equal('private' in visible.noField, false);
    assert.equal(visible.hand, undefined);
  }
  assertCustody(fixture, game);
}
function assertNativeMaterialization(fixture: NoFieldFullPlanFixture, revealed: Game, done: Game) {
  const original = noFieldFullPlanPlayer(fixture.game, fixture.owner);
  const exposed = noFieldFullPlanPlayer(revealed, fixture.owner);
  const finished = noFieldFullPlanPlayer(done, fixture.owner);
  assert.equal(revealed.battle?.revealed, true);
  assert.equal(exposed.noField!.deployed, null);
  assert.equal(exposed.reserves, original.reserves - fixture.materializes);
  assert.equal(exposed.forces[fixture.location] ?? 0,
    (original.forces[fixture.location] ?? 0) + fixture.materializes);
  assert.equal(exposed.forces[fixture.otherLocation] ?? 0, original.forces[fixture.otherLocation] ?? 0);
  assert.deepEqual(exposed.noField!.tokens, original.noField!.tokens);
  assert.equal(exposed.noField!.lastShipped, fixture.token.id);
  assert.notEqual(exposed.noFieldEvent, original.noFieldEvent);
  assert.equal(done.battle, null);
  assert.equal(finished.noField!.deployed, null);
  assert.deepEqual(finished.noField!.tokens, original.noField!.tokens);
  assert.equal(finished.noField!.lastShipped, fixture.token.id);
  assert.equal(finished.noFieldEvent, exposed.noFieldEvent);
  for (const actor of [fixture.owner, fixture.atreides, fixture.observer]) {
    const publicOwner = viewGame(done, actor).players.find(p => p.id === fixture.owner)!;
    assert.equal(publicOwner.noField!.deployed, null);
    assert.equal(publicOwner.noField!.lastUsed, fixture.token.value);
    assert.equal(viewGame(revealed, actor).battle!.fullPlanInsight, null);
    assert.deepEqual(viewGame(revealed, actor).battle!.plans[fixture.owner], revealed.battle!.plans[fixture.owner]);
  }
  assertCustody(fixture, revealed);
  assertCustody(fixture, done);
}

const materializationCases: { name: string; options: NoFieldFullPlanOptions }[] = [
  { name: 'zero token still commits a leader and both physical battle cards', options: { marker: 0 } },
  { name: 'positive token materializes three counters only at both seals', options: { marker: 3 } },
  { name: 'five token is capped by two actual own reserves', options: { marker: 5, reserves: 2, dial: 1 } },
  { name: 'ordinary counters in two sectors combine with the marker pool', options: {
    marker: 3, ordinaryAtMarker: 1, ordinaryOtherSector: 2, dial: 3.5, support: 2,
  } },
];
for (const { name, options } of materializationCases) {
  void test(`Advanced special full-plan inspection: ${name}`, () => {
    const fixture = createNoFieldFullPlanFixture(options);
    const { owner, atreides, observer, cards } = fixture;
    const original = noFieldFullPlanPlayer(fixture.game, owner);
    assert.ok(noFieldFullPlanPlayer(fixture.afterShipment, owner).noField!.deployed);
    assert.equal(fixture.beforePrescience.battle?.preLeader?.closed, true);
    assert.equal(fixture.beforePrescience.battle?.preparation?.kind, 'prescience');
    rejectedUnchanged(fixture.beforePrescience, atreides, { type: 'prescience', field: 'dial' }, /may not inspect the number dialed/);
    rejectedUnchanged(fixture.beforePrescience, atreides, fixture.inspectStep.action, /preparation/);
    assert.equal(fixture.beforeAnswer.battle?.preparation?.kind, 'prescienceAnswer');
    assert.equal(viewGame(fixture.game, atreides).battle!.insight!.field, 'leader');
    assert.equal(viewGame(fixture.game, atreides).battle!.fullPlanInsight, null);
    assert.equal(fixture.game.decision?.kind, 'fullPlanOffer');

    const waiting = applyNoFieldFullPlanStep(fixture.game, fixture.inspectStep);
    assert.equal(noFieldFullPlanPlayer(waiting, atreides).specialKaramaUsed, true);
    assert.equal(noFieldFullPlanPlayer(waiting, atreides).hand.some(c => c.id === cards.karama.id), false);
    assert.equal(waiting.discard.filter(c => c.id === cards.karama.id).length, 1);
    assert.ok(noFieldFullPlanPlayer(waiting, atreides).hand.some(c => c.id === cards.spareKarama.id));
    assert.equal(waiting.response, null);
    assert.equal(waiting.decision, null);
    rejectedUnchanged(waiting, atreides, fixture.planActions[1].action, /requested by special/);
    rejectedUnchanged(waiting, atreides, { ...fixture.inspectStep.action, card: cards.spareKarama.id }, /already been used/);
    // Ordinary prescience remains a commitment even when the separate full-plan power is spent.
    const changedLeader = original.leaders.find(leader =>
      !leader.dead && leader.id !== fixture.planActions[0].action.leader)!;
    rejectedUnchanged(waiting, owner, { ...fixture.planActions[0].action, leader: changedLeader.id }, /remain unchanged/);
    assertStillConcealed(fixture, waiting);

    const reading = applyNoFieldFullPlanStep(waiting, fixture.planActions[0]);
    assert.equal(reading.battle!.revealed, false);
    assert.equal(reading.decision, null);
    assert.equal(reading.response, null);
    assertStillConcealed(fixture, reading);
    const insight = viewGame(reading, atreides).battle!.fullPlanInsight!;
    assert.equal(insight.target, owner);
    assert.equal(insight.plan.dial, fixture.planActions[0].action.dial);
    assert.equal(insight.plan.support, fixture.planActions[0].action.support);
    assert.equal(insight.plan.leader, fixture.planActions[0].action.leader);
    assert.equal(insight.plan.weapon, cards.weapon.id);
    assert.equal(insight.plan.defense, cards.defense.id);
    assert.deepEqual(insight.cards.map(c => ({ id: c.id, name: c.name })).sort((a, b) => a.id.localeCompare(b.id)),
      [cards.weapon, cards.defense].map(c => ({ id: c.id, name: c.name })).sort((a, b) => a.id.localeCompare(b.id)));
    assert.equal(viewGame(reading, atreides).battle!.plans[owner], undefined);
    assert.deepEqual(viewGame(reading, owner).battle!.plans[owner], reading.battle!.plans[owner]);
    for (const actor of [owner, observer]) assert.equal(viewGame(reading, actor).battle!.fullPlanInsight, null);
    assert.equal(viewGame(reading, observer).battle!.plans[owner], undefined);
    assert.equal(viewGame(reading, observer).battle!.insight, null);
    const newLogs = reading.log.slice(fixture.game.log.length);
    assert.ok(newLogs.every(entry => !entry.text.includes(cards.weapon.name) && !entry.text.includes(cards.defense.name)));
    rejectedUnchanged(reading, owner, { ...fixture.planActions[0].action, dial: 0 }, /not available/);
    rejectedUnchanged(reading, owner, { ...fixture.planActions[0].action, defense: null }, /not available/);
    rejectedUnchanged(reading, atreides, { type: 'decision', continue: true }, /not available/);

    // The private read continues directly into the original opposing plan; no acknowledgement or marker action.
    const revealed = applyNoFieldFullPlanStep(reading, fixture.planActions[1]);
    const done = finishNoFieldFullPlanBattle(revealed);
    assertNativeMaterialization(fixture, revealed, done);
    assert.equal(done.lastBattleContext?.winner, atreides);
    const lost = noFieldFullPlanPlayer(done, owner);
    const battlePool = (original.forces[fixture.location] ?? 0) + (original.forces[fixture.otherLocation] ?? 0) + fixture.materializes;
    assert.equal(lost.tanks, battlePool);
    assert.equal(lost.forces[fixture.location] ?? 0, 0);
    assert.equal(lost.forces[fixture.otherLocation] ?? 0, 0);
    assert.equal(lost.spice, original.spice - Number(fixture.planActions[0].action.support));
    assert.ok(done.discard.some(c => c.id === cards.weapon.id));
    assert.ok(done.discard.some(c => c.id === cards.defense.id));
    assert.equal(done.discard.filter(c => c.id === cards.karama.id).length, 1);
    assert.equal(lost.leaders.find(l => l.id === fixture.planActions[0].action.leader)!.dead, false);
    assert.equal(noFieldFullPlanPlayer(done, atreides).specialKaramaUsed, true);
  });
}

void test('each permitted ordinary element can answer against a concealed marker, then declining preserves the physical power and ordinary planning', () => {
  for (const ordinaryField of ['leader', 'weapon', 'defense'] as const) {
    const fixture = createNoFieldFullPlanFixture({ marker: 3, ordinaryField });
    const { owner, atreides, cards } = fixture;
    rejectedUnchanged(fixture.beforePrescience, atreides, { type: 'prescience', field: 'dial' }, /may not inspect the number dialed/);
    assert.equal(fixture.beforeAnswer.battle?.preparation?.kind, 'prescienceAnswer');
    assert.equal(viewGame(fixture.game, atreides).battle!.insight!.field, ordinaryField);
    assert.equal(viewGame(fixture.game, atreides).battle!.insight!.value, fixture.answerStep.action.value);
    const declined = applyNoFieldFullPlanStep(fixture.game, fixture.declineStep);
    assert.equal(noFieldFullPlanPlayer(declined, atreides).specialKaramaUsed, undefined);
    assert.ok(noFieldFullPlanPlayer(declined, atreides).hand.some(c => c.id === cards.karama.id));
    assert.equal(viewGame(declined, atreides).atreidesFullPlan?.blocked, null);
    // No special target-first gate survives decline: Atreides may seal first.
    const first = applyNoFieldFullPlanStep(declined, fixture.planActions[1]);
    assert.equal(first.battle!.revealed, false);
    assert.equal(viewGame(first, owner).battle!.plans[atreides], undefined);
    assertStillConcealed(fixture, first);
    const revealed = applyNoFieldFullPlanStep(first, fixture.planActions[0]);
    const done = finishNoFieldFullPlanBattle(revealed);
    assertNativeMaterialization(fixture, revealed, done);
    assert.equal(done.lastBattleContext?.winner, atreides);
    assert.ok(noFieldFullPlanPlayer(done, atreides).hand.some(c => c.id === cards.karama.id));
    assert.equal(noFieldFullPlanPlayer(done, atreides).specialKaramaUsed, undefined);
    assert.equal(done.discard.some(c => c.id === cards.karama.id), false);
  }
});

void test('a real conserved Traitor declaration after inspected mixed-plan reveal uses native losses and cannot reveal the marker twice', () => {
  const fixture = createNoFieldFullPlanFixture({ marker: 5, reserves: 2,
    ordinaryAtMarker: 1, ordinaryOtherSector: 1, dial: 2, traitor: 'atreides' });
  let game = applyNoFieldFullPlanStep(fixture.game, fixture.inspectStep);
  game = applyNoFieldFullPlanStep(game, fixture.planActions[0]);
  assertStillConcealed(fixture, game);
  const revealed = applyNoFieldFullPlanStep(game, fixture.planActions[1]);
  const done = finishNoFieldFullPlanBattle(revealed, [fixture.atreides]);
  assertNativeMaterialization(fixture, revealed, done);
  assert.equal(done.lastBattleContext?.winner, fixture.atreides);
  const owner = noFieldFullPlanPlayer(done, fixture.owner);
  assert.equal(owner.tanks, 4);
  assert.equal(owner.leaders.find(l => l.id === fixture.planActions[0].action.leader)!.dead, true);
  assert.equal(noFieldFullPlanPlayer(done, fixture.atreides).tanks, 0);
  assert.equal(noFieldFullPlanPlayer(done, fixture.atreides).forces[fixture.location], 5);
});
