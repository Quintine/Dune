import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  normalizeAutomaticGame,
  viewGame,
  type Game,
} from '../game/engine';
import {
  revivalPlayer as p,
  revivalInventory as inventory,
  revivalReload as reload,
} from './fixture-homeworld-revival';

import { homeworldRevivalAmbassadorFixture as fixture } from './fixture-homeworld-revival-ambassador';

function revivalOpportunity(g: Game, actor: string) {
  for (let count = 0; g.revivalOrder && g.revivalOrder.remaining[0] !== actor && count < g.players.length; count++) {
    const preceding = g.revivalOrder.remaining[0]; assert.ok(preceding);
    assert.equal(g.phase, 4);
    assert.equal(g.response ?? null, null); assert.equal(g.decision ?? null, null);
    g = applyAction(g, preceding, { type: 'ready' });
  }
  assert.equal(g.phase, 4);
  if (g.revivalOrder) assert.equal(g.revivalOrder.remaining[0], actor);
  return g;
}

function open() {
  let g = revivalOpportunity(fixture(), 'f');
  g = applyAction(g, 'f', { type: 'revive', amount: 1, elite: 1 });
  if (g.decision?.kind === 'revivalStop')
    g = applyAction(g, 't', { type: 'decision', decline: true });
  while (!g.homeworldRevivalReturn && g.response) g = allow(g, g.response.kind);
  assert.equal(
    g.homeworldRevivalReturn?.stage,
    'choice',
    JSON.stringify({
      decision: g.decision,
      response: g.response,
      revival: g.pendingRevival,
    }),
  );
  assert.equal(g.homeworldRevivalReturn.resumeResponse?.kind, 'revivalIncome');
  const event = g.homeworldRevivalReturn.event;
  g = applyAction(reload(g), 'f', {
    type: 'decision',
    event,
    destination: 'arrakeen:10',
  });
  assert.equal(g.pendingAmbassador?.stage, 'offer');
  assert.equal(g.homeworldRevivalReturn?.stage, 'arrival');
  inventory(g);
  return g;
}
function allow(g: Game, kind: string) {
  for (let n = 0; g.response?.kind === kind && n < 40; n++) {
    const player = g.players.find(
      (player) => !g.response!.passed.includes(player.id),
    );
    assert.ok(player);
    g = applyAction(reload(g), player.id, { type: 'passResponse' });
  }
  return g;
}

void test('actual phase-four revived arrival rejects fighter accompaniment and holds income through the Guild Polar alternative', () => {
  let g = open();
  const original = structuredClone(g.homeworldRevivalReturn!);
  const beforeIncome = p(g, 't').spice;
  const parent = g.pendingAmbassador!.event;
  g = applyAction(reload(g), 'ec', { type: 'decision', event: parent, trigger: true, beneficiary: 'a' });
  assert.equal(g.pendingAmbassador?.stage, 'ship');
  g = applyAction(reload(g), 'a', { type: 'decision', event: parent, amount: 2, territory: 'sietch_tabr', sector: 14 });
  assert.equal(g.decision?.kind, 'intrusion');
  g = applyAction(reload(g), 'bg', { type: 'decision', accept: false });
  assert.equal(g.decision?.kind, 'advisor');
  const before = reload(g);
  assert.throws(() => applyAction(g, 'bg', { type: 'decision', accept: true, accompany: true }), /cannot accompany/);
  assert.deepEqual(g, before);
  g = applyAction(reload(g), 'bg', { type: 'decision', accept: true, accompany: false, amount: 1 });
  assert.equal(g.response?.kind, 'advisor');
  g = allow(g, 'advisor');
  g = allow(g, 'advisorFlip');
  assert.equal(g.pendingAmbassador ?? null, null);
  assert.equal(g.homeworldRevivalReturn?.ambassadors?.length, 1);
  assert.equal(g.homeworldRevivalReturn!.ambassadors![0].completed, true);
  assert.equal(g.homeworldRevivalReturn?.stage, 'complete');
  assert.deepEqual(g.response, original.resumeResponse);
  assert.equal(p(g, 't').spice, beforeIncome);
  g = allow(g, 'revivalIncome');
  assert.equal(p(g, 't').spice, beforeIncome + original.resumeResponse!.amount!);
  assert.equal(p(g, 'f').forces['arrakeen:10'], 13);
  assert.equal(p(g, 'a').forces['sietch_tabr:14'], 2);
  assert.equal(p(g, 'bg').forces['sietch_tabr:14'], 1);
  assert.equal(p(g, 'bg').forces['polar_sink:0'], 1);
  assert.equal(p(g, 'ec').forces['red_chasm:7'], 1);
  assert.ok(g.ecazAmbassadors!.tokens.some(token => token.effect === 'fremen' && token.zone === 'placed' && token.location === 'sietch_tabr'));
  inventory(g);
  assert.deepEqual(normalizeAutomaticGame(reload(g)), reload(g));
});

