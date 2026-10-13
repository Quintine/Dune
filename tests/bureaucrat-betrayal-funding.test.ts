import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, normalizeAutomaticGame, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { bureaucratAlliedFundingModeSupported, bureaucratPaymentModeSupported, bureaucratPaymentSignature } from '../game/bureaucrat-payment';
import { guildBetrayalNexusLeaderSkillsProfile } from '../game/leader-skill-profile';
import { validateLeaderSkills } from '../game/leader-skills';
import { validateNexusCards } from '../game/nexus-cards';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { createGuildBetrayalFixture } from './fixture-nexus-guild-betrayal';
import {
  betrayalFundingSeat as seat, chooseBetrayalFunding, createBureaucratBetrayalFundingFixture,
  settleBetrayalFunding, useBetrayalFunding, type BureaucratBetrayalFundingFixture,
} from './fixture-bureaucrat-betrayal-funding';

function physicalShipment(game: Game) {
  return { forces: game.players.map(p => ({ id: p.id, forces: p.forces, reserves: p.reserves,
    tanks: p.tanks, elites: p.elites, advisors: p.advisors, shipped: p.shipped, moved: p.moved })),
    phase: game.phase, active: game.active, remaining: game.movementRemaining };
}

/** The Bank has no wallet field: its exact net receipt is the decrease in all
 * player-controlled spice, including deferred bribes and actual aid escrow. */
function playerControlledSpice(game: Game): number {
  return game.players.reduce((total, p) => total + p.spice + p.bribes, 0) +
    Object.values(game.aid).reduce((total, aid) => total + aid.amount, 0);
}

function rejectUnchanged(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'A rejected choice must not mutate any saved resource or continuation.');
}

function proveReceipt(f: BureaucratBetrayalFundingFixture, done: Game, diverted: number): void {
  const invoice = f.game.pendingGuildBetrayal!.invoice;
  assert.equal(invoice.price, f.primary + f.donorAmount);
  assert.equal(invoice.ownPayment, f.primary);
  assert.equal(invoice.allyPayment, f.donorAmount);
  for (const p of done.players) {
    assert.equal(p.spice, seat(f.beforePledge, p.id).spice -
      (p.id === f.shipper ? f.primary : 0) - (p.id === f.donor ? f.donorAmount : 0) +
      (p.id === f.holder ? f.price - diverted : 0), `Exactly the original debit/receipt for ${p.id}`);
    assert.equal(p.bribes, seat(f.beforePledge, p.id).bribes);
  }
  if (f.donor) {
    assert.equal(seat(f.before, f.donor).spice, seat(f.beforePledge, f.donor).spice - f.donorAmount);
    assert.equal(f.before.aid[f.donor].amount, f.donorAmount);
    assert.equal(done.aid[f.donor].amount, 0, 'The native donor escrow is consumed once, without a second wallet debit.');
  }
  assert.equal(playerControlledSpice(f.before) - playerControlledSpice(done), diverted,
    'Only the ruled diversion leaves player custody for the implicit Spice Bank.');
  assert.deepEqual(physicalShipment(done), physicalShipment(f.original), 'The original native shipment suffix runs once.');
  const destination = `${String(f.declaration.territory)}:${Number(f.declaration.sector)}`;
  assert.equal(seat(done, f.shipper).reserves, seat(f.before, f.shipper).reserves - f.price);
  assert.equal(seat(done, f.shipper).forces[destination], (seat(f.before, f.shipper).forces[destination] ?? 0) + f.price);
  assert.equal(seat(done, f.shipper).shipped, true);
  assert.equal(done.pendingGuildBetrayal, null);
  assert.equal(done.guildBetrayal!.status, 'completed');
  assert.equal(done.nexusGuildBetrayalHistory!.length, f.before.nexusGuildBetrayalHistory!.length + 1);
  assert.equal(done.guildBetrayalSourceReceipts!.length, f.before.guildBetrayalSourceReceipts!.length + 1);
  const receipt = done.nexusGuildBetrayalHistory!.at(-1)!;
  assert.deepEqual(receipt.invoice, invoice, 'Bureaucrat does not rewrite the gross invoice or its original funding.');
  assert.equal(receipt.recipient, f.holder);
  assert.equal(receipt.mode, 'betrayal');
  assert.equal(receipt.nexusDiscardIndex, f.before.nexusCards!.cards!.discard.length);
  assert.equal(done.guildBetrayalSourceReceipts!.at(-1)!.receipt, receipt.sourceReceipt);
  assert.equal(done.nexusCards!.cards!.hands[f.holder], null);
  assert.deepEqual(done.nexusCards!.cards!.discard, [...f.before.nexusCards!.cards!.discard, 'guild']);
  validateNexusCards(done.nexusCards!.cards!, done.players);
  assert.equal(done.bureaucratPayments?.pending, undefined);
  rejectUnchanged(done, f.holder, { type: 'guildBetrayalUse', event: f.event });
  rejectUnchanged(done, f.shipper, f.declaration);
  const ended = applyAction(done, f.shipper, { type: 'endMovement' });
  assert.notEqual(ended.active, f.shipper);
  assert.deepEqual(ended.nexusGuildBetrayalHistory, done.nexusGuildBetrayalHistory);
  assert.deepEqual(ended.guildBetrayalSourceReceipts, done.guildBetrayalSourceReceipts);
  assert.deepEqual(ended.players.map(p => p.forces), done.players.map(p => p.forces));
  rejectUnchanged(ended, f.shipper, { type: 'endMovement' });
}

