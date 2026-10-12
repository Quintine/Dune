import assert from 'node:assert/strict';
import {
  applyAction, createGame, handLimit, initializeHomeworldOccupationGameForAudit,
  initializeSemutaGameForAudit, joinGame, newPlayer, viewGame,
  type Action, type Game,
} from '../game/engine';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { nextRicheseSkillsTechNativeStep } from './fixture-richese-skills-tech';
import {
  moveSemutaEmperorCard, semutaEmperorCardId, semutaEmperorPlayer as semutaTupilePlayer,
} from './fixture-semuta-emperor-share';

export const SEMUTA_TUPILE_WORLD = 'homeworld:choam';
export type SemutaTupileStep = { actor: string; action: Action };
export type SemutaTupileFixture = {
  game: Game;
  setup: Game;
  occupied: Game;
  beforeDeparture: Game;
  owner: string;
  holder: string;
  occupier: string;
  ally: string;
  event: string;
  action: Action;
  selected: string[];
  semuta: string;
  sourceActions: SemutaTupileStep[];
  actions: SemutaTupileStep[];
  cards: string[];
};

export function semutaTupileCards(game: Game): string[] {
  return [game.deck, game.discard, game.richeseCache ?? [], game.richeseRemoved ?? [],
    ...game.players.map(player => player.hand)].flat().map(card => card.id).sort();
}

/** Public physical totals include visitors, which are not native reserves. */
export function semutaTupileForceTotals(game: Game) {
  return game.players.map(player => ({ id: player.id, total: player.reserves + player.tanks +
    Object.values(player.forces).reduce((sum, amount) => sum + amount, 0) +
    Object.values(game.homeworlds!.custody!.visitors).reduce((sum, visitors) =>
      sum + (visitors[player.id]?.normal ?? 0) + (visitors[player.id]?.elite ?? 0), 0) }));
}

export function nextSemutaTupileStep(game: Game): SemutaTupileStep {
  const pending = game.pendingTreacheryDiscard;
  const reaction = pending?.reaction;
  if (reaction?.stage === 'offer' && pending) return {
    actor: game.players.find(player => !reaction.passed.includes(player.id))!.id,
    action: { type: 'semutaPass', event: pending.batch.event },
  };
  if (game.decision?.kind === 'homeworldShipmentGuild') return {
    actor: game.decision.player,
    action: { type: 'decision', event: game.decision.event, allow: true },
  };
  return nextRicheseSkillsTechNativeStep(game);
}

export function semutaTupileCleanupStep(game: Game): SemutaTupileStep {
  assert.equal(game.decision?.kind, 'homeworldTupileCleanup');
  const actor = game.decision!.player;
  const cleanup = viewGame(game, actor).homeworldTupileCleanup!;
  assert.ok(cleanup && !cleanup.blocked);
  return { actor, action: { type: 'decision', event: cleanup.event,
    cards: cleanup.eligibleCards.slice(0, cleanup.excess) } };
}

export function reactSemutaTupile(state: Game, holder: string, claim: boolean): Game {
  const event = state.pendingTreacheryDiscard!.batch.event;
  if (claim) return applyAction(state, holder, { type: 'semutaCommit', event });
  let game = state;
  for (const player of state.players)
    game = applyAction(game, player.id, { type: 'semutaPass', event });
  return game;
}

/** Original setup and phase actions establish the alliance, occupation epoch,
 * lease and departure. Later conserved physical positions isolate the producer;
 * they never assign its clocks, alliances, wallets, visitor custody or history. */
