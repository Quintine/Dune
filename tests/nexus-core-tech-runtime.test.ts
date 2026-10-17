import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyAction, type Action, type Game } from '../game/engine';
import { TECH_TOKENS, ownedTech } from '../game/tech-tokens';
import { forceRevivalQuote, normalRevivalAllowance } from '../game/revival';
import { reactionAction, reactionPlayer } from './fixture-classic-independent-nexus-reactions';
import { advanceClassicIndependentNexus } from './fixture-classic-independent-nexus';
import { classicDiscoveryNexusClean } from './fixture-discovery-classic-nexus';
import { createNexusCoreTechHarass, createNexusCoreTechRevival,
  createNexusCoreTechShipment, finishNexusCoreTechPhase } from './fixture-nexus-core-tech';

const wallets = (game: Game) => Object.fromEntries(game.players.map(player => [player.id, player.spice]));
function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'A rejected consumer action cannot move cards, counters, wallets or tokens');
}
const quietPhaseFour = (game: Game) => advanceClassicIndependentNexus(game,
  state => state.phase === 4 && classicDiscoveryNexusClean(state));
function firstStormCustody(game: Game) {
  assert.ok(game.techTokens);
  for (const token of TECH_TOKENS) {
    const owner = game.techTokens[token.id].owner;
    assert.ok(owner, `The original first Storm must have assigned ${token.name}`);
    assert.equal(game.techTokens[token.id].spice, 0, 'No token income exists before its phase');
  }
}

void test('Basic independent36 Tech keeps first-Storm custody and pays the funded delivery Heighliners once', () => {
  const f = createNexusCoreTechShipment();
  firstStormCustody(f.game);
  assert.equal(f.game.turn, 2);
  assert.equal(f.game.pendingGuildBetrayal!.invoice.price, 1);
  const owner = f.token.owner, pending = f.token.count;
  const before = reactionPlayer(f.beforeShipment, 'atreides');
  const game = reactionAction(f.game, 'emperor', { type: 'guildBetrayalUse',
    event: f.game.pendingGuildBetrayal!.invoice.event });
  // The delivered five counters, not the fee itself, are the real shipment.
  assert.equal(reactionPlayer(game, 'atreides').forces[f.key], 5);
  assert.equal(reactionPlayer(game, 'atreides').reserves, before.reserves - 5);
  assert.equal(reactionPlayer(game, 'atreides').spice, before.spice - 1);
  assert.equal(reactionPlayer(game, 'emperor').spice, reactionPlayer(f.beforeShipment, 'emperor').spice + 1);
  assert.equal(game.techTokens!.heighliners.owner, owner);
  assert.equal(game.techTokens!.heighliners.spice, pending, 'Delivery accrues the owner-count income as pending spice');
  assert.equal(game.techTokens!.heighliners.triggeredTurn, game.turn);
  const closed = finishNexusCoreTechPhase(game);
  assert.equal(closed.after.techTokens!.heighliners.spice, 0, 'Phase end pays the pending pile exactly once');
  assert.equal(closed.after.techTokens!.heighliners.triggeredTurn, game.turn);
  const beforeClose = wallets(closed.before), afterClose = wallets(closed.after);
  assert.equal(afterClose[owner], beforeClose[owner] + pending);
  for (const [id, spice] of Object.entries(beforeClose))
    if (id !== owner) assert.equal(afterClose[id], spice, 'No other seat collects another token owner\'s pile');
});

void test('Advanced all14 Tech fixed Tleilaxu group pays real bank spice and only a free return accrues Axlotl', () => {
  const f = createNexusCoreTechRevival();
  firstStormCustody(f.game);
  const owner = f.token.owner, pending = f.token.count;
  const start = reactionPlayer(f.game, 'atreides');
  assert.equal(start.tanks, 8, 'Actual battle losses supply the physical Tanks');
  assert.equal(start.leaders.find(disc => disc.id === f.leader)!.dead, true);
  let game = reactionAction(f.game, 'atreides', { type: 'card', card: 'ecaz-recruits' });
  const rate = normalRevivalAllowance(game, reactionPlayer(game, 'atreides'));
  assert.equal(rate.freeRate, 4);
  assert.equal(rate.limit, 7);
  rejected(game, 'atreides', { ...f.action, elite: 1 });
  rejected(game, 'atreides', { ...f.action, leader: '' });
  rejected(game, 'atreides', { ...f.action, amount: 6 });
  game = quietPhaseFour(reactionAction(game, 'atreides', f.action));
  const fixed = reactionPlayer(game, 'atreides');
  assert.equal(fixed.spice, start.spice - 5, 'Five exact counters cost one bank spice each');
  assert.equal(fixed.tanks, 3);
  assert.equal(fixed.reserves, start.reserves + 5);
  assert.equal(fixed.revived, 5);
  assert.equal(fixed.freeForcesRevived, 0, 'The paid card group never consumes the free quota');
  assert.equal(fixed.leaderRevived, true);
  assert.equal(fixed.leaders.find(disc => disc.id === f.leader)!.dead, false);
  assert.equal(game.nexusCards!.cards!.hands.atreides, null);
  assert.equal(game.discard.filter(card => card.id === 'ecaz-recruits').length, 1);
  assert.equal(game.techTokens!.axlotl.owner, owner);
  assert.equal(game.techTokens!.axlotl.spice, 0, 'A paid fixed group is not a free revival and accrues nothing');
  assert.equal(game.techTokens!.axlotl.triggeredTurn, undefined);
  game = quietPhaseFour(reactionAction(game, 'atreides', { type: 'revive', amount: 1 }));
  const freeSeat = reactionPlayer(game, 'atreides');
  assert.equal(freeSeat.spice, fixed.spice, 'The ordinary free return itself costs nothing');
  assert.equal(freeSeat.freeForcesRevived, 1);
  assert.equal(freeSeat.tanks, 2);
  assert.equal(game.techTokens!.axlotl.spice, pending, 'One genuine free return accrues the owner-count pile');
  assert.equal(game.techTokens!.axlotl.triggeredTurn, game.turn);
  game = quietPhaseFour(reactionAction(game, 'atreides', { type: 'revive', amount: 1 }));
  assert.equal(reactionPlayer(game, 'atreides').spice, fixed.spice);
  assert.equal(reactionPlayer(game, 'atreides').reserves, start.reserves + 7);
  assert.equal(reactionPlayer(game, 'atreides').tanks, 1);
  assert.equal(game.techTokens!.axlotl.spice, pending,
    'A second genuine free return in this Revival does not mint another pile');
  const closed = finishNexusCoreTechPhase(game);
  assert.equal(closed.after.techTokens!.axlotl.spice, 0, 'Revival phase end pays the Axlotl pile once');
  const beforeClose = wallets(closed.before), afterClose = wallets(closed.after);
  assert.equal(afterClose[owner], beforeClose[owner] + pending);
});

