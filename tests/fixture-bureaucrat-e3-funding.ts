import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import {
  advancePairedE3Nexus, createPairedE3NexusSetup, pairedE3NexusClean,
  pairedE3NexusInventory, pairedE3NexusPlayer, pairedE3NexusReload,
  quietPairedE3NexusChoice, stepPairedE3Nexus,
} from './fixture-paired-e3-nexus-modules';

export type BureaucratE3FundingStep = { actor: string; action: Action };

/** Original six/ five-seat paired E3 roster: both natives, three classics. */
export const BUREAUCRAT_E3_ROSTER = ['ecaz', 'moritani', 'guild', 'atreides', 'emperor'] as const;
/** The single classic seat trained with the native Bureaucrat skill. */
export const BUREAUCRAT_E3_TRAINER = 'atreides';

export interface BureaucratE3FundingBase {
  actions: BureaucratE3FundingStep[];
  staging: string[];
  /** Turn-2 Spice blow Nexus window: real alliances may still form here. */
  worm: Game;
  /** Turn-2 Bidding boundary with the requested real mutual alliance formed. */
  game: Game;
  alliance: Game;
  payer: string;
  donor: string;
  guild: string;
  emperor: string;
  trainer: string;
}

function frontSpice(
  game: Game,
  match: (card: Game['spiceDeck'][number]) => boolean,
  position: number,
): void {
  const at = game.spiceDeck.findIndex((c, i) => i >= position && match(c));
  assert.ok(at >= position, 'An original unplayed Spice Card must remain for staging.');
  game.spiceDeck.splice(position, 0, game.spiceDeck.splice(at, 1)[0]);
}

/** Only counter-card custody is controlled here: swap an original unplayed
 * card without adding a card, hand space, wallet, army, receipt or turn. */
function holdE3Card(
  game: Game,
  actor: string,
  match: (card: Game['deck'][number]) => boolean,
  staging: string[],
): string {
  const owner = pairedE3NexusPlayer(game, actor);
  const held = owner.hand.find(match);
  if (held) return held.id;
  const index = game.deck.findIndex(match);
  assert.ok(index >= 0 && owner.hand.length > 0);
  const outgoing = owner.hand[0];
  const incoming = game.deck[index];
  owner.hand[0] = incoming;
  game.deck[index] = outgoing;
  staging.push(
    `Native response window: swap original unplayed ${incoming.id} with held ${outgoing.id} for ${actor}; retain physical cards and hand size.`,
  );
  return incoming.id;
}

/** Genuine paired E3 setup with skills, a real turn-2 worm Nexus and a real
 * mutual alliance between the payer and the requested donor. Never assigns
 * wallets, armies, phase, assignment or alliance state. */
export function createBureaucratE3FundingBase(
  { advanced = false, donor = 'moritani' }: { advanced?: boolean; donor?: string } = {},
): BureaucratE3FundingBase {
  const options = { roster: [...BUREAUCRAT_E3_ROSTER], advanced, skills: true };
  const setup = createPairedE3NexusSetup(options);
  assert.ok(setup.afterSetup.leaderSkills!.assignments.some(
    (a) => a.owner === BUREAUCRAT_E3_TRAINER && a.skill === 'bureaucrat' && a.leader,
  ));
  assert.deepEqual(setup.afterSetup.players.map((p) => p.faction), [...BUREAUCRAT_E3_ROSTER]);
  const actions: BureaucratE3FundingStep[] = [];
  const staging: string[] = [];
  let game = pairedE3NexusReload(setup.afterSetup);
  const act = (actor: string, action: Action): void => {
    actions.push({ actor, action });
    game = stepPairedE3Nexus(game, { actor, action });
  };
  // Reach turn 2's real Spice blow, then stage only original unplayed Spice
  // Cards so the Great Maker reveals a worm and a Nexus forms.
  game = advancePairedE3Nexus(game, (s) => s.turn === 2 && s.phase === 1 && pairedE3NexusClean(s), actions, quietPairedE3NexusChoice);
  if (advanced) for (let i = 1; i <= 2; i++) frontSpice(game, (c) => 'territory' in c && !c.discovery, i);
  frontSpice(game, (c) => 'worm' in c && !c.greatMaker && !c.suppressed, 0);
  staging.push('Reorder only original still-unplayed Spice Cards so the turn-2 Great Maker reveals a worm.');
  game = advancePairedE3Nexus(game, (s) => !!s.nexus && !s.spiceWindow && !s.spiceResolution && pairedE3NexusClean(s), actions, quietPairedE3NexusChoice);
  const worm = pairedE3NexusReload(game);
  assert.ok(pairedE3NexusPlayer(worm, 'ecaz').ally === null);
  act('ecaz', { type: 'alliance', target: donor });
  act(donor, { type: 'alliance', target: 'ecaz' });
  assert.equal(pairedE3NexusPlayer(game, 'ecaz').ally, donor);
  assert.equal(pairedE3NexusPlayer(game, donor).ally, 'ecaz');
  const alliance = pairedE3NexusReload(game);
  game = advancePairedE3Nexus(game, (s) => s.turn === 2 && s.phase === 3 && pairedE3NexusClean(s), actions, quietPairedE3NexusChoice);
  pairedE3NexusInventory(game);
  return {
    actions, staging, worm, game, alliance,
    payer: 'ecaz', donor, guild: 'guild', emperor: 'emperor', trainer: BUREAUCRAT_E3_TRAINER,
  };
}

