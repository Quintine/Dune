import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, handLimit, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { treacheryDeck, spiceDeck } from '../game/cards';
import type { Card } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { validGameLocation, territory } from '../game/board';
import { validateDiscoveryState } from '../game/discoveries';
import { validateLeaderSkills } from '../game/leader-skills';
import { validateNexusCards } from '../game/nexus-cards';
import { validateRicheseNoField } from '../game/richese-no-field';
import { ownedTech } from '../game/tech-tokens';
import { placePairedSkillsForce, stagePairedSkillsPlanetologistRoute } from './fixture-paired-choam-nexus-skills';
import {
  advanceDiscoveryPairedNexusE2Skills as advance, closeDiscoveryPairedNexusE2Skills as close,
  completeDiscoveryPairedNexusE2SkillsSetup as completeSetup,
  createDiscoveryPairedNexusE2SkillsFixture as fixture,
  discoveryPairedNexusE2SkillsClean as clean,
  discoveryPairedNexusE2SkillsCunningAction as pairAction,
  discoveryPairedNexusE2SkillsInvoiceAction as invoice,
  discoveryPairedNexusE2SkillsPlayer as player,
  finishDiscoveryPairedNexusE2SkillsBattle as finishBattle,
  initializeDiscoveryPairedNexusE2Skills as initialize,
  prepareDiscoveryPairedNexusE2SkillsBattle as prepareBattle,
  settleDiscoveryPairedNexusE2Skills as settle,
  stepDiscoveryPairedNexusE2Skills as step,
  type DiscoveryPairedNexusE2SkillsFixture,
} from './fixture-discovery-paired-nexus-e2-skills';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game));
function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'Rejected human declarations cannot spend cards, invoice, counters or training.');
}
function custody(game: Game): void {
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...(game.auction?.cards.slice(game.auction.index + (game.currentAuctionSale ? 1 : 0)) ?? [])];
  assert.deepEqual(cards.map(c => c.id).sort(), [...treacheryDeck(['choam']), ...richeseCards()].map(c => c.id).sort());
  validateLeaderSkills(game.leaderSkills!, game.players);
  validateNexusCards(game.nexusCards!.cards!, game.players);
  validateDiscoveryState(game.discoveries!);
  for (const p of game.players) {
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((n, count) => n + count, 0), 20);
    if (p.elites) assert.equal(p.elites.reserves + p.elites.tanks + Object.values(p.elites.forces).reduce((n, count) => n + count, 0), p.faction === 'fremen' ? 3 : 5);
    if (p.noField) validateRicheseNoField(p.noField);
  }
}
function acquiredCard(f: DiscoveryPairedNexusE2SkillsFixture, buyer: string, matches: (card: Card) => boolean): Card {
  const receipt = f.acquisitions.find(a => a.buyer === buyer && matches(a.card));
  assert.ok(receipt, 'The intended eligible actor must actually acquire this original card through Bidding.');
  const { before, after, card } = receipt, auction = before.auction!;
  assert.equal(before.phase, 3);
  assert.equal(before.turn, 1);
  assert.equal(auction.cards[auction.index].id, card.id);
  assert.equal(auction.bidder, buyer);
  assert.equal(auction.bid, 1);
  assert.ok(player(before, buyer).hand.length < handLimit(player(before, buyer)));
  assert.ok(f.afterSetup.deck.some(c => c.id === card.id));
  assert.deepEqual(player(after, buyer).hand, [...player(before, buyer).hand, card]);
  assert.equal(player(after, buyer).spice, player(before, buyer).spice - 1);
  assert.ok(f.actions.some(s => s.actor === buyer && s.action.type === 'bid' && s.action.amount === 1));
  return card;
}
const modules = [
  { advanced: false, tech: false, strongholds: false },
  { advanced: false, tech: true, strongholds: false },
  { advanced: true, tech: false, strongholds: false },
  { advanced: true, tech: true, strongholds: false },
  { advanced: true, tech: false, strongholds: true },
  { advanced: true, tech: true, strongholds: true },
] as const;

