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

export const occupiedEmperorPlayer = classicHomeworldSkillsPlayer;
export const occupiedEmperorWallets = (game: Game) => Object.fromEntries(game.players.map(p => [p.id, p.spice]));
export const occupiedEmperorClean = (game: Game) => !game.phaseOpening && !game.response && !game.decision && !game.pendingTreacheryDiscard;

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
  const player = occupiedEmperorPlayer(game, actor);
  const held = player.hand.find(card => card.effect === 'karama');
  if (held) return held.id;
  const index = game.deck.findIndex(card => card.effect === 'karama');
  assert.ok(index >= 0 && player.hand.length);
  const card = game.deck[index];
  game.deck[index] = player.hand[0]; player.hand[0] = card;
  return card.id;
}

export function nextOccupiedEmperorStep(game: Game): ClassicHomeworldSkillsStep {
  const decision = game.decision;
  if (game.biddingEnd && occupiedEmperorClean(game)) {
    const actor = game.biddingEnd.owners.find(id => !game.biddingEnd!.ready.includes(id)); assert.ok(actor);
    return { actor, action: { type: 'biddingEnd', event: game.biddingEnd.event, mode: 'ready' } };
  }
  if (decision?.kind === 'homeworldShipmentGuild') return { actor: decision.player,
    action: { type: 'decision', event: decision.event, allow: true } };
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

export function advanceOccupiedEmperor(state: Game, until: (game: Game) => boolean,
  actions?: ClassicHomeworldSkillsStep[]): Game {
  let game = state;
  for (let n = 0; !until(game) && n < 1600; n++) {
    assert.notEqual(game.status, 'finished');
    const step = nextOccupiedEmperorStep(game);
    actions?.push(structuredClone(step)); game = applyAction(game, step.actor, step.action);
  }
  assert.ok(until(game), 'Native occupation programme reaches the requested boundary');
  return game;
}

export function allowOccupiedEmperorResponses(state: Game): Game {
  let game = state;
  for (let n = 0; game.response && n < 40; n++) {
    const actor = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(actor);
    game = applyAction(game, actor.id, { type: 'passResponse' });
  }
  assert.equal(game.response, null); return game;
}

export type OccupiedEmperorFixture = {
  game: Game; setup: Game; fundedEmperor: Game; emptyKaitain: Game; occupied: Game; alliance: Game;
  beforePledge: Game; beforeAction: Game;
  payer: string; donor: string; payee: string; trainer: string; occupier: string;
  payerShare: number; donorShare: number; gross: number; action: Action;
  lot: string; bonus: string; karama: string; physical: string[]; actions: ClassicHomeworldSkillsStep[];
};

/** Actual Basic setup -> paid ten-spice lot -> twenty-counter paid shipment ->
 * Guild's real bribes through Mentat -> worm/alliance -> empty Kaitain invasion
 * -> later funded auction. No wallet, force, phase, alliance or authority edits. */
export function createOccupiedEmperorFixture(options: {
  payerShare?: number; donorShare?: number; donor?: 'guild' | 'atreides' | 'emperor';
} = {}): OccupiedEmperorFixture {
  const { payerShare = 5, donorShare = 3, donor = 'guild' } = options;
  const payer = 'harkonnen', payee = 'emperor', trainer = 'atreides', occupier = 'guild';
  const native = createClassicHomeworldSkillsSetup({ occupation: true });
  const setup = structuredClone(native.afterSetup), actions = [...native.actions];
  let game = structuredClone(setup);
  const act = (actor: string, action: Action) => {
    actions.push({ actor, action: structuredClone(action) }); game = applyAction(game, actor, action);
  };
  const reach = (until: (state: Game) => boolean) => { game = advanceOccupiedEmperor(game, until, actions); };
  orderSpice(game, ['land']);
  reach(g => g.phase === 3 && !!g.auction && occupiedEmperorClean(g));
  holdKarama(game, payer);
  reach(g => g.auction!.active === payer && occupiedEmperorClean(g));
  const firstLot = game.auction!.cards[game.auction!.index].id;
  act(payer, { type: 'bid', amount: 10 });
  reach(g => g.decision?.kind === 'auctionPayment');
  act(payer, { type: 'decision', karama: false });
  reach(g => occupiedEmperorClean(g) && occupiedEmperorPlayer(g, payer).hand.some(c => c.id === firstLot));
  assert.equal(occupiedEmperorPlayer(game, payee).spice, 20);
  const fundedEmperor = structuredClone(game);
  reach(g => g.phase === 5 && g.active === payee && occupiedEmperorClean(g));
  const emperor = occupiedEmperorPlayer(game, payee), elite = emperor.elites?.reserves ?? 0;
  assert.equal(emperor.reserves, 20);
  assert.equal(emperor.spice, 20, 'The original Kaitain discard opportunity is declined, retaining shipment funding');
  const destination = 'habbanya_ridge_sietch';
  assert.ok(game.players.every(p => !Object.keys(p.forces).some(key => key.startsWith(`${destination}:`))));
  act(payee, { type: 'ship', territory: destination, sector: territory(destination).sectors[0], amount: 20, elite,
    homeworldSources: { 'homeworld:emperor': { normal: 20 - elite, elite } } });
  reach(g => g.phase === 5 && occupiedEmperorClean(g));
  assert.equal(occupiedEmperorPlayer(game, payee).reserves, 0);
  assert.equal(occupiedEmperorPlayer(game, payee).forces[`${destination}:${territory(destination).sectors[0]}`], 20);
  const emptyKaitain = structuredClone(game);
  // Real transport income pays these bribes; the native Mentat transfers them.
  act(occupier, { type: 'bribe', target: payer, amount: 5 });
  reach(occupiedEmperorClean);
  act(occupier, { type: 'bribe', target: payee, amount: 5 });
  reach(occupiedEmperorClean);
  reach(g => g.turn === 2 && g.phase === 1 && occupiedEmperorClean(g));
  orderSpice(game, ['worm', 'land']);
  reach(g => !!g.nexus && !g.spiceWindow && !g.spiceResolution && occupiedEmperorClean(g));
  act(payer, { type: 'alliance', target: donor });
  act(donor, { type: 'alliance', target: payer });
  assert.equal(occupiedEmperorPlayer(game, payer).ally, donor);
  assert.equal(occupiedEmperorPlayer(game, donor).ally, payer);
  const alliance = structuredClone(game);
  reach(g => g.turn === 2 && g.phase === 5 && g.active === occupier && occupiedEmperorClean(g));
  const invasion = homeworldShipmentChoice(viewGame(game, occupier), 'homeworld:emperor',
    { 'homeworld:guild': { normal: 1, elite: 0 } });
  assert.ok(invasion.action, invasion.blocked ?? undefined);
  act(occupier, invasion.action);
  reach(occupiedEmperorClean);
  const authority = quoteStableHomeworldOccupation(game, 'kaitain');
  assert.equal(authority.blocked, null); assert.equal(authority.entitlement?.occupier, occupier);
  assert.ok(game.homeworldOccupationHistory!.sources.some(source =>
    source.event === authority.entitlement!.qualification && source.cause !== 'setup'));
  const occupied = structuredClone(game);
  orderSpice(game, ['land', 'land']);
  reach(g => g.turn === 3 && g.phase === 3 && !!g.auction && occupiedEmperorClean(g));
  holdKarama(game, payer);
  const karama = holdKarama(game, trainer);
  reach(g => g.auction!.active === payer && occupiedEmperorClean(g));
  const beforePledge = structuredClone(game);
  if (donorShare) act(donor, { type: 'pledgeAid', amount: donorShare });
  const beforeAction = structuredClone(game), gross = payerShare + donorShare;
  assert.ok(occupiedEmperorPlayer(game, payer).spice >= payerShare);
  assertClassicHomeworldSkillsCustody(game);
  return { game, setup, fundedEmperor, emptyKaitain, occupied, alliance, beforePledge, beforeAction,
    payer, donor, payee, trainer, occupier, payerShare, donorShare, gross,
    action: { type: 'bid', amount: gross, allyPayment: donorShare },
    lot: game.auction!.cards[game.auction!.index].id, bonus: game.deck[0].id,
    karama, physical: homeworldFundingCards(game), actions };
}

export function payOccupiedEmperor(f: OccupiedEmperorFixture, state = f.game): Game {
  let game = applyAction(state, f.payer, f.action);
  game = advanceOccupiedEmperor(game, g => g.decision?.kind === 'auctionPayment');
  return applyAction(game, f.payer, { type: 'decision', karama: false });
}
export function chooseOccupiedEmperor(game: Game, redirect: boolean): Game {
  assert.equal(game.decision?.kind, 'bureaucratPayment');
  return applyAction(game, game.decision!.player,
    { type: 'decision', event: game.bureaucratPaymentEvent, redirect });
}
export function allocateOccupiedEmperor(game: Game, ownAmount?: number): Game {
  assert.equal(game.decision?.kind, 'homeworldOccupiedPercentage');
  const offer = viewGame(game, game.decision!.player).homeworldOccupiedPercentage!;
  return allowOccupiedEmperorResponses(applyAction(game, game.decision!.player,
    { type: 'decision', event: offer.event, ownAmount: ownAmount ?? offer.maxOwnAmount }));
}
