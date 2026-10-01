import assert from 'node:assert/strict';
import {applyAction, createGame, initializeBaseGameForAudit, initializeFactionExpansionsGameForAudit,
  initializeHomeworldGameForAudit, joinGame, newPlayer, viewGame, type Game, type Action} from '../game/engine';
import {botActions} from '../game/bots';
import {TERRITORIES, splitLocation} from '../game/board';
import {fremenReserveEntry} from '../game/bot-mobility';
import type {FactionId} from '../game/catalog';

export type AdvancedSourceFixtureOptions = {
  initial?: Game;
  advanced?: boolean;
  fremen?: boolean;
  seatIds?: string[];
  alliance?: 'firstEnding'|'laterEnding'|'newThisTurn'|'ownAdvisors'|'allyAdvisors'|'ecaz'|'polar';
  storm?: 'first'|'next';
  modules?: boolean;
  /** Reorder original dealt counters; false guarantees a counter-free native starting deal. */
  karama?: boolean;
  hajr?: boolean;
};
export type AdvancedSourceFixture = {
  game: Game;
  actor: string;
  ally: string | null;
  other: string | null;
  turn: number;
  lossTerritories: string[];
};

function ordinaryAlliance(mode: AdvancedSourceFixtureOptions['alliance']): mode is 'firstEnding'|'laterEnding'|'newThisTurn' {
  return mode === 'firstEnding' || mode === 'laterEnding' || mode === 'newThisTurn';
}

/** Accept a captured native historical Advanced opening without changing its
 * rules, source, dialers, setup inventories, saved identity or continuation. */
export function createRecordedAdvancedSourceFixture(state: Game): AdvancedSourceFixture {
  const game = structuredClone(state);
  assert.equal(game.status, 'playing');
  assert.equal(game.advanced, true);
  assert.equal(game.phase, 0);
  assert.ok(game.turn > 1 && game.stormDialers.length === 2);
  assert.ok(game.stormPending === null || game.stormMovementSource?.kind === 'dials');
  for (const p of game.players) viewGame(game, p.id);
  return {game, actor: game.stormDialers[0], ally: null, other: game.stormDialers[1],
    turn: game.turn, lossTerritories: []};
}

/** Only consumes a native pending window; never redeclares its parent action. */
export function settleAdvancedSourceResponses(state: Game): Game {
  let game = state;
  for (let step = 0; step < 100; step++) {
    if (game.pendingTreacheryDiscard) game = applyAction(game, game.players[0].id, {type: 'advanceBots'});
    else if (game.response) game = applyAction(game,
      game.players.find(p => !game.response!.passed.includes(p.id))!.id, {type: 'passResponse'});
    else if (game.decision?.kind === 'guildShipment')
      game = applyAction(game, game.decision.player, {type: 'decision', allow: true});
    else return game;
  }
  throw new Error('Native Advanced source response did not settle.');
}

function nativeStep(game: Game): Game {
  if (game.pendingTreacheryDiscard) return applyAction(game, game.players[0].id, {type: 'advanceBots'});
  if (game.response) return applyAction(game,
    game.players.find(p => !game.response!.passed.includes(p.id))!.id, {type: 'passResponse'});
  if (game.phaseOpening) return applyAction(game,
    game.players.find(p => !game.phaseOpening!.passed.includes(p.id))!.id, {type: 'ready'});
  if (game.status === 'playing' && !game.decision) {
    if (game.phase === 0 && game.stormPending === null) {
      const dialer = game.stormDialers.find(id => game.stormDials[id] === undefined)!;
      return applyAction(game, dialer, {type: 'stormDial', amount: game.turn === 1 ? 0 : 1});
    }
    if (game.phase === 3 && game.auction) return applyAction(game, game.auction.active, {type: 'passBid'});
    if (game.phase === 5) return applyAction(game, game.active!, {type: 'endMovement'});
    if (game.phase !== 6 || !game.active) {
      const seat = game.players.find(p => !game.ready.includes(p.id));
      if (seat) return applyAction(game, seat.id, {type: 'ready'});
    }
  }
  for (const p of game.players) {
    const view = viewGame(game, p.id);
    view.players.find(seat => seat.id === p.id)!.bot = 'Easy';
    const actions = botActions(view);
    const action: Action | undefined = actions.find(a => a.type === 'ready') ?? actions[0];
    if (action) return applyAction(game, p.id, action);
  }
  throw new Error(`No native source action at ${game.status}/${game.turn}/${game.phase}/${game.decision?.kind}`);
}

