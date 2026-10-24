import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { MOBILE_LOCATION, MOBILE_STRONGHOLD, TERRITORIES, splitLocation } from '../game/board';
import { AMBASSADOR_EFFECTS, type AmbassadorEffect } from '../game/ecaz-ambassadors';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';

export type EcazHmsAmbassadorStep = { actor: string; action: Action };
export type EcazHmsAmbassadorTransition = {
  before: Game; steps: EcazHmsAmbassadorStep[]; after: Game;
};
export const ecazHmsAmbassadorPlayer = (game: Game, id: string) => {
  const player = game.players.find(player => player.id === id); assert.ok(player); return player;
};
export const ecazHmsAmbassadorClean = (game: Game) => !game.response && !game.phaseOpening &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard;
export const ecazHmsAmbassadorInventory = (game: Game) => {
  const cards = [...game.deck, ...game.discard, ...(game.ixSetupCards ?? []),
    ...(game.ixAuction?.cards ?? []), ...(game.auction?.cards.slice(game.auction.index) ?? []),
    ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...game.players.flatMap(player => player.hand)];
  const ids = cards.map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'Original physical Treachery Cards retain distinct current slots');
  return ids;
};

/** Select original scalar lotteries only; native UUIDs and byte entropy remain
 * untouched. The nine supplied values are consumed by the original Ecaz packet. */
function originalLottery<T>(run: () => T, rolls: readonly number[] = []): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto); let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1)
      array[0] = cursor < rolls.length ? rolls[cursor++] : 0xffffffff;
    else Reflect.apply(original, crypto, [array]);
    return array;
  };
  try {
    const result = run(); assert.equal(cursor, rolls.length, 'Original Ambassador packet consumes its nine selected draws');
    return result;
  } finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
export function actEcazHmsAmbassador(game: Game, actor: string, action: Action,
  actions: EcazHmsAmbassadorStep[] = []): Game {
  const next = originalLottery(() => applyAction(game, actor, action));
  actions.push({ actor, action: structuredClone(action) }); return next;
}
/** Only live native windows advance. Placement, entry and later HMS movement
 * are caller-owned controls, never installed fixture state. */
