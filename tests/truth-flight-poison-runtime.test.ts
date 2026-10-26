import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { gameDistance, location, splitLocation } from '../game/board';
import { treacheryDeck } from '../game/cards';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { printedCardPlayCount } from '../game/printed-card-play';
import { richeseCards } from '../game/richese-cards';
import { truthFactAnswer, type TruthQuestion } from '../game/truthtrance';
import {
  actTruthFlightPoison as act, advanceTruthFlightPoison as advance, answerTruthFlightPoison as answer,
  askTruthFlightPoison as ask, bindTruthFlightPoison as bind, closeTruthFlightPoisonPreparation as closePreparation,
  createTruthFlightPoisonFixture as fixture, declareTruthFlightPoison as declare,
  finishTruthFlightPoison as finish, finishTruthFlightPoisonBattle as finishBattle,
  nextTruthFlightPoisonNative as nativeStep, settleTruthFlightPoison as settle,
  truthFlightPoisonAction as poison, truthFlightPoisonClean as clean,
  truthFlightPoisonFact as fact, truthFlightPoisonGroup as group, truthFlightPoisonInventory as inventory,
  truthFlightPoisonMove as move, truthFlightPoisonPayment as payment, truthFlightPoisonPlayer as player,
  truthFlightPoisonPromise as promise, truthFlightPoisonSpice as spice,
  truthFlightPoisonTraitors as traitors, truthFlightPoisonUse as use,
  type TruthFlightPoisonExpression, type TruthFlightPoisonFixture, type TruthFlightPoisonStep,
} from './fixture-truth-flight-poison';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
function physical(game: Game, f: TruthFlightPoisonFixture) {
  assert.deepEqual(inventory(game), f.originalCards); assert.deepEqual(spice(game), f.originalSpice);
  assert.deepEqual(traitors(game), f.originalTraitors);
}
const raw = (f: TruthFlightPoisonFixture, mixed: TruthFlightPoisonExpression): TruthQuestion =>
  ({ kind: 'turnActions', target: f.target, turn: f.game.turn, mixed });
const stage = (game: Game, f: TruthFlightPoisonFixture, index = 0) => game.turnActionPromises![index].cardPlays?.[f.effect];
const count = (game: Game, f: TruthFlightPoisonFixture) => printedCardPlayCount(game.printedCardPlays, f.target, game.turn, f.effect);
const pay = (game: Game, f: TruthFlightPoisonFixture, amount: number, actions: TruthFlightPoisonStep[] = []) =>
  act(game, f.target, { type: 'bribe', target: f.recipient, amount }, actions);
const resources = (game: Game) => game.players.map(candidate => ({ id: candidate.id, spice: candidate.spice,
  forces: structuredClone(candidate.forces), reserves: candidate.reserves, tanks: candidate.tanks,
  elites: structuredClone(candidate.elites), moved: candidate.moved, shipped: candidate.shipped }));

void test('flight and Poison sources earn native cache1 cards, real original forces and unopened Truths in both modes', () => {
  for (const effect of ['ornithopter', 'residualPoison'] as const) for (const advanced of [false, true]) {
    const f = fixture({ effect, advanced }); assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
    assert.ok(f.beforeStartingDeal.players.every(candidate => candidate.hand.length === 0));
    assert.deepEqual(f.originalCards, [...treacheryDeck(['choam']), ...richeseCards()].map(card => card.id).sort());
    assert.equal(f.sourceActionCount, f.actions.length); assert.equal(f.sourceCounts.selected, f.actions.length);
    assert.equal(f.sourceCounts.nativeCacheBids, 1); assert.equal(f.sourceCounts.acquisition, f.acquisition.steps.length);
    assert.equal(f.sourceCounts.shipment, f.shipment.steps.length); assert.equal(!!f.game.semutaPreview, !advanced);
    assert.ok(!f.game.nexusCards && !f.game.homeworlds && !f.game.leaderSkills && !f.game.techTokens && !f.game.strongholdCards);
    assert.equal(player(f.acquisition.before, f.target).spice - player(f.acquisition.after, f.target).spice, 1);
    for (const [index, truth] of f.truths.entries()) assert.ok(player(f.game, f.truthHolders[index]).hand.some(card => card.id === truth));
    assert.equal(count(f.game, f), 0); assert.equal(f.game.turnActionPromises?.length ?? 0, 0);
    if (effect === 'ornithopter') {
      assert.equal(player(f.game, f.target).spice, 5); assert.equal(player(f.game, f.target).forces['imperial_basin:9'], 2);
      assert.equal(player(f.game, f.target).elites?.forces['imperial_basin:9'] ?? 0, 0); assert.equal(player(f.game, f.target).moved, 0);
    } else {
      assert.equal(player(f.game, f.target).spice, 9); assert.equal(player(f.game, f.asker).forces['arrakeen:10'], 1);
      assert.equal(player(f.game, f.target).forces['arrakeen:10'], 10); assert.equal(f.game.battle!.preLeader!.closed, false);
      assert.deepEqual(f.game.battle!.plans, {}); assert.ok(viewGame(f.game, f.target).residualPoison && !viewGame(f.game, f.target).residualPoison!.blocked);
    }
    physical(f.game, f);
  }
});