/** Stop at the genuine held counter window, or its automatic known-card
 * endpoint. Callers requiring pass/cancel must prepare karama: true. */
export function advanceToForecast(state: Game): Game {
  let game = state;
  for (let step = 0; step < 800; step++) {
    assert.ok(game.players.some(p => p.faction === 'fremen') && game.advanced,
      'Only actual native Advanced Fremen receive a forecast.');
    if (game.response?.kind === 'stormPeek' ||
        (game.phase === 1 && game.stormCard !== null && game.stormCardKnown && !game.response)) return game;
    assert.equal(game.status, 'playing', 'The native forecast must open before the game ends.');
    game = nativeStep(game);
  }
  throw new Error('The native forecast did not open.');
}
export function advanceToNextStorm(state: Game): Game {
  let game = state;
  const turn = state.turn;
  for (let step = 0; step < 1200; step++) {
    if (game.status === 'playing' && game.turn > turn && game.phase === 0 &&
        !game.phaseOpening && !game.response && !game.decision) return game;
    game = nativeStep(game);
  }
  throw new Error('The next native Storm turn did not open.');
}
export function finishToMovement(state: Game): Game {
  let game = state;
  for (let step = 0; step < 800; step++) {
    if (game.status === 'playing' && game.phase === 5 && !game.phaseOpening && !game.response && !game.decision) return game;
    game = nativeStep(game);
  }
  throw new Error('Native Shipment and Movement did not open.');
}

/** Reorders conserved, unplayed physical Spice Cards; does not manufacture a
 * worm, territory, phase, force, source frame or private receipt. */
function orderSpice(game: Game, territory: string, worm = false, position = 0): void {
  const index = game.spiceDeck.findIndex((card, i) => i >= position && (worm ?
    'worm' in card && !card.greatMaker && !card.suppressed :
    'territory' in card && (!territory || card.territory === territory)));
  assert.ok(index >= position, 'The required actual Spice Card remains in the deck.');
  game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
}
function completeSetup(state: Game, mode: AdvancedSourceFixtureOptions['alliance']): Game {
  let game = state;
  const advisors = mode === 'ownAdvisors' || mode === 'allyAdvisors';
  for (let step = 0; step < 100 && game.status === 'setup'; step++) {
    if (advisors && game.setupStage === 'forces') {
      const bg = game.players.find(p => p.faction === 'beneGesserit');
      if (bg && viewGame(game, bg.id).setupPending.includes(bg.id) && game.players.every(p => p.faction !== 'fremen' || p.reserves === 10)) {
        game = applyAction(game, bg.id, {type: 'advisorSetup', territory: 'arrakeen', sector: 10});
        continue;
      }
    }
    game = nativeStep(game);
  }
  assert.equal(game.status, 'playing');
  return game;
}

function arrangeStartingCards(game: Game, options: AdvancedSourceFixtureOptions): void {
  if (options.karama !== undefined || options.hajr)
    assert.ok(game.players.every(p => p.hand.length === 0),
      'Arrange only unplayed faces before the native starting deal.');
  if (options.karama === false) {
    let position = 0;
    for (const p of game.players) {
      for (let count = 0; count < (p.faction === 'harkonnen' ? 2 : 1); count++) {
        const index = game.deck.findIndex((c, i) => i >= position && c.effect !== 'karama' &&
          (p.faction !== 'beneGesserit' || c.kind !== 'worthless'));
        assert.ok(index >= position, 'A conserved non-counter starting face must remain.');
        game.deck.splice(position++, 0, game.deck.splice(index, 1)[0]);
      }
    }
  }
  for (const [effect, owner] of [
    ['karama', options.karama ? game.players.find(p => p.faction !== 'fremen') : undefined],
    ['hajr', options.hajr ? options.alliance ?
      game.players.find(p => p.faction === (ordinaryAlliance(options.alliance) ? 'emperor' : 'fremen')) :
      game.players[0] : undefined],
  ] as const) {
    if (!owner) continue;
    const index = game.deck.findIndex(c => c.effect === effect);
    assert.ok(index >= 0, 'The required original unplayed starting face must remain.');
    const drawPosition = game.players.slice(0, game.players.indexOf(owner))
      .reduce((sum, p) => sum + (p.faction === 'harkonnen' ? 2 : 1), 0);
    game.deck.splice(drawPosition, 0, game.deck.splice(index, 1)[0]);
  }
}

