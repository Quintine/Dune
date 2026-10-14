import assert from 'node:assert/strict';
import test from 'node:test';
import { VOICE_KINDS } from '../game/battle-cards';
import {
  createNexusBorrowedVoice,
  currentNexusBorrowedVoiceOwner,
  declareNexusBorrowedVoice,
  finishNexusBorrowedVoice,
  passNexusBorrowedVoice,
  validateNexusBorrowedVoice,
  type NexusBorrowedVoiceContext,
  type NexusBorrowedVoiceFrame,
} from '../game/nexus-borrowed-voice';

const context: NexusBorrowedVoiceContext = {
  turn: 2,
  battle: { event: 'original-battle-7', attacker: 'a', defender: 'd' },
};
const command: NonNullable<NexusBorrowedVoiceFrame['voice']> = {
  target: 'd', kind: 'poison', must: true,
};

function freeze(value: unknown): void {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return;
  for (const child of Object.values(value)) freeze(child);
  Object.freeze(value);
}

void test('creation binds a deterministic original turn/battle and attacker-first queue', () => {
  const frame = createNexusBorrowedVoice(context);
  assert.deepEqual(frame, {
    event: JSON.stringify(['nexusBorrowedVoice', 2, 'original-battle-7']),
    turn: 2, battle: 'original-battle-7', order: ['a', 'd'], passed: [],
    stage: 'choose', owner: null, voice: null,
  });
  assert.deepEqual(createNexusBorrowedVoice(structuredClone(context)), frame);
  assert.equal(currentNexusBorrowedVoiceOwner(frame), 'a');
  validateNexusBorrowedVoice(context, frame);
  assert.notEqual(createNexusBorrowedVoice({ ...context, turn: 3 }).event, frame.event);
  assert.notEqual(createNexusBorrowedVoice({ ...context,
    battle: { ...context.battle, event: 'original-battle-8' } }).event, frame.event);
});

void test('all-pass closes the opportunity without a declaration or response', () => {
  const original = createNexusBorrowedVoice(context);
  const first = passNexusBorrowedVoice(original, 'a');
  assert.deepEqual(first.passed, ['a']);
  assert.equal(first.stage, 'choose');
  assert.equal(currentNexusBorrowedVoiceOwner(first), 'd');
  validateNexusBorrowedVoice(context, first);
  const closed = passNexusBorrowedVoice(first, 'd');
  assert.deepEqual(closed.passed, ['a', 'd']);
  assert.equal(closed.stage, 'passed');
  assert.equal(closed.owner, null);
  assert.equal(closed.voice, null);
  assert.equal(currentNexusBorrowedVoiceOwner(closed), null);
  assert.equal(closed.event, original.event);
  validateNexusBorrowedVoice(context, closed);
  for (const actor of ['a', 'd']) {
    assert.throws(() => passNexusBorrowedVoice(closed, actor));
    assert.throws(() => declareNexusBorrowedVoice(closed, actor,
      { ...command, target: actor === 'a' ? 'd' : 'a' }));
  }
  assert.throws(() => finishNexusBorrowedVoice(closed, false));
});

for (const actor of ['a', 'd']) {
  void test(`${actor === 'a' ? 'first' : 'second'} combatant may declare once and close the queue`, () => {
    const original = createNexusBorrowedVoice(context);
    const ready = actor === 'a' ? original : passNexusBorrowedVoice(original, 'a');
    const voice = { ...command, target: actor === 'a' ? 'd' : 'a', must: actor === 'a' };
    const declared = declareNexusBorrowedVoice(ready, actor, voice);
    assert.equal(declared.stage, 'declared');
    assert.equal(declared.owner, actor);
    assert.deepEqual(declared.voice, voice);
    assert.deepEqual(declared.passed, actor === 'a' ? [] : ['a']);
    assert.equal(declared.event, original.event);
    assert.equal(currentNexusBorrowedVoiceOwner(declared), null);
    validateNexusBorrowedVoice(context, declared);
    for (const second of ['a', 'd']) {
      assert.throws(() => passNexusBorrowedVoice(declared, second));
      assert.throws(() => declareNexusBorrowedVoice(declared, second,
        { ...command, target: second === 'a' ? 'd' : 'a' }));
    }
    for (const canceled of [false, true]) {
      const settled = finishNexusBorrowedVoice(declared, canceled);
      assert.equal(settled.stage, canceled ? 'canceled' : 'active');
      assert.equal(settled.owner, actor);
      assert.deepEqual(settled.voice, voice);
      assert.deepEqual(settled.passed, declared.passed);
      assert.equal(settled.event, declared.event);
      assert.equal(currentNexusBorrowedVoiceOwner(settled), null);
      validateNexusBorrowedVoice(context, settled);
      for (const repeat of [false, true]) assert.throws(() => finishNexusBorrowedVoice(settled, repeat));
      for (const second of ['a', 'd']) {
        assert.throws(() => passNexusBorrowedVoice(settled, second));
        assert.throws(() => declareNexusBorrowedVoice(settled, second,
          { ...command, target: second === 'a' ? 'd' : 'a' }));
      }
    }
  });
}

