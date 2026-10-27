import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, newPlayer, type Game } from '../game/engine';
import { FACTIONS, type FactionId } from '../game/catalog';
import { createNexusCards, discardNexusCard } from '../game/nexus-cards';
import { createTechTokens } from '../game/tech-tokens';
import { createStrongholdCards } from '../game/stronghold-cards';
import { createLeaderSkills } from '../game/leader-skills';
import { createHomeworldCustody } from '../game/homeworld-custody';
import {
  createEmperorNexusRevival,
  emperorNexusEvent,
  emperorNexusPools,
  emperorNexusSignature,
  quoteEmperorNexusRevival,
  settleEmperorNexusRevival,
  validateEmperorNexusRevival,
  type NexusEmperorRevival,
  type NexusEmperorRevivalRequest,
} from '../game/nexus-emperor-secret-ally';
import { newRevivalRules, normalRevivalAllowance } from '../game/revival';

/** Focused unit state, not a genuine game trace or runtime admission fixture. */
function sample(faction: FactionId = 'atreides', advanced = true, nativeTleilaxu = false) {
  const g = createGame('EXTRASOURCE', newPlayer('owner', 'Holder', faction), advanced);
  const rival: FactionId = faction === 'atreides' ? 'harkonnen' : 'atreides';
  g.players.push(newPlayer('rival', 'Rival', rival));
  g.players.push(newPlayer('third', 'Third', nativeTleilaxu ? 'tleilaxu' : 'guild'));
  g.expansions = [...new Set(g.players.map(p => FACTIONS.find(f => f.id === p.faction)!.expansion)
    .filter(expansion => expansion !== 'base'))];
  g.status = 'playing';
  g.phase = 4;
  g.turn = 3;
  g.revivalRules = newRevivalRules();
  const p = g.players[0];
  p.tanks = 6;
  p.reserves -= 6;
  if (faction === 'fremen' && advanced)
    p.elites = { reserves: 1, tanks: 2, forces: {}, revived: 0 };
  if (faction === 'ixians') {
    p.elites!.reserves = 4;
    p.elites!.tanks = 3;
  }
  const cards = createNexusCards(g.players, () => 0.5);
  cards.deck = cards.deck.filter(card => card !== 'emperor');
  cards.hands.owner = 'emperor';
  g.nexusCards = { cards, phase: null };
  return g;
}

function commit(g: Game, receipt: NexusEmperorRevivalRequest) {
  g.nexusCards!.cards = discardNexusCard(g.nexusCards!.cards!, receipt.owner, g.players);
  (g.nexusEmperorSecretHistory ??= []).push(receipt);
  (g.nexusEmperorSecretEvents ??= []).push(receipt.event);
}

/** Model the native physical producer before income and optional deployment. */
function physicalReturn(g: Game, receipt: NexusEmperorRevivalRequest) {
  const p = g.players.find(p => p.id === receipt.owner)!;
  p.reserves += 3;
  p.tanks -= 3;
  if (p.elites) {
    p.elites.reserves += receipt.elite;
    p.elites.tanks -= receipt.elite;
    p.elites.revived += receipt.elite;
  }
}

function signed<T extends NexusEmperorRevival>(receipt: T): T {
  receipt.signature = emperorNexusSignature(receipt);
  return receipt;
}

void test('declaration is a pure signed exact-three source and cannot settle before custody is committed', () => {
  const g = sample();
  const before = structuredClone(g);
  const quote = quoteEmperorNexusRevival(g, 'owner');
  assert.equal(quote.blocked, null);
  assert.deepEqual(quote.eliteOptions, [0]);
  const receipt = createEmperorNexusRevival(g, 'owner', 0);
  assert.equal(receipt.version, 2);
  assert.equal(receipt.stage, 'requested');
  assert.equal(receipt.after, null);
  assert.equal(receipt.event, quote.event);
  assert.equal(receipt.sequence, 0);
  assert.equal(receipt.signature, emperorNexusSignature(receipt));
  assert.deepEqual(receipt.before, emperorNexusPools(g.players[0]));
  validateEmperorNexusRevival(g, receipt);
  assert.deepEqual(g, before);
  assert.throws(() => settleEmperorNexusRevival(g, receipt, 'returned'));
  assert.throws(() => createEmperorNexusRevival(g, 'owner', 1));
  assert.deepEqual(g, before);
});

