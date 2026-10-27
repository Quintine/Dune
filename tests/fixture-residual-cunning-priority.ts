import assert from 'node:assert/strict';
import {
  applyAction, createGame, joinGame, newPlayer, viewGame,
  type Action, type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import type { Card } from '../game/cards';
import { drawNexusCard, validateNexusCards } from '../game/nexus-cards';
import { orderNexusSpice } from './fixture-nexus-cards';

export type ResidualCunningPriorityKind = 'nativeDial' | 'nativeWeapon' | 'nativeImpossible';
export type ResidualCunningPriorityStep = { actor: string; action: Action };
export const residualCunningPriorityPlayer = (game: Game, actor = 'c') => {
  const p = game.players.find(p => p.id === actor); assert.ok(p); return p;
};
export const residualCunningPriorityInventory = (game: Game) => {
  const cards = [...game.deck, ...game.discard, ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...(game.auction?.cards.slice(game.auction.index + Number(game.currentAuctionSale?.origin === 'normal')) ?? []),
    ...game.players.flatMap(p => p.hand)];
  const ids = cards.map(card => card.id).sort(); assert.equal(new Set(ids).size, ids.length); return ids;
};
export function actResidualCunningPriority(game: Game, actor: string, action: Action,
  actions: ResidualCunningPriorityStep[] = []): Game {
  const next = applyAction(game, actor, action); actions.push({ actor, action: structuredClone(action) }); return next;
}
export const residualCunningPriorityClean = (game: Game) => !game.response && !game.decision &&
  !game.phaseOpening && !game.pendingTreacheryDiscard && !game.truthtrance;
export function nextResidualCunningPriority(game: Game): ResidualCunningPriorityStep | null {
  if (game.pendingTreacheryDiscard) {
    const pending: NonNullable<Game['pendingTreacheryDiscard']> = game.pendingTreacheryDiscard;
    assert.equal(pending.reaction?.stage, 'offer');
    const reaction = pending.reaction; assert.ok(reaction);
    const actor = game.players.find(p => !reaction.passed.includes(p.id)); assert.ok(actor);
    return { actor: actor.id, action: { type: 'semutaPass', event: pending.batch.event } };
  }
  if (game.response) {
    const actor = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(actor);
    return { actor: actor.id, action: { type: 'passResponse' } };
  }
  if (game.phaseOpening) {
    const actor = game.players.find(p => !game.phaseOpening!.passed.includes(p.id)); assert.ok(actor);
    return { actor: actor.id, action: { type: 'ready' } };
  }
  if (game.decision?.kind === 'fullPlanOffer')
    return { actor: game.decision.player, action: { type: 'decision', decline: true } };
  if (game.decision?.kind === 'battleLosses')
    return { actor: game.decision.player, action: { type: 'decision', choice: 0 } };
  if (game.decision?.kind === 'battleCards')
    return { actor: game.decision.player, action: { type: 'decision', discard: [] } };
  if (game.decision?.kind === 'choamMarket')
    return { actor: game.decision.player, action: { type: 'decision', done: true } };
  if (game.battle?.outcomeWindow && !game.battle.outcomeWindow.closed) {
    const actor = [game.battle.attacker, game.battle.defender]
      .find(id => !game.battle!.outcomeWindow!.ready.includes(id));
    assert.ok(actor);
    return { actor, action: { type: 'battleOutcomeReady', event: game.battle.outcomeWindow.event } };
  }
  if (game.battle?.preLeader && !game.battle.preLeader.closed) {
    const actor = [game.battle.attacker, game.battle.defender].find(id => !game.battle!.preLeader!.ready.includes(id));
    assert.ok(actor); return { actor, action: { type: 'battlePreparationReady', event: game.battle.event } };
  }
  if (game.battle?.preparation?.kind === 'nexusVoice')
    return { actor: game.battle.preparation.owner, action: { type: 'declineBattlePower' } };
  if (game.battle?.revealed) {
    const actor = viewGame(game, game.host).battle!.traitorVoters.find(id => game.battle!.traitorCalls[id] === undefined);
    if (actor) return { actor, action: { type: 'traitorCall', call: false } };
  }
  if (game.phase === 0 && game.stormPending === null) {
    const actor = game.stormDialers.find(id => game.stormDials[id] === undefined);
    if (actor) return { actor, action: { type: 'stormDial', amount: 0 } };
  }
  if ([0, 1].includes(game.phase)) {
    const actor = game.players.find(p => !game.ready.includes(p.id));
    if (actor) return { actor: actor.id, action: { type: 'ready' } };
  }
  return null;
}
export function advanceResidualCunningPriority(game: Game, until: (state: Game) => boolean,
  actions: ResidualCunningPriorityStep[] = []): Game {
  for (let count = 0; count < 160; count++) {
    if (until(game)) return game;
    const step = nextResidualCunningPriority(game);
    assert.ok(step, `Choose the original inspection or plan at ${game.phase}/${game.battle?.preparation?.kind}/${game.decision?.kind}`);
    game = actResidualCunningPriority(game, step.actor, step.action, actions);
  }
  throw Error('The controlled Residual/Cunning continuation did not reach its bounded native control');
}

/** Original public Advanced A/R/C preview setup, followed by EXPLICIT CONTROLLED
 * physically conserved hands, casualties, cash and battle position. This is
 * the resource-conflict supplement, not a native acquisition/loss programme. */
export function createResidualCunningPriorityFixture(options: { kind?: ResidualCunningPriorityKind } = {}) {
  const kind = options.kind ?? 'nativeDial', asker = 'a', target = 'c', observer = 'r';
  let game = createGame('RESIDUALCUNNINGPRIORITY', newPlayer(asker, 'Atreides', 'atreides'), true, ['choam']);
  joinGame(game, newPlayer(target, 'CHOAM', 'choam')); joinGame(game, newPlayer(observer, 'Richese', 'richese'));
  const actions: ResidualCunningPriorityStep[] = [];
  const act = (actor: string, action: Action) => { game = actResidualCunningPriority(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceResidualCunningPriority(game, until, actions); };
  act(game.host, { type: 'moduleOption', module: 'nexusCards', enabled: true });
  for (const p of game.players) act(p.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, { type: 'start', advancedPreview: true });
  assert.equal(game.advanced, true); const setup = structuredClone(game);
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    let selected: ResidualCunningPriorityStep | null = null;
    for (const p of game.players) {
      const view = viewGame(game, p.id); view.players.find(seat => seat.id === p.id)!.bot = 'Easy';
      const action = botActions(view)[0]; if (action) { selected = { actor: p.id, action }; break; }
    }
    assert.ok(selected, 'The original Advanced Nexus setup needs a legal choice'); act(selected.actor, selected.action);
  }
  assert.equal(game.status, 'playing'); const afterSetup = structuredClone(game);
  const originalInventory = residualCunningPriorityInventory(game); assert.equal(originalInventory.length, 45);
  const originalLeaders = game.players.map(p => ({ player: p.id, ids: p.leaders.map(l => l.id).sort() }));
  orderNexusSpice(game, ['land', 'land']);
  reach(state => state.phase === 2 && residualCunningPriorityClean(state));
  const beforeControlled = structuredClone(game);
  for (const p of game.players) {
    game.deck.push(...p.hand.splice(0)); p.forces = {}; p.reserves = 20; p.tanks = 0;
  }
  const hold = (actor: string, predicate: (card: Card) => boolean) => {
    for (const stock of [game.deck, game.richeseCache!]) {
      const index = stock.findIndex(predicate);
      if (index >= 0) { const card = stock.splice(index, 1)[0]; residualCunningPriorityPlayer(game, actor).hand.push(card); return card.id; }
    }
    throw Error('The controlled source needs one original physical card');
  };
  const residual = hold(asker, card => card.id === 'richese-residual-poison');
  const projectile = hold(target, card => card.kind === 'projectile');
  const ghola = kind === 'nativeImpossible' ? null : hold(target, card => card.effect === 'ghola');
  const karama = kind === 'nativeImpossible' ? null : hold(target, card => card.effect === 'karama');
  const choam = residualCunningPriorityPlayer(game);
  const victim = [...choam.leaders].filter(leader => leader.strength > 0).sort((a, b) => b.strength - a.strength)[0];
  assert.ok(victim);
  for (const leader of choam.leaders) if (leader.id !== victim.id) { leader.dead = true; leader.deaths = 1; }
  choam.spice = 0; assert.ok(!choam.specialKaramaUsed);
  choam.forces = { 'pasty_mesa:5': 4 }; choam.reserves = 16;
  residualCunningPriorityPlayer(game, asker).forces = { 'pasty_mesa:5': 5 };
  residualCunningPriorityPlayer(game, asker).reserves = 15;
  Object.assign(game, { phase: 6, active: asker, order: [asker, target, observer], storm: 18,
    ready: [], response: null, decision: null, phaseOpening: null });
  // This explicitly controlled Battle position has no live Charity turn.
  delete game.charityOrder;
  const cards = game.nexusCards!.cards!, index = cards.deck.indexOf('atreides'); assert.ok(index >= 0);
  cards.deck.splice(index, 1); cards.deck.unshift('atreides');
  game.nexusCards!.cards = drawNexusCard(cards, asker, game.players, () => 0);
  const controlled = structuredClone(game);
  assert.deepEqual(residualCunningPriorityInventory(game), originalInventory); validateNexusCards(game.nexusCards!.cards!, game.players);
  act(asker, { type: 'chooseBattle', territory: 'pasty_mesa', target });
  reach(state => state.battle?.preparation?.kind === 'prescience' && !state.response && !state.decision);
  const beforeAnswers = structuredClone(game);
  const nativeField = kind === 'nativeDial' ? 'dial' as const : 'weapon' as const;
  const extraField = kind === 'nativeDial' ? 'weapon' as const : 'dial' as const;
  const nativeValue = kind === 'nativeDial' ? 3 : projectile;
  const extraValue = kind === 'nativeDial' ? projectile : kind === 'nativeWeapon' ? 3 : 0;
  act(asker, { type: 'prescience', field: nativeField });
  reach(state => !state.response && !state.phaseOpening);
  act(target, { type: 'prescienceAnswer', value: nativeValue }); reach(residualCunningPriorityClean);
  const beforeCunning = structuredClone(game);
  act(asker, { type: 'nexusAtreides', event: game.battle!.event, mode: 'cunning', field: extraField });
  reach(state => !state.response && !state.phaseOpening);
  act(target, { type: 'nexusPrescienceAnswer', event: game.battle!.event, value: extraValue });
  reach(residualCunningPriorityClean);
  const beforePoison = structuredClone(game), event = game.battle!.event!;
  assert.equal(game.battle!.nexusInspection?.stage, 'answered'); assert.equal(game.battle!.nexusInspection?.mode, 'cunning');
  assert.equal(choam.hand.length, kind === 'nativeImpossible' ? 1 : 3);
  const action: Action = { type: 'card', card: residual, target, event };
  const nativeReplacement = null, extraReplacement = kind === 'nativeDial' ? null : 0;
  const cashAction: Action | null = karama && ghola ? { type: 'card', card: karama, mode: 'special', cards: [ghola] } : null;
  const gholaAction: Action | null = ghola ? { type: 'card', card: ghola, leader: victim.id } : null;
  const targetPlan: Action = { type: 'battlePlan', dial: kind === 'nativeDial' ? 3 : 0,
    support: kind === 'nativeDial' ? 3 : 0, leader: kind === 'nativeWeapon' ? victim.id : null,
    weapon: kind === 'nativeWeapon' ? projectile : null, defense: null };
  const opposing = [...residualCunningPriorityPlayer(game, asker).leaders].filter(l => !l.dead && !l.usedAt)
    .sort((a, b) => a.strength - b.strength)[0]; assert.ok(opposing);
  const opponentPlan: Action = { type: 'battlePlan', dial: 0, support: 0, leader: opposing.id, weapon: null, defense: null };
  return { game, beforePoison, source: beforePoison, kind, advanced: true as const, asker, owner: asker, target, observer,
    action, event, residual, projectile, ghola, karama, victim: victim.id, victimStrength: victim.strength,
    nativeField, nativeValue, extraField, extraValue, nativeReplacement, extraReplacement, cashAction, gholaAction,
    targetPlan, opponentPlan, lobby, setup, afterSetup, beforeControlled, controlled, beforeAnswers, beforeCunning,
    originalInventory, originalLeaders, actions, sourceActionCount: actions.length,
    staging: [
      'Original public Advanced-preview A/CHOAM/Richese exact CHOAM+Nexus start and actual setup choices are followed by explicitly controlled, physically conserved battle/cash/card/leader availability. This is not a genuine acquisition, casualty or earned Nexus-draw programme. Starting hands are returned to original stock; original Residual moves cache→A, projectile and (except nativeImpossible) one Ghola plus exactly one activation Karama move stock→CHOAM. All original 45 Treachery/12 Nexus cards and native discs remain unique.',
      'Controlled CHOAM has four ordinary Pasty5 counters, zero spice, no ally, one living usable native leader, all other original discs dead once, and unused cash-in. There is no spare Karama, Cheap Hero, Worthless or extra funding. Original first Storm/two land blows complete before the labelled battle boundary. Actual chooseBattle/readiness/inspection/response/Cunning/answer actions create both disclosures and spend the one real Nexus. Actual Residual then selects its only available native leader; no victim or reconciliation result is installed.',
    ],
  };
}
export type ResidualCunningPriorityFixture = ReturnType<typeof createResidualCunningPriorityFixture>;

export function answerResidualCunningPriority(game: Game, fixture: ResidualCunningPriorityFixture,
  actions: ResidualCunningPriorityStep[] = []): Game {
  if (fixture.kind === 'nativeImpossible')
    game = actResidualCunningPriority(game, fixture.target, { type: 'prescienceAnswer', value: fixture.nativeReplacement }, actions);
  game = actResidualCunningPriority(game, fixture.target,
    { type: 'nexusPrescienceAnswer', event: fixture.event, value: fixture.extraReplacement }, actions);
  return advanceResidualCunningPriority(game, residualCunningPriorityClean, actions);
}
export function prepareResidualCunningPriority(game: Game, fixture: ResidualCunningPriorityFixture,
  actions: ResidualCunningPriorityStep[] = []): Game {
  const p = residualCunningPriorityPlayer(game);
  const action = fixture.kind === 'nativeDial' && !p.specialKaramaUsed ? fixture.cashAction
    : fixture.kind === 'nativeWeapon' && p.leaders.find(l => l.id === fixture.victim)?.dead ? fixture.gholaAction : null;
  if (action) game = actResidualCunningPriority(game, fixture.target, action, actions);
  return advanceResidualCunningPriority(game, residualCunningPriorityClean, actions);
}
export function finishResidualCunningPriority(game: Game, fixture: ResidualCunningPriorityFixture,
  actions: ResidualCunningPriorityStep[] = []): Game {
  if (game.battle?.preparation?.kind === 'prescienceAnswer' || game.battle?.preparation?.kind === 'nexusPrescienceAnswer')
    game = answerResidualCunningPriority(game, fixture, actions);
  game = prepareResidualCunningPriority(game, fixture, actions);
  if (!game.battle!.plans[fixture.target]) game = actResidualCunningPriority(game, fixture.target, fixture.targetPlan, actions);
  if (!game.battle!.plans[fixture.asker]) game = actResidualCunningPriority(game, fixture.asker, fixture.opponentPlan, actions);
  return advanceResidualCunningPriority(game, state => state.phase === 7 && !state.battle, actions);
}
