import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, handLimit, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { splitLocation } from '../game/board';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { semutaEmperorPlayer as player } from './fixture-semuta-emperor-share';
import {
  createSemutaHomeworldLoserFixture, disposeSemutaHomeworldLoser, finishSemutaHomeworldLoser,
  type SemutaHomeworldLoserFixture,
} from './fixture-semuta-homeworld-battle-loser';

function offerEvent(game: Game): string {
  const pending = game.pendingTreacheryDiscard;
  assert.ok(pending, 'A fresh public discard offer must be open');
  return pending.batch.event;
}

function claimLoser(f: SemutaHomeworldLoserFixture, state: Game, card: string): Game {
  const event = offerEvent(state);
  return applyAction(applyAction(state, f.holder, { type: 'semutaCommit', event }),
    f.holder, { type: 'semutaSelect', event, card });
}

function passLoser(state: Game): Game {
  const event = offerEvent(state);
  let game = state;
  for (const seat of state.players)
    game = applyAction(game, seat.id, { type: 'semutaPass', event });
  return game;
}

function cleanupDecision(game: Game) {
  const decision = game.decision;
  assert.ok(decision && decision.kind === 'battleCards',
    'The winning side keeps its held played cards under its own native cleanup');
  return decision;
}

/** The public combatant facts every seat shares after the losers cede cards. */
function assertSettled(f: SemutaHomeworldLoserFixture, game: Game) {
  const { winner, loser } = { winner: player(game, f.winner), loser: player(game, f.owner) };
  assert.equal(winner.forces[f.location], 3, 'The winner keeps exactly its surviving dialed force');
  assert.equal(winner.reserves, player(f.game, f.winner).reserves, 'Shipment already left the native reserve pool');
  assert.equal(loser.forces[f.location] ?? 0, 0, 'The entire losing force leaves the board');
  assert.equal(loser.tanks, 1, 'Exactly one losing force is destroyed to Tanks');
  assert.equal(loser.reserves, player(f.game, f.owner).reserves);
  for (const seat of game.players) {
    const view = viewGame(game, seat.id);
    assert.equal(view.players.find(p => p.id === f.winner)!.forces[f.location], 3);
    assert.equal(view.players.find(p => p.id === f.owner)!.forces[f.location] ?? 0, 0);
    assert.equal(view.players.find(p => p.id === f.owner)!.tanks, 1);
  }
}

