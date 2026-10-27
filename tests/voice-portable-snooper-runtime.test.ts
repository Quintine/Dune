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

const portable = 'richese-portable-snooper';

/** Start from the fixture's real Advanced setup, paid Semuta acquisition,
 * movements and unchosen Arrakeen battle. The supplement below is deliberately
 * controlled: it makes BG and Harkonnen allies and conserves original cards
 * when transferring one ordinary Snooper and Portable Snooper from their
 * original zones to Atreides. Neither acquisition nor alliance is claimed as
 * naturally earned; a previously removed cache card can be staged back. */
function source() {
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
  const pools = [game.richeseCache!, game.richeseRemoved ?? [], game.deck, game.discard,
    ...game.players.map(player => player.hand)];
  const transfer = (predicate: (card: Game['deck'][number]) => boolean) => {
    const pool = pools.find(cards => cards.some(predicate));
    assert.ok(pool, 'The original physical card must exist');
    const card = pool.splice(pool.findIndex(predicate), 1)[0];
    target.hand.push(card);
    return card.id;
  };
  const ordinary = transfer(card => card.kind === 'snooper');
  assert.equal(transfer(card => card.id === portable), portable);
  assert.deepEqual(semutaAdvisorBattleInventory(game), original);
  game = applyAction(game, fixture.choice.chooser, fixture.battleAction);
  game = advanceSemutaAdvisorBattle(game, state => state.battle?.preparation?.kind === 'voice' &&
    !state.response && !state.decision && !state.phaseOpening);
  assert.equal(game.battle!.preparation!.owner, fixture.bg);
  assert.equal(game.battle!.preparation!.beneficiary, fixture.harkonnen);
  return { fixture, game, target: fixture.atreides, ally: fixture.harkonnen,
    bg: fixture.bg, ordinary, original };
}

function command(game: Game, bg: string, kind: string, must: boolean) {
  game = applyAction(game, bg, { type: 'voice', kind, must });
  return advanceSemutaAdvisorBattle(game, state => !!state.battle &&
    !state.response && !state.decision && !state.phaseOpening &&
    !state.battle.preparation && state.battle.preLeader?.closed !== false);
}
function plan(game: Game, actor: string, defense: string | null): Game {
  const player = semutaAdvisorBattlePlayer(game, actor);
  const leader = player.leaders.find(candidate => !candidate.dead && !candidate.capturedBy);
  assert.ok(leader);
  return applyAction(game, actor, { type: 'battlePlan', dial: 0, support: 0,
    leader: leader.id, weapon: null, defense });
}
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
function planAction(game: Game, actor: string, defense: string | null): Action {
  const leader = semutaAdvisorBattlePlayer(game, actor).leaders.find(candidate => !candidate.dead && !candidate.capturedBy);
  assert.ok(leader);
  return { type: 'battlePlan', dial: 0, support: 0, leader: leader.id, weapon: null, defense };
}
function inventory(game: Game, original: string[]) {
  assert.deepEqual(semutaAdvisorBattleInventory(game), original);
  const targetCards = game.players.flatMap(player => player.hand).filter(card => card.id === portable);
  assert.equal(targetCards.length, 1);
  assert.equal(game.richeseCache!.some(card => card.id === portable), false);
  assert.equal(game.discard.some(card => card.id === portable), false);
}

void test('Advanced Voice can require the physical Portable specifically, not an ordinary Snooper', () => {
  const { game: initial, bg, target, ally, ordinary, original } = source();
  let game = command(initial, bg, 'portableSnooper', true);
  assert.deepEqual(game.battle!.voice, { target, kind: 'portableSnooper', must: true });
  reject(game, target, planAction(game, target, null));
  reject(game, target, planAction(game, target, ordinary));
  game = plan(game, target, portable);
  assert.equal(game.battle!.plans[target].defense, portable);
  inventory(game, original);
  game = plan(game, ally, null);
  assert.equal(game.battle!.revealed, true);
  assert.equal(game.battle!.plans[target].defense, portable);
  assert.equal(game.battle!.lateDefense?.[target], undefined);
  inventory(game, original);
});

void test('Advanced Voice forbidding Portable still permits an ordinary Snooper, but prevents later Portable', () => {
  const { game: initial, bg, target, ally, ordinary, original } = source();
  const voiced = command(initial, bg, 'portableSnooper', false);
  reject(voiced, target, planAction(voiced, target, portable));
  let normal = plan(voiced, target, ordinary);
  normal = plan(normal, ally, null);
  assert.equal(normal.battle!.revealed, true);
  assert.equal(normal.battle!.plans[target].defense, ordinary);
  inventory(normal, original);

  let late = plan(voiced, target, null);
  late = plan(late, ally, null);
  const event = late.battle!.event!;
  assert.equal(late.battle!.revealed, true);
  reject(late, target, { type: 'portableSnooper', card: portable, event });
  assert.equal(late.battle!.lateDefense?.[target], undefined);
  inventory(late, original);
});

