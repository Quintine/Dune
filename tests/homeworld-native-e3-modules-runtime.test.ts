import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction, createGame, initializeDiscoveryGameForAudit, initializeLeaderSkillsGameForAudit,
  joinGame, newPlayer, viewGame, type Action, type Game,
} from '../game/engine';
import { DIFFICULTIES } from '../game/bot-profiles';
import type { FactionId } from '../game/catalog';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { ecazOccupancyRelation } from '../game/ecaz-occupy';
import { ownedTech } from '../game/tech-tokens';
import { DUKE_VIDAL_ID } from '../game/duke-vidal';
import {
  advanceNativeE3Homeworld as advance, assertNativeE3HomeworldCustody as custody,
  createNativeE3HomeworldBattle as battle, createNativeE3HomeworldDiscovery as discovery,
  createNativeE3HomeworldRevival as revival, createNativeE3HomeworldSetup as setup,
  invadeNativeE3Homeworld as invade,
  nativeE3HomeworldClean as clean, nativeE3HomeworldPlayer as player,
  nativeE3HomeworldPolicy as policy, nativeE3HomeworldPool as pool,
  rescueNativeE3Homeworld as rescue, revealNativeE3HomeworldPlans as reveal,
  settleNativeE3HomeworldBattle as settle, type NativeE3HomeworldOptions,
} from './fixture-homeworld-native-e3-modules';

function legalPolicies(game: Game, actor: string): void {
  for (const difficulty of DIFFICULTIES) {
    const actions = policy(game, actor, difficulty); assert.ok(actions.length, `${difficulty} has an actual owned offer`);
    for (const action of actions) {
      const next = applyAction(structuredClone(game), actor, action);
      if (next.homeworlds?.custody) custody(next);
    }
  }
}
function reject(game: Game, actor: string, action: Action, reason?: RegExp): void {
  const before = structuredClone(game);
  if (reason) assert.throws(() => applyAction(game, actor, action), reason);
  else assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}

void test('original standalone Ecaz or Moritani Homeworld module envelopes use native Ecaz33, five discs, all14 before faction setup and DS7+8 at supported seat boundaries', () => {
  const modules: Pick<NativeE3HomeworldOptions, 'skills' | 'discovery'>[] = [
    { skills: true, discovery: false }, { skills: false, discovery: true }, { skills: true, discovery: true },
  ];
  for (const faction of ['ecaz', 'moritani'] as const) for (const advanced of [false, true]) {
    for (const composition of modules) for (const tech of [false, true]) for (const strongholds of advanced ? [false, true] : [false]) {
      for (const count of [tech ? 3 : 2, 6]) {
        const roster: FactionId[] = [faction, 'guild', 'emperor', 'atreides', 'fremen', 'beneGesserit'];
        const lobby = createGame('ORIGINALNATIVEHWE3', newPlayer('native-original', 'Original native', faction), advanced, ['ecaz']);
        for (const [i, f] of roster.slice(1, count).entries()) joinGame(lobby, newPlayer(`original-${i}`, `Original ${f}`, f));
        const f = setup({ initial: lobby, faction, advanced, ...composition, tech, strongholds });
        const own = player(f.afterSetup, f.owner);
        assert.equal(own.reserves, 14); assert.equal(Object.values(own.forces).reduce((a, b) => a + b, 0), 6);
        assert.equal(pool(f.afterSetup, f.owner, `homeworld:${faction}`).normal, 14);
        assert.equal(own.leaders.length, 5); assert.equal(f.afterSetup.dukeVidal!.leader.id, DUKE_VIDAL_ID);
        if (composition.skills) {
          assert.equal(f.afterSetup.leaderSkills!.assignments.length, count);
          assert.deepEqual([...f.afterSetup.leaderSkills!.deck, ...f.afterSetup.leaderSkills!.assignments.map(a => a.skill)].sort(),
            LEADER_SKILL_CARDS.map(c => c.id).sort());
        } else assert.equal(f.afterSetup.leaderSkills, undefined);
        if (composition.discovery) {
          const spice = [...f.afterSetup.spiceDeck, ...f.afterSetup.spiceDiscard.flat()];
          assert.equal(spice.filter(c => 'territory' in c && !!c.discovery).length, 6);
          assert.equal(spice.filter(c => 'worm' in c && c.greatMaker).length, 1);
          assert.equal(f.afterSetup.discoveries!.tokens.length, 8);
        } else assert.equal(f.afterSetup.discoveries, undefined);
        if (strongholds) assert.ok(Object.values(f.afterSetup.strongholdCards!.owners).every(o => o === null));
        assert.equal(!!f.afterSetup.moritaniAssassinate, advanced && faction === 'moritani');
        if (faction === 'ecaz') {
          assert.equal(f.afterSetup.ecazAmbassadors!.tokens.length, 11);
          assert.equal(f.afterSetup.ecazAmbassadors!.tokens.filter(t => t.zone === 'supply').length, 6);
        } else assert.equal(f.afterSetup.moritaniTerror!.tokens.length, 6);
        custody(f.afterSetup);
      }
    }
  }
});

