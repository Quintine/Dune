import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { DIFFICULTIES } from '../game/bot-profiles';
import { treacheryDeck } from '../game/cards';
import { DUKE_VIDAL_ID } from '../game/duke-vidal';
import { NEXUS_FACTIONS } from '../game/nexus-cards';
import { ownedTech } from '../game/tech-tokens';
import { strongholdControllers } from '../game/stronghold-cards';
import { quoteBattleResolution, type BattleResolutionQuote, type ResolutionCombatant } from '../game/battle-resolution-quote';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { homeworldContext } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { homeworldCombatLocation } from '../game/homeworld-combat';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { nativeShipmentSources } from '../game/homeworld-options';
import { ecazOccupancyRelation } from '../game/ecaz-occupy';
import { nexusEcazDukeAction } from '../game/nexus-ecaz-duke-options';
import { discoveryEntryMoveAction } from '../game/discovery-entry-options';
import {
  advanceE3NexusEcaz as advance, createE3NexusEcazClosing as closing,
  createE3NexusEcazCoalition as coalition, createE3NexusEcazCunning as cunning,
  createE3NexusEcazDiscovery as discovery, e3NexusEcazClean as clean,
  e3NexusEcazPlayer as player, e3NexusEcazPolicy as policy, e3NexusEcazPool as pool,
  e3NexusEcazReload as reload, e3NexusEcazStep as step, revealE3NexusEcaz as reveal,
  shipE3NexusEcaz as ship,
  type E3NexusEcazStep,
} from './fixture-e3-nexus-ecaz';

/** The last battle can enter ordinary Collection before this owned suffix returns. */
function ordinaryCollectionSpice(g: Game, actor: string): number {
  return g.phase === 7 ? quoteSpiceCollection(g).receipts.find(r => r.player === actor)?.strongholds ?? 0 : 0;
}

