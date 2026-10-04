import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { DUKE_VIDAL_ID } from '../game/duke-vidal';
import { quoteNexusEcazDuke, createNexusEcazDukeReceipt } from '../game/nexus-ecaz-duke';
import { ownedTech } from '../game/tech-tokens';
import {
  advanceEcazNexusSkillsModules as advance, assertEcazNexusSkillsModulesCustody as custody,
  completeEcazNexusSkillsModulesSetup as complete, createEcazNexusSkillsModulesFixture as fixture,
  ecazNexusSkillsModulesAction as act, ecazNexusSkillsModulesCurrentControl as controls,
  ecazNexusSkillsModulesPlayer as player, ecazNexusSkillsModulesSourceFacts as facts,
  ecazNexusSkillsModulesTrainer as trainer, expireEcazNexusSkillsModulesDuke as expire,
  initializeEcazNexusSkillsModules as initialize, reloadEcazNexusSkillsModules as reload,
  revealEcazNexusSkillsModulesBattle as reveal, settleEcazNexusSkillsModulesBattle as settle,
  stepEcazNexusSkillsModules as step, type EcazNexusSkillsModulesOptions,
} from './fixture-ecaz-nexus-skills-modules';

function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'Rejected actions must preserve the actual original source.');
}
function policy(game: Game, actor: string, difficulty: typeof DIFFICULTIES[number]): Action {
  const view = viewGame(reload(game), actor);
  view.players.find(p => p.id === actor)!.bot = difficulty;
  const action = botActions(view)[0]; assert.ok(action);
  return action;
}
const profiles: EcazNexusSkillsModulesOptions[] = [
  { rules: 'basic', tech: false, stronghold: false },
  { rules: 'advanced', tech: false, stronghold: false },
  { rules: 'basic', tech: true, stronghold: false },
  { rules: 'advanced', tech: true, stronghold: false },
  { rules: 'advanced', tech: false, stronghold: true },
  { rules: 'advanced', tech: true, stronghold: true },
];

void test('all six standalone Ecaz bands draw at a genuine closing Nexus and spend living unclaimed Duke once without native Moritani', () => {
  for (const options of profiles) {
    const f = fixture(options);
    assert.equal(f.offered.setupStage, 'leaderSkills');
    assert.equal(f.offered.players.flatMap(p => p.traitors).length, 0);
    assert.equal(f.offered.players.flatMap(p => p.traitorChoices).length, 0);
    assert.equal(f.afterSetup.players.some(p => p.faction === 'moritani'), false);
    assert.equal(f.afterFirstStorm.techTokens ? ownedTech(f.afterFirstStorm.techTokens, f.owner).length : 0, options.tech ? 1 : 0);
    if (options.stronghold) {
      assert.equal(f.beforeFirstMentat.strongholdCards!.owners[f.territory], null);
      assert.equal(f.afterFirstMentat.strongholdCards!.owners[f.territory], f.owner);
    }
    assert.equal(f.closingDraw.before.nexusCards!.cards!.hands[f.owner], null);
    assert.ok(f.closingDraw.before.nexusCards!.phase!.eligible.includes(f.owner));
    assert.equal(player(f.closingDraw.before, f.opponent).ally, f.observer);
    assert.equal(player(f.closingDraw.before, f.observer).ally, f.opponent);
    assert.equal(player(f.closingDraw.before, f.owner).ally, null);
    const drawn = step(f.closingDraw.before, f.closingDraw.step);
    assert.equal(drawn.nexusCards!.cards!.hands[f.owner], 'ecaz');
    assert.equal(drawn.nexusCards!.cards!.deck.includes('ecaz'), false);
    custody(drawn);
    assert.equal(f.closingDraw.after.nexusCards!.cards!.hands[f.owner], 'ecaz');
    assert.equal(f.beforeCunning.dukeVidal!.controller, null);
    assert.equal(f.beforeCunning.dukeVidal!.leader.dead, false);
    assert.equal(viewGame(f.beforeCunning, f.opponent).nexusEcazDuke, null);
    assert.equal(viewGame(f.beforeCunning, f.observer).nexusEcazDuke, null);
    reject(f.beforeCunning, f.opponent, f.cunning.step.action);
    reject(f.beforeCunning, f.owner, { type: 'nexusEcazDuke', event: `${viewGame(f.beforeCunning, f.owner).nexusEcazDuke!.event}-stale` });
    const acquired = step(f.beforeCunning, f.cunning.step);
    assert.deepEqual(acquired, f.cunning.after);
    assert.deepEqual([acquired.dukeVidal!.controller, acquired.dukeVidal!.source, acquired.dukeVidal!.acquiredTurn], [f.owner, 'ecazNexus', acquired.turn]);
    assert.equal(acquired.nexusCards!.cards!.hands[f.owner], null);
    assert.equal(acquired.nexusCards!.cards!.discard.filter(c => c === 'ecaz').length, 1);
    assert.equal(acquired.nexusEcazDukeHistory!.length, 1);
    assert.equal(acquired.nexusEcazDukeHistory![0].before.controller, null);
    assert.deepEqual(acquired.leaderSkills, f.beforeCunning.leaderSkills);
    assert.deepEqual(acquired.players.map(p => p.leaders), f.beforeCunning.players.map(p => p.leaders));
    assert.equal(player(acquired, f.owner).leaders.length, 5);
    assert.ok(acquired.players.every(p => p.leaders.every(l => l.id !== DUKE_VIDAL_ID)));
    assert.ok(viewGame(acquired, f.owner).players.find(p => p.id === f.owner)!.leaders.some(l => l.id === DUKE_VIDAL_ID));
    assert.ok(viewGame(acquired, f.owner).leaderSkills!.eligibleLeaders.every(l => l.id !== DUKE_VIDAL_ID));
    reject(acquired, f.owner, f.cunning.step.action);
    custody(acquired);
  }
});

