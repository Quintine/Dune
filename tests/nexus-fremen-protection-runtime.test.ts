import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { splitLocation } from '../game/board';
import {
  advanceNexusFremenProtection, applyNexusFremenProtectionStep,
  createNexusFremenProtectionFixture, nexusFremenProtectionClean,
  nexusFremenProtectionInventory, nexusFremenProtectionPlayer,
  nexusFremenProtectionPresence,
  type NexusFremenProtectionFixture,
} from './fixture-nexus-fremen-protection';

/** Only invalid consumers are tried; physical inventory must be untouched. */
function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'Rejected declarations cannot spend the card, kill groups or advance the worm');
}
/** Public holdings only; used to prove nothing resolves before the queue closes. */
function holdings(game: Game): { id: string; forces: Record<string, number>; spice: number;
  reserves: number; tanks: number; ally: string | null }[] {
  return game.players.map(player => ({ id: player.id, ally: player.ally,
    forces: structuredClone(player.forces), spice: player.spice,
    reserves: player.reserves, tanks: player.tanks }));
}
/** Exactly one owner may be protected; every other group in the territory is devoured. */
function assertDevoured(pending: Game, resolved: Game, fixture: NexusFremenProtectionFixture,
  protectedOwner: string | null): void {
  for (const player of pending.players) {
    const before = nexusFremenProtectionPlayer(pending, player.id);
    const after = nexusFremenProtectionPlayer(resolved, player.id);
    if (player.id === protectedOwner) {
      assert.deepEqual(after.forces, before.forces, 'The protected owner keeps its exact physical groups');
      assert.equal(after.tanks, before.tanks);
      assert.equal(after.reserves, before.reserves);
      assert.equal(after.spice, before.spice, 'This printed protection invents no payment, revival or refund');
      continue;
    }
    const consumed = nexusFremenProtectionPresence(pending, player.id, fixture.territory);
    assert.equal(nexusFremenProtectionPresence(resolved, player.id, fixture.territory), 0,
      'Every unprotected group in the worm territory is devoured');
    assert.equal(after.tanks, before.tanks + consumed);
    assert.equal(after.reserves, before.reserves);
    assert.equal(after.spice, before.spice);
  }
}
function assertSpiceCleared(pending: Game, resolved: Game, fixture: NexusFremenProtectionFixture): void {
  assert.ok(Object.entries(pending.spice).some(([key, amount]) =>
    splitLocation(key).territory === fixture.territory && amount > 0),
  'Real spice from the accepted sand blow awaited the worm');
  assert.ok(Object.keys(resolved.spice).every(key =>
    splitLocation(key).territory !== fixture.territory),
  'The original worm still clears every spice group in its territory');
}

/** Answers the whole original queue before the devouring boundary, asserting the
 * private consumer contract at every acknowledgement. */
