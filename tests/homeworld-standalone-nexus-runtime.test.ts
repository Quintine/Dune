import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction, createGame, initializeLeaderSkillsGameForAudit, joinGame, newPlayer, viewGame,
  type Action, type Game,
} from '../game/engine';
import { DIFFICULTIES } from '../game/bot-profiles';
import { DUKE_VIDAL_ID } from '../game/duke-vidal';
import { ownedTech } from '../game/tech-tokens';
import { strongholdControllers } from '../game/stronghold-cards';
import { ecazOccupancyRelation } from '../game/ecaz-occupy';
import { nativeShipmentSources } from '../game/homeworld-options';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { nexusEcazDukeAction } from '../game/nexus-ecaz-duke-options';
import { discoveryEntryMoveAction } from '../game/discovery-entry-options';
import {
  advanceStandaloneHomeworldNexus as advance, assertStandaloneHomeworldNexusCustody as custody,
  buyStandaloneHomeworldMoritaniArmament as buyArmament, openStandaloneHomeworldGuildDeath as guildDeathBattle,
  createStandaloneHomeworldEcazCunning as ecazProgramme,
  createStandaloneHomeworldNexusClosing as closing, createStandaloneHomeworldNexusDiscovery as discovery,
  createStandaloneHomeworldNexusSetup as setup,
  nextStandaloneHomeworldNexusStep as next, openStandaloneHomeworldMoritaniDeath as deathBattle,
  orderStandaloneHomeworldNexusSpice as orderSpice, reloadStandaloneHomeworldNexus as reload,
  revealStandaloneHomeworldNexusPlans as reveal, settleStandaloneHomeworldNexus as settle,
  standaloneHomeworldNexusClean as clean, standaloneHomeworldNexusPlayer as player,
  standaloneHomeworldNexusPolicy as policy, standaloneHomeworldNexusPool as pool,
  stepStandaloneHomeworldNexus as step, type StandaloneHomeworldNexusStep,
} from './fixture-homeworld-standalone-nexus';

function reject(g: Game, actor: string, action: Action, reason?: RegExp): void {
  const before = structuredClone(g);
  if (reason) assert.throws(() => applyAction(g, actor, action), reason);
  else assert.throws(() => applyAction(g, actor, action));
  assert.deepEqual(g, before);
}
/** Every difficulty acts at a genuine window and demonstrates its physical
 * consumer transition. Applying an action without throwing is not the proof. */
function legalPolicies(g: Game, actor: string, consume: (after: Game, action: Action) => void): void {
  for (const difficulty of DIFFICULTIES) {
    const offered = policy(g, actor, difficulty); assert.ok(offered[0], `${difficulty} needs an actual owned choice.`);
    const after = applyAction(reload(g), actor, offered[0]);
    consume(after, offered[0]); custody(after);
  }
}
function finishSettlement(g: Game, actions?: StandaloneHomeworldNexusStep[]): Game {
  for (let n = 0; n < 80; n++) {
    const boundary = settle(g, actions); g = boundary.game;
    if (boundary.kind === 'settled') return g;
    const d = g.decision; assert.ok(d);
    let action: Action;
    if (d.kind === 'battleLosses') action = { type: 'decision', choice: 0 };
    else if (d.kind === 'battleCards') action = { type: 'decision', discard: [] };
    else if (d.kind === 'sukRescue') action = { type: 'decision', event: d.event, choice: 0 };
    else if (d.kind === 'moritaniAssassinate') action = { type: 'decision', event: d.event, decline: true };
    else if (d.kind === 'techToken') {
      const target = d.choices[0];
      assert.equal(g.battle, null, 'Original battle disposal precedes mandatory winner Tech.');
      assert.ok(!g.pendingSukRescue && !g.pendingWinnerDiscards);
      for (const entry of g.lastBattleContext!.mandatoryDiscard?.entries ?? [])
        assert.ok(g.discard.some(c => c.id === entry.card), 'Played cards are physically cleaned before the reward.');
      reject(g, d.loser, { type: 'decision', token: target });
      reject(g, d.player, { type: 'decision', decline: true });
      legalPolicies(g, d.player, (after, selected) => {
        const token = selected.token as keyof NonNullable<Game['techTokens']>;
        assert.ok(d.choices.includes(token)); assert.equal(after.techTokens![token].owner, d.player);
      });
      action = { type: 'decision', token: target };
    } else throw Error(`Unexpected original settlement boundary ${d.kind}`);
    g = step(g, { actor: d.player, action }, actions);
  }
  throw Error('Original physical settlement did not finish.');
}

