import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advisorStanceAfterSettlement,
  AutomaticAdvisorFlipError,
  quoteAutomaticAdvisorFlips,
  validateAutomaticAdvisorFlip,
  type AdvisorSettlementContext,
  type AutomaticAdvisorFlipContext,
  type AutomaticAdvisorFlipSource,
} from '../game/advisor-automatic-flip';

function context(): AutomaticAdvisorFlipContext {
  return {
    advanced: true, status: 'playing', turn: 4, phase: 5,
    players: [
      {
        id: 'b', faction: 'beneGesserit', moved: 0,
        forces: { 'imperial_basin:9': 2, 'imperial_basin:10': 1, 'arrakeen:10': 1, 'carthag:11': 2, 'hagga_basin:12': 0 },
        advisors: { imperial_basin: { lockedTurn: 4 }, arrakeen: {}, hagga_basin: {} },
      },
      { id: 'a', faction: 'atreides', moved: 1, forces: { 'carthag:11': 3 } },
      { id: 'r', faction: 'richese', moved: 0, forces: {} },
    ],
  };
}

function held() {
  const ctx = context();
  const choice = quoteAutomaticAdvisorFlips(ctx).find((entry) => entry.territory === 'imperial_basin')!;
  const source: AutomaticAdvisorFlipSource = {
    event: 'automatic-after-original-ground-move', owner: choice.player,
    territory: choice.territory, turn: ctx.turn, phase: ctx.phase,
    producer: 'groundMovement', mover: 'a', move: 1, forces: choice.forces,
  };
  ctx.players[0].advisors = {
    ...ctx.players[0].advisors,
    imperial_basin: { ...ctx.players[0].advisors!.imperial_basin, aloneFlipHold: source.event },
  };
  return { ctx, source };
}

void test('the phase-five quote finds whole physical advisor groups that became alone without using fresh locks as immunity', () => {
  const ctx = context();
  const before = structuredClone(ctx);
  assert.deepEqual(quoteAutomaticAdvisorFlips(ctx), [
    { player: 'b', territory: 'imperial_basin', forces: { 'imperial_basin:9': 2, 'imperial_basin:10': 1 } },
    { player: 'b', territory: 'arrakeen', forces: { 'arrakeen:10': 1 } },
  ]);
  assert.deepEqual(ctx, before);
  const quote = quoteAutomaticAdvisorFlips(ctx);
  quote[0].forces['imperial_basin:9'] = 99;
  assert.equal(ctx.players[0].forces['imperial_basin:9'], 2);
  assert.equal(quoteAutomaticAdvisorFlips(ctx)[0].forces['imperial_basin:9'], 2);
});

void test('quotes exclude held, occupied and physically empty advisor groups while setup and other phases stay automatic', () => {
  const { ctx } = held();
  ctx.players[1].forces = { ...ctx.players[1].forces, 'arrakeen:10': 1 };
  assert.deepEqual(quoteAutomaticAdvisorFlips(ctx), []);
  for (const patch of [
    { advanced: false }, { status: 'lobby' }, { phase: 0 }, { phase: 4 }, { phase: 6 },
  ]) {
    assert.deepEqual(quoteAutomaticAdvisorFlips({ ...context(), ...patch }), []);
  }
  const setup = context();
  setup.phase = 0;
  assert.equal(advisorStanceAfterSettlement(setup, 'b', 'imperial_basin'), undefined);
  assert.equal(advisorStanceAfterSettlement(setup, 'b', 'hagga_basin'), undefined);
});

void test('settlement uses only advanced and players, retains a held occurrence and clears that hold when another faction returns', () => {
  const { ctx, source } = held();
  const board: AdvisorSettlementContext = { advanced: ctx.advanced, players: ctx.players };
  const original = structuredClone(ctx);
  const stance = advisorStanceAfterSettlement(board, ctx.players[0], 'imperial_basin');
  assert.deepEqual(stance, { lockedTurn: 4, aloneFlipHold: source.event });
  assert.notEqual(stance, ctx.players[0].advisors!.imperial_basin);
  assert.equal(advisorStanceAfterSettlement(board, 'b', 'arrakeen'), undefined);
  assert.deepEqual(ctx, original);
  ctx.players[1].forces = { ...ctx.players[1].forces, 'imperial_basin:11': 1 };
  assert.deepEqual(advisorStanceAfterSettlement(board, 'b', 'imperial_basin'), { lockedTurn: 4 });
  assert.equal(ctx.players[0].advisors!.imperial_basin.aloneFlipHold, source.event);
  const basic = { ...board, advanced: false };
  assert.deepEqual(advisorStanceAfterSettlement(basic, 'b', 'imperial_basin'), { lockedTurn: 4, aloneFlipHold: source.event });
});

void test('a continuous alone hold survives later phases and turns, while emptiness and a newly moved group do not inherit it', () => {
  const { ctx, source } = held();
  ctx.phase = 7;
  ctx.turn++;
  assert.deepEqual(advisorStanceAfterSettlement(ctx, 'b', 'imperial_basin'), { lockedTurn: 4, aloneFlipHold: source.event });
  ctx.phase = 5;
  assert.equal(quoteAutomaticAdvisorFlips(ctx).some((entry) => entry.territory === 'imperial_basin'), false);
  ctx.players[0].forces = { 'hagga_basin:12': 3 };
  ctx.players[0].advisors = { ...ctx.players[0].advisors, hagga_basin: { lockedTurn: 4 } };
  assert.equal(advisorStanceAfterSettlement(ctx, 'b', 'imperial_basin'), undefined);
  assert.equal(advisorStanceAfterSettlement(ctx, 'b', 'hagga_basin'), undefined);
  assert.deepEqual(quoteAutomaticAdvisorFlips(ctx), [
    { player: 'b', territory: 'hagga_basin', forces: { 'hagga_basin:12': 3 } },
  ]);
});

