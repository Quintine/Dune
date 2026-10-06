import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { territory } from '../game/board';
import { ownedTech } from '../game/tech-tokens';
import { quotePhaseResources } from '../game/phase-resource-quote';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { discoveryPairedNexusE2SkillsCunningAction } from './fixture-discovery-paired-nexus-e2-skills';
import { pairedSkillsChoamCunningRequest, quotePairedSkillsBattle } from './fixture-paired-choam-nexus-skills';
import {
  advanceHomeworldPairedNexus as advance, createHomeworldPairedNexusProgramme as programme,
  finishHomeworldPairedNexusBattle as finishBattle, homeworldPairedNexusArmy as army,
  homeworldPairedNexusClean as clean, homeworldPairedNexusInventory as inventory,
  homeworldPairedNexusLeader as leader, homeworldPairedNexusPlayer as player,
  openHomeworldPairedNexusBattle as openBattle, revealHomeworldPairedNexusPlans as revealPlans,
  settleHomeworldPairedNexus as settle, shipHomeworldPairedNexus as ship,
  stepHomeworldPairedNexus as step, type HomeworldPairedNexusStep,
} from './fixture-homeworld-paired-nexus';

/** Every consumer begins with the original initializer, actual owned actions,
 * conserved unused lotteries and unplayed Spice order. No held card, board
 * position, wallet, alliance, outcome or authenticated receipt is assigned. */
function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'Rejected consumers leave physical stock and payments unchanged.');
}
function policies(game: Game, actor: string, select: (action: Action) => boolean,
  outcome: (after: Game, action: Action) => void): void {
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, actor); view.players.find(p => p.id === actor)!.bot = difficulty;
    const action = botActions(view).find(select); assert.ok(action, `${difficulty} selects the actual owned window`);
    const after = applyAction(structuredClone(game), actor, action);
    outcome(after, action); inventory(after);
  }
}
function consumeSuboids(game: Game, owner: string, actions?: HomeworldPairedNexusStep[]): Game {
  const offer = viewGame(game, owner).nexusSuboids?.offer; assert.ok(offer && !offer.blocked);
  const action: Action = { type: 'nexusSuboids', event: offer.event };
  reject(game, owner, { ...action, event: 'obsolete-suboid-battle' });
  policies(game, owner, a => a.type === 'nexusSuboids', after => {
    const resolved = settle(after);
    assert.equal(resolved.nexusCards!.cards!.hands[owner], null);
    assert.equal(resolved.nexusCards!.cards!.discard.filter(c => c === 'ixians').length, 1);
    assert.deepEqual(player(resolved, owner).forces, player(game, owner).forces);
    assert.equal(viewGame(resolved, owner).battle!.ownForces!.normalFreeSupport, true);
  });
  const played = settle(step(game, { actor: owner, action }, actions), actions);
  assert.equal(played.nexusCards!.cards!.hands[owner], null);
  assert.equal(played.nexusCards!.cards!.discard.filter(c => c === 'ixians').length, 1);
  assert.equal(viewGame(played, owner).battle!.ownForces!.normalFreeSupport, true);
  reject(played, owner, action); inventory(played);
  return played;
}
function atMovement(game: Game, actor: string, turn = 2): Game {
  return advance(game, g => g.turn === turn && g.phase === 5 && g.active === actor && clean(g));
}

