import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { ownedTech, TECH_TOKENS } from '../game/tech-tokens';
import {
  createSkillsTechBattleFixture, finishSkillsTechBattle, openSkillsTechBattle,
  skillsTechBattlePlayer, type SkillsTechBattleFixture,
} from './fixture-skills-tech-battle';

function reveal(fixture: SkillsTechBattleFixture): Game {
  let game = openSkillsTechBattle(fixture.game, fixture.owner, fixture.opponent, fixture.territory, fixture.band === 'skilled');
  game = applyAction(game, fixture.owner, fixture.ownerPlan);
  game = applyAction(game, fixture.opponent, fixture.opponentPlan);
  return finishSkillsTechBattle(game, 'skill');
}
function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
function conserveForces(game: Game): void {
  for (const player of game.players) {
    assert.equal(player.reserves + player.tanks + Object.values(player.forces).reduce((sum, n) => sum + n, 0), 20);
    if (player.elites) {
      assert.equal(player.elites.reserves + player.elites.tanks + Object.values(player.elites.forces).reduce((sum, n) => sum + n, 0), 5);
      for (const [key, amount] of Object.entries(player.elites.forces)) assert.ok(amount <= (player.forces[key] ?? 0));
    }
  }
}
function tokenChanges(before: Game, after: Game): string[] {
  return TECH_TOKENS.filter(token => before.techTokens![token.id].owner !== after.techTokens![token.id].owner).map(token => token.id);
}
function assertLoserCleanup(game: Game, fixture: SkillsTechBattleFixture): void {
  assert.equal(skillsTechBattlePlayer(game, fixture.opponent).hand.some(card => card.id === fixture.losingCard), false);
  assert.equal(game.discard.filter(card => card.id === fixture.losingCard).length, 1);
  assert.equal(skillsTechBattlePlayer(game, fixture.opponent).leaders.find(l => l.id === fixture.losingLeader)!.dead, true);
}

for (const advanced of [false, true]) for (const band of ['normal', 'skilled'] as const) {
  void test(`${advanced ? 'Advanced' : 'Basic'} ${band} Suk physically rescues before cleanup and one original automatic Tech reward`, () => {
    const fixture = createSkillsTechBattleFixture({ advanced, band });
    const before = fixture.game;
    const ownerBefore = skillsTechBattlePlayer(before, fixture.owner);
    const enemyBefore = skillsTechBattlePlayer(before, fixture.opponent);
    const bounty = enemyBefore.leaders.find(l => l.id === fixture.losingLeader)!.strength;
    let game = reveal(fixture);
    assert.equal(game.lastBattleContext!.winner, fixture.owner);
    assertLoserCleanup(game, fixture);
    assert.equal(skillsTechBattlePlayer(game, fixture.opponent).tanks, enemyBefore.tanks + 8);
    assert.equal(skillsTechBattlePlayer(game, fixture.opponent).forces[fixture.key] ?? 0, 0);
    assert.deepEqual(tokenChanges(before, game), [], 'Rescue/played-card cleanup precede token reward.');
    assert.equal(skillsTechBattlePlayer(game, fixture.owner).spice, ownerBefore.spice - (advanced ? 4 : 0) + bounty);
    if (band === 'skilled') {
      const decision = game.decision;
      assert.ok(decision?.kind === 'sukRescue');
      assert.equal(decision.mode, 'skilled');
      assert.equal(skillsTechBattlePlayer(game, fixture.owner).forces[fixture.key], 8);
      assert.equal(skillsTechBattlePlayer(game, fixture.owner).tanks, ownerBefore.tanks);
      const choice = decision.options.findIndex(option => option.normal === 3 && option.elite === 0 && option.kept?.key === fixture.key);
      assert.ok(choice >= 0);
      reject(game, fixture.opponent, { type: 'decision', event: decision.event, choice });
      reject(game, fixture.owner, { type: 'decision', event: `${decision.event}-stale`, choice });
      const action: Action = { type: 'decision', event: decision.event, choice };
      game = applyAction(game, fixture.owner, action);
      reject(game, fixture.owner, action);
    }
    const rescued = skillsTechBattlePlayer(game, fixture.owner);
    assert.equal(rescued.forces[fixture.key], band === 'skilled' ? 5 : 4);
    assert.equal(rescued.reserves, ownerBefore.reserves + (band === 'skilled' ? 2 : 1));
    assert.equal(rescued.tanks, ownerBefore.tanks + (band === 'skilled' ? 1 : 3));
    // User ruling 7 October 2026: rescued counters still count toward the seven
    // Kwisatz Haderach losses, so the counter gains the full dialed allocation.
    assert.equal(
      rescued.battleLosses,
      ownerBefore.battleLosses +
        (rescued.tanks - ownerBefore.tanks) +
        (band === 'skilled' ? 3 : 1),
    );
    assert.equal(game.lastBattleContext!.sukRescue!.completed, true);
    assert.equal(game.pendingSukRescue, null);
    assert.equal(game.decision?.kind, 'battleCards');
    const walletAfterReward = rescued.spice;
    const collected = quoteSpiceCollection(game).receipts.find(receipt => receipt.player === fixture.owner)!.collected;
    const token = ownedTech(before.techTokens, fixture.opponent)[0];
    assert.ok(token);
    game = finishSkillsTechBattle(game);
    assert.deepEqual(tokenChanges(before, game), [token]);
    assert.equal(game.techTokens![token].owner, fixture.owner);
    assert.equal(ownedTech(game.techTokens, fixture.opponent).length, 0);
    assert.equal(game.pendingTech, null);
    assert.equal(skillsTechBattlePlayer(game, fixture.owner).spice, walletAfterReward + collected,
      'Ordinary leader bounty remains; subsequent Collection is independently quoted.');
    assert.deepEqual(skillsTechBattlePlayer(game, fixture.owner).hand.map(card => card.id).sort(), [fixture.weapon, fixture.defense].sort());
    assertLoserCleanup(game, fixture);
    conserveForces(game);
  });
}

