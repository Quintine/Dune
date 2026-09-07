import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
  type GameView,
} from '../game/engine';
import { richeseCards } from '../game/richese-cards';
import { botActions } from '../game/bots';
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';
import type { FactionId } from '../game/catalog';
import { gameDistance, splitLocation } from '../game/board';
import { validateCohortSelection } from '../game/ornithopter';
import {
  createRicheseNoField,
  deployRicheseNoField,
} from '../game/richese-no-field';

const cardId = 'richese-ornithopter',
  source = 'red_chasm:7';
function fixture(faction: FactionId = 'emperor', amount = 1) {
  const g = createGame('ORNIBOT', newPlayer('p', 'Pilot', faction), true);
  g.players.push(
    newPlayer('o', 'Observer', faction === 'atreides' ? 'emperor' : 'atreides'),
  );
  g.status = 'playing';
  g.phase = 5;
  g.turn = 2;
  g.active = 'p';
  g.order = ['p', 'o'];
  g.movementRemaining = [...g.order];
  g.storm = 18;
  for (const p of g.players) {
    p.hand = [];
    p.forces = {};
    p.spice = 10;
  }
  g.players[0].hand = [richeseCards().find((c) => c.effect === 'ornithopter')!];
  g.players[0].forces = { [source]: amount };
  g.players[0].reserves = 20 - amount;
  g.players[0].shipped = true;
  return g;
}
function projection(g: Game, difficulty: Difficulty) {
  const v = viewGame(g, 'p');
  v.players[0].bot = difficulty;
  return v;
}
const cardMoves = (v: GameView) =>
  botActions(v).filter(
    (a) => a.type === 'move' && (a.movementCard || a.ornithopterEvent),
  );
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));

void test('every profile actually uses card range beyond normal access without a stronghold and discards once', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture(),
      v = projection(g, difficulty),
      before = structuredClone(v);
    const action = botActions(v)[0];
    assert.equal(action.movementCard, cardId);
    assert.equal(action.ornithopter, 'range3');
    const destination = `${action.territory as string}:${action.sector as number}`;
    const distance = gameDistance(
      g,
      source,
      destination,
      (k) => splitLocation(k).sector === g.storm,
    );
    assert.ok(distance > 1 && distance <= 3);
    assert.deepEqual(v, before);
    const done = applyAction(g, 'p', action);
    assert.equal(done.players[0].forces[destination], 1);
    assert.equal(done.players[0].moved, 1);
    assert.equal(done.players[0].spice, 10);
    assert.equal(done.players[0].reserves, 19);
    assert.equal(done.discard.filter((c) => c.id === cardId).length, 1);
    assert.equal(done.ornithopter, null);
    assert.equal(cardMoves(projection(reload(done), difficulty)).length, 0);
    assert.throws(() => applyAction(done, 'p', action));
  }
});

void test('all profiles can split one origin into two different typed groups and finish with the exact restored event', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture('emperor', 5);
    g.players[0].elites = {
      forces: { [source]: 3 },
      reserves: 2,
      tanks: 0,
      revived: 0,
    };
    const first = cardMoves(projection(g, difficulty)).find(
      (a) => a.ornithopter === 'twoGroups',
    );
    assert.ok(first, difficulty);
    assert.ok(Number(first.amount) < 5);
    const moved = applyAction(g, 'p', first),
      v = projection(reload(moved), difficulty);
    assert.equal(moved.ornithopter!.completed, 1);
    assert.equal(moved.discard.length, 0);
    const candidates = cardMoves(v);
    assert.ok(candidates.length);
    const cohort = v.ornithopter!.active!.cohort!;
    for (const action of candidates) {
      assert.equal(action.ornithopterEvent, moved.ornithopter!.event);
      assert.equal(action.movementCard, undefined);
      const from = String(action.from);
      validateCohortSelection(
        cohort,
        v.players[0].forces,
        v.players[0].elites!.forces,
        { [from]: Number(action.amount) },
        { [from]: Number(action.elite) },
      );
      assert.notEqual(
        from,
        `${first.territory as string}:${first.sector as number}`,
      );
    }
    const done = applyAction(moved, 'p', candidates[0]);
    assert.equal(done.players[0].moved, 2);
    assert.equal(done.ornithopter, null);
    assert.equal(
      Object.values(done.players[0].forces).reduce((a, b) => a + b, 0),
      5,
    );
    assert.equal(
      Object.values(done.players[0].elites!.forces).reduce((a, b) => a + b, 0),
      3,
    );
    assert.equal(done.discard.filter((c) => c.id === cardId).length, 1);
  }
});

void test('merged first-group arrivals never expand the original normal or elite quota offered to the second group', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture('emperor', 5);
    const first = cardMoves(projection(g, difficulty)).find(
      (a) => a.ornithopter === 'twoGroups',
    )!;
    const destination = `${first.territory as string}:${first.sector as number}`;
    g.players[0].forces[destination] = 2;
    g.players[0].reserves -= 2;
    const moved = applyAction(g, 'p', first),
      v = projection(moved, difficulty);
    const cohort = v.ornithopter!.active!.cohort!;
    assert.equal(cohort.forces[destination], 2);
    for (const action of cardMoves(v)) {
      const from = String(action.from);
      assert.ok(Number(action.amount) <= (cohort.forces[from] ?? 0));
      assert.doesNotThrow(() => applyAction(moved, 'p', action));
    }
  }
});

