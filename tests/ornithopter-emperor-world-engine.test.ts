import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import type { Difficulty } from '../game/bot-profiles';
import { actOrnithopterEmperorWorld as act, createOrnithopterEmperorWorldFixture as fixture,
  ornithopterEmperorWorldPlayer as p, ornithopterEmperorWorldArmy as army,
  ornithopterEmperorWorldInventory as inventory, ornithopterEmperorWorldReload as reload,
  ornithopterEmperorWorldMove as worldMove, ornithopterEmperorGroundMove as groundMove,
  settleOrnithopterEmperorWorld as settle } from './fixture-ornithopter-emperor-world';

function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function aggregate(game: Game, owner: string) {
  const own = p(game, owner); return { reserves: own.reserves, tanks: own.tanks, eliteReserves: own.elites!.reserves,
    eliteTanks: own.elites!.tanks, spice: own.spice };
}
function completed(f: ReturnType<typeof fixture>, game: Game) {
  assert.equal(game.ornithopter ?? null, null); assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
  assert.equal(p(game, f.owner).hand.some(card => card.id === f.card), false);
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.deepEqual(inventory(game), f.original);
}

void test('public Advanced Emperor World source pays for its original cache card and typed ground army without Semuta', () => {
  const f = fixture();
  assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup'); assert.equal(Boolean(f.game.semutaPreview), false);
  const optIn = f.sourceActions.findIndex(step => step.action.type === 'homeworlds' && step.action.enabled);
  const ready = f.sourceActions.findIndex(step => step.action.type === 'ready'); assert.ok(optIn >= 0 && optIn < ready);
  assert.equal(f.sourceCounts.setup, f.setupActions.length); assert.equal(f.sourceCounts.source, f.sourceActions.length);
  assert.equal(f.sourceCounts.acquisition, f.acquisition.steps.length); assert.ok(f.shipment);
  assert.equal(f.acquisition.bid.actor, f.owner); assert.equal(f.acquisition.bid.action.amount, 1);
  assert.equal(p(f.acquisition.before, f.owner).spice - p(f.acquisition.after, f.owner).spice, 1);
  assert.equal(p(f.shipment.before, f.owner).spice - p(f.shipment.after, f.owner).spice, 2);
  assert.deepEqual(army(f.afterSetup, 'homeworld:emperor'), { normal: 15, elite: 0 });
  assert.deepEqual(army(f.game, 'homeworld:emperor'), { normal: 14, elite: 0 });
  assert.deepEqual(army(f.game, 'homeworld:emperor:salusa'), { normal: 0, elite: 5 });
  assert.equal(p(f.game, f.owner).forces[f.source], 1); assert.equal(p(f.game, f.owner).moved, 0);
  assert.deepEqual(inventory(f.game), f.original);
});

void test('World first then real ground second share one physical two-group flight and earn only its completed extra credit', () => {
  const f = fixture(), before = aggregate(f.game, f.owner);
  let game = settle(act(reload(f.game), f.owner, worldMove(f.game, 'homeworld:emperor', 1, 0, 'twoGroups')));
  assert.equal(game.ornithopter?.completed, 1); assert.equal(game.ornithopter?.homeworldCohort, true);
  assert.equal(p(game, f.owner).moved, 1); assert.equal(p(game, f.owner).ornithopterExtraMoves ?? 0, 0);
  assert.deepEqual(aggregate(game, f.owner), before); assert.deepEqual(army(game, 'homeworld:emperor:salusa'), { normal: 1, elite: 5 });
  const event = game.ornithopter!.event, second = groundMove(game); assert.equal(second.ornithopterEvent, event);
  game = settle(act(game, f.owner, second)); completed(f, game);
  assert.equal(p(game, f.owner).moved, 2); assert.equal(p(game, f.owner).ornithopterExtraMoves, 1);
  assert.equal(p(game, f.owner).forces[f.source] ?? 0, 0); assert.equal(p(game, f.owner).forces[f.groundDestination], 1);
  assert.deepEqual(aggregate(game, f.owner), before);
});

void test('ground first then World second uses the original typed World cohort and discards once after the last World group', () => {
  const f = fixture(), before = aggregate(f.game, f.owner);
  let game = settle(act(reload(f.game), f.owner, groundMove(f.game, 'twoGroups')));
  assert.equal(game.ornithopter?.completed, 1); assert.equal(game.ornithopter?.homeworldCohort, true);
  const last = worldMove(game, 'homeworld:emperor:salusa', 0, 1); assert.equal(last.ornithopterEvent, game.ornithopter!.event);
  assert.equal(last.movementCard, undefined);
  game = settle(act(game, f.owner, last)); completed(f, game);
  assert.deepEqual(army(game, 'homeworld:emperor'), { normal: 14, elite: 1 });
  assert.deepEqual(army(game, 'homeworld:emperor:salusa'), { normal: 0, elite: 4 });
  assert.deepEqual(aggregate(game, f.owner), before); assert.equal(p(game, f.owner).moved, 2);
  assert.equal(p(game, f.owner).ornithopterExtraMoves, 1);
});

void test('two World groups cannot reuse arriving normals and may move only the original Salusa stars after a typed merge', () => {
  const f = fixture({ groundArmy: false }), before = aggregate(f.game, f.owner);
  assert.equal(p(f.game, f.owner).shipped, false);
  let game = settle(act(reload(f.game), f.owner, worldMove(f.game, 'homeworld:emperor', 15, 0, 'twoGroups')));
  assert.equal(p(game, f.owner).shipped, true); assert.equal(p(game, f.owner).moved, 1);
  assert.deepEqual(army(game, 'homeworld:emperor:salusa'), { normal: 15, elite: 5 });
  reject(game, f.owner, worldMove(game, 'homeworld:emperor:salusa', 1, 0));
  game = settle(act(game, f.owner, worldMove(game, 'homeworld:emperor:salusa', 0, 1))); completed(f, game);
  assert.deepEqual(army(game, 'homeworld:emperor'), { normal: 0, elite: 1 });
  assert.deepEqual(army(game, 'homeworld:emperor:salusa'), { normal: 15, elite: 4 });
  assert.deepEqual(aggregate(game, f.owner), before); assert.equal(p(game, f.owner).moved, 2);
  assert.equal(p(game, f.owner).ornithopterExtraMoves, 1);
});

