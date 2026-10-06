import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, initializeNexusGameForAudit, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { DIFFICULTIES } from '../game/bot-profiles';
import { MOBILE_STRONGHOLD, territory } from '../game/board';
import { ownedTech } from '../game/tech-tokens';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { nativeShipmentSources } from '../game/homeworld-options';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { nativeE3HomeworldPool as homePool } from './fixture-homeworld-native-e3-modules';
import { nexusMoritaniAction } from '../game/nexus-moritani-options';
import { nexusTraitorDrawAction, nexusTraitorReturnAction } from '../game/nexus-traitor-options';
import { discoveryEntryMoveAction } from '../game/discovery-entry-options';
import {
  advanceMoritaniNexus as advance, assertMoritaniNexusPhysical as physical,
  closeMoritaniNexus as close, createMoritaniNexusClosing as closing,
  createMoritaniNexusDiscovery as discovery, createMoritaniNexusLobby as lobby,
  moritaniNexusAct as act, moritaniNexusClean as clean, moritaniNexusPlayer as player,
  moritaniNexusPolicy as policy, moritaniNexusReload as reload,
  openMoritaniNexusBattle as openBattle, openMoritaniNexusLoss as loss,
  orderMoritaniNexusSpice as orderSpice, revealMoritaniNexus as reveal,
  settleMoritaniNexus as settle, shipMoritaniNexus as ship,
  type MoritaniNexusStep,
} from './fixture-e3-nexus-moritani';

function ordinaryCollectionSpice(g: Game, actor: string): number {
  return g.phase === 7 ? quoteSpiceCollection(g).receipts.find(r => r.player === actor)?.strongholds ?? 0 : 0;
}

function reject(g: Game, actor: string, action: Action): void {
  const before = structuredClone(g); assert.throws(() => applyAction(g, actor, action)); assert.deepEqual(g, before);
}
/** Every policy consumes a real private owned window from a JSON continuation. */
function policies(g: Game, actor: string, consume: (after: Game, action: Action) => void): void {
  for (const difficulty of DIFFICULTIES) {
    const saved = reload(g); player(saved, actor).bot = difficulty;
    const selected = policy(saved, actor, difficulty)[0]; assert.ok(selected, `${difficulty} needs an actual owned choice.`);
    const after = applyAction(saved, actor, selected); consume(after, selected); physical(after);
  }
}
function finish(g: Game, actions?: MoritaniNexusStep[]): Game {
  for (let n = 0; n < 12; n++) {
    g = settle(g, actions);
    const d = g.decision;
    if (!d) return g;
    if (d.kind === 'moritaniAssassinate') {
      g = act(g, { actor: d.player, action: { type: 'decision', event: d.event, decline: true } }, actions);
      continue;
    }
    assert.equal(d.kind, 'techToken');
    if (d.kind !== 'techToken') throw Error('Expected actual winner Tech choice.');
    assert.equal(g.battle, null, 'The battle and physical card cleanup precede its reward.');
    for (const entry of g.lastBattleContext!.mandatoryDiscard?.entries ?? [])
      assert.ok(g.discard.some(c => c.id === entry.card));
    reject(g, d.loser, { type: 'decision', token: d.choices[0] });
    reject(g, d.player, { type: 'decision', decline: true });
    policies(g, d.player, (after, action) => {
      const token = action.token as keyof NonNullable<Game['techTokens']>;
      assert.ok(d.choices.includes(token)); assert.equal(after.techTokens![token].owner, d.player);
    });
    g = act(g, { actor: d.player, action: { type: 'decision', token: d.choices[0] } }, actions);
  }
  throw Error('Original native aftermath reopened.');
}

