import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { gameDistance, MOBILE_LOCATION, splitLocation } from '../game/board';
import { treacheryDeck } from '../game/cards';
import { DISCOVERY_SPICE_CARDS, validateDiscoveryState } from '../game/discoveries';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { validateNexusCards } from '../game/nexus-cards';
import { nexusFaceDancersAction } from '../game/nexus-tleilaxu-options';
import { ownedTech } from '../game/tech-tokens';
import { traitorDeck } from '../game/traitors';
import { pairedDiscoveryNexusClean as clean, placePairedDiscoveryNexus, reservePairedDiscoveryNexusBoard } from './fixture-discovery-paired-nexus';
import {
  advanceDiscoveryPairedNexusE1Skills as advance, beginDiscoveryPairedNexusE1SkillsCunning as cunning,
  closeDiscoveryPairedNexusE1Skills as close, createDiscoveryPairedNexusE1SkillsBattle as battle,
  createDiscoveryPairedNexusE1SkillsEntry as entry, discoveryPairedNexusE1SkillsPlayer as player,
  discoveryPairedNexusE1SkillsRangeSource as rangeSource, finishDiscoveryPairedNexusE1SkillsBattle as finish,
  initializeDiscoveryPairedNexusE1SkillsSetup as setup, prepareDiscoveryPairedNexusE1SkillsPlans as prepare,
  revealDiscoveryPairedNexusE1SkillsBattle as reveal, stepDiscoveryPairedNexusE1Skills as step,
  type DiscoveryPairedNexusE1SkillsBattle,
} from './fixture-discovery-paired-nexus-e1-skills';

function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'Rejected original action leaves the whole original input untouched');
}
function custody(game: Game, original: Game): void {
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.ixSetupCards ?? []), ...(game.ixAuction?.cards ?? []),
    ...(game.auction?.cards.slice(game.auction.index) ?? [])];
  assert.deepEqual(cards.map(c => c.id).sort(), treacheryDeck(['ix']).map(c => c.id).sort());
  const identities = [...(game.traitorReserve ?? []), ...game.players.flatMap(p => [
    ...p.traitors, ...p.traitorChoices, ...(p.faceDancers ?? []).map(c => c.leader),
  ])];
  assert.deepEqual(identities.sort(), traitorDeck(game.players, true).sort());
  validateLeaderSkills(game.leaderSkills!, game.players);
  assert.deepEqual([...game.leaderSkills!.deck, ...Object.values(game.leaderSkills!.offers).flatMap(o => o.cards),
    ...game.leaderSkills!.assignments.map(a => a.skill)].sort(), LEADER_SKILL_CARDS.map(c => c.id).sort());
  validateDiscoveryState(game.discoveries!); validateNexusCards(game.nexusCards!.cards!, game.players);
  for (const p of game.players) {
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((sum, n) => sum + n, 0), 20);
    if (p.elites) {
      const previous = player(original, p.id).elites!;
      assert.equal(p.elites.reserves + p.elites.tanks + Object.values(p.elites.forces).reduce((sum, n) => sum + n, 0),
        previous.reserves + previous.tanks + Object.values(previous.forces).reduce((sum, n) => sum + n, 0));
      assert.ok(p.elites.reserves <= p.reserves && p.elites.tanks <= p.tanks);
      for (const [key, n] of Object.entries(p.elites.forces)) assert.ok(n <= (p.forces[key] ?? 0));
    }
  }
}
/** Select real Cunning commitment, never assign a loss receipt. */
function rescueWindow(f: DiscoveryPairedNexusE1SkillsBattle, revealed = reveal(f)): Game {
  let game = finish(revealed, 'losses');
  if (game.decision?.kind === 'battleLosses') {
    const choice = game.decision.options.findIndex(o => o.normal === 4 && o.elite === 2); assert.ok(choice >= 0);
    game = step(game, { actor: game.decision.player, action: { type: 'decision', choice } });
  }
  game = finish(game, 'rescue');
  assert.equal(game.decision?.kind, 'sukRescue');
  return game;
}
function rescueAndSubstitute(f: DiscoveryPairedNexusE1SkillsBattle, pending: Game): Game {
  assert.ok(pending.decision?.kind === 'sukRescue');
  const choice = pending.decision.options.findIndex(o => o.normal === 2 && o.elite === 1 && o.kept?.kind === 'normal');
  assert.ok(choice >= 0);
  const rescued = step(pending, { actor: f.owner, action: { type: 'decision', event: pending.decision.event, choice } });
  assert.equal(rescued.decision?.kind, 'ixSubstitution');
  return advance(step(rescued, { actor: f.owner, action: { type: 'decision',
    sources: { [f.location]: 1 }, recover: { [f.location]: 1 } } }),
  game => clean(game) || game.decision?.kind === 'battleCards' || game.decision?.kind === 'faceDance');
}

