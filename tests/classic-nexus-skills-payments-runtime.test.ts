import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { forceRevivalQuote, forceRevivalRemaining } from '../game/revival';
import {
  advanceClassicNexusSkillsPayments, advanceClassicNexusSkillsPaymentsStep,
  advanceClassicNexusSkillsPaymentsToPhase, classicNexusSkillsPaymentsInventory,
  classicNexusSkillsPaymentsPlayer, createClassicNexusSkillsPaymentsFixture,
  finishClassicNexusSkillsPaymentsFixture, initializeClassicNexusSkillsPaymentsSetup,
  payClassicNexusSkillsPaymentsFixture,
} from './fixture-classic-nexus-skills-payments';

function rejected(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'Invalid actions cannot mutate physical custody or any original accounting');
}
const wallets = (game: Game) => game.players.map(({ id, spice }) => ({ id, spice }));
function sameSkillCustody(before: Game, after: Game): void {
  assert.deepEqual(after.leaderSkills, before.leaderSkills, 'Nexus use cannot redraw, detach or transfer an ordinary physical skill');
  for (const player of before.players)
    assert.deepEqual(viewGame(after, player.id).leaderSkills!.assignments,
      viewGame(before, player.id).leaderSkills!.assignments,
      'Consumer-visible assignment, controller and face-up custody must remain unchanged');
}

