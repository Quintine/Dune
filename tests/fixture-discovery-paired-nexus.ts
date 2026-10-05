import assert from 'node:assert/strict';
import {
  applyAction, createGame, handLimit, initializePairedNexusGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game, type Player,
} from '../game/engine';
import { MOBILE_LOCATION, gameTerritories, territory, validGameLocation } from '../game/board';
import { isAuditorLeader, type Card } from '../game/cards';
import { DISCOVERY_CARD_PLACEMENTS } from '../game/discoveries';
import { greatMakerRideAction } from '../game/great-maker-options';
import { nextPairedIxNexusModulesStep } from './fixture-paired-ix-nexus-modules';
import { nextPairedChoamStep } from './fixture-paired-choam-nexus-modules';
import {
  withClassicDiscoveryNexusLottery, withClassicDiscoveryNexusToken,
} from './fixture-discovery-classic-nexus';

export type PairedDiscoveryNexusStep = { actor: string; action: Action };
export type PairedDiscoveryNexusOptions = {
  /** Authenticated original ready lobby or original unassigned turn-one setup. */
  initial?: Game;
  family?: 'ix' | 'choam';
  advanced?: boolean;
  tech?: boolean;
  strongholds?: boolean;
};
export type PairedDiscoveryNexusTransition = { before: Game; step: PairedDiscoveryNexusStep; after: Game };
export type PairedDiscoveryNexusFixture = {
  initial: Game; setup: Game; afterSetup: Game; collection: Game;
  firstMentat: PairedDiscoveryNexusTransition; game: Game;
  family: 'ix' | 'choam'; owner: string; native: string; collector: string;
  guild: string; fremen: string; token: string; source: string; claim: 'arrakeen' | 'carthag';
  actions: PairedDiscoveryNexusStep[]; staging: string[];
};
export type PairedDiscoveryNexusClosing = {
  entry: PairedDiscoveryNexusTransition; vote: Game; ride: PairedDiscoveryNexusTransition;
  alliance: Game; drawing: Game; afterDraw: Game;
};
export type PairedDiscoveryNexusBattle = {
  game: Game; beforeBattle: Game; battleStep: PairedDiscoveryNexusStep;
  winner: string; loser: string; leader: string; enemy: string;
  weapon: string; defense: string; source: string; plans: PairedDiscoveryNexusStep[];
};
export const pairedDiscoveryNexusClean = (game: Game): boolean =>
  !game.phaseOpening && !game.response && !game.decision && !game.pendingTreacheryDiscard;
export function pairedDiscoveryNexusPlayer(game: Game, actor: string): Player {
  const p = game.players.find(p => p.id === actor); assert.ok(p); return p;
}

/** Do not automate owned human entry, vote, ride, declarations or battle plans
 * in the returned programmes. These defaults only cross unrelated native windows. */
export function nextPairedDiscoveryNexusStep(game: Game): PairedDiscoveryNexusStep | null {
  if (!game.phaseOpening && !game.response && game.decision) {
    const d = game.decision;
    if (d.kind === 'discoveryEntry' || d.kind === 'greatMakerRide')
      return { actor: d.player, action: { type: 'decision', event: d.event, accept: false } };
    if (d.kind === 'greatMakerVote')
      return { actor: d.player, action: { type: 'decision', event: d.event, yes: false } };
    if (d.kind === 'faceDance') return null;
    if (d.kind === 'discoveryDiscard') {
      const card = pairedDiscoveryNexusPlayer(game, d.player).hand[0]; assert.ok(card);
      return { actor: d.player, action: { type: 'decision', event: d.event, card: card.id } };
    }
  }
  return game.expansions[0] === 'ix' ? nextPairedIxNexusModulesStep(game) : nextPairedChoamStep(game);
}
export function applyPairedDiscoveryNexusStep(game: Game, step: PairedDiscoveryNexusStep,
  actions?: PairedDiscoveryNexusStep[]): Game {
  actions?.push(structuredClone(step));
  return withClassicDiscoveryNexusLottery(() => applyAction(game, step.actor, step.action));
}
export function advancePairedDiscoveryNexus(state: Game, until: (g: Game) => boolean,
  actions?: PairedDiscoveryNexusStep[]): Game {
  let game = structuredClone(state);
  for (let n = 0; n < 2400; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextPairedDiscoveryNexusStep(game);
    assert.ok(step, 'This original paired programme needs its human plan or Face Dance.');
    game = applyPairedDiscoveryNexusStep(game, step, actions);
  }
  throw Error('Paired Discovery/Nexus continuation did not reach the requested original boundary');
}

