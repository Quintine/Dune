import test from 'node:test';
import assert from 'node:assert/strict';
import { newPlayer, type Game } from '../game/engine';
import { createHomeworldCustody } from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import { quoteHomeworldRevivalDeployment } from '../game/homeworld-revival-deployment';
import {
  makeHomeworldRevivalReturn,
  makeHomeworldRevivalProgress,
  validateHomeworldRevivalReturn,
  homeworldRevivalResumeSignature,
  homeworldRevivalArrivalSignature,
  makeSouthernRevivalAllocation,
  southernRevivalRemaining,
  southernRevivalSummary,
  currentHomeworldRevivalArrival,
  currentHomeworldRevivalGroup,
  openSouthernRevivalChoice,
  commitSouthernRevivalChoice,
  completeSouthernRevivalChild,
  appendHomeworldRevivalAmbassador,
  completeHomeworldRevivalAmbassador,
  type HomeworldRevivalReturn,
} from '../game/homeworld-revival-return';

function southernFixture(stars = 3) {
  const { g, original } = fixture();
  g.advanced = false;
  original.group.elite = stars;
  original.quote.elite = stars;
  g.players[0].elites!.reserves = stars;
  const root = makeSouthernRevivalAllocation(original);
  g.homeworldRevivalProgress = makeHomeworldRevivalProgress(root);
  return { g, root, original };
}
function openSouthern(root: HomeworldRevivalReturn, event: string, response: Game['response'] = null) {
  root.resumeResponse = structuredClone(response);
  root.resumeSignature = homeworldRevivalResumeSignature(response);
  openSouthernRevivalChoice(root, event);
}

void test('Southern v2 allocates three original stars to distinct current groups and reserves while holding one original income', () => {
  const { g, root } = southernFixture();
  validateHomeworldRevivalReturn(g, root);
  assert.equal(currentHomeworldRevivalArrival(root), null);
  assert.equal(currentHomeworldRevivalGroup(root), null);
  const response: Game['response'] = { kind: 'revivalIncome', owner: 'v', recipient: 'p', amount: 1, passed: [] };
  openSouthern(root, 'child-1', response);
  const original = structuredClone({ event: root.event, source: root.source, group: root.group, quote: root.quote,
    signature: root.signature, resumeResponse: root.resumeResponse, resumeSignature: root.resumeSignature });
  const destinations = ['arrakeen:10', 'polar_sink:0', 'decline'];
  for (const [index, destination] of destinations.entries()) {
    const event = `child-${index + 1}`;
    assert.equal(currentHomeworldRevivalArrival(root)!.event, event);
    assert.equal(currentHomeworldRevivalGroup(root), null);
    commitSouthernRevivalChoice(root, event, { amount: 1, destination });
    assert.deepEqual(currentHomeworldRevivalGroup(root), { amount: 1, elite: 1 });
    if (destination !== 'decline') { g.players[0].reserves--; g.players[0].elites!.reserves--; }
    g.homeworldRevivalProgress = makeHomeworldRevivalProgress(root);
    validateHomeworldRevivalReturn(g, root);
    completeSouthernRevivalChild(root, event, index < 2 ? `child-${index + 2}` : undefined);
    g.homeworldRevivalProgress = makeHomeworldRevivalProgress(root);
    validateHomeworldRevivalReturn(g, root);
  }
  assert.equal(root.stage, 'complete');
  assert.deepEqual(southernRevivalSummary(root), { total: 3, remaining: 0, placed: 2, kept: 1 });
  assert.equal(g.players[0].elites!.reserves, 1);
  assert.equal(root.allocation!.children.length, 3);
  assert.deepEqual({ event: root.event, source: root.source, group: root.group, quote: root.quote,
    signature: root.signature, resumeResponse: root.resumeResponse, resumeSignature: root.resumeSignature }, original);
  validateHomeworldRevivalReturn(g, JSON.parse(JSON.stringify(root)) as HomeworldRevivalReturn);
});

