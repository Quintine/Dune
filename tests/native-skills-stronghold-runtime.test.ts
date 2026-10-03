import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { FACTIONS } from '../game/catalog';
import { treacheryDeck, isAuditorLeader } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { ownedTech } from '../game/tech-tokens';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import {
  assertNativeSkillsStrongholdCustody as custody, createNativeSkillsStrongholdFixture as fixture,
  finishNativeSkillsStrongholdTurn, nativeSkillsStrongholdControllers,
  nativeSkillsStrongholdPlayer as player, nextNativeSkillsStrongholdStep,
  quoteNativeSkillsStrongholdBattle, revealNativeSkillsStrongholdBattle as reveal,
  settleNativeSkillsStrongholdBattle as settle, type NativeSkillsStrongholdFixture,
} from './fixture-native-skills-stronghold';

/** Native Collection is an independent later receipt, not a battle subsidy or bounty. */
function collectionIncome(game: Game, id: string): number {
  if (game.phase !== 7 || game.phaseOpening) return 0;
  return quoteSpiceCollection({ ...game, players: game.players.map(p => ({ ...p, spice: 0 })) }).receipts
    .filter(r => r.player === id).reduce((sum, r) => sum + r.strongholds + r.collected, 0);
}
function assertBattleWallets(before: Game, after: Game): void {
  const quote = quoteNativeSkillsStrongholdBattle(before);
  for (const p of before.players) {
    const paid = quote.payments.find(r => r.player === p.id)?.ownPayment ?? 0;
    const stronghold = quote.strongholdIncome.filter(r => r.player === p.id).reduce((sum, r) => sum + r.amount, 0);
    const bounty = quote.bounty?.player === p.id ? quote.bounty.amount : 0;
    const choam = quote.choamIncome?.owner === p.id ? quote.choamIncome.amount : 0;
    assert.equal(player(after, p.id).spice, p.spice - paid + stronghold + bounty + choam + collectionIncome(after, p.id), p.faction);
  }
}
function afterCopy(f: NativeSkillsStrongholdFixture): Game {
  assert.ok(f.copyAction);
  let game = applyAction(f.game, f.owner, f.copyAction);
  for (let i = 0; (game.decision || game.response || game.battle?.preparation || game.battle?.preLeader?.closed === false) && i < 100; i++) {
    const next = nextNativeSkillsStrongholdStep(game); assert.ok(next);
    game = applyAction(game, next.actor, next.action);
  }
  return game;
}

void test('original Advanced native offers, wallets, decks/cache and physical 20/7/5/3 survive genuine Stronghold and optional Tech setup', () => {
  for (const kind of ['ix-copy-suk', 'tleilaxu-tabr', 'richese-marker'] as const) {
    for (const optionalTech of [false, true]) {
      const f = fixture({ kind, optionalTech });
      const skills = f.offered.leaderSkills!;
      assert.deepEqual([...skills.deck, ...Object.values(skills.offers).flatMap(o => o.cards), ...skills.assignments.map(a => a.skill)].sort(),
        LEADER_SKILL_CARDS.map(c => c.id).sort());
      for (const p of f.afterSetup.players) assert.equal(p.spice, FACTIONS.find(c => c.id === p.faction)!.spice, p.faction);
      const physical = [...f.afterSetup.deck, ...f.afterSetup.discard, ...f.afterSetup.players.flatMap(p => p.hand), ...(f.afterSetup.richeseCache ?? [])];
      const canonical = [...treacheryDeck(f.afterSetup.expansions), ...(kind === 'richese-marker' ? richeseCards() : [])];
      assert.deepEqual(physical.map(c => c.id).sort(), canonical.map(c => c.id).sort());
      assert.equal(nativeSkillsStrongholdControllers(f.beforeFirstMentat)[f.territory], f.owner);
      assert.equal(f.beforeFirstMentat.strongholdCards!.owners[f.territory], null);
      const claimed = applyAction(f.beforeFirstMentat, f.firstMentatStep.actor, f.firstMentatStep.action);
      assert.equal(claimed.strongholdCards!.owners[f.territory], f.owner);
      assert.equal(claimed.turn, 2);
      if (optionalTech) {
        const seats = new Set(f.afterFirstMentat.players.map(p => p.id));
        assert.ok(Object.values(f.afterFirstMentat.techTokens!).every(token => token.owner && seats.has(token.owner)));
        if (kind !== 'richese-marker') {
          const native = f.afterSetup.players.find(p => p.faction === (kind === 'ix-copy-suk' ? 'ixians' : 'tleilaxu'))!;
          assert.ok(ownedTech(f.afterFirstMentat.techTokens, native.id).includes(kind === 'ix-copy-suk' ? 'heighliners' : 'axlotl'));
        }
      }
      custody(f.afterSetup); custody(f.afterFirstMentat); custody(f.game);
    }
  }
});

