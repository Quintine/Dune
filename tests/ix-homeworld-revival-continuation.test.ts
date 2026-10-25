import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer } from '../game/engine';
import { createHomeworldCustody } from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import { snapshotHomeworldRevival } from '../game/homeworld-benefits';
import { quoteRevivalResume } from '../game/revival-resume';
import { quoteRevivalCancellation, continuationCustody } from '../game/revival-cancellation';
import { newRevivalRules, forceRevivalQuote } from '../game/revival';
import { quoteIxSuboidBonus } from '../game/ix-homeworld-revival';
import { createTechTokens } from '../game/tech-tokens';
import {
  createIxHomeworldRevivalBonusFixture as fixture,
  actIxHomeworldRevivalBonus as act,
  advanceIxHomeworldRevivalBonus as advance,
  ixHomeworldRevivalBonusClean as clean,
  ixHomeworldRevivalBonusPlayer as player,
  ixHomeworldRevivalBonusInventory as inventory,
  reviveIxHomeworldRevivalBonus as revive,
} from './fixture-ix-homeworld-revival-bonus';

void test('a genuinely drafted Ghola leaves only one physical bonus Suboid after the selected base group', () => {
  const f = fixture({ ghola: true });
  let game = act(f.game, f.owner, { type: 'card', card: f.ghola!, amount: 2, elite: 0 });
  game = advance(game, clean);
  assert.equal(player(game).tanks, 3);
  const before = structuredClone(player(game));
  const returned = revive(game, f, { type: 'revive', amount: 2, elite: 1, freeElite: 0 }).game;
  assert.equal(player(returned).reserves - before.reserves, 3);
  assert.equal(before.spice - player(returned).spice, 3);
  assert.equal(player(returned).revived, 2);
  assert.equal(player(returned).tanks, 0);
  assert.match(returned.log.at(-1)!.text, /1 physical Suboid for free/);
  inventory(returned);
});

void test('controlled prior La La La permits the paid Cyborg without a new free bonus', () => {
  const f = fixture();
  // Isolate an already effective restriction, not a claim of earning CHOAM's card.
  f.game.revivalRules!.freeBlocked = [f.owner];
  const before = structuredClone(player(f.game));
  const result = revive(f.game, f, { type: 'revive', amount: 1, elite: 1, freeElite: 0 }).game;
  assert.equal(player(result).reserves - before.reserves, 1);
  assert.equal(player(result).tanks, 4);
  assert.equal(player(result).spice, before.spice - 3);
  assert.equal(player(result).freeForcesRevived, 0);
  inventory(result);
});

void test('controlled active Recruits quote changes the ordinary free rate without multiplying the physical bonus', () => {
  const f = fixture();
  // Quote-only composition test; no unplayed card is offered to applyAction.
  f.game.recruits = { turn: f.game.turn, player: f.owner, card: 'ecaz-recruits' };
  const before = structuredClone(f.game), owner = player(f.game);
  const quote = forceRevivalQuote(f.game, owner, 3, 1, 0);
  assert.equal(quote.free, 2);
  assert.equal(quote.cost, 3);
  assert.equal(quoteIxSuboidBonus({ enabled: true, amount: 3, elite: 1,
    free: quote.free, freeElite: 0, normalTanks: owner.tanks - owner.elites!.tanks }), 2);
  assert.deepEqual(f.game, before);
});

/** Controlled physical contexts for pure pending-quote tests. These do not
 * claim public setup, card play or saved-game recovery evidence. */
function pendingContext() {
  const game = createGame('IXBONUSPENDING', newPlayer('ix', 'Ixians', 'ixians'), false, ['ix']);
  joinGame(game, newPlayer('t', 'Tleilaxu', 'tleilaxu'));
  Object.assign(game, { status: 'playing', phase: 4, turn: 2, revivalRules: newRevivalRules() });
  const ix = game.players[0], tleilaxu = game.players[1];
  Object.assign(ix, { reserves: 9, tanks: 5, forces: { 'polar_sink:0': 6 },
    revived: 1, freeForcesRevived: 1, spice: 8,
    elites: { reserves: 3, tanks: 1, forces: { 'polar_sink:0': 3 }, revived: 0 } });
  Object.assign(tleilaxu, { reserves: 12, tanks: 0, forces: { 'polar_sink:0': 8 } });
  game.homeworlds = { custody: createHomeworldCustody(homeworldContext(game)) };
  game.homeworldRevival = snapshotHomeworldRevival(game);
  game.techTokens = createTechTokens(game.players);
  game.pendingRevival = { player: 'ix', kind: 'forces', amount: 1, elite: 1,
    free: 0, normalCost: 3, cost: 3, checks: [], ixSuboidBonus: 2 };
  return game;
}

const income = (quote: ReturnType<typeof quoteRevivalResume>) =>
  quote.nextResponse?.kind === 'revivalIncome' ? quote.nextResponse.amount : undefined;

void test('bonus-only free event shares existing Tleilaxu and Axlotl receipts without spending normal quota', () => {
  const game = pendingContext(), before = structuredClone(game);
  const quote = quoteRevivalResume(game, 'finish');
  assert.equal(quote.outcome, 'revive');
  assert.deepEqual(quote.nextResponse, { kind: 'revivalIncome', owner: 't', recipient: 'ix', amount: 4, passed: [] });
  assert.deepEqual(quote.freeIncome, { player: 'ix', turn: 2 });
  assert.equal(quote.techIncome?.spice, 1);
  assert.deepEqual(game, before);
  game.revivalFreeIncome = { ix: game.turn };
  game.techTokens!.axlotl.triggeredTurn = game.turn;
  const repeated = quoteRevivalResume(game, 'finish');
  assert.equal(income(repeated), 3);
  assert.equal(repeated.techIncome, undefined);
  game.homeworldRevival!.tleilaxu.low = true;
  game.revivalFreeIncome = {};
  assert.equal(income(quoteRevivalResume(game, 'finish')), 3);
});

void test('discount cancellation retains the physical grant only on a funded original return', () => {
  const game = pendingContext();
  game.pendingRevival!.cost = 2;
  const discounted = quoteRevivalResume(game, 'finish');
  assert.equal(discounted.pending.ixSuboidBonus, 2);
  assert.equal(income(discounted), 3);
  const full = quoteRevivalCancellation(game, { kind: 'revivalDiscount', owner: 't', recipient: 'ix' });
  assert.equal(full.outcome, 'revive');
  assert.equal(full.pending?.cost, 3);
  assert.equal(full.pending?.ixSuboidBonus, 2);
  game.players[0].spice = 2;
  assert.equal(quoteRevivalCancellation(game,
    { kind: 'revivalDiscount', owner: 't', recipient: 'ix' }).outcome, 'unfunded');
  game.pendingRevival!.cost = 3;
  const unfunded = quoteRevivalResume(game, 'finish');
  assert.equal(unfunded.outcome, 'unfunded');
  assert.equal(unfunded.techIncome, undefined);
  assert.equal(unfunded.nextResponse, undefined);
});

void test('malformed frozen bonus rejects before physical accounting and old pending requests gain no retrofit', () => {
  const game = pendingContext();
  game.pendingRevival!.ixSuboidBonus = 1;
  const before = structuredClone(game);
  assert.throws(() => continuationCustody(game, game.players[0], game.pendingRevival!), /pending Ix bonus/);
  assert.deepEqual(game, before);
  delete game.pendingRevival!.ixSuboidBonus;
  const old = quoteRevivalResume(game, 'finish');
  assert.equal(old.pending.ixSuboidBonus, undefined);
  assert.equal(old.techIncome, undefined);
  assert.equal(income(old), 3);
});
