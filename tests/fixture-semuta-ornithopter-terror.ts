import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { TERRITORIES } from '../game/board';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { actTruthMovement } from './fixture-truth-movement';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';

export type SemutaOrnithopterTerrorOptions = {
  kind?: 'sabotage' | 'robbery';
  mode?: 'range3' | 'twoGroups';
  fullHand?: boolean;
};
export type SemutaOrnithopterTerrorStep = { actor: string; action: Action };
export const SEMUTA_TERROR_ORNITHOPTER = 'richese-ornithopter';
export const actSemutaOrnithopterTerror = actTruthMovement;
export const semutaOrnithopterTerrorPlayer = (game: Game, actor: string) => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const semutaOrnithopterTerrorClean = (game: Game) =>
  !game.response && !game.phaseOpening && !game.decision &&
  !game.truthtrance && !game.pendingTreacheryDiscard;
export function semutaOrnithopterTerrorInventory(game: Game): string[] {
  const ids = [...game.deck, ...game.discard, ...(game.ornithopter ? [game.ornithopter.card] : []), ...(game.richeseCache ?? []),
    ...(game.richeseRemoved ?? []), ...(game.auction?.cards.slice(game.auction.index) ?? []),
    ...game.players.flatMap(player => player.hand)].map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'Each original physical card retains one location');
  return ids;
}

/** Only actual native controls. Terror placement/revelation, card choices and
 * the Guild's shipped movement remain explicit caller choices. */
export function nextSemutaOrnithopterTerrorStep(game: Game): SemutaOrnithopterTerrorStep | null {
  if (!game.response && !game.phaseOpening && game.decision) {
    const d = game.decision, event = game.richeseBidding?.event;
    if (['moritaniPlacement', 'moritaniTerror'].includes(d.kind)) return null;
    if (d.kind === 'moritaniSetup' && game.status === 'setup' && !game.setupStage) {
      const destination = TERRITORIES.find(t => t.id === 'oh_gap'); assert.ok(destination);
      return { actor: d.player, action: { type: 'decision',
        territory: destination.id, sector: destination.sectors[0] } };
    }
    if (d.kind === 'richeseCache') {
      const card = game.turn === 1
        ? game.richeseCache?.find(card => card.id === SEMUTA_TERROR_ORNITHOPTER)
        : game.richeseCache?.find(card => card.id !== SEMUTA_DRUG_ID);
      assert.ok(card);
      return { actor: d.player, action: { type: 'decision', event, card: card.id,
        method: 'onceAround', direction: 'clockwise' } };
    }
    if (d.kind === 'richeseUnbid')
      return { actor: d.player, action: { type: 'decision', event, keep: false } };
  }
  if (game.status === 'playing' && semutaOrnithopterTerrorClean(game)) {
    if (game.phase === 0 && game.stormPending === null) {
      const actor = game.stormDialers.find(id => game.stormDials[id] === undefined); assert.ok(actor);
      return { actor, action: { type: 'stormDial', amount: game.turn === 1 ? 0 : 1 } };
    }
    const lot = game.richeseAuction;
    if (lot && !lot.outcome && lot.cardId === SEMUTA_TERROR_ORNITHOPTER &&
        lot.active === 'guild' && lot.bid === 0)
      return { actor: 'guild', action: { type: 'richeseBid', event: lot.event, amount: 1, allyPayment: 0 } };
    if (game.phase === 5 && game.active === 'guild' &&
        semutaOrnithopterTerrorPlayer(game, 'guild').shipped) return null;
  }
  return nextRicheseStrongholdsNativeStep(game);
}
export function advanceSemutaOrnithopterTerror(game: Game, until: (state: Game) => boolean,
  actions: SemutaOrnithopterTerrorStep[] = []): Game {
  for (let count = 0; count < 1600; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Terror source ended before its owned boundary');
    const next = nextSemutaOrnithopterTerrorStep(game);
    assert.ok(next, 'Supply the original Terror, placement or owned movement choice explicitly');
    game = actSemutaOrnithopterTerror(game, next.actor, next.action, actions);
  }
  throw Error('The native Ornithopter/Terror programme did not reach its finite boundary');
}

/** Continue this fresh group only, never the later native Terror decision. */
export function passSemutaOrnithopterTerror(source: Game): Game {
  const pending = source.pendingTreacheryDiscard;
  assert.equal(pending?.reaction?.stage, 'offer');
  const event = pending!.batch.event;
  let game = source;
  for (const player of source.players) {
    const current = game.pendingTreacheryDiscard, reaction = current?.reaction;
    if (!current || current.batch.event !== event || reaction?.stage !== 'offer') break;
    if (!reaction.passed.includes(player.id))
      game = actSemutaOrnithopterTerror(game, player.id, { type: 'semutaPass', event });
  }
  return game;
}
export function claimSemutaOrnithopterTerror(source: Game, actor: string, card: string): Game {
  const event = source.pendingTreacheryDiscard!.batch.event;
  let game = actSemutaOrnithopterTerror(source, actor, { type: 'semutaCommit', event });
  if (game.pendingTreacheryDiscard?.reaction?.stage === 'select')
    game = actSemutaOrnithopterTerror(game, actor, { type: 'semutaSelect', event, card });
  return game;
}

