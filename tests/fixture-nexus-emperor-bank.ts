import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeNexusGameForAudit, joinGame, newPlayer,
  type Action, type Game, type Player,
} from '../game/engine';
import { treacheryDeck, type Card } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { validateNexusCards } from '../game/nexus-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { validateAmbassadors } from '../game/ecaz-ambassadors';
import { emperorNexusPurchaseEvent } from '../game/nexus-emperor-purchase';
import { homeworldContext, homeworldGameIntegrity } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { createSingleNexusE1Setup, nextSingleNexusE1Step } from './fixture-single-nexus-e1';
import { createSingleE2Setup, nextSingleE2Step } from './fixture-single-nexus-e2';
import { createE3NexusEcazSetup, nextE3NexusEcazStep, orderE3NexusEcazSpice } from './fixture-e3-nexus-ecaz';
import { createMoritaniNexusSetup, nextMoritaniNexusStep } from './fixture-e3-nexus-moritani';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';

export type NexusEmperorBankOptions = {
  advanced?: boolean;
  profile?: 'ixians' | 'tleilaxu' | 'richese' | 'choam' | 'ecaz' | 'moritani';
  nexusCard?: 'emperor' | 'guild';
  homeworlds?: boolean;
  tech?: boolean;
};
export type NexusEmperorBankStep = { actor: string; action: Action };
export type NexusEmperorBankTransition = { before: Game; step: NexusEmperorBankStep; after: Game };
export type NexusEmperorBankFixture = {
  game: Game; owner: string; event: string; card: Card; price: number;
  wallets: Record<string, number>; actions: NexusEmperorBankStep[];
  chronology: {
    initial: Game; afterSetup: Game; firstMentat: NexusEmperorBankTransition;
    worm: Game; alliance: Game; draw: NexusEmperorBankTransition;
    afterClosingDraw: Game; beforeBid: Game;
  };
};
export function nexusEmperorBankPlayer(game: Game, actor: string): Player {
  const player = game.players.find(p => p.id === actor); assert.ok(player); return player;
}
const clean = (g: Game) => !g.phaseOpening && !g.response && !g.decision &&
  !g.truthtrance && !g.pendingTreacheryDiscard;

