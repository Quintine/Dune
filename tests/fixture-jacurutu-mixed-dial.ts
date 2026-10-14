import assert from 'node:assert/strict';
import {
  applyAction,
  battles,
  createGame,
  initializeDiscoveryGameForAudit,
  joinGame,
  newPlayer,
  viewGame,
  type Action,
  type Game,
  type Player,
} from '../game/engine';
import {
  DISCOVERY_CARD_PLACEMENTS,
  JACURUTU_SIETCH,
  type DiscoveryOpaqueTokenId,
} from '../game/discoveries';
import type { JacurutuDialOffer } from '../game/discovery-battle';
import type { Casualties } from '../game/combat';
import { nextSpiceBankerIncomeNativeStep } from './fixture-spice-banker-income';

export type JacurutuMixedDialStep = { actor: string; action: Action };

export type JacurutuMixedDialOptions = {
  /** The defeated Emperor's actual revealed plan. Dial 2 with support 1 leaves
   * two legal physical readings of the same wheel; dial 1 with support 0
   * leaves exactly one. */
  dial?: number;
  support?: number;
};

export type JacurutuMixedDialFixture = {
  /** Authenticated fresh lobby before any deal. */
  initial: Game;
  /** The original physical Discovery setup. */
  setup: Game;
  /** The genuine battle in Jacurutu Sietch before its final traitor vote. */
  game: Game;
  actions: JacurutuMixedDialStep[];
  staging: string[];
  /** Actual battle winner (Atreides). */
  attacker: string;
  /** Actual battle loser (Emperor) holding one ordinary and one Sardaukar. */
  defender: string;
  observer: string;
  territory: string;
  /** The surrounding territory the defeated forces entered from. */
  parent: string;
  token: string;
  /** The last original traitor vote that completes the reveal. */
  finalVote: JacurutuMixedDialStep;
  defenderPlan: Action;
  attackerPlan: Action;
  defenderLeader: string;
  attackerLeader: string;
  /** Physical counters the defeated army actually sent to the Tanks. */
  defenderTanks: { normal: number; elite: number };
  dial: number;
  support: number;
};

/** Engine surface owned by the parent integration; asserted here as a contract. */
export type JacurutuBattleReceipt = JacurutuDialOffer & {
  selectedDial?: Casualties | null;
};
export type JacurutuDialDecision = { kind: 'jacurutuDial'; player: string; event: string };

export function jacurutuBattleReceipt(game: Game): JacurutuBattleReceipt | null {
  const battle = game.battle as (Game['battle'] & { jacurutuDial?: JacurutuBattleReceipt }) | null;
  return battle?.jacurutuDial ? structuredClone(battle.jacurutuDial) : null;
}

export function jacurutuCurrentDecision(game: Game): JacurutuDialDecision | null {
  const decision = game.decision as JacurutuDialDecision | null;
  return decision?.kind === 'jacurutuDial' ? decision : null;
}

const EMPEROR = 'emperor';
const ATREIDES = 'atreides';

type JacurutuProgress = { token: DiscoveryOpaqueTokenId | null; emperorShipped: boolean; atreidesShipped: boolean };

function clean(game: Game) {
  return !game.phaseOpening && !game.response && !game.decision;
}

/** Genuine native policy plus the four real actions this scenario needs. */
function nextJacurutuMixedDialStep(game: Game, progress: JacurutuProgress): JacurutuMixedDialStep {
  if (game.decision?.kind === 'discoveryEntry') {
    const owner = game.decision.player;
    const offer = viewGame(game, owner).discoveryEntry!;
    if (owner === EMPEROR && !offer.blocked)
      return { actor: owner, action: { type: 'decision', event: game.decision.event, accept: true,
        groups: offer.sources.map(({ source, normal, elite }) => ({ source, normal, elite })) } };
    return { actor: owner, action: { type: 'decision', event: game.decision.event, accept: false } };
  }
  // Collection: the sole surrounding occupant inspects then reveals the token.
  if (game.phase === 7 && clean(game) && progress.token) {
    const discoveries = viewGame(game, EMPEROR).discoveries!;
    if (discoveries.canInspect.includes(progress.token))
      return { actor: EMPEROR, action: { type: 'discovery', token: progress.token, reveal: false } };
    if (discoveries.canReveal.includes(progress.token))
      return { actor: EMPEROR, action: { type: 'discovery', token: progress.token, reveal: true } };
  }
  if (game.phase === 5 && clean(game)) {
    if (game.turn === 1 && game.active === EMPEROR && !progress.emperorShipped) {
      progress.emperorShipped = true;
      return { actor: EMPEROR, action: { type: 'ship', territory: DISCOVERY_CARD_PLACEMENTS['discovery-hagga-basin'].territory,
        sector: DISCOVERY_CARD_PLACEMENTS['discovery-hagga-basin'].sector, amount: 2, elite: 1, allyPayment: 0 } };
    }
    if (game.turn === 2 && game.active === ATREIDES && !progress.atreidesShipped) {
      progress.atreidesShipped = true;
      return { actor: ATREIDES, action: { type: 'ship', territory: JACURUTU_SIETCH, sector: 0,
        amount: 3, elite: 0, allyPayment: 0 } };
    }
    return { actor: game.active!, action: { type: 'endMovement' } };
  }
  if (game.phase === 6 && !game.battle && clean(game)) {
    const pending = battles(game);
    if (pending.length) {
      const choice = pending[0];
      assert.equal(choice.territory, JACURUTU_SIETCH, 'Only the revealed nested location may hold this battle.');
      const chooser = choice.chooser ?? choice.attacker;
      return { actor: chooser, action: { type: 'chooseBattle', territory: choice.territory,
        target: choice.attacker === chooser ? choice.defender : choice.attacker } };
    }
  }
  const next = nextSpiceBankerIncomeNativeStep(game);
  assert.ok(next, `No genuine Jacurutu dial step at ${game.status}/${game.turn}/${game.phase}.`);
  return next;
}

