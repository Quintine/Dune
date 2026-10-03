import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeLeaderSkillsGameForAudit, initializeSpiceBankerIncomeGameForAudit,
  joinGame, newPlayer, viewGame, type Action, type Game, type Player,
} from '../game/engine';
import { TERRITORIES } from '../game/board';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { createTechTokens } from '../game/tech-tokens';
import { nextSkillsTechBattleStep, openSkillsTechBattle } from './fixture-skills-tech-battle';
import { advanceSkillsTechPaymentsToPhase, skillsTechPaymentsEmptyDestination } from './fixture-skills-tech-payments';

export type IxChoamSkillsTechOptions = {
  /** Fresh authenticated undealt lobby. Seat IDs, order and native offers survive. */
  initial?: Game;
  family?: 'ixians' | 'choam';
  advanced?: boolean;
  kind?: 'shipment' | 'suk-battle' | 'charity';
  band?: 'normal' | 'skilled';
  amount?: number;
  elite?: number;
  smuggler?: boolean;
  /** Separate normal-income audit opt-in; needs an actual Atreides seat. */
  bankerIncome?: boolean;
};
export type IxChoamSkillsTechStep = { actor: string; action: Action };
export type IxChoamSkillsTechFixture = {
  setup: Game;
  game: Game;
  actions: IxChoamSkillsTechStep[];
  family: 'ixians' | 'choam';
  kind: 'shipment' | 'suk-battle' | 'charity';
  actor: string;
  owner: string;
  opponent: string;
  banker?: string;
  trainer: string;
  action: Action;
  opponentPlan?: Action;
  beforeCharityIncome?: Game;
  afterCharityIncome?: Game;
  key?: string;
  cost: number;
  amount: number;
  elite: number;
  band: 'normal' | 'skilled';
};

export function ixChoamSkillsTechPlayer(game: Game, id: string): Player {
  const player = game.players.find(p => p.id === id);
  assert.ok(player);
  return player;
}

/** Control only the first all14 shuffle. Native offers are dealt in retained seat
 * order; subsequent Traitor, treachery and Tech randomness remains original. */