void test('authenticated original lobby keeps human IDs and native decks while actually reaching HMS copy and typed trained-disc Suk', () => {
  const initial = createGame('NATIVEHUMAN', newPlayer('human-ix', 'Human Ix', 'ixians'), true, ['ix', 'choam']);
  joinGame(initial, newPlayer('human-emperor', 'Human Emperor', 'emperor'));
  joinGame(initial, newPlayer('human-choam', 'Human CHOAM', 'choam'));
  joinGame(initial, newPlayer('human-fremen', 'Human Fremen', 'fremen'));
  const before = structuredClone(initial);
  const f = fixture({ initial, kind: 'ix-copy-suk', optionalTech: true });
  assert.deepEqual(initial, before);
  assert.deepEqual(f.game.players.map(p => p.id), before.players.map(p => p.id));
  assert.equal(f.owner, 'human-ix');
  assert.equal(f.game.decision?.kind, 'strongholdCopy');
  assert.deepEqual(f.game.decision?.kind === 'strongholdCopy' ? [...f.game.decision.choices].sort() : [], ['arrakeen', 'sietch_tabr']);
  const pending = structuredClone(f.game);
  assert.throws(() => applyAction(f.game, f.owner, f.plans[0].action));
  assert.deepEqual(f.game, pending, 'No hidden plan can precede the public HMS copy declaration');
  const ready = afterCopy(f);
  assert.equal(viewGame(ready, f.opponent).battle!.strongholdEffects[f.owner], 'arrakeen');
  const revealed = reveal(f), quote = quoteNativeSkillsStrongholdBattle(revealed);
  assert.equal(quote.payments.find(p => p.player === f.owner)!.bankSupport, 1);
  assert.equal(quote.payments.find(p => p.player === f.owner)!.ownPayment, 0);
  const rescue = settle(revealed, 'suk');
  assert.equal(rescue.decision?.kind, 'sukRescue');
  if (rescue.decision?.kind !== 'sukRescue') throw Error('Native typed casualties must reach Suk');
  assert.deepEqual(rescue.pendingSukRescue!.losses, { normal: 4, elite: 2, paidNormal: 0, paidElite: 1 });
  const choice = rescue.decision.options.findIndex(o => o.normal === 2 && o.elite === 1 && o.kept?.kind === 'normal');
  assert.ok(choice >= 0);
  const resolved = settle(applyAction(rescue, f.owner, { type: 'decision', event: rescue.decision.event, choice }));
  assert.equal(resolved.lastBattleContext!.winner, f.owner);
  assert.equal(player(resolved, f.owner).forces[f.location], 3);
  assert.equal(player(resolved, f.owner).elites!.forces[f.location] ?? 0, 0);
  assert.equal(player(resolved, f.owner).elites!.reserves, 6);
  assert.equal(player(resolved, f.owner).elites!.tanks, 1);
  assert.equal(player(resolved, f.owner).tanks, 3);
  assert.equal(player(resolved, f.opponent).tanks, 8);
  assertBattleWallets(revealed, resolved); custody(resolved);
});

void test('actual Arrakeen subsidy funds trained Suk without suppressing CHOAM original declared-support income', () => {
  const f = fixture({ kind: 'choam-support', optionalTech: true });
  const revealed = reveal(f), quote = quoteNativeSkillsStrongholdBattle(revealed);
  assert.equal(quote.payments.find(r => r.player === f.owner)!.ownPayment, 2);
  assert.equal(quote.payments.find(r => r.player === f.owner)!.bankSupport, 2);
  assert.deepEqual(quote.choamIncome, { owner: f.choam, amount: 2 });
  const resolved = settle(revealed);
  assert.equal(player(resolved, f.owner).forces[f.location], 5);
  assert.equal(player(resolved, f.owner).tanks, 1);
  assert.equal(player(resolved, f.choam!).spice, player(revealed, f.choam!).spice + 2);
  assertBattleWallets(revealed, resolved); custody(resolved);
});

