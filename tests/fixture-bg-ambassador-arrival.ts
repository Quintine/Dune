import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeFactionExpansionsGameForAudit, joinGame,
  newPlayer, type Action, type Game,
} from '../game/engine';
import { nextRicheseSkillsTechNativeStep } from './fixture-richese-skills-tech';

export type BgAmbassadorArrivalStep = { actor: string; action: Action };
export type BgAmbassadorArrivalFixture = {
  initial: Game;
  afterSetup: Game;
  beforePlacement: Game;
  beforeShipment: Game;
  game: Game;
  actions: BgAmbassadorArrivalStep[];
  owner: string;
  advisor: string;
  entrant: string;
  territory: string;
  location: string;
  token: string;
  fighters: boolean;
  shipmentAction: Action;
  movementAction: Action;
  staging: string[];
};

export function bgAmbassadorArrivalPlayer(game: Game, actor: string) {
  const player = game.players.find(player => player.id === actor);
  assert.ok(player, `Missing original BG arrival seat ${actor}`);
  return player;
}
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision && !game.pendingTreacheryDiscard;

/** Native entropy only: original shuffles/deals retain their physical inventories.
 * No hand, force, wallet, stance, turn, receipt or decision is assigned. */
function entropy<T>(run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    assert.ok(array);
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(255);
    return array;
  };
  try { return run(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Original no-spend/no-call driver, including the native owned BG controls. */
export function nextBgAmbassadorArrivalStep(game: Game): BgAmbassadorArrivalStep {
  if (!game.phaseOpening && !game.response) {
    const bg = game.players.find(player => player.faction === 'beneGesserit')!;
    const ecaz = game.players.find(player => player.faction === 'ecaz')!;
    if (game.status === 'setup' && game.setupStage === 'prediction')
      return { actor: bg.id, action: { type: 'predict', faction: 'emperor', turn: 10 } };
    if (game.status === 'setup' && game.setupStage === 'forces') {
      if (ecaz.reserves === 20)
        return { actor: ecaz.id, action: { type: 'ecazSetup', placements: { 'imperial_basin:10': 6 } } };
      if (!bg.advisorSetup)
        return { actor: bg.id, action: { type: 'advisorSetup', territory: 'imperial_basin', sector: 10 } };
    }
    const decision = game.decision;
    if (decision?.kind === 'ecazPlacement')
      return { actor: decision.player, action: { type: 'decision', decline: true } };
    if (decision?.kind === 'advisor' || decision?.kind === 'intrusion' || decision?.kind === 'advisorBattle')
      return { actor: decision.player, action: { type: 'decision', accept: false } };
    if (decision?.kind === 'ecazAmbassador') {
      assert.ok(game.pendingAmbassador);
      return { actor: decision.player, action: { type: 'decision', event: game.pendingAmbassador.event, decline: true } };
    }
  }
  const step = nextRicheseSkillsTechNativeStep(game);
  if (step.action.type === 'stormDial') step.action.amount = 0;
  return step;
}

export function applyBgAmbassadorArrivalStep(
  game: Game, step: BgAmbassadorArrivalStep, actions?: BgAmbassadorArrivalStep[],
): Game {
  actions?.push(structuredClone(step));
  return entropy(() => applyAction(game, step.actor, step.action));
}

function advance(game: Game, until: (state: Game) => boolean, actions: BgAmbassadorArrivalStep[]): Game {
  for (let n = 0; n < 2400; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'Original BG arrival must remain in its native game');
    game = applyBgAmbassadorArrivalStep(game, nextBgAmbassadorArrivalStep(game), actions);
  }
  throw Error('Original native BG arrival did not reach the requested boundary');
}

/** Allow response/acknowledgement windows, including a committed Spiritual
 * arrival's automatic conversion. Never choose Intrusion, accompaniment or an
 * Ambassador offer; tests stop at those original owned decisions. */
export function settleBgAmbassadorArrivalControls(game: Game, actions: BgAmbassadorArrivalStep[] = []): Game {
  return advance(game, state => !state.response && !state.phaseOpening && !state.pendingTreacheryDiscard, actions);
}

/** Controlled already-declared legacy control, not fresh accompaniment permission.
 * Keep the earned shipment, parent, forces, cards and wallets; replace only its
 * current advisor chooser with the old recorded response shape, without the new
 * Spiritual source. This isolates the retained callback protocol. */
export function recordControlledLegacyBgAdvisorResponse(state: Game): Game {
  const decision = state.decision;
  assert.ok(decision?.kind === 'advisor' && decision.destination);
  assert.ok(!state.response && !state.pendingSpiritualAdvisor);
  const game = structuredClone(state);
  game.decision = null;
  game.response = {
    kind: 'advisor', owner: decision.player, location: decision.destination,
    amount: 1, passed: [],
    ...(decision.ambassadorEvent === undefined ? {} : {
      advisorResume: 'ambassador' as const, advisorAmbassadorEvent: decision.ambassadorEvent,
    }),
  };
  assert.equal(game.response.spiritualAdvisorSource, undefined);
  return game;
}

function orderLandBlows(game: Game, staging: string[]) {
  for (let at = 0; at < 2; at++) {
    const index = game.spiceDeck.findIndex((card, index) => index >= at && 'territory' in card &&
      !['imperial_basin', 'carthag'].includes(card.territory));
    assert.ok(index >= at, 'Two original undealt land blows must remain');
    const card = game.spiceDeck.splice(index, 1)[0];
    game.spiceDeck.splice(at, 0, card);
    assert.ok('territory' in card);
    staging.push(`Turn ${game.turn}: original undealt ${card.territory} land blow moved to slot ${at + 1}.`);
  }
}

/** Original Advanced Ecaz/BG/Emperor setup and paid entry, stopped BEFORE ship.
 * In the fighter variant the original Imperial Basin advisor actually moves to
 * empty Carthag on turn one, becoming a fighter by the native automatic rule.
 * Ecaz leaves turn-one placement unused, then marks Carthag on turn two: no
 * preceding BG Ambassador trigger or fabricated fighter group is needed.
 * The only controlled values are producer entropy, a conserved undealt Karama
 * starting-deal slot and unplayed Spice order. Supplied fresh lobbies retain
 * their original seat identities; no HTTP authentication claim is made. */
export function createBgAmbassadorArrivalFixture(options: { initial?: Game; fighters?: boolean } = {}): BgAmbassadorArrivalFixture {
  let game = options.initial ? structuredClone(options.initial)
    : createGame('BGAMBASSADORARRIVAL', newPlayer('bg', 'Bene Gesserit', 'beneGesserit'), true, ['ecaz']);
  if (!options.initial) {
    joinGame(game, newPlayer('ecaz', 'Ecaz', 'ecaz'));
    joinGame(game, newPlayer('emperor', 'Emperor', 'emperor'));
  }
  assert.equal(game.status, 'lobby', 'Only an original undealt lobby can enter');
  assert.equal(game.advanced, true);
  assert.deepEqual(game.expansions, ['ecaz']);
  assert.equal(game.players.length, 3);
  const owner = game.players.find(player => player.faction === 'ecaz')?.id;
  const advisor = game.players.find(player => player.faction === 'beneGesserit')?.id;
  const entrant = game.players.find(player => player.faction === 'emperor')?.id;
  assert.ok(owner && advisor && entrant, 'Original seats must be Ecaz, Bene Gesserit and Emperor');
  const initial = structuredClone(game), actions: BgAmbassadorArrivalStep[] = [], staging: string[] = [];
  for (const player of game.players)
    if (!player.ready) game = applyBgAmbassadorArrivalStep(game, { actor: player.id, action: { type: 'ready' } }, actions);
  game = entropy(() => initializeFactionExpansionsGameForAudit(game));
  // Give Ecaz a real cancellation opportunity through its ORIGINAL starting
  // deal, not a card transfer into an already dealt hand.
  const dealSlot = game.players.findIndex(player => player.id === owner);
  const karamaIndex = game.deck.findIndex(card => card.effect === 'karama');
  assert.ok(karamaIndex >= 0 && game.players.every(player => !player.hand.length));
  const karama = game.deck[karamaIndex].id;
  [game.deck[dealSlot], game.deck[karamaIndex]] = [game.deck[karamaIndex], game.deck[dealSlot]];
  staging.push(`Original undealt ${karama} swapped into Ecaz's starting-deal slot ${dealSlot + 1}; no dealt hand is changed.`);
  game = advance(game, state => state.status === 'playing', actions);
  const afterSetup = structuredClone(game);
  assert.ok(bgAmbassadorArrivalPlayer(game, owner).hand.some(card => card.id === karama));
  assert.equal(bgAmbassadorArrivalPlayer(game, advisor).forces['imperial_basin:10'], 1);
  assert.ok(bgAmbassadorArrivalPlayer(game, advisor).advisors?.imperial_basin);
  game = advance(game, state => state.phase === 1 && clean(state), actions);
  orderLandBlows(game, staging);
  const fighters = options.fighters ?? false;
  if (fighters) {
    game = advance(game, state => state.phase === 5 && state.active === advisor && clean(state), actions);
    game = applyBgAmbassadorArrivalStep(game, { actor: advisor, action: {
      type: 'move', from: 'imperial_basin:10', territory: 'carthag', sector: 11, amount: 1,
    } }, actions);
    game = settleBgAmbassadorArrivalControls(game, actions);
    assert.ok(clean(game));
    assert.equal(bgAmbassadorArrivalPlayer(game, advisor).forces['carthag:11'], 1);
    assert.equal(bgAmbassadorArrivalPlayer(game, advisor).advisors?.carthag, undefined);
    game = advance(game, state => state.turn === 2 && state.phase === 1 && clean(state), actions);
    orderLandBlows(game, staging);
  }
  game = advance(game, state => state.phase === 4 && state.decision?.kind === 'ecazPlacement', actions);
  const beforePlacement = structuredClone(game);
  const token = game.ecazAmbassadors!.tokens.find(token => token.effect === 'ecaz')!;
  assert.equal(token.zone, 'supply');
  const placementWallet = bgAmbassadorArrivalPlayer(game, owner).spice;
  game = applyBgAmbassadorArrivalStep(game, { actor: owner, action: {
    type: 'decision', token: token.id, territory: 'carthag',
  } }, actions);
  game = settleBgAmbassadorArrivalControls(game, actions);
  assert.equal(bgAmbassadorArrivalPlayer(game, owner).spice, placementWallet - 1);
  assert.equal(game.ecazAmbassadors!.tokens.find(candidate => candidate.id === token.id)!.location, 'carthag');
  assert.equal(game.decision?.kind, 'ecazPlacement');
  game = applyBgAmbassadorArrivalStep(game, { actor: owner, action: { type: 'decision', decline: true } }, actions);
  game = advance(game, state => state.phase === 5 && state.active === entrant && clean(state), actions);
  assert.equal(bgAmbassadorArrivalPlayer(game, advisor).forces['carthag:11'] ?? 0, fighters ? 1 : 0);
  assert.ok(!game.pendingAmbassador && !game.pendingArrivalReaction?.length);
  const beforeShipment = structuredClone(game);
  return {
    initial, afterSetup, beforePlacement, beforeShipment, game, actions, owner, advisor, entrant,
    territory: 'carthag', location: 'carthag:11', token: token.id, fighters, staging,
    shipmentAction: { type: 'ship', territory: 'carthag', sector: 11, amount: 1, elite: 0, allyPayment: 0 },
    movementAction: { type: 'move', from: 'carthag:11', territory: 'arsunt', sector: 11, amount: 1 },
  };
}

/** First bad transition is intentionally outside the original builder. */
export function beginBgAmbassadorArrival(fixture: BgAmbassadorArrivalFixture): Game {
  return settleBgAmbassadorArrivalControls(applyBgAmbassadorArrivalStep(fixture.game, {
    actor: fixture.entrant, action: fixture.shipmentAction,
  }));
}

export function bgAmbassadorAccompanimentAction(accept: boolean, accompany = true): Action {
  return accept ? { type: 'decision', accept: true, accompany, amount: 1 }
    : { type: 'decision', accept: false };
}
export function bgAmbassadorIntrusionAction(accept: boolean): Action {
  return { type: 'decision', accept };
}
export function bgAmbassadorOfferAction(game: Game, trigger = false): Action {
  const entry = game.pendingAmbassador;
  assert.ok(entry);
  return trigger ? { type: 'decision', event: entry.event, trigger: true, beneficiary: entry.owner, choice: 'duke' }
    : { type: 'decision', event: entry.event, decline: true };
}
export function finishBgAmbassadorArrival(game: Game, trigger = false): Game {
  const entry = game.pendingAmbassador;
  assert.ok(entry);
  return settleBgAmbassadorArrivalControls(applyBgAmbassadorArrivalStep(game, {
    actor: entry.owner, action: bgAmbassadorOfferAction(game, trigger),
  }));
}