/** Never restart the supplied setup, clear its original hands, replace its
 * private offers, assign actors, clocks, training, or manufacture a held card. */
export function initializePairedDiscoveryNexusForFixture(options: PairedDiscoveryNexusOptions = {}): Game {
  const family = options.family ?? (options.initial?.expansions[0] === 'choam' ? 'choam' : 'ix');
  const factions = family === 'ix' ? ['ixians', 'tleilaxu', 'guild', 'fremen'] as const
    : ['richese', 'choam', 'guild', 'fremen'] as const;
  const advanced = options.advanced ?? options.initial?.advanced ?? true;
  const tech = options.tech ?? (options.initial ? !!options.initial.techTokens : true);
  const strongholds = options.strongholds ?? (options.initial ? !!options.initial.strongholdCards : advanced);
  let game = options.initial ? structuredClone(options.initial)
    : createGame('PAIREDDISCOVERYNEXUS', newPlayer(factions[0], factions[0], factions[0]), advanced, [family]);
  if (!options.initial) for (const faction of factions.slice(1)) joinGame(game, newPlayer(faction, faction, faction));
  assert.deepEqual(game.players.map(p => p.faction).sort(), [...factions].sort());
  assert.deepEqual(game.expansions, [family]); assert.equal(game.advanced, advanced);
  assert.ok(!game.homeworlds && !game.leaderSkills && !game.ecazTreachery);
  assert.ok(game.status === 'lobby' || game.status === 'setup' && game.turn === 1 && game.phase === 0 &&
    game.players.every(p => !p.traitors.length && p.leaders.every(l => !l.dead && !l.usedAt)),
  'Use the original lobby or unassigned turn-one native setup, including any native starting hand.');
  if (game.status === 'lobby') {
    if (!!game.techTokens !== tech) game = applyAction(game, game.host, { type: 'techTokens', enabled: tech });
    if (!!game.strongholdCards !== strongholds) game = applyAction(game, game.host, { type: 'strongholdCards', enabled: strongholds });
    game.discoveryEnabled = true;
    game.nexusCards ??= { cards: null, phase: null };
    for (const p of game.players) if (!p.ready) game = applyAction(game, p.id, { type: 'ready' });
    game = options.initial ? initializePairedNexusGameForAudit(game)
      : withClassicDiscoveryNexusLottery(() => initializePairedNexusGameForAudit(game));
  }
  assert.equal(game.discoveryEnabled, true); assert.ok(game.discoveries && game.nexusCards?.cards);
  assert.equal(!!game.techTokens, tech); assert.equal(!!game.strongholdCards, strongholds);
  return game;
}
function orderSpice(game: Game): void {
  const take = (matches: (card: Game['spiceDeck'][number]) => boolean) => {
    const at = game.spiceDeck.findIndex(matches); assert.ok(at >= 0);
    return game.spiceDeck.splice(at, 1)[0];
  };
  const cards = [take(c => 'territory' in c && c.discovery === 'discovery-hagga-basin')];
  if (game.advanced) cards.push(take(c => 'territory' in c && !c.discovery && c.territory === 'broken_land'));
  cards.push(take(c => 'worm' in c && !!c.greatMaker));
  cards.push(take(c => 'territory' in c && c.discovery === 'discovery-sihaya-ridge'));
  if (game.advanced) cards.push(take(c => 'territory' in c && !c.discovery && c.territory === 'rock_outcroppings'));
  game.spiceDeck.unshift(...cards);
}
export function reservePairedDiscoveryNexusBoard(game: Game, kept: string[] = []): void {
  for (const p of game.players) for (const [key, count] of Object.entries(p.forces)) {
    if (kept.includes(key)) continue;
    p.reserves += count; delete p.forces[key];
    if (p.elites) { p.elites.reserves += p.elites.forces[key] ?? 0; delete p.elites.forces[key]; }
  }
}
/** Explicitly conserved original subtype groups; elite is a subset of total. */
export function placePairedDiscoveryNexus(game: Game, actor: string, key: string, total: number, elite = 0): void {
  const p = pairedDiscoveryNexusPlayer(game, actor);
  assert.ok(total >= elite && p.reserves - (p.elites?.reserves ?? 0) >= total - elite &&
    (p.elites?.reserves ?? 0) >= elite);
  p.reserves -= total; p.forces[key] = (p.forces[key] ?? 0) + total;
  if (elite) { p.elites!.reserves -= elite; p.elites!.forces[key] = (p.elites!.forces[key] ?? 0) + elite; }
}
export function holdPairedDiscoveryNexusCard(game: Game, actor: string, matches: (c: Card) => boolean,
  staging?: string[]): Card {
  const p = pairedDiscoveryNexusPlayer(game, actor), held = p.hand.find(matches);
  if (held) return held;
  const at = game.deck.findIndex(matches); assert.ok(at >= 0 && p.hand.length < handLimit(p));
  const card = game.deck.splice(at, 1)[0]; p.hand.push(card);
  staging?.push(`Conserved unplayed ${card.id}: original undealt deck → ${actor} hand; retain original starting hands.`);
  return card;
}

