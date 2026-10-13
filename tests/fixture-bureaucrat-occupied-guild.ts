import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { territory } from '../game/board';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { quoteStableHomeworldOccupation } from '../game/homeworld-stable-occupation';
import {
  assertClassicHomeworldSkillsCustody, classicHomeworldSkillsPlayer,
  createClassicHomeworldSkillsSetup, nextClassicHomeworldSkillsStep,
  type ClassicHomeworldSkillsStep,
} from './fixture-homeworld-classic-skills';
import { homeworldFundingCards } from './fixture-bureaucrat-homeworld-funding';

export const occupiedGuildPlayer = classicHomeworldSkillsPlayer;
export const occupiedGuildWallets = (game: Game) =>
  Object.fromEntries(game.players.map(p => [p.id, p.spice]));
export const occupiedGuildArmies = (game: Game) => game.players.map(p => ({
  id: p.id, forces: p.forces, reserves: p.reserves, tanks: p.tanks, elites: p.elites,
}));
export const occupiedGuildClean = (game: Game) =>
  !game.phaseOpening && !game.response && !game.decision && !game.pendingTreacheryDiscard;
export const occupiedGuildCards = homeworldFundingCards;

/** Only conserved, original unplayed Spice order is controlled. */
function orderSpice(game: Game, kinds: ('land' | 'worm')[]): void {
  for (const [position, kind] of kinds.entries()) {
    const index = game.spiceDeck.findIndex((card, i) => i >= position &&
      (kind === 'worm' ? 'worm' in card : 'territory' in card));
    assert.ok(index >= position);
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
  }
}

/** A physical custody swap retains both cards and the original hand size. */
function holdKarama(game: Game, actor: string): string {
  const player = occupiedGuildPlayer(game, actor);
  const held = player.hand.find(card => card.effect === 'karama');
  if (held) return held.id;
  const index = game.deck.findIndex(card => card.effect === 'karama');
  assert.ok(index >= 0 && player.hand.length);
  const card = game.deck[index];
  game.deck[index] = player.hand[0];
  player.hand[0] = card;
  return card.id;
}

export function nextOccupiedGuildStep(game: Game): ClassicHomeworldSkillsStep {
  const decision = game.decision;
  if (decision?.kind === 'homeworldShipmentGuild') return { actor: decision.player,
    action: { type: 'decision', event: decision.event, allow: true } };
  if (decision?.kind === 'guildShipment') return { actor: decision.player,
    action: { type: 'decision', allow: true } };
  if (decision?.kind === 'homeworldOccupiedIncome') {
    const offer = viewGame(game, decision.player).homeworldOccupiedIncome!;
    return { actor: decision.player, action: { type: 'decision', event: decision.event,
      world: decision.world, ownAmount: offer.maxOwnAmount } };
  }
  if (decision?.kind === 'homeworldOccupiedPercentage') {
    const offer = viewGame(game, decision.player).homeworldOccupiedPercentage!;
    return { actor: decision.player, action: { type: 'decision', event: decision.event,
      ownAmount: offer.maxOwnAmount } };
  }
  const step = nextClassicHomeworldSkillsStep(game);
  assert.ok(step, 'The native scenario never requires a fabricated battle plan');
  return step;
}

export function advanceOccupiedGuild(state: Game, until: (game: Game) => boolean,
  actions?: ClassicHomeworldSkillsStep[]): Game {
  let game = state;
  for (let n = 0; !until(game) && n < 1600; n++) {
    assert.notEqual(game.status, 'finished');
    const step = nextOccupiedGuildStep(game);
    actions?.push(structuredClone(step));
    game = applyAction(game, step.actor, step.action);
  }
  assert.ok(until(game), 'Native occupation programme reaches the requested boundary');
  return game;
}

export function allowOccupiedGuildResponses(state: Game): Game {
  let game = state;
  for (let n = 0; game.response && n < 60; n++) {
    const actor = game.players.find(p => !game.response!.passed.includes(p.id));
    assert.ok(actor, 'The original response queue must keep a legal responder');
    game = applyAction(game, actor.id, { type: 'passResponse' });
  }
  assert.equal(game.response, null);
  return game;
}

