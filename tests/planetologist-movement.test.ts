import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import {
  applyAction,
  createGame,
  newPlayer,
  joinGame,
  initializeLeaderSkillsGameForAudit,
  viewGame,
  normalizeAutomaticGame,
  type Game,
  type Action,
} from '../game/engine';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import type { FactionId } from '../game/catalog';
import { botActions } from '../game/bots';
import { TERRITORIES, distance, splitLocation, location } from '../game/board';
import { baseDeck } from '../game/cards';
import { placeFixtureHand } from './fixture-hand';
import { planetologistLeader } from '../game/planetologist-movement';

const source = 'red_chasm:7';
const restore = (g: Game): Game => JSON.parse(JSON.stringify(g));
const route = (from: string, to: string) =>
  distance(from, to, (key) => splitLocation(key).sector === 18);
const sand = TERRITORIES.filter((t) => t.type === 'sand').flatMap((t) =>
  t.sectors.filter((s) => s !== 18).map((s) => location(t.id, s)),
);
function target(range: number, from = source) {
  const to = sand.find((key) => route(from, key) === range);
  assert.ok(to, `route ${range} from ${from}`);
  return to;
}
function move(range: number, mode?: 'range' | 'gather'): Action {
  const to = splitLocation(target(range));
  return {
    type: 'move',
    from: source,
    amount: 3,
    territory: to.territory,
    sector: to.sector,
    ...(mode ? { planetologist: mode } : {}),
  };
}
function fixture(faction: FactionId = 'emperor', advanced = false): Game {
  let g = createGame(
    'PLANETMOVE',
    newPlayer('p', 'Planetologist', faction),
    advanced,
  );
  joinGame(g, newPlayer('h', 'Harkonnen', 'harkonnen'));
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  const index = LEADER_SKILL_CARDS.findIndex((c) => c.id === 'planetologist');
  let cursor = LEADER_SKILL_CARDS.length - 1;
  mock.method(globalThis.crypto, 'getRandomValues', (array: Uint32Array) => {
    array[0] = cursor-- === index ? 0 : 0xffffffff;
    return array;
  });
  try {
    g = initializeLeaderSkillsGameForAudit(g);
  } finally {
    mock.restoreAll();
  }
  for (let i = 0; g.status === 'setup' && i < 60; i++) {
    let accepted = false;
    for (const p of g.players) {
      const view = viewGame(g, p.id);
      const skills = view.leaderSkills!;
      const options =
        g.setupStage === 'leaderSkills' && skills.offer
          ? [
              {
                type: 'leaderSkill',
                event: skills.offer.event,
                skill: p.id === 'p' ? 'planetologist' : skills.offer.cards[0],
                leader: skills.eligibleLeaders[0].id,
              },
            ]
          : g.setupStage === 'traitors' && p.traitorChoices.length
            ? [{ type: 'traitor', leader: p.traitorChoices[0] }]
            : g.setupStage === 'prediction' && p.faction === 'beneGesserit'
              ? [{ type: 'predict', faction: 'harkonnen', turn: 3 }]
              : g.setupStage === 'forces' &&
                  p.faction === 'fremen' &&
                  p.reserves === 20
                ? [
                    {
                      type: 'fremenSetup',
                      placements: {
                        sietch_tabr: 10,
                        false_wall_south: 0,
                        false_wall_west: 0,
                      },
                    },
                  ]
                : g.setupStage === 'forces' &&
                    p.faction === 'beneGesserit' &&
                    !p.advisorSetup
                  ? [
                      {
                        type: 'advisorSetup',
                        territory: 'arrakeen',
                        sector: 10,
                      },
                    ]
                  : botActions(view);
      for (const a of options) {
        try {
          g = applyAction(g, p.id, a);
          accepted = true;
          break;
        } catch {
          /* Other seats can be waiting. */
        }
      }
      if (accepted) break;
    }
    assert.ok(accepted, `setup ${g.setupStage}`);
  }
  assert.equal(g.status, 'playing');
  assert.ok(planetologistLeader(g, 'p'));
  Object.assign(g, {
    phase: 5,
    turn: 2,
    storm: 18,
    active: 'p',
    order: ['p', 'h'],
    movementRemaining: ['p', 'h'],
    ready: [],
    response: null,
    decision: null,
    phaseOpening: null,
  });
  for (const p of g.players) {
    g.deck.push(...p.hand);
    p.hand = [];
    p.forces = {};
    p.reserves = 20;
    p.tanks = 0;
    p.shipped = true;
    p.moved = 0;
    p.advisors = {};
    if (p.elites) p.elites = { ...p.elites, forces: {}, reserves: 3, tanks: 0 };
  }
  g.players[0].forces = { [source]: 3 };
  g.players[0].reserves = 17;
  return g;
}
function unchanged(g: Game, a: Action, error: RegExp) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, 'p', a), error);
  assert.deepEqual(g, before);
}
function custody(g: Game) {
  for (const p of g.players)
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
  const ids = [
    ...g.deck,
    ...g.discard,
    ...g.players.flatMap((p) => p.hand),
  ].map((c) => c.id);
  assert.equal(ids.length, 33);
  assert.equal(new Set(ids).size, 33);
}
function gather(g: Game, destinationKey?: string, range = 1) {
  const to =
    destinationKey ??
    sand.find(
      (dest) =>
        new Set(
          sand
            .filter(
              (key) =>
                route(key, dest) === range &&
                splitLocation(key).territory !== splitLocation(dest).territory,
            )
            .map((key) => splitLocation(key).territory),
        ).size >= 2,
    )!;
  const origins = sand.filter(
    (key) =>
      route(key, to) === range &&
      splitLocation(key).territory !== splitLocation(to).territory,
  );
  const first = origins[0];
  const second = origins.find(
    (key) => splitLocation(key).territory !== splitLocation(first).territory,
  )!;
  assert.ok(first && second);
  g.players[0].forces = { [first]: 3, [second]: 2 };
  g.players[0].reserves = 15;
  const destination = splitLocation(to);
  return {
    a: {
      type: 'move',
      planetologist: 'gather',
      forces: { [first]: 2, [second]: 1 },
      territory: destination.territory,
      sector: destination.sector,
    } as Action,
    first,
    second,
    to,
  };
}

