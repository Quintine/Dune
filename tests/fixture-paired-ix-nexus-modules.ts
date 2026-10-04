import assert from 'node:assert/strict';
import { applyAction, createGame, initializePairedNexusGameForAudit, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { MOBILE_LOCATION, MOBILE_STRONGHOLD, territory } from '../game/board';
import type { Card } from '../game/cards';
import { pairedNexusModulesProfile } from '../game/nexus-module-profile';
import { ownedTech } from '../game/tech-tokens';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type PairedIxNexusModulesStep = { actor: string; action: Action };
export type PairedIxNexusModulesOptions = {
  initial?: Game;
  advanced?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  program?: 'suboids' | 'faceDance';
};
export type PairedIxNexusModulesFixture = {
  initial: Game;
  afterSetup: Game;
  afterFirstStorm: Game;
  beforeFirstMentat: Game;
  afterFirstMentat: Game;
  beforeNexusDraw: Game;
  afterNexusDraw: Game;
  beforeBattle: Game;
  game: Game;
  ixians: string;
  tleilaxu: string;
  opponent: string;
  partners: [string, string];
  kind: 'arrakeen' | 'sietch_tabr';
  location: string;
  replacementSource: string;
  battleStep: PairedIxNexusModulesStep;
  planActions: PairedIxNexusModulesStep[];
  actions: PairedIxNexusModulesStep[];
  staging: string[];
};
export function pairedIxNexusModulesPlayer(game: Game, actor: string) {
  const p = game.players.find(player => player.id === actor);
  assert.ok(p, `Missing original paired E1 actor ${actor}`);
  return p;
}
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision;

/** Only real native windows; unsealed plans require explicit human submission. */
export function nextPairedIxNexusModulesStep(game: Game): PairedIxNexusModulesStep | null {
  if (clean(game) && game.nexusCards?.phase?.stage === 'drawing') {
    const actor = game.nexusCards.phase.eligible.find(id => !game.nexusCards!.phase!.done.includes(id));
    assert.ok(actor);
    return { actor, action: { type: 'nexusCardChoice', turn: game.turn, card: game.nexusCards.cards!.hands[actor] ?? null, choice: 'keep', ownRedraws: 0 } };
  }
  if (!game.phaseOpening && !game.response && game.decision?.kind === 'techToken')
    return { actor: game.decision.player, action: { type: 'decision', token: game.decision.choices[0] } };
  if (!game.phaseOpening && !game.response && game.decision?.kind === 'faceDance')
    return { actor: game.decision.player, action: { type: 'decision', reveal: false } };
  return nextStrongholdFactionsNativeStep(game);
}
function run(game: Game, step: PairedIxNexusModulesStep, actions: PairedIxNexusModulesStep[]): Game {
  actions.push(structuredClone(step));
  return applyAction(game, step.actor, step.action);
}
export function advancePairedIxNexusModules(state: Game, until: (game: Game) => boolean, actions: PairedIxNexusModulesStep[] = []): Game {
  let game = structuredClone(state);
  for (let n = 0; n < 2400; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextPairedIxNexusModulesStep(game);
    assert.ok(step, 'The paired native program requires an explicit human plan or Face Dance');
    game = run(game, step, actions);
  }
  throw Error('Paired E1 module continuation did not reach its native boundary');
}
function setupEntropy<T>(fn: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    assert.ok(array);
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(255);
    return array;
  };
  try { return fn(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
function reserveBoard(game: Game) {
  for (const p of game.players) {
    p.reserves += Object.values(p.forces).reduce((sum, count) => sum + count, 0);
    p.forces = {};
    if (p.elites) {
      p.elites.reserves += Object.values(p.elites.forces).reduce((sum, count) => sum + count, 0);
      p.elites.forces = {};
    }
  }
}
function place(game: Game, actor: string, location: string, total: number, elite = 0) {
  const p = pairedIxNexusModulesPlayer(game, actor);
  assert.ok(p.reserves >= total && (p.elites?.reserves ?? 0) >= elite && total >= elite);
  p.reserves -= total;
  p.forces[location] = (p.forces[location] ?? 0) + total;
  if (elite) {
    p.elites!.reserves -= elite;
    p.elites!.forces[location] = (p.elites!.forces[location] ?? 0) + elite;
  }
}
function heldCard(game: Game, actor: string, kind: Card['kind'], staging: string[]): string {
  const p = pairedIxNexusModulesPlayer(game, actor), held = p.hand.find(c => c.kind === kind);
  if (held) return held.id;
  const at = game.deck.findIndex(c => c.kind === kind);
  assert.ok(at >= 0 && p.hand.length < 4);
  const card = game.deck.splice(at, 1)[0];
  p.hand.push(card);
  staging.push(`Conserved ${card.id}: remaining original deck → ${actor} hand, after genuine first deal.`);
  return card.id;
}
/** Fresh CLI lobby or its original initialized undealt setup; preserve identities,
 * native first deal and wallets. Local entropy selects original shuffles only;
 * supplied snapshots use their saved native setup and real continuing randomness. */
export function createPairedIxNexusModulesFixture(options: PairedIxNexusModulesOptions = {}): PairedIxNexusModulesFixture {
  const advanced = options.advanced ?? options.initial?.advanced ?? true;
  const tech = options.tech ?? (options.initial ? !!options.initial.techTokens : true);
  const strongholds = options.strongholds ?? (options.initial ? !!options.initial.strongholdCards : advanced);
  const program = options.program ?? 'suboids';
  assert.ok(tech || strongholds);
  assert.ok(!strongholds || advanced);
  const actions: PairedIxNexusModulesStep[] = [], staging: string[] = [];
  let game = options.initial ? structuredClone(options.initial)
    : createGame('PAIREDIXNEXUSMODULES', newPlayer('ixians', 'Ixians', 'ixians'), advanced, ['ix']);
  if (!options.initial) for (const faction of ['tleilaxu', 'guild', 'emperor'] as const)
    joinGame(game, newPlayer(faction, faction, faction));
  assert.equal(game.advanced, advanced);
  assert.deepEqual(game.expansions, ['ix']);
  assert.deepEqual(game.players.map(p => p.faction).sort(), ['emperor', 'guild', 'ixians', 'tleilaxu']);
  assert.ok(game.status === 'lobby' || game.status === 'setup' && game.turn === 1 && game.phase === 0 && game.players.every(p => !p.hand.length));
  if (game.status === 'lobby') {
    if (!!game.techTokens !== tech) game = run(game, { actor: game.host, action: { type: 'techTokens', enabled: tech } }, actions);
    if (!!game.strongholdCards !== strongholds) game = run(game, { actor: game.host, action: { type: 'strongholdCards', enabled: strongholds } }, actions);
    // Nexus has no public optional-rules action; admit only its unused CLI component.
    game.nexusCards ??= { cards: null, phase: null };
    for (const p of game.players) if (!p.ready) game = run(game, { actor: p.id, action: { type: 'ready' } }, actions);
    game = options.initial ? initializePairedNexusGameForAudit(game) : setupEntropy(() => initializePairedNexusGameForAudit(game));
  }
  assert.ok(pairedNexusModulesProfile(game));
  assert.equal(!!game.techTokens, tech);
  assert.equal(!!game.strongholdCards, strongholds);
  const initial = structuredClone(game);
  const completeSetup = () => advancePairedIxNexusModules(game, state => state.status === 'playing', actions);
  game = options.initial ? completeSetup() : setupEntropy(completeSetup);
  const afterSetup = structuredClone(game);
  const ixians = game.players.find(p => p.faction === 'ixians')!.id;
  const tleilaxu = game.players.find(p => p.faction === 'tleilaxu')!.id;
  const classics = game.players.filter(p => p.faction === 'guild' || p.faction === 'emperor').map(p => p.id);
  const partners: [string, string] = [classics[0], classics[1]];
  // Conserved land ordering avoids a turn-one worm that cannot supply Nexus cards.
  for (let n = 0; n < 2; n++) {
    const at = game.spiceDeck.findIndex((card, index) => index >= n && 'territory' in card);
    assert.ok(at >= n);
    game.spiceDeck.splice(n, 0, game.spiceDeck.splice(at, 1)[0]);
  }
  game = advancePairedIxNexusModules(game, state => state.phase === 1 && clean(state), actions);
  const afterFirstStorm = structuredClone(game);
  const opponent = tech ? classics.find(id => ownedTech(game.techTokens, id).length)! : classics[0];
  assert.ok(opponent);
  const kind = program === 'faceDance' ? 'sietch_tabr' : 'arrakeen';
  const location = `${kind}:${territory(kind).sectors[0]}`;
  game = advancePairedIxNexusModules(game, state => state.phase === 8 && clean(state), actions);
  reserveBoard(game);
  place(game, ixians, location, 1);
  place(game, ixians, MOBILE_LOCATION, 6, 3);
  staging.push('Before genuine first END Mentat: conserved Ix counters control the printed site and HMS only; no third Stronghold, wallets or ownership assignment.');
  const beforeFirstMentat = structuredClone(game);
  game = advancePairedIxNexusModules(game, state => state.turn === 2, actions);
  const afterFirstMentat = structuredClone(game);
  game = advancePairedIxNexusModules(game, state => state.phase === 1 && clean(state), actions);
  const worm = game.spiceDeck.findIndex(c => 'worm' in c && !c.greatMaker && !c.suppressed);
  assert.ok(worm >= 0);
  game.spiceDeck.splice(0, 0, game.spiceDeck.splice(worm, 1)[0]);
  staging.push('After real second Storm: conserved original worm moved to the next Spice Blow; native worm resolution opens the alliance Nexus.');
  game = advancePairedIxNexusModules(game, state => !!state.nexus && !state.spiceWindow && !state.spiceResolution && clean(state), actions);
  game = run(game, { actor: partners[0], action: { type: 'alliance', target: partners[1] } }, actions);
  game = run(game, { actor: partners[1], action: { type: 'alliance', target: partners[0] } }, actions);
  game = advancePairedIxNexusModules(game, state => state.nexusCards?.phase?.stage === 'drawing', actions);
  const cards = game.nexusCards!.cards!;
  cards.deck = ['ixians', 'tleilaxu', ...cards.deck.filter(face => face !== 'ixians' && face !== 'tleilaxu')];
  staging.push('Order two conserved undealt Nexus singletons only; both native hands come from real closing Nexus draw actions.');
  const beforeNexusDraw = structuredClone(game);
  for (const actor of [ixians, tleilaxu]) game = run(game, { actor, action: { type: 'nexusCardChoice', turn: game.turn, card: null, choice: 'draw', ownRedraws: 0 } }, actions);
  game = advancePairedIxNexusModules(game, state => state.nexusCards?.phase?.stage !== 'drawing', actions);
  const afterNexusDraw = structuredClone(game);
  game = advancePairedIxNexusModules(game, state => state.phase === 5 && clean(state), actions);
  reserveBoard(game);
  place(game, ixians, location, 6, 3);
  if (program === 'suboids') {
    place(game, ixians, MOBILE_LOCATION, 4, 2);
    place(game, opponent, MOBILE_LOCATION, 2);
  }
  place(game, opponent, location, 6);
  const replacementSource = `arrakeen:${territory('arrakeen').sectors[0]}`;
  if (program === 'faceDance') place(game, tleilaxu, replacementSource, 3);
  staging.push('Before actual movement completion: conserved subtype forces create native battles, plus original reserve/board Face Dance sources. No phases, plans, payments or revealed flags are staged.');
  const ix = pairedIxNexusModulesPlayer(game, ixians);
  const leader = program === 'faceDance'
    ? ix.leaders.filter(l => !l.dead && pairedIxNexusModulesPlayer(game, tleilaxu).faceDancers!.some(c => c.leader === l.id && !c.revealed)).sort((a, b) => b.strength - a.strength)[0]
    : ix.leaders.filter(l => !l.dead).sort((a, b) => b.strength - a.strength)[0];
  assert.ok(leader, 'The original Face Dancer stock must include a living Ix leader for this human-ready source case');
  const enemy = pairedIxNexusModulesPlayer(game, opponent).leaders.filter(l => !l.dead).sort((a, b) => a.strength - b.strength)[0];
  assert.ok(enemy);
  const weapon = program === 'faceDance' ? heldCard(game, ixians, 'projectile', staging) : null;
  const defense = program === 'faceDance' ? heldCard(game, ixians, 'shield', staging) : null;
  game = advancePairedIxNexusModules(game, state => state.phase === 6 && clean(state), actions);
  const beforeBattle = structuredClone(game), actor = game.active!;
  assert.ok(actor === ixians || actor === opponent);
  const battleStep: PairedIxNexusModulesStep = { actor, action: { type: 'chooseBattle', territory: kind, target: actor === ixians ? opponent : ixians } };
  game = run(game, battleStep, actions);
  game = advancePairedIxNexusModules(game, state => !!state.battle && !state.battle.revealed && !nextPairedIxNexusModulesStep(state), actions);
  const planActions: PairedIxNexusModulesStep[] = [
    { actor: ixians, action: { type: 'battlePlan', dial: program === 'faceDance' ? 2 : advanced ? 4 : 6, support: advanced ? 1 : 0, leader: leader.id, weapon, defense } },
    { actor: opponent, action: { type: 'battlePlan', dial: 1, support: advanced ? 1 : 0, leader: enemy.id, weapon: null, defense: null } },
  ];
  return { initial, afterSetup, afterFirstStorm, beforeFirstMentat, afterFirstMentat, beforeNexusDraw, afterNexusDraw, beforeBattle, game, ixians, tleilaxu, opponent, partners, kind, location, replacementSource, battleStep, planActions, actions, staging };
}
export function revealPairedIxNexusModulesBattle(state: Game, plans: PairedIxNexusModulesStep[]): Game {
  let game = structuredClone(state);
  for (const step of plans) {
    game = applyAction(game, step.actor, step.action);
    game = advancePairedIxNexusModules(game, g => !g.response && g.decision?.kind !== 'fullPlanOffer');
  }
  assert.ok(game.battle?.revealed);
  return game;
}
export function finishPairedIxNexusModulesBattle(state: Game): Game {
  return advancePairedIxNexusModules(state, g => !g.battle && !g.decision && !g.response && !g.pendingTreacheryDiscard);
}
export function finishPairedIxNexusModulesTurn(state: Game): Game {
  return advancePairedIxNexusModules(state, g => g.turn > state.turn);
}
export function choosePairedIxMobileBattle(state: Game, ixians: string, opponent: string): Game {
  let game = advancePairedIxNexusModules(state, g => g.phase === 6 && clean(g) && !!g.active);
  const actor = game.active!;
  assert.ok(actor === ixians || actor === opponent);
  game = applyAction(game, actor, { type: 'chooseBattle', territory: MOBILE_STRONGHOLD, target: actor === ixians ? opponent : ixians });
  game = advancePairedIxNexusModules(game, g => g.decision?.kind === 'strongholdCopy' || !!g.battle && !g.battle.revealed && !nextPairedIxNexusModulesStep(g));
  if (game.decision?.kind === 'strongholdCopy') {
    assert.equal(game.decision.player, ixians);
    game = applyAction(game, ixians, { type: 'decision', event: game.decision.event, stronghold: 'arrakeen' });
    game = advancePairedIxNexusModules(game, g => !!g.battle && !g.battle.revealed && !nextPairedIxNexusModulesStep(g));
  }
  return game;
}

/** Next native turn, conserved Suboids alone make expiry observable by a real
 * fractional dial; no phase, Nexus receipt or budget is assigned. */
export function preparePairedIxExpiryBattle(state: Game, ixians: string, tleilaxu: string): Game {
  let game = advancePairedIxNexusModules(state, g => g.phase === 5 && clean(g));
  reserveBoard(game);
  const location = `arrakeen:${territory('arrakeen').sectors[0]}`;
  place(game, ixians, location, 3);
  place(game, tleilaxu, location, 2);
  game = advancePairedIxNexusModules(game, g => g.phase === 6 && clean(g));
  const actor = game.active!;
  assert.ok(actor === ixians || actor === tleilaxu);
  game = applyAction(game, actor, { type: 'chooseBattle', territory: 'arrakeen', target: actor === ixians ? tleilaxu : ixians });
  return advancePairedIxNexusModules(game, g => !!g.battle && !g.battle.revealed && !nextPairedIxNexusModulesStep(g));
}
