import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeLeaderSkillsGameForAudit, joinGame, newPlayer, viewGame,
  type Action, type Game, type Player,
} from '../game/engine';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { RECRUITS_CARD_ID } from '../game/recruits';
import { forceRevivalQuote } from '../game/revival';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import { TERRITORIES } from '../game/board';
import { createTechTokens } from '../game/tech-tokens';
import { createStrongholdCards } from '../game/stronghold-cards';
import type { Card } from '../game/cards';
import {
  nextIndependentCardModulesStep, type IndependentCardModulesStep,
} from './fixture-independent-card-modules';

export type IndependentSkillsRevivalStep = IndependentCardModulesStep;
export type IndependentSkillsRevivalOptions = {
  /** Original Basic or Advanced rules; the independent composition is the same. */
  advanced?: boolean;
  /** Select original unused phase modules before admission; both default off. */
  tech?: boolean;
  strongholds?: boolean;
  seatIds?: readonly string[];
};

/** Real consumer-visible numbers measured on the actual states, never assigned. */
export type IndependentSkillsRevivalPricing = {
  /** Turn-two ordinary cap and remaining free rate before any return this phase. */
  ordinary: { limit: number; freeRemaining: number; forcesRemaining: number };
  /** After the payer's real prior free return, still before the Recruits play. */
  priorReturn: { limit: number; freeRemaining: number; revived: number; freeUsed: number };
  /** After the real Recruits activation. */
  doubled: { limit: number; freeRemaining: number };
  /** Independent original price of the real revival requested from that state. */
  revival: { amount: number; free: number; cost: number };
};

export type IndependentSkillsRevivalControl = {
  label: string;
  playAction: Action;
  revivalAction: Action;
  /** Spice the payer actually spent across both real actions. */
  paid: number;
  game: Game;
};

export type IndependentSkillsRevivalFixture = {
  /** Fresh ready classic lobby carrying the independent Ecaz marker. */
  initial: Game;
  /** Original admitted setup: the physical two-card skill offers are open. */
  offered: Game;
  /** Genuine native setup finished: original hands, traitors, forces and all14 skills. */
  afterSetup: Game;
  /** After the real first-turn battle sent the payer's counters to the Tanks. */
  afterBattle: Game;
  /** Immediately after the real out-of-turn bribe was declared. */
  afterBribe: Game;
  /** Turn-one Mentat Pause: the real bribe is spendable and no Bank income is owed. */
  atMentat1: Game;
  /** Real turn-two Revival with the physical Recruits card conserved in the payer's hand. */
  atRevival: Game;
  /** After the payer's real prior free return, before the Recruits play. */
  beforeRecruits: Game;
  /** After the actual Recruits activation, before the priced revival. */
  beforeMainRevival: Game;
  /** After the payer's real revival: Bank income is deferred and unpaid. */
  afterRevival: Game;
  /** Original Shipment boundary after Revival pays and resets its Tech income. */
  afterPhaseEnd: Game;
  /** Turn-two Spice Collection settled, immediately before the Mentat settlement. */
  atMentat2: Game;
  /** Turn-two Mentat Pause after the deferred income was credited exactly once. */
  afterMentat: Game;
  owner: string;
  payer: string;
  opponent: string;
  /** Banker's own trained leader, alive and face up through the programme. */
  bankerLeader: string;
  card: typeof RECRUITS_CARD_ID;
  territory: { id: string; sector: number; type: string };
  battle: {
    event: string;
    attacker: string;
    defender: string;
    chooser: string;
    moveAction: IndependentSkillsRevivalStep;
    shipAction: IndependentSkillsRevivalStep;
    battleAction: IndependentSkillsRevivalStep;
    /** Real battle leaders; neither is a held traitor. */
    payerLeader: string;
    opponentLeader: string;
    visibilityActions: IndependentSkillsRevivalStep[];
    planActions: IndependentSkillsRevivalStep[];
    traitorCalls: IndependentSkillsRevivalStep[];
  };
  bribeAction: IndependentSkillsRevivalStep;
  priorReturnAction: IndependentSkillsRevivalStep;
  playAction: IndependentSkillsRevivalStep;
  revivalAction: IndependentSkillsRevivalStep;
  /** Real below-threshold and free-only revivals on clones of atRevival. */
  controls: IndependentSkillsRevivalControl[];
  pricing: IndependentSkillsRevivalPricing;
  /** Physical deltas the real actions produced. */
  physical: {
    payerBoardLosses: number;
    payerTanksAtRevival: number;
    priorFreeReturn: number;
    revived: number;
    freeReturned: number;
    paidReturned: number;
  };
  /** The single deferred Bank income the real revival produced. */
  grant: { kind: string; payer: string; amount: number; deferred: number };
  /** Native decision windows acknowledged by real actions, in order. */
  decisions: string[];
  /** Every explicit physical staging step, including the conserved Recruits face. */
  staging: string[];
  steps: IndependentSkillsRevivalStep[];
  /** Shared native continuation for continuing this exact programme. */
  advanceUntil: (state: Game, until: (game: Game) => boolean) => Game;
};

