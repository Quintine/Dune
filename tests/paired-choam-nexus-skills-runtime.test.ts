import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { presenceAt } from '../game/force-presence';
import { territory } from '../game/board';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { reserveShipmentCost } from '../game/shipment-price';
import { isPlanetologistBattleSpecialCard } from '../game/leader-skill-combat';
import {
  advancePairedChoamSkills, advancePairedChoamSkillsToPhase, allowPairedChoamSkills,
  assertPairedChoamSkillsCustody as custody, completePairedChoamSkillsSetup,
  createPairedChoamNexusSkillsFixture, finishPairedSkillsBattle, holdPairedSkillsCard,
  initializePairedChoamNexusSkills, openPairedSkillsBattle, pairedSkillsBattlePlans,
  pairedSkillsChoamCunningRequest, pairedSkillsClean, pairedSkillsPhysicalCards,
  pairedSkillsPlayer as player, pairedSkillsRicheseCunningRequest, pairedSkillsSnapshot,
  placePairedSkillsForce, revealPairedSkillsRichese, stagePairedSkillsPlanetologistRoute,
  quotePairedSkillsBattle,
  stepPairedChoamSkills, type PairedChoamNexusSkillsFixture,
} from './fixture-paired-choam-nexus-skills';

function reject(game: Game, actor: string, action: Action): void {
  const before = pairedSkillsSnapshot(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'Illegal composition preserves original spice, cards, markers, forces and skill custody');
}
function assertPair(f: PairedChoamNexusSkillsFixture, shipped: Game, faceup: number): void {
  const request = pairedSkillsRicheseCunningRequest(f), before = player(f.game, f.richese), after = player(shipped, f.richese);
  assert.equal(after.spice, before.spice - 1);
  assert.equal(player(shipped, f.guild).spice, player(f.game, f.guild).spice + 1, 'One original one-marker Stronghold tariff, not eight counter invoices');
  assert.equal(after.reserves, before.reserves - faceup);
  assert.equal(after.forces[f.location] ?? 0, faceup);
  assert.equal(after.noField!.deployed!.tokenId, request.noField);
  assert.equal(after.noField!.lastShipped, request.noField);
  assert.equal(presenceAt(after, 'habbanya_ridge_sietch'), faceup + 1, 'The second group is one concealed marker, not extra ordinary force identity');
  assert.equal(shipped.nexusCards!.cards!.hands[f.richese], null);
  assert.equal(shipped.nexusRicheseCunningLast!.stage, 'shipped');
  assert.equal(after.shipped, true);
  assert.deepEqual(shipped.leaderSkills!.assignments, f.game.leaderSkills!.assignments, 'Cunning neither borrows nor fabricates a companion skill');
  assert.deepEqual(pairedSkillsPhysicalCards(shipped), pairedSkillsPhysicalCards(f.afterSetup));
  custody(shipped);
}

