import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game } from '../game/engine';
import { distance, splitLocation } from '../game/board';
import { fighterCount } from '../game/advisors';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { nexusAdvisorAction } from '../game/nexus-advisor-options';
import {
  createNexusAdvisorFreshFixture, nexusAdvisorFreshPlayer, settleNexusAdvisorFresh,
} from './fixture-nexus-advisor-fresh';

/** Stance/card changes must not alter physical pools, resources or the native turn. */
function unchangedFrame(game: Game) {
  return {
    status: game.status, turn: game.turn, phase: game.phase, active: game.active,
    order: game.order, remaining: game.movementRemaining, spice: game.spice,
    storm: game.storm, hajr: game.hajr, guildTimingGranted: game.guildTimingGranted,
    guildTimingLocked: game.guildTimingLocked,
    players: game.players.map(player => ({
      id: player.id, forces: player.forces, reserves: player.reserves, tanks: player.tanks,
      elites: player.elites, spice: player.spice, shipped: player.shipped, moved: player.moved,
    })),
  };
}


void test('fresh Cunning spends its physical card once and resumes the original shipment/movement turn in place', () => {
  const fixture = createNexusAdvisorFreshFixture();
  const { owner, territory, location } = fixture;
  const frame = structuredClone(unchangedFrame(fixture.game));
  const offer = viewGame(fixture.game, owner).nexusAdvisors!.offer!;
  assert.equal(offer.blocked, null);
  assert.deepEqual(offer.territories.find(group => group.territory === territory), { territory, count: 2, blocked: null });
  const declaration = nexusAdvisorAction(viewGame(fixture.game, owner), offer.event, [territory]);
  const pending = applyAction(fixture.game, owner, declaration!);
  assert.equal(pending.response!.kind, 'nexusAdvisorFlip');
  assert.equal(nexusAdvisorFreshPlayer(pending, owner).advisors![territory].lockedTurn, pending.turn);
  assert.equal(pending.nexusCards!.cards!.hands[owner], null);
  assert.equal(pending.nexusCards!.cards!.discard.filter(face => face === 'beneGesserit').length, 1);
  assert.deepEqual(unchangedFrame(pending), frame);
  assert.throws(() => applyAction(pending, owner, fixture.declaration));
  const allowed = settleNexusAdvisorFresh(pending);
  assert.equal(nexusAdvisorFreshPlayer(allowed, owner).advisors?.[territory], undefined);
  assert.deepEqual(nexusAdvisorFreshPlayer(allowed, owner).advisors?.arrakeen, {});
  assert.equal(nexusAdvisorFreshPlayer(allowed, owner).forces[location], 2);
  assert.equal(fighterCount(nexusAdvisorFreshPlayer(allowed, owner), territory), 2);
  assert.equal(allowed.nexusAdvisorHistory!.at(-1)!.stage, 'completed');
  assert.deepEqual(unchangedFrame(allowed), frame);
  assert.equal(allowed.nexusCards!.cards!.discard.filter(face => face === 'beneGesserit').length, 1);
  assert.throws(() => applyAction(allowed, owner, fixture.declaration));
  assert.equal(viewGame(allowed, owner).nexusAdvisors!.offer, null);
  const continued = settleNexusAdvisorFresh(applyAction(allowed, owner, { type: 'endMovement' }));
  assert.equal(nexusAdvisorFreshPlayer(continued, owner).forces[location], 2);
});

void test('original Karama cancels the entire selected batch and preserves the current-turn lock and native continuation', () => {
  const fixture = createNexusAdvisorFreshFixture();
  const frame = structuredClone(unchangedFrame(fixture.game));
  const stances = structuredClone(nexusAdvisorFreshPlayer(fixture.game, fixture.owner).advisors);
  const pending = applyAction(fixture.game, fixture.owner, fixture.batchDeclaration);
  assert.deepEqual(pending.nexusAdvisorHistory!.at(-1)!.receipt.selections.map(group => group.territory), ['arrakeen', fixture.territory]);
  const canceled = settleNexusAdvisorFresh(applyAction(pending, fixture.canceler, { type: 'card', card: fixture.card, mode: 'cancel' }));
  assert.equal(canceled.nexusAdvisorHistory!.at(-1)!.stage, 'canceled');
  assert.deepEqual(nexusAdvisorFreshPlayer(canceled, fixture.owner).advisors, stances);
  assert.equal(nexusAdvisorFreshPlayer(canceled, fixture.owner).advisors![fixture.territory].lockedTurn, canceled.turn);
  assert.equal(fighterCount(nexusAdvisorFreshPlayer(canceled, fixture.owner), fixture.territory), 0);
  assert.deepEqual(unchangedFrame(canceled), frame);
  assert.equal(canceled.nexusCards!.cards!.hands[fixture.owner], null);
  assert.equal(canceled.nexusCards!.cards!.discard.filter(face => face === 'beneGesserit').length, 1);
  assert.ok(!nexusAdvisorFreshPlayer(canceled, fixture.canceler).hand.some(card => card.id === fixture.card));
  assert.equal(canceled.discard.filter(card => card.id === fixture.card).length, 1);
  assert.throws(() => applyAction(canceled, fixture.owner, fixture.declaration));
  assert.throws(() => applyAction(canceled, fixture.owner, fixture.ordinaryAction), /advisors cannot flip|New advisors cannot become fighters/i);
  const continued = settleNexusAdvisorFresh(applyAction(canceled, fixture.owner, { type: 'endMovement' }));
  assert.notEqual(continued.active, fixture.owner);
  assert.ok(!continued.movementRemaining!.includes(fixture.owner));
  assert.deepEqual(nexusAdvisorFreshPlayer(continued, fixture.owner).advisors, stances);
});

