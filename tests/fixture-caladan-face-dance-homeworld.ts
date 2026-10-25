import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeHomeworldGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { homeworldContext } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { positionVictoryArmy, positionVictoryInvader, victoryInventory } from './fixture-caladan-victory';

export type CaladanFaceDanceHomeworldStep = { actor: string; action: Action };
export const caladanFaceDanceHomeworldPlayer = (game: Game, actor = 'a') => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export function caladanFaceDanceHomeworldInventory(game: Game) {
  victoryInventory(game);
  return [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand)]
    .map(card => card.id).sort();
}
export function caladanFaceDanceHomeworldTraitors(game: Game) {
  const ids = [...(game.traitorReserve ?? []), ...game.players.flatMap(player => [
    ...player.traitors, ...player.traitorChoices, ...(player.faceDancers ?? []).map(card => card.leader),
  ])];
  assert.equal(new Set(ids).size, ids.length, 'Each original Traitor identity occupies one physical slot');
  return ids.sort();
}
export function caladanFaceDanceHomeworldPhysical(game: Game) {
  return {
    players: game.players.map(player => ({ id: player.id, reserves: player.reserves, tanks: player.tanks,
      forces: structuredClone(player.forces), spice: player.spice, shipped: player.shipped, moved: player.moved,
      battleLosses: player.battleLosses })),
    custody: structuredClone(game.homeworlds!.custody),
  };
}
export function caladanFaceDanceHomeworldArmy(game: Game, actor: string, homeworld = 'homeworld:tleilaxu') {
  const home = homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!)
    .find(home => home.id === homeworld); assert.ok(home);
  return home.forces[actor]?.normal ?? 0;
}
export function actCaladanFaceDanceHomeworld(game: Game, actor: string, action: Action,
  actions: CaladanFaceDanceHomeworldStep[] = []): Game {
  const next = applyAction(game, actor, action); actions.push({ actor, action: structuredClone(action) }); return next;
}
/** Original preparation and aftermath only. Both optional choices remain owned. */
export function nextCaladanFaceDanceHomeworld(game: Game): CaladanFaceDanceHomeworldStep | null {
  if (game.response) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    return { actor: actor.id, action: { type: 'passResponse' } };
  }
  if (game.phaseOpening) {
    const actor = game.players.find(player => !game.phaseOpening!.passed.includes(player.id)); assert.ok(actor);
    return { actor: actor.id, action: { type: 'ready' } };
  }
  if (game.decision?.kind === 'caladanReinforcement' || game.decision?.kind === 'faceDance') return null;
  if (game.decision?.kind === 'fullPlanOffer')
    return { actor: game.decision.player, action: { type: 'decision', decline: true } };
  if (game.decision?.kind === 'battleCards')
    return { actor: game.decision.player, action: { type: 'decision', discard: [] } };
  if (game.decision?.kind === 'battleLosses')
    return { actor: game.decision.player, action: { type: 'decision', choice: 0 } };
  const battle = game.battle;
  if (battle?.preLeader && !battle.preLeader.closed) {
    const actor = [battle.attacker, battle.defender].find(id => !battle.preLeader!.ready.includes(id)); assert.ok(actor);
    return { actor, action: { type: 'battlePreparationReady', event: battle.event } };
  }
  if (battle?.preparation) return { actor: battle.preparation.owner, action: { type: 'declineBattlePower' } };
  if (battle?.outcomeWindow && !battle.outcomeWindow.closed) {
    const actor = [battle.attacker, battle.defender].find(id => !battle.outcomeWindow!.ready.includes(id)); assert.ok(actor);
    return { actor, action: { type: 'battleOutcomeReady', event: battle.event } };
  }
  if (battle?.revealed) {
    const actor = viewGame(game, battle.attacker).battle!.traitorVoters
      .find(id => battle.traitorCalls[id] === undefined);
    if (actor) return { actor, action: { type: 'traitorCall', call: false } };
  }
  return null;
}
export function advanceCaladanFaceDanceHomeworld(game: Game, until: (state: Game) => boolean,
  actions: CaladanFaceDanceHomeworldStep[] = []): Game {
  for (let count = 0; count < 160; count++) {
    if (until(game)) return game;
    const next = nextCaladanFaceDanceHomeworld(game);
    assert.ok(next, `Choose the original Caladan, Face Dance or plan control at ${game.phase}/${game.decision?.kind}`);
    game = actCaladanFaceDanceHomeworld(game, next.actor, next.action, actions);
  }
  throw Error('The original Homeworld battle did not reach its bounded continuation');
}
/** Finish only this battle; retain the original Collection opening. */
export function finishCaladanFaceDanceHomeworld(game: Game, actions: CaladanFaceDanceHomeworldStep[] = []): Game {
  return advanceCaladanFaceDanceHomeworld(game,
    state => state.phase === 7 && !state.battle && !state.response && !state.decision, actions);
}

