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
  type AutomaticAdvisorTransport,
  type AutomaticAdvisorGamont,
  type AutomaticAdvisorBattle,
  type AutomaticAdvisorHomeworldTransport,
} from '../game/advisor-automatic-flip';
import { MOBILE_LOCATION, MOBILE_STRONGHOLD } from '../game/board';

type GroundSource = Extract<AutomaticAdvisorFlipSource, { producer: 'groundMovement' }>;
type TransportSource = Extract<AutomaticAdvisorFlipSource, { producer: 'guildTransport' }>;
type GamontSource = Extract<AutomaticAdvisorFlipSource, { producer: 'gamont' }>;
type BattleSource = Extract<AutomaticAdvisorFlipSource, { producer: 'battleLosses' }>;
type HomeworldSource = Extract<AutomaticAdvisorFlipSource, { producer: 'homeworldTransport' }>;

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
  const source: GroundSource = {
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
    { advanced: false }, { status: 'lobby' }, { phase: 0 }, { phase: 4 }, { phase: 7 },
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
  const changes: ((ctx: AutomaticAdvisorFlipContext, source: GroundSource) => void)[] = [
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

function transported(to: 'carthag' | 'reserves' = 'carthag') {
  const { ctx, source: ground } = held();
  const transport: AutomaticAdvisorTransport = {
    event: 'committed-native-guild-transport', player: 'a', origin: 'imperial_basin',
    to, sector: to === 'reserves' ? 0 : 11, amount: 3, elite: 0,
    group: { 'imperial_basin:9': 2, 'imperial_basin:10': 1 },
  };
  ctx.players[1].shipped = true;
  ctx.players[1].forces = to === 'reserves' ? {} : { 'carthag:11': 3 };
  ctx.players[1].reserves = to === 'reserves' ? 3 : 0;
  const source: TransportSource = {
    event: 'automatic-after-original-guild-transport', owner: ground.owner,
    territory: ground.territory, turn: ground.turn, phase: ground.phase,
    forces: ground.forces, producer: 'guildTransport', transport,
  };
  ctx.players[0].advisors = {
    ...ctx.players[0].advisors,
    imperial_basin: { lockedTurn: 4, aloneFlipHold: source.event },
  };
  return { ctx, source };
}

void test('committed cross-transport and reserve return bind the same held advisor origin and physical deposit', () => {
  for (const destination of ['carthag', 'reserves'] as const) {
    const { ctx, source } = transported(destination);
    const before = structuredClone({ ctx, source });
    assert.doesNotThrow(() => validateAutomaticAdvisorFlip(ctx, source));
    assert.deepEqual({ ctx, source }, before);
    assert.deepEqual(Object.keys(source).sort(), ['event', 'forces', 'owner', 'phase', 'producer', 'territory', 'transport', 'turn']);
    assert.deepEqual(advisorStanceAfterSettlement({ advanced: true, players: ctx.players }, 'b', 'imperial_basin'), {
      lockedTurn: 4, aloneFlipHold: source.event,
    });
  }
});

void test('a native BG transported advisor arrival can bind its destination group without imposing a Guild-faction actor', () => {
  const { ctx, source } = transported();
  source.transport = {
    event: 'committed-bg-cross-transport', player: 'b', origin: 'hagga_basin',
    to: 'imperial_basin', sector: 9, amount: 2, elite: 0, group: { 'hagga_basin:12': 2 },
  };
  ctx.players[0].shipped = true;
  assert.doesNotThrow(() => validateAutomaticAdvisorFlip(ctx, source));
  source.transport.sector = 10;
  assert.throws(() => validateAutomaticAdvisorFlip(ctx, source), AutomaticAdvisorFlipError);
});

void test('transport metadata uses current board identities and rejects unplaced dynamic destinations', () => {
  const { ctx, source } = transported();
  source.transport.to = MOBILE_STRONGHOLD;
  source.transport.sector = 0;
  ctx.players[1].forces = { [MOBILE_LOCATION]: 3 };
  assert.throws(() => validateAutomaticAdvisorFlip(ctx, source), AutomaticAdvisorFlipError);
  ctx.mobileStronghold = { location: 'imperial_basin:9' };
  assert.doesNotThrow(() => validateAutomaticAdvisorFlip(ctx, source));
  ctx.mobileStronghold.location = null;
  assert.throws(() => validateAutomaticAdvisorFlip(ctx, source), AutomaticAdvisorFlipError);
});

void test('changed transport metadata, selected group, native slot, deposit or response location rejects before settlement', () => {
  const changes: ((ctx: AutomaticAdvisorFlipContext, source: TransportSource) => void)[] = [
    (_ctx, source) => { source.transport.event = ''; },
    (_ctx, source) => { source.transport.player = ''; },
    (_ctx, source) => { source.transport.player = 'missing'; },
    (_ctx, source) => { source.transport.origin = 'missing'; },
    (_ctx, source) => { source.transport.to = 'missing'; },
    (_ctx, source) => { source.transport.sector = -1; },
    (_ctx, source) => { source.transport.sector = 11.5; },
    (_ctx, source) => { source.transport.sector = 12; },
    (_ctx, source) => { source.transport.amount = 0; },
    (_ctx, source) => { source.transport.amount = 4; },
    (_ctx, source) => { source.transport.elite = -1; },
    (_ctx, source) => { source.transport.elite = 4; },
    (_ctx, source) => { source.transport.elite = 1.5; },
    (_ctx, source) => { source.transport.group = {}; },
    (_ctx, source) => { source.transport.group = { 'imperial_basin:9': 3.5 }; },
    (_ctx, source) => { source.transport.group = { 'imperial_basin:9': 3, 'imperial_basin:10': 0 }; },
    (_ctx, source) => { source.transport.group = { 'carthag:11': 3 }; },
    (_ctx, source) => { source.transport.group = { 'imperial_basin:8': 3 }; },
    (_ctx, source) => { source.transport.group = { 'imperial_basin:9.0': 3 }; },
    (_ctx, source) => {
      source.transport.origin = 'arrakeen';
      source.transport.group = { 'arrakeen:10': 3 };
    },
    (ctx) => { ctx.players[1].shipped = false; },
    (ctx) => { delete ctx.players[1].shipped; },
    (ctx) => { ctx.players[1].forces = { 'carthag:11': 2 }; },
    (ctx) => { ctx.players[1].forces = { 'carthag:10': 3 }; },
    (ctx) => { ctx.players = [...ctx.players, { ...ctx.players[1] }]; },
    (_ctx, source) => { source.forces = { 'imperial_basin:9': 3 }; },
  ];
  for (const change of changes) {
    const { ctx, source } = transported();
    change(ctx, source);
    const before = structuredClone({ ctx, source });
    assert.throws(() => validateAutomaticAdvisorFlip(ctx, source), AutomaticAdvisorFlipError);
    assert.deepEqual({ ctx, source }, before);
  }
  const { ctx, source } = transported('reserves');
  ctx.players[1].reserves = 2;
  assert.throws(() => validateAutomaticAdvisorFlip(ctx, source), AutomaticAdvisorFlipError);
  delete ctx.players[1].reserves;
  assert.throws(() => validateAutomaticAdvisorFlip(ctx, source), AutomaticAdvisorFlipError);
  for (const malformed of [
    { ...source, mover: 'a' },
    { ...source, transport: null },
    { ...source, transport: { ...source.transport, paid: 1 } },
    { ...source, transport: { ...source.transport, group: null } },
  ]) {
    assert.throws(() => validateAutomaticAdvisorFlip(ctx, malformed as AutomaticAdvisorFlipSource), AutomaticAdvisorFlipError);
  }
});

void test('old ground receipts keep their exact JSON shape and never require transport slot or reserve metadata', () => {
  const { ctx, source } = held();
  for (const player of ctx.players) {
    for (const field of ['shipped', 'reserves']) {
      Object.defineProperty(player, field, {
        get() { throw new Error(`Ground source read transport-only ${field}`); },
      });
    }
  }
  const saved = JSON.parse(JSON.stringify(source)) as GroundSource;
  assert.deepEqual(Object.keys(saved).sort(), ['event', 'forces', 'move', 'mover', 'owner', 'phase', 'producer', 'territory', 'turn']);
  assert.doesNotThrow(() => validateAutomaticAdvisorFlip(ctx, saved));
  assert.throws(() => validateAutomaticAdvisorFlip(ctx, { ...saved, transport: {} } as AutomaticAdvisorFlipSource), AutomaticAdvisorFlipError);
});

void test('transport validation reads only public slot and physical deposit metadata, not wallets, cards or leaders', () => {
  for (const destination of ['carthag', 'reserves'] as const) {
    const { ctx, source } = transported(destination);
    for (const player of ctx.players) {
      for (const field of ['hand', 'leaders', 'spice', 'traitors', 'faceDancers']) {
        Object.defineProperty(player, field, {
          get() { throw new Error(`Transport advisor rule read ${player.id} private ${field}`); },
        });
      }
    }
    assert.doesNotThrow(() => validateAutomaticAdvisorFlip(ctx, source));
  }
});

function gamont(returned = true, mentat = false) {
  const { ctx, source: ground } = held();
  ctx.phase = 8;
  ctx.players[1].faction = 'choam';
  ctx.players[2].reserves = returned ? 1 : 0;
  ctx.players[2].noField = { deployed: null };
  const receipt: AutomaticAdvisorGamont = {
    event: 'completed-trip-to-gamont', player: 'a', target: 'r',
    location: 'imperial_basin:9', elite: 0, returned, mentat,
  };
  const source: GamontSource = {
    event: 'automatic-after-completed-gamont', owner: ground.owner,
    territory: ground.territory, turn: ground.turn, phase: 8,
    forces: ground.forces, producer: 'gamont', gamont: receipt,
  };
  ctx.players[0].advisors = {
    ...ctx.players[0].advisors,
    imperial_basin: { lockedTurn: 4, aloneFlipHold: source.event },
  };
  if (mentat) ctx.choamMentatPending = true;
  return { ctx, source };
}

void test('phase-eight public groups can be quoted and Gamont validates with a real return or an empty No-Field reveal', () => {
  const quiet = context();
  quiet.phase = 8;
  const before = structuredClone(quiet);
  assert.equal(quoteAutomaticAdvisorFlips(quiet).some((entry) => entry.territory === 'imperial_basin'), true);
  assert.deepEqual(quiet, before);
  for (const returned of [false, true]) {
    const { ctx, source } = gamont(returned);
    const original = structuredClone({ ctx, source });
    assert.deepEqual(ctx.players[2].forces, {});
    assert.doesNotThrow(() => validateAutomaticAdvisorFlip(ctx, source));
    assert.deepEqual({ ctx, source }, original);
    assert.deepEqual(Object.keys(source).sort(), ['event', 'forces', 'gamont', 'owner', 'phase', 'producer', 'territory', 'turn']);
    assert.deepEqual(Object.keys(source.gamont).sort(), ['elite', 'event', 'location', 'mentat', 'player', 'returned', 'target']);
  }
});

void test('only a final Gamont receipt requires the still-open native CHOAM Mentat flag', () => {
  const { ctx, source } = gamont(true, true);
  assert.doesNotThrow(() => validateAutomaticAdvisorFlip(ctx, source));
  ctx.choamMentatPending = false;
  assert.throws(() => validateAutomaticAdvisorFlip(ctx, source), AutomaticAdvisorFlipError);
  delete ctx.choamMentatPending;
  assert.throws(() => validateAutomaticAdvisorFlip(ctx, source), AutomaticAdvisorFlipError);
  source.gamont.mentat = false;
  assert.doesNotThrow(() => validateAutomaticAdvisorFlip(ctx, source));
});

void test('Gamont metadata binds native CHOAM, the distinct target, current location, outcome and exact held group', () => {
  const changes: ((ctx: AutomaticAdvisorFlipContext, source: GamontSource) => void)[] = [
    (ctx) => { ctx.advanced = false; },
    (ctx) => { ctx.status = 'lobby'; },
    (ctx) => { ctx.turn++; },
    (_ctx, source) => { source.gamont.event = ''; },
    (_ctx, source) => { source.gamont.player = 'missing'; },
    (ctx) => { ctx.players[1].faction = 'atreides'; },
    (ctx) => { ctx.players = [...ctx.players, { ...ctx.players[1] }]; },
    (_ctx, source) => { source.gamont.target = source.gamont.player; },
    (_ctx, source) => { source.gamont.target = 'missing'; },
    (ctx) => { ctx.players = [...ctx.players, { ...ctx.players[2] }]; },
    (_ctx, source) => { source.gamont.location = 'missing:0'; },
    (_ctx, source) => { source.gamont.location = 'imperial_basin:8'; },
    (_ctx, source) => { source.gamont.location = 'imperial_basin:9.0'; },
    (_ctx, source) => { source.gamont.location = 'arrakeen:10'; },
    (_ctx, source) => { source.gamont.elite = -1; },
    (_ctx, source) => { source.gamont.elite = 2; },
    (_ctx, source) => { source.gamont.elite = 0.5; },
    (ctx) => { ctx.players[2].reserves = 0; },
    (ctx) => { delete ctx.players[2].reserves; },
    (_ctx, source) => { source.forces = { 'imperial_basin:9': 3 }; },
    (ctx) => { ctx.players[2].forces = { 'imperial_basin:10': 1 }; },
    (ctx) => { ctx.players[0].advisors = { imperial_basin: { aloneFlipHold: 'another-event' } }; },
  ];
  for (const change of changes) {
    const { ctx, source } = gamont();
    change(ctx, source);
    const before = structuredClone({ ctx, source });
    assert.throws(() => validateAutomaticAdvisorFlip(ctx, source), AutomaticAdvisorFlipError);
    assert.deepEqual({ ctx, source }, before);
  }
  const { ctx, source } = gamont();
  source.gamont.elite = 1;
  assert.doesNotThrow(() => validateAutomaticAdvisorFlip(ctx, source));
  for (const malformed of [
    { ...source, gamont: null },
    { ...source, gamont: { ...source.gamont, returned: 'yes' } },
    { ...source, gamont: { ...source.gamont, mentat: 1 } },
    { ...source, gamont: { ...source.gamont, elite: '1' } },
  ]) {
    assert.throws(() => validateAutomaticAdvisorFlip(ctx, malformed as unknown as AutomaticAdvisorFlipSource), AutomaticAdvisorFlipError);
  }
});

void test('private Gamont fuel and Nexus identifiers are rejected in either public source layer', () => {
  const { ctx, source } = gamont();
  for (const malformed of [
    { ...source, card: 'private-fuel-card' },
    { ...source, fuel: 'private-fuel-card' },
    { ...source, nexusEvent: 'private-nexus-event' },
    { ...source, gamont: { ...source.gamont, card: 'private-fuel-card' } },
    { ...source, gamont: { ...source.gamont, fuel: 'private-fuel-card' } },
    { ...source, gamont: { ...source.gamont, nexusEvent: 'private-nexus-event' } },
  ]) {
    assert.throws(() => validateAutomaticAdvisorFlip(ctx, malformed as AutomaticAdvisorFlipSource), AutomaticAdvisorFlipError);
  }
});

void test('producer phases stay distinct while the original ground and transport receipts remain accepted in phase five', () => {
  for (const original of [held(), transported()]) {
    const before = JSON.stringify(original.source);
    assert.doesNotThrow(() => validateAutomaticAdvisorFlip(original.ctx, original.source));
    assert.equal(JSON.stringify(original.source), before);
    original.ctx.phase = 8;
    assert.throws(() => validateAutomaticAdvisorFlip(original.ctx, original.source), AutomaticAdvisorFlipError);
    original.source.phase = 8;
    assert.throws(() => validateAutomaticAdvisorFlip(original.ctx, original.source), AutomaticAdvisorFlipError);
  }
  const { ctx, source } = gamont();
  ctx.phase = 5;
  source.phase = 5;
  assert.throws(() => validateAutomaticAdvisorFlip(ctx, source), AutomaticAdvisorFlipError);
});

void test('post-Gamont validation does not ask for prior availability, a remaining target counter or private fuel', () => {
  const { ctx, source } = gamont(false);
  for (const player of ctx.players) {
    for (const field of ['hand', 'leaders', 'spice', 'traitors', 'faceDancers', 'moved', 'shipped', 'gamontAvailable']) {
      Object.defineProperty(player, field, {
        get() { throw new Error(`Gamont advisor rule read ${player.id} ${field}`); },
      });
    }
  }
  for (const field of ['gamontAvailable', 'pendingAutomaticAdvisorGamont', 'choamMentatPending']) {
    Object.defineProperty(ctx, field, {
      get() { throw new Error(`Gamont advisor rule read private or prior ${field}`); },
    });
  }
  Object.defineProperty(ctx.players[2], 'reserves', {
    get() { throw new Error('An empty No-Field reveal has no returned counter to validate'); },
  });
  assert.deepEqual(ctx.players[2].forces, {});
  assert.doesNotThrow(() => validateAutomaticAdvisorFlip(ctx, source));
});

function battleResult(result: AutomaticAdvisorBattle['result'] = 'normal') {
  const { ctx, source: ground } = held();
  ctx.phase = 6;
  ctx.battle = null;
  ctx.players[1].forces = {};
  ctx.players[2].forces = {};
  const receipt: AutomaticAdvisorBattle = {
    event: 'original-resolved-battle', turn: ctx.turn, territory: 'imperial_basin',
    combatants: ['a', 'r'], winner: result === 'normal' || result === 'traitor' ? 'a' : null, result,
  };
  ctx.lastBattleContext = { ...receipt, combatants: [...receipt.combatants] };
  const source: BattleSource = {
    event: 'automatic-after-original-battle-losses', owner: ground.owner,
    territory: ground.territory, turn: ground.turn, phase: 6,
    forces: ground.forces, producer: 'battleLosses', battle: receipt,
  };
  ctx.players[0].advisors = {
    ...ctx.players[0].advisors,
    imperial_basin: { lockedTurn: 4, aloneFlipHold: source.event },
  };
  return { ctx, source };
}

void test('phase-six quotes and exact public resolved battle receipts retain a physically nonempty BG bystander group', () => {
  const quiet = context();
  quiet.phase = 6;
  const original = structuredClone(quiet);
  assert.equal(quoteAutomaticAdvisorFlips(quiet).some((entry) => entry.territory === 'imperial_basin'), true);
  assert.deepEqual(quiet, original);
  for (const result of ['normal', 'traitor', 'mutualTraitors'] as const) {
    const { ctx, source } = battleResult(result);
    const before = structuredClone({ ctx, source });
    assert.doesNotThrow(() => validateAutomaticAdvisorFlip(ctx, source));
    assert.deepEqual({ ctx, source }, before);
    assert.deepEqual(Object.keys(source).sort(), ['battle', 'event', 'forces', 'owner', 'phase', 'producer', 'territory', 'turn']);
    assert.deepEqual(Object.keys(source.battle).sort(), ['combatants', 'event', 'result', 'territory', 'turn', 'winner']);
  }
});

void test('a stale battle event, turn, winner, participant, location or active battle cannot settle the held source', () => {
  const changes: ((ctx: AutomaticAdvisorFlipContext, source: BattleSource) => void)[] = [
    (ctx) => { ctx.advanced = false; },
    (ctx) => { ctx.status = 'lobby'; },
    (ctx) => { ctx.turn++; },
    (ctx) => { ctx.battle = {}; },
    (ctx) => { ctx.lastBattleContext = null; },
    (ctx) => { delete ctx.lastBattleContext; },
    (ctx) => { ctx.lastBattleContext!.event = 'changed-battle'; },
    (ctx) => { ctx.lastBattleContext!.turn++; },
    (ctx) => { ctx.lastBattleContext!.territory = 'arrakeen'; },
    (ctx) => { ctx.lastBattleContext!.winner = 'r'; },
    (ctx) => { ctx.lastBattleContext!.result = 'traitor'; },
    (_ctx, source) => { source.battle.event = 'stale-battle'; },
    (_ctx, source) => { source.battle.turn++; },
    (_ctx, source) => { source.battle.territory = 'arrakeen'; },
    (_ctx, source) => { source.battle.territory = 'missing'; },
    (_ctx, source) => { source.battle.combatants = ['a', 'a']; },
    (_ctx, source) => { source.battle.combatants = ['a', 'missing']; },
    (_ctx, source) => { source.battle.combatants.reverse(); },
    (_ctx, source) => { source.battle.winner = null; },
    (_ctx, source) => { source.battle.winner = 'b'; },
    (_ctx, source) => { source.battle.result = 'mutualTraitors'; },
    (_ctx, source) => { source.battle.result = 'explosion'; },
    (ctx) => { ctx.players = [...ctx.players, { ...ctx.players[1] }]; },
    (ctx) => { ctx.players[1].forces = { 'imperial_basin:9': 1 }; },
    (_ctx, source) => { source.forces = { 'imperial_basin:9': 3 }; },
  ];
  for (const change of changes) {
    const { ctx, source } = battleResult();
    change(ctx, source);
    const before = structuredClone({ ctx, source });
    assert.throws(() => validateAutomaticAdvisorFlip(ctx, source), AutomaticAdvisorFlipError);
    assert.deepEqual({ ctx, source }, before);
  }
  const { ctx, source } = battleResult();
  for (const malformed of [
    { ...source, battle: null },
    { ...source, battle: { ...source.battle, result: 'legacy' } },
    { ...source, battle: { ...source.battle, winner: 1 } },
    { ...source, battle: { ...source.battle, combatants: ['a'] } },
    { ...source, battle: { ...source.battle, combatants: ['a', 'r', 'b'] } },
  ]) {
    assert.throws(() => validateAutomaticAdvisorFlip(ctx, malformed as unknown as AutomaticAdvisorFlipSource), AutomaticAdvisorFlipError);
  }
});

void test('a BG combatant or an explosion with no remaining physical advisor group has no valid bystander conversion', () => {
  const combatant = battleResult();
  combatant.source.battle.combatants = ['b', 'r'];
  combatant.source.battle.winner = 'r';
  combatant.ctx.lastBattleContext = { ...combatant.source.battle, combatants: ['b', 'r'] };
  assert.throws(() => validateAutomaticAdvisorFlip(combatant.ctx, combatant.source), AutomaticAdvisorFlipError);
  const exploded = battleResult('explosion');
  assert.equal(exploded.source.battle.winner, null);
  for (const player of exploded.ctx.players) player.forces = {};
  assert.deepEqual(quoteAutomaticAdvisorFlips(exploded.ctx), []);
  assert.throws(() => validateAutomaticAdvisorFlip(exploded.ctx, exploded.source), AutomaticAdvisorFlipError);
});

void test('battle source and receipt layers reject private cards, skills, casualty choices and continuation payloads', () => {
  const { ctx, source } = battleResult();
  for (const field of ['cards', 'skills', 'casualtyChoices', 'continuation']) {
    for (const malformed of [
      { ...source, [field]: 'private-payload' },
      { ...source, battle: { ...source.battle, [field]: 'private-payload' } },
    ]) {
      assert.throws(() => validateAutomaticAdvisorFlip(ctx, malformed as AutomaticAdvisorFlipSource), AutomaticAdvisorFlipError);
    }
  }
});

void test('phase-six battle conversion does not widen the old movement, transport or Gamont producer windows', () => {
  for (const original of [held(), transported(), gamont(false)]) {
    const before = JSON.stringify(original.source);
    assert.doesNotThrow(() => validateAutomaticAdvisorFlip(original.ctx, original.source));
    assert.equal(JSON.stringify(original.source), before);
    original.ctx.phase = 6;
    original.source.phase = 6;
    assert.throws(() => validateAutomaticAdvisorFlip(original.ctx, original.source), AutomaticAdvisorFlipError);
  }
  for (const phase of [5, 8]) {
    const { ctx, source } = battleResult();
    ctx.phase = phase;
    source.phase = phase;
    assert.throws(() => validateAutomaticAdvisorFlip(ctx, source), AutomaticAdvisorFlipError);
  }
});

void test('battle validation reads only its six public context fields and the current physical group', () => {
  const { ctx, source } = battleResult();
  for (const player of ctx.players) {
    for (const field of ['hand', 'leaders', 'spice', 'traitors', 'faceDancers', 'moved', 'shipped', 'reserves']) {
      Object.defineProperty(player, field, {
        get() { throw new Error(`Battle advisor rule read ${player.id} private or unrelated ${field}`); },
      });
    }
  }
  for (const field of ['cardRoles', 'mandatoryDiscard', 'winnerDiscards', 'skills', 'casualtyChoices', 'continuation']) {
    Object.defineProperty(ctx.lastBattleContext, field, {
      enumerable: true,
      get() { throw new Error(`Battle advisor rule read private context ${field}`); },
    });
  }
  assert.doesNotThrow(() => validateAutomaticAdvisorFlip(ctx, source));
  ctx.battle = false;
  assert.doesNotThrow(() => validateAutomaticAdvisorFlip(ctx, source));
});

function homeworldTransport(
  kind: AutomaticAdvisorHomeworldTransport['kind'] = 'native',
  destination = 'homeworld:richese',
) {
  const { ctx, source: ground } = held();
  ctx.homeworlds = { custody: { visitors: {}, salusa: null } };
  ctx.players[1].faction = kind === 'native' ? 'guild' : 'atreides';
  ctx.players[1].shipped = true;
  ctx.players[1].forces = destination.startsWith('homeworld:') ? {} : { [destination]: 3 };
  if (kind === 'junction') ctx.players = [...ctx.players, { id: 'g', faction: 'guild', forces: {} }];
  const transport: AutomaticAdvisorHomeworldTransport = {
    event: 'fresh-public-homeworld-transport-event', kind, player: 'a', origin: 'imperial_basin',
    destination, amount: 3, elite: 0, group: { 'imperial_basin:9': 2, 'imperial_basin:10': 1 },
  };
  const source: HomeworldSource = {
    event: 'automatic-after-original-homeworld-transport', owner: ground.owner,
    territory: ground.territory, turn: ground.turn, phase: 5,
    forces: ground.forces, producer: 'homeworldTransport', transport,
  };
  ctx.players[0].advisors = {
    ...ctx.players[0].advisors,
    imperial_basin: { lockedTurn: 4, aloneFlipHold: source.event },
  };
  return { ctx, source };
}

void test('native Guild and Junction Homeworld transports retain exact public source shapes and current native destinations', () => {
  for (const original of [
    homeworldTransport(), homeworldTransport('native', 'homeworld:guild'),
    homeworldTransport('junction'), homeworldTransport('junction', 'carthag:11'),
  ]) {
    const before = structuredClone(original);
    assert.doesNotThrow(() => validateAutomaticAdvisorFlip(original.ctx, original.source));
    assert.deepEqual(original, before);
    assert.deepEqual(Object.keys(original.source).sort(), ['event', 'forces', 'owner', 'phase', 'producer', 'territory', 'transport', 'turn']);
    assert.deepEqual(Object.keys(original.source.transport).sort(), ['amount', 'destination', 'elite', 'event', 'group', 'kind', 'origin', 'player']);
  }
  const salusa = homeworldTransport('junction', 'homeworld:emperor:salusa');
  assert.throws(() => validateAutomaticAdvisorFlip(salusa.ctx, salusa.source), AutomaticAdvisorFlipError);
  salusa.ctx.players = [...salusa.ctx.players, { id: 'e', faction: 'emperor', forces: {} }];
  assert.doesNotThrow(() => validateAutomaticAdvisorFlip(salusa.ctx, salusa.source));
});

void test('a Junction BG advisor arrival binds the actual destination group and deposited physical board counters', () => {
  const { ctx, source } = homeworldTransport('junction', 'imperial_basin:9');
  ctx.players[1].forces = {};
  ctx.players[0].shipped = true;
  source.transport.player = 'b';
  source.transport.origin = 'hagga_basin';
  source.transport.group = { 'hagga_basin:12': 2 };
  source.transport.amount = 2;
  assert.doesNotThrow(() => validateAutomaticAdvisorFlip(ctx, source));
  source.transport.destination = 'imperial_basin:10';
  assert.throws(() => validateAutomaticAdvisorFlip(ctx, source), AutomaticAdvisorFlipError);
  const departed = homeworldTransport('junction', 'carthag:11');
  departed.ctx.players[1].forces = { 'carthag:11': 2 };
  assert.throws(() => validateAutomaticAdvisorFlip(departed.ctx, departed.source), AutomaticAdvisorFlipError);
});

void test('Homeworld transport rejects malformed metadata, missing native permissions, current locations and changed held groups', () => {
  const changes: ((ctx: AutomaticAdvisorFlipContext, source: HomeworldSource) => void)[] = [
    (_ctx, source) => { source.transport.event = ''; },
    (_ctx, source) => { source.transport.player = 'missing'; },
    (_ctx, source) => { source.transport.origin = 'missing'; },
    (_ctx, source) => { source.transport.destination = 'homeworld:emperor'; },
    (_ctx, source) => { source.transport.destination = 'reserves'; },
    (_ctx, source) => { source.transport.destination = 'carthag:11'; },
    (_ctx, source) => { source.transport.amount = 0; },
    (_ctx, source) => { source.transport.amount = 2; },
    (_ctx, source) => { source.transport.elite = -1; },
    (_ctx, source) => { source.transport.elite = 4; },
    (_ctx, source) => { source.transport.elite = 1.5; },
    (_ctx, source) => { source.transport.group = {}; },
    (_ctx, source) => { source.transport.group = { 'carthag:11': 3 }; },
    (_ctx, source) => { source.transport.group = { 'imperial_basin:9': 3.5 }; },
    (_ctx, source) => { source.transport.group = { 'imperial_basin:9': 3, 'imperial_basin:10': 0 }; },
    (_ctx, source) => { source.transport.group = { 'imperial_basin:8': 3 }; },
    (_ctx, source) => { source.transport.group = { 'imperial_basin:9.0': 3 }; },
    (_ctx, source) => {
      source.transport.origin = 'hagga_basin';
      source.transport.group = { 'hagga_basin:12': 3 };
    },
    (ctx) => { ctx.players[1].faction = 'atreides'; },
    (ctx) => { ctx.players[1].shipped = false; },
    (ctx) => { delete ctx.players[1].shipped; },
    (ctx) => { ctx.players = [...ctx.players, { ...ctx.players[1] }]; },
    (_ctx, source) => { source.forces = { 'imperial_basin:9': 3 }; },
  ];
  for (const change of changes) {
    const original = homeworldTransport();
    change(original.ctx, original.source);
    const before = structuredClone(original);
    assert.throws(() => validateAutomaticAdvisorFlip(original.ctx, original.source), AutomaticAdvisorFlipError);
    assert.deepEqual(original, before);
  }
  const junction = homeworldTransport('junction', 'carthag:11');
  junction.ctx.players = junction.ctx.players.filter((player) => player.faction !== 'guild');
  assert.throws(() => validateAutomaticAdvisorFlip(junction.ctx, junction.source), AutomaticAdvisorFlipError);
  for (const destination of ['carthag', 'carthag:10', 'carthag:11.0', 'homeworld:emperor:salusa']) {
    const invalid = homeworldTransport('junction', destination);
    assert.throws(() => validateAutomaticAdvisorFlip(invalid.ctx, invalid.source), AutomaticAdvisorFlipError);
  }
  for (const homeworldState of [undefined, null, [], false, 'homeworlds', {}, { custody: null }, { custody: [] }]) {
    const original = homeworldTransport();
    original.ctx.homeworlds = homeworldState;
    assert.throws(() => validateAutomaticAdvisorFlip(original.ctx, original.source), AutomaticAdvisorFlipError);
  }
});

void test('Homeworld source receipts reject private original events and stale producer payloads at both layers', () => {
  const { ctx, source } = homeworldTransport();
  for (const field of ['homeworldShipmentEvent', 'card', 'nexusEvent', 'funds', 'permission']) {
    for (const malformed of [
      { ...source, [field]: 'private-original-state' },
      { ...source, transport: { ...source.transport, [field]: 'private-original-state' } },
    ]) {
      assert.throws(() => validateAutomaticAdvisorFlip(ctx, malformed as AutomaticAdvisorFlipSource), AutomaticAdvisorFlipError);
    }
  }
  for (const malformed of [
    { ...source, transport: null },
    { ...source, transport: { ...source.transport, kind: 'guild' } },
    { ...source, transport: { ...source.transport, group: null } },
    { ...source, transport: transported().source.transport },
  ]) {
    assert.throws(() => validateAutomaticAdvisorFlip(ctx, malformed as unknown as AutomaticAdvisorFlipSource), AutomaticAdvisorFlipError);
  }
});

void test('Homeworld transport stays phase-five-only and leaves all earlier producer receipt shapes and windows unchanged', () => {
  for (const original of [held(), transported(), gamont(false), battleResult()]) {
    const before = JSON.stringify(original.source);
    assert.doesNotThrow(() => validateAutomaticAdvisorFlip(original.ctx, original.source));
    assert.equal(JSON.stringify(original.source), before);
  }
  for (const phase of [4, 6, 8]) {
    const { ctx, source } = homeworldTransport();
    ctx.phase = phase;
    source.phase = phase;
    assert.throws(() => validateAutomaticAdvisorFlip(ctx, source), AutomaticAdvisorFlipError);
  }
});

void test('Homeworld source validation never reads original shipment events, private module players or pretransfer funding', () => {
  for (const original of [homeworldTransport(), homeworldTransport('junction', 'carthag:11')]) {
    const custody = {};
    for (const field of ['visitors', 'salusa', 'players']) {
      Object.defineProperty(custody, field, {
        get() { throw new Error(`Advisor transport helper read delegated world custody ${field}`); },
      });
    }
    const homeworldState = { custody };
    Object.defineProperty(homeworldState, 'players', {
      get() { throw new Error('Advisor transport helper read private Homeworld players'); },
    });
    original.ctx.homeworlds = homeworldState;
    for (const field of ['homeworldShipmentEvent', 'pendingHomeworldShipment', 'pendingAutomaticAdvisorHomeworldTransport']) {
      Object.defineProperty(original.ctx, field, {
        get() { throw new Error(`Advisor transport helper read private parent ${field}`); },
      });
    }
    for (const player of original.ctx.players) {
      for (const field of ['hand', 'leaders', 'spice', 'traitors', 'faceDancers', 'reserves', 'pledged', 'guildTransportPermission']) {
        Object.defineProperty(player, field, {
          get() { throw new Error(`Advisor transport helper read ${player.id} private funding or custody ${field}`); },
        });
      }
    }
    assert.doesNotThrow(() => validateAutomaticAdvisorFlip(original.ctx, original.source));
  }
});