void test('normal Warmaster discipline composes real Nexus Duke6, winner cleanup and mandatory original Tech; selected training never transfers to Duke', () => {
  for (const options of profiles) for (const band of ['normal', 'skilled'] as const) {
    const f = fixture({ ...options, band });
    const assigned = structuredClone(trainer(f.game, f.owner)), native = structuredClone(player(f.game, f.owner).leaders);
    const revealed = reveal(f.game, f.plans), source = facts(revealed, f.owner, f.opponent);
    const winner = band === 'normal' ? f.owner : f.opponent;
    let game = settle(revealed, 'cards');
    assert.equal(game.lastBattleContext!.winner, winner);
    const winnerUsedCard = f.plans.find(plan => plan.actor === winner)!.action.weapon;
    if (winnerUsedCard) {
      assert.equal(game.decision?.kind, 'battleCards');
      assert.equal(game.decision?.player, winner);
    }
    assert.equal(game.dukeVidal!.leader.dead, false);
    assert.equal(game.dukeVidal!.leader.usedAt, f.territory);
    assert.deepEqual([game.dukeVidal!.controller, game.dukeVidal!.source, game.dukeVidal!.acquiredTurn], [null, null, null]);
    assert.deepEqual(player(game, f.owner).leaders, native);
    assert.deepEqual(trainer(game, f.owner), assigned);
    assert.equal(player(game, f.owner).tanks, winner === f.owner ? 0 : 8);
    const enemyDial = f.plans[1].action.dial as number;
    assert.equal(player(game, f.opponent).tanks, winner === f.owner ? 8 : enemyDial);
    if (winnerUsedCard) {
      if (game.techTokens) {
        const loser = winner === f.owner ? f.opponent : f.owner;
        const token = ownedTech(revealed.techTokens, loser)[0]; assert.ok(token);
        reject(game, winner, { type: 'decision', token });
        assert.equal(game.techTokens[token].owner, loser);
      }
      game = settle(act(game, winner, { type: 'decision', discard: [] }));
    }
    if (game.techTokens) {
      const loser = winner === f.owner ? f.opponent : f.owner;
      for (const token of ownedTech(revealed.techTokens, loser)) assert.equal(game.techTokens[token].owner, winner);
    }
    const worthless = source.ownHand.find(c => c.kind === 'worthless')!.id;
    assert.equal(player(game, f.owner).hand.some(c => c.id === worthless), winner === f.owner);
    assert.equal(game.discard.some(c => c.id === worthless), winner !== f.owner);
    assert.equal(game.battle, null);
    if (game.strongholdCards) {
      assert.equal(game.strongholdCards.owners[f.territory], f.owner, 'Held cards do not transfer at battle resolution.');
      assert.equal(controls(game)[f.territory], winner, 'Current sole physical control is independent of retained card custody.');
    }
    const afterExpiry = expire(game);
    assert.equal(afterExpiry.dukeVidal!.leader.usedAt, undefined);
    assert.equal(afterExpiry.dukeVidal!.controller, null);
    assert.deepEqual(trainer(afterExpiry, f.owner), assigned);
    if (game.strongholdCards) assert.equal(afterExpiry.strongholdCards!.owners[f.territory], winner);
    custody(afterExpiry);
  }
});

