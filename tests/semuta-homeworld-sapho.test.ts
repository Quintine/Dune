import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, handLimit, normalizeAutomaticGame, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { nativeShipmentSources } from '../game/homeworld-options';
import { splitLocation } from '../game/board';
import { advanceSemutaHomeworldChoam, reactSemutaHomeworldChoam } from './fixture-semuta-homeworld-choam';
import { semutaEmperorPlayer as player } from './fixture-semuta-emperor-share';
import { semutaHomeworldChoamMovementResources as resources,
  withoutSemutaHomeworldChoamMovementHolder } from './fixture-semuta-homeworld-choam-movement';
import { biddingPhysicalIds as stock } from './fixture-homeworld-occupied-bidding';
import {
  createSemutaHomeworldSaphoFixture, disposeSemutaHomeworldSapho,
  finishSemutaHomeworldSaphoAuction, finishSemutaHomeworldSaphoMovement,
  type SemutaHomeworldSaphoFixture, type SemutaHomeworldSaphoMode, type SemutaHomeworldSaphoScope,
} from './fixture-semuta-homeworld-sapho';
import type { RicheseSkillsTechStep } from './fixture-richese-skills-tech';

const scopes: SemutaHomeworldSaphoScope[] = ['onceAround', 'movement'];
const modes: SemutaHomeworldSaphoMode[] = ['first', 'last'];

/** Assert the original consumer opportunities/payment, not receipt wiring. */
function finishOriginal(state: Game, f: SemutaHomeworldSaphoFixture) {
  const actions: RicheseSkillsTechStep[] = [];
  if (f.scope === 'onceAround') {
    const lot = f.game.richeseAuction!, buyer = lot.bidder!;
    const funding = viewGame(f.game, buyer).richeseAuction!;
    assert.equal(lot.bid, 1);
    assert.deepEqual(state.richeseAuction!.acted, f.prefix);
    assert.equal(state.richeseAuction!.bidder, buyer);
    assert.equal(state.richeseAuction!.bid, lot.bid);
    assert.equal(viewGame(state, buyer).richeseAuction!.ownAvailable, funding.ownAvailable);
    assert.equal(viewGame(state, buyer).richeseAuction!.ownAllyPayment, funding.ownAllyPayment);
    assert.throws(() => applyAction(state, buyer,
      { type: 'richeseBid', event: f.event, amount: 2, allyPayment: 0 }),
    'The earlier bidder never receives a second opportunity');
    const done = finishSemutaHomeworldSaphoAuction(state, f, actions);
    const expected = f.suffix.filter(id => player(state, id).hand.length < handLimit(player(state, id)));
    assert.deepEqual(actions.map(step => step.actor), expected);
    assert.equal(new Set([...f.prefix, ...actions.map(step => step.actor)]).size,
      f.prefix.length + actions.length);
    assert.equal(player(done, buyer).hand.filter(card => card.id === f.lotCard).length, 1);
    assert.equal(player(done, buyer).spice, player(f.game, buyer).spice - 1);
    assert.equal(player(done, f.holder).spice, player(f.game, f.holder).spice + 1,
      'Original unoccupied Richese receives exactly the native cache-lot invoice');
    for (const seat of done.players.filter(seat => ![buyer, f.holder].includes(seat.id)))
      assert.equal(seat.spice, player(f.game, seat.id).spice);
    assert.deepEqual(done.homeworlds?.custody, f.setup.homeworlds?.custody);
    assert.deepEqual(stock(done), stock(f.game));
    assert.throws(() => applyAction(done, buyer,
      { type: 'richeseBid', event: f.event, amount: 2, allyPayment: 0 }));
    return done;
  }
  const result = finishSemutaHomeworldSaphoMovement(state, f, actions), done = result.game;
  assert.deepEqual(actions.filter(step => step.action.type === 'endMovement').map(step => step.actor), f.suffix,
    'Every original combined turn finishes exactly once in the reordered public queue');
  assert.equal(player(result.afterShipment, f.nextActor).spice,
    player(result.beforeShipment, f.nextActor).spice - 2);
  assert.equal(player(result.afterShipment, f.nextActor).reserves,
    player(result.beforeShipment, f.nextActor).reserves - 1);
  assert.equal(player(result.afterShipment, f.nextActor).forces[result.origin], 1);
  assert.equal(player(done, f.nextActor).forces[result.origin] ?? 0, 0);
  assert.equal(player(done, f.nextActor).forces[result.destination], 1);
  assert.equal(player(done, f.nextActor).moved, 1);
  assert.equal(done.turn, 1);
  assert.equal(done.phase, 7);
  assert.deepEqual(done.homeworlds?.custody, f.setup.homeworlds?.custody);
  assert.deepEqual(stock(done), stock(f.game));
  assert.throws(() => applyAction(done, f.nextActor, result.shipment));
  assert.throws(() => applyAction(done, f.nextActor, result.move));
  return done;
}

