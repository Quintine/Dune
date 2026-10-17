import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { TERRITORIES } from '../game/board';
import { treacheryDeck } from '../game/cards';
import { ownedTech, type TechId } from '../game/tech-tokens';
import { createClassicNexusGuildPayment, type ClassicNexusCoreOptions } from './fixture-classic-nexus-core';
import { createIndependentHarkonnenCall, reactionAction, reactionPlayer } from './fixture-classic-independent-nexus-reactions';
import { advanceClassicIndependentNexus, createClassicIndependentNexusFixture,
  type ClassicIndependentNexusStep } from './fixture-classic-independent-nexus';
import { classicDiscoveryNexusClean, nextClassicDiscoveryNexusStep } from './fixture-discovery-classic-nexus';

/** Read the actual first-Storm custody; never select or retrofit a token owner. */
export function nexusCoreTechHolding(game: Game, token: TechId) {
  const owner = game.techTokens?.[token].owner;
  assert.ok(owner, 'The original first Storm must assign this physical token');
  return { owner, count: ownedTech(game.techTokens, owner).length };
}

/** A real five-counter Richese order, stopped before its funded Guild invoice. */
export function createNexusCoreTechShipment(options: ClassicNexusCoreOptions = {}) {
  const fixture = createClassicNexusGuildPayment({ independent: true, ...options, tech: true });
  return { ...fixture, token: nexusCoreTechHolding(fixture.game, 'heighliners') };
}

/** Original Harass plan and native Harkonnen declaration, before Nexus Use/Pass.
 * The reused producer forwards these original module options into its lobby. */
export function createNexusCoreTechHarass() {
  const options = { tech: true, independent: true };
  return createIndependentHarkonnenCall(options);
}

/** Actual battle losses supply eight Tanks and one own dead leader. Recruits
 * stays in its original starting hand, and a real closing draw supplies Tleilaxu.
 * Only unopened original Spice/Nexus singletons are positioned. With `drain`,
 * a genuine turn-one four-counter desert shipment spends eight of Atreides'
 * own spice so later Revival prices face a genuinely thin wallet. */
