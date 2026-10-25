import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeHomeworldGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { baseDeck, ixDeck } from '../game/cards';
import { homeworldContext, homeworldGameIntegrity } from '../game/homeworld-game';
import {
  homeworldForceGroups, quoteHomeworldCustody, type HomeworldForces,
} from '../game/homeworld-custody';
import { quoteNativeReserveWithdrawal } from '../game/homeworld-native-reserves';

export type EmperorFaceDanceHomeworldStep = { actor: string; action: Action };
export type EmperorFaceDanceHomeworldComposition = 'mixed' | 'normal' | 'star';
export const emperorFaceDanceHomeworldPlayer = (game: Game, actor = 'e') => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export function emperorFaceDanceHomeworldPools(game: Game) {
  return homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!);
}
export function emperorFaceDanceHomeworldArmy(game: Game, actor: string, homeworld = 'homeworld:tleilaxu') {
  const home = emperorFaceDanceHomeworldPools(game).find(home => home.id === homeworld); assert.ok(home);
  return structuredClone(home.forces[actor] ?? { normal: 0, elite: 0 });
}
export function emperorFaceDanceHomeworldInventory(game: Game) {
  homeworldGameIntegrity(game);
  const ids = [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand)]
    .map(card => card.id).sort();
  assert.deepEqual(ids, [...baseDeck(), ...ixDeck()].map(card => card.id).sort());
  assert.equal(new Set(ids).size, ids.length, 'All original Treachery cards occupy unique physical slots');
  return ids;
}
export function emperorFaceDanceHomeworldTraitors(game: Game) {
  const ids = [...(game.traitorReserve ?? []), ...game.players.flatMap(player => [
    ...player.traitors, ...player.traitorChoices, ...(player.faceDancers ?? []).map(card => card.leader),
  ])];
  assert.equal(new Set(ids).size, ids.length, 'All original Traitor identities occupy unique physical slots');
  const discs = game.players.flatMap(player => player.leaders.map(leader => leader.id));
  assert.equal(new Set(discs).size, discs.length, 'All original leader discs occupy unique physical slots');
  return ids.sort();
}
export function emperorFaceDanceHomeworldPhysical(game: Game) {
  return {
    players: game.players.map(player => ({ id: player.id, reserves: player.reserves, tanks: player.tanks,
      forces: structuredClone(player.forces), elites: structuredClone(player.elites), spice: player.spice,
      shipped: player.shipped, moved: player.moved, battleLosses: player.battleLosses })),
    custody: structuredClone(game.homeworlds!.custody),
  };
}
export function actEmperorFaceDanceHomeworld(game: Game, actor: string, action: Action,
  actions: EmperorFaceDanceHomeworldStep[] = []): Game {
  const next = applyAction(game, actor, action); actions.push({ actor, action: structuredClone(action) }); return next;
}
/** Follow only original preparation and aftermath controls. The reveal stays caller-owned. */
export function nextEmperorFaceDanceHomeworld(game: Game): EmperorFaceDanceHomeworldStep | null {
  if (game.response) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    return { actor: actor.id, action: { type: 'passResponse' } };
  }
  if (game.phaseOpening) {
    const actor = game.players.find(player => !game.phaseOpening!.passed.includes(player.id)); assert.ok(actor);
    return { actor: actor.id, action: { type: 'ready' } };
  }
  if (game.decision?.kind === 'faceDance') return null;
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
export function advanceEmperorFaceDanceHomeworld(game: Game, until: (state: Game) => boolean,
  actions: EmperorFaceDanceHomeworldStep[] = []): Game {
  for (let count = 0; count < 160; count++) {
    if (until(game)) return game;
    const next = nextEmperorFaceDanceHomeworld(game);
    assert.ok(next, `Choose the original Face Dance or plan control at ${game.phase}/${game.decision?.kind}`);
    game = actEmperorFaceDanceHomeworld(game, next.actor, next.action, actions);
  }
  throw Error('The original Emperor visitor battle did not reach its bounded continuation');
}
/** Stop at the original battle's clean continuation. Decline may leave a new
 * optional battle against the noncombatant native, which this helper never chooses. */
export function finishEmperorFaceDanceHomeworld(game: Game, actions: EmperorFaceDanceHomeworldStep[] = []): Game {
  return advanceEmperorFaceDanceHomeworld(game,
    state => !state.battle && !state.response && !state.decision && !state.phaseOpening, actions);
}