void test('Southern v2 is a fresh Basic multi-star grant while minimal legacy identities and original whole frames remain unchanged', () => {
  const legacy = fixture(), before = JSON.stringify(legacy.frame);
  assert.equal(currentHomeworldRevivalArrival(legacy.frame), legacy.frame);
  assert.deepEqual(currentHomeworldRevivalGroup(legacy.frame), { amount: 2, elite: 2 });
  const minimal = { event: 'legacy', turn: 1, phase: 4, stage: 'arrival' as const, destination: 'arrakeen:10' };
  assert.equal(currentHomeworldRevivalArrival(minimal), minimal);
  assert.equal(currentHomeworldRevivalArrival(null), null);
  assert.equal(currentHomeworldRevivalArrival(undefined), null);
  assert.equal(JSON.stringify(legacy.frame), before);
  assert.equal('allocation' in legacy.frame, false);
  assert.throws(() => makeSouthernRevivalAllocation(fixture('tleilax').original));
  const one = fixture().original; one.group.elite = 1; one.quote.elite = 1;
  assert.throws(() => makeSouthernRevivalAllocation(one));
  const { g, root } = southernFixture(2);
  assert.throws(() => validateHomeworldRevivalReturn({ ...g, advanced: true }, root));
  validateHomeworldRevivalReturn(g, root);
});

void test('Southern child selection rejects stale events, duplicate decisions and over-allocation before changing the root', () => {
  const { g, root } = southernFixture(2);
  openSouthern(root, 'child-1');
  for (const selection of [{ amount: 0, destination: 'decline' }, { amount: 3, destination: 'arrakeen:10' },
    { amount: 1.5, destination: 'polar_sink:0' }, { amount: 1, destination: '' }]) {
    const before = structuredClone(root);
    assert.throws(() => commitSouthernRevivalChoice(root, 'child-1', selection));
    assert.deepEqual(root, before);
  }
  commitSouthernRevivalChoice(root, 'child-1', { amount: 1, destination: 'decline' });
  const before = structuredClone(root);
  for (const next of [undefined, 'child-1', root.event]) {
    assert.throws(() => completeSouthernRevivalChild(root, 'child-1', next));
    assert.deepEqual(root, before);
  }
  completeSouthernRevivalChild(root, 'child-1', 'child-2');
  assert.equal(southernRevivalRemaining(root), 1);
  assert.throws(() => commitSouthernRevivalChoice(root, 'child-1', { amount: 1, destination: 'decline' }));
  assert.throws(() => commitSouthernRevivalChoice(root, 'child-2', { amount: 2, destination: 'decline' }));
  g.homeworldRevivalProgress = makeHomeworldRevivalProgress(root);
  validateHomeworldRevivalReturn(g, root);
  const changed = structuredClone(root); changed.allocation!.children[0].amount = 2;
  assert.throws(() => makeHomeworldRevivalProgress(changed));
  const regranted = structuredClone(root); regranted.quote.afterPopulation++;
  assert.throws(() => makeHomeworldRevivalProgress(regranted));
});

void test('Southern children retain their own Ambassador completion before the next unique decision', () => {
  const { g, root } = southernFixture(2);
  openSouthern(root, 'child-1');
  commitSouthernRevivalChoice(root, 'child-1', { amount: 1, destination: 'arrakeen:10' });
  g.players[0].reserves--; g.players[0].elites!.reserves--;
  g.homeworldRevivalProgress = makeHomeworldRevivalProgress(root);
  const ambassador = { event: 'child-1-ambassador', entrant: 'p', territory: 'arrakeen', sector: 10, turn: 2, phase: 4 };
  appendHomeworldRevivalAmbassador(root, ambassador);
  const pending = { ...ambassador, revivalEvent: 'child-1' } as NonNullable<Game['pendingAmbassador']>;
  validateHomeworldRevivalReturn({ ...g, pendingAmbassador: pending }, root);
  assert.throws(() => completeSouthernRevivalChild(root, 'child-1', 'child-2'));
  completeHomeworldRevivalAmbassador(root, ambassador.event);
  validateHomeworldRevivalReturn({ ...g, pendingAmbassador: null }, root);
  completeSouthernRevivalChild(root, 'child-1', 'child-2');
  g.homeworldRevivalProgress = makeHomeworldRevivalProgress(root);
  assert.equal(root.allocation!.children[0].ambassadors![0].completed, true);
  assert.equal(currentHomeworldRevivalArrival(root)!.event, 'child-2');
  assert.throws(() => completeHomeworldRevivalAmbassador(root, ambassador.event));
  validateHomeworldRevivalReturn({ ...g, pendingAmbassador: null }, root);
});

