import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, newPlayer, type Game, type Player } from '../game/engine';
import { createNexusCards, discardNexusCard, drawNexusCard, validateNexusCards } from '../game/nexus-cards';
import {
  createFremenNexusRevival,
  fremenNexusRevivalEvent,
  fremenNexusRevivalOffer,
  fremenNexusRevivalSignature,
  upgradeFremenNexusRevival,
  validateFremenNexusRevival,
  type FremenNexusRevival,
} from '../game/nexus-fremen-revival';
import { forceRevivalQuote, forceRevivalRemaining, newRevivalRules, normalRevivalAllowance } from '../game/revival';

/** Resolved-facts unit context, not a native gameplay chronology. Custody still
 * comes from the original inventory/draw API, never an edited private hand. */
function fixture(faction: Player['faction'] = 'guild', advanced = true): Game {
  const g = createGame('FQUOTA', newPlayer('q', 'Quota owner', faction), advanced);
  g.players.push(newPlayer('a', 'Atreides', 'atreides'), newPlayer('h', 'Harkonnen', 'harkonnen'));
  if (faction === 'atreides') g.players[1] = newPlayer('a', 'Guild', 'guild');
  g.status = 'playing';
  g.phase = 4;
  g.turn = 2;
  g.revivalRules = newRevivalRules();
  const p = g.players[0];
  p.reserves = 14;
  p.tanks = 6;
  p.spice = 17;
  p.revived = 0;
  p.freeForcesRevived = 0;
  if (p.elites) {
    p.elites.tanks = 0;
    p.elites.revived = 0;
  }
  const cards = createNexusCards(g.players, () => 0.5);
  cards.deck = ['fremen', ...cards.deck.filter(card => card !== 'fremen')];
  g.nexusCards = { cards: drawNexusCard(cards, 'q', g.players, () => 0.5), phase: null };
  return g;
}

/** Install the engine-owned receipt/permission contract on a copy so these
 * tests consume the shared ordinary arithmetic without introducing a new API. */
function granted(g: Game) {
  const receipt = createFremenNexusRevival(g, 'q');
  const result = structuredClone(g);
  result.revivalRules!.nexusFremen = { turn: result.turn, owners: ['q'] };
  result.nexusFremenRevivalHistory = [receipt];
  result.nexusFremenRevivalEvents = [receipt.event];
  result.nexusCards!.cards = discardNexusCard(result.nexusCards!.cards!, 'q', result.players);
  return result;
}

void test('a quota receipt changes no physical pieces, ledgers, wallet or custody', () => {
  const g = fixture();
  const before = structuredClone(g);
  const record = createFremenNexusRevival(g, 'q');
  assert.equal(record.version, 2);
  assert.equal(record.revivedAtUse, 0);
  assert.equal(record.freeAtUse, 0);
  assert.equal(Object.hasOwn(record, 'legacyReturn'), false);
  assert.equal(Object.hasOwn(record, 'before'), false);
  assert.equal(Object.hasOwn(record, 'after'), false);
  validateFremenNexusRevival(g, record);
  assert.deepEqual(g, before);
  const result = granted(g);
  assert.deepEqual(result.players, before.players);
  validateNexusCards(result.nexusCards!.cards!, result.players);
  assert.equal(result.nexusCards!.cards!.hands.q, null);
  assert.equal(result.nexusCards!.cards!.discard.includes('fremen'), true);
  assert.equal(fremenNexusRevivalOffer(result, 'q'), null);
  assert.equal(fremenNexusRevivalOffer(g, 'a'), null);
});

