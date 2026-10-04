import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, initializeNexusGameForAudit, joinGame, newPlayer, viewGame,
  type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { forceRevivalQuote, forceRevivalRemaining } from '../game/revival';
import { createStrongholdCards } from '../game/stronghold-cards';
import { createLeaderSkills } from '../game/leader-skills';
import { createTechTokens } from '../game/tech-tokens';
import { nexusInventory } from './fixture-nexus-cards';
import { holdNexusRicheseCard } from './fixture-nexus-richese';
import {
  advanceNexusModulePaymentsToPhase, createNexusModulePaymentsFixture,
  nextNexusModulePaymentsNativeStep, payNexusModulePaymentsFixture,
  type NexusModulePaymentsFixture,
} from './fixture-nexus-module-payments';

function wallets(game: Game): Record<string, number> {
  return Object.fromEntries(game.players.map(player => [player.id, player.spice]));
}
function rejected(game: Game, actor: string, action: Parameters<typeof applyAction>[2]) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'Rejected declarations spend neither physical card, counter nor spice.');
}
/** Empty Battle can auto-skip into Collection. Its independently quoted native
 * stronghold income is not technology and cannot be mistaken for a second pile. */
function collectOnce(fixture: NexusModulePaymentsFixture, paid: Game, amount: number): Game {
  const expected = wallets(paid);
  let ended = advanceNexusModulePaymentsToPhase(paid, paid.phase + 1);
  if (ended.phase === 7) {
    for (const receipt of quoteSpiceCollection(paid).receipts) expected[receipt.player] = receipt.balance;
  }
  if (fixture.tokenOwner) expected[fixture.tokenOwner] += amount;
  assert.deepEqual(wallets(ended), expected);
  assert.equal(ended.techTokens![fixture.token].spice, 0);
  const collection = advanceNexusModulePaymentsToPhase(ended, 7);
  const beforeMentat = wallets(collection);
  ended = advanceNexusModulePaymentsToPhase(collection, 8);
  assert.deepEqual(wallets(ended), beforeMentat, 'Mentat must not pay a collected Tech pile again.');
  assert.equal(ended.techTokens![fixture.token].spice, 0);
  const next = nextNexusModulePaymentsNativeStep(ended);
  assert.ok(next);
  const continued = applyAction(ended, next.actor, next.action);
  assert.deepEqual(wallets(continued), beforeMentat);
  nexusInventory(continued);
  return continued;
}

// E1 printed p5: real non-Guild off-planet shipment, once for each token controlled,
// held on Heighliners until phase end. Borrowed tariff is not faction identity.
// Publisher-authored source: http://boardgame.bg/dune%20ixians%20and%20tleilaxu%20rulebook.pdf
for (const kind of ['guild-shipment', 'richese-shipment'] as const) {
  for (const advanced of [false, true]) {
    void test(`${kind} in ${advanced ? 'Advanced with claimed Strongholds' : 'Basic'} pays the original invoice, arrives physically and collects Heighliners only at phase end`, () => {
      const f = createNexusModulePaymentsFixture({ kind, advanced, strongholds: advanced });
      const before = f.beforePayment.players.find(p => p.id === f.actor)!;
      assert.equal(f.cost, kind === 'guild-shipment' ? 3 : 1);
      const paid = payNexusModulePaymentsFixture(f);
      const after = paid.players.find(p => p.id === f.actor)!;
      assert.equal(after.faction, 'atreides');
      assert.equal(after.reserves, before.reserves - 5);
      assert.equal(after.forces[f.destination!], 5);
      assert.equal(after.shipped, true);
      assert.equal(after.moved, before.moved);
      const expected = wallets(f.beforePayment);
      expected[f.actor] -= f.cost;
      assert.deepEqual(wallets(paid), expected, 'The earned token pile cannot fund this invoice or a later shipment yet.');
      assert.equal(paid.techTokens!.heighliners.spice, f.tokenCount);
      assert.equal(paid.techTokens!.heighliners.triggeredTurn, paid.turn);
      assert.equal(paid.nexusCards!.cards!.hands[f.actor], null);
      assert.equal(paid.nexusCards!.cards!.discard.filter(c => c === (kind === 'guild-shipment' ? 'guild' : 'richese')).length, 1);
      rejected(paid, f.actor, f.paymentAction);
      nexusInventory(paid);
      collectOnce(f, paid, f.tokenCount);
    });
  }
}

