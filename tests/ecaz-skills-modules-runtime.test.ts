import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, initializeLeaderSkillsGameForAudit, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { DUKE_VIDAL_ID } from '../game/duke-vidal';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { ownedTech } from '../game/tech-tokens';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import {
  advanceEcazSkillsModules as advance, assertEcazSkillsModulesCustody as custody,
  createEcazSkillsModulesFixture as fixture, ecazSkillsModulesAction as act,
  ecazSkillsModulesPlayer as player, ecazSkillsModulesTrainer as trainer,
  reloadEcazSkillsModules as reload, revealEcazSkillsModulesBattle as reveal,
  settleEcazSkillsModulesBattle as settle,
} from './fixture-ecaz-skills-modules';

function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'A rejected combined-module action must preserve the real source.');
}
function policy(game: Game, actor: string, difficulty: typeof DIFFICULTIES[number]): Action {
  const view = viewGame(reload(game), actor);
  view.players.find(p => p.id === actor)!.bot = difficulty;
  const action = botActions(view)[0]; assert.ok(action); return action;
}
function collection(game: Game, actor: string): number {
  if (game.phase !== 7 || game.phaseOpening) return 0;
  return quoteSpiceCollection({ ...game, players: game.players.map(p => ({ ...p, spice: 0 })) }).receipts
    .filter(r => r.player === actor).reduce((sum, r) => sum + r.strongholds + r.collected, 0);
}

void test('original Ecaz normal and selected Suk rescue physical ordinary losses before winner cards and earned Tech', () => {
  for (const rules of ['basic', 'advanced'] as const) {
    for (const stronghold of rules === 'advanced' ? [false, true] : [false]) {
      for (const band of ['normal', 'skilled'] as const) {
        const f = fixture({ rules, tech: true, stronghold, band });
        const assigned = structuredClone(trainer(f.game, f.owner));
        const before = reveal(f), wallet = player(before, f.owner).spice, reserves = player(before, f.owner).reserves;
        const defeatedTokens = ownedTech(before.techTokens, f.opponent);
        assert.equal(defeatedTokens.length, 1, 'Actual three-seat first Storm assigns one physical token to each original seat.');
        const supportCost = rules === 'advanced' ? stronghold ? 3 : 5 : 0;
        let game = settle(before, band === 'skilled' ? 'suk' : 'cards');
        assert.equal(game.lastBattleContext!.winner, f.owner);
        assert.equal(player(game, f.owner).spice, wallet - supportCost);
        assert.equal(game.techTokens![defeatedTokens[0]].owner, f.opponent, 'Neither committed rescue nor optional card retention steals technology early.');
        if (band === 'skilled') {
          assert.equal(game.decision?.kind, 'sukRescue');
          if (game.decision?.kind !== 'sukRescue') throw Error('Expected physical trained-disc Suk rescue.');
          assert.deepEqual(game.pendingSukRescue!.losses, { normal: 5, elite: 0, paidNormal: rules === 'advanced' ? 5 : 0, paidElite: 0 });
          reject(game, f.opponent, { type: 'decision', event: game.decision.event, choice: 0 });
          reject(game, f.owner, { type: 'decision', event: `${game.decision.event}-stale`, choice: 0 });
          reject(game, f.owner, { type: 'decision', event: game.decision.event, choice: game.decision.options.length });
          const choice = game.decision.options.findIndex(o => o.normal === 3 && o.elite === 0 && o.kept?.key === f.location);
          assert.ok(choice >= 0);
          game = settle(act(game, f.owner, { type: 'decision', event: game.decision.event, choice }), 'cards');
          assert.equal(player(game, f.owner).forces[f.location], 4);
          assert.equal(player(game, f.owner).reserves, reserves + 2);
          assert.equal(player(game, f.owner).tanks, 2);
          assert.equal(game.pendingSukRescue, null);
          assert.equal(game.lastBattleContext!.sukRescue!.completed, true);
        } else {
          assert.equal(player(game, f.owner).forces[f.location], 3);
          assert.equal(player(game, f.owner).reserves, reserves + 1);
          assert.equal(player(game, f.owner).tanks, 4);
          assert.equal(game.pendingSukRescue, null);
        }
        assert.equal(game.decision?.kind, 'battleCards');
        assert.equal(game.decision?.player, f.owner);
        reject(game, f.owner, { type: 'decision', token: defeatedTokens[0] });
        assert.equal(game.techTokens![defeatedTokens[0]].owner, f.opponent);
        game = settle(act(game, f.owner, { type: 'decision', discard: [] }));
        assert.equal(game.techTokens![defeatedTokens[0]].owner, f.owner);
        assert.equal(player(game, f.opponent).tanks, 8);
        assert.deepEqual(trainer(game, f.owner), assigned);
        custody(game);
      }
    }
  }
});