void test('partial Tanks and already-used native free returns leave legal partial quota', () => {
  const g = fixture();
  const p = g.players[0];
  p.revived = 1;
  p.freeForcesRevived = 1;
  p.tanks = 2;
  p.reserves = 18;
  const offer = fremenNexusRevivalOffer(g, 'q')!;
  assert.equal(offer.blocked, null);
  assert.equal(offer.freeRemaining, 2);
  assert.equal(offer.maxForces, 2);
  const result = granted(g);
  assert.equal(forceRevivalRemaining(result, result.players[0]), 2);
  assert.deepEqual(forceRevivalQuote(result, result.players[0], 1), { free: 1, normalCost: 0, cost: 0 });
  assert.deepEqual(forceRevivalQuote(result, result.players[0], 2), { free: 2, normalCost: 0, cost: 0 });
  // Actual ordinary free usage is shared with later partial requests.
  result.players[0].revived++;
  result.players[0].freeForcesRevived!++;
  result.players[0].tanks--;
  result.players[0].reserves++;
  assert.equal(normalRevivalAllowance(result, result.players[0]).freeRemaining, 1);
  assert.equal(forceRevivalQuote(result, result.players[0], 1).cost, 0);
});


void test('native higher quotas survive and never justify a useless Fremen discard', () => {
  const g = fixture('atreides');
  g.recruits = { turn: g.turn, player: 'q', card: 'ecaz-recruits' };
  assert.equal(normalRevivalAllowance(g, g.players[0]).freeRate, 4);
  assert.match(fremenNexusRevivalOffer(g, 'q')!.blocked!, /already at least three/);
  assert.throws(() => createFremenNexusRevival(g, 'q'));
  const result = structuredClone(g);
  result.revivalRules!.nexusFremen = { turn: g.turn, owners: ['q'] };
  assert.equal(normalRevivalAllowance(result, result.players[0]).freeRate, 4);
  assert.equal(normalRevivalAllowance(result, result.players[0]).limit, 7);
  const single = fixture();
  single.players[0].tanks = 1;
  assert.match(fremenNexusRevivalOffer(single, 'q')!.blocked!, /cannot improve/);
});

void test('Recruits doubles the native rate, not the fixed quota, and retains its seven-force limit', () => {
  const g = fixture('emperor');
  g.recruits = { turn: g.turn, player: 'q', card: 'ecaz-recruits' };
  assert.equal(normalRevivalAllowance(g, g.players[0]).freeRate, 2);
  assert.equal(fremenNexusRevivalOffer(g, 'q')!.blocked, null);
  const result = granted(g);
  const allowance = normalRevivalAllowance(result, result.players[0]);
  assert.equal(allowance.limit, 7);
  assert.equal(allowance.freeRate, 3);
  assert.equal(allowance.freeRemaining, 3);
  assert.equal(forceRevivalQuote(result, result.players[0], 4).cost, 2);
  result.players[0].revived = 3;
  result.players[0].freeForcesRevived = 3;
  assert.equal(forceRevivalQuote(result, result.players[0], 1).cost, 2);
});

void test('Cyborgs retain unlimited typed eligibility while Advanced Sardaukar retain their one-return cap', () => {
  const ix = fixture('ixians');
  ix.expansions = ['ix'];
  ix.players[0].tanks = 4;
  ix.players[0].elites!.tanks = 3;
  ix.players[0].elites!.revived = 1;
  assert.equal(fremenNexusRevivalOffer(ix, 'q')!.maxForces, 3);
  assert.equal(fremenNexusRevivalOffer(ix, 'q')!.blocked, null);
  const result = granted(ix);
  assert.deepEqual(forceRevivalQuote(result, result.players[0], 3, 3, 3), { free: 3, normalCost: 0, cost: 0 });
  result.recruits = { turn: result.turn, player: 'q', card: 'ecaz-recruits' };
  assert.equal(forceRevivalQuote(result, result.players[0], 4, 3, 2).cost, 3);
  const emperor = fixture('emperor');
  emperor.players[0].tanks = 3;
  emperor.players[0].elites = { reserves: 2, tanks: 3, forces: {}, revived: 0 };
  emperor.players[0].elites!.tanks = 3;
  assert.equal(fremenNexusRevivalOffer(emperor, 'q')!.maxForces, 1);
  emperor.players[0].elites!.revived = 1;
  assert.ok(fremenNexusRevivalOffer(emperor, 'q')!.blocked);
  emperor.advanced = false;
  assert.equal(fremenNexusRevivalOffer(emperor, 'q')!.maxForces, 3);
  assert.equal(fremenNexusRevivalOffer(emperor, 'q')!.blocked, null);
});