/** Pass the original income/counter windows without manufacturing a receipt. */
export function allowE3Responses(state: Game): Game {
  let game = state;
  for (let n = 0; game.response && n < 40; n++) {
    const actor = game.players.find((p) => {
      const controls = viewGame(game, p.id).responseControls;
      return controls && !controls.hasPassed && controls.cancelCards.length > 0;
    });
    assert.ok(actor, 'An original unpassed counter holder must remain');
    game = applyAction(game, actor.id, { type: 'passResponse' });
  }
  assert.equal(game.response, null);
  return game;
}

// ---------------------------------------------------------------------------
// Ordinary auction whose original payee is the Emperor.
// ---------------------------------------------------------------------------

export interface BureaucratE3AuctionFixture extends BureaucratE3FundingBase {
  beforePledge: Game;
  beforeAction: Game;
  card: string;
  amount: number;
  payerShare: number;
  donorShare: number;
  action: Action;
  payee: string;
  counterCard?: string;
  physical: string[];
}

/** Only original unplayed-card custody is controlled here. */
export function bureaucratE3PhysicalCards(game: Game): string[] {
  const auction = game.auction;
  const remaining = auction
    ? auction.cards.slice(auction.index + Number(game.currentAuctionSale?.origin === 'normal'))
    : [];
  return [...game.deck, ...game.discard, ...game.players.flatMap((p) => p.hand), ...remaining]
    .map((card) => card.id).sort();
}

export function createBureaucratE3AuctionFixture({
  advanced = false, payerShare = 5, donorShare = 3, donor = 'moritani', counter = false,
}: {
  advanced?: boolean; payerShare?: number; donorShare?: number; donor?: string; counter?: boolean;
} = {}): BureaucratE3AuctionFixture {
  const base = createBureaucratE3FundingBase({ advanced, donor });
  const actions = [...base.actions];
  const staging = [...base.staging];
  let game = pairedE3NexusReload(base.game);
  // Spend the original passes until the payer's genuine bid is next.
  for (let n = 0; game.auction!.active !== base.payer && n < game.players.length; n++) {
    const action: Action = { type: 'passBid' };
    actions.push({ actor: game.auction!.active, action });
    game = applyAction(game, game.auction!.active, action);
  }
  assert.equal(game.auction!.active, base.payer);
  const physical = bureaucratE3PhysicalCards(game);
  const counterCard = counter ? holdE3Card(game, base.trainer, (card) => card.effect === 'karama', staging) : undefined;
  const beforePledge = pairedE3NexusReload(game);
  const pledge: Action = { type: 'pledgeAid', amount: donorShare };
  actions.push({ actor: donor, action: pledge });
  game = applyAction(game, donor, pledge);
  assert.equal(game.aid[donor].amount, donorShare);
  const beforeAction = pairedE3NexusReload(game);
  const card = game.auction!.cards[game.auction!.index].id;
  const amount = payerShare + donorShare;
  const action: Action = { type: 'bid', amount, allyPayment: donorShare };
  return { ...base, actions, staging, game, physical, counterCard,
    beforePledge, beforeAction, card, amount, payerShare, donorShare, action, payee: base.emperor };
}

