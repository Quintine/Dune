import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createNexusInspection,
  cancelNexusInspection,
  answerNexusInspection,
  allowNexusInspection,
  reopenNexusNative,
  answerNexusNative,
  reopenNexusInspection,
  validateNexusInspection,
  committedPlanElements,
  inspectedPlanElements,
  type BattleInspectionContext,
  type NexusInspection,
} from '../game/battle-inspections';

const context = (): BattleInspectionContext => ({
  event: 'battle-2',
  attacker: 'a',
  defender: 'g',
  players: [
    { id: 'a', faction: 'atreides' },
    { id: 'g', faction: 'guild' },
    { id: 'h', faction: 'harkonnen' },
  ],
  native: { player: 'a', field: 'dial', value: 0 },
});
const cunning = (c = context()) =>
  createNexusInspection(c, {
    mode: 'cunning',
    owner: 'a',
    target: 'g',
    field: 'weapon',
  });
const reload = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

void test('Cunning snapshots a real first answer including zero and null and requires a distinct second element', () => {
  for (const native of [
    { player: 'a', field: 'dial' as const, value: 0 },
    { player: 'a', field: 'leader' as const, value: null },
  ]) {
    const c = { ...context(), native };
    const before = JSON.stringify(c);
    const inspection = cunning(c);
    assert.deepEqual(inspection.first, native);
    assert.equal(inspection.stage, 'response');
    assert.deepEqual(inspection.answers, []);
    assert.throws(() =>
      createNexusInspection(c, {
        mode: 'cunning',
        owner: 'a',
        target: 'g',
        field: native.field,
      }),
    );
    assert.equal(JSON.stringify(c), before);
    const unanswered = {
      ...c,
      native: { player: native.player, field: native.field },
    };
    assert.throws(() => cunning(unanswered));
    assert.throws(() => cunning({ ...c, native: undefined }));
  }
});

void test('Cunning binds the current native answer and permits changes only through recorded Residual transitions', () => {
  const c = context();
  const inspection = answerNexusInspection(
    c,
    allowNexusInspection(c, cunning(c)),
    null,
  );
  const pending = { ...c, native: { player: 'a', field: 'dial' as const } };
  const changed = {
    ...c,
    native: { player: 'a', field: 'dial' as const, value: 2.5 },
  };
  assert.throws(() => validateNexusInspection(pending, inspection));
  assert.throws(() => validateNexusInspection(changed, inspection));
  const reopened = reopenNexusNative(c, inspection);
  assert.equal(Object.hasOwn(reopened, 'firstCurrent'), false);
  validateNexusInspection(pending, reopened);
  assert.throws(() => reopenNexusNative(pending, reopened));
  assert.throws(() => answerNexusNative(c, inspection, 2.5));
  const answered = answerNexusNative(pending, reopened, 2.5);
  validateNexusInspection(changed, answered);
  assert.deepEqual(answered.firstCurrent, { value: 2.5 });
  assert.equal(answered.first!.value, 0);
  assert.equal(inspection.firstCurrent!.value, 0);
  assert.throws(() => validateNexusInspection(c, answered));
  assert.throws(() =>
    validateNexusInspection({ ...c, native: undefined }, answered),
  );
  const canceled = cancelNexusInspection(c, cunning(c));
  const canceledReopened = reopenNexusNative(c, canceled);
  validateNexusInspection(pending, canceledReopened);
  assert.equal(
    answerNexusNative(pending, canceledReopened, 1).stage,
    'canceled',
  );
});

void test('reopened non-leader inspection retains immutable disclosure history but only its latest answered value binds', () => {
  const c = context();
  const first = answerNexusInspection(
    c,
    allowNexusInspection(c, cunning(c)),
    'treachery-1',
  );
  const firstJson = JSON.stringify(first);
  const reopened = reopenNexusInspection(c, reload(first));
  const battle = {
    event: c.event,
    attacker: c.attacker,
    defender: c.defender,
    prescience: c.native,
    nexusInspection: reopened,
  };
  assert.deepEqual(committedPlanElements(battle, 'g'), [
    {
      source: 'native',
      beneficiary: 'a',
      target: 'g',
      field: 'dial',
      value: 0,
    },
  ]);
  const second = answerNexusInspection(c, reopened, null);
  assert.deepEqual(second.answers, ['treachery-1', null]);
  assert.deepEqual(
    committedPlanElements({ ...battle, nexusInspection: second }, 'g').at(-1),
    {
      source: 'nexus',
      beneficiary: 'a',
      target: 'g',
      field: 'weapon',
      value: null,
    },
  );
  assert.deepEqual(
    inspectedPlanElements({ ...battle, nexusInspection: second }, 'a'),
    [],
  );
  assert.deepEqual(
    committedPlanElements({ ...battle, nexusInspection: second }, 'h'),
    [],
  );
  assert.equal(JSON.stringify(first), firstJson);
  assert.deepEqual(reopened.answers, ['treachery-1']);
  assert.throws(() => reopenNexusInspection(c, reopened));
  assert.throws(() => answerNexusInspection(c, second, 'treachery-2'));
});

