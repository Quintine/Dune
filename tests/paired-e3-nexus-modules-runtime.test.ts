import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, initializeLeaderSkillsGameForAudit, initializePairedNexusGameForAudit, joinGame, newPlayer, viewGame } from '../game/engine';
import type { Action, Game } from '../game/engine';
import type { FactionId } from '../game/catalog';
import { DIFFICULTIES } from '../game/bot-profiles';
import { leaders } from '../game/cards';
import { DUKE_VIDAL_ID } from '../game/duke-vidal';
import { ownedTech } from '../game/tech-tokens';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { territory } from '../game/board';
import { nexusEcazDukeAction } from '../game/nexus-ecaz-duke-options';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import {
  advancePairedE3Nexus as advance, createPairedE3NexusProgramme as programme,
  createPairedE3NexusSetup as setup, nextPairedE3NexusStep,
  openPairedE3NexusBattle as openBattle, pairedE3NexusClean as clean,
  pairedE3NexusInventory as inventory, pairedE3NexusPlayer as player,
  pairedE3NexusPolicy as policy, pairedE3NexusReload as reload,
  quietPairedE3NexusChoice as quiet, quotePairedE3NexusBattle as quote,
  revealPairedE3Nexus as reveal, shipPairedE3Nexus as ship, stepPairedE3Nexus as step,
} from './fixture-paired-e3-nexus-modules';
import type { PairedE3NexusOptions, PairedE3NexusStep } from './fixture-paired-e3-nexus-modules';

function reject(g: Game, actor: string, action: Action, error?: RegExp): void {
  const before = structuredClone(g);
  if (error) assert.throws(() => applyAction(g, actor, action), error);
  else assert.throws(() => applyAction(g, actor, action));
  assert.deepEqual(g, before, 'A rejected consumer cannot spend, kill, place or transfer original pieces');
}
function policies(g: Game, actor: string, effect: (after: Game, action: Action) => void): void {
  for (const difficulty of DIFFICULTIES) {
    const action = policy(reload(g), actor, difficulty)[0]; assert.ok(action, difficulty);
    const after = step(reload(g), { actor, action }); effect(after, action); inventory(after);
  }
}
function settlementChoice(g: Game): PairedE3NexusStep | null {
  const d = g.decision; if (!d || g.response || g.phaseOpening) return null;
  if (d.kind === 'battleLosses') return { actor: d.player, action: { type: 'decision', choice: 0 } };
  if (d.kind === 'battleCards') return { actor: d.player, action: { type: 'decision', discard: [] } };
  if (d.kind === 'techToken') return { actor: d.player, action: { type: 'decision', token: d.choices[0] } };
  if (d.kind === 'moritaniRetention') return { actor: d.player, action: { type: 'decision', keep: null,
    ...(d.source === 'nexus' ? { event: d.event } : {}) } };
  if (d.kind === 'sukRescue') {
    const choice = d.options.map((o, index) => ({ index, saved: o.normal + o.elite, kept: !!o.kept }))
      .sort((a, b) => b.saved - a.saved || Number(b.kept) - Number(a.kept))[0].index;
    return { actor: d.player, action: { type: 'decision', event: d.event, choice } };
  }
  return quiet(g);
}
function settle(g: Game, stopAssassination = false, normalCaller?: string): Game {
  for (let n = 0; n < 400; n++) {
    if (!g.response && !g.phaseOpening && (stopAssassination && g.decision?.kind === 'moritaniAssassinate' ||
      !g.battle && clean(g))) return g;
    const next = nextPairedE3NexusStep(g) ?? settlementChoice(g); assert.ok(next);
    if (next.action.type === 'traitorCall' && next.actor === normalCaller) next.action.call = true;
    g = step(g, next);
  }
  throw Error('Original battle settlement did not finish');
}
function collectionIncome(g: Game, actor: string): number {
  return g.phase === 7 ? quoteSpiceCollection(g).receipts.find(r => r.player === actor)?.strongholds ?? 0 : 0;
}
function shipWhenActive(g: Game, actor: string, location: string, amount: number): Game {
  g = advance(g, s => s.phase === 5 && s.active === actor && clean(s), undefined, quiet);
  return ship(g, actor, location, amount).after;
}
function guildLoss(options: PairedE3NexusOptions = {}, normalCall = false) {
  const f = programme(options), guild = f.game.players.find(p => p.faction === 'guild')!.id;
  let g = shipWhenActive(f.game, f.moritani, options.homeworlds && !normalCall ? 'homeworld:guild' : 'tueks_sietch:5', 1);
  const location = options.homeworlds && !normalCall ? 'homeworld:guild' : 'tueks_sietch';
  g = openBattle(g, location);
  g = advance(g, s => !!s.battle && clean(s) && !s.battle.preparation && s.battle.preLeader?.closed !== false,
    undefined, s => s.decision?.kind === 'leaderSkillVisibility' && s.decision.player === guild && normalCall
      ? { actor: guild, action: { type: 'leaderSkillVisibility', event: s.decision.event, hide: true } } : quiet(s));
  const own = player(g, f.moritani).leaders.filter(l => !l.dead && !l.usedAt &&
    !g.leaderSkills?.assignments.some(a => a.leader === l.id)).sort((a, b) => a.strength - b.strength)[0];
  const target = leaders('guild').find(l => l.name === 'Master Bewt')!.id;
  const enemy = normalCall ? player(g, guild).leaders.find(l => l.id === target)!
    : player(g, guild).leaders.filter(l => !l.dead && !l.usedAt && l.id !== target).sort((a, b) => b.strength - a.strength)[0];
  assert.ok(own && enemy && player(g, f.moritani).traitors.includes(target));
  const plans: PairedE3NexusStep[] = [
    { actor: f.moritani, action: { type: 'battlePlan', leader: own.id, dial: 0, support: 0,
      weapon: player(g, f.moritani).hand.find(c => c.kind === 'worthless')?.id } },
    { actor: guild, action: { type: 'battlePlan', leader: enemy.id, dial: 2, support: g.advanced ? 2 : 0,
      weapon: player(g, guild).hand.find(c => c.kind === 'worthless')?.id } },
  ];
  const revealed = reveal(g, plans), pending = settle(revealed, true, normalCall ? f.moritani : undefined);
  return { f, guild, target, location, revealed, pending, enemy: enemy.id };
}

