import { observeHomeworldOccupation } from '../game/homeworld-occupation-history';
import { homeworldContext } from '../game/homeworld-game';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeBaseGameForAudit,
  initializeHomeworldGameForAudit,
  joinGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import type { Casualties } from '../game/combat';

const sum = (counts: Record<string, number>) =>
  Object.values(counts).reduce((a, b) => a + b, 0);
const player = (g: Game, id = 'p') => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));

/** Real Basic setup first; only the later phase, board and Tanks position is staged. */
function setup(faction: 'emperor' | 'fremen', homeworlds = true) {
  let g = createGame(
    'BASICHOMECOUNTERS',
    newPlayer('p', faction, faction),
    false,
  );
  joinGame(g, newPlayer('q', 'Guild opponent', 'guild'));
  if (homeworlds)
    g = applyAction(g, 'p', { type: 'homeworlds', enabled: true });
  for (const id of ['p', 'q']) g = applyAction(g, id, { type: 'ready' });
  g = homeworlds
    ? initializeHomeworldGameForAudit(g)
    : initializeBaseGameForAudit(g);
  for (let step = 0; g.status === 'setup' && step < 20; step++) {
    let progressed = false;
    for (const p of g.players) {
      const view = viewGame(g, p.id);
      view.players.find((v) => v.id === p.id)!.bot = 'Easy';
      const action = botActions(view)[0];
      if (!action) continue;
      g = applyAction(g, p.id, action);
      progressed = true;
      break;
    }
    assert.ok(progressed);
  }
  assert.equal(g.status, 'playing');
  // Return initial Arrakis counters and cards to their actual source piles.
  for (const p of g.players) {
    p.reserves += sum(p.forces);
    p.forces = {};
    if (p.elites) {
      p.elites.reserves += sum(p.elites.forces);
      p.elites.forces = {};
    }
    g.deck.push(...p.hand);
    p.hand = [];
  }
  Object.assign(g, {
    turn: 2,
    phase: 4,
    storm: 18,
    active: null,
    order: ['p', 'q'],
    ready: [],
  });
  return g;
}
/** Record the explicit conserved fixture position before checking read/reload purity. */
function recordPosition(g: Game) {
  if (g.homeworldOccupationHistory)
    g.homeworldOccupationHistory = observeHomeworldOccupation(g.homeworldOccupationHistory,
      homeworldContext(g), g.homeworlds!.custody!, g.turn, 'change',
      `fixture-position-${g.homeworldOccupationHistory.sources.length}`);
}
function inventory(g: Game) {
  for (const p of g.players) {
    assert.equal(p.reserves + p.tanks + sum(p.forces), 20);
    if (p.elites) {
      assert.equal(
        p.elites.reserves + p.elites.tanks + sum(p.elites.forces),
        p.faction === 'emperor' ? 5 : 3,
      );
      assert.ok(p.elites.reserves <= p.reserves && p.elites.tanks <= p.tanks);
      for (const [key, n] of Object.entries(p.elites.forces))
        assert.ok(n <= p.forces[key]);
    }
  }
  const physical = [
    ...g.deck,
    ...g.discard,
    ...g.players.flatMap((p) => p.hand),
  ];
  assert.equal(new Set(physical.map((c) => c.id)).size, physical.length);
  assert.doesNotThrow(() => viewGame(g, 'p'));
  assert.deepEqual(reload(normalizeAutomaticGame(reload(g))), reload(g));
}
function reject(g: Game, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, 'p', action));
  assert.deepEqual(g, before);
}
function battle(faction: 'emperor' | 'fremen', homeworlds = true) {
  let g = setup(faction, homeworlds);
  Object.assign(g, { phase: 6, active: 'p' });
  Object.assign(player(g), { reserves: 17, forces: { 'arrakeen:10': 3 } });
  if (player(g).elites) {
    player(g).elites!.reserves--;
    player(g).elites!.forces['arrakeen:10'] = 1;
  }
  Object.assign(player(g, 'q'), { reserves: 19, forces: { 'arrakeen:10': 1 } });
  recordPosition(g);
  inventory(g);
  g = applyAction(g, 'p', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'q',
  });
  assert.equal(
    g.response,
    null,
    'Basic physical tracking must not create Advanced power responses.',
  );
  assert.equal(g.battle!.preparation ?? null, null);
  return g;
}
function resolve(g: Game, ownLeader?: string, rivalLeader?: string) {
  const own =
    ownLeader ??
    player(g)
      .leaders.slice()
      .sort((a, b) => b.strength - a.strength)[0].id;
  const rival =
    rivalLeader ??
    player(g, 'q')
      .leaders.slice()
      .sort((a, b) => a.strength - b.strength)[0].id;
  g = applyAction(g, 'p', {
    type: 'battlePlan',
    leader: own,
    dial: 1,
    support: 0,
  });
  g = applyAction(g, 'q', {
    type: 'battlePlan',
    leader: rival,
    dial: 0,
    support: 0,
  });
  g = applyAction(g, 'p', { type: 'traitorCall', call: false });
  return applyAction(g, 'q', { type: 'traitorCall', call: false });
}
function tanks(faction: 'emperor' | 'fremen', homeworlds = true) {
  const g = setup(faction, homeworlds);
  const p = player(g);
  p.reserves -= 3;
  p.tanks = 3;
  if (p.elites) {
    p.elites.reserves -= 3;
    p.elites.tanks = 3;
  }
  recordPosition(g);
  inventory(g);
  return g;
}
function holdGhola(g: Game) {
  const index = g.deck.findIndex((card) => card.effect === 'ghola');
  assert.ok(index >= 0);
  const [card] = g.deck.splice(index, 1);
  player(g).hand.push(card);
  return card.id;
}

