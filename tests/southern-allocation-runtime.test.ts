import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import type { Difficulty } from '../game/bot-profiles';
import { homeworldRevivalDeploymentActions } from '../game/homeworld-revival-deployment-options';
import {
  actSouthernAllocation as act, advanceSouthernAllocation as advance,
  createSouthernAllocationFixture as fixture, openSouthernAllocation as open,
  settleSouthernAllocation as settle, southernAllocationAction as choice,
  southernAllocationClean as clean, southernAllocationInventory as inventory,
  southernPlayer as p, southernReload as reload, type SouthernAllocationStep,
} from './fixture-southern-allocation';

function reject(game: Game, actor: string, action: Action) {
  const before = reload(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'Rejected allocation leaves the native return and all physical custody unchanged');
}
function offer(game: Game) {
  const current = viewGame(game, 'fremen').homeworldRevivalDeployment; assert.ok(current); return current;
}
function allocation(game: Game) {
  const current = offer(game).allocation; assert.ok(current); return current;
}
function finish(game: Game, actions: SouthernAllocationStep[] = []) {
  game = settle(game, actions);
  assert.equal(game.homeworldRevivalReturn?.stage, 'complete');
  assert.equal(game.decision ?? null, null);
  inventory(game);
  return game;
}
function unchangedUses(before: Game, after: Game) {
  for (const key of ['spice', 'shipped', 'moved', 'revived', 'freeForcesRevived'] as const)
    assert.equal(p(after)[key], p(before)[key], key);
  assert.deepEqual(after.homeworldRevivalReturn?.group, before.homeworldRevivalReturn?.group);
}

void test('genuine Southern source earns three starred Tanks through original setup paid invasion and battle', () => {
  const f = fixture();
  assert.equal(f.sourceCounts.setup, f.setupSteps.length);
  assert.equal(f.sourceCounts.throughBattle, f.setupSteps.length + f.battleSteps.length);
  assert.equal(f.sourceCounts.source, f.actions.length);
  assert.deepEqual(f.actions.filter(step => step.action.type === 'stormDial').map(step => step.action.amount), [0, 0, 1, 1]);
  assert.equal(f.shipmentCost, 1);
  assert.ok(f.actions.some(step => step.actor === 'emperor' && step.action.type === 'ship' && step.action.amount === 1));
  assert.equal(p(f.afterBattle).tanks, 3); assert.equal(p(f.afterBattle).elites?.tanks, 3);
  assert.equal(p(f.afterBattle).forces['sietch_tabr:14'], 1);
  assert.equal(p(f.game).reserves, 10); assert.equal(f.game.turn, 2); assert.equal(f.game.phase, 4);
  assert.equal(f.game.advanced, false); assert.equal(f.game.storm, 3);
  assert.deepEqual(inventory(f.game), f.original);
  assert.equal(f.original.cards.length, f.setup.deck.length);
  assert.ok(f.original.traitors.length > 0 && f.original.spice.length > 0);
  assert.equal(f.game.homeworldRevivalReturn ?? null, null, 'The source has not installed or played its upcoming revival');
});

void test('one genuine free Basic return opens its original three-star allocation without spending shipment or movement', () => {
  const f = fixture(), game = open(f);
  assert.equal(p(game).spice, p(f.game).spice);
  assert.equal(p(game).tanks, 0); assert.equal(p(game).reserves, 13);
  assert.equal(p(game).elites?.reserves, 3); assert.equal(p(game).elites?.revived, 3);
  assert.equal(p(game).revived, 3); assert.equal(p(game).freeForcesRevived, 3);
  assert.deepEqual(game.homeworldRevivalReturn?.group, { amount: 3, elite: 3, free: 3 });
  assert.equal(offer(game).normal, 0); assert.equal(offer(game).elite, 3);
  assert.deepEqual(allocation(game), { total: 3, remaining: 3, placed: 0, kept: 0 });
  assert.equal(p(game).shipped, p(f.game).shipped); assert.equal(p(game).moved, p(f.game).moved);
  assert.ok(offer(game).destinations.filter(destination => !destination.blocked).length >= 2);
  assert.deepEqual(inventory(game), f.original);
});

