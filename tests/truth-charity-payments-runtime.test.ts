import assert from 'node:assert/strict';
import test from 'node:test';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { charityQuote } from '../game/charity';
import { spiceDeck, treacheryDeck } from '../game/cards';
import { viewGame, type Action, type Game } from '../game/engine';
import { CHEAP_HERO_TRAITOR, traitorDeck } from '../game/traitors';
import { truthFactAnswer, type TruthQuestion } from '../game/truthtrance';
import {
  actTruthCharityPayments as act, advanceTruthCharityPayments as advance, answerTruthCharityPayments as answer,
  askTruthCharityPayments as ask, bindTruthCharityPayments as bind, createTruthCharityPaymentsFixture as fixture,
  declareTruthCharityPayments as declare, finishTruthCharityPayments as finish,
  nextTruthCharityPaymentsNative as nativeStep, reachTruthCharityPaymentsClaim as reachClaim,
  settleTruthCharityPayments as settle, truthCharityPaymentsClean as clean, truthCharityPaymentsFact as fact,
  truthCharityPaymentsGroup as group, truthCharityPaymentsInventory as inventory,
  truthCharityPaymentsPayment as payment, truthCharityPaymentsPlayer as player,
  truthCharityPaymentsPromise as promise, truthCharityPaymentsQuestion as question,
  truthCharityPaymentsShip as ship, truthCharityPaymentsSpice as spice, truthCharityPaymentsTraitors as traitors,
  type TruthCharityPaymentsFixture, type TruthCharityPaymentsKind, type TruthCharityPaymentsStep,
} from './fixture-truth-charity-payments';

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game); assert.throws(() => act(game, actor, action)); assert.deepEqual(game, before);
}
function physical(game: Game, f: TruthCharityPaymentsFixture, copies: 1 | 2 = 1) {
  for (const truth of f.truths.slice(0, copies)) assert.equal(game.discard.filter(card => card.id === truth).length, 1);
  assert.deepEqual(inventory(game), f.originalCards); assert.deepEqual(traitors(game), f.originalTraitors);
  assert.deepEqual(spice(game), f.originalSpice);
}
const pay = (game: Game, f: TruthCharityPaymentsFixture, amount: number, recipient = f.recipient,
  actions: TruthCharityPaymentsStep[] = []) => act(game, f.target, { type: 'bribe', target: recipient, amount }, actions);

void test('Charity installment sources preserve native Amal reductions, openings, original cards and an unused actual claim', () => {
  for (const source of ['amalOpening', 'afterAmal', 'thumper', 'phase2'] as const) {
    const f = fixture({ source }); assert.equal(f.initial.status, 'lobby'); assert.equal(f.setup.status, 'setup');
    assert.ok(f.setup.players.every(candidate => candidate.hand.length === 0));
    assert.deepEqual(f.originalCards, treacheryDeck(['ix']).map(card => card.id).sort());
    assert.deepEqual(f.originalTraitors, traitorDeck(f.setup.players, true).sort()); assert.ok(f.originalTraitors.includes(CHEAP_HERO_TRAITOR));
    assert.equal(f.originalCards.length, 47); assert.equal(f.originalSpice.length, spiceDeck(true).length);
    assert.deepEqual(player(f.game, f.asker).hand.map(card => card.id), f.truths);
    assert.equal(f.game.phase, source === 'phase2' ? 2 : 1);
    assert.equal(!!f.game.phaseOpening, source === 'amalOpening');
    assert.equal(player(f.game, f.target).spice, source === 'amalOpening' || source === 'thumper' ? 10 : 5);
    assert.notEqual(player(f.game, f.target).charityTurn, f.game.turn);
    assert.equal(f.sourceActionCount, f.sourceActions.length); assert.equal(f.sourceCounts.selected, f.sourceActions.length);
    assert.equal(f.sourceCounts.inherited, f.base.sourceActionCount);
    assert.equal(f.sourceCounts.nativeContinuation, f.sourceActions.length - f.base.sourceActionCount);
    assert.equal(f.sourceCounts.actualAmalReduction, f.reduction?.steps.length ?? 0);
    if (f.reduction) {
      assert.equal(player(f.reduction.before, f.target).spice, 10); assert.equal(player(f.reduction.after, f.target).spice, 5);
      assert.ok(f.reduction.steps.some(step => step.actor === f.target && step.action.type === 'card' && step.action.card === f.card));
    }
    assert.deepEqual(inventory(f.game), f.originalCards); assert.deepEqual(traitors(f.game), f.originalTraitors);
    assert.deepEqual(spice(f.game), f.originalSpice);
  }
});

