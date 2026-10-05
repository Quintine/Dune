import assert from 'node:assert/strict';
import {
  applyAction, createGame, handLimit, initializeLeaderSkillsGameForAudit, joinGame, newPlayer, viewGame,
  type Action, type Game, type Player,
} from '../game/engine';
import { territory } from '../game/board';
import type { Card } from '../game/cards';
import type { FactionId } from '../game/catalog';
import { DISCOVERY_CARD_PLACEMENTS, validateDiscoveryState } from '../game/discoveries';
import { discoveryEntryMoveAction } from '../game/discovery-entry-options';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { nextMoritaniSkillsModulesStep, moritaniSkillsModulesPolicy } from './fixture-moritani-skills-modules';
import { holdMoritaniStrongholdsTraitor } from './fixture-moritani-strongholds';

export type DiscoveryNativeE3SkillsStep = { actor: string; action: Action };
export type DiscoveryNativeE3SkillsOptions = {
  /** Authenticated fresh lobby or its ORIGINAL undealt setup, never a played save. */
  initial?: Game;
  rules?: 'basic' | 'advanced';
  tech?: boolean;
  strongholds?: boolean;
  normalCall?: boolean;
  battle?: 'nested' | 'tueks_sietch';
};
export type DiscoveryNativeE3SkillsFixture = {
  initial: Game; setup: Game; afterSetup: Game; afterFirstStorm: Game;
  beforeReveal: Game; afterReveal: Game;
  beforeFirstMentat: Game; firstMentatStep: DiscoveryNativeE3SkillsStep; afterFirstMentat: Game;
  entry: { before: Game; step: DiscoveryNativeE3SkillsStep; after: Game };
  shipment: { before: Game; step: DiscoveryNativeE3SkillsStep; after: Game };
  beforeBattle: Game; battleStep: DiscoveryNativeE3SkillsStep; game: Game; revealed: Game; pending: Game;
  moritani: string; opponent: string; target: string; moritaniLeader: string; opponentLeader: string;
  token: string; source: string; location: string; battleTerritory: string;
  moritaniCards: string[]; opponentCards: string[]; plans: DiscoveryNativeE3SkillsStep[];
  actions: DiscoveryNativeE3SkillsStep[]; staging: string[];
};
export function discoveryNativeE3SkillsPlayer(game: Game, actor: string): Player {
  const player = game.players.find(p => p.id === actor); assert.ok(player); return player;
}
export const discoveryNativeE3SkillsClean = (game: Game) =>
  !game.response && !game.decision && !game.phaseOpening && !game.pendingTreacheryDiscard;
export const discoveryNativeE3SkillsPolicy = moritaniSkillsModulesPolicy;
export function nextDiscoveryNativeE3SkillsStep(game: Game): DiscoveryNativeE3SkillsStep | null {
  if (!game.response && !game.phaseOpening && game.decision?.kind === 'discoveryEntry')
    return { actor: game.decision.player, action: { type: 'decision', event: game.decision.event, accept: false } };
  if (!game.response && !game.phaseOpening && game.decision?.kind === 'sukRescue') {
    const d = game.decision, maximum = Math.max(...d.options.map(o => o.normal + o.elite));
    const choice = d.options.findIndex(o => o.normal + o.elite === maximum && o.kept?.kind === 'normal');
    return { actor: d.player, action: { type: 'decision', event: d.event,
      choice: choice >= 0 ? choice : d.options.findIndex(o => o.normal + o.elite === maximum) } };
  }
  return nextMoritaniSkillsModulesStep(game);
}
function act(game: Game, step: DiscoveryNativeE3SkillsStep, actions?: DiscoveryNativeE3SkillsStep[]): Game {
  actions?.push(structuredClone(step)); return applyAction(game, step.actor, step.action);
}
export function advanceDiscoveryNativeE3Skills(state: Game, until: (g: Game) => boolean,
  actions?: DiscoveryNativeE3SkillsStep[]): Game {
  let game = state;
  for (let n = 0; n < 2200; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const next = nextDiscoveryNativeE3SkillsStep(game); assert.ok(next, 'Original sealed plans need their actual owners.');
    if (game.turn === 1 && next.action.type === 'stormDial') next.action.amount = 0;
    game = act(game, next, actions);
  }
  throw Error('Original Discovery/Moritani skill chronology did not reach its boundary.');
}
/** Explicit zero-support original plans finish the deliberately separate conflict
 * before later-turn proofs. Immediate primary-battle receipts remain separate. */