void test('three returned Southern stars split one plus two between distinct native occupied territories', () => {
  const f = fixture(); let game = open(f);
  const returned = reload(game), first = choice(game, 'false_wall_south:5', 1);
  game = settle(act(reload(game), 'fremen', first));
  assert.equal(p(game).forces['false_wall_south:5'], 4);
  assert.equal(p(game).elites?.forces['false_wall_south:5'], 1);
  assert.equal(p(game).reserves, 12); assert.equal(p(game).elites?.reserves, 2);
  assert.deepEqual(allocation(game), { total: 3, remaining: 2, placed: 1, kept: 0 });
  assert.notEqual(offer(game).event, first.event);
  assert.equal(offer(game).elite, 2);
  game = finish(act(reload(game), 'fremen', choice(game, 'false_wall_west:18', 2)));
  assert.equal(p(game).forces['false_wall_west:18'], 5);
  assert.equal(p(game).elites?.forces['false_wall_west:18'], 2);
  assert.equal(p(game).reserves, 10); assert.equal(p(game).elites?.reserves, 0);
  unchangedUses(returned, game);
  assert.deepEqual(inventory(game), f.original);
});

void test('one star may be placed and every remaining returned star kept at Southern Hemisphere', () => {
  const f = fixture(); let game = open(f);
  const returned = reload(game);
  game = settle(act(game, 'fremen', choice(game, 'sietch_tabr:14', 1)));
  const last = offer(game).event;
  game = finish(act(reload(game), 'fremen', { type: 'decision', event: last, decline: true }));
  assert.equal(p(game).forces['sietch_tabr:14'], 2);
  assert.equal(p(game).elites?.forces['sietch_tabr:14'], 1);
  assert.equal(p(game).reserves, 12); assert.equal(p(game).elites?.reserves, 2);
  assert.equal(p(game).tanks, 0);
  unchangedUses(returned, game);
  reject(game, 'fremen', { type: 'decision', event: last, decline: true });
});

void test('legacy whole-group packet still places all three stars at one native destination', () => {
  const f = fixture(); let game = open(f);
  const returned = reload(game), packet = choice(game, 'sietch_tabr:14', 3);
  game = finish(act(reload(game), 'fremen', packet));
  assert.equal(p(game).forces['sietch_tabr:14'], 4);
  assert.equal(p(game).elites?.forces['sietch_tabr:14'], 3);
  assert.equal(p(game).reserves, 10);
  unchangedUses(returned, game);
  reject(game, 'fremen', packet);
});

void test('declining the first child keeps the exact complete returned group without undoing revival', () => {
  const f = fixture(); let game = open(f);
  const returned = reload(game), event = offer(game).event;
  game = finish(act(reload(game), 'fremen', { type: 'decision', event, decline: true }));
  assert.equal(p(game).reserves, 13); assert.equal(p(game).elites?.reserves, 3);
  assert.equal(p(game).tanks, 0); assert.equal(p(game).elites?.tanks, 0);
  assert.deepEqual(p(game).forces, p(f.game).forces);
  assert.deepEqual(p(game).elites?.forces, p(f.game).elites?.forces);
  unchangedUses(returned, game);
  assert.deepEqual(inventory(game), f.original);
});

void test('fresh child event fences stale packets overdraw wrong owner and an unearned destination', () => {
  let game = open(fixture());
  const old = choice(game, 'false_wall_south:5', 1);
  game = settle(act(game, 'fremen', old));
  const current = choice(game, 'false_wall_west:18', 1);
  reject(game, 'fremen', old);
  reject(game, 'emperor', current);
  for (const amount of [0, -1, 3, 1.5]) reject(game, 'fremen', { ...current, amount });
  reject(game, 'fremen', { ...current, destination: 'arrakeen:10' });
  reject(game, 'fremen', { ...current, destination: 'homeworld:fremen' });
  reject(game, 'fremen', { type: 'decision', event: current.event, decline: true, amount: 1 });
  assert.deepEqual(allocation(game), { total: 3, remaining: 2, placed: 1, kept: 0 });
});

void test('pending allocations keep the original Revival control owned until all stars are disposed', () => {
  let game = open(fixture());
  reject(game, 'fremen', { type: 'ready' });
  reject(game, 'fremen', { type: 'revive', amount: 1, elite: 0 });
  reject(game, 'emperor', { type: 'revive', amount: 1, elite: 0 });
  game = settle(act(game, 'fremen', choice(game, 'false_wall_south:5', 1)));
  reject(game, 'fremen', { type: 'ready' });
  game = finish(act(game, 'fremen', { type: 'decision', event: offer(game).event, decline: true }));
  game = advance(game, state => state.phase === 5 && clean(state));
  assert.equal(p(game).revived, 3); assert.equal(p(game).elites?.revived, 3);
});

void test('two actual starred casualties produce only their exact two-star native allocation', () => {
  const f = fixture({ stars: 2 }); let game = open(f);
  assert.equal(p(f.game).elites?.forces['sietch_tabr:14'], 1);
  assert.deepEqual(allocation(game), { total: 2, remaining: 2, placed: 0, kept: 0 });
  game = settle(act(game, 'fremen', choice(game, 'false_wall_south:5', 1)));
  assert.equal(offer(game).elite, 1);
  game = finish(act(reload(game), 'fremen', choice(game, 'false_wall_west:18', 1)));
  assert.equal(p(game).elites?.forces['sietch_tabr:14'], 1);
  assert.equal(p(game).elites?.forces['false_wall_south:5'], 1);
  assert.equal(p(game).elites?.forces['false_wall_west:18'], 1);
  assert.equal(p(game).revived, 2);
  assert.deepEqual(inventory(game), f.original);
});