for (const advanced of [false, true]) for (const scope of scopes) for (const mode of modes) {
  const label = `${advanced ? 'Advanced' : 'Basic'} original Homeworld Sapho ${scope} ${mode}`;
  for (const claim of [false, true]) void test(`${label}: Semuta ${claim ? 'claim' : 'pass'} retains reordered unacted opportunities and original funded continuation`, () => {
    const f = createSemutaHomeworldSaphoFixture(scope, mode, advanced);
    const original = stock(f.game), paid = resources(f.game);
    const offered = disposeSemutaHomeworldSapho(f);
    assert.equal(viewGame(offered, f.holder).semutaReaction?.canCommit, true);
    assert.equal(player(offered, f.owner).hand.some(card => card.id === f.card), false);
    assert.equal(offered.discard.filter(card => card.id === f.card).length, 1);
    assert.deepEqual(stock(offered), original);
    assert.deepEqual(resources(offered), paid, 'Sapho and its disposal cannot spend the paid prefix or start a turn');
    assert.deepEqual(offered.order, f.game.order, 'Physical storm order is never rewritten');
    assert.deepEqual(normalizeAutomaticGame(structuredClone(offered)), offered);
    if (scope === 'onceAround') {
      assert.deepEqual(offered.richeseAuction!.order.filter(id => !offered.richeseAuction!.acted.includes(id)), f.suffix);
      assert.deepEqual(offered.richeseAuction!.acted, f.prefix);
      assert.deepEqual(offered.richeseAuction!.tieOrder, f.game.richeseAuction!.tieOrder);
      assert.equal(viewGame(offered, 'a').richeseAuction!.card!.id, f.lotCard,
        'Atreides retains the real public cache card knowledge');
      assert.throws(() => applyAction(offered, f.nextActor,
        { type: 'richeseBid', event: f.event, amount: null, allyPayment: 0 }));
    } else {
      assert.deepEqual(offered.movementRemaining, f.suffix);
      assert.equal(offered.active, f.game.active, 'The original unstarted turn stays frozen until disposal resolves');
      assert.ok(offered.players.every(seat => !seat.shipped && seat.moved === 0));
      assert.throws(() => applyAction(offered, f.game.active!, { type: 'endMovement' }));
    }
    const event = offered.pendingTreacheryDiscard!.batch.event;
    const resumed = reactSemutaHomeworldChoam(structuredClone(offered), f.holder, claim);
    assert.equal(resumed.pendingTreacheryDiscard, null);
    assert.equal(resumed.active, f.nextActor);
    assert.deepEqual(resources(resumed), paid);
    assert.deepEqual(stock(resumed), original);
    assert.equal(player(resumed, f.holder).hand.filter(card => card.id === f.card).length, claim ? 1 : 0);
    assert.equal(resumed.discard.filter(card => card.id === f.card).length, claim ? 0 : 1);
    assert.equal(resumed.discard.filter(card => card.id === SEMUTA_DRUG_ID).length, claim ? 1 : 0);
    assert.throws(() => applyAction(resumed, f.holder, { type: 'semutaCommit', event }));
    assert.throws(() => applyAction(resumed, f.owner, f.action), 'The same physical Sapho cannot be spent twice');
    const done = finishOriginal(resumed, f);
    assert.deepEqual(done.order, f.game.order);
  });

  void test(`${label}: original full-hand singleton exchange and private entitlement`, () => {
    const f = createSemutaHomeworldSaphoFixture(scope, mode, advanced, true);
    const absent = withoutSemutaHomeworldChoamMovementHolder(f.game, f.holder);
    assert.equal(player(f.game, f.holder).hand.length, handLimit(player(f.game, f.holder)));
    const offered = disposeSemutaHomeworldSapho(f);
    const neutral = disposeSemutaHomeworldSapho(f, absent);
    assert.equal(viewGame(offered, f.holder).semutaReaction?.canCommit, true);
    assert.equal(viewGame(neutral, f.holder).semutaReaction?.canCommit, false);
    assert.throws(() => applyAction(neutral, f.holder,
      { type: 'semutaCommit', event: neutral.pendingTreacheryDiscard!.batch.event }));
    for (const seat of offered.players.filter(seat => seat.id !== f.holder)) {
      assert.deepEqual(viewGame(offered, seat.id), viewGame(neutral, seat.id));
      assert.equal(viewGame(offered, seat.id).semutaReaction?.canCommit, false);
      assert.throws(() => applyAction(offered, seat.id,
        { type: 'semutaCommit', event: offered.pendingTreacheryDiscard!.batch.event }));
    }
    const claimed = reactSemutaHomeworldChoam(offered, f.holder, true);
    assert.equal(player(claimed, f.holder).hand.length, handLimit(player(claimed, f.holder)));
    assert.equal(player(claimed, f.holder).hand.some(card => card.id === f.card), true);
    assert.equal(player(claimed, f.holder).hand.some(card => card.id === SEMUTA_DRUG_ID), false);
    finishOriginal(claimed, f);
  });

  void test(`${label}: every minimal bot profile legally claims or passes before the native continuation`, () => {
    const f = createSemutaHomeworldSaphoFixture(scope, mode, advanced);
    const offered = disposeSemutaHomeworldSapho(f);
    for (const difficulty of DIFFICULTIES) {
      let game = structuredClone(offered);
      const own = viewGame(game, f.holder);
      own.players.find(seat => seat.id === f.holder)!.bot = difficulty;
      const proposal = botActions(own)[0];
      assert.ok(proposal);
      assert.ok(['semutaCommit', 'semutaPass'].includes(proposal.type));
      game = applyAction(game, f.holder, proposal);
      while (game.pendingTreacheryDiscard?.reaction?.stage === 'offer') {
        const pending = game.pendingTreacheryDiscard, reaction = pending.reaction;
        if (reaction?.stage !== 'offer') throw Error('Missing Semuta offer');
        const actor = game.players.find(seat => !reaction.passed.includes(seat.id))!.id;
        game = applyAction(game, actor, { type: 'semutaPass', event: pending.batch.event });
      }
      assert.equal(game.pendingTreacheryDiscard, null);
      assert.equal(player(game, f.holder).hand.some(card => card.id === f.card), proposal.type === 'semutaCommit');
      const nextView = viewGame(game, f.nextActor);
      nextView.players.find(seat => seat.id === f.nextActor)!.bot = difficulty;
      const nextAction = botActions(nextView)[0];
      assert.ok(nextAction, 'The resumed original actor has a real legal bot continuation');
      const botContinued = applyAction(structuredClone(game), f.nextActor, nextAction);
      assert.deepEqual(stock(botContinued), stock(game));
      finishOriginal(game, f);
    }
  });

  void test(`${label}: stale source events and altered committed queue reject without card/resource loss`, () => {
    const f = createSemutaHomeworldSaphoFixture(scope, mode, advanced);
    const before = structuredClone(f.game);
    assert.throws(() => applyAction(f.game, f.owner, { ...f.action, event: 'expired' }));
    assert.deepEqual(f.game, before);
    const offered = disposeSemutaHomeworldSapho(f), tampered = structuredClone(offered);
    if (scope === 'onceAround') tampered.richeseAuction!.order.reverse();
    else tampered.movementRemaining!.reverse();
    const saved = structuredClone(tampered);
    assert.throws(() => applyAction(tampered, f.holder,
      { type: 'semutaCommit', event: tampered.pendingTreacheryDiscard!.batch.event }));
    assert.deepEqual(tampered, saved);
    const passed = applyAction(offered, f.holder,
      { type: 'semutaPass', event: offered.pendingTreacheryDiscard!.batch.event });
    assert.throws(() => applyAction(passed, f.holder,
      { type: 'semutaCommit', event: offered.pendingTreacheryDiscard!.batch.event }));
  });
}

