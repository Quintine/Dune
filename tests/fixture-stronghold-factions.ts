import assert from 'node:assert/strict';
import { applyAction, createGame, initializeStrongholdFactionsGameForAudit, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { MOBILE_LOCATION, MOBILE_STRONGHOLD, territory } from '../game/board';
import { isAuditorLeader, type Card } from '../game/cards';
import type { FactionId } from '../game/catalog';
import { STRONGHOLD_CARDS, strongholdControllers, type StrongholdId } from '../game/stronghold-cards';
import { quoteBattleResolution, type BattleResolutionQuote, type ResolutionCombatant } from '../game/battle-resolution-quote';

export type StrongholdFactionsNativeStep = { actor: string; action: Action };
export type StrongholdFactionsFixtureOptions = {
  initial?: Game;
  seatIds?: string[];
  kind?: StrongholdId;
  copy?: StrongholdId;
  copyChoices?: 0 | 1 | 2;
  ownerFaction?: FactionId;
  attackerIsOwner?: boolean;
  ownerDial?: number;
  opponentDial?: number;
  support?: number;
  opponentSupport?: number;
  allyPayment?: number;
  choamFunding?: number;
  ownerSpice?: number;
  ownerLeader?: 'auditor';
  ownerWeapon?: Card['kind'];
  ownerDefense?: Card['kind'];
  opponentWeapon?: Card['kind'];
  opponentDefense?: Card['kind'];
  traitors?: 'owner' | 'both';
  counter?: boolean;
  mobileRoute?: string[];
};
export type StrongholdFactionsSourceFacts = {
  event: string;
  turn: number;
  territory: StrongholdId;
  attacker: string;
  defender: string;
  owner: string;
  copyChoices: StrongholdId[];
  cardOwners: Record<StrongholdId, string | null>;
  currentControllers: Record<StrongholdId, string | null>;
  physicalForces: { player: string; forces: Record<string, number>; eliteForces: Record<string, number> }[];
};
export type StrongholdFactionsFixture = {
  initial: Game;
  afterSetup: Game;
  beforeFirstMentat: Game;
  firstMentatStep: StrongholdFactionsNativeStep;
  afterFirstMentat: Game;
  beforeBattle: Game;
  battleAction: Action;
  actor: string;
  owner: string;
  opponent: string;
  choam: string;
  game: Game;
  event: string;
  kind: StrongholdId;
  copyAction: Action | null;
  fundingAction: StrongholdFactionsNativeStep | null;
  planActions: StrongholdFactionsNativeStep[];
  staging: string[];
  sourceFacts: StrongholdFactionsSourceFacts;
};
const seat = (game: Game, id: string) => {
  const player = game.players.find(p => p.id === id);
  assert.ok(player, `Missing original seat ${id}`);
  return player;
};
const key = (id: StrongholdId) => id === MOBILE_STRONGHOLD ? MOBILE_LOCATION : `${id}:${territory(id).sectors[0]}`;

/** Only consumes actual native decisions. A null result with a live battle means
 * a human must seal a plan; the helper never reads or invents that private plan. */
export function nextStrongholdFactionsNativeStep(game: Game): StrongholdFactionsNativeStep | null {
  if (game.status === 'finished') return null;
  if (game.pendingTreacheryDiscard) return { actor: game.host, action: { type: 'advanceBots' } };
  if (game.phaseOpening) {
    const actor = game.players.find(p => !game.phaseOpening!.passed.includes(p.id))?.id;
    assert.ok(actor);
    return { actor, action: { type: 'ready' } };
  }
  if (game.response) {
    // The persisted pass queue defines legality; a policy recommendation is not a legal-action menu.
    const actor = game.players.find(player => !game.response!.passed.includes(player.id))?.id;
    assert.ok(actor, `No remaining original response at ${game.response.kind}`);
    return { actor, action: { type: 'passResponse' } };
  }
  const decision = game.decision;
  if (decision) {
    const actor = decision.player;
    if (decision.kind === 'ixSetup') return { actor, action: { type: 'decision', card: game.ixSetupCards![0].id } };
    if (decision.kind === 'mobileStronghold') return { actor, action: decision.placement ? { type: 'decision', location: 'polar_sink:0' } : { type: 'decision', decline: true } };
    if (decision.kind === 'ixTechnology' || decision.kind === 'ixSubstitution' || decision.kind === 'captureOffer' || decision.kind === 'fullPlanOffer' || decision.kind === 'choamTradeReply')
      return { actor, action: { type: 'decision', decline: true, ...(decision.kind === 'captureOffer' ? { accept: false } : {}) } };
    if (decision.kind === 'choamMarket') return { actor, action: { type: 'decision', done: true } };
    if (decision.kind === 'choamFreeRevival') return { actor, action: { type: 'decision', decline: true } };
    if (decision.kind === 'choamBattleFunding') return { actor, action: { type: 'decision', amount: 0 } };
    if (decision.kind === 'strongholdCopy') return { actor, action: { type: 'decision', event: decision.event, stronghold: decision.choices[0] } };
    if (decision.kind === 'auctionPayment') return { actor, action: { type: 'decision', karama: false } };
    if (decision.kind === 'guildShipment') return { actor, action: { type: 'decision', allow: true } };
    if (decision.kind === 'poisonTooth') return { actor, action: { type: 'decision', activate: true } };
    if (decision.kind === 'battleLosses') return { actor, action: { type: 'decision', choice: 0 } };
    if (decision.kind === 'battleCards') return { actor, action: { type: 'decision', discard: [] } };
    if (decision.kind === 'choamAudit') return { actor, action: { type: 'decision', event: decision.event, audit: false } };
    if (decision.kind === 'choamAuditPayment') return { actor, action: { type: 'decision', event: decision.event, pay: false } };
  }
  if (game.battle?.preLeader && !game.battle.preLeader.closed) {
    const actor = [game.battle.attacker, game.battle.defender].find(id => !game.battle!.preLeader!.ready.includes(id));
    if (actor) return { actor, action: { type: 'battlePreparationReady', event: game.battle.event } };
  }
  if (game.battle?.preparation) return { actor: game.battle.preparation.owner, action: { type: 'declineBattlePower' } };
  if (game.battle?.revealed) {
    const actor = viewGame(game, game.host).battle!.traitorVoters.find(id => game.battle!.traitorCalls[id] === undefined);
    if (actor) return { actor, action: { type: 'traitorCall', call: false } };
  }
  if (game.battle && !game.battle.revealed && !game.decision) return null;
  if (game.status === 'playing' && !game.decision) {
    if (game.phase === 0 && game.stormPending === null) {
      const actor = game.stormDialers.find(id => game.stormDials[id] === undefined);
      if (actor) return { actor, action: { type: 'stormDial', amount: 0 } };
    }
    if (game.phase === 3 && game.auction) return { actor: game.auction.active, action: { type: 'passBid' } };
    if (game.phase === 5) return { actor: game.active!, action: { type: 'endMovement' } };
    if (game.phase !== 6 || !game.active) {
      const actor = game.players.find(p => !game.ready.includes(p.id))?.id;
      if (actor) return { actor, action: { type: 'ready' } };
    }
  }
  for (const player of game.players) {
    if (decision && decision.player !== player.id) continue;
    const view = viewGame(game, player.id);
    view.players.find(p => p.id === player.id)!.bot = 'Easy';
    const actions = botActions(view);
    const action = actions.find(a => a.type === 'ready') ?? actions[0];
    if (action) return { actor: player.id, action };
  }
  throw Error(`No native Stronghold continuation at ${game.status}/${game.turn}/${game.phase}/${decision?.kind}`);
}
function step(game: Game): Game {
  const next = nextStrongholdFactionsNativeStep(game);
  assert.ok(next, 'Native continuation stopped for an unsealed human plan');
  return applyAction(game, next.actor, next.action);
}
function advance(game: Game, predicate: (state: Game) => boolean): Game {
  for (let count = 0; count < 1800; count++) {
    if (predicate(game)) return game;
    assert.equal(game.status, 'playing');
    game = step(game);
  }
  throw Error('Native Stronghold phase did not reach its requested boundary');
}
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision;

/** Determinism is scoped only to the original native initializer. Saved decks,
 * offers and native remainder shuffles are never reordered or redealt. */
function initialize(game: Game): Game {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    assert.ok(array);
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(255);
    return array;
  };
  try { return initializeStrongholdFactionsGameForAudit(game); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
/** Canonical conserved staging, never hand replacement or face manufacture. */
function heldCard(game: Game, actor: string, matches: (card: Card) => boolean, staging: string[], excluded: string[] = []): Card {
  const player = seat(game, actor);
  const held = player.hand.find(card => matches(card) && !excluded.includes(card.id));
  if (held) return held;
  const index = game.deck.findIndex(card => matches(card) && !excluded.includes(card.id));
  assert.ok(index >= 0, 'The required canonical card is neither held nor in the remaining native deck');
  const card = game.deck.splice(index, 1)[0];
  assert.ok(player.hand.length < (player.faction === 'harkonnen' ? 8 : player.faction === 'choam' ? 5 : 4));
  player.hand.push(card);
  staging.push(`Conserved ${card.id}: remaining native deck → ${actor}'s hand`);
  return card;
}
/** Return board counters to their own reserves without changing subtype totals. */
function reserveBoard(game: Game): void {
  for (const player of game.players) {
    player.reserves += Object.values(player.forces).reduce((sum, count) => sum + count, 0);
    player.forces = {};
    if (player.elites) {
      player.elites.reserves += Object.values(player.elites.forces).reduce((sum, count) => sum + count, 0);
      player.elites.forces = {};
    }
    if (player.advisors) player.advisors = {};
  }
}
function place(game: Game, actor: string, location: string, count: number, elite = 0): void {
  const player = seat(game, actor);
  assert.ok(player.reserves >= count && count >= elite && (player.elites?.reserves ?? 0) >= elite);
  player.reserves -= count;
  player.forces[location] = (player.forces[location] ?? 0) + count;
  if (elite) {
    player.elites!.reserves -= elite;
    player.elites!.forces[location] = (player.elites!.forces[location] ?? 0) + elite;
  }
}
function conserveTraitor(game: Game, actor: string, identity: string, staging: string[]): void {
  const player = seat(game, actor);
  if (player.traitors.includes(identity)) return;
  const returned = player.traitors[0];
  assert.ok(returned);
  const index = game.traitorReserve?.indexOf(identity) ?? -1;
  const donor = game.players.find(p => p.id !== actor && p.traitors.includes(identity));
  assert.ok(index >= 0 || donor, 'Requested canonical traitor retains native reserve or hand custody');
  if (index >= 0) game.traitorReserve!.splice(index, 1, returned);
  else donor!.traitors[donor!.traitors.indexOf(identity)] = returned;
  player.traitors[0] = identity;
  staging.push(`Conserved traitor ${identity}: native ${donor?.id ?? 'reserve'} custody exchanged with ${actor}'s ${returned}`);
}

/** Genuine Advanced native setup, first full turn and actual END Mentat custody.
 * Only labeled conserved board/card/bank positions are staged. Never assign
 * owners, phases, source receipts, quotations, pending windows or responses. */
export function createStrongholdFactionsFixture(options: StrongholdFactionsFixtureOptions = {}): StrongholdFactionsFixture {
  const kind = options.kind ?? MOBILE_STRONGHOLD;
  const staging: string[] = [];
  let game: Game;
  if (options.initial) {
    game = structuredClone(options.initial);
    assert.ok(game.status === 'lobby' || game.status === 'setup' && game.turn === 1 && game.phase === 0 && game.players.every(p => p.hand.length === 0), 'Continue only the original fresh undealt CLI setup');
    assert.equal(game.advanced, true);
    assert.deepEqual([...game.expansions].sort(), ['choam', 'ix']);
    assert.ok(game.players.some(p => p.faction === 'ixians') && game.players.some(p => p.faction === 'choam'));
  } else {
    const ids = options.seatIds ?? ['ix', 'choam', 'guild'];
    assert.ok(ids.length >= 2 && ids.length <= 6 && new Set(ids).size === ids.length);
    const factions: FactionId[] = ['ixians', 'choam', 'guild', 'emperor', 'fremen', 'harkonnen'];
    game = createGame('STRONGHOLDFACTIONS', newPlayer(ids[0], 'Ixians', factions[0]), true, ['ix', 'choam']);
    for (let index = 1; index < ids.length; index++) joinGame(game, newPlayer(ids[index], factions[index], factions[index]));
  }
  if (game.status === 'lobby') {
    for (const player of game.players) if (!player.ready) game = applyAction(game, player.id, { type: 'ready' });
    game = initialize(game);
  }
  const initial = structuredClone(game);
  assert.equal(game.strongholdCards!.claimedTurn, 0);
  assert.ok(Object.values(game.strongholdCards!.owners).every(owner => owner === null));
  for (let count = 0; game.status === 'setup' && count < 200; count++) game = step(game);
  assert.equal(game.status, 'playing');
  const afterSetup = structuredClone(game);
  const ix = game.players.find(p => p.faction === 'ixians')!.id;
  const choam = game.players.find(p => p.faction === 'choam')!.id;
  const owner = game.players.find(p => p.faction === (options.ownerFaction ?? 'ixians'))?.id;
  assert.ok(owner, 'Requested owner must be an original native seat');
  const opponent = game.players.find(p => p.id !== owner && p.id !== choam)?.id ?? game.players.find(p => p.id !== owner)!.id;
  if (options.choamFunding || options.allyPayment) assert.ok(owner !== choam && opponent !== choam, 'Native donor needs a separate CHOAM seat');
  // Select real first dials, not the storm field. A later 1..6 native storm
  // cannot obstruct this test's single printed battle sector.
  for (let count = 0; !(game.phase === 8 && clean(game)) && count < 1600; count++) {
    const next = nextStrongholdFactionsNativeStep(game); assert.ok(next);
    if (next.action.type === 'stormDial' && game.turn === 1) next.action.amount = kind === 'tueks_sietch' || kind === 'habbanya_ridge_sietch' ? 4 : 0;
    game = applyAction(game, next.actor, next.action);
  }
  assert.equal(game.phase, 8); assert.equal(game.turn, 1);
  reserveBoard(game);
  staging.push('Before actual first END Mentat: relocate existing physical counters through their own reserves; nobody controls three strongholds');
  place(game, ix, MOBILE_LOCATION, 6, 3);
  const firstCopy = options.copy && options.copy !== MOBILE_STRONGHOLD ? options.copy : 'arrakeen';
  if (kind === MOBILE_STRONGHOLD) {
    if (owner !== ix) {
      reserveBoard(game);
      place(game, owner, MOBILE_LOCATION, 6);
    }
    place(game, owner, key(firstCopy), 1);
  } else place(game, owner, key(kind), 1);
  const occupied = new Set([kind, MOBILE_STRONGHOLD, ...(kind === MOBILE_STRONGHOLD ? [firstCopy] : [])]);
  const others = game.players.filter(p => p.id !== owner && p.id !== ix);
  for (const [index, card] of STRONGHOLD_CARDS.filter(card => !occupied.has(card.id)).entries()) {
    const recipient = others[Math.floor(index / 2)];
    if (recipient) place(game, recipient.id, key(card.id), 1);
  }
  // Keep every first-turn owner below the solo victory threshold.
  for (const player of game.players) assert.ok(Object.keys(player.forces).length <= 2);
  let beforeFirstMentat: Game | undefined;
  let firstMentatStep: StrongholdFactionsNativeStep | undefined;
  for (let count = 0; game.turn === 1 && count < 200; count++) {
    const next = nextStrongholdFactionsNativeStep(game); assert.ok(next);
    const before = structuredClone(game);
    game = applyAction(game, next.actor, next.action);
    if (game.turn === 2) { beforeFirstMentat = before; firstMentatStep = next; }
  }
  assert.ok(beforeFirstMentat && firstMentatStep);
  assert.equal(game.status, 'playing'); assert.equal(game.strongholdCards!.claimedTurn, 1);
  assert.equal(game.strongholdCards!.owners[kind], owner);
  const afterFirstMentat = structuredClone(game);
  if (options.mobileRoute) {
    game = advance(game, state => state.decision?.kind === 'mobileStronghold');
    assert.equal(game.decision?.kind, 'mobileStronghold');
    game = applyAction(game, ix, { type: 'decision', route: options.mobileRoute, collect: false });
  }
  if (options.choamFunding || options.allyPayment) {
    game = advance(game, state => state.phase === 1 && clean(state) && !state.spiceSequence && !state.spiceResolution && !state.spiceWindow && !state.nexus);
    const thumperActor = game.players.find(player => player.hand.some(card => card.effect === 'thumper'))?.id ?? owner;
    const thumper = heldCard(game, thumperActor, card => card.effect === 'thumper', staging);
    game = applyAction(game, thumperActor, { type: 'card', card: thumper.id });
    game = advance(game, state => state.nexus && clean(state) && !state.spiceWindow && !state.spiceResolution);
    game = applyAction(game, owner, { type: 'alliance', target: choam });
    game = applyAction(game, choam, { type: 'alliance', target: owner });
    assert.equal(seat(game, owner).ally, choam);
  }
  game = advance(game, state => state.phase === 5 && clean(state));
  reserveBoard(game);
  staging.push('Before native turn-two movement completion: conserve six battle counters per combatant and current copy-control counters; retain actual first-Mentat card custody');
  for (const id of [owner, opponent]) place(game, id, key(kind), 6, seat(game, id).faction === 'ixians' ? 3 : 0);
  if (kind !== MOBILE_STRONGHOLD && ix !== owner && ix !== opponent) place(game, ix, MOBILE_LOCATION, 6, 3);
  if (kind === MOBILE_STRONGHOLD) {
    const choices = options.copyChoices ?? 2;
    if (choices) place(game, owner, key(firstCopy), 1);
    if (choices === 2) place(game, owner, key(firstCopy === 'sietch_tabr' ? 'arrakeen' : 'sietch_tabr'), 1);
  }
  for (const player of game.players) {
    player.spice = player.id === owner ? options.ownerSpice ?? 20 : 20;
  }
  staging.push('Bank funding staging: original seats receive explicit twenty-spice test balances (ownerSpice may set the affordability boundary); no aid or support receipt is injected');
  const used: string[] = [];
  const card = (actor: string, type: Card['kind'] | undefined) => {
    if (!type) return null;
    const selected = heldCard(game, actor, c => c.kind === type, staging, used);
    used.push(selected.id); return selected.id;
  };
  const ownerWeapon = card(owner, options.ownerWeapon);
  const ownerDefense = card(owner, options.ownerDefense);
  const opponentWeapon = card(opponent, options.opponentWeapon);
  const opponentDefense = card(opponent, options.opponentDefense);
  if (options.counter) heldCard(game, opponent, c => c.effect === 'karama', staging);
  const ownerLeader = seat(game, owner).leaders.find(l => options.ownerLeader === 'auditor' ? isAuditorLeader(l) : !isAuditorLeader(l) && l.strength === 5)
    ?? seat(game, owner).leaders.find(l => !isAuditorLeader(l));
  const opponentLeader = seat(game, opponent).leaders.find(l => !isAuditorLeader(l) && l.strength === (options.ownerLeader === 'auditor' ? 2 : ownerLeader!.strength))
    ?? seat(game, opponent).leaders.find(l => !isAuditorLeader(l));
  assert.ok(ownerLeader && opponentLeader);
  if (options.ownerLeader === 'auditor') assert.ok(isAuditorLeader(ownerLeader), 'The actual native CHOAM Auditor is required');
  if (options.traitors) {
    conserveTraitor(game, owner, opponentLeader.id, staging);
    if (options.traitors === 'both') conserveTraitor(game, opponent, ownerLeader.id, staging);
  }
  // Finish genuine movement; the battle queue determines its real chooser.
  game = advance(game, state => state.phase === 6 && clean(state));
  const beforeBattle = structuredClone(game);
  const actor = game.active!;
  assert.ok([owner, opponent].includes(actor));
  if (options.attackerIsOwner !== undefined) assert.equal(actor === owner, options.attackerIsOwner, 'Native storm order decides physical attacker; this option does not rewrite it');
  const battleAction: Action = { type: 'chooseBattle', territory: kind, target: actor === owner ? opponent : owner };
  game = applyAction(game, actor, battleAction);
  for (let count = 0; count < 120; count++) {
    if (game.decision?.kind === 'strongholdCopy') break;
    const next = nextStrongholdFactionsNativeStep(game);
    if (!next) break;
    if (game.decision?.kind === 'choamBattleFunding') next.action.amount = options.choamFunding ?? 0;
    game = applyAction(game, next.actor, next.action);
  }
  assert.ok(game.battle?.event && !game.battle.revealed);
  const copyAction: Action | null = game.decision?.kind === 'strongholdCopy' ? { type: 'decision', event: game.decision.event, stronghold: options.copy ?? firstCopy } : null;
  const planActions: StrongholdFactionsNativeStep[] = [
    { actor: owner, action: { type: 'battlePlan', dial: options.ownerDial ?? 0, support: options.support ?? 0, allyPayment: options.allyPayment ?? 0, leader: ownerLeader.id, weapon: ownerWeapon, defense: ownerDefense } },
    { actor: opponent, action: { type: 'battlePlan', dial: options.opponentDial ?? 0, support: options.opponentSupport ?? 0, leader: opponentLeader.id, weapon: opponentWeapon, defense: opponentDefense } },
  ];
  const fundingAction: StrongholdFactionsNativeStep | null = options.choamFunding || options.allyPayment ? { actor: choam, action: { type: 'decision', amount: options.choamFunding ?? options.allyPayment ?? 0 } } : null;
  const currentControllers = strongholdControllers(game.players, !!game.mobileStronghold?.location);
  const sourceFacts: StrongholdFactionsSourceFacts = {
    event: game.battle.event, turn: game.turn, territory: kind,
    attacker: game.battle.attacker, defender: game.battle.defender, owner,
    copyChoices: STRONGHOLD_CARDS.filter(card => card.id !== MOBILE_STRONGHOLD && currentControllers[card.id] === owner).map(card => card.id),
    cardOwners: { ...game.strongholdCards!.owners }, currentControllers,
    physicalForces: game.players.map(player => ({ player: player.id, forces: { ...player.forces }, eliteForces: { ...player.elites?.forces } })),
  };
  return { initial, afterSetup, beforeFirstMentat, firstMentatStep, afterFirstMentat, beforeBattle, battleAction, actor, owner, opponent, choam, game, event: game.battle.event, kind, copyAction, fundingAction, planActions, staging, sourceFacts };
}

/** Independent shared quote on the actual revealed source, including native
 * subtype pools, donor escrow, bounty and bank income as separate legs. */
export function quoteStrongholdFactionsBattle(game: Game): BattleResolutionQuote {
  const battle = game.battle; assert.ok(battle?.revealed);
  const side = (actor: string): ResolutionCombatant => {
    const player = seat(game, actor), view = viewGame(game, actor).battle!;
    const aid = player.ally ? game.aid[player.ally] : undefined;
    assert.ok(view.ownForces);
    return { id: actor, faction: player.faction, ally: player.ally, spice: player.spice, hand: player.hand,
      plan: battle.plans[actor], leader: player.leaders.find(l => l.id === battle.plans[actor].leader),
      forces: view.ownForces, stronghold: view.strongholdEffects[actor], poisonTooth: battle.poisonTooth?.[actor],
      lateDefense: battle.lateDefense?.[actor], stoneMode: battle.stoneBurner?.[actor],
      ...(aid?.recipient === actor ? { aid: { donor: player.ally!, amount: aid.amount } } : {}) };
  };
  return quoteBattleResolution({ advanced: game.advanced, turn: game.turn, territory: battle.territory,
    aggressor: viewGame(game, game.host).battle!.aggressor,
    attacker: side(battle.attacker), defender: side(battle.defender),
    voters: viewGame(game, game.host).battle!.traitorVoters.map(actor => ({ id: actor,
      beneficiary: [battle.attacker, battle.defender].includes(actor) ? actor : seat(game, actor).ally!,
      called: battle.traitorCalls[actor] ?? false, traitors: seat(game, actor).traitors })),
    participants: game.players, physicalCards: [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand)],
    pendingAuditorPresent: !!game.pendingAuditor, pendingRetentionPresent: false });
}

export type StrongholdFactionsBattleQuote = BattleResolutionQuote;
