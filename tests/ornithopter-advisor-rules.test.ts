import assert from 'node:assert/strict';
import test from 'node:test';
import {applyAction, createGame, newPlayer, type Game, type Action} from '../game/engine';
import {baseDeck} from '../game/cards';
import {richeseCards} from '../game/richese-cards';
import {TERRITORIES, gameDistance, splitLocation} from '../game/board';
import {fighterCount, isAdvisor} from '../game/advisors';

const card = 'richese-ornithopter', remote = 'red_chasm:7', near = 'imperial_basin:10';
/** Controlled rule geometry, separate from the original-action acquisition fixture. */
function fixture() {
  const g = createGame('ADVISORRULES', newPlayer('p','Bene Gesserit','beneGesserit'), true, ['choam']);
  g.players.push(newPlayer('q','Atreides','atreides'));
  Object.assign(g, {status:'playing',turn:2,phase:5,active:'p',order:['p','q'],
    movementRemaining:['p','q'],storm:18,deck:baseDeck(),richeseCache:richeseCards()});
  const p = g.players[0], q = g.players[1];
  p.hand = [g.richeseCache!.splice(g.richeseCache!.findIndex(c => c.id === card),1)[0]];
  p.forces = {[near]:1,[remote]:2}; p.reserves = 17; p.shipped = true;
  p.advisors = {imperial_basin:{},red_chasm:{}};
  q.forces = {[near]:1,[remote]:1}; q.reserves = 18;
  return g;
}
function atDistance(g: Game, from: string, steps: number): string {
  const target = TERRITORIES.flatMap(t => t.sectors.map(s => `${t.id}:${s}`)).find(key =>
    splitLocation(key).sector !== g.storm &&
    !g.players.some(p => p.forces[key]) &&
    gameDistance(g,from,key,key => splitLocation(key).sector === g.storm) === steps);
  assert.ok(target); return target;
}
function move(g: Game, from: string, to: string, extra: Partial<Action> = {}) {
  return applyAction(g,'p',{type:'move',from,amount:1,...splitLocation(to),...extra});
}

void test('advisors do not grant city access, while a separate fighter city permits normal advisor movement', () => {
  const g = fixture();
  g.players[0].forces['arrakeen:10'] = 1; g.players[0].reserves--;
  g.players[0].advisors!.arrakeen = {};
  g.players[1].forces['arrakeen:10'] = 1; g.players[1].reserves--;
  const target = atDistance(g,remote,3), before = structuredClone(g);
  assert.equal(fighterCount(g.players[0],'arrakeen'),0);
  assert.throws(() => move(g,remote,target), /more than 1/);
  assert.throws(() => move(g,remote,target,{movementCard:card,ornithopter:'twoGroups'}), /more than 1/);
  assert.deepEqual(g,before);
  g.players[0].forces['carthag:11'] = 1; g.players[0].reserves--;
  const done = move(g,remote,target);
  assert.equal(done.players[0].forces[target],1);
  assert.equal(done.players[0].moved,1);
  assert.ok(done.players[0].hand.some(c => c.id === card), 'City access does not play the physical card');
});

void test('a card group arriving as a fighter in an empty city enables current normal range for the second advisor group', () => {
  const g = fixture();
  const first = move(g,near,'arrakeen:10',{movementCard:card,ornithopter:'twoGroups'});
  assert.equal(isAdvisor(first.players[0],'arrakeen'),false);
  assert.equal(fighterCount(first.players[0],'arrakeen'),1);
  assert.equal(first.ornithopter!.cohort!.forces[remote],2);
  const target = atDistance(first,remote,3);
  const done = move(first,remote,target,{ornithopterEvent:first.ornithopter!.event});
  assert.equal(done.players[0].moved,2);
  assert.equal(done.players[0].forces[target],1);
  assert.equal(done.discard.filter(c => c.id === card).length,1);
});

void test('a first card group remaining advisors in an occupied city grants no range to the second group', () => {
  const g = fixture();
  g.players[1].forces['arrakeen:10'] = 1; g.players[1].reserves--;
  const first = move(g,near,'arrakeen:10',{movementCard:card,ornithopter:'twoGroups'});
  assert.equal(isAdvisor(first.players[0],'arrakeen'),true);
  assert.equal(fighterCount(first.players[0],'arrakeen'),0);
  const before = structuredClone(first);
  assert.throws(() => move(first,remote,atDistance(first,remote,3),
    {ornithopterEvent:first.ornithopter!.event}), /more than 1/);
  assert.deepEqual(first,before);
  const done = move(first,remote,atDistance(first,remote,1),{ornithopterEvent:first.ornithopter!.event});
  assert.equal(done.players[0].moved,2);
  assert.equal(done.discard.filter(c => c.id === card).length,1);
});

void test('card range cannot bypass a new advisor fighter lock or the native two-faction entry distinction', () => {
  const g = fixture();
  g.players[0].advisors!.imperial_basin = {lockedTurn:g.turn};
  g.players[1].forces['arrakeen:10'] = 1; g.players[1].reserves--;
  const third = newPlayer('h','Harkonnen','harkonnen');
  third.forces = {'arrakeen:10':1}; third.reserves = 19;
  g.players.push(third); g.order.push('h'); g.movementRemaining!.push('h');
  const before = structuredClone(g);
  assert.throws(() => move(g,near,'arrakeen:10',{fighters:true,movementCard:card,ornithopter:'range3'}), /cannot flip/);
  assert.deepEqual(g,before);
  const done = move(g,near,'arrakeen:10',{movementCard:card,ornithopter:'range3'});
  assert.equal(isAdvisor(done.players[0],'arrakeen'),true);
  assert.equal(done.players[0].advisors!.arrakeen.lockedTurn,g.turn);
  assert.equal(fighterCount(done.players[0],'arrakeen'),0);
  assert.equal(done.discard.filter(c => c.id === card).length,1);
});
