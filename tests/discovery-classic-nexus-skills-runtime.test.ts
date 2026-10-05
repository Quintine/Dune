import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { baseDeck } from '../game/cards';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { validateDiscoveryState } from '../game/discoveries';
import { validateNexusCards } from '../game/nexus-cards';
import { forceRevivalRemaining } from '../game/revival';
import { ownedTech } from '../game/tech-tokens';
import { DIFFICULTIES } from '../game/bot-profiles';
import { botActions } from '../game/bots';
import { quoteClassicSkillsStrongholdBattle } from './fixture-classic-skills-stronghold';
import {
  advanceDiscoveryClassicNexusSkills, closeDiscoveryClassicNexusSkills,
  createDiscoveryClassicNexusSkillsFixture, discoveryClassicNexusSkillsClean,
  discoveryClassicNexusSkillsPlayer as player, enterDiscoveryClassicNexusSkills,
  finishDiscoveryClassicNexusSkillsBattle, initializeDiscoveryClassicNexusSkillsSetup,
  openDiscoveryClassicNexusSkillsBattle, revealDiscoveryClassicNexusSkillsBattle,
  stepDiscoveryClassicNexusSkills,
} from './fixture-discovery-classic-nexus-skills';
import {
  finishClassicDiscoveryNexusMentat, formClassicDiscoveryNexusAlliance, openClassicDiscoveryNexusAlliance,
} from './fixture-discovery-classic-nexus';

function inventory(game: Game): void {
  validateLeaderSkills(game.leaderSkills!, game.players);
  validateDiscoveryState(game.discoveries!);
  validateNexusCards(game.nexusCards!.cards!, game.players);
  assert.deepEqual([...game.leaderSkills!.deck, ...Object.values(game.leaderSkills!.offers).flatMap(offer => offer.cards),
    ...game.leaderSkills!.assignments.map(assignment => assignment.skill)].sort(), LEADER_SKILL_CARDS.map(card => card.id).sort());
  assert.deepEqual([...game.deck, ...game.discard, ...game.players.flatMap(seat => seat.hand)].map(card => card.id).sort(),
    baseDeck().map(card => card.id).sort());
  for (const seat of game.players) {
    assert.equal(seat.reserves + seat.tanks + Object.values(seat.forces).reduce((sum, amount) => sum + amount, 0), 20);
    if (seat.elites) assert.equal(seat.elites.reserves + seat.elites.tanks + Object.values(seat.elites.forces).reduce((sum, amount) => sum + amount, 0),
      seat.faction === 'emperor' ? 5 : 3);
  }
  assert.ok(!(game.discoveryEntry && game.nexusCards!.phase?.stage === 'drawing'));
  assert.ok(!(game.greatMaker?.stage === 'vote' && game.nexusCards!.phase?.stage === 'drawing'));
}
function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}

void test('original classic all14/all12/Discovery setup trains before traitors and reaches physical next-turn entry at Basic/Advanced two through six seats', () => {
  for (const advanced of [false, true]) for (const seats of [2, 3, 4, 5, 6] as const) {
    const fixture = createDiscoveryClassicNexusSkillsFixture({ advanced, seats, tech: seats >= 3, strongholds: advanced });
    assert.equal(fixture.setup.status, 'setup'); assert.equal(fixture.setup.leaderSkills!.assignments.length, 0);
    assert.equal(fixture.setup.spiceDeck.length, 28); assert.equal(fixture.setup.discoveries!.tokens.length, 8);
    assert.ok(fixture.setup.players.every(seat => !seat.traitors.length && !seat.traitorChoices.length));
    assert.equal(fixture.trained.leaderSkills!.assignments.length, seats);
    const trainingSteps = fixture.actions.filter(step => step.action.type === 'leaderSkill');
    assert.equal(trainingSteps.length, seats);
    const lastTraining = fixture.actions.findLastIndex(step => step.action.type === 'leaderSkill');
    const firstTraitor = fixture.actions.findIndex(step => step.action.type === 'traitor');
    assert.ok(firstTraitor > lastTraining, 'Actual training precedes the original Traitor selection.');
    assert.equal(fixture.firstMentat.before.phase, 8); assert.equal(fixture.firstMentat.after.turn, 2);
    assert.equal(fixture.game.phase, 0); assert.equal(fixture.game.storm, fixture.firstMentat.before.storm);
    const before = player(fixture.game, fixture.owner), entered = enterDiscoveryClassicNexusSkills(fixture), after = player(entered, fixture.owner);
    assert.equal(after.forces['cistern:0'], 3); assert.equal(after.forces[fixture.source] ?? 0, 0);
    assert.equal(after.reserves, before.reserves); assert.equal(after.spice, before.spice);
    assert.equal(after.shipped, before.shipped); assert.equal(after.moved, before.moved);
    assert.deepEqual(entered.leaderSkills, fixture.game.leaderSkills);
    if (advanced) {
      assert.equal(entered.strongholdCards!.owners.arrakeen, fixture.owner);
      assert.equal(entered.strongholdCards!.claimedTurn, 1);
    }
    inventory(fixture.setup); inventory(entered);
  }
});

