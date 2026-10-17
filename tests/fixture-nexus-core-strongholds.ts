import assert from 'node:assert/strict';
import { viewGame, type Game } from '../game/engine';
import { baseDeck } from '../game/cards';
import { territory } from '../game/board';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import { createClassicIndependentNexusFixture, advanceClassicIndependentNexus,
  type ClassicIndependentNexusStep } from './fixture-classic-independent-nexus';
import { drawClassicNexusReaction, reactionAction, reactionPlayer } from './fixture-classic-independent-nexus-reactions';
import { classicDiscoveryNexusClean as clean, nextClassicDiscoveryNexusStep,
  applyClassicDiscoveryNexusStep } from './fixture-discovery-classic-nexus';

export { reactionPlayer as nexusCoreStrongholdPlayer };
export type NexusCoreStrongholdOptions = { independent?: boolean; skills?: boolean };
export type NexusCoreStrongholdFixture = {
  game: Game; setup: Game; actions: ClassicIndependentNexusStep[]; staging: string[];
  claimed: Game; beforeShipment: Game; afterShipment: Game;
  owner: string; opponent: string; key: string; ownerLeader: string; opponentLeader: string;
  weapon: string | null; defense: string | null;
};

function prepare(game: Game, actions: ClassicIndependentNexusStep[]): Game {
  for (let count = 0; count < 120; count++) {
    const next = nextClassicDiscoveryNexusStep(game);
    if (!next) {
      assert.ok(game.battle && !game.battle.revealed && clean(game));
      return game;
    }
    // The original decision must put the trained disc behind the shield
    // before it can be selected in a sealed plan.
    if (next.action.type === 'leaderSkillVisibility') next.action.hide = true;
    game = applyClassicDiscoveryNexusStep(game, next, actions);
  }
  throw Error('Original Stronghold battle did not reach its sealed-plan boundary');
}
function bestLeader(game: Game, actor: string): string {
  const leader = reactionPlayer(game, actor).leaders.filter(disc => !disc.dead && !disc.usedAt)
    .sort((one, two) => two.strength - one.strength)[0];
  assert.ok(leader);
  return leader.id;
}
function chooseBattle(game: Game, location: string, actions: ClassicIndependentNexusStep[]): Game {
  return prepare(reactionAction(game, game.active!, { type: 'chooseBattle', territory: location,
    target: game.active === 'emperor' ? 'harkonnen' : 'emperor' }, actions), actions);
}

/** Emperor genuinely ships five original reserves into empty Arrakeen on turn
 * one. Only unopened Spice/Nexus decks are ordered; every counter, payment,
 * alliance and first end-Mentat card claim comes from original actions. */
export function createNexusCoreArrakeenFixture(options: NexusCoreStrongholdOptions = {}): NexusCoreStrongholdFixture {
  const independent = options.independent ?? true;
  const original = createClassicIndependentNexusFixture({ advanced: true, independent,
    skills: options.skills, strongholds: true, roster: ['emperor', 'harkonnen', 'guild'],
    startingCards: independent ? { emperor: [REINFORCEMENTS_CARD] } : undefined });
  const actions = original.actions;
  let game = original.game;
  const take = (worm: boolean) => {
    const index = game.spiceDeck.findIndex(card => worm ? 'worm' in card : 'territory' in card);
    assert.ok(index >= 0);
    return game.spiceDeck.splice(index, 1)[0];
  };
  game.spiceDeck.unshift(take(false), take(false), take(true), take(false), take(false));
  game = advanceClassicIndependentNexus(game, state => state.turn === 1 && state.phase === 5 &&
    state.active === 'emperor' && clean(state), actions);
  const sector = territory('arrakeen').sectors[0], key = `arrakeen:${sector}`;
  assert.ok(!territory('arrakeen').sectors.includes(game.storm));
  game = reactionAction(game, 'emperor', { type: 'ship', territory: 'arrakeen', sector,
    amount: 5, elite: 0, allyPayment: 0 }, actions);
  game = advanceClassicIndependentNexus(game, state => state.strongholdCards?.claimedTurn === 1, actions);
  const claimed = structuredClone(game);
  assert.equal(claimed.strongholdCards!.owners.arrakeen, 'emperor');
  game = advanceClassicIndependentNexus(game, state => state.turn === 2 && state.nexus &&
    !state.spiceWindow && !state.spiceResolution && clean(state), actions);
  game = reactionAction(game, 'harkonnen', { type: 'alliance', target: 'guild' }, actions);
  game = reactionAction(game, 'guild', { type: 'alliance', target: 'harkonnen' }, actions);
  game = advanceClassicIndependentNexus(game, state => state.nexusCards?.phase?.stage === 'drawing' && clean(state), actions);
  const cards = game.nexusCards!.cards!, index = cards.deck.indexOf('emperor');
  assert.ok(index >= 0);
  cards.deck.unshift(cards.deck.splice(index, 1)[0]);
  game = reactionAction(game, 'emperor', { type: 'nexusCardChoice', turn: game.turn,
    card: cards.hands.emperor, choice: 'draw', ownRedraws: 0 }, actions);
  game = advanceClassicIndependentNexus(game, state => state.phase === 5 && state.active === 'harkonnen' && clean(state), actions);
  assert.ok(!territory('arrakeen').sectors.includes(game.storm));
  const beforeShipment = structuredClone(game);
  game = reactionAction(game, 'harkonnen', { type: 'ship', territory: 'arrakeen', sector,
    amount: 5, elite: 0, allyPayment: 0 }, actions);
  game = advanceClassicIndependentNexus(game, state => state.phase === 6 && clean(state), actions);
  const afterShipment = structuredClone(game);
  game = chooseBattle(game, 'arrakeen', actions);
  return { ...original, game, actions, claimed, beforeShipment, afterShipment,
    owner: 'emperor', opponent: 'harkonnen', key, ownerLeader: bestLeader(game, 'emperor'),
    opponentLeader: bestLeader(game, 'harkonnen'), weapon: independent ? REINFORCEMENTS_CARD : null,
    defense: null };
}