void test('native CHOAM Auditor is excluded from training and cannot borrow a hidden trained Suk rescue', () => {
  const f = fixture({ kind: 'choam-auditor' });
  const eligible = viewGame(f.offered, f.owner).leaderSkills!.eligibleLeaders;
  const auditor = player(f.afterSetup, f.owner).leaders.find(isAuditorLeader)!;
  assert.ok(auditor && eligible.every(l => l.id !== auditor.id));
  assert.ok(f.afterSetup.leaderSkills!.assignments.every(a => a.leader !== auditor.id));
  const revealed = reveal(f), quote = quoteNativeSkillsStrongholdBattle(revealed);
  assert.equal(quote.auditor!.owner, f.owner);
  assert.equal(quote.auditor!.survived, true);
  const resolved = settle(revealed);
  assert.equal(resolved.lastBattleContext!.winner, f.owner);
  assert.equal(player(resolved, f.owner).forces[f.location], 4);
  assert.equal(player(resolved, f.owner).tanks, 4, 'Unskilled Auditor has no trained-disc Suk rescue');
  assertBattleWallets(revealed, resolved); custody(resolved);
});

void test('Tabr/Tuek original winner keeps spice/cards and optional Tech before Face Dance; matching-disc death returns Suk once without a second bounty', () => {
  for (const kind of ['tleilaxu-tabr', 'tleilaxu-tuek'] as const) {
    for (const optionalTech of [false, true]) {
      const f = fixture({ kind, optionalTech });
      const revealed = reveal(f), quote = quoteNativeSkillsStrongholdBattle(revealed);
      assert.deepEqual(quote.strongholdIncome, [{ player: f.owner, amount: 2 }]);
      const suk = settle(revealed, 'suk');
      assert.equal(suk.decision?.kind, 'sukRescue');
      const cards = settle(suk, 'cards');
      assert.equal(cards.decision?.kind, 'battleCards');
      assert.equal(cards.decision?.player, f.owner);
      const usedDefense = f.plans[0].action.defense as string;
      const cleaned = applyAction(cards, f.owner, { type: 'decision', discard: [usedDefense] });
      const face = settle(cleaned, 'faceDance');
      assert.equal(face.decision?.kind, 'faceDance');
      assert.ok(face.discard.some(c => c.id === usedDefense), 'Original winner card choice finishes before Face Dance');
      assert.equal(player(face, f.owner).forces[f.location], 5, 'Original Suk rescue completes first');
      assert.equal(player(face, f.owner).tanks, 1);
      assert.equal(player(face, f.owner).spice, player(revealed, f.owner).spice - 4 + quote.bounty!.amount + 2);
      if (optionalTech) assert.ok(ownedTech(face.techTokens, f.owner).includes('axlotl'));
      const cardIds = player(face, f.owner).hand.map(c => c.id).sort();
      const reserves = player(face, f.owner).reserves;
      const dancerReserves = player(face, f.tleilaxu!).reserves;
      const danced = applyAction(face, f.tleilaxu!, { type: 'decision', reveal: true,
        sources: { reserves: 1, [f.boardSource]: 2 }, sector: Number(f.location.split(':')[1]) });
      assert.equal(player(danced, f.owner).reserves, reserves + 5);
      assert.equal(player(danced, f.owner).forces[f.location] ?? 0, 0);
      assert.equal(player(danced, f.tleilaxu!).forces[f.location], 3);
      assert.equal(player(danced, f.tleilaxu!).forces[f.boardSource], 1);
      assert.equal(player(danced, f.tleilaxu!).reserves, dancerReserves - 1);
      assert.equal(player(danced, f.owner).leaders.find(l => l.id === f.trainer)!.dead, true);
      assert.equal(danced.leaderSkills!.assignments.some(a => a.leader === f.trainer), false);
      assert.equal(danced.leaderSkills!.deck.filter(s => s === 'suk-graduate').length, 1);
      assert.deepEqual(player(danced, f.owner).hand.map(c => c.id).sort(), cardIds);
      for (const p of face.players)
        assert.equal(player(danced, p.id).spice, p.spice + collectionIncome(danced, p.id),
          `${p.faction}: Face Dance awards no additional leader bounty or confiscation`);
      if (optionalTech) assert.ok(ownedTech(danced.techTokens, f.owner).includes('axlotl'));
      assert.equal(nativeSkillsStrongholdControllers(danced)[f.territory], f.tleilaxu);
      assert.equal(danced.strongholdCards!.owners[f.territory], f.owner, 'Board replacement does not immediately transfer retained Stronghold Card');
      const ended = finishNativeSkillsStrongholdTurn(danced);
      assert.equal(ended.strongholdCards!.owners[f.territory], f.tleilaxu);
      assert.equal(ended.leaderSkills!.deck.filter(s => s === 'suk-graduate').length, 1);
      custody(danced); custody(ended);
    }
  }
});

