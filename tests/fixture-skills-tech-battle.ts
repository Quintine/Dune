import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeLeaderSkillsGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game, type Player,
} from '../game/engine';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { createTechTokens, ownedTech } from '../game/tech-tokens';
import { TERRITORIES } from '../game/board';
import type { Card } from '../game/cards';
import { nextSpiceBankerIncomeNativeStep } from './fixture-spice-banker-income';

export type SkillsTechBattleStep = { actor: string; action: Action };

export type SkillsTechBattleOptions = {
  /** A fresh authenticated, undealt classic lobby; its seat IDs are retained. */
  initial?: Game;
  advanced?: boolean;
  skill?: 'suk-graduate' | 'sandmaster';
  band?: 'normal' | 'skilled';
  /** Selection/absence are earned by a real preceding battle, never staged ownership. */
  reward?: 'automatic' | 'selection' | 'absent';
};
export type SkillsTechBattleFixture = {
  game: Game;
  owner: string;
  opponent: string;
  trainer: string;
  territory: string;
  key: string;
  weapon: string;
  defense: string;
  losingCard: string;
  losingLeader: string;
  ownerPlan: Action;
  opponentPlan: Action;
  band: 'normal' | 'skilled';
  skill: 'suk-graduate' | 'sandmaster';
  reward: 'automatic' | 'selection' | 'absent';
};

export function skillsTechBattlePlayer(game: Game, id: string): Player {
  const player = game.players.find(p => p.id === id);
  assert.ok(player);
  return player;
}