const MODES = [
  { advanced: false, tech: false, strongholds: false },
  { advanced: false, tech: true, strongholds: false },
  { advanced: true, tech: false, strongholds: false },
  { advanced: true, tech: true, strongholds: false },
  { advanced: true, tech: false, strongholds: true },
  { advanced: true, tech: true, strongholds: true },
] as const;
for (const mode of MODES) void test(`paired E1 Skills ${JSON.stringify(mode)}: original hands, printed collection, END Mentat, Maker and qualified closing`, () => {
  const f = entry(mode);
  assert.deepEqual(f.offered.players.map(p => [p.id, p.hand]), f.afterSetup.players.map(p => [p.id, p.hand]));
  assert.ok(f.offered.players.every(p => !p.traitors.length && !p.traitorChoices.length));
  assert.equal(player(f.offered, f.native).faceDancers, undefined);
  assert.deepEqual(f.setup.spiceDeck.flatMap(c => 'territory' in c && c.discovery ? [c.discovery] : []).sort(),
    DISCOVERY_SPICE_CARDS.map(c => c.discovery).sort());
  assert.equal(f.setup.discoveries!.tokens.length, 8);
  assert.equal(f.setup.spiceDeck.filter(c => 'worm' in c && c.greatMaker).length, 1);
  assert.equal(f.setup.spiceDeck.filter(c => 'sandtrout' in c && c.sandtrout).length, 1);
  assert.equal(f.game.turn, 2); assert.equal(f.game.phase, 0); assert.equal(f.game.decision?.kind, 'discoveryEntry');
  assert.ok(Object.values(f.game.nexusCards!.cards!.hands).every(c => c === null));
  assert.equal(player(f.game, f.owner).forces[f.source], 3);
  assert.equal(player(f.game, f.owner).elites!.forces[f.source], 1);
  if (mode.strongholds) {
    assert.equal(f.firstMentat.before.strongholdCards!.owners.arrakeen, null);
    assert.equal(f.firstMentat.after.strongholdCards!.owners.arrakeen, f.owner);
  }
  const c = close(f), before = player(c.entry.before, f.owner), arrived = player(c.entry.after, f.owner);
  assert.equal(arrived.forces['shrine:0'], 2); assert.equal(arrived.elites!.forces['shrine:0'], 1);
  assert.equal(arrived.forces[f.source], 1); assert.equal(arrived.elites!.forces[f.source] ?? 0, 0);
  assert.equal(arrived.spice, before.spice); assert.equal(arrived.reserves, before.reserves);
  assert.equal(arrived.shipped, before.shipped); assert.equal(arrived.moved, before.moved);
  assert.deepEqual(c.entry.after.leaderSkills, c.entry.before.leaderSkills);
  assert.equal(player(c.vote, f.native).tanks, player(f.game, f.native).tanks + 2);
  assert.equal(player(c.vote, f.native).forces['hagga_basin:12'] ?? 0, 0);
  assert.ok(Object.values(c.vote.nexusCards!.cards!.hands).every(card => card === null));
  assert.equal(player(c.ride.after, f.fremen).forces['polar_sink:0'], 2);
  assert.equal(player(c.ride.after, f.fremen).elites?.forces['polar_sink:0'] ?? 0, mode.advanced ? 1 : 0);
  assert.equal(player(c.ride.after, f.fremen).spice, player(c.ride.before, f.fremen).spice);
  assert.notEqual(c.ride.after.nexusCards!.phase?.stage, 'drawing');
  assert.equal(player(c.drawing, f.guild).ally, f.fremen); assert.equal(player(c.drawing, f.fremen).ally, f.guild);
  assert.deepEqual([...c.drawing.nexusCards!.phase!.eligible].sort(), [f.owner, f.native].sort());
  if (mode.advanced) assert.ok(c.drawing.spiceDiscard[1].some(card => 'territory' in card && card.territory === 'rock_outcroppings'));
  assert.equal(c.afterDraw.nexusCards!.cards!.hands[f.owner], 'ixians');
  assert.equal(c.afterDraw.nexusCards!.cards!.hands[f.native], 'tleilaxu');
  assert.equal(c.afterDraw.nexusCards!.cards!.hands[f.guild], null);
  assert.equal(c.afterDraw.nexusCards!.cards!.hands[f.fremen], null);
  for (const game of [f.afterSetup, f.game, c.entry.after, c.vote, c.ride.after, c.afterDraw]) custody(game, f.afterSetup);
});