void test('Basic paired E1 without Skills or Discovery genuinely draws matching Cunning, invades native Ix and preserves foreign-Homeworld Face Dance suppression', () => {
  const f = programme({ advanced: false, skills: false, discovery: false, tech: true, strongholds: false });
  assert.equal(player(f.alliance, f.guild).ally, f.fremen);
  assert.equal(player(f.alliance, f.fremen).ally, f.guild);
  policies(f.draws[0].before, f.owner, a => a.type === 'nexusCardChoice', after => {
    assert.equal(after.nexusCards!.cards!.hands[f.owner], 'ixians');
    assert.equal(player(after, f.owner).spice, player(f.draws[0].before, f.owner).spice);
    assert.deepEqual(after.homeworlds!.custody, f.draws[0].before.homeworlds!.custody);
  });
  for (const draw of f.draws) {
    assert.equal(draw.before.nexusCards!.cards!.hands[draw.step.actor], null);
    assert.equal(draw.after.nexusCards!.cards!.hands[draw.step.actor], player(draw.after, draw.step.actor).faction);
    assert.equal(player(draw.after, draw.step.actor).spice, player(draw.before, draw.step.actor).spice);
  }
  let game = ship(atMovement(f.game, f.guild), f.guild, 'homeworld:ixians', 3);
  game = consumeSuboids(openBattle(game, f.owner, f.guild, 'homeworld:ixians', false), f.owner);
  const own = leader(game, f.owner, true), before = structuredClone(game), lostTech = ownedTech(game.techTokens, f.guild);
  game = revealPlans(game, [{ actor: f.owner, action: { type: 'battlePlan', leader: own, dial: 0, support: 0 } },
    { actor: f.guild, action: { type: 'battlePlan', leader: leader(game, f.guild), dial: 0, support: 0 } }]);
  game = finishBattle(game);
  assert.equal(game.lastBattleContext!.winner, f.owner);
  assert.deepEqual(army(game, f.owner, 'homeworld:ixians'), army(before, f.owner, 'homeworld:ixians'));
  assert.deepEqual(army(game, f.guild, 'homeworld:ixians'), { normal: 0, elite: 0 });
  assert.equal(player(game, f.guild).tanks, player(before, f.guild).tanks + 3);
  for (const token of lostTech) assert.equal(game.techTokens![token].owner, f.owner);
  assert.equal(player(game, f.owner).leaders.find(l => l.id === own)!.dead, false);
  assert.ok(player(game, f.native).faceDancers!.every(c => !c.revealed));
  reject(game, f.native, { type: 'decision', reveal: true, sources: { reserves: 1 }, sector: 0 });
  inventory(game);
});

for (const visitor of [false, true]) void test(`Advanced matching Suboid Cunning and ${visitor ? 'visitor' : 'native'} typed Suk leave only real residual Cyborg Tanks available for equal Suboid exchange`, () => {
  const f = programme({ advanced: true, skills: true, discovery: false, tech: true, strongholds: true });
  assert.ok(f.trainer);
  const destination = visitor ? 'homeworld:guild' : 'homeworld:ixians';
  const sender = visitor ? f.owner : f.guild;
  let game = ship(atMovement(f.game, sender), sender, destination, visitor ? 4 : 3, visitor ? 3 : 0);
  game = consumeSuboids(openBattle(game, f.owner, f.guild, destination), f.owner);
  const before = structuredClone(game), enemyTech = ownedTech(game.techTokens, f.guild);
  game = revealPlans(game, [{ actor: f.owner, action: { type: 'battlePlan', leader: f.trainer, dial: 3, support: 0 } },
    { actor: f.guild, action: { type: 'battlePlan', leader: leader(game, f.guild), dial: 0, support: 0 } }]);
  game = advance(game, g => g.decision?.kind === 'sukRescue');
  const d = game.decision; assert.ok(d?.kind === 'sukRescue');
  assert.deepEqual(army(game, f.owner, destination), army(before, f.owner, destination), 'Casualty commitment has not yet killed or moved physical counters.');
  policies(game, f.owner, a => a.type === 'decision' && a.choice !== undefined, (after, action) => {
    const rescue = d.options[Number(action.choice)], saved = rescue.normal + rescue.elite;
    assert.equal(player(after, f.owner).tanks, player(game, f.owner).tanks + 3 - saved);
    assert.equal(player(after, f.owner).elites!.tanks, player(game, f.owner).elites!.tanks + 3 - rescue.elite);
    assert.deepEqual(army(after, f.owner, 'homeworld:ixians'), visitor
      ? { normal: army(game, f.owner, 'homeworld:ixians').normal,
        elite: army(game, f.owner, 'homeworld:ixians').elite + rescue.elite - (rescue.kept?.kind === 'elite' ? 1 : 0) }
      : { normal: army(game, f.owner, destination).normal, elite: army(game, f.owner, destination).elite - 3 + rescue.elite });
  });
  const choice = d.options.findIndex(o => o.normal === 0 && o.elite === 1 && o.kept?.kind === 'elite'); assert.ok(choice >= 0);
  const rescueAction: Action = { type: 'decision', event: d.event, choice };
  reject(game, f.guild, rescueAction);
  reject(game, f.owner, { ...rescueAction, event: 'obsolete-suk' });
  reject(game, f.owner, { ...rescueAction, destinations: { 'homeworld:ixians': { normal: 0, elite: 1 } } });
  game = step(JSON.parse(JSON.stringify(game)) as Game, { actor: f.owner, action: rescueAction });
  game = advance(game, g => g.decision?.kind === 'ixSubstitution');
  const physical = game.lastBattleContext!.sukRescue!.physical!;
  assert.equal(physical.source, visitor ? 'visitor-homeworld' : 'native-homeworld');
  assert.deepEqual(physical.saved, { normal: 0, elite: 1 });
  assert.deepEqual(physical.tanks, { normal: 0, elite: 2 });
  assert.deepEqual(physical.destinations, {});
  assert.deepEqual(game.pendingIxSubstitution!.losses, { [destination]: 2 });
  const residual = structuredClone(game), pool = army(game, f.owner, destination);
  const exchange: Action = { type: 'decision', sources: { [destination]: 1 }, recover: { [destination]: 1 } };
  reject(game, f.owner, { ...exchange, recover: { [destination]: 3 } });
  reject(game, f.owner, { ...exchange, sources: { reserves: 1 } });
  reject(game, f.owner, { ...exchange, recover: { 'homeworld:tleilaxu': 1 } });
  policies(game, f.owner, a => a.type === 'decision' && (a.decline === true || a.sources !== undefined), (after, action) => {
    const count = action.decline ? 0 : Object.values((action.recover ?? {}) as Record<string, number>).reduce((sum, n) => sum + n, 0);
    assert.equal(player(after, f.owner).elites!.tanks, player(residual, f.owner).elites!.tanks - count);
    assert.deepEqual(army(after, f.owner, destination), { normal: pool.normal - count, elite: pool.elite + count });
    assert.equal(player(after, f.owner).spice, player(residual, f.owner).spice);
  });
  game = step(game, { actor: f.owner, action: exchange });
  game = advance(game, g => !g.pendingIxSubstitution);
  assert.deepEqual(army(game, f.owner, destination), { normal: pool.normal - 1, elite: pool.elite + 1 });
  assert.equal(player(game, f.owner).elites!.tanks, player(residual, f.owner).elites!.tanks - 1);
  assert.equal(player(game, f.owner).tanks, player(residual, f.owner).tanks);
  assert.equal(player(game, f.owner).spice, player(residual, f.owner).spice);
  if (visitor) assert.deepEqual(army(game, f.owner, 'homeworld:ixians'), army(residual, f.owner, 'homeworld:ixians'));
  reject(game, f.owner, exchange);
  game = finishBattle(game);
  assert.equal(game.lastBattleContext!.winner, f.owner);
  for (const token of enemyTech) assert.equal(game.techTokens![token].owner, f.owner);
  assert.ok(player(game, f.native).faceDancers!.every(c => !c.revealed), 'Foreign Homeworld never opens the forbidden native replacement.');
  inventory(game);
});