void test('actual Amal then five paid, one native Charity claim and one later installment fulfills six with frozen facts', () => {
  const f = fixture(), raw: TruthQuestion = { ...f.question, mixed: group('and', fact(f.spiceFact), f.mixed) };
  const actions: TruthCharityPaymentsStep[] = []; let game = bind(f, 'yes', raw, f.game, 0, actions).game;
  const guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide);
  assert.equal(guide.action.type, 'card'); assert.equal(guide.action.card, f.card);
  game = act(game, f.target, guide.action, actions); assert.equal(player(game, f.target).spice, 5);
  assert.ok(game.phaseOpening); assert.equal(truthFactAnswer(player(game, f.target), f.spiceFact), 'no');
  rejected(game, f.target, { type: 'bribe', target: f.recipient, amount: 5 }); game = settle(game, actions);
  game = pay(game, f, 5, f.recipient, actions); assert.equal(player(game, f.target).spice, 0);
  assert.notEqual(viewGame(game, f.target).turnActionGuide?.action.type, 'charity', 'A future-phase quote is not an executable current action');
  game = reachClaim(game, actions); assert.notEqual(player(game, f.target).charityTurn, game.turn);
  assert.equal(charityQuote(game, player(game, f.target)).total, 2);
  const claim = viewGame(game, f.target).turnActionGuide; assert.ok(claim); assert.equal(claim.action.type, 'charity');
  assert.equal(claim.action.turnActionPromiseEvent, promise(game).event); assert.equal(claim.action.turnActionPromisePhase, 2);
  rejected(game, f.target, { type: 'ready' }); game = act(game, f.target, claim.action, actions);
  assert.equal(player(game, f.target).charityTurn, game.turn); assert.equal(player(game, f.target).spice, 2);
  assert.equal(game.turnActionPromises![0].payments.find(row => row.recipient === f.recipient)?.amount, 5);
  const final = viewGame(game, f.target).turnActionGuide; assert.ok(final); assert.equal(final.action.type, 'bribe'); assert.equal(final.action.amount, 1);
  game = act(game, f.target, final.action, actions);
  assert.equal(player(game, f.target).spice, 1); assert.equal(player(game, f.recipient).bribes, 6); assert.equal(promise(game).fulfilled, true);
  assert.deepEqual(game.turnActionPromises![0].mixed, raw.kind === 'turnActions' ? raw.mixed : null);
  assert.equal(actions.filter(step => step.actor === f.target && step.action.type === 'charity').length, 1);
  rejected(game, f.target, f.charity); physical(game, f);
});

void test('bare, grouped and mixed payment questions use the same real Charity installment path after actual Amal', () => {
  for (const kind of ['bribe', 'bribeExpression', 'mixedBribe'] as const) {
    const f = fixture({ source: 'afterAmal' }), raw = question(f, kind);
    let game = bind(f, 'yes', raw).game;
    const first = viewGame(game, f.target).bribePromiseGuide; assert.ok(first, kind);
    assert.equal(first.action.bribePromiseEvent, promise(game, kind).event); assert.notEqual(first.action.type, 'charity');
    game = pay(game, f, 5); game = reachClaim(game);
    const claim = viewGame(game, f.target).bribePromiseGuide; assert.ok(claim, kind); assert.equal(claim.action.type, 'charity');
    assert.equal(claim.action.bribePromiseEvent, promise(game, kind).event);
    game = act(game, f.target, claim.action); assert.equal(player(game, f.target).spice, 2);
    const final = viewGame(game, f.target).bribePromiseGuide; assert.ok(final); assert.equal(final.action.type, 'bribe'); assert.equal(final.action.amount, 1);
    game = act(game, f.target, final.action);
    assert.equal(promise(game, kind).fulfilled, true); assert.equal(player(game, f.target).spice, 1);
    assert.equal(player(game, f.recipient).bribes, 6); assert.equal(player(game, f.target).charityTurn, game.turn); physical(game, f);
  }
});

