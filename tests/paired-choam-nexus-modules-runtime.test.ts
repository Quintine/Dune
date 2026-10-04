import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { gameDistance, splitLocation, TERRITORIES, territory } from '../game/board';
import { presenceAt } from '../game/force-presence';
import { ownedTech } from '../game/tech-tokens';
import { quotePhaseResources } from '../game/phase-resource-quote';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { quoteStrongholdFactionsBattle } from './fixture-stronghold-factions';
import { orderNexusSpice } from './fixture-nexus-cards';
import {
  advancePairedChoam, allowPairedChoam, createPairedChoamNexusModulesFixture,
  holdPairedChoamCard, initializePairedChoamModules, pairedChoamClean,
  pairedChoamPlayer as player, pairedRicheseCunningRequest, placePairedChoam,
  revealPairedRichese, type PairedChoamNexusModulesFixture,
} from './fixture-paired-choam-nexus-modules';

function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'An illegal native choice cannot consume original money, tokens, cards or counters');
}
function physicalCards(game: Game): string[] {
  return [...game.deck, ...game.discard, ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...(game.ixSetupCards ?? []), ...(game.ixAuction?.cards ?? []),
    ...(game.auction?.cards.slice(game.auction.index) ?? []), ...game.players.flatMap(p => p.hand)].map(c => c.id).sort();
}
function conserved(game: Game, original: Game): void {
  assert.deepEqual(physicalCards(game), physicalCards(original), 'Original E2 deck and native cache have one physical custody location per card');
  for (const p of game.players) {
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0), 20, p.faction);
    assert.deepEqual(p.noField?.tokens, player(original, p.id).noField?.tokens, 'Physical marker identities and printed values never change');
  }
}
function assertPair(f: PairedChoamNexusModulesFixture, after: Game, faceup: number): void {
  const before = player(f.game, f.richese), p = player(after, f.richese);
  const request = pairedRicheseCunningRequest(f);
  assert.equal(p.spice, before.spice - 1, 'The original one-marker Stronghold tariff is paid, not the eight-force tariff');
  assert.equal(player(after, f.guild).spice, player(f.game, f.guild).spice + 1, 'The actual native Guild receives the one-spice invoice');
  assert.equal(p.reserves, before.reserves - faceup);
  assert.equal(p.forces[f.location] ?? 0, faceup);
  assert.equal(p.noField!.deployed!.tokenId, request.noField);
  assert.equal(p.noField!.lastShipped, request.noField);
  assert.equal(presenceAt(p, 'habbanya_ridge_sietch'), faceup + 1);
  assert.equal(after.nexusCards!.cards!.hands[f.richese], null);
  assert.equal(after.nexusRicheseCunningLast!.stage, 'shipped');
  conserved(after, f.afterSetup);
}