void test('actual Maker entry and matching nested Cunning preserve typed sources; cleanup precedes winner Tech and legal matching Face Dance without a borrowed-native grant', () => {
  const f = programme({ advanced: true, discovery: true, skills: true, tech: true, strongholds: true });
  assert.ok(f.entry && f.ride && f.vote && f.trainer);
  const entered = f.entry.after;
  assert.equal(player(entered, f.owner).forces['shrine:0'], 2);
  assert.equal(player(entered, f.owner).elites!.forces['shrine:0'], 1);
  assert.deepEqual(entered.homeworlds!.custody, f.entry.before.homeworlds!.custody);
  assert.equal(player(entered, f.owner).spice, player(f.entry.before, f.owner).spice);
  policies(f.entry.before, f.owner, a => a.type === 'decision' && a.accept === false, after => {
    assert.equal(player(after, f.owner).forces['shrine:0'] ?? 0, 0);
    assert.deepEqual(player(after, f.owner).forces, player(f.entry!.before, f.owner).forces);
    assert.deepEqual(after.homeworlds!.custody, f.entry!.before.homeworlds!.custody);
  });
  const rideBefore = player(f.ride.before, f.fremen), rideAfter = player(f.ride.after, f.fremen);
  assert.equal(rideAfter.reserves, rideBefore.reserves - 2);
  assert.equal(rideAfter.elites!.reserves, rideBefore.elites!.reserves - 1);
  assert.equal(rideAfter.forces['polar_sink:0'], (rideBefore.forces['polar_sink:0'] ?? 0) + 2);
  assert.equal(rideAfter.spice, rideBefore.spice);
  let game = ship(atMovement(f.game, f.native), f.native, 'shrine', 2);
  game = consumeSuboids(openBattle(game, f.owner, f.native, 'shrine'), f.owner);
  assert.ok(player(game, f.native).faceDancers!.some(c => c.leader === f.trainer && !c.revealed));
  const worthless = player(game, f.owner).hand.find(c => c.kind === 'worthless'); assert.ok(worthless);
  game = revealPlans(game, [{ actor: f.owner, action: { type: 'battlePlan', leader: f.trainer, dial: 0, support: 0, weapon: worthless.id } },
    { actor: f.native, action: { type: 'battlePlan', leader: leader(game, f.native), dial: 0, support: 0 } }]);
  game = advance(game, g => g.decision?.kind === 'battleCards');
  assert.equal(game.techTokens!.axlotl.owner, f.native);
  policies(game, f.owner, a => a.type === 'decision' && a.discard !== undefined, (after, action) => {
    const discarded = action.discard as string[];
    assert.equal(player(after, f.owner).hand.some(c => c.id === worthless.id), !discarded.includes(worthless.id));
    assert.equal(after.discard.some(c => c.id === worthless.id), discarded.includes(worthless.id));
  });
  game = step(game, { actor: f.owner, action: { type: 'decision', discard: [worthless.id] } });
  game = advance(game, g => g.decision?.kind === 'faceDance');
  assert.equal(game.techTokens!.axlotl.owner, f.owner);
  assert.equal(player(game, f.owner).hand.some(c => c.id === worthless.id), false);
  assert.equal(game.discard.filter(c => c.id === worthless.id).length, 1);
  const before = structuredClone(game), home = army(game, f.native, 'homeworld:tleilaxu');
  const dance: Action = { type: 'decision', reveal: true, sources: { reserves: 1 }, sector: 0 };
  reject(game, f.owner, dance);
  reject(game, f.native, { ...dance, sources: { reserves: 3 } });
  policies(game, f.native, a => a.type === 'decision' && a.reveal !== undefined, (after, action) => {
    const count = action.reveal ? Object.values((action.sources ?? {}) as Record<string, number>).reduce((sum, n) => sum + n, 0) : 0;
    assert.equal(player(after, f.owner).leaders.find(l => l.id === f.trainer)!.dead, !!action.reveal);
    assert.equal(player(after, f.native).faceDancers!.find(c => c.leader === f.trainer)!.revealed, !!action.reveal);
    assert.equal(player(after, f.owner).forces['shrine:0'] ?? 0, action.reveal ? 0 : 2);
    assert.equal(player(after, f.native).forces['shrine:0'] ?? 0, count);
    assert.deepEqual(after.techTokens, before.techTokens);
  });
  game = step(JSON.parse(JSON.stringify(game)) as Game, { actor: f.native, action: dance });
  assert.equal(player(game, f.owner).forces['shrine:0'] ?? 0, 0);
  assert.equal(player(game, f.owner).reserves, player(before, f.owner).reserves + 2);
  assert.equal(player(game, f.owner).elites!.reserves, player(before, f.owner).elites!.reserves + 1);
  assert.equal(player(game, f.native).forces['shrine:0'], 1);
  assert.deepEqual(army(game, f.native, 'homeworld:tleilaxu'), { normal: home.normal - 1, elite: home.elite });
  assert.equal(player(game, f.owner).leaders.find(l => l.id === f.trainer)!.dead, true);
  assert.equal(game.leaderSkills!.assignments.some(a => a.leader === f.trainer), false);
  assert.equal(game.leaderSkills!.deck.filter(c => c === 'suk-graduate').length, 1);
  assert.deepEqual(game.techTokens, before.techTokens, 'Face Dance cannot redo the already settled winner reward.');
  inventory(game);
});

