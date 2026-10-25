import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateSpiritualAdvisorSource, SpiritualAdvisorError,
  type SpiritualAdvisorContext, type SpiritualAdvisorSource,
} from '../game/spiritual-advisor';
import {
  quoteAutomaticAdvisorFlips, validateAutomaticAdvisorFlip, AutomaticAdvisorFlipError,
  type AutomaticAdvisorFlipContext, type AutomaticAdvisorFlipSource,
} from '../game/advisor-automatic-flip';

/** Minimal controlled public arrival contexts. Original force-return and
 * Ambassador receipts remain the engine's separate authority. */
function context(): SpiritualAdvisorContext {
  return { advanced: true, status: 'playing', turn: 3, phase: 4,
    players: [
      { id: 'bg', faction: 'beneGesserit', forces: {} },
      { id: 't', faction: 'tleilaxu', forces: { 'arrakeen:10': 2 } },
    ],
    homeworldRevivalReturn: { event: 'original-return', turn: 3, phase: 4, stage: 'arrival', destination: 'arrakeen:10' },
  };
}
function source(patch: Partial<SpiritualAdvisorSource> = {}): SpiritualAdvisorSource {
  return { event: 'original-advisor-opportunity', owner: 'bg', turn: 3, phase: 4,
    territory: 'polar_sink', sector: 0, amount: 1, revivalEvent: 'original-return', ...patch };
}

void test('provisional Revival SEND permits native Spiritual Advisors only against the original board arrival parent', () => {
  for (const advanced of [false, true]) for (const amount of [1, 2]) {
    const ctx = context(); ctx.advanced = advanced;
    for (const receipt of [source({ amount }), source({ amount, territory: 'arrakeen', sector: 10 })]) {
      const before = structuredClone({ ctx, receipt });
      assert.doesNotThrow(() => validateSpiritualAdvisorSource(ctx, receipt));
      assert.deepEqual({ ctx, receipt }, before);
    }
  }
});

void test('missing, foreign, stale or completed Revival parents cannot authorize a phase-four source', () => {
  const changes: ((ctx: SpiritualAdvisorContext) => void)[] = [
    ctx => { delete ctx.homeworldRevivalReturn; },
    ctx => { ctx.homeworldRevivalReturn!.event = 'foreign-return'; },
    ctx => { ctx.homeworldRevivalReturn!.turn = 2; },
    ctx => { ctx.homeworldRevivalReturn!.phase = 5; },
    ...(['waiting', 'choice', 'complete'] as const).map(stage =>
      (ctx: SpiritualAdvisorContext) => { ctx.homeworldRevivalReturn!.stage = stage; }),
    ...[undefined, 'decline', 'reserves', 'homeworld:tleilaxu', 'missing:0', 'arrakeen:9', 'arrakeen:010'].map(destination =>
      (ctx: SpiritualAdvisorContext) => { ctx.homeworldRevivalReturn!.destination = destination; }),
  ];
  for (const change of changes) {
    const ctx = context(), receipt = source(); change(ctx);
    const before = structuredClone({ ctx, receipt });
    assert.throws(() => validateSpiritualAdvisorSource(ctx, receipt), SpiritualAdvisorError);
    assert.deepEqual({ ctx, receipt }, before);
  }
});

void test('non-Polar accompaniment must use the original arrival territory while Polar remains the fallback', () => {
  const ctx = context();
  assert.throws(() => validateSpiritualAdvisorSource(ctx, source({ territory: 'carthag', sector: 11 })), SpiritualAdvisorError);
  assert.doesNotThrow(() => validateSpiritualAdvisorSource(ctx, source()));
  assert.doesNotThrow(() => validateSpiritualAdvisorSource(ctx, source({ territory: 'arrakeen', sector: 10 })));
  assert.throws(() => validateSpiritualAdvisorSource(ctx, source({ territory: 'homeworld:tleilaxu', sector: 0 })), SpiritualAdvisorError);
});

