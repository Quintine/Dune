import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { emperorNexusModeSupported } from '../game/nexus-emperor-secret-ally';
import { nexusEmperorRevivalAction } from '../game/nexus-emperor-secret-ally-options';
import { nexusFremenRevivalAction } from '../game/nexus-fremen-revival-options';
import { forceRevivalQuote, forceRevivalRemaining } from '../game/revival';
import { quoteNexusGuildSecretShipment } from '../game/nexus-guild-secret-ally';
import { ownedTech } from '../game/tech-tokens';
import { territory } from '../game/board';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { holdNexusSkillsModulesPaymentsCard } from './fixture-nexus-skills-modules-payments';
import {
  advanceDiscoveryClassicNexusEffects, advanceDiscoveryClassicNexusEffectsToPhase,
  createDiscoveryClassicNexusEffectsFixture, discoveryClassicNexusEffectsInventory,
  discoveryClassicNexusEffectsPlayer, finishDiscoveryClassicNexusEffectsInteraction,
  finishDiscoveryClassicNexusNestedBattle, initializeDiscoveryClassicNexusEffectsSetup,
  openDiscoveryClassicNexusNestedBattle, payDiscoveryClassicNexusEffectsFixture,
  type DiscoveryClassicNexusEffectsFixture,
} from './fixture-discovery-classic-nexus-effects';

const wallets = (game: Game) => Object.fromEntries(game.players.map(player => [player.id, player.spice]));
function rejected(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'Rejected declarations retain original physical cards, counters and payment ledgers');
}
function legalPolicies(game: Game, actor: string): void {
  assert.equal(DIFFICULTIES.length, 4);
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, actor);
    view.players.find(player => player.id === actor)!.bot = difficulty;
    const actions = botActions(view);
    assert.ok(actions.length > 0, `${difficulty} must expose an original legal continuation`);
    for (const action of actions) discoveryClassicNexusEffectsInventory(applyAction(structuredClone(game), actor, action));
  }
}
function sourceTransitions(fixture: DiscoveryClassicNexusEffectsFixture): void {
  const revealer = fixture.kind === 'guild-shipment' ? fixture.opponent : fixture.actor;
  const beforeToken = fixture.beforeReveal.discoveries!.tokens.find(token => token.id === fixture.token)!;
  const afterToken = fixture.afterReveal.discoveries!.tokens.find(token => token.id === fixture.token)!;
  assert.equal(beforeToken.face, 'shrine'); assert.equal(beforeToken.revealedTurn, null);
  assert.equal(afterToken.revealedTurn, 1);
  assert.equal(fixture.beforeEntry.turn, 2); assert.equal(fixture.beforeEntry.phase, 0);
  const before = discoveryClassicNexusEffectsPlayer(fixture.beforeEntry, revealer);
  const after = discoveryClassicNexusEffectsPlayer(fixture.afterEntry, revealer);
  assert.equal(before.forces[fixture.source], 2); assert.equal(after.forces[fixture.source] ?? 0, 0);
  assert.equal(after.forces['shrine:0'], 2);
  assert.equal(after.reserves, before.reserves); assert.equal(after.tanks, before.tanks);
  assert.equal(after.spice, before.spice); assert.equal(after.shipped, before.shipped); assert.equal(after.moved, before.moved);
  assert.deepEqual(fixture.afterEntry.techTokens, fixture.beforeEntry.techTokens, 'Free next-turn entry does not trigger paid shipping industry');
  assert.equal(fixture.beforeClosingDraw.nexusCards!.phase!.stage, 'drawing');
  assert.equal(fixture.beforeClosingDraw.players.find(player => player.id === fixture.actor)!.ally, null);
  assert.equal(fixture.afterClosingDraw.nexusCards!.cards!.hands[fixture.actor],
    fixture.kind === 'guild-shipment' ? 'guild' : fixture.kind === 'fremen-revival' ? 'fremen' : 'emperor');
  discoveryClassicNexusEffectsInventory(fixture.game);
}
function unchangedCustody(before: Game, after: Game): void {
  assert.deepEqual(after.discoveries, before.discoveries);
  assert.deepEqual(after.strongholdCards, before.strongholdCards);
  for (const player of before.players) assert.deepEqual(viewGame(after, player.id).discoveries, viewGame(before, player.id).discoveries);
  discoveryClassicNexusEffectsInventory(after);
}
const configurations = [
  { name: 'Basic', advanced: false, tech: false, strongholds: false },
  { name: 'Basic Tech', advanced: false, tech: true, strongholds: false },
  { name: 'Advanced', advanced: true, tech: false, strongholds: false },
  { name: 'Advanced Tech', advanced: true, tech: true, strongholds: false },
  { name: 'Advanced Strongholds', advanced: true, tech: false, strongholds: true },
  { name: 'Advanced Tech/Strongholds', advanced: true, tech: true, strongholds: true },
] as const;

