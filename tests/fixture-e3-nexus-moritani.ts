import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeNexusGameForAudit, joinGame, newPlayer, viewGame,
  type Action, type Game,
} from '../game/engine';
import type { FactionId } from '../game/catalog';
import { territory } from '../game/board';
import { leaders, spiceDeck, treacheryDeck } from '../game/cards';
import { traitorDeck } from '../game/traitors';
import { NEXUS_FACTIONS, validateNexusCards } from '../game/nexus-cards';
import { DISCOVERY_CARD_PLACEMENTS, DISCOVERY_SPICE_CARDS, validateDiscoveryState } from '../game/discoveries';
import { discoveryEntryMoveAction } from '../game/discovery-entry-options';
import { nativeShipmentSources } from '../game/homeworld-options';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { homeworldContext, homeworldGameIntegrity } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { nextDiscoveryStandaloneNexusE3SkillsStep } from './fixture-discovery-standalone-nexus-e3-skills';
import { moritaniStrongholdsPolicy } from './fixture-moritani-strongholds';
import { withClassicDiscoveryNexusLottery, withClassicDiscoveryNexusToken } from './fixture-discovery-classic-nexus';

export type MoritaniNexusStep = { actor: string; action: Action };
export type MoritaniNexusTransition = { before: Game; step: MoritaniNexusStep; after: Game };
export type MoritaniNexusOptions = {
  initial?: Game; advanced?: boolean; roster?: readonly FactionId[];
  homeworlds?: boolean; discovery?: boolean; tech?: boolean; strongholds?: boolean;
  nexus?: 'moritani' | 'harkonnen'; normalCall?: boolean;
};
export type MoritaniNexusSetup = {
  initial: Game; offered: Game; afterSetup: Game; owner: string; opponent: string;
  target: string; actions: MoritaniNexusStep[];
};
export type MoritaniNexusClosing = MoritaniNexusSetup & {
  firstStorm: Game; firstMentat: MoritaniNexusTransition; alliance: Game;
  draw: MoritaniNexusTransition; game: Game;
};
export type MoritaniNexusBattle = {
  arrival: MoritaniNexusTransition; settledArrival: Game; game: Game;
  location: string; plans: MoritaniNexusStep[]; ownLeader: string; enemyLeader: string;
};
export const moritaniNexusReload = (g: Game): Game => JSON.parse(JSON.stringify(g)) as Game;
export const moritaniNexusClean = (g: Game) =>
  !g.response && !g.phaseOpening && !g.decision && !g.pendingTreacheryDiscard && !g.truthtrance;
