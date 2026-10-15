import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame } from '../game/engine';
import { DUKE_VIDAL_ID, dukeController } from '../game/duke-vidal';
import {
  advanceNexusDuke, assertNexusDukeCustody, createNexusDukeCaptureFixture,
  createNexusDukeDeathFixture, nexusDukeClean, nexusDukePlayer, quietNexusDukeWindow,
  reclaimCapturedNexusDuke, releaseCapturedNexusDukeByAllHarkDead,
  releaseCapturedNexusDukeByUse, openNexusDukeBattle, sealNexusDukeBattle, stepNexusDuke,
} from './fixture-nexus-duke-capture';

void test('a real Harkonnen Battle win captures the unused shared Duke', () => {
  const fixture = createNexusDukeCaptureFixture({ variant: 'unused' });
  const { owner, captor, game } = fixture;
  assert.ok(fixture.candidates.some((leader) => leader.id === DUKE_VIDAL_ID),
    'The shared disc must be in the actual original capture pool.');
  const duke = game.dukeVidal!;
  assert.equal(dukeController(duke), captor);
  assert.equal(duke.controller, owner, 'An unused disc keeps its underlying Ecaz tenure.');
  assert.equal(duke.source, 'ecaz');
  assert.equal(duke.leader.capturedBy, captor);
  assert.equal(duke.leader.dead, false);
  assert.equal(duke.leader.deaths, 0);
  assert.equal(duke.leader.usedAt, undefined);
  assert.equal(duke.leader.gholaBy, undefined);
  // The just-used native losing leader keeps its own one-battle release.
  assert.equal(nexusDukePlayer(fixture.game, owner).leaders
    .filter((leader) => leader.usedAt === 'carthag').length, 1);
  assertNexusDukeCustody(game);
});

void test('a just-used Duke is captured from its original battle release through the witness', () => {
  const fixture = createNexusDukeCaptureFixture({ variant: 'used' });
  const { captor, game } = fixture;
  const duke = game.dukeVidal!;
  assert.equal(dukeController(duke), captor);
  assert.equal(duke.controller, null, 'A released battle disc keeps no underlying control.');
  assert.equal(duke.acquiredTurn, null);
  assert.equal(duke.source, null);
  assert.equal(duke.leader.capturedBy, captor);
  assert.equal(duke.leader.usedAt, 'carthag');
  assert.equal(duke.leader.dead, false);
  assert.equal(duke.leader.deaths, 0);
  assertNexusDukeCustody(game);
});

void test('executing the captive disc pays the original bounty and hides the death from unrelated seats', () => {
  const fixture = createNexusDukeCaptureFixture({ variant: 'used', mode: 'execute' });
  const { owner, captor } = fixture;
  const before = fixture.decision!.before, after = fixture.decision!.after;
  const prior = before.dukeVidal!;
  const duke = after.dukeVidal!;
  assert.equal(prior.leader.deaths, 0);
  assert.equal(duke.leader.dead, true);
  assert.equal(duke.leader.deaths, Math.max(2, prior.leader.deaths + 1));
  assert.equal(duke.leader.capturedBy, undefined);
  assert.equal(dukeController(duke), null, 'An executed disc is set aside in the Tanks.');
  assert.equal(duke.controller, null);
  assert.equal(duke.source, null);
  assert.equal(duke.acquiredTurn, null);
  assert.equal(duke.leader.faction, 'ecaz');
  assert.equal(duke.leader.strength, 6);
  assert.equal(nexusDukePlayer(after, captor).spice,
    nexusDukePlayer(before, captor).spice + 2, 'The captor is paid the printed 2 spice.');
  assert.equal(nexusDukePlayer(after, owner).spice, nexusDukePlayer(before, owner).spice);
  assert.equal(nexusDukePlayer(after, owner).leaders.length, 5);
  const unrelated = fixture.others.find((id) => id !== owner && id !== captor)!;
  assert.deepEqual(viewGame(after, unrelated).dukeVidal!.leader,
    viewGame(before, unrelated).dukeVidal!.leader,
    'A private execution never discloses the secret selection or death to unrelated seats.');
  assert.equal(viewGame(after, owner).dukeVidal!.leader.dead, true);
  assert.equal(viewGame(after, captor).dukeVidal!.leader.dead, true);
  assertNexusDukeCustody(after);
});

