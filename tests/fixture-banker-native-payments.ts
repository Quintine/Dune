import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { homeworldContext, homeworldGameIntegrity } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { ambassadorPlacementDestinations, quoteEcazAmbassadorPlacement } from '../game/ecaz-ambassador-placement';
import { validateLeaderSkills } from '../game/leader-skills';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { createIndependentCardModulesFixture } from './fixture-independent-card-modules';
import { actTruthMovement, type TruthMovementStep } from './fixture-truth-movement';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type BankerNativePaymentStep = TruthMovementStep;
export const actBankerNativePayment = actTruthMovement;
export const bankerNativePaymentReload = (game: Game): Game => JSON.parse(JSON.stringify(game)) as Game;
export const bankerNativePaymentPlayer = (game: Game, actor: string) => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const bankerNativePaymentClean = (game: Game) => !game.response && !game.phaseOpening &&
  !game.decision && !game.pendingTreacheryDiscard && !game.truthtrance;
export const bankerNativePaymentDeferred = (game: Game, owner = 'guild') =>
  viewGame(game, owner).spiceBankerIncome!.deferred.find(row => row.owner === owner)?.amount ?? 0;

export function bankerNativePaymentInventory(game: Game) {
  homeworldGameIntegrity(game);
  validateLeaderSkills(game.leaderSkills!, game.players);
  const sum = (counts: Record<string, number>) => Object.values(counts).reduce((a, b) => a + b, 0);
  const worlds = homeworldForceGroups(homeworldContext(game), game.homeworlds!.custody!);
  for (const player of game.players) {
    const visitors = worlds.filter(world => world.native !== player.id)
      .map(world => world.forces[player.id] ?? { normal: 0, elite: 0 });
    assert.equal(player.reserves + player.tanks + sum(player.forces) +
      visitors.reduce((total, group) => total + group.normal + group.elite, 0), 20);
  }
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand),
    ...(game.auction?.cards.slice(game.auction.index + (game.currentAuctionSale ? 1 : 0)) ?? [])]
    .map(card => card.id).sort();
  const traitors = [...(game.traitorReserve ?? []), ...game.players.flatMap(player =>
    [...player.traitors, ...player.traitorChoices])].sort();
  const skills = [...game.leaderSkills!.deck, ...game.leaderSkills!.assignments.map(assignment => assignment.skill),
    ...Object.values(game.leaderSkills!.offers).flatMap(offer => offer.cards)].sort();
  const spice = [...game.spiceDeck, ...game.spiceDiscard.flat()].map(card => JSON.stringify(card)).sort();
  assert.equal(new Set(cards).size, cards.length);
  assert.equal(new Set(traitors).size, traitors.length);
  assert.deepEqual(skills, LEADER_SKILL_CARDS.map(card => card.id).sort());
  return { cards, traitors, skills, spice };
}

