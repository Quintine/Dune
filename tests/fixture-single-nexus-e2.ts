import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeLeaderSkillsGameForAudit, initializeNexusGameForAudit,
  joinGame, newPlayer, viewGame,
} from '../game/engine';
import type { Action, Game, Player } from '../game/engine';
import type { FactionId } from '../game/catalog';
import type { Difficulty } from '../game/bot-profiles';
import type { Card } from '../game/cards';
import type { LeaderSkillId } from '../game/leader-skill-cards';
import { botActions } from '../game/bots';
import { territory } from '../game/board';
import { treacheryDeck } from '../game/cards';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { NEXUS_FACTIONS, validateNexusCards } from '../game/nexus-cards';
import { richeseCards } from '../game/richese-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { nativeShipmentSources } from '../game/homeworld-options';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { DISCOVERY_CARD_PLACEMENTS, validateDiscoveryState } from '../game/discoveries';
import { discoveryEntryMoveAction } from '../game/discovery-entry-options';
import { greatMakerRideAction } from '../game/great-maker-options';
import { choamPowerAction, choamPowerPlays } from '../game/choam-power-options';
import { nativeHomeworldInventory, nativeHomeworldPlayer, nativeHomeworldLeader, frontNativeHomeworldSpice } from './fixture-homeworld-native-e1e2-modules';
import { nextHomeworldPairedNexusStep } from './fixture-homeworld-paired-nexus';
import { withClassicDiscoveryNexusLottery, withClassicDiscoveryNexusToken } from './fixture-discovery-classic-nexus';

export type SingleNexusE2Native = 'choam' | 'richese';
export type SingleNexusE2Step = { actor: string; action: Action };
export type SingleNexusE2Transition = { before: Game; step: SingleNexusE2Step; after: Game };
export type SingleNexusE2Options = {
  /** Only an original undealt lobby or its original, unassigned turn-one setup. */
  initial?: Game;
  native?: SingleNexusE2Native;
  roster?: readonly FactionId[];
  advanced?: boolean;
  skills?: boolean;
  homeworlds?: boolean;
  discovery?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  skill?: LeaderSkillId;
  /** Original first deal selection only; never replaces a supplied deal. */
  fuelKind?: 'special' | 'shield';
};
export type SingleNexusE2Setup = {
  initial: Game; setup: Game; offered: Game | null; afterSetup: Game; game: Game;
  owner: string; others: string[]; trainer: string | null; actions: SingleNexusE2Step[];
};
export type SingleNexusE2Programme = SingleNexusE2Setup & {
  firstMarker: SingleNexusE2Transition | null;
  entry: SingleNexusE2Transition | null;
  ride: SingleNexusE2Transition | null;
  vote: Game | null;
  alliance: Game; draw: SingleNexusE2Transition;
};
export const singleE2Reload = (game: Game): Game => JSON.parse(JSON.stringify(game)) as Game;
export const singleE2Player = nativeHomeworldPlayer;
export const singleE2Leader = nativeHomeworldLeader;
export const singleE2Clean = (game: Game): boolean =>
  !game.response && !game.phaseOpening && !game.decision && !game.pendingTreacheryDiscard && !game.truthtrance;

