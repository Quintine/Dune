import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { controlsLeader } from '../game/leader-control';
import { residualPoisonCandidates } from '../game/residual-poison';
import { richeseCards } from '../game/richese-cards';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';

const poison = richeseCards().find(card => card.effect === 'residualPoison'); assert.ok(poison);
export const CAPTURE_RESIDUAL_POISON = poison.id;
export type ResidualPoisonCaptureStep = { actor: string; action: Action };
export const residualPoisonCapturePlayer = (game: Game, actor = 'richese') => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const residualPoisonCaptureClean = (game: Game) => !game.response && !game.phaseOpening &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard;
function lottery<T>(rolls: readonly number[], operation: () => T): T {
  const native = crypto.getRandomValues.bind(crypto);
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
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
export function actResidualPoisonCapture(game: Game, actor: string, action: Action,
  actions: ResidualPoisonCaptureStep[] = [], rolls?: readonly number[]): Game {
  const operation = () => applyAction(game, actor, action);
  const next = rolls ? lottery(rolls, operation) : withClassicDiscoveryNexusLottery(operation);
  actions.push({ actor, action: structuredClone(action) }); return next;
}
/** Capture and private plans are owned explicit source choices. Ordinary
 * optional powers, native responses and auctions continue without spending. */
export function nextResidualPoisonCaptureStep(game: Game): ResidualPoisonCaptureStep | null {
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    const decision = game.decision;
    if (decision?.kind === 'captureOffer' || decision?.kind === 'capturedLeader') return null;
    if (decision?.kind === 'guildTiming') return { actor: decision.player,
      action: { type: 'decision', take: false } };
    if (decision?.kind === 'richeseCache') {
      const card = game.richeseCache!.find(card => card.id === CAPTURE_RESIDUAL_POISON) ?? game.richeseCache![0]; assert.ok(card);
      return { actor: decision.player, action: { type: 'decision', event: game.richeseBidding!.event,
        card: card.id, method: 'onceAround', direction: 'clockwise' } };
    }
    if (decision?.kind === 'richeseUnbid') return { actor: decision.player,
      action: { type: 'decision', event: game.richeseBidding!.event, keep: false } };
  }
  const lot = game.richeseAuction;
  if (residualPoisonCaptureClean(game) && lot?.cardId === CAPTURE_RESIDUAL_POISON && !lot.outcome && lot.active) {
    // Once Around gives the seller a final raise only after a positive bid.
    if (lot.active === 'richese' || lot.bid === 0)
      return { actor: lot.active, action: { type: 'richeseBid', event: lot.event,
        amount: lot.active === 'richese' ? 2 : 1, allyPayment: 0 } };
  }
  return nextRicheseStrongholdsNativeStep(game);
}
export function advanceResidualPoisonCapture(game: Game, until: (state: Game) => boolean,
  actions: ResidualPoisonCaptureStep[] = []): Game {
  for (let count = 0; count < 2200; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original capture/Poison programme ended before its next control');
    const step = nextResidualPoisonCaptureStep(game); assert.ok(step, 'Choose the actual capture or sealed Battle Plan before advancing');
    game = actResidualPoisonCapture(game, step.actor, step.action, actions);
  }
  throw Error('The original capture/Poison programme did not reach its finite boundary');
}
export function residualPoisonCaptureAction(game: Game): Action {
  const option = viewGame(game, 'richese').residualPoison;
  assert.ok(option && !option.blocked && option.event && option.target === 'harkonnen',
    option?.blocked ?? 'The genuine native capture must leave an owned pre-leader Poison opportunity');
  return { type: 'card', card: option.card.id, target: option.target, event: option.event };
}

/** Actual Advanced public start, paid cache2, native funded deployments,
 * Harkonnen victory followed by capture/keep, and a second original battle.
 * Only unopened first-turn Spice positions and original scalar lotteries are
 * selected. No dealt hand, leader, force, wallet, clock or capture is installed. */