void test('a controlled native World source completes revived Tleilax Intrusion and Spiritual declines before its Fremen Ambassador relocation', () => {
  let g = revivalOpportunity(fixture(), 't');
  // This existing fixture conserves staged native armies/cards. The return,
  // Intrusion, Spiritual choice and Ambassador continuations are real actions.
  g = applyAction(g, 't', { type: 'revive', amount: 1, elite: 0 });
  const event = g.homeworldRevivalReturn!.event;
  const beforeIncome = p(g, 't').spice;
  g = applyAction(g, 't', { type: 'decision', event, destination: 'sietch_tabr:14' });
  assert.equal(g.decision?.kind, 'intrusion');
  g = applyAction(g, 'bg', { type: 'decision', accept: false });
  assert.equal(g.decision?.kind, 'advisor');
  g = applyAction(g, 'bg', { type: 'decision', accept: false });
  assert.equal(g.pendingAmbassador?.stage, 'offer');
  assert.equal(g.pendingAmbassador?.entrant, 't');
  const entry = g.pendingAmbassador!;
  assert.equal(entry.revivalEvent, event);
  g = applyAction(g, 'ec', { type: 'decision', event: entry.event, trigger: true, beneficiary: 'ec' });
  assert.equal(g.pendingAmbassador?.stage, 'move');
  g = applyAction(g, 'ec', { type: 'decision', event: entry.event,
    forces: { 'red_chasm:7': 1 }, territory: 'carthag', sector: 11 });
  assert.equal(g.homeworldRevivalReturn?.stage, 'complete');
  assert.equal(g.pendingAmbassador ?? null, null);
  assert.equal(p(g, 'ec').forces['carthag:11'], 1);
  assert.equal(p(g, 't').forces['sietch_tabr:14'], 1);
  assert.equal(p(g, 't').spice, beforeIncome);
  g = allow(g, 'revivalIncome');
  assert.equal(p(g, 't').spice, beforeIncome + 1);
  inventory(g);
});

void test('a controlled conserved Southern return permits Intrusion Karama without inventing Spiritual accompaniment', () => {
  let g = revivalOpportunity(fixture(), 'f');
  // Move existing Fremen/BG counters to a non-stronghold in this controlled
  // fixture. No revival, entry, response or continuation is installed.
  p(g, 'f').forces['arrakeen:10']--;
  p(g, 'f').forces['imperial_basin:9'] = 1;
  delete p(g, 'bg').forces['sietch_tabr:14'];
  p(g, 'bg').forces['imperial_basin:9'] = 1;
  inventory(g);
  g = applyAction(g, 'f', { type: 'revive', amount: 1, elite: 1 });
  if (g.decision?.kind === 'revivalStop')
    g = applyAction(g, 't', { type: 'decision', decline: true });
  while (g.homeworldRevivalReturn?.stage !== 'choice' && g.response) g = allow(g, g.response.kind);
  assert.equal(g.homeworldRevivalReturn?.stage, 'choice');
  const event = g.homeworldRevivalReturn!.event;
  g = applyAction(g, 'f', { type: 'decision', event, destination: 'imperial_basin:9' });
  assert.equal(g.decision?.kind, 'intrusion');
  g = applyAction(g, 'bg', { type: 'decision', accept: true });
  assert.equal(g.response?.kind, 'advisorFlip');
  assert.equal(g.response?.advisorRevivalEvent, event);
  assert.equal(g.response?.advisorFollowup, undefined);
  const karama = p(g, 'ec').hand.find(card => card.effect === 'karama')!;
  g = applyAction(g, 'ec', { type: 'card', card: karama.id, mode: 'cancel' });
  assert.equal(g.pendingAmbassador ?? null, null);
  assert.equal(g.homeworldRevivalReturn?.stage, 'complete');
  assert.equal(g.decision, null);
  assert.equal(p(g, 'bg').advisors?.imperial_basin, undefined);
  assert.equal(p(g, 'f').forces['imperial_basin:9'], 2);
  assert.equal(g.discard.filter(card => card.id === karama.id).length, 1);
  inventory(g);
});

