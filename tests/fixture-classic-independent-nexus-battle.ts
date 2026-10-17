import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { baseDeck } from '../game/cards';
import { territory } from '../game/board';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import { HARASS_WITHDRAW_CARD } from '../game/harass-withdraw';
import { createClassicIndependentNexusFixture, advanceClassicIndependentNexus,
  type ClassicIndependentNexusStep } from './fixture-classic-independent-nexus';
import { nextClassicDiscoveryNexusStep, applyClassicDiscoveryNexusStep } from './fixture-discovery-classic-nexus';

export const independentNexusBattleClean = (game: Game) =>
  !game.phaseOpening && !game.response && !game.decision && !game.pendingTreacheryDiscard;
export const independentNexusBattlePlayer = (game: Game, actor: string) => game.players.find(player => player.id === actor)!;
export function stepIndependentNexusBattle(game: Game, actor: string, action: Action,
  actions?: ClassicIndependentNexusStep[]): Game {
  return applyClassicDiscoveryNexusStep(game, { actor, action }, actions);
}

export type ClassicIndependentNexusBattleFixture = {
  lobby: Game; setup: Game; game: Game;
  actions: ClassicIndependentNexusStep[]; staging: string[];
  beforeDraw: Game; afterDraw: Game; beforeShipment: Game; afterShipment: Game;
  owner: string; opponent: string; counter: string; key: string;
  ownerLeader: string; opponentLeader: string;
};

/** Only unopened Spice/Nexus singletons are positioned. Original starting
 * forces, private cards, alliances, wallets and clocks are never rewritten. */
export function createClassicIndependentNexusBattleFixture(advanced = true): ClassicIndependentNexusBattleFixture {
  const counter = baseDeck().find(card => card.effect === 'karama')!.id;
  const original = createClassicIndependentNexusFixture({ advanced,
    roster: ['emperor', 'harkonnen', 'guild'], startingCards: {
      emperor: [REINFORCEMENTS_CARD], harkonnen: [HARASS_WITHDRAW_CARD, counter],
    } });
  const actions = [...original.actions];
  let game = original.game;
  // Turn one is peaceful. The next unopened ordinary worm creates the actual
  // turn-two Nexus; its following land cards supply the original continuation.
  const take = (worm: boolean) => {
    const index = game.spiceDeck.findIndex(card => worm ? 'worm' in card : 'territory' in card);
    assert.ok(index >= 0);
    return game.spiceDeck.splice(index, 1)[0];
  };
  const first = [take(false), ...(advanced ? [take(false)] : []), take(true), take(false), ...(advanced ? [take(false)] : [])];
  game.spiceDeck.unshift(...first);
  game = advanceClassicIndependentNexus(game, state => state.turn === 2 && state.nexus === true && !state.spiceWindow && independentNexusBattleClean(state), actions);
  game = stepIndependentNexusBattle(game, 'harkonnen', { type: 'alliance', target: 'guild' }, actions);
  game = stepIndependentNexusBattle(game, 'guild', { type: 'alliance', target: 'harkonnen' }, actions);
  game = advanceClassicIndependentNexus(game, state => state.turn === 2 && state.nexusCards?.phase?.stage === 'drawing' && independentNexusBattleClean(state), actions);
  const cards = game.nexusCards!.cards!, index = cards.deck.indexOf('emperor');
  assert.ok(index >= 0);
  cards.deck.unshift(cards.deck.splice(index, 1)[0]);
  const beforeDraw = structuredClone(game);
  game = stepIndependentNexusBattle(game, 'emperor', { type: 'nexusCardChoice', turn: game.turn,
    card: cards.hands.emperor, choice: 'draw', ownRedraws: 0 }, actions);
  const afterDraw = structuredClone(game);
  game = advanceClassicIndependentNexus(game, state => state.phase === 5 && state.active === 'emperor' && independentNexusBattleClean(state), actions);
  const sector = territory('carthag').sectors[0];
  assert.ok(!territory('carthag').sectors.includes(game.storm));
  const beforeShipment = structuredClone(game);
  game = stepIndependentNexusBattle(game, 'emperor', { type: 'ship', territory: 'carthag', sector,
    amount: 5, elite: 0, allyPayment: 0 }, actions);
  game = advanceClassicIndependentNexus(game, state => state.phase === 6 && independentNexusBattleClean(state), actions);
  const afterShipment = structuredClone(game);
  assert.ok(game.active === 'emperor' || game.active === 'harkonnen');
  game = stepIndependentNexusBattle(game, game.active!, { type: 'chooseBattle', territory: 'carthag',
    target: game.active === 'emperor' ? 'harkonnen' : 'emperor' }, actions);
  for (let count = 0; count < 100; count++) {
    const next = nextClassicDiscoveryNexusStep(game);
    if (!next) break;
    game = applyClassicDiscoveryNexusStep(game, next, actions);
  }
  assert.ok(game.battle && !game.battle.revealed && independentNexusBattleClean(game));
  const leader = (actor: string) => independentNexusBattlePlayer(game, actor).leaders
    .filter(disc => !disc.dead && !disc.usedAt).sort((one, two) => two.strength - one.strength)[0].id;
  return { ...original, game, actions, beforeDraw, afterDraw, beforeShipment, afterShipment,
    owner: 'emperor', opponent: 'harkonnen', counter, key: `carthag:${sector}`,
    ownerLeader: leader('emperor'), opponentLeader: leader('harkonnen') };
}

export function declareIndependentNexusCunning(fixture: ClassicIndependentNexusBattleFixture, game = fixture.game) {
  const offer = viewGame(game, fixture.owner).nexusSardaukar!.offer!;
  assert.equal(offer.blocked, null);
  return stepIndependentNexusBattle(game, fixture.owner, { type: 'nexusSardaukar', event: offer.event });
}

export function revealIndependentNexusBattle(fixture: ClassicIndependentNexusBattleFixture,
  options: { cunning?: boolean; canceled?: boolean } = {}) {
  let game = structuredClone(fixture.game);
  if (options.cunning) {
    game = declareIndependentNexusCunning(fixture, game);
    if (options.canceled)
      game = stepIndependentNexusBattle(game, fixture.opponent, { type: 'card', card: fixture.counter, mode: 'cancel' });
    game = advanceClassicIndependentNexus(game, independentNexusBattleClean);
  }
  const support = game.advanced ? options.cunning && !options.canceled ? 2 : 4 : 0;
  const plans: ClassicIndependentNexusStep[] = [
    { actor: fixture.owner, action: { type: 'battlePlan', leader: fixture.ownerLeader,
      dial: 4, support, weapon: REINFORCEMENTS_CARD, defense: null } },
    { actor: fixture.opponent, action: { type: 'battlePlan', leader: fixture.opponentLeader,
      dial: 1, support: game.advanced ? 1 : 0, weapon: HARASS_WITHDRAW_CARD, defense: null } },
  ];
  for (const plan of plans) {
    game = stepIndependentNexusBattle(game, plan.actor, plan.action);
    while (game.response || game.phaseOpening || game.decision?.kind === 'fullPlanOffer') {
      const next = nextClassicDiscoveryNexusStep(game); assert.ok(next);
      game = applyClassicDiscoveryNexusStep(game, next);
    }
  }
  assert.ok(game.battle?.revealed);
  return game;
}

export function finishIndependentNexusBattle(game: Game) {
  return advanceClassicIndependentNexus(game, state => state.phase === 7 && independentNexusBattleClean(state));
}
