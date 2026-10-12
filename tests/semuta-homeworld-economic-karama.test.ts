import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, handLimit, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { semutaEmperorPlayer as player } from './fixture-semuta-emperor-share';
import { holdSemutaHomeworldChoamCard } from './fixture-semuta-homeworld-choam';
import { semutaHomeworldChoamMovementResources as resources,
  semutaHomeworldChoamMovementStock as stock } from './fixture-semuta-homeworld-choam-movement';
import {
  createSemutaHomeworldEconomicKaramaFixture, disposeSemutaHomeworldEconomicKarama,
  finishSemutaHomeworldEconomicKarama, reactSemutaHomeworldEconomicKarama,
  withoutSemutaHomeworldEconomicHolder, type SemutaHomeworldEconomicKaramaFixture,
} from './fixture-semuta-homeworld-economic-karama';

function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'A rejected stale/cross-actor action has no effect');
}

function assertNativeEconomy(f: SemutaHomeworldEconomicKaramaFixture) {
  assert.equal(f.game.turn, 1);
  assert.equal(player(f.game, f.owner).faction, 'choam');
  assert.equal(player(f.game, f.canceller).faction, 'emperor');
  assert.equal(player(f.game, f.holder).faction, 'richese');
  assert.equal(player(f.setup, f.owner).spice, 2);
  assert.equal(player(f.game, f.canceller).spice, 10);
  assert.deepEqual(f.game.homeworlds?.custody, f.setup.homeworlds?.custody);
  for (const seat of f.game.players) {
    assert.equal(seat.reserves, player(f.setup, seat.id).reserves);
    assert.equal(seat.tanks, player(f.setup, seat.id).tanks);
    assert.deepEqual(seat.forces, player(f.setup, seat.id).forces);
    assert.deepEqual(seat.elites, player(f.setup, seat.id).elites);
  }
  const ownerView = viewGame(f.game, f.owner);
  assert.equal(ownerView.homeworlds!.worlds!.find(world => world.native === f.owner)!.population, 20,
    'Original ordinary Tupile population is preserved without any shipment');
  assert.equal(ownerView.charity.incomeHomeworld, 0, 'Original full Tupile has no low-population bonus');
  assert.equal(ownerView.charity.multiplier, 1);
  if (f.scope === 'charity') {
    assert.equal(f.game.phase, 2);
    assert.equal(player(f.game, f.owner).spice, 2, 'Native eight-spice CHOAM opening income is still unpaid');
    assert.equal(ownerView.charity.incomePending, true);
  } else {
    assert.equal(f.game.phase, 8);
    assert.equal(player(f.game, f.owner).spice, 10, 'First ordinary native income paid exactly eight');
    assert.equal(f.game.inflationAttemptTurn, 1, 'Actual placement, not Karama spending, consumes the attempt');
    assert.ok(f.beforeCollection && f.collectionQuote);
    for (const receipt of f.collectionQuote.receipts)
      assert.equal(player(f.game, receipt.player).spice, receipt.balance,
        'Native Collection credits including Advanced strongholds precede Mentat');
    assert.equal(player(f.beforeCollection, f.target).spice, 10);
    assert.equal(player(f.game, f.target).spice, f.game.advanced ? 12 : 10);
  }
}

