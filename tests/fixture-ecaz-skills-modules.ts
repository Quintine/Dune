import assert from 'node:assert/strict';
import { applyAction, createGame, handLimit, joinGame, newPlayer, viewGame, type Action, type Game, type Player } from '../game/engine';
import { territory } from '../game/board';
import { leaders, treacheryDeck, type Card } from '../game/cards';
import type { FactionId } from '../game/catalog';
import { DUKE_VIDAL_ID } from '../game/duke-vidal';
import { validateAmbassadors } from '../game/ecaz-ambassadors';
import type { LeaderSkillId } from '../game/leader-skill-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import type { StrongholdId } from '../game/stronghold-cards';
import { traitorDeck } from '../game/traitors';
import { initializeAdvancedNativeSkillsSetup } from './fixture-advanced-native-skills';
import { nextStrongholdFactionsNativeStep, type StrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type EcazSkillsModulesOptions = {
  /** Only an original undealt authenticated lobby; preserve its IDs and order. */
  initial?: Game;
  rules?: 'basic' | 'advanced';
  tech?: boolean;
  stronghold?: boolean;
  kind?: 'suk' | 'duke' | 'income';
  skill?: LeaderSkillId;
  band?: 'normal' | 'skilled';
  strongholdKind?: Exclude<StrongholdId, 'hidden_mobile_stronghold'>;
  /** Separate existing native Banker income opt-in, not a skill-module default. */
  bankerIncome?: boolean;
  poison?: boolean;
  defense?: boolean;
  opponentDial?: number;
};
export type EcazSkillsModulesFixture = {
  initial: Game; offered: Game; afterSetup: Game;
  beforeFirstMentat: Game; firstMentatStep: StrongholdFactionsNativeStep; afterFirstMentat: Game;
  acquisition: { before: Game; after: Game; actions: StrongholdFactionsNativeStep[] } | null;
  beforeBattle: Game; game: Game;
  owner: string; opponent: string; trainer: string;
  territory: Exclude<StrongholdId, 'hidden_mobile_stronghold'>; location: string;
  plans: StrongholdFactionsNativeStep[]; actions: StrongholdFactionsNativeStep[]; staging: string[];
};
export const reloadEcazSkillsModules = (g: Game): Game => JSON.parse(JSON.stringify(g)) as Game;
export const ecazSkillsModulesAction = (g: Game, actor: string, action: Action): Game =>
  applyAction(reloadEcazSkillsModules(g), actor, action);
export function ecazSkillsModulesPlayer(game: Game, actor: string): Player {
  const player = game.players.find(p => p.id === actor); assert.ok(player); return player;
}
export const ecazSkillsModulesTrainer = (game: Game, owner: string) => {
  const assignment = game.leaderSkills!.assignments.find(a => a.owner === owner); assert.ok(assignment); return assignment;
};
export function assertEcazSkillsModulesCustody(game: Game): void {
  validateLeaderSkills(game.leaderSkills!, game.players);
  for (const p of game.players) {
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0), 20, p.faction);
    if (p.elites) {
      assert.equal(p.elites.reserves + p.elites.tanks + Object.values(p.elites.forces).reduce((a, b) => a + b, 0), p.faction === 'fremen' ? 3 : 5, p.faction);
      for (const [location, n] of Object.entries(p.elites.forces)) assert.ok(n <= (p.forces[location] ?? 0));
    }
    assert.deepEqual(p.leaders.map(l => l.id).sort(), leaders(p.faction).map(l => l.id).sort());
  }
  const physical = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.auction?.cards.slice(game.auction.index) ?? [])];
  assert.deepEqual(physical.map(c => c.id).sort(), treacheryDeck(['ecaz']).map(c => c.id).sort());
  const traitors = [...game.traitorReserve!, ...game.players.flatMap(p => [...p.traitors, ...p.traitorChoices]),
    ...(game.ecazLoyalty?.card ? [game.ecazLoyalty.card] : [])];
  assert.deepEqual(traitors.sort(), traitorDeck(game.players).sort());
  assert.equal(game.players.find(p => p.faction === 'ecaz')!.leaders.length, 5);
  assert.equal(game.dukeVidal!.leader.id, DUKE_VIDAL_ID);
  assert.equal(game.dukeVidal!.leader.strength, 6);
  assert.ok(game.leaderSkills!.assignments.every(a => a.leader !== DUKE_VIDAL_ID));
  validateAmbassadors(game.ecazAmbassadors!);
}
const clean = (g: Game) => !g.response && !g.phaseOpening && !g.decision;
/** Responses always precede decisions: consume the original persisted pass queue. */
export function nextEcazSkillsModulesStep(game: Game, hide = true): StrongholdFactionsNativeStep | null {
  if (game.response || game.phaseOpening || game.pendingTreacheryDiscard)
    return nextStrongholdFactionsNativeStep(game);
  const d = game.decision;
  if (d?.kind === 'ecazPlacement' || d?.kind === 'ecazAmbassador')
    return { actor: d.player, action: { type: 'decision', decline: true } };
  if (d?.kind === 'leaderSkillVisibility') return { actor: d.player,
    action: { type: 'leaderSkillVisibility', event: d.event, hide } };
  if (d?.kind === 'mentatQuestion') return { actor: d.player, action: { type: 'decision', event: d.event, decline: true } };
  if (d?.kind === 'rihani') return { actor: d.player, action: { type: 'decision', event: d.event, draw: false } };
  if (d?.kind === 'sukRescue') {
    const maximum = Math.max(...d.options.map(o => o.normal + o.elite));
    const choice = d.options.findIndex(o => o.normal + o.elite === maximum && o.kept?.kind === 'normal');
    return { actor: d.player, action: { type: 'decision', event: d.event,
      choice: choice >= 0 ? choice : d.options.findIndex(o => o.normal + o.elite === maximum) } };
  }
  if (d?.kind === 'techToken') return { actor: d.player, action: { type: 'decision', token: d.choices[0] } };
  return nextStrongholdFactionsNativeStep(game);
}
function step(game: Game, next: StrongholdFactionsNativeStep, actions?: StrongholdFactionsNativeStep[]): Game {
  actions?.push(structuredClone(next));
  return ecazSkillsModulesAction(game, next.actor, next.action);
}
export function advanceEcazSkillsModules(state: Game, until: (g: Game) => boolean,
  actions?: StrongholdFactionsNativeStep[], hide = true, firstDial = 0): Game {
  let game = state;
  for (let i = 0; i < 1800; i++) {
    if (until(game)) return game;
    assert.equal(game.status, 'playing');
    const next = nextEcazSkillsModulesStep(game, hide); assert.ok(next, 'An original private plan needs its actual owner.');
    if (game.turn === 1 && next.action.type === 'stormDial') next.action.amount = firstDial;
    game = step(game, next, actions);
  }
  throw Error('Original Ecaz skill/module chronology did not reach its boundary.');
}
function reserveBoard(game: Game): void {
  for (const p of game.players) {
    p.reserves += Object.values(p.forces).reduce((a, b) => a + b, 0); p.forces = {};
    if (p.elites) { p.elites.reserves += Object.values(p.elites.forces).reduce((a, b) => a + b, 0); p.elites.forces = {}; }
    if (p.advisors) p.advisors = {};
  }
}
function place(game: Game, actor: string, location: string, count: number): void {
  const p = ecazSkillsModulesPlayer(game, actor); assert.ok(p.reserves >= count);
  p.reserves -= count; p.forces[location] = (p.forces[location] ?? 0) + count;
}
function take(game: Game, actor: string, predicate: (c: Card) => boolean, staging: string[]): Card {
  const p = ecazSkillsModulesPlayer(game, actor), held = p.hand.find(predicate);
  if (held) return held;
  const index = game.deck.findIndex(predicate); assert.ok(index >= 0 && p.hand.length < handLimit(p));
  const card = game.deck.splice(index, 1)[0]; p.hand.push(card);
  staging.push(`Conserved ${card.id}: original remaining Ecaz33 deck to ${actor}'s hand.`); return card;
}
/** Original Ecaz33/all14 setup and first Storm assignment, then actual first END
 * Mentat. Only physical offer order, conserved native cards/board and unplayed
 * non-worm Spice Cards are staged. No phase, turn, storm, wallet, owner or receipt
 * is assigned, and no allied Occupy, E3 pair or overlay module is admitted. */
