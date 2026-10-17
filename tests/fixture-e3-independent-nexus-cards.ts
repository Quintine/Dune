import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { leaders, spiceDeck, treacheryDeck } from '../game/cards';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import { NEXUS_FACTIONS } from '../game/nexus-cards';
import { CHEAP_HERO_TRAITOR } from '../game/traitors';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import { RECRUITS_CARD_ID } from '../game/recruits';
import { skillOfferRolls, type IndependentCardModulesStep } from './fixture-independent-card-modules';
import { nextMoritaniNexusStep } from './fixture-e3-nexus-moritani';

export type E3IndependentNexusCardStep = IndependentCardModulesStep;
export type E3IndependentNexusCardOptions = {
  advanced?: boolean;
  skills?: boolean;
  homeworlds?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  expansions?: Game['expansions'];
};
export const e3IndependentNexusCardPlayer = (game: Game, actor: string) => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const e3IndependentNexusCardsClean = (game: Game) => !game.response && !game.phaseOpening && !game.decision &&
  !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingGuildBetrayal &&
  !game.pendingNexusIxianBetrayal && !game.pendingNexusHarkonnenBetrayal;

function originalLottery<T>(rolls: readonly number[], operation: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues'), native = crypto.getRandomValues.bind(crypto);
  let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) array[0] = rolls[cursor++] ?? 0xffffffff;
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return operation(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
const unchangedShuffle = (count: number) => Array<number>(count).fill(0xffffffff);
/** Order only the original undealt Traitor lottery. The card is genuinely
 * offered and chosen; no played Traitor hand or reserve is exchanged. */
function originalGuildTraitorRolls(game: Game, target: string): number[] {
  const source = [...game.players.flatMap(player => leaders(player.faction).map(leader => leader.id)),
    ...(game.expansions.includes('ix') ? [CHEAP_HERO_TRAITOR] : [])];
  const desired = [...source], at = desired.indexOf(target); assert.ok(at >= 0);
  [desired[0], desired[at]] = [desired[at], desired[0]];
  const working = [...source], rolls: number[] = [];
  for (let index = working.length - 1; index > 0; index--) {
    const from = working.indexOf(desired[index]); assert.ok(from >= 0 && from <= index);
    rolls.push(Math.floor((from + 0.5) * 0x100000000 / (index + 1)));
    [working[index], working[from]] = [working[from], working[index]];
  }
  return rolls;
}
export function actE3IndependentNexusCard(game: Game, actor: string, action: Action,
  actions?: E3IndependentNexusCardStep[]): Game {
  actions?.push({ actor, action: structuredClone(action) });
  return originalLottery([], () => applyAction(game, actor, action));
}
function nextE3IndependentNexusCard(game: Game): E3IndependentNexusCardStep | null {
  if (game.pendingGuildBetrayal) {
    const pending = game.pendingGuildBetrayal, actor = pending.required.find(actor => !pending.passed.includes(actor)); assert.ok(actor);
    return { actor, action: { type: 'guildBetrayalPass', event: pending.invoice.event } };
  }
  if (game.pendingNexusIxianReplacement) return { actor: game.pendingNexusIxianReplacement.buyer,
    action: { type: 'nexusIxianReplacementPass', event: game.pendingNexusIxianReplacement.event } };
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard) {
    const decision = game.decision;
    if (decision?.kind === 'moritaniAssassinate') return null;
    if (decision?.kind === 'techToken') return { actor: decision.player,
      action: { type: 'decision', token: decision.choices[0] } };
    if (decision?.kind === 'moritaniPlacement') return { actor: decision.player,
      action: { type: 'decision', decline: true } };
    if (decision?.kind === 'leaderSkillVisibility') return { actor: decision.player,
      action: { type: 'leaderSkillVisibility', event: decision.event, hide: false } };
    if (decision?.kind === 'mentatQuestion') return { actor: decision.player,
      action: { type: 'decision', event: decision.event, decline: true } };
    if (decision?.kind === 'battleCards') return { actor: decision.player,
      action: { type: 'decision', discard: [...decision.cards] } };
  }
  return nextMoritaniNexusStep(game);
}
export function advanceE3IndependentNexusCards(game: Game, until: (state: Game) => boolean,
  actions: E3IndependentNexusCardStep[] = []): Game {
  for (let count = 0; count < 2500; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Moritani programme ended before its card control');
    const step = nextE3IndependentNexusCard(game);
    assert.ok(step, `Choose the original human ${game.decision?.kind ?? 'Battle Plan'} at ${game.turn}/${game.phase}`);
    game = actE3IndependentNexusCard(game, step.actor, step.action, actions);
  }
  throw Error('The original E3 independent/Nexus programme did not reach its requested boundary');
}
function orderOriginalBlow(game: Game, worm = false): void {
  const front: Game['spiceDeck'] = [];
  if (worm) {
    const at = game.spiceDeck.findIndex(card => 'worm' in card && !card.greatMaker && !card.suppressed && !card.thumper);
    assert.ok(at >= 0); front.push(game.spiceDeck.splice(at, 1)[0]);
  }
  for (let count = 0; count < (game.advanced ? 2 : 1); count++) {
    const at = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery &&
      !['pasty_mesa', 'tueks_sietch'].includes(card.territory));
    assert.ok(at >= 0); front.push(game.spiceDeck.splice(at, 1)[0]);
  }
  game.spiceDeck.unshift(...front);
}

