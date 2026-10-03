import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { ownedTech } from '../game/tech-tokens';
import { validateLeaderSkills } from '../game/leader-skills';
import { advanceSkillsTechPaymentsToPhase } from './fixture-skills-tech-payments';
import {
  createIxChoamSkillsTechFixture, initializeIxChoamSkillsTechSetup,
  ixChoamSkillsTechPlayer as player, nextIxChoamSkillsTechStep, settleIxChoamSkillsTech,
} from './fixture-ix-choam-skills-tech';

function custody(game: Game): void {
  validateLeaderSkills(game.leaderSkills!, game.players);
  for (const p of game.players) {
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((sum, n) => sum + n, 0), 20);
    if (p.elites) {
      assert.equal(p.elites.reserves + p.elites.tanks + Object.values(p.elites.forces).reduce((sum, n) => sum + n, 0),
        p.faction === 'ixians' ? 7 : p.faction === 'fremen' ? 3 : 5);
      for (const [key, n] of Object.entries(p.elites.forces)) assert.ok(n <= (p.forces[key] ?? 0));
    }
  }
}
function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'A rejected native action cannot mutate custody or money.');
}

for (const advanced of [false, true]) {
  const rules = advanced ? 'Advanced' : 'Basic';
  for (const family of ['ixians', 'choam'] as const) {
    for (const smuggler of [true, false]) void test(`${rules} ${family}: real typed four-counter invoice ${smuggler ? 'includes the free companion' : 'declines it'} and pays only native Heighliners at phase end`, () => {
      const fixture = createIxChoamSkillsTechFixture({ advanced, family, amount: 4, smuggler, bankerIncome: true });
      const before = fixture.game;
      const payer = player(before, fixture.actor);
      const tokenOwner = before.techTokens!.heighliners.owner!;
      const paid = settleIxChoamSkillsTech(applyAction(before, fixture.actor, fixture.action));
      const delivered = player(paid, fixture.actor);
      assert.equal(delivered.spice, payer.spice - (smuggler ? 3 : 4));
      assert.equal(delivered.reserves, payer.reserves - 4);
      assert.equal(delivered.forces[fixture.key!], 4, 'Free means a delivered physical counter, not a price-only fiction.');
      if (family === 'ixians') {
        assert.equal(tokenOwner, fixture.owner, 'Original setup assigns printed Heighliners to Ixians.');
        assert.equal(delivered.elites!.reserves, payer.elites!.reserves - 2);
        assert.equal(delivered.elites!.forces[fixture.key!], 2);
      }
      for (const p of before.players.filter(p => p.id !== fixture.actor))
        assert.equal(player(paid, p.id).spice, p.spice, 'Neither deferred store is spendable upon arrival.');
      const techAmount = ownedTech(before.techTokens, tokenOwner).length;
      assert.equal(paid.techTokens!.heighliners.spice, techAmount);
      assert.equal(paid.techTokens!.axlotl.spice, before.techTokens!.axlotl.spice);
      const bankerAmount = smuggler ? 0 : 1;
      assert.deepEqual(viewGame(paid, fixture.banker!).spiceBankerIncome!.deferred,
        bankerAmount ? [{ owner: fixture.banker, amount: bankerAmount }] : []);
      const sources = structuredClone(paid.spiceBankerIncome!.sources);
      const end = advanceSkillsTechPaymentsToPhase(paid, 6);
      // Empty Battle may auto-skip into native Collection. Quote that separately,
      // rather than treating stronghold income as a discounted shipment fee.
      const expected = end.phase === 7
        ? Object.fromEntries(quoteSpiceCollection(paid).receipts.map(r => [r.player, r.balance]))
        : Object.fromEntries(paid.players.map(p => [p.id, p.spice]));
      expected[tokenOwner] += techAmount;
      assert.deepEqual(Object.fromEntries(end.players.map(p => [p.id, p.spice])), expected);
      assert.equal(end.techTokens!.heighliners.spice, 0);
      assert.deepEqual(end.spiceBankerIncome!.sources, sources, 'Tech and Collection income are not Banker bank payments.');
      const collection = advanceSkillsTechPaymentsToPhase(end, 7);
      const mentat = advanceSkillsTechPaymentsToPhase(collection, 8);
      for (const p of collection.players)
        assert.equal(player(mentat, p.id).spice, p.spice + (p.id === fixture.banker ? bankerAmount : 0));
      assert.deepEqual(viewGame(mentat, fixture.banker!).spiceBankerIncome!.deferred, []);
      assert.deepEqual(mentat.spiceBankerIncome!.sources, sources);
      reject(paid, fixture.actor, fixture.action);
      custody(mentat);
    });

    for (const band of ['normal', 'skilled'] as const) void test(`${rules} ${family} ${band} Suk: native typed casualties rescue to board/reserves, remaining counters enter Tanks, and the original loser token follows victory`, () => {
      const fixture = createIxChoamSkillsTechFixture({ advanced, family, kind: 'suk-battle', band });
      const before = fixture.game;
      const owner = player(before, fixture.owner);
      const enemyToken = ownedTech(before.techTokens, fixture.opponent);
      assert.equal(enemyToken.length, 1, 'Three original seats receive one original token each.');
      let game = applyAction(before, fixture.owner, fixture.action);
      game = applyAction(game, fixture.opponent, fixture.opponentPlan!);
      game = settleIxChoamSkillsTech(game, true);
      const pending = game;
      const decision = game.decision?.kind === 'sukRescue' ? game.decision : null;
      const losses = decision ? game.pendingSukRescue!.losses!
        : family === 'ixians' ? { normal: 0, elite: 2 } : { normal: 4, elite: 0 };
      assert.equal(player(game, fixture.owner).spice, owner.spice - fixture.cost,
        'CHOAM own support earns no CHOAM payment income; Tech reward does not mint money.');
      assert.equal(game.techTokens![enemyToken[0]].owner, fixture.opponent, 'Suk resolves before original Tech custody reward.');
      if (family === 'ixians' && advanced)
        assert.deepEqual(losses, { normal: 4, elite: 2, paidNormal: 0, paidElite: 1 });
      if (!decision) {
        assert.equal(band, 'normal');
        assert.equal(game.lastBattleContext!.sukRescue!.completed, true, 'A uniquely determined normal rescue is automatic.');
      }
      const choice = decision?.options.findIndex(o => band === 'normal'
        ? o.normal === (family === 'ixians' ? 0 : 1) && o.elite === (family === 'ixians' ? 1 : 0) && !o.kept
        : family === 'ixians' && !advanced
          ? o.normal === 0 && o.elite === 2 && o.kept?.kind === 'elite'
          : o.normal === (family === 'ixians' ? 2 : 3) && o.elite === (family === 'ixians' ? 1 : 0) && o.kept?.kind === 'normal') ?? -1;
      if (decision) assert.ok(choice >= 0);
      const selected = decision ? decision.options[choice]
        : { normal: family === 'ixians' ? 0 : 1, elite: family === 'ixians' ? 1 : 0, kept: null };
      if (decision) {
        reject(pending, fixture.opponent, { type: 'decision', event: decision.event, choice });
        reject(pending, fixture.owner, { type: 'decision', event: decision.event, choice: decision.options.length });
        game = applyAction(pending, fixture.owner, { type: 'decision', event: decision.event, choice });
      }
      const rescued = player(game, fixture.owner);
      const kept = selected.kept ? 1 : 0;
      assert.equal(rescued.reserves, owner.reserves + selected.normal + selected.elite - kept);
      assert.equal(rescued.tanks, owner.tanks + losses.normal + losses.elite - selected.normal - selected.elite);
      assert.equal(rescued.forces[fixture.key!], 8 - losses.normal - losses.elite + kept);
      if (family === 'ixians') {
        assert.equal(rescued.elites!.reserves, owner.elites!.reserves + selected.elite - (selected.kept?.kind === 'elite' ? 1 : 0));
        assert.equal(rescued.elites!.tanks, owner.elites!.tanks + losses.elite - selected.elite);
        assert.equal(rescued.elites!.forces[fixture.key!] ?? 0, 2 - losses.elite + (selected.kept?.kind === 'elite' ? 1 : 0));
      }
      custody(game);
      game = settleIxChoamSkillsTech(game);
      assert.equal(game.lastBattleContext!.winner, fixture.owner);
      assert.equal(game.techTokens![enemyToken[0]].owner, fixture.owner);
      assert.equal(ownedTech(game.techTokens, fixture.owner).length, 2);
      assert.equal(ownedTech(game.techTokens, fixture.opponent).length, 0);
      assert.equal(game.techTokens![enemyToken[0]].spice, 0, 'Original reward transfers custody, not a new income event.');
      custody(game);

      if (decision) for (const difficulty of DIFFICULTIES) {
        const view = viewGame(pending, fixture.owner);
        view.players.find(p => p.id === fixture.owner)!.bot = difficulty;
        const action = botActions(view)[0];
        assert.ok(action, difficulty);
        const continued = applyAction(pending, fixture.owner, action);
        assert.equal(continued.pendingSukRescue, null);
        assert.equal(player(continued, fixture.owner).spice, owner.spice - fixture.cost);
        custody(continued);
      }
    });
  }

  void test(`${rules} CHOAM: real exhausted Emperor shipment makes next-turn charity eligible; only original Spice Production accrues, never Axlotl`, () => {
    const fixture = createIxChoamSkillsTechFixture({ advanced, family: 'choam', kind: 'charity', bankerIncome: true });
    const before = fixture.game;
    assert.ok(fixture.actions.some(step => step.actor === fixture.actor && step.action.type === 'ship'
      && step.action.amount === 5), 'Eligibility comes from an actual original ten-spice desert invoice.');
    const incomeBefore = fixture.beforeCharityIncome!;
    const incomeAfter = fixture.afterCharityIncome!;
    assert.equal(incomeBefore.response!.kind, 'choamCharity');
    for (const p of incomeBefore.players) assert.equal(player(incomeAfter, p.id).spice,
      p.spice + (p.id === fixture.owner ? 2 * incomeBefore.players.length : 0));
    assert.deepEqual(incomeAfter.techTokens, incomeBefore.techTokens,
      'Original CHOAM opening income is not a Charity claim or Tech trigger.');
    assert.deepEqual(incomeAfter.spiceBankerIncome, incomeBefore.spiceBankerIncome,
      'Opening income is not an actual four-spice bank payment.');
    const productionOwner = before.techTokens!.production.owner!;
    const after = applyAction(before, fixture.actor, fixture.action);
    assert.equal(player(after, fixture.actor).spice, 2);
    assert.equal(player(after, fixture.owner).spice, player(before, fixture.owner).spice - fixture.amount);
    assert.equal(after.techTokens!.production.spice, ownedTech(before.techTokens, productionOwner).length);
    assert.deepEqual(after.techTokens!.axlotl, before.techTokens!.axlotl);
    assert.deepEqual(after.spiceBankerIncome, before.spiceBankerIncome, 'Charity is CHOAM-funded income, not a skill bank payment.');
    reject(after, fixture.actor, fixture.action);
    const end = advanceSkillsTechPaymentsToPhase(after, 3);
    for (const p of after.players) assert.equal(player(end, p.id).spice,
      p.spice + (p.id === productionOwner ? ownedTech(before.techTokens, productionOwner).length : 0));
    assert.equal(end.techTokens!.production.spice, 0);
    assert.deepEqual(end.techTokens!.axlotl, before.techTokens!.axlotl);
    custody(end);
  });
}