function advance(
  state: Game,
  until: (game: Game) => boolean,
  progress: JacurutuProgress,
  actions: JacurutuMixedDialStep[],
): Game {
  let game = state;
  for (let step = 0; step < 1500 && !until(game); step++) {
    assert.notEqual(game.status, 'finished');
    const next = nextJacurutuMixedDialStep(game, progress);
    actions.push(next);
    game = applyAction(game, next.actor, next.action);
  }
  assert.ok(until(game), 'The genuine Jacurutu dial policy did not reach its requested window.');
  return game;
}

/** Control only the actual placement lottery of the real Discovery blow. */
function withPlacement<T>(game: Game, operation: () => T): T {
  const eligible = game.discoveries!.tokens.filter(token => token.status === 'supply' && token.type === 'hiereg');
  const selected = eligible.findIndex(token => token.face === JACURUTU_SIETCH);
  assert.ok(selected >= 0, 'The original Hiereg supply must still hold Jacurutu Sietch.');
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1)
      array[0] = Math.floor((selected + 0.5) / eligible.length * 0x100000000);
    else Reflect.apply(original, crypto, [array]);
    return array;
  };
  try { return operation(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

function leaderOf(game: Game, id: string, strongest: boolean): Player['leaders'][number] {
  const player = game.players.find(seat => seat.id === id)!;
  const leader = player.leaders.filter(candidate => !candidate.dead && candidate.usedAt === undefined)
    .sort((left, right) => strongest ? right.strength - left.strength : left.strength - right.strength)[0];
  assert.ok(leader, `Faction ${player.faction} must still hold an unused leader.`);
  return leader;
}

function applyStep(game: Game, step: JacurutuMixedDialStep, actions: JacurutuMixedDialStep[]): Game {
  actions.push(step);
  return applyAction(game, step.actor, step.action);
}

/**
 * Genuine Advanced Discovery runtime: original setup, first real Storm, the
 * actual Hiereg Discovery blow placing Jacurutu Sietch at its printed
 * destination, a real Emperor shipment beside it, the real private inspect and
 * reveal, the real next-turn free entry, a real Atreides shipment into the
 * revealed location and the real declared battle. The only staging is the
 * order of four original unplayed Spice Cards and the placement lottery; no
 * card, wallet, force, phase, hand or receipt is written directly.
 */
export function createJacurutuMixedDialFixture(options: JacurutuMixedDialOptions = {}): JacurutuMixedDialFixture {
  const dial = options.dial ?? 2;
  const support = options.support ?? 1;
  const placement = DISCOVERY_CARD_PLACEMENTS['discovery-hagga-basin'];
  assert.equal(placement.type, 'hiereg');
  let game = createGame('JACURUTUDIAL', newPlayer(EMPEROR, 'Emperor', 'emperor'), true, []);
  joinGame(game, newPlayer(ATREIDES, 'Atreides', 'atreides'));
  joinGame(game, newPlayer('guild', 'Guild', 'guild'));
  assert.deepEqual(game.expansions, []);
  for (const player of game.players) if (!player.ready) game = applyAction(game, player.id, { type: 'ready' });
  game.discoveryEnabled = true;
  const initial = structuredClone(game);
  game = initializeDiscoveryGameForAudit(game);
  const setup = structuredClone(game);
  const actions: JacurutuMixedDialStep[] = [];
  const staging: string[] = [];
  // 1. The original setup and the first real Storm.
  game = advance(game, state => state.status === 'playing', { token: null, emperorShipped: false, atreidesShipped: false }, actions);
  const discovery = game.spiceDeck.findIndex(card => 'discovery' in card && card.discovery === 'discovery-hagga-basin');
  assert.ok(discovery >= 0);
  game.spiceDeck.unshift(game.spiceDeck.splice(discovery, 1)[0]);
  for (let position = 1; position < 4; position++) {
    const ordinary = game.spiceDeck.findIndex((card, index) => index >= position && card !== undefined &&
      'territory' in card && !card.discovery && card.territory !== placement.territory);
    assert.ok(ordinary >= position);
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(ordinary, 1)[0]);
  }
  staging.push('Reordered four original unplayed Spice Cards so the real first blow is the Hiereg Discovery card; selected only the actual placement lottery.');
  const progress: JacurutuProgress = { token: null, emperorShipped: false, atreidesShipped: false };
  game = advance(game, state => state.phase === 1 && clean(state), progress, actions);
  game = withPlacement(game, () => advance(game,
    state => state.discoveries!.tokens.some(token => token.face === JACURUTU_SIETCH && token.status === 'placed'),
    progress, actions));
  const token = game.discoveries!.tokens.find(candidate => candidate.face === JACURUTU_SIETCH)!;
  assert.equal(token.status, 'placed');
  assert.equal(token.territory, placement.territory);
  assert.equal(token.sector, placement.sector);
  assert.notEqual(token.sector, game.storm);
  progress.token = token.id;
  // 2. The real Emperor shipment in his own first Movement turn beside the
  // face-down token, then the real private inspect and reveal in that turn's
  // Collection. The storm order never decides this sequence.
  game = advance(game, state => state.phase === 5 && clean(state) && state.active === EMPEROR, progress, actions);
  game = advance(game, state => state.discoveries!.tokens.find(candidate => candidate.id === token.id)!.revealedTurn === 1, progress, actions);
  // 3. The real next-turn free entry into the revealed location.
  game = advance(game, state => state.decision?.kind === 'discoveryEntry' && state.decision.player === EMPEROR, progress, actions);
  game = applyStep(game, nextJacurutuMixedDialStep(game, progress), actions);
  const entered = game.players.find(player => player.id === EMPEROR)!;
  const enteredKey = `${JACURUTU_SIETCH}:0`;
  assert.equal(entered.forces[enteredKey], 2, 'The real free entry must move both undialed counters.');
  assert.equal(entered.elites!.forces[enteredKey], 1);
  // 4. The real Atreides shipment into the revealed location and the battle.
  game = advance(game, state => state.phase === 6 && !!state.battle && clean(state) && !state.battle.preparation, progress, actions);
  const defenderLeader = leaderOf(game, EMPEROR, false);
  const attackerLeader = leaderOf(game, ATREIDES, true);
  assert.ok(attackerLeader.strength >= defenderLeader.strength + 3, 'The real strength comparison must leave no tie.');
  const defenderPlan: Action = { type: 'battlePlan', leader: defenderLeader.id, dial, support };
  const attackerPlan: Action = { type: 'battlePlan', leader: attackerLeader.id, dial: 2, support: 2 };
  for (const [actor, plan] of [[EMPEROR, defenderPlan], [ATREIDES, attackerPlan]] as const) {
    for (let step = 0; step < 20 && (!clean(game) || game.battle?.preparation); step++)
      game = applyStep(game, nextJacurutuMixedDialStep(game, progress), actions);
    game = applyStep(game, { actor, action: plan }, actions);
  }
  const defender = game.players.find(player => player.id === EMPEROR)!;
  assert.equal(game.battle!.plans[EMPEROR]!.dial, dial);
  assert.equal(game.battle!.plans[EMPEROR]!.support, support);
  assert.equal(game.battle!.plans[ATREIDES]!.dial, 2);
  assert.equal(defender.forces[enteredKey], 2);
  assert.equal(defender.elites!.forces[enteredKey], 1);
  // Hold back the final original traitor vote so the caller completes the reveal.
  for (let step = 0; step < 20; step++) {
    const voters = viewGame(game, game.host).battle!.traitorVoters
      .filter(id => game.battle!.traitorCalls[id] === undefined);
    if (voters.length <= 1) break;
    game = applyStep(game, { actor: voters[0], action: { type: 'traitorCall', call: false } }, actions);
  }
  const voters = viewGame(game, game.host).battle!.traitorVoters
    .filter(id => game.battle!.traitorCalls[id] === undefined);
  assert.equal(voters.length, 1, 'One original traitor vote must still be pending.');
  const finalVote: JacurutuMixedDialStep = { actor: voters[0], action: { type: 'traitorCall', call: false } };
  return {
    initial, setup, game, actions, staging,
    attacker: ATREIDES, defender: EMPEROR, observer: 'guild',
    territory: JACURUTU_SIETCH, parent: `${placement.territory}:${placement.sector}`, token: token.id,
    finalVote, defenderPlan, attackerPlan,
    defenderLeader: defenderLeader.id, attackerLeader: attackerLeader.id,
    defenderTanks: { normal: 1, elite: 1 }, dial, support,
  };
}