function fixture(
  kind: 'fedaykin' | 'tleilax' = 'fedaykin',
  source: 'normal' | 'emperorExtra' | 'ghola' | 'nexusTleilaxu' = 'normal',
) {
  const players = [
    newPlayer('p', 'Owner', kind === 'fedaykin' ? 'fremen' : 'tleilaxu'),
    newPlayer('v', 'Other', kind === 'fedaykin' ? 'tleilaxu' : 'harkonnen'),
  ];
  players[0].reserves = kind === 'fedaykin' ? 3 : 9;
  if (kind === 'fedaykin')
    players[0].elites = { reserves: 0, tanks: 3, forces: {}, revived: 0 };
  const before = {
    advanced: true,
    players,
    homeworlds: {
      custody: createHomeworldCustody(
        homeworldContext({ advanced: true, players }),
      ),
    },
  };
  const group = {
    amount: 3,
    elite: kind === 'fedaykin' ? 2 : 0,
    free: source === 'normal' ? 2 : 0,
  };
  const after = structuredClone(before);
  after.players[0].reserves += group.amount;
  if (after.players[0].elites) after.players[0].elites.reserves += group.elite;
  const quote = quoteHomeworldRevivalDeployment(
    before,
    after,
    'p',
    source,
    group,
  )!;
  const original = {
    event: 'return-1',
    turn: 2,
    phase: 4,
    player: 'p',
    source,
    ...(source === 'ghola' ? { card: 'ghola-physical-1' } : {}),
    group,
    quote,
  };
  const frame = makeHomeworldRevivalReturn(original);
  return {
    g: {
      ...after,
      turn: 2,
      phase: 4,
      ...({
        homeworldRevivalProgress: makeHomeworldRevivalProgress(frame),
      } as Pick<Game, 'homeworldRevivalProgress'>),
    },
    original,
    frame,
  };
}
function choose(
  g: Pick<Game, 'homeworldRevivalProgress'>,
  frame: HomeworldRevivalReturn,
  response: Game['response'] = null,
) {
  frame.stage = 'choice';
  frame.resumeResponse = structuredClone(response);
  frame.resumeSignature = homeworldRevivalResumeSignature(response);
  g.homeworldRevivalProgress = makeHomeworldRevivalProgress(frame);
  return frame;
}

void test('typed revival receipt survives every source and JSON round trip without aliasing its quote', () => {
  for (const source of ['normal', 'emperorExtra', 'ghola', 'nexusTleilaxu'] as const) {
    const { g, original, frame } = fixture('fedaykin', source);
    const copy = JSON.parse(JSON.stringify(frame)) as HomeworldRevivalReturn;
    validateHomeworldRevivalReturn(g, copy);
    assert.equal(copy.stage, 'waiting');
    original.group.elite = 1;
    original.quote.elite = 1;
    assert.equal(copy.group.elite, 2);
    assert.equal(frame.quote.elite, 2);
    validateHomeworldRevivalReturn(g, frame);
  }
  const { g, frame } = fixture('tleilax');
  assert.equal(frame.quote.normal, 2);
  validateHomeworldRevivalReturn(g, frame);
});

void test('original fields, eligible subset and unknown saved fields cannot be changed', () => {
  const { g, frame } = fixture();
  const mutations: ((f: HomeworldRevivalReturn) => void)[] = [
    (f) => {
      f.event = 'another';
    },
    (f) => {
      f.turn++;
    },
    (f) => {
      f.phase++;
    },
    (f) => {
      f.player = 'v';
    },
    (f) => {
      f.source = 'ghola';
      f.card = 'invented';
    },
    (f) => {
      f.group.elite--;
    },
    (f) => {
      f.group.amount++;
    },
    (f) => {
      f.quote.elite--;
    },
    (f) => {
      f.quote.beforePopulation++;
    },
    (f) => {
      f.quote.afterPopulation++;
    },
    (f) => {
      f.quote.blocked = 'Unresolved';
    },
    (f) => {
      Object.assign(f, { unexpected: true });
    },
  ];
  for (const mutate of mutations) {
    const copy = structuredClone(frame);
    mutate(copy);
    const unchanged = JSON.stringify({ g, copy });
    assert.throws(
      () => validateHomeworldRevivalReturn(g, copy),
      /original typed revival/,
    );
    assert.equal(JSON.stringify({ g, copy }), unchanged);
  }
});

