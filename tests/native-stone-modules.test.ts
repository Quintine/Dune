import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import {
  advanceNativeStoneModules, createNativeStoneModulesFixture, nativeStoneModulesClean,
  nativeStoneModulesPlayer, NATIVE_MODULE_MIRROR, NATIVE_MODULE_REINFORCEMENTS,
  NATIVE_MODULE_STONE, NATIVE_MODULE_TOOTH,
} from './fixture-native-stone-modules';

type Fixture = ReturnType<typeof createNativeStoneModulesFixture>;
function reveal(fixture: Fixture): Game {
  let game = fixture.game;
  for (const step of fixture.plans) game = applyAction(game, step.actor, step.action);
  return game;
}
function finish(game: Game): Game {
  for (const actor of viewGame(game, game.host).battle!.traitorVoters)
    game = applyAction(game, actor, { type: 'traitorCall', call: false });
  return advanceNativeStoneModules(game, state => !state.battle && nativeStoneModulesClean(state));
}
function assertPhysicalOutcome(fixture: Fixture, game: Game) {
  assert.equal(game.lastBattleContext?.winner, fixture.owner);
  const owner = nativeStoneModulesPlayer(game, fixture.owner);
  assert.equal(owner.reserves, 12, 'Five native counters materialize before the original three-reserve fee');
  assert.equal(owner.tanks, fixture.advanced ? 5 : 4, 'Only the real dialed counters and original fee reach Tanks');
  assert.equal(owner.forces[fixture.location], fixture.advanced ? 3 : 4);
  const opponent = nativeStoneModulesPlayer(game, fixture.opponent);
  assert.equal(opponent.tanks, 3);
  assert.equal(opponent.elites!.tanks, 1, 'The real opposing cyborg retains its typed loss');
  assert.equal(opponent.forces['hidden_mobile_stronghold:0'], 6);
  assert.equal(opponent.elites!.forces['hidden_mobile_stronghold:0'], 3);
  for (const step of fixture.plans) {
    const leader = nativeStoneModulesPlayer(game, step.actor).leaders.find(l => l.id === step.action.leader)!;
    assert.equal(leader.dead, true, 'The original kill choice kills each actual selected disc once');
  }
  assert.equal(game.discard.filter(card => card.id === NATIVE_MODULE_REINFORCEMENTS).length, 1);
  const lostTokens = Object.entries(fixture.game.techTokens!).filter(([, token]) => token.owner === fixture.opponent);
  assert.equal(lostTokens.length, 1);
  assert.equal(game.techTokens![lostTokens[0][0] as keyof NonNullable<Game['techTokens']>].owner, fixture.owner);
  const faces = (state: Game) => [...state.deck, ...state.discard, ...(state.richeseCache ?? []),
    ...(state.richeseRemoved ?? []), ...state.players.flatMap(p => p.hand)].map(card => card.id).sort();
  assert.deepEqual(faces(game), faces(fixture.afterSetup));
}

void test('original native Stone chooses before Tooth with genuine Tech and earned Advanced custody, keeping physical costs and typed losses', () => {
  for (const advanced of [false, true]) {
    const fixture = createNativeStoneModulesFixture({ advanced });
    let game = reveal(fixture);
    assert.equal(game.decision?.kind, 'stoneBurner');
    assert.equal(game.decision?.player, fixture.owner);
    game = applyAction(game, fixture.owner, { type: 'decision', event: game.decision!.event, mode: 'kill' });
    assert.equal(game.decision?.kind, 'poisonTooth');
    assert.equal(game.decision?.physicalId, NATIVE_MODULE_TOOTH);
    game = applyAction(game, fixture.opponent, { type: 'decision', event: game.decision!.event, activate: false });
    game = finish(game);
    assertPhysicalOutcome(fixture, game);
    assert.ok(nativeStoneModulesPlayer(game, fixture.owner).hand.some(c => c.id === NATIVE_MODULE_STONE));
  }
});

void test('physical native Mirror chooses copied Stone first, retains independent original mode and winning physical custody', () => {
  for (const advanced of [false, true]) {
    const fixture = createNativeStoneModulesFixture({ advanced, kind: 'mirror' });
    let game = reveal(fixture);
    assert.equal(game.decision?.kind, 'stoneBurner');
    assert.equal(game.decision?.player, fixture.owner);
    assert.equal(game.decision?.physicalId, NATIVE_MODULE_MIRROR);
    const copiedChoice = { type: 'decision' as const, event: game.decision!.event, mode: 'ignore' as const };
    game = applyAction(game, fixture.owner, copiedChoice);
    assert.equal(game.decision?.kind, 'stoneBurner');
    assert.equal(game.decision?.player, fixture.opponent);
    assert.equal(game.decision?.physicalId, NATIVE_MODULE_STONE);
    const before = structuredClone(game);
    assert.throws(() => applyAction(game, fixture.owner, copiedChoice));
    assert.deepEqual(game, before, 'Replaying the copy cannot consume the original owner’s choice');
    game = applyAction(game, fixture.opponent, { type: 'decision', event: game.decision!.event, mode: 'kill' });
    game = finish(game);
    assertPhysicalOutcome(fixture, game);
    assert.ok(nativeStoneModulesPlayer(game, fixture.owner).hand.some(c => c.id === NATIVE_MODULE_MIRROR));
    assert.equal(game.discard.filter(c => c.id === NATIVE_MODULE_MIRROR).length, 0);
    assert.equal(game.discard.filter(c => c.id === NATIVE_MODULE_STONE).length, 1);
  }
});

void test('genuinely earned Habbanya decides the native physical tie, while the same Tech-only battle loses despite Reinforcements', () => {
  for (const strongholds of [false, true]) {
    const fixture = createNativeStoneModulesFixture({ strongholds });
    assert.equal(fixture.game.battle!.attacker, fixture.opponent);
    let game = reveal(fixture);
    assert.equal(game.decision?.kind, 'stoneBurner');
    game = applyAction(game, fixture.owner, { type: 'decision', event: game.decision!.event, mode: 'ignore' });
    assert.equal(game.decision?.kind, 'poisonTooth');
    game = applyAction(game, fixture.opponent, { type: 'decision', event: game.decision!.event, activate: false });
    game = finish(game);
    assert.equal(game.lastBattleContext?.winner, strongholds ? fixture.owner : fixture.opponent,
      'Three undialed native counters tie three; the score-only +2 cannot decide this comparison');
    const owner = nativeStoneModulesPlayer(game, fixture.owner);
    assert.equal(owner.reserves, 12, 'The original reserve fee applies to either physical result');
    assert.equal(owner.tanks, strongholds ? 5 : 8);
    if (strongholds) assert.equal(fixture.afterMentat.strongholdCards!.owners.habbanya_ridge_sietch, fixture.owner);
  }
});
