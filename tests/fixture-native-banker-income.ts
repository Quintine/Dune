import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeSpiceBankerIncomeGameForAudit,
  joinGame, newPlayer, viewGame, type Game,
} from '../game/engine';
import type { FactionId } from '../game/catalog';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { forceRevivalQuote } from '../game/revival';
import {
  createSpiceBankerIncomeFixture, nextSpiceBankerIncomeNativeStep,
  type SpiceBankerIncomeFixture,
} from './fixture-spice-banker-income';

export const NATIVE_BANKER_FAMILIES = ['ixians', 'tleilaxu', 'choam', 'moritani'] as const;
export type NativeBankerFamily = typeof NATIVE_BANKER_FAMILIES[number];
export type NativeBankerIncomeOptions = {
  /** Continue an original fresh lobby or its undealt admitted setup. */
  initial?: Game;
  family: NativeBankerFamily;
  /** Only the Ixian family may include the original Tleilaxu setup as well. */
  withTleilaxu?: boolean;
  bankerFaction?: FactionId;
  payerFaction?: FactionId;
  kind?: 'auction' | 'force-revival';
  /** Auction price, or number of real Tanks to revive. */
  amount?: number;
  /** Conserved cyborg subset of the revival casualties, Ixians only. */
  elite?: number;
  stageIncomeCounter?: boolean;
};

/** Control only the original all14 skill shuffle. Treachery, traitors, Face
 * Dancers, Terror tokens and every later native shuffle retain real entropy. */
function withNativeBankerSkillShuffle<T>(initialize: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto);
  type RandomInput = Parameters<typeof original>[0];
  const target = LEADER_SKILL_CARDS.findIndex(card => card.id === 'spice-banker');
  let shuffleIndex = LEADER_SKILL_CARDS.length - 1;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (shuffleIndex <= 0) {
      original(array as RandomInput);
      return array;
    }
    assert.ok(array instanceof Uint32Array && array.length === 1,
      'The initializer must begin with the original skill shuffle.');
    array[0] = shuffleIndex-- === target ? 0 : 0xffffffff;
    return array;
  };
  try { return initialize(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Fresh ready Basic native lobby admitted through the real Banker initializer;
 * no played state is retrofitted and no existing deck or offer is replaced. */
export function initializeNativeBankerIncomeSetup(options: NativeBankerIncomeOptions): Game {
  assert.ok(!options.withTleilaxu || options.family === 'ixians');
  const native: FactionId[] = [options.family];
  if (options.withTleilaxu) native.push('tleilaxu');
  const banker = options.bankerFaction ?? options.family;
  const seats: FactionId[] = [banker, ...native, 'atreides', 'emperor'];
  const factions = seats.filter((faction, index, all) => all.indexOf(faction) === index);
  assert.ok(native.includes(banker) || banker === 'atreides' || banker === 'emperor');
  const expansion: Game['expansions'][number] = options.family === 'choam' ? 'choam'
    : options.family === 'moritani' ? 'ecaz' : 'ix';
  let game = options.initial ? structuredClone(options.initial)
    : createGame('NATBANKR', newPlayer(banker, banker, banker), false, [expansion]);
  if (options.initial) {
    assert.equal(game.advanced, false);
    assert.deepEqual(game.expansions, [expansion]);
    if (game.status === 'setup') {
      assert.ok(game.spiceBankerIncomePreview && game.turn === 1 && game.phase === 0);
      return game;
    }
    assert.equal(game.status, 'lobby');
  } else for (const faction of factions.slice(1)) joinGame(game, newPlayer(faction, faction, faction));
  for (const player of game.players) if (!player.ready) game = applyAction(game, player.id, { type: 'ready' });
  return withNativeBankerSkillShuffle(() => initializeSpiceBankerIncomeGameForAudit(game));
}

function step(game: Game): Game {
  const next = nextSpiceBankerIncomeNativeStep(game);
  assert.ok(next);
  return applyAction(game, next.actor, next.action);
}

/** Original Ix starting-card selection, skill assignments, Traitors/Face Dancers
 * and Moritani placement finish through existing own-view actions. */
export function completeNativeBankerIncomeSetup(state: Game): Game {
  let game = state;
  for (let i = 0; game.status === 'setup' && i < 200; i++) {
    if (game.decision?.kind === 'ixSetup') {
      const actor = game.decision.player;
      const card = viewGame(game, actor).ixTechnology!.setup![0];
      assert.ok(card);
      game = applyAction(game, actor, { type: 'decision', card: card.id });
    } else if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0];
      const offer = game.leaderSkills!.offers[actor];
      const view = viewGame(game, actor).leaderSkills!;
      const skill = offer.cards.includes('spice-banker') ? 'spice-banker'
        : offer.cards.find(card => !view.unavailableSkills?.[card]);
      assert.ok(skill);
      assert.ok(view.eligibleLeaders[0]);
      game = applyAction(game, actor, {
        type: 'leaderSkill', event: offer.event, skill, leader: view.eligibleLeaders[0].id,
      });
    } else if (game.setupStage === 'traitors' && !game.decision) {
      const player = game.players.find(p => p.faction !== 'tleilaxu' && p.traitorChoices.length);
      assert.ok(player);
      game = applyAction(game, player.id, { type: 'traitor', leader: player.traitorChoices[0] });
    } else if (game.decision?.kind === 'moritaniSetup') {
      game = applyAction(game, game.decision.player, { type: 'decision', territory: 'polar_sink', sector: 0 });
    } else game = step(game);
  }
  assert.equal(game.status, 'playing');
  assert.equal(game.leaderSkills!.assignments.find(a => a.skill === 'spice-banker')!.owner, game.players[0].id);
  return game;
}