void test('pending Axlotl spice cannot fund an unaffordable further paid revival', () => {
  const f = createNexusCoreTechRevival({ drain: true });
  const owner = f.token.owner, pending = f.token.count;
  let game = reactionAction(f.game, 'atreides', { type: 'card', card: 'ecaz-recruits' });
  const rate = normalRevivalAllowance(game, reactionPlayer(game, 'atreides'));
  assert.ok(reactionPlayer(game, 'atreides').spice < 6,
    'The genuine turn-one shipment leaves a thin wallet for this boundary');
  game = quietPhaseFour(reactionAction(game, 'atreides', { type: 'revive', amount: rate.freeRate }));
  const seat = reactionPlayer(game, 'atreides');
  assert.equal(game.techTokens!.axlotl.spice, pending, 'The owner\'s own free return created the pending pile');
  const quote = forceRevivalQuote(game, seat, 3);
  assert.ok(quote.cost > seat.spice && quote.cost - seat.spice <= pending,
    'Choose the smallest legal overage the pending pile would cover if it were spendable');
  rejected(game, 'atreides', { type: 'revive', amount: 3 });
  assert.equal(game.techTokens!.axlotl.spice, pending, 'The refusal cannot mint or clear token income');
  game = quietPhaseFour(reactionAction(game, 'atreides', { type: 'revive', amount: 2 }));
  const paid = reactionPlayer(game, 'atreides');
  assert.equal(paid.spice, seat.spice - 4, 'Two genuinely affordable paid counters cost their printed four bank spice');
  assert.equal(paid.tanks, 2);
  assert.equal(game.techTokens!.axlotl.spice, pending, 'Axlotl accrues once per turn, not once per return');
  const closed = finishNexusCoreTechPhase(game);
  assert.equal(closed.after.techTokens!.axlotl.spice, 0);
  assert.equal(wallets(closed.after)[owner], wallets(closed.before)[owner] + pending);
});

void test('Basic independent36 Harass return and native winner transfer mint no token income', () => {
  const f = createNexusCoreTechHarass();
  const before = f.beforeCall;
  const game = reactionAction(f.game, 'atreides', { type: 'nexusHarkonnenBetrayalUse',
    event: f.game.pendingNexusHarkonnenBetrayal!.source.event });
  const lost = ownedTech(before.techTokens, 'atreides');
  assert.ok(lost.length, 'The defeated seat genuinely held tokens');
  const moved = TECH_TOKENS.filter(token =>
    before.techTokens![token.id].owner !== game.techTokens![token.id].owner);
  assert.equal(moved.length, 1, 'The battle winner takes exactly one token from the loser');
  const token = moved[0];
  assert.equal(before.techTokens![token.id].owner, 'atreides');
  assert.equal(game.techTokens![token.id].owner, 'harkonnen');
  assert.ok(lost.includes(token.id), 'The native choice belongs to the loser\'s actual holdings');
  assert.equal(game.pendingTech ?? null, null);
  for (const rule of TECH_TOKENS) {
    assert.equal(game.techTokens![rule.id].spice, 0, `${rule.name} mints no income from a traitor battle`);
  }
  assert.equal(game.techTokens!.heighliners.triggeredTurn, game.turn,
    'The earlier genuine shipment accrual was already paid at its own phase end');
  assert.equal(reactionPlayer(game, 'atreides').reserves,
    reactionPlayer(f.beforeShipment, 'atreides').reserves, 'The Harass return is not a Revival grant');
  assert.equal(reactionPlayer(game, 'atreides').tanks, 0);
  assert.equal(reactionPlayer(game, 'atreides').leaders.find(disc => disc.id === f.identity)?.dead, false);
});