void test('normal Suk on the actual Duke rescues one real dial casualty with and without held Arrakeen subsidy', () => {
  for (const options of profiles) {
    const f = fixture({ ...options, skill: 'suk-graduate', band: 'normal', ownerDial: 5, opponentDial: 0 });
    const revealed = reveal(f.game, f.plans), source = facts(revealed, f.owner, f.opponent);
    let game = settle(revealed, 'cards');
    assert.equal(game.lastBattleContext!.winner, f.owner);
    assert.equal(game.pendingSukRescue, null, 'The face-up normal skill is automatic and never borrows the selected-disc three-force rescue.');
    assert.equal(player(game, f.owner).forces[f.location], 3);
    assert.equal(player(game, f.owner).reserves, source.ownReserves + 1);
    assert.equal(player(game, f.owner).tanks, 4);
    assert.equal(player(game, f.opponent).tanks, 8);
    assert.equal(player(game, f.owner).spice, source.ownWallet - (f.game.advanced ? options.stronghold ? 3 : 5 : 0));
    assert.equal(game.dukeVidal!.leader.dead, false);
    assert.equal(game.dukeVidal!.leader.usedAt, f.territory);
    assert.equal(game.dukeVidal!.controller, null);
    assert.deepEqual(trainer(game, f.owner), source.assignment);
    game = settle(act(game, f.owner, { type: 'decision', discard: [] }));
    for (const token of source.enemyTech) assert.equal(game.techTokens![token].owner, f.owner);
    custody(game);
  }
});

void test('ordinary trained Ecaz Suk keeps one casualty locally and returns two, while unused Nexus Duke expires only at genuine turn end', () => {
  for (const options of profiles) {
    const f = fixture({ ...options, kind: 'suk', band: 'skilled' });
    const revealed = reveal(f.game, f.plans), source = facts(revealed, f.owner, f.opponent);
    let game = settle(revealed, 'suk');
    assert.equal(game.decision?.kind, 'sukRescue');
    if (game.decision?.kind !== 'sukRescue') throw Error('Expected the original selected-disc rescue.');
    assert.deepEqual(game.pendingSukRescue!.losses, { normal: 5, elite: 0, paidNormal: game.advanced ? 5 : 0, paidElite: 0 });
    assert.equal(game.dukeVidal!.controller, f.owner);
    assert.equal(game.dukeVidal!.source, 'ecazNexus');
    assert.equal(game.dukeVidal!.leader.usedAt, undefined);
    const event = game.decision.event;
    reject(game, f.opponent, { type: 'decision', event, choice: 0 });
    reject(game, f.owner, { type: 'decision', event: `${event}-stale`, choice: 0 });
    reject(game, f.owner, { type: 'decision', event, choice: game.decision.options.length });
    const choice = game.decision.options.findIndex(o => o.normal === 3 && o.elite === 0 && o.kept?.key === f.location); assert.ok(choice >= 0);
    game = settle(act(game, f.owner, { type: 'decision', event, choice }), 'cards');
    assert.equal(player(game, f.owner).forces[f.location], 4);
    assert.equal(player(game, f.owner).reserves, source.ownReserves + 2);
    assert.equal(player(game, f.owner).tanks, 2);
    assert.equal(game.pendingSukRescue, null);
    assert.equal(game.lastBattleContext!.sukRescue!.completed, true);
    for (const token of source.enemyTech) assert.equal(game.techTokens![token].owner, f.opponent);
    game = settle(act(game, f.owner, { type: 'decision', discard: [] }));
    assert.equal(game.dukeVidal!.controller, f.owner, 'Winning with an ordinary disc does not consume the unused shared Duke.');
    assert.deepEqual(trainer(game, f.owner), source.assignment);
    const afterExpiry = expire(game);
    assert.deepEqual([afterExpiry.dukeVidal!.controller, afterExpiry.dukeVidal!.source, afterExpiry.dukeVidal!.acquiredTurn], [null, null, null]);
    assert.equal(afterExpiry.dukeVidal!.leader.dead, false);
    assert.equal(afterExpiry.nexusEcazDukeHistory!.length, 1);
    assert.equal(afterExpiry.nexusCards!.cards!.discard.filter(c => c === 'ecaz').length, 1);
    custody(afterExpiry);
  }
});