for (const advanced of [false, true]) {
  for (const kind of ['emperor-revival', 'fremen-revival'] as const) {
    void test(`${advanced ? 'Advanced' : 'Basic'} all14/${kind} returns exactly three with original quota and wallet accounting`, () => {
      const f = createClassicNexusSkillsPaymentsFixture({ advanced, kind });
      assert.equal(f.initial.setupStage, 'leaderSkills');
      assert.equal(f.initial.leaderSkills!.assignments.length, 0);
      assert.equal(f.afterSetup.leaderSkills!.assignments.length, f.afterSetup.players.length);
      assert.ok(f.afterSetup.players.every(player => player.traitorChoices.length === 0));
      assert.equal(f.beforeFirstMentat.turn, 1);
      assert.equal(f.afterFirstMentat.turn, 2);
      assert.equal(f.beforeClosingDraw.nexusCards!.phase!.stage, 'drawing');
      assert.equal(f.beforeClosingDraw.nexusCards!.cards!.hands[f.actor], null);
      assert.equal(f.afterClosingDraw.nexusCards!.cards!.hands[f.actor], kind === 'emperor-revival' ? 'emperor' : 'fremen');
      assert.equal(f.game.phase, 4);
      const before = classicNexusSkillsPaymentsPlayer(f.game, f.actor);
      rejected(f.game, f.opponent, f.paymentAction);
      rejected(f.game, f.actor, { ...f.paymentAction, event: 'stale' });
      let paid = payClassicNexusSkillsPaymentsFixture(f);
      let actor = classicNexusSkillsPaymentsPlayer(paid, f.actor);
      assert.equal(actor.reserves, before.reserves + 3);
      assert.equal(actor.tanks, before.tanks - 3);
      assert.deepEqual(wallets(paid), wallets(f.game));
      assert.equal(actor.revived, kind === 'fremen-revival' ? 3 : before.revived);
      assert.equal(actor.freeForcesRevived ?? 0, kind === 'fremen-revival' ? 3 : (before.freeForcesRevived ?? 0));
      assert.equal(paid.nexusCards!.cards!.hands[f.actor], null);
      assert.equal(paid.nexusCards!.cards!.discard.filter(card => card === (kind === 'emperor-revival' ? 'emperor' : 'fremen')).length, 1);
      const receipt = kind === 'emperor-revival' ? paid.nexusEmperorSecretHistory![0] : paid.nexusFremenRevivalHistory![0];
      assert.equal(receipt.owner, f.actor); assert.equal(receipt.turn, 2); assert.equal(receipt.phase, 4);
      assert.equal(receipt.before.tanks - receipt.after.tanks, 3);
      assert.equal(receipt.before.spice, receipt.after.spice);
      sameSkillCustody(f.game, paid);
      rejected(paid, f.actor, f.paymentAction);
      if (kind === 'fremen-revival') {
        assert.equal(forceRevivalRemaining(paid, actor), 0);
        rejected(paid, f.actor, { type: 'revive', amount: 1 });
      } else {
        assert.equal(forceRevivalRemaining(paid, actor), 3);
        const quote = forceRevivalQuote(paid, actor, 3);
        assert.equal(quote.cost, 2, 'Atreides retains its original two-free plus one-paid invoice');
        paid = applyAction(paid, f.actor, { type: 'revive', amount: 3 });
        actor = classicNexusSkillsPaymentsPlayer(paid, f.actor);
        assert.equal(actor.reserves, before.reserves + 6);
        assert.equal(actor.tanks, before.tanks - 6);
        assert.equal(actor.spice, before.spice - quote.cost);
        assert.equal(actor.revived, 3); assert.equal(actor.freeForcesRevived, 2);
        sameSkillCustody(f.game, paid);
      }
      classicNexusSkillsPaymentsInventory(paid);
      const atMentat = advanceClassicNexusSkillsPaymentsToPhase(paid, 8);
      assert.equal(atMentat.turn, 2);
      assert.equal(classicNexusSkillsPaymentsPlayer(atMentat, f.actor).revived, 3,
        'Movement/Battle/Collection cannot prematurely reset the original Revival ledger');
      sameSkillCustody(f.game, atMentat);
      const nextTurn = advanceClassicNexusSkillsPayments(atMentat, game => game.turn === 3);
      assert.equal(classicNexusSkillsPaymentsPlayer(nextTurn, f.actor).revived, 3,
        'The real END Mentat does not reset force-revival accounting early');
      const nextRevival = advanceClassicNexusSkillsPaymentsToPhase(nextTurn, 4);
      assert.equal(classicNexusSkillsPaymentsPlayer(nextRevival, f.actor).revived, 0);
      assert.equal(classicNexusSkillsPaymentsPlayer(nextRevival, f.actor).freeForcesRevived ?? 0, 0);
      assert.deepEqual(nextTurn.nexusEmperorSecretHistory, paid.nexusEmperorSecretHistory);
      assert.deepEqual(nextTurn.nexusFremenRevivalHistory, paid.nexusFremenRevivalHistory);
      sameSkillCustody(f.game, nextTurn);
      classicNexusSkillsPaymentsInventory(nextTurn);
    });
  }

  void test(`${advanced ? 'Advanced' : 'Basic'} Fremen free-three remains early-only and both grants require an exact three`, () => {
    const f = createClassicNexusSkillsPaymentsFixture({ advanced, kind: 'fremen-revival' });
    const late = applyAction(f.game, f.actor, { type: 'revive', amount: 1 });
    assert.match(viewGame(late, f.actor).nexusFremenRevival!.blocked!, /before ordinary force revivals/);
    rejected(late, f.actor, f.paymentAction);
    sameSkillCustody(f.game, late);
    for (const kind of ['emperor-revival', 'fremen-revival'] as const) {
      const short = createClassicNexusSkillsPaymentsFixture({ advanced, kind, tanks: 2 });
      rejected(short.game, short.actor, short.paymentAction);
      assert.equal(classicNexusSkillsPaymentsPlayer(short.game, short.actor).tanks, 2);
      classicNexusSkillsPaymentsInventory(short.game);
    }
    const extra = createClassicNexusSkillsPaymentsFixture({ advanced, kind: 'emperor-revival' });
    let ordinary = applyAction(extra.game, extra.actor, { type: 'revive', amount: 3 });
    const pools = classicNexusSkillsPaymentsPlayer(ordinary, extra.actor);
    const wallet = pools.spice;
    ordinary = applyAction(ordinary, extra.actor, extra.paymentAction);
    const after = classicNexusSkillsPaymentsPlayer(ordinary, extra.actor);
    assert.equal(after.revived, 3); assert.equal(after.freeForcesRevived, 2);
    assert.equal(after.reserves, pools.reserves + 3); assert.equal(after.tanks, pools.tanks - 3);
    assert.equal(after.spice, wallet, 'Emperor remains additional even after the ordinary quota is spent');
    sameSkillCustody(extra.game, ordinary);
    classicNexusSkillsPaymentsInventory(ordinary);
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} normal bank auction Emperor Secret Ally retains the earned bid and delivers one original lot`, () => {
    const f = createClassicNexusSkillsPaymentsFixture({ advanced, kind: 'emperor-purchase' });
    const auction = f.game.auction!;
    const lot = auction.cards[auction.index];
    assert.equal(f.game.decision!.kind, 'auctionPayment');
    assert.equal(f.game.decision!.player, f.actor);
    assert.equal(auction.bidder, f.actor); assert.equal(auction.bid, 2);
    assert.equal(auction.allyPayment ?? 0, 0);
    const buyer = classicNexusSkillsPaymentsPlayer(f.game, f.actor);
    assert.ok(buyer.spice >= auction.bid);
    assert.ok(!buyer.hand.some(card => card.id === lot.id));
    rejected(f.game, f.opponent, f.paymentAction);
    rejected(f.game, f.actor, { ...f.paymentAction, event: 'stale' });
    const botView = viewGame(f.game, f.actor);
    botView.players.find(player => player.id === f.actor)!.bot = 'Hard';
    const bot = botActions(botView).find(action => action.type === 'nexusEmperorPurchase');
    assert.deepEqual(bot, f.paymentAction);
    const paid = applyAction(f.game, f.actor, bot!);
    assert.deepEqual(wallets(paid), wallets(f.game));
    assert.equal(classicNexusSkillsPaymentsPlayer(paid, f.actor).hand.filter(card => card.id === lot.id).length, 1);
    const receipt = paid.nexusEmperorPurchaseHistory![0];
    assert.equal(receipt.card, lot.id); assert.equal(receipt.price, 2);
    assert.equal(receipt.beforeSpice, buyer.spice); assert.equal(receipt.afterSpice, buyer.spice);
    assert.equal(paid.nexusEmperorPurchaseHistory!.length, 1);
    assert.equal(paid.nexusCards!.cards!.discard.filter(card => card === 'emperor').length, 1);
    sameSkillCustody(f.game, paid); rejected(paid, f.actor, f.paymentAction);
    classicNexusSkillsPaymentsInventory(paid);
    const continued = advanceClassicNexusSkillsPaymentsToPhase(paid, 4);
    assert.equal(classicNexusSkillsPaymentsPlayer(continued, f.actor).hand.filter(card => card.id === lot.id).length, 1);
    assert.deepEqual(continued.nexusEmperorPurchaseHistory, paid.nexusEmperorPurchaseHistory);
    sameSkillCustody(f.game, continued); classicNexusSkillsPaymentsInventory(continued);
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} original Harkonnen Cunning draws and returns physical traitors without changing trained-disc custody`, () => {
    const f = createClassicNexusSkillsPaymentsFixture({ advanced, kind: 'harkonnen-cunning' });
    const owner = classicNexusSkillsPaymentsPlayer(f.game, f.actor);
    const top = f.game.traitorReserve![0];
    const reserve = [...f.game.traitorReserve!];
    assert.equal(owner.traitors.length, 4);
    rejected(f.game, f.opponent, f.paymentAction);
    rejected(f.game, f.actor, { ...f.paymentAction, event: 'stale' });
    const view = viewGame(f.game, f.actor);
    view.players.find(player => player.id === f.actor)!.bot = 'Hard';
    const bot = botActions(view).find(action => action.type === 'nexusTraitorDraw');
    assert.deepEqual(bot, f.paymentAction);
    const drawn = applyAction(f.game, f.actor, bot!);
    assert.deepEqual(classicNexusSkillsPaymentsPlayer(drawn, f.actor).traitors, [...owner.traitors, top]);
    assert.deepEqual(drawn.traitorReserve, reserve.slice(1));
    assert.equal(drawn.nexusCards!.cards!.hands[f.actor], null);
    const pending = viewGame(drawn, f.actor).nexusTraitors!.pending!;
    assert.equal(pending.count, 1);
    assert.equal(pending.choices.filter(choice => choice.drawn).length, 1);
    sameSkillCustody(f.game, drawn);
    for (const actor of drawn.players.map(player => player.id)) rejected(drawn, actor, { type: 'ready' });
    const giveBack: Action = { type: 'nexusTraitorReturn', event: pending.event, cards: [owner.traitors[0]] };
    rejected(drawn, f.opponent, giveBack);
    rejected(drawn, f.actor, { ...giveBack, event: 'stale' });
    rejected(drawn, f.actor, { ...giveBack, cards: ['foreign-identity'] });
    const returned = finishClassicNexusSkillsPaymentsFixture(f, drawn, [owner.traitors[0]]);
    assert.deepEqual(classicNexusSkillsPaymentsPlayer(returned, f.actor).traitors, [...owner.traitors.slice(1), top]);
    assert.equal(returned.traitorReserve!.length, reserve.length);
    assert.ok(returned.traitorReserve!.includes(owner.traitors[0]));
    assert.equal(returned.nexusTraitorExchanges![0].stage, 'complete');
    assert.equal(returned.nexusCards!.cards!.discard.filter(card => card === 'harkonnen').length, 1);
    assert.deepEqual(wallets(returned), wallets(f.game));
    rejected(returned, f.actor, giveBack); rejected(returned, f.actor, f.paymentAction);
    sameSkillCustody(f.game, returned); classicNexusSkillsPaymentsInventory(returned);
  });

  for (const declaredTraitor of ['call', 'decline'] as const) {
    void test(`${advanced ? 'Advanced' : 'Basic'} Cunning preserves an earlier ${declaredTraitor} after its physical matching identity changes custody`, () => {
      const f = createClassicNexusSkillsPaymentsFixture({ advanced, kind: 'harkonnen-cunning', declaredTraitor });
      const identity = f.declaredIdentity!;
      assert.equal(f.game.battle!.traitorCalls[f.actor], declaredTraitor === 'call');
      const declaration = structuredClone(f.game.battle!.traitorDeclarations);
      const drawn = payClassicNexusSkillsPaymentsFixture(f);
      assert.ok(classicNexusSkillsPaymentsPlayer(drawn, f.actor).traitors.includes(identity));
      const pending = viewGame(drawn, f.actor).nexusTraitors!.pending!;
      const returnedIdentity = declaredTraitor === 'call' ? identity : pending.choices.find(choice => choice.id !== identity)!.id;
      const returned = finishClassicNexusSkillsPaymentsFixture(f, drawn, [returnedIdentity]);
      assert.equal(classicNexusSkillsPaymentsPlayer(returned, f.actor).traitors.includes(identity), declaredTraitor === 'decline');
      assert.equal(returned.battle!.traitorCalls[f.actor], declaredTraitor === 'call');
      assert.deepEqual(returned.battle!.traitorDeclarations, declaration);
      if (declaredTraitor === 'call') assert.equal(returned.battle!.traitorDeclarations![f.actor].identity, identity);
      else rejected(returned, f.actor, { type: 'traitorCall', call: true });
      sameSkillCustody(f.game, returned);
      const resolved = applyAction(returned, f.opponent, { type: 'traitorCall', call: false });
      if (declaredTraitor === 'call') assert.equal(classicNexusSkillsPaymentsPlayer(resolved, f.opponent).tanks, 5);
      else assert.equal(resolved.lastBattleContext!.result, 'normal',
        'An identity drawn after declining cannot become a retroactive traitor call');
      sameSkillCustody(f.game, resolved); classicNexusSkillsPaymentsInventory(resolved);
    });
  }
}

