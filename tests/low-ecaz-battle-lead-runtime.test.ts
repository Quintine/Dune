import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { ecazOccupyLeadOptions } from '../game/ecaz-occupy-options';
import { homeworldGameIntegrity, homeworldTable } from '../game/homeworld-game';
import {
  createLowEcazBattleLeadFixture as fixture,
  actLowEcazBattleLead as act,
  chooseLowEcazBattleLead as choose,
  openLowEcazBattleLeadPlans as openPlans,
  lowEcazBattleLeadInventory as inventory,
  lowEcazBattleLeadPlayer as player,
} from './fixture-low-ecaz-battle-lead';

function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
function physical(game: Game) {
  return game.players.map(seat => ({
    id: seat.id, reserves: seat.reserves, tanks: seat.tanks, forces: structuredClone(seat.forces),
    elites: structuredClone(seat.elites), spice: seat.spice, ally: seat.ally,
    leaders: structuredClone(seat.leaders),
  }));
}

for (const advanced of [false, true]) {
  const mode = advanced ? 'Advanced' : 'Basic';

  void test(`${mode} native Low Ecaz lets its actual opponent select either coalition lead`, () => {
    const f = fixture({ advanced });
    assert.equal(f.game.homeworlds !== null, true); assert.deepEqual(f.game.expansions, ['ecaz']);
    assert.ok(!f.game.nexusCards); assert.ok(!f.game.leaderSkills);
    assert.equal(player(f.afterSetup, f.ecaz).reserves, 14);
    assert.equal(player(f.afterSetup, f.ecaz).spice, 12);
    assert.equal(player(f.game, f.ecaz).reserves, 6);
    assert.equal(player(f.game, f.ecaz).spice, 4);
    assert.equal(player(f.game, f.ecaz).forces[f.location], 8);
    assert.deepEqual(f.allianceSteps, [
      { actor: f.ecaz, action: { type: 'alliance', target: f.ally } },
      { actor: f.ally, action: { type: 'alliance', target: f.ecaz } },
    ]);
    const shipment = f.shipments.find(step => step.actor === f.ecaz); assert.ok(shipment);
    assert.equal(shipment.action.amount, 8); assert.ok(shipment.action.homeworldSources);
    assert.equal(f.setupSteps.some(step => step.actor === f.ecaz && step.action.type === 'ecazSetup'), true);
    assert.equal(f.sourceActionCount, f.actions.length);
    const home = homeworldTable(f.game)!.find(home => home.native === f.ecaz)!;
    assert.equal(home.population, 6); assert.equal(home.side, 'low');
    assert.ok(f.game.decision?.kind === 'ecazBattleLead');
    assert.equal(f.game.decision.player, f.opponent); assert.equal(f.game.decision.lowEcaz, true);
    assert.equal(f.game.decision.event, f.game.battle!.event);
    const options = ecazOccupyLeadOptions(viewGame(f.game, f.opponent));
    assert.deepEqual(options.map(option => option.lead), [f.ecaz, f.ally]);
    assert.ok(options.every(option => option.blocked === null));
    assert.ok(ecazOccupyLeadOptions(viewGame(f.game, f.ecaz)).every(option => option.blocked !== null));
    for (const lead of [f.ecaz, f.ally]) {
      const selected = choose(f.game, lead);
      assert.equal(selected.battle!.ecazOccupy!.lead, lead);
      assert.equal(selected.response?.kind, 'ecazOccupy'); assert.equal(selected.response?.owner, f.ecaz);
      assert.deepEqual(physical(selected), physical(f.game));
      const game = openPlans(selected), profile = viewGame(game, lead).battle!.ecazOccupy!.profile!;
      assert.equal(profile.planOwner, lead); assert.equal(profile.payer, lead);
      assert.equal(profile.forceOwner, f.ally); assert.equal(profile.fixedEcazDial, 4);
      assert.equal(profile.ecazForces.normal, 8); assert.equal(profile.canceled, false);
      assert.ok([game.battle!.attacker, game.battle!.defender].includes(lead));
      assert.ok([game.battle!.attacker, game.battle!.defender].includes(f.opponent));
      assert.deepEqual(inventory(game), f.originalInventory); homeworldGameIntegrity(game);
    }
  });

  void test(`${mode} native Low Ecaz rejects Ecaz self-selection and a stale opponent event`, () => {
    const f = fixture({ advanced }), action = f.leadActions[0].action;
    reject(f.game, f.ecaz, action); reject(f.game, f.ally, action);
    reject(f.game, f.opponent, { ...action, event: `${f.event}:stale` });
    reject(f.game, f.opponent, { ...action, lead: f.opponent });
    const selected = choose(f.game, f.ally);
    assert.equal(selected.battle!.ecazOccupy!.lead, f.ally);
    reject(selected, f.opponent, { ...action, lead: f.ecaz });
    assert.equal(selected.battle!.ecazOccupy!.lead, f.ally);
  });

  void test(`${mode} native seven-reserve Ecaz retains its ordinary battle-lead choice`, () => {
    const f = fixture({ advanced, reserves: 7 });
    assert.equal(player(f.game, f.ecaz).reserves, 7);
    assert.equal(player(f.game, f.ecaz).forces[f.location], 7);
    assert.equal(player(f.game, f.ecaz).spice, 5);
    const home = homeworldTable(f.game)!.find(home => home.native === f.ecaz)!;
    assert.equal(home.population, 7); assert.equal(home.side, 'high');
    assert.ok(f.game.decision?.kind === 'ecazBattleLead');
    assert.equal(f.game.decision.player, f.ecaz); assert.equal(f.game.decision.lowEcaz, undefined);
    reject(f.game, f.opponent, f.leadActions[0].action);
    const selected = choose(f.game, f.ally);
    assert.equal(selected.battle!.ecazOccupy!.lead, f.ally);
    assert.equal(selected.response?.kind, 'ecazOccupy');
    assert.deepEqual(inventory(selected), f.originalInventory);
  });

  void test(`${mode} native Guild Karama cancels Occupy while preserving either opponent-selected lead`, () => {
    const f = fixture({ advanced });
    assert.deepEqual(player(f.afterSetup, f.holder).hand.map(card => card.id), [f.karama]);
    for (const lead of [f.ecaz, f.ally]) {
      let game = choose(f.game, lead);
      game = act(game, f.holder, f.cancelAction);
      game = openPlans(game);
      assert.equal(game.battle!.ecazOccupy!.lead, lead);
      assert.equal(game.battle!.ecazOccupy!.canceled, true);
      const profile = viewGame(game, lead).battle!.ecazOccupy!.profile!;
      assert.equal(profile.planOwner, lead); assert.equal(profile.payer, lead);
      assert.equal(profile.forceOwner, lead); assert.equal(profile.fixedEcazDial, 0);
      assert.equal(profile.forces.normal, lead === f.ecaz ? 8 : 2);
      assert.equal(profile.forces.elite, lead === f.ecaz ? 0 : 2);
      assert.equal(game.discard.filter(card => card.id === f.karama).length, 1);
      assert.equal(player(game, f.holder).hand.some(card => card.id === f.karama), false);
      assert.deepEqual(physical(game), physical(f.game));
      assert.equal(game.decision?.kind, undefined);
      assert.deepEqual(inventory(game), f.originalInventory); homeworldGameIntegrity(game);
    }
  });

  void test(`${mode} all four native opponent policies make a legal Low Ecaz lead selection`, () => {
    const f = fixture({ advanced });
    for (const difficulty of DIFFICULTIES) {
      const view = viewGame(f.game, f.opponent);
      view.players.find(seat => seat.id === f.opponent)!.bot = difficulty;
      const before = structuredClone(view), actions = botActions(view);
      assert.ok(actions.length > 0, difficulty);
      assert.deepEqual(view, before);
      for (const action of actions) {
        assert.equal(action.type, 'decision', difficulty);
        assert.equal(action.event, f.event, difficulty);
        assert.ok(action.lead === f.ecaz || action.lead === f.ally, difficulty);
        const selected = act(f.game, f.opponent, action);
        assert.equal(selected.battle!.ecazOccupy!.lead, action.lead, difficulty);
        assert.equal(selected.response?.kind, 'ecazOccupy', difficulty);
        assert.deepEqual(inventory(selected), f.originalInventory);
      }
      const ecazView = viewGame(f.game, f.ecaz);
      ecazView.players.find(seat => seat.id === f.ecaz)!.bot = difficulty;
      assert.deepEqual(botActions(ecazView), []);
    }
  });
}