void test('no-Skills native closing draw, paid Guild-home loss, printed bounty and private Mentat replacement obey the original physical order', () => {
  const f = closing({ homeworlds: true, tech: true, strongholds: true, discovery: true });
  assert.equal(f.firstMentat.after.strongholdCards!.owners.sietch_tabr, f.owner);
  assert.equal(f.firstMentat.after.strongholdCards!.owners.tueks_sietch, f.opponent);
  assert.equal(f.alliance.players.find(p => p.id === f.owner)!.ally, null);
  policies(f.draw.before, f.owner, after => {
    assert.equal(after.nexusCards!.cards!.hands[f.owner], 'moritani');
    assert.ok(!after.nexusCards!.cards!.deck.includes('moritani'));
  });
  reject(f.draw.before, f.opponent, f.draw.step.action);
  reject(f.draw.after, f.owner, f.draw.step.action);
  const b = loss(f, f.game);
  const sources = nativeShipmentSources(viewGame(b.arrival.before, f.owner), 1, 0); assert.ok(sources);
  const quote = homeworldShipmentChoice(viewGame(b.arrival.before, f.owner), b.location,
    Object.fromEntries(Object.entries(sources).filter(([, group]) => group.normal + group.elite > 0)));
  assert.equal(player(b.settledArrival, f.owner).spice, player(b.arrival.before, f.owner).spice - quote.cost);
  assert.equal(player(b.settledArrival, f.owner).reserves, player(b.arrival.before, f.owner).reserves - 1);
  assert.equal(homePool(b.settledArrival, f.owner, b.location).normal, 1);
  assert.ok(!b.settledArrival.pendingTerrorEntry && !b.settledArrival.pendingAmbassador);
  const revealed = reveal(b.game, b.plans, f.actions);
  assert.equal(player(revealed, f.opponent).spice, player(b.game, f.opponent).spice, 'Sealed support is not prepaid.');
  let g = settle(revealed, f.actions);
  const d = g.decision; assert.ok(d?.kind === 'moritaniAssassinate');
  assert.equal(player(g, f.owner).leaders.find(l => l.id === b.ownLeader)!.dead, true);
  assert.equal(player(g, f.owner).tanks, player(revealed, f.owner).tanks + 1);
  assert.equal(homePool(g, f.owner, b.location).normal, 0);
  assert.equal(player(g, f.opponent).tanks, player(revealed, f.opponent).tanks);
  assert.equal(homePool(g, f.opponent, b.location).normal, homePool(revealed, f.opponent, b.location).normal);
  const killed = player(revealed, f.owner).leaders.find(l => l.id === b.ownLeader)!;
  assert.equal(player(g, f.opponent).spice, player(revealed, f.opponent).spice,
    'Native assassination pauses the original winner casualties, support, bounty and cleanup continuation.');
  assert.equal(player(g, f.owner).spice, player(revealed, f.owner).spice);
  const token = ownedTech(g.techTokens, f.owner)[0]; assert.ok(token);
  const target = player(g, f.opponent).leaders.find(l => l.id === f.target)!;
  assert.equal(target.dead, false); assert.notEqual(b.enemyLeader, f.target);
  const before = reload(g), action: Action = { type: 'decision', event: d.event, card: f.target };
  reject(g, f.opponent, action); reject(g, f.owner, { ...action, event: 'stale' });
  reject(g, f.owner, { ...action, card: b.enemyLeader });
  policies(g, f.owner, after => {
    assert.equal(player(after, f.opponent).leaders.find(l => l.id === f.target)!.dead, true);
    assert.equal(player(after, f.owner).spice, player(before, f.owner).spice + target.strength);
    assert.equal(after.techTokens![token].owner, f.owner, 'Winner Tech cannot bypass private assassination and cleanup.');
  });
  g = act(g, { actor: f.owner, action }, f.actions);
  assert.equal(player(g, f.opponent).leaders.find(l => l.id === f.target)!.deaths, target.deaths + 1);
  assert.ok(player(g, f.owner).traitors.includes(f.target), 'The revealed physical card remains held until Mentat.');
  reject(g, f.owner, action);
  g = finish(g, f.actions);
  assert.equal(g.techTokens![token].owner, f.opponent);
  assert.equal(player(g, f.opponent).tanks, player(revealed, f.opponent).tanks + 1);
  assert.equal(homePool(g, f.opponent, b.location).normal, homePool(revealed, f.opponent, b.location).normal - 1);
  assert.equal(player(g, f.opponent).spice, player(revealed, f.opponent).spice - 1 + killed.strength +
    ordinaryCollectionSpice(g, f.opponent), 'The original winner support/bounty settles once after assassination.');
  const reserve = [...g.traitorReserve!], held = [...player(g, f.owner).traitors];
  g = advance(g, s => s.phase === 8 && s.decision?.kind === 'moritaniPlacement', f.actions);
  const receipt = g.moritaniAssassinate!.opportunities[0];
  assert.equal(receipt.stage, 'replaced'); assert.equal(receipt.replacement, reserve[0]);
  assert.deepEqual(g.traitorReserve, reserve.slice(1));
  assert.deepEqual(player(g, f.owner).traitors, [...held.filter(id => id !== f.target), reserve[0]]);
  const balance = player(g, f.owner).spice;
  g = act(g, { actor: f.owner, action: { type: 'decision', decline: true } }, f.actions);
  assert.equal(player(g, f.owner).spice, balance, 'Replacement never pays the bounty a second time.');
  physical(g);
});

