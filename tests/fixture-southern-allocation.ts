import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { homeworldContext, homeworldGameIntegrity } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { nativeShipmentSources } from '../game/homeworld-options';
import { actTruthMovement, type TruthMovementStep } from './fixture-truth-movement';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type SouthernAllocationStep = TruthMovementStep;
export const southernPlayer = (game: Game, actor = 'fremen') => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const southernReload = (game: Game): Game => JSON.parse(JSON.stringify(game)) as Game;
export const actSouthernAllocation = actTruthMovement;
export const southernAllocationClean = (game: Game) => !game.response && !game.phaseOpening &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingRevival;

/** Count physical live slots, never historical references to those cards. */
export function southernAllocationInventory(game: Game) {
  homeworldGameIntegrity(game);
  const worlds = homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!);
  const sum = (counts: Record<string, number>) => Object.values(counts).reduce((a, b) => a + b, 0);
  for (const player of game.players) {
    const visitors = worlds.filter(world => world.native !== player.id)
      .map(world => world.forces[player.id] ?? { normal: 0, elite: 0 });
    assert.equal(player.reserves + player.tanks + sum(player.forces) +
      visitors.reduce((total, group) => total + group.normal + group.elite, 0), 20, player.faction);
    if (player.elites) assert.equal(player.elites.reserves + player.elites.tanks + sum(player.elites.forces) +
      visitors.reduce((total, group) => total + group.elite, 0), player.faction === 'emperor' ? 5 : 3);
  }
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand),
    ...(game.auction?.cards.slice(game.auction.index + (game.currentAuctionSale ? 1 : 0)) ?? [])]
    .map(card => card.id).sort();
  const traitors = [...(game.traitorReserve ?? []), ...game.players.flatMap(player =>
    [...player.traitors, ...player.traitorChoices, ...(player.faceDancers ?? []).map(card => card.leader)])].sort();
  const spice = [...game.spiceDeck, ...game.spiceDiscard.flat()].map(card => JSON.stringify(card)).sort();
  assert.equal(new Set(cards).size, cards.length);
  assert.equal(new Set(traitors).size, traitors.length);
  return { cards, traitors, spice };
}