for (const advanced of [false, true]) for (const mode of modes) void test(
  `${advanced ? 'Advanced' : 'Basic'} Homeworld Sapho ${mode}: paid shipment expires the old unstarted quote and new tail options preserve the current turn`, () => {
    const f = createSemutaHomeworldSaphoFixture('movement', mode, advanced);
    const origin = 'red_chasm:7';
    const actor = f.game.active!;
    const sources = nativeShipmentSources(viewGame(f.game, actor), 1, 0);
    assert.ok(sources);
    let started = applyAction(f.game, actor, { type: 'ship', ...splitLocation(origin), amount: 1, elite: 0,
      homeworldSources: sources, allyPayment: 0 });
    started = advanceSemutaHomeworldChoam(started,
      game => !game.response && !game.decision && !game.pendingTreacheryDiscard && !game.phaseOpening);
    assert.equal(player(started, actor).shipped, true);
    const paid = resources(started), original = stock(started);
    const options = viewGame(started, f.owner).saphoOptions.filter(option => option.scope === 'movement');
    assert.ok(options.length > 0, 'The unstarted holder can reorder later unstarted combined turns');
    assert.ok(options.every(option => option.scope === 'movement' && option.afterCurrent === actor));
    assert.ok(options.every(option => option.event !== f.action.event),
      'Queued tail options have a new source; the original unstarted quote expires');
    const queue = [...started.movementRemaining!];
    assert.equal(started.active, actor);
    assert.throws(() => applyAction(started, f.owner, f.action));
    assert.equal(started.active, actor);
    assert.deepEqual(started.movementRemaining, queue);
    assert.deepEqual(resources(started), paid);
    assert.deepEqual(stock(started), original);
    assert.equal(player(started, f.owner).hand.some(card => card.id === f.card), true);
  },
);
