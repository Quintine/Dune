import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
import {
  applyAction,
  createGame,
  newPlayer,
  joinGame,
  viewGame,
  initializeBaseGameForAudit,
  type Game,
} from '../game/engine';
import { baseDeck, createAuditorLeader, CHOAM_AUDITOR_ID } from '../game/cards';

const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
function fixture(tleilaxu = false) {
  const g = createGame('AUDITORLIFE', newPlayer('c', 'CHOAM', 'choam'), true);
  g.players.push(newPlayer('h', 'Harkonnen', 'harkonnen'));
  if (tleilaxu) g.players.push(newPlayer('t', 'Tleilaxu', 'tleilaxu'));
  Object.assign(g, {
    status: 'playing',
    phase: 4,
    turn: 2,
    order: g.players.map((p) => p.id),
    storm: 18,
    deck: baseDeck(),
  });
  player(g, 'c').leaders.push(createAuditorLeader());
  for (const p of g.players) {
    p.spice = 20;
    p.traitors = [];
  }
  const auditor = player(g, 'c').leaders.at(-1)!;
  auditor.dead = true;
  auditor.deaths = 1;
  return g;
}
function hold(g: Game, id: string, effect: string) {
  const index = g.deck.findIndex((c) => c.effect === effect);
  assert.ok(index >= 0);
  const card = g.deck.splice(index, 1)[0];
  player(g, id).hand.push(card);
  return card;
}
function allow(g: Game) {
  for (
    let n = 0;
    n < 30 && (g.response || g.decision?.kind === 'revivalStop');
    n++
  ) {
    if (g.decision?.kind === 'revivalStop')
      g = applyAction(g, g.decision.player, {
        type: 'decision',
        decline: true,
      });
    else
      g = applyAction(
        g,
        g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
        { type: 'passResponse' },
      );
  }
  assert.equal(g.response, null);
  return g;
}
const revive = (g: Game) =>
  applyAction(g, 'c', { type: 'reviveLeader', leader: CHOAM_AUDITOR_ID });

/** Expose the unmodified private initializer in an isolated test module only.
 * Both real public entry points remain gated and are explicitly tested below. */