function assertDenied(f: SemutaHomeworldEconomicKaramaFixture, done: Game, claimed: boolean) {
  assert.ok(!done.pendingTreacheryDiscard && !done.response);
  assert.equal(done.phase, f.game.phase);
  assert.equal(done.turn, 1);
  assert.deepEqual(resources(done), resources(f.game), 'Cost and denial never transfer/refund spice or move original custody');
  assert.deepEqual(stock(done), stock(f.game));
  assert.equal(player(done, f.canceller).hand.some(c => c.id === f.card), false);
  assert.equal(player(done, f.holder).hand.some(c => c.id === f.card), claimed);
  assert.equal(player(done, f.holder).hand.some(c => c.id === SEMUTA_DRUG_ID), !claimed);
  assert.equal(done.discard.filter(c => c.id === f.card).length, Number(!claimed));
  assert.equal(done.discard.filter(c => c.id === SEMUTA_DRUG_ID).length, Number(claimed));
  for (const seat of done.players)
    assert.equal(seat.hand.length, player(f.game, seat.id).hand.length - Number(seat.id === f.canceller));
  if (f.scope === 'charity') {
    assert.deepEqual(done.choamCharity, { turn: 1, canceled: true });
    assert.equal(player(done, f.owner).spice, 2);
    assert.equal(viewGame(done, f.owner).charity.incomeCanceled, true);
    assert.equal(viewGame(done, f.owner).charity.payer, null, 'Canceled income leaves charity bank-paid');
  } else {
    assert.equal(done.inflationAttemptTurn, 1);
    assert.ok(!done.inflation && !done.inflationUsed);
    assert.equal(player(done, f.owner).spice, 10);
    reject(done, f.owner, { type: 'choamInflation', side: 'double' });
    reject(done, f.owner, { type: 'choamInflation', side: 'cancel' });
  }
  reject(done, f.canceller, f.action);
  reject(done, f.canceller, { type: 'passResponse' });
  if (claimed) reject(done, f.holder, f.action);
}

function assertSuffix(f: SemutaHomeworldEconomicKaramaFixture, done: Game) {
  const suffix = finishSemutaHomeworldEconomicKarama(done, f);
  assert.equal(suffix.status, 'playing');
  const settled = f.afterCancel!;
  assert.deepEqual(suffix.homeworlds?.custody, settled.homeworlds?.custody);
  for (const seat of suffix.players) {
    assert.deepEqual(seat.forces, player(settled, seat.id).forces);
    assert.equal(seat.reserves, player(settled, seat.id).reserves);
    assert.equal(seat.tanks, player(settled, seat.id).tanks);
  }
  if (f.scope === 'charity') {
    assert.equal(suffix.phase, 3);
    assert.equal(suffix.turn, 1);
    assert.deepEqual(resources(suffix), resources(done), 'The completed opening denial cannot repay its eight spice');
    assert.deepEqual(suffix.choamCharity, { turn: 1, canceled: true });
  } else {
    assert.equal(suffix.phase, 2);
    assert.equal(suffix.turn, 2);
    assert.ok(!suffix.inflation && !suffix.inflationUsed);
    assert.equal(suffix.choamMentatPending, false);
    assert.equal(viewGame(suffix, f.owner).charity.multiplier, 1);
    assert.deepEqual(suffix.choamCharity, { turn: 2, canceled: false });
    assert.ok(f.beforeNextIncome);
    assert.equal(player(f.beforeNextIncome, f.owner).spice, 10);
    assert.equal(player(suffix, f.owner).spice, 18, 'Original next-turn income remains ordinary eight, not sixteen/zero');
    for (const seat of suffix.players.filter(p => p.id !== f.owner))
      assert.equal(seat.spice, player(done, seat.id).spice);
    reject(suffix, f.owner, { type: 'decision', done: true });
  }
}

