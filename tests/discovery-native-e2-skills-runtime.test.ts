import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, handLimit, normalizeAutomaticGame, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { treacheryDeck, spiceDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { traitorDeck } from '../game/traitors';
import { DISCOVERY_SPICE_CARDS, validateDiscoveryState } from '../game/discoveries';
import { validateLeaderSkills } from '../game/leader-skills';
import { validateRicheseNoField } from '../game/richese-no-field';
import { createTechTokens, ownedTech, TECH_TOKENS } from '../game/tech-tokens';
import { strongholdBenefit, strongholdControllers } from '../game/stronghold-cards';
import { canUseAsKaramaRole, canUseAsTruthtranceRole } from '../game/shrine';
import {
  advanceDiscoveryNativeE2Skills, completeDiscoveryNativeE2SkillsSetup, createDiscoveryNativeE2SkillsFixture,
  discoveryNativeE2SkillsInvoiceAction, discoveryNativeE2SkillsMovementWindow,
  discoveryNativeE2SkillsPlayer as player, finishDiscoveryNativeE2SkillsBattle,
  holdDiscoveryNativeE2SkillsCard, prepareDiscoveryNativeE2SkillsMarkerBattle,
  revealDiscoveryNativeE2Skills, settleDiscoveryNativeE2Skills,
} from './fixture-discovery-native-e2-skills';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game));
function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
function custody(game: Game): void {
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? [])];
  assert.deepEqual(cards.map(card => card.id).sort(),
    [...treacheryDeck(game.expansions), ...richeseCards()].map(card => card.id).sort());
  assert.equal(new Set(cards.map(card => card.id)).size, cards.length);
  for (const p of game.players) {
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((total, amount) => total + amount, 0), 20);
    if (p.noField) validateRicheseNoField(p.noField);
  }
  validateLeaderSkills(game.leaderSkills!, game.players);
  validateDiscoveryState(game.discoveries!);
  if (game.status === 'playing') {
    const held = [...(game.traitorReserve ?? []), ...game.players.flatMap(p => [...p.traitors, ...p.traitorChoices])];
    assert.deepEqual(held.sort(), traitorDeck(game.players, game.expansions.includes('ix')).sort());
    assert.equal(new Set(held).size, held.length);
  }
}