void test('paired E1 authenticated original human actors, existing first hands and actual offers survive continuation without requiring Suk', () => {
  const lobby = createGame('HUMANPAIREDE1SKILLS', newPlayer('human-ix', 'Human Ix', 'ixians'), true, ['ix']);
  for (const [id, faction] of [['human-tl', 'tleilaxu'], ['human-gu', 'guild'], ['human-fr', 'fremen']] as const)
    joinGame(lobby, newPlayer(id, faction, faction));
  const fresh = setup({ initial: lobby, skill: 'planetologist', tech: true, strongholds: true });
  assert.deepEqual(fresh.initial, lobby);
  const original = structuredClone(fresh.offered), offered = original.leaderSkills!.offers[fresh.owner];
  const continued = entry({ initial: original });
  assert.deepEqual(continued.initial, original);
  assert.deepEqual(continued.offered.leaderSkills!.offers, original.leaderSkills!.offers);
  assert.deepEqual(continued.afterSetup.players.map(p => [p.id, p.name, p.hand]), original.players.map(p => [p.id, p.name, p.hand]));
  assert.deepEqual(continued.afterSetup.players.map(p => p.id), ['human-ix', 'human-tl', 'human-gu', 'human-fr']);
  assert.ok(offered.cards.includes(continued.skill));
  reject(original, fresh.owner, { type: 'leaderSkill', event: offered.event, skill: offered.cards[0],
    leader: player(original, fresh.native).leaders[0].id });
  const absent = LEADER_SKILL_CARDS.find(c => !offered.cards.includes(c.id))!.id;
  assert.throws(() => entry({ initial: original, skill: absent }));
  assert.deepEqual(original, fresh.offered);
  custody(continued.game, continued.afterSetup);
});

