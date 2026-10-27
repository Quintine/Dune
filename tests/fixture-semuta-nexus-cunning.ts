import assert from 'node:assert/strict';
import {
  applyAction, createGame, handLimit, initializeSemutaGameForAudit, joinGame,
  newPlayer, viewGame, type Action, type Game, type Player,
} from '../game/engine';
import { gameDistance, splitLocation, TERRITORIES } from '../game/board';
import type { Card } from '../game/cards';
import { choamPowerAction, choamPowerPlays } from '../game/choam-power-options';
import { validateNexusCards } from '../game/nexus-cards';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { nextRicheseSkillsTechNativeStep } from './fixture-richese-skills-tech';

export type SemutaNexusCunningStep = { actor: string; action: Action };
export type SemutaNexusCunningOptions = {
  initial?: Game;
  advanced?: boolean;
  skills?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  fullHand?: boolean;
  costKind?: 'projectile' | 'snooper' | 'special';
};
export type SemutaNexusCunningFixture = {
  game: Game;
  initial: Game;
  setup: Game;
  afterFirstStorm: Game;
  drawBefore: Game;
  drawAfter: Game;
  actions: SemutaNexusCunningStep[];
  staging: string[];
  owner: string;
  holder: string;
  target: string;
  other: string;
  cost: Card;
  semuta: string;
  cards: string[];
};
export type SemutaNexusCunningProactiveFixture = SemutaNexusCunningFixture & {
  effect: 'kulon' | 'gamont';
  action: Action;
  selection: Record<string, unknown>;
  from: string;
  move?: Action;
  elite: 0 | 1;
  karama: string;
};
export function gamePlayer(game: Game, id: string): Player {
  const player = game.players.find(p => p.id === id);
  assert.ok(player, `Missing original ${id} seat`);
  return player;
}
export function semutaNexusCunningInventory(game: Game): string[] {
  const cards = [...game.deck, ...game.discard, ...(game.richeseCache ?? []),
    ...(game.richeseRemoved ?? []), ...(game.auction?.cards.slice(game.auction.index) ?? []),
    ...game.players.flatMap(p => p.hand)].map(c => c.id).sort();
  assert.equal(new Set(cards).size, cards.length, 'Each original Treachery Card keeps one physical slot');
  validateNexusCards(game.nexusCards!.cards!, game.players);
  return cards;
}
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision;

/** Original no-spend phase policy, actual training, and neutral acknowledgements.
 * In particular this never spends a secretly held Nexus while seeking a window. */