for (const advanced of [false, true]) for (const scope of ['charity', 'inflation'] as const) {
  const label = `${advanced ? 'Advanced' : 'Basic'} Homeworld ${scope} printed Karama`;
  for (const claimed of [false, true]) void test(`${label}: ${claimed ? 'claim' : 'pass'} resumes exactly one denial without native economic replay`, () => {
    const f = createSemutaHomeworldEconomicKaramaFixture(scope, advanced);
    assertNativeEconomy(f);
    const pending = disposeSemutaHomeworldEconomicKarama(f);
    const cost = pending.pendingTreacheryDiscard;
    assert.ok(cost);
    assert.equal(cost.continuation.kind, scope === 'charity' ? 'karamaCharityDiscard' : 'karamaInflationDiscard');
    assert.equal(cost.batch.cause, scope === 'charity' ? 'karama:choamCharity' : 'karama:choamInflation');
    assert.deepEqual(cost.batch.entries.map(e => ({ card: e.card.id, actor: e.discardedBy, face: e.publicFace })),
      [{ card: f.card, actor: f.canceller, face: true }]);
    assert.equal(pending.discard.filter(c => c.id === f.card).length, 1);
    assert.equal(player(pending, f.canceller).hand.some(c => c.id === f.card), false);
    assert.deepEqual(resources(pending), resources(f.game));
    assert.deepEqual(pending.choamCharity, f.game.choamCharity, 'Printed denial has not happened during its cost offer');
    assert.equal(viewGame(pending, f.holder).semutaReaction?.canCommit, true);
    reject(pending, f.canceller, f.action);
    reject(pending, f.owner, { type: 'ready' });
    reject(pending, f.canceller, { type: 'passResponse' });
    reject(pending, f.target, { type: 'semutaCommit', event: cost.batch.event });
    reject(pending, f.holder, { type: 'semutaCommit', event: `${cost.batch.event}:stale` });
    const done = reactSemutaHomeworldEconomicKarama(JSON.parse(JSON.stringify(pending)), f.holder, claimed);
    assertDenied(f, done, claimed);
    reject(done, f.holder, { type: 'semutaCommit', event: cost.batch.event });
    reject(done, f.target, { type: 'semutaPass', event: cost.batch.event });
    assertSuffix(f, done);
  });

  void test(`${label}: full four-card holder exchanges one card; equal-size absent-Semuta substitution is private`, () => {
    const f = createSemutaHomeworldEconomicKaramaFixture(scope, advanced, true);
    const pending = disposeSemutaHomeworldEconomicKarama(f);
    const neutral = disposeSemutaHomeworldEconomicKarama(f, withoutSemutaHomeworldEconomicHolder(f.game, f.holder));
    assert.equal(player(f.game, f.holder).hand.length, 4);
    assert.equal(handLimit(player(f.game, f.holder)), 4);
    assert.equal(viewGame(pending, f.holder).semutaReaction?.canCommit, true);
    assert.equal(viewGame(neutral, f.holder).semutaReaction?.canCommit, false);
    reject(neutral, f.holder, { type: 'semutaCommit', event: neutral.pendingTreacheryDiscard!.batch.event });
    for (const seat of pending.players.filter(p => p.id !== f.holder)) {
      assert.deepEqual(viewGame(pending, seat.id), viewGame(neutral, seat.id));
      assert.equal(viewGame(pending, seat.id).semutaReaction?.canCommit, false);
    }
    const done = reactSemutaHomeworldEconomicKarama(pending, f.holder, true);
    assertDenied(f, done, true);
    assert.equal(player(done, f.holder).hand.length, 4);
    const passed = reactSemutaHomeworldEconomicKarama(neutral, f.holder, false);
    assert.deepEqual(resources(passed), resources(done));
    assert.equal(passed.discard.filter(c => c.id === f.card).length, 1);
    assertSuffix(f, done);
  });

  void test(`${label}: non-BG Worthless, absent Ix Kull and wrong-seat cancellation remain excluded`, () => {
    const f = createSemutaHomeworldEconomicKaramaFixture(scope, advanced);
    const game = structuredClone(f.game);
    const worthless = holdSemutaHomeworldChoamCard(game, f.canceller, 'Baliset');
    const kull = 'ix-kull-wahad';
    assert.equal(stock(game).includes(kull), false, 'Exact CHOAM profile has no printed Ix Kull to substitute');
    assert.ok(!game.players.some(p => p.faction === 'beneGesserit'));
    assert.ok(!viewGame(game, f.canceller).responseControls?.cancelCards.includes(worthless));
    reject(game, f.canceller, { type: 'card', card: worthless, mode: 'cancel' });
    reject(game, f.owner, { type: 'card', card: kull, mode: 'cancel' });
    reject(game, f.holder, f.action);
    reject(game, f.canceller, { type: 'choamInflation', side: 'double' });
    reject(game, f.owner, { type: 'card', card: kull, mode: 'kull', target: f.canceller });
    const pending = disposeSemutaHomeworldEconomicKarama(f, game);
    assert.deepEqual(pending.pendingTreacheryDiscard!.batch.entries.map(e => e.card.id), [f.card]);
    assert.equal(player(pending, f.owner).hand.some(c => c.id === kull), false);
    assert.equal(player(pending, f.canceller).hand.some(c => c.id === worthless), true);
  });

  for (const difficulty of DIFFICULTIES) void test(`${difficulty}: ${label} uses actual Semuta and the original CHOAM next-actor controls`, () => {
    const f = createSemutaHomeworldEconomicKaramaFixture(scope, advanced);
    let game = disposeSemutaHomeworldEconomicKarama(f);
    const view = viewGame(game, f.holder);
    view.players.find(p => p.id === f.holder)!.bot = difficulty;
    const action = botActions(view)[0];
    assert.ok(action && (action.type === 'semutaCommit' || action.type === 'semutaPass'));
    game = applyAction(game, f.holder, action);
    if (game.pendingTreacheryDiscard) game = reactSemutaHomeworldEconomicKarama(game, f.holder, false);
    assertDenied(f, game, action.type === 'semutaCommit');
    const nextView = viewGame(game, f.owner);
    nextView.players.find(p => p.id === f.owner)!.bot = difficulty;
    const next = botActions(nextView)[0];
    assert.ok(next);
    const after = applyAction(game, f.owner, next);
    assert.equal(after.turn, 1);
    assert.equal(player(after, f.owner).spice, player(game, f.owner).spice);
    assertSuffix(f, after);
  });
}