/** Only existing native controls. The caller owns unpaid placement declarations. */
export function nextBankerNativePaymentStep(game: Game): BankerNativePaymentStep | null {
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    if (game.biddingEnd) {
      const actor = game.biddingEnd.owners.find(actor => !game.biddingEnd!.ready.includes(actor));
      return actor ? { actor, action: { type: 'biddingEnd', event: game.biddingEnd.event, mode: 'ready' } } : null;
    }
    if (game.decision?.kind === 'ecazPlacement')
      return { actor: game.decision.player, action: { type: 'decision', decline: true } };
  }
  return nextStrongholdFactionsNativeStep(game);
}
export function advanceBankerNativePayments(game: Game, until: (state: Game) => boolean,
  actions: BankerNativePaymentStep[] = []): Game {
  for (let count = 0; count < 1200; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The genuine payment chronology ended before its requested boundary');
    const step = nextBankerNativePaymentStep(game); assert.ok(step);
    game = actBankerNativePayment(game, step.actor, step.action, actions);
  }
  throw Error('The native payment programme did not reach its finite boundary');
}
export function settleBankerNativePayment(game: Game, actions: BankerNativePaymentStep[] = []): Game {
  return advanceBankerNativePayments(game, state => !state.response && !state.phaseOpening &&
    !state.pendingTreacheryDiscard && !state.pendingKarama, actions);
}
export function bankerKaitainAction(game: Game, cards: readonly string[]): Action {
  assert.ok(game.biddingEnd && bankerNativePaymentClean(game));
  return { type: 'biddingEnd', event: game.biddingEnd.event, mode: 'discard', cards: [...cards] };
}
export function enterBankerEcazPlacement(game: Game, actions: BankerNativePaymentStep[] = []): Game {
  return advanceBankerNativePayments(game, state => state.phase === 4 && state.decision?.kind === 'ecazPlacement' &&
    !state.response && !state.phaseOpening && !state.pendingTreacheryDiscard, actions);
}
export function bankerEcazPlacementAction(game: Game): { action: Action; cost: number; token: string; territory: string } {
  assert.equal(game.decision?.kind, 'ecazPlacement');
  const token = game.ecazAmbassadors!.tokens.find(token => token.zone === 'supply'); assert.ok(token);
  const destination = ambassadorPlacementDestinations(game)[0]; assert.ok(destination);
  const quote = quoteEcazAmbassadorPlacement(game, bankerNativePaymentPlayer(game, 'ecaz'), token.id, destination.id);
  return { action: { type: 'decision', token: token.id, territory: destination.id },
    cost: quote.cost, token: token.id, territory: destination.id };
}
export function payBankerEcazPlacement(game: Game, actions: BankerNativePaymentStep[] = []): Game {
  return settleBankerNativePayment(actBankerNativePayment(game, 'ecaz', bankerEcazPlacementAction(game).action, actions), actions);
}

/** Original Basic selected E3 roster, all14 Skills and native Homeworlds only.
 * The supported preview initializer controls the original skill lottery, deals
 * starting hands and accepts real training/Traitor/force choices. This adapter
 * chooses only unopened next auction cards/Spice positions and actual bid1s.
 * No played hand, cash, army, phase, population or income receipt is assigned.
 */