export function nextEcazHmsAmbassadorStep(game: Game): EcazHmsAmbassadorStep | null {
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    if (game.decision?.kind === 'ecazPlacement' || game.decision?.kind === 'ecazAmbassador' ||
        game.decision?.kind === 'mobileStronghold') return null;
    if (game.status === 'setup' && game.setupStage === 'forces' &&
        ecazHmsAmbassadorPlayer(game, 'ecaz').reserves === 20)
      return { actor: 'ecaz', action: { type: 'ecazSetup', placements: { 'imperial_basin:9': 6 } } };
    if (game.decision?.kind === 'guildTiming')
      return { actor: game.decision.player, action: { type: 'decision', take: false } };
    if (game.decision?.kind === 'ixAuction') {
      const card = game.ixAuction!.cards[0]; assert.ok(card);
      return { actor: game.decision.player, action: { type: 'decision', card: card.id, position: 'bottom' } };
    }
  }
  return nextRicheseStrongholdsNativeStep(game);
}
export function advanceEcazHmsAmbassador(game: Game, until: (state: Game) => boolean,
  actions: EcazHmsAmbassadorStep[] = []): Game {
  for (let count = 0; count < 1600; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The genuine HMS chronology ended before its requested control');
    const next = nextEcazHmsAmbassadorStep(game);
    assert.ok(next, `Choose the original control before advancing: ${JSON.stringify({
      status: game.status, turn: game.turn, phase: game.phase, active: game.active, decision: game.decision,
    })}`);
    game = actEcazHmsAmbassador(game, next.actor, next.action, actions);
  }
  throw Error('The original HMS Ambassador source did not reach its finite boundary');
}
export function passEcazHmsAmbassadorResponses(game: Game,
  actions: EcazHmsAmbassadorStep[] = []): Game {
  for (let count = 0; game.response && count < 60; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actEcazHmsAmbassador(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.equal(game.response, null); return game;
}
function originalPacket(effect: 'emperor' | 'choam' | 'ixians') {
  const pool = AMBASSADOR_EFFECTS.filter(effect => effect !== 'ecaz');
  const supply: Exclude<AmbassadorEffect, 'ecaz'>[] = [effect,
    ...pool.filter(candidate => candidate !== effect).slice(0, 4)];
  const desired = [...supply, ...pool.filter(candidate => !supply.includes(candidate))];
  const current = [...pool], rolls: number[] = [];
  for (let i = current.length - 1; i > 0; i--) {
    const j = current.indexOf(desired[i]); assert.ok(j >= 0 && j <= i);
    rolls.push(Math.floor((j + 0.5) * 0x100000000 / (i + 1)));
    [current[i], current[j]] = [current[j], current[i]];
  }
  assert.deepEqual(current, desired); assert.equal(rolls.length, 9); return { rolls, supply };
}

/** Genuine public bare E1+E3 Basic/Advanced source. Native starting forces,
 * private Ixian starting-card choice, first Storm and HMS placement all execute.
 * Stop at the actual end-of-Revival opportunity BEFORE Ambassador declaration.
 * Only original unopened card/Spice positions and the original packet lottery
 * are selected. No army, wallet, alliance, phase, token, receipt or event is set. */
export function createEcazHmsAmbassadorFixture(options: {
  advanced?: boolean; effect?: 'emperor' | 'choam' | 'ixians'; inStorm?: boolean; karama?: boolean;
} = {}) {
  const advanced = options.advanced ?? false, effect = options.effect ?? 'emperor';
  const ecaz = 'ecaz', ix = 'ixians', guild = 'guild';
  let game = createGame('ECAZHMSAMBASSADOR', newPlayer(ecaz, 'Ecaz', 'ecaz'), advanced, ['ix', 'ecaz']);
  joinGame(game, newPlayer(ix, 'Ixians', 'ixians'));
  joinGame(game, newPlayer(guild, 'Guild', 'guild'));
  const initial = structuredClone(game), actions: EcazHmsAmbassadorStep[] = [];
  const act = (actor: string, action: Action) => { game = actEcazHmsAmbassador(game, actor, action, actions); };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, advanced);
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => player.hand.length === 0));
  const originalInventory = ecazHmsAmbassadorInventory(game);
  const ordinary = game.deck.filter(card => ['projectile', 'poison', 'shield', 'snooper'].includes(card.kind)).slice(0, 3);
  assert.equal(ordinary.length, 3);
  const karamaCard = options.karama ? game.deck.find(card => card.effect === 'karama') : null;
  if (options.karama) { assert.ok(karamaCard); ordinary[0] = karamaCard; }
  const dealOrder = ordinary.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game), packet = originalPacket(effect);
  let packetCreation: EcazHmsAmbassadorTransition | null = null;
  let privateChoice: EcazHmsAmbassadorTransition | null = null;
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    const next = nextEcazHmsAmbassadorStep(game); assert.ok(next);
    const before = structuredClone(game);
    const initializesForces = game.setupStage === 'traitors' && next.action.type === 'traitor' &&
      game.players.filter(player => player.traitorChoices.length > 0).length === 1;
    if (initializesForces) {
      game = originalLottery(() => applyAction(game, next.actor, next.action), packet.rolls);
      actions.push(structuredClone(next));
      packetCreation = { before, steps: [structuredClone(next)], after: structuredClone(game) };
    } else {
      act(next.actor, next.action);
      if (before.decision?.kind === 'ixSetup')
        privateChoice = { before, steps: [structuredClone(next)], after: structuredClone(game) };
    }
  }
  assert.equal(game.status, 'playing'); assert.ok(packetCreation && privateChoice);
  assert.deepEqual(game.ecazAmbassadors!.cohort.map(id =>
    game.ecazAmbassadors!.tokens.find(token => token.id === id)!.effect), packet.supply);
  assert.equal(ecazHmsAmbassadorPlayer(game, ix).forces[MOBILE_LOCATION], 6);
  assert.equal(ecazHmsAmbassadorPlayer(game, ix).elites?.forces[MOBILE_LOCATION], 3);
  assert.equal(game.mobileStronghold?.location, null);
  assert.ok(!options.karama || ecazHmsAmbassadorPlayer(game, ix).hand.some(card => card.id === karamaCard!.id));
  const afterSetup = structuredClone(game), originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1, 2, 3].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  game = advanceEcazHmsAmbassador(game, state => !state.response && !state.phaseOpening &&
    state.decision?.kind === 'mobileStronghold' && state.decision.placement, actions);
  const point = options.inStorm
    ? `${TERRITORIES.find(territory => territory.type !== 'stronghold' && territory.sectors.includes(game.storm))!.id}:${game.storm}`
    : 'rock_outcroppings:14';
  const hmsStep: EcazHmsAmbassadorStep = { actor: ix, action: { type: 'decision', location: point } };
  const hmsBefore = structuredClone(game); act(ix, hmsStep.action);
  const hmsPlacement: EcazHmsAmbassadorTransition = { before: hmsBefore, steps: [hmsStep], after: structuredClone(game) };
  game = advanceEcazHmsAmbassador(game, state => state.phase === 4 && !state.response && !state.phaseOpening &&
    state.decision?.kind === 'ecazPlacement', actions);
  const token = game.ecazAmbassadors!.tokens.find(token => token.effect === effect)!;
  assert.equal(token.zone, 'supply'); assert.equal(token.location, null);
  assert.equal(game.ecazAmbassadors!.placement, null);
  assert.equal(game.mobileStronghold?.location, point);
  assert.equal(ecazHmsAmbassadorPlayer(game, ix).forces[MOBILE_LOCATION], 6);
  assert.equal(ecazHmsAmbassadorPlayer(game, ix).elites?.forces[MOBILE_LOCATION], 3);
  assert.deepEqual(ecazHmsAmbassadorInventory(game), originalInventory);
  const placementStep: EcazHmsAmbassadorStep = { actor: ecaz,
    action: { type: 'decision', token: token.id, territory: MOBILE_STRONGHOLD } };
  return { game, initial, lobby, setup, beforeStartingDeal, afterSetup, ecaz, ix, guild, entrant: guild,
    token: token.id, effect, advanced, location: MOBILE_STRONGHOLD, interior: MOBILE_LOCATION,
    point, pointer: splitLocation(point), actions, originalInventory, originalSpice, dealOrder, spiceOrder,
    packetCreation, privateChoice, hmsPlacement, karama: karamaCard?.id ?? null, placementStep,
    placement: placementStep.action, finishPlacement: { type: 'decision', decline: true } satisfies Action,
    shipment: { type: 'ship', territory: splitLocation(point).territory, sector: splitLocation(point).sector,
      amount: 1, elite: 0, allyPayment: 0 } satisfies Action,
    movement: { type: 'move', from: point, territory: MOBILE_STRONGHOLD, sector: 0, amount: 1 } satisfies Action,
    endMovement: { type: 'endMovement' } satisfies Action,
    staging: [
      'Actual public Ecaz/Ixians/Guild ready/start and private Traitor choices. Select only three original unopened Treachery positions, then choose the native first offered Ixian card; the original remainder shuffle deals the other two cards.',
      'Select exactly nine original Ecaz packet scalars on the final Traitor choice, before native forces and Ambassador inventory are created. Ecaz is the first seat; Ixians and Guild follow.',
      'Select four original unopened ordinary Spice positions. Native first Storm dials, destruction, HMS placement, Spice, Bidding and Revival all execute; no played phase, wallet, army, alliance, token custody, reaction or receipt is assigned.',
      'The source stops before original paid Ambassador placement. HMS starts with its native six counters, including three original Cyborgs. Its source pointer comes from the actual first-Storm placement decision.',
    ],
  };
}
export type EcazHmsAmbassadorFixture = ReturnType<typeof createEcazHmsAmbassadorFixture>;

