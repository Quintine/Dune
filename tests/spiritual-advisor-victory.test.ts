import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SpiritualAdvisorError, validateSpiritualAdvisorSource,
  type SpiritualAdvisorContext, type SpiritualAdvisorSource,
} from '../game/spiritual-advisor';

/** Controlled public parent/source context only. Native Caladan, consumed
 * Ambassador token, exact physical shipment and BG resources remain the engine
 * producer's duty; no played Game or arrival is manufactured by these quotes. */
function context(): SpiritualAdvisorContext {
  return {
    advanced: true, status: 'playing', turn: 3, phase: 6,
    players: [
      { id: 'bg', faction: 'beneGesserit', forces: {} },
      { id: 'h', faction: 'harkonnen', forces: { 'sietch_tabr:14': 2 } },
      { id: 'a', faction: 'atreides', forces: { 'arrakeen:10': 3 } },
      { id: 'ec', faction: 'ecaz', forces: {} },
    ],
    homeworldVictoryReinforcement: { event: 'original-caladan-victory', turn: 3, phase: 6, stage: 'arrival' },
    pendingSpiritualAdvisor: {
      event: 'original-spiritual-choice', turn: 3, phase: 6,
      decision: { player: 'bg', destination: 'sietch_tabr:14', ambassadorEvent: 'original-guild-child' },
    },
    pendingAmbassador: {
      event: 'original-guild-child', victoryEvent: 'original-caladan-victory', effect: 'guild',
      turn: 3, phase: 6, stage: 'arrival',
      shipmentReceipt: {
        next: 'advisor',
        order: { player: 'h', territory: 'sietch_tabr', sector: 14, amount: 2, elite: 0,
          advisors: false, cost: 0, allyPayment: 0 },
      },
    },
  };
}
function source(polar = false): SpiritualAdvisorSource {
  return { event: 'original-spiritual-choice', owner: 'bg', turn: 3, phase: 6,
    territory: polar ? 'polar_sink' : 'sietch_tabr', sector: polar ? 0 : 14, amount: 1 };
}
function rejected(ctx: SpiritualAdvisorContext, receipt: SpiritualAdvisorSource) {
  const before = structuredClone({ ctx, receipt });
  assert.throws(() => validateSpiritualAdvisorSource(ctx, receipt), error =>
    error instanceof SpiritualAdvisorError && error.name === 'SpiritualAdvisorError');
  assert.deepEqual({ ctx, receipt }, before);
}

void test('phase-six Spiritual accompaniment and Polar sources retain the original Caladan Guild chain with exactly seven fields', () => {
  for (const polar of [false, true]) for (const amount of [1, 2]) {
    const ctx = context(), receipt = { ...source(polar), amount }, before = structuredClone({ ctx, receipt });
    assert.doesNotThrow(() => validateSpiritualAdvisorSource(ctx, receipt));
    assert.deepEqual({ ctx, receipt }, before);
    assert.deepEqual(Object.keys(receipt).sort(), ['amount', 'event', 'owner', 'phase', 'sector', 'territory', 'turn']);
  }
});

void test('missing stale wrong-clock or completed Caladan parents reject accompanying and Polar packets equally', () => {
  const changes: ((ctx: SpiritualAdvisorContext) => void)[] = [
    ctx => { delete ctx.homeworldVictoryReinforcement; },
    ctx => { ctx.homeworldVictoryReinforcement!.event = 'another-victory'; },
    ctx => { ctx.homeworldVictoryReinforcement!.turn = 2; },
    ctx => { Object.assign(ctx.homeworldVictoryReinforcement!, { phase: 5 }); },
    ...(['waiting', 'choice', 'complete'] as const).map(stage =>
      (ctx: SpiritualAdvisorContext) => { ctx.homeworldVictoryReinforcement!.stage = stage; }),
  ];
  for (const change of changes) for (const polar of [false, true]) {
    const ctx = context(); change(ctx); rejected(ctx, source(polar));
  }
});

void test('phase-six packets require the same owned Spiritual frame and original Guild child before choosing either target', () => {
  const changes: ((ctx: SpiritualAdvisorContext) => void)[] = [
    ctx => { delete ctx.pendingSpiritualAdvisor; },
    ctx => { ctx.pendingSpiritualAdvisor!.event = 'another-choice'; },
    ctx => { ctx.pendingSpiritualAdvisor!.turn = 2; },
    ctx => { ctx.pendingSpiritualAdvisor!.phase = 5; },
    ctx => { ctx.pendingSpiritualAdvisor!.decision.player = 'h'; },
    ctx => { delete ctx.pendingSpiritualAdvisor!.decision.ambassadorEvent; },
    ctx => { ctx.pendingSpiritualAdvisor!.decision.ambassadorEvent = 'another-child'; },
    ctx => { ctx.pendingSpiritualAdvisor!.decision.revivalEvent = 'unrelated-revival'; },
    ctx => { delete ctx.pendingAmbassador; },
    ctx => { ctx.pendingAmbassador!.event = 'another-child'; },
    ctx => { delete ctx.pendingAmbassador!.victoryEvent; },
    ctx => { ctx.pendingAmbassador!.victoryEvent = 'another-victory'; },
    ctx => { ctx.pendingAmbassador!.revivalEvent = 'unrelated-revival'; },
    ctx => { ctx.pendingAmbassador!.turn = 2; },
    ctx => { ctx.pendingAmbassador!.phase = 5; },
    ctx => { ctx.pendingAmbassador!.stage = 'offer'; },
    ctx => { ctx.pendingAmbassador!.effect = 'fremen'; },
    ctx => { delete ctx.pendingAmbassador!.effect; },
  ];
  for (const change of changes) for (const polar of [false, true]) {
    const ctx = context(); change(ctx); rejected(ctx, source(polar));
  }
});

