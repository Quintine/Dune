import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame } from '../game/engine';
import type { Action, Game } from '../game/engine';
import { DIFFICULTIES } from '../game/bot-profiles';
import { ownedTech } from '../game/tech-tokens';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { CHOAM_AUDITOR_ID } from '../game/choam-auditor';
import { nativeHomeworldArmy } from './fixture-homeworld-native-e1e2-modules';
import {
  advanceSingleE2 as advance, createSingleE2Programme as programme,
  finishSingleE2Battle as finishBattle, openSingleE2Battle as openBattle,
  revealSingleE2Plans as revealPlans, settleSingleE2 as settle,
  shipSingleE2 as ship, singleE2Clean as clean, singleE2Cunning as cunning,
  singleE2Inventory as inventory, singleE2Leader as leader, singleE2Player as player,
  singleE2Policy as policy, singleE2Reload as reload, singleE2Step as step,
} from './fixture-single-nexus-e2';
import type { SingleNexusE2Programme } from './fixture-single-nexus-e2';

/** Every state begins at an original initializer. No physical force, held card,
 * purse, phase, training identity, alliance or outcome is assigned by a test. */
function reject(game: Game, actor: string, action: Action): void {
  const before = reload(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'Invalid consumers do not debit physical inventory or payments.');
}
function policies(game: Game, actor: string, select: (action: Action) => boolean,
  outcome: (after: Game, action: Action) => void): void {
  for (const difficulty of DIFFICULTIES) {
    const action = policy(game, actor, difficulty).find(select);
    assert.ok(action, `${difficulty} must consume its genuine owned window.`);
    const after = step(reload(game), { actor, action });
    outcome(after, action); inventory(after);
  }
}
function movement(game: Game, actor: string): Game {
  return advance(game, g => g.turn === 2 && g.phase === 5 && g.active === actor && clean(g));
}
function collectionIncome(game: Game, actor: string): number {
  if (game.phase !== 7 || !clean(game)) return 0;
  const row = quoteSpiceCollection(game).receipts.find(r => r.player === actor);
  return (row?.strongholds ?? 0) + (row?.collected ?? 0);
}
function originalClosing(f: SingleNexusE2Programme): void {
  assert.equal(player(f.alliance, 'guild').ally, 'fremen');
  assert.equal(player(f.alliance, 'fremen').ally, 'guild');
  assert.ok(!player(f.alliance, f.owner).ally);
  assert.equal(f.draw.after.nexusCards!.cards!.hands[f.owner], player(f.draw.after, f.owner).faction);
  assert.deepEqual(player(f.draw.after, f.owner).forces, player(f.draw.before, f.owner).forces);
  policies(f.draw.before, f.owner, a => a.type === 'nexusCardChoice', after => {
    assert.equal(after.nexusCards!.cards!.hands[f.owner], player(after, f.owner).faction);
  });
  if (f.entry) {
    assert.equal(player(f.entry.after, 'guild').forces['shrine:0'], 3);
    assert.equal(player(f.entry.after, 'guild').spice, player(f.entry.before, 'guild').spice);
    assert.deepEqual(f.entry.after.homeworlds, f.entry.before.homeworlds);
    policies(f.entry.before, 'guild', a => a.type === 'decision' && a.accept === false, after => {
      assert.deepEqual(player(after, 'guild').forces, player(f.entry!.before, 'guild').forces);
      assert.equal(player(after, 'guild').spice, player(f.entry!.before, 'guild').spice);
    });
    assert.ok(f.ride && f.vote);
    assert.equal(player(f.ride.after, 'fremen').reserves, player(f.ride.before, 'fremen').reserves - 2);
    assert.equal(player(f.ride.after, 'fremen').forces['polar_sink:0'], (player(f.ride.before, 'fremen').forces['polar_sink:0'] ?? 0) + 2);
    assert.equal(player(f.ride.after, 'fremen').spice, player(f.ride.before, 'fremen').spice);
  }
}

