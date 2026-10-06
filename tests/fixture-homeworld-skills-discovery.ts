import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Game } from '../game/engine';
import type { FactionId } from '../game/catalog';
import type { LeaderSkillId } from '../game/leader-skill-cards';
import { DISCOVERY_CARD_PLACEMENTS, DISCOVERY_SPICE_CARDS, DISCOVERY_TOKEN_BY_ID,
  validateDiscoveryState, type DiscoveryLocationId, type DiscoveryOpaqueTokenId } from '../game/discoveries';
import { discoveryEntryMoveAction } from '../game/discovery-entry-options';
import { nativeShipmentSources } from '../game/homeworld-options';
import type { SukReserveDestinations } from '../game/suk-graduate';
import {
  assertClassicHomeworldSkillsCustody, classicHomeworldSkillsPlayer,
  createClassicHomeworldSkillsSetup, nextClassicHomeworldSkillsStep,
  type ClassicHomeworldSkillsSetup, type ClassicHomeworldSkillsStep,
} from './fixture-homeworld-classic-skills';

export type HomeworldSkillsDiscoveryStep = ClassicHomeworldSkillsStep;
export type HomeworldSkillsDiscoveryOptions = {
  initial?: Game;
  advanced?: boolean;
  seats?: 2 | 3 | 4 | 5 | 6;
  roster?: readonly FactionId[];
  skill?: LeaderSkillId;
  face?: DiscoveryLocationId;
  shipForMaker?: boolean;
};
export type HomeworldSkillsDiscoveryFixture = ClassicHomeworldSkillsSetup & {
  game: Game;
  owner: string;
  fremen: string;
  opponent: string | null;
  trainer: string;
  token: DiscoveryOpaqueTokenId;
  face: DiscoveryLocationId;
  parent: string;
  parentSector: number;
  wormTerritory: string;
  wormSector: number;
  amount: number;
  elite: number;
  beforeShipment: Game;
  afterShipment: Game;
};
export type HomeworldSkillsDiscoveryBattleFixture = HomeworldSkillsDiscoveryFixture & {
  entered: Game;
  beforeReinforcement: Game;
  afterReinforcement: Game;
  beforeBattle: Game;
  plans: HomeworldSkillsDiscoveryStep[];
};
export const homeworldSkillsDiscoveryPlayer = classicHomeworldSkillsPlayer;
export const homeworldSkillsDiscoveryClean = (game: Game) =>
  !game.phaseOpening && !game.response && !game.decision && !game.pendingTreacheryDiscard;

/** An original fresh lobby, never a second reserve or component model. */
export function createHomeworldSkillsDiscoveryLobby(options: HomeworldSkillsDiscoveryOptions = {}): Game {
  if (options.initial) return structuredClone(options.initial);
  const factions: readonly FactionId[] = options.roster ?? ['emperor', 'fremen', 'guild', 'harkonnen', 'atreides', 'beneGesserit'];
  let game = createGame('HWSKILLSDISCOVERY', newPlayer(factions[0], factions[0], factions[0]), options.advanced ?? false);
  for (const faction of factions.slice(1, options.seats ?? (options.roster ? factions.length : 4))) joinGame(game, newPlayer(faction, faction, faction));
  game = applyAction(game, game.host, { type: 'homeworlds', enabled: true });
  game.discoveryEnabled = true;
  return game;
}
export function createHomeworldSkillsDiscoverySetup(options: HomeworldSkillsDiscoveryOptions = {}): ClassicHomeworldSkillsSetup {
  return createClassicHomeworldSkillsSetup({ initial: createHomeworldSkillsDiscoveryLobby(options), skill: options.skill ?? 'suk-graduate' });
}

/** Consume only original owner-labelled queues; human plans and rescue choices
 * remain explicit boundaries. The lottery helper below never signs a window. */
