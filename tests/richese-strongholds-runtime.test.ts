import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { territory } from '../game/board';
import { treacheryDeck } from '../game/cards';
import { presenceAt } from '../game/force-presence';
import { strongholdControllers } from '../game/stronghold-cards';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { quoteStrongholdFactionsBattle } from './fixture-stronghold-factions';
import { createRicheseStrongholdsFixture, finishRicheseStrongholdsBattle, nextRicheseStrongholdsNativeStep, revealRicheseStrongholdsBattle, richeseStrongholdsPlayer, type RicheseStrongholdsFixture } from './fixture-richese-strongholds';

function chooseStone(fixture: RicheseStrongholdsFixture, mode: 'kill' | 'ignore') {
  const game = revealRicheseStrongholdsBattle(fixture);
  assert.equal(game.decision?.kind, 'stoneBurner');
  assert.equal(game.decision?.player, fixture.richese);
  return applyAction(game, fixture.richese, { type: 'decision', event: game.battle!.event, mode });
}
/** Actual native settlement, independently accounting for later Collection. */
function settle(fixture: RicheseStrongholdsFixture, revealed: Game, callers: string[] = []) {
  // Calls are declared on the real battle before deriving the independent quote.
  let voted = revealed;
  while (voted.battle?.revealed && !voted.decision && !voted.response) {
    const next = nextRicheseStrongholdsNativeStep(voted);
    if (!next || next.action.type !== 'traitorCall') break;
    const remaining = viewGame(voted, voted.host).battle!.traitorVoters.filter(id => voted.battle!.traitorCalls[id] === undefined);
    if (remaining.length === 1) break;
    next.action.call = callers.includes(next.actor);
    voted = applyAction(voted, next.actor, next.action);
  }
  // The last vote resolves immediately, so quote the still-live original source
  // with exactly those public calls; never alter the engine's actual source.
  const quoted = structuredClone(voted);
  for (const actor of viewGame(quoted, quoted.host).battle!.traitorVoters) quoted.battle!.traitorCalls[actor] = callers.includes(actor);
  const quote = quoteStrongholdFactionsBattle(quoted);
  const resolved = finishRicheseStrongholdsBattle(fixture, voted, callers);
  const collection = resolved.phase === 7 && !resolved.phaseOpening
    ? quoteSpiceCollection({ ...resolved, players: resolved.players.map(p => ({ ...p, spice: 0 })) }).receipts
    : [];
  for (const player of voted.players) {
    const payment = quote.payments.find(p => p.player === player.id)?.ownPayment ?? 0;
    const income = quote.strongholdIncome.filter(p => p.player === player.id).reduce((sum, p) => sum + p.amount, 0);
    const bounty = quote.bounty?.player === player.id ? quote.bounty.amount : 0;
    const choam = quote.choamIncome?.owner === player.id ? quote.choamIncome.amount : 0;
    const collected = collection.filter(p => p.player === player.id).reduce((sum, p) => sum + p.strongholds + p.collected, 0);
    assert.equal(richeseStrongholdsPlayer(resolved, player.id).spice, player.spice - payment + income + bounty + choam + collected, player.faction);
  }
  assert.equal(resolved.lastBattleContext?.winner, quote.winner);
  return { resolved, quote };
}

