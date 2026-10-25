import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game, type Plan } from '../game/engine';
import { homeworldContext } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { nativeShipmentSources } from '../game/homeworld-options';
import { DUKE_VIDAL_ID } from '../game/duke-vidal';
import { actAdvisorPreparation } from './fixture-advisor-preparation';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type HomeworldEcazDukeStep = { actor: string; action: Action };
export const actHomeworldEcazDuke = actAdvisorPreparation;
export const homeworldEcazDukePlayer = (game: Game, id: string) => {
  const player = game.players.find(player => player.id === id); assert.ok(player); return player;
};
export const homeworldEcazDukeClean = (game: Game) => !game.phaseOpening && !game.response &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard;
export function homeworldEcazDukeInventory(game: Game) {
  const ids = [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand),
    ...(game.auction?.cards.slice(game.auction.index + Number(game.currentAuctionSale?.origin === 'normal')) ?? [])]
    .map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'The original native Treachery Cards retain distinct physical slots'); return ids;
}
export const homeworldEcazDukePhysical = (game: Game) => ({ homeworlds: game.homeworlds,
  players: game.players.map(player => ({ id: player.id, spice: player.spice, bribes: player.bribes,
    forces: player.forces, elites: player.elites, reserves: player.reserves, tanks: player.tanks,
    leaders: player.leaders, shipped: player.shipped, moved: player.moved })) });

/** Resolve only native controls. Quiet unsealed Battle Plans and Duke choice
 * remain owned; a bot cannot select the newly offered grant for the source. */
export function nextHomeworldEcazDukeStep(game: Game): HomeworldEcazDukeStep | null {
  if (game.truthtrance || game.pendingTreacheryDiscard) return null;
  if (game.phaseOpening) {
    const actor = game.players.find(player => !game.phaseOpening!.passed.includes(player.id)); assert.ok(actor);
    return { actor: actor.id, action: { type: 'ready' } };
  }
  if (game.response) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    return { actor: actor.id, action: { type: 'passResponse' } };
  }
  const decision = game.decision;
  if (decision?.kind === 'ecazPlacement') return { actor: decision.player, action: { type: 'decision', decline: true } };
  if (decision?.kind === 'guildTiming') return { actor: decision.player, action: { type: 'decision', take: false } };
  if (decision?.kind === 'homeworldShipmentGuild')
    return { actor: decision.player, action: { type: 'decision', event: decision.event, allow: true } };
  if (decision?.kind === 'guildShipment') return { actor: decision.player, action: { type: 'decision', allow: true } };
  if (decision?.kind === 'auctionPayment') return { actor: decision.player, action: { type: 'decision', karama: false } };
  if (decision?.kind === 'fullPlanOffer') return { actor: decision.player, action: { type: 'decision', decline: true } };
  if (!decision && game.status === 'setup' && game.setupStage === 'forces' &&
    homeworldEcazDukePlayer(game, 'ecaz').reserves === 20)
    return { actor: 'ecaz', action: { type: 'ecazSetup', placements: { 'imperial_basin:10': 6 } } };
  if (!decision && game.battle) {
    const battle = game.battle;
    if (battle.preLeader && !battle.preLeader.closed) {
      const actor = [battle.attacker, battle.defender].find(id => !battle.preLeader!.ready.includes(id)); assert.ok(actor);
      return { actor, action: { type: 'battlePreparationReady', event: battle.preLeader.event } };
    }
    if (battle.preparation) return { actor: battle.preparation.owner, action: { type: 'declineBattlePower' } };
    if (!battle.revealed) return null;
    const voters = viewGame(game, game.host).battle!.traitorVoters;
    const voter = voters.find(id => battle.traitorCalls[id] === undefined);
    if (voter) return { actor: voter, action: { type: 'traitorCall', call: false } };
    if (battle.outcomeWindow && !battle.outcomeWindow.closed) {
      const actor = [battle.attacker, battle.defender].find(id => !battle.outcomeWindow!.ready.includes(id)); assert.ok(actor);
      return { actor, action: { type: 'battleOutcomeReady', event: battle.outcomeWindow.event } };
    }
  }
  if (!decision && game.status === 'playing') {
    if (game.phase === 0 && game.stormPending === null) {
      const actor = game.stormDialers.find(id => game.stormDials[id] === undefined);
      if (actor) return { actor, action: { type: 'stormDial', amount: game.turn === 1 ? 0 : 1 } };
    }
    if (game.phase === 3 && game.auction) return { actor: game.auction.active, action: { type: 'passBid' } };
    if (game.phase === 5) return { actor: game.active!, action: { type: 'endMovement' } };
    if ([1, 2, 4, 7, 8].includes(game.phase) || game.phase === 0 && game.stormPending !== null) {
      const actor = game.players.find(player => !game.ready.includes(player.id));
      if (actor) return { actor: actor.id, action: { type: 'ready' } };
    }
  }
  return nextStrongholdFactionsNativeStep(game);
}
export function advanceHomeworldEcazDuke(game: Game, until: (state: Game) => boolean,
  actions: HomeworldEcazDukeStep[] = []): Game {
  for (let count = 0; count < 2200; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextHomeworldEcazDukeStep(game);
    assert.ok(step, 'Choose the original Battle Plan or Duke recipient before continuing');
    game = actHomeworldEcazDuke(game, step.actor, step.action, actions);
  }
  throw Error('The genuine occupied-Ecaz chronology did not reach its finite boundary');
}
function planReady(game: Game) {
  return homeworldEcazDukeClean(game) && !!game.battle && !game.battle.preparation &&
    (!game.battle.preLeader || game.battle.preLeader.closed) && !game.battle.revealed;
}
function settleNativeBattle(game: Game, plans: Record<string, Plan>, actions: HomeworldEcazDukeStep[]) {
  assert.ok(planReady(game)); const battle = game.battle!;
  for (const actor of [battle.attacker, battle.defender])
    game = actHomeworldEcazDuke(game, actor, { type: 'battlePlan', ...plans[actor] }, actions);
  return advanceHomeworldEcazDuke(game, state => !state.battle && homeworldEcazDukeClean(state), actions);
}

