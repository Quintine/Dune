import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { territory } from '../game/board';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { DUKE_VIDAL_ID } from '../game/duke-vidal';
import { nativeShipmentSources } from '../game/homeworld-options';
import { nexusEcazDukeAction } from '../game/nexus-ecaz-duke-options';
import {
  createIndependentCardModulesFixture, type IndependentCardModulesOptions,
  type IndependentCardModulesStep,
} from './fixture-independent-card-modules';
import { nextClassicDiscoveryNexusStep, withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';

export type E3IndependentDukeOptions = Pick<IndependentCardModulesOptions,
  'advanced' | 'expansions' | 'factions' | 'homeworlds' | 'skills' | 'tech' | 'strongholds'>;
export type E3IndependentDukeStep = IndependentCardModulesStep;
export const e3IndependentDukePlayer = (game: Game, actor: string) => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const e3IndependentDukeClean = (game: Game) => !game.response && !game.decision &&
  !game.phaseOpening && !game.pendingTreacheryDiscard && !game.truthtrance &&
  !game.pendingGuildBetrayal && !game.pendingNexusIxianBetrayal && !game.pendingNexusHarkonnenBetrayal;

export function actE3IndependentDuke(game: Game, actor: string, action: Action,
  actions?: E3IndependentDukeStep[]): Game {
  actions?.push({ actor, action: structuredClone(action) });
  return withClassicDiscoveryNexusLottery(() => applyAction(game, actor, action));
}
export function nextE3IndependentDukeStep(game: Game): E3IndependentDukeStep | null {
  if (game.pendingGuildBetrayal) {
    const frame = game.pendingGuildBetrayal, actor = frame.required.find(id => !frame.passed.includes(id)); assert.ok(actor);
    return { actor, action: { type: 'guildBetrayalPass', event: frame.invoice.event } };
  }
  if (game.pendingNexusIxianBetrayal && !game.response && !game.phaseOpening) {
    const frame = game.pendingNexusIxianBetrayal, actor = frame.required.find(id => !frame.passed.includes(id)); assert.ok(actor);
    return { actor, action: { type: 'nexusIxianBetrayalPass', event: frame.source.event } };
  }
  if (game.pendingNexusHarkonnenBetrayal) {
    const frame = game.pendingNexusHarkonnenBetrayal, actor = frame.required.find(id => !frame.passed.includes(id)); assert.ok(actor);
    return { actor, action: { type: 'nexusHarkonnenBetrayalPass', event: frame.source.event } };
  }
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    const decision = game.decision;
    if (decision?.kind === 'nexusIxianReplacement') return { actor: decision.player,
      action: { type: 'nexusIxianReplacementPass', event: decision.event } };
    if (decision?.kind === 'homeworldShipmentGuild') return { actor: decision.player,
      action: { type: 'decision', event: decision.event, allow: true } };
    if (decision?.kind === 'leaderSkillVisibility') return { actor: decision.player,
      action: { type: 'leaderSkillVisibility', event: decision.event, hide: false } };
    if (decision?.kind === 'mentatQuestion' || decision?.kind === 'moritaniSpecialKarama')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, decline: true } };
    if (decision?.kind === 'moritaniPlacement' || decision?.kind === 'ecazPlacement') return { actor: decision.player,
      action: { type: 'decision', decline: true } };
    if (decision?.kind === 'techToken') return { actor: decision.player,
      action: { type: 'decision', token: decision.choices[0] } };
    if (decision?.kind === 'advisor' || decision?.kind === 'intrusion' || decision?.kind === 'advisorBattle')
      return { actor: decision.player, action: { type: 'decision', accept: false } };
  }
  return nextClassicDiscoveryNexusStep(game);
}
export function advanceE3IndependentDuke(game: Game, until: (state: Game) => boolean,
  actions: E3IndependentDukeStep[] = []): Game {
  for (let count = 0; count < 2200; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'Original Duke programme ended before the requested native boundary');
    const step = nextE3IndependentDukeStep(game);
    assert.ok(step, `Supply the original human plan at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actE3IndependentDuke(game, step.actor, step.action, actions);
  }
  throw Error('Independent E3 Duke programme did not reach its finite original boundary');
}

/** Only still-unopened original Spice Cards are ordered; every draw remains native. */
function orderSpice(game: Game, worm = false): void {
  const kinds = [...(worm ? ['worm'] : []), ...Array<string>(game.advanced ? 2 : 1).fill('land')];
  for (const [position, kind] of kinds.entries()) {
    const index = game.spiceDeck.findIndex((card, at) => at >= position && (kind === 'worm'
      ? 'worm' in card && !card.greatMaker && !card.suppressed : 'territory' in card && !card.discovery));
    assert.ok(index >= position); game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
  }
}

/** Actual setup, first turn, ordinary worm and closing draw. The printed draw
 * requires an alliance, so this acquisition programme needs at least three
 * seats: the other two real players ally, leaving Ecaz unallied.
 * Only unopened original lotteries are selected; dealt hands, wallets, force
 * locations, controller fields and historical records are never assigned. */
export function createE3IndependentNexusDuke(options: E3IndependentDukeOptions = {}) {
  const factions = options.factions ?? ['ecaz', 'guild', 'emperor'];
  assert.ok(factions.length >= 3, 'A closing draw needs an actual alliance and an unallied recipient.');
  const source = withClassicDiscoveryNexusLottery(() => createIndependentCardModulesFixture({
    ...options, factions, advanced: options.advanced ?? true, expansions: options.expansions ?? ['ecaz'],
    independent: true, nexus: true, tech: options.tech ?? factions.length >= 3,
    training: { ecaz: 'swordmaster-of-ginaz', guild: 'smuggler', emperor: 'sandmaster',
      ixians: 'planetologist', richese: 'warmaster', moritani: 'suk-graduate', atreides: 'bureaucrat' },
  }));
  const owner = source.game.players.find(player => player.faction === 'ecaz')?.id; assert.ok(owner);
  const others = source.game.players.filter(player => player.id !== owner).map(player => player.id);
  const actions = [...source.steps], staging: string[] = [];
  const afterSetup = structuredClone(source.game);
  let game = structuredClone(afterSetup);
  orderSpice(game);
  staging.push('Order only unopened first-turn land Spice Cards and the original second-turn worm; no played resources or phase clocks change.');
  game = advanceE3IndependentDuke(game, state => state.turn === 2 && state.phase === 1 && e3IndependentDukeClean(state), actions);
  const afterFirstTurn = structuredClone(game);
  orderSpice(game, true);
  game = advanceE3IndependentDuke(game, state => state.nexus && !state.spiceWindow &&
    !state.spiceResolution && e3IndependentDukeClean(state), actions);
  game = actE3IndependentDuke(game, others[0], { type: 'alliance', target: others[1] }, actions);
  game = actE3IndependentDuke(game, others[1], { type: 'alliance', target: others[0] }, actions);
  const alliance = structuredClone(game);
  game = advanceE3IndependentDuke(game, state => state.nexusCards?.phase?.stage === 'drawing' &&
    e3IndependentDukeClean(state), actions);
  assert.ok(game.nexusCards!.phase!.eligible.includes(owner));
  const cards = game.nexusCards!.cards!, at = cards.deck.indexOf('ecaz'); assert.ok(at >= 0);
  cards.deck.unshift(cards.deck.splice(at, 1)[0]);
  staging.push('Order the still-undrawn original Ecaz Nexus singleton before the real unallied closing draw.');
  const beforeDraw = structuredClone(game);
  const draw: E3IndependentDukeStep = { actor: owner, action: { type: 'nexusCardChoice', turn: game.turn,
    card: cards.hands[owner], choice: 'draw', ownRedraws: 0 } };
  game = actE3IndependentDuke(game, draw.actor, draw.action, actions);
  const afterDraw = structuredClone(game);
  game = advanceE3IndependentDuke(game, state => state.phase === 2 && e3IndependentDukeClean(state), actions);
  const beforeCunning = structuredClone(game), action = nexusEcazDukeAction(viewGame(game, owner)); assert.ok(action);
  const cunning: E3IndependentDukeStep = { actor: owner, action };
  game = actE3IndependentDuke(game, owner, action, actions);
  return { initial: source.initial, offered: source.offered, afterSetup, afterFirstTurn,
    owner, others, actions, staging, alliance, beforeDraw, draw, afterDraw, beforeCunning, cunning, game };
}
export type E3IndependentDukeFixture = ReturnType<typeof createE3IndependentNexusDuke>;

/** Two seats may select the module but cannot leave an unallied recipient
 * after forming an alliance. This actual worm closes without an alliance,
 * so its twelve original Nexus cards stay undrawn. */
export function createE3IndependentTwoSeatNexus(advanced = false) {
  const source = withClassicDiscoveryNexusLottery(() => createIndependentCardModulesFixture({
    advanced, factions: ['ecaz', 'guild'], expansions: ['ecaz'], independent: true,
    nexus: true, tech: false,
  }));
  const afterSetup = structuredClone(source.game), actions = [...source.steps];
  let game = structuredClone(afterSetup);
  orderSpice(game);
  game = advanceE3IndependentDuke(game, state => state.turn === 2 && state.phase === 1 &&
    e3IndependentDukeClean(state), actions);
  orderSpice(game, true);
  game = advanceE3IndependentDuke(game, state => state.nexus && !state.spiceWindow &&
    !state.spiceResolution && e3IndependentDukeClean(state), actions);
  const opened = structuredClone(game);
  game = advanceE3IndependentDuke(game, state => state.turn === 2 && state.phase === 2 &&
    !state.nexus && e3IndependentDukeClean(state), actions);
  return { initial: source.initial, offered: source.offered, afterSetup, opened, game, actions };
}

/** Use the acquired original shared disc in a genuinely funded invasion of the
 * Guild's original Tuek garrison; no battle position or defending hand is staged. */
export function useE3IndependentNexusDuke(fixture: E3IndependentDukeFixture) {
  const actions: E3IndependentDukeStep[] = [], owner = fixture.owner;
  let game = structuredClone(fixture.game);
  const opponent = game.players.find(player => player.faction === 'guild')?.id; assert.ok(opponent);
  game = advanceE3IndependentDuke(game, state => state.phase === 5 && state.active === owner &&
    e3IndependentDukeClean(state), actions);
  const place = territory('tueks_sietch'), sector = place.sectors[0];
  assert.ok(!place.sectors.includes(game.storm));
  const beforeShipment = structuredClone(game), sources = game.homeworlds
    ? nativeShipmentSources(viewGame(game, owner), 1, 0) : undefined;
  assert.ok(!game.homeworlds || sources);
  const shipment: E3IndependentDukeStep = { actor: owner, action: { type: 'ship', territory: place.id,
    sector, amount: 1, elite: 0, allyPayment: 0, ...(sources ? { homeworldSources: sources } : {}) } };
  game = actE3IndependentDuke(game, owner, shipment.action, actions);
  game = advanceE3IndependentDuke(game, state => state.phase === 6 && !!state.active &&
    e3IndependentDukeClean(state), actions);
  const beforeBattle = structuredClone(game), choice = viewGame(game, game.active!).battleChoices.find(candidate =>
    candidate.territory === place.id && [candidate.attacker, candidate.defender].includes(owner) &&
    [candidate.attacker, candidate.defender].includes(opponent)); assert.ok(choice);
  game = actE3IndependentDuke(game, choice.chooser, { type: 'chooseBattle', territory: place.id,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker }, actions);
  game = advanceE3IndependentDuke(game, state => !!state.battle && e3IndependentDukeClean(state) &&
    !state.battle.preparation && state.battle.preLeader?.closed !== false, actions);
  const beforePlans = structuredClone(game), trained = new Set(game.leaderSkills?.assignments.map(assignment => assignment.leader));
  const enemy = e3IndependentDukePlayer(game, opponent).leaders.filter(leader => !leader.dead &&
    !leader.usedAt && !trained.has(leader.id)).sort((a, b) => a.strength - b.strength)[0]; assert.ok(enemy);
  for (const step of [
    { actor: owner, action: { type: 'battlePlan', leader: DUKE_VIDAL_ID, dial: 1, support: game.advanced ? 1 : 0 } },
    { actor: opponent, action: { type: 'battlePlan', leader: enemy.id, dial: 0, support: 0 } },
  ] satisfies E3IndependentDukeStep[]) {
    game = actE3IndependentDuke(game, step.actor, step.action, actions);
    game = advanceE3IndependentDuke(game, state => !!state.battle && e3IndependentDukeClean(state) &&
      !state.battle.preparation && state.battle.preLeader?.closed !== false, actions);
  }
  const revealed = structuredClone(game);
  assert.equal(revealed.battle!.plans[owner].leader, DUKE_VIDAL_ID);
  game = advanceE3IndependentDuke(game, state => !state.battle && e3IndependentDukeClean(state), actions);
  return { game, actions, opponent, territory: place.id, beforeShipment, shipment, beforeBattle, beforePlans, revealed };
}

export function expireE3IndependentNexusDuke(fixture: E3IndependentDukeFixture) {
  const actions: E3IndependentDukeStep[] = [];
  const game = advanceE3IndependentDuke(structuredClone(fixture.game), state =>
    state.turn > fixture.game.turn && state.phase === 0 && e3IndependentDukeClean(state), actions);
  return { game, actions };
}

/** Callable finite legality smoke for owner verification; this is not AI calibration. */
export function smokeE3IndependentNexusDuke(options: E3IndependentDukeOptions = {}) {
  const fixture = createE3IndependentNexusDuke(options);
  return DIFFICULTIES.map(difficulty => {
    const game = structuredClone(fixture.beforeCunning), view = viewGame(game, fixture.owner);
    view.players.find(player => player.id === fixture.owner)!.bot = difficulty;
    const action = botActions(view).find(candidate => candidate.type === 'nexusEcazDuke'); assert.ok(action, difficulty);
    const actions: E3IndependentDukeStep[] = [];
    const acquired = actE3IndependentDuke(game, fixture.owner, action, actions);
    const expired = advanceE3IndependentDuke(acquired, state => state.turn > game.turn &&
      state.phase === 0 && e3IndependentDukeClean(state), actions);
    assert.equal(expired.dukeVidal!.controller, null);
    return { difficulty, actions: actions.length, turn: expired.turn, phase: expired.phase,
      discarded: expired.nexusCards!.cards!.discard.filter(card => card === 'ecaz').length };
  });
}