export function createEcazSkillsModulesFixture(options: EcazSkillsModulesOptions = {}): EcazSkillsModulesFixture {
  const rules = options.rules ?? (options.initial?.advanced === false ? 'basic' : 'advanced');
  const tech = options.tech ?? true, stronghold = options.stronghold ?? rules === 'advanced';
  const kind = options.kind ?? 'suk', band = options.band ?? (kind === 'suk' ? 'skilled' : 'normal');
  const requested = options.skill ?? (kind === 'duke' ? 'warmaster' : kind === 'income' ? 'spice-banker' : 'suk-graduate');
  const strongholdKind = options.strongholdKind ?? 'arrakeen';
  const location = `${strongholdKind}:${territory(strongholdKind).sectors[0]}`;
  let game = options.initial ? structuredClone(options.initial)
    : createGame('ECAZSKILLSMODULES', newPlayer('ecaz', 'Ecaz', 'ecaz'), rules === 'advanced', ['ecaz']);
  if (!options.initial) for (const faction of ['emperor', 'atreides'] as FactionId[]) joinGame(game, newPlayer(faction, faction, faction));
  assert.equal(game.status, 'lobby', 'Only the original undealt authenticated lobby may be continued.');
  assert.equal(game.advanced, rules === 'advanced'); assert.deepEqual(game.expansions, ['ecaz']);
  assert.ok(game.players.length >= 2 && game.players.length <= 6 && (!tech || game.players.length >= 3));
  assert.ok(!stronghold || game.advanced);
  assert.ok(game.players.every(p => p.faction === 'ecaz' || ['atreides', 'emperor', 'guild', 'fremen', 'beneGesserit', ...(game.advanced ? [] : ['harkonnen'])].includes(p.faction)));
  const owner = game.players.find(p => p.faction === 'ecaz')?.id, opponent = game.players.find(p => p.faction === 'emperor')?.id;
  assert.ok(owner && opponent);
  if (!!game.techTokens !== tech) game = applyAction(game, game.host, { type: 'techTokens', enabled: tech });
  if (!!game.strongholdCards !== stronghold) game = applyAction(game, game.host, { type: 'strongholdCards', enabled: stronghold });
  const initial = structuredClone(game), actions: StrongholdFactionsNativeStep[] = [], staging: string[] = [];
  game = initializeAdvancedNativeSkillsSetup({ family: 'ecaz', rules, requestedSkill: requested, bankerIncome: options.bankerIncome, initial: game });
  const offered = structuredClone(game);
  for (let i = 0; game.status === 'setup' && i < 200; i++) {
    if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0], offer = game.leaderSkills!.offers[actor];
      const own = viewGame(game, actor).leaderSkills!;
      const skill = actor === owner ? requested : offer.cards.find(c => !own.unavailableSkills?.[c]);
      const eligible = new Set(own.eligibleLeaders.map(l => l.id));
      const leader = ecazSkillsModulesPlayer(game, actor).leaders.filter(l => eligible.has(l.id)).sort((a, b) => b.strength - a.strength)[0];
      assert.ok(skill && offer.cards.includes(skill) && !own.unavailableSkills?.[skill] && leader);
      game = step(game, { actor, action: { type: 'leaderSkill', event: offer.event, skill, leader: leader.id } }, actions);
    } else { const next = nextEcazSkillsModulesStep(game); assert.ok(next); game = step(game, next, actions); }
  }
  assert.equal(game.status, 'playing');
  const afterSetup = structuredClone(game), trainer = ecazSkillsModulesTrainer(game, owner).leader;
  reserveBoard(game);
  const blows = game.spiceDeck.filter(c => 'territory' in c).slice(0, 6);
  for (const [index, card] of blows.entries()) game.spiceDeck.splice(index, 0, game.spiceDeck.splice(game.spiceDeck.indexOf(card), 1)[0]);
  staging.push('After original setup, return every native board counter to its own reserve; order only six existing unplayed non-worm Spice Cards, not a claimed random history.');
  const firstDial = ['tueks_sietch', 'habbanya_ridge_sietch'].includes(strongholdKind) ? 4 : 0;
  game = advanceEcazSkillsModules(game, g => g.phase === 8 && clean(g), actions, true, firstDial);
  reserveBoard(game); place(game, owner, location, 1);
  staging.push(`Before actual first END Mentat, transfer one Ecaz counter from its reserve to ${location}; no seat controls three holds.`);
  let beforeFirstMentat: Game | undefined, firstMentatStep: StrongholdFactionsNativeStep | undefined;
  for (let i = 0; game.turn === 1 && i < 200; i++) {
    const next = nextEcazSkillsModulesStep(game); assert.ok(next);
    const before = structuredClone(game); game = step(game, next, actions);
    if (game.turn === 2) { beforeFirstMentat = before; firstMentatStep = next; }
  }
  assert.ok(beforeFirstMentat && firstMentatStep);
  if (stronghold) assert.equal(game.strongholdCards!.owners[strongholdKind], owner);
  const afterFirstMentat = structuredClone(game);
  let acquisition: EcazSkillsModulesFixture['acquisition'] = null;
  if (kind === 'duke') {
    game = advanceEcazSkillsModules(game, g => g.phase === 4 && clean(g), actions);
    reserveBoard(game);
    game = advanceEcazSkillsModules(game, g => g.decision?.kind === 'ecazPlacement', actions);
    const before = structuredClone(game), acquisitionActions: StrongholdFactionsNativeStep[] = [];
    const token = game.ecazAmbassadors!.tokens.find(t => t.effect === 'ecaz')!;
    game = step(game, { actor: owner, action: { type: 'decision', token: token.id, territory: strongholdKind } }, acquisitionActions);
    game = advanceEcazSkillsModules(game, g => !g.response && g.decision?.kind === 'ecazPlacement', acquisitionActions);
    game = step(game, { actor: owner, action: { type: 'decision', decline: true } }, acquisitionActions);
    game = advanceEcazSkillsModules(game, g => g.phase === 5 && clean(g) && g.active === opponent, acquisitionActions);
    game = step(game, { actor: opponent, action: { type: 'ship', territory: strongholdKind, sector: territory(strongholdKind).sectors[0], amount: 1 } }, acquisitionActions);
    game = advanceEcazSkillsModules(game, g => !g.response && g.decision?.kind === 'ecazAmbassador', acquisitionActions);
    assert.equal(viewGame(game, owner).ambassadorEntry!.dukeAcquisition!.blocked, null);
    game = step(game, { actor: owner, action: { type: 'decision', event: game.pendingAmbassador!.event,
      trigger: true, beneficiary: owner, choice: 'duke' } }, acquisitionActions);
    assert.equal(game.dukeVidal!.controller, owner);
    actions.push(...acquisitionActions); acquisition = { before, after: structuredClone(game), actions: acquisitionActions };
    staging.push('Original paid Ambassador placement and entrant shipment acquire the separate Duke6; no controller assignment or skill reassignment.');
  } else game = advanceEcazSkillsModules(game, g => g.phase === 5 && clean(g), actions);
  reserveBoard(game);
  for (const actor of [owner, opponent]) place(game, actor, location, 8);
  for (const p of game.players) { game.deck.push(...p.hand); p.hand = []; }
  staging.push(`Before real turn-two Movement completes, conserve eight ordinary counters per combatant at ${location}; return original hands to the same native deck before physical transfers.`);
  const worthless = take(game, owner, c => c.kind === 'worthless', staging);
  const shield = options.defense ? take(game, owner, c => c.kind === 'shield', staging) : undefined;
  const poison = options.poison ? take(game, opponent, c => c.kind === 'poison', staging) : undefined;
  game = advanceEcazSkillsModules(game, g => g.phase === 6 && clean(g), actions);
  const beforeBattle = structuredClone(game);
  assert.ok(game.active === owner || game.active === opponent);
  game = step(game, { actor: game.active!, action: { type: 'chooseBattle', territory: strongholdKind,
    target: game.active === owner ? opponent : owner } }, actions);
  // The owner alone retains the requested visibility; every enemy skill is hidden.
  for (let i = 0; !(game.battle && clean(game) && !game.battle.preparation && game.battle.preLeader?.closed !== false) && i < 200; i++) {
    const next = nextEcazSkillsModulesStep(game); assert.ok(next);
    if (next.action.type === 'leaderSkillVisibility' && next.actor === owner) next.action.hide = band === 'skilled';
    game = step(game, next, actions);
  }
  const enemy = ecazSkillsModulesPlayer(game, opponent);
  const enemyTrainer = ecazSkillsModulesTrainer(game, opponent).leader;
  const defender = enemy.leaders.filter(l => !l.dead && l.id !== enemyTrainer).sort((a, b) =>
    kind === 'duke' ? b.strength - a.strength : a.strength - b.strength)[0]; assert.ok(defender);
  const ownLeader = kind === 'duke' ? DUKE_VIDAL_ID : band === 'skilled' ? trainer
    : ecazSkillsModulesPlayer(game, owner).leaders.find(l => l.strength === 4 && l.id !== trainer)!.id;
  const ownerDial = kind === 'duke' ? 0 : 5;
  const opponentDial = options.opponentDial ?? (kind === 'duke'
    ? game.battle!.attacker === owner ? 2 : 1 : kind === 'income' ? 1 : 0);
  const plans: StrongholdFactionsNativeStep[] = [
    { actor: owner, action: { type: 'battlePlan', leader: ownLeader, dial: ownerDial,
      support: game.advanced ? ownerDial : 0, weapon: worthless.id, defense: shield?.id } },
    { actor: opponent, action: { type: 'battlePlan', leader: defender.id, dial: opponentDial,
      support: game.advanced ? opponentDial : 0, weapon: poison?.id } },
  ];
  assertEcazSkillsModulesCustody(game);
  return { initial, offered, afterSetup, beforeFirstMentat, firstMentatStep, afterFirstMentat, acquisition,
    beforeBattle, game, owner, opponent, trainer, territory: strongholdKind, location, plans, actions, staging };
}
export function revealEcazSkillsModulesBattle(f: EcazSkillsModulesFixture): Game {
  let game = reloadEcazSkillsModules(f.game);
  for (const plan of f.plans) {
    game = step(game, plan);
    if (!game.battle?.revealed) game = advanceEcazSkillsModules(game,
      g => clean(g) && !g.battle?.preparation && g.battle?.preLeader?.closed !== false);
  }
  assert.ok(game.battle?.revealed); return game;
}
export function settleEcazSkillsModulesBattle(game: Game, stop: 'suk' | 'cards' | 'tech' | 'complete' = 'complete'): Game {
  return advanceEcazSkillsModules(game, g =>
    stop === 'suk' && g.decision?.kind === 'sukRescue' ||
    stop === 'cards' && g.decision?.kind === 'battleCards' ||
    stop === 'tech' && g.decision?.kind === 'techToken' ||
    !g.battle && clean(g) && !g.pendingTreacheryDiscard);
}