/** Commit the declared bid. Passes the remaining original bidders. */
export function payBureaucratE3Auction(fixture: BureaucratE3AuctionFixture, state = fixture.game): Game {
  const index = state.auction!.index;
  let game = applyAction(state, fixture.payer, fixture.action);
  for (let n = 0; !game.currentAuctionSale && game.auction?.index === index && n < game.players.length + 2; n++) {
    if (game.decision?.kind === 'auctionPayment') {
      game = applyAction(game, fixture.payer, { type: 'decision', karama: false });
      break;
    }
    assert.ok(!game.decision && !game.response);
    game = applyAction(game, game.auction!.active, { type: 'passBid' });
  }
  return game;
}

export function chooseBureaucratE3Payment(game: Game, redirect = true): Game {
  assert.equal(game.decision?.kind, 'bureaucratPayment');
  return applyAction(game, game.decision!.player, { type: 'decision', event: game.bureaucratPaymentEvent, redirect });
}

// ---------------------------------------------------------------------------
// Ordinary shipment whose original payee is the Guild.
// ---------------------------------------------------------------------------

export interface BureaucratE3ShipmentFixture extends BureaucratE3FundingBase {
  beforePledge: Game;
  beforeAction: Game;
  target: string;
  action: Action;
  primary: number;
  donorAmount: number;
  amount: number;
  payee: string;
  physical: string[];
}

export function createBureaucratE3ShipmentFixture({
  advanced = false, primary = 5, partner = 'moritani', pledge = 3,
}: {
  advanced?: boolean; primary?: number; partner?: string; pledge?: number;
} = {}): BureaucratE3ShipmentFixture {
  const base = createBureaucratE3FundingBase({ advanced, donor: partner });
  const actions = [...base.actions];
  const staging = [...base.staging];
  let game = pairedE3NexusReload(base.game);
  game = advancePairedE3Nexus(game, (s) => s.turn === 2 && s.phase === 5 && s.active === base.payer && pairedE3NexusClean(s), actions, quietPairedE3NexusChoice);
  assert.equal(game.turn, 2);
  const target = 'habbanya_ridge_sietch';
  assert.ok(game.players.every((p) => !Object.keys(p.forces).some((key) => key.startsWith(target))));
  const physical = bureaucratE3PhysicalCards(game);
  const beforePledge = pairedE3NexusReload(game);
  const aid: Action = { type: 'pledgeAid', amount: pledge };
  actions.push({ actor: partner, action: aid });
  game = applyAction(game, partner, aid);
  assert.equal(game.aid[partner].amount, pledge);
  const beforeAction = pairedE3NexusReload(game);
  const amount = primary + pledge;
  const action: Action = { type: 'ship', territory: target, sector: 17, amount, elite: 0, allyPayment: pledge };
  return { ...base, actions, staging, game, physical,
    beforePledge, beforeAction, target, action, primary, donorAmount: pledge, amount, payee: base.guild };
}

/** Declare once. In Advanced the original Guild interception commits the ship. */
export function declareBureaucratE3Shipment(
  fixture: BureaucratE3ShipmentFixture,
): { game: Game; declared: Game; paid: Game; actions: BureaucratE3FundingStep[] } {
  const actions: BureaucratE3FundingStep[] = [];
  let game = applyAction(pairedE3NexusReload(fixture.beforeAction), fixture.payer, fixture.action);
  actions.push({ actor: fixture.payer, action: fixture.action });
  const declared = pairedE3NexusReload(game);
  if (game.decision?.kind === 'guildShipment') {
    const actor = game.decision.player;
    const action: Action = { type: 'decision', allow: true };
    actions.push({ actor, action });
    game = applyAction(game, actor, action);
  }
  return { game, declared, paid: pairedE3NexusReload(game), actions };
}