function withOffers<T>(selected: LeaderSkillId[], initialize: () => T): T {
  const cards: LeaderSkillId[] = LEADER_SKILL_CARDS.map(card => card.id);
  const remaining = cards.filter(card => !selected.includes(card));
  const desired = selected.flatMap(skill => [skill, remaining.shift()!]);
  desired.push(...remaining);
  const working = [...cards];
  const rolls: number[] = [];
  for (let i = working.length - 1; i > 0; i--) {
    const j = working.indexOf(desired[i]);
    assert.ok(j >= 0 && j <= i);
    rolls.push(Math.floor(((j + 0.5) / (i + 1)) * 0x100000000));
    [working[i], working[j]] = [working[j], working[i]];
  }
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto);
  let index = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (index < rolls.length) {
      assert.ok(array instanceof Uint32Array && array.length === 1);
      array[0] = rolls[index++];
    } else Reflect.apply(original, crypto, [array]);
    return array;
  };
  try { return initialize(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Native continuation only; decline optional substitution so it cannot conceal
 * Suk's reserve/Tanks result. Human snapshots stop before this policy runs. */
export function nextIxChoamSkillsTechStep(game: Game): IxChoamSkillsTechStep {
  if (game.decision?.kind === 'ixSubstitution')
    return { actor: game.decision.player, action: { type: 'decision', decline: true } };
  return nextSkillsTechBattleStep(game);
}
function step(game: Game, actions?: IxChoamSkillsTechStep[]): Game {
  const next = nextIxChoamSkillsTechStep(game);
  actions?.push(next);
  return applyAction(game, next.actor, next.action);
}
function act(game: Game, actor: string, action: Action, actions: IxChoamSkillsTechStep[]): Game {
  actions.push({ actor, action });
  return applyAction(game, actor, action);
}

export function initializeIxChoamSkillsTechSetup(options: IxChoamSkillsTechOptions = {}): Game {
  const family = options.family ?? 'ixians';
  const expansion = family === 'ixians' ? 'ix' : 'choam';
  let game = options.initial ? structuredClone(options.initial)
    : createGame('IXCHOAMSKILLTECH', newPlayer('native', family, family), options.advanced ?? false, [expansion]);
  if (!options.initial) {
    joinGame(game, newPlayer('emperor', 'Emperor', 'emperor'));
    joinGame(game, newPlayer('fremen', 'Fremen', 'fremen'));
    if (options.bankerIncome) joinGame(game, newPlayer('banker', 'Banker', 'atreides'));
  }
  assert.equal(game.status, 'lobby', 'Only the original fresh undealt lobby is accepted.');
  assert.ok(game.expansions.includes(expansion));
  assert.ok(game.players.length >= 3 && game.players.length <= 6);
  if (options.advanced !== undefined) assert.equal(game.advanced, options.advanced);
  assert.ok(game.players.some(p => p.faction === family));
  assert.ok(game.players.some(p => p.faction === 'emperor'));
  if (options.bankerIncome) assert.ok(game.players.some(p => p.faction === 'atreides'));
  if (!game.techTokens) game = applyAction(game, game.host, { type: 'techTokens', enabled: true });
  assert.deepEqual(game.techTokens, createTechTokens());
  for (const p of game.players) if (!p.ready) game = applyAction(game, p.id, { type: 'ready' });
  const passive: LeaderSkillId[] = ['warmaster', 'swordmaster-of-ginaz', 'killer-medic', 'prana-bindu-adept', 'master-of-assassins', 'planetologist'];
  const selected = game.players.map(p => p.faction === family
    ? options.kind === 'suk-battle' ? 'suk-graduate' : 'smuggler'
    : options.bankerIncome && p.faction === 'atreides' ? 'spice-banker' : passive.shift()!);
  return withOffers(selected, () => options.bankerIncome
    ? initializeSpiceBankerIncomeGameForAudit(game) : initializeLeaderSkillsGameForAudit(game));
}

export function completeIxChoamSkillsTechSetup(state: Game, options: IxChoamSkillsTechOptions = {}, actions?: IxChoamSkillsTechStep[]): Game {
  let game = state;
  for (let i = 0; game.status === 'setup' && i < 200; i++) {
    if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0];
      const offer = game.leaderSkills!.offers[actor];
      const view = viewGame(game, actor).leaderSkills!;
      const faction = ixChoamSkillsTechPlayer(game, actor).faction;
      const skill = faction === (options.family ?? 'ixians')
        ? options.kind === 'suk-battle' ? 'suk-graduate' : 'smuggler'
        : options.bankerIncome && faction === 'atreides' ? 'spice-banker' : offer.cards[0];
      assert.ok(offer.cards.includes(skill) && !view.unavailableSkills?.[skill]);
      const eligible = new Set(view.eligibleLeaders.map(l => l.id));
      const leader = ixChoamSkillsTechPlayer(game, actor).leaders.filter(l => eligible.has(l.id))
        .sort((a, b) => b.strength - a.strength)[0];
      assert.ok(leader && leader.id !== 'choam-auditor');
      const action: Action = { type: 'leaderSkill', event: offer.event, skill, leader: leader.id };
      actions?.push({ actor, action });
      game = applyAction(game, actor, action);
    } else game = step(game, actions);
  }
  assert.equal(game.status, 'playing');
  return game;
}

/** Original setup, first Storm and phase history. Only unplayed Spice Card
 * order and (for battle) conserved board/hand custody are controlled. No wallet,
 * token owner, phase, turn, plan or earned receipt is assigned. */