void test('native typed Tanks determine exact-three choices and Ix Cyborgs are not capped at one', () => {
  for (const advanced of [false, true]) {
    const ix = sample('ixians', advanced);
    ix.players[0].elites!.revived = 4;
    assert.equal(quoteEmperorNexusRevival(ix, 'owner').blocked, null);
    assert.deepEqual(quoteEmperorNexusRevival(ix, 'owner').eliteOptions, [0, 1, 2, 3]);
    assert.equal(createEmperorNexusRevival(ix, 'owner', 3).elite, 3);
  }
  const basicFremen = sample('fremen', false);
  basicFremen.players[0].elites = { reserves: 0, tanks: 3, forces: {}, revived: 2 };
  assert.deepEqual(quoteEmperorNexusRevival(basicFremen, 'owner').eliteOptions, [0, 1, 2, 3]);
  assert.equal(createEmperorNexusRevival(basicFremen, 'owner', 3).elite, 3);
  const fremen = sample('fremen');
  assert.deepEqual(quoteEmperorNexusRevival(fremen, 'owner').eliteOptions, [0, 1]);
  fremen.players[0].elites!.revived = 1;
  assert.deepEqual(quoteEmperorNexusRevival(fremen, 'owner').eliteOptions, [0]);
  assert.throws(() => createEmperorNexusRevival(fremen, 'owner', 1));
  fremen.players[0].tanks = 3;
  assert.equal(quoteEmperorNexusRevival(fremen, 'owner').amount, 1);
  assert.deepEqual(quoteEmperorNexusRevival(fremen, 'owner').eliteOptions, [0]);
  assert.equal(createEmperorNexusRevival(fremen, 'owner', 0).amount, 1);
  const short = sample();
  short.players[0].tanks = 2;
  assert.equal(quoteEmperorNexusRevival(short, 'owner').amount, 2);
  assert.deepEqual(quoteEmperorNexusRevival(short, 'owner').eliteOptions, [0]);
  assert.equal(createEmperorNexusRevival(short, 'owner', 0).amount, 2);
});

void test('original native modules allow revival independently of classic purchase admission', () => {
  for (const faction of ['atreides', 'ixians', 'tleilaxu', 'choam', 'richese', 'ecaz', 'moritani'] as const) {
    const g = sample(faction);
    g.techTokens = createTechTokens();
    g.strongholdCards = createStrongholdCards();
    assert.equal(quoteEmperorNexusRevival(g, 'owner').blocked, null, faction);
    const before = structuredClone(g);
    createEmperorNexusRevival(g, 'owner', 0);
    assert.deepEqual(g, before);
    g.homeworlds = { custody: createHomeworldCustody({
      advanced: g.advanced,
      players: g.players.map(p => ({
        id: p.id, faction: p.faction, reserves: p.reserves,
        eliteReserves: p.elites?.reserves ?? 0,
      })),
    }) };
    assert.equal(quoteEmperorNexusRevival(g, 'owner').blocked, null, `${faction} with Homeworlds`);
    g.discoveryEnabled = true;
    assert.equal(quoteEmperorNexusRevival(g, 'owner').blocked, null, `${faction} with Discovery`);
    g.leaderSkills = createLeaderSkills(() => 0.5);
    assert.equal(quoteEmperorNexusRevival(g, 'owner').blocked, null, `${faction} with Skills`);
  }
});

