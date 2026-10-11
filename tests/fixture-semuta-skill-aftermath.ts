import assert from 'node:assert/strict';
import { applyAction, type Action, type Game, type Player } from '../game/engine';
import type { Card } from '../game/cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { initializeSemutaSkillsGame, swapSemutaSkill } from './fixture-semuta-skills';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';

export type SemutaSkillAftermathStep = { actor: string; action: Action };
export type SemutaSkillAftermathOptions = {
  skill?: 'suk-graduate' | 'rihani-decipherer';
  advanced?: boolean;
  tech?: boolean;
  strongholds?: boolean;
};
export type SemutaSkillAftermathFixture = {
  beforeBattle: Game;
  game: Game;
  actions: SemutaSkillAftermathStep[];
  /** Direct replay from beforeBattle to the active mandatory loser offer. */
  battleActions: SemutaSkillAftermathStep[];
  staging: string[];
  inventory: string[];
  skill: 'suk-graduate' | 'rihani-decipherer';
  owner: string;
  opponent: string;
  holder: string;
  trainer: string;
  losingLeader: string;
  key: string;
  weapon: string;
  defense: string;
  losingCard: string;
};
export const reloadSemutaSkillAftermath = (game: Game): Game => JSON.parse(JSON.stringify(game));
export function semutaSkillAftermathPlayer(game: Game, actor: string): Player {
  const player = game.players.find(p => p.id === actor);
  assert.ok(player, `Missing native skill seat ${actor}`);
  return player;
}
export function semutaSkillAftermathInventory(game: Game): string[] {
  const cards = [...game.deck, ...game.discard, ...(game.richeseCache ?? []),
    ...(game.richeseRemoved ?? []), ...game.players.flatMap(p => p.hand)];
  const ids = cards.map(c => c.id).sort();
  assert.equal(new Set(ids).size, ids.length);
  return ids;
}
export function assertSemutaSkillAftermathComponents(game: Game, inventory: string[]): void {
  assert.deepEqual(semutaSkillAftermathInventory(game), inventory);
  validateLeaderSkills(game.leaderSkills!, game.players);
  for (const player of game.players) {
    assert.equal(player.reserves + player.tanks + Object.values(player.forces).reduce((sum, n) => sum + n, 0), 20);
    if (player.elites) {
      assert.equal(player.elites.reserves + player.elites.tanks + Object.values(player.elites.forces).reduce((sum, n) => sum + n, 0), 5);
      for (const [key, amount] of Object.entries(player.elites.forces)) assert.ok(amount <= (player.forces[key] ?? 0));
    }
  }
}

/** Human no-spend/no-call policy at original controls; never manufactures a window. */
export function nextSemutaSkillAftermathStep(game: Game): SemutaSkillAftermathStep | null {
  if (game.pendingTreacheryDiscard?.reaction || game.decision?.kind === 'sukRescue' || game.decision?.kind === 'rihani') return null;
  const decision = game.decision;
  if (!game.phaseOpening && !game.response && decision?.kind === 'leaderSkillVisibility')
    return { actor: decision.player, action: { type: 'leaderSkillVisibility', event: decision.event, hide: true } };
  if (!game.phaseOpening && !game.response && decision?.kind === 'mentatQuestion')
    return { actor: decision.player, action: { type: 'decision', event: decision.event, decline: true } };
  return nextRicheseStrongholdsNativeStep(game);
}
function advance(game: Game, until: (game: Game) => boolean, actions: SemutaSkillAftermathStep[]): Game {
  for (let count = 0; count < 1200; count++) {
    if (until(game)) return game;
    assert.equal(game.turn, 1);
    const next = nextSemutaSkillAftermathStep(game);
    assert.ok(next, 'Stop at an original human skill, Semuta or private-plan control');
    actions.push(next);
    game = applyAction(game, next.actor, next.action);
  }
  throw new Error('Native Semuta skill aftermath did not reach its requested control');
}
function take(game: Game, actor: string, matches: (card: Card) => boolean, staging: string[]): string {
  for (const [source, zone] of [['deck', game.deck], ['discard', game.discard], ['Richese cache', game.richeseCache ?? []],
    ...game.players.map(p => [p.id, p.hand] as const)] as const) {
    const index = zone.findIndex(matches);
    if (index < 0) continue;
    const card = zone.splice(index, 1)[0];
    semutaSkillAftermathPlayer(game, actor).hand.push(card);
    staging.push(`Conserved physical ${card.id}: ${source} → ${actor} hand`);
    return card.id;
  }
  throw new Error('Required original physical Treachery Card is unavailable');
}