function setupModule() {
  const source = readFileSync(
    new URL('../game/engine.ts', import.meta.url),
    'utf8',
  );
  const exports: { initializeSetup?: (g: Game) => void } = {};
  runInNewContext(
    ts.transpileModule(source + '\nexport { initializeSetup };\n', {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      require: createRequire(new URL('../game/engine.ts', import.meta.url)),
      crypto: webcrypto,
      structuredClone,
      TextEncoder,
      JSON,
    },
  );
  return exports.initializeSetup!;
}

void test('real isolated initializer adds the Advanced Auditor before prediction and traitor dealing; public gates stay closed', () => {
  const initialize = setupModule();
  for (const advanced of [false, true]) {
    let g = createGame(
      'AUDITORSETUP',
      newPlayer('c', 'CHOAM', 'choam'),
      advanced,
    );
    joinGame(g, newPlayer('b', 'Bene Gesserit', 'beneGesserit'));
    for (const id of ['c', 'b']) g = applyAction(g, id, { type: 'ready' });
    const before = structuredClone(g);
    assert.throws(
      () => applyAction(g, 'c', { type: 'start' }),
      /still being implemented/,
    );
    assert.throws(() => initializeBaseGameForAudit(g), /base factions/);
    assert.deepEqual(g, before);
    initialize(g);
    assert.equal(g.setupStage, 'prediction');
    assert.equal(
      player(g, 'c').leaders.filter((l) => l.id === CHOAM_AUDITOR_ID).length,
      advanced ? 1 : 0,
    );
    assert.equal(player(g, 'c').leaders.length, advanced ? 6 : 5);
    for (const p of g.players) {
      assert.deepEqual(p.hand, []);
      assert.deepEqual(p.traitorChoices, []);
      assert.deepEqual(p.traitors, []);
      assert.equal(p.spice, 0);
      assert.deepEqual(p.forces, {});
    }
    g = applyAction(g, 'b', { type: 'predict', faction: 'choam', turn: 4 });
    const pool = [
      ...(g.traitorReserve ?? []),
      ...g.players.flatMap((p) => [...p.traitors, ...p.traitorChoices]),
    ];
    assert.equal(
      pool.filter((id) => id === CHOAM_AUDITOR_ID).length,
      advanced ? 1 : 0,
    );
    assert.equal(new Set(pool).size, advanced ? 11 : 10);
    for (const id of ['c', 'b']) {
      const p = player(g, id);
      g = applyAction(g, id, { type: 'traitor', leader: p.traitorChoices[0] });
    }
    if (advanced)
      g = applyAction(g, 'b', {
        type: 'advisorSetup',
        territory: 'polar_sink',
        sector: 0,
      });
    assert.equal(g.status, 'playing');
    assert.equal(g.phase, 0);
    assert.equal(player(g, 'c').hand.length, 1);
    assert.equal(
      viewGame(g, 'b').players.find((p) => p.id === 'c')!.hand,
      undefined,
    );
  }
});

void test('first Auditor revival works while five native leaders are alive and consumes the single native allowance', () => {
  const start = fixture();
  assert.equal(player(start, 'c').revivalCycle, 0);
  assert.ok(
    viewGame(start, 'c').revival.leaders.some(
      (l) => l.id === CHOAM_AUDITOR_ID && l.cost === 2 && !l.early,
    ),
  );
  const g = allow(revive(JSON.parse(JSON.stringify(start))));
  assert.equal(player(g, 'c').leaders.at(-1)!.dead, false);
  assert.equal(player(g, 'c').leaders.at(-1)!.deaths, 1);
  assert.equal(player(g, 'c').spice, 18);
  assert.equal(player(g, 'c').leaderRevived, true);
  player(g, 'c').leaders[0].dead = true;
  player(g, 'c').leaders[0].deaths = 1;
  player(g, 'c').revivalCycle = 1;
  const before = structuredClone(g);
  assert.throws(
    () => applyAction(g, 'c', { type: 'reviveLeader', leader: 'choam-0' }),
    /one leader/,
  );
  assert.deepEqual(g, before);
  const occupied = fixture();
  player(occupied, 'c').leaderRevived = true;
  assert.throws(() => revive(occupied), /one leader/);
});

void test('first Auditor revival uses the existing allied discount and pays the actual Tleilaxu revival income', () => {
  let g = fixture(true);
  player(g, 'c').ally = 't';
  player(g, 't').ally = 'c';
  g = applyAction(g, 't', { type: 'tleilaxuAllyDiscount' });
  assert.equal(
    viewGame(g, 'c').revival.leaders.find((l) => l.id === CHOAM_AUDITOR_ID)!
      .cost,
    1,
  );
  g = allow(revive(g));
  assert.equal(player(g, 'c').spice, 19);
  assert.equal(player(g, 't').spice, 21);
  assert.equal(player(g, 'c').leaderRevived, true);
});

void test('Tleilaxu prevention cancels the first Auditor return without consuming payment or revival allowance', () => {
  const start = fixture(true);
  const karama = hold(start, 't', 'karama');
  let g = revive(start);
  assert.equal(g.decision?.kind, 'revivalStop');
  g = applyAction(g, 't', { type: 'card', card: karama.id, mode: 'special' });
  assert.equal(player(g, 'c').leaders.at(-1)!.dead, true);
  assert.equal(player(g, 'c').spice, 20);
  assert.equal(player(g, 'c').leaderRevived, false);
  assert.ok(viewGame(g, 'c').revival.prevented);
  assert.throws(() => revive(g), /prevented/);
});

void test('native Ghola card can restore the Auditor independently of the ordinary leader allowance', () => {
  const start = fixture();
  const ghola = hold(start, 'c', 'ghola');
  player(start, 'c').leaderRevived = true;
  const g = allow(
    applyAction(start, 'c', {
      type: 'card',
      card: ghola.id,
      leader: CHOAM_AUDITOR_ID,
    }),
  );
  assert.equal(player(g, 'c').leaders.at(-1)!.dead, false);
  assert.equal(player(g, 'c').leaders.at(-1)!.deaths, 1);
  assert.equal(player(g, 'c').spice, 20);
  assert.equal(player(g, 'c').leaderRevived, true);
  assert.equal(g.discard.filter((c) => c.id === ghola.id).length, 1);
});

void test('foreign ghola rejects the canonical Auditor even when a Tleilaxu seat has room', () => {
  const g = fixture(true);
  player(g, 't').leaders[0].dead = true;
  player(g, 't').leaders[0].deaths = 1;
  const before = structuredClone(g);
  assert.throws(
    () =>
      applyAction(g, 't', {
        type: 'reviveForeignGhola',
        leader: CHOAM_AUDITOR_ID,
      }),
    /Auditor/,
  );
  assert.deepEqual(g, before);
});

void test('actual Harkonnen capture excludes the living canonical Auditor and still draws an eligible ordinary disc', () => {
  for (const ordinaryAvailable of [false, true]) {
    let g = fixture();
    g.phase = 6;
    g.active = 'h';
    g.order = ['h', 'c'];
    for (const p of g.players) {
      p.forces = { 'arrakeen:10': 3 };
      p.reserves = 17;
    }
    const choam = player(g, 'c');
    for (const leader of choam.leaders) {
      leader.dead = leader.id !== CHOAM_AUDITOR_ID;
      leader.deaths = leader.dead ? 1 : 0;
    }
    if (ordinaryAvailable) {
      choam.leaders[0].dead = false;
      // Display names cannot turn an ordinary physical disc into the Auditor.
      choam.leaders[0].name = 'Auditor';
    }
    g = applyAction(g, 'h', {
      type: 'chooseBattle',
      territory: 'arrakeen',
      target: 'c',
    });
    for (let n = 0; n < 30; n++) {
      g = allow(g);
      if (g.battle?.preLeader && !g.battle.preLeader.closed) {
        const id = ['h', 'c'].find(
          (id) => !g.battle!.preLeader!.ready.includes(id),
        )!;
        g = applyAction(g, id, {
          type: 'battlePreparationReady',
          event: g.battle.event,
        });
      } else if (g.battle?.preparation)
        g = applyAction(g, g.battle.preparation.owner, {
          type: 'declineBattlePower',
        });
      else break;
    }
    g = applyAction(g, 'h', {
      type: 'battlePlan',
      leader: 'harkonnen-0',
      dial: 0,
      support: 0,
    });
    g = applyAction(g, 'c', {
      type: 'battlePlan',
      leader: CHOAM_AUDITOR_ID,
      dial: 0,
      support: 0,
    });
    g = applyAction(g, 'h', { type: 'traitorCall', call: false });
    g = applyAction(g, 'c', { type: 'traitorCall', call: false });
    if (ordinaryAvailable) {
      assert.equal(g.decision?.kind, 'captureOffer');
      g = allow(
        applyAction(JSON.parse(JSON.stringify(g)), 'h', {
          type: 'decision',
          accept: true,
        }),
      );
      assert.equal(g.decision?.kind, 'capturedLeader');
      assert.equal(
        g.decision?.kind === 'capturedLeader' && g.decision.leader,
        'choam-0',
      );
      g = applyAction(g, 'h', { type: 'decision', mode: 'keep' });
      assert.equal(player(g, 'c').leaders[0].capturedBy, 'h');
    } else {
      assert.notEqual(g.decision?.kind, 'captureOffer');
      assert.equal(g.pendingCapture, null);
    }
    const auditor = player(g, 'c').leaders.find(
      (l) => l.id === CHOAM_AUDITOR_ID,
    )!;
    assert.equal(auditor.dead, false);
    assert.equal(auditor.capturedBy, undefined);
  }
});

void test('canceling an allied Auditor discount restores the ordinary two-spice price before committing the return', () => {
  let g = fixture(true);
  player(g, 'c').ally = 't';
  player(g, 't').ally = 'c';
  const karama = hold(g, 'h', 'karama');
  g = applyAction(g, 't', { type: 'tleilaxuAllyDiscount' });
  g = revive(g);
  assert.equal(g.decision?.kind, 'revivalStop');
  g = applyAction(g, 't', { type: 'decision', decline: true });
  assert.equal(g.response?.kind, 'revivalDiscount');
  assert.equal(player(g, 'c').spice, 20);
  assert.equal(player(g, 'c').leaders.at(-1)!.dead, true);
  g = allow(
    applyAction(JSON.parse(JSON.stringify(g)), 'h', {
      type: 'card',
      card: karama.id,
      mode: 'cancel',
    }),
  );
  assert.equal(player(g, 'c').spice, 18);
  assert.equal(player(g, 't').spice, 22);
  assert.equal(player(g, 'c').leaders.at(-1)!.dead, false);
  assert.equal(player(g, 'c').leaderRevived, true);
  assert.equal(g.discard.filter((c) => c.id === karama.id).length, 1);
});