void test('Planetologist range is explicit, capped at three, and moves physical forces once', () => {
  for (const advanced of [false, true]) {
    const g = fixture('emperor', advanced);
    unchanged(g, move(2), /more than 1/);
    unchanged(g, move(3, 'range'), /more than 2/);
    const next = applyAction(restore(g), 'p', move(2, 'range'));
    assert.equal(next.players[0].forces[target(2)], 3);
    assert.equal(next.players[0].moved, 1);
    custody(next);
    assert.deepEqual(normalizeAutomaticGame(restore(next)), next);
    const city = fixture();
    city.players[0].forces['arrakeen:10'] = 1;
    city.players[0].reserves--;
    unchanged(city, move(4, 'range'), /more than 3/);
    assert.equal(applyAction(city, 'p', move(3, 'range')).players[0].moved, 1);
  }
});

void test('two-origin movement keeps separate sources and elites, one shared arrival and one movement use', () => {
  const g = fixture('emperor', true);
  const { a, first, second, to } = gather(g);
  g.players[0].elites!.forces = { [first]: 1, [second]: 1 };
  g.players[0].elites!.reserves = 1;
  a.eliteForces = { [first]: 1, [second]: 1 };
  const next = applyAction(restore(g), 'p', a);
  assert.equal(next.players[0].forces[to], 3);
  assert.equal(next.players[0].forces[first], 1);
  assert.equal(next.players[0].forces[second], 1);
  assert.equal(next.players[0].elites!.forces[to], 2);
  assert.equal(next.players[0].elites!.reserves, 1);
  assert.equal(next.players[0].moved, 1);
  custody(next);
  assert.match(next.log.map((e) => e.text).join('\n'), / and /);
  const without = { ...a };
  delete without.planetologist;
  unchanged(g, without, /one territory/);
  unchanged(g, { ...a, planetologist: 'range' }, /one territory/);
  unchanged(g, { ...a, forces: { [first]: 2 } }, /exactly two/);
  const far = fixture();
  const selected = gather(far, undefined, 2);
  unchanged(far, selected.a, /more than 1/);
});

void test('Fremen extra range preserves a real Karama response and replacement keeps Planetologist', () => {
  for (const advanced of [false, true]) {
    const g = fixture('fremen', advanced);
    const karama = baseDeck().find((c) => c.effect === 'karama')!;
    placeFixtureHand(g, 1, [karama]);
    const ordinaryBonus = applyAction(g, 'p', move(2, 'range'));
    assert.equal(ordinaryBonus.response, null);
    assert.equal(ordinaryBonus.players[0].moved, 1);
    const pending = applyAction(g, 'p', move(3, 'range'));
    assert.equal(pending.response?.kind, 'fremenMovement');
    assert.equal(pending.players[0].moved, 0);
    assert.deepEqual(pending.pendingFremenMove?.order.planetologist, {
      leader: planetologistLeader(g, 'p'),
      mode: 'range',
    });
    const allowed = applyAction(restore(pending), 'h', {
      type: 'passResponse',
    });
    assert.equal(allowed.players[0].forces[target(3)], 3);
    assert.equal(allowed.players[0].moved, 1);
    custody(allowed);
    const canceled = applyAction(restore(pending), 'h', {
      type: 'card',
      card: karama.id,
      mode: 'cancel',
    });
    assert.deepEqual(canceled.players[0].forces, g.players[0].forces);
    assert.equal(canceled.players[0].moved, 0);
    unchanged(canceled, move(3, 'range'), /more than 2/);
    const replacement = applyAction(restore(canceled), 'p', move(2, 'range'));
    assert.equal(replacement.players[0].forces[target(2)], 3);
    assert.equal(replacement.players[0].moved, 1);
    custody(replacement);
    assert.equal(
      replacement.discard.filter((c) => c.id === karama.id).length,
      1,
    );
  }
});

