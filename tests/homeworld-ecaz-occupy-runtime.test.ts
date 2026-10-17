import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { homeworldGameIntegrity } from '../game/homeworld-game';
import { chooseEcazOccupyLead, openEcazOccupyPlans, stageEcazOccupyCard } from './fixture-ecaz-occupy';
import { createHomeworldEcazOccupyFixture, homeworldEcazClean, nextHomeworldEcazStep } from './fixture-homeworld-ecaz-occupy';

const player = (game: Game, id: string) => game.players.find(p => p.id === id)!;
const leader = (game: Game, id: string, strongest: boolean) => player(game, id).leaders
  .filter(l => !l.dead && !l.usedAt).sort((a, b) => strongest ? b.strength - a.strength : a.strength - b.strength)[0].id;
/** Keep the real shuffles deterministic; node:test restores the crypto method
 * after each case, including failures. Event UUIDs do not affect bot variation. */
function fixedEntropy(t: test.TestContext): void {
  t.mock.method(crypto, 'getRandomValues', <T extends ArrayBufferView | null>(array: T): T => {
    assert.ok(array instanceof Uint32Array);
    array.fill(0);
    return array;
  });
}
function revealAndFinish(state: Game, mixedLoss = false): Game {
  let game = state;
  while (game.battle) {
    const view = viewGame(game, game.battle.attacker).battle!;
    const voter = view.traitorVoters.find(id => !view.traitorSubmitted.includes(id));
    assert.ok(voter);
    game = applyAction(game, voter, { type: 'traitorCall', call: false });
  }
  if (mixedLoss) {
    const decision = game.decision;
    assert.ok(decision?.kind === 'battleLosses');
    const choice = decision.options.findIndex(loss => loss.normal === 1 && loss.elite === 1);
    assert.ok(choice >= 0);
    game = applyAction(game, decision.player, { type: 'decision', choice });
  }
  for (let n = 0; n < 100 && (game.phase === 6 || game.phase === 7 && !homeworldEcazClean(game)); n++) {
    const next = nextHomeworldEcazStep(game); assert.ok(next);
    game = applyAction(game, next.actor, next.action);
  }
  assert.equal(game.phase, 7);
  homeworldGameIntegrity(game);
  return game;
}

for (const advanced of [false, true]) for (const lead of ['ecaz', 'ally'] as const)
  void test(`${advanced ? 'Advanced' : 'Basic'} native Worlds ${lead} lead keeps separate typed Arrakis Occupy losses and original World custody`, t => {
    fixedEntropy(t);
    const f = createHomeworldEcazOccupyFixture({ advanced });
    const actor = lead === 'ecaz' ? f.ecaz : f.ally;
    let game = openEcazOccupyPlans(chooseEcazOccupyLead(f, lead));
    const before = structuredClone(game);
    const profile = viewGame(game, actor).battle!.ecazOccupy!.profile!;
    assert.equal(profile.forceOwner, f.ally);
    assert.equal(profile.fixedEcazDial, 2);
    // Advanced Salusa retains full-strength unpaid Sardaukar. One paid ordinary
    // plus one unpaid starred counter makes variable strength 3, not three pieces.
    game = applyAction(game, actor, { type: 'battlePlan', dial: advanced ? 5 : 4,
      support: advanced ? 1 : 0, leader: leader(game, actor, true) });
    game = applyAction(game, f.opponent, { type: 'battlePlan', dial: 0, leader: leader(game, f.opponent, false) });
    game = revealAndFinish(game, !advanced);
    assert.equal(game.lastBattleContext!.winner, actor);
    assert.equal(game.lastBattleContext!.result, 'normal');
    assert.equal(player(game, f.ecaz).forces[f.location], 2);
    assert.equal(player(game, f.ecaz).tanks - player(before, f.ecaz).tanks, 2);
    assert.equal(player(game, f.ally).forces[f.location], 2);
    assert.equal(player(game, f.ally).elites!.forces[f.location], 1);
    assert.equal(player(game, f.ally).tanks - player(before, f.ally).tanks, 2);
    assert.equal(player(game, f.ally).elites!.tanks - player(before, f.ally).elites!.tanks, 1);
    assert.equal(player(game, f.opponent).forces[f.location], undefined);
    assert.deepEqual(game.homeworlds!.custody, before.homeworlds!.custody);
  });

for (const lead of ['ecaz', 'ally'] as const)
  void test(`native World Karama prevention keeps ${lead} as lead and spares the excluded allied army`, t => {
    fixedEntropy(t);
    const f = createHomeworldEcazOccupyFixture();
    const actor = lead === 'ecaz' ? f.ecaz : f.ally;
    const excluded = actor === f.ecaz ? f.ally : f.ecaz;
    const karama = stageEcazOccupyCard(f.game, f.opponent, card => card.effect === 'karama');
    let game = chooseEcazOccupyLead(f, lead);
    assert.equal(game.response?.kind, 'ecazOccupy');
    game = applyAction(game, f.opponent, { type: 'card', card: karama, mode: 'cancel' });
    game = openEcazOccupyPlans(game);
    const before = structuredClone(game);
    const profile = viewGame(game, actor).battle!.ecazOccupy!.profile!;
    assert.equal(profile.forceOwner, actor);
    assert.equal(profile.fixedEcazDial, 0);
    game = applyAction(game, actor, { type: 'battlePlan', dial: actor === f.ecaz ? 2 : 3,
      support: actor === f.ecaz ? 2 : 1, leader: leader(game, actor, true) });
    game = applyAction(game, f.opponent, { type: 'battlePlan', dial: 0, leader: leader(game, f.opponent, false) });
    game = revealAndFinish(game);
    assert.equal(game.lastBattleContext!.winner, actor);
    assert.equal(player(game, actor).forces[f.location], 2);
    assert.equal(player(game, actor).tanks - player(before, actor).tanks, 2);
    assert.deepEqual(player(game, excluded).forces, player(before, excluded).forces);
    assert.equal(player(game, excluded).tanks, player(before, excluded).tanks);
    assert.equal(game.discard.filter(card => card.id === karama).length, 1);
    assert.deepEqual(game.homeworlds!.custody, before.homeworlds!.custody);
  });

for (const advanced of [false, true]) for (const homeworlds of [false, true])
  void test(`all four ${advanced ? 'Advanced' : 'Basic'} Ecaz Skills profiles complete a coalition ${homeworlds ? 'with' : 'without'} Worlds`, t => {
  fixedEntropy(t);
  for (const difficulty of DIFFICULTIES) {
    const f = createHomeworldEcazOccupyFixture({ advanced, skills: true, homeworlds });
    let game = f.game;
    for (let n = 0; n < 150 && game.phase === 6; n++) {
      let next;
      for (const p of game.players) {
        const view = viewGame(game, p.id);
        view.players.find(seat => seat.id === p.id)!.bot = difficulty;
        const action = botActions(view)[0];
        if (action) { next = { actor: p.id, action }; break; }
      }
      assert.ok(next, `${difficulty} must retain a legal coalition actor`);
      game = applyAction(game, next.actor, next.action);
    }
    assert.equal(game.phase, 7, difficulty);
    assert.ok(game.lastBattleContext!.combatants.includes(f.opponent));
    assert.equal(game.battle, null);
    for (const p of game.players) {
      assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((sum, n) => sum + n, 0), 20);
      if (p.elites) assert.equal(p.elites.reserves + p.elites.tanks +
        Object.values(p.elites.forces).reduce((sum, n) => sum + n, 0), 5);
    }
    if (homeworlds) homeworldGameIntegrity(game);
  }
});
