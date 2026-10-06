import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction, initializeDiscoveryGameForAudit, viewGame, type Action, type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { ownedTech } from '../game/tech-tokens';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { forceRevivalQuote } from '../game/revival';
import {
  enterHomeworldClassicDiscovery, homeworldClassicDiscoveryInventory,
  revealHomeworldClassicDiscovery,
} from './fixture-homeworld-classic-discovery';
import {
  advanceHomeworldOptional as advance, claimHomeworldOptional,
  createHomeworldOptionalFixture as fixture, createHomeworldOptionalLobby,
  finishHomeworldOptionalBattle, initializeHomeworldOptional,
  invadeHomeworldOptional, nextHomeworldOptionalStep,
  openHomeworldOptionalBattle, optionalHomeworldClean as clean,
  optionalHomeworldLeader as leader, optionalHomeworldMovementWindow as movement,
  optionalHomeworldPlayer as player, settleHomeworldOptionalArrival, shipHomeworldOptional,
} from './fixture-homeworld-optional-modules';

/** Authorized root rulebook physical pp.21–23: optional modules together or
 * separately, original first-Storm token assignment/phase-end collections,
 * winner transfer, end-Mentat Stronghold custody, off-planet native reserves and
 * combined Imperial shipment. Territory-local effects use the physical original
 * Arrakeen/Carthag faces (docs/STRONGHOLD_CARDS.md). All armies, casualties,
 * funding, held cards and rewards below originate in original engine actions. */
function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game); assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
function legalPolicies(game: Game, actor: string): void {
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(game, actor); view.players.find(seat => seat.id === actor)!.bot = difficulty;
    const actions = botActions(view); assert.ok(actions.length, `${difficulty} has an actual owned continuation.`);
    for (const action of actions) homeworldClassicDiscoveryInventory(applyAction(structuredClone(game), actor, action));
  }
}
function beforeMovementEnd(state: Game): Game {
  let game = state;
  for (let i = 0; i < 200; i++) {
    assert.equal(game.phase, 5);
    const step = nextHomeworldOptionalStep(game);
    const after = applyAction(structuredClone(game), step.actor, step.action);
    if (after.phase !== 5) return game;
    game = after;
  }
  throw Error('Original Shipping never reached its phase-end action.');
}
function endMovementPhase(game: Game): Game {
  const last = nextHomeworldOptionalStep(game), after = applyAction(game, last.actor, last.action);
  assert.notEqual(after.phase, 5); return after;
}
function resolveToCleanup(state: Game): Game {
  return advance(state, game => game.decision?.kind === 'battleCards');
}

void test('original no-Skills Homeworld Discovery admits Basic/Advanced 2–6 and original optional components only at their real seat/mode boundaries', () => {
  for (const advanced of [false, true]) for (const seats of [2, 3, 4, 5, 6] as const) {
    const options = { advanced, seats, tech: seats >= 3, strongholds: advanced };
    const f = fixture(options);
    assert.equal(f.game.players.length, seats);
    assert.equal(f.game.phase, 7); assert.equal(f.game.turn, 1);
    assert.equal(f.game.leaderSkills, undefined);
    homeworldClassicDiscoveryInventory(f.setup); homeworldClassicDiscoveryInventory(f.game);
    if (seats >= 3) {
      assert.equal(f.beforeFirstStorm.techTokens!.production.owner, f.fremen);
      assert.equal(f.beforeFirstStorm.techTokens!.axlotl.owner, null);
      assert.equal(f.beforeFirstStorm.techTokens!.heighliners.owner, null);
      const assigned = Object.values(f.afterFirstStorm.techTokens!);
      assert.ok(assigned.every(token => token.owner));
      assert.equal(new Set(assigned.map(token => token.owner)).size, 3);
      assert.ok(assigned.every(token => token.spice === 0));
    }
    if (advanced) {
      const claim = claimHomeworldOptional(f.game);
      assert.equal(claim.before.strongholdCards!.claimedTurn, 0);
      assert.ok(Object.values(claim.before.strongholdCards!.owners).every(owner => owner === null));
      assert.equal(claim.after.strongholdCards!.claimedTurn, 1);
      if (seats >= 4) assert.equal(claim.after.strongholdCards!.owners.arrakeen, 'atreides');
      if (seats >= 5) assert.equal(claim.after.strongholdCards!.owners.carthag, 'harkonnen');
      assert.equal(claim.after.strongholdCards!.owners.hidden_mobile_stronghold, null);
      homeworldClassicDiscoveryInventory(claim.after);
    }
  }
  assert.throws(() => initializeHomeworldOptional({ seats: 2, tech: true }));
  assert.throws(() => initializeHomeworldOptional({ advanced: false, strongholds: true }));
  // Invalid ORIGINAL component admission is checked by the actual initializer,
  // not by mirroring the profile predicate in an expectation.
  const original = createHomeworldOptionalLobby({ tech: true, strongholds: true });
  for (const corrupt of [
    (game: Game) => { game.techTokens!.axlotl.owner = game.host; },
    (game: Game) => { game.techTokens!.heighliners.spice = 1; },
    (game: Game) => { game.strongholdCards!.owners.arrakeen = game.host; },
    (game: Game) => { game.strongholdCards!.claimedTurn = 1; },
  ]) {
    let changed = structuredClone(original); corrupt(changed);
    for (const seat of changed.players) changed = applyAction(changed, seat.id, { type: 'ready' });
    assert.throws(() => initializeDiscoveryGameForAudit(changed));
  }
});