void test('all four real legal policies rescue trained native Ecaz counters and resolve its physical card/Tech continuation', () => {
  const f = fixture({ tech: true, stronghold: true, band: 'skilled' });
  const revealed = reveal(f), source = settle(revealed, 'suk');
  assert.equal(source.decision?.kind, 'sukRescue');
  for (const difficulty of DIFFICULTIES) {
    const rescued = settle(act(source, f.owner, policy(source, f.owner, difficulty)), 'cards');
    assert.equal(rescued.pendingSukRescue, null);
    assert.equal(player(rescued, f.owner).tanks, 2);
    assert.equal(player(rescued, f.owner).reserves, player(revealed, f.owner).reserves + 2);
    assert.equal(player(rescued, f.owner).forces[f.location], 4);
    assert.equal(player(rescued, f.owner).spice, player(revealed, f.owner).spice - 3);
    assert.equal(rescued.decision?.kind, 'battleCards');
    const cardAction = policy(rescued, f.owner, difficulty);
    const finished = settle(act(rescued, f.owner, cardAction));
    assert.equal(finished.battle, null);
    assert.equal(finished.lastBattleContext!.winner, f.owner);
    for (const token of ownedTech(revealed.techTokens, f.opponent)) assert.equal(finished.techTokens![token].owner, f.owner);
    assert.equal(player(finished, f.owner).tanks, 2);
    custody(finished);
  }
});

void test('real Arrakeen subsidy and separately opted-in normal Banker count only the opposing paid Bank leg', () => {
  const f = fixture({ kind: 'income', band: 'normal', bankerIncome: true, tech: true, stronghold: true, opponentDial: 4, defense: true });
  const before = reveal(f), sources = before.spiceBankerIncome!.sources.length;
  const game = settle(before, 'cards');
  assert.equal(game.lastBattleContext!.winner, f.owner);
  assert.equal(player(game, f.owner).spice, player(before, f.owner).spice - 3);
  assert.equal(player(game, f.opponent).spice, player(before, f.opponent).spice - 4);
  const payments = game.spiceBankerIncome!.sources.slice(sources).filter(r => r.source.kind === 'battle-support');
  assert.deepEqual(payments.map(r => r.source.bankLegs), [
    [{ payer: before.battle!.attacker, amount: before.battle!.attacker === f.owner ? 3 : 4 }],
    [{ payer: before.battle!.defender, amount: before.battle!.defender === f.owner ? 3 : 4 }],
  ]);
  assert.deepEqual(payments.filter(r => r.grant).map(r => ({ owner: r.grant!.owner, amount: r.grant!.amount })), [{ owner: f.owner, amount: 1 }]);
  const finished = settle(game);
  const beforeMentat = advance(finished, g => g.phase === 7 && !g.response && !g.phaseOpening && !g.decision);
  const wallet = player(beforeMentat, f.owner).spice;
  const mentat = advance(beforeMentat, g => g.phase === 8 && !g.response && !g.phaseOpening && !g.decision);
  assert.equal(player(mentat, f.owner).spice, wallet + 1, 'The one front-of-shield grant becomes wallet spice only at actual Mentat.');
  custody(mentat);
});

void test('original Ambassador Duke6 receives normal Warmaster1, never the separate trained-disc3, and survives release with native assignment intact', () => {
  for (const rules of ['basic', 'advanced'] as const) {
    for (const band of ['normal', 'skilled'] as const) {
      const f = fixture({ rules, kind: 'duke', tech: true, stronghold: rules === 'advanced', band });
      assert.ok(f.acquisition);
      assert.equal(player(f.acquisition.after, f.owner).spice, player(f.acquisition.before, f.owner).spice - 1);
      assert.equal(player(f.acquisition.after, f.opponent).spice, player(f.acquisition.before, f.opponent).spice - 1);
      assert.equal(f.acquisition.after.dukeVidal!.source, 'ecaz');
      const assigned = structuredClone(trainer(f.game, f.owner)), native = structuredClone(player(f.game, f.owner).leaders);
      const before = reveal(f), game = settle(before);
      assert.equal(game.lastBattleContext!.winner, band === 'normal' ? f.owner : f.opponent);
      assert.equal(game.dukeVidal!.leader.dead, false);
      assert.equal(game.dukeVidal!.leader.usedAt, f.territory);
      assert.deepEqual([game.dukeVidal!.controller, game.dukeVidal!.source, game.dukeVidal!.acquiredTurn], [null, null, null]);
      assert.deepEqual(trainer(game, f.owner), assigned);
      assert.deepEqual(player(game, f.owner).leaders, native);
      assert.ok(viewGame(game, f.owner).leaderSkills!.eligibleLeaders.every(l => l.id !== DUKE_VIDAL_ID));
      custody(game);
    }
    const f = fixture({ rules, kind: 'duke', tech: true, stronghold: rules === 'advanced', opponentDial: 3 });
    const game = settle(reveal(f));
    assert.equal(game.lastBattleContext!.winner, f.opponent, 'Duke6+normal1 loses to printed5+3; borrowing the selected trainer bonus would incorrectly win.');
    assert.equal(game.dukeVidal!.leader.dead, false);
    custody(game);
  }
});