void test('genuine E2 Richese setup supplies the separate cache, one-force shipment and first END Mentat control even for zero', () => {
  for (const noFieldValue of [0, 3, 5] as const) {
    const fixture = createRicheseStrongholdsFixture({ noFieldValue });
    assert.equal(treacheryDeck(fixture.initial.expansions).length, 35);
    assert.equal(fixture.initial.deck.length, 35);
    assert.equal(fixture.initial.richeseCache!.length, 10);
    assert.equal(fixture.afterSetup.players.find(p => p.faction === 'richese')!.noField!.tokens.length, 3);
    const before = richeseStrongholdsPlayer(fixture.beforeShipment, fixture.richese);
    const shipped = richeseStrongholdsPlayer(fixture.afterShipment, fixture.richese);
    assert.equal(shipped.spice, before.spice - 1, 'actual marker shipment pays one stronghold-force price');
    assert.equal(shipped.reserves, before.reserves, 'shipment does not yet transfer physical reserves');
    assert.equal(presenceAt(shipped, fixture.kind), 1);
    assert.equal(strongholdControllers(fixture.beforeFirstMentat.players, false)[fixture.kind], fixture.richese);
    assert.equal(fixture.beforeFirstMentat.strongholdCards!.owners[fixture.kind], null);
    const ended = applyAction(fixture.beforeFirstMentat, fixture.firstMentatStep.actor, fixture.firstMentatStep.action);
    assert.equal(ended.turn, 2);
    assert.equal(ended.strongholdCards!.owners[fixture.kind], fixture.richese);
    assert.equal(fixture.afterFirstMentat.strongholdCards!.claimedTurn, 1);
  }
});

void test('original undealt CLI initializer continues without redealing, and native unbid-cache acquisition really supplies Stone', () => {
  const original = createRicheseStrongholdsFixture().initial;
  const before = structuredClone(original);
  const fixture = createRicheseStrongholdsFixture({ initial: original, stone: true });
  assert.deepEqual(original, before);
  assert.deepEqual(fixture.initial, before);
  const acquisition = fixture.acquisition!;
  assert.ok(acquisition.before.richeseCache!.some(c => c.id === 'richese-stone-burner'));
  assert.equal(acquisition.before.players.some(p => p.hand.some(c => c.id === 'richese-stone-burner')), false);
  let game = acquisition.before;
  for (let count = 0; !richeseStrongholdsPlayer(game, fixture.richese).hand.some(card => card.id === 'richese-stone-burner') && count < 100; count++) {
    const next = nextRicheseStrongholdsNativeStep(game); assert.ok(next);
    game = applyAction(game, next.actor, next.action);
  }
  for (const player of acquisition.before.players) {
    assert.equal(richeseStrongholdsPlayer(game, player.id).spice, player.spice, 'unbid acquisition has no original purchase charge');
  }
  assert.deepEqual(richeseStrongholdsPlayer(game, fixture.richese).hand.map(card => card.id).sort(),
    [...richeseStrongholdsPlayer(acquisition.before, fixture.richese).hand.map(card => card.id), 'richese-stone-burner'].sort());
  assert.ok(richeseStrongholdsPlayer(game, fixture.richese).hand.some(c => c.id === 'richese-stone-burner'));
  assert.equal(game.richeseCache!.some(c => c.id === 'richese-stone-burner'), false);
});

void test('actual voluntary reveal removes zero presence or materializes 3/5 up to reserves, never exceeding the native twenty-counter pool', () => {
  for (const noFieldValue of [0, 3, 5] as const) {
    const fixture = createRicheseStrongholdsFixture({ noFieldValue, reserves: 2 });
    const before = fixture.beforeReveal;
    const revealed = applyAction(before, fixture.revealStep.actor, fixture.revealStep.action);
    const player = richeseStrongholdsPlayer(revealed, fixture.richese);
    assert.equal(player.forces[`${fixture.kind}:${territory(fixture.kind).sectors[0]}`] ?? 0, Math.min(2, noFieldValue));
    assert.equal(player.reserves, 2 - Math.min(2, noFieldValue));
    assert.equal(player.reserves + player.tanks + Object.values(player.forces).reduce((sum, n) => sum + n, 0), 20);
    assert.equal(presenceAt(player, fixture.kind), Math.min(2, noFieldValue));
    assert.equal(player.noField!.deployed, null);
    assert.equal(revealed.strongholdCards!.owners[fixture.kind], fixture.richese, 'losing physical control does not reassign the retained card before END Mentat');
  }
});

