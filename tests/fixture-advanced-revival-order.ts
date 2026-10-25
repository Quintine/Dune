import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { actAdvisorPreparation, advisorPreparationInventory } from './fixture-advisor-preparation';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type AdvancedRevivalOrderStep = { actor: string; action: Action };
export type AdvancedRevivalOrderTransition = {
  before: Game; steps: AdvancedRevivalOrderStep[]; after: Game;
};
export const actAdvancedRevivalOrder = actAdvisorPreparation;
export const advancedRevivalOrderInventory = advisorPreparationInventory;
export const advancedRevivalOrderPlayer = (game: Game, actor: string) => {
  const player = game.players.find(player => player.id === actor);
  assert.ok(player, `Missing original Revival seat ${actor}`); return player;
};
export const advancedRevivalOrderClean = (game: Game) => !game.phaseOpening && !game.response &&
  !game.decision && !game.pendingRevival && !game.truthtrance && !game.pendingTreacheryDiscard;
export function advancedRevivalOrderStocks(game: Game) {
  return Object.fromEntries(game.players.map(player => [player.id, {
    reserves: player.reserves, tanks: player.tanks, forces: structuredClone(player.forces),
    spice: player.spice, revived: player.revived,
    freeForcesRevived: player.freeForcesRevived, leaderRevived: player.leaderRevived,
    elites: structuredClone(player.elites),
  }]));
}

/** Actual native decisions only. Ordered Revival finishes the current seat;
 * an unstamped Basic/legacy phase retains its original all-seat readiness. */
