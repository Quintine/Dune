import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { TERRITORIES, territory } from '../game/board';
import { baseDeck } from '../game/cards';
import type { FactionId } from '../game/catalog';
import { drawClassicNexusReaction, reactionAction, reactionPlayer } from './fixture-classic-independent-nexus-reactions';
import { advanceClassicIndependentNexus, type ClassicIndependentNexusOptions, type ClassicIndependentNexusStep } from './fixture-classic-independent-nexus';
import { classicDiscoveryNexusClean } from './fixture-discovery-classic-nexus';

export type ClassicNexusCoreOptions = Pick<ClassicIndependentNexusOptions, 'advanced' | 'skills' | 'independent' | 'training'>;
function drawSecondFace(game: Game, owner: string, face: FactionId, actions: ClassicIndependentNexusStep[]) {
  assert.equal(game.nexusCards!.phase!.stage, 'drawing');
  const cards = game.nexusCards!.cards!, index = cards.deck.indexOf(face);
  assert.ok(index >= 0);
  cards.deck.unshift(cards.deck.splice(index, 1)[0]);
  return reactionAction(game, owner, { type: 'nexusCardChoice', turn: game.turn,
    card: cards.hands[owner], choice: 'draw', ownRedraws: 0 }, actions);
}

/** Two distinct original cards: A holds Richese (or an irrelevant Harkonnen),
 * Emperor holds Guild, and actual Guild/Harkonnen are allied. */
export function createClassicNexusGuildPayment(options: ClassicNexusCoreOptions & { discounted?: boolean } = {}) {
  const discounted = options.discounted ?? true;
  const fixture = drawClassicNexusReaction(discounted ? 'richese' : 'harkonnen', 'atreides', {
    ...options, independent: options.independent ?? false,
    roster: ['atreides', 'guild', 'harkonnen', 'emperor'],
    training: options.training ?? (options.skills ? { atreides: 'bureaucrat' } : undefined),
  });
  const actions = fixture.actions;
  let game = drawSecondFace(fixture.game, 'emperor', 'guild', actions);
  const afterDraws = structuredClone(game);
  game = advanceClassicIndependentNexus(game, state => state.phase === 5 && state.active === 'atreides' &&
    classicDiscoveryNexusClean(state), actions);
  const beforeShipment = structuredClone(game), place = territory('carthag');
  assert.ok(!place.sectors.includes(game.storm));
  const amount = 5;
  const action: Action = { type: 'ship', territory: place.id, sector: place.sectors[0],
    amount, elite: 0, allyPayment: 0 };
  if (discounted) {
    const offer = viewGame(game, 'atreides').nexusRichese!;
    assert.equal(offer.blocked, null);
    action.nexus = offer.event;
  }
  game = reactionAction(game, 'atreides', action, actions);
  game = advanceClassicIndependentNexus(game, state => !!state.pendingGuildBetrayal &&
    classicDiscoveryNexusClean(state), actions);
  return { ...fixture, game, afterDraws, beforeShipment, actions, action, amount,
    key: `${place.id}:${place.sectors[0]}`, holder: 'emperor' };
}

/** A/H form the real alliance; native Guild and Emperor draw distinct faces.
 * The latter holds Harkonnen, never a second copy of Guild's singleton. */
export function createClassicNexusCunning(options: ClassicNexusCoreOptions = {}) {
  const counter = baseDeck().find(card => card.effect === 'karama')!.id;
  const fixture = drawClassicNexusReaction('guild', 'guild', { ...options,
    independent: options.independent ?? false, roster: ['atreides', 'harkonnen', 'guild', 'emperor'],
    startingCards: { atreides: [counter] },
  });
  const actions = fixture.actions;
  let game = drawSecondFace(fixture.game, 'emperor', 'harkonnen', actions);
  game = advanceClassicIndependentNexus(game, state => state.phase === 5 && state.active === 'guild' &&
    classicDiscoveryNexusClean(state), actions);
  const empty = TERRITORIES.filter(place => place.type === 'stronghold' &&
    !place.sectors.includes(game.storm) && game.players.every(player =>
      Object.keys(player.forces).every(key => !key.startsWith(`${place.id}:`))));
  assert.ok(empty.length >= 2);
  const first = empty[0], second = empty[1], origin = `${first.id}:${first.sectors[0]}`;
  const beforeFirst = structuredClone(game);
  game = reactionAction(game, 'guild', { type: 'ship', territory: first.id, sector: first.sectors[0],
    amount: 1, elite: 0, allyPayment: 0 }, actions);
  game = advanceClassicIndependentNexus(game, state => reactionPlayer(state, 'guild').shipped &&
    !state.pendingGuildBetrayal && classicDiscoveryNexusClean(state), actions);
  const beforeCunning = structuredClone(game), offer = viewGame(game, 'guild').nexusGuildCunning!.offer!;
  assert.equal(offer.blocked, null);
  game = reactionAction(game, 'guild', { type: 'endMovement', nexus: offer.event }, actions);
  return { ...fixture, game, beforeFirst, beforeCunning, actions, counter, origin,
    second: second.id, secondSector: second.sectors[0] };
}

export function submitClassicNexusSecondShipment(fixture: ReturnType<typeof createClassicNexusCunning>,
  kind: 'reserve' | 'cross' | 'return') {
  let game = advanceClassicIndependentNexus(fixture.game, state =>
    state.nexusGuildCunningHistory?.at(-1)?.stage === 'secondShipment' && classicDiscoveryNexusClean(state), fixture.actions);
  const beforeSecond = structuredClone(game);
  const action: Action = kind === 'reserve'
    ? { type: 'ship', territory: fixture.second, sector: fixture.secondSector, amount: 1, elite: 0, allyPayment: 0 }
    : { type: 'guildShip', from: fixture.origin,
      territory: kind === 'return' ? 'reserves' : fixture.second,
      ...(kind === 'return' ? {} : { sector: fixture.secondSector }), amount: 1, elite: 0, allyPayment: 0 };
  game = reactionAction(game, 'guild', action, fixture.actions);
  game = advanceClassicIndependentNexus(game, state => !!state.pendingGuildBetrayal &&
    classicDiscoveryNexusClean(state), fixture.actions);
  return { ...fixture, game, beforeSecond, action, kind };
}
