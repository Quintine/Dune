import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { baseDeck } from '../game/cards';
import { territory } from '../game/board';
import type { FactionId } from '../game/catalog';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { nativeShipmentSources } from '../game/homeworld-options';
import { drawClassicNexusReaction, reactionAction, reactionPlayer } from './fixture-classic-independent-nexus-reactions';
import { advanceClassicIndependentNexus, type ClassicIndependentNexusStep } from './fixture-classic-independent-nexus';
import type { ClassicNexusCoreOptions } from './fixture-classic-nexus-core';
import { classicDiscoveryNexusClean, nextClassicDiscoveryNexusStep } from './fixture-discovery-classic-nexus';

export type WorldNexusPaymentOptions = Pick<ClassicNexusCoreOptions, 'advanced' | 'skills' | 'tech' | 'strongholds'>;

/** Select only the still-undealt original singleton, then use its actual closing draw. */
function drawWorldPaymentFace(game: Game, owner: string, face: FactionId, actions: ClassicIndependentNexusStep[]) {
  assert.equal(game.nexusCards!.phase!.stage, 'drawing');
  const cards = game.nexusCards!.cards!, index = cards.deck.indexOf(face);
  assert.ok(index >= 0);
  cards.deck.unshift(cards.deck.splice(index, 1)[0]);
  return reactionAction(game, owner, { type: 'nexusCardChoice', turn: game.turn,
    card: cards.hands[owner], choice: 'draw', ownRedraws: 0 }, actions);
}

export function worldPaymentWorld(game: Game, actor: string, native: string) {
  const worlds = viewGame(game, actor).homeworlds?.worlds ?? [];
  const world = worlds.find(home => home.native === native && !home.secondary);
  assert.ok(world, `Seat ${native} must hold its actual primary World descriptor.`);
  return world;
}

/** Basic original base33 chronology by default: an actual Junction departure,
 * actual Cunning, then an actual visitor return from Giedi Prime to Junction.
 * The second route therefore needs native return permission as well as the
 * native rate; neither a scalar reserve nor an Arrakis sector is relabelled. */
export function createWorldNexusCunningPayment(options: WorldNexusPaymentOptions = {}) {
  const counter = baseDeck().find(card => card.effect === 'karama')!.id;
  const fixture = drawClassicNexusReaction('guild', 'guild', { ...options,
    independent: false, homeworlds: true, roster: ['atreides', 'harkonnen', 'guild', 'emperor'],
    startingCards: { atreides: [counter] } });
  const actions = fixture.actions;
  let game = drawWorldPaymentFace(fixture.game, 'emperor', 'harkonnen', actions);
  game = advanceClassicIndependentNexus(game, state => state.phase === 5 && state.active === 'guild' &&
    classicDiscoveryNexusClean(state), actions);
  const source = worldPaymentWorld(game, 'guild', 'guild');
  const destination = worldPaymentWorld(game, 'guild', 'harkonnen');
  const amount = 3, sources = { [source.id]: { normal: amount, elite: 0 } };
  assert.ok(source.forces.guild.normal >= amount);
  const firstQuote = homeworldShipmentChoice(viewGame(game, 'guild'), destination.id, sources, 0);
  assert.equal(firstQuote.blocked, null);
  assert.ok(firstQuote.action);
  const beforeFirst = structuredClone(game), firstAction = firstQuote.action;
  game = reactionAction(game, 'guild', firstAction, actions);
  game = advanceClassicIndependentNexus(game, state => reactionPlayer(state, 'guild').shipped &&
    !state.pendingGuildBetrayal && classicDiscoveryNexusClean(state), actions);
  const afterFirst = structuredClone(game), offer = viewGame(game, 'guild').nexusGuildCunning!.offer!;
  assert.equal(offer.blocked, null);
  game = reactionAction(game, 'guild', { type: 'endMovement', nexus: offer.event }, actions);
  game = advanceClassicIndependentNexus(game, state => state.nexusGuildCunningHistory?.at(-1)?.stage === 'secondShipment' &&
    classicDiscoveryNexusClean(state), actions);
  const beforeSecond = structuredClone(game);
  const returnSource = worldPaymentWorld(game, 'guild', 'harkonnen');
  const returnDestination = worldPaymentWorld(game, 'guild', 'guild');
  assert.equal(returnSource.forces.guild.normal, amount, 'Only the first shipment\'s actual visitors occupy Giedi Prime.');
  const returnSources = { [returnSource.id]: { normal: amount, elite: 0 } };
  const quote = homeworldShipmentChoice(viewGame(game, 'guild'), returnDestination.id, returnSources, 0);
  assert.equal(quote.blocked, null);
  assert.ok(quote.action);
  return { ...fixture, game: beforeSecond, beforeFirst, afterFirst, beforeSecond, actions, counter, amount,
    source: source.id, destination: destination.id, sources, firstAction, firstQuote,
    returnSources, quote, action: quote.action, actor: 'guild', holder: 'emperor' };
}

