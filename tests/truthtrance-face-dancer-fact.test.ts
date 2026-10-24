import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuditorLeader, leaders } from '../game/cards';
import { DUKE_VIDAL_ID } from '../game/duke-vidal';
import { CHEAP_HERO_TRAITOR } from '../game/traitors';
import {
  faceDancerFactMatches,
  faceDancerFactText,
  parseFaceDancerFact,
  type FaceDancerFact,
} from '../game/truthtrance-face-dancer';

const guild = leaders('guild');
const auditor = createAuditorLeader();
const allowed = [...guild.map(leader => leader.id), auditor.id, CHEAP_HERO_TRAITOR];
const fact = (leader = guild[0].id): FaceDancerFact => ({ kind: 'faceDancer', leader });

void test('the current exact held unrevealed Face Dancer answers Yes without changing its holder or fact', () => {
  const holder = { faceDancers: [
    { leader: guild[0].id, revealed: false },
    { leader: guild[1].id, revealed: false },
    { leader: guild[2].id, revealed: true },
  ] };
  const question = parseFaceDancerFact(fact(), allowed);
  const before = structuredClone({ holder, question });
  assert.equal(faceDancerFactMatches(holder, question), true);
  assert.equal(faceDancerFactMatches(holder, fact(guild[1].id)), true);
  assert.equal(faceDancerFactMatches(holder, fact(guild[2].id)), false);
  assert.equal(faceDancerFactMatches(holder, fact(guild[3].id)), false);
  assert.deepEqual({ holder, question }, before);
});

void test('absent and empty Face Dancer hands are No even if the same ordinary Traitor is held', () => {
  const holder = { traitors: [guild[0].id], faceDancers: undefined };
  assert.equal(faceDancerFactMatches(holder, fact()), false);
  assert.equal(faceDancerFactMatches({ faceDancers: [] }, fact()), false);
  assert.equal(faceDancerFactMatches({ faceDancers: [
    { leader: guild[1].id, revealed: false },
  ] }, fact()), false);
});

void test('revealing or returning the matching card changes the current fact to No without future binding', () => {
  const held = { faceDancers: [{ leader: guild[0].id, revealed: false }] };
  const revealed = { faceDancers: [{ leader: guild[0].id, revealed: true }] };
  const returned = { faceDancers: [{ leader: guild[1].id, revealed: false }] };
  const question = fact();
  const before = structuredClone({ held, revealed, returned, question });
  assert.equal(faceDancerFactMatches(held, question), true);
  assert.equal(faceDancerFactMatches(revealed, question), false);
  assert.equal(faceDancerFactMatches(returned, question), false);
  assert.deepEqual({ held, revealed, returned, question }, before);
});

void test('only literal unrevealed false qualifies; a missing or nonboolean flag is not a hidden card', () => {
  for (const revealed of [undefined, null, 0, '', 'false']) {
    const holder = { faceDancers: [{ leader: guild[0].id, revealed }] };
    assert.equal(faceDancerFactMatches(
      holder as unknown as Parameters<typeof faceDancerFactMatches>[0], fact(),
    ), false);
  }
});

void test('known Auditor and shared Cheap Hero identities are valid when included in the physical game list', () => {
  for (const identity of [auditor.id, CHEAP_HERO_TRAITOR]) {
    const input = fact(identity);
    const parsed = parseFaceDancerFact(input, allowed);
    assert.deepEqual(parsed, input);
    assert.notEqual(parsed, input);
    assert.equal(faceDancerFactMatches({ faceDancers: [
      { leader: identity, revealed: false },
    ] }, parsed), true);
    assert.equal(faceDancerFactMatches({ faceDancers: [
      { leader: identity, revealed: true },
    ] }, parsed), false);
  }
});

void test('Duke is never a physical Face Dancer identity, including an accidentally permissive allowed list', () => {
  assert.throws(() => parseFaceDancerFact(fact(DUKE_VIDAL_ID), [...allowed, DUKE_VIDAL_ID]),
    /physical Traitor identity/);
});

void test('unknown, stale and unavailable identities reject instead of becoming an unheld No fact', () => {
  for (const identity of ['unknown-leader', 'atreides-0', 'cheap-hero', '', ' guild-0'])
    assert.throws(() => parseFaceDancerFact(fact(identity), allowed), /physical Traitor identity/);
  assert.throws(() => parseFaceDancerFact(fact(), []), /physical Traitor identity/);
  assert.throws(() => parseFaceDancerFact(fact(auditor.id), guild.map(leader => leader.id)),
    /physical Traitor identity/);
  assert.throws(() => parseFaceDancerFact(fact(CHEAP_HERO_TRAITOR), guild.map(leader => leader.id)),
    /physical Traitor identity/);
});

void test('the parser requires exactly the named current fact without mutating rejected input or the whitelist', () => {
  const identities = [...allowed];
  const before = [...identities];
  for (const value of [
    null, undefined, false, 1, guild[0].id, [], [fact()], {},
    { kind: 'faceDancer' },
    { leader: guild[0].id },
    { kind: 'traitor', leader: guild[0].id },
    { kind: 'faceDancer', leader: 0 },
    { kind: 'faceDancer', leader: null },
    { ...fact(), revealed: false },
    { ...fact(), future: true },
    { ...fact(), faction: 'tleilaxu' },
  ]) {
    const original = structuredClone(value);
    assert.throws(() => parseFaceDancerFact(value, identities));
    assert.deepEqual(value, original);
  }
  assert.deepEqual(identities, before);
  assert.throws(() => parseFaceDancerFact({ ...fact(), [Symbol('extra')]: true }, identities));
  assert.throws(() => parseFaceDancerFact(Object.create(fact()) as unknown, identities));
});

void test('wording names current unrevealed Face Dancer custody and leaves ordinary Traitor meaning distinct', () => {
  assert.equal(faceDancerFactText(fact(), identity => guild.find(leader => leader.id === identity)!.name),
    'you currently hold Staban Tuek as an unrevealed Face Dancer');
  assert.equal(faceDancerFactText(fact(auditor.id), () => auditor.name),
    'you currently hold Auditor as an unrevealed Face Dancer');
  assert.equal(faceDancerFactText(fact(CHEAP_HERO_TRAITOR), () => {
    assert.fail('The shared hero identity uses its canonical name without a physical leader lookup.');
  }), 'you currently hold Cheap Hero / Heroine as an unrevealed Face Dancer');
});
