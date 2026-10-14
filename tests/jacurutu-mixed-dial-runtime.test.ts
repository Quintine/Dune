import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import {
  createJacurutuMixedDialFixture,
  jacurutuBattleReceipt,
  jacurutuCurrentDecision,
} from './fixture-jacurutu-mixed-dial';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game));

const boardCount = (game: Game, id: string) =>
  Object.values(game.players.find(player => player.id === id)!.forces)
    .reduce((sum, count) => sum + count, 0);

const settlementLogs = (game: Game) =>
  game.log.filter(entry => entry.automatic?.name === 'Jacurutu Sietch income');

/** The genuine fixture advanced to its single pending physical dial choice. */
function pausedDialChoice(options?: { dial?: number; support?: number }) {
  const fixture = createJacurutuMixedDialFixture(options);
  const game = applyAction(reload(fixture.game), fixture.finalVote.actor, fixture.finalVote.action);
  return { fixture, game };
}

void test('the genuine Advanced battle is reached through real blows, shipments and free entry', () => {
  const fixture = createJacurutuMixedDialFixture();
  const token = fixture.game.discoveries!.tokens.find(candidate => candidate.id === fixture.token)!;
  assert.equal(token.face, 'jacurutu-sietch');
  assert.equal(token.status, 'placed');
  assert.equal(token.revealedTurn, 1);
  assert.equal(`${token.territory}:${token.sector}`, fixture.parent);
  assert.equal(fixture.parent, 'gara_kulon:8');
  const emperor = fixture.game.players.find(player => player.id === fixture.defender)!;
  assert.equal(emperor.faction, 'emperor');
  assert.equal(fixture.game.battle!.territory, fixture.territory);
  assert.equal(emperor.forces['jacurutu-sietch:0'], 2);
  assert.equal(emperor.elites!.forces['jacurutu-sietch:0'], 1);
  for (const player of fixture.game.players) {
    assert.equal(player.reserves + player.tanks + boardCount(fixture.game, player.id), 20);
    assert.ok(player.reserves >= (player.elites?.reserves ?? 0));
    assert.ok(player.tanks >= (player.elites?.tanks ?? 0));
  }
  assert.equal(jacurutuBattleReceipt(fixture.game), null);
  assert.equal(jacurutuCurrentDecision(fixture.game), null);
});

void test('the defeated owner alone sees both real physical readings of the mixed dial', () => {
  const { fixture, game } = pausedDialChoice();
  const decision = jacurutuCurrentDecision(game);
  assert.ok(decision);
  assert.equal(decision.player, fixture.defender);
  const receipt = jacurutuBattleReceipt(game)!;
  assert.equal(receipt.event, decision.event);
  assert.equal(receipt.owner, fixture.defender);
  assert.equal(receipt.winner, fixture.attacker);
  assert.deepEqual(receipt.choices.map(choice => choice.amount), [1, 0]);
  assert.deepEqual(receipt.choices.map(choice => choice.dialed), [
    { normal: 0, elite: 1, paidNormal: 0, paidElite: 1 },
    { normal: 1, elite: 1, paidNormal: 1, paidElite: 0 },
  ]);
  assert.deepEqual(receipt.selectedDial ?? null, null);
  assert.equal(viewGame(game, fixture.attacker).jacurutuDial, null);
  const ownerView = viewGame(game, fixture.defender).jacurutuDial!;
  assert.deepEqual(ownerView.choices.map(choice => choice.amount), [1, 0]);
  // The gate pauses before any settlement: no payment, casualty or reward yet.
  for (const player of game.players) {
    assert.equal(player.spice, fixture.game.players.find(candidate => candidate.id === player.id)!.spice);
    assert.equal(player.tanks, fixture.game.players.find(candidate => candidate.id === player.id)!.tanks);
  }
  assert.equal(game.players.find(player => player.id === fixture.defender)!.forces['jacurutu-sietch:0'], 2);
  assert.equal(settlementLogs(game).length, 0);
});