void test('wrong, foreign, passed and stale actors cannot advance the prefix queue', () => {
  const first = createNexusBorrowedVoice(context);
  for (const actor of ['d', 'foreign', '', null, undefined]) {
    assert.throws(() => passNexusBorrowedVoice(first, actor as string));
    assert.throws(() => declareNexusBorrowedVoice(first, actor as string, command));
  }
  const second = passNexusBorrowedVoice(first, 'a');
  for (const actor of ['a', 'foreign', '', null, undefined]) {
    assert.throws(() => passNexusBorrowedVoice(second, actor as string));
    assert.throws(() => declareNexusBorrowedVoice(second, actor as string, { ...command, target: 'a' }));
  }
  assert.throws(() => finishNexusBorrowedVoice(first, false));
  assert.throws(() => finishNexusBorrowedVoice(second, true));
});

void test('context validation rejects stale turn/event and changed original combatants at every stage', () => {
  const first = createNexusBorrowedVoice(context);
  const second = passNexusBorrowedVoice(first, 'a');
  const declared = declareNexusBorrowedVoice(second, 'd', { ...command, target: 'a' });
  const frames = [first, second, passNexusBorrowedVoice(second, 'd'), declared,
    finishNexusBorrowedVoice(declared, false), finishNexusBorrowedVoice(declared, true)];
  const changed: NexusBorrowedVoiceContext[] = [
    { ...context, turn: 3 },
    { ...context, battle: { ...context.battle, event: 'different-battle' } },
    { ...context, battle: { ...context.battle, attacker: 'foreign' } },
    { ...context, battle: { ...context.battle, defender: 'foreign' } },
    { ...context, battle: { ...context.battle, attacker: 'd', defender: 'a' } },
  ];
  for (const frame of frames) {
    validateNexusBorrowedVoice(context, frame);
    for (const stale of changed) assert.throws(() => validateNexusBorrowedVoice(stale, frame));
  }
});

void test('invalid contexts cannot manufacture a queue', () => {
  const invalid: unknown[] = [
    null, {}, { ...context, turn: 0 }, { ...context, turn: -1 },
    { ...context, turn: 1.5 }, { ...context, turn: NaN },
    { ...context, turn: Number.MAX_SAFE_INTEGER + 1 },
    { ...context, turn: '2' }, { ...context, battle: null },
    { ...context, battle: { ...context.battle, event: ' ' } },
    { ...context, battle: { ...context.battle, attacker: '' } },
    { ...context, battle: { ...context.battle, defender: ' ' } },
    { ...context, battle: { ...context.battle, defender: 'a' } },
  ];
  const frame = createNexusBorrowedVoice(context);
  for (const bad of invalid) {
    assert.throws(() => createNexusBorrowedVoice(bad as NexusBorrowedVoiceContext));
    assert.throws(() => validateNexusBorrowedVoice(bad as NexusBorrowedVoiceContext, frame));
  }
});

void test('saved frames require the bound event, exact shape and a genuine pass prefix', () => {
  const frame = createNexusBorrowedVoice(context);
  const sparseOrder: string[] = [];
  sparseOrder.length = 2;
  const sparsePassed: string[] = [];
  sparsePassed.length = 1;
  sparseOrder[1] = 'd';
  const invalid: unknown[] = [
    null, {}, { ...frame, event: '' }, { ...frame, event: 'stale-event' },
    { ...frame, turn: 3 }, { ...frame, battle: 'other-battle' },
    { ...frame, source: 'private-card' }, { ...frame, stage: 'unknown' },
    { ...frame, order: ['a'] }, { ...frame, order: ['a', 'a'] },
    { ...frame, order: ['a', 'd', 'foreign'] }, { ...frame, order: sparseOrder },
    { ...frame, passed: null }, { ...frame, passed: ['d'] },
    { ...frame, passed: ['a', 'a'] }, { ...frame, passed: ['foreign'] },
    { ...frame, passed: ['a', 'd', 'foreign'] }, { ...frame, passed: sparsePassed },
    { ...frame, passed: ['a', 'd'] }, { ...frame, stage: 'passed' },
    { ...frame, owner: 'a' }, { ...frame, voice: command },
  ];
  for (const bad of invalid) {
    const malformed = bad as NexusBorrowedVoiceFrame;
    assert.throws(() => validateNexusBorrowedVoice(context, malformed));
    assert.throws(() => currentNexusBorrowedVoiceOwner(malformed));
    assert.throws(() => passNexusBorrowedVoice(malformed, 'a'));
    assert.throws(() => declareNexusBorrowedVoice(malformed, 'a', command));
    assert.throws(() => finishNexusBorrowedVoice(malformed, false));
  }
});

