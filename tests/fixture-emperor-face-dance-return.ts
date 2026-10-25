import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { traitorDeck } from '../game/traitors';
import { homeworldContext } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { nativeShipmentSources } from '../game/homeworld-options';
import {
  actAdvisorFaceDanceFlip, advisorFaceDanceFlipClean, advisorFaceDanceFlipInventory,
  advisorFaceDanceFlipTraitors, nextAdvisorFaceDanceFlip,
} from './fixture-advisor-face-dance-flip';

export type EmperorFaceDanceReturnStep = { actor: string; action: Action };
export const actEmperorFaceDanceReturn = actAdvisorFaceDanceFlip;
export const emperorFaceDanceReturnClean = advisorFaceDanceFlipClean;
export function emperorFaceDanceReturnPlayer(game: Game, id: string) {
  const player = game.players.find(candidate => candidate.id === id);
  assert.ok(player, `The original ${id} seat must remain present`);
  return player;
}
export function emperorFaceDanceReturnInventory(game: Game) {
  return { treachery: advisorFaceDanceFlipInventory(game), traitors: advisorFaceDanceFlipTraitors(game) };
}
/** Exact public native pools, including the physical secondary Salusa holding. */
export function emperorFaceDanceReturnHomes(game: Game) {
  assert.ok(game.homeworlds?.custody);
  return Object.fromEntries(homeworldForceGroups(homeworldContext(game), game.homeworlds.custody)
    .map(home => [home.id, structuredClone(home.forces[home.native])])) as
      Record<string, { normal: number; elite: number }>;
}
export function emperorFaceDanceReturnPhysical(game: Game) {
  return { homes: emperorFaceDanceReturnHomes(game), custody: structuredClone(game.homeworlds!.custody),
    players: game.players.map(player => ({ id: player.id, reserves: player.reserves, tanks: player.tanks,
      forces: structuredClone(player.forces), elites: structuredClone(player.elites),
      battleLosses: player.battleLosses, leaders: structuredClone(player.leaders) })) };
}
export function nextEmperorFaceDanceReturnStep(game: Game): EmperorFaceDanceReturnStep | null {
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard) {
    if (game.decision?.kind === 'faceDance') return null;
    if (game.status === 'setup' && game.setupStage === 'traitors') {
      const player = game.players.find(candidate => candidate.traitorChoices.length);
      assert.ok(player);
      const leader = player.traitorChoices.find(identity => identity !== 'emperor-0');
      assert.ok(leader, 'A real alternative Traitor choice must preserve the original Emperor Face Dancer');
      return { actor: player.id, action: { type: 'traitor', leader } };
    }
    if (game.decision?.kind === 'battleLosses') {
      const choice = game.decision.options.findIndex(option => option.normal === 1 && option.elite === 0);
      assert.ok(choice >= 0, 'Use the original paid normal casualty rather than spending a Sardaukar');
      return { actor: game.decision.player, action: { type: 'decision', choice } };
    }
  }
  return nextAdvisorFaceDanceFlip(game);
}
export function advanceEmperorFaceDanceReturn(game: Game, until: (state: Game) => boolean,
  actions: EmperorFaceDanceReturnStep[] = []): Game {
  for (let count = 0; count < 1400; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Emperor/Face Dance chronology ended before its owned boundary');
    const step = nextEmperorFaceDanceReturnStep(game);
    assert.ok(step, `Choose the real ${game.turn}/${game.phase}/${game.decision?.kind}/${game.battle?.preparation?.kind} before continuing`);
    game = actEmperorFaceDanceReturn(game, step.actor, step.action, actions);
  }
  throw Error('The native Emperor/Face Dance source did not reach its finite boundary');
}

/** Select only the real first Face Dancer permutation in the final native
 * Traitor choice. No held card, played identity or revealed flag is assigned. */
function originalEmperorFaceDancerDeal(game: Game, step: EmperorFaceDanceReturnStep,
  actions: EmperorFaceDanceReturnStep[]) {
  assert.equal(game.setupStage, 'traitors'); assert.equal(step.action.type, 'traitor');
  assert.equal(game.players.filter(player => player.traitorChoices.length > 0).length, 1);
  assert.ok(game.players.every(player => !player.faceDancers));
  const held = new Set([...game.players.flatMap(player => player.traitors), String(step.action.leader)]);
  const original = traitorDeck(game.players, true).filter(identity => !held.has(identity));
  assert.ok(original.includes('emperor-0'));
  const first = ['emperor-0', ...original.filter(identity => identity !== 'emperor-0').slice(0, 2)];
  const order = [...first, ...original.filter(identity => !first.includes(identity))];
  const current = [...original], scalars: number[] = [];
  for (let index = current.length - 1; index > 0; index--) {
    const from = current.indexOf(order[index]); assert.ok(from >= 0 && from <= index);
    scalars.push(Math.floor((from + 0.5) * 4294967296 / (index + 1)));
    [current[index], current[from]] = [current[from], current[index]];
  }
  assert.deepEqual(current, order);
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto); let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) {
      assert.ok(cursor < scalars.length, 'Only the original Face Dancer shuffle consumes these selected scalars');
      array[0] = scalars[cursor++];
    } else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try {
    const next = applyAction(game, step.actor, step.action);
    assert.equal(cursor, scalars.length);
    actions.push(structuredClone(step));
    return { game: next, original, order, scalars, step: structuredClone(step) };
  } finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Public original Advanced E/T/A + Ix/Homeworlds. Native shipment withdraws
 * exact Kaitain/Salusa types; actual unarmed plans and normal casualties earn
 * the original private Face Dance offer. Only unopened positions/scalars vary. */