void test('single CHOAM Special fuels native Cunning once; visitor Suk delays only the other payer support income and original winner Tech', () => {
  const f = programme({ native: 'choam', advanced: true, skills: true, homeworlds: true,
    discovery: false, tech: true, strongholds: true, skill: 'suk-graduate', fuelKind: 'special' });
  originalClosing(f); assert.ok(f.trainer && f.offered);
  const offered = viewGame(f.offered, f.owner).leaderSkills!;
  assert.ok(offered.offer!.cards.includes('suk-graduate'));
  assert.ok(player(f.offered, f.owner).leaders.some(l => l.id === CHOAM_AUDITOR_ID));
  reject(f.offered, f.owner, { type: 'leaderSkill', event: offered.offer!.event,
    skill: 'suk-graduate', leader: CHOAM_AUDITOR_ID });
  let game = movement(f.game, f.owner);
  const fuel = player(game, f.owner).hand.find(c => c.kind === 'special' && c.effect !== 'karama'); assert.ok(fuel);
  const request = cunning(game, f.owner, fuel.id), beforeFuel = reload(game);
  reject(game, f.owner, { ...request, nexus: 'obsolete-choam' });
  reject(game, 'guild', request);
  reject(game, f.owner, { ...request, card: player(game, 'guild').hand[0].id });
  game = settle(step(game, { actor: f.owner, action: request }));
  assert.equal(player(game, f.owner).spice, player(beforeFuel, f.owner).spice);
  assert.equal(player(game, f.owner).hand.some(c => c.id === fuel.id), false);
  assert.equal(game.discard.filter(c => c.id === fuel.id).length, 1);
  assert.equal(game.nexusCards!.cards!.hands[f.owner], null);
  assert.equal(game.choamMovement!.bonus, (beforeFuel.choamMovement?.bonus ?? 0) + 1);
  reject(game, f.owner, request);
  game = ship(game, f.owner, 'homeworld:guild', 3);
  game = openBattle(game, f.owner, 'guild', 'homeworld:guild', true);
  const beforePlans = reload(game), lostTech = ownedTech(game.techTokens, 'guild');
  game = revealPlans(game, [
    { actor: f.owner, action: { type: 'battlePlan', leader: f.trainer, dial: 2, support: 2 } },
    { actor: 'guild', action: { type: 'battlePlan', leader: leader(game, 'guild'), dial: 2, support: 2 } },
  ]);
  assert.equal(player(game, f.owner).spice, player(beforePlans, f.owner).spice);
  game = advance(game, g => g.decision?.kind === 'sukRescue');
  assert.equal(player(game, f.owner).spice, player(beforePlans, f.owner).spice - 2);
  assert.equal(player(game, 'guild').spice, player(beforePlans, 'guild').spice - 2);
  assert.deepEqual(game.pendingChoamBattleIncome, { owner: f.owner, amount: 1 },
    'CHOAM excludes its own two support payments; only the opponent pays pending native income.');
  for (const token of lostTech) assert.equal(game.techTokens![token].owner, 'guild');
  const d = game.decision; assert.ok(d?.kind === 'sukRescue');
  const home = nativeHomeworldArmy(game, f.owner, 'homeworld:choam');
  const source = nativeHomeworldArmy(game, f.owner, 'homeworld:guild'), beforeRescue = reload(game);
  policies(game, f.owner, a => a.type === 'decision' && a.choice !== undefined, (after, action) => {
    const choice = d.options[Number(action.choice)], saved = choice.normal + choice.elite;
    assert.equal(player(after, f.owner).tanks, player(beforeRescue, f.owner).tanks + 2 - saved);
    assert.equal(player(after, f.owner).spice, player(beforeRescue, f.owner).spice +
      (after.pendingChoamBattleIncome ? 0 : 1) + collectionIncome(after, f.owner),
    'Rescue never refunds support; the original native income may settle only after its physical rescue.');
    const kept = choice.kept?.kind === 'normal' ? 1 : 0;
    assert.deepEqual(nativeHomeworldArmy(after, f.owner, 'homeworld:guild'), { normal: source.normal - 2 + kept, elite: 0 });
    assert.deepEqual(nativeHomeworldArmy(after, f.owner, 'homeworld:choam'), { normal: home.normal + choice.normal - kept, elite: 0 });
  });
  const choice = d.options.findIndex(o => o.normal === 1 && o.elite === 0 && o.kept?.kind === 'normal'); assert.ok(choice >= 0);
  const rescue: Action = { type: 'decision', event: d.event, choice };
  reject(game, 'guild', rescue); reject(game, f.owner, { ...rescue, event: 'obsolete-rescue' });
  game = step(reload(game), { actor: f.owner, action: rescue });
  game = finishBattle(game);
  assert.equal(game.lastBattleContext!.winner, f.owner);
  assert.equal(game.lastBattleContext!.sukRescue!.physical!.source, 'visitor-homeworld');
  assert.equal(player(game, f.owner).tanks, player(beforePlans, f.owner).tanks + 1);
  assert.deepEqual(nativeHomeworldArmy(game, f.owner, 'homeworld:guild'), { normal: 2, elite: 0 });
  assert.equal(player(game, f.owner).spice, player(beforePlans, f.owner).spice - 2 + 1 + collectionIncome(game, f.owner));
  for (const token of lostTech) assert.equal(game.techTokens![token].owner, f.owner);
  assert.equal(game.discard.filter(c => c.id === fuel.id).length, 1);
  reject(game, f.owner, rescue); inventory(game);
});

