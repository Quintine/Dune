import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, handLimit, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { semutaEmperorPlayer as player } from './fixture-semuta-emperor-share';
import { reactSemutaHomeworldChoam } from './fixture-semuta-homeworld-choam';
import { withoutSemutaHomeworldChoamMovementHolder } from './fixture-semuta-homeworld-choam-movement';
import {
  createSemutaHomeworldCaptureKaramaFixture, disposeSemutaHomeworldCaptureKarama,
  finishSemutaHomeworldCaptureKarama, semutaHomeworldCaptureKaramaResources as resources,
  semutaHomeworldCaptureKaramaStock as stock, type SemutaHomeworldCaptureKaramaFixture,
} from './fixture-semuta-homeworld-capture-karama';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'Rejected controls must not mutate the original native source');
}

function originalBattle(f: SemutaHomeworldCaptureKaramaFixture, g: Game) {
  const h = player(g, f.captor), e = player(g, f.victim);
  assert.equal(g.turn, 1);
  assert.equal(g.lastBattleContext?.winner, f.captor);
  assert.equal(g.lastBattleContext?.result, 'normal');
  assert.equal(g.lastBattleContext?.territory, 'carthag');
  assert.equal(g.battle, null);
  assert.equal(player(f.setup, f.captor).forces[f.location], 10);
  assert.equal(player(f.beforeBattle, f.captor).forces[f.location], 10);
  assert.equal(h.forces[f.location], 9);
  assert.equal(h.reserves, 10);
  assert.equal(h.tanks, 1);
  assert.equal(h.battleLosses, player(f.beforeBattle, f.captor).battleLosses + 1);
  assert.equal(e.forces[f.location] ?? 0, 0);
  assert.equal(e.reserves, 18);
  assert.equal(e.tanks, 2);
  assert.equal(e.battleLosses, player(f.beforeBattle, f.victim).battleLosses + 2);
  assert.equal(h.leaders.find(l => l.id === f.winnerLeader)?.dead, false);
  assert.equal(e.leaders.find(l => l.id === f.loserLeader)?.dead, false);
  assert.equal(h.spice, player(f.beforeBattle, f.captor).spice - 1,
    'Only the original Harkonnen supported dial leaves its wallet; no fabricated bounty is created');
  assert.equal(e.spice, player(f.beforeBattle, f.victim).spice,
    'The original Emperor payer receives no battle income for this one-spice support');
  assert.deepEqual(g.homeworlds?.custody, f.paidShipment.after.homeworlds?.custody);
  for (const seat of g.players.filter(p => ![f.captor, f.victim].includes(p.id))) {
    const before = player(f.beforeBattle, seat.id);
    assert.deepEqual(seat.forces, before.forces);
    assert.deepEqual(seat.elites, before.elites);
    assert.equal(seat.spice, before.spice);
    assert.equal(seat.reserves, before.reserves);
    assert.equal(seat.tanks, before.tanks);
  }
  assert.deepEqual(stock(g), stock(f.setup));
}

function unchangedPrivateSource(f: SemutaHomeworldCaptureKaramaFixture, g: Game) {
  for (const seat of g.players) {
    assert.deepEqual(seat.leaders, player(f.gameBeforeCost, seat.id).leaders,
      'No candidate is sampled, captured, concealed, transferred, killed or rewarded by a canceled capture');
    assert.deepEqual(seat.traitors, player(f.gameBeforeCost, seat.id).traitors);
    assert.ok(seat.leaders.every(l => !l.capturedBy && !l.concealed));
  }
  assert.deepEqual(g.traitorReserve, f.gameBeforeCost.traitorReserve);
  assert.deepEqual(g.homeworldOccupationHistory, f.gameBeforeCost.homeworldOccupationHistory);
  assert.deepEqual(g.homeworldOccupiedIncomeHistory, f.gameBeforeCost.homeworldOccupiedIncomeHistory);
  assert.deepEqual(g.homeworldOccupiedPercentageLedger, f.gameBeforeCost.homeworldOccupiedPercentageLedger);
  assert.deepEqual(g.tupileIntelligence, f.gameBeforeCost.tupileIntelligence);
  assert.deepEqual(g.giediCollection, f.gameBeforeCost.giediCollection);
}