void test('ordinary free blocking and Tleilaxu prevention apply both before and after the grant', () => {
  for (const denial of ['free', 'prevention'] as const) {
    const g = fixture();
    if (denial === 'free') g.revivalRules!.freeBlocked = ['q'];
    else g.revivalPrevention = { turn: g.turn, player: 'q' };
    const before = structuredClone(g);
    assert.ok(fremenNexusRevivalOffer(g, 'q')!.blocked);
    assert.throws(() => createFremenNexusRevival(g, 'q'));
    assert.deepEqual(g, before);
  }
  const result = granted(fixture());
  result.revivalRules!.freeBlocked = ['q'];
  assert.equal(normalRevivalAllowance(result, result.players[0]).freeRemaining, 0);
  assert.equal(forceRevivalQuote(result, result.players[0], 1).cost, 2);
});

void test('ally, pending interaction, wrong phase and stale use cannot spend another grant', () => {
  const changes: Array<(g: Game) => void> = [
    g => { g.players[0].ally = 'a'; g.players[1].ally = 'q'; },
    g => { g.phase = 5; },
    g => { g.pendingRevival = { player: 'q' } as NonNullable<Game['pendingRevival']>; },
    g => { g.nexusFremenRevivalEvents = [fremenNexusRevivalEvent(g.turn, 'q')]; },
    g => { g.revivalRules!.nexusFremen = { turn: g.turn, owners: ['q'] }; },
  ];
  for (const change of changes) {
    const g = fixture();
    change(g);
    const before = structuredClone(g);
    assert.ok(fremenNexusRevivalOffer(g, 'q')!.blocked);
    assert.throws(() => createFremenNexusRevival(g, 'q'));
    assert.deepEqual(g, before);
  }
  const present = fixture();
  present.players.push(newPlayer('f', 'Fremen', 'fremen'));
  assert.equal(fremenNexusRevivalOffer(present, 'q'), null);
});

void test('unknown legacy free usage fails closed, while untouched zero use is unambiguous', () => {
  const g = fixture();
  delete g.players[0].freeForcesRevived;
  g.players[0].revived = 1;
  const before = structuredClone(g);
  assert.match(fremenNexusRevivalOffer(g, 'q')!.blocked!, /usage is unknown/);
  assert.throws(() => createFremenNexusRevival(g, 'q'), /usage is unknown/);
  assert.deepEqual(g, before);
  g.players[0].revived = 0;
  assert.equal(createFremenNexusRevival(g, 'q').freeAtUse, 0);
  assert.equal(g.players[0].freeForcesRevived, undefined);
});

void test('the quota expires with its turn and grants neither force-limit nor leader allowance', () => {
  const result = granted(fixture('choam'));
  assert.equal(normalRevivalAllowance(result, result.players[0]).limit, 20);
  assert.equal(normalRevivalAllowance(result, result.players[0]).freeRate, 3);
  assert.equal(result.players[0].leaderRevived, false);
  result.turn++;
  assert.equal(normalRevivalAllowance(result, result.players[0]).freeRate, 0);
  assert.equal(normalRevivalAllowance(result, result.players[0]).limit, 20);
  const ordinary = granted(fixture());
  assert.equal(normalRevivalAllowance(ordinary, ordinary.players[0]).limit, 3);
});

type LegacyReceipt = Omit<FremenNexusRevival,
  'version' | 'revivedAtUse' | 'freeAtUse' | 'policy' | 'legacyReturn'> &
  NonNullable<FremenNexusRevival['legacyReturn']>;

