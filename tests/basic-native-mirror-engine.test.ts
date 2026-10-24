import assert from 'node:assert/strict';
import test from 'node:test';
import { mirrorWeaponModeBlock } from '../game/mirror-weapon-mode';
import { viewGame, type Game, type Action } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { nextBasicEcazNativeStep } from './fixture-basic-ecaz-native';
import { createBasicNativeMirrorFixture as fixture, actBasicNativeMirror as act,
  basicNativeMirrorPlayer as player, basicNativeMirrorInventory as inventory,
  basicNativeMirrorClean as clean, type BasicNativeMirrorFixture } from './fixture-basic-native-mirror';

void test('bare Basic E3 and mixed native families admit Mirror without adding optional-module permission', () => {
  const native = { expansions: ['choam', 'ecaz', 'ix'], advanced: false,
    players: (['ecaz', 'ixians', 'choam', 'richese', 'moritani', 'tleilaxu'] as const).map(faction => ({ faction })) } as const;
  assert.equal(mirrorWeaponModeBlock(native), null);
  assert.equal(mirrorWeaponModeBlock({ ...native, expansions: ['choam', 'ecaz'] }), null);
  for (const selectedModule of ['homeworlds', 'nexusCards', 'leaderSkills', 'discoveries', 'sandtrout'] as const)
    assert.ok(mirrorWeaponModeBlock({ ...native, [selectedModule]: true }));
  assert.ok(mirrorWeaponModeBlock({ ...native, techTokens: {} }));
  assert.ok(mirrorWeaponModeBlock({ ...native, expansions: ['choam', 'ecaz'], techTokens: {} }));
  assert.equal(mirrorWeaponModeBlock({ ...native, expansions: ['choam', 'ecaz'], advanced: true, techTokens: {} }), null);
  assert.ok(mirrorWeaponModeBlock({ ...native, expansions: ['ecaz', 'ix'] }));
});

function plan(game: Game, actor: string, weapon: string, variable: number): Action {
  const profile = viewGame(game, actor).battle!.ecazOccupy?.profile;
  const fixed = profile?.planOwner === actor ? profile.fixedEcazDial : 0;
  const leader = player(game, actor).leaders.find(leader => !leader.dead && !leader.usedAt); assert.ok(leader);
  return { type: 'battlePlan', dial: fixed + variable, support: 0, leader: leader.id, weapon };
}
function reveal(f: BasicNativeMirrorFixture, own = 2, other = 0) {
  const first = act(f.game, f.owner, plan(f.game, f.owner, f.mirror, own));
  assert.equal(first.battle!.revealed, false);
  assert.equal(viewGame(first, f.opponent).battle!.plans[f.owner], undefined);
  return act(first, f.opponent, plan(first, f.opponent, f.original, other));
}
function complete(source: Game, total?: number) {
  let game = source;
  for (let count = 0; count < 180; count++) {
    if (!game.battle && clean(game)) return game;
    const d = game.decision;
    if (!game.response && !game.phaseOpening && d?.kind === 'stoneAllocation') {
      const quote = viewGame(game, d.player).battle!.stoneAllocation!;
      const selected = total ?? quote.totals[0]; assert.ok(quote.totals.includes(selected));
      game = act(game, d.player, { type: 'decision', event: quote.event, undialed: selected });
    } else if (!game.response && !game.phaseOpening && d?.kind === 'battleLosses') {
      game = act(game, d.player, { type: 'decision', choice: 0 });
    } else {
      const step = nextBasicEcazNativeStep(game); assert.ok(step);
      assert.notEqual(step.action.type, 'battlePlan');
      game = act(game, step.actor, step.action);
    }
  }
  throw Error('The actual Basic native battle did not finish');
}
function conserve(game: Game) {
  for (const p of game.players) {
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((sum, n) => sum + n, 0), 20);
    if (p.elites) assert.equal(p.elites.reserves + p.elites.tanks +
      Object.values(p.elites.forces).reduce((sum, n) => sum + n, 0), p.faction === 'ixians' ? 7 : 5);
  }
}
for (const owner of ['ecaz', 'ally', 'moritani'] as const)
  void test(`Basic native ${owner} Mirror copies Tooth first, retains physical winning identity and finishes original accounting`, () => {
    const f = fixture({ owner });
    assert.equal(f.source.status, 'setup'); assert.equal(f.source.advanced, false);
    assert.equal(f.afterSetup.status, 'playing'); assert.equal(f.game.advanced, false);
    conserve(f.game);
    let game = reveal(f, owner === 'moritani' ? 4 : 2);
    assert.equal(game.decision?.kind, 'poisonTooth'); assert.equal(game.decision.player, f.owner);
    assert.equal(game.decision.physicalId, f.mirror); assert.equal(game.decision.copiedFrom, f.original);
    assert.equal(game.battle!.plans[f.owner].weapon, f.mirror);
    assert.equal(game.battle!.plans[f.opponent].weapon, f.original);
    const bounty = [f.owner, f.opponent].reduce((sum, actor) => sum +
      player(game, actor).leaders.find(leader => leader.id === game.battle!.plans[actor].leader)!.strength, 0);
    game = act(game, f.owner, { type: 'decision', event: game.decision.event, activate: true });
    assert.equal(game.decision?.kind, 'poisonTooth'); assert.equal(game.decision.player, f.opponent);
    game = act(game, f.opponent, { type: 'decision', event: game.decision.event, activate: false });
    game = complete(game);
    assert.equal(game.lastBattleContext!.winner, f.owner);
    assert.ok(player(game, f.owner).hand.some(card => card.id === f.mirror));
    assert.ok(game.discard.some(card => card.id === f.original));
    assert.equal(player(game, f.owner).spice, player(f.game, f.owner).spice + bounty,
      'Basic charges no support and awards only the actual printed dead-leader bounty');
    assert.deepEqual(inventory(game), f.originalInventory); conserve(game);
  });