for (const advanced of [false, true]) void test(`${advanced ? 'Advanced' : 'Basic'}: original Cancel-side Inflation denial also consumes its attempt without zeroing next charity`, () => {
  const base = createSemutaHomeworldEconomicKaramaFixture('inflation', advanced);
  const declaration: Action = { type: 'choamInflation', side: 'cancel' };
  const game = applyAction(base.beforeDeclaration, base.owner, declaration);
  const f = { ...base, game, originalResponse: structuredClone(game), declaration };
  assert.equal(game.response?.intent, 'cancel');
  const pending = disposeSemutaHomeworldEconomicKarama(f);
  const done = reactSemutaHomeworldEconomicKarama(pending, f.holder, true);
  assertDenied(f, done, true);
  assertSuffix(f, done);
});

void test('Advanced Medium: a legal native Gamont follow-on preserves the canceled Inflation attempt and original close', () => {
  const f = createSemutaHomeworldEconomicKaramaFixture('inflation', true);
  const gamont = holdSemutaHomeworldChoamCard(f.game, f.owner, 'Trip to Gamont');
  const done = reactSemutaHomeworldEconomicKarama(disposeSemutaHomeworldEconomicKarama(f), f.holder, true);
  const own = viewGame(done, f.owner);
  own.players.find(p => p.id === f.owner)!.bot = 'Medium';
  const proposal = botActions(own)[0];
  assert.ok(proposal && proposal.card === gamont);
  const declared = applyAction(done, f.owner, proposal);
  assert.equal(declared.response?.kind, 'choamWorthless');
  assert.equal(declared.inflationAttemptTurn, 1);
  assert.equal(player(declared, f.target).forces['arrakeen:10'], 10);
  assertSuffix(f, declared);
  assert.equal(player(f.targetSuffix!, f.target).forces['arrakeen:10'], 9);
  assert.equal(player(f.targetSuffix!, f.target).reserves, 11);
  assert.equal(player(f.targetSuffix!, f.owner).spice, 18);
  assert.equal(player(f.targetSuffix!, f.target).spice, 12);
  assert.equal(f.targetSuffix!.discard.filter(c => c.id === gamont).length, 1);
});