for (const skills of [false, true]) void test(`${skills ? 'all14' : 'No-Skills'} native assassination against Ecaz consumes an original different disc and printed bounty`, () => {
  const f = programme({ advanced: true, skills, tech: true, assassinationFaction: 'ecaz' });
  const arrivals = new Set([f.ecaz, f.moritani]);
  let g = reload(f.game);
  while (arrivals.size) {
    g = advance(g, s => s.turn === 2 && s.phase === 5 && clean(s) && arrivals.has(s.active!), undefined, quiet);
    const actor = g.active!;
    g = ship(g, actor, `rock_outcroppings:${territory('rock_outcroppings').sectors[0]}`, actor === f.ecaz ? 2 : 1).after;
    arrivals.delete(actor);
    if (arrivals.size) g = step(g, { actor, action: { type: 'endMovement' } });
  }
  g = openBattle(g, 'rock_outcroppings');
  g = advance(g, s => !!s.battle && clean(s) && !s.battle.preparation && s.battle.preLeader?.closed !== false, undefined, quiet);
  const ecaz = player(g, f.ecaz), target = ecaz.leaders.find(l => player(g, f.moritani).traitors.includes(l.id))!;
  assert.ok(target && !target.dead);
  const winner = ecaz.leaders.find(l => !l.dead && !l.usedAt && l.id !== target.id &&
    !g.leaderSkills?.assignments.some(a => a.leader === l.id))!;
  const loser = player(g, f.moritani).leaders.filter(l => !l.dead && !l.usedAt &&
    !g.leaderSkills?.assignments.some(a => a.leader === l.id)).sort((a, b) => a.strength - b.strength)[0];
  assert.ok(winner && loser);
  const revealed = reveal(g, [
    { actor: f.ecaz, action: { type: 'battlePlan', leader: winner.id, dial: 1, support: 1 } },
    { actor: f.moritani, action: { type: 'battlePlan', leader: loser.id, dial: 0, support: 0 } },
  ]);
  const pending = settle(revealed, true);
  assert.equal(pending.lastBattleContext!.winner, f.ecaz);
  const before = reload(pending);
  const killed = step(pending, { actor: f.moritani, action: {
    type: 'decision', event: pending.lastBattleContext!.event, card: target.id,
  } });
  assert.equal(player(killed, f.ecaz).leaders.find(l => l.id === target.id)!.dead, true);
  assert.equal(player(killed, f.ecaz).leaders.find(l => l.id === target.id)!.deaths, target.deaths + 1);
  assert.equal(player(killed, f.moritani).spice, player(before, f.moritani).spice + target.strength);
  const done = settle(killed);
  const later = advance(done, s => s.turn === 3 && s.phase === 1 && clean(s), undefined, quiet);
  assert.equal(player(later, f.moritani).traitors.includes(target.id), false);
  assert.equal(later.traitorReserve!.includes(target.id), false);
  inventory(later);
});