void test('paired E1 source-clear free entry rejects foreign actors and HMS companions; real Planetologist crosses the printed nested range', () => {
  const f = entry({ advanced: true, tech: true, strongholds: true, skill: 'planetologist' });
  assert.ok(f.game.decision?.kind === 'discoveryEntry');
  const action: Action = { type: 'decision', event: f.game.decision.event, accept: true,
    groups: [{ source: f.source, normal: 1, elite: 1 }] };
  reject(f.game, f.native, action);
  reject(f.game, f.owner, { ...action, groups: [{ source: f.source, normal: 1, elite: 2 }] });
  reject(f.game, f.owner, { ...action, groups: [{ source: MOBILE_LOCATION, normal: 1, elite: 1 }] });
  const entered = step(f.game, { actor: f.owner, action });
  reject(entered, f.owner, action);
  const c = close(f);
  let game = advance(c.afterDraw, g => g.phase === 5 && g.active === f.owner && clean(g));
  reservePairedDiscoveryNexusBoard(game, [MOBILE_LOCATION]);
  const source = rangeSource(game);
  assert.equal(gameDistance(game, source, 'shrine:0', key => splitLocation(key).sector === game.storm), 3);
  placePairedDiscoveryNexus(game, f.owner, source, 3, 1);
  const before = structuredClone(game), move: Action = { type: 'move', territory: 'shrine', sector: 0,
    forces: { [source]: 2 }, eliteForces: { [source]: 1 }, planetologist: 'range' };
  reject(game, f.owner, { ...move, planetologist: undefined });
  reject(game, f.owner, { ...move, territory: 'shrine', sector: 1 });
  game = advance(step(game, { actor: f.owner, action: move }), clean);
  assert.equal(player(game, f.owner).forces['shrine:0'], 2);
  assert.equal(player(game, f.owner).elites!.forces['shrine:0'], 1);
  assert.equal(player(game, f.owner).forces[source], 1);
  assert.equal(player(game, f.owner).moved, 1);
  assert.equal(player(game, f.owner).spice, player(before, f.owner).spice);
  assert.equal(player(game, f.owner).forces[MOBILE_LOCATION], player(before, f.owner).forces[MOBILE_LOCATION]);
  assert.deepEqual(game.leaderSkills, before.leaderSkills);
  custody(game, f.afterSetup);
});

for (const mode of MODES) void test(`paired E1 Skills ${JSON.stringify(mode)}: full Cunning, trained Suk rescue then genuine equal Cyborg substitution`, () => {
  const f = battle(mode), prepared = prepare(f), offer = viewGame(prepared, f.owner).nexusSuboids!.offer!;
  reject(prepared, f.opponent, { type: 'nexusSuboids', event: offer.event });
  const sealed = step(prepared, f.plans[1]);
  const ownSealed = step(prepared, { actor: f.owner, action: { ...f.plans[0].action, dial: 6, support: mode.advanced ? 1 : 0 } });
  reject(ownSealed, f.owner, { type: 'nexusSuboids', event: offer.event });
  const active = cunning(f, sealed);
  assert.equal(active.nexusCards!.cards!.hands[f.owner], null);
  assert.equal(active.nexusCards!.cards!.discard.filter(c => c === 'ixians').length, 1);
  assert.deepEqual(player(active, f.owner).forces, player(sealed, f.owner).forces);
  reject(active, f.owner, { type: 'nexusSuboids', event: offer.event });
  const revealed = reveal(f), pending = rescueWindow(f, revealed);
  assert.equal(viewGame(revealed, f.owner).battle!.strongholdEffects[f.owner], null,
    'An actually retained named Arrakeen Card cannot subsidize the nested site');
  assert.equal(pending.lastBattleContext!.winner, f.owner);
  assert.deepEqual(pending.pendingSukRescue!.losses,
    { normal: 4, elite: 2, paidNormal: 0, paidElite: mode.advanced ? 2 : 0 });
  assert.equal(player(pending, f.owner).forces[f.location], 8);
  assert.equal(player(pending, f.owner).tanks, player(revealed, f.owner).tanks);
  assert.equal(pending.pendingIxSubstitution, undefined);
  if (mode.strongholds) assert.equal(pending.strongholdCards!.owners.arrakeen, f.owner);
  const choice = pending.decision!.kind === 'sukRescue'
    ? pending.decision.options.findIndex(o => o.normal === 2 && o.elite === 1 && o.kept?.kind === 'normal') : -1;
  assert.ok(choice >= 0);
  reject(pending, f.owner, { type: 'decision', sources: { [f.location]: 1 }, recover: { [f.location]: 1 } });
  const saved = step(pending, { actor: f.owner, action: { type: 'decision', event: pending.decision!.kind === 'sukRescue' ? pending.decision.event : '', choice } });
  assert.equal(saved.lastBattleContext!.sukRescue!.completed, true);
  assert.equal(saved.decision?.kind, 'ixSubstitution');
  assert.equal(player(saved, f.owner).forces[f.location], 3);
  assert.equal(player(saved, f.owner).elites!.forces[f.location] ?? 0, 0);
  assert.equal(player(saved, f.owner).reserves, player(pending, f.owner).reserves + 2);
  assert.equal(player(saved, f.owner).elites!.reserves, player(pending, f.owner).elites!.reserves + 1);
  assert.equal(player(saved, f.owner).tanks, player(pending, f.owner).tanks + 3);
  assert.equal(player(saved, f.owner).elites!.tanks, player(pending, f.owner).elites!.tanks + 1);
  assert.deepEqual(saved.pendingIxSubstitution!.losses, { [f.location]: 1 });
  reject(saved, f.owner, { type: 'decision', sources: { [f.location]: 1 }, recover: { [f.replacementSource]: 1 } });
  reject(saved, f.owner, { type: 'decision', sources: { [f.location]: 2 }, recover: { [f.location]: 2 } });
  const substituted = advance(step(saved, { actor: f.owner, action: { type: 'decision',
    sources: { [f.location]: 1 }, recover: { [f.location]: 1 } } }),
  game => clean(game) || game.decision?.kind === 'battleCards' || game.decision?.kind === 'faceDance');
  assert.equal(player(substituted, f.owner).forces[f.location], 3);
  assert.equal(player(substituted, f.owner).elites!.forces[f.location], 1);
  assert.equal(player(substituted, f.owner).elites!.tanks, player(pending, f.owner).elites!.tanks);
  assert.equal(player(substituted, f.owner).spice, player(saved, f.owner).spice);
  assert.equal(substituted.lastBattleContext!.ixSubstitution!.completed, true);
  custody(substituted, f.entry.afterSetup);
});

