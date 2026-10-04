import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { TERRITORIES } from '../game/board';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { forceRevivalQuote, forceRevivalRemaining } from '../game/revival';
import {
  advanceNexusSkillsModulesPayments, advanceNexusSkillsModulesPaymentsStep,
  advanceNexusSkillsModulesPaymentsToPhase, createNexusSkillsModulesPaymentsFixture,
  finishNexusSkillsModulesPaymentsFixture, holdNexusSkillsModulesPaymentsCard,
  initializeNexusSkillsModulesPaymentsSetup, nexusSkillsModulesPaymentsInventory,
  nexusSkillsModulesPaymentsPlayer, payNexusSkillsModulesPaymentsFixture,
  type NexusSkillsModulesPaymentsFixture,
} from './fixture-nexus-skills-modules-payments';

const wallets = (game: Game) => Object.fromEntries(game.players.map(player => [player.id, player.spice]));
function rejected(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'A rejected private action cannot mutate cards, counters or original accounting');
}
function custody(before: Game, after: Game): void {
  assert.deepEqual(after.leaderSkills, before.leaderSkills);
  assert.deepEqual(after.strongholdCards, before.strongholdCards,
    'A return, purchase or shipment grants no new Stronghold revival/payment advantage');
  for (const player of before.players)
    assert.deepEqual(viewGame(after, player.id).leaderSkills!.assignments,
      viewGame(before, player.id).leaderSkills!.assignments);
  nexusSkillsModulesPaymentsInventory(after);
}
/** Quote city Collection independently when native empty Battle auto-skips. */
function collectOnce(f: NexusSkillsModulesPaymentsFixture, paid: Game, amount: number): Game {
  const expected = wallets(paid);
  let ended = advanceNexusSkillsModulesPaymentsToPhase(paid, paid.phase + 1);
  if (ended.phase === 7)
    for (const receipt of quoteSpiceCollection(paid).receipts) expected[receipt.player] = receipt.balance;
  if (f.tokenOwner) expected[f.tokenOwner] += amount;
  assert.deepEqual(wallets(ended), expected, 'Only the original phase-end pile and separately quoted city collection become spendable');
  if (ended.techTokens) assert.equal(ended.techTokens[f.token].spice, 0);
  const collection = advanceNexusSkillsModulesPaymentsToPhase(ended, 7);
  const atCollection = wallets(collection);
  ended = advanceNexusSkillsModulesPaymentsToPhase(collection, 8);
  assert.deepEqual(wallets(ended), atCollection, 'Mentat cannot collect the same Tech pile again');
  if (ended.techTokens) assert.equal(ended.techTokens[f.token].spice, 0);
  const continued = advanceNexusSkillsModulesPaymentsStep(ended);
  assert.deepEqual(wallets(continued), atCollection);
  custody(paid, continued);
  return continued;
}
const configurations = [
  { name: 'Basic Tech', advanced: false, tech: true, strongholds: false },
  { name: 'Advanced Tech', advanced: true, tech: true, strongholds: false },
  { name: 'Advanced Strongholds', advanced: true, tech: false, strongholds: true },
  { name: 'Advanced Tech/Strongholds', advanced: true, tech: true, strongholds: true },
] as const;