void test('nested Richese matching pair charges one signed invoice, keeps markers separate until reveal and debits actual Advanced support before Suk and winner Tech', () => {
  const f = programme({ family: 'choam', advanced: true, skills: true, discovery: true, tech: true, strongholds: true });
  assert.ok(f.firstMarker && f.trainer);
  assert.equal(player(f.firstMarker.after, f.owner).spice, player(f.firstMarker.before, f.owner).spice - 1);
  assert.equal(player(f.firstMarker.after, f.owner).reserves, player(f.firstMarker.before, f.owner).reserves);
  let game = atMovement(f.game, f.owner);
  const before = structuredClone(game), request = discoveryPairedNexusE2SkillsCunningAction(game, f.owner);
  reject(game, f.owner, { ...request, nexus: 'obsolete-pair' });
  reject(game, f.owner, { ...request, revealedToken: request.noField });
  reject(game, f.owner, { ...request, smuggler: true });
  game = step(game, { actor: f.owner, action: request });
  assert.equal(player(game, f.owner).spice, player(before, f.owner).spice, 'Declaration alone does not debit the invoice.');
  game = settle(game);
  assert.equal(player(game, f.owner).spice, player(before, f.owner).spice - 1);
  assert.equal(player(game, f.guild).spice, player(before, f.guild).spice + 1);
  assert.equal(player(game, f.owner).forces['shrine:0'], 5);
  assert.equal(player(game, f.owner).reserves, player(before, f.owner).reserves - 5);
  assert.equal(player(game, f.owner).noField!.deployed!.tokenId, request.noField);
  assert.equal(game.nexusCards!.cards!.hands[f.owner], null);
  const deployed = structuredClone(game), event = player(game, f.owner).noFieldEvent;
  reject(game, f.owner, request);
  reject(game, f.owner, { type: 'revealNoField', event: 'obsolete-reveal', token: request.noField });
  game = step(JSON.parse(JSON.stringify(game)) as Game, { actor: f.owner,
    action: { type: 'revealNoField', event, token: request.noField } });
  assert.equal(player(game, f.owner).forces['shrine:0'], 8);
  assert.equal(player(game, f.owner).reserves, player(deployed, f.owner).reserves - 3);
  assert.equal(player(game, f.owner).spice, player(deployed, f.owner).spice);
  assert.equal(player(game, f.guild).spice, player(deployed, f.guild).spice);
  game = openBattle(game, f.owner, f.guild, 'shrine');
  const beforePlans = structuredClone(game), lostTech = ownedTech(game.techTokens, f.guild);
  game = revealPlans(game, [{ actor: f.owner, action: { type: 'battlePlan', leader: f.trainer, dial: 2, support: 2 } },
    { actor: f.guild, action: { type: 'battlePlan', leader: leader(game, f.guild), dial: 0, support: 0 } }]);
  assert.equal(player(game, f.owner).spice, player(beforePlans, f.owner).spice, 'Sealed/revealed support is not charged before resolution.');
  game = advance(game, g => g.decision?.kind === 'sukRescue');
  assert.equal(player(game, f.owner).spice, player(beforePlans, f.owner).spice - 2);
  assert.equal(player(game, f.native).spice, player(beforePlans, f.native).spice,
    'Native CHOAM income waits for the original skill aftermath; payment has already settled.');
  for (const token of lostTech) assert.equal(game.techTokens![token].owner, f.guild);
  const d = game.decision; assert.ok(d?.kind === 'sukRescue');
  const choice = d.options.findIndex(o => o.normal === 2 && o.elite === 0 && o.kept?.kind === 'normal'); assert.ok(choice >= 0);
  const home = army(game, f.owner, 'homeworld:richese'), funds = new Map(game.players.map(p => [p.id, p.spice]));
  game = step(game, { actor: f.owner, action: { type: 'decision', event: d.event, choice } });
  assert.equal(player(game, f.owner).forces['shrine:0'], 7);
  assert.deepEqual(army(game, f.owner, 'homeworld:richese'), { normal: home.normal + 1, elite: 0 });
  assert.equal(player(game, f.owner).tanks, 0);
  for (const seat of game.players)
    assert.equal(seat.spice, funds.get(seat.id)! + (seat.id === f.native ? 1 : 0),
      'Rescue does not repeat/refund support; the original pending CHOAM income settles after skill cleanup.');
  game = finishBattle(game);
  assert.equal(game.lastBattleContext!.winner, f.owner);
  assert.equal(player(game, f.guild).tanks, 3);
  for (const token of lostTech) assert.equal(game.techTokens![token].owner, f.owner);
  inventory(game);
});

