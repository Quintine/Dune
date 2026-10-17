import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { TERRITORIES } from '../game/board';
import { combatArmy } from '../game/combat-location';
import { nativeShipmentSources } from '../game/homeworld-options';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { homeworldGameIntegrity } from '../game/homeworld-game';
import { drawClassicNexusReaction, reactionAction, reactionPlayer } from './fixture-classic-independent-nexus-reactions';
import { advanceClassicIndependentNexus, type ClassicIndependentNexusStep } from './fixture-classic-independent-nexus';
import { classicDiscoveryNexusClean, nextClassicDiscoveryNexusStep } from './fixture-discovery-classic-nexus';

export type WorldNexusBattleStep = ClassicIndependentNexusStep;
export type WorldNexusBattleOptions = { advanced?: boolean; skills?: boolean; tech?: boolean; strongholds?: boolean };
type WorldNexusInvasion = { before: Game; action: Action; cost: number; after: Game };
export const worldNexusClean = (game: Game) => classicDiscoveryNexusClean(game) &&
  !game.pendingGuildBetrayal && !game.pendingNexusHarkonnenBetrayal && !game.pendingNexusIxianBetrayal;
export { reactionPlayer as worldNexusPlayer };

/** Continue only existing public controls. Human sealed plans are never invented.
 * The named trained disc is concealed through the actual visibility choice. */
export function advanceWorldNexusBattle(game: Game, until: (game: Game) => boolean,
  actions: WorldNexusBattleStep[] = [], trained: readonly string[] = []): Game {
  for (let count = 0; count < 1200; count++) {
    if (until(game)) return game;
    if (game.pendingGuildBetrayal) {
      game = advanceClassicIndependentNexus(game, state => !state.pendingGuildBetrayal, actions);
      continue;
    }
    const step = nextClassicDiscoveryNexusStep(game);
    if (step?.action.type === 'leaderSkillVisibility') step.action.hide = trained.includes(step.actor);
    if (step) game = reactionAction(game, step.actor, step.action, actions);
    else game = advanceClassicIndependentNexus(game, until, actions);
  }
  throw Error('Original World Nexus battle did not reach its owned boundary');
}

function chooseWorldBattle(game: Game, location: string, actions: WorldNexusBattleStep[], trained: readonly string[]) {
  const choice = viewGame(game, game.active!).battleChoices.find(battle => battle.territory === location);
  assert.ok(choice, 'The paid invasion must produce its actual World battle');
  game = reactionAction(game, choice.chooser, { type: 'chooseBattle', territory: location,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker }, actions);
  return advanceWorldNexusBattle(game, state => !!state.battle && !state.battle.revealed &&
    !state.battle.preparation && state.battle.preLeader?.closed !== false && worldNexusClean(state), actions, trained);
}

function invade(game: Game, actor: string, location: string, amount: number, actions: WorldNexusBattleStep[]): WorldNexusInvasion {
  const before = structuredClone(game), view = viewGame(game, actor);
  const sources = nativeShipmentSources(view, amount, 0); assert.ok(sources);
  const quote = homeworldShipmentChoice(view, location,
    Object.fromEntries(Object.entries(sources).filter(([, force]) => force.normal + force.elite > 0)));
  assert.ok(quote.action, quote.blocked ?? 'Use the original paid native invasion');
  game = reactionAction(game, actor, quote.action, actions);
  game = advanceWorldNexusBattle(game, state => !state.pendingHomeworldShipment && worldNexusClean(state), actions);
  return { before, action: quote.action, cost: quote.cost, after: game };
}

/** Genuine closing draw, paid Guild invasion and Emperor's legal inter-World
 * movement leave seven ordinary Kaitain counters. The optional low Salusa
 * route exports four actual stars to an empty desert, never converts them. */