void test('native Moritani Cunning spends one physical Nexus for an original supply placement and real assassination Terror entry, never relocation or home placement', () => {
  const f = closing({ roster: ['moritani', 'guild', 'atreides'], homeworlds: true, tech: true, strongholds: true });
  let g = advance(f.game, s => s.phase === 8 && s.decision?.kind === 'moritaniPlacement', f.actions);
  const view = viewGame(g, f.owner), token = g.moritaniTerror!.tokens.find(t => t.kind === 'assassination' && t.status === 'available')!;
  const action = nexusMoritaniAction(view, view.nexusMoritani!.event, token.id, 'polar_sink'); assert.ok(action);
  reject(g, f.opponent, action); reject(g, f.owner, { ...action, nexus: 'stale' });
  reject(g, f.owner, { ...action, territory: 'homeworld:guild' });
  reject(g, f.owner, { ...action, territory: 'homeworld:moritani' });
  reject(g, f.owner, { ...action, territory: MOBILE_STRONGHOLD });
  const placed = g.moritaniTerror!.tokens.find(t => t.status === 'placed')!;
  reject(g, f.owner, { ...action, token: placed.id });
  policies(g, f.owner, (after, chosen) => {
    assert.equal(after.nexusCards!.cards!.hands[f.owner], null);
    assert.equal(after.nexusCards!.cards!.discard.filter(c => c === 'moritani').length, 1);
    const committed = advance(after, s => clean(s) && !s.pendingMoritaniPlacement);
    assert.equal(committed.moritaniTerror!.tokens.find(t => t.id === chosen.token)!.location, chosen.territory);
    assert.equal(committed.moritaniTerror!.tokens.filter(t => t.status === 'available').length,
      g.moritaniTerror!.tokens.filter(t => t.status === 'available').length - 1);
  });
  g = act(g, { actor: f.owner, action }, f.actions);
  g = advance(g, s => clean(s) && !s.pendingMoritaniPlacement, f.actions);
  assert.equal(g.moritaniTerror!.tokens.find(t => t.id === token.id)!.location, 'polar_sink');
  assert.equal(g.nexusMoritaniHistory!.at(-1)!.stage, 'complete');
  reject(g, f.owner, action);
  g = advance(g, s => s.turn === 3 && s.phase === 5 && s.active === f.opponent && clean(s), f.actions);
  const beforeShipment = reload(g), sources = nativeShipmentSources(viewGame(g, f.opponent), 1, 0); assert.ok(sources);
  g = act(g, { actor: f.opponent, action: { type: 'ship', territory: 'polar_sink', sector: 0,
    amount: 1, elite: 0, allyPayment: 0, homeworldSources: sources } }, f.actions);
  g = advance(g, s => !s.response && !s.phaseOpening && s.decision?.kind === 'moritaniTerror', f.actions);
  if (g.pendingTerrorEntry!.stage === 'select') {
    g = act(g, { actor: f.owner, action: { type: 'decision', token: token.id } }, f.actions);
  }
  const before = reload(g), revealAction: Action = { type: 'decision', reveal: true };
  reject(g, f.opponent, revealAction);
  g = act(g, { actor: f.owner, action: revealAction }, f.actions);
  g = advance(g, s => !s.pendingShipment && !s.pendingTerrorEntry && clean(s), f.actions);
  const dead = player(g, f.opponent).leaders.filter(l => l.dead && !player(before, f.opponent).leaders.find(old => old.id === l.id)!.dead);
  assert.equal(dead.length, 1);
  assert.equal(dead[0].deaths, player(before, f.opponent).leaders.find(l => l.id === dead[0].id)!.deaths + 1);
  assert.equal(player(g, f.owner).spice, player(before, f.owner).spice + dead[0].strength);
  assert.equal(player(g, f.opponent).reserves, player(beforeShipment, f.opponent).reserves - 1);
  assert.equal(player(g, f.opponent).forces['polar_sink:0'], 1);
  assert.ok(player(g, f.opponent).spice < player(beforeShipment, f.opponent).spice);
  assert.equal(g.moritaniTerror!.tokens.find(t => t.id === token.id)!.status, 'removed');
  assert.equal(g.moritaniAssassinate!.opportunities.length, 0, 'Terror death is not a fabricated post-loss Traitor assassination.');
  reject(g, f.owner, revealAction); physical(g);
});