function reject(g: Game, actor: string, action: Action, reason?: RegExp): void {
  const before = structuredClone(g);
  if (reason) assert.throws(() => applyAction(g, actor, action), reason);
  else assert.throws(() => applyAction(g, actor, action));
  assert.deepEqual(g, before, 'Rejected ownership, stale event and unsupported FORCE choices cannot consume original pieces.');
}
/** Count only real zones. The separate Duke never becomes a sixth native disc. */
function physical(g: Game): void {
  const nx = g.nexusCards!.cards!;
  assert.deepEqual([...nx.deck, ...nx.discard, ...Object.values(nx.hands).filter(c => c !== null)].sort(), [...NEXUS_FACTIONS].sort());
  const auction = g.auction?.cards.slice(g.auction.index + (g.currentAuctionSale ? 1 : 0)) ?? [];
  assert.deepEqual([...g.deck, ...g.discard, ...g.players.flatMap(p => p.hand), ...auction].map(c => c.id).sort(),
    treacheryDeck(['ecaz']).map(c => c.id).sort());
  const homes = g.homeworlds?.custody ? homeworldForceGroups(homeworldContext(g), g.homeworlds.custody) : [];
  for (const p of g.players) {
    const visiting = homes.filter(h => h.native !== p.id).map(h => h.forces[p.id] ?? { normal: 0, elite: 0 });
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((a, n) => a + n, 0) +
      visiting.reduce((a, f) => a + f.normal + f.elite, 0), 20);
    if (p.elites) assert.equal(p.elites.reserves + p.elites.tanks + Object.values(p.elites.forces).reduce((a, n) => a + n, 0) +
      visiting.reduce((a, f) => a + f.elite, 0), p.faction === 'fremen' ? 3 : 5);
  }
  assert.equal(player(g, g.players.find(p => p.faction === 'ecaz')!.id).leaders.length, 5);
  assert.ok(g.players.every(p => p.leaders.every(l => l.id !== DUKE_VIDAL_ID)));
}
/** Four minimal saved policies at genuine windows; assert their consumer effect. */
function policies(g: Game, actor: string, effect: (after: Game, action: Action) => void): void {
  for (const difficulty of DIFFICULTIES) {
    const action = policy(g, actor, difficulty)[0]; assert.ok(action, `${difficulty} needs the actual owned action.`);
    const after = step(g, { actor, action }); effect(after, action); physical(after);
  }
}
function battleQuote(g: Game): BattleResolutionQuote {
  const b = g.battle!, publicBattle = viewGame(g, g.host).battle!;
  assert.ok(b?.revealed);
  const side = (actor: string): ResolutionCombatant => {
    const p = player(g, actor), view = viewGame(g, actor).battle!;
    assert.ok(view.ownForces);
    return { id: actor, faction: p.faction, ally: p.ally, spice: p.spice, hand: p.hand,
      plan: b.plans[actor], leader: p.leaders.find(l => l.id === b.plans[actor].leader) ??
        (g.dukeVidal?.controller === actor && b.plans[actor].leader === DUKE_VIDAL_ID ? g.dukeVidal.leader : undefined),
      forces: view.ownForces, stronghold: view.strongholdEffects[actor] };
  };
  const context = homeworldContext(g);
  const home = b.territory.startsWith('homeworld:') ? homeworldCombatLocation({ ...context,
    players: context.players.map(p => ({ ...p, ally: player(g, p.id).ally })), order: g.order }, g.homeworlds!.custody!, b.territory) : null;
  return quoteBattleResolution({ advanced: g.advanced, typedCasualties: !!g.homeworlds,
    turn: g.turn, territory: b.territory, aggressor: publicBattle.aggressor,
    ...(publicBattle.ecazOccupy?.profile ? { ecazOccupy: publicBattle.ecazOccupy.profile } : {}),
    ...(home ? { homeworld: { native: home.native, card: home.card, side: home.side, nativeForces: home.forces[home.native] } } : {}),
    attacker: side(b.attacker), defender: side(b.defender),
    voters: publicBattle.traitorVoters.map(actor => ({ id: actor, called: false, traitors: player(g, actor).traitors,
      beneficiary: [b.attacker, b.defender].includes(actor) ? actor : player(g, actor).ally! })),
    participants: g.players, physicalCards: [...g.deck, ...g.discard, ...g.players.flatMap(p => p.hand)],
    pendingAuditorPresent: false, pendingRetentionPresent: false });
}
function settle(g: Game, actions?: E3NexusEcazStep[], exercisePolicies = true): Game {
  for (let n = 0; n < 180; n++) {
    g = advance(g, s => !s.response && !s.phaseOpening &&
      (!!s.decision && ['battleLosses', 'battleCards', 'techToken'].includes(s.decision.kind) || !s.battle && clean(s)), actions);
    if (!g.decision && !g.battle && clean(g)) return g;
    const d = g.decision; assert.ok(d);
    let action: Action;
    if (d.kind === 'battleLosses') {
      action = { type: 'decision', choice: 0 };
      if (exercisePolicies) policies(g, d.player, (after, selected) => {
        const option = d.options[Number(selected.choice)], owner = d.forceOwner ?? d.player;
        assert.ok(option);
        assert.equal(player(after, owner).tanks, player(g, owner).tanks + option.normal + option.elite);
      });
    } else if (d.kind === 'battleCards') {
      action = { type: 'decision', discard: [] };
      if (exercisePolicies) policies(g, d.player, (after, selected) => {
        for (const id of selected.discard as string[]) {
          assert.ok(!player(after, d.player).hand.some(c => c.id === id));
          assert.equal(after.discard.filter(c => c.id === id).length, 1);
        }
        assert.notEqual(after.decision?.kind, 'battleCards');
      });
    } else if (d.kind === 'techToken') {
      assert.equal(g.battle, null, 'Physical battle cleanup precedes mandatory winner Tech custody.');
      reject(g, d.loser, { type: 'decision', token: d.choices[0] });
      reject(g, d.player, { type: 'decision', decline: true });
      action = { type: 'decision', token: d.choices[0] };
      if (exercisePolicies) policies(g, d.player, (after, selected) => {
        const token = selected.token as keyof NonNullable<Game['techTokens']>;
        assert.ok(d.choices.includes(token)); assert.equal(g.techTokens![token].owner, d.loser);
        assert.equal(after.techTokens![token].owner, d.player);
        assert.equal(player(after, d.player).spice, player(g, d.player).spice, 'Taking a token is not another income payment.');
      });
    } else throw Error(`Unexpected original Ecaz settlement ${d.kind}`);
    g = step(g, { actor: d.player, action }, actions);
  }
  throw Error('Original Ecaz physical settlement did not finish.');
}
function assertClosing(f: { owner: string; others: string[]; alliance: Game; draw: { before: Game; step: E3NexusEcazStep; after: Game } }): void {
  assert.equal(player(f.alliance, f.owner).ally, null);
  assert.equal(player(f.alliance, f.others[0]).ally, f.others[1]);
  assert.equal(f.draw.before.nexusCards!.cards!.hands[f.owner], null);
  policies(f.draw.before, f.owner, after => {
    assert.equal(after.nexusCards!.cards!.hands[f.owner], 'ecaz');
    assert.ok(!after.nexusCards!.cards!.deck.includes('ecaz'));
  });
  reject(f.draw.before, f.others[0], f.draw.step.action);
  reject(f.draw.after, f.owner, f.draw.step.action);
}

