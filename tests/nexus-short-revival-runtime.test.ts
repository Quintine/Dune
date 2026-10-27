import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import { emperorNexusPools, emperorNexusRevivalCount } from '../game/nexus-emperor-secret-ally';
import { nexusEmperorRevivalAction } from '../game/nexus-emperor-secret-ally-options';
import { forceRevivalRemaining, freeRevivalRemaining } from '../game/revival';
import {
  createNexusShortRevivalFixture, applyNexusShortRevival as apply,
  nexusShortRevivalPlayer as p, nexusShortRevivalInventory as inventory,
  type NexusShortRevivalFixture,
} from './fixture-nexus-short-revival';

const sources = new Map<number,NexusShortRevivalFixture>();
function fixture(amount:1|2 = 1) {
  let f = sources.get(amount);
  if (!f) {f = createNexusShortRevivalFixture({amount}); sources.set(amount,f);}
  return f;
}

for (const amount of [1,2] as const)
  void test(`earned Emperor Secret Ally returns the actual ${amount}-counter shortage through native revival without ordinary quota or price`, () => {
    const f = fixture(amount), before = p(f.game,f.actor);
    assert.equal(f.base.lobby.status,'lobby');
    assert.ok(f.base.lobby.nexusCards); assert.equal(f.base.setup.status,'setup');
    assert.ok(f.game.players.every(p => p.faction !== 'emperor'));
    assert.equal(f.shipment.steps[0].actor,'guild');
    assert.equal(f.shipment.steps[0].action.type,'ship');
    assert.equal(f.shipment.steps[0].action.amount,1);
    assert.equal(f.battleResolution.lastBattleContext!.winner,f.actor);
    assert.equal(p(f.battleResolution,f.actor).tanks,amount);
    assert.equal(f.battleActions.filter(step => step.action.type === 'battlePlan').length,2);
    assert.equal(f.alliance.steps.length,2);
    assert.equal(p(f.game,'guild').ally,'harkonnen');
    assert.equal(p(f.game,f.actor).ally,null);
    assert.equal(f.afterDraw.nexusCards!.cards!.hands[f.actor],'emperor');
    assert.equal(f.game.phase,4);
    if (f.game.revivalOrder) assert.equal(f.game.revivalOrder.remaining[0],f.actor);
    assert.equal(before.revived,0);
    assert.equal(f.sourceCount,f.sourceActions.length);
    const ordinary = forceRevivalRemaining(f.game,before), free = freeRevivalRemaining(f.game,before);
    assert.equal(ordinary, amount);
    const result = apply(f), after = p(result.game,f.actor);
    assert.deepEqual(emperorNexusPools(after),{...emperorNexusPools(before),reserves:before.reserves+amount,tanks:0});
    assert.equal(after.spice,before.spice);
    assert.equal(forceRevivalRemaining(result.game,after),0, 'The Tanks are now empty; the ordinary usage ledger above remains unchanged.');
    assert.equal(freeRevivalRemaining(result.game,after),free);
    assert.deepEqual(after.forces,before.forces);
    assert.equal(result.game.phase,4);
    assert.deepEqual(result.game.revivalOrder,f.game.revivalOrder);
    const receipt = result.game.nexusEmperorSecretHistory!.at(-1)!;
    assert.ok(receipt.version === 2);
    assert.equal(receipt.stage,'returned');
    assert.equal(receipt.amount,amount);
    assert.equal(emperorNexusRevivalCount(receipt),amount);
    assert.equal(receipt.before.tanks,amount);
    assert.equal(receipt.after!.tanks,0);
    assert.equal(result.game.nexusCards!.cards!.hands[f.actor],null);
    assert.equal(result.game.nexusCards!.cards!.discard.filter(card => card === 'emperor').length,1);
    assert.equal(result.game.nexusEmperorSecretHistory!.length,1);
    assert.deepEqual(inventory(result.game),f.original);
    const immutable = structuredClone(result.game);
    assert.throws(() => applyAction(result.game,f.actor,f.action));
    assert.deepEqual(result.game,immutable);
  });

void test('all four minimal policies use the exact earned short-revival adapter and actual native return', () => {
  const f = fixture();
  assert.deepEqual(nexusEmperorRevivalAction(viewGame(f.game,f.actor),0),f.action);
  for (const profile of ['Easy','Medium','Hard','Brutal'] as const) {
    const game = structuredClone(f.game), view = viewGame(game,f.actor);
    view.players.find(p => p.id === f.actor)!.bot = profile;
    const action = botActions(view).find(action => action.type === 'nexusEmperorRevive');
    assert.ok(action,`${profile} needs the real one-counter Secret Ally return.`);
    assert.deepEqual(action,f.action);
    const returned = apply(f,game).game;
    assert.equal(p(returned,f.actor).tanks,0);
    const receipt = returned.nexusEmperorSecretHistory!.at(-1)!;
    assert.ok(receipt.version === 2);
    assert.equal(receipt.amount,1);
    assert.equal(returned.nexusCards!.cards!.discard.filter(card => card === 'emperor').length,1);
    assert.deepEqual(inventory(returned),f.original);
  }
});
