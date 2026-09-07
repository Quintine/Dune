import test from 'node:test';
import assert from 'node:assert/strict';
import {
  quotePhaseResources,
  quoteAidRefunds,
  PhaseResourceError,
} from '../game/phase-resource-quote';
import { createTechTokens } from '../game/tech-tokens';
import {
  quoteBattlePhaseAdvance,
  BoardResolutionError,
} from '../game/board-resolution-quote';
import { applyAction, createGame, newPlayer } from '../game/engine';
import { createAmbassadors } from '../game/ecaz-ambassadors';
const fixture = () => ({
  phase: 5,
  players: [
    { id: 'a', spice: 10 },
    { id: 'b', spice: 20 },
  ],
  techTokens: createTechTokens([
    { id: 'a', faction: 'ixians' },
    { id: 'b', faction: 'tleilaxu' },
  ]),
  aid: { a: { recipient: 'b', amount: 3 }, b: { recipient: 'a', amount: 2 } },
});
void test('tech income precedes aid refunds and aggregate balances include both once', () => {
  const g = fixture();
  g.techTokens.heighliners.spice = 2;
  const before = structuredClone(g);
  const q = quotePhaseResources(g);
  assert.deepEqual(q.credits, [
    { kind: 'tech', token: 'heighliners', player: 'a', amount: 2, balance: 12 },
    { kind: 'aid', player: 'a', amount: 3, balance: 15 },
    { kind: 'aid', player: 'b', amount: 2, balance: 22 },
  ]);
  assert.deepEqual(q.tokenResets, ['heighliners']);
  assert.deepEqual(q.balances, { a: 15, b: 22 });
  assert.equal(q.clearAid, true);
  assert.deepEqual(g, before);
  q.balances.a = 0;
  q.refunds[0].amount = 100;
  assert.deepEqual(g, before);
});
void test('only current technology and phase3/5/6 escrow settle; other phases preserve escrow', () => {
  for (let phase = 0; phase <= 8; phase++) {
    const g = fixture();
    g.phase = phase;
    g.techTokens.production = { owner: 'a', spice: 3 };
    g.techTokens.heighliners.spice = 2;
    g.techTokens.axlotl.spice = 1;
    const q = quotePhaseResources(g);
    assert.deepEqual(
      q.credits.filter((c) => c.kind === 'tech').map((c) => c.amount),
      phase === 2 ? [3] : phase === 4 ? [1] : phase === 5 ? [2] : [],
    );
    assert.equal(q.clearAid, [3, 5, 6].includes(phase));
    assert.equal(q.refunds.length, q.clearAid ? 2 : 0);
  }
});
void test('refunds do not demand current recipient custody, mutual alliance or a positive pledge', () => {
  const g = fixture();
  g.aid.a = { recipient: 'former-absent-ally', amount: 0 };
  assert.deepEqual(quoteAidRefunds(g.players, g.aid), [
    { player: 'a', amount: 0, balance: 10 },
    { player: 'b', amount: 2, balance: 22 },
  ]);
});
void test('negative, missing donor, malformed and cumulative-overflow payments reject immutably', () => {
  const mutations = [
    (g: ReturnType<typeof fixture>) => {
      g.aid.a.amount = -1;
    },
    (g: ReturnType<typeof fixture>) => {
      g.aid.a.amount = 0.5;
    },
    (g: ReturnType<typeof fixture>) => {
      g.players = g.players.filter((p) => p.id !== 'a');
    },
    (g: ReturnType<typeof fixture>) => {
      g.aid = null as never;
    },
    (g: ReturnType<typeof fixture>) => {
      g.techTokens.heighliners.owner = 'absent';
    },
    (g: ReturnType<typeof fixture>) => {
      g.techTokens.heighliners.spice = -1;
    },
    (g: ReturnType<typeof fixture>) => {
      g.techTokens.heighliners = null as never;
    },
    (g: ReturnType<typeof fixture>) => {
      g.players[0].spice = Number.MAX_SAFE_INTEGER - 3;
      g.techTokens.heighliners.spice = 1;
    },
  ];
  for (const change of mutations) {
    const g = fixture();
    change(g);
    const before = structuredClone(g);
    assert.throws(() => quotePhaseResources(g), PhaseResourceError);
    assert.deepEqual(g, before);
  }
});
void test('an unrelated technology phase and already accrued turn marker are not new settlement prerequisites', () => {
  const g = fixture();
  g.phase = 6;
  g.techTokens.axlotl = null as never;
  assert.equal(quotePhaseResources(g).credits.length, 2);
  g.phase = 5;
  g.techTokens.heighliners.spice = 2;
  g.techTokens.heighliners.triggeredTurn = 1;
  assert.equal(quotePhaseResources(g).balances.a, 15);
  g.techTokens.heighliners.spice = 0;
  assert.deepEqual(quotePhaseResources(g).tokenResets, []);
});
void test('battle phase advance reuses refund proof without collecting before an Ix phase opening', () => {
  const g = {
    advanced: false,
    storm: 18,
    order: ['a', 'b'],
    players: [
      {
        id: 'a',
        faction: 'emperor' as const,
        ally: null,
        forces: {},
        spice: 10,
      },
      {
        id: 'b',
        faction: 'fremen' as const,
        ally: null,
        forces: {},
        spice: 20,
      },
    ],
    spice: {},
    expansions: ['ix'],
    aid: { a: { recipient: 'b', amount: 3 } },
  };
  const q = quoteBattlePhaseAdvance(g);
  assert.deepEqual(q.refunds, quoteAidRefunds(g.players, g.aid));
  assert.equal(q.collection, null);
  g.aid.a.amount = -1;
  assert.throws(() => quoteBattlePhaseAdvance(g), BoardResolutionError);
});
void test('genuine end-of-Revival settles Axlotl before Ecaz placement and completion does not repay it', () => {
  let g = createGame('PHASERESOURCE', newPlayer('e', 'Ecaz', 'ecaz'));
  g.players.push(newPlayer('p', 'Emperor', 'emperor'));
  Object.assign(g, {
    status: 'playing',
    phase: 4,
    turn: 2,
    order: ['e', 'p'],
    storm: 18,
    ecazAmbassadors: createAmbassadors(() => 0),
  });
  for (const p of g.players) {
    p.spice = 10;
    p.hand = [];
    p.forces = {};
  }
  g.techTokens = createTechTokens(g.players);
  g.techTokens.axlotl = { owner: 'p', spice: 3, triggeredTurn: 2 };
  const q = quotePhaseResources(g);
  assert.equal(q.balances.p, 13);
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.decision?.kind, 'ecazPlacement');
  assert.equal(g.players[1].spice, 13);
  assert.equal(g.techTokens!.axlotl.spice, 0);
  g = applyAction(g, 'e', { type: 'decision', decline: true });
  assert.equal(g.phase, 5);
  assert.equal(g.players[1].spice, 13);
});
