import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import type { TruthQuestion } from '../game/truthtrance';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import {
  createTruthtranceRichesePromisesFixture as fixture,
  actTruthtranceRichesePromises as act, askTruthtranceRichesePromises as ask,
  advanceTruthtranceRichesePromises as advance, finishTruthtranceRichesePromises as finish,
  truthtranceRichesePromisesClean as clean, truthtranceRichesePromisesPlayer as player,
  truthtranceRichesePromisesInventory as inventory, truthtranceRichesePromisesPhysical as physical,
  type TruthtranceRichesePromisesFixture as Fixture, type TruthtranceRichesePromisesStep as Step,
} from './fixture-truthtrance-richese-promises';

function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function source(f: Fixture) {
  assert.equal(f.initial.advanced, false); assert.equal(f.setup.status, 'setup'); assert.equal(f.setup.advanced, f.advanced);
  assert.deepEqual(f.rules.steps, f.advanced ? [{ actor: f.target, action: { type: 'rules', advanced: true } }] : []);
  assert.deepEqual(f.game.expansions, ['choam']); assert.equal(f.game.advanced, f.advanced);
  assert.equal(f.game.turn, 1); assert.equal(f.game.phase, 2); assert.ok(clean(f.game));
  assert.equal(f.game.auction ?? null, null); assert.equal(f.game.richeseAuction ?? null, null);
  assert.equal(f.game.richeseBidding ?? null, null); assert.equal(f.game.truthtrance ?? null, null);
  assert.ok(f.beforeStartingDeal.players.every(p => p.hand.length === 0));
  assert.deepEqual(f.beforeStartingDeal.deck.slice(0, 3).map(card => card.id), f.deal);
  assert.equal(f.beforeStartingDeal.deck[3].id, f.ordinaryLot);
  assert.deepEqual(f.afterSetup.players.flatMap(p => p.hand.map(card => card.id)), f.deal);
  assert.equal(player(f.game, f.asker).hand[0].id, f.truthtrance);
  assert.equal(player(f.game).spice, 5); assert.equal(player(f.game).reserves, 20); assert.equal(player(f.game).tanks, 0);
  assert.deepEqual(player(f.game).forces, {}); assert.equal(player(f.game).shipped, false); assert.equal(player(f.game).moved, 0);
  assert.deepEqual(player(f.game).noField, f.originalNoField); assert.equal(player(f.game).noField!.deployed, null);
  assert.equal(player(f.game).hand.some(card => ['karama', 'hajr'].includes(card.effect ?? '')), false);
  assert.equal(f.originalMainDeck.length, 35); assert.equal(f.originalCache.length, 10);
  assert.equal(f.originalInventory.length, 45); assert.deepEqual(inventory(f.game), f.originalInventory);
  assert.deepEqual(physical(f.game), f.originalPhysical); assert.equal(f.sourceActionCount, f.actions.length);
  assert.ok(f.actions.some(step => step.action.type === 'start'));
  assert.ok(f.actions.some(step => step.action.type === 'stormDial'));
}
function bound(f: Fixture, game = structuredClone(f.game), question: TruthQuestion = f.question) {
  const before = physical(game); game = ask(game, f, question);
  const view = viewGame(game, f.target);
  assert.ok((question.kind === 'shipment' ? view.truthShipmentAnswers : view.truthMovementAnswers)?.includes('yes'));
  game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' }); game = advance(game, clean);
  assert.deepEqual(physical(game), before); assert.equal(game.discard.filter(card => card.id === f.truthtrance).length, 1);
  return game;
}
function reachTurn(game: Game, actions: Step[] = []) {
  return advance(game, state => state.phase === 5 && state.active === 'richese' && clean(state), actions);
}
function ship(game: Game, f: Fixture, amount: number, actions: Step[] = []) {
  game = reachTurn(game, actions); const before = structuredClone(game);
  const action: Action = { type: 'ship', territory: 'carthag', sector: 11, amount, elite: 0, allyPayment: 0 };
  game = act(game, f.target, action, actions); game = advance(game, clean, actions);
  assert.equal(player(before).spice - player(game).spice, amount);
  assert.equal(player(before).reserves - player(game).reserves, amount);
  assert.equal(player(game).forces['carthag:11'], amount); assert.equal(player(game).shipped, true);
  assert.equal(game.shipmentPromises![0].fulfilled, true); assert.equal(game.shipmentPromises![0].released, undefined);
  assert.deepEqual(player(game).noField, f.originalNoField); assert.deepEqual(inventory(game), f.originalInventory);
  reject(game, f.target, action); return game;
}
function nativeBidding(actions: Step[], advanced: boolean) {
  assert.ok(actions.some(step => step.action.type === 'decision' && step.action.position === 'first'));
  assert.ok(actions.some(step => step.action.type === 'decision' && step.action.card === 'richese-stone-burner'));
  assert.ok(actions.some(step => step.action.type === 'richeseBid'));
  assert.ok(actions.some(step => step.action.type === 'passBid'));
  if (advanced) assert.ok(actions.some(step => step.action.type === 'decision' && step.action.decline === true));
}