for (const kind of ['emperor-revival', 'fremen-revival'] as const) {
  void test(`${kind} genuinely preserves Advanced native elite counters and the original one-per-turn cap`, () => {
    const f = createClassicNexusSkillsPaymentsFixture({ kind, advanced: true,
      ownerFaction: kind === 'emperor-revival' ? 'fremen' : 'emperor', eliteTanks: 2 });
    const view = viewGame(f.game, f.actor);
    const offer = kind === 'emperor-revival' ? view.nexusEmperorSecretAlly!.revival : view.nexusFremenRevival!;
    assert.deepEqual(offer.eliteOptions, [0, 1]);
    rejected(f.game, f.actor, { ...f.paymentAction, elite: 2 });
    view.players.find(player => player.id === f.actor)!.bot = 'Hard';
    const bot = botActions(view).find(action => action.type === f.paymentAction.type);
    assert.ok(bot, 'The newly supported original profile must offer a real legal bot action');
    const paid = applyAction(f.game, f.actor, bot);
    const before = classicNexusSkillsPaymentsPlayer(f.game, f.actor);
    const actor = classicNexusSkillsPaymentsPlayer(paid, f.actor);
    assert.equal(actor.elites!.reserves, before.elites!.reserves + 1);
    assert.equal(actor.elites!.tanks, before.elites!.tanks - 1);
    assert.equal(actor.elites!.revived, 1);
    assert.equal(actor.reserves, before.reserves + 3); assert.equal(actor.tanks, before.tanks - 3);
    assert.deepEqual(wallets(paid), wallets(f.game));
    rejected(paid, f.actor, { type: 'revive', amount: 1, elite: 1 });
    sameSkillCustody(f.game, paid); classicNexusSkillsPaymentsInventory(paid);
  });
}