void test('a genuine native closing deal and living unclaimed Ecaz Cunning coexist with real native Wallach custody, never Intrusion or Homeworld Occupy', () => {
  const f = ecazProgramme({ discovery: true });
  assert.equal(f.firstStorm.techTokens && ownedTech(f.firstStorm.techTokens, f.owner).length, 1);
  assert.deepEqual(f.firstMentat.after.strongholdCards!.owners, strongholdControllers(f.firstMentat.before.players, false));
  assert.equal(f.afterSetup.dukeVidal!.controller, null);
  assert.equal(f.afterSetup.dukeVidal!.leader.dead, false);
  assert.equal(player(f.alliance, f.owner).ally, null);
  assert.equal(f.draw.before.nexusCards!.cards!.hands[f.owner], null);
  assert.equal(f.draw.after.nexusCards!.cards!.hands[f.owner], 'ecaz');
  assert.ok(!f.draw.after.nexusCards!.cards!.deck.includes('ecaz'));
  legalPolicies(f.draw.before, f.owner, after => {
    assert.equal(after.nexusCards!.cards!.hands[f.owner], 'ecaz');
    assert.ok(!after.nexusCards!.cards!.deck.includes('ecaz'));
  });
  reject(f.draw.before, f.opponent, f.draw.step.action);
  reject(f.draw.after, f.owner, f.draw.step.action);

  const shipper = player(f.arrival.before, f.owner), arrived = player(f.arrival.settled, f.owner);
  const sources = nativeShipmentSources(viewGame(f.arrival.before, f.owner), 1, 0); assert.ok(sources);
  const choice = homeworldShipmentChoice(viewGame(f.arrival.before, f.owner), f.location,
    Object.fromEntries(Object.entries(sources).filter(([, group]) => group.normal + group.elite > 0)));
  assert.equal(arrived.spice, shipper.spice - choice.cost);
  assert.equal(arrived.reserves, shipper.reserves - 1);
  assert.equal(pool(f.arrival.settled, f.owner, f.location).normal, 1);
  assert.deepEqual(pool(f.arrival.settled, f.opponent, f.location), pool(f.arrival.before, f.opponent, f.location));
  assert.ok(!f.arrival.settled.pendingAmbassador && !f.arrival.settled.pendingTerrorEntry);
  assert.notEqual(f.arrival.settled.decision?.kind, 'intrusion');
  assert.ok(!Object.keys(arrived.forces).some(key => key.startsWith('homeworld:')));
  assert.ok(!Object.keys(player(f.arrival.settled, f.opponent).advisors ?? {}).some(key => key.startsWith('homeworld:')));
  assert.equal(f.game.battle!.territory, f.location);
  custody(f.arrival.settled);

  const action = nexusEcazDukeAction(viewGame(f.cunning.before, f.owner)); assert.ok(action);
  reject(f.cunning.before, f.opponent, action);
  reject(f.cunning.before, f.owner, { ...action, event: 'stale' });
  legalPolicies(f.cunning.before, f.owner, after => {
    assert.equal(after.dukeVidal!.controller, f.owner);
    assert.equal(after.nexusCards!.cards!.hands[f.owner], null);
    assert.equal(after.nexusCards!.cards!.discard.filter(c => c === 'ecaz').length, 1);
  });
  assert.equal(f.cunning.after.dukeVidal!.controller, f.owner);
  assert.equal(f.cunning.after.dukeVidal!.source, 'ecazNexus');
  assert.equal(f.cunning.after.dukeVidal!.leader.dead, false);
  assert.ok(!f.cunning.after.leaderSkills!.assignments.some(a => a.leader === DUKE_VIDAL_ID));
  assert.ok(player(f.cunning.after, f.owner).leaders.every(l => l.id !== DUKE_VIDAL_ID));
  reject(f.cunning.after, f.owner, action);
  reject(f.game, f.owner, action, /interaction|unavailable|current/i);

  const revealed = reveal(f.game, f.plans, f.actions);
  assert.equal(player(revealed, f.opponent).spice, player(f.game, f.opponent).spice,
    'The real sealed plan does not debit dialed support at reveal.');
  const done = finishSettlement(revealed, f.actions);
  assert.equal(done.lastBattleContext!.winner, f.opponent);
  assert.equal(player(done, f.opponent).spice, player(revealed, f.opponent).spice - 3,
    'Free native strength never pays for three dialed support.');
  assert.equal(player(done, f.opponent).tanks, player(revealed, f.opponent).tanks + 3);
  assert.equal(pool(done, f.opponent, f.location).normal, pool(revealed, f.opponent, f.location).normal - 3);
  assert.equal(player(done, f.owner).tanks, player(revealed, f.owner).tanks + 1);
  assert.equal(pool(done, f.owner, f.location).normal, 0);
  assert.equal(done.dukeVidal!.leader.dead, false);
  assert.equal(done.leaderSkills!.assignments.find(a => a.owner === f.owner)!.leader, f.trainer);
  const token = ownedTech(revealed.techTokens, f.owner)[0]; assert.ok(token);
  assert.equal(done.techTokens![token].owner, f.opponent);
  custody(done);

  // The genuine next Nexus changes the alliance, not the physical identity of
  // either counter pool. Paid Arrakis shipments may now occupy one territory;
  // those same seats still cannot use allied native-home shipment as Occupy.
  let g = advance(done, s => s.turn === 3 && s.phase === 1 && clean(s), f.actions);
  assert.equal(g.dukeVidal!.controller, null);
  orderSpice(g, true);
  g = advance(g, s => s.nexus && !s.spiceWindow && !s.spiceResolution && clean(s), f.actions);
  const guild = g.players.find(p => p.faction === 'guild')!.id;
  g = step(g, { actor: guild, action: { type: 'alliance', target: null } }, f.actions);
  for (const [actor, target] of [[f.owner, guild], [guild, f.owner]])
    g = step(g, { actor, action: { type: 'alliance', target } }, f.actions);
  assert.equal(ecazOccupancyRelation(g.players, f.owner, guild, { kind: 'territory', id: 'polar_sink' }), 'ecazAlliance');
  assert.equal(ecazOccupancyRelation(g.players, f.owner, guild, { kind: 'homeworld', id: 'homeworld:guild' }), 'different');
  const shipped: Record<string, boolean> = {};
  for (let n = 0; n < 240; n++) {
    if (shipped[f.owner] && shipped[guild] && g.phase >= 6 && clean(g)) break;
    if (g.phase === 5 && clean(g) && g.active && !shipped[g.active] && [f.owner, guild].includes(g.active)) {
      const actor = g.active, view = viewGame(g, actor), own = player(g, actor);
      const reserves = nativeShipmentSources(view, 1, 0); assert.ok(reserves);
      if (actor === f.owner) {
        const alliedHome = homeworldShipmentChoice(view, 'homeworld:guild', reserves);
        assert.equal(alliedHome.action, null);
        assert.ok(alliedHome.blocked);
      }
      const before = reload(g);
      g = step(g, { actor, action: { type: 'ship', territory: 'polar_sink', sector: 0, amount: 1,
        elite: 0, allyPayment: 0, homeworldSources: reserves } }, f.actions);
      g = advance(g, s => !s.pendingShipment && clean(s), f.actions);
      assert.equal(player(g, actor).reserves, own.reserves - 1);
      assert.equal(player(g, actor).forces['polar_sink:0'], (player(before, actor).forces['polar_sink:0'] ?? 0) + 1);
      assert.ok(player(g, actor).spice < own.spice);
      shipped[actor] = true;
    } else {
      const owned = next(g); assert.ok(owned); g = step(g, owned, f.actions);
    }
  }
  assert.ok(shipped[f.owner] && shipped[guild]);
  assert.equal(player(g, f.owner).forces['polar_sink:0'], 1);
  assert.equal(player(g, guild).forces['polar_sink:0'], 1);
  assert.equal(g.battle, null, 'Original allied Arrakis Occupy is not a battle between those two seats.');
  custody(g);
});