void test('authenticated original lobby and undealt human setup retain actual offered training, original hands and actors without demanding a specific skill', () => {
  const lobby = createGame('HUMANCLASSICNXSKILLDISCOVERY', newPlayer('human-collector', 'Guild', 'guild'), true);
  joinGame(lobby, newPlayer('human-emperor', 'Emperor', 'emperor'));
  joinGame(lobby, newPlayer('human-fremen', 'Fremen', 'fremen'));
  const before = structuredClone(lobby);
  const setup = initializeDiscoveryClassicNexusSkillsSetup({ initial: lobby, tech: true, strongholds: true });
  assert.deepEqual(lobby, before);
  const offered = structuredClone(setup);
  const fixture = createDiscoveryClassicNexusSkillsFixture({ initial: setup });
  assert.deepEqual(setup, offered); assert.deepEqual(fixture.setup, offered);
  assert.deepEqual(fixture.game.players.map(seat => seat.id), ['human-collector', 'human-emperor', 'human-fremen']);
  for (const step of fixture.actions.filter(step => step.action.type === 'leaderSkill')) {
    assert.ok(offered.leaderSkills!.offers[step.actor].cards.some(skill => skill === step.action.skill));
    assert.ok(offered.players.find(seat => seat.id === step.actor)!.leaders.some(leader => leader.id === step.action.leader));
  }
  assert.deepEqual(fixture.setup.players.map(seat => seat.hand), offered.players.map(seat => seat.hand));
  assert.equal(fixture.game.decision?.player, 'human-collector');
  const closing = closeDiscoveryClassicNexusSkills(fixture);
  const originalTop = closing.beforeDraw.nexusCards!.cards!.deck[0];
  assert.equal(closing.game.nexusCards!.cards!.hands[fixture.owner], originalTop,
    'Human closing draw consumes the actual original top card, not a demanded Nexus identity.');
  assert.equal(closing.game.nexusCards!.cards!.deck.length, closing.beforeDraw.nexusCards!.cards!.deck.length - 1);
  inventory(closing.game);
  assert.throws(() => createDiscoveryClassicNexusSkillsFixture({ initial: fixture.game }));
});

void test('actual Great Maker losses and all votes precede both Advanced piles, settled alliance and the qualified closing draw', () => {
  const fixture = createDiscoveryClassicNexusSkillsFixture({ advanced: true, tech: true, strongholds: true });
  const closing = closeDiscoveryClassicNexusSkills(fixture, 'emperor');
  assert.equal(player(closing.vote, fixture.owner).tanks, 6);
  assert.equal(player(closing.vote, fixture.owner).forces[fixture.wormSource], undefined);
  assert.equal(player(closing.vote, fixture.owner).forces['cistern:0'], 3);
  assert.equal(closing.vote.nexusCards!.cards!.hands[fixture.owner], null);
  assert.notEqual(closing.vote.nexusCards!.phase?.stage, 'drawing');
  assert.equal(closing.alliance.greatMaker?.stage, 'complete');
  assert.equal(closing.beforeDraw.phase, 1); assert.equal(closing.beforeDraw.nexus, false);
  assert.deepEqual(closing.beforeDraw.nexusCards!.phase!.eligible, [fixture.owner]);
  assert.equal(closing.beforeDraw.spiceWindow, null); assert.equal(closing.beforeDraw.spiceResolution, null);
  assert.ok(closing.beforeDraw.spiceDiscard.flat().some(card => 'territory' in card && card.territory === 'broken_land'));
  assert.ok(closing.beforeDraw.spiceDiscard.flat().filter(card => 'territory' in card && card.territory === 'rock_outcroppings').length >= 1);
  assert.equal(closing.game.nexusCards!.cards!.hands[fixture.owner], 'emperor');
  assert.equal(closing.game.phase, 2); assert.equal(closing.game.nexusCards!.phase!.stage, 'complete');
  assert.deepEqual(closing.game.leaderSkills, fixture.game.leaderSkills);
  reject(closing.game, fixture.owner, closing.drawStep.action);
  inventory(closing.vote); inventory(closing.game);
});

