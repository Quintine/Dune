import assert from 'node:assert/strict';
import { applyAction, type Action, type Game } from '../game/engine';
import {
  semutaIxBattleFixture, semutaIxPlanSteps, semutaIxSubstitutionStep,
  semutaIxPlayer, type SemutaIxFixture,
} from './fixture-semuta-ix-substitution';
import {
  semutaMoritaniRetentionFixture, resolveSemutaMoritaniBattle,
  finishSemutaMoritaniWinner, chooseSemutaMoritaniRetention,
  type SemutaMoritaniFixture,
} from './fixture-semuta-moritani-retention';

export type SemutaNativeKaramaStep = { actor: string; action: Action };
export type SemutaNativeKaramaFixture = {
  game: Game; kind: 'ixSubstitution' | 'moritaniRetention';
  holder: string; spender: string; owner: string;
  karama: string; semuta: string; cards: string[];
  ix?: SemutaIxFixture; moritani?: SemutaMoritaniFixture;
};
export const semutaNativeKaramaReload = (game: Game): Game => JSON.parse(JSON.stringify(game));
export function semutaNativeKaramaAct(game: Game, step: SemutaNativeKaramaStep, actions?: SemutaNativeKaramaStep[]) {
  actions?.push(structuredClone(step));
  return applyAction(game, step.actor, step.action);
}

/** Original lobby and conserved later battle; only the existing printed Karama changes hands. */
export function semutaNativeIxKaramaFixture(advanced = false): SemutaNativeKaramaFixture {
  const ix = semutaIxBattleFixture(advanced);
  const richese = semutaIxPlayer(ix.game, ix.holder);
  const index = richese.hand.findIndex(card => card.effect === 'karama');
  assert.ok(index >= 0);
  const [karama] = richese.hand.splice(index, 1);
  semutaIxPlayer(ix.game, ix.loser).hand.push(karama);
  return { game: ix.game, kind: 'ixSubstitution', holder: ix.holder,
    spender: ix.loser, owner: ix.winner, karama: karama.id, semuta: ix.semuta, cards: ix.cards, ix };
}
export function semutaNativeMoritaniKaramaFixture(
  options: { karamaHolder?: 'w' | 'l'; semutaHolder?: 'r' | 'l' } = {},
): SemutaNativeKaramaFixture {
  const spender = options.karamaHolder ?? 'w', holder = options.semutaHolder ?? 'r';
  const moritani = semutaMoritaniRetentionFixture({ karamaHolder: spender, semutaHolder: holder });
  assert.ok(moritani.karama);
  return { game: moritani.game, kind: 'moritaniRetention', holder, spender,
    owner: 'm', karama: moritani.karama, semuta: moritani.semuta, cards: moritani.cards, moritani };
}

/** Export exact legal reaction steps, including neutral later offers after Semuta was spent. */
export function semutaNativeKaramaReactionSteps(game: Game, f: SemutaNativeKaramaFixture, claim = false): SemutaNativeKaramaStep[] {
  const pending = game.pendingTreacheryDiscard;
  assert.ok(pending);
  const reaction = pending.reaction;
  if (reaction?.stage !== 'offer') throw Error('Expected the neutral fresh discard offer.');
  const event = pending.batch.event;
  if (claim) {
    assert.equal(pending.batch.entries.length, 1, 'This API commits the singleton printed cost.');
    return [{ actor: f.holder, action: { type: 'semutaCommit', event } }];
  }
  return game.players.filter(p => !reaction.passed.includes(p.id))
    .map(p => ({ actor: p.id, action: { type: 'semutaPass' as const, event } }));
}
export function semutaNativeKaramaReact(game: Game, f: SemutaNativeKaramaFixture, claim = false, actions?: SemutaNativeKaramaStep[]) {
  for (const step of semutaNativeKaramaReactionSteps(game, f, claim))
    game = semutaNativeKaramaAct(game, step, actions);
  return game;
}