void test('original no-Skills Ecaz closing draw → paid Wallach visitor → living unclaimed Duke → native support settlement → physical end-turn expiry', () => {
  const f = cunning({ discovery: true }); assertClosing(f);
  const sources = nativeShipmentSources(viewGame(f.arrival.before, f.owner), 1, 0); assert.ok(sources);
  const quoted = homeworldShipmentChoice(viewGame(f.arrival.before, f.owner), f.location,
    Object.fromEntries(Object.entries(sources).filter(([, group]) => group.normal + group.elite > 0)));
  assert.equal(player(f.arrival.settled, f.owner).spice, player(f.arrival.before, f.owner).spice - quoted.cost);
  assert.equal(player(f.arrival.settled, f.owner).reserves, player(f.arrival.before, f.owner).reserves - 1);
  assert.equal(pool(f.arrival.settled, f.owner, f.location).normal, 1);
  assert.deepEqual(pool(f.arrival.settled, f.opponent, f.location), pool(f.arrival.before, f.opponent, f.location));
  assert.ok(!f.arrival.settled.pendingAmbassador && !f.arrival.settled.pendingTerrorEntry);
  assert.notEqual(f.arrival.settled.decision?.kind, 'intrusion');
  assert.ok(!Object.keys(player(f.arrival.settled, f.owner).forces).some(key => key.startsWith('homeworld:')));
  assert.ok(!Object.keys(player(f.arrival.settled, f.opponent).advisors ?? {}).some(key => key.startsWith('homeworld:')));
  assert.ok(!f.game.battle!.ecazOccupy, 'A real native-home battle never becomes Arrakis Occupy.');

  const action = nexusEcazDukeAction(viewGame(f.cunning.before, f.owner)); assert.ok(action);
  assert.equal(f.cunning.before.dukeVidal!.controller, null);
  assert.equal(f.cunning.before.dukeVidal!.leader.dead, false);
  reject(f.cunning.before, f.opponent, action);
  reject(f.cunning.before, f.owner, { ...action, event: 'foreign-window' });
  policies(f.cunning.before, f.owner, after => {
    assert.equal(after.dukeVidal!.controller, f.owner); assert.equal(after.dukeVidal!.source, 'ecazNexus');
    assert.equal(after.nexusCards!.cards!.hands[f.owner], null);
    assert.equal(after.nexusCards!.cards!.discard.filter(c => c === 'ecaz').length, 1);
  });
  reject(f.cunning.after, f.owner, action);
  reject(f.game, f.owner, action);
  const originalDisc = structuredClone(f.cunning.after.dukeVidal!.leader);
  const revealed = reveal(f.game, f.plans, f.actions), quote = battleQuote(revealed);
  const nativeSide = revealed.battle!.attacker === f.opponent ? 'attacker' : 'defender';
  assert.ok(quote.scores![nativeSide] > quote.leaderStrengths[nativeSide] + 3,
    'The actual native Homeworld supplies additional free strength, not additional paid support.');
  assert.equal(quote.winner, f.opponent);
  assert.equal(quote.payments.find(p => p.player === f.opponent)!.ownPayment, 3,
    'Native free strength does not fund three dialed support.');
  const lostToken = ownedTech(revealed.techTokens, f.owner)[0]; assert.ok(lostToken);
  const done = settle(revealed, f.actions);
  assert.equal(player(done, f.opponent).spice, player(revealed, f.opponent).spice - 3);
  assert.equal(player(done, f.opponent).tanks, player(revealed, f.opponent).tanks + 3);
  assert.equal(pool(done, f.opponent, f.location).normal, pool(revealed, f.opponent, f.location).normal - 3);
  assert.equal(pool(done, f.owner, f.location).normal, 0);
  assert.equal(player(done, f.owner).tanks, player(revealed, f.owner).tanks + 1);
  assert.equal(done.techTokens![lostToken].owner, f.opponent);
  assert.equal(done.dukeVidal!.leader.dead, originalDisc.dead);
  assert.equal(done.dukeVidal!.leader.deaths, originalDisc.deaths);
  assert.deepEqual(done.strongholdCards!.owners, revealed.strongholdCards!.owners, 'A Homeworld win cannot acquire an Arrakis Stronghold Card.');
  physical(done);
  const later = advance(done, s => s.turn === 3 && s.phase === 1 && clean(s), f.actions);
  assert.equal(later.dukeVidal!.controller, null); assert.equal(later.dukeVidal!.source, null);
  assert.equal(later.dukeVidal!.leader.dead, originalDisc.dead);
  assert.equal(later.dukeVidal!.leader.deaths, originalDisc.deaths);
  assert.equal(later.nexusCards!.cards!.discard.filter(c => c === 'ecaz').length, 1);
  physical(later);
});

