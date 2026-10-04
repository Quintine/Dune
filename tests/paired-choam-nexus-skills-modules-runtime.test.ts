import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { splitLocation, territory } from '../game/board';
import { presenceAt } from '../game/force-presence';
import { ownedTech } from '../game/tech-tokens';
import { quotePhaseResources } from '../game/phase-resource-quote';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { reserveShipmentCost } from '../game/shipment-price';
import { isPlanetologistBattleSpecialCard } from '../game/leader-skill-combat';
import {
  advancePairedChoamSkillsModules as advance, advancePairedChoamSkillsModulesToPhase as toPhase,
  advancePairedModulesBattleToDecision, advancePairedModulesRicheseToGuild,
  allowPairedChoamSkillsModules as allow, assertPairedChoamSkillsModulesCustody as custody,
  completePairedChoamSkillsModulesSetup, createPairedChoamNexusSkillsModulesFixture as fixture,
  finishPairedChoamSkillsModulesMovement, finishPairedModulesSkillsBattle as finishBattle,
  holdPairedModulesSkillsCard as hold, initializePairedChoamNexusSkillsModules,
  openPairedModulesSkillsBattle as openBattle, pairedModulesRicheseGuildStep,
  pairedModulesSkillsBattlePlans as plans, pairedModulesSkillsChoamCunningRequest as choamRequest,
  pairedModulesSkillsClean as clean, pairedModulesSkillsPlayer as player,
  pairedModulesSkillsRicheseCunningRequest as richeseRequest, pairedModulesSkillsSnapshot as snapshot,
  pairedModulesSkillsStrongholdControls as controls, placePairedModulesSkillsForce as place,
  quotePairedModulesSkillsBattle as quoteBattle, revealPairedModulesRichese as reveal,
  stagePairedModulesSkillsPlanetologistRoute as stageRoute, stepPairedChoamSkillsModules as step,
  type PairedChoamNexusSkillsModulesFixture,
} from './fixture-paired-choam-nexus-skills-modules';

const combinations = [
  { advanced: false, tech: true, strongholds: false },
  { advanced: true, tech: true, strongholds: false },
  { advanced: true, tech: false, strongholds: true },
  { advanced: true, tech: true, strongholds: true },
] as const;

function reject(game: Game, actor: string, action: Action): void {
  const before = snapshot(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'Rejected actions cannot consume a native invoice, physical card, marker, force, skill or reward');
}
function assertPair(f: PairedChoamNexusSkillsModulesFixture, shipped: Game, faceup: number): void {
  const request = richeseRequest(f), before = player(f.game, f.richese), after = player(shipped, f.richese);
  assert.equal(after.spice, before.spice - 1);
  assert.equal(player(shipped, f.guild).spice, player(f.game, f.guild).spice + 1);
  assert.equal(after.reserves, before.reserves - faceup);
  assert.equal(after.forces[f.location] ?? 0, faceup);
  assert.equal(after.noField!.deployed!.tokenId, request.noField);
  assert.equal(after.noField!.lastShipped, request.noField);
  assert.equal(presenceAt(after, 'habbanya_ridge_sietch'), faceup + 1);
  assert.equal(shipped.nexusCards!.cards!.hands[f.richese], null);
  assert.equal(shipped.nexusRicheseCunningLast!.stage, 'shipped');
  assert.deepEqual(shipped.leaderSkills!.assignments, f.game.leaderSkills!.assignments);
  assert.deepEqual(after.noField!.tokens, before.noField!.tokens);
  custody(shipped);
}
/** Collection is an independent later receipt, never a battle subsidy. */
function assertBattleWallets(before: Game, after: Game): void {
  const quote = quoteBattle(before);
  const collection = after.phase === 7 && clean(after)
    ? quoteSpiceCollection({ ...after, players: after.players.map(p => ({ ...p, spice: 0 })) }).receipts : [];
  for (const p of before.players) {
    const payment = quote.payments.find(row => row.player === p.id)?.ownPayment ?? 0;
    const choam = quote.choamIncome?.owner === p.id ? quote.choamIncome.amount : 0;
    const stronghold = quote.strongholdIncome.filter(row => row.player === p.id).reduce((sum, row) => sum + row.amount, 0);
    const bounty = quote.bounty?.player === p.id ? quote.bounty.amount : 0;
    const city = collection.find(row => row.player === p.id);
    assert.equal(player(after, p.id).spice, p.spice - payment + choam + stronghold + bounty + (city?.strongholds ?? 0) + (city?.collected ?? 0), p.faction);
  }
}