for (const owner of ['ecaz', 'ally'] as const)
  void test(`Basic native ${owner} copied Stone keeps fixed Ecaz counters and the Ixian owner's physical alternatives`, () => {
    const f = fixture({ owner, weapon: 'stoneBurner' }); let game = reveal(f);
    assert.equal(game.decision?.kind, 'stoneBurner'); assert.equal(game.decision.player, f.owner);
    game = act(game, f.owner, { type: 'decision', event: game.decision.event, mode: 'ignore' });
    assert.equal(game.decision?.kind, 'stoneBurner'); assert.equal(game.decision.player, f.opponent);
    game = act(game, f.opponent, { type: 'decision', event: game.decision.event, mode: 'ignore' });
    for (let count = 0; count < 50 && game.decision?.kind !== 'stoneAllocation'; count++) {
      const step = nextBasicEcazNativeStep(game); assert.ok(step); game = act(game, step.actor, step.action);
    }
    assert.equal(game.decision?.kind, 'stoneAllocation'); assert.equal(game.decision.player, f.ally);
    const offer = viewGame(game, f.ally).battle!.stoneAllocation!;
    assert.equal(offer.owner, f.ally); assert.equal(offer.player, f.owner);
    assert.deepEqual(offer.totals, [6, 9]);
    for (const total of offer.totals) {
      const after = complete(game, total);
      assert.equal(after.lastBattleContext!.winner, total === 9 ? f.owner : f.opponent);
      assert.equal(player(after, f.ecaz).forces[f.location] ?? 0, total === 9 ? 2 : 0);
      assert.equal(player(after, f.ally).forces[f.location] ?? 0, total === 9 ? 7 : 0);
      assert.equal(player(after, f.ally).elites!.forces[f.location] ?? 0, total === 9 ? 1 : 0);
      assert.equal(player(after, f.owner).hand.some(card => card.id === f.mirror), total === 9);
      assert.deepEqual(inventory(after), f.originalInventory); conserve(after);
    }
  });

void test('Basic Moritani copied Stone compares physical counters against the original typed coalition', () => {
  const f = fixture({ owner: 'moritani', weapon: 'stoneBurner' }); let game = reveal(f, 0, 6);
  assert.equal(game.decision?.kind, 'stoneBurner'); assert.equal(game.decision.player, f.owner);
  game = act(game, f.owner, { type: 'decision', event: game.decision.event, mode: 'ignore' });
  assert.equal(game.decision?.kind, 'stoneBurner'); assert.equal(game.decision.player, f.opponent);
  game = act(game, f.opponent, { type: 'decision', event: game.decision.event, mode: 'ignore' });
  game = complete(game);
  assert.equal(game.lastBattleContext!.winner, f.owner, 'Five physical counters beat four despite the opposing dial of nine');
  assert.equal(player(game, f.owner).forces[f.location], 5);
  assert.equal(player(game, f.ecaz).forces[f.location] ?? 0, 0);
  assert.equal(player(game, f.ally).forces[f.location] ?? 0, 0);
  assert.ok(player(game, f.owner).hand.some(card => card.id === f.mirror));
  assert.deepEqual(inventory(game), f.originalInventory); conserve(game);
});

void test('all four minimal profiles offer legal canonical Mirror commitments for both native coalition leads and Moritani', () => {
  for (const owner of ['ecaz', 'ally', 'moritani'] as const) {
    const f = fixture({ owner, weapon: 'projectile' });
    for (const difficulty of DIFFICULTIES) {
      const view = viewGame(f.game, f.owner); view.players.find(p => p.id === f.owner)!.bot = difficulty;
      const before = structuredClone(view);
      const options = botActions(view).filter(action => action.type === 'battlePlan' && action.weapon === f.mirror);
      assert.ok(options.length, `${owner}/${difficulty}`);
      assert.doesNotThrow(() => act(f.game, f.owner, options[0]));
      assert.deepEqual(view, before);
    }
  }
});