for (const advanced of [false, true]) void test(`paired E1 ${advanced ? 'Advanced' : 'Basic'}: physical winner cleanup and original Tech precede Face Dance, partial Cunning retains Mentat rights`, () => {
  const f = battle({ advanced, tech: true, strongholds: advanced });
  assert.ok(f.weapon, 'Controlled original first-hand offer supplies an actually selected weapon');
  const revealed = reveal(f), rescued = rescueAndSubstitute(f, rescueWindow(f, revealed));
  const cards = finish(rescued, 'cards'); assert.equal(cards.decision?.kind, 'battleCards');
  const premature: Action = { type: 'decision', reveal: true, sector: 0, sources: { reserves: 1, [f.replacementSource]: 2 } };
  reject(cards, f.opponent, premature);
  assert.equal(cards.lastBattleContext!.sukRescue!.completed, true);
  assert.equal(cards.lastBattleContext!.ixSubstitution!.completed, true);
  const cleaned = step(cards, { actor: f.owner, action: { type: 'decision', discard: [f.weapon] } });
  const face = finish(cleaned, 'faceDance');
  assert.ok(face.discard.some(c => c.id === f.weapon));
  assert.ok(!player(face, f.owner).hand.some(c => c.id === f.weapon));
  assert.equal(player(face, f.opponent).leaders.find(l => l.id === f.enemy)!.dead, true);
  const defeatedTech = ownedTech(revealed.techTokens, f.opponent); assert.equal(defeatedTech.length, 1);
  assert.equal(face.techTokens![defeatedTech[0]].owner, f.owner);
  assert.ok(!face.pendingTech);
  const winner = structuredClone(player(face, f.owner)), native = structuredClone(player(face, f.opponent));
  const dance: Action = { type: 'decision', reveal: true, sector: 0, sources: { reserves: 1, [f.replacementSource]: 2 } };
  reject(face, f.opponent, { ...dance, sector: 1 });
  reject(face, f.opponent, { ...dance, sources: { [MOBILE_LOCATION]: 3 } });
  reject(face, f.opponent, { ...dance, sources: { reserves: 4 } });
  const danced = step(face, { actor: f.opponent, action: dance });
  assert.equal(player(danced, f.owner).leaders.find(l => l.id === f.trainer)!.dead, true);
  assert.equal(danced.leaderSkills!.assignments.some(a => a.leader === f.trainer), false);
  assert.equal(danced.leaderSkills!.deck.filter(s => s === f.skill).length, 1);
  assert.equal(player(danced, f.owner).forces[f.location] ?? 0, 0);
  assert.equal(player(danced, f.owner).reserves, winner.reserves + 3);
  assert.equal(player(danced, f.owner).elites!.reserves, winner.elites!.reserves + 1);
  assert.equal(player(danced, f.opponent).forces[f.location], 3);
  assert.equal(player(danced, f.opponent).forces[f.replacementSource], 1);
  assert.equal(player(danced, f.opponent).reserves, native.reserves - 1);
  assert.deepEqual(danced.techTokens, face.techTokens);
  assert.deepEqual(player(danced, f.owner).hand, winner.hand);
  for (const p of face.players) assert.equal(player(danced, p.id).spice, p.spice);
  reject(danced, f.opponent, dance);
  const projection = viewGame(danced, f.opponent);
  const renew = nexusFaceDancersAction(projection, projection.nexusTleilaxu!.cunning!.event); assert.ok(renew);
  const revealedDancer = player(danced, f.opponent).faceDancers!.find(c => c.leader === f.trainer)!;
  assert.equal(revealedDancer.revealed, true);
  reject(danced, f.opponent, { ...renew, leaders: [f.trainer] });
  const reserve = [...danced.traitorReserve!], allowance = player(danced, f.opponent).faceDancerReplacedTurn;
  const renewed = step(danced, { actor: f.opponent, action: renew });
  assert.deepEqual(player(renewed, f.opponent).faceDancers!.filter(c => !native.faceDancers!.some(old => old.leader === c.leader)),
    [{ leader: reserve[0], revealed: false }]);
  assert.deepEqual([...renewed.traitorReserve!].sort(), [...reserve.slice(1), f.trainer].sort());
  assert.equal(player(renewed, f.opponent).faceDancerReplacedTurn, allowance);
  assert.equal(renewed.nexusCards!.cards!.hands[f.opponent], null);
  assert.equal(renewed.nexusCards!.cards!.discard.filter(c => c === 'tleilaxu').length, 1);
  assert.equal(renewed.leaderSkills!.assignments.some(a => a.owner === f.opponent && a.leader === f.trainer), false);
  reject(renewed, f.opponent, renew);
  reservePairedDiscoveryNexusBoard(renewed, [f.location, f.replacementSource, MOBILE_LOCATION]);
  const mentat = advance(renewed, g => g.phase === 8 && clean(g));
  const untouched = player(mentat, f.opponent).faceDancers!.find(c => !c.revealed && c.leader !== reserve[0]); assert.ok(untouched);
  const replaced = advance(step(mentat, { actor: f.opponent, action: { type: 'replaceFaceDancer', leader: untouched.leader } }), clean);
  assert.equal(player(replaced, f.opponent).faceDancerReplacedTurn, replaced.turn);
  reject(replaced, f.opponent, { type: 'replaceFaceDancer', leader: player(replaced, f.opponent).faceDancers![0].leader });
  const nextTurn = advance(replaced, g => g.turn > replaced.turn);
  assert.equal(viewGame(nextTurn, f.owner).nexusSuboids!.active, false);
  assert.equal(nextTurn.leaderSkills!.deck.filter(s => s === f.skill).length, 1);
  if (!advanced) {
    const revival = advance(nextTurn, g => g.turn === 3 && g.phase === 4 && clean(g));
    reject(revival, f.opponent, { type: 'reviveForeignGhola', leader: f.trainer });
    assert.equal(player(revival, f.owner).leaders.find(l => l.id === f.trainer)!.dead, true);
    assert.equal(revival.leaderSkills!.assignments.some(a => a.leader === f.trainer), false);
    custody(revival, f.entry.afterSetup);
  }
  custody(danced, f.entry.afterSetup); custody(replaced, f.entry.afterSetup); custody(nextTurn, f.entry.afterSetup);
});