for (const modules of combinations) void test(`paired Skills ${modules.advanced ? 'Advanced' : 'Basic'} Tech=${modules.tech} SH=${modules.strongholds}: original signed pair, one native invoice and once-only phase-end industry`, () => {
  const f = fixture(modules), previous = player(f.game, f.richese).noField!.tokens.find(token => token.value === 0)!;
  assert.equal(player(f.firstShipment.after, f.richese).spice, player(f.firstShipment.before, f.richese).spice - 1);
  assert.equal(player(f.firstShipment.after, f.richese).reserves, player(f.firstShipment.before, f.richese).reserves);
  assert.equal(player(f.game, f.richese).noField!.lastShipped, previous.id);
  assert.equal(f.beforeAlliance.nexus, true);
  assert.equal(player(f.beforeClosingDraw, f.guild).ally, f.observer);
  assert.equal(player(f.beforeClosingDraw, f.observer).ally, f.guild);
  for (const draw of f.closingDraws) {
    assert.equal(draw.before.nexusCards!.cards!.hands[draw.step.actor], null);
    assert.equal(draw.after.nexusCards!.cards!.hands[draw.step.actor], player(draw.after, draw.step.actor).faction);
  }
  if (modules.tech) {
    assert.ok(Object.values(f.afterSetup.techTokens!).every(token => token.owner === null));
    assert.ok(Object.values(f.afterFirstStorm.techTokens!).every(token => token.owner && f.afterFirstStorm.players.some(p => p.id === token.owner)));
  }
  if (modules.strongholds) {
    assert.equal(f.beforeFirstMentat.strongholdCards!.owners.habbanya_ridge_sietch, null);
    assert.equal(f.beforeFirstMentat.strongholdCards!.owners.arrakeen, null);
    assert.equal(f.afterFirstMentat.strongholdCards!.owners.habbanya_ridge_sietch, f.richese);
    assert.equal(f.afterFirstMentat.strongholdCards!.owners.arrakeen, f.choam);
    assert.equal(controls(f.game).habbanya_ridge_sietch, null);
    assert.equal(f.game.strongholdCards!.owners.habbanya_ridge_sietch, f.richese, 'Leaving does not transfer a held physical card before END Mentat');
  }
  const request = richeseRequest(f);
  reject(f.game, f.richese, { ...request, noField: previous.id });
  reject(f.game, f.richese, { ...request, revealedToken: previous.id });
  reject(f.game, f.richese, { ...request, revealedToken: request.noField });
  reject(f.game, f.richese, { ...request, nexus: 'stale-pair' });
  reject(f.game, f.richese, { ...request, smuggler: true });
  reject(f.game, f.richese, { ...request, amount: 8 });
  hold(f.game, f.observer, card => card.effect === 'karama', f.staging);
  const declared = applyAction(f.game, f.richese, request);
  assert.equal(declared.response?.kind, 'richeseNoField');
  assert.equal(declared.pendingShipment!.cost, 1);
  assert.equal(declared.pendingShipment!.amount, 1);
  assert.equal(declared.pendingShipment!.noFieldSkillProof, undefined);
  assert.equal(declared.response!.noFieldSkillProof, undefined);
  assert.equal(declared.pendingShipment!.smugglerCompanion, undefined);
  const receipt = declared.nexusRicheseCunningHistory!.at(-1)!;
  assert.equal(receipt.frame, JSON.stringify(declared.pendingShipment), 'The original two-marker frame remains signed without an ordinary single-marker skill proof');
  assert.equal(receipt.signature, JSON.stringify([receipt.event, receipt.owner, receipt.turn, receipt.phase, receipt.tokenEvent, receipt.frame, receipt.stage]));
  assert.equal(player(declared, f.richese).spice, player(f.game, f.richese).spice);
  assert.deepEqual(player(declared, f.richese).forces, player(f.game, f.richese).forces);
  // Deliberately corrupt a saved invoice, not a legal staging grant.
  const corrupted = snapshot(declared);
  corrupted.pendingShipment!.cost = 0;
  const responder = corrupted.players.find(p => !corrupted.response!.passed.includes(p.id))!.id;
  reject(corrupted, responder, { type: 'passResponse' });
  let shipped = advancePairedModulesRicheseToGuild(declared);
  if (modules.advanced) {
    assert.equal(shipped.decision?.kind, 'guildShipment');
    assert.equal(shipped.pendingShipment!.cost, 1);
    assert.equal(player(shipped, f.richese).spice, player(f.game, f.richese).spice);
    reject(shipped, f.guild, { type: 'decision', allow: false });
    shipped = allow(step(shipped, pairedModulesRicheseGuildStep(shipped)));
  }
  assertPair(f, shipped, 5);
  reject(shipped, f.richese, request);
  assert.equal(player(allow(shipped), f.guild).spice, player(shipped, f.guild).spice, 'Response continuation cannot repeat the original fee');
  if (modules.tech) {
    const token = shipped.techTokens!.heighliners;
    assert.ok(token.owner);
    const amount = ownedTech(f.game.techTokens, token.owner).length;
    assert.equal(token.spice, amount);
    assert.equal(token.triggeredTurn, shipped.turn);
    assert.equal(player(shipped, token.owner).spice, player(f.game, token.owner).spice + (token.owner === f.richese ? -1 : token.owner === f.guild ? 1 : 0));
    let another = shipped;
    if (shipped.movementRemaining?.includes(f.choam)) {
      const atChoam = advance(shipped, g => g.phase === 5 && g.active === f.choam && clean(g));
      another = allow(applyAction(atChoam, f.choam, { type: 'ship', amount: 1, territory: 'arrakeen', sector: territory('arrakeen').sectors[0] }));
      assert.equal(player(another, f.choam).spice, player(atChoam, f.choam).spice - 1);
      assert.equal(player(another, f.guild).spice, player(atChoam, f.guild).spice + 1);
    }
    assert.equal(another.techTokens!.heighliners.spice, amount);
    const credit = quotePhaseResources(another).credits.find(row => row.kind === 'tech' && row.token === 'heighliners');
    assert.ok(credit);
    const collection = quoteSpiceCollection(another).receipts.find(row => row.player === token.owner);
    const ended = finishPairedChoamSkillsModulesMovement(another);
    assert.equal(player(ended, token.owner).spice, credit.balance + (ended.phase === 7 ? (collection?.collected ?? 0) + (collection?.strongholds ?? 0) : 0));
    assert.equal(ended.techTokens!.heighliners.spice, 0);
    assert.equal(ended.techTokens!.heighliners.triggeredTurn, ended.turn);
    custody(ended);
  }
});