/** Ordinary fresh lobby selections and original skill/Nexus/card/Traitor
 * shuffles. The real six-counter Pasty Mesa start remains unchanged. */
export function createE3IndependentNexusCardSetup(options: E3IndependentNexusCardOptions = {}) {
  let game = createGame('E3INDEPENDENTNEXUSCARDS', newPlayer('moritani', 'Moritani', 'moritani'),
    options.advanced ?? true, options.expansions ?? ['ecaz']);
  joinGame(game, newPlayer('guild', 'Guild', 'guild'));
  joinGame(game, newPlayer('emperor', 'Emperor', 'emperor'));
  const actions: E3IndependentNexusCardStep[] = [], staging: string[] = [];
  const act = (actor: string, action: Action) => { game = actE3IndependentNexusCard(game, actor, action, actions); };
  for (const selection of ['ecazTreachery', 'nexusCards', ...(options.skills ? ['leaderSkills'] : [])])
    act(game.host, { type: 'moduleOption', module: selection, enabled: true });
  for (const [type, enabled] of [['homeworlds', options.homeworlds], ['techTokens', options.tech], ['strongholdCards', options.strongholds]] as const)
    if (enabled) act(game.host, { type, enabled: true });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const initial = structuredClone(game), target = 'guild-1';
  const training = { moritani: 'warmaster', guild: 'killer-medic', emperor: 'master-of-assassins' } as const;
  const rolls = options.skills ? skillOfferRolls(game, training) : [];
  rolls.push(...unchangedShuffle(NEXUS_FACTIONS.length - 1));
  rolls.push(...unchangedShuffle(treacheryDeck(game.expansions).length + ecazTreacheryCards().length - 1));
  rolls.push(...unchangedShuffle(spiceDeck(game.expansions.includes('ix')).length - 1));
  if (!options.skills) rolls.push(...originalGuildTraitorRolls(game, target));
  const start: E3IndependentNexusCardStep = { actor: game.host,
    action: game.advanced ? { type: 'start', advancedPreview: true } : { type: 'start' } };
  actions.push(structuredClone(start));
  game = originalLottery(rolls, () => applyAction(game, start.actor, start.action));
  const offered = structuredClone(game);
  for (let count = 0; game.status === 'setup' && count < 300; count++) {
    if (game.setupStage === 'leaderSkills' && !game.decision) {
      const actor = Object.keys(game.leaderSkills!.offers)[0], own = viewGame(game, actor).leaderSkills!;
      const skill = training[e3IndependentNexusCardPlayer(game, actor).faction as keyof typeof training];
      const leader = own.eligibleLeaders.find(leader => leader.id === (actor === 'guild' ? target : `${actor}-0`));
      assert.ok(leader && own.offer!.cards.includes(skill) && !own.unavailableSkills?.[skill]);
      const step: E3IndependentNexusCardStep = { actor,
        action: { type: 'leaderSkill', event: own.offer!.event, skill, leader: leader.id } };
      actions.push(structuredClone(step));
      const finalOffer = Object.keys(game.leaderSkills!.offers).length === 1;
      game = originalLottery(finalOffer ? [...unchangedShuffle(game.leaderSkills!.deck.length), ...originalGuildTraitorRolls(game, target)] : [],
        () => applyAction(game, step.actor, step.action));
      continue;
    }
    if (game.setupStage === 'traitors' || game.players.some(player => player.traitorChoices.length)) {
      const player = game.players.find(player => player.traitorChoices.length); assert.ok(player);
      const card = player.id === 'moritani' ? player.traitorChoices.find(card => card === target) : player.traitorChoices[0];
      assert.ok(card, 'The original shuffled Traitor offer must contain the selected target');
      act(player.id, { type: 'traitor', leader: card });
      continue;
    }
    if (game.decision?.kind === 'moritaniSetup') {
      act(game.decision.player, { type: 'decision', territory: 'pasty_mesa', sector: 5 });
      continue;
    }
    const step = nextE3IndependentNexusCard(game); assert.ok(step); act(step.actor, step.action);
  }
  assert.equal(game.status, 'playing');
  assert.deepEqual(e3IndependentNexusCardPlayer(game, 'moritani').traitors, [target]);
  assert.deepEqual(e3IndependentNexusCardPlayer(game, 'moritani').forces, { 'pasty_mesa:5': 6 });
  staging.push('Select original unused skill/Nexus/Treachery/Spice/Traitor lotteries before their real deals; Moritani actually chooses the offered unused Guild Traitor.');
  return { initial, offered, afterSetup: structuredClone(game), game, actions, staging, target };
}
function buyOriginalE3Independent(game: Game, card: string, actions: E3IndependentNexusCardStep[]): Game {
  for (let count = 0; count < 500; count++) {
    if (e3IndependentNexusCardPlayer(game, 'moritani').hand.some(held => held.id === card)) return game;
    let step: E3IndependentNexusCardStep | null;
    if (e3IndependentNexusCardsClean(game) && game.auction && game.auction.cards[game.auction.index]?.id === card) {
      const auction = game.auction;
      step = { actor: auction.active, action: auction.active === 'moritani' && auction.bidder !== 'moritani'
        ? { type: 'bid', amount: 1, allyPayment: 0 } : { type: 'passBid' } };
    } else step = nextE3IndependentNexusCard(game);
    assert.ok(step); game = actE3IndependentNexusCard(game, step.actor, step.action, actions);
  }
  throw Error('The original E3 auction did not deliver its physical independent card');
}