export function finishDiscoveryNativeE3SkillsBattles(state: Game,
  actions?: DiscoveryNativeE3SkillsStep[]): Game {
  let game = state;
  for (let n = 0; n < 300; n++) {
    if (game.phase !== 6) return game;
    const next = nextDiscoveryNativeE3SkillsStep(game);
    if (next) { game = act(game, next, actions); continue; }
    assert.ok(game.battle && !game.battle.revealed);
    for (const actor of [game.battle.attacker, game.battle.defender]) {
      if (game.battle!.plans[actor]) continue;
      const owner = discoveryNativeE3SkillsPlayer(game, actor);
      const living = owner.leaders.filter(leader => !leader.dead &&
        !game.leaderSkills!.assignments.some(assignment => assignment.leader === leader.id) &&
        (!leader.usedAt || leader.usedAt === game.battle!.territory));
      living.sort((a, b) => owner.faction === 'moritani' ? b.strength - a.strength : a.strength - b.strength);
      assert.ok(living[0]);
      game = act(game, { actor, action: { type: 'battlePlan', leader: living[0].id,
        dial: 0, support: 0, weapon: null, defense: null } }, actions);
    }
  }
  throw Error('Original remaining conflict did not complete.');
}
function prepareDiscoveryNativeE3HiddenPlans(state: Game, actions: DiscoveryNativeE3SkillsStep[]): Game {
  let game = state;
  for (let n = 0; n < 160; n++) {
    const next = nextDiscoveryNativeE3SkillsStep(game);
    if (!next) { assert.ok(game.battle && !game.battle.revealed); return game; }
    if (next.action.type === 'leaderSkillVisibility') next.action.hide = true;
    game = act(game, next, actions);
  }
  throw Error('Original trained-disc battle plans did not open.');
}
function entropy<T>(operation: () => T, choose: (index: number) => number): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto); let index = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    const value = choose(index++);
    if (value < 0) return Reflect.apply(original, crypto, [array]) as V;
    assert.ok(array instanceof Uint32Array && array.length === 1); array[0] = value; return array;
  };
  try { return operation(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
/** Physical first all14 shuffle only. No injected/replaced offers or hidden hands. */
function initializeOffers(game: Game): Game {
  const current = LEADER_SKILL_CARDS.map(c => c.id) as LeaderSkillId[];
  const skills = game.players.map(p => p.faction === 'guild' ? 'suk-graduate' :
    p.faction === 'moritani' ? 'warmaster' :
      (['killer-medic', 'prana-bindu-adept', 'swordmaster-of-ginaz', 'master-of-assassins'] as LeaderSkillId[])[
        game.players.filter(q => !['guild', 'moritani'].includes(q.faction)).findIndex(q => q.id === p.id)]);
  const desired = Array<LeaderSkillId>(current.length); skills.forEach((skill, n) => { desired[n * 2] = skill; });
  const rest = current.filter(c => !skills.includes(c));
  for (let n = 0; n < desired.length; n++) if (!desired[n]) desired[n] = rest.shift()!;
  let index = current.length - 1;
  return entropy(() => initializeLeaderSkillsGameForAudit(game), () => {
    if (index < 1) return -1;
    const swap = current.indexOf(desired[index]); assert.ok(swap <= index);
    const scalar = Math.floor((swap + 0.5) / (index + 1) * 0x100000000);
    [current[index], current[swap]] = [current[swap], current[index]]; index--; return scalar;
  });
}
/** Ready/initialize this original lobby, or preserve an original undealt setup. */
export function initializeDiscoveryNativeE3Skills(options: DiscoveryNativeE3SkillsOptions = {}): Game {
  const advanced = options.rules ? options.rules === 'advanced' : options.initial?.advanced ?? true;
  const tech = options.tech ?? !!options.initial?.techTokens;
  const strongholds = options.strongholds ?? !!options.initial?.strongholdCards;
  let game = options.initial ? structuredClone(options.initial)
    : createGame('DISCOVERYNATIVEE3SKILLS', newPlayer('moritani', 'Moritani', 'moritani'), advanced, ['ecaz']);
  if (!options.initial) for (const faction of ['guild', 'emperor'] as FactionId[]) joinGame(game, newPlayer(faction, faction, faction));
  assert.equal(game.advanced, advanced); assert.deepEqual(game.expansions, ['ecaz']);
  assert.ok(game.players.length >= (tech ? 3 : 2) && game.players.length <= 6);
  assert.equal(game.players.filter(p => p.faction === 'moritani').length, 1);
  assert.equal(game.players.filter(p => p.faction === 'guild').length, 1);
  assert.equal(new Set(game.players.map(p => p.faction)).size, game.players.length);
  assert.ok(game.players.every(p => ['moritani', 'guild', 'atreides', 'emperor', 'fremen', 'beneGesserit',
    ...(advanced ? [] : ['harkonnen'])].includes(p.faction)));
  assert.ok(!strongholds || advanced);
  assert.ok(!game.nexusCards && !game.homeworlds && !game.ecazTreachery && !game.spiceBankerIncomePreview && !game.mentatQuestionPreview);
  if (game.status === 'lobby') {
    if (!!game.techTokens !== tech) game = applyAction(game, game.host, { type: 'techTokens', enabled: tech });
    if (!!game.strongholdCards !== strongholds) game = applyAction(game, game.host, { type: 'strongholdCards', enabled: strongholds });
    game.discoveryEnabled = true;
    for (const p of game.players) if (!p.ready) game = applyAction(game, p.id, { type: 'ready' });
    return initializeOffers(game);
  }
  assert.ok(game.status === 'setup' && game.turn === 1 && game.phase === 0 &&
    game.leaderSkills?.assignments.length === 0 && game.players.every(p =>
      p.hand.length <= (p.faction === 'harkonnen' ? 2 : 1) && p.traitors.length === 0 && p.traitorChoices.length === 0),
  'Only an ORIGINAL unassigned native setup may be continued; printed starting hands are preserved.');
  assert.ok(game.discoveryEnabled && game.discoveries && game.leaderSkills);
  assert.equal(!!game.techTokens, tech); assert.equal(!!game.strongholdCards, strongholds);
  return game;
}
export function completeDiscoveryNativeE3SkillsSetup(state: Game, actions?: DiscoveryNativeE3SkillsStep[]): Game {
  let game = state;
  for (let n = 0; game.status === 'setup' && n < 240; n++) {
    if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0], offer = game.leaderSkills!.offers[actor];
      const own = viewGame(game, actor).leaderSkills!, p = discoveryNativeE3SkillsPlayer(game, actor);
      const requested = p.faction === 'guild' ? 'suk-graduate' : undefined;
      const available = (c: LeaderSkillId) => !own.unavailableSkills?.[c];
      const skill = requested && offer.cards.includes(requested) && available(requested) ? requested
        : offer.cards.find(c => !['mentat', 'spice-banker', 'diplomat'].includes(c) && available(c))
          ?? offer.cards.find(available);
      const leader = p.faction === 'guild' ? own.eligibleLeaders.find(l => l.name === 'Master Bewt') : own.eligibleLeaders[0];
      assert.ok(skill && offer.cards.includes(skill) && !own.unavailableSkills?.[skill] && leader,
        'Actual original offers must supply this consumer; never substitute an injected offer.');
      game = act(game, { actor, action: { type: 'leaderSkill', event: offer.event, skill, leader: leader.id } }, actions);
    } else { const next = nextDiscoveryNativeE3SkillsStep(game); assert.ok(next); game = act(game, next, actions); }
  }
  assert.equal(game.status, 'playing'); return game;
}
function reserveExcept(game: Game, keep: string[]): void {
  for (const p of game.players) for (const [key, amount] of Object.entries(p.forces)) {
    if (keep.includes(key)) continue;
    p.reserves += amount; delete p.forces[key];
    if (p.elites) { p.elites.reserves += p.elites.forces[key] ?? 0; delete p.elites.forces[key]; }
    if (p.advisors) delete p.advisors[key.split(':')[0]];
  }
}
function place(game: Game, actor: string, location: string, amount: number): void {
  const p = discoveryNativeE3SkillsPlayer(game, actor); assert.ok(p.reserves - (p.elites?.reserves ?? 0) >= amount);
  p.reserves -= amount; p.forces[location] = (p.forces[location] ?? 0) + amount;
}
function held(game: Game, actor: string, matches: (c: Card) => boolean, staging: string[], excluded: string[] = []): string {
  const p = discoveryNativeE3SkillsPlayer(game, actor), match = (c: Card) => matches(c) && !excluded.includes(c.id);
  const owned = p.hand.find(match); if (owned) return owned.id;
  assert.ok(p.hand.length < handLimit(p));
  const index = game.deck.findIndex(match); assert.ok(index >= 0);
  const card = game.deck.splice(index, 1)[0]; p.hand.push(card);
  staging.push(`Conserved original Ecaz33 ${card.id}: remaining deck → ${actor}'s hand.`); return card.id;
}
export function revealDiscoveryNativeE3SkillsPlans(game: Game, plans: DiscoveryNativeE3SkillsStep[],
  actions?: DiscoveryNativeE3SkillsStep[]): Game {
  for (const plan of plans) {
    game = act(game, plan, actions);
    while (game.response || game.phaseOpening || game.decision?.kind === 'fullPlanOffer') {
      const next = nextDiscoveryNativeE3SkillsStep(game); assert.ok(next); game = act(game, next, actions);
    }
  }
  assert.ok(game.battle?.revealed); return game;
}
export function resolveDiscoveryNativeE3SkillsBattle(game: Game, moritani: string, normalCall = false,
  actions?: DiscoveryNativeE3SkillsStep[]): Game {
  for (let n = 0; n < 180; n++) {
    if (game.decision?.kind === 'moritaniAssassinate' || !game.battle && discoveryNativeE3SkillsClean(game)) return game;
    const next = nextDiscoveryNativeE3SkillsStep(game); assert.ok(next);
    if (next.action.type === 'traitorCall') next.action.call = normalCall && next.actor === moritani;
    game = act(game, next, actions);
  }
  throw Error('Original nested battle suffix did not settle.');
}
/** Human sequence: native training/Traitors/start → actual printed blow → Guild
 * shipment/inspect/reveal → first END Mentat claims → original free entry →
 * Weather Control zero → paid Moritani nested shipment → Battle plans → Suk →
 * after-loss assassination → winner cards/Tech → actual Mentat replacement.
 * Explicit physical lottery/card/board staging below is not a natural history. */
