import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { nexusSardaukarAction } from '../game/nexus-sardaukar-options';
import {
  createNexusShortCunningFixture, resolveNexusShortCunning as resolve,
  finishNexusShortCunning as finish, actNexusShortCunning as act,
  nexusShortCunningPlayer as p, nexusShortCunningInventory as inventory,
  type NexusShortCunningFixture,
} from './fixture-nexus-short-cunning';

const sources = new Map<number,NexusShortCunningFixture>();
function fixture(amount:2|4 = 2) {
  let f = sources.get(amount);
  if (!f) {f = createNexusShortCunningFixture({amount}); sources.set(amount,f);}
  return f;
}
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game,actor,action)); assert.deepEqual(game,before);
}

void test('native short Cunning source earns its original Emperor Nexus and pays only for two or four ordinary counters', () => {
  for (const amount of [2,4] as const) {
    const f = fixture(amount);
    assert.equal(f.base.lobby.status,'lobby');
    assert.ok(f.base.lobby.nexusCards);
    assert.equal(f.base.setup.status,'setup');
    assert.equal(f.base.beforeDraw.turn,2);
    assert.equal(f.base.afterDraw.nexusCards!.cards!.hands[f.actor],'emperor');
    assert.equal(p(f.game,f.actor).ally,null);
    assert.equal(p(f.game,f.opponent).ally,'guild');
    assert.equal(f.shipment.steps[0].action.amount,amount);
    assert.equal(f.shipment.steps[0].action.elite,0);
    assert.equal(f.shipment.cost,amount);
    assert.equal(p(f.game,f.actor).forces[f.key],amount);
    assert.equal(p(f.game,f.actor).elites!.forces[f.key] ?? 0,0);
    assert.deepEqual(f.game.battle!.plans,{});
    assert.equal(f.sourceCount,f.sourceActions.length);
    assert.equal(f.original.cards.length,33);
    assert.deepEqual(inventory(f.game),f.original);
    assert.match(f.disclosure,/Original public.*No played hand, wallet, force, phase/);
  }
});

for (const amount of [2,4] as const)
  void test(`native Emperor Cunning counts all ${amount} short ordinary fighters and loses one physical normal exactly once`, () => {
    const f = fixture(amount), before = structuredClone(p(f.game,f.actor)), use = resolve(f);
    const quote = viewGame(use.game,f.actor).battle!.ownForces!;
    assert.deepEqual([quote.normal,quote.elite,quote.temporaryElite],[amount,0,amount]);
    assert.equal(viewGame(f.game,f.actor).nexusSardaukar!.shortCount,amount);
    assert.equal(viewGame(use.game,f.actor).nexusSardaukar!.shortCount,amount);
    const receipt = use.game.nexusSardaukarHistory![0].receipt;
    assert.equal(receipt.normal,amount); assert.equal(receipt.count,amount);
    assert.equal(receipt.shortGroup,true); assert.equal(receipt.elite,0);
    assert.deepEqual(p(use.game,f.actor).elites,before.elites);
    reject(use.game,f.actor,f.action);
    const result = finish(f,use.game), done = p(result.game,f.actor);
    assert.equal(result.game.lastBattleContext!.winner,f.actor);
    assert.equal(done.forces[f.key],amount-1);
    assert.equal(done.tanks,before.tanks+1);
    assert.equal(done.reserves,before.reserves);
    assert.deepEqual(done.elites,before.elites);
    assert.equal(result.game.nexusSardaukarHistory!.length,1);
    assert.equal(result.game.nexusSardaukarHistory![0].casualties!.outcome,'complete');
    assert.ok(result.game.nexusSardaukarHistory![0].casualties!.options.every(loss => loss.elite === 0));
    assert.equal(result.game.nexusCards!.cards!.discard.filter(c => c === 'emperor').length,1);
    assert.deepEqual(inventory(result.game),f.original);
  });

void test('original opposing Karama cancels a short Cunning declaration without refund or conversion', () => {
  const f = fixture(), before = structuredClone(p(f.game,f.actor)), use = resolve(f,true);
  assert.equal(use.declared.response?.kind,'nexusSardaukar');
  assert.equal(use.declared.nexusCards!.cards!.hands[f.actor],null);
  assert.equal(viewGame(use.game,f.actor).battle!.ownForces!.temporaryElite ?? 0,0);
  assert.equal(use.game.nexusSardaukarHistory![0].stage,'canceled');
  assert.equal(use.game.nexusSardaukarHistory![0].receipt.count,2);
  assert.deepEqual(p(use.game,f.actor).forces,before.forces);
  assert.deepEqual(p(use.game,f.actor).elites,before.elites);
  assert.equal(p(use.game,f.actor).spice,before.spice);
  assert.equal(use.game.discard.filter(c => c.id === f.karama).length,1);
  const result = finish(f,use.game,f.canceledPlan);
  assert.equal(result.game.lastBattleContext!.winner,f.actor);
  assert.equal(p(result.game,f.actor).forces[f.key],1);
  assert.equal(p(result.game,f.actor).tanks,before.tanks+1);
  assert.deepEqual(p(result.game,f.actor).elites,before.elites);
  assert.equal(result.game.nexusCards!.cards!.discard.filter(c => c === 'emperor').length,1);
  assert.deepEqual(inventory(result.game),f.original);
});

void test('short Cunning exact adapter rejects stale owners and all four minimal policies can declare and plan legally', () => {
  const f = fixture();
  assert.deepEqual(nexusSardaukarAction(viewGame(f.game,f.actor),f.event),f.action);
  reject(f.game,f.opponent,f.action);
  reject(f.game,f.actor,{...f.action,event:`${f.event}:stale`});
  for (const profile of ['Easy','Medium','Hard','Brutal'] as const) {
    const view = viewGame(f.game,f.actor);
    view.players.find(p => p.id === f.actor)!.bot = profile;
    const declaration = botActions(view).find(a => a.type === 'nexusSardaukar');
    assert.ok(declaration,`${profile} needs the exact short Cunning action.`);
    assert.deepEqual(declaration,f.action);
    const pending = act(structuredClone(f.game),f.actor,declaration);
    assert.equal(pending.nexusSardaukarHistory![0].receipt.count,2);
    const active = resolve(f).game, planning = viewGame(active,f.actor);
    planning.players.find(p => p.id === f.actor)!.bot = profile;
    const plan = botActions(planning).find(a => a.type === 'battlePlan');
    assert.ok(plan,`${profile} needs a legal converted short-group plan.`);
    const committed = act(active,f.actor,plan);
    assert.ok(committed.battle!.plans[f.actor]);
    assert.deepEqual(inventory(committed),f.original);
  }
});