export function createResidualPoisonCaptureFixture() {
  let game = createGame('RESIDUALCAPTURE', newPlayer('harkonnen', 'Harkonnen', 'harkonnen'), true, ['choam']);
  for (const faction of ['emperor', 'richese', 'guild'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const actions: ResidualPoisonCaptureStep[] = [];
  const act = (actor: string, action: Action) => { game = actResidualPoisonCapture(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceResidualPoisonCapture(game, until, actions); };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, { type: 'start', advancedPreview: true });
  const setup = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), front: Game['spiceDeck'] = [];
  for (let count = 0; count < 2; count++) {
    const index = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery); assert.ok(index >= 0);
    front.push(game.spiceDeck.splice(index, 1)[0]);
  }
  game.spiceDeck.unshift(...front);
  reach(state => residualPoisonCapturePlayer(state).hand.some(card => card.id === CAPTURE_RESIDUAL_POISON));
  const acquired = structuredClone(game), shipments: {
    before: Game; step: ResidualPoisonCaptureStep; after: Game;
  }[] = [];
  for (const [actor, territory, sector, amount] of [
    ['harkonnen', 'red_chasm', 7, 3], ['emperor', 'red_chasm', 7, 1], ['richese', 'carthag', 11, 1],
  ] as const) {
    reach(state => state.phase === 5 && state.active === actor && residualPoisonCaptureClean(state));
    assert.equal(game.turn, 1);
    const before = structuredClone(game), step: ResidualPoisonCaptureStep = { actor, action: {
      type: 'ship', territory, sector, amount, elite: 0, allyPayment: 0,
    } };
    act(step.actor, step.action); reach(residualPoisonCaptureClean);
    shipments.push({ before, step, after: structuredClone(game) });
    act(actor, { type: 'endMovement' });
  }
  reach(state => state.phase === 6 && state.active === 'harkonnen' && residualPoisonCaptureClean(state));
  const beforeFirstBattle = structuredClone(game), firstChoice: ResidualPoisonCaptureStep = { actor: 'harkonnen',
    action: { type: 'chooseBattle', territory: 'red_chasm', target: 'emperor' } };
  act(firstChoice.actor, firstChoice.action);
  reach(state => !!state.battle?.preLeader?.closed && !state.battle.preparation && residualPoisonCaptureClean(state));
  const firstBattle = structuredClone(game);
  const winnerLeader = [...residualPoisonCapturePlayer(game, 'harkonnen').leaders]
    .filter(leader => !leader.dead && !leader.usedAt).sort((a, b) => b.strength - a.strength)[0];
  const loserLeader = [...residualPoisonCapturePlayer(game, 'emperor').leaders]
    .filter(leader => !leader.dead && !leader.usedAt).sort((a, b) => a.strength - b.strength)[0];
  assert.ok(winnerLeader && loserLeader && winnerLeader.strength + 1 > loserLeader.strength);
  const firstPlans: ResidualPoisonCaptureStep[] = [
    { actor: 'harkonnen', action: { type: 'battlePlan', leader: winnerLeader.id, dial: 1, support: 1 } },
    { actor: 'emperor', action: { type: 'battlePlan', leader: loserLeader.id, dial: 0, support: 0 } },
  ];
  for (const step of firstPlans) act(step.actor, step.action);
  reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'captureOffer');
  const captureOffer = structuredClone(game);
  act('harkonnen', { type: 'decision', accept: true });
  const captureDeclared = structuredClone(game);
  reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'capturedLeader');
  const captured = structuredClone(game), decision = game.decision;
  assert.ok(decision?.kind === 'capturedLeader');
  const captive = decision.leader;
  assert.equal(decision.owner, 'emperor');
  act('harkonnen', { type: 'decision', mode: 'keep' });
  reach(state => !state.battle && residualPoisonCaptureClean(state));
  const afterCapture = structuredClone(game);
  assert.ok(residualPoisonCapturePlayer(game, 'emperor').leaders.find(leader => leader.id === captive)?.concealed);
  assert.equal(game.active, 'harkonnen');
  const beforeBattle = structuredClone(game), choice: ResidualPoisonCaptureStep = { actor: 'harkonnen',
    action: { type: 'chooseBattle', territory: 'carthag', target: 'richese' } };
  act(choice.actor, choice.action);
  reach(state => !!state.battle?.preLeader && !state.battle.preLeader.closed && !state.battle.preparation && residualPoisonCaptureClean(state));
  assert.deepEqual(game.battle!.plans, {});
  return { game, lobby, setup, afterSetup, acquired, shipments, beforeFirstBattle, firstChoice, firstBattle,
    firstPlans, captureOffer, captureDeclared, captured, afterCapture, beforeBattle, choice, captive,
    firstHarkonnenLeader: winnerLeader.id, owner: 'richese', target: 'harkonnen', nativeOwner: 'emperor',
    observer: 'guild', card: CAPTURE_RESIDUAL_POISON, sourceActionCount: actions.length, actions,
    staging: ['Only unopened original land Spice positions and scalar lotteries are selected. Public Advanced host/setup, an actual opening bid1 and native seller raise/purchase2, Harkonnen3/Emperor1 desert and Richese1 Carthag shipments, actual Harkonnen victory, random capture and keep create this source. No postdeal hand, leader, counter, wallet, phase, battle or custody receipt is installed.'] };
}
export type ResidualPoisonCaptureFixture = ReturnType<typeof createResidualPoisonCaptureFixture>;