void test('actual retained Carthag adds Snooper to real Duke Shield, while Tuek pays for played Worthless even on printed6 death and paid5 revival', () => {
  const defended = fixture({ kind: 'duke', strongholdKind: 'carthag', poison: true, defense: true });
  const safe = settle(reveal(defended));
  assert.equal(safe.lastBattleContext!.winner, defended.owner);
  assert.equal(safe.dukeVidal!.leader.dead, false, 'Retained Carthag adds the printed Snooper property to the original physical Shield.');
  custody(safe);
  const f = fixture({ kind: 'duke', strongholdKind: 'tueks_sietch', poison: true, opponentDial: 0 });
  const assigned = structuredClone(trainer(f.game, f.owner)), native = structuredClone(player(f.game, f.owner).leaders);
  const before = reveal(f), dead = settle(before);
  assert.equal(dead.lastBattleContext!.winner, f.opponent);
  assert.equal(dead.dukeVidal!.leader.dead, true);
  assert.equal(dead.dukeVidal!.leader.deaths, 1);
  assert.equal(player(dead, f.owner).spice, player(before, f.owner).spice + 2 + collection(dead, f.owner), 'Tuek counts the real Worthless even though Duke dies and Ecaz loses.');
  assert.equal(player(dead, f.opponent).spice, player(before, f.opponent).spice + 6 + collection(dead, f.opponent), 'Only the printed shared-disc6 is paid, not normal7 or trained9.');
  assert.deepEqual(player(dead, f.owner).leaders, native);
  assert.deepEqual(trainer(dead, f.owner), assigned);
  const skillInventory = structuredClone(dead.leaderSkills);
  const revival = advance(dead, g => g.turn > dead.turn && g.phase === 4 && !g.response && !g.phaseOpening && !g.decision);
  const option = viewGame(revival, f.owner).revival.leaders.find(l => l.id === DUKE_VIDAL_ID)!;
  assert.equal(option.cost, 5); assert.equal(option.normalCost, 5); assert.equal(option.affordable, true);
  reject(revival, f.opponent, { type: 'reviveLeader', leader: DUKE_VIDAL_ID });
  const funds = player(revival, f.owner).spice;
  let revived = act(revival, f.owner, { type: 'reviveLeader', leader: DUKE_VIDAL_ID });
  revived = advance(revived, g => !g.response && !g.pendingRevival);
  assert.equal(player(revived, f.owner).spice, funds - 5);
  assert.equal(player(revived, f.owner).leaderRevived, true);
  assert.equal(revived.dukeVidal!.leader.dead, false);
  assert.equal(revived.dukeVidal!.leader.deaths, 1);
  assert.deepEqual([revived.dukeVidal!.controller, revived.dukeVidal!.source, revived.dukeVidal!.acquiredTurn], [null, null, null]);
  assert.deepEqual(revived.leaderSkills, skillInventory);
  assert.deepEqual(trainer(revived, f.owner), assigned);
  assert.equal(revived.leaderSkills!.offers[f.owner], undefined);
  custody(revived);
});

