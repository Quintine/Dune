import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeLeaderSkillsGameForAudit, initializePairedNexusGameForAudit,
  joinGame, newPlayer, viewGame, type Action, type Game,
} from '../game/engine';
import { territory } from '../game/board';
import { treacheryDeck, type Card } from '../game/cards';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { NEXUS_FACTIONS, validateNexusCards } from '../game/nexus-cards';
import { richeseCards } from '../game/richese-cards';
import { traitorDeck } from '../game/traitors';
import { nativeShipmentSources } from '../game/homeworld-options';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { DISCOVERY_CARD_PLACEMENTS } from '../game/discoveries';
import { discoveryEntryMoveAction } from '../game/discovery-entry-options';
import { greatMakerRideAction } from '../game/great-maker-options';
import {
  nativeHomeworldArmy, nativeHomeworldClean, nativeHomeworldInventory, nativeHomeworldLeader,
  nativeHomeworldPlayer, nextNativeHomeworldModuleStep, frontNativeHomeworldSpice,
} from './fixture-homeworld-native-e1e2-modules';
import { nextDiscoveryPairedNexusE1SkillsStep } from './fixture-discovery-paired-nexus-e1-skills';
import { nextDiscoveryPairedNexusE2SkillsStep } from './fixture-discovery-paired-nexus-e2-skills';
import { nextPairedIxNexusModulesStep } from './fixture-paired-ix-nexus-modules';
import { nextPairedChoamStep } from './fixture-paired-choam-nexus-modules';
import { withClassicDiscoveryNexusLottery, withClassicDiscoveryNexusToken } from './fixture-discovery-classic-nexus';

export type HomeworldPairedNexusStep = { actor: string; action: Action };
export type HomeworldPairedNexusOptions = {
  /** Original fresh lobby or original turn-one, unassigned setup. Saved deals are authoritative. */
  initial?: Game;
  family?: 'ix' | 'choam';
  advanced?: boolean;
  skills?: boolean;
  discovery?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  /** Earn Arrakeen custody through a genuine first-turn three-marker reveal. */
  arrakeenClaim?: boolean;
};
export type HomeworldPairedNexusTransition = { before: Game; step: HomeworldPairedNexusStep; after: Game };
export type HomeworldPairedNexusProgramme = {
  initial: Game; setup: Game; offered: Game | null; afterSetup: Game; game: Game;
  owner: string; native: string; guild: string; fremen: string; trainer: string | null;
  firstMarker: HomeworldPairedNexusTransition | null;
  entry: HomeworldPairedNexusTransition | null; vote: Game | null;
  ride: HomeworldPairedNexusTransition | null; alliance: Game; drawing: Game;
  draws: HomeworldPairedNexusTransition[]; actions: HomeworldPairedNexusStep[];
};
export const homeworldPairedNexusClean = nativeHomeworldClean;
export const homeworldPairedNexusPlayer = nativeHomeworldPlayer;
export const homeworldPairedNexusArmy = nativeHomeworldArmy;

/** Conservation covers the original caches as well as ordinary cards, every
 * Nexus singleton, trained discs and native/visitor physical counters. */
