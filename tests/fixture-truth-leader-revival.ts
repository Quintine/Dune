import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { leaderRevivalOptions } from '../game/revival';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';
import { actTruthBid, truthBidInventory, truthBidPlayer } from './fixture-truth-bid';

export type TruthLeaderRevivalStep = { actor: string; action: Action };
export type TruthLeaderRevivalTransition = { before: Game; steps: TruthLeaderRevivalStep[]; after: Game };
export const actTruthLeaderRevival = actTruthBid;
export const truthLeaderRevivalInventory = truthBidInventory;
export const truthLeaderRevivalPlayer = truthBidPlayer;
export const truthLeaderRevivalClean = (game: Game) => !game.phaseOpening && !game.response && !game.decision &&
  !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingRevival;

export function nextTruthLeaderRevival(game: Game): TruthLeaderRevivalStep | null {
  if (game.truthtrance) return null;
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard) {
    if (game.decision?.kind === 'faceDance') return { actor: game.decision.player, action: { type: 'decision', reveal: false } };
    if (game.decision?.kind === 'revivalStop') return { actor: game.decision.player, action: { type: 'decision', decline: true } };
    if (game.battle?.preparation) return { actor: game.battle.preparation.owner, action: { type: 'declineBattlePower' } };
  }
  for (const player of game.players) {
    const view = viewGame(game, player.id);
    if (view.leaderRevivalPromiseGuide?.phase === game.phase)
      return { actor: player.id, action: view.leaderRevivalPromiseGuide.action };
    if (view.revivalPromiseGuide?.phase === game.phase) return { actor: player.id, action: view.revivalPromiseGuide.action };
    if (view.bidPromiseGuide) return { actor: player.id, action: view.bidPromiseGuide.action };
  }
  return nextRicheseStrongholdsNativeStep(game);
}
export function advanceTruthLeaderRevival(game: Game, until: (state: Game) => boolean,
  actions: TruthLeaderRevivalStep[] = []): Game {
  for (let count = 0; count < 1600; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The real named-leader source ended before its owned control');
    const next = nextTruthLeaderRevival(game); assert.ok(next, 'The original named-leader question and answer belong to their callers');
    game = actTruthLeaderRevival(game, next.actor, next.action, actions);
  }
  throw Error('The real named-leader source did not reach its finite boundary');
}
export function settleTruthLeaderRevival(game: Game, actions: TruthLeaderRevivalStep[] = []): Game {
  return advanceTruthLeaderRevival(game, truthLeaderRevivalClean, actions);
}
export function finishTruthLeaderRevival(game: Game, actions: TruthLeaderRevivalStep[] = []): Game {
  const turn = game.turn;
  return advanceTruthLeaderRevival(game, state => state.turn === turn && state.phase === 5 && truthLeaderRevivalClean(state), actions);
}

/** Public original H/A/T +Ix47 with no optional modules. Harkonnen really
 * receives both Truthtrances, A a projectile, T Worthless/Ghola or the optional
 * actually played Tooth that also kills A's named native disc.
 * T pays1 to enter original Arrakeen10, loses the counter and Hidar in an
 * actual projectile battle, then reaches genuine next-turn Revival. This is
 * native T own early permission, not an ordinary five-disc cohort opening. */