const BANKER = 'atreides';
const PAYER = 'guild';
const OPPONENT = 'emperor';
const TERRITORY_ID = 'south_mesa';
const TERRITORY_SECTOR = 4;
const PRIOR_FREE_RETURN = 1;
const REVIVED = 4;
const BRIBE = 4;

const clean = (game: Game): boolean =>
  !game.phaseOpening && !game.response && !game.decision && !game.pendingRevival;

export const independentSkillsRevivalPlayer = (game: Game, id: string): Player => {
  const player = game.players.find(candidate => candidate.id === id);
  assert.ok(player, `Missing original ${id} seat`);
  return player;
};

const boardCount = (player: Player): number =>
  Object.values(player.forces).reduce((sum, count) => sum + count, 0);
const counterTotal = (player: Player): number => player.reserves + player.tanks + boardCount(player);
const allCards = (game: Game): Card[] => [
  ...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand),
];

/** Physical counters and one copy of every selected card stay conserved. */
export function assertIndependentSkillsRevivalInventory(game: Game): void {
  validateLeaderSkills(game.leaderSkills!, game.players);
  const skills = [
    ...game.leaderSkills!.deck,
    ...game.leaderSkills!.assignments.map(assignment => assignment.skill),
    ...Object.values(game.leaderSkills!.offers).flatMap(offer => offer.cards),
  ];
  assert.equal(skills.length, LEADER_SKILL_CARDS.length);
  assert.equal(new Set(skills).size, LEADER_SKILL_CARDS.length);
  for (const expected of ecazTreacheryCards()) {
    const matching = allCards(game).filter(card => card.id === expected.id);
    assert.equal(matching.length, 1, `${expected.id} must keep exactly one physical face`);
  }
  for (const player of game.players) {
    assert.equal(counterTotal(player), 20, `${player.id} must conserve twenty normal counters`);
    if (player.elites)
      assert.equal(player.elites.reserves + player.elites.tanks +
        Object.values(player.elites.forces).reduce((sum, count) => sum + count, 0),
      player.faction === 'ixians' ? 7 : 5, `${player.id} must conserve its special counters`);
  }
}

/** Deterministic only for the original admission and setup deal; play is real. */
function withCanonicalSetupEntropy<T>(deal: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    assert.ok(array);
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(255);
    return array;
  };
  try {
    return deal();
  } finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Physically conserve one existing face into a hand; no minted or replaced copy. */