// Source composition: LEADER_SKILLS_RUNTIME.md native Richese/Advanced CHOAM,
// CHOAM_LEADER_SKILLS.md, DISCOVERY_COMPONENTS.md and original native marker
// fixture. No Banker income, Mentat questions or mixed No-Field interpretation.
for (const advanced of [false, true]) for (const tech of [false, true]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} original all14 E2/Discovery preserves independent ordinary/cache custody with ${tech ? 'native Tech' : 'no Tech'}`, () => {
    const f = createDiscoveryNativeE2SkillsFixture({ advanced, tech, strongholds: advanced });
    const ordinary = [...f.setup.deck, ...f.setup.players.flatMap(p => p.hand)];
    assert.equal(ordinary.length, 35);
    assert.deepEqual(ordinary.map(c => c.id).sort(), treacheryDeck(['choam']).map(c => c.id).sort());
    assert.deepEqual(f.setup.richeseCache!.map(c => c.id).sort(), richeseCards().map(c => c.id).sort());
    assert.equal(f.setup.richeseCache!.length, 10);
    assert.equal(f.setup.leaderSkills!.deck.length + Object.values(f.setup.leaderSkills!.offers).reduce((n, o) => n + o.cards.length, 0), 14);
    assert.ok(f.setup.players.every(p => p.traitors.length === 0 && p.traitorChoices.length === 0));
    assert.equal(f.setup.spiceDeck.length, spiceDeck().length + 7);
    assert.deepEqual(f.setup.spiceDeck.flatMap(c => 'territory' in c && c.discovery ? [c.discovery] : []).sort(),
      DISCOVERY_SPICE_CARDS.map(c => c.discovery).sort());
    assert.equal(f.setup.discoveries!.tokens.length, 8);
    assert.equal(viewGame(f.setup, f.richese).leaderSkills!.offer!.cards.includes('planetologist'), true);
    assert.equal(viewGame(f.setup, f.choam).leaderSkills!.offer!.cards.includes('smuggler'), true);
    assert.ok(player(f.game, f.richese).hand.some(c => c.id === f.green));
    assert.equal(f.game.richeseCache!.some(c => c.id === f.green), false);
    assert.ok(f.game.richeseCache!.length > 0, 'Two-turn bounded recipes do not bypass the exhausted-cache ruling.');
    assert.equal(f.game.spiceBankerIncomePreview, undefined);
    assert.equal(f.game.mentatQuestionPreview, undefined);
    if (tech) {
      assert.deepEqual(f.setup.techTokens, createTechTokens());
      assert.ok(TECH_TOKENS.every(token => f.afterFirstStorm.techTokens![token.id].owner !== null));
      assert.ok(TECH_TOKENS.every(token => f.afterFirstStorm.players.some(p => p.id === f.afterFirstStorm.techTokens![token.id].owner)));
    } else assert.equal(f.afterFirstStorm.techTokens, undefined);
    assert.deepEqual(f.afterSetup.leaderSkills!.assignments, f.game.leaderSkills!.assignments);
    custody(f.setup);
    custody(f.game);
  });
}

void test('actual original offers can train and finish native setup without a controlled shuffle or demanded skill', () => {
  const f = createDiscoveryNativeE2SkillsFixture({ advanced: true, kind: 'stash', useActualOffers: true });
  const offered = structuredClone(f.setup.leaderSkills!.offers);
  const after = completeDiscoveryNativeE2SkillsSetup(reload(f.setup), true);
  for (const assignment of after.leaderSkills!.assignments) {
    assert.ok(offered[assignment.owner].cards.includes(assignment.skill));
    assert.ok(player(f.setup, assignment.owner).leaders.some(l => l.id === assignment.leader));
  }
  assert.equal(after.leaderSkills!.assignments.length, after.players.length);
  assert.deepEqual(after.players.flatMap(p => p.hand).map(c => c.id).sort(), f.setup.players.flatMap(p => p.hand).map(c => c.id).sort());
  assert.equal(Object.keys(after.leaderSkills!.offers).length, 0);
  custody(after);
  custody(f.game);
});

for (const advanced of [false, true]) void test(`${advanced ? 'Advanced' : 'Basic'} CHOAM skill owner opens the native five-card Stash boundary, then every minimal policy disposes its actual sixth card once`, () => {
  const f = createDiscoveryNativeE2SkillsFixture({ advanced, kind: 'stash', tech: true, strongholds: advanced });
  const before = f.game, choam = player(before, f.choam);
  assert.equal(handLimit(choam), 5);
  while (choam.hand.length < handLimit(choam)) {
    const card = before.deck.shift();
    assert.ok(card); choam.hand.push(card);
  }
  f.staging.push('Conserved original undealt ordinary cards into CHOAM hand at its native five-card capacity.');
  const wallet = choam.spice, hand = choam.hand.map(c => c.id), drawn = before.deck[0];
  assert.ok(drawn);
  const revealed = revealDiscoveryNativeE2Skills(f);
  assert.equal(revealed.decision?.kind, 'discoveryDiscard');
  assert.equal(revealed.decision?.player, f.choam);
  assert.deepEqual(player(revealed, f.choam).hand.map(c => c.id), [...hand, drawn.id]);
  assert.equal(player(revealed, f.choam).spice, wallet);
  assert.equal(revealed.deck.length, before.deck.length - 1);
  assert.equal(viewGame(revealed, f.choam).players.find(p => p.id === f.choam)!.hand!.length, 6);
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(revealed, f.choam);
    view.players.find(p => p.id === f.choam)!.bot = difficulty;
    const action = botActions(view).find(a => a.type === 'decision' && typeof a.card === 'string');
    assert.ok(action, `${difficulty} must return a real owned disposal action.`);
    const done = settleDiscoveryNativeE2Skills(applyAction(reload(revealed), f.choam, action));
    assert.equal(player(done, f.choam).hand.length, 5);
    assert.equal(player(done, f.choam).spice, wallet);
    assert.equal(player(done, f.choam).hand.some(c => c.id === action.card), false);
    assert.equal(done.discard.filter(c => c.id === action.card).length, 1);
    assert.equal(done.discoveryStash!.stage, 'complete');
    assert.equal(done.discoveries!.tokens.find(t => t.id === f.token)!.status, 'removed');
    assert.deepEqual(done.leaderSkills!.assignments, revealed.leaderSkills!.assignments);
    reject(done, f.choam, action);
    reject(done, f.choam, { type: 'discovery', token: f.token, reveal: true });
    custody(done);
  }
  for (const physical of player(revealed, f.choam).hand) {
    const action: Action = { type: 'decision', event: revealed.discoveryStash!.event, card: physical.id };
    reject(revealed, f.richese, action);
    reject(revealed, f.choam, { ...action, event: 'stale-stash' });
    const done = settleDiscoveryNativeE2Skills(applyAction(reload(revealed), f.choam, action));
    assert.equal(done.discard.filter(c => c.id === physical.id).length, 1);
    assert.equal(player(done, f.choam).hand.length, 5);
    assert.equal(done.deck.length, before.deck.length - 1);
    custody(done);
  }
  custody(revealed);
});

for (const advanced of [false, true]) void test(`${advanced ? 'Advanced' : 'Basic'} original first end-Mentat claims and source-local Shrine/Stronghold entitlement precede trained CHOAM invoice and Bureaucrat diversion`, () => {
  const f = createDiscoveryNativeE2SkillsFixture({ advanced, kind: 'invoice', tech: true, strongholds: advanced });
  const checkpoint = discoveryNativeE2SkillsMovementWindow(f, f.choam), before = checkpoint.game;
  assert.deepEqual(f.setup.techTokens, createTechTokens());
  assert.ok(TECH_TOKENS.every(t => f.afterFirstStorm.techTokens![t.id].owner !== null));
  if (advanced) {
    assert.equal(checkpoint.beforeFirstMentat.strongholdCards!.claimedTurn, 0);
    assert.equal(checkpoint.afterFirstMentat.strongholdCards!.claimedTurn, 1);
    const expected = strongholdControllers(checkpoint.beforeFirstMentat.players, false);
    assert.deepEqual(checkpoint.afterFirstMentat.strongholdCards!.owners, expected);
    const claims = Object.entries(expected).filter(([, owner]) => owner);
    assert.ok(claims.length > 0);
    for (const [territory, owner] of claims) {
      assert.equal(strongholdBenefit(checkpoint.afterFirstMentat.strongholdCards, owner!, territory), territory);
      assert.equal(strongholdBenefit(checkpoint.afterFirstMentat.strongholdCards, owner!, 'shrine'), null);
      assert.equal(strongholdBenefit(checkpoint.afterFirstMentat.strongholdCards, f.observer === owner ? f.choam : f.observer, territory), null);
    }
  }
  assert.equal(player(before, f.guild).forces['shrine:0'], 1);
  const truth = holdDiscoveryNativeE2SkillsCard(before, f.guild, c => c.effect === 'truthtrance', f.staging);
  const karama = holdDiscoveryNativeE2SkillsCard(before, f.guild, c => c.effect === 'karama', f.staging);
  assert.equal(canUseAsKaramaRole(before, player(before, f.guild), truth), true);
  assert.equal(canUseAsTruthtranceRole(before, player(before, f.guild), karama), true);
  assert.equal(canUseAsKaramaRole(before, player(before, f.choam), truth), false);
  assert.equal(canUseAsTruthtranceRole(before, player(before, f.choam), karama), false);
  const invoice = discoveryNativeE2SkillsInvoiceAction(before);
  const own = structuredClone(player(before, f.choam)), recipient = player(before, f.guild).spice;
  let paid = applyAction(reload(before), f.choam, invoice.action);
  paid = advanceDiscoveryNativeE2Skills(paid, g => g.decision?.kind === 'bureaucratPayment');
  assert.ok(paid.decision?.kind === 'bureaucratPayment');
  const pending = paid.bureaucratPayments!.pending!;
  assert.deepEqual({ kind: pending.source.kind, payer: pending.source.payer, payee: pending.source.payee, amount: pending.source.amount },
    { kind: 'shipment', payer: f.choam, payee: f.guild, amount: 5 });
  assert.equal(pending.owner, f.observer);
  assert.equal(player(paid, f.choam).spice, own.spice - 5);
  assert.equal(player(paid, f.choam).reserves, own.reserves - 6);
  assert.equal(player(paid, f.choam).forces[invoice.key], 6);
  assert.equal(player(paid, f.guild).spice, recipient);
  for (const redirect of [false, true]) {
    const decision: Action = { type: 'decision', event: paid.decision!.event, redirect };
    reject(paid, f.choam, decision);
    reject(paid, f.observer, { ...decision, event: 'stale-payment' });
    const done = settleDiscoveryNativeE2Skills(applyAction(reload(paid), f.observer, decision));
    assert.equal(player(done, f.choam).spice, own.spice - 5);
    assert.equal(player(done, f.guild).spice, recipient + (redirect ? 3 : 5));
    assert.equal(player(done, f.observer).spice, player(paid, f.observer).spice);
    assert.equal(done.bureaucratPayments!.used.length, redirect ? 1 : 0);
    assert.equal(done.bureaucratPayments!.pending, undefined);
    assert.equal(done.techTokens!.heighliners.spice, paid.techTokens!.heighliners.spice);
    reject(done, f.observer, decision);
    custody(done);
  }
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(paid, f.observer);
    view.players.find(p => p.id === f.observer)!.bot = difficulty;
    const action = botActions(view).find(a => a.type === 'decision' && typeof a.redirect === 'boolean');
    assert.ok(action);
    const done = settleDiscoveryNativeE2Skills(applyAction(reload(paid), f.observer, action));
    assert.equal(player(done, f.guild).spice, recipient + (action.redirect ? 3 : 5));
    assert.equal(player(done, f.choam).forces[invoice.key], 6);
    assert.equal(player(done, f.choam).spice, own.spice - 5);
    custody(done);
  }
});

for (const advanced of [false, true]) void test(`${advanced ? 'Advanced' : 'Basic'} actual CHOAM Kulon fuel preserves the trained invoice, discards once and grants its native movement bonus`, () => {
  const f = createDiscoveryNativeE2SkillsFixture({ advanced, kind: 'invoice' });
  const checkpoint = discoveryNativeE2SkillsMovementWindow(f, f.choam);
  const before = checkpoint.game;
  const fuel = holdDiscoveryNativeE2SkillsCard(before, f.choam, c => c.name === 'Kulon' && c.kind === 'worthless', f.staging);
  // Keep a real cancellation opportunity open to observe held fuel, not a fake receipt.
  holdDiscoveryNativeE2SkillsCard(before, f.observer, c => c.effect === 'karama', f.staging);
  const action: Action = { type: 'card', mode: 'choam', card: fuel.id };
  const wallet = player(before, f.choam).spice, reserves = player(before, f.choam).reserves;
  const requested = applyAction(reload(before), f.choam, action);
  assert.equal(requested.response?.kind, 'choamWorthless');
  assert.deepEqual(player(requested, f.choam).hand.find(c => c.id === fuel.id), fuel);
  assert.equal(requested.discard.some(c => c.id === fuel.id), false);
  const done = settleDiscoveryNativeE2Skills(requested);
  assert.equal(done.discard.filter(c => c.id === fuel.id).length, 1);
  assert.equal(player(done, f.choam).hand.some(c => c.id === fuel.id), false);
  assert.equal(done.choamMovement!.bonus, 1);
  assert.equal(player(done, f.choam).spice, wallet);
  assert.equal(player(done, f.choam).reserves, reserves);
  assert.deepEqual(done.leaderSkills!.assignments, before.leaderSkills!.assignments);
  reject(done, f.choam, action);
  const invoice = discoveryNativeE2SkillsInvoiceAction(done);
  const paid = settleDiscoveryNativeE2Skills(applyAction(reload(done), f.choam, invoice.action));
  assert.equal(player(paid, f.choam).spice, wallet - 5);
  assert.equal(player(paid, f.choam).reserves, reserves - 6);
  assert.equal(player(paid, f.choam).forces[invoice.key], 6);
  assert.equal(paid.choamMovement!.bonus, 1);
  custody(paid);
});

for (const advanced of [false, true]) for (const marker of [0, 3, 5] as const) {
  void test(`${advanced ? 'Advanced' : 'Basic'} nested marker-only ${marker} keeps paid custody until both plans then applies capped physical reveal and canonical green Planetologist strength`, () => {
    const f = createDiscoveryNativeE2SkillsFixture({ advanced, tech: true, strongholds: advanced });
    const battle = prepareDiscoveryNativeE2SkillsMarkerBattle(f, { marker, ...(marker === 5 ? { reserveCap: 3 } : {}) });
    const before = player(battle.beforeShipment, f.richese), shipped = player(battle.afterShipment, f.richese);
    assert.equal(shipped.spice, before.spice - 1, 'Original Discovery locations use the stronghold shipment price, independently of victory eligibility.');
    assert.equal(shipped.reserves, before.reserves);
    assert.deepEqual(shipped.forces, before.forces);
    assert.deepEqual(shipped.noField!.tokens, before.noField!.tokens);
    assert.deepEqual(shipped.noField!.deployed!.location, { territory: 'shrine', sector: 0 });
    assert.equal(shipped.noField!.deployed!.tokenId, battle.token);
    const privateOpponent = viewGame(battle.game, f.guild);
    assert.equal(privateOpponent.richeseNoField!.private, null);
    assert.equal(privateOpponent.richeseNoField!.public.deployed!.effectiveForces, 1);
    reject(battle.game, f.richese, { ...battle.ownerPlan, dial: battle.materialized + 1, support: advanced ? battle.materialized + 1 : 0 });
    let game = applyAction(reload(battle.game), f.richese, battle.ownerPlan);
    assert.ok(player(game, f.richese).noField!.deployed);
    assert.equal(player(game, f.richese).forces[battle.key] ?? 0, 0);
    assert.equal(player(game, f.richese).reserves, shipped.reserves);
    assert.ok(player(game, f.richese).hand.some(c => c.id === f.green));
    game = applyAction(reload(game), f.guild, battle.opponentPlan);
    assert.equal(player(game, f.richese).noField!.deployed, null);
    assert.equal(player(game, f.richese).forces[battle.key] ?? 0, battle.materialized);
    assert.equal(player(game, f.richese).reserves, shipped.reserves - battle.materialized);
    assert.deepEqual(player(game, f.richese).noField!.tokens, before.noField!.tokens);
    game = finishDiscoveryNativeE2SkillsBattle(reload(game), 'cleanup');
    assert.equal(game.lastBattleContext!.winner, f.richese);
    const trainer = player(battle.game, f.richese).leaders.find(l => l.id === f.trainers.richese)!;
    assert.equal(player(game, f.richese).leaders.find(l => l.id === trainer.id)!.dead, false);
    assert.equal(player(game, f.guild).leaders.find(l => l.id === battle.opponentPlan.leader)!.dead, false);
    assert.equal(player(game, f.richese).tanks, before.tanks);
    assert.equal(player(game, f.guild).tanks, player(battle.game, f.guild).tanks + 8);
    assert.equal(player(game, f.richese).spice, player(battle.game, f.richese).spice, 'Zero support and inert green substitution charge no native fee or death bounty.');
    assert.equal(game.discard.filter(c => c.id === f.green).length, 1);
    assert.equal(player(game, f.richese).hand.some(c => c.id === f.green), false);
    const noGreenPlan = { ...battle.ownerPlan };
    delete noGreenPlan.weapon;
    let ordinary = applyAction(reload(battle.game), f.richese, noGreenPlan);
    ordinary = applyAction(ordinary, f.guild, battle.opponentPlan);
    ordinary = finishDiscoveryNativeE2SkillsBattle(ordinary, 'cleanup');
    assert.equal(ordinary.lastBattleContext!.winner, f.guild, 'Removing only the physical green substitute loses the same real battle.');
    assert.equal(player(ordinary, f.richese).hand.some(c => c.id === f.green), true);
    assert.equal(ordinary.discard.some(c => c.id === f.green), false);
    custody(ordinary);
    const loserTokens = ownedTech(battle.game.techTokens, f.guild);
    const done = finishDiscoveryNativeE2SkillsBattle(reload(game));
    if (loserTokens.length) {
      const changed = TECH_TOKENS.filter(t => battle.game.techTokens![t.id].owner !== done.techTokens![t.id].owner);
      assert.equal(changed.length, 1);
      assert.ok(loserTokens.includes(changed[0].id));
      assert.equal(done.techTokens![changed[0].id].owner, f.richese);
    }
    assert.equal(done.discard.filter(c => c.id === f.green).length, 1);
    assert.deepEqual(normalizeAutomaticGame(reload(done)), done);
    custody(done);
  });
}

void test('four minimal policies resolve actual nested marker plans into physical revelation and a completed casualty/skill consumer', () => {
  const f = createDiscoveryNativeE2SkillsFixture({ advanced: true, tech: true, strongholds: true });
  const battle = prepareDiscoveryNativeE2SkillsMarkerBattle(f, { marker: 5, reserveCap: 3 });
  for (const difficulty of DIFFICULTIES) {
    let game = reload(battle.game);
    for (let step = 0; !game.battle?.revealed && step < 100; step++) {
      let advanced = false;
      for (const seat of game.players) {
        const view = viewGame(game, seat.id);
        view.players.find(p => p.id === seat.id)!.bot = difficulty;
        const action = botActions(view)[0];
        if (!action) continue;
        game = applyAction(game, seat.id, action);
        advanced = true;
        break;
      }
      assert.ok(advanced, `${difficulty} needs an actual owned card, response or plan continuation.`);
    }
    assert.ok(game.battle?.revealed);
    assert.equal(player(game, f.richese).noField!.deployed, null);
    assert.equal(player(game, f.richese).forces[battle.key], 3);
    assert.equal(player(game, f.richese).reserves, 0);
    const done = finishDiscoveryNativeE2SkillsBattle(game);
    assert.ok(done.lastBattleContext?.winner === f.richese || done.lastBattleContext?.winner === f.guild);
    assert.equal(done.battle, null);
    assert.equal(player(done, f.richese).noField!.deployed, null);
    assert.equal(player(done, f.richese).noField!.lastShipped, battle.token);
    assert.equal(player(done, f.richese).tanks + (player(done, f.richese).forces[battle.key] ?? 0), 3);
    assert.deepEqual(player(done, f.richese).noField!.tokens, player(battle.game, f.richese).noField!.tokens);
    custody(done);
  }
});