void test('actual undealt initialized setup retains original actor IDs and first offers without reinitializing or redealing', () => {
  const setup = initializeClassicNexusSkillsPaymentsSetup({ advanced: true, kind: 'emperor-revival',
    seatIds: ['authenticated-owner', 'authenticated-second', 'authenticated-third'] });
  const before = structuredClone(setup);
  const accepted = initializeClassicNexusSkillsPaymentsSetup({ initial: setup, kind: 'emperor-revival' });
  assert.deepEqual(accepted, before);
  const next = advanceClassicNexusSkillsPaymentsStep(accepted);
  assert.equal(next.leaderSkills!.assignments.length, 1);
  assert.equal(Object.keys(next.leaderSkills!.offers).length, Object.keys(setup.leaderSkills!.offers).length - 1);
  assert.deepEqual(next.players.map(player => player.hand), before.players.map(player => player.hand),
    'The actual already-dealt original starting hands are not replaced by skill selection');
  let selecting = accepted;
  while (selecting.setupStage === 'leaderSkills') {
    assert.ok(selecting.players.every(player => !player.traitors.length && !player.traitorChoices.length),
      'Every original skill choice precedes the original physical traitor deal');
    classicNexusSkillsPaymentsInventory(selecting);
    selecting = advanceClassicNexusSkillsPaymentsStep(selecting);
  }
  assert.equal(selecting.leaderSkills!.assignments.length, selecting.players.length);
  assert.equal(selecting.setupStage, 'traitors');
  const f = createClassicNexusSkillsPaymentsFixture({ initial: setup, kind: 'emperor-revival' });
  assert.deepEqual(setup, before, 'The supplied actual CLI/setup snapshot is an immutable source');
  assert.deepEqual(f.initial, before);
  assert.equal(f.actor, 'authenticated-owner');
  assert.deepEqual(f.game.players.map(player => player.id), before.players.map(player => player.id));
  assert.equal(f.afterSetup.leaderSkills!.assignments.length, 3);
  assert.equal(f.afterClosingDraw.nexusCards!.cards!.hands[f.actor], 'emperor');
  const paid = payClassicNexusSkillsPaymentsFixture(f);
  sameSkillCustody(f.game, paid); classicNexusSkillsPaymentsInventory(paid);
});