void test('ordinary fighter arrival remains illegal for the fresh group but its same native action works after Cunning', () => {
  const fixture = createNexusAdvisorFreshFixture();
  const { game, owner, location, ordinaryAction } = fixture;
  assert.equal(distance(location, fixture.scenario.ordinaryTarget, key => splitLocation(key).sector === game.storm), 1);
  assert.equal(nexusAdvisorFreshPlayer(game, 'atreides').forces[fixture.scenario.ordinaryTarget], 1);
  assert.equal(nexusAdvisorFreshPlayer(game, owner).forces[fixture.scenario.ordinaryTarget], undefined);
  assert.throws(() => applyAction(game, owner, ordinaryAction), /advisors cannot flip|New advisors cannot become fighters/i);
  const converted = settleNexusAdvisorFresh(applyAction(game, owner, fixture.declaration));
  const moved = settleNexusAdvisorFresh(applyAction(converted, owner, ordinaryAction));
  const player = nexusAdvisorFreshPlayer(moved, owner);
  assert.equal(player.forces[location], 1);
  assert.equal(player.forces[fixture.scenario.ordinaryTarget], 1);
  assert.equal(player.advisors?.imperial_basin, undefined);
  assert.equal(player.moved, nexusAdvisorFreshPlayer(game, owner).moved + 1);
  assert.equal(player.spice, nexusAdvisorFreshPlayer(game, owner).spice);
});

void test('fresh native Cunning rejects other actors, stale events, extra keys and duplicate whole territories atomically', () => {
  const fixture = createNexusAdvisorFreshFixture();
  const before = structuredClone(fixture.game);
  const rejected = [
    { actor: fixture.foreign, action: fixture.declaration },
    { actor: fixture.owner, action: { ...fixture.declaration, event: `${fixture.event}:stale` } },
    { actor: fixture.owner, action: { ...fixture.declaration, amount: 1 } },
    { actor: fixture.owner, action: { ...fixture.declaration, territories: [fixture.territory, fixture.territory] } },
  ];
  for (const step of rejected) {
    assert.throws(() => applyAction(fixture.game, step.actor, step.action));
    assert.deepEqual(fixture.game, before);
  }
  const view = viewGame(fixture.game, fixture.owner);
  assert.equal(nexusAdvisorAction(view, `${fixture.event}:stale`, [fixture.territory]), null);
  assert.equal(nexusAdvisorAction(view, fixture.event, [fixture.territory, fixture.territory]), null);
});

void test('all four unchanged policies Use the favorable actual fresh group and complete the same native response and turn', () => {
  const fixture = createNexusAdvisorFreshFixture();
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(fixture.game, fixture.owner);
    view.players.find(player => player.id === fixture.owner)!.bot = difficulty;
    const action = botActions(view)[0];
    assert.ok(action, `${difficulty} must produce a legal active-turn action`);
    const used = applyAction(fixture.game, fixture.owner, action);
    assert.equal(used.response!.kind, 'nexusAdvisorFlip', difficulty);
    const allowed = settleNexusAdvisorFresh(used);
    assert.equal(fighterCount(nexusAdvisorFreshPlayer(allowed, fixture.owner), fixture.territory), 2, difficulty);
    assert.equal(nexusAdvisorFreshPlayer(allowed, fixture.owner).advisors?.[fixture.territory], undefined, difficulty);
    assert.deepEqual(unchangedFrame(allowed), unchangedFrame(fixture.game), difficulty);
    const continued = settleNexusAdvisorFresh(applyAction(allowed, fixture.owner, { type: 'endMovement' }));
    assert.notEqual(continued.active, fixture.owner, difficulty);
  }
});