void test('every native Voice category and both require/forbid commands are canonical', () => {
  for (const kind of VOICE_KINDS) {
    for (const must of [false, true]) {
      const voice = { ...command, kind: kind as typeof command.kind, must };
      const declared = declareNexusBorrowedVoice(createNexusBorrowedVoice(context), 'a', voice);
      assert.deepEqual(declared.voice, voice);
      validateNexusBorrowedVoice(context, declared);
      validateNexusBorrowedVoice(context, finishNexusBorrowedVoice(declared, false));
      validateNexusBorrowedVoice(context, finishNexusBorrowedVoice(declared, true));
    }
  }
});

void test('declarations reject missing/noncanonical commands, nonbooleans and wrong targets', () => {
  const frame = createNexusBorrowedVoice(context);
  const invalid: unknown[] = [
    null, undefined, {}, { ...command, target: 'a' }, { ...command, target: 'foreign' },
    { ...command, kind: 'karama' }, { ...command, kind: 'portableSnooper' },
    { ...command, kind: 'Poison' }, { ...command, kind: null },
    { target: 'd', must: true }, { target: 'd', kind: 'poison' },
    { ...command, must: 'false' }, { ...command, must: 0 },
    { ...command, must: null }, { ...command, source: 'nexus' },
  ];
  for (const bad of invalid) {
    assert.throws(() => declareNexusBorrowedVoice(frame, 'a', bad as typeof command));
  }
  assert.deepEqual(frame, createNexusBorrowedVoice(context));
});

void test('declared, active and canceled receipts require exactly one ordered owner and command', () => {
  const declared = declareNexusBorrowedVoice(createNexusBorrowedVoice(context), 'a', command);
  for (const stage of ['declared', 'active', 'canceled'] as const) {
    const base = { ...declared, stage };
    validateNexusBorrowedVoice(context, base);
    const invalid: unknown[] = [
      { ...base, owner: null }, { ...base, owner: 'd' }, { ...base, owner: 'foreign' },
      { ...base, voice: null }, { ...base, voice: { ...command, target: 'a' } },
      { ...base, voice: { ...command, must: 'true' } },
      { ...base, voice: { ...command, kind: 'karama' } },
      { ...base, passed: ['a'] }, { ...base, passed: ['a', 'd'] },
    ];
    for (const bad of invalid) assert.throws(() => validateNexusBorrowedVoice(context, bad as NexusBorrowedVoiceFrame));
  }
  for (const bad of ['false', 0, null, undefined]) {
    assert.throws(() => finishNexusBorrowedVoice(declared, bad as unknown as boolean));
  }
});

void test('successful and rejected transitions leave inputs untouched and return independent receipts', () => {
  const ctx = structuredClone(context);
  const voice = structuredClone(command);
  freeze(ctx);
  freeze(voice);
  const first = createNexusBorrowedVoice(ctx);
  const original = structuredClone(first);
  freeze(first);
  const second = passNexusBorrowedVoice(first, 'a');
  freeze(second);
  const allPassed = passNexusBorrowedVoice(second, 'd');
  const firstDeclared = declareNexusBorrowedVoice(first, 'a', voice);
  freeze(firstDeclared);
  const canceled = finishNexusBorrowedVoice(firstDeclared, true);
  const active = finishNexusBorrowedVoice(firstDeclared, false);
  const secondDeclared = declareNexusBorrowedVoice(second, 'd', { ...voice, target: 'a' });
  assert.throws(() => passNexusBorrowedVoice(first, 'd'));
  assert.throws(() => declareNexusBorrowedVoice(first, 'a', { ...voice, target: 'a' }));
  assert.deepEqual(first, original);
  assert.deepEqual(ctx, context);
  assert.deepEqual(voice, command);
  assert.deepEqual(second.passed, ['a']);
  assert.equal(firstDeclared.stage, 'declared');
  for (const result of [second, allPassed, firstDeclared, secondDeclared, canceled, active]) {
    assert.notEqual(result, first);
    assert.notEqual(result.order, first.order);
    assert.notEqual(result.passed, first.passed);
  }
  assert.notEqual(firstDeclared.voice, voice);
  assert.notEqual(canceled.voice, firstDeclared.voice);
  assert.notEqual(active.voice, firstDeclared.voice);
  canceled.voice!.must = false;
  canceled.order[0] = 'changed';
  canceled.passed.push('changed');
  active.voice!.kind = 'shield';
  assert.deepEqual(firstDeclared.voice, command);
  assert.deepEqual(firstDeclared.order, ['a', 'd']);
  assert.deepEqual(firstDeclared.passed, []);
});
