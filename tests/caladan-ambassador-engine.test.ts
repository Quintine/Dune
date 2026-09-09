import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  normalizeAutomaticGame,
  viewGame,
  type Game,
} from '../game/engine';
import {
  prepareVictoryBattle,
  commitVictoryPlans,
  finishVictoryCalls,
  victoryInventory as inventory,
  victoryReload as reload,
  victoryPlayer as p,
} from './fixture-caladan-victory';

import { caladanAmbassadorFixture as fixture } from './fixture-caladan-ambassador';

function open(native = 6) {
  const initial = fixture();
  if (native !== 6) {
    p(initial, 'a').reserves = native;
    p(initial, 'a').forces['polar_sink:0'] -= native - 6;
  }
  let g = finishVictoryCalls(
    commitVictoryPlans(prepareVictoryBattle(initial, 'arrakeen')),
  );
  assert.equal(g.decision?.kind, 'caladanReinforcement');
  assert.equal(g.lastBattleContext?.winner, 'a');
  assert.equal(p(g, 'a').forces['arrakeen:10'], 2);
  g = applyAction(reload(g), 'a', {
    type: 'decision',
    event: g.homeworldVictoryReinforcement!.event,
    destination: 'arrakeen:10',
  });
  assert.equal(g.pendingAmbassador?.stage, 'offer');
  assert.equal(g.pendingAmbassador?.victoryEvent, g.lastBattleContext!.event);
  assert.equal(g.pendingAmbassador?.revivalEvent, undefined);
  assert.equal(g.homeworldRevivalReturn, undefined);
  inventory(g);
  return g;
}
function allow(g: Game) {
  for (let n = 0; g.response && n < 30; n++) {
    const player = g.players.find(
      (seat) => !g.response!.passed.includes(seat.id),
    );
    assert.ok(player);
    g = applyAction(reload(g), player.id, { type: 'passResponse' });
  }
  assert.equal(g.response, null);
  return g;
}

void test('actual Caladan victory reinforces once and preserves its battle through Guild, BG and Fremen Ambassador children', () => {
  let g = open();
  const event = g.homeworldVictoryReinforcement!.event;
  const parent = g.pendingAmbassador!.event;
  assert.equal(p(g, 'a').reserves, 5);
  assert.equal(p(g, 'a').forces['arrakeen:10'], 3);
  g = applyAction(reload(g), 'ec', {
    type: 'decision',
    event: parent,
    trigger: true,
    beneficiary: 'h',
  });
  g = applyAction(reload(g), 'h', {
    type: 'decision',
    event: parent,
    amount: 2,
    territory: 'sietch_tabr',
    sector: 14,
  });
  assert.equal(g.decision?.kind, 'intrusion');
  g = applyAction(reload(g), 'bg', { type: 'decision', accept: false });
  g = applyAction(reload(g), 'bg', {
    type: 'decision',
    accept: true,
    accompany: true,
  });
  assert.equal(g.response?.kind, 'advisor');
  g = allow(g);
  assert.equal(g.pendingAmbassador?.entrant, 'bg');
  assert.equal(g.pendingAmbassador?.victoryEvent, event);
  assert.equal(g.pendingAmbassador?.revivalEvent, undefined);
  assert.deepEqual(
    g.homeworldVictoryReinforcement!.ambassadors!.map(
      (entry) => entry.completed,
    ),
    [true, false],
  );
  assert.equal(g.lastBattleContext!.caladanReinforcement!.completed, false);
  assert.deepEqual(normalizeAutomaticGame(reload(g)), reload(g));
  const child = g.pendingAmbassador!.event;
  g = applyAction(reload(g), 'ec', {
    type: 'decision',
    event: child,
    trigger: true,
    beneficiary: 'ec',
  });
  g = applyAction(reload(g), 'ec', {
    type: 'decision',
    event: child,
    forces: { 'red_chasm:7': 1 },
    territory: 'carthag',
    sector: 11,
  });
  assert.equal(g.pendingAmbassador, null);
  assert.equal(g.homeworldVictoryReinforcement!.stage, 'complete');
  assert.equal(g.lastBattleContext!.caladanReinforcement!.completed, true);
  assert.deepEqual(
    g.homeworldVictoryReinforcement!.ambassadors!.map(
      (entry) => entry.completed,
    ),
    [true, true],
  );
  assert.equal(g.homeworldRevivalReturn, undefined);
  assert.equal(p(g, 'a').reserves, 5);
  assert.equal(p(g, 'a').forces['arrakeen:10'], 3);
  assert.equal(p(g, 'h').forces['sietch_tabr:14'], 2);
  assert.equal(p(g, 'bg').forces['sietch_tabr:14'], 2);
  assert.equal(p(g, 'ec').forces['carthag:11'], 1);
  inventory(g);
  assert.deepEqual(normalizeAutomaticGame(reload(g)), reload(g));
  for (const action of [
    { type: 'decision', event, destination: 'arrakeen:10' },
    {
      type: 'decision',
      event: child,
      forces: { 'red_chasm:7': 1 },
      territory: 'carthag',
      sector: 11,
    },
  ])
    assert.throws(() => applyAction(g, 'a', action));
});