/** Native controls only. Stop at an owned allocation or unsealed human plan. */
export function nextSouthernAllocationStep(game: Game): SouthernAllocationStep | null {
  if (game.decision?.kind === 'homeworldRevivalDeployment') return null;
  if (!game.response && !game.phaseOpening) {
    if (game.status === 'setup' && game.setupStage === 'forces' && southernPlayer(game).reserves === 20)
      return { actor: 'fremen', action: { type: 'fremenSetup',
        placements: { 'sietch_tabr:14': 4, 'false_wall_south:5': 3, 'false_wall_west:18': 3 },
        elitePlacements: { 'sietch_tabr:14': 3 } } };
    if (game.decision?.kind === 'ecazPlacement')
      return { actor: game.decision.player, action: { type: 'decision', decline: true } };
    if (game.decision?.kind === 'ecazAmbassador')
      return { actor: game.decision.player, action: { type: 'decision', event: game.pendingAmbassador!.event, decline: true } };
    if (game.decision?.kind === 'revivalStop')
      return { actor: game.decision.player, action: { type: 'decision', decline: true } };
    if (game.decision?.kind === 'faceDance')
      return { actor: game.decision.player, action: { type: 'decision', reveal: false } };
    if (game.decision?.kind === 'wormRide' || game.decision?.kind === 'wormPlacement')
      return { actor: game.decision.player, action: { type: 'decision', accept: false } };
  }
  return nextStrongholdFactionsNativeStep(game);
}
export function advanceSouthernAllocation(game: Game, until: (state: Game) => boolean,
  actions: SouthernAllocationStep[] = []): Game {
  for (let count = 0; count < 1000; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Southern chronology ended before its requested choice');
    const step = nextSouthernAllocationStep(game);
    assert.ok(step, `Choose the original allocation or Battle Plans at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actSouthernAllocation(game, step.actor, step.action, actions);
  }
  throw Error('The finite original Southern chronology did not reach its requested boundary');
}

/** Genuine bare Basic Homeworld source. Original public setup distributes the
 * three actual stars; a paid Emperor invasion and chosen native casualties put
 * two or three in the Tanks. The next ordinary free revival is still unplayed.
 * Only original scalar lotteries and unopened non-worm Spice order are chosen.
 * No played hand, purse, army, Tank, phase, population or receipt is installed.
 */
export function createSouthernAllocationFixture(options: { stars?: 2 | 3; third?: 'tleilaxu' | 'ecaz' } = {}) {
  const stars = options.stars ?? 3;
  let game = createGame('SOUTHERNALLOCATION', newPlayer('fremen', 'Fremen', 'fremen'), false,
    options.third === 'tleilaxu' ? ['ix'] : options.third === 'ecaz' ? ['ecaz'] : []);
  joinGame(game, newPlayer('emperor', 'Emperor', 'emperor'));
  if (options.third) joinGame(game, newPlayer(options.third, options.third, options.third));
  const initial = structuredClone(game), actions: SouthernAllocationStep[] = [];
  const act = (actor: string, action: Action) => { game = actSouthernAllocation(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSouthernAllocation(game, until, actions); };
  act(game.host, { type: 'homeworlds', enabled: true });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, false);
  assert.ok(game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), setupSteps = structuredClone(actions);
  const original = southernAllocationInventory(game);
  assert.equal(southernPlayer(game).reserves, 10);
  assert.deepEqual(southernPlayer(game).elites?.forces, { 'sietch_tabr:14': 3 });
  assert.equal(game.storm, 1);
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card &&
      !card.discovery && !['sietch_tabr', 'false_wall_south', 'false_wall_west'].includes(card.territory));
    assert.ok(from >= position); const [card] = game.spiceDeck.splice(from, 1);
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  // This optional original token will first be declined on the Emperor's entry,
  // then provide a genuine phase-four arrival interruption after revival.
  if (options.third === 'ecaz') {
    reach(state => state.turn === 1 && state.decision?.kind === 'ecazPlacement');
    const token = game.ecazAmbassadors!.tokens.find(token => token.effect === 'ecaz' && token.zone === 'supply');
    assert.ok(token);
    act('ecaz', { type: 'decision', token: token.id, territory: 'sietch_tabr' });
  }
  reach(state => state.turn === 1 && state.phase === 5 && state.active === 'emperor' && southernAllocationClean(state));
  const beforeShipment = structuredClone(game), sources = nativeShipmentSources(viewGame(game, 'emperor'), 1, 0);
  assert.ok(sources);
  // Homeworld shipment quotes govern World destinations. Tabr uses the
  // ordinary Arrakis shipment with the exact original native reserve sources.
  const shipmentStep: SouthernAllocationStep = { actor: 'emperor', action: {
    type: 'ship', territory: 'sietch_tabr', sector: 14, amount: 1, elite: 0,
    allyPayment: 0, homeworldSources: sources,
  } };
  act(shipmentStep.actor, shipmentStep.action);
  const shipmentCost = southernPlayer(beforeShipment, 'emperor').spice - southernPlayer(game, 'emperor').spice;
  assert.equal(shipmentCost, 1);
  reach(state => state.turn === 1 && state.phase === 6 && !!state.active && southernAllocationClean(state));
  const beforeBattle = structuredClone(game);
  const choice = viewGame(game, game.active!).battleChoices.find(choice => choice.territory === 'sietch_tabr'); assert.ok(choice);
  act(choice.chooser, { type: 'chooseBattle', territory: 'sietch_tabr',
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker });
  reach(state => !!state.battle && !state.battle.preparation && state.battle.preLeader?.closed !== false && southernAllocationClean(state));
  const fremenLeader = southernPlayer(game).leaders.filter(leader => !leader.dead && !leader.usedAt)
    .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))[0];
  const emperorLeader = southernPlayer(game, 'emperor').leaders.filter(leader => !leader.dead && !leader.usedAt)
    .sort((a, b) => a.strength - b.strength || a.id.localeCompare(b.id))[0];
  assert.ok(fremenLeader && emperorLeader, 'Both original factions retain an eligible native leader');
  assert.ok(stars + fremenLeader.strength > emperorLeader.strength,
    'The actual no-card native plans leave Fremen victorious before its chosen starred casualties');
  const plans: SouthernAllocationStep[] = [
    { actor: 'fremen', action: { type: 'battlePlan', dial: stars, support: 0,
      leader: fremenLeader.id } },
    { actor: 'emperor', action: { type: 'battlePlan', dial: 0, support: 0,
      leader: emperorLeader.id } },
  ];
  for (const step of plans) act(step.actor, step.action);
  reach(state => state.decision?.kind === 'battleLosses');
  const losses = game.decision;
  assert.ok(losses?.kind === 'battleLosses');
  const lossChoice = losses.options.findIndex(loss => loss.normal === 0 && loss.elite === stars); assert.ok(lossChoice >= 0);
  act('fremen', { type: 'decision', choice: lossChoice });
  reach(state => !state.battle && southernAllocationClean(state));
  const afterBattle = structuredClone(game), battleSteps = structuredClone(actions.slice(setupSteps.length));
  assert.equal(southernPlayer(game).tanks, stars); assert.equal(southernPlayer(game).elites?.tanks, stars);
  assert.equal(southernPlayer(game).forces['sietch_tabr:14'], 4 - stars);
  assert.equal(southernPlayer(game, 'emperor').tanks, 1);
  reach(state => state.turn === 2 && state.phase === 4 && southernAllocationClean(state));
  assert.equal(game.storm, 3, 'Actual Basic second Storm is one plus one, outside every original Fremen group');
  assert.equal(southernPlayer(game).tanks, stars);
  assert.equal(southernPlayer(game).elites?.tanks, stars);
  assert.equal(southernPlayer(game).reserves, 10);
  assert.equal(southernPlayer(game).forces['false_wall_south:5'], 3);
  assert.equal(southernPlayer(game).forces['false_wall_west:18'], 3);
  assert.deepEqual(southernAllocationInventory(game), original);
  const revivalAction: Action = { type: 'revive', amount: stars, elite: stars };
  return { initial, lobby, setup, afterSetup, beforeShipment, shipmentStep, shipmentCost,
    beforeBattle, plans, afterBattle, game, stars, third: options.third, actions, setupSteps, battleSteps,
    spiceOrder, original, revivalAction,
    sourceCounts: { setup: setupSteps.length, throughBattle: setupSteps.length + battleSteps.length, source: actions.length },
    sourceDisclosure: 'Actual Basic Fremen/Emperor Homeworld setup; paid one-force Emperor invasion; native no-card battle and exact starred casualties; actual next Storm1+1 and phase-four return opportunity. Only original scalar lotteries and unopened Spice order selected.' };
}

export function openSouthernAllocation(fixture: ReturnType<typeof createSouthernAllocationFixture>,
  actions: SouthernAllocationStep[] = []): Game {
  let game = actSouthernAllocation(southernReload(fixture.game), 'fremen', fixture.revivalAction, actions);
  game = advanceSouthernAllocation(game, state => state.decision?.kind === 'homeworldRevivalDeployment', actions);
  assert.equal(viewGame(game, 'fremen').homeworldRevivalDeployment?.elite, fixture.stars);
  return game;
}
export function southernAllocationAction(game: Game, destination: string, amount: number): Action {
  const offer = viewGame(game, 'fremen').homeworldRevivalDeployment; assert.ok(offer);
  assert.ok(offer.destinations.some(option => option.id === destination && !option.blocked));
  return { type: 'decision', event: offer.event, destination, amount };
}
export function settleSouthernAllocation(game: Game, actions: SouthernAllocationStep[] = []): Game {
  return advanceSouthernAllocation(game, state => state.decision?.kind === 'homeworldRevivalDeployment' ||
    (state.homeworldRevivalReturn?.stage === 'complete' && !state.response && !state.pendingAmbassador), actions);
}