function applyCustody(game: Game, quote: ReturnType<typeof quoteHomeworldCustody>) {
  game.homeworlds!.custody = quote.state;
  for (const update of quote.players) {
    const player = emperorFaceDanceHomeworldPlayer(game, update.id);
    player.reserves = update.reserves;
    if (player.elites) player.elites.reserves = update.eliteReserves;
  }
}
/** CONTROLLED conserved placement, not evidence of a legal invasion route. */
function placeVisitor(game: Game, actor: string, territory: string, forces: HomeworldForces) {
  const native = emperorFaceDanceHomeworldPools(game).filter(home => home.native === actor);
  const changes = native.flatMap(home => {
    const amount = home.secondary ? { normal: 0, elite: forces.elite }
      : { normal: forces.normal, elite: native.some(candidate => candidate.secondary) ? 0 : forces.elite };
    return amount.normal + amount.elite ? [{ homeworld: home.id, player: actor,
      withdraw: amount, deposit: { normal: 0, elite: 0 } }] : [];
  });
  applyCustody(game, quoteHomeworldCustody(homeworldContext(game), game.homeworlds!.custody!, [
    ...changes, { homeworld: territory, player: actor, withdraw: { normal: 0, elite: 0 }, deposit: forces },
  ]));
  emperorFaceDanceHomeworldInventory(game);
}

/** Actual original Advanced E/A/T Ix/Homeworld audit setup, then an explicitly
 * CONTROLLED later position and conserved matching physical Traitor exchange.
 * The visitor battle, original victory and pending native Face Dance are real
 * actions. This is not a native invasion programme or a new public start gate. */