export const moritaniNexusPlayer = (g: Game, actor: string) => {
  const p = g.players.find(p => p.id === actor); assert.ok(p); return p;
};
export const moritaniNexusPolicy = moritaniStrongholdsPolicy;
export function moritaniNexusAct(g: Game, step: MoritaniNexusStep, actions?: MoritaniNexusStep[]): Game {
  actions?.push(structuredClone(step));
  return withClassicDiscoveryNexusLottery(() => applyAction(moritaniNexusReload(g), step.actor, step.action));
}
export function nextMoritaniNexusStep(g: Game): MoritaniNexusStep | null {
  if (!g.response && !g.phaseOpening && !g.pendingTreacheryDiscard) {
    const d = g.decision;
    if (d && ['moritaniAssassinate', 'techToken'].includes(d.kind)) return null;
    if (d?.kind === 'homeworldShipmentGuild') return { actor: d.player, action: { type: 'decision', event: d.event, allow: true } };
    if (d?.kind === 'homeworldDefense') return { actor: d.player, action: { type: 'decision', event: d.event, use: false } };
    if (d?.kind === 'homeworldRevivalDeployment') return { actor: d.player, action: { type: 'decision', event: d.event, decline: true } };
    if (d?.kind === 'grummanCollection') return { actor: d.player,
      action: { type: 'decision', event: d.event, decline: true } };
  }
  const next = nextDiscoveryStandaloneNexusE3SkillsStep(g);
  if (next?.action.type === 'stormDial') next.action.amount = g.turn === 1 ? 0 : 1;
  return next;
}
export function advanceMoritaniNexus(g: Game, until: (g: Game) => boolean, actions?: MoritaniNexusStep[]): Game {
  for (let n = 0; n < 3000; n++) {
    if (until(g)) return g;
    assert.notEqual(g.status, 'finished');
    const next = nextMoritaniNexusStep(g); assert.ok(next, 'Original sealed plans or native aftermath require their actual owner.');
    g = moritaniNexusAct(g, next, actions);
  }
  throw Error('Original no-Skills Moritani programme did not reach its owned boundary.');
}
/** Scope entropy to the original undealt physical supply. UUID generation stays native. */
function permutation(source: readonly string[], desired: readonly string[]): number[] {
  assert.deepEqual([...source].sort(), [...desired].sort());
  const working = [...source], rolls: number[] = [];
  for (let i = working.length - 1; i > 0; i--) {
    const j = working.indexOf(desired[i]); assert.ok(j >= 0 && j <= i);
    rolls.push(Math.floor((j + 0.5) * 0x100000000 / (i + 1)));
    [working[i], working[j]] = [working[j], working[i]];
  }
  return rolls;
}
function lottery<T>(rolls: readonly number[], operation: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto); let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1 && cursor < rolls.length) array[0] = rolls[cursor++];
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return operation(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
export function createMoritaniNexusLobby(options: MoritaniNexusOptions = {}): Game {
  const roster: readonly FactionId[] = options.roster ?? ['moritani', 'guild', 'emperor'];
  const advanced = options.advanced ?? options.initial?.advanced ?? true;
  let g = options.initial ? moritaniNexusReload(options.initial)
    : createGame('E3NEXUSMORITANI', newPlayer(roster[0], roster[0], roster[0]), advanced, ['ecaz']);
  if (!options.initial) for (const faction of roster.slice(1)) joinGame(g, newPlayer(faction, faction, faction));
  assert.equal(g.status, 'lobby'); assert.equal(g.advanced, advanced); assert.deepEqual(g.expansions, ['ecaz']);
  assert.equal(g.players.filter(p => ['ecaz', 'moritani'].includes(p.faction)).length, 1);
  assert.ok(g.players.some(p => p.faction === 'moritani'));
  assert.ok(g.players.every(p => ['moritani', 'guild', 'emperor', 'atreides', 'fremen', 'beneGesserit',
    ...(!advanced ? ['harkonnen'] : [])].includes(p.faction)));
  assert.equal(new Set(g.players.map(p => p.faction)).size, g.players.length);
  assert.ok(g.players.length >= (options.tech ? 3 : 2) && g.players.length <= 6);
  assert.ok(!options.strongholds || advanced); assert.ok(!g.leaderSkills && !g.ecazTreachery);
  for (const [type, enabled, present] of [
    ['homeworlds', options.homeworlds ?? false, !!g.homeworlds],
    ['techTokens', options.tech ?? false, !!g.techTokens],
    ['strongholdCards', options.strongholds ?? false, !!g.strongholdCards],
  ] as const) if (enabled !== present) g = applyAction(g, g.host, { type, enabled });
  g.discoveryEnabled = options.discovery ?? false;
  g.nexusCards ??= { cards: null, phase: null };
  assert.ok(g.nexusCards.cards === null && g.nexusCards.phase === null);
  return g;
}
export function createMoritaniNexusSetup(options: MoritaniNexusOptions = {}): MoritaniNexusSetup {
  let g = createMoritaniNexusLobby(options);
  const initial = moritaniNexusReload(g), actions: MoritaniNexusStep[] = [];
  const owner = g.players.find(p => p.faction === 'moritani')!.id;
  const opponent = g.players.find(p => p.faction === 'guild')!.id; assert.ok(opponent);
  const target = leaders('guild').find(l => l.name === (options.normalCall ? 'Staban Tuek' : 'Master Bewt'))!.id;
  for (const p of g.players) if (!p.ready) g = moritaniNexusAct(g, { actor: p.id, action: { type: 'ready' } }, actions);
  if (options.initial) g = initializeNexusGameForAudit(g);
  else {
    const nx = options.nexus ?? 'moritani', cards = treacheryDeck(['ecaz']), remaining = [...cards];
    const front = g.players.flatMap(p => {
      const kinds = [p.id === opponent ? 'projectile' : 'worthless', ...(p.faction === 'harkonnen' ? ['shield'] : [])];
      return kinds.map(kind => { const i = remaining.findIndex(c => c.kind === kind); assert.ok(i >= 0); return remaining.splice(i, 1)[0].id; });
    });
    const traitors = traitorDeck(g.players), desired = [target, ...traitors.filter(c => c !== target)];
    const index = nx === 'harkonnen' ? g.players.length * 4 : g.players.findIndex(p => p.id === owner) * 4;
    [desired[0], desired[index]] = [desired[index], desired[0]];
    const spiceCount = spiceDeck().length + (g.discoveryEnabled ? DISCOVERY_SPICE_CARDS.length + 1 : 0);
    g = lottery([...(g.discoveryEnabled ? Array<number>(7).fill(0xffffffff) : []),
      ...permutation(NEXUS_FACTIONS, [nx, ...NEXUS_FACTIONS.filter(c => c !== nx)]),
      ...permutation(cards.map(c => c.id), [...front, ...remaining.map(c => c.id)]),
      ...Array<number>(spiceCount - 1).fill(0xffffffff), ...permutation(traitors, desired)], () => initializeNexusGameForAudit(g));
  }
  const offered = moritaniNexusReload(g);
  // A real Bene Gesserit prediction can postpone the same original Traitor deal.
  // Supplied human lobbies keep their native lottery.
  while (g.status === 'setup') {
    let next = nextMoritaniNexusStep(g); assert.ok(next);
    if (!options.initial && g.setupStage === 'prediction') {
      const source = traitorDeck(g.players), desired = [target, ...source.filter(c => c !== target)];
      const index = options.nexus === 'harkonnen' ? g.players.length * 4 : g.players.findIndex(p => p.id === owner) * 4;
      [desired[0], desired[index]] = [desired[index], desired[0]];
      const step = next; actions.push(structuredClone(step));
      g = lottery(permutation(source, desired), () => applyAction(moritaniNexusReload(g), step.actor, step.action));
      continue;
    }
    if (!options.initial && options.nexus !== 'harkonnen' && g.setupStage === 'traitors' && moritaniNexusPlayer(g, owner).traitorChoices.length)
      next = { actor: owner, action: { type: 'traitor', leader: target } };
    if (g.decision?.kind === 'moritaniSetup' &&
      g.players.every(p => Object.entries(p.forces).every(([key, amount]) => !key.startsWith('sietch_tabr:') || amount === 0)))
      next = { actor: owner, action: { type: 'decision', territory: 'sietch_tabr', sector: territory('sietch_tabr').sectors[0] } };
    g = moritaniNexusAct(g, next, actions);
  }
  assert.equal(g.status, 'playing');
  return { initial, offered, afterSetup: g, owner, opponent, target, actions };
}
/** Only unplayed original Spice Cards are positioned. */
export function orderMoritaniNexusSpice(g: Game, worm = false): void {
  const kinds = [...(worm ? ['worm'] : []), ...Array<string>(g.advanced ? 2 : 1).fill('land')];
  for (const [position, kind] of kinds.entries()) {
    const index = g.spiceDeck.findIndex((c, i) => i >= position && (kind === 'worm'
      ? 'worm' in c && !c.greatMaker : 'territory' in c && !c.discovery));
    assert.ok(index >= position); g.spiceDeck.splice(position, 0, g.spiceDeck.splice(index, 1)[0]);
  }
}
export function closeMoritaniNexus(f: MoritaniNexusSetup, state: Game): { alliance: Game; draw: MoritaniNexusTransition; game: Game } {
  let g = advanceMoritaniNexus(state, s => !!s.nexus && !s.spiceWindow && !s.spiceResolution && moritaniNexusClean(s), f.actions);
  const others = g.players.filter(p => p.id !== f.owner); assert.ok(others.length >= 2);
  for (const [actor, target] of [[others[0].id, others[1].id], [others[1].id, others[0].id]])
    g = moritaniNexusAct(g, { actor, action: { type: 'alliance', target } }, f.actions);
  const alliance = moritaniNexusReload(g);
  g = advanceMoritaniNexus(g, s => s.nexusCards?.phase?.stage === 'drawing' && moritaniNexusClean(s), f.actions);
  assert.ok(g.nexusCards!.phase!.eligible.includes(f.owner));
  const before = moritaniNexusReload(g), step: MoritaniNexusStep = { actor: f.owner,
    action: { type: 'nexusCardChoice', turn: g.turn, card: g.nexusCards!.cards!.hands[f.owner], choice: 'draw', ownRedraws: 0 } };
  g = moritaniNexusAct(g, step, f.actions);
  return { alliance, draw: { before, step, after: moritaniNexusReload(g) }, game: g };
}
export function createMoritaniNexusClosing(options: MoritaniNexusOptions = {}): MoritaniNexusClosing {
  const f = createMoritaniNexusSetup(options); let g = moritaniNexusReload(f.afterSetup);
  orderMoritaniNexusSpice(g);
  g = advanceMoritaniNexus(g, s => s.phase === 1 && moritaniNexusClean(s), f.actions);
  const firstStorm = moritaniNexusReload(g);
  g = advanceMoritaniNexus(g, s => s.phase === 8 && s.decision?.kind === 'moritaniPlacement', f.actions);
  const token = g.moritaniTerror!.tokens.find(t => t.kind === 'extortion' && t.status === 'available'); assert.ok(token);
  g = moritaniNexusAct(g, { actor: f.owner, action: { type: 'decision', token: token.id, territory: 'arrakeen' } }, f.actions);
  let firstMentat: MoritaniNexusTransition | undefined;
  while (g.turn === 1) {
    const before = moritaniNexusReload(g), step = nextMoritaniNexusStep(g); assert.ok(step);
    g = moritaniNexusAct(g, step, f.actions);
    if (g.turn === 2) firstMentat = { before, step, after: moritaniNexusReload(g) };
  }
  assert.ok(firstMentat);
  g = advanceMoritaniNexus(g, s => s.phase === 1 && moritaniNexusClean(s), f.actions);
  orderMoritaniNexusSpice(g, true);
  return { ...f, firstStorm, firstMentat, ...closeMoritaniNexus(f, g) };
}
export function shipMoritaniNexus(g: Game, actor: string, destination: string, amount: number,
  actions?: MoritaniNexusStep[]): MoritaniNexusTransition & { settled: Game } {
  g = advanceMoritaniNexus(g, s => s.phase === 5 && s.active === actor && moritaniNexusClean(s), actions);
  const before = moritaniNexusReload(g), view = viewGame(g, actor);
  let action: Action;
  const sources = g.homeworlds ? nativeShipmentSources(view, amount, 0) : undefined;
  if (destination.startsWith('homeworld:')) {
    assert.ok(sources); const quote = homeworldShipmentChoice(view, destination,
      Object.fromEntries(Object.entries(sources).filter(([, f]) => f.normal + f.elite > 0)));
    assert.ok(quote.action, quote.blocked ?? 'Original paid native entry unavailable.'); action = quote.action;
  } else {
    const [territory, sector] = destination.split(':');
    action = { type: 'ship', territory, sector: Number(sector), amount, elite: 0, allyPayment: 0,
      ...(sources ? { homeworldSources: sources } : {}) };
  }
  const step = { actor, action }; g = moritaniNexusAct(g, step, actions);
  const after = moritaniNexusReload(g);
  g = advanceMoritaniNexus(g, s => !s.pendingHomeworldShipment && !s.pendingShipment && moritaniNexusClean(s), actions);
  return { before, step, after, settled: g };
}
export function openMoritaniNexusBattle(g: Game, location: string, owner: string, opponent: string,
  actions?: MoritaniNexusStep[]): Game {
  g = advanceMoritaniNexus(g, s => s.phase === 6 && moritaniNexusClean(s) && !!s.active, actions);
  assert.ok(g.active === owner || g.active === opponent);
  const territory = location.startsWith('homeworld:') ? location : location.split(':')[0];
  g = moritaniNexusAct(g, { actor: g.active!, action: { type: 'chooseBattle', territory,
    target: g.active === owner ? opponent : owner } }, actions);
  return advanceMoritaniNexus(g, s => !!s.battle && moritaniNexusClean(s) && !s.battle.preparation && s.battle.preLeader?.closed !== false, actions);
}
export function openMoritaniNexusLoss(f: MoritaniNexusSetup, state: Game, normalCall = false): MoritaniNexusBattle {
  const location = state.homeworlds && !normalCall ? 'homeworld:guild' : 'tueks_sietch:5';
  const arrival = shipMoritaniNexus(state, f.owner, location, 1, f.actions);
  const g = openMoritaniNexusBattle(arrival.settled, location, f.owner, f.opponent, f.actions);
  const own = moritaniNexusPlayer(g, f.owner).leaders.filter(l => !l.dead && !l.usedAt).sort((a, b) => a.strength - b.strength)[0];
  const enemy = moritaniNexusPlayer(g, f.opponent).leaders.filter(l => !l.dead && !l.usedAt && (normalCall || l.id !== f.target))
    .sort((a, b) => b.strength - a.strength)[0];
  const weapon = moritaniNexusPlayer(g, f.opponent).hand.find(c => c.kind === 'projectile');
  const worthless = moritaniNexusPlayer(g, f.owner).hand.find(c => c.kind === 'worthless');
  assert.ok(own && enemy && weapon && worthless);
  return { arrival, settledArrival: arrival.settled, game: g, location, ownLeader: own.id, enemyLeader: enemy.id, plans: [
    { actor: f.owner, action: { type: 'battlePlan', leader: own.id, dial: 0, support: 0, weapon: worthless.id } },
    { actor: f.opponent, action: { type: 'battlePlan', leader: enemy.id, dial: 1, support: g.advanced ? 1 : 0, weapon: weapon.id } },
  ] };
}
export function revealMoritaniNexus(g: Game, plans: MoritaniNexusStep[], actions?: MoritaniNexusStep[]): Game {
  for (const step of plans) {
    g = moritaniNexusAct(g, step, actions);
    if (!g.battle?.revealed) g = advanceMoritaniNexus(g, s => !!s.battle && moritaniNexusClean(s) && !s.battle.preparation && s.battle.preLeader?.closed !== false, actions);
  }
  assert.ok(g.battle?.revealed); return g;
}
export function settleMoritaniNexus(g: Game, actions?: MoritaniNexusStep[], normalCall = false): Game {
  for (let n = 0; n < 160; n++) {
    if (!g.response && !g.phaseOpening && (g.decision?.kind === 'moritaniAssassinate' || g.decision?.kind === 'techToken' || !g.battle && moritaniNexusClean(g))) return g;
    const next = nextMoritaniNexusStep(g); assert.ok(next);
    if (next.action.type === 'traitorCall') next.action.call = normalCall && moritaniNexusPlayer(g, next.actor).faction === 'moritani';
    g = moritaniNexusAct(g, next, actions);
  }
  throw Error('Original native battle suffix did not settle.');
}
export function createMoritaniNexusDiscovery(options: MoritaniNexusOptions = {}) {
  const f = createMoritaniNexusSetup({ ...options, discovery: true }); let g = moritaniNexusReload(f.afterSetup);
  const index = g.spiceDeck.findIndex(c => 'territory' in c && c.discovery === 'discovery-hagga-basin'); assert.ok(index >= 0);
  g.spiceDeck.unshift(g.spiceDeck.splice(index, 1)[0]);
  const second = g.spiceDeck.findIndex((c, i) => i > 0 && 'territory' in c && !c.discovery && c.territory !== 'hagga_basin');
  assert.ok(second > 0); g.spiceDeck.splice(1, 0, g.spiceDeck.splice(second, 1)[0]);
  g = advanceMoritaniNexus(g, s => s.phase === 1 && moritaniNexusClean(s), f.actions);
  for (let n = 0; !g.discoveries!.tokens.some(t => t.face === 'cistern' && t.status === 'placed') && n < 160; n++) {
    const step = nextMoritaniNexusStep(g); assert.ok(step); f.actions.push(structuredClone(step));
    g = withClassicDiscoveryNexusToken(g, 'cistern', () => applyAction(moritaniNexusReload(g), step.actor, step.action));
  }
  const placement = DISCOVERY_CARD_PLACEMENTS['discovery-hagga-basin'];
  const shipment = shipMoritaniNexus(g, f.owner, `${placement.territory}:${placement.sector}`, 2, f.actions);
  g = advanceMoritaniNexus(shipment.settled, s => s.phase === 7 && moritaniNexusClean(s), f.actions);
  const token = g.discoveries!.tokens.find(t => t.face === 'cistern' && t.status === 'placed')!.id;
  if (viewGame(g, f.owner).discoveries!.canInspect.includes(token))
    g = moritaniNexusAct(g, { actor: f.owner, action: { type: 'discovery', token, reveal: false } }, f.actions);
  g = moritaniNexusAct(g, { actor: f.owner, action: { type: 'discovery', token, reveal: true } }, f.actions);
  const revealed = moritaniNexusReload(g);
  g = advanceMoritaniNexus(g, s => s.turn === 2 && !s.response && !s.phaseOpening && s.decision?.kind === 'discoveryEntry' && s.decision.player === f.owner, f.actions);
  const before = moritaniNexusReload(g), view = viewGame(g, f.owner);
  const action = discoveryEntryMoveAction(view, view.discoveryEntry!.sources); assert.ok(action);
  const step = { actor: f.owner, action }; g = moritaniNexusAct(g, step, f.actions);
  return { ...f, shipment, revealed, token, entry: { before, step, after: moritaniNexusReload(g) }, game: g };
}
export function assertMoritaniNexusPhysical(g: Game): void {
  validateNexusCards(g.nexusCards!.cards!, g.players);
  if (g.discoveries) validateDiscoveryState(g.discoveries);
  if (g.homeworlds) homeworldGameIntegrity(g);
  const homes = g.homeworlds?.custody ? homeworldForceGroups(homeworldContext(g), g.homeworlds.custody) : [];
  for (const p of g.players) {
    const visitors = homes.filter(h => h.native !== p.id).reduce((n, h) => n + (h.forces[p.id]?.normal ?? 0), 0);
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((n, f) => n + f, 0) + visitors, 20);
  }
  const retired = g.moritaniAssassinate?.opportunities.filter(o => o.stage === 'replaced').map(o => o.card!) ?? [];
  assert.deepEqual([...g.traitorReserve!, ...g.players.flatMap(p => [...p.traitors, ...p.traitorChoices]), ...retired].sort(), traitorDeck(g.players).sort());
  const auction = g.auction?.cards.slice(g.auction.index + (g.currentAuctionSale ? 1 : 0)) ?? [];
  assert.deepEqual([...g.deck, ...g.discard, ...g.players.flatMap(p => p.hand), ...auction].map(c => c.id).sort(), treacheryDeck(['ecaz']).map(c => c.id).sort());
}