void test('required printed Thumper occurs before future Charity and cumulative eleven is funded by ten plus one actual claim', () => {
  const f = fixture({ source: 'thumper' }); let game = bind(f).game;
  game = settle(act(game, f.target, f.nativeAction));
  assert.equal(game.discard.filter(card => card.id === f.card).length, 1); assert.equal(game.turnActionPromises![0].windowCards?.thumper?.played, true);
  assert.equal(player(game, f.target).spice, 10); assert.notEqual(player(game, f.target).charityTurn, game.turn);
  game = pay(game, f, 10); game = reachClaim(game);
  const guide = viewGame(game, f.target).turnActionGuide; assert.ok(guide); assert.equal(guide.action.type, 'charity');
  game = act(game, f.target, guide.action); game = pay(game, f, 1);
  assert.equal(player(game, f.target).spice, 1); assert.equal(player(game, f.recipient).bribes, 11);
  assert.equal(player(game, f.target).charityTurn, game.turn); assert.equal(promise(game).fulfilled, true); physical(game, f);
});

void test('different recipients share one purse and one actual Charity while their installments accumulate separately', () => {
  const f = fixture({ source: 'afterAmal' });
  const raw: TruthQuestion = { kind: 'turnActions', target: f.target, turn: f.game.turn,
    mixed: group('and', payment(f.recipient, 3), payment(f.observer, 3)) };
  let game = bind(f, 'yes', raw).game; game = pay(game, f, 3); game = pay(game, f, 2, f.observer);
  assert.equal(player(game, f.target).spice, 0); game = reachClaim(game); game = act(game, f.target, f.charity);
  game = pay(game, f, 1, f.observer);
  assert.equal(player(game, f.target).spice, 1); assert.equal(player(game, f.recipient).bribes, 3); assert.equal(player(game, f.observer).bribes, 3);
  assert.deepEqual(game.turnActionPromises![0].payments.slice().sort((a, b) => a.recipient.localeCompare(b.recipient)),
    [{ recipient: f.observer, amount: 3 }, { recipient: f.recipient, amount: 3 }].sort((a, b) => a.recipient.localeCompare(b.recipient)));
  assert.equal(promise(game).fulfilled, true); rejected(game, f.target, f.charity); physical(game, f);
});

void test('a cumulative bare No cap survives the genuine Charity income and never treats that claim as another payment', () => {
  const f = fixture({ source: 'afterAmal' }), raw = question(f, 'bribe'); let game = bind(f, 'no', raw).game;
  game = pay(game, f, 5); game = reachClaim(game); game = act(game, f.target, f.charity);
  assert.equal(player(game, f.target).spice, 2); assert.equal(game.bribePromises![0].progress, 5);
  rejected(game, f.target, { type: 'bribe', target: f.recipient, amount: 1 });
  assert.ok(!game.bribePromises![0].released); game = finish(game);
  assert.equal(game.bribePromises![0].progress, 5); assert.equal(player(game, f.target).charityTurn, 1); physical(game, f);
});