// Original Nexus Emperor extra-three and the recorded original Fremen free-three
// interpretation remain distinct. E1 printed p5: free revivals trigger Axlotl,
// payable only at Revival end (http://boardgame.bg/dune%20ixians%20and%20tleilaxu%20rulebook.pdf).
for (const config of configurations) {
  for (const kind of ['emperor-revival', 'fremen-revival'] as const) {
    void test(`${config.name} original all14/33/12 ${kind} conserves physical returns, quota and phase-end Axlotl once`, () => {
      const f = createNexusSkillsModulesPaymentsFixture({ ...config, kind });
      assert.equal(f.afterSetup.leaderSkills!.assignments.length, f.afterSetup.players.length);
      assert.equal(f.beforeFirstMentat.turn, 1); assert.equal(f.afterFirstMentat.turn, 2);
      if (config.tech) {
        assert.ok(Object.values(f.afterFirstMentat.techTokens!).every(token => token.owner));
      }
      if (config.strongholds) {
        assert.equal(f.beforeFirstMentat.strongholdCards!.owners.arrakeen, null);
        assert.equal(f.afterFirstMentat.strongholdCards!.owners.arrakeen, f.actor);
      }
      assert.equal(f.beforeClosingDraw.nexusCards!.phase!.stage, 'drawing');
      assert.equal(f.beforeClosingDraw.nexusCards!.cards!.hands[f.actor], null);
      assert.equal(f.afterClosingDraw.nexusCards!.cards!.hands[f.actor], kind === 'emperor-revival' ? 'emperor' : 'fremen');
      const before = nexusSkillsModulesPaymentsPlayer(f.game, f.actor);
      rejected(f.game, f.opponent, f.paymentAction);
      rejected(f.game, f.actor, { ...f.paymentAction, event: 'stale' });
      let paid = payNexusSkillsModulesPaymentsFixture(f);
      let actor = nexusSkillsModulesPaymentsPlayer(paid, f.actor);
      assert.equal(actor.reserves, before.reserves + 3); assert.equal(actor.tanks, before.tanks - 3);
      assert.deepEqual(wallets(paid), wallets(f.game), 'A free return does not collect the accrued token or mint personal income');
      assert.equal(actor.revived, kind === 'fremen-revival' ? 3 : before.revived);
      assert.equal(actor.freeForcesRevived ?? 0, kind === 'fremen-revival' ? 3 : (before.freeForcesRevived ?? 0));
      assert.equal(paid.nexusCards!.cards!.hands[f.actor], null);
      assert.equal(paid.nexusCards!.cards!.discard.filter(card => card === (kind === 'emperor-revival' ? 'emperor' : 'fremen')).length, 1);
      const receipt = kind === 'emperor-revival' ? paid.nexusEmperorSecretHistory![0] : paid.nexusFremenRevivalHistory![0];
      assert.equal(receipt.owner, f.actor); assert.equal(receipt.turn, 2); assert.equal(receipt.phase, 4);
      assert.equal(receipt.before.tanks - receipt.after.tanks, 3);
      assert.equal(receipt.before.spice, receipt.after.spice);
      if (config.tech) {
        assert.equal(paid.techTokens!.axlotl.spice, f.tokenCount);
        assert.equal(paid.techTokens!.axlotl.triggeredTurn, paid.turn);
      }
      custody(f.game, paid); rejected(paid, f.actor, f.paymentAction);
      if (kind === 'fremen-revival') {
        assert.equal(forceRevivalRemaining(paid, actor), 0);
        rejected(paid, f.actor, { type: 'revive', amount: 1 });
      } else {
        assert.equal(forceRevivalRemaining(paid, actor), 3);
        const quote = forceRevivalQuote(paid, actor, 3);
        assert.equal(quote.cost, 2, 'A Stronghold cannot increase the original Atreides two-free allowance');
        paid = applyAction(paid, f.actor, { type: 'revive', amount: 3 });
        paid = finishNexusSkillsModulesPaymentsFixture(f, paid);
        actor = nexusSkillsModulesPaymentsPlayer(paid, f.actor);
        assert.equal(actor.reserves, before.reserves + 6); assert.equal(actor.tanks, before.tanks - 6);
        assert.equal(actor.spice, before.spice - quote.cost);
        assert.equal(actor.revived, 3); assert.equal(actor.freeForcesRevived, 2);
        if (config.tech) assert.equal(paid.techTokens!.axlotl.spice, f.tokenCount, 'A second genuine free batch cannot accrue Axlotl twice');
      }
      custody(f.game, paid);
      const mentat = collectOnce(f, paid, f.tokenCount);
      assert.equal(nexusSkillsModulesPaymentsPlayer(mentat, f.actor).revived, 3);
      const nextTurn = advanceNexusSkillsModulesPayments(mentat, game => game.turn === 3);
      const nextRevival = advanceNexusSkillsModulesPaymentsToPhase(nextTurn, 4);
      assert.equal(nexusSkillsModulesPaymentsPlayer(nextRevival, f.actor).revived, 0);
      assert.equal(nexusSkillsModulesPaymentsPlayer(nextRevival, f.actor).freeForcesRevived ?? 0, 0);
      assert.deepEqual(nextRevival.nexusEmperorSecretHistory, paid.nexusEmperorSecretHistory);
      assert.deepEqual(nextRevival.nexusFremenRevivalHistory, paid.nexusFremenRevivalHistory);
    });
  }

  void test(`${config.name} normal Emperor bank-auction purchase delivers the real lot once without payment, industry or normal Banker award`, () => {
    const f = createNexusSkillsModulesPaymentsFixture({ ...config, kind: 'emperor-purchase', skill: 'spice-banker' });
    const auction = f.game.auction!, lot = auction.cards[auction.index];
    const buyer = nexusSkillsModulesPaymentsPlayer(f.game, f.actor);
    assert.equal(auction.bid, 2); assert.equal(auction.bidder, f.actor); assert.equal(auction.allyPayment ?? 0, 0);
    assert.ok(buyer.spice >= 2); assert.ok(!buyer.hand.some(card => card.id === lot.id));
    assert.ok(f.game.leaderSkills!.assignments.some(a => a.owner === f.actor && a.skill === 'spice-banker'));
    rejected(f.game, f.opponent, f.paymentAction);
    const view = viewGame(f.game, f.actor); view.players.find(p => p.id === f.actor)!.bot = 'Hard';
    const bot = botActions(view).find(action => action.type === 'nexusEmperorPurchase');
    assert.deepEqual(bot, f.paymentAction);
    const paid = applyAction(f.game, f.actor, bot!);
    assert.deepEqual(wallets(paid), wallets(f.game));
    assert.equal(nexusSkillsModulesPaymentsPlayer(paid, f.actor).hand.filter(card => card.id === lot.id).length, 1);
    const receipt = paid.nexusEmperorPurchaseHistory![0];
    assert.equal(receipt.card, lot.id); assert.equal(receipt.price, 2);
    assert.equal(receipt.beforeSpice, buyer.spice); assert.equal(receipt.afterSpice, buyer.spice);
    assert.equal(paid.nexusEmperorPurchaseHistory!.length, 1);
    assert.deepEqual(paid.techTokens, f.game.techTokens);
    assert.equal(viewGame(paid, f.actor).spiceBankerIncome, null);
    assert.equal(paid.spiceBankerIncome, undefined);
    assert.equal(paid.currentAuctionSale?.spiceBankerIncomePayment, undefined);
    custody(f.game, paid); rejected(paid, f.actor, f.paymentAction);
    const continued = advanceNexusSkillsModulesPaymentsToPhase(paid, 4);
    assert.equal(nexusSkillsModulesPaymentsPlayer(continued, f.actor).hand.filter(card => card.id === lot.id).length, 1);
    assert.deepEqual(continued.nexusEmperorPurchaseHistory, paid.nexusEmperorPurchaseHistory);
    assert.deepEqual(continued.techTokens, f.game.techTokens); custody(f.game, continued);
  });

  void test(`${config.name} source-clear ordinary non-Guild shipment uses native full price and phase-end Heighliners`, () => {
    const f = createNexusSkillsModulesPaymentsFixture({ ...config, kind: 'native-shipment' });
    const before = nexusSkillsModulesPaymentsPlayer(f.game, f.actor);
    const paid = finishNexusSkillsModulesPaymentsFixture(f, payNexusSkillsModulesPaymentsFixture(f));
    const after = nexusSkillsModulesPaymentsPlayer(paid, f.actor);
    assert.equal(after.faction, 'atreides'); assert.equal(f.cost, f.amount);
    assert.equal(after.spice, before.spice - f.cost);
    assert.equal(after.reserves, before.reserves - f.amount);
    assert.equal(after.forces[f.destination!], f.amount); assert.equal(after.shipped, true);
    assert.equal(paid.nexusCards!.cards!.hands[f.actor], 'emperor', 'Ordinary shipping cannot spend a private unused Nexus singleton');
    if (config.tech) {
      assert.equal(paid.techTokens!.heighliners.spice, f.tokenCount);
      assert.equal(paid.techTokens!.heighliners.triggeredTurn, paid.turn);
    }
    custody(f.game, paid); rejected(paid, f.actor, f.paymentAction);
    collectOnce(f, paid, f.tokenCount);
  });
}