void test('Fremen gather response restores both origins and rejects stale or forged skill receipts before payment', () => {
  const g = fixture('fremen', true);
  const { a, to } = gather(g, undefined, 2);
  const karama = baseDeck().find((c) => c.effect === 'karama')!;
  placeFixtureHand(g, 1, [karama]);
  const pending = applyAction(g, 'p', a);
  assert.equal(pending.response?.kind, 'fremenMovement');
  assert.equal(pending.pendingFremenMove?.order.origins?.length, 2);
  const saved = restore(pending);
  const allowed = applyAction(saved, 'h', { type: 'passResponse' });
  assert.equal(allowed.players[0].forces[to], 3);
  assert.equal(allowed.players[0].moved, 1);
  custody(allowed);
  for (const corrupt of [
    (s: Game) => {
      s.pendingFremenMove!.order.planetologist!.leader = 'harkonnen-0';
    },
    (s: Game) => {
      s.pendingFremenMove!.order.origins!.pop();
    },
    (s: Game) => {
      s.pendingFremenMove!.order.planetologist!.mode = 'range';
    },
  ]) {
    const stale = restore(pending);
    corrupt(stale);
    const before = structuredClone(stale);
    assert.throws(() =>
      applyAction(stale, 'h', {
        type: 'card',
        card: karama.id,
        mode: 'cancel',
      }),
    );
    assert.deepEqual(stale, before);
  }
});

void test('captured or dead Planetologist gives neither side a native movement benefit; invalid modes are immutable', () => {
  const g = fixture();
  const leader = g.players[0].leaders.find(
    (l) => l.id === planetologistLeader(g, 'p'),
  )!;
  unchanged(
    g,
    {
      ...move(2, 'range'),
      planetologist: { leader: leader.id, mode: 'range' },
    },
    /available Planetologist/,
  );
  unchanged(
    g,
    { ...move(2, 'range'), origins: ['red_chasm'] },
    /available Planetologist/,
  );
  leader.capturedBy = 'h';
  assert.equal(planetologistLeader(g, 'p'), null);
  assert.equal(planetologistLeader(g, 'h'), null);
  unchanged(g, move(2, 'range'), /available Planetologist/);
  delete leader.capturedBy;
  leader.dead = true;
  assert.equal(planetologistLeader(g, 'p'), null);
  unchanged(g, move(2, 'range'), /available Planetologist/);
});

void test('Bene Gesserit gather resolves determined mixed-source stances and preserves advisor locks', () => {
  for (const existingAdvisors of [false, true]) {
    const g = fixture('beneGesserit', true);
    const { a, first, second, to } = gather(g);
    const origin = splitLocation(first).territory,
      destination = splitLocation(to).territory;
    g.players[0].advisors = { [origin]: {} };
    // Keep the source advisors beside another faction so normalization cannot retire their stance.
    g.players[1].forces = { [first]: 1 };
    g.players[1].reserves = 19;
    if (existingAdvisors) {
      g.players[0].forces[to] = 1;
      g.players[0].reserves--;
      g.players[0].advisors[destination] = {};
      g.players[1].forces[to] = 1;
      g.players[1].reserves--;
    }
    const next = applyAction(restore(g), 'p', a);
    assert.equal(!!next.players[0].advisors?.[destination], existingAdvisors);
    assert.equal(next.players[0].forces[to], existingAdvisors ? 4 : 3);
    assert.equal(next.players[0].forces[first], 1);
    assert.equal(next.players[0].forces[second], 1);
    custody(next);
  }
  const mixed = fixture('beneGesserit', true);
  const { a, first, to } = gather(mixed);
  mixed.players[0].advisors = { [splitLocation(first).territory]: {} };
  mixed.players[1].forces = { [first]: 1, [to]: 1 };
  mixed.players[1].reserves = 18;
  unchanged(mixed, a, /combined flip response/);
  const uniform = fixture('beneGesserit', true);
  const draft = gather(uniform);
  uniform.players[0].advisors = {
    [splitLocation(draft.first).territory]: { lockedTurn: 2 },
    [splitLocation(draft.second).territory]: {},
  };
  uniform.players[1].forces = {
    [draft.first]: 1,
    [draft.second]: 1,
    [draft.to]: 1,
  };
  uniform.players[1].reserves = 17;
  unchanged(uniform, { ...draft.a, fighters: true }, /cannot flip/);
  const advisors = applyAction(restore(uniform), 'p', draft.a);
  assert.equal(
    advisors.players[0].advisors?.[splitLocation(draft.to).territory]
      ?.lockedTurn,
    2,
  );
  assert.equal(advisors.players[0].forces[draft.to], 3);
  custody(advisors);
});