void test('original one-spice Tleilax free-revival income waits across every child and settles once after final disposition', () => {
  const f = fixture({ third: 'tleilaxu' }); let game = open(f);
  const provider = p(game, 'tleilaxu').spice;
  const returned = reload(game);
  assert.equal(game.homeworldRevivalReturn?.resumeResponse?.kind, 'revivalIncome');
  const income = game.homeworldRevivalReturn!.resumeResponse!.amount;
  assert.equal(income, 1, 'Normal free revival grants one native bank payment per faction and turn, regardless of returned group size');
  assert.equal(game.revivalFreeIncome?.fremen, game.turn);
  game = settle(act(game, 'fremen', choice(game, 'false_wall_south:5', 1)));
  assert.equal(p(game, 'tleilaxu').spice, provider);
  assert.equal(game.response ?? null, null);
  game = act(reload(game), 'fremen', choice(game, 'false_wall_west:18', 2));
  assert.equal(game.homeworldRevivalReturn?.stage, 'complete');
  assert.equal(game.response ?? null, null, 'Native normalization settles the restored income when nobody owns a cancellation choice');
  assert.equal(p(game, 'tleilaxu').spice, provider + income!);
  assert.equal(game.revivalFreeIncome?.fremen, game.turn);
  game = finish(game);
  assert.equal(p(game, 'tleilaxu').spice, provider + income!);
  unchangedUses(returned, game);
  assert.deepEqual(inventory(game), f.original);
});

void test('actual native Ecaz arrival finishes before the next fresh Southern child becomes available', () => {
  const f = fixture({ third: 'ecaz' }); let game = open(f);
  assert.ok(f.actions.some(step => step.actor === 'ecaz' && step.action.type === 'decision' && step.action.territory === 'sietch_tabr'));
  const first = choice(game, 'sietch_tabr:14', 1);
  game = act(game, 'fremen', first);
  assert.equal(game.homeworldRevivalReturn?.stage, 'arrival');
  assert.equal(game.pendingAmbassador?.stage, 'offer');
  assert.equal(game.pendingAmbassador?.entrant, 'fremen');
  assert.equal(game.pendingAmbassador?.phase, 4);
  assert.equal(viewGame(game, 'fremen').homeworldRevivalDeployment ?? null, null);
  assert.deepEqual(homeworldRevivalDeploymentActions(viewGame(game, 'fremen')), []);
  reject(game, 'fremen', { ...first, amount: 2 });
  const parent = game.pendingAmbassador!.event;
  game = act(reload(game), 'ecaz', { type: 'decision', event: parent, decline: true });
  game = settle(game);
  assert.equal(game.pendingAmbassador ?? null, null);
  assert.notEqual(offer(game).event, first.event);
  assert.equal(offer(game).elite, 2);
  assert.ok(offer(game).destinations.some(destination => destination.id === 'false_wall_west:18' && !destination.blocked));
  game = finish(act(game, 'fremen', { type: 'decision', event: offer(game).event, decline: true }));
  assert.equal(p(game).elites?.forces['sietch_tabr:14'], 1);
  assert.equal(p(game).elites?.reserves, 2);
  assert.deepEqual(inventory(game), f.original);
});

void test('all four minimal profiles consume only exact current native Southern choices', () => {
  const f = fixture();
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] satisfies Difficulty[]) {
    let game = open(f), decisions = 0;
    while (game.homeworldRevivalReturn?.stage !== 'complete' && decisions < 4) {
      const view = viewGame(reload(game), 'fremen');
      view.players.find(player => player.id === 'fremen')!.bot = difficulty;
      const offered = homeworldRevivalDeploymentActions(view); assert.ok(offered.length);
      const action = botActions(view).find(action => action.type === 'decision' && action.event === offer(game).event);
      assert.ok(action, `${difficulty} consumes its current owner-view allocation`);
      assert.ok(offered.some(legal => JSON.stringify(legal) === JSON.stringify(action)));
      game = settle(act(game, 'fremen', action)); decisions++;
    }
    game = finish(game);
    assert.ok(decisions > 0 && decisions <= 3);
    assert.equal(p(game).revived, 3); assert.equal(p(game).elites?.revived, 3);
    assert.deepEqual(inventory(game), f.original);
  }
});
