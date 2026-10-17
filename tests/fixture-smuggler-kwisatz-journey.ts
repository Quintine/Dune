import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import {
  advancedNativePlayer, assertAdvancedNativeCustody, initializeAdvancedNativeSkillsSetup,
} from './fixture-advanced-native-skills';
import { nextSpiceBankerIncomeNativeStep } from './fixture-spice-banker-income';

export type SmugglerKwisatzJourneyStep = { actor: string; action: Action };
export type SmugglerKwisatzJourneyTransition = {
  before: Game; step: SmugglerKwisatzJourneyStep; after: Game;
};
export type SmugglerKwisatzJourneyOptions = {
  /** A genuine fresh undealt Advanced Ix/Atreides/Guild lobby; retain its seat IDs. */
  initial?: Game;
  /** Both are original Spice Blow cards: six at Wind Pass North, eight at Broken Land. */
  pile?: 'short' | 'ample';
};
export type SmugglerKwisatzJourneyFixture = {
  beforeSetup: Game;
  training: SmugglerKwisatzJourneyTransition[];
  afterSetup: Game;
  firstBattle: {
    before: Game;
    game: Game;
    planActions: [SmugglerKwisatzJourneyStep, SmugglerKwisatzJourneyStep];
    revealed: Game;
    settled: Game;
    steps: SmugglerKwisatzJourneyStep[];
  };
  shipments: SmugglerKwisatzJourneyTransition[];
  /** Second-turn original Battle controls, neither plan sealed. */
  game: Game;
  owner: string;
  opponent: string;
  observer: string;
  trainer: string;
  shield: string;
  territory: string;
  key: string;
  planActions: [SmugglerKwisatzJourneyStep, SmugglerKwisatzJourneyStep];
  steps: SmugglerKwisatzJourneyStep[];
  staging: string[];
};

const quiet = (game: Game) => !game.phaseOpening && !game.response && !game.decision && !game.pendingTreacheryDiscard;
const plansReady = (game: Game) => quiet(game) && !!game.battle &&
  !game.battle.preparation && game.battle.preLeader?.closed !== false;

/** Native no-bid/no-call policy; all preparation and optional card cleanup remain actions. */
export function nextSmugglerKwisatzJourneyStep(game: Game): SmugglerKwisatzJourneyStep {
  if (game.decision?.kind === 'battleCards')
    return { actor: game.decision.player, action: { type: 'decision', discard: [] } };
  if (game.decision?.kind === 'leaderSkillVisibility')
    return { actor: game.decision.player, action: { type: 'leaderSkillVisibility', event: game.decision.event, hide: true } };
  if (!game.response && !game.decision && !game.phaseOpening && game.battle?.preLeader?.closed === false) {
    const battle = game.battle;
    return { actor: battle.preLeader!.ready.includes(battle.attacker) ? battle.defender : battle.attacker,
      action: { type: 'battlePreparationReady', event: battle.preLeader!.event } };
  }
  const step = nextSpiceBankerIncomeNativeStep(game);
  assert.ok(step, 'The original native programme must retain a continuation.');
  return step;
}

export function advanceSmugglerKwisatzJourney(
  state: Game, until: (game: Game) => boolean, steps: SmugglerKwisatzJourneyStep[] = [],
): Game {
  let game = state;
  for (let i = 0; !until(game) && i < 1000; i++) {
    assert.equal(game.status, 'playing');
    const step = nextSmugglerKwisatzJourneyStep(game);
    steps.push(step); game = applyAction(game, step.actor, step.action);
  }
  assert.ok(until(game), 'The native programme did not reach its requested action window.');
  return game;
}

/** No live force, wallet, turn, phase, initiative, loss count, KH or receipt is staged.
 * A paid Guild attack meets the original ten Arrakeen forces. Atreides really
 * supports/dials seven with another disc, wins, and loses seven forces to the Tanks.
 * Turn two has exactly one conflict, on an original, genuinely blown spice pile.
 * The trained Smuggler + legally earned KH uses a conserved original Shield;
 * its winner-card decision exposes the single collection before ordinary Collection.
 */
