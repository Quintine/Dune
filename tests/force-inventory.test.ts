import assert from 'node:assert/strict';
import test from 'node:test';
import { FACTIONS } from '../game/catalog';
import { forceCounterName, forceInventory, type PublicForcePlayer } from '../game/force-inventory';
import { applyAction, createGame, initializeIxGameForAudit, joinGame, newPlayer, viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import { gameTerritories, MOBILE_STRONGHOLD } from '../game/board';
import { DISCOVERY_LOCATIONS } from '../game/discoveries';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { homeworldPopulations } from '../game/homeworld-population';
import { homeworldRevivalFixture } from './fixture-homeworld-revival';
import { createRicheseNoField, deployRicheseNoField, projectRicheseNoField } from '../game/richese-no-field';

void test('every faction has inspectable physical reserves without consulting private fields', () => {
  for (const house of FACTIONS) {
    const player = newPlayer('p', house.name, house.id);
    const inventory = forceInventory(player)!;
    assert.ok(inventory); assert.equal(inventory.total, 20);
    assert.equal(inventory.rows[0].total, 20);
    assert.equal(inventory.normal + inventory.elite, 20);
  }
  assert.equal(forceCounterName('ixians', 'force'), 'Suboid');
  assert.equal(forceCounterName('ixians', 'special'), 'Cyborg');
  assert.equal(forceCounterName('emperor', 'special'), 'Sardaukar');
  assert.equal(forceCounterName('fremen', 'special'), 'Fedaykin');
  assert.equal(forceCounterName('beneGesserit', 'advisor'), 'Advisor');
});

void test('special counters are subsets in reserves, Tanks and board groups, never extra strength counters', () => {
  const player: PublicForcePlayer = { ...newPlayer('e', 'Emperor', 'emperor'), reserves: 8, tanks: 4,
    forces: { 'arrakeen:10': 5, 'imperial_basin:9': 3 },
    elites: { reserves: 3, tanks: 1, forces: { 'arrakeen:10': 1 } } };
  const before = JSON.stringify(player);
  const inventory = forceInventory(player)!;
  assert.deepEqual([inventory.total, inventory.normal, inventory.elite], [20, 15, 5]);
  assert.deepEqual(inventory.rows.map(r => [r.total, r.normal, r.elite]), [[8,5,3],[4,3,1],[5,4,1],[3,3,0]]);
  assert.deepEqual(forceInventory(JSON.parse(before)), inventory);
  inventory.rows[0].total = 99;
  assert.equal(JSON.stringify(player), before);
});

void test('native Homeworlds subdivide reserves and foreign deployments count exactly once', () => {
  const player: PublicForcePlayer = { ...newPlayer('e', 'Emperor', 'emperor'), reserves: 10, tanks: 4,
    forces: { 'arrakeen:10': 4 }, elites: { reserves: 3, tanks: 0, forces: { 'arrakeen:10': 1 } } };
  const context = { advanced: true, players: [
    { id:'e', faction:'emperor' as const, reserves:10, eliteReserves:3 },
    { id:'i', faction:'ixians' as const, reserves:10, eliteReserves:2 },
  ] };
  const custody = { salusa: { normal:3, elite:2 }, visitors: {
    'homeworld:emperor': { i: { normal:2, elite:0 } },
    'homeworld:ixians': { e: { normal:1, elite:1 } },
  } };
  const populations = homeworldPopulations(context, custody);
  const worlds = homeworldForceGroups(context, custody).map(world => ({ ...world, ...populations.find(p => p.location === world.id)! }));
  const before = JSON.stringify({ player, worlds });
  const inventory = forceInventory(player, worlds)!;
  assert.deepEqual([inventory.total, inventory.elite], [20, 5]);
  assert.deepEqual(inventory.nativeReserves.map(r => [r.name, r.total, r.elite]), [['Kaitain',5,1],['Salusa Secundus',5,2]]);
  assert.equal(inventory.rows.find(r => r.name === 'Ix')!.total, 2);
  assert.equal(JSON.stringify({ player, worlds }), before);
});

void test('genuine Basic Homeworld setup retains physical Sardaukar and Fedaykin through all private views and JSON', () => {
  const game = homeworldRevivalFixture();
  assert.equal(game.advanced, false);
  const before = JSON.stringify(game);
  for (const target of game.players) {
    const inventories = game.players.map(viewer => {
      const view = viewGame(JSON.parse(before), viewer.id);
      return forceInventory(view.players.find(p => p.id === target.id)!, view.homeworlds?.worlds);
    });
    assert.ok(inventories[0]);
    assert.equal(inventories[0]!.total, 20);
    assert.equal(inventories[0]!.elite, target.faction === 'emperor' ? 5 : 3);
    assert.ok(inventories.every(i => JSON.stringify(i) === JSON.stringify(inventories[0])));
  }
  assert.equal(JSON.stringify(game), before);
});

void test('advisor stance covers all sectors of its territory without adding counters or changing reserves', () => {
  const player = { ...newPlayer('b','Bene Gesserit','beneGesserit'), reserves:11,
    forces: { 'imperial_basin:9':3, 'imperial_basin:10':2, 'arrakeen:10':4 }, advisors: { imperial_basin:{} } };
  const inventory = forceInventory(player)!;
  assert.equal(inventory.total,20); assert.equal(inventory.advisors,5);
  assert.deepEqual(inventory.rows.filter(r => r.advisors).map(r => r.total),[2,3]);
  assert.equal(inventory.rows[0].advisors,false);
  assert.equal(forceInventory({...player,faction:'atreides'})!.advisors,0);
});

void test('genuine Ix setup exposes its six counters before the Mobile Stronghold enters the map', () => {
  let game=createGame('FORCEIX',newPlayer('i','Ixians','ixians'),false,['ix']);
  joinGame(game,newPlayer('a','Atreides','atreides'));
  for(const p of game.players) game=applyAction(game,p.id,{type:'ready'});
  game=initializeIxGameForAudit(game);
  for(let n=0; !game.players[0].forces[`${MOBILE_STRONGHOLD}:0`] && n<30; n++) {
    let moved=false;
    for(const p of game.players) {
      const view=viewGame(game,p.id); view.players.find(s=>s.id===p.id)!.bot='Easy';
      const action=botActions(view)[0];
      if(action) { game=applyAction(game,p.id,action); moved=true; break; }
    }
    assert.ok(moved,'Setup must make legal progress.');
  }
  assert.equal(game.mobileStronghold?.location,null);
  assert.ok(!gameTerritories(game).some(t=>t.id===MOBILE_STRONGHOLD));
  const view=viewGame(game,'a');
  const inventory=forceInventory(view.players.find(p=>p.id==='i')!)!;
  assert.equal(inventory.total,20);assert.equal(inventory.elite,7);
  const hms=inventory.rows.find(r=>r.id===`${MOBILE_STRONGHOLD}:0`)!;
  assert.equal(hms.total,6);assert.equal(hms.elite,3);assert.doesNotMatch(hms.name,/sector 0/);
  const discovery=DISCOVERY_LOCATIONS[0];
  const placed={...newPlayer('a','Atreides','atreides'),reserves:18,forces:{[`${discovery.id}:0`]:2}};
  assert.equal(forceInventory(placed)!.rows[2].name,discovery.name);
});

void test('concealed No-Field values have identical public inventories and add no physical counter', () => {
  const outputs=[];
  for(const value of [0,3,5] as const) {
    const state=createRicheseNoField(['secret-zero','secret-three','secret-five']);
    const deployed=deployRicheseNoField(state,{tokenId:state.tokens.find(t=>t.value===value)!.id,controller:'r',location:{territory:'arrakeen',sector:10}});
    const player={...newPlayer('r','Richese','richese'),noField:projectRicheseNoField(deployed,false)};
    const inventory=forceInventory(player)!;
    assert.equal(inventory.total,20);assert.deepEqual(inventory.marker,{name:'Arrakeen · sector 10'});
    assert.doesNotMatch(JSON.stringify(inventory),/secret-|tokenId|lastShipped/);
    outputs.push(inventory);
  }
  assert.deepEqual(outputs[0],outputs[1]);assert.deepEqual(outputs[1],outputs[2]);
});

void test('inconsistent public pools produce no fabricated inventory', () => {
  const player=newPlayer('i','Ixians','ixians');
  assert.equal(forceInventory({...player,reserves:2}),null);
  assert.equal(forceInventory({...player,forces:{'unknown:2':1}}),null);
  assert.equal(forceInventory(player,[{id:'homeworld:ixians',native:'i',card:'ix',forces:{i:{normal:0,elite:0}}}]),null);
});
