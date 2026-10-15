import assert from 'node:assert/strict';
import test from 'node:test';
import { leaders } from '../game/cards';
import { viewGame, type Action } from '../game/engine';
import {
  assertMixedE3MoritaniPhysical, assertMixedE3MoritaniRejects, mixedE3MoritaniPlayer,
  quoteMixedE3MoritaniBattle,
} from './fixture-mixed-e3-moritani-nexus';
import {
  createMoritaniReplacementExchangeFixture, createMoritaniReplacementRedrawProgramme,
  finishMoritaniReplacementExchange, moritaniReplacementDrawStep,
} from './fixture-moritani-replacement-exchange';

void test('an original Harkonnen Secret Ally return gives the historical Mentat replacement back to the physical deck without disturbing its public receipt', () => {
  const f = createMoritaniReplacementExchangeFixture();
  assertMixedE3MoritaniPhysical(f.ready);
  assert.deepEqual(mixedE3MoritaniPlayer(f.ready, f.moritani).traitors, [f.historicalReplacement]);
  const own = viewGame(f.ready, f.moritani);
  assert.equal(own.nexusCards!.card, 'harkonnen');
  assert.deepEqual(own.nexusTraitors!.pending, null);
  assert.equal(own.nexusTraitors!.offer!.draw, 2);
  assert.equal(own.nexusTraitors!.offer!.blocked, null);

  const result = finishMoritaniReplacementExchange(f);
  const exchange = result.exchanged.nexusTraitorExchanges!.at(-1)!;
  assert.equal(exchange.stage, 'complete');
  assert.deepEqual(exchange.drawn, [...f.drawn]);
  assert.deepEqual([...exchange.returned].sort(), [...result.returnCards].sort());
  assert.ok(result.returnCards.includes(f.historicalReplacement),
    'The owner really gave the historical replacement back.');
  assert.deepEqual(exchange.before, [f.historicalReplacement]);
  assert.equal(result.exchanged.traitorReserve![0], f.historicalReplacement,
    'The returned historical replacement is a physical reserve card again.');
  assert.deepEqual(mixedE3MoritaniPlayer(result.exchanged, f.moritani).traitors, [f.guildTraitor],
    'Only the real newly drawn Traitor Card stays in the owner hand.');

  assert.equal(result.exchanged.traitorReserve!.includes(f.retiredVictim), false);
  for (const player of result.exchanged.players)
    assert.equal(player.traitors.includes(f.retiredVictim), false);
  const receipt = result.exchanged.moritaniAssassinate!.opportunities.at(-1)!;
  assert.equal(receipt.stage, 'replaced');
  assert.equal(receipt.replacement, f.historicalReplacement);
  assert.deepEqual({ event: receipt.event, card: receipt.card, replacement: receipt.replacement,
    signature: receipt.signature }, f.history,
  'The recorded public victim, its private replacement and the receipt signature must not be rewritten.');

  assert.equal(result.exchanged.turn, f.ready.turn);
  assert.equal(result.exchanged.phase, 8);
  assert.equal(result.exchanged.nexusTraitorPending ?? null, null);
  assert.deepEqual(result.exchanged.decision, f.ready.decision,
    'The owner keeps its suspended original Mentat placement after returning physical cards.');
  assert.equal(result.exchanged.nexusCards!.cards!.discard.filter(card => card === 'harkonnen').length, 1);
  assertMixedE3MoritaniPhysical(result.exchanged);
});

void test('the physical return stays owner-only and cannot be replayed against the real custody', () => {
  const f = createMoritaniReplacementExchangeFixture();
  const guild = f.seats.guild!;
  const rival = viewGame(f.ready, guild).nexusTraitors!;
  assert.equal(rival.offer, null);
  assert.equal(rival.pending, null);
  assertMixedE3MoritaniRejects(f.ready, guild, f.draw);

  const drawn = moritaniReplacementDrawStep(f);
  const pending = viewGame(drawn.after, f.moritani).nexusTraitors!.pending!;
  assert.deepEqual(pending.choices.map(choice => choice.id), [f.historicalReplacement, ...f.drawn]);
  assert.deepEqual(mixedE3MoritaniPlayer(drawn.after, f.moritani).traitors,
    [f.historicalReplacement, ...f.drawn]);
  const rivalPending = viewGame(drawn.after, guild).nexusTraitors!.pending!;
  assert.equal(rivalPending.event, pending.event);
  assert.deepEqual(rivalPending.choices, []);
  const giveBack: Action = { type: 'nexusTraitorReturn', event: pending.event,
    cards: [f.historicalReplacement, f.guildTraitor] };
  assertMixedE3MoritaniRejects(drawn.after, guild, giveBack);
  assertMixedE3MoritaniRejects(drawn.after, f.moritani,
    { type: 'nexusTraitorReturn', event: pending.event,
      cards: [f.historicalReplacement, f.historicalReplacement] });
  assertMixedE3MoritaniRejects(drawn.after, f.moritani, f.draw);
});

void test('a later original battle loss lets the next Mentat draw the same physical card again while the older Nexus history stays unchanged', () => {
  const programme = createMoritaniReplacementRedrawProgramme();
  const f = programme.fixture;
  const guild = f.seats.guild!;
  assertMixedE3MoritaniPhysical(programme.exchanged);
  const historical = structuredClone(programme.exchanged.nexusTraitorExchanges);

  assert.equal(quoteMixedE3MoritaniBattle(programme.revealed).winner, guild,
    'The real second loss must be a surviving Guild win.');
  const receipts = programme.redrawn.moritaniAssassinate!.opportunities;
  assert.equal(receipts.length, 2);
  const [first, second] = receipts;
  assert.equal(first.stage, 'replaced');
  assert.equal(second.stage, 'replaced');
  assert.equal(second.turn, 3);
  assert.equal(second.card, f.guildTraitor, 'The second public marker retires the held Guild Traitor.');
  assert.equal(second.replacement, first.replacement,
    'The later original Mentat replacement may be the very card the older Nexus history returned.');
  assert.equal(second.replacement, f.historicalReplacement);
  assert.equal(second.bounty, leaders('guild').find(leader => leader.id === f.guildTraitor)!.strength);
  assert.equal(mixedE3MoritaniPlayer(programme.redrawn, guild).leaders
    .find(leader => leader.id === f.guildTraitor)!.dead, true);

  assert.deepEqual(mixedE3MoritaniPlayer(programme.redrawn, f.moritani).traitors, [f.historicalReplacement],
    'The same physical card is really held again.');
  assert.equal(programme.redrawn.traitorReserve!.includes(f.historicalReplacement), false);
  assert.equal(programme.redrawn.traitorReserve!.includes(f.guildTraitor), false);
  assert.equal(programme.redrawn.traitorReserve!.includes(f.retiredVictim), false);
  for (const player of programme.redrawn.players)
    for (const retired of [f.retiredVictim, f.guildTraitor])
      assert.equal(player.traitors.includes(retired), false);

  assert.deepEqual(programme.redrawn.nexusTraitorExchanges, historical,
    'A later public marker must not rewrite or reinterpret the earlier Nexus exchange history.');
  assert.deepEqual({ event: first.event, card: first.card, replacement: first.replacement,
    signature: first.signature }, f.history);
  assertMixedE3MoritaniPhysical(programme.redrawn);
});