/** Genuine two-turn source: paid Dune garrison, deferred real funding, native
 * worm alliance, typed invasion and a real World victory. All physical sources
 * and later Duke battle are earned; only unopened card/Spice orders are chosen. */
export function createHomeworldEcazDukeFixture(options: { advanced?: boolean; allied?: boolean } = {}) {
  const advanced = options.advanced ?? false, allied = options.allied ?? false;
  const ecaz = 'ecaz', occupier = 'emperor', guild = 'guild', opponent = 'atreides', ally = allied ? guild : null;
  let game = createGame('HOMEWORLDECAZDUKE', newPlayer(ecaz, 'Ecaz', 'ecaz'), advanced, ['ecaz']);
  for (const faction of [occupier, guild, opponent] as const) joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: HomeworldEcazDukeStep[] = [];
  const act = (actor: string, action: Action) => { game = actHomeworldEcazDuke(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceHomeworldEcazDuke(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), start = actions.length; run();
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
  };
  const enableHomeworlds = transition(() => { act(ecaz, { type: 'homeworlds', enabled: true }); });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(ecaz, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, advanced); assert.ok(game.homeworlds);
  assert.deepEqual(game.expansions, ['ecaz']);
  assert.ok(!game.nexusCards && !game.leaderSkills && !game.techTokens && !game.strongholdCards &&
    !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => !player.hand.length));
  const originalInventory = homeworldEcazDukeInventory(game); assert.equal(originalInventory.length, 33);
  const poisons = game.deck.filter(card => card.kind === 'poison' && !card.effect).slice(0, 2);
  const projectile = game.deck.find(card => card.kind === 'projectile' && !card.effect),
    snooper = game.deck.find(card => card.kind === 'snooper');
  assert.equal(poisons.length, 2); assert.ok(projectile && snooper);
  const selected = [snooper, poisons[0], poisons[1], projectile];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), selected.map(card => card.id));
  assert.equal(game.dukeVidal?.leader.id, DUKE_VIDAL_ID); assert.equal(game.dukeVidal?.leader.dead, false);
  assert.equal(game.dukeVidal?.controller, null);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder: { position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  const orderBlow = (worm: boolean, position: number) => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && (worm
      ? 'worm' in card && !card.greatMaker && !card.suppressed
      : 'territory' in card && !card.discovery));
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); spiceOrder.push({ position, from, card: structuredClone(card) });
  };
  const firstTurnBlows = advanced ? 2 : 1;
  for (let index = 0; index < firstTurnBlows; index++) orderBlow(false, index);
  orderBlow(true, firstTurnBlows);
  for (let index = 0; index < firstTurnBlows; index++) orderBlow(false, firstTurnBlows + 1 + index);
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  reach(state => state.turn === 1 && state.phase === 2 && homeworldEcazDukeClean(state));
  const funding = transition(() => { act(guild, { type: 'bribe', target: occupier, amount: 1 }); });
  assert.equal(homeworldEcazDukePlayer(funding.after, occupier).spice, homeworldEcazDukePlayer(funding.before, occupier).spice);
  assert.equal(homeworldEcazDukePlayer(funding.after, occupier).bribes, homeworldEcazDukePlayer(funding.before, occupier).bribes + 1);
  reach(state => state.turn === 1 && state.phase === 5 && state.active === occupier && homeworldEcazDukeClean(state));
  const duneShipment = transition(() => {
    const sources = nativeShipmentSources(viewGame(game, occupier), 2, 0); assert.ok(sources);
    act(occupier, { type: 'ship', territory: 'carthag', sector: 11, amount: 2, elite: 0, allyPayment: 0,
      homeworldSources: sources });
    reach(state => homeworldEcazDukeClean(state) && !state.pendingShipment);
  });
  assert.equal(homeworldEcazDukePlayer(game, occupier).forces['carthag:11'], 2);
  reach(state => state.turn === 2 && state.phase === 1 && state.nexus && !state.spiceWindow &&
    !state.spiceResolution && homeworldEcazDukeClean(state));
  const nexus = structuredClone(game);
  const alliance = transition(() => {
    if (allied) { act(occupier, { type: 'alliance', target: guild }); act(guild, { type: 'alliance', target: occupier }); }
  });
  assert.equal(homeworldEcazDukePlayer(game, occupier).ally, ally);
  const secondTerritory = allied ? 'tueks_sietch' : 'carthag', secondSector = allied ? 5 : 11;
  const recipient = ally ?? occupier, world = 'homeworld:ecaz';
  let invasion: ReturnType<typeof transition> | null = null, secondEntrant: ReturnType<typeof transition> | null = null;
  reach(state => state.turn === 2 && state.phase === 5 && homeworldEcazDukeClean(state));
  for (let count = 0; game.phase === 5 && count < 300; count++) {
    if (!homeworldEcazDukeClean(game)) {
      const step = nextHomeworldEcazDukeStep(game); assert.ok(step); act(step.actor, step.action); continue;
    }
    const actor = game.active!;
    if (actor === occupier && !homeworldEcazDukePlayer(game, actor).shipped) invasion = transition(() => {
      const sources = nativeShipmentSources(viewGame(game, actor), 4, 0); assert.ok(sources);
      const selected = Object.fromEntries(Object.entries(sources).filter(([, group]) => group.normal + group.elite > 0));
      const choice = homeworldShipmentChoice(viewGame(game, actor), world, selected);
      assert.equal(choice.blocked, null); assert.ok(choice.action);
      act(actor, choice.action); reach(state => homeworldEcazDukeClean(state) && !state.pendingHomeworldShipment);
    });
    if (actor === opponent && !homeworldEcazDukePlayer(game, actor).shipped) secondEntrant = transition(() => {
      const sources = nativeShipmentSources(viewGame(game, actor), 1, 0); assert.ok(sources);
      act(actor, { type: 'ship', territory: secondTerritory, sector: secondSector, amount: 1, elite: 0,
        allyPayment: 0, homeworldSources: sources });
      reach(state => homeworldEcazDukeClean(state) && !state.pendingShipment);
    });
    act(actor, { type: 'endMovement' });
  }
  assert.ok(invasion && secondEntrant); assert.equal(game.phase, 6);
  reach(state => homeworldEcazDukeClean(state) && !state.battle && !!state.active);
  const beforeWorldBattle = structuredClone(game), chooser = game.active!;
  const worldChoice = viewGame(game, chooser).battleChoices.find(choice => choice.territory === world); assert.ok(worldChoice);
  const worldBattle = transition(() => {
    act(chooser, { type: 'chooseBattle', territory: world, target: chooser === occupier ? ecaz : occupier });
    reach(planReady);
  });
  const emperorLeader = homeworldEcazDukePlayer(game, occupier).leaders.filter(leader => !leader.dead)
    .sort((a, b) => b.strength - a.strength)[0];
  const ecazLeader = homeworldEcazDukePlayer(game, ecaz).leaders.filter(leader => !leader.dead)
    .sort((a, b) => a.strength - b.strength)[0];
  assert.ok(emperorLeader && ecazLeader);
  const worldPlans: Record<string, Plan> = {
    [occupier]: { leader: emperorLeader.id, dial: 1, support: advanced ? 1 : 0, weapon: null, defense: null },
    [ecaz]: { leader: ecazLeader.id, dial: 0, support: 0, weapon: null, defense: null },
  };
  const worldResolution = transition(() => { game = settleNativeBattle(game, worldPlans, actions); });
  const occupied = structuredClone(game), groups = homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!);
  const ecazWorld = groups.find(group => group.id === world); assert.ok(ecazWorld);
  assert.equal((ecazWorld.forces[ecaz]?.normal ?? 0) + (ecazWorld.forces[ecaz]?.elite ?? 0), 0);
  assert.equal(ecazWorld.forces[occupier]?.normal, 3); assert.equal(ecazWorld.forces[occupier]?.elite, 0);
  const qualification = game.homeworldOccupationHistory!.qualifications.find(record =>
    record.world === world && record.player === occupier && record.turn === game.turn); assert.ok(qualification);
  assert.equal(qualification.cause, 'sole'); assert.equal(game.dukeVidal?.leader.dead, false);
  if (!allied) assert.equal(game.dukeVidal?.controller, occupier);
  else assert.equal(game.dukeVidal?.controller, null);
  reach(state => homeworldEcazDukeClean(state) && !state.battle && !!state.active &&
    viewGame(state, state.active).battleChoices.some(choice => choice.territory === secondTerritory));
  const secondBattle = transition(() => {
    const actor = game.active!;
    act(actor, { type: 'chooseBattle', territory: secondTerritory, target: actor === recipient ? opponent : recipient });
    reach(planReady);
  });
  assert.ok(game.battle && [game.battle.attacker, game.battle.defender].includes(recipient));
  assert.deepEqual(game.battle.plans, {}); assert.equal(game.battle.revealed, false);
  assert.deepEqual(homeworldEcazDukeInventory(game), originalInventory);
  return { game, beforePower: structuredClone(game), advanced, allied, occupier, ally, ecaz, guild, opponent,
    recipient, dukeId: DUKE_VIDAL_ID, world, secondTerritory, secondSector,
    secondLocation: `${secondTerritory}:${secondSector}`,
    poison: { [occupier]: poisons[0].id, [guild]: poisons[1].id }, projectile: projectile.id,
    initial, enableHomeworlds, lobby, setup, beforeStartingDeal, afterSetup, dealOrder, originalInventory,
    inventory: originalInventory, originalSpice, spiceOrder, funding, duneShipment, nexus, alliance,
    invasion, secondEntrant, beforeWorldBattle, worldBattle, worldPlans, worldResolution, occupied,
    qualification: structuredClone(qualification), secondBattle,
    actions, sourceActions: actions, sourceActionCount: actions.length,
    staging: [
      'Actual public Basic or Advanced preview Ecaz/E/G/A enables only Homeworlds, readies and starts. Only original unopened four-card/Spice positions and original scalar lotteries are selected; all33 physical cards and native pools remain.',
      'Native Ecaz setup places Basin6. G really bribes E one, deferred to Mentat; E really pays to ship two native counters to empty Carthag. Native Storm, auctions, Collection and Mentat run before the actual turn2 worm Nexus.',
      allied ? 'E and G actually form their reciprocal alliance during that real Nexus; no alliance field is installed.'
        : 'The real Nexus is completed without an alliance; the later single eligible Duke recipient needs no manual confirmation.',
      'E submits a real owner-view typed four-normal invasion of Ecaz World. A separately pays to ship one native counter into the existing E Carthag group or G Tueks group, preserving a real second battle. Native Guild decisions and payments complete normally.',
      'The real World battle uses E native leader5/dial1 (one paid support in Advanced) against Ecaz native leader2/dial0 and its native World bonus. Actual loss/cleanup leaves three E visitors alone, zero Ecaz natives, and the living shared Duke. No force, wallet, custody, leader, clock or occupation receipt is installed.',
      'Stop at the actual next unsealed native Arrakis battle. Unallied source already receives the real automatic self-grant; allied source retains both actual recipient choices before either plan seals.',
    ],
  };
}
export type HomeworldEcazDukeFixture = ReturnType<typeof createHomeworldEcazDukeFixture>;

/** Actual one-battle use, with optional real opposing projectile/own poison
 * killing both leaders. No result, death or shared-disc state is assigned. */
export function playHomeworldEcazDukeBattle(f: HomeworldEcazDukeFixture, source: Game,
  options: { killDuke?: boolean } = {}) {
  let game = source; const actions: HomeworldEcazDukeStep[] = [];
  assert.equal(game.dukeVidal?.controller, f.recipient); assert.ok(planReady(game));
  const opponentLeader = homeworldEcazDukePlayer(game, f.opponent).leaders.filter(leader => !leader.dead && !leader.usedAt)
    .sort((a, b) => a.strength - b.strength)[0]; assert.ok(opponentLeader);
  const plans: Record<string, Plan> = {
    [f.recipient]: { leader: DUKE_VIDAL_ID, dial: 1, support: f.advanced ? 1 : 0,
      weapon: options.killDuke ? f.poison[f.recipient as keyof typeof f.poison] : null, defense: null },
    [f.opponent]: { leader: opponentLeader.id, dial: 0, support: 0,
      weapon: options.killDuke ? f.projectile : null, defense: null },
  };
  const before = structuredClone(game); game = settleNativeBattle(game, plans, actions);
  return { game, before, plans, actions };
}
