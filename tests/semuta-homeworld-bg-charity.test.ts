import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, handLimit, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { semutaEmperorPlayer as player } from './fixture-semuta-emperor-share';
import { nextRicheseSkillsTechNativeStep } from './fixture-richese-skills-tech';
import { semutaHomeworldChoamMovementResources as resources,
  semutaHomeworldChoamMovementStock as stock } from './fixture-semuta-homeworld-choam-movement';
import { withoutSemutaHomeworldEconomicHolder } from './fixture-semuta-homeworld-economic-karama';
import {
  createSemutaHomeworldBgCharityFixture, disposeSemutaHomeworldBgCharity,
  reactSemutaHomeworldBgCharity, finishSemutaHomeworldBgCharity,
  type SemutaHomeworldBgCharityFixture,
} from './fixture-semuta-homeworld-bg-charity';

function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'Rejected wrong-owner, stale or replay actions have no effect');
}

function assertNative(f: SemutaHomeworldBgCharityFixture) {
  assert.equal(f.game.turn, 1);
  assert.equal(f.game.phase, 2);
  assert.equal(player(f.setup, f.payer).spice, 2);
  assert.equal(player(f.originalIncomeResponse, f.payer).spice, 2);
  assert.equal(f.originalIncomeResponse.response?.kind, 'choamCharity');
  assert.equal(player(f.game, f.payer).spice, 12, 'Actual five-player income is ten, once');
  assert.deepEqual(f.game.choamCharity, { turn: 1, canceled: false });
  assert.equal(player(f.setup, f.owner).spice, 5);
  assert.equal(player(f.game, f.owner).spice, 5, 'BG is genuinely wealthy, never staged poor');
  assert.deepEqual(f.game.homeworlds?.custody, f.setup.homeworlds?.custody);
  for (const seat of f.game.players) {
    assert.equal(seat.reserves, player(f.setup, seat.id).reserves);
    assert.equal(seat.tanks, player(f.setup, seat.id).tanks);
    assert.deepEqual(seat.forces, player(f.setup, seat.id).forces);
    assert.deepEqual(seat.elites, player(f.setup, seat.id).elites);
    if (seat.id !== f.payer) assert.equal(seat.spice, player(f.setup, seat.id).spice);
  }
  assert.deepEqual(stock(f.game), stock(f.setup), 'Native stock is physically conserved');
  const own = viewGame(f.gameBeforeBGclaim, f.owner);
  assert.equal(own.charity.homeworld, 0, 'High Wallach gives no fabricated low-population bonus');
  assert.equal(own.charity.payer, f.payer);
  if (f.game.advanced) {
    assert.equal(own.charity.amount, 2);
    assert.equal(f.amount, 2);
    assert.equal(f.game.response?.kind, 'bgCharity');
    assert.equal(f.game.response?.owner, f.owner);
    assert.equal(f.game.response?.amount, 2);
    assert.equal(f.game.response?.charityHomeworld, 0);
    assert.notEqual(player(f.gameBeforeBGclaim, f.owner).charityTurn, 1);
    assert.equal(player(f.game, f.owner).charityTurn, 1, 'Actual claim consumes the allowance before its response');
  } else {
    assert.equal(own.charity.amount, 0);
    assert.equal(f.originalResponse, null);
    assert.equal(f.game.response, null);
    assert.notEqual(player(f.game, f.owner).charityTurn, 1);
  }
}