void test('fresh human IDs retain original module acquisition chronology; insufficient Tech seats and Advanced Hark reject without conversion', () => {
  const initial = createGame('HUMANECAZMODULES', newPlayer('human-ecaz', 'Human Ecaz', 'ecaz'), true, ['ecaz']);
  joinGame(initial, newPlayer('human-emperor', 'Human Emperor', 'emperor'));
  joinGame(initial, newPlayer('human-atreides', 'Human Atreides', 'atreides'));
  const snapshot = structuredClone(initial), f = fixture({ initial, kind: 'suk' });
  assert.deepEqual(initial, snapshot);
  assert.deepEqual(f.game.players.map(p => p.id), snapshot.players.map(p => p.id));
  assert.equal(f.owner, 'human-ecaz'); assert.equal(f.opponent, 'human-emperor');
  assert.equal(f.beforeFirstMentat.strongholdCards!.owners.arrakeen, null);
  const claimed = act(f.beforeFirstMentat, f.firstMentatStep.actor, f.firstMentatStep.action);
  assert.equal(claimed.turn, 2); assert.equal(claimed.strongholdCards!.claimedTurn, 1);
  assert.equal(claimed.strongholdCards!.owners.arrakeen, f.owner);
  const physicalSkills = [...f.offered.leaderSkills!.deck, ...Object.values(f.offered.leaderSkills!.offers).flatMap(o => o.cards)];
  assert.deepEqual(physicalSkills.sort(), LEADER_SKILL_CARDS.map(c => c.id).sort());
  assert.equal(f.offered.players.find(p => p.id === f.owner)!.reserves, 20);
  const two = createGame('ECAZTWOTECH', newPlayer('e', 'Ecaz', 'ecaz'), true, ['ecaz']);
  joinGame(two, newPlayer('p', 'Emperor', 'emperor'));
  let unsupported = applyAction(two, two.host, { type: 'techTokens', enabled: true });
  for (const p of unsupported.players) unsupported = applyAction(unsupported, p.id, { type: 'ready' });
  const before = structuredClone(unsupported);
  assert.throws(() => initializeLeaderSkillsGameForAudit(unsupported)); assert.deepEqual(unsupported, before);
  const hark = createGame('ECAZHARK', newPlayer('e', 'Ecaz', 'ecaz'), true, ['ecaz']);
  joinGame(hark, newPlayer('p', 'Emperor', 'emperor')); joinGame(hark, newPlayer('h', 'Harkonnen', 'harkonnen'));
  let advancedHark = applyAction(hark, hark.host, { type: 'techTokens', enabled: true });
  for (const p of advancedHark.players) advancedHark = applyAction(advancedHark, p.id, { type: 'ready' });
  const harkBefore = structuredClone(advancedHark);
  assert.throws(() => initializeLeaderSkillsGameForAudit(advancedHark)); assert.deepEqual(advancedHark, harkBefore);
  custody(settle(reveal(f)));
});

void test('real two-seat Stronghold and six-seat Basic/Advanced Tech boundaries preserve native Emperor5 and Fremen3 inventories', () => {
  const two = createGame('ECAZTWOSTRONG', newPlayer('two-ecaz', 'Ecaz', 'ecaz'), true, ['ecaz']);
  joinGame(two, newPlayer('two-emperor', 'Emperor', 'emperor'));
  const twoCase = fixture({ initial: two, tech: false, stronghold: true });
  const twoDone = settle(reveal(twoCase));
  assert.equal(twoDone.lastBattleContext!.winner, twoCase.owner);
  assert.equal(player(twoDone, twoCase.owner).tanks, 2);
  assert.equal(twoCase.afterFirstMentat.strongholdCards!.owners.arrakeen, twoCase.owner);
  custody(twoDone);
  for (const rules of ['basic', 'advanced'] as const) {
    const six = createGame(`ECAZSIX${rules}`, newPlayer('six-ecaz', 'Ecaz', 'ecaz'), rules === 'advanced', ['ecaz']);
    for (const faction of ['emperor', 'atreides', 'guild', 'fremen', 'beneGesserit'] as const)
      joinGame(six, newPlayer(`six-${faction}`, faction, faction));
    const f = fixture({ initial: six, rules, tech: true, stronghold: rules === 'advanced' });
    const game = settle(reveal(f));
    assert.equal(game.lastBattleContext!.winner, f.owner);
    assert.equal(player(game, f.owner).forces[f.location], 4);
    assert.equal(player(game, f.owner).tanks, 2);
    if (rules === 'advanced') {
      assert.equal(game.players.find(p => p.faction === 'fremen')!.elites!.reserves, 3);
      assert.equal(game.players.find(p => p.faction === 'emperor')!.elites!.reserves, 5);
    } else assert.ok(game.players.every(p => !p.elites));
    assert.deepEqual(game.players.map(p => p.id), six.players.map(p => p.id));
    custody(game);
  }
  const basicHark = createGame('ECAZBASICHARK', newPlayer('basic-ecaz', 'Ecaz', 'ecaz'), false, ['ecaz']);
  joinGame(basicHark, newPlayer('basic-emperor', 'Emperor', 'emperor'));
  joinGame(basicHark, newPlayer('basic-hark', 'Harkonnen', 'harkonnen'));
  const allowed = fixture({ initial: basicHark, rules: 'basic', tech: true, stronghold: false });
  const done = settle(reveal(allowed));
  assert.equal(done.lastBattleContext!.winner, allowed.owner);
  assert.equal(player(done, allowed.owner).tanks, 2);
  assert.equal(player(done, 'basic-hark').traitors.length, 4);
  custody(done);
});