/** Submit the actual source declaration and settle only its live response. */
export function placeEcazHmsAmbassador(fixture: EcazHmsAmbassadorFixture,
  actions: EcazHmsAmbassadorStep[] = []): Game {
  let game = actEcazHmsAmbassador(fixture.game, fixture.ecaz, fixture.placement, actions);
  game = passEcazHmsAmbassadorResponses(game, actions);
  assert.equal(game.decision?.kind, 'ecazPlacement');
  assert.equal(game.ecazAmbassadors!.tokens.find(token => token.id === fixture.token)?.location, MOBILE_STRONGHOLD);
  return game;
}
/** Start from a committed real placement. Native earlier turns end normally;
 * Guild pays for an outside shipment, then really moves into the HMS interior.
 * The original Ecaz entry offer remains a caller-owned decision. */
export function enterEcazHmsAmbassador(source: Game, fixture: EcazHmsAmbassadorFixture,
  actions: EcazHmsAmbassadorStep[] = []) {
  let game = actEcazHmsAmbassador(source, fixture.ecaz, fixture.finishPlacement, actions);
  game = advanceEcazHmsAmbassador(game, state => state.phase === 5 && state.active === fixture.guild &&
    ecazHmsAmbassadorClean(state), actions);
  const beforeShipment = structuredClone(game), shipmentStart = actions.length;
  game = actEcazHmsAmbassador(game, fixture.guild, fixture.shipment, actions);
  game = advanceEcazHmsAmbassador(game, ecazHmsAmbassadorClean, actions);
  const shipment: EcazHmsAmbassadorTransition = { before: beforeShipment,
    steps: structuredClone(actions.slice(shipmentStart)), after: structuredClone(game) };
  assert.equal(ecazHmsAmbassadorPlayer(game, fixture.guild).forces[fixture.point], 1);
  assert.ok(!game.pendingAmbassador);
  const beforeMovement = structuredClone(game), movementStart = actions.length;
  game = actEcazHmsAmbassador(game, fixture.guild, fixture.movement, actions);
  game = advanceEcazHmsAmbassador(game, state => !state.response && !state.phaseOpening &&
    state.pendingAmbassador?.stage === 'offer', actions);
  const movement: EcazHmsAmbassadorTransition = { before: beforeMovement,
    steps: structuredClone(actions.slice(movementStart)), after: structuredClone(game) };
  assert.equal(game.pendingAmbassador?.territory, MOBILE_STRONGHOLD);
  assert.equal(game.pendingAmbassador.entrant, fixture.guild);
  assert.equal(game.pendingAmbassador.arrivalCause, 'movement');
  assert.equal(ecazHmsAmbassadorPlayer(game, fixture.guild).forces[MOBILE_LOCATION], 1);
  assert.equal(ecazHmsAmbassadorPlayer(game, fixture.guild).forces[fixture.point] ?? 0, 0);
  return { game, event: game.pendingAmbassador.event, shipment, movement };
}