for (const modules of [
  { advanced: false, tech: true, strongholds: false },
  { advanced: true, tech: true, strongholds: false },
  { advanced: true, tech: false, strongholds: true },
  { advanced: true, tech: true, strongholds: true },
]) void test(`paired E2 ${modules.advanced ? 'Advanced' : 'Basic'} Tech=${modules.tech} SH=${modules.strongholds}: real two-token shipment, one tariff and once-only phase-end Heighliners`, () => {
  const f = createPairedChoamNexusModulesFixture(modules), request = pairedRicheseCunningRequest(f);
  assert.equal(player(f.firstShipment.after, f.richese).spice, player(f.firstShipment.before, f.richese).spice - 1);
  assert.equal(player(f.firstShipment.after, f.richese).reserves, player(f.firstShipment.before, f.richese).reserves);
  const previous = player(f.game, f.richese).noField!.tokens.find(t => t.value === 0)!;
  assert.equal(player(f.game, f.richese).noField!.lastShipped, previous.id, 'Genuine first-turn shipment, not a staged last-used stamp');
  reject(f.game, f.richese, { ...request, noField: previous.id });
  reject(f.game, f.richese, { ...request, revealedToken: previous.id });
  reject(f.game, f.richese, { ...request, revealedToken: request.noField });
  const declared = applyAction(f.game, f.richese, request);
  const shipped = allowPairedChoam(declared);
  assertPair(f, shipped, 5);
  if (modules.strongholds) {
    assert.equal(f.afterFirstMentat.strongholdCards!.owners.habbanya_ridge_sietch, f.richese);
    assert.equal(shipped.strongholdCards!.owners.habbanya_ridge_sietch, f.richese, 'The card is retained even after controlled board relocation');
    assert.equal(f.afterFirstMentat.strongholdCards!.owners.arrakeen, f.choam);
  }
  if (modules.tech) {
    const token = shipped.techTokens!.heighliners;
    assert.ok(token.owner);
    const amount = ownedTech(f.game.techTokens, token.owner).length;
    assert.equal(token.triggeredTurn, shipped.turn);
    assert.equal(token.spice, amount);
    assert.equal(player(shipped, token.owner).spice, player(f.game, token.owner).spice + (token.owner === f.richese ? -1 : token.owner === f.guild ? 1 : 0), 'Industry accrues without immediate wallet credit');
    reject(shipped, f.richese, { type: 'ship', amount: 1, territory: 'arrakeen', sector: territory('arrakeen').sectors[0] });
    let another = shipped;
    if (shipped.movementRemaining?.includes(f.choam)) {
      const atChoam = advancePairedChoam(shipped, g => g.phase === 5 && g.active === f.choam && pairedChoamClean(g));
      another = allowPairedChoam(applyAction(atChoam, f.choam, { type: 'ship', amount: 1, territory: 'arrakeen', sector: territory('arrakeen').sectors[0] }));
      assert.equal(player(another, f.choam).spice, player(atChoam, f.choam).spice - 1);
      assert.equal(player(another, f.guild).spice, player(atChoam, f.guild).spice + 1);
    }
    assert.equal(another.techTokens!.heighliners.spice, amount, 'Neither a second paid shipment nor a rejected repeated shipment accrues industry again');
    const credit = quotePhaseResources(another).credits.find(c => c.kind === 'tech' && c.token === 'heighliners');
    assert.ok(credit);
    assert.equal(credit.player, token.owner);
    assert.equal(credit.amount, amount);
    const collection = quoteSpiceCollection(another).receipts.find(r => r.player === token.owner);
    const ended = advancePairedChoam(another, g => g.phase >= 6 && pairedChoamClean(g));
    assert.equal(player(ended, token.owner).spice, credit.balance +
      (ended.phase === 7 ? (collection?.collected ?? 0) + (collection?.strongholds ?? 0) : 0));
    assert.equal(ended.techTokens!.heighliners.spice, 0);
    assert.equal(ended.techTokens!.heighliners.triggeredTurn, ended.turn);
    assertPair(f, shipped, 5);
    conserved(ended, f.afterSetup);
  }
});

void test('paired E2 materializes only available physical reserves, and voluntary revelation retains previous-marker restriction on the next native shipment', () => {
  const f = createPairedChoamNexusModulesFixture({ advanced: false, strongholds: false, reserveCap: 2 });
  const shipped = allowPairedChoam(applyAction(f.game, f.richese, pairedRicheseCunningRequest(f)));
  assertPair(f, shipped, 2);
  const revealed = revealPairedRichese(shipped, f.richese);
  assert.equal(player(revealed, f.richese).noField!.deployed, null);
  assert.equal(player(revealed, f.richese).forces[f.location], 2, 'Concealed three cannot manufacture counters when reserves are empty');
  assert.equal(player(revealed, f.richese).reserves, 0);
  const previous = player(revealed, f.richese).noField!.lastShipped!;
  let next = advancePairedChoam(revealed, g => g.turn === 3 && g.phase === 1 && pairedChoamClean(g));
  // Deck ordering remains physical; prevent a fresh worm from changing this native lifecycle program.
  orderNexusSpice(next, ['land', 'land']);
  next = advancePairedChoam(next, g => g.turn === 3 && g.phase === 5 && g.active === f.richese && pairedChoamClean(g));
  reject(next, f.richese, { type: 'ship', noField: previous, event: player(next, f.richese).noFieldEvent, territory: 'polar_sink', sector: 0 });
  const zero = player(next, f.richese).noField!.tokens.find(t => t.value === 0)!;
  const accepted = allowPairedChoam(applyAction(next, f.richese, { type: 'ship', noField: zero.id, event: player(next, f.richese).noFieldEvent, territory: 'polar_sink', sector: 0 }));
  assert.equal(player(accepted, f.richese).noField!.lastShipped, zero.id);
  assert.equal(player(accepted, f.richese).noField!.deployed!.tokenId, zero.id);
  assert.equal(player(accepted, f.richese).spice, player(next, f.richese).spice - 2, 'Polar Sink uses the actual ordinary one-marker non-Stronghold price');
  conserved(accepted, f.afterSetup);
});

