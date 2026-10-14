import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { fighterCount } from '../game/advisors';
import { gameDistance, splitLocation, territory } from '../game/board';
import { quoteBattleBoard } from '../game/board-resolution-quote';
import { quoteAdvisorBattleOffer } from '../game/movement-phase-quote';
import { nexusAdvisorAction } from '../game/nexus-advisor-options';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';
import {
  createNexusAdvisorStormFixture, nexusAdvisorStormPlayer,
  type NexusAdvisorStormFixture,
} from './fixture-nexus-advisor-storm';

function declaration(f: NexusAdvisorStormFixture, game = f.game): Action {
  const view = viewGame(game, f.owner);
  const offer = view.nexusAdvisors!.offer!;
  const action = nexusAdvisorAction(view, offer.event, [f.territory]);
  assert.ok(action, 'The real storm-held advisor territory is a legal whole-territory Cunning selection');
  return action;
}
function resources(game: Game) {
  return game.players.map(player => ({ id: player.id, spice: player.spice,
    reserves: player.reserves, tanks: player.tanks, forces: player.forces,
    elites: player.elites, shipped: player.shipped, moved: player.moved,
    revived: player.revived, ally: player.ally }));
}
function settle(game: Game): Game {
  for (let count = 0; count < 80; count++) {
    if (!game.response && !game.decision && !game.phaseOpening) return game;
    const step = nextStrongholdFactionsNativeStep(game);
    assert.ok(step, 'Only original responses and decisions may settle the declaration');
    game = applyAction(game, step.actor, step.action);
  }
  throw Error('Original storm advisor response did not settle');
}
function rejectsImmutably(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
function assertStormGeometry(f: NexusAdvisorStormFixture, game: Game): void {
  const from = `${f.territory}:${f.separated ? 9 : 10}`;
  const to = `${f.territory}:${f.separated ? 5 : 10}`;
  assert.equal(gameDistance(game, from, to), 0);
  assert.ok(gameDistance(game, from, to, key => splitLocation(key).sector === game.storm) > 0);
  assert.equal(quoteBattleBoard(game).battles.some(battle => battle.territory === f.territory &&
    [battle.attacker, battle.defender].includes(f.owner)), false);
}
function ordinaryStormMove(f: NexusAdvisorStormFixture): Action {
  return { type: 'move', forces: { [`${f.territory}:${f.separated ? 9 : 10}`]: 1 },
    eliteForces: { [`${f.territory}:${f.separated ? 9 : 10}`]: 0 },
    territory: f.separated ? f.territory : 'polar_sink', sector: f.separated ? 5 : 0 };
}

for (const separated of [false, true]) {
  const label = separated ? 'real rock groups separated by the storm' : 'real shielded Arrakeen groups under the storm';
  void test(`Cunning changes only stance for ${label}, without granting movement or battle`, () => {
    const f = createNexusAdvisorStormFixture({ separated });
    const original = structuredClone(f.game);
    assert.equal(original.advanced, true);
    assert.deepEqual(nexusAdvisorStormPlayer(f.afterStorm, f.owner).forces,
      nexusAdvisorStormPlayer(f.beforeStorm, f.owner).forces);
    assert.deepEqual(nexusAdvisorStormPlayer(f.afterStorm, f.opponent).forces,
      nexusAdvisorStormPlayer(f.beforeStorm, f.opponent).forces);
    assert.equal(territory(f.territory).type, separated ? 'rock' : 'stronghold');
    assert.deepEqual(nexusAdvisorStormPlayer(original, f.owner).advisors![f.territory], { lockedTurn: 1 });
    assert.equal(nexusAdvisorStormPlayer(original, f.owner).forces[`${f.territory}:${separated ? 9 : 10}`], separated ? 1 : 2);
    assert.equal(fighterCount(nexusAdvisorStormPlayer(original, f.opponent), f.territory), 1);
    assert.equal(quoteAdvisorBattleOffer(original).territories.includes(f.territory), false);
    assertStormGeometry(f, original);
    rejectsImmutably(original, f.owner, ordinaryStormMove(f));
    rejectsImmutably(original, f.owner, { ...ordinaryStormMove(f), territory: f.territory,
      sector: separated ? 5 : 10, fighters: true });
    rejectsImmutably(original, f.owner, { type: 'ship', territory: f.territory,
      sector: original.storm, amount: 1, elite: 0, allyPayment: 0 });

    const action = declaration(f);
    rejectsImmutably(original, f.opponent, action);
    rejectsImmutably(original, f.owner, { ...action, event: `${String(action.event)}-stale` });
    let game = applyAction(original, f.owner, action);
    assert.equal(game.response?.kind, 'nexusAdvisorFlip');
    const receipt = structuredClone(game.nexusAdvisorHistory!.at(-1)!.receipt);
    assert.equal(receipt.owner, f.owner);
    assert.equal(receipt.turn, original.turn);
    assert.deepEqual(receipt.selections, [{ territory: f.territory, count: 2,
      locations: separated
        ? [{ location: `${f.territory}:5`, count: 1 }, { location: `${f.territory}:9`, count: 1 }]
        : [{ location: `${f.territory}:10`, count: 2 }],
      noField: null, stance: { lockedTurn: 1 } }]);
    assert.deepEqual(resources(game), resources(original));
    assert.deepEqual(nexusAdvisorStormPlayer(game, f.owner).advisors,
      nexusAdvisorStormPlayer(original, f.owner).advisors);
    assert.equal(game.nexusCards!.cards!.hands[f.owner], null);
    assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'beneGesserit').length, 1);
    rejectsImmutably(game, f.owner, action);
    game = settle(game);
    assert.equal(game.nexusAdvisorHistory!.at(-1)!.stage, 'completed');
    assert.equal(game.nexusAdvisorHistory!.length, 1);
    assert.deepEqual(game.nexusAdvisorHistory!.at(-1)!.receipt, receipt);
    const expected = structuredClone(nexusAdvisorStormPlayer(original, f.owner).advisors!);
    delete expected[f.territory];
    assert.deepEqual(nexusAdvisorStormPlayer(game, f.owner).advisors, expected);
    assert.deepEqual(resources(game), resources(original));
    assert.deepEqual(game.players.map(player => player.hand), original.players.map(player => player.hand));
    assert.equal(fighterCount(nexusAdvisorStormPlayer(game, f.owner), f.territory), 2);
    assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'beneGesserit').length, 1);
    assert.equal(game.turn, original.turn);
    assert.equal(game.phase, 5);
    assert.equal(game.active, f.owner);
    assert.equal(game.response, null);
    assertStormGeometry(f, game);
    rejectsImmutably(game, f.owner, ordinaryStormMove(f));
    rejectsImmutably(game, f.owner, action);

    const sinkBefore = nexusAdvisorStormPlayer(game, f.owner).forces['polar_sink:0'] ?? 0;
    game = applyAction(game, f.owner, { type: 'ship', territory: 'polar_sink', sector: 0,
      amount: 1, elite: 0, allyPayment: 0 });
    game = settle(game);
    assert.equal(nexusAdvisorStormPlayer(game, f.owner).shipped, true);
    assert.equal(nexusAdvisorStormPlayer(game, f.owner).moved, 0);
    assert.equal(nexusAdvisorStormPlayer(game, f.owner).forces['polar_sink:0'], sinkBefore + 1);
    game = applyAction(game, f.owner, { type: 'endMovement' });
    assert.notEqual(game.active, f.owner);
  });

  void test(`the real auction Karama cancels the original batch for ${label}`, () => {
    const f = createNexusAdvisorStormFixture({ separated });
    const original = structuredClone(f.game), action = declaration(f);
    let game = applyAction(original, f.owner, action);
    game = applyAction(game, f.canceler, { type: 'card', card: f.cancelerCard, mode: 'cancel' });
    game = settle(game);
    assert.equal(game.nexusAdvisorHistory!.at(-1)!.stage, 'canceled');
    assert.equal(game.nexusAdvisorHistory!.length, 1);
    assert.deepEqual(resources(game), resources(original));
    assert.deepEqual(game.players.map(player => player.advisors), original.players.map(player => player.advisors));
    assert.equal(game.discard.filter(card => card.id === f.cancelerCard).length, 1);
    assert.equal(nexusAdvisorStormPlayer(game, f.canceler).hand.some(card => card.id === f.cancelerCard), false);
    assert.equal(game.nexusCards!.cards!.hands[f.owner], null);
    assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'beneGesserit').length, 1);
    assert.equal(game.active, f.owner);
    assert.equal(game.phase, 5);
    assert.equal(fighterCount(nexusAdvisorStormPlayer(game, f.owner), f.territory), 0);
    assert.equal(quoteAdvisorBattleOffer(game).territories.includes(f.territory), false);
    assertStormGeometry(f, game);
    rejectsImmutably(game, f.owner, ordinaryStormMove(f));
    rejectsImmutably(game, f.owner, action);
    game = applyAction(game, f.owner, { type: 'endMovement' });
    assert.notEqual(game.active, f.owner);
  });

  void test(`all four legal bot policies can use Cunning for ${label}`, () => {
    const f = createNexusAdvisorStormFixture({ separated });
    for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
      const view = viewGame(f.game, f.owner);
      view.players.find(player => player.id === f.owner)!.bot = difficulty;
      const actions = botActions(view);
      const action = actions.find(candidate => candidate.type === 'nexusAdvisors');
      assert.ok(action, `${difficulty} selects the genuine two-advisor versus one-fighter offer`);
      let game = applyAction(f.game, f.owner, action);
      assert.equal(game.response?.kind, 'nexusAdvisorFlip');
      game = settle(game);
      assert.equal(fighterCount(nexusAdvisorStormPlayer(game, f.owner), f.territory), 2);
      assert.deepEqual(resources(game), resources(f.game));
      assertStormGeometry(f, game);
    }
  });
}
