import assert from 'node:assert/strict';
import {
  applyAction, createGame, joinGame, newPlayer, viewGame, type Game,
} from '../game/engine';
import {
  advancedNativePlayer, initializeAdvancedNativeSkillsSetup,
} from './fixture-advanced-native-skills';
import { nextSkillsTechBattleStep, type SkillsTechBattleStep } from './fixture-skills-tech-battle';

export type DiplomatLateJourneyStep = SkillsTechBattleStep;
export type DiplomatLateJourneyTransition = {
  before: Game; step: DiplomatLateJourneyStep; after: Game;
};
export type DiplomatLateJourney = {
  initial: Game; beforeSetup: Game; afterSetup: Game;
  training: DiplomatLateJourneyTransition[];
  shipments: DiplomatLateJourneyTransition[];
  movements: DiplomatLateJourneyTransition[];
  beforeCards: Game; beforeBattle: Game; game: Game;
  revealed: Game; beforeLate: Game; offered: Game;
  owner: string; opponent: string; observer: string;
  trainer: string; opposingLeader: string; territory: string; key: string; event: string;
  ownPoison: string; opposingPoison: string; worthless: string; portable: string;
  plans: [DiplomatLateJourneyStep, DiplomatLateJourneyStep];
  ownerVote: DiplomatLateJourneyStep; portableAction: DiplomatLateJourneyStep;
  copyAction: DiplomatLateJourneyStep; declineAction: DiplomatLateJourneyStep;
  remainingVote: DiplomatLateJourneyStep;
  expected: Record<'copy' | 'decline', {
    winner: string; trainerDead: boolean; ownForces: number; opposingForces: number;
    ownTanks: number; opposingTanks: number; ownPoisonDiscards: number;
    opposingPoisonDiscards: number; portableDiscards: number; worthlessDiscards: number;
    mandatoryWorthless: boolean; collection: number; remainingVoters: string[];
  }>;
  steps: DiplomatLateJourneyStep[]; staging: string[];
};

const quiet = (game: Game) => !game.phaseOpening && !game.response && !game.decision && !game.pendingTreacheryDiscard;
const plansReady = (game: Game) => quiet(game) && !!game.battle &&
  !game.battle.preparation && game.battle.preLeader?.closed !== false;
const act = (game: Game, step: DiplomatLateJourneyStep, steps: DiplomatLateJourneyStep[]) => {
  steps.push(structuredClone(step)); return applyAction(game, step.actor, step.action);
};

/** Native no-bid programme; leave the original Portable in its cache until the
 * explicitly disclosed transfer. Hidden, unselected other trainers do not lend
 * their battle skills to this two-actor poison comparison. */
export function nextDiplomatLateJourneyStep(game: Game): DiplomatLateJourneyStep {
  if (game.decision?.kind === 'leaderSkillVisibility')
    return { actor: game.decision.player, action: { type: 'leaderSkillVisibility',
      event: game.decision.event, hide: true } };
  if (game.decision?.kind === 'richeseBlackMarket')
    return { actor: game.decision.player, action: { type: 'decision', event: game.richeseBidding!.event, decline: true } };
  if (game.decision?.kind === 'richeseDeclaration')
    return { actor: game.decision.player, action: { type: 'decision', event: game.richeseBidding!.event, position: 'first' } };
  if (game.decision?.kind === 'richeseCache') {
    const card = game.richeseCache!.find(c => c.effect !== 'portableSnooper'); assert.ok(card);
    return { actor: game.decision.player, action: { type: 'decision', event: game.richeseBidding!.event,
      card: card.id, method: 'onceAround', direction: 'clockwise' } };
  }
  if (game.decision?.kind === 'richeseUnbid')
    return { actor: game.decision.player, action: { type: 'decision', event: game.richeseBidding!.event, keep: false } };
  const lot = game.richeseAuction;
  if (lot && !lot.outcome && quiet(game)) {
    const actor = lot.method === 'silent'
      ? lot.order.find(id => lot.eligible.includes(id) && !Object.hasOwn(lot.sealed, id)) : lot.active;
    assert.ok(actor);
    return { actor, action: { type: 'richeseBid', event: lot.event, amount: lot.method === 'silent' ? 0 : null } };
  }
  return nextSkillsTechBattleStep(game);
}