for (const options of modules) void test(`original paired E2 Discovery/Skills ${JSON.stringify(options)}: paid collection, real end-Mentat entry, Maker and qualified closing draws`, () => {
  const f = fixture(options), ending = close(f);
  const ordinary = [...f.initial.deck, ...f.initial.players.flatMap(p => p.hand)];
  assert.equal(ordinary.length, 35);
  assert.deepEqual(ordinary.map(c => c.id).sort(), treacheryDeck(['choam']).map(c => c.id).sort());
  assert.equal(f.initial.richeseCache!.length, 10);
  assert.equal(f.initial.spiceDeck.length, spiceDeck().length + 7);
  assert.equal(f.initial.discoveries!.tokens.length, 8);
  assert.equal(f.initial.leaderSkills!.deck.length + Object.values(f.initial.leaderSkills!.offers).reduce((n, o) => n + o.cards.length, 0), 14);
  assert.equal(f.initial.nexusCards!.cards!.deck.length, 12);
  assert.equal(player(f.previousMarker.after, f.richese).spice, player(f.previousMarker.before, f.richese).spice - 1);
  assert.equal(player(f.previousMarker.after, f.richese).reserves, player(f.previousMarker.before, f.richese).reserves);
  assert.equal(player(f.collection, f.collector).forces[f.source], 3);
  assert.equal(validGameLocation(f.collection, 'shrine', 0), false);
  assert.ok(f.firstMentat);
  assert.equal(f.firstMentat.before.turn, 1);
  assert.equal(f.firstMentat.before.phase, 8);
  assert.equal(f.firstMentat.after.turn, 2);
  assert.equal(ending.entry.before.phase, 0);
  assert.equal(ending.entry.before.decision?.player, f.collector);
  assert.equal(player(ending.entry.after, f.collector).forces[f.source] ?? 0, 0);
  assert.equal(player(ending.entry.after, f.collector).forces['shrine:0'], 3);
  assert.equal(player(ending.entry.after, f.collector).spice, player(ending.entry.before, f.collector).spice);
  assert.equal(validGameLocation(ending.game, 'shrine', 0), true);
  assert.equal(player(ending.vote, f.choam).forces['hagga_basin:12'] ?? 0, 0);
  assert.equal(player(ending.vote, f.choam).tanks, player(ending.entry.before, f.choam).tanks + 2);
  assert.equal(ending.ride.before.decision?.player, f.fremen);
  assert.equal(player(ending.ride.after, f.fremen).forces['polar_sink:0'], 2);
  assert.equal(player(ending.ride.after, f.fremen).reserves, player(ending.ride.before, f.fremen).reserves - 2);
  if (options.advanced) assert.equal(player(ending.ride.after, f.fremen).elites!.forces['polar_sink:0'], 1);
  assert.equal(ending.alliance.spiceWindow, null);
  assert.equal(ending.alliance.spiceResolution, null);
  assert.equal(player(ending.alliance, f.guild).ally, f.fremen);
  assert.equal(player(ending.alliance, f.fremen).ally, f.guild);
  assert.equal(ending.drawing.phase, 1);
  for (const draw of ending.draws) {
    assert.equal(draw.before.nexusCards!.cards!.hands[draw.step.actor], null);
    assert.equal(draw.after.nexusCards!.cards!.hands[draw.step.actor], player(draw.after, draw.step.actor).faction);
    reject(draw.after, draw.step.actor, draw.step.action);
  }
  assert.equal(ending.game.nexusCards!.cards!.hands[f.guild], null);
  assert.equal(ending.game.nexusCards!.cards!.hands[f.fremen], null);
  assert.deepEqual(ending.game.leaderSkills!.assignments, f.afterSetup.leaderSkills!.assignments);
  if (options.strongholds) {
    assert.equal(f.firstMentat.before.strongholdCards!.owners.arrakeen, null);
    assert.equal(f.firstMentat.after.strongholdCards!.owners.arrakeen, f.choam);
  }
  custody(ending.game);
});

void test('saved authenticated original skill offers and starting hands survive continuation without demanding a random consumer', () => {
  const setup = initialize({ advanced: true, tech: true, strongholds: true,
    seatIds: ['human-richese', 'human-choam', 'human-guild', 'human-fremen'] });
  const before = structuredClone(setup), continued = initialize({ initial: reload(setup) });
  assert.deepEqual(continued, before);
  const done = completeSetup(continued);
  for (const assignment of done.leaderSkills!.assignments)
    assert.ok(before.leaderSkills!.offers[assignment.owner].cards.includes(assignment.skill));
  assert.deepEqual(done.players.map(p => [p.id, p.hand]), before.players.map(p => [p.id, p.hand]));
  assert.equal(Object.keys(done.leaderSkills!.offers).length, 0);
  assert.equal(done.status, 'playing');
  assert.equal(done.leaderSkills!.assignments.length, 4);
  custody(done);
});