export function createIxChoamSkillsTechFixture(options: IxChoamSkillsTechOptions = {}): IxChoamSkillsTechFixture {
  const family = options.family ?? 'ixians';
  const kind = options.kind ?? 'shipment';
  assert.ok(kind !== 'charity' || family === 'choam');
  const band = options.band ?? 'skilled';
  const actions: IxChoamSkillsTechStep[] = [];
  const setup = initializeIxChoamSkillsTechSetup(options);
  let game = completeIxChoamSkillsTechSetup(setup, options, actions);
  const owner = game.players.find(p => p.faction === family)!.id;
  const opponent = game.players.find(p => p.faction === 'emperor')!.id;
  const banker = options.bankerIncome ? game.players.find(p => p.faction === 'atreides')!.id : undefined;
  const trainer = game.leaderSkills!.assignments.find(a => a.owner === owner)!.leader;
  // Four conserved non-worm cards avoid optional riders during the two-turn
  // charity continuation. They are not asserted to be a natural shuffle history.
  const blows = game.spiceDeck.filter(card => 'territory' in card).slice(0, 4);
  for (let i = 0; i < blows.length; i++) {
    const index = game.spiceDeck.indexOf(blows[i]);
    game.spiceDeck.splice(i, 0, game.spiceDeck.splice(index, 1)[0]);
  }
  game = advanceSkillsTechPaymentsToPhase(game, 5, actions);
  if (family === 'ixians') assert.equal(game.techTokens!.heighliners.owner, owner);
  if (kind === 'suk-battle') {
    // Explicit physical battle rule position: return board counters/cards to
    // native reserves/deck, then place eight counters (two Ix cyborgs).
    for (const p of game.players) {
      game.deck.push(...p.hand); p.hand = [];
      p.reserves += Object.values(p.forces).reduce((sum, n) => sum + n, 0); p.forces = {};
      if (p.elites) {
        p.elites.reserves += Object.values(p.elites.forces).reduce((sum, n) => sum + n, 0);
        p.elites.forces = {};
      }
      if (p.advisors) p.advisors = {};
    }
    const territory = TERRITORIES.find(t => t.type === 'sand' && !t.sectors.includes(game.storm));
    assert.ok(territory);
    const key = `${territory.id}:${territory.sectors[0]}`;
    for (const id of [owner, opponent]) {
      const p = ixChoamSkillsTechPlayer(game, id);
      assert.ok(p.reserves >= 8); p.reserves -= 8; p.forces[key] = 8;
    }
    if (family === 'ixians') {
      const p = ixChoamSkillsTechPlayer(game, owner);
      p.elites!.reserves -= 2; p.elites!.forces[key] = 2;
    }
    const shield = game.deck.findIndex(card => card.kind === 'shield');
    assert.ok(shield >= 0);
    const defense = game.deck.splice(shield, 1)[0];
    ixChoamSkillsTechPlayer(game, owner).hand.push(defense);
    game = advanceSkillsTechPaymentsToPhase(game, 6, actions);
    game = openSkillsTechBattle(game, owner, opponent, territory.id, band === 'skilled');
    const untrained = (id: string, strongest: boolean) => ixChoamSkillsTechPlayer(game, id).leaders
      .filter(l => !l.dead && l.id !== 'choam-auditor' && !game.leaderSkills!.assignments.some(a => a.leader === l.id))
      .sort((a, b) => strongest ? b.strength - a.strength : a.strength - b.strength)[0].id;
    const dial = game.advanced && family === 'ixians' ? 5 : 4;
    const support = game.advanced ? family === 'ixians' ? 1 : 4 : 0;
    return { setup, game, actions, family, kind, actor: owner, owner, opponent, banker, trainer, key,
      action: { type: 'battlePlan', leader: band === 'skilled' ? trainer : untrained(owner, true), dial, support, defense: defense.id },
      opponentPlan: { type: 'battlePlan', leader: untrained(opponent, false), dial: 0, support: 0 },
      cost: support, amount: 8, elite: family === 'ixians' ? 2 : 0, band };
  }
  const actor = kind === 'charity' ? opponent : owner;
  for (let i = 0; game.active !== actor && i < 30; i++) game = step(game, actions);
  assert.equal(game.active, actor);
  const amount = kind === 'charity' ? 5 : options.amount ?? 5;
  const elite = kind === 'charity' ? 0 : options.elite ?? (family === 'ixians' ? 2 : 0);
  let target: { territory: string; sector: number };
  if (kind === 'charity') {
    const territory = TERRITORIES.find(t => t.type === 'sand' && !t.sectors.includes(game.storm)
      && game.players.every(p => Object.entries(p.forces).every(([key, n]) => !n || !key.startsWith(`${t.id}:`)))
      && t.sectors.every(s => !game.spice[`${t.id}:${s}`])
      && blows.every(card => !('territory' in card) || card.territory !== t.id));
    assert.ok(territory); target = { territory: territory.id, sector: territory.sectors[0] };
    game = act(game, actor, { type: 'ship', ...target, amount, elite }, actions);
    for (let i = 0; (game.response || game.decision || game.pendingShipment) && i < 200; i++) game = step(game, actions);
    // Actual ten-spice desert invoice exhausts Emperor's original bank wallet.
    // Any native Heighliners payout can add at most one; no Collection at this pile.
    const counter = game.deck.findIndex(card => card.effect === 'karama');
    assert.ok(counter >= 0);
    ixChoamSkillsTechPlayer(game, actor).hand.push(game.deck.splice(counter, 1)[0]);
    let beforeCharityIncome: Game | undefined;
    let afterCharityIncome: Game | undefined;
    for (let i = 0; (game.turn !== 2 || game.phase !== 2 || game.phaseOpening || game.response || game.decision)
      && game.status === 'playing' && i < 2000; i++) {
      if (game.turn === 2 && game.response?.kind === 'choamCharity' && !beforeCharityIncome)
        beforeCharityIncome = structuredClone(game);
      game = step(game, actions);
      if (beforeCharityIncome && !afterCharityIncome && game.response?.kind !== 'choamCharity')
        afterCharityIncome = structuredClone(game);
    }
    assert.ok(beforeCharityIncome && afterCharityIncome);
    assert.equal(game.turn, 2); assert.equal(game.phase, 2);
    assert.ok(ixChoamSkillsTechPlayer(game, actor).spice < 2);
    return { setup, game, actions, family, kind, actor, owner, opponent, banker, trainer,
      action: { type: 'charity' }, cost: 10, amount: 2 - ixChoamSkillsTechPlayer(game, actor).spice,
      elite: 0, band, key: `${target.territory}:${target.sector}`, beforeCharityIncome, afterCharityIncome };
  }
  target = skillsTechPaymentsEmptyDestination(game);
  const smuggler = options.smuggler !== false;
  return { setup, game, actions, family, kind, actor, owner, opponent, banker, trainer,
    action: { type: 'ship', ...target, amount, elite, ...(smuggler ? { smuggler: true } : {}) },
    cost: amount - (smuggler ? 1 : 0), amount, elite, band, key: `${target.territory}:${target.sector}` };
}

/** Settle native response/arrival windows, or stop at the real Suk choice. */
export function settleIxChoamSkillsTech(state: Game, stopAtSuk = false): Game {
  let game = state;
  for (let i = 0; i < 300; i++) {
    if (stopAtSuk && (game.decision?.kind === 'sukRescue' ||
      game.decision?.kind === 'battleCards' && game.lastBattleContext?.sukRescue?.completed)) return game;
    if (!game.response && !game.decision && !game.pendingShipment && !game.battle && !game.pendingTreacheryDiscard) return game;
    if (game.decision?.kind === 'battleLosses') {
      const options = game.decision.options;
      const choice = options.findIndex(o => o.elite === 2);
      assert.ok(choice >= 0);
      game = applyAction(game, game.decision.player, { type: 'decision', choice });
    } else game = step(game);
  }
  throw new Error('Original Ix/CHOAM continuation did not settle.');
}
