import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame } from '../game/engine';
import type { Action, Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { ownedTech } from '../game/tech-tokens';
import { nexusFaceDancersAction } from '../game/nexus-tleilaxu-options';
import type { BattleResolutionQuote } from '../game/battle-resolution-quote';
import {
  advanceSingleNexusE1 as advance, createSingleNexusE1Programme as programme,
  finishSingleNexusE1Battle as finish, openSingleNexusE1Battle as open,
  quoteSingleNexusE1Battle as quote, revealSingleNexusE1Plans as plans,
  settleSingleNexusE1 as settle, shipSingleNexusE1 as ship, singleNexusE1Army as army,
  singleNexusE1Clean as clean, singleNexusE1Inventory as inventory, singleNexusE1Leader as leader,
  singleNexusE1Player as player, singleNexusE1Reload as reload, stepSingleNexusE1 as step,
} from './fixture-single-nexus-e1';

function reject(g: Game, actor: string, action: Action): void {
  const before = reload(g);
  assert.throws(() => applyAction(g, actor, action));
  assert.deepEqual(g, before, 'A rejected consumer cannot spend stock, move custody or debit payment.');
}
/** All four minimal saved difficulties consume their own real window after JSON continuation. */
function policies(g: Game, actor: string, select: (action: Action) => boolean,
  outcome: (after: Game, action: Action) => void): void {
  for (const difficulty of DIFFICULTIES) {
    const saved = reload(g); player(saved, actor).bot = difficulty;
    const action = botActions(viewGame(reload(saved), actor)).find(select);
    assert.ok(action, `${difficulty} consumes its original owned window`);
    const after = step(reload(saved), { actor, action }); outcome(after, action);
    if (after.status === 'playing') inventory(after);
  }
}
function movement(g: Game, actor: string, turn = 2): Game {
  return advance(g, s => s.turn === turn && s.phase === 5 && s.active === actor && clean(s));
}
function cunning(g: Game, owner: string, foreign: string): Game {
  const offer = viewGame(g, owner).nexusSuboids?.offer; assert.ok(offer && !offer.blocked);
  const action: Action = { type: 'nexusSuboids', event: offer.event };
  reject(g, foreign, action); reject(g, owner, { ...action, event: 'previous-battle' });
  policies(g, owner, a => a.type === 'nexusSuboids', after => {
    const resolved = settle(after);
    assert.equal(resolved.nexusCards!.cards!.hands[owner], null);
    assert.equal(resolved.nexusCards!.cards!.discard.filter(c => c === 'ixians').length, 1);
    assert.deepEqual(player(resolved, owner).forces, player(g, owner).forces);
    assert.equal(viewGame(resolved, owner).battle!.ownForces!.normalFreeSupport, true);
    assert.equal(player(resolved, owner).spice, player(g, owner).spice);
  });
  const after = settle(step(reload(g), { actor: owner, action })); reject(after, owner, action); return after;
}
function moneyAtHeldBoundary(before: Game, after: Game, receipt: BattleResolutionQuote): void {
  for (const p of before.players) {
    const debit = receipt.payments.filter(q => q.player === p.id).reduce((n, q) => n + q.ownPayment, 0);
    const bounty = receipt.bounty?.player === p.id ? receipt.bounty.amount : 0;
    const held = receipt.strongholdIncome.filter(q => q.player === p.id).reduce((n, q) => n + q.amount, 0);
    assert.equal(player(after, p.id).spice, p.spice - debit + bounty + held,
      'Only the held source pays support/bounty/industry; ordinary Collection has not run.');
  }
}

void test('single Ixian bare Nexus Skills lets a surviving original Smuggler collect the printed board spice without another module', () => {
  const f = programme({ native: 'ixians', advanced: true, skills: true, collectorSkill: 'smuggler' });
  assert.ok(f.trainer);
  const pile = Object.entries(f.game.spice).find(([key, amount]) => key.startsWith('rock_outcroppings:') && amount > 0);
  assert.ok(pile);
  const needed = new Set([f.owner, f.guild]);
  let g = reload(f.game);
  while (needed.size) {
    g = advance(g, s => s.phase === 5 && clean(s) && needed.has(s.active!));
    const actor = g.active!;
    g = ship(g, actor, 'rock_outcroppings', 2).after;
    needed.delete(actor);
    if (needed.size) g = step(g, { actor, action: { type: 'endMovement' } });
  }
  g = open(g, f.owner, f.guild, 'rock_outcroppings');
  const purse = player(g, f.owner).spice;
  g = plans(g, [
    { actor: f.owner, action: { type: 'battlePlan', leader: f.trainer, dial: 0, support: 0 } },
    { actor: f.guild, action: { type: 'battlePlan', leader: leader(g, f.guild, true), dial: 0, support: 0 } },
  ]);
  assert.equal(quote(g).winner, f.owner);
  const strength = player(g, f.owner).leaders.find(l => l.id === f.trainer)!.strength;
  g = finish(g);
  const receipt = g.lastBattleContext!.smugglerCollection;
  assert.ok(receipt);
  assert.equal(receipt.stage, 'collected');
  assert.equal(receipt.before, pile[1]);
  assert.equal(receipt.amount, Math.min(strength, pile[1]));
  assert.equal(g.spice[pile[0]], 0, 'Ordinary Collection harvests the remainder after the printed Smuggler amount.');
  assert.equal(player(g, f.owner).spice, purse + pile[1], 'The physical pile pays once across Smuggler and ordinary Collection.');
  assert.equal(player(g, f.owner).leaders.find(l => l.id === f.trainer)!.dead, false);
  inventory(g);
});

for (const skills of [false, true]) void test(`single Ixian ${skills ? 'all14' : 'no-Skills'} original offer, HMS and closing draw continue into native typed losses without a companion`, () => {
  const f = programme({ native: 'ixians', advanced: true, skills, homeworlds: true, tech: true, strongholds: true });
  assert.ok(f.ixOffer);
  const held = player(f.ixOffer.after, f.owner).hand;
  assert.equal(held.length, 1); assert.equal(held[0].id, f.ixOffer.step.action.card);
  if (skills) {
    assert.ok(f.offered && f.trainer);
  }
  assert.equal(player(f.afterSetup, f.owner).forces['hidden_mobile_stronghold:0'], 6);
  assert.equal(player(f.afterSetup, f.owner).elites!.forces['hidden_mobile_stronghold:0'], 3);
  assert.equal(player(f.alliance, f.guild).ally, f.fremen);
  assert.equal(player(f.alliance, f.fremen).ally, f.guild);
  policies(f.draw.before, f.owner, a => a.type === 'nexusCardChoice', after => {
    assert.equal(after.nexusCards!.cards!.hands[f.owner], 'ixians');
    assert.deepEqual(after.homeworlds!.custody, f.draw.before.homeworlds!.custody);
    assert.equal(player(after, f.owner).spice, player(f.draw.before, f.owner).spice);
  });
  reject(f.draw.after, f.owner, f.draw.step.action);
  const arrival = ship(movement(f.game, f.guild), f.guild, 'homeworld:ixians', 3);
  assert.deepEqual(army(arrival.after, f.guild, 'homeworld:ixians'), { normal: 3, elite: 0 });
  assert.deepEqual(army(arrival.after, f.guild, 'homeworld:guild'), {
    normal: army(arrival.before, f.guild, 'homeworld:guild').normal - 3, elite: 0,
  });
  assert.ok(player(arrival.after, f.guild).spice < player(arrival.before, f.guild).spice,
    'A genuine off-planet native source shipment pays its original invoice.');
  reject(arrival.after, f.guild, arrival.step.action);
  let g = cunning(open(arrival.after, f.owner, f.guild, 'homeworld:ixians'), f.owner, f.guild);
  const before = reload(g), lostTech = ownedTech(g.techTokens, f.guild);
  g = plans(g, [{ actor: f.owner, action: { type: 'battlePlan', leader: skills ? f.trainer! : leader(g, f.owner, true), dial: 3, support: 0 } },
    { actor: f.guild, action: { type: 'battlePlan', leader: leader(g, f.guild), dial: 0, support: 0 } }]);
  const receipt = quote(g); assert.equal(receipt.winner, f.owner);
  assert.equal(receipt.payments.find(p => p.player === f.owner)!.ownPayment, 0);
  assert.equal(player(g, f.owner).spice, player(before, f.owner).spice);
  if (skills) {
    g = advance(g, s => s.decision?.kind === 'sukRescue');
    const d = g.decision; assert.ok(d?.kind === 'sukRescue');
    const choice = d.options.findIndex(o => o.normal === 0 && o.elite === 1 && o.kept?.kind === 'elite'); assert.ok(choice >= 0);
    const rescue: Action = { type: 'decision', event: d.event, choice };
    reject(g, f.guild, rescue); reject(g, f.owner, { ...rescue, event: 'old-rescue' });
    policies(g, f.owner, a => a.type === 'decision' && a.choice !== undefined, (after, action) => {
      const saved = d.options[Number(action.choice)];
      assert.equal(player(after, f.owner).tanks, player(g, f.owner).tanks + 3 - saved.normal - saved.elite);
      assert.equal(player(after, f.owner).elites!.tanks, player(g, f.owner).elites!.tanks + 3 - saved.elite);
      assert.equal(player(after, f.owner).spice, player(g, f.owner).spice);
    });
    g = step(reload(g), { actor: f.owner, action: rescue });
  }
  g = advance(g, s => s.decision?.kind === 'ixSubstitution');
  const remaining = skills ? 2 : 3;
  assert.equal(player(g, f.owner).elites!.tanks, player(before, f.owner).elites!.tanks + remaining);
  assert.deepEqual(g.pendingIxSubstitution!.losses, { 'homeworld:ixians': remaining });
  if (skills) {
    assert.deepEqual(g.lastBattleContext!.sukRescue!.physical!.saved, { normal: 0, elite: 1 });
    assert.deepEqual(g.lastBattleContext!.sukRescue!.physical!.tanks, { normal: 0, elite: 2 });
  }
  const residual = reload(g), pool = army(g, f.owner, 'homeworld:ixians');
  const exchange: Action = { type: 'decision', sources: { 'homeworld:ixians': 1 }, recover: { 'homeworld:ixians': 1 } };
  reject(g, f.guild, exchange);
  reject(g, f.owner, { ...exchange, recover: { 'homeworld:ixians': remaining + 1 } });
  reject(g, f.owner, { ...exchange, sources: { reserves: 1 } });
  reject(g, f.owner, { ...exchange, recover: { 'homeworld:tleilaxu': 1 } });
  policies(g, f.owner, a => a.type === 'decision' && (a.sources !== undefined || a.decline === true), (after, action) => {
    const count = action.decline ? 0 : Object.values(action.recover as Record<string, number>).reduce((n, f) => n + f, 0);
    assert.equal(player(after, f.owner).elites!.tanks, player(residual, f.owner).elites!.tanks - count);
    assert.deepEqual(army(after, f.owner, 'homeworld:ixians'), { normal: pool.normal - count, elite: pool.elite + count });
    assert.equal(player(after, f.owner).spice, player(residual, f.owner).spice);
  });
  g = step(reload(g), { actor: f.owner, action: exchange });
  assert.deepEqual(army(g, f.owner, 'homeworld:ixians'), { normal: pool.normal - 1, elite: pool.elite + 1 });
  assert.equal(player(g, f.owner).elites!.tanks, player(residual, f.owner).elites!.tanks - 1);
  assert.equal(player(g, f.owner).tanks, player(residual, f.owner).tanks);
  reject(g, f.owner, exchange); g = finish(g);
  assert.deepEqual(army(g, f.guild, 'homeworld:ixians'), { normal: 0, elite: 0 });
  assert.equal(player(g, f.guild).tanks, player(before, f.guild).tanks + 3);
  for (const token of lostTech) assert.equal(g.techTokens![token].owner, f.owner);
  reject(g, f.guild, { type: 'nexusFaceDancers', event: g.lastBattleContext!.event }); inventory(g);
});

void test('single Ixian visitor rescue remains source-local: a native free strength bonus cannot waive visitor paid support or create a borrowed return', () => {
  const f = programme({ native: 'ixians', advanced: true, skills: true, homeworlds: true, tech: true, strongholds: true });
  assert.ok(f.trainer);
  const arrival = ship(movement(f.game, f.owner), f.owner, 'homeworld:guild', 4, 3);
  const homeBefore = army(arrival.after, f.owner, 'homeworld:ixians');
  let g = cunning(open(arrival.after, f.owner, f.guild, 'homeworld:guild'), f.owner, f.guild);
  const before = reload(g);
  g = plans(g, [{ actor: f.owner, action: { type: 'battlePlan', leader: f.trainer, dial: 3, support: 0 } },
    { actor: f.guild, action: { type: 'battlePlan', leader: leader(g, f.guild), dial: 1, support: 1 } }]);
  const receipt = quote(g), payment = receipt.payments.find(p => p.player === f.guild)!;
  assert.equal(payment.ownPayment, 1); assert.equal(receipt.winner, f.owner);
  g = advance(g, s => s.decision?.kind === 'sukRescue'); moneyAtHeldBoundary(before, g, receipt);
  const d = g.decision; assert.ok(d?.kind === 'sukRescue');
  const choice = d.options.findIndex(o => o.normal === 0 && o.elite === 1 && o.kept?.kind === 'elite'); assert.ok(choice >= 0);
  reject(g, f.owner, { type: 'decision', event: d.event, choice, destinations: { 'homeworld:ixians': { normal: 0, elite: 1 } } });
  g = step(reload(g), { actor: f.owner, action: { type: 'decision', event: d.event, choice } });
  g = advance(g, s => s.decision?.kind === 'ixSubstitution');
  const physical = g.lastBattleContext!.sukRescue!.physical!;
  assert.equal(physical.source, 'visitor-homeworld'); assert.deepEqual(physical.destinations, {});
  assert.deepEqual(physical.saved, { normal: 0, elite: 1 }); assert.deepEqual(physical.tanks, { normal: 0, elite: 2 });
  assert.deepEqual(army(g, f.owner, 'homeworld:ixians'), homeBefore, 'The kept rescued Cyborg never returns through an absent companion.');
  const pool = army(g, f.owner, 'homeworld:guild'), beforeExchange = reload(g);
  const exchange: Action = { type: 'decision', sources: { 'homeworld:guild': 1 }, recover: { 'homeworld:guild': 1 } };
  reject(g, f.owner, { ...exchange, sources: { 'homeworld:ixians': 1 } });
  g = step(reload(g), { actor: f.owner, action: exchange });
  assert.deepEqual(army(g, f.owner, 'homeworld:guild'), { normal: pool.normal - 1, elite: pool.elite + 1 });
  assert.deepEqual(army(g, f.owner, 'homeworld:ixians'), homeBefore);
  assert.equal(player(g, f.owner).spice, player(beforeExchange, f.owner).spice);
  g = finish(g); inventory(g);
});

for (const skills of [false, true]) void test(`single Ixian ${skills ? 'trained' : 'untrained'} original Discovery reveal/free entry and nested losses retain both-pile closing and physical cleanup`, () => {
  const f = programme({ native: 'ixians', advanced: true, skills, homeworlds: true, discovery: true, tech: true, strongholds: true });
  assert.ok(f.firstArrival && f.reveal && f.entry && f.vote && f.ride);
  const entered = army(f.entry.after, f.owner, 'shrine'); assert.deepEqual(entered, { normal: 1, elite: 1 });
  assert.deepEqual(f.entry.after.homeworlds!.custody, f.entry.before.homeworlds!.custody);
  assert.equal(player(f.entry.after, f.owner).spice, player(f.entry.before, f.owner).spice);
  assert.ok(f.entry.before.spiceDiscard[0].length && f.entry.before.spiceDiscard[1].length,
    'The actual Advanced Spice sequence uses both piles before the owned entry.');
  reject(f.entry.before, f.guild, f.entry.step.action);
  reject(f.entry.before, f.owner, { ...f.entry.step.action, event: 'stale-entry' });
  policies(f.entry.before, f.owner, a => a.type === 'decision' && a.accept === false, after => {
    assert.deepEqual(army(after, f.owner, 'shrine'), { normal: 0, elite: 0 });
    assert.deepEqual(player(after, f.owner).forces, player(f.entry!.before, f.owner).forces);
    assert.equal(player(after, f.owner).spice, player(f.entry!.before, f.owner).spice);
  });
  assert.equal(player(f.ride.after, f.fremen).reserves, player(f.ride.before, f.fremen).reserves - 2);
  assert.equal(player(f.ride.after, f.fremen).elites!.reserves, player(f.ride.before, f.fremen).elites!.reserves - 1);
  assert.equal(player(f.ride.after, f.fremen).spice, player(f.ride.before, f.fremen).spice);
  const needed = new Set([f.owner, f.guild]); let g = reload(f.game);
  while (needed.size) {
    g = advance(g, s => s.phase === 5 && clean(s) && needed.has(s.active!)); const actor = g.active!;
    g = ship(g, actor, 'shrine', 3, actor === f.owner ? 2 : 0).after; needed.delete(actor);
    if (needed.size) g = step(g, { actor, action: { type: 'endMovement' } });
  }
  g = cunning(open(g, f.owner, f.guild, 'shrine'), f.owner, f.guild);
  const worthless = player(g, f.owner).hand.find(c => c.kind === 'worthless'); assert.ok(worthless);
  const before = reload(g), lostTech = ownedTech(g.techTokens, f.guild);
  g = plans(g, [{ actor: f.owner, action: { type: 'battlePlan', leader: skills ? f.trainer! : leader(g, f.owner, true), dial: 3, support: 0, weapon: worthless.id } },
    { actor: f.guild, action: { type: 'battlePlan', leader: leader(g, f.guild), dial: 0, support: 0 } }]);
  const receipt = quote(g);
  if (skills) {
    g = advance(g, s => s.decision?.kind === 'sukRescue'); moneyAtHeldBoundary(before, g, receipt);
    const d = g.decision; assert.ok(d?.kind === 'sukRescue');
    const choice = d.options.findIndex(o => o.normal === 0 && o.elite === 1 && o.kept?.kind === 'elite'); assert.ok(choice >= 0);
    g = step(reload(g), { actor: f.owner, action: { type: 'decision', event: d.event, choice } });
  }
  g = advance(g, s => s.decision?.kind === 'ixSubstitution');
  assert.deepEqual(g.pendingIxSubstitution!.losses, { 'shrine:0': skills ? 2 : 3 });
  const residual = reload(g), pool = army(g, f.owner, 'shrine');
  const exchange: Action = { type: 'decision', sources: { 'shrine:0': 1 }, recover: { 'shrine:0': 1 } };
  reject(g, f.owner, { ...exchange, recover: { 'homeworld:ixians': 1 } });
  g = step(reload(g), { actor: f.owner, action: exchange });
  assert.deepEqual(army(g, f.owner, 'shrine'), { normal: pool.normal - 1, elite: pool.elite + 1 });
  assert.equal(player(g, f.owner).elites!.tanks, player(residual, f.owner).elites!.tanks - 1);
  assert.equal(player(g, f.owner).tanks, player(residual, f.owner).tanks);
  g = advance(g, s => s.decision?.kind === 'battleCards');
  for (const token of lostTech) assert.equal(g.techTokens![token].owner, f.guild);
  policies(g, f.owner, a => a.type === 'decision' && a.discard !== undefined, (after, action) => {
    const discarded = (action.discard as string[]).includes(worthless.id);
    assert.equal(player(after, f.owner).hand.some(c => c.id === worthless.id), !discarded);
    assert.equal(after.discard.some(c => c.id === worthless.id), discarded);
  });
  g = step(reload(g), { actor: f.owner, action: { type: 'decision', discard: [worthless.id] } }); g = finish(g);
  assert.equal(g.discard.filter(c => c.id === worthless.id).length, 1);
  for (const token of lostTech) assert.equal(g.techTokens![token].owner, f.owner);
  assert.equal(player(g, f.guild).tanks, player(before, f.guild).tanks + 3);
  assert.deepEqual(army(g, f.guild, 'shrine'), { normal: 0, elite: 0 }); inventory(g);
});

for (const skills of [false, true]) void test(`single Tleilaxu ${skills ? 'all14' : 'no-Skills'} actual original matching Face Dancer and Cunning refresh do not manufacture Cyborgs`, () => {
  const f = programme({ native: 'tleilaxu', advanced: true, skills, homeworlds: true, discovery: true, tech: true, strongholds: true });
  assert.ok(f.entry);
  if (skills) {
    assert.ok(f.offered);
    const foreign = viewGame(f.offered, f.guild).leaderSkills!, pending = structuredClone(foreign.offer!);
    assert.ok(pending && foreign.eligibleLeaders.length);
    reject(f.offered, f.owner, { type: 'leaderSkill', event: pending.event, skill: pending.cards[0],
      leader: foreign.eligibleLeaders[0].id });
  }
  const arrival = ship(movement(f.game, f.owner), f.owner, 'shrine', 2);
  let g = open(arrival.after, f.owner, f.guild, 'shrine');
  const winner = f.dancerLeader, nativeSkill = reload(g).leaderSkills?.assignments.find(a => a.owner === f.owner);
  assert.ok(player(g, f.owner).faceDancers!.some(c => c.leader === winner && !c.revealed));
  const worthless = player(g, f.guild).hand.find(c => c.kind === 'worthless'); assert.ok(worthless);
  g = plans(g, [{ actor: f.guild, action: { type: 'battlePlan', leader: winner, dial: 0, support: 0, weapon: worthless.id } },
    { actor: f.owner, action: { type: 'battlePlan', leader: leader(g, f.owner), dial: 0, support: 0 } }]);
  assert.equal(quote(g).winner, f.guild);
  g = advance(g, s => s.decision?.kind === 'battleCards');
  assert.equal(g.techTokens!.axlotl.owner, f.owner);
  g = step(reload(g), { actor: f.guild, action: { type: 'decision', discard: [worthless.id] } });
  g = advance(g, s => s.decision?.kind === 'faceDance');
  assert.equal(g.techTokens!.axlotl.owner, f.guild);
  assert.equal(g.discard.filter(c => c.id === worthless.id).length, 1);
  const before = reload(g), survivor = army(g, f.guild, 'shrine'), nativeHome = army(g, f.owner, 'homeworld:tleilaxu');
  const dance: Action = { type: 'decision', reveal: true, sources: { reserves: 1 }, sector: 0 };
  reject(g, f.guild, dance); reject(g, f.owner, { ...dance, sources: { reserves: survivor.normal + 1 } });
  reject(g, f.owner, { ...dance, sources: { 'homeworld:ixians': 1 } });
  policies(g, f.owner, a => a.type === 'decision' && a.reveal !== undefined, (after, action) => {
    const count = action.reveal ? Object.values((action.sources ?? {}) as Record<string, number>).reduce((n, f) => n + f, 0) : 0;
    assert.equal(player(after, f.guild).leaders.find(l => l.id === winner)!.dead, !!action.reveal);
    assert.equal(player(after, f.owner).faceDancers!.find(c => c.leader === winner)!.revealed, !!action.reveal);
    assert.deepEqual(army(after, f.guild, 'shrine'), action.reveal ? { normal: 0, elite: 0 } : survivor);
    assert.equal(army(after, f.owner, 'shrine').normal, count);
    assert.deepEqual(after.techTokens, before.techTokens);
    assert.equal(player(after, f.owner).spice, player(before, f.owner).spice);
  });
  g = step(reload(g), { actor: f.owner, action: dance });
  assert.deepEqual(army(g, f.guild, 'shrine'), { normal: 0, elite: 0 });
  assert.equal(player(g, f.guild).reserves, player(before, f.guild).reserves + survivor.normal);
  assert.deepEqual(army(g, f.owner, 'shrine'), { normal: 1, elite: 0 });
  assert.deepEqual(army(g, f.owner, 'homeworld:tleilaxu'), { normal: nativeHome.normal - 1, elite: 0 });
  assert.deepEqual(g.techTokens, before.techTokens);
  if (skills) {
    assert.equal(g.leaderSkills!.assignments.some(a => a.leader === winner), false);
    assert.equal(g.leaderSkills!.deck.filter(s => s === 'suk-graduate').length, 1);
    const observer = g.leaderSkills!.assignments.find(a => a.owner === f.owner);
    assert.equal(observer?.leader, nativeSkill?.leader);
    assert.equal(observer?.skill, nativeSkill?.skill, 'Foreign disc death cannot retire the native observer’s training.');
  }
  reject(g, f.owner, dance);
  const offer = viewGame(g, f.owner).nexusTleilaxu?.cunning; assert.ok(offer && !offer.blocked);
  const refresh = nexusFaceDancersAction(viewGame(g, f.owner), offer.event); assert.ok(refresh);
  const reserve = [...g.traitorReserve!], stock = structuredClone(player(g, f.owner).faceDancers!);
  const untouched = stock.filter(c => !c.revealed), allowance = player(g, f.owner).faceDancerReplacedTurn;
  reject(g, f.guild, refresh); reject(g, f.owner, { ...refresh, event: 'old-refresh' });
  reject(g, f.owner, { ...refresh, leaders: [winner] });
  policies(g, f.owner, a => a.type === 'nexusFaceDancers', after => {
    assert.deepEqual(player(after, f.owner).faceDancers!.filter(c => untouched.some(old => old.leader === c.leader)), untouched);
    assert.deepEqual(player(after, f.owner).faceDancers!.filter(c => !untouched.some(old => old.leader === c.leader)), [{ leader: reserve[0], revealed: false }]);
    assert.deepEqual([...after.traitorReserve!].sort(), [...reserve.slice(1), winner].sort());
    assert.equal(player(after, f.owner).faceDancerReplacedTurn, allowance);
    assert.equal(after.nexusCards!.cards!.hands[f.owner], null);
    assert.deepEqual(after.techTokens, g.techTokens);
    assert.deepEqual(army(after, f.owner, 'shrine'), { normal: 1, elite: 0 });
    assert.equal(player(after, f.owner).spice, player(g, f.owner).spice);
  });
  g = step(reload(g), { actor: f.owner, action: refresh }); reject(g, f.owner, refresh); g = finish(g); inventory(g);
});

for (const skills of [false, true]) void test(`single Tleilaxu ${skills ? 'trained' : 'untrained'} native paid support, real leader death and own discounted revival preserve original disc identity`, () => {
  const f = programme({ native: 'tleilaxu', advanced: true, skills, homeworlds: true, tech: true,
    startingKinds: ['projectile', 'projectile', 'worthless'] });
  const arrival = ship(movement(f.game, f.guild), f.guild, 'homeworld:tleilaxu', 3);
  let g = open(arrival.after, f.owner, f.guild, 'homeworld:tleilaxu');
  const own = skills ? g.leaderSkills!.assignments.find(a => a.owner === f.owner)!.leader : leader(g, f.owner, true);
  const foreign = leader(g, f.guild), nativeAssignment = g.leaderSkills?.assignments.find(a => a.owner === f.owner);
  const foreignAssignment = structuredClone(g.leaderSkills?.assignments.find(a => a.owner === f.guild));
  const ownWeapon = player(g, f.owner).hand.find(c => c.kind === 'projectile')!.id;
  const enemyWeapon = player(g, f.guild).hand.find(c => c.kind === 'projectile')!.id;
  const before = reload(g);
  g = plans(g, [{ actor: f.owner, action: { type: 'battlePlan', leader: own, dial: 1, support: 1, weapon: ownWeapon } },
    { actor: f.guild, action: { type: 'battlePlan', leader: foreign, dial: 0, support: 0, weapon: enemyWeapon } }]);
  const receipt = quote(g); assert.equal(receipt.payments.find(p => p.player === f.owner)!.ownPayment, 1);
  assert.equal(player(g, f.owner).spice, player(before, f.owner).spice, 'Plans do not prepay even with native free strength.');
  g = advance(g, s => s.decision?.kind === 'battleCards'); moneyAtHeldBoundary(before, g, receipt);
  assert.equal(player(g, f.owner).leaders.find(l => l.id === own)!.dead, true);
  assert.equal(player(g, f.guild).leaders.find(l => l.id === foreign)!.dead, true);
  assert.equal(player(g, f.owner).tanks, player(before, f.owner).tanks + 1);
  assert.equal(player(g, f.guild).tanks, player(before, f.guild).tanks + 3);
  if (skills) {
    assert.equal(g.leaderSkills!.assignments.some(a => a.leader === own), false);
    assert.equal(g.leaderSkills!.deck.filter(s => s === nativeAssignment!.skill).length, 1);
    const foreignTraining = g.leaderSkills!.assignments.find(a => a.owner === f.guild);
    assert.equal(foreignTraining?.leader, foreignAssignment?.leader);
    assert.equal(foreignTraining?.skill, foreignAssignment?.skill);
  }
  g = step(reload(g), { actor: f.owner, action: { type: 'decision', discard: [ownWeapon] } }); g = finish(g);
  assert.equal(g.discard.filter(c => c.id === ownWeapon).length, 1);
  g = advance(g, s => s.turn === 3 && s.phase === 4 && clean(s));
  const revivalBefore = reload(g), offer = viewGame(g, f.owner).revival.leaders.find(l => l.id === own); assert.ok(offer && offer.affordable);
  const revive: Action = { type: 'reviveLeader', leader: own };
  reject(g, f.guild, revive); reject(g, f.owner, { ...revive, leader: f.dancerLeader });
  const revived = (state: Game): Game => advance(state, s => !s.pendingRevival && !s.response && !s.phaseOpening &&
    (skills ? !!s.leaderSkills?.offers[f.owner] : !s.decision));
  policies(g, f.owner, a => a.type === 'reviveLeader' && a.leader === own, after => {
    const resolved = revived(after);
    assert.equal(player(resolved, f.owner).leaders.find(l => l.id === own)!.dead, false);
    assert.equal(player(resolved, f.owner).spice, player(revivalBefore, f.owner).spice - offer.cost);
    assert.deepEqual(resolved.homeworlds!.custody, revivalBefore.homeworlds!.custody);
    assert.equal(player(resolved, f.guild).leaders.some(l => l.id === own), false);
  });
  g = revived(step(reload(g), { actor: f.owner, action: revive })); reject(g, f.owner, revive);
  assert.equal(player(g, f.owner).spice, player(revivalBefore, f.owner).spice - offer.cost);
  if (skills) {
    const acceptance = viewGame(g, f.owner).leaderSkills!.offer!;
    const draw: Action = { type: 'leaderSkill', event: acceptance.event, mode: 'draw' };
    reject(g, f.guild, draw); reject(g, f.owner, { ...draw, event: 'old-revival' });
    const beforeDraw = reload(g);
    policies(g, f.owner, a => a.type === 'leaderSkill' && a.mode === 'draw', after => {
      assert.equal(after.leaderSkills!.offers[f.owner].cards.length, 2);
      assert.equal(after.leaderSkills!.deck.length, beforeDraw.leaderSkills!.deck.length - 2);
      assert.equal(player(after, f.owner).leaders.find(l => l.id === own)!.dead, false);
      assert.equal(player(after, f.owner).spice, player(beforeDraw, f.owner).spice);
    });
    g = step(g, { actor: f.owner, action: draw }); reject(g, f.owner, draw);
    const training = viewGame(g, f.owner).leaderSkills!; assert.equal(training.offer!.leader, own);
    const pending = reload(g).leaderSkills!.offers[f.owner];
    const skill = training.offer!.cards.find(s => !training.unavailableSkills?.[s]); assert.ok(skill);
    const train: Action = { type: 'leaderSkill', event: training.offer!.event, leader: own, skill };
    reject(g, f.guild, train); reject(g, f.owner, { ...train, leader: foreign });
    reject(g, f.owner, { ...train, event: 'former-native-training' });
    assert.deepEqual(g.leaderSkills!.offers[f.owner], pending, 'A foreign or stale training attempt cannot consume the owned revival offer.');
    policies(g, f.owner, a => a.type === 'leaderSkill', (after, action) => {
      assert.equal(after.leaderSkills!.assignments.find(a => a.owner === f.owner)!.leader, own);
      assert.equal(after.leaderSkills!.assignments.find(a => a.owner === f.owner)!.skill, action.skill);
      assert.equal(player(after, f.owner).spice, player(g, f.owner).spice);
      const foreignTraining = after.leaderSkills!.assignments.find(a => a.owner === f.guild);
      assert.equal(foreignTraining?.leader, foreignAssignment?.leader);
      assert.equal(foreignTraining?.skill, foreignAssignment?.skill);
    });
    g = step(reload(g), { actor: f.owner, action: train }); reject(g, f.owner, train);
    assert.equal(g.leaderSkills!.assignments.find(a => a.owner === f.owner)!.leader, own);
  }
  inventory(g);
});

void test('single native Tleilaxu cannot replace a real matching Guild winner in a foreign Homeworld battle', () => {
  const f = programme({ native: 'tleilaxu', advanced: false, skills: false, homeworlds: true, tech: true });
  assert.ok(player(f.afterSetup, f.owner).faceDancers!.some(c => c.leader === f.dancerLeader && !c.revealed));
  const arrival = ship(movement(f.game, f.owner), f.owner, 'homeworld:guild', 1);
  let g = open(arrival.after, f.owner, f.guild, 'homeworld:guild');
  g = plans(g, [{ actor: f.guild, action: { type: 'battlePlan', leader: f.dancerLeader, dial: 0, support: 0 } },
    { actor: f.owner, action: { type: 'battlePlan', leader: leader(g, f.owner), dial: 0, support: 0 } }]);
  assert.equal(quote(g).winner, f.guild); g = finish(g);
  const physical = army(g, f.guild, 'homeworld:guild');
  reject(g, f.owner, { type: 'decision', reveal: true, sources: { reserves: 1 }, sector: 0 });
  assert.equal(player(g, f.owner).faceDancers!.find(c => c.leader === f.dancerLeader)!.revealed, false);
  assert.equal(player(g, f.guild).leaders.find(l => l.id === f.dancerLeader)!.dead, false);
  assert.deepEqual(army(g, f.guild, 'homeworld:guild'), physical);
  assert.equal(player(g, f.owner).tanks, 1); inventory(g);
});