export function createEmperorFaceDanceHomeworldFixture(options: {
  composition?: EmperorFaceDanceHomeworldComposition;
} = {}) {
  const composition = options.composition ?? 'mixed';
  const emperor = 'e', atreides = 'a', tleilaxu = 't', territory = 'homeworld:tleilaxu';
  const visitors: HomeworldForces = composition === 'normal' ? { normal: 3, elite: 0 }
    : composition === 'star' ? { normal: 0, elite: 3 } : { normal: 2, elite: 1 };
  const actions: EmperorFaceDanceHomeworldStep[] = [];
  let game = createGame('EMPERORFACEDANCEHOMEWORLD', newPlayer(emperor, 'Emperor', 'emperor'), true, ['ix']);
  joinGame(game, newPlayer(atreides, 'Atreides', 'atreides'));
  joinGame(game, newPlayer(tleilaxu, 'Tleilaxu', 'tleilaxu'));
  const act = (actor: string, action: Action) => { game = actEmperorFaceDanceHomeworld(game, actor, action, actions); };
  act(emperor, { type: 'homeworlds', enabled: true });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); game = initializeHomeworldGameForAudit(game);
  const setup = structuredClone(game);
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    let next: EmperorFaceDanceHomeworldStep | null = null;
    for (const player of game.players) {
      const view = viewGame(game, player.id); view.players.find(seat => seat.id === player.id)!.bot = 'Easy';
      const action = botActions(view)[0]; if (action) { next = { actor: player.id, action }; break; }
    }
    assert.ok(next, 'Original Ix/Homeworld setup requires a legal native action'); act(next.actor, next.action);
  }
  assert.equal(game.status, 'playing'); const afterSetup = structuredClone(game);
  const originalInventory = emperorFaceDanceHomeworldInventory(game);
  const originalTraitors = emperorFaceDanceHomeworldTraitors(game);
  const originalLeaders = game.players.map(player => ({ player: player.id, ids: player.leaders.map(leader => leader.id).sort() }));
  for (const player of game.players) game.deck.push(...player.hand.splice(0));
  Object.assign(game, { phase: 6, turn: 2, storm: 18, phaseOpening: null, response: null,
    decision: null, active: emperor, ready: [], order: [emperor, atreides, tleilaxu] });
  // Native T counters move to the controlled Arrakis source through the exact
  // existing withdrawal quote; its other ten native reserves remain in place.
  applyCustody(game, quoteNativeReserveWithdrawal(homeworldContext(game), game.homeworlds!.custody!,
    tleilaxu, { normal: 10, elite: 0 }));
  emperorFaceDanceHomeworldPlayer(game, tleilaxu).forces['polar_sink:0'] = 10;
  emperorFaceDanceHomeworldInventory(game);
  placeVisitor(game, emperor, territory, visitors);
  placeVisitor(game, atreides, territory, { normal: 3, elite: 0 });
  const winner = emperorFaceDanceHomeworldPlayer(game, emperor), opponent = emperorFaceDanceHomeworldPlayer(game, atreides);
  const native = emperorFaceDanceHomeworldPlayer(game, tleilaxu);
  const winnerDisc = [...winner.leaders].filter(leader => !leader.dead && !leader.usedAt)
    .sort((a, b) => b.strength - a.strength)[0];
  const loserDisc = [...opponent.leaders].filter(leader => !leader.dead && !leader.usedAt)
    .sort((a, b) => a.strength - b.strength)[0];
  assert.ok(winnerDisc && loserDisc && winnerDisc.strength > loserDisc.strength);
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
  assert.deepEqual(emperorFaceDanceHomeworldInventory(game), originalInventory);
  assert.deepEqual(emperorFaceDanceHomeworldTraitors(game), originalTraitors);
  const battleAction: Action = { type: 'chooseBattle', territory, target: atreides };
  act(emperor, battleAction); const beforePreparation = structuredClone(game);
  game = advanceEmperorFaceDanceHomeworld(game, state => !!state.battle && !state.response && !state.decision &&
    !state.phaseOpening && !state.battle.preparation && state.battle.preLeader?.closed !== false, actions);
  const beforePlans = structuredClone(game);
  const planSteps: EmperorFaceDanceHomeworldStep[] = [
    { actor: emperor, action: { type: 'battlePlan', leader: winnerLeader, dial: 0, support: 0, weapon: null, defense: null } },
    { actor: atreides, action: { type: 'battlePlan', leader: loserLeader, dial: 0, support: 0, weapon: null, defense: null } },
  ];
  for (const step of planSteps) act(step.actor, step.action);
  const revealed = structuredClone(game);
  game = advanceEmperorFaceDanceHomeworld(game, state => state.decision?.kind === 'faceDance' &&
    !state.response && !state.phaseOpening, actions);
  assert.equal(game.lastBattleContext!.winner, emperor); assert.equal(game.lastBattleContext!.result, 'normal');
  assert.equal(game.decision!.player, tleilaxu); assert.equal(game.pendingFaceDance!.identity, winnerLeader);
  assert.deepEqual(emperorFaceDanceHomeworldArmy(game, emperor), visitors);
  assert.deepEqual(emperorFaceDanceHomeworldArmy(game, tleilaxu), { normal: 10, elite: 0 });
  assert.equal(emperorFaceDanceHomeworldPlayer(game, atreides).tanks, 3);
  const faceDanceAction: Action = { type: 'decision', reveal: true, sources: { 'polar_sink:0': 3 } };
  const faceDanceZeroAction: Action = { type: 'decision', reveal: true, sources: {} };
  const faceDanceNativeAction: Action = { type: 'decision', reveal: true, sources: { reserves: 3 } };
  const faceDanceDecline: Action = { type: 'decision', reveal: false };
  const rawGame = structuredClone(game), currentPools = emperorFaceDanceHomeworldPools(game);
  return { game, rawGame, source: structuredClone(game), advanced: true as const, composition, visitors,
    emperor, atreides, opponent: atreides, tleilaxu, dancer: tleilaxu, actor: tleilaxu, winner: emperor,
    owner: tleilaxu, territory, destination: territory, winnerLeader, loserLeader,
    event: game.lastBattleContext!.event, action: faceDanceAction, faceDanceAction, faceDanceZeroAction,
    faceDanceNativeAction, faceDanceDecline, battleAction, planSteps, lobby, setup, afterSetup,
    controlled, exchange, beforePreparation, beforePlans, revealed, currentPools,
    originalInventory, originalTraitors, originalLeaders, originalPhysical: emperorFaceDanceHomeworldPhysical(game),
    originalContext: structuredClone(game.lastBattleContext), originalPendingFaceDance: structuredClone(game.pendingFaceDance),
    actions, steps: actions, publicActions: actions, sourceActionCount: actions.length,
    staging: [
      'Actual original Advanced E/A/T Ix47 Homeworld audit setup and logged legal native setup choices; the original initializer retains its existing preview/public-start boundaries.',
      'CONTROLLED conserved later phase-six position: all original dealt Treachery return to the original deck. Exact existing custody quotes move Emperor typed visitors and A3 to Tleilax; the native withdrawal quote moves T10 to Polar, leaving T10 at its home. Original other armies, typed pools, cards and discs remain physical. This is not native invasion evidence.',
      'CONTROLLED matching Face Dancer availability exchanges one original Traitor identity with its actual reserve/held slot when necessary. All original Traitors and leader discs stay unique; no reveal, victory or casualty is installed.',
      'Actual chooseBattle against the visiting Atreides, preparation/response passes, zero-dial unarmed leader plans, outcome readiness and declined Traitor votes create a normal Emperor victory and A3 Tanks. Tleilaxu is a noncombatant native: its ten native reserves and ten external counters remain untouched. Stop at the original native Face Dance; reveal remains caller-owned.',
    ],
  };
}
export type EmperorFaceDanceHomeworldFixture = ReturnType<typeof createEmperorFaceDanceHomeworldFixture>;