void test('Advanced CHOAM Auditor remains unskilled in original Tech setup and an eligible Bene Gesserit charity claim is expressly excluded from Spice Production', () => {
  const initial = createGame('AUTHCHOAMTECH', newPlayer('human-e', 'Human Emperor', 'emperor'), true, ['choam']);
  joinGame(initial, newPlayer('human-c', 'Human CHOAM', 'choam'));
  joinGame(initial, newPlayer('human-bg', 'Human BG', 'beneGesserit'));
  const identities = initial.players.map(p => ({ id: p.id, name: p.name, faction: p.faction }));
  let setup = initializeIxChoamSkillsTechSetup({ initial, family: 'choam', kind: 'charity' });
  while (setup.setupStage === 'prediction') {
    const next = nextIxChoamSkillsTechStep(setup);
    setup = applyAction(setup, next.actor, next.action);
  }
  const offer = setup.leaderSkills!.offers['human-c'];
  assert.ok(!viewGame(setup, 'human-c').leaderSkills!.eligibleLeaders.some(l => l.id === 'choam-auditor'));
  reject(setup, 'human-c', { type: 'leaderSkill', event: offer.event, skill: 'smuggler', leader: 'choam-auditor' });
  const fixture = createIxChoamSkillsTechFixture({ initial, family: 'choam', kind: 'charity' });
  assert.equal(fixture.actor, 'human-e');
  assert.equal(fixture.owner, 'human-c');
  assert.deepEqual(fixture.game.players.map(p => ({ id: p.id, name: p.name, faction: p.faction })), identities);
  assert.ok(!fixture.game.leaderSkills!.assignments.some(a => a.leader === 'choam-auditor'));
  const before = fixture.game;
  const claimed = settleIxChoamSkillsTech(applyAction(before, 'human-bg', { type: 'charity' }));
  assert.equal(player(claimed, 'human-bg').spice, player(before, 'human-bg').spice + 2);
  assert.equal(player(claimed, 'human-c').spice, player(before, 'human-c').spice - 2);
  assert.deepEqual(claimed.techTokens!.production, before.techTokens!.production, 'Advanced BG income is not the original production trigger.');
  assert.deepEqual(claimed.techTokens!.axlotl, before.techTokens!.axlotl);
  const eligible = applyAction(claimed, fixture.actor, fixture.action);
  assert.equal(eligible.techTokens!.production.spice, 1);
  custody(eligible);
});