for (const kind of ['emperor-revival', 'fremen-revival'] as const) {
  void test(`Advanced combined ${kind} real bot returns one original elite and respects the shared per-turn cap`, () => {
    const f = createNexusSkillsModulesPaymentsFixture({ kind, advanced: true, tech: true, strongholds: true,
      ownerFaction: kind === 'emperor-revival' ? 'fremen' : 'emperor', eliteTanks: 2 });
    const view = viewGame(f.game, f.actor);
    const offer = kind === 'emperor-revival' ? view.nexusEmperorSecretAlly!.revival : view.nexusFremenRevival!;
    assert.deepEqual(offer.eliteOptions, [0, 1]);
    rejected(f.game, f.actor, { ...f.paymentAction, elite: 2 });
    view.players.find(p => p.id === f.actor)!.bot = 'Hard';
    const bot = botActions(view).find(action => action.type === f.paymentAction.type); assert.ok(bot);
    const paid = applyAction(f.game, f.actor, bot);
    const before = nexusSkillsModulesPaymentsPlayer(f.game, f.actor), after = nexusSkillsModulesPaymentsPlayer(paid, f.actor);
    assert.equal(after.elites!.reserves, before.elites!.reserves + 1);
    assert.equal(after.elites!.tanks, before.elites!.tanks - 1); assert.equal(after.elites!.revived, 1);
    assert.equal(after.reserves, before.reserves + 3); assert.equal(after.tanks, before.tanks - 3);
    assert.deepEqual(wallets(paid), wallets(f.game));
    rejected(paid, f.actor, { type: 'revive', amount: 1, elite: 1 });
    custody(f.game, paid); collectOnce(f, paid, f.tokenCount);
  });
}

