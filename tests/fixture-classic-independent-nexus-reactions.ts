import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { baseDeck } from '../game/cards';
import type { FactionId } from '../game/catalog';
import { territory } from '../game/board';
import { HARASS_WITHDRAW_CARD } from '../game/harass-withdraw';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import { createClassicIndependentNexusFixture, advanceClassicIndependentNexus,
  type ClassicIndependentNexusOptions, type ClassicIndependentNexusStep } from './fixture-classic-independent-nexus';
import { applyClassicDiscoveryNexusStep, classicDiscoveryNexusClean,
  nextClassicDiscoveryNexusStep } from './fixture-discovery-classic-nexus';

export const reactionPlayer = (game: Game, id: string) => {
  const player = game.players.find(seat => seat.id === id);
  assert.ok(player);
  return player;
};
export function reactionAction(game: Game, actor: string, action: Action, actions?: ClassicIndependentNexusStep[]) {
  return applyClassicDiscoveryNexusStep(game, { actor, action }, actions);
}

/** Original setup and turn-one play, followed by a real worm, reciprocal
 * alliance and closing draw. Only unused original deck singletons move. */
export function drawClassicNexusReaction(face: FactionId, owner: string,
  options: ClassicIndependentNexusOptions) {
  const fixture = createClassicIndependentNexusFixture({ ...options,
    roster: options.roster ?? ['atreides', 'harkonnen', 'guild'] });
  const actions = fixture.actions;
  let game = fixture.game;
  const take = (worm: boolean) => {
    const index = game.spiceDeck.findIndex(card => worm ? 'worm' in card : 'territory' in card);
    assert.ok(index >= 0);
    return game.spiceDeck.splice(index, 1)[0];
  };
  game.spiceDeck.unshift(take(false), ...(game.advanced ? [take(false)] : []),
    take(true), take(false), ...(game.advanced ? [take(false)] : []));
  game = advanceClassicIndependentNexus(game, state => state.turn === 2 && state.nexus &&
    !state.spiceWindow && !state.spiceResolution && classicDiscoveryNexusClean(state), actions);
  const others = game.players.filter(player => player.id !== owner);
  game = reactionAction(game, others[0].id, { type: 'alliance', target: others[1].id }, actions);
  game = reactionAction(game, others[1].id, { type: 'alliance', target: others[0].id }, actions);
  game = advanceClassicIndependentNexus(game, state => state.nexusCards?.phase?.stage === 'drawing', actions);
  const cards = game.nexusCards!.cards!, index = cards.deck.indexOf(face);
  assert.ok(index >= 0);
  cards.deck.unshift(cards.deck.splice(index, 1)[0]);
  const beforeDraw = structuredClone(game);
  game = reactionAction(game, owner, { type: 'nexusCardChoice', turn: game.turn,
    card: cards.hands[owner], choice: 'draw', ownRedraws: 0 }, actions);
  return { ...fixture, game, owner, actions, beforeDraw, afterDraw: structuredClone(game) };
}