void test('constructor rejects impossible quotes, free source mismatches and inconsistent populations', () => {
  const { original } = fixture();
  for (const patch of [
    { group: { amount: 0, elite: 0, free: 0 } },
    { group: { amount: 3, elite: NaN, free: 2 } },
    { group: { amount: 3, elite: 4, free: 2 } },
    { group: { amount: 3, elite: 2, free: 4 } },
    { quote: { ...original.quote, normal: 1 } },
    { quote: { ...original.quote, elite: 1 } },
    { quote: { ...original.quote, beforePopulation: 3, afterPopulation: 5 } },
    { quote: { ...original.quote, blocked: 'Timing unresolved' } },
    { source: 'emperorExtra' },
    { source: 'ghola' },
    { card: 'unrelated' },
    { source: 'unknown' },
    { phase: -1 },
    { turn: 1.5 },
  ])
    assert.throws(
      () =>
        makeHomeworldRevivalReturn({
          ...original,
          ...patch,
        } as typeof original),
      /original typed revival/,
    );
  const tleilax = fixture('tleilax').original;
  assert.throws(() =>
    makeHomeworldRevivalReturn({
      ...tleilax,
      quote: { ...tleilax.quote, normal: 3 },
    }),
  );
  assert.throws(() =>
    makeHomeworldRevivalReturn({
      ...tleilax,
      source: 'ghola',
      card: 'ghola',
      group: { ...tleilax.group, free: 0 },
    }),
  );
});

void test('only the eligible typed reserve subset remains reserved; current high population is not recomputed', () => {
  const { g, frame } = fixture();
  g.players[0].reserves = 2;
  g.players[0].elites!.reserves = 2;
  validateHomeworldRevivalReturn(g, frame);
  choose(g, frame);
  validateHomeworldRevivalReturn(g, frame);
  g.players[0].elites!.reserves = 1;
  assert.throws(() => validateHomeworldRevivalReturn(g, frame));
  const tleilax = fixture('tleilax');
  tleilax.g.players[0].reserves = 2;
  validateHomeworldRevivalReturn(tleilax.g, tleilax.frame);
  tleilax.g.players[0].reserves = 1;
  assert.throws(() => validateHomeworldRevivalReturn(tleilax.g, tleilax.frame));
});

void test('waiting, choice and settled stages require their specific response and destination evidence', () => {
  const { g, frame } = fixture();
  assert.throws(() =>
    validateHomeworldRevivalReturn(g, { ...frame, resumeResponse: null }),
  );
  assert.throws(() =>
    validateHomeworldRevivalReturn(g, { ...frame, destination: 'decline' }),
  );
  assert.throws(() =>
    validateHomeworldRevivalReturn(g, { ...frame, stage: 'choice' }),
  );
  choose(g, frame);
  validateHomeworldRevivalReturn(g, frame);
  assert.throws(() =>
    validateHomeworldRevivalReturn(g, { ...frame, destination: 'sietchTabr' }),
  );
  assert.throws(() =>
    validateHomeworldRevivalReturn(g, { ...frame, stage: 'arrival' }),
  );
  frame.stage = 'arrival';
  g.homeworldRevivalProgress = makeHomeworldRevivalProgress(frame);
  frame.destination = 'sietchTabr';
  frame.ambassadors = [];
  frame.arrivalSignature = homeworldRevivalArrivalSignature(frame);
  g.players[0].reserves = 0;
  g.players[0].elites!.reserves = 0;
  validateHomeworldRevivalReturn(g, frame);
  g.turn++;
  assert.throws(() => validateHomeworldRevivalReturn(g, frame));
  frame.stage = 'complete';
  g.homeworldRevivalProgress = makeHomeworldRevivalProgress(frame);
  g.phase = 0;
  validateHomeworldRevivalReturn(
    g,
    JSON.parse(JSON.stringify(frame)) as HomeworldRevivalReturn,
  );
  frame.destination = 'decline';
  frame.arrivalSignature = homeworldRevivalArrivalSignature(frame);
  validateHomeworldRevivalReturn(g, frame);
});

void test('only original-recipient Tleilaxu revival income can be suspended, with Ghola fixed at one', () => {
  const { g, frame } = fixture('fedaykin', 'ghola');
  const response: Game['response'] = {
    kind: 'revivalIncome',
    owner: 'v',
    recipient: 'p',
    amount: 1,
    passed: [],
    intent: 'market-event',
  };
  choose(g, frame, response);
  validateHomeworldRevivalReturn(g, frame);
  response.passed.push('p');
  assert.deepEqual(frame.resumeResponse!.passed, []);
  const mutations = [
    { amount: 2 },
    { recipient: 'v' },
    { owner: 'p' },
    { kind: 'guildIncome' },
    { passed: ['absent'] },
    { passed: ['p', 'p'] },
  ];
  for (const patch of mutations) {
    const copy = structuredClone(frame);
    copy.resumeResponse = { ...copy.resumeResponse!, ...patch } as NonNullable<
      Game['response']
    >;
    copy.resumeSignature = homeworldRevivalResumeSignature(copy.resumeResponse);
    assert.throws(() => validateHomeworldRevivalReturn(g, copy));
  }
  frame.resumeResponse!.amount = 2;
  assert.throws(() => validateHomeworldRevivalReturn(g, frame));
});

