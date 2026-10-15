import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import {
  advanceNexusEmperorBank, createNexusEmperorBankFixture, nexusEmperorBankInventory,
  nexusEmperorBankPlayer, nextNexusEmperorBankStep, stepNexusEmperorBank,
  type NexusEmperorBankFixture, type NexusEmperorBankOptions,
} from './fixture-nexus-emperor-bank';

function rejectsUnchanged(game: Game, actor: string, action: Action): void {
  const original = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, original, 'Reject before any wallet, card or native lot mutation');
}
/** Consume actual original sale/bonus and the next original inspection, not a new auction frame. */
function finishOriginalLot(f: NexusEmperorBankFixture, game: Game): Game {
  const index = f.game.auction!.index;
  for (let n = 0; n < 100; n++) {
    if (game.auction && game.auction.index === index + 1 &&
      !game.currentAuctionSale && !game.response && !game.phaseOpening && !game.decision) {
      assert.deepEqual(viewGame(game, 'atreides').auction!.card, game.auction.cards[game.auction.index]);
      assert.equal(nexusEmperorBankPlayer(game, f.owner).hand.length,
        nexusEmperorBankPlayer(f.game, f.owner).hand.length + 1 +
          Number(nexusEmperorBankPlayer(game, f.owner).faction === 'harkonnen'));
      assert.equal(nexusEmperorBankPlayer(game, f.owner).hand.filter(c => c.id === f.card.id).length, 1);
      return game;
    }
    assert.notEqual(game.response?.kind, 'emperorIncome', 'No bank-funded replacement income');
    assert.notEqual(game.decision?.kind, 'auctionPayment', 'The acquired lot cannot ask for payment twice');
    game = stepNexusEmperorBank(game, nextNexusEmperorBankStep(game));
  }
  throw Error('Original BANK lot did not reach its native next lot');
}

const natives = ['ixians', 'tleilaxu', 'richese', 'choam', 'ecaz', 'moritani'] as const;
const scenarios: NexusEmperorBankOptions[] = [
  { advanced: false }, { advanced: true },
  ...natives.flatMap(profile => [false, true].map(advanced => ({ profile, advanced }))),
  { advanced: true, homeworlds: true, tech: true },
  ...(['ixians', 'richese', 'ecaz'] as const).map(profile =>
    ({ profile, advanced: true, homeworlds: true, tech: true })),
];

for (const scenario of scenarios) for (const use of [false, true]) void test(
  `${scenario.advanced ? 'Advanced' : 'Basic'} ${scenario.profile ?? 'classic'} original BANK${scenario.homeworlds ? ' Homeworld/Tech' : ''}: ${use ? 'Use retains the positive bid' : 'Pay debits the original bid'}`, () => {
    const f = createNexusEmperorBankFixture(scenario), original = structuredClone(f.game);
    const player = nexusEmperorBankPlayer(f.game, f.owner), offer = viewGame(f.game, f.owner).nexusEmperorSecretAlly;
    assert.ok(offer?.purchase && !offer.purchase.blocked);
    assert.ok(f.price > 0 && player.spice >= f.price);
    assert.equal(player.ally, null);
    assert.ok(!f.game.players.some(p => p.faction === 'emperor'));
    assert.deepEqual(viewGame(f.game, 'atreides').auction!.card, f.card);
    const expectedBonus = player.faction === 'harkonnen' ? structuredClone(f.game.deck[0]) : null;
    const action: Action = use ? { type: 'nexusEmperorPurchase', event: offer.event }
      : { type: 'decision', karama: false };
    let game = stepNexusEmperorBank(f.game, { actor: f.owner, action });
    assert.deepEqual(f.game, original);
    assert.deepEqual(nexusEmperorBankPlayer(game, f.owner).hand.find(c => c.id === f.card.id), f.card);
    assert.equal(game.nexusCards!.cards!.hands[f.owner], use ? null : 'emperor');
    assert.equal(game.nexusCards!.cards!.discard.filter(c => c === 'emperor').length, use ? 1 : 0);
    game = finishOriginalLot(f, game);
    for (const p of game.players)
      assert.equal(p.spice, f.wallets[p.id] - (p.id === f.owner && !use ? f.price : 0),
        'Only ordinary Pay debits the buyer; no other seat receives bank money');
    if (expectedBonus) assert.deepEqual(nexusEmperorBankPlayer(game, f.owner).hand.find(c => c.id === expectedBonus.id), expectedBonus);
    assert.deepEqual(game.techTokens, original.techTokens);
    assert.deepEqual(game.homeworlds, original.homeworlds);
    if (scenario.profile === 'richese') {
      assert.ok(f.game.richeseRemoved!.length > 0, 'The original unbid cache lot was resolved before the bank pool');
      assert.equal(f.game.richeseBidding!.stage, 'normal');
      assert.deepEqual(game.richeseCache, original.richeseCache);
      assert.deepEqual(game.richeseRemoved, original.richeseRemoved);
    }
    nexusEmperorBankInventory(game);
    if (use) rejectsUnchanged(game, f.owner, action);
  },
);

for (const profile of natives) void test(`${profile}: a real irrelevant closing face still pauses at the same public payment boundary`, () => {
  const held = createNexusEmperorBankFixture({ profile });
  const irrelevant = createNexusEmperorBankFixture({ profile, nexusCard: 'guild' });
  assert.deepEqual(irrelevant.game.decision, held.game.decision);
  assert.equal(viewGame(irrelevant.game, irrelevant.owner).nexusEmperorSecretAlly, null);
  rejectsUnchanged(irrelevant.game, irrelevant.owner, { type: 'nexusEmperorPurchase', event: irrelevant.event });
  const game = finishOriginalLot(irrelevant, stepNexusEmperorBank(irrelevant.game,
    { actor: irrelevant.owner, action: { type: 'decision', karama: false } }));
  assert.equal(nexusEmperorBankPlayer(game, irrelevant.owner).spice, irrelevant.wallets[irrelevant.owner] - irrelevant.price);
  assert.equal(game.nexusCards!.cards!.hands[irrelevant.owner], 'guild');
  nexusEmperorBankInventory(game);
});

