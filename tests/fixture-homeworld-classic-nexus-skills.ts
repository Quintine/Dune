import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Game } from '../game/engine';
import type { FactionId } from '../game/catalog';
import type { LeaderSkillId } from '../game/leader-skill-cards';
import { NEXUS_FACTIONS, validateNexusCards } from '../game/nexus-cards';
import { validateDiscoveryState } from '../game/discoveries';
import { homeworldContext } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import {
  assertClassicHomeworldSkillsCustody, classicHomeworldSkillsPlayer,
  createClassicHomeworldSkillsSetup, nextClassicHomeworldSkillsStep,
  type ClassicHomeworldSkillsSetup, type ClassicHomeworldSkillsStep,
} from './fixture-homeworld-classic-skills';
import { nextHomeworldSkillsDiscoveryStep } from './fixture-homeworld-skills-discovery';

export type ClassicHomeworldNexusSkillsStep = ClassicHomeworldSkillsStep;
export type ClassicHomeworldNexusSkillsOptions = {
  /** Original fresh lobby only. Never redeal an existing offer, hand or save. */
  initial?: Game;
  advanced?: boolean;
  discovery?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  roster?: readonly FactionId[];
  skill?: LeaderSkillId;
};
export type ClassicHomeworldNexusSkillsFixture = ClassicHomeworldSkillsSetup & {
  kind: 'native-suk' | 'visitor-suk' | 'visitor-death';
  beforeClosingDraw: Game;
  closingDraw: ClassicHomeworldNexusSkillsStep;
  afterClosingDraw: Game;
  beforeShipment: Game;
  shipment: ClassicHomeworldNexusSkillsStep;
  afterShipment: Game;
  beforeShippingEnd: Game;
  shippingEnd: ClassicHomeworldNexusSkillsStep;
  afterShippingEnd: Game;
  game: Game;
  owner: string;
  opponent: string;
  trainer: string;
  territory: string;
  plans: ClassicHomeworldNexusSkillsStep[];
};
export const classicHomeworldNexusSkillsPlayer = classicHomeworldSkillsPlayer;
export const classicHomeworldNexusSkillsClean = (game: Game) =>
  !game.phaseOpening && !game.response && !game.decision && !game.pendingTreacheryDiscard;

/** Original private Nexus opt-in, not a fabricated player action. The returned
 * lobby is also usable by the integration owner's original private QA route. */
