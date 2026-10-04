import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeLeaderSkillsGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game, type Player,
} from '../game/engine';
import type { FactionId } from '../game/catalog';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { classicNexusLeaderSkillsProfile } from '../game/leader-skill-profile';
import { traitorDeck } from '../game/traitors';
import { nexusInventory } from './fixture-nexus-cards';
import { nextClassicSkillsStrongholdStep } from './fixture-classic-skills-stronghold';

export type ClassicNexusSkillsPaymentKind = 'emperor-revival' | 'fremen-revival' | 'emperor-purchase' | 'harkonnen-cunning';
export type ClassicNexusSkillsPaymentStep = { actor: string; action: Action };
export type ClassicNexusSkillsPaymentsOptions = {
  /** Original authenticated lobby OR actual undealt leader-skills CLI setup. */
  initial?: Game;
  advanced?: boolean;
  seatIds?: string[];
  ownerFaction?: FactionId;
  kind?: ClassicNexusSkillsPaymentKind;
  skill?: LeaderSkillId;
  tanks?: number;
  eliteTanks?: number;
  /** Reach a real revealed battle and commit the original call before Cunning. */
  declaredTraitor?: 'call' | 'decline';
};
export type ClassicNexusSkillsPaymentsFixture = {
  initial: Game;
  afterSetup: Game;
  beforeFirstMentat: Game;
  firstMentatStep: ClassicNexusSkillsPaymentStep;
  afterFirstMentat: Game;
  beforeClosingDraw: Game;
  closingDraw: ClassicNexusSkillsPaymentStep;
  afterClosingDraw: Game;
  beforePayment: Game;
  game: Game;
  actor: string;
  opponent: string;
  kind: ClassicNexusSkillsPaymentKind;
  paymentAction: Action;
  actions: ClassicNexusSkillsPaymentStep[];
  planActions: ClassicNexusSkillsPaymentStep[];
  staging: string[];
  declaredIdentity?: string;
};
export const classicNexusSkillsPaymentsSnapshot = (game: Game): Game => structuredClone(game);
export function classicNexusSkillsPaymentsPlayer(game: Game, id: string): Player {
  const player = game.players.find(p => p.id === id);
  assert.ok(player, `Missing original seat ${id}`);
  return player;
}
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision;

/** The first thirteen rolls control only the original all14 shuffle. Other
 * scalar rolls are fixed; generic getRandomValues calls retain native behavior. */