export function nextHomeworldSkillsDiscoveryStep(game: Game): HomeworldSkillsDiscoveryStep | null {
  if (!game.phaseOpening && !game.response) {
    const decision = game.decision;
    if (decision?.kind === 'discoveryEntry' || decision?.kind === 'greatMakerRide')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, accept: false } };
    if (decision?.kind === 'greatMakerVote')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, yes: false } };
    if (decision?.kind === 'wormRide') return { actor: decision.player, action: { type: 'decision', accept: false } };
    if (decision?.kind === 'wormProtection') return { actor: decision.player, action: { type: 'decision', accept: true } };
  }
  return nextClassicHomeworldSkillsStep(game, game.players.find(p => p.faction === 'emperor')?.id);
}
export function advanceHomeworldSkillsDiscovery(state: Game, until: (game: Game) => boolean,
  actions?: HomeworldSkillsDiscoveryStep[]): Game {
  let game = state;
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const next = nextHomeworldSkillsDiscoveryStep(game);
    assert.ok(next, 'A real sealed plan or physical Suk rescue choice is required.');
    actions?.push(structuredClone(next)); game = applyAction(game, next.actor, next.action);
  }
  throw Error('Original Homeworld/Skills/Discovery programme did not reach its owned window.');
}
export function assertHomeworldSkillsDiscoveryInventory(game: Game): void {
  assertClassicHomeworldSkillsCustody(game);
  validateDiscoveryState(game.discoveries!);
  const spice = [...game.spiceDeck, ...game.spiceDiscard.flat(), ...(game.spiceResolution?.skipped ?? []),
    ...(game.spiceSequence?.skipped ?? [])];
  assert.equal(spice.filter(card => 'territory' in card && !!card.discovery).length, 6);
  assert.equal(spice.filter(card => 'worm' in card && card.greatMaker).length, 1);
  assert.equal(game.discoveries!.tokens.length, 8);
}
function frontUnplayedSpice(game: Game, choose: (card: Game['spiceDeck'][number]) => boolean, position: number): void {
  const index = game.spiceDeck.findIndex((card, i) => i >= position && choose(card));
  assert.ok(index >= position, 'Select only an original still-unplayed physical Spice Card.');
  game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
}
function originalTokenLottery<T>(game: Game, face: DiscoveryLocationId, operation: () => T): T {
  const pool = game.discoveries!.tokens.filter(token => token.status === 'supply' && token.type === DISCOVERY_TOKEN_BY_ID[face].type);
  const index = pool.findIndex(token => token.face === face); assert.ok(index >= 0);
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues'), native = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1)
      array[0] = Math.floor((index + 0.5) / pool.length * 0x100000000);
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return operation(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
function act(game: Game, step: HomeworldSkillsDiscoveryStep, actions: HomeworldSkillsDiscoveryStep[]): Game {
  actions.push(structuredClone(step)); return applyAction(game, step.actor, step.action);
}

/** PDF21–23 variants together: original all14 training before faction setup,
 * original seven Spice Cards/eight tokens, and original Homeworld withdrawals.
 * Only undealt lotteries/unplayed Spice order are selected; no force staging. */
export function createHomeworldSkillsDiscoveryFixture(options: HomeworldSkillsDiscoveryOptions = {}): HomeworldSkillsDiscoveryFixture {
  const setup = createHomeworldSkillsDiscoverySetup(options);
  let game = structuredClone(setup.afterSetup);
  const owner = game.players.find(p => p.faction === 'emperor')!.id;
  const fremen = game.players.find(p => p.faction === 'fremen')!.id;
  const opponent = game.players.find(p => p.faction === 'guild')?.id ?? null;
  const trainer = game.leaderSkills!.assignments.find(a => a.owner === owner)!.leader;
  const face = options.face ?? 'cistern';
  frontUnplayedSpice(game, card => 'territory' in card && card.discovery === 'discovery-hagga-basin', 0);
  if (game.advanced) frontUnplayedSpice(game, card => 'territory' in card && !card.discovery && card.territory !== 'hagga_basin', 1);
  const nextTurnIndex = game.advanced ? 2 : 1;
  frontUnplayedSpice(game, card => 'worm' in card && !!card.greatMaker, nextTurnIndex);
  for (let position = nextTurnIndex + 1; position < nextTurnIndex + (game.advanced ? 3 : 2); position++)
    frontUnplayedSpice(game, card => 'territory' in card && !card.discovery && card.territory !== 'hagga_basin', position);
  setup.staging.push('Selected only the conserved unplayed Hagga Discovery/next-turn Great Maker Spice order and the original Hiereg supply lottery; every force arrives through an engine action.');
  game = advanceHomeworldSkillsDiscovery(game, g => g.phase === 1 && homeworldSkillsDiscoveryClean(g), setup.actions);
  game = originalTokenLottery(game, face, () => advanceHomeworldSkillsDiscovery(game,
    g => g.discoveries!.tokens.some(t => t.face === face && t.status === 'placed'), setup.actions));
  game = advanceHomeworldSkillsDiscovery(game, g => g.phase === 5 && g.active === owner && homeworldSkillsDiscoveryClean(g), setup.actions);
  const placement = DISCOVERY_CARD_PLACEMENTS['discovery-hagga-basin'];
  const blow = DISCOVERY_SPICE_CARDS.find(card => card.discovery === 'discovery-hagga-basin')!;
  const destination = options.shipForMaker ? blow : placement;
  const amount = game.advanced ? 3 : 2, elite = game.advanced ? 1 : 0;
  const beforeShipment = structuredClone(game), sources = nativeShipmentSources(viewGame(game, owner), amount, elite); assert.ok(sources);
  game = act(game, { actor: owner, action: { type: 'ship', territory: destination.territory,
    sector: destination.sector, amount, elite, allyPayment: 0, homeworldSources: sources } }, setup.actions);
  game = advanceHomeworldSkillsDiscovery(game, g => !g.pendingShipment && homeworldSkillsDiscoveryClean(g), setup.actions);
  const afterShipment = structuredClone(game);
  game = advanceHomeworldSkillsDiscovery(game, g => g.phase === 7 && homeworldSkillsDiscoveryClean(g), setup.actions);
  const token = game.discoveries!.tokens.find(t => t.face === face)!;
  assert.equal(game.turn, 1); assertHomeworldSkillsDiscoveryInventory(game);
  return { ...setup, game, owner, fremen, opponent, trainer, token: token.id, face,
    parent: placement.territory, parentSector: placement.sector, wormTerritory: blow.territory,
    wormSector: blow.sector, amount, elite, beforeShipment, afterShipment };
}
export function revealHomeworldSkillsDiscovery(fixture: HomeworldSkillsDiscoveryFixture): Game {
  let game = structuredClone(fixture.game);
  if (viewGame(game, fixture.owner).discoveries!.canInspect.includes(fixture.token))
    game = applyAction(game, fixture.owner, { type: 'discovery', token: fixture.token, reveal: false });
  assert.ok(viewGame(game, fixture.owner).discoveries!.canReveal.includes(fixture.token));
  return applyAction(game, fixture.owner, { type: 'discovery', token: fixture.token, reveal: true });
}
export function homeworldSkillsDiscoveryEntryWindow(fixture: HomeworldSkillsDiscoveryFixture): Game {
  return advanceHomeworldSkillsDiscovery(revealHomeworldSkillsDiscovery(fixture), game =>
    game.turn === 2 && game.decision?.kind === 'discoveryEntry' && game.decision.player === fixture.owner);
}
export function enterHomeworldSkillsDiscovery(fixture: HomeworldSkillsDiscoveryFixture): Game {
  const game = homeworldSkillsDiscoveryEntryWindow(fixture), view = viewGame(game, fixture.owner);
  const action = discoveryEntryMoveAction(view, view.discoveryEntry!.sources); assert.ok(action);
  return applyAction(game, fixture.owner, action);
}
export function homeworldSkillsDiscoveryMakerWindow(fixture: HomeworldSkillsDiscoveryFixture): Game {
  return advanceHomeworldSkillsDiscovery(structuredClone(fixture.game), game => game.decision?.kind === 'greatMakerVote');
}

/** Genuine reveal -> next-turn parent entry -> paid reinforcement and enemy
 * shipment -> nested battle. Neither physical army is placed by the fixture. */
export function createHomeworldSkillsDiscoveryBattleFixture(options: HomeworldSkillsDiscoveryOptions = {}): HomeworldSkillsDiscoveryBattleFixture {
  const fixture = createHomeworldSkillsDiscoveryFixture(options);
  assert.ok(fixture.opponent, 'The connected nested battle needs the original Guild seat.');
  let game = enterHomeworldSkillsDiscovery(fixture);
  const entered = structuredClone(game), reinforcement = game.advanced ? 2 : 3;
  const beforeByActor = new Map<string, Game>(), afterByActor = new Map<string, Game>();
  // Original storm order determines which real shipment happens first.
  game = advanceHomeworldSkillsDiscovery(game, g => g.turn === 2 && g.phase === 5 && homeworldSkillsDiscoveryClean(g), fixture.actions);
  const remaining = new Set([fixture.owner, fixture.opponent]);
  while (remaining.size) {
    game = advanceHomeworldSkillsDiscovery(game, g => g.turn === 2 && g.phase === 5 &&
      homeworldSkillsDiscoveryClean(g) && remaining.has(g.active!), fixture.actions);
    const actor = game.active!, amount = actor === fixture.owner ? reinforcement : 2;
    beforeByActor.set(actor, structuredClone(game));
    const sources = nativeShipmentSources(viewGame(game, actor), amount, 0); assert.ok(sources);
    game = act(game, { actor, action: { type: 'ship', territory: fixture.face, sector: 0,
      amount, elite: 0, allyPayment: 0, homeworldSources: sources } }, fixture.actions);
    game = advanceHomeworldSkillsDiscovery(game, g => !g.pendingShipment && homeworldSkillsDiscoveryClean(g), fixture.actions);
    afterByActor.set(actor, structuredClone(game)); remaining.delete(actor);
    game = act(game, { actor, action: { type: 'endMovement' } }, fixture.actions);
  }
  game = advanceHomeworldSkillsDiscovery(game, g => g.phase === 6 && homeworldSkillsDiscoveryClean(g), fixture.actions);
  const beforeBattle = structuredClone(game), actor = game.active!;
  assert.ok(actor === fixture.owner || actor === fixture.opponent);
  game = act(game, { actor, action: { type: 'chooseBattle', territory: fixture.face,
    target: actor === fixture.owner ? fixture.opponent : fixture.owner } }, fixture.actions);
  game = advanceHomeworldSkillsDiscovery(game, g => !!g.battle && homeworldSkillsDiscoveryClean(g) &&
    !g.battle.preparation && g.battle.preLeader?.closed !== false, fixture.actions);
  const trained = new Set(game.leaderSkills!.assignments.map(a => a.leader));
  const enemy = classicHomeworldSkillsPlayer(game, fixture.opponent);
  const leader = enemy.leaders.filter(l => !l.dead && !trained.has(l.id)).sort((a, b) => a.strength - b.strength)[0]; assert.ok(leader);
  const plans: HomeworldSkillsDiscoveryStep[] = [
    { actor: fixture.owner, action: { type: 'battlePlan', leader: fixture.trainer, dial: 4, support: game.advanced ? 2 : 0 } },
    { actor: fixture.opponent, action: { type: 'battlePlan', leader: leader.id, dial: 0 } },
  ];
  assertHomeworldSkillsDiscoveryInventory(game);
  return { ...fixture, game, entered, beforeReinforcement: beforeByActor.get(fixture.owner)!,
    afterReinforcement: afterByActor.get(fixture.owner)!, beforeBattle, plans };
}
export function revealHomeworldSkillsDiscoveryBattle(fixture: HomeworldSkillsDiscoveryBattleFixture): Game {
  let game = structuredClone(fixture.game);
  for (const step of fixture.plans) {
    game = applyAction(game, step.actor, step.action);
    if (!game.battle?.revealed) game = advanceHomeworldSkillsDiscovery(game,
      g => homeworldSkillsDiscoveryClean(g) && !!g.battle && !g.battle.preparation);
  }
  assert.ok(game.battle?.revealed); return game;
}
export function settleHomeworldSkillsDiscoveryBattle(state: Game, stop: 'suk' | 'complete' = 'complete'): Game {
  return advanceHomeworldSkillsDiscovery(state, g => stop === 'suk' && g.decision?.kind === 'sukRescue' ||
    !g.battle && homeworldSkillsDiscoveryClean(g));
}
export function homeworldSkillsDiscoveryRescueChoice(game: Game, kept: 'normal' | 'elite' = 'normal'): number {
  const decision = game.decision; assert.ok(decision?.kind === 'sukRescue');
  const maximum = Math.max(...decision.options.map(o => o.normal + o.elite));
  const choice = decision.options.findIndex(o => o.normal + o.elite === maximum && o.kept?.kind === kept);
  assert.ok(choice >= 0); return choice;
}
export function homeworldSkillsDiscoverySplitReturn(game: Game, choice: number): SukReserveDestinations | undefined {
  const decision = game.decision; assert.ok(decision?.kind === 'sukRescue');
  if (!decision.reserveHomes) return undefined;
  const option = decision.options[choice], normal = option.normal - (option.kept?.kind === 'normal' ? 1 : 0),
    elite = option.elite - (option.kept?.kind === 'elite' ? 1 : 0);
  if (!normal && !elite) return undefined;
  // Explicit prototype placement interpretation, not printed revival placement:
  // return ordinary pieces to Salusa and Sardaukar to Kaitain, without moving a native saved counter.
  return Object.fromEntries(decision.reserveHomes.map(home => [home.id,
    home.secondary ? { normal, elite: 0 } : { normal: 0, elite }]));
}