void test('original mixed ordinary-force/No-Field boundary remains guarded even with trained Suk and a retained Stronghold Card', () => {
  const f = fixture({ kind: 'richese-marker' });
  const game = structuredClone(f.beforeBattle), richese = player(game, f.owner);
  // Explicit conserved alternative board position: one existing Polar Sink
  // counter accompanies the marker, not a shipment or played-turn claim.
  richese.forces[f.boardSource]--;
  richese.forces[f.location] = 1;
  const before = structuredClone(game), actor = game.active!;
  assert.throws(() => applyAction(game, actor, { type: 'chooseBattle', territory: f.territory,
    target: actor === f.owner ? f.opponent : f.owner }), /Mixed ordinary-force and No-Field/);
  assert.deepEqual(game, before); custody(game);
});

void test('reserve-capped marker-only Richese materializes three after both plans, earns retained Arrakeen subsidy and rescues only physical casualties', () => {
  const f = fixture({ kind: 'richese-marker', optionalTech: true });
  assert.equal(player(f.shipment!.after, f.owner).spice, player(f.shipment!.before, f.owner).spice - 1);
  const own = viewGame(f.game, f.owner).battle!;
  assert.equal(own.ownForces!.normal, 3);
  const before = structuredClone(f.game);
  assert.throws(() => applyAction(f.game, f.owner, { ...f.plans[0].action, dial: 4 }));
  assert.deepEqual(f.game, before);
  const sealed = applyAction(f.game, f.owner, f.plans[0].action);
  assert.ok(player(sealed, f.owner).noField!.deployed);
  assert.equal(player(sealed, f.owner).forces[f.location] ?? 0, 0);
  const revealed = reveal(f), quote = quoteNativeSkillsStrongholdBattle(revealed);
  assert.equal(player(revealed, f.owner).forces[f.location], 3);
  assert.equal(quote.payments.find(p => p.player === f.owner)!.ownPayment, 1);
  assert.equal(quote.payments.find(p => p.player === f.owner)!.bankSupport, 2);
  const resolved = settle(revealed);
  assert.equal(player(resolved, f.owner).forces[f.location], 1);
  assert.equal(player(resolved, f.owner).reserves, 2);
  assert.equal(player(resolved, f.owner).tanks, 0);
  assert.equal(player(resolved, f.opponent).tanks, 6);
  assertBattleWallets(revealed, resolved); custody(resolved);
});

void test('native cache-acquired Stone uses retained Habbanya in both modes with all skills hidden and untrained battle discs', () => {
  for (const mode of ['kill', 'ignore'] as const) {
    const f = fixture({ kind: 'richese-stone' });
    assert.ok(f.acquisition!.before.richeseCache!.some(c => c.id === 'richese-stone-burner'));
    assert.ok(player(f.acquisition!.after, f.owner).hand.some(c => c.id === 'richese-stone-burner'));
    assert.equal(f.acquisition!.after.richeseCache!.some(c => c.id === 'richese-stone-burner'), false);
    for (const p of f.acquisition!.before.players) assert.equal(player(f.acquisition!.after, p.id).spice, p.spice);
    const offered = reveal(f);
    assert.equal(offered.decision?.kind, 'stoneBurner');
    const chosen = applyAction(offered, f.owner, { type: 'decision', event: offered.battle!.event, mode });
    const quote = quoteNativeSkillsStrongholdBattle(chosen), resolved = settle(chosen);
    assert.equal(quote.winner, f.owner);
    assert.deepEqual(quote.stone!.attacker, [6]);
    assert.deepEqual(quote.stone!.defender, [6]);
    assert.equal(player(resolved, f.owner).forces[f.location], 6);
    assert.equal(player(resolved, f.owner).tanks, 2);
    for (const plan of f.plans) assert.equal(player(resolved, plan.actor).leaders.find(l => l.id === plan.action.leader)!.dead, mode === 'kill');
    assert.ok(player(resolved, f.owner).hand.some(c => c.id === 'richese-stone-burner'));
    assertBattleWallets(chosen, resolved); custody(resolved);
  }
});

