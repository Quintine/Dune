import test from 'node:test';
import assert from 'node:assert/strict';
import {
  answerNexusFremenProtection,
  createNexusFremenProtection,
  currentNexusFremenProtectionOwner,
  validateNexusFremenProtection,
  type NexusFremenProtectionFrame,
  type NexusFremenProtectionInput,
  type NexusFremenProtectionPlayer,
} from '../game/nexus-fremen-protection';

const sparseOrder: string[] = [];
sparseOrder.length = 3;

/** Structural public data for the pure module, not a staged engine game. */
function occurrence(): NexusFremenProtectionInput {
  return {
    event: 'd6d3fb17-14e4-4a31-a717-c041a9b02d7c',
    turn: 3,
    territory: 'hagga_basin',
    origin: 'natural',
    pile: 0,
    index: 4,
    order: ['h', 'r', 'a'],
    players: [
      { id: 'a', faction: 'atreides', hasNexus: true, forces: { 'hagga_basin:12': 2 } },
      { id: 'h', faction: 'harkonnen', hasNexus: true, forces: { 'hagga_basin:13': 1 } },
      {
        id: 'r', faction: 'richese', hasNexus: true, forces: {},
        noField: { deployed: { location: { territory: 'hagga_basin', sector: 12 } } },
      },
    ],
  };
}

function created(input = occurrence()): NexusFremenProtectionFrame {
  const frame = createNexusFremenProtection(input);
  assert.ok(frame);
  return frame;
}

void test('public storm order includes only unallied threatened seats holding any Nexus', () => {
  const input = occurrence();
  const players: NexusFremenProtectionPlayer[] = [
    input.players[0],
    { ...input.players[1], ally: 'e' },
    input.players[2],
    { id: 'c', faction: 'choam', hasNexus: false, forces: { 'hagga_basin:12': 8 } },
    { id: 'e', faction: 'emperor', ally: 'h', hasNexus: true, forces: {} },
    { id: 'g', faction: 'guild', hasNexus: true, forces: { 'carthag:11': 3 } },
  ];
  const publicInput = { ...input, players, order: ['r', 'g', 'h', 'c', 'a', 'e'] };
  const frame = created(publicInput);
  assert.deepEqual(frame, {
    event: input.event, turn: 3, territory: 'hagga_basin', origin: 'natural',
    pile: 0, index: 4, stage: 'choose', order: ['r', 'a'], passed: [], protected: null,
  });
  assert.equal(currentNexusFremenProtectionOwner(frame), 'r');
  validateNexusFremenProtection(publicInput, frame);
  assert.equal(createNexusFremenProtection({
    ...publicInput,
    players: players.map((player) => ({ ...player, hasNexus: false })),
  }), null);
  assert.equal(createNexusFremenProtection({
    ...publicInput,
    players: players.map((player) => ({ ...player, forces: {}, noField: { deployed: null } })),
  }), null);
  assert.equal(createNexusFremenProtection({
    ...publicInput,
    players: players.map((player) => player.id === 'g' ? { ...player, faction: 'fremen' } : player),
  }), null, 'native Fremen suppresses this independent absent-Fremen queue even away from the worm');
});

void test('unrelated dynamic-board groups do not block protection of the actual printed worm territory', () => {
  const input = occurrence();
  const players = input.players.map(player => player.id === 'a' ? {
    ...player, forces: { ...player.forces, 'hidden_mobile_stronghold:0': 2 },
    noField: { deployed: { location: { territory: 'hidden_mobile_stronghold', sector: 0 } } },
  } : player);
  let frame = created({ ...input, players });
  frame = answerNexusFremenProtection(frame, 'h', true);
  frame = answerNexusFremenProtection(frame, 'r', false);
  frame = answerNexusFremenProtection(frame, 'a', false);
  assert.equal(frame.protected, 'h');
  assert.equal(frame.stage, 'complete');
  validateNexusFremenProtection({ ...input, players }, frame);
});