for (const advanced of [false, true]) void test(`paired E2 ${advanced ? 'Advanced' : 'Basic'}: actual previous marker, all14 skill assignments, worm/alliance/closing draws and single physical pair invoice`, () => {
  const f = createPairedChoamNexusSkillsFixture({ advanced });
  assert.equal(f.initial.richeseCache!.length, 10);
  assert.equal(pairedSkillsPhysicalCards(f.initial).length, 45, 'Original CHOAM35 plus separate Richese10, not canonical47 or a mixed deck');
  for (const p of f.initial.players) assert.equal(p.hand.length, 1, 'Native starting cards are dealt before original skill offers');
  assert.equal(f.afterSetup.leaderSkills!.assignments.length, 4);
  assert.equal(f.beforeFirstMentat.turn, 1);
  assert.equal(f.afterFirstMentat.turn, 2);
  assert.equal(f.beforeAlliance.nexus, true);
  assert.equal(player(f.beforeClosingDraw, f.guild).ally, f.observer);
  assert.equal(player(f.beforeClosingDraw, f.observer).ally, f.guild);
  for (const draw of f.closingDraws) {
    assert.equal(draw.before.nexusCards!.cards!.hands[draw.step.actor], null);
    assert.equal(draw.after.nexusCards!.cards!.hands[draw.step.actor], player(draw.after, draw.step.actor).faction);
  }
  const previous = player(f.game, f.richese).noField!.tokens.find(t => t.value === 0)!;
  assert.equal(player(f.firstShipment.after, f.richese).spice, player(f.firstShipment.before, f.richese).spice - 1);
  assert.equal(player(f.firstShipment.after, f.richese).reserves, player(f.firstShipment.before, f.richese).reserves);
  assert.equal(player(f.game, f.richese).noField!.lastShipped, previous.id);
  const request = pairedSkillsRicheseCunningRequest(f);
  reject(f.game, f.richese, { ...request, noField: previous.id });
  reject(f.game, f.richese, { ...request, revealedToken: previous.id });
  reject(f.game, f.richese, { ...request, revealedToken: request.noField });
  reject(f.game, f.richese, { ...request, smuggler: true });
  reject(f.game, f.richese, { ...request, amount: 8 });
  holdPairedSkillsCard(f.game, f.observer, card => card.effect === 'karama', f.staging);
  const declared = applyAction(f.game, f.richese, request);
  assert.equal(declared.response?.kind, 'richeseNoField');
  assert.equal(declared.pendingShipment!.cost, 1);
  assert.equal(declared.pendingShipment!.amount, 1);
  assert.equal(declared.pendingShipment!.noFieldSkillProof, undefined, 'Original signed pair, not an invented ordinary skill proof');
  assert.equal(declared.pendingShipment!.smugglerCompanion, undefined);
  assert.deepEqual(player(declared, f.richese).forces, player(f.game, f.richese).forces);
  assert.equal(player(declared, f.richese).spice, player(f.game, f.richese).spice);
  const changed = pairedSkillsSnapshot(declared);
  changed.pendingShipment!.cost = 0;
  const responder = changed.players.find(p => !changed.response!.passed.includes(p.id))!.id;
  reject(changed, responder, { type: 'passResponse' });
  const shipped = allowPairedChoamSkills(pairedSkillsSnapshot(declared));
  assertPair(f, shipped, 5);
  reject(shipped, f.richese, request);
  const continued = allowPairedChoamSkills(shipped);
  assert.equal(player(continued, f.richese).spice, player(shipped, f.richese).spice, 'Settled response cannot repeat or refund the invoice');
  assert.equal(player(continued, f.guild).spice, player(shipped, f.guild).spice);
});

void test('paired Richese immediate group is reserve-capped; voluntary reveal cannot invent concealed counters and next native shipment respects original marker history', () => {
  const f = createPairedChoamNexusSkillsFixture({ advanced: false, reserveCap: 2 });
  const shipped = allowPairedChoamSkills(applyAction(f.game, f.richese, pairedSkillsRicheseCunningRequest(f)));
  assertPair(f, shipped, 2);
  const revealed = revealPairedSkillsRichese(shipped, f.richese);
  assert.equal(player(revealed, f.richese).noField!.deployed, null);
  assert.equal(player(revealed, f.richese).forces[f.location], 2);
  assert.equal(player(revealed, f.richese).reserves, 0);
  const previous = player(revealed, f.richese).noField!.lastShipped!;
  let next = advancePairedChoamSkills(revealed, g => g.turn === 3 && g.phase === 1 && pairedSkillsClean(g));
  // Preserve already played discards; order only unused native land cards.
  const land = next.spiceDeck.filter(c => 'territory' in c).slice(0, 2);
  assert.equal(land.length, 2);
  for (const [at, card] of land.entries()) next.spiceDeck.splice(at, 0, next.spiceDeck.splice(next.spiceDeck.indexOf(card), 1)[0]);
  next = advancePairedChoamSkills(next, g => g.turn === 3 && g.phase === 5 && g.active === f.richese && pairedSkillsClean(g));
  reject(next, f.richese, { type: 'ship', noField: previous, event: player(next, f.richese).noFieldEvent, territory: 'polar_sink', sector: 0 });
  const zero = player(next, f.richese).noField!.tokens.find(t => t.value === 0)!;
  const accepted = allowPairedChoamSkills(applyAction(next, f.richese, { type: 'ship', noField: zero.id, event: player(next, f.richese).noFieldEvent, territory: 'polar_sink', sector: 0 }));
  assert.equal(player(accepted, f.richese).noField!.lastShipped, zero.id);
  assert.equal(player(accepted, f.richese).noField!.deployed!.tokenId, zero.id);
  assert.equal(player(accepted, f.richese).spice, player(next, f.richese).spice - 2);
  assert.equal(player(accepted, f.richese).forces['polar_sink:0'], 18);
  custody(accepted);
});