void test('original paired E3 Basic/Advanced two-to-six-seat setup conserves ecaz33, cache0, all12 and optional all14', () => {
  const factions: FactionId[] = ['ecaz', 'moritani', 'guild', 'emperor', 'atreides', 'fremen'];
  for (const advanced of [false, true]) for (const skills of [false, true]) for (let count = 2; count <= 6; count++) {
    const f = setup({ advanced, skills, roster: factions.slice(0, count), tech: count >= 3, strongholds: advanced });
    assert.equal(player(f.afterSetup, f.ecaz).leaders.length, 5);
    assert.equal(player(f.afterSetup, f.moritani).leaders.length, 5);
    assert.equal(player(f.afterSetup, f.ecaz).reserves, 14);
    assert.equal(player(f.afterSetup, f.moritani).reserves, 14);
    assert.equal(player(f.afterSetup, f.moritani).traitors.length, 1);
    assert.equal(f.afterSetup.dukeVidal!.controller, null);
    assert.equal(f.afterSetup.dukeVidal!.leader.dead, false);
    assert.ok(!f.afterSetup.leaderSkills?.assignments.some(a => a.leader === DUKE_VIDAL_ID));
    assert.equal(f.afterSetup.moritaniTerror!.tokens.filter(t => t.status === 'available').length, 6);
    inventory(reload(f.afterSetup));
  }
  const basic = setup({ advanced: false, skills: true, roster: ['ecaz', 'moritani', 'harkonnen'] });
  assert.equal(player(basic.afterSetup, 'harkonnen').traitors.length, 4); inventory(basic.afterSetup);
  let blocked = createGame('PAIRHARKGUARD', newPlayer('e', 'Ecaz', 'ecaz'), true, ['ecaz']);
  joinGame(blocked, newPlayer('m', 'Moritani', 'moritani'));
  joinGame(blocked, newPlayer('h', 'Harkonnen', 'harkonnen'));
  for (const p of blocked.players) blocked = applyAction(blocked, p.id, { type: 'ready' });
  blocked.nexusCards = { cards: null, phase: null };
  const before = structuredClone(blocked);
  assert.throws(() => initializePairedNexusGameForAudit(blocked));
  assert.deepEqual(blocked, before, 'Rejected capture composition cannot redeal original pieces.');
});

void test('original paired E3 skill offers reject shared Duke and foreign training immutably', () => {
  let lobby = createGame('ORIGINALPAIREDE3', newPlayer('original-e', 'Ecaz', 'ecaz'), true, ['ecaz']);
  for (const faction of ['moritani', 'guild', 'emperor'] as const) joinGame(lobby, newPlayer(`original-${faction}`, faction, faction));
  lobby.nexusCards = { cards: null, phase: null };
  for (const p of lobby.players) lobby = applyAction(lobby, p.id, { type: 'ready' });
  const offered = initializeLeaderSkillsGameForAudit(lobby), actor = Object.keys(offered.leaderSkills!.offers)[0];
  const own = viewGame(offered, actor).leaderSkills!, skill = own.offer!.cards.find(c => !own.unavailableSkills?.[c]); assert.ok(skill);
  reject(offered, actor, { type: 'leaderSkill', event: own.offer!.event, skill, leader: DUKE_VIDAL_ID });
  const foreignDisc = offered.players.find(p => p.id !== actor)!.leaders[0].id;
  reject(offered, actor, { type: 'leaderSkill', event: own.offer!.event, skill, leader: foreignDisc });
});

for (const skills of [false, true]) void test(`${skills ? 'all14' : 'No-Skills'} qualifying original Great Maker/both-pile closing deals both native Cunning singletons`, () => {
  const f = programme({ advanced: true, skills, discovery: true, homeworlds: true, tech: true, strongholds: true,
    roster: ['ecaz', 'moritani', 'guild', 'fremen'] });
  assert.ok(f.maker && f.alliance && f.drawing);
  assert.equal(player(f.alliance, f.others[0]).ally, f.others[1]);
  assert.equal(player(f.alliance, f.others[1]).ally, f.others[0]);
  assert.equal(player(f.alliance, f.ecaz).ally, null); assert.equal(player(f.alliance, f.moritani).ally, null);
  assert.ok(Object.values(f.afterSetup.nexusCards!.cards!.hands).every(c => c === null));
  assert.ok(f.drawing.spiceDiscard[0].some(c => 'territory' in c));
  assert.ok(f.drawing.spiceDiscard[1].some(c => 'territory' in c));
  assert.equal(f.game.nexusCards!.cards!.hands[f.ecaz], 'ecaz');
  assert.equal(f.game.nexusCards!.cards!.hands[f.moritani], 'moritani');
  for (const draw of f.draws) {
    reject(draw.after, draw.step.actor, draw.step.action);
    policies(draw.before, draw.step.actor, after => {
      const original = draw.before.nexusCards!.cards!, current = after.nexusCards!.cards!;
      const held = current.hands[draw.step.actor];
      assert.equal(current.deck.length, original.deck.length - (held === null ? 0 : 1));
      if (held !== null) assert.equal(current.deck.includes(held), false);
    });
  }
  assert.ok(f.firstMentat && f.claim);
  assert.equal(f.game.strongholdCards!.owners.sietch_tabr, f.ecaz);
  assert.equal(player(f.claim.after, f.ecaz).reserves, player(f.claim.before, f.ecaz).reserves - 1);
  inventory(f.game);
});

