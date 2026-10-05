import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction, createGame, joinGame, newPlayer,
  viewGame, type Action, type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { MOBILE_LOCATION, validGameLocation } from '../game/board';
import { treacheryDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { validateRicheseNoField } from '../game/richese-no-field';
import { DISCOVERY_SPICE_CARDS, validateDiscoveryState } from '../game/discoveries';
import { validateNexusCards } from '../game/nexus-cards';
import { nexusFaceDancersAction } from '../game/nexus-tleilaxu-options';
import { ownedTech } from '../game/tech-tokens';
import { traitorDeck } from '../game/traitors';
import { quoteStrongholdFactionsBattle } from './fixture-stronghold-factions';
import {
  advancePairedDiscoveryNexus, applyPairedDiscoveryNexusStep, closePairedDiscoveryNexus,
  createPairedDiscoveryNexusFixture, holdPairedDiscoveryNexusCard,
  initializePairedDiscoveryNexusForFixture, nextPairedDiscoveryNexusStep,
  pairedDiscoveryNexusClean, pairedDiscoveryNexusPlayer as player, placePairedDiscoveryNexus,
  pairedDiscoveryRicheseRequest, preparePairedDiscoveryNexusBattle,
  reservePairedDiscoveryNexusBoard, revealPairedDiscoveryNexusBattle, settlePairedDiscoveryNexusShipment,
  type PairedDiscoveryNexusFixture,
} from './fixture-discovery-paired-nexus';

function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'Rejected native choices leave original cards, wallets, subtype counters and receipts unchanged.');
}
function custody(game: Game): void {
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.ixSetupCards ?? []), ...(game.ixAuction?.cards ?? []),
    ...(game.auction?.cards.slice(game.auction.index) ?? []),
    ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? [])];
  const expected = [...treacheryDeck(game.expansions), ...(game.expansions[0] === 'choam' ? richeseCards() : [])];
  assert.deepEqual(cards.map(c => c.id).sort(), expected.map(c => c.id).sort());
  assert.equal(new Set(cards.map(c => c.id)).size, cards.length);
  const identities = [...(game.traitorReserve ?? []), ...game.players.flatMap(p => [
    ...p.traitors, ...p.traitorChoices, ...(p.faceDancers ?? []).map(c => c.leader),
  ])];
  assert.deepEqual(identities.sort(), traitorDeck(game.players, game.expansions[0] === 'ix').sort());
  assert.equal(new Set(identities).size, identities.length);
  for (const p of game.players) {
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((sum, n) => sum + n, 0), 20, p.faction);
    if (p.elites) {
      assert.equal(p.elites.reserves + p.elites.tanks + Object.values(p.elites.forces).reduce((sum, n) => sum + n, 0),
        p.faction === 'ixians' ? 7 : p.faction === 'fremen' ? 3 : 5);
      assert.ok(p.elites.reserves <= p.reserves && p.elites.tanks <= p.tanks);
      for (const [key, count] of Object.entries(p.elites.forces)) assert.ok(count >= 0 && count <= (p.forces[key] ?? 0));
    }
    if (p.noField) validateRicheseNoField(p.noField);
  }
  validateDiscoveryState(game.discoveries!);
  validateNexusCards(game.nexusCards!.cards!, game.players);
  assert.ok(!game.leaderSkills && !game.homeworlds);
}
function richeseWindow(f: PairedDiscoveryNexusFixture, state: Game): Game {
  return advancePairedDiscoveryNexus(state, g => g.phase === 5 && g.active === f.owner && pairedDiscoveryNexusClean(g));
}
function richeseReveal(game: Game, owner: string): Game {
  const p = player(game, owner); assert.ok(p.noField!.deployed);
  return applyAction(game, owner, { type: 'revealNoField', token: p.noField!.deployed.tokenId, event: p.noFieldEvent });
}