void test('already claimed or genuinely expired Charity cannot be reserved again for a new positive payment', () => {
  const claimed = fixture({ source: 'phase2' }); let game = pay(claimed.game, claimed, 5);
  game = act(game, claimed.target, claimed.charity); game = pay(game, claimed, 2);
  assert.equal(player(game, claimed.target).spice, 0); assert.equal(player(game, claimed.target).charityTurn, game.turn);
  rejected(game, claimed.target, claimed.charity);
  let asked = ask(declare(claimed, game).game, claimed.asker, question(claimed, 'bribe', 1));
  assert.deepEqual(viewGame(asked, claimed.target).truthBribeAnswers, ['no']); rejected(asked, claimed.target, { type: 'truthAnswer', answer: 'yes' });
  game = answer(asked, claimed.target, 'no'); assert.equal(game.bribePromises![0].progress, 0); physical(game, claimed);
  const expired = fixture({ source: 'afterAmal' }); game = pay(expired.game, expired, 5);
  game = advance(game, state => state.phase === 3 && clean(state), [], true);
  assert.notEqual(player(game, expired.target).charityTurn, game.turn); assert.equal(player(game, expired.target).spice, 0);
  rejected(game, expired.target, expired.charity);
  asked = ask(declare(expired, game).game, expired.asker, question(expired, 'bribe', 1));
  assert.deepEqual(viewGame(asked, expired.target).truthBribeAnswers, ['no']);
  game = answer(asked, expired.target, 'no'); physical(game, expired);
});

void test('a Basic phase2 positive answer reopens real own Ready and cannot forfeit its necessary Charity claim', () => {
  for (const kind of ['turnActions', 'bribe'] as const) {
    const f = fixture({ source: 'phase2' }); let source = pay(f.game, f, 5);
    source = act(source, f.target, { type: 'ready' }); assert.ok(source.ready.includes(f.target));
    let game = bind(f, 'yes', question(f, kind, 1), source).game;
    assert.equal(game.ready.includes(f.target), false); rejected(game, f.target, { type: 'ready' });
    const view = viewGame(game, f.target), guide = kind === 'turnActions' ? view.turnActionGuide : view.bribePromiseGuide;
    assert.ok(guide); assert.equal(guide.action.type, 'charity'); game = act(game, f.target, guide.action);
    game = pay(game, f, 1); assert.equal(promise(game, kind).fulfilled, true); assert.equal(player(game, f.target).spice, 1);
    assert.equal(player(game, f.recipient).bribes, 6); assert.equal(player(game, f.target).charityTurn, game.turn); physical(game, f);
  }
});

void test('Advanced future Charity can fund an answer but its real claim guide waits for the original owned turn', () => {
  const f = fixture({ source: 'phase2', advanced: true });
  assert.notEqual(f.game.charityOrder!.remaining[0], f.target);
  let game = bind(f, 'yes').game;
  game = pay(game, f, 5);
  assert.equal(player(game, f.target).spice, 0);
  assert.notEqual(viewGame(game, f.target).turnActionGuide?.action.type, 'charity');
  rejected(game, f.target, f.charity);
  while (game.charityOrder!.remaining[0] !== f.target)
    game = act(game, game.charityOrder!.remaining[0], { type: 'ready' });
  const guide = viewGame(game, f.target).turnActionGuide;
  assert.equal(guide?.action.type, 'charity');
  rejected(game, f.target, { type: 'ready' });
  game = act(game, f.target, guide!.action);
  game = pay(game, f, 1);
  assert.equal(promise(game).fulfilled, true);
  assert.equal(player(game, f.target).spice, 1);
  physical(game, f);
});

void test('new Advanced answers cannot reopen an actually completed Charity opportunity for another claim', () => {
  for (const kind of ['turnActions', 'bribe'] as const) {
    const f = fixture({ source: 'phase2', advanced: true }), respondent = 'atreides';
    let game = act(f.game, respondent, { type: 'bribe', target: f.asker, amount: player(f.game, respondent).spice });
    while (!game.ready.includes(respondent))
      game = act(game, game.charityOrder!.remaining[0], { type: 'ready' });
    assert.equal(game.phase, 2); assert.equal(game.active, f.target);
    const queue = structuredClone(game.charityOrder), ready = [...game.ready];
    const raw: TruthQuestion = { ...question(f, kind, 1), target: respondent };
    const asked = ask(declare(f, game).game, f.asker, raw);
    const view = viewGame(asked, respondent);
    assert.deepEqual(kind === 'turnActions' ? view.truthTurnActionAnswers : view.truthBribeAnswers, ['no']);
    rejected(asked, respondent, { type: 'truthAnswer', answer: 'yes' });
    game = answer(asked, respondent, 'no');
    assert.deepEqual(game.charityOrder, queue); assert.deepEqual(game.ready, ready);
    rejected(game, respondent, f.charity);
    assert.notEqual(player(game, respondent).charityTurn, game.turn);
    physical(game, f);
  }
});