export function createClassicHomeworldNexusSkillsLobby(options: ClassicHomeworldNexusSkillsOptions = {}): Game {
  const roster: readonly FactionId[] = options.roster ?? ['emperor', 'guild', 'atreides', 'harkonnen'];
  let game = options.initial ? structuredClone(options.initial)
    : createGame('CLASSICHWNEXUSSKILLS', newPlayer(roster[0], roster[0], roster[0]), options.advanced ?? false);
  if (!options.initial) for (const faction of roster.slice(1)) joinGame(game, newPlayer(faction, faction, faction));
  assert.equal(game.status, 'lobby', 'Accept only the original fresh lobby, never an existing saved setup.');
  if (options.advanced !== undefined) assert.equal(game.advanced, options.advanced);
  assert.ok(game.players.every(p => ['emperor', 'guild', 'atreides', 'harkonnen', 'fremen', 'beneGesserit'].includes(p.faction)));
  assert.equal(new Set(game.players.map(p => p.faction)).size, game.players.length);
  if (!game.homeworlds) game = applyAction(game, game.host, { type: 'homeworlds', enabled: true });
  if (options.tech && !game.techTokens) game = applyAction(game, game.host, { type: 'techTokens', enabled: true });
  if (options.strongholds && !game.strongholdCards) game = applyAction(game, game.host, { type: 'strongholdCards', enabled: true });
  if (options.discovery) game.discoveryEnabled = true;
  if (!game.nexusCards) game.nexusCards = { cards: null, phase: null };
  assert.equal(game.nexusCards.cards, null); assert.equal(game.nexusCards.phase, null);
  return game;
}
export function createClassicHomeworldNexusSkillsSetup(options: ClassicHomeworldNexusSkillsOptions = {}): ClassicHomeworldSkillsSetup {
  const initial = createClassicHomeworldNexusSkillsLobby(options), readyActions: ClassicHomeworldNexusSkillsStep[] = [];
  let game = structuredClone(initial);
  for (const player of game.players) if (!player.ready) {
    const step: ClassicHomeworldNexusSkillsStep = { actor: player.id, action: { type: 'ready' } };
    readyActions.push(step); game = applyAction(game, step.actor, step.action);
  }
  const setup = createClassicHomeworldSkillsSetup({ initial: game, skill: options.skill ?? 'suk-graduate' });
  return { ...setup, initial, actions: [...readyActions, ...setup.actions] };
}
export function assertClassicHomeworldNexusSkillsInventory(game: Game): void {
  assertClassicHomeworldSkillsCustody(game);
  assert.ok(game.nexusCards?.cards);
  validateNexusCards(game.nexusCards.cards, game.players);
  const cards = game.nexusCards.cards;
  assert.deepEqual([...cards.deck, ...cards.discard, ...Object.values(cards.hands).filter(c => c !== null)].sort(), [...NEXUS_FACTIONS].sort());
  if (game.discoveryEnabled) {
    assert.ok(game.discoveries); validateDiscoveryState(game.discoveries);
    const spice = [...game.spiceDeck, ...game.spiceDiscard.flat(), ...(game.spiceResolution?.skipped ?? []), ...(game.spiceSequence?.skipped ?? [])];
    assert.equal(spice.filter(c => 'territory' in c && !!c.discovery).length, 6);
    assert.equal(spice.filter(c => 'worm' in c && c.greatMaker).length, 1);
    assert.equal(game.discoveries.tokens.length, 8);
  }
}
export function nextClassicHomeworldNexusSkillsStep(game: Game): ClassicHomeworldNexusSkillsStep | null {
  if (!game.phaseOpening && !game.response) {
    const decision = game.decision;
    if (decision?.kind === 'guildShipment') return { actor: decision.player, action: { type: 'decision', allow: true } };
    if (decision?.kind === 'homeworldShipmentGuild') return { actor: decision.player, action: { type: 'decision', event: decision.event, allow: true } };
    if (decision?.kind === 'techToken') return null; // Mandatory human winner choice, after original cleanup.
    if (game.nexusCards?.phase?.stage === 'drawing' && !decision) {
      const actor = game.nexusCards.phase.eligible.find(id => !game.nexusCards!.phase!.done.includes(id));
      if (actor) return { actor, action: { type: 'nexusCardChoice', turn: game.turn,
        card: game.nexusCards.cards!.hands[actor], choice: 'keep', ownRedraws: 0 } };
    }
  }
  return game.discoveryEnabled ? nextHomeworldSkillsDiscoveryStep(game)
    : nextClassicHomeworldSkillsStep(game, game.players.find(p => p.faction === 'emperor')?.id);
}
export function advanceClassicHomeworldNexusSkills(state: Game, until: (game: Game) => boolean,
  actions?: ClassicHomeworldNexusSkillsStep[]): Game {
  let game = state;
  for (let n = 0; n < 1800; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const next = nextClassicHomeworldNexusSkillsStep(game);
    assert.ok(next, 'Original continuation stops at human sealed plans, Suk rescue or mandatory winner Tech.');
    actions?.push(structuredClone(next)); game = applyAction(game, next.actor, next.action);
  }
  throw Error('Original Homeworld/Nexus/Skills programme did not reach its owned boundary.');
}
function act(game: Game, step: ClassicHomeworldNexusSkillsStep, actions: ClassicHomeworldNexusSkillsStep[]): Game {
  actions.push(structuredClone(step)); return applyAction(game, step.actor, step.action);
}
function orderSpice(game: Game, kinds: ('land' | 'worm')[], staging: string[]): void {
  for (const [position, kind] of kinds.entries()) {
    const index = game.spiceDeck.findIndex((card, i) => i >= position && (kind === 'worm'
      ? 'worm' in card && !card.greatMaker : 'territory' in card && !card.discovery));
    assert.ok(index >= position, 'Select only a conserved original unplayed Spice Card.');
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
  }
  staging.push(`Selected only original unplayed Spice order: ${kinds.join(', ')}; no board, wallet, hand, casualty or clock staging.`);
}
export function classicHomeworldNexusSkillsPool(game: Game, actor: string, home: string) {
  return homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!)
    .find(world => world.id === home)!.forces[actor] ?? { normal: 0, elite: 0 };
}

/** Full first Mentat -> second-turn natural worm -> reciprocal alliance ->
 * complete Spice closure -> original private draw -> paid physical invasion.
 * Every army and casualty is created by original actions. DS7/8 remain original
 * components; ordinary Spice is deliberately selected so this branch has no
 * incidental nested entry or Great Maker army. */
