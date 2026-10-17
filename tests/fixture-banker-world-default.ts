import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeLeaderSkillsGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game,
} from '../game/engine';
import { TERRITORIES } from '../game/board';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { nativeShipmentSources } from '../game/homeworld-options';
import { nextSpiceBankerIncomeNativeStep, type SpiceBankerIncomeNativeStep } from './fixture-spice-banker-income';

export type BankerWorldStep = SpiceBankerIncomeNativeStep;
export type BankerWorldDefaultFixture = {
  lobby: Game;
  offered: Game;
  setup: Game;
  /** Control-ready original Guild turn; no invoice has been declared. */
  game: Game;
  owner: string;
  payer: string;
  trainer: string;
  shipment: BankerWorldStep;
  actions: BankerWorldStep[];
  staging: string[];
};
export type BankerWorldMentatBoundary = {
  beforeCollection: Game;
  collectionAction: BankerWorldStep;
  collection: Game;
  /** Last real Collection acknowledgement, immediately before Mentat 1 opens. */
  game: Game;
  action: BankerWorldStep;
  actions: BankerWorldStep[];
};
export const bankerWorldPlayer = (game: Game, id: string) => {
  const player = game.players.find(p => p.id === id);
  assert.ok(player);
  return player;
};
export const bankerWorldClean = (game: Game) => !game.phaseOpening && !game.response &&
  !game.decision && !game.pendingTreacheryDiscard;
export const bankerWorldWallets = (game: Game) =>
  Object.fromEntries(game.players.map(p => [p.id, p.spice]));

/** Native no-bid/no-move policy. All owner-labelled windows remain real actions;
 * no armies enter another faction's territory, so sealed battle plans are never
 * manufactured. The original shared Banker stepper owns ordinary continuation. */
export function nextBankerWorldDefaultStep(game: Game): BankerWorldStep {
  if (!game.phaseOpening && !game.response) {
    const d = game.decision, event = game.richeseBidding?.event;
    if (d?.kind === 'guildTiming') return { actor: d.player, action: { type: 'decision', take: true } };
    if (d?.kind === 'richeseBlackMarket') return { actor: d.player, action: { type: 'decision', event, decline: true } };
    if (d?.kind === 'richeseDeclaration') return { actor: d.player, action: { type: 'decision', event, position: 'first' } };
    if (d?.kind === 'richeseCache') {
      assert.ok(game.richeseCache?.[0]);
      return { actor: d.player, action: { type: 'decision', event, card: game.richeseCache[0].id,
        method: 'onceAround', direction: 'counterclockwise' } };
    }
    if (d?.kind === 'richeseUnbid') return { actor: d.player, action: { type: 'decision', event, keep: false } };
    if (game.nexusCards?.phase?.stage === 'drawing' && !d) {
      const actor = game.nexusCards.phase.eligible.find(id => !game.nexusCards!.phase!.done.includes(id));
      assert.ok(actor);
      return { actor, action: { type: 'nexusCardChoice', turn: game.turn,
        card: game.nexusCards.cards!.hands[actor], choice: 'keep', ownRedraws: 0 } };
    }
    const lot = game.richeseAuction;
    if (!d && lot && !lot.outcome) {
      const actor = lot.method === 'silent'
        ? lot.order.find(id => lot.eligible.includes(id) && !Object.hasOwn(lot.sealed, id)) : lot.active;
      assert.ok(actor);
      return { actor, action: { type: 'richeseBid', event: lot.event, amount: lot.method === 'silent' ? 0 : null } };
    }
  }
  assert.ok(!game.battle, 'This no-invasion programme must not invent a human Battle Plan.');
  const next = nextSpiceBankerIncomeNativeStep(game);
  assert.ok(next);
  return next;
}
export function advanceBankerWorldDefault(state: Game, until: (game: Game) => boolean,
  actions: BankerWorldStep[] = []): Game {
  let game = state;
  for (let n = 0; n < 1400; n++) {
    if (until(game)) return game;
    assert.equal(game.status, 'playing');
    const next = nextBankerWorldDefaultStep(game);
    actions.push(structuredClone(next));
    game = applyAction(game, next.actor, next.action);
  }
  throw Error('Native World Banker continuation did not reach its requested control.');
}

/** Select only the original all14 shuffle before any offer is dealt. Subsequent
 * native setup draws retain deterministic entropy without rewriting components. */
