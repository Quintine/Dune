import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeNexusGameForAudit, joinGame, newPlayer, viewGame,
  type Action, type Game,
} from '../game/engine';
import type { FactionId } from '../game/catalog';
import { botActions } from '../game/bots';
import { treacheryDeck } from '../game/cards';
import type { Difficulty } from '../game/bot-profiles';
import { territory } from '../game/board';
import { NEXUS_FACTIONS } from '../game/nexus-cards';
import { nativeShipmentSources } from '../game/homeworld-options';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { nexusEcazDukeAction } from '../game/nexus-ecaz-duke-options';
import { nexusCardAction } from '../game/nexus-card-options';
import { DISCOVERY_CARD_PLACEMENTS } from '../game/discoveries';
import { discoveryEntryMoveAction } from '../game/discovery-entry-options';
import { nextNativeE3HomeworldStep, nativeE3HomeworldPlayer, nativeE3HomeworldPool } from './fixture-homeworld-native-e3-modules';
import { withClassicDiscoveryNexusLottery, withClassicDiscoveryNexusToken } from './fixture-discovery-classic-nexus';

export { nativeE3HomeworldPlayer as e3NexusEcazPlayer, nativeE3HomeworldPool as e3NexusEcazPool };
export type E3NexusEcazStep = { actor: string; action: Action };
export type E3NexusEcazTransition = { before: Game; step: E3NexusEcazStep; after: Game };
export type E3NexusEcazOptions = {
  /** An original undealt lobby or its native setup; never convert a played save. */
  initial?: Game;
  advanced?: boolean;
  roster?: readonly FactionId[];
  tech?: boolean;
  strongholds?: boolean;
  homeworlds?: boolean;
  discovery?: boolean;
};
export type E3NexusEcazSetup = {
  initial: Game; offered: Game; afterSetup: Game; owner: string; others: string[];
  actions: E3NexusEcazStep[];
};
export type E3NexusEcazClosing = E3NexusEcazSetup & {
  firstMentat: E3NexusEcazTransition; alliance: Game; draw: E3NexusEcazTransition; game: Game;
  claim?: E3NexusEcazTransition;
};
export type E3NexusEcazCoalition = E3NexusEcazClosing & {
  ally: string; opponent: string; location: string; ecazForces: number;
  arrivals: (E3NexusEcazTransition & { settled: Game })[]; beforeBattle: Game; choice: E3NexusEcazStep; game: Game;
};
export const e3NexusEcazReload = (g: Game): Game => JSON.parse(JSON.stringify(g)) as Game;
export const e3NexusEcazClean = (g: Game): boolean =>
  !g.response && !g.phaseOpening && !g.decision && !g.pendingTreacheryDiscard && !g.truthtrance;

