import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, createGame, newPlayer, viewGame, type Game, type GameView } from '../game/engine';
import { createNexusShortRevivalFixture } from './fixture-nexus-short-revival';
import { FACTIONS, type FactionId } from '../game/catalog';
import { createNexusCards, discardNexusCard } from '../game/nexus-cards';
import {
  createEmperorNexusRevival, emperorNexusPools, emperorNexusRevivalAmount,
  emperorNexusRevivalCount, emperorNexusSignature, quoteEmperorNexusRevival,
  settleEmperorNexusRevival, validateEmperorNexusRevival,
  type NexusEmperorRevival, type NexusEmperorRevivalRequest,
} from '../game/nexus-emperor-secret-ally';
import { nexusEmperorRevivalAction } from '../game/nexus-emperor-secret-ally-options';
import { NexusEmperorSecretAlly } from '../components/nexus-emperor-secret-ally';

/** Controlled pure-rule pools and projected controls, not native gameplay
 * chronology. Physical settlement below models the native producer before
 * income or Homeworld deployment; root's native source covers that path. */
function sample(tanks = 2, faction: FactionId = 'atreides', advanced = true,
  eliteTanks = 0, eliteRevived = 0): Game {
  const g = createGame('SHORTEMPEROR', newPlayer('owner', 'Holder', faction), advanced);
  g.players.push(newPlayer('rival', 'Rival', faction === 'atreides' ? 'harkonnen' : 'atreides'));
  g.players.push(newPlayer('third', 'Third', 'guild'));
  g.expansions = [...new Set(g.players.map(p => FACTIONS.find(f => f.id === p.faction)!.expansion)
    .filter(expansion => expansion !== 'base'))];
  g.status = 'playing'; g.phase = 4; g.turn = 2;
  const p = g.players[0];
  p.reserves -= tanks; p.tanks = tanks;
  p.revived = 4; p.freeForcesRevived = 2;
  if (faction === 'fremen' || faction === 'ixians')
    p.elites = { reserves: (faction === 'ixians' ? 7 : 3) - eliteTanks,
      tanks: eliteTanks, forces: {}, revived: eliteRevived };
  const cards = createNexusCards(g.players, () => 0.5);
  cards.deck = cards.deck.filter(card => card !== 'emperor'); cards.hands.owner = 'emperor';
  g.nexusCards = { cards, phase: null };
  return g;
}
function commit(g: Game, receipt: NexusEmperorRevivalRequest) {
  g.nexusCards!.cards = discardNexusCard(g.nexusCards!.cards!, receipt.owner, g.players);
  g.nexusEmperorSecretHistory = [receipt]; g.nexusEmperorSecretEvents = [receipt.event];
}
function physicalReturn(g: Game, receipt: NexusEmperorRevivalRequest) {
  const p = g.players[0], amount = emperorNexusRevivalCount(receipt);
  p.reserves += amount; p.tanks -= amount;
  if (p.elites) {
    p.elites.reserves += receipt.elite; p.elites.tanks -= receipt.elite;
    p.elites.revived += receipt.elite;
  }
}
const html = (game: GameView, busy = false) =>
  renderToStaticMarkup(createElement(NexusEmperorSecretAlly, { game, busy, act() {} }));

void test('the current maximal return stays three when eligible and shortens only for actual Tanks or native typed limits', () => {
  for (const amount of [1, 2, 3, 5]) {
    const g = sample(amount), offered = quoteEmperorNexusRevival(g, 'owner');
    assert.equal(offered.amount, Math.min(3, amount));
    assert.deepEqual(offered.eliteOptions, [0]); assert.equal(offered.blocked, null);
  }
  const capped = sample(3, 'fremen', true, 2);
  assert.equal(emperorNexusRevivalAmount(capped.players[0], true), 2);
  assert.deepEqual(quoteEmperorNexusRevival(capped, 'owner').eliteOptions, [1]);
  capped.players[0].elites!.revived = 1;
  assert.equal(quoteEmperorNexusRevival(capped, 'owner').amount, 1);
  assert.deepEqual(quoteEmperorNexusRevival(capped, 'owner').eliteOptions, [0]);
  const exhausted = sample(2, 'fremen', true, 2, 1);
  assert.equal(quoteEmperorNexusRevival(exhausted, 'owner').amount, 0);
  assert.deepEqual(quoteEmperorNexusRevival(exhausted, 'owner').eliteOptions, []);
  assert.throws(() => createEmperorNexusRevival(exhausted, 'owner', 0), /at least one eligible force/);
  const basic = sample(3, 'fremen', false, 2, 1);
  assert.equal(quoteEmperorNexusRevival(basic, 'owner').amount, 3);
  assert.deepEqual(quoteEmperorNexusRevival(basic, 'owner').eliteOptions, [2]);
  const ix = sample(3, 'ixians', true, 3, 4);
  assert.equal(quoteEmperorNexusRevival(ix, 'owner').amount, 3);
  assert.deepEqual(quoteEmperorNexusRevival(ix, 'owner').eliteOptions, [3]);
});