void test('single CHOAM Shield is distinct any-Treachery Cunning fuel without Skills; real Maker entry and nested support settle once', () => {
  const f = programme({ native: 'choam', advanced: true, skills: false, homeworlds: false,
    discovery: true, tech: true, strongholds: false, fuelKind: 'shield' });
  originalClosing(f);
  let game = movement(f.game, f.owner);
  const fuel = player(game, f.owner).hand.find(c => c.kind === 'shield'); assert.ok(fuel);
  const beforeFuel = reload(game), action = cunning(game, f.owner, fuel.id);
  game = settle(step(game, { actor: f.owner, action }));
  assert.equal(game.discard.filter(c => c.id === fuel.id).length, 1);
  assert.equal(player(game, f.owner).hand.some(c => c.id === fuel.id), false);
  assert.equal(player(game, f.owner).spice, player(beforeFuel, f.owner).spice);
  assert.equal(game.choamMovement!.bonus, 1); reject(game, f.owner, action);
  game = ship(game, f.owner, 'shrine', 3);
  game = openBattle(game, f.owner, 'guild', 'shrine');
  const beforePlans = reload(game), lostTech = ownedTech(game.techTokens, 'guild');
  game = revealPlans(game, [
    { actor: f.owner, action: { type: 'battlePlan', leader: leader(game, f.owner, true), dial: 2, support: 2 } },
    { actor: 'guild', action: { type: 'battlePlan', leader: leader(game, 'guild'), dial: 2, support: 2 } },
  ]);
  game = finishBattle(game);
  assert.equal(game.lastBattleContext!.winner, f.owner);
  assert.equal(player(game, f.owner).forces['shrine:0'], 1);
  assert.equal(player(game, f.owner).tanks, player(beforePlans, f.owner).tanks + 2);
  assert.equal(player(game, 'guild').tanks, player(beforePlans, 'guild').tanks + 3);
  assert.equal(player(game, f.owner).spice, player(beforePlans, f.owner).spice - 2 + 1 + collectionIncome(game, f.owner));
  assert.equal(player(game, 'guild').spice, player(beforePlans, 'guild').spice - 2 + collectionIncome(game, 'guild'));
  for (const token of lostTech) assert.equal(game.techTokens![token].owner, f.owner);
  inventory(game);
});