export function nextSemutaNexusCunningStep(game: Game): SemutaNexusCunningStep {
  const pending = game.pendingTreacheryDiscard, reaction = pending?.reaction;
  if (reaction?.stage === 'offer' && pending) {
    const actor = game.players.find(p => !reaction.passed.includes(p.id))!.id;
    return { actor, action: { type: 'semutaPass', event: pending.batch.event } };
  }
  if (clean(game) && game.nexusCards?.phase?.stage === 'drawing') {
    const actor = game.nexusCards.phase.eligible.find(id => !game.nexusCards!.phase!.done.includes(id));
    assert.ok(actor);
    return { actor, action: { type: 'nexusCardChoice', turn: game.turn,
      card: game.nexusCards.cards!.hands[actor], choice: 'keep', ownRedraws: 0 } };
  }
  if (game.status === 'setup' && game.setupStage === 'leaderSkills') {
    const actor = Object.keys(game.leaderSkills!.offers)[0];
    const offer = game.leaderSkills!.offers[actor], own = viewGame(game, actor).leaderSkills!;
    const safe = ['warmaster', 'swordmaster-of-ginaz', 'killer-medic', 'prana-bindu-adept'];
    const skill = offer.cards.find(c => safe.includes(c) && !own.unavailableSkills?.[c])
      ?? offer.cards.find(c => !own.unavailableSkills?.[c]);
    assert.ok(skill && own.eligibleLeaders[0], 'Actual original training must have a legal offered skill and leader');
    return { actor, action: { type: 'leaderSkill', event: offer.event, skill, leader: own.eligibleLeaders[0].id } };
  }
  if (!game.phaseOpening && !game.response &&
    (game.decision?.kind === 'choamMarket' || game.decision?.kind === 'choamMentat'))
    return { actor: game.decision.player, action: { type: 'decision', done: true } };
  // Fresh Advanced games use the actual ordered Charity and Revival queues;
  // the older generic native fixture assumed simultaneous ready actions.
  if (game.status === 'playing' && !game.phaseOpening && !game.response && !game.decision) {
    const actor = game.phase === 2 ? game.charityOrder?.remaining[0]
      : game.phase === 4 ? game.revivalOrder?.remaining[0] : undefined;
    if (actor) return { actor, action: { type: 'ready' } };
  }
  return nextRicheseSkillsTechNativeStep(game);
}
export function advanceSemutaNexusCunning(
  state: Game, until: (game: Game) => boolean, actions: SemutaNexusCunningStep[] = [],
): Game {
  let game = state;
  for (let n = 0; n < 1800; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original native path must reach its requested boundary');
    const next = nextSemutaNexusCunningStep(game);
    actions.push(next); game = applyAction(game, next.actor, next.action);
  }
  throw Error('Original Semuta Cunning actions did not reach the requested boundary');
}
function orderUnplayedSpice(game: Game, kinds: ('land' | 'worm')[], staging: string[]): void {
  for (const [position, kind] of kinds.entries()) {
    const index = game.spiceDeck.findIndex((c, i) => i >= position &&
      (kind === 'land' ? 'territory' in c : 'worm' in c));
    assert.ok(index >= position, `An original unplayed ${kind} Spice Card must remain`);
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
  }
  staging.push(`Conserved original unplayed Spice order: ${kinds.join(', ')}.`);
}
export function reserveSemutaNexusCunningBoard(game: Game, staging: string[]): void {
  for (const player of game.players) {
    // Main force and reserve totals include the separately tracked elite subset.
    const total = Object.values(player.forces).reduce((sum, n) => sum + n, 0);
    const elites = Object.values(player.elites?.forces ?? {}).reduce((sum, n) => sum + n, 0);
    player.reserves += total;
    player.forces = {};
    if (player.elites) { player.elites.reserves += elites; player.elites.forces = {}; }
  }
  staging.push('Later original board counters returned to their own normal/elite reserves; clocks, wallets and losses unchanged.');
}
export function holdSemutaNexusCunningCard(
  game: Game, actor: string, predicate: (card: Card) => boolean, staging: string[] = [],
): Card {
  const player = gamePlayer(game, actor), held = player.hand.find(predicate);
  if (held) return held;
  assert.ok(player.hand.length < handLimit(player));
  for (const zone of [game.deck, game.discard, game.richeseCache!, ...game.players.filter(p => p.id !== actor).map(p => p.hand)]) {
    const index = zone.findIndex(predicate);
    if (index < 0) continue;
    const card = zone.splice(index, 1)[0]; player.hand.push(card);
    staging.push(`Conserved canonical ${card.id} into ${actor}'s hand.`);
    return card;
  }
  throw Error('The requested original physical Treachery Card is unavailable');
}
function swapDrawnChoam(game: Game, owner: string): void {
  const cards = game.nexusCards!.cards!, previous = cards.hands[owner];
  assert.ok(previous, 'Native CHOAM must earn its actual closing Nexus draw before any identity staging');
  if (previous === 'choam') return;
  const donor = Object.keys(cards.hands).find(id => cards.hands[id] === 'choam');
  if (donor) cards.hands[donor] = previous;
  else {
    const zone = cards.deck.includes('choam') ? cards.deck : cards.discard;
    const index = zone.indexOf('choam'); assert.ok(index >= 0);
    zone[index] = previous;
  }
  cards.hands[owner] = 'choam';
  validateNexusCards(cards, game.players);
}

/** Fresh paired native setup, first Storm/Mentat and real turn-two worm. Atreides
 * and Emperor ally; unallied CHOAM draws and Richese declines. Only after that
 * earned draw do original Nexus/Treachery identities move between physical slots. */