void test('Revival source keeps current native BG ownership and exact optional-field timing', () => {
  const ctx = context();
  for (const receipt of [source({ owner: 't' }), source({ revivalEvent: 'foreign-return' }),
    source({ revivalEvent: '' }), source({ revivalEvent: undefined }), source({ turn: 2 }), source({ phase: 5 })])
    assert.throws(() => validateSpiritualAdvisorSource(ctx, receipt), SpiritualAdvisorError);
  for (const phase of [1, 3, 5, 8]) {
    const old = source({ phase }); delete old.revivalEvent;
    const original = { ...ctx, phase };
    assert.doesNotThrow(() => validateSpiritualAdvisorSource(original, old));
    assert.deepEqual(Object.keys(old).sort(), ['amount', 'event', 'owner', 'phase', 'sector', 'territory', 'turn']);
    assert.throws(() => validateSpiritualAdvisorSource(original, { ...old, revivalEvent: 'original-return' }), SpiritualAdvisorError);
  }
});

function guildChildContext(): SpiritualAdvisorContext {
  const ctx = context();
  ctx.pendingSpiritualAdvisor = { event: 'original-advisor-opportunity', turn: 3, phase: 4,
    decision: { player: 'bg', destination: 'carthag:11', ambassadorEvent: 'original-ambassador', revivalEvent: 'original-return' } };
  ctx.pendingAmbassador = { event: 'original-ambassador', revivalEvent: 'original-return', turn: 3, phase: 4, stage: 'arrival' };
  return ctx;
}

void test('actual Guild Ambassador child provenance binds accompaniment to its own captured board destination', () => {
  const ctx = guildChildContext(), receipt = source({ territory: 'carthag', sector: 11 });
  const before = structuredClone({ ctx, receipt });
  assert.doesNotThrow(() => validateSpiritualAdvisorSource(ctx, receipt));
  assert.doesNotThrow(() => validateSpiritualAdvisorSource(ctx, source()));
  assert.throws(() => validateSpiritualAdvisorSource(ctx, source({ territory: 'arrakeen', sector: 10 })), SpiritualAdvisorError);
  assert.deepEqual({ ctx, receipt }, before);
  const changes: ((ctx: SpiritualAdvisorContext) => void)[] = [
    ctx => { delete ctx.pendingSpiritualAdvisor; },
    ctx => { delete ctx.pendingAmbassador; },
    ctx => { ctx.pendingSpiritualAdvisor!.event = 'foreign-opportunity'; },
    ctx => { ctx.pendingSpiritualAdvisor!.turn = 2; },
    ctx => { ctx.pendingSpiritualAdvisor!.phase = 5; },
    ctx => { ctx.pendingSpiritualAdvisor!.decision.player = 't'; },
    ctx => { ctx.pendingSpiritualAdvisor!.decision.ambassadorEvent = 'foreign-ambassador'; },
    ctx => { ctx.pendingSpiritualAdvisor!.decision.revivalEvent = 'foreign-return'; },
    ctx => { ctx.pendingSpiritualAdvisor!.decision.destination = 'homeworld:tleilaxu'; },
    ctx => { ctx.pendingAmbassador!.revivalEvent = 'foreign-return'; },
    ctx => { ctx.pendingAmbassador!.turn = 2; },
    ctx => { ctx.pendingAmbassador!.phase = 5; },
    ctx => { ctx.pendingAmbassador!.stage = 'offer'; },
  ];
  for (const change of changes) {
    const original = guildChildContext(); change(original);
    assert.throws(() => validateSpiritualAdvisorSource(original, receipt), SpiritualAdvisorError);
  }
});

function automatic() {
  const ctx: AutomaticAdvisorFlipContext = { advanced: true, status: 'playing', turn: 3, phase: 4,
    players: [
      { id: 'bg', faction: 'beneGesserit', forces: { 'polar_sink:0': 1 }, advisors: { polar_sink: {} } },
      { id: 't', faction: 'tleilaxu', forces: { 'arrakeen:10': 2 }, moved: 1 },
    ], homeworldRevivalReturn: context().homeworldRevivalReturn,
  };
  const receipt: Extract<AutomaticAdvisorFlipSource, { producer: 'spiritualArrival' }> = {
    event: 'original-automatic-occurrence', owner: 'bg', territory: 'polar_sink', turn: 3, phase: 4,
    forces: { 'polar_sink:0': 1 }, producer: 'spiritualArrival', spiritual: source(),
  };
  return { ctx, receipt };
}