function pausedCost(f: SemutaHomeworldCaptureKaramaFixture, g: Game) {
  originalBattle(f, g);
  unchangedPrivateSource(f, g);
  assert.equal(f.nativecaptureOffer?.decision?.kind, 'captureOffer');
  assert.equal(f.nativecaptureOffer?.decision?.player, f.captor);
  assert.equal(f.originalresponse?.response?.kind, 'capture');
  assert.equal(f.originalresponse?.response?.owner, f.captor);
  assert.deepEqual(g.pendingCapture,
    { player: f.captor, loser: f.victim, territory: 'carthag' });
  assert.equal(g.response, null, 'Printed cancellation response is detached while Semuta owns controls');
  const pending = g.pendingTreacheryDiscard;
  assert.ok(pending);
  assert.equal(pending.reaction?.stage, 'offer');
  assert.equal(pending.continuation.kind, 'karamaBattleDiscard');
  assert.equal(pending.batch.cause, 'karama:capture');
  assert.deepEqual(pending.batch.entries.map(e => ({ card: e.card.id, player: e.discardedBy, publicFace: e.publicFace })),
    [{ card: f.card, player: f.actor, publicFace: true }]);
  assert.equal(player(g, f.actor).hand.some(c => c.id === f.card), false);
  assert.equal(g.discard.filter(c => c.id === f.card).length, 1);
  assert.equal(viewGame(g, f.holder).semutaReaction?.canCommit, true);
  assert.equal(g.decision?.kind === 'capturedLeader', false);
  assert.deepEqual(resources(g), resources(f.gameBeforeCost));
}

function canceledExchange(f: SemutaHomeworldCaptureKaramaFixture, pending: Game, g: Game, claim: boolean) {
  originalBattle(f, g);
  unchangedPrivateSource(f, g);
  assert.equal(g.pendingCapture, null);
  assert.equal(g.response, null);
  assert.equal(g.pendingTreacheryDiscard, null);
  assert.notEqual(g.decision?.kind, 'capturedLeader');
  assert.deepEqual(resources(g), resources(pending));
  for (const seat of g.players) {
    const expected = player(pending, seat.id).hand.map(c => c.id);
    if (seat.id === f.holder && claim) expected.splice(expected.indexOf(SEMUTA_DRUG_ID), 1, f.card);
    assert.deepEqual(seat.hand.map(c => c.id).sort(), expected.sort(),
      'Only Richese exchanges its actual Semuta for Emperor’s spent printed Karama; no native hand draws');
  }
  assert.equal(player(g, f.actor).hand.some(c => c.id === f.card), false);
  assert.equal(player(g, f.holder).hand.filter(c => c.id === f.card).length, Number(claim));
  assert.equal(g.discard.filter(c => c.id === f.card).length, Number(!claim));
  assert.equal(g.discard.filter(c => c.id === SEMUTA_DRUG_ID).length, Number(claim));
  assert.equal(player(g, f.holder).hand.some(c => c.id === SEMUTA_DRUG_ID), !claim);
}

function finishOnce(f: SemutaHomeworldCaptureKaramaFixture, state: Game) {
  const finished = finishSemutaHomeworldCaptureKarama(state);
  const expected = resources(finished.beforeCollection);
  for (const receipt of finished.collection.receipts)
    expected.players.find(p => p.id === receipt.player)!.spice = receipt.balance;
  expected.spice = finished.collection.spice;
  assert.equal(finished.collection.receipts.find(r => r.player === f.captor)!.strongholds, 2,
    'Nine surviving Harkonnen counters on Carthag collect the two original stronghold points');
  assert.equal(finished.collection.receipts.find(r => r.player === f.captor)!.desert, 0,
    'The winner has no original desert presence to collect');
  assert.equal(finished.game.phase, 7);
  assert.equal(finished.game.turn, 1);
  assert.deepEqual(resources(finished.game), expected,
    'Only original Collection balances change: paid shipment, accepted casualties and living leaders never repeat');
  assert.deepEqual(stock(finished.game), stock(f.setup));
  assert.deepEqual(finished.game.players.map(p => p.hand), state.players.map(p => p.hand));
  assert.deepEqual(finished.game.players.map(p => p.traitors), state.players.map(p => p.traitors));
  assert.equal(finished.game.pendingCapture, null);
  rejected(finished.game, f.captor, { type: 'decision', accept: true });
  rejected(finished.game, f.actor, f.action);
  return finished.game;
}