for (const skills of [false, true]) void test(`${skills ? 'all14' : 'No-Skills'} quiet living-Duke Cunning is separate from training and allied Arrakis Occupy`, () => {
  const f = programme({ skills, tech: true });
  let g = shipWhenActive(f.game, f.ecaz, 'tueks_sietch:5', 1);
  g = advance(g, s => s.phase === 6 && clean(s) && !s.battle, undefined, quiet);
  const action = nexusEcazDukeAction(viewGame(g, f.ecaz)); assert.ok(action);
  reject(g, f.moritani, action); reject(g, f.ecaz, { ...action, event: 'stale' });
  policies(g, f.ecaz, after => {
    assert.equal(after.dukeVidal!.controller, f.ecaz); assert.equal(after.dukeVidal!.leader.strength, 6);
    assert.equal(after.nexusCards!.cards!.hands[f.ecaz], null);
    assert.ok(!after.leaderSkills?.assignments.some(a => a.leader === DUKE_VIDAL_ID));
    assert.equal(player(after, f.ecaz).leaders.length, 5);
    assert.equal(player(after, f.ecaz).spice, player(g, f.ecaz).spice);
  });
  const claimed = step(g, { actor: f.ecaz, action });
  reject(claimed, f.ecaz, action); inventory(claimed);
});

