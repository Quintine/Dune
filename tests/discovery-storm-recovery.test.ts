import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { unitStore } from './fixture-nexus-room-store';
import {
  discoveryStormFixture,
  confirmDiscoveryStorm,
} from './fixture-discovery-storm';
import { discoveryStormActions } from '../game/discovery-storm-options';
import {
  createStormSource,
  discoveryStormSignature,
} from '../game/discovery-storm';
import { DiscoveryStormDecision } from '../components/discovery-storm';
import { normalizeAutomaticGame, viewGame, type Game } from '../game/engine';
import type { RoomsClock } from '../db/rooms';

const clock: RoomsClock = { now: () => 10000, sleep: async () => {} };
void test('restored SQLite station choice keeps private controls and competing submissions adjust the storm only once', async () => {
  const store = unitStore();
  try {
    const created = await store.rooms.createRoom(
      'Station recovery',
      'atreides',
      false,
      [],
    );
    const code = created.view.code,
      sessions = [created.token];
    for (const faction of ['guild', 'fremen'] as const)
      sessions.push(
        (await store.rooms.joinRoom(code, faction, faction)).token!,
      );
    const auths = await Promise.all(
      sessions.map((token) => store.rooms.authenticate(code, token)),
    );
    const ids = auths.map((auth) => auth.playerId) as [string, string, string];
    const game = confirmDiscoveryStorm(discoveryStormFixture(false, ids));
    game.code = code;
    store.sqlite
      .prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(game), game.version, code);
    const seats = store.sqlite
      .prepare('SELECT * FROM seats ORDER BY player_id')
      .all();
    for (const [i, auth] of auths.entries()) {
      const view = await store.restart().readSeatView(code, auth);
      assert.deepEqual(view, viewGame(game, auth.playerId));
      assert.equal(view.ecologicalStorm !== null, i === 0);
      assert.equal(JSON.stringify(view).includes('stormMovementSource'), false);
    }
    const action = discoveryStormActions(viewGame(game, ids[0])).find(
      (a) => a.delta === 1,
    )!;
    let arrivals = 0,
      release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    store.hooks.beforeWrite = async () => {
      if (++arrivals === 2) release();
      await gate;
    };
    const timer = setTimeout(release, 2000);
    try {
      const results = await Promise.allSettled(
        [0, 1].map(() =>
          store.restart().act(code, auths[0], game.version, action, clock),
        ),
      );
      assert.equal(arrivals, 2);
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    } finally {
      clearTimeout(timer);
      delete store.hooks.beforeWrite;
    }
    const done = await store.restart().readRoom(code);
    assert.equal(done.version, game.version + 1);
    assert.equal(done.storm, 9);
    assert.equal(done.ecologicalStorm!.stage, 'complete');
    assert.equal(
      done.log.filter((e) => e.text.includes('increased storm movement'))
        .length,
      1,
    );
    await assert.rejects(
      store.restart().act(code, auths[0], done.version, action, clock),
    );
    assert.deepEqual(await store.restart().readRoom(code), done);
    assert.deepEqual(
      store.sqlite.prepare('SELECT * FROM seats ORDER BY player_id').all(),
      seats,
    );
  } finally {
    store.sqlite.close();
  }
});
void test('station controls show all legal distances only to the owner and disable while busy or on autopilot', () => {
  const g = confirmDiscoveryStorm(discoveryStormFixture());
  const render = (id: string, busy = false) =>
    renderToStaticMarkup(
      createElement(DiscoveryStormDecision, {
        game: viewGame(g, id),
        busy,
        act() {},
      }),
    );
  const markup = render('a');
  for (const label of [
    'Decrease: 1 sector',
    'Keep: 2 sectors',
    'Increase: 3 sectors',
  ])
    assert.ok(markup.includes(label));
  assert.equal(render('g'), '');
  assert.equal((render('a', true).match(/\sdisabled=""/g) ?? []).length, 3);
  g.players[0].autopilot = 'Easy';
  assert.equal((render('a').match(/\sdisabled=""/g) ?? []).length, 3);
});
void test('source turn, source phase and exact station token are bound across restored decisions', () => {
  const source = confirmDiscoveryStorm(discoveryStormFixture());
  for (const mutate of [
    (g: Game) => {
      g.stormMovementSource = createStormSource(g.turn - 1, 'dials', 2);
    },
    (g: Game) => {
      g.phase = 1;
    },
    (g: Game) => {
      g.ecologicalStorm!.token = g.discoveries!.tokens.find(
        (t) => t.face !== 'ecological-testing-station',
      )!.id;
      g.ecologicalStorm!.signature = discoveryStormSignature(
        g.ecologicalStorm!,
      );
    },
  ]) {
    const g = structuredClone(source);
    mutate(g);
    const before = structuredClone(g);
    assert.throws(() => viewGame(g, 'a'));
    assert.throws(() => normalizeAutomaticGame(g));
    assert.deepEqual(g, before);
  }
});