void test('one native Charity is shared with shipment and cannot be claimed early to strand remaining payments', () => {
  const f = fixture({ source: 'afterAmal' });
  const impossible: TruthQuestion = { kind: 'turnActions', target: f.target, turn: f.game.turn,
    mixed: group('and', payment(f.recipient, 6), ship()) };
  const asked = ask(declare(f).game, f.asker, impossible);
  assert.deepEqual(viewGame(asked, f.target).truthTurnActionAnswers, ['no']); rejected(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
  const funded: TruthQuestion = { kind: 'turnActions', target: f.target, turn: f.game.turn,
    mixed: group('and', payment(f.recipient, 5), ship()) };
  let game = bind(f, 'yes', funded).game; game = pay(game, f, 5); game = reachClaim(game); game = act(game, f.target, f.charity);
  assert.equal(player(game, f.target).spice, 2);
  game = advance(game, state => state.phase === 5 && state.active === f.target && clean(state), [], true);
  game = settle(act(game, f.target, { type: 'ship', territory: 'polar_sink', sector: 0, amount: 1, elite: 0, allyPayment: 0 }));
  assert.equal(player(game, f.target).spice, 0); assert.equal(player(game, f.target).forces['polar_sink:0'], 1);
  assert.equal(promise(game).fulfilled, true); assert.equal(player(game, f.target).charityTurn, game.turn); physical(game, f);
  const opening = fixture(); assert.ok(opening.printed);
  const seven: TruthQuestion = { kind: 'turnActions', target: opening.target, turn: opening.game.turn,
    mixed: group('and', opening.printed, payment(opening.recipient, 7)) };
  let manual = bind(opening, 'yes', seven).game;
  manual = settle(act(manual, opening.target, opening.nativeAction)); manual = pay(manual, opening, 4);
  manual = reachClaim(manual); assert.equal(player(manual, opening.target).spice, 1);
  assert.equal(charityQuote(manual, player(manual, opening.target)).total, 1);
  rejected(manual, opening.target, opening.charity);
  assert.notEqual(player(manual, opening.target).charityTurn, manual.turn); assert.ok(!promise(manual).released);
  const prepay = viewGame(manual, opening.target).turnActionGuide; assert.ok(prepay);
  assert.equal(prepay.action.type, 'bribe'); assert.equal(prepay.action.amount, 1);
  manual = act(manual, opening.target, prepay.action); assert.equal(player(manual, opening.target).spice, 0);
  const claim = viewGame(manual, opening.target).turnActionGuide; assert.ok(claim); assert.equal(claim.action.type, 'charity');
  manual = act(manual, opening.target, claim.action); assert.equal(player(manual, opening.target).spice, 2);
  const remaining = viewGame(manual, opening.target).turnActionGuide; assert.ok(remaining);
  assert.equal(remaining.action.type, 'bribe'); assert.equal(remaining.action.amount, 2);
  manual = act(manual, opening.target, remaining.action);
  assert.equal(player(manual, opening.target).spice, 0); assert.equal(player(manual, opening.recipient).bribes, 7);
  assert.equal(promise(manual).fulfilled, true); assert.ok(!promise(manual).released); physical(manual, opening);
});

void test('two genuine Truths cannot reserve the same Charity twice across different recipient promises', () => {
  const f = fixture({ source: 'afterAmal' }); let game = bind(f, 'yes', question(f, 'bribe', 6)).game;
  const earlier = structuredClone(game.bribePromises![0]), history = structuredClone(game.truthHistory![0]);
  const second = question(f, 'bribe', 2, f.observer), asked = ask(declare(f, game, 1).game, f.asker, second);
  assert.deepEqual(viewGame(asked, f.target).truthBribeAnswers, ['no']); rejected(asked, f.target, { type: 'truthAnswer', answer: 'yes' });
  game = answer(asked, f.target, 'no'); assert.deepEqual(game.bribePromises![0], earlier); assert.deepEqual(game.truthHistory![0], history);
  assert.equal(player(game, f.target).spice, 5); assert.notEqual(player(game, f.target).charityTurn, game.turn); physical(game, f, 2);
});

void test('current Charity guide packets retain exact owner and original promise event through JSON and reject stale claims', () => {
  for (const kind of ['turnActions', 'bribe'] as const) {
    const f = fixture({ source: 'phase2' }); let game = bind(f, 'yes', question(f, kind)).game; game = pay(game, f, 5);
    const view = viewGame(game, f.target), guide = kind === 'turnActions' ? view.turnActionGuide : view.bribePromiseGuide;
    assert.ok(guide); assert.equal(guide.action.type, 'charity');
    const event = kind === 'turnActions' ? guide.action.turnActionPromiseEvent : guide.action.bribePromiseEvent;
    assert.equal(event, promise(game, kind).event); rejected(game, f.asker, guide.action);
    rejected(game, f.target, kind === 'turnActions' ? { ...guide.action, turnActionPromiseEvent: 'stale-charity-event' }
      : { ...guide.action, bribePromiseEvent: 'stale-charity-event' });
    const packet: Action = JSON.parse(JSON.stringify(guide.action)); game = act(game, f.target, packet);
    rejected(game, f.target, packet); assert.equal(player(game, f.target).charityTurn, game.turn);
    const next = viewGame(game, f.target), final = kind === 'turnActions' ? next.turnActionGuide : next.bribePromiseGuide;
    assert.ok(final); assert.equal(final.action.type, 'bribe'); assert.equal(final.action.amount, 1); game = act(game, f.target, final.action);
    assert.equal(promise(game, kind).fulfilled, true); physical(game, f);
  }
});

void test('all four minimal profiles execute actual prepayments, one Charity and later installments using current-phase guides', () => {
  for (const kind of ['turnActions', 'bribe'] as TruthCharityPaymentsKind[]) {
    const f = fixture({ source: kind === 'turnActions' ? 'amalOpening' : 'afterAmal' });
    const raw = kind === 'turnActions' ? f.question : question(f, kind), asked = ask(declare(f).game, f.asker, raw);
    for (const difficulty of DIFFICULTIES) {
      let game = structuredClone(asked); const actions: TruthCharityPaymentsStep[] = [];
      const answering = viewGame(game, f.target); answering.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
      const response = botActions(answering).find(candidate => candidate.type === 'truthAnswer'); assert.ok(response, `${kind}/${difficulty}`);
      assert.equal(response.answer, 'yes'); game = act(game, f.target, response, actions);
      for (let count = 0; count < 100 && !promise(game, kind).fulfilled; count++) {
        const view = viewGame(game, f.target); view.players.find(candidate => candidate.id === f.target)!.bot = difficulty;
        const guide = kind === 'turnActions' ? view.turnActionGuide : view.bribePromiseGuide;
        if (guide) {
          const action = botActions(view).find(candidate => kind === 'turnActions'
            ? candidate.turnActionPromiseEvent === guide.action.turnActionPromiseEvent
            : candidate.bribePromiseEvent === guide.action.bribePromiseEvent);
          assert.ok(action, `${kind}/${difficulty}`); assert.deepEqual(action, guide.action);
          if (action.type === 'charity') assert.equal(game.phase, 2);
          game = act(game, f.target, action, actions);
        } else {
          const next = nativeStep(game); assert.ok(next, `${kind}/${difficulty}`); game = act(game, next.actor, next.action, actions);
        }
      }
      assert.equal(promise(game, kind).fulfilled, true, `${kind}/${difficulty}`);
      assert.equal(actions.filter(step => step.actor === f.target && step.action.type === 'charity').length, 1);
      assert.ok(actions.filter(step => step.actor === f.target && step.action.type === 'bribe').length >= 2);
      assert.equal(player(game, f.recipient).bribes, 6); assert.equal(player(game, f.target).charityTurn, game.turn); physical(game, f);
    }
  }
});