export function createBankerNativePaymentsFixture(options: { banker?: 'guild' | 'ecaz'; poisonFunding?: boolean } = {}) {
  const banker = options.banker ?? 'guild';
  const base = createIndependentCardModulesFixture({ advanced: false,
    factions: ['guild', 'ecaz', 'emperor'], expansions: ['ecaz'], independent: false,
    homeworlds: true, skills: true, tech: false, strongholds: false,
    training: { guild: banker === 'guild' ? 'spice-banker' : 'warmaster',
      ecaz: banker === 'ecaz' ? 'spice-banker' : 'warmaster', emperor: 'mentat' } });
  let game = base.game;
  const afterSetup = structuredClone(game), actions: BankerNativePaymentStep[] = [...base.steps];
  const setupSteps = structuredClone(actions), original = bankerNativePaymentInventory(game);
  assert.equal(game.advanced, false); assert.deepEqual(game.expansions, ['ecaz']);
  assert.ok(game.homeworlds && game.leaderSkills && game.spiceBankerIncomePreview);
  assert.ok(!game.ecazTreachery && !game.nexusCards && !game.discoveryEnabled && !game.techTokens && !game.strongholdCards);
  const assignment = game.leaderSkills!.assignments.find(assignment => assignment.skill === 'spice-banker');
  assert.ok(assignment && assignment.owner === banker);
  const emperor = bankerNativePaymentPlayer(game, 'emperor');
  const needSecond = options.poisonFunding || !emperor.hand.some(card => card.kind !== 'poison');
  const karama = game.deck.find(card => card.effect === 'karama'); assert.ok(karama);
  const second = game.deck.find(card => options.poisonFunding ? card.kind === 'poison' : card.kind === 'shield'); assert.ok(second);
  const unopened = [karama.id, ...(needSecond ? [second.id] : [])];
  const auctionOrder = unopened.map((id, position) => {
    const from = game.deck.findIndex(card => card.id === id); assert.ok(from >= position);
    const [card] = game.deck.splice(from, 1); game.deck.splice(position, 0, card);
    return { position, from, card: id };
  });
  const spiceOrder = [0].map(position => {
    const from = game.spiceDeck.findIndex(card => 'territory' in card &&
      !['imperial_basin', 'tueks_sietch'].includes(card.territory)); assert.ok(from >= position);
    const [card] = game.spiceDeck.splice(from, 1); game.spiceDeck.splice(position, 0, card);
    return { position, from, card: structuredClone(card) };
  });
  const act = (actor: string, action: Action) => { game = actBankerNativePayment(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceBankerNativePayments(game, until, actions); };
  reach(state => state.phase === 3 && !!state.auction && !state.response && !state.phaseOpening && !state.decision);
  const beforeAuction = structuredClone(game), purchased: string[] = [], invoices: { card: string; amount: number }[] = [];
  for (let lot = 0; lot < unopened.length; lot++) {
    assert.equal(game.auction?.index, lot);
    const card = game.auction!.cards[lot].id; assert.equal(card, unopened[lot]);
    const before = bankerNativePaymentPlayer(game, 'emperor').spice;
    let declared = false;
    for (let count = 0; !bankerNativePaymentPlayer(game, 'emperor').hand.some(held => held.id === card) && count < 80; count++) {
      if (!game.response && !game.phaseOpening && !game.decision) {
        assert.ok(game.auction); const actor = game.auction.active;
        if (actor === 'emperor' && !declared) { act(actor, { type: 'bid', amount: 1 }); declared = true; }
        else act(actor, { type: 'passBid' });
      } else {
        const step = nextBankerNativePaymentStep(game); assert.ok(step); act(step.actor, step.action);
      }
    }
    assert.ok(declared); assert.ok(bankerNativePaymentPlayer(game, 'emperor').hand.some(held => held.id === card));
    const amount = before - bankerNativePaymentPlayer(game, 'emperor').spice;
    assert.equal(amount, 1); purchased.push(card); invoices.push({ card, amount });
  }
  reach(state => !!state.biddingEnd && bankerNativePaymentClean(state));
  assert.equal(game.phase, 3);
  const held = bankerNativePaymentPlayer(game, 'emperor').hand;
  assert.ok(held.some(card => card.id === karama.id));
  const fundingCard = options.poisonFunding ? held.find(card => card.id === second.id) : undefined;
  const disposalCards = fundingCard
    ? [fundingCard.id, held.find(card => card.id !== fundingCard.id)!.id]
    : held.filter(card => card.kind !== 'poison').slice(0, 2).map(card => card.id);
  assert.equal(disposalCards.length, 2);
  assert.equal(bankerNativePaymentDeferred(game, banker), 0, 'Only actual one-spice auction invoices have occurred');
  assert.deepEqual(bankerNativePaymentInventory(game), original);
  return { initial: base.initial, offered: base.offered, afterSetup, beforeAuction, game, banker,
    assignment: structuredClone(assignment), karama: karama.id, purchased, invoices, disposalCards,
    fundingCard: fundingCard?.id ?? null, auctionOrder, spiceOrder, original, setupSteps,
    actions, readySteps: setupSteps.filter(step => step.action.type === 'ready'),
    setupChoiceSteps: setupSteps.filter(step => step.action.type !== 'ready'),
    sourceCounts: { ready: setupSteps.filter(step => step.action.type === 'ready').length,
      setupChoices: setupSteps.filter(step => step.action.type !== 'ready').length,
      setup: setupSteps.length, source: actions.length },
    sourceDisclosure: 'Supported initializeLeaderSkillsGameForAudit preview initialization of original Basic Guild/Ecaz/Emperor all14 training and Worlds, not a public start action. Inherited recorded steps include actual Ready/setup choices; the earlier World option selection and initializer are not counted as actions. Only original unopened Karama/optional poison auction positions and Spice order are selected, followed by actual Emperor bid1/spice invoices, all-pass remainder and high-Kaitain closing controls. No installed played state or future income.' };
}