for (const modules of combinations) for (const trained of [false, true])
  void test(`paired Skills ${modules.advanced ? 'Advanced' : 'Basic'} Tech=${modules.tech} SH=${modules.strongholds}: voluntary pair reveal, ${trained ? 'skilled' : 'normal'} Suk, native support and winner Tech`, () => {
    const f = fixture(modules);
    let game = allow(applyAction(f.game, f.richese, richeseRequest(f)));
    game = reveal(game, f.richese);
    assert.equal(player(game, f.richese).noField!.deployed, null);
    assert.equal(player(game, f.richese).forces[f.location], 8);
    assert.equal(player(game, f.richese).reserves, 12);
    place(game, f.guild, f.location, 3, f.staging);
    place(game, f.choam, `arrakeen:${territory('arrakeen').sectors[0]}`, 1, f.staging);
    game = openBattle(game, f.richese, f.guild, { band: trained ? 'skilled' : 'normal' });
    const battlePlans = plans(game, f.richese, f.guild, 2, trained);
    assert.equal(battlePlans[0].action.leader === f.trainers.richese, trained);
    for (const next of battlePlans) game = allow(step(game, next));
    assert.ok(game.battle?.revealed);
    const revealed = snapshot(game), quote = quoteBattle(game), loserTokens = ownedTech(game.techTokens, f.guild);
    assert.equal(quote.winner, f.richese);
    assert.equal(quote.result, 'normal');
    assert.equal(quote.sukGraduate!.mode, trained ? 'skilled' : 'normal');
    assert.equal(viewGame(game, f.richese).battle!.ownForces!.normal, 8);
    assert.equal(quote.payments.find(row => row.player === f.richese)?.ownPayment ?? 0, modules.advanced ? 2 : 0);
    assert.equal(quote.payments.find(row => row.player === f.richese)?.bankSupport ?? 0, 0);
    assert.deepEqual(quote.choamIncome, modules.advanced ? { owner: f.choam, amount: 1 } : null);
    if (trained) {
      game = advancePairedModulesBattleToDecision(game, 'sukRescue');
      assert.equal(game.decision?.kind, 'sukRescue');
      if (game.decision?.kind !== 'sukRescue') throw Error('The real skilled casualty commitment must reach Suk');
      const pending = snapshot(game), decision = game.decision;
      reject(game, f.richese, { type: 'decision', event: 'stale-suk', choice: 0 });
      assert.deepEqual(game, pending);
      if (modules.tech && modules.strongholds) for (const difficulty of DIFFICULTIES) {
        const view = viewGame(pending, f.richese);
        view.players.find(p => p.id === f.richese)!.bot = difficulty;
        const action = botActions(view)[0];
        assert.ok(action?.type === 'decision' && typeof action.choice === 'number');
        const rescue = decision.options[action.choice];
        assert.ok(rescue);
        const resolved = finishBattle(applyAction(pending, f.richese, action));
        const kept = rescue.kept?.kind === 'normal' ? 1 : 0;
        assert.equal(player(resolved, f.richese).forces[f.location], 6 + kept, difficulty);
        assert.equal(player(resolved, f.richese).reserves, 12 + rescue.normal - kept, difficulty);
        assert.equal(player(resolved, f.richese).tanks, 2 - rescue.normal, difficulty);
        assert.equal(player(resolved, f.guild).tanks, 3, difficulty);
        for (const token of loserTokens) assert.equal(resolved.techTokens![token].owner, f.richese, difficulty);
        assertBattleWallets(revealed, resolved); custody(resolved);
      }
      if (modules.tech) for (const token of loserTokens)
        assert.equal(game.techTokens![token].owner, f.guild, 'Original loser Tech cannot transfer before physical Suk rescue settles');
      const choice = decision.options.findIndex(option => option.normal === 2 && option.elite === 0 && option.kept?.kind === 'normal');
      assert.ok(choice >= 0);
      game = applyAction(game, f.richese, { type: 'decision', event: decision.event, choice });
    }
    game = finishBattle(game);
    assert.equal(game.lastBattleContext!.winner, f.richese);
    assert.equal(player(game, f.richese).forces[f.location], trained ? 7 : 6);
    assert.equal(player(game, f.richese).reserves, 13);
    assert.equal(player(game, f.richese).tanks, trained ? 0 : 1);
    assert.equal(player(game, f.guild).tanks, 3);
    if (modules.tech) {
      assert.ok(loserTokens.length > 0, 'Use original first-Storm loser custody, not a granted token');
      for (const token of loserTokens) assert.equal(game.techTokens![token].owner, f.richese);
    }
    if (modules.strongholds) assert.equal(game.strongholdCards!.owners.habbanya_ridge_sietch, f.richese);
    assertBattleWallets(revealed, game);
    custody(game);
  });