void test('four existing policies finish changed HMS/Suk and capped-marker windows with physical and economic outcomes', () => {
  const ix = fixture({ kind: 'ix-copy-suk' });
  const marker = fixture({ kind: 'richese-marker' });
  const stone = fixture({ kind: 'richese-stone' });
  const stoneChoice = reveal(stone);
  const ixRescue = settle(reveal(ix), 'suk');
  const markerRescue = settle(reveal(marker), 'suk');
  for (const difficulty of DIFFICULTIES) {
    const copyView = viewGame(ix.game, ix.owner); copyView.players.find(p => p.id === ix.owner)!.bot = difficulty;
    const copy = botActions(copyView)[0];
    const declared = applyAction(ix.game, ix.owner, copy);
    assert.ok(['arrakeen', 'sietch_tabr'].includes(declared.battle!.strongholdCopy!));
    const copiedBattle = reveal({ ...ix, copyAction: copy });
    const copiedQuote = quoteNativeSkillsStrongholdBattle(copiedBattle);
    assert.equal(copiedQuote.payments.find(p => p.player === ix.owner)!.ownPayment,
      declared.battle!.strongholdCopy === 'arrakeen' ? 0 : 1);
    const copiedResult = settle(copiedBattle);
    assert.equal(player(copiedResult, ix.owner).forces[ix.location], 3);
    assert.equal(player(copiedResult, ix.owner).tanks, 3);
    assertBattleWallets(copiedBattle, copiedResult);
    let markerPlans = structuredClone(marker.game);
    for (const actor of [marker.owner, marker.opponent]) {
      const view = viewGame(markerPlans, actor); view.players.find(p => p.id === actor)!.bot = difficulty;
      const plan = botActions(view).find(a => a.type === 'battlePlan'); assert.ok(plan);
      markerPlans = applyAction(markerPlans, actor, plan);
      for (let n = 0; !markerPlans.battle?.revealed && (markerPlans.response || markerPlans.decision) && n < 100; n++) {
        const next = nextNativeSkillsStrongholdStep(markerPlans); assert.ok(next);
        markerPlans = applyAction(markerPlans, next.actor, next.action);
      }
    }
    assert.equal(player(markerPlans, marker.owner).forces[marker.location], 3);
    const markerResult = settle(markerPlans);
    assertBattleWallets(markerPlans, markerResult); custody(markerResult);
    const stoneView = viewGame(stoneChoice, stone.owner); stoneView.players.find(p => p.id === stone.owner)!.bot = difficulty;
    const mode = botActions(stoneView)[0];
    const chosenStone = applyAction(stoneChoice, stone.owner, mode), stoneResult = settle(chosenStone);
    assert.equal(stoneResult.lastBattleContext!.winner, stone.owner);
    assert.equal(player(stoneResult, stone.owner).forces[stone.location], 6);
    for (const plan of stone.plans)
      assert.equal(player(stoneResult, plan.actor).leaders.find(l => l.id === plan.action.leader)!.dead, mode.mode === 'kill');
    assertBattleWallets(chosenStone, stoneResult); custody(stoneResult);
    for (const [f, pending] of [[ix, ixRescue], [marker, markerRescue]] as const) {
      const view = viewGame(pending, f.owner); view.players.find(p => p.id === f.owner)!.bot = difficulty;
      const action = botActions(view)[0];
      const rescued = settle(applyAction(pending, f.owner, action));
      assert.equal(rescued.lastBattleContext!.winner, f.owner);
      assert.equal(player(rescued, f.owner).tanks, f.kind === 'richese-marker' ? 0 : 3,
        `${difficulty}/${f.kind}: three real casualties saved, no unpaid cyborg manufactured`);
      assert.equal(player(rescued, f.opponent).tanks, f.kind === 'richese-marker' ? 6 : 8);
      if (f.kind === 'richese-marker') {
        assert.equal(player(rescued, f.owner).forces[f.location], 1);
        assert.equal(player(rescued, f.owner).reserves, 2);
      } else assert.equal(player(rescued, f.owner).forces[f.location], 3);
      custody(rescued);
    }
  }
});