void test('combined ordinary-first Emperor extra-three and early-only Fremen preserve their different ledgers and exact-three boundary', () => {
  const extra = createNexusSkillsModulesPaymentsFixture({ advanced: true, strongholds: true });
  const ordinary = applyAction(extra.game, extra.actor, { type: 'revive', amount: 3 });
  const paid = payNexusSkillsModulesPaymentsFixture(extra, ordinary);
  const before = nexusSkillsModulesPaymentsPlayer(ordinary, extra.actor), after = nexusSkillsModulesPaymentsPlayer(paid, extra.actor);
  assert.equal(after.reserves, before.reserves + 3); assert.equal(after.tanks, before.tanks - 3);
  assert.equal(after.spice, before.spice); assert.equal(after.revived, 3); assert.equal(after.freeForcesRevived, 2);
  assert.equal(paid.techTokens!.axlotl.spice, ordinary.techTokens!.axlotl.spice);
  const fremen = createNexusSkillsModulesPaymentsFixture({ kind: 'fremen-revival', advanced: true, strongholds: true });
  const late = applyAction(fremen.game, fremen.actor, { type: 'revive', amount: 1 });
  assert.ok(viewGame(late, fremen.actor).nexusFremenRevival!.blocked);
  rejected(late, fremen.actor, fremen.paymentAction);
  for (const kind of ['emperor-revival', 'fremen-revival'] as const) {
    const short = createNexusSkillsModulesPaymentsFixture({ kind, advanced: true, strongholds: true, tanks: 2 });
    rejected(short.game, short.actor, short.paymentAction);
    assert.equal(nexusSkillsModulesPaymentsPlayer(short.game, short.actor).tanks, 2);
    custody(short.game, short.game);
  }
});

for (const ownerFaction of ['guild', 'fremen'] as const) {
  void test(`original ${ownerFaction} native shipment cannot activate Heighliners from excluded source identity`, () => {
    const f = createNexusSkillsModulesPaymentsFixture({ kind: 'native-shipment', ownerFaction, advanced: true, strongholds: true });
    const before = nexusSkillsModulesPaymentsPlayer(f.game, f.actor);
    const paid = finishNexusSkillsModulesPaymentsFixture(f, payNexusSkillsModulesPaymentsFixture(f));
    const after = nexusSkillsModulesPaymentsPlayer(paid, f.actor);
    assert.equal(after.faction, ownerFaction); assert.equal(after.forces[f.destination!], f.amount);
    assert.equal(after.reserves, before.reserves - f.amount); assert.equal(after.spice, before.spice - f.cost);
    assert.equal(f.cost, ownerFaction === 'fremen' ? 0 : Math.ceil(f.amount / 2));
    assert.equal(paid.techTokens!.heighliners.spice, 0);
    assert.notEqual(paid.techTokens!.heighliners.triggeredTurn, paid.turn);
    custody(f.game, paid); collectOnce(f, paid, 0);
  });
}