for (const modules of combinations) void test(`paired Tech=${modules.tech} SH=${modules.strongholds} ${modules.advanced ? 'Advanced' : 'Basic'}: reserve cap and voluntary reveal preserve actual previous-token restriction`, () => {
  const f = fixture({ ...modules, reserveCap: 2 });
  const shipped = allow(applyAction(f.game, f.richese, richeseRequest(f)));
  assertPair(f, shipped, 2);
  const revealed = reveal(shipped, f.richese), previous = player(revealed, f.richese).noField!.lastShipped!;
  assert.equal(player(revealed, f.richese).noField!.deployed, null);
  assert.equal(player(revealed, f.richese).forces[f.location], 2);
  assert.equal(player(revealed, f.richese).reserves, 0);
  let next = advance(revealed, g => g.turn === 3 && g.phase === 1 && clean(g));
  const land = next.spiceDeck.filter(card => 'territory' in card).slice(0, 2);
  assert.equal(land.length, 2);
  for (const [index, card] of land.entries()) next.spiceDeck.splice(index, 0, next.spiceDeck.splice(next.spiceDeck.indexOf(card), 1)[0]);
  f.staging.push('Conserved two unused original land cards before turn-three Spice; no played discard is restored.');
  next = advance(next, g => g.turn === 3 && g.phase === 5 && g.active === f.richese && clean(g));
  reject(next, f.richese, { type: 'ship', noField: previous, event: player(next, f.richese).noFieldEvent, territory: 'polar_sink', sector: 0 });
  const zero = player(next, f.richese).noField!.tokens.find(token => token.value === 0)!;
  const accepted = allow(applyAction(next, f.richese, { type: 'ship', noField: zero.id, event: player(next, f.richese).noFieldEvent, territory: 'polar_sink', sector: 0 }));
  assert.equal(player(accepted, f.richese).noField!.deployed!.tokenId, zero.id);
  assert.equal(player(accepted, f.richese).noField!.lastShipped, zero.id);
  assert.equal(player(accepted, f.richese).spice, player(next, f.richese).spice - 2);
  custody(accepted);
});

