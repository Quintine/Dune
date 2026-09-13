import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import {
  sandmasterDefaultChoice,
  type SandmasterChoice,
} from '../game/sandmaster-movement';
import { splitLocation, territory } from '../game/board';
import {
  sandmasterMove,
  sandmasterMovementGame,
} from './sandmaster-movement-fixture';
import { createTechTokens } from '../game/tech-tokens';
import { placeFixtureHand } from './fixture-hand';

const restored = (g: Game): Game => JSON.parse(JSON.stringify(g));
function unchanged(
  g: Game,
  action: Action,
  error = /Sandmaster|route|collection|source|spice/i,
) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, 'p', action), error);
  assert.deepEqual(g, before);
}
function conserved(g: Game, before: Game) {
  for (const p of g.players)
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
  const sum = (game: Game) =>
    Object.values(game.spice).reduce((a, b) => a + b, 0) +
    game.players.reduce((a, p) => a + p.spice, 0);
  assert.equal(sum(g), sum(before));
}
void test('Sandmaster collects once in every selected traversed territory and preserves JSON continuation', () => {
  for (const advanced of [false, true]) {
    const g = sandmasterMovementGame('emperor', advanced),
      action = sandmasterMove(g, 3);
    const choice = action.sandmaster as SandmasterChoice;
    assert.equal(choice.collect.length, 3);
    g.spice['red_chasm:7'] = 6;
    const next = applyAction(restored(g), 'p', action);
    assert.equal(next.players[0].spice, g.players[0].spice + 3);
    assert.equal(next.spice['red_chasm:7'], 6);
    assert.equal(next.players[0].moved, 1);
    assert.equal(
      next.log.filter((l) => l.automatic?.name === 'Sandmaster collection')
        .length,
      3,
    );
    assert.deepEqual(
      viewGame(restored(next), 'p').players[0].hand,
      viewGame(next, 'p').players[0].hand,
    );
    assert.equal(
      viewGame(next, 'h').players.find((p) => p.id === 'p')!.spice,
      undefined,
    );
    conserved(next, g);
  }
});
void test('Sandmaster can decline each territory or the entire effect; legacy movement collects nothing', () => {
  const g = sandmasterMovementGame(),
    action = sandmasterMove(g);
  const choice = action.sandmaster as SandmasterChoice;
  for (const collect of [[], choice.collect.slice(0, 1)]) {
    const next = applyAction(g, 'p', {
      ...action,
      sandmaster: { ...choice, collect },
    });
    assert.equal(next.players[0].spice, g.players[0].spice + collect.length);
    conserved(next, g);
  }
  const { sandmaster: _unused, ...legacy } = action;
  assert.equal(
    applyAction(g, 'p', legacy).players[0].spice,
    g.players[0].spice,
  );
});
void test('Sandmaster rejects disconnected, overlong, storm, duplicate and ambiguous collection choices without mutation', () => {
  const g = sandmasterMovementGame(),
    action = sandmasterMove(g),
    choice = action.sandmaster as SandmasterChoice;
  const from = 'red_chasm:7',
    route = choice.routes[from];
  unchanged(g, { ...action, sandmaster: { ...choice, routes: {} } });
  unchanged(g, {
    ...action,
    sandmaster: {
      ...choice,
      routes: { [from]: [from, 'polar_sink:0', route.at(-1)] },
    },
  });
  unchanged(g, {
    ...action,
    sandmaster: { ...choice, collect: [choice.collect[0], choice.collect[0]] },
  });
  unchanged(g, {
    ...action,
    sandmaster: { ...choice, collect: ['red_chasm:7'] },
  });
  unchanged(g, { ...action, sandmaster: null });
  const blocked = restored(g);
  blocked.storm = splitLocation(route.at(-1)!).sector;
  unchanged(blocked, action, /storm|blocked|Sandmaster/i);
  const tooFar = restored(g);
  delete tooFar.players[0].forces['arrakeen:10'];
  tooFar.players[0].reserves++;
  unchanged(tooFar, action);
  const id = splitLocation(choice.collect[0]).territory;
  const second = territory(id).sectors.find(
    (s) => `${id}:${s}` !== choice.collect[0],
  );
  if (second !== undefined) {
    const ambiguous = restored(g);
    ambiguous.spice[`${id}:${second}`] = 2;
    unchanged(ambiguous, action);
    const decline = {
      ...choice,
      collect: choice.collect.filter((key) => key !== choice.collect[0]),
    };
    assert.doesNotThrow(() =>
      applyAction(ambiguous, 'p', { ...action, sandmaster: decline }),
    );
  }
});
void test('Fremen Sandmaster waits for movement permission and cancellation releases untouched spice', () => {
  const g = sandmasterMovementGame('fremen'),
    action = sandmasterMove(g);
  const karama = [...g.deck, ...g.players.flatMap((p) => p.hand)].find(
    (c) => c.effect === 'karama',
  )!;
  placeFixtureHand(g, 1, [karama]);
  const pending = applyAction(g, 'p', action);
  assert.equal(pending.response?.kind, 'fremenMovement');
  assert.equal(pending.players[0].spice, g.players[0].spice);
  assert.deepEqual(pending.spice, g.spice);
  const allowed = applyAction(restored(pending), 'h', { type: 'passResponse' });
  assert.equal(allowed.players[0].spice, g.players[0].spice + 2);
  conserved(allowed, g);
  const canceled = applyAction(restored(pending), 'h', {
    type: 'card',
    mode: 'cancel',
    card: karama.id,
  });
  assert.equal(canceled.players[0].spice, g.players[0].spice);
  assert.deepEqual(canceled.spice, g.spice);
  assert.equal(canceled.players[0].moved, 0);
  for (const mutate of [
    (saved: Game) => {
      delete saved.pendingFremenMove!.order.sandmaster;
    },
    (saved: Game) => {
      saved.response = null;
    },
    (saved: Game) => {
      saved.pendingFremenMove!.order.sandmaster!.piles[0].before++;
    },
    (saved: Game) => {
      saved.spice[(action.sandmaster as SandmasterChoice).collect[0]]++;
    },
  ]) {
    const saved = restored(pending);
    mutate(saved);
    assert.throws(() => viewGame(saved, 'p'), /Sandmaster/i);
    assert.throws(() => normalizeAutomaticGame(saved), /Sandmaster/i);
  }
});
void test('All four AI profiles can submit legal funded Sandmaster movement with only public route information', () => {
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const g = sandmasterMovementGame();
    sandmasterMove(g);
    g.players[0].autopilot = difficulty;
    const view = viewGame(g, 'p');
    const action = botActions(view).find(
      (a) => a.type === 'move' && a.sandmaster,
    );
    assert.ok(action, difficulty);
    const next = applyAction(g, 'p', action);
    assert.ok(next.players[0].spice > g.players[0].spice);
    conserved(next, g);
  }
});
void test('Dead, captive and combined-module Sandmaster cannot grant normal collection', () => {
  const g = sandmasterMovementGame(),
    action = sandmasterMove(g);
  const skill = g.leaderSkills!.assignments.find((a) => a.owner === 'p')!;
  const captive = restored(g);
  captive.players[0].leaders.find((l) => l.id === skill.leader)!.capturedBy =
    'h';
  unchanged(captive, action);
  const combined = restored(g);
  combined.techTokens = createTechTokens(combined.players);
  unchanged(combined, action);
  assert.equal(
    sandmasterDefaultChoice(viewGame(combined, 'p'), 'p', action),
    null,
  );
});