void test('real first-turn Arrakeen claim supplies source-local bank support after genuine pairing; held custody and phase-end industry pay only at their original boundaries', () => {
  const f = programme({ family: 'choam', advanced: true, discovery: false, skills: true, tech: true, strongholds: true, arrakeenClaim: true });
  assert.equal(f.game.strongholdCards!.owners.arrakeen, f.owner);
  const actors = new Set([f.owner, f.guild]);
  let game = f.game;
  while (actors.size) {
    game = advance(game, g => g.phase === 5 && clean(g) && actors.has(g.active!));
    const actor = game.active!;
    if (actor === f.owner) {
      const p = player(game, actor), offer = viewGame(game, actor).nexusRicheseCunning; assert.ok(offer && !offer.blocked);
      const request: Action = { type: 'ship', territory: 'arrakeen', sector: territory('arrakeen').sectors[0],
        noField: p.noField!.tokens.find(t => t.value === 0)!.id, revealedToken: p.noField!.tokens.find(t => t.value === 5)!.id,
        event: p.noFieldEvent, nexus: offer.event, allyPayment: 0 };
      game = settle(step(game, { actor, action: request }));
      game = step(game, { actor, action: { type: 'revealNoField', event: player(game, actor).noFieldEvent, token: request.noField } });
    } else game = ship(game, actor, 'arrakeen', 3);
    actors.delete(actor);
    if (actors.size) game = step(game, { actor, action: { type: 'endMovement' } });
  }
  const industry = game.techTokens!.heighliners, industryOwner = industry.owner; assert.ok(industryOwner);
  const credit = quotePhaseResources(game).credits.find(row => row.kind === 'tech' && row.token === 'heighliners'); assert.ok(credit);
  const beforeMovementEnd = structuredClone(game);
  game = openBattle(game, f.owner, f.guild, 'arrakeen');
  assert.equal(game.techTokens!.heighliners.spice, 0);
  assert.equal(player(game, industryOwner).spice, credit.balance);
  assert.equal(game.strongholdCards!.owners.arrakeen, f.owner, 'Contest does not transfer a held card before END Mentat.');
  assert.equal(viewGame(game, f.owner).battle!.strongholdEffects[f.owner], 'arrakeen');
  const beforePlans = structuredClone(game); assert.ok(f.trainer);
  game = revealPlans(game, [{ actor: f.owner, action: { type: 'battlePlan', leader: f.trainer, dial: 2, support: 2 } },
    { actor: f.guild, action: { type: 'battlePlan', leader: leader(game, f.guild), dial: 0, support: 0 } }]);
  const quote = quotePairedSkillsBattle(game), payment = quote.payments.find(p => p.player === f.owner)!;
  assert.equal(payment.ownPayment, 0); assert.equal(payment.bankSupport, 2);
  game = advance(game, g => g.decision?.kind === 'sukRescue');
  assert.equal(player(game, f.owner).spice, player(beforePlans, f.owner).spice);
  assert.equal(player(game, f.native).spice, player(beforePlans, f.native).spice,
    'Bank support still earns the pending native income only after skill cleanup.');
  const d = game.decision; assert.ok(d?.kind === 'sukRescue');
  const choice = d.options.findIndex(o => o.normal === 2 && o.kept?.kind === 'normal'); assert.ok(choice >= 0);
  game = finishBattle(step(game, { actor: f.owner, action: { type: 'decision', event: d.event, choice } }));
  assert.equal(player(game, f.owner).forces[`arrakeen:${territory('arrakeen').sectors[0]}`], 7);
  assert.equal(player(game, f.owner).tanks, 0);
  assert.equal(game.strongholdCards!.owners.arrakeen, f.owner);
  assert.equal(beforeMovementEnd.techTokens!.heighliners.spice, ownedTech(beforeMovementEnd.techTokens, industryOwner).length);
  inventory(game);
});