void test('retained Carthag supplies real Duke Shield-as-Snooper, and losing Tuek income and printed Duke6 bounty precede original winner cleanup', () => {
  const safe = fixture({ strongholdKind: 'carthag', poison: true, defense: true });
  const shield = player(safe.game, safe.owner).hand.find(c => c.kind === 'shield')!.id;
  const defended = settle(reveal(safe.game, safe.plans));
  assert.equal(defended.lastBattleContext!.winner, safe.owner);
  assert.equal(defended.dukeVidal!.leader.dead, false);
  assert.equal(player(defended, safe.owner).hand.some(c => c.id === shield), true);
  assert.equal(defended.strongholdCards!.owners.carthag, safe.owner);
  custody(defended);
  const f = fixture({ strongholdKind: 'tueks_sietch', poison: true, opponentDial: 0 });
  const revealed = reveal(f.game, f.plans), source = facts(revealed, f.owner, f.opponent);
  let game = settle(revealed, 'cards');
  assert.equal(game.lastBattleContext!.winner, f.opponent);
  assert.equal(game.dukeVidal!.leader.dead, true);
  assert.equal(game.dukeVidal!.leader.deaths, 1);
  assert.equal(player(game, f.owner).spice, source.ownWallet + 2);
  assert.equal(player(game, f.opponent).spice, source.enemyWallet + 6);
  assert.equal(player(game, f.owner).tanks, 8);
  assert.deepEqual(player(game, f.owner).leaders, source.nativeLeaders);
  assert.deepEqual(trainer(game, f.owner), source.assignment);
  assert.equal(game.strongholdCards!.owners.tueks_sietch, f.owner);
  const weapon = source.enemyHand.find(c => c.kind === 'poison')!.id;
  const worthless = source.ownHand.find(c => c.kind === 'worthless')!.id;
  game = settle(act(game, f.opponent, { type: 'decision', discard: [] }));
  assert.equal(game.discard.some(c => c.id === worthless), true);
  assert.equal(player(game, f.opponent).hand.some(c => c.id === weapon), true);
  for (const token of ownedTech(revealed.techTokens, f.owner)) assert.equal(game.techTokens![token].owner, f.opponent);
  custody(game);
});

void test('held Habbanya wins the real Duke tie and Tabr pays the actual opposing dial independently of cleanup and current control', () => {
  const tie = fixture({ strongholdKind: 'habbanya_ridge_sietch', opponentDial: 2 });
  const tied = settle(reveal(tie.game, tie.plans), 'cards');
  assert.equal(tied.lastBattleContext!.winner, tie.owner);
  assert.equal(player(tied, tie.owner).forces[tie.location], 8);
  assert.equal(player(tied, tie.opponent).tanks, 8);
  assert.equal(tied.strongholdCards!.owners.habbanya_ridge_sietch, tie.owner);
  assert.equal(controls(tied).habbanya_ridge_sietch, tie.owner);
  const completeTie = settle(act(tied, tie.owner, { type: 'decision', discard: [] }));
  custody(completeTie);
  const f = fixture({ strongholdKind: 'sietch_tabr' });
  const revealed = reveal(f.game, f.plans), source = facts(revealed, f.owner, f.opponent);
  const opposingDial = f.plans[1].action.dial as number;
  let game = settle(revealed, 'cards');
  assert.equal(game.lastBattleContext!.winner, f.owner);
  assert.equal(player(game, f.owner).spice, source.ownWallet + opposingDial);
  assert.equal(player(game, f.opponent).spice, source.enemyWallet - opposingDial);
  assert.equal(player(game, f.owner).forces[f.location], 8);
  assert.equal(player(game, f.opponent).tanks, 8);
  assert.equal(game.dukeVidal!.controller, null);
  assert.equal(game.dukeVidal!.leader.usedAt, f.territory);
  assert.deepEqual(trainer(game, f.owner), source.assignment);
  for (const token of source.enemyTech) assert.equal(game.techTokens![token].owner, f.opponent);
  game = settle(act(game, f.owner, { type: 'decision', discard: [] }));
  for (const token of source.enemyTech) assert.equal(game.techTokens![token].owner, f.owner);
  custody(game);
});