/** Native pre-cost actions: pass Snooper, declare the actual 1/1 exchange; or choose a played losing card. */
export function semutaNativeKaramaPreCost(f: SemutaNativeKaramaFixture, actions?: SemutaNativeKaramaStep[]): Game {
  if (f.kind === 'moritaniRetention') {
    assert.ok(f.moritani);
    let game = resolveSemutaMoritaniBattle(f.moritani, actions);
    game = finishSemutaMoritaniWinner(game, [], actions);
    return chooseSemutaMoritaniRetention(game, f.moritani.weapon, actions);
  }
  assert.ok(f.ix);
  const ix = f.ix;
  let game = semutaNativeKaramaAct(f.game,
    { actor: ix.winner, action: { type: 'chooseBattle', territory: ix.territory, target: ix.loser } }, actions);
  for (let count = 0; count < 40; count++) {
    let step: SemutaNativeKaramaStep;
    if (game.response) {
      const actor = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(actor);
      step = { actor: actor.id, action: { type: 'passResponse' } };
    } else if (game.battle?.preparation)
      step = { actor: game.battle.preparation.owner, action: { type: 'declineBattlePower' } };
    else if (game.decision?.kind === 'fullPlanOffer')
      step = { actor: game.decision.player, action: { type: 'decision', decline: true } };
    else break;
    game = semutaNativeKaramaAct(game, step, actions);
  }
  assert.ok(game.battle?.preLeader);
  for (const actor of [ix.winner, ix.loser])
    game = semutaNativeKaramaAct(game,
      { actor, action: { type: 'battlePreparationReady', event: game.battle!.preLeader!.event } }, actions);
  for (const step of semutaIxPlanSteps(game, ix)) game = semutaNativeKaramaAct(game, step, actions);
  assert.equal(game.decision?.kind, 'poisonTooth');
  game = semutaNativeKaramaAct(game, { actor: ix.winner, action: { type: 'decision', activate: true } }, actions);
  for (const actor of [ix.winner, ix.loser])
    game = semutaNativeKaramaAct(game, { actor, action: { type: 'traitorCall', call: false } }, actions);
  assert.deepEqual(game.pendingTreacheryDiscard?.batch.entries.map(entry => entry.card.id), [ix.snooper]);
  game = semutaNativeKaramaReact(game, f, false, actions);
  assert.equal(game.decision?.kind, 'ixSubstitution');
  return semutaNativeKaramaAct(game, semutaIxSubstitutionStep(ix, true), actions);
}
export function semutaNativeKaramaCostStep(f: SemutaNativeKaramaFixture): SemutaNativeKaramaStep {
  return { actor: f.spender, action: { type: 'card', card: f.karama, mode: 'cancel' } };
}
export function semutaNativeKaramaCost(game: Game, f: SemutaNativeKaramaFixture, actions?: SemutaNativeKaramaStep[]): Game {
  assert.equal(game.response?.kind, f.kind);
  assert.equal(game.response?.owner, f.owner);
  return semutaNativeKaramaAct(game, semutaNativeKaramaCostStep(f), actions);
}

/** Pass later fresh native batches; Ix still discards its used Tooth before optional Shield cleanup. */
export function semutaNativeKaramaRemainder(game: Game, f: SemutaNativeKaramaFixture, actions?: SemutaNativeKaramaStep[]): Game {
  for (let count = 0; game.phase === 6 && count < 16; count++) {
    if (game.pendingTreacheryDiscard) {
      assert.notEqual(game.pendingTreacheryDiscard.batch.cause, `karama:${f.kind}`,
        'Retire the cost reaction before entering its native suffix.');
      game = semutaNativeKaramaReact(game, f, false, actions);
    } else if (f.kind === 'ixSubstitution' && game.decision?.kind === 'battleCards') {
      assert.ok(f.ix);
      assert.deepEqual(game.decision.cards, [f.ix.shield]);
      game = semutaNativeKaramaAct(game,
        { actor: f.ix.winner, action: { type: 'decision', discard: [f.ix.shield] } }, actions);
    } else throw Error('The canceled native aftermath did not expose its original cleanup.');
  }
  assert.equal(game.phase, 7);
  assert.equal(game.pendingTreacheryDiscard, null);
  return game;
}
