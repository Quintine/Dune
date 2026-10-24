import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, normalizeAutomaticGame, viewGame, type Action, type Game } from '../game/engine';
import { fighterCount, isAdvisor } from '../game/advisors';
import { splitLocation } from '../game/board';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { canceledResponseSource } from '../game/karama-context';
import { createAdvisorStormFlipFixture, commitAdvisorStormFlip } from './fixture-advisor-storm-flip';
import {
  createAdvisorAmbassadorFlipFixture, createAdvisorDiscoveryFlipFixture,
  actAdvisorRelocationFlip as act, advisorRelocationFlipPlayer as player,
  advisorRelocationFlipInventory as inventory, finishAdvisorRelocationFlip as finish,
  commitAdvisorRelocationFlip as commit,
} from './fixture-advisor-relocation-flip';

const fixtures = [
  ['ambassador', createAdvisorAmbassadorFlipFixture],
  ['discovery', createAdvisorDiscoveryFlipFixture],
] as const;
function allow(game: Game) {
  for (let n = 0; game.response?.automaticAdvisorFlip && n < 30; n++) {
    const actor = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(actor);
    game = act(game, actor.id, { type: 'passResponse' });
  }
  assert.ok(!game.response?.automaticAdvisorFlip); return game;
}
const physical = (game: Game) => game.players.map(p => ({ id:p.id, forces:p.forces,
  reserves:p.reserves, tanks:p.tanks, spice:p.spice, shipped:p.shipped, moved:p.moved }));
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

void test('special relocation does not add a field to the saved source shape of an existing storm counter',()=>{
  const f=createAdvisorStormFlipFixture(),pending=commitAdvisorStormFlip(f.game,f).game;
  assert.ok(pending.response);
  const selected=canceledResponseSource(pending,pending.response) as {source:Record<string,unknown>};
  assert.deepEqual(Object.keys(selected.source).sort(),['battle','faceDance','gamont','group','homeworld','pending','source','storm','transport']);
  assert.equal(JSON.stringify(selected).includes('"relocation":'),false);
});

for (const [kind, fixture] of fixtures) for (const prevented of [false,true]) {
  void test(`native ${kind} ${prevented ? 'prevention' : 'allowance'} keeps the completed transfer and resumes original arrival once`, () => {
    const f = fixture(), before = structuredClone(f.game), pending = commit(f.game,f).game;
    assert.deepEqual(f.game,before);
    const source = pending.response?.automaticAdvisorFlip; assert.ok(source?.producer === 'specialRelocation');
    assert.equal(source.relocation.kind,kind); assert.equal(source.territory,f.origin);
    assert.equal(source.relocation.player,f.mover); assert.equal(source.relocation.destination,f.destination);
    assert.deepEqual(Object.keys(source.relocation).sort(),['destination','event','kind','origin','player','sector']);
    assert.equal(fighterCount(player(pending,f.bg),f.origin),0);
    assert.equal(player(pending,f.bg).forces[f.location],1);
    assert.equal(player(pending,f.mover).forces[f.from],undefined);
    const amount = Object.entries(player(before,f.mover).forces).filter(([key]) => splitLocation(key).territory === f.origin)
      .reduce((sum,[,count]) => sum+count,0);
    assert.ok(amount > 0);
    assert.equal(player(pending,f.mover).forces[f.destinationLocation],(player(before,f.mover).forces[f.destinationLocation]??0)+amount);
    assert.deepEqual(pending.players.map(p => [p.spice,p.reserves,p.tanks,p.shipped,p.moved]),
      before.players.map(p => [p.spice,p.reserves,p.tanks,p.shipped,p.moved]));
    if (kind === 'ambassador') assert.equal(pending.pendingAmbassador?.relocation?.next,'flip');
    else assert.equal(pending.discoveryEntry?.stage,'arrival');
    assert.ok(viewGame(pending,f.holder).responseControls?.cancelCards.includes(f.karama));
    assert.ok(!JSON.stringify(viewGame(pending,f.holder).response).includes('signature'));
    const committed = physical(pending), stable = normalizeAutomaticGame(pending);
    assert.deepEqual(physical(stable),committed);
    assert.deepEqual(stable.pendingAutomaticAdvisorRelocation,pending.pendingAutomaticAdvisorRelocation);
    let done = prevented ? act(pending,f.holder,{type:'card',card:f.karama,mode:'cancel'}) : allow(pending);
    done = finish(done);
    assert.equal(done.pendingAutomaticAdvisorRelocation,undefined);
    assert.equal(done.pendingAutomaticAdvisorFlips,undefined);
    assert.ok(!done.pendingAmbassador); assert.equal(done.discoveryEntry,undefined);
    assert.equal(isAdvisor(player(done,f.bg),f.origin),prevented);
    assert.equal(fighterCount(player(done,f.bg),f.origin),prevented?0:1);
    assert.deepEqual(physical(done),committed);
    assert.equal(done.discard.filter(c => c.id === f.karama).length,Number(prevented));
    assert.deepEqual(inventory(done),f.originalInventory);
    assert.deepEqual(physical(normalizeAutomaticGame(done)),committed);
  });
}