/** Genuine native all14 setup and training, then actual first Storm/Bidding/Movement.
 * Only skill identity, unplayed Spice Card order and conserved physical positions
 * are staged. Phases, wallets, leader strength, outcomes and module owners are not. */
export function createSemutaSkillAftermathFixture(options: SemutaSkillAftermathOptions = {}): SemutaSkillAftermathFixture {
  const skill = options.skill ?? 'suk-graduate', owner = 'e', opponent = 'a', holder = 'r';
  const advanced = options.advanced ?? false, tech = options.tech ?? false, strongholds = options.strongholds ?? false;
  assert.ok(advanced || !strongholds);
  let game = initializeSemutaSkillsGame(advanced, tech, strongholds);
  const actions: SemutaSkillAftermathStep[] = [], staging: string[] = [];
  const trainer = swapSemutaSkill(game, owner, skill);
  staging.push(`Conserved ${skill} exchanged into ${owner}'s genuinely trained living ${trainer}; original assignment/disc retained`);
  const inventory = semutaSkillAftermathInventory(game);
  // Prevent an incidental worm/alliance program; every unplayed card stays in its deck.
  for (const [position, card] of game.spiceDeck.filter(c => 'territory' in c).slice(0, 2).entries())
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(game.spiceDeck.indexOf(card), 1)[0]);
  staging.push('Conserved first two unplayed non-worm Spice Cards ordered first in native deck');
  const clean = (state: Game) => !state.phaseOpening && !state.response && !state.decision;
  game = advance(game, state => state.phase === 5 && clean(state), actions);
  for (const player of game.players) {
    game.deck.push(...player.hand); player.hand = [];
    player.reserves += Object.values(player.forces).reduce((sum, n) => sum + n, 0); player.forces = {};
    if (player.elites) {
      player.elites.reserves += Object.values(player.elites.forces).reduce((sum, n) => sum + n, 0);
      player.elites.forces = {};
    }
  }
  const key = 'arrakeen:10';
  assert.notEqual(game.storm, 10);
  for (const actor of [owner, opponent]) {
    const player = semutaSkillAftermathPlayer(game, actor);
    assert.ok(player.reserves >= 8);
    player.reserves -= 8; player.forces[key] = 8;
  }
  const emperor = semutaSkillAftermathPlayer(game, owner);
  if (advanced) {
    assert.ok(emperor.elites && emperor.elites.reserves >= 2);
    emperor.elites.reserves -= 2; emperor.elites.forces[key] = 2;
  }
  staging.push(advanced
    ? 'Conserved board through own reserves; Emperor stages six ordinary/two elite and Atreides eight ordinary at Arrakeen'
    : 'Conserved board through own reserves; both Basic combatants stage eight ordinary counters at Arrakeen');
  game = advance(game, state => state.phase === 6 && clean(state), actions);
  const weapon = take(game, owner, c => c.kind === (skill === 'suk-graduate' ? 'projectile' : 'artillery'), staging);
  const defense = take(game, owner, c => c.kind === 'shield', staging);
  const losingCard = take(game, opponent, c => c.kind === 'worthless', staging);
  take(game, holder, c => c.id === SEMUTA_DRUG_ID, staging);
  const assigned = new Set(game.leaderSkills!.assignments.map(a => a.leader));
  const losingLeader = semutaSkillAftermathPlayer(game, opponent).leaders.filter(l => !assigned.has(l.id) && !l.dead && !l.usedAt)
    .sort((a, b) => a.strength - b.strength)[0];
  assert.ok(losingLeader);
  assertSemutaSkillAftermathComponents(game, inventory);
  const beforeBattle = structuredClone(game);
  const battleStart = actions.length;
  assert.ok(game.active === owner || game.active === opponent);
  const choose: SemutaSkillAftermathStep = { actor: game.active!, action: { type: 'chooseBattle', territory: 'arrakeen', target: game.active === owner ? opponent : owner } };
  actions.push(choose); game = applyAction(game, choose.actor, choose.action);
  game = advance(game, state => !!state.battle && !state.battle.preparation && state.battle.preLeader?.closed === true && clean(state), actions);
  for (const next of [
    { actor: owner, action: { type: 'battlePlan', leader: trainer, dial: 4, support: advanced ? 4 : 0, weapon, defense } },
    { actor: opponent, action: { type: 'battlePlan', leader: losingLeader.id, dial: 0, support: 0, weapon: losingCard } },
  ] satisfies SemutaSkillAftermathStep[]) {
    actions.push(next); game = applyAction(game, next.actor, next.action);
    if (game.response || game.decision?.kind === 'fullPlanOffer')
      game = advance(game, state => !state.response && state.decision?.kind !== 'fullPlanOffer', actions);
  }
  game = advance(game, state => state.pendingTreacheryDiscard?.reaction?.stage === 'offer', actions);
  assert.equal(game.pendingTreacheryDiscard!.continuation.kind, 'battleResolved');
  assert.equal(game.lastBattleContext!.winner, owner);
  return { beforeBattle, game, actions, battleActions: actions.slice(battleStart),
    staging, inventory, skill, owner, opponent, holder,
    trainer, losingLeader: losingLeader.id, key, weapon, defense, losingCard };
}