void test('Basic flight AND frozen fact and all five paid counts the first declaration before disposal with no required second group', () => {
  const f = fixture(), mixed = group('and', fact(f.spiceFact), use(f.effect), payment(f.recipient, 5));
  let game = settle(bind(f, 'yes', raw(f, mixed)).game); game = pay(game, f, 5);
  assert.equal(player(game, f.target).spice, 0); assert.equal(truthFactAnswer(player(game, f.target), f.spiceFact), 'no');
  game = settle(act(game, f.target, move(game, f, 'twoGroups')));
  assert.equal(count(game, f), 1); assert.equal(stage(game, f)?.played, true); assert.equal(promise(game).fulfilled, true);
  assert.equal(game.ornithopter?.completed, 1); assert.equal(game.ornithopter?.card.id, f.card);
  assert.equal(game.discard.filter(card => card.id === f.card).length, 0); physical(game, f);
  game = settle(act(game, f.target, f.end));
  assert.equal(game.ornithopter, null); assert.equal(player(game, f.target).moved, 1);
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1); assert.equal(count(game, f), 1);
  assert.equal(stage(game, f)?.played, true); assert.deepEqual(promise(game).mixed, mixed); physical(game, f);
});

void test('range-three and both distinct two-group routes are actual native flights and count only one printed use', () => {
  for (const advanced of [false, true]) for (const mode of ['range3', 'twoGroups'] as const) {
    const f = fixture({ advanced }); let game = settle(bind(f, 'yes', raw(f, use(f.effect))).game);
    const first = move(game, f, mode), destination = location(String(first.territory), Number(first.sector));
    assert.equal(gameDistance(game, f.origin!, destination, key => splitLocation(key).sector === game.storm), mode === 'range3' ? 3 : 1);
    game = settle(act(game, f.target, first)); assert.equal(count(game, f), 1); assert.equal(promise(game).fulfilled, true);
    if (mode === 'twoGroups') {
      assert.equal(game.ornithopter?.completed, 1);
      const second = move(game, f); assert.equal(second.ornithopterEvent, game.ornithopter!.event); assert.equal(second.movementCard, undefined);
      assert.equal(second.from, f.origin); game = settle(act(game, f.target, second));
      assert.equal(player(game, f.target).moved, 2);
    } else assert.equal(player(game, f.target).moved, 1);
    assert.equal(game.ornithopter, null); assert.equal(game.discard.filter(card => card.id === f.card).length, 1);
    assert.equal(count(game, f), 1); physical(game, f);
  }
});

void test('a positive flight answer prevents own ordinary-move or early-end evasion while OR can end and pay later', () => {
  const f = fixture({ advanced: true }); let game = settle(bind(f, 'yes', raw(f, use(f.effect))).game);
  rejected(game, f.target, f.end); rejected(game, f.target, move(game, f)); assert.equal(count(game, f), 0);
  const guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide); assert.equal(guide.action.type, 'move');
  assert.equal(guide.action.movementCard, f.card); game = settle(act(game, f.target, guide.action)); assert.equal(promise(game).fulfilled, true);
  let alternate = settle(bind(f, 'yes', raw(f, group('or', use(f.effect), payment(f.recipient)))).game);
  alternate = settle(act(alternate, f.target, f.end)); assert.equal(stage(alternate, f)?.played, false); assert.equal(stage(alternate, f)?.closed, true);
  alternate = advance(alternate, state => state.phase === 8 && clean(state)); alternate = pay(alternate, f, 2);
  assert.equal(promise(alternate).fulfilled, true); assert.ok(player(alternate, f.target).hand.some(card => card.id === f.card));
  physical(game, f); physical(alternate, f);
});