void test('own-faction redraw preference and later allied forfeiture use cards supplied by genuine closing draws only', () => {
  const fixture = createDiscoveryClassicNexusSkillsFixture();
  const closing = closeDiscoveryClassicNexusSkills(fixture, 'atreides');
  const before = structuredClone(closing.beforeDraw), cards = before.nexusCards!.cards!;
  const index = cards.deck.indexOf('emperor'); assert.ok(index > 0);
  cards.deck.splice(1, 0, cards.deck.splice(index, 1)[0]);
  const redraw = stepDiscoveryClassicNexusSkills(before, { actor: fixture.owner,
    action: { ...closing.drawStep.action, ownRedraws: 1 } });
  assert.equal(redraw.nexusCards!.cards!.hands[fixture.owner], 'emperor');
  assert.equal(redraw.nexusCards!.cards!.discard.filter(card => card === 'atreides').length, 1);
  assert.equal(redraw.nexusCards!.cards!.deck.length, before.nexusCards!.cards!.deck.length - 2);
  inventory(redraw);
  let game = finishClassicDiscoveryNexusMentat(closing.game).after;
  game = advanceDiscoveryClassicNexusSkills(game, game => game.phase === 1 && discoveryClassicNexusSkillsClean(game));
  const wormIndex = game.spiceDeck.findIndex(card => 'worm' in card && !card.greatMaker); assert.ok(wormIndex >= 0);
  const worm = game.spiceDeck.splice(wormIndex, 1)[0];
  const landIndex = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery); assert.ok(landIndex >= 0);
  game.spiceDeck.unshift(worm, game.spiceDeck.splice(landIndex, 1)[0]);
  game = openClassicDiscoveryNexusAlliance(game);
  const heldWindow = structuredClone(game);
  const keep = advanceDiscoveryClassicNexusSkills(heldWindow, game => game.nexusCards?.phase?.stage === 'drawing');
  const kept = stepDiscoveryClassicNexusSkills(keep, { actor: fixture.owner, action: {
    type: 'nexusCardChoice', turn: keep.turn, card: 'atreides', choice: 'keep', ownRedraws: 0 } });
  assert.equal(kept.nexusCards!.cards!.hands[fixture.owner], 'atreides');
  assert.deepEqual(kept.nexusCards!.cards!.deck, keep.nexusCards!.cards!.deck);
  game = stepDiscoveryClassicNexusSkills(game, { actor: fixture.opponent, action: { type: 'alliance', target: null } });
  game = formClassicDiscoveryNexusAlliance(game, fixture.owner, fixture.opponent);
  assert.equal(game.nexusCards!.cards!.hands[fixture.owner], null);
  assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'atreides').length, 1);
  game = advanceDiscoveryClassicNexusSkills(game, game => game.nexusCards?.phase?.stage === 'drawing');
  assert.ok(!game.nexusCards!.phase!.eligible.includes(fixture.owner));
  assert.deepEqual(viewGame(game, fixture.owner).nexusCards!.choices, []);
  inventory(kept); inventory(game);
});