export function createDiscoveryNativeE3SkillsFixture(options: DiscoveryNativeE3SkillsOptions = {}): DiscoveryNativeE3SkillsFixture {
  let game = initializeDiscoveryNativeE3Skills(options);
  const initial = options.initial ? structuredClone(options.initial) : structuredClone(game);
  const setup = structuredClone(game), actions: DiscoveryNativeE3SkillsStep[] = [], staging: string[] = [];
  game = completeDiscoveryNativeE3SkillsSetup(game, actions); const afterSetup = structuredClone(game);
  const moritani = game.players.find(p => p.faction === 'moritani')!.id, opponent = game.players.find(p => p.faction === 'guild')!.id;
  const printed = 'discovery-hagga-basin', placement = DISCOVERY_CARD_PLACEMENTS[printed];
  const source = `${placement.territory}:${placement.sector}`;
  const index = game.spiceDeck.findIndex(c => 'territory' in c && c.discovery === printed); assert.ok(index >= 0);
  game.spiceDeck.unshift(game.spiceDeck.splice(index, 1)[0]);
  for (let position = 1; position < 14; position++) {
    const ordinary = game.spiceDeck.findIndex((c, i) => i >= position && 'territory' in c && !c.discovery);
    assert.ok(ordinary >= position); game.spiceDeck.splice(position, 0, game.spiceDeck.splice(ordinary, 1)[0]);
  }
  reserveExcept(game, []);
  staging.push('Conserved native board counters through own reserves; reordered existing unplayed printed Discovery and ordinary Spice Cards only.');
  game = advanceDiscoveryNativeE3Skills(game, g => g.phase === 1 && discoveryNativeE3SkillsClean(g), actions);
  const afterFirstStorm = structuredClone(game);
  const tokens = game.discoveries!.tokens.filter(t => t.status === 'supply' && t.type === 'hiereg');
  const selected = tokens.findIndex(t => t.face === 'cistern'); assert.ok(selected >= 0);
  game = entropy(() => advanceDiscoveryNativeE3Skills(game,
    g => g.discoveries!.tokens.some(t => t.face === 'cistern' && t.status === 'placed'), actions),
  () => Math.floor((selected + 0.5) / tokens.length * 0x100000000));
  game = advanceDiscoveryNativeE3Skills(game, g => g.phase === 5 && g.active === opponent && discoveryNativeE3SkillsClean(g), actions);
  game = act(game, { actor: opponent, action: { type: 'ship', territory: placement.territory, sector: placement.sector, amount: 3 } }, actions);
  game = advanceDiscoveryNativeE3Skills(game, g => g.phase === 7 && discoveryNativeE3SkillsClean(g), actions);
  const token = game.discoveries!.tokens.find(t => t.face === 'cistern')!.id, beforeReveal = structuredClone(game);
  game = act(game, { actor: opponent, action: { type: 'discovery', token, reveal: false } }, actions);
  game = act(game, { actor: opponent, action: { type: 'discovery', token, reveal: true } }, actions);
  const afterReveal = structuredClone(game);
  game = advanceDiscoveryNativeE3Skills(game, g => g.phase === 8 && discoveryNativeE3SkillsClean(g), actions);
  reserveExcept(game, [source]);
  place(game, moritani, `tueks_sietch:${territory('tueks_sietch').sectors[0]}`, 1);
  place(game, opponent, `carthag:${territory('carthag').sectors[0]}`, 1);
  staging.push('Before actual first END Mentat: one conserved claim counter per combatant; preserve three real Guild Discovery-source arrivals.');
  let beforeFirstMentat: Game | undefined, firstMentatStep: DiscoveryNativeE3SkillsStep | undefined;
  while (game.turn === 1) {
    const next = nextDiscoveryNativeE3SkillsStep(game); assert.ok(next);
    const before = structuredClone(game); game = act(game, next, actions);
    if (game.turn === 2) { beforeFirstMentat = before; firstMentatStep = next; }
  }
  assert.ok(beforeFirstMentat && firstMentatStep); const afterFirstMentat = structuredClone(game);
  game = advanceDiscoveryNativeE3Skills(game, g => g.decision?.kind === 'discoveryEntry' && g.decision.player === opponent, actions);
  const entryBefore = structuredClone(game), own = viewGame(game, opponent);
  const entryAction = discoveryEntryMoveAction(own, own.discoveryEntry!.sources); assert.ok(entryAction);
  const entryStep = { actor: opponent, action: entryAction }; game = act(game, entryStep, actions);
  const entry = { before: entryBefore, step: entryStep, after: structuredClone(game) };
  game = advanceDiscoveryNativeE3Skills(game, g => g.phase === 0 && discoveryNativeE3SkillsClean(g), actions);
  for (const p of game.players) { game.deck.push(...p.hand); p.hand = []; }
  staging.push('Returned original physical hands to their same Ecaz33 deck before source-local card transfers; no face manufacture.');
  const weather = held(game, moritani, c => c.effect === 'weather', staging);
  game = act(game, { actor: moritani, action: { type: 'card', card: weather, amount: 0 } }, actions);
  game = advanceDiscoveryNativeE3Skills(game, g => g.phase === 5 && g.active === moritani && discoveryNativeE3SkillsClean(g), actions);
  const shipmentBefore = structuredClone(game), shipmentStep: DiscoveryNativeE3SkillsStep = {
    actor: moritani, action: { type: 'ship', territory: 'cistern', sector: 0, amount: 1 } };
  game = act(game, shipmentStep, actions);
  game = advanceDiscoveryNativeE3Skills(game, g => !g.pendingShipment && discoveryNativeE3SkillsClean(g), actions);
  const shipment = { before: shipmentBefore, step: shipmentStep, after: structuredClone(game) };
  const battleTerritory = options.battle === 'tueks_sietch' ? 'tueks_sietch' : 'cistern';
  const location = `${battleTerritory}:${battleTerritory === 'cistern' ? 0 : territory(battleTerritory).sectors[0]}`;
  reserveExcept(game, ['cistern:0']);
  for (const actor of [moritani, opponent]) place(game, actor, location, 6 - (discoveryNativeE3SkillsPlayer(game, actor).forces[location] ?? 0));
  staging.push(`Before actual movement completion: top up ${location} to six conserved ordinary counters per combatant; preserve original free/paid Cistern entry and earned card custody.`);
  const secondTerritory = 'wind_pass';
  const secondSector = territory(secondTerritory).sectors.find(sector => sector !== game.storm)!;
  for (const actor of [moritani, opponent]) place(game, actor, `${secondTerritory}:${secondSector}`, 1);
  staging.push('Conserved one ordinary counter per combatant at Wind Pass for a second real conflict; keep immediate battle receipts separate from later Collection.');
  const moritaniCards = [held(game, moritani, c => c.kind === 'worthless', staging)];
  moritaniCards.push(held(game, moritani, c => c.kind === 'worthless', staging, moritaniCards));
  const opponentCards = [held(game, opponent, c => c.kind === 'worthless', staging)];
  const trained = new Set(game.leaderSkills!.assignments.map(a => a.leader));
  const ownLeader = discoveryNativeE3SkillsPlayer(game, moritani).leaders.filter(l => !l.dead && !trained.has(l.id)).sort((a, b) => a.strength - b.strength)[0];
  const enemyLeader = discoveryNativeE3SkillsPlayer(game, opponent).leaders.filter(l => !l.dead && !trained.has(l.id)).sort((a, b) => b.strength - a.strength)[0];
  const target = game.leaderSkills!.assignments.find(a => a.owner === opponent)!.leader;
  assert.ok(ownLeader && enemyLeader && enemyLeader.id !== target);
  holdMoritaniStrongholdsTraitor(game, moritani, options.normalCall ? enemyLeader.id : target, staging);
  game = advanceDiscoveryNativeE3Skills(game, g => g.phase === 6 && discoveryNativeE3SkillsClean(g), actions);
  const beforeBattle = structuredClone(game), actor = game.active!; assert.ok([moritani, opponent].includes(actor));
  const battleStep: DiscoveryNativeE3SkillsStep = { actor, action: { type: 'chooseBattle', territory: battleTerritory, target: actor === moritani ? opponent : moritani } };
  game = act(game, battleStep, actions);
  game = advanceDiscoveryNativeE3Skills(game, g => !!g.battle && !g.battle.revealed && !nextDiscoveryNativeE3SkillsStep(g), actions);
  const plans: DiscoveryNativeE3SkillsStep[] = [
    { actor: moritani, action: { type: 'battlePlan', leader: ownLeader.id, dial: 1, support: game.advanced ? 1 : 0, weapon: moritaniCards[0], defense: moritaniCards[1] } },
    { actor: opponent, action: { type: 'battlePlan', leader: enemyLeader.id, dial: 3, support: game.advanced ? 3 : 0, weapon: opponentCards[0] } },
  ];
  const prepared = structuredClone(game), revealed = revealDiscoveryNativeE3SkillsPlans(game, plans, actions);
  const pending = resolveDiscoveryNativeE3SkillsBattle(structuredClone(revealed), moritani, options.normalCall, actions);
  validateLeaderSkills(pending.leaderSkills!, pending.players); validateDiscoveryState(pending.discoveries!);
  return { initial, setup, afterSetup, afterFirstStorm, beforeReveal, afterReveal, beforeFirstMentat, firstMentatStep,
    afterFirstMentat, entry, shipment, beforeBattle, battleStep, game: prepared, revealed, pending,
    moritani, opponent, target, moritaniLeader: ownLeader.id, opponentLeader: enemyLeader.id,
    token, source, location, battleTerritory, moritaniCards, opponentCards, plans, actions, staging };
}