void test('a stopped Richese borrowed shipment spends its singleton but no invoice, force or Heighliners income', () => {
  const f = createNexusModulePaymentsFixture({ kind: 'richese-shipment', advanced: true, nativeGuild: true });
  const guild = f.game.players.find(p => p.faction === 'guild')!;
  const karama = holdNexusRicheseCard(f.game, guild.id, 'karama');
  const before = wallets(f.game);
  const reserves = f.game.players.find(p => p.id === f.actor)!.reserves;
  let game = applyAction(f.game, f.actor, f.paymentAction);
  assert.equal(game.decision?.kind, 'guildShipment');
  assert.equal(game.pendingShipment!.amount, 5);
  assert.equal(game.pendingShipment!.cost, 1);
  assert.deepEqual(wallets(game), before, 'Interception precedes actual payment and arrival.');
  assert.equal(game.techTokens!.heighliners.spice, 0);
  game = applyAction(game, guild.id, { type: 'card', mode: 'special', card: karama.id });
  for (let n = 0; (game.response || game.decision) && n < 100; n++) {
    const next = nextNexusModulePaymentsNativeStep(game);
    assert.ok(next);
    game = applyAction(game, next.actor, next.action);
  }
  assert.ok(!game.response && !game.decision);
  assert.deepEqual(wallets(game), before);
  assert.equal(game.players.find(p => p.id === f.actor)!.reserves, reserves);
  assert.equal(game.players.find(p => p.id === f.actor)!.forces[f.destination!], undefined);
  assert.equal(game.techTokens!.heighliners.spice, 0);
  assert.equal(game.nexusCards!.cards!.discard.filter(c => c === 'richese').length, 1);
  assert.ok(game.discard.some(c => c.id === karama.id));
  rejected(game, f.actor, f.paymentAction);
  nexusInventory(game);
  collectOnce(f, game, 0);
});

void test('native Guild using Richese pricing stays native Guild and cannot activate Heighliners alone', () => {
  const f = createNexusModulePaymentsFixture({ kind: 'richese-shipment', ownerFaction: 'guild' });
  const paid = payNexusModulePaymentsFixture(f);
  const actor = paid.players.find(p => p.id === f.actor)!;
  assert.equal(actor.faction, 'guild');
  assert.equal(actor.spice, f.beforePayment.players.find(p => p.id === f.actor)!.spice - 1);
  assert.equal(actor.forces[f.destination!], 5);
  assert.equal(paid.techTokens!.heighliners.spice, 0);
  collectOnce(f, paid, 0);
});

void test('Fremen paid borrowed Guild tariff does not relocate southern reserves or change Heighliners source eligibility', () => {
  const f = createNexusModulePaymentsFixture({ kind: 'guild-shipment', ownerFaction: 'fremen' });
  const paid = payNexusModulePaymentsFixture(f);
  const actor = paid.players.find(p => p.id === f.actor)!;
  assert.equal(actor.faction, 'fremen');
  assert.equal(f.cost, 3);
  assert.equal(actor.spice, f.beforePayment.players.find(p => p.id === f.actor)!.spice - 3);
  assert.equal(actor.forces[f.destination!], 5);
  assert.equal(paid.techTokens!.heighliners.spice, 0, 'A tariff alone does not make the native on-planet reserve source off-planet.');
  collectOnce(f, paid, 0);
});