void test('Basic Homeworld Fedaykin and Sardaukar expose strength one and offer either physical counter as one winning casualty', () => {
  for (const faction of ['emperor', 'fremen'] as const) {
    const before = battle(faction);
    const forces = viewGame(before, 'p').battle!.ownForces!;
    assert.equal(forces.normal, 2);
    assert.equal(forces.elite, 1);
    assert.equal(forces.eliteStrength, 1);
    assert.equal(forces.freeSupport, true);
    reject(before, {
      type: 'battlePlan',
      leader: player(before).leaders[0].id,
      dial: 4,
      support: 0,
    });
    const g = resolve(before);
    assert.equal(g.decision?.kind, 'battleLosses');
    if (g.decision?.kind !== 'battleLosses')
      throw Error('Missing typed casualty decision.');
    assert.deepEqual(
      g.decision.options
        .map(({ normal, elite }) => [normal, elite])
        .sort((a, b) => a[0] - b[0]),
      [
        [0, 1],
        [1, 0],
      ],
    );
    assert.equal(player(g).tanks, 0);
    for (let choice = 0; choice < g.decision.options.length; choice++) {
      const losses: Casualties = g.decision.options[choice];
      const done = applyAction(reload(g), 'p', { type: 'decision', choice });
      assert.equal(player(done).tanks, 1);
      assert.equal(player(done).elites!.tanks, losses.elite);
      assert.equal(sum(player(done).forces), 2);
      assert.equal(
        player(done).spice,
        player(before).spice,
        'Basic forces consume no spice support.',
      );
      inventory(done);
    }
    for (const difficulty of DIFFICULTIES) {
      const view = viewGame(g, 'p');
      view.players.find((p) => p.id === 'p')!.bot = difficulty;
      const candidates = botActions(view);
      assert.ok(candidates.some((a) => a.type === 'decision'));
      for (const action of candidates)
        assert.doesNotThrow(() => applyAction(g, 'p', action));
    }
  }
});

void test('Basic Fremen cannot turn a one-strength dial into a tied win through physical star metadata', () => {
  const g = battle('fremen');
  const own = player(g).leaders.find((l) => l.strength === 3)!;
  const rival = player(g, 'q').leaders.find((l) => l.strength === 5)!;
  const done = resolve(g, own.id, rival.id);
  assert.equal(done.lastBattleContext!.winner, 'q');
  assert.equal(player(done).tanks, 3);
  assert.equal(player(done).elites!.tanks, 1);
  inventory(done);
});