void test('actual CHOAM Special fuels matching Cunning once; original native payer support is charged at resolution and cannot use held Arrakeen from another source', () => {
  const f = programme({ family: 'choam', advanced: true, skills: true, discovery: false, tech: true, strongholds: true, arrakeenClaim: true });
  let game = atMovement(f.game, f.native);
  const fuel = player(game, f.native).hand.find(c => c.kind === 'special' && c.effect !== 'karama'); assert.ok(fuel);
  const action = pairedSkillsChoamCunningRequest(game, f.native, fuel.id);
  const before = structuredClone(game);
  reject(game, f.native, { ...action, nexus: 'obsolete-choam' });
  game = settle(step(game, { actor: f.native, action }));
  assert.equal(player(game, f.native).hand.some(c => c.id === fuel.id), false);
  assert.equal(game.discard.filter(c => c.id === fuel.id).length, 1);
  assert.equal(game.nexusCards!.cards!.hands[f.native], null);
  assert.equal(player(game, f.native).spice, player(before, f.native).spice);
  reject(game, f.native, action);
  game = ship(game, f.native, 'homeworld:guild', 3);
  game = openBattle(game, f.native, f.guild, 'homeworld:guild', false);
  assert.notEqual(viewGame(game, f.native).battle!.strongholdEffects[f.native], 'arrakeen');
  const ownLeader = leader(game, f.native, true), beforePlans = structuredClone(game);
  game = revealPlans(game, [{ actor: f.native, action: { type: 'battlePlan', leader: ownLeader, dial: 2, support: 2 } },
    { actor: f.guild, action: { type: 'battlePlan', leader: leader(game, f.guild), dial: 0, support: 0 } }]);
  assert.equal(player(game, f.native).spice, player(beforePlans, f.native).spice);
  game = finishBattle(game);
  assert.equal(game.lastBattleContext!.winner, f.native);
  assert.equal(player(game, f.native).tanks, player(beforePlans, f.native).tanks + 2);
  assert.deepEqual(army(game, f.native, 'homeworld:guild'), { normal: 1, elite: 0 });
  // Collection may already have opened; separate its stronghold/harvest income from support.
  const collection = game.phase === 7 && clean(game) ? quoteSpiceCollection(game).receipts.find(r => r.player === f.native) : undefined;
  assert.equal(player(game, f.native).spice, player(beforePlans, f.native).spice - 2 +
    (collection?.strongholds ?? 0) + (collection?.collected ?? 0));
  assert.equal(game.discard.filter(c => c.id === fuel.id).length, 1);
  inventory(game);
});