function freshSetup(options: AdvancedSourceFixtureOptions): Game {
  if (options.initial) {
    const game = structuredClone(options.initial);
    assert.equal(game.status, 'setup', 'Only a fresh admitted setup may be prepared.');
    assert.equal(game.turn, 1);
    if (options.advanced !== undefined) assert.equal(game.advanced, options.advanced);
    if (options.seatIds) assert.deepEqual(game.players.map(p => p.id), options.seatIds);
    arrangeStartingCards(game, options);
    return completeSetup(game, options.alliance);
  }
  const mode = options.alliance;
  const ids = options.seatIds ?? ['source-a', 'source-b', 'source-c'];
  const roster: FactionId[] = mode === 'ecaz' ? ['ecaz', 'fremen', 'atreides'] :
    mode === 'ownAdvisors' || mode === 'allyAdvisors' ? ['atreides', 'beneGesserit', 'fremen'] :
    ordinaryAlliance(mode) ? ['atreides', 'emperor', 'guild'] :
    mode ? ['atreides', 'fremen', 'guild'] : options.fremen ? ['atreides', 'emperor', 'fremen'] : ['atreides', 'emperor'];
  assert.ok(ids.length >= roster.length, 'Supply final seat IDs before setup.');
  let game = createGame('ADVANCEDSOURCE', newPlayer(ids[0], roster[0], roster[0]), options.advanced ?? true,
    mode === 'ecaz' ? ['ecaz'] : []);
  for (let i = 1; i < roster.length; i++) joinGame(game, newPlayer(ids[i], roster[i], roster[i]));
  if (mode) {
    // Actual printed circles select a native first allied ending. The later
    // case has a nonallied seat ahead of it; no movement order is forged.
    const fremen = game.players.find(p => p.faction === (ordinaryAlliance(mode) ? 'emperor' : 'fremen'))!;
    const native = game.players.find(p => p.faction === (mode === 'ecaz' ? 'ecaz' : 'atreides'))!;
    const remaining = game.players.find(p => p.id !== fremen.id && p.id !== native.id)!;
    if (ordinaryAlliance(mode))
      for (const [index, player] of game.players.entries())
        game = applyAction(game, player.id, {type: 'seatPosition', position: index + 4});
    const positions = ordinaryAlliance(mode) ? mode === 'laterEnding'
      ? [[remaining.id, 1], [fremen.id, 2], [native.id, 3]] as const
      : [[fremen.id, 1], [native.id, 2], [remaining.id, 3]] as const :
      [[remaining.id, 6], [fremen.id, 3], [native.id, 4]] as const;
    for (const [id, position] of positions)
      if (game.playerPositions?.[id] !== position)
        game = applyAction(game, id, {type: 'seatPosition', position});
  }
  if (options.modules) game = applyAction(game, ids[0], {type: 'homeworlds', enabled: true});
  for (const p of game.players) game = applyAction(game, p.id, {type: 'ready'});
  game = mode === 'ecaz' ? initializeFactionExpansionsGameForAudit(game) : options.modules ?
    initializeHomeworldGameForAudit(game) : initializeBaseGameForAudit(game);
  arrangeStartingCards(game, options);
  return completeSetup(game, mode);
}

/** Protected Basin groups can legally share a territory before allying: the
 * first Storm separates their sectors, so no battle joins them. The next
 * natural Nexus allies them without violating allied entry restrictions. */