export function nextAdvancedRevivalOrder(game: Game): AdvancedRevivalOrderStep | null {
  if (advancedRevivalOrderClean(game) && game.status === 'playing') {
    if (game.phase === 0 && game.stormPending === null) {
      const actor = game.stormDialers.find(id => game.stormDials[id] === undefined);
      if (actor) return { actor, action: { type: 'stormDial', amount: game.turn === 1
        ? game.stormDialers.indexOf(actor) === 0 ? game.advanced ? 11 : 10 : 0
        : 1 } };
    }
    if (game.phase === 4 && game.revivalOrder) {
      const actor = game.revivalOrder.remaining[0];
      if (actor) return { actor, action: { type: 'ready' } };
    }
  }
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard) {
    const decision = game.decision;
    if (decision?.kind === 'revivalStop')
      return { actor: decision.player, action: { type: 'decision', decline: true } };
    if (decision?.kind === 'guildTiming')
      return { actor: decision.player, action: { type: 'decision', take: false } };
  }
  return nextStrongholdFactionsNativeStep(game);
}
export function advanceAdvancedRevivalOrder(game: Game, until: (state: Game) => boolean,
  actions: AdvancedRevivalOrderStep[] = []): Game {
  for (let count = 0; count < 1500; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The genuine Revival source ended before its next control');
    const step = nextAdvancedRevivalOrder(game);
    assert.ok(step, `Choose the original control at ${game.status}/${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actAdvancedRevivalOrder(game, step.actor, step.action, actions);
  }
  throw Error('The genuine Revival source did not reach its finite boundary');
}
export function passAdvancedRevivalOrder(game: Game, actions: AdvancedRevivalOrderStep[] = []): Game {
  for (let count = 0; game.response && count < 60; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actAdvancedRevivalOrder(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.ok(!game.response); return game;
}
export function finishAdvancedRevivalOrder(game: Game, actions: AdvancedRevivalOrderStep[] = []): Game {
  return advanceAdvancedRevivalOrder(game, state => state.phase === 5 && advancedRevivalOrderClean(state), actions);
}
export function reachAdvancedRevivalOrderActor(game: Game, actor: string,
  actions: AdvancedRevivalOrderStep[] = []): Game {
  return advanceAdvancedRevivalOrder(game, state => state.phase === 4 && advancedRevivalOrderClean(state) &&
    (!state.revivalOrder || state.revivalOrder.remaining[0] === actor), actions);
}

/** Genuine public E/A/T + original Ix-deck start. The first source stops at
 * turn-one Revival. casualty:true additionally earns a paid Emperor normal1
 * shipment to Hagga13 and its next native Storm death before turn-two Revival.
 * Only unopened original Spice positions and scalar lotteries are selected.
 * No played hand, force, wallet, Tanks, phase, active seat or queue is installed.
 * The supplied Advanced physical9 orders Force Revival; the single native
 * force/leader opportunity used by this slice is explicitly composed policy. */
export function createAdvancedRevivalOrderFixture(options: { advanced?: boolean; casualty?: boolean } = {}) {
  const advanced = options.advanced ?? true, casualty = options.casualty ?? false;
  const owner = 'emperor', responder = 'tleilaxu', casualtyLocation = 'hagga_basin:13';
  let game = createGame('ADVANCEDREVIVALORDER', newPlayer(owner, 'Emperor', 'emperor'), advanced, ['ix']);
  joinGame(game, newPlayer('atreides', 'Atreides', 'atreides'));
  joinGame(game, newPlayer(responder, 'Tleilaxu', 'tleilaxu'));
  const initial = structuredClone(game), actions: AdvancedRevivalOrderStep[] = [];
  const act = (actor: string, action: Action) => { game = actAdvancedRevivalOrder(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceAdvancedRevivalOrder(game, until, actions); };
  const transition = (run: () => void): AdvancedRevivalOrderTransition => {
    const before = structuredClone(game), start = actions.length; run();
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.ok(game.players.every(player => !player.hand.length));
  assert.ok(!game.homeworlds && !game.leaderSkills && !game.nexusCards && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled);
  const originalInventory = advancedRevivalOrderInventory(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  // Four ordinary original blows avoid an incidental Nexus/worm programme.
  const spiceOrder = [0, 1, 2, 3].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  reach(state => state.turn === 1 && state.phase === 4 && advancedRevivalOrderClean(state));
  const firstRevival = structuredClone(game);
  let shipment: AdvancedRevivalOrderTransition | null = null, storm: AdvancedRevivalOrderTransition | null = null;
  if (casualty) {
    reach(state => state.turn === 1 && state.phase === 5 && state.active === owner && advancedRevivalOrderClean(state));
    shipment = transition(() => {
      act(owner, { type: 'ship', territory: 'hagga_basin', sector: 13, amount: 1, elite: 0, allyPayment: 0 });
      reach(advancedRevivalOrderClean);
    });
    assert.equal(advancedRevivalOrderPlayer(game, owner).forces[casualtyLocation], 1);
    assert.equal(advancedRevivalOrderPlayer(shipment.before, owner).spice - advancedRevivalOrderPlayer(game, owner).spice, 2);
    reach(state => state.turn === 2 && state.phase === 0 && advancedRevivalOrderClean(state));
    if (advanced) {
      assert.ok(game.stormPending !== null && game.stormPending >= 1 && game.stormPending <= 6);
      assert.equal(game.stormMovementSource?.kind, 'card');
      assert.equal(game.stormMovementSource?.turn, 2);
      assert.equal(game.stormMovementSource?.distance, game.stormPending);
    } else assert.equal(game.stormPending, null);
    storm = transition(() => { reach(state => state.turn === 2 && state.phase === 1); });
    assert.equal(advancedRevivalOrderPlayer(game, owner).forces[casualtyLocation], undefined);
    assert.equal(advancedRevivalOrderPlayer(game, owner).tanks, 1);
    reach(state => state.turn === 2 && state.phase === 4 && advancedRevivalOrderClean(state));
  }
  assert.deepEqual(advancedRevivalOrderInventory(game), originalInventory);
  const actor = game.revivalOrder?.remaining[0] ?? game.order[0];
  const outOfTurn = game.players.find(player => player.id !== actor)!.id;
  return { game, sourceGame: structuredClone(game), owner, responder, actor, outOfTurn,
    originalOrder: [...game.order], initial, lobby, setup, afterSetup, firstRevival,
    casualtyLocation, revivalAction: { type: 'revive', amount: 1, elite: 0 } as Action,
    shipment, storm, spiceOrder, originalInventory, originalSpice,
    actions, sourceActions: structuredClone(actions), sourceActionCount: actions.length,
    staging: [] as string[] };
}
