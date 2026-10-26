import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AlliancePromiseError,
  allianceClaimText,
  alliancePromiseModeSupported,
  alliancePromiseRequirements,
  alliancePromisesMatch,
  findAlliancePromisePlan,
  liveAlliancePromises,
  parseAllianceClaim,
  validateAlliancePromises,
  type AllianceOpportunity,
  type AlliancePromise,
} from '../game/alliance-promises';
import { quoteNexusAlliance } from '../game/nexus-alliance';

const seats = ['respondent', 'partner-a', 'partner-b', 'asker'] as const;
const opportunity = (): AllianceOpportunity => ({ turn: 2, source: 'original-worm-nexus' });
function promise(event: string, partner = 'partner-a', extra: Partial<AlliancePromise> = {}): AlliancePromise {
  return { event, turn: 2, source: 'original-worm-nexus', player: 'respondent', asker: 'asker',
    partner, answer: true, ...extra };
}
function context() {
  return { players: seats.map(id => ({ id, ally: null as string | null })), offers: {} as Record<string, string> };
}
function executePlan(state: ReturnType<typeof context>, actions: { type: 'alliance'; target: string | null }[]) {
  let current = structuredClone(state);
  for (const action of actions) {
    const quote = quoteNexusAlliance({ ...current, actor: 'respondent', target: action.target });
    current = { players: current.players.map(player => ({ ...player, ally: quote.allies[player.id] })), offers: quote.offers };
  }
  return current;
}

void test('alliance claims normalize current-turn partner identity without retaining private Nexus sources', () => {
  const input = { turn: 2, partner: 'partner-a', source: 'private-source', event: 'private-event' };
  assert.deepEqual(parseAllianceClaim(input), { turn: 2, partner: 'partner-a' });
  assert.deepEqual(parseAllianceClaim({ turn: Number.MAX_SAFE_INTEGER, partner: 'partner-a' }),
    { turn: Number.MAX_SAFE_INTEGER, partner: 'partner-a' });
  for (const turn of [0, -1, 1.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '2', null, undefined])
    assert.throws(() => parseAllianceClaim({ ...input, turn }), AlliancePromiseError);
  for (const partner of ['', ' ', ' partner-a', 'partner-a ', 1, null, undefined])
    assert.throws(() => parseAllianceClaim({ ...input, partner }), AlliancePromiseError);
  for (const value of [null, undefined, [], 'partner-a', 2]) assert.throws(() => parseAllianceClaim(value), AlliancePromiseError);
  const text = allianceClaimText(parseAllianceClaim(input), id => id === 'partner-a' ? 'Atreides' : id);
  assert.match(text, /be allied with Atreides when this Nexus ends/);
  assert.doesNotMatch(text, /private-source|private-event/);
});

void test('alliance promises retain bare native Basic and Advanced scope and do not require optional Nexus Cards', () => {
  const classic = { advanced: false, expansions: [], players: [{ faction: 'atreides' }, { faction: 'emperor' }] };
  const native = { advanced: true, expansions: ['ix', 'choam', 'ecaz'],
    players: ['ixians', 'tleilaxu', 'choam', 'richese', 'ecaz', 'moritani'].map(faction => ({ faction })) };
  for (const game of [classic, { ...classic, advanced: true }, native, { ...native, advanced: false },
    { ...classic, expansions: ['ix', 'choam', 'ecaz'] },
    { ...classic, advanced: true, expansions: ['ecaz'], players: [{ faction: 'moritani' }, { faction: 'harkonnen' }] },
  ]) assert.equal(alliancePromiseModeSupported(game), true);
  for (const option of ['homeworlds', 'nexusCards', 'leaderSkills', 'techTokens', 'strongholdCards',
    'discoveryEnabled', 'discoveries', 'discoveryStash', 'greatMaker', 'ecazTreachery',
    'semutaPreview', 'kullPreview', 'nexusKullPreview', 'richeseBetrayalPreview'] as const)
    assert.equal(alliancePromiseModeSupported({ ...native, [option]: true }), false, option);
  for (const game of [
    { ...native, expansions: ['ix', 'choam'] }, { ...native, expansions: ['ix', 'ix', 'ecaz'] },
    { ...classic, expansions: ['unknown'] }, { ...classic, players: [{ faction: 'atreides' }, { faction: 'unknown' }] },
    { ...classic, players: [{ faction: 'atreides' }] }, { ...classic, players: [...native.players, { faction: 'atreides' }] },
    { ...classic, advanced: 'basic' as unknown as boolean },
  ]) assert.equal(alliancePromiseModeSupported(game), false);
});