for (const skills of [false, true]) for (const advanced of [false, true]) void test(`${advanced ? 'Advanced' : 'Basic even-FORCE'} ${skills ? 'all14' : 'No-Skills'} coalition pays the selected leader, kills each physical owner and transfers only the loser Tech`, () => {
  const f = programme({ skills, advanced, tech: true, strongholds: advanced });
  let g = advance(f.game, s => s.turn === 3 && s.phase === 1 && clean(s), undefined, quiet);
  const at = g.spiceDeck.findIndex(c => 'worm' in c && !c.greatMaker && !c.suppressed); assert.ok(at >= 0);
  g.spiceDeck.unshift(g.spiceDeck.splice(at, 1)[0]);
  g = advance(g, s => !!s.nexus && !s.spiceWindow && !s.spiceResolution && clean(s), undefined, quiet);
  const ally = f.others[1], opponent = f.others[0];
  g = step(g, { actor: ally, action: { type: 'alliance', target: null } });
  for (const [actor, target] of [[f.ecaz, ally], [ally, f.ecaz]]) g = step(g, { actor, action: { type: 'alliance', target } });
  const amounts: Record<string, number> = { [f.ecaz]: advanced ? 4 : 3, [ally]: 4, [opponent]: 6 };
  const shipped = new Set<string>();
  for (let n = 0; !(g.phase === 6 && clean(g)) && n < 600; n++) {
    if (g.phase === 5 && clean(g) && g.active && amounts[g.active] && !shipped.has(g.active)) {
      const actor = g.active, arrival = ship(g, actor, 'sietch_tabr:14', amounts[actor]);
      assert.equal(player(arrival.after, actor).reserves, player(arrival.before, actor).reserves - amounts[actor]);
      assert.equal(player(arrival.after, actor).forces['sietch_tabr:14'],
        (player(arrival.before, actor).forces['sietch_tabr:14'] ?? 0) + amounts[actor]);
      assert.ok(player(arrival.after, actor).spice < player(arrival.before, actor).spice);
      shipped.add(actor); g = arrival.after;
    } else {
      const next = nextPairedE3NexusStep(g) ?? quiet(g); assert.ok(next); g = step(g, next);
    }
  }
  assert.equal(g.phase, 6); assert.equal(shipped.size, 3);
  const opened = openBattle(g, 'sietch_tabr'), d = opened.decision; assert.ok(d?.kind === 'ecazBattleLead');
  reject(opened, ally, { type: 'decision', event: d.event, lead: f.ecaz });
  reject(opened, f.ecaz, { type: 'decision', event: d.event, lead: opponent });
  const run = (state: Game, lead: string) => {
    state = advance(state, s => !!s.battle && clean(s) && !s.battle.preparation && s.battle.preLeader?.closed !== false,
      undefined, s => s.decision?.kind === 'leaderSkillVisibility' && s.decision.player === lead
        ? { actor: lead, action: { type: 'leaderSkillVisibility', event: s.decision.event, hide: true } } : quiet(s));
    const profile = viewGame(state, lead).battle!.ecazOccupy!.profile!;
    const assignment = state.leaderSkills?.assignments.find(a => a.owner === lead);
    const own = assignment ? player(state, lead).leaders.find(l => l.id === assignment.leader)!
      : player(state, lead).leaders.filter(l => !l.dead).sort((a, b) => b.strength - a.strength)[0];
    const enemy = player(state, opponent).leaders.filter(l => !l.dead &&
      !state.leaderSkills?.assignments.some(a => a.leader === l.id)).sort((a, b) => a.strength - b.strength)[0];
    const revealed = reveal(state, [
      { actor: lead, action: { type: 'battlePlan', leader: own.id, dial: profile.fixedEcazDial + 3, support: advanced ? 3 : 0,
        weapon: player(state, lead).hand.find(c => c.kind === 'worthless')?.id } },
      { actor: opponent, action: { type: 'battlePlan', leader: enemy.id, dial: 1, support: advanced ? 1 : 0 } },
    ]), q = quote(revealed), done = settle(revealed);
    assert.equal(q.winner, lead); assert.equal(done.lastBattleContext!.winner, lead);
    if (skills) {
      const selected = revealed.battle!.attacker === lead ? q.leaderSkillBonuses.attacker : q.leaderSkillBonuses.defender;
      assert.equal(selected.bonus, lead === f.ecaz ? 3 : 0,
        'Only the actual selected Warmaster disc with its original Worthless gets +3; the ally cannot borrow that training');
    }
    const holder = revealed.strongholdCards?.owners.sietch_tabr;
    assert.deepEqual(q.strongholdIncome, advanced && holder === lead ? [{ player: lead, amount: 1 }] : []);
    const fixed = advanced ? 3 : 2;
    assert.equal(player(done, f.ecaz).tanks - player(revealed, f.ecaz).tanks, fixed);
    assert.equal(player(done, ally).tanks - player(revealed, ally).tanks, 3);
    assert.equal(player(done, opponent).tanks - player(revealed, opponent).tanks, 6);
    for (const payment of q.payments) {
      const income = q.strongholdIncome.filter(i => i.player === payment.player).reduce((a, i) => a + i.amount, 0);
      assert.equal(player(done, payment.player).spice, player(revealed, payment.player).spice - payment.ownPayment + income + collectionIncome(done, payment.player));
    }
    assert.equal(done.techTokens![ownedTech(revealed.techTokens, opponent)[0]].owner, lead);
    for (const original of revealed.players.filter(p => p.id !== opponent))
      for (const token of ownedTech(revealed.techTokens, original.id))
        assert.equal(done.techTokens![token].owner, original.id, 'Only actual loser tokens transfer.');
    inventory(done);
  };
  policies(opened, f.ecaz, (after, action) => run(after, String(action.lead)));
  for (const lead of [f.ecaz, ally]) run(step(opened, { actor: f.ecaz, action: { type: 'decision', event: d.event, lead } }), lead);
});

void test('native all14 post-loss assassination waits for real winner casualties, Suk effects and support, then pays printed death bounty and replaces privately at actual Mentat', () => {
  const b = guildLoss({ skills: true, advanced: true, tech: true, strongholds: true });
  const { pending, revealed, f, guild, target } = b, q = quote(revealed);
  assert.equal(q.winner, guild); assert.ok(pending.decision?.kind === 'moritaniAssassinate');
  assert.equal(player(pending, f.moritani).tanks, player(revealed, f.moritani).tanks + 1);
  assert.equal(player(pending, guild).tanks, player(revealed, guild).tanks + 1);
  assert.equal(player(pending, guild).reserves, player(revealed, guild).reserves + 1);
  const income = q.strongholdIncome.filter(i => i.player === guild).reduce((a, i) => a + i.amount, 0);
  assert.equal(player(pending, guild).spice, player(revealed, guild).spice - 2 + income);
  assert.equal(pending.techTokens![ownedTech(revealed.techTokens, f.moritani)[0]].owner, f.moritani,
    'Assassination pauses the winner suffix before the original automatic single-token transfer');
  const d = pending.decision; assert.ok(d?.kind === 'moritaniAssassinate');
  const action: Action = { type: 'decision', event: d.event, card: target };
  reject(pending, guild, action); reject(pending, f.moritani, { ...action, card: b.enemy });
  const beforeTarget = player(pending, guild).leaders.find(l => l.id === target)!;
  let killed = step(pending, { actor: f.moritani, action });
  assert.equal(player(killed, guild).leaders.find(l => l.id === target)!.dead, true);
  assert.equal(player(killed, guild).leaders.find(l => l.id === target)!.deaths, beforeTarget.deaths + 1);
  assert.equal(player(killed, f.moritani).spice, player(pending, f.moritani).spice + beforeTarget.strength);
  assert.ok(!killed.leaderSkills!.assignments.some(a => a.leader === target));
  assert.equal(killed.leaderSkills!.deck.filter(c => c === 'suk-graduate').length, 1);
  killed = settle(killed);
  assert.equal(killed.techTokens![ownedTech(revealed.techTokens, f.moritani)[0]].owner, guild);
  const retired = target;
  const later = advance(killed, s => s.turn === 3 && s.phase === 1 && clean(s), undefined, quiet);
  assert.ok(!player(later, f.moritani).traitors.includes(retired));
  assert.equal(player(later, f.moritani).traitors.length, 1);
  assert.ok(!later.traitorReserve!.includes(retired));
  assert.equal(later.moritaniAssassinate!.opportunities.filter(r => r.card === retired && r.stage === 'replaced').length, 1);
  inventory(later);
  policies(pending, f.moritani, after => {
    const finished = settle(after); assert.equal(finished.lastBattleContext!.winner, guild);
    assert.equal(finished.techTokens![ownedTech(revealed.techTokens, f.moritani)[0]].owner, guild);
    const dead = player(after, guild).leaders.find(l => l.id === target)!.dead;
    assert.equal(player(after, f.moritani).spice, player(pending, f.moritani).spice + (dead ? beforeTarget.strength : 0));
    assert.equal(player(finished, guild).spice, player(pending, guild).spice + collectionIncome(finished, guild));
  });
});