/** Original pair, printed blow and physical token lottery, actual paid typed
 * collection, inspection/reveal and END Mentat. Stops BEFORE turn-two Storm
 * at the authenticated collector's real free-entry control. */
export function createPairedDiscoveryNexusFixture(options: PairedDiscoveryNexusOptions = {}): PairedDiscoveryNexusFixture {
  let game = initializePairedDiscoveryNexusForFixture(options);
  const initial = structuredClone(game), setup = structuredClone(game);
  const family = game.expansions[0] as 'ix' | 'choam';
  const actor = (faction: string) => game.players.find(p => p.faction === faction)!.id;
  const owner = actor(family === 'ix' ? 'ixians' : 'richese');
  const native = actor(family === 'ix' ? 'tleilaxu' : 'choam'), guild = actor('guild'), fremen = actor('fremen');
  const collector = family === 'ix' ? owner : guild;
  const actions: PairedDiscoveryNexusStep[] = [], staging = [
    'Conserved original unplayed Spice order: printed Hagga Basin, optional Advanced Broken Land; then Great Maker, Sihaya Ridge and optional Advanced Rock Outcroppings.',
    'Selected actual Shrine supply-token and original scalar Storm/shuffle lotteries only; all UUIDs, actors, setup offers and starting hands remain original.',
  ];
  game = options.initial ? advancePairedDiscoveryNexus(game, g => g.status === 'playing', actions)
    : withClassicDiscoveryNexusLottery(() => advancePairedDiscoveryNexus(game, g => g.status === 'playing', actions));
  const afterSetup = structuredClone(game);
  orderSpice(game);
  game = advancePairedDiscoveryNexus(game, g => g.phase === 1 && pairedDiscoveryNexusClean(g), actions);
  for (let n = 0; !game.discoveries!.tokens.some(t => t.face === 'shrine' && t.status === 'placed') && n < 100; n++) {
    const step = nextPairedDiscoveryNexusStep(game); assert.ok(step); actions.push(structuredClone(step));
    game = withClassicDiscoveryNexusToken(game, 'shrine', () => applyAction(game, step.actor, step.action));
  }
  const token = game.discoveries!.tokens.find(t => t.face === 'shrine')!; assert.equal(token.status, 'placed');
  const printed = DISCOVERY_CARD_PLACEMENTS['discovery-hagga-basin'];
  const source = `${printed.territory}:${printed.sector}`;
  game = advancePairedDiscoveryNexus(game, g => g.phase === 5 && g.active === collector && pairedDiscoveryNexusClean(g), actions);
  game = applyPairedDiscoveryNexusStep(game, { actor: collector, action: { type: 'ship', territory: printed.territory,
    sector: printed.sector, amount: 3, elite: family === 'ix' ? 1 : 0, allyPayment: 0 } }, actions);
  game = advancePairedDiscoveryNexus(game, g => g.phase === 7 && pairedDiscoveryNexusClean(g), actions);
  const collection = structuredClone(game);
  assert.ok(viewGame(game, collector).discoveries!.canInspect.includes(token.id));
  game = applyPairedDiscoveryNexusStep(game, { actor: collector, action: { type: 'discovery', token: token.id, reveal: false } }, actions);
  game = applyPairedDiscoveryNexusStep(game, { actor: collector, action: { type: 'discovery', token: token.id, reveal: true } }, actions);
  game = advancePairedDiscoveryNexus(game, g => g.phase === 8 && pairedDiscoveryNexusClean(g), actions);
  reservePairedDiscoveryNexusBoard(game, [source, MOBILE_LOCATION]);
  const claim = family === 'ix' ? 'arrakeen' : 'carthag';
  placePairedDiscoveryNexus(game, owner, `${claim}:${territory(claim).sectors[0]}`, 1);
  placePairedDiscoveryNexus(game, native, 'hagga_basin:12', 2);
  staging.push(`Before actual END Mentat: conserve original unrelated board groups to reserves, keep paid parent/HMS counters, place one ${owner} ${claim} claim counter and two ${native} Hagga Basin worm-source counters. No custody, clocks, paid history or wallets assigned.`);
  let firstMentat: PairedDiscoveryNexusTransition | undefined;
  for (let n = 0; game.turn === 1 && n < 100; n++) {
    const before = structuredClone(game), step = nextPairedDiscoveryNexusStep(game); assert.ok(step);
    game = applyPairedDiscoveryNexusStep(game, step, actions);
    if (game.turn === 2) firstMentat = { before, step, after: structuredClone(game) };
  }
  assert.ok(firstMentat);
  game = advancePairedDiscoveryNexus(game, g => g.decision?.kind === 'discoveryEntry', actions);
  assert.equal(game.phase, 0); assert.equal(game.turn, 2); assert.equal(game.decision!.player, collector);
  return { initial, setup, afterSetup, collection, firstMentat, game, family, owner, native, collector,
    guild, fremen, token: token.id, source, claim, actions, staging };
}