export function createSmugglerKwisatzJourney(
  options: SmugglerKwisatzJourneyOptions = {},
): SmugglerKwisatzJourneyFixture {
  let game = initializeAdvancedNativeSkillsSetup({ family: 'ixians', requestedSkill: 'smuggler',
    skillOwner: 'atreides', opponents: ['guild'], initial: options.initial });
  const beforeSetup = structuredClone(game);
  const owner = advancedNativePlayer(game, 'atreides').id;
  const opponent = advancedNativePlayer(game, 'guild').id;
  const observer = advancedNativePlayer(game, 'ixians').id;
  const steps: SmugglerKwisatzJourneyStep[] = [];
  const training: SmugglerKwisatzJourneyTransition[] = [];
  const act = (step: SmugglerKwisatzJourneyStep) => {
    steps.push(step); game = applyAction(game, step.actor, step.action); return game;
  };
  for (let i = 0; game.status === 'setup' && i < 200; i++) {
    let step: SmugglerKwisatzJourneyStep;
    if (game.decision?.kind === 'ixSetup') {
      const actor = game.decision.player, card = viewGame(game, actor).ixTechnology!.setup![0];
      assert.ok(card); step = { actor, action: { type: 'decision', card: card.id } };
    } else if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0];
      const offer = game.leaderSkills!.offers[actor], view = viewGame(game, actor).leaderSkills!;
      const skill = actor === owner ? 'smuggler' : offer.cards.find(card => !view.unavailableSkills?.[card]);
      assert.ok(skill && offer.cards.includes(skill) && !view.unavailableSkills?.[skill]);
      const eligible = game.players.find(p => p.id === actor)!.leaders
        .filter(leader => view.eligibleLeaders.some(candidate => candidate.id === leader.id))
        .sort((a, b) => b.strength - a.strength);
      assert.ok(eligible[0]);
      step = { actor, action: { type: 'leaderSkill', event: offer.event, skill, leader: eligible[0].id } };
    } else step = nextSmugglerKwisatzJourneyStep(game);
    const before = structuredClone(game); act(step);
    if (step.action.type === 'leaderSkill') training.push({ before, step, after: structuredClone(game) });
  }
  assert.equal(game.status, 'playing');
  const afterSetup = structuredClone(game);
  const trainer = game.leaderSkills!.assignments.find(a => a.owner === owner && a.skill === 'smuggler')!.leader;
  const staging = [
    'Only the original all14 shuffle is controlled by the native setup helper; Ix starting-card choice, physical offers, leader assignments and Traitor choices are original actions.',
    'Reorder four original unopened Spice Cards: Hagga Basin, Funeral Plain, Wind Pass North, Broken Land. Both turn-two piles come from the original Advanced Spice Blow; no pile is assigned.',
    'First Storm dials are genuine zero actions. Later Advanced Storm entropy is untouched; its one-to-six sectors cannot reach either second-turn battle pile.',
  ];
  for (const [position, territory] of ['hagga_basin', 'funeral_plain', 'wind_pass_north', 'broken_land'].entries()) {
    const index = game.spiceDeck.findIndex((card, i) => i >= position && 'territory' in card && card.territory === territory);
    assert.ok(index >= position); game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
  }
  const reach = (until: (game: Game) => boolean) => {
    game = advanceSmugglerKwisatzJourney(game, until, steps); return game;
  };
  const shipments: SmugglerKwisatzJourneyTransition[] = [];
  const ship = (actor: string, territory: string, sector: number) => {
    const before = structuredClone(game);
    const step: SmugglerKwisatzJourneyStep = { actor, action: {
      type: 'ship', territory, sector, amount: 1, allyPayment: 0,
    } };
    act(step); reach(g => quiet(g) && !g.pendingShipment && !g.pendingHomeworldShipment);
    shipments.push({ before, step, after: structuredClone(game) });
  };
  const movement = (turn: number, territory: string, sector: number, actors: string[]) => {
    reach(g => g.turn === turn && g.phase === 5 && quiet(g));
    const shipped = new Set<string>();
    while (game.turn === turn && game.phase === 5) {
      if (quiet(game) && actors.includes(game.active!) && !shipped.has(game.active!)) {
        const actor = game.active!;
        assert.equal(game.players.find(p => p.id === actor)!.shipped, false);
        ship(actor, territory, sector); shipped.add(actor);
      } else act(nextSmugglerKwisatzJourneyStep(game));
    }
    assert.deepEqual([...shipped].sort(), [...actors].sort());
    reach(g => g.turn === turn && g.phase === 6 && quiet(g));
  };
  const open = (territory: string) => {
    const before = structuredClone(game), chooser = game.active!;
    const choice = viewGame(game, chooser).battleChoices.find(c => c.territory === territory &&
      [c.attacker, c.defender].includes(owner) && [c.attacker, c.defender].includes(opponent));
    assert.ok(choice && choice.chooser === chooser);
    act({ actor: chooser, action: { type: 'chooseBattle', territory,
      target: choice.attacker === chooser ? choice.defender : choice.attacker } });
    reach(plansReady); assert.deepEqual(game.battle!.plans, {});
    return before;
  };
  const untrained = (actor: string) => {
    const trained = new Set(game.leaderSkills!.assignments.map(a => a.leader));
    const leader = game.players.find(p => p.id === actor)!.leaders.filter(l => !trained.has(l.id) && !l.dead && !l.usedAt)
      .sort((a, b) => b.strength - a.strength)[0];
    assert.ok(leader); return leader.id;
  };

  movement(1, 'arrakeen', 10, [opponent]);
  assert.equal(advancedNativePlayer(game, 'atreides').forces['arrakeen:10'], 10);
  assert.equal(advancedNativePlayer(game, 'atreides').battleLosses, 0);
  const firstStart = steps.length;
  const firstBefore = open('arrakeen'), firstGame = structuredClone(game);
  const firstPlans: SmugglerKwisatzJourneyFixture['firstBattle']['planActions'] = [
    { actor: owner, action: { type: 'battlePlan', leader: untrained(owner), dial: 7, support: 7 } },
    { actor: opponent, action: { type: 'battlePlan', leader: untrained(opponent), dial: 0, support: 0 } },
  ];
  for (const step of firstPlans) { act(step); reach(plansReady); }
  assert.ok(game.battle?.revealed);
  const firstRevealed = structuredClone(game), firstEvent = game.battle.event;
  reach(g => !g.battle && !g.decision && !g.response && !g.pendingTreacheryDiscard && g.lastBattleContext?.event === firstEvent);
  const firstSettled = structuredClone(game);
  assert.equal(game.lastBattleContext!.winner, owner);
  assert.equal(advancedNativePlayer(game, 'atreides').battleLosses, 7);
  assert.equal(advancedNativePlayer(game, 'atreides').tanks, 7);
  assert.equal(advancedNativePlayer(game, 'atreides').forces['arrakeen:10'], 3);
  const firstSteps = steps.slice(firstStart);

  const territory = options.pile === 'ample' ? 'broken_land' : 'wind_pass_north';
  const sector = options.pile === 'ample' ? 12 : 17, key = `${territory}:${sector}`;
  movement(2, territory, sector, [owner, opponent]);
  assert.equal(game.spice[key], options.pile === 'ample' ? 8 : 6);
  // Exchange, rather than duplicate or enlarge a hand: this is explicitly not a purchase.
  const own = advancedNativePlayer(game, 'atreides');
  let shield = own.hand.find(card => card.kind === 'shield');
  if (!shield) {
    const index = game.deck.findIndex(card => card.kind === 'shield');
    assert.ok(index >= 0 && own.hand.length > 0);
    shield = game.deck[index]; game.deck[index] = own.hand[0]; own.hand[0] = shield;
    staging.push('At quiet turn-two Battle entry, exchange one original Atreides hand card with an original Shield in undealt stock, conserving hand size and every physical card. No purchase is claimed.');
  }
  open(territory);
  const enemyLeader = untrained(opponent);
  const planActions: SmugglerKwisatzJourneyFixture['planActions'] = [
    { actor: owner, action: { type: 'battlePlan', leader: trainer, dial: 0, support: 0, defense: shield.id, kwisatz: true } },
    { actor: opponent, action: { type: 'battlePlan', leader: enemyLeader, dial: 0, support: 0 } },
  ];
  assert.equal(game.turn, 2);
  assert.equal(advancedNativePlayer(game, 'atreides').battleLosses, 7);
  assert.ok(!advancedNativePlayer(game, 'atreides').kwisatz?.dead);
  assert.equal(viewGame(game, owner).players.find(p => p.id === owner)!.kwisatz!.active, true);
  assertAdvancedNativeCustody(game);
  return { beforeSetup, training, afterSetup,
    firstBattle: { before: firstBefore, game: firstGame, planActions: firstPlans,
      revealed: firstRevealed, settled: firstSettled, steps: firstSteps },
    shipments, game, owner, opponent, observer, trainer, shield: shield.id, territory, key,
    planActions, steps, staging };
}