for (const advanced of [false, true]) {
  const band = advanced ? 'Advanced' : 'Basic';
  void test(`native ${band} Richese early shipment pays five current spice after actual cache and normal auctions`, () => {
    const f = fixture({ advanced }); source(f); const actions: Step[] = [];
    let game = bound(f);
    assert.ok(viewGame(f.game, f.asker).truthShipmentTargets.includes(f.target));
    assert.equal(game.shipmentPromises![0].fulfilled, undefined); reject(game, f.target, f.shipmentAction);
    game = reachTurn(game, actions); nativeBidding(actions, advanced);
    assert.equal(player(game).spice, 5); assert.deepEqual(player(game).forces, {});
    assert.deepEqual(player(game).hand.map(card => card.id), [f.targetCard]);
    assert.ok(game.richeseRemoved?.some(card => card.id === f.cacheCard));
    const completion = viewGame(game, f.target).shipmentCompletion; assert.ok(completion);
    assert.ok(completion.actions.some(action => action.type === 'ship' && action.amount === 5 && action.territory === 'carthag'));
    reject(game, f.target, { type: 'endMovement' }); reject(game, f.target, { ...f.shipmentAction, amount: 4 });
    game = ship(game, f, 5, actions); assert.equal(player(game).spice, 0); assert.equal(player(game).reserves, 15);
    game = finish(game, actions); assert.equal(game.phase, 7); assert.deepEqual(inventory(game), f.originalInventory);
    assert.equal(actions.filter(step => step.actor === f.target && step.action.type === 'ship').length, 1);
  });

  void test(`native ${band} Richese early No forbids five but permits the actual four-counter city shipment`, () => {
    const f = fixture({ advanced }); let game = ask(structuredClone(f.game), f);
    assert.deepEqual(viewGame(game, f.target).truthShipmentAnswers, ['yes', 'no']);
    game = act(game, f.target, { type: 'truthAnswer', answer: 'no' }); game = reachTurn(game);
    reject(game, f.target, f.shipmentAction); game = ship(game, f, 4);
    assert.equal(player(game).spice, 1); assert.equal(game.shipmentPromises![0].answer, false);
  });

  void test(`native ${band} Richese current cash and physical stock cannot promise six while original Emperor can`, () => {
    const f = fixture({ advanced }); source(f);
    let game = ask(structuredClone(f.game), f, { kind: 'shipment', target: f.target, territory: 'carthag', minimum: 6 });
    assert.deepEqual(viewGame(game, f.target).truthShipmentAnswers, ['no']);
    reject(game, f.target, { type: 'truthAnswer', answer: 'yes' });
    game = act(game, f.target, { type: 'truthAnswer', answer: 'no' }); assert.deepEqual(inventory(game), f.originalInventory);
    const other = ask(structuredClone(f.game), f, { kind: 'shipment', target: f.observer, territory: 'carthag', minimum: 6 });
    assert.deepEqual(viewGame(other, f.observer).truthShipmentAnswers, ['yes', 'no']);
    assert.equal(player(other, f.observer).spice, 10); assert.equal(player(other).spice, 5);
  });

  void test(`native ${band} Richese Silent own invoice reserves one before a truthful four-counter shipment`, () => {
    const f = fixture({ advanced }), auction = { method: 'silent' as const }, actions: Step[] = [];
    let game = advance(f.game, state => state.phase === 3 && clean(state) &&
      state.richeseAuction?.method === 'silent' && !state.richeseAuction.outcome, actions, auction);
    const event = game.richeseAuction!.event, card = game.richeseAuction!.cardId;
    game = act(game, f.target, { type: 'richeseBid', event, amount: 1, allyPayment: 0 }, actions);
    assert.equal(player(game).spice, 5); assert.equal(game.richeseFunding?.[f.target].amount, 1);
    const unpaid = structuredClone(game);
    const impossible = ask(structuredClone(game), f);
    assert.deepEqual(viewGame(impossible, f.target).truthShipmentAnswers, ['no']);
    reject(impossible, f.target, { type: 'truthAnswer', answer: 'yes' });
    game = bound(f, game, { kind: 'shipment', target: f.target, territory: 'carthag', minimum: 4 });
    game = advance(game, state => state.phase === 4 && clean(state), actions, auction);
    assert.equal(player(game).spice, 4); assert.equal(player(game, f.observer).spice, player(unpaid, f.observer).spice + 1);
    assert.ok(player(game).hand.some(candidate => candidate.id === card)); assert.deepEqual(inventory(game), f.originalInventory);
    game = ship(game, f, 4, actions); assert.equal(player(game).spice, 0);
    reject(game, f.target, { type: 'richeseBid', event, amount: 1, allyPayment: 0 });
    assert.equal(actions.filter(step => step.actor === f.target && step.action.type === 'richeseBid' && step.action.amount === 1).length, 1);
  });

  void test(`native ${band} Richese ordinary standing invoice pays once and leaves four for the accepted city shipment`, () => {
    const f = fixture({ advanced }), actions: Step[] = [];
    let game = advance(f.game, state => state.phase === 3 && clean(state) && !!state.auction &&
      state.auction.active === f.target && state.auction.bid === 0, actions);
    const lot = game.auction!.cards[game.auction!.index].id; assert.equal(lot, f.ordinaryLot);
    game = act(game, f.target, f.normalBid, actions);
    assert.equal(player(game).spice, 5); assert.equal(game.auction!.bidder, f.target); assert.equal(game.auction!.bid, 1);
    const impossible = ask(structuredClone(game), f);
    assert.deepEqual(viewGame(impossible, f.target).truthShipmentAnswers, ['no']);
    game = bound(f, game, { kind: 'shipment', target: f.target, territory: 'carthag', minimum: 4 });
    game = advance(game, state => state.phase === 4 && clean(state), actions);
    assert.equal(player(game).spice, 4); assert.equal(player(game, f.observer).spice, 11);
    assert.ok(player(game).hand.some(card => card.id === lot)); assert.deepEqual(inventory(game), f.originalInventory);
    game = ship(game, f, 4, actions); assert.equal(player(game).spice, 0);
    assert.equal(game.discard.filter(card => card.id === f.truthtrance).length, 1);
    game = finish(game, actions); assert.equal(game.phase, 7); assert.equal(player(game, f.observer).spice, 11);
  });

  void test(`native ${band} Richese empty-board early movement earns a paid landing then the actual ground event`, () => {
    const f = fixture({ advanced, kind: 'movement' }); source(f); const actions: Step[] = [];
    let game = bound(f); assert.ok(viewGame(f.game, f.asker).truthMovementTargets.includes(f.target));
    assert.deepEqual(player(game).forces, {}); assert.equal(player(game).reserves, 20);
    reject(game, f.target, f.moveAction); game = reachTurn(game, actions); nativeBidding(actions, advanced);
    assert.equal(game.movementPromises![0].fulfilled, undefined); reject(game, f.target, { type: 'endMovement' });
    const offered = viewGame(game, f.target).movementPromisePolicy?.[0]; assert.ok(offered);
    assert.equal(offered.type, 'ship');
    // The native witness may prefer an original No-Field. This case takes the
    // independent ordinary physical route; profiles below keep their own guide.
    const shipment = f.shipmentAction;
    assert.equal(shipment.noField, undefined);
    const before = structuredClone(game);
    game = act(game, f.target, shipment, actions); game = advance(game, clean, actions);
    assert.equal(player(game).shipped, true); assert.equal(player(game).moved, 0);
    assert.ok(player(before).spice > player(game).spice); assert.ok(player(game).spice >= 0);
    assert.equal(player(before).reserves - player(game).reserves, shipment.amount);
    assert.equal(game.movementPromises![0].fulfilled, undefined, 'A reserve shipment is not the promised ground event');
    const movement = viewGame(game, f.target).movementPromisePolicy?.[0]; assert.ok(movement);
    assert.equal(movement.type, 'move'); assert.equal(movement.territory, 'carthag');
    const moved = movement.forces && typeof movement.forces === 'object'
      ? Object.values(movement.forces as Record<string, number>).reduce((total, amount) => total + amount, 0)
      : Number(movement.amount);
    assert.ok(moved >= 1);
    game = act(game, f.target, movement, actions); game = advance(game, clean, actions);
    assert.equal(game.movementPromises![0].fulfilled, true); assert.equal(game.movementPromises![0].released, undefined);
    assert.ok(player(game).forces['carthag:11'] >= 1); assert.deepEqual(player(game).noField, f.originalNoField);
    assert.deepEqual(inventory(game), f.originalInventory); reject(game, f.target, movement);
    game = finish(game, actions); assert.equal(game.phase, 7);
    assert.equal(actions.filter(step => step.actor === f.target && step.action.type === 'ship').length, 1);
    assert.equal(actions.filter(step => step.actor === f.target && step.action.type === 'move').length, 1);
  });
}