void test('an actual Guild interception blocks settlement and original phase-end collection; stopping it pays no invoice or Heighliners', () => {
  const f = createNexusSkillsModulesPaymentsFixture({ kind: 'native-shipment', advanced: true, strongholds: true, nativeGuild: true });
  const guild = f.game.players.find(p => p.faction === 'guild')!;
  const counter = holdNexusSkillsModulesPaymentsCard(f.game, guild.id, 'karama', f.staging);
  const before = structuredClone(f.game);
  let game = payNexusSkillsModulesPaymentsFixture(f);
  assert.equal(game.decision?.kind, 'guildShipment'); assert.ok(game.pendingShipment);
  assert.deepEqual(wallets(game), wallets(before));
  assert.equal(game.techTokens!.heighliners.spice, 0);
  for (const player of game.players) rejected(game, player.id, { type: 'ready' });
  game = applyAction(game, guild.id, { type: 'card', mode: 'special', card: counter.id });
  game = finishNexusSkillsModulesPaymentsFixture(f, game);
  assert.deepEqual(wallets(game), wallets(before));
  assert.equal(nexusSkillsModulesPaymentsPlayer(game, f.actor).reserves, nexusSkillsModulesPaymentsPlayer(before, f.actor).reserves);
  assert.equal(nexusSkillsModulesPaymentsPlayer(game, f.actor).forces[f.destination!], undefined);
  assert.ok(game.discard.some(card => card.id === counter.id));
  assert.equal(game.techTokens!.heighliners.spice, 0);
  custody(before, game); collectOnce(f, game, 0);
});

void test('actual initialized module setup preserves authenticated IDs, dealt hands and saved skill offers; explicit missing skill is not replaced', () => {
  const setup = initializeNexusSkillsModulesPaymentsSetup({ advanced: true, strongholds: true,
    seatIds: ['authenticated-owner', 'authenticated-second', 'authenticated-third'], skill: 'sandmaster' });
  const before = structuredClone(setup);
  const accepted = initializeNexusSkillsModulesPaymentsSetup({ initial: setup });
  assert.deepEqual(accepted, before);
  const selected = advanceNexusSkillsModulesPayments(accepted, state => state.leaderSkills!.assignments.length === 1);
  assert.equal(selected.leaderSkills!.assignments.length, 1);
  const f = createNexusSkillsModulesPaymentsFixture({ initial: setup, skill: 'sandmaster' });
  assert.equal(f.actor, 'authenticated-owner'); assert.deepEqual(f.initial, before);
  assert.deepEqual(f.game.players.map(p => p.id), before.players.map(p => p.id));
  assert.deepEqual(setup, before);
  assert.ok(f.game.leaderSkills!.assignments.some(a => a.owner === f.actor && a.skill === 'sandmaster'));
  assert.throws(() => createNexusSkillsModulesPaymentsFixture({ initial: setup, skill: 'spice-banker' }));
  assert.deepEqual(setup, before);
  custody(f.game, payNexusSkillsModulesPaymentsFixture(f));
});

void test('earned combined Axlotl pile stays unavailable while an actual original private Truthtrance is unsettled', () => {
  const f = createNexusSkillsModulesPaymentsFixture({ advanced: true, strongholds: true });
  let paid = payNexusSkillsModulesPaymentsFixture(f);
  const card = holdNexusSkillsModulesPaymentsCard(paid, f.opponent, 'truthtrance', f.staging);
  const before = structuredClone(paid);
  paid = applyAction(paid, f.opponent, { type: 'card', card: card.id });
  assert.ok(paid.truthtrance);
  assert.equal(paid.phase, 4);
  assert.equal(paid.techTokens!.axlotl.spice, f.tokenCount);
  assert.deepEqual(wallets(paid), wallets(before));
  for (const player of paid.players) rejected(paid, player.id, { type: 'ready' });
  const settled = finishNexusSkillsModulesPaymentsFixture(f, paid);
  assert.ok(!settled.truthtrance);
  assert.equal(settled.phase, 4);
  assert.equal(settled.techTokens!.axlotl.spice, f.tokenCount);
  assert.deepEqual(wallets(settled), wallets(before));
  assert.ok(settled.discard.some(c => c.id === card.id));
  custody(before, settled);
  collectOnce(f, settled, f.tokenCount);
});