for (const advanced of [true, false]) void test(`${advanced ? 'Advanced held Tabr+Tech+Homeworlds' : 'Basic even-FORCE Tech'} original Ecaz-selected Arrakis coalition keeps source-local payments, owner casualties and winner rewards`, () => {
  const f = coalition({ advanced, tech: true, strongholds: advanced, homeworlds: advanced }); assertClosing(f);
  assert.ok(f.claim);
  if (advanced) {
    assert.deepEqual(f.firstMentat.after.strongholdCards!.owners, strongholdControllers(f.firstMentat.before.players, false));
    assert.equal(f.firstMentat.after.strongholdCards!.owners.sietch_tabr, f.owner);
  }
  for (const arrival of f.arrivals) {
    const actor = arrival.step.actor, amount = Number(arrival.step.action.amount);
    assert.equal(player(arrival.settled, actor).reserves, player(arrival.before, actor).reserves - amount);
    assert.equal(player(arrival.settled, actor).forces[f.location], (player(arrival.before, actor).forces[f.location] ?? 0) + amount);
    assert.ok(player(arrival.settled, actor).spice < player(arrival.before, actor).spice);
  }
  const lastArrival = f.arrivals.at(-1)!.settled, accrued = lastArrival.techTokens!.heighliners;
  assert.ok(accrued.owner); assert.equal(accrued.spice, ownedTech(lastArrival.techTokens, accrued.owner).length);
  assert.equal(f.beforeBattle.techTokens!.heighliners.spice, 0);
  assert.equal(player(f.beforeBattle, accrued.owner).spice, player(lastArrival, accrued.owner).spice + accrued.spice,
    'Only the ORIGINAL Heighliners holder receives the phase-end shipment benefit.');
  assert.equal(ecazOccupancyRelation(f.beforeBattle.players, f.owner, f.ally, { kind: 'territory', id: 'sietch_tabr' }), 'ecazAlliance');
  assert.equal(ecazOccupancyRelation(f.beforeBattle.players, f.owner, f.ally, { kind: 'homeworld', id: 'homeworld:emperor' }), 'different');
  const d = f.game.decision; assert.ok(d?.kind === 'ecazBattleLead');
  reject(f.game, f.ally, { type: 'decision', event: d.event, lead: f.owner });
  reject(f.game, f.owner, { type: 'decision', event: 'stale', lead: f.owner });
  reject(f.game, f.owner, { type: 'decision', event: d.event, lead: f.opponent });
  const chooseAndReveal = (state: Game, lead: string) => {
    let g = advance(state, s => !!s.battle && clean(s) && !s.battle.preparation && s.battle.preLeader?.closed !== false);
    const profile = viewGame(g, lead).battle!.ecazOccupy!.profile!;
    const own = player(g, lead).leaders.filter(l => !l.dead).sort((a, b) => b.strength - a.strength)[0];
    const enemy = player(g, f.opponent).leaders.filter(l => !l.dead).sort((a, b) => a.strength - b.strength)[0];
    const plans: E3NexusEcazStep[] = [
      { actor: lead, action: { type: 'battlePlan', leader: own.id, dial: profile.fixedEcazDial + 3, support: advanced ? 3 : 0 } },
      { actor: f.opponent, action: { type: 'battlePlan', leader: enemy.id, dial: 1, support: advanced ? 1 : 0 } },
    ];
    const before = reload(g);
    policies(g, lead, (offered) => {
      assert.equal(player(offered, lead).spice, player(g, lead).spice, 'Sealing is not a second debit.');
      const branch = reveal(offered, [plans[1]]), quoted = battleQuote(branch), finished = settle(branch, undefined, false);
      assert.equal(finished.lastBattleContext!.winner, quoted.winner);
      for (const payment of quoted.payments) {
        const income = quoted.strongholdIncome.filter(i => i.player === payment.player).reduce((a, i) => a + i.amount, 0);
        assert.equal(player(finished, payment.player).spice, player(branch, payment.player).spice - payment.ownPayment + income +
          (quoted.bounty?.player === payment.player ? quoted.bounty.amount : 0) + ordinaryCollectionSpice(finished, payment.player));
      }
      physical(finished);
    });
    g = reveal(g, plans);
    return { before, revealed: g, quote: battleQuote(g), done: settle(g) };
  };
  policies(f.game, f.owner, (after, chosen) => {
    const lead = String(chosen.lead);
    assert.ok([f.owner, f.ally].includes(lead));
    const result = chooseAndReveal(after, lead);
    assert.equal(result.done.lastBattleContext!.winner, lead);
    const enemyToken = ownedTech(result.before.techTokens, f.opponent)[0]; assert.ok(enemyToken);
    assert.equal(result.done.techTokens![enemyToken].owner, lead);
    assert.equal(ownedTech(result.done.techTokens, lead).length, 2);
    assert.equal(ownedTech(result.done.techTokens, lead === f.owner ? f.ally : f.owner).length, 1);
  });
  const selected = step(f.game, { actor: f.owner, action: { type: 'decision', event: d.event, lead: f.owner } });
  const result = chooseAndReveal(selected, f.owner), fixed = advanced ? 3 : 2;
  assert.deepEqual(result.quote.fixedLosses, [{ owner: f.owner, normal: fixed, elite: 0 }]);
  assert.equal(result.quote.casualties!.owner, f.ally);
  assert.equal(player(result.done, f.owner).tanks - player(result.before, f.owner).tanks, fixed);
  assert.equal(player(result.done, f.ally).tanks - player(result.before, f.ally).tanks, 3);
  assert.equal(player(result.done, f.opponent).tanks - player(result.before, f.opponent).tanks, 8);
  assert.equal(player(result.done, f.owner).forces[f.location], 2);
  assert.equal(player(result.done, f.ally).forces[f.location], 1);
  assert.equal(player(result.done, f.owner).spice, player(result.before, f.owner).spice - (advanced ? 3 : 0) + (advanced ? 1 : 0));
  assert.equal(player(result.done, f.ally).spice, player(result.before, f.ally).spice, 'The selected Ecaz payer never debits its variable army owner.');
  assert.deepEqual(result.quote.strongholdIncome, advanced ? [{ player: f.owner, amount: 1 }] : []);
  const alliedLead = chooseAndReveal(step(f.game, { actor: f.owner,
    action: { type: 'decision', event: d.event, lead: f.ally } }), f.ally);
  assert.equal(alliedLead.done.lastBattleContext!.winner, f.ally);
  assert.deepEqual(alliedLead.quote.strongholdIncome, [], 'The allied lead cannot borrow Ecaz’s held Tabr battle income.');
  assert.equal(player(alliedLead.done, f.owner).spice, player(alliedLead.before, f.owner).spice);
  assert.equal(player(alliedLead.done, f.ally).spice, player(alliedLead.before, f.ally).spice - (advanced ? 3 : 0));
  assert.equal(alliedLead.done.techTokens![ownedTech(alliedLead.before.techTokens, f.opponent)[0]].owner, f.ally);
  const completed = advance(result.done, s => s.turn === 4 && s.phase === 0);
  assert.equal(completed.status, 'playing'); assert.equal(completed.lastBattleContext!.winner, f.owner);
  assert.equal(completed.techTokens![ownedTech(result.before.techTokens, f.opponent)[0]].owner, f.owner);
  physical(completed);
});