for (const advanced of [false, true]) {
  const label = `${advanced ? 'Advanced' : 'Basic'} original paid Homeworld battle`;

  void test(`${label}: native shipments and battle produce the public losing-card batch before any Semuta offer`, () => {
    const f = createSemutaHomeworldLoserFixture(advanced);
    assert.equal(f.setup.status, 'playing');
    assert.equal(f.game.turn, 1);
    assert.equal(f.game.phase, 6);
    assert.equal(f.game.pendingTreacheryDiscard ?? null, null, 'The losing batch has not been offered yet');
    assert.equal(f.game.decision ?? null, null);
    assert.ok([f.winner, f.owner].includes(f.game.active!));
    assert.equal(splitLocation(f.location).territory, 'red_chasm');
    assert.equal(new Set([f.winner, f.owner, f.holder]).size, 3);
    assert.equal(new Set([...f.cards, ...f.winnerCards]).size, 4, 'Four distinct physical weapon/defense cards');
    assert.equal(player(f.game, f.owner).hand.find(c => c.id === f.cards[0])!.kind, 'projectile');
    assert.equal(player(f.game, f.owner).hand.find(c => c.id === f.cards[1])!.kind, 'shield');
    assert.equal(player(f.game, f.winner).hand.find(c => c.id === f.winnerCards[0])!.kind, 'projectile');
    assert.equal(player(f.game, f.winner).hand.find(c => c.id === f.winnerCards[1])!.kind, 'shield');
    assert.ok(f.cards.every(id => !f.game.discard.some(c => c.id === id)));
    assert.equal(f.beforeBattle.phase, f.game.phase);
    assert.deepEqual(f.beforeBattle.players.map(p => p.forces), f.game.players.map(p => p.forces));

    const voters = viewGame(f.game, f.game.host).battle!.traitorVoters;
    assert.equal(f.actor, voters[voters.length - 1], 'The last real traitor response belongs to the final public voter');
    assert.equal(f.action.type, 'traitorCall');
    assert.ok([f.winner, f.owner].includes(f.actor));

    assert.equal(f.shipments.length, 2);
    const [winnerShip, loserShip] = f.shipments;
    assert.equal(winnerShip.actor, f.winner);
    assert.equal(loserShip.actor, f.owner);
    assert.equal(winnerShip.action.type, 'ship');
    assert.equal(loserShip.action.type, 'ship');
    assert.equal(winnerShip.action.amount, 4);
    assert.equal(loserShip.action.amount, 1);
    assert.equal(winnerShip.price, 8);
    assert.equal(loserShip.price, 2);
    for (const ship of f.shipments) {
      const amount = ship.action.amount;
      assert.ok(typeof amount === 'number');
      assert.equal(player(ship.before, ship.actor).spice - player(ship.after, ship.actor).spice, ship.price);
      assert.equal(ship.price, 2 * amount);
      assert.equal(player(ship.before, ship.actor).reserves - player(ship.after, ship.actor).reserves, amount);
      assert.equal(player(ship.after, ship.actor).forces[f.location], amount);
      assert.deepEqual(player(ship.after, ship.actor).elites, player(ship.before, ship.actor).elites,
        'Only ordinary native reserves depart, not Sardaukar');
      assert.deepEqual(ship.after.homeworlds?.custody, ship.before.homeworlds?.custody,
        'Kaitain supply comes from the native reserve pool, not staged custody');
    }
    assert.equal(player(f.game, f.winner).forces[f.location], 4);
    assert.equal(player(f.game, f.owner).forces[f.location], 1);

    const done = disposeSemutaHomeworldLoser(f);
    assert.equal(done.phase, 6);
    assert.equal(done.turn, 1);
    assert.equal(done.lastBattleContext!.winner, f.winner);
    assert.equal(done.lastBattleContext!.territory, 'red_chasm');
    const pending = done.pendingTreacheryDiscard;
    assert.ok(pending);
    assert.equal(pending.batch.cause, 'battle:mandatory');
    assert.deepEqual(pending.batch.entries.map(entry => [entry.card.id, entry.discardedBy]).sort((a, b) => a[0].localeCompare(b[0])),
      f.cards.map(id => [id, f.owner]).sort((a, b) => a[0].localeCompare(b[0])), 'The batch is exactly the losing player\'s two played cards');
    assert.equal(pending.reaction?.stage, 'offer');
    for (const card of f.cards) assert.ok(done.discard.some(c => c.id === card));
    assert.ok(player(done, f.winner).hand.every(card => !f.cards.includes(card.id)));
    assert.equal(player(done, f.owner).forces[f.location] ?? 0, 0);
    assert.equal(player(done, f.owner).tanks, 1);
    assert.equal(player(done, f.winner).forces[f.location], 4,
      'The winner\'s own casualties belong to the original continuation, not the offer');
    assert.equal(player(done, f.winner).spice, player(f.game, f.winner).spice - f.support);
    assert.equal(f.support, advanced ? 1 : 0);
    assert.equal(player(done, f.winner).reserves, 16);
    assert.equal(player(done, f.owner).reserves, 19);
    assert.equal(player(done, f.holder).hand.filter(c => c.id === SEMUTA_DRUG_ID).length, 1);
    assert.deepEqual(done.homeworlds?.custody, f.game.homeworlds?.custody);
    for (const seat of done.players) {
      const view = viewGame(done, seat.id);
      assert.equal(view.semutaReaction?.canCommit, seat.id === f.holder);
      if (seat.id !== f.holder) assert.deepEqual(view.semutaReaction?.candidates, []);
    }
    assert.throws(() => applyAction(done, f.actor, f.action), 'The resolving battle control cannot be replayed');
  });

  for (const fullHolder of [false, true]) {
    const holderLabel = fullHolder ? ' at the Richese hand limit' : '';

    void test(`${label}${holderLabel}: Richese claims one actual public losing card through Commit then Select`, () => {
      const f = createSemutaHomeworldLoserFixture(advanced, fullHolder);
      const done = disposeSemutaHomeworldLoser(f);
      const event = offerEvent(done);
      if (fullHolder)
        assert.equal(player(done, f.holder).hand.length, handLimit(player(done, f.holder)));

      const holderOffer = viewGame(done, f.holder).semutaReaction!;
      assert.equal(holderOffer.stage, 'offer');
      assert.equal(holderOffer.passed, false);
      assert.deepEqual(holderOffer.candidates, [], 'Commitment precedes any private card selection');
      const committed = applyAction(done, f.holder, { type: 'semutaCommit', event });
      const selection = committed.pendingTreacheryDiscard?.reaction;
      assert.equal(selection?.stage, 'select');
      assert.deepEqual([...selection!.candidates].sort(), [...f.cards].sort(),
        'The private choice is exactly the two public losing cards');
      assert.deepEqual(viewGame(committed, f.winner).semutaReaction?.candidates, []);
      assert.deepEqual(viewGame(committed, f.owner).semutaReaction?.candidates, []);
      const snapshot = JSON.stringify(committed);
      assert.throws(() => applyAction(committed, f.winner, { type: 'semutaSelect', event, card: f.cards[0] }));
      assert.throws(() => applyAction(committed, f.holder,
        { type: 'semutaSelect', event, card: f.winnerCards[0] }));
      assert.equal(JSON.stringify(committed), snapshot, 'An illegal selection changes nothing');

      const selected = claimLoser(f, done, f.cards[0]);
      assert.equal(selected.pendingTreacheryDiscard ?? null, null);
      assert.equal(player(selected, f.holder).hand.filter(c => c.id === f.cards[0]).length, 1);
      assert.equal(player(selected, f.holder).hand.some(c => c.id === f.cards[1]), false);
      assert.ok(selected.discard.some(c => c.id === f.cards[1]), 'The unselected card stays discarded');
      assert.ok(selected.discard.some(c => c.id === SEMUTA_DRUG_ID));
      assert.equal(player(selected, f.holder).hand.some(c => c.id === SEMUTA_DRUG_ID), false);
      if (fullHolder)
        assert.equal(player(selected, f.holder).hand.length, handLimit(player(selected, f.holder)));
      assertSettled(f, selected);
      const cleanup = cleanupDecision(selected);
      assert.equal(cleanup.player, f.winner);
      assert.deepEqual([...cleanup.cards].sort(), [...f.winnerCards].sort(),
        'Only the winner\'s own held played cards are at stake');

      const kept = applyAction(selected, f.winner, { type: 'decision', discard: [] });
      assert.ok(f.winnerCards.every(card => player(kept, f.winner).hand.some(c => c.id === card)),
        'Held played cards stay with the winner by default');
      assert.throws(() => applyAction(kept, f.winner, { type: 'decision', discard: [] }),
        'The original cleanup is consumed exactly once');
      const finished = finishSemutaHomeworldLoser(kept);
      assert.equal(finished.phase, 7);
      assert.equal(finished.turn, 1);
      assert.ok(!finished.phaseOpening && !finished.response && !finished.decision && !finished.pendingTreacheryDiscard);
      assert.equal(player(finished, f.holder).hand.filter(c => c.id === f.cards[0]).length, 1);
      assertSettled(f, finished);
      assert.equal(player(finished, f.winner).reserves, 16);
      assert.equal(player(finished, f.owner).tanks, 1);
      assert.equal(player(finished, f.owner).reserves, 19);
      assert.throws(() => applyAction(finished, f.holder, { type: 'semutaCommit', event }),
        'The resolved losing batch cannot be claimed twice');
      assert.throws(() => applyAction(finished, f.holder, { type: 'semutaSelect', event, card: f.cards[1] }));
      assert.throws(() => applyAction(finished, f.actor, f.action));
    });

    void test(`${label}${holderLabel}: passing conserves the printed Semuta and both public losing cards`, () => {
      const f = createSemutaHomeworldLoserFixture(advanced, fullHolder);
      const done = disposeSemutaHomeworldLoser(f);
      const event = offerEvent(done);
      const holderPassed = applyAction(done, f.holder, { type: 'semutaPass', event });
      assert.throws(() => applyAction(holderPassed, f.holder, { type: 'semutaPass', event }),
        'One seat answers this fresh discard exactly once');
      assert.throws(() => applyAction(done, f.holder, { type: 'semutaCommit', event: 'stale-discard' }));
      const declined = passLoser(done);
      assert.equal(declined.pendingTreacheryDiscard ?? null, null);
      assert.equal(player(declined, f.holder).hand.some(c => c.id === SEMUTA_DRUG_ID), true);
      assert.ok(f.cards.every(card => declined.discard.some(c => c.id === card)));
      assertSettled(f, declined);
      assert.deepEqual([...cleanupDecision(declined).cards].sort(), [...f.winnerCards].sort());
      const finished = finishSemutaHomeworldLoser(applyAction(declined, f.winner, { type: 'decision', discard: [] }));
      assert.equal(finished.phase, 7);
      assert.ok(f.cards.every(card => finished.discard.some(c => c.id === card)));
      assert.equal(player(finished, f.holder).hand.some(c => c.id === SEMUTA_DRUG_ID), true);
      assertSettled(f, finished);
      assert.throws(() => applyAction(finished, f.holder, { type: 'semutaPass', event }));
    });
  }

  void test(`${label}: the winner's held played cards are kept or discarded under its own original cleanup`, () => {
    const f = createSemutaHomeworldLoserFixture(advanced);
    const done = disposeSemutaHomeworldLoser(f);
    const mandatory = offerEvent(done);
    const selected = claimLoser(f, done, f.cards[1]);
    assert.equal(player(selected, f.holder).hand.filter(c => c.id === f.cards[1]).length, 1);
    assert.ok(selected.discard.some(c => c.id === f.cards[0]));
    const discarded = applyAction(selected, f.winner, { type: 'decision', discard: [f.winnerCards[0]] });
    assert.equal(player(discarded, f.winner).hand.some(c => c.id === f.winnerCards[0]), false);
    assert.ok(discarded.discard.some(c => c.id === f.winnerCards[0]));
    assert.ok(player(discarded, f.winner).hand.some(c => c.id === f.winnerCards[1]),
      'The unselected played card is retained');
    const winnerOffer = discarded.pendingTreacheryDiscard;
    assert.ok(winnerOffer, 'A discarded winner card opens its own fresh public offer');
    assert.notEqual(winnerOffer.batch.event, mandatory, 'Each public card batch has its own event');
    assert.deepEqual(winnerOffer.batch.entries.map(entry => [entry.card.id, entry.discardedBy]),
      [[f.winnerCards[0], f.winner]]);
    const resolved = passLoser(discarded);
    assert.equal(resolved.pendingTreacheryDiscard ?? null, null);
    const finished = finishSemutaHomeworldLoser(resolved);
    assert.equal(finished.phase, 7);
    assert.ok(finished.discard.some(c => c.id === f.winnerCards[0]));
    assert.ok(player(finished, f.winner).hand.some(c => c.id === f.winnerCards[1]));
    assertSettled(f, finished);
    assert.throws(() => applyAction(finished, f.holder,
      { type: 'semutaCommit', event: mandatory }));
  });

  void test(`${label}: every legal bot profile claims through the original controls to the same battlefield`, () => {
    const baseline = (() => {
      const f = createSemutaHomeworldLoserFixture(advanced);
      const selected = claimLoser(f, disposeSemutaHomeworldLoser(f), f.cards[0]);
      return { f, game: applyAction(selected, f.winner, { type: 'decision', discard: [] }) };
    })();
    for (const difficulty of DIFFICULTIES) {
      const f = createSemutaHomeworldLoserFixture(advanced);
      const done = disposeSemutaHomeworldLoser(f);
      const bidders = structuredClone(done);
      player(bidders, f.holder).bot = difficulty;
      const commit = botActions(viewGame(bidders, f.holder))[0];
      assert.ok(commit);
      assert.ok(commit.type === 'semutaCommit' || commit.type === 'semutaPass');
      let game = applyAction(bidders, f.holder, commit);
      if (game.pendingTreacheryDiscard) {
        const select = botActions(viewGame(game, f.holder))[0];
        assert.ok(select);
        assert.ok(select.type === 'semutaSelect' || select.type === 'semutaPass');
        game = applyAction(game, f.holder, select);
      }
      if (game.pendingTreacheryDiscard) game = passLoser(game);
      const cleanup = cleanupDecision(game);
      game = applyAction(game, cleanup.player, { type: 'decision', discard: [] });
      const finished = finishSemutaHomeworldLoser(game);
      assert.equal(finished.phase, 7);
      assertSettled(f, finished);
      assert.deepEqual(finished.players.map(seat => [seat.id, seat.forces, seat.tanks, seat.reserves]),
        baseline.game.players.map(seat => [seat.id, seat.forces, seat.tanks, seat.reserves]),
        `${difficulty} resolves the identical original casualties`);
    }
  });
}