export type OccupiedGuildFixture = {
  game: Game; setup: Game; junctionEmpty: Game; occupied: Game; alliance: Game;
  beforePledge: Game; beforeAction: Game;
  payer: string; donor: string; payee: string; trainer: string; occupier: string;
  payerShare: number; donorShare: number; gross: number; action: Action;
  territory: string; sector: number; karama: string; physical: string[];
  staging: string[]; actions: ClassicHomeworldSkillsStep[];
};

/** Actual classic occupation + Skills setup: the native Guild empties Junction
 * through its own reserve shipment, a foreign faction invades Junction through
 * a real world shipment, and the later real alliance funds the real paid
 * shipment. No wallet, force, custody, history, phase or authority was assigned;
 * only original unplayed Spice order and one conserved card swap are staged. */
export function createOccupiedGuildFixture(options: {
  payer?: string; donor?: string; occupier?: string; prep?: string;
  payerShare?: number; donorShare?: number;
  advanced?: boolean;
} = {}): OccupiedGuildFixture {
  const payer = options.payer ?? 'harkonnen';
  const donor = options.donor ?? 'emperor';
  const occupier = options.occupier ?? (options.advanced ? 'beneGesserit' : 'harkonnen');
  const prep = options.prep ?? (options.advanced ? 'harkonnen' : 'emperor');
  const { payerShare = 6, donorShare = 2, advanced = false } = options;
  const payee = 'guild', trainer = 'atreides';
  // Use native Harkonnen preparation and a distinct BG occupier in Advanced;
  // native flexible Guild timing and every original victory rule remain intact.
  const native = createClassicHomeworldSkillsSetup({ occupation: true, advanced,
    ...(advanced ? { roster: ['emperor', 'guild', 'atreides', 'harkonnen', 'beneGesserit'] as const } : {}) });
  const setup = structuredClone(native.afterSetup), actions = [...native.actions];
  const staging = [...native.staging];
  let game = structuredClone(setup);
  const act = (actor: string, action: Action) => {
    actions.push({ actor, action: structuredClone(action) });
    game = applyAction(game, actor, action);
  };
  const reach = (until: (state: Game) => boolean) => {
    game = advanceOccupiedGuild(game, until, actions);
  };
  orderSpice(game, advanced ? ['land', 'land'] : ['land']);
  reach(g => g.turn === 1 && g.phase === 5 && g.active === prep && occupiedGuildClean(g));
  const opening = occupiedGuildPlayer(game, payee).spice;
  // One real four-spice shipment income funds the native Guild's later tariff.
  act(prep, { type: 'ship', territory: 'sietch_tabr', sector: territory('sietch_tabr').sectors[0],
    amount: 4, elite: 0, homeworldSources: { [`homeworld:${occupiedGuildPlayer(game, prep).faction}`]:
      { normal: 4, elite: 0 } } });
  reach(occupiedGuildClean);
  assert.equal(occupiedGuildPlayer(game, payee).spice, opening + 4,
    'The four-spice shipment income reaches the native Guild');
  // The Guild's own reserve shipment empties Junction.
  reach(g => g.phase === 5 && g.active === payee && occupiedGuildClean(g));
  act(payee, { type: 'ship', territory: 'habbanya_ridge_sietch',
    sector: territory('habbanya_ridge_sietch').sectors[0], amount: 15, elite: 0,
    homeworldSources: { 'homeworld:guild': { normal: 15, elite: 0 } } });
  reach(occupiedGuildClean);
  assert.equal(occupiedGuildPlayer(game, payee).reserves, 0, 'Junction is physically empty');
  const junctionEmpty = structuredClone(game);
  assert.equal(quoteStableHomeworldOccupation(game, 'junction').entitlement, null);
  // The real foreign homeworld invasion, then the real reciprocal alliance.
  reach(g => g.phase === 5 && g.active === occupier && occupiedGuildClean(g));
  const invasion = homeworldShipmentChoice(viewGame(game, occupier), 'homeworld:guild',
    { [`homeworld:${occupiedGuildPlayer(game, occupier).faction}`]: { normal: 1, elite: 0 } });
  assert.ok(invasion.action, invasion.blocked ?? undefined);
  act(occupier, invasion.action);
  reach(occupiedGuildClean);
  const authority = quoteStableHomeworldOccupation(game, 'junction');
  assert.equal(authority.blocked, null);
  assert.equal(authority.entitlement?.occupier, occupier);
  assert.ok(game.homeworldOccupationHistory!.sources.some(source =>
    source.event === authority.entitlement!.qualification && source.cause !== 'setup'));
  const occupied = structuredClone(game);
  const paymentTurn = game.turn + 1;
  reach(g => g.turn === paymentTurn && g.phase === 1 && occupiedGuildClean(g));
  orderSpice(game, advanced ? ['worm', 'land', 'land'] : ['worm', 'land']);
  reach(g => !!g.nexus && !g.spiceWindow && !g.spiceResolution && occupiedGuildClean(g));
  act(payer, { type: 'alliance', target: donor });
  act(donor, { type: 'alliance', target: payer });
  assert.equal(occupiedGuildPlayer(game, payer).ally, donor);
  assert.equal(occupiedGuildPlayer(game, donor).ally, payer);
  const alliance = structuredClone(game);
  // The later real paid shipment to an empty Arrakis territory.
  reach(g => g.turn === paymentTurn && g.phase === 5 && g.active === payer && occupiedGuildClean(g));
  const karama = holdKarama(game, trainer);
  const beforePledge = structuredClone(game);
  if (donorShare) act(donor, { type: 'pledgeAid', amount: donorShare });
  const beforeAction = structuredClone(game), gross = payerShare + donorShare;
  const target = 'arsunt', sector = territory(target).sectors[0];
  assert.ok(occupiedGuildPlayer(game, payer).spice >= payerShare);
  assert.ok(game.players.every(p => !Object.keys(p.forces).some(key => key.startsWith(`${target}:`))));
  const action: Action = { type: 'ship', territory: target, sector, amount: gross / 2,
    elite: 0, allyPayment: donorShare };
  assertClassicHomeworldSkillsCustody(game);
  assert.deepEqual(occupiedGuildCards(game), homeworldFundingCards(setup));
  return { game, setup, junctionEmpty, occupied, alliance, beforePledge, beforeAction,
    payer, donor, payee, trainer, occupier, payerShare, donorShare, gross, action,
    territory: target, sector, karama, physical: homeworldFundingCards(game), staging, actions };
}