void test('paired Skills/Tech/SH: native Karama stops only the pair; unpaid replacement cannot consume money, counters, markers or industry', () => {
  const f = fixture(), karama = hold(f.game, f.guild, card => card.kind === 'special' && card.effect === 'karama', f.staging);
  const before = snapshot(f.game), request = richeseRequest(f);
  const pending = applyAction(f.game, f.richese, request);
  const stopped = allow(applyAction(pending, f.guild, { type: 'card', mode: 'cancel', card: karama.id }));
  assert.equal(stopped.nexusRicheseCunningLast!.stage, 'stopped');
  assert.equal(stopped.nexusCards!.cards!.hands[f.richese], null);
  for (const p of before.players) assert.equal(player(stopped, p.id).spice, p.spice);
  assert.deepEqual(player(stopped, f.richese).noField, player(before, f.richese).noField);
  assert.deepEqual(player(stopped, f.richese).forces, player(before, f.richese).forces);
  assert.equal(player(stopped, f.richese).reserves, player(before, f.richese).reserves);
  assert.deepEqual(stopped.techTokens, before.techTokens);
  assert.equal(player(stopped, f.richese).shipped, false);
  assert.equal(stopped.discard.filter(card => card.id === karama.id).length, 1);
  reject(stopped, f.richese, request);
  const ordinary = allow(applyAction(stopped, f.richese, { type: 'ship', amount: 1, territory: 'habbanya_ridge_sietch', sector: territory('habbanya_ridge_sietch').sectors[0] }));
  assert.equal(player(ordinary, f.richese).spice, player(stopped, f.richese).spice - 1);
  assert.equal(player(ordinary, f.guild).spice, player(stopped, f.guild).spice + 1);
  assert.equal(ordinary.techTokens!.heighliners.triggeredTurn, ordinary.turn);
  const fresh = fixture(), amount = player(fresh.game, fresh.richese).spice;
  assert.ok(amount > 0);
  const unpaid = applyAction(fresh.game, fresh.richese, { type: 'bribe', target: fresh.guild, amount });
  assert.equal(player(unpaid, fresh.richese).spice, 0);
  reject(unpaid, fresh.richese, richeseRequest(fresh, unpaid));
  assert.equal(unpaid.nexusCards!.cards!.hands[fresh.richese], 'richese');
  custody(stopped); custody(ordinary); custody(unpaid);
});

