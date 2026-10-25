import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import {
  createSemutaGholaIncomeFixture as fixture, actSemutaGholaIncome as act,
  semutaGholaIncomePlayer as player, semutaGholaIncomeInventory as inventory,
  passSemutaGholaIncome as pass, claimSemutaGholaIncome as claim,
  allowSemutaGholaIncome as allow,
} from './fixture-semuta-ghola-income';

const quotas = (game: Game, actor: string) => {
  const p = player(game, actor);
  return { revived: p.revived, freeForcesRevived: p.freeForcesRevived,
    leaderRevived: p.leaderRevived, elitesRevived: p.elites?.revived };
};
function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}

void test('a real Ghola return offers Semuta before its original conditional Tleilaxu income', () => {
  const f = fixture(), source = structuredClone(f.game), beforeIncome = player(source, f.incomeOwner).spice;
  const game = act(source, f.owner, f.gholaAction), pending = game.pendingTreacheryDiscard;
  assert.equal(pending?.reaction?.stage, 'offer');
  assert.equal(pending.continuation.kind, 'ordinaryCardDiscard');
  if (pending.continuation.kind !== 'ordinaryCardDiscard') assert.fail('Retain the original ordinary-card parent');
  assert.equal(pending.continuation.effect, 'ghola');
  assert.deepEqual(pending.continuation.resume.response,
    { kind: 'revivalIncome', owner: f.incomeOwner, recipient: f.owner, amount: 1, passed: [] });
  assert.equal(game.response, null);
  assert.equal(player(game, f.owner).reserves, 10); assert.equal(player(game, f.owner).tanks, 0);
  assert.equal(player(game, f.incomeOwner).spice, beforeIncome);
  assert.deepEqual(quotas(game, f.owner), quotas(source, f.owner));
  for (const p of game.players) {
    const offer = viewGame(game, p.id).semutaReaction!;
    assert.deepEqual(offer.candidates, []); assert.equal(offer.canCommit, p.id === f.claimant);
  }
  assert.deepEqual(source, f.game); assert.deepEqual(inventory(game), f.originalInventory);
});

for (const claims of [false, true]) for (const canceled of [false, true])
  void test('Ghola income ' + (claims ? 'claim' : 'pass') + ' keeps physical returns through native ' +
    (canceled ? 'cancellation' : 'allowance'), () => {
    const f = fixture(), beforeIncome = player(f.game, f.incomeOwner).spice;
    const pending = act(f.game, f.owner, f.gholaAction);
    const originalResponse = pending.pendingTreacheryDiscard?.continuation;
    assert.ok(originalResponse?.kind === 'ordinaryCardDiscard');
    let game = claims ? claim(pending, f.claimant, f.ghola) : pass(pending);
    assert.equal(game.pendingTreacheryDiscard, null);
    assert.deepEqual(game.response, originalResponse.resume.response,
      'Claim/pass restores the same actual income frame before any counter or payment');
    assert.equal(player(game, f.incomeOwner).spice, beforeIncome);
    assert.equal(player(game, f.owner).reserves, 10); assert.equal(player(game, f.owner).tanks, 0);
    assert.deepEqual(quotas(game, f.owner), quotas(f.game, f.owner));
    assert.equal(player(game, f.claimant).hand.some(card => card.id === f.ghola), claims);
    assert.equal(game.discard.some(card => card.id === f.semuta), claims);
    assert.equal(game.discard.some(card => card.id === f.ghola), !claims);
    game = canceled
      ? act(game, f.counterOwner, { type: 'card', card: f.counter, mode: 'cancel' })
      : allow(game);
    if (canceled) {
      assert.equal(game.pendingTreacheryDiscard?.continuation.kind, 'karamaIncomeDiscard');
      game = pass(game);
      assert.equal(game.pendingTreacheryDiscard, null);
    }
    assert.equal(game.response, null);
    assert.equal(player(game, f.incomeOwner).spice, beforeIncome + Number(!canceled));
    assert.equal(player(game, f.owner).spice, 11, 'Ghola and a counter do not refund or repay the Box');
    assert.equal(player(game, f.owner).reserves, 10); assert.equal(player(game, f.owner).tanks, 0);
    assert.deepEqual(quotas(game, f.owner), quotas(f.game, f.owner));
    assert.deepEqual(inventory(game), f.originalInventory);
  });

