import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTraitorDeclaration,
  validateTraitorDeclaration,
  validateTraitorDeclarations,
  type TraitorDeclarationContext,
  type TraitorDeclaration,
} from '../game/traitor-declarations';
import { CHEAP_HERO_TRAITOR } from '../game/traitors';

const context = (harkonnen = false): TraitorDeclarationContext => ({
  event: 'battle-4',
  attacker: 'a',
  defender: 'g',
  plans: { a: { leader: 'a-leader' }, g: { leader: 'g-leader' } },
  players: [
    {
      id: 'a',
      faction: 'atreides',
      ally: 'h',
      traitors: harkonnen ? ['a-other'] : ['g-leader'],
    },
    { id: 'g', faction: 'guild', traitors: ['a-leader'] },
    {
      id: 'h',
      faction: 'harkonnen',
      ally: 'a',
      traitors: harkonnen ? ['g-leader'] : ['h-other'],
    },
  ],
  heroLeaderIds: [],
});
const reload = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

void test('declarations preserve a valid call after its original identity leaves the hand', () => {
  for (const voter of ['a', 'g', 'h']) {
    const c = context(voter === 'h');
    const before = JSON.stringify(c);
    const receipt = createTraitorDeclaration(c, voter);
    assert.equal(JSON.stringify(c), before);
    c.players.find((p) => p.id === voter)!.traitors = ['other-identity'];
    const changed = JSON.stringify(c);
    validateTraitorDeclaration(c, reload(receipt));
    validateTraitorDeclarations(c, { [voter]: true }, { [voter]: receipt }, 1);
    assert.equal(JSON.stringify(c), changed);
    assert.throws(() => createTraitorDeclaration(c, voter), /must hold/);
    assert.equal(receipt.identity, voter === 'g' ? 'a-leader' : 'g-leader');
  }
});

void test('an allied Harkonnen declaration binds its beneficiary separately from its voter', () => {
  const c = context(true);
  const receipt = createTraitorDeclaration(c, 'h');
  assert.equal(receipt.voter, 'h');
  assert.equal(receipt.beneficiary, 'a');
  assert.equal(receipt.target, 'g');
  for (const ally of [null, 'g', 'missing']) {
    const changed = reload(c);
    changed.players[2].ally = ally;
    assert.throws(() => validateTraitorDeclaration(changed, receipt));
  }
  const nonHarkonnen = reload(c);
  nonHarkonnen.players[2].faction = 'fremen';
  assert.throws(() => createTraitorDeclaration(nonHarkonnen, 'h'));
});

void test('Cheap Hero receipt binds the sealed card ID to the shared physical traitor identity', () => {
  const c = context();
  c.plans.g.leader = 'cheap-hero-card-2';
  c.heroLeaderIds = ['cheap-hero-card-1', 'cheap-hero-card-2'];
  c.players[0].traitors = [CHEAP_HERO_TRAITOR];
  const receipt = createTraitorDeclaration(c, 'a');
  assert.equal(receipt.leader, 'cheap-hero-card-2');
  assert.equal(receipt.identity, CHEAP_HERO_TRAITOR);
  c.players[0].traitors = [];
  validateTraitorDeclaration(c, receipt);
  c.plans.g.leader = 'cheap-hero-card-1';
  assert.throws(() => validateTraitorDeclaration(c, receipt));
  c.plans.g.leader = 'cheap-hero-card-2';
  c.heroLeaderIds = [];
  assert.throws(() => validateTraitorDeclaration(c, receipt));
});

void test('missing leaders, Kwisatz protection and missing custody reject creation without mutation', () => {
  for (const mutate of [
    (c: TraitorDeclarationContext) => {
      c.plans.g.leader = null;
    },
    (c: TraitorDeclarationContext) => {
      c.plans.g.kwisatz = true;
    },
    (c: TraitorDeclarationContext) => {
      c.players[0].traitors = [];
    },
  ]) {
    const c = context();
    mutate(c);
    const before = JSON.stringify(c);
    assert.throws(() => createTraitorDeclaration(c, 'a'));
    assert.equal(JSON.stringify(c), before);
  }
});

