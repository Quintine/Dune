import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeSemutaGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game, type Player,
} from '../game/engine';
import type { Card } from '../game/cards';
import { validateNexusCards } from '../game/nexus-cards';
import { nexusChoamBetrayalAction } from '../game/nexus-choam-betrayal-options';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { nextRicheseSkillsTechNativeStep } from './fixture-richese-skills-tech';

export type SemutaNexusBetrayalStep = { actor: string; action: Action };
export type SemutaNexusBetrayalOptions = {
  initial?: Game;
  advanced?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  skills?: boolean;
  fullHand?: boolean;
};
export type SemutaNexusBetrayalFixture = {
  game: Game;
  initial: Game;
  setup: Game;
  drawBefore: Game;
  drawAfter: Game;
  actions: SemutaNexusBetrayalStep[];
  staging: string[];
  owner: string;
  target: string;
  spender: string;
  observer: string;
  semuta: string;
  targetCards: Card[];
  cards: string[];
  action: Action;
};
export function semutaNexusBetrayalPlayer(game: Game, id: string): Player {
  const player = game.players.find(p => p.id === id);
  assert.ok(player, `Missing original ${id} seat`);
  return player;
}
export function semutaNexusBetrayalInventory(game: Game): string[] {
  const cards = [...game.deck, ...game.discard, ...(game.richeseCache ?? []),
    ...(game.richeseRemoved ?? []), ...game.players.flatMap(p => p.hand)].map(c => c.id).sort();
  assert.equal(new Set(cards).size, cards.length, 'Original Treachery Cards retain one physical slot');
  validateNexusCards(game.nexusCards!.cards!, game.players);
  return cards;
}
/** The existing no-spend native policy, with actual optional training and neutral
 * Semuta acknowledgements. No Nexus card is played while reaching the draw. */
export function nextSemutaNexusBetrayalStep(game: Game): SemutaNexusBetrayalStep {
  const pending = game.pendingTreacheryDiscard;
  const reaction = pending?.reaction;
  if (reaction?.stage === 'offer' && pending) {
    const actor = game.players.find(p => !reaction.passed.includes(p.id))!.id;
    return { actor, action: { type: 'semutaPass', event: pending.batch.event } };
  }
  if (game.setupStage === 'leaderSkills' && game.status === 'setup') {
    const actor = Object.keys(game.leaderSkills!.offers)[0];
    const offer = game.leaderSkills!.offers[actor], own = viewGame(game, actor).leaderSkills!;
    const safe = ['warmaster', 'swordmaster-of-ginaz', 'killer-medic', 'prana-bindu-adept'];
    const skill = offer.cards.find(c => safe.includes(c) && !own.unavailableSkills?.[c])
      ?? offer.cards.find(c => !own.unavailableSkills?.[c]);
    const eligible = new Set(own.eligibleLeaders.map(l => l.id));
    const leader = semutaNexusBetrayalPlayer(game, actor).leaders.find(l => eligible.has(l.id));
    assert.ok(skill && leader, 'An actual original offer must have an eligible training choice');
    return { actor, action: { type: 'leaderSkill', event: offer.event, skill, leader: leader.id } };
  }
  return nextRicheseSkillsTechNativeStep(game);
}
function orderUnplayedSpice(game: Game, kinds: ('land' | 'worm')[]): void {
  for (const [position, kind] of kinds.entries()) {
    const index = game.spiceDeck.findIndex((c, i) => i >= position &&
      (kind === 'land' ? 'territory' in c : 'worm' in c));
    assert.ok(index >= position, `An original unplayed ${kind} Spice Card must remain`);
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
  }
}
function takePhysicalCard(game: Game, actor: string, predicate: (card: Card) => boolean): Card {
  for (const zone of [game.deck, game.discard, game.richeseCache!, ...game.players.map(p => p.hand)]) {
    const index = zone.findIndex(predicate);
    if (index < 0) continue;
    const card = zone.splice(index, 1)[0];
    semutaNexusBetrayalPlayer(game, actor).hand.push(card);
    return card;
  }
  throw new Error('The requested original physical Treachery Card is unavailable');
}
/** Exchange identities only after an original qualifying closing draw has
 * supplied a real held card. Never add a hand, draw directly, or rewrite phase. */
