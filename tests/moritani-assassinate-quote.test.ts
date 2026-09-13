import assert from 'node:assert/strict';
import test from 'node:test';
import { leaders } from '../game/cards';
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

function fixture(
  faction: MoritaniAssassinateTrigger['faction'] = 'atreides',
  event = 'battle:2:arrakeen',
): MoritaniAssassinateContext {
  const input: MoritaniAssassinateTrigger = {
    advanced: true,
    owner: 'm',
    ownerFaction: 'moritani',
    opponent: 'a',
    faction,
    event,
    turn: 2,
    territory: 'arrakeen',
    opposingLeader: `${faction}-0`,
    opposingLeaderSurvived: true,
    normalBattle: true,
    lostBattle: true,
    traitorCalled: false,
  };
  const receipt = createMoritaniAssassinateOpportunity(input);
  return {
    state: {
      version: 1,
      owner: 'm',
      normalTraitorCall: false,
      opportunities: [receipt],
    },
    receipt,
    held: [
      `${faction}-0`,
      `${faction}-1`,
      `${faction}-2`,
      'moritani-0',
      'cheap-hero-traitor',
    ],
    normallyRevealed: [],
    leaders: leaders(faction),
  };
}
function revised(
  receipt: MoritaniAssassinateReceipt,
  patch: Partial<MoritaniAssassinateReceipt>,
) {
  const r = { ...receipt, ...patch };
  r.signature = moritaniAssassinateSignature(r);
  return r;
}

void test('public trigger requires a native Advanced Moritani normal loss, a surviving native opposing disc and no actual traitor call', () => {
  const input: MoritaniAssassinateTrigger = {
    advanced: true,
    owner: 'm',
    ownerFaction: 'moritani',
    opponent: 'a',
    faction: 'atreides',
    event: 'battle',
    turn: 2,
    territory: 'arrakeen',
    opposingLeader: 'atreides-0',
    opposingLeaderSurvived: true,
    normalBattle: true,
    lostBattle: true,
    traitorCalled: false,
  };
  assert.equal(moritaniAssassinateTrigger(input), true);
  for (const patch of [
    { advanced: false },
    { ownerFaction: 'atreides' },
    { opponent: 'm' },
    { lostBattle: false },
    { normalBattle: false },
    { opposingLeaderSurvived: false },
    { traitorCalled: true },
    { opposingLeader: null },
    { opposingLeader: 'cheap-hero-traitor' },
    { opposingLeader: 'emperor-0' },
    { faction: 'harkonnen', opposingLeader: 'harkonnen-0' },
    { faction: 'ecaz', opposingLeader: 'ecaz-0' },
    { turn: 0 },
    { turn: 1.5 },
    { event: '' },
  ]) {
    const invalid = { ...input, ...patch } as MoritaniAssassinateTrigger,
      before = structuredClone(invalid);
    assert.equal(moritaniAssassinateTrigger(invalid), false);
    assert.throws(
      () => createMoritaniAssassinateOpportunity(invalid),
      /Assassinate/,
    );
    assert.deepEqual(invalid, before);
  }
  for (const faction of [
    'atreides',
    'beneGesserit',
    'guild',
    'emperor',
    'fremen',
  ] as const)
    assert.equal(
      moritaniAssassinateTrigger({
        ...input,
        faction,
        opposingLeader: `${faction}-0`,
      }),
      true,
    );
});

void test('only a different held native Traitor Card is selectable, and live targets pay exactly their printed strength without mutating inputs', () => {
  for (const faction of [
    'atreides',
    'beneGesserit',
    'guild',
    'emperor',
    'fremen',
  ] as const) {
    const context = fixture(faction),
      before = structuredClone(context),
      native = context.leaders[1];
    const choices = moritaniAssassinateChoices(context);
    assert.equal(choices.blocked, null);
    assert.deepEqual(choices.unavailable, []);
    assert.deepEqual(
      choices.cards.map((c) => c.card),
      [`${faction}-1`, `${faction}-2`],
    );
    const quote = quoteMoritaniAssassinate(context, native.id);
    assert.equal(quote.leader, native.id);
    assert.equal(quote.bounty, native.strength);
    assert.equal(quote.kill, true);
    assert.equal(quote.receipt.stage, 'revealed');
    assert.equal(quote.receipt.card, native.id);
    assert.equal(quote.receipt.replacement, null);
    validateMoritaniAssassinate(
      { ...context.state, opportunities: [quote.receipt] },
      { turn: 2, held: context.held, removed: [] },
    );
    assert.deepEqual(context, before);
    for (const card of [
      `${faction}-0`,
      'moritani-0',
      'cheap-hero-traitor',
      `${faction}-4`,
    ]) {
      assert.throws(() => quoteMoritaniAssassinate(context, card), /eligible/);
      assert.deepEqual(context, before);
    }
  }
});

