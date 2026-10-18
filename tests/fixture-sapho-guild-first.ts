import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { richeseCards } from '../game/richese-cards';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';

const sapho = richeseCards().find(card => card.effect === 'juiceOfSapho'); assert.ok(sapho);
export const GUILD_FIRST_SAPHO = sapho.id;
export type SaphoGuildFirstStep = { actor: string; action: Action };
export const saphoGuildFirstPlayer = (game: Game, actor = 'emperor') => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const saphoGuildFirstClean = (game: Game) => !game.response && !game.phaseOpening &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard;
export function actSaphoGuildFirst(game: Game, actor: string, action: Action, actions: SaphoGuildFirstStep[] = []): Game {
  const next = withClassicDiscoveryNexusLottery(() => applyAction(game, actor, action));
  actions.push({ actor, action: structuredClone(action) }); return next;
}
export function nextSaphoGuildFirstStep(game: Game): SaphoGuildFirstStep | null {
  if (!game.response && !game.phaseOpening && game.decision) {
    const decision = game.decision;
    if (decision.kind === 'guildTiming') return { actor: decision.player, action: { type: 'decision', take: false } };
    if (decision.kind === 'richeseCache') {
      const card = game.richeseCache!.find(card => card.id === GUILD_FIRST_SAPHO) ?? game.richeseCache![0]; assert.ok(card);
      return { actor: decision.player, action: { type: 'decision', event: game.richeseBidding!.event,
        card: card.id, method: 'onceAround', direction: 'clockwise' } };
    }
    if (decision.kind === 'richeseUnbid') return { actor: decision.player,
      action: { type: 'decision', event: game.richeseBidding!.event, keep: false } };
  }
  const lot = game.richeseAuction;
  if (saphoGuildFirstClean(game) && lot?.cardId === GUILD_FIRST_SAPHO && !lot.outcome &&
    lot.active === 'emperor' && lot.bid === 0)
    return { actor: 'emperor', action: { type: 'richeseBid', event: lot.event, amount: 1, allyPayment: 0 } };
  return nextRicheseStrongholdsNativeStep(game);
}
export function advanceSaphoGuildFirst(game: Game, until: (state: Game) => boolean,
  actions: SaphoGuildFirstStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Sapho/Guild programme ended before its next control');
    const step = nextSaphoGuildFirstStep(game); assert.ok(step, 'Finish the original owned control before advancing');
    game = actSaphoGuildFirst(game, step.actor, step.action, actions);
  }
  throw Error('The original Sapho/Guild programme did not reach its finite boundary');
}

/** Genuine public host/setup, paid cache1 Sapho and native Guild WAIT. One
 * original Karama is selected while the starting deck is still unopened, then
 * actually dealt to Atreides so native TAKE has a real allow/cancel control.
 * The optional completed prefix is an original paid shipment and explicit end.
 * No dealt hand, force, money, phase, queue or timing receipt is installed. */
export function createSaphoGuildFirstFixture(options: { completedFirst?: boolean } = {}) {
  let game = createGame('SAPHOGUILDFIRST', newPlayer('richese', 'Richese', 'richese'), true, ['choam']);
  for (const faction of ['atreides', 'emperor', 'guild'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const actions: SaphoGuildFirstStep[] = [];
  const act = (actor: string, action: Action) => { game = actSaphoGuildFirst(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSaphoGuildFirst(game, until, actions); };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, { type: 'start', advancedPreview: true });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup');
  assert.ok(game.players.every(player => player.hand.length === 0));
  const index = game.deck.findIndex(card => card.effect === 'karama'); assert.ok(index >= 0);
  const counter = game.deck[index].id;
  [game.deck[1], game.deck[index]] = [game.deck[index], game.deck[1]];
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), front: Game['spiceDeck'] = [];
  assert.ok(saphoGuildFirstPlayer(game, 'atreides').hand.some(card => card.id === counter));
  for (let count = 0; count < 2; count++) {
    const at = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery); assert.ok(at >= 0);
    front.push(game.spiceDeck.splice(at, 1)[0]);
  }
  game.spiceDeck.unshift(...front);
  reach(state => saphoGuildFirstPlayer(state).hand.some(card => card.id === GUILD_FIRST_SAPHO));
  const acquired = structuredClone(game);
  reach(state => state.phase === 5 && !state.response && !state.phaseOpening && state.decision?.kind === 'guildTiming');
  const beforeGuildWait = structuredClone(game), waits: { before: Game; step: SaphoGuildFirstStep; after: Game }[] = [];
  const wait = () => {
    assert.equal(game.decision?.kind, 'guildTiming');
    const before = structuredClone(game), step: SaphoGuildFirstStep = { actor: 'guild', action: { type: 'decision', take: false } };
    act(step.actor, step.action); reach(saphoGuildFirstClean);
    waits.push({ before, step, after: structuredClone(game) });
  };
  wait();
  let prefix: { before: Game; shipment: SaphoGuildFirstStep; afterShipment: Game; end: SaphoGuildFirstStep; afterEnd: Game } | null = null;
  if (options.completedFirst) {
    assert.equal(game.active, 'richese');
    const before = structuredClone(game), shipment: SaphoGuildFirstStep = { actor: 'richese', action: {
      type: 'ship', territory: 'polar_sink', sector: 0, amount: 1, elite: 0, allyPayment: 0,
    } };
    act(shipment.actor, shipment.action); reach(saphoGuildFirstClean);
    const afterShipment = structuredClone(game), end: SaphoGuildFirstStep = { actor: 'richese', action: { type: 'endMovement' } };
    act(end.actor, end.action);
    const afterEnd = structuredClone(game);
    prefix = { before, shipment, afterShipment, end, afterEnd };
    wait();
  }
  return { game, lobby, setup, beforeStartingDeal, afterSetup, acquired, beforeGuildWait, waits, prefix, counter,
    card: GUILD_FIRST_SAPHO, owner: 'emperor', guild: 'guild', canceler: 'atreides',
    completedFirst: options.completedFirst ?? false, sourceActionCount: actions.length, actions,
    staging: ['Only the unopened original Atreides Karama starting-deal position, unopened first-turn land Spice positions and scalar lotteries are selected. Public host/setup, paid cache1, native Guild wait(s) and optional paid Richese prefix provide the original source. No postdeal custody, resources, clocks, queues or timing receipts are assigned.'] };
}
export type SaphoGuildFirstFixture = ReturnType<typeof createSaphoGuildFirstFixture>;
export function saphoGuildFirstAction(game: Game): Action {
  const option = viewGame(game, 'emperor').saphoOptions.find(option => option.scope === 'movement' && option.mode === 'first');
  assert.ok(option, 'The real unstarted non-Guild boundary must offer Sapho first');
  return { type: 'card', card: GUILD_FIRST_SAPHO, ...option };
}