function originalRandom<T>(run: () => T, selected?: LeaderSkillId[]): T {
  const rolls: number[] = [];
  if (selected) {
    assert.equal(new Set(selected).size, selected.length);
    const working: LeaderSkillId[] = LEADER_SKILL_CARDS.map(card => card.id);
    const remainder = working.filter(card => !selected.includes(card));
    const desired = selected.flatMap(card => [card, remainder.shift()!]);
    desired.push(...remainder);
    for (let i = working.length - 1; i > 0; i--) {
      const j = working.indexOf(desired[i]);
      assert.ok(j >= 0 && j <= i);
      rolls.push(Math.floor((j + 0.5) * 0x100000000 / (i + 1)));
      [working[i], working[j]] = [working[j], working[i]];
    }
  }
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto);
  let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) array[0] = rolls[cursor++] ?? 0xffffffff;
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return run(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

export function nextClassicNexusSkillsPaymentsNativeStep(game: Game): ClassicNexusSkillsPaymentStep | null {
  if (game.status === 'setup' && game.setupStage === 'leaderSkills') {
    const actor = Object.keys(game.leaderSkills!.offers)[0];
    assert.ok(actor);
    const view = viewGame(game, actor).leaderSkills!;
    const skill = view.offer!.cards.find(card => !view.unavailableSkills?.[card]);
    const eligible = new Set(view.eligibleLeaders.map(leader => leader.id));
    const leader = classicNexusSkillsPaymentsPlayer(game, actor).leaders.filter(leader => eligible.has(leader.id))
      .sort((a, b) => b.strength - a.strength)[0];
    assert.ok(skill && leader, 'An original offer must have a legal skill/disc choice');
    return { actor, action: { type: 'leaderSkill', event: view.offer!.event, skill, leader: leader.id } };
  }
  if (game.nexusCards?.phase?.stage === 'drawing' && clean(game)) {
    const phase = game.nexusCards.phase;
    const actor = phase.eligible.find(id => !phase.done.includes(id));
    if (actor) return { actor, action: { type: 'nexusCardChoice', turn: game.turn,
      card: game.nexusCards.cards!.hands[actor], choice: 'keep', ownRedraws: 0 } };
  }
  return nextClassicSkillsStrongholdStep(game);
}
export function advanceClassicNexusSkillsPaymentsStep(state: Game, actions?: ClassicNexusSkillsPaymentStep[]): Game {
  const next = nextClassicNexusSkillsPaymentsNativeStep(state);
  assert.ok(next, 'The original continuation needs a human battle plan');
  actions?.push(structuredClone(next));
  return applyAction(state, next.actor, next.action);
}
export function advanceClassicNexusSkillsPayments(state: Game, predicate: (game: Game) => boolean,
  actions?: ClassicNexusSkillsPaymentStep[]): Game {
  let game = state;
  for (let n = 0; n < 1800; n++) {
    if (predicate(game)) return game;
    assert.notEqual(game.status, 'finished');
    game = advanceClassicNexusSkillsPaymentsStep(game, actions);
  }
  throw Error('Original skill/Nexus continuation did not reach its boundary');
}
/** Checks the boundary BEFORE every action, including auto-skipped Battle. */
export function advanceClassicNexusSkillsPaymentsToPhase(state: Game, phase: number,
  actions?: ClassicNexusSkillsPaymentStep[]): Game {
  const turn = state.turn;
  const game = advanceClassicNexusSkillsPayments(state, current => {
    assert.equal(current.turn, turn);
    return current.phase >= phase && clean(current);
  }, actions);
  assert.equal(game.turn, turn);
  return game;
}

/** No replacement of a supplied setup's saved first offers or original IDs. */
export function initializeClassicNexusSkillsPaymentsSetup(options: ClassicNexusSkillsPaymentsOptions = {}): Game {
  const kind = options.kind ?? 'emperor-revival';
  const faction = options.ownerFaction ?? (kind === 'harkonnen-cunning' ? 'harkonnen' : 'atreides');
  let game = options.initial ? structuredClone(options.initial)
    : createGame('CLASSICNEXUSSKILLSPAYMENTS', newPlayer(options.seatIds?.[0] ?? 'payer', faction, faction), options.advanced ?? false);
  if (!options.initial) {
    const forbidden = kind === 'fremen-revival' ? 'fremen' : kind.startsWith('emperor-') ? 'emperor' : undefined;
    const count = options.seatIds?.length ?? 3;
    assert.ok(count >= 3 && count <= 6);
    for (const candidate of ['harkonnen', 'guild', 'beneGesserit', 'atreides', 'fremen', 'emperor'] as const)
      if (game.players.length < count && candidate !== forbidden && candidate !== faction)
        joinGame(game, newPlayer(options.seatIds?.[game.players.length] ?? candidate, candidate, candidate));
    assert.equal(game.players.length, count, 'The requested absent-faction power needs a compatible classic roster');
  }
  if (options.advanced !== undefined) assert.equal(game.advanced, options.advanced);
  assert.ok(game.players.some(p => p.faction === faction));
  if (game.status === 'setup') {
    assert.ok(classicNexusLeaderSkillsProfile(game));
    assert.ok(game.setupStage === 'prediction' || game.setupStage === 'leaderSkills');
    assert.equal(game.turn, 1); assert.equal(game.phase, 0);
    assert.ok(game.players.every(p => !p.traitors.length && !p.traitorChoices.length));
    assert.equal(game.leaderSkills!.assignments.length, 0);
    classicNexusSkillsPaymentsInventory(game);
    return game;
  }
  assert.equal(game.status, 'lobby');
  if (!game.nexusCards) game.nexusCards = { cards: null, phase: null };
  assert.ok(classicNexusLeaderSkillsProfile(game));
  for (const player of game.players) if (!player.ready) game = applyAction(game, player.id, { type: 'ready' });
  const skill = options.skill ?? 'sandmaster';
  const passive: LeaderSkillId[] = ['sandmaster', 'smuggler', 'prana-bindu-adept', 'killer-medic', 'master-of-assassins', 'swordmaster-of-ginaz']
    .filter(candidate => candidate !== skill) as LeaderSkillId[];
  const selected = game.players.map(p => p.faction === faction ? skill : passive.shift()!);
  return originalRandom(() => initializeLeaderSkillsGameForAudit(game), selected);
}

function reserveBoard(game: Game, staging: string[]): void {
  for (const player of game.players) {
    player.reserves += Object.values(player.forces).reduce((a, b) => a + b, 0);
    player.forces = {};
    if (player.elites) {
      player.elites.reserves += Object.values(player.elites.forces).reduce((a, b) => a + b, 0);
      player.elites.forces = {};
    }
    if (player.advisors) player.advisors = {};
  }
  staging.push('Conserved original on-board counters into their own reserves; no wallet, phase, turn or module owner assigned.');
}
function orderUndealtSpice(game: Game, kinds: ('land' | 'worm')[], staging: string[]): void {
  const front = [];
  for (const kind of kinds) {
    const index = game.spiceDeck.findIndex(card => kind === 'land' ? 'territory' in card : 'worm' in card);
    assert.ok(index >= 0, 'Only original still-undealt physical Spice Cards may be ordered');
    front.push(game.spiceDeck.splice(index, 1)[0]);
  }
  game.spiceDeck.unshift(...front);
  staging.push(`Ordered original undealt Spice Card singletons: ${kinds.join(', ')}; not a natural shuffle history.`);
}
function holdTraitor(game: Game, actor: string, identity: string, staging: string[]): void {
  const owner = classicNexusSkillsPaymentsPlayer(game, actor);
  if (owner.traitors.includes(identity)) return;
  const returned = owner.traitors[0];
  const index = game.traitorReserve!.indexOf(identity);
  const donor = game.players.find(p => p.id !== actor && p.traitors.includes(identity));
  assert.ok(returned && (index >= 0 || donor));
  if (index >= 0) game.traitorReserve![index] = returned;
  else donor!.traitors[donor!.traitors.indexOf(identity)] = returned;
  owner.traitors[0] = identity;
  staging.push(`Conserved original traitor ${identity}: exchanged ${returned} with ${donor?.id ?? 'reserve'} custody.`);
}

export function createClassicNexusSkillsPaymentsFixture(options: ClassicNexusSkillsPaymentsOptions = {}): ClassicNexusSkillsPaymentsFixture {
  const initial = initializeClassicNexusSkillsPaymentsSetup(options);
  return originalRandom(() => {
    const kind = options.kind ?? 'emperor-revival';
    const faction = options.ownerFaction ?? (kind === 'harkonnen-cunning' ? 'harkonnen' : 'atreides');
    const actions: ClassicNexusSkillsPaymentStep[] = [], staging: string[] = [], planActions: ClassicNexusSkillsPaymentStep[] = [];
    let game = advanceClassicNexusSkillsPayments(initial, state => state.status === 'playing', actions);
    const afterSetup = structuredClone(game);
    const actor = game.players.find(p => p.faction === faction)!.id;
    assert.ok(game.players.length >= 3, 'A real alliance leaves this original seat unallied');
    const opponent = game.players.find(p => p.id !== actor)!.id;
    reserveBoard(game, staging);
    game = advanceClassicNexusSkillsPaymentsToPhase(game, 1, actions);
    orderUndealtSpice(game, ['land', 'land'], staging);
    game = advanceClassicNexusSkillsPaymentsToPhase(game, 8, actions);
    let beforeFirstMentat: Game | undefined, firstMentatStep: ClassicNexusSkillsPaymentStep | undefined;
    while (game.turn === 1) {
      const before = structuredClone(game);
      const next = nextClassicNexusSkillsPaymentsNativeStep(game); assert.ok(next);
      game = advanceClassicNexusSkillsPaymentsStep(game, actions);
      if (game.turn === 2) { beforeFirstMentat = before; firstMentatStep = next; }
    }
    assert.ok(beforeFirstMentat && firstMentatStep);
    const afterFirstMentat = structuredClone(game);
    game = advanceClassicNexusSkillsPaymentsToPhase(game, 1, actions);
    reserveBoard(game, staging);
    orderUndealtSpice(game, ['worm', 'land', 'land'], staging);
    let allied = false;
    for (let n = 0; game.nexusCards?.phase?.stage !== 'drawing' && n < 240; n++) {
      if (game.nexus && !game.spiceWindow && !game.spiceResolution && clean(game) && !allied) {
        const others = game.players.filter(p => p.id !== actor);
        for (const [from, to] of [[others[0].id, others[1].id], [others[1].id, others[0].id]]) {
          const action: Action = { type: 'alliance', target: to };
          actions.push({ actor: from, action }); game = applyAction(game, from, action);
        }
        allied = true;
      }
      game = advanceClassicNexusSkillsPaymentsStep(game, actions);
    }
    assert.ok(allied); assert.equal(game.nexusCards?.phase?.stage, 'drawing');
    const card: FactionId = kind === 'harkonnen-cunning' ? 'harkonnen' : kind === 'fremen-revival' ? 'fremen' : 'emperor';
    const cards = game.nexusCards!.cards!;
    const index = cards.deck.indexOf(card); assert.ok(index >= 0);
    cards.deck.unshift(cards.deck.splice(index, 1)[0]);
    staging.push(`Ordered original undealt ${card} Nexus singleton before the real closing draw; no hand grant.`);
    const beforeClosingDraw = structuredClone(game);
    const closingDraw: ClassicNexusSkillsPaymentStep = { actor, action: { type: 'nexusCardChoice', turn: game.turn,
      card: cards.hands[actor], choice: 'draw', ownRedraws: 0 } };
    actions.push(closingDraw); game = applyAction(game, actor, closingDraw.action);
    assert.equal(game.nexusCards!.cards!.hands[actor], card);
    const afterClosingDraw = structuredClone(game);
    game = advanceClassicNexusSkillsPayments(game, state => state.nexusCards?.phase?.stage !== 'drawing', actions);
    let paymentAction: Action, declaredIdentity: string | undefined;
    if (kind === 'emperor-purchase') {
      game = advanceClassicNexusSkillsPaymentsToPhase(game, 3, actions);
      for (let n = 0; game.decision?.kind !== 'auctionPayment' && n < 160; n++) {
        if (game.auction?.active === actor && !game.auction.bid) {
          const action: Action = { type: 'bid', amount: 2 };
          actions.push({ actor, action }); game = applyAction(game, actor, action);
        } else game = advanceClassicNexusSkillsPaymentsStep(game, actions);
      }
      assert.equal(game.decision?.kind, 'auctionPayment'); assert.equal(game.decision!.player, actor);
      assert.equal(game.auction!.bid, 2); assert.equal(game.auction!.bidder, actor);
      paymentAction = { type: 'nexusEmperorPurchase', event: viewGame(game, actor).nexusEmperorSecretAlly!.event };
    } else if (kind === 'harkonnen-cunning') {
      assert.equal(faction, 'harkonnen');
      if (options.declaredTraitor) {
        game = advanceClassicNexusSkillsPaymentsToPhase(game, 5, actions);
        reserveBoard(game, staging);
        for (const id of [actor, opponent]) {
          const player = classicNexusSkillsPaymentsPlayer(game, id);
          assert.ok(player.reserves - (player.elites?.reserves ?? 0) >= 5);
          player.reserves -= 5; player.forces['pasty_mesa:5'] = 5;
        }
        assert.notEqual(game.storm, 5, 'The actual retained storm must leave Pasty Mesa available');
        staging.push('Conserved five ordinary reserve counters per combatant to Pasty Mesa sector five before genuine Movement completion.');
        const untrained = (id: string) => classicNexusSkillsPaymentsPlayer(game, id).leaders
          .filter(leader => !leader.dead && !game.leaderSkills!.assignments.some(a => a.leader === leader.id));
        const ownLeader = untrained(actor).sort((a, b) => b.strength - a.strength)[0];
        const targetLeader = untrained(opponent).sort((a, b) => a.strength - b.strength)[0];
        assert.ok(ownLeader && targetLeader); declaredIdentity = targetLeader.id;
        holdTraitor(game, actor, declaredIdentity, staging);
        if (options.declaredTraitor === 'decline') {
          const owner = classicNexusSkillsPaymentsPlayer(game, actor);
          const replacement = game.traitorReserve![0];
          owner.traitors[owner.traitors.indexOf(declaredIdentity)] = replacement;
          game.traitorReserve![0] = declaredIdentity;
          staging.push(`Conserved ${declaredIdentity}: exchanged back to the actual next traitor draw for ${replacement}.`);
        }
        game = advanceClassicNexusSkillsPaymentsToPhase(game, 6, actions);
        assert.equal(game.phase, 6);
        const battleActor = game.active!;
        const battleAction: Action = { type: 'chooseBattle', territory: 'pasty_mesa', target: battleActor === actor ? opponent : actor };
        actions.push({ actor: battleActor, action: battleAction }); game = applyAction(game, battleActor, battleAction);
        game = advanceClassicNexusSkillsPayments(game, state => !nextClassicNexusSkillsPaymentsNativeStep(state), actions);
        for (const [id, leader] of [[actor, ownLeader.id], [opponent, targetLeader.id]]) {
          const plan: ClassicNexusSkillsPaymentStep = { actor: id, action: { type: 'battlePlan', dial: 0, support: 0, leader, weapon: null, defense: null } };
          planActions.push(plan); actions.push(plan); game = applyAction(game, id, plan.action);
          while (game.response || game.phaseOpening || game.decision?.kind === 'fullPlanOffer') game = advanceClassicNexusSkillsPaymentsStep(game, actions);
        }
        assert.ok(game.battle?.revealed);
        const call: Action = { type: 'traitorCall', call: options.declaredTraitor === 'call' };
        actions.push({ actor, action: call }); game = applyAction(game, actor, call);
      } else game = advanceClassicNexusSkillsPaymentsToPhase(game, 8, actions);
      const offer = viewGame(game, actor).nexusTraitors!.offer!;
      assert.equal(offer.mode, 'cunning'); assert.equal(offer.blocked, null);
      paymentAction = { type: 'nexusTraitorDraw', event: offer.event, mode: offer.mode };
    } else {
      game = advanceClassicNexusSkillsPaymentsToPhase(game, 4, actions);
      const player = classicNexusSkillsPaymentsPlayer(game, actor);
      const tanks = options.tanks ?? 6, elite = options.eliteTanks ?? 0;
      assert.ok(Number.isInteger(tanks) && tanks >= 0 && elite >= 0 && elite <= tanks);
      assert.ok(tanks - elite <= player.reserves - (player.elites?.reserves ?? 0) && elite <= (player.elites?.reserves ?? 0));
      player.reserves -= tanks; player.tanks += tanks;
      if (player.elites) { player.elites.reserves -= elite; player.elites.tanks += elite; }
      staging.push(`Conserved ${actor}: ${tanks} reserve counters to Tanks, including ${elite} original elites; no earned-revival receipt staged.`);
      const view = viewGame(game, actor);
      paymentAction = { type: kind === 'emperor-revival' ? 'nexusEmperorRevive' : 'nexusFremenRevive',
        event: kind === 'emperor-revival' ? view.nexusEmperorSecretAlly!.event : view.nexusFremenRevival!.event,
        elite: elite ? 1 : 0 };
    }
    classicNexusSkillsPaymentsInventory(game);
    return { initial, afterSetup, beforeFirstMentat, firstMentatStep, afterFirstMentat, beforeClosingDraw,
      closingDraw, afterClosingDraw, beforePayment: structuredClone(game), game, actor, opponent, kind,
      paymentAction, actions, planActions, staging, declaredIdentity };
  });
}

/** Stops at the real private Cunning return instead of silently choosing it. */
export function payClassicNexusSkillsPaymentsFixture(fixture: ClassicNexusSkillsPaymentsFixture, state = fixture.game): Game {
  return applyAction(state, fixture.actor, fixture.paymentAction);
}
export function finishClassicNexusSkillsPaymentsFixture(fixture: ClassicNexusSkillsPaymentsFixture,
  state: Game, returned?: string[]): Game {
  let game = state;
  if (fixture.kind === 'harkonnen-cunning') {
    const pending = viewGame(game, fixture.actor).nexusTraitors!.pending!;
    assert.ok(pending);
    const cards = returned ?? pending.choices.filter(choice => choice.drawn).map(choice => choice.id);
    game = applyAction(game, fixture.actor, { type: 'nexusTraitorReturn', event: pending.event, cards });
  }
  return advanceClassicNexusSkillsPayments(game, current => clean(current) && !current.pendingRevival && !current.nexusTraitorPending);
}
export function classicNexusSkillsPaymentsInventory(game: Game): void {
  nexusInventory(game);
  validateLeaderSkills(game.leaderSkills!, game.players);
  assert.deepEqual([...game.leaderSkills!.deck, ...Object.values(game.leaderSkills!.offers).flatMap(offer => offer.cards),
    ...game.leaderSkills!.assignments.map(a => a.skill)].sort(), LEADER_SKILL_CARDS.map(card => card.id).sort());
  if (game.status !== 'setup')
    assert.deepEqual([...game.traitorReserve!, ...game.players.flatMap(player => player.traitors)].sort(),
      traitorDeck(game.players).sort(), 'Every original traitor identity remains in reserve or actual hand custody');
  for (const player of game.players) if (player.elites)
    assert.equal(player.elites.reserves + player.elites.tanks + Object.values(player.elites.forces).reduce((a, b) => a + b, 0),
      player.faction === 'emperor' ? 5 : 3, 'Original Advanced elite counters are conserved separately');
}