for (const faction of ['ecaz', 'moritani'] as const) for (const advanced of [false, true]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} ${faction} native and visitor Suk consume real casualties and preserve owner-labelled native/visitor pools`, () => {
    for (const visitor of [false, true]) {
      const f = battle({ faction, advanced, visitor, skills: true, discovery: true, tech: true, strongholds: advanced });
      const shipper = visitor ? f.owner : f.opponent, native = visitor ? f.opponent : f.owner;
      assert.equal(player(f.afterShipment, shipper).reserves, player(f.beforeShipment, shipper).reserves - 5);
      assert.equal(pool(f.afterShipment, shipper, f.location).normal, 5);
      assert.deepEqual(pool(f.afterShipment, native, f.location), pool(f.beforeShipment, native, f.location));
      assert.ok(player(f.afterShipment, shipper).spice < player(f.beforeShipment, shipper).spice);
      assert.ok(!Object.keys(player(f.afterShipment, shipper).forces).some(key => key.startsWith('homeworld:')));
      legalPolicies(f.beforeShipment, shipper); legalPolicies(f.game, f.owner);
      const revealed = reveal(f.game, f.plans), pending = settle(revealed, 'suk');
      assert.ok(pending.decision?.kind === 'sukRescue');
      assert.equal(pending.decision.player, f.owner); assert.equal(pending.pendingSukRescue!.skill.mode, 'skilled');
      assert.equal(pending.pendingSukRescue!.territory, f.location);
      legalPolicies(pending, f.owner);
      const beforePool = pool(pending, f.owner, f.location), beforeReserve = player(pending, f.owner).reserves;
      const beforeTanks = player(pending, f.owner).tanks;
      const maximum = Math.max(...pending.decision.options.map(o => o.normal + o.elite));
      const choice = pending.decision.options.findIndex(o => o.normal + o.elite === maximum && o.kept?.kind === 'normal');
      const option = pending.decision.options[choice], losses = pending.pendingSukRescue!.losses!;
      reject(pending, f.owner, { type: 'decision', event: pending.decision.event, choice,
        destinations: { 'homeworld:emperor': { normal: option.normal, elite: 0 } } });
      const done = settle(rescue(structuredClone(pending)));
      assert.equal(done.lastBattleContext?.winner, f.owner);
      assert.equal(player(done, f.owner).tanks - beforeTanks, losses.normal + losses.elite - option.normal - option.elite);
      const afterPool = pool(done, f.owner, f.location);
      if (visitor) {
        assert.equal(afterPool.normal, beforePool.normal - losses.normal + 1);
        assert.equal(player(done, f.owner).reserves, beforeReserve + option.normal - 1);
        assert.equal(pool(done, f.owner, `homeworld:${faction}`).normal, player(done, f.owner).reserves);
      } else assert.equal(afterPool.normal, beforePool.normal - losses.normal + option.normal);
      assert.equal(done.pendingSukRescue ?? null, null); custody(done);
    }
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} ${faction} lethal native and visitor Homeworld plans kill the trained disc and return exactly one physical skill`, () => {
    for (const visitor of [false, true]) {
      const f = battle({ faction, advanced, visitor, lethal: true, skill: 'mentat', discovery: true });
      const original = player(f.game, f.owner).leaders.find(l => l.id === f.trainer)!;
      const done = settle(reveal(f.game, f.plans));
      assert.equal(player(done, f.owner).leaders.find(l => l.id === f.trainer)!.dead, true);
      assert.equal(player(done, f.owner).leaders.find(l => l.id === f.trainer)!.deaths, original.deaths + 1);
      assert.equal(done.leaderSkills!.assignments.some(a => a.leader === f.trainer), false);
      assert.equal(done.leaderSkills!.deck.filter(s => s === 'mentat').length, 1);
      const window = advance(done, g => g.turn === 2 && g.phase === 4 && clean(g));
      reject(window, f.owner, { type: 'reviveLeader', leader: f.trainer }, /All leaders must die/);
      assert.equal(window.leaderSkills!.deck.filter(s => s === 'mentat').length, 1); custody(window);
    }
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} ${faction} original parent shipment, reveal and later Discovery entry retain native reserves and printed free-entry payment`, () => {
    for (const skills of [false, true]) {
      const f = discovery({ faction, advanced, skills, tech: true, strongholds: advanced });
      assert.equal(player(f.afterShipment, f.owner).reserves, player(f.beforeShipment, f.owner).reserves - 2);
      assert.ok(player(f.afterShipment, f.owner).spice < player(f.beforeShipment, f.owner).spice);
      assert.equal(player(f.beforeReveal, f.owner).forces['gara_kulon:8'], 2);
      assert.equal(f.afterReveal.discoveries!.tokens.find(t => t.id === f.token)!.revealedTurn, 1);
      assert.equal(player(f.entered, f.owner).forces['gara_kulon:8'] ?? 0, 0);
      assert.equal(player(f.entered, f.owner).forces['cistern:0'], 2);
      assert.equal(player(f.entered, f.owner).spice, player(f.entryWindow, f.owner).spice);
      assert.equal(player(f.entered, f.owner).reserves, player(f.entryWindow, f.owner).reserves);
      assert.deepEqual(f.entered.homeworlds!.custody, f.entryWindow.homeworlds!.custody);
      legalPolicies(f.entryWindow, f.owner); custody(f.entered);
    }
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} ${faction} five paid original visitor invasions establish all-five deaths before one real own revival and private replacement training`, () => {
    const f = revival({ faction, advanced, discovery: true, tech: true, strongholds: advanced });
    assert.equal(new Set(f.deaths.map(d => d.leader)).size, 5);
    for (const [i, death] of f.deaths.entries()) {
      assert.equal(player(death.after, f.owner).leaders.filter(l => l.dead).length, i + 1);
      assert.equal(player(death.after, f.owner).leaders.find(l => l.id === death.leader)!.deaths,
        player(death.before, f.owner).leaders.find(l => l.id === death.leader)!.deaths + 1);
      assert.equal(death.after.lastBattleContext?.winner, f.opponent);
      assert.equal(player(death.after, f.owner).tanks, player(death.before, f.owner).tanks + 1);
      assert.equal(pool(death.after, f.owner, 'homeworld:guild').normal, 0);
      assert.equal(player(death.after, f.opponent).hand.filter(c => c.id === death.weapon).length, 1);
      assert.equal(death.after.discard.some(c => c.id === death.weapon), false); custody(death.after);
    }
    const trainer = player(f.revivalWindow, f.owner).leaders.find(l => l.id === f.trainer)!;
    assert.equal(player(f.offeredRevival, f.owner).spice, player(f.revivalWindow, f.owner).spice - trainer.strength);
    assert.equal(player(f.offeredRevival, f.owner).leaders.find(l => l.id === f.trainer)!.dead, false);
    assert.equal(player(f.offeredRevival, f.owner).leaders.filter(l => l.dead).length, 4);
    assert.equal(viewGame(f.offeredRevival, f.opponent).leaderSkills!.offer, null);
    assert.deepEqual(viewGame(f.offeredRevival, f.owner).leaderSkills!.offer!.cards, []);
    legalPolicies(f.offeredRevival, f.owner);
    const event = f.offeredRevival.leaderSkills!.offers[f.owner].event;
    const drawn = applyAction(structuredClone(f.offeredRevival), f.owner, { type: 'leaderSkill', event, mode: 'draw' });
    const own = viewGame(drawn, f.owner).leaderSkills!, skill = own.offer!.cards.find(s => !own.unavailableSkills?.[s]);
    assert.ok(skill); assert.equal(own.offer!.cards.length, 2);
    const assigned = applyAction(drawn, f.owner, { type: 'leaderSkill', event, skill, leader: f.trainer });
    assert.equal(assigned.leaderSkills!.assignments.find(a => a.owner === f.owner)!.leader, f.trainer);
    assert.equal(player(assigned, f.owner).spice, player(f.offeredRevival, f.owner).spice); custody(assigned);
  });
}