void test('an active flight gives no new-interval credit and its second group or later disposal does not count again', () => {
  const f = fixture({ advanced: true }); let game = settle(act(f.game, f.target, move(f.game, f, 'twoGroups')));
  assert.equal(count(game, f), 1); assert.equal(game.ornithopter?.completed, 1);
  const event = game.ornithopter!.event, declared = declare(f, game), asked = ask(declared.game, declared.asker, raw(f, use(f.effect)));
  assert.deepEqual(viewGame(asked, f.target).truthTurnActionAnswers, ['no']); rejected(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
  game = settle(answer(asked, f.target, 'no')); assert.equal(stage(game, f)?.played, false); assert.equal(game.ornithopter!.event, event);
  game = settle(act(game, f.target, move(game, f))); assert.equal(count(game, f), 1); assert.equal(stage(game, f)?.played, false);
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1); game = settle(act(game, f.target, f.end));
  assert.equal(promise(game).fulfilled, true); assert.equal(count(game, f), 1); physical(game, f);
});

void test('flight whole No AND permits one branch and No OR keeps its payment cap after own movement closes', () => {
  const f = fixture({ advanced: true }), packet = move(f.game, f, 'range3');
  let played = settle(bind(f, 'no').game); played = settle(act(played, f.target, packet)); played = pay(played, f, 1);
  rejected(played, f.target, { type: 'bribe', target: f.recipient, amount: 1 }); assert.equal(count(played, f), 1);
  let paid = settle(bind(f, 'no').game); paid = pay(paid, f, 2); rejected(paid, f.target, packet); assert.equal(count(paid, f), 0);
  let neither = settle(bind(f, 'no', raw(f, group('or', use(f.effect), payment(f.recipient)))).game);
  rejected(neither, f.target, packet); neither = pay(neither, f, 1); neither = settle(act(neither, f.target, f.end));
  assert.equal(stage(neither, f)?.closed, true); neither = advance(neither, state => state.phase === 8 && clean(state));
  rejected(neither, f.target, { type: 'bribe', target: f.recipient, amount: 1 }); assert.ok(!promise(neither).released);
  neither = finish(neither); assert.equal(promise(neither).fulfilled, true);
  physical(played, f); physical(paid, f); physical(neither, f);
});

void test('Residual AND frozen fact and all nine paid kills one actual native leader for no fee or bounty before disposal continuation', () => {
  for (const advanced of [false, true]) {
    const f = fixture({ effect: 'residualPoison', advanced }), mixed = group('and', fact(f.spiceFact), use(f.effect), payment(f.recipient, 9));
    let game = settle(bind(f, 'yes', raw(f, mixed)).game); const before = resources(game), leaders = structuredClone(player(game, f.asker).leaders);
    const packet = poison(game, f); assert.equal('leader' in packet, false); game = act(game, f.target, packet);
    const victims = player(game, f.asker).leaders.filter(leader => leader.dead && !leaders.find(original => original.id === leader.id)!.dead);
    assert.equal(victims.length, 1); assert.equal(victims[0].deaths, leaders.find(original => original.id === victims[0].id)!.deaths + 1);
    assert.deepEqual(resources(game), before); assert.equal(count(game, f), 1); assert.equal(stage(game, f)?.played, true);
    assert.equal(game.discard.filter(card => card.id === f.card).length, 1); assert.deepEqual(game.battle!.plans, {});
    if (!advanced) assert.ok(game.pendingTreacheryDiscard);
    game = settle(game); game = pay(game, f, 9); assert.equal(player(game, f.target).spice, 0);
    assert.equal(truthFactAnswer(player(game, f.target), f.spiceFact), 'no'); assert.equal(promise(game).fulfilled, true);
    const completed = finishBattle(f, game); game = completed.game;
    assert.equal(stage(game, f)?.played, true); assert.equal(count(game, f), 1); assert.equal(promise(game).fulfilled, true);
    assert.equal(player(game, f.asker).leaders.find(leader => leader.id === victims[0].id)!.dead, true); physical(game, f);
  }
});

void test('Residual completion quotes neither sample a random victim nor create hypothetical Tanks or bounty funding', t => {
  const f = fixture({ effect: 'residualPoison' }), declared = declare(f), before = structuredClone(declared.game);
  let rng = 0; const mock = t.mock.method(crypto, 'getRandomValues', () => { rng++; throw Error('A future-role quote must not choose a victim'); });
  const funded = applyAction(declared.game, declared.asker, { type: 'truthAsk', question: raw(f, group('and', use(f.effect), payment(f.recipient, 9))) });
  assert.deepEqual(viewGame(funded, f.target).truthTurnActionAnswers, ['yes', 'no']);
  const unfunded = applyAction(declared.game, declared.asker, { type: 'truthAsk', question: raw(f, group('and', use(f.effect), payment(f.recipient, 10))) });
  assert.deepEqual(viewGame(unfunded, f.target).truthTurnActionAnswers, ['no']); assert.equal(rng, 0); mock.mock.restore();
  assert.deepEqual(declared.game, before); assert.deepEqual(funded.players, before.players); assert.deepEqual(unfunded.players, before.players);
  assert.equal(player(funded, f.asker).leaders.filter(leader => leader.dead).length, 0); assert.equal(count(funded, f), 0); physical(funded, f);
});