for (const advanced of [false, true]) for (const seats of [2, 3, 4, 5, 6]) void test(`${advanced ? 'Advanced' : 'Basic'} human ${seats}-seat original paired programme trains only original offers with legal native modules`, () => {
  const factions = ['richese', 'choam', 'guild', 'fremen', 'emperor', 'atreides'] as const;
  const lobby = createGame(`HUMANE2${seats}`, newPlayer('authenticated-r', 'R', 'richese'), advanced, ['choam']);
  for (const faction of factions.slice(1, seats)) joinGame(lobby, newPlayer(`authenticated-${faction}`, faction, faction));
  const setup = initialize({ initial: lobby, tech: seats >= 3, strongholds: advanced });
  const done = completeSetup(setup);
  assert.equal(done.players.length, seats);
  assert.equal(done.leaderSkills!.assignments.length, seats);
  assert.deepEqual(done.players.map(p => p.id), lobby.players.map(p => p.id));
  assert.equal(done.status, 'playing');
  custody(done);
});

for (const advanced of [false, true]) void test(`${advanced ? 'Advanced' : 'Basic'} nested signed two-marker Cunning keeps one physical invoice through native responses/Guild and private reserve caps`, () => {
  const f = fixture({ advanced, tech: true, strongholds: advanced }), ending = close(f), before = ending.game;
  const karama = acquiredCard(f, f.fremen, c => c.effect === 'karama');
  assert.ok(player(before, f.fremen).hand.some(c => c.id === karama.id));
  const own = player(before, f.richese), previous = own.noField!.tokens.find(t => t.value === 0)!;
  const request = pairAction(before, f.richese);
  reject(before, f.richese, { ...request, noField: previous.id });
  reject(before, f.richese, { ...request, revealedToken: request.noField });
  reject(before, f.richese, { ...request, nexus: 'stale-own-pair' });
  reject(before, f.richese, { ...request, territory: 'treachery-card-stash', sector: 0 });
  reject(before, f.richese, { ...request, sector: 1 });
  reject(before, f.richese, { ...request, amount: 8 });
  reject(before, f.richese, { ...request, smuggler: true });
  for (const cap of [2, 20]) {
    const capped = reload(before), p = player(capped, f.richese);
    placePairedSkillsForce(capped, f.richese, 'polar_sink:0', p.reserves - cap, f.staging);
    const pending = applyAction(capped, f.richese, pairAction(capped, f.richese));
    assert.equal(pending.response?.kind, 'richeseNoField');
    assert.equal(pending.pendingShipment!.cost, 1);
    assert.equal(player(pending, f.richese).spice, p.spice);
    assert.equal(player(pending, f.richese).reserves, cap);
    const corrupted = reload(pending), holder = player(corrupted, f.fremen);
    corrupted.pendingShipment!.cost = 0;
    reject(corrupted, holder.id, { type: 'passResponse' });
    const retargeted = reload(pending);
    retargeted.pendingShipment!.territory = 'arrakeen';
    reject(retargeted, holder.id, { type: 'passResponse' });
    const guild = advance(pending, g => g.decision?.kind === 'guildShipment' || clean(g));
    if (advanced) {
      assert.equal(guild.decision?.player, f.guild);
      assert.equal(player(guild, f.richese).spice, p.spice);
      reject(guild, f.choam, { type: 'decision', allow: true });
      reject(guild, f.guild, { type: 'decision', allow: false });
    }
    const shipped = settle(guild);
    assert.equal(player(shipped, f.richese).spice, p.spice - 1);
    assert.equal(player(shipped, f.guild).spice, player(capped, f.guild).spice + 1);
    assert.equal(player(shipped, f.richese).reserves, cap - Math.min(5, cap));
    assert.equal(player(shipped, f.richese).forces['shrine:0'], Math.min(5, cap));
    assert.equal(player(shipped, f.richese).noField!.deployed!.tokenId, request.noField);
    assert.equal(player(shipped, f.richese).noField!.lastShipped, request.noField);
    assert.equal(shipped.nexusCards!.cards!.hands[f.richese], null);
    assert.deepEqual(player(shipped, f.richese).noField!.tokens, own.noField!.tokens);
    reject(shipped, f.richese, request);
    assert.equal(player(settle(shipped), f.guild).spice, player(shipped, f.guild).spice);
    custody(shipped);
  }
  reject(before, f.richese, { ...pairAction(before, f.richese), smuggler: true });
});