/** The test lottery observes the actual controlled source pool. The request
 * carries no victim, pool or random index, and the engine owns the death. */
export function useResidualPoisonCapture(fixture: ResidualPoisonCaptureFixture, branch: 'native' | 'captive') {
  let game = structuredClone(fixture.game);
  const target = residualPoisonCapturePlayer(game, fixture.target);
  const pool = residualPoisonCandidates(game.players.flatMap(owner => owner.leaders.filter(leader => controlsLeader(target, leader))),
    game.battle!.territory);
  const selected = branch === 'captive' ? pool.find(leader => leader.id === fixture.captive)
    : pool.find(leader => leader.faction === 'harkonnen');
  assert.ok(selected);
  const working = pool.map(leader => leader.id), desired = [selected.id, ...working.filter(id => id !== selected.id)], rolls: number[] = [];
  for (let index = working.length - 1; index > 0; index--) {
    const from = working.indexOf(desired[index]); assert.ok(from >= 0 && from <= index);
    rolls.push(Math.floor((from + 0.5) * 0x100000000 / (index + 1)));
    [working[index], working[from]] = [working[from], working[index]];
  }
  const actions: ResidualPoisonCaptureStep[] = [], action = residualPoisonCaptureAction(game);
  const before = structuredClone(game);
  game = actResidualPoisonCapture(game, fixture.owner, action, actions, rolls);
  assert.equal(game.players.flatMap(player => player.leaders).find(leader => leader.id === selected.id)!.dead, true);
  return { game, before, action, victim: selected.id, branch, rolls, poolIds: pool.map(leader => leader.id), actions };
}

/** Both participants finish the real shared opportunity and seal ordinary
 * no-weapon plans using available native discs. Richese wins without killing
 * another leader; an unused living captive remains controlled and concealed. */
export function completeResidualPoisonCapture(fixture: ResidualPoisonCaptureFixture, state: Game) {
  const actions: ResidualPoisonCaptureStep[] = [];
  let game = advanceResidualPoisonCapture(structuredClone(state),
    game => !!game.battle?.preLeader?.closed && !game.battle.preparation && residualPoisonCaptureClean(game), actions);
  const beforePlans = structuredClone(game);
  const own = [...residualPoisonCapturePlayer(game, fixture.owner).leaders]
    .filter(leader => !leader.dead && !leader.capturedBy && (!leader.usedAt || leader.usedAt === 'carthag'))
    .sort((a, b) => b.strength - a.strength)[0];
  const enemy = [...residualPoisonCapturePlayer(game, fixture.target).leaders]
    .filter(leader => !leader.dead && !leader.capturedBy && (!leader.usedAt || leader.usedAt === 'carthag'))
    .sort((a, b) => a.strength - b.strength)[0];
  assert.ok(own && enemy && own.strength > enemy.strength);
  const plans: ResidualPoisonCaptureStep[] = [
    { actor: fixture.target, action: { type: 'battlePlan', leader: enemy.id, dial: 0, support: 0 } },
    { actor: fixture.owner, action: { type: 'battlePlan', leader: own.id, dial: 0, support: 0 } },
  ];
  for (const step of plans) game = actResidualPoisonCapture(game, step.actor, step.action, actions);
  game = advanceResidualPoisonCapture(game, game => !game.battle && residualPoisonCaptureClean(game), actions);
  return { game, beforePlans, plans, actions };
}