/** Genuine bank purchases and first Mentat, then original worm/alliance/closing
 * draw. The held Tleilaxu Nexus remains a separate unused physical card. */
export function createE3IndependentNexusCardProgramme(options: E3IndependentNexusCardOptions = {}) {
  const source = createE3IndependentNexusCardSetup(options), actions = source.actions;
  let game = structuredClone(source.game);
  for (const card of [RECRUITS_CARD_ID, REINFORCEMENTS_CARD]) {
    const at = game.deck.findIndex(face => face.id === card); assert.ok(at >= 0);
    game.deck.unshift(game.deck.splice(at, 1)[0]);
  }
  orderOriginalBlow(game);
  game = buyOriginalE3Independent(game, REINFORCEMENTS_CARD, actions);
  game = buyOriginalE3Independent(game, RECRUITS_CARD_ID, actions);
  const afterPurchases = structuredClone(game);
  game = advanceE3IndependentNexusCards(game, state => state.turn === 2 && state.phase === 1 && e3IndependentNexusCardsClean(state), actions);
  orderOriginalBlow(game, true);
  game = advanceE3IndependentNexusCards(game, state => state.nexus && !state.spiceWindow && !state.spiceResolution && e3IndependentNexusCardsClean(state), actions);
  const beforeAlliance = structuredClone(game);
  for (const [actor, target] of [['guild', 'emperor'], ['emperor', 'guild']])
    game = actE3IndependentNexusCard(game, actor, { type: 'alliance', target }, actions);
  game = advanceE3IndependentNexusCards(game, state => state.nexusCards?.phase?.stage === 'drawing' && e3IndependentNexusCardsClean(state), actions);
  const deck = game.nexusCards!.cards!.deck, at = deck.indexOf('tleilaxu'); assert.ok(at >= 0);
  deck.unshift(deck.splice(at, 1)[0]);
  const beforeDraw = structuredClone(game), drawStep: E3IndependentNexusCardStep = { actor: 'moritani',
    action: { type: 'nexusCardChoice', turn: game.turn, card: null, choice: 'draw', ownRedraws: 0 } };
  game = actE3IndependentNexusCard(game, drawStep.actor, drawStep.action, actions);
  const afterDraw = structuredClone(game);
  game = advanceE3IndependentNexusCards(game, state => state.phase === 5 && state.active === 'guild' && e3IndependentNexusCardsClean(state), actions);
  source.staging.push('Buy original Reinforcements and Recruits for one spice each, then draw the original unopened Tleilaxu Nexus after an actual worm and reciprocal Guild/Emperor alliance.');
  return { ...source, game, actions, afterPurchases, beforeAlliance, draw: { before: beforeDraw, step: drawStep, after: afterDraw } };
}
/** Actual Guild starting-army movement into Moritani's original six-counter
 * position. No staged army, invented seal, held-card swap or copied receipt. */
