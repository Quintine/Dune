import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import type { Difficulty } from '../game/bot-profiles';
import { actDiscoveryNoFieldEntry as act, createDiscoveryNoFieldEntryFixture as fixture,
  discoveryNoFieldEntryInventory as inventory, discoveryNoFieldEntryPlayer as p,
  discoveryNoFieldEntryReload as reload, finishDiscoveryNoFieldEntry as finish } from './fixture-discovery-no-field-entry';

function reject(game: Game, actor: string, action: Action) {
  const before = reload(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function allowances(game: Game) {
  return game.players.map(player => ({ id: player.id, shipped: player.shipped, moved: player.moved,
    movesAllowed: viewGame(game, player.id).players.find(own => own.id === player.id)!.movesAllowed }));
}

void test('public Basic and Advanced sources earn original location placement paid marker inspection and next-turn offer', () => {
  for (const advanced of [false, true]) {
    const f = fixture({ advanced });
    assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
    const optIn = f.sourceActions.findIndex(step => step.action.type === 'moduleOption' && step.action.module === 'discoveries');
    const ready = f.sourceActions.findIndex(step => step.action.type === 'ready');
    assert.ok(optIn >= 0 && optIn < ready);
    assert.equal(f.sourceCounts.setup, f.setupActions.length); assert.equal(f.sourceCounts.source, f.sourceActions.length);
    assert.equal(f.sourceCounts.placement, f.placement.steps.length); assert.equal(f.sourceCounts.markerShipment, f.markerShipment.steps.length);
    assert.equal(f.sourceCounts.revelation, f.revelation.steps.length);
    const originalDraw = f.placement.before.spiceDeck[0];
    assert.ok('territory' in originalDraw && originalDraw.discovery === 'discovery-hagga-basin');
    assert.equal(f.placement.after.spiceWindow?.territory, 'hagga_basin');
    assert.ok(f.placement.after.discoveries!.tokens.some(token => token.id === f.discoveryToken && token.face === f.face && token.status === 'placed'));
    assert.equal(p(f.markerShipment.before, f.owner).spice - p(f.markerShipment.after, f.owner).spice, 2);
    assert.deepEqual(f.revelation.steps.map(step => [step.action.type, step.action.reveal]), [['discovery', false], ['discovery', true]]);
    assert.equal(f.beforeReveal.phase, 7); assert.equal(f.game.turn, 2); assert.equal(f.game.phase, 0);
    assert.equal(f.game.decision?.kind, 'discoveryEntry'); assert.equal(f.game.decision?.player, f.owner);
    assert.deepEqual(f.offer.noField, { tokenId: f.markerToken, event: f.noFieldEvent, source: f.source });
    assert.deepEqual(f.action.groups, []); assert.deepEqual(inventory(f.game), f.original);
  }
});

void test('marker-only original zero three and five enter for free concealed in both modes without materializing', () => {
  for (const advanced of [false, true]) for (const value of [0, 3, 5] as const) {
    const f = fixture({ advanced, value }), before = p(f.game, f.owner), turns = allowances(f.game);
    let game = act(reload(f.game), f.owner, f.action); game = finish(game);
    const after = p(game, f.owner);
    assert.equal(after.spice, before.spice); assert.equal(after.reserves, before.reserves); assert.equal(after.tanks, before.tanks);
    assert.deepEqual(after.forces, before.forces); assert.deepEqual(allowances(game), turns);
    assert.deepEqual(after.noField!.tokens, f.marker!.tokens); assert.equal(after.noField!.lastShipped, f.markerToken);
    assert.deepEqual(after.noField!.deployed!.location, { territory: f.destination, sector: 0 });
    assert.notEqual(after.noFieldEvent, f.noFieldEvent); assert.equal(game.discoveryEntry ?? null, null);
    assert.equal(game.phase, 0); assert.equal(game.stormPending, advanced ? 1 : null);
    assert.deepEqual(inventory(game), f.original); reject(game, f.owner, f.action);
  }
});

void test('actual earlier physical companion and later marker enter as separate native custody in one free group', () => {
  const f = fixture({ companions: true, value: 5, face: 'shrine' }); assert.ok(f.physicalShipment);
  assert.equal(f.physicalShipment.before.turn, 1); assert.equal(f.markerShipment.before.turn, 2);
  assert.equal(f.beforeReveal.turn, 2); assert.equal(f.game.turn, 3);
  assert.equal(p(f.physicalShipment.before, f.owner).spice - p(f.physicalShipment.after, f.owner).spice, 2);
  const before = p(f.game, f.owner), turns = allowances(f.game);
  assert.equal(before.forces[f.source], 1); assert.deepEqual(f.action.groups, [{ source: f.source, normal: 1, elite: 0 }]);
  const game = finish(act(reload(f.game), f.owner, f.action)), after = p(game, f.owner);
  assert.equal(after.forces[f.source] ?? 0, 0); assert.equal(after.forces[`${f.destination}:0`], 1);
  assert.deepEqual(after.noField!.deployed!.location, { territory: f.destination, sector: 0 });
  assert.equal(after.reserves, before.reserves); assert.equal(after.tanks, before.tanks); assert.equal(after.spice, before.spice);
  assert.deepEqual(allowances(game), turns); assert.deepEqual(after.noField!.tokens, f.marker!.tokens);
  assert.equal(after.noField!.lastShipped, f.markerToken); assert.deepEqual(inventory(game), f.original);
});

void test('declining the original owned offer retains the marker event at its parent and resumes the normal Storm', () => {
  const f = fixture({ value: 3 }), before = p(f.game, f.owner), turns = allowances(f.game);
  const game = finish(act(reload(f.game), f.owner, f.decline)), after = p(game, f.owner);
  assert.deepEqual(after.noField, f.marker); assert.equal(after.noFieldEvent, f.noFieldEvent);
  assert.equal(after.spice, before.spice); assert.equal(after.reserves, before.reserves); assert.equal(after.tanks, before.tanks);
  assert.deepEqual(after.forces, before.forces); assert.deepEqual(allowances(game), turns);
  assert.equal(game.discoveryEntry ?? null, null); assert.equal(game.phase, 0); assert.equal(game.stormPending, 1);
  assert.deepEqual(inventory(game), f.original);
});

void test('stale marker and offer events foreign actors and forged physical sources reject before free-entry custody changes', () => {
  const f = fixture({ value: 5 });
  reject(f.game, f.other, f.action); reject(f.game, f.owner, { ...f.action, event: 'old-discovery-entry' });
  reject(f.game, f.owner, { ...f.action, noFieldEvent: 'old-marker-event' });
  reject(f.game, f.owner, { ...f.action, noField: 'foreign-marker' });
  const unused = p(f.game, f.owner).noField!.tokens.find(token => token.id !== f.markerToken)!;
  reject(f.game, f.owner, { ...f.action, noField: unused.id });
  reject(f.game, f.owner, { ...f.action, groups: [{ source: 'arrakeen:10', normal: 1, elite: 0 }] });
  reject(f.game, f.owner, { ...f.action, groups: [{ source: f.source, normal: 1, elite: 0 }] });
  reject(f.game, f.owner, { type: 'decision', event: f.event, accept: true, groups: [] });
  assert.deepEqual(p(f.game, f.owner).noField, f.marker); assert.deepEqual(inventory(f.game), f.original);
});

void test('a real mixed source can send only its physical companion and leave the concealed marker at the parent', () => {
  const f = fixture({ companions: true, value: 3 }), before = p(f.game, f.owner);
  const game = finish(act(reload(f.game), f.owner, { type: 'decision', event: f.event, accept: true, groups: f.action.groups }));
  const after = p(game, f.owner);
  assert.equal(after.forces[f.source] ?? 0, 0); assert.equal(after.forces[`${f.destination}:0`], 1);
  assert.deepEqual(after.noField, f.marker); assert.equal(after.noFieldEvent, f.noFieldEvent);
  assert.equal(after.spice, before.spice); assert.equal(after.reserves, before.reserves); assert.equal(after.tanks, before.tanks);
  assert.deepEqual(inventory(game), f.original);
});

void test('all four minimal profiles propose the current owned marker entry and complete its original free arrival legally', () => {
  const f = fixture({ value: 0 });
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] satisfies Difficulty[]) {
    const view = viewGame(f.game, f.owner); view.players.find(player => player.id === f.owner)!.bot = difficulty;
    const choice = botActions(view).find(action => action.type === 'decision' && action.accept === true && action.noField === f.markerToken);
    assert.ok(choice, `${difficulty} supplies the owned native marker option`);
    const game = finish(act(reload(f.game), f.owner, choice));
    assert.deepEqual(p(game, f.owner).noField!.deployed!.location, { territory: f.destination, sector: 0 });
    assert.equal(p(game, f.owner).reserves, p(f.game, f.owner).reserves); assert.equal(p(game, f.owner).tanks, 0);
    assert.deepEqual(inventory(game), f.original);
  }
});