void test('original Moritani private rescue → assassination → exact death Skill return → card cleanup/Tech → private replacement precedes five actual own deaths and paid own revival', () => {
  const f = closing({ faction: 'moritani', advanced: true, discovery: true, tech: true, strongholds: true });
  assert.equal(f.draw.after.nexusCards!.cards!.hands[f.owner], 'moritani');
  const target = f.afterSetup.leaderSkills!.assignments.find(a => a.owner === f.opponent)!.leader;
  assert.equal(player(f.afterSetup, f.opponent).leaders.find(l => l.id === target)!.name, 'Master Bewt');
  assert.ok(player(f.afterSetup, f.owner).traitors.includes(target));
  const firstDisc = player(f.afterSetup, f.owner).leaders.find(l => l.id !== f.trainer)!.id;
  const discs = [firstDisc, ...player(f.afterSetup, f.opponent).leaders.map(l => l.id).filter(id => id !== target)];
  const purchased = buyArmament(f, f.game);
  assert.equal(player(purchased.game, f.owner).spice, player(purchased.before, f.owner).spice - purchased.bought.length);
  assert.ok(player(purchased.game, f.owner).hand.some(c => c.id === purchased.weapon));
  assert.ok(player(purchased.game, f.owner).hand.some(c => c.id === purchased.defense));
  let g = purchased.game;
  for (const [index, disc] of discs.entries()) {
    const battle = index === 0 ? deathBattle(f, g, disc, true)
      : guildDeathBattle(f, g, disc, purchased.weapon, purchased.defense);
    const visitor = index === 0 ? f.owner : f.opponent;
    assert.equal(player(battle.settledArrival, visitor).reserves, player(battle.arrival.before, visitor).reserves - 1);
    assert.equal(pool(battle.settledArrival, visitor, battle.location).normal, 1);
    assert.ok(player(battle.settledArrival, visitor).spice < player(battle.arrival.before, visitor).spice);
    const revealed = reveal(battle.game, battle.plans, f.actions);
    assert.equal(player(revealed, f.opponent).spice, player(battle.game, f.opponent).spice);
    g = revealed;
    if (index === 0) {
      let boundary = settle(g, f.actions);
      for (let n = 0; boundary.kind === 'losses' || boundary.kind === 'rescue'; n++) {
        assert.ok(n < 12);
        const d = boundary.game.decision; assert.ok(d);
        g = step(boundary.game, { actor: d.player, action: { type: 'decision', ...(d.kind === 'sukRescue' ? { event: d.event } : {}), choice: 0 } }, f.actions);
        boundary = settle(g, f.actions);
      }
      assert.equal(boundary.kind, 'assassination'); g = boundary.game;
      assert.equal(g.lastBattleContext!.sukRescue!.completed, true);
      assert.deepEqual(g.lastBattleContext!.sukRescue!.physical!.saved, { normal: 1, elite: 0 });
      assert.equal(player(g, f.opponent).tanks, player(revealed, f.opponent).tanks);
      assert.equal(pool(g, f.opponent, 'homeworld:guild').normal, pool(revealed, f.opponent, 'homeworld:guild').normal,
        'Native rescue saves its real dialed casualty back at the SAME home.');
      assert.equal(player(g, f.opponent).spice, player(revealed, f.opponent).spice - 1 +
        player(revealed, f.owner).leaders.find(l => l.id === disc)!.strength,
      'Ordinary paid support and the killed opposing-disc reward both settle before assassination.');
      assert.equal(player(g, f.owner).spice, player(revealed, f.owner).spice,
        'A native-home loss pays no Arrakis Worthless income; the separate assassination bounty is still pending.');
      assert.equal(player(g, f.owner).leaders.find(l => l.id === disc)!.dead, true);
      assert.equal(player(g, f.opponent).leaders.find(l => l.id === target)!.dead, false);
      assert.notEqual(revealed.battle!.plans[f.opponent].leader, target);
      const d = g.decision; assert.ok(d?.kind === 'moritaniAssassinate');
      const bounty = player(g, f.opponent).leaders.find(l => l.id === target)!.strength;
      const reserve = [...g.traitorReserve!], held = [...player(g, f.owner).traitors], before = reload(g);
      const pendingToken = ownedTech(g.techTokens, f.owner)[0]; assert.ok(pendingToken);
      assert.equal(g.techTokens![pendingToken].owner, f.owner, 'Winner reward has not bypassed the private aftermath.');
      const action: Action = { type: 'decision', event: d.event, card: target };
      reject(g, f.opponent, action);
      reject(g, f.owner, { ...action, event: 'stale' });
      reject(g, f.owner, { ...action, card: revealed.battle!.plans[f.opponent].leader });
      legalPolicies(g, f.owner, after => {
        assert.equal(player(after, f.opponent).leaders.find(l => l.id === target)!.dead, true);
        assert.equal(player(after, f.owner).spice, player(before, f.owner).spice + bounty);
        assert.equal(after.leaderSkills!.assignments.some(a => a.leader === target), false);
        assert.equal(after.leaderSkills!.deck.filter(s => s === 'suk-graduate').length, 1);
      });
      g = step(g, { actor: f.owner, action }, f.actions);
      assert.equal(player(g, f.opponent).leaders.find(l => l.id === target)!.deaths,
        player(before, f.opponent).leaders.find(l => l.id === target)!.deaths + 1);
      assert.deepEqual(g.homeworlds!.custody, before.homeworlds!.custody);
      assert.equal(player(g, f.opponent).tanks, player(before, f.opponent).tanks);
      assert.equal(g.leaderSkills!.assignments.some(a => a.leader === target), false);
      assert.equal(g.leaderSkills!.deck.filter(s => s === 'suk-graduate').length, 1);
      g = finishSettlement(g, f.actions);
      const worthless = battle.plans[0].action.weapon as string; assert.ok(worthless);
      assert.ok(g.discard.some(c => c.id === worthless));
      assert.ok(!player(g, f.owner).hand.some(c => c.id === worthless));
      const token = ownedTech(before.techTokens, f.owner)[0]; assert.ok(token);
      assert.equal(g.techTokens![token].owner, f.opponent);
      assert.equal(player(g, f.owner).spice, player(before, f.owner).spice + bounty);
      g = advance(g, s => s.phase === 8, f.actions);
      const replacement = g.moritaniAssassinate!.opportunities.at(-1)!;
      assert.equal(replacement.stage, 'replaced'); assert.equal(replacement.replacement, reserve[0]);
      assert.deepEqual(g.traitorReserve, reserve.slice(1));
      assert.deepEqual(player(g, f.owner).traitors, [...held.filter(c => c !== target), reserve[0]]);
      assert.equal('replacement' in viewGame(g, f.opponent).moritaniAssassinate!.history.at(-1)!, false);
    } else g = finishSettlement(g, f.actions);
    const victim = index === 0 ? f.owner : f.opponent, winner = index === 0 ? f.opponent : f.owner;
    assert.equal(g.lastBattleContext!.winner, winner);
    assert.equal(player(g, f.opponent).leaders.filter(l => l.dead).length, index + 1);
    assert.equal(player(g, victim).leaders.find(l => l.id === disc)!.deaths,
      player(battle.game, victim).leaders.find(l => l.id === disc)!.deaths + 1);
    assert.equal(player(g, victim).tanks, player(revealed, victim).tanks + 1);
    assert.equal(pool(g, victim, battle.location).normal, 0);
    if (index > 0) {
      assert.equal(player(g, f.owner).leaders.filter(l => l.dead).length, 1,
        'The actual native winner stays alive; auctioned Shield stops the original Guild projectile before its loser cleanup.');
      assert.equal(player(g, f.owner).tanks, player(revealed, f.owner).tanks + 1);
      assert.equal(pool(g, f.owner, battle.location).normal, pool(revealed, f.owner, battle.location).normal - 1);
      assert.equal(player(g, f.owner).spice, player(revealed, f.owner).spice - 1 +
        player(revealed, f.opponent).leaders.find(l => l.id === disc)!.strength,
      'The actual native winner pays support and receives the ordinary opposing-leader death reward once.');
      for (const card of [purchased.weapon, purchased.defense]) {
        assert.ok(player(g, f.owner).hand.some(c => c.id === card));
        assert.ok(!g.discard.some(c => c.id === card));
      }
      if (battle.plans[1].action.weapon) {
        assert.ok(g.discard.some(c => c.id === battle.plans[1].action.weapon));
        assert.ok(!player(g, f.opponent).hand.some(c => c.id === battle.plans[1].action.weapon));
      }
    } else {
      const weapon = battle.plans[1].action.weapon as string;
      assert.equal(player(g, f.opponent).hand.filter(c => c.id === weapon).length, 1);
      assert.ok(!g.discard.some(c => c.id === weapon));
    }
    custody(g);
    const turn = g.turn;
    g = advance(g, s => s.turn === turn + 1 && s.phase === 1 && clean(s), f.actions);
    orderSpice(g);
    g = advance(g, s => s.phase === 4 && clean(s), f.actions);
    if (index < discs.length - 1) reject(g, f.opponent, { type: 'reviveLeader', leader: target }, /All leaders must die/);
  }
  assert.equal(player(g, f.opponent).leaders.filter(l => l.dead).length, 5);
  assert.equal(g.leaderSkills!.assignments.some(a => a.owner === f.opponent), false);
  assert.equal(g.leaderSkills!.deck.filter(s => s === 'suk-graduate').length, 1);
  assert.equal(g.leaderSkills!.assignments.find(a => a.owner === f.owner)!.leader, f.trainer);
  const before = reload(g), dead = player(g, f.opponent).leaders.find(l => l.id === target)!;
  reject(g, f.owner, { type: 'reviveLeader', leader: target });
  g = step(g, { actor: f.opponent, action: { type: 'reviveLeader', leader: target } }, f.actions);
  g = advance(g, s => !!s.leaderSkills!.offers[f.opponent], f.actions);
  assert.equal(player(g, f.opponent).spice, player(before, f.opponent).spice - dead.strength);
  assert.equal(player(g, f.opponent).leaders.find(l => l.id === target)!.dead, false);
  assert.equal(player(g, f.opponent).leaders.filter(l => l.dead).length, 4);
  assert.equal(viewGame(g, f.owner).leaderSkills!.offer, null);
  assert.equal(viewGame(g, f.opponent).leaderSkills!.offer!.cards.length, 0);
  const event = viewGame(g, f.opponent).leaderSkills!.offer!.event;
  legalPolicies(g, f.opponent, after => {
    assert.equal(viewGame(after, f.opponent).leaderSkills!.offer!.cards.length, 2);
    assert.equal(player(after, f.opponent).spice, player(g, f.opponent).spice);
  });
  g = step(g, { actor: f.opponent, action: { type: 'leaderSkill', event, mode: 'draw' } }, f.actions);
  const offer = viewGame(g, f.opponent).leaderSkills!, skill = offer.offer!.cards.find(s => !offer.unavailableSkills?.[s]); assert.ok(skill);
  reject(g, f.owner, { type: 'leaderSkill', event, skill, leader: target });
  reject(g, f.opponent, { type: 'leaderSkill', event, skill, leader: DUKE_VIDAL_ID });
  g = step(g, { actor: f.opponent, action: { type: 'leaderSkill', event, skill, leader: target } }, f.actions);
  assert.equal(g.leaderSkills!.assignments.find(a => a.owner === f.opponent)!.leader, target);
  assert.equal(player(g, f.opponent).spice, player(before, f.opponent).spice - dead.strength);
  assert.equal(g.nexusCards!.cards!.hands[f.owner], 'moritani'); custody(g);
});