void test('all four minimal legal policies execute native Cunning, trained rescue, winner cards and original Tech without inventing a plan', () => {
  const f = fixture({ kind: 'suk', band: 'skilled' });
  const revealed = reveal(f.game, f.plans), rescue = settle(revealed, 'suk');
  for (const difficulty of DIFFICULTIES) {
    const cunning = act(f.beforeCunning, f.owner, policy(f.beforeCunning, f.owner, difficulty));
    assert.equal(cunning.dukeVidal!.controller, f.owner);
    assert.equal(cunning.nexusCards!.cards!.hands[f.owner], null);
    let game = settle(act(rescue, f.owner, policy(rescue, f.owner, difficulty)), 'cards');
    assert.equal(game.pendingSukRescue, null);
    assert.equal(player(game, f.owner).forces[f.location], 4);
    assert.equal(player(game, f.owner).tanks, 2);
    assert.equal(player(game, f.owner).reserves, player(revealed, f.owner).reserves + 2);
    game = settle(act(game, f.owner, policy(game, f.owner, difficulty)));
    assert.equal(game.battle, null);
    assert.equal(game.lastBattleContext!.winner, f.owner);
    for (const token of ownedTech(revealed.techTokens, f.opponent)) assert.equal(game.techTokens![token].owner, f.owner);
    assert.deepEqual(trainer(game, f.owner), trainer(revealed, f.owner));
    custody(game);
  }
});

void test('each of the five genuine native discs may take its actual offered skill, but foreign discs and Duke cannot be assigned', () => {
  const offered = initialize({ tech: false, stronghold: false });
  const owner = offered.players.find(p => p.faction === 'ecaz')!.id;
  const offer = offered.leaderSkills!.offers[owner];
  assert.ok(offer.cards.includes('warmaster'));
  const native = player(offered, owner).leaders;
  assert.equal(native.length, 5);
  for (const disc of native) {
    const game = complete(offered, { leader: disc.id });
    assert.equal(trainer(game, owner).leader, disc.id);
    assert.equal(trainer(game, owner).skill, 'warmaster');
    custody(game);
  }
  for (const leader of [DUKE_VIDAL_ID, offered.players.find(p => p.id !== owner)!.leaders[0].id])
    reject(offered, owner, { type: 'leaderSkill', event: offer.event, skill: 'warmaster', leader });
  const absent = ['warmaster', 'suk-graduate', 'sandmaster', 'planetologist'] as const;
  const skill = absent.find(c => !offer.cards.includes(c)); assert.ok(skill);
  const before = structuredClone(offered);
  assert.throws(() => complete(offered, { skill }));
  assert.deepEqual(offered, before, 'Original own-seat offers cannot be redealt to satisfy a fixture request.');
});

void test('quiet-boundary custody guards remain pure and reject receipt creation; exceptional recovery is not staged as played history', () => {
  const f = fixture({ tech: false, stronghold: false });
  const g = f.beforeCunning, duke = g.dukeVidal!, event = viewGame(g, f.owner).nexusEcazDuke!.event;
  // Quote-only hypothetical inputs, NOT accepted games, fabricated acquisitions,
  // resurrected leaders or completed receipts. Actual runtime sources above are
  // unchanged; each rejected alternative must leave the physical card unspent.
  const alternatives: Game[] = [
    { ...g, dukeVidal: { ...duke, leader: { ...duke.leader, dead: true } } },
    { ...g, dukeVidal: { ...duke, leader: { ...duke.leader, capturedBy: f.opponent } } },
    { ...g, dukeVidal: { ...duke, leader: { ...duke.leader, gholaBy: f.opponent } } },
    { ...g, dukeVidal: { ...duke, leader: { ...duke.leader, usedAt: f.territory } } },
    { ...g, dukeVidal: { ...duke, controller: f.owner } },
    { ...g, players: g.players.map(p => p.id === f.owner ? { ...p, ally: f.opponent } : p) },
    { ...g, phase: 5 },
    { ...g, battle: f.game.battle },
  ];
  for (const input of alternatives) {
    assert.ok(quoteNexusEcazDuke(input, f.owner)?.blocked);
    assert.throws(() => createNexusEcazDukeReceipt(input, f.owner));
    assert.equal(g.nexusCards!.cards!.hands[f.owner], 'ecaz');
    assert.equal(g.nexusEcazDukeHistory?.length ?? 0, 0);
  }
  reject(g, f.owner, { type: 'nexusEcazDuke', event: `${event}-stale` });
  reject(f.game, f.owner, f.cunning.step.action);
  custody(g);
});

