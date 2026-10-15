import assert from 'node:assert/strict';
import test from 'node:test';
import { leaders } from '../game/cards';
import { DUKE_VIDAL_ID } from '../game/duke-vidal';
import {
  createMoritaniAssassinateOpportunity,
  moritaniAssassinateChoices,
  moritaniAssassinateSignature,
  moritaniAssassinateTrigger,
  quoteMoritaniAssassinate,
  validateMoritaniAssassinate,
  type MoritaniAssassinateContext,
  type MoritaniAssassinateReceipt,
  type MoritaniAssassinateTrigger,
} from '../game/moritani-assassinate';

function trigger(opposingLeader = 'harkonnen-0'): MoritaniAssassinateTrigger {
  return {
    advanced: true,
    owner: 'm',
    ownerFaction: 'moritani',
    opponent: 'h',
    faction: 'harkonnen',
    event: 'battle:2:arrakeen',
    turn: 2,
    territory: 'arrakeen',
    opposingLeader,
    opposingLeaderSurvived: true,
    normalBattle: true,
    lostBattle: true,
    traitorCalled: false,
  };
}
function fixture(opposingLeader = 'harkonnen-0'): MoritaniAssassinateContext {
  const receipt = createMoritaniAssassinateOpportunity(trigger(opposingLeader));
  return {
    state: { version: 1, owner: 'm', normalTraitorCall: false, opportunities: [receipt] },
    receipt,
    held: ['harkonnen-0', 'harkonnen-1', 'moritani-0', 'atreides-0', DUKE_VIDAL_ID, 'cheap-hero-traitor'],
    normallyRevealed: [],
    leaders: leaders('harkonnen'),
  };
}
function revised(
  receipt: MoritaniAssassinateReceipt,
  patch: Partial<MoritaniAssassinateReceipt>,
): MoritaniAssassinateReceipt {
  const result = { ...receipt, ...patch };
  result.signature = moritaniAssassinateSignature(result);
  return result;
}

void test('a surviving native Harkonnen battle disc excludes only its own card and permits a different printed Harkonnen victim', () => {
  const context = fixture();
  assert.equal(moritaniAssassinateTrigger(trigger()), true);
  assert.deepEqual(moritaniAssassinateChoices(context).cards.map(card => card.card), ['harkonnen-1']);
  assert.throws(() => quoteMoritaniAssassinate(context, 'harkonnen-0'));
  const quote = quoteMoritaniAssassinate(context, 'harkonnen-1');
  assert.equal(quote.kill, true);
  assert.equal(quote.bounty, 4);
  validateMoritaniAssassinate({ ...context.state, opportunities: [quote.receipt] }, {
    turn: 2, held: context.held, removed: [],
  });
  assert.throws(() => validateMoritaniAssassinate({
    ...context.state,
    opportunities: [revised(quote.receipt, { card: 'harkonnen-0', bounty: 6 })],
  }));
  assert.equal(moritaniAssassinateChoices({
    ...context, receipt: quote.receipt,
    state: { ...context.state, opportunities: [quote.receipt] },
  }).cards.length, 0);
});

void test('a Harkonnen win with a captured foreign disc, including Moritani, still exposes only printed Harkonnen targets', () => {
  for (const battleDisc of ['atreides-0', 'moritani-0', DUKE_VIDAL_ID]) {
    const context = fixture(battleDisc);
    // The authoritative engine supplies the actual controlled surviving disc.
    assert.equal(moritaniAssassinateTrigger(trigger(battleDisc)), true);
    assert.deepEqual(moritaniAssassinateChoices(context).cards.map(c => c.card), [
      'harkonnen-0', 'harkonnen-1',
    ]);
    const foreignCard = battleDisc === 'moritani-0' ? 'atreides-0' : 'moritani-0';
    assert.throws(() => quoteMoritaniAssassinate(context, foreignCard));
    const quote = quoteMoritaniAssassinate(context, 'harkonnen-0');
    assert.equal(quote.bounty, 6);
    assert.equal(quote.kill, true);
    const state = { ...context.state, opportunities: [quote.receipt] };
    validateMoritaniAssassinate(state, { turn: 2, held: context.held, removed: [] });
    // A signed receipt cannot reclassify the captured disc or Duke as the victim.
    assert.throws(() => validateMoritaniAssassinate({
      ...state,
      opportunities: [revised(quote.receipt, { card: battleDisc, bounty: 0 })],
    }));
  }
});