void test('actual original Karama holder cancels a nested pair without a fee, counter materialization or ordinary substitute entitlement', () => {
  const f = fixture({ advanced: true, tech: true }), before = close(f).game;
  const card = acquiredCard(f, f.fremen, c => c.effect === 'karama'), holder = player(before, f.fremen);
  assert.ok(holder.hand.some(c => c.id === card.id));
  const request = pairAction(before, f.richese), pending = applyAction(reload(before), f.richese, request);
  assert.equal(pending.response?.kind, 'richeseNoField');
  const stopped = settle(applyAction(pending, holder.id, { type: 'card', mode: 'cancel', card: card.id }));
  assert.equal(stopped.nexusRicheseCunningLast!.stage, 'stopped');
  assert.equal(stopped.nexusCards!.cards!.hands[f.richese], null);
  assert.equal(stopped.discard.filter(c => c.id === card.id).length, 1);
  assert.equal(player(stopped, holder.id).hand.some(c => c.id === card.id), false);
  for (const p of before.players) {
    assert.equal(player(stopped, p.id).spice, p.spice);
    assert.deepEqual(player(stopped, p.id).forces, p.forces);
    assert.equal(player(stopped, p.id).reserves, p.reserves);
  }
  assert.equal(player(stopped, f.richese).noField!.lastShipped, player(before, f.richese).noField!.lastShipped);
  reject(stopped, f.richese, request);
  reject(stopped, f.richese, { type: 'ship', amount: 6, territory: 'shrine', sector: 0, smuggler: true });
  custody(stopped);
});

void test('all four minimal policies pass the actual Karama-holder response then consume the native two-marker invoice once', () => {
  const f = fixture({ advanced: true, tech: true, strongholds: true }), before = close(f).game;
  const card = acquiredCard(f, f.fremen, c => c.effect === 'karama');
  const holder = player(before, f.fremen), request = pairAction(before, f.richese);
  assert.ok(holder.hand.some(c => c.id === card.id));
  for (const difficulty of DIFFICULTIES) {
    const pending = applyAction(reload(before), f.richese, request), view = viewGame(pending, holder.id);
    assert.equal(pending.response?.kind, 'richeseNoField');
    view.players.find(p => p.id === holder.id)!.bot = difficulty;
    const action = botActions(view).find(a => a.type === 'passResponse');
    assert.ok(action, `${difficulty} must act as the actual eligible Karama holder.`);
    const shipped = settle(applyAction(pending, holder.id, action));
    assert.equal(player(shipped, f.richese).forces['shrine:0'], 5);
    assert.equal(player(shipped, f.richese).spice, player(before, f.richese).spice - 1);
    assert.equal(player(shipped, f.guild).spice, player(before, f.guild).spice + 1);
    assert.equal(shipped.nexusRicheseCunningLast!.stage, 'shipped');
    assert.equal(shipped.nexusCards!.cards!.hands[f.richese], null);
    assert.deepEqual(player(shipped, holder.id).hand, player(before, holder.id).hand);
    custody(shipped);
  }
});

for (const advanced of [false, true]) void test(`${advanced ? 'Advanced' : 'Basic'} original CHOAM Stash draws its one genuine next card without changing its five-card capacity or training`, () => {
  const f = fixture({ advanced, kind: 'stash' }), before = f.collection;
  const hand = player(before, f.choam).hand.map(c => c.id), drawn = before.deck[0]; assert.ok(drawn);
  assert.equal(player(f.game, f.choam).hand.length, hand.length + 1);
  assert.deepEqual(player(f.game, f.choam).hand.map(c => c.id), [...hand, drawn.id]);
  assert.equal(f.game.deck.length, before.deck.length - 1);
  assert.equal(player(f.game, f.choam).spice, player(before, f.choam).spice);
  assert.equal(f.game.discoveries!.tokens.find(t => t.id === f.token)!.status, 'removed');
  assert.deepEqual(f.game.leaderSkills!.assignments, before.leaderSkills!.assignments);
  reject(f.game, f.choam, { type: 'discovery', token: f.token, reveal: true });
  custody(f.game);
});