/** Harkonnen retains its genuinely earned Carthag card. Atreides draws the
 * physical Harkonnen Nexus, ships one counter and plays an actually offered
 * Harkonnen Traitor. Optional all14 uses the original trained-disc choice. */
export function createNexusCoreCarthagFixture(options: NexusCoreStrongholdOptions = {}): NexusCoreStrongholdFixture {
  const poison = baseDeck().find(card => card.kind === 'poison')!.id;
  const shield = baseDeck().find(card => card.kind === 'shield')!.id;
  const original = drawClassicNexusReaction('harkonnen', 'atreides', { advanced: true,
    independent: options.independent ?? true, skills: options.skills, strongholds: true,
    training: options.skills ? { harkonnen: 'prana-bindu-adept' } : undefined,
    startingCards: { atreides: [poison], harkonnen: [shield] } });
  const actions = original.actions;
  const claimed = structuredClone(original.beforeDraw);
  assert.equal(claimed.strongholdCards!.owners.carthag, 'harkonnen');
  let game = advanceClassicIndependentNexus(original.game, state => state.phase === 5 &&
    state.active === 'atreides' && clean(state), actions);
  const opponentLeader = reactionPlayer(game, 'atreides').leaders.find(leader =>
    reactionPlayer(game, 'harkonnen').traitors.includes(leader.id))?.id;
  assert.ok(opponentLeader, 'Use the actual offered Traitor, never assign a leader identity');
  const sector = territory('carthag').sectors[0], key = `carthag:${sector}`;
  assert.ok(!territory('carthag').sectors.includes(game.storm));
  const beforeShipment = structuredClone(game);
  game = reactionAction(game, 'atreides', { type: 'ship', territory: 'carthag', sector,
    amount: 1, elite: 0, allyPayment: 0 }, actions);
  game = advanceClassicIndependentNexus(game, state => state.phase === 6 && clean(state), actions);
  const afterShipment = structuredClone(game);
  game = reactionAction(game, game.active!, { type: 'chooseBattle', territory: 'carthag',
    target: game.active === 'atreides' ? 'harkonnen' : 'atreides' }, actions);
  game = prepare(game, actions);
  const trained = game.leaderSkills?.assignments.find(assignment => assignment.owner === 'harkonnen');
  return { ...original, game, claimed, beforeShipment, afterShipment, owner: 'harkonnen',
    opponent: 'atreides', key, ownerLeader: trained?.leader ?? bestLeader(game, 'harkonnen'),
    opponentLeader, weapon: poison, defense: shield };
}

/** Return the revealed original battle, before any Traitor vote or cleanup. */
export function revealNexusCoreStrongholdBattle(fixture: NexusCoreStrongholdFixture,
  options: { cunning?: boolean; shield?: boolean; ownerDial?: number; opponentDial?: number } = {}): Game {
  let game = structuredClone(fixture.game);
  const arrakeen = fixture.key.startsWith('arrakeen:');
  if (arrakeen && options.cunning !== false) {
    const offer = viewGame(game, fixture.owner).nexusSardaukar!.offer!;
    assert.equal(offer.blocked, null);
    game = reactionAction(game, fixture.owner, { type: 'nexusSardaukar', event: offer.event });
    game = advanceClassicIndependentNexus(game, clean);
  }
  const ownerDial = options.ownerDial ?? (arrakeen ? 6 : 0.5);
  const opponentDial = options.opponentDial ?? (arrakeen ? 1 : 0);
  for (const actor of [game.battle!.attacker, game.battle!.defender]) {
    const owner = actor === fixture.owner;
    game = reactionAction(game, actor, { type: 'battlePlan',
      dial: owner ? ownerDial : opponentDial,
      support: owner ? arrakeen ? options.cunning === false ? ownerDial : ownerDial / 2 : 0 : opponentDial,
      leader: owner ? fixture.ownerLeader : fixture.opponentLeader,
      weapon: arrakeen ? owner ? fixture.weapon : null : owner ? null : fixture.weapon,
      defense: !arrakeen && owner && options.shield !== false ? fixture.defense : null });
    while (game.response || game.phaseOpening || game.decision?.kind === 'fullPlanOffer') {
      const next = nextClassicDiscoveryNexusStep(game); assert.ok(next);
      game = applyClassicDiscoveryNexusStep(game, next);
    }
  }
  assert.ok(game.battle?.revealed);
  return game;
}

/** Original votes and native cleanup; no plan or strategy is invented. */
export function finishNexusCoreStrongholdBattle(game: Game, stopAtCleanup = false): Game {
  return advanceClassicIndependentNexus(game, state => (!state.battle && clean(state)) ||
    (stopAtCleanup && state.decision?.kind === 'battleCards'));
}

/** Preserve the original native Harkonnen call and pending cancellation window. */
export function callNexusCoreCarthagTraitor(game: Game): Game {
  for (const voter of viewGame(game, 'atreides').battle!.traitorVoters)
    if (voter !== 'harkonnen' && game.battle!.traitorCalls[voter] === undefined)
      game = reactionAction(game, voter, { type: 'traitorCall', call: false });
  return reactionAction(game, 'harkonnen', { type: 'traitorCall', call: true });
}