export function createIndependentHarkonnenCall(options: { advanced?: boolean; skills?: boolean; remote?: boolean; independent?: boolean; tech?: boolean; strongholds?: boolean } = {}) {
  const counter = baseDeck().find(card => card.effect === 'karama')!.id;
  const starting = options.independent === false ? baseDeck().find(card => card.kind === 'worthless')!.id : HARASS_WITHDRAW_CARD;
  const fixture = drawClassicNexusReaction('harkonnen', 'atreides', { ...options,
    startingCards: { atreides: [starting], guild: [counter] } });
  const actions = fixture.actions;
  let game = advanceClassicIndependentNexus(fixture.game, state => state.phase === 5 &&
    state.active === 'atreides' && classicDiscoveryNexusClean(state), actions);
  const identity = reactionPlayer(game, 'atreides').leaders.find(leader =>
    reactionPlayer(game, 'harkonnen').traitors.includes(leader.id))?.id;
  assert.ok(identity, 'Use a real offered opposing Traitor, never assign one.');
  const opponent = options.remote ? 'guild' : 'harkonnen';
  const location = options.remote ? 'tueks_sietch' : 'carthag';
  const sector = territory(location).sectors[0], key = `${location}:${sector}`;
  assert.ok(!territory(location).sectors.includes(game.storm));
  const beforeShipment = structuredClone(game);
  game = reactionAction(game, 'atreides', { type: 'ship', territory: location, sector,
    amount: 1, elite: 0, allyPayment: 0 }, actions);
  game = advanceClassicIndependentNexus(game, state => state.phase === 6 && classicDiscoveryNexusClean(state), actions);
  const afterShipment = structuredClone(game);
  game = reactionAction(game, game.active!, { type: 'chooseBattle', territory: location,
    target: game.active === 'atreides' ? opponent : 'atreides' }, actions);
  for (let count = 0; count < 100; count++) {
    const next = nextClassicDiscoveryNexusStep(game);
    if (!next) break;
    if (next.action.type === 'leaderSkillVisibility') next.action.hide = true;
    game = applyClassicDiscoveryNexusStep(game, next, actions);
  }
  assert.ok(game.battle && !game.battle.revealed && classicDiscoveryNexusClean(game));
  const opponentLeader = reactionPlayer(game, opponent).leaders.filter(leader => !leader.dead && !leader.usedAt)
    .sort((one, two) => two.strength - one.strength)[0].id;
  for (const actor of [game.battle!.attacker, game.battle!.defender]) {
    game = reactionAction(game, actor, { type: 'battlePlan', dial: 0, support: 0,
      leader: actor === 'atreides' ? identity : opponentLeader,
      weapon: actor === 'atreides' && options.independent !== false ? HARASS_WITHDRAW_CARD : null, defense: null }, actions);
    while (game.response || game.phaseOpening || game.decision?.kind === 'fullPlanOffer') {
      const step = nextClassicDiscoveryNexusStep(game); assert.ok(step);
      game = applyClassicDiscoveryNexusStep(game, step, actions);
    }
  }
  assert.ok(game.battle?.revealed);
  for (const voter of viewGame(game, 'atreides').battle!.traitorVoters)
    if (voter !== 'harkonnen' && game.battle!.traitorCalls[voter] === undefined)
      game = reactionAction(game, voter, { type: 'traitorCall', call: false }, actions);
  const beforeCall = structuredClone(game);
  game = reactionAction(game, 'harkonnen', { type: 'traitorCall', call: true }, actions);
  return { ...fixture, game, beforeCall, beforeShipment, afterShipment, identity, opponent, key, counter };
}

export function createIndependentIxianPurchase(options: { advanced?: boolean; skills?: boolean; owner?: 'atreides' | 'harkonnen'; independent?: boolean; tech?: boolean; strongholds?: boolean } = {}) {
  const owner = options.owner ?? 'atreides';
  const starting = options.independent === false ? baseDeck().find(card => card.kind === 'worthless')!.id : 'ecaz-recruits';
  const fixture = drawClassicNexusReaction('ixians', owner, { ...options,
    startingCards: { [owner]: [starting] } });
  const actions = fixture.actions;
  let game = advanceClassicIndependentNexus(fixture.game, state => state.phase === 2 && classicDiscoveryNexusClean(state), actions);
  const lots = options.independent === false
    ? [baseDeck().find(card => card.kind === 'poison')!.id, baseDeck().find(card => card.kind === 'shield')!.id]
    : [REINFORCEMENTS_CARD, HARASS_WITHDRAW_CARD];
  const ordered = lots.map(id => {
    const index = game.deck.findIndex(card => card.id === id); assert.ok(index >= 0);
    return game.deck.splice(index, 1)[0];
  });
  game.deck.unshift(...ordered);
  game = advanceClassicIndependentNexus(game, state => state.phase === 3 && !!state.auction &&
    classicDiscoveryNexusClean(state), actions);
  let beforeBid: Game | undefined;
  for (let count = 0; game.decision?.kind !== 'auctionPayment' && count < 100; count++) {
    if (classicDiscoveryNexusClean(game) && game.auction?.active === owner && game.auction.bid === 0) {
      beforeBid = structuredClone(game);
      game = reactionAction(game, owner, { type: 'bid', amount: 2, allyPayment: 0 }, actions);
    } else {
      const step = nextClassicDiscoveryNexusStep(game); assert.ok(step);
      game = applyClassicDiscoveryNexusStep(game, step, actions);
    }
  }
  assert.ok(beforeBid);
  assert.equal(game.decision?.kind, 'auctionPayment');
  assert.equal(game.decision.player, owner);
  const beforePayment = structuredClone(game);
  game = reactionAction(game, owner, { type: 'decision', karama: false }, actions);
  return { ...fixture, game, beforeBid, beforePayment };
}