for (const skills of [false, true]) void test(`${skills ? 'all14' : 'No-Skills'} real Arrakis normal Traitor call forfeits native assassination for the rest of the game`, () => {
  const b = guildLoss({ skills, advanced: true, tech: true }, true);
  assert.equal(b.pending.moritaniAssassinate!.normalTraitorCall, true);
  assert.equal(b.pending.lastBattleContext!.winner, b.f.moritani);
  assert.ok(!b.pending.moritaniAssassinate!.opportunities.some(r => r.stage === 'choice'));
  inventory(b.pending);
});

for (const skills of [false, true]) void test(`${skills ? 'all14' : 'No-Skills'} foreign Homeworld excludes normal Traitor calls but retains separate native assassination`, () => {
  const b = guildLoss({ skills, advanced: true, tech: true, homeworlds: true });
  reject(b.revealed, b.f.moritani, { type: 'traitorCall', call: true });
  assert.equal(b.pending.lastBattleContext!.winner, b.guild);
  const before = reload(b.pending), target = player(before, b.guild).leaders.find(l => l.id === b.target)!;
  const action: Action = { type: 'decision', event: before.lastBattleContext!.event, card: b.target };
  const killed = step(before, { actor: b.f.moritani, action });
  assert.equal(player(killed, b.guild).leaders.find(l => l.id === b.target)!.dead, true);
  assert.equal(player(killed, b.guild).leaders.find(l => l.id === b.target)!.deaths, target.deaths + 1);
  assert.equal(player(killed, b.f.moritani).spice, player(before, b.f.moritani).spice + target.strength);
  const done = settle(killed);
  const home = homeworldForceGroups(homeworldContext(done), done.homeworlds!.custody!).find(h => h.id === 'homeworld:guild')!;
  assert.equal(home.forces[b.f.moritani]?.normal ?? 0, 0);
  assert.equal(player(done, b.f.moritani).tanks - player(b.revealed, b.f.moritani).tanks, 1);
  inventory(done);
});

