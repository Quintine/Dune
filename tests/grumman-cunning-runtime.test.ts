import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { grummanCollectionChoice } from '../game/grumman-collection-options';
import { assertRuledGrummanInventory, createRuledGrummanFixture } from './fixture-ruled-grumman';
import { nextNativeE3HomeworldStep } from './fixture-homeworld-native-e3-modules';

const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision;
function advance(state: Game, until: (game: Game) => boolean): Game {
  let game = state;
  for (let count = 0; count < 900; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    if (game.decision?.kind === 'moritaniPlacement' && !game.response && !game.phaseOpening)
      game = applyAction(game, game.decision.player, {type:'decision',decline:true});
    else {
      const step = nextNativeE3HomeworldStep(game);
      assert.ok(step);
      game = applyAction(game,step.actor,step.action);
    }
  }
  throw Error('Native Grumman Cunning programme missed its boundary');
}
function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(()=>applyAction(game,actor,action));
  assert.deepEqual(game,before);
}
function cunningFixture(advanced = false) {
  const f = createRuledGrummanFixture({advanced,nexus:true});
  const token = f.game.moritaniTerror!.tokens.find(t=>t.status==='available'&&t.kind==='sabotage')!;
  const view = viewGame(f.game,f.owner);
  const action = grummanCollectionChoice(view,token.id,'polar_sink','add',true).action;
  assert.ok(action);
  return {...f,token,action};
}

void test('native high-Grumman Cunning adds from supply to an empty static territory using its actual ordinary prerequisite',()=>{
  for (const advanced of [false,true]) {
    const f = cunningFixture(advanced);
    const before = f.game;
    const wallet = before.players.find(p=>p.id===f.owner)!.spice;
    const armies = before.players.map(p=>({id:p.id,forces:p.forces,reserves:p.reserves,tanks:p.tanks,elites:p.elites}));
    reject(before,'guild',f.action);
    reject(before,f.owner,{...f.action,nexus:'old-cunning-opportunity'});
    reject(before,f.owner,{...f.action,token:f.placed});
    reject(before,f.owner,{...f.action,territory:'hidden_mobile_stronghold'});
    reject(before,f.owner,{...f.action,territory:'homeworld:moritani'});
    const game = applyAction(before,f.owner,f.action);
    assert.equal(game.players.find(p=>p.id===f.owner)!.spice,wallet+4);
    assert.deepEqual(game.players.map(p=>({id:p.id,forces:p.forces,reserves:p.reserves,tanks:p.tanks,elites:p.elites})),armies);
    assert.equal(game.moritaniTerror!.placementTurn,before.moritaniTerror!.placementTurn);
    assert.deepEqual(game.moritaniTerror!.tokens.find(t=>t.id===f.token.id),{...f.token,status:'placed',location:'polar_sink'});
    assert.deepEqual(game.moritaniTerror!.tokens.find(t=>t.id===f.placed),before.moritaniTerror!.tokens.find(t=>t.id===f.placed));
    const receipt = game.nexusMoritaniHistory!.at(-1)!.receipt;
    assert.equal(receipt.source,'grumman');
    if(receipt.source!=='grumman')throw Error('Expected the original Grumman source');
    assert.equal(receipt.sourceEvent,before.grummanCollection!.event);
    assert.equal(receipt.prerequisite,f.placedTerritory);
    assert.equal(game.nexusCards!.cards!.hands[f.owner],null);
    assert.equal(game.nexusCards!.cards!.discard.filter(card=>card==='moritani').length,1);
    assert.equal(game.grummanCollection!.nexusEvent,receipt.event);
    for(const p of game.players.filter(p=>p.id!==f.owner)){
      const view = viewGame(game,p.id);
      assert.ok(view.moritaniTerror!.tokens.every(t=>!('kind' in t)));
      assert.equal(Object.hasOwn(view,'nexusMoritaniHistory'),false);
    }
    reject(game,f.owner,f.action);
    assertRuledGrummanInventory(game);
  }
});