function assertDenied(f: SemutaHomeworldBgCharityFixture, game: Game, claimed: boolean) {
  assert.ok(!game.pendingTreacheryDiscard);
  assert.notEqual(game.response?.kind, 'bgCharity');
  assert.equal(game.turn, 1);
  assert.equal(game.phase, 2);
  assert.deepEqual(resources(game), resources(f.game), 'Denial and recovery neither pay BG nor debit CHOAM or move forces/custody');
  assert.deepEqual(stock(game), stock(f.game));
  assert.equal(player(game, f.owner).spice, 5);
  assert.equal(player(game, f.payer).spice, 12);
  assert.equal(player(game, f.owner).charityTurn, 1);
  assert.deepEqual(game.choamCharity, { turn: 1, canceled: false });
  assert.equal(player(game, f.actor).hand.some(card => card.id === f.card), false);
  assert.equal(player(game, f.holder).hand.some(card => card.id === f.card), claimed);
  assert.equal(player(game, f.holder).hand.some(card => card.id === SEMUTA_DRUG_ID),
    !claimed && player(f.game, f.holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
  assert.equal(game.discard.filter(card => card.id === f.card).length, Number(!claimed));
  assert.equal(game.discard.filter(card => card.id === SEMUTA_DRUG_ID).length, Number(claimed));
  for (const seat of game.players)
    assert.equal(seat.hand.length, player(f.game, seat.id).hand.length - Number(seat.id === f.actor));
  reject(game, f.owner, f.claim);
  reject(game, f.actor, f.action);
  if (claimed) reject(game, f.holder, f.action);
}

function assertSuffix(f: SemutaHomeworldBgCharityFixture, game: Game) {
  const next = finishSemutaHomeworldBgCharity(game);
  assert.equal(next.status, 'playing');
  assert.equal(next.phase, 3);
  assert.equal(next.turn, 1);
  assert.ok(!next.pendingTreacheryDiscard && !next.response && !next.decision && !next.phaseOpening);
  assert.deepEqual(resources(next), resources(f.game), 'Original native close never restores the denied two spice');
  assert.equal(player(next, f.owner).charityTurn, 1);
  assert.equal(viewGame(next, f.owner).charity.payer, f.payer);
  assert.equal(player(next, f.payer).spice, 12);
  reject(next, f.owner, f.claim);
  reject(next, f.actor, f.action);
  const nextAction = nextRicheseSkillsTechNativeStep(next);
  const after = applyAction(next, nextAction.actor, nextAction.action);
  assert.equal(after.turn, 1);
  assert.equal(after.phase, 3);
  assert.equal(player(after, f.owner).spice, 5);
  assert.equal(player(after, f.payer).spice, 12);
}

for (const claimed of [false, true]) void test(`Advanced native BG charity: ${claimed ? 'claim' : 'pass'} pays the printed Karama once and denies the original two spice`, () => {
  const f = createSemutaHomeworldBgCharityFixture();
  assertNative(f);
  reject(f.game, f.holder, f.action);
  const game = disposeSemutaHomeworldBgCharity(f), cost = game.pendingTreacheryDiscard;
  assert.ok(cost && cost.reaction?.stage === 'offer');
  assert.equal(cost.continuation.kind, 'karamaBgCharityDiscard');
  assert.equal(cost.batch.cause, 'karama:bgCharity');
  assert.deepEqual(cost.batch.entries.map(entry => ({ card: entry.card.id, actor: entry.discardedBy, face: entry.publicFace })),
    [{ card: f.card, actor: f.actor, face: true }]);
  if (cost.continuation.kind === 'karamaBgCharityDiscard') {
    assert.deepEqual(cost.continuation.use.response, f.originalResponse!.response);
    assert.deepEqual(cost.continuation.resume.response, f.originalResponse!.response);
  }
  assert.equal(game.response, null);
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
  assert.equal(player(game, f.actor).hand.some(card => card.id === f.card), false);
  assert.deepEqual(resources(game), resources(f.game));
  assert.equal(player(game, f.owner).charityTurn, 1);
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  reject(game, f.owner, f.claim);
  reject(game, f.actor, f.action);
  reject(game, f.actor, { type: 'passResponse' });
  reject(game, f.target, { type: 'semutaCommit', event: cost.batch.event });
  reject(game, f.holder, { type: 'semutaCommit', event: `${cost.batch.event}:stale` });
  const done = reactSemutaHomeworldBgCharity(JSON.parse(JSON.stringify(game)), f.holder, claimed);
  assertDenied(f, done, claimed);
  reject(done, f.holder, { type: 'semutaCommit', event: cost.batch.event });
  reject(done, f.target, { type: 'semutaPass', event: cost.batch.event });
  assertSuffix(f, done);
});

void test('Advanced native BG charity: full four-card Richese exchanges one card and keeps the absent-Semuta boundary private', () => {
  const f = createSemutaHomeworldBgCharityFixture(true, true);
  assertNative(f);
  assert.equal(player(f.game, f.holder).hand.length, 4);
  assert.equal(handLimit(player(f.game, f.holder)), 4);
  const game = disposeSemutaHomeworldBgCharity(f);
  const neutral = disposeSemutaHomeworldBgCharity(f, withoutSemutaHomeworldEconomicHolder(f.game, f.holder));
  assert.equal(viewGame(game, f.holder).semutaReaction?.canCommit, true);
  assert.equal(viewGame(neutral, f.holder).semutaReaction?.canCommit, false);
  reject(neutral, f.holder, { type: 'semutaCommit', event: neutral.pendingTreacheryDiscard!.batch.event });
  for (const seat of game.players.filter(p => p.id !== f.holder)) {
    assert.deepEqual(viewGame(game, seat.id), viewGame(neutral, seat.id));
    assert.equal(viewGame(game, seat.id).semutaReaction?.canCommit, false);
  }
  const done = reactSemutaHomeworldBgCharity(game, f.holder, true);
  assertDenied(f, done, true);
  assert.equal(player(done, f.holder).hand.length, 4);
  const passed = reactSemutaHomeworldBgCharity(neutral, f.holder, false);
  assertDenied({ ...f, game: withoutSemutaHomeworldEconomicHolder(f.game, f.holder) }, passed, false);
  assert.deepEqual(resources(passed), resources(done));
  assertSuffix(f, done);
});

void test('Basic native wealthy BG cannot create an extra charity response or spend its cancel cost', () => {
  const f = createSemutaHomeworldBgCharityFixture(false);
  assertNative(f);
  reject(f.game, f.owner, f.claim);
  reject(f.game, f.actor, f.action);
  assert.equal(player(f.game, f.actor).hand.some(card => card.id === f.card), true);
  assert.equal(f.game.discard.some(card => card.id === f.card), false);
  assert.ok(!f.game.pendingTreacheryDiscard && !f.game.response);
  const next = finishSemutaHomeworldBgCharity(f.game);
  assert.equal(next.phase, 3);
  assert.deepEqual(resources(next), resources(f.game));
  assert.equal(player(next, f.owner).spice, 5);
  assert.equal(player(next, f.payer).spice, 12);
  assert.notEqual(player(next, f.owner).charityTurn, 1);
});

for (const difficulty of DIFFICULTIES) void test(`${difficulty}: actual Semuta and native next BG controls preserve the canceled charity allowance`, () => {
  const f = createSemutaHomeworldBgCharityFixture();
  let game = disposeSemutaHomeworldBgCharity(f);
  const own = viewGame(game, f.holder);
  own.players.find(p => p.id === f.holder)!.bot = difficulty;
  const reaction = botActions(own)[0];
  assert.ok(reaction && (reaction.type === 'semutaCommit' || reaction.type === 'semutaPass'));
  game = applyAction(game, f.holder, reaction);
  if (game.pendingTreacheryDiscard) game = reactSemutaHomeworldBgCharity(game, f.holder, false);
  assertDenied(f, game, reaction.type === 'semutaCommit');
  const nextView = viewGame(game, f.owner);
  nextView.players.find(p => p.id === f.owner)!.bot = difficulty;
  const next = botActions(nextView)[0];
  assert.ok(next);
  const after = applyAction(game, f.owner, next);
  assert.equal(player(after, f.owner).charityTurn, 1);
  assert.equal(player(after, f.owner).spice, 5);
  assert.equal(player(after, f.payer).spice, 12);
  assertSuffix(f, after);
});