// Printed Nexus Emperor: three additional free beyond limits. Printed Fremen:
// total free three, recorded ordinary-quota interpretation (NEXUS_FREMEN_RULES).
// E1 p5 classifies both actual phase-4 free batches as Axlotl activity, without
// conflating their different ordinary quota ledgers or granting native identity.
for (const kind of ['emperor-revival', 'fremen-revival'] as const) {
  for (const strongholds of [false, true]) {
    void test(`${kind} consumes the physical card and exact original ledgers${strongholds ? ' without a Stronghold revival bonus' : ''}, then collects Axlotl once`, () => {
      const f = createNexusModulePaymentsFixture({ kind, advanced: strongholds, strongholds });
      const before = f.beforePayment.players.find(p => p.id === f.actor)!;
      let paid = payNexusModulePaymentsFixture(f);
      let actor = paid.players.find(p => p.id === f.actor)!;
      assert.equal(actor.faction, before.faction);
      assert.equal(actor.reserves, before.reserves + 3);
      assert.equal(actor.tanks, before.tanks - 3);
      assert.deepEqual(wallets(paid), wallets(f.beforePayment), 'No grant, Tech pile or Stronghold card manufactures spendable spice during Revival.');
      assert.equal(actor.revived, kind === 'fremen-revival' ? 3 : before.revived);
      assert.equal(actor.freeForcesRevived ?? 0, kind === 'fremen-revival' ? 3 : (before.freeForcesRevived ?? 0));
      assert.equal(paid.techTokens!.axlotl.spice, f.tokenCount);
      assert.equal(paid.techTokens!.axlotl.triggeredTurn, paid.turn);
      assert.equal(paid.nexusCards!.cards!.discard.filter(c => c === (kind === 'emperor-revival' ? 'emperor' : 'fremen')).length, 1);
      rejected(paid, f.actor, f.paymentAction);
      if (kind === 'fremen-revival') {
        assert.equal(forceRevivalRemaining(paid, actor), 0);
        rejected(paid, f.actor, { type: 'revive', amount: 1 });
      } else {
        assert.equal(forceRevivalRemaining(paid, actor), 3);
        const quote = forceRevivalQuote(paid, actor, 3);
        assert.equal(quote.cost, 2, 'Atreides keeps its ordinary two-free/one-paid invoice after the additional grant.');
        const wallet = actor.spice;
        paid = applyAction(paid, f.actor, { type: 'revive', amount: 3 });
        actor = paid.players.find(p => p.id === f.actor)!;
        assert.equal(actor.reserves, before.reserves + 6);
        assert.equal(actor.tanks, before.tanks - 6);
        assert.equal(actor.spice, wallet - quote.cost);
        assert.equal(actor.revived, 3);
        assert.equal(actor.freeForcesRevived, 2);
        assert.equal(paid.techTokens!.axlotl.spice, f.tokenCount, 'Another genuine free batch cannot accrue the same token twice.');
      }
      nexusInventory(paid);
      collectOnce(f, paid, f.tokenCount);
    });
  }
}