function withSkillOffer<T>(skill: SkillsTechBattleFixture['skill'], slot: number, initialize: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto);
  const target = LEADER_SKILL_CARDS.findIndex(card => card.id === skill);
  let index = LEADER_SKILL_CARDS.length - 1;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (index <= 0) return Reflect.apply(original, crypto, [array]) as V;
    assert.ok(array instanceof Uint32Array && array.length === 1);
    const swap = index === Math.max(target, slot) ? Math.min(target, slot) : index;
    array[0] = swap === index ? 0xffffffff : Math.ceil(swap * 0x100000000 / (index + 1));
    index--;
    return array;
  };
  try { return initialize(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Native policy, with deliberate no-call/no-spend decisions at original windows. */
export function nextSkillsTechBattleStep(game: Game): SkillsTechBattleStep {
  if (game.decision?.kind === 'battleCards')
    return { actor: game.decision.player, action: { type: 'decision', discard: [] } };
  if (game.decision?.kind === 'techToken')
    return { actor: game.decision.player, action: { type: 'decision', token: game.decision.choices[0] } };
  if (!game.decision && !game.response && game.battle?.preLeader?.closed === false) {
    const battle = game.battle;
    const actor = battle.preLeader!.ready.includes(battle.attacker) ? battle.defender : battle.attacker;
    return { actor, action: { type: 'battlePreparationReady', event: battle.preLeader!.event } };
  }
  const next = nextSpiceBankerIncomeNativeStep(game);
  assert.ok(next);
  return next;
}
function step(game: Game): Game {
  const next = nextSkillsTechBattleStep(game);
  return applyAction(game, next.actor, next.action);
}
function reachPhase(state: Game, target: number): Game {
  let game = state;
  for (let i = 0; (game.phase !== target || game.phaseOpening || game.response || game.decision) && i < 1000; i++) {
    assert.equal(game.turn, 1);
    game = step(game);
  }
  assert.equal(game.phase, target);
  assert.ok(!game.phaseOpening && !game.response && !game.decision);
  return game;
}
function untrained(game: Game, player: Player, strongest: boolean) {
  const trained = new Set(game.leaderSkills!.assignments.map(a => a.leader));
  const leader = player.leaders.filter(l => !trained.has(l.id) && !l.dead && !l.usedAt)
    .sort((a, b) => strongest ? b.strength - a.strength : a.strength - b.strength)[0];
  assert.ok(leader);
  return leader;
}
function held(game: Game, player: Player, predicate: (card: Card) => boolean): string {
  const index = game.deck.findIndex(predicate);
  assert.ok(index >= 0, 'Conserved physical card must remain in the actual deck.');
  const card = game.deck.splice(index, 1)[0];
  player.hand.push(card);
  return card.id;
}

/** Fresh original setup/first Storm/Tech assignment. Only the initial skill offer,
 * unplayed Spice Card order and conserved battle board/cards are controlled.
 * Wallets, phases, turn, plans, receipts and Tech owners are never fabricated.
 * The optional preliminary battle earns a second token or leaves no token.
 * Its second, already-present conflict keeps the genuine Battle phase open. */
export function createSkillsTechBattleFixture(options: SkillsTechBattleOptions = {}): SkillsTechBattleFixture {
  const skill = options.skill ?? 'suk-graduate';
  const band = options.band ?? 'skilled';
  const reward = options.reward ?? 'automatic';
  assert.ok(skill !== 'sandmaster' || band === 'skilled', 'Sandmaster victory uses its lower band.');
  let game: Game;
  if (options.initial) game = structuredClone(options.initial);
  else {
    game = createGame('SKILLSTECHBATTLE', newPlayer('guild', 'Guild', 'guild'), options.advanced ?? false);
    joinGame(game, newPlayer('emperor', 'Emperor', 'emperor'));
    joinGame(game, newPlayer('beneGesserit', 'Bene Gesserit', 'beneGesserit'));
  }
  assert.equal(game.status, 'lobby');
  assert.ok(game.players.length >= 3 && game.players.length <= 6);
  assert.equal(game.expansions.length, 0);
  if (options.advanced !== undefined) assert.equal(game.advanced, options.advanced);
  const owner = game.players.find(p => p.faction === 'guild');
  const opponent = game.players.find(p => p.faction === 'emperor');
  assert.ok(owner && opponent, 'Authenticated lobby needs Guild and Emperor seats.');
  if (!game.techTokens) game.techTokens = createTechTokens();
  assert.deepEqual(game.techTokens, createTechTokens());
  for (const p of game.players) if (!p.ready) game = applyAction(game, p.id, { type: 'ready' });
  game = withSkillOffer(skill, game.players.findIndex(p => p.id === owner.id) * 2,
    () => initializeLeaderSkillsGameForAudit(game));
  for (let i = 0; game.status === 'setup' && i < 200; i++) {
    if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0];
      const offer = game.leaderSkills!.offers[actor];
      const view = viewGame(game, actor).leaderSkills!;
      const selected = actor === owner.id ? skill : offer.cards.find(c => !view.unavailableSkills?.[c]);
      assert.ok(selected && offer.cards.includes(selected) && !view.unavailableSkills?.[selected]);
      const eligible = new Set(view.eligibleLeaders.map(leader => leader.id));
      const leader = skillsTechBattlePlayer(game, actor).leaders.filter(l => eligible.has(l.id))
        .sort((a, b) => b.strength - a.strength)[0];
      assert.ok(leader);
      game = applyAction(game, actor, { type: 'leaderSkill', event: offer.event, skill: selected, leader: leader.id });
    } else game = step(game);
  }
  assert.equal(game.status, 'playing');
  // Arrange two real, unplayed non-worm blows; the first supplies the battle pile.
  for (const [position, territory] of [[0, 'hagga_basin'], [1, 'funeral_plain']] as const) {
    const index = game.spiceDeck.findIndex((card, i) => i >= position && 'territory' in card && card.territory === territory);
    assert.ok(index >= position);
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
  }
  game = reachPhase(game, 5);
  const winner = skillsTechBattlePlayer(game, owner.id);
  const enemy = skillsTechBattlePlayer(game, opponent.id);
  const territory = 'hagga_basin';
  const key = `${territory}:12`;
  assert.ok(game.spice[key] > 0 && !TERRITORIES.find(t => t.id === territory)!.sectors.includes(game.storm));
  // Return every board/card counter to its original physical reserve/deck.
  for (const p of game.players) {
    game.deck.push(...p.hand); p.hand = [];
    p.reserves += Object.values(p.forces).reduce((sum, n) => sum + n, 0); p.forces = {};
    if (p.elites) {
      p.elites.reserves += Object.values(p.elites.forces).reduce((sum, n) => sum + n, 0);
      p.elites.forces = {};
    }
    if (p.advisors) p.advisors = {};
  }
  for (const p of [winner, enemy]) {
    assert.ok(p.reserves - (p.elites?.reserves ?? 0) >= 10);
    p.reserves -= 8; p.forces[key] = 8;
  }
  let supportTerritory: string | undefined;
  if (reward !== 'automatic') {
    const desert = TERRITORIES.find(t => t.type === 'sand' && t.id !== territory && !t.sectors.includes(game.storm));
    assert.ok(desert);
    supportTerritory = desert.id;
    for (const p of [winner, enemy]) { p.reserves -= 2; p.forces[`${desert.id}:${desert.sectors[0]}`] = 2; }
  }
  game = reachPhase(game, 6);
  if (supportTerritory) {
    game = openSkillsTechBattle(game, winner.id, enemy.id, supportTerritory, true);
    const firstWinner = skillsTechBattlePlayer(game, reward === 'selection' ? enemy.id : winner.id);
    const firstLoser = skillsTechBattlePlayer(game, reward === 'selection' ? winner.id : enemy.id);
    const winLeader = untrained(game, firstWinner, true);
    const loseLeader = untrained(game, firstLoser, false);
    assert.ok(winLeader.strength > loseLeader.strength);
    game = applyAction(game, firstWinner.id, { type: 'battlePlan', leader: winLeader.id, dial: 0, support: 0 });
    game = applyAction(game, firstLoser.id, { type: 'battlePlan', leader: loseLeader.id, dial: 0, support: 0 });
    game = finishSkillsTechBattle(game, 'complete');
    assert.equal(game.phase, 6);
    assert.equal(game.lastBattleContext!.winner, firstWinner.id);
    assert.equal(ownedTech(game.techTokens, enemy.id).length, reward === 'selection' ? 2 : 0);
  }
  const trainer = game.leaderSkills!.assignments.find(a => a.owner === winner.id && a.skill === skill)!.leader;
  const selectedLeader = band === 'skilled' ? trainer : untrained(game, skillsTechBattlePlayer(game, winner.id), true).id;
  const losingLeader = untrained(game, skillsTechBattlePlayer(game, enemy.id), false).id;
  const weapon = held(game, skillsTechBattlePlayer(game, winner.id), card => card.kind === 'projectile');
  const defense = held(game, skillsTechBattlePlayer(game, winner.id), card => card.kind === 'shield');
  const losingCard = held(game, skillsTechBattlePlayer(game, enemy.id), card => card.kind === 'worthless');
  return {
    game, owner: winner.id, opponent: enemy.id, trainer, territory, key, weapon, defense, losingCard, losingLeader,
    ownerPlan: { type: 'battlePlan', leader: selectedLeader, dial: 4, support: game.advanced ? 4 : 0, weapon, defense },
    opponentPlan: { type: 'battlePlan', leader: losingLeader, dial: 0, support: 0, weapon: losingCard },
    skill, band, reward,
  };
}