void test('a concealed No-Field supplies public occupation without exposing its physical identity or printed value', () => {
  const { ctx } = held();
  ctx.players[2].noField = { deployed: { location: { territory: 'imperial_basin', sector: 9 } } };
  Object.defineProperty(ctx.players[2].noField, 'tokens', {
    get() { throw new Error('Automatic conversion read No-Field inventory'); },
  });
  Object.defineProperty(ctx.players[2].noField.deployed, 'value', {
    get() { throw new Error('Automatic conversion read No-Field value'); },
  });
  assert.deepEqual(advisorStanceAfterSettlement(ctx, 'b', 'imperial_basin'), { lockedTurn: 4 });
  assert.equal(quoteAutomaticAdvisorFlips(ctx).some((entry) => entry.territory === 'imperial_basin'), false);
});

void test('the response validates its original held event and exact physical group regardless of map insertion order', () => {
  const { ctx, source } = held();
  const before = structuredClone({ ctx, source });
  assert.doesNotThrow(() => validateAutomaticAdvisorFlip(ctx, source));
  assert.doesNotThrow(() => validateAutomaticAdvisorFlip(ctx, {
    ...source, forces: { 'imperial_basin:10': 1, 'imperial_basin:9': 2 },
  }));
  assert.deepEqual({ ctx, source }, before);
  delete ctx.players[0].advisors;
  assert.throws(() => validateAutomaticAdvisorFlip(ctx, source), AutomaticAdvisorFlipError);
});

void test('changed window, owner, occurrence, group, occupation and movement sources throw the named rule error', () => {
  const changes: ((ctx: AutomaticAdvisorFlipContext, source: AutomaticAdvisorFlipSource) => void)[] = [
    (ctx) => { ctx.advanced = false; },
    (ctx) => { ctx.status = 'lobby'; },
    (ctx) => { ctx.phase = 4; },
    (ctx) => { ctx.turn++; },
    (_ctx, source) => { source.phase = 4; },
    (_ctx, source) => { source.owner = 'a'; },
    (_ctx, source) => { source.owner = 'missing'; },
    (_ctx, source) => { source.territory = 'arrakeen'; },
    (_ctx, source) => { source.event = 'other-occurrence'; },
    (ctx) => { ctx.players[0].advisors = { imperial_basin: { aloneFlipHold: 'other-occurrence' } }; },
    (ctx) => { ctx.players[0].forces = { 'imperial_basin:9': 3 }; },
    (ctx) => { ctx.players[0].forces = {}; },
    (ctx) => { ctx.players[1].forces = { 'imperial_basin:11': 1 }; },
    (ctx) => { ctx.players[2].noField = { deployed: { location: { territory: 'imperial_basin', sector: 10 } } }; },
    (_ctx, source) => { source.forces = {}; },
    (_ctx, source) => { source.forces = { 'imperial_basin:9': 2 }; },
    (_ctx, source) => { source.forces['imperial_basin:9'] = 1; },
    (_ctx, source) => { source.forces['arrakeen:10'] = 1; },
    (_ctx, source) => { source.forces['imperial_basin:9'] = 0; },
    (_ctx, source) => { source.forces['imperial_basin:9'] = 1.5; },
    (_ctx, source) => { source.move = 0; },
    (_ctx, source) => { source.move = 2; },
    (_ctx, source) => { source.mover = 'missing'; },
    (ctx) => { ctx.players[1].moved = 2; },
    (ctx) => { delete ctx.players[1].moved; },
    (_ctx, source) => { (source as { producer: string }).producer = 'shipment'; },
  ];
  for (const change of changes) {
    const { ctx, source } = held();
    change(ctx, source);
    const before = structuredClone({ ctx, source });
    assert.throws(() => validateAutomaticAdvisorFlip(ctx, source), (error: unknown) =>
      error instanceof AutomaticAdvisorFlipError && error.name === 'AutomaticAdvisorFlipError');
    assert.deepEqual({ ctx, source }, before);
  }
  const { ctx, source } = held();
  for (const malformed of [null, [], { ...source, extra: true }, { ...source, forces: null }, { ...source, event: '' }]) {
    assert.throws(() => validateAutomaticAdvisorFlip(ctx, malformed as AutomaticAdvisorFlipSource), AutomaticAdvisorFlipError);
  }
});

void test('quotes, settlement and response matching do not inspect private cards, leaders or spice', () => {
  const { ctx, source } = held();
  const before = ctx.players.map((player) => structuredClone({ forces: player.forces, advisors: player.advisors }));
  for (const player of ctx.players) {
    for (const field of ['hand', 'leaders', 'spice', 'traitors', 'faceDancers']) {
      Object.defineProperty(player, field, {
        get() { throw new Error(`Automatic advisor rule read ${player.id} private ${field}`); },
      });
    }
  }
  assert.equal(quoteAutomaticAdvisorFlips(ctx).some((entry) => entry.territory === 'arrakeen'), true);
  assert.deepEqual(advisorStanceAfterSettlement({ advanced: ctx.advanced, players: ctx.players }, 'b', 'imperial_basin'), {
    lockedTurn: 4, aloneFlipHold: source.event,
  });
  assert.doesNotThrow(() => validateAutomaticAdvisorFlip(ctx, source));
  assert.deepEqual(ctx.players.map((player) => ({ forces: player.forces, advisors: player.advisors })), before);
});