void test('genuine Ecaz Nexus Cunning liberates the actual captured disc through the real closing draw', () => {
  const fixture = createNexusDukeCaptureFixture({ variant: 'unused' });
  const { owner, captor, plan } = fixture;
  assert.equal(dukeController(fixture.game.dukeVidal!), captor);
  const reclaim = reclaimCapturedNexusDuke(fixture.game, plan);
  const holder = nexusDukePlayer(reclaim.before, owner);
  const spice = holder.spice, forces = structuredClone(holder.forces), tanks = holder.tanks;
  const revived = holder.leaderRevived;
  const duke = reclaim.after.dukeVidal!;
  assert.equal(dukeController(duke), owner);
  assert.equal(duke.controller, owner);
  assert.equal(duke.source, 'ecazNexus');
  assert.equal(duke.leader.capturedBy, undefined);
  assert.equal(duke.leader.concealed, undefined);
  assert.equal(duke.leader.dead, false);
  assert.equal(duke.leader.deaths, fixture.duke.leader.deaths, 'Liberation preserves death history.');
  assert.equal(duke.leader.gholaBy, undefined);
  assert.ok(reclaim.after.nexusCards!.cards!.discard.includes('ecaz'),
    'The physical Ecaz Nexus card is spent by the play.');
  const liberator = nexusDukePlayer(reclaim.after, owner);
  assert.equal(liberator.spice, spice, 'Liberation costs no spice.');
  assert.deepEqual(liberator.forces, forces);
  assert.equal(liberator.tanks, tanks);
  assert.equal(liberator.leaderRevived, revived, 'Liberation spends no ordinary leader slot.');
  assert.equal(liberator.leaders.length, 5);
  assert.equal(nexusDukePlayer(reclaim.after, captor).spice, nexusDukePlayer(reclaim.before, captor).spice);
  assertNexusDukeCustody(reclaim.after);
});

void test('a liberated Duke fights once through the native battle path', () => {
  const fixture = createNexusDukeCaptureFixture({ variant: 'unused' });
  const { owner, captor, plan, actions } = fixture;
  const reclaim = reclaimCapturedNexusDuke(fixture.game, plan, actions, { battle: true });
  const battle = openNexusDukeBattle(reclaim.after, plan, actions,
    { territory: 'carthag', first: owner, second: captor });
  const enemy = nexusDukePlayer(battle.game, captor).leaders
    .filter((leader) => !leader.dead).sort((a, b) => a.strength - b.strength)[0];
  assert.ok(enemy);
  const revealed = sealNexusDukeBattle(battle.game, plan, actions, [
    { actor: owner, leader: DUKE_VIDAL_ID, dial: 0, support: 0 },
    { actor: captor, leader: enemy.id, dial: 0, support: 0 },
  ]);
  const after = advanceNexusDuke(revealed, (game) => !game.battle && nexusDukeClean(game), plan, actions);
  assert.equal(after.dukeVidal!.leader.dead, false);
  assert.equal(after.dukeVidal!.leader.deaths, fixture.duke.leader.deaths);
  assert.equal(after.dukeVidal!.leader.usedAt, 'carthag');
  assert.equal(dukeController(after.dukeVidal!), null);
  assert.equal(after.dukeVidal!.leader.capturedBy, undefined);
  assert.equal(after.dukeVidal!.leader.concealed, undefined);
  assertNexusDukeCustody(after);
});

void test('unused liberated Nexus tenure expires at the original turn end without restoring captivity', () => {
  const fixture = createNexusDukeCaptureFixture({ variant: 'unused' });
  const { plan, actions } = fixture;
  const reclaim = reclaimCapturedNexusDuke(fixture.game, plan, actions);
  const battle = openNexusDukeBattle(reclaim.after, plan, actions,
    { territory: 'carthag', first: fixture.owner, second: fixture.captor });
  const own = nexusDukePlayer(battle.game, fixture.owner).leaders
    .filter(leader => !leader.dead).sort((a, b) => b.strength - a.strength)[0];
  const enemy = nexusDukePlayer(battle.game, fixture.captor).leaders
    .filter(leader => !leader.dead).sort((a, b) => a.strength - b.strength)[0];
  assert.ok(own && enemy);
  const revealed = sealNexusDukeBattle(battle.game, plan, actions, [
    { actor: fixture.owner, leader: own.id, dial: 0, support: 0 },
    { actor: fixture.captor, leader: enemy.id, dial: 0, support: 0 },
  ]);
  const after = advanceNexusDuke(revealed, (game) => game.turn > reclaim.after.turn, plan, actions);
  assert.equal(dukeController(after.dukeVidal!), null);
  assert.equal(after.dukeVidal!.controller, null);
  assert.equal(after.dukeVidal!.source, null);
  assert.equal(after.dukeVidal!.acquiredTurn, null);
  assert.equal(after.dukeVidal!.leader.capturedBy, undefined);
  assert.equal(after.dukeVidal!.leader.concealed, undefined);
  assert.equal(after.dukeVidal!.leader.dead, false);
  assert.equal(after.dukeVidal!.leader.deaths, fixture.duke.leader.deaths);
  assertNexusDukeCustody(after);
});