void test('combined Imperial off-planet shipment and another actual invoice accrue one Heighliner payment, collected once at original Shipping end', () => {
  const f = fixture({ tech: true, strongholds: true });
  let game = advance(revealHomeworldClassicDiscovery(f), g => g.turn === 2 && g.phase === 5 && clean(g));
  const owner = game.techTokens!.heighliners.owner!;
  const remaining = new Set([f.collector, 'harkonnen']);
  while (remaining.size) {
    game = advance(game, g => g.turn === 2 && g.phase === 5 && clean(g) && remaining.has(g.active!));
    const actor = game.active!;
    if (actor === f.collector) {
      const sources = { 'homeworld:emperor': { normal: 1, elite: 0 }, 'homeworld:emperor:salusa': { normal: 1, elite: 0 } };
      const ownBefore = structuredClone(player(game, actor));
      const homesBefore = structuredClone(viewGame(game, actor).homeworlds!.worlds!);
      const target = homesBefore.find(home => home.native === f.fremen)!;
      const choice = homeworldShipmentChoice(viewGame(game, actor), target.id, sources); assert.ok(choice.action);
      legalPolicies(game, actor);
      game = settleHomeworldOptionalArrival(applyAction(game, actor, choice.action));
      assert.equal(player(game, actor).spice, ownBefore.spice - 2);
      assert.equal(player(game, actor).reserves, ownBefore.reserves - 2);
      const homesAfter = viewGame(game, actor).homeworlds!.worlds!;
      for (const id of Object.keys(sources)) {
        assert.equal(homesAfter.find(home => home.id === id)!.forces[actor].normal,
          homesBefore.find(home => home.id === id)!.forces[actor].normal - 1);
      }
      assert.deepEqual(homesAfter.find(home => home.id === target.id)!.forces[actor], { normal: 2, elite: 0 });
    } else {
      game = shipHomeworldOptional(game, actor, 'cistern', 0, 1);
    }
    assert.equal(game.techTokens!.heighliners.spice, 1, 'Two real paid invoices still accrue one industry event.');
    assert.equal(game.techTokens!.heighliners.triggeredTurn, 2);
    remaining.delete(actor);
    if (remaining.size) game = applyAction(game, actor, { type: 'endMovement' });
  }
  const last = beforeMovementEnd(game), balance = player(last, owner).spice;
  const paid = endMovementPhase(last);
  assert.equal(player(paid, owner).spice, balance + 1);
  assert.equal(paid.techTokens!.heighliners.spice, 0);
  assert.equal(paid.techTokens!.axlotl.spice, 0); assert.equal(paid.techTokens!.production.spice, 0);
  homeworldClassicDiscoveryInventory(paid);
});