/** Submit the actual own KH=true action before the other still-unsealed plan. */
export function revealSmugglerKwisatzJourney(
  fixture: SmugglerKwisatzJourneyFixture, steps: SmugglerKwisatzJourneyStep[] = [],
): Game {
  let game = structuredClone(fixture.game);
  for (const step of fixture.planActions) {
    steps.push(step); game = applyAction(game, step.actor, step.action);
    game = advanceSmugglerKwisatzJourney(game, plansReady, steps);
  }
  assert.ok(game.battle?.revealed); return game;
}

/** Payout-stage API: resolve original no-call actions, stopping before the winner's
 * optional Shield cleanup. This is still Battle, not ordinary Spice Collection. */
export function settleSmugglerKwisatzJourney(
  state: Game, steps: SmugglerKwisatzJourneyStep[] = [],
): Game {
  return advanceSmugglerKwisatzJourney(state, game => game.decision?.kind === 'battleCards', steps);
}

/** Finish the real Shield choice and Ix phase-opening passes, then stop after Collection. */
export function finishSmugglerKwisatzJourney(
  state: Game, steps: SmugglerKwisatzJourneyStep[] = [],
): Game {
  assert.equal(state.decision?.kind, 'battleCards');
  const step: SmugglerKwisatzJourneyStep = { actor: state.decision!.player, action: { type: 'decision', discard: [] } };
  steps.push(step);
  const game = applyAction(state, step.actor, step.action);
  return advanceSmugglerKwisatzJourney(game, next => next.phase === 7 && quiet(next), steps);
}