void test('joint answers require one distinct Yes partner while independent No partners remain forbidden', () => {
  const records = [promise('yes-a'), promise('yes-a-again'),
    promise('no-b', 'partner-b', { answer: false }), promise('no-b-again', 'partner-b', { answer: false }),
    promise('no-asker', 'asker', { answer: false })];
  assert.deepEqual(alliancePromiseRequirements(records, 'respondent', opportunity()),
    { partner: 'partner-a', forbidden: ['partner-b', 'asker'] });
  assert.equal(alliancePromisesMatch(records, 'respondent', opportunity(), 'partner-a'), true);
  assert.equal(alliancePromisesMatch(records, 'respondent', opportunity(), null), false);
  assert.equal(alliancePromiseRequirements([...records, promise('yes-b', 'partner-b')], 'respondent', opportunity()), null);
  assert.equal(alliancePromiseRequirements([...records, promise('no-a', 'partner-a', { answer: false })], 'respondent', opportunity()), null);
  assert.equal(findAlliancePromisePlan([...records, promise('yes-b', 'partner-b')], 'respondent', opportunity(), context()), null);
});

void test('an unallied Yes target requires actual outgoing consent and never assumes a future foreign break or acceptance', () => {
  const records = [promise('yes-a')]; const none = context();
  assert.equal(findAlliancePromisePlan(records, 'respondent', opportunity(), none), null);
  const ownOffer = { ...none, offers: { respondent: 'partner-a' } };
  assert.equal(findAlliancePromisePlan(records, 'respondent', opportunity(), ownOffer), null,
    'An own proposal does not control the other player’s future acceptance');
  const incoming = { ...none, offers: { 'partner-a': 'respondent' } };
  const plan = findAlliancePromisePlan(records, 'respondent', opportunity(), incoming);
  assert.deepEqual(plan, [{ type: 'alliance', target: 'partner-a' }]); assert.ok(plan);
  const completed = executePlan(incoming, plan);
  assert.equal(completed.players.find(player => player.id === 'respondent')!.ally, 'partner-a');
  const occupied = structuredClone(incoming);
  occupied.players.find(player => player.id === 'partner-a')!.ally = 'partner-b';
  occupied.players.find(player => player.id === 'partner-b')!.ally = 'partner-a';
  assert.equal(findAlliancePromisePlan(records, 'respondent', opportunity(), occupied), null,
    'Even an outstanding offer does not authorize breaking the desired partner’s current alliance');
  assert.equal(findAlliancePromisePlan(records, 'respondent', opportunity(), { ...none, offers: { 'partner-a': 'asker' } }), null);
});

void test('an owned break can precede acceptance only while the desired partner offer survives the canonical quotes', () => {
  const state = context();
  state.players.find(player => player.id === 'respondent')!.ally = 'partner-b';
  state.players.find(player => player.id === 'partner-b')!.ally = 'respondent';
  state.offers = { respondent: 'asker', 'partner-a': 'respondent', 'partner-b': 'asker', asker: 'partner-b' };
  const before = structuredClone(state); state.players.forEach(Object.freeze); Object.freeze(state.players);
  Object.freeze(state.offers); Object.freeze(state);
  const records = [promise('yes-a'), promise('no-b', 'partner-b', { answer: false })];
  const plan = findAlliancePromisePlan(records, 'respondent', opportunity(), state);
  assert.deepEqual(plan, [{ type: 'alliance', target: null }, { type: 'alliance', target: 'partner-a' }]); assert.ok(plan);
  const completed = executePlan(state, plan);
  assert.deepEqual(completed.players.map(player => [player.id, player.ally]), [
    ['respondent', 'partner-a'], ['partner-a', 'respondent'], ['partner-b', null], ['asker', null],
  ]);
  assert.deepEqual(completed.offers, { 'partner-b': 'asker', asker: 'partner-b' },
    'An unrelated reciprocal proposal is not executed on either foreign player’s behalf');
  assert.deepEqual(state, before);
});

void test('No constrains final membership and permits temporary proposals or a currently different alliance', () => {
  const records = [promise('no-a', 'partner-a', { answer: false })];
  const unallied = { ...context(), offers: { respondent: 'partner-a' } };
  assert.equal(alliancePromisesMatch(records, 'respondent', opportunity(), null), true);
  assert.deepEqual(findAlliancePromisePlan(records, 'respondent', opportunity(), unallied), [],
    'A proposal itself is not final alliance membership');
  const other = context();
  other.players.find(player => player.id === 'respondent')!.ally = 'partner-b';
  other.players.find(player => player.id === 'partner-b')!.ally = 'respondent';
  assert.deepEqual(findAlliancePromisePlan(records, 'respondent', opportunity(), other), []);
  const forbidden = context();
  forbidden.players.find(player => player.id === 'respondent')!.ally = 'partner-a';
  forbidden.players.find(player => player.id === 'partner-a')!.ally = 'respondent';
  assert.equal(alliancePromisesMatch(records, 'respondent', opportunity(), 'partner-a'), false);
  const plan = findAlliancePromisePlan(records, 'respondent', opportunity(), forbidden);
  assert.deepEqual(plan, [{ type: 'alliance', target: null }]); assert.ok(plan);
  const final = executePlan(forbidden, plan).players.find(player => player.id === 'respondent')!.ally;
  assert.equal(alliancePromisesMatch(records, 'respondent', opportunity(), final), true);
});