/** Branch from the original first native decision, not a synthesized timing
 * state. A real distinct Atreides Karama may cancel TAKE; ordinary allowance
 * uses its actual pass response instead. */
export function prepareSaphoGuildTake(fixture: SaphoGuildFirstFixture, cancel = false) {
  const actions: SaphoGuildFirstStep[] = [];
  let game = actSaphoGuildFirst(structuredClone(fixture.beforeGuildWait), fixture.guild,
    { type: 'decision', take: true }, actions);
  const declared = structuredClone(game);
  assert.equal(game.response?.kind, 'guildTiming');
  if (cancel) game = actSaphoGuildFirst(game, fixture.canceler,
    { type: 'card', mode: 'cancel', card: fixture.counter }, actions);
  game = advanceSaphoGuildFirst(game, saphoGuildFirstClean, actions);
  return { game, declared, actions, cancel };
}

/** Sapho takes first among unstarted non-Guild turns; the real Guild timing
 * decision is reopened. TAKE is paid and finished before the holder, while WAIT
 * retains the original relative non-Guild suffix. Every turn explicitly ends. */
export function completeSaphoGuildFirst(fixture: SaphoGuildFirstFixture, take: boolean) {
  let game = structuredClone(fixture.game);
  const actions: SaphoGuildFirstStep[] = [], turns: {
    actor: string; before: Game; shipment: SaphoGuildFirstStep | null; afterShipment: Game;
    end: SaphoGuildFirstStep; afterEnd: Game;
  }[] = [];
  const act = (actor: string, action: Action) => { game = actSaphoGuildFirst(game, actor, action, actions); };
  const settle = () => { game = advanceSaphoGuildFirst(game, saphoGuildFirstClean, actions); };
  const first = saphoGuildFirstAction(game);
  act(fixture.owner, first);
  const reoffered = structuredClone(game);
  assert.equal(game.decision?.kind, 'guildTiming');
  act(fixture.guild, { type: 'decision', take });
  const declaredGuild = structuredClone(game);
  settle();
  const afterGuildChoice = structuredClone(game), seen = new Set<string>();
  for (let count = 0; game.phase === 5 && count < 80; count++) {
    if (!saphoGuildFirstClean(game)) { settle(); continue; }
    const actor = game.active; assert.ok(actor && !seen.has(actor), 'A completed native movement turn cannot recur');
    seen.add(actor);
    const before = structuredClone(game);
    const shipment: SaphoGuildFirstStep | null = actor === fixture.owner || actor === fixture.guild ? {
      actor, action: actor === fixture.owner
        ? { type: 'ship', territory: 'imperial_basin', sector: 9, amount: 1, elite: 0, allyPayment: 0 }
        : { type: 'ship', territory: 'carthag', sector: 11, amount: 1, elite: 0, allyPayment: 0 },
    } : null;
    if (shipment) { act(shipment.actor, shipment.action); settle(); }
    const afterShipment = structuredClone(game), end: SaphoGuildFirstStep = { actor, action: { type: 'endMovement' } };
    act(end.actor, end.action);
    turns.push({ actor, before, shipment, afterShipment, end, afterEnd: structuredClone(game) });
  }
  assert.notEqual(game.phase, 5, 'The native combined-turn queue finishes finitely');
  return { game, first, reoffered, declaredGuild, afterGuildChoice, turns, actions, take };
}
