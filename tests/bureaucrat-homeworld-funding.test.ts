import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, initializeHomeworldOccupationGameForAudit, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { bureaucratAlliedFundingModeSupported } from '../game/bureaucrat-payment';
import { assertClassicHomeworldSkillsCustody } from './fixture-homeworld-classic-skills';
import {
  advanceHomeworldFunding, allowHomeworldFundingResponses as allow, chooseHomeworldFunding as choose,
  createHomeworldFundingFixture as fixture, holdHomeworldFundingKarama,
  homeworldFundingCards, homeworldFundingClean, homeworldFundingPlayer as player,
  payHomeworldFunding as pay, type HomeworldFundingFixture,
} from './fixture-bureaucrat-homeworld-funding';

const wallets = (game: Game) => Object.fromEntries(game.players.map(p => [p.id, p.spice]));
const armies = (game: Game) => game.players.map(p => ({ id: p.id, forces: p.forces, reserves: p.reserves,
  tanks: p.tanks, elites: p.elites }));
function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}

/** Exact wallet conservation proves the flat Bank diversion, not just the
 * recipient's reduced receipt. Homeworld native custody remains real. */
function outcome(f: HomeworldFundingFixture, done: Game, diverted: number, canceled = false): void {
  const expected = wallets(f.beforePledge);
  expected[f.payer] -= f.payerShare; expected[f.donor] -= f.donorShare;
  if (!canceled) expected[f.payee] += f.gross - diverted;
  assert.deepEqual(wallets(done), expected);
  assert.equal(Object.values(wallets(f.beforePledge)).reduce((a, b) => a + b, 0) -
    Object.values(wallets(done)).reduce((a, b) => a + b, 0), canceled ? f.gross : diverted,
    'Only the original canceled gross or exactly two diverted spice leaves the seated wallets for the Bank');
  assert.equal(done.aid[f.donor]?.amount ?? 0, 0);
  assert.deepEqual(homeworldFundingCards(done), f.physical);
  assert.equal(done.bureaucratPayments?.used.length ?? 0, diverted ? 1 : 0);
  assert.equal(viewGame(done, f.trainer).bureaucrat.usedThisPhase, diverted === 2);
  if (f.kind === 'auction') {
    assert.deepEqual(player(done, f.payer).hand.map(c => c.id),
      [...player(f.beforeAction, f.payer).hand.map(c => c.id), f.card, f.beforeAction.deck[0].id]);
    assert.equal(done.auction!.index, f.beforeAction.auction!.index + 1);
    assert.equal(done.currentAuctionSale, null);
    assert.deepEqual(armies(done), armies(f.beforePledge));
    assert.deepEqual(done.homeworlds!.custody, f.beforePledge.homeworlds!.custody);
  } else {
    assert.equal(player(done, f.payer).reserves, player(f.beforePledge, f.payer).reserves - f.gross);
    assert.deepEqual(player(done, f.payer).forces,
      { ...player(f.beforePledge, f.payer).forces, [`${f.target}:${f.sector}`]: f.gross });
    assert.equal(player(done, f.payer).shipped, true);
    for (const actor of done.players.filter(p => p.id !== f.payer)) {
      assert.deepEqual(actor.forces, player(f.beforePledge, actor.id).forces);
      assert.equal(actor.reserves, player(f.beforePledge, actor.id).reserves);
    }
    assert.equal(done.phase, 5); assert.equal(done.active, f.payer);
    const moved = applyAction(done, f.payer, { type: 'endMovement' });
    assert.notEqual(moved.active, f.payer); assert.deepEqual(armies(moved), armies(done));
  }
  assertClassicHomeworldSkillsCustody(done);
}