/** The original declaration debits the payer and the pledged ally, then opens
 * only the real income window. */
export function declareOccupiedGuild(f: OccupiedGuildFixture, state = f.game): Game {
  let game = applyAction(state, f.payer, f.action);
  if (game.decision?.kind === 'guildShipment') {
    game = applyAction(game, game.decision.player, { type: 'decision', allow: true });
  }
  return game;
}

/** Walk only the real persisted pass queue. */
export function allowOccupiedGuildIncome(state: Game): Game {
  return allowOccupiedGuildResponses(state);
}

export function cancelOccupiedGuildIncome(f: OccupiedGuildFixture, state: Game): Game {
  assert.equal(state.response?.kind, 'guildIncome');
  assert.ok(viewGame(state, f.trainer).responseControls?.cancelCards.includes(f.karama));
  return applyAction(state, f.trainer, { type: 'card', mode: 'cancel', card: f.karama });
}

export function chooseOccupiedGuild(game: Game, redirect: boolean): Game {
  assert.equal(game.decision?.kind, 'bureaucratPayment');
  return applyAction(game, game.decision!.player,
    { type: 'decision', event: game.bureaucratPaymentEvent, redirect });
}

export function allocateOccupiedGuild(game: Game, ownAmount?: number): Game {
  assert.equal(game.decision?.kind, 'homeworldOccupiedPercentage');
  const offer = viewGame(game, game.decision!.player).homeworldOccupiedPercentage!;
  return allowOccupiedGuildResponses(applyAction(game, game.decision!.player,
    { type: 'decision', event: offer.event, ownAmount: ownAmount ?? offer.maxOwnAmount }));
}