void test('Secret Ally requires an absent Atreides and an actual opposing combatant; leaders never reopen', () => {
  const c: BattleInspectionContext = {
    event: 'absent',
    attacker: 'h',
    defender: 'g',
    players: [
      { id: 'h', faction: 'harkonnen' },
      { id: 'g', faction: 'guild' },
      { id: 'e', faction: 'emperor' },
    ],
  };
  const input = {
    mode: 'secretAlly' as const,
    owner: 'h',
    target: 'g',
    field: 'leader' as const,
  };
  const inspection = answerNexusInspection(
    c,
    createNexusInspection(c, input),
    null,
  );
  assert.throws(() => reopenNexusInspection(c, inspection));
  assert.throws(() =>
    createNexusInspection(
      { ...c, players: [...c.players, { id: 'a', faction: 'atreides' }] },
      input,
    ),
  );
  assert.throws(() => createNexusInspection(c, { ...input, owner: 'e' }));
  assert.throws(() => createNexusInspection(c, { ...input, target: 'e' }));
  assert.throws(() => createNexusInspection(c, { ...input, mode: 'cunning' }));
  validateNexusInspection(reload(c), reload(inspection));
});

void test('Betrayal binds a pending native attempt even for an allied beneficiary and a third-party holder', () => {
  const c: BattleInspectionContext = {
    ...context(),
    attacker: 'h',
    native: { player: 'h', field: 'defense' },
  };
  const input = {
    mode: 'betrayal' as const,
    owner: 'g',
    target: 'g',
    field: 'defense' as const,
  };
  const inspection = createNexusInspection(c, input);
  assert.equal(inspection.nativeProvider, 'a');
  assert.equal(inspection.nativeBeneficiary, 'h');
  assert.equal(inspection.stage, 'canceled');
  assert.deepEqual(inspection.answers, []);
  validateNexusInspection({ ...c, native: undefined }, reload(inspection));
  assert.deepEqual(
    committedPlanElements({ ...c, nexusInspection: inspection }, 'g'),
    [],
  );
  assert.throws(() => answerNexusInspection(c, inspection, null));
  assert.throws(() => reopenNexusInspection(c, inspection));
  assert.throws(() =>
    createNexusInspection(
      { ...c, native: { ...c.native!, value: null } },
      input,
    ),
  );
  assert.throws(() =>
    createNexusInspection({ ...c, native: undefined }, input),
  );
  assert.throws(() => createNexusInspection(c, { ...input, owner: 'a' }));
  const outside = {
    ...c,
    players: [...c.players, { id: 'e', faction: 'emperor' as const }],
  };
  validateNexusInspection(
    outside,
    createNexusInspection(outside, { ...input, owner: 'e' }),
  );
});

void test('bound receipt rejects battle, owner, target, field, history and stage corruption without mutation', () => {
  const c = context();
  const original = answerNexusInspection(
    c,
    allowNexusInspection(c, cunning(c)),
    null,
  );
  const corruptions: Array<(i: NexusInspection) => void> = [
    (i) => {
      i.event = 'another';
    },
    (i) => {
      i.owner = 'h';
    },
    (i) => {
      i.target = 'a';
    },
    (i) => {
      i.field = 'defense';
    },
    (i) => {
      i.stage = 'answer';
    },
    (i) => {
      i.answers = [];
    },
    (i) => {
      i.first!.value = 1;
    },
    (i) => {
      delete i.first;
    },
    (i) => {
      Object.assign(i, { hand: ['secret'] });
    },
    (i) => {
      i.signature = '';
    },
  ];
  for (const corrupt of corruptions) {
    const candidate = reload(original);
    corrupt(candidate);
    const before = JSON.stringify(candidate);
    assert.throws(() => validateNexusInspection(c, candidate));
    assert.throws(() => reopenNexusInspection(c, candidate));
    assert.equal(JSON.stringify(candidate), before);
  }
  assert.throws(() =>
    validateNexusInspection({ ...c, event: 'another' }, original),
  );
  assert.throws(() =>
    committedPlanElements(
      {
        attacker: 'a',
        defender: 'g',
        event: 'another',
        nexusInspection: original,
      },
      'g',
    ),
  );
});