for (const advanced of [false, true]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} Sandmaster adds exactly three board spice before choosing one of two genuinely won Tech Tokens`, () => {
    const fixture = createSkillsTechBattleFixture({ advanced, skill: 'sandmaster', reward: 'selection' });
    const before = fixture.game;
    const originalPile = before.spice[fixture.key];
    const ownerBefore = skillsTechBattlePlayer(before, fixture.owner);
    const enemyBefore = skillsTechBattlePlayer(before, fixture.opponent);
    const bounty = enemyBefore.leaders.find(l => l.id === fixture.losingLeader)!.strength;
    let game = reveal(fixture);
    assertLoserCleanup(game, fixture);
    assert.equal(game.spice[fixture.key], originalPile + 3);
    assert.deepEqual(game.lastBattleContext!.sandmaster, { leader: fixture.trainer, key: fixture.key, before: originalPile, after: originalPile + 3 });
    assert.equal(skillsTechBattlePlayer(game, fixture.owner).spice, ownerBefore.spice - (advanced ? 4 : 0) + bounty,
      'Sandmaster deposits board spice, not immediate faction income.');
    assert.equal(skillsTechBattlePlayer(game, fixture.owner).forces[fixture.key], 4);
    assert.equal(skillsTechBattlePlayer(game, fixture.owner).tanks, ownerBefore.tanks + 4);
    assert.equal(skillsTechBattlePlayer(game, fixture.opponent).tanks, enemyBefore.tanks + 8);
    assert.deepEqual(tokenChanges(before, game), []);
    game = finishSkillsTechBattle(game, 'tech');
    const decision = game.decision;
    assert.ok(decision?.kind === 'techToken');
    assert.equal(decision.choices.length, 2);
    assert.deepEqual(new Set(decision.choices), new Set(ownedTech(before.techTokens, fixture.opponent)));
    const other = TECH_TOKENS.find(token => !decision.choices.includes(token.id))!;
    reject(game, fixture.owner, { type: 'decision', token: other.id });
    reject(game, fixture.opponent, { type: 'decision', token: decision.choices[0] });
    // Each real legal policy chooses an owned token and transfers precisely one.
    for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
      const view = viewGame(game, fixture.owner);
      view.players.find(p => p.id === fixture.owner)!.bot = difficulty;
      const action = botActions(view).find(candidate => candidate.type === 'decision');
      assert.ok(action && typeof action.token === 'string' && decision.choices.includes(action.token as typeof decision.choices[number]));
      const wallet = skillsTechBattlePlayer(game, fixture.owner).spice;
      const collected = quoteSpiceCollection(game).receipts.find(receipt => receipt.player === fixture.owner)!.collected;
      const paid = finishSkillsTechBattle(applyAction(game, fixture.owner, action));
      assert.deepEqual(tokenChanges(before, paid), [action.token]);
      assert.equal(ownedTech(paid.techTokens, fixture.opponent).length, 1);
      assert.equal(paid.pendingTech, null);
      assert.equal(skillsTechBattlePlayer(paid, fixture.owner).spice, wallet + collected);
      assert.equal(paid.lastBattleContext!.sandmaster!.after, originalPile + 3);
      assertLoserCleanup(paid, fixture);
      conserveForces(paid);
      reject(paid, fixture.owner, action);
    }
  });
}

void test('a real preliminary loss leaves the later loser with no token, so native aftermath skips Tech and keeps the winner cards', () => {
  const fixture = createSkillsTechBattleFixture({ advanced: true, reward: 'absent' });
  assert.equal(ownedTech(fixture.game.techTokens, fixture.opponent).length, 0);
  const game = finishSkillsTechBattle(reveal(fixture));
  assert.deepEqual(tokenChanges(fixture.game, game), []);
  assert.equal(game.pendingTech, null);
  assert.equal(game.lastBattleContext!.winner, fixture.owner);
  assert.equal(skillsTechBattlePlayer(game, fixture.owner).forces[fixture.key], 5);
  assertLoserCleanup(game, fixture);
  assert.deepEqual(skillsTechBattlePlayer(game, fixture.owner).hand.map(card => card.id).sort(), [fixture.weapon, fixture.defense].sort());
  conserveForces(game);
});

void test('Advanced own-seat legal policies cannot finance battle support with a future bounty, rescue or Tech reward', () => {
  const fixture = createSkillsTechBattleFixture({ advanced: true });
  const game = openSkillsTechBattle(fixture.game, fixture.owner, fixture.opponent, fixture.territory);
  const wallet = skillsTechBattlePlayer(game, fixture.owner).spice;
  reject(game, fixture.owner, { ...fixture.ownerPlan, support: wallet + 1 });
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = viewGame(game, fixture.owner);
    view.players.find(p => p.id === fixture.owner)!.bot = difficulty;
    const plan = botActions(view).find(action => action.type === 'battlePlan');
    assert.ok(plan);
    assert.ok(Number(plan.support ?? 0) + Number(plan.bankerSpice ?? 0) <= wallet);
    const committed = applyAction(game, fixture.owner, plan);
    assert.equal(skillsTechBattlePlayer(committed, fixture.owner).spice, wallet);
    assert.deepEqual(tokenChanges(game, committed), []);
  }
});
