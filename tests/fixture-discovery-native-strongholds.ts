import assert from 'node:assert/strict';
import {
  applyAction, createGame, handLimit, initializeDiscoveryGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game, type Player,
} from '../game/engine';
import { MOBILE_LOCATION, MOBILE_STRONGHOLD, gameTerritories, territory } from '../game/board';
import { isAuditorLeader, treacheryDeck, type Card } from '../game/cards';
import { DISCOVERY_CARD_PLACEMENTS, validateDiscoveryState } from '../game/discoveries';
import { richeseCards } from '../game/richese-cards';
import { validateRicheseNoField } from '../game/richese-no-field';
import { createStrongholdCards, strongholdControllers } from '../game/stronghold-cards';
import { traitorDeck } from '../game/traitors';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';
import { nextDiscoveryNativeMarkerStep } from './fixture-discovery-native-marker';

export type DiscoveryNativeStrongholdStep = { actor: string; action: Action };
export type DiscoveryNativeStrongholdKind = 'ix-hms-invoice' | 'richese-nested-defense';
export type DiscoveryNativeStrongholdOptions = {
  /** Authenticated fresh lobby or original undealt Discovery/Stronghold audit setup. */
  initial?: Game;
  kind?: DiscoveryNativeStrongholdKind;
  tech?: boolean;
};
export type DiscoveryNativeStrongholdFixture = {
  initial: Game;
  setup: Game;
  afterSetup: Game;
  beforeBlow: Game;
  afterBlow: Game;
  beforeReveal: Game;
  afterReveal: Game;
  beforeFirstMentat: Game;
  firstMentatStep: DiscoveryNativeStrongholdStep;
  afterFirstMentat: Game;
  entry: { before: Game; step: DiscoveryNativeStrongholdStep; after: Game };
  shipment: { before: Game; step: DiscoveryNativeStrongholdStep; after: Game };
  markerReveal: { before: Game; step: DiscoveryNativeStrongholdStep; after: Game } | null;
  beforeBattle: Game;
  battleStep: DiscoveryNativeStrongholdStep;
  copyStep: DiscoveryNativeStrongholdStep | null;
  game: Game;
  kind: DiscoveryNativeStrongholdKind;
  owner: string;
  collector: string;
  opponent: string;
  choam: string;
  token: string;
  parent: string;
  source: string;
  location: string;
  leader: string;
  opponentLeader: string;
  defense: string | null;
  weapon: string | null;
  plans: DiscoveryNativeStrongholdStep[];
  actions: DiscoveryNativeStrongholdStep[];
  staging: string[];
};
export const discoveryNativeStrongholdReload = (game: Game): Game => JSON.parse(JSON.stringify(game));
export function discoveryNativeStrongholdPlayer(game: Game, actor: string): Player {
  const p = game.players.find(player => player.id === actor); assert.ok(p); return p;
}
export function assertDiscoveryNativeStrongholdCustody(game: Game): void {
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.ixSetupCards ?? []), ...(game.ixAuction?.cards ?? []),
    ...(game.auction?.cards.slice(game.auction.index) ?? []),
    ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? [])];
  assert.deepEqual(cards.map(c => c.id).sort(), [...treacheryDeck(game.expansions),
    ...(game.players.some(p => p.faction === 'richese') ? richeseCards() : [])].map(c => c.id).sort());
  assert.equal(new Set(cards.map(c => c.id)).size, cards.length);
  assert.deepEqual([...(game.traitorReserve ?? []), ...game.players.flatMap(p => [
    ...p.traitors, ...p.traitorChoices, ...(p.faceDancers ?? []).map(c => c.leader),
  ])].sort(), traitorDeck(game.players, game.expansions.includes('ix')).sort());
  for (const p of game.players) {
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0), 20, p.faction);
    if (p.elites) {
      assert.equal(p.elites.reserves + p.elites.tanks + Object.values(p.elites.forces).reduce((a, b) => a + b, 0),
        p.faction === 'ixians' ? 7 : p.faction === 'fremen' ? 3 : 5);
      assert.ok(p.elites.reserves <= p.reserves && p.elites.tanks <= p.tanks);
      for (const [key, count] of Object.entries(p.elites.forces)) assert.ok(count >= 0 && count <= (p.forces[key] ?? 0));
    }
    if (p.noField) validateRicheseNoField(p.noField);
  }
  validateDiscoveryState(game.discoveries!);
}
export const discoveryNativeStrongholdClean = (game: Game) => !game.phaseOpening && !game.response && !game.decision;
/** Existing native policies; leave declarations and unsealed plans to the caller. */
export function nextDiscoveryNativeStrongholdStep(game: Game): DiscoveryNativeStrongholdStep | null {
  if (game.decision?.kind === 'discoveryEntry') return { actor: game.decision.player,
    action: { type: 'decision', event: game.decision.event, accept: false } };
  if (game.decision?.kind === 'techToken') return { actor: game.decision.player,
    action: { type: 'decision', token: game.decision.choices[0] } };
  if (game.decision?.kind === 'strongholdCopy' || game.decision?.kind === 'faceDance') return null;
  if (game.battle) return nextStrongholdFactionsNativeStep(game);
  return game.players.some(p => p.faction === 'richese')
    ? nextDiscoveryNativeMarkerStep(game) : nextStrongholdFactionsNativeStep(game);
}
function entropy<T>(operation: () => T, scalar?: number): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array) array.fill(scalar ?? 0xffffffff);
    else Reflect.apply(original, crypto, [array]);
    return array;
  };
  try { return operation(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
function act(game: Game, step: DiscoveryNativeStrongholdStep, actions?: DiscoveryNativeStrongholdStep[], scalar?: number): Game {
  actions?.push(structuredClone(step));
  return entropy(() => applyAction(game, step.actor, step.action), scalar);
}
export function advanceDiscoveryNativeStronghold(state: Game, until: (g: Game) => boolean,
  actions?: DiscoveryNativeStrongholdStep[], scalar?: number): Game {
  let game = state;
  for (let n = 0; n < 1800; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextDiscoveryNativeStrongholdStep(game); assert.ok(step, 'A real human declaration or plan is required');
    game = act(game, step, actions, scalar);
  }
  throw Error('Native Discovery/Stronghold policy did not reach its requested original window');
}
function place(game: Game, actor: string, location: string, amount: number, elite = 0): void {
  const p = discoveryNativeStrongholdPlayer(game, actor);
  assert.ok(p.reserves - (p.elites?.reserves ?? 0) >= amount - elite && amount >= elite);
  assert.ok((p.elites?.reserves ?? 0) >= elite);
  p.reserves -= amount; p.forces[location] = (p.forces[location] ?? 0) + amount;
  if (elite) { p.elites!.reserves -= elite; p.elites!.forces[location] = (p.elites!.forces[location] ?? 0) + elite; }
}
function reserveOtherLocations(game: Game, kept: string[]): void {
  for (const p of game.players) for (const [key, amount] of Object.entries(p.forces)) {
    if (kept.includes(key)) continue;
    p.reserves += amount; delete p.forces[key];
    if (p.elites) { p.elites.reserves += p.elites.forces[key] ?? 0; delete p.elites.forces[key]; }
  }
}
function held(game: Game, actor: string, kind: Card['kind'], staging: string[]): string {
  const p = discoveryNativeStrongholdPlayer(game, actor), owned = p.hand.find(c => c.kind === kind);
  if (owned) return owned.id;
  const index = game.deck.findIndex(c => c.kind === kind);
  assert.ok(index >= 0 && p.hand.length < handLimit(p));
  const card = game.deck.splice(index, 1)[0]; p.hand.push(card);
  staging.push(`Conserved ${card.id}: original undealt native deck → ${actor}'s hand.`);
  return card.id;
}
/** Original Advanced E1+E2 or E2 setup, printed Hagga Basin blow, actual
 * inspection/reveal, first END Mentat claim, original free entry and paid shipment.
 * Entropy controls only original deals/remainder shuffles and the physical token
 * lottery. No held-card owner, paid continuation, phase or timestamp is forged. */
export function createDiscoveryNativeStrongholdFixture(options: DiscoveryNativeStrongholdOptions = {}): DiscoveryNativeStrongholdFixture {
  const kind = options.kind ?? 'ix-hms-invoice', ix = kind === 'ix-hms-invoice';
  const factions = ix ? ['ixians', 'choam', 'guild'] as const : ['richese', 'choam', 'guild'] as const;
  const expansions = ix ? ['ix', 'choam'] : ['choam'];
  let game = options.initial ? structuredClone(options.initial)
    : createGame('DISCOVERYNATIVEHELD', newPlayer(factions[0], factions[0], factions[0]), true, expansions);
  if (!options.initial) for (const faction of factions.slice(1)) joinGame(game, newPlayer(faction, faction, faction));
  assert.ok(game.status === 'lobby' || game.status === 'setup' && game.turn === 1 && game.phase === 0 && game.players.every(p => p.hand.length === 0));
  assert.equal(game.advanced, true); assert.deepEqual([...game.expansions].sort(), [...expansions].sort());
  assert.deepEqual(game.players.map(p => p.faction).sort(), [...factions].sort());
  assert.ok(!game.leaderSkills && !game.nexusCards && !game.homeworlds);
  if (game.status === 'lobby') {
    if (options.tech && !game.techTokens) game = applyAction(game, game.host, { type: 'techTokens', enabled: true });
    game.discoveryEnabled = true;
    if (!game.strongholdCards) game.strongholdCards = createStrongholdCards();
    for (const p of game.players) if (!p.ready) game = applyAction(game, p.id, { type: 'ready' });
  }
  const initial = structuredClone(game);
  if (game.status === 'lobby') game = entropy(() => initializeDiscoveryGameForAudit(game));
  const setup = structuredClone(game);
  assert.equal(game.strongholdCards!.claimedTurn, 0);
  assert.ok(Object.values(game.strongholdCards!.owners).every(owner => owner === null));
  const actions: DiscoveryNativeStrongholdStep[] = [], staging = [
    'Controlled only original native deal/remainder entropy; selected the actual Shrine token placement lottery.',
    'Reordered four original unplayed Spice Cards: printed Hagga Basin Discovery, then three ordinary blows.',
  ];
  game = advanceDiscoveryNativeStronghold(game, g => g.status === 'playing', actions);
  const afterSetup = structuredClone(game);
  const owner = game.players.find(p => p.faction === factions[0])!.id;
  const opponent = game.players.find(p => p.faction === 'guild')!.id;
  const choam = game.players.find(p => p.faction === 'choam')!.id, collector = ix ? owner : opponent;
  const printed = 'discovery-hagga-basin', placement = DISCOVERY_CARD_PLACEMENTS[printed];
  const source = `${placement.territory}:${placement.sector}`;
  const cardIndex = game.spiceDeck.findIndex(c => 'territory' in c && c.discovery === printed); assert.ok(cardIndex >= 0);
  game.spiceDeck.unshift(game.spiceDeck.splice(cardIndex, 1)[0]);
  for (let position = 1; position < 4; position++) {
    const index = game.spiceDeck.findIndex((c, i) => i >= position && 'territory' in c && !c.discovery);
    assert.ok(index >= position); game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
  }
  game = advanceDiscoveryNativeStronghold(game, g => g.phase === 1 && discoveryNativeStrongholdClean(g), actions);
  // Actual blow destroys conserved typed counters in its PRINTED territory;
  // placement is the separate printed Gara Kulon destination, not the blow site.
  const blowLocation = 'hagga_basin:12';
  place(game, owner, blowLocation, 2, ix ? 1 : 0);
  staging.push(`Conserved original reserves → ${blowLocation}: two ${factions[0]} counters${ix ? ', including one Cyborg' : ''} before the actual blow.`);
  const beforeBlow = structuredClone(game);
  const eligible = game.discoveries!.tokens.filter(t => t.status === 'supply' && t.type === 'hiereg');
  const selected = eligible.findIndex(t => t.face === 'shrine'); assert.ok(selected >= 0);
  game = advanceDiscoveryNativeStronghold(game,
    g => g.discoveries!.tokens.some(t => t.face === 'shrine' && t.status === 'placed'), actions,
    Math.floor((selected + 0.5) / eligible.length * 0x100000000));
  const afterBlow = structuredClone(game), token = game.discoveries!.tokens.find(t => t.face === 'shrine')!;
  game = advanceDiscoveryNativeStronghold(game, g => g.phase === 5 && g.active === collector && discoveryNativeStrongholdClean(g), actions);
  game = act(game, { actor: collector, action: { type: 'ship', territory: placement.territory,
    sector: placement.sector, amount: ix ? 3 : 1, elite: ix ? 1 : 0, allyPayment: 0 } }, actions);
  game = advanceDiscoveryNativeStronghold(game, g => g.phase === 7 && discoveryNativeStrongholdClean(g), actions);
  const beforeReveal = structuredClone(game);
  assert.ok(viewGame(game, collector).discoveries!.canInspect.includes(token.id));
  game = act(game, { actor: collector, action: { type: 'discovery', token: token.id, reveal: false } }, actions);
  game = act(game, { actor: collector, action: { type: 'discovery', token: token.id, reveal: true } }, actions);
  const afterReveal = structuredClone(game);
  game = advanceDiscoveryNativeStronghold(game, g => g.phase === 8 && discoveryNativeStrongholdClean(g), actions);
  reserveOtherLocations(game, [source, ...(ix ? [MOBILE_LOCATION] : [])]);
  const claim = ix ? 'arrakeen' : 'carthag';
  place(game, owner, `${claim}:${territory(claim).sectors[0]}`, 1);
  staging.push('Before actual first END Mentat: return unrelated original board counters to their own reserves, preserve native HMS/Discovery garrisons, and place one conserved claim counter.');
  let beforeFirstMentat: Game | undefined, firstMentatStep: DiscoveryNativeStrongholdStep | undefined;
  for (let n = 0; game.turn === 1 && n < 100; n++) {
    const step = nextDiscoveryNativeStrongholdStep(game); assert.ok(step);
    const before = structuredClone(game); game = act(game, step, actions);
    if (game.turn === 2) { beforeFirstMentat = before; firstMentatStep = step; }
  }
  assert.ok(beforeFirstMentat && firstMentatStep);
  const afterFirstMentat = structuredClone(game);
  assert.equal(game.strongholdCards!.owners[claim], owner);
  assert.deepEqual(game.strongholdCards!.owners, strongholdControllers(beforeFirstMentat.players, ix));
  game = advanceDiscoveryNativeStronghold(game, g => g.decision?.kind === 'discoveryEntry', actions);
  assert.equal(game.decision!.player, collector);
  const entryBefore = structuredClone(game), offer = viewGame(game, collector).discoveryEntry!;
  const entryStep: DiscoveryNativeStrongholdStep = { actor: collector, action: ix
    ? { type: 'decision', event: offer.event, accept: true, groups: [{ source, normal: 1, elite: 1 }] }
    : { type: 'decision', event: offer.event, accept: false } };
  game = act(game, entryStep, actions);
  game = advanceDiscoveryNativeStronghold(game, g => !g.discoveryEntry && !g.decision && !g.response, actions);
  const entry = { before: entryBefore, step: entryStep, after: structuredClone(game) };
  game = advanceDiscoveryNativeStronghold(game, g => g.phase === 5 && g.active === owner && discoveryNativeStrongholdClean(g), actions);
  const shipmentBefore = structuredClone(game), player = discoveryNativeStrongholdPlayer(game, owner);
  const noField = player.noField?.tokens.find(t => t.value === 5);
  const shipmentStep: DiscoveryNativeStrongholdStep = { actor: owner, action: ix
    ? { type: 'ship', territory: 'shrine', sector: 0, amount: 2, elite: 1, allyPayment: 0 }
    : { type: 'ship', territory: 'shrine', sector: 0, noField: noField!.id, event: player.noFieldEvent, allyPayment: 0 } };
  game = act(game, shipmentStep, actions);
  game = advanceDiscoveryNativeStronghold(game, g => !g.pendingShipment && discoveryNativeStrongholdClean(g), actions);
  const shipment = { before: shipmentBefore, step: shipmentStep, after: structuredClone(game) };
  let markerReveal: DiscoveryNativeStrongholdFixture['markerReveal'] = null;
  if (!ix) {
    const before = structuredClone(game);
    const step: DiscoveryNativeStrongholdStep = { actor: owner, action: { type: 'revealNoField',
      token: noField!.id, event: discoveryNativeStrongholdPlayer(game, owner).noFieldEvent } };
    game = act(game, step, actions); markerReveal = { before, step, after: structuredClone(game) };
  }
  if (ix) {
    place(game, owner, `sietch_tabr:${territory('sietch_tabr').sectors[0]}`, 1);
    staging.push('After earned first-Mentat custody: one conserved Ixian reserve counter → Sietch Tabr, giving a second CURRENT copy choice without claiming its unheld card.');
  }
  const location = ix ? MOBILE_LOCATION : 'shrine:0', battleTerritory = ix ? MOBILE_STRONGHOLD : 'shrine';
  place(game, opponent, location, 6);
  // A second actual conflict keeps Battle open so bank/Tech custody can be
  // inspected before unrelated Collection or the next Mentat checkpoint.
  const other = gameTerritories(game).find(t => t.type === 'sand' && t.id !== placement.territory && t.sectors.some(s => s >= 9));
  assert.ok(other); const otherLocation = `${other.id}:${other.sectors.find(s => s >= 9)!}`;
  place(game, owner, otherLocation, 1); place(game, opponent, otherLocation, 1);
  staging.push(`Conserved opponent reserve counters → ${location} (six); one counter per combatant → ${otherLocation} for a second original conflict. Retain earned first-Mentat cards and all paid/free arrivals.`);
  const defense = !ix ? held(game, owner, 'shield', staging) : null;
  const weapon = !ix ? held(game, opponent, 'poison', staging) : null;
  const leader = discoveryNativeStrongholdPlayer(game, owner).leaders.filter(l => !l.dead && !isAuditorLeader(l)).sort((a, b) => b.strength - a.strength)[0];
  const opponentLeader = discoveryNativeStrongholdPlayer(game, opponent).leaders.filter(l => !l.dead && !isAuditorLeader(l)).sort((a, b) => a.strength - b.strength)[0];
  assert.ok(leader && opponentLeader);
  game = advanceDiscoveryNativeStronghold(game, g => g.phase === 6 && discoveryNativeStrongholdClean(g), actions);
  const beforeBattle = structuredClone(game), actor = game.active!;
  assert.ok(actor === owner || actor === opponent);
  const battleStep: DiscoveryNativeStrongholdStep = { actor, action: { type: 'chooseBattle', territory: battleTerritory, target: actor === owner ? opponent : owner } };
  game = act(game, battleStep, actions);
  for (let n = 0; n < 120; n++) {
    if (game.decision?.kind === 'strongholdCopy') break;
    const step = nextDiscoveryNativeStrongholdStep(game); if (!step) break;
    game = act(game, step, actions);
  }
  const copyStep: DiscoveryNativeStrongholdStep | null = game.decision?.kind === 'strongholdCopy'
    ? { actor: owner, action: { type: 'decision', event: game.decision.event, stronghold: 'arrakeen' } } : null;
  assert.equal(Boolean(copyStep), ix);
  const plans: DiscoveryNativeStrongholdStep[] = [
    { actor: owner, action: { type: 'battlePlan', leader: leader.id, dial: ix ? 6 : 0, support: ix ? 3 : 0, weapon: null, defense } },
    { actor: opponent, action: { type: 'battlePlan', leader: opponentLeader.id, dial: 0, support: 0, weapon, defense: null } },
  ];
  assertDiscoveryNativeStrongholdCustody(game);
  return { initial, setup, afterSetup, beforeBlow, afterBlow, beforeReveal, afterReveal,
    beforeFirstMentat, firstMentatStep, afterFirstMentat, entry, shipment, markerReveal,
    beforeBattle, battleStep, copyStep, game, kind, owner, collector, opponent, choam,
    token: token.id, parent: placement.territory, source, location, leader: leader.id,
    opponentLeader: opponentLeader.id, defense, weapon, plans, actions, staging };
}
export function prepareDiscoveryNativeStrongholdBattle(fixture: DiscoveryNativeStrongholdFixture): Game {
  let game = discoveryNativeStrongholdReload(fixture.game);
  if (fixture.copyStep) game = act(game, fixture.copyStep);
  for (let n = 0; n < 120; n++) {
    const step = nextDiscoveryNativeStrongholdStep(game);
    if (!step) { assert.ok(game.battle && !game.battle.revealed); return game; }
    game = act(game, step);
  }
  throw Error('Original native pre-plan window did not close');
}
export function revealDiscoveryNativeStrongholdBattle(fixture: DiscoveryNativeStrongholdFixture): Game {
  let game = prepareDiscoveryNativeStrongholdBattle(fixture);
  for (const plan of fixture.plans) {
    game = act(game, plan);
    while (game.response || game.decision?.kind === 'fullPlanOffer') {
      const next = nextDiscoveryNativeStrongholdStep(game); assert.ok(next); game = act(game, next);
    }
  }
  assert.ok(game.battle?.revealed); return game;
}
export function finishDiscoveryNativeStrongholdBattle(state: Game): Game {
  return advanceDiscoveryNativeStronghold(state, g => !g.battle && !g.decision && !g.response && !g.pendingTreacheryDiscard);
}