for (const [kind, fixture] of fixtures) void test(`${kind} rejects a changed private continuation before spending the conversion card`, () => {
  const f=fixture(),pending=commit(f.game,f).game;
  pending.pendingAutomaticAdvisorRelocation!.signature='different-original-relocation';
  reject(pending,f.holder,{type:'card',card:f.karama,mode:'cancel'});
  assert.ok(player(pending,f.holder).hand.some(c=>c.id===f.karama));
});

void test('declining original native Discovery entry keeps the mixed parent group without a conversion',()=>{
  const f=createAdvisorDiscoveryFlipFixture(),before=physical(f.game);
  const done=finish(act(f.game,f.actor,{type:'decision',event:f.event,accept:false}));
  assert.equal(done.pendingAutomaticAdvisorRelocation,undefined);assert.equal(done.pendingAutomaticAdvisorFlips,undefined);
  assert.equal(done.discoveryEntry,undefined);assert.deepEqual(physical(done),before);
  assert.equal(isAdvisor(player(done,f.bg),f.origin),true);
  assert.ok(player(done,f.holder).hand.some(c=>c.id===f.karama));assert.deepEqual(inventory(done),f.originalInventory);
});

for (const prevented of [false,true]) void test(`controlled allied BG empty Ambassador arrival ${prevented?'prevention':'allowance'} has one mandatory flip and no optional retry`, () => {
  const f=createAdvisorAmbassadorFlipFixture(),source=structuredClone(f.game);
  // Borrow original cards, pieces, consumed token and entrant from the native
  // source, but stage alliance/beneficiary selection explicitly. This is not
  // evidence of a native earned alliance journey.
  const owner=source.pendingAmbassador!.owner;
  player(source,owner).ally=f.bg; player(source,f.bg).ally=owner;
  source.pendingAmbassador!.beneficiary=f.bg; source.decision!.player=f.bg;
  const action:Action={...f.action,forces:{[f.location]:1},eliteForces:{},fighters:true};
  const pending=act(source,f.bg,action),automatic=pending.response?.automaticAdvisorFlip;
  assert.ok(automatic?.producer==='specialRelocation');
  assert.equal(automatic.territory,f.destination); assert.equal(automatic.owner,f.bg);
  assert.equal(pending.pendingAmbassador?.relocation?.order.wantsFighters,false);
  assert.equal(pending.pendingAmbassador?.relocation?.order.advisors,false);
  assert.equal(isAdvisor(player(pending,f.bg),f.destination),true);
  assert.equal(fighterCount(player(pending,f.bg),f.destination),0);
  const committed=physical(pending);
  const done=finish(prevented?act(pending,f.holder,{type:'card',card:f.karama,mode:'cancel'}):allow(pending));
  assert.ok(!done.pendingAmbassador); assert.equal(done.pendingAutomaticAdvisorRelocation,undefined);
  assert.equal(done.response?.kind==='advisorFlip',false,'An empty arrival cannot immediately retry the prevented occurrence.');
  assert.equal(isAdvisor(player(done,f.bg),f.destination),prevented);
  assert.deepEqual(physical(done),committed); assert.deepEqual(inventory(done),f.originalInventory);
});

void test('all four existing profiles resolve native Ambassador and Discovery conversion responses legally',()=>{
  for(const [,fixture] of fixtures) for(const profile of DIFFICULTIES){
    const f=fixture(),pending=commit(f.game,f).game,own=viewGame(pending,f.holder);
    own.players.find(p=>p.id===f.holder)!.bot=profile;
    const actions=botActions(own);assert.ok(actions.length);
    const done=finish(allow(act(pending,f.holder,actions[0])));
    assert.equal(done.pendingAutomaticAdvisorRelocation,undefined);
    assert.deepEqual(physical(done),physical(pending));assert.deepEqual(inventory(done),f.originalInventory);
  }
});