void test('paired E2 Karama-stopped pair spends Nexus but neither invoice, counters, markers nor Heighliners accrual', () => {
  const f = createPairedChoamNexusModulesFixture();
  const karama = holdPairedChoamCard(f.game, f.guild, c => c.kind === 'special' && c.effect === 'karama');
  const before = structuredClone(f.game), request = pairedRicheseCunningRequest(f);
  const pending = applyAction(f.game, f.richese, request);
  assert.equal(pending.response?.kind, 'richeseNoField');
  assert.equal(pending.pendingShipment?.cost, 1);
  assert.equal(pending.pendingShipment?.amount, 1);
  assert.equal(pending.nexusCards!.cards!.hands[f.richese], null);
  const stopped = allowPairedChoam(applyAction(pending, f.guild, { type: 'card', mode: 'cancel', card: karama.id }));
  assert.equal(stopped.nexusRicheseCunningLast!.stage, 'stopped');
  for (const p of before.players) assert.equal(player(stopped, p.id).spice, p.spice, 'No paid leg exists for the stopped shipment');
  assert.deepEqual(player(stopped, f.richese).forces, player(before, f.richese).forces);
  assert.equal(player(stopped, f.richese).reserves, player(before, f.richese).reserves);
  assert.deepEqual(player(stopped, f.richese).noField, player(before, f.richese).noField);
  assert.deepEqual(stopped.techTokens, before.techTokens);
  assert.equal(player(stopped, f.richese).shipped, false);
  reject(stopped, f.richese, request);
  const ordinary = allowPairedChoam(applyAction(stopped, f.richese, { type: 'ship', amount: 1, territory: 'habbanya_ridge_sietch', sector: territory('habbanya_ridge_sietch').sectors[0] }));
  assert.equal(player(ordinary, f.richese).spice, player(stopped, f.richese).spice - 1);
  assert.equal(player(ordinary, f.guild).spice, player(stopped, f.guild).spice + 1);
  assert.equal(ordinary.techTokens!.heighliners.triggeredTurn, ordinary.turn);
  conserved(ordinary, f.afterSetup);
});

void test('paired CHOAM own Cunning consumes one original physical fuel card through the real printed Kulon response and enables its extra territory', () => {
  const f = createPairedChoamNexusModulesFixture();
  let game = advancePairedChoam(f.movementStart, g => g.phase === 5 && g.active === f.choam && pairedChoamClean(g));
  const card = holdPairedChoamCard(game, f.choam, c => c.kind === 'projectile');
  holdPairedChoamCard(game, f.guild, c => c.kind === 'special' && c.effect === 'karama');
  const offer = viewGame(game, f.choam).choamWorthless!.plays.find(p => p.source === 'nexus' && p.card.id === card.id && p.effect === 'kulon');
  assert.ok(offer && offer.source === 'nexus' && !offer.blocked);
  const request: Action = { type: 'card', mode: 'choam', card: card.id, effect: 'kulon', nexus: offer.event };
  const before = structuredClone(game);
  game = applyAction(game, f.choam, request);
  assert.equal(game.response?.kind, 'choamWorthless');
  assert.equal(game.nexusCards!.cards!.hands[f.choam], null);
  assert.ok(player(game, f.choam).hand.some(c => c.id === card.id), 'Fuel remains physical until the original response resolves');
  game = allowPairedChoam(game);
  assert.equal(game.nexusChoamLast!.stage, 'complete');
  assert.equal(game.discard.filter(c => c.id === card.id).length, 1);
  assert.equal(game.choamMovement!.bonus, 1);
  assert.equal(viewGame(game, f.choam).choamMovementBonus, 1);
  for (const p of before.players) assert.equal(player(game, p.id).spice, p.spice);
  reject(game, f.choam, request);
  const keys = TERRITORIES.flatMap(t => t.sectors.map(s => `${t.id}:${s}`));
  let destination: string | undefined;
  const source = keys.find(from => {
    const origin = splitLocation(from);
    if (origin.sector === game.storm || territory(origin.territory).type === 'stronghold' || origin.territory === 'polar_sink') return false;
    destination = keys.find(to => splitLocation(to).sector !== game.storm &&
      gameDistance(game, from, to, k => splitLocation(k).sector === game.storm) === 2);
    return !!destination;
  });
  assert.ok(source && destination, 'An actual clear two-territory route is available for Kulon');
  placePairedChoam(game, f.choam, source, 1);
  const move: Action = { type: 'move', from: source, amount: 1, ...splitLocation(destination) };
  placePairedChoam(before, f.choam, source, 1);
  reject(before, f.choam, move);
  const moved = allowPairedChoam(applyAction(game, f.choam, move));
  assert.equal(player(moved, f.choam).forces[destination], 1);
  assert.equal(player(moved, f.choam).forces[source] ?? 0, 0);
  assert.equal(player(moved, f.choam).moved, 1);
  conserved(moved, f.afterSetup);
  conserved(game, f.afterSetup);
});