void test('Residual Yes rejects own first leader commitment while a real foreign first plan releases the unfulfilled known-window condition', () => {
  const f = fixture({ effect: 'residualPoison', advanced: true });
  let bound = settle(bind(f, 'yes', raw(f, group('and', use(f.effect), payment(f.recipient)))).game); bound = pay(bound, f, 2);
  bound = closePreparation(bound); const packet = poison(bound, f);
  const ownLeader = player(bound, f.target).leaders.find(leader => !leader.dead && !leader.usedAt)!;
  rejected(bound, f.target, { type: 'battlePlan', dial: 0, support: 0, leader: ownLeader.id });
  assert.equal(stage(bound, f)?.played, false); assert.ok(!promise(bound).released);
  const enemyLeader = player(bound, f.asker).leaders.find(leader => !leader.dead && !leader.usedAt)!;
  const foreign = act(bound, f.asker, { type: 'battlePlan', dial: 0, support: 0, leader: enemyLeader.id });
  assert.equal(promise(foreign).released, true); assert.equal(stage(foreign, f)?.played, false);
  assert.equal(foreign.turnActionPromises![0].payments[0].amount, 2); assert.ok(player(foreign, f.target).hand.some(card => card.id === f.card));
  rejected(foreign, f.target, packet); assert.equal(player(foreign, f.asker).leaders.filter(leader => leader.dead).length, 0); physical(foreign, f);
});

void test('Residual whole OR supports actual manual printed use or payment followed by native battle cleanup with the card unused', () => {
  const f = fixture({ effect: 'residualPoison', advanced: true }), question = raw(f, group('or', use(f.effect), payment(f.recipient)));
  const bound = settle(bind(f, 'yes', question).game);
  const played = settle(act(bound, f.target, poison(bound, f))); assert.equal(promise(played).fulfilled, true);
  assert.equal(player(played, f.target).spice, 9); assert.equal(player(played, f.recipient).bribes, 0);
  let paid = pay(bound, f, 2); paid = finishBattle(f, paid).game;
  assert.equal(promise(paid).fulfilled, true); assert.equal(stage(paid, f)?.played, false);
  assert.ok(player(paid, f.target).hand.some(card => card.id === f.card)); assert.equal(player(paid, f.asker).leaders.filter(leader => leader.dead).length, 0);
  physical(played, f); physical(paid, f);
});

void test('Residual whole No caps payments and blocks the forbidden random effect before any victim is sampled', t => {
  const f = fixture({ effect: 'residualPoison', advanced: true }), originalPacket = poison(f.game, f);
  let played = settle(bind(f, 'no').game); played = settle(act(played, f.target, originalPacket)); played = pay(played, f, 1);
  rejected(played, f.target, { type: 'bribe', target: f.recipient, amount: 1 }); assert.equal(count(played, f), 1);
  let paid = settle(bind(f, 'no').game); paid = pay(paid, f, 2);
  let neither = settle(bind(f, 'no', raw(f, group('or', use(f.effect), payment(f.recipient)))).game);
  for (const game of [paid, neither]) {
    const before = structuredClone(game); let rng = 0;
    const mock = t.mock.method(crypto, 'getRandomValues', () => { rng++; throw Error('No must reject before random victim selection'); });
    assert.throws(() => applyAction(game, f.target, originalPacket)); assert.equal(rng, 0); mock.mock.restore(); assert.deepEqual(game, before);
    assert.equal(count(game, f), 0); assert.equal(player(game, f.asker).leaders.filter(leader => leader.dead).length, 0);
  }
  neither = pay(neither, f, 1); neither = finishBattle(f, neither).game;
  neither = advance(neither, state => state.phase === 8 && clean(state)); rejected(neither, f.target, { type: 'bribe', target: f.recipient, amount: 1 });
  neither = finish(neither); assert.equal(promise(neither).fulfilled, true); assert.equal(stage(neither, f)?.played, false);
  physical(played, f); physical(paid, f); physical(neither, f);
});