void test('irrelevant faces and hidden No-Field contents are not read at any public transition', () => {
  const input = occurrence();
  const hiddenRead = () => { throw new Error('private material was read'); };
  for (const player of input.players) {
    Object.defineProperties(player, {
      card: { enumerable: true, get: hiddenRead },
      hand: { enumerable: true, get: hiddenRead },
      nexusFace: { enumerable: true, get: hiddenRead },
      tokens: { enumerable: true, get: hiddenRead },
      reserves: { enumerable: true, get: hiddenRead },
    });
  }
  const marker = input.players[2].noField!;
  Object.defineProperty(marker, 'tokens', { enumerable: true, get: hiddenRead });
  Object.defineProperties(marker.deployed!, {
    value: { enumerable: true, get: hiddenRead },
    token: { enumerable: true, get: hiddenRead },
  });
  let frame = created(input);
  assert.deepEqual(frame.order, ['h', 'r', 'a']);
  frame = answerNexusFremenProtection(frame, 'h', false);
  assert.equal(currentNexusFremenProtectionOwner(frame), 'r');
  frame = answerNexusFremenProtection(frame, 'r', true);
  assert.equal(frame.protected, 'r');
  assert.equal(currentNexusFremenProtectionOwner(frame), 'a');
  frame = answerNexusFremenProtection(frame, 'a', false);
  assert.equal(frame.stage, 'complete');
  validateNexusFremenProtection(input, frame);
  assert.ok('territory' in marker.deployed!.location);
  assert.equal(marker.deployed!.location.territory, 'hagga_basin');
});

void test('Use protects just its original actor and leaves every remaining acknowledgement in order', () => {
  const input = occurrence();
  const start = created(input);
  const first = answerNexusFremenProtection(start, 'h', true);
  assert.equal(first.protected, 'h');
  assert.deepEqual(first.order, ['h', 'r', 'a']);
  assert.deepEqual(first.passed, ['h']);
  assert.equal(first.stage, 'choose');
  assert.equal(currentNexusFremenProtectionOwner(first), 'r');
  assert.throws(() => answerNexusFremenProtection(first, 'r', true), /already has its protected owner/);
  assert.deepEqual(first.passed, ['h'], 'a rejected second use cannot advance the queue');
  const second = answerNexusFremenProtection(first, 'r', false);
  assert.equal(currentNexusFremenProtectionOwner(second), 'a');
  const complete = answerNexusFremenProtection(second, 'a', false);
  assert.equal(complete.protected, 'h');
  assert.deepEqual(complete.passed, ['h', 'r', 'a']);
  assert.equal(complete.stage, 'complete');
  assert.equal(currentNexusFremenProtectionOwner(complete), null);
  validateNexusFremenProtection(input, complete);
  assert.deepEqual(start.passed, []);
  assert.equal(start.protected, null);
});

void test('wrong actor, repeated answer and nonboolean use cannot consume an acknowledgement', () => {
  const start = created();
  for (const actor of ['a', 'r', 'missing', ''])
    assert.throws(() => answerNexusFremenProtection(start, actor, false), /current original owner/);
  assert.throws(
    () => answerNexusFremenProtection(start, 'h', 1 as unknown as boolean),
    /Use or Pass/,
  );
  const next = answerNexusFremenProtection(start, 'h', false);
  assert.throws(() => answerNexusFremenProtection(next, 'h', false), /current original owner/);
  assert.equal(currentNexusFremenProtectionOwner(next), 'r');
  assert.deepEqual(start.passed, []);
  assert.equal(start.stage, 'choose');
});