void test('native marker-only plans use the reserve-limited private pool, reveal 0/3/5 only after both plans, and preserve supported costs', () => {
  for (const noFieldValue of [0, 3, 5] as const) {
    const fixture = createRicheseStrongholdsFixture({ noFieldValue, ownerDial: noFieldValue ? 1 : 0, support: noFieldValue ? 1 : 0 });
    const own = viewGame(fixture.game, fixture.richese).battle!;
    assert.equal(own.ownForces!.normal, noFieldValue);
    assert.ok(own.ownForces!.normal <= 20);
    assert.equal(own.strongholdEffects[fixture.richese], fixture.kind);
    const sealed = applyAction(fixture.game, fixture.richese, fixture.planActions[0].action);
    assert.ok(richeseStrongholdsPlayer(sealed, fixture.richese).noField!.deployed);
    assert.equal(richeseStrongholdsPlayer(sealed, fixture.richese).forces[`${fixture.kind}:${territory(fixture.kind).sectors[0]}`], undefined);
    const revealed = revealRicheseStrongholdsBattle(fixture);
    assert.equal(richeseStrongholdsPlayer(revealed, fixture.richese).noField!.deployed, null);
    assert.equal(richeseStrongholdsPlayer(revealed, fixture.richese).forces[`${fixture.kind}:${territory(fixture.kind).sectors[0]}`] ?? 0, noFieldValue);
    const { resolved, quote } = settle(fixture, revealed);
    assert.equal(quote.winner, fixture.richese, 'printed Habbanya advantage applies to the zero-plan tie as well as ordinary supported victory');
    assert.equal(quote.payments.find(p => p.player === fixture.richese)!.ownPayment, noFieldValue ? 1 : 0);
    assert.equal(richeseStrongholdsPlayer(resolved, fixture.opponent).tanks, 6);
    assert.equal(richeseStrongholdsPlayer(resolved, fixture.richese).tanks, noFieldValue ? 1 : 0);
  }
});

void test('Arrakeen allowance funds real supported marker battle costs without creating spendable spice', () => {
  const fixture = createRicheseStrongholdsFixture({ kind: 'arrakeen', noFieldValue: 5, ownerDial: 3, support: 3 });
  const revealed = revealRicheseStrongholdsBattle(fixture);
  assert.equal(richeseStrongholdsPlayer(revealed, fixture.richese).spice, 20, 'sealing a subsidized plan does not credit its wallet');
  const { quote, resolved } = settle(fixture, revealed);
  const payment = quote.payments.find(p => p.player === fixture.richese)!;
  assert.equal(payment.bankSupport, 2);
  assert.equal(payment.ownPayment, 1);
  assert.equal(quote.choamIncome!.amount, 1);
  assert.equal(richeseStrongholdsPlayer(resolved, fixture.richese).forces['arrakeen:10'], 2);
});

void test('real cache-acquired Stone uses Habbanya undialed ties in both revealed modes, with declared support, native deaths and ordinary retention', () => {
  for (const mode of ['kill', 'ignore'] as const) {
    const fixture = createRicheseStrongholdsFixture({ stone: true, ownerDial: 2, opponentDial: 2, support: 2, opponentSupport: 2 });
    const chosen = chooseStone(fixture, mode);
    const { resolved, quote } = settle(fixture, chosen);
    assert.equal(quote.winner, fixture.richese);
    assert.deepEqual(quote.stone!.attacker, [4]);
    assert.deepEqual(quote.stone!.defender, [4]);
    assert.equal(richeseStrongholdsPlayer(resolved, fixture.richese).forces[`${fixture.kind}:${territory(fixture.kind).sectors[0]}`], 4);
    for (const plan of fixture.planActions) {
      assert.equal(richeseStrongholdsPlayer(resolved, plan.actor).leaders.find(l => l.id === plan.action.leader)!.dead, mode === 'kill');
      assert.equal(quote.payments.find(p => p.player === plan.actor)!.cost, 2);
    }
    assert.equal(quote.choamIncome!.amount, 2, 'actual four-spice battle support produces native CHOAM income');
    assert.ok(richeseStrongholdsPlayer(resolved, fixture.richese).hand.some(c => c.id === 'richese-stone-burner'));
  }
  const loser = createRicheseStrongholdsFixture({ stone: true, ownerDial: 3, support: 3, opponentDial: 1, opponentSupport: 1 });
  const lost = settle(loser, chooseStone(loser, 'ignore'));
  assert.equal(lost.quote.winner, loser.opponent, 'Habbanya does not override unequal undialed forces');
  assert.ok(lost.resolved.discard.some(c => c.id === 'richese-stone-burner'));
});