for (const advanced of [false, true]) for (const kind of ['emperor', 'fremen'] as const) {
  void test(`${advanced ? 'Advanced' : 'Basic'} trained Discovery ${kind} returns native Great Maker casualties with distinct ordinary ledgers and actual Axlotl settlement`, () => {
    const fixture = createDiscoveryClassicNexusSkillsFixture({ advanced, tech: true, strongholds: advanced });
    const closing = closeDiscoveryClassicNexusSkills(fixture, kind);
    const game = advanceDiscoveryClassicNexusSkills(closing.game, game => game.phase === 4 && discoveryClassicNexusSkillsClean(game));
    assert.equal(player(game, fixture.owner).tanks, 6, 'Tanks arise from the original worm action, never an injected death.');
    const view = viewGame(game, fixture.owner), action: Action = { type: kind === 'emperor' ? 'nexusEmperorRevive' : 'nexusFremenRevive',
      event: kind === 'emperor' ? view.nexusEmperorSecretAlly!.event : view.nexusFremenRevival!.event, elite: 0 };
    reject(game, fixture.opponent, action);
    const before = player(game, fixture.owner);
    let paid = stepDiscoveryClassicNexusSkills(structuredClone(game), { actor: fixture.owner, action });
    const after = player(paid, fixture.owner);
    assert.equal(after.reserves, before.reserves + 3); assert.equal(after.tanks, 3); assert.equal(after.spice, before.spice);
    assert.equal(after.revived, kind === 'fremen' ? 3 : 0);
    assert.equal(after.freeForcesRevived ?? 0, kind === 'fremen' ? 3 : 0);
    assert.equal(forceRevivalRemaining(paid, after), kind === 'fremen' ? 0 : 3);
    assert.equal(paid.nexusCards!.cards!.hands[fixture.owner], null);
    assert.equal(paid.nexusCards!.cards!.discard.filter(card => card === kind).length, 1);
    assert.deepEqual(paid.leaderSkills, game.leaderSkills);
    const history = kind === 'emperor' ? paid.nexusEmperorSecretHistory! : paid.nexusFremenRevivalHistory!;
    assert.equal(history.length, 1); assert.equal(history[0].owner, fixture.owner);
    assert.equal(history[0].before.tanks - history[0].after.tanks, 3);
    reject(paid, fixture.owner, action);
    if (kind === 'emperor') {
      paid = stepDiscoveryClassicNexusSkills(paid, { actor: fixture.owner, action: { type: 'revive', amount: 3 } });
      paid = advanceDiscoveryClassicNexusSkills(paid, discoveryClassicNexusSkillsClean);
      assert.equal(player(paid, fixture.owner).tanks, 0); assert.equal(player(paid, fixture.owner).revived, 3);
      assert.equal(player(paid, fixture.owner).freeForcesRevived, 2); assert.equal(player(paid, fixture.owner).spice, before.spice - 2);
    } else reject(paid, fixture.owner, { type: 'revive', amount: 1 });
    const owner = paid.techTokens!.axlotl.owner!;
    const credit = ownedTech(paid.techTokens, owner).length;
    assert.equal(paid.techTokens!.axlotl.triggeredTurn, 2); assert.equal(paid.techTokens!.axlotl.spice, credit);
    const wallet = player(paid, owner).spice;
    const movement = advanceDiscoveryClassicNexusSkills(paid, game => game.phase === 5 && discoveryClassicNexusSkillsClean(game));
    assert.equal(player(movement, owner).spice, wallet + credit); assert.equal(movement.techTokens!.axlotl.spice, 0);
    assert.deepEqual(movement.leaderSkills, fixture.game.leaderSkills); inventory(movement);
    let ordinaryFirst = stepDiscoveryClassicNexusSkills(structuredClone(game), { actor: fixture.owner,
      action: { type: 'revive', amount: kind === 'emperor' ? 3 : 1 } });
    ordinaryFirst = advanceDiscoveryClassicNexusSkills(ordinaryFirst, discoveryClassicNexusSkillsClean);
    if (kind === 'emperor') {
      const extra = stepDiscoveryClassicNexusSkills(ordinaryFirst, { actor: fixture.owner, action });
      assert.equal(player(extra, fixture.owner).tanks, 0);
      assert.equal(player(extra, fixture.owner).revived, 3);
      assert.equal(player(extra, fixture.owner).freeForcesRevived, 2);
      assert.equal(player(extra, fixture.owner).spice, player(ordinaryFirst, fixture.owner).spice);
      assert.deepEqual(extra.techTokens, ordinaryFirst.techTokens, 'Extra three cannot retrigger the already earned original Axlotl activity.');
      inventory(extra);
    } else {
      reject(ordinaryFirst, fixture.owner, action);
      assert.equal(player(ordinaryFirst, fixture.owner).tanks, 5);
      assert.equal(player(ordinaryFirst, fixture.owner).revived, 1);
      assert.equal(ordinaryFirst.nexusCards!.cards!.hands[fixture.owner], 'fremen');
    }
  });
}

