import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import type { FactionId } from '../game/catalog';
import { treacheryDeck } from '../game/cards';
import { tleilaxuSecretAllyOptions } from '../game/nexus-tleilaxu-revival';
import { createClassicIndependentNexusFixture, advanceClassicIndependentNexus, type ClassicIndependentNexusStep } from './fixture-classic-independent-nexus';
import { applyClassicDiscoveryNexusStep, classicDiscoveryNexusClean, nextClassicDiscoveryNexusStep } from './fixture-discovery-classic-nexus';

export const utilityPlayer = (game: Game, id = 'atreides') => {
  const player = game.players.find(seat => seat.id === id);
  assert.ok(player);
  return player;
};
export function utilityAction(game: Game, actor: string, action: Action, actions?: ClassicIndependentNexusStep[]) {
  return applyClassicDiscoveryNexusStep(game, { actor, action }, actions);
}

/** Reorder only the unopened physical Spice and Nexus singletons. Every hand,
 * death, wallet, alliance and phase below is produced by an original action. */
function drawUtilityNexus(game: Game, face: FactionId, actions: ClassicIndependentNexusStep[]) {
  const worm = game.spiceDeck.findIndex(card => 'worm' in card && !card.greatMaker && !card.suppressed && !card.thumper);
  assert.ok(worm >= 0);
  game.spiceDeck.unshift(game.spiceDeck.splice(worm, 1)[0]);
  game = advanceClassicIndependentNexus(game, state => state.nexus && !state.spiceWindow &&
    !state.spiceResolution && classicDiscoveryNexusClean(state), actions);
  const others = game.players.filter(seat => seat.id !== 'atreides');
  game = utilityAction(game, others[0].id, { type: 'alliance', target: others[1].id }, actions);
  game = utilityAction(game, others[1].id, { type: 'alliance', target: others[0].id }, actions);
  game = advanceClassicIndependentNexus(game, state => state.nexusCards?.phase?.stage === 'drawing', actions);
  const cards = game.nexusCards!.cards!;
  const index = cards.deck.indexOf(face);
  assert.ok(index >= 0);
  cards.deck.unshift(cards.deck.splice(index, 1)[0]);
  const beforeDraw = structuredClone(game);
  game = utilityAction(game, 'atreides', { type: 'nexusCardChoice', turn: game.turn,
    card: cards.hands.atreides, choice: 'draw', ownRedraws: 0 }, actions);
  return { game, beforeDraw, afterDraw: structuredClone(game) };
}

export function createIndependentNexusRecruitsRevival() {
  const weapon = treacheryDeck([]).find(card => card.kind === 'projectile')!;
  const guildCard = treacheryDeck([]).find(card => card.kind === 'worthless')!;
  const fixture = createClassicIndependentNexusFixture({ startingCards: {
    atreides: ['ecaz-recruits'], guild: [guildCard.id], emperor: [weapon.id],
  } });
  const actions = fixture.actions;
  let game = advanceClassicIndependentNexus(fixture.game, state => state.phase === 5 &&
    state.active === 'emperor' && classicDiscoveryNexusClean(state), actions);
  game = utilityAction(game, 'emperor', { type: 'ship', territory: 'arrakeen', sector: 10,
    amount: 1, elite: 0, allyPayment: 0 }, actions);
  game = advanceClassicIndependentNexus(game, state => state.phase === 6 && classicDiscoveryNexusClean(state), actions);
  if (!game.battle) game = utilityAction(game, game.active!, { type: 'chooseBattle', territory: 'arrakeen',
    target: game.active === 'atreides' ? 'emperor' : 'atreides' }, actions);
  game = advanceClassicIndependentNexus(game, state => !!state.battle && !state.battle.revealed &&
    classicDiscoveryNexusClean(state) && !nextClassicDiscoveryNexusStep(state), actions);
  const leader = utilityPlayer(game).leaders.filter(disc => !disc.dead).sort((a, b) => a.strength - b.strength)[0].id;
  const opponentLeader = utilityPlayer(game, 'emperor').leaders.filter(disc => !disc.dead).sort((a, b) => a.strength - b.strength)[0].id;
  game = utilityAction(game, 'atreides', { type: 'battlePlan', dial: 8, support: 0,
    leader, weapon: null, defense: null }, actions);
  game = utilityAction(game, 'emperor', { type: 'battlePlan', dial: 0, support: 0,
    leader: opponentLeader, weapon: weapon.id, defense: null }, actions);
  game = advanceClassicIndependentNexus(game, state => state.turn === 2 && state.phase === 1 &&
    classicDiscoveryNexusClean(state) && !state.spiceSequence && !state.spiceResolution && !state.spiceWindow && !state.nexus && !state.ready.length, actions);
  const afterBattle = structuredClone(game);
  const drawn = drawUtilityNexus(game, 'tleilaxu', actions);
  game = advanceClassicIndependentNexus(drawn.game, state => state.phase === 4 && classicDiscoveryNexusClean(state), actions);
  const offer = tleilaxuSecretAllyOptions(game, utilityPlayer(game));
  const action: Action = { type: 'nexusTleilaxuRevival', event: offer.event, leader, amount: 5, elite: 0 };
  return { ...fixture, ...drawn, game, afterBattle, leader, action, actions };
}

/** Separate Emperor-absent table: the independent face stays in the unused
 * original deck until the native auction reserves and delivers that one card. */
export function createIndependentNexusBankPurchase() {
  const fixture = createClassicIndependentNexusFixture({ roster: ['atreides', 'guild', 'harkonnen'] });
  const actions = fixture.actions;
  let game = advanceClassicIndependentNexus(fixture.game, state => state.turn === 2 && state.phase === 1 &&
    classicDiscoveryNexusClean(state) && !state.spiceSequence && !state.spiceResolution && !state.spiceWindow && !state.nexus && !state.ready.length, actions);
  const drawn = drawUtilityNexus(game, 'emperor', actions);
  game = advanceClassicIndependentNexus(drawn.game, state => state.phase === 2 && classicDiscoveryNexusClean(state), actions);
  const index = game.deck.findIndex(card => card.id === 'ecaz-reinforcements');
  assert.ok(index >= 0);
  game.deck.unshift(game.deck.splice(index, 1)[0]);
  game = advanceClassicIndependentNexus(game, state => state.phase === 3 && !!state.auction && classicDiscoveryNexusClean(state), actions);
  let beforeBid: Game | undefined;
  for (let count = 0; game.decision?.kind !== 'auctionPayment' && count < 100; count++) {
    if (classicDiscoveryNexusClean(game) && game.auction?.active === 'atreides' && game.auction.bid === 0) {
      beforeBid = structuredClone(game);
      game = utilityAction(game, 'atreides', { type: 'bid', amount: 2 }, actions);
    }
    else {
      const step = nextClassicDiscoveryNexusStep(game); assert.ok(step);
      game = applyClassicDiscoveryNexusStep(game, step, actions);
    }
  }
  assert.equal(game.decision?.kind, 'auctionPayment');
  assert.equal(game.decision.player, 'atreides');
  const offer = viewGame(game, 'atreides').nexusEmperorSecretAlly!;
  const action: Action = { type: 'nexusEmperorPurchase', event: offer.event };
  assert.ok(beforeBid);
  return { ...fixture, ...drawn, game, beforeBid, action, actions };
}