void test('native traitor and explosion precedence outrank real Stone plus Habbanya; successful traitor waives declared support', () => {
  const traitor = createRicheseStrongholdsFixture({ stone: true, traitors: 'owner', ownerDial: 2, support: 2 });
  const called = settle(traitor, chooseStone(traitor, 'kill'), [traitor.richese]);
  assert.equal(called.quote.winner, traitor.richese);
  assert.equal(called.quote.payments.find(p => p.player === traitor.richese)!.freeByTraitor, true);
  assert.equal(richeseStrongholdsPlayer(called.resolved, traitor.richese).leaders.find(l => l.id === traitor.planActions[0].action.leader)!.dead, false);
  const mutual = createRicheseStrongholdsFixture({ stone: true, traitors: 'both' });
  assert.equal(settle(mutual, chooseStone(mutual, 'kill'), [mutual.richese, mutual.opponent]).quote.winner, null);
  const explosion = createRicheseStrongholdsFixture({ stone: true, ownerDefense: 'shield', opponentWeapon: 'lasgun', ownerDial: 1, support: 1, opponentDial: 1, opponentSupport: 1 });
  const exploded = settle(explosion, chooseStone(explosion, 'kill'));
  assert.equal(exploded.quote.explosion, true);
  assert.equal(exploded.quote.winner, null);
  assert.equal(exploded.quote.bounty, null);
  assert.equal(richeseStrongholdsPlayer(exploded.resolved, explosion.richese).tanks, 6);
  assert.equal(richeseStrongholdsPlayer(exploded.resolved, explosion.opponent).tanks, 6);
});

void test('all four existing policies legally consume real Richese marker plans, Stone admission and both-mode choice views', () => {
  const marker = createRicheseStrongholdsFixture({ noFieldValue: 3, kind: 'arrakeen' });
  const stone = createRicheseStrongholdsFixture({ stone: true, ownerDial: 1, support: 1, opponentDial: 1, opponentSupport: 1 });
  for (const difficulty of DIFFICULTIES) {
    for (const fixture of [marker, stone]) {
      let game = structuredClone(fixture.game);
      for (const actor of [fixture.richese, fixture.opponent]) {
        const view = viewGame(game, actor); view.players.find(p => p.id === actor)!.bot = difficulty;
        const plan = botActions(view).find(action => action.type === 'battlePlan'); assert.ok(plan, difficulty);
        game = applyAction(game, actor, plan);
        while (game.response || game.decision?.kind === 'fullPlanOffer') {
          const next = nextRicheseStrongholdsNativeStep(game); assert.ok(next);
          game = applyAction(game, next.actor, next.action);
        }
      }
      while (game.decision || game.response) {
        const next = nextRicheseStrongholdsNativeStep(game); assert.ok(next);
        game = applyAction(game, next.actor, next.action);
      }
      settle(fixture, game);
    }
    const game = revealRicheseStrongholdsBattle(stone);
    const view = viewGame(game, stone.richese); view.players.find(p => p.id === stone.richese)!.bot = difficulty;
    const mode = botActions(view)[0];
    assert.ok(mode.mode === 'kill' || mode.mode === 'ignore');
    const chosen = applyAction(game, stone.richese, mode);
    assert.equal(chosen.battle!.stoneBurner![stone.richese], mode.mode);
    assert.equal(finishRicheseStrongholdsBattle(stone, chosen).lastBattleContext!.winner, stone.richese);
  }
});