function withWorldOffers<T>(run: () => T): T {
  const selected: LeaderSkillId[] = ['spice-banker', 'swordmaster-of-ginaz', 'warmaster'];
  const cards = LEADER_SKILL_CARDS.map(c => c.id), rest = cards.filter(id => !selected.includes(id));
  const desired = selected.flatMap(id => [id, rest.shift()!]).concat(rest);
  const current = [...cards], rolls: number[] = [];
  for (let i = current.length - 1; i > 0; i--) {
    const j = current.indexOf(desired[i]);
    assert.ok(j >= 0 && j <= i);
    rolls.push(Math.floor((j + 0.5) / (i + 1) * 0x100000000));
    [current[i], current[j]] = [current[j], current[i]];
  }
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto);
  let index = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array) {
      for (let i = 0; i < array.length; i++) array[i] = rolls[index++] ?? 0xffffffff;
    } else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return run(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Executable ordinary all14 World smoke source. Nexus/Discovery are original
 * unused lobby selections; Tech and Advanced Strongholds use real host actions.
 * Only closed original Spice Card order is staged, with its full multiset kept.
 * No forces, balances, phase clocks, ownership or receipts are assigned. */
export function createBankerWorldDefaultFixture(): BankerWorldDefaultFixture {
  let game = createGame('BANKERWORLDDEFAULT', newPlayer('richese', 'Richese', 'richese'), true, ['choam']);
  joinGame(game, newPlayer('emperor', 'Emperor', 'emperor'));
  joinGame(game, newPlayer('guild', 'Guild', 'guild'));
  game = applyAction(game, game.host, { type: 'homeworlds', enabled: true });
  game = applyAction(game, game.host, { type: 'techTokens', enabled: true });
  game = applyAction(game, game.host, { type: 'strongholdCards', enabled: true });
  game.discoveryEnabled = true;
  game.nexusCards = { cards: null, phase: null };
  const lobby = structuredClone(game), actions: BankerWorldStep[] = [];
  for (const player of game.players) {
    const next: BankerWorldStep = { actor: player.id, action: { type: 'ready' } };
    actions.push(next); game = applyAction(game, next.actor, next.action);
  }
  game = withWorldOffers(() => initializeLeaderSkillsGameForAudit(game));
  const offered = structuredClone(game);
  const skills: LeaderSkillId[] = ['spice-banker', 'swordmaster-of-ginaz', 'warmaster'];
  for (let n = 0; game.status === 'setup' && n < 200; n++) {
    let next: BankerWorldStep;
    if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0], offer = game.leaderSkills!.offers[actor];
      const own = viewGame(game, actor).leaderSkills!;
      const skill = skills[game.players.findIndex(p => p.id === actor)];
      assert.ok(offer.cards.includes(skill) && !own.unavailableSkills?.[skill] && own.eligibleLeaders[0]);
      next = { actor, action: { type: 'leaderSkill', event: offer.event, skill, leader: own.eligibleLeaders[0].id } };
    } else next = nextBankerWorldDefaultStep(game);
    actions.push(structuredClone(next)); game = applyAction(game, next.actor, next.action);
  }
  assert.equal(game.status, 'playing');
  const setup = structuredClone(game);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  // Two genuine ordinary blows close the first Advanced Spice phase without a
  // worm/Nexus alliance or a Discovery entry changing this payment experiment.
  for (let position = 0; position < 2; position++) {
    const at = game.spiceDeck.findIndex((card, i) => i >= position && 'territory' in card && !card.discovery);
    assert.ok(at >= position);
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(at, 1)[0]);
  }
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  game = advanceBankerWorldDefault(game,
    g => g.turn === 1 && g.phase === 5 && g.active === 'guild' && bankerWorldClean(g), actions);
  const destination = TERRITORIES.find(t => t.type === 'sand' && t.sectors.some(s => s !== game.storm) &&
    game.players.every(p => !Object.keys(p.forces).some(key => key.startsWith(`${t.id}:`))) &&
    !Object.keys(game.spice).some(key => key.startsWith(`${t.id}:`) && game.spice[key] > 0));
  assert.ok(destination);
  const homeworldSources = nativeShipmentSources(viewGame(game, 'guild'), 4, 0);
  assert.ok(homeworldSources);
  const shipment: BankerWorldStep = { actor: 'guild', action: { type: 'ship', territory: destination.id,
    sector: destination.sectors.find(s => s !== game.storm)!, amount: 4, elite: 0, allyPayment: 0, homeworldSources } };
  const assignment = game.leaderSkills!.assignments.find(a => a.owner === 'richese' && a.skill === 'spice-banker');
  assert.ok(assignment);
  return { lobby, offered, setup, game, owner: 'richese', payer: 'guild', trainer: assignment.leader,
    shipment, actions, staging: ['Original undealt all14 lottery; original unused Nexus/Discovery lobby selection; conserved first two closed ordinary Spice Cards.'] };
}

export function payBankerWorldDefault(fixture: BankerWorldDefaultFixture, action: Action = fixture.shipment.action): Game {
  const paid = applyAction(fixture.game, fixture.shipment.actor, action);
  return advanceBankerWorldDefault(paid, g => bankerWorldClean(g) && !g.pendingShipment);
}

/** Preserve the actual last Collection-ready action, not a synthetic phase
 * write or an inferred wallet from a later turn containing unrelated income. */
export function bankerWorldBeforeMentat(state: Game): BankerWorldMentatBoundary {
  const actions: BankerWorldStep[] = [];
  let game = state, beforeCollection: Game | null = null, collectionAction: BankerWorldStep | null = null;
  for (let n = 0; (game.phase !== 7 || !bankerWorldClean(game)) && n < 1000; n++) {
    const before = game, next = nextBankerWorldDefaultStep(game);
    actions.push(structuredClone(next));
    game = applyAction(game, next.actor, next.action);
    if (before.phase !== 7 && game.phase === 7) {
      beforeCollection = before;
      collectionAction = next;
    }
  }
  assert.ok(beforeCollection && collectionAction);
  assert.equal(game.phase, 7);
  assert.equal(game.turn, 1);
  const collection = structuredClone(game);
  for (let n = 0; n < game.players.length; n++) {
    const next = nextBankerWorldDefaultStep(game);
    assert.equal(next.action.type, 'ready');
    if (game.ready.length === game.players.length - 1)
      return { beforeCollection, collectionAction, collection, game, action: next, actions };
    actions.push(next); game = applyAction(game, next.actor, next.action);
  }
  throw Error('Original Collection phase did not expose its final Mentat acknowledgement.');
}