void test('an actual revival Ambassador offer rejects edited original arrival identities before view or action', () => {
  const original = open();
  for (const edit of [
    (g: Game) => {
      g.pendingAmbassador!.entrant = 'a';
    },
    (g: Game) => {
      g.pendingAmbassador!.territory = 'carthag';
      g.pendingAmbassador!.sector = 11;
    },
    (g: Game) => {
      delete g.pendingAmbassador!.revivalEvent;
    },
  ]) {
    const g = reload(original);
    edit(g);
    const saved = reload(g);
    assert.throws(() => viewGame(g, 'ec'));
    assert.throws(() =>
      applyAction(g, 'ec', {
        type: 'decision',
        event: g.pendingAmbassador!.event,
        trigger: false,
      }),
    );
    assert.deepEqual(g, saved);
  }
});

void test('deleting a still-open revival Ambassador cannot silently finish its retained income', () => {
  const g = open();
  g.pendingAmbassador = null;
  g.decision = null;
  const saved = reload(g);
  assert.throws(() => viewGame(g, 'ec'));
  assert.throws(() => applyAction(g, 'ec', { type: 'ready' }));
  assert.throws(() => normalizeAutomaticGame(g));
  assert.deepEqual(g, saved);
  g.homeworldRevivalReturn!.stage = 'complete';
  const falselyCompleted = reload(g);
  assert.throws(() => viewGame(g, 'ec'));
  assert.throws(() => applyAction(g, 'ec', { type: 'ready' }));
  assert.throws(() => normalizeAutomaticGame(g));
  assert.deepEqual(g, falselyCompleted);
});

void test('a real revival arrival cannot rewind and spend an older Fedaykin still in native reserves', () => {
  const original = open();
  assert.equal(
    p(original, 'f').elites!.reserves,
    1,
    'an older elite remains physically available',
  );
  assert.equal(original.homeworldRevivalProgress?.stage, 'arrival');
  const g = reload(original);
  const frame = g.homeworldRevivalReturn!;
  frame.stage = 'choice';
  delete frame.destination;
  delete frame.ambassadors;
  delete frame.arrivalSignature;
  g.pendingAmbassador = null;
  g.decision = {
    kind: 'homeworldRevivalDeployment',
    player: 'f',
    event: frame.event,
  };
  const before = reload(g);
  assert.throws(() => viewGame(g, 'f'));
  assert.throws(() => normalizeAutomaticGame(g));
  assert.throws(() =>
    applyAction(g, 'f', {
      type: 'decision',
      event: frame.event,
      destination: 'arrakeen:10',
    }),
  );
  assert.deepEqual(g, before);
});

void test('new revival progress and its signed version cannot be deleted or downgraded during a live child', () => {
  const original = open();
  for (const edit of [
    (g: Game) => {
      delete g.homeworldRevivalProgress;
    },
    (g: Game) => {
      delete g.homeworldRevivalReturn!.progressVersion;
    },
    (g: Game) => {
      delete g.homeworldRevivalProgress;
      delete g.homeworldRevivalReturn!.progressVersion;
    },
    (g: Game) => {
      g.homeworldRevivalReturn!.progressVersion = 0 as 1;
    },
    (g: Game) => {
      g.homeworldRevivalProgress!.stage = 'choice';
    },
    (g: Game) => {
      delete g.homeworldRevivalReturn;
    },
  ]) {
    const g = reload(original);
    edit(g);
    const before = reload(g);
    assert.throws(() => viewGame(g, 'f'));
    assert.throws(() => normalizeAutomaticGame(g));
    assert.throws(() =>
      applyAction(g, 'ec', {
        type: 'decision',
        event: g.pendingAmbassador!.event,
        decline: true,
      }),
    );
    assert.deepEqual(g, before);
  }
});