void test('native BANK purchase rejects foreign, stale and extra-cost inputs before changing original custody', () => {
  const f = createNexusEmperorBankFixture({ profile: 'ixians', advanced: true });
  for (const p of f.game.players.filter(p => p.id !== f.owner))
    rejectsUnchanged(f.game, p.id, { type: 'nexusEmperorPurchase', event: f.event });
  for (const action of [
    { type: 'nexusEmperorPurchase', event: 'stale' },
    { type: 'nexusEmperorPurchase', event: f.event, price: 0 },
    { type: 'nexusEmperorPurchase', event: f.event, allyPayment: 1 },
    { type: 'nexusEmperorPurchase', event: f.event, card: f.card.id },
    { type: 'nexusEmperorPurchase', event: f.event, use: true },
  ]) rejectsUnchanged(f.game, f.owner, action);
  const wallet = nexusEmperorBankPlayer(f.chronology.beforeBid, f.owner).spice;
  rejectsUnchanged(f.chronology.beforeBid, f.owner, { type: 'bid', amount: wallet + 1, allyPayment: 0 });
  nexusEmperorBankInventory(f.game);
});

void test('a genuinely setup-dealt Truthtrance takes priority over the original native bank purchase', () => {
  const f = createNexusEmperorBankFixture({ profile: 'tleilaxu', advanced: true });
  const truth = nexusEmperorBankPlayer(f.game, 'atreides').hand.find(c => c.effect === 'truthtrance');
  assert.ok(truth, 'Truthtrance must come from the original setup deal');
  let game = stepNexusEmperorBank(f.game, { actor: 'atreides', action: { type: 'card', card: truth.id } });
  assert.equal(game.truthtrance!.stage, 'priority');
  rejectsUnchanged(game, f.owner, { type: 'nexusEmperorPurchase', event: f.event });
  while (game.truthtrance?.stage === 'priority') {
    const actor = game.players.find(p => !game.truthtrance!.passed.includes(p.id))!.id;
    game = stepNexusEmperorBank(game, { actor, action: { type: 'truthPass' } });
  }
  const name = nexusEmperorBankPlayer(game, f.owner).hand[0].name;
  game = stepNexusEmperorBank(game, { actor: 'atreides', action: { type: 'truthAsk',
    question: { kind: 'fact', target: f.owner, fact: { kind: 'hand', name } } } });
  assert.equal(viewGame(game, f.owner).truthAnswer, 'yes');
  game = stepNexusEmperorBank(game, { actor: f.owner, action: { type: 'truthAnswer', answer: 'yes' } });
  const offer = viewGame(game, f.owner).nexusEmperorSecretAlly;
  assert.ok(offer?.purchase && !offer.purchase.blocked);
  game = finishOriginalLot(f, stepNexusEmperorBank(game, { actor: f.owner,
    action: { type: 'nexusEmperorPurchase', event: offer.event } }));
  assert.equal(nexusEmperorBankPlayer(game, f.owner).spice, f.wallets[f.owner]);
  assert.equal(game.discard.filter(c => c.id === truth.id).length, 1);
  nexusEmperorBankInventory(game);
});

void test('minimal Easy policy legally completes the actual native bank boundary for both private faces', () => {
  for (const nexusCard of ['emperor', 'guild'] as const) {
    const f = createNexusEmperorBankFixture({ profile: 'choam', advanced: true, nexusCard });
    const view = viewGame(f.game, f.owner);
    view.players.find(p => p.id === f.owner)!.bot = 'Easy';
    const action = botActions(view)[0]; assert.ok(action);
    const game = finishOriginalLot(f, stepNexusEmperorBank(f.game, { actor: f.owner, action }));
    assert.equal(nexusEmperorBankPlayer(game, f.owner).spice, f.wallets[f.owner] - (nexusCard === 'emperor' ? 0 : f.price));
    assert.equal(game.nexusCards!.cards!.hands[f.owner], nexusCard === 'emperor' ? null : 'guild');
    nexusEmperorBankInventory(game);
  }
});

void test('native bank evidence stays historical after a real later purchase changes wallet and hand', () => {
  const f = createNexusEmperorBankFixture({ profile: 'richese', advanced: true, homeworlds: true, tech: true });
  let game = finishOriginalLot(f, stepNexusEmperorBank(f.game,
    { actor: f.owner, action: { type: 'nexusEmperorPurchase', event: f.event } }));
  while (game.auction!.active !== f.owner)
    game = stepNexusEmperorBank(game, { actor: game.auction!.active, action: { type: 'passBid' } });
  const card = structuredClone(game.auction!.cards[game.auction!.index]);
  game = stepNexusEmperorBank(game, { actor: f.owner, action: { type: 'bid', amount: 1, allyPayment: 0 } });
  game = advanceNexusEmperorBank(game, g => g.decision?.kind === 'auctionPayment');
  game = stepNexusEmperorBank(game, { actor: f.owner, action: { type: 'decision', karama: false } });
  assert.equal(nexusEmperorBankPlayer(game, f.owner).spice, f.wallets[f.owner] - 1);
  assert.deepEqual(nexusEmperorBankPlayer(game, f.owner).hand.find(c => c.id === card.id), card);
  nexusEmperorBankInventory(game);
});