function createOrdinaryAlliance(state: Game, mode: NonNullable<AdvancedSourceFixtureOptions['alliance']>): AdvancedSourceFixture {
  let game = state;
  const emperor = game.players.find(p => p.faction === 'emperor')!;
  const atreides = game.players.find(p => p.faction === 'atreides')!;
  assert.ok(emperor && atreides);
  const seed = TERRITORIES.find(t => game.spiceDeck.some(c => 'territory' in c && c.territory === t.id) &&
    game.players.every(p => Object.keys(p.forces).every(key => splitLocation(key).territory !== t.id)))!;
  orderSpice(game, seed.id);
  if (game.advanced) orderSpice(game, '', false, 1);
  while (game.phaseOpening || game.response || game.decision) game = nativeStep(game);
  assert.equal(game.phase, 0);
  for (const [index, id] of game.stormDialers.entries())
    game = applyAction(game, id, {type: 'stormDial', amount: index === 0 ? 4 : 5});
  game = finishToMovement(game);
  assert.equal(game.storm, 10);
  while (game.phase === 5) {
    const actor = game.active!;
    if (actor === emperor.id || actor === atreides.id)
      game = settleAdvancedSourceResponses(applyAction(game, actor, {type: 'ship',
        territory: 'imperial_basin', sector: actor === emperor.id ? 9 : 11, amount: 2,
        ...(game.advanced && actor === emperor.id ? {elite: 1} : {})}));
    game = applyAction(game, actor, {type: 'endMovement'});
  }
  game = advanceToNextStorm(game);
  orderSpice(game, '', true);
  orderSpice(game, '', false, 1);
  if (game.advanced) orderSpice(game, '', false, 2);
  let allied = false;
  for (let step = 0; step < 500; step++) {
    if (!allied && game.phase === 1 && game.nexus && !game.spiceWindow &&
        !game.spiceResolution && !game.response && !game.decision && !game.phaseOpening) {
      game = applyAction(game, emperor.id, {type: 'alliance', target: atreides.id});
      game = applyAction(game, atreides.id, {type: 'alliance', target: emperor.id});
      allied = true;
      continue;
    }
    if (game.phase === 5 && !game.phaseOpening && !game.response && !game.decision) break;
    game = nativeStep(game);
  }
  assert.ok(allied && game.phase === 5);
  let actor = emperor.id;
  if (mode === 'laterEnding' && !game.advanced) {
    game = advanceToNextStorm(game);
    orderSpice(game, '');
    game = finishToMovement(game);
    actor = atreides.id;
  }
  while (game.active !== actor) game = applyAction(game, game.active!, {type: 'endMovement'});
  const ally = game.players.find(p => p.id === actor)!.ally!;
  assert.ok(ally && game.players.find(p => p.id === ally)!.ally === actor);
  for (const id of [actor, ally])
    assert.equal(Object.entries(game.players.find(p => p.id === id)!.forces)
      .filter(([key]) => splitLocation(key).territory === 'imperial_basin')
      .reduce((total, [, count]) => total + count, 0), 2);
  return {game, actor, ally, other: game.players.find(p => p.id !== actor && p.id !== ally)!.id,
    turn: game.turn, lossTerritories: ['imperial_basin']};
}