for (const fullHolder of [false, true]) for (const claim of [false, true]) {
  void test(`Advanced native Homeworld capture cost: ${fullHolder ? 'full four' : 'thin'} Richese ${claim ? 'claim' : 'all-pass'} cancels capture before one original Collection`, () => {
    const f = createSemutaHomeworldCaptureKaramaFixture(fullHolder);
    const paid = f.paidShipment;
    assert.equal(player(paid.before, f.victim).reserves, 20);
    assert.equal(player(paid.after, f.victim).reserves, 18);
    assert.equal(player(paid.after, f.victim).forces[f.location], 2);
    assert.equal(player(paid.after, f.victim).spice, player(paid.before, f.victim).spice - 2);
    assert.deepEqual(player(paid.after, f.victim).elites, player(paid.before, f.victim).elites);
    const pending = disposeSemutaHomeworldCaptureKarama(f);
    pausedCost(f, pending);
    const event = pending.pendingTreacheryDiscard!.batch.event;
    rejected(pending, f.actor, f.action);
    rejected(pending, f.actor, { type: 'passResponse' });
    rejected(pending, f.captor, { type: 'decision', accept: true });
    rejected(pending, f.captor, { type: 'decision', mode: 'execute' });
    rejected(pending, f.captor, { type: 'semutaCommit', event });
    rejected(pending, f.actor, { type: 'semutaCommit', event });
    rejected(pending, f.holder, { type: 'semutaCommit', event: `${event}-retired` });
    rejected(pending, f.holder, { type: 'semutaSelect', event, card: f.card });
    const acknowledged = applyAction(pending, f.actor, { type: 'semutaPass', event });
    assert.deepEqual(resources(acknowledged), resources(pending));
    assert.equal(viewGame(acknowledged, f.holder).semutaReaction?.canCommit, true);
    rejected(acknowledged, f.actor, { type: 'semutaPass', event });
    const done = reactSemutaHomeworldChoam(claim ? acknowledged : pending, f.holder, claim);
    canceledExchange(f, pending, done, claim);
    assert.equal(player(done, f.holder).hand.length, fullHolder ? handLimit(player(done, f.holder)) : 1);
    for (const action of [{ type: 'semutaCommit', event }, { type: 'semutaPass', event },
      { type: 'semutaSelect', event, card: f.card }, f.action]) rejected(done, f.holder, action);
    const collected = finishOnce(f, done);
    rejected(collected, f.holder, { type: 'semutaCommit', event });
  });
}

void test('Native capture cost private forks expose only the holder’s current entitlement, not leaders or Giedi/Traitor custody', () => {
  const f = createSemutaHomeworldCaptureKaramaFixture(true);
  const absent = withoutSemutaHomeworldChoamMovementHolder(f.gameBeforeCost, f.holder);
  const pending = disposeSemutaHomeworldCaptureKarama(f);
  const neutral = disposeSemutaHomeworldCaptureKarama(f, absent);
  pausedCost(f, pending);
  assert.equal(viewGame(neutral, f.holder).semutaReaction?.canCommit, false);
  for (const seat of pending.players.filter(p => p.id !== f.holder)) {
    assert.equal(viewGame(pending, seat.id).semutaReaction?.canCommit, false);
    assert.deepEqual(JSON.parse(JSON.stringify(viewGame(pending, seat.id))),
      JSON.parse(JSON.stringify(viewGame(neutral, seat.id))),
      'A conserved hidden Richese card replacement cannot reveal entitlement to another actor');
    assert.deepEqual(viewGame(pending, seat.id).semutaReaction?.candidates, []);
  }
  const event = neutral.pendingTreacheryDiscard!.batch.event;
  rejected(neutral, f.holder, { type: 'semutaCommit', event });
  const claimed = reactSemutaHomeworldChoam(pending, f.holder, true);
  const passed = reactSemutaHomeworldChoam(neutral, f.holder, false);
  assert.deepEqual(resources(claimed), resources(passed));
  canceledExchange(f, pending, claimed, true);
  finishOnce(f, claimed);
  finishOnce(f, passed);
});