void test('borrowed Guild nested shipment retains physical training and held Arrakeen, then actual skilled Warmaster cleanup and mandatory Tech transfer occur in order', () => {
  const fixture = createDiscoveryClassicNexusSkillsFixture({ advanced: true, tech: true, strongholds: true, skill: 'warmaster' });
  const closing = closeDiscoveryClassicNexusSkills(fixture, 'guild');
  const battle = openDiscoveryClassicNexusSkillsBattle(fixture, closing.game);
  const before = player(battle.shipmentWindow, fixture.owner), arrived = player(battle.arrived, fixture.owner);
  assert.equal(arrived.forces['cistern:0'], 6); assert.equal(arrived.reserves, before.reserves - 3);
  assert.equal(arrived.spice, before.spice - 2); assert.equal(arrived.shipped, true); assert.equal(arrived.moved, before.moved);
  assert.equal(battle.arrived.nexusCards!.cards!.hands[fixture.owner], null);
  assert.equal(battle.arrived.nexusGuildSecretHistory!.length, 1);
  assert.equal(battle.arrived.nexusGuildSecretHistory![0].receipt.owner, fixture.owner);
  assert.equal(battle.arrived.strongholdCards!.owners.arrakeen, fixture.owner);
  assert.deepEqual(battle.arrived.leaderSkills, battle.shipmentWindow.leaderSkills);
  reject(battle.shipmentWindow, fixture.owner, { ...battle.shipmentStep.action, smuggler: true });
  const industryOwner = battle.arrived.techTokens!.heighliners.owner!;
  const industryCredit = ownedTech(battle.arrived.techTokens, industryOwner).length;
  assert.equal(battle.arrived.techTokens!.heighliners.triggeredTurn, 2);
  assert.equal(battle.arrived.techTokens!.heighliners.spice, industryCredit);
  assert.equal(battle.game.techTokens!.heighliners.spice, 0);
  assert.equal(player(battle.game, industryOwner).spice, player(battle.arrived, industryOwner).spice + industryCredit,
    'Actual movement end settles shipping industry exactly once before the private nested plans.');
  const revealed = revealDiscoveryClassicNexusSkillsBattle(battle), quote = quoteClassicSkillsStrongholdBattle(revealed);
  assert.equal(quote.winner, fixture.owner);
  assert.equal(viewGame(revealed, fixture.owner).battle!.strongholdEffects[fixture.owner], null);
  const payment = quote.payments.find(receipt => receipt.player === fixture.owner)!;
  assert.equal(payment.bankSupport, 0); assert.equal(payment.ownPayment, 1);
  const side = revealed.battle!.attacker === fixture.owner ? 'attacker' : 'defender';
  assert.deepEqual(quote.leaderSkillBonuses[side].applied, [{ skill: 'warmaster', amount: 3, mode: 'skilled' }]);
  const loser = player(revealed, fixture.opponent), reward = ownedTech(revealed.techTokens, fixture.opponent);
  assert.ok(reward.length > 0);
  const cleanup = finishDiscoveryClassicNexusSkillsBattle(revealed, true);
  assert.equal(player(cleanup, fixture.owner).forces['cistern:0'], 5);
  assert.equal(player(cleanup, fixture.opponent).forces['cistern:0'] ?? 0, 0);
  assert.equal(player(cleanup, fixture.opponent).tanks, loser.tanks + 2);
  assert.deepEqual(cleanup.techTokens, revealed.techTokens, 'Battle cleanup still owns its priority before the winner reward.');
  const done = finishDiscoveryClassicNexusSkillsBattle(cleanup);
  assert.equal(done.lastBattleContext!.winner, fixture.owner);
  assert.ok(player(done, fixture.owner).hand.some(card => card.id === battle.weapon));
  assert.ok(!done.discard.some(card => card.id === battle.weapon));
  assert.equal(viewGame(done, fixture.owner).leaderSkills!.assignments.find(assignment => assignment.leader === fixture.leader)!.faceUp, true);
  for (const token of reward) assert.equal(done.techTokens![token].owner, fixture.owner);
  assert.deepEqual(ownedTech(done.techTokens, fixture.opponent), []);
  assert.deepEqual(done.nexusGuildSecretHistory, battle.arrived.nexusGuildSecretHistory);
  assert.equal(done.strongholdCards!.owners.arrakeen, fixture.owner);
  inventory(done);
});