void test('short requested receipts settle only the actual typed group and preserve ordinary ledgers and purse', () => {
  for (const amount of [1, 2] as const) for (const outcome of ['returned', 'denied'] as const) {
    const g = sample(amount), before = emperorNexusPools(g.players[0]);
    const receipt = createEmperorNexusRevival(g, 'owner', 0);
    assert.equal(receipt.amount, amount); assert.equal(receipt.stage, 'requested');
    assert.equal(emperorNexusRevivalCount(receipt), amount);
    assert.deepEqual(emperorNexusPools(g.players[0]), before, 'declaration is a pure source quote');
    commit(g, receipt);
    if (outcome === 'returned') physicalReturn(g, receipt);
    const result = settleEmperorNexusRevival(g, receipt, outcome);
    assert.equal(result.stage, outcome); assert.equal(result.amount, amount);
    assert.deepEqual(result.after, outcome === 'denied' ? before : {
      ...before, reserves: before.reserves + amount, tanks: before.tanks - amount,
    });
    assert.equal(result.after!.revived, before.revived);
    assert.equal(result.after!.freeForcesRevived, before.freeForcesRevived);
    assert.equal(result.after!.spice, before.spice);
  }
  const typed = sample(3, 'fremen', true, 2);
  const receipt = createEmperorNexusRevival(typed, 'owner', 1);
  assert.equal(receipt.amount, 2); commit(typed, receipt); physicalReturn(typed, receipt);
  const returned = settleEmperorNexusRevival(typed, receipt, 'returned');
  assert.equal(returned.after!.tanks, 1); assert.equal(returned.after!.eliteTanks, 1);
  assert.equal(returned.after!.eliteRevived, 1);
});

void test('a short receipt cannot choose less than the available group or disguise a three-force record', () => {
  const g = sample(2), receipt = createEmperorNexusRevival(g, 'owner', 0);
  for (const amount of [0, 1, 3, undefined]) {
    const malformed = { ...receipt, amount, signature: '' } as unknown as NexusEmperorRevival;
    malformed.signature = emperorNexusSignature(malformed);
    assert.throws(() => validateEmperorNexusRevival(g, malformed));
  }
  const unrecorded = { ...receipt };
  delete unrecorded.amount; unrecorded.signature = emperorNexusSignature(unrecorded);
  assert.throws(() => validateEmperorNexusRevival(g, unrecorded));
});

void test('full-three requests retain the previous shape and old completed receipts still mean three', () => {
  const g = sample(5), receipt = createEmperorNexusRevival(g, 'owner', 0);
  assert.equal(Object.hasOwn(receipt, 'amount'), false);
  assert.equal(emperorNexusRevivalCount(receipt), 3);
  const previous = {
    kind: 'revival' as const, version: 2 as const, event: receipt.event, owner: 'owner', turn: 2,
    phase: 4 as const, sequence: 0, faction: 'atreides' as const, advanced: true, elite: 0,
    before: emperorNexusPools(g.players[0]), after: null, stage: 'requested' as const, signature: '',
  };
  previous.signature = emperorNexusSignature(previous);
  assert.deepEqual(receipt, previous);
  const legacy: NexusEmperorRevival = {
    kind: 'revival', event: receipt.event, owner: receipt.owner, turn: receipt.turn,
    phase: 4, sequence: 0, faction: receipt.faction, advanced: receipt.advanced, elite: 0,
    before: receipt.before,
    after: { ...receipt.before, reserves: receipt.before.reserves + 3, tanks: receipt.before.tanks - 3 },
    signature: '',
  };
  legacy.signature = emperorNexusSignature(legacy);
  validateEmperorNexusRevival(g, legacy); assert.equal(emperorNexusRevivalCount(legacy), 3);
});

void test('short controls display the quoted count and keep the exact native packet without a client-selected quantity', () => {
  for (const amount of [1, 2] as const) {
    const f = createNexusShortRevivalFixture({amount}), g = f.game;
    const view = viewGame(g, f.actor), offered = view.nexusEmperorSecretAlly!;
    assert.equal(offered.revival.amount, amount);
    assert.deepEqual(nexusEmperorRevivalAction(view, 0), {
      type: 'nexusEmperorRevive', event: offered.event, elite: 0,
    });
    const text = html(view);
    assert.match(text, new RegExp(`request ${amount} additional force`));
    assert.match(text, /Provisional short-group policy/); assert.match(text, /not publisher clarification/);
    assert.match(text, /beyond ordinary force\/free allowances/);
    assert.match(html(view, true), /disabled=""/);
    assert.equal(nexusEmperorRevivalAction(view, amount + 1), null);
    // Explicit stale projection supplement; no stale network snapshot is claimed.
    const stale = structuredClone(view); stale.nexusEmperorSecretAlly!.revival.event += '-stale';
    assert.equal(nexusEmperorRevivalAction(stale, 0), null);
    assert.equal(nexusEmperorRevivalAction(viewGame(g, 'guild'), 0), null);
  }
  const f = createNexusShortRevivalFixture({amount:1});
  const empty = applyAction(f.game, f.actor, {type:'revive',amount:1,elite:0});
  const view = viewGame(empty, f.actor);
  assert.equal(nexusEmperorRevivalAction(view, 0), null);
  assert.match(html(view), /No eligible forces to revive/); assert.match(html(view), /disabled=""/);
  // Controlled projected denial supplement; no Tleilaxu event is manufactured.
  const blocked = viewGame(f.game, f.actor);
  blocked.nexusEmperorSecretAlly!.revival.blocked = 'Native Tleilaxu prevention blocks this revival.';
  assert.equal(nexusEmperorRevivalAction(blocked, 0), null);
  assert.match(html(blocked), /Native Tleilaxu prevention/);
});