export function stepNexusEmperorBank(game: Game, step: NexusEmperorBankStep,
  actions?: NexusEmperorBankStep[]): Game {
  actions?.push(structuredClone(step));
  return withClassicDiscoveryNexusLottery(() => applyAction(structuredClone(game), step.actor, step.action));
}
/** Pass original optional windows and cache bids; never manufacture a plan or acquire cache fuel. */
export function nextNexusEmperorBankStep(game: Game): NexusEmperorBankStep {
  if (clean(game) && game.nexusCards?.phase?.stage === 'drawing') {
    const actor = game.nexusCards.phase.eligible.find(id => !game.nexusCards!.phase!.done.includes(id));
    assert.ok(actor);
    return { actor, action: { type: 'nexusCardChoice', turn: game.turn,
      card: game.nexusCards.cards!.hands[actor] ?? null, choice: 'keep', ownRedraws: 0 } };
  }
  if (!game.phaseOpening && !game.response && !game.truthtrance) {
    if (game.decision?.kind === 'richeseUnbid') return { actor: game.decision.player,
      action: { type: 'decision', event: game.richeseBidding!.event, keep: false } };
    if (game.decision?.kind === 'techToken') return { actor: game.decision.player,
      action: { type: 'decision', token: game.decision.choices[0] } };
    if (!game.decision && game.richeseAuction) {
      const lot = game.richeseAuction;
      const actor = lot.method === 'silent'
        ? lot.eligible.find(id => !Object.hasOwn(lot.sealed, id)) : lot.active;
      assert.ok(actor);
      return { actor, action: { type: 'richeseBid', event: lot.event,
        amount: lot.method === 'silent' ? 0 : null, allyPayment: 0 } };
    }
  }
  const next = game.players.some(p => p.faction === 'moritani') ? nextMoritaniNexusStep(game)
    : game.players.some(p => p.faction === 'ecaz') ? nextE3NexusEcazStep(game)
    : game.expansions.includes('choam') ? nextSingleE2Step(game)
    : game.expansions.includes('ix') ? nextSingleNexusE1Step(game)
    : nextStrongholdFactionsNativeStep(game);
  assert.ok(next, `Original BANK chronology needs its actual ${game.decision?.kind ?? 'sealed plan'} owner`);
  return next;
}
export function advanceNexusEmperorBank(game: Game, until: (game: Game) => boolean,
  actions?: NexusEmperorBankStep[]): Game {
  for (let n = 0; n < 1800; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    game = stepNexusEmperorBank(game, nextNexusEmperorBankStep(game), actions);
  }
  throw Error('Original BANK chronology did not reach its requested boundary');
}
/** Paid auction prefixes are references, not a second physical card zone. */
export function nexusEmperorBankInventory(game: Game): void {
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.ixSetupCards ?? []), ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...(game.auction?.cards.slice(game.auction.index + Number(!!game.currentAuctionSale)) ?? [])];
  assert.deepEqual(cards.map(c => c.id).sort(), [...treacheryDeck(game.expansions),
    ...(game.players.some(p => p.faction === 'richese') ? richeseCards() : [])].map(c => c.id).sort());
  validateNexusCards(game.nexusCards!.cards!, game.players);
  if (game.leaderSkills) validateLeaderSkills(game.leaderSkills, game.players);
  if (game.ecazAmbassadors) validateAmbassadors(game.ecazAmbassadors);
  if (game.homeworlds) homeworldGameIntegrity(game);
  const homes = game.homeworlds ? homeworldForceGroups(homeworldContext(game), game.homeworlds.custody!) : [];
  for (const player of game.players) {
    const visitors = homes.filter(h => h.native !== player.id).map(h => h.forces[player.id] ?? { normal: 0, elite: 0 });
    assert.equal(player.reserves + player.tanks + Object.values(player.forces).reduce((n, f) => n + f, 0) +
      visitors.reduce((n, f) => n + f.normal + f.elite, 0), 20);
    if (player.elites) assert.equal(player.elites.reserves + player.elites.tanks +
      Object.values(player.elites.forces).reduce((n, f) => n + f, 0) + visitors.reduce((n, f) => n + f.elite, 0),
    player.faction === 'ixians' ? 7 : player.faction === 'emperor' ? 5 : 3);
  }
}

/** Genuine native producer, full first turn, other-seat pact and physical closing draw.
 * Only still-undealt Spice/Nexus (and classic starting Treachery) order is selected. */