void test('actual Harkonnen Nexus Secret Ally draws and returns physical extra Traitors before a no-Skills native loss can assassinate the retained identity', () => {
  const f = closing({ nexus: 'harkonnen', homeworlds: true, tech: true });
  let g = advance(f.game, s => s.phase === 8 && clean(s), f.actions);
  assert.equal(g.players.some(p => p.faction === 'harkonnen'), false);
  assert.equal(player(g, f.owner).traitors.includes(f.target), false);
  // Select only the still-undealt original reserve. Both other draw identities
  // stay physical, and the old held identity is returned by the owner below.
  const i = g.traitorReserve!.indexOf(f.target); assert.ok(i >= 0);
  g.traitorReserve!.unshift(g.traitorReserve!.splice(i, 1)[0]);
  const before = reload(g), view = viewGame(g, f.owner), offer = view.nexusTraitors!.offer!;
  const action = nexusTraitorDrawAction(view, offer.event, 'secretAlly'); assert.ok(action);
  reject(g, f.opponent, action); reject(g, f.owner, { ...action, event: 'stale' });
  policies(g, f.owner, after => {
    assert.equal(after.nexusCards!.cards!.hands[f.owner], null);
    assert.deepEqual(after.traitorReserve, before.traitorReserve!.slice(2));
  });
  g = act(g, { actor: f.owner, action }, f.actions);
  const pending = viewGame(g, f.owner).nexusTraitors!.pending!;
  const choices = pending.choices.map(c => c.id), returned = choices.filter(id => id !== f.target); assert.equal(returned.length, 2);
  const returnAction = nexusTraitorReturnAction(viewGame(g, f.owner), pending.event, returned); assert.ok(returnAction);
  reject(g, f.opponent, returnAction); reject(g, f.owner, { ...returnAction, cards: [returned[0], returned[0]] });
  policies(g, f.owner, after => {
    assert.equal(player(after, f.owner).traitors.length, player(before, f.owner).traitors.length);
    assert.equal(after.traitorReserve!.length, before.traitorReserve!.length);
  });
  g = act(g, { actor: f.owner, action: returnAction }, f.actions);
  assert.deepEqual(player(g, f.owner).traitors, [f.target]);
  reject(g, f.owner, returnAction);
  const b = loss(f, g), revealed = reveal(b.game, b.plans, f.actions);
  g = settle(revealed, f.actions);
  const d = g.decision; assert.ok(d?.kind === 'moritaniAssassinate');
  const bounty = player(g, f.opponent).leaders.find(l => l.id === f.target)!.strength, balance = player(g, f.owner).spice;
  g = act(g, { actor: f.owner, action: { type: 'decision', event: d.event, card: f.target } }, f.actions);
  assert.equal(player(g, f.owner).spice, balance + bounty);
  assert.equal(player(g, f.opponent).leaders.find(l => l.id === f.target)!.dead, true);
  g = finish(g, f.actions); physical(g);
});

void test('Advanced normal Traitor call forfeits assassination, while Basic keeps the printed ordinary call and battle outcome', () => {
  for (const advanced of [true, false]) {
    const f = closing({ advanced, normalCall: true, homeworlds: true, tech: true });
    const b = loss(f, f.game, true); assert.equal(b.enemyLeader, f.target);
    let g = settle(reveal(b.game, b.plans, f.actions), f.actions, true);
    assert.notEqual(g.decision?.kind, 'moritaniAssassinate');
    g = finish(g, f.actions);
    assert.equal(g.lastBattleContext!.winner, f.owner);
    assert.equal(player(g, f.opponent).leaders.find(l => l.id === f.target)!.dead, true);
    assert.equal(player(g, f.opponent).forces[b.location] ?? 0, 0);
    assert.equal(player(g, f.owner).forces[b.location], 1);
    assert.equal(player(g, f.owner).leaders.find(l => l.id === b.ownLeader)!.dead, false);
    if (advanced) {
      assert.equal(g.moritaniAssassinate!.normalTraitorCall, true);
      assert.equal(g.moritaniAssassinate!.opportunities.length, 0);
      const blocked = viewGame(g, f.owner).moritaniAssassinate; assert.ok(blocked?.blocked);
      const emperor = g.players.find(p => p.faction === 'emperor')!.id;
      const arrival = ship(g, f.owner, 'homeworld:emperor', 1, f.actions);
      const battle = openBattle(arrival.settled, 'homeworld:emperor', f.owner, emperor, f.actions);
      const own = player(battle, f.owner).leaders.filter(l => !l.dead && !l.usedAt).sort((a, b) => a.strength - b.strength)[0];
      const enemy = player(battle, emperor).leaders.filter(l => !l.dead && !l.usedAt).sort((a, b) => b.strength - a.strength)[0];
      g = finish(reveal(battle, [
        { actor: f.owner, action: { type: 'battlePlan', leader: own.id, dial: 0, support: 0 } },
        { actor: emperor, action: { type: 'battlePlan', leader: enemy.id, dial: 1, support: 1 } },
      ], f.actions), f.actions);
      assert.equal(g.lastBattleContext!.winner, emperor);
      assert.equal(g.moritaniAssassinate!.opportunities.length, 0, 'A later real native-home loss cannot recover the forfeited power.');
      assert.equal(player(g, emperor).leaders.find(l => l.id === enemy.id)!.dead, false);
    } else assert.ok(!g.moritaniAssassinate, 'Basic must not receive the Advanced private assassination power.');
    reject(g, f.owner, { type: 'decision', event: b.game.battle!.event, card: f.target });
    physical(g);
  }
});