for (const advanced of [false, true]) for (const kind of ['auction', 'shipment'] as const) {
  for (const [payerShare, donorShare] of [[5, 3], [3, 5], [5, 5], [0, 5]]) for (const redirect of [false, true]) {
    void test(`${advanced ? 'Advanced' : 'Basic'} Homeworld ${kind} ${payerShare}+${donorShare} ${redirect ? 'redirects two' : 'declines'} with full debits and original continuation`, () => {
      const f = fixture({ kind, advanced, payerShare, donorShare });
      assert.equal(bureaucratAlliedFundingModeSupported(f.game), true);
      assert.equal(player(f.alliance, f.payer).ally, f.donor);
      assert.equal(player(f.alliance, f.donor).ally, f.payer);
      assert.equal(player(f.beforeAction, f.donor).spice, player(f.beforePledge, f.donor).spice - donorShare);
      assert.deepEqual(armies(f.beforeAction), armies(f.beforePledge));
      const paid = pay(f), pending = allow(paid);
      assert.equal(pending.decision?.kind, 'bureaucratPayment'); assert.equal(pending.decision?.player, f.trainer);
      assert.equal(player(pending, f.payer).spice, player(f.beforePledge, f.payer).spice - payerShare);
      assert.equal(player(pending, f.donor).spice, player(f.beforePledge, f.donor).spice - donorShare);
      assert.equal(player(pending, f.payee).spice, player(f.beforePledge, f.payee).spice);
      assert.deepEqual(armies(pending), armies(paid));
      const done = allow(choose(pending, redirect)); outcome(f, done, redirect ? 2 : 0);
      reject(done, f.trainer, { type: 'decision', event: pending.bureaucratPaymentEvent, redirect: true });
    });
  }

  void test(`${advanced ? 'Advanced' : 'Basic'} Homeworld ${kind} cannot pool two sub-five contributions`, () => {
    const f = fixture({ kind, advanced, payerShare: 3, donorShare: 3 });
    const done = allow(pay(f)); assert.notEqual(done.decision?.kind, 'bureaucratPayment'); outcome(f, done, 0);
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} Homeworld ${kind} excludes trainer and payee without masking an eligible third party`, () => {
    for (const donor of kind === 'auction' ? ['atreides', 'emperor'] : ['atreides']) {
      const eligible = fixture({ kind, advanced, donor, payerShare: 5, donorShare: 5 });
      const pending = allow(pay(eligible)); assert.equal(pending.decision?.kind, 'bureaucratPayment');
      outcome(eligible, allow(choose(pending, true)), 2);
      const excluded = fixture({ kind, advanced, donor, payerShare: 3, donorShare: 5 });
      const done = allow(pay(excluded)); assert.notEqual(done.decision?.kind, 'bureaucratPayment'); outcome(excluded, done, 0);
    }
    if (kind === 'shipment') {
      // Guild alliance invokes the original half-price native transport. Its
      // contribution to its own income cannot qualify as a third-party payer.
      const f = fixture({ kind, advanced, donor: 'guild', payerShare: 5, donorShare: 5 });
      const done = allow(pay(f)); assert.notEqual(done.decision?.kind, 'bureaucratPayment');
      assert.equal(player(done, f.payer).spice, player(f.beforePledge, f.payer).spice);
      assert.equal(player(done, f.donor).spice, player(f.beforePledge, f.donor).spice - 5);
      assert.equal(player(done, f.payer).reserves, player(f.beforePledge, f.payer).reserves - 10);
      assert.equal(player(done, f.payer).forces[`${f.target}:${f.sector}`], 10);
      assert.equal(done.bureaucratPayments?.used.length ?? 0, 0);
      assert.notEqual(applyAction(done, f.payer, { type: 'endMovement' }).active, f.payer);
      assertClassicHomeworldSkillsCustody(done);
    }
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} Homeworld ${kind} publishes gross only, rejects stale/cross-actor choices, and supports all four owner bots`, () => {
    for (const [payerShare, donorShare] of [[5, 3], [3, 5]]) {
      const f = fixture({ kind, advanced, payerShare, donorShare }), pending = allow(pay(f));
      for (const viewer of pending.players) {
        const view = viewGame(pending, viewer.id), invoice = view.bureaucrat.pending!;
        assert.equal(invoice.payer, null); assert.equal(invoice.payee, f.payee); assert.equal(invoice.amount, 8);
        for (const field of ['contributions', 'shares', 'qualifyingPayer', 'signature', 'source', 'privateFunding'])
          assert.equal(field in invoice, false, `${field} is private funding evidence, not a public invoice`);
        assert.equal('bureaucratPayments' in view, false); assert.equal('bureaucratUseEvents' in view, false);
      }
      reject(pending, f.donor, { type: 'decision', event: pending.bureaucratPaymentEvent, redirect: true });
      reject(pending, f.trainer, { type: 'decision', event: 'expired-funding-event', redirect: true });
      reject(pending, f.payer, kind === 'shipment' ? { type: 'endMovement' } : f.action);
      reject(pending, f.donor, { type: 'pledgeAid', amount: 1 });
      for (const bot of DIFFICULTIES) {
        const view = viewGame(pending, f.trainer); view.players.find(p => p.id === f.trainer)!.bot = bot;
        const actions = botActions(view); assert.equal(actions.length, 1);
        outcome(f, allow(applyAction(pending, f.trainer, actions[0])), 2);
      }
    }
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} Homeworld ${kind} original Karama cancels gross after full payment, without an offer/use`, () => {
    const f = fixture({ kind, advanced, payerShare: 5, donorShare: 5 });
    const card = holdHomeworldFundingKarama(f), paid = pay(f);
    assert.equal(paid.response?.kind, kind === 'auction' ? 'emperorIncome' : 'guildIncome');
    assert.ok(viewGame(paid, f.trainer).responseControls?.cancelCards.includes(card));
    const done = allow(applyAction(paid, f.trainer, { type: 'card', mode: 'cancel', card }));
    assert.notEqual(done.decision?.kind, 'bureaucratPayment'); outcome(f, done, 0, true);
    assert.equal(done.discard.filter(c => c.id === card).length, 1);
    assert.ok(!player(done, f.trainer).hand.some(c => c.id === card));
    reject(done, f.trainer, { type: 'card', mode: 'cancel', card });
  });
}

for (const advanced of [false, true]) void test(`${advanced ? 'Advanced' : 'Basic'} Homeworld auction decline retains the physical use for the next genuine lot, redirect spends it only once`, () => {
  for (const redirect of [false, true]) {
    const f = fixture({ kind: 'auction', advanced, payerShare: 3, donorShare: 5 });
    const first = allow(choose(allow(pay(f)), redirect));
    const next = advanceHomeworldFunding(first, g => !!g.auction && g.auction.active === f.payer && homeworldFundingClean(g));
    const before = structuredClone(next), card = next.auction!.cards[next.auction!.index].id;
    const second = { ...f, game: next, action: { type: 'bid', amount: 5 } as Action };
    let done = allow(pay(second));
    if (redirect) {
      assert.notEqual(done.decision?.kind, 'bureaucratPayment');
      assert.equal(player(done, f.payee).spice, player(before, f.payee).spice + 5);
    } else {
      assert.equal(done.decision?.kind, 'bureaucratPayment');
      done = allow(choose(done, true));
      assert.equal(player(done, f.payee).spice, player(before, f.payee).spice + 3);
    }
    assert.equal(player(done, f.payer).spice, player(before, f.payer).spice - 5);
    assert.deepEqual(player(done, f.payer).hand.map(c => c.id),
      [...player(before, f.payer).hand.map(c => c.id), card, before.deck[0].id]);
    assert.equal(done.auction!.index, before.auction!.index + 1);
    assert.equal(done.bureaucratPayments!.used.length, 1);
    assert.deepEqual(homeworldFundingCards(done), f.physical);
    assert.deepEqual(armies(done), armies(before));
    assertClassicHomeworldSkillsCustody(done);
  }
});

for (const advanced of [false, true]) void test(`${advanced ? 'Advanced' : 'Basic'} Homeworld physical use is once per phase; decline does not spend it and next phase renews it`, () => {
  for (const redirect of [false, true]) {
    const f = fixture({ kind: 'shipment', advanced, payerShare: 3, donorShare: 5 });
    const pending = allow(pay(f)), settled = allow(choose(pending, redirect));
    const following = applyAction(settled, f.payer, { type: 'bribe', target: 'guild', amount: 5 });
    let used: Game;
    if (redirect) {
      assert.notEqual(following.decision?.kind, 'bureaucratPayment');
      assert.equal(player(following, 'guild').bribes, player(settled, 'guild').bribes + 5); used = following;
    } else {
      assert.equal(following.decision?.kind, 'bureaucratPayment');
      reject(following, f.trainer, { type: 'decision', event: pending.bureaucratPaymentEvent, redirect: true });
      used = allow(choose(following, true));
      assert.equal(player(used, 'guild').bribes, player(settled, 'guild').bribes + 3);
    }
    assert.equal(used.bureaucratPayments!.used.length, 1);
    const ended = applyAction(used, f.payer, { type: 'endMovement' });
    const next = advanceHomeworldFunding(ended, g => g.turn === 3 && g.phase === 1 && homeworldFundingClean(g));
    assert.equal(viewGame(next, f.trainer).bureaucrat.usedThisPhase, false);
    // The Guild's actual shipment receipts fund a later genuine third-party bribe.
    const renewed = allow(choose(applyAction(next, 'guild', { type: 'bribe', target: 'emperor', amount: 5 }), true));
    assert.equal(renewed.bureaucratPayments!.used.length, 2);
    assert.deepEqual(renewed.bureaucratPayments!.used.map(use => [use.turn, use.phase]), [[2, 5], [3, 1]]);
    assert.equal(viewGame(renewed, f.trainer).bureaucrat.usedThisPhase, true);
    assertClassicHomeworldSkillsCustody(renewed);
  }
});

void test('occupied-percentage entry remains explicitly fenced from an actual trained Homeworld Bureaucrat game', () => {
  const f = fixture({ kind: 'shipment' });
  assert.equal(f.game.homeworldOccupationPreview, undefined);
  assert.throws(() => initializeHomeworldOccupationGameForAudit(f.game),
    { message: 'Occupation requires a fresh Homeworld lobby with original selected faction decks and no other modules.' });
  // Negative malformed-save input only: never claimed as a reachable occupation
  // fixture. No wallet, army, occupation history or skill custody is fabricated.
  const rejectedSave = structuredClone(f.game); rejectedSave.homeworldOccupationPreview = true;
  const before = structuredClone(rejectedSave);
  assert.throws(() => applyAction(rejectedSave, f.payer, f.action),
    { message: 'The fresh occupation profile lost its original Homeworld module or income ledger.' });
  assert.deepEqual(rejectedSave, before);
});
