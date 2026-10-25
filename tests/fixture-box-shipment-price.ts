import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { TERRITORIES, location } from '../game/board';
import { presenceAt } from '../game/force-presence';
import { semutaGuildIncomeInventory, nextSemutaGuildIncomeNativeStep } from './fixture-semuta-guild-income';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';

export const BOX_SHIPMENT_PRICE_BOX = 'richese-nullentropy-box';
export type BoxShipmentPriceStep = { actor: string; action: Action };
export type BoxShipmentPriceOptions = { advanced?: boolean; otherCandidate?: boolean };
export function boxShipmentPricePlayer(game: Game, id: string) {
  const player = game.players.find(player => player.id === id);
  assert.ok(player, `The original ${id} seat must remain present`);
  return player;
}
export const boxShipmentPriceInventory = semutaGuildIncomeInventory;
export const boxShipmentPriceClean = (game: Game) => !game.response && !game.decision &&
  !game.phaseOpening && !game.pendingTreacheryDiscard && !game.pendingNullentropy && !game.truthtrance;
export function boxShipmentPricePhysical(game: Game) {
  return { active: game.active, order: [...game.order], movementRemaining: [...(game.movementRemaining ?? [])],
    players: game.players.map(player => ({ id: player.id, spice: player.spice, reserves: player.reserves,
      tanks: player.tanks, forces: structuredClone(player.forces), elites: structuredClone(player.elites),
      shipped: player.shipped, moved: player.moved, specialKaramaUsed: player.specialKaramaUsed })) };
}
export function actBoxShipmentPrice(game: Game, actor: string, action: Action,
  actions: BoxShipmentPriceStep[] = []) {
  actions.push({ actor, action: structuredClone(action) });
  return withClassicDiscoveryNexusLottery(() => applyAction(game, actor, action));
}

/** Only the original cache lot is bought. All other controls retain their
 * existing native no-spend policy, including Advanced Guild timing. */
export function nextBoxShipmentPriceStep(game: Game): BoxShipmentPriceStep {
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    const decision = game.decision;
    if (decision?.kind === 'richeseCache') return { actor: decision.player, action: {
      type: 'decision', event: game.richeseBidding!.event, card: BOX_SHIPMENT_PRICE_BOX,
      method: 'onceAround', direction: 'counterclockwise' } };
    if (!decision && game.richeseAuction?.cardId === BOX_SHIPMENT_PRICE_BOX &&
      !game.richeseAuction.outcome && game.richeseAuction.active === 'g' && game.richeseAuction.bid === 0)
      return { actor: 'g', action: { type: 'richeseBid', event: game.richeseAuction.event, amount: 1, allyPayment: 0 } };
  }
  return nextSemutaGuildIncomeNativeStep(game);
}
export function advanceBoxShipmentPrice(game: Game, until: (state: Game) => boolean,
  actions: BoxShipmentPriceStep[] = []): Game {
  for (let count = 0; count < 1500; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Box price programme ended before its owned boundary');
    const step = nextBoxShipmentPriceStep(game);
    game = actBoxShipmentPrice(game, step.actor, step.action, actions);
  }
  throw Error('The native Box price programme did not reach its finite boundary');
}

/** Original public Richese/Guild/Atreides/Emperor setup. Only the unopened
 * starting deal, unopened land positions and scalar lotteries are selected.
 * Guild buys the physical Box for1; Richese may really discard its original
 * Weather Control; Atreides really spends its own distinct printed Karama.
 * No played hand, wallet, board, clock or purchased grant is installed. */