export function createNexusCoreTechRevival(options: Pick<ClassicNexusCoreOptions,
  'advanced' | 'skills' | 'training'> & { drain?: boolean } = {}) {
  const weapon = treacheryDeck([]).find(card => card.kind === 'projectile')!;
  const harmless = treacheryDeck([]).find(card => card.kind === 'worthless')!;
  const { drain, ...modules } = options;
  const fixture = createClassicIndependentNexusFixture({ advanced: true, skills: true, ...modules,
    independent: true, tech: true,
    training: options.training ?? { atreides: 'diplomat', guild: 'mentat', emperor: 'sandmaster' },
    startingCards: { atreides: ['ecaz-recruits'], guild: [harmless.id], emperor: [weapon.id] } });
  const actions = fixture.actions;
  let game = fixture.game;
  const take = (worm: boolean) => {
    const index = game.spiceDeck.findIndex(card => worm
      ? 'worm' in card && !card.greatMaker && !card.suppressed && !card.thumper
      : 'territory' in card);
    assert.ok(index >= 0);
    return game.spiceDeck.splice(index, 1)[0];
  };
  game.spiceDeck.unshift(take(false), ...(game.advanced ? [take(false)] : []),
    take(true), take(false), ...(game.advanced ? [take(false)] : []));
  if (drain) {
    game = advanceClassicIndependentNexus(game, state => state.turn === 1 &&
      state.phase === 5 && state.active === 'atreides' && classicDiscoveryNexusClean(state), actions);
    const desert = TERRITORIES.find(place => place.type !== 'stronghold' &&
      !place.sectors.includes(game.storm) && game.players.every(player =>
        Object.keys(player.forces).every(key => !key.startsWith(`${place.id}:`))))!;
    assert.ok(desert);
    const wallet = reactionPlayer(game, 'atreides').spice;
    assert.ok(wallet >= 8, 'The genuine drain shipment needs its real turn-one wallet');
    game = reactionAction(game, 'atreides', { type: 'ship', territory: desert.id,
      sector: desert.sectors[0], amount: 4, elite: 0, allyPayment: 0 }, actions);
    game = advanceClassicIndependentNexus(game, state => state.turn === 1 && state.phase === 5 &&
      state.active !== 'atreides' && classicDiscoveryNexusClean(state), actions);
    assert.equal(reactionPlayer(game, 'atreides').spice, wallet - 8);
  }
  game = advanceClassicIndependentNexus(game, state => state.phase === 5 &&
    state.active === 'emperor' && classicDiscoveryNexusClean(state), actions);
  const beforeShipment = structuredClone(game);
  game = reactionAction(game, 'emperor', { type: 'ship', territory: 'arrakeen', sector: 10,
    amount: 1, elite: 0, allyPayment: 0 }, actions);
  game = advanceClassicIndependentNexus(game, state => state.phase === 6 && classicDiscoveryNexusClean(state), actions);
  if (!game.battle) game = reactionAction(game, game.active!, { type: 'chooseBattle', territory: 'arrakeen',
    target: game.active === 'atreides' ? 'emperor' : 'atreides' }, actions);
  game = advanceClassicIndependentNexus(game, state => !!state.battle && !state.battle.revealed &&
    classicDiscoveryNexusClean(state) && !nextClassicDiscoveryNexusStep(state), actions);
  const leader = reactionPlayer(game, 'atreides').leaders.filter(disc => !disc.dead)
    .sort((a, b) => a.strength - b.strength)[0].id;
  const opponentLeader = reactionPlayer(game, 'emperor').leaders.filter(disc => !disc.dead)
    .sort((a, b) => a.strength - b.strength)[0].id;
  game = reactionAction(game, 'atreides', { type: 'battlePlan', dial: game.advanced ? 4 : 8, support: 0,
    leader, weapon: null, defense: null }, actions);
  game = reactionAction(game, 'emperor', { type: 'battlePlan', dial: 0, support: 0,
    leader: opponentLeader, weapon: weapon.id, defense: null }, actions);
  game = advanceClassicIndependentNexus(game, state => state.turn === 2 && state.nexus &&
    !state.spiceWindow && !state.spiceResolution && classicDiscoveryNexusClean(state), actions);
  const afterBattle = structuredClone(game);
  game = reactionAction(game, 'guild', { type: 'alliance', target: 'emperor' }, actions);
  game = reactionAction(game, 'emperor', { type: 'alliance', target: 'guild' }, actions);
  game = advanceClassicIndependentNexus(game, state => state.nexusCards?.phase?.stage === 'drawing', actions);
  const cards = game.nexusCards!.cards!, index = cards.deck.indexOf('tleilaxu');
  assert.ok(index >= 0);
  cards.deck.unshift(cards.deck.splice(index, 1)[0]);
  const beforeDraw = structuredClone(game);
  game = reactionAction(game, 'atreides', { type: 'nexusCardChoice', turn: game.turn,
    card: cards.hands.atreides, choice: 'draw', ownRedraws: 0 }, actions);
  const afterDraw = structuredClone(game);
  game = advanceClassicIndependentNexus(game, state => state.phase === 4 && classicDiscoveryNexusClean(state), actions);
  const offer = viewGame(game, 'atreides').nexusTleilaxu!.secretAlly!;
  assert.equal(offer.blocked, null);
  const action: Action = { type: 'nexusTleilaxuRevival', event: offer.event, leader, amount: 5, elite: 0 };
  return { ...fixture, game, actions, beforeShipment, afterBattle, beforeDraw, afterDraw,
    leader, action,
    token: nexusCoreTechHolding(game, 'axlotl') };
}

/** Retain the exact native phase-ending action and its pre-payout wallets. */
export function finishNexusCoreTechPhase(state: Game, actions: ClassicIndependentNexusStep[] = []) {
  let game = state;
  const phase = game.phase;
  for (let count = 0; count < 300; count++) {
    const before = structuredClone(game), step = nextClassicDiscoveryNexusStep(game);
    assert.ok(step, 'Finish the real pending control before leaving this phase');
    game = reactionAction(game, step.actor, step.action, actions);
    if (game.phase !== phase) return { before, after: game, step, actions };
  }
  throw new Error('The native phase did not finish');
}
