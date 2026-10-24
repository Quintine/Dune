import assert from 'node:assert/strict';
import { applyAction, handLimit, type Action, type Game } from '../game/engine';
import { treacheryDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { createSemutaKaitainFixture } from './fixture-semuta-kaitain';
import { nextRicheseSkillsTechNativeStep, type RicheseSkillsTechStep } from './fixture-richese-skills-tech';
import { moveSemutaEmperorCard, semutaEmperorPlayer } from './fixture-semuta-emperor-share';

export function createSemutaHomeworldChoamSetup(advanced = false) {
  const native = createSemutaKaitainFixture({ advanced, count: 1 });
  // This exposed snapshot is the original completed native setup, before that
  // fixture's later Kaitain hand staging or paid disposal. Not a clock rewind.
  const game = structuredClone(native.setup);
  assert.equal(game.status, 'playing');
  assert.ok(game.homeworlds?.custody && game.semutaPreview);
  assert.ok(game.players.some(p => p.faction === 'choam'));
  moveSemutaEmperorCard(game, SEMUTA_DRUG_ID, native.holder);
  assert.ok(semutaEmperorPlayer(game, native.holder).hand.length <= handLimit(semutaEmperorPlayer(game, native.holder)));
  return { game, owner: native.choam, holder: native.holder,
    target: game.players.find(p => p.faction === 'atreides')!.id,
    canceller: native.owner, actions: [] as RicheseSkillsTechStep[] };
}

/** Conserved physical card only; never mint a face or rewrite the whole deck. */
export function holdSemutaHomeworldChoamCard(game: Game, owner: string, name: string): string {
  const card = [...treacheryDeck(game.expansions), ...richeseCards()].find(card => card.name === name);
  assert.ok(card, `Missing printed card ${name}`);
  return moveSemutaEmperorCard(game, card.id, owner);
}

/** Acknowledge only the actual final battle window; leave fresh discards and
 * every subsequent card, casualty or aftermath choice to the caller. */
export function finishSemutaBattleOutcome(state: Game, actions?: RicheseSkillsTechStep[]): Game {
  let game = state;
  while (game.battle?.outcomeWindow && !game.battle.outcomeWindow.closed) {
    const window = game.battle.outcomeWindow;
    const actor = [window.attacker, window.defender].find(id => !window.ready.includes(id));
    assert.ok(actor);
    game = applySemutaHomeworldChoamStep(game, actor,
      { type: 'battleOutcomeReady', event: window.event }, actions);
  }
  return game;
}

/** Caller tests the requested boundary before each real native action. */
export function advanceSemutaHomeworldChoam(
  state: Game, until: (game: Game) => boolean, actions?: RicheseSkillsTechStep[],
): Game {
  let game = state;
  for (let n = 0; !until(game) && n < 1600; n++) {
    assert.notEqual(game.status, 'finished', 'The original Homeworld game must reach the requested boundary');
    let next: RicheseSkillsTechStep;
    const pending = game.pendingTreacheryDiscard, reaction = pending?.reaction;
    if (pending && reaction?.stage === 'offer') {
      const actor = game.players.find(p => !reaction.passed.includes(p.id))!.id;
      next = { actor, action: { type: 'semutaPass', event: pending.batch.event } };
    } else if (game.decision?.kind === 'choamMarket') {
      next = { actor: game.decision.player, action: { type: 'decision', done: true } };
    } else next = nextRicheseSkillsTechNativeStep(game);
    actions?.push(next);
    game = applyAction(game, next.actor, next.action);
  }
  assert.ok(until(game), 'The native Homeworld continuation must reach its boundary');
  return game;
}

export function reactSemutaHomeworldChoam(state: Game, holder: string, claim: boolean): Game {
  const event = state.pendingTreacheryDiscard!.batch.event;
  if (claim) return applyAction(state, holder, { type: 'semutaCommit', event });
  let game = state;
  for (const player of state.players) game = applyAction(game, player.id, { type: 'semutaPass', event });
  return game;
}

export function applySemutaHomeworldChoamStep(game: Game, actor: string, action: Action,
  actions?: RicheseSkillsTechStep[]): Game {
  actions?.push({ actor, action });
  return applyAction(game, actor, action);
}
