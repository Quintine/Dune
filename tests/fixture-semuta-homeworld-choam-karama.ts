import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { semutaEmperorPlayer } from './fixture-semuta-emperor-share';
import { applySemutaHomeworldChoamStep, holdSemutaHomeworldChoamCard } from './fixture-semuta-homeworld-choam';
import {
  createSemutaHomeworldChoamMovementFixture,
  type SemutaHomeworldChoamMovementFixture,
} from './fixture-semuta-homeworld-choam-movement';
import {
  createSemutaHomeworldChoamReturnsFixture,
  type SemutaHomeworldChoamReturnsFixture,
} from './fixture-semuta-homeworld-choam-returns';
import type { RicheseSkillsTechStep } from './fixture-richese-skills-tech';

export type SemutaHomeworldChoamKaramaPower = 'kulon' | 'baliset' | 'laLaLa' | 'gamont';
export type SemutaHomeworldChoamKaramaFixture = {
  setup: Game;
  beforeDeclaration: Game;
  /** Exact original declaration response, before Emperor spends its Karama. */
  game: Game;
  owner: string;
  holder: string;
  target: string;
  canceller: string;
  card: string;
  karama: string;
  power: SemutaHomeworldChoamKaramaPower;
  action: Action;
  cancelAction: Action;
  actions: RicheseSkillsTechStep[];
  movement?: SemutaHomeworldChoamMovementFixture;
  returns?: SemutaHomeworldChoamReturnsFixture;
};

/** Genuine native prefix and printed declaration. Only conserved original
 * physical cards are positioned; the movement fixture already holds Karama. */
export function createSemutaHomeworldChoamKaramaFixture(
  power: SemutaHomeworldChoamKaramaPower, advanced = false, fullHolder = false,
): SemutaHomeworldChoamKaramaFixture {
  const movement = power === 'kulon' || power === 'baliset'
    ? createSemutaHomeworldChoamMovementFixture(power, advanced, fullHolder) : undefined;
  const returns = power === 'laLaLa' || power === 'gamont'
    ? createSemutaHomeworldChoamReturnsFixture(power, advanced) : undefined;
  const native = movement ?? returns;
  assert.ok(native);
  const beforeDeclaration = structuredClone(native.game);
  const canceller = movement?.canceller
    ?? beforeDeclaration.players.find(player => player.faction === 'emperor')!.id;
  assert.equal(semutaEmperorPlayer(beforeDeclaration, canceller).faction, 'emperor');
  const held = semutaEmperorPlayer(beforeDeclaration, canceller).hand.find(card => card.effect === 'karama');
  const karama = held?.id ?? holdSemutaHomeworldChoamCard(beforeDeclaration, canceller, 'Karama');
  const actions = structuredClone(native.actions);
  const game = applySemutaHomeworldChoamStep(beforeDeclaration, native.owner, native.action, actions);
  assert.equal(game.response?.kind, 'choamWorthless');
  assert.equal(game.response!.owner, native.owner);
  assert.ok(viewGame(game, canceller).responseControls?.cancelCards.includes(karama));
  return { setup: native.setup, beforeDeclaration, game,
    owner: native.owner, holder: native.holder, target: native.target, canceller,
    card: native.card, karama, power, action: native.action,
    cancelAction: { type: 'card', mode: 'cancel', card: karama }, actions, movement, returns };
}

export function cancelSemutaHomeworldChoamKarama(
  fixture: SemutaHomeworldChoamKaramaFixture, state = fixture.game, actions?: RicheseSkillsTechStep[],
): Game {
  return applySemutaHomeworldChoamStep(state, fixture.canceller, fixture.cancelAction, actions);
}

/** Singleton printed Karama only; pass every still-entitled neutral participant. */
export function reactSemutaHomeworldChoamKarama(
  state: Game, holder: string, claim: boolean, actions?: RicheseSkillsTechStep[],
): Game {
  const pending = state.pendingTreacheryDiscard;
  assert.ok(pending);
  const reaction = pending.reaction;
  if (reaction?.stage !== 'offer') throw Error('Expected the fresh native Karama discard offer');
  const event = pending.batch.event;
  if (claim) return applySemutaHomeworldChoamStep(state, holder, { type: 'semutaCommit', event }, actions);
  let game = state;
  for (const player of state.players.filter(player => !reaction.passed.includes(player.id)))
    game = applySemutaHomeworldChoamStep(game, player.id, { type: 'semutaPass', event }, actions);
  return game;
}
