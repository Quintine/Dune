import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import {
  advanceEcazNexusSkillsModules as advance, assertEcazNexusSkillsModulesCustody as custody,
  createEcazNexusSkillsModulesFixture as fixture, ecazNexusSkillsModulesClean as clean,
  ecazNexusSkillsModulesPlayer as player, holdEcazNexusSkillsModulesCard as hold,
  nextEcazNexusSkillsModulesStep as next, placeEcazNexusSkillsModulesForce as place,
  revealEcazNexusSkillsModulesBattle as reveal, settleEcazNexusSkillsModulesBattle as settle,
  stepEcazNexusSkillsModules as step,
} from './fixture-ecaz-nexus-skills-modules';

function coalition(tech: boolean, stronghold: boolean, trained: boolean,
  skill: 'suk-graduate' | 'diplomat' = 'suk-graduate', losing = false) {
  const f = fixture({ rules: 'advanced', tech, stronghold, skill, kind: 'suk', band: trained ? 'skilled' : 'normal' });
  let game = structuredClone(f.beforeAlliance);
  // A real alternate Nexus alliance, not a post-Battle rewritten side.
  game = applyAction(game, f.owner, { type: 'alliance', target: f.observer });
  game = applyAction(game, f.observer, { type: 'alliance', target: f.owner });
  game = advance(game, g => g.phase === 5 && clean(g));
  const staging: string[] = [];
  for (const p of game.players) {
    p.reserves += Object.values(p.forces).reduce((sum, amount) => sum + amount, 0);
    p.forces = {};
    if (p.elites) {
      p.elites.reserves += Object.values(p.elites.forces).reduce((sum, amount) => sum + amount, 0);
      p.elites.forces = {};
    }
    game.deck.push(...p.hand); p.hand = [];
  }
  // Conserved original counters/cards only. No phase, wallet, skill or receipt assigned.
  const location = 'arrakeen:10';
  place(game, f.owner, location, 5, staging);
  place(game, f.observer, location, 4, staging);
  place(game, f.opponent, location, 8, staging);
  const worthless = hold(game, f.owner, c => c.kind === 'worthless', staging);
  game = advance(game, g => g.phase === 6 && clean(g));
  const choice = viewGame(game, game.active!).battleChoices.find(b => b.territory === 'arrakeen');
  assert.ok(choice);
  game = applyAction(game, choice.chooser, { type: 'chooseBattle', territory: 'arrakeen',
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker });
  assert.equal(game.decision?.kind, 'ecazBattleLead');
  game = applyAction(game, f.owner, { type: 'decision', event: game.decision!.event, lead: f.owner });
  for (let n = 0; n < 100; n++) {
    if (game.battle && clean(game) && !game.battle.preparation) break;
    const action = next(game); assert.ok(action);
    if (action.action.type === 'leaderSkillVisibility' && action.actor === f.owner) action.action.hide = trained;
    game = step(game, action);
  }
  assert.ok(game.battle && clean(game) && !game.battle.preparation);
  const own = player(game, f.owner), enemy = player(game, f.opponent);
  const leader = trained ? f.trainer : own.leaders.find(l => l.id !== f.trainer && l.strength === 4 && !l.dead)!.id;
  const opponentLeader = enemy.leaders.find(l => l.strength === 6 && !l.dead)!.id;
  const before = structuredClone(game);
  game = reveal(game, [
    { actor: f.owner, action: { type: 'battlePlan', leader, dial: 5, support: 2, weapon: worthless.id } },
    { actor: f.opponent, action: { type: 'battlePlan', leader: opponentLeader, dial: losing ? 8 : 0, support: losing ? 8 : 0 } },
  ]);
  return { f, before, game, location };
}

void test('Ecaz-led Occupy normal Suk redirects its own fixed casualty, never the ally variable pool', () => {
  for (const [tech, stronghold] of [[false, false], [true, false], [false, true], [true, true]]) {
    const c = coalition(tech, stronghold, false);
    const game = settle(c.game, 'cards');
    assert.equal(game.lastBattleContext!.winner, c.f.owner);
    assert.equal(player(game, c.f.owner).tanks - player(c.before, c.f.owner).tanks, 2);
    assert.equal(player(game, c.f.owner).reserves - player(c.before, c.f.owner).reserves, 1);
    assert.equal(player(game, c.f.owner).forces[c.location], 2);
    assert.equal(player(game, c.f.observer).tanks - player(c.before, c.f.observer).tanks, 2);
    assert.equal(player(game, c.f.observer).forces[c.location], 2);
    assert.equal(game.pendingSukRescue, null);
    custody(game);
  }
});

void test('Ecaz-led Occupy trained Suk saves its fixed three after original ally losses and survives JSON continuation', () => {
  const c = coalition(true, true, true);
  let game = settle(c.game, 'suk');
  assert.equal(game.decision?.kind, 'sukRescue');
  assert.equal(player(game, c.f.observer).tanks - player(c.before, c.f.observer).tanks, 2);
  assert.equal(player(game, c.f.owner).forces[c.location], 5);
  const choice = game.decision!;
  assert.equal(choice.kind, 'sukRescue');
  if (choice.kind !== 'sukRescue') throw Error('Expected real rescue');
  const option = choice.options.findIndex(o => o.normal === 3); assert.ok(option >= 0);
  game = applyAction(JSON.parse(JSON.stringify(game)) as Game, c.f.owner,
    { type: 'decision', event: choice.event, choice: option });
  assert.equal(player(game, c.f.owner).tanks, player(c.before, c.f.owner).tanks);
  assert.equal(player(game, c.f.owner).reserves - player(c.before, c.f.owner).reserves, 2);
  assert.equal(player(game, c.f.owner).forces[c.location], 3);
  assert.equal(player(game, c.f.observer).forces[c.location], 2);
  assert.equal(game.lastBattleContext!.sukRescue!.completed, true);
  custody(game);
});

void test('Ecaz-led Occupy Diplomat retreats only its own undialed remainder, not the ally dial', () => {
  const c = coalition(true, true, true, 'diplomat', true);
  let game = advance(c.game, g => g.decision?.kind === 'diplomatRetreat' || !g.battle && clean(g));
  assert.equal(game.decision?.kind, 'diplomatRetreat');
  if (game.decision?.kind !== 'diplomatRetreat') throw Error('Expected actual own-force retreat');
  const decision = game.decision;
  const destination = decision.destinations.find(d => d.choices.some(o => o.normal === 2 && o.elite === 0));
  assert.ok(destination);
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, c.f.owner, { type: 'decision', event: decision.event,
    destination: destination.location, normal: 3, elite: 0 }));
  assert.deepEqual(game, before);
  game = applyAction(JSON.parse(JSON.stringify(game)) as Game, c.f.owner,
    { type: 'decision', event: decision.event, destination: destination.location, normal: 2, elite: 0 });
  game = settle(game);
  assert.equal(player(game, c.f.owner).forces[destination.location], 2);
  assert.equal(player(game, c.f.owner).forces[c.location], undefined);
  assert.equal(player(game, c.f.owner).tanks - player(c.before, c.f.owner).tanks, 3);
  assert.equal(player(game, c.f.observer).tanks - player(c.before, c.f.observer).tanks, 4);
  assert.equal(game.lastBattleContext!.winner, c.f.opponent);
  custody(game);
});