void test('either real reading settles the same original battle once and differs only by the Bank reward', () => {
  const { fixture, game } = pausedDialChoice();
  const before = reload(game);
  const decision = jacurutuCurrentDecision(game)!;
  const spiceBefore = Object.fromEntries(game.players.map(player => [player.id, player.spice]));
  const first = applyAction(reload(game), fixture.defender, {
    type: 'decision', event: decision.event, allocation: 0,
  });
  assert.deepEqual(game, before, 'A valid choice must not mutate the caller’s paused battle.');
  const second = applyAction(reload(game), fixture.defender, {
    type: 'decision', event: decision.event, allocation: 1,
  });
  const spiceOf = (settled: Game, id: string) => settled.players.find(player => player.id === id)!.spice;
  // The original battle completion also opens ordinary Collection; its city
  // income remains independent of Jacurutu's reward and both support payments.
  const collection = Object.fromEntries(quoteSpiceCollection(game).receipts.map(receipt =>
    [receipt.player,receipt.strongholds+receipt.collected]));
  assert.equal(first.phase,7);
  assert.equal(spiceOf(first, fixture.defender), spiceBefore[fixture.defender] - 1 + collection[fixture.defender]);
  assert.equal(spiceOf(second, fixture.defender), spiceBefore[fixture.defender] - 1 + collection[fixture.defender]);
  assert.equal(spiceOf(first, fixture.attacker), spiceBefore[fixture.attacker] - 2 + 1 + collection[fixture.attacker]);
  assert.equal(spiceOf(second, fixture.attacker), spiceBefore[fixture.attacker] - 2 + collection[fixture.attacker]);
  assert.equal(spiceOf(first, fixture.observer), spiceBefore[fixture.observer] + collection[fixture.observer]);
  // Everything except the Bank reward is the identical single continuation.
  for (const [index, player] of first.players.entries())
    assert.deepEqual({ ...player, spice: 0 }, { ...second.players[index], spice: 0 });
  assert.equal(settlementLogs(first).length, 1);
  assert.equal(settlementLogs(second).length, 0);
  assert.equal(first.log.filter(entry => entry.automatic?.name === 'Battle').length, 1);
  assert.equal(first.log.filter(entry => entry.automatic?.name === 'Jacurutu physical dial').length, 1);
  assert.equal(second.log.filter(entry => entry.automatic?.name === 'Jacurutu physical dial').length, 1);
  const emperor = first.players.find(player => player.id === fixture.defender)!;
  assert.equal(emperor.tanks, fixture.defenderTanks.normal + fixture.defenderTanks.elite);
  assert.equal(emperor.elites!.tanks, fixture.defenderTanks.elite);
  assert.equal(emperor.forces['jacurutu-sietch:0'], undefined);
  const atreides = first.players.find(player => player.id === fixture.attacker)!;
  assert.equal(atreides.tanks, 2, 'The winning Advanced commitment settles its own losses once.');
  assert.equal(atreides.forces['jacurutu-sietch:0'], 1);
  for (const player of first.players)
    assert.equal(player.reserves + player.tanks + boardCount(first, player.id), 20);
  assert.equal(first.battle, null);
  assert.equal(jacurutuCurrentDecision(first), null);
  assert.equal(jacurutuBattleReceipt(first), null);
  assert.equal(first.lastBattleContext?.winner, fixture.attacker);
  const stable = reload(first);
  assert.deepEqual(normalizeAutomaticGame(reload(stable)), stable);
  assert.throws(() => applyAction(reload(first), fixture.defender, {
    type: 'decision', event: decision.event, allocation: 0,
  }), /not available|pending decision/);
});

void test('a unique reading of the same real battle pays automatically without a choice', () => {
  const fixture = createJacurutuMixedDialFixture({ dial: 1, support: 0 });
  assert.equal(fixture.game.battle!.plans[fixture.defender]!.dial, fixture.dial);
  assert.equal(fixture.game.battle!.plans[fixture.defender]!.support, fixture.support);
  const spiceBefore = Object.fromEntries(fixture.game.players.map(player => [player.id, player.spice]));
  const done = applyAction(reload(fixture.game), fixture.finalVote.actor, fixture.finalVote.action);
  assert.equal(jacurutuCurrentDecision(done), null);
  assert.equal(jacurutuBattleReceipt(done), null);
  assert.equal(done.battle, null);
  const collection = Object.fromEntries(quoteSpiceCollection(fixture.game).receipts.map(receipt =>
    [receipt.player,receipt.strongholds+receipt.collected]));
  assert.equal(done.phase,7);
  assert.equal(done.players.find(player => player.id === fixture.attacker)!.spice, spiceBefore[fixture.attacker] - 2 + 1 + collection[fixture.attacker]);
  assert.equal(done.players.find(player => player.id === fixture.defender)!.spice, spiceBefore[fixture.defender] + collection[fixture.defender]);
  assert.equal(settlementLogs(done).length, 1);
  const emperor = done.players.find(player => player.id === fixture.defender)!;
  assert.equal(emperor.tanks, 2);
  assert.equal(emperor.elites!.tanks, 1);
  assert.equal(emperor.forces['jacurutu-sietch:0'], undefined);
  for (const player of done.players)
    assert.equal(player.reserves + player.tanks + boardCount(done, player.id), 20);
  const stable = reload(done);
  assert.deepEqual(normalizeAutomaticGame(reload(stable)), stable);
});

void test('a wrong actor, stale event or stale index never changes the paused battle', () => {
  const { fixture, game } = pausedDialChoice();
  const before = reload(game);
  const decision = jacurutuCurrentDecision(game)!;
  assert.throws(() => applyAction(reload(game), fixture.attacker, {
    type: 'decision', event: decision.event, allocation: 0,
  }), /pending decision/);
  assert.throws(() => applyAction(reload(game), fixture.observer, {
    type: 'decision', event: decision.event, allocation: 0,
  }), /pending decision/);
  for (const action of [
    { type: 'decision', event: 'stale-event', allocation: 0 },
    { type: 'decision', event: decision.event, allocation: 2 },
    { type: 'decision', event: decision.event, allocation: -1 },
    { type: 'decision', event: decision.event, allocation: 0.5 },
    { type: 'decision', event: decision.event },
    { type: 'decision', event: decision.event, allocation: 0, dial: 2 },
  ] as Action[])
    assert.throws(() => applyAction(reload(game), fixture.defender, action),
      /Jacurutu dial/);
  assert.deepEqual(game, before);
  const receipt = jacurutuBattleReceipt(game)!;
  assert.deepEqual(receipt.selectedDial ?? null, null);
  assert.deepEqual(viewGame(game, fixture.defender).jacurutuDial!.choices.map(choice => choice.amount), [1, 0]);
});