export function createEmperorFaceDanceReturnFixture(options: { army?: 'mixed' | 'normal' | 'elite' } = {}) {
  const army = options.army ?? 'mixed', emperor = 'e', tleilaxu = 't', opponent = 'a';
  const normal = army === 'elite' ? 0 : 3, elite = army === 'normal' ? 0 : 2;
  const dial = normal ? 1 : 0, support = dial, amount = normal + elite;
  const territory = 'arrakeen', sector = 10, location = `${territory}:${sector}`;
  let game = createGame('EMPERORFACEDANCERETURN', newPlayer(emperor, 'Emperor', 'emperor'), true, ['ix']);
  joinGame(game, newPlayer(tleilaxu, 'Tleilaxu', 'tleilaxu'));
  joinGame(game, newPlayer(opponent, 'Atreides', 'atreides'));
  const actions: EmperorFaceDanceReturnStep[] = [];
  const act = (actor: string, action: Action) => { game = actEmperorFaceDanceReturn(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceEmperorFaceDanceReturn(game, until, actions); };
  act(game.host, { type: 'homeworlds', enabled: true });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const initial = structuredClone(game); act(game.host, { type: 'start', advancedPreview: true });
  const setup = structuredClone(game), originalInventory = emperorFaceDanceReturnInventory(game);
  let faceDancerDeal: ReturnType<typeof originalEmperorFaceDancerDeal> | null = null;
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    const step = nextEmperorFaceDanceReturnStep(game); assert.ok(step);
    if (game.setupStage === 'traitors' && step.action.type === 'traitor' &&
        game.players.filter(player => player.traitorChoices.length > 0).length === 1) {
      faceDancerDeal = originalEmperorFaceDancerDeal(game, step, actions); game = faceDancerDeal.game;
    } else act(step.actor, step.action);
  }
  assert.equal(game.status, 'playing'); assert.ok(faceDancerDeal);
  const afterSetup = structuredClone(game), initialHomes = emperorFaceDanceReturnHomes(game);
  assert.deepEqual(initialHomes['homeworld:emperor'], { normal: 15, elite: 0 });
  assert.deepEqual(initialHomes['homeworld:emperor:salusa'], { normal: 0, elite: 5 });
  assert.equal(emperorFaceDanceReturnPlayer(game, opponent).forces[location], 10);
  assert.ok(emperorFaceDanceReturnPlayer(game, tleilaxu).faceDancers!.some(card => card.leader === 'emperor-0' && !card.revealed));
  assert.deepEqual(emperorFaceDanceReturnInventory(game), originalInventory);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position);
    const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  reach(state => state.phase === 5 && state.active === emperor && emperorFaceDanceReturnClean(state));
  const homeworldSources = nativeShipmentSources(viewGame(game, emperor), amount, elite);
  assert.ok(homeworldSources);
  const beforeShipment = structuredClone(game), shipmentStep: EmperorFaceDanceReturnStep = { actor: emperor,
    action: { type: 'ship', territory, sector, amount, elite, allyPayment: 0, homeworldSources } };
  act(emperor, shipmentStep.action); reach(emperorFaceDanceReturnClean);
  const afterShipment = structuredClone(game);
  assert.equal(emperorFaceDanceReturnPlayer(game, emperor).forces[location], amount);
  assert.equal(emperorFaceDanceReturnPlayer(game, emperor).elites!.forces[location] ?? 0, elite);
  assert.equal(emperorFaceDanceReturnPlayer(beforeShipment, emperor).spice - emperorFaceDanceReturnPlayer(game, emperor).spice, amount);
  reach(state => state.phase === 6 && emperorFaceDanceReturnClean(state));
  const beforeBattle = structuredClone(game);
  const choice = game.players.flatMap(player => viewGame(game, player.id).battleChoices)
    .find(candidate => candidate.territory === territory); assert.ok(choice);
  const battleStep: EmperorFaceDanceReturnStep = { actor: choice.chooser, action: { type: 'chooseBattle', territory,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker } };
  act(battleStep.actor, battleStep.action);
  reach(state => !!state.battle && !state.battle.preparation && state.battle.preLeader?.closed !== false && emperorFaceDanceReturnClean(state));
  const beforePlans = structuredClone(game);
  const winningLeader = emperorFaceDanceReturnPlayer(game, emperor).leaders.find(leader => leader.id === 'emperor-0');
  const losingLeader = [...emperorFaceDanceReturnPlayer(game, opponent).leaders]
    .filter(leader => !leader.dead).sort((a, b) => a.strength - b.strength || a.id.localeCompare(b.id))[0];
  assert.ok(winningLeader && losingLeader && winningLeader.strength > losingLeader.strength);
  const plans: EmperorFaceDanceReturnStep[] = [
    { actor: emperor, action: { type: 'battlePlan', leader: winningLeader.id, dial, support, weapon: null, defense: null } },
    { actor: opponent, action: { type: 'battlePlan', leader: losingLeader.id, dial: 0, support: 0, weapon: null, defense: null } },
  ];
  for (const step of plans) act(step.actor, step.action);
  const sealed = structuredClone(game);
  reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'faceDance');
  assert.equal(game.decision!.player, tleilaxu);
  assert.ok(game.decision?.kind === 'faceDance');
  assert.equal(game.decision.winner, emperor); assert.equal(game.decision.identity, winningLeader.id);
  const survivors = { normal: normal - dial, elite }, survivorCount = survivors.normal + survivors.elite;
  assert.equal(emperorFaceDanceReturnPlayer(game, emperor).forces[location], survivorCount);
  assert.equal(emperorFaceDanceReturnPlayer(game, emperor).elites!.forces[location] ?? 0, survivors.elite);
  assert.equal(emperorFaceDanceReturnPlayer(game, emperor).tanks, dial);
  assert.equal(emperorFaceDanceReturnPlayer(game, emperor).elites!.tanks, 0);
  assert.deepEqual(emperorFaceDanceReturnInventory(game), originalInventory);
  const sources = { reserves: survivorCount };
  const action: Action = { type: 'decision', reveal: true, sources, sector };
  const decline: Action = { type: 'decision', reveal: false };
  const zero: Action = { type: 'decision', reveal: true, sources: {}, sector };
  return { game, source: structuredClone(game), initial, setup, afterSetup, faceDancerDeal, initialHomes,
    beforeShipment, shipmentStep, afterShipment, beforeBattle, battleStep, beforePlans, plans, sealed,
    army, advanced: true as const, emperor, winner: emperor, holder: emperor, owner: tleilaxu, actor: tleilaxu,
    tleilaxu, dancer: tleilaxu, opponent, territory, battleTerritory: territory, sector, location,
    leader: winningLeader.id, winnerLeader: winningLeader.id, loserLeader: losingLeader.id,
    event: game.lastBattleContext!.event, normal, elite, dial, support, amount, survivors, survivorCount,
    sources, action, faceDanceAction: action, decline, zero, originalInventory, originalSpice, spiceOrder,
    originalContext: structuredClone(game.lastBattleContext), originalPhysical: emperorFaceDanceReturnPhysical(game),
    actions, sourceActionCount: actions.length,
    staging: [
      'Public original Advanced Emperor/Tleilaxu/Atreides + Ix/Homeworlds ready/start. Actual private Traitor choices retain an alternative to Emperor0; selected scalars in the original final choice produce the actual first three unrevealed Face Dancers with Emperor0 included.',
      'Only original scalar shuffle draws and two original unopened ordinary Spice positions are selected. No held hand, force, wallet, leader, phase, Face Dancer or receipt is installed.',
      'Actual paid Emperor shipment uses nativeShipmentSources to withdraw the precise normal/Sardaukar counters from Kaitain/Salusa and place them into native Arrakeen10 with Atreides ten. Real movement endings reach an original battle choice.',
      normal ? 'Real unarmed Emperor0 dial/support1 and weakest Atreides dial0 plans, declined original Traitor calls, outcome acknowledgements and a normal-only casualty earn the surviving army and private Face Dance offer.'
        : 'Real unarmed Emperor0 and weakest Atreides dial0 plans, declined original Traitor calls and outcome acknowledgements earn the unchanged Sardaukar army and private Face Dance offer.',
      'Stop before the actual Face Dance action. Positive/zero replacement or decline, typed reserve return, original winner leader death and continuation remain caller-owned outcomes. This is Advanced preview evidence only.',
    ] };
}
export type EmperorFaceDanceReturnFixture = ReturnType<typeof createEmperorFaceDanceReturnFixture>;
export function commitEmperorFaceDanceReturn(fixture: EmperorFaceDanceReturnFixture,
  game = structuredClone(fixture.game), action: Action = fixture.action,
  actions: EmperorFaceDanceReturnStep[] = []) {
  assert.equal(game.decision?.kind, 'faceDance');
  return actEmperorFaceDanceReturn(game, fixture.tleilaxu, action, actions);
}
export function finishEmperorFaceDanceReturn(game: Game, actions: EmperorFaceDanceReturnStep[] = []) {
  return advanceEmperorFaceDanceReturn(game, state => !state.battle && !state.pendingFaceDance &&
    state.phase >= 7 && state.phase <= 8 && emperorFaceDanceReturnClean(state), actions);
}
