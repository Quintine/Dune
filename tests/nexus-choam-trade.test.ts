import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, normalizeAutomaticGame, viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import { quoteNexusChoamTrade } from '../game/nexus-choam-trade';
import { NexusChoamTrade } from '../components/nexus-choam-trade';
import { nexusChoamTradeAction } from '../game/nexus-choam-trade-options';
import { holdNexusChoamCard } from './fixture-nexus-choam';
import { nexusChoamTradeFixture, pausedNexusChoamTrade } from './fixture-nexus-choam-trade';
import { nexusTraitorFixture, nexusTraitorInventory } from './fixture-nexus-traitors';
import { nexusReject, nexusReload, nexusReady } from './fixture-nexus-cards';

void test('Basic and Advanced Collection trade spends both physical cards and pays exactly two bank spice once', () => {
  for (const advanced of [false, true]) {
    const f = nexusChoamTradeFixture(advanced), before = nexusReload(f.g);
    const g = applyAction(f.g, f.owner, f.action);
    assert.deepEqual(f.g, before);
    assert.equal(g.players[0].spice, before.players[0].spice + 2);
    assert.deepEqual(g.players.slice(1), before.players.slice(1));
    assert.deepEqual(g.players[0].hand, before.players[0].hand.filter(card => card.id !== f.cost.id));
    assert.equal(g.discard.filter(card => card.id === f.cost.id).length, 1);
    assert.equal(g.nexusCards!.cards!.hands[f.owner], null);
    assert.ok(g.nexusCards!.cards!.discard.includes('choam'));
    assert.equal(g.nexusChoamTrades!.length, 1);
    assert.equal(g.nexusChoamTrades![0].stage, 'complete');
    assert.equal(g.response, null);
    assert.equal(g.pendingTreacheryDiscard, null);
    nexusReject(g, f.owner, f.action);
    assert.deepEqual(normalizeAutomaticGame(nexusReload(g)), g);
    assert.equal(nexusReady(g).phase, 8);
    nexusTraitorInventory(g);
  }
});

void test('private trade choices stay hidden and all four AI profiles use the same legal physical-card action', () => {
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const f = nexusChoamTradeFixture(true);
    const v = viewGame(f.g, f.owner);
    v.players.find(p => p.id === f.owner)!.bot = difficulty;
    assert.deepEqual(botActions(v)[0], f.action);
    assert.equal(nexusChoamTradeAction(v, f.other.id), null);
    const opponent = viewGame(f.g, f.target);
    assert.equal(opponent.nexusChoamTrade, null);
    assert.equal(opponent.nexusCards?.card, null);
    const ownHtml = renderToStaticMarkup(createElement(NexusChoamTrade, {game: v, busy: false, act() {}}));
    assert.match(ownHtml, /Worthless card to trade/);
    assert.ok(ownHtml.includes(f.cost.name) && ownHtml.includes(f.spare.name));
    assert.match(ownHtml, /Inspect card/);
    assert.match(ownHtml, /for 2 spice/);
    assert.equal(renderToStaticMarkup(createElement(NexusChoamTrade, {game: opponent, busy: false, act() {}})), '');
    assert.match(renderToStaticMarkup(createElement(NexusChoamTrade, {game: v, busy: true, act() {}})), /disabled=""/);
    const done = applyAction(f.g, f.owner, botActions(v)[0]);
    assert.equal(viewGame(done, f.target).nexusChoamTrade, null);
    assert.equal(Object.hasOwn(viewGame(done, f.target), 'nexusChoamTrades'), false);
    nexusTraitorInventory(done);
  }
});

void test('trade rejects stale/forged/foreign/wrong-role requests and does not interrupt Truthtrance', () => {
  const f = nexusChoamTradeFixture();
  for (const action of [{...f.action, event: 'stale'}, {...f.action, card: f.other.id},
    {...f.action, amount: 99}, {...f.action, card: 'missing'}]) nexusReject(f.g, f.owner, action);
  nexusReject(f.g, f.target, f.action);
  const phase = nexusReload(f.g); phase.phase = 8;
  nexusReject(phase, f.owner, f.action, /Collection/);
  const truth = holdNexusChoamCard(f.g, f.target, 'truthtrance');
  const pending = applyAction(f.g, f.target, {type: 'card', card: truth.id});
  assert.ok(pending.truthtrance);
  assert.match(viewGame(pending, f.owner).nexusChoamTrade!.blocked!, /current interaction/);
  nexusReject(pending, f.owner, f.action, /current interaction/);
  const native = nexusTraitorFixture({ownerFaction: 'choam', phase: 7});
  const deck = native.nexusCards!.cards!;
  deck.deck[deck.deck.indexOf('choam')] = deck.hands.p!; deck.hands.p = 'choam';
  assert.equal(quoteNexusChoamTrade(native, 'p', false), null);
  const betrayal = nexusTraitorFixture({ownerFaction: 'atreides', opponentFaction: 'choam', phase: 7});
  const second = betrayal.nexusCards!.cards!;
  second.deck[second.deck.indexOf('choam')] = second.hands.p!; second.hands.p = 'choam';
  assert.equal(quoteNexusChoamTrade(betrayal, 'p', false), null);
});

void test('paid discard resumes after JSON reload without replay and rejects damaged custody/payment/history', () => {
  const f = nexusChoamTradeFixture(), done = applyAction(f.g, f.owner, f.action);
  const paused = pausedNexusChoamTrade(done);
  assert.ok(viewGame(paused, f.owner).automaticContinuationPending);
  assert.deepEqual(normalizeAutomaticGame(nexusReload(paused)), done);
  nexusReject(paused, f.owner, f.action, /committed discard/);
  for (const damage of [
    (g: typeof done) => { g.players[0].spice++; },
    (g: typeof done) => { g.players[0].hand.push(f.cost); },
    (g: typeof done) => { g.nexusChoamTrades![0].card = f.spare.id; },
    (g: typeof done) => { delete g.nexusChoamTrades; },
    (g: typeof done) => { g.pendingTreacheryDiscard = null; g.resolvedTreacheryDiscardSequence = g.treacheryDiscardSequence; },
  ]) {
    const bad = nexusReload(paused); damage(bad); const before = nexusReload(bad);
    for (const work of [() => viewGame(bad, f.owner), () => normalizeAutomaticGame(bad), () => applyAction(bad, f.owner, {type: 'advanceBots'})])
      assert.throws(work, /trade|custody|history|discard/i);
    assert.deepEqual(bad, before);
  }
});