for (const kind of ['emperor-revival', 'fremen-revival'] as const) {
  void test(`${kind} preserves actual Advanced elite identity and one-per-turn cap, including bot participation`, () => {
    const f = createNexusModulePaymentsFixture({ kind, advanced: true, strongholds: true,
      ownerFaction: kind === 'emperor-revival' ? 'fremen' : 'emperor', eliteTanks: 2 });
    const view = viewGame(f.game, f.actor);
    const offer = kind === 'emperor-revival' ? view.nexusEmperorSecretAlly!.revival : view.nexusFremenRevival!;
    assert.deepEqual(offer.eliteOptions, [0, 1]);
    rejected(f.game, f.actor, { ...f.paymentAction, elite: 2 });
    view.players.find(p => p.id === f.actor)!.bot = 'Hard';
    const bot = botActions(view).find(action => action.type === f.paymentAction.type);
    assert.ok(bot, 'The actual bot must participate in the newly admitted module option.');
    const paid = applyAction(f.game, f.actor, bot);
    const actor = paid.players.find(p => p.id === f.actor)!;
    const before = f.beforePayment.players.find(p => p.id === f.actor)!;
    assert.equal(actor.elites!.reserves, before.elites!.reserves + 1);
    assert.equal(actor.elites!.tanks, before.elites!.tanks - 1);
    assert.equal(actor.elites!.revived, 1);
    assert.equal(actor.elites!.reserves + actor.elites!.tanks
      + Object.values(actor.elites!.forces).reduce((sum, count) => sum + count, 0),
    before.elites!.reserves + before.elites!.tanks
      + Object.values(before.elites!.forces).reduce((sum, count) => sum + count, 0));
    rejected(paid, f.actor, { type: 'revive', amount: 1, elite: 1 });
    nexusInventory(paid);
  });
}

void test('Fremen late return and exact-three shortage remain unavailable; a real Truthtrance blocks both Nexus returns', () => {
  const f = createNexusModulePaymentsFixture({ kind: 'fremen-revival' });
  const late = applyAction(f.game, f.actor, { type: 'revive', amount: 1 });
  assert.match(viewGame(late, f.actor).nexusFremenRevival!.blocked!, /before ordinary force revivals/);
  rejected(late, f.actor, f.paymentAction);
  for (const kind of ['fremen-revival', 'emperor-revival'] as const) {
    const short = createNexusModulePaymentsFixture({ kind, tanks: 2 });
    rejected(short.game, short.actor, short.paymentAction);
    const quiet = createNexusModulePaymentsFixture({ kind });
    const questioner = quiet.game.players.find(p => p.id !== quiet.actor)!;
    const card = holdNexusRicheseCard(quiet.game, questioner.id, 'truthtrance');
    const pending = applyAction(quiet.game, questioner.id, { type: 'card', card: card.id });
    assert.ok(pending.truthtrance);
    rejected(pending, quiet.actor, quiet.paymentAction);
  }
});

void test('Strongholds alone grants no revival bonus or token income', () => {
  const f = createNexusModulePaymentsFixture({ kind: 'fremen-revival', advanced: true, strongholds: true, tech: false });
  const before = f.beforePayment.players.find(p => p.id === f.actor)!;
  const paid = payNexusModulePaymentsFixture(f);
  const actor = paid.players.find(p => p.id === f.actor)!;
  assert.equal(actor.reserves, before.reserves + 3);
  assert.equal(actor.revived, 3);
  assert.equal(actor.freeForcesRevived, 3);
  assert.deepEqual(wallets(paid), wallets(f.beforePayment));
  assert.equal(forceRevivalRemaining(paid, actor), 0);
  rejected(paid, f.actor, { type: 'revive', amount: 1 });
});