void test('the real Basic odd-FORCE coalition remains guarded before any selected lead, loss or reward can be consumed', () => {
  const f = coalition({ advanced: false, tech: true }, 3);
  reject(f.beforeBattle, f.choice.actor, f.choice.action, /Odd-force Basic Occupy/);
  assert.equal(player(f.beforeBattle, f.owner).forces[f.location], 3);
  assert.equal(f.beforeBattle.battle, null); physical(f.beforeBattle);
});

void test('original Discovery reveal and free parent entry precede, rather than predeal, the later qualifying Ecaz closing draw', () => {
  const f = discovery({ advanced: false, roster: ['ecaz', 'guild', 'emperor', 'beneGesserit'], tech: true, homeworlds: true });
  assert.equal(player(f.arrival.settled, f.owner).reserves, player(f.arrival.before, f.owner).reserves - 2);
  assert.ok(player(f.arrival.settled, f.owner).spice < player(f.arrival.before, f.owner).spice);
  assert.equal(f.revealed.discoveries!.tokens.find(t => t.id === f.token)!.revealedTurn, 1);
  assert.ok(Object.values(f.entry.before.nexusCards!.cards!.hands).every(c => c === null));
  const offer = viewGame(f.entry.before, f.owner), action = discoveryEntryMoveAction(offer, offer.discoveryEntry!.sources); assert.ok(action);
  reject(f.entry.before, f.others[0], action);
  reject(f.entry.before, f.owner, { ...action, event: 'stale' });
  reject(f.entry.after, f.owner, action);
  policies(f.entry.before, f.owner, (after, offered) => {
    assert.equal(player(after, f.owner).spice, player(f.entry.before, f.owner).spice);
    assert.equal(player(after, f.owner).reserves, player(f.entry.before, f.owner).reserves);
    assert.deepEqual(after.homeworlds!.custody, f.entry.before.homeworlds!.custody);
    if (offered.groups) {
      assert.equal(player(after, f.owner).forces['cistern:0'], 2);
      assert.equal(player(after, f.owner).forces['gara_kulon:8'] ?? 0, 0);
    } else assert.equal(player(after, f.owner).forces['gara_kulon:8'], 2);
    assert.notEqual(after.decision?.kind, 'discoveryEntry');
  });
  assert.equal(player(f.entry.after, f.owner).forces['cistern:0'], 2);
  assert.equal(f.draw.before.turn, 2); assertClosing(f);
  const later = advance(f.game, s => s.turn === 3 && s.phase === 1 && clean(s));
  assert.equal(player(later, f.owner).forces['cistern:0'], 2);
  assert.equal(later.nexusCards!.cards!.hands[f.owner], 'ecaz'); physical(later);
});