void test('native Richese early No on movement permits skipping and rejects the actual later matching ground route', () => {
  for (const advanced of [false, true]) {
    const f = fixture({ advanced, kind: 'movement' }); let game = ask(f.game, f);
    assert.deepEqual(viewGame(game, f.target).truthMovementAnswers, ['yes', 'no']);
    game = act(game, f.target, { type: 'truthAnswer', answer: 'no' }); game = reachTurn(game);
    game = act(game, f.target, f.shipmentAction); game = advance(game, clean);
    reject(game, f.target, f.moveAction);
    game = act(game, f.target, { type: 'endMovement' }); assert.equal(game.movementPromises![0].fulfilled, true);
    assert.deepEqual(inventory(game), f.originalInventory);
  }
});

void test('native Richese early questions retain actor, pending-answer and stale-action boundaries', () => {
  for (const advanced of [false, true]) for (const kind of ['shipment', 'movement'] as const) {
    const f = fixture({ advanced, kind }), game = ask(f.game, f);
    reject(game, f.observer, { type: 'truthAnswer', answer: 'yes' }); reject(game, f.asker, { type: 'truthAnswer', answer: 'yes' });
    reject(game, f.target, { type: 'ready' }); reject(game, f.target, f.action); reject(game, f.asker, f.askStep.action);
    const done = act(game, f.target, { type: 'truthAnswer', answer: 'yes' });
    reject(done, f.target, { type: 'truthAnswer', answer: 'yes' }); reject(done, f.asker, f.declarationStep.action);
    assert.deepEqual(physical(done), f.originalPhysical); assert.deepEqual(inventory(done), f.originalInventory);
  }
});