for (const configuration of configurations) for (const kind of ['emperor-revival', 'fremen-revival'] as const) {
  void test(`${configuration.name} classic Discovery/Nexus ${kind} uses the real source, separate quota and once-only phase-end industry`, () => {
    const fixture = createDiscoveryClassicNexusEffectsFixture({ ...configuration, kind });
    sourceTransitions(fixture);
    if (configuration.strongholds) assert.equal(fixture.afterEntry.strongholdCards!.owners.arrakeen, fixture.actor);
    const privateView = viewGame(fixture.game, fixture.actor);
    const control = kind === 'emperor-revival' ? nexusEmperorRevivalAction(privateView, 0) : nexusFremenRevivalAction(privateView, 0);
    assert.deepEqual(control, fixture.paymentAction, 'Existing human controls bind the actual private physical card offer');
    assert.equal(kind === 'emperor-revival' ? viewGame(fixture.game, fixture.opponent).nexusEmperorSecretAlly
      : viewGame(fixture.game, fixture.opponent).nexusFremenRevival, null);
    legalPolicies(fixture.game, fixture.actor);
    rejected(fixture.game, fixture.opponent, fixture.paymentAction);
    rejected(fixture.game, fixture.actor, { ...fixture.paymentAction, event: 'stale' });
    rejected(fixture.game, fixture.actor, { ...fixture.paymentAction, bonus: true });
    const before = discoveryClassicNexusEffectsPlayer(fixture.game, fixture.actor);
    let paid = payDiscoveryClassicNexusEffectsFixture(fixture, structuredClone(fixture.game));
    const after = discoveryClassicNexusEffectsPlayer(paid, fixture.actor);
    assert.equal(after.reserves, before.reserves + 3); assert.equal(after.tanks, before.tanks - 3);
    assert.deepEqual(wallets(paid), wallets(fixture.game));
    assert.equal(after.revived, kind === 'fremen-revival' ? 3 : before.revived);
    assert.equal(after.freeForcesRevived ?? 0, kind === 'fremen-revival' ? 3 : before.freeForcesRevived ?? 0);
    assert.equal(forceRevivalRemaining(paid, after), kind === 'fremen-revival' ? 0 : 3);
    assert.equal(paid.nexusCards!.cards!.hands[fixture.actor], null);
    const card = kind === 'emperor-revival' ? 'emperor' : 'fremen';
    assert.equal(paid.nexusCards!.cards!.discard.filter(value => value === card).length, 1);
    const history = kind === 'emperor-revival' ? paid.nexusEmperorSecretHistory! : paid.nexusFremenRevivalHistory!;
    assert.equal(history.length, 1); assert.equal(history[0].owner, fixture.actor);
    assert.equal(history[0].turn, 2); assert.equal(history[0].phase, 4);
    assert.equal(history[0].before.tanks - history[0].after.tanks, 3);
    assert.equal(history[0].before.spice, history[0].after.spice);
    unchangedCustody(fixture.game, paid); rejected(paid, fixture.actor, fixture.paymentAction);
    if (kind === 'emperor-revival') {
      const quote = forceRevivalQuote(paid, after, 3);
      assert.equal(quote.cost, 2);
      paid = finishDiscoveryClassicNexusEffectsInteraction(applyAction(paid, fixture.actor, { type: 'revive', amount: 3 }));
      const ordinary = discoveryClassicNexusEffectsPlayer(paid, fixture.actor);
      assert.equal(ordinary.reserves, before.reserves + 6); assert.equal(ordinary.tanks, before.tanks - 6);
      assert.equal(ordinary.revived, 3); assert.equal(ordinary.freeForcesRevived, 2);
      assert.equal(ordinary.spice, before.spice - 2);
    } else rejected(paid, fixture.actor, { type: 'revive', amount: 1 });
    if (configuration.tech) {
      assert.equal(paid.techTokens!.axlotl.spice, fixture.tokenCount);
      assert.equal(paid.techTokens!.axlotl.triggeredTurn, 2);
    }
    const expected = wallets(paid);
    if (fixture.tokenOwner) expected[fixture.tokenOwner] += fixture.tokenCount;
    const movement = advanceDiscoveryClassicNexusEffectsToPhase(paid, 5);
    assert.deepEqual(wallets(movement), expected, 'Only real Revival-end Axlotl credit becomes spendable');
    if (configuration.tech) assert.equal(movement.techTokens!.axlotl.spice, 0);
    const completedMovement = advanceDiscoveryClassicNexusEffectsToPhase(movement, 6);
    const afterMovement = { ...expected };
    if (completedMovement.phase >= 7)
      for (const receipt of quoteSpiceCollection(movement).receipts) afterMovement[receipt.player] += receipt.strongholds + receipt.collected;
    assert.deepEqual(wallets(completedMovement), afterMovement, 'Only independently quoted Collection can accompany an auto-skipped empty Battle; Axlotl cannot pay twice');
    const nextTurn = advanceDiscoveryClassicNexusEffects(completedMovement, game => game.turn === 3);
    const nextRevival = advanceDiscoveryClassicNexusEffectsToPhase(nextTurn, 4);
    assert.equal(discoveryClassicNexusEffectsPlayer(nextRevival, fixture.actor).revived, 0);
    assert.equal(discoveryClassicNexusEffectsPlayer(nextRevival, fixture.actor).freeForcesRevived ?? 0, 0);
    assert.deepEqual(kind === 'emperor-revival' ? nextRevival.nexusEmperorSecretHistory : nextRevival.nexusFremenRevivalHistory, history);
    rejected(nextRevival, fixture.actor, fixture.paymentAction);
    discoveryClassicNexusEffectsInventory(nextRevival);
  });
}

