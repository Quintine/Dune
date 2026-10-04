import assert from 'node:assert/strict';
import {
  applyAction, createGame, joinGame, newPlayer, viewGame,
  type Action, type Game,
} from '../game/engine';
import type { Difficulty } from '../game/bot-profiles';
import { botActions } from '../game/bots';
import type { FactionId } from '../game/catalog';
import type { Card } from '../game/cards';
import { TERRITORIES, territory } from '../game/board';
import { ownedTech } from '../game/tech-tokens';
import { initializeAdvancedNativeSkillsSetup } from './fixture-advanced-native-skills';
import { holdMoritaniStrongholdsTraitor } from './fixture-moritani-strongholds';
import { nextStrongholdFactionsNativeStep, type StrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type MoritaniSkillsModulesOptions = {
  initial?: Game;
  rules?: 'basic' | 'advanced';
  tech?: boolean;
  strongholds?: boolean;
  holder?: 'moritani' | 'guild';
  normalCall?: boolean;
};
export type MoritaniSkillsModulesFixture = {
  initial: Game; afterSetup: Game; afterFirstStorm: Game;
  beforeFirstMentat: Game; firstMentatStep: StrongholdFactionsNativeStep; afterFirstMentat: Game;
  beforeShipment: Game; shipmentStep: StrongholdFactionsNativeStep; afterShipment: Game; afterMovement: Game;
  beforeBattle: Game; game: Game; revealed: Game; pending: Game;
  moritani: string; opponent: string; holder: string; target: string;
  moritaniLeader: string; opponentLeader: string;
  moritaniCards: string[]; opponentCards: string[];
  battleAction: StrongholdFactionsNativeStep; planActions: StrongholdFactionsNativeStep[];
  sourceActions: StrongholdFactionsNativeStep[]; staging: string[];
};
export function moritaniSkillsModulesPlayer(game: Game, id: string) {
  const player = game.players.find(p => p.id === id); assert.ok(player, `Missing original seat ${id}`); return player;
}
export function moritaniSkillsModulesPolicy(game: Game, actor: string, difficulty: Difficulty = 'Easy') {
  const view = viewGame(game, actor); view.players.find(p => p.id === actor)!.bot = difficulty;
  return botActions(view);
}
/** A response pass queue takes precedence over every simultaneous native choice.
 * A null result is the genuine boundary requiring a human sealed Battle Plan. */
export function nextMoritaniSkillsModulesStep(game: Game): StrongholdFactionsNativeStep | null {
  if (game.response || game.phaseOpening || game.pendingTreacheryDiscard)
    return nextStrongholdFactionsNativeStep(game);
  const d = game.decision;
  if (d?.kind === 'leaderSkillVisibility') return { actor: d.player, action: { type: 'leaderSkillVisibility', event: d.event, hide: false } };
  if (d?.kind === 'moritaniSetup') {
    const action = moritaniSkillsModulesPolicy(game, d.player)[0]; assert.ok(action);
    return { actor: d.player, action };
  }
  if (d?.kind === 'moritaniPlacement') return { actor: d.player, action: { type: 'decision', decline: true } };
  if (d?.kind === 'moritaniAssassinate') return { actor: d.player, action: { type: 'decision', event: d.event, decline: true } };
  if (d?.kind === 'techToken') return { actor: d.player, action: { type: 'decision', token: d.choices[0] } };
  return nextStrongholdFactionsNativeStep(game);
}
function run(game: Game, step: StrongholdFactionsNativeStep, actions: StrongholdFactionsNativeStep[]) {
  actions.push(structuredClone(step)); return applyAction(game, step.actor, step.action);
}
export function advanceMoritaniSkillsModules(game: Game, until: (state: Game) => boolean, actions: StrongholdFactionsNativeStep[] = []): Game {
  for (let count = 0; count < 2000; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const next = nextMoritaniSkillsModulesStep(game); assert.ok(next, 'A real original sealed Battle Plan is required');
    game = run(game, next, actions);
  }
  throw Error('Original Moritani skills/modules continuation did not reach its requested boundary');
}
export const moritaniSkillsModulesClean = (game: Game) => !game.response && !game.decision && !game.phaseOpening;

/** Native offers and starting wallets; never convert a played save or redeal a
 * supplied original setup. Lobby modules are enabled by their real host actions. */
export function initializeMoritaniSkillsModulesOffers(options: MoritaniSkillsModulesOptions = {}): Game {
  const advanced = options.rules ? options.rules === 'advanced' : options.initial?.advanced ?? true;
  const tech = options.tech ?? true;
  const strongholds = options.strongholds ?? advanced;
  let game: Game;
  if (options.initial) game = structuredClone(options.initial);
  else {
    game = createGame('MORITANISKILLSMODULES', newPlayer('moritani', 'Moritani', 'moritani'), advanced, ['ecaz']);
    joinGame(game, newPlayer('guild', 'Guild', 'guild')); joinGame(game, newPlayer('emperor', 'Emperor', 'emperor'));
  }
  assert.equal(game.advanced, advanced); assert.deepEqual(game.expansions, ['ecaz']);
  assert.ok(game.players.length >= (tech ? 3 : 2) && game.players.length <= 6);
  assert.equal(game.players.filter(p => p.faction === 'moritani').length, 1);
  assert.equal(game.players.filter(p => p.faction === 'guild').length, 1);
  const allowed: FactionId[] = ['moritani', 'atreides', 'emperor', 'fremen', 'guild', 'beneGesserit'];
  assert.ok(game.players.every(p => allowed.includes(p.faction)));
  assert.ok(tech || strongholds); assert.ok(!strongholds || advanced);
  if (game.status === 'lobby') {
    if (!!game.techTokens !== tech) game = applyAction(game, game.host, { type: 'techTokens', enabled: tech });
    if (!!game.strongholdCards !== strongholds) game = applyAction(game, game.host, { type: 'strongholdCards', enabled: strongholds });
  } else {
    assert.equal(!!game.techTokens, tech); assert.equal(!!game.strongholdCards, strongholds);
  }
  game = initializeAdvancedNativeSkillsSetup({ family: 'moritani', skillOwner: 'guild', requestedSkill: 'suk-graduate',
    rules: advanced ? 'advanced' : 'basic', initial: game });
  while (game.setupStage === 'prediction') {
    const next = nextMoritaniSkillsModulesStep(game); assert.ok(next);
    game = applyAction(game, next.actor, next.action);
  }
  return game;
}
export function completeMoritaniSkillsModulesSetup(state: Game): Game {
  let game = state;
  const guild = game.players.find(p => p.faction === 'guild')!.id;
  for (let count = 0; game.status === 'setup' && count < 200; count++) {
    if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0], own = viewGame(game, actor).leaderSkills!;
      const offer = game.leaderSkills!.offers[actor];
      const skill = actor === guild ? 'suk-graduate' : offer.cards.find(c => !own.unavailableSkills?.[c]);
      const leader = actor === guild ? own.eligibleLeaders.find(l => l.name === 'Master Bewt') : own.eligibleLeaders[0];
      assert.ok(skill && offer.cards.includes(skill) && leader);
      game = applyAction(game, actor, { type: 'leaderSkill', event: offer.event, skill, leader: leader.id });
    } else {
      const next = nextMoritaniSkillsModulesStep(game); assert.ok(next);
      game = applyAction(game, next.actor, next.action);
    }
  }
  assert.equal(game.status, 'playing'); return game;
}
function reserveBoard(game: Game) {
  for (const p of game.players) {
    p.reserves += Object.values(p.forces).reduce((sum, n) => sum + n, 0); p.forces = {};
    if (p.elites) { p.elites.reserves += Object.values(p.elites.forces).reduce((sum, n) => sum + n, 0); p.elites.forces = {}; }
    if (p.advisors) p.advisors = {};
  }
}
function place(game: Game, actor: string, location: string, count: number) {
  const p = moritaniSkillsModulesPlayer(game, actor); assert.ok(p.reserves >= count);
  p.reserves -= count; p.forces[location] = count;
}
function heldCard(game: Game, actor: string, kind: Card['kind'], staging: string[], excluded: string[] = []) {
  const p = moritaniSkillsModulesPlayer(game, actor);
  const held = p.hand.find(c => c.kind === kind && !excluded.includes(c.id)); if (held) return held.id;
  const index = game.deck.findIndex(c => c.kind === kind && !excluded.includes(c.id)); assert.ok(index >= 0);
  assert.ok(p.hand.length < 4); const [card] = game.deck.splice(index, 1); p.hand.push(card);
  staging.push(`Conserved native ecaz33 ${card.id}: remaining deck → ${actor}'s hand`); return card.id;
}
export function stageMoritaniSkillsModulesBattle(game: Game, moritani: string, opponent: string, staging: string[] = []) {
  assert.equal(game.phase, 5); assert.ok(moritaniSkillsModulesClean(game));
  reserveBoard(game);
  const location = `tueks_sietch:${territory('tueks_sietch').sectors[0]}`;
  place(game, moritani, location, 6); place(game, opponent, location, 6);
  staging.push('Before actual movement completion: relocate six original counters per combatant through own reserves; no currency, storm, phase, turn or card-owner edits.');
  return game;
}
export function revealMoritaniSkillsModulesPlans(game: Game, plans: StrongholdFactionsNativeStep[], actions: StrongholdFactionsNativeStep[] = []): Game {
  for (const plan of plans) {
    game = run(game, plan, actions);
    while (game.response || game.decision?.kind === 'fullPlanOffer') {
      const next = nextMoritaniSkillsModulesStep(game); assert.ok(next); game = run(game, next, actions);
    }
  }
  assert.ok(game.battle?.revealed); return game;
}
/** Stop BEFORE original Suk rescue or original assassination; do not erase the
 * winner's casualties, card decisions or saved continuation to reach a choice. */