export type DiscoveryNativeE3SkillsDeath = {
  before: Game; revealed: Game; after: Game; territory: string; leader: string; winnerLeader: string;
  battleStep: DiscoveryNativeE3SkillsStep; plans: DiscoveryNativeE3SkillsStep[];
};
export type DiscoveryNativeE3SkillsRevivalFixture = {
  discovery: DiscoveryNativeE3SkillsFixture; beforeDeaths: Game; deaths: DiscoveryNativeE3SkillsDeath[];
  revivalWindow: Game; revivalStep: DiscoveryNativeE3SkillsStep; offered: Game;
  moritani: string; opponent: string; leader: string; weapon: string;
  actions: DiscoveryNativeE3SkillsStep[]; staging: string[];
};
/** Five REAL battles in one original Battle phase kill each original Moritani
 * disc once. Both sides use five distinct native discs; the same physical Guild
 * poison is retained after each zero-dial win. No injected deaths, wallet,
 * revival-cycle, phase or receipt. The next original Revival pays printed cost. */
export function createDiscoveryNativeE3SkillsRevivalFixture(): DiscoveryNativeE3SkillsRevivalFixture {
  const discovery = createDiscoveryNativeE3SkillsFixture();
  const { moritani, opponent } = discovery, actions = [...discovery.actions], staging = [...discovery.staging];
  let game = structuredClone(discovery.pending);
  const d = game.decision; assert.equal(d?.kind, 'moritaniAssassinate');
  if (d?.kind !== 'moritaniAssassinate') throw Error('Expected actual original loss opportunity.');
  game = act(game, { actor: moritani, action: { type: 'decision', event: d.event, decline: true } }, actions);
  game = finishDiscoveryNativeE3SkillsBattles(game, actions);
  game = advanceDiscoveryNativeE3Skills(game, g => g.turn === 3 && g.phase === 5 && discoveryNativeE3SkillsClean(g), actions);
  reserveExcept(game, []);
  for (const p of game.players) { game.deck.push(...p.hand); p.hand = []; }
  const weapon = held(game, opponent, c => c.kind === 'poison', staging);
  const territories = ['cielago_east', 'wind_pass', 'plastic_basin', 'pasty_mesa', 'false_wall_west'];
  const moritaniLeaders = discoveryNativeE3SkillsPlayer(game, moritani).leaders.filter(l => !l.dead);
  const guildLeaders = discoveryNativeE3SkillsPlayer(game, opponent).leaders.filter(l => !l.dead);
  assert.equal(moritaniLeaders.length, 5); assert.equal(guildLeaders.length, 5);
  for (const site of territories) {
    const sector = territory(site).sectors.find(s => s !== game.storm); assert.notEqual(sector, undefined);
    place(game, moritani, `${site}:${sector}`, 1); place(game, opponent, `${site}:${sector}`, 1);
  }
  staging.push('Before real turn-three Movement completes: conserved one ordinary counter per combatant at each of five original territories; one original Guild poison remains reusable through winner retention.');
  game = advanceDiscoveryNativeE3Skills(game, g => g.phase === 6 && discoveryNativeE3SkillsClean(g), actions);
  const beforeDeaths = structuredClone(game), deaths: DiscoveryNativeE3SkillsDeath[] = [];
  for (const [index, site] of territories.entries()) {
    const before = structuredClone(game), actor = game.active!; assert.ok([moritani, opponent].includes(actor));
    const battleStep: DiscoveryNativeE3SkillsStep = { actor, action: { type: 'chooseBattle', territory: site,
      target: actor === moritani ? opponent : moritani } };
    game = act(game, battleStep, actions);
    game = prepareDiscoveryNativeE3HiddenPlans(game, actions);
    const plans: DiscoveryNativeE3SkillsStep[] = [
      { actor: moritani, action: { type: 'battlePlan', leader: moritaniLeaders[index].id, dial: 0, support: 0 } },
      { actor: opponent, action: { type: 'battlePlan', leader: guildLeaders[index].id, dial: 0, support: 0, weapon } },
    ];
    game = revealDiscoveryNativeE3SkillsPlans(game, plans, actions); const revealed = structuredClone(game);
    game = resolveDiscoveryNativeE3SkillsBattle(game, moritani, false, actions);
    if (game.decision?.kind === 'moritaniAssassinate') game = act(game, { actor: moritani,
      action: { type: 'decision', event: game.decision.event, decline: true } }, actions);
    game = advanceDiscoveryNativeE3Skills(game, g => !g.battle && discoveryNativeE3SkillsClean(g), actions);
    deaths.push({ before, revealed, after: structuredClone(game), territory: site,
      leader: moritaniLeaders[index].id, winnerLeader: guildLeaders[index].id, battleStep, plans });
  }
  assert.ok(discoveryNativeE3SkillsPlayer(game, moritani).leaders.every(l => l.dead));
  const assignment = beforeDeaths.leaderSkills!.assignments.find(a => a.owner === moritani); assert.ok(assignment);
  game = advanceDiscoveryNativeE3Skills(game, g => g.turn === 4 && g.phase === 4 && discoveryNativeE3SkillsClean(g), actions);
  const revivalWindow = structuredClone(game), revivalStep: DiscoveryNativeE3SkillsStep = {
    actor: moritani, action: { type: 'reviveLeader', leader: assignment.leader } };
  game = act(game, revivalStep, actions);
  game = advanceDiscoveryNativeE3Skills(game, g => g.decision?.kind === 'leaderSkillRevival' && g.decision.player === moritani, actions);
  return { discovery, beforeDeaths, deaths, revivalWindow, revivalStep, offered: game,
    moritani, opponent, leader: assignment.leader, weapon, actions, staging };
}
