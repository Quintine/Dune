import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  advanceSemutaAdvisorBattle,
  createSemutaAdvisorBattleFixture,
  semutaAdvisorBattleInventory,
  semutaAdvisorBattlePlayer,
} from './fixture-semuta-advisor-battle';

/** Original Advanced setup, shipments and battle choice. The explicit test
 * supplement forms a BG/Harkonnen alliance and moves existing physical cards
 * between zones; it does not claim these acquisitions occurred naturally. */
function source(names: string[]) {
  const fixture = createSemutaAdvisorBattleFixture();
  let game = structuredClone(fixture.beforeBattle);
  const bg = semutaAdvisorBattlePlayer(game, fixture.bg);
  const ally = semutaAdvisorBattlePlayer(game, fixture.harkonnen);
  const target = semutaAdvisorBattlePlayer(game, fixture.atreides);
  assert.equal(bg.ally, null);
  assert.equal(ally.ally, null);
  bg.ally = ally.id;
  ally.ally = bg.id;
  const original = semutaAdvisorBattleInventory(game);
  // Return the target's actual cards before staging the requested original
  // physical cards, so the named-absence cases do not depend on a shuffled deal.
  game.deck.push(...target.hand.splice(0));
  const pools = [game.richeseCache!, game.richeseRemoved ?? [], game.deck, game.discard,
    ...game.players.map(player => player.hand)];
  const ids = names.map(name => {
    const pool = pools.find(cards => cards.some(card => card.name === name && !target.hand.some(held => held.id === card.id)));
    assert.ok(pool, `An original physical ${name} card must exist`);
    const index = pool.findIndex(card => card.name === name && !target.hand.some(held => held.id === card.id));
    const card = pool.splice(index, 1)[0];
    target.hand.push(card);
    return card.id;
  });
  assert.deepEqual(semutaAdvisorBattleInventory(game), original);
  game = applyAction(game, fixture.choice.chooser, fixture.battleAction);
  game = advanceSemutaAdvisorBattle(game, state => state.battle?.preparation?.kind === 'voice' &&
    !state.response && !state.decision && !state.phaseOpening);
  assert.equal(game.battle!.preparation!.owner, fixture.bg);
  assert.equal(game.battle!.preparation!.beneficiary, fixture.harkonnen);
  return { game, target: fixture.atreides, ally: fixture.harkonnen, bg: fixture.bg, ids, original };
}
function command(game: Game, actor: string, kind: string, must: boolean) {
  game = applyAction(game, actor, { type: 'voice', kind, must });
  return advanceSemutaAdvisorBattle(game, state => !!state.battle &&
    !state.response && !state.decision && !state.phaseOpening &&
    !state.battle.preparation && state.battle.preLeader?.closed !== false);
}
function plan(game: Game, actor: string, fields: Partial<{ leader: string | null; weapon: string | null; defense: string | null }> = {}): Action {
  const player = semutaAdvisorBattlePlayer(game, actor);
  const leader = player.leaders.find(candidate => !candidate.dead && !candidate.capturedBy);
  return { type: 'battlePlan', dial: 0, support: 0, leader: leader?.id ?? null,
    weapon: null, defense: null, ...fields };
}
function reject(game: Game, actor: string, action: Action, reason?: RegExp) {
  const before = structuredClone(game);
  if (reason) assert.throws(() => applyAction(game, actor, action), reason);
  else assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

void test('Advanced Voice requires or forbids one named projectile without conflating another', () => {
  const { game: initial, bg, target, ids: [maula, crysknife], original } = source(['Maula Pistol', 'Crysknife']);
  const required = command(initial, bg, 'named:Maula Pistol', true);
  assert.deepEqual(required.battle!.voice, { target, kind: 'named:Maula Pistol', must: true });
  reject(required, target, plan(required, target));
  reject(required, target, plan(required, target, { weapon: crysknife }));
  const complied = applyAction(required, target, plan(required, target, { weapon: maula }));
  assert.equal(complied.battle!.plans[target].weapon, maula);
  assert.deepEqual(semutaAdvisorBattleInventory(complied), original);

  const forbidden = command(initial, bg, 'named:Maula Pistol', false);
  reject(forbidden, target, plan(forbidden, target, { weapon: maula }));
  const other = applyAction(forbidden, target, plan(forbidden, target, { weapon: crysknife }));
  assert.equal(other.battle!.plans[target].weapon, crysknife);
  assert.deepEqual(semutaAdvisorBattleInventory(other), original);
});

void test('missing a named card permits another projectile, while the old generic command still matches both', () => {
  const { game: initial, bg, target, ids: [crysknife], original } = source(['Crysknife']);
  const required = command(initial, bg, 'named:Maula Pistol', true);
  const accepted = applyAction(required, target, plan(required, target, { weapon: crysknife }));
  assert.equal(accepted.battle!.plans[target].weapon, crysknife);
  assert.deepEqual(semutaAdvisorBattleInventory(accepted), original);
  const category = command(initial, bg, 'projectile', false);
  reject(category, target, plan(category, target, { weapon: crysknife }));
  assert.doesNotThrow(() => applyAction(category, target, plan(category, target)));
});

void test('a named Worthless command accepts its physical card in either legal battle slot', () => {
  const { game: initial, bg, target, ids: [baliset, kulon] } = source(['Baliset', 'Kulon']);
  const required = command(initial, bg, 'named:Baliset', true);
  reject(required, target, plan(required, target, { weapon: kulon }));
  const weapon = applyAction(required, target, plan(required, target, { weapon: baliset }));
  assert.equal(weapon.battle!.plans[target].weapon, baliset);
  const defense = applyAction(required, target, plan(required, target, { defense: baliset }));
  assert.equal(defense.battle!.plans[target].defense, baliset);
  const forbidden = command(initial, bg, 'named:Baliset', false);
  reject(forbidden, target, plan(forbidden, target, { defense: baliset }));
  assert.doesNotThrow(() => applyAction(forbidden, target, plan(forbidden, target, { defense: kulon })));
});

void test('a named Cheap Hero prohibition preserves a different hero and permits no leader when none is legal', () => {
  const pair = source(['Cheap Hero', 'Cheap Heroine']);
  const forbidden = command(pair.game, pair.bg, 'named:Cheap Hero', false);
  const controlled = structuredClone(forbidden);
  for (const leader of semutaAdvisorBattlePlayer(controlled, pair.target).leaders) {
    leader.dead = true;
    leader.deaths = Math.max(leader.deaths, 1);
  }
  reject(controlled, pair.target, plan(controlled, pair.target, { leader: pair.ids[0] }));
  reject(controlled, pair.target, plan(controlled, pair.target, { leader: null }));
  const heroine = applyAction(controlled, pair.target, plan(controlled, pair.target, { leader: pair.ids[1] }));
  assert.equal(heroine.battle!.plans[pair.target].leader, pair.ids[1]);

  const one = source(['Cheap Hero']);
  const lastHero = command(one.game, one.bg, 'named:Cheap Hero', false);
  for (const leader of semutaAdvisorBattlePlayer(lastHero, one.target).leaders) {
    leader.dead = true;
    leader.deaths = Math.max(leader.deaths, 1);
  }
  const noLeader = applyAction(lastHero, one.target, plan(lastHero, one.target, { leader: null }));
  assert.equal(noLeader.battle!.plans[one.target].leader, null);
});

void test('named Shield means the printed name, so either physical copy satisfies the requirement', () => {
  const { game: initial, bg, target, ids: [first, second] } = source(['Shield', 'Shield']);
  assert.notEqual(first, second);
  const required = command(initial, bg, 'named:Shield', true);
  reject(required, target, plan(required, target));
  for (const defense of [first, second]) {
    const next = applyAction(required, target, plan(required, target, { defense }));
    assert.equal(next.battle!.plans[target].defense, defense);
  }
});

void test('Basic rejects a named card command before committing Voice', () => {
  // Controlled mode downgrade at the genuine Voice boundary isolates the new
  // mode gate; it does not claim this Advanced fixture is a native Basic game.
  const { game, bg } = source(['Maula Pistol']);
  game.advanced = false;
  reject(game, bg, { type: 'voice', kind: 'named:Maula Pistol', must: true }, /Naming an individual card requires Advanced rules/);
});

void test('all bot profiles can make legal plans under a named projectile command', () => {
  const { game: initial, bg, target, ids: [maula] } = source(['Maula Pistol', 'Crysknife']);
  for (const must of [true, false]) {
    const voiced = command(initial, bg, 'named:Maula Pistol', must);
    for (const difficulty of DIFFICULTIES) {
      const view = viewGame(voiced, target);
      view.players.find(player => player.id === target)!.bot = difficulty;
      const actions = botActions(view).filter(action => action.type === 'battlePlan');
      assert.ok(actions.length, `${difficulty} can make a plan under named Voice`);
      if (must) assert.ok(actions.every(action => action.weapon === maula));
      else assert.ok(actions.every(action => action.weapon !== maula));
      for (const action of actions) assert.doesNotThrow(() => applyAction(voiced, target, action));
    }
  }
});