void test('paired Advanced Habbanya retained effect wins an ordinary tied battle after native voluntary marker reveal, without entering mixed No-Field plans', () => {
  const f = createPairedChoamNexusModulesFixture();
  let game = allowPairedChoam(applyAction(f.game, f.richese, pairedRicheseCunningRequest(f)));
  game = revealPairedRichese(game, f.richese);
  assert.equal(player(game, f.richese).noField!.deployed, null);
  assert.equal(player(game, f.richese).forces[f.location], 8);
  placePairedChoam(game, f.guild, f.location, 6);
  game = advancePairedChoam(game, g => g.phase === 6 && pairedChoamClean(g));
  assert.ok(game.active === f.richese || game.active === f.guild);
  game = applyAction(game, game.active!, { type: 'chooseBattle', territory: 'habbanya_ridge_sietch', target: game.active === f.richese ? f.guild : f.richese });
  game = advancePairedChoam(game, g => pairedChoamClean(g) && !!g.battle && (!g.battle.preLeader || g.battle.preLeader.closed) && !g.battle.preparation);
  const richeseLeader = player(game, f.richese).leaders.filter(l => !l.dead).sort((a, b) => b.strength - a.strength)[0];
  const guildLeader = player(game, f.guild).leaders.filter(l => !l.dead).sort((a, b) => b.strength - a.strength)[0];
  assert.ok(richeseLeader && guildLeader);
  const richeseDial = Math.max(0, guildLeader.strength - richeseLeader.strength) + 1;
  const guildDial = Math.max(0, richeseLeader.strength - guildLeader.strength) + 1;
  assert.ok(richeseDial <= 8 && guildDial <= 6);
  for (const [actor, leader, dial] of [[f.richese, richeseLeader.id, richeseDial], [f.guild, guildLeader.id, guildDial]] as const) {
    game = applyAction(game, actor, { type: 'battlePlan', leader, dial, support: dial, weapon: null, defense: null });
    game = allowPairedChoam(game);
  }
  assert.ok(game.battle?.revealed);
  const revealed = structuredClone(game), quote = quoteStrongholdFactionsBattle(game);
  assert.equal(richeseDial + richeseLeader.strength, guildDial + guildLeader.strength);
  assert.equal(viewGame(revealed, f.richese).battle!.strongholdEffects[f.richese], 'habbanya_ridge_sietch', 'Tie benefit is attributed to the actual retained card holder and committed plan');
  assert.equal(quote.winner, f.richese);
  const payment = quote.payments.find(p => p.player === f.richese)!;
  assert.equal(payment.ownPayment, richeseDial);
  assert.equal(payment.bankSupport, 0, 'Habbanya grants tie priority, not Arrakeen support');
  game = advancePairedChoam(game, g => !g.battle && !g.response && !g.decision && !g.pendingTreacheryDiscard);
  assert.equal(game.lastBattleContext!.winner, f.richese);
  assert.equal(player(game, f.richese).tanks, richeseDial);
  assert.equal(player(game, f.richese).forces[f.location], 8 - richeseDial);
  assert.equal(player(game, f.guild).tanks, 6);
  assert.equal(game.strongholdCards!.owners.habbanya_ridge_sietch, f.richese);
  const collection = quoteSpiceCollection(game).receipts;
  for (const p of revealed.players) {
    const paid = quote.payments.find(r => r.player === p.id)?.ownPayment ?? 0;
    const choam = quote.choamIncome?.owner === p.id ? quote.choamIncome.amount : 0;
    const city = collection.find(r => r.player === p.id);
    assert.equal(player(game, p.id).spice, p.spice - paid + choam + (city?.strongholds ?? 0) + (city?.collected ?? 0), 'Plan support and native CHOAM bank legs are separate from city Collection');
  }
  for (const token of ownedTech(revealed.techTokens, f.guild)) assert.equal(game.techTokens![token].owner, f.richese);
  conserved(game, f.afterSetup);
});