void test('concealed marker moves use separate exact events, never hidden value, and cannot be moved by both card groups', () => {
  for (const difficulty of DIFFICULTIES) {
    let firstShape: unknown;
    for (const value of [0, 3, 5] as const) {
      const g = fixture('richese', 2),
        p = g.players[0];
      p.noField = createRicheseNoField(['zero', 'three', 'five']);
      const selected = p.noField.tokens.find((t) => t.value === value)!;
      p.noField = deployRicheseNoField(p.noField, {
        tokenId: selected.id,
        controller: 'p',
        location: { territory: 'red_chasm', sector: 7 },
      });
      p.noFieldEvent = 'marker-event';
      const action = cardMoves(projection(g, difficulty)).find(
        (a) => a.noField && a.ornithopter === 'twoGroups',
      );
      assert.ok(action);
      assert.equal(action.event, 'marker-event');
      assert.equal(action.ornithopterEvent, undefined);
      assert.deepEqual(action.forces, {});
      const shape = { ...action, noField: 'opaque' };
      if (firstShape) assert.deepEqual(shape, firstShape);
      else firstShape = shape;
      const moved = applyAction(g, 'p', action);
      assert.equal(moved.ornithopter!.cohort!.noField, undefined);
      const next = cardMoves(projection(reload(moved), difficulty));
      assert.ok(next.length);
      assert.ok(
        next.every(
          (a) =>
            a.noField === undefined &&
            a.ornithopterEvent === moved.ornithopter!.event,
        ),
      );
      const done = applyAction(moved, 'p', next[0]);
      assert.equal(done.players[0].reserves, 18);
      assert.ok(done.players[0].noField!.deployed);
    }
  }
});

void test('all profiles honor mode/ownership guards, existing interaction priority and finite no-group closure', () => {
  for (const difficulty of DIFFICULTIES) {
    for (const change of [
      (g: Game) => {
        g.players[0].moved = 1;
      },
      (g: Game) => {
        g.hajr = ['p'];
      },
      (g: Game) => {
        g.active = 'o';
      },
      (g: Game) => {
        g.players[0].hand = [];
      },
    ]) {
      const g = fixture();
      change(g);
      assert.equal(cardMoves(projection(g, difficulty)).length, 0);
    }
    const v = projection(fixture(), difficulty);
    v.ornithopter!.blocked = 'Card committed.';
    assert.equal(cardMoves(v).length, 0);
    const truth = projection(fixture(), difficulty);
    truth.truthtrance = {
      stage: 'priority',
      queue: [],
      passed: [],
    } as unknown as NonNullable<GameView['truthtrance']>;
    assert.equal(botActions(truth)[0].type, 'truthPass');
    const response = projection(fixture(), difficulty);
    response.response = { kind: 'emperorIncome', owner: 'o', passed: [] };
    assert.equal(cardMoves(response).length, 0);
    const g = fixture('emperor', 2),
      first = cardMoves(projection(g, difficulty)).find(
        (a) => a.ornithopter === 'twoGroups',
      )!;
    const moved = applyAction(g, 'p', first),
      blocked = projection(moved, difficulty);
    blocked.ornithopter!.active!.cohort = { forces: {}, elites: {} };
    assert.equal(botActions(blocked)[0].type, 'endMovement');
    const ended = applyAction(moved, 'p', botActions(blocked)[0]);
    assert.equal(ended.ornithopter, null);
    assert.equal(ended.discard.filter((c) => c.id === cardId).length, 1);
  }
});

void test('Fremen and Ixian normal two-group ranges remain distinct from fixed card range without an Ix speed response', () => {
  for (const difficulty of DIFFICULTIES)
    for (const faction of ['fremen', 'ixians'] as const) {
      const g = fixture(faction, 5);
      if (faction === 'ixians')
        g.players[0].elites = {
          forces: { [source]: 3 },
          reserves: 4,
          tanks: 0,
          revived: 0,
        };
      const first = cardMoves(projection(g, difficulty)).find(
        (a) => a.ornithopter === 'twoGroups',
      );
      assert.ok(first);
      const distance = gameDistance(
        g,
        source,
        `${first.territory as string}:${first.sector as number}`,
        (key) => splitLocation(key).sector === g.storm,
      );
      assert.ok(
        distance <= (faction === 'fremen' || Number(first.elite) > 0 ? 2 : 1),
      );
      const moved = applyAction(g, 'p', first);
      assert.equal(moved.players[0].moved, 1);
      const continued = cardMoves(projection(moved, difficulty));
      assert.ok(continued.length);
      assert.doesNotThrow(() => applyAction(moved, 'p', continued[0]));
      if (faction === 'ixians') {
        const fixed = fixture('ixians', 1);
        fixed.players[0].elites = {
          forces: { [source]: 1 },
          reserves: 6,
          tanks: 0,
          revived: 0,
        };
        const action = cardMoves(projection(fixed, difficulty))[0];
        assert.equal(action.ornithopter, 'range3');
        assert.equal(
          gameDistance(
            fixed,
            source,
            `${action.territory as string}:${action.sector as number}`,
            (key) => splitLocation(key).sector === fixed.storm,
          ),
          3,
        );
        const done = applyAction(fixed, 'p', action);
        assert.equal(done.pendingIxMove, undefined);
        assert.equal(done.response, null);
        assert.equal(done.players[0].moved, 1);
      }
    }
});