void test('typed answers allow half-force dials and no-card null but reject invalid serialized values', () => {
  const c: BattleInspectionContext = {
    event: 'dial',
    attacker: 'h',
    defender: 'g',
    players: [
      { id: 'h', faction: 'harkonnen' },
      { id: 'g', faction: 'guild' },
    ],
  };
  const waiting = createNexusInspection(c, {
    mode: 'secretAlly',
    owner: 'h',
    target: 'g',
    field: 'dial',
  });
  assert.deepEqual(answerNexusInspection(c, waiting, 0.5).answers, [0.5]);
  for (const value of [
    null,
    '2',
    -1,
    NaN,
    Infinity,
    0.25,
    Number.MAX_SAFE_INTEGER,
  ])
    assert.throws(() => answerNexusInspection(c, waiting, value));
  const weapon = createNexusInspection(c, {
    mode: 'secretAlly',
    owner: 'h',
    target: 'g',
    field: 'weapon',
  });
  for (const value of [0, '', '  ', undefined])
    assert.throws(() =>
      answerNexusInspection(c, weapon, value as unknown as null),
    );
});

void test('public-only context never reads hands, plans, resources or unrelated private state', () => {
  const c = context();
  for (const player of c.players)
    for (const key of ['hand', 'spice', 'traitors'])
      Object.defineProperty(player, key, {
        get() {
          throw new Error(`Private ${key} accessed`);
        },
      });
  Object.defineProperty(c, 'plans', {
    get() {
      throw new Error('Plans accessed');
    },
  });
  const before = JSON.stringify(c);
  const answered = answerNexusInspection(
    c,
    allowNexusInspection(c, cunning(c)),
    null,
  );
  validateNexusInspection(c, reload(answered));
  assert.equal(JSON.stringify(c), before);
  assert.deepEqual(Object.keys(answered).sort(), [
    'answers',
    'event',
    'field',
    'first',
    'firstCurrent',
    'mode',
    'owner',
    'signature',
    'stage',
    'target',
    'version',
  ]);
});

void test('canceling the original Cunning extra attempt preserves its first disclosure and cannot cancel other sources or old answers', () => {
  const c = context();
  const waiting = cunning(c);
  const before = JSON.stringify(waiting);
  const canceled = cancelNexusInspection(c, waiting);
  assert.equal(canceled.stage, 'canceled');
  assert.deepEqual(canceled.answers, []);
  assert.deepEqual(canceled.first, waiting.first);
  validateNexusInspection(c, reload(canceled));
  assert.deepEqual(
    committedPlanElements(
      {
        event: c.event,
        attacker: c.attacker,
        defender: c.defender,
        prescience: c.native,
        nexusInspection: canceled,
      },
      'g',
    ),
    [
      {
        source: 'native',
        beneficiary: 'a',
        target: 'g',
        field: 'dial',
        value: 0,
      },
    ],
  );
  assert.equal(JSON.stringify(waiting), before);
  assert.throws(() => cancelNexusInspection(c, canceled));
  assert.throws(() => answerNexusInspection(c, canceled, null));
  assert.throws(() => reopenNexusInspection(c, canceled));
  const answered = answerNexusInspection(
    c,
    allowNexusInspection(c, waiting),
    null,
  );
  assert.throws(() => cancelNexusInspection(c, answered));
  assert.throws(() =>
    cancelNexusInspection(c, reopenNexusInspection(c, answered)),
  );
  const absent: BattleInspectionContext = {
    ...c,
    attacker: 'h',
    native: undefined,
    players: c.players.filter((p) => p.faction !== 'atreides'),
  };
  const secret = createNexusInspection(absent, {
    mode: 'secretAlly',
    owner: 'h',
    target: 'g',
    field: 'weapon',
  });
  assert.throws(() => cancelNexusInspection(absent, secret));
  const pending = { ...c, native: { player: 'a', field: 'weapon' as const } };
  const betrayal = createNexusInspection(pending, {
    mode: 'betrayal',
    owner: 'h',
    target: 'g',
    field: 'weapon',
  });
  assert.throws(() => cancelNexusInspection(pending, betrayal));
});

void test('Cunning cannot answer or reopen before its original response is explicitly allowed', () => {
  const c = context();
  const response = cunning(c);
  const before = JSON.stringify(response);
  assert.equal(response.stage, 'response');
  assert.throws(() => answerNexusInspection(c, response, null));
  assert.throws(() => reopenNexusInspection(c, response));
  const allowed = allowNexusInspection(c, response);
  assert.equal(allowed.stage, 'answer');
  assert.deepEqual(allowed.first, response.first);
  assert.equal(JSON.stringify(response), before);
  assert.throws(() => allowNexusInspection(c, allowed));
  assert.throws(() => cancelNexusInspection(c, allowed));
  const rewritten = reload(response);
  rewritten.stage = 'answer';
  assert.throws(() => validateNexusInspection(c, rewritten));
  const answered = answerNexusInspection(c, allowed, null);
  assert.throws(() => allowNexusInspection(c, answered));
  const reopened = reopenNexusInspection(c, answered);
  assert.throws(() => allowNexusInspection(c, reopened));
  assert.throws(() => cancelNexusInspection(c, reopened));
});