for (const skills of [false, true]) void test(`${skills ? 'all14' : 'No-Skills'} supply-only Moritani Cunning uses actual placement and entrant reveal after original Grumman declines`, () => {
  const f = programme({ skills, advanced: true, tech: true });
  let g = advance(f.game, s => !s.response && !s.phaseOpening && s.decision?.kind === 'moritaniPlacement', undefined, quiet);
  const token = g.moritaniTerror!.tokens.find(t => t.kind === 'robbery' && t.status === 'available'); assert.ok(token);
  const offer = viewGame(g, f.moritani).nexusMoritani; assert.ok(offer);
  const action: Action = { type: 'decision', token: token.id, territory: 'sihaya_ridge', nexus: offer.event };
  policies(g, f.moritani, after => {
    const allowed = advance(after, s => !s.response && !s.phaseOpening, undefined, quiet);
    assert.equal(player(allowed, f.moritani).spice, player(g, f.moritani).spice);
    assert.equal(player(allowed, f.moritani).reserves, player(g, f.moritani).reserves);
    assert.equal(allowed.moritaniTerror!.tokens.length, 6);
    assert.ok(allowed.moritaniTerror!.tokens.filter(t => t.status === 'placed').every(t =>
      t.location !== 'grumman' && !t.location?.startsWith('homeworld:')));
  });
  reject(g, f.ecaz, action); reject(g, f.moritani, { ...action, territory: 'grumman' });
  reject(g, f.moritani, { ...action, territory: 'hidden_mobile_stronghold' });
  reject(g, f.moritani, { ...action, territory: 'homeworld:guild' });
  const before = reload(g);
  g = step(g, { actor: f.moritani, action });
  g = advance(g, s => !s.response && !s.phaseOpening, undefined, quiet);
  assert.equal(g.moritaniTerror!.tokens.find(t => t.id === token.id)!.status, 'placed');
  assert.equal(g.moritaniTerror!.tokens.find(t => t.id === token.id)!.location, 'sihaya_ridge');
  assert.equal(g.nexusCards!.cards!.hands[f.moritani], null);
  assert.equal(player(g, f.moritani).spice, player(before, f.moritani).spice);
  assert.equal(player(g, f.moritani).reserves, player(before, f.moritani).reserves);
  const guild = f.others[0];
  g = advance(g, s => s.turn === 3 && s.phase === 5 && s.active === guild && clean(s), undefined, quiet);
  const shipped = step(g, { actor: guild, action: { type: 'ship', territory: 'sihaya_ridge', sector: 9, amount: 1, allyPayment: 0 } });
  g = advance(shipped, s => !s.response && !s.phaseOpening && s.decision?.kind === 'moritaniTerror', undefined, quiet);
  const d = g.decision; assert.ok(d?.kind === 'moritaniTerror');
  const moriBefore = player(g, f.moritani).spice, entrantBefore = player(g, guild).spice;
  const revealAction: Action = { type: 'decision', reveal: true };
  reject(g, guild, revealAction);
  g = step(g, { actor: f.moritani, action: revealAction });
  g = step(g, { actor: f.moritani, action: { type: 'decision', choice: 'spice' } });
  g = advance(g, s => !s.response && !s.phaseOpening && !s.pendingTerrorEntry && clean(s), undefined, quiet);
  assert.equal(g.moritaniTerror!.tokens.find(t => t.id === token.id)!.status, 'removed');
  assert.ok(player(g, f.moritani).spice > moriBefore);
  assert.equal(player(g, f.moritani).spice - moriBefore, entrantBefore - player(g, guild).spice);
  assert.equal(player(g, f.moritani).spice - moriBefore, Math.ceil(entrantBefore / 2));
  inventory(g);
});

void test('No-Skills original assassination pause retains the unfinished winner suffix, which settles every physical loss and payment exactly once', () => {
  const b = guildLoss({ advanced: true, skills: false, tech: true, strongholds: true });
  const q = quote(b.revealed), d = b.pending.decision; assert.ok(d?.kind === 'moritaniAssassinate');
  const target = player(b.pending, b.guild).leaders.find(l => l.id === b.target)!;
  const acted = step(b.pending, { actor: b.f.moritani, action: { type: 'decision', event: d.event, card: b.target } });
  const done = settle(acted);
  assert.equal(player(done, b.f.moritani).tanks - player(b.revealed, b.f.moritani).tanks, 1);
  assert.equal(player(done, b.guild).tanks - player(b.revealed, b.guild).tanks, 2);
  assert.equal(player(done, b.guild).forces['tueks_sietch:5'], 3);
  assert.equal(player(done, b.guild).leaders.find(l => l.id === b.target)!.dead, true);
  for (const payment of q.payments) {
    const income = q.strongholdIncome.filter(i => i.player === payment.player).reduce((a, i) => a + i.amount, 0);
    assert.equal(player(done, payment.player).spice, player(b.revealed, payment.player).spice - payment.ownPayment +
      income + (payment.player === b.f.moritani ? target.strength : 0) + collectionIncome(done, payment.player));
  }
  assert.equal(done.techTokens![ownedTech(b.revealed.techTokens, b.f.moritani)[0]].owner, b.guild);
  inventory(done);
  const later = advance(done, s => s.turn === 3 && s.phase === 1 && clean(s), undefined, quiet);
  assert.ok(!player(later, b.f.moritani).traitors.includes(b.target));
  assert.equal(player(later, b.f.moritani).traitors.length, 1);
  assert.equal(later.moritaniAssassinate!.opportunities.filter(r => r.card === b.target && r.stage === 'replaced').length, 1);
  inventory(later);
});