void test('Cheap Hero, missing disc, death, traitor calls and nonnormal outcomes cannot create a Harkonnen opportunity', () => {
  for (const patch of [
    { opposingLeader: 'cheap-hero-traitor' },
    { opposingLeader: 'cheap-hero' },
    { opposingLeader: 'choam-auditor' },
    { opposingLeader: 'harkonnen-5' },
    { opposingLeader: null },
    { opposingLeaderSurvived: false },
    { advanced: false },
    { normalBattle: false },
    { lostBattle: false },
    { traitorCalled: true },
  ]) {
    const input = { ...trigger(), ...patch };
    assert.equal(moritaniAssassinateTrigger(input), false);
    assert.throws(() => createMoritaniAssassinateOpportunity(input));
  }
  const context = fixture();
  assert.throws(() => validateMoritaniAssassinate({
    ...context.state,
    opportunities: [revised(context.receipt, { opposingLeader: 'cheap-hero-traitor' })],
  }));
});

void test('dead native Harkonnen targets consume the faction use without a second death or bounty', () => {
  const context = fixture('moritani-0');
  context.leaders[0].dead = true;
  context.leaders[0].deaths = 2;
  const before = structuredClone(context);
  const quote = quoteMoritaniAssassinate(context, 'harkonnen-0');
  assert.equal(quote.kill, false);
  assert.equal(quote.bounty, 0);
  const next = fixture(DUKE_VIDAL_ID);
  next.receipt = revised(next.receipt, { event: 'battle:2:carthag' });
  next.state.opportunities = [quote.receipt, next.receipt];
  assert.deepEqual(moritaniAssassinateChoices(next).cards, []);
  assert.throws(() => quoteMoritaniAssassinate(next, 'harkonnen-1'));
  assert.deepEqual(context, before);
});

void test('the normal own-card reveal forfeits Harkonnen assassination across turns while a decline does not consume it', () => {
  const context = fixture('atreides-0');
  const declined = revised(context.receipt, { stage: 'declined' });
  const next = fixture('moritani-0');
  next.receipt = revised(next.receipt, { event: 'battle:3:carthag', turn: 3 });
  next.state.opportunities = [declined, next.receipt];
  assert.equal(quoteMoritaniAssassinate(next, 'harkonnen-1').bounty, 4);
  next.state.normalTraitorCall = true;
  assert.deepEqual(moritaniAssassinateChoices(next).cards, []);
  assert.throws(() => quoteMoritaniAssassinate(next, 'harkonnen-1'));
});

void test('Harkonnen reveal retains its physical card until one distinct Mentat replacement and never resets faction use', () => {
  const context = fixture(DUKE_VIDAL_ID);
  const revealed = quoteMoritaniAssassinate(context, 'harkonnen-1').receipt;
  const state = { ...context.state, opportunities: [revealed] };
  assert.throws(() => validateMoritaniAssassinate(state, {
    turn: 2, held: ['moritani-0'], removed: ['harkonnen-1'],
  }));
  for (const replacement of ['harkonnen-1', DUKE_VIDAL_ID])
    assert.throws(() => validateMoritaniAssassinate({
      ...state, opportunities: [revised(revealed, { stage: 'replaced', replacement })],
    }));
  const replaced = revised(revealed, { stage: 'replaced', replacement: 'guild-2' });
  validateMoritaniAssassinate({ ...state, opportunities: [replaced] }, {
    turn: 3, held: ['guild-2'], removed: ['harkonnen-1'],
  });
  const next = fixture('harkonnen-0');
  next.receipt = revised(next.receipt, { event: 'battle:3:carthag', turn: 3 });
  next.state.opportunities = [replaced, next.receipt];
  assert.throws(() => quoteMoritaniAssassinate(next, 'harkonnen-1'));
  assert.throws(() => validateMoritaniAssassinate({
    ...state,
    opportunities: [replaced, revised(revealed, {
      event: 'battle:3:carthag', turn: 3, card: 'harkonnen-0', opposingLeader: 'moritani-0', bounty: 6,
    })],
  }));
});

void test('admitting Harkonnen battle captives does not relax exceptional target custody', () => {
  for (const patch of [
    { capturedBy: 'other' },
    { gholaBy: 'other' },
    { controller: 'other' },
    { concealed: { captor: 'other', dead: false, deaths: 0 } },
  ]) {
    const context = fixture('moritani-0');
    Object.assign(context.leaders[1], patch);
    assert.deepEqual(moritaniAssassinateChoices(context).cards.map(c => c.card), ['harkonnen-0']);
    assert.throws(() => quoteMoritaniAssassinate(context, 'harkonnen-1'));
  }
});