void test('a real victory arrival cannot lose its child, source tag or independent original obligation during recovery', () => {
  const original = open();
  for (const edit of [
    (g: Game) => {
      g.pendingAmbassador = null;
      g.decision = null;
    },
    (g: Game) => {
      delete g.pendingAmbassador!.victoryEvent;
    },
    (g: Game) => {
      g.pendingAmbassador!.revivalEvent = g.pendingAmbassador!.victoryEvent;
    },
    (g: Game) => {
      delete g.homeworldVictoryReinforcement;
    },
    (g: Game) => {
      delete g.lastBattleContext!.caladanReinforcement;
    },
    (g: Game) => {
      g.homeworldVictoryReinforcement!.stage = 'complete';
    },
  ]) {
    const g = reload(original);
    edit(g);
    const before = reload(g);
    assert.throws(() => viewGame(g, 'ec'));
    assert.throws(() => normalizeAutomaticGame(g));
    assert.throws(() =>
      applyAction(g, 'ec', {
        type: 'decision',
        event: original.pendingAmbassador!.event,
        trigger: false,
      }),
    );
    assert.deepEqual(g, before);
  }
});

void test('declining the real Ambassador completes Caladan across phase advancement without reopening it', () => {
  let g = open();
  const event = g.homeworldVictoryReinforcement!.event;
  g = applyAction(reload(g), 'ec', {
    type: 'decision',
    event: g.pendingAmbassador!.event,
    decline: true,
  });
  assert.equal(g.homeworldVictoryReinforcement!.stage, 'complete');
  assert.notEqual(g.phase, 6);
  assert.equal(viewGame(g, 'a').caladanReinforcement, null);
  assert.deepEqual(normalizeAutomaticGame(reload(g)), reload(g));
  assert.throws(() =>
    applyAction(g, 'a', {
      type: 'decision',
      event,
      destination: 'arrakeen:10',
    }),
  );
  inventory(g);
});

void test('rewinding an actual placed reinforcement to its original choice cannot withdraw a second reserve', () => {
  const g = open(7);
  const frame = g.homeworldVictoryReinforcement!;
  assert.equal(p(g, 'a').reserves, 6);
  frame.stage = 'choice';
  delete frame.destination;
  delete frame.ambassadors;
  delete frame.arrivalSignature;
  g.pendingAmbassador = null;
  g.decision = {
    kind: 'caladanReinforcement',
    player: 'a',
    event: frame.event,
  };
  const before = reload(g);
  assert.throws(() => viewGame(g, 'a'));
  assert.throws(() => normalizeAutomaticGame(g));
  assert.throws(() =>
    applyAction(g, 'a', {
      type: 'decision',
      event: frame.event,
      destination: 'arrakeen:10',
    }),
  );
  assert.deepEqual(g, before);
});