export function homeworldPairedNexusInventory(game: Game): void {
  nativeHomeworldInventory(game);
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.ixSetupCards ?? []), ...(game.auction?.cards.slice(game.auction.index) ?? []),
    ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? [])];
  assert.deepEqual(cards.map(c => c.id).sort(),
    [...treacheryDeck(game.expansions), ...(game.players.some(p => p.faction === 'richese') ? richeseCards() : [])]
      .map(c => c.id).sort());
  validateNexusCards(game.nexusCards!.cards!, game.players);
  const nx = game.nexusCards!.cards!;
  assert.deepEqual([...nx.deck, ...nx.discard, ...Object.values(nx.hands).filter(c => c !== null)].sort(), [...NEXUS_FACTIONS].sort());
}
function shuffleRolls(source: readonly string[], desired: readonly string[]): number[] {
  assert.deepEqual([...source].sort(), [...desired].sort());
  const working = [...source], rolls: number[] = [];
  for (let i = working.length - 1; i > 0; i--) {
    const j = working.indexOf(desired[i]); assert.ok(j >= 0 && j <= i);
    rolls.push(Math.floor((j + 0.5) / (i + 1) * 0x100000000));
    [working[i], working[j]] = [working[j], working[i]];
  }
  return rolls;
}
/** Only word-sized original undealt lotteries are selected. UUID entropy is native. */
function lottery<T>(rolls: readonly number[], operation: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto); let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) array[0] = rolls[cursor++] ?? 0xffffffff;
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return operation(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Original producers retain response priority. Owned Suk, substitution, cards,
 * Tech and Face Dance are explicit endpoints; no default replaces a human plan. */
export function nextHomeworldPairedNexusStep(game: Game): HomeworldPairedNexusStep | null {
  if (homeworldPairedNexusClean(game) && game.nexusCards?.phase?.stage === 'drawing') {
    const phase = game.nexusCards.phase, actor = phase.eligible.find(id => !phase.done.includes(id)); assert.ok(actor);
    return { actor, action: { type: 'nexusCardChoice', turn: game.turn,
      card: game.nexusCards.cards!.hands[actor] ?? null, choice: 'keep', ownRedraws: 0 } };
  }
  if (!game.response && !game.phaseOpening && game.decision) {
    const d = game.decision;
    if (['sukRescue', 'ixSubstitution', 'battleCards', 'faceDance', 'strongholdCopy'].includes(d.kind) ||
      d.kind === 'techToken' && !!game.battle) return null;
    if (d.kind === 'techToken') return { actor: d.player, action: { type: 'decision', token: d.choices[0] } };
    if (d.kind === 'richeseUnbid')
      return { actor: d.player, action: { type: 'decision', event: game.richeseBidding!.event, keep: false } };
    // Both physical and ordinary Guild arrival windows must allow the declared programme.
    if (d.kind === 'guildShipment' || d.kind === 'homeworldShipmentGuild')
      return { actor: d.player, action: { type: 'decision', allow: true,
        ...(d.kind === 'homeworldShipmentGuild' ? { event: d.event } : {}) } };
    if (d.kind === 'battleLosses') {
      const maximum = Math.max(...d.options.map(o => o.elite));
      return { actor: d.player, action: { type: 'decision', choice: d.options.findIndex(o => o.elite === maximum) } };
    }
  }
  if (game.discoveries) return game.expansions[0] === 'ix'
    ? nextDiscoveryPairedNexusE1SkillsStep(game) : nextDiscoveryPairedNexusE2SkillsStep(game);
  if (game.leaderSkills) return nextNativeHomeworldModuleStep(game);
  return game.expansions[0] === 'ix' ? nextPairedIxNexusModulesStep(game) : nextPairedChoamStep(game);
}
export function stepHomeworldPairedNexus(game: Game, step: HomeworldPairedNexusStep,
  actions?: HomeworldPairedNexusStep[]): Game {
  actions?.push(structuredClone(step));
  return withClassicDiscoveryNexusLottery(() => applyAction(game, step.actor, step.action));
}
export function advanceHomeworldPairedNexus(state: Game, until: (game: Game) => boolean,
  actions?: HomeworldPairedNexusStep[]): Game {
  let game = structuredClone(state);
  for (let n = 0; n < 3000; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextHomeworldPairedNexusStep(game);
    assert.ok(step, `Original paired Homeworld programme needs its owned ${game.decision?.kind ?? 'private plan'} at ${game.turn}/${game.phase}`);
    game = stepHomeworldPairedNexus(game, step, actions);
  }
  throw Error('Original paired Homeworld/Nexus programme did not reach its selected boundary.');
}
export function settleHomeworldPairedNexus(game: Game, actions?: HomeworldPairedNexusStep[]): Game {
  return advanceHomeworldPairedNexus(game, g => homeworldPairedNexusClean(g) &&
    !g.pendingShipment && !g.pendingHomeworldShipment && !g.pendingTreacheryDiscard && !g.pendingChoamWorthless, actions);
}
function transition(game: Game, step: HomeworldPairedNexusStep, actions: HomeworldPairedNexusStep[]): HomeworldPairedNexusTransition {
  const before = structuredClone(game), after = stepHomeworldPairedNexus(game, step, actions);
  return { before, step: structuredClone(step), after };
}

/** One initializer path for both human fresh lobbies and conserved original
 * unassigned setup. This is offline original play, not authenticated HTTP proof. */
export function initializeHomeworldPairedNexus(options: HomeworldPairedNexusOptions = {}) {
  const family = options.family ?? (options.initial?.expansions[0] === 'choam' ? 'choam' : 'ix');
  const advanced = options.advanced ?? options.initial?.advanced ?? true;
  const skills = options.skills ?? (options.initial?.status === 'setup' ? !!options.initial.leaderSkills : true);
  const discovery = options.discovery ?? (options.initial ? options.initial.discoveryEnabled === true : false);
  const tech = options.tech ?? (options.initial ? !!options.initial.techTokens : true);
  const strongholds = options.strongholds ?? (options.initial ? !!options.initial.strongholdCards : advanced);
  const roster = family === 'ix' ? ['ixians', 'tleilaxu', 'guild', 'fremen'] as const
    : ['richese', 'choam', 'guild', 'fremen'] as const;
  let game = options.initial ? structuredClone(options.initial)
    : createGame('HOMEWORLDPAIREDNEXUS', newPlayer(roster[0], roster[0], roster[0]), advanced, [family]);
  if (!options.initial) for (const faction of roster.slice(1)) joinGame(game, newPlayer(faction, faction, faction));
  assert.deepEqual(game.expansions, [family]); assert.equal(game.advanced, advanced);
  assert.deepEqual(game.players.map(p => p.faction).sort(), [...roster].sort());
  assert.ok(game.status === 'lobby' || game.status === 'setup' && game.turn === 1 && game.phase === 0 &&
    (!game.leaderSkills || game.leaderSkills.assignments.length === 0) && game.players.every(p =>
      !p.traitors.length && !p.faceDancers?.length && p.leaders.every(l => !l.dead && !l.usedAt)),
  'Continue only an original lobby or its original unassigned first-turn setup.');
  const initial = structuredClone(game), actions: HomeworldPairedNexusStep[] = [];
  const seat = (faction: string) => game.players.find(p => p.faction === faction)!.id;
  const owner = seat(roster[0]), native = seat(roster[1]), guild = seat('guild'), fremen = seat('fremen');
  const selected: LeaderSkillId[] = ['suk-graduate', 'prana-bindu-adept', 'swordmaster-of-ginaz', 'warmaster'];
  if (game.status === 'lobby') {
    for (const [type, enabled, present] of [
      ['homeworlds', true, !!game.homeworlds], ['techTokens', tech, !!game.techTokens],
      ['strongholdCards', strongholds, !!game.strongholdCards],
    ] as const) if (enabled !== present)
      game = stepHomeworldPairedNexus(game, { actor: game.host, action: { type, enabled } }, actions);
    game.discoveryEnabled = discovery; game.nexusCards ??= { cards: null, phase: null };
    for (const p of game.players) if (!p.ready)
      game = stepHomeworldPairedNexus(game, { actor: p.id, action: { type: 'ready' } }, actions);
    const skillsSource = LEADER_SKILL_CARDS.map(c => c.id), rest = skillsSource.filter(c => !selected.includes(c));
    const skillsOrder = selected.flatMap(c => [c, rest.shift()!]).concat(rest);
    const deck = treacheryDeck(game.expansions), remaining = [...deck];
    const kinds: Card['kind'][] = family === 'ix' ? ['worthless', 'worthless', 'worthless', 'worthless']
      : ['worthless', 'special', 'worthless', 'worthless'];
    const prefix = kinds.map(kind => {
      const i = remaining.findIndex(c => c.kind === kind && (kind !== 'special' || c.effect !== 'karama')); assert.ok(i >= 0);
      return remaining.splice(i, 1)[0];
    });
    const rolls = [...(skills ? shuffleRolls(skillsSource, skillsOrder) : []),
      ...(discovery ? Array.from({ length: 7 }, () => 0xffffffff) : []),
      ...Array.from({ length: NEXUS_FACTIONS.length - 1 }, () => 0xffffffff),
      ...shuffleRolls(deck.map(c => c.id), [...prefix, ...remaining].map(c => c.id))];
    game = lottery(rolls, () => skills ? initializeLeaderSkillsGameForAudit(game) : initializePairedNexusGameForAudit(game));
  }
  assert.equal(!!game.leaderSkills, skills); assert.equal(!!game.discoveries, discovery);
  assert.ok(game.homeworlds && game.nexusCards?.cards);
  assert.equal(!!game.techTokens, tech); assert.equal(!!game.strongholdCards, strongholds);
  const setup = structuredClone(game); let offered: Game | null = null, trainer: string | null = null;
  for (let n = 0; game.status === 'setup' && n < 250; n++) {
    let step: HomeworldPairedNexusStep;
    if (game.setupStage === 'leaderSkills') {
      offered ??= structuredClone(game);
      const actor = Object.keys(game.leaderSkills!.offers)[0], view = viewGame(game, actor).leaderSkills!;
      const wanted = selected[game.players.findIndex(p => p.id === actor)];
      const skill = options.initial?.status === 'setup' ? view.offer!.cards.find(c => !view.unavailableSkills?.[c])
        : view.offer!.cards.find(c => c === wanted && !view.unavailableSkills?.[c]);
      const eligible = new Set(view.eligibleLeaders.map(l => l.id));
      const leader = nativeHomeworldPlayer(game, actor).leaders.filter(l => eligible.has(l.id)).sort((a, b) => b.strength - a.strength)[0];
      assert.ok(skill && leader); if (actor === owner) trainer = leader.id;
      step = { actor, action: { type: 'leaderSkill', event: view.offer!.event, skill, leader: leader.id } };
    } else if (game.decision?.kind === 'ixSetup') {
      const actor = game.decision.player, card = viewGame(game, actor).ixTechnology!.setup!.find(c => c.kind === 'worthless'); assert.ok(card);
      step = { actor, action: { type: 'decision', card: card.id } };
    } else {
      const next = nextHomeworldPairedNexusStep(game); assert.ok(next); step = next;
      if (step.action.type === 'traitor' && trainer) {
        const choices = nativeHomeworldPlayer(game, step.actor).traitorChoices;
        step.action.leader = choices.find(id => id !== trainer) ?? choices[0];
      }
    }
    // A legal original Fremen choice avoids an incidental third allied
    // stronghold at END Mentat; it never relocates already placed counters.
    if (step.action.type === 'fremenSetup') step.action.placements = {
      sietch_tabr: 0, false_wall_south: 10, false_wall_west: 0,
    };
    if (family === 'ix' && game.setupStage === 'forces' && trainer) {
      const held = new Set(game.players.flatMap(p => p.traitors));
      const source = traitorDeck(game.players, true).filter(id => !held.has(id)); assert.ok(source.includes(trainer));
      actions.push(structuredClone(step));
      game = lottery(shuffleRolls(source, [trainer, ...source.filter(id => id !== trainer)]), () => applyAction(game, step.actor, step.action));
    } else game = stepHomeworldPairedNexus(game, step, actions);
  }
  assert.equal(game.status, 'playing'); homeworldPairedNexusInventory(game);
  return { initial, setup, offered, afterSetup: structuredClone(game), game, owner, native, guild, fremen, trainer, actions };
}

/** Turn one is played, not repositioned. Turn two's actual worm or Maker opens
 * an alliance, then actual unallied closing draws deal the matching singletons. */
export function createHomeworldPairedNexusProgramme(options: HomeworldPairedNexusOptions = {}): HomeworldPairedNexusProgramme {
  const s = initializeHomeworldPairedNexus(options), actions = s.actions;
  let game = s.game;
  const discovery = !!game.discoveries, family = game.expansions[0];
  frontNativeHomeworldSpice(game, c => 'territory' in c && (discovery ? c.discovery === 'discovery-hagga-basin' : !c.discovery && c.territory === 'hagga_basin'), 0);
  if (game.advanced) frontNativeHomeworldSpice(game, c => 'territory' in c && !c.discovery && c.territory === 'broken_land', 1);
  const second = game.advanced ? 2 : 1;
  frontNativeHomeworldSpice(game, c => 'worm' in c && (discovery ? !!c.greatMaker : !c.greatMaker && !c.suppressed), second);
  frontNativeHomeworldSpice(game, c => 'territory' in c && !c.discovery && c.territory === 'rock_outcroppings', second + 1);
  if (game.advanced) frontNativeHomeworldSpice(game, c => 'territory' in c && !c.discovery && c.territory === 'oh_gap', second + 2);
  game = advanceHomeworldPairedNexus(game, g => g.phase === 1 && homeworldPairedNexusClean(g), actions);
  if (discovery) {
    for (let n = 0; !game.discoveries!.tokens.some(t => t.face === 'shrine' && t.status === 'placed') && n < 100; n++) {
      const step = nextHomeworldPairedNexusStep(game); assert.ok(step); actions.push(structuredClone(step));
      game = withClassicDiscoveryNexusToken(game, 'shrine', () => applyAction(game, step.actor, step.action));
    }
    assert.ok(game.discoveries!.tokens.some(t => t.face === 'shrine' && t.status === 'placed'));
  }
  let firstMarker: HomeworldPairedNexusTransition | null = null;
  const collector = family === 'ix' ? s.owner : s.guild;
  const needed = new Set(discovery ? [collector, ...(family === 'choam' ? [s.owner] : [])] : family === 'choam' ? [s.owner] : []);
  while (needed.size) {
    game = advanceHomeworldPairedNexus(game, g => g.turn === 1 && g.phase === 5 && homeworldPairedNexusClean(g) && needed.has(g.active!), actions);
    const actor = game.active!;
    if (family === 'choam' && actor === s.owner) {
      const site = options.arrakeenClaim ? 'arrakeen' : 'habbanya_ridge_sietch';
      const p = nativeHomeworldPlayer(game, actor), token = p.noField!.tokens.find(t => t.value === (options.arrakeenClaim ? 3 : 0))!;
      firstMarker = transition(game, { actor, action: { type: 'ship', territory: site,
        sector: territory(site).sectors[0], noField: token.id, event: p.noFieldEvent, allyPayment: 0 } }, actions);
      game = settleHomeworldPairedNexus(firstMarker.after, actions); firstMarker.after = structuredClone(game);
      game = stepHomeworldPairedNexus(game, { actor, action: { type: 'revealNoField', token: token.id,
        event: nativeHomeworldPlayer(game, actor).noFieldEvent } }, actions);
    } else {
      const placement = DISCOVERY_CARD_PLACEMENTS['discovery-hagga-basin'], elite = family === 'ix' ? 1 : 0;
      const sources = nativeShipmentSources(viewGame(game, actor), 3, elite); assert.ok(sources);
      game = settleHomeworldPairedNexus(stepHomeworldPairedNexus(game, { actor, action: { type: 'ship', territory: placement.territory,
        sector: placement.sector, amount: 3, elite, allyPayment: 0, homeworldSources: sources } }, actions), actions);
    }
    needed.delete(actor);
    if (needed.size) game = stepHomeworldPairedNexus(game, { actor, action: { type: 'endMovement' } }, actions);
  }
  if (discovery) {
    game = advanceHomeworldPairedNexus(game, g => g.phase === 7 && homeworldPairedNexusClean(g), actions);
    const token = game.discoveries!.tokens.find(t => t.face === 'shrine' && t.status === 'placed')!;
    for (const reveal of [false, true]) game = stepHomeworldPairedNexus(game,
      { actor: collector, action: { type: 'discovery', token: token.id, reveal } }, actions);
  }
  game = advanceHomeworldPairedNexus(game, g => g.turn === 2, actions);
  let entry: HomeworldPairedNexusTransition | null = null, vote: Game | null = null, ride: HomeworldPairedNexusTransition | null = null;
  if (discovery) {
    game = advanceHomeworldPairedNexus(game, g => g.decision?.kind === 'discoveryEntry' && g.decision.player === collector, actions);
    const view = viewGame(game, collector), offered = view.discoveryEntry!.sources;
    const sources = family === 'ix' ? offered.map(source => ({ ...source, normal: Math.min(source.normal, 1), elite: Math.min(source.elite, 1) })) : offered;
    const action = discoveryEntryMoveAction(view, sources); assert.ok(action);
    entry = transition(game, { actor: collector, action }, actions); game = entry.after;
    game = advanceHomeworldPairedNexus(game, g => g.decision?.kind === 'greatMakerVote', actions); vote = structuredClone(game);
    while (game.decision?.kind === 'greatMakerVote') game = stepHomeworldPairedNexus(game,
      { actor: game.decision.player, action: { type: 'decision', event: game.decision.event, yes: true } }, actions);
    assert.ok(game.decision?.kind === 'greatMakerRide' && game.decision.player === s.fremen);
    const actionRide = greatMakerRideAction(viewGame(game, s.fremen), 'polar_sink', 0, 2, game.advanced ? 1 : 0); assert.ok(actionRide);
    ride = transition(game, { actor: s.fremen, action: actionRide }, actions); game = ride.after;
  }
  game = advanceHomeworldPairedNexus(game, g => !!g.nexus && !g.spiceWindow && !g.spiceResolution && homeworldPairedNexusClean(g), actions);
  for (const [actor, target] of [[s.guild, s.fremen], [s.fremen, s.guild]])
    game = stepHomeworldPairedNexus(game, { actor, action: { type: 'alliance', target } }, actions);
  const alliance = structuredClone(game);
  game = advanceHomeworldPairedNexus(game, g => g.nexusCards?.phase?.stage === 'drawing' && homeworldPairedNexusClean(g), actions);
  const drawing = structuredClone(game), draws: HomeworldPairedNexusTransition[] = [];
  for (const actor of [s.owner, s.native]) {
    const cards = game.nexusCards!.cards!, face = nativeHomeworldPlayer(game, actor).faction;
    const at = cards.deck.indexOf(face); assert.ok(at >= 0); cards.deck.unshift(cards.deck.splice(at, 1)[0]);
    const draw = transition(game, { actor, action: { type: 'nexusCardChoice', turn: game.turn,
      card: cards.hands[actor] ?? null, choice: 'draw', ownRedraws: 0 } }, actions);
    draws.push(draw); game = draw.after;
  }
  game = advanceHomeworldPairedNexus(game, g => g.phase === 5 && homeworldPairedNexusClean(g), actions);
  homeworldPairedNexusInventory(game);
  return { ...s, game, firstMarker, entry, vote, ride, alliance, drawing, draws, actions };
}

/** Legal native sources, actual Guild allowances and custody settlement. */
export function shipHomeworldPairedNexus(game: Game, actor: string, destination: string, amount: number, elite = 0,
  actions?: HomeworldPairedNexusStep[]): Game {
  const sources = nativeShipmentSources(viewGame(game, actor), amount, elite); assert.ok(sources);
  let action: Action;
  if (destination.startsWith('homeworld:')) {
    const choice = homeworldShipmentChoice(viewGame(game, actor), destination,
      Object.fromEntries(Object.entries(sources).filter(([, g]) => g.normal + g.elite > 0)));
    assert.ok(choice.action, choice.blocked ?? undefined); action = choice.action;
  } else action = { type: 'ship', territory: destination, sector: destination === 'shrine' ? 0 : territory(destination).sectors[0],
    amount, elite, allyPayment: 0, homeworldSources: sources };
  return settleHomeworldPairedNexus(stepHomeworldPairedNexus(game, { actor, action }, actions), actions);
}
export function openHomeworldPairedNexusBattle(game: Game, owner: string, opponent: string, location: string,
  hidden = true, actions?: HomeworldPairedNexusStep[]): Game {
  game = advanceHomeworldPairedNexus(game, g => g.phase === 6 && homeworldPairedNexusClean(g) && !!g.active, actions);
  assert.ok(game.active === owner || game.active === opponent);
  game = stepHomeworldPairedNexus(game, { actor: game.active!, action: { type: 'chooseBattle', territory: location,
    target: game.active === owner ? opponent : owner } }, actions);
  for (let n = 0; n < 200; n++) {
    if (homeworldPairedNexusClean(game) && game.battle && !game.battle.preparation && game.battle.preLeader?.closed !== false) return game;
    const next = nextHomeworldPairedNexusStep(game); assert.ok(next);
    if (next.action.type === 'leaderSkillVisibility') next.action.hide = next.actor === owner && hidden;
    game = stepHomeworldPairedNexus(game, next, actions);
  }
  throw Error('Original Homeworld battle did not reach its sealed-plan boundary.');
}
export function revealHomeworldPairedNexusPlans(game: Game, plans: readonly HomeworldPairedNexusStep[],
  actions?: HomeworldPairedNexusStep[]): Game {
  for (const plan of plans) {
    game = stepHomeworldPairedNexus(game, plan, actions);
    while (game.response || game.phaseOpening || game.decision?.kind === 'fullPlanOffer') {
      const next = nextHomeworldPairedNexusStep(game); assert.ok(next); game = stepHomeworldPairedNexus(game, next, actions);
    }
  }
  assert.ok(game.battle?.revealed); return game;
}
/** Owned cleanup is explicit, and reward/Face Dance order remains engine-owned. */
export function finishHomeworldPairedNexusBattle(game: Game, actions?: HomeworldPairedNexusStep[]): Game {
  for (let n = 0; n < 600; n++) {
    if (!game.battle && homeworldPairedNexusClean(game) && !game.pendingTreacheryDiscard) return game;
    let next = nextHomeworldPairedNexusStep(game);
    if (!next && !game.response && !game.phaseOpening) {
      const d = game.decision; assert.ok(d);
      if (d.kind === 'battleCards') next = { actor: d.player, action: { type: 'decision', discard: [] } };
      else if (d.kind === 'techToken') next = { actor: d.player, action: { type: 'decision', token: d.choices[0] } };
      else if (d.kind === 'faceDance') next = { actor: d.player, action: { type: 'decision', reveal: false } };
      else throw Error(`Choose the physical ${d.kind} before continuing cleanup.`);
    }
    assert.ok(next); game = stepHomeworldPairedNexus(game, next, actions);
  }
  throw Error('Original paired Homeworld aftermath did not finish.');
}
export const homeworldPairedNexusLeader = nativeHomeworldLeader;