void test('Advanced Discovery Emperor extra-three and Fremen free-three retain actual native elite subsets and the shared one-elite cap', () => {
  for (const kind of ['emperor-revival', 'fremen-revival'] as const) {
    const fixture = createDiscoveryClassicNexusEffectsFixture({ kind, advanced: true, tech: true, strongholds: true,
      ownerFaction: kind === 'emperor-revival' ? 'fremen' : 'emperor', eliteTanks: 2 });
    const view = viewGame(fixture.game, fixture.actor);
    assert.deepEqual(kind === 'emperor-revival' ? view.nexusEmperorSecretAlly!.revival.eliteOptions : view.nexusFremenRevival!.eliteOptions, [0, 1]);
    rejected(fixture.game, fixture.actor, { ...fixture.paymentAction, elite: 2 });
    legalPolicies(fixture.game, fixture.actor);
    const before = discoveryClassicNexusEffectsPlayer(fixture.game, fixture.actor);
    const paid = payDiscoveryClassicNexusEffectsFixture(fixture);
    const after = discoveryClassicNexusEffectsPlayer(paid, fixture.actor);
    assert.equal(after.elites!.reserves, before.elites!.reserves + 1);
    assert.equal(after.elites!.tanks, before.elites!.tanks - 1); assert.equal(after.elites!.revived, 1);
    assert.equal(after.reserves, before.reserves + 3); assert.equal(after.tanks, before.tanks - 3);
    assert.deepEqual(wallets(paid), wallets(fixture.game));
    rejected(paid, fixture.actor, { type: 'revive', amount: 1, elite: 1 });
    unchangedCustody(fixture.game, paid);
  }
});