void test('new module admission rejects too few Tech seats, Basic Strongholds, unrelated modules and already-owned components', () => {
  for (const boundary of ['two-tech-seats', 'basic-strongholds', 'skills', 'owned-tech', 'owned-stronghold'] as const) {
    let lobby = createGame('NEXUSMODULEBOUNDARY', newPlayer('a', 'Atreides', 'atreides'), boundary !== 'basic-strongholds');
    joinGame(lobby, newPlayer('h', 'Harkonnen', 'harkonnen'));
    if (boundary !== 'two-tech-seats') joinGame(lobby, newPlayer('e', 'Emperor', 'emperor'));
    lobby.nexusCards = { cards: null, phase: null };
    if (boundary === 'owned-stronghold') lobby.strongholdCards = createStrongholdCards();
    else if (boundary !== 'basic-strongholds') lobby = applyAction(lobby, lobby.host, { type: 'techTokens', enabled: true });
    for (const player of lobby.players) lobby = applyAction(lobby, player.id, { type: 'ready' });
    if (boundary === 'basic-strongholds') lobby.strongholdCards = createStrongholdCards();
    if (boundary === 'skills') lobby.leaderSkills = createLeaderSkills(() => 0.5);
    if (boundary === 'owned-tech') lobby.techTokens!.axlotl.owner = 'a';
    if (boundary === 'owned-stronghold') lobby.strongholdCards!.owners.arrakeen = 'a';
    const before = structuredClone(lobby);
    assert.throws(() => initializeNexusGameForAudit(lobby));
    assert.deepEqual(lobby, before);
  }
  // Selected native-expansion cards/factions are not another path to admission.
  let lobby = createGame('NEXUSMODULEDECK', newPlayer('a', 'Atreides', 'atreides'), false, ['ix']);
  joinGame(lobby, newPlayer('h', 'Harkonnen', 'harkonnen'));
  joinGame(lobby, newPlayer('e', 'Emperor', 'emperor'));
  lobby.nexusCards = { cards: null, phase: null };
  lobby.techTokens = createTechTokens();
  for (const player of lobby.players) lobby = applyAction(lobby, player.id, { type: 'ready' });
  assert.throws(() => initializeNexusGameForAudit(lobby));
});

for (const strongholds of [false, true]) {
  void test(`original Emperor bank-auction purchase${strongholds ? ' with genuinely claimed Advanced Strongholds' : ' with Tech'} keeps the winning wallet, delivers the lot once and activates no technology`, () => {
    const f = createNexusModulePaymentsFixture({ kind: 'emperor-purchase',
      advanced: strongholds, strongholds });
    const before = f.beforePayment;
    const auction = before.auction!;
    const lot = auction.cards[auction.index];
    const buyer = before.players.find(p => p.id === f.actor)!;
    assert.equal(auction.bid, 2);
    assert.ok(buyer.spice >= auction.bid, 'The real buyer must possess the original invoice amount.');
    assert.equal(buyer.hand.some(card => card.id === lot.id), false);
    const paid = applyAction(f.game, f.actor, f.paymentAction);
    const after = paid.players.find(p => p.id === f.actor)!;
    assert.deepEqual(wallets(paid), wallets(before), 'Emperor Secret Ally retains the actual personal winning payment.');
    assert.equal(after.hand.filter(card => card.id === lot.id).length, 1);
    assert.equal(after.faction, buyer.faction);
    assert.equal(paid.nexusCards!.cards!.hands[f.actor], null);
    assert.equal(paid.nexusCards!.cards!.discard.filter(card => card === 'emperor').length, 1);
    assert.equal(paid.nexusEmperorPurchaseHistory!.length, 1);
    const receipt = paid.nexusEmperorPurchaseHistory![0];
    assert.equal(receipt.card, lot.id);
    assert.equal(receipt.price, 2);
    assert.equal(receipt.beforeSpice, buyer.spice);
    assert.equal(receipt.afterSpice, buyer.spice);
    assert.deepEqual(paid.techTokens, before.techTokens,
      'A bank purchase is neither a shipment, a free revival nor CHOAM Charity.');
    assert.deepEqual(paid.strongholdCards, before.strongholdCards);
    assert.ok(!paid.decision || paid.decision.kind !== 'auctionPayment',
      'The original winner payment cannot remain open after card delivery.');
    if (paid.auction) assert.equal(paid.auction.index, auction.index + 1);
    rejected(paid, f.actor, f.paymentAction);
    nexusInventory(paid);
    const continued = advanceNexusModulePaymentsToPhase(paid, 4);
    assert.equal(continued.players.find(p => p.id === f.actor)!.hand.filter(card => card.id === lot.id).length, 1);
    assert.equal(continued.nexusEmperorPurchaseHistory!.length, 1);
    assert.deepEqual(continued.techTokens, before.techTokens,
      'Completing the real Bidding round cannot mint a delayed technology pile for that purchase.');
    nexusInventory(continued);
  });
}