void test('Advanced native Moritani resolves Guild Suk BEFORE assassination, returns the exact trainer card, pays its printed bounty, then draws one private Mentat replacement', () => {
  const f = battle({ faction: 'moritani', advanced: true, assassination: true, discovery: true,
    tech: true, strongholds: true, battleTurn: 2 });
  assert.equal(f.game.strongholdCards!.owners.tueks_sietch, f.opponent);
  const revealed = reveal(f.game, f.plans), pending = settle(revealed, 'assassination');
  assert.deepEqual(pending.lastBattleContext!.sukRescue!.physical!.saved, { normal: 1, elite: 0 });
  assert.equal(pending.lastBattleContext?.sukRescue?.completed, true);
  assert.equal(player(pending, f.opponent).spice, player(revealed, f.opponent).spice - 3,
    'Holding Tuek never applies its Worthless income to a Homeworld battle.');
  const target = pending.leaderSkills!.assignments.find(a => a.owner === f.opponent)!.leader;
  const leader = player(pending, f.opponent).leaders.find(l => l.id === target)!;
  assert.equal(leader.name, 'Master Bewt'); assert.ok(player(pending, f.owner).traitors.includes(target));
  assert.notEqual(revealed.battle!.plans[f.opponent].leader, target);
  const reserve = [...pending.traitorReserve!], ownTraitors = [...player(pending, f.owner).traitors];
  legalPolicies(pending, f.owner);
  const decision = pending.decision; assert.ok(decision?.kind === 'moritaniAssassinate');
  let game = applyAction(structuredClone(pending), f.owner, { type: 'decision', event: decision.event, card: target });
  assert.equal(player(game, f.opponent).leaders.find(l => l.id === target)!.dead, true);
  assert.equal(player(game, f.owner).spice, player(pending, f.owner).spice + leader.strength);
  assert.equal(game.leaderSkills!.assignments.some(a => a.leader === target), false);
  assert.equal(game.leaderSkills!.deck.filter(s => s === 'suk-graduate').length, 1);
  assert.equal(player(game, f.opponent).tanks, player(pending, f.opponent).tanks);
  assert.deepEqual(game.homeworlds!.custody, pending.homeworlds!.custody);
  const lost = ownedTech(pending.techTokens, f.owner); assert.ok(lost.length);
  game = settle(game, 'tech');
  let token = lost[0];
  if (game.decision?.kind === 'techToken') {
    assert.equal(game.decision.player, f.opponent);
    legalPolicies(game, f.opponent);
    reject(game, f.opponent, { type: 'decision', decline: true });
    token = game.decision.choices[0];
    game = applyAction(game, f.opponent, { type: 'decision', token });
    game = settle(game);
  }
  assert.equal(game.techTokens![token].owner, f.opponent);
  assert.equal(player(game, f.opponent).tanks, player(pending, f.opponent).tanks);
  game = advance(game, g => g.phase === 8);
  assert.equal(game.moritaniAssassinate!.opportunities.at(-1)!.stage, 'replaced');
  assert.equal(game.moritaniAssassinate!.opportunities.at(-1)!.replacement, reserve[0]);
  assert.deepEqual(game.traitorReserve, reserve.slice(1));
  assert.deepEqual(player(game, f.owner).traitors, [...ownTraitors.filter(c => c !== target), reserve[0]]);
  assert.equal('replacement' in viewGame(game, f.opponent).moritaniAssassinate!.history.at(-1)!, false);
  game = advance(game, g => g.turn === 3 && g.phase === 4 && clean(g));
  reject(game, f.opponent, { type: 'reviveLeader', leader: target }, /All leaders must die/); custody(game);
});