export function createE3IndependentNexusCardBattle(options: E3IndependentNexusCardOptions = {}) {
  const source = createE3IndependentNexusCardProgramme(options), actions = source.actions;
  let game = source.game;
  const beforeMove = structuredClone(game), move: E3IndependentNexusCardStep = { actor: 'guild',
    action: { type: 'move', from: 'tueks_sietch:5', amount: 5, territory: 'pasty_mesa', sector: 6 } };
  game = actE3IndependentNexusCard(game, move.actor, move.action, actions);
  game = advanceE3IndependentNexusCards(game, state => state.phase === 6 && !!state.active && e3IndependentNexusCardsClean(state), actions);
  const choice = viewGame(game, game.active!).battleChoices.find(choice => choice.territory === 'pasty_mesa'); assert.ok(choice);
  const choose: E3IndependentNexusCardStep = { actor: choice.chooser, action: { type: 'chooseBattle', territory: choice.territory,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker } };
  game = actE3IndependentNexusCard(game, choose.actor, choose.action, actions);
  game = advanceE3IndependentNexusCards(game, state => !!state.battle && !state.battle.preparation &&
    state.battle.preLeader?.closed !== false && e3IndependentNexusCardsClean(state), actions);
  const sources = game.homeworlds ? viewGame(game, 'moritani').battle!.reinforcements!.homeworldSources?.[0] : undefined;
  assert.ok(!game.homeworlds || sources);
  const plans: E3IndependentNexusCardStep[] = [
    { actor: 'moritani', action: { type: 'battlePlan', dial: 0, support: 0, leader: 'moritani-4',
      weapon: REINFORCEMENTS_CARD, ...(sources ? { reinforcementsSources: sources } : {}) } },
    { actor: 'guild', action: { type: 'battlePlan', dial: 1, support: 0, leader: 'guild-0' } },
  ];
  return { ...source, game, actions, beforeMove, move, choose, plans };
}
export function revealE3IndependentNexusCardPlans(game: Game, plans: readonly E3IndependentNexusCardStep[], actions: E3IndependentNexusCardStep[] = []): Game {
  for (const plan of plans) {
    game = actE3IndependentNexusCard(game, plan.actor, plan.action, actions);
    game = advanceE3IndependentNexusCards(game, state => !!state.battle && !state.battle.preparation &&
      state.battle.preLeader?.closed !== false && e3IndependentNexusCardsClean(state), actions);
  }
  assert.ok(game.battle?.revealed); return game;
}
export function chooseE3IndependentAssassinate(game: Game, target: string | null, actions?: E3IndependentNexusCardStep[]): Game {
  const decision = game.decision; assert.ok(decision?.kind === 'moritaniAssassinate');
  return actE3IndependentNexusCard(game, decision.player, { type: 'decision', event: decision.event,
    ...(target === null ? { decline: true } : { card: target }) }, actions);
}