/** Native human entry, all storm-order votes, exact Fremen typed reserve ride,
 * both Spice piles, reciprocal classic alliance and actual closing singletons. */
export function closePairedDiscoveryNexus(f: PairedDiscoveryNexusFixture): PairedDiscoveryNexusClosing {
  const before = structuredClone(f.game), offer = viewGame(before, f.collector).discoveryEntry!;
  const step: PairedDiscoveryNexusStep = { actor: f.collector, action: { type: 'decision', event: offer.event,
    accept: true, groups: [{ source: f.source, normal: 1, elite: f.family === 'ix' ? 1 : 0 }] } };
  let game = applyPairedDiscoveryNexusStep(before, step, f.actions);
  const entry = { before, step, after: structuredClone(game) };
  game = advancePairedDiscoveryNexus(game, g => g.greatMaker?.stage === 'vote', f.actions);
  const vote = structuredClone(game);
  while (game.decision?.kind === 'greatMakerVote') game = applyPairedDiscoveryNexusStep(game,
    { actor: game.decision.player, action: { type: 'decision', event: game.decision.event, yes: true } }, f.actions);
  assert.equal(game.decision?.kind, 'greatMakerRide'); assert.equal(game.decision!.player, f.fremen);
  const rideBefore = structuredClone(game), action = greatMakerRideAction(viewGame(game, f.fremen), 'polar_sink', 0, 2, game.advanced ? 1 : 0);
  assert.ok(action);
  const rideStep = { actor: f.fremen, action }; game = applyPairedDiscoveryNexusStep(game, rideStep, f.actions);
  const ride = { before: rideBefore, step: rideStep, after: structuredClone(game) };
  game = advancePairedDiscoveryNexus(game, g => !!g.nexus && !g.spiceWindow && !g.spiceResolution && pairedDiscoveryNexusClean(g), f.actions);
  game = applyPairedDiscoveryNexusStep(game, { actor: f.guild, action: { type: 'alliance', target: f.fremen } }, f.actions);
  game = applyPairedDiscoveryNexusStep(game, { actor: f.fremen, action: { type: 'alliance', target: f.guild } }, f.actions);
  const alliance = structuredClone(game);
  game = advancePairedDiscoveryNexus(game, g => g.nexusCards?.phase?.stage === 'drawing', f.actions);
  const cards = game.nexusCards!.cards!;
  const faces = f.family === 'ix' ? ['ixians', 'tleilaxu'] as const : ['richese', 'choam'] as const;
  for (const face of faces) assert.ok(cards.deck.includes(face));
  cards.deck = [...faces, ...cards.deck.filter(c => !faces.some(face => face === c))];
  f.staging.push('Conserve undealt all12 singleton order only; actual unallied closing draw actions deal the two native Cunning cards AFTER both Advanced piles and reciprocal alliance.');
  const drawing = structuredClone(game);
  for (const actor of [f.owner, f.native]) game = applyPairedDiscoveryNexusStep(game,
    { actor, action: { type: 'nexusCardChoice', turn: game.turn, card: null, choice: 'draw', ownRedraws: 0 } }, f.actions);
  game = advancePairedDiscoveryNexus(game, g => g.nexusCards?.phase?.stage !== 'drawing', f.actions);
  return { entry, vote, ride, alliance, drawing, afterDraw: structuredClone(game) };
}
export function pairedDiscoveryRicheseRequest(f: PairedDiscoveryNexusFixture, game: Game): Action {
  assert.equal(f.family, 'choam'); assert.equal(validGameLocation(game, 'shrine', 0), true);
  const p = pairedDiscoveryNexusPlayer(game, f.owner), offer = viewGame(game, f.owner).nexusRicheseCunning!;
  assert.ok(offer && !offer.blocked);
  return { type: 'ship', territory: 'shrine', sector: 0, noField: p.noField!.tokens.find(t => t.value === 3)!.id,
    revealedToken: p.noField!.tokens.find(t => t.value === 5)!.id,
    event: p.noFieldEvent, nexus: offer.event, allyPayment: 0 };
}
export function settlePairedDiscoveryNexusShipment(game: Game): Game {
  return advancePairedDiscoveryNexus(game, g => !g.pendingShipment && pairedDiscoveryNexusClean(g));
}