void test('genuine typed Shrine reinforcements make nested Suk precede only residual Cyborg substitution, with matching native Cunning already consumed', () => {
  const f = programme({ advanced: true, skills: true, discovery: true, tech: true, strongholds: true });
  assert.ok(f.trainer);
  const senders = new Set([f.owner, f.native]);
  let game = f.game;
  while (senders.size) {
    game = advance(game, g => g.turn === 2 && g.phase === 5 && clean(g) && senders.has(g.active!));
    const actor = game.active!;
    game = ship(game, actor, 'shrine', actor === f.owner ? 4 : 3, actor === f.owner ? 2 : 0);
    senders.delete(actor);
    if (senders.size) game = step(game, { actor, action: { type: 'endMovement' } });
  }
  assert.equal(player(game, f.owner).forces['shrine:0'], 6);
  assert.equal(player(game, f.owner).elites!.forces['shrine:0'], 3);
  game = consumeSuboids(openBattle(game, f.owner, f.native, 'shrine'), f.owner);
  const home = army(game, f.owner, 'homeworld:ixians'), priorTanks = player(game, f.owner).elites!.tanks;
  game = revealPlans(game, [{ actor: f.owner, action: { type: 'battlePlan', leader: f.trainer, dial: 3, support: 0 } },
    { actor: f.native, action: { type: 'battlePlan', leader: leader(game, f.native), dial: 0, support: 0 } }]);
  game = advance(game, g => g.decision?.kind === 'sukRescue');
  const d = game.decision; assert.ok(d?.kind === 'sukRescue');
  const choice = d.options.findIndex(o => o.normal === 0 && o.elite === 1 && o.kept?.kind === 'elite'); assert.ok(choice >= 0);
  game = step(game, { actor: f.owner, action: { type: 'decision', event: d.event, choice } });
  game = advance(game, g => g.decision?.kind === 'ixSubstitution');
  assert.equal(player(game, f.owner).elites!.tanks, priorTanks + 2);
  assert.equal(player(game, f.owner).forces['shrine:0'], 4);
  assert.equal(player(game, f.owner).elites!.forces['shrine:0'], 1);
  assert.deepEqual(army(game, f.owner, 'homeworld:ixians'), home, 'The kept nested Cyborg is not also returned to native reserves.');
  assert.deepEqual(game.pendingIxSubstitution!.losses, { 'shrine:0': 2 });
  const before = structuredClone(game);
  const action: Action = { type: 'decision', sources: { 'shrine:0': 1 }, recover: { 'shrine:0': 1 } };
  reject(game, f.owner, { ...action, recover: { 'shrine:0': 3 } });
  reject(game, f.owner, { ...action, sources: { 'homeworld:ixians': 1 } });
  game = step(JSON.parse(JSON.stringify(game)) as Game, { actor: f.owner, action });
  game = advance(game, g => !g.pendingIxSubstitution);
  assert.equal(player(game, f.owner).forces['shrine:0'], 4);
  assert.equal(player(game, f.owner).elites!.forces['shrine:0'], 2);
  assert.equal(player(game, f.owner).elites!.tanks, player(before, f.owner).elites!.tanks - 1);
  assert.equal(player(game, f.owner).tanks, player(before, f.owner).tanks);
  assert.equal(player(game, f.owner).spice, player(before, f.owner).spice);
  assert.deepEqual(army(game, f.owner, 'homeworld:ixians'), home);
  game = finishBattle(game);
  assert.equal(game.lastBattleContext!.winner, f.owner);
  assert.equal(player(game, f.native).tanks, 3);
  assert.equal(player(game, f.native).faceDancers!.find(c => c.leader === f.trainer)!.revealed, false);
  inventory(game);
});