function conserveCard(game: Game, actor: string, id: string, staging: string[]): Card {
  const player = independentSkillsRevivalPlayer(game, actor);
  const held = player.hand.find(card => card.id === id);
  if (held) {
    staging.push(`Physical staging: ${id} already held by ${actor}; no zone changed.`);
    return held;
  }
  const zones: { label: string; cards: Card[] }[] = [
    { label: 'remaining original deck', cards: game.deck },
    { label: 'original discard', cards: game.discard },
    ...game.players.filter(other => other.id !== actor)
      .map(other => ({ label: `${other.id}'s hand`, cards: other.hand })),
  ];
  const source = zones.find(zone => zone.cards.some(card => card.id === id));
  assert.ok(source, `Original physical ${id} is missing from every retained zone`);
  const limit = player.faction === 'harkonnen' ? 8 : player.faction === 'choam' ? 5 : 4;
  if (player.hand.length >= limit) {
    const index = player.hand.findIndex(card => card.id !== id);
    assert.ok(index >= 0, `${actor} must have a non-Recruits card to return`);
    const [returned] = player.hand.splice(index, 1);
    game.deck.push(returned);
    staging.push(`Physical staging: ${returned.id}, ${actor}'s hand -> remaining original deck (printed hand limit).`);
  }
  const [card] = source.cards.splice(source.cards.findIndex(candidate => candidate.id === id), 1);
  player.hand.push(card);
  staging.push(`Physical staging: conserved ${id}, ${source.label} -> ${actor}'s hand; no purchase, deal or replacement face.`);
  return card;
}

/**
 * Genuine classic Basic/Advanced all14 Leader Skills programme with the
 * independent Ecaz Treachery cards. The real first Storm decides custody; the
 * original skill deal is admitted by the ordinary initializer. One real
 * Banker is trained, one different payer loses a native army in an actual
 * first-turn desert battle, is bribed through the real out-of-turn action and
 * revives at the real turn-two Revival after the physical Recruits card
 * doubles the current free rates. No wallet, owner, phase, receipt or price is
 * assigned; only the Recruits face is conserved into a hand.
 */