void test('Basic no-Skills ordinary Homeworld loss uses printed battle casualties without an Advanced assassination suffix', () => {
  const f = closing({ advanced: false, homeworlds: true, tech: true });
  const b = loss(f, f.game), revealed = reveal(b.game, b.plans, f.actions);
  const done = finish(revealed, f.actions);
  assert.equal(done.lastBattleContext!.winner, f.opponent);
  assert.ok(!done.moritaniAssassinate);
  assert.equal(player(done, f.owner).leaders.find(l => l.id === b.ownLeader)!.dead, true);
  assert.equal(player(done, f.opponent).leaders.find(l => l.id === f.target)!.dead, false);
  assert.equal(player(done, f.owner).tanks, player(revealed, f.owner).tanks + 1);
  assert.equal(homePool(done, f.owner, b.location).normal, 0);
  assert.equal(player(done, f.opponent).spice, player(revealed, f.opponent).spice +
    player(revealed, f.owner).leaders.find(l => l.id === b.ownLeader)!.strength);
  physical(done);
});

void test('original held Tabr rewards only its local normal win after real paid support, before loser Tech is transferred', () => {
  const f = closing({ tech: true, strongholds: true });
  const location = `sietch_tabr:${territory('sietch_tabr').sectors[0]}`;
  const arrival = ship(f.game, f.opponent, location, 1, f.actions);
  assert.equal(player(arrival.settled, f.opponent).reserves, player(arrival.before, f.opponent).reserves - 1);
  assert.ok(player(arrival.settled, f.opponent).spice < player(arrival.before, f.opponent).spice);
  const g = openBattle(arrival.settled, location, f.owner, f.opponent, f.actions);
  const own = player(g, f.owner).leaders.filter(l => !l.dead && !l.usedAt).sort((a, b) => b.strength - a.strength)[0];
  const enemy = player(g, f.opponent).leaders.filter(l => !l.dead && !l.usedAt).sort((a, b) => a.strength - b.strength)[0];
  const revealed = reveal(g, [
    { actor: f.owner, action: { type: 'battlePlan', leader: own.id, dial: 3, support: 3 } },
    { actor: f.opponent, action: { type: 'battlePlan', leader: enemy.id, dial: 1, support: 1 } },
  ], f.actions);
  const pending = settle(revealed, f.actions);
  assert.equal(pending.lastBattleContext!.winner, f.owner);
  assert.equal(player(pending, f.owner).spice, player(revealed, f.owner).spice - 3 + 1 + ordinaryCollectionSpice(pending, f.owner));
  assert.equal(player(pending, f.owner).forces[location], player(revealed, f.owner).forces[location] - 3);
  assert.equal(player(pending, f.owner).tanks, player(revealed, f.owner).tanks + 3);
  assert.equal(player(pending, f.opponent).forces[location] ?? 0, 0);
  const token = ownedTech(revealed.techTokens, f.opponent)[0]; assert.ok(token);
  assert.equal(pending.techTokens![token].owner, f.owner, 'A sole loser token transfers automatically after physical cleanup.');
  const done = finish(pending, f.actions);
  assert.equal(done.techTokens![token].owner, f.owner);
  assert.equal(player(done, f.owner).spice, player(pending, f.owner).spice, 'Tech choice cannot replay held-card income.');
  physical(done);
});