void test('original human lobby and setup IDs/offer stock survive continuation; two-seat play never fabricates an unallied closing draw', () => {
  const initial = createGame('HUMANECAZNEXUS', newPlayer('human-ecaz', 'Human Ecaz', 'ecaz'), true, ['ecaz']);
  joinGame(initial, newPlayer('human-emperor', 'Human Emperor', 'emperor'));
  joinGame(initial, newPlayer('human-atreides', 'Human Atreides', 'atreides'));
  const before = structuredClone(initial), f = fixture({ initial, tech: true, stronghold: true });
  assert.deepEqual(initial, before);
  assert.deepEqual(f.afterSetup.players.map(p => p.id), initial.players.map(p => p.id));
  assert.equal(f.owner, 'human-ecaz'); assert.equal(f.opponent, 'human-emperor');
  assert.deepEqual(initialize({ initial: f.offered }), f.offered);
  custody(f.game);
  const two = createGame('TWOECAZNEXUS', newPlayer('human-two-ecaz', 'Human Ecaz', 'ecaz'), true, ['ecaz']);
  joinGame(two, newPlayer('human-two-emperor', 'Human Emperor', 'emperor'));
  const offered = initialize({ initial: two, tech: false, stronghold: true });
  const game = complete(offered);
  assert.equal(game.players.length, 2);
  assert.ok(game.players.every(p => game.nexusCards!.cards!.hands[p.id] === null));
  custody(game);
  assert.throws(() => fixture({ initial: two, tech: false, stronghold: true }));
  assert.throws(() => initialize({ initial: two, tech: true, stronghold: true }));
  const basic = createGame('BASICECAZNEXUS', newPlayer('b-ecaz', 'Ecaz', 'ecaz'), false, ['ecaz']);
  joinGame(basic, newPlayer('b-emperor', 'Emperor', 'emperor'));
  assert.throws(() => initialize({ initial: basic, tech: false, stronghold: true }));
  for (const faction of ['harkonnen', 'moritani', 'ixians', 'choam'] as const) {
    const expansions = faction === 'ixians' ? ['ecaz', 'ix'] : faction === 'choam' ? ['ecaz', 'choam'] : ['ecaz'];
    const unsupported = createGame('BOUNDARYECAZNEXUS', newPlayer('e', 'Ecaz', 'ecaz'), true, expansions);
    joinGame(unsupported, newPlayer('x', faction, faction));
    assert.throws(() => initialize({ initial: unsupported, tech: false, stronghold: false }));
  }
  assert.throws(() => initialize({ initial: f.afterSetup }));
  const basicHark = createGame('BASICHARKECAZNEXUS', newPlayer('e', 'Ecaz', 'ecaz'), false, ['ecaz']);
  joinGame(basicHark, newPlayer('h', 'Harkonnen', 'harkonnen'));
  joinGame(basicHark, newPlayer('a', 'Atreides', 'atreides'));
  const nativeBasic = complete(initialize({ initial: basicHark, tech: false, stronghold: false }));
  assert.equal(nativeBasic.players.find(p => p.faction === 'harkonnen')!.traitors.length, 4);
  custody(nativeBasic);
});

void test('original six-seat Basic and Advanced Skills/Nexus retain full native inventories with unused optional module bands', () => {
  for (const advanced of [false, true]) {
    const initial = createGame('SIXECAZNEXUS', newPlayer('six-ecaz', 'Ecaz', 'ecaz'), advanced, ['ecaz']);
    for (const faction of ['atreides', 'emperor', 'guild', 'fremen', 'beneGesserit'] as const)
      joinGame(initial, newPlayer(`six-${faction}`, faction, faction));
    const offered = initialize({ initial, tech: true, stronghold: advanced });
    const game = complete(offered);
    assert.equal(game.leaderSkills!.assignments.length, 6);
    assert.equal(player(game, 'six-ecaz').leaders.length, 5);
    if (advanced) {
      for (const [actor, total] of [['six-fremen', 3], ['six-emperor', 5]] as const) {
        const elites = player(game, actor).elites; assert.ok(elites);
        assert.equal(elites.reserves + elites.tanks + Object.values(elites.forces).reduce((sum, n) => sum + n, 0), total);
      }
    } else assert.ok(game.players.every(p => !p.elites));
    const storm = advance(game, g => g.phase === 1 && !g.response && !g.phaseOpening && !g.decision);
    assert.equal(storm.techTokens!.production.owner, 'six-fremen');
    const owners = Object.values(storm.techTokens!).map(token => token.owner);
    assert.ok(owners.every(owner => owner !== null && storm.players.some(p => p.id === owner)));
    assert.equal(new Set(owners).size, 3, 'Actual first Storm assigns the remaining tokens to distinct native seats, not to all six players.');
    custody(storm);
  }
});
