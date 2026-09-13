import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeDiscoveryGameForAudit,
  joinGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  discoveryFixture,
  enterDiscoveryCollection,
} from './fixture-discovery';
import { isAdvisor } from '../game/advisors';
import { unitStore } from './fixture-nexus-room-store';

const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function reveal(
  g: Game,
  face: 'cistern' | 'shrine' = 'cistern',
  owner = g.players[0].id,
) {
  const token = enterDiscoveryCollection(g, face, owner);
  if (viewGame(g, owner).discoveries!.canInspect.includes(token.id))
    g = applyAction(g, owner, {
      type: 'discovery',
      token: token.id,
      reveal: false,
    });
  return applyAction(g, owner, {
    type: 'discovery',
    token: token.id,
    reveal: true,
  });
}
function nextTurn(g: Game) {
  Object.assign(g, {
    phase: 8,
    ready: [],
    decision: null,
    response: null,
    phaseOpening: null,
  });
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  return g;
}
function accept(g: Game) {
  assert.equal(g.decision?.kind, 'discoveryEntry');
  const offer = viewGame(g, g.decision!.player).discoveryEntry!;
  return {
    type: 'decision',
    accept: true,
    event: offer.event,
    groups: offer.sources,
  };
}
function custody(g: Game) {
  for (const p of g.players) {
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
    if (p.elites)
      assert.equal(
        p.elites.reserves +
          p.elites.tanks +
          Object.values(p.elites.forces).reduce((a, b) => a + b, 0),
        p.faction === 'fremen' ? 3 : 5,
      );
  }
}
function reject(g: Game, id: string, action: Action) {
  const before = reload(g);
  assert.throws(() => applyAction(g, id, action));
  assert.deepEqual(g, before);
}

