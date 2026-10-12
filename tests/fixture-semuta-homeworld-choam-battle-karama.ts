import assert from 'node:assert/strict';
import {
  createGame, handLimit, initializeSemutaGameForAudit, joinGame,
  newPlayer, viewGame, type Action, type Game,
} from '../game/engine';
import { nativeShipmentSources } from '../game/homeworld-options';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { isAuditorLeader } from '../game/choam-auditor';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { moveSemutaEmperorCard, semutaEmperorPlayer as player } from './fixture-semuta-emperor-share';
import { applySemutaHomeworldChoamStep,
  holdSemutaHomeworldChoamCard } from './fixture-semuta-homeworld-choam';
import type { RicheseSkillsTechStep } from './fixture-richese-skills-tech';
import { advanceSemutaHomeworldEmperorShare as advanceSemutaHomeworldChoam } from './fixture-semuta-homeworld-emperor-share';

export type SemutaHomeworldChoamBattleKaramaScope = 'income' | 'audit';
export type SemutaHomeworldChoamBattleKaramaFixture = {
  scope: SemutaHomeworldChoamBattleKaramaScope;
  initial: Game; setup: Game; beforeBattle: Game; acceptedBattle: Game;
  afterPaidBattle: Game; nativeIncome: Game; auditOffer?: Game;
  originalResponse: Game; gameBeforeCost: Game; game: Game;
  shipments: { actor: string; action: Action; before: Game; after: Game }[];
  actor: string; action: Action; declaration?: Action;
  card: string; karama: string; amount: number; canceller: string; owner: string;
  holder: string; winner: string; loser: string; location: string;
  winnerLeader: string; loserLeader: string; usedIds: string[];
  unplayedPrivateCard: string; projectile?: string; snooper?: string;
  actions: RicheseSkillsTechStep[]; staging: string[];
};
const clean = (g: Game) => !g.phaseOpening && !g.response && !g.decision && !g.pendingTreacheryDiscard;

/** Original Advanced R/E/C/A setup and paid first-turn battle. Only conserved
 * physical card positions and still-unplayed Spice Card order are staged. */