void test('a later real Battle use releases the retained captive disc', () => {
  const fixture = createNexusDukeCaptureFixture({ variant: 'unused' });
  const { owner, plan } = fixture;
  const release = releaseCapturedNexusDukeByUse(fixture.game, plan);
  const duke = release.game.dukeVidal!;
  assert.equal(duke.leader.capturedBy, undefined);
  assert.equal(duke.leader.concealed, undefined);
  assert.equal(dukeController(duke), null);
  assert.equal(duke.controller, null);
  assert.equal(duke.acquiredTurn, null);
  assert.equal(duke.source, null);
  assert.equal(duke.leader.dead, false);
  assert.equal(duke.leader.deaths, fixture.duke.leader.deaths);
  assert.equal(duke.leader.usedAt, 'imperial_basin',
    'The one-battle use stamps the shared disc at the real Battle territory.');
  assert.equal(nexusDukePlayer(release.game, owner).leaders.every((leader) => !leader.dead), true);
  assertNexusDukeCustody(release.game);
});

void test('all native Harkonnen leaders dead returns the captive disc to its underlying Ecaz custody', () => {
  const fixture = createNexusDukeCaptureFixture({ variant: 'unused' });
  const { owner, captor, plan } = fixture;
  const returned = releaseCapturedNexusDukeByAllHarkDead(fixture.game, plan);
  assert.equal(returned.deaths.length, 5);
  assert.deepEqual(returned.deaths.map((entry) => entry.leader).sort(),
    nexusDukePlayer(fixture.game, captor).leaders.map((leader) => leader.id).sort());
  assert.deepEqual(nexusDukePlayer(returned.game, captor).leaders.filter((leader) => !leader.dead), []);
  const duke = returned.game.dukeVidal!;
  assert.equal(duke.leader.capturedBy, undefined);
  assert.equal(duke.leader.concealed, undefined);
  assert.equal(dukeController(duke), owner,
    'The early return restores the still-valid original Ecaz tenure.');
  assert.equal(duke.controller, owner);
  assert.equal(duke.source, 'ecaz');
  assert.equal(duke.acquiredTurn, 1);
  assert.equal(duke.leader.dead, false);
  assert.equal(duke.leader.deaths, fixture.duke.leader.deaths);
  assertNexusDukeCustody(returned.game);
});

void test('a genuine dead Duke is dealt the printed Ecaz Ghola and then taken by quiet Cunning', () => {
  const death = createNexusDukeDeathFixture({
    deal: (faction) => faction === 'ecaz' ? ['ghola']
      : faction === 'harkonnen' ? ['worthless', 'poison'] : ['worthless'],
  });
  const { owner, plan } = death;
  assert.equal(death.game.dukeVidal!.leader.dead, true);
  assert.ok(death.deaths >= 1);
  assert.equal(death.game.dukeVidal!.leader.capturedBy, undefined);
  assert.equal(death.game.dukeVidal!.leader.gholaBy, undefined);
  assert.equal(death.window.nexusCards!.cards!.hands[owner], 'ecaz');
  const ghola = nexusDukePlayer(death.window, owner).hand.find((card) => card.effect === 'ghola');
  assert.ok(ghola, 'The real setup deal must leave Ecaz holding the printed Ghola card.');
  const slot = nexusDukePlayer(death.window, owner).leaderRevived;
  const revived = stepNexusDuke(death.window, plan,
    { actor: owner, action: { type: 'card', card: ghola.id, leader: DUKE_VIDAL_ID } }, death.actions);
  const disc = revived.dukeVidal!;
  assert.equal(disc.leader.dead, false);
  assert.equal(disc.leader.deaths, death.deaths, 'The Ghola return preserves death history.');
  assert.equal(disc.leader.usedAt, undefined);
  assert.equal(disc.leader.gholaBy, undefined, 'No foreign-Ghola custody is ever produced.');
  assert.equal(disc.controller, null);
  assert.equal(disc.source, null);
  assert.equal(dukeController(disc), null);
  assert.equal(nexusDukePlayer(revived, owner).leaderRevived, slot,
    'The printed Ghola spends no ordinary leader-revival allowance.');
  assert.equal(nexusDukePlayer(revived, owner).leaders.length, 5);
  assertNexusDukeCustody(revived);
  const window = quietNexusDukeWindow(revived, plan);
  const taken = stepNexusDuke(window.game, plan, { actor: owner, action: window.action }, death.actions);
  assert.equal(dukeController(taken.dukeVidal!), owner);
  assert.equal(taken.dukeVidal!.source, 'ecazNexus');
  assert.equal(taken.dukeVidal!.leader.capturedBy, undefined);
  assert.equal(taken.dukeVidal!.leader.gholaBy, undefined);
  assert.equal(taken.dukeVidal!.leader.deaths, death.deaths);
  assert.equal(nexusDukePlayer(taken, owner).leaders.length, 5);
  assert.ok(!taken.players.some((player) => player.leaders.some((leader) => leader.id === DUKE_VIDAL_ID)));
  assert.equal(taken.players.flatMap((player) => player.traitors).includes(DUKE_VIDAL_ID), false);
  assertNexusDukeCustody(taken);
});