void test('the captured chooser destination must be canonical current board and equal the committed Guild receipt', () => {
  const changes: ((ctx: SpiritualAdvisorContext) => void)[] = [
    ctx => { delete ctx.pendingAmbassador!.shipmentReceipt; },
    ctx => { ctx.pendingAmbassador!.shipmentReceipt!.next = 'finish'; },
    ctx => { ctx.pendingAmbassador!.shipmentReceipt!.order.territory = 'carthag'; },
    ctx => { ctx.pendingAmbassador!.shipmentReceipt!.order.sector = 0; },
    ctx => { delete ctx.pendingSpiritualAdvisor!.decision.destination; },
    ...['sietch_tabr:014', 'sietch_tabr:0', 'homeworld:atreides', 'missing:14', 'carthag:11'].map(destination =>
      (ctx: SpiritualAdvisorContext) => { ctx.pendingSpiritualAdvisor!.decision.destination = destination; }),
  ];
  for (const change of changes) for (const polar of [false, true]) {
    const ctx = context(); change(ctx); rejected(ctx, source(polar));
  }
  const ctx = context();
  for (const receipt of [
    { ...source(), territory: 'arrakeen', sector: 10 },
    { ...source(), territory: 'carthag', sector: 11 },
    { ...source(), sector: 0 },
    { ...source(true), sector: 1 },
  ]) rejected(ctx, receipt);
});

void test('phase-six source metadata keeps current native BG identity clock and strict legacy keys', () => {
  const ctx = context();
  for (const patch of [
    { event: 'another-choice' }, { owner: 'h' }, { turn: 2 }, { phase: 5 },
    { amount: 0 }, { amount: 3 }, { amount: 1.5 },
    { revivalEvent: 'not-a-revival-source' }, { victoryEvent: 'not-a-source-field' }, { card: 'private-cost' },
  ]) rejected(ctx, { ...source(), ...patch } as SpiritualAdvisorSource);
  for (const change of [
    (g: SpiritualAdvisorContext) => { g.status = 'setup'; },
    (g: SpiritualAdvisorContext) => { g.phase = 5; },
    (g: SpiritualAdvisorContext) => { g.turn = 4; },
    (g: SpiritualAdvisorContext) => { g.players[0].faction = 'atreides'; },
  ]) { const changed = context(); change(changed); rejected(changed, source()); }
});

void test('ordinary seven-field and revival eight-field sources retain their existing shapes and phase boundaries', () => {
  for (const phase of [1, 3, 5, 8]) {
    const ctx = context(); ctx.phase = phase;
    for (const field of ['homeworldVictoryReinforcement', 'pendingAmbassador', 'pendingSpiritualAdvisor'])
      Object.defineProperty(ctx, field, { get() { throw Error(`Ordinary source read ${field}`); } });
    assert.doesNotThrow(() => validateSpiritualAdvisorSource(ctx, { ...source(true), phase }));
  }
  const ctx = context(); ctx.phase = 4;
  delete ctx.pendingAmbassador; delete ctx.pendingSpiritualAdvisor;
  ctx.homeworldRevivalReturn = { event: 'original-revival', turn: 3, phase: 4, stage: 'arrival', destination: 'arrakeen:10' };
  Object.defineProperty(ctx, 'homeworldVictoryReinforcement', { get() { throw Error('Revival read a victory parent'); } });
  assert.doesNotThrow(() => validateSpiritualAdvisorSource(ctx, {
    ...source(true), phase: 4, revivalEvent: 'original-revival',
  }));
  for (const phase of [0, 2, 7]) {
    const changed = context(); changed.phase = phase;
    rejected(changed, { ...source(true), phase });
  }
});

void test('victory source binding reads no wallets hands private source selection or future controls', () => {
  const ctx = context();
  for (const player of ctx.players) for (const field of ['hand', 'spice', 'leaders', 'reserves', 'traitors'])
    Object.defineProperty(player, field, { get() { throw Error(`Victory Spiritual source read ${field}`); } });
  for (const field of ['pendingShipment', 'stormCard', 'stormForecast', 'homeworlds', 'battle'])
    Object.defineProperty(ctx, field, { get() { throw Error(`Victory Spiritual source read ${field}`); } });
  assert.doesNotThrow(() => validateSpiritualAdvisorSource(ctx, source()));
  assert.doesNotThrow(() => validateSpiritualAdvisorSource(ctx, source(true)));
});