function closeProtection(fixture: NexusFremenProtectionFixture, use: boolean): Game {
  let game = structuredClone(fixture.game);
  const frame = game.nexusFremenProtection;
  assert.ok(frame);
  const originalOrder = [...frame.order], event = frame.event;
  const before = holdings(game);
  let used = false;
  for (const expected of originalOrder) {
    const decision = game.decision;
    assert.ok(decision?.kind === 'nexusFremenProtection');
    assert.equal(decision.event, event);
    assert.equal(decision.player, expected, 'Neutral acknowledgements keep the original storm order');
    const offer = viewGame(game, expected).nexusFremenProtection;
    assert.ok(offer, 'Only the current queue owner receives the private declaration surface');
    assert.equal(offer.owner, expected);
    assert.equal(offer.event, event);
    assert.equal(offer.territory, fixture.territory);
    assert.equal(offer.blocked, null);
    assert.equal(offer.canUse, expected === fixture.holder && !used,
      'Only the real unallied holder that has not spent its card may protect its own group');
    for (const other of game.players.filter(player => player.id !== expected))
      assert.equal(viewGame(game, other.id).nexusFremenProtection, null);
    if (expected !== fixture.holder)
      reject(game, expected, { type: 'nexusFremenProtection', event, use: true });
    const answer = expected === fixture.holder && use;
    game = applyNexusFremenProtectionStep(game, { actor: expected, action: {
      type: 'nexusFremenProtection', event, use: answer } });
    used ||= answer;
    assert.deepEqual(game.nexusFremenProtection!.order, originalOrder);
    assert.equal(game.nexusFremenProtection!.event, event);
    assert.equal(game.nexusFremenProtection!.protected, used ? fixture.holder : null);
    assert.equal(game.nexusCards!.cards!.hands[fixture.holder], used ? null : 'fremen');
    assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'fremen').length, used ? 1 : 0);
    if (game.nexusFremenProtection!.stage === 'choose')
      assert.deepEqual(holdings(game), before,
        'Even a declaration resolves nothing before the whole original queue closes');
    reject(game, expected, { type: 'nexusFremenProtection', event, use: answer });
  }
  assert.equal(game.nexusFremenProtection!.stage, 'complete');
  assert.notEqual(game.decision?.kind, 'nexusFremenProtection');
  assert.deepEqual([...game.nexusFremenProtection!.passed], originalOrder);
  assert.equal(viewGame(game, fixture.holder).nexusFremenProtection, null);
  return game;
}
/** The real later Nexus/closing continuation, from the held card's own position. */
function continueToLaterNexus(game: Game): Game {
  return advanceNexusFremenProtection(game, state => state.turn === 3 &&
    state.nexusCards?.phase?.stage === 'complete' && nexusFremenProtectionClean(state));
}

