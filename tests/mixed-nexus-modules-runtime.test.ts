import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame } from '../game/engine';
import type { Action, Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { CHOAM_AUDITOR_ID } from '../game/choam-auditor';
import { ownedTech } from '../game/tech-tokens';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { combatArmy } from '../game/combat-location';
import { nexusFaceDancersAction } from '../game/nexus-tleilaxu-options';
import { choamPowerAction, choamPowerPlays } from '../game/choam-power-options';
import {
  advanceMixedNexus as advance, createMixedNexusProgramme as programme, createMixedNexusSetup as setup,
  mixedNexusClean as clean, mixedNexusInventory as inventory, mixedNexusLeader as leader,
  mixedNexusOpenBattle as open, mixedNexusPlayer as player, mixedNexusQuote as quote,
  mixedNexusReload as reload, mixedNexusRevealPlans as plans, mixedNexusShip as ship,
  nextMixedNexusStep as next, settleMixedNexus as settle, stepMixedNexus as step,
} from './fixture-mixed-nexus-modules';
import type { MixedNexusProgramme } from './fixture-mixed-nexus-modules';

function reject(g: Game, actor: string, action: Action): void {
  const before = reload(g);
  assert.throws(() => applyAction(g, actor, action));
  assert.deepEqual(g, before, 'Rejected consumers cannot debit wallets, move counters or consume original stock.');
}
function policies(g: Game, actor: string, select: (action: Action) => boolean,
  outcome: (after: Game, action: Action) => void): void {
  for (const difficulty of DIFFICULTIES) {
    const saved = reload(g); player(saved, actor).bot = difficulty;
    const action = botActions(viewGame(reload(saved), actor)).find(select);
    assert.ok(action, `${difficulty} consumes the actual owning window after JSON continuation.`);
    const after = step(reload(saved), { actor, action }); outcome(after, action);
    if (after.status === 'playing') inventory(after);
  }
}
function movement(g: Game, actor: string): Game {
  return advance(g, q => q.turn === 2 && q.phase === 5 && q.active === actor && clean(q));
}
/** These are explicit test-author choices. The reusable human controller stops
 * at each of these windows rather than choosing another player's physical stock. */
function finish(g: Game): Game {
  for (let n = 0; n < 600; n++) {
    if (!g.battle && clean(g)) return g;
    let control = next(g);
    if (!control && !g.response && !g.phaseOpening) {
      const d = g.decision; assert.ok(d);
      if (d.kind === 'battleLosses') {
        const elite = Math.max(...d.options.map(o => o.elite));
        control = { actor: d.player, action: { type: 'decision', choice: d.options.findIndex(o => o.elite === elite) } };
      } else if (d.kind === 'battleCards') control = { actor: d.player, action: { type: 'decision', discard: [] } };
      else if (d.kind === 'techToken') control = { actor: d.player, action: { type: 'decision', token: d.choices[0] } };
      else if (d.kind === 'faceDance') control = { actor: d.player, action: { type: 'decision', reveal: false } };
      else throw Error(`The test must explicitly choose ${d.kind}.`);
    }
    assert.ok(control); g = step(g, control);
  }
  throw Error('Original mixed battle did not finish.');
}
function boundary(g: Game, kind: 'sukRescue' | 'ixSubstitution' | 'battleCards' | 'techToken' | 'faceDance'): Game {
  for (let n = 0; n < 600; n++) {
    if (!g.response && !g.phaseOpening && g.decision?.kind === kind) return g;
    let control = next(g);
    if (!control && !g.response && !g.phaseOpening && g.decision?.kind === 'battleLosses') {
      const d = g.decision, elite = Math.max(...d.options.map(o => o.elite));
      control = { actor: d.player, action: { type: 'decision', choice: d.options.findIndex(o => o.elite === elite) } };
    }
    assert.ok(control, `Choose ${g.decision?.kind ?? 'sealed plan'} before ${kind}.`); g = step(g, control);
  }
  throw Error(`Original aftermath did not reach ${kind}.`);
}
function collectionIncome(g: Game, actor: string): number {
  if (g.phase !== 7 || !clean(g)) return 0;
  return quoteSpiceCollection(g).receipts.filter(r => r.player === actor)
    .reduce((n, r) => n + r.collected + r.strongholds, 0);
}
function originalClosing(f: MixedNexusProgramme): void {
  assert.ok(f.firstMentat && f.alliance && f.drawing);
  assert.equal(f.firstMentat.before.turn, 1); assert.equal(f.firstMentat.after.turn, 2);
  const allies = f.alliance.players.filter(p => p.ally);
  assert.equal(allies.length, 2);
  assert.equal(allies[0].ally, allies[1].id); assert.equal(allies[1].ally, allies[0].id);
  assert.equal(f.drawing.phase, 1);
  if (f.drawing.advanced) assert.ok(f.drawing.spiceDiscard.every(pile => pile.length > 0), 'Both original Spice piles precede closing.');
  for (const draw of f.draws) {
    const actor = draw.step.actor, face = player(draw.after, actor).faction;
    assert.equal(draw.after.nexusCards!.cards!.hands[actor], face);
    reject(draw.after, actor, draw.step.action);
    policies(draw.before, actor, a => a.type === 'nexusCardChoice', after => {
      assert.equal(after.nexusCards!.cards!.hands[actor], face);
    });
  }
  inventory(f.game);
}

void test('mixed original Ix offer/HMS and all14 Auditor exclusion retain physical native setup', () => {
  const f = setup({ advanced: true, skills: true, homeworlds: true, tech: true, strongholds: true });
  const ix = f.seats.ixians!, choam = f.seats.choam!;
  assert.ok(f.ixOffer && f.offered);
  assert.equal(player(f.afterSetup, ix).forces['hidden_mobile_stronghold:0'], 6);
  assert.equal(player(f.afterSetup, ix).elites!.forces['hidden_mobile_stronghold:0'], 3);
  const offer = viewGame(f.offered, choam).leaderSkills!;
  assert.ok(player(f.offered, choam).leaders.some(l => l.id === CHOAM_AUDITOR_ID));
  reject(f.offered, choam, { type: 'leaderSkill', event: offer.offer!.event,
    skill: offer.offer!.cards[0], leader: CHOAM_AUDITOR_ID });
  reject(f.offered, choam, { type: 'leaderSkill', event: offer.offer!.event,
    skill: offer.offer!.cards[0], leader: player(f.offered, ix).leaders[0].id });
  inventory(f.afterSetup);
});

void test('Basic two-family two-seat setup and smaller four-seat real closing require no Advanced module', () => {
  const two = programme({ advanced: false, skills: false, roster: ['ixians', 'richese'] });
  assert.equal(player(two.game, two.seats.ixians!).forces['hidden_mobile_stronghold:0'], 6);
  assert.equal(player(two.game, two.seats.richese!).noField!.tokens.length, 3);
  assert.equal(two.game.richeseCache!.length, 10); inventory(two.game);
  const four = programme({ advanced: false, skills: false, tech: true,
    roster: ['ixians', 'richese', 'guild', 'fremen'] });
  originalClosing(four);
  assert.ok(four.firstMarker);
  assert.equal(player(four.firstMarker.after, four.seats.richese!).spice,
    player(four.firstMarker.before, four.seats.richese!).spice - 1);
  assert.equal(player(four.firstMarker.after, four.seats.richese!).reserves,
    player(four.firstMarker.before, four.seats.richese!).reserves);
  const three = programme({ advanced: false, skills: false, tech: true,
    roster: ['tleilaxu', 'choam', 'guild'] });
  originalClosing(three);
  assert.equal(three.game.nexusCards!.cards!.hands[three.seats.tleilaxu!], 'tleilaxu');
  assert.equal(player(three.game, three.seats.tleilaxu!).faceDancers!.length, 3);
});

void test('bare mixed Nexus all14 Smuggler pays from the real printed board pile, not a silently absent shared mode', () => {
  const f = programme({ advanced: true, skills: true, skill: 'smuggler',
    roster: ['ixians', 'richese', 'guild', 'fremen'] });
  const ix = f.seats.ixians!, guild = f.seats.guild!, trainer = f.trainers[ix];
  const pile = Object.entries(f.game.spice).find(([key, amount]) => key.startsWith('rock_outcroppings:') && amount > 0); assert.ok(pile);
  const needed = new Set([ix, guild]); let g = reload(f.game);
  while (needed.size) {
    g = advance(g, q => q.phase === 5 && clean(q) && needed.has(q.active!));
    const actor = g.active!; g = ship(g, actor, 'rock_outcroppings', 2).after; needed.delete(actor);
    if (needed.size) g = step(g, { actor, action: { type: 'endMovement' } });
  }
  g = open(g, ix, guild, 'rock_outcroppings'); const purse = player(g, ix).spice;
  g = plans(g, [{ actor: ix, action: { type: 'battlePlan', leader: trainer, dial: 0, support: 0 } },
    { actor: guild, action: { type: 'battlePlan', leader: leader(g, guild), dial: 0, support: 0 } }]);
  assert.equal(quote(g).winner, ix); g = finish(g);
  const receipt = g.lastBattleContext!.smugglerCollection; assert.ok(receipt);
  const strength = player(g, ix).leaders.find(l => l.id === trainer)!.strength;
  assert.equal(receipt.amount, Math.min(strength, pile[1]));
  assert.equal(g.spice[pile[0]], 0);
  assert.equal(player(g, ix).spice, purse + pile[1], 'Smuggler and ordinary Collection cannot pay the same spice twice.');
  inventory(g);
});

for (const location of ['homeworld:ixians', 'homeworld:guild', 'shrine'] as const) void test(
  `mixed Ix ${location}: real typed Suk precedes same-quote residual Cyborg exchange without borrowed returns`, () => {
    const nested = location === 'shrine';
    const f = programme({ advanced: true, skills: true, homeworlds: true, discovery: nested, tech: true, strongholds: true });
    originalClosing(f);
    const ix = f.seats.ixians!, guild = f.seats.guild!, trainer = f.trainers[ix];
    if (nested) {
      assert.ok(f.firstArrival && f.entry && f.vote && f.ride);
      assert.deepEqual(combatArmy(f.entry.after, ix, 'shrine'), { normal: 1, elite: 1 });
      assert.equal(player(f.entry.after, ix).spice, player(f.entry.before, ix).spice);
      assert.equal(player(f.entry.after, ix).reserves, player(f.entry.before, ix).reserves);
      assert.equal(player(f.entry.after, ix).elites!.reserves, player(f.entry.before, ix).elites!.reserves);
      reject(f.entry.before, guild, f.entry.step.action);
      assert.equal(player(f.ride.after, f.seats.fremen!).reserves, player(f.ride.before, f.seats.fremen!).reserves - 2);
      assert.equal(player(f.ride.after, f.seats.fremen!).elites!.reserves, player(f.ride.before, f.seats.fremen!).elites!.reserves - 1);
    }
    let g = reload(f.game);
    if (location === 'homeworld:ixians') g = ship(movement(g, guild), guild, location, 3).after;
    else if (location === 'homeworld:guild') g = ship(movement(g, ix), ix, location, 4, 3).after;
    else {
      const needed = new Set([ix, guild]);
      while (needed.size) {
        g = advance(g, q => q.phase === 5 && clean(q) && needed.has(q.active!)); const actor = g.active!;
        g = ship(g, actor, location, 3, actor === ix ? 2 : 0).after; needed.delete(actor);
        if (needed.size) g = step(g, { actor, action: { type: 'endMovement' } });
      }
    }
    g = open(g, ix, guild, location);
    const offer = viewGame(g, ix).nexusSuboids!.offer!; assert.ok(!offer.blocked);
    const cunning: Action = { type: 'nexusSuboids', event: offer.event };
    reject(g, guild, cunning); reject(g, ix, { ...cunning, event: 'old-battle' });
    policies(g, ix, a => a.type === 'nexusSuboids', after => {
      const resolved = settle(after);
      assert.deepEqual(combatArmy(resolved, ix, location), combatArmy(g, ix, location));
      assert.equal(player(resolved, ix).spice, player(g, ix).spice);
      assert.equal(resolved.nexusCards!.cards!.hands[ix], null);
      assert.equal(viewGame(resolved, ix).battle!.ownForces!.normalFreeSupport, true);
    });
    g = settle(step(g, { actor: ix, action: cunning })); reject(g, ix, cunning);
    const held = player(g, ix).hand.find(c => c.kind === 'worthless')!, before = reload(g);
    const homeBefore = combatArmy(g, ix, 'homeworld:ixians'), tokens = ownedTech(g.techTokens, guild);
    g = plans(g, [{ actor: ix, action: { type: 'battlePlan', leader: trainer, dial: 3, support: 0, weapon: held.id } },
      { actor: guild, action: { type: 'battlePlan', leader: leader(g, guild), dial: location === 'homeworld:guild' ? 1 : 0,
        support: location === 'homeworld:guild' ? 1 : 0 } }]);
    const receipt = quote(g); assert.equal(receipt.winner, ix);
    assert.equal(receipt.payments.find(p => p.player === ix)!.ownPayment, 0);
    assert.equal(player(g, ix).spice, player(before, ix).spice, 'Plans never prepay support.');
    g = boundary(g, 'sukRescue'); const d = g.decision; assert.ok(d?.kind === 'sukRescue');
    const rescueChoice = d.options.findIndex(o => o.normal === 0 && o.elite === 1 && o.kept?.kind === 'elite'); assert.ok(rescueChoice >= 0);
    const rescue: Action = { type: 'decision', event: d.event, choice: rescueChoice };
    reject(g, guild, rescue); reject(g, ix, { ...rescue, event: 'old-rescue' });
    if (location !== 'homeworld:ixians') reject(g, ix, { ...rescue,
      destinations: { 'homeworld:ixians': { normal: 0, elite: 1 } } });
    g = step(g, { actor: ix, action: rescue }); g = boundary(g, 'ixSubstitution');
    const source = location === 'shrine' ? 'shrine:0' : location;
    assert.deepEqual(g.pendingIxSubstitution!.losses, { [source]: 2 });
    assert.equal(player(g, ix).elites!.tanks, player(before, ix).elites!.tanks + 2);
    assert.equal(player(g, ix).tanks, player(before, ix).tanks + 2);
    for (const token of tokens) assert.equal(g.techTokens![token].owner, guild);
    const residual = reload(g), pool = combatArmy(g, ix, location);
    const exchange: Action = { type: 'decision', sources: { [source]: 1 }, recover: { [source]: 1 } };
    reject(g, guild, exchange); reject(g, ix, { ...exchange, recover: { [source]: 3 } });
    reject(g, ix, { ...exchange, sources: { reserves: 1 } });
    if (location !== 'homeworld:ixians') reject(g, ix, { ...exchange, sources: { 'homeworld:ixians': 1 } });
    policies(g, ix, a => a.type === 'decision' && (a.sources !== undefined || a.decline === true), (after, action) => {
      const count = action.decline ? 0 : Object.values(action.recover as Record<string, number>).reduce((n, f) => n + f, 0);
      assert.equal(player(after, ix).elites!.tanks, player(residual, ix).elites!.tanks - count);
      assert.deepEqual(combatArmy(after, ix, location), { normal: pool.normal - count, elite: pool.elite + count });
      assert.equal(player(after, ix).tanks, player(residual, ix).tanks);
      assert.equal(player(after, ix).spice, player(residual, ix).spice);
    });
    g = step(g, { actor: ix, action: exchange });
    assert.deepEqual(combatArmy(g, ix, location), { normal: pool.normal - 1, elite: pool.elite + 1 });
    assert.equal(player(g, ix).elites!.tanks, player(residual, ix).elites!.tanks - 1);
    assert.equal(player(g, ix).tanks, player(residual, ix).tanks);
    if (location !== 'homeworld:ixians') assert.deepEqual(combatArmy(g, ix, 'homeworld:ixians'), homeBefore);
    g = boundary(g, 'battleCards');
    reject(g, guild, { type: 'decision', discard: [held.id] });
    g = step(g, { actor: ix, action: { type: 'decision', discard: [held.id] } });
    g = finish(g);
    assert.equal(g.discard.filter(c => c.id === held.id).length, 1);
    assert.deepEqual(combatArmy(g, guild, location), { normal: 0, elite: 0 });
    const defeated = combatArmy(before, guild, location);
    assert.equal(player(g, guild).tanks, player(before, guild).tanks + defeated.normal + defeated.elite);
    for (const token of tokens) assert.equal(g.techTokens![token].owner, ix);
    inventory(g);
  });

void test('mixed nested original winning-card cleanup/Tech precede matching native Face Dance, trainer retirement and source-local refresh', () => {
  const f = programme({ advanced: true, skills: true, homeworlds: true, discovery: true, tech: true, strongholds: true, skill: 'smuggler' });
  const ix = f.seats.ixians!, tl = f.seats.tleilaxu!, guild = f.seats.guild!, trainer = f.trainers[ix];
  assert.ok(player(f.afterSetup, tl).faceDancers!.some(c => c.leader === trainer && !c.revealed));
  let g = ship(movement(f.game, tl), tl, 'shrine', 2).after;
  g = open(g, ix, tl, 'shrine');
  const held = player(g, ix).hand.find(c => c.kind === 'worthless')!, ownTraining = g.leaderSkills!.assignments.find(a => a.owner === tl)!;
  const before = reload(g), tokens = ownedTech(g.techTokens, tl);
  assert.equal(tokens.length, 1);
  g = plans(g, [{ actor: ix, action: { type: 'battlePlan', leader: trainer, dial: 0, support: 0, weapon: held.id } },
    { actor: tl, action: { type: 'battlePlan', leader: leader(g, tl), dial: 0, support: 0 } }]);
  assert.equal(quote(g).winner, ix);
  g = boundary(g, 'battleCards');
  for (const token of tokens) assert.equal(g.techTokens![token].owner, tl);
  reject(g, tl, { type: 'decision', reveal: true, sources: { reserves: 1 }, sector: 0 });
  g = step(g, { actor: ix, action: { type: 'decision', discard: [held.id] } });
  // A sole token transfers automatically; multiple-token menus remain human-owned.
  g = boundary(g, 'faceDance');
  for (const token of tokens) assert.equal(g.techTokens![token].owner, ix);
  assert.equal(g.discard.filter(c => c.id === held.id).length, 1);
  const survivor = combatArmy(g, ix, 'shrine'), stock = reload(g), native = combatArmy(g, tl, 'homeworld:tleilaxu');
  assert.ok(survivor.normal + survivor.elite >= 1);
  const dance: Action = { type: 'decision', reveal: true, sources: { reserves: 1 }, sector: 0 };
  reject(g, guild, dance); reject(g, tl, { ...dance, sources: { reserves: survivor.normal + survivor.elite + 1 } });
  reject(g, tl, { ...dance, sources: { 'homeworld:ixians': 1 } });
  policies(g, tl, a => a.type === 'decision' && a.reveal !== undefined, (after, action) => {
    const count = action.reveal ? Object.values((action.sources ?? {}) as Record<string, number>).reduce((n, f) => n + f, 0) : 0;
    assert.equal(player(after, ix).leaders.find(l => l.id === trainer)!.dead, !!action.reveal);
    assert.equal(player(after, tl).faceDancers!.find(c => c.leader === trainer)!.revealed, !!action.reveal);
    assert.deepEqual(combatArmy(after, ix, 'shrine'), action.reveal ? { normal: 0, elite: 0 } : survivor);
    assert.equal(combatArmy(after, tl, 'shrine').normal, count);
    for (const token of tokens) assert.equal(after.techTokens![token].owner, ix);
    assert.equal(player(after, tl).spice, player(stock, tl).spice);
  });
  g = step(g, { actor: tl, action: dance });
  assert.equal(player(g, ix).reserves, player(stock, ix).reserves + survivor.normal + survivor.elite);
  assert.equal(player(g, ix).elites!.reserves, player(stock, ix).elites!.reserves + survivor.elite);
  assert.deepEqual(combatArmy(g, tl, 'homeworld:tleilaxu'), { normal: native.normal - 1, elite: 0 });
  assert.deepEqual(combatArmy(g, tl, 'shrine'), { normal: 1, elite: 0 });
  assert.equal(g.leaderSkills!.assignments.some(a => a.leader === trainer), false);
  assert.equal(g.leaderSkills!.deck.filter(s => s === 'smuggler').length, 1);
  assert.equal(g.leaderSkills!.assignments.find(a => a.owner === tl)!.leader, ownTraining.leader);
  assert.equal(player(g, ix).tanks, player(before, ix).tanks, 'Face Dance returns surviving physical counters; it is not a battle casualty.');
  reject(g, tl, dance);
  const offer = viewGame(g, tl).nexusTleilaxu!.cunning!; assert.ok(!offer.blocked);
  const refresh = nexusFaceDancersAction(viewGame(g, tl), offer.event); assert.ok(refresh);
  const reserve = [...g.traitorReserve!], untouched = player(g, tl).faceDancers!.filter(c => !c.revealed);
  const allowance = player(g, tl).faceDancerReplacedTurn;
  reject(g, guild, refresh); reject(g, tl, { ...refresh, leaders: [trainer] });
  policies(g, tl, a => a.type === 'nexusFaceDancers', after => {
    assert.deepEqual(player(after, tl).faceDancers!.filter(c => untouched.some(old => old.leader === c.leader)), untouched);
    assert.deepEqual(player(after, tl).faceDancers!.filter(c => !untouched.some(old => old.leader === c.leader)), [{ leader: reserve[0], revealed: false }]);
    assert.deepEqual([...after.traitorReserve!].sort(), [...reserve.slice(1), trainer].sort());
    assert.equal(player(after, tl).faceDancerReplacedTurn, allowance);
    assert.equal(after.nexusCards!.cards!.hands[tl], null);
    for (const token of tokens) assert.equal(after.techTokens![token].owner, ix);
    assert.deepEqual(combatArmy(after, tl, 'shrine'), { normal: 1, elite: 0 });
  });
  g = step(g, { actor: tl, action: refresh }); reject(g, tl, refresh); g = finish(g); inventory(g);
});

void test('mixed native Richese signed five-plus-three invoice pays Guild once, materializes original supply and rejects borrowed companions', () => {
  const f = programme({ advanced: true, skills: false, homeworlds: true, tech: true,
    roster: ['ixians', 'choam', 'richese', 'guild', 'fremen'] });
  originalClosing(f); const rich = f.seats.richese!, guild = f.seats.guild!, choam = f.seats.choam!;
  let g = reload(f.game);
  const arrivals = new Set([rich, guild]);
  while (arrivals.size) {
    g = advance(g, s => s.turn === 2 && s.phase === 5 && clean(s) && arrivals.has(s.active!));
    const actor = g.active!;
    if (actor === guild) g = ship(g, guild, 'arrakeen', 3).after;
    else {
      let before = reload(g);
      const p = player(g, rich), offer = viewGame(g, rich).nexusRicheseCunning!; assert.ok(!offer.blocked);
      const request: Action = { type: 'ship', territory: 'arrakeen', sector: 10,
        noField: p.noField!.tokens.find(t => t.value === 3)!.id,
        revealedToken: p.noField!.tokens.find(t => t.value === 5)!.id,
        event: p.noFieldEvent, nexus: offer.event, allyPayment: 0 };
      const native = combatArmy(g, rich, 'homeworld:richese'); assert.ok(native.normal >= 8);
      reject(g, guild, request); reject(g, rich, { ...request, nexus: 'old-richese' });
      reject(g, rich, { ...request, revealedToken: request.noField });
      reject(g, rich, { ...request, smugglerCompanion: true });
      reject(g, rich, { ...request, source: 'homeworld:guild' });
      g = settle(step(g, { actor: rich, action: request }));
      assert.equal(player(g, rich).spice, player(before, rich).spice - 1);
      assert.equal(player(g, guild).spice, player(before, guild).spice + 1);
      assert.equal(player(g, choam).spice, player(before, choam).spice, 'Shipment is not CHOAM battle support income.');
      assert.deepEqual(combatArmy(g, rich, 'homeworld:richese'), { normal: native.normal - 5, elite: 0 });
      assert.equal(player(g, rich).forces['arrakeen:10'], 5);
      assert.equal(g.nexusCards!.cards!.hands[rich], null); reject(g, rich, request);
      before = reload(g);
      const reveal: Action = { type: 'revealNoField', token: request.noField, event: player(g, rich).noFieldEvent };
      reject(g, rich, { ...reveal, event: 'old-marker' });
      g = step(g, { actor: rich, action: reveal });
      assert.equal(player(g, rich).forces['arrakeen:10'], 8);
      assert.deepEqual(combatArmy(g, rich, 'homeworld:richese'), { normal: native.normal - 8, elite: 0 });
      for (const payer of [rich, guild, choam]) assert.equal(player(g, payer).spice, player(before, payer).spice, 'Hidden three materialization cannot repeat the signed shipment payment.');
    }
    arrivals.delete(actor);
    if (arrivals.size) g = step(g, { actor, action: { type: 'endMovement' } });
  }
  // Both actual actors use their existing movement slots; CHOAM receives half
  // subsequent paid support, not the already settled marker invoice.
  g = open(g, rich, guild, 'arrakeen');
  const before = reload(g);
  g = plans(g, [{ actor: rich, action: { type: 'battlePlan', leader: leader(g, rich, true), dial: 2, support: 2 } },
    { actor: guild, action: { type: 'battlePlan', leader: leader(g, guild), dial: 2, support: 2 } }]);
  const receipt = quote(g); assert.equal(receipt.winner, rich);
  assert.equal(player(g, choam).spice, player(before, choam).spice, 'Income waits for actual battle resolution.');
  g = finish(g);
  assert.equal(player(g, choam).spice, player(before, choam).spice + 2 + collectionIncome(g, choam));
  assert.equal(player(g, rich).spice, player(before, rich).spice - 2 + collectionIncome(g, rich));
  assert.equal(player(g, guild).spice, player(before, guild).spice - 2 + collectionIncome(g, guild));
  assert.equal(player(g, rich).forces['arrakeen:10'], 6);
  assert.equal(player(g, guild).tanks, player(before, guild).tanks + 3); inventory(g);
});

for (const fuelKind of ['special', 'shield'] as const) void test(
  `mixed CHOAM original ${fuelKind} fuels any-Treachery Cunning and delays actual other-payer support through Suk`, () => {
    const f = programme({ advanced: true, skills: true, homeworlds: true, tech: true, strongholds: true,
      skillOwner: 'choam', skill: 'suk-graduate', fuelKind });
    const choam = f.seats.choam!, guild = f.seats.guild!, trainer = f.trainers[choam];
    let g = movement(f.game, choam);
    const fuel = player(g, choam).hand.find(c => c.kind === fuelKind && (fuelKind !== 'special' || c.effect !== 'karama')); assert.ok(fuel);
    const play = choamPowerPlays(viewGame(g, choam), 'kulon').find(p => p.source === 'nexus' && p.card.id === fuel.id); assert.ok(play);
    const request = choamPowerAction(viewGame(g, choam), play); assert.ok(request);
    const beforeFuel = reload(g);
    reject(g, guild, request); reject(g, choam, { ...request, nexus: 'old-choam' });
    reject(g, choam, { ...request, card: player(g, guild).hand[0].id });
    g = settle(step(g, { actor: choam, action: request }));
    assert.equal(player(g, choam).spice, player(beforeFuel, choam).spice);
    assert.equal(g.discard.filter(c => c.id === fuel.id).length, 1);
    assert.equal(player(g, choam).hand.some(c => c.id === fuel.id), false);
    assert.equal(g.choamMovement!.bonus, 1); assert.equal(g.nexusCards!.cards!.hands[choam], null);
    reject(g, choam, request);
    g = ship(g, choam, 'homeworld:guild', 3).after;
    g = open(g, choam, guild, 'homeworld:guild'); const before = reload(g), tokens = ownedTech(g.techTokens, guild);
    g = plans(g, [{ actor: choam, action: { type: 'battlePlan', leader: trainer, dial: 2, support: 2 } },
      { actor: guild, action: { type: 'battlePlan', leader: leader(g, guild), dial: 2, support: 2 } }]);
    assert.equal(player(g, choam).spice, player(before, choam).spice);
    g = boundary(g, 'sukRescue'); const d = g.decision; assert.ok(d?.kind === 'sukRescue');
    assert.equal(player(g, choam).spice, player(before, choam).spice - 2);
    assert.equal(player(g, guild).spice, player(before, guild).spice - 2);
    assert.equal(g.pendingChoamBattleIncome!.amount, 1, 'Own support is excluded; only the actual Guild payer funds native income.');
    for (const token of tokens) assert.equal(g.techTokens![token].owner, guild);
    const source = combatArmy(g, choam, 'homeworld:guild'), home = combatArmy(g, choam, 'homeworld:choam');
    const choice = d.options.findIndex(o => o.normal === 1 && o.elite === 0 && o.kept?.kind === 'normal'); assert.ok(choice >= 0);
    const rescue: Action = { type: 'decision', event: d.event, choice };
    reject(g, guild, rescue); reject(g, choam, { ...rescue, event: 'old-rescue' });
    policies(g, choam, a => a.type === 'decision' && a.choice !== undefined, (after, action) => {
      const saved = d.options[Number(action.choice)], kept = saved.kept?.kind === 'normal' ? 1 : 0;
      assert.equal(player(after, choam).tanks, player(g, choam).tanks + 2 - saved.normal - saved.elite);
      assert.deepEqual(combatArmy(after, choam, 'homeworld:guild'), { normal: source.normal - 2 + kept, elite: 0 });
      assert.deepEqual(combatArmy(after, choam, 'homeworld:choam'), { normal: home.normal + saved.normal - kept, elite: 0 });
      assert.equal(player(after, choam).spice, player(g, choam).spice + (after.pendingChoamBattleIncome ? 0 : 1) + collectionIncome(after, choam));
    });
    g = step(g, { actor: choam, action: rescue }); g = finish(g);
    assert.equal(g.lastBattleContext!.winner, choam);
    assert.deepEqual(combatArmy(g, choam, 'homeworld:guild'), { normal: 2, elite: 0 });
    assert.equal(player(g, choam).tanks, player(before, choam).tanks + 1);
    assert.equal(player(g, choam).spice, player(before, choam).spice - 2 + 1 + collectionIncome(g, choam));
    for (const token of tokens) assert.equal(g.techTokens![token].owner, choam);
    inventory(g);
  });