for (const family of ['ix', 'choam'] as const) for (const mode of [
  { advanced: false, tech: false, strongholds: false },
  { advanced: false, tech: true, strongholds: false },
  { advanced: true, tech: false, strongholds: false },
  { advanced: true, tech: true, strongholds: false },
  { advanced: true, tech: false, strongholds: true },
  { advanced: true, tech: true, strongholds: true },
]) void test(`paired ${family} ${JSON.stringify(mode)}: actual printed reveal, END Mentat, typed entry/Maker ride and alliance-qualified closing native deals`, () => {
  const f = createPairedDiscoveryNexusFixture({ family, ...mode });
  assert.deepEqual(f.setup.spiceDeck.flatMap(c => 'territory' in c && c.discovery ? [c.discovery] : []).sort(),
    DISCOVERY_SPICE_CARDS.map(c => c.discovery).sort());
  assert.equal(f.setup.spiceDeck.filter(c => 'worm' in c && c.greatMaker).length, 1);
  assert.equal(f.setup.spiceDeck.filter(c => 'sandtrout' in c && c.sandtrout).length, family === 'ix' ? 1 : 0);
  assert.equal(f.setup.discoveries!.tokens.length, 8);
  assert.equal(f.afterSetup.players.reduce((sum, p) => sum + p.hand.length, 0) + f.afterSetup.deck.length,
    family === 'ix' ? 47 : 35);
  assert.equal(f.game.decision?.kind, 'discoveryEntry'); assert.equal(f.game.phase, 0); assert.equal(f.game.turn, 2);
  assert.ok(f.actions.some(s => s.action.type === 'ship') && f.actions.some(s => s.action.type === 'discovery'));
  assert.ok(Object.values(f.game.nexusCards!.cards!.hands).every(c => c === null), 'END Mentat/free entry do not manufacture a Nexus hand.');
  if (mode.strongholds) assert.equal(f.firstMentat.after.strongholdCards!.owners[f.claim], f.owner);
  const c = closePairedDiscoveryNexus(f), old = player(c.entry.before, f.collector), entered = player(c.entry.after, f.collector);
  const total = family === 'ix' ? 2 : 1, elite = family === 'ix' ? 1 : 0;
  assert.equal(entered.forces['shrine:0'], total);
  assert.equal(entered.elites?.forces['shrine:0'] ?? 0, elite);
  assert.equal(entered.forces[f.source], 3 - total);
  assert.equal(entered.reserves, old.reserves); assert.equal(entered.spice, old.spice);
  assert.equal(entered.moved, old.moved); assert.equal(entered.shipped, old.shipped);
  assert.equal(player(c.vote, f.native).forces['hagga_basin:12'] ?? 0, 0);
  assert.equal(player(c.vote, f.native).tanks, player(f.game, f.native).tanks + 2, 'Actual Great Maker ordinary worm losses precede its vote.');
  assert.ok(Object.values(c.vote.nexusCards!.cards!.hands).every(c => c === null));
  const rider = player(c.ride.before, f.fremen), arrived = player(c.ride.after, f.fremen);
  assert.equal(arrived.forces['polar_sink:0'], 2);
  assert.equal(arrived.elites?.forces['polar_sink:0'] ?? 0, mode.advanced ? 1 : 0);
  assert.equal(arrived.reserves, rider.reserves - 2);
  assert.equal(arrived.elites?.reserves ?? 0, (rider.elites?.reserves ?? 0) - (mode.advanced ? 1 : 0));
  assert.equal(arrived.spice, rider.spice); assert.equal(arrived.shipped, rider.shipped); assert.equal(arrived.moved, rider.moved);
  assert.notEqual(c.ride.after.nexusCards!.phase?.stage, 'drawing', 'Maker reserve ride is not the closing phase draw.');
  assert.equal(c.drawing.greatMaker!.stage, 'complete');
  assert.ok(!c.drawing.spiceWindow && !c.drawing.spiceResolution);
  assert.equal(player(c.drawing, f.guild).ally, f.fremen); assert.equal(player(c.drawing, f.fremen).ally, f.guild);
  assert.deepEqual([...c.drawing.nexusCards!.phase!.eligible].sort(), [f.owner, f.native].sort());
  if (mode.advanced) assert.ok(c.drawing.spiceDiscard[1].some(card => 'territory' in card && card.territory === 'rock_outcroppings'),
    'The actual second Advanced pile closes before any physical Nexus draw.');
  const faces = family === 'ix' ? ['ixians', 'tleilaxu'] : ['richese', 'choam'];
  assert.equal(c.afterDraw.nexusCards!.cards!.hands[f.owner], faces[0]);
  assert.equal(c.afterDraw.nexusCards!.cards!.hands[f.native], faces[1]);
  assert.equal(c.afterDraw.nexusCards!.cards!.hands[f.guild], null); assert.equal(c.afterDraw.nexusCards!.cards!.hands[f.fremen], null);
  if (mode.strongholds) assert.deepEqual(c.afterDraw.strongholdCards, f.firstMentat.after.strongholdCards);
  for (const game of [f.afterSetup, f.game, c.entry.after, c.vote, c.ride.after, c.drawing, c.afterDraw]) custody(game);
});