void test('already-dead targets remain revealable for no death or spice, while prior use locations do not remove a live target', () => {
  const context = fixture();
  context.leaders[1].dead = true;
  context.leaders[1].deaths = 2;
  context.leaders[2].usedAt = 'carthag';
  const before = structuredClone(context);
  assert.deepEqual(moritaniAssassinateChoices(context).cards[0], {
    card: 'atreides-1',
    name: context.leaders[1].name,
    bounty: 0,
    dead: true,
  });
  const dead = quoteMoritaniAssassinate(context, 'atreides-1');
  assert.equal(dead.kill, false);
  assert.equal(dead.bounty, 0);
  assert.equal(dead.receipt.stage, 'revealed');
  assert.equal(quoteMoritaniAssassinate(context, 'atreides-2').kill, true);
  validateMoritaniAssassinate(
    { ...context.state, opportunities: [dead.receipt] },
    { turn: 2, held: context.held, removed: [] },
  );
  assert.deepEqual(context, before);
});

void test('ordinary traitor-call ambiguity and already normally revealed cards stay explicit private guards', () => {
  const context = fixture();
  context.state.normalTraitorCall = true;
  assert.match(
    moritaniAssassinateChoices(context).blocked!,
    /ordinary.*duration ruling/,
  );
  assert.throws(
    () => quoteMoritaniAssassinate(context, 'atreides-1'),
    /duration ruling/,
  );
  context.state.normalTraitorCall = false;
  context.normallyRevealed = ['atreides-1'];
  const choices = moritaniAssassinateChoices(context);
  assert.deepEqual(
    choices.cards.map((c) => c.card),
    ['atreides-2'],
  );
  assert.match(choices.unavailable[0].reason, /normally revealed/);
  assert.throws(
    () => quoteMoritaniAssassinate(context, 'atreides-1'),
    /eligible/,
  );
  context.normallyRevealed = ['atreides-1', 'atreides-2'];
  assert.match(
    moritaniAssassinateChoices(context).blocked!,
    /normally revealed/,
  );
});

void test('missing, duplicated, altered or exceptional target custody cannot select another physical leader or invent bounty', () => {
  for (const damage of [
    (c: MoritaniAssassinateContext) => {
      c.leaders = c.leaders.filter((l) => l.id !== 'atreides-1');
    },
    (c: MoritaniAssassinateContext) => {
      c.leaders = [...c.leaders, c.leaders[1]];
    },
    (c: MoritaniAssassinateContext) => {
      c.leaders[1].strength = 99;
    },
    (c: MoritaniAssassinateContext) => {
      c.leaders[1].name = 'Wrong disc';
    },
    (c: MoritaniAssassinateContext) => {
      c.leaders[1].faction = 'guild';
    },
    (c: MoritaniAssassinateContext) => {
      c.leaders[1].capturedBy = 'other';
    },
    (c: MoritaniAssassinateContext) => {
      c.leaders[1].gholaBy = 'other';
    },
    (c: MoritaniAssassinateContext) => {
      c.leaders[1].controller = null;
    },
    (c: MoritaniAssassinateContext) => {
      c.leaders[1].concealed = { captor: 'other', dead: false, deaths: 0 };
    },
  ]) {
    const context = fixture();
    damage(context);
    const before = structuredClone(context);
    const choices = moritaniAssassinateChoices(context);
    assert.ok(!choices.cards.some((c) => c.card === 'atreides-1'));
    assert.match(
      choices.unavailable.find((c) => c.card === 'atreides-1')!.reason,
      /custody/,
    );
    assert.throws(
      () => quoteMoritaniAssassinate(context, 'atreides-1'),
      /eligible/,
    );
    assert.deepEqual(context, before);
  }
});