export function createSemutaNexusCunningStart(options: SemutaNexusCunningOptions = {}): SemutaNexusCunningFixture {
  let game = options.initial ? structuredClone(options.initial)
    : createGame('SEMUTANEXUSCUNNING', newPlayer('r', 'Richese', 'richese'), options.advanced ?? false, ['choam']);
  if (!options.initial) {
    joinGame(game, newPlayer('e', 'CHOAM', 'choam'));
    joinGame(game, newPlayer('a', 'Atreides', 'atreides'));
    joinGame(game, newPlayer('b', 'Emperor', 'emperor'));
  }
  assert.equal(game.status, 'lobby'); assert.deepEqual(game.expansions, ['choam']);
  assert.equal(game.players.length, 4);
  if (options.advanced !== undefined) assert.equal(game.advanced, options.advanced);
  const idFor = (faction: Player['faction']) => {
    const player = game.players.find(p => p.faction === faction); assert.ok(player); return player.id;
  };
  const owner = idFor('choam'), holder = idFor('richese'), target = idFor('atreides'), other = idFor('emperor');
  if (options.tech !== undefined) game = applyAction(game, game.host, { type: 'techTokens', enabled: options.tech });
  if (options.strongholds !== undefined) game = applyAction(game, game.host, { type: 'strongholdCards', enabled: options.strongholds });
  for (const player of game.players) if (!player.ready) game = applyAction(game, player.id, { type: 'ready' });
  // Existing fresh lobby module selection: the initializer, not this fixture, deals the packet.
  game.nexusCards ??= { cards: null, phase: null };
  assert.equal(game.nexusCards.cards, null); assert.equal(game.nexusCards.phase, null);
  const initial = structuredClone(game), actions: SemutaNexusCunningStep[] = [], staging: string[] = [];
  game = initializeSemutaGameForAudit(game, options.skills ?? false);
  const setup = structuredClone(game);
  game = advanceSemutaNexusCunning(game, g => g.status === 'playing', actions);
  assert.ok(Object.values(game.nexusCards!.cards!.hands).every(card => card === null), 'No starting Nexus hand');
  const cards = semutaNexusCunningInventory(game);
  game = advanceSemutaNexusCunning(game, g => g.phase === 1 && clean(g), actions);
  const afterFirstStorm = structuredClone(game);
  orderUnplayedSpice(game, ['land', 'land'], staging);
  game = advanceSemutaNexusCunning(game, g => g.phase === 5 && clean(g), actions);
  reserveSemutaNexusCunningBoard(game, staging);
  game = advanceSemutaNexusCunning(game, g => g.turn === 2 && g.phase === 1 && clean(g), actions);
  assert.ok(Object.values(game.nexusCards!.cards!.hands).every(card => card === null));
  orderUnplayedSpice(game, ['worm', 'land', 'land'], staging);
  game = advanceSemutaNexusCunning(game, g => g.nexus && !g.spiceWindow && !g.spiceResolution && clean(g), actions);
  for (const [actor, targetId] of [[target, other], [other, target]]) {
    const action: Action = { type: 'alliance', target: targetId };
    actions.push({ actor, action }); game = applyAction(game, actor, action);
  }
  game = advanceSemutaNexusCunning(game, g => g.nexusCards?.phase?.stage === 'drawing', actions);
  assert.deepEqual([...game.nexusCards!.phase!.eligible].sort(), [owner, holder].sort());
  const drawBefore = structuredClone(game);
  for (const actor of game.nexusCards!.phase!.eligible) {
    const action: Action = { type: 'nexusCardChoice', turn: game.turn,
      card: game.nexusCards!.cards!.hands[actor], choice: actor === owner ? 'draw' : 'keep', ownRedraws: 0 };
    actions.push({ actor, action }); game = applyAction(game, actor, action);
  }
  assert.equal(game.nexusCards!.phase!.stage, 'complete');
  const drawAfter = structuredClone(game);
  swapDrawnChoam(game, owner);
  staging.push('Only after real turn-two qualifying draw, exchanged its identity with the existing CHOAM Nexus slot.');
  game = advanceSemutaNexusCunning(game, g => g.phase === 2 && clean(g), actions);
  const wallets = game.players.map(p => p.spice);
  for (const player of game.players) game.deck.push(...player.hand.splice(0));
  staging.push('At real Charity, returned original held Treachery Cards to deck before conserving later Semuta/fuel positions.');
  const semuta = holdSemutaNexusCunningCard(game, holder, c => c.id === SEMUTA_DRUG_ID, staging).id;
  const kind = options.costKind ?? 'projectile';
  const cost = holdSemutaNexusCunningCard(game, owner,
    c => c.kind === kind && (kind !== 'special' || c.effect === 'hajr'), staging);
  if (options.fullHand) {
    const player = gamePlayer(game, holder);
    while (player.hand.length < handLimit(player))
      holdSemutaNexusCunningCard(game, holder, c => c.kind !== 'worthless' && !player.hand.some(h => h.id === c.id), staging);
  }
  assert.deepEqual(semutaNexusCunningInventory(game), cards);
  assert.deepEqual(game.players.map(p => p.spice), wallets);
  return { game, initial, setup, afterFirstStorm, drawBefore, drawAfter, actions, staging,
    owner, holder, target, other, cost: structuredClone(cost), semuta, cards };
}
export function reactSemutaNexusCunning(state: Game, fixture: SemutaNexusCunningFixture, claim: boolean): Game {
  const event = state.pendingTreacheryDiscard!.batch.event;
  if (claim) return applyAction(state, fixture.holder, { type: 'semutaCommit', event });
  let game = state;
  for (const player of state.players) game = applyAction(game, player.id, { type: 'semutaPass', event });
  return game;
}
export function quoteSemutaNexusCunningAction(
  game: Game, fixture: SemutaNexusCunningFixture, effect: 'kulon' | 'gamont', selection: Record<string, unknown> = {},
): Action {
  const own = viewGame(game, fixture.owner);
  const play = choamPowerPlays(own, effect).find(p => p.source === 'nexus' && p.card.id === fixture.cost.id);
  assert.ok(play && !play.blocked, 'Original private Cunning quote must offer the actual canonical fuel');
  const action = choamPowerAction(own, play, selection); assert.ok(action);
  return action;
}
export function allowSemutaNexusCunning(state: Game, actions: SemutaNexusCunningStep[] = []): Game {
  let game = state;
  for (let n = 0; game.response && n < 30; n++) {
    const actor = game.players.find(p => {
      const controls = viewGame(game, p.id).responseControls;
      return controls && !controls.hasPassed && controls.cancelCards.length > 0;
    })?.id;
    assert.ok(actor, 'Original ordinary CHOAM response needs a legal remaining responder');
    const action: Action = { type: 'passResponse' };
    actions.push({ actor, action }); game = applyAction(game, actor, action);
  }
  assert.equal(game.response, null);
  return game;
}
export function createSemutaNexusCunningProactive(
  effect: 'kulon' | 'gamont', options: SemutaNexusCunningOptions & { elite?: boolean } = {},
): SemutaNexusCunningProactiveFixture {
  const f = createSemutaNexusCunningStart(options);
  let game = advanceSemutaNexusCunning(f.game, g => g.phase === 5 && clean(g), f.actions);
  reserveSemutaNexusCunningBoard(game, f.staging);
  let from: string, move: Action | undefined, elite: 0 | 1 = 0;
  let selection: Record<string, unknown> = {};
  if (effect === 'kulon') {
    game = advanceSemutaNexusCunning(game, g => g.phase === 5 && g.active === f.owner && clean(g), f.actions);
    const keys = TERRITORIES.filter(t => t.type !== 'stronghold').flatMap(t => t.sectors.map(s => `${t.id}:${s}`));
    const source = keys.find(key => splitLocation(key).sector !== game.storm && keys.some(to =>
      splitLocation(to).territory !== splitLocation(key).territory && splitLocation(to).sector !== game.storm &&
      gameDistance(game, key, to, k => splitLocation(k).sector === game.storm) === 2));
    assert.ok(source); from = source;
    const to = keys.find(key => splitLocation(key).territory !== splitLocation(from).territory &&
      splitLocation(key).sector !== game.storm && gameDistance(game, from, key, k => splitLocation(k).sector === game.storm) === 2)!;
    const owner = gamePlayer(game, f.owner); assert.ok(owner.reserves >= 2);
    owner.reserves -= 2; owner.forces[from] = 2;
    move = { type: 'move', forces: { [from]: 1 }, ...splitLocation(to) };
    f.staging.push('At original CHOAM Movement, conserved two normal reserve forces into one desert origin, with a genuine distance-two destination.');
  } else {
    game = advanceSemutaNexusCunning(game, g => g.phase === 7 && clean(g), f.actions);
    const territory = TERRITORIES.find(t => t.id === 'arrakeen')!;
    from = `${territory.id}:${territory.sectors[0]}`;
    const target = gamePlayer(game, options.elite ? f.other : f.target);
    elite = options.elite ? 1 : 0;
    assert.ok(target.reserves > 0); target.reserves--;
    if (elite) { assert.ok(target.elites && target.elites.reserves > 0); target.elites.reserves--; target.elites.forces[from] = 1; }
    target.forces[from] = 1;
    f.staging.push(`At real Collection, conserved one original ${elite ? 'Emperor elite' : 'Atreides normal'} force at Arrakeen before the closing Mentat window.`);
    game = advanceSemutaNexusCunning(game, g => g.phase === 8 && g.decision?.kind === 'choamMentat', f.actions);
    assert.equal(game.decision!.player, f.owner);
    selection = { target: target.id, from, elite };
  }
  const karama = holdSemutaNexusCunningCard(game, f.other, c => c.effect === 'karama', f.staging).id;
  const action = quoteSemutaNexusCunningAction(game, f, effect, selection);
  return { ...f, game, effect, action, selection, from, move, elite, karama };
}
