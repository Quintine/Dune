import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, RuleError, type Action, type Game } from '../game/engine';
import {
  createRicheseReinforcementsFixture, finishRicheseReinforcementsBattle,
  prepareRicheseReinforcementsPlan, RICHESE_HARASS, RICHESE_MIRROR_WEAPON,
  RICHESE_REINFORCEMENTS, RICHESE_STONE_BURNER, richeseReinforcementsPlayer,
  sealRicheseReinforcementsBoth, sealRicheseReinforcementsPlan,
  type RicheseReinforcementsFixture,
} from './fixture-richese-reinforcements';

/** Every conserved physical card, counter pool and hand limit of the programme. */
function assertConserved(fixture: RicheseReinforcementsFixture, game: Game): void {
  const cards = (state: Game) => [...state.deck, ...state.discard, ...(state.richeseCache ?? []),
    ...(state.richeseRemoved ?? []), ...state.players.flatMap(player => player.hand)]
    .map(card => card.id).sort();
  assert.deepEqual(cards(game), cards(fixture.initial),
    'Every original deck, cache, discard and hand face keeps physical custody.');
  const pools = (state: Game) => state.players.map(player => [player.id,
    player.reserves + player.tanks + Object.values(player.forces).reduce((sum, n) => sum + n, 0),
    player.elites
      ? player.elites.reserves + player.elites.tanks +
        Object.values(player.elites.forces).reduce((sum, n) => sum + n, 0)
      : 0,
  ]);
  assert.deepEqual(pools(game), pools(fixture.afterSetup),
    'Every physical counter stays in its own native pool.');
  for (const player of game.players)
    assert.ok(player.hand.length <= (player.faction === 'harkonnen' ? 8 : 4),
      `${player.faction} stays inside its printed hand limit.`);
}


function assertNoUtilityCustody(game: Game, card: string): void {
  assert.equal(game.discard.filter(face => face.id === card).length, 1);
  assert.equal(game.deck.filter(face => face.id === card).length, 0);
  assert.ok(game.players.every(player => !player.hand.some(face => face.id === card)));
}

/** Read one selected plan leader without trusting the loose action shape. */
function actionLeader(action: Action): string {
  const leader = action.leader;
  assert.ok(typeof leader === 'string', 'The prepared plan selects one physical leader');
  return leader;
}


for (const slot of ['weapon', 'defense'] as const)
  void test(`Funded marker 3 leaves exactly three reserves after the real reveal and charges them to the Tanks in the ${slot} slot`, () => {
    const fixture = createRicheseReinforcementsFixture({ marker: 3, reserves: 6 });
    const preview = viewGame(fixture.game, fixture.richese).battle!.reinforcements!;
    assert.equal(preview.blocked, null);
    assert.equal(preview.noField!.materializes, 3);
    assert.equal(preview.noField!.reservesAfterReveal, 3);
    const plan = slot === 'weapon' ? fixture.plans.reinforcements : {
      ...fixture.plans.reinforcements,
      action: { ...fixture.plans.reinforcements.action, weapon: null, defense: RICHESE_REINFORCEMENTS },
    };
    const first = prepareRicheseReinforcementsPlan(fixture.game, plan);
    assert.equal(first.battle!.revealed, false);
    assert.equal(richeseReinforcementsPlayer(first, fixture.richese).reserves, 6,
      'The reserve fee is not charged before the native reveal.');
    const revealed = sealRicheseReinforcementsPlan(first, fixture.plans.opponent);
    assert.equal(revealed.battle!.revealed, true);
    const owner = richeseReinforcementsPlayer(revealed, fixture.richese);
    assert.equal(owner.reserves, 3, 'The reveal materializes three capped reserves.');
    assert.equal(owner.forces[fixture.location], 3);
    assert.equal(owner.tanks, 0);
    assert.equal(owner.noField!.deployed, null);
    assert.equal(owner.noField!.lastShipped, fixture.token.id,
      'Revelation preserves the real most-recent-shipment identity.');
    const done = finishRicheseReinforcementsBattle(revealed);
    const after = richeseReinforcementsPlayer(done, fixture.richese);
    assert.equal(done.lastBattleContext!.result, 'normal');
    assert.equal(done.lastBattleContext!.winner, fixture.opponent);
    assert.equal(after.reserves, 0);
    assert.equal(after.tanks, 6, 'Three physical losses plus the three-reserve fee reached the Tanks.');
    assert.equal(after.battleLosses, 6);
    assert.equal(after.forces[fixture.location] ?? 0, 0);
    assertNoUtilityCustody(done, RICHESE_REINFORCEMENTS);
    assertConserved(fixture, done);
  });