void test('response proof is order-independent JSON but changing passed players requires new proof', () => {
  const { g, frame } = fixture();
  choose(g, frame, {
    kind: 'revivalIncome',
    owner: 'v',
    recipient: 'p',
    amount: 2,
    passed: [],
  });
  const response = frame.resumeResponse!;
  frame.resumeResponse = {
    passed: response.passed,
    amount: response.amount,
    recipient: response.recipient,
    owner: response.owner,
    kind: response.kind,
  };
  validateHomeworldRevivalReturn(g, frame);
  frame.resumeResponse.passed.push('p');
  assert.throws(() => validateHomeworldRevivalReturn(g, frame));
  assert.throws(() =>
    homeworldRevivalResumeSignature(undefined as unknown as Game['response']),
  );
});

void test('validation reads no hands, spice, Tanks, force locations or visitor secrets and does not mutate frozen receipts', () => {
  const { g, frame } = fixture();
  choose(g, frame);
  for (const player of g.players) {
    for (const field of ['hand', 'spice', 'tanks', 'forces', 'traitors'])
      Object.defineProperty(player, field, {
        get() {
          throw new Error(`Secret ${field}`);
        },
      });
    if (player.elites)
      for (const field of ['tanks', 'forces', 'revived'])
        Object.defineProperty(player.elites, field, {
          get() {
            throw new Error(`Secret elite ${field}`);
          },
        });
  }
  Object.defineProperty(g.homeworlds.custody, 'visitors', {
    get() {
      throw new Error('Visitor secrets');
    },
  });
  Object.freeze(frame.group);
  Object.freeze(frame.quote);
  Object.freeze(frame);
  validateHomeworldRevivalReturn(g, frame);
  assert.throws(() => validateHomeworldRevivalReturn(g, null));
  assert.throws(() => validateHomeworldRevivalReturn(g, undefined));
  const empty = { ...g, homeworldRevivalProgress: undefined };
  validateHomeworldRevivalReturn(empty, null);
  validateHomeworldRevivalReturn(empty, undefined);
});

void test('new progress cannot be removed, rewound, mismatched or downgraded to a legacy frame', () => {
  const { g, frame } = fixture();
  assert.equal(frame.progressVersion, 1);
  choose(g, frame);
  for (const edit of [
    (state: typeof g, _saved: HomeworldRevivalReturn) => {
      delete state.homeworldRevivalProgress;
    },
    (state: typeof g, _saved: HomeworldRevivalReturn) => {
      state.homeworldRevivalProgress!.stage = 'waiting';
    },
    (state: typeof g, _saved: HomeworldRevivalReturn) => {
      state.homeworldRevivalProgress!.event = 'another';
    },
    (_state: typeof g, saved: HomeworldRevivalReturn) => {
      delete saved.progressVersion;
    },
    (state: typeof g, saved: HomeworldRevivalReturn) => {
      delete state.homeworldRevivalProgress;
      delete saved.progressVersion;
    },
  ]) {
    const state = structuredClone(g),
      saved = structuredClone(frame);
    edit(state, saved);
    const before = JSON.stringify({ state, saved });
    assert.throws(() => validateHomeworldRevivalReturn(state, saved));
    assert.equal(JSON.stringify({ state, saved }), before);
  }
});

void test('completed legacy v0 signature bytes remain readable past their turn without creating progress', () => {
  const { g, frame } = fixture();
  choose(g, frame);
  frame.stage = 'complete';
  frame.destination = 'decline';
  frame.ambassadors = [];
  // This is the exact pre-version original tuple, not a migrated receipt.
  const oldSignature = JSON.parse(frame.signature) as unknown[];
  oldSignature.splice(-2);
  frame.signature = JSON.stringify(oldSignature);
  delete frame.progressVersion;
  delete g.homeworldRevivalProgress;
  frame.arrivalSignature = homeworldRevivalArrivalSignature(frame);
  g.turn++;
  g.phase = 1;
  const before = JSON.stringify({ g, frame });
  validateHomeworldRevivalReturn(g, frame);
  assert.equal(JSON.stringify({ g, frame }), before);
  assert.equal(g.homeworldRevivalProgress, undefined);
});
