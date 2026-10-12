import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import {
  allowBureaucratQualifyingShipmentIncome, createBureaucratQualifyingShipmentFixture,
  declareBureaucratQualifyingShipment,
} from './fixture-bureaucrat-qualifying-shipment';

const seat = (game: Game, id: string) => game.players.find(p => p.id === id)!;
const physical = (game: Game) => game.players.map(p => ({ id: p.id, forces: p.forces,
  reserves: p.reserves, tanks: p.tanks, elites: p.elites, shipped: p.shipped, moved: p.moved }));
const wallets = (game: Game) => game.players.map(p => ({ id: p.id, spice: p.spice, bribes: p.bribes }));
function rejectUnchanged(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
function ownerChoice(game: Game, redirect: boolean) {
  assert.equal(game.decision?.kind, 'bureaucratPayment');
  return applyAction(structuredClone(game), 'b', {
    type: 'decision', event: game.decision!.event, redirect,
  });
}

void test('native Basic and Advanced allied shipments pay every original leg and divert at most two from Guild income', () => {
  for (const advanced of [false, true])
    for (const [primary, donor] of [[5, 3], [3, 5], [5, 5], [0, 5]])
      for (const redirect of [false, true]) {
        const f = createBureaucratQualifyingShipmentFixture({ advanced, primary, donor });
        const original = f.beforePledge;
        assert.equal(seat(original, 'f').spice, 6);
        assert.equal(seat(f.beforeAction, 'f').spice, 6 - donor);
        assert.equal(f.beforeAction.aid.f.amount, donor);
        assert.deepEqual(physical(f.beforeAction), physical(original));
        const { declared, paid } = declareBureaucratQualifyingShipment(f);
        if (declared.decision?.kind === 'guildShipment') {
          assert.deepEqual(wallets(declared), wallets(f.beforeAction));
          assert.deepEqual(physical(declared), physical(f.beforeAction));
          assert.equal(declared.decision.player, 'g');
        }
        assert.equal(paid.response?.kind, 'guildIncome');
        assert.equal(paid.response?.amount, primary + donor);
        assert.equal(seat(paid, 'p').spice, seat(original, 'p').spice - primary);
        assert.equal(seat(paid, 'f').spice, 6 - donor);
        assert.equal(paid.aid.f.amount, 0);
        assert.equal(seat(paid, 'g').spice, advanced ? 6 : 5);
        assert.equal(seat(paid, 'p').reserves, 10 - f.amount);
        assert.deepEqual(seat(paid, 'p').forces, { 'carthag:11': 10, [f.target]: f.amount });
        assert.equal(seat(paid, 'p').shipped, true);
        for (const id of ['b', 'f', 'e', 'g']) {
          assert.deepEqual(seat(paid, id).forces, seat(original, id).forces);
          assert.equal(seat(paid, id).reserves, seat(original, id).reserves);
        }
        const pending = allowBureaucratQualifyingShipmentIncome(paid);
        assert.equal(pending.decision?.kind, 'bureaucratPayment');
        assert.deepEqual(physical(pending), physical(paid));
        assert.deepEqual(wallets(pending), wallets(paid));
        const after = ownerChoice(pending, redirect);
        assert.equal(seat(after, 'g').spice, (advanced ? 6 : 5) + f.amount - (redirect ? 2 : 0));
        for (const id of ['p', 'f', 'b', 'e']) {
          assert.equal(seat(after, id).spice, seat(paid, id).spice);
          assert.equal(seat(after, id).bribes, seat(paid, id).bribes);
        }
        assert.equal(after.players.reduce((sum, p) => sum + p.spice, 0),
          original.players.reduce((sum, p) => sum + p.spice, 0) - (redirect ? 2 : 0));
        assert.deepEqual(physical(after), physical(paid));
        assert.equal(after.bureaucratPayments?.used.length ?? 0, Number(redirect));
        assert.equal(after.bureaucratPayments?.pending, undefined);
        assert.deepEqual(after.deck, pending.deck);
        assert.deepEqual(after.discard, pending.discard);
        assert.deepEqual(after.players.map(p => p.hand), pending.players.map(p => p.hand));
        rejectUnchanged(after, 'b', { type: 'decision', event: pending.decision!.event, redirect });
        rejectUnchanged(after, 'p', f.action);
        const ended = applyAction(structuredClone(after), 'p', { type: 'endMovement' });
        assert.notEqual(ended.active, 'p');
        assert.deepEqual(physical(ended), physical(after));
        rejectUnchanged(ended, 'p', { type: 'endMovement' });
      }
});

void test('Karama cancels original gross Guild income after the same shipment and full allied debits, without spending Bureaucrat', () => {
  for (const advanced of [false, true])
    for (const [primary, donor] of [[5, 3], [3, 5], [5, 5], [0, 5]]) {
      const f = createBureaucratQualifyingShipmentFixture({ advanced, primary, donor });
      const { paid } = declareBureaucratQualifyingShipment(f);
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
      assert.deepEqual(physical(after), physical(paid));
      assert.equal(after.discard.filter(card => card.id === f.karama.id).length, 1);
      assert.equal(seat(after, f.responder).hand.some(card => card.id === f.karama.id), false);
      assert.equal(after.bureaucratPayments?.pending, undefined);
      assert.equal(after.bureaucratPayments?.used.length ?? 0, 0);
      assert.notEqual(after.decision?.kind, 'bureaucratPayment');
      assert.equal(after.response, null);
      rejectUnchanged(after, f.responder, { type: 'card', mode: 'cancel', card: f.karama.id });
    }
});

void test('neither pooled sub-five shares nor the native Bureaucrat owner contribution qualifies on its own', () => {
  for (const advanced of [false, true])
    for (const options of [
      { primary: 3, donor: 3 }, { primary: 4, donor: 3 },
      { primary: 3, donor: 5, ownerFunding: true },
    ]) {
      const f = createBureaucratQualifyingShipmentFixture({ advanced, ...options });
      if (options.ownerFunding) {
        assert.equal(seat(f.beforePledge, 'p').ally, 'b');
        assert.equal(seat(f.beforePledge, 'b').ally, 'p');
        assert.equal(seat(f.beforePledge, 'f').ally, null);
      }
      const { paid } = declareBureaucratQualifyingShipment(f);
      const after = allowBureaucratQualifyingShipmentIncome(paid);
      assert.notEqual(after.decision?.kind, 'bureaucratPayment');
      assert.equal(after.bureaucratPayments?.used.length ?? 0, 0);
      assert.equal(seat(after, 'g').spice, seat(f.beforePledge, 'g').spice + f.amount);
      assert.equal(seat(after, 'p').spice, seat(f.beforePledge, 'p').spice - options.primary);
      assert.equal(seat(after, f.donor).spice, seat(f.beforePledge, f.donor).spice - options.donor);
      assert.deepEqual(physical(after), physical(paid));
    }
});

void test('an excluded owner funding leg does not mask the other actual qualifying third-party payer', () => {
  for (const advanced of [false, true])
    for (const donor of [3, 5]) {
      const f = createBureaucratQualifyingShipmentFixture({ advanced, primary: 5, donor, ownerFunding: true });
      assert.equal(f.donor, 'b');
      assert.equal(seat(f.alliance, 'p').ally, 'b');
      assert.equal(seat(f.alliance, 'b').ally, 'p');
      const { paid } = declareBureaucratQualifyingShipment(f);
      const pending = allowBureaucratQualifyingShipmentIncome(paid);
      const after = ownerChoice(pending, true);
      assert.equal(seat(after, 'b').spice, seat(f.beforePledge, 'b').spice - donor);
      assert.equal(seat(after, 'p').spice, seat(f.beforePledge, 'p').spice - 5);
      assert.equal(seat(after, 'g').spice, seat(f.beforePledge, 'g').spice + f.amount - 2);
      assert.equal(after.bureaucratPayments?.used.length, 1);
      assert.deepEqual(physical(after), physical(paid));
    }
});

void test('pending allied-funded income exposes public gross and recipient, never which private contribution qualified', () => {
  for (const advanced of [false, true])
    for (const [primary, donor] of [[5, 3], [3, 5], [5, 5], [0, 5]]) {
      const f = createBureaucratQualifyingShipmentFixture({ advanced, primary, donor });
      const { paid } = declareBureaucratQualifyingShipment(f);
      for (const viewer of paid.players) {
        const response = viewGame(paid, viewer.id).response;
        assert.equal(response?.amount, f.amount);
        assert.equal(response?.owner, 'g');
        assert.equal(response?.bureaucratPayment, undefined);
        assert.equal(response?.guildContributions, undefined);
        assert.equal(response?.occupiedPayment, undefined);
      }
      const pending = allowBureaucratQualifyingShipmentIncome(paid);
      for (const viewer of pending.players) {
        const view = viewGame(pending, viewer.id);
        const payment = view.bureaucrat.pending;
        assert.ok(payment);
        assert.equal(payment.amount, f.amount);
        assert.equal(payment.payee, 'g');
        assert.equal(payment.payer, null);
        assert.equal('contributions' in payment, false);
        assert.equal('source' in payment, false);
        assert.equal('signature' in payment, false);
        assert.equal('bureaucratPayments' in view, false);
        assert.equal('bureaucratUseEvents' in view, false);
        for (const other of view.players.filter(p => p.id !== viewer.id)) {
          assert.equal(other.spice, undefined);
          assert.equal(other.hand, undefined);
        }
      }
      for (const id of ['p', 'f', 'e', 'g'])
        rejectUnchanged(pending, id, { type: 'decision', event: pending.bureaucratPaymentEvent, redirect: true });
      rejectUnchanged(pending, 'b', { type: 'decision', event: 'stale-income', redirect: true });
      rejectUnchanged(pending, 'b', { type: 'endMovement' });
      rejectUnchanged(pending, 'f', { type: 'pledgeAid', amount: 1 });
    }
});

void test('all four minimal Bureaucrat bot responses settle the original private-funded payment and resume native movement', () => {
  for (const advanced of [false, true])
    for (const bot of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
      const f = createBureaucratQualifyingShipmentFixture({ advanced, primary: 5, donor: 5 });
      const pending = allowBureaucratQualifyingShipmentIncome(declareBureaucratQualifyingShipment(f).paid);
      const view = viewGame(pending, 'b');
      view.players.find(p => p.id === 'b')!.bot = bot;
      const actions = botActions(view);
      assert.equal(actions.length, 1);
      const after = applyAction(structuredClone(pending), 'b', actions[0]);
      assert.equal(seat(after, 'g').spice, seat(f.beforePledge, 'g').spice + 8);
      assert.equal(after.bureaucratPayments?.used.length, 1);
      assert.deepEqual(physical(after), physical(pending));
      for (const id of ['b', 'p', 'f', 'e']) assert.equal(seat(after, id).spice, seat(pending, id).spice);
      const ended = applyAction(after, 'p', { type: 'endMovement' });
      assert.notEqual(ended.active, 'p');
      assert.deepEqual(physical(ended), physical(after));
      rejectUnchanged(ended, 'b', actions[0]);
    }
});

void test('declining the shipment preserves the physical card for the next real payment, while redirecting spends it once per phase', () => {
  for (const advanced of [false, true])
    for (const redirect of [false, true]) {
      const f = createBureaucratQualifyingShipmentFixture({ advanced, primary: 5, donor: 3 });
      const pending = allowBureaucratQualifyingShipmentIncome(declareBureaucratQualifyingShipment(f).paid);
      const settled = ownerChoice(pending, redirect);
      const following = applyAction(structuredClone(settled), 'e', { type: 'bribe', target: 'f', amount: 5 });
      assert.equal(seat(following, 'e').spice, seat(settled, 'e').spice - 5);
      assert.deepEqual(physical(following), physical(settled));
      if (redirect) {
        assert.notEqual(following.decision?.kind, 'bureaucratPayment');
        assert.equal(seat(following, 'f').bribes, seat(settled, 'f').bribes + 5);
        assert.equal(following.bureaucratPayments?.used.length, 1);
      } else {
        assert.equal(following.decision?.kind, 'bureaucratPayment');
        rejectUnchanged(following, 'b', { type: 'decision', event: pending.bureaucratPaymentEvent, redirect: true });
        const second = ownerChoice(following, true);
        assert.equal(seat(second, 'f').bribes, seat(settled, 'f').bribes + 3);
        assert.equal(second.bureaucratPayments?.used.length, 1);
        assert.equal(seat(second, 'g').spice, seat(settled, 'g').spice);
      }
    }
});

void test('native shipment funding rejects more than the actual pledged aid without committing payment or counters', () => {
  for (const advanced of [false, true]) {
    const f = createBureaucratQualifyingShipmentFixture({ advanced, primary: 5, donor: 3 });
    assert.equal(viewGame(f.beforeAction, 'p').aid.available, 3);
    assert.equal(viewGame(f.beforeAction, 'f').aid.pledged, 3);
    assert.equal(viewGame(f.beforeAction, 'b').aid.available, 0);
    rejectUnchanged(f.beforeAction, 'p', { ...f.action, allyPayment: 4 });
    rejectUnchanged(f.beforeAction, 'f', f.action);
    assert.deepEqual(physical(f.beforeAction), physical(f.beforePledge));
    assert.equal(seat(f.beforeAction, 'p').spice, seat(f.beforePledge, 'p').spice);
    assert.equal(seat(f.beforeAction, 'f').spice, 3);
    assert.equal(f.beforeAction.response, null);
    assert.equal(f.beforeAction.decision, null);
  }
});