void test('next-turn free entry is a real owned decision before storm; partial movement survives reload and consumes no ordinary move or spice', () => {
  let g = nextTurn(reveal(discoveryFixture()));
  assert.equal(g.turn, 2);
  assert.equal(g.phase, 0);
  assert.equal(g.decision?.kind, 'discoveryEntry');
  assert.equal(g.decision?.player, 'a');
  const before = reload(g),
    offer = viewGame(g, 'a').discoveryEntry!;
  assert.equal(viewGame(g, 'g').discoveryEntry, null);
  const selection = {
    ...accept(g),
    groups: offer.sources.map((s) => ({ ...s, normal: 1, elite: 0 })),
  };
  offer.sources[0].normal = 20;
  assert.deepEqual(g, before);
  g = applyAction(reload(g), 'a', selection);
  assert.equal(g.players[0].forces['cistern:0'], 1);
  assert.equal(g.players[0].forces['gara_kulon:8'], 1);
  assert.equal(g.players[0].moved, before.players[0].moved);
  assert.equal(g.players[0].spice, before.players[0].spice);
  assert.equal(g.discoveryEntry, undefined);
  assert.deepEqual(g.discoveries!.newlyRevealed, []);
  assert.equal(g.phase, 0);
  assert.deepEqual(normalizeAutomaticGame(reload(g)), g);
  reject(g, 'a', selection);
  custody(g);
});
void test('decline, wrong owner, storm source and invalid typed groups cannot spend or retarget free entry', () => {
  const g = nextTurn(reveal(discoveryFixture()));
  const action = accept(g);
  reject(g, 'g', action);
  reject(g, 'a', { ...action, event: 'old-entry' });
  reject(g, 'a', {
    ...action,
    groups: [{ source: 'arrakeen:9', normal: 1, elite: 0 }],
  });
  reject(g, 'a', {
    ...action,
    groups: [{ source: 'gara_kulon:8', normal: 0, elite: 1 }],
  });
  reject(g, 'a', { type: 'storm', dial: 1 });
  const done = applyAction(reload(g), 'a', {
    type: 'decision',
    accept: false,
    event: action.event,
  });
  assert.equal(done.players[0].forces['cistern:0'], undefined);
  assert.equal(done.discoveryEntry, undefined);
  const storm = reveal(discoveryFixture());
  storm.storm = 8;
  const skipped = nextTurn(storm);
  assert.equal(skipped.discoveryEntry, undefined);
  custody(skipped);
});
void test('typed Fedaykin free entry preserves physical forces and all four AI policies select a legal decision', () => {
  let g = reveal(discoveryFixture(true), 'cistern', 'f');
  const f = g.players.find((p) => p.id === 'f')!;
  f.elites!.reserves--;
  f.elites!.forces['gara_kulon:8'] = 1;
  g = nextTurn(g);
  assert.equal(g.decision?.player, 'f');
  const action = accept(g);
  assert.equal(action.groups[0].elite, 1);
  for (const difficulty of DIFFICULTIES) {
    const v = viewGame(g, 'f');
    v.players.find((p) => p.id === 'f')!.bot = difficulty;
    const choices = botActions(v);
    assert.ok(choices.length);
    for (const choice of choices)
      assert.doesNotThrow(() => applyAction(g, 'f', choice));
  }
  g = applyAction(reload(g), 'f', action);
  assert.equal(
    g.players.find((p) => p.id === 'f')!.elites!.forces['cistern:0'],
    1,
  );
  custody(g);
});
function advisorFixture() {
  let g = createGame('ENTRYBG01', newPlayer('a', 'Atreides', 'atreides'), true);
  joinGame(g, newPlayer('b', 'Bene Gesserit', 'beneGesserit'));
  joinGame(g, newPlayer('g', 'Guild', 'guild'));
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  g.discoveryEnabled = true;
  g = initializeDiscoveryGameForAudit(g);
  for (let step = 0; step < 80 && g.status === 'setup'; step++) {
    let next: Game | undefined;
    for (const p of g.players) {
      const v = viewGame(g, p.id);
      v.players.find((s) => s.id === p.id)!.bot = 'Easy';
      const action = botActions(v)[0];
      if (action) {
        next = applyAction(g, p.id, action);
        break;
      }
    }
    assert.ok(next);
    g = next;
  }
  g = reveal(g);
  const bg = g.players.find((p) => p.id === 'b')!;
  bg.reserves--;
  bg.forces['cistern:0'] = 1;
  // Preserve one physical Karama so the real advisor response remains actionable.
  const card = g.deck.find((c) => c.effect === 'karama')!;
  g.deck = g.deck.filter((c) => c.id !== card.id);
  g.players[0].hand.push(card);
  return nextTurn(g);
}
void test('free entry persists through an owned Bene Gesserit intrusion and a canceled advisor flip before storm resumes', () => {
  let g = advisorFixture();
  g = applyAction(g, 'a', accept(g));
  assert.equal(g.discoveryEntry?.stage, 'arrival');
  assert.equal(g.decision?.kind, 'intrusion');
  const corrupt = reload(g);
  assert.equal(corrupt.decision?.kind, 'intrusion');
  if (corrupt.decision?.kind === 'intrusion')
    corrupt.decision.territory = 'arrakeen';
  assert.throws(() => viewGame(corrupt, 'b'));
  g = applyAction(reload(g), 'b', { type: 'decision', accept: true });
  assert.equal(g.response?.advisorResume, 'discoveryEntry');
  const orphan = reload(g);
  delete orphan.discoveryEntry;
  assert.throws(() => viewGame(orphan, 'a'));
  const card = g.players[0].hand.find((c) => c.effect === 'karama')!;
  g = applyAction(reload(g), 'a', {
    type: 'card',
    card: card.id,
    mode: 'cancel',
  });
  assert.equal(g.discoveryEntry, undefined);
  assert.equal(g.response, null);
  assert.equal(
    isAdvisor(
      g.players.find((p) => p.id === 'b')!,
      'cistern',
    ),
    false,
  );
  assert.equal(g.players[0].forces['cistern:0'], 2);
  custody(g);
});
void test('SQLite saved entry keeps seats and exactly one competing force transfer wins after restart', async () => {
  const store = unitStore();
  try {
    const made = await store.rooms.createRoom(
        'Entry SQL',
        'atreides',
        false,
        [],
      ),
      code = made.view.code;
    const tokens = [made.token];
    for (const faction of ['guild', 'fremen'] as const)
      tokens.push((await store.rooms.joinRoom(code, faction, faction)).token!);
    const auths = await Promise.all(
      tokens.map((token) => store.rooms.authenticate(code, token)),
    );
    const ids = auths.map((a) => a.playerId) as [string, string, string];
    const g = nextTurn(reveal(discoveryFixture(false, ids)));
    g.code = code;
    store.sqlite
      .prepare('UPDATE rooms SET state=?,version=? WHERE code=?')
      .run(JSON.stringify(g), g.version, code);
    const action = accept(g),
      clock = { now: () => 10000, sleep: async () => {} };
    const results = await Promise.allSettled(
      [0, 1].map(() =>
        store.restart().act(code, auths[0], g.version, action, clock),
      ),
    );
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const done = await store.restart().readRoom(code);
    assert.equal(done.players[0].forces['cistern:0'], 2);
    assert.equal(done.version, g.version + 1);
    for (const [i, token] of tokens.entries()) {
      const rooms = store.restart(),
        auth = await rooms.authenticate(code, token);
      assert.deepEqual(
        await rooms.readSeatView(code, auth),
        viewGame(done, ids[i]),
      );
    }
    await assert.rejects(
      store.restart().act(code, auths[0], done.version, action, clock),
    );
    custody(done);
  } finally {
    store.sqlite.close();
  }
});