export function advanceDiplomatLateJourney(
  state: Game, until: (game: Game) => boolean, steps: DiplomatLateJourneyStep[] = [],
): Game {
  let game = state;
  for (let n = 0; !until(game) && n < 1000; n++) {
    assert.equal(game.status, 'playing');
    assert.equal(game.turn, 1, 'Continue this original first-turn programme only.');
    game = act(game, nextDiplomatLateJourneyStep(game), steps);
  }
  assert.ok(until(game), 'The original Diplomat programme must reach its requested action window.');
  return game;
}

/** Fresh native Richese/Emperor/Guild Advanced all14 setup, actual Diplomat
 * offer/training, real zero first-Storm dials, paid two-counter South Mesa
 * shipments and actual movement into a native eight-spice Red Chasm blow.
 * No live forces, wallets, phase, order, ownership, plan or receipt are assigned.
 * Only original unopened cards and conserved hand/cache stock are staged below. */
export function createDiplomatLateJourney(options: { initial?: Game } = {}): DiplomatLateJourney {
  let initial: Game;
  if (options.initial) initial = structuredClone(options.initial);
  else {
    initial = createGame('DIPLOMATLATE', newPlayer('emperor', 'Emperor', 'emperor'), true, ['choam']);
    joinGame(initial, newPlayer('richese', 'Richese', 'richese'));
    joinGame(initial, newPlayer('guild', 'Guild', 'guild'));
  }
  assert.equal(initial.status, 'lobby');
  const setupOptions = { family: 'richese' as const, requestedSkill: 'diplomat' as const,
    skillOwner: 'emperor' as const, opponents: ['guild'] as const, initial };
  let game = initializeAdvancedNativeSkillsSetup(setupOptions);
  const beforeSetup = structuredClone(game);
  const owner = advancedNativePlayer(game, 'emperor').id;
  const opponent = advancedNativePlayer(game, 'guild').id;
  const observer = advancedNativePlayer(game, 'richese').id;
  const steps: DiplomatLateJourneyStep[] = [], training: DiplomatLateJourneyTransition[] = [];
  for (let n = 0; game.status === 'setup' && n < 200; n++) {
    let step: DiplomatLateJourneyStep;
    if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0], offer = game.leaderSkills!.offers[actor];
      const view = viewGame(game, actor).leaderSkills!;
      const skill = actor === owner ? 'diplomat' : offer.cards.find(c => !view.unavailableSkills?.[c]);
      assert.ok(skill && offer.cards.includes(skill) && !view.unavailableSkills?.[skill]);
      const eligible = game.players.find(p => p.id === actor)!.leaders
        .filter(l => view.eligibleLeaders.some(candidate => candidate.id === l.id))
        .sort((a, b) => b.strength - a.strength);
      assert.ok(eligible[0]);
      step = { actor, action: { type: 'leaderSkill', event: offer.event, skill, leader: eligible[0].id } };
    } else step = nextDiplomatLateJourneyStep(game);
    const before = structuredClone(game);
    game = act(game, step, steps);
    if (step.action.type === 'leaderSkill') training.push({ before, step, after: structuredClone(game) });
  }
  assert.equal(game.status, 'playing');
  const afterSetup = structuredClone(game);
  const staging = [
    'Control only the first original all14 shuffle so Emperor receives Diplomat; train its strongest original eligible disc with the real leaderSkill action. Other native setup and Traitor choices remain actions.',
    'Reorder original unopened Red Chasm and Broken Land non-worm Spice Cards before the first Advanced Spice Blow. Red Chasm receives its printed eight spice through the native phase, not an assigned pile.',
  ];
  for (const [position, territory] of ['red_chasm', 'broken_land'].entries()) {
    const index = game.spiceDeck.findIndex((c, i) => i >= position && 'territory' in c && c.territory === territory);
    assert.ok(index >= position); game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
  }
  const territory = 'red_chasm', key = 'red_chasm:7';
  const shipments: DiplomatLateJourneyTransition[] = [], movements: DiplomatLateJourneyTransition[] = [];
  game = advanceDiplomatLateJourney(game, g => g.phase === 5 && quiet(g), steps);
  assert.equal(game.spice[key], 8);
  while (game.phase === 5) {
    if (!quiet(game)) { game = act(game, nextDiplomatLateJourneyStep(game), steps); continue; }
    const actor = game.active!;
    if ([owner, opponent].includes(actor)) {
      const before = structuredClone(game);
      const shipment: DiplomatLateJourneyStep = { actor, action: {
        type: 'ship', territory: 'south_mesa', sector: 5, amount: 2, elite: 0, allyPayment: 0,
      } };
      game = act(game, shipment, steps);
      game = advanceDiplomatLateJourney(game, quiet, steps);
      shipments.push({ before, step: shipment, after: structuredClone(game) });
      const beforeMove = structuredClone(game);
      const movement: DiplomatLateJourneyStep = { actor, action: {
        type: 'move', from: 'south_mesa:5', territory, sector: 7, amount: 2, elite: 0,
      } };
      game = act(game, movement, steps);
      game = advanceDiplomatLateJourney(game, quiet, steps);
      movements.push({ before: beforeMove, step: movement, after: structuredClone(game) });
    }
    game = act(game, { actor, action: { type: 'endMovement' } }, steps);
  }
  game = advanceDiplomatLateJourney(game, g => g.phase === 6 && quiet(g), steps);
  const beforeCards = structuredClone(game);
  for (const player of game.players) game.deck.push(...player.hand.splice(0));
  const take = (actor: string, kind: 'poison' | 'worthless') => {
    const index = game.deck.findIndex(c => c.kind === kind); assert.ok(index >= 0);
    const card = game.deck.splice(index, 1)[0];
    game.players.find(p => p.id === actor)!.hand.push(card); return card.id;
  };
  const ownPoison = take(owner, 'poison'), opposingPoison = take(opponent, 'poison'), worthless = take(owner, 'worthless');
  const portableIndex = game.richeseCache!.findIndex(c => c.effect === 'portableSnooper');
  assert.ok(portableIndex >= 0);
  const portableCard = game.richeseCache!.splice(portableIndex, 1)[0], portable = portableCard.id;
  advancedNativePlayer(game, 'guild').hand.push(portableCard);
  staging.push(`Return every original starting hand to undealt stock, then conservedly transfer original poison ${ownPoison} and Worthless ${worthless} to Emperor, poison ${opposingPoison} to Guild, and original Portable Snooper ${portable} from the still-unbought Richese cache to Guild. No card is created; no paid card acquisition is claimed.`);
  const trainer = game.leaderSkills!.assignments.find(a => a.owner === owner && a.skill === 'diplomat')!.leader;
  const trained = new Set(game.leaderSkills!.assignments.map(a => a.leader));
  const opposing = advancedNativePlayer(game, 'guild').leaders
    .filter(l => !l.dead && !trained.has(l.id)).sort((a, b) => a.strength - b.strength)[0];
  assert.ok(opposing);
  assert.ok(advancedNativePlayer(game, 'emperor').leaders.find(l => l.id === trainer)!.strength > opposing.strength);
  const beforeBattle = structuredClone(game);
  const choice = viewGame(game, game.active!).battleChoices.find(c => c.territory === territory);
  assert.ok(choice);
  game = act(game, { actor: choice.chooser, action: { type: 'chooseBattle', territory,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker } }, steps);
  game = advanceDiplomatLateJourney(game, plansReady, steps);
  const controls = structuredClone(game), event = game.battle!.event!;
  const plans: DiplomatLateJourney['plans'] = [
    { actor: owner, action: { type: 'battlePlan', leader: trainer, dial: 0, support: 0, weapon: ownPoison, defense: worthless } },
    { actor: opponent, action: { type: 'battlePlan', leader: opposing.id, dial: 0, support: 0, weapon: opposingPoison } },
  ];
  for (const plan of plans) {
    game = act(game, plan, steps); game = advanceDiplomatLateJourney(game, plansReady, steps);
  }
  assert.ok(game.battle!.revealed);
  const revealed = structuredClone(game);
  const ownerVote: DiplomatLateJourneyStep = { actor: owner, action: { type: 'traitorCall', call: false } };
  game = act(game, ownerVote, steps);
  const beforeLate = structuredClone(game);
  const portableAction: DiplomatLateJourneyStep = { actor: opponent, action: { type: 'portableSnooper', card: portable, event } };
  game = act(game, portableAction, steps);
  assert.equal(game.decision?.kind, 'diplomatDefense');
  assert.ok(game.decision?.kind === 'diplomatDefense');
  const copyAction: DiplomatLateJourneyStep = { actor: owner,
    action: { type: 'decision', event: game.decision.event, card: worthless } };
  const declineAction: DiplomatLateJourneyStep = { actor: owner,
    action: { type: 'decision', event: game.decision.event, card: null } };
  const remainingVote: DiplomatLateJourneyStep = { actor: opponent, action: { type: 'traitorCall', call: false } };
  return { initial, beforeSetup, afterSetup, training, shipments, movements, beforeCards, beforeBattle,
    game: controls, revealed, beforeLate, offered: game, owner, opponent, observer, trainer,
    opposingLeader: opposing.id, territory, key, event, ownPoison, opposingPoison, worthless, portable,
    plans, ownerVote, portableAction, copyAction, declineAction, remainingVote,
    expected: {
      copy: { winner: owner, trainerDead: false, ownForces: 2, opposingForces: 0, ownTanks: 0, opposingTanks: 2,
        ownPoisonDiscards: 0, opposingPoisonDiscards: 1, portableDiscards: 1, worthlessDiscards: 1,
        mandatoryWorthless: true, collection: 4, remainingVoters: [opponent] },
      decline: { winner: opponent, trainerDead: true, ownForces: 0, opposingForces: 2, ownTanks: 2, opposingTanks: 0,
        ownPoisonDiscards: 1, opposingPoisonDiscards: 0, portableDiscards: 0, worthlessDiscards: 1,
        mandatoryWorthless: false, collection: 4, remainingVoters: [opponent] },
    }, steps, staging };
}

