import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { quoteEcazDukeRevival } from '../game/ecaz-duke-revival';
import {
  createHomeworldEcazDukeFixture as fixture, actHomeworldEcazDuke as act,
  advanceHomeworldEcazDuke as advance, homeworldEcazDukeClean as clean,
  homeworldEcazDukePlayer as player, homeworldEcazDukeInventory as inventory,
  homeworldEcazDukePhysical as physical, playHomeworldEcazDukeBattle as playBattle,
  type HomeworldEcazDukeFixture,
} from './fixture-homeworld-ecaz-duke';

function reject(game: Game, actor: string, action: Action, pattern?: RegExp) {
  const before = structuredClone(game);
  if (pattern) assert.throws(() => applyAction(game, actor, action), pattern);
  else assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
function nativeSource(f: HomeworldEcazDukeFixture) {
  assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, f.advanced); assert.ok(f.setup.homeworlds);
  assert.deepEqual(f.setup.expansions, ['ecaz']); assert.ok(f.beforeStartingDeal.players.every(player => !player.hand.length));
  assert.equal(f.originalInventory.length, 33); assert.deepEqual(inventory(f.game), f.originalInventory);
  assert.equal(f.funding.steps[0].actor, f.guild); assert.equal(f.funding.steps[0].action.type, 'bribe');
  assert.equal(player(f.funding.after, f.occupier).spice, player(f.funding.before, f.occupier).spice);
  assert.equal(player(f.funding.after, f.occupier).bribes, player(f.funding.before, f.occupier).bribes + 1);
  assert.equal(player(f.duneShipment.after, f.occupier).forces['carthag:11'], 2);
  assert.equal(f.nexus.nexus, true); assert.equal(player(f.game, f.occupier).ally, f.ally);
  assert.equal(f.alliance.steps.length, f.allied ? 2 : 0);
  assert.ok(f.invasion && f.secondEntrant);
  assert.equal(f.invasion.steps[0].actor, f.occupier); assert.equal(f.invasion.steps[0].action.type, 'homeworldShip');
  assert.equal(f.secondEntrant.steps[0].actor, f.opponent); assert.equal(f.secondEntrant.steps[0].action.type, 'ship');
  assert.equal(f.qualification.world, f.world); assert.equal(f.qualification.player, f.occupier);
  assert.equal(f.qualification.turn, 2); assert.equal(f.qualification.cause, 'sole');
  assert.equal(f.game.turn, 2); assert.equal(f.game.phase, 6); assert.ok(clean(f.game));
  assert.equal(f.game.battle?.territory, f.secondTerritory); assert.deepEqual(f.game.battle?.plans, {});
  assert.equal(f.game.dukeVidal?.leader.dead, false); assert.equal(f.game.dukeVidal?.leader.id, f.dukeId);
  assert.equal(f.sourceActionCount, f.actions.length);
}
function grant(f: HomeworldEcazDukeFixture, recipient: string) {
  const game = structuredClone(f.game), option = viewGame(game, f.occupier).homeworldEcazDuke;
  assert.ok(option); assert.equal(option.blocked, null); assert.ok(option.recipients.some(player => player.id === recipient));
  const action: Action = { type: 'homeworldDuke', event: option.event, recipient };
  const before = structuredClone(physical(game)), granted = act(game, f.occupier, action);
  assert.deepEqual(physical(granted), before); assert.equal(granted.dukeVidal?.controller, recipient);
  assert.equal(granted.dukeVidal?.source, 'homeworldEcaz'); assert.equal(granted.dukeVidal?.acquiredTurn, granted.turn);
  return { game: granted, action, option };
}

for (const advanced of [false, true]) void test(
  `${advanced ? 'Advanced' : 'Basic'} native sole Ecaz World occupation automatically grants the single recipient Duke for one actual battle`, () => {
    const f = fixture({ advanced }); nativeSource(f);
    assert.equal(f.game.dukeVidal?.controller, f.occupier); assert.equal(f.game.dukeVidal?.source, 'homeworldEcaz');
    assert.equal(f.game.homeworldEcazDukeGrants?.length, 1);
    const battle = playBattle(f, structuredClone(f.game));
    assert.equal(battle.game.dukeVidal?.controller, null); assert.equal(battle.game.dukeVidal?.leader.dead, false);
    assert.equal(battle.game.homeworldEcazDukeGrants?.length, 1);
    assert.deepEqual(inventory(battle.game), f.originalInventory);
  });