for (const modules of combinations) void test(`paired Skills ${modules.advanced ? 'Advanced' : 'Basic'} Tech=${modules.tech} SH=${modules.strongholds}: actual CHOAM Special fuel precedes a separate ordinary Planetologist move`, () => {
  const f = fixture(modules);
  let game = advance(f.movementStart, g => g.phase === 5 && g.active === f.choam && clean(g));
  const fuel = hold(game, f.choam, isPlanetologistBattleSpecialCard, f.staging);
  hold(game, f.guild, card => card.effect === 'karama' && card.id !== fuel.id, f.staging);
  const route = stageRoute(game, f.choam, f.staging), request = choamRequest(game, f.choam, fuel.id), before = snapshot(game);
  reject(before, f.choam, route.action);
  reject(before, f.choam, { ...request, nexus: 'stale-physical-fuel' });
  game = applyAction(game, f.choam, request);
  assert.equal(game.response?.kind, 'choamWorthless');
  assert.equal(game.nexusCards!.cards!.hands[f.choam], null);
  assert.deepEqual(player(game, f.choam).hand.find(card => card.id === fuel.id), fuel);
  game = allow(game);
  assert.equal(game.nexusChoamLast!.stage, 'complete');
  assert.equal(game.discard.filter(card => card.id === fuel.id).length, 1);
  assert.equal(player(game, f.choam).hand.some(card => card.id === fuel.id), false);
  assert.equal(game.choamMovement!.bonus, 1);
  reject(game, f.choam, request);
  reject(game, f.choam, { ...route.action, noField: 'not-ordinary-counters' });
  const moved = allow(applyAction(game, f.choam, route.action));
  assert.equal(player(moved, f.choam).forces[route.from] ?? 0, 0);
  assert.equal(player(moved, f.choam).forces[route.to], 1);
  assert.equal(player(moved, f.choam).moved, 1);
  assert.equal(moved.discard.filter(card => card.id === fuel.id).length, 1, 'Moving does not replay the already spent printed Special');
  assert.deepEqual(moved.leaderSkills!.assignments, before.leaderSkills!.assignments);
  for (const p of before.players) assert.equal(player(moved, p.id).spice, p.spice);
  custody(moved);
  if (modules.tech && modules.strongholds) {
    // Conserved ordinary counter source for a later native battle; never revive fuel.
    place(moved, f.choam, route.to, 3, f.staging);
    place(moved, f.guild, route.to, 3, f.staging);
    let battle = openBattle(moved, f.choam, f.guild, { territory: splitLocation(route.to).territory, band: 'skilled' });
    const battlePlans = plans(battle, f.choam, f.guild, 1, true);
    reject(battle, f.choam, { ...battlePlans[0].action, weapon: fuel.id });
    for (const next of battlePlans) battle = allow(step(battle, next));
    const revealed = snapshot(battle), quote = quoteBattle(battle);
    const bonus = battle.battle!.attacker === f.choam ? quote.leaderSkillBonuses.attacker : quote.leaderSkillBonuses.defender;
    assert.equal(bonus.applied.some(applied => applied.skill === 'planetologist'), false, 'Spent Kulon fuel cannot become an artificial Special-card battle bonus');
    assert.equal(quote.winner, f.choam);
    const finished = finishBattle(battle);
    assert.equal(player(finished, f.choam).forces[route.to], 3);
    assert.equal(player(finished, f.choam).tanks, 1);
    assert.equal(player(finished, f.guild).tanks, 3);
    assert.equal(finished.discard.filter(card => card.id === fuel.id).length, 1);
    assertBattleWallets(revealed, finished); custody(finished);
  }
});

void test('paired Skills/Tech/SH: canceled CHOAM Cunning retains its real Special and grants neither Kulon range nor a replay', () => {
  const f = fixture();
  let game = advance(f.movementStart, g => g.phase === 5 && g.active === f.choam && clean(g));
  const fuel = hold(game, f.choam, isPlanetologistBattleSpecialCard, f.staging);
  const karama = hold(game, f.guild, card => card.kind === 'special' && card.effect === 'karama' && card.id !== fuel.id, f.staging);
  const route = stageRoute(game, f.choam, f.staging), before = snapshot(game), request = choamRequest(game, f.choam, fuel.id);
  game = applyAction(game, f.choam, request);
  game = allow(applyAction(game, f.guild, { type: 'card', mode: 'cancel', card: karama.id }));
  assert.equal(game.nexusChoamLast!.stage, 'canceled');
  assert.equal(game.nexusCards!.cards!.hands[f.choam], null);
  assert.deepEqual(player(game, f.choam).hand.find(card => card.id === fuel.id), fuel);
  assert.equal(game.discard.some(card => card.id === fuel.id), false);
  assert.equal(game.discard.filter(card => card.id === karama.id).length, 1);
  assert.equal(game.choamMovement?.bonus ?? 0, 0);
  reject(game, f.choam, route.action);
  reject(game, f.choam, request);
  for (const p of before.players) assert.equal(player(game, p.id).spice, p.spice);
  custody(game);
});