/** Persist minimal profiles on the real owning seat before projecting its window. */
export function singleE2Policy(game: Game, actor: string, difficulty: Difficulty): Action[] {
  const saved = singleE2Reload(game); singleE2Player(saved, actor).bot = difficulty;
  return botActions(viewGame(singleE2Reload(saved), actor));
}
export function singleE2Inventory(game: Game): void {
  if (game.homeworlds) nativeHomeworldInventory(game);
  else for (const p of game.players) {
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((a, n) => a + n, 0), 20, p.faction);
    if (p.elites) assert.equal(p.elites.reserves + p.elites.tanks + Object.values(p.elites.forces).reduce((a, n) => a + n, 0), p.faction === 'emperor' ? 5 : 3);
  }
  if (game.leaderSkills) validateLeaderSkills(game.leaderSkills, game.players);
  if (game.discoveries) validateDiscoveryState(game.discoveries);
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...(game.auction?.cards.slice(game.auction.index + (game.currentAuctionSale ? 1 : 0)) ?? [])];
  assert.deepEqual(cards.map(c => c.id).sort(), [...treacheryDeck(['choam']),
    ...(game.players.some(p => p.faction === 'richese') ? richeseCards() : [])].map(c => c.id).sort());
  validateNexusCards(game.nexusCards!.cards!, game.players);
  const nx = game.nexusCards!.cards!;
  assert.deepEqual([...nx.deck, ...nx.discard, ...Object.values(nx.hands).filter((c): c is FactionId => c !== null)].sort(), [...NEXUS_FACTIONS].sort());
}
export function singleE2Step(game: Game, step: SingleNexusE2Step, actions?: SingleNexusE2Step[]): Game {
  actions?.push(structuredClone(step));
  return withClassicDiscoveryNexusLottery(() => applyAction(singleE2Reload(game), step.actor, step.action));
}
export function nextSingleE2Step(game: Game): SingleNexusE2Step | null {
  if (!game.response && !game.phaseOpening && game.decision) {
    const d = game.decision;
    if (['sukRescue', 'battleCards', 'techToken'].includes(d.kind)) return null;
    if (d.kind === 'guildShipment' || d.kind === 'homeworldShipmentGuild')
      return { actor: d.player, action: { type: 'decision', allow: true,
        ...(d.kind === 'homeworldShipmentGuild' ? { event: d.event } : {}) } };
    if (d.kind === 'richeseUnbid') return { actor: d.player,
      action: { type: 'decision', event: game.richeseBidding!.event, keep: false } };
  }
  const step = nextHomeworldPairedNexusStep(game);
  if (step?.action.type === 'stormDial') step.action.amount = game.turn === 1 ? 0 : 1;
  return step;
}
export function advanceSingleE2(game: Game, until: (g: Game) => boolean, actions?: SingleNexusE2Step[]): Game {
  for (let n = 0; n < 3000; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextSingleE2Step(game);
    assert.ok(step, `Choose the actual single E2 ${game.decision?.kind ?? 'sealed plan'} at ${game.turn}/${game.phase}.`);
    game = singleE2Step(game, step, actions);
  }
  throw Error('Original single E2 chronology did not reach its owned boundary.');
}
export function settleSingleE2(game: Game, actions?: SingleNexusE2Step[]): Game {
  return advanceSingleE2(game, g => singleE2Clean(g) && !g.pendingShipment && !g.pendingHomeworldShipment && !g.pendingChoamWorthless, actions);
}
function transition(game: Game, step: SingleNexusE2Step, actions: SingleNexusE2Step[]): SingleNexusE2Transition {
  return { before: singleE2Reload(game), step: structuredClone(step), after: singleE2Step(game, step, actions) };
}
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
  const native = crypto.getRandomValues.bind(crypto); let index = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) array[0] = rolls[index++] ?? 0xffffffff;
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return operation(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
export function createSingleE2Setup(options: SingleNexusE2Options = {}): SingleNexusE2Setup {
  const native = options.native ?? options.initial?.players.find(p => p.faction === 'choam' || p.faction === 'richese')?.faction ?? 'richese';
  const roster = options.roster ?? [native, 'guild', 'fremen'] as readonly FactionId[];
  const advanced = options.advanced ?? options.initial?.advanced ?? true;
  let game = options.initial ? singleE2Reload(options.initial)
    : createGame('SINGLENEXUSE2', newPlayer(roster[0], roster[0], roster[0]), advanced, ['choam']);
  if (!options.initial) for (const faction of roster.slice(1)) joinGame(game, newPlayer(faction, faction, faction));
  assert.equal(game.advanced, advanced); assert.deepEqual(game.expansions, ['choam']);
  assert.equal(game.players.filter(p => p.faction === native).length, 1);
  assert.ok(game.players.every(p => p.faction === native || ['atreides', 'harkonnen', 'guild', 'fremen', 'beneGesserit', 'emperor'].includes(p.faction)));
  assert.ok(game.status === 'lobby' || game.status === 'setup' && game.turn === 1 && game.phase === 0 &&
    (!game.leaderSkills || game.leaderSkills.assignments.length === 0));
  const skills = options.skills ?? (options.initial?.status === 'setup' ? !!game.leaderSkills : true);
  const discovery = options.discovery ?? !!game.discoveryEnabled;
  const modules = { homeworlds: options.homeworlds ?? !!game.homeworlds,
    techTokens: options.tech ?? !!game.techTokens, strongholdCards: options.strongholds ?? !!game.strongholdCards };
  assert.ok(!modules.strongholdCards || advanced);
  const owner = game.players.find(p => p.faction === native)!.id, actions: SingleNexusE2Step[] = [];
  const requested = options.skill ?? 'suk-graduate';
  if (game.status === 'lobby') {
    for (const [type, enabled] of Object.entries(modules)) if (!!game[type as keyof typeof modules] !== enabled)
      game = singleE2Step(game, { actor: game.host, action: { type, enabled } }, actions);
    game.discoveryEnabled = discovery; game.nexusCards ??= { cards: null, phase: null };
  } else {
    for (const [type, enabled] of Object.entries(modules)) assert.equal(!!game[type as keyof typeof modules], enabled);
    assert.equal(!!game.discoveryEnabled, discovery); assert.equal(!!game.leaderSkills, skills);
    assert.ok(game.nexusCards?.cards, 'Never attach Nexus to a played deal.');
  }
  const initial = singleE2Reload(game);
  if (game.status === 'lobby') {
    for (const p of game.players) if (!p.ready) game = singleE2Step(game, { actor: p.id, action: { type: 'ready' } }, actions);
    const passive: LeaderSkillId[] = ['warmaster', 'sandmaster', 'killer-medic', 'prana-bindu-adept', 'swordmaster-of-ginaz'].filter(s => s !== requested) as LeaderSkillId[];
    const selected = game.players.map(p => p.id === owner ? requested : passive.shift()!);
    const skillsSource = LEADER_SKILL_CARDS.map(c => c.id), rest = skillsSource.filter(s => !selected.includes(s));
    const skillsOrder = selected.flatMap(s => [s, rest.shift()!]).concat(rest);
    const deck = treacheryDeck(['choam']), remaining = [...deck], front: Card[] = [];
    for (const p of game.players) for (let n = 0; n < (p.faction === 'harkonnen' ? 2 : 1); n++) {
      const kind = p.faction === 'choam' ? options.fuelKind ?? 'special' : 'worthless';
      const i = remaining.findIndex(c => c.kind === kind && (kind !== 'special' || c.effect !== 'karama')); assert.ok(i >= 0);
      front.push(remaining.splice(i, 1)[0]);
    }
    const rolls = [...(skills ? permutation(skillsSource, skillsOrder) : []),
      ...(discovery ? Array<number>(7).fill(0xffffffff) : []),
      ...Array<number>(NEXUS_FACTIONS.length - 1).fill(0xffffffff),
      ...permutation(deck.map(c => c.id), [...front, ...remaining].map(c => c.id))];
    game = lottery(rolls, () => skills ? initializeLeaderSkillsGameForAudit(game) : initializeNexusGameForAudit(game));
  }
  const setup = singleE2Reload(game); let offered: Game | null = null, trainer: string | null = null;
  for (let n = 0; game.status === 'setup' && n < 250; n++) {
    let step: SingleNexusE2Step;
    if (game.setupStage === 'leaderSkills' && !game.decision) {
      offered ??= singleE2Reload(game);
      const actor = Object.keys(game.leaderSkills!.offers)[0], view = viewGame(game, actor).leaderSkills!;
      const skill = actor === owner && options.skill ? options.skill
        : view.offer!.cards.find(s => !view.unavailableSkills?.[s]);
      assert.ok(skill && view.offer!.cards.includes(skill) && !view.unavailableSkills?.[skill],
        'A requested skill must exist in the authoritative original private offer.');
      const eligible = new Set(view.eligibleLeaders.map(l => l.id));
      const leader = singleE2Player(game, actor).leaders.filter(l => eligible.has(l.id)).sort((a, b) => b.strength - a.strength)[0];
      assert.ok(skill && leader); if (actor === owner) trainer = leader.id;
      step = { actor, action: { type: 'leaderSkill', event: view.offer!.event, skill, leader: leader.id } };
    } else {
      const next = nextSingleE2Step(game); assert.ok(next); step = next;
      if (step.action.type === 'traitor' && trainer) {
        const choices = singleE2Player(game, step.actor).traitorChoices;
        step.action.leader = choices.find(id => id !== trainer) ?? choices[0];
      }
      if (step.action.type === 'fremenSetup') step.action.placements = { sietch_tabr: 0, false_wall_south: 10, false_wall_west: 0 };
    }
    game = singleE2Step(game, step, actions);
  }
  assert.equal(game.status, 'playing'); singleE2Inventory(game);
  return { initial, setup, offered, afterSetup: singleE2Reload(game), game, owner,
    others: game.players.filter(p => p.id !== owner).map(p => p.id), trainer, actions };
}
export function shipSingleE2(game: Game, actor: string, destination: string, amount: number,
  actions?: SingleNexusE2Step[], sector?: number): Game {
  const sources = game.homeworlds ? nativeShipmentSources(viewGame(game, actor), amount, 0) : undefined;
  if (game.homeworlds) assert.ok(sources);
  let action: Action;
  if (destination.startsWith('homeworld:')) {
    assert.ok(sources);
    const choice = homeworldShipmentChoice(viewGame(game, actor), destination,
      Object.fromEntries(Object.entries(sources).filter(([, f]) => f.normal + f.elite > 0)));
    assert.ok(choice.action, choice.blocked ?? undefined); action = choice.action;
  } else action = { type: 'ship', territory: destination, sector: sector ?? (destination === 'shrine' ? 0 : territory(destination).sectors[0]),
    amount, elite: 0, allyPayment: 0, ...(sources ? { homeworldSources: sources } : {}) };
  return settleSingleE2(singleE2Step(game, { actor, action }, actions), actions);
}
/** Native starts, real first marker/parent entry, END Mentat, both Spice piles,
 * Maker or worm, settled alliance and a qualified original closing draw. */
export function createSingleE2Programme(options: SingleNexusE2Options = {}): SingleNexusE2Programme {
  const f = createSingleE2Setup(options), actions = f.actions;
  const guild = f.game.players.find(p => p.faction === 'guild')?.id;
  const fremen = f.game.players.find(p => p.faction === 'fremen')?.id;
  assert.ok(guild && fremen, 'The closing programme needs original Guild/Fremen alliance seats. Setup itself supports two through six.');
  let game = f.game; const discovery = !!game.discoveries;
  frontNativeHomeworldSpice(game, c => 'territory' in c && (discovery ? c.discovery === 'discovery-hagga-basin' : !c.discovery && c.territory === 'hagga_basin'), 0);
  if (game.advanced) frontNativeHomeworldSpice(game, c => 'territory' in c && !c.discovery && c.territory === 'broken_land', 1);
  const offset = game.advanced ? 2 : 1;
  frontNativeHomeworldSpice(game, c => 'worm' in c && (discovery ? !!c.greatMaker : !c.greatMaker && !c.suppressed), offset);
  frontNativeHomeworldSpice(game, c => 'territory' in c && !c.discovery && c.territory === 'rock_outcroppings', offset + 1);
  if (game.advanced) frontNativeHomeworldSpice(game, c => 'territory' in c && !c.discovery && c.territory === 'oh_gap', offset + 2);
  game = advanceSingleE2(game, g => g.phase === 1 && singleE2Clean(g), actions);
  if (discovery) {
    for (let n = 0; !game.discoveries!.tokens.some(t => t.face === 'shrine' && t.status === 'placed') && n < 100; n++) {
      const step = nextSingleE2Step(game); assert.ok(step); actions.push(structuredClone(step));
      game = withClassicDiscoveryNexusToken(game, 'shrine', () => applyAction(singleE2Reload(game), step.actor, step.action));
    }
    assert.ok(game.discoveries!.tokens.some(t => t.face === 'shrine' && t.status === 'placed'));
  }
  let firstMarker: SingleNexusE2Transition | null = null;
  const needed = new Set([...(discovery ? [guild] : []), ...(singleE2Player(game, f.owner).faction === 'richese' ? [f.owner] : [])]);
  while (needed.size) {
    game = advanceSingleE2(game, g => g.turn === 1 && g.phase === 5 && singleE2Clean(g) && needed.has(g.active!), actions);
    const actor = game.active!;
    if (actor === f.owner) {
      const p = singleE2Player(game, actor), token = p.noField!.tokens.find(t => t.value === 0)!;
      firstMarker = transition(game, { actor, action: { type: 'ship', territory: 'habbanya_ridge_sietch',
        sector: territory('habbanya_ridge_sietch').sectors[0], noField: token.id, event: p.noFieldEvent, allyPayment: 0 } }, actions);
      game = settleSingleE2(firstMarker.after, actions); firstMarker.after = singleE2Reload(game);
      game = singleE2Step(game, { actor, action: { type: 'revealNoField', token: token.id, event: singleE2Player(game, actor).noFieldEvent } }, actions);
    } else {
      const placement = DISCOVERY_CARD_PLACEMENTS['discovery-hagga-basin'];
      game = shipSingleE2(game, actor, placement.territory, 3, actions, placement.sector);
    }
    needed.delete(actor);
    if (needed.size) game = singleE2Step(game, { actor, action: { type: 'endMovement' } }, actions);
  }
  if (discovery) {
    game = advanceSingleE2(game, g => g.phase === 7 && singleE2Clean(g), actions);
    const token = game.discoveries!.tokens.find(t => t.face === 'shrine' && t.status === 'placed')!;
    for (const reveal of [false, true]) game = singleE2Step(game, { actor: guild, action: { type: 'discovery', token: token.id, reveal } }, actions);
  }
  game = advanceSingleE2(game, g => g.turn === 2, actions);
  let entry: SingleNexusE2Transition | null = null, ride: SingleNexusE2Transition | null = null, vote: Game | null = null;
  if (discovery) {
    game = advanceSingleE2(game, g => g.decision?.kind === 'discoveryEntry' && g.decision.player === guild, actions);
    const view = viewGame(game, guild), action = discoveryEntryMoveAction(view, view.discoveryEntry!.sources); assert.ok(action);
    entry = transition(game, { actor: guild, action }, actions); game = entry.after;
    game = advanceSingleE2(game, g => g.decision?.kind === 'greatMakerVote', actions); vote = singleE2Reload(game);
    while (game.decision?.kind === 'greatMakerVote') game = singleE2Step(game,
      { actor: game.decision.player, action: { type: 'decision', event: game.decision.event, yes: true } }, actions);
    assert.ok(game.decision?.kind === 'greatMakerRide' && game.decision.player === fremen);
    const actionRide = greatMakerRideAction(viewGame(game, fremen), 'polar_sink', 0, 2, game.advanced ? 1 : 0); assert.ok(actionRide);
    ride = transition(game, { actor: fremen, action: actionRide }, actions); game = ride.after;
  }
  game = advanceSingleE2(game, g => !!g.nexus && !g.spiceWindow && !g.spiceResolution && singleE2Clean(g), actions);
  for (const [actor, target] of [[guild, fremen], [fremen, guild]])
    game = singleE2Step(game, { actor, action: { type: 'alliance', target } }, actions);
  const alliance = singleE2Reload(game);
  game = advanceSingleE2(game, g => g.nexusCards?.phase?.stage === 'drawing' && singleE2Clean(g), actions);
  assert.ok(game.nexusCards!.phase!.eligible.includes(f.owner));
  const cards = game.nexusCards!.cards!, face = singleE2Player(game, f.owner).faction;
  const at = cards.deck.indexOf(face); assert.ok(at >= 0); cards.deck.unshift(cards.deck.splice(at, 1)[0]);
  const draw = transition(game, { actor: f.owner, action: { type: 'nexusCardChoice', turn: game.turn,
    card: cards.hands[f.owner] ?? null, choice: 'draw', ownRedraws: 0 } }, actions);
  game = advanceSingleE2(draw.after, g => g.phase === 5 && singleE2Clean(g), actions);
  return { ...f, game, firstMarker, entry, ride, vote, alliance, draw };
}
export function singleE2Cunning(game: Game, actor: string, fuel?: string, destination = 'shrine'): Action {
  const p: Player = singleE2Player(game, actor), view = viewGame(game, actor);
  if (p.faction === 'choam') {
    const play = choamPowerPlays(view, 'kulon').find(p => p.source === 'nexus' && p.card.id === fuel); assert.ok(play);
    const action = choamPowerAction(view, play); assert.ok(action); return action;
  }
  assert.equal(p.faction, 'richese'); const offer = view.nexusRicheseCunning; assert.ok(offer && !offer.blocked);
  return { type: 'ship', territory: destination, sector: destination === 'shrine' ? 0 : territory(destination).sectors[0],
    noField: p.noField!.tokens.find(t => t.value === 3)!.id, revealedToken: p.noField!.tokens.find(t => t.value === 5)!.id,
    event: p.noFieldEvent, nexus: offer.event, allyPayment: 0 };
}
export function openSingleE2Battle(game: Game, owner: string, opponent: string, location: string, hidden = false): Game {
  game = advanceSingleE2(game, g => g.phase === 6 && singleE2Clean(g) && !!g.active);
  const choice = viewGame(game, game.active!).battleChoices.find(b => b.territory === location &&
    [owner, opponent].includes(b.attacker) && [owner, opponent].includes(b.defender)); assert.ok(choice);
  game = singleE2Step(game, { actor: choice.chooser, action: { type: 'chooseBattle', territory: location,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker } });
  for (let n = 0; n < 200; n++) {
    if (game.battle && singleE2Clean(game) && !game.battle.preparation && game.battle.preLeader?.closed !== false) return game;
    const next = nextSingleE2Step(game); assert.ok(next);
    if (next.action.type === 'leaderSkillVisibility') next.action.hide = next.actor === owner && hidden;
    game = singleE2Step(game, next);
  }
  throw Error('Original single E2 battle did not reach sealed plans.');
}
export function revealSingleE2Plans(game: Game, plans: readonly SingleNexusE2Step[]): Game {
  for (const plan of plans) {
    game = singleE2Step(game, plan);
    while (game.response || game.phaseOpening || game.decision?.kind === 'fullPlanOffer') {
      const next = nextSingleE2Step(game); assert.ok(next); game = singleE2Step(game, next);
    }
  }
  assert.ok(game.battle?.revealed); return game;
}
export function finishSingleE2Battle(game: Game): Game {
  for (let n = 0; n < 600; n++) {
    if (!game.battle && singleE2Clean(game)) return game;
    let next = nextSingleE2Step(game);
    if (!next && !game.response && !game.phaseOpening) {
      const d = game.decision; assert.ok(d);
      if (d.kind === 'battleCards') next = { actor: d.player, action: { type: 'decision', discard: [] } };
      else if (d.kind === 'techToken') next = { actor: d.player, action: { type: 'decision', token: d.choices[0] } };
      else throw Error(`Choose real ${d.kind} before cleanup.`);
    }
    assert.ok(next); game = singleE2Step(game, next);
  }
  throw Error('Original single E2 aftermath did not finish.');
}