export function passSemutaSkillAftermath(game: Game): Game {
  const pending = game.pendingTreacheryDiscard;
  assert.equal(pending?.reaction?.stage, 'offer');
  const event = pending!.batch.event;
  const reaction = pending!.reaction; assert.ok(reaction?.stage === 'offer');
  for (const player of game.players) if (!reaction.passed.includes(player.id))
    game = applyAction(game, player.id, { type: 'semutaPass', event });
  return game;
}
export function claimSemutaSkillAftermath(game: Game, holder: string, card: string): Game {
  const event = game.pendingTreacheryDiscard!.batch.event;
  assert.ok(game.pendingTreacheryDiscard!.batch.entries.some(entry => entry.card.id === card));
  game = applyAction(game, holder, { type: 'semutaCommit', event });
  if (game.pendingTreacheryDiscard?.reaction?.stage === 'select')
    game = applyAction(reloadSemutaSkillAftermath(game), holder, { type: 'semutaSelect', event, card });
  assert.ok(semutaSkillAftermathPlayer(game, holder).hand.some(held => held.id === card));
  return game;
}
/** Select the original typed four-ordinary/zero-elite casualty allocation. */
export function allocateSemutaSkillAftermathLosses(game: Game): Game {
  if (game.decision?.kind !== 'battleLosses') return game;
  const choice = game.decision.options.findIndex(o => o.normal === 4 && o.elite === 0);
  assert.ok(choice >= 0);
  return applyAction(game, game.decision.player, { type: 'decision', choice });
}
/** Complete only original post-skill winner cleanup/reward, not Collection. */
export function finishSemutaSkillAftermath(game: Game): Game {
  for (let count = 0; count < 100; count++) {
    if (!game.pendingTreacheryDiscard && !game.decision && !game.response && !game.battle) return game;
    if (game.pendingTreacheryDiscard?.reaction) game = passSemutaSkillAftermath(game);
    else {
      const next = nextSemutaSkillAftermathStep(game); assert.ok(next);
      game = applyAction(game, next.actor, next.action);
    }
  }
  throw new Error('Original post-skill cleanup did not complete');
}