for (const [marker, reserves, materializes, finalReserves, finalTanks] of
  [[0, 6, 0, 3, 3], [5, 8, 5, 0, 8], [3, 8, 3, 2, 6]] as const)
  void test(`Funded No-Field ${marker} with ${reserves} reserves reveals ${materializes} counters and pays the fee`, () => {
    const fixture = createRicheseReinforcementsFixture({ marker, reserves });
    const preview = viewGame(fixture.game, fixture.richese).battle!.reinforcements!;
    assert.equal(preview.blocked, null);
    assert.equal(preview.noField!.materializes, materializes);
    assert.equal(preview.noField!.reservesAfterReveal, reserves - materializes);
    assert.equal(preview.normal, Math.min(3, reserves - materializes));
    const revealed = sealRicheseReinforcementsBoth(fixture, 'reinforcements');
    const owner = richeseReinforcementsPlayer(revealed, fixture.richese);
    assert.equal(owner.forces[fixture.location] ?? 0, materializes);
    assert.equal(owner.noField!.deployed, null);
    const done = finishRicheseReinforcementsBattle(revealed);
    assert.equal(richeseReinforcementsPlayer(done, fixture.richese).reserves, finalReserves);
    assert.equal(richeseReinforcementsPlayer(done, fixture.richese).tanks, finalTanks);
    assertNoUtilityCustody(done, RICHESE_REINFORCEMENTS);
    assertConserved(fixture, done);
  });

void test('A reserve-capped marker five at three reserves materializes only three and refuses the plan', () => {
  const fixture = createRicheseReinforcementsFixture({ marker: 5, reserves: 3 });
  const before = structuredClone(fixture.game);
  const preview = viewGame(before, fixture.richese).battle!.reinforcements!;
  assert.equal(preview.noField!.materializes, 3, 'The reveal is capped by the physical reserves.');
  assert.equal(preview.noField!.reservesAfterReveal, 0);
  assert.equal(preview.normal + preview.elite, 0);
  assert.ok(preview.blocked);
  assert.throws(() => applyAction(before, fixture.richese, fixture.plans.reinforcements.action), RuleError);
  assert.deepEqual(before, fixture.game, 'A refused forecast reserves nothing.');
  assertConserved(fixture, fixture.game);
});

void test('A prospective reveal leaving fewer than three reserves refuses the first seal but the real Harass fallback still plays', () => {
  const fixture = createRicheseReinforcementsFixture({ marker: 3, reserves: 5 });
  const before = structuredClone(fixture.game);
  const saved = structuredClone(before);
  const preview = viewGame(before, fixture.richese).battle!.reinforcements!;
  assert.ok(preview.blocked);
  assert.equal(preview.normal + preview.elite, 2);
  assert.equal(preview.noField!.materializes, 3);
  assert.equal(preview.noField!.reservesAfterReveal, 2);
  assert.equal(viewGame(before, fixture.richese).battle!.harassWithdraw!.blocked, null);
  for (const plan of [fixture.plans.reinforcements, fixture.plans.both]) {
    assert.throws(() => applyAction(before, fixture.richese, plan.action), RuleError);
    assert.deepEqual(before, saved, 'A refused plan reserves no card, spice, marker or window.');
    assert.equal(before.battle!.plans[fixture.richese], undefined);
  }
  const harass = sealRicheseReinforcementsPlan(before, fixture.plans.harass);
  const revealed = sealRicheseReinforcementsPlan(harass, fixture.plans.opponent);
  assert.equal(richeseReinforcementsPlayer(revealed, fixture.richese).forces[fixture.location] ?? 0, 3,
    'The concealed marker still reveals under the legal fallback.');
  const done = finishRicheseReinforcementsBattle(revealed);
  assert.equal(richeseReinforcementsPlayer(done, fixture.richese).reserves, 3,
    'The undialed counter returns through the real Harass allocation.');
  assertNoUtilityCustody(done, RICHESE_HARASS);
  assert.equal(done.discard.filter(face => face.id === RICHESE_REINFORCEMENTS).length, 0);
  assertConserved(fixture, done);
});