void test('a committed phase-four Spiritual arrival can capture and validate its exact alone conversion', () => {
  const { ctx, receipt } = automatic();
  assert.deepEqual(quoteAutomaticAdvisorFlips(ctx), [{ player: 'bg', territory: 'polar_sink', forces: { 'polar_sink:0': 1 } }]);
  ctx.players[0].advisors = { polar_sink: { aloneFlipHold: receipt.event } };
  const before = structuredClone({ ctx, receipt });
  assert.doesNotThrow(() => validateAutomaticAdvisorFlip(ctx, receipt));
  assert.deepEqual({ ctx, receipt }, before);
  assert.deepEqual(quoteAutomaticAdvisorFlips(ctx), []);
  const group = { event: receipt.event, owner: receipt.owner, territory: receipt.territory,
    turn: receipt.turn, phase: receipt.phase, forces: receipt.forces };
  assert.throws(() => validateAutomaticAdvisorFlip(ctx,
    { ...group, producer: 'groundMovement', mover: 't', move: 1 }), AutomaticAdvisorFlipError);
  assert.throws(() => validateAutomaticAdvisorFlip(ctx, { ...group, producer: 'specialRelocation',
    relocation: { event: 'original-relocation', kind: 'ambassador', player: 't', origin: 'carthag', destination: 'arrakeen', sector: 10 } }),
  AutomaticAdvisorFlipError);
});

void test('phase-four automatic conversion delegates its parent, completed placement and surviving-group checks', () => {
  const changes: ((ctx: AutomaticAdvisorFlipContext) => void)[] = [
    ctx => { delete ctx.homeworldRevivalReturn; },
    ctx => { ctx.homeworldRevivalReturn!.event = 'foreign-return'; },
    ctx => { ctx.homeworldRevivalReturn!.stage = 'complete'; },
    ctx => { ctx.homeworldRevivalReturn!.destination = 'homeworld:tleilaxu'; },
    ctx => { ctx.players[0].forces = {}; },
    ctx => { ctx.players[1].forces = { 'polar_sink:0': 1 }; },
  ];
  for (const change of changes) {
    const { ctx, receipt } = automatic();
    ctx.players[0].advisors = { polar_sink: { aloneFlipHold: receipt.event } };
    change(ctx);
    const before = structuredClone({ ctx, receipt });
    assert.throws(() => validateAutomaticAdvisorFlip(ctx, receipt), AutomaticAdvisorFlipError);
    assert.deepEqual({ ctx, receipt }, before);
  }
});

void test('phase-four automatic conversion forwards the actual Guild child provenance to the Spiritual validator', () => {
  const { ctx, receipt } = automatic(), child = guildChildContext();
  ctx.pendingSpiritualAdvisor = child.pendingSpiritualAdvisor;
  ctx.pendingAmbassador = child.pendingAmbassador;
  ctx.players[0].forces = { 'carthag:11': 1 };
  ctx.players[0].advisors = { carthag: { aloneFlipHold: receipt.event } };
  receipt.territory = 'carthag'; receipt.forces = { 'carthag:11': 1 };
  receipt.spiritual = source({ territory: 'carthag', sector: 11 });
  const before = structuredClone({ ctx, receipt });
  assert.doesNotThrow(() => validateAutomaticAdvisorFlip(ctx, receipt));
  assert.deepEqual({ ctx, receipt }, before);
  ctx.pendingAmbassador!.revivalEvent = 'foreign-return';
  assert.throws(() => validateAutomaticAdvisorFlip(ctx, receipt), AutomaticAdvisorFlipError);
});