void test('an already held required partner needs no action but a foreign break removes the owned completion until renewed consent', () => {
  const state = context();
  state.players.find(player => player.id === 'respondent')!.ally = 'partner-a';
  state.players.find(player => player.id === 'partner-a')!.ally = 'respondent';
  const records = [promise('yes-a')];
  assert.deepEqual(findAlliancePromisePlan(records, 'respondent', opportunity(), state), []);
  const broken = quoteNexusAlliance({ ...state, actor: 'partner-a', target: null });
  const afterBreak = { players: state.players.map(player => ({ ...player, ally: broken.allies[player.id] })), offers: broken.offers };
  assert.equal(alliancePromisesMatch(records, 'respondent', opportunity(), null), false);
  assert.equal(findAlliancePromisePlan(records, 'respondent', opportunity(), afterBreak), null);
  const renewed = quoteNexusAlliance({ ...afterBreak, actor: 'partner-a', target: 'respondent' });
  const afterOffer = { players: afterBreak.players.map(player => ({ ...player, ally: renewed.allies[player.id] })), offers: renewed.offers };
  assert.deepEqual(findAlliancePromisePlan(records, 'respondent', opportunity(), afterOffer), [{ type: 'alliance', target: 'partner-a' }]);
  assert.equal(records[0].fulfilled, undefined); assert.equal(records[0].released, undefined,
    'Planning never records the real interval’s completion or forced release');
});

void test('turn, Nexus source, respondent and terminal records isolate the current final-membership obligation', () => {
  const live = promise('live');
  const records = [live, promise('other-turn', 'partner-b', { turn: 1 }),
    promise('other-source', 'partner-b', { source: 'different-worm-same-turn' }),
    promise('other-player', 'partner-b', { player: 'partner-a' }),
    promise('fulfilled', 'partner-b', { fulfilled: true }), promise('released', 'partner-b', { released: true })];
  const before = structuredClone(records); records.forEach(Object.freeze); Object.freeze(records);
  assert.deepEqual(liveAlliancePromises(records, 'respondent', opportunity()), [live]);
  assert.deepEqual(alliancePromiseRequirements(records, 'respondent', opportunity()), { partner: 'partner-a', forbidden: [] });
  assert.equal(alliancePromisesMatch(records, 'respondent', opportunity(), 'partner-a'), true);
  assert.equal(alliancePromisesMatch(records, 'respondent', opportunity(), 'partner-b'), false);
  assert.deepEqual(alliancePromiseRequirements(records, 'absent', opportunity()), { partner: null, forbidden: [] });
  assert.equal(alliancePromisesMatch(records, 'absent', opportunity(), null), true);
  assert.deepEqual(records, before);
});

void test('no clauses or only terminal answers need no owned change and unknown actors cannot receive a plan', () => {
  assert.deepEqual(findAlliancePromisePlan([], 'respondent', opportunity(), context()), []);
  const records = [promise('old-yes', 'partner-a', { fulfilled: true }),
    promise('released-no', 'partner-b', { answer: false, released: true })];
  assert.deepEqual(findAlliancePromisePlan(records, 'respondent', opportunity(), context()), []);
  assert.equal(findAlliancePromisePlan([], 'absent', opportunity(), context()), null);
  assert.deepEqual(alliancePromiseRequirements([promise('no-a', 'partner-a', { answer: false }),
    promise('no-b', 'partner-b', { answer: false })], 'respondent', opportunity()),
  { partner: null, forbidden: ['partner-a', 'partner-b'] });
});

void test('record validation retains original interval, event and participants without rechecking historical terminal membership', () => {
  const valid = [promise('live'), promise('fulfilled-yes', 'partner-b', { fulfilled: true }),
    promise('released-yes', 'partner-a', { released: true }),
    promise('fulfilled-no', 'partner-b', { answer: false, fulfilled: true }),
    promise('released-no', 'partner-a', { answer: false, released: true }),
    promise('asker-is-partner', 'asker')];
  const before = structuredClone(valid);
  assert.doesNotThrow(() => validateAlliancePromises(valid, seats)); assert.deepEqual(valid, before);
  assert.doesNotThrow(() => validateAlliancePromises(JSON.parse(JSON.stringify(valid)) as AlliancePromise[], seats));
  assert.doesNotThrow(() => validateAlliancePromises([], seats));
  const base = promise('event');
  const invalid: unknown[] = [null, {}, [null], [base, { ...base }],
    ...[{ event: '' }, { event: ' ' }, { source: '' }, { source: ' ' },
      { player: 'outsider' }, { asker: 'outsider' }, { asker: 'respondent' },
      { partner: 'outsider' }, { partner: 'respondent' }, { partner: ' partner-a' },
      { answer: 'yes' }, { fulfilled: 1 }, { released: 'true' }, { fulfilled: true, released: true },
      { turn: 0 }].map(extra => [{ ...base, ...extra }])];
  for (const records of invalid)
    assert.throws(() => validateAlliancePromises(records as AlliancePromise[], seats), AlliancePromiseError);
  assert.deepEqual(valid, before);
});