void test('paired ordinary Suk in retained Arrakeen uses original bank support while CHOAM still earns declared-support income', () => {
  const f = fixture({ arrakeenOwner: 'richese' });
  assert.equal(f.beforeFirstMentat.strongholdCards!.owners.arrakeen, null);
  assert.equal(controls(f.beforeFirstMentat).arrakeen, f.richese);
  assert.equal(f.afterFirstMentat.strongholdCards!.owners.arrakeen, f.richese);
  let game = reveal(allow(applyAction(f.game, f.richese, richeseRequest(f))), f.richese);
  const location = `arrakeen:${territory('arrakeen').sectors[0]}`, richese = player(game, f.richese);
  // Conserved alternate ordinary battle position, not a claimed played move.
  const group = richese.forces[f.location];
  delete richese.forces[f.location];
  richese.forces[location] = group;
  f.staging.push(`Conserved ${group} revealed Richese counters: ${f.location} → ${location}; not native movement history.`);
  place(game, f.guild, location, 3, f.staging);
  assert.equal(controls(game).arrakeen, null, 'Contested current control is not a transfer of the held physical Arrakeen card');
  assert.equal(game.strongholdCards!.owners.arrakeen, f.richese);
  game = openBattle(game, f.richese, f.guild, { territory: 'arrakeen', band: 'skilled' });
  for (const next of plans(game, f.richese, f.guild, 2, true)) game = allow(step(game, next));
  const revealed = snapshot(game), quote = quoteBattle(game), payment = quote.payments.find(row => row.player === f.richese)!;
  assert.equal(viewGame(game, f.richese).battle!.strongholdEffects[f.richese], 'arrakeen');
  assert.equal(payment.ownPayment, 0);
  assert.equal(payment.bankSupport, 2);
  assert.deepEqual(quote.choamIncome, { owner: f.choam, amount: 1 }, 'Native income counts original declared support, including the actual bank-funded leg');
  assert.equal(quote.sukGraduate!.mode, 'skilled');
  game = finishBattle(game);
  assert.equal(player(game, f.richese).forces[location], 7);
  assert.equal(player(game, f.richese).reserves, 13);
  assert.equal(player(game, f.richese).tanks, 0);
  assert.equal(player(game, f.guild).tanks, 3);
  assert.equal(game.strongholdCards!.owners.arrakeen, f.richese);
  assertBattleWallets(revealed, game); custody(game);
});

void test('paired retained Habbanya wins a tied ordinary battle only after actual reveal; mixed marker plans remain excluded', () => {
  const f = fixture();
  let game = allow(applyAction(f.game, f.richese, richeseRequest(f)));
  place(game, f.guild, f.location, 6, f.staging);
  const beforeMovementEnd = snapshot(game);
  game = finishPairedChoamSkillsModulesMovement(game);
  assert.equal(game.phase, 6);
  assert.ok(game.active === f.richese || game.active === f.guild);
  const beforeMixed = snapshot(game);
  assert.throws(() => applyAction(game, game.active!, { type: 'chooseBattle', territory: 'habbanya_ridge_sietch',
    target: game.active === f.richese ? f.guild : f.richese }), /Mixed ordinary-force and No-Field/);
  assert.deepEqual(game, beforeMixed);
  game = reveal(beforeMovementEnd, f.richese);
  game = openBattle(game, f.richese, f.guild, { band: 'skilled' });
  const r = player(game, f.richese), g = player(game, f.guild);
  const rLeader = r.leaders.filter(leader => !leader.dead && leader.id !== f.trainers.richese).sort((a, b) => b.strength - a.strength)[0];
  const gTrainer = game.leaderSkills!.assignments.find(assignment => assignment.owner === f.guild)!.leader;
  const gLeader = g.leaders.filter(leader => !leader.dead && leader.id !== gTrainer).sort((a, b) => b.strength - a.strength)[0];
  assert.ok(rLeader && gLeader);
  const rDial = Math.max(0, gLeader.strength - rLeader.strength) + 1;
  const gDial = Math.max(0, rLeader.strength - gLeader.strength) + 1;
  assert.ok(rDial < 8 && gDial <= 6 && r.spice >= rDial && g.spice >= gDial);
  for (const [actor, leader, dial] of [[f.richese, rLeader.id, rDial], [f.guild, gLeader.id, gDial]] as const)
    game = allow(applyAction(game, actor, { type: 'battlePlan', leader, dial, support: dial, weapon: null, defense: null }));
  const revealed = snapshot(game), quote = quoteBattle(game);
  assert.equal(rDial + rLeader.strength, gDial + gLeader.strength);
  assert.equal(quote.winner, f.richese);
  assert.equal(quote.sukGraduate, undefined, 'Hidden unselected Suk does not rescue casualties');
  assert.equal(viewGame(game, f.richese).battle!.strongholdEffects[f.richese], 'habbanya_ridge_sietch');
  game = finishBattle(game);
  assert.equal(player(game, f.richese).forces[f.location], 8 - rDial);
  assert.equal(player(game, f.richese).tanks, rDial);
  assert.equal(player(game, f.guild).tanks, 6);
  assert.equal(game.strongholdCards!.owners.habbanya_ridge_sietch, f.richese);
  assertBattleWallets(revealed, game); custody(game);
});