void test('Same-plan Reinforcements and Harass charge the three-reserve fee before the native undialed return', () => {
  const fixture = createRicheseReinforcementsFixture({ marker: 3, reserves: 6 });
  const revealed = sealRicheseReinforcementsBoth(fixture, 'both');
  assert.equal(richeseReinforcementsPlayer(revealed, fixture.richese).reserves, 3);
  const done = finishRicheseReinforcementsBattle(revealed);
  const owner = richeseReinforcementsPlayer(done, fixture.richese);
  assert.equal(owner.reserves, 1, 'Three reserves paid, one undialed counter returned afterwards.');
  assert.equal(owner.tanks, 5, 'Only the dialed counters and the fee left the owner.');
  assertNoUtilityCustody(done, RICHESE_REINFORCEMENTS);
  assertNoUtilityCustody(done, RICHESE_HARASS);
  assertConserved(fixture, done);
});


void test('Reinforcements adds two to the dialed battle strength without adding a physical undialed counter', () => {
  const funded = createRicheseReinforcementsFixture({ marker: 3, reserves: 6, dial: 3, opponentDial: 4 });
  const withMachine = finishRicheseReinforcementsBattle(sealRicheseReinforcementsBoth(funded, 'reinforcements'));
  assert.equal(withMachine.lastBattleContext!.winner, funded.richese,
    'The committed two strength wins the identical physical contest.');
  assert.equal(richeseReinforcementsPlayer(withMachine, funded.richese).tanks, 6);
  assert.equal(richeseReinforcementsPlayer(withMachine, funded.richese).forces[funded.location] ?? 0, 0,
    'No bonus counter ever appears on the board.');
  const without = createRicheseReinforcementsFixture({ marker: 3, reserves: 6, dial: 3, opponentDial: 4 });
  const plain = finishRicheseReinforcementsBattle(sealRicheseReinforcementsBoth(without, 'plain'));
  assert.equal(plain.lastBattleContext!.winner, without.opponent,
    'The identical physical commitment loses without the machine.');
  assert.equal(richeseReinforcementsPlayer(plain, without.richese).tanks, 3);
  assert.equal(richeseReinforcementsPlayer(plain, without.richese).reserves, 3);
});

for (const marker of [0, 3, 5] as const)
  void test(`Advanced native marker ${marker} pays its fee without changing the original physical support`, () => {
    const fixture = createRicheseReinforcementsFixture({ advanced: true, marker });
    const before = richeseReinforcementsPlayer(fixture.game, fixture.richese);
    assert.equal(viewGame(fixture.game, fixture.richese).battle!.reinforcements!.blocked, null);
    const done = finishRicheseReinforcementsBattle(sealRicheseReinforcementsBoth(fixture, 'reinforcements'));
    const after = richeseReinforcementsPlayer(done, fixture.richese);
    assert.equal(after.reserves, 17 - marker, 'The materialized physical counters leave before the three-reserve fee');
    assert.equal(after.tanks, marker + 3);
    assert.equal(after.spice, before.spice - Number(fixture.plans.reinforcements.action.support));
    assertNoUtilityCustody(done, RICHESE_REINFORCEMENTS);
    assertConserved(fixture, done);
  });

for (const [label, options] of [['Basic', { family: 'ix+choam' as const, marker: 3 as const, reserves: 6 }],
  ['Advanced', { family: 'ix+choam' as const, advanced: true, marker: 3 as const }]] as const)
  void test(`The union Ix and CHOAM selection is admitted and resolves a clean Richese ${label} programme`, () => {
    const fixture = createRicheseReinforcementsFixture(options);
    assert.equal(viewGame(fixture.game, fixture.richese).battle!.reinforcements!.blocked, null);
    const revealed = sealRicheseReinforcementsBoth(fixture, 'both');
    const done = finishRicheseReinforcementsBattle(revealed);
    assert.equal(done.battle, null);
    const owner = richeseReinforcementsPlayer(done, fixture.richese);
    assert.equal(owner.reserves, fixture.advanced ? 16 : 1);
    assert.equal(owner.tanks, fixture.advanced ? 4 : 5);
    assertNoUtilityCustody(done, RICHESE_REINFORCEMENTS);
    assertNoUtilityCustody(done, RICHESE_HARASS);
    assertConserved(fixture, done);
  });