void test('paired skills Cunning stopped by physical Karama spends only Nexus; ordinary shipment remains a separate single payment', () => {
  const f = createPairedChoamNexusSkillsFixture();
  const karama = holdPairedSkillsCard(f.game, f.guild, c => c.kind === 'special' && c.effect === 'karama', f.staging);
  const before = pairedSkillsSnapshot(f.game), request = pairedSkillsRicheseCunningRequest(f);
  const declared = applyAction(f.game, f.richese, request);
  const stopped = allowPairedChoamSkills(applyAction(declared, f.guild, { type: 'card', mode: 'cancel', card: karama.id }));
  assert.equal(stopped.nexusRicheseCunningLast!.stage, 'stopped');
  assert.equal(stopped.nexusCards!.cards!.hands[f.richese], null);
  for (const p of before.players) assert.equal(player(stopped, p.id).spice, p.spice);
  assert.deepEqual(player(stopped, f.richese).forces, player(before, f.richese).forces);
  assert.equal(player(stopped, f.richese).reserves, player(before, f.richese).reserves);
  assert.deepEqual(player(stopped, f.richese).noField, player(before, f.richese).noField);
  assert.equal(player(stopped, f.richese).shipped, false);
  assert.equal(stopped.discard.filter(c => c.id === karama.id).length, 1);
  reject(stopped, f.richese, request);
  const ordinary = allowPairedChoamSkills(applyAction(stopped, f.richese, { type: 'ship', amount: 1, territory: 'habbanya_ridge_sietch', sector: Number(f.location.split(':')[1]) }));
  assert.equal(player(ordinary, f.richese).spice, player(stopped, f.richese).spice - 1);
  assert.equal(player(ordinary, f.guild).spice, player(stopped, f.guild).spice + 1);
  assert.equal(player(ordinary, f.richese).forces[f.location], 1);
  assert.deepEqual(ordinary.leaderSkills!.assignments, before.leaderSkills!.assignments);
  custody(ordinary);
});

void test('genuine unpaid Richese pair preserves both original markers, physical Nexus, reserves and skill assignment', () => {
  const f = createPairedChoamNexusSkillsFixture();
  const amount = player(f.game, f.richese).spice;
  assert.ok(amount > 0);
  const unpaid = applyAction(f.game, f.richese, { type: 'bribe', target: f.guild, amount });
  assert.equal(player(unpaid, f.richese).spice, 0);
  assert.equal(player(unpaid, f.guild).bribes, player(f.game, f.guild).bribes + amount, 'Wallet is depleted by a genuine native bribe, never assigned');
  const before = pairedSkillsSnapshot(unpaid);
  reject(unpaid, f.richese, pairedSkillsRicheseCunningRequest(f, unpaid));
  assert.equal(unpaid.nexusCards!.cards!.hands[f.richese], 'richese');
  assert.deepEqual(player(unpaid, f.richese).noField, player(before, f.richese).noField);
  custody(unpaid);
});

for (const advanced of [false, true]) for (const trained of [false, true])
  void test(`paired ${advanced ? 'Advanced' : 'Basic'} voluntary reveal → ordinary ${trained ? 'skilled' : 'normal'} Suk rescue; native CHOAM support income stays separate from Collection`, () => {
    const f = createPairedChoamNexusSkillsFixture({ advanced });
    let game = allowPairedChoamSkills(applyAction(f.game, f.richese, pairedSkillsRicheseCunningRequest(f)));
    game = revealPairedSkillsRichese(game, f.richese);
    assert.equal(player(game, f.richese).noField!.deployed, null);
    assert.equal(player(game, f.richese).forces[f.location], 8);
    assert.equal(player(game, f.richese).reserves, 12);
    placePairedSkillsForce(game, f.guild, f.location, 3, f.staging);
    placePairedSkillsForce(game, f.choam, `arrakeen:${territory('arrakeen').sectors[0]}`, 1, f.staging);
    game = openPairedSkillsBattle(game, f.richese, f.guild, { band: trained ? 'skilled' : 'normal' });
    const plans = pairedSkillsBattlePlans(game, f.richese, f.guild, 2, trained);
    assert.equal(plans[0].action.leader === f.trainers.richese, trained);
    for (const next of plans) game = allowPairedChoamSkills(stepPairedChoamSkills(game, next));
    assert.ok(game.battle?.revealed);
    const revealed = pairedSkillsSnapshot(game), quote = quotePairedSkillsBattle(game);
    assert.equal(quote.result, 'normal');
    assert.equal(quote.winner, f.richese);
    assert.equal(quote.sukGraduate!.mode, trained ? 'skilled' : 'normal');
    assert.equal(viewGame(game, f.richese).battle!.ownForces!.normal, 8, 'Both marker groups now have ordinary native physical force identity');
    const payment = quote.payments.find(p => p.player === f.richese);
    assert.equal(payment?.ownPayment ?? 0, advanced ? 2 : 0);
    assert.equal(payment?.bankSupport ?? 0, 0);
    if (advanced) {
      assert.equal(quote.choamIncome!.owner, f.choam);
      assert.ok(quote.choamIncome!.amount > 0);
    } else assert.equal(quote.choamIncome, null);
    game = finishPairedSkillsBattle(game);
    assert.equal(game.lastBattleContext!.winner, f.richese);
    assert.equal(game.lastBattleContext!.result, 'normal');
    assert.equal(player(game, f.richese).forces[f.location], trained ? 7 : 6);
    assert.equal(player(game, f.richese).reserves, 13, 'Skilled Suk keeps one rescued casualty on its original sector and returns the other; normal Suk returns one');
    assert.equal(player(game, f.richese).tanks, trained ? 0 : 1);
    assert.equal(player(game, f.guild).tanks, 3, 'Declining a traitor call still loses all opposing physical forces in an ordinary battle');
    game = advancePairedChoamSkillsToPhase(game, 7);
    const collection = quoteSpiceCollection({ ...game, players: game.players.map(p => ({ ...p, spice: 0 })) }).receipts;
    assert.equal(collection.find(r => r.player === f.choam)!.strongholds, advanced ? 2 : 0, 'Native Arrakeen Collection is a separate later credit, not battle support income');
    for (const p of revealed.players) {
      const support = quote.payments.find(r => r.player === p.id)?.ownPayment ?? 0;
      const income = quote.choamIncome?.owner === p.id ? quote.choamIncome.amount : 0;
      const city = collection.find(r => r.player === p.id);
      assert.equal(player(game, p.id).spice, p.spice - support + income + (city?.strongholds ?? 0) + (city?.collected ?? 0));
    }
    custody(game);
  });