void test('a Grumman Cunning location authorizes a later real entry and its unrevealed return retires only that location',()=>{
  const f = cunningFixture();
  let game = applyAction(f.game,f.owner,f.action);
  game = advance(game,g=>g.turn===3&&g.phase===5&&g.active==='guild'&&clean(g));
  const beforeShipment = structuredClone(game);
  const payer = game.players.find(p=>p.id==='guild')!;
  game = applyAction(game,'guild',{type:'ship',territory:'polar_sink',sector:0,amount:1,elite:0,
    homeworldSources:{'homeworld:guild':{normal:1,elite:0}}});
  assert.equal(game.pendingTerrorEntry!.token,f.token.id);
  assert.equal(game.pendingTerrorEntry!.territory,'polar_sink');
  assert.equal(game.players.find(p=>p.id==='guild')!.spice,payer.spice-1);
  assert.equal(game.players.find(p=>p.id==='guild')!.forces['polar_sink:0'],1);
  assert.equal(game.players.find(p=>p.id==='guild')!.reserves,payer.reserves-1);
  game = applyAction(game,f.owner,{type:'decision',decline:true});
  assert.equal(game.moritaniTerror!.tokens.find(t=>t.id===f.token.id)!.status,'placed');
  assert.equal(game.players.find(p=>p.id==='guild')!.spice,beforeShipment.players.find(p=>p.id==='guild')!.spice-1);
  game = advance(game,g=>g.turn===3&&g.decision?.kind==='grummanCollection');
  const balance = game.players.find(p=>p.id===f.owner)!.spice;
  game = applyAction(game,f.owner,{type:'decision',event:game.grummanCollection!.event,mode:'remove',token:f.token.id});
  assert.equal(game.players.find(p=>p.id===f.owner)!.spice,balance+4);
  assert.equal(game.nexusMoritaniLocations![f.token.id],undefined);
  assert.equal(game.moritaniTerror!.tokens.some(t=>t.id===f.token.id),false);
  assert.equal(game.moritaniTerror!.tokens.find(t=>t.id===f.placed)!.location,f.placedTerritory);
  assert.equal(game.moritaniTerror!.tokens.find(t=>t.kind===f.token.kind)!.status,'available');
  assertRuledGrummanInventory(game);
});

void test('held Cunning cannot manufacture a Grumman addition after the only board token actually returned',()=>{
  const f = createRuledGrummanFixture({nexus:true});
  let game = applyAction(f.game,f.owner,{type:'decision',event:f.game.grummanCollection!.event,mode:'remove',token:f.placed});
  game = advance(game,g=>g.turn===3&&g.decision?.kind==='grummanCollection');
  assert.equal(game.nexusCards!.cards!.hands[f.owner],'moritani');
  const view = viewGame(game,f.owner), offer = view.grummanCollection!;
  assert.ok(offer.cunning!.blocked);
  assert.equal(offer.cunning!.prerequisite,null);
  const token = offer.tokens[0].id;
  assert.equal(grummanCollectionChoice(view,token,'polar_sink','add',true).action,null);
  reject(game,f.owner,{type:'decision',event:offer.event,mode:'add',token,territory:'polar_sink',nexus:offer.cunning!.event});
  const declined = applyAction(game,f.owner,{type:'decision',event:offer.event,decline:true});
  assert.equal(declined.players.find(p=>p.id===f.owner)!.spice,game.players.find(p=>p.id===f.owner)!.spice);
  assert.equal(declined.nexusCards!.cards!.hands[f.owner],'moritani');
});

void test('all existing legal policies resolve the owned Grumman Cunning source without reading hidden opposing faces',()=>{
  const f = cunningFixture();
  for(const difficulty of DIFFICULTIES){
    const view = viewGame(f.game,f.owner);
    view.players.find(p=>p.id===f.owner)!.bot = difficulty;
    const action = botActions(view)[0];
    assert.ok(action);
    const done = applyAction(f.game,f.owner,action);
    assert.equal(done.players.find(p=>p.id===f.owner)!.spice,f.game.players.find(p=>p.id===f.owner)!.spice+4);
    assert.equal(done.grummanCollection!.stage,'complete');
    assert.equal(done.nexusCards!.cards!.hands[f.owner],null);
    assert.equal(done.moritaniTerror!.placementTurn,f.game.moritaniTerror!.placementTurn);
    assertRuledGrummanInventory(done);
  }
});