void test('Discovery ordinary-first Emperor return is extra; ordinary-first Fremen is genuinely late and still rejected', () => {
  const emperor = createDiscoveryClassicNexusEffectsFixture({ advanced: true, tech: true, strongholds: true });
  const ordinary = finishDiscoveryClassicNexusEffectsInteraction(applyAction(emperor.game, emperor.actor, { type: 'revive', amount: 3 }));
  const paid = payDiscoveryClassicNexusEffectsFixture(emperor, ordinary);
  const before = discoveryClassicNexusEffectsPlayer(ordinary, emperor.actor), after = discoveryClassicNexusEffectsPlayer(paid, emperor.actor);
  assert.equal(after.reserves, before.reserves + 3); assert.equal(after.tanks, before.tanks - 3);
  assert.equal(after.spice, before.spice); assert.equal(after.revived, 3); assert.equal(after.freeForcesRevived, 2);
  assert.deepEqual(paid.techTokens, ordinary.techTokens);
  const fremen = createDiscoveryClassicNexusEffectsFixture({ kind: 'fremen-revival', advanced: true, tech: true });
  const late = finishDiscoveryClassicNexusEffectsInteraction(applyAction(fremen.game, fremen.actor, { type: 'revive', amount: 1 }));
  assert.match(viewGame(late, fremen.actor).nexusFremenRevival!.blocked ?? '', /before ordinary force revivals/);
  rejected(late, fremen.actor, fremen.paymentAction);
  for (const kind of ['emperor-revival', 'fremen-revival'] as const) {
    const short = createDiscoveryClassicNexusEffectsFixture({ kind, tanks: 2 });
    rejected(short.game, short.actor, short.paymentAction);
    assert.equal(discoveryClassicNexusEffectsPlayer(short.game, short.actor).tanks, 2);
  }
});

void test('an earned Discovery/Nexus Axlotl pile cannot settle through an unsettled real printed Truthtrance', () => {
  const fixture = createDiscoveryClassicNexusEffectsFixture({ advanced: true, tech: true, strongholds: true });
  let game = payDiscoveryClassicNexusEffectsFixture(fixture);
  const card = holdNexusSkillsModulesPaymentsCard(game, fixture.opponent, 'truthtrance', fixture.staging);
  const before = structuredClone(game);
  game = applyAction(game, fixture.opponent, { type: 'card', card: card.id });
  assert.ok(game.truthtrance); assert.equal(game.phase, 4);
  assert.deepEqual(wallets(game), wallets(before)); assert.equal(game.techTokens!.axlotl.spice, fixture.tokenCount);
  for (const player of game.players) rejected(game, player.id, { type: 'ready' });
  legalPolicies(game, game.players.find(player => !game.truthtrance!.passed.includes(player.id))!.id);
  const settled = finishDiscoveryClassicNexusEffectsInteraction(game);
  assert.equal(settled.truthtrance ?? null, null); assert.equal(settled.phase, 4);
  assert.deepEqual(wallets(settled), wallets(before)); assert.equal(settled.techTokens!.axlotl.spice, fixture.tokenCount);
  assert.ok(settled.discard.some(value => value.id === card.id && value.effect === 'truthtrance'));
  discoveryClassicNexusEffectsInventory(settled);
});