void test('all four minimal paired E1 policies use eligible original actors and produce entry, vote, Cunning, trained rescue and Face Dance receipts', () => {
  const f = entry(), c = close(f), b = battle(), prepared = prepare(b), revealed = reveal(b);
  const pending = rescueWindow(b, revealed);
  const face = finish(rescueAndSubstitute(b, pending), 'faceDance');
  for (const difficulty of DIFFICULTIES) {
    for (const current of [
      { game: f.game, actor: f.owner, type: 'decision' },
      { game: c.vote, actor: c.vote.decision!.player, type: 'decision' },
      { game: c.ride.before, actor: f.fremen, type: 'decision' },
      { game: c.drawing, actor: f.owner, type: 'nexusCardChoice' },
      { game: prepared, actor: b.owner, type: 'nexusSuboids' },
      { game: pending, actor: b.owner, type: 'decision' },
      { game: face, actor: b.opponent, type: 'decision' },
    ]) {
      const projection = viewGame(current.game, current.actor);
      projection.players.find(p => p.id === current.actor)!.bot = difficulty;
      const action = botActions(projection).find(a => a.type === current.type); assert.ok(action);
      const acted = step(current.game, { actor: current.actor, action });
      const after = current.type === 'nexusSuboids' ? advance(acted, clean) : acted;
      if (current.game.decision?.kind === 'discoveryEntry') {
        assert.equal(after.discoveryEntry, undefined);
        const own = player(after, current.actor), old = player(current.game, current.actor);
        assert.equal((own.forces[f.source] ?? 0) + (own.forces['shrine:0'] ?? 0), old.forces[f.source]);
        assert.equal((own.elites!.forces[f.source] ?? 0) + (own.elites!.forces['shrine:0'] ?? 0), 1);
        assert.equal(own.spice, old.spice);
      } else if (current.game.decision?.kind === 'greatMakerVote')
        assert.equal(after.greatMaker!.votes.length, current.game.greatMaker!.votes.length + 1);
      else if (current.game.decision?.kind === 'greatMakerRide') {
        assert.equal(after.greatMaker!.stage, 'complete');
        assert.equal(player(after, f.fremen).spice, player(current.game, f.fremen).spice);
      } else if (current.type === 'nexusCardChoice') {
        assert.ok(after.nexusCards!.phase!.done.includes(current.actor));
        assert.equal(after.nexusCards!.cards!.hands[current.actor], 'ixians');
        assert.equal(after.nexusCards!.cards!.deck.length, current.game.nexusCards!.cards!.deck.length - 1);
      } else if (current.type === 'nexusSuboids') {
        assert.equal(after.nexusCards!.cards!.hands[b.owner], null);
        assert.equal(after.nexusCards!.cards!.discard.filter(card => card === 'ixians').length, 1);
        assert.deepEqual(player(after, b.owner).forces, player(current.game, b.owner).forces);
        assert.equal(viewGame(after, b.owner).nexusSuboids!.active, true);
        const own = viewGame(after, b.owner); own.players.find(p => p.id === b.owner)!.bot = difficulty;
        const plan = botActions(own).find(a => a.type === 'battlePlan'); assert.ok(plan);
        const committed = step(after, { actor: b.owner, action: plan });
        assert.equal(committed.battle!.plans[b.owner].leader, plan.leader);
        assert.equal(player(committed, b.owner).spice, player(after, b.owner).spice);
        custody(committed, b.entry.afterSetup);
      } else if (current.game.decision?.kind === 'sukRescue') {
        assert.equal(after.pendingSukRescue, null);
        assert.equal(after.lastBattleContext!.sukRescue!.completed, true);
        assert.equal(player(after, b.owner).forces[b.location], 3);
        assert.equal(player(after, b.owner).tanks, player(pending, b.owner).tanks + 3);
        assert.equal(player(after, b.owner).reserves, player(pending, b.owner).reserves + 2);
      } else {
        assert.equal(player(after, b.owner).forces[b.location] ?? 0, 0);
        assert.equal(player(after, b.owner).leaders.find(l => l.id === b.trainer)!.dead, true);
        assert.equal(after.leaderSkills!.assignments.some(a => a.leader === b.trainer), false);
        assert.deepEqual(after.techTokens, face.techTokens);
      }
      custody(after, current.actor === b.owner || current.actor === b.opponent ? b.entry.afterSetup : f.afterSetup);
    }
  }
});