void test('Basic Homeworld normal revival permits a second and third special counter after a genuine first revival', () => {
  for (const faction of ['emperor', 'fremen'] as const) {
    let g = tanks(faction);
    const initialSpice = player(g).spice;
    g = applyAction(g, 'p', { type: 'revive', amount: 1, elite: 1 });
    assert.equal(player(g).elites!.revived, 1);
    assert.equal(viewGame(g, 'p').revival.eliteRemaining, 2);
    assert.equal(viewGame(g, 'p').revival.forcesRemaining, 2);
    g = applyAction(reload(g), 'p', { type: 'revive', amount: 2, elite: 2 });
    assert.equal(player(g).tanks, 0);
    assert.equal(player(g).elites!.tanks, 0);
    assert.equal(player(g).elites!.revived, 3);
    assert.equal(player(g).revived, 3);
    assert.equal(
      player(g).spice,
      initialSpice - (faction === 'emperor' ? 4 : 0),
    );
    assert.equal(viewGame(g, 'p').revival.eliteRemaining, 0);
    inventory(g);
  }
});

void test('Basic Homeworld Ghola preserves two further star identities after normal revival without spending another normal allowance', () => {
  for (const faction of ['emperor', 'fremen'] as const) {
    let g = tanks(faction);
    const card = holdGhola(g);
    g = applyAction(g, 'p', { type: 'revive', amount: 1, elite: 1 });
    const view = viewGame(g, 'p');
    assert.equal(view.ghola.available, true);
    assert.equal(view.ghola.maxForces, 2);
    assert.equal(view.ghola.eliteRemaining, 2);
    const before = structuredClone(player(g));
    g = applyAction(reload(g), 'p', {
      type: 'card',
      card,
      amount: 2,
      elite: 2,
    });
    assert.equal(player(g).tanks, 0);
    assert.equal(player(g).elites!.tanks, 0);
    assert.equal(player(g).elites!.revived, 3);
    assert.equal(player(g).revived, before.revived);
    assert.equal(player(g).freeForcesRevived, before.freeForcesRevived);
    assert.equal(player(g).spice, before.spice);
    assert.equal(g.discard.filter((c) => c.id === card).length, 1);
    assert.equal(
      player(g).hand.some((c) => c.id === card),
      false,
    );
    inventory(g);
  }
});

void test('Basic Homeworld default elite allocation retains a wholly special Tanks group and rejects excess typed quantities atomically', () => {
  let g = tanks('fremen');
  reject(g, { type: 'revive', amount: 2, elite: 0 });
  reject(g, { type: 'revive', amount: 2, elite: 3 });
  g = applyAction(g, 'p', { type: 'revive', amount: 2 });
  assert.equal(player(g).elites!.tanks, 1);
  assert.equal(player(g).elites!.reserves, 2);
  inventory(g);
});

void test('ordinary Basic without Homeworlds keeps automatic untyped winner losses and ordinary revival/Ghola accounting', () => {
  for (const faction of ['emperor', 'fremen'] as const) {
    const done = resolve(battle(faction, false));
    assert.notEqual(done.decision?.kind, 'battleLosses');
    assert.equal(player(done).tanks, 1);
    assert.equal(player(done).elites, undefined);
    assert.equal(viewGame(done, 'p').homeworlds, null);
    inventory(done);
    let g = tanks(faction, false);
    const card = holdGhola(g);
    g = applyAction(g, 'p', { type: 'revive', amount: 1 });
    assert.equal(viewGame(g, 'p').revival.eliteRemaining, 0);
    g = applyAction(g, 'p', { type: 'card', card, amount: 2 });
    assert.equal(player(g).reserves, 20);
    assert.equal(player(g).tanks, 0);
    assert.equal(player(g).revived, 1);
    assert.equal(player(g).elites, undefined);
    inventory(g);
  }
});