for (const configuration of [configurations[0], configurations[1], configurations[4], configurations[5]]) {
  void test(`${configuration.name} paid Guild Secret Ally nested Shrine arrival retains invoice/source identity and original battle reward once`, () => {
    const fixture = createDiscoveryClassicNexusEffectsFixture({ ...configuration, kind: 'guild-shipment' });
    sourceTransitions(fixture); legalPolicies(fixture.game, fixture.actor);
    const before = discoveryClassicNexusEffectsPlayer(fixture.game, fixture.actor);
    const quote = quoteNexusGuildSecretShipment(territory('shrine').type, 3);
    assert.equal(quote.cost, 2, 'A nested revealed location uses the printed stronghold shipping tariff, not a desert or native-free tariff');
    rejected(fixture.game, fixture.opponent, fixture.paymentAction);
    rejected(fixture.game, fixture.actor, { ...fixture.paymentAction, nexus: 'stale' });
    rejected(fixture.game, fixture.actor, { ...fixture.paymentAction, smuggler: true });
    const paid = finishDiscoveryClassicNexusEffectsInteraction(payDiscoveryClassicNexusEffectsFixture(fixture));
    const arrived = discoveryClassicNexusEffectsPlayer(paid, fixture.actor);
    assert.equal(arrived.spice, before.spice - quote.cost);
    assert.equal(arrived.reserves, before.reserves - 3); assert.equal(arrived.forces['shrine:0'], 3);
    assert.equal(arrived.shipped, true); assert.equal(arrived.moved, before.moved);
    for (const player of paid.players) if (player.id !== fixture.actor) assert.equal(player.spice, discoveryClassicNexusEffectsPlayer(fixture.game, player.id).spice);
    assert.equal(paid.nexusCards!.cards!.hands[fixture.actor], null);
    assert.equal(paid.nexusCards!.cards!.discard.filter(card => card === 'guild').length, 1);
    assert.equal(paid.nexusGuildSecretHistory!.length, 1);
    const record = paid.nexusGuildSecretHistory![0], frame = JSON.parse(record.frame);
    assert.equal(record.receipt.owner, fixture.actor); assert.equal(record.receipt.turn, 2); assert.equal(record.kind, 'reserve');
    assert.equal(frame.player, fixture.actor); assert.equal(frame.territory, 'shrine'); assert.equal(frame.sector, 0);
    assert.equal(frame.amount, 3); assert.equal(frame.elite, 0); assert.equal(frame.cost, quote.cost); assert.equal(frame.allyPayment, 0);
    assert.equal(frame.guildSecretEvent, fixture.paymentAction.nexus);
    assert.equal(frame.nexusEvent, undefined); assert.equal(frame.guildNexusEvent, undefined); assert.equal(frame.source, undefined);
    unchangedCustody(fixture.game, paid); rejected(paid, fixture.actor, fixture.paymentAction);
    if (configuration.tech) {
      assert.equal(paid.techTokens!.heighliners.spice, fixture.tokenCount);
      assert.equal(paid.techTokens!.heighliners.triggeredTurn, 2);
    }
    const expected = wallets(paid);
    if (fixture.tokenOwner) expected[fixture.tokenOwner] += fixture.tokenCount;
    const battle = openDiscoveryClassicNexusNestedBattle(fixture, paid);
    assert.deepEqual(wallets(battle.beforeBattle), expected, 'The original Movement-end industry pays once before the actual nested battle');
    if (configuration.tech) assert.equal(battle.beforeBattle.techTokens!.heighliners.spice, 0);
    assert.equal(battle.game.battle!.territory, 'shrine');
    const loser = discoveryClassicNexusEffectsPlayer(battle.game, fixture.opponent);
    const bounty = loser.leaders.find(leader => leader.id === battle.losingLeader)!.strength;
    const priorTokenOwners = battle.game.techTokens && Object.fromEntries(Object.entries(battle.game.techTokens).map(([id, token]) => [id, token.owner]));
    const collection = quoteSpiceCollection(battle.beforeBattle);
    const done = finishDiscoveryClassicNexusNestedBattle(battle);
    assert.equal(done.lastBattleContext!.winner, fixture.actor);
    assert.equal(discoveryClassicNexusEffectsPlayer(done, fixture.actor).forces['shrine:0'], 3);
    assert.equal(discoveryClassicNexusEffectsPlayer(done, fixture.opponent).forces['shrine:0'] ?? 0, 0);
    assert.equal(discoveryClassicNexusEffectsPlayer(done, fixture.opponent).tanks, loser.tanks + 2);
    const battleWallets = { ...expected };
    battleWallets[fixture.actor] += bounty;
    if (done.phase >= 7)
      for (const receipt of collection.receipts) battleWallets[receipt.player] += receipt.strongholds + receipt.collected;
    assert.deepEqual(wallets(done), battleWallets, 'Only the original leader bounty and independently quoted native Collection may accompany battle completion');
    assert.equal(discoveryClassicNexusEffectsPlayer(done, fixture.opponent).leaders.find(leader => leader.id === battle.losingLeader)!.dead, true);
    assert.ok(discoveryClassicNexusEffectsPlayer(done, fixture.actor).hand.some(card => card.id === battle.weapon.id));
    assert.ok(!done.discard.some(card => card.id === battle.weapon.id));
    assert.deepEqual(done.nexusGuildSecretHistory, paid.nexusGuildSecretHistory);
    assert.deepEqual(done.discoveries, paid.discoveries); assert.deepEqual(done.strongholdCards, paid.strongholdCards);
    if (configuration.tech) {
      assert.equal(ownedTech(done.techTokens, fixture.opponent).length, 0);
      for (const [id, owner] of Object.entries(priorTokenOwners!))
        assert.equal(done.techTokens![id as keyof NonNullable<Game['techTokens']>].owner, owner === fixture.opponent ? fixture.actor : owner);
    }
    discoveryClassicNexusEffectsInventory(done);
    const atMentat = wallets(done);
    if (done.phase < 7)
      for (const receipt of collection.receipts) atMentat[receipt.player] += receipt.strongholds + receipt.collected;
    const mentat = advanceDiscoveryClassicNexusEffectsToPhase(done, 8);
    assert.deepEqual(wallets(mentat), atMentat, 'Only original city Collection pays; Shrine cannot recollect shipment industry or leader bounty');
    assert.deepEqual(mentat.nexusGuildSecretHistory, paid.nexusGuildSecretHistory);
    discoveryClassicNexusEffectsInventory(mentat);
  });
}