export function createAdvancedSourceFixture(options: AdvancedSourceFixtureOptions = {}): AdvancedSourceFixture {
  let game = freshSetup(options);
  const mode = options.alliance;
  const advisors = mode === 'ownAdvisors' || mode === 'allyAdvisors';
  const host = game.players[0].id;
  if (!mode) {
    if (options.storm === 'next') game = advanceToNextStorm(game);
    return {game, actor: host, ally: null, other: game.players[1]?.id ?? null, turn: game.turn, lossTerritories: []};
  }
  if (ordinaryAlliance(mode)) return createOrdinaryAlliance(game, mode);
  const fremen = game.players.find(p => p.faction === 'fremen');
  const native = game.players.find(p => p.faction === (mode === 'ecaz' ? 'ecaz' : 'atreides'));
  assert.ok(fremen && native, 'An actual native Fremen and destination owner must be admitted.');
  const bg = game.players.find(p => p.faction === 'beneGesserit');
  if (advisors) assert.ok(bg && game.advanced, 'Advisor cases require genuine Advanced BG setup.');
  const sand = TERRITORIES.find(t => fremenReserveEntry(t.id) && t.sectors.some(s => s > 7) &&
    game.players.every(p => Object.keys(p.forces).every(key => splitLocation(key).territory !== t.id)) &&
    game.spiceDeck.some(c => 'territory' in c && c.territory === t.id));
  assert.ok(sand);
  const sandSector = sand.sectors.find(s => s > 7)!;
  // The actual first blow seeds the native worm occurrence on the next turn.
  orderSpice(game, sand.id);
  if (game.advanced) orderSpice(game, '', false, 1);
  game = finishToMovement(game);
  assert.equal(game.spiceDiscard[0].findLast(c => 'territory' in c)?.territory, sand.id,
    'The first physical pile must seed the later native worm source.');
  while (game.phase === 5) {
    const actor = game.active!;
    if (!advisors && actor === fremen.id) game = settleAdvancedSourceResponses(applyAction(game, actor,
      {type: 'ship', territory: sand.id, sector: sandSector, amount: 2, ...(game.advanced ? {elite: 1} : {})}));
    if (mode === 'polar' && actor === native.id) game = settleAdvancedSourceResponses(applyAction(game, actor,
      {type: 'ship', territory: 'polar_sink', sector: 0, amount: 2}));
    game = applyAction(game, actor, {type: 'endMovement'});
  }
  game = advanceToNextStorm(game);
  orderSpice(game, '', true);
  // Finish the worm's replacement and second physical pile with conserved
  // territory faces, not an incidental extra worm or Sandtrout.
  orderSpice(game, '', false, 1);
  if (game.advanced) orderSpice(game, '', false, 2);
  let rode = advisors;
  const destination = mode === 'polar' ? 'polar_sink' : mode === 'ecaz' ? 'imperial_basin' : 'arrakeen';
  const destinationSector = mode === 'polar' ? 0 : mode === 'ecaz' ?
    splitLocation(Object.keys(game.players.find(p => p.id === native.id)!.forces)[0]).sector : 10;
  const left = advisors ? native.id : fremen.id;
  const right = advisors ? bg!.id : native.id;
  let allied = false;
  for (let step = 0; step < 500; step++) {
    // Natural Nexus precedes its ride. Completing that ride clears nexus,
    // so reciprocal offers must occur at this actual legal boundary.
    if (!allied && game.phase === 1 && game.nexus && !game.spiceWindow &&
        !game.spiceResolution && !game.response && !game.decision && !game.phaseOpening) {
      game = applyAction(game, left, {type: 'alliance', target: right});
      game = applyAction(game, right, {type: 'alliance', target: left});
      allied = true;
      continue;
    }
    if (!rode && game.decision?.kind === 'wormRide' && game.decision.player === fremen.id) {
      assert.equal(game.decision.territory, sand.id);
      const forces = Object.fromEntries(Object.entries(game.players.find(p => p.id === fremen.id)!.forces)
        .filter(([key]) => splitLocation(key).territory === sand.id));
      game = applyAction(game, fremen.id, {type: 'decision', accept: true, territory: destination,
        sector: destinationSector, forces});
      rode = true;
      continue;
    }
    if (game.phase === 5 && !game.phaseOpening && !game.response && !game.decision) break;
    game = nativeStep(game);
  }
  assert.ok(allied && rode && game.phase === 5 && !game.decision && !game.response,
    'The genuine reciprocal Nexus alliance and requested worm ride must reach native movement.');
  const pair = [left, right].sort((a, b) => game.movementRemaining!.indexOf(a) - game.movementRemaining!.indexOf(b));
  const actor = mode === 'ownAdvisors' ? bg!.id : mode === 'allyAdvisors' ? native.id : pair[0];
  while (game.active !== actor) game = applyAction(game, game.active!, {type: 'endMovement'});
  const ally = game.players.find(p => p.id === actor)!.ally;
  assert.ok(ally);
  assert.equal(game.players.find(p => p.id === ally)!.ally, actor);
  for (const id of [actor, ally])
    assert.ok(Object.entries(game.players.find(p => p.id === id)!.forces)
      .some(([key, amount]) => amount > 0 && splitLocation(key).territory === destination),
    'Both genuine allied force groups must occupy the requested edge territory.');
  // The exception scenarios have overlap but correctly no consequence quote.
  const lossTerritories = advisors || mode === 'ecaz' || mode === 'polar' ? [] : [destination];
  return {game, actor, ally, other: game.players.find(p => p.id !== actor && p.id !== ally)?.id ?? null,
    turn: game.turn, lossTerritories};
}