void test('Sandmaster combines source sectors without duplicate collection and sector-only repositioning earns nothing', () => {
  const g = sandmasterMovementGame();
  g.players[0].forces = {
    'pasty_mesa:6': 2,
    'pasty_mesa:7': 1,
    'arrakeen:10': 1,
  };
  g.spice = { 'red_chasm:7': 4, 'pasty_mesa:8': 5 };
  const action: Action = {
    type: 'move',
    forces: { 'pasty_mesa:6': 2, 'pasty_mesa:7': 1 },
    territory: 'red_chasm',
    sector: 7,
  };
  const choice = sandmasterDefaultChoice(viewGame(g, 'p'), 'p', action)!;
  assert.equal(Object.keys(choice.routes).length, 2);
  assert.deepEqual(choice.collect, ['red_chasm:7']);
  const next = applyAction(g, 'p', { ...action, sandmaster: choice });
  assert.equal(next.players[0].spice, g.players[0].spice + 1);
  assert.equal(next.players[0].forces['red_chasm:7'], 3);
  assert.equal(next.spice['pasty_mesa:8'], 5);
  conserved(next, g);
  const reposition: Action = {
    type: 'move',
    from: 'pasty_mesa:6',
    amount: 2,
    territory: 'pasty_mesa',
    sector: 7,
  };
  const sectorChoice = sandmasterDefaultChoice(
    viewGame(g, 'p'),
    'p',
    reposition,
  )!;
  assert.deepEqual(sectorChoice.collect, []);
  assert.equal(
    applyAction(g, 'p', { ...reposition, sandmaster: sectorChoice }).players[0]
      .spice,
    g.players[0].spice,
  );
});

void test('A separate Hajr movement can collect again and only a later re-entry qualifies its starting territory', () => {
  const g = sandmasterMovementGame();
  const hajr = g.deck.find((c) => c.effect === 'hajr')!;
  assert.ok(hajr);
  placeFixtureHand(g, 0, [hajr]);
  g.spice = { 'pasty_mesa:8': 4, 'red_chasm:7': 5 };
  const first: Action = {
    type: 'move',
    from: 'red_chasm:7',
    amount: 3,
    territory: 'pasty_mesa',
    sector: 6,
  };
  let next = applyAction(g, 'p', {
    ...first,
    sandmaster: sandmasterDefaultChoice(viewGame(g, 'p'), 'p', first),
  });
  assert.equal(next.spice['pasty_mesa:8'], 3);
  next = applyAction(next, 'p', { type: 'card', card: hajr.id });
  const second: Action = {
    type: 'move',
    from: 'pasty_mesa:6',
    amount: 3,
    territory: 'pasty_mesa',
    sector: 7,
    sandmaster: {
      routes: {
        'pasty_mesa:6': ['pasty_mesa:6', 'red_chasm:7', 'pasty_mesa:7'],
      },
      collect: ['pasty_mesa:8'],
    },
  };
  next = applyAction(restored(next), 'p', second);
  assert.equal(next.spice['pasty_mesa:8'], 2);
  assert.equal(next.spice['red_chasm:7'], 5);
  assert.equal(next.players[0].spice, g.players[0].spice + 2);
  assert.equal(next.players[0].moved, 2);
  conserved(next, g);
});