void test('original Discovery supply, reveal and free nested entry survive the late closing draw and source-local physical battle loss without Skills', () => {
  const f = discovery({ homeworlds: true, tech: true, strongholds: true });
  assert.equal(player(f.shipment.settled, f.owner).reserves, player(f.shipment.before, f.owner).reserves - 2);
  assert.ok(player(f.shipment.settled, f.owner).spice < player(f.shipment.before, f.owner).spice);
  const entryView = viewGame(f.entry.before, f.owner), entry = discoveryEntryMoveAction(entryView, entryView.discoveryEntry!.sources); assert.ok(entry);
  reject(f.entry.before, f.opponent, entry); reject(f.entry.before, f.owner, { ...entry, event: 'stale' });
  policies(f.entry.before, f.owner, (after, action) => {
    const moved = Array.isArray(action.groups)
      ? action.groups.reduce((sum, group) => sum + Number(group.normal) + Number(group.elite), 0) : 0;
    assert.equal(player(after, f.owner).forces['cistern:0'] ?? 0, moved);
    assert.equal(player(after, f.owner).forces['gara_kulon:8'] ?? 0, 2 - moved);
    assert.equal(player(after, f.owner).spice, player(f.entry.before, f.owner).spice);
  });
  assert.equal(player(f.entry.after, f.owner).forces['cistern:0'], 2);
  assert.equal(player(f.entry.after, f.owner).reserves, player(f.entry.before, f.owner).reserves);
  assert.equal(player(f.entry.after, f.owner).spice, player(f.entry.before, f.owner).spice);
  assert.equal(player(f.entry.after, f.owner).forces[f.shipment.step.action.territory + ':' + f.shipment.step.action.sector] ?? 0, 0);
  let g = advance(f.game, s => s.phase === 1 && clean(s), f.actions); orderSpice(g, true);
  const closed = close(f, g); g = closed.game;
  assert.equal(closed.draw.after.nexusCards!.cards!.hands[f.owner], 'moritani');
  const arrival = ship(g, f.opponent, 'cistern:0', 1, f.actions);
  assert.equal(player(arrival.settled, f.opponent).forces['cistern:0'], 1);
  assert.ok(player(arrival.settled, f.opponent).spice < player(arrival.before, f.opponent).spice);
  g = openBattle(arrival.settled, 'cistern:0', f.owner, f.opponent, f.actions);
  const own = player(g, f.owner).leaders.filter(l => !l.dead && !l.usedAt).sort((a, b) => a.strength - b.strength)[0];
  const enemy = player(g, f.opponent).leaders.filter(l => !l.dead && !l.usedAt && l.id !== f.target).sort((a, b) => b.strength - a.strength)[0];
  const revealed = reveal(g, [
    { actor: f.owner, action: { type: 'battlePlan', leader: own.id, dial: 0, support: 0 } },
    { actor: f.opponent, action: { type: 'battlePlan', leader: enemy.id, dial: 1, support: 1 } },
  ], f.actions);
  const done = finish(revealed, f.actions);
  assert.equal(done.lastBattleContext!.winner, f.opponent);
  assert.equal(player(done, f.owner).forces['cistern:0'] ?? 0, 0);
  assert.equal(player(done, f.owner).tanks, player(revealed, f.owner).tanks + 2);
  assert.equal(player(done, f.opponent).tanks, player(revealed, f.opponent).tanks + 1);
  assert.equal(player(done, f.opponent).spice, player(revealed, f.opponent).spice - 1 + ordinaryCollectionSpice(done, f.opponent),
    'Ordinary Collection is separate; held Tuek income and native-home strength do not migrate into a nested battle.');
  assert.equal(homePool(done, f.owner, 'homeworld:moritani').normal, homePool(revealed, f.owner, 'homeworld:moritani').normal);
  physical(done);
});

void test('Advanced Harkonnen and mixed-E3 original lobbies remain inadmissible without mutating the declared source pieces', () => {
  const native = lobby(); joinGame(native, newPlayer('harkonnen', 'Harkonnen', 'harkonnen'));
  const mixed = lobby(); joinGame(mixed, newPlayer('ecaz', 'Ecaz', 'ecaz'));
  for (const g of [native, mixed]) {
    let ready = reload(g);
    for (const p of ready.players) ready = act(ready, { actor: p.id, action: { type: 'ready' } });
    const before = structuredClone(ready); assert.throws(() => initializeNexusGameForAudit(ready)); assert.deepEqual(ready, before);
  }
});