void test('Guild-only actual Homeworld transport is excluded, while a combined Imperial nested shipment pays the printed single tariff and triggers Heighliners', () => {
  const f = fixture({ tech: true, strongholds: true });
  let guild = movement(f.game, 'guild');
  const guildBefore = player(guild, 'guild').spice;
  guild = invadeHomeworldOptional(guild, 'guild', 'homeworld:emperor', 1);
  assert.equal(player(guild, 'guild').spice, guildBefore - 1);
  assert.equal(guild.techTokens!.heighliners.spice, 0);
  assert.equal(guild.techTokens!.heighliners.triggeredTurn, 1);
  const end = beforeMovementEnd(guild), owner = end.techTokens!.heighliners.owner!, balance = player(end, owner).spice;
  const excluded = endMovementPhase(end);
  assert.equal(player(excluded, owner).spice, balance);
  assert.equal(excluded.techTokens!.heighliners.spice, 0);

  let nested = movement(enterHomeworldClassicDiscovery(f), f.collector);
  const before = structuredClone(player(nested, f.collector));
  nested = shipHomeworldOptional(nested, f.collector, 'cistern', 0, 2, 0,
    { 'homeworld:emperor': { normal: 1, elite: 0 }, 'homeworld:emperor:salusa': { normal: 1, elite: 0 } });
  assert.equal(player(nested, f.collector).spice, before.spice - 2);
  assert.equal(player(nested, f.collector).forces['cistern:0'], before.forces['cistern:0'] + 2);
  assert.equal(nested.techTokens!.heighliners.spice, 1);
  homeworldClassicDiscoveryInventory(nested);
});

void test('real low-Caladan poverty claim and three free force returns trigger distinct phase-end industries without charging or recursively paying', () => {
  for (const advanced of [false, true]) {
    const setup = initializeHomeworldOptional({ advanced, tech: true, strongholds: advanced });
    let game = advance(setup, game => game.status === 'playing');
    // Select only original unplayed ordinary blows, avoiding incidental income
    // at the future expedition site. No phase, wallet or force is assigned.
    for (let position = 0; position < 4; position++) {
      const index = game.spiceDeck.findIndex((card, i) => i >= position && 'territory' in card &&
        !card.discovery && card.territory !== 'imperial_basin');
      assert.ok(index >= position); game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
    }
    game = movement(game, 'emperor', 1);
    game = shipHomeworldOptional(game, 'emperor', 'habbanya_ridge_sietch', 17, 1);
    game = movement(game, 'atreides', 1);
    game = shipHomeworldOptional(game, 'atreides', 'habbanya_ridge_sietch', 17, 9);
    game = applyAction(game, 'atreides', { type: 'move', from: 'arrakeen:10', territory: 'imperial_basin', sector: 10, amount: 10 });
    assert.equal(player(game, 'atreides').spice, 1);
    assert.equal(player(game, 'atreides').reserves, 1);
    game = openHomeworldOptionalBattle(game, 'habbanya_ridge_sietch', 'atreides', 'emperor');
    game = applyAction(game, 'atreides', { type: 'battlePlan', leader: leader(game, 'atreides', false), dial: 0, support: 0 });
    game = applyAction(game, 'emperor', { type: 'battlePlan', leader: leader(game, 'emperor', true), dial: 0, support: 0 });
    game = finishHomeworldOptionalBattle(game);
    assert.equal(player(game, 'atreides').tanks, 9);
    game = advance(game, game => game.turn === 2 && game.phase === 2 && clean(game));
    assert.equal(player(game, 'atreides').spice, 1);
    assert.equal(viewGame(game, 'atreides').charity.amount, 2);
    const productionOwner = game.techTokens!.production.owner!, prodBefore = player(game, productionOwner).spice;
    game = applyAction(game, 'atreides', { type: 'charity' });
    assert.equal(player(game, 'atreides').spice, 3);
    assert.equal(player(game, productionOwner).spice, prodBefore);
    assert.equal(game.techTokens!.production.spice, ownedTech(game.techTokens, productionOwner).length);
    reject(game, 'atreides', { type: 'charity' });
    const beforeCharityEnd = advance(game, game => game.phase === 2 && clean(game) &&
      game.ready.length === game.players.length - 1);
    const productionIncome = beforeCharityEnd.techTokens!.production.spice;
    const productionBalance = player(beforeCharityEnd, productionOwner).spice;
    const afterCharity = advance(beforeCharityEnd, game => game.phase === 3 && clean(game));
    assert.equal(player(afterCharity, productionOwner).spice, productionBalance + productionIncome);
    assert.equal(afterCharity.techTokens!.production.spice, 0);
    game = advance(afterCharity, game => game.phase === 4 && clean(game));
    const returning = structuredClone(player(game, 'atreides'));
    assert.equal(forceRevivalQuote(game, returning, 3).cost, 0, 'Low home adds the third free counter to Atreides printed two.');
    legalPolicies(game, 'atreides');
    game = applyAction(game, 'atreides', { type: 'revive', amount: 3, elite: 0 });
    game = advance(game, game => !game.pendingRevival && clean(game));
    assert.equal(player(game, 'atreides').spice, returning.spice);
    assert.equal(player(game, 'atreides').tanks, returning.tanks - 3);
    assert.equal(player(game, 'atreides').reserves, returning.reserves + 3);
    const axlotlOwner = game.techTokens!.axlotl.owner!, accrued = game.techTokens!.axlotl.spice;
    assert.equal(accrued, ownedTech(game.techTokens, axlotlOwner).length);
    assert.equal(game.techTokens!.production.spice, 0);
    const beforeRevivalEnd = advance(game, game => game.phase === 4 && clean(game) && game.ready.length === game.players.length - 1);
    const axlotlBalance = player(beforeRevivalEnd, axlotlOwner).spice;
    const afterRevival = advance(beforeRevivalEnd, game => game.phase === 5 && clean(game));
    assert.equal(player(afterRevival, axlotlOwner).spice, axlotlBalance + accrued);
    assert.equal(afterRevival.techTokens!.axlotl.spice, 0);
    assert.equal(afterRevival.techTokens!.heighliners.spice, 0);
    homeworldClassicDiscoveryInventory(afterRevival);
  }
});