/** Resolve only the original still-unsubmitted Guild vote. Emperor's earlier
 * false declaration is never replayed. Stop at real winner-card cleanup. */
export function settleDiplomatLateJourney(
  state: Game, fixture: DiplomatLateJourney, steps: DiplomatLateJourneyStep[] = [],
) {
  assert.equal(state.battle!.traitorCalls[fixture.owner], false);
  assert.equal(state.battle!.traitorCalls[fixture.opponent], undefined);
  assert.notEqual(state.decision?.kind, 'diplomatDefense');
  const beforeResolution = structuredClone(state);
  const afterVote = act(state, fixture.remainingVote, steps);
  const cleanup = advanceDiplomatLateJourney(afterVote, g => g.decision?.kind === 'battleCards' && !g.response && !g.phaseOpening, steps);
  return { beforeResolution, afterVote, cleanup };
}

/** Keep all optional winner cards; advance original phase-opening passes until
 * ordinary Collection has run, without manufacturing another battle or vote. */
export function finishDiplomatLateJourney(state: Game, steps: DiplomatLateJourneyStep[] = []): Game {
  assert.equal(state.decision?.kind, 'battleCards');
  const game = act(state, { actor: state.decision!.player, action: { type: 'decision', discard: [] } }, steps);
  return advanceDiplomatLateJourney(game, g => g.phase === 7 && quiet(g), steps);
}