void test('authenticated native Nexus/Discovery setup preserves original seat IDs/dealt custody and excludes unrelated Emperor module profiles', () => {
  const initial = initializeDiscoveryClassicNexusEffectsSetup({ advanced: true, tech: true, strongholds: true,
    seatIds: ['authenticated-owner', 'authenticated-opponent', 'authenticated-third'] });
  const saved = structuredClone(initial);
  const accepted = initializeDiscoveryClassicNexusEffectsSetup({ initial });
  assert.deepEqual(accepted, saved);
  const fixture = createDiscoveryClassicNexusEffectsFixture({ initial });
  assert.equal(fixture.actor, 'authenticated-owner'); assert.deepEqual(fixture.initial, saved);
  assert.deepEqual(fixture.game.players.map(player => player.id), initial.players.map(player => player.id));
  assert.deepEqual(initial, saved);
  assert.equal(emperorNexusModeSupported(fixture.game), true);
  // Explicit adversarial compositions, not histories claimed to be natural play.
  for (const change of [
    (game: Game) => { game.expansions = ['ix']; },
    (game: Game) => { game.players.find(player => player.id === fixture.opponent)!.faction = 'emperor'; },
    (game: Game) => { game.advanced = false; },
    (game: Game) => { game.semutaPreview = true; },
  ]) {
    const invalid = structuredClone(fixture.game); change(invalid);
    assert.equal(emperorNexusModeSupported(invalid), false);
    rejected(invalid, fixture.actor, fixture.paymentAction);
  }
  const paid = payDiscoveryClassicNexusEffectsFixture(fixture);
  const tampered = structuredClone(paid); tampered.nexusEmperorSecretHistory![0].after.revived++;
  rejected(tampered, fixture.actor, { type: 'ready' });
  discoveryClassicNexusEffectsInventory(paid);
});