export function createWorldNexusEmperorBattle(options: WorldNexusBattleOptions & { salusa?: 'high' | 'low' } = {}) {
  const fixture = drawClassicNexusReaction('emperor', 'emperor', { ...options, advanced: true,
    independent: false, homeworlds: true, roster: ['atreides', 'guild', 'emperor'],
    training: options.skills ? { emperor: 'planetologist', atreides: 'warmaster', guild: 'sandmaster' } : undefined });
  const actions = fixture.actions, location = 'homeworld:emperor', trained = options.skills ? ['emperor'] : [];
  let game = advanceWorldNexusBattle(fixture.game, state => state.phase === 5 && worldNexusClean(state), actions);
  let arrival: WorldNexusInvasion | undefined;
  let moved = false, exported = false;
  while (game.phase === 5) {
    const actor = game.active!;
    if (worldNexusClean(game) && actor === 'guild' && !reactionPlayer(game, actor).shipped) {
      arrival = invade(game, actor, location, 3, actions); game = arrival.after;
    } else if (worldNexusClean(game) && actor === 'emperor' && !moved) {
      if (options.salusa === 'low' && !exported) {
        const desert = TERRITORIES.find(territory => territory.type === 'sand' && !territory.sectors.includes(game.storm) &&
          !game.players.some(player => Object.keys(player.forces).some(key => key.startsWith(`${territory.id}:`))));
        assert.ok(desert);
        const sources = nativeShipmentSources(viewGame(game, actor), 4, 4); assert.ok(sources);
        game = reactionAction(game, actor, { type: 'ship', territory: desert.id, sector: desert.sectors[0],
          amount: 4, elite: 4, homeworldSources: sources, allyPayment: 0 }, actions);
        exported = true;
        game = advanceWorldNexusBattle(game, worldNexusClean, actions);
      } else {
        const movement = viewGame(game, actor).homeworldMove; assert.ok(movement && !movement.blocked);
        game = reactionAction(game, actor, { type: 'emperorHomeworldMove', event: movement.event,
          origin: location, normal: 8, elite: 0 }, actions);
        moved = true;
      }
    } else {
      const step = nextClassicDiscoveryNexusStep(game); assert.ok(step);
      game = reactionAction(game, step.actor, step.action, actions);
    }
  }
  assert.ok(arrival && moved);
  game = advanceWorldNexusBattle(game, state => state.phase === 6 && worldNexusClean(state), actions);
  const beforeBattle = structuredClone(game);
  game = chooseWorldBattle(game, location, actions, trained);
  const leaders = reactionPlayer(game, 'emperor').leaders.filter(leader => !leader.dead && !leader.usedAt);
  const trainer = game.leaderSkills?.assignments.find(assignment => assignment.owner === 'emperor');
  const leader = trainer ? leaders.find(leader => leader.id === trainer.leader)! : leaders.at(-1)!;
  const opponentLeader = reactionPlayer(game, 'guild').leaders.filter(leader => !leader.dead && !leader.usedAt)
    .sort((a, b) => a.strength - b.strength)[0];
  assert.ok(leader && opponentLeader);
  assert.deepEqual(combatArmy(game, 'emperor', location), { normal: 7, elite: 0 });
  homeworldGameIntegrity(game);
  const plans: WorldNexusBattleStep[] = [
    { actor: 'emperor', action: { type: 'battlePlan', dial: 4, support: options.salusa === 'low' ? 2 : 0, leader: leader.id } },
    { actor: 'guild', action: { type: 'battlePlan', dial: 0, support: 0, leader: opponentLeader.id } },
  ];
  return { ...fixture, game, beforeBattle, arrival, location, plans, trainer, leader: leader.id };
}

/** The original Harkonnen native pool defends Giedi Prime. Its actual offered
 * Atreides Traitor is chosen as the invader's disc; only Harkonnen receives an
 * ordinary call, while the invader owns the independently drawn cancel card. */
export function createWorldNexusHarkonnenBattle(options: WorldNexusBattleOptions = {}) {
  const fixture = drawClassicNexusReaction('harkonnen', 'atreides', { ...options,
    independent: false, homeworlds: true, roster: ['atreides', 'harkonnen', 'guild'],
    training: options.skills ? { harkonnen: 'planetologist', atreides: 'warmaster', guild: 'sandmaster' } : undefined });
  const actions = fixture.actions, location = 'homeworld:harkonnen';
  let game = advanceWorldNexusBattle(fixture.game, state => state.phase === 5 && state.active === 'atreides' &&
    worldNexusClean(state), actions);
  const identity = reactionPlayer(game, 'atreides').leaders.find(leader => reactionPlayer(game, 'harkonnen').traitors.includes(leader.id))?.id;
  assert.ok(identity, 'Use an actually offered native Traitor identity');
  const arrival = invade(game, 'atreides', location, 1, actions); game = arrival.after;
  game = advanceWorldNexusBattle(game, state => state.phase === 6 && worldNexusClean(state), actions);
  const beforeBattle = structuredClone(game), trained = options.skills ? ['harkonnen'] : [];
  game = chooseWorldBattle(game, location, actions, trained);
  const trainer = game.leaderSkills?.assignments.find(assignment => assignment.owner === 'harkonnen');
  const leader = trainer ? reactionPlayer(game, 'harkonnen').leaders.find(leader => leader.id === trainer.leader)!
    : reactionPlayer(game, 'harkonnen').leaders.toSorted((a, b) => b.strength - a.strength)[0];
  const plans: WorldNexusBattleStep[] = [
    { actor: 'atreides', action: { type: 'battlePlan', dial: 0, support: 0, leader: identity } },
    { actor: 'harkonnen', action: { type: 'battlePlan', dial: 0, support: 0, leader: leader.id } },
  ];
  homeworldGameIntegrity(game);
  return { ...fixture, game, beforeBattle, arrival, location, identity, plans, trainer, leader: leader.id };
}

export function revealWorldNexusPlans(game: Game, plans: readonly WorldNexusBattleStep[], actions: WorldNexusBattleStep[] = []) {
  for (const plan of plans) {
    game = reactionAction(game, plan.actor, plan.action, actions);
    game = advanceWorldNexusBattle(game, state => worldNexusClean(state) && !!state.battle &&
      !state.battle.preparation && state.battle.preLeader?.closed !== false, actions);
  }
  assert.ok(game.battle?.revealed);
  return game;
}