/** Genuine Basic native setup, paid cache purchase, Mentat placement and
 * funded shipment. Only unopened deck/Spice ordering/scalar lotteries and
 * labelled conserved Semuta/overflow/full-hand acquisitions are controlled. */
export function createSemutaOrnithopterTerrorFixture(options: SemutaOrnithopterTerrorOptions = {}) {
  const kind = options.kind ?? 'sabotage', mode = options.mode ?? 'range3';
  const owner = 'moritani', claimant = 'richese', entrant = 'guild';
  const territory = 'carthag', sector = 11, origin = 'imperial_basin:10';
  let game = createGame('SEMUTAORNITHOPTERTERROR',
    newPlayer(owner, 'Moritani', 'moritani'), false, ['ecaz', 'choam']);
  joinGame(game, newPlayer(claimant, 'Richese', 'richese'));
  joinGame(game, newPlayer(entrant, 'Guild', 'guild'));
  const actions: SemutaOrnithopterTerrorStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaOrnithopterTerror(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => {
    game = advanceSemutaOrnithopterTerror(game, until, actions);
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, false);
  assert.equal(game.semutaPreview, true);
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills &&
    !game.techTokens && !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => player.hand.length === 0));
  const originalInventory = semutaOrnithopterTerrorInventory(game);
  const originalMainDeck = game.deck.map(card => card.id).sort();
  const ordinary = game.deck.filter(card => ['projectile', 'poison', 'shield', 'snooper'].includes(card.kind)).slice(0, 3);
  assert.equal(ordinary.length, 3);
  const deal = ordinary.map(card => card.id);
  const dealOrder = deal.map((id, position) => {
    const from = game.deck.findIndex(card => card.id === id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: id };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game);
  for (const [index, player] of game.players.entries())
    assert.deepEqual(player.hand.map(card => card.id), [deal[index]]);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card &&
      !card.discovery && !['oh_gap', 'tueks_sietch', 'imperial_basin', 'arrakeen', 'carthag'].includes(card.territory));
    assert.ok(from >= position);
    const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'richeseCache');
  const beforeCache = structuredClone(game), acquisitionStart = actions.length;
  reach(state => semutaOrnithopterTerrorClean(state) &&
    semutaOrnithopterTerrorPlayer(state, entrant).hand.some(card => card.id === SEMUTA_TERROR_ORNITHOPTER));
  const acquisition = { before: beforeCache, steps: structuredClone(actions.slice(acquisitionStart)),
    after: structuredClone(game) };
  assert.equal(semutaOrnithopterTerrorPlayer(game, entrant).spice,
    semutaOrnithopterTerrorPlayer(beforeCache, entrant).spice - 1);
  reach(state => state.turn === 1 && state.phase === 8 &&
    !state.response && !state.phaseOpening && state.decision?.kind === 'moritaniPlacement');
  const beforePlacement = structuredClone(game);
  const terror = game.moritaniTerror!.tokens.find(token => token.kind === kind && token.status === 'available');
  assert.ok(terror);
  const token = terror.id, placementStep: SemutaOrnithopterTerrorStep = {
    actor: owner, action: { type: 'decision', token, territory },
  };
  act(placementStep.actor, placementStep.action);
  reach(state => state.turn === 2 && state.phase === 5 && state.active === entrant &&
    semutaOrnithopterTerrorClean(state));
  const beforeShipment = structuredClone(game);
  assert.equal(game.moritaniTerror!.tokens.find(row => row.id === token)!.status, 'placed');
  assert.equal(game.moritaniTerror!.tokens.find(row => row.id === token)!.location, territory);
  assert.equal(game.moritaniTerror!.placementTurn, 1);
  const shipmentStep: SemutaOrnithopterTerrorStep = { actor: entrant, action: {
    type: 'ship', territory: 'imperial_basin', sector: 10, amount: mode === 'twoGroups' ? 2 : 1,
    elite: 0, allyPayment: 0,
  } };
  act(shipmentStep.actor, shipmentStep.action); reach(semutaOrnithopterTerrorClean);
  const afterShipment = structuredClone(game);
  assert.equal(semutaOrnithopterTerrorPlayer(game, entrant).spice,
    semutaOrnithopterTerrorPlayer(beforeShipment, entrant).spice - Number(shipmentStep.action.amount));
  const cache = game.richeseCache!.findIndex(card => card.id === SEMUTA_DRUG_ID); assert.ok(cache >= 0);
  semutaOrnithopterTerrorPlayer(game, claimant).hand.push(game.richeseCache!.splice(cache, 1)[0]);
  if (kind === 'robbery') while (semutaOrnithopterTerrorPlayer(game, owner).hand.length < 4) {
    const index = game.deck.findIndex(card => ['projectile', 'poison', 'shield', 'snooper', 'worthless'].includes(card.kind));
    assert.ok(index >= 0); semutaOrnithopterTerrorPlayer(game, owner).hand.push(game.deck.splice(index, 1)[0]);
  }
  if (options.fullHand) while (semutaOrnithopterTerrorPlayer(game, claimant).hand.length < 4) {
    const index = game.deck.findIndex(card => ['projectile', 'poison', 'shield', 'snooper', 'worthless'].includes(card.kind));
    assert.ok(index >= 0); semutaOrnithopterTerrorPlayer(game, claimant).hand.push(game.deck.splice(index, 1)[0]);
  }
  assert.ok(game.players.every(player => player.hand.length <= 4));
  const gift = semutaOrnithopterTerrorPlayer(game, owner).hand[0].id;
  const overflowDiscard = gift;
  let firstMove: { before: Game; step: SemutaOrnithopterTerrorStep; after: Game } | null = null;
  if (mode === 'twoGroups') {
    const before = structuredClone(game), step: SemutaOrnithopterTerrorStep = { actor: entrant, action: {
      type: 'move', movementCard: SEMUTA_TERROR_ORNITHOPTER, ornithopter: 'twoGroups',
      from: origin, amount: 1, territory: 'arrakeen', sector: 10,
    } };
    act(step.actor, step.action); reach(semutaOrnithopterTerrorClean);
    firstMove = { before, step, after: structuredClone(game) };
    assert.equal(game.ornithopter!.completed, 1);
  }
  const move: Action = { type: 'move', from: origin, amount: 1, territory, sector,
    ...(mode === 'range3'
      ? { movementCard: SEMUTA_TERROR_ORNITHOPTER, ornithopter: 'range3' }
      : { ornithopterEvent: game.ornithopter!.event }) };
  const entrantCard = semutaOrnithopterTerrorPlayer(game, entrant).hand
    .find(card => card.id !== SEMUTA_TERROR_ORNITHOPTER);
  assert.ok(entrantCard);
  assert.deepEqual(semutaOrnithopterTerrorInventory(game), originalInventory);
  assert.ok(!game.pendingTerrorEntry);
  return { game, move, kind, mode, fullHand: !!options.fullHand, owner, entrant, claimant,
    ornithopter: SEMUTA_TERROR_ORNITHOPTER, semuta: SEMUTA_DRUG_ID, token, territory, sector,
    origin, location: territory + ':' + sector, gift, overflowDiscard, entrantCard: entrantCard.id,
    deckTop: structuredClone(game.deck[0]), originalInventory, originalMainDeck,
    lobby, setup, beforeStartingDeal, deal, dealOrder, afterSetup, spiceOrder,
    acquisition, beforePlacement, placementStep, beforeShipment, shipmentStep, afterShipment, firstMove,
    actions, sourceActionCount: actions.length,
    balances: Object.fromEntries(game.players.map(player => [player.id, player.spice])),
    claimantHandSize: semutaOrnithopterTerrorPlayer(game, claimant).hand.length,
    staging: [
      'Original public Basic Moritani/Richese/Guild setup uses the selected E2/E3 decks and native cache. Only three unopened starting-card positions, two unopened ordinary Spice positions and scalar lotteries are selected. Native Moritani places its six starting counters in printed Oh Gap; no force, wallet, phase, token or pending receipt is installed.',
      'Guild actually buys the original cache Ornithopter for one spice during turn one. The native turn-one Mentat opportunity actually places the selected hidden Terror in Carthag; actual first-turn zero dials, next-turn1+1 dials and quiet native controls reach turn two. Guild then pays for its real one/two-force Imperial Basin shipment. Two-group mode performs its real first move to empty Arrakeen before the caller-owned final movement.',
      'At the clean shipped boundary, explicitly conserve the original cache Semuta into Richese hand. Robbery additionally fills Moritani to its actual four-card limit using original ordinary deck cards, and optional full-hand cases likewise fill Richese. These are labelled prior-card acquisitions, not a played auction/trade. No card identity is duplicated. The final move, Semuta choices, Terror revelation, actual Robbery draw/discard and optional Sabotage gift remain caller actions.',
    ],
  };
}
export type SemutaOrnithopterTerrorFixture = ReturnType<typeof createSemutaOrnithopterTerrorFixture>;