void test('paired native Great Maker vote and both Spice piles without a settled alliance deal no Nexus cards', () => {
  const f = createPairedDiscoveryNexusFixture({ family: 'ix' }), c = closePairedDiscoveryNexus(f);
  const game = advancePairedDiscoveryNexus(c.ride.after, g => g.phase === 2 && pairedDiscoveryNexusClean(g));
  assert.ok(game.players.every(p => p.ally === null));
  assert.ok(Object.values(game.nexusCards!.cards!.hands).every(card => card === null));
  assert.equal(game.nexusCards!.cards!.deck.length, c.ride.after.nexusCards!.cards!.deck.length);
  assert.notEqual(game.nexusCards!.phase?.stage, 'drawing');
  custody(game);
});

void test('paired E2 immediate and concealed groups are capped by the original reserve pool without a second tariff', () => {
  const f = createPairedDiscoveryNexusFixture({ family: 'choam', advanced: false, tech: true, strongholds: false });
  const c = closePairedDiscoveryNexus(f), window = richeseWindow(f, c.afterDraw);
  const count = player(window, f.owner).reserves - 2;
  placePairedDiscoveryNexus(window, f.owner, 'polar_sink:0', count);
  f.staging.push(`Conserved ${count} original Richese reserves → Polar Sink; exactly two physical reserves remain before declaration.`);
  const request = pairedDiscoveryRicheseRequest(f, window), before = player(window, f.owner);
  const shipped = settlePairedDiscoveryNexusShipment(applyAction(window, f.owner, request));
  assert.equal(player(shipped, f.owner).forces['shrine:0'], 2); assert.equal(player(shipped, f.owner).reserves, 0);
  const materialized = richeseReveal(shipped, f.owner);
  assert.equal(player(materialized, f.owner).forces['shrine:0'], 2);
  assert.equal(player(materialized, f.owner).reserves, 0);
  assert.equal(player(materialized, f.owner).spice, before.spice - 1);
  assert.equal(player(materialized, f.guild).spice, player(window, f.guild).spice + 1);
  assert.equal(player(materialized, f.owner).noField!.lastShipped, request.noField);
  assert.equal(materialized.nexusCards!.cards!.discard.filter(card => card === 'richese').length, 1);
  custody(materialized);
});