void test('a full-hand Semuta claimant exchanges its physical cost before the unchanged Ghola income resumes', () => {
  const f = fixture({ fullHand: true }), pending = act(f.game, f.owner, f.gholaAction);
  assert.equal(player(pending, f.claimant).hand.length, 4);
  const game = claim(pending, f.claimant, f.ghola);
  assert.equal(player(game, f.claimant).hand.length, 4);
  assert.ok(player(game, f.claimant).hand.some(card => card.id === f.ghola));
  assert.ok(!player(game, f.claimant).hand.some(card => card.id === f.semuta));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, 1);
  assert.equal(game.response?.kind, 'revivalIncome');
  assert.deepEqual(game.response.passed, []);
  assert.deepEqual(inventory(game), f.originalInventory);
});

void test('a controlled own Tleilaxu Ghola return retains the one-spice self-income through Semuta recovery', () => {
  const f = fixture(), source = structuredClone(f.game), native = player(source, f.incomeOwner);
  // Explicit conserved prior acquisition/casualty, not a natural-source claim.
  const holder = player(source, f.owner), index = holder.hand.findIndex(card => card.id === f.ghola);
  assert.ok(index >= 0); native.hand.push(holder.hand.splice(index, 1)[0]);
  assert.ok(native.reserves > 0); native.reserves--; native.tanks++;
  const reserves = native.reserves, income = native.spice, originalQuotas = quotas(source, native.id);
  let game = act(source, native.id, f.gholaAction);
  assert.equal(game.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  const continuation = game.pendingTreacheryDiscard!.continuation;
  assert.ok(continuation.kind === 'ordinaryCardDiscard');
  assert.deepEqual(continuation.resume.response,
    { kind: 'revivalIncome', owner: native.id, recipient: native.id, amount: 1, passed: [] });
  game = claim(game, f.claimant, f.ghola);
  assert.equal(player(game, native.id).spice, income);
  assert.equal(player(game, native.id).reserves, reserves + 1); assert.equal(player(game, native.id).tanks, 0);
  game = allow(game);
  assert.equal(player(game, native.id).spice, income + 1);
  assert.deepEqual(quotas(game, native.id), originalQuotas);
  assert.deepEqual(inventory(game), f.originalInventory);
});

void test('a controlled native leader Ghola can be recovered before income without returning the separate Tank', () => {
  const f = fixture(), source = structuredClone(f.game), owner = player(source, f.owner);
  // Explicit prior leader death; the original physical disc stays with its owner.
  const leader = owner.leaders[0]; leader.dead = true; leader.deaths = 1;
  const income = player(source, f.incomeOwner).spice, beforeQuotas = quotas(source, f.owner);
  let game = act(source, f.owner, { type: 'card', card: f.ghola, leader: leader.id });
  assert.equal(game.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  assert.equal(player(game, f.owner).leaders.find(disc => disc.id === leader.id)!.dead, false);
  assert.equal(player(game, f.owner).reserves, 9); assert.equal(player(game, f.owner).tanks, 1);
  game = claim(game, f.claimant, f.ghola);
  assert.equal(game.response?.kind, 'revivalIncome'); assert.equal(player(game, f.incomeOwner).spice, income);
  game = allow(game);
  assert.equal(player(game, f.incomeOwner).spice, income + 1);
  assert.deepEqual(quotas(game, f.owner), beforeQuotas);
  assert.deepEqual(inventory(game), f.originalInventory);
});

void test('stale fresh events and altered Ghola-income parents reject before card custody or income changes', () => {
  const f = fixture(), pending = act(f.game, f.owner, f.gholaAction);
  const event = pending.pendingTreacheryDiscard!.batch.event;
  rejected(pending, f.claimant, { type: 'semutaCommit', event: 'stale-ghola-discard' });
  rejected(pending, f.claimant, { type: 'semutaSelect', event, card: f.ghola });
  const changed = structuredClone(pending), continuation = changed.pendingTreacheryDiscard!.continuation;
  assert.equal(continuation.kind, 'ordinaryCardDiscard');
  if (continuation.kind !== 'ordinaryCardDiscard') assert.fail('Expected the real Ghola parent');
  assert.ok(continuation.resume.response?.kind === 'revivalIncome');
  continuation.resume.response.amount = 2;
  const before = structuredClone(changed);
  assert.throws(() => viewGame(changed, f.claimant)); assert.deepEqual(changed, before);
  rejected(changed, f.claimant, { type: 'semutaCommit', event });
});