export function resolveMoritaniSkillsModulesBattle(game: Game, moritani: string, normalCall = false, actions: StrongholdFactionsNativeStep[] = []): Game {
  for (let count = 0; count < 160; count++) {
    if (game.decision?.kind === 'sukRescue' || game.decision?.kind === 'moritaniAssassinate' ||
      !game.battle && moritaniSkillsModulesClean(game) && !game.pendingTreacheryDiscard) return game;
    const next = nextMoritaniSkillsModulesStep(game); assert.ok(next);
    if (next.action.type === 'traitorCall') next.action.call = normalCall && next.actor === moritani;
    game = run(game, next, actions);
  }
  throw Error('Original Moritani skills/modules battle suffix did not settle');
}
export function createMoritaniSkillsModulesFixture(options: MoritaniSkillsModulesOptions = {}): MoritaniSkillsModulesFixture {
  const actions: StrongholdFactionsNativeStep[] = [], staging: string[] = [];
  let game = initializeMoritaniSkillsModulesOffers(options);
  const initial = structuredClone(game);
  game = completeMoritaniSkillsModulesSetup(game); const afterSetup = structuredClone(game);
  const moritani = game.players.find(p => p.faction === 'moritani')!.id;
  const opponent = game.players.find(p => p.faction === 'guild')!.id;
  const holder = options.holder === 'moritani' ? moritani : opponent;
  while (game.phase === 0) {
    const next = nextMoritaniSkillsModulesStep(game); assert.ok(next);
    if (next.action.type === 'stormDial') next.action.amount = 4;
    game = run(game, next, actions);
  }
  const afterFirstStorm = structuredClone(game);
  game = advanceMoritaniSkillsModules(game, s => s.phase === 8 && moritaniSkillsModulesClean(s), actions);
  reserveBoard(game);
  place(game, holder, `tueks_sietch:${territory('tueks_sietch').sectors[0]}`, 1);
  place(game, holder === moritani ? opponent : moritani, `carthag:${territory('carthag').sectors[0]}`, 1);
  staging.push('Before real first END Mentat: conserved native counters, one controlled stronghold each; card ownership remains entirely engine-derived.');
  let beforeFirstMentat: Game | undefined, firstMentatStep: StrongholdFactionsNativeStep | undefined;
  while (game.turn === 1) {
    const next = nextMoritaniSkillsModulesStep(game); assert.ok(next);
    const before = structuredClone(game); game = run(game, next, actions);
    if (game.turn === 2) { beforeFirstMentat = before; firstMentatStep = next; }
  }
  assert.ok(beforeFirstMentat && firstMentatStep);
  const afterFirstMentat = structuredClone(game);
  game = advanceMoritaniSkillsModules(game, s => s.phase === 5 && moritaniSkillsModulesClean(s), actions);
  stageMoritaniSkillsModulesBattle(game, moritani, opponent, staging);
  const m = moritaniSkillsModulesPlayer(game, moritani), guild = moritaniSkillsModulesPlayer(game, opponent);
  const trained = new Set(game.leaderSkills!.assignments.map(a => a.leader));
  const ownLeader = m.leaders.filter(l => !l.dead && !trained.has(l.id)).sort((a, b) => a.strength - b.strength)[0];
  const enemyLeader = guild.leaders.filter(l => !l.dead && !trained.has(l.id)).sort((a, b) => b.strength - a.strength)[0];
  const target = game.leaderSkills!.assignments.find(a => a.owner === opponent)!.leader;
  assert.ok(ownLeader && enemyLeader && enemyLeader.id !== target);
  holdMoritaniStrongholdsTraitor(game, moritani, options.normalCall ? enemyLeader.id : target, staging);
  const moritaniCards = [heldCard(game, moritani, 'worthless', staging)];
  moritaniCards.push(heldCard(game, moritani, 'worthless', staging, moritaniCards));
  const opponentCards = [heldCard(game, opponent, 'worthless', staging)];
  // Empty one selected battle deposit by returning it to the unoccupied Polar
  // Sink. This is explicit conserved board-spice staging, not minted bank money.
  const location = `tueks_sietch:${territory('tueks_sietch').sectors[0]}`;
  const deposit = game.spice[location] ?? 0;
  if (deposit) { delete game.spice[location]; game.spice['polar_sink:0'] = (game.spice['polar_sink:0'] ?? 0) + deposit; }
  staging.push(`Conserved board deposit ${deposit}: battle sector → unoccupied Polar Sink; isolate real battle/income wallet legs.`);
  // One actual non-Guild shipment triggers printed Heighliners accrual. Keep
  // native active/order/shipped fields intact and reach Moritani by actions.
  game = advanceMoritaniSkillsModules(game, s => s.phase === 5 && s.active === moritani && moritaniSkillsModulesClean(s), actions);
  const destination = TERRITORIES.find(site => site.type === 'sand' && !site.sectors.includes(game.storm) &&
    !Object.entries(game.spice).some(([key, count]) => count > 0 && key.startsWith(`${site.id}:`)) &&
    game.players.every(p => !Object.entries(p.forces).some(([key, count]) => count > 0 && key.startsWith(`${site.id}:`))));
  assert.ok(destination, 'The original invoice needs an empty, spice-free desert destination.');
  const beforeShipment = structuredClone(game);
  const shipmentStep: StrongholdFactionsNativeStep = { actor: moritani, action: { type: 'ship',
    territory: destination.id, sector: destination.sectors[0], amount: 1 } };
  game = run(game, shipmentStep, actions);
  game = advanceMoritaniSkillsModules(game, s => s.phase === 5 && moritaniSkillsModulesClean(s) && !s.pendingShipment, actions);
  const afterShipment = structuredClone(game);
  game = advanceMoritaniSkillsModules(game, s => s.phase === 6 && moritaniSkillsModulesClean(s), actions);
  const afterMovement = structuredClone(game), beforeBattle = structuredClone(game);
  const actor = game.active!; assert.ok([moritani, opponent].includes(actor));
  const battleAction: StrongholdFactionsNativeStep = { actor, action: { type: 'chooseBattle', territory: 'tueks_sietch', target: actor === moritani ? opponent : moritani } };
  game = run(game, battleAction, actions);
  game = advanceMoritaniSkillsModules(game, s => !!s.battle && !s.battle.revealed && !nextMoritaniSkillsModulesStep(s), actions);
  const planActions: StrongholdFactionsNativeStep[] = [
    { actor: moritani, action: { type: 'battlePlan', leader: ownLeader.id, dial: 1, ...(game.advanced ? { support: 1 } : {}), weapon: moritaniCards[0], defense: moritaniCards[1] } },
    { actor: opponent, action: { type: 'battlePlan', leader: enemyLeader.id, dial: 3, ...(game.advanced ? { support: 3 } : {}), weapon: opponentCards[0] } },
  ];
  const prepared = structuredClone(game), revealed = revealMoritaniSkillsModulesPlans(game, planActions, actions);
  const pending = resolveMoritaniSkillsModulesBattle(structuredClone(revealed), moritani, options.normalCall, actions);
  // Three-seat originals get one token per seat; larger originals must not
  // fabricate missing ownership merely to offer a post-battle Tech choice.
  if (afterFirstStorm.techTokens && afterFirstStorm.players.length === 3) assert.equal(ownedTech(afterFirstStorm.techTokens, opponent).length, 1);
  return { initial, afterSetup, afterFirstStorm, beforeFirstMentat, firstMentatStep, afterFirstMentat,
    beforeShipment, shipmentStep, afterShipment, afterMovement, beforeBattle, game: prepared, revealed, pending,
    moritani, opponent, holder, target, moritaniLeader: ownLeader.id, opponentLeader: enemyLeader.id,
    moritaniCards, opponentCards, battleAction, planActions, sourceActions: actions, staging };
}
export function rejectMoritaniSkillsModulesAction(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