for (const advanced of [false, true]) void test(`paired E1 ${advanced ? 'Advanced' : 'Basic'}: original Cunning typed casualties, original Tech before nested Face Dance and draw-before-retire Tleilaxu Cunning`, () => {
  const f = createPairedDiscoveryNexusFixture({ family: 'ix', advanced, tech: true, strongholds: advanced });
  const closing = closePairedDiscoveryNexus(f), b = preparePairedDiscoveryNexusBattle(f, closing.afterDraw);
  const offer = viewGame(b.game, f.owner).nexusSuboids!.offer!; assert.ok(offer && !offer.blocked);
  const action: Action = { type: 'nexusSuboids', event: offer.event };
  reject(b.game, f.native, action);
  const used = applyAction(b.game, f.owner, action);
  assert.equal(used.nexusCards!.cards!.hands[f.owner], null);
  assert.equal(used.nexusCards!.cards!.discard.filter(c => c === 'ixians').length, 1);
  assert.deepEqual(player(used, f.owner).forces, player(b.game, f.owner).forces);
  assert.deepEqual(player(used, f.owner).elites, player(b.game, f.owner).elites);
  reject(used, f.owner, action);
  const revealed = revealPairedDiscoveryNexusBattle(b, used), quote = quoteStrongholdFactionsBattle(revealed);
  assert.equal(quote.winner, f.owner);
  assert.equal(quote.casualties!.forces.normalFixedHalf, false);
  assert.equal(quote.casualties!.forces.normalFreeSupport, true);
  assert.equal(viewGame(revealed, f.owner).battle!.strongholdEffects[f.owner], null, 'Retained Arrakeen does not subsidize a different nested stronghold-price site.');
  if (advanced) assert.equal(quote.payments.find(p => p.player === f.owner)!.bankSupport, 0);
  let losses = advancePairedDiscoveryNexus(revealed, g => g.decision?.kind === 'battleLosses' || g.decision?.kind === 'faceDance');
  if (losses.decision?.kind === 'battleLosses') {
    const choice = losses.decision.options.findIndex(o => o.normal === 2 && o.elite === 0); assert.ok(choice >= 0);
    losses = applyAction(losses, f.owner, { type: 'decision', choice });
  }
  const pending = advancePairedDiscoveryNexus(losses, g => g.decision?.kind === 'faceDance');
  assert.equal(pending.lastBattleContext!.winner, f.owner);
  assert.equal(player(pending, f.owner).forces['shrine:0'], 4);
  assert.equal(player(pending, f.owner).elites!.forces['shrine:0'], 3);
  assert.equal(player(pending, f.owner).tanks, player(revealed, f.owner).tanks + 2);
  assert.equal(player(pending, f.owner).elites!.tanks, player(revealed, f.owner).elites!.tanks);
  assert.equal(player(pending, f.native).tanks, player(revealed, f.native).tanks + 6);
  assert.ok(player(pending, f.owner).hand.some(c => c.id === b.weapon) && player(pending, f.owner).hand.some(c => c.id === b.defense));
  const defeatedTech = ownedTech(revealed.techTokens, f.native); assert.equal(defeatedTech.length, 1);
  assert.equal(pending.techTokens![defeatedTech[0]].owner, f.owner, 'Original winner already owns the actual loser Tech before replacement.');
  const winner = player(pending, f.owner), dancer = player(pending, f.native), stock = structuredClone(dancer.faceDancers!);
  const dance: Action = { type: 'decision', reveal: true, sector: 0, sources: { reserves: 2, [f.source]: 2 } };
  reject(pending, f.native, { ...dance, sector: 1 }); reject(pending, f.native, { ...dance, sources: { [MOBILE_LOCATION]: 4 } });
  reject(pending, f.native, { ...dance, sources: { reserves: 5 } });
  const after = applyAction(pending, f.native, dance), returned = player(after, f.owner), replaced = player(after, f.native);
  assert.equal(returned.forces['shrine:0'] ?? 0, 0); assert.equal(returned.elites!.forces['shrine:0'] ?? 0, 0);
  assert.equal(returned.reserves, winner.reserves + 4); assert.equal(returned.elites!.reserves, winner.elites!.reserves + 3);
  assert.equal(returned.tanks, winner.tanks); assert.equal(returned.spice, winner.spice); assert.deepEqual(returned.hand, winner.hand);
  assert.equal(returned.leaders.find(l => l.id === b.leader)!.dead, true);
  assert.equal(replaced.forces['shrine:0'], 4); assert.equal(replaced.forces[f.source], 1); assert.equal(replaced.reserves, dancer.reserves - 2);
  assert.deepEqual(after.techTokens, pending.techTokens); assert.deepEqual(after.strongholdCards, pending.strongholdCards);
  const revealedIdentity = replaced.faceDancers!.find(c => c.revealed)!; assert.ok(revealedIdentity);
  const untouched = stock.filter(c => c.leader !== revealedIdentity.leader), reserve = [...after.traitorReserve!];
  const view = viewGame(after, f.native), replacement = nexusFaceDancersAction(view, view.nexusTleilaxu!.cunning!.event); assert.ok(replacement);
  reject(after, f.native, { ...replacement, leaders: [revealedIdentity.leader] });
  const renewed = applyAction(after, f.native, replacement), nextStock = player(renewed, f.native).faceDancers!;
  assert.deepEqual(nextStock.filter(c => untouched.some(old => old.leader === c.leader)), untouched);
  assert.deepEqual(nextStock.filter(c => !untouched.some(old => old.leader === c.leader)), [{ leader: reserve[0], revealed: false }]);
  assert.deepEqual([...renewed.traitorReserve!].sort(), [...reserve.slice(1), revealedIdentity.leader].sort());
  assert.equal(player(renewed, f.native).faceDancerReplacedTurn, replaced.faceDancerReplacedTurn);
  assert.equal(renewed.nexusCards!.cards!.discard.filter(c => c === 'tleilaxu').length, 1);
  reject(renewed, f.native, replacement); custody(renewed);
  reservePairedDiscoveryNexusBoard(renewed, ['shrine:0', f.source, MOBILE_LOCATION]);
  f.staging.push('After genuine Face Dance/replacement: conserve only the unrelated second-conflict groups back to their original reserves; original native Mentat closes the turn and expires Cunning.');
  const nextTurn = advancePairedDiscoveryNexus(renewed, g => g.turn > renewed.turn);
  assert.equal(viewGame(nextTurn, f.owner).nexusSuboids!.active, false);
  assert.equal(nextTurn.nexusCards!.cards!.discard.filter(card => card === 'ixians').length, 1);
  if (advanced) assert.equal(nextTurn.strongholdCards!.owners.arrakeen, null, 'Only the actual next END Mentat updates the held card to the conserved current board.');
  custody(nextTurn);
});