for (const advanced of [false, true]) void test(
  `${advanced ? 'Advanced' : 'Basic'} native allied Ecaz World occupation retains both real Duke choices and the ally uses one battle`, () => {
    const f = fixture({ advanced, allied: true }); nativeSource(f); assert.ok(f.ally);
    assert.equal(f.game.dukeVidal?.controller, null);
    const option = viewGame(f.game, f.occupier).homeworldEcazDuke; assert.ok(option);
    assert.deepEqual(option.recipients.map(player => player.id).sort(), [f.occupier, f.ally].sort());
    const self = grant(f, f.occupier);
    assert.equal(self.game.dukeVidal?.controller, f.occupier);
    const allied = grant(f, f.ally); assert.equal(allied.game.homeworldEcazDukeGrants?.length, 1);
    reject(allied.game, f.occupier, allied.action);
    const battle = playBattle(f, allied.game);
    assert.equal(battle.game.dukeVidal?.controller, null); assert.equal(battle.game.dukeVidal?.leader.dead, false);
    assert.equal(battle.game.homeworldEcazDukeGrants?.length, 1);
    reject(battle.game, f.occupier, allied.action);
    assert.deepEqual(inventory(battle.game), f.originalInventory);
  });

void test('native occupied Ecaz Duke choice rejects stale events, foreign actors and unrelated recipients before any control changes', () => {
  const f = fixture({ allied: true }); nativeSource(f);
  const option = viewGame(f.game, f.occupier).homeworldEcazDuke; assert.ok(option);
  assert.equal(viewGame(f.game, f.opponent).homeworldEcazDuke ?? null, null);
  const action: Action = { type: 'homeworldDuke', event: option.event, recipient: f.occupier };
  reject(f.game, f.occupier, { ...action, event: `${option.event}:stale` });
  reject(f.game, f.opponent, action); reject(f.game, f.occupier, { ...action, recipient: f.opponent });
  reject(f.game, f.occupier, { ...action, recipient: f.ecaz });
  assert.equal(f.game.dukeVidal?.controller, null); assert.deepEqual(inventory(f.game), f.originalInventory);
});

for (const advanced of [false, true]) void test(
  `${advanced ? 'Advanced' : 'Basic'} occupied Ecaz Duke use can die natively without granting its foreign ally revival permission`, () => {
    const f = fixture({ advanced, allied: true }); nativeSource(f); assert.ok(f.ally);
    const granted = grant(f, f.ally), battle = playBattle(f, granted.game, { killDuke: true });
    assert.equal(battle.game.dukeVidal?.leader.dead, true); assert.equal(battle.game.dukeVidal?.controller, null);
    const game = advance(battle.game, state => state.turn === 3 && state.phase === 4 && clean(state));
    assert.equal(game.dukeVidal?.leader.dead, true);
    reject(game, f.ally, { type: 'reviveLeader', leader: f.dukeId }, /Ecaz/i);
    assert.equal(game.dukeVidal?.leader.dead, true);
    const dead = structuredClone(game.dukeVidal!.leader), cash = player(game, f.ecaz).spice;
    const quote = quoteEcazDukeRevival(game, f.ecaz, false);
    assert.equal(quote.cost, 5); assert.ok(cash >= quote.cost, 'Original native Ecaz cash must fund its actual five-spice revival');
    const revived = act(game, f.ecaz, { type: 'reviveLeader', leader: f.dukeId });
    assert.equal(player(revived, f.ecaz).spice, cash - quote.cost);
    assert.equal(revived.dukeVidal?.leader.id, dead.id); assert.equal(revived.dukeVidal?.leader.deaths, dead.deaths);
    assert.equal(revived.dukeVidal?.leader.dead, false); assert.equal(revived.dukeVidal?.controller, null);
    assert.equal(revived.dukeVidal?.source, null); assert.equal(revived.dukeVidal?.acquiredTurn, null);
    assert.equal(player(revived, f.ecaz).leaders.some(leader => leader.id === f.dukeId), false);
    const renewed = viewGame(revived, f.occupier).homeworldEcazDuke; assert.ok(renewed);
    assert.equal(renewed.blocked, null);
    assert.deepEqual(renewed.recipients.map(recipient => recipient.id).sort(), [f.occupier, f.ally].sort());
    assert.deepEqual(inventory(revived), f.originalInventory);
  });