void test('when Portable is absent a named require does not invent the card, and ordinary Snooper remains legal', () => {
  const { game: initial, bg, target, ordinary, original } = source();
  const player = semutaAdvisorBattlePlayer(initial, target);
  const index = player.hand.findIndex(card => card.id === portable);
  assert.ok(index >= 0);
  initial.richeseCache!.push(player.hand.splice(index, 1)[0]);
  assert.deepEqual(semutaAdvisorBattleInventory(initial), original);
  let game = command(initial, bg, 'portableSnooper', true);
  reject(game, target, planAction(game, target, portable));
  game = plan(game, target, ordinary);
  assert.equal(game.battle!.plans[target].defense, ordinary);
  assert.equal(game.richeseCache!.filter(card => card.id === portable).length, 1);
  assert.deepEqual(semutaAdvisorBattleInventory(game), original);
});

void test('ordinary Snooper Voice retains its existing broader poison-defense prohibition', () => {
  const { game: initial, bg, target, ally, ordinary, original } = source();
  const voiced = command(initial, bg, 'snooper', false);
  reject(voiced, target, planAction(voiced, target, ordinary));
  reject(voiced, target, planAction(voiced, target, portable));
  let game = plan(voiced, target, null);
  game = plan(game, ally, null);
  reject(game, target, { type: 'portableSnooper', card: portable, event: game.battle!.event! });
  inventory(game, original);
});

void test('Voice forbidding a shield leaves the actual late Portable defense available', () => {
  const { game: initial, bg, target, ally, original } = source();
  let game = command(initial, bg, 'shield', false);
  game = plan(game, target, null);
  game = plan(game, ally, null);
  const plans = structuredClone(game.battle!.plans);
  game = applyAction(game, target, { type: 'portableSnooper', card: portable, event: game.battle!.event! });
  assert.deepEqual(game.battle!.plans, plans);
  assert.equal(game.battle!.lateDefense?.[target], portable);
  inventory(game, original);
});

void test('all four bot profiles obey named Portable Voice in native planning and the late window', () => {
  const { game: initial, bg, target, ally, original } = source();
  const required = command(initial, bg, 'portableSnooper', true);
  const forbidden = command(initial, bg, 'portableSnooper', false);
  for (const difficulty of DIFFICULTIES) {
    const requiredView = viewGame(required, target);
    requiredView.players.find(player => player.id === target)!.bot = difficulty;
    const candidates = botActions(requiredView).filter(action => action.type === 'battlePlan');
    const usesPortable = candidates.filter(action => action.defense === portable && action.leader);
    assert.ok(usesPortable.length, `${difficulty} can submit a plan with the required actual card`);
    for (const action of candidates) assert.doesNotThrow(() => applyAction(required, target, action));

    const forbiddenView = viewGame(forbidden, target);
    forbiddenView.players.find(player => player.id === target)!.bot = difficulty;
    const allowed = botActions(forbiddenView).filter(action => action.type === 'battlePlan');
    assert.ok(allowed.length, `${difficulty} can submit a plan under the prohibition`);
    assert.ok(allowed.every(action => action.defense !== portable && action.weapon !== portable));
    for (const action of allowed) assert.doesNotThrow(() => applyAction(forbidden, target, action));

    // Controlled physical-card supplement: transfer an original poison weapon
    // to the ally so late-defense policy sees a real revealed threat.
    let late = structuredClone(forbidden);
    const pools = [late.deck, late.discard, ...late.players.map(player => player.hand)];
    const pool = pools.find(cards => cards.some(card => card.kind === 'poison'));
    assert.ok(pool);
    const poison = pool.splice(pool.findIndex(card => card.kind === 'poison'), 1)[0];
    semutaAdvisorBattlePlayer(late, ally).hand.push(poison);
    assert.deepEqual(semutaAdvisorBattleInventory(late), original);
    late = plan(late, target, null);
    const leader = semutaAdvisorBattlePlayer(late, ally).leaders.find(candidate => !candidate.dead && !candidate.capturedBy);
    assert.ok(leader);
    late = applyAction(late, ally, { type: 'battlePlan', dial: 0, support: 0,
      leader: leader.id, weapon: poison.id, defense: null });
    assert.equal(late.battle!.revealed, true);
    const lateView = viewGame(late, target);
    lateView.players.find(player => player.id === target)!.bot = difficulty;
    assert.ok(botActions(lateView).every(action => action.type !== 'portableSnooper'),
      `${difficulty} must not play the prohibited card late`);
    inventory(late, original);
  }
});