for (const advanced of [false, true]) void test(`paired E2 ${advanced ? 'Advanced' : 'Basic'}: signed nested pair charges one physical tariff, native reveal and CHOAM support invoice`, () => {
  const f = createPairedDiscoveryNexusFixture({ family: 'choam', advanced, tech: true, strongholds: advanced });
  const closing = closePairedDiscoveryNexus(f), window = richeseWindow(f, closing.afterDraw), request = pairedDiscoveryRicheseRequest(f, window);
  const before = player(window, f.owner), guild = player(window, f.guild);
  assert.equal(validGameLocation(window, 'shrine', 0), true); assert.equal(validGameLocation(window, 'cistern', 0), false);
  reject(window, f.owner, { ...request, territory: 'cistern' }); reject(window, f.owner, { ...request, territory: 'invented-nested' });
  reject(window, f.owner, { ...request, sector: 1 }); reject(window, f.owner, { ...request, revealedToken: request.noField });
  holdPairedDiscoveryNexusCard(window, f.guild, c => c.effect === 'karama', f.staging);
  const declared = applyAction(window, f.owner, request);
  assert.equal(declared.response?.kind, 'richeseNoField'); assert.equal(declared.pendingShipment!.cost, 1);
  assert.equal(declared.pendingShipment!.amount, 1); assert.equal(declared.nexusCards!.cards!.hands[f.owner], null);
  assert.equal(player(declared, f.owner).spice, before.spice); assert.equal(player(declared, f.owner).reserves, before.reserves);
  for (const target of ['cistern', 'invented-nested']) {
    const corrupt = structuredClone(declared); corrupt.pendingShipment!.territory = target;
    const next = nextPairedDiscoveryNexusStep(corrupt); assert.ok(next);
    reject(corrupt, next.actor, next.action);
  }
  const shipped = settlePairedDiscoveryNexusShipment(declared), owner = player(shipped, f.owner);
  assert.equal(owner.spice, before.spice - 1); assert.equal(player(shipped, f.guild).spice, guild.spice + 1);
  assert.equal(owner.reserves, before.reserves - 5); assert.equal(owner.forces['shrine:0'], 5);
  assert.equal(owner.noField!.deployed!.tokenId, request.noField); assert.equal(owner.noField!.lastShipped, request.noField);
  assert.deepEqual(owner.noField!.tokens, before.noField!.tokens);
  assert.equal(shipped.nexusRicheseCunningLast!.stage, 'shipped'); assert.equal(shipped.nexusCards!.cards!.discard.filter(c => c === 'richese').length, 1);
  const publicView = viewGame(shipped, f.guild); assert.equal(publicView.richeseNoField!.private, null);
  for (const token of owner.noField!.tokens) assert.equal(JSON.stringify(publicView).includes(token.id), false);
  reject(shipped, f.owner, request);
  for (const target of ['cistern', 'invented-nested']) {
    const corrupt = structuredClone(shipped); corrupt.players.find(p => p.id === f.owner)!.noField!.deployed!.location = { territory: target, sector: 0 };
    reject(corrupt, f.owner, { type: 'revealNoField', token: String(request.noField), event: owner.noFieldEvent });
  }
  const revealedMarker = richeseReveal(shipped, f.owner), materialized = player(revealedMarker, f.owner);
  assert.equal(materialized.forces['shrine:0'], 8); assert.equal(materialized.reserves, before.reserves - 8);
  assert.equal(materialized.spice, before.spice - 1); assert.equal(materialized.noField!.deployed, null);
  assert.equal(materialized.noField!.lastShipped, request.noField); custody(revealedMarker);
  const b = preparePairedDiscoveryNexusBattle(f, revealedMarker), revealed = revealPairedDiscoveryNexusBattle(b);
  const quote = quoteStrongholdFactionsBattle(revealed); assert.equal(quote.winner, f.owner);
  assert.equal(viewGame(revealed, f.owner).battle!.strongholdEffects[f.owner], null, 'Held Carthag is not inherited inside Shrine.');
  if (advanced) {
    const invoice = quote.payments.find(p => p.player === f.owner)!;
    assert.equal(invoice.ownPayment, 3); assert.equal(invoice.bankSupport, 0);
    assert.deepEqual(quote.choamIncome, { owner: f.native, amount: 1 });
  } else { assert.deepEqual(quote.payments, []); assert.equal(quote.choamIncome, null); }
  const done = advancePairedDiscoveryNexus(revealed, g => !g.battle && pairedDiscoveryNexusClean(g));
  assert.equal(done.phase, 6, 'Second physical conflict keeps unrelated Collection out of this invoice.');
  assert.equal(done.lastBattleContext!.winner, f.owner); assert.equal(player(done, f.owner).forces['shrine:0'], 5);
  assert.equal(player(done, f.owner).tanks, player(revealed, f.owner).tanks + 3);
  assert.equal(player(done, f.guild).tanks, player(revealed, f.guild).tanks + 6);
  assert.equal(player(done, f.native).spice, player(revealed, f.native).spice + (advanced ? 1 : 0));
  const bounty = player(revealed, f.guild).leaders.find(l => l.id === b.enemy)!.strength;
  assert.equal(player(done, f.owner).spice, player(revealed, f.owner).spice - (advanced ? 3 : 0) + bounty);
  assert.deepEqual(done.strongholdCards, revealed.strongholdCards); custody(done);
});