void test('CHOAM own Cunning converts one original Special into printed Kulon fuel once; ordinary Planetologist route consumes physical forces, not another card', () => {
  const f = createPairedChoamNexusSkillsFixture({ advanced: false });
  let game = advancePairedChoamSkills(f.movementStart, g => g.phase === 5 && g.active === f.choam && pairedSkillsClean(g));
  const assignment = game.leaderSkills!.assignments.find(a => a.owner === f.choam)!;
  assert.equal(assignment.skill, 'planetologist');
  const fuel = holdPairedSkillsCard(game, f.choam, isPlanetologistBattleSpecialCard, f.staging);
  holdPairedSkillsCard(game, f.guild, card => card.effect === 'karama', f.staging);
  const route = stagePairedSkillsPlanetologistRoute(game, f.choam, f.staging);
  const request = pairedSkillsChoamCunningRequest(game, f.choam, fuel.id), before = pairedSkillsSnapshot(game);
  reject(before, f.choam, route.action);
  reject(before, f.choam, { ...request, nexus: 'stale-original-offer' });
  game = applyAction(game, f.choam, request);
  assert.equal(game.response?.kind, 'choamWorthless');
  assert.equal(game.nexusCards!.cards!.hands[f.choam], null);
  assert.deepEqual(player(game, f.choam).hand.find(c => c.id === fuel.id), fuel, 'Original response retains printed fuel custody until resolution');
  game = allowPairedChoamSkills(game);
  assert.equal(game.nexusChoamLast!.stage, 'complete');
  assert.equal(game.discard.filter(c => c.id === fuel.id).length, 1);
  assert.equal(player(game, f.choam).hand.some(c => c.id === fuel.id), false);
  assert.equal(game.choamMovement!.bonus, 1);
  assert.deepEqual(game.leaderSkills!.assignments, before.leaderSkills!.assignments);
  reject(game, f.choam, request);
  reject(game, f.choam, { ...route.action, noField: 'not-an-ordinary-route' });
  const moved = allowPairedChoamSkills(applyAction(game, f.choam, route.action));
  assert.equal(player(moved, f.choam).forces[route.from] ?? 0, 0);
  assert.equal(player(moved, f.choam).forces[route.to], 1);
  assert.equal(player(moved, f.choam).moved, 1);
  assert.equal(moved.discard.filter(c => c.id === fuel.id).length, 1);
  for (const p of before.players) assert.equal(player(moved, p.id).spice, p.spice);
  custody(moved);
});