/** Genuine original Ix/Homeworld audit setup, then an explicitly CONTROLLED
 * conserved invasion and matching Traitor exchange. Battle and both subsequent
 * printed choices are actual actions. This is not a native invasion programme. */
export function createCaladanFaceDanceHomeworldFixture(options: { advanced?: boolean } = {}) {
  const advanced = options.advanced ?? false, atreides = 'a', tleilaxu = 't', observer = 'g';
  const territory = 'homeworld:tleilaxu', destination = territory;
  let game = createGame('CALADANFACEDANCEHOMEWORLD', newPlayer(atreides, 'Atreides', 'atreides'), advanced, ['ix']);
  joinGame(game, newPlayer(observer, 'Guild', 'guild')); joinGame(game, newPlayer(tleilaxu, 'Tleilaxu', 'tleilaxu'));
  const actions: CaladanFaceDanceHomeworldStep[] = [];
  const act = (actor: string, action: Action) => { game = actCaladanFaceDanceHomeworld(game, actor, action, actions); };
  act(atreides, { type: 'homeworlds', enabled: true });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); game = initializeHomeworldGameForAudit(game);
  const setup = structuredClone(game);
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    let next: CaladanFaceDanceHomeworldStep | null = null;
    for (const player of game.players) {
      const view = viewGame(game, player.id); view.players.find(seat => seat.id === player.id)!.bot = 'Easy';
      const action = botActions(view)[0]; if (action) { next = { actor: player.id, action }; break; }
    }
    assert.ok(next, 'Original Ix/Homeworld setup requires a legal native action'); act(next.actor, next.action);
  }
  assert.equal(game.status, 'playing'); const afterSetup = structuredClone(game);
  const originalInventory = caladanFaceDanceHomeworldInventory(game);
  const originalTraitors = caladanFaceDanceHomeworldTraitors(game);
  const originalLeaders = game.players.map(player => ({ player: player.id, ids: player.leaders.map(leader => leader.id).sort() }));
  // The same labelled seam as fixture-caladan-victory: retain original cards,
  // native discs/custody profile, but select a conserved later battle position.
  for (const player of game.players) game.deck.push(...player.hand.splice(0));
  Object.assign(game, { phase: 6, turn: 2, storm: 18, phaseOpening: null, response: null,
    decision: null, active: atreides, ready: [], order: [atreides, observer, tleilaxu] });
  positionVictoryArmy(game, atreides, 9, 0);
  positionVictoryArmy(game, observer, 20, 0);
  positionVictoryArmy(game, tleilaxu, 2, 0);
  positionVictoryInvader(game, atreides, territory, 3);
  const winner = caladanFaceDanceHomeworldPlayer(game, atreides), native = caladanFaceDanceHomeworldPlayer(game, tleilaxu);
  const winnerDisc = [...winner.leaders].filter(leader => !leader.dead && !leader.usedAt)
    .sort((a, b) => b.strength - a.strength)[0];
  const loserDisc = [...native.leaders].filter(leader => !leader.dead && !leader.usedAt)
    .sort((a, b) => a.strength - b.strength)[0]; assert.ok(winnerDisc && loserDisc && winnerDisc.strength > loserDisc.strength);
  const winnerLeader = winnerDisc.id, loserLeader = loserDisc.id;
  let exchange: { from: string; returned: string; selected: string } | null = null;
  if (!native.faceDancers!.some(card => card.leader === winnerLeader)) {
    const dancer = native.faceDancers!.find(card => !card.revealed); assert.ok(dancer);
    const returned = dancer.leader, index = game.traitorReserve!.indexOf(winnerLeader);
    if (index >= 0) {
      game.traitorReserve![index] = returned; exchange = { from: 'traitorReserve', returned, selected: winnerLeader };
    } else {
      const holder = game.players.find(player => player.traitors.includes(winnerLeader)); assert.ok(holder);
      holder.traitors[holder.traitors.indexOf(winnerLeader)] = returned;
      exchange = { from: holder.id, returned, selected: winnerLeader };
    }
    dancer.leader = winnerLeader;
  }
  const controlled = structuredClone(game);
  assert.deepEqual(caladanFaceDanceHomeworldInventory(game), originalInventory);
  assert.deepEqual(caladanFaceDanceHomeworldTraitors(game), originalTraitors);
  const battleAction: Action = { type: 'chooseBattle', territory, target: tleilaxu };
  act(atreides, battleAction); const beforePreparation = structuredClone(game);
  game = advanceCaladanFaceDanceHomeworld(game, state => !!state.battle && !state.response && !state.decision &&
    !state.phaseOpening && !state.battle.preparation && state.battle.preLeader?.closed !== false, actions);
  const beforePlans = structuredClone(game);
  const planSteps: CaladanFaceDanceHomeworldStep[] = [
    { actor: atreides, action: { type: 'battlePlan', leader: winnerLeader, dial: 0, support: 0, weapon: null, defense: null } },
    { actor: tleilaxu, action: { type: 'battlePlan', leader: loserLeader, dial: 0, support: 0, weapon: null, defense: null } },
  ];
  for (const step of planSteps) act(step.actor, step.action);
  const revealed = structuredClone(game);
  game = advanceCaladanFaceDanceHomeworld(game, state => state.decision?.kind === 'caladanReinforcement' &&
    !state.response && !state.phaseOpening, actions);
  assert.equal(game.lastBattleContext!.winner, atreides); assert.equal(game.lastBattleContext!.result, 'normal');
  assert.equal(caladanFaceDanceHomeworldPlayer(game, atreides).reserves, 6);
  assert.equal(caladanFaceDanceHomeworldArmy(game, atreides), 3);
  assert.equal(caladanFaceDanceHomeworldPlayer(game, atreides).tanks, 0);
  assert.equal(caladanFaceDanceHomeworldPlayer(game, tleilaxu).tanks, 2);
  assert.ok(game.pendingFaceDance && game.pendingFaceDance.identity === winnerLeader);
  const event = game.homeworldVictoryReinforcement!.event;
  const reinforcementAction: Action = { type: 'decision', event, destination, amount: 1 };
  const reinforcementDecline: Action = { type: 'decision', event, decline: true };
  const faceDanceAction: Action = { type: 'decision', reveal: true, sources: { 'polar_sink:0': 4 } };
  const faceDanceDecline: Action = { type: 'decision', reveal: false };
  return { game, source: structuredClone(game), advanced, atreides, winner: atreides, owner: atreides, tleilaxu,
    observer, actor: atreides, territory, destination, event, winnerLeader, loserLeader,
    action: reinforcementAction, reinforcementAction, reinforcementDecline, faceDanceAction, faceDanceDecline,
    battleAction, planSteps, lobby, setup, afterSetup, controlled, exchange, beforePreparation, beforePlans, revealed,
    originalInventory, originalTraitors, originalLeaders, originalPendingFaceDance: structuredClone(game.pendingFaceDance),
    originalPhysical: caladanFaceDanceHomeworldPhysical(game), originalContext: structuredClone(game.lastBattleContext),
    actions, steps: actions, sourceActionCount: actions.length,
    staging: [
      'Actual original A/G/Tleilaxu Ix47 Homeworld audit setup and logged native setup choices; Basic/Advanced is selected before the original initializer. This unchanged fixture-caladan-victory profile does not enable occupation-preview benefits or a new public start gate.',
      'CONTROLLED conserved later phase-six position: original dealt cards return to their original deck; A has Caladan6, three visitors on Tleilax and Polar11; Tleilaxu has native2 and Polar18; Guild has native20. The exact original custody quote moves A3 from Caladan9 to the visitor pool. No extra counter, card or disc is created.',
      'CONTROLLED matching Face Dancer availability exchanges one original Traitor identity with its actual reserve/held slot when necessary. All original Traitors/discs stay unique; no replacement or reveal status is installed.',
      'Actual chooseBattle, preparation/response passes, zero-dial unarmed native-leader plans, outcome readiness and declined Traitor votes create a normal A victory, no A ordinary casualties and Tleilaxu2 Tanks. Stop at the original Caladan choice before native Face Dance. Optional transfer and reveal remain caller-owned.',
    ],
  };
}
export type CaladanFaceDanceHomeworldFixture = ReturnType<typeof createCaladanFaceDanceHomeworldFixture>;