export function createSemutaTupileFixture(options: { nativeOnly?: boolean } = {}): SemutaTupileFixture {
  let game = createGame('SEMUTATUPILE', newPlayer('r', 'Richese', 'richese'), true, ['choam']);
  joinGame(game, newPlayer('c', 'CHOAM', 'choam'));
  joinGame(game, newPlayer('g', 'Guild', 'guild'));
  joinGame(game, newPlayer('a', 'Atreides', 'atreides'));
  game = applyAction(game, 'r', { type: 'homeworlds', enabled: true });
  for (const player of game.players) game = applyAction(game, player.id, { type: 'ready' });
  game = options.nativeOnly
    ? initializeHomeworldOccupationGameForAudit(game)
    : initializeSemutaGameForAudit(game);
  const actions: SemutaTupileStep[] = [], sourceActions: SemutaTupileStep[] = [];
  const act = (step: SemutaTupileStep, source = false) => {
    actions.push(step);
    if (source) sourceActions.push(step);
    game = applyAction(game, step.actor, step.action);
  };
  const clean = () => !game.phaseOpening && !game.response && !game.decision && !game.pendingTreacheryDiscard;
  const reach = (until: () => boolean) => {
    for (let n = 0; !until() && n < 2400; n++) {
      assert.notEqual(game.status, 'finished', 'Original native actions must reach Tupile');
      act(nextSemutaTupileStep(game));
    }
    assert.ok(until(), 'Original native actions must reach the requested Tupile boundary');
  };
  const orderUnplayedSpice = (kinds: ('land' | 'worm')[]) => {
    for (const [position, kind] of kinds.entries()) {
      const index = game.spiceDeck.findIndex((card, i) => i >= position &&
        (kind === 'land' ? 'territory' in card : 'worm' in card));
      assert.ok(index >= position, 'An original unplayed Spice Card must remain');
      game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
    }
  };
  reach(() => game.status === 'playing');
  const setup = structuredClone(game), cards = semutaTupileCards(game);
  orderUnplayedSpice(['land', 'land']);
  reach(() => game.phase === 5 && clean());
  // Conserved later positions: remove all Arrakis encounters without changing
  // native Homeworld custody, phase controls or original twenty-counter stocks.
  for (const player of game.players) {
    player.reserves += Object.values(player.forces).reduce((sum, amount) => sum + amount, 0);
    player.forces = {};
  }
  reach(() => game.turn === 2 && game.phase === 1 && clean());
  orderUnplayedSpice(['worm', 'land', 'land']);
  reach(() => game.nexus && !game.spiceWindow && !game.spiceResolution && clean());
  act({ actor: 'g', action: { type: 'alliance', target: 'a' } }, true);
  act({ actor: 'a', action: { type: 'alliance', target: 'g' } }, true);
  reach(() => game.phase === 5 && game.active === 'g' && clean());
  // Conserved later CHOAM position: its original native counters are on Arrakis,
  // not imaginary visitors. The ORIGINAL invasion must qualify the sole occupier.
  const choam = semutaTupilePlayer(game, 'c');
  choam.forces['polar_sink:0'] = (choam.forces['polar_sink:0'] ?? 0) + choam.reserves;
  choam.reserves = 0;
  const invade = homeworldShipmentChoice(viewGame(game, 'g'), SEMUTA_TUPILE_WORLD,
    { 'homeworld:guild': { normal: 1, elite: 0 } });
  assert.ok(invade.action, invade.blocked ?? undefined);
  act({ actor: 'g', action: invade.action }, true);
  reach(() => clean());
  assert.equal(semutaTupilePlayer(game, 'g').tupileHandSlot, true);
  assert.equal(semutaTupilePlayer(game, 'a').tupileHandSlot, true);
  const occupied = structuredClone(game);
  // No further worm is needed: the reciprocal alliance remains native.
  orderUnplayedSpice(['land', 'land', 'land', 'land']);
  reach(() => game.turn === 3 && game.phase === 5 && game.active === 'g' && clean());
  // Conserved original physical cards only, staged after all native auctions.
  for (const player of game.players) game.deck.push(...player.hand.splice(0));
  const semuta = moveSemutaEmperorCard(game, SEMUTA_DRUG_ID, 'r');
  for (const [id, size] of [['g', 5], ['a', 5], ['r', 4]] as const) {
    const player = semutaTupilePlayer(game, id);
    while (player.hand.length < size) {
      const card = semutaEmperorCardId(game, candidate => game.deck.some(held => held.id === candidate.id) &&
        candidate.id !== SEMUTA_DRUG_ID && candidate.effect !== 'karama');
      moveSemutaEmperorCard(game, card, id);
    }
    assert.equal(player.hand.length, handLimit(player));
  }
  const beforeDeparture = structuredClone(game);
  const depart = homeworldShipmentChoice(viewGame(game, 'g'), 'homeworld:guild',
    { [SEMUTA_TUPILE_WORLD]: { normal: 1, elite: 0 } });
  assert.ok(depart.action, depart.blocked ?? undefined);
  act({ actor: 'g', action: depart.action }, true);
  reach(() => game.decision?.kind === 'homeworldTupileCleanup');
  assert.equal(game.homeworldTupileState!.current, null);
  assert.equal(game.homeworldTupileState!.cleanups.filter(row => row.status === 'pending').length, 2);
  const cleanup = semutaTupileCleanupStep(game);
  const selected = cleanup.action.cards as string[];
  assert.equal(selected.length, 1, 'Each ordinary granted-five holder owes its own original one-card cleanup');
  assert.deepEqual(semutaTupileCards(game), cards);
  assert.ok(semutaTupileForceTotals(game).every(row => row.total === 20));
  return { game, setup, occupied, beforeDeparture, owner: cleanup.actor, holder: 'r',
    occupier: 'g', ally: 'a', event: cleanup.action.event as string, action: cleanup.action,
    selected, semuta, sourceActions, actions, cards };
}