void test('actually held Arrakeen subsidy and Carthag Shield apply at their printed Arrakis sites, never at native Homeworld or Cistern battles', () => {
  for (const kind of ['support', 'defense'] as const) for (const location of ['printed', 'homeworld', 'nested'] as const) {
    const f = fixture({ tech: true, strongholds: true });
    const owner = kind === 'support' ? 'atreides' : 'harkonnen';
    const printed = kind === 'support' ? 'arrakeen' : 'carthag';
    const territory = location === 'printed' ? printed : location === 'homeworld' ? `homeworld:${owner}` : 'cistern';
    let game = location === 'nested' ? enterHomeworldClassicDiscovery(f) : f.game;
    assert.equal(game.strongholdCards?.owners[printed], location === 'nested' ? owner : null);
    if (location === 'nested') {
      game = movement(game, owner);
      game = shipHomeworldOptional(game, owner, territory, 0, kind === 'support' ? 3 : 2);
    } else {
      game = movement(game, f.collector);
      assert.equal(game.strongholdCards!.owners[printed], owner);
      game = location === 'homeworld' ? invadeHomeworldOptional(game, f.collector, territory, 1)
        : shipHomeworldOptional(game, f.collector, territory, printed === 'arrakeen' ? 10 : 11, 1);
    }
    game = openHomeworldOptionalBattle(game, territory, owner, f.collector);
    const view = viewGame(game, owner), ownBefore = structuredClone(player(game, owner));
    assert.equal(view.battle!.strongholdEffects[owner], location === 'printed' ? printed : null);
    const trainer = leader(game, owner, true), invader = leader(game, f.collector, kind === 'defense');
    const defense = player(game, owner).hand.find(card => card.kind === 'shield')!; assert.ok(defense);
    const weapon = player(game, f.collector).hand.find(card => card.kind === 'poison')!; assert.ok(weapon);
    legalPolicies(game, owner);
    game = applyAction(game, owner, { type: 'battlePlan', leader: trainer, defense: defense.id,
      dial: kind === 'support' ? 2 : 0, support: kind === 'support' ? 2 : 0 });
    game = applyAction(game, f.collector, { type: 'battlePlan', leader: invader, dial: 0, support: 0,
      ...(kind === 'defense' ? { weapon: weapon.id } : {}) });
    game = resolveToCleanup(game);
    assert.equal(game.lastBattleContext!.territory, territory);
    if (kind === 'support') {
      assert.equal(player(game, owner).spice, ownBefore.spice - (location === 'printed' ? 0 : 2));
      assert.equal(game.lastBattleContext!.winner, owner);
    } else {
      assert.equal(player(game, owner).leaders.find(disc => disc.id === trainer)!.dead, location !== 'printed');
      assert.equal(game.lastBattleContext!.winner, location === 'printed' ? owner : f.collector);
      assert.equal(game.discard.some(card => card.id === defense.id), location !== 'printed');
    }
    assert.equal(game.strongholdCards!.owners[printed], owner, 'Combat never silently transfers physical Stronghold card custody.');
    homeworldClassicDiscoveryInventory(game);
  }
});