void test('canceling actual CHOAM Cunning consumes Karama and Nexus, retains the original skill-eligible Special and gives no Kulon route', () => {
  const f = createPairedChoamNexusSkillsFixture({ advanced: false });
  let game = advancePairedChoamSkills(f.movementStart, g => g.phase === 5 && g.active === f.choam && pairedSkillsClean(g));
  const fuel = holdPairedSkillsCard(game, f.choam, isPlanetologistBattleSpecialCard, f.staging);
  const karama = holdPairedSkillsCard(game, f.guild, c => c.kind === 'special' && c.effect === 'karama' && c.id !== fuel.id, f.staging);
  const route = stagePairedSkillsPlanetologistRoute(game, f.choam, f.staging), before = pairedSkillsSnapshot(game);
  const request = pairedSkillsChoamCunningRequest(game, f.choam, fuel.id);
  game = applyAction(game, f.choam, request);
  game = allowPairedChoamSkills(applyAction(game, f.guild, { type: 'card', mode: 'cancel', card: karama.id }));
  assert.equal(game.nexusChoamLast!.stage, 'canceled');
  assert.equal(game.nexusCards!.cards!.hands[f.choam], null);
  assert.deepEqual(player(game, f.choam).hand.find(c => c.id === fuel.id), fuel);
  assert.equal(game.discard.some(c => c.id === fuel.id), false);
  assert.equal(game.discard.filter(c => c.id === karama.id).length, 1);
  assert.equal(game.choamMovement?.bonus ?? 0, 0);
  assert.deepEqual(game.leaderSkills!.assignments, before.leaderSkills!.assignments);
  reject(game, f.choam, route.action);
  reject(game, f.choam, request);
  for (const p of before.players) assert.equal(player(game, p.id).spice, p.spice);
  custody(game);
});

void test('original authenticated setup preserves already-dealt native hands, saved offers and IDs through genuine native continuation', () => {
  const lobby = createGame('AUTHPAIREDE2SKILLS', newPlayer('auth-r', 'R', 'richese'), true, ['choam']);
  joinGame(lobby, newPlayer('auth-c', 'C', 'choam'));
  joinGame(lobby, newPlayer('auth-g', 'G', 'guild'));
  joinGame(lobby, newPlayer('auth-a', 'A', 'atreides'));
  const setup = initializePairedChoamNexusSkills({ initial: lobby }), saved = pairedSkillsSnapshot(setup);
  const f = createPairedChoamNexusSkillsFixture({ initial: setup });
  assert.deepEqual(setup, saved);
  assert.deepEqual(f.initial, saved, 'Actual initialized offers and first deal are not recreated');
  for (const p of saved.players) assert.deepEqual(player(f.afterSetup, p.id).hand, p.hand);
  assert.deepEqual([f.richese, f.choam, f.guild, f.observer], ['auth-r', 'auth-c', 'auth-g', 'auth-a']);
  const richeseOffer = setup.leaderSkills!.offers[f.richese];
  const absent = setup.leaderSkills!.deck.find(skill => !richeseOffer.cards.includes(skill))!;
  assert.throws(() => createPairedChoamNexusSkillsFixture({ initial: setup, richeseSkill: absent }));
  assert.deepEqual(setup, saved, 'An unavailable requested skill cannot replace saved offers');
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(f.game, f.richese);
    view.players.find(p => p.id === f.richese)!.bot = difficulty;
    const action = botActions(view)[0];
    assert.ok(action?.type === 'ship' && action.noField && action.revealedToken, difficulty);
    const shipped = allowPairedChoamSkills(applyAction(f.game, f.richese, action));
    assert.equal(shipped.nexusRicheseCunningLast!.stage, 'shipped', difficulty);
    assert.ok(typeof action.territory === 'string');
    const cost = reserveShipmentCost({ faction: 'richese', halfRate: false }, territory(action.territory).type, 1);
    assert.equal(player(shipped, f.richese).spice, player(f.game, f.richese).spice - cost);
    assert.equal(shipped.nexusCards!.cards!.hands[f.richese], null);
    custody(shipped);
  }
});

void test('both original E2 natives actually deal and assign all14 custody under Basic/Advanced two-to-six-seat native starts', () => {
  const additional = ['guild', 'atreides', 'emperor', 'harkonnen'] as const;
  for (const advanced of [false, true]) for (const seats of [2, 3, 4, 5, 6]) {
    const setup = initializePairedChoamNexusSkills({ advanced, factions: ['richese', 'choam', ...additional.slice(0, seats - 2)] });
    const starts = pairedSkillsSnapshot(setup);
    const game = completePairedChoamSkillsSetup(setup);
    assert.equal(game.leaderSkills!.assignments.length, seats);
    for (const p of starts.players) {
      assert.deepEqual(player(game, p.id).hand, p.hand);
    }
    assert.equal(player(game, 'richese').noField!.deployed, null);
    assert.equal(game.nexusCards!.cards!.deck.length, 12, 'Original Nexus cards are still physically undealt before the first real worm');
    custody(game);
    const firstStorm = advancePairedChoamSkillsToPhase(game, 1);
    assert.equal(firstStorm.turn, 1);
    assert.equal(firstStorm.phase, 1);
    custody(firstStorm);
  }
});