void test('Basic native Moritani loss keeps normal same-home Suk but never gains Advanced private assassination', () => {
  const f = closing({ faction: 'moritani', advanced: false, discovery: false, tech: true });
  const disc = player(f.afterSetup, f.owner).leaders.find(l => l.id !== f.trainer)!.id;
  const battle = deathBattle(f, f.game, disc, true), revealed = reveal(battle.game, battle.plans, f.actions);
  const done = finishSettlement(revealed, f.actions);
  assert.equal(done.lastBattleContext!.winner, f.opponent);
  assert.equal(done.lastBattleContext!.sukRescue!.completed, true);
  assert.deepEqual(done.lastBattleContext!.sukRescue!.physical!.saved, { normal: 1, elite: 0 });
  assert.equal(pool(done, f.opponent, 'homeworld:guild').normal, pool(revealed, f.opponent, 'homeworld:guild').normal);
  const target = done.leaderSkills!.assignments.find(a => a.owner === f.opponent)!.leader;
  assert.equal(player(done, f.opponent).leaders.find(l => l.id === target)!.dead, false);
  assert.equal(done.leaderSkills!.assignments.find(a => a.leader === target)!.skill, 'suk-graduate');
  custody(done);
});

for (const faction of ['ecaz', 'moritani'] as const) void test(`${faction} original Discovery shipment/reveal/free nested entry keeps all native reserve identity while all12 Nexus stay undealt`, () => {
  const f = discovery({ faction, advanced: false, roster: [faction, 'guild', 'emperor', 'beneGesserit'], tech: true });
  assert.equal(player(f.afterShipment, f.owner).reserves, player(f.beforeShipment, f.owner).reserves - 2);
  assert.ok(player(f.afterShipment, f.owner).spice < player(f.beforeShipment, f.owner).spice);
  assert.equal(pool(f.afterShipment, f.owner, `homeworld:${faction}`).normal, player(f.afterShipment, f.owner).reserves);
  assert.equal(f.revealed.discoveries!.tokens.find(t => t.id === f.token)!.revealedTurn, 1);
  assert.equal(player(f.entry.before, f.owner).forces['gara_kulon:8'], 2);
  assert.equal(player(f.entry.after, f.owner).forces['gara_kulon:8'] ?? 0, 0);
  assert.equal(player(f.entry.after, f.owner).forces['cistern:0'], 2);
  assert.equal(player(f.entry.after, f.owner).spice, player(f.entry.before, f.owner).spice);
  assert.equal(player(f.entry.after, f.owner).reserves, player(f.entry.before, f.owner).reserves);
  assert.deepEqual(f.entry.after.homeworlds!.custody, f.entry.before.homeworlds!.custody);
  assert.ok(Object.values(f.entry.after.nexusCards!.cards!.hands).every(c => c === null));
  const action = discoveryEntryMoveAction(viewGame(f.entry.before, f.owner), viewGame(f.entry.before, f.owner).discoveryEntry!.sources); assert.ok(action);
  reject(f.entry.before, f.opponent, action);
  reject(f.entry.after, f.owner, action);
  legalPolicies(f.entry.before, f.owner, (after, offered) => {
    assert.equal(player(after, f.owner).spice, player(f.entry.before, f.owner).spice);
    assert.equal(player(after, f.owner).reserves, player(f.entry.before, f.owner).reserves);
    if (offered.groups) assert.equal(player(after, f.owner).forces['cistern:0'], 2);
    else assert.equal(player(after, f.owner).forces['gara_kulon:8'], 2);
    assert.notEqual(after.decision?.kind, 'discoveryEntry');
  });
  custody(f.entry.after);
});