void test('Native capture cost refuses changed source, original owner, casualty context and clock without granting a claim', () => {
  const f = createSemutaHomeworldCaptureKaramaFixture();
  const pending = disposeSemutaHomeworldCaptureKarama(f);
  const event = pending.pendingTreacheryDiscard!.batch.event;
  const mutations: ((g: Game) => void)[] = [
    g => { g.pendingCapture!.player = f.victim; },
    g => { g.pendingCapture!.loser = 'a'; },
    g => { g.pendingCapture!.territory = 'arrakeen'; },
    g => { g.pendingCapture = null; },
    g => { g.phase = 7; },
    g => { g.advanced = false; },
    g => { player(g, f.captor).forces[f.location]++; },
    g => { player(g, f.victim).tanks--; },
    g => { g.lastBattleContext!.winner = f.victim; },
    g => { g.lastBattleContext!.territory = 'arrakeen'; },
    g => {
      const c = g.pendingTreacheryDiscard!.continuation;
      assert.equal(c.kind, 'karamaBattleDiscard');
      if (c.kind !== 'karamaBattleDiscard') throw Error('Expected native printed cost');
      c.use.response.owner = f.victim;
    },
    g => { g.pendingTreacheryDiscard!.batch.entries[0].discardedBy = f.captor; },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(pending);
    mutate(changed);
    rejected(changed, f.holder, { type: 'semutaCommit', event });
    rejected(changed, f.actor, { type: 'semutaPass', event });
  }
  pausedCost(f, pending);
});

for (const difficulty of DIFFICULTIES) void test(`${difficulty}: legal minimum original capture-cost consumer retires the reward without capture`, () => {
  const f = createSemutaHomeworldCaptureKaramaFixture(true);
  const pending = disposeSemutaHomeworldCaptureKarama(f);
  pausedCost(f, pending);
  const view = viewGame(pending, f.holder);
  view.players.find(p => p.id === f.holder)!.bot = difficulty;
  const action = botActions(view)[0];
  assert.ok(action);
  assert.ok(action.type === 'semutaCommit' || action.type === 'semutaPass');
  let game = applyAction(pending, f.holder, action);
  if (game.pendingTreacheryDiscard) {
    const event = game.pendingTreacheryDiscard.batch.event;
    for (const seat of game.players) {
      if (!game.pendingTreacheryDiscard) break;
      const reaction = game.pendingTreacheryDiscard.reaction;
      assert.ok(reaction?.stage === 'offer');
      if (!reaction.passed.includes(seat.id)) game = applyAction(game, seat.id, { type: 'semutaPass', event });
    }
  }
  canceledExchange(f, pending, game, action.type === 'semutaCommit');
  finishOnce(f, game);
});

void test('Basic companion original Homeworld battle never produces native capture or a fabricated cancel response', () => {
  const f = createSemutaHomeworldCaptureKaramaFixture(false, false);
  assert.equal(f.acceptedBattle.pendingCapture, null);
  assert.equal(f.nativecaptureOffer, null);
  assert.equal(f.originalresponse, null);
  assert.equal(f.game.pendingCapture, null);
  assert.equal(f.game.phase, 7);
  assert.equal(f.game.lastBattleContext?.winner, f.captor);
  assert.equal(player(f.game, f.captor).forces[f.location], 9);
  assert.equal(player(f.game, f.victim).tanks, 2);
  assert.deepEqual(f.game.players.map(p => p.leaders), f.acceptedBattle.players.map(p => p.leaders));
  assert.equal(f.game.discard.some(c => c.id === f.card), false);
  assert.equal(player(f.game, f.actor).hand.some(c => c.id === f.card), true);
  rejected(f.game, f.actor, f.action);
  rejected(f.game, f.captor, { type: 'decision', accept: true });
  assert.deepEqual(stock(f.game), stock(f.setup));
});