/** Conserved original private identities only, never revealed-stock/paid history.
 * Select the genuine Face Dancer from its existing stock or exchange with the
 * exact original unplayed Traitor/Face Dancer custody, before the native battle. */
function matchDancer(game: Game, actor: string, leader: string, staging: string[]): void {
  const stock = pairedDiscoveryNexusPlayer(game, actor).faceDancers!;
  if (stock.some(c => c.leader === leader && !c.revealed)) return;
  const dancer = stock.find(c => !c.revealed); assert.ok(dancer);
  const old = dancer.leader, index = game.traitorReserve!.indexOf(leader);
  if (index >= 0) game.traitorReserve![index] = old;
  else {
    const holder = game.players.find(p => p.traitors.includes(leader)); assert.ok(holder);
    holder.traitors[holder.traitors.indexOf(leader)] = old;
  }
  dancer.leader = leader;
  staging.push(`Conserved original unplayed private identities: ${leader} ↔ ${old}; no revealed flag or replacement history assigned.`);
}
/** Native nested battle after actual entry and closing deal. E2 begins only
 * AFTER real paid two-marker materialization/reveal, never mixed marker plans. */
export function preparePairedDiscoveryNexusBattle(f: PairedDiscoveryNexusFixture, state: Game): PairedDiscoveryNexusBattle {
  let game = advancePairedDiscoveryNexus(state, g => g.phase === 5 && pairedDiscoveryNexusClean(g));
  reservePairedDiscoveryNexusBoard(game, f.family === 'ix' ? [MOBILE_LOCATION] : ['shrine:0']);
  const loser = f.family === 'ix' ? f.native : f.guild;
  if (f.family === 'ix') {
    placePairedDiscoveryNexus(game, f.owner, 'shrine:0', 6, 3);
    placePairedDiscoveryNexus(game, f.native, f.source, 3);
  } else {
    assert.equal(pairedDiscoveryNexusPlayer(game, f.owner).forces['shrine:0'], 8);
    assert.equal(pairedDiscoveryNexusPlayer(game, f.owner).noField!.deployed, null);
    // The collector's earned entry counter is conserved back to its own reserve;
    // only Richese's actually paid/materialized eight-counter group stays here.
    const collector = pairedDiscoveryNexusPlayer(game, f.collector);
    collector.reserves += collector.forces['shrine:0'] ?? 0;
    delete collector.forces['shrine:0'];
  }
  placePairedDiscoveryNexus(game, loser, 'shrine:0', 6);
  const other = gameTerritories(game).find(t => t.type === 'sand' && t.id !== 'hagga_basin' && t.id !== 'gara_kulon' &&
    t.sectors.some(s => s >= 9 && s !== game.storm)); assert.ok(other);
  const key = `${other.id}:${other.sectors.find(s => s >= 9 && s !== game.storm)!}`;
  for (const actor of [f.owner, loser]) placePairedDiscoveryNexus(game, actor, key, 1);
  const leader = pairedDiscoveryNexusPlayer(game, f.owner).leaders.filter(l => !l.dead && !isAuditorLeader(l)).sort((a, b) => b.strength - a.strength)[0];
  const enemy = pairedDiscoveryNexusPlayer(game, loser).leaders.filter(l => !l.dead && !isAuditorLeader(l)).sort((a, b) => a.strength - b.strength)[0];
  assert.ok(leader && enemy);
  if (f.family === 'ix') matchDancer(game, f.native, leader.id, f.staging);
  const weapon = holdPairedDiscoveryNexusCard(game, f.owner, c => c.kind === 'projectile', f.staging).id;
  const defense = holdPairedDiscoveryNexusCard(game, f.owner, c => c.kind === 'shield', f.staging).id;
  f.staging.push('Before actual Movement completion: conserve exact original subtype reserve/board groups into the REVEALED Shrine, parent replacement source and second native conflict; retain original hands, earned held cards, wallets and real Nexus deals.');
  game = advancePairedDiscoveryNexus(game, g => g.phase === 6 && pairedDiscoveryNexusClean(g));
  const beforeBattle = structuredClone(game), actor = game.active!; assert.ok(actor === f.owner || actor === loser);
  const battleStep: PairedDiscoveryNexusStep = { actor, action: { type: 'chooseBattle', territory: 'shrine', target: actor === f.owner ? loser : f.owner } };
  game = applyPairedDiscoveryNexusStep(game, battleStep);
  game = advancePairedDiscoveryNexus(game, g => !!g.battle && !g.battle.revealed && !nextPairedDiscoveryNexusStep(g));
  const plans: PairedDiscoveryNexusStep[] = [
    { actor: f.owner, action: { type: 'battlePlan', leader: leader.id, dial: f.family === 'ix' ? 2 : 3,
      support: f.family === 'choam' && game.advanced ? 3 : 0, weapon, defense } },
    { actor: loser, action: { type: 'battlePlan', leader: enemy.id, dial: 0, support: 0, weapon: null, defense: null } },
  ];
  return { game, beforeBattle, battleStep, winner: f.owner, loser, leader: leader.id, enemy: enemy.id, weapon, defense, source: f.source, plans };
}
export function revealPairedDiscoveryNexusBattle(b: PairedDiscoveryNexusBattle, state = b.game): Game {
  let game = structuredClone(state);
  for (const step of b.plans) {
    game = applyPairedDiscoveryNexusStep(game, step);
    game = advancePairedDiscoveryNexus(game, g => !g.response && g.decision?.kind !== 'fullPlanOffer');
  }
  assert.ok(game.battle?.revealed); return game;
}
