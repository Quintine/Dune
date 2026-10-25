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
import { fighterCount } from '../game/advisors';

function open(native = 6, polarAlone = false) {
  const initial = fixture();
  if (native !== 6) {
    p(initial, 'a').reserves = native;
    p(initial, 'a').forces['polar_sink:0'] -= native - 6;
  }
  if (polarAlone) {
    // Conserved controlled initial position for the automatic Polar conversion.
    p(initial, 'a').forces['hagga_basin:12'] = p(initial, 'a').forces['polar_sink:0'];
    delete p(initial, 'a').forces['polar_sink:0'];
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

void test('actual Caladan victory keeps its Guild and Advanced Spiritual child without triggering an Ambassador for advisors', () => {
  let g = open();
  const event = g.homeworldVictoryReinforcement!.event, parent = g.pendingAmbassador!.event;
  assert.equal(p(g, 'a').reserves, 5); assert.equal(p(g, 'a').forces['arrakeen:10'], 3);
  g = applyAction(g, 'ec', { type: 'decision', event: parent, trigger: true, beneficiary: 'h' });
  g = applyAction(g, 'h', { type: 'decision', event: parent, amount: 2, territory: 'sietch_tabr', sector: 14 });
  assert.equal(g.decision?.kind, 'intrusion');
  // Resolve real Intrusion before legal Advanced accompaniment into this territory.
  g = allow(applyAction(g, 'bg', { type: 'decision', accept: true }));
  assert.equal(fighterCount(p(g, 'bg'), 'sietch_tabr'), 0);
  g = applyAction(g, 'bg', { type: 'decision', accept: true, accompany: true });
  assert.equal(g.response?.kind, 'advisor');
  assert.equal(g.pendingSpiritualAdvisor!.source!.phase, 6);
  assert.equal(g.pendingAmbassador!.victoryEvent, event);
  g = allow(g);
  // Advisors are excluded from Ambassador triggers, including the waiting Fremen token.
  assert.equal(g.pendingAmbassador, null);
  assert.equal(g.pendingSpiritualAdvisor ?? null, null);
  assert.equal(g.homeworldVictoryReinforcement!.stage, 'complete');
  assert.equal(g.lastBattleContext!.caladanReinforcement!.completed, true);
  assert.deepEqual(g.homeworldVictoryReinforcement!.ambassadors!.map(entry => entry.completed), [true]);
  assert.equal(g.ecazAmbassadors!.tokens.find(token => token.effect === 'fremen')!.zone, 'placed');
  assert.equal(g.homeworldRevivalReturn, undefined);
  assert.equal(p(g, 'a').reserves, 5); assert.equal(p(g, 'a').forces['arrakeen:10'], 3);
  assert.equal(p(g, 'h').forces['sietch_tabr:14'], 2);
  assert.equal(p(g, 'bg').forces['sietch_tabr:14'], 2);
  assert.equal(fighterCount(p(g, 'bg'), 'sietch_tabr'), 0);
  assert.equal(p(g, 'ec').forces['red_chasm:7'], 1);
  inventory(g); assert.deepEqual(normalizeAutomaticGame(reload(g)), reload(g));
  assert.throws(() => applyAction(g, 'a', { type: 'decision', event, destination: 'arrakeen:10' }));
  assert.throws(() => applyAction(g, 'ec', { type: 'decision', event: parent, trigger: true, beneficiary: 'h' }));
});

void test('the Battle-phase Guild child can send Spiritual Advisors to Polar and complete their automatic fighter conversion', () => {
  let g = open(6, true);
  const event = g.homeworldVictoryReinforcement!.event, parent = g.pendingAmbassador!.event;
  g = applyAction(g, 'ec', { type: 'decision', event: parent, trigger: true, beneficiary: 'h' });
  g = applyAction(g, 'h', { type: 'decision', event: parent, amount: 2, territory: 'sietch_tabr', sector: 14 });
  g = applyAction(g, 'bg', { type: 'decision', accept: false });
  g = applyAction(g, 'bg', { type: 'decision', accept: true, accompany: false });
  assert.equal(g.pendingSpiritualAdvisor!.source!.phase, 6);
  assert.equal(g.pendingSpiritualAdvisor!.source!.territory, 'polar_sink');
  g = allow(g);
  assert.equal(p(g, 'bg').forces['polar_sink:0'], 1);
  assert.equal(fighterCount(p(g, 'bg'), 'polar_sink'), 1);
  assert.equal(p(g, 'bg').forces['sietch_tabr:14'], 1);
  assert.equal(fighterCount(p(g, 'bg'), 'sietch_tabr'), 1);
  assert.equal(g.pendingSpiritualAdvisor ?? null, null);
  assert.equal(g.pendingAmbassador, null);
  assert.equal(g.homeworldVictoryReinforcement!.event, event);
  assert.equal(g.homeworldVictoryReinforcement!.stage, 'complete');
  assert.deepEqual(g.homeworldVictoryReinforcement!.ambassadors!.map(entry => entry.completed), [true]);
  inventory(g);
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