export function createBoxShipmentPriceFixture(options: BoxShipmentPriceOptions = {}) {
  const advanced = options.advanced ?? false, otherCandidate = options.otherCandidate ?? true;
  let game = createGame('BOXSHIPMENTPRICE', newPlayer('r', 'Richese', 'richese'), advanced, ['choam']);
  for (const [id, name, faction] of [['g', 'Guild', 'guild'], ['a', 'Atreides', 'atreides'],
    ['e', 'Emperor', 'emperor']] as const) joinGame(game, newPlayer(id, name, faction));
  const actions: BoxShipmentPriceStep[] = [];
  const act = (actor: string, action: Action) => { game = actBoxShipmentPrice(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceBoxShipmentPrice(game, until, actions); };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const initial = structuredClone(game);
  act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup');
  assert.ok(game.players.every(player => player.hand.length === 0), 'Choose only the original unopened deal');
  const selected = new Set<string>(), startingDealSelection: { actor: string; position: number; from: number; card: string }[] = [];
  for (const [actor, effect] of [['r', 'weather'], ['g', 'karama'], ['a', 'karama'], ['e', 'projectile']] as const) {
    const position = game.players.findIndex(player => player.id === actor);
    const from = game.deck.findIndex(card => !selected.has(card.id) &&
      (effect === 'projectile' ? card.kind === effect : card.effect === effect));
    assert.ok(position >= 0 && from >= position, `The original ${actor} starting card must still be undealt`);
    const card = game.deck[from].id;
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    selected.add(card); startingDealSelection.push({ actor, position, from, card });
  }
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), originalInventory = boxShipmentPriceInventory(game);
  const idFor = (actor: string) => startingDealSelection.find(row => row.actor === actor)!.card;
  const alternative = idFor('r'), stopKarama = idFor('g'), karama = idFor('a');
  for (const { actor, card } of startingDealSelection)
    assert.ok(boxShipmentPricePlayer(game, actor).hand.some(held => held.id === card));
  const land: Game['spiceDeck'] = [];
  for (let count = 0; count < (advanced ? 2 : 1); count++) {
    const at = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery);
    assert.ok(at >= 0); land.push(game.spiceDeck.splice(at, 1)[0]);
  }
  game.spiceDeck.unshift(...land);
  let weather: { before: Game; action: Action; after: Game } | null = null;
  if (otherCandidate) {
    reach(state => state.phase === 0 && state.stormPending !== null && boxShipmentPriceClean(state));
    const before = structuredClone(game), action: Action = { type: 'card', card: alternative, amount: 0 };
    act('r', action); reach(boxShipmentPriceClean);
    weather = { before, action, after: structuredClone(game) };
    assert.equal(game.discard.filter(card => card.id === alternative).length, 1);
  }
  reach(state => state.decision?.kind === 'richeseCache');
  const beforePurchase = structuredClone(game), acquisitionStart = actions.length;
  reach(state => boxShipmentPricePlayer(state, 'g').hand.some(card => card.id === BOX_SHIPMENT_PRICE_BOX) && boxShipmentPriceClean(state));
  const acquired = structuredClone(game), acquisition = { before: beforePurchase,
    actions: structuredClone(actions.slice(acquisitionStart)), after: acquired };
  assert.ok(acquisition.actions.some(step => step.actor === 'g' && step.action.type === 'richeseBid' && step.action.amount === 1));
  reach(state => state.phase === 5 && state.active === 'a' && boxShipmentPriceClean(state));
  const beforePrice = structuredClone(game), priceAction: Action = { type: 'card', card: karama, mode: 'shipment', target: 'a' };
  act('a', priceAction); reach(boxShipmentPriceClean);
  assert.deepEqual(game.karamaShipping, { player: 'a', owner: 'a', card: karama });
  assert.equal(game.discard.filter(card => card.id === karama).length, 1);
  assert.ok(boxShipmentPricePlayer(game, 'g').hand.some(card => card.id === stopKarama));
  assert.equal(boxShipmentPricePlayer(game, 'g').spice, boxShipmentPricePlayer(beforePurchase, 'g').spice - 1);
  const destination = TERRITORIES.find(territory => territory.type === 'sand' &&
    territory.sectors.some(sector => sector !== game.storm) && game.players.every(player => presenceAt(player, territory.id) === 0));
  assert.ok(destination);
  const sector = destination.sectors.find(sector => sector !== game.storm)!;
  const shipment: Action = { type: 'ship', territory: destination.id, sector, amount: 3, elite: 0, allyPayment: 0 };
  return { game, advanced, otherCandidate, holder: 'g', owner: 'g', guild: 'g', beneficiary: 'a', creator: 'a',
    box: BOX_SHIPMENT_PRICE_BOX, karama, stopKarama, alternative, initial, setup, beforeStartingDeal,
    startingDealSelection, afterSetup, weather, acquisition, acquired, beforePrice, priceAction,
    action: { type: 'card', card: BOX_SHIPMENT_PRICE_BOX } as Action,
    originalGrant: structuredClone(game.karamaShipping), originalInventory,
    originalPhysical: boxShipmentPricePhysical(game), shipment, target: location(destination.id, sector),
    amount: 3, shipmentCost: 3, boxFee: 2, actions, sourceActionCount: actions.length,
    staging: ['Original unopened deal/Spice positions and scalar lotteries only. Actual cache Box1 acquisition, optional Weather discard and native Atreides price activation; no played state is installed.'] };
}
export type BoxShipmentPriceFixture = ReturnType<typeof createBoxShipmentPriceFixture>;

export function payBoxShipmentPrice(fixture: BoxShipmentPriceFixture, game = structuredClone(fixture.game),
  actions: BoxShipmentPriceStep[] = []) {
  return actBoxShipmentPrice(game, fixture.holder, fixture.action, actions);
}
export function selectBoxShipmentPrice(fixture: BoxShipmentPriceFixture, game: Game, card: string,
  actions: BoxShipmentPriceStep[] = []) {
  assert.ok(game.pendingNullentropy, 'Selection requires the actually paid original search');
  return actBoxShipmentPrice(game, fixture.holder,
    { type: 'decision', event: game.pendingNullentropy.event, card }, actions);
}
export function declareBoxShipmentPrice(fixture: BoxShipmentPriceFixture, game: Game,
  actions: BoxShipmentPriceStep[] = []) {
  return actBoxShipmentPrice(game, fixture.beneficiary, fixture.shipment, actions);
}
export function allowBoxShipmentPrice(fixture: BoxShipmentPriceFixture, game: Game,
  actions: BoxShipmentPriceStep[] = []) {
  if (!game.advanced) {
    assert.equal(boxShipmentPricePlayer(game, fixture.beneficiary).shipped, true);
    return game;
  }
  assert.equal(game.decision?.kind, 'guildShipment');
  return actBoxShipmentPrice(game, fixture.guild, { type: 'decision', allow: true }, actions);
}
export function stopBoxShipmentPrice(fixture: BoxShipmentPriceFixture, game: Game, card: string,
  actions: BoxShipmentPriceStep[] = []) {
  return actBoxShipmentPrice(game, fixture.guild, { type: 'card', card, mode: 'special' }, actions);
}
/** Retire only actual original response/discard continuations, stopping before
 * a new turn/action. Native shipment success or stop leaves Atreides active. */
export function finishBoxShipmentPrice(fixture: BoxShipmentPriceFixture, game: Game,
  actions: BoxShipmentPriceStep[] = []) {
  return advanceBoxShipmentPrice(game, state => state.turn === fixture.game.turn && state.phase === 5 &&
    state.active === fixture.beneficiary && boxShipmentPriceClean(state), actions);
}