void test('original supplied skill offers and dealt hands survive module continuation; all four native policies pay one real pair tariff', () => {
  let lobby = createGame('AUTHPAIREDSKILLSMODULES', newPlayer('auth-r', 'R', 'richese'), true, ['choam']);
  joinGame(lobby, newPlayer('auth-c', 'C', 'choam'));
  joinGame(lobby, newPlayer('auth-g', 'G', 'guild'));
  joinGame(lobby, newPlayer('auth-a', 'A', 'atreides'));
  lobby = applyAction(lobby, lobby.host, { type: 'techTokens', enabled: true });
  lobby = applyAction(lobby, lobby.host, { type: 'strongholdCards', enabled: true });
  const setup = initializePairedChoamNexusSkillsModules({ initial: lobby }), saved = snapshot(setup);
  const f = fixture({ initial: setup });
  assert.deepEqual(setup, saved);
  assert.deepEqual(f.initial, saved, 'Continuation cannot recreate saved offers or the first native deal');
  assert.deepEqual([f.richese, f.choam, f.guild, f.observer], ['auth-r', 'auth-c', 'auth-g', 'auth-a']);
  for (const p of saved.players) assert.deepEqual(player(f.afterSetup, p.id).hand, p.hand);
  const absent = setup.leaderSkills!.deck.find(skill => !setup.leaderSkills!.offers[f.richese].cards.includes(skill))!;
  assert.throws(() => fixture({ initial: setup, richeseSkill: absent }));
  assert.deepEqual(setup, saved);
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(f.game, f.richese);
    view.players.find(p => p.id === f.richese)!.bot = difficulty;
    const action = botActions(view)[0];
    assert.ok(action?.type === 'ship' && action.noField && action.revealedToken, difficulty);
    const shipped = allow(applyAction(f.game, f.richese, action));
    assert.equal(shipped.nexusRicheseCunningLast!.stage, 'shipped', difficulty);
    assert.ok(typeof action.territory === 'string');
    const tariff = reserveShipmentCost({ faction: 'richese', halfRate: false }, territory(action.territory).type, 1);
    assert.equal(player(shipped, f.richese).spice, player(f.game, f.richese).spice - tariff);
    assert.equal(player(shipped, f.guild).spice, player(f.game, f.guild).spice + tariff);
    assert.equal(shipped.nexusCards!.cards!.hands[f.richese], null);
    custody(shipped);
  }
});

void test('two-seat original SH/Skills setup plays actual Storm without pretending an unallied closing Nexus draw is available', () => {
  const setup = initializePairedChoamNexusSkillsModules({ factions: ['richese', 'choam'], tech: false, strongholds: true });
  const saved = snapshot(setup), playing = completePairedChoamSkillsModulesSetup(setup);
  for (const p of saved.players) assert.deepEqual(player(playing, p.id).hand, p.hand);
  const firstStorm = toPhase(playing, 1);
  assert.equal(firstStorm.turn, 1);
  assert.equal(firstStorm.nexusCards!.cards!.deck.length, 12);
  assert.ok(Object.values(firstStorm.nexusCards!.cards!.hands).every(card => card === null));
  assert.throws(() => fixture({ initial: saved }), /Both own Cunning draws require/);
  assert.deepEqual(setup, saved);
  custody(firstStorm);
});