void test('Basic native Moritani never acquires Advanced assassination after the same original Homeworld loss and normal Guild rescue', () => {
  const f = battle({ faction: 'moritani', advanced: false, assassination: true, discovery: true, tech: true });
  const game = settle(reveal(f.game, f.plans));
  const target = game.leaderSkills!.assignments.find(a => a.owner === f.opponent)!.leader;
  assert.deepEqual(game.lastBattleContext!.sukRescue!.physical!.saved, { normal: 1, elite: 0 });
  assert.equal(game.lastBattleContext?.winner, f.opponent); assert.equal(game.moritaniAssassinate, undefined);
  assert.equal(player(game, f.opponent).leaders.find(l => l.id === target)!.dead, false);
  assert.equal(game.leaderSkills!.assignments.find(a => a.leader === target)!.skill, 'suk-graduate'); custody(game);
});

void test('Homeworlds remain distinct seats rather than Ecaz Occupy territories, and Duke/Harkonnen/E3 pair exclusions remain original guards', () => {
  const seats = [{ id: 'ecaz', faction: 'ecaz' as const, ally: 'guild' },
    { id: 'guild', faction: 'guild' as const, ally: 'ecaz' }, { id: 'bg', faction: 'beneGesserit' as const, ally: null }];
  assert.equal(ecazOccupancyRelation(seats, 'ecaz', 'guild', { kind: 'territory', id: 'arrakeen' }), 'ecazAlliance');
  assert.equal(ecazOccupancyRelation(seats, 'ecaz', 'guild', { kind: 'homeworld', id: 'homeworld:ecaz' }), 'different');
  const f = setup({ faction: 'ecaz', advanced: true });
  legalPolicies(f.offered, f.owner);
  const offer = viewGame(f.offered, f.owner).leaderSkills!.offer!;
  reject(f.offered, f.owner, { type: 'leaderSkill', event: offer.event, skill: offer.cards[0], leader: DUKE_VIDAL_ID });
  for (const roster of [['ecaz', 'moritani', 'guild'], ['ecaz', 'harkonnen', 'guild'], ['moritani', 'harkonnen', 'guild']] as FactionId[][]) {
    let game = createGame('NATIVEHWGUARDS', newPlayer(roster[0], roster[0], roster[0]), true, ['ecaz']);
    for (const faction of roster.slice(1)) joinGame(game, newPlayer(faction, faction, faction));
    game = applyAction(game, game.host, { type: 'homeworlds', enabled: true }); game.discoveryEnabled = true;
    for (const p of game.players) game = applyAction(game, p.id, { type: 'ready' });
    const before = structuredClone(game);
    assert.throws(() => initializeLeaderSkillsGameForAudit(game)); assert.deepEqual(game, before);
    if (roster[0] !== 'ecaz' || roster[1] !== 'harkonnen')
      assert.throws(() => initializeDiscoveryGameForAudit(game));
    assert.deepEqual(game, before);
    assert.equal(game.homeworlds!.custody, null);
  }
  const basic = setup({ faction: 'ecaz', advanced: false, roster: ['ecaz', 'harkonnen', 'guild'], discovery: true });
  assert.equal(player(basic.afterSetup, 'harkonnen').hand.length, 2); custody(basic.afterSetup);
});

void test('actual Ecaz arrival at native Wallach IX never opens BG Intrusion or a territory Occupy battle', () => {
  const f = setup({ faction: 'ecaz', advanced: true, roster: ['ecaz', 'guild', 'beneGesserit'], discovery: true });
  const arrival = invade(f.afterSetup, f.owner, 'homeworld:beneGesserit', 3);
  assert.equal(pool(arrival.after, f.owner, 'homeworld:beneGesserit').normal, 3);
  assert.deepEqual(pool(arrival.after, 'beneGesserit', 'homeworld:beneGesserit'),
    pool(arrival.before, 'beneGesserit', 'homeworld:beneGesserit'));
  assert.equal(arrival.after.decision, null);
  assert.equal(arrival.after.pendingAmbassador ?? null, null);
  assert.ok(!Object.keys(player(arrival.after, 'beneGesserit').advisors ?? {}).some(key => key.startsWith('homeworld:')));
  assert.ok(!Object.keys(player(arrival.after, f.owner).forces).some(key => key.startsWith('homeworld:')));
  custody(arrival.after);
});
