import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { advanceBureaucratPairedFunding } from './fixture-bureaucrat-paired-funding';
import {
  allowBureaucratPairedShipmentIncome, createBureaucratPairedShipmentFixture,
  declareBureaucratPairedShipment,
} from './fixture-bureaucrat-paired-shipment';

const seat = (game: Game, id: string) => game.players.find(p => p.id === id)!;
const counters = (game: Game) => game.players.map(p => ({ id: p.id, forces: p.forces,
  reserves: p.reserves, tanks: p.tanks, elites: p.elites }));
const wallets = (game: Game) => game.players.map(p => ({ id: p.id, spice: p.spice, bribes: p.bribes }));
function rejectUnchanged(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
function choose(game: Game, redirect: boolean) {
  assert.equal(game.decision?.kind, 'bureaucratPayment');
  return applyAction(structuredClone(game), 'b', {
    type: 'decision', event: game.decision!.event, redirect,
  });
}

void test('paired Basic and Advanced native shipments retain every original army and debit full allied costs for one flat Guild diversion', () => {
  for (const advanced of [false, true])
    for (const [primary, donor] of [[5, 3], [3, 5], [5, 5], [0, 5]])
      for (const redirect of [false, true]) {
        const f = createBureaucratPairedShipmentFixture({ advanced, primary, donor });
        const original = f.beforePledge;
        assert.equal(seat(f.beforeAction, 'p').spice, advanced ? 9 : 7);
        assert.equal(seat(f.beforeAction, 'f').spice, 6 - donor);
        assert.equal(f.beforeAction.aid.f.amount, donor);
        assert.deepEqual(counters(f.beforeAction), counters(original));
        assert.ok(f.actions.some(step => step.action.type === 'bribe' && step.actor === 'p' && step.action.amount === 3));
        assert.equal(seat(f.afterFirstMentat, 'f').spice, 6);
        assert.ok(f.actions.some(step => step.actor === 'r' && step.action.type === 'decision' && typeof step.action.position === 'string'));
        const { declared, paid } = declareBureaucratPairedShipment(f);
        if (advanced) {
          assert.equal(declared.decision?.kind, 'guildShipment');
          assert.equal(declared.decision?.player, 'g');
          assert.deepEqual(wallets(declared), wallets(f.beforeAction));
          assert.deepEqual(counters(declared), counters(f.beforeAction));
        } else {
          assert.equal(declared.response?.kind, 'guildIncome');
          assert.deepEqual(counters(declared), counters(paid));
        }
        assert.equal(paid.response?.kind, 'guildIncome');
        assert.equal(paid.response?.amount, f.amount);
        assert.equal(seat(paid, 'p').spice, seat(original, 'p').spice - primary);
        assert.equal(seat(paid, 'f').spice, 6 - donor);
        assert.equal(paid.aid.f.amount, 0);
        assert.equal(seat(paid, 'g').spice, advanced ? 6 : 5);
        assert.equal(seat(paid, 'p').reserves, 10 - f.amount);
        assert.deepEqual(seat(paid, 'p').forces, { 'carthag:11': 10, [f.target]: f.amount });
        assert.equal(seat(paid, 'p').shipped, true);
        for (const id of ['b', 'r', 'f', 'e', 'g']) {
          assert.deepEqual(seat(paid, id).forces, seat(original, id).forces);
          assert.equal(seat(paid, id).reserves, seat(original, id).reserves);
        }
        const pending = allowBureaucratPairedShipmentIncome(paid);
        assert.equal(pending.decision?.kind, 'bureaucratPayment');
        assert.deepEqual(counters(pending), counters(paid));
        assert.deepEqual(wallets(pending), wallets(paid));
        const after = choose(pending, redirect);
        assert.equal(seat(after, 'g').spice, seat(original, 'g').spice + f.amount - (redirect ? 2 : 0));
        for (const id of ['p', 'f', 'b', 'r', 'e']) {
          assert.equal(seat(after, id).spice, seat(paid, id).spice);
          assert.equal(seat(after, id).bribes, seat(paid, id).bribes);
        }
        assert.equal(after.players.reduce((sum, p) => sum + p.spice, 0),
          original.players.reduce((sum, p) => sum + p.spice, 0) - (redirect ? 2 : 0));
        assert.deepEqual(counters(after), counters(paid));
        assert.equal(seat(after, 'p').shipped, true);
        assert.equal(after.bureaucratPayments?.used.length ?? 0, Number(redirect));
        assert.equal(viewGame(after, 'b').bureaucrat.usedThisPhase, redirect);
        assert.equal(after.bureaucratPayments?.pending, undefined);
        assert.deepEqual(after.leaderSkills?.assignments, pending.leaderSkills?.assignments);
        assert.deepEqual(after.deck, pending.deck);
        assert.deepEqual(after.discard, pending.discard);
        assert.deepEqual(after.players.map(p => p.hand), pending.players.map(p => p.hand));
        assert.equal(after.phase, 5);
        assert.equal(after.active, 'p');
        rejectUnchanged(after, 'b', { type: 'decision', event: pending.decision!.event, redirect });
        rejectUnchanged(after, 'p', f.action);
        const ended = applyAction(structuredClone(after), 'p', { type: 'endMovement' });
        assert.notEqual(ended.active, 'p');
        assert.deepEqual(counters(ended), counters(after));
        // Advanced can enter Collection here: its native income is not a refund.
        rejectUnchanged(ended, 'p', { type: 'endMovement' });
      }
});

void test('original Karama cancels the gross paired Guild income to Bank after full debits and army commitment, without an offer or use', () => {
  for (const advanced of [false, true])
    for (const [primary, donor] of [[5, 3], [3, 5], [5, 5], [0, 5]]) {
      const f = createBureaucratPairedShipmentFixture({ advanced, primary, donor });
      const { paid } = declareBureaucratPairedShipment(f);
      assert.equal(paid.response?.amount, f.amount);
      assert.equal(viewGame(paid, f.responder).responseControls?.cancelCards.includes(f.karama.id), true);
      const after = applyAction(structuredClone(paid), f.responder, {
        type: 'card', mode: 'cancel', card: f.karama.id,
      });
      assert.equal(seat(after, 'g').spice, seat(f.beforePledge, 'g').spice);
      assert.equal(seat(after, 'p').spice, seat(f.beforePledge, 'p').spice - primary);
      assert.equal(seat(after, 'f').spice, 6 - donor);
      assert.equal(after.players.reduce((sum, p) => sum + p.spice, 0),
        f.beforePledge.players.reduce((sum, p) => sum + p.spice, 0) - f.amount);
      assert.deepEqual(counters(after), counters(paid));
      assert.equal(seat(after, 'p').shipped, true);
      assert.equal(after.discard.filter(card => card.id === f.karama.id).length, 1);
      assert.equal(seat(after, f.responder).hand.some(card => card.id === f.karama.id), false);
      assert.equal(after.bureaucratPayments?.pending, undefined);
      assert.equal(after.bureaucratPayments?.used.length ?? 0, 0);
      assert.equal(viewGame(after, 'b').bureaucrat.pending, null);
      assert.notEqual(after.decision?.kind, 'bureaucratPayment');
      assert.equal(after.response, null);
      rejectUnchanged(after, f.responder, { type: 'card', mode: 'cancel', card: f.karama.id });
    }
});

void test('paired native receipts never pool sub-five shares or qualify the CHOAM owner contribution alone', () => {
  for (const advanced of [false, true])
    for (const options of [
      { primary: 3, donor: 3 }, { primary: 4, donor: 3 },
      { primary: 3, donor: 5, ownerFunding: true }, { primary: 0, donor: 5, ownerFunding: true },
    ]) {
      const f = createBureaucratPairedShipmentFixture({ advanced, ...options });
      if (options.ownerFunding) {
        assert.equal(seat(f.beforePledge, 'p').ally, 'b');
        assert.equal(seat(f.beforePledge, 'b').ally, 'p');
        assert.equal(seat(f.beforePledge, 'f').ally, null);
      }
      const { paid } = declareBureaucratPairedShipment(f);
      const after = allowBureaucratPairedShipmentIncome(paid);
      assert.notEqual(after.decision?.kind, 'bureaucratPayment');
      assert.equal(after.bureaucratPayments?.used.length ?? 0, 0);
      assert.equal(seat(after, 'g').spice, seat(f.beforePledge, 'g').spice + f.amount);
      assert.equal(seat(after, 'p').spice, seat(f.beforePledge, 'p').spice - options.primary);
      assert.equal(seat(after, f.donor).spice, seat(f.beforePledge, f.donor).spice - options.donor);
      assert.deepEqual(counters(after), counters(paid));
    }
});

void test('actual H/CHOAM alliance excludes its native owner funding leg without masking Harkonnen five', () => {
  for (const advanced of [false, true])
    for (const donor of [3, 5]) {
      const f = createBureaucratPairedShipmentFixture({ advanced, primary: 5, donor, ownerFunding: true });
      assert.equal(f.donor, 'b');
      assert.equal(seat(f.alliance, 'p').ally, 'b');
      assert.equal(seat(f.alliance, 'b').ally, 'p');
      const { paid } = declareBureaucratPairedShipment(f);
      const pending = allowBureaucratPairedShipmentIncome(paid);
      const after = choose(pending, true);
      assert.equal(seat(after, 'b').spice, 26 - donor);
      assert.equal(seat(after, 'p').spice, (advanced ? 9 : 7) - 5);
      assert.equal(seat(after, 'g').spice, seat(f.beforePledge, 'g').spice + f.amount - 2);
      assert.equal(seat(after, 'f').spice, 6);
      assert.equal(after.bureaucratPayments?.used.length, 1);
      assert.deepEqual(counters(after), counters(paid));
    }
});

void test('paired pending views reveal only public gross and payee with null payer; cross-actor and stale choices reject unchanged', () => {
  for (const advanced of [false, true])
    for (const [primary, donor] of [[5, 3], [3, 5], [5, 5], [0, 5]]) {
      const f = createBureaucratPairedShipmentFixture({ advanced, primary, donor });
      const { paid } = declareBureaucratPairedShipment(f);
      for (const viewer of paid.players) {
        const response = viewGame(paid, viewer.id).response;
        assert.equal(response?.amount, f.amount);
        assert.equal(response?.owner, 'g');
        assert.equal(response?.bureaucratPayment, undefined);
        assert.equal(response?.guildContributions, undefined);
        assert.equal(response?.occupiedPayment, undefined);
      }
      const pending = allowBureaucratPairedShipmentIncome(paid);
      for (const viewer of pending.players) {
        const view = viewGame(pending, viewer.id);
        assert.deepEqual(view.bureaucrat.pending, {
          event: pending.bureaucratPaymentEvent, owner: 'b', payer: null, payee: 'g',
          amount: f.amount, kind: 'shipment', redirect: 2,
        });
        assert.equal('bureaucratPayments' in view, false);
        assert.equal('bureaucratUseEvents' in view, false);
        for (const other of view.players.filter(p => p.id !== viewer.id)) {
          assert.equal(other.spice, undefined);
          assert.equal(other.hand, undefined);
        }
      }
      for (const id of ['p', 'f', 'r', 'e', 'g'])
        rejectUnchanged(pending, id, { type: 'decision', event: pending.bureaucratPaymentEvent, redirect: true });
      rejectUnchanged(pending, 'b', { type: 'decision', event: 'stale-income', redirect: true });
      rejectUnchanged(pending, 'p', { type: 'endMovement' });
      rejectUnchanged(pending, 'f', { type: 'pledgeAid', amount: 1 });
    }
});

void test('all four minimal bot choices settle the genuine paired private-funded receipt and resume native Movement', () => {
  for (const advanced of [false, true])
    for (const bot of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
      const f = createBureaucratPairedShipmentFixture({ advanced, primary: 5, donor: 5 });
      const pending = allowBureaucratPairedShipmentIncome(declareBureaucratPairedShipment(f).paid);
      const view = viewGame(pending, 'b');
      view.players.find(p => p.id === 'b')!.bot = bot;
      const actions = botActions(view);
      assert.equal(actions.length, 1);
      const after = applyAction(structuredClone(pending), 'b', actions[0]);
      assert.equal(seat(after, 'g').spice, seat(f.beforePledge, 'g').spice + 8);
      assert.equal(after.bureaucratPayments?.used.length, 1);
      assert.deepEqual(counters(after), counters(pending));
      for (const id of ['b', 'r', 'p', 'f', 'e']) assert.equal(seat(after, id).spice, seat(pending, id).spice);
      assert.equal(after.phase, 5);
      assert.equal(after.active, 'p');
      const ended = applyAction(structuredClone(after), 'p', { type: 'endMovement' });
      assert.notEqual(ended.active, 'p');
      assert.deepEqual(counters(ended), counters(after));
      rejectUnchanged(ended, 'b', actions[0]);
    }
});

void test('decline preserves the physical Bureaucrat for the next real receipt; use is once per native phase and renews after real Mentat/Storm', () => {
  for (const advanced of [false, true])
    for (const redirect of [false, true]) {
      const f = createBureaucratPairedShipmentFixture({ advanced, primary: 5, donor: 3 });
      const pending = allowBureaucratPairedShipmentIncome(declareBureaucratPairedShipment(f).paid);
      const settled = choose(pending, redirect);
      const following = applyAction(structuredClone(settled), 'e', { type: 'bribe', target: 'f', amount: 5 });
      assert.equal(seat(following, 'e').spice, 5);
      assert.deepEqual(counters(following), counters(settled));
      let used: Game;
      if (redirect) {
        assert.notEqual(following.decision?.kind, 'bureaucratPayment');
        assert.equal(seat(following, 'f').bribes, seat(settled, 'f').bribes + 5);
        used = following;
      } else {
        assert.equal(following.decision?.kind, 'bureaucratPayment');
        rejectUnchanged(following, 'b', { type: 'decision', event: pending.bureaucratPaymentEvent, redirect: true });
        used = choose(following, true);
        assert.equal(seat(used, 'f').bribes, seat(settled, 'f').bribes + 3);
        assert.equal(seat(used, 'g').spice, seat(settled, 'g').spice);
      }
      assert.equal(used.bureaucratPayments?.used.length, 1);
      assert.deepEqual(used.leaderSkills?.assignments, settled.leaderSkills?.assignments);
      const ended = applyAction(used, 'p', { type: 'endMovement' });
      const next = advanceBureaucratPairedFunding(ended, state => state.turn === 3 && state.phase === 1 &&
        !state.phaseOpening && !state.response && !state.decision);
      assert.equal(viewGame(next, 'b').bureaucrat.usedThisPhase, false);
      const payment = applyAction(next, 'e', { type: 'bribe', target: 'f', amount: 5 });
      assert.equal(payment.decision?.kind, 'bureaucratPayment');
      const renewed = choose(payment, true);
      assert.equal(renewed.bureaucratPayments?.used.length, 2);
      assert.deepEqual(renewed.bureaucratPayments!.used.map(use => ({ turn: use.turn, phase: use.phase })),
        [{ turn: 2, phase: 5 }, { turn: 3, phase: 1 }]);
      assert.equal(viewGame(renewed, 'b').bureaucrat.usedThisPhase, true);
      assert.deepEqual(counters(renewed), counters(next));
    }
});

void test('actual pledged aid bounds reject unsupported shipment declarations without costs or counters', () => {
  for (const advanced of [false, true]) {
    const f = createBureaucratPairedShipmentFixture({ advanced, primary: 5, donor: 3 });
    assert.equal(viewGame(f.beforeAction, 'p').aid.available, 3);
    assert.equal(viewGame(f.beforeAction, 'f').aid.pledged, 3);
    assert.equal(viewGame(f.beforeAction, 'b').aid.available, 0);
    rejectUnchanged(f.beforeAction, 'p', { ...f.action, allyPayment: 4 });
    rejectUnchanged(f.beforeAction, 'f', f.action);
    assert.deepEqual(counters(f.beforeAction), counters(f.beforePledge));
    assert.equal(seat(f.beforeAction, 'p').spice, advanced ? 9 : 7);
    assert.equal(seat(f.beforeAction, 'f').spice, 3);
    assert.equal(f.beforeAction.response, null);
    assert.equal(f.beforeAction.decision, null);
  }
});