void test('all four minimal policies produce actual offered training, physical entry, qualified Nexus draw and source-clear return outcomes', () => {
  const fixture = createDiscoveryClassicNexusSkillsFixture({ advanced: true, tech: true });
  const closing = closeDiscoveryClassicNexusSkills(fixture, 'emperor');
  const revival = advanceDiscoveryClassicNexusSkills(closing.game, game => game.phase === 4 && discoveryClassicNexusSkillsClean(game));
  const training = advanceDiscoveryClassicNexusSkills(structuredClone(fixture.setup), game => game.setupStage === 'leaderSkills');
  for (const difficulty of DIFFICULTIES) {
    const cases = [
      { game: training, actor: Object.keys(training.leaderSkills!.offers)[0], type: 'leaderSkill' },
      { game: fixture.game, actor: fixture.owner, type: 'decision' },
      { game: closing.beforeDraw, actor: fixture.owner, type: 'nexusCardChoice' },
      { game: revival, actor: fixture.owner, type: 'nexusEmperorRevive' },
    ];
    for (const current of cases) {
      const view = viewGame(current.game, current.actor); view.players.find(seat => seat.id === current.actor)!.bot = difficulty;
      const untouched = structuredClone(view), action = botActions(view).find(action => action.type === current.type);
      assert.ok(action, `${difficulty} needs the actual owned ${current.type}.`);
      const after = stepDiscoveryClassicNexusSkills(structuredClone(current.game), { actor: current.actor, action });
      assert.deepEqual(view, untouched);
      if (current.type === 'leaderSkill') {
        assert.equal(after.leaderSkills!.assignments.length, 1);
        const assignment = after.leaderSkills!.assignments[0]; assert.equal(assignment.owner, current.actor);
        assert.ok(current.game.leaderSkills!.offers[current.actor].cards.includes(assignment.skill));
        assert.equal(after.leaderSkills!.offers[current.actor], undefined);
        assert.deepEqual(after.players.map(seat => seat.hand), current.game.players.map(seat => seat.hand));
      } else if (current.type === 'decision') {
        assert.equal(after.discoveryEntry, undefined);
        const entered = player(after, current.actor).forces['cistern:0'] ?? 0;
        assert.equal((player(after, current.actor).forces[fixture.source] ?? 0) + entered, 3);
        assert.equal(player(after, current.actor).spice, player(current.game, current.actor).spice);
        assert.deepEqual(after.leaderSkills, current.game.leaderSkills);
      } else if (current.type === 'nexusCardChoice') {
        assert.equal(after.nexusCards!.phase!.stage, 'complete');
        assert.ok(after.nexusCards!.cards!.hands[current.actor]);
        assert.equal(after.phase, 2);
      } else {
        assert.equal(player(after, current.actor).tanks, 3);
        assert.equal(player(after, current.actor).reserves, player(current.game, current.actor).reserves + 3);
        assert.equal(player(after, current.actor).revived, 0);
        assert.equal(after.nexusCards!.cards!.hands[current.actor], null);
        assert.equal(after.techTokens!.axlotl.triggeredTurn, 2);
        assert.deepEqual(after.leaderSkills, current.game.leaderSkills);
      }
      inventory(after);
    }
  }
});