void test('The original physical cache Stone compares undialed counters, ignores two score strength and still charges the fee', () => {
  const fixture = createRicheseReinforcementsFixture({ marker: 5, reserves: 8, dial: 2, opponentDial: 10,
    machines: ['reinforcements', 'stone'] });
  const plan = { actor: fixture.richese, action: { ...fixture.plans.reinforcements.action,
    weapon: RICHESE_STONE_BURNER, defense: RICHESE_REINFORCEMENTS } };
  const first = prepareRicheseReinforcementsPlan(fixture.game, plan);
  const revealed = applyAction(first, fixture.plans.opponent.actor, fixture.plans.opponent.action);
  assert.equal(revealed.decision?.kind, 'stoneBurner');
  const afterChoice = applyAction(revealed, revealed.decision!.player, {
    type: 'decision', event: revealed.decision!.event, mode: 'ignore',
  });
  const done = finishRicheseReinforcementsBattle(afterChoice);
  const owner = richeseReinforcementsPlayer(done, fixture.richese);
  assert.equal(done.lastBattleContext!.winner, fixture.richese,
    'The undialed physical token count decides, not the ordinary strength total.');
  assert.equal(owner.tanks, 5, 'The three-reserve fee still applies under the Stone comparison.');
  assert.equal(owner.reserves, 0);
  assert.equal(owner.forces[fixture.location], 3, 'Only the surviving real counters remain.');
  assert.equal(done.discard.filter(face => face.id === RICHESE_STONE_BURNER).length, 0,
    'The winning Stone Burner stays with its owner.');
  assertNoUtilityCustody(done, RICHESE_REINFORCEMENTS);
  assertConserved(fixture, done);
});

void test('The native Stone kill mode still charges the fee and kills both participating leaders', () => {
  const fixture = createRicheseReinforcementsFixture({ marker: 5, reserves: 8, dial: 2, opponentDial: 10,
    machines: ['reinforcements', 'stone'] });
  const plan = { actor: fixture.richese, action: { ...fixture.plans.reinforcements.action,
    weapon: RICHESE_STONE_BURNER, defense: RICHESE_REINFORCEMENTS } };
  const first = prepareRicheseReinforcementsPlan(fixture.game, plan);
  const revealed = applyAction(first, fixture.plans.opponent.actor, fixture.plans.opponent.action);
  assert.equal(revealed.decision?.kind, 'stoneBurner');
  const afterChoice = applyAction(revealed, revealed.decision!.player, {
    type: 'decision', event: revealed.decision!.event, mode: 'kill',
  });
  const done = finishRicheseReinforcementsBattle(afterChoice);
  const owner = richeseReinforcementsPlayer(done, fixture.richese);
  const enemy = richeseReinforcementsPlayer(done, fixture.opponent);
  assert.equal(done.lastBattleContext!.winner, fixture.richese);
  assert.equal(owner.leaders.find(leader => leader.id === actionLeader(fixture.plans.reinforcements.action))!.dead, true);
  assert.equal(enemy.leaders.find(leader => leader.id === actionLeader(fixture.plans.opponent.action))!.dead, true);
  assert.equal(owner.tanks, 5, 'The reserve fee is independent of the chosen Stone mode.');
  assert.equal(owner.reserves, 0);
  assertNoUtilityCustody(done, RICHESE_REINFORCEMENTS);
  assertConserved(fixture, done);
});

void test('A clean Mirror Weapon copies the real opposing Stone Burner into a native reveal choice while Reinforcements still pays', () => {
  const fixture = createRicheseReinforcementsFixture({ marker: 5, reserves: 8, dial: 2, opponentDial: 10,
    machines: ['reinforcements'], opponentStone: true });
  const plan = { actor: fixture.richese, action: { ...fixture.plans.reinforcements.action,
    weapon: RICHESE_MIRROR_WEAPON, defense: RICHESE_REINFORCEMENTS } };
  const opponent = { actor: fixture.opponent,
    action: { ...fixture.plans.opponent.action, weapon: RICHESE_STONE_BURNER } };
  const first = prepareRicheseReinforcementsPlan(fixture.game, plan);
  const revealed = applyAction(first, opponent.actor, opponent.action);
  assert.equal(revealed.decision?.kind, 'stoneBurner');
  assert.equal(revealed.decision!.player, fixture.richese,
    'A copied Stone chooses before the original physical Stone.');
  const afterChoice = applyAction(revealed, revealed.decision!.player, {
    type: 'decision', event: revealed.decision!.event, mode: 'ignore',
  });
  const done = finishRicheseReinforcementsBattle(afterChoice);
  assert.equal(done.lastBattleContext!.winner, fixture.richese);
  assert.equal(richeseReinforcementsPlayer(done, fixture.richese).tanks, 5);
  assert.equal(richeseReinforcementsPlayer(done, fixture.richese).reserves, 0);
  assertNoUtilityCustody(done, RICHESE_REINFORCEMENTS);
  assertConserved(fixture, done);
});