void test('Basic single Richese without Skills signs one nested invoice, exposes five before three and resolves real card custody without a CHOAM income owner', () => {
  const f = programme({ native: 'richese', advanced: false, skills: false,
    homeworlds: false, discovery: true, tech: true, strongholds: false });
  originalClosing(f); assert.ok(f.firstMarker);
  assert.equal(player(f.firstMarker.after, f.owner).spice, player(f.firstMarker.before, f.owner).spice - 1);
  assert.equal(player(f.firstMarker.after, f.owner).reserves, player(f.firstMarker.before, f.owner).reserves);
  let game = movement(f.game, f.owner), before = reload(game);
  const request = cunning(game, f.owner);
  reject(game, f.owner, { ...request, nexus: 'obsolete-richese' });
  reject(game, f.owner, { ...request, revealedToken: request.noField });
  reject(game, f.owner, { ...request, smuggler: true });
  reject(game, f.owner, { ...request, homeworldSources: { 'homeworld:richese': { normal: 5, elite: 0 } } });
  game = step(game, { actor: f.owner, action: request });
  game = settle(reload(game));
  assert.equal(player(game, f.owner).spice, player(before, f.owner).spice - 1);
  assert.equal(player(game, 'guild').spice, player(before, 'guild').spice + 1);
  assert.equal(player(game, f.owner).forces['shrine:0'], 5);
  assert.equal(player(game, f.owner).reserves, player(before, f.owner).reserves - 5);
  assert.equal(player(game, f.owner).noField!.deployed!.tokenId, request.noField);
  assert.equal(game.nexusRicheseCunningHistory!.at(-1)!.stage, 'shipped');
  assert.equal(game.nexusCards!.cards!.discard.filter(c => c === 'richese').length, 1);
  reject(game, f.owner, request);
  before = reload(game);
  const reveal: Action = { type: 'revealNoField', event: player(game, f.owner).noFieldEvent, token: request.noField };
  reject(game, f.owner, { ...reveal, event: 'obsolete-token' });
  game = step(reload(game), { actor: f.owner, action: reveal });
  assert.equal(player(game, f.owner).forces['shrine:0'], 8);
  assert.equal(player(game, f.owner).reserves, player(before, f.owner).reserves - 3);
  assert.equal(player(game, f.owner).spice, player(before, f.owner).spice);
  assert.equal(player(game, 'guild').spice, player(before, 'guild').spice);
  game = openBattle(game, f.owner, 'guild', 'shrine');
  const held = player(game, f.owner).hand.find(c => c.kind === 'worthless'); assert.ok(held);
  const beforePlans = reload(game), lostTech = ownedTech(game.techTokens, 'guild');
  game = revealPlans(game, [
    { actor: f.owner, action: { type: 'battlePlan', leader: leader(game, f.owner, true), dial: 2, support: 0, weapon: held.id } },
    { actor: 'guild', action: { type: 'battlePlan', leader: leader(game, 'guild'), dial: 0, support: 0 } },
  ]);
  game = advance(game, g => g.decision?.kind === 'battleCards');
  assert.equal(player(game, f.owner).spice, player(beforePlans, f.owner).spice);
  for (const token of lostTech) assert.equal(game.techTokens![token].owner, 'guild');
  const cleanup = reload(game);
  policies(game, f.owner, a => a.type === 'decision' && a.discard !== undefined, (after, action) => {
    const discarded = action.discard as string[];
    assert.equal(player(after, f.owner).hand.some(c => c.id === held.id), !discarded.includes(held.id));
    assert.equal(after.discard.some(c => c.id === held.id), discarded.includes(held.id));
    assert.equal(player(after, f.owner).spice, player(cleanup, f.owner).spice);
  });
  reject(game, 'guild', { type: 'decision', discard: [held.id] });
  game = step(reload(game), { actor: f.owner, action: { type: 'decision', discard: [held.id] } });
  game = finishBattle(game);
  assert.equal(game.lastBattleContext!.winner, f.owner);
  assert.equal(player(game, f.owner).forces['shrine:0'], 6);
  assert.equal(player(game, f.owner).tanks, player(beforePlans, f.owner).tanks + 2);
  assert.equal(game.discard.filter(c => c.id === held.id).length, 1);
  assert.equal(player(game, f.owner).hand.some(c => c.id === held.id), false);
  assert.equal(player(game, f.owner).spice, player(beforePlans, f.owner).spice + collectionIncome(game, f.owner));
  for (const token of lostTech) assert.equal(game.techTokens![token].owner, f.owner);
  inventory(game);
});