void test('receipt edits, deleted fields and extra fields cannot change the committed identity', () => {
  const c = context();
  const original = createTraitorDeclaration(c, 'a');
  for (const field of Object.keys(original)) {
    for (const remove of [false, true]) {
      const receipt = reload(original);
      const writable = receipt as unknown as Record<string, unknown>;
      if (remove) delete writable[field];
      else writable[field] = 'changed';
      const before = JSON.stringify(receipt);
      assert.throws(() => validateTraitorDeclaration(c, receipt));
      assert.equal(JSON.stringify(receipt), before);
    }
  }
  assert.throws(() =>
    validateTraitorDeclaration(c, {
      ...original,
      hidden: 'unexpected',
    } as TraitorDeclaration),
  );
});

void test('battle, target leader, protection and roster corruption reject while seat ordering does not', () => {
  const c = context();
  const receipt = createTraitorDeclaration(c, 'a');
  for (const mutate of [
    (copy: TraitorDeclarationContext) => {
      copy.event = 'another-battle';
    },
    (copy: TraitorDeclarationContext) => {
      copy.plans.g.leader = 'replacement';
    },
    (copy: TraitorDeclarationContext) => {
      copy.plans.g.kwisatz = true;
    },
    (copy: TraitorDeclarationContext) => {
      copy.players[2].faction = 'fremen';
    },
    (copy: TraitorDeclarationContext) => {
      copy.players[2].id = 'other-seat';
    },
    (copy: TraitorDeclarationContext) => {
      copy.players[2].id = 'a';
    },
  ]) {
    const changed = reload(c);
    mutate(changed);
    assert.throws(() => validateTraitorDeclaration(changed, receipt));
  }
  c.players = [...c.players].reverse();
  validateTraitorDeclaration(c, receipt);
});

void test('a canceled false call retains evidence, but a false decision cannot be promoted by a new draw', () => {
  const c = context(true);
  const receipt = createTraitorDeclaration(c, 'h');
  validateTraitorDeclarations(c, { h: false }, { h: receipt }, 1);
  validateTraitorDeclarations(c, { a: false }, {}, 1);
  c.players[0].traitors = ['g-leader', 'new-traitor'];
  assert.throws(() => validateTraitorDeclarations(c, { a: true }, {}, 1));
  assert.throws(() => validateTraitorDeclarations(c, {}, { h: receipt }, 1));
  assert.throws(() =>
    validateTraitorDeclarations(c, { h: undefined }, { h: receipt }, 1),
  );
});

void test('versioned maps require every true call, exact voter keys and both metadata fields', () => {
  const c = context();
  const a = createTraitorDeclaration(c, 'a');
  const g = createTraitorDeclaration(c, 'g');
  validateTraitorDeclarations(c, { a: true, g: true }, { a, g }, 1);
  assert.throws(() =>
    validateTraitorDeclarations(c, { a: true, g: true }, { a }, 1),
  );
  assert.throws(() => validateTraitorDeclarations(c, { a: true }, { a: g }, 1));
  assert.throws(() =>
    validateTraitorDeclarations(c, { a: true }, undefined, 1),
  );
  assert.throws(() => validateTraitorDeclarations(c, { a: true }, { a }));
  assert.throws(() =>
    validateTraitorDeclarations(c, { a: true }, { a }, 2 as 1),
  );
  // Both absent is intentionally legacy; this does not certify historical calls.
  validateTraitorDeclarations(c, { a: true }, undefined);
});

void test('later validation does not read any private traitor hand', () => {
  const c = context();
  const receipt = createTraitorDeclaration(c, 'a');
  for (const player of c.players)
    Object.defineProperty(player, 'traitors', {
      get() {
        throw new Error('Private hand was read');
      },
    });
  validateTraitorDeclaration(c, receipt);
  validateTraitorDeclarations(c, { a: true }, { a: receipt }, 1);
});