void test('paired E2 CHOAM own Cunning uses original physical fuel and native response after the closing deal', () => {
  const f = createPairedDiscoveryNexusFixture({ family: 'choam' }), closing = closePairedDiscoveryNexus(f);
  let game = advancePairedDiscoveryNexus(closing.afterDraw, g => g.phase === 5 && g.active === f.native && pairedDiscoveryNexusClean(g));
  const fuel = holdPairedDiscoveryNexusCard(game, f.native, c => c.kind === 'projectile', f.staging);
  holdPairedDiscoveryNexusCard(game, f.guild, c => c.effect === 'karama', f.staging);
  const offer = viewGame(game, f.native).choamWorthless!.plays.find(p => p.source === 'nexus' && p.card.id === fuel.id && p.effect === 'kulon');
  assert.ok(offer && offer.source === 'nexus' && !offer.blocked);
  const request: Action = { type: 'card', mode: 'choam', card: fuel.id, effect: 'kulon', nexus: offer.event };
  const before = structuredClone(game); game = applyAction(game, f.native, request);
  assert.equal(game.response?.kind, 'choamWorthless'); assert.equal(game.nexusCards!.cards!.hands[f.native], null);
  assert.ok(player(game, f.native).hand.some(c => c.id === fuel.id));
  game = settlePairedDiscoveryNexusShipment(game);
  assert.equal(game.choamMovement!.bonus, 1); assert.equal(game.nexusChoamLast!.stage, 'complete');
  assert.equal(game.discard.filter(c => c.id === fuel.id).length, 1);
  assert.equal(game.nexusCards!.cards!.discard.filter(c => c === 'choam').length, 1);
  for (const p of before.players) { assert.equal(player(game, p.id).spice, p.spice); assert.deepEqual(player(game, p.id).forces, p.forces); }
  reject(game, f.native, request); custody(game);
});