function exchangeDrawnChoam(game: Game, owner: string): void {
  const cards = game.nexusCards!.cards!, returned = cards.hands[owner];
  assert.ok(returned, 'The owner must first receive an actual closing Nexus draw');
  if (returned === 'choam') return;
  const donor = Object.keys(cards.hands).find(id => cards.hands[id] === 'choam');
  if (donor) cards.hands[donor] = returned;
  else {
    const zone = [cards.deck, cards.discard].find(z => z.includes('choam'));
    assert.ok(zone, 'The original CHOAM Nexus identity must have a physical custody slot');
    zone[zone.indexOf('choam')] = returned;
  }
  cards.hands[owner] = 'choam';
  validateNexusCards(cards, game.players);
}

/** Genuine four-seat paired CHOAM/Richese setup, first Storm and turn-two
 * worm/alliance/closing draws. Only still-unplayed Spice order and conserved
 * later Treachery/Nexus identities are staged. Wallets, turn, phase, original
 * training, Tech/Stronghold custody and discard receipts are never assigned. */
export function createSemutaNexusBetrayalFixture(options: SemutaNexusBetrayalOptions = {}): SemutaNexusBetrayalFixture {
  let game = options.initial ? structuredClone(options.initial)
    : createGame('SEMUTANEXUSBETRAYAL', newPlayer('r', 'Richese', 'richese'), options.advanced ?? false, ['choam']);
  if (!options.initial) {
    joinGame(game, newPlayer('e', 'CHOAM', 'choam'));
    joinGame(game, newPlayer('a', 'Atreides', 'atreides'));
    joinGame(game, newPlayer('b', 'Emperor', 'emperor'));
  }
  assert.equal(game.status, 'lobby', 'Only a fresh undealt lobby may enter');
  assert.deepEqual(game.expansions, ['choam']);
  assert.equal(game.players.length, 4);
  if (options.advanced !== undefined) assert.equal(game.advanced, options.advanced);
  const idFor = (faction: Player['faction']) => {
    const player = game.players.find(p => p.faction === faction);
    assert.ok(player, `The original ${faction} seat is required`);
    return player.id;
  };
  const owner = idFor('richese'), target = idFor('choam'), spender = idFor('atreides'), observer = idFor('emperor');
  if (options.tech && !game.techTokens) game = applyAction(game, game.host, { type: 'techTokens', enabled: true });
  if (options.strongholds && !game.strongholdCards)
    game = applyAction(game, game.host, { type: 'strongholdCards', enabled: true });
  for (const player of game.players) if (!player.ready) game = applyAction(game, player.id, { type: 'ready' });
  // Fresh module selection only; the original initializer creates all custody.
  game.nexusCards ??= { cards: null, phase: null };
  assert.equal(game.nexusCards.cards, null);
  assert.equal(game.nexusCards.phase, null);
  const initial = structuredClone(game), actions: SemutaNexusBetrayalStep[] = [];
  const staging = ['Reordered only original unplayed Spice Cards: first-turn land blows, turn-two worm then land blows.'];
  game = initializeSemutaGameForAudit(game, options.skills ?? false);
  const setup = structuredClone(game);
  const step = () => {
    const next = nextSemutaNexusBetrayalStep(game);
    actions.push(next); game = applyAction(game, next.actor, next.action);
  };
  const reach = (predicate: () => boolean, label: string) => {
    for (let n = 0; !predicate() && n < 1800; n++) {
      assert.notEqual(game.status, 'finished', `Original native game ended before ${label}`);
      step();
    }
    assert.ok(predicate(), `Original native actions must reach ${label}`);
  };
  reach(() => game.status === 'playing', 'original setup completion');
  assert.ok(Object.values(game.nexusCards!.cards!.hands).every(c => c === null), 'Nexus has no starting hand');
  orderUnplayedSpice(game, ['land', 'land']);
  reach(() => game.turn === 2 && game.phase === 1 && !game.phaseOpening && !game.response && !game.decision,
    'actual second Spice Blow after original first Storm and Mentat');
  assert.ok(Object.values(game.nexusCards!.cards!.hands).every(c => c === null));
  orderUnplayedSpice(game, ['worm', 'land', 'land']);
  reach(() => game.nexus && !game.spiceWindow && !game.spiceResolution, 'actual worm Nexus negotiations');
  for (const [actor, ally] of [[owner, target], [target, owner]]) {
    const action: Action = { type: 'alliance', target: ally };
    actions.push({ actor, action }); game = applyAction(game, actor, action);
  }
  reach(() => game.nexusCards!.phase?.stage === 'drawing', 'qualifying end-Spice Nexus opportunity');
  assert.equal(game.nexusCards!.phase!.occurred, true);
  assert.deepEqual([...game.nexusCards!.phase!.eligible].sort(), [spender, observer].sort());
  const drawBefore = structuredClone(game);
  for (const actor of game.nexusCards!.phase!.eligible) {
    const action: Action = { type: 'nexusCardChoice', turn: game.turn,
      card: game.nexusCards!.cards!.hands[actor], choice: 'draw', ownRedraws: 0 };
    actions.push({ actor, action }); game = applyAction(game, actor, action);
  }
  assert.equal(game.nexusCards!.phase!.stage, 'complete');
  const drawAfter = structuredClone(game);
  exchangeDrawnChoam(game, spender);
  staging.push('Exchanged the actual drawn Nexus identity with CHOAM in an existing hand/deck/discard slot.');
  reach(() => game.phase === 2 && !game.phaseOpening && !game.response && !game.decision,
    'original clean Charity boundary');
  const cards = semutaNexusBetrayalInventory(game), wallets = game.players.map(p => p.spice);
  for (const player of game.players) game.deck.push(...player.hand.splice(0));
  const semuta = takePhysicalCard(game, owner, c => c.id === SEMUTA_DRUG_ID).id;
  const targetCards = ['projectile', 'snooper', 'worthless'].map(kind =>
    takePhysicalCard(game, target, c => c.kind === kind));
  if (options.fullHand) semutaNexusBetrayalPlayer(game, owner).hand.push(...game.deck.splice(0, 3));
  staging.push('Moved canonical Semuta to Richese and three existing Treachery Cards to CHOAM; returned other held cards to the original deck.');
  assert.deepEqual(semutaNexusBetrayalInventory(game), cards);
  assert.deepEqual(game.players.map(p => p.spice), wallets);
  const action = nexusChoamBetrayalAction(viewGame(game, spender));
  assert.ok(action, 'The original unallied CHOAM Betrayal quote must supply a legal action');
  return { game, initial, setup, drawBefore, drawAfter, actions, staging,
    owner, target, spender, observer, semuta, targetCards: structuredClone(targetCards), cards, action };
}
/** No target-card input: the original server producer performs its own random
 * sample and commits that exact physical card before Semuta can react. */
export function commitSemutaNexusBetrayal(fixture: SemutaNexusBetrayalFixture, game = fixture.game): Game {
  return applyAction(game, fixture.spender, fixture.action);
}
export function reactSemutaNexusBetrayal(state: Game, fixture: SemutaNexusBetrayalFixture, claim: boolean): Game {
  const event = state.pendingTreacheryDiscard!.batch.event;
  if (claim) return applyAction(state, fixture.owner, { type: 'semutaCommit', event });
  let game = state;
  for (const player of state.players) game = applyAction(game, player.id, { type: 'semutaPass', event });
  return game;
}
