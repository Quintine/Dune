import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import type { PlanClaim } from '../game/battle-promises';
import { homeworldRevivalActionBlock } from '../game/homeworld-revival-deployment-options';
import { createSalusaGholaTruthFixture } from './fixture-salusa-ghola-truth';

type Fixture = ReturnType<typeof createSalusaGholaTruthFixture>;
type Case = 'dial2' | 'dial1' | 'support';
const sources = new Map<Case, Fixture>();
function source(kind: Case): Fixture {
  let fixture = sources.get(kind);
  if (!fixture) {
    const claim: PlanClaim = kind === 'support'
      ? { kind: 'support', compare: 'gte', value: 1 }
      : { kind: 'dial', compare: 'eq', value: kind === 'dial1' ? 1 : 2 };
    fixture = createSalusaGholaTruthFixture({ claim, answer: 'yes', inspectionDial: kind === 'dial1' ? 1 : 2 });
    sources.set(kind, fixture);
  }
  return fixture;
}
const profiles = ['Easy', 'Medium', 'Hard', 'Brutal'] as const;
function ownPromise(game: Game, actor: string) {
  const promise = game.battle?.truthPromises?.find(row => row.player === actor && !row.released);
  assert.ok(promise, 'The actual answered Truthtrance promise remains live.');
  return promise;
}

// These are shared control-adapter and minimal-policy checks over the earned
// native source. No Ghola amount selector or Battle Plan form is operated here;
// GameTable SSR is covered by the integration owner's separate runtime smoke.
void test('the exact owned Ghola group remains available when Salusa High preserves the native Yes dial2 promise', () => {
  const f = source('dial2'), game = structuredClone(f.game), view = viewGame(game, f.actor);
  assert.deepEqual(f.action, { type: 'card', card: f.card, amount: 1, elite: 1 });
  assert.deepEqual(ownPromise(game, f.actor).claim, f.claim);
  assert.equal(homeworldRevivalActionBlock(view, f.action), null);
  assert.equal(view.ghola.available, true); assert.ok(view.ghola.cards.includes(f.card));
  assert.equal(view.ghola.maxForces, 1); assert.equal(view.ghola.eliteRemaining, 1);
  const returned = applyAction(game, f.actor, f.action);
  assert.equal(returned.battle?.event, game.battle?.event);
  assert.deepEqual(ownPromise(returned, f.actor).claim, f.claim);
  assert.equal(ownPromise(returned, f.actor).answer, true);
  assert.equal(viewGame(returned, f.actor).battle?.ownForces?.eliteFreeSupport, true);
  assert.equal(returned.discard.filter(card => card.id === f.card).length, 1);
  assert.equal(returned.players.find(player => player.id === f.actor)!.elites!.tanks, 0);
});

void test('the selected Ghola group block agrees with native rejection for an odd-dial or paid-support Yes promise', () => {
  for (const kind of ['dial1', 'support'] as const) {
    const f = source(kind), game = structuredClone(f.game), view = viewGame(game, f.actor);
    const blocked = homeworldRevivalActionBlock(view, f.action);
    assert.ok(blocked, `${kind}: the actual selected return needs a visible block.`);
    assert.match(blocked, /Truthtrance|promise/i);
    assert.ok(view.homeworldRevivalBlocks?.some(row => row.source === 'ghola' &&
      row.amount === f.action.amount && row.elite === f.action.elite && row.reason === blocked));
    assert.equal(view.ghola.maxForces, 0); assert.equal(view.ghola.eliteRemaining, 0);
    const before = structuredClone(game);
    assert.throws(() => applyAction(game, f.actor, f.action), error => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, blocked);
      return true;
    });
    assert.deepEqual(game, before);
    assert.equal(ownPromise(game, f.actor).answer, true);
    assert.ok(game.players.find(player => player.id === f.actor)!.hand.some(card => card.id === f.card));
  }
});

void test('all four minimal profiles omit blocked Ghola and retain legal required plans before and after an allowed return', () => {
  for (const kind of ['dial1', 'support', 'dial2'] as const) {
    const f = source(kind);
    const start = kind === 'dial2' ? applyAction(f.game, f.actor, f.action) : f.game;
    for (const profile of profiles) {
      const game = structuredClone(start), view = viewGame(game, f.actor);
      view.players.find(player => player.id === f.actor)!.bot = profile;
      const actions = botActions(view);
      assert.ok(actions.length, `${kind}/${profile}: current legal participation remains available.`);
      assert.ok(actions.every(action => action.type !== 'card' || action.card !== f.card),
        `${kind}/${profile}: no blocked or already spent Ghola is offered.`);
      const plans = actions.filter(action => action.type === 'battlePlan');
      assert.ok(plans.length, `${kind}/${profile}: the live promise has a legal current plan.`);
      for (const plan of plans) {
        if (kind === 'support') assert.ok(Number(plan.support) >= 1);
        else assert.equal(plan.dial, kind === 'dial1' ? 1 : 2);
        if (kind === 'dial2') assert.equal(plan.support ?? 0, 0);
        const sealed = applyAction(game, f.actor, plan);
        assert.ok(sealed.battle?.plans[f.actor]);
        assert.equal(ownPromise(sealed, f.actor).answer, true);
      }
    }
  }
});