void test('a revealed card remains held until one Mentat replacement, and the used opposing faction cannot be assassinated again', () => {
  const context = fixture(),
    revealed = quoteMoritaniAssassinate(context, 'atreides-1').receipt;
  const state = { ...context.state, opportunities: [revealed] };
  validateMoritaniAssassinate(state, {
    turn: 2,
    held: context.held,
    removed: [],
  });
  assert.throws(
    () =>
      validateMoritaniAssassinate(state, {
        turn: 2,
        held: context.held.filter((c) => c !== 'atreides-1'),
        removed: ['atreides-1'],
      }),
    /stay held/,
  );
  assert.throws(
    () =>
      validateMoritaniAssassinate(state, {
        turn: 3,
        held: context.held,
        removed: [],
      }),
    /stay held/,
  );
  const replaced = revised(revealed, {
    stage: 'replaced',
    replacement: 'moritani-4',
  });
  state.opportunities = [replaced];
  validateMoritaniAssassinate(state, {
    turn: 3,
    held: [...context.held.filter((c) => c !== 'atreides-1'), 'moritani-4'],
    removed: ['atreides-1'],
  });
  const next = fixture('atreides', 'battle:3:carthag');
  next.receipt.turn = 3;
  next.receipt.signature = moritaniAssassinateSignature(next.receipt);
  next.state.opportunities = [replaced, next.receipt];
  assert.match(moritaniAssassinateChoices(next).blocked!, /already been used/);
  assert.throws(
    () => quoteMoritaniAssassinate(next, 'atreides-2'),
    /already been used/,
  );
});

void test('declining keeps all cards and allows a later loss; distinct opposing factions may each use one card', () => {
  const context = fixture(),
    declined = revised(context.receipt, { stage: 'declined' });
  const retry = fixture('atreides', 'retry');
  retry.state.opportunities = [declined, retry.receipt];
  assert.equal(moritaniAssassinateChoices(retry).blocked, null);
  const first = quoteMoritaniAssassinate(retry, 'atreides-1').receipt;
  const other = fixture('guild', 'guild-battle');
  other.state.opportunities = [declined, first, other.receipt];
  const second = quoteMoritaniAssassinate(other, 'guild-1').receipt;
  validateMoritaniAssassinate(
    { ...other.state, opportunities: [declined, first, second] },
    { turn: 2, held: ['atreides-1', 'guild-1'], removed: [] },
  );
  assert.deepEqual(context.state.opportunities, [context.receipt]);
});

void test('signed JSON state rejects changed events, invalid stage fields, duplicate faction use, invented bounty and reopened physical custody', () => {
  const context = fixture(),
    revealed = quoteMoritaniAssassinate(context, 'atreides-1').receipt;
  const state = { ...context.state, opportunities: [revealed] },
    before = structuredClone(state);
  validateMoritaniAssassinate(JSON.parse(JSON.stringify(state)), {
    turn: 2,
    held: context.held,
    removed: [],
  });
  for (const patch of [
    { bounty: 999 },
    { card: 'atreides-0' },
    { card: 'guild-1' },
    { replacement: 'guild-0' },
    { stage: 'choice' },
    { stage: 'replaced', replacement: 'unknown' },
    { stage: 'replaced', replacement: 'atreides-1' },
    { owner: 'x' },
    { faction: 'harkonnen' },
    { opposingLeader: 'cheap-hero-traitor' },
  ] as Partial<MoritaniAssassinateReceipt>[]) {
    const damaged = { ...state, opportunities: [revised(revealed, patch)] };
    const unchanged = structuredClone(damaged);
    assert.throws(() => validateMoritaniAssassinate(damaged), /Assassinate/);
    assert.deepEqual(damaged, unchanged);
  }
  assert.throws(
    () =>
      validateMoritaniAssassinate({
        ...state,
        opportunities: [revealed, structuredClone(revealed)],
      }),
    /duplicated/,
  );
  assert.throws(
    () =>
      validateMoritaniAssassinate({
        ...state,
        opportunities: [
          revealed,
          revised(revealed, { event: 'other', card: 'atreides-2', bounty: 4 }),
        ],
      }),
    /once per opposing faction/,
  );
  assert.throws(
    () =>
      validateMoritaniAssassinate({
        ...state,
        opportunities: [{ ...revealed, event: 'changed' }],
      }),
    /changed/,
  );
  assert.throws(
    () =>
      validateMoritaniAssassinate(state, {
        turn: 2,
        held: context.held,
        removed: ['atreides-1'],
      }),
    /overlapping/,
  );
  assert.deepEqual(state, before);
  const stale = fixture();
  stale.receipt = { ...stale.receipt, event: 'stale' };
  assert.throws(() => moritaniAssassinateChoices(stale), /original saved/);
});