void test('all four minimal profiles use the original Richese early answer, owned auction controls and actual completion', () => {
  for (const advanced of [false, true]) for (const kind of ['shipment', 'movement'] as const) {
    const f = fixture({ advanced, kind }), asked = ask(f.game, f), promised = bound(f);
    // Once Around skips its owner after every other seat passes. A separate
    // actual Silent lot supplies R's event-bound zero submission; it creates no
    // acquired cache card and is not the completion branch's auction prefix.
    const silent = advance(promised, state => state.phase === 3 && clean(state) &&
      state.richeseAuction?.method === 'silent' && !state.richeseAuction.outcome, [], { method: 'silent' });
    const expectedPass: Action = { type: 'richeseBid', event: silent.richeseAuction!.event, amount: 0, allyPayment: 0 };
    const prefix: Step[] = [], turn = reachTurn(promised, prefix);
    nativeBidding(prefix, advanced);
    assert.equal(player(turn).spice, 5); assert.deepEqual(player(turn).hand.map(card => card.id), [f.targetCard]);
    assert.ok(turn.richeseRemoved?.some(card => card.id === f.cacheCard));
    assert.ok(prefix.some(step => step.actor === f.target && step.action.type === 'decision' && step.action.keep === false));
    for (const difficulty of DIFFICULTIES) {
      const answering = viewGame(asked, f.target); answering.players.find(p => p.id === f.target)!.bot = difficulty;
      const answer = botActions(answering)[0]; assert.ok(answer); assert.equal(answer.type, 'truthAnswer');
      assert.doesNotThrow(() => act(asked, f.target, answer));
      const bidding = viewGame(silent, f.target);
      assert.deepEqual(kind === 'shipment' ? bidding.shipmentPromisePolicy : bidding.movementPromisePolicy, [expectedPass]);
      bidding.players.find(p => p.id === f.target)!.bot = difficulty;
      assert.deepEqual(botActions(bidding), [expectedPass]);
      const submitted = act(silent, f.target, expectedPass);
      assert.equal(submitted.richeseAuction!.sealed[f.target], 0); assert.equal(player(submitted).spice, 5);
      assert.deepEqual(physical(submitted), physical(silent)); assert.deepEqual(inventory(submitted), f.originalInventory);
      let game = structuredClone(turn), count = 0;
      const actions: Step[] = [];
      while (!(kind === 'shipment' ? game.shipmentPromises![0].fulfilled : game.movementPromises![0].fulfilled) && count++ < 12) {
        assert.equal(game.active, f.target); assert.ok(clean(game));
        const view = viewGame(game, f.target); view.players.find(p => p.id === f.target)!.bot = difficulty;
        const action = botActions(view)[0]; assert.ok(action, `The ${difficulty} profile needs the actual ${kind} completion`);
        game = act(game, f.target, action, actions); game = advance(game, clean, actions);
      }
      assert.ok(count < 12); assert.equal(kind === 'shipment' ? game.shipmentPromises![0].released : game.movementPromises![0].released, undefined);
      assert.ok(player(game).forces['carthag:11'] >= f.minimum);
      assert.deepEqual(inventory(game), f.originalInventory);
      assert.equal(actions.filter(step => step.actor === f.target && step.action.type === 'ship').length, 1);
      if (kind === 'movement') assert.equal(actions.filter(step => step.actor === f.target && step.action.type === 'move').length, 1);
    }
  }
});