/** Stop at actual private plan controls after original visibility/preparation. */
export function openSkillsTechBattle(state: Game, owner: string, opponent: string, territory: string, hide = true): Game {
  assert.ok(state.active === owner || state.active === opponent);
  let game = applyAction(state, state.active!, { type: 'chooseBattle', territory, target: state.active === owner ? opponent : owner });
  for (let i = 0; (game.response || game.decision || game.battle?.preparation || game.battle?.preLeader?.closed === false) && i < 100; i++) {
    if (game.decision?.kind === 'leaderSkillVisibility')
      game = applyAction(game, game.decision.player, { type: 'leaderSkillVisibility', event: game.decision.event, hide: game.decision.player === owner ? hide : true });
    else game = step(game);
  }
  assert.ok(game.battle && !game.response && !game.decision);
  return game;
}

/** Resolve calls/mandatory cleanup, stopping BEFORE the requested native choice.
 * complete means this battle's reward is complete, not that the game is over. */
export function finishSkillsTechBattle(state: Game, stop: 'skill' | 'cleanup' | 'tech' | 'complete' = 'complete'): Game {
  let game = state;
  for (let i = 0; i < 200; i++) {
    if (stop === 'skill' && game.decision?.kind === 'sukRescue') return game;
    if ((stop === 'skill' || stop === 'cleanup') && game.decision?.kind === 'battleCards') return game;
    if (stop === 'tech' && game.decision?.kind === 'techToken') return game;
    if (!game.battle && !game.response && !game.decision && !game.pendingTreacheryDiscard) return game;
    if (game.decision?.kind === 'sukRescue') {
      const decision = game.decision;
      const maximum = Math.max(...decision.options.map(o => o.normal + o.elite));
      const choice = decision.options.findIndex(o => o.normal + o.elite === maximum);
      game = applyAction(game, decision.player, { type: 'decision', event: decision.event, choice });
    } else game = step(game);
  }
  throw new Error('Native skills/Tech battle aftermath did not settle.');
}