void test('all four minimal policies consume actual paired entry/vote/typed ride/closing draw and native Face Dance outcomes', () => {
  const f = createPairedDiscoveryNexusFixture({ family: 'ix' }), c = closePairedDiscoveryNexus(f);
  const b = preparePairedDiscoveryNexusBattle(f, c.afterDraw), revealed = revealPairedDiscoveryNexusBattle(b);
  const dance = advancePairedDiscoveryNexus(revealed, g => g.decision?.kind === 'faceDance');
  for (const difficulty of DIFFICULTIES) for (const current of [
    { game: f.game, actor: f.collector, type: 'decision' },
    { game: c.vote, actor: c.vote.decision!.player, type: 'decision' },
    { game: c.ride.before, actor: f.fremen, type: 'decision' },
    { game: c.drawing, actor: f.owner, type: 'nexusCardChoice' },
    { game: dance, actor: f.native, type: 'decision' },
  ]) {
    const view = viewGame(current.game, current.actor); view.players.find(p => p.id === current.actor)!.bot = difficulty;
    const action = botActions(view).find(a => a.type === current.type); assert.ok(action);
    const after = applyPairedDiscoveryNexusStep(structuredClone(current.game), { actor: current.actor, action });
    if (current.game.decision?.kind === 'discoveryEntry') {
      assert.equal(after.discoveryEntry, undefined);
      assert.equal(player(after, current.actor).spice, player(current.game, current.actor).spice);
      assert.equal(player(after, current.actor).reserves, player(current.game, current.actor).reserves);
    } else if (current.game.decision?.kind === 'greatMakerVote')
      assert.equal(after.greatMaker!.votes.length, current.game.greatMaker!.votes.length + 1);
    else if (current.game.decision?.kind === 'greatMakerRide') {
      assert.equal(after.greatMaker!.stage, 'complete');
      assert.equal(player(after, f.fremen).spice, player(current.game, f.fremen).spice);
      assert.equal(player(after, f.fremen).shipped, player(current.game, f.fremen).shipped);
    } else if (current.game.decision?.kind === 'faceDance') {
      assert.notEqual(after.decision?.kind, 'faceDance');
      assert.deepEqual(after.techTokens, current.game.techTokens);
      if (action.reveal) {
        assert.equal(player(after, f.owner).forces['shrine:0'] ?? 0, 0);
        assert.equal(player(after, f.owner).leaders.find(l => l.id === b.leader)!.dead, true);
        assert.ok((player(after, f.native).forces['shrine:0'] ?? 0) > 0);
      } else assert.deepEqual(player(after, f.owner).forces, player(current.game, f.owner).forces);
    } else {
      assert.ok(after.nexusCards!.phase!.done.includes(current.actor));
      assert.ok(after.nexusCards!.cards!.hands[current.actor]);
      assert.equal(after.nexusCards!.cards!.deck.length, current.game.nexusCards!.cards!.deck.length - 1);
    }
    custody(after);
  }
});