/** Actual normal/Richese shipment: Caladan's selected native counters enter
 * Carthag, while Emperor holds the distinct original Guild singleton. Advanced
 * all14/Tech/Strongholds is the default second chronology, not a copied scene. */
export function createWorldNexusBorrowedPayment(options: WorldNexusPaymentOptions & { discounted?: boolean } = {}) {
  const discounted = options.discounted ?? true;
  const fixture = drawClassicNexusReaction(discounted ? 'richese' : 'harkonnen', 'atreides', {
    advanced: true, skills: true, tech: true, strongholds: true, ...options,
    independent: false, homeworlds: true, roster: ['atreides', 'guild', 'harkonnen', 'emperor'],
    training: options.skills === false ? undefined
      : { atreides: 'diplomat', guild: 'mentat', harkonnen: 'warmaster', emperor: 'sandmaster' },
  });
  const actions = fixture.actions;
  let game = drawWorldPaymentFace(fixture.game, 'emperor', 'guild', actions);
  game = advanceClassicIndependentNexus(game, state => state.phase === 5 && state.active === 'atreides' &&
    classicDiscoveryNexusClean(state), actions);
  const amount = 5, place = territory('carthag');
  assert.ok(!place.sectors.includes(game.storm));
  const native = worldPaymentWorld(game, 'atreides', 'atreides');
  const sources = nativeShipmentSources(viewGame(game, 'atreides'), amount, 0);
  assert.ok(sources);
  assert.deepEqual(sources[native.id], { normal: amount, elite: 0 });
  const action: Action = { type: 'ship', territory: place.id, sector: place.sectors[0],
    amount, elite: 0, allyPayment: 0, homeworldSources: sources };
  if (discounted) {
    const offer = viewGame(game, 'atreides').nexusRichese!;
    assert.equal(offer.blocked, null);
    action.nexus = offer.event;
  }
  return { ...fixture, game, beforeShipment: structuredClone(game), actions, action, amount,
    sources, source: native.id, key: `${place.id}:${place.sectors[0]}`, actor: 'atreides',
    holder: 'emperor', discounted };
}

/** The original native gates between a World declaration and its fee: each
 * recorded kind is a real live window stepped by the shared controller, never
 * a synthetic phase label. Stops before the owner fee acknowledgement. */
export function worldNexusPaymentGates(game: Game, actor: string, action: Action,
  actions?: ClassicIndependentNexusStep[]) {
  const kinds: string[] = [];
  game = reactionAction(game, actor, action, actions);
  for (let count = 0; !game.pendingGuildBetrayal && count < 40; count++) {
    kinds.push(game.response?.kind ?? game.decision?.kind ?? `${game.phase}/${game.active}`);
    const step = nextClassicDiscoveryNexusStep(game);
    assert.ok(step, 'The original controller must own every native gate or arrival choice.');
    game = reactionAction(game, step.actor, step.action, actions);
  }
  assert.ok(game.pendingGuildBetrayal, 'The original declaration must reach its Guild fee gate.');
  return { game, kinds };
}