void test('paired original undealt CLI setup preserves authenticated actors and first deal while continuing real closing Nexus participation', () => {
  const lobby = createGame('CHOAMCLIAUDIT', newPlayer('auth-richese', 'R', 'richese'), true, ['choam']);
  joinGame(lobby, newPlayer('auth-choam', 'C', 'choam'));
  joinGame(lobby, newPlayer('auth-guild', 'G', 'guild'));
  joinGame(lobby, newPlayer('auth-atreides', 'A', 'atreides'));
  const setup = initializePairedChoamModules({ initial: lobby });
  const original = structuredClone(setup);
  const f = createPairedChoamNexusModulesFixture({ initial: setup });
  assert.deepEqual(setup, original);
  assert.deepEqual(f.initial, setup, 'Supplied undealt initializer is not restarted or redealt');
  assert.equal(f.richese, 'auth-richese');
  assert.equal(f.choam, 'auth-choam');
  assert.equal(f.guild, 'auth-guild');
  assert.equal(f.observer, 'auth-atreides');
  const live = viewGame(f.game, f.richese);
  live.players.find(p => p.id === f.richese)!.bot = 'Hard';
  const request = botActions(live)[0];
  assert.ok(request?.type === 'ship' && request.noField && request.revealedToken);
  const completed = allowPairedChoam(applyAction(f.game, f.richese, request));
  assert.equal(completed.nexusRicheseCunningLast!.stage, 'shipped');
  assert.equal(completed.nexusCards!.cards!.hands[f.richese], null);
  conserved(completed, f.afterSetup);
});

void test('paired Basic Tech ordinary battle uses revealed physical pools and no Advanced support payment or CHOAM bank-support income', () => {
  const f = createPairedChoamNexusModulesFixture({ advanced: false, strongholds: false });
  let game = allowPairedChoam(applyAction(f.game, f.richese, pairedRicheseCunningRequest(f)));
  game = revealPairedRichese(game, f.richese);
  placePairedChoam(game, f.guild, f.location, 6);
  game = advancePairedChoam(game, g => g.phase === 6 && pairedChoamClean(g));
  assert.ok(game.active === f.richese || game.active === f.guild);
  game = applyAction(game, game.active!, { type: 'chooseBattle', territory: 'habbanya_ridge_sietch', target: game.active === f.richese ? f.guild : f.richese });
  game = advancePairedChoam(game, g => pairedChoamClean(g) && !!g.battle && (!g.battle.preLeader || g.battle.preLeader.closed) && !g.battle.preparation);
  const winner = player(game, f.richese).leaders.filter(l => !l.dead).sort((a, b) => b.strength - a.strength)[0];
  const loser = player(game, f.guild).leaders.filter(l => !l.dead).sort((a, b) => a.strength - b.strength)[0];
  assert.ok(winner && loser);
  assert.ok(winner.strength + 3 > loser.strength);
  for (const [actor, leader, dial] of [[f.richese, winner.id, 3], [f.guild, loser.id, 0]] as const) {
    game = applyAction(game, actor, { type: 'battlePlan', leader, dial, support: 0, weapon: null, defense: null });
    game = allowPairedChoam(game);
  }
  assert.ok(game.battle?.revealed);
  const revealed = structuredClone(game), quote = quoteStrongholdFactionsBattle(game);
  assert.equal(quote.winner, f.richese);
  assert.equal(quote.choamIncome, null);
  for (const payment of quote.payments) {
    assert.equal(payment.ownPayment, 0);
    assert.equal(payment.bankSupport, 0);
    assert.equal(payment.cost, 0, 'Basic dials never become Advanced support invoices');
  }
  game = advancePairedChoam(game, g => !g.battle && !g.response && !g.decision && !g.pendingTreacheryDiscard);
  assert.equal(player(game, f.richese).tanks, 3);
  assert.equal(player(game, f.richese).forces[f.location], 5);
  assert.equal(player(game, f.guild).tanks, 6);
  for (const p of revealed.players) assert.equal(player(game, p.id).spice, p.spice);
  for (const token of ownedTech(revealed.techTokens, f.guild)) assert.equal(game.techTokens![token].owner, f.richese);
  conserved(game, f.afterSetup);
});