export function createSemutaHomeworldChoamBattleKaramaFixture(
  scope: SemutaHomeworldChoamBattleKaramaScope, fullHolder = false,
): SemutaHomeworldChoamBattleKaramaFixture {
  let game = createGame('SEMUTAHOMEWORLDCHOAMBATTLE', newPlayer('r', 'Richese', 'richese'), true, ['choam']);
  joinGame(game, newPlayer('e', 'Emperor', 'emperor'));
  joinGame(game, newPlayer('c', 'CHOAM', 'choam'));
  joinGame(game, newPlayer('a', 'Atreides', 'atreides'));
  const actions: RicheseSkillsTechStep[] = [], staging: string[] = [];
  game = applySemutaHomeworldChoamStep(game, game.host, { type: 'homeworlds', enabled: true }, actions);
  for (const seat of game.players)
    game = applySemutaHomeworldChoamStep(game, seat.id, { type: 'ready' }, actions);
  const initial = structuredClone(game);
  game = initializeSemutaGameForAudit(game);
  game = advanceSemutaHomeworldChoam(game, g => g.status === 'playing', actions);
  const setup = structuredClone(game);
  const owner = 'c', canceller = 'e', holder = 'r';
  const red = game.spiceDeck.find(c => 'territory' in c && c.territory === 'red_chasm');
  const other = game.spiceDeck.find(c => 'territory' in c && c !== red);
  assert.ok(red && other);
  for (const [index, card] of [red, other].entries())
    game.spiceDeck.splice(index, 0, game.spiceDeck.splice(game.spiceDeck.indexOf(card), 1)[0]);
  staging.push('Position two original unplayed non-worm Spice Cards, first Red Chasm; no clock or resource staging.');
  const shipments: SemutaHomeworldChoamBattleKaramaFixture['shipments'] = [];
  for (const [actor, amount] of [[canceller, 4], [owner, 1]] as const) {
    game = advanceSemutaHomeworldChoam(game,
      g => g.phase === 5 && g.active === actor && clean(g), actions);
    assert.equal(game.turn, 1);
    const sources = nativeShipmentSources(viewGame(game, actor), amount, 0);
    assert.ok(sources);
    const action: Action = { type: 'ship', territory: 'red_chasm', sector: 7,
      amount, elite: 0, homeworldSources: sources, allyPayment: 0 };
    const before = structuredClone(game);
    game = applySemutaHomeworldChoamStep(game, actor, action, actions);
    game = advanceSemutaHomeworldChoam(game, clean, actions);
    shipments.push({ actor, action, before, after: structuredClone(game) });
    assert.equal(player(game, actor).spice, 10 - amount * 2);
    game = applySemutaHomeworldChoamStep(game, actor, { type: 'endMovement' }, actions);
  }
  game = advanceSemutaHomeworldChoam(game, g => g.phase === 6 && clean(g), actions);
  // Late physical staging cannot alter native readiness, shipment or battle funding.
  for (const actor of [canceller, owner, holder]) game.deck.push(...player(game, actor).hand.splice(0));
  moveSemutaEmperorCard(game, SEMUTA_DRUG_ID, holder);
  const karama = holdSemutaHomeworldChoamCard(game, canceller, 'Karama');
  const unplayedPrivateCard = holdSemutaHomeworldChoamCard(game, canceller, 'Hajr');
  const projectile = scope === 'audit' ? holdSemutaHomeworldChoamCard(game, canceller, 'Crysknife') : undefined;
  const snooper = scope === 'audit' ? holdSemutaHomeworldChoamCard(game, owner, 'Snooper') : undefined;
  staging.push('Conserve original physical Semuta to Richese, Karama and unused Hajr to Emperor; audit only: Crysknife to Emperor and nonprojectile Snooper to CHOAM.');
  if (fullHolder) {
    while (player(game, holder).hand.length < handLimit(player(game, holder))) {
      const card = game.deck.find(c => c.id !== SEMUTA_DRUG_ID);
      assert.ok(card);
      moveSemutaEmperorCard(game, card.id, holder);
    }
    staging.push('Conserved undealt cards fill Richese to its native hand limit.');
  }
  const winnerLeader = player(game, canceller).leaders.find(l => l.name === 'Hasimir Fenring')!.id;
  const loserLeader = player(game, owner).leaders.find(l => scope === 'audit'
    ? isAuditorLeader(l) : !isAuditorLeader(l) && !l.dead && !l.usedAt)!.id;
  const beforeBattle = structuredClone(game);
  const chooser = game.active;
  assert.ok(chooser && [owner, canceller].includes(chooser));
  game = applySemutaHomeworldChoamStep(game, chooser,
    { type: 'chooseBattle', territory: 'red_chasm', target: chooser === owner ? canceller : owner }, actions);
  game = advanceSemutaHomeworldChoam(game, g => !!g.battle?.preLeader?.closed && clean(g), actions);
  for (const actor of [game.battle!.attacker, game.battle!.defender]) {
    const action: Action = actor === canceller
      ? { type: 'battlePlan', dial: 2, support: 2, leader: winnerLeader, ...(projectile ? { weapon: projectile } : {}) }
      : { type: 'battlePlan', dial: 0, support: 0, leader: loserLeader, ...(snooper ? { defense: snooper } : {}) };
    game = applySemutaHomeworldChoamStep(game, actor, action, actions);
  }
  const acceptedBattle = structuredClone(game);
  // Every earlier losing/winning Semuta event is passed by genuine controls.
  game = advanceSemutaHomeworldChoam(game, g => g.response?.kind === 'choamBattleIncome', actions);
  const afterPaidBattle = structuredClone(game), nativeIncome = structuredClone(game);
  assert.equal(game.pendingChoamBattleIncome?.amount, 1);
  assert.equal(player(game, owner).spice, 8);
  assert.equal(player(game, canceller).spice, scope === 'audit' ? 2 : 0);
  let auditOffer: Game | undefined, declaration: Action | undefined;
  if (scope === 'audit') {
    game = advanceSemutaHomeworldChoam(game, g => g.decision?.kind === 'choamAudit', actions);
    auditOffer = structuredClone(game);
    assert.equal(player(game, owner).spice, 9);
    const decision = game.decision;
    assert.ok(decision?.kind === 'choamAudit');
    declaration = { type: 'decision', event: decision.event, audit: true };
    game = applySemutaHomeworldChoamStep(game, owner, declaration, actions);
  }
  assert.equal(game.response?.kind, scope === 'income' ? 'choamBattleIncome' : 'choamAudit');
  assert.ok(viewGame(game, canceller).responseControls?.cancelCards.includes(karama));
  const originalResponse = structuredClone(game), gameBeforeCost = structuredClone(game);
  return { scope, initial, setup, beforeBattle, acceptedBattle, afterPaidBattle, nativeIncome,
    auditOffer, originalResponse, gameBeforeCost, game, shipments,
    actor: canceller, action: { type: 'card', mode: 'cancel', card: karama }, declaration,
    card: karama, karama, amount: 1, canceller, owner, holder, winner: canceller,
    loser: owner, location: 'red_chasm:7', winnerLeader, loserLeader,
    usedIds: [...(game.pendingAuditor?.usedCards ?? [])], unplayedPrivateCard, projectile, snooper,
    actions, staging };
}

export function disposeSemutaHomeworldChoamBattleKarama(
  f: SemutaHomeworldChoamBattleKaramaFixture, state = f.game, actions?: RicheseSkillsTechStep[],
): Game {
  return applySemutaHomeworldChoamStep(state, f.actor, f.action, actions);
}

export function reactSemutaHomeworldChoamBattleKarama(
  state: Game, holder: string, claim: boolean, actions?: RicheseSkillsTechStep[],
): Game {
  const pending = state.pendingTreacheryDiscard, reaction = pending?.reaction;
  assert.ok(pending && reaction?.stage === 'offer');
  const event = pending.batch.event;
  if (claim) return applySemutaHomeworldChoamStep(state, holder, { type: 'semutaCommit', event }, actions);
  let game = state;
  for (const seat of state.players.filter(p => !reaction.passed.includes(p.id)))
    game = applySemutaHomeworldChoamStep(game, seat.id, { type: 'semutaPass', event }, actions);
  return game;
}

/** Quote real Collection before the final native market close, not a second
 * Collection quote on an already credited phase-seven snapshot. */
export function finishSemutaHomeworldChoamBattleKarama(state: Game, actions?: RicheseSkillsTechStep[]) {
  let game = advanceSemutaHomeworldChoam(state, g => g.decision?.kind === 'choamMarket', actions);
  assert.equal(game.turn, state.turn);
  const beforeCollection = structuredClone(game), collection = quoteSpiceCollection(game);
  const actor = game.decision!.player, action: Action = { type: 'decision', done: true };
  game = applySemutaHomeworldChoamStep(game, actor, action, actions);
  game = advanceSemutaHomeworldChoam(game, g => g.phase === 7 && clean(g), actions);
  assert.equal(game.turn, state.turn);
  return { game, beforeCollection, collection, actor, action };
}