/** Minimal persisted bot profiles, projected only after genuine owner custody exists. */
export function e3NexusEcazPolicy(g: Game, actor: string, difficulty: Difficulty): Action[] {
  const saved = e3NexusEcazReload(g);
  nativeE3HomeworldPlayer(saved, actor).bot = difficulty;
  return botActions(viewGame(e3NexusEcazReload(saved), actor));
}
export function e3NexusEcazStep(g: Game, step: E3NexusEcazStep, actions?: E3NexusEcazStep[]): Game {
  actions?.push(structuredClone(step));
  return withClassicDiscoveryNexusLottery(() => applyAction(e3NexusEcazReload(g), step.actor, step.action));
}
export function nextE3NexusEcazStep(g: Game): E3NexusEcazStep | null {
  if (!g.response && !g.phaseOpening && !g.pendingTreacheryDiscard) {
    if (g.nexusCards?.phase?.stage === 'drawing' && !g.decision) {
      const actor = g.nexusCards.phase.eligible.find(id => !g.nexusCards!.phase!.done.includes(id));
      if (actor) {
        const view = viewGame(g, actor), choices = view.nexusCards!.choices;
        const action = nexusCardAction(view, choices.includes('keep') ? 'keep' : 'draw'); assert.ok(action);
        return { actor, action };
      }
    }
    if (g.decision?.kind === 'ecazBattleLead' || g.decision?.kind === 'techToken') return null;
    if (g.decision?.kind === 'homeworldShipmentGuild') return { actor: g.decision.player,
      action: { type: 'decision', event: g.decision.event, allow: true } };
    if (g.decision && ['advisor', 'intrusion', 'advisorBattle'].includes(g.decision.kind))
      return { actor: g.decision.player, action: { type: 'decision', accept: false } };
  }
  return nextNativeE3HomeworldStep(g);
}
export function advanceE3NexusEcaz(g: Game, until: (g: Game) => boolean, actions?: E3NexusEcazStep[]): Game {
  for (let n = 0; n < 3000; n++) {
    if (until(g)) return g;
    assert.notEqual(g.status, 'finished');
    const next = nextE3NexusEcazStep(g);
    assert.ok(next, 'The actual owner must choose coalition lead, seal a plan or select the winner Tech token.');
    g = e3NexusEcazStep(g, next, actions);
  }
  throw Error('Original no-Skills Ecaz chronology did not reach its owned boundary.');
}
function permutation(source: readonly string[], desired: readonly string[]): number[] {
  const current = [...source], rolls: number[] = [];
  for (let i = current.length - 1; i > 0; i--) {
    const j = current.indexOf(desired[i]); assert.ok(j >= 0 && j <= i);
    rolls.push(Math.floor((j + 0.5) * 0x100000000 / (i + 1)));
    [current[i], current[j]] = [current[j], current[i]];
  }
  assert.deepEqual(current, desired); return rolls;
}
/** Select only ORIGINAL undealt Nexus/Treachery permutations. No hand is assigned. */
function initialize(g: Game): Game {
  const cards = treacheryDeck(['ecaz']), remaining = [...cards], front: string[] = [];
  for (const p of g.players) for (let n = 0; n < (p.faction === 'harkonnen' ? 2 : 1); n++) {
    const index = remaining.findIndex(c => c.kind === 'worthless' || c.kind === 'shield');
    assert.ok(index >= 0); front.push(remaining.splice(index, 1)[0].id);
  }
  const rolls = [...(g.discoveryEnabled ? Array<number>(7).fill(0xffffffff) : []),
    ...permutation(NEXUS_FACTIONS, ['ecaz', ...NEXUS_FACTIONS.filter(c => c !== 'ecaz')]),
    ...permutation(cards.map(c => c.id), [...front, ...remaining.map(c => c.id)])];
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto); let index = 0;
  crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    if (array instanceof Uint32Array && array.length === 1) array[0] = rolls[index++] ?? 0xffffffff;
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return initializeNexusGameForAudit(g); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
export function createE3NexusEcazSetup(options: E3NexusEcazOptions = {}): E3NexusEcazSetup {
  const roster = options.roster ?? ['ecaz', 'guild', 'emperor'];
  let g = options.initial ? e3NexusEcazReload(options.initial)
    : createGame('E3NEXUSECAZ', newPlayer(roster[0], roster[0], roster[0]), options.advanced ?? true, ['ecaz']);
  if (!options.initial) for (const faction of roster.slice(1)) joinGame(g, newPlayer(faction, faction, faction));
  assert.ok(g.status === 'lobby' || g.status === 'setup' && g.turn === 1 && g.phase === 0);
  assert.equal(g.advanced, options.advanced ?? g.advanced); assert.deepEqual(g.expansions, ['ecaz']);
  assert.equal(g.players.filter(p => p.faction === 'ecaz').length, 1);
  assert.ok(g.players.every(p => ['ecaz', 'guild', 'emperor', 'atreides', 'fremen', 'beneGesserit', 'harkonnen'].includes(p.faction)));
  assert.ok(!g.leaderSkills && !g.ecazTreachery);
  const modules = { techTokens: options.tech ?? !!g.techTokens,
    strongholdCards: options.strongholds ?? !!g.strongholdCards, homeworlds: options.homeworlds ?? !!g.homeworlds };
  const actions: E3NexusEcazStep[] = [];
  if (g.status === 'lobby') {
    for (const [type, enabled] of Object.entries(modules)) if (!!g[type as keyof typeof modules] !== enabled)
      g = e3NexusEcazStep(g, { actor: g.host, action: { type, enabled } }, actions);
    g.discoveryEnabled = options.discovery ?? !!g.discoveryEnabled;
    g.nexusCards ??= { cards: null, phase: null };
  } else {
    for (const [type, enabled] of Object.entries(modules)) assert.equal(!!g[type as keyof typeof modules], enabled);
    assert.equal(!!g.discoveryEnabled, options.discovery ?? !!g.discoveryEnabled);
    assert.ok(g.nexusCards?.cards, 'Never graft Nexus onto a dealt setup.');
  }
  const initial = e3NexusEcazReload(g);
  if (g.status === 'lobby') {
    for (const p of g.players) if (!p.ready) g = e3NexusEcazStep(g, { actor: p.id, action: { type: 'ready' } }, actions);
    g = initialize(g);
  }
  const offered = e3NexusEcazReload(g), owner = g.players.find(p => p.faction === 'ecaz')!.id;
  for (let n = 0; g.status === 'setup' && n < 200; n++) {
    const next = nextE3NexusEcazStep(g); assert.ok(next);
    g = e3NexusEcazStep(g, next, actions);
  }
  assert.equal(g.status, 'playing');
  assert.equal(nativeE3HomeworldPlayer(g, owner).reserves, 14);
  assert.equal(Object.values(nativeE3HomeworldPlayer(g, owner).forces).reduce((n, f) => n + f, 0), 6);
  return { initial, offered, afterSetup: g, owner, others: g.players.filter(p => p.id !== owner).map(p => p.id), actions };
}
/** Only unplayed Spice Cards move within their original deck. */
export function orderE3NexusEcazSpice(g: Game, worm = false): void {
  const kinds = [...(worm ? ['worm'] : []), ...Array<string>(g.advanced ? 2 : 1).fill('land')];
  for (const [position, kind] of kinds.entries()) {
    const index = g.spiceDeck.findIndex((c, i) => i >= position && (kind === 'worm'
      ? 'worm' in c && !c.greatMaker && !c.suppressed : 'territory' in c && !c.discovery));
    assert.ok(index >= position); g.spiceDeck.splice(position, 0, g.spiceDeck.splice(index, 1)[0]);
  }
}
export function shipE3NexusEcaz(g: Game, actor: string, destination: string, amount: number,
  actions?: E3NexusEcazStep[]): E3NexusEcazTransition & { settled: Game } {
  g = advanceE3NexusEcaz(g, s => s.phase === 5 && s.active === actor && e3NexusEcazClean(s), actions);
  const before = e3NexusEcazReload(g), sources = g.homeworlds ? nativeShipmentSources(viewGame(g, actor), amount, 0) : undefined;
  if (g.homeworlds) assert.ok(sources);
  let action: Action;
  if (destination.startsWith('homeworld:')) {
    assert.ok(sources);
    const choice = homeworldShipmentChoice(viewGame(g, actor), destination,
      Object.fromEntries(Object.entries(sources).filter(([, f]) => f.normal + f.elite > 0)));
    assert.ok(choice.action, choice.blocked ?? 'Original native invasion is unavailable.'); action = choice.action;
  } else {
    const [kind, sector] = destination.split(':');
    action = { type: 'ship', territory: kind, sector: Number(sector), amount, elite: 0, allyPayment: 0,
      ...(sources ? { homeworldSources: sources } : {}) };
  }
  const step = { actor, action }; g = e3NexusEcazStep(g, step, actions);
  const after = e3NexusEcazReload(g);
  g = advanceE3NexusEcaz(g, s => !s.pendingShipment && !s.pendingHomeworldShipment && e3NexusEcazClean(s), actions);
  return { before, step, after, settled: g };
}
function finishMentat(g: Game, actions: E3NexusEcazStep[]): E3NexusEcazTransition {
  const turn = g.turn;
  for (let n = 0; n < 200; n++) {
    const before = e3NexusEcazReload(g), step = nextE3NexusEcazStep(g); assert.ok(step);
    g = e3NexusEcazStep(g, step, actions);
    if (g.turn !== turn) return { before, step, after: g };
  }
  throw Error('Original Mentat did not finish.');
}
/** Two other real seats ally; only then can unallied Ecaz draw at Nexus closing. */
export function closeE3NexusEcaz(f: E3NexusEcazSetup, state: Game, firstMentat: E3NexusEcazTransition): E3NexusEcazClosing {
  let g = advanceE3NexusEcaz(state, s => s.turn === 2 && s.phase === 1 && e3NexusEcazClean(s), f.actions);
  orderE3NexusEcazSpice(g, true);
  g = advanceE3NexusEcaz(g, s => s.nexus && !s.spiceWindow && !s.spiceResolution && e3NexusEcazClean(s), f.actions);
  for (const [actor, target] of [[f.others[0], f.others[1]], [f.others[1], f.others[0]]])
    g = e3NexusEcazStep(g, { actor, action: { type: 'alliance', target } }, f.actions);
  const alliance = e3NexusEcazReload(g);
  g = advanceE3NexusEcaz(g, s => s.nexusCards?.phase?.stage === 'drawing' && e3NexusEcazClean(s), f.actions);
  assert.ok(g.nexusCards!.phase!.eligible.includes(f.owner));
  const before = e3NexusEcazReload(g), step: E3NexusEcazStep = { actor: f.owner,
    action: { type: 'nexusCardChoice', turn: g.turn, card: g.nexusCards!.cards!.hands[f.owner], choice: 'draw', ownRedraws: 0 } };
  g = e3NexusEcazStep(g, step, f.actions);
  return { ...f, firstMentat, alliance, draw: { before, step, after: g }, game: g };
}
export function createE3NexusEcazClosing(options: E3NexusEcazOptions = {}, claimTabr = false): E3NexusEcazClosing {
  const f = createE3NexusEcazSetup(options); assert.ok(f.others.length >= 2);
  let g = e3NexusEcazReload(f.afterSetup); orderE3NexusEcazSpice(g);
  let claim: E3NexusEcazTransition | undefined;
  if (claimTabr) {
    const arrival = shipE3NexusEcaz(g, f.owner, 'sietch_tabr:14', 1, f.actions);
    g = arrival.settled; claim = arrival;
  }
  g = advanceE3NexusEcaz(g, s => s.phase === 8 && e3NexusEcazClean(s), f.actions);
  const mentat = finishMentat(g, f.actions);
  return { ...closeE3NexusEcaz(f, mentat.after, mentat), claim };
}
export function openE3NexusEcazBattle(g: Game, destination: string, first: string, second: string,
  actions?: E3NexusEcazStep[]): Game {
  g = advanceE3NexusEcaz(g, s => s.phase === 6 && e3NexusEcazClean(s) && !!s.active, actions);
  const choice = viewGame(g, g.active!).battleChoices.find(b => b.territory === destination &&
    [first, second].includes(b.attacker) && [first, second].includes(b.defender)); assert.ok(choice);
  g = e3NexusEcazStep(g, { actor: choice.chooser, action: { type: 'chooseBattle', territory: destination,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker } }, actions);
  return advanceE3NexusEcaz(g, s => !!s.battle && e3NexusEcazClean(s) && !s.battle.preparation && s.battle.preLeader?.closed !== false, actions);
}
export function createE3NexusEcazCunning(options: E3NexusEcazOptions = {}) {
  const f = createE3NexusEcazClosing({ ...options, advanced: true, roster: ['ecaz', 'guild', 'beneGesserit'],
    homeworlds: true, tech: true, strongholds: true });
  const opponent = f.afterSetup.players.find(p => p.faction === 'beneGesserit')!.id, location = 'homeworld:beneGesserit';
  const arrival = shipE3NexusEcaz(f.game, f.owner, location, 1, f.actions);
  let g = advanceE3NexusEcaz(arrival.settled, s => s.phase === 6 && e3NexusEcazClean(s) && !s.battle, f.actions);
  const before = e3NexusEcazReload(g), action = nexusEcazDukeAction(viewGame(g, f.owner)); assert.ok(action);
  const step = { actor: f.owner, action }; g = e3NexusEcazStep(g, step, f.actions);
  const cunning: E3NexusEcazTransition = { before, step, after: g };
  g = openE3NexusEcazBattle(g, location, f.owner, opponent, f.actions);
  const own = nativeE3HomeworldPlayer(g, f.owner).leaders.filter(l => !l.dead).sort((a, b) => a.strength - b.strength)[0];
  const enemy = nativeE3HomeworldPlayer(g, opponent).leaders.filter(l => !l.dead).sort((a, b) => b.strength - a.strength)[0];
  const plans: E3NexusEcazStep[] = [
    { actor: f.owner, action: { type: 'battlePlan', leader: own.id, dial: 0, support: 0 } },
    { actor: opponent, action: { type: 'battlePlan', leader: enemy.id, dial: 3, support: 3 } },
  ];
  return { ...f, opponent, location, arrival, cunning, game: g, plans };
}
/** Every army reaches Tabr by paid native shipment; no board/wallet/card staging. */
export function createE3NexusEcazCoalition(options: E3NexusEcazOptions = {}, ecazForces?: number): E3NexusEcazCoalition {
  const f = createE3NexusEcazClosing({ ...options, roster: ['ecaz', 'guild', 'emperor'] }, true);
  let g = advanceE3NexusEcaz(f.game, s => s.turn === 3 && s.phase === 1 && e3NexusEcazClean(s), f.actions);
  orderE3NexusEcazSpice(g, true);
  g = advanceE3NexusEcaz(g, s => s.nexus && !s.spiceWindow && !s.spiceResolution && e3NexusEcazClean(s), f.actions);
  const ally = g.players.find(p => p.faction === 'emperor')!.id, opponent = g.players.find(p => p.faction === 'guild')!.id;
  g = e3NexusEcazStep(g, { actor: ally, action: { type: 'alliance', target: null } }, f.actions);
  for (const [actor, target] of [[f.owner, ally], [ally, f.owner]])
    g = e3NexusEcazStep(g, { actor, action: { type: 'alliance', target } }, f.actions);
  const location = `sietch_tabr:${territory('sietch_tabr').sectors[0]}`;
  const amount = ecazForces ?? (g.advanced ? 5 : 4);
  const requested: Record<string, number> = { [f.owner]: amount - 1, [ally]: 4, [opponent]: 8 };
  const arrivals: (E3NexusEcazTransition & { settled: Game })[] = [];
  const shipped = new Set<string>();
  for (let n = 0; n < 300; n++) {
    if (g.phase === 6 && e3NexusEcazClean(g)) break;
    if (g.phase === 5 && e3NexusEcazClean(g) && g.active && !shipped.has(g.active)) {
      const actor = g.active, arrival = shipE3NexusEcaz(g, actor, location, requested[actor], f.actions);
      arrivals.push(arrival); shipped.add(actor); g = arrival.settled;
    } else {
      const next = nextE3NexusEcazStep(g); assert.ok(next); g = e3NexusEcazStep(g, next, f.actions);
    }
  }
  assert.equal(shipped.size, 3);
  const beforeBattle = e3NexusEcazReload(g), choice = viewGame(g, g.active!).battleChoices.find(b => b.territory === 'sietch_tabr'); assert.ok(choice);
  const owned: E3NexusEcazStep = { actor: choice.chooser, action: { type: 'chooseBattle', territory: 'sietch_tabr',
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker } };
  if (g.advanced || amount % 2 === 0) g = e3NexusEcazStep(g, owned, f.actions);
  return { ...f, ally, opponent, location, ecazForces: amount, arrivals, beforeBattle, choice: owned, game: g };
}
export function revealE3NexusEcaz(g: Game, plans: readonly E3NexusEcazStep[], actions?: E3NexusEcazStep[]): Game {
  for (const plan of plans) {
    g = e3NexusEcazStep(g, plan, actions);
    if (!g.battle?.revealed) g = advanceE3NexusEcaz(g, s => !!s.battle && e3NexusEcazClean(s) && !s.battle.preparation && s.battle.preLeader?.closed !== false, actions);
  }
  assert.ok(g.battle?.revealed); return g;
}
/** Token placement uses its original supply lottery, not a preplaced token. */
export function createE3NexusEcazDiscovery(options: E3NexusEcazOptions = {}) {
  const f = createE3NexusEcazSetup({ ...options, discovery: true });
  let g = e3NexusEcazReload(f.afterSetup);
  const index = g.spiceDeck.findIndex(c => 'territory' in c && c.discovery === 'discovery-hagga-basin'); assert.ok(index >= 0);
  g.spiceDeck.unshift(g.spiceDeck.splice(index, 1)[0]);
  if (g.advanced) {
    const second = g.spiceDeck.findIndex((c, i) => i > 0 && 'territory' in c && !c.discovery && c.territory !== 'hagga_basin'); assert.ok(second > 0);
    g.spiceDeck.splice(1, 0, g.spiceDeck.splice(second, 1)[0]);
  }
  g = advanceE3NexusEcaz(g, s => s.phase === 1 && e3NexusEcazClean(s), f.actions);
  for (let n = 0; !g.discoveries!.tokens.some(t => t.face === 'cistern' && t.status === 'placed') && n < 160; n++) {
    const step = nextE3NexusEcazStep(g); assert.ok(step); f.actions.push(structuredClone(step));
    g = withClassicDiscoveryNexusToken(g, 'cistern', () => applyAction(e3NexusEcazReload(g), step.actor, step.action));
  }
  const destination = DISCOVERY_CARD_PLACEMENTS['discovery-hagga-basin'];
  const arrival = shipE3NexusEcaz(g, f.owner, `${destination.territory}:${destination.sector}`, 2, f.actions);
  g = advanceE3NexusEcaz(arrival.settled, s => s.phase === 7 && e3NexusEcazClean(s), f.actions);
  const token = g.discoveries!.tokens.find(t => t.face === 'cistern' && t.status === 'placed')!.id;
  if (viewGame(g, f.owner).discoveries!.canInspect.includes(token))
    g = e3NexusEcazStep(g, { actor: f.owner, action: { type: 'discovery', token, reveal: false } }, f.actions);
  const beforeReveal = e3NexusEcazReload(g);
  g = e3NexusEcazStep(g, { actor: f.owner, action: { type: 'discovery', token, reveal: true } }, f.actions);
  const revealed = e3NexusEcazReload(g);
  g = advanceE3NexusEcaz(g, s => s.phase === 8 && e3NexusEcazClean(s), f.actions);
  const firstMentat = finishMentat(g, f.actions);
  g = advanceE3NexusEcaz(firstMentat.after, s => !s.response && !s.phaseOpening &&
    s.decision?.kind === 'discoveryEntry' && s.decision.player === f.owner, f.actions);
  const before = e3NexusEcazReload(g), view = viewGame(g, f.owner), action = discoveryEntryMoveAction(view, view.discoveryEntry!.sources); assert.ok(action);
  const step = { actor: f.owner, action }; g = e3NexusEcazStep(g, step, f.actions);
  const entry: E3NexusEcazTransition = { before, step, after: e3NexusEcazReload(g) };
  const closing = closeE3NexusEcaz(f, g, firstMentat);
  return { ...closing, arrival, token, beforeReveal, revealed, entry };
}
