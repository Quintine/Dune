import assert from 'node:assert/strict';
import { applyAction, type Action, type Game } from '../game/engine';
import { territory } from '../game/board';
import {
  advanceClassicHomeworldSkills, assertClassicHomeworldSkillsCustody,
  classicHomeworldSkillsPlayer, createClassicHomeworldSkillsSetup,
  type ClassicHomeworldSkillsStep,
} from './fixture-homeworld-classic-skills';

export const homeworldFundingPlayer = classicHomeworldSkillsPlayer;
export const homeworldFundingClean = (game: Game) => !game.phaseOpening && !game.response && !game.decision;
export const advanceHomeworldFunding = advanceClassicHomeworldSkills;

export function homeworldFundingCards(game: Game): string[] {
  const remaining = game.auction?.cards.slice(game.auction.index + Number(game.currentAuctionSale?.origin === 'normal')) ?? [];
  return [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand), ...remaining].map(c => c.id).sort();
}

/** Select only original unplayed Spice cards; retain every physical component. */
function orderSpice(game: Game, kinds: ('land' | 'worm')[], staging: string[]): void {
  const before = [...game.spiceDeck];
  for (const [position, kind] of kinds.entries()) {
    const index = game.spiceDeck.findIndex((card, i) => i >= position && (kind === 'worm'
      ? 'worm' in card : 'territory' in card));
    assert.ok(index >= position);
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
  }
  assert.deepEqual([...game.spiceDeck].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    before.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
  staging.push(`Selected original unplayed Spice order: ${kinds.join(', ')}. No wallets, forces, phase or alliance assigned.`);
}

export type HomeworldFundingFixture = {
  kind: 'auction' | 'shipment'; advanced: boolean;
  game: Game; beforePledge: Game; beforeAction: Game; alliance: Game;
  payer: string; donor: string; payee: string; trainer: string;
  payerShare: number; donorShare: number; gross: number;
  action: Action; card: string | null; target: string; sector: number;
  physical: string[]; staging: string[]; actions: ClassicHomeworldSkillsStep[];
};

/** Real classic Homeworld Skills setup, first Mentat, second-turn worm and
 * reciprocal alliance. Only original unplayed entropy/card custody is staged. */
export function createHomeworldFundingFixture(options: {
  kind: 'auction' | 'shipment'; advanced?: boolean;
  payerShare?: number; donorShare?: number; donor?: string;
}): HomeworldFundingFixture {
  const { kind, advanced = false, payerShare = 5, donorShare = 3 } = options;
  const payer = 'harkonnen', trainer = 'atreides';
  const donor = options.donor ?? (kind === 'auction' ? 'guild' : 'emperor');
  const payee = kind === 'auction' ? 'emperor' : 'guild';
  const setup = createClassicHomeworldSkillsSetup({ advanced });
  const actions = [...setup.actions], staging = [...setup.staging];
  let game = structuredClone(setup.afterSetup);
  assert.equal(game.leaderSkills!.assignments.find(a => a.skill === 'bureaucrat')!.owner, trainer);
  assert.equal(game.homeworldOccupationPreview, undefined);
  orderSpice(game, advanced ? ['land', 'land'] : ['land'], staging);
  game = advanceHomeworldFunding(game, g => g.turn === 2 && g.phase === 1 && homeworldFundingClean(g), actions);
  orderSpice(game, advanced ? ['worm', 'land', 'land'] : ['worm', 'land'], staging);
  game = advanceHomeworldFunding(game, g => !!g.nexus && !g.spiceWindow && !g.spiceResolution && homeworldFundingClean(g), actions);
  for (const [actor, target] of [[payer, donor], [donor, payer]]) {
    const step: ClassicHomeworldSkillsStep = { actor, action: { type: 'alliance', target } };
    actions.push(step); game = applyAction(game, actor, step.action);
  }
  assert.equal(homeworldFundingPlayer(game, payer).ally, donor);
  assert.equal(homeworldFundingPlayer(game, donor).ally, payer);
  const alliance = structuredClone(game);
  game = advanceHomeworldFunding(game, g => g.turn === 2 && g.phase === (kind === 'auction' ? 3 : 5) &&
    homeworldFundingClean(g) && (kind === 'auction' ? g.auction!.active === payer : g.active === payer), actions);
  const beforePledge = structuredClone(game);
  const pledge: Action = { type: 'pledgeAid', amount: donorShare };
  actions.push({ actor: donor, action: pledge }); game = applyAction(game, donor, pledge);
  const beforeAction = structuredClone(game), gross = payerShare + donorShare;
  const target = 'habbanya_ridge_sietch', sector = territory(target).sectors[0];
  const card = kind === 'auction' ? game.auction!.cards[game.auction!.index].id : null;
  if (kind === 'shipment') assert.ok(game.players.every(p => !Object.keys(p.forces).some(k => k.startsWith(target))));
  const action: Action = kind === 'auction' ? { type: 'bid', amount: gross, allyPayment: donorShare }
    : { type: 'ship', territory: target, sector, amount: gross, elite: 0, allyPayment: donorShare };
  assertClassicHomeworldSkillsCustody(game);
  return { kind, advanced, game, beforePledge, beforeAction, alliance, payer, donor, payee, trainer,
    payerShare, donorShare, gross, action, card, target, sector, physical: homeworldFundingCards(game), staging, actions };
}

export function payHomeworldFunding(f: HomeworldFundingFixture, state = f.game): Game {
  let game = applyAction(state, f.payer, f.action);
  if (f.kind === 'shipment') {
    if (game.decision?.kind === 'guildShipment') game = applyAction(game, game.decision.player, { type: 'decision', allow: true });
  } else {
    const index = state.auction!.index;
    for (let n = 0; !game.currentAuctionSale && game.auction?.index === index && n < game.players.length + 2; n++) {
      if (game.decision?.kind === 'auctionPayment') {
        game = applyAction(game, f.payer, { type: 'decision', karama: false }); break;
      }
      assert.ok(!game.decision && !game.response);
      game = applyAction(game, game.auction!.active, { type: 'passBid' });
    }
  }
  return game;
}

export function allowHomeworldFundingResponses(state: Game): Game {
  let game = state;
  for (let n = 0; game.response && n < 60; n++) {
    const actor = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(actor);
    game = applyAction(game, actor.id, { type: 'passResponse' });
  }
  return game;
}
export function chooseHomeworldFunding(game: Game, redirect: boolean): Game {
  assert.equal(game.decision?.kind, 'bureaucratPayment');
  return applyAction(game, game.decision!.player, { type: 'decision', event: game.bureaucratPaymentEvent, redirect });
}

/** Conserved original unplayed Karama custody, explicitly recorded. */
export function holdHomeworldFundingKarama(f: HomeworldFundingFixture): string {
  const player = homeworldFundingPlayer(f.game, f.trainer);
  const held = player.hand.find(c => c.effect === 'karama');
  if (held) return held.id;
  const index = f.game.deck.findIndex(c => c.effect === 'karama'); assert.ok(index >= 0 && player.hand.length > 0);
  const card = f.game.deck[index], outgoing = player.hand[0];
  player.hand[0] = card; f.game.deck[index] = outgoing;
  f.staging.push(`Conserved original unplayed custody swap: ${card.id} from deck -> ${f.trainer} hand, ${outgoing.id} -> deck, solely for the original income cancellation response.`);
  f.beforeAction = structuredClone(f.game);
  assert.deepEqual(homeworldFundingCards(f.game), f.physical);
  assertClassicHomeworldSkillsCustody(f.game);
  return card.id;
}