void test('all passes close the queue only at the final original owner and completed frames cannot reopen', () => {
  const input = occurrence();
  let frame = created(input);
  for (const [index, actor] of frame.order.entries()) {
    assert.equal(currentNexusFremenProtectionOwner(frame), actor);
    frame = answerNexusFremenProtection(frame, actor, false);
    assert.equal(frame.stage, index === 2 ? 'complete' : 'choose');
  }
  assert.equal(frame.protected, null);
  assert.equal(currentNexusFremenProtectionOwner(frame), null);
  validateNexusFremenProtection(input, frame);
  for (const actor of input.order) {
    assert.throws(() => answerNexusFremenProtection(frame, actor, false), /current original owner/);
    assert.throws(() => answerNexusFremenProtection(frame, actor, true), /current original owner/);
  }
});

void test('one eligible original owner can close with Use without needing an impossible extra prompt', () => {
  const input = occurrence();
  const alone = {
    ...input,
    players: input.players.map((player) => ({ ...player, hasNexus: player.id === 'r' })),
  };
  const frame = answerNexusFremenProtection(created(alone), 'r', true);
  assert.equal(frame.stage, 'complete');
  assert.equal(frame.protected, 'r');
  assert.deepEqual(frame.order, ['r']);
  assert.deepEqual(frame.passed, ['r']);
  assert.equal(currentNexusFremenProtectionOwner(frame), null);
  validateNexusFremenProtection(alone, frame);
});

void test('source event, turn, territory, origin, pile and original discard index cannot be retargeted', () => {
  const input = occurrence();
  const frame = created(input);
  const changed: Partial<NexusFremenProtectionInput>[] = [
    { event: 'another-worm-at-the-same-place' }, { turn: 4 },
    { territory: 'the_great_flat' }, { origin: 'additional' }, { pile: 1 }, { index: 5 },
  ];
  for (const replacement of changed)
    assert.throws(() => validateNexusFremenProtection({ ...input, ...replacement }, frame), /original occurrence identity/);
  assert.throws(() => validateNexusFremenProtection({ ...input, order: ['a', 'h', 'r'] }, frame), /original public candidates/);
  assert.throws(() => validateNexusFremenProtection({
    ...input, players: input.players.map((player) => player.id === 'h' ? { ...player, hasNexus: false } : player),
  }, frame), /original public candidates/);
  assert.throws(() => validateNexusFremenProtection({
    ...input, players: input.players.map((player) => ({ ...player, forces: {}, noField: null })),
  }, frame), /original public candidates/, 'post-devour presence cannot retrofit a queue');
});

void test('additional and summoned worms bind their own source, and printed rock spice territories are valid', () => {
  const { pile: _pile, index: _index, ...base } = occurrence();
  const additional = { ...base, origin: 'additional' as const };
  const additionalFrame = created(additional);
  assert.equal(Object.hasOwn(additionalFrame, 'pile'), false);
  assert.equal(Object.hasOwn(additionalFrame, 'index'), false);
  validateNexusFremenProtection(additional, additionalFrame);
  const summoned = { ...base, origin: 'summoned' as const, parent: 'special-karama-original' };
  const summonedFrame = created(summoned);
  validateNexusFremenProtection(summoned, summonedFrame);
  assert.throws(() => validateNexusFremenProtection({ ...summoned, parent: 'different-karama' }, summonedFrame), /original occurrence identity/);
  const rock = {
    ...occurrence(), territory: 'rock_outcroppings',
    players: base.players.map((player) => ({ ...player, forces: { 'rock_outcroppings:13': 1 }, noField: null })),
  };
  assert.deepEqual(created(rock).order, ['h', 'r', 'a']);
});