void test('real native Homeworld victory earns a second token, then real visitor victory offers original winner choice only after physical cleanup', () => {
  for (const advanced of [false, true]) {
    const f = fixture({ advanced, tech: true, strongholds: advanced });
    let game = movement(f.game, f.collector);
    game = invadeHomeworldOptional(game, f.collector, 'homeworld:fremen', 1);
    game = openHomeworldOptionalBattle(game, 'homeworld:fremen', f.collector, f.fremen);
    assert.equal(ownedTech(game.techTokens, f.collector).length, 1);
    const nativeBefore = player(game, f.fremen).reserves;
    game = applyAction(game, f.collector, { type: 'battlePlan', leader: leader(game, f.collector, false), dial: 0, support: 0 });
    game = applyAction(game, f.fremen, { type: 'battlePlan', leader: leader(game, f.fremen, true), dial: 0, support: 0 });
    game = finishHomeworldOptionalBattle(game);
    assert.equal(game.lastBattleContext!.winner, f.fremen);
    assert.equal(player(game, f.fremen).reserves, nativeBefore);
    assert.equal(player(game, f.collector).tanks, 1);
    assert.equal(ownedTech(game.techTokens, f.fremen).length, 2);
    game = movement(game, f.collector, 3);
    game = invadeHomeworldOptional(game, f.collector, 'homeworld:fremen', 2);
    game = openHomeworldOptionalBattle(game, 'homeworld:fremen', f.collector, f.fremen);
    const tokens = ownedTech(game.techTokens, f.fremen), originalTech = structuredClone(game.techTokens);
    const visitorBefore = structuredClone(player(game, f.collector));
    const nativeBeforeSecond = structuredClone(player(game, f.fremen));
    const weapon = visitorBefore.hand.find(card => card.kind === 'poison')!; assert.ok(weapon);
    game = applyAction(game, f.collector, { type: 'battlePlan', leader: leader(game, f.collector, true), dial: 1,
      support: advanced ? 1 : 0, weapon: weapon.id });
    game = applyAction(game, f.fremen, { type: 'battlePlan', leader: leader(game, f.fremen, false), dial: 0, support: 0 });
    const cleanup = resolveToCleanup(game);
    assert.equal(cleanup.lastBattleContext!.winner, f.collector);
    assert.deepEqual(cleanup.techTokens, originalTech);
    assert.equal(cleanup.decision!.player, f.collector);
    assert.equal(player(cleanup, f.collector).tanks, visitorBefore.tanks + 1);
    assert.equal(player(cleanup, f.fremen).tanks, nativeBeforeSecond.tanks + nativeBeforeSecond.reserves);
    game = applyAction(cleanup, f.collector, { type: 'decision', discard: [] });
    game = advance(game, game => game.decision?.kind === 'techToken');
    assert.ok(game.decision?.kind === 'techToken');
    assert.equal(game.decision.player, f.collector);
    assert.deepEqual([...game.decision.choices].sort(), [...tokens].sort());
    assert.deepEqual(game.techTokens, originalTech);
    assert.equal(player(game, f.collector).hand.some(card => card.id === weapon.id), true);
    const physicalHome = viewGame(game, f.collector).homeworlds!.worlds!.find(home => home.native === f.fremen)!;
    assert.deepEqual(physicalHome.forces[f.collector], { normal: 1, elite: 0 });
    assert.deepEqual(physicalHome.forces[f.fremen], { normal: 0, elite: 0 });
    legalPolicies(game, f.collector);
    for (const token of tokens) {
      reject(game, f.fremen, { type: 'decision', token });
      const chosen = applyAction(structuredClone(game), f.collector, { type: 'decision', token });
      assert.equal(chosen.techTokens![token].owner, f.collector);
      assert.equal(ownedTech(chosen.techTokens, f.fremen).length, 1);
      assert.equal(chosen.lastBattleContext!.winner, f.collector);
      const chosenHome = viewGame(chosen, f.collector).homeworlds!.worlds!.find(home => home.id === physicalHome.id)!;
      assert.deepEqual(chosenHome.forces, physicalHome.forces, 'Tech selection changes token custody, never the actual winner army.');
      homeworldClassicDiscoveryInventory(chosen);
    }
  }
});