void test('Fresh native Guild classic setup genuinely trains its distinct Bureaucrat and preserves all14 custody', () => {
  const f = createBureaucratBetrayalFundingFixture({ donorAmount: 3 });
  assert.equal(f.initial.status, 'setup');
  assert.equal(f.initial.leaderSkills!.assignments.length, 0);
  assert.equal(f.trained.status, 'setup');
  assert.equal(f.trained.leaderSkills!.assignments.find(a => a.skill === 'bureaucrat')?.owner, f.trainer);
  assert.ok(![f.shipper, f.holder, f.guild, f.donor].includes(f.trainer));
  validateLeaderSkills(f.trained.leaderSkills!, f.trained.players);
  const skills = f.trained.leaderSkills!;
  assert.deepEqual([...skills.deck, ...Object.values(skills.offers).flatMap(o => o.cards), ...skills.assignments.map(a => a.skill)].sort(),
    LEADER_SKILL_CARDS.map(c => c.id).sort());
  assert.equal(guildBetrayalNexusLeaderSkillsProfile(f.game), true);
  assert.equal(bureaucratPaymentModeSupported(f.game), true);
  assert.equal(bureaucratAlliedFundingModeSupported(f.game), true);
});

for (const advanced of [false, true]) {
  for (const [primary, donorAmount] of [[5, 0], [5, 3], [3, 5], [5, 5], [0, 5]]) {
    for (const redirect of [false, true]) {
      void test(`${advanced ? 'Advanced' : 'Basic'} Betrayal ${primary}+${donorAmount}: ${redirect ? 'holder gross minus two; Bank two' : 'holder retains gross'}`, () => {
        const f = createBureaucratBetrayalFundingFixture({ advanced, primary, donorAmount });
        const pending = useBetrayalFunding(f);
        assert.equal(pending.decision?.kind, 'bureaucratPayment');
        assert.equal(pending.decision?.player, f.trainer);
        assert.equal(seat(pending, f.holder).spice, seat(f.before, f.holder).spice + f.price);
        assert.deepEqual(physicalShipment(pending), physicalShipment(f.original));
        const source = pending.bureaucratPayments!.pending!.source;
        assert.equal(source.kind, 'shipment');
        assert.equal(source.payee, f.holder);
        assert.equal(source.amount, f.price);
        assert.equal(source.payer, primary >= 5 ? f.shipper : f.donor);
        if (f.donor) assert.deepEqual(source.contributions, [
          ...(primary ? [{ payer: f.shipper, amount: primary }] : []), { payer: f.donor, amount: donorAmount },
        ]);
        const done = settleBetrayalFunding(chooseBetrayalFunding(pending, redirect));
        proveReceipt(f, done, redirect ? 2 : 0);
        assert.deepEqual(done.nexusGuildBetrayalHistory, pending.nexusGuildBetrayalHistory);
        assert.deepEqual(done.guildBetrayalSourceReceipts, pending.guildBetrayalSourceReceipts);
        assert.deepEqual(done.nexusCards!.cards, pending.nexusCards!.cards);
        assert.equal(viewGame(done, f.trainer).bureaucrat.usedThisPhase, redirect);
        assert.equal(done.bureaucratPayments?.used.length ?? 0, redirect ? 1 : 0);
        rejectUnchanged(done, f.trainer, { type: 'decision', event: pending.bureaucratPaymentEvent, redirect: true });
      });
    }
  }

  for (const options of [{ own: true }, { primary: 3, donorAmount: 3 }, { alreadyUsed: true }]) {
    void test(`${advanced ? 'Advanced' : 'Basic'} Betrayal no offer ${JSON.stringify(options)}`, () => {
      const f = createBureaucratBetrayalFundingFixture({ advanced, ...options });
      const taken = useBetrayalFunding(f);
      assert.notEqual(taken.decision?.kind, 'bureaucratPayment');
      assert.equal(taken.bureaucratPayments?.pending, undefined);
      proveReceipt(f, settleBetrayalFunding(taken), 0);
      assert.equal(viewGame(taken, f.trainer).bureaucrat.usedThisPhase, 'alreadyUsed' in options);
      if ('own' in options) assert.equal(f.holder, f.shipper);
      if ('donorAmount' in options) {
        assert.ok(f.price >= 5);
        assert.ok(f.primary < 5 && f.donorAmount < 5, 'Gross never pools sub-five native legs.');
      }
    });
  }

  void test(`${advanced ? 'Advanced' : 'Basic'} private receipt hides which native leg qualifies`, () => {
    const primary = createBureaucratBetrayalFundingFixture({ advanced, primary: 5, donorAmount: 3 });
    const donor = createBureaucratBetrayalFundingFixture({ advanced, primary: 3, donorAmount: 5 });
    const left = useBetrayalFunding(primary), right = useBetrayalFunding(donor);
    for (const viewer of left.players) {
      const a = viewGame(left, viewer.id), b = viewGame(right, viewer.id);
      for (const projected of [a, b]) {
        const prompt = projected.bureaucrat.pending!;
        assert.equal(prompt.payer, null);
        assert.equal(prompt.payee, primary.holder);
        assert.equal(prompt.amount, 8);
        assert.equal(prompt.owner, primary.trainer);
        assert.equal(prompt.kind, 'shipment');
        assert.equal(prompt.redirect, 2);
        assert.equal('contributions' in prompt, false);
        assert.equal('signature' in prompt, false);
        assert.equal('bureaucratPayments' in projected, false);
        assert.equal('bureaucratUseEvents' in projected, false);
      }
    }
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} stale, cross-actor and malformed continuation choices reject immutably`, () => {
    const f = createBureaucratBetrayalFundingFixture({ advanced, primary: 3, donorAmount: 5 });
    const pending = useBetrayalFunding(f);
    const choice: Action = { type: 'decision', event: pending.bureaucratPaymentEvent, redirect: true };
    for (const actor of pending.players.filter(p => p.id !== f.trainer)) rejectUnchanged(pending, actor.id, choice);
    rejectUnchanged(pending, f.trainer, { ...choice, event: f.event });
    rejectUnchanged(pending, f.trainer, { ...choice, event: 'stale-payment' });
    rejectUnchanged(pending, f.trainer, { ...choice, redirect: 'yes' });
    rejectUnchanged(pending, f.trainer, { ...choice, amount: f.price });
    rejectUnchanged(pending, f.shipper, { type: 'endMovement' });
    rejectUnchanged(pending, f.holder, { type: 'guildBetrayalUse', event: f.event });
    for (const field of ['event', 'recipient', 'amount', 'kind']) {
      const malformed = structuredClone(pending);
      const frame = malformed.bureaucratPayments!.pending!;
      assert.equal(frame.continuation.kind, 'guildBetrayal');
      Object.assign(frame.continuation, { [field]: field === 'amount' ? f.price + 1 : field === 'recipient' ? f.guild : 'foreign' });
      // Re-sign the outer frame to exercise the native receipt/continuation link,
      // not merely the generic changed-signature check.
      frame.signature = bureaucratPaymentSignature(frame);
      const saved = structuredClone(malformed);
      assert.throws(() => viewGame(malformed, f.trainer));
      assert.throws(() => normalizeAutomaticGame(malformed));
      rejectUnchanged(malformed, f.trainer, choice);
      assert.deepEqual(malformed, saved);
    }
    proveReceipt(f, settleBetrayalFunding(chooseBetrayalFunding(pending, true)), 2);
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} all four minimal owner bots legally resolve the original Betrayal receipt`, () => {
    const f = createBureaucratBetrayalFundingFixture({ advanced, primary: 3, donorAmount: 5 });
    const pending = useBetrayalFunding(f);
    assert.equal(DIFFICULTIES.length, 4);
    for (const difficulty of DIFFICULTIES) {
      const view = viewGame(pending, f.trainer);
      view.players.find(p => p.id === f.trainer)!.bot = difficulty;
      const choices = botActions(view);
      assert.equal(choices.length, 1);
      const done = settleBetrayalFunding(applyAction(pending, f.trainer, choices[0]));
      proveReceipt(f, done, 2);
      assert.equal(viewGame(done, f.trainer).bureaucrat.usedThisPhase, true);
      rejectUnchanged(done, f.trainer, choices[0]);
    }
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} native no-skills Betrayal still credits its entire funded invoice without an offer`, () => {
    const f = createGuildBetrayalFixture({ advanced, allyPayment: 1 });
    const taken = applyAction(f.game, f.holder, { type: 'guildBetrayalUse', event: f.event });
    assert.notEqual(taken.decision?.kind, 'bureaucratPayment');
    assert.equal(taken.bureaucratPayments?.pending, undefined);
    const done = settleBetrayalFunding(taken);
    assert.equal(seat(done, f.holder).spice, seat(f.before, f.holder).spice + f.price);
    assert.equal(seat(done, f.shipper).spice, seat(f.before, f.shipper).spice - f.game.pendingGuildBetrayal!.invoice.ownPayment);
    assert.equal(seat(done, f.donor!).spice, seat(f.before, f.donor!).spice);
    assert.equal(done.aid[f.donor!].amount, 0);
    assert.equal(playerControlledSpice(done), playerControlledSpice(f.before));
    assert.deepEqual(physicalShipment(done), physicalShipment(f.original));
    assert.deepEqual(done.nexusGuildBetrayalHistory!.at(-1)!.invoice, f.game.pendingGuildBetrayal!.invoice);
    assert.equal(done.nexusGuildBetrayalHistory!.at(-1)!.recipient, f.holder);
    assert.deepEqual(done.nexusCards!.cards!.discard, [...f.before.nexusCards!.cards!.discard, 'guild']);
    rejectUnchanged(done, f.holder, { type: 'guildBetrayalUse', event: f.event });
  });
}
