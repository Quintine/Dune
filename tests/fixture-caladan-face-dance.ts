import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { traitorDeck } from '../game/traitors';
import { homeworldContext } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { nativeShipmentSources } from '../game/homeworld-options';
import { caladanReinforcementChoice } from '../game/caladan-reinforcement-options';
import { actAdvisorFaceDanceFlip, advisorFaceDanceFlipClean, advisorFaceDanceFlipInventory,
  advisorFaceDanceFlipTraitors, nextAdvisorFaceDanceFlip } from './fixture-advisor-face-dance-flip';

export type CaladanFaceDanceStep = { actor: string; action: Action };
export const actCaladanFaceDance = actAdvisorFaceDanceFlip;
export const caladanFaceDanceClean = advisorFaceDanceFlipClean;
export function caladanFaceDancePlayer(game: Game, id: string) {
  const player = game.players.find(player => player.id === id);
  assert.ok(player, `The original ${id} seat must remain present`);
  return player;
}
export function caladanFaceDanceInventory(game: Game) {
  return { treachery: advisorFaceDanceFlipInventory(game), traitors: advisorFaceDanceFlipTraitors(game) };
}
export function caladanFaceDancePopulation(game: Game) {
  assert.ok(game.homeworlds?.custody);
  const caladan = homeworldForceGroups(homeworldContext(game), game.homeworlds.custody)
    .find(world => world.id === 'homeworld:atreides');
  assert.ok(caladan);
  const pool = caladan.forces.a;
  assert.ok(pool);
  return pool.normal + pool.elite;
}
export function caladanFaceDancePhysical(game: Game) {
  return { population: caladanFaceDancePopulation(game), custody: structuredClone(game.homeworlds!.custody),
    players: game.players.map(player => ({ id: player.id, spice: player.spice, reserves: player.reserves,
      tanks: player.tanks, forces: structuredClone(player.forces), elites: structuredClone(player.elites),
      shipped: player.shipped, moved: player.moved })) };
}
export function nextCaladanFaceDanceStep(game: Game): CaladanFaceDanceStep | null {
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard) {
    if (game.decision?.kind === 'caladanReinforcement' || game.decision?.kind === 'faceDance') return null;
    if (game.status === 'setup' && game.setupStage === 'traitors') {
      const player = game.players.find(player => player.traitorChoices.length);
      assert.ok(player);
      const leader = player.traitorChoices.find(identity => identity !== 'atreides-0');
      assert.ok(leader, 'A real alternative initial Traitor choice must preserve the original winning Face Dancer');
      return { actor: player.id, action: { type: 'traitor', leader } };
    }
  }
  return nextAdvisorFaceDanceFlip(game);
}
export function advanceCaladanFaceDance(game: Game, until: (state: Game) => boolean,
  actions: CaladanFaceDanceStep[] = []): Game {
  for (let count = 0; count < 1400; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The native Caladan/Face Dance source ended before its owned boundary');
    const step = nextCaladanFaceDanceStep(game);
    assert.ok(step, `Choose the real ${game.turn}/${game.phase}/${game.decision?.kind}/${game.battle?.preparation?.kind}/${game.battle?.preLeader?.closed} before continuing`);
    game = actCaladanFaceDance(game, step.actor, step.action, actions);
  }
  throw Error('The native Caladan/Face Dance source did not reach its finite boundary');
}

/** Select only the first native Face Dancer shuffle inside the actual final
 * Traitor choice. The winning identity is never installed in a played hand. */