export function createNexusEmperorBankFixture(options: NexusEmperorBankOptions = {}): NexusEmperorBankFixture {
  const advanced = options.advanced ?? false, profile = options.profile;
  const roster = [profile ?? 'harkonnen', 'guild', 'atreides'] as const;
  const modules = { advanced, roster, homeworlds: options.homeworlds ?? false, tech: options.tech ?? false };
  let game: Game, initial: Game, afterSetup: Game;
  const actions: NexusEmperorBankStep[] = [];
  if (profile === 'ixians' || profile === 'tleilaxu') {
    const setup = createSingleNexusE1Setup({ ...modules, native: profile, skills: false,
      startingEffects: [undefined, undefined, 'truthtrance'] });
    ({ initial, afterSetup } = setup); actions.push(...setup.actions); game = structuredClone(afterSetup);
  } else if (profile === 'richese' || profile === 'choam') {
    const setup = createSingleE2Setup({ ...modules, native: profile, skills: false });
    ({ initial, afterSetup } = setup); actions.push(...setup.actions); game = structuredClone(afterSetup);
  } else if (profile === 'ecaz' || profile === 'moritani') {
    const setup = profile === 'ecaz' ? createE3NexusEcazSetup(modules) : createMoritaniNexusSetup(modules);
    ({ initial, afterSetup } = setup); actions.push(...setup.actions); game = structuredClone(afterSetup);
  } else {
    game = createGame('NEXUSEMPERORBANK', newPlayer(roster[0], roster[0], roster[0]), advanced);
    for (const faction of roster.slice(1)) joinGame(game, newPlayer(faction, faction, faction));
    game.nexusCards = { cards: null, phase: null };
    for (const [type, enabled] of [['homeworlds', modules.homeworlds], ['techTokens', modules.tech]] as const)
      if (enabled) game = stepNexusEmperorBank(game, { actor: game.host, action: { type, enabled } }, actions);
    initial = structuredClone(game);
    for (const player of game.players) game = stepNexusEmperorBank(game, { actor: player.id, action: { type: 'ready' } }, actions);
    game = withClassicDiscoveryNexusLottery(() => initializeNexusGameForAudit(game));
    const prefix: Card[] = [];
    for (let n = 0; n < 4; n++) {
      const index = game.deck.findIndex(c => c.kind === 'worthless'); assert.ok(index >= 0);
      prefix.push(game.deck.splice(index, 1)[0]);
    }
    game.deck.unshift(...prefix);
    game = advanceNexusEmperorBank(game, g => g.status === 'playing', actions);
    afterSetup = structuredClone(game);
  }
  const owner = roster[0];
  orderE3NexusEcazSpice(game);
  let firstMentat: NexusEmperorBankTransition | undefined;
  for (let n = 0; game.turn === 1 && n < 600; n++) {
    const before = structuredClone(game), step = nextNexusEmperorBankStep(game);
    game = stepNexusEmperorBank(game, step, actions);
    if (game.turn !== before.turn) firstMentat = { before, step, after: structuredClone(game) };
  }
  assert.ok(firstMentat);
  game = advanceNexusEmperorBank(game, g => g.phase === 1 && clean(g), actions);
  orderE3NexusEcazSpice(game, true);
  game = advanceNexusEmperorBank(game, g => !!g.nexus && !g.spiceWindow && !g.spiceResolution && clean(g), actions);
  const worm = structuredClone(game);
  for (const [actor, target] of [['guild', 'atreides'], ['atreides', 'guild']])
    game = stepNexusEmperorBank(game, { actor, action: { type: 'alliance', target } }, actions);
  const alliance = structuredClone(game);
  game = advanceNexusEmperorBank(game, g => g.nexusCards?.phase?.stage === 'drawing' && clean(g), actions);
  const cards = game.nexusCards!.cards!, face = options.nexusCard ?? 'emperor';
  const index = cards.deck.indexOf(face); assert.ok(index >= 0);
  cards.deck.unshift(cards.deck.splice(index, 1)[0]);
  const before = structuredClone(game), step: NexusEmperorBankStep = { actor: owner,
    action: { type: 'nexusCardChoice', turn: game.turn, card: cards.hands[owner] ?? null, choice: 'draw', ownRedraws: 0 } };
  game = stepNexusEmperorBank(game, step, actions);
  const draw = { before, step, after: structuredClone(game) };
  assert.equal(game.nexusCards!.cards!.hands[owner], face);
  game = advanceNexusEmperorBank(game, g => g.nexusCards?.phase?.stage === 'complete' && clean(g), actions);
  const afterClosingDraw = structuredClone(game);
  game = advanceNexusEmperorBank(game, g => g.phase === 3 && !!g.auction && !g.richeseAuction && clean(g), actions);
  while (game.auction!.active !== owner)
    game = stepNexusEmperorBank(game, { actor: game.auction!.active, action: { type: 'passBid' } }, actions);
  const beforeBid = structuredClone(game), card = structuredClone(game.auction!.cards[game.auction!.index]);
  const price = 2;
  game = stepNexusEmperorBank(game, { actor: owner, action: { type: 'bid', amount: price, allyPayment: 0 } }, actions);
  game = advanceNexusEmperorBank(game, g => g.decision?.kind === 'auctionPayment', actions);
  assert.equal(game.decision!.player, owner);
  assert.equal(game.auction!.bid, price);
  assert.equal(game.auction!.cards[game.auction!.index].id, card.id);
  assert.equal(nexusEmperorBankPlayer(game, owner).hand.some(c => c.id === card.id), false);
  const event = emperorNexusPurchaseEvent(game.turn, owner,
    game.nexusEmperorPurchaseHistory?.length ?? 0, game.auction!.index, price);
  nexusEmperorBankInventory(game);
  return { game, owner, event, card, price, wallets: Object.fromEntries(game.players.map(p => [p.id, p.spice])), actions,
    chronology: { initial, afterSetup, firstMentat, worm, alliance, draw, afterClosingDraw, beforeBid } };
}