void test('two actual ordinary off-planet shipments in the same combined phase accrue only one original Heighliners pile', () => {
  const f = createNexusSkillsModulesPaymentsFixture({ kind: 'native-shipment', advanced: true, strongholds: true });
  let game = advanceNexusSkillsModulesPaymentsToPhase(f.afterClosingDraw, 5);
  const before = structuredClone(game);
  const shippers: string[] = [];
  for (let n = 0; n < 2; n++) {
    assert.equal(game.phase, 5);
    const actor = game.active!, player = nexusSkillsModulesPaymentsPlayer(game, actor);
    assert.notEqual(player.faction, 'guild'); assert.notEqual(player.faction, 'fremen');
    assert.ok(!shippers.includes(actor)); shippers.push(actor);
    const target = TERRITORIES.find(t => t.type === 'stronghold' && !t.sectors.includes(game.storm)
      && game.players.every(p => Object.keys(p.forces).every(key => !key.startsWith(`${t.id}:`))));
    assert.ok(target);
    const sector = target.sectors[0], wallet = player.spice, reserves = player.reserves;
    game = applyAction(game, actor, { type: 'ship', territory: target.id, sector, amount: 1, smuggler: false });
    game = finishNexusSkillsModulesPaymentsFixture(f, game);
    assert.equal(nexusSkillsModulesPaymentsPlayer(game, actor).reserves, reserves - 1);
    assert.equal(nexusSkillsModulesPaymentsPlayer(game, actor).forces[`${target.id}:${sector}`], 1);
    assert.equal(nexusSkillsModulesPaymentsPlayer(game, actor).spice, wallet - 1);
    assert.equal(game.techTokens!.heighliners.spice, f.tokenCount);
    assert.equal(game.techTokens!.heighliners.triggeredTurn, game.turn);
    if (n === 0) {
      game = applyAction(game, actor, { type: 'endMovement' });
      game = finishNexusSkillsModulesPaymentsFixture(f, game);
    }
  }
  custody(before, game);
  collectOnce(f, game, f.tokenCount);
});

void test('classic Nexus Skills and selected components retain the original once-per-phase Bureaucrat payment diversion', () => {
  for (const config of configurations) {
    const f = createNexusSkillsModulesPaymentsFixture({ ...config, kind: 'native-shipment', skill: 'bureaucrat',
      seatIds: ['owner', 'payer', 'guild', 'other'] });
    const payer = f.game.players.find(player => player.id !== f.actor)!;
    const payee = f.game.players.find(player => player.id !== f.actor && player.id !== payer.id && player.id !== payer.ally)!;
    const before = structuredClone(f.game);
    let game = applyAction(f.game, payer.id, { type: 'bribe', target: payee.id, amount: 5 });
    assert.equal(game.decision?.kind, 'bureaucratPayment');
    assert.equal(nexusSkillsModulesPaymentsPlayer(game, payer.id).spice, payer.spice - 5);
    assert.equal(nexusSkillsModulesPaymentsPlayer(game, payee.id).bribes, payee.bribes);
    game = applyAction(game, f.actor, { type: 'decision', event: game.bureaucratPaymentEvent, redirect: true });
    assert.equal(nexusSkillsModulesPaymentsPlayer(game, payee.id).bribes, payee.bribes + 3);
    assert.equal(viewGame(game, f.actor).bureaucrat.usedThisPhase, true);
    assert.deepEqual(game.techTokens, before.techTokens, 'A bribe is not a Tech industry payment');
    assert.deepEqual(game.strongholdCards, before.strongholdCards);
    const again = applyAction(game, payer.id, { type: 'bribe', target: payee.id, amount: 5 });
    assert.equal(again.decision ?? null, null);
    assert.equal(nexusSkillsModulesPaymentsPlayer(again, payee.id).bribes, payee.bribes + 8);
    assert.equal(again.bureaucratPayments!.used.length, 1);
    nexusSkillsModulesPaymentsInventory(again);
  }
});