void test('creation rejects malformed public source and order rather than silently shrinking the queue', () => {
  const input = occurrence();
  const malformed: Record<string, unknown>[] = [
    { event: '' }, { event: '   ' }, { turn: 0 }, { turn: -1 }, { turn: 1.5 },
    { turn: Number.MAX_SAFE_INTEGER + 1 }, { territory: 'not-a-territory' },
    { territory: 'arrakeen' }, { territory: 'hidden_mobile_stronghold' }, { origin: 'revived' },
    { pile: undefined }, { pile: 2 }, { index: undefined }, { index: -1 },
    { index: 1.5 }, { index: NaN }, { index: Number.MAX_SAFE_INTEGER + 1 },
    { parent: 'unrelated-parent' }, { origin: 'summoned', pile: undefined, index: undefined },
    { origin: 'summoned', parent: 'karama', pile: 0, index: undefined },
    { origin: 'summoned', parent: 'karama', pile: undefined, index: 0 },
    { origin: 'additional', parent: 'karama' },
    { order: ['h', 'r'] }, { order: ['h', 'r', 'r'] }, { order: ['h', 'r', 'unknown'] },
    { order: ['h', 'r', ''] }, { order: sparseOrder }, { players: null },
  ];
  for (const replacement of malformed)
    assert.throws(() => createNexusFremenProtection({ ...input, ...replacement } as NexusFremenProtectionInput));
  const malformedSeats: Record<string, unknown>[] = [
    { id: '' }, { id: 'h' }, { faction: '' }, { hasNexus: 'yes' },
    { ally: 'unknown' }, { ally: 'a' }, { forces: null },
    { forces: { 'hagga_basin:12': -1 } }, { forces: { 'hagga_basin:12': 1.5 } },
    { forces: { 'hagga_basin:99': 1 } }, { forces: { 'hagga_basin:012': 1 } },
    { noField: { deployed: {} } },
    { noField: { deployed: { location: { territory: 'hagga_basin', sector: 99 } } } },
  ];
  for (const replacement of malformedSeats)
    assert.throws(() => createNexusFremenProtection({
      ...input, players: [{ ...input.players[0], ...replacement } as NexusFremenProtectionPlayer, ...input.players.slice(1)],
    }));
});

void test('saved frames require exact fields, a prefix of original acknowledgements and one acknowledged protected owner', () => {
  const input = occurrence();
  const frame = created(input);
  const malformed: Record<string, unknown>[] = [
    { extra: true }, { parent: undefined }, { stage: 'devoured' }, { stage: 'complete' },
    { order: [] }, { order: ['h', 'r', 'r'] }, { order: sparseOrder },
    { passed: ['r'] }, { passed: ['h', 'a'] }, { passed: ['h', 'h'] },
    { passed: ['h', 'r', 'a', 'unknown'] },
    { passed: ['h', 'r', 'a'], stage: 'choose' },
    { protected: 'h' }, { passed: ['h'], protected: 'r' },
    { passed: ['h'], protected: 'unknown' }, { passed: ['h', 'r'], protected: ['h', 'r'] },
  ];
  for (const replacement of malformed) {
    const invalid = { ...frame, ...replacement } as NexusFremenProtectionFrame;
    assert.throws(() => validateNexusFremenProtection(input, invalid));
    assert.throws(() => currentNexusFremenProtectionOwner(invalid));
    assert.throws(() => answerNexusFremenProtection(invalid, 'h', false));
  }
  assert.throws(() => validateNexusFremenProtection(input, { ...frame, order: ['r', 'h', 'a'] }), /original public candidates/);
  assert.throws(() => validateNexusFremenProtection(input, { ...frame, order: ['h', 'r'] }), /original public candidates/);
});

void test('frozen public inputs and frames remain untouched and retain independent original queue arrays', () => {
  const input = occurrence();
  Object.freeze(input.order);
  for (const player of input.players) {
    Object.freeze(player.forces);
    if (player.noField?.deployed) {
      Object.freeze(player.noField.deployed.location);
      Object.freeze(player.noField.deployed);
      Object.freeze(player.noField);
    }
    Object.freeze(player);
  }
  Object.freeze(input.players);
  Object.freeze(input);
  const frame = created(input);
  Object.freeze(frame.order);
  Object.freeze(frame.passed);
  Object.freeze(frame);
  const next = answerNexusFremenProtection(frame, 'h', false);
  assert.deepEqual(frame.passed, []);
  assert.deepEqual(next.passed, ['h']);
  validateNexusFremenProtection(input, next);
});