void test('ordinary high rates, expanded ceilings, Recruits and ordinary free blocking do not reprice the grant', () => {
  for (const faction of ['atreides', 'fremen', 'choam'] as const) {
    for (const blocked of [false, true]) {
      const g = sample(faction);
      g.revivalRules!.expanded.push('owner');
      g.freeRevival.push('owner');
      g.recruits = { turn: g.turn, player: 'owner', card: 'ecaz-recruits' };
      if (blocked) g.revivalRules!.freeBlocked = ['owner'];
      g.players[0].revived = 5;
      g.players[0].freeForcesRevived = 3;
      const allowance = normalRevivalAllowance(g, g.players[0]);
      const rules = structuredClone(g.revivalRules);
      const receipt = createEmperorNexusRevival(g, 'owner', 0);
      commit(g, receipt);
      physicalReturn(g, receipt);
      const returned = settleEmperorNexusRevival(g, receipt, 'returned');
      assert.equal(returned.stage, 'returned');
      assert.deepEqual(returned.after, { ...receipt.before,
        reserves: receipt.before.reserves + 3, tanks: receipt.before.tanks - 3 });
      assert.deepEqual(normalRevivalAllowance(g, g.players[0]), allowance);
      assert.deepEqual(g.revivalRules, rules);
    }
  }
});

void test('native prevention remains distinct from ordinary free blocking and source timing/custody stay strict', () => {
  const original = sample('atreides', true, true);
  original.revivalRules!.freeBlocked = ['owner'];
  assert.equal(quoteEmperorNexusRevival(original, 'owner').blocked, null);
  original.revivalPrevention = { player: 'owner', turn: original.turn };
  assert.notEqual(quoteEmperorNexusRevival(original, 'owner').blocked, null);
  assert.throws(() => createEmperorNexusRevival(original, 'owner', 0));
  for (const change of [
    (g: Game) => { g.nexusCards!.cards!.hands.owner = null; },
    (g: Game) => { g.players[0].ally = 'rival'; },
    (g: Game) => { g.players.push(newPlayer('emperor', 'Native', 'emperor')); },
    (g: Game) => { g.phase = 5; },
    (g: Game) => { g.status = 'setup'; },
    (g: Game) => { g.pendingCapture = { player: 'owner', loser: 'rival', territory: 'arrakeen' }; },
  ]) {
    const g = sample();
    change(g);
    assert.notEqual(quoteEmperorNexusRevival(g, 'owner').blocked, null);
    assert.throws(() => createEmperorNexusRevival(g, 'owner', 0));
  }
  assert.notEqual(quoteEmperorNexusRevival(sample(), 'unknown').blocked, null);
});

void test('returned and denied receipts capture actual typed physical facts without moving or refunding anything', () => {
  for (const outcome of ['returned', 'denied'] as const) {
    const g = sample('ixians', true, true);
    const receipt = createEmperorNexusRevival(g, 'owner', 3);
    commit(g, receipt);
    if (outcome === 'returned') physicalReturn(g, receipt);
    const beforeSettlement = structuredClone(g);
    const result = settleEmperorNexusRevival(g, receipt, outcome);
    assert.equal(result.stage, outcome);
    assert.equal(result.signature, emperorNexusSignature(result));
    assert.deepEqual(result.after, emperorNexusPools(g.players[0]));
    assert.deepEqual(g, beforeSettlement);
    assert.equal(receipt.stage, 'requested');
    assert.equal(receipt.after, null);
    assert.equal(g.nexusCards!.cards!.hands.owner, null);
    assert.equal(g.nexusCards!.cards!.discard.filter(card => card === 'emperor').length, 1);
    if (outcome === 'denied') assert.deepEqual(result.after, receipt.before);
    else assert.deepEqual(result.after, { ...receipt.before,
      reserves: receipt.before.reserves + 3, tanks: receipt.before.tanks - 3,
      eliteReserves: receipt.before.eliteReserves + 3, eliteTanks: receipt.before.eliteTanks - 3,
      eliteRevived: receipt.before.eliteRevived + 3 });
    assert.throws(() => settleEmperorNexusRevival(g, result, outcome));
    // Historical evidence survives later ordinary ledger, wallet and custody changes.
    g.turn++;
    g.phase = 5;
    g.players[0].spice += 10;
    g.players[0].revived += 2;
    g.players[0].freeForcesRevived = 2;
    g.players[0].reserves--;
    validateEmperorNexusRevival(g, result);
  }
});