void test('no-Skills native Richese pair at a revealed nested site is capped by reserves spent through four actual earlier shipments, not virtual materialization', () => {
  const f = programme({ family: 'choam', advanced: true, skills: false, discovery: true, tech: true, strongholds: true });
  let game = f.game;
  // Keep the genuinely drawn matching singleton while four ordinary markers
  // consume 5 + 3 + 5 + 3 physical native counters through their actual seats.
  for (const [index, value] of [5, 3, 5, 3].entries()) {
    const turn = index + 2;
    if (turn > 2) {
      game = advance(game, g => g.turn === turn && g.phase === 1 && clean(g));
      // Only unused land faces are conserved; held Nexus, played worms and
      // custody remain untouched. Two owned strongholds do not win the game.
      const lands = game.spiceDeck.filter(c => 'territory' in c && !c.discovery).slice(0, 2);
      for (const [position, card] of lands.entries())
        game.spiceDeck.splice(position, 0, game.spiceDeck.splice(game.spiceDeck.indexOf(card), 1)[0]);
    }
    game = atMovement(game, f.owner, turn);
    const destination = ['sietch_tabr', 'habbanya_ridge_sietch'].map(id => territory(id))
      .find(t => !t.sectors.includes(game.storm) && game.players.filter(p => p.id !== f.owner)
        .every(p => Object.entries(p.forces).every(([key, amount]) => !amount || !key.startsWith(`${t.id}:`)))); assert.ok(destination);
    const p = player(game, f.owner), token = p.noField!.tokens.find(t => t.value === value)!;
    game = settle(step(game, { actor: f.owner, action: { type: 'ship', territory: destination.id,
      sector: destination.sectors[0], noField: token.id, event: p.noFieldEvent, allyPayment: 0 } }));
    game = step(game, { actor: f.owner, action: { type: 'revealNoField', token: token.id, event: player(game, f.owner).noFieldEvent } });
    assert.equal(game.nexusCards!.cards!.hands[f.owner], 'richese');
    inventory(game);
  }
  game = advance(game, g => g.turn === 6 && g.phase === 1 && clean(g));
  const lands = game.spiceDeck.filter(c => 'territory' in c && !c.discovery).slice(0, 2);
  for (const [position, card] of lands.entries())
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(game.spiceDeck.indexOf(card), 1)[0]);
  game = advance(game, g => g.turn === 6 && g.phase === 2 && clean(g));
  game = step(game, { actor: f.owner, action: { type: 'charity' } });
  game = atMovement(game, f.owner, 6);
  assert.equal(player(game, f.owner).reserves, 4);
  const p = player(game, f.owner), offer = viewGame(game, f.owner).nexusRicheseCunning; assert.ok(offer && !offer.blocked);
  const hidden = p.noField!.tokens.find(t => t.value === 5)!;
  const action: Action = { type: 'ship', territory: 'shrine', sector: 0, allyPayment: 0,
    noField: hidden.id, revealedToken: p.noField!.tokens.find(t => t.value === 0)!.id,
    event: p.noFieldEvent, nexus: offer.event };
  const before = structuredClone(game);
  game = settle(step(game, { actor: f.owner, action }));
  assert.equal(player(game, f.owner).forces['shrine:0'] ?? 0, 0);
  assert.equal(player(game, f.owner).reserves, 4);
  assert.equal(player(game, f.owner).noField!.deployed!.tokenId, hidden.id);
  assert.equal(game.nexusCards!.cards!.hands[f.owner], null);
  assert.equal(player(game, f.owner).spice, player(before, f.owner).spice - 1);
  assert.equal(player(game, f.guild).spice, player(before, f.guild).spice + 1);
  reject(game, f.owner, action);
  const shipped = structuredClone(game);
  game = step(JSON.parse(JSON.stringify(game)) as Game, { actor: f.owner,
    action: { type: 'revealNoField', token: hidden.id, event: player(game, f.owner).noFieldEvent } });
  assert.equal(player(game, f.owner).forces['shrine:0'], 4);
  assert.equal(player(game, f.owner).spice, player(shipped, f.owner).spice);
  assert.equal(player(game, f.guild).spice, player(shipped, f.guild).spice);
  assert.equal(player(game, f.owner).reserves, 0);
  assert.equal(player(game, f.owner).noField!.lastShipped, hidden.id);
  inventory(game);
});