for (const advanced of [false, true]) {
  const label = advanced ? 'Advanced' : 'Basic';
  void test(`${label}: the real absent-Fremen Use protects only the shipped group before the devouring and spends one physical card`, () => {
    const fixture = createNexusFremenProtectionFixture({ advanced });
    const pending = fixture.game, frame = pending.nexusFremenProtection;
    assert.ok(frame);
    assert.equal(frame.stage, 'choose');
    assert.equal(frame.protected, null);
    assert.deepEqual(frame.order, pending.order.filter(id =>
      id === fixture.holder || (advanced && id === fixture.neutral)),
    'The public queue holds only storm-ordered unallied threatened seats that publicly hold a Nexus');
    assert.equal(nexusFremenProtectionPlayer(pending, fixture.holder).forces[fixture.location], 1);
    assert.equal(pending.nexusCards!.cards!.hands[fixture.holder], 'fremen');
    assert.deepEqual(pending.spiceDiscard[0].at(-1), { worm: true });
    assert.equal(pending.nexus, true);
    assert.deepEqual(pending.wormRides, []);
    assert.ok(!pending.summonedWorm);
    assert.ok(!pending.players.some(player => player.faction === 'fremen'));
    nexusFremenProtectionInventory(pending);

    const resolved = closeProtection(fixture, true);
    assert.equal(resolved.nexusFremenProtection!.stage, 'complete');
    assert.equal(resolved.nexusFremenProtection!.protected, fixture.holder);
    assertDevoured(pending, resolved, fixture, fixture.holder);
    assertSpiceCleared(pending, resolved, fixture);
    assert.equal(resolved.spiceWindow?.territory, fixture.replacement,
      'afterWorm resumes the original next undealt spice card');
    assert.equal(resolved.spiceDeck.length, pending.spiceDeck.length - 1,
      'The replacement producer runs exactly once');
    assert.deepEqual(resolved.wormRides, [], 'This printed protection grants no worm riding');
    assert.ok(!resolved.nexusFremenCunningOffer && !resolved.nexusFremenCunningRides?.length);
    assert.equal(resolved.nexusCards!.cards!.hands[fixture.holder], null);
    assert.equal(resolved.nexusCards!.cards!.discard.filter(card => card === 'fremen').length, 1);
    assert.equal(nexusFremenProtectionPlayer(resolved, fixture.holder).faction, 'emperor',
      'Protection grants no native force identity');
    nexusFremenProtectionInventory(resolved);

    const closed = continueToLaterNexus(resolved);
    assert.equal(closed.turn, 3);
    assert.equal(closed.nexusCards!.phase!.stage, 'complete',
      'The later native Nexus and its private choices still close');
    assert.notEqual(closed.nexusCards!.cards!.hands[fixture.holder], 'fremen',
      'The spent singleton cannot be redrawn from the later real closing');
    assert.equal(closed.nexusCards!.cards!.discard.filter(card => card === 'fremen').length, 1);
    assert.equal(nexusFremenProtectionPlayer(closed, fixture.holder).forces[fixture.location], 1);
    assert.equal(nexusFremenProtectionPlayer(closed, fixture.holder).tanks,
      nexusFremenProtectionPlayer(pending, fixture.holder).tanks);
    assert.deepEqual(closed.wormRides, []);
    nexusFremenProtectionInventory(closed);
    reject(closed, fixture.holder, { type: 'nexusFremenProtection', event: frame.event, use: true });
  });

  void test(`${label}: Pass leaves the Fremen card held and the original worm sends the group to Tanks before the native closing`, () => {
    const fixture = createNexusFremenProtectionFixture({ advanced });
    const pending = fixture.game;
    const resolved = closeProtection(fixture, false);
    assert.equal(resolved.nexusFremenProtection!.protected, null);
    assertDevoured(pending, resolved, fixture, null);
    assertSpiceCleared(pending, resolved, fixture);
    assert.equal(resolved.nexusCards!.cards!.hands[fixture.holder], 'fremen',
      'A Pass keeps holding the physical Fremen card');
    assert.ok(!resolved.nexusCards!.cards!.discard.includes('fremen'));
    assert.equal(resolved.spiceWindow?.territory, fixture.replacement);
    assert.deepEqual(resolved.wormRides, []);
    nexusFremenProtectionInventory(resolved);
    const closed = continueToLaterNexus(resolved);
    assert.equal(closed.nexusCards!.phase!.stage, 'complete');
    assert.equal(closed.nexusCards!.cards!.hands[fixture.holder], 'fremen');
    assert.ok(!closed.nexusCards!.cards!.discard.includes('fremen'));
    assert.equal(nexusFremenProtectionPresence(closed, fixture.holder, fixture.territory), 0);
    assert.equal(nexusFremenProtectionPlayer(closed, fixture.holder).tanks,
      nexusFremenProtectionPlayer(pending, fixture.holder).tanks + 1);
    assert.deepEqual(closed.wormRides, []);
    nexusFremenProtectionInventory(closed);
  });

  void test(`${label}: wrong actor, stale event, extra keys, wrong schema and replay stay immutable at the boundary`, () => {
    const fixture = createNexusFremenProtectionFixture({ advanced });
    const pending = fixture.game, decision = pending.decision;
    assert.ok(decision?.kind === 'nexusFremenProtection');
    const actor = decision.player, event = decision.event;
    const before = structuredClone(pending);
    reject(pending, fixture.allies[0], { type: 'nexusFremenProtection', event, use: false });
    reject(pending, actor, { type: 'nexusFremenProtection', event: 'not-this-occurrence', use: false });
    reject(pending, actor, { type: 'nexusFremenProtection', event, use: false, territory: fixture.territory });
    reject(pending, actor, { type: 'nexusFremenProtection', event, use: false, owner: fixture.holder });
    reject(pending, actor, { type: 'nexusFremenProtection', event, use: false, karama: true });
    reject(pending, actor, { type: 'decision', event, accept: true });
    reject(pending, actor, { type: 'nexusFremenProtection', event });
    reject(pending, actor, { type: 'nexusFremenProtection', use: false });
    const action: Action = { type: 'nexusFremenProtection', event, use: false };
    const answered = applyNexusFremenProtectionStep(pending, { actor, action });
    reject(answered, actor, action);
    if (answered.decision?.kind === 'nexusFremenProtection') {
      assert.equal(answered.decision.event, event);
      assert.notEqual(answered.decision.player, actor);
      assert.equal(nexusFremenProtectionPlayer(answered, fixture.holder).forces[fixture.location], 1);
      assert.equal(nexusFremenProtectionPlayer(answered, fixture.neutral).forces[fixture.location], 1);
      assert.deepEqual(holdings(answered), holdings(before),
        'No acknowledgement may resolve a group before the queue closes');
    }
    nexusFremenProtectionInventory(answered);
  });

  void test(`${label}: all four legal bot profiles answer only their real queue owner at this boundary`, () => {
    const fixture = createNexusFremenProtectionFixture({ advanced });
    for (const profile of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
      let game = structuredClone(fixture.game);
      const before = structuredClone(game);
      for (const expected of game.nexusFremenProtection!.order) {
        const decision = game.decision;
        assert.ok(decision?.kind === 'nexusFremenProtection');
        assert.equal(decision.player, expected);
        const view = viewGame(game, expected);
        view.players.find(player => player.id === expected)!.bot = profile;
        const snapshot = structuredClone(view);
        const action = botActions(view).find(candidate => candidate.type === 'nexusFremenProtection');
        assert.ok(action, `${profile} answers the real worm protection acknowledgement`);
        assert.deepEqual(view, snapshot, 'Bot policy never mutates its own private projection');
        assert.equal(action.event, decision.event);
        assert.equal(action.use, expected === fixture.holder,
          'The irrelevant Nexus face passes while the actual holder protects its own group');
        const wrong = viewGame(game, fixture.allies[0]);
        wrong.players.find(player => player.id === fixture.allies[0])!.bot = profile;
        assert.ok(botActions(wrong).every(candidate => candidate.type !== 'nexusFremenProtection'),
          'A seat with no current acknowledgement receives no unsolicited impossible prompt');
        game = applyNexusFremenProtectionStep(game, { actor: expected, action });
        nexusFremenProtectionInventory(game);
      }
      assert.equal(game.nexusFremenProtection!.stage, 'complete');
      assert.equal(game.nexusFremenProtection!.protected, fixture.holder);
      assertDevoured(before, game, fixture, fixture.holder);
      assert.equal(game.nexusCards!.cards!.hands[fixture.holder], null);
      assert.equal(game.nexusCards!.cards!.discard.filter(card => card === 'fremen').length, 1);
      assert.deepEqual(game.wormRides, []);
    }
  });
}