void test('earlier Residual use is not a second original Truth future-play receipt and cannot create a new victim on disposal', () => {
  const f = fixture({ effect: 'residualPoison', advanced: true }); let game = settle(act(f.game, f.target, poison(f.game, f)));
  assert.equal(count(game, f), 1); const dead = player(game, f.asker).leaders.filter(leader => leader.dead).map(leader => leader.id);
  const declared = declare(f, game), asked = ask(declared.game, declared.asker, raw(f, use(f.effect)));
  assert.deepEqual(viewGame(asked, f.target).truthTurnActionAnswers, ['no']); rejected(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
  game = settle(answer(asked, f.target, 'no')); assert.equal(stage(game, f)?.played, false); assert.equal(count(game, f), 1);
  assert.deepEqual(player(game, f.asker).leaders.filter(leader => leader.dead).map(leader => leader.id), dead); physical(game, f);
});

void test('exact flight and Poison guides bind native packets through JSON and reject stale promise, source or forged victim fields', () => {
  for (const effect of ['ornithopter', 'residualPoison'] as const) {
    const f = fixture({ effect, advanced: true }); let game = settle(bind(f, 'yes', raw(f, use(f.effect))).game);
    const guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide); assert.equal(guide.event, promise(game).event);
    assert.equal(guide.action.turnActionPromiseEvent, promise(game).event); assert.equal(guide.action.turnActionPromisePhase, game.phase);
    rejected(game, f.asker, guide.action); rejected(game, f.target, { ...guide.action, turnActionPromiseEvent: 'stale-flight-poison-answer' });
    rejected(game, f.target, { ...guide.action, turnActionPromisePhase: 8 });
    if (effect === 'ornithopter') {
      assert.equal(guide.action.type, 'move'); assert.equal(guide.action.movementCard, f.card);
      assert.ok(guide.action.ornithopter === 'range3' || guide.action.ornithopter === 'twoGroups');
      rejected(game, f.target, { ...guide.action, ornithopterEvent: 'already-started-stale-flight' });
    } else {
      assert.equal(guide.action.type, 'card'); assert.equal(guide.action.card, f.card); assert.equal(guide.action.target, f.asker);
      assert.equal(guide.action.event, f.event); assert.equal('leader' in guide.action, false);
      rejected(game, f.target, { ...guide.action, event: 'stale-poison-battle' });
      rejected(game, f.target, { ...guide.action, leader: player(game, f.asker).leaders[0].id });
    }
    const packet: Action = JSON.parse(JSON.stringify(guide.action)); game = settle(act(game, f.target, packet));
    assert.equal(promise(game).fulfilled, true); assert.equal(stage(game, f)?.played, true); assert.equal(count(game, f), 1);
    rejected(game, f.target, packet); physical(game, f);
  }
});

void test('four minimal profiles consume exact guides for a human-bound Yes in both roles and modes without requiring strategic answer policy', () => {
  for (const effect of ['ornithopter', 'residualPoison'] as const) for (const advanced of [false, true]) {
    const f = fixture({ effect, advanced }), declared = declare(f), asked = ask(declared.game, declared.asker, f.question);
    for (const difficulty of DIFFICULTIES) {
      const answering = viewGame(asked, f.target); answering.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
      const proposed = botActions(answering).find(candidate => candidate.type === 'truthAnswer'); assert.ok(proposed);
      assert.ok(answering.truthTurnActionAnswers?.includes(proposed.answer as 'yes' | 'no' | 'unknown'));
      let game = answer(structuredClone(asked), f.target, 'yes'); const actions: TruthFlightPoisonStep[] = [];
      for (let step = 0; step < 100 && (!promise(game).fulfilled || !clean(game)); step++) {
        const view = viewGame(game, f.target); view.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
        if (view.turnActionGuide) {
          const guide = view.turnActionGuide, packet = botActions(view).find(candidate => candidate.turnActionPromiseEvent === guide.action.turnActionPromiseEvent);
          assert.ok(packet); assert.deepEqual(packet, guide.action); game = act(game, f.target, packet, actions);
        } else {
          const next = nativeStep(game); assert.ok(next); game = act(game, next.actor, next.action, actions);
        }
      }
      assert.equal(promise(game).fulfilled, true); assert.equal(count(game, f), 1); assert.equal(player(game, f.recipient).bribes, 2);
      if (effect === 'ornithopter' && game.ornithopter) game = settle(act(game, f.target, f.end, actions), actions);
      assert.equal(game.discard.filter(card => card.id === f.card).length, 1); assert.equal(count(game, f), 1);
      assert.equal(player(game, f.target).spice, player(f.game, f.target).spice - 2); physical(game, f);
    }
  }
});