function legacy(g: Game, elite = 0): LegacyReceipt {
  const before = { reserves: 14, tanks: 6, eliteReserves: 0, eliteTanks: elite,
    eliteRevived: 0, revived: 0, freeForcesRevived: 0, spice: 17 };
  const record: LegacyReceipt = {
    event: fremenNexusRevivalEvent(g.turn, 'q'), owner: 'q', turn: g.turn,
    phase: 4, faction: g.players[0].faction, advanced: g.advanced, elite, before,
    after: { ...before, reserves: 17, tanks: 3, eliteReserves: elite, eliteTanks: 0,
      eliteRevived: elite, revived: 3, freeForcesRevived: 3 }, signature: '',
  };
  record.signature = JSON.stringify({ ...record, signature: undefined });
  return record;
}

void test('immutable legacy adoption retains the completed physical facts and exhausted quota', () => {
  const g = fixture('emperor');
  const old = legacy(g, 1);
  g.players[0].revived = 3;
  g.players[0].freeForcesRevived = 3;
  const before = structuredClone(g), oldBefore = structuredClone(old);
  const record = upgradeFremenNexusRevival(g, old);
  assert.deepEqual(record.legacyReturn, { elite: old.elite, before: old.before, after: old.after });
  assert.notEqual(record.legacyReturn!.before, old.before);
  assert.notEqual(record.legacyReturn!.after, old.after);
  assert.equal(record.revivedAtUse, 0);
  assert.equal(record.freeAtUse, 0);
  assert.equal(upgradeFremenNexusRevival(g, record), record);
  assert.deepEqual(old, oldBefore);
  assert.deepEqual(g, before);
  const adopted = structuredClone(g);
  adopted.revivalRules!.nexusFremen = { turn: g.turn, owners: ['q'] };
  assert.equal(normalRevivalAllowance(adopted, adopted.players[0]).freeRemaining, 0);
  assert.equal(forceRevivalRemaining(adopted, adopted.players[0]), 0);
});

void test('legacy signatures, exact shape, conservation and original Emperor cap must validate before adoption', () => {
  for (const change of [
    (old: LegacyReceipt) => { old.after.spice++; },
    (old: LegacyReceipt) => { old.after.tanks++; },
    (old: LegacyReceipt) => { old.before.revived = 1; },
    (old: LegacyReceipt) => { old.before.reserves = 20; },
    (old: LegacyReceipt) => { old.elite = 2; old.before.eliteTanks = 2; old.after.eliteReserves = 2; old.after.eliteRevived = 2; },
  ]) {
    const g = fixture('emperor');
    const old = legacy(g, 1);
    change(old);
    old.signature = JSON.stringify({ ...old, signature: undefined });
    const before = structuredClone(g), oldBefore = structuredClone(old);
    assert.throws(() => upgradeFremenNexusRevival(g, old), /original physical return/);
    assert.deepEqual(g, before);
    assert.deepEqual(old, oldBefore);
  }
  const g = fixture();
  const old = legacy(g);
  assert.throws(() => upgradeFremenNexusRevival(g, { ...old, extra: true }));
  assert.throws(() => upgradeFremenNexusRevival(g, { ...old, signature: 'tampered' }));
  assert.throws(() => upgradeFremenNexusRevival(fixture('ixians'), legacy(fixture('ixians'), 1)));
});

void test('malformed version-two source receipts reject without normalization or mutation', () => {
  const g = fixture();
  const receipt = createFremenNexusRevival(g, 'q');
  const malformed: unknown[] = [
    { ...receipt, version: 1 }, { ...receipt, signature: 'tampered' },
    { ...receipt, extra: true }, { ...receipt, freeAtUse: 1 },
    { ...receipt, revivedAtUse: -1 }, { ...receipt, turn: g.turn + 1 },
    { ...receipt, phase: 5 }, { ...receipt, policy: 'direct-return' },
    { ...receipt, owner: 'missing' }, { ...receipt, legacyReturn: undefined },
  ];
  for (const input of malformed) {
    const record = input as FremenNexusRevival;
    if (record.signature !== 'tampered') record.signature = fremenNexusRevivalSignature(record);
    const before = structuredClone(g), recordBefore = structuredClone(record);
    assert.throws(() => upgradeFremenNexusRevival(g, record));
    assert.deepEqual(g, before);
    assert.deepEqual(record, recordBefore);
  }
});