/** Advance original phase controls without staging a phase or payment receipt. */
export function advanceNativeBankerIncomeToPhase(state: Game, target: number): Game {
  let game = state;
  const turn = state.turn;
  for (let i = 0; (game.phase !== target || game.phaseOpening || game.response || game.decision)
    && game.status === 'playing' && game.turn === turn && i < 1000; i++) game = step(game);
  assert.equal(game.turn, turn);
  assert.equal(game.phase, target);
  assert.ok(!game.phaseOpening);
  assert.equal(game.response, null);
  assert.equal(game.decision, null);
  return game;
}

/** Reusable native runtime case: actual other-payer Emperor self-auction to the
 * Bank by default. Revival stages only conserved normal/cyborg casualties after genuine
 * setup; original quotes, responses, force returns and recipient credits execute. */
export function createNativeBankerIncomeFixture(options: NativeBankerIncomeOptions): SpiceBankerIncomeFixture {
  const initial = initializeNativeBankerIncomeSetup(options);
  if ((options.kind ?? 'auction') === 'auction') {
    return createSpiceBankerIncomeFixture({
      initial, kind: 'auction', payerFaction: options.payerFaction ?? 'emperor',
      amount: options.amount ?? 4, stageIncomeCounter: options.stageIncomeCounter,
    });
  }
  let game = completeNativeBankerIncomeSetup(initial);
  game = advanceNativeBankerIncomeToPhase(game, 4);
  const assignment = game.leaderSkills!.assignments.find(a => a.skill === 'spice-banker')!;
  const payer = game.players.find(p => p.faction === (options.payerFaction ?? 'emperor'))!;
  assert.ok(payer);
  const count = options.amount ?? 3;
  assert.ok(payer.reserves >= count);
  // Labelled conserved rule-unit casualty position, not fabricated earned income.
  payer.reserves -= count;
  payer.tanks += count;
  const elite = options.elite ?? 0;
  if (elite) {
    assert.equal(payer.faction, 'ixians');
    assert.ok(elite <= count && payer.elites && payer.elites.reserves >= elite);
    payer.elites.reserves -= elite;
    payer.elites.tanks += elite;
  }
  if (options.stageIncomeCounter) {
    const owner = game.players.find(p => p.id === assignment.owner)!;
    if (!owner.hand.some(card => card.effect === 'karama')) {
      const index = game.deck.findIndex(card => card.effect === 'karama');
      assert.ok(index >= 0, 'A genuine native Karama must remain for conserved counter staging.');
      owner.hand.push(game.deck.splice(index, 1)[0]);
    }
  }
  const amount = forceRevivalQuote(game, payer, count, elite).cost;
  return {
    game, beforePayment: structuredClone(game), actor: payer.id, payer: payer.id,
    paymentAction: { type: 'revive', amount: count, ...(elite ? { elite } : {}) }, owner: assignment.owner,
    leader: assignment.leader, event: game.code, kind: 'force-revival', amount,
    bankLegs: [{ payer: payer.id, amount }],
  };
}

/** Continue the real action and its original private/native response suffix. */
export function payNativeBankerIncomeFixture(fixture: SpiceBankerIncomeFixture): Game {
  let game = applyAction(fixture.game, fixture.actor, fixture.paymentAction);
  for (let i = 0; (game.response || game.decision || game.pendingRevival) && i < 200; i++) game = step(game);
  assert.equal(game.response, null);
  assert.equal(game.decision, null);
  assert.ok(!game.pendingRevival);
  return game;
}