void test('real Basic odd Ecaz FORCE admits provisional ceiling losses, floor survivors and actual coalition rewards', () => {
  const f = programme({ advanced: false, skills: false, tech: true });
  let g = advance(f.game, s => s.turn === 3 && s.phase === 1 && clean(s), undefined, quiet);
  const at = g.spiceDeck.findIndex(c => 'worm' in c && !c.greatMaker && !c.suppressed); assert.ok(at >= 0);
  g.spiceDeck.unshift(g.spiceDeck.splice(at, 1)[0]);
  g = advance(g, s => !!s.nexus && !s.spiceWindow && !s.spiceResolution && clean(s), undefined, quiet);
  const ally = f.others[1], opponent = f.others[0];
  g = step(g, { actor: ally, action: { type: 'alliance', target: null } });
  for (const [actor, target] of [[f.ecaz, ally], [ally, f.ecaz]]) g = step(g, { actor, action: { type: 'alliance', target } });
  const amounts: Record<string, number> = { [f.ecaz]: 2, [ally]: 2, [opponent]: 2 }, shipped = new Set<string>();
  for (let n = 0; !(g.phase === 6 && clean(g)) && n < 600; n++) {
    if (g.phase === 5 && clean(g) && g.active && amounts[g.active] && !shipped.has(g.active)) {
      const actor = g.active; g = ship(g, actor, 'sietch_tabr:14', amounts[actor]).after; shipped.add(actor);
    } else {
      const next = nextPairedE3NexusStep(g) ?? quiet(g); assert.ok(next); g = step(g, next);
    }
  }
  assert.equal(player(g, f.ecaz).forces['sietch_tabr:14'], 3);
  const choice = viewGame(g, g.active!).battleChoices.find(c => c.territory === 'sietch_tabr'); assert.ok(choice);
  const before = reload(g);
  g = step(g, { actor: choice.chooser, action: { type: 'chooseBattle', territory: 'sietch_tabr',
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker } });
  assert.ok(g.battle);
  const d = g.decision; assert.ok(d?.kind === 'ecazBattleLead');
  inventory(g);
  for (const lead of [f.ecaz, ally]) {
    const chosen = step(g, { actor: f.ecaz, action: { type: 'decision', event: d.event, lead } });
    const ready = advance(chosen, s => !!s.battle && clean(s) && !s.battle.preparation && s.battle.preLeader?.closed !== false,
      undefined, quiet);
    const profile = viewGame(ready, lead).battle!.ecazOccupy!.profile!;
    assert.equal(profile.ecazForces.normal, 3);
    assert.equal(profile.fixedEcazDial, Math.ceil(3 / 2));
    assert.equal(profile.planOwner, lead);
    assert.equal(profile.payer, lead);
    assert.equal(profile.forceOwner, ally);
    const own = player(ready, lead).leaders.filter(l => !l.dead && !l.usedAt).sort((a, b) => b.strength - a.strength)[0];
    const enemy = player(ready, opponent).leaders.filter(l => !l.dead && !l.usedAt).sort((a, b) => a.strength - b.strength)[0];
    assert.ok(own && enemy);
    const revealed = reveal(ready, [
      { actor: lead, action: { type: 'battlePlan', leader: own.id, dial: profile.fixedEcazDial + 2, support: 0 } },
      { actor: opponent, action: { type: 'battlePlan', leader: enemy.id, dial: 0, support: 0 } },
    ]), q = quote(revealed), done = settle(revealed);
    assert.equal(q.winner, lead);
    assert.equal(done.lastBattleContext!.winner, lead);
    assert.deepEqual(q.fixedLosses, [{ owner: f.ecaz, normal: Math.ceil(3 / 2), elite: 0 }]);
    assert.equal(q.casualties!.owner, ally);
    assert.deepEqual(q.casualties!.options, [{ normal: 2, elite: 0, paidNormal: 0, paidElite: 0 }]);
    assert.ok(q.payments.every(payment => payment.ownPayment === 0));
    assert.deepEqual(q.strongholdIncome, []);
    for (const payment of q.payments)
      assert.equal(player(done, payment.player).spice,
        player(revealed, payment.player).spice + collectionIncome(done, payment.player));
    assert.equal(player(done, f.ecaz).tanks - player(before, f.ecaz).tanks, Math.ceil(3 / 2));
    assert.equal(player(done, f.ecaz).forces['sietch_tabr:14'], Math.floor(3 / 2));
    assert.equal(player(done, ally).tanks - player(before, ally).tanks, 2);
    assert.equal(player(done, ally).forces['sietch_tabr:14'] ?? 0, 0);
    assert.equal(player(done, opponent).tanks - player(before, opponent).tanks, 2);
    const token = ownedTech(before.techTokens, opponent)[0]; assert.ok(token);
    assert.equal(done.techTokens![token].owner, lead);
    for (const owner of [f.ecaz, ally])
      for (const retained of ownedTech(before.techTokens, owner))
        assert.equal(done.techTokens![retained].owner, owner, 'Only the loser’s Tech transfers.');
    inventory(done);
  }
});
