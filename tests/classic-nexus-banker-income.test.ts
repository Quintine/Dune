import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, initializeSpiceBankerIncomeGameForAudit, viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import { validateLeaderSkills } from '../game/leader-skills';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import {
  collectClassicNexusBanker, createClassicNexusBankerFixture, nexusBankerPlayer,
} from './fixture-classic-nexus-banker-income';

void test('classic Nexus Banker holds the actual four-spice bank grant until original Mentat', () => {
  const f = createClassicNexusBankerFixture();
  assert.equal(nexusBankerPlayer(f.paid, f.payer).spice, nexusBankerPlayer(f.beforePayment, f.payer).spice - 4);
  assert.equal(nexusBankerPlayer(f.paid, f.payer).forces['polar_sink:0'], f.amount);
  assert.equal(nexusBankerPlayer(f.paid, f.owner).spice, nexusBankerPlayer(f.beforePayment, f.owner).spice);
  assert.deepEqual(viewGame(f.paid, f.owner).spiceBankerIncome!.deferred, [{owner:'a',amount:1}]);
  const receipt = f.paid.spiceBankerIncome!.sources.at(-1)!;
  assert.deepEqual(receipt.source.bankLegs, [{payer:'g',amount:4}]);
  assert.equal(receipt.grant!.owner, 'a');
  assert.deepEqual(f.paid.nexusCards, f.beforePayment.nexusCards);
  const {beforeMentat,collected} = collectClassicNexusBanker(f.paid);
  assert.equal(nexusBankerPlayer(collected, f.owner).spice, nexusBankerPlayer(beforeMentat, f.owner).spice + 1);
  assert.deepEqual(viewGame(collected, f.owner).spiceBankerIncome!.deferred, []);
  assert.equal(collected.spiceBankerIncome!.collections.length, 1);
  assert.deepEqual(collected.spiceBankerIncome!.collections[0].credits, [{owner:'a',amount:1}]);
  validateLeaderSkills(collected.leaderSkills!, collected.players);
});

void test('a three-spice bank shipment never turns into four through Nexus or front-shield accounting', () => {
  const f = createClassicNexusBankerFixture({amount:3});
  assert.equal(nexusBankerPlayer(f.paid, f.payer).spice, nexusBankerPlayer(f.beforePayment, f.payer).spice - 3);
  assert.deepEqual(f.paid.spiceBankerIncome!.sources.at(-1)!.source.bankLegs, [{payer:'g',amount:3}]);
  assert.equal(f.paid.spiceBankerIncome!.sources.at(-1)!.grant, null);
  assert.deepEqual(viewGame(f.paid, f.owner).spiceBankerIncome!.deferred, []);
  const {beforeMentat,collected} = collectClassicNexusBanker(f.paid);
  assert.equal(nexusBankerPlayer(collected, f.owner).spice, nexusBankerPlayer(beforeMentat, f.owner).spice);
});

void test('original Guild player income remains a player payment rather than a qualifying bank leg', () => {
  const f = createClassicNexusBankerFixture({payer:'e'});
  assert.equal(nexusBankerPlayer(f.paid, 'e').spice, nexusBankerPlayer(f.beforePayment, 'e').spice - 4);
  assert.equal(nexusBankerPlayer(f.paid, 'g').spice, nexusBankerPlayer(f.beforePayment, 'g').spice + 4);
  assert.deepEqual(viewGame(f.paid, f.owner).spiceBankerIncome!.deferred, []);
  assert.equal(f.paid.spiceBankerIncome!.sources.length, 0);
  const {beforeMentat,collected} = collectClassicNexusBanker(f.paid);
  assert.equal(nexusBankerPlayer(collected, f.owner).spice, nexusBankerPlayer(beforeMentat, f.owner).spice);
});

void test('Advanced flexible Guild timing retains deferred Nexus income with selected Tech and Strongholds', () => {
  const f = createClassicNexusBankerFixture({advanced:true,tech:true,strongholds:true});
  assert.equal(nexusBankerPlayer(f.paid, 'g').spice, nexusBankerPlayer(f.beforePayment, 'g').spice - 4);
  assert.deepEqual(viewGame(f.paid, f.owner).spiceBankerIncome!.deferred, [{owner:'a',amount:1}]);
  const {beforeMentat,collected} = collectClassicNexusBanker(f.paid);
  assert.equal(nexusBankerPlayer(collected, f.owner).spice, nexusBankerPlayer(beforeMentat, f.owner).spice + 1);
  assert.deepEqual(collected.spiceBankerIncome!.collections[0].credits, [{owner:'a',amount:1}]);
  assert.equal(collected.spiceBankerIncome!.sources.filter(source=>source.grant).length, 1);
  validateLeaderSkills(collected.leaderSkills!, collected.players);
});

void test('actual Heighliners income pays at phase end without manufacturing a Banker bank payment', () => {
  const f = createClassicNexusBankerFixture({advanced:true,tech:true,strongholds:true,payer:'e'});
  const token = f.paid.techTokens!.heighliners;
  assert.ok(token.owner);
  assert.equal(token.spice, 1);
  assert.equal(nexusBankerPlayer(f.paid, 'e').spice, nexusBankerPlayer(f.beforePayment, 'e').spice - 4);
  assert.equal(nexusBankerPlayer(f.paid, 'g').spice, nexusBankerPlayer(f.beforePayment, 'g').spice + 4);
  assert.deepEqual(viewGame(f.paid, f.owner).spiceBankerIncome!.deferred, []);
  const ordinary = quoteSpiceCollection(f.paid).receipts.find(row => row.player === token.owner)!;
  const {beforeMentat,collected} = collectClassicNexusBanker(f.paid);
  assert.equal(nexusBankerPlayer(beforeMentat, token.owner).spice,
    nexusBankerPlayer(f.paid, token.owner).spice + 1 + ordinary.strongholds + ordinary.collected);
  assert.equal(collected.techTokens!.heighliners.spice, 0);
  assert.equal(nexusBankerPlayer(collected, f.owner).spice, nexusBankerPlayer(beforeMentat, f.owner).spice);
  assert.equal(collected.spiceBankerIncome!.sources.length, 0);
});

void test('Nexus Banker keeps available wallet budgets and existing legal policy actions; setup cannot be redealt', () => {
  const f = createClassicNexusBankerFixture();
  const view = viewGame(f.paid, f.payer);
  view.players.find(p=>p.id===f.payer)!.bot = 'Easy';
  const action = botActions(view)[0];
  assert.ok(action);
  const next = applyAction(f.paid, f.payer, action);
  assert.equal(nexusBankerPlayer(next, f.owner).spice, nexusBankerPlayer(f.paid, f.owner).spice);
  assert.deepEqual(viewGame(next, f.owner).spiceBankerIncome!.deferred, [{owner:'a',amount:1}]);
  const snapshot = structuredClone(f.paid);
  assert.throws(()=>initializeSpiceBankerIncomeGameForAudit(f.paid));
  assert.deepEqual(f.paid,snapshot);
  assert.throws(()=>applyAction(f.paid,f.owner,{type:'collectSpiceBankerIncome'}));
  assert.deepEqual(f.paid,snapshot);
});