void test('all four minimal policies settle the original signed E2 pair and materialize only physical reserves', () => {
  const f = createPairedDiscoveryNexusFixture({ family: 'choam' }), c = closePairedDiscoveryNexus(f);
  const window = richeseWindow(f, c.afterDraw), request = pairedDiscoveryRicheseRequest(f, window);
  holdPairedDiscoveryNexusCard(window, f.guild, card => card.effect === 'karama', f.staging);
  const pending = applyAction(window, f.owner, request);
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(pending, f.guild);
    view.players.find(p => p.id === f.guild)!.bot = difficulty;
    const action = botActions(view).find(a => a.type === 'passResponse' || a.type === 'card');
    assert.ok(action, 'The actual eligible Karama holder must resolve the signed pair response.');
    let game = applyAction(pending, f.guild, action);
    game = settlePairedDiscoveryNexusShipment(game);
    assert.equal(game.nexusCards!.cards!.discard.filter(c => c === 'richese').length, 1);
    if (game.nexusRicheseCunningLast!.stage === 'stopped') {
      assert.equal(player(game, f.owner).spice, player(window, f.owner).spice);
      assert.equal(player(game, f.owner).reserves, player(window, f.owner).reserves);
      assert.deepEqual(player(game, f.owner).forces, player(window, f.owner).forces);
      assert.deepEqual(player(game, f.owner).noField, player(window, f.owner).noField);
      assert.equal(player(game, f.owner).shipped, false);
      custody(game);
    } else {
      assert.equal(game.nexusRicheseCunningLast!.stage, 'shipped');
      assert.equal(player(game, f.owner).forces['shrine:0'], 5);
      assert.equal(player(game, f.owner).reserves, player(window, f.owner).reserves - 5);
      assert.equal(player(game, f.owner).spice, player(window, f.owner).spice - 1);
      const materialized = richeseReveal(game, f.owner);
      assert.equal(player(materialized, f.owner).forces['shrine:0'], 8);
      assert.equal(player(materialized, f.owner).reserves, player(window, f.owner).reserves - 8);
      custody(materialized);
    }
  }
});

for (const family of ['ix', 'choam'] as const) void test(`paired ${family} authenticated original setup retains native actors, starting hands/offers and exposes a genuine human entry window`, () => {
  const factions = family === 'ix' ? ['ixians', 'tleilaxu', 'guild', 'fremen'] as const : ['richese', 'choam', 'guild', 'fremen'] as const;
  const lobby = createGame('PAIREDAUTHDISCOVERY', newPlayer(`auth-${factions[0]}`, factions[0], factions[0]), true, [family]);
  for (const faction of factions.slice(1)) joinGame(lobby, newPlayer(`auth-${faction}`, faction, faction));
  const setup = initializePairedDiscoveryNexusForFixture({ initial: lobby, family, tech: true, strongholds: true });
  const original = structuredClone(setup), f = createPairedDiscoveryNexusFixture({ initial: setup });
  assert.deepEqual(setup, original); assert.deepEqual(f.setup, original);
  assert.equal(f.owner, `auth-${factions[0]}`); assert.equal(f.native, `auth-${factions[1]}`);
  for (const p of setup.players) for (const card of p.hand)
    assert.ok(player(f.afterSetup, p.id).hand.some(c => c.id === card.id), 'Continue the native starting hand, not a cleared/redealt approximation.');
  assert.equal(f.game.decision!.player, family === 'ix' ? 'auth-ixians' : 'auth-guild');
  const offer = viewGame(f.game, f.collector).discoveryEntry!;
  const accepted = applyAction(f.game, f.collector, { type: 'decision', event: offer.event, accept: true,
    groups: [{ source: f.source, normal: 1, elite: family === 'ix' ? 1 : 0 }] });
  assert.equal(player(accepted, f.collector).forces['shrine:0'], family === 'ix' ? 2 : 1); custody(accepted);
});
