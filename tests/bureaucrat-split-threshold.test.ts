import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game } from '../game/engine';
import { nextClassicNexusSkillsPaymentsNativeStep } from './fixture-classic-nexus-skills-payments';
import { createBureaucratSplitThresholdFixture, advanceBureaucratThresholdToMovement } from './fixture-bureaucrat-split-threshold';

function settle(state: Game): Game {
  let game = state;
  for (let n = 0; (game.response || game.decision) && n < 40; n++) {
    const next = nextClassicNexusSkillsPaymentsNativeStep(game);
    assert.ok(next);
    game = applyAction(game, next.actor, next.action);
  }
  assert.ok(!game.response && !game.decision);
  return game;
}
const player = (game: Game, id: string) => game.players.find(p => p.id === id)!;

for (const advanced of [false, true]) {
  for (const personal of [3, 4]) void test(`${advanced ? 'Advanced' : 'Basic'} shipment preserves ${personal}+3 allied payments below Bureaucrat’s individual threshold`, () => {
    const f = createBureaucratSplitThresholdFixture(advanced);
    let game = advanceBureaucratThresholdToMovement(f.game, f.payer);
    const before = structuredClone(game);
    game = applyAction(game, f.donor, { type: 'pledgeAid', amount: 3 });
    const amount = personal + 3, key = 'habbanya_ridge_sietch:17';
    const paid = settle(applyAction(game, f.payer, {
      type: 'ship', territory: 'habbanya_ridge_sietch', sector: 17, amount, allyPayment: 3,
    }));
    assert.equal(player(paid, f.payer).spice, player(before, f.payer).spice - personal);
    assert.equal(player(paid, f.donor).spice, player(before, f.donor).spice - 3);
    assert.equal(player(paid, f.guild).spice, player(before, f.guild).spice + amount);
    assert.equal(player(paid, f.trainer).spice, player(before, f.trainer).spice);
    assert.equal(player(paid, f.payer).forces[key], amount);
    assert.equal(player(paid, f.payer).reserves, player(before, f.payer).reserves - amount);
    assert.equal(paid.aid[f.donor]?.amount ?? 0, 0);
    assert.equal(viewGame(paid, f.trainer).bureaucrat.usedThisPhase, false);
    assert.throws(() => applyAction(paid, f.payer, {
      type: 'ship', territory: 'habbanya_ridge_sietch', sector: 17, amount, allyPayment: 3,
    }));
    const finished = applyAction(paid, f.payer, { type: 'endMovement' });
    assert.ok(!finished.movementRemaining?.includes(f.payer));
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} auction preserves separate three-spice payer costs and full Emperor income`, () => {
    const f = createBureaucratSplitThresholdFixture(advanced);
    let game = f.game;
    while (game.auction!.active !== f.payer) {
      const next = nextClassicNexusSkillsPaymentsNativeStep(game); assert.ok(next);
      game = applyAction(game, next.actor, next.action);
    }
    const card = game.auction!.cards[game.auction!.index].id;
    const before = structuredClone(game);
    game = applyAction(game, f.donor, { type: 'pledgeAid', amount: 3 });
    game = applyAction(game, f.payer, { type: 'bid', amount: 6, allyPayment: 3 });
    for (let n = 0; !player(game, f.payer).hand.some(c => c.id === card) && n < 40; n++) {
      const next = nextClassicNexusSkillsPaymentsNativeStep(game); assert.ok(next);
      game = applyAction(game, next.actor, next.action);
    }
    const paid = settle(game);
    assert.ok(player(paid, f.payer).hand.some(c => c.id === card));
    assert.equal(player(paid, f.payer).spice, player(before, f.payer).spice - 3);
    assert.equal(player(paid, f.donor).spice, player(before, f.donor).spice - 3);
    assert.equal(player(paid, f.emperor).spice, player(before, f.emperor).spice + 6);
    assert.equal(player(paid, f.trainer).spice, player(before, f.trainer).spice);
    assert.equal(viewGame(paid, f.trainer).bureaucrat.usedThisPhase, false);
    assert.equal(paid.auction!.index, before.auction!.index + 1);
    assert.ok(!paid.auction!.cards.slice(paid.auction!.index).some(c => c.id === card));
  });

  void test(`${advanced ? 'Advanced' : 'Basic'} an individual five-spice contribution retains the unresolved mixed-payment guard`, () => {
    const f = createBureaucratSplitThresholdFixture(advanced);
    let game = advanceBureaucratThresholdToMovement(f.game, f.payer);
    game = applyAction(game, f.donor, { type: 'pledgeAid', amount: 3 });
    const before = structuredClone(game);
    assert.throws(() => applyAction(game, f.payer, {
      type: 'ship', territory: 'habbanya_ridge_sietch', sector: 17, amount: 8, allyPayment: 3,
    }));
    assert.deepEqual(game, before, 'No payer, escrow or physical force changes on the unsupported qualifying split');
  });
}