function originalFaceDancerDeal(game: Game, step: CaladanFaceDanceStep, actions: CaladanFaceDanceStep[]) {
  assert.equal(game.setupStage, 'traitors');
  assert.equal(step.action.type, 'traitor');
  assert.equal(game.players.filter(player => player.traitorChoices.length > 0).length, 1);
  assert.ok(game.players.every(player => !player.faceDancers));
  const held = new Set([...game.players.flatMap(player => player.traitors), String(step.action.leader)]);
  const original = traitorDeck(game.players, true).filter(identity => !held.has(identity));
  assert.ok(original.includes('atreides-0'));
  const first = ['atreides-0', ...original.filter(identity => identity !== 'atreides-0').slice(0, 2)];
  const order = [...first, ...original.filter(identity => !first.includes(identity))];
  const current = [...original], scalars: number[] = [];
  for (let index = current.length - 1; index > 0; index--) {
    const from = current.indexOf(order[index]); assert.ok(from >= 0 && from <= index);
    scalars.push(Math.floor((from + 0.5) * 4294967296 / (index + 1)));
    [current[index], current[from]] = [current[from], current[index]];
  }
  assert.deepEqual(current, order);
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues'), native = crypto.getRandomValues.bind(crypto);
  let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) {
      assert.ok(cursor < scalars.length, 'Only the actual initial Face Dancer permutation uses these scalar choices');
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

/** Public native A/T/G with original Ix deck and Homeworlds. Real Caladan4
 * shipment and Guild1 invasion lead to the original ten-survivor victory.
 * Only unopened deal/Spice positions and original scalar lotteries are chosen. */
export function createCaladanFaceDanceFixture(options: { advanced?: boolean } = {}) {
  const advanced = options.advanced ?? false;
  let game = createGame('CALADANFACEDANCE', newPlayer('a', 'Atreides', 'atreides'), advanced, ['ix']);
  joinGame(game, newPlayer('t', 'Tleilaxu', 'tleilaxu'));
  joinGame(game, newPlayer('g', 'Guild', 'guild'));
  const actions: CaladanFaceDanceStep[] = [];
  const act = (actor: string, action: Action) => { game = actCaladanFaceDance(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceCaladanFaceDance(game, until, actions); };
  act(game.host, { type: 'homeworlds', enabled: true });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const initial = structuredClone(game);
  act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game), originalInventory = caladanFaceDanceInventory(game);
  let faceDancerDeal: ReturnType<typeof originalFaceDancerDeal> | null = null;
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    const step = nextCaladanFaceDanceStep(game);
    assert.ok(step);
    if (game.setupStage === 'traitors' && step.action.type === 'traitor' &&
      game.players.filter(player => player.traitorChoices.length > 0).length === 1) {
      faceDancerDeal = originalFaceDancerDeal(game, step, actions);
      game = faceDancerDeal.game;
    } else act(step.actor, step.action);
  }
  assert.equal(game.status, 'playing'); assert.ok(faceDancerDeal);
  const afterSetup = structuredClone(game);
  assert.equal(caladanFaceDancePopulation(game), 10);
  assert.equal(caladanFaceDancePlayer(game, 'a').forces['arrakeen:10'], 10);
  assert.ok(caladanFaceDancePlayer(game, 't').faceDancers!.some(card => card.leader === 'atreides-0' && !card.revealed));
  assert.deepEqual(caladanFaceDanceInventory(game), originalInventory);
  const front: Game['spiceDeck'] = [];
  for (let count = 0; count < (advanced ? 2 : 1); count++) {
    const at = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery);
    assert.ok(at >= 0); front.push(game.spiceDeck.splice(at, 1)[0]);
  }
  game.spiceDeck.unshift(...front);
  const shipments: { before: Game; step: CaladanFaceDanceStep; after: Game }[] = [];
  const ship = (actor: string, territory: string, sector: number, amount: number) => {
    reach(state => state.phase === 5 && state.active === actor && caladanFaceDanceClean(state));
    const homeworldSources = nativeShipmentSources(viewGame(game, actor), amount, 0);
    assert.ok(homeworldSources);
    const before = structuredClone(game), step: CaladanFaceDanceStep = { actor,
      action: { type: 'ship', territory, sector, amount, elite: 0, allyPayment: 0, homeworldSources } };
    act(actor, step.action); reach(caladanFaceDanceClean);
    shipments.push({ before, step, after: structuredClone(game) });
  };
  ship('a', 'polar_sink', 0, 4);
  assert.equal(caladanFaceDancePopulation(game), 6);
  ship('g', 'arrakeen', 10, 1);
  reach(state => state.phase === 6 && caladanFaceDanceClean(state));
  assert.ok(game.active === 'a' || game.active === 'g');
  const beforeBattle = structuredClone(game), chooser = game.active;
  const choice: CaladanFaceDanceStep = { actor: chooser, action: { type: 'chooseBattle', territory: 'arrakeen',
    target: chooser === 'a' ? 'g' : 'a' } };
  act(choice.actor, choice.action);
  reach(state => !!state.battle && (!state.battle.preLeader || state.battle.preLeader.closed) &&
    !state.battle.preparation && caladanFaceDanceClean(state));
  const beforePlans = structuredClone(game), winningLeader = caladanFaceDancePlayer(game, 'a').leaders.find(leader => leader.id === 'atreides-0');
  const losingLeader = [...caladanFaceDancePlayer(game, 'g').leaders]
    .filter(leader => !leader.dead).sort((a, b) => a.strength - b.strength)[0];
  assert.ok(winningLeader && losingLeader && winningLeader.strength > losingLeader.strength);
  const plans: CaladanFaceDanceStep[] = [
    { actor: 'a', action: { type: 'battlePlan', leader: winningLeader.id, dial: 0, support: 0 } },
    { actor: 'g', action: { type: 'battlePlan', leader: losingLeader.id, dial: 0, support: 0 } },
  ];
  for (const step of plans) act(step.actor, step.action);
  const sealed = structuredClone(game);
  reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'caladanReinforcement');
  assert.equal(game.decision!.player, 'a');
  assert.ok(game.pendingFaceDance);
  assert.equal(game.pendingFaceDance.identity, winningLeader.id);
  assert.equal(caladanFaceDancePopulation(game), 6);
  assert.equal(caladanFaceDancePlayer(game, 'a').forces['arrakeen:10'], 10);
  const offer = viewGame(game, 'a').caladanReinforcement;
  assert.ok(offer && !offer.blocked, offer?.blocked ?? 'The original victory must allow Caladan before its pending Face Dance');
  const target = offer.destinations.find(destination => destination.sector === 10 && !destination.blocked);
  assert.ok(target, 'The real surviving Arrakeen army must be a reinforcement destination');
  const quoted = caladanReinforcementChoice(viewGame(game, 'a'), target.id);
  assert.ok(quoted.action, quoted.blocked ?? undefined);
  const frame = structuredClone(game.homeworldVictoryReinforcement!);
  return { game, advanced, owner: 'a', holder: 'a', dancer: 't', opponent: 'g', leader: winningLeader.id,
    territory: 'arrakeen', location: 'arrakeen:10', event: frame.event, destination: target.id, action: quoted.action,
    initial, setup, afterSetup, faceDancerDeal, shipments, beforeBattle, choice, beforePlans, plans, sealed,
    originalInventory, originalPhysical: caladanFaceDancePhysical(game), originalFrame: frame,
    originalFaceDance: structuredClone(game.pendingFaceDance), actions, sourceActionCount: actions.length,
    staging: ['Only original unopened scalar/deck positions are selected. Public original Homeworld setup, private Traitor choices and native Face Dancer deal, Caladan4→Polar, Guild1→Arrakeen, real unarmed plans, votes and outcome acknowledgements produce this source. No played hand, force, wallet, leader, clock or receipt is installed.'] };
}
export type CaladanFaceDanceFixture = ReturnType<typeof createCaladanFaceDanceFixture>;
export function reinforceCaladanFaceDance(fixture: CaladanFaceDanceFixture, game = structuredClone(fixture.game), give = true,
  actions: CaladanFaceDanceStep[] = []) {
  const action: Action = give ? fixture.action : { type: 'decision', event: fixture.event, decline: true };
  return actCaladanFaceDance(game, fixture.owner, action, actions);
}
export function faceDanceCaladanFaceDance(fixture: CaladanFaceDanceFixture, game: Game, reveal = true,
  amount = caladanFaceDancePlayer(game, fixture.owner).forces[fixture.location] ?? 0,
  actions: CaladanFaceDanceStep[] = []) {
  assert.equal(game.decision?.kind, 'faceDance');
  return actCaladanFaceDance(game, fixture.dancer, reveal
    ? { type: 'decision', reveal: true, sources: { reserves: amount }, sector: 10 }
    : { type: 'decision', reveal: false }, actions);
}
export function finishCaladanFaceDance(fixture: CaladanFaceDanceFixture, game: Game,
  actions: CaladanFaceDanceStep[] = []) {
  return advanceCaladanFaceDance(game, state => !state.battle && !state.pendingFaceDance &&
    state.homeworldVictoryReinforcement?.event === fixture.event &&
    state.homeworldVictoryReinforcement.stage === 'complete' && caladanFaceDanceClean(state), actions);
}