for (const advanced of [false, true]) {
  void test(`${advanced ? 'Advanced' : 'Basic'}: protection keeps the original Great Maker vote before the replacement blow`, () => {
    const fixture = createNexusFremenProtectionFixture({ advanced, greatMaker: true });
    const pending = fixture.game;
    assert.equal(pending.greatMaker?.stage, 'worm');
    assert.deepEqual(pending.spiceDiscard[0].at(-1), { worm: true, greatMaker: true });
    const resolved = closeProtection(fixture, true);
    assertDevoured(pending, resolved, fixture, fixture.holder);
    assertSpiceCleared(pending, resolved, fixture);
    assert.equal(resolved.greatMaker?.stage, 'vote');
    assert.equal(resolved.greatMaker?.event, pending.greatMaker?.event);
    assert.equal(resolved.decision?.kind, 'greatMakerVote');
    assert.equal(resolved.spiceDeck.length, pending.spiceDeck.length,
      'The original vote must finish before drawing another physical spice card');
    const voted = advanceNexusFremenProtection(resolved, game =>
      game.greatMaker?.stage === 'complete' && game.spiceWindow?.territory === fixture.replacement &&
      nexusFremenProtectionClean(game));
    assert.equal(voted.spiceDeck.length, pending.spiceDeck.length - 1);
    assert.deepEqual(voted.wormRides, []);
    assert.equal(nexusFremenProtectionPlayer(voted, fixture.holder).forces[fixture.location], 1);
    assert.equal(voted.nexusCards!.cards!.hands[fixture.holder], null);
    nexusFremenProtectionInventory(voted);
  });
}
