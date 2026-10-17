import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, type Action, type Game } from '../game/engine';
import { normalRevivalAllowance } from '../game/revival';
import { advanceClassicIndependentNexus } from './fixture-classic-independent-nexus';
import { classicDiscoveryNexusClean } from './fixture-discovery-classic-nexus';
import { createIndependentNexusBankPurchase, createIndependentNexusRecruitsRevival, utilityAction, utilityPlayer } from './fixture-classic-independent-nexus-utility';

function rejected(game: Game, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, 'atreides', action));
  assert.deepEqual(game, before, 'A rejected consumer action cannot spend cards, counters or money');
}
const quiet = (game: Game) => advanceClassicIndependentNexus(game,
  state => state.phase === 4 && classicDiscoveryNexusClean(state));

void test('real Recruits and Tleilaxu draw: fixed paid five precedes remaining ordinary free returns', () => {
  const f = createIndependentNexusRecruitsRevival();
  const before = utilityPlayer(f.game);
  assert.equal(utilityPlayer(f.afterBattle).tanks, 8);
  assert.equal(before.leaders.find(disc => disc.id === f.leader)!.dead, true);
  let game = utilityAction(f.game, 'atreides', { type: 'card', card: 'ecaz-recruits' });
  const rate = normalRevivalAllowance(game, utilityPlayer(game));
  assert.equal(rate.freeRate, 4);
  assert.equal(rate.limit, 7);
  rejected(game, { ...f.action, amount: 6 });
  rejected(game, { ...f.action, leader: '' });
  game = quiet(utilityAction(game, 'atreides', f.action));
  const granted = utilityPlayer(game);
  assert.equal(granted.spice, before.spice - 5);
  assert.equal(granted.tanks, 3);
  assert.equal(granted.reserves, before.reserves + 5);
  assert.equal(granted.freeForcesRevived, 0, 'Paid card counters do not consume or refund the native free quota');
  assert.equal(granted.leaderRevived, true);
  assert.equal(granted.leaders.find(disc => disc.id === f.leader)!.dead, false);
  assert.equal(game.discard.filter(card => card.id === 'ecaz-recruits').length, 1);
  assert.equal(game.nexusCards!.cards!.discard.filter(face => face === 'tleilaxu').length, 1);
  rejected(game, { ...f.action, amount: 0 });
  game = quiet(utilityAction(game, 'atreides', { type: 'revive', amount: 2 }));
  assert.equal(utilityPlayer(game).revived, 7);
  assert.equal(utilityPlayer(game).freeForcesRevived, 2);
  assert.equal(utilityPlayer(game).spice, before.spice - 5);
  assert.equal(utilityPlayer(game).tanks, 1);
  rejected(game, { type: 'revive', amount: 1 });
  game = advanceClassicIndependentNexus(game, state => state.phase === 5 && classicDiscoveryNexusClean(state));
  assert.equal(game.turn, 2);
  assert.equal(utilityPlayer(game).spice, before.spice - 5);
  assert.equal(utilityPlayer(game).leaderRevived, true);
});

void test('earlier ordinary paid returns consume Recruits seven ceiling without a Secret Ally refund', () => {
  const f = createIndependentNexusRecruitsRevival();
  const before = utilityPlayer(f.game);
  let game = utilityAction(f.game, 'atreides', { type: 'card', card: 'ecaz-recruits' });
  game = quiet(utilityAction(game, 'atreides', { type: 'revive', amount: 5 }));
  assert.equal(utilityPlayer(game).spice, before.spice - 2);
  assert.equal(utilityPlayer(game).freeForcesRevived, 4);
  rejected(game, { ...f.action, amount: 3 });
  game = quiet(utilityAction(game, 'atreides', { ...f.action, amount: 2 }));
  assert.equal(utilityPlayer(game).spice, before.spice - 4);
  assert.equal(utilityPlayer(game).revived, 7);
  assert.equal(utilityPlayer(game).freeForcesRevived, 4);
  assert.equal(utilityPlayer(game).tanks, 1);
  assert.equal(utilityPlayer(game).leaderRevived, true);
  rejected(game, { type: 'revive', amount: 1 });
});

void test('real Emperor draw and selected independent bank lot retain Pay-or-Use and one-card continuation', () => {
  const f = createIndependentNexusBankPurchase();
  const before = utilityPlayer(f.game);
  const card = f.game.auction!.cards[f.game.auction!.index];
  assert.equal(card.id, 'ecaz-reinforcements');
  rejected(f.beforeBid, { type: 'bid', amount: utilityPlayer(f.beforeBid).spice + 1 });
  const paid = utilityAction(f.game, 'atreides', { type: 'decision', karama: false });
  assert.equal(utilityPlayer(paid).spice, before.spice - 2);
  assert.equal(paid.nexusCards!.cards!.hands.atreides, 'emperor');
  assert.equal(utilityPlayer(paid).hand.filter(held => held.id === card.id).length, 1);
  let used = utilityAction(f.game, 'atreides', f.action);
  assert.equal(utilityPlayer(used).spice, before.spice);
  assert.equal(utilityPlayer(used).hand.length, before.hand.length + 1);
  assert.deepEqual(utilityPlayer(used).hand.find(held => held.id === card.id), card);
  assert.equal(used.nexusCards!.cards!.hands.atreides, null);
  assert.equal(used.nexusCards!.cards!.discard.filter(face => face === 'emperor').length, 1);
  assert.equal(used.nexusEmperorPurchaseHistory![0].price, 2);
  assert.equal(used.nexusEmperorPurchaseHistory![0].card, card.id);
  assert.equal(used.nexusEmperorPurchaseHistory![0].beforeSpice, before.spice);
  assert.equal(used.nexusEmperorPurchaseHistory![0].afterSpice, before.spice);
  rejected(used, f.action);
  used = advanceClassicIndependentNexus(used, state => state.phase === 4 && classicDiscoveryNexusClean(state));
  assert.equal(used.turn, 2);
  assert.equal(used.auction, null);
  assert.equal(utilityPlayer(used).hand.filter(held => held.id === card.id).length, 1);
  assert.equal(utilityPlayer(used).spice, before.spice);
});