export function createTruthLeaderRevivalFixture(options: {
  advanced?: boolean; window?: 'active' | 'waiting'; ghola?: boolean; bothDead?: boolean;
} = {}) {
  const advanced = options.advanced ?? false, window = options.window ?? 'active';
  assert.ok(!options.ghola || !options.bothDead, 'One actual starting card supplies either Ghola or the native Tooth');
  const asker = 'harkonnen', opponent = 'atreides', target = 'tleilaxu', leader = 'tleilaxu-1';
  let game = createGame('TRUTHLEADERREVIVALSOURCE', newPlayer(asker, 'Harkonnen', 'harkonnen'), advanced, ['ix']);
  joinGame(game, newPlayer(opponent, 'Atreides', 'atreides'));
  joinGame(game, newPlayer(target, 'Tleilaxu', 'tleilaxu'));
  const initial = structuredClone(game), actions: TruthLeaderRevivalStep[] = [];
  const act = (actor: string, action: Action) => { game = actTruthLeaderRevival(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceTruthLeaderRevival(game, until, actions); };
  const transition = (run: () => void): TruthLeaderRevivalTransition => {
    const before = structuredClone(game), from = actions.length; run();
    return { before, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(asker, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game); assert.equal(game.status, 'setup');
  assert.ok(game.players.every(player => !player.hand.length));
  const originalCards = truthLeaderRevivalInventory(game); assert.equal(originalCards.length, 47);
  const truths = game.deck.filter(card => card.effect === 'truthtrance'); assert.equal(truths.length, 2);
  const weapon = game.deck.find(card => card.kind === 'projectile');
  const targetCard = game.deck.find(card => options.bothDead ? card.kind === 'poisonTooth' :
    options.ghola ? card.effect === 'ghola' : card.kind === 'worthless');
  assert.ok(weapon && targetCard);
  const deal = [truths[0].id, truths[1].id, weapon.id, targetCard.id];
  const dealOrder = deal.map((id, position) => {
    const from = game.deck.findIndex(card => card.id === id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: id };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game);
  assert.deepEqual(truthLeaderRevivalPlayer(game, asker).hand.map(card => card.id), truths.map(card => card.id));
  assert.ok(truthLeaderRevivalPlayer(game, opponent).hand.some(card => card.id === weapon.id));
  assert.ok(truthLeaderRevivalPlayer(game, target).hand.some(card => card.id === targetCard.id));
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1, 2, 3].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery && card.sector >= 7);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    return { position, from, card: structuredClone(card) };
  });
  reach(state => state.turn === 1 && state.phase === 5 && state.active === target && truthLeaderRevivalClean(state));
  const shipmentAction: Action = { type: 'ship', territory: 'arrakeen', sector: 10, amount: 1, elite: 0, allyPayment: 0 };
  const shipment = transition(() => { act(target, shipmentAction); reach(truthLeaderRevivalClean); });
  assert.equal(truthLeaderRevivalPlayer(game, target).spice, 4);
  reach(state => state.phase === 6 && truthLeaderRevivalClean(state) && !!state.active);
  const beforeBattle = structuredClone(game);
  const choice = viewGame(game, game.active!).battleChoices.find(choice => choice.territory === 'arrakeen'); assert.ok(choice);
  const battleAction: Action = { type: 'chooseBattle', territory: 'arrakeen',
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker };
  act(choice.chooser, battleAction);
  reach(state => !!state.battle && truthLeaderRevivalClean(state) && !state.battle.preparation && state.battle.preLeader?.closed !== false);
  const beforePlans = structuredClone(game);
  const winnerLeader = truthLeaderRevivalPlayer(game, opponent).leaders.find(leader => leader.id === 'atreides-4' && !leader.dead); assert.ok(winnerLeader);
  const plans: TruthLeaderRevivalStep[] = [
    { actor: target, action: { type: 'battlePlan', leader, dial: 0, support: 0, weapon: options.bothDead ? targetCard.id : null, defense: null } },
    { actor: opponent, action: { type: 'battlePlan', leader: winnerLeader.id, dial: options.bothDead ? 1 : 0,
      support: advanced && options.bothDead ? 1 : 0, weapon: weapon.id, defense: null } },
  ];
  for (const plan of plans) act(plan.actor, plan.action);
  const revealed = structuredClone(game);
  const battle = transition(() => { reach(state => !state.battle && truthLeaderRevivalClean(state)); });
  const afterBattle = structuredClone(game), dead = truthLeaderRevivalPlayer(game, target).leaders.find(disc => disc.id === leader)!;
  assert.equal(dead.dead, true); assert.equal(dead.deaths, 1);
  assert.equal(truthLeaderRevivalPlayer(game, target).leaders.filter(disc => !disc.dead).length, 4);
  assert.equal(game.lastBattleContext?.winner, opponent);
  assert.equal(truthLeaderRevivalPlayer(game, target).tanks, 1);
  assert.equal(truthLeaderRevivalPlayer(game, target).reserves, 19);
  if (options.bothDead) assert.equal(truthLeaderRevivalPlayer(game, opponent).leaders.find(disc => disc.id === winnerLeader.id)!.dead, true);
  const storm = transition(() => { reach(state => state.turn === 2 && state.phase === 1 && truthLeaderRevivalClean(state)); });
  const postStormActionCount = actions.length, postStorm = structuredClone(game);
  const bidding = transition(() => { reach(state => state.turn === 2 && state.phase === 3 && truthLeaderRevivalClean(state)); });
  const phase3ActionCount = actions.length, phase3 = structuredClone(game);
  const arrival = transition(() => { reach(state => state.turn === 2 && state.phase === 4 && truthLeaderRevivalClean(state)); });
  const opened = structuredClone(game);
  if (window === 'active' && game.revivalOrder) {
    assert.ok(game.revivalOrder.remaining.includes(target));
    reach(state => state.phase === 4 && truthLeaderRevivalClean(state) && state.revivalOrder?.remaining[0] === target);
  }
  const own = truthLeaderRevivalPlayer(game, target), quote = leaderRevivalOptions(game, own).leaders.find(option => option.id === leader); assert.ok(quote);
  assert.equal(quote.early, true); assert.equal(quote.cost, 2); assert.equal(quote.affordable, true);
  assert.equal(own.spice, 4); assert.equal(own.revivalCycle, 0); assert.equal(own.leaderRevived, false);
  assert.deepEqual(truthLeaderRevivalInventory(game), originalCards);
  const question = { kind: 'leaderRevival' as const, target, turn: game.turn, leader };
  return { game, sourceGame: structuredClone(game), initial, lobby, setup, beforeStartingDeal, afterSetup,
    advanced, window, bothDead: options.bothDead ?? false, asker, opponent, target, opponentLeader: winnerLeader.id,
    actor: asker, leader, leaderName: dead.name,
    truths: truths.map(card => card.id), truth: truths[0].id, card: truths[0].id,
    ghola: options.ghola ? targetCard.id : null, weapon: weapon.id,
    shipmentAction, shipment, beforeBattle, battleAction, beforePlans, plans, revealed, battle, afterBattle,
    storm, postStorm, postStormActionCount, bidding, phase3, phase3ActionCount, arrival, opened, quote,
    question, declarationAction: { type: 'card', card: truths[0].id } as Action,
    questionAction: { type: 'truthAsk', question } as Action, revivalAction: { type: 'reviveLeader', leader } as Action,
    originalCards, originalInventory: originalCards, originalSpice, deal, dealOrder, spiceOrder,
    actions, sourceActions: structuredClone(actions), sourceActionCount: actions.length, sourceCount: actions.length,
    staging: [] as string[], sourceDisclosure: 'Original public H/A/T Ix47 Basic/Advanced setup deals H both Truthtrances, A projectile and T Worthless/Ghola/PoisonTooth through unopened positions only. Real T1 shipment pays1; actual Hidar dies to the original A projectile and loses its one counter. The optional actual Tooth kills A leader too; A then dials1 with original Advanced support1 to retain a real win. Native no-Traitor calls and any real FaceDance decline preserve the result. Actual next Storm/phases reach T4spice and native own early leader cost2 with four living discs; this does not open the ordinary five-disc cohort. No played hand, army, wallet, death, clock or promise is installed.' };
}
export type TruthLeaderRevivalFixture = ReturnType<typeof createTruthLeaderRevivalFixture>;
export function declareTruthLeaderRevival(f: TruthLeaderRevivalFixture, state = f.game, options: { copies?: 1 | 2 } = {}) {
  let game = state; const before = structuredClone(game), actions: TruthLeaderRevivalStep[] = [];
  const declaration: Action = { type: 'card', card: f.truths[0], ...(options.copies === 2 ? { cards: [f.truths[1]] } : {}) };
  game = actTruthLeaderRevival(game, f.asker, declaration, actions);
  for (let count = 0; game.truthtrance?.stage === 'priority' && count < game.players.length; count++) {
    const actor = game.players.find(player => !game.truthtrance!.passed.includes(player.id)); assert.ok(actor);
    game = actTruthLeaderRevival(game, actor.id, { type: 'truthPass' }, actions);
  }
  assert.equal(game.truthtrance?.stage, 'ask');
  return { game, before, declaration, actions, actionCount: actions.length };
}
export function askTruthLeaderRevival(game: Game, asker: string, target: string, leader: string,
  actions: TruthLeaderRevivalStep[] = []): Game {
  return actTruthLeaderRevival(game, asker, { type: 'truthAsk', question: { kind: 'leaderRevival', target, turn: game.turn, leader } }, actions);
}
export function answerTruthLeaderRevival(game: Game, target: string, answer: 'yes' | 'no',
  actions: TruthLeaderRevivalStep[] = []): Game {
  return actTruthLeaderRevival(game, target, { type: 'truthAnswer', answer }, actions);
}
export function bindTruthLeaderRevival(f: TruthLeaderRevivalFixture, answer: 'yes' | 'no' = 'yes', leader = f.leader, state = f.game) {
  const declared = declareTruthLeaderRevival(f, state), actions = [...declared.actions];
  const asked = askTruthLeaderRevival(declared.game, f.asker, f.target, leader, actions);
  const game = answerTruthLeaderRevival(asked, f.target, answer, actions);
  return { game, declared, asked, actions, actionCount: actions.length };
}
