import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
import {
  applyAction,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { caladanReinforcementActions } from '../game/caladan-reinforcement-options';
import {
  caladanVictoryFixture,
  prepareVictoryBattle,
  commitVictoryPlans,
  finishVictoryCalls,
  positionVictoryArmy,
  positionVictoryInvader,
  holdVictoryCard,
  victoryInventory as inventory,
  victoryPlayer as p,
  victoryReload as reload,
} from './fixture-caladan-victory';

function victory(g = caladanVictoryFixture()) {
  return finishVictoryCalls(commitVictoryPlans(prepareVictoryBattle(g)));
}
function reinforce(g: Game, destination = 'hagga_basin:12'): Action {
  const offer = viewGame(g, 'a').caladanReinforcement;
  assert.ok(offer);
  assert.ok(
    offer.destinations.some(
      (target) => target.id === destination && !target.blocked,
    ),
  );
  return { type: 'decision', event: offer.event, destination, amount: 1 };
}
function reject(g: Game, actor: string, action: Action, match?: RegExp) {
  const before = structuredClone(g);
  if (match) assert.throws(() => applyAction(g, actor, action), match);
  else assert.throws(() => applyAction(g, actor, action));
  assert.deepEqual(g, before);
}
function stable(g: Game) {
  inventory(g);
  assert.deepEqual(reload(normalizeAutomaticGame(reload(g))), reload(g));
  for (const player of g.players) {
    const view = viewGame(reload(g), player.id);
    for (const other of view.players.filter(
      (other) => other.id !== player.id,
    )) {
      assert.equal(other.hand, undefined);
      assert.equal(other.spice, undefined);
    }
  }
}

void test('real Basic and Advanced victories offer one force after casualties, take Caladan six to five, and settle once', () => {
  for (const advanced of [false, true]) {
    const g = victory(caladanVictoryFixture({ advanced }));
    assert.equal(g.phase, 6);
    assert.equal(g.decision?.kind, 'caladanReinforcement');
    assert.equal(
      g.homeworldVictoryReinforcement!.event,
      g.lastBattleContext!.event,
    );
    assert.equal(g.lastBattleContext!.caladanReinforcement!.completed, false);
    assert.equal(p(g, 'a').forces['hagga_basin:12'], 2);
    assert.equal(p(g, 'a').tanks, 1);
    assert.equal(p(g, 'g').tanks, 3);
    stable(g);
    const before = structuredClone(p(g, 'a'));
    const action = reinforce(g);
    for (const amount of [0, 2])
      reject(g, 'a', { ...action, amount }, /exactly one/);
    reject(g, 'a', { ...action, destination: 'arrakeen:10' });
    reject(g, 'g', action);
    const done = applyAction(reload(g), 'a', action);
    assert.equal(p(done, 'a').reserves, 5);
    assert.equal(p(done, 'a').forces['hagga_basin:12'], 3);
    assert.equal(p(done, 'a').tanks, before.tanks);
    assert.equal(p(done, 'a').spice, before.spice);
    assert.equal(p(done, 'a').battleLosses, before.battleLosses);
    assert.equal(p(done, 'a').shipped, before.shipped);
    assert.equal(p(done, 'a').moved, before.moved);
    assert.equal(done.homeworldVictoryReinforcement!.stage, 'complete');
    assert.equal(done.lastBattleContext!.caladanReinforcement!.completed, true);
    assert.equal(done.phase, 7);
    reject(done, 'a', action);
    stable(done);
  }
});

void test('low Caladan or an eliminated winning army closes the opportunity without reviving a force', () => {
  for (const advanced of [false, true])
    for (const depleted of [false, true]) {
      const setup = caladanVictoryFixture({
        advanced,
        native: depleted ? 6 : 5,
      });
      let g = prepareVictoryBattle(setup);
      g = commitVictoryPlans(g, {
        a: {
          dial: depleted ? 3 : 1,
          support: advanced ? (depleted ? 3 : 1) : 0,
        },
      });
      g = finishVictoryCalls(g);
      assert.equal(g.lastBattleContext!.winner, 'a');
      assert.equal(g.homeworldVictoryReinforcement!.stage, 'complete');
      assert.equal(g.homeworldVictoryReinforcement!.destination, 'decline');
      assert.equal(viewGame(g, 'a').caladanReinforcement, null);
      assert.equal(p(g, 'a').reserves, depleted ? 6 : 5);
      assert.equal(p(g, 'a').tanks, depleted ? 3 : 1);
      stable(g);
    }
});

void test('an Atreides traitor victory qualifies; losing, mutual traitors and explosion never create a Caladan grant', () => {
  for (const outcome of [
    'traitorWin',
    'traitorLoss',
    'mutual',
    'loss',
    'explosion',
  ] as const) {
    let g = caladanVictoryFixture();
    const aLeader = p(g, 'a').leaders.reduce((best, leader) =>
      leader.strength > best.strength ? leader : best,
    ).id;
    const gLeader = p(g, 'g').leaders.reduce((best, leader) =>
      leader.strength < best.strength ? leader : best,
    ).id;
    // Explicit sealed-traitor outcome seam; battle actions still reveal their
    // actual matching leader IDs. Treachery and physical forces remain unique.
    if (outcome === 'traitorWin' || outcome === 'mutual')
      p(g, 'a').traitors = [gLeader];
    if (outcome === 'traitorLoss' || outcome === 'mutual')
      p(g, 'g').traitors = [aLeader];
    const weapon =
      outcome === 'explosion' ? holdVictoryCard(g, 'a', 'lasgun') : undefined;
    const defense =
      outcome === 'explosion' ? holdVictoryCard(g, 'g', 'shield') : undefined;
    g = prepareVictoryBattle(g);
    g = commitVictoryPlans(g, {
      a:
        outcome === 'loss'
          ? {
              leader: p(g, 'a').leaders.find((leader) => leader.strength === 1)!
                .id,
              dial: 0,
            }
          : { weapon },
      g: outcome === 'loss' ? { dial: 3 } : { defense },
    });
    g = finishVictoryCalls(g, {
      a: outcome === 'traitorWin' || outcome === 'mutual',
      g: outcome === 'traitorLoss' || outcome === 'mutual',
    });
    if (outcome === 'traitorWin') {
      assert.equal(g.lastBattleContext!.result, 'traitor');
      assert.equal(p(g, 'a').tanks, 0);
      assert.equal(g.decision?.kind, 'caladanReinforcement');
      const returned = structuredClone(p(g, 'a'));
      g = applyAction(g, 'a', {
        type: 'decision',
        event: g.homeworldVictoryReinforcement!.event,
        decline: true,
      });
      assert.deepEqual(p(g, 'a'), returned);
    } else {
      assert.equal(g.homeworldVictoryReinforcement ?? null, null);
      assert.equal(g.lastBattleContext!.caladanReinforcement, undefined);
      assert.notEqual(g.lastBattleContext!.winner, 'a');
    }
    stable(g);
  }
});

void test('native Caladan defense is a physical no-op while a surviving foreign Homeworld army receives one real reserve', () => {
  for (const native of [true, false]) {
    let g = caladanVictoryFixture();
    positionVictoryArmy(g, 'a', native ? 6 : 9, 0);
    positionVictoryArmy(g, 'g', native ? 17 : 3, 0);
    const destination = native ? 'homeworld:atreides' : 'homeworld:guild';
    positionVictoryInvader(g, native ? 'g' : 'a', destination, native ? 2 : 3);
    if (native) {
      g.order = ['g', 'a'];
      g.active = 'g';
    }
    g = prepareVictoryBattle(
      g,
      destination,
      native ? 'g' : 'a',
      native ? 'a' : 'g',
    );
    g = finishVictoryCalls(
      commitVictoryPlans(g, { a: { dial: native ? 0 : 1, support: 0 } }),
    );
    assert.equal(g.lastBattleContext!.winner, 'a');
    if (native) {
      assert.equal(g.homeworldVictoryReinforcement!.stage, 'complete');
      assert.equal(viewGame(g, 'a').caladanReinforcement, null);
      assert.equal(p(g, 'a').reserves, 6);
      assert.equal(p(g, 'a').tanks, 0);
    } else {
      assert.equal(g.homeworlds!.custody!.visitors[destination].a.normal, 2);
      g = applyAction(reload(g), 'a', reinforce(g, destination));
      assert.equal(g.homeworlds!.custody!.visitors[destination].a.normal, 3);
      assert.equal(p(g, 'a').reserves, 5);
      assert.equal(p(g, 'a').tanks, 1);
    }
    stable(g);
  }
});

void test('losing and mandatory winning discards and optional card cleanup all precede the reinforcement choice', () => {
  // Observe the unchanged real dispatcher just before its public wrapper drains
  // automatic discards, matching existing battle recovery observation seams.
  const observed: {
    applyActionInner?: (g: Game, id: string, action: Action) => Game;
  } = {};
  runInNewContext(
    ts.transpileModule(
      readFileSync(new URL('../game/engine.ts', import.meta.url), 'utf8') +
        '\nexport { applyActionInner };\n',
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    {
      exports: observed,
      require: createRequire(new URL('../game/engine.ts', import.meta.url)),
      crypto: webcrypto,
      structuredClone,
      TextEncoder,
      JSON,
    },
  );
  let g = caladanVictoryFixture({ advanced: true });
  const hero = holdVictoryCard(g, 'a', 'hero');
  const shield = holdVictoryCard(g, 'a', 'shield');
  const weapon = holdVictoryCard(g, 'g', 'projectile');
  g = commitVictoryPlans(prepareVictoryBattle(g), {
    a: { leader: hero, defense: shield, dial: 2, support: 2 },
    g: { weapon },
  });
  g = applyAction(g, 'a', { type: 'traitorCall', call: false });
  const before = structuredClone(g);
  const suspended = reload(
    observed.applyActionInner!(g, 'g', { type: 'traitorCall', call: false }),
  );
  assert.deepEqual(g, before);
  assert.equal(
    suspended.pendingTreacheryDiscard!.continuation.kind,
    'battleResolved',
  );
  assert.equal(suspended.homeworldVictoryReinforcement!.stage, 'waiting');
  assert.equal(viewGame(suspended, 'a').caladanReinforcement, null);
  assert.deepEqual(suspended.pendingWinnerDiscards!.cards, [hero]);
  assert.equal(p(suspended, 'a').tanks, 0);
  const firstSequence = suspended.treacheryDiscardSequence!;
  g = normalizeAutomaticGame(suspended);
  assert.equal(g.decision?.kind, 'battleCards');
  assert.equal(g.homeworldVictoryReinforcement!.stage, 'waiting');
  assert.equal(p(g, 'a').tanks, 2);
  assert.equal(
    g.discard.filter((card) => card.id === hero || card.id === weapon).length,
    2,
  );
  assert.equal(g.resolvedTreacheryDiscardSequence, firstSequence + 1);
  g = applyAction(reload(g), 'a', { type: 'decision', discard: [shield] });
  assert.equal(g.decision?.kind, 'caladanReinforcement');
  assert.equal(g.resolvedTreacheryDiscardSequence, firstSequence + 2);
  assert.equal(
    g.discard.filter((card) => [hero, weapon, shield].includes(card.id)).length,
    3,
  );
  assert.equal(p(g, 'a').forces['hagga_basin:12'], 1);
  stable(g);
  const done = applyAction(g, 'a', reinforce(g));
  assert.equal(p(done, 'a').forces['hagga_basin:12'], 2);
  assert.equal(p(done, 'a').tanks, 2);
  stable(done);
});

void test('Caladan saved event and independent obligation reject stale actions, edited facts and deleted frame/choice before mutation', () => {
  const g = victory();
  const action = reinforce(g);
  reject(g, 'a', { ...action, event: 'old-battle' });
  reject(g, 'a', { ...action, decline: true });
  for (const mutate of [
    (bad: Game) => {
      bad.homeworldVictoryReinforcement!.player = 'g';
    },
    (bad: Game) => {
      bad.homeworldVictoryReinforcement!.territory = 'arrakeen';
    },
    (bad: Game) => {
      bad.homeworldVictoryReinforcement!.offer!.survivors++;
    },
    (bad: Game) => {
      bad.homeworldVictoryReinforcement!.signature = 'forged';
    },
    (bad: Game) => {
      delete bad.homeworldVictoryReinforcement;
    },
    (bad: Game) => {
      bad.decision = null;
    },
    (bad: Game) => {
      delete bad.homeworldVictoryReinforcement;
      bad.decision = null;
    },
    (bad: Game) => {
      delete bad.lastBattleContext!.caladanReinforcement;
    },
  ]) {
    const bad = reload(g);
    mutate(bad);
    const before = structuredClone(bad);
    assert.throws(() => viewGame(bad, 'a'), /Caladan|reinforcement|victory/i);
    assert.throws(
      () => normalizeAutomaticGame(bad),
      /Caladan|reinforcement|victory/i,
    );
    reject(bad, 'a', action, /Caladan|reinforcement|victory/i);
    assert.deepEqual(bad, before);
  }
  stable(g);
});

void test('a later battle at the same location owns a fresh event and cannot consume the earlier declined reinforcement', () => {
  let g = victory();
  const oldAction = reinforce(g);
  g = applyAction(g, 'a', {
    type: 'decision',
    event: oldAction.event,
    decline: true,
  });
  assert.equal(p(g, 'a').reserves, 6);
  // Stage one later conserved deployment from Guild native reserves, keeping
  // the completed battle history. Resolve the next battle through real actions.
  positionVictoryArmy(g, 'g', 16, 1, 3);
  Object.assign(g, { phase: 6, active: 'a', phaseOpening: null, ready: [] });
  g = victory(g);
  assert.notEqual(g.homeworldVictoryReinforcement!.event, oldAction.event);
  assert.equal(g.lastBattleContext!.caladanReinforcement!.completed, false);
  reject(g, 'a', oldAction, /current Caladan/);
  const done = applyAction(reload(g), 'a', reinforce(g));
  assert.equal(p(done, 'a').reserves, 5);
  assert.equal(done.homeworldVictoryReinforcement!.stage, 'complete');
  stable(done);
});

void test('a waiting Caladan victory cannot lose its real optional Shield cleanup decision', () => {
  let g = caladanVictoryFixture();
  const shield = holdVictoryCard(g, 'a', 'shield');
  g = finishVictoryCalls(
    commitVictoryPlans(prepareVictoryBattle(g), {
      a: { defense: shield },
    }),
  );
  assert.equal(g.decision?.kind, 'battleCards');
  assert.equal(g.homeworldVictoryReinforcement!.stage, 'waiting');
  assert.equal(g.lastBattleContext!.caladanReinforcement!.stage, 'waiting');
  assert.equal(g.pendingTreacheryDiscard ?? null, null);
  assert.equal(g.response, null);
  assert.ok(p(g, 'a').hand.some((card) => card.id === shield));
  stable(g);
  const corrupt = reload(g);
  corrupt.decision = null;
  const before = structuredClone(corrupt);
  for (const player of corrupt.players) {
    assert.throws(
      () => viewGame(corrupt, player.id),
      /Caladan|cleanup|victory/i,
    );
    assert.deepEqual(corrupt, before);
  }
  assert.throws(
    () => normalizeAutomaticGame(corrupt),
    /Caladan|cleanup|victory/i,
  );
  assert.deepEqual(corrupt, before);
  reject(
    corrupt,
    'a',
    {
      type: 'decision',
      event: g.homeworldVictoryReinforcement!.event,
      decline: true,
    },
    /Caladan|cleanup|victory/i,
  );
  // The original real cleanup still retires its card before exposing the offer.
  const valid = applyAction(reload(g), 'a', {
    type: 'decision',
    discard: [shield],
  });
  assert.equal(valid.decision?.kind, 'caladanReinforcement');
  assert.equal(valid.discard.filter((card) => card.id === shield).length, 1);
  stable(valid);
});

void test('all profiles consume the real owned event and observers receive no destinations; Face Dance ordering stays blocked but declinable', () => {
  const g = victory();
  const observer = viewGame(g, 'g');
  assert.deepEqual(observer.caladanReinforcement!.destinations, []);
  assert.deepEqual(caladanReinforcementActions(observer), []);
  for (const profile of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = viewGame(reload(g), 'a');
    view.players.find((player) => player.id === 'a')!.bot = profile;
    const actions = botActions(view);
    assert.deepEqual(actions, caladanReinforcementActions(view));
    assert.equal(actions.length, 1);
    const done = applyAction(reload(g), 'a', actions[0]);
    assert.equal(done.homeworldVictoryReinforcement!.stage, 'complete');
    stable(done);
  }
  let contested = victory(caladanVictoryFixture({ tleilaxu: true }));
  const offer = viewGame(contested, 'a').caladanReinforcement!;
  assert.match(offer.blocked!, /Face Dancer.*ordering ruling/);
  reject(
    contested,
    'a',
    {
      type: 'decision',
      event: offer.event,
      amount: 1,
      destination: 'hagga_basin:12',
    },
    /ordering ruling/,
  );
  const before = structuredClone(p(contested, 'a'));
  contested = applyAction(reload(contested), 'a', {
    type: 'decision',
    event: offer.event,
    decline: true,
  });
  assert.deepEqual(p(contested, 'a'), before);
  assert.equal(contested.homeworldVictoryReinforcement!.stage, 'complete');
  if (contested.decision?.kind === 'faceDance')
    contested = applyAction(contested, 't', {
      type: 'decision',
      reveal: false,
    });
  stable(contested);
});