void test('range-three World use completes its single native route without creating a foreign World or Arrakis route', () => {
  const f = fixture({ groundArmy: false }), first = worldMove(f.game, 'homeworld:emperor', 1, 0, 'range3');
  reject(f.game, f.owner, { ...first, origin: 'homeworld:atreides' });
  reject(f.game, f.owner, { ...first, destination: 'homeworld:atreides' });
  reject(f.game, f.owner, { ...first, territory: 'imperial_basin', sector: 9 });
  const before = aggregate(f.game, f.owner), game = settle(act(reload(f.game), f.owner, first)); completed(f, game);
  assert.equal(p(game, f.owner).moved, 1); assert.equal(p(game, f.owner).ornithopterExtraMoves ?? 0, 0);
  assert.equal(p(game, f.owner).shipped, true); assert.deepEqual(aggregate(game, f.owner), before);
  assert.deepEqual(army(game, 'homeworld:emperor:salusa'), { normal: 1, elite: 5 });
  reject(game, f.owner, worldMove(game, 'homeworld:emperor:salusa', 0, 1));
});

void test('stale foreign and forged World flight packets reject before movement or printed-card cost', () => {
  const f = fixture(), first = worldMove(f.game, 'homeworld:emperor', 1, 0, 'twoGroups');
  reject(f.game, f.observer, first); reject(f.game, f.owner, { ...first, event: 'old-world-custody' });
  reject(f.game, f.owner, { ...first, movementCard: 'foreign-card' });
  reject(f.game, f.owner, { ...first, ornithopter: 'both' });
  let game = settle(act(reload(f.game), f.owner, first));
  const next = worldMove(game, 'homeworld:emperor:salusa', 0, 1);
  reject(game, f.owner, { ...next, ornithopterEvent: 'old-flight' });
  reject(game, f.owner, { ...next, event: first.event });
  reject(game, f.owner, { ...next, movementCard: f.card, ornithopter: 'twoGroups' });
  game = settle(act(game, f.owner, next)); completed(f, game);
});

void test('ending after one real World group disposes the physical flight without inventing a completed extra move', () => {
  const f = fixture({ groundArmy: false });
  let game = settle(act(reload(f.game), f.owner, worldMove(f.game, 'homeworld:emperor', 1, 0, 'twoGroups')));
  assert.equal(game.ornithopter?.completed, 1); assert.equal(p(game, f.owner).ornithopterExtraMoves ?? 0, 0);
  game = settle(act(game, f.owner, { type: 'endMovement' })); completed(f, game);
  assert.notEqual(game.active, f.owner); assert.equal(p(game, f.owner).moved, 1);
  assert.equal(p(game, f.owner).ornithopterExtraMoves ?? 0, 0);
  assert.deepEqual(army(game, 'homeworld:emperor:salusa'), { normal: 1, elite: 5 });
});

void test('original dealt Hajr follows the completed World flight and grants one separate ordinary World movement', () => {
  const f = fixture({ groundArmy: false, hajr: true }); assert.ok(f.hajr);
  let game = settle(act(reload(f.game), f.owner, worldMove(f.game, 'homeworld:emperor', 1, 0, 'twoGroups')));
  game = settle(act(game, f.owner, worldMove(game, 'homeworld:emperor:salusa', 0, 1))); completed(f, game);
  game = settle(act(game, f.owner, { type: 'card', card: f.hajr }));
  game = settle(act(game, f.owner, worldMove(game, 'homeworld:emperor', 0, 1)));
  assert.equal(p(game, f.owner).moved, 3); assert.equal(p(game, f.owner).ornithopterExtraMoves, 1);
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
  assert.equal(game.discard.filter(card => card.id === f.hajr).length, 1);
  assert.deepEqual(army(game, 'homeworld:emperor'), { normal: 14, elite: 0 });
  assert.deepEqual(army(game, 'homeworld:emperor:salusa'), { normal: 1, elite: 5 });
  assert.deepEqual(inventory(game), f.original);
});

void test('all four minimal policies start and legally finish an owned World flight without a fabricated ground route', () => {
  const f = fixture({ groundArmy: false });
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] satisfies Difficulty[]) {
    const view = viewGame(f.game, f.owner); view.players.find(player => player.id === f.owner)!.bot = difficulty;
    const first = botActions(view).find(action => action.type === 'emperorHomeworldMove' && action.movementCard === f.card);
    assert.ok(first, `${difficulty} supplies the printed owned World flight option`);
    let game = settle(act(reload(f.game), f.owner, first));
    if (game.ornithopter) {
      const pending = viewGame(game, f.owner); pending.players.find(player => player.id === f.owner)!.bot = difficulty;
      const next = botActions(pending).find(action => action.type === 'emperorHomeworldMove' && action.ornithopterEvent === game.ornithopter!.event)
        ?? botActions(pending).find(action => action.type === 'endMovement');
      assert.ok(next); game = settle(act(game, f.owner, next));
    }
    completed(f, game); assert.equal(p(game, f.owner).reserves, p(f.game, f.owner).reserves);
    assert.equal(p(game, f.owner).tanks, 0);
  }
});