void test('Advanced single Richese original native supply funds a real nested pair; Suk rescue and held-card cleanup cannot repeat support or invent companion income', () => {
  const f = programme({ native: 'richese', advanced: true, skills: true, homeworlds: true,
    discovery: true, tech: true, strongholds: true, skill: 'suk-graduate' });
  originalClosing(f); assert.ok(f.trainer);
  let game = movement(f.game, f.owner), before = reload(game);
  const home = nativeHomeworldArmy(game, f.owner, 'homeworld:richese'), request = cunning(game, f.owner);
  assert.ok(home.normal >= 8, 'Only the actual remaining native supply can fund both markers.');
  reject(game, f.owner, { ...request, source: 'homeworld:guild' });
  reject(game, f.owner, { ...request, smugglerCompanion: true });
  reject(game, 'guild', request);
  game = settle(step(game, { actor: f.owner, action: request }));
  assert.equal(player(game, f.owner).spice, player(before, f.owner).spice - 1);
  assert.equal(player(game, 'guild').spice, player(before, 'guild').spice + 1);
  assert.deepEqual(nativeHomeworldArmy(game, f.owner, 'homeworld:richese'), { normal: home.normal - 5, elite: 0 });
  assert.equal(player(game, f.owner).forces['shrine:0'], 5);
  before = reload(game);
  game = step(reload(game), { actor: f.owner, action: { type: 'revealNoField',
    event: player(game, f.owner).noFieldEvent, token: request.noField } });
  assert.equal(player(game, f.owner).forces['shrine:0'], 8);
  assert.deepEqual(nativeHomeworldArmy(game, f.owner, 'homeworld:richese'), { normal: home.normal - 8, elite: 0 });
  assert.equal(player(game, f.owner).spice, player(before, f.owner).spice);
  game = openBattle(game, f.owner, 'guild', 'shrine', true);
  const held = player(game, f.owner).hand.find(c => c.kind === 'worthless'); assert.ok(held);
  const beforePlans = reload(game), lostTech = ownedTech(game.techTokens, 'guild');
  game = revealPlans(game, [
    { actor: f.owner, action: { type: 'battlePlan', leader: f.trainer, dial: 2, support: 2, weapon: held.id } },
    { actor: 'guild', action: { type: 'battlePlan', leader: leader(game, 'guild'), dial: 2, support: 2 } },
  ]);
  assert.equal(player(game, f.owner).spice, player(beforePlans, f.owner).spice);
  game = advance(game, g => g.decision?.kind === 'sukRescue');
  assert.equal(player(game, f.owner).spice, player(beforePlans, f.owner).spice - 2);
  assert.equal(player(game, 'guild').spice, player(beforePlans, 'guild').spice - 2);
  const d = game.decision; assert.ok(d?.kind === 'sukRescue');
  const nativeBeforeRescue = nativeHomeworldArmy(game, f.owner, 'homeworld:richese'), beforeRescue = reload(game);
  policies(game, f.owner, a => a.type === 'decision' && a.choice !== undefined, (after, action) => {
    const option = d.options[Number(action.choice)], kept = option.kept?.kind === 'normal' ? 1 : 0;
    assert.equal(player(after, f.owner).forces['shrine:0'], 6 + kept);
    assert.equal(player(after, f.owner).tanks, player(beforeRescue, f.owner).tanks + 2 - option.normal - option.elite);
    assert.deepEqual(nativeHomeworldArmy(after, f.owner, 'homeworld:richese'), { normal: nativeBeforeRescue.normal + option.normal - kept, elite: 0 });
    assert.equal(player(after, f.owner).spice, player(beforeRescue, f.owner).spice);
  });
  const choice = d.options.findIndex(o => o.normal === 2 && o.elite === 0 && o.kept?.kind === 'normal'); assert.ok(choice >= 0);
  const rescue: Action = { type: 'decision', event: d.event, choice };
  reject(game, f.owner, { ...rescue, event: 'obsolete-suk' });
  reject(game, f.owner, { ...rescue, destinations: { 'homeworld:guild': { normal: 2, elite: 0 } } });
  game = step(reload(game), { actor: f.owner, action: rescue });
  game = advance(game, g => g.decision?.kind === 'battleCards');
  assert.equal(player(game, f.owner).spice, player(beforePlans, f.owner).spice - 2);
  assert.equal(player(game, 'guild').spice, player(beforePlans, 'guild').spice - 2);
  assert.equal(player(game, f.owner).forces['shrine:0'], 7);
  assert.deepEqual(nativeHomeworldArmy(game, f.owner, 'homeworld:richese'), { normal: nativeBeforeRescue.normal + 1, elite: 0 });
  for (const token of lostTech) assert.equal(game.techTokens![token].owner, 'guild');
  reject(game, 'guild', { type: 'decision', discard: [held.id] });
  game = finishBattle(step(reload(game), { actor: f.owner, action: { type: 'decision', discard: [held.id] } }));
  assert.equal(game.lastBattleContext!.winner, f.owner);
  assert.equal(player(game, f.owner).tanks, player(beforePlans, f.owner).tanks);
  assert.equal(player(game, 'guild').tanks, player(beforePlans, 'guild').tanks + 3);
  assert.equal(game.discard.filter(c => c.id === held.id).length, 1);
  assert.equal(player(game, f.owner).spice, player(beforePlans, f.owner).spice - 2 + collectionIncome(game, f.owner));
  assert.equal(player(game, 'guild').spice, player(beforePlans, 'guild').spice - 2 + collectionIncome(game, 'guild'));
  for (const token of lostTech) assert.equal(game.techTokens![token].owner, f.owner);
  reject(game, f.owner, request); inventory(game);
});