for (const advanced of [false, true]) void test(`${advanced ? 'Advanced' : 'Basic'} own CHOAM Cunning consumes actual auction-acquired Special fuel, separate from the trained Smuggler invoice`, () => {
  const f = fixture({ advanced, tech: true, strongholds: advanced }), ending = close(f);
  const before = advance(ending.movementStart, g => g.phase === 5 && g.active === f.choam && clean(g));
  const fuel = acquiredCard(f, f.choam, c => c.kind === 'special' && c.effect !== 'karama');
  assert.ok(player(before, f.choam).hand.some(c => c.id === fuel.id));
  const offer = viewGame(before, f.choam).choamWorthless!.plays.find(p => p.source === 'nexus' && p.card.id === fuel.id && p.effect === 'kulon');
  assert.ok(offer && !offer.blocked && offer.source === 'nexus');
  const request: Action = { type: 'card', mode: 'choam', card: fuel.id, effect: 'kulon', nexus: offer.event };
  reject(before, f.choam, { ...request, nexus: 'stale-fuel' });
  const declared = applyAction(reload(before), f.choam, request);
  if (declared.response) assert.equal(declared.response.kind, 'choamWorthless');
  assert.equal(declared.nexusCards!.cards!.hands[f.choam], null);
  if (declared.response) assert.equal(player(declared, f.choam).hand.some(c => c.id === fuel.id), true);
  const fueled = settle(declared);
  assert.equal(fueled.discard.filter(c => c.id === fuel.id).length, 1);
  assert.equal(player(fueled, f.choam).hand.some(c => c.id === fuel.id), false);
  assert.equal(fueled.choamMovement!.bonus, 1);
  reject(fueled, f.choam, request);
  const shipment = invoice(fueled), paid = settle(applyAction(reload(fueled), f.choam, shipment.action));
  assert.equal(player(paid, f.choam).forces[shipment.key], 6);
  assert.equal(player(paid, f.choam).reserves, player(fueled, f.choam).reserves - 6);
  assert.equal(player(paid, f.choam).spice, player(fueled, f.choam).spice - 5);
  assert.equal(player(paid, f.guild).spice, player(fueled, f.guild).spice + 5);
  assert.equal(paid.discard.filter(c => c.id === fuel.id).length, 1);
  assert.deepEqual(paid.leaderSkills!.assignments, before.leaderSkills!.assignments);
  custody(paid);
});

void test('all four minimal card policies spend actual physical fuel for Kulon before a separate ordinary skill move', () => {
  const f = fixture({ advanced: true, choamSkill: 'planetologist', tech: true, strongholds: true }), ending = close(f);
  const before = advance(ending.movementStart, g => g.phase === 5 && g.active === f.choam && clean(g));
  const route = stagePairedSkillsPlanetologistRoute(before, f.choam, f.staging);
  reject(before, f.choam, route.action);
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(before, f.choam); view.players.find(p => p.id === f.choam)!.bot = difficulty;
    const action = botActions(view).find(a => a.type === 'card' && a.mode === 'choam' && a.effect === 'kulon');
    assert.ok(action);
    const fuel = player(before, f.choam).hand.find(c => c.id === action.card); assert.ok(fuel);
    const used = settle(applyAction(reload(before), f.choam, action));
    assert.equal(used.discard.filter(c => c.id === fuel.id).length, 1);
    assert.equal(player(used, f.choam).hand.some(c => c.id === fuel.id), false);
    const moved = settle(applyAction(used, f.choam, route.action));
    assert.equal(player(moved, f.choam).forces[route.from] ?? 0, 0);
    assert.equal(player(moved, f.choam).forces[route.to], 1);
    assert.equal(player(moved, f.choam).moved, 1);
    assert.equal(moved.discard.filter(c => c.id === fuel.id).length, 1);
    assert.deepEqual(moved.leaderSkills!.assignments, before.leaderSkills!.assignments);
    custody(moved);
  }
});