void test('original skill offers keep human choices while Duke training and Advanced Harkonnen reject before custody conversion', () => {
  const original = createGame('SUPPLIEDHWE3NX', newPlayer('native-original', 'Original native', 'ecaz'), false, ['ecaz']);
  joinGame(original, newPlayer('guild-original', 'Original Guild', 'guild'));
  const f = setup({ initial: original });
  const trained = f.afterSetup.leaderSkills!.assignments.find(a => a.owner === f.owner)!;
  const own = viewGame(f.offered, f.owner).leaderSkills!;
  assert.ok(own.offer!.cards.includes(trained.skill));
  assert.ok(own.eligibleLeaders.some(l => l.id === trained.leader));
  reject(f.offered, f.owner, { type: 'leaderSkill', event: own.offer!.event, skill: trained.skill, leader: DUKE_VIDAL_ID });
  const unsupported = own.offer!.cards.includes('mentat') ? 'warmaster' : 'mentat';
  if (!own.offer!.cards.includes(unsupported)) reject(f.offered, f.owner,
    { type: 'leaderSkill', event: own.offer!.event, skill: unsupported, leader: trained.leader });
  legalPolicies(f.offered, f.owner, after => {
    const assignment = after.leaderSkills!.assignments.find(a => a.owner === f.owner); assert.ok(assignment);
    assert.ok(own.offer!.cards.includes(assignment.skill));
    assert.ok(player(after, f.owner).leaders.some(l => l.id === assignment.leader));
    assert.notEqual(assignment.leader, DUKE_VIDAL_ID);
  });
  for (const [advanced, factions] of [
    [true, ['ecaz', 'guild', 'harkonnen']],
    [true, ['moritani', 'guild', 'harkonnen']],
  ] as const) {
    let g = createGame('ORIGINALSTANDALONEGUARD', newPlayer(factions[0], factions[0], factions[0]), advanced, ['ecaz']);
    for (const faction of factions.slice(1)) joinGame(g, newPlayer(faction, faction, faction));
    g = applyAction(g, g.host, { type: 'homeworlds', enabled: true });
    g.nexusCards = { cards: null, phase: null };
    for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
    const before = structuredClone(g);
    assert.throws(() => initializeLeaderSkillsGameForAudit(g)); assert.deepEqual(g, before);
    assert.equal(g.homeworlds!.custody, null);
  }
});