void test('settlement rejects wrong actual amount, typed composition, ordinary ledgers and premature income', () => {
  for (const change of [
    (g: Game) => { g.players[0].reserves--; g.players[0].tanks++; },
    (g: Game) => { g.players[0].elites!.reserves--; g.players[0].elites!.tanks++; },
    (g: Game) => { g.players[0].elites!.revived--; },
    (g: Game) => { g.players[0].revived++; },
    (g: Game) => { g.players[0].freeForcesRevived = 1; },
    (g: Game) => { g.players[0].spice++; },
  ]) {
    const g = sample('ixians');
    const receipt = createEmperorNexusRevival(g, 'owner', 3);
    commit(g, receipt);
    physicalReturn(g, receipt);
    change(g);
    const before = structuredClone(g);
    assert.throws(() => settleEmperorNexusRevival(g, receipt, 'returned'));
    assert.deepEqual(g, before);
  }
  const g = sample();
  const receipt = createEmperorNexusRevival(g, 'owner', 0);
  commit(g, receipt);
  physicalReturn(g, receipt);
  assert.throws(() => settleEmperorNexusRevival(g, receipt, 'denied'));
});

void test('receipt stage, signature, independent sequence and event markers cannot be fabricated or silently repaired', () => {
  const g = sample();
  const receipt = createEmperorNexusRevival(g, 'owner', 0);
  commit(g, receipt);
  for (const change of [
    (r: NexusEmperorRevivalRequest) => { r.signature = 'unsigned'; },
    (r: NexusEmperorRevivalRequest) => { r.sequence++; r.signature = emperorNexusSignature(r); },
    (r: NexusEmperorRevivalRequest) => { r.event = emperorNexusEvent(r.turn, 4, 'rival', r.sequence); r.signature = emperorNexusSignature(r); },
  ]) {
    const bad = structuredClone(receipt);
    change(bad);
    assert.throws(() => validateEmperorNexusRevival(g, bad));
  }
  const withAfter = signed({ ...receipt, after: receipt.before } as unknown as NexusEmperorRevivalRequest);
  assert.throws(() => validateEmperorNexusRevival(g, withAfter));
  const finalWithoutAfter = signed({ ...receipt, stage: 'returned', after: null } as unknown as NexusEmperorRevival);
  assert.throws(() => validateEmperorNexusRevival(g, finalWithoutAfter));
  for (const change of [
    (state: Game) => { state.nexusEmperorSecretEvents![0] = 'wrong'; },
    (state: Game) => { state.nexusEmperorSecretHistory![0] = signed({ ...receipt, before: { ...receipt.before, spice: 999 } }); },
    (state: Game) => { state.nexusCards!.cards!.discard = []; },
  ]) {
    const bad = structuredClone(g);
    change(bad);
    assert.throws(() => settleEmperorNexusRevival(bad, receipt, 'denied'));
  }
});

void test('strict old physical receipts stay readable as history, never become expansion source permissions', () => {
  const g = sample();
  const receipt = createEmperorNexusRevival(g, 'owner', 0);
  const { version: _version, stage: _stage, ...identity } = receipt;
  const old: NexusEmperorRevival = signed({ ...identity, after: {
    ...receipt.before, reserves: receipt.before.reserves + 3, tanks: receipt.before.tanks - 3,
  } });
  const before = structuredClone(g);
  validateEmperorNexusRevival(g, old);
  assert.deepEqual(g, before);
  assert.throws(() => settleEmperorNexusRevival(g, old, 'returned'));
  g.players[0].spice += 5;
  g.players[0].revived = 3;
  g.turn++;
  validateEmperorNexusRevival(g, old);
  const badLedger = signed({ ...old, after: { ...old.after!, revived: old.before.revived + 3 } });
  assert.throws(() => validateEmperorNexusRevival(g, badLedger));
  const expanded = sample('ixians');
  const fabricated = signed({ ...old, faction: 'ixians' as const });
  assert.throws(() => validateEmperorNexusRevival(expanded, fabricated));
  const metadata = signed({ ...old, version: 1 } as unknown as NexusEmperorRevival);
  assert.throws(() => validateEmperorNexusRevival(g, metadata));
});