export function createIndependentSkillsRevivalFixture(
  options: IndependentSkillsRevivalOptions = {},
): IndependentSkillsRevivalFixture {
  const advanced = options.advanced ?? false;
  assert.ok(!options.strongholds || advanced, 'Original Stronghold Cards require Advanced');
  const ids = options.seatIds ?? ['p0', 'p1', 'p2'];
  assert.equal(ids.length, 3, 'The revival programme uses the Banker, payer and battle opponent seats');
  const [owner, payer, opponent] = ids;
  const steps: IndependentSkillsRevivalStep[] = [];
  const staging: string[] = [];
  const decisions: string[] = [];
  const record = (game: Game, step: IndependentSkillsRevivalStep): Game => {
    assert.ok(game.status === 'lobby' || game.status === 'setup' || game.status === 'playing');
    if (game.decision) decisions.push(game.decision.kind);
    const next = applyAction(game, step.actor, step.action);
    steps.push({ actor: step.actor, action: structuredClone(step.action) });
    return next;
  };

  let game = createGame('INDEPENDENTSKILLSREVIVAL', newPlayer(owner, 'Banker', BANKER), advanced);
  joinGame(game, newPlayer(payer, 'Payer', PAYER));
  joinGame(game, newPlayer(opponent, 'Opponent', OPPONENT));
  if (options.tech) game.techTokens = createTechTokens();
  if (options.strongholds) game.strongholdCards = createStrongholdCards();
  for (const player of game.players) game = record(game, { actor: player.id, action: { type: 'ready' } });
  // The marker is set after every lobby action, before the ordinary initializer.
  game.ecazTreachery = true;
  const initial = structuredClone(game);
  let offeredSetup: Game | undefined;
  /** Original admission plus the whole setup deal: this is the only fixed entropy. */
  const settleSetup = (): Game => {
    let setup = initializeLeaderSkillsGameForAudit(game);
    offeredSetup = structuredClone(setup);
    for (let count = 0; setup.status === 'setup' && count < 400; count++) {
      if (setup.setupStage === 'leaderSkills') {
        const actor = Object.keys(setup.leaderSkills!.offers)[0];
        const offer = setup.leaderSkills!.offers[actor];
        const view = viewGame(setup, actor).leaderSkills!;
        const skill = actor === owner && offer.cards.includes('spice-banker')
          ? 'spice-banker' : offer.cards[0];
        setup = record(setup, {
          actor,
          action: { type: 'leaderSkill', event: offer.event, skill, leader: view.eligibleLeaders[0].id },
        });
      } else if (setup.setupStage === 'traitors') {
        const pending = setup.players.filter(player => player.traitorChoices.length);
        assert.ok(pending.length, 'The original traitor stage must still be waiting for real choices');
        for (const player of pending)
          setup = record(setup, { actor: player.id, action: { type: 'traitor', leader: player.traitorChoices[0] } });
      } else {
        const step = nextIndependentCardModulesStep(setup);
        assert.ok(step, `No native setup continuation at ${setup.setupStage}`);
        setup = record(setup, step);
      }
    }
    return setup;
  };
  game = withCanonicalSetupEntropy(settleSetup);
  assert.ok(offeredSetup, 'The admitted setup must expose its physical skill offers');
  const offered = structuredClone(offeredSetup);
  assert.equal(game.advanced, advanced);
  assert.deepEqual(game.expansions, []);
  assert.equal(game.ecazTreachery, true);
  assert.equal(TERRITORIES.find(entry => entry.id === TERRITORY_ID)?.type, 'sand');
  assert.ok(TERRITORIES.find(entry => entry.id === TERRITORY_ID)!.sectors.includes(TERRITORY_SECTOR));
  const assignment = game.leaderSkills!.assignments.find(entry => entry.skill === 'spice-banker');
  assert.ok(assignment, 'The original skill deal must place the physical Spice Banker card');
  assert.equal(game.status, 'playing');
  assert.equal(assignment.owner, owner, 'The Banker must be trained in the Banker faction');
  const bankerLeader = assignment.leader;
  const payerTrained = game.leaderSkills!.assignments.find(entry => entry.owner === payer)?.leader;
  const opponentTrained = game.leaderSkills!.assignments.find(entry => entry.owner === opponent)?.leader;
  assertIndependentSkillsRevivalInventory(game);
  staging.push('Initial scalar entropy: only the original admission and setup deal are fixed (a canonical first skill order and its traitor deal). Every play action, battle vote and later shuffle uses real entropy; no counter, wallet, phase, skill receipt or Traitor custody was assigned.');
  const afterSetup = structuredClone(game);

  const advanceUntil = (state: Game, until: (current: Game) => boolean): Game => {
    let current = state;
    for (let count = 0; count < 2400; count++) {
      if (until(current)) return current;
      assert.notEqual(current.status, 'finished', 'The original programme ended early');
      // Advanced only: Guild takes its movement turn as the original window offers.
      const step: IndependentSkillsRevivalStep | null =
        current.decision?.kind === 'guildTiming'
          ? { actor: current.decision.player, action: { type: 'decision', take: true } }
          : nextIndependentCardModulesStep(current);
      assert.ok(step, `No native continuation at ${current.turn}/${current.phase}/${current.decision?.kind}`);
      current = record(current, step);
    }
    throw Error('The original programme did not reach its requested boundary');
  };

  // Real first-turn battle: the payer's native army marches into an empty
  // desert the opponent pays to enter, and loses it to the Tleilaxu Tanks.
  game = advanceUntil(game, state => state.turn === 1 && state.phase === 5 && clean(state));
  game = advanceUntil(game, state => state.phase === 5 && state.active === payer && clean(state));
  const moveAction: IndependentSkillsRevivalStep = {
    actor: payer,
    action: { type: 'move', from: 'tueks_sietch:5', territory: TERRITORY_ID, sector: TERRITORY_SECTOR, amount: 5 },
  };
  game = record(game, moveAction);
  game = advanceUntil(game, state => state.phase === 5 && state.active === opponent && clean(state));
  const shipAction: IndependentSkillsRevivalStep = {
    actor: opponent,
    action: { type: 'ship', territory: TERRITORY_ID, sector: TERRITORY_SECTOR, amount: 2 },
  };
  game = record(game, shipAction);
  game = advanceUntil(game, state => state.phase === 6 && clean(state));
  const choice = viewGame(game, game.active!).battleChoices
    .find(candidate => candidate.territory === TERRITORY_ID);
  assert.ok(choice, 'The real movements must open a battle in that desert');
  const chooser = choice.chooser;
  assert.ok(chooser, 'The payer\'s march must leave it the aggressor');
  assert.equal(chooser, payer);
  assert.deepEqual([choice.attacker, choice.defender], [payer, opponent]);
  const battleAction: Action = { type: 'chooseBattle', territory: TERRITORY_ID, target: choice.attacker === chooser ? choice.defender : choice.attacker };
  game = record(game, { actor: chooser, action: battleAction });
  const battleEvent = game.battle?.event;
  assert.ok(battleEvent, 'The real battle choice must open an original battle event');
  const visibilityActions: IndependentSkillsRevivalStep[] = [];
  const planActions: IndependentSkillsRevivalStep[] = [];
  const traitorCalls: IndependentSkillsRevivalStep[] = [];
  // No real battle leader may be a held traitor, so no private vote can change
  // the ordinary strength outcome this programme relies on.
  const heldTraitors = new Set(game.players.flatMap(player => player.traitors));
  /** A trained leader cannot be in its own plan while it stays face up. */
  const untrainedLeader = (id: string, trained: string | undefined, prefer: 'weakest' | 'strongest'): string => {
    const player = independentSkillsRevivalPlayer(game, id);
    const leaders = player.leaders
      .filter(candidate => candidate.id !== trained && !candidate.dead && !heldTraitors.has(candidate.id))
      .sort((a, b) => prefer === 'weakest'
        ? a.strength - b.strength || a.id.localeCompare(b.id)
        : b.strength - a.strength || a.id.localeCompare(b.id));
    assert.ok(leaders.length, `${id} needs an unheld, untrained and available battle leader`);
    return leaders[0].id;
  };
  const payerLeader = untrainedLeader(payer, payerTrained, 'weakest');
  const opponentLeader = untrainedLeader(opponent, opponentTrained, 'strongest');
  for (let count = 0; (game.response || game.decision || game.battle?.preLeader?.closed === false) && count < 60; count++) {
    if (game.decision?.kind === 'leaderSkillVisibility') {
      // Both trained leaders stay public and therefore outside these plans.
      const step: IndependentSkillsRevivalStep = {
        actor: game.decision.player,
        action: { type: 'leaderSkillVisibility', event: game.decision.event, hide: false },
      };
      visibilityActions.push(step);
      game = record(game, step);
    } else {
      const step = nextIndependentCardModulesStep(game);
      assert.ok(step, `No native pre-battle continuation at ${game.decision?.kind}`);
      game = record(game, step);
    }
  }
  assert.ok(!heldTraitors.has(payerLeader) && !heldTraitors.has(opponentLeader),
    'Neither real battle leader may be a held traitor');
  const payerPlan: IndependentSkillsRevivalStep = {
    actor: payer, action: { type: 'battlePlan', dial: 0, support: 0, leader: payerLeader },
  };
  const opponentPlan: IndependentSkillsRevivalStep = {
    actor: opponent, action: { type: 'battlePlan', dial: 1, support: 0, leader: opponentLeader },
  };
  planActions.push(payerPlan, opponentPlan);
  game = record(game, payerPlan);
  game = record(game, opponentPlan);
  for (let count = 0; (game.response || game.decision || game.battle) && count < 120; count++) {
    const step = nextIndependentCardModulesStep(game);
    assert.ok(step, `No native battle continuation at ${game.decision?.kind}`);
    if (step.action.type === 'traitorCall') traitorCalls.push(step);
    game = record(game, step);
  }
  assert.ok(!game.battle, 'The battle must have resolved completely');
  assert.equal(game.phase, 7);
  const payerBoardLosses = independentSkillsRevivalPlayer(game, payer).tanks;
  assert.equal(payerBoardLosses, 5,
    'The real battle must send the payer\'s five physical counters to the Tanks');
  assert.equal(boardCount(independentSkillsRevivalPlayer(game, payer)), 0);
  const afterBattle = structuredClone(game);

  // Real out-of-turn bribe funds the next revival; bribes become spendable at Mentat.
  const bribeAction: IndependentSkillsRevivalStep = {
    actor: opponent, action: { type: 'bribe', target: payer, amount: BRIBE },
  };
  game = record(game, bribeAction);
  assert.equal(independentSkillsRevivalPlayer(game, payer).bribes, BRIBE);
  const afterBribe = structuredClone(game);
  game = advanceUntil(game, state => state.turn === 1 && state.phase === 8 && clean(state));
  assert.equal(independentSkillsRevivalPlayer(game, payer).bribes, 0);
  assert.deepEqual(viewGame(game, owner).spiceBankerIncome?.deferred, [],
    'The first-turn bribe is a payment to a player, so no Bank income is owed yet');
  const atMentat1 = structuredClone(game);

  game = advanceUntil(game, state => state.turn === 2 && state.phase === 4 && clean(state));
  const payerTanksAtRevival = independentSkillsRevivalPlayer(game, payer).tanks;
  assert.equal(payerTanksAtRevival, payerBoardLosses,
    'No counter may reach or leave the Tanks between the battle and the Revival');
  conserveCard(game, payer, RECRUITS_CARD_ID, staging);
  staging.push(`Conserved staging: the ${PAYER} payer holds the physical Recruits face after a real native programme; the Banker remains ${bankerLeader} in ${owner}.`);
  assertIndependentSkillsRevivalInventory(game);
  const atRevival = structuredClone(game);
  const ordinaryView = viewGame(game, payer).revival;
  const pricing: IndependentSkillsRevivalPricing = {
    ordinary: { limit: ordinaryView.limit, freeRemaining: ordinaryView.freeRemaining, forcesRemaining: ordinaryView.forcesRemaining },
    priorReturn: { limit: 0, freeRemaining: 0, revived: 0, freeUsed: 0 },
    doubled: { limit: 0, freeRemaining: 0 },
    revival: { amount: REVIVED, free: 0, cost: 0 },
  };
  assert.equal(pricing.ordinary.limit, 3, 'The ordinary force revival cap is still three');
  assert.ok(pricing.ordinary.freeRemaining >= PRIOR_FREE_RETURN);

  const priorReturnAction: IndependentSkillsRevivalStep = {
    actor: payer, action: { type: 'revive', amount: PRIOR_FREE_RETURN },
  };
  game = record(game, priorReturnAction);
  assert.ok(!game.pendingRevival, 'The real revival must settle without an open request');
  const afterPrior = independentSkillsRevivalPlayer(game, payer);
  const priorFree = afterPrior.freeForcesRevived;
  assert.ok(priorFree !== undefined, 'The ordinary free-return ledger must exist');
  assert.equal(afterPrior.tanks, payerTanksAtRevival - PRIOR_FREE_RETURN);
  assert.equal(afterPrior.revived, PRIOR_FREE_RETURN);
  assert.equal(priorFree, PRIOR_FREE_RETURN);
  const priorView = viewGame(game, payer).revival;
  pricing.priorReturn = {
    limit: priorView.limit, freeRemaining: priorView.freeRemaining,
    revived: afterPrior.revived, freeUsed: priorFree,
  };
  const beforeRecruits = structuredClone(game);

  const playAction: IndependentSkillsRevivalStep = {
    actor: payer, action: { type: 'card', card: RECRUITS_CARD_ID },
  };
  game = record(game, playAction);
  assert.equal(game.recruits?.player, payer);
  const doubledView = viewGame(game, payer).revival;
  pricing.doubled = { limit: doubledView.limit, freeRemaining: doubledView.freeRemaining };
  assert.equal(pricing.doubled.limit, 7, 'Recruits raises the ordinary cap to seven');
  const beforeMainRevival = structuredClone(game);

  const quote = forceRevivalQuote(game, independentSkillsRevivalPlayer(game, payer), REVIVED);
  pricing.revival = { amount: REVIVED, free: quote.free, cost: quote.cost };
  const revivalAction: IndependentSkillsRevivalStep = {
    actor: payer, action: { type: 'revive', amount: REVIVED },
  };
  game = record(game, revivalAction);
  assert.ok(!game.pendingRevival, 'The real revival must settle without an open request');
  const afterMain = independentSkillsRevivalPlayer(game, payer);
  assert.equal(afterMain.tanks, payerTanksAtRevival - PRIOR_FREE_RETURN - REVIVED);
  assert.equal(afterMain.revived, PRIOR_FREE_RETURN + REVIVED);
  assert.equal(afterMain.freeForcesRevived, PRIOR_FREE_RETURN + quote.free);
  const grant = game.spiceBankerIncome!.sources.find(source => source.grant)!;
  assert.ok(grant, 'The real revival payment must award the Banker income');
  assert.equal(grant.source.kind, 'force-revival');
  assert.deepEqual(grant.source.bankLegs, [{ payer, amount: quote.cost }]);
  assert.deepEqual(viewGame(game, owner).spiceBankerIncome?.deferred, [{ owner, amount: 1 }],
    'The Banker income is placed in front of the shield, not added to the wallet');
  assert.equal(independentSkillsRevivalPlayer(game, owner).spice,
    independentSkillsRevivalPlayer(beforeMainRevival, owner).spice,
    'The Banker wallet must not advance when the income is deferred');
  const afterRevival = structuredClone(game);

  // The same real state also feeds two genuine no-grant controls.
  const control = (label: string, action: Action): IndependentSkillsRevivalControl => {
    let clone = structuredClone(atRevival) as Game;
    const before = independentSkillsRevivalPlayer(clone, payer).spice;
    clone = applyAction(clone, payer, structuredClone(playAction.action));
    clone = applyAction(clone, payer, action);
    return {
      label, playAction: structuredClone(playAction.action), revivalAction: structuredClone(action),
      paid: before - independentSkillsRevivalPlayer(clone, payer).spice, game: clone,
    };
  };
  const controls = [
    control('free-only revival stays inside the doubled free rate', { type: 'revive', amount: 2 }),
    control('below-threshold revival pays less than four to the Bank', { type: 'revive', amount: 3 }),
  ];
  for (const entry of controls)
    assert.deepEqual(viewGame(entry.game, owner).spiceBankerIncome?.deferred, [],
      `${entry.label} must not earn Bank income`);

  const afterPhaseEnd = advanceUntil(game, state => state.turn === 2 && state.phase === 5 && clean(state));
  const atMentat2 = advanceUntil(afterPhaseEnd, state => state.turn === 2 && state.phase === 7 && clean(state));
  assert.deepEqual(viewGame(atMentat2, owner).spiceBankerIncome?.deferred, [{ owner, amount: 1 }],
    'The deferred Bank income survives until the actual Mentat settlement');
  const afterMentat = advanceUntil(atMentat2, state => state.turn === 2 && state.phase === 8 && clean(state));
  return {
    initial, offered, afterSetup, afterBattle, afterBribe, atMentat1, atRevival,
    beforeRecruits, beforeMainRevival, afterRevival, afterPhaseEnd, atMentat2, afterMentat,
    owner, payer, opponent, bankerLeader, card: RECRUITS_CARD_ID,
    territory: { id: TERRITORY_ID, sector: TERRITORY_SECTOR, type: 'sand' },
    battle: {
      event: battleEvent, attacker: payer, defender: opponent, chooser: payer,
      moveAction, shipAction, battleAction: { actor: chooser, action: structuredClone(battleAction) },
      payerLeader, opponentLeader,
      visibilityActions, planActions, traitorCalls,
    },
    bribeAction, priorReturnAction, playAction, revivalAction, controls, pricing,
    physical: {
      payerBoardLosses, payerTanksAtRevival, priorFreeReturn: PRIOR_FREE_RETURN,
      revived: REVIVED, freeReturned: quote.free, paidReturned: REVIVED - quote.free,
    },
    grant: { kind: grant.source.kind, payer, amount: quote.cost, deferred: 1 },
    decisions, staging, steps, advanceUntil,
  };
}