void test('the existing Basic Harkonnen roster boundary still permits source-clear Cunning without Skills or an invented seat parity guard', () => {
  const f = closing({ advanced: false, roster: ['ecaz', 'guild', 'harkonnen'], tech: true, homeworlds: true }); assertClosing(f);
  const arrival = ship(f.game, f.owner, 'homeworld:guild', 1);
  const g = advance(arrival.settled, s => s.phase === 6 && clean(s) && !s.battle), action = nexusEcazDukeAction(viewGame(g, f.owner)); assert.ok(action);
  policies(g, f.owner, after => {
    assert.equal(after.dukeVidal!.controller, f.owner);
    assert.equal(after.nexusCards!.cards!.hands[f.owner], null);
    assert.equal(after.nexusCards!.cards!.discard.filter(c => c === 'ecaz').length, 1);
  });
});

void test('Advanced Harkonnen is still an eligible no-Skills roster opponent, not authority to bypass the canonical Duke Cunning exclusion', () => {
  const f = closing({ advanced: true, roster: ['ecaz', 'guild', 'harkonnen'], tech: true, homeworlds: true }); assertClosing(f);
  const arrival = ship(f.game, f.owner, 'homeworld:guild', 1);
  const g = advance(arrival.settled, s => s.phase === 6 && clean(s) && !s.battle);
  const offer = viewGame(g, f.owner).nexusEcazDuke; assert.ok(offer);
  assert.match(offer.blocked!, /Advanced Harkonnen/);
  assert.equal(nexusEcazDukeAction(viewGame(g, f.owner)), null);
  reject(g, f.owner, { type: 'nexusEcazDuke', event: offer.event }, /Advanced Harkonnen/);
  assert.equal(g.nexusCards!.cards!.hands[f.owner], 'ecaz');
  assert.equal(g.dukeVidal!.controller, null); assert.equal(g.dukeVidal!.leader.dead, false);
  physical(g);
});