export function createClassicHomeworldNexusSkillsFixture(options: ClassicHomeworldNexusSkillsOptions & {
  kind?: ClassicHomeworldNexusSkillsFixture['kind'];
} = {}): ClassicHomeworldNexusSkillsFixture {
  const kind = options.kind ?? 'visitor-suk';
  const setup = createClassicHomeworldNexusSkillsSetup({ ...options, skill: kind === 'visitor-death' ? 'mentat' : 'suk-graduate' });
  let game = structuredClone(setup.afterSetup);
  const owner = game.players.find(p => p.faction === 'emperor')!.id;
  const opponent = game.players.find(p => p.faction === 'guild')!.id;
  assert.equal(game.players[0].id, owner, 'This original lottery trains the actual first Emperor seat.');
  assert.ok(!game.players.some(p => p.faction === 'fremen'), 'Free-three programme needs genuinely absent Fremen.');
  assert.ok(game.players.length >= 4, 'Two noncombatants form a real alliance, leaving both combatants unallied.');
  const trainer = game.leaderSkills!.assignments.find(a => a.owner === owner)!.leader;
  orderSpice(game, game.advanced ? ['land', 'land'] : ['land'], setup.staging);
  game = advanceClassicHomeworldNexusSkills(game, g => g.turn === 2 && g.phase === 1 && classicHomeworldNexusSkillsClean(g), setup.actions);
  orderSpice(game, game.advanced ? ['worm', 'land', 'land'] : ['worm', 'land'], setup.staging);
  let allied = false;
  for (let n = 0; game.nexusCards?.phase?.stage !== 'drawing' && n < 240; n++) {
    if (game.nexus && !game.spiceWindow && !game.spiceResolution && classicHomeworldNexusSkillsClean(game) && !allied) {
      const others = game.players.filter(p => p.id !== owner && p.id !== opponent);
      for (const [from, to] of [[others[0].id, others[1].id], [others[1].id, others[0].id]])
        game = act(game, { actor: from, action: { type: 'alliance', target: to } }, setup.actions);
      allied = true;
    }
    const next = nextClassicHomeworldNexusSkillsStep(game); assert.ok(next);
    game = act(game, next, setup.actions);
  }
  assert.ok(allied); assert.equal(game.nexusCards?.phase?.stage, 'drawing');
  assert.ok(game.nexusCards!.phase!.eligible.includes(owner));
  const cards = game.nexusCards!.cards!, index = cards.deck.indexOf('fremen'); assert.ok(index >= 0);
  cards.deck.unshift(cards.deck.splice(index, 1)[0]);
  setup.staging.push('Selected the original undealt Fremen Nexus singleton before the qualifying real closing draw; never wrote a held Nexus hand.');
  const beforeClosingDraw = structuredClone(game), closingDraw: ClassicHomeworldNexusSkillsStep = {
    actor: owner, action: { type: 'nexusCardChoice', turn: game.turn, card: cards.hands[owner], choice: 'draw', ownRedraws: 0 },
  };
  game = act(game, closingDraw, setup.actions); const afterClosingDraw = structuredClone(game);
  assert.equal(game.nexusCards!.cards!.hands[owner], 'fremen');
  game = advanceClassicHomeworldNexusSkills(game, g => g.phase === 5 && g.active === (kind === 'native-suk' ? opponent : owner) && classicHomeworldNexusSkillsClean(g), setup.actions);
  const territory = kind === 'native-suk' ? game.advanced ? 'homeworld:emperor:salusa' : 'homeworld:emperor' : 'homeworld:guild';
  const shipper = kind === 'native-suk' ? opponent : owner;
  const sources = shipper === owner && game.advanced ? {
    'homeworld:emperor': { normal: 3, elite: 0 }, 'homeworld:emperor:salusa': { normal: 0, elite: 1 },
  } : { [`homeworld:${classicHomeworldSkillsPlayer(game, shipper).faction}`]: { normal: kind === 'native-suk' ? 3 : 4, elite: 0 } };
  const beforeShipment = structuredClone(game), shipment: ClassicHomeworldNexusSkillsStep = { actor: shipper,
    action: { type: 'homeworldShip', event: viewGame(game, shipper).homeworldShipment!.event, destination: territory, sources } };
  game = act(game, shipment, setup.actions);
  game = advanceClassicHomeworldNexusSkills(game, g => !g.pendingHomeworldShipment && classicHomeworldNexusSkillsClean(g), setup.actions);
  const afterShipment = structuredClone(game);
  // Preserve the exact original phase-end action, rather than infer industry
  // payment from a later wallet containing unrelated Collection/battle income.
  let beforeShippingEnd: Game | undefined, shippingEnd: ClassicHomeworldNexusSkillsStep | undefined;
  for (let n = 0; game.phase === 5 && n < 240; n++) {
    const before = structuredClone(game), next = nextClassicHomeworldNexusSkillsStep(game); assert.ok(next);
    game = act(game, next, setup.actions);
    if (game.phase !== 5) { beforeShippingEnd = before; shippingEnd = next; }
  }
  assert.ok(beforeShippingEnd && shippingEnd);
  const afterShippingEnd = structuredClone(game);
  game = advanceClassicHomeworldNexusSkills(game, g => g.phase === 6 && classicHomeworldNexusSkillsClean(g), setup.actions);
  const actor = game.active!; assert.ok(actor === owner || actor === opponent);
  game = act(game, { actor, action: { type: 'chooseBattle', territory, target: actor === owner ? opponent : owner } }, setup.actions);
  game = advanceClassicHomeworldNexusSkills(game, g => !!g.battle && classicHomeworldNexusSkillsClean(g) && !g.battle.preparation && g.battle.preLeader?.closed !== false, setup.actions);
  const trained = new Set(game.leaderSkills!.assignments.map(a => a.leader));
  const enemy = classicHomeworldSkillsPlayer(game, opponent);
  const leader = enemy.leaders.filter(l => !l.dead && !trained.has(l.id)).sort((a, b) => a.strength - b.strength)[0]; assert.ok(leader);
  const weapon = kind === 'visitor-death' ? enemy.hand.find(c => c.kind === 'projectile')?.id : undefined;
  if (kind === 'visitor-death') assert.ok(weapon, 'Use only the projectile genuinely dealt to the Guild at original setup.');
  const dial = kind === 'visitor-death' ? 0 : kind === 'native-suk' && game.advanced ? 6 : 4;
  const plans: ClassicHomeworldNexusSkillsStep[] = [
    { actor: owner, action: { type: 'battlePlan', leader: trainer, dial, support: game.advanced && dial && kind !== 'native-suk' ? 2 : 0 } },
    { actor: opponent, action: { type: 'battlePlan', leader: leader.id, dial: 0, weapon } },
  ];
  assertClassicHomeworldNexusSkillsInventory(game);
  return { ...setup, kind, beforeClosingDraw, closingDraw, afterClosingDraw, beforeShipment, shipment, afterShipment,
    beforeShippingEnd, shippingEnd, afterShippingEnd, game, owner, opponent, trainer, territory, plans };
}
export function revealClassicHomeworldNexusSkillsBattle(fixture: ClassicHomeworldNexusSkillsFixture): Game {
  let game = structuredClone(fixture.game);
  for (const step of fixture.plans) {
    game = applyAction(game, step.actor, step.action);
    if (!game.battle?.revealed) game = advanceClassicHomeworldNexusSkills(game,
      g => classicHomeworldNexusSkillsClean(g) && !!g.battle && !g.battle.preparation);
  }
  assert.ok(game.battle?.revealed); return game;
}
export function settleClassicHomeworldNexusSkillsBattle(state: Game, stop: 'suk' | 'cleanup' = 'cleanup'): Game {
  return advanceClassicHomeworldNexusSkills(state, game => stop === 'suk' && game.decision?.kind === 'sukRescue' ||
    game.decision?.kind === 'techToken' || !game.battle && classicHomeworldNexusSkillsClean(game));
}
export function classicHomeworldNexusSkillsRevivalWindow(state: Game, actions?: ClassicHomeworldNexusSkillsStep[], staging: string[] = []): Game {
  const turn = state.turn;
  let game = advanceClassicHomeworldNexusSkills(state, g => g.turn === turn + 1 && g.phase === 1 && classicHomeworldNexusSkillsClean(g), actions);
  orderSpice(game, game.advanced ? ['land', 'land'] : ['land'], staging);
  game = advanceClassicHomeworldNexusSkills(game, g => g.turn === turn + 1 && g.phase === 4 && classicHomeworldNexusSkillsClean(g), actions);
  return game;
}