void test('all four eligible Suk decisions follow voluntary nested pair reveal and settled physical casualties before optional Tech transfer', () => {
  const f = fixture({ advanced: true, tech: true, strongholds: true }), before = close(f).game;
  const shipped = settle(applyAction(reload(before), f.richese, pairAction(before, f.richese)));
  const battle = prepareBattle(f, shipped);
  let game = battle.game;
  for (const plan of battle.plans) game = settle(step(game, plan));
  const revealed = reload(game), loserTokens = ownedTech(game.techTokens, f.guild);
  assert.equal(player(game, f.richese).forces[battle.key], 8);
  game = advance(game, g => g.decision?.kind === 'sukRescue');
  assert.equal(game.decision?.player, f.richese);
  if (game.decision?.kind !== 'sukRescue') throw Error('The genuinely trained battle must reach its actual rescue decision.');
  const pending = game, decision = game.decision;
  reject(pending, f.guild, { type: 'decision', event: decision.event, choice: 0 });
  reject(pending, f.richese, { type: 'decision', event: 'stale-rescue', choice: 0 });
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(pending, f.richese); view.players.find(p => p.id === f.richese)!.bot = difficulty;
    const action = botActions(view).find(a => a.type === 'decision' && typeof a.choice === 'number'); assert.ok(action && typeof action.choice === 'number');
    const rescue = decision.options[action.choice]; assert.ok(rescue);
    const done = finishBattle(applyAction(reload(pending), f.richese, action));
    const kept = rescue.kept?.kind === 'normal' ? 1 : 0;
    assert.equal(player(done, f.richese).forces[battle.key], 6 + kept);
    assert.equal(player(done, f.richese).reserves, 12 + rescue.normal - kept);
    assert.equal(player(done, f.richese).tanks, 2 - rescue.normal);
    assert.equal(player(done, f.guild).tanks, player(revealed, f.guild).tanks + 3);
    assert.equal(done.lastBattleContext!.winner, f.richese);
    assert.equal(player(done, f.richese).noField!.deployed, null);
    assert.deepEqual(done.leaderSkills!.assignments, before.leaderSkills!.assignments);
    for (const token of loserTokens) assert.equal(done.techTokens![token].owner, f.richese);
    custody(done);
  }
});

void test('held Arrakeen support affects only its proper payer leg, not an unrelated nested Shrine entitlement', () => {
  const f = fixture({ advanced: true, tech: true, strongholds: true, arrakeenOwner: 'richese' }), ending = close(f);
  assert.equal(ending.game.strongholdCards!.owners.arrakeen, f.richese);
  const nested = settle(applyAction(reload(ending.game), f.richese, pairAction(ending.game, f.richese)));
  const battle = prepareBattle(f, nested);
  let game = battle.game;
  for (const plan of battle.plans) game = settle(step(game, plan));
  const wallet = player(game, f.richese).spice;
  const committed = advance(game, g => g.decision?.kind === 'sukRescue');
  assert.equal(player(committed, f.richese).spice, wallet - 2, 'Arrakeen held card cannot fund support at another source.');
  assert.equal(committed.strongholdCards!.owners.arrakeen, f.richese);
  const done = finishBattle(committed);
  assert.equal(done.lastBattleContext!.winner, f.richese);
  assert.equal(player(done, f.richese).forces['shrine:0'], 7);
  custody(done);
});

void test('actual held Arrakeen bank support changes its payer debit without increasing trained dial or rescue', () => {
  const f = fixture({ advanced: true, tech: true, strongholds: true, arrakeenOwner: 'richese' }), before = close(f).game;
  const key = `arrakeen:${territory('arrakeen').sectors[0]}`, own = player(before, f.richese);
  assert.equal(before.strongholdCards!.owners.arrakeen, f.richese);
  own.reserves += own.forces[key]; delete own.forces[key];
  f.staging.push('Conserve the original Arrakeen claiming counter back to native reserves after its real END Mentat claim; retain the actually held card, never assign custody.');
  const shipped = settle(applyAction(reload(before), f.richese, pairAction(before, f.richese, 'arrakeen')));
  const battle = prepareBattle(f, shipped);
  let game = battle.game;
  reject(game, f.richese, { ...battle.plans[0].action, dial: 9, support: 9 });
  for (const plan of battle.plans) game = settle(step(game, plan));
  const wallet = player(game, f.richese).spice;
  const committed = advance(game, g => g.decision?.kind === 'sukRescue');
  assert.equal(player(committed, f.richese).spice, wallet, 'Held Arrakeen funds exactly the original declared support leg.');
  assert.equal(committed.decision?.player, f.richese);
  const done = finishBattle(committed);
  assert.equal(done.lastBattleContext!.winner, f.richese);
  assert.equal(player(done, f.richese).forces[key], 7);
  assert.equal(player(done, f.richese).tanks, 0);
  assert.equal(player(done, f.guild).tanks, 3);
  assert.equal(done.strongholdCards!.owners.arrakeen, f.richese);
  custody(done);
});
